const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DatabaseManager {
  constructor() {
    this.dbPath = this.getDbPath();
    this.ensureDbDirectory();
    this.initializeDatabase();
  }

  getDbPath() {
    // Get the app data directory
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'trades.json');
  }

  ensureDbDirectory() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  initializeDatabase() {
    try {
      const adapter = new FileSync(this.dbPath);
      this.db = low(adapter);
      
      // Set default data structure
      this.db.defaults({
        trades: [],
        settings: {
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
      }).write();
      
      console.log('Database initialized at:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async addTrade(tradeData) {
    try {
      // Create trade record with unique ID
      const trade = {
        id: this.generateTradeId(),
        ...tradeData,
        createdAt: new Date().toISOString()
      };
      
      // Add to trades array
      this.db.get('trades').push(trade).write();
      
      // Update last modified timestamp
      this.db.set('settings.lastUpdated', new Date().toISOString()).write();
      
      console.log('Trade added:', trade);
      return trade;
    } catch (error) {
      console.error('Failed to add trade:', error);
      throw error;
    }
  }

  async getTrades(options = {}) {
    try {
      let trades = this.db.get('trades').value() || [];
      
      // Apply filters
      if (options.symbol) {
        trades = trades.filter(trade => 
          trade.symbol && trade.symbol.toLowerCase() === options.symbol.toLowerCase()
        );
      }
      
      if (options.side) {
        trades = trades.filter(trade => 
          trade.side && trade.side.toLowerCase() === options.side.toLowerCase()
        );
      }
      
      if (options.success !== undefined) {
        trades = trades.filter(trade => trade.success === options.success);
      }
      
      if (options.startDate) {
        trades = trades.filter(trade => 
          new Date(trade.timestamp) >= new Date(options.startDate)
        );
      }
      
      if (options.endDate) {
        trades = trades.filter(trade => 
          new Date(trade.timestamp) <= new Date(options.endDate)
        );
      }
      
      // Sort by timestamp (newest first)
      trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply limit
      if (options.limit) {
        trades = trades.slice(0, options.limit);
      }
      
      return trades;
    } catch (error) {
      console.error('Failed to get trades:', error);
      throw error;
    }
  }

  async getTradeById(id) {
    try {
      return this.db.get('trades').find({ id }).value();
    } catch (error) {
      console.error('Failed to get trade by ID:', error);
      throw error;
    }
  }

  async updateTrade(id, updateData) {
    try {
      const updatedTrade = this.db.get('trades')
        .find({ id })
        .assign({
          ...updateData,
          updatedAt: new Date().toISOString()
        })
        .write();
      
      // Update last modified timestamp
      this.db.set('settings.lastUpdated', new Date().toISOString()).write();
      
      return updatedTrade;
    } catch (error) {
      console.error('Failed to update trade:', error);
      throw error;
    }
  }

  async deleteTrade(id) {
    try {
      const deletedTrade = this.db.get('trades').find({ id }).value();
      
      this.db.get('trades').remove({ id }).write();
      
      // Update last modified timestamp
      this.db.set('settings.lastUpdated', new Date().toISOString()).write();
      
      return deletedTrade;
    } catch (error) {
      console.error('Failed to delete trade:', error);
      throw error;
    }
  }

  async clearTrades() {
    try {
      this.db.set('trades', []).write();
      this.db.set('settings.lastUpdated', new Date().toISOString()).write();
      
      console.log('All trades cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear trades:', error);
      throw error;
    }
  }

  async getTradeStats() {
    try {
      const trades = await this.getTrades({ success: true });
      const failedTrades = await this.getTrades({ success: false });
      
      // Calculate basic statistics
      const stats = {
        totalTrades: trades.length,
        failedTrades: failedTrades.length,
        successRate: trades.length > 0 ? ((trades.length / (trades.length + failedTrades.length)) * 100).toFixed(2) : 0,
        buyTrades: trades.filter(t => t.side === 'BUY').length,
        sellTrades: trades.filter(t => t.side === 'SELL').length,
        uniqueSymbols: [...new Set(trades.map(t => t.symbol))].length,
        totalVolume: trades.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0),
        dateRange: {
          oldest: trades.length > 0 ? trades[trades.length - 1].timestamp : null,
          newest: trades.length > 0 ? trades[0].timestamp : null
        }
      };
      
      return stats;
    } catch (error) {
      console.error('Failed to get trade stats:', error);
      throw error;
    }
  }

  async getPortfolioData() {
    try {
      const trades = await this.getTrades({ success: true });
      
      // Group trades by symbol
      const portfolio = {};
      
      trades.forEach(trade => {
        if (!portfolio[trade.symbol]) {
          portfolio[trade.symbol] = {
            symbol: trade.symbol,
            totalQuantity: 0,
            totalCost: 0,
            averagePrice: 0,
            buyQuantity: 0,
            sellQuantity: 0,
            realizedPnL: 0,
            trades: []
          };
        }
        
        const position = portfolio[trade.symbol];
        const quantity = parseFloat(trade.quantity) || 0;
        const price = parseFloat(trade.price) || 0;
        const cost = quantity * price;
        
        position.trades.push(trade);
        
        if (trade.side === 'BUY') {
          position.buyQuantity += quantity;
          position.totalQuantity += quantity;
          position.totalCost += cost;
        } else if (trade.side === 'SELL') {
          position.sellQuantity += quantity;
          position.totalQuantity -= quantity;
          position.totalCost -= cost;
        }
        
        // Recalculate average price
        if (position.totalQuantity > 0) {
          position.averagePrice = position.totalCost / position.totalQuantity;
        } else {
          position.averagePrice = 0;
        }
      });
      
      return Object.values(portfolio);
    } catch (error) {
      console.error('Failed to get portfolio data:', error);
      throw error;
    }
  }

  async exportTrades(filePath) {
    try {
      const trades = await this.getTrades();
      const exportData = {
        trades,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      
      console.log('Trades exported to:', filePath);
      return true;
    } catch (error) {
      console.error('Failed to export trades:', error);
      throw error;
    }
  }

  async importTrades(filePath) {
    try {
      const importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!importData.trades || !Array.isArray(importData.trades)) {
        throw new Error('Invalid import file format');
      }
      
      // Add imported trades with new IDs
      const importedTrades = importData.trades.map(trade => ({
        ...trade,
        id: this.generateTradeId(),
        importedAt: new Date().toISOString()
      }));
      
      // Add to existing trades
      importedTrades.forEach(trade => {
        this.db.get('trades').push(trade).write();
      });
      
      this.db.set('settings.lastUpdated', new Date().toISOString()).write();
      
      console.log(`${importedTrades.length} trades imported from:`, filePath);
      return importedTrades.length;
    } catch (error) {
      console.error('Failed to import trades:', error);
      throw error;
    }
  }

  generateTradeId() {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getDbInfo() {
    return {
      path: this.dbPath,
      exists: fs.existsSync(this.dbPath),
      size: fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0,
      lastModified: fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).mtime : null
    };
  }
}

module.exports = DatabaseManager; 