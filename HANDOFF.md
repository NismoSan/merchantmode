# MerchantMode Handoff - 2026-03-14

## What Was Done This Session

### Phase 1: Exchange Packet Format Fix (CRITICAL)
Packet capture proved that ALL `ClientExchange` (0x4A) packets require `[action u8][targetId u32][data...]`.
The code was only including targetId for `BeginExchange`, making all other exchange injections (AddItem, SetGold, Accept, Cancel) malformed.

**Files changed:**
- `core/network/packets/exchange/client-exchange.ts` — serialize/deserialize now always write/read targetId after action
- `core/engine/merchant-engine.ts` — all exchange request events emit targetId
- `electron/main.ts` — all injection functions include targetId

### Phase 2: Multi-Character Architecture
Replaced singleton `merchantEngine`/`inventoryTracker`/`merchantConnection` with per-character contexts.

**`electron/main.ts`:**
- `CharacterContext` interface: `{ characterName, connection, engine, inventoryTracker }`
- `characterContexts: Map<string, CharacterContext>` replaces singletons
- `createCharacterContext()` creates engine + tracker + wires all events per character
- Packet routing: each connection's packets go to its character's engine
- Context only created when connection reaches `IN_GAME` phase (prevents `socket[257]` ghost tabs)

### Phase 3: Per-Character Listings
- `core/models/listing.ts` — added `characterName: string` field
- `core/db/database.ts` — migration adds `character_name` column; queries filter by character; legacy listings (empty character_name) are included in per-character queries via `OR character_name = ''`

### Phase 4: IPC Protocol
- All engine/inventory/listing IPC handlers accept optional `characterName`
- Push events include `characterName` in payload (e.g., `{ characterName, state }`)
- New `characters:list`, `characters:connected`, `characters:disconnected` channels
- `electron/preload.ts` updated with `characters` API
- `src/vite-env.d.ts` updated with new types

### Phase 5: UI Character Tabs
- New `src/components/CharacterTabs.tsx` — horizontal tab bar with activity indicators
- `src/App.tsx` — manages `characters[]`, `activeCharacter`, `characterStates`
- `src/pages/Dashboard.tsx` — accepts `characterName` prop, scopes all data
- `src/components/ListingManager.tsx` — includes `characterName` in CRUD

### Phase 6: Entity Tracker
- New `core/engine/entity-tracker.ts` — tracks playerName<->entityId from visible entities and exchange events
- Engine emits `requestBeginExchange` when it can resolve a whisperer's entity ID (merchant-initiated exchange)

---

## Bug Fixes Applied

### Whisper Echo Fix
- Server sends `Name> message` for outgoing echoes, `Name" message` for incoming whispers
- Removed arrow-format regex; only process quote-terminated name format

### Whisper Regex Fix (LATEST - NEEDS TESTING)
- The incoming whisper format is `SenderName" message` (no opening quote, just closing quote after name)
- Old regex `^"([^"]+)"\s+` expected a leading quote and NEVER MATCHED
- New regex: `^([A-Za-z][A-Za-z0-9 ]*)"\s+([\s\S]*)$`
- This was discovered from logs: `"Win" Gold bar"` in log output means actual message string is `Win" Gold bar`

### Inventory Refresh
- Injecting `RequestRefresh` packet 1s after context creation since initial inventory packets arrive before the context exists
- Added logging to InventoryTracker to confirm if AddItemToPane packets are received

### Exchange State Reset
- Engine now properly resets state when a manually-completed exchange has no whisper queue match (previously got stuck in EXCHANGE_OPEN forever)

---

## Outstanding Bugs (Not Yet Verified Fixed)

### 1. Whisper Not Replying — JUST FIXED, NEEDS TESTING
The regex fix should resolve this. Check logs for `[MerchantEngine:CharName] Whisper from X: Y` lines.

### 2. Inventory Not Loading — PARTIALLY FIXED, NEEDS TESTING
Check logs for `[InventoryTracker] Item added:` lines after login. If none appear:
- The server may not re-send individual `AddItemToPane` on refresh
- Alternative approaches: buffer server packets before context creation and replay them, or parse equipment/attribute packets that arrive during login
- The `RefreshResponse` (opCode 34) might need to be handled differently

### 3. Exchange Automation — SHOULD WORK ONCE WHISPER IS FIXED
The full flow depends on whisper being correctly received and matched to a listing. If whisper works, exchange should follow.

---

## Key Protocol Details

### Whisper Message Formats (ServerOpCode 10 / 0x0A, messageType 0)
- **Incoming**: `SenderName" message` — name ends with `"`, NO opening quote
- **Outgoing echo**: `TargetName> message` — name ends with `>`

### Exchange Packet Format (ClientOpCode 74 / 0x4A)
ALL actions: `[action u8][targetId u32][action-specific data]`
| Action | Code | Payload |
|--------|------|---------|
| BeginExchange | 0 | `[0x00][targetId u32]` |
| AddItem | 1 | `[0x01][targetId u32][slot u8]` |
| AddStackableItem | 2 | `[0x02][targetId u32][slot u8][qty u8]` |
| SetGold | 3 | `[0x03][targetId u32][gold u32]` |
| Cancel | 4 | `[0x04][targetId u32]` |
| Accept | 5 | `[0x05][targetId u32]` |

### Connection Lifecycle
1. Client connects to proxy -> proxy connects to login server
2. Server sends ConnectionInfo (seed + key) -> crypto initialized
3. Server sends Redirect (IP:port + name) -> proxy rewrites to localhost, queues real target
4. Client reconnects -> proxy uses queued target -> connects to game server
5. Client sends ClientRedirected (name + seed) -> characterName set
6. Server sends UserId -> phase = IN_GAME -> context created
7. Proxy injects RequestRefresh -> server re-sends inventory/map

`socket[257]` is the name from the FIRST redirect (login server). Not a real character. Context creation gated on `phase === IN_GAME`.

---

## Files Modified (Complete List)
| File | Status |
|------|--------|
| `core/network/packets/exchange/client-exchange.ts` | Modified |
| `core/engine/merchant-engine.ts` | Modified |
| `core/engine/inventory-tracker.ts` | Modified |
| `core/engine/entity-tracker.ts` | **NEW** |
| `core/models/listing.ts` | Modified |
| `core/db/database.ts` | Modified |
| `electron/main.ts` | Modified (heavily) |
| `electron/preload.ts` | Modified |
| `src/vite-env.d.ts` | Modified |
| `src/App.tsx` | Modified |
| `src/pages/Dashboard.tsx` | Modified |
| `src/components/CharacterTabs.tsx` | **NEW** |
| `src/components/ListingManager.tsx` | Modified |
