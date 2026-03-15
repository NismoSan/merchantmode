import { EventEmitter } from 'events';

export interface GlobalMerchant {
  name: string;
  mapName: string;
  x: number;
  y: number;
  listings: { type: string; itemName: string; price: number; status: string }[];
}

export interface MerchantHubCharacter {
  name: string;
  mapName: string;
  x: number;
  y: number;
  listings: { type: string; itemName: string; price: number; status: string }[];
}

const HUB_URL = 'wss://api.aislingexchange.com/ws/merchants';
const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_BASE_DELAY = 2_000;
const RECONNECT_MAX_DELAY = 30_000;

export class MerchantHubClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldConnect = false;
  private merchants: GlobalMerchant[] = [];

  connect(): void {
    this.shouldConnect = true;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.shouldConnect = false;
    this.reconnectAttempts = 0;
    this.cleanup();
  }

  getMerchants(): GlobalMerchant[] {
    return this.merchants;
  }

  sendUpdate(characters: MerchantHubCharacter[]): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'update', characters }));
    }
  }

  private doConnect(): void {
    if (!this.shouldConnect) return;
    this.cleanup();

    try {
      this.ws = new WebSocket(HUB_URL);
    } catch (err) {
      console.error('[MerchantHub] Failed to create WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[MerchantHub] Connected to merchant hub');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'snapshot' || msg.type === 'update') {
          this.merchants = Array.isArray(msg.merchants) ? msg.merchants : [];
          this.emit('merchantsUpdated', this.merchants);
        }
      } catch (err) {
        console.error('[MerchantHub] Bad message from hub:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[MerchantHub] Disconnected from merchant hub');
      this.stopHeartbeat();
      this.emit('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[MerchantHub] WebSocket error:', err);
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldConnect) return;
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts), RECONNECT_MAX_DELAY);
    this.reconnectAttempts++;
    console.log(`[MerchantHub] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
