/// <reference types="vite/client" />

interface MerchantModeAPI {
  proxy: {
    getStatus: () => Promise<string>;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    onPacket: (cb: (data: any) => void) => void;
    onStatus: (cb: (status: string) => void) => void;
  };
  characters: {
    list: () => Promise<{ name: string; connectionType: 'launched' | 'bot' }[]>;
    onConnected: (cb: (data: { name: string; connectionType: 'launched' | 'bot' }) => void) => void;
    onDisconnected: (cb: (name: string) => void) => void;
  };
  engine: {
    getState: (characterName?: string) => Promise<string>;
    getWhispers: (characterName?: string) => Promise<any[]>;
    onState: (cb: (data: { characterName: string; state: string }) => void) => void;
    onWhisper: (cb: (w: any) => void) => void;
    onExchangeStarted: (cb: (data: { characterName: string; targetName: string }) => void) => void;
    onExchangeUpdated: (cb: (data: { characterName: string; exchange: any }) => void) => void;
    onExchangeCancelled: (cb: (data: { characterName: string }) => void) => void;
    onTransaction: (cb: (tx: any) => void) => void;
    onValidationFailed: (cb: (data: { characterName: string; reason: string }) => void) => void;
  };
  listings: {
    getAll: (characterName?: string) => Promise<any[]>;
    getActive: (characterName?: string) => Promise<any[]>;
    create: (listing: any) => Promise<any[]>;
    update: (listing: any) => Promise<any[]>;
    delete: (id: string, characterName?: string) => Promise<any[]>;
    onChanged: (cb: (data: { characterName: string }) => void) => void;
  };
  transactions: {
    getAll: () => Promise<any[]>;
    getByDate: (start: string, end: string) => Promise<any[]>;
  };
  inventory: {
    get: (characterName?: string) => Promise<any[]>;
    getGold: (characterName?: string) => Promise<number>;
    onUpdate: (cb: (data: { characterName: string; items: any[] }) => void) => void;
    onGoldUpdate: (cb: (data: { characterName: string; gold: number }) => void) => void;
  };
  merchants: {
    getAll: () => Promise<GlobalMerchantData[]>;
    onUpdated: (cb: (merchants: GlobalMerchantData[]) => void) => void;
  };
  ae: {
    getSprite: (name: string) => Promise<string | null>;
    getAvatar: (name: string) => Promise<{ avatar_offset_x: number; avatar_offset_y: number; avatar_zoom: number } | null>;
    // Auth
    login: (username: string, password: string) => Promise<{ success: boolean; user?: { id: string; username: string; verified: boolean }; error?: string }>;
    logout: () => Promise<void>;
    getAuthStatus: () => Promise<{ loggedIn: boolean; username?: string; verified?: boolean }>;
    onAuthChanged: (cb: (status: { loggedIn: boolean; username?: string; verified?: boolean }) => void) => void;
    // Items
    searchItems: (query: string, limit?: number) => Promise<{ name: string; slug: string; id: string; category: string | null }[]>;
    resolveItem: (name: string) => Promise<{ canonical: string; slug: string; id: string } | null>;
    // Listing sync
    getSyncStatuses: (ids: string[]) => Promise<Record<string, 'synced' | 'pending' | 'failed' | 'not_synced'>>;
    retrySync: (localListingId?: string) => Promise<void>;
    // Player profiles
    getPlayerProfile: (name: string) => Promise<any>;
    getPlayerListings: (username: string) => Promise<any>;
    // Import AE listings
    importListings: (characterName: string) => Promise<{ imported: number; error?: string }>;
  };
  sniffer: {
    getLog: () => Promise<any[]>;
  };
  settings: {
    get: (key: string, defaultValue?: string) => Promise<string>;
    set: (key: string, value: string) => Promise<void>;
  };
  updater: {
    check: () => Promise<void>;
    install: () => void;
    getVersion: () => Promise<string>;
    onStatus: (cb: (data: { status: string; version?: string; percent?: number; message?: string }) => void) => void;
  };
  launcher: {
    launch: () => Promise<{ success: boolean; processId?: number; error?: string }>;
    browse: () => Promise<string | null>;
    getPath: () => Promise<string>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  removeAllListeners: () => void;
}

declare global {
  interface GlobalMerchantListing {
    type: string;
    itemName: string;
    price: number;
    status: string;
    quantity?: number;
    quantityRemaining?: number;
    stackSize?: number;
    wantedItems?: { name: string; quantity: number }[];
    notes?: string;
  }

  interface GlobalMerchantData {
    name: string;
    mapName: string;
    x: number;
    y: number;
    listings: GlobalMerchantListing[];
  }

  interface Window {
    merchantMode: MerchantModeAPI;
  }
}

export {};
