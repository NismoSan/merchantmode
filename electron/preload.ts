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
    list: () => ipcRenderer.invoke('characters:list') as Promise<string[]>,
    onConnected: (cb: (name: string) => void) => { ipcRenderer.on('characters:connected', (_e, n) => cb(n)); },
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
  removeAllListeners: () => {
    const channels = [
      'proxy:packet', 'proxy:status',
      'characters:connected', 'characters:disconnected',
      'engine:state', 'engine:whisper', 'engine:exchange-started',
      'engine:exchange-updated', 'engine:exchange-cancelled',
      'engine:transaction', 'engine:validation-failed',
      'inventory:update', 'inventory:gold-update',
      'updater:status',
    ];
    channels.forEach((ch) => ipcRenderer.removeAllListeners(ch));
  },
});
