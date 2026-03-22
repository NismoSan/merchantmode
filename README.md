# Merchant Mode

<p align="center">
  <strong>AFK merchant automation for <a href="https://www.darkages.com">Dark Ages</a> by <a href="https://aislingexchange.com">AislingExchange.com</a></strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.6-c9a84c" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-41-47848f" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/typescript-5.9-3178c6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-ISC-green" alt="License" />
</p>

---

Merchant Mode runs as a local TCP proxy between your Dark Ages client and the game server. It intercepts and parses all network traffic to automate whisper-based trading — listing items for sale, responding to buyer whispers, filling exchange windows, and completing transactions without manual input. It connects to the AislingExchange global merchant hub so other players can see your listings in real time.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Architecture Deep Dive](#architecture-deep-dive)
- [IPC API Reference](#ipc-api-reference)
- [Database Schema](#database-schema)
- [Network Protocol](#network-protocol)
- [Configuration & Settings](#configuration--settings)
- [Build & Release](#build--release)
- [Tech Stack](#tech-stack)
- [Changelog](#changelog)
- [License](#license)

---

## Features

### Automated Trading Engine
- **Sell, Buy, and Trade listings** — define what you're selling, buying, or trading with price, quantity, stack size, and notes.
- **Whisper detection** — incoming whispers are regex-matched against your active listings by item name. Trade listings match by the wanted item name (what the whisperer has).
- **Quantity extraction** — the engine parses numbers before/after item names in whispers to determine requested quantity, rounding to the nearest stack size multiple when applicable.
- **Auto-reply** — sends customizable template responses when a buyer whispers about a listed item (or a "not found" reply). Rate-limited to one reply per player per 10 seconds to prevent reply loops.
- **Exchange automation** — when a matched buyer opens an exchange, the engine fills the window with the correct items/gold and accepts the trade. Supports sell, buy, and trade listing types, including stackable items with the two-step quantity prompt.
- **Accept state tracking** — adding items or gold on your side resets the counterparty's accept state, preventing premature confirmation.
- **Inventory-aware auto-pause/resume** — SELL/TRADE listings auto-pause when the item leaves your inventory and auto-resume when it returns. BUY listings auto-pause when gold drops below the listing price and auto-resume when funds are sufficient. Displays "WAITING FOR INVENTORY" status.

### Global Merchant Network
- **Live merchant hub** — persistent WebSocket connection to `wss://api.aislingexchange.com/ws/merchants`. Your active listings, character name, map location, and full listing metadata (quantity, quantityRemaining, stackSize, wantedItems, notes) are broadcast in real time.
- **All Merchants dashboard** — card grid of every online MerchantMode user showing character sprite, avatar circle (with custom crop offsets from AE profiles), listings summary, and current map location.
- **All Merchants listings** — unified, type-grouped list of every listing from every online merchant with avatar, player name, location, stack sizes, per-stack prices, quantity remaining, trade arrows with wanted items, and notes.

### AislingExchange Integration
- **Account authentication** — log in to your AE account from Settings. Auth tokens persist across sessions in SQLite and auto-validate on startup. AE connection status shown in the top bar with a globe icon.
- **Bidirectional listing sync** — listings created, updated, or deleted in MerchantMode automatically sync to the AE marketplace. Per-listing "Sync to AislingExchange" toggle controls which listings get pushed. Sync status indicators (synced/pending/failed) on each listing with manual retry on failure.
- **Listing import** — on character connect, active AE listings not already present locally are auto-imported in PAUSED status and auto-activate when inventory/gold allows. Manual "Sync AE" button for on-demand import. Auto-sync runs every 10 minutes and on AE login.
- **Item autocomplete** — autocomplete dropdown when typing item names, powered by the AE item database with category color-coding (Weapon, Armor, Consumable, etc.) and keyboard navigation. Item cache fetches from AE API on startup with local SQLite fallback.
- **Character sprites & avatars** — merchant cards and listing rows display each character's AE avatar circle and full sprite image, fetched via the AE API and proxied through Electron's main process.
- **Completed trade price reporting** — transaction data (item, type, price, quantity) auto-posted to AE as a price entry on trade completion.
- **Player profiles** — click any player name (All Merchants, Whispers, Transaction Log) to view their in-app profile: character sprite, class, title, master status, online/offline indicator, Discord username, verification badge, live bot listings with map location, and AE marketplace listings.

### Multi-Character Support
- Connect multiple characters simultaneously through the proxy.
- Each character gets an isolated context with its own engine, inventory tracker, location tracker, entity tracker, and listing set.
- Switch between characters with tabbed navigation — each tab shows a cropped face sprite for quick visual identification.
- **Bot client compatibility** — proxy runs on port 2615 to avoid conflicts with bot proxies on 2610–2612. Characters are auto-tagged as "launched" or "bot" based on origin, with a "BOT" badge in the character tabs.
- **Multiple launched clients** — click "Launch Client" multiple times to run several DA clients simultaneously, each tracked independently.

### Auto-Reconnect
- Automatic reconnection when a character disconnects from the server (e.g., server restarts).
- Sequential reconnection queue — characters reconnect one at a time with exponential backoff (5s → 15s → 30s → 30s).
- Login packet injection — rebuilds and injects a full Login (0x03) packet with stored credentials, CRC16 checksums, and proper encryption.
- Status tracking per character: waiting, launching, connected, cancelled, failed.
- **Reconnect Banner** in the UI shows countdown timers and reconnection progress for each queued character.

### Merchant Display Modifier
- In-game display name patching — merchants with active listings show a `[M]` prefix on their character name visible to other players.
- Modifies DisplayAisling (0x33) packets in real time as they pass through the proxy.
- Best-effort: if the name can't be extracted from the packet, the original is forwarded unmodified.

### Real-Time Dashboard
- Live 60-slot inventory grid with item sprites and quantities.
- Gold balance display.
- Whisper queue showing matched vs. unmatched messages with timestamps and player names.
- Active listing count and trades-today counter.
- Connection and engine state indicators with a pulsing dot in the top bar.
- Stat cards with colored icons and hover lift effects.

### Listing Management
- Create listings from the Listings page or by clicking items in your inventory (pre-fills name and quantity).
- **Trade mode** — proper TRADE listing creation with "You give" / "You receive" sections, wanted item autocomplete, quantity fields, and configurable repeat count.
- Set type (Buy / Sell / Trade), price, quantity, stack size, notes, and wanted items.
- Listings track remaining quantity and update automatically after each trade.
- Filter and sort by status: Active, Sold Out, Paused, Waiting for Inventory.
- Real-time refresh — listings page listens for `listings:changed` events and updates automatically.

### Transaction Log
- Full history of completed trades with per-character tabs for filtering.
- Two-sided trade flow layout with character avatars, "Gave"/"Got" breakdowns, and type badges (SELL/BUY/TRADE).
- Counterparty names are clickable (opens player profile).
- Export to CSV.

### Whisper History
- Per-character whisper tabs.
- Shows whether each whisper matched a listing or not, with the matched listing details.
- Timestamps, player names (clickable), and requested quantities.

### Packet Sniffer
- Debug view of all intercepted packets.
- Filter by opcode name or hex value.
- Direction indicators (Server -> Client, Client -> Server).
- Timestamps and raw hex data.

### Game Client Launcher
- Launch Dark Ages directly from the app with a single click.
- Patches the client in memory via Win32 FFI (koffi) to:
  - Allow multiple simultaneous instances.
  - Skip the intro cinematic.
  - Redirect the server hostname to the local proxy.
  - Rewrite the server IP as a fallback.
  - Redirect the server port to 2615.
- **Version validation** — verifies expected original bytes at each patch address before writing. Throws a clear "game version mismatch" error if the client binary doesn't match the expected DA v7.41 offsets, preventing silent memory corruption on game updates.
- Extracts the character name from client memory after login.
- Tracks launched processes and cleans up on disconnect.
- Configurable client path via Settings with a file browser.

### Auto-Update
- Checks for updates on launch and every 30 minutes.
- Downloads in the background with progress tracking.
- Shows a banner with download progress bar when an update is available.
- One-click "Restart & Update" to apply, or auto-installs on next app close.
- Powered by `electron-updater` and GitHub Releases.

---

## Installation

### Download

Grab the latest **Merchant Mode Setup x.x.x.exe** from the [Releases](https://github.com/NismoSan/merchantmode/releases) page and run the installer. The NSIS installer lets you choose your installation directory.

Updates are delivered automatically after installation.

### Build From Source

**Requirements:** [Node.js](https://nodejs.org/) 18+ and npm.

```bash
git clone https://github.com/NismoSan/merchantmode.git
cd merchantmode
npm install
```

**Development mode** (builds and launches Electron with hot reload):

```bash
npm run electron:dev
```

**Vite dev server only** (no Electron, renderer only):

```bash
npm run dev
```

**Build an installer locally:**

```bash
npm run dist:local
```

Output: `release/Merchant Mode Setup x.x.x.exe`

**Build and publish to GitHub Releases** (enables auto-updates for all users):

```bash
set GH_TOKEN=your_github_token
npm run dist
```

See [HOW-TO-UPDATE.md](HOW-TO-UPDATE.md) for full publishing instructions.

---

## Usage

1. **Open the app.** The proxy server starts automatically on `localhost:2615`.
2. **Click "Launch Client"** in the sidebar to open Dark Ages through the proxy (or set a custom client path in Settings first).
3. **Log in** to your character. The app detects the connection and creates a character tab.
4. **Create listings** on the Listings page — set the type (Sell/Buy/Trade), item name, price, and quantity.
5. **Monitor the Dashboard** to see incoming whispers, your inventory, and live trade activity.
6. When someone whispers about a listed item and opens an exchange, the trade completes automatically.
7. **Browse All Merchants** — click the "All Merchants" tab to see other online MerchantMode users and their listings.
8. **Connect to AislingExchange** — log in from Settings to sync listings bidirectionally and see player profiles.

### Connecting Bot Clients

If you run a bot client (proxy on 2610–2612), point it at `localhost:2615` to route through MerchantMode. Bot characters are auto-detected and display a "BOT" badge. The proxy address is shown in Settings with a copy button.

---

## How It Works

### 1. Proxy Interception

A TCP proxy listens on `127.0.0.1:2615`. The client launcher patches the game executable in memory (via Win32 FFI using koffi) to connect through the proxy instead of directly to the live server. All traffic flows through the proxy bidirectionally.

### 2. Packet Parsing & Crypto

The proxy decrypts all packets using the Dark Ages symmetric encryption protocol (XOR-based cipher with a salt table). Each connection gets fresh cipher instances and sequence counters. Packets are parsed into structured objects, processed by the engine, and re-encrypted before forwarding. Server redirects (e.g., after character creation) are intercepted and queued so the next client connection automatically uses the correct endpoint.

### 3. Trade State Machine

The MerchantEngine follows this state flow for each character:

```
IDLE
  | [whisper matched a listing]
  v
WHISPER_QUEUED
  | [buyer entity ID resolved via EntityTracker]
  v
EXCHANGE_OPEN
  | [exchange event received from server]
  v
FILLING
  | [items/gold placed into exchange window]
  v
AWAITING_CONFIRM
  | [both parties accept]           | [cancel or timeout]
  v                                 v
COMPLETE                         CANCELLED → IDLE
  | [listing quantity updated,
  |  transaction recorded,
  |  price reported to AE]
  v
IDLE
```

**Key behaviors:**
- Whisper echo detection: the engine tracks recently sent whispers and ignores server echoes by comparing sender name + message content.
- Stack size logic: when stack size is set, requested quantities round to the nearest multiple and total price scales by number of stacks.
- Exchange timeout: configurable timer (default 60s) cancels stalled exchanges.

### 4. Multi-Character Architecture

Each connected character gets a fully isolated context:

| Component | Purpose |
|---|---|
| `MerchantEngine` | State machine driving the trade flow |
| `InventoryTracker` | Tracks 60 inventory slots + gold balance |
| `LocationTracker` | Tracks map name and x/y coordinates |
| `EntityTracker` | Resolves player names to entity IDs |
| `DisplayModifier` | Patches display packets with `[M]` merchant prefix |
| Connection reference | Routes packets to the correct context |
| Listing set | Per-character listings stored in SQLite |

Packets are routed by character name. On disconnect, all trackers and listeners are cleaned up, the character context is removed, and the `ReconnectManager` queues the character for automatic reconnection with exponential backoff.

### 5. Merchant Hub

A persistent WebSocket connection to `wss://api.aislingexchange.com/ws/merchants` broadcasts your characters' data:

**Client → Hub (update):**
```json
{
  "type": "update",
  "characters": [
    {
      "name": "CharacterName",
      "mapName": "East Woodlands",
      "x": 125, "y": 200,
      "listings": [
        {
          "type": "SELL",
          "itemName": "Goblin's Skull",
          "price": 1000,
          "status": "ACTIVE",
          "quantity": 50,
          "quantityRemaining": 45,
          "stackSize": 5,
          "notes": "Bulk discount available"
        }
      ]
    }
  ]
}
```

**Hub → Client (snapshot):**
```json
{
  "type": "snapshot",
  "merchants": [
    {
      "name": "OtherMerchant",
      "mapName": "West Woodlands",
      "x": 50, "y": 75,
      "listings": [...]
    }
  ]
}
```

Updates are pushed on listing changes, map changes, and periodic heartbeats. The hub supports auto-reconnect on disconnect.

### 6. AislingExchange Sync

The `ListingSync` module maintains a sync queue in SQLite. When a listing is created, updated, or deleted with the "Sync to AE" flag enabled, an operation is queued and processed asynchronously. Failed operations are retried with exponential backoff (1min → 4min → 16min based on attempt count, max 3 attempts). A circuit breaker pattern protects against cascading failures — after 3 consecutive API failures, the circuit opens and all sync operations queue directly without attempting the API for a 1-minute cooldown period, then allows a single probe request through (half-open state). The `AeApiClient` handles authentication, item search, listing CRUD, and price reporting with a rate limiter (20 requests/minute).

---

## Project Structure

```
merchantmode/
├── core/
│   ├── ae/                              # AislingExchange API integration
│   │   ├── ae-api-client.ts             #   REST client with auth, item search, listing sync, price reporting
│   │   ├── item-cache.ts                #   Local SQLite cache for the AE item database
│   │   └── listing-sync.ts             #   Bidirectional listing sync with circuit breaker and exponential backoff
│   ├── db/
│   │   └── database.ts                  #   SQLite database (WAL mode) with versioned migrations
│   ├── engine/
│   │   ├── merchant-engine.ts           #   Trade state machine (IDLE → COMPLETE)
│   │   ├── inventory-tracker.ts         #   60-slot inventory + gold tracking from packets
│   │   ├── location-tracker.ts          #   Map name + x/y from server packets, emits locationChanged
│   │   ├── entity-tracker.ts            #   Player name → entity ID resolution for exchange initiation
│   │   └── display-modifier.ts          #   Patches DisplayAisling packets with [M] merchant prefix
│   ├── launcher/
│   │   └── client-launcher.ts           #   Win32 FFI (koffi) client memory patching with version validation
│   ├── reconnect/
│   │   ├── reconnect-manager.ts         #   Auto-reconnect queue with exponential backoff
│   │   └── login-injector.ts            #   Builds and injects Login (0x03) packets for reconnection
│   ├── models/
│   │   ├── listing.ts                   #   Listing type/status/price/quantity interfaces
│   │   ├── transaction.ts               #   Trade transaction record interfaces
│   │   └── inventory.ts                 #   Item and inventory state interfaces
│   ├── network/
│   │   ├── encryption/                  #   Dark Ages symmetric crypto
│   │   │   ├── client-crypto.ts         #     Client-side cipher
│   │   │   ├── server-crypto.ts         #     Server-side cipher
│   │   │   ├── crypto.ts                #     Core XOR cipher implementation
│   │   │   ├── encryption-type.ts       #     Encryption type enum
│   │   │   ├── salt-table.ts            #     256-byte salt lookup table
│   │   │   ├── utils.ts                 #     Crypto utility functions
│   │   │   └── index.ts                 #     Barrel export
│   │   ├── packets/
│   │   │   ├── op-codes.ts              #     All client/server packet opcodes
│   │   │   ├── packet.ts                #     Base packet class
│   │   │   ├── packet-encoder.ts        #     Packet framing and encoding
│   │   │   ├── client/                  #     Client→Server packet parsers
│   │   │   │   ├── client-public-message.ts
│   │   │   │   └── client-whisper.ts
│   │   │   ├── server/                  #     Server→Client packet parsers
│   │   │   │   ├── server-chat-message.ts
│   │   │   │   ├── server-add-item.ts
│   │   │   │   └── server-remove-item.ts
│   │   │   └── exchange/                #     Exchange packet parsers
│   │   │       ├── exchange-types.ts    #       ExchangeClientAction / ExchangeServerEvent enums
│   │   │       ├── client-exchange.ts   #       Client→Server exchange commands
│   │   │       ├── server-exchange.ts   #       Server→Client exchange events
│   │   │       └── index.ts
│   │   ├── serialization/               #   Binary protocol serialization
│   │   │   ├── binary-reader.ts         #     Reading primitives from byte buffers with bounds checking
│   │   │   ├── binary-writer.ts         #     Writing primitives to byte buffers
│   │   │   ├── serializable.ts          #     Serializable interface
│   │   │   └── index.ts
│   │   └── merchant-hub-client.ts       #   WebSocket client for AE merchant hub
│   └── proxy/
│       ├── proxy-server.ts              #   TCP proxy server on localhost:2615
│       ├── proxy-connection.ts          #   Per-connection packet routing and handler
│       ├── packet-interceptor.ts        #   Decrypt → parse → process → re-encrypt pipeline
│       └── connection-state.ts          #   Connection phase tracking (login, in-game, etc.)
├── electron/
│   ├── main.ts                          #   Electron main process: IPC handlers, engine orchestration,
│   │                                    #     AE API proxy, auto-updater, character management
│   └── preload.ts                       #   Context bridge: MerchantModeAPI exposed to renderer
├── src/
│   ├── main.tsx                         #   React entry point
│   ├── App.tsx                          #   Main app shell: sidebar nav, page routing, state management
│   ├── vite-env.d.ts                    #   TypeScript declarations for MerchantModeAPI, IPC types
│   ├── index.css                        #   Tailwind 4 + custom dark theme (gold accent palette)
│   ├── components/
│   │   ├── AllMerchantsView.tsx         #   Global merchant card grid with sprites and avatars
│   │   ├── CharacterTabs.tsx            #   Tab switcher with cropped face sprites and BOT badges
│   │   ├── ConnectionStatus.tsx         #   Top-bar pulsing dot status indicator
│   │   ├── CreateListingModal.tsx       #   New listing form (Buy/Sell/Trade) with item autocomplete
│   │   ├── InventoryView.tsx            #   60-slot inventory grid with item sprites
│   │   ├── ItemAutocomplete.tsx         #   Dropdown with category color-coding and keyboard nav
│   │   ├── ListingManager.tsx           #   Listing table with edit/delete/pause/sync controls
│   │   ├── PacketSniffer.tsx            #   Network packet debug view with opcode filter
│   │   ├── PlayerProfileCard.tsx        #   Player profile modal (sprite, class, AE data, listings)
│   │   ├── TransactionLog.tsx           #   Two-sided trade flow with avatars and type badges
│   │   ├── ReconnectBanner.tsx           #   Auto-reconnect status with countdown timers
│   │   ├── UpdateBanner.tsx             #   Auto-update notification with download progress bar
│   │   └── WhisperQueue.tsx             #   Matched/unmatched whisper list with timestamps
│   ├── lib/
│   │   └── ae-api.ts                    #   Sprite/avatar caching utilities for renderer
│   └── pages/
│       ├── Dashboard.tsx                #   Live stats, inventory grid, whisper queue
│       ├── Listings.tsx                 #   Create/manage listings + All Merchants listings view
│       ├── Whispers.tsx                 #   Per-character whisper history
│       ├── Profile.tsx                  #   Player profile page
│       ├── Settings.tsx                 #   Client path, AE auth, auto-reply, proxy config
│       └── About.tsx                    #   Feature showcase with animated hero section
├── utils/
│   ├── logger.ts                        #   Console logging utilities
│   └── price-parser.ts                  #   Parse/format prices with K/M/B/GB suffixes
├── scripts/
│   └── launch-electron.js               #   Electron dev launcher script
├── public/
│   └── items/                           #   Item sprite PNGs indexed by sprite ID
├── build/
│   └── icon.ico                         #   Gold bar app icon (window, taskbar, installer)
├── package.json
├── tsconfig.json                        #   ES2022, strict mode
├── tsconfig.node.json                   #   Electron/Node build config
├── vite.config.ts                       #   Vite + React + Tailwind plugin config
├── index.html
├── CHANGELOG.md
├── HOW-TO-UPDATE.md
└── README.md
```

---

## Architecture Deep Dive

### Packet Flow

```
Dark Ages Client
      |
      | TCP (patched to localhost:2615)
      v
ProxyServer (proxy-server.ts)
      |
      | Creates ProxyConnection per client
      v
ProxyConnection (proxy-connection.ts)
      |
      | PacketInterceptor decrypts with DA crypto
      v
PacketInterceptor (packet-interceptor.ts)
      |
      | Parsed packets dispatched to:
      |   - MerchantEngine (whispers, exchange events)
      |   - InventoryTracker (add/remove items, gold)
      |   - LocationTracker (map changes, coordinates)
      |   - EntityTracker (player name → ID mapping)
      |   - Sniffer (packet log for debug UI)
      v
Dark Ages Server (live server)
      |
      | Responses flow back through the same pipeline
      v
Dark Ages Client
```

### Encryption Pipeline

1. Client sends encrypted packet → proxy receives raw bytes
2. `ClientCrypto` decrypts using XOR cipher + salt table + sequence counter
3. Packet is parsed, processed by engine, and optionally modified
4. `ServerCrypto` re-encrypts for forwarding to the live server
5. Server responses follow the reverse path

Each connection maintains independent cipher state. Sequence counters reset on server redirects.

### Inventory Tracking

The `InventoryTracker` maintains a 60-slot array by processing server packets:
- **0x0F (AddItemToPane)** — item added to a slot (name, sprite, quantity, slot index)
- **0x10 (RemoveItemFromPane)** — item removed from a slot
- **0x08 (Attributes)** — gold balance and character stats updated

The inventory state drives auto-pause/resume logic and the dashboard UI.

### Entity Resolution

The `EntityTracker` processes **0x07 (DisplayVisibleEntities)** packets to build a name→ID map. When the engine needs to initiate an exchange with a player, it looks up their entity ID from this tracker. If the entity is not visible, the exchange cannot proceed until they appear on screen.

### Price Parsing

The `price-parser.ts` utility handles human-friendly price formats:
- `10K` → 10,000
- `1.5M` → 1,500,000
- `2B` → 2,000,000,000
- `1GB` → 1,000,000,000 (alias)

Prices are stored as integers internally and formatted for display.

---

## IPC API Reference

All communication between the Electron main process and the React renderer goes through typed IPC channels exposed via `window.merchantMode`.

### Invoke Channels (Renderer → Main)

| Channel | Parameters | Returns | Description |
|---|---|---|---|
| `proxy:status` | — | `string` | Current proxy connection status |
| `proxy:start` | — | — | Start the proxy server |
| `proxy:stop` | — | — | Stop the proxy server |
| `characters:list` | — | `[{ name, connectionType }]` | List connected characters |
| `engine:state` | `characterName` | `string` | Engine state for a character |
| `engine:whispers` | `characterName` | `Whisper[]` | Whisper history |
| `inventory:get` | `characterName` | `InventoryItem[]` | Current inventory |
| `inventory:gold` | `characterName` | `number` | Gold balance |
| `listings:getAll` | `characterName` | `Listing[]` | All listings for character |
| `listings:getActive` | `characterName` | `Listing[]` | Active listings only |
| `listings:create` | `listing` | `Listing` | Create a new listing |
| `listings:update` | `listing` | `Listing` | Update an existing listing |
| `listings:delete` | `id, characterName` | — | Delete a listing |
| `transactions:getAll` | — | `Transaction[]` | All transactions |
| `transactions:getByDate` | `start, end` | `Transaction[]` | Transactions in date range |
| `merchants:getAll` | — | `GlobalMerchant[]` | All online merchants |
| `ae:sprite` | `name` | `string \| null` | Base64 character sprite |
| `ae:avatar` | `name` | `AvatarData \| null` | Avatar offset/zoom data |
| `ae:login` | `username, password` | `AuthResult` | Log in to AE |
| `ae:logout` | — | — | Log out of AE |
| `ae:getAuthStatus` | — | `{ loggedIn, username, verified }` | Current AE auth state |
| `ae:searchItems` | `query, limit` | `AeItem[]` | Search AE item database |
| `ae:resolveItem` | `name` | `{ canonical, slug, id }` | Resolve item name to AE ID |
| `ae:getSyncStatuses` | `ids[]` | `Record<id, status>` | Sync status per listing |
| `ae:retrySync` | `localListingId` | — | Retry failed sync |
| `ae:getPlayerProfile` | `name` | `PlayerProfile` | AE player profile |
| `ae:getPlayerListings` | `username` | `AeListing[]` | Player's AE listings |
| `ae:importListings` | `characterName` | — | Import AE listings locally |
| `sniffer:getLog` | — | `PacketEntry[]` | Packet sniffer log |
| `settings:get` | `key, default` | `string` | Read a setting |
| `settings:set` | `key, value` | — | Write a setting |
| `launcher:launch` | — | `{ success, processId?, error? }` | Launch DA client |
| `launcher:browse` | — | `string \| null` | Browse for client path |
| `launcher:getPath` | — | `string` | Current client path |
| `reconnect:getState` | — | `ReconnectState[]` | Current reconnect queue state |
| `reconnect:cancel` | `characterName` | — | Cancel reconnect for a character |
| `reconnect:cancelAll` | — | — | Cancel all pending reconnects |
| `updater:check` | — | — | Check for updates |
| `updater:download` | — | — | Download available update |
| `updater:install` | — | — | Quit and install update |
| `updater:version` | — | `string` | Current app version |
| `shell:openExternal` | `url` | — | Open URL in browser |
| `debug:isDev` | — | `boolean` | Check if running in dev mode |
| `debug:simulateServerDisconnect` | — | — | Simulate server disconnect (dev only) |

### Event Channels (Main → Renderer)

| Channel | Payload | Description |
|---|---|---|
| `proxy:status` | `status` | Proxy status changed |
| `proxy:packet` | `{ direction, opCode, dataHex, timestamp, characterName }` | Packet intercepted (sniffer) |
| `characters:connected` | `{ name, connectionType }` | Character connected |
| `characters:disconnected` | `name` | Character disconnected |
| `engine:state` | `{ characterName, state }` | Engine state changed |
| `engine:whisper` | `{ characterName, playerName, message, timestamp, matchedListing?, requestedQuantity }` | Whisper received |
| `engine:exchange-started` | `{ characterName, targetName }` | Exchange opened |
| `engine:exchange-updated` | `{ characterName, exchange }` | Exchange state changed |
| `engine:exchange-cancelled` | `{ characterName }` | Exchange cancelled |
| `engine:transaction` | `Transaction` | Trade completed |
| `engine:validation-failed` | `{ characterName, reason }` | Exchange validation failed |
| `inventory:update` | `{ characterName, items }` | Inventory changed |
| `inventory:gold-update` | `{ characterName, gold }` | Gold balance changed |
| `listings:changed` | `{ characterName }` | Listings modified |
| `merchants:updated` | `GlobalMerchant[]` | Merchant hub data updated |
| `ae:authChanged` | `{ loggedIn, username, verified }` | AE auth state changed |
| `reconnect:status` | `{ characterName, attempt, state, delay }` | Reconnect state changed |
| `updater:status` | `{ status, version?, percent?, message? }` | Update status event |

---

## Database Schema

MerchantMode uses **better-sqlite3** with WAL mode for concurrent reads. The schema is versioned with automatic migrations.

### `listings`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID |
| `character_name` | TEXT | Owning character |
| `type` | TEXT | BUY, SELL, or TRADE |
| `item_name` | TEXT | Item being listed |
| `price` | INTEGER | Price in gold |
| `quantity` | INTEGER | Total quantity |
| `quantity_remaining` | INTEGER | Remaining quantity |
| `status` | TEXT | ACTIVE, SOLD_OUT, or PAUSED |
| `wanted_items` | TEXT | JSON array (for TRADE listings) |
| `offered_items` | TEXT | JSON array (for TRADE listings) |
| `notes` | TEXT | Listing notes |
| `stack_size` | INTEGER | Items per stack |
| `sync_to_ae` | INTEGER | Boolean flag for AE sync |
| `created_at` | TEXT | ISO 8601 timestamp |
| `updated_at` | TEXT | ISO 8601 timestamp |

### `transactions`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | UUID |
| `character_name` | TEXT | Character that completed the trade |
| `listing_id` | TEXT | Associated listing |
| `counterparty_name` | TEXT | Other player's name |
| `type` | TEXT | BUY, SELL, or TRADE |
| `items_given` | TEXT | JSON: `[{ name, quantity }]` |
| `items_received` | TEXT | JSON: `[{ name, quantity }]` |
| `gold_given` | INTEGER | Gold sent |
| `gold_received` | INTEGER | Gold received |
| `status` | TEXT | COMPLETED, CANCELLED, or FAILED |
| `reason` | TEXT | Cancellation/failure reason |
| `timestamp` | TEXT | ISO 8601 timestamp |

### `settings`

| Column | Type | Description |
|---|---|---|
| `key` | TEXT PK | Setting key |
| `value` | TEXT | Setting value |

### `ae_items`

| Column | Type | Description |
|---|---|---|
| `id` | TEXT PK | AE item ID |
| `slug` | TEXT | URL slug |
| `name` | TEXT | Canonical item name |
| `category` | TEXT | Weapon, Armor, Consumable, etc. |
| `image_url` | TEXT | Sprite image URL |
| `aliases` | TEXT | JSON array of alternate names |
| `fetched_at` | TEXT | Cache timestamp |

### `ae_listing_map`

| Column | Type | Description |
|---|---|---|
| `local_id` | TEXT PK | Local listing UUID |
| `ae_id` | TEXT | AE marketplace listing ID |
| `ae_item_id` | TEXT | AE item ID |
| `synced_at` | TEXT | Last sync timestamp |

### `ae_sync_queue`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `operation` | TEXT | CREATE, UPDATE, or DELETE |
| `local_listing_id` | TEXT | Local listing UUID |
| `payload` | TEXT | JSON operation payload |
| `attempts` | INTEGER | Retry count |
| `last_attempt` | TEXT | Last attempt timestamp |
| `error` | TEXT | Last error message |
| `created_at` | TEXT | Queue entry timestamp |

---

## Network Protocol

### Packet Opcodes Handled

#### Client → Server

| Opcode | Name | Engine Use |
|---|---|---|
| `0x00` | Version | Connection handshake |
| `0x03` | Login | Character authentication |
| `0x06` | ClientWalk | Location coordinate updates |
| `0x0E` | PublicMessage | Chat monitoring |
| `0x19` | Whisper | Injected for auto-replies |
| `0x4A` | Exchange | Exchange commands (begin, add item, set gold, accept, cancel) |

#### Server → Client

| Opcode | Name | Engine Use |
|---|---|---|
| `0x00` | ConnectionInfo | Initializes crypto ciphers |
| `0x03` | Redirect | Captures redirect endpoints for server transfers |
| `0x04` | Location | Updates character x/y coordinates |
| `0x07` | DisplayVisibleEntities | Builds player name → entity ID map |
| `0x08` | Attributes | Tracks gold balance and character stats |
| `0x0A` | ChatMessage | Parses incoming whispers for listing matching |
| `0x0F` | AddItemToPane | Adds item to inventory tracker |
| `0x10` | RemoveItemFromPane | Removes item from inventory tracker |
| `0x15` | MapInfo | Extracts map name for location tracking |
| `0x42` | Exchange | Exchange events (started, item added, gold set, accepted, cancelled) |

### Exchange Packet Format (0x4A)

```
[opCode: 0x4A]
[action: uint8]    // ExchangeClientAction enum
  0 = BeginExchange   [targetId: uint32]
  1 = AddItem         [targetId: uint32, slot: uint8]
  2 = AddStackableItem[targetId: uint32, slot: uint8, quantity: uint32]
  3 = SetGold         [targetId: uint32, amount: uint32]
  4 = Cancel          [targetId: uint32]
  5 = Accept          [targetId: uint32]
```

---

## Configuration & Settings

All settings are stored in SQLite and accessible from the Settings page.

| Setting | Key | Default | Description |
|---|---|---|---|
| Client Path | `client_path` | *(empty)* | Path to `Darkages.exe` on your system |
| Auto-Reply | `auto_reply_enabled` | `true` | Toggle automatic whisper responses on/off |
| Reply (Selling) | `reply_available` | `I have {item}...` | Template when item is in stock. Variables: `{item}`, `{price}` |
| Reply (Buying) | `reply_buying` | `I am buying {item}...` | Template when buying. Variables: `{item}`, `{price}` |
| Reply (Trade) | `reply_trade` | `I will trade {item}...` | Template for trades. Variables: `{item}`, `{wanted}` |
| Reply (Not Found) | `reply_not_found` | `Sorry, I don't have...` | Template when item is not listed |
| Exchange Timeout | `exchange_timeout` | `60` | Seconds before cancelling a stalled exchange |
| AE Auth Token | `ae_auth_token` | *(empty)* | Persisted AislingExchange authentication token |
| AE Username | `ae_username` | *(empty)* | Logged-in AE username |
| Schema Version | `schema_version` | `6` | Internal DB migration version |

---

## Build & Release

### Build Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Vite dev server (renderer only) |
| Full dev | `npm run electron:dev` | Build + launch Electron with the app |
| Production build | `npm run build` | TypeScript compile + Vite bundle |
| Local installer | `npm run dist:local` | Build Windows NSIS installer locally |
| Publish release | `npm run dist` | Build + upload to GitHub Releases (requires `GH_TOKEN`) |
| Preview | `npm run preview` | Preview production build |
| Post-install | `npm run postinstall` | Rebuild native deps for Electron |

### Release Process

1. Bump `version` in `package.json` (use [semver](https://semver.org/))
2. Set `GH_TOKEN` environment variable with a GitHub PAT that has `repo` scope
3. Run `npm run dist`
4. electron-builder creates the `.exe` installer and uploads it as a GitHub Release
5. All running copies detect the update within 30 minutes and download it automatically
6. The update installs silently when the user closes the app

### Installer Configuration

- **Target:** Windows NSIS
- **One-click:** Disabled (user chooses install directory)
- **Custom path:** Allowed
- **Icon:** Gold bar sprite (`build/icon.ico`)
- **ASAR unpacked:** `better-sqlite3` and `koffi` (native modules)

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| [Electron](https://www.electronjs.org/) | 41 | Desktop application shell |
| [React](https://react.dev/) | 19 | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | 5.9 | Full-stack type safety |
| [Vite](https://vite.dev/) | 6.4 | Build tooling and dev server |
| [Tailwind CSS](https://tailwindcss.com/) | 4.2 | Utility-first styling (via Vite plugin) |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | 12 | Embedded SQLite database (WAL mode) |
| [koffi](https://koffi.dev/) | 2.15 | Win32 FFI for client memory patching |
| [electron-updater](https://www.electron.build/auto-update) | 6.8 | Auto-update via GitHub Releases |
| [electron-builder](https://www.electron.build/) | 26.8 | Packaging and NSIS installer creation |
| [react-router-dom](https://reactrouter.com/) | 7.13 | Client-side page routing |
| [lucide-react](https://lucide.dev/) | 0.577 | Icon library |
| [iconv-lite](https://github.com/ashtuchkin/iconv-lite) | 0.7 | Character encoding for DA protocol |
| [js-md5](https://github.com/nicosRes);  | 0.8 | MD5 hashing for packet crypto |

### UI Theme

Dark theme with gold accents designed around the Dark Ages aesthetic:

| Token | Value | Usage |
|---|---|---|
| Primary surfaces | `#0f0f13` → `#3a3a52` | 9-level background hierarchy |
| Gold accent | `#c9a84c` / `#dbb85e` / `#b8973e` | Buttons, highlights, badges |
| Text primary | `#e8e6e3` | Main content |
| Text secondary | `#9a9a9a` | Labels, descriptions |
| Success | `#4ade80` | Active states, confirmations |
| Danger | `#f87171` | Errors, deletions |
| Warning | `#fbbf24` | Pending states |

Animations include fade-in, slide-up, pulse-gold glow, and staggered list item entrances.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

---

## License

ISC
