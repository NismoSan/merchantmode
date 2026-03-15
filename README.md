# Merchant Mode

AFK merchant automation for [Dark Ages](https://www.darkages.com) by [AislingExchange.com](https://aislingexchange.com).

Merchant Mode runs as a local proxy between your Dark Ages client and the game server. It intercepts network traffic to automate whisper-based trading — listing items for sale, responding to buyer whispers, filling exchange windows, and completing transactions without manual input.

---

## Features

### Automated Trading
- **Sell, Buy, and Trade listings** — define what you're selling, buying, or trading with price and quantity.
- **Whisper detection** — incoming whispers are matched against your active listings automatically.
- **Auto-reply** — sends customizable responses when a buyer whispers about an item you have listed (or a "not found" reply if you don't).
- **Exchange automation** — when a matched buyer opens an exchange, the engine fills the window with the correct items/gold and accepts the trade.
- **Stackable item support** — handles the two-step quantity prompt for stackable items like consumables.

### Multi-Character Support
- Connect multiple characters simultaneously through the proxy.
- Each character gets its own engine, inventory tracker, and listing set.
- Switch between characters with tabbed navigation.

### Real-Time Dashboard
- Live 60-slot inventory grid with item sprites.
- Gold balance display.
- Whisper queue showing matched vs. unmatched messages.
- Active listing count and trades-today counter.
- Connection and engine state indicators.

### Listing Management
- Create listings from the Listings page or by clicking items in your inventory.
- Set type (Buy / Sell / Trade), price, quantity, and stack size.
- Listings track remaining quantity and update automatically after each trade.
- Filter and sort by status: Active, Sold Out, Paused.

### Transaction Log
- Full history of completed trades.
- Shows counterparty, items given/received, and gold exchanged.
- Export to CSV.

### Whisper History
- Per-character whisper tabs.
- Shows whether each whisper matched a listing or not.
- Timestamps and player names.

### Packet Sniffer
- Debug view of all intercepted packets.
- Filter by opcode name or hex value.
- Direction indicators (Server -> Client, Client -> Server).

### Game Client Launcher
- Launch Dark Ages directly from the app.
- Patches the client in memory to:
  - Allow multiple instances.
  - Skip the intro cinematic.
  - Redirect to the local proxy.
- Configurable client path via Settings.

### Auto-Updates
- Checks for updates on launch and every 30 minutes.
- Downloads in the background.
- Shows a banner when an update is ready to install.
- One-click restart to apply.

---

## Installation

### Download

Grab the latest **Merchant Mode Setup x.x.x.exe** from the [Releases](https://github.com/NismoSan/merchantmode/releases) page and run the installer.

Updates are delivered automatically after that.

### Build From Source

Requirements: [Node.js](https://nodejs.org/) 18+ and npm.

```bash
git clone https://github.com/NismoSan/merchantmode.git
cd merchantmode
npm install
```

**Development mode:**

```bash
npm run electron:dev
```

**Build an installer locally:**

```bash
npm run dist:local
```

Output: `release/Merchant Mode Setup x.x.x.exe`

**Build and publish to GitHub Releases (enables auto-updates):**

```bash
set GH_TOKEN=your_github_token
npm run dist
```

See [HOW-TO-UPDATE.md](HOW-TO-UPDATE.md) for full publishing instructions.

---

## Usage

1. **Open the app.** The proxy server starts automatically on `localhost:2610`.
2. **Click "Launch Client"** in the sidebar to open Dark Ages through the proxy (or set a custom client path in Settings first).
3. **Log in** to your character. The app detects the connection and creates a character tab.
4. **Create listings** on the Listings page — set the type (Sell/Buy/Trade), item name, price, and quantity.
5. **Monitor the Dashboard** to see incoming whispers, your inventory, and live trade activity.
6. When someone whispers about a listed item and opens an exchange, the trade completes automatically.

### Settings

| Setting | Description |
|---|---|
| Client Path | Path to `Darkages.exe` on your system |
| Auto-Reply | Toggle automatic whisper responses on/off |
| Reply (Available) | Message template when item is in stock. Variables: `{item}`, `{price}` |
| Reply (Not Found) | Message template when item is not listed |
| Exchange Timeout | How long to wait before cancelling a stalled exchange |

---

## How It Works

1. **Proxy Interception** — A TCP proxy listens on `127.0.0.1:2610`. The client launcher patches the game executable in memory to connect through the proxy instead of directly to the live server.

2. **Packet Parsing** — All traffic flows through the proxy, which decrypts and parses packets using the Dark Ages network protocol. Server packets drive the engine (whispers, exchange events, inventory changes). Client packets are injected to automate actions.

3. **Trade State Machine** — The MerchantEngine follows this flow:
   - **IDLE** — waiting for a whisper
   - **WHISPER_QUEUED** — whisper matched a listing, waiting for exchange
   - **EXCHANGE_OPEN** — counterparty opened exchange, validating
   - **FILLING** — placing items/gold into the exchange window
   - **AWAITING_CONFIRM** — waiting for counterparty to accept
   - **COMPLETE** — trade finished, listing quantity updated

4. **Multi-Character** — Each connected character gets an isolated context with its own engine, inventory tracker, and connection. Packets are routed by character name.

---

## Project Structure

```
merchantmode/
  core/
    db/            SQLite database (listings, transactions, settings)
    engine/        MerchantEngine state machine, InventoryTracker, EntityTracker
    launcher/      Win32 FFI client launcher with memory patching
    network/       Binary packet serialization, opcodes, crypto
    proxy/         TCP proxy server and per-connection handler
  electron/
    main.ts        Electron main process, IPC handlers, auto-updater
    preload.ts     Context bridge API exposed to renderer
  src/
    components/    React UI components
    pages/         Dashboard, Listings, Whispers, Settings, About
    index.css      Dark theme with gold accent styling
  public/
    items/         Item sprite PNGs indexed by sprite ID
```

---

## Tech Stack

- **Electron** — Desktop shell
- **React** — UI
- **Vite** — Build tooling
- **Tailwind CSS** — Styling
- **TypeScript** — Full-stack type safety
- **better-sqlite3** — Local database
- **koffi** — Win32 FFI for client memory patching
- **electron-updater** — Auto-update via GitHub Releases
- **electron-builder** — Packaging and installer creation

---

## License

ISC
