import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { ProxyServer } from '../core/proxy/proxy-server';
import { ProxyConnection } from '../core/proxy/proxy-connection';
import { MerchantEngine } from '../core/engine/merchant-engine';
import { InventoryTracker } from '../core/engine/inventory-tracker';
import { BinaryWriter } from '../core/network/serialization/binary-writer';
import { ClientOpCode, ServerOpCode } from '../core/network/packets/op-codes';
import { ExchangeClientAction } from '../core/network/packets/exchange/exchange-types';
import { ConnectionPhase } from '../core/proxy/connection-state';
import { launchClient, closeClientHandles, type LaunchedClient } from '../core/launcher/client-launcher';
import * as db from '../core/db/database';
import type { MerchantListing } from '../core/models/listing';

let mainWindow: BrowserWindow | null = null;
let proxyServer: ProxyServer | null = null;
let launchedClient: LaunchedClient | null = null;

// Per-character contexts — each connected character gets its own engine + inventory
interface CharacterContext {
  characterName: string;
  connection: ProxyConnection;
  engine: MerchantEngine;
  inventoryTracker: InventoryTracker;
}
const characterContexts: Map<string, CharacterContext> = new Map();

// Packet log buffer for the sniffer UI
const packetLog: { direction: string; opCode: number; dataHex: string; timestamp: number; characterName?: string }[] = [];
const MAX_PACKET_LOG = 500;

// Buffer server packets that arrive before the character context is created.
// Key = characterName, value = array of {opCode, data} to replay once the context exists.
const preContextPacketBuffer: Map<string, { opCode: number; data: Uint8Array }[]> = new Map();

function send(channel: string, ...args: unknown[]) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Merchant Mode',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }


  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- Per-character context creation ---

function createCharacterContext(characterName: string, connection: ProxyConnection): CharacterContext {
  const inventoryTracker = new InventoryTracker();
  const engine = new MerchantEngine(inventoryTracker);

  engine.setCharacterName(characterName);

  // Load per-character listings from DB
  const listings = db.getAllListings(characterName);
  engine.setListings(listings);

  // Engine events -> renderer (all include characterName)
  engine.on('stateChanged', (state: string) => {
    send('engine:state', { characterName, state });
  });

  engine.on('whisperReceived', (whisper: any) => {
    send('engine:whisper', { characterName, ...whisper });
    // Auto-reply only if enabled
    const autoReplyEnabled = db.getSetting('auto_reply_enabled', 'true');
    if (autoReplyEnabled !== 'true') return;

    if (whisper.matchedListing) {
      const template = db.getSetting('reply_available', 'I have {item} for {price}. Open exchange with me to buy.');
      const msg = template
        .replace('{item}', whisper.matchedListing.itemName)
        .replace('{price}', formatGold(whisper.matchedListing.price));
      injectWhisper(characterName, whisper.playerName, msg);
    } else {
      const template = db.getSetting('reply_not_found', "Sorry, I don't have that item for sale.");
      injectWhisper(characterName, whisper.playerName, template);
    }
  });

  engine.on('exchangeStarted', (name: string) => {
    send('engine:exchange-started', { characterName, targetName: name });
  });

  engine.on('exchangeUpdated', (exchange: any) => {
    send('engine:exchange-updated', { characterName, exchange });
  });

  engine.on('exchangeCancelled', () => {
    send('engine:exchange-cancelled', { characterName });
  });

  engine.on('transactionCompleted', (tx: any) => {
    db.insertTransaction(tx);
    // Update listing in DB
    const listing = engine.getListings().find((l) => l.id === tx.listingId);
    if (listing) db.updateListing(listing);
    send('engine:transaction', { characterName, ...tx });
  });

  engine.on('validationFailed', (reason: string) => {
    send('engine:validation-failed', { characterName, reason });
  });

  // Exchange automation: engine requests -> inject packets via proxy
  engine.on('requestBeginExchange', (targetId: number) => {
    injectExchangeAction(characterName, ExchangeClientAction.BeginExchange, targetId);
  });

  engine.on('requestCancel', (targetId: number) => {
    injectExchangeAction(characterName, ExchangeClientAction.Cancel, targetId);
  });

  engine.on('requestAccept', (targetId: number) => {
    injectExchangeAction(characterName, ExchangeClientAction.Accept, targetId);
  });

  engine.on('requestFillSell', (listing: MerchantListing, targetId: number, requestedQty: number) => {
    // Find the item in inventory and add it to exchange
    const slot = inventoryTracker.findSlotByName(listing.itemName);
    console.log(`[MerchantMode:${characterName}] FillSell: looking for "${listing.itemName}", found slot=${slot}, requestedQty=${requestedQty}`);
    if (slot !== undefined) {
      const item = inventoryTracker.getItem(slot);
      if (item?.isStackable) {
        // Stackable items use a two-step process:
        // 1. Send AddItem to trigger QuantityPrompt from server
        // 2. Wait for quantityPrompt event, then send AddStackableItem with qty
        const qty = Math.min(requestedQty, item.quantity);
        console.log(`[MerchantMode:${characterName}] Adding stackable item slot=${slot}, sending AddItem first to trigger qty prompt (qty=${qty})`);
        engine.once('quantityPrompt', (promptSlot: number, promptTargetId: number) => {
          console.log(`[MerchantMode:${characterName}] QuantityPrompt received for slot=${promptSlot}, responding with qty=${qty}`);
          injectExchangeAddStackable(characterName, promptTargetId, promptSlot, qty);
          setTimeout(() => engine.onFillComplete(), 500);
        });
        injectExchangeAddItem(characterName, targetId, slot);
      } else {
        console.log(`[MerchantMode:${characterName}] Adding item slot=${slot} name="${item?.name}" to exchange`);
        injectExchangeAddItem(characterName, targetId, slot);
        setTimeout(() => engine.onFillComplete(), 500);
      }
    } else {
      // Item not found in inventory
      injectExchangeAction(characterName, ExchangeClientAction.Cancel, targetId);
      send('engine:validation-failed', { characterName, reason: `Item "${listing.itemName}" not found in inventory` });
    }
  });

  engine.on('requestFillBuy', (listing: MerchantListing, targetId: number, requestedQty: number) => {
    // Place gold for buying — total = price * quantity
    const totalPrice = listing.price * requestedQty;
    console.log(`[MerchantMode:${characterName}] FillBuy: placing ${totalPrice} gold (${listing.price} x ${requestedQty})`);
    injectExchangeSetGold(characterName, targetId, totalPrice);
    setTimeout(() => engine.onFillComplete(), 500);
  });

  // Inventory tracker events -> renderer
  inventoryTracker.on('itemAdded', () => {
    send('inventory:update', { characterName, items: Array.from(inventoryTracker.getState().items.values()) });
  });

  inventoryTracker.on('itemRemoved', () => {
    send('inventory:update', { characterName, items: Array.from(inventoryTracker.getState().items.values()) });
  });

  inventoryTracker.on('goldUpdated', (gold: number) => {
    send('inventory:gold-update', { characterName, gold });
  });

  const ctx: CharacterContext = { characterName, connection, engine, inventoryTracker };
  console.log(`[MerchantMode] Character context created: ${characterName}`);
  return ctx;
}

function startProxy() {
  if (proxyServer) proxyServer.stop();

  proxyServer = new ProxyServer({
    listenPort: 2610,
    remoteHost: 'da0.kru.com',
    remotePort: 2610,
  });

  proxyServer.on('packet', (direction: string, opCode: number, data: Uint8Array, connection: ProxyConnection) => {
    const charName = connection.connectionState.characterName;

    // Log for sniffer
    const entry = {
      direction,
      opCode,
      dataHex: Buffer.from(data).toString('hex').substring(0, 200),
      timestamp: Date.now(),
      characterName: charName || undefined,
    };
    packetLog.push(entry);
    if (packetLog.length > MAX_PACKET_LOG) packetLog.shift();

    // Only create context once the connection is fully in-game
    const isInGame = connection.connectionState.phase === ConnectionPhase.IN_GAME;
    if (charName && isInGame && !characterContexts.has(charName)) {
      const ctx = createCharacterContext(charName, connection);
      characterContexts.set(charName, ctx);
      send('characters:connected', charName);

      // Replay any packets that were buffered before context creation (inventory, stats, etc.)
      const buffered = preContextPacketBuffer.get(charName);
      if (buffered && buffered.length > 0) {
        console.log(`[MerchantMode] Replaying ${buffered.length} buffered packets for ${charName}`);
        for (const pkt of buffered) {
          ctx.engine.processServerPacket(pkt.opCode, pkt.data);
        }
        preContextPacketBuffer.delete(charName);
      }

      // Push full inventory snapshot to renderer after a short delay
      // (allows any remaining packets from the current tick to be processed)
      setTimeout(() => {
        const items = Array.from(ctx.inventoryTracker.getState().items.values());
        const gold = ctx.inventoryTracker.getGold();
        console.log(`[MerchantMode] Pushing inventory snapshot for ${charName}: ${items.length} items, ${gold} gold`);
        send('inventory:update', { characterName: charName, items });
        send('inventory:gold-update', { characterName: charName, gold });
      }, 500);
    }

    // Update connection reference (may change after redirect)
    if (charName && isInGame && characterContexts.has(charName)) {
      characterContexts.get(charName)!.connection = connection;
    }

    // Forward server packets to the correct character's engine
    if (direction === 'server' && charName) {
      const ctx = characterContexts.get(charName);
      if (ctx) {
        ctx.engine.processServerPacket(opCode, data);
      } else if (charName) {
        // Context doesn't exist yet — buffer server packets for replay once context is created
        if (!preContextPacketBuffer.has(charName)) {
          preContextPacketBuffer.set(charName, []);
        }
        preContextPacketBuffer.get(charName)!.push({ opCode, data: Uint8Array.from(data) });
      }
    }

    // Send to renderer (throttled - only important opcodes)
    const importantOps = [
      ServerOpCode.ServerMessage, ServerOpCode.ChatMessage, ServerOpCode.Exchange, ServerOpCode.AddItemToPane,
      ServerOpCode.RemoveItemFromPane, ServerOpCode.Attributes,
      ClientOpCode.Exchange, ClientOpCode.Whisper,
    ];
    if (importantOps.includes(opCode)) {
      send('proxy:packet', entry);
    }
  });

  proxyServer.on('connection', () => {
    send('proxy:status', 'connected');
  });

  proxyServer.on('disconnection', (connection?: ProxyConnection) => {
    // Find and remove the context for this connection
    if (connection) {
      for (const [name, ctx] of characterContexts) {
        if (ctx.connection === connection) {
          ctx.inventoryTracker.clear();
          characterContexts.delete(name);
          preContextPacketBuffer.delete(name);
          send('characters:disconnected', name);
          console.log(`[MerchantMode] Character disconnected: ${name}`);
          break;
        }
      }
    }
    send('proxy:status', proxyServer?.isConnected() ? 'connected' : 'disconnected');
  });

  proxyServer.start();
  console.log('[MerchantMode] Proxy listening on localhost:2610');
}

// --- Packet injection helpers ---

function getConnectionForCharacter(characterName: string): ProxyConnection | null {
  return characterContexts.get(characterName)?.connection ?? null;
}

function injectWhisper(characterName: string, target: string, message: string) {
  const conn = getConnectionForCharacter(characterName);
  if (!conn) return;
  const ctx = characterContexts.get(characterName);
  ctx?.engine.recordSentWhisper(target, message);
  const writer = new BinaryWriter();
  writer.writeString8(target);
  writer.writeString8(message);
  conn.injectClientPacket(ClientOpCode.Whisper, writer.toArray());
}

function injectExchangeAction(characterName: string, action: ExchangeClientAction, targetId: number) {
  const conn = getConnectionForCharacter(characterName);
  if (!conn) return;
  const writer = new BinaryWriter();
  writer.writeUint8(action);
  writer.writeUint32(targetId);
  conn.injectClientPacket(ClientOpCode.Exchange, writer.toArray());
}

function injectExchangeAddItem(characterName: string, targetId: number, slot: number) {
  const conn = getConnectionForCharacter(characterName);
  if (!conn) return;
  const writer = new BinaryWriter();
  writer.writeUint8(ExchangeClientAction.AddItem);
  writer.writeUint32(targetId);
  writer.writeUint8(slot);
  conn.injectClientPacket(ClientOpCode.Exchange, writer.toArray());
}

function injectExchangeAddStackable(characterName: string, targetId: number, slot: number, quantity: number) {
  const conn = getConnectionForCharacter(characterName);
  if (!conn) return;
  const writer = new BinaryWriter();
  writer.writeUint8(ExchangeClientAction.AddStackableItem);
  writer.writeUint32(targetId);
  writer.writeUint8(slot);
  writer.writeUint8(quantity);
  conn.injectClientPacket(ClientOpCode.Exchange, writer.toArray());
}

function injectExchangeSetGold(characterName: string, targetId: number, amount: number) {
  const conn = getConnectionForCharacter(characterName);
  if (!conn) return;
  const writer = new BinaryWriter();
  writer.writeUint8(ExchangeClientAction.SetGold);
  writer.writeUint32(targetId);
  writer.writeUint32(amount);
  conn.injectClientPacket(ClientOpCode.Exchange, writer.toArray());
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toString();
}

// --- IPC Handlers ---

function registerIpcHandlers() {
  // Proxy
  ipcMain.handle('proxy:status', () => proxyServer?.isConnected() ? 'connected' : 'disconnected');
  ipcMain.handle('proxy:start', () => { if (!proxyServer?.isListening()) startProxy(); });
  ipcMain.handle('proxy:stop', () => { proxyServer?.stop(); });

  // Characters
  ipcMain.handle('characters:list', () => Array.from(characterContexts.keys()));

  // Engine state (character-scoped)
  ipcMain.handle('engine:state', (_e, characterName?: string) => {
    if (characterName) {
      return characterContexts.get(characterName)?.engine.getState() ?? 'IDLE';
    }
    // Fallback: return first character's state
    const first = characterContexts.values().next();
    return first.done ? 'IDLE' : first.value.engine.getState();
  });

  ipcMain.handle('engine:whispers', (_e, characterName?: string) => {
    if (characterName) {
      return characterContexts.get(characterName)?.engine.getWhisperQueue() ?? [];
    }
    return [];
  });

  // Listings CRUD (character-scoped)
  ipcMain.handle('listings:getAll', (_e, characterName?: string) => db.getAllListings(characterName));
  ipcMain.handle('listings:getActive', (_e, characterName?: string) => db.getActiveListings(characterName));

  ipcMain.handle('listings:create', (_e, listing: MerchantListing) => {
    db.insertListing(listing);
    // Refresh the appropriate engine
    const ctx = characterContexts.get(listing.characterName ?? '');
    if (ctx) ctx.engine.setListings(db.getAllListings(listing.characterName));
    return db.getAllListings(listing.characterName);
  });

  ipcMain.handle('listings:update', (_e, listing: MerchantListing) => {
    db.updateListing(listing);
    const ctx = characterContexts.get(listing.characterName ?? '');
    if (ctx) ctx.engine.setListings(db.getAllListings(listing.characterName));
    return db.getAllListings(listing.characterName);
  });

  ipcMain.handle('listings:delete', (_e, id: string, characterName?: string) => {
    db.deleteListing(id);
    if (characterName) {
      const ctx = characterContexts.get(characterName);
      if (ctx) ctx.engine.setListings(db.getAllListings(characterName));
    }
    return db.getAllListings(characterName);
  });

  // Transactions
  ipcMain.handle('transactions:getAll', () => db.getAllTransactions());
  ipcMain.handle('transactions:getByDate', (_e, start: string, end: string) => db.getTransactionsByDate(start, end));

  // Inventory (character-scoped)
  ipcMain.handle('inventory:get', (_e, characterName?: string) => {
    if (characterName) {
      const ctx = characterContexts.get(characterName);
      if (!ctx) return [];
      return Array.from(ctx.inventoryTracker.getState().items.values());
    }
    return [];
  });

  ipcMain.handle('inventory:gold', (_e, characterName?: string) => {
    if (characterName) {
      return characterContexts.get(characterName)?.inventoryTracker.getGold() ?? 0;
    }
    return 0;
  });

  // Packet sniffer
  ipcMain.handle('sniffer:getLog', () => packetLog.slice(-200));

  // Settings
  ipcMain.handle('settings:get', (_e, key: string, defaultValue?: string) => db.getSetting(key, defaultValue));
  ipcMain.handle('settings:set', (_e, key: string, value: string) => { db.setSetting(key, value); });

  // Auto-updater
  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates().catch(() => {}));
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());
  ipcMain.handle('updater:version', () => app.getVersion());

  // Client launcher
  ipcMain.handle('launcher:launch', async () => {
    const clientPath = db.getSetting('client_path', 'C:\\Program Files (x86)\\KRU\\Dark Ages\\Darkages.exe');
    try {
      // Ensure proxy is running before launching client
      if (!proxyServer?.isListening()) {
        startProxy();
      }
      launchedClient = launchClient(clientPath, { localPort: 2610, skipIntro: true });
      return { success: true, processId: launchedClient.processId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('launcher:browse', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select Darkages.exe',
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      properties: ['openFile'],
      defaultPath: db.getSetting('client_path', 'C:\\Program Files (x86)\\KRU\\Dark Ages'),
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selected = result.filePaths[0];
      db.setSetting('client_path', selected);
      return selected;
    }
    return null;
  });

  ipcMain.handle('launcher:getPath', () => {
    return db.getSetting('client_path', 'C:\\Program Files (x86)\\KRU\\Dark Ages\\Darkages.exe');
  });
}

// --- Auto-updater ---

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    send('updater:status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    send('updater:status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    send('updater:status', { status: 'downloading', percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('updater:status', { status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    send('updater:status', { status: 'error', message: err.message });
  });

  // Check for updates on launch, then every 30 minutes
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

// --- App lifecycle ---

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();
  startProxy();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  proxyServer?.stop();
  if (launchedClient) closeClientHandles(launchedClient);
  db.closeDb();
  app.quit();
});
