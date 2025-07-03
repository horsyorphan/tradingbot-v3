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
    
    // Log the trade
    const tradeRecord = {
      timestamp: new Date().toISOString(),
      symbol: orderData.symbol,
      side: orderData.side,
      quantity: orderData.quantity,
      price: result.price || result.fills?.[0]?.price,
      orderId: result.orderId,
      status: result.status,
      success: true
    };
    
    await dbManager.addTrade(tradeRecord);
    
    return { success: true, data: result };
  } catch (error) {
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