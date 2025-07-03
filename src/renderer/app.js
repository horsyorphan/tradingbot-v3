const { ipcRenderer } = require('electron');

function cryptoApp() {
  return {
    // Application state
    activeTab: 'trade',
    isConnected: false,
    isTestnet: false,
    
    // Trading data
    selectedSymbol: '',
    symbols: [],
    currentPrice: null,
    priceChange24h: null,
    volume24h: null,
    orderQuantity: '',
    balances: [],
    
    // Portfolio data
    portfolio: [],
    totalPortfolioValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    
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
      await this.loadSettings();
      await this.checkConnection();
      await this.loadTrades();
      await this.loadTradeStats();
      await this.refreshSymbols();
      this.startPriceUpdates();
      
      // Auto-load portfolio data if connected
      if (this.isConnected) {
        await this.loadAccountData();
        await this.calculatePnL();
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
          this.showMessage('Settings saved successfully', 'success');
          this.closeSettingsModal();
          await this.checkConnection();
          
          if (this.isConnected) {
            await this.loadAccountData();
            await this.refreshSymbols();
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
      try {
        const result = await ipcRenderer.invoke('get-account-info');
        this.isConnected = result.success;
        
        if (result.success) {
          this.balances = result.data.balances || [];
          this.showMessage('Connected to Binance API', 'success');
        } else if (result.error) {
          this.showMessage('Connection failed: ' + result.error, 'error');
        }
      } catch (error) {
        this.isConnected = false;
        this.showMessage('Connection error: ' + error.message, 'error');
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
          
          this.showMessage('Symbols updated', 'info');
        } else {
          this.showMessage('Failed to load symbols: ' + result.error, 'error');
        }
      } catch (error) {
        this.showMessage('Failed to load symbols: ' + error.message, 'error');
      }
    },

    // Price management
    async refreshPrice() {
      if (!this.selectedSymbol) return;
      
      try {
        const result = await ipcRenderer.invoke('get-ticker-price', this.selectedSymbol);
        
        if (result.success) {
          if (Array.isArray(result.data)) {
            const tickerData = result.data.find(t => t.symbol === this.selectedSymbol);
            if (tickerData) {
              this.currentPrice = parseFloat(tickerData.price).toFixed(4);
            }
          } else {
            this.currentPrice = parseFloat(result.data.price).toFixed(4);
          }
        }
        
        // Also get 24hr stats
        await this.get24hrStats();
      } catch (error) {
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

    onSymbolChange() {
      if (this.selectedSymbol) {
        this.refreshPrice();
      }
    },

    startPriceUpdates() {
      // Update prices every 10 seconds
      if (this.priceUpdateInterval) {
        clearInterval(this.priceUpdateInterval);
      }
      
      this.priceUpdateInterval = setInterval(() => {
        if (this.selectedSymbol && this.isConnected) {
          this.refreshPrice();
        }
      }, 10000);
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
          
          // Refresh data
          await this.loadAccountData();
          await this.loadTrades();
          await this.loadTradeStats();
          await this.calculatePnL();
        } else {
          this.showMessage(`Order failed: ${result.error}`, 'error');
        }
      } catch (error) {
        this.showMessage(`Order error: ${error.message}`, 'error');
      }
    },

    // Account data
    async loadAccountData() {
      if (!this.isConnected) return;
      
      try {
        const result = await ipcRenderer.invoke('get-account-info');
        
        if (result.success) {
          this.balances = result.data.balances || [];
        }
      } catch (error) {
        console.error('Failed to load account data:', error);
      }
    },

    // Trade history
    async loadTrades() {
      try {
        const result = await ipcRenderer.invoke('get-trades');
        
        if (result.success) {
          this.trades = result.data || [];
        } else {
          this.showMessage('Failed to load trades: ' + result.error, 'error');
        }
      } catch (error) {
        this.showMessage('Failed to load trades: ' + error.message, 'error');
      }
    },

    async loadTradeStats() {
      try {
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
      } catch (error) {
        console.error('Failed to calculate trade stats:', error);
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
        // Group trades by symbol to calculate positions
        const positions = {};
        const successfulTrades = this.trades.filter(t => t.success);
        
        successfulTrades.forEach(trade => {
          const symbol = trade.symbol;
          if (!positions[symbol]) {
            positions[symbol] = {
              symbol: symbol,
              totalQuantity: 0,
              totalCost: 0,
              averagePrice: 0,
              trades: []
            };
          }
          
          const position = positions[symbol];
          const quantity = parseFloat(trade.quantity) || 0;
          const price = parseFloat(trade.price) || 0;
          
          position.trades.push(trade);
          
          if (trade.side === 'BUY') {
            position.totalQuantity += quantity;
            position.totalCost += quantity * price;
          } else if (trade.side === 'SELL') {
            position.totalQuantity -= quantity;
            position.totalCost -= quantity * price;
          }
          
          // Calculate average price
          if (position.totalQuantity > 0) {
            position.averagePrice = position.totalCost / position.totalQuantity;
          }
        });
        
        // Get current prices and calculate P&L
        this.portfolio = [];
        let totalValue = 0;
        let totalCost = 0;
        
        for (const symbol in positions) {
          const position = positions[symbol];
          
          if (position.totalQuantity > 0) {
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
                
                const currentValue = position.totalQuantity * currentPrice;
                const pnl = currentValue - position.totalCost;
                const pnlPercent = position.totalCost > 0 ? (pnl / position.totalCost) * 100 : 0;
                
                position.currentPrice = currentPrice;
                position.currentValue = currentValue;
                position.pnl = pnl;
                position.pnlPercent = pnlPercent;
                
                totalValue += currentValue;
                totalCost += position.totalCost;
                
                this.portfolio.push(position);
              }
            } catch (error) {
              console.error(`Failed to get price for ${symbol}:`, error);
            }
          }
        }
        
        this.totalPortfolioValue = totalValue;
        this.totalPnL = totalValue - totalCost;
        this.totalPnLPercent = totalCost > 0 ? (this.totalPnL / totalCost) * 100 : 0;
        
      } catch (error) {
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
    destroy() {
      if (this.priceUpdateInterval) {
        clearInterval(this.priceUpdateInterval);
      }
    }
  };
} 