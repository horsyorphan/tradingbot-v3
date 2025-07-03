const { ipcRenderer } = require('electron');

function cryptoApp() {
  return {
    // Application state
    activeTab: 'trade',
    isConnected: false,
    isTestnet: false,
    isInitializing: false,
    isLoadingData: false,
    
    // Trading data
    selectedSymbol: '',
    symbols: [],
    symbolSearch: '',
    filteredSymbols: [],
    showSymbolDropdown: false,
    currentPrice: null,
    priceChange24h: null,
    volume24h: null,
    orderQuantity: '',
    balances: [],
    currentSubscription: null, // Track current WebSocket subscription
    portfolioSubscriptions: new Set(), // Track portfolio symbol subscriptions

    // Portfolio data
    portfolio: [],
    totalPortfolioValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    
    // Trade history
    trades: [],
    tradeStats: {},
    
    // UI state
    messages: [],
    settings: {
      apiKey: '',
      apiSecret: '',
      isTestnet: false
    },
    confirmData: {
      title: '',
      message: '',
      action: null
    },
    
    // Price update intervals
    priceUpdateInterval: null,
    
    // Computed properties
    get estimatedValue() {
      if (!this.orderQuantity || !this.currentPrice) return '$0.00';
      const value = parseFloat(this.orderQuantity) * parseFloat(this.currentPrice);
      return '$' + value.toFixed(2);
    },
    
    get canPlaceOrder() {
      return this.isConnected && this.selectedSymbol && this.orderQuantity && parseFloat(this.orderQuantity) > 0;
    },

    // Initialization
    async init() {
      console.log('🚀 Initializing SimpleCryptoDesk...');
      this.isInitializing = true;
      
      try {
        // Step 1: Load settings
        console.log('📋 Step 1: Loading settings...');
        await this.loadSettings();
        console.log('✅ Settings loaded');
        
        // Step 2: Check connection  
        console.log('🔗 Step 2: Checking connection...');
        await this.checkConnection();
        console.log(`✅ Connection check complete: ${this.isConnected ? 'Connected' : 'Not connected'}`);
        
        // Step 3: Refresh symbols (only if connected)
        if (this.isConnected) {
          console.log('🔄 Step 3: Refreshing symbols...');
          await this.refreshSymbols();
          console.log('✅ Symbols refreshed');
        } else {
          console.log('⚠️ Step 3: Skipping symbol refresh - not connected');
        }
        
        // Initialize filtered symbols
        this.filteredSymbols = this.symbols;
        
        // Set initial symbol search to selected symbol if any
        if (this.selectedSymbol) {
          this.symbolSearch = this.selectedSymbol;
        }
        
        // Setup WebSocket price update listener
        this.setupPriceUpdateListener();
        
        // Auto-load ALL data if connected
        if (this.isConnected) {
          console.log('📊 Step 4: Auto-loading all data on startup...');
          this.showMessage('🔄 Loading portfolio data automatically...', 'info');
          
          try {
            // Load all data in the correct order
            console.log('💳 Loading account data...');
            await this.loadAccountData();
            console.log('✅ Account data loaded');
            
            console.log('📈 Loading trades...');
            await this.loadTrades();
            console.log('✅ Trades loaded');
            
            console.log('📊 Loading trade stats...');
            await this.loadTradeStats();
            console.log('✅ Trade stats loaded');
            
            console.log('💰 Calculating P&L...');
            await this.calculatePnL(); // This will also subscribe to portfolio symbols
            console.log('✅ P&L calculated');
            
            console.log('🎉 All initial data loaded successfully');
            this.showMessage('✅ Portfolio data loaded automatically', 'success');
          } catch (dataError) {
            console.error('💥 Error loading data:', dataError);
            this.showMessage('⚠️ Error loading some data: ' + dataError.message, 'error');
          }
        } else {
          console.log('⚠️ Not connected - skipping data loading');
          if (!this.settings.apiKey || !this.settings.apiSecret) {
            this.showMessage('🔑 Please set up your Binance API credentials in Settings to get started', 'info');
          } else {
            this.showMessage('🔗 Connection failed. Please check your API credentials in Settings', 'error');
          }
        }
        
        console.log('🎯 Initialization complete');
        
        // Fallback: Try auto-loading again after a short delay if connected but no data
        setTimeout(() => {
          if (this.isConnected && this.trades.length === 0) {
            console.log('🔄 Fallback: Attempting delayed auto-loading...');
            this.showMessage('🔄 Attempting delayed data loading...', 'info');
            this.refreshAllData();
          }
        }, 3000); // Wait 3 seconds then try again
        
      } catch (error) {
        console.error('💥 Initialization error:', error);
        this.showMessage('❌ Initialization failed: ' + error.message, 'error');
      } finally {
        this.isInitializing = false;
      }
    },

    // Settings management
    async loadSettings() {
      try {
        const credentials = await ipcRenderer.invoke('get-api-credentials');
        const isTestnet = await ipcRenderer.invoke('get-testnet-setting');
        
        if (credentials.apiKey) {
          this.settings.apiKey = credentials.apiKey;
          this.settings.apiSecret = credentials.apiSecret;
          this.settings.isTestnet = isTestnet;
          this.isTestnet = isTestnet;
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    },

    async saveSettings() {
      try {
        const result = await ipcRenderer.invoke('save-api-credentials', {
          apiKey: this.settings.apiKey,
          apiSecret: this.settings.apiSecret,
          isTestnet: this.settings.isTestnet
        });
        
        if (result.success) {
          this.isTestnet = this.settings.isTestnet;
          this.showMessage('✅ Settings saved successfully', 'success');
          this.closeSettingsModal();
          
          console.log('🔗 Re-checking connection after saving credentials...');
          await this.checkConnection();
          
          if (this.isConnected) {
            console.log('✅ Connected! Auto-loading all data...');
            this.showMessage('🔄 Loading all data automatically...', 'info');
            
            // Auto-load ALL data after successful connection
            await this.loadAccountData();
            await this.refreshSymbols();
            await this.refreshAllData(); // This will load trades, stats, and P&L with real-time subscriptions
            
            console.log('🎉 All data loaded after credential save');
          } else {
            console.log('❌ Still not connected after saving credentials');
            this.showMessage('⚠️ Connection failed. Please check your API credentials.', 'error');
          }
        } else {
          this.showMessage('Failed to save settings: ' + result.error, 'error');
        }
      } catch (error) {
        this.showMessage('Failed to save settings: ' + error.message, 'error');
      }
    },

    // Connection management
    async checkConnection() {
      console.log('🔗 Connection Check - Testnet Mode:', this.isTestnet);
      
      try {
        const result = await ipcRenderer.invoke('get-account-info');
        this.isConnected = result.success;
        
        if (result.success) {
          this.balances = result.data.balances || [];
          const envMsg = this.isTestnet ? 'Testnet' : 'Mainnet';
          this.showMessage(`Connected to Binance ${envMsg} API`, 'success');
          console.log('✅ WebSocket Environment:', envMsg);
        } else if (result.error) {
          this.showMessage('Connection failed: ' + result.error, 'error');
          console.log('❌ Connection Error:', result.error);
        }
      } catch (error) {
        this.isConnected = false;
        this.showMessage('Connection error: ' + error.message, 'error');
        console.log('💥 Connection Exception:', error.message);
      }
    },

    // Symbol management
    async refreshSymbols() {
      try {
        const result = await ipcRenderer.invoke('get-exchange-info');
        
        if (result.success) {
          this.symbols = result.data.symbols
            .filter(s => s.status === 'TRADING' && s.symbol.endsWith('USDT'))
            .map(s => s.symbol)
            .sort();
          
          // Initialize filtered symbols
          this.filteredSymbols = this.symbols;
          
          this.showMessage('Symbols updated', 'info');
        } else {
          this.showMessage('Failed to load symbols: ' + result.error, 'error');
        }
      } catch (error) {
        this.showMessage('Failed to load symbols: ' + error.message, 'error');
      }
    },

    filterSymbols() {
      const search = this.symbolSearch.toLowerCase();
      
      if (!search) {
        this.filteredSymbols = this.symbols;
        return;
      }
      
      this.filteredSymbols = this.symbols.filter(symbol => 
        symbol.toLowerCase().includes(search)
      ).sort((a, b) => {
        // Prioritize symbols that start with the search term
        const aStarts = a.toLowerCase().startsWith(search);
        const bStarts = b.toLowerCase().startsWith(search);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        return a.localeCompare(b);
      });
      
      this.showSymbolDropdown = true;
    },

    async selectSymbol(symbol) {
      this.selectedSymbol = symbol;
      this.symbolSearch = symbol;
      this.showSymbolDropdown = false;
      this.filteredSymbols = this.symbols; // Reset filter
      await this.onSymbolChange();
    },

    clearSymbolSearch() {
      this.selectedSymbol = '';
      this.symbolSearch = '';
      this.filteredSymbols = this.symbols;
      this.currentPrice = null;
      this.priceChange24h = null;
      this.volume24h = null;
    },

    // Price management
    async refreshPrice() {
      if (!this.selectedSymbol) return;
      
      console.log('🔄 Refreshing price for:', this.selectedSymbol, '| Testnet:', this.isTestnet);
      
      try {
        const result = await ipcRenderer.invoke('get-ticker-price', this.selectedSymbol);
        
        if (result.success) {
          console.log('✅ Price update successful');
          if (Array.isArray(result.data)) {
            const tickerData = result.data.find(t => t.symbol === this.selectedSymbol);
            if (tickerData) {
              this.currentPrice = parseFloat(tickerData.price).toFixed(4);
            }
          } else {
            this.currentPrice = parseFloat(result.data.price).toFixed(4);
          }
        } else {
          console.log('❌ Price update failed:', result.error);
        }
        
        // Also get 24hr stats
        await this.get24hrStats();
      } catch (error) {
        console.log('💥 Price update exception:', error.message);
        this.showMessage('Failed to refresh price: ' + error.message, 'error');
      }
    },

    async get24hrStats() {
      if (!this.selectedSymbol) return;
      
      try {
        // This would need to be implemented in the main process
        // For now, we'll skip the 24hr stats or implement a simple version
        this.priceChange24h = 0;
        this.volume24h = 0;
      } catch (error) {
        console.error('Failed to get 24hr stats:', error);
      }
    },

    async onSymbolChange() {
      console.log('🔄 Symbol changed to:', this.selectedSymbol);
      
      if (this.selectedSymbol) {
        // Get initial price via REST API
        await this.refreshPrice();
        
        // Subscribe to real-time WebSocket updates
        await this.subscribeToPrice(this.selectedSymbol);
      }
    },

    // Setup WebSocket price update listener
    setupPriceUpdateListener() {
      ipcRenderer.on('price-update', (event, data) => {
        console.log('📨 Received price-update event:', JSON.stringify(data, null, 2));
        
        // Update selected symbol price display
        if (data.symbol === this.selectedSymbol) {
          this.currentPrice = parseFloat(data.price).toFixed(4);
          console.log('💰 Real-time price update:', this.selectedSymbol, '$' + this.currentPrice);
        }
        
        // Update portfolio P&L if this symbol is in our portfolio
        if (this.portfolioSubscriptions.has(data.symbol)) {
          this.updatePortfolioSymbolPrice(data.symbol, parseFloat(data.price));
          console.log('📊 Real-time P&L update for:', data.symbol, '$' + data.price);
        }
      });
    },

    // Update a specific symbol's price in the portfolio and recalculate P&L
    updatePortfolioSymbolPrice(symbol, newPrice) {
      // Find and update the portfolio position
      const position = this.portfolio.find(p => p.symbol === symbol);
      if (position && position.totalQuantity > 0) {
        // Update current price and recalculate values
        position.currentPrice = newPrice;
        position.currentValue = position.totalQuantity * newPrice;
        
        // Recalculate unrealized P&L
        position.unrealizedPnL = position.currentValue - position.totalCost;
        position.unrealizedPnLPercent = position.totalCost > 0 ? (position.unrealizedPnL / position.totalCost) * 100 : 0;
        
        // Recalculate total P&L
        position.totalPnL = position.realizedPnL + position.unrealizedPnL;
        position.totalPnLPercent = position.totalInvested > 0 ? (position.totalPnL / position.totalInvested) * 100 : 0;
        
        // Update overall portfolio totals
        this.updatePortfolioTotals();
      }
    },

    // Recalculate overall portfolio totals
    updatePortfolioTotals() {
      let totalValue = 0;
      let totalCost = 0;
      let totalRealizedPnL = 0;
      let totalUnrealizedPnL = 0;
      
      this.portfolio.forEach(position => {
        if (position.totalQuantity > 0) {
          totalValue += position.currentValue || 0;
          totalCost += position.totalCost || 0;
        }
        totalRealizedPnL += position.realizedPnL || 0;
        totalUnrealizedPnL += position.unrealizedPnL || 0;
      });
      
      this.totalPortfolioValue = totalValue;
      this.totalRealizedPnL = totalRealizedPnL;
      this.totalUnrealizedPnL = totalUnrealizedPnL;
      this.totalPnL = totalRealizedPnL + totalUnrealizedPnL;
      this.totalPnLPercent = totalCost > 0 ? (this.totalPnL / totalCost) * 100 : 0;
    },

    // Subscribe to real-time price updates for selected symbol
    async subscribeToPrice(symbol) {
      if (!symbol) return;
      
      // Unsubscribe from previous symbol if any
      if (this.currentSubscription) {
        await this.unsubscribeFromPrice(this.currentSubscription);
      }
      
      try {
        console.log('📡 Subscribing to real-time price updates for:', symbol);
        const result = await ipcRenderer.invoke('subscribe-price', symbol);
        
        if (result.success) {
          this.currentSubscription = symbol;
          console.log('✅ Successfully subscribed to price updates for:', symbol);
        } else {
          console.error('❌ Failed to subscribe to price updates:', result.error);
          this.showMessage('Failed to subscribe to price updates: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('💥 Price subscription error:', error);
        this.showMessage('Price subscription error: ' + error.message, 'error');
      }
    },

    // Unsubscribe from price updates
    async unsubscribeFromPrice(symbol) {
      if (!symbol) return;
      
      try {
        console.log('📡 Unsubscribing from price updates for:', symbol);
        const result = await ipcRenderer.invoke('unsubscribe-price', symbol);
        
        if (result.success) {
          console.log('✅ Successfully unsubscribed from price updates for:', symbol);
        } else {
          console.warn('⚠️ Failed to unsubscribe from price updates:', result.error);
        }
      } catch (error) {
        console.warn('💥 Price unsubscription error:', error);
      }
    },

    // Subscribe to real-time price updates for all portfolio symbols
    async subscribeToPortfolioSymbols() {
      if (!this.portfolio || this.portfolio.length === 0) return;
      
      // Get unique symbols from current portfolio
      const portfolioSymbols = [...new Set(this.portfolio.map(p => p.symbol))];
      
      // Unsubscribe from symbols no longer in portfolio
      for (const oldSymbol of this.portfolioSubscriptions) {
        if (!portfolioSymbols.includes(oldSymbol)) {
          await this.unsubscribeFromPrice(oldSymbol);
          this.portfolioSubscriptions.delete(oldSymbol);
        }
      }
      
      // Subscribe to new portfolio symbols
      for (const symbol of portfolioSymbols) {
        if (!this.portfolioSubscriptions.has(symbol) && symbol !== this.currentSubscription) {
          try {
            console.log('📊 Subscribing to portfolio price updates for:', symbol);
            const result = await ipcRenderer.invoke('subscribe-price', symbol);
            
            if (result.success) {
              this.portfolioSubscriptions.add(symbol);
              console.log('✅ Successfully subscribed to portfolio price updates for:', symbol);
            } else {
              console.error('❌ Failed to subscribe to portfolio price updates:', result.error);
            }
          } catch (error) {
            console.error('💥 Portfolio price subscription error:', error);
          }
        }
      }
      
      console.log('📊 Portfolio subscriptions:', Array.from(this.portfolioSubscriptions));
    },

    // Trading functions
    async placeBuyOrder() {
      await this.placeOrder('BUY');
    },

    async placeSellOrder() {
      await this.placeOrder('SELL');
    },

    async placeOrder(side) {
      if (!this.canPlaceOrder) return;
      
      const orderData = {
        symbol: this.selectedSymbol,
        side: side,
        quantity: this.orderQuantity,
        type: 'MARKET'
      };
      
      // Show confirmation dialog
      const confirmed = await this.showConfirmation(
        'Confirm Order',
        `Are you sure you want to ${side} ${this.orderQuantity} ${this.selectedSymbol} at market price?\n\nEstimated value: ${this.estimatedValue}`
      );
      
      if (!confirmed) return;
      
      try {
        this.showMessage(`Placing ${side} order...`, 'info');
        
        const result = await ipcRenderer.invoke('place-order', orderData);
        
        if (result.success) {
          this.showMessage(`${side} order executed successfully!`, 'success');
          this.orderQuantity = '';
          
          // Auto-refresh all data after successful trade
          console.log('🔄 Auto-refreshing data after successful trade...');
          await this.loadAccountData();
          await this.loadTrades();
          await this.loadTradeStats();
          await this.calculatePnL(); // This will also update portfolio subscriptions
          
          console.log('✅ Data auto-refresh completed');
        } else {
          this.showMessage(`Order failed: ${result.error}`, 'error');
        }
      } catch (error) {
        this.showMessage(`Order error: ${error.message}`, 'error');
      }
    },

    // Refresh all data
    async refreshAllData() {
      if (!this.isConnected) {
        this.showMessage('Please connect to API first', 'error');
        return;
      }
      
      if (this.isLoadingData) {
        this.showMessage('Data is already being loaded...', 'info');
        return;
      }
      
      this.isLoadingData = true;
      
      try {
        console.log('🔄 Refreshing all data...');
        this.showMessage('🔄 Refreshing all data...', 'info');
        
        // Load all data in the correct order
        console.log('💳 Loading account data...');
        await this.loadAccountData();
        console.log('✅ Account data loaded');
        
        console.log('📈 Loading trades...');
        await this.loadTrades();
        console.log('✅ Trades loaded');
        
        console.log('📊 Loading trade stats...');
        await this.loadTradeStats();
        console.log('✅ Trade stats loaded');
        
        console.log('💰 Calculating P&L...');
        await this.calculatePnL(); // This will also update portfolio subscriptions
        console.log('✅ P&L calculated');
        
        console.log('🎉 All data refreshed successfully');
        this.showMessage('✅ All data refreshed successfully', 'success');
      } catch (error) {
        console.error('💥 Data refresh error:', error);
        this.showMessage('Failed to refresh data: ' + error.message, 'error');
      } finally {
        this.isLoadingData = false;
      }
    },

    // Account data
    async loadAccountData() {
      if (!this.isConnected) return;
      
      try {
        console.log('💳 Loading account data...');
        const result = await ipcRenderer.invoke('get-account-info');
        
        if (result.success) {
          this.balances = result.data.balances || [];
          console.log(`💰 Loaded ${this.balances.length} account balances`);
        } else {
          console.error('❌ Failed to load account data:', result.error);
          this.showMessage('Failed to load account data: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('💥 Account loading error:', error);
        this.showMessage('Failed to load account data: ' + error.message, 'error');
      }
    },

    // Trade history
    async loadTrades() {
      try {
        console.log('📈 Loading trade history...');
        const result = await ipcRenderer.invoke('get-trades');
        
        if (result.success) {
          this.trades = result.data || [];
          console.log(`📊 Loaded ${this.trades.length} trades from database`);
        } else {
          console.error('❌ Failed to load trades:', result.error);
          this.showMessage('Failed to load trades: ' + result.error, 'error');
        }
      } catch (error) {
        console.error('💥 Trade loading error:', error);
        this.showMessage('Failed to load trades: ' + error.message, 'error');
      }
    },

    async loadTradeStats() {
      try {
        console.log('📊 Calculating trade statistics...');
        
        // Calculate stats from trades data
        const successfulTrades = this.trades.filter(t => t.success);
        const failedTrades = this.trades.filter(t => !t.success);
        const totalTrades = this.trades.length;
        
        this.tradeStats = {
          totalTrades: totalTrades,
          failedTrades: failedTrades.length,
          successRate: totalTrades > 0 ? ((successfulTrades.length / totalTrades) * 100).toFixed(2) : 0,
          totalVolume: successfulTrades.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0)
        };
        
        console.log(`📊 Trade stats calculated: ${totalTrades} total trades, ${successfulTrades.length} successful, ${this.tradeStats.successRate}% success rate`);
      } catch (error) {
        console.error('💥 Failed to calculate trade stats:', error);
      }
    },

    async confirmClearTrades() {
      const confirmed = await this.showConfirmation(
        'Clear All Trades',
        'Are you sure you want to clear all trade history? This action cannot be undone.'
      );
      
      if (confirmed) {
        await this.clearTrades();
      }
    },

    async clearTrades() {
      try {
        const result = await ipcRenderer.invoke('clear-trades');
        
        if (result.success) {
          this.trades = [];
          this.tradeStats = {};
          this.portfolio = [];
          this.totalPortfolioValue = 0;
          this.totalPnL = 0;
          this.totalPnLPercent = 0;
          this.totalRealizedPnL = 0;
          this.totalUnrealizedPnL = 0;
          this.showMessage('Trade history cleared', 'info');
        } else {
          this.showMessage('Failed to clear trades: ' + result.error, 'error');
        }
      } catch (error) {
        this.showMessage('Failed to clear trades: ' + error.message, 'error');
      }
    },

    // P&L calculations
    async calculatePnL() {
      try {
        console.log('📊 Calculating P&L...');
        
        // Group trades by symbol to calculate positions
        const positions = {};
        const successfulTrades = this.trades.filter(t => t.success);
        let totalRealizedPnL = 0;
        
        console.log(`📈 Processing ${successfulTrades.length} successful trades`);
        
        // Debug: Log first few trades to see data structure
        if (successfulTrades.length > 0) {
          console.log('Sample trade data:', successfulTrades[0]);
        }
        
        successfulTrades.forEach(trade => {
          const symbol = trade.symbol;
          const quantity = parseFloat(trade.quantity) || 0;
          const price = parseFloat(trade.price) || 0;
          
          console.log(`Processing ${trade.side} ${quantity} ${symbol} at $${price}`);
          
          if (!positions[symbol]) {
            positions[symbol] = {
              symbol: symbol,
              totalQuantity: 0,
              totalCost: 0,
              averagePrice: 0,
              realizedPnL: 0,
              trades: [],
              buyTrades: [],
              sellTrades: []
            };
          }
          
          const position = positions[symbol];
          position.trades.push(trade);
          
          if (trade.side === 'BUY') {
            // Add to position
            position.totalQuantity += quantity;
            position.totalCost += quantity * price;
            position.buyTrades.push(trade);
            
            // Update average price immediately
            position.averagePrice = position.totalQuantity > 0 ? position.totalCost / position.totalQuantity : 0;
            
            console.log(`After BUY: quantity=${position.totalQuantity}, cost=$${position.totalCost}, avg=$${position.averagePrice.toFixed(4)}`);
            
          } else if (trade.side === 'SELL') {
            console.log(`Before SELL: quantity=${position.totalQuantity}, avg=$${position.averagePrice}`);
            
            // Calculate realized P&L for this sale using current average price
            if (position.totalQuantity > 0 && position.averagePrice > 0) {
              const realizedPnLFromSale = (price - position.averagePrice) * quantity;
              position.realizedPnL += realizedPnLFromSale;
              totalRealizedPnL += realizedPnLFromSale;
              
              console.log(`Realized P&L from sale: $${realizedPnLFromSale.toFixed(2)} (sold at $${price} vs avg $${position.averagePrice.toFixed(4)})`);
            }
            
            // Update position (sell reduces quantity and proportional cost)
            position.totalQuantity -= quantity;
            position.totalCost -= quantity * position.averagePrice; // Use current average price, not the new price
            position.sellTrades.push(trade);
            
            // Average price stays the same for remaining position (only quantity and total cost change)
            if (position.totalQuantity > 0) {
              position.averagePrice = position.totalCost / position.totalQuantity;
            } else {
              position.averagePrice = 0;
              position.totalCost = 0; // Clean up any rounding errors
            }
            
            console.log(`After SELL: quantity=${position.totalQuantity}, cost=$${position.totalCost}, avg=$${position.averagePrice.toFixed(4)}`);
          }
        });
        
        // Log all positions after processing
        console.log('Final positions:', positions);
        
        // Get current prices and calculate unrealized P&L
        this.portfolio = [];
        let totalValue = 0;
        let totalCost = 0;
        let totalUnrealizedPnL = 0;
        let priceErrors = [];
        
        for (const symbol in positions) {
          const position = positions[symbol];
          
          // Always include positions that have trades (even if quantity is 0)
          try {
            const priceResult = await ipcRenderer.invoke('get-ticker-price', symbol);
            
            if (priceResult.success) {
              let currentPrice = 0;
              if (Array.isArray(priceResult.data)) {
                const tickerData = priceResult.data.find(t => t.symbol === symbol);
                currentPrice = tickerData ? parseFloat(tickerData.price) : 0;
              } else {
                currentPrice = parseFloat(priceResult.data.price);
              }
              
              // Calculate unrealized P&L only for current holdings
              let unrealizedPnL = 0;
              let unrealizedPnLPercent = 0;
              const currentValue = position.totalQuantity * currentPrice;
              
              if (position.totalQuantity > 0) {
                unrealizedPnL = currentValue - position.totalCost;
                unrealizedPnLPercent = position.totalCost > 0 ? (unrealizedPnL / position.totalCost) * 100 : 0;
                
                totalValue += currentValue;
                totalCost += position.totalCost;
                totalUnrealizedPnL += unrealizedPnL;
              }
              
              // Calculate total P&L (realized + unrealized)
              const totalPnLForPosition = position.realizedPnL + unrealizedPnL;
              const totalInvested = position.buyTrades.reduce((sum, t) => sum + (parseFloat(t.quantity) * parseFloat(t.price)), 0);
              const totalPnLPercent = totalInvested > 0 ? (totalPnLForPosition / totalInvested) * 100 : 0;
              
              position.currentPrice = currentPrice;
              position.currentValue = currentValue;
              position.unrealizedPnL = unrealizedPnL;
              position.unrealizedPnLPercent = unrealizedPnLPercent;
              position.totalPnL = totalPnLForPosition;
              position.totalPnLPercent = totalPnLPercent;
              position.totalInvested = totalInvested;
              
              // Add to portfolio if there are any trades for this symbol
              if (position.trades.length > 0) {
                this.portfolio.push(position);
              }
              
            } else {
              priceErrors.push(symbol);
              console.warn(`❌ Failed to get price for ${symbol}:`, priceResult.error);
            }
          } catch (error) {
            priceErrors.push(symbol);
            console.error(`💥 Error getting price for ${symbol}:`, error);
          }
        }
        
        // Update totals
        this.totalPortfolioValue = totalValue;
        this.totalPnL = totalUnrealizedPnL + totalRealizedPnL;
        this.totalPnLPercent = totalCost > 0 ? (this.totalPnL / totalCost) * 100 : 0;
        this.totalRealizedPnL = totalRealizedPnL;
        this.totalUnrealizedPnL = totalUnrealizedPnL;
        
        // Sort portfolio by total P&L (highest first)
        this.portfolio.sort((a, b) => (b.totalPnL || 0) - (a.totalPnL || 0));
        
        console.log('📊 P&L Summary:', {
          totalValue: this.totalPortfolioValue,
          totalPnL: this.totalPnL,
          realizedPnL: this.totalRealizedPnL,
          unrealizedPnL: this.totalUnrealizedPnL,
          positions: this.portfolio.length,
          priceErrors: priceErrors.length
        });
        
        if (priceErrors.length > 0) {
          this.showMessage(`Warning: Could not fetch prices for ${priceErrors.length} symbols: ${priceErrors.join(', ')}`, 'warning');
        } else {
          this.showMessage('P&L calculated successfully', 'success');
        }
        
        // Subscribe to real-time price updates for all portfolio symbols
        await this.subscribeToPortfolioSymbols();
        
      } catch (error) {
        console.error('💥 P&L calculation error:', error);
        this.showMessage('Failed to calculate P&L: ' + error.message, 'error');
      }
    },

    // UI helpers
    showMessage(text, type = 'info') {
      const message = { text, type, id: Date.now() };
      this.messages.push(message);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        this.removeMessage(this.messages.indexOf(message));
      }, 5000);
    },

    removeMessage(index) {
      if (index > -1) {
        this.messages.splice(index, 1);
      }
    },

    // Modal management
    openSettingsModal() {
      this.$refs.settingsModal.showModal();
    },

    closeSettingsModal() {
      this.$refs.settingsModal.close();
    },

    async showConfirmation(title, message) {
      return new Promise((resolve) => {
        this.confirmData = {
          title,
          message,
          action: resolve
        };
        this.$refs.confirmModal.showModal();
      });
    },

    confirmAction() {
      if (this.confirmData.action) {
        this.confirmData.action(true);
      }
      this.$refs.confirmModal.close();
    },

    cancelAction() {
      if (this.confirmData.action) {
        this.confirmData.action(false);
      }
      this.$refs.confirmModal.close();
    },

    // Cleanup
    async destroy() {
      // Unsubscribe from current price updates
      if (this.currentSubscription) {
        await this.unsubscribeFromPrice(this.currentSubscription);
      }
      
      // Unsubscribe from all portfolio price updates
      for (const symbol of this.portfolioSubscriptions) {
        await this.unsubscribeFromPrice(symbol);
      }
      this.portfolioSubscriptions.clear();
      
      // Remove event listeners
      ipcRenderer.removeAllListeners('price-update');
      
      console.log('App destroyed');
    },

    // Debug function to inspect trade data
    debugTradeData() {
      console.log('🔍 Debug: Trade Data Analysis');
      console.log(`Total trades: ${this.trades.length}`);
      
      const successful = this.trades.filter(t => t.success);
      const failed = this.trades.filter(t => !t.success);
      
      console.log(`Successful trades: ${successful.length}`);
      console.log(`Failed trades: ${failed.length}`);
      
      if (successful.length > 0) {
        console.log('\n📊 Successful Trades Analysis:');
        successful.forEach((trade, index) => {
          console.log(`Trade ${index + 1}:`, {
            symbol: trade.symbol,
            side: trade.side,
            quantity: trade.quantity,
            price: trade.price,
            priceType: typeof trade.price,
            timestamp: trade.timestamp,
            success: trade.success
          });
        });
        
        // Check for missing prices
        const missingPrices = successful.filter(t => !t.price || parseFloat(t.price) === 0);
        if (missingPrices.length > 0) {
          console.warn(`⚠️ ${missingPrices.length} trades with missing/zero prices:`, missingPrices);
        }
      }
      
      return {
        total: this.trades.length,
        successful: successful.length,
        failed: failed.length,
        missingPrices: successful.filter(t => !t.price || parseFloat(t.price) === 0).length
      };
    },
  };
} 