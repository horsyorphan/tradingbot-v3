## 📄 Product Requirements Document (PRD)

**Project Name:** SimpleCryptoDesk
**Platform:** Electron (Desktop App)
**Target Users:** Individual crypto traders who want a lightweight local app to trade via Binance and track profit/loss.

---

### 🎯 Goal

Build a desktop crypto trading app with basic buy/sell functions via Binance API, using a local JSON database (Lowdb) to log trades and calculate real-time gain/loss based on current market prices.

---

### 🔑 Key Features

#### 1. **Binance API Integration**

* Allow users to input their API key/secret
* Use REST API to:

  * Fetch account balances
  * Execute market buy/sell orders
  * Fetch order history
* Use WebSocket (optional) for real-time prices

#### 2. **Trading Interface**

* Symbol selection dropdown (e.g., BTC/USDT)
* Input fields for amount/quantity
* Buy/Sell buttons
* Show execution response (success/failure)

#### 3. **Trade Recording (Lowdb)**

* Log each buy/sell to `trades.json`:

  * timestamp
  * symbol
  * action (buy/sell)
  * quantity
  * price
* Stored locally, fully offline-accessible

#### 4. **Profit & Loss Calculation**

* Load current market prices via Binance API
* Compare current prices with buy prices
* Calculate:

  * PnL % and \$
  * Total current value
  * Individual trade result

#### 5. **UI with DaisyUI**

* Use clean components:

  * Tabs (Trade / PnL / History)
  * Table view for trade history
  * Cards for summaries
* Responsive layout
* Light/Dark mode toggle

#### 6. **Settings**

* Save Binance API key locally (optional encryption)
* Clear trade history button

---

### 🖼️ UI Mock Suggestions (Rough)

* **Tab 1:** Trade

  * Pair dropdown
  * Buy/Sell inputs
  * Buttons
  * Status message

* **Tab 2:** PnL

  * Table: symbol / quantity / avg buy / current price / gain/loss

* **Tab 3:** History

  * Table of past trades

---

### ⚙️ Technical Stack

| Layer     | Technology               |
| --------- | ------------------------ |
| App Shell | Electron                 |
| Frontend  | HTML, Alpine.js, DaisyUI |
| Styling   | TailwindCSS              |
| DB        | Lowdb (JSON file)        |
| API       | Binance REST API         |

---

### 📌 Constraints

* Local-only, no cloud sync
* Single-user only
* Only supports Binance spot trading (no futures/margin)
* No edit/delete of past trades

---

### ✅ MVP Checklist

* [ ] Binance key entry & connection
* [ ] Market price viewer
* [ ] Buy/Sell with confirmation
* [ ] Trade logging via Lowdb
* [ ] PnL calculation logic
* [ ] Basic UI using DaisyUI

