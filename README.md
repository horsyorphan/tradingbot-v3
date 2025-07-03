# SimpleCryptoDesk

A lightweight desktop crypto trading application for Binance with local trade logging and P&L tracking.

![SimpleCryptoDesk](https://img.shields.io/badge/Platform-Electron-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Node](https://img.shields.io/badge/Node-16%2B-brightgreen)

## 🎯 Features

### 🔑 Core Features

- **Binance API Integration** - Secure connection to Binance spot trading
- **Real-time Price Updates** - WebSocket-powered live price feeds (10-second intervals + on-demand)
- **Market Orders** - Quick buy/sell execution with confirmation dialogs
- **Local Trade Database** - SQLite-like JSON storage via Lowdb
- **Portfolio P&L Tracking** - Real-time profit/loss calculation
- **Trade History** - Complete log of successful and failed trades
- **Testnet Support** - Safe testing environment with Binance testnet

### 🛡️ Security & Validation

- **Encrypted API Key Storage** - OS-level credential management via keytar
- **Order Validation** - Minimum order size and filter validation
- **Trade Confirmation** - Prevents accidental orders
- **Failed Trade Logging** - Complete audit trail

### 🎨 User Interface

- **Modern UI** - Built with DaisyUI and TailwindCSS
- **Multiple Themes** - Dark, Light, Cupcake, Cyberpunk themes
- **Responsive Design** - Works on different screen sizes
- **Real-time Updates** - Live price feeds and portfolio updates
- **Toast Notifications** - User-friendly status messages

### 📊 Data Management

- **Local Storage** - All data stored locally, no cloud dependency
- **Trade Statistics** - Success rate, volume, and performance metrics
- **Portfolio Overview** - Current positions and unrealized P&L
- **Symbol Search** - Dynamic loading of all USDT trading pairs

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn package manager
- Binance account with API keys

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd simplecryptodesk
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

### Development Mode

```bash
npm run dev
```

### Building for Distribution

```bash
# For macOS
npm run build:mac

# For Windows
npm run build:win

# For both platforms
npm run build
```

## ⚙️ Configuration

### Binance API Setup

1. **Create API Keys**

   - Log into your Binance account
   - Go to Account > API Management
   - Create a new API key
   - Enable "Enable Spot & Margin Trading"
   - **Important**: Restrict IP access for security

2. **Configure in App**

   - Open SimpleCryptoDesk
   - Click the Settings button (gear icon)
   - Enter your API Key and Secret
   - Choose Testnet for safe testing
   - Click Save

3. **API Permissions Required**
   - Read account information
   - Place and cancel orders
   - Access trading history

### Testnet Usage

- Enable testnet in settings for paper trading
- Get testnet API keys from [testnet.binance.vision](https://testnet.binance.vision)
- No real money involved - perfect for testing

## 📱 User Guide

### Trading Interface

1. **Select Trading Pair**

   - Choose from dropdown of USDT pairs
   - Prices update automatically every 10 seconds
   - Click refresh for immediate price update

2. **Place Orders**

   - Enter quantity amount
   - Review estimated value
   - Click Buy/Sell button
   - Confirm in dialog box
   - Monitor execution status

3. **View Account Balances**
   - Real-time balance updates
   - Shows free and locked amounts
   - Automatically refreshes after trades

### Portfolio & P&L

1. **Portfolio Overview**

   - Current positions and quantities
   - Average buy prices vs current prices
   - Real-time P&L calculations
   - Total portfolio value

2. **P&L Calculation**
   - Based on successful trades only
   - Considers buy/sell position changes
   - Updates with current market prices
   - Shows both dollar amount and percentage

### Trade History

1. **Complete Trade Log**

   - All successful and failed trades
   - Timestamps and execution details
   - Filterable and sortable data
   - Trade statistics and metrics

2. **Data Management**
   - Clear all trades option
   - Local JSON file storage
   - No data sent to external servers

## 🏗️ Architecture

### Technology Stack

- **Frontend**: HTML5, Alpine.js, TailwindCSS, DaisyUI
- **Backend**: Electron, Node.js
- **Database**: Lowdb (JSON file)
- **API**: Binance REST API + WebSocket
- **Security**: Keytar for credential storage

### Project Structure

```
simplecryptodesk/
├── src/
│   ├── main.js                 # Electron main process
│   ├── utils/
│   │   ├── binance-api.js      # Binance API wrapper
│   │   └── database.js         # Database management
│   └── renderer/
│       ├── index.html          # Main UI
│       ├── app.js              # Frontend logic
│       └── styles.css          # Additional styles
├── package.json
└── README.md
```

### Data Flow

1. User interactions trigger Alpine.js methods
2. Frontend communicates with main process via IPC
3. Main process handles Binance API calls
4. Database operations for trade logging
5. WebSocket for real-time price updates
6. UI updates reflect current state

## 🔒 Security Considerations

### API Key Security

- **Never share your API keys**
- Use IP restrictions on Binance
- Store keys locally only (encrypted via OS keychain)
- Test with testnet first

### Best Practices

- Start with small amounts
- Use testnet for learning
- Monitor trades closely
- Keep software updated
- Backup trade data regularly

### Risk Management

- This is a trading tool, not financial advice
- Cryptocurrency trading involves significant risk
- Only trade with money you can afford to lose
- Understand market volatility

## 🛠️ Development

### Adding New Features

1. **Frontend Changes**

   - Edit `src/renderer/index.html` for UI
   - Modify `src/renderer/app.js` for logic
   - Update `src/renderer/styles.css` for styling

2. **Backend Changes**

   - Add IPC handlers in `src/main.js`
   - Extend `src/utils/binance-api.js` for API features
   - Modify `src/utils/database.js` for data operations

3. **Testing**
   - Use testnet for API testing
   - Test with small amounts on mainnet
   - Verify trade logging accuracy

### Code Style

- Use modern JavaScript (ES6+)
- Follow Alpine.js conventions
- Maintain consistent naming
- Comment complex logic
- Handle errors gracefully

## 📋 Roadmap

### Planned Features

- [ ] Limit orders support
- [ ] Price alerts and notifications
- [ ] Advanced charting integration
- [ ] Order book display
- [ ] Trade export/import
- [ ] Multiple exchange support
- [ ] Advanced portfolio analytics

### Known Limitations

- Spot trading only (no futures/margin)
- Market orders only (no limit orders yet)
- Single user only
- No cloud synchronization
- Basic charting only

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is for educational and personal use only. Cryptocurrency trading involves substantial risk of loss. The developers are not responsible for any financial losses incurred while using this software. Always do your own research and never invest more than you can afford to lose.

## 🆘 Support

### Common Issues

1. **API Connection Failed**

   - Verify API keys are correct
   - Check IP restrictions on Binance
   - Ensure network connectivity

2. **Orders Not Executing**

   - Check minimum order requirements
   - Verify sufficient balance
   - Review symbol availability

3. **Price Updates Not Working**
   - Check WebSocket connection
   - Verify symbol selection
   - Restart application if needed

### Getting Help

- Check existing GitHub issues
- Create a new issue with details
- Include error messages and logs
- Specify operating system and version

## 🔗 Links

- [Binance API Documentation](https://binance-docs.github.io/apidocs/)
- [Binance Testnet](https://testnet.binance.vision/)
- [Electron Documentation](https://electronjs.org/docs)
- [Alpine.js Documentation](https://alpinejs.dev/)
- [DaisyUI Components](https://daisyui.com/)
