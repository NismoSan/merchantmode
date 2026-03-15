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
    list: () => Promise<string[]>;
    onConnected: (cb: (name: string) => void) => void;
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
  sniffer: {
    getLog: () => Promise<any[]>;
  };
  settings: {
    get: (key: string, defaultValue?: string) => Promise<string>;
    set: (key: string, value: string) => Promise<void>;
  };
  launcher: {
    launch: () => Promise<{ success: boolean; processId?: number; error?: string }>;
    browse: () => Promise<string | null>;
    getPath: () => Promise<string>;
  };
  removeAllListeners: () => void;
}

declare global {
  interface Window {
    merchantMode: MerchantModeAPI;
  }
}

export {};
