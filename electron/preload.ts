import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('merchantMode', {
  proxy: {
    getStatus: () => ipcRenderer.invoke('proxy:status'),
    start: () => ipcRenderer.invoke('proxy:start'),
    stop: () => ipcRenderer.invoke('proxy:stop'),
    onPacket: (cb: (data: any) => void) => { ipcRenderer.on('proxy:packet', (_e, d) => cb(d)); },
    onStatus: (cb: (status: string) => void) => { ipcRenderer.on('proxy:status', (_e, s) => cb(s)); },
  },
  characters: {
    list: () => ipcRenderer.invoke('characters:list') as Promise<{ name: string; connectionType: 'launched' | 'bot' }[]>,
    onConnected: (cb: (data: { name: string; connectionType: 'launched' | 'bot' }) => void) => { ipcRenderer.on('characters:connected', (_e, d) => cb(d)); },
    onDisconnected: (cb: (name: string) => void) => { ipcRenderer.on('characters:disconnected', (_e, n) => cb(n)); },
  },
  engine: {
    getState: (characterName?: string) => ipcRenderer.invoke('engine:state', characterName),
    getWhispers: (characterName?: string) => ipcRenderer.invoke('engine:whispers', characterName),
    onState: (cb: (data: { characterName: string; state: string }) => void) => { ipcRenderer.on('engine:state', (_e, s) => cb(s)); },
    onWhisper: (cb: (w: any) => void) => { ipcRenderer.on('engine:whisper', (_e, w) => cb(w)); },
    onExchangeStarted: (cb: (data: { characterName: string; targetName: string }) => void) => { ipcRenderer.on('engine:exchange-started', (_e, n) => cb(n)); },
    onExchangeUpdated: (cb: (data: { characterName: string; exchange: any }) => void) => { ipcRenderer.on('engine:exchange-updated', (_e, ex) => cb(ex)); },
    onExchangeCancelled: (cb: (data: { characterName: string }) => void) => { ipcRenderer.on('engine:exchange-cancelled', (_e, d) => cb(d)); },
    onTransaction: (cb: (tx: any) => void) => { ipcRenderer.on('engine:transaction', (_e, tx) => cb(tx)); },
    onValidationFailed: (cb: (data: { characterName: string; reason: string }) => void) => { ipcRenderer.on('engine:validation-failed', (_e, r) => cb(r)); },
  },
  listings: {
    getAll: (characterName?: string) => ipcRenderer.invoke('listings:getAll', characterName),
    getActive: (characterName?: string) => ipcRenderer.invoke('listings:getActive', characterName),
    create: (listing: any) => ipcRenderer.invoke('listings:create', listing),
    update: (listing: any) => ipcRenderer.invoke('listings:update', listing),
    delete: (id: string, characterName?: string) => ipcRenderer.invoke('listings:delete', id, characterName),
    onChanged: (cb: (data: { characterName: string }) => void) => { ipcRenderer.on('listings:changed', (_e, d) => cb(d)); },
  },
  transactions: {
    getAll: () => ipcRenderer.invoke('transactions:getAll'),
    getByDate: (start: string, end: string) => ipcRenderer.invoke('transactions:getByDate', start, end),
  },
  inventory: {
    get: (characterName?: string) => ipcRenderer.invoke('inventory:get', characterName),
    getGold: (characterName?: string) => ipcRenderer.invoke('inventory:gold', characterName),
    onUpdate: (cb: (data: { characterName: string; items: any[] }) => void) => { ipcRenderer.on('inventory:update', (_e, d) => cb(d)); },
    onGoldUpdate: (cb: (data: { characterName: string; gold: number }) => void) => { ipcRenderer.on('inventory:gold-update', (_e, d) => cb(d)); },
  },
  merchants: {
    getAll: () => ipcRenderer.invoke('merchants:getAll'),
    onUpdated: (cb: (merchants: any[]) => void) => { ipcRenderer.on('merchants:updated', (_e, d) => cb(d)); },
  },
  ae: {
    getSprite: (name: string) => ipcRenderer.invoke('ae:sprite', name) as Promise<string | null>,
    getAvatar: (name: string) => ipcRenderer.invoke('ae:avatar', name) as Promise<{ avatar_offset_x: number; avatar_offset_y: number; avatar_zoom: number } | null>,
    // Auth
    login: (username: string, password: string) => ipcRenderer.invoke('ae:login', username, password) as Promise<{ success: boolean; user?: any; error?: string }>,
    logout: () => ipcRenderer.invoke('ae:logout') as Promise<void>,
    getAuthStatus: () => ipcRenderer.invoke('ae:getAuthStatus') as Promise<{ loggedIn: boolean; username?: string; verified?: boolean }>,
    onAuthChanged: (cb: (status: { loggedIn: boolean; username?: string; verified?: boolean }) => void) => { ipcRenderer.on('ae:authChanged', (_e, d) => cb(d)); },
    // Items
    searchItems: (query: string, limit?: number) => ipcRenderer.invoke('ae:searchItems', query, limit) as Promise<{ name: string; slug: string; id: string; category: string | null }[]>,
    resolveItem: (name: string) => ipcRenderer.invoke('ae:resolveItem', name) as Promise<{ canonical: string; slug: string; id: string } | null>,
    // Listing sync
    getSyncStatuses: (ids: string[]) => ipcRenderer.invoke('ae:getSyncStatuses', ids) as Promise<Record<string, string>>,
    retrySync: (localListingId?: string) => ipcRenderer.invoke('ae:retrySync', localListingId) as Promise<void>,
    // Player profiles
    getPlayerProfile: (name: string) => ipcRenderer.invoke('ae:getPlayerProfile', name) as Promise<any>,
    getPlayerListings: (username: string) => ipcRenderer.invoke('ae:getPlayerListings', username) as Promise<any>,
    // Import AE listings
    importListings: (characterName: string) => ipcRenderer.invoke('ae:importListings', characterName) as Promise<{ imported: number; error?: string }>,
  },
  sniffer: {
    getLog: () => ipcRenderer.invoke('sniffer:getLog'),
  },
  settings: {
    get: (key: string, defaultValue?: string) => ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },
  launcher: {
    launch: () => ipcRenderer.invoke('launcher:launch') as Promise<{ success: boolean; processId?: number; error?: string }>,
    browse: () => ipcRenderer.invoke('launcher:browse') as Promise<string | null>,
    getPath: () => ipcRenderer.invoke('launcher:getPath') as Promise<string>,
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:version') as Promise<string>,
    onStatus: (cb: (data: { status: string; version?: string; percent?: number; message?: string }) => void) => {
      ipcRenderer.on('updater:status', (_e, d) => cb(d));
    },
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  removeAllListeners: () => {
    const channels = [
      'proxy:packet', 'proxy:status',
      'characters:connected', 'characters:disconnected',
      'engine:state', 'engine:whisper', 'engine:exchange-started',
      'engine:exchange-updated', 'engine:exchange-cancelled',
      'engine:transaction', 'engine:validation-failed',
      'inventory:update', 'inventory:gold-update',
      'listings:changed',
      'merchants:updated',
      'ae:authChanged',
      'updater:status',
    ];
    channels.forEach((ch) => ipcRenderer.removeAllListeners(ch));
  },
});
