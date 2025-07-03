const crypto = require('crypto');
const fetch = require('node-fetch');
const WebSocket = require('ws');

class BinanceAPI {
  constructor(apiKey, apiSecret, isTestnet = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.isTestnet = isTestnet;
    
    // API endpoints
    this.baseURL = isTestnet 
      ? 'https://testnet.binance.vision'
      : 'https://api.binance.com';
    
    this.wsURL = isTestnet
      ? 'wss://stream.testnet.binance.vision/ws'
      : 'wss://stream.binance.com:9443/ws';
    
    this.ws = null;
    this.subscribers = new Map();
    this.pendingSubscriptions = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Generate signature for authenticated requests
  generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // Make authenticated API request
  async makeRequest(endpoint, method = 'GET', params = {}) {
    const timestamp = Date.now();
    const queryString = new URLSearchParams({ ...params, timestamp }).toString();
    const signature = this.generateSignature(queryString);
    
    const url = `${this.baseURL}${endpoint}?${queryString}&signature=${signature}`;
    
    const options = {
      method,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.msg || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Make public API request (no authentication needed)
  async makePublicRequest(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseURL}${endpoint}${queryString ? '?' + queryString : ''}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.msg || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return data;
    } catch (error) {
      console.error('Public API Request Error:', error);
      throw error;
    }
  }

  // Get account information
  async getAccountInfo() {
    return await this.makeRequest('/api/v3/account');
  }

  // Get exchange information
  async getExchangeInfo() {
    return await this.makePublicRequest('/api/v3/exchangeInfo');
  }

  // Get ticker price
  async getTickerPrice(symbol) {
    const params = symbol ? { symbol } : {};
    return await this.makePublicRequest('/api/v3/ticker/price', params);
  }

  // Get 24hr ticker statistics
  async getTicker24hr(symbol) {
    const params = symbol ? { symbol } : {};
    return await this.makePublicRequest('/api/v3/ticker/24hr', params);
  }



  // Validate order parameters
  validateOrder(orderData) {
    const { symbol, side, quantity, type = 'MARKET' } = orderData;
    
    if (!symbol || !side || !quantity) {
      throw new Error('Missing required order parameters: symbol, side, quantity');
    }
    
    if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
      throw new Error('Invalid order side. Must be BUY or SELL');
    }
    
    if (parseFloat(quantity) <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    return true;
  }

  // Place order
  async placeOrder(orderData) {
    this.validateOrder(orderData);
    
    const params = {
      symbol: orderData.symbol.toUpperCase(),
      side: orderData.side.toUpperCase(),
      type: orderData.type || 'MARKET',
      quantity: parseFloat(orderData.quantity).toString(),
    };
    
    // Add additional parameters for limit orders
    if (params.type === 'LIMIT') {
      if (!orderData.price) {
        throw new Error('Price is required for limit orders');
      }
      params.price = parseFloat(orderData.price).toString();
      params.timeInForce = orderData.timeInForce || 'GTC';
    }
    
    return await this.makeRequest('/api/v3/order', 'POST', params);
  }

  // Get order history
  async getOrderHistory(symbol, limit = 500) {
    const params = { symbol: symbol.toUpperCase(), limit };
    return await this.makeRequest('/api/v3/allOrders', 'GET', params);
  }

  // WebSocket Methods
  initWebSocket() {
    // Prevent multiple connection attempts
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('⚠️ WebSocket already connecting/connected, skipping...');
      return;
    }

    console.log('Connecting to WebSocket:', this.wsURL);
    this.ws = new WebSocket(this.wsURL);
    
    this.ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      this.reconnectAttempts = 0;
      
      // Process pending subscriptions first
      if (this.pendingSubscriptions && this.pendingSubscriptions.size > 0) {
        console.log('📋 Processing', this.pendingSubscriptions.size, 'pending subscriptions');
        this.pendingSubscriptions.forEach(stream => {
          console.log('📡 Sending pending subscription for:', stream);
          const subscribeMessage = {
            method: 'SUBSCRIBE',
            params: [stream],
            id: Date.now()
          };
          this.ws.send(JSON.stringify(subscribeMessage));
        });
        this.pendingSubscriptions.clear();
      }
      
      // Resubscribe to all existing subscriptions (for reconnection scenarios)
      if (this.subscribers.size > 0) {
        console.log('🔄 Resubscribing to', this.subscribers.size, 'existing streams');
        this.subscribers.forEach((callback, stream) => {
          console.log('🔄 Resubscribing to stream:', stream);
          const subscribeMessage = {
            method: 'SUBSCRIBE',
            params: [stream],
            id: Date.now()
          };
          this.ws.send(JSON.stringify(subscribeMessage));
        });
      }
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('🌐 WebSocket message received:', JSON.stringify(message, null, 2));
        
        // Handle stream-wrapped messages (combined streams)
        if (message.stream && this.subscribers.has(message.stream)) {
          const callback = this.subscribers.get(message.stream);
          console.log('📞 Calling callback for stream:', message.stream);
          callback(message.data);
        }
        // Handle direct stream messages (individual streams like bookTicker)
        else if (message.s && message.b && message.a) {
          // This is a bookTicker message with symbol 's', bid 'b', ask 'a'
          const symbol = message.s.toLowerCase();
          const streamName = `${symbol}@bookTicker`;
          
          if (this.subscribers.has(streamName)) {
            const callback = this.subscribers.get(streamName);
            console.log('📞 Calling callback for bookTicker stream:', streamName);
            callback(message);
          } else {
            console.log('⚠️ No subscriber for bookTicker stream:', streamName);
          }
        }
        // Handle subscription confirmation messages
        else if (message.result !== undefined && message.id) {
          console.log('✅ WebSocket subscription confirmation:', message);
        }
        else {
          console.log('⚠️ Unhandled message format:', message);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    });
    
    this.ws.on('close', () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.attemptReconnect();
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.initWebSocket();
      }, 5000 * this.reconnectAttempts); // Exponential backoff
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  subscribeToStream(stream, callback, addToSubscribers = true) {
    if (addToSubscribers) {
      this.subscribers.set(stream, callback);
    }
    
    // If WebSocket is not open, initialize it and wait for connection
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('📡 WebSocket not ready, initializing for stream:', stream);
      
      // Only initialize if not already connecting
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.initWebSocket();
      }
      
      // Wait for connection and then subscribe (only if not already waiting)
      if (!this.pendingSubscriptions) {
        this.pendingSubscriptions = new Set();
      }
      
      if (!this.pendingSubscriptions.has(stream)) {
        this.pendingSubscriptions.add(stream);
        console.log('📋 Queuing subscription for:', stream);
      }
      
      return;
    }
    
    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: [stream],
      id: Date.now()
    };
    
    console.log('📡 Sending subscription for stream:', stream);
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  // Subscribe to ticker updates
  subscribeToTicker(symbol, callback) {
    const stream = `${symbol.toLowerCase()}@ticker`;
    this.subscribeToStream(stream, callback);
  }

  // Subscribe to price updates
  subscribeToPrice(symbol, callback) {
    const stream = `${symbol.toLowerCase()}@bookTicker`;
    this.subscribeToStream(stream, callback);
  }



  // Unsubscribe from stream
  unsubscribeFromStream(stream) {
    if (this.subscribers.has(stream)) {
      this.subscribers.delete(stream);
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = {
        method: 'UNSUBSCRIBE',
        params: [stream],
        id: Date.now()
      };
      
      this.ws.send(JSON.stringify(unsubscribeMessage));
    }
  }

  // Cleanup WebSocket connections
  cleanup() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribers.clear();
    this.pendingSubscriptions.clear();
  }

  // Test API connection
  async testConnection() {
    try {
      await this.makeRequest('/api/v3/account');
      return { success: true, message: 'API connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get symbol filters (for minimum order validation)
  async getSymbolFilters(symbol) {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol.toUpperCase());
      
      if (!symbolInfo) {
        throw new Error(`Symbol ${symbol} not found`);
      }
      
      return symbolInfo.filters;
    } catch (error) {
      throw new Error(`Failed to get symbol filters: ${error.message}`);
    }
  }

  // Validate order against symbol filters
  async validateOrderAgainstFilters(orderData) {
    const filters = await this.getSymbolFilters(orderData.symbol);
    const { quantity, price } = orderData;
    
    for (const filter of filters) {
      switch (filter.filterType) {
        case 'LOT_SIZE':
          const qty = parseFloat(quantity);
          const minQty = parseFloat(filter.minQty);
          const maxQty = parseFloat(filter.maxQty);
          const stepSize = parseFloat(filter.stepSize);
          
          if (qty < minQty) {
            throw new Error(`Quantity ${qty} is below minimum ${minQty}`);
          }
          
          if (qty > maxQty) {
            throw new Error(`Quantity ${qty} exceeds maximum ${maxQty}`);
          }
          
          if ((qty - minQty) % stepSize !== 0) {
            throw new Error(`Quantity ${qty} does not match step size ${stepSize}`);
          }
          break;
          
        case 'PRICE_FILTER':
          if (price) {
            const priceFloat = parseFloat(price);
            const minPrice = parseFloat(filter.minPrice);
            const maxPrice = parseFloat(filter.maxPrice);
            const tickSize = parseFloat(filter.tickSize);
            
            if (priceFloat < minPrice) {
              throw new Error(`Price ${priceFloat} is below minimum ${minPrice}`);
            }
            
            if (priceFloat > maxPrice) {
              throw new Error(`Price ${priceFloat} exceeds maximum ${maxPrice}`);
            }
            
            if ((priceFloat - minPrice) % tickSize !== 0) {
              throw new Error(`Price ${priceFloat} does not match tick size ${tickSize}`);
            }
          }
          break;
          
        case 'MIN_NOTIONAL':
          const notional = parseFloat(quantity) * (price ? parseFloat(price) : 1);
          const minNotional = parseFloat(filter.minNotional);
          
          if (notional < minNotional) {
            throw new Error(`Order notional ${notional} is below minimum ${minNotional}`);
          }
          break;
      }
    }
    
    return true;
  }
}

module.exports = BinanceAPI; 