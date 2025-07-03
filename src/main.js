const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const keytar = require('keytar');
const BinanceAPI = require('./utils/binance-api');
const DatabaseManager = require('./utils/database');

let mainWindow;
let binanceAPI;
let dbManager;

const isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Initialize database
  dbManager = new DatabaseManager();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-api-credentials', async () => {
  try {
    const apiKey = await keytar.getPassword('SimpleCryptoDesk', 'binance-api-key');
    const apiSecret = await keytar.getPassword('SimpleCryptoDesk', 'binance-api-secret');
    return { apiKey, apiSecret };
  } catch (error) {
    console.error('Error getting API credentials:', error);
    return { apiKey: null, apiSecret: null };
  }
});

ipcMain.handle('save-api-credentials', async (event, { apiKey, apiSecret, isTestnet }) => {
  try {
    await keytar.setPassword('SimpleCryptoDesk', 'binance-api-key', apiKey);
    await keytar.setPassword('SimpleCryptoDesk', 'binance-api-secret', apiSecret);
    await keytar.setPassword('SimpleCryptoDesk', 'binance-testnet', isTestnet.toString());
    
    // Initialize Binance API
    binanceAPI = new BinanceAPI(apiKey, apiSecret, isTestnet);
    
    return { success: true };
  } catch (error) {
    console.error('Error saving API credentials:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-testnet-setting', async () => {
  try {
    const isTestnet = await keytar.getPassword('SimpleCryptoDesk', 'binance-testnet');
    return isTestnet === 'true';
  } catch (error) {
    return false;
  }
});

ipcMain.handle('get-account-info', async () => {
  if (!binanceAPI) {
    return { success: false, error: 'API not initialized' };
  }
  
  try {
    const accountInfo = await binanceAPI.getAccountInfo();
    return { success: true, data: accountInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-exchange-info', async () => {
  if (!binanceAPI) {
    return { success: false, error: 'API not initialized' };
  }
  
  try {
    const exchangeInfo = await binanceAPI.getExchangeInfo();
    return { success: true, data: exchangeInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-ticker-price', async (event, symbol) => {
  if (!binanceAPI) {
    return { success: false, error: 'API not initialized' };
  }
  
  try {
    const price = await binanceAPI.getTickerPrice(symbol);
    return { success: true, data: price };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('place-order', async (event, orderData) => {
  if (!binanceAPI) {
    return { success: false, error: 'API not initialized' };
  }
  
  try {
    const result = await binanceAPI.placeOrder(orderData);
    
    console.log('📋 Binance API response:', JSON.stringify(result, null, 2));
    
    // Extract price from various possible locations in the response
    let executionPrice = null;
    
    // Try different price sources
    if (result.price) {
      executionPrice = result.price;
      console.log('💰 Price from result.price:', executionPrice);
    } else if (result.fills && result.fills.length > 0) {
      // For market orders, price is usually in fills
      executionPrice = result.fills[0].price;
      console.log('💰 Price from fills[0].price:', executionPrice);
    } else if (result.cummulativeQuoteQty && result.executedQty) {
      // Calculate average price from cumulative quote quantity
      const executedQty = parseFloat(result.executedQty);
      const quoteQty = parseFloat(result.cummulativeQuoteQty);
      if (executedQty > 0 && quoteQty > 0) {
        executionPrice = (quoteQty / executedQty).toString();
        console.log('💰 Price calculated from cumulative data:', executionPrice);
      }
    }
    
    // Fallback: get current market price if execution price is still missing
    if (!executionPrice || parseFloat(executionPrice) === 0) {
      console.log('⚠️ No execution price found, fetching current market price...');
      try {
        const tickerResult = await binanceAPI.getTickerPrice(orderData.symbol);
        if (tickerResult && tickerResult.price) {
          executionPrice = tickerResult.price;
          console.log('💰 Price from current market ticker:', executionPrice);
        }
      } catch (tickerError) {
        console.error('Failed to get fallback price:', tickerError.message);
      }
    }
    
    console.log('🎯 Final execution price used:', executionPrice);
    
    // Log the trade
    const tradeRecord = {
      timestamp: new Date().toISOString(),
      symbol: orderData.symbol,
      side: orderData.side,
      quantity: orderData.quantity,
      price: executionPrice,
      orderId: result.orderId,
      status: result.status,
      success: true,
      rawResponse: JSON.stringify(result) // Store raw response for debugging
    };
    
    console.log('📝 Saving trade record:', tradeRecord);
    await dbManager.addTrade(tradeRecord);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Order placement failed:', error);
    
    // Log failed trade
    const failedTrade = {
      timestamp: new Date().toISOString(),
      symbol: orderData.symbol,
      side: orderData.side,
      quantity: orderData.quantity,
      error: error.message,
      success: false
    };
    
    await dbManager.addTrade(failedTrade);
    
    return { success: false, error: error.message };
  }
});

// WebSocket price subscription handlers
ipcMain.handle('subscribe-price', async (event, symbol) => {
  if (!binanceAPI) {
    return { success: false, error: 'API not initialized' };
  }
  
  try {
    binanceAPI.subscribeToPrice(symbol, (priceData) => {
      // Debug: Log the actual WebSocket message structure
      console.log('📡 Raw WebSocket price data for', symbol, ':', JSON.stringify(priceData, null, 2));
      
      // For bookTicker streams, the price data comes directly
      // priceData = { u: 123, s: "ETHUSDT", b: "2584.81", B: "1.23", a: "2585.31", A: "2.45" }
      const currentPrice = priceData.a || priceData.c; // Use ask price as current, fallback to close
      
      // Send real-time price update to renderer (only if window exists)
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('price-update', {
          symbol: symbol,
          price: currentPrice,
          bid: priceData.b,   // Best bid price
          ask: priceData.a    // Best ask price
        });
        
        console.log('💰 Sending price update to renderer:', symbol, '$' + currentPrice);
      } else {
        console.log('⚠️ MainWindow not ready, skipping price update for:', symbol);
      }
    });
    
    console.log('📡 Subscribed to real-time price updates for:', symbol);
    return { success: true };
  } catch (error) {
    console.error('❌ Price subscription failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unsubscribe-price', async (event, symbol) => {
  if (!binanceAPI) {
    return { success: false, error: 'API not initialized' };
  }
  
  try {
    const stream = `${symbol.toLowerCase()}@bookTicker`;
    binanceAPI.unsubscribeFromStream(stream);
    console.log('📡 Unsubscribed from price updates for:', symbol);
    return { success: true };
  } catch (error) {
    console.error('❌ Price unsubscription failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-trades', async () => {
  try {
    const trades = await dbManager.getTrades();
    return { success: true, data: trades };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-trades', async () => {
  try {
    await dbManager.clearTrades();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-confirmation-dialog', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'Confirm'],
    defaultId: 1,
    message: options.message,
    detail: options.detail,
    cancelId: 0
  });
  
  return result.response === 1;
});

// Handle app updates and cleanup
app.on('before-quit', async () => {
  if (binanceAPI) {
    binanceAPI.cleanup();
  }
}); 