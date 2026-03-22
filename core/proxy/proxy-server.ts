import net from 'net';
import { EventEmitter } from 'events';
import { ProxyConnection } from './proxy-connection';

export interface ProxyConfig {
  listenPort: number;
  remoteHost: string;
  remotePort: number;
}

/**
 * TCP proxy server matching Arbiter's ProxyServer architecture.
 *
 * Each client connection creates a brand new ProxyConnection with fresh crypto state.
 * Redirect targets are queued — when a client reconnects after redirect, the queued
 * endpoint is used instead of the default.
 */
export class ProxyServer extends EventEmitter {
  private server: net.Server | null = null;
  private _isListening = false;

  // Pending redirect queue (like Arbiter's ConcurrentQueue<IPEndPoint>)
  // Carries credentials from the login connection to the game server connection
  private pendingRedirects: { host: string; port: number; username?: string; password?: string }[] = [];

  // Active connections
  private connections: ProxyConnection[] = [];

  // Default remote endpoint
  private defaultRemoteHost: string;
  private defaultRemotePort: number;

  constructor(private config: ProxyConfig) {
    super();
    this.defaultRemoteHost = config.remoteHost;
    this.defaultRemotePort = config.remotePort;
  }

  start(): void {
    if (this.server) return;

    this.server = net.createServer((clientSocket) => {
      this.handleClientConnection(clientSocket);
    });

    this.server.listen(this.config.listenPort, '127.0.0.1', () => {
      this._isListening = true;
      console.log(`[Proxy] Listening on 127.0.0.1:${this.config.listenPort}`);
    });

    this.server.on('error', (err) => {
      console.error('[Proxy] Server error:', err.message);
      this.emit('error', err);
    });
  }

  stop(): void {
    for (const conn of this.connections) {
      conn.dispose();
    }
    this.connections = [];
    this.server?.close();
    this.server = null;
    this._isListening = false;
    this.pendingRedirects = [];
  }

  isListening(): boolean {
    return this._isListening;
  }

  isConnected(): boolean {
    return this.connections.length > 0;
  }

  /** Get the most recent active connection (for merchant engine) */
  getActiveConnection(): ProxyConnection | null {
    return this.connections[this.connections.length - 1] || null;
  }

  private async handleClientConnection(clientSocket: net.Socket): Promise<void> {
    console.log('[Proxy] Client connected');

    // Brand new connection — fresh crypto, fresh state (like Arbiter)
    const connection = new ProxyConnection(clientSocket, this.config.listenPort);
    this.connections.push(connection);

    // Determine where to connect: pending redirect or default
    const pendingRedirect = this.pendingRedirects.shift();
    const remoteHost = pendingRedirect ? pendingRedirect.host : this.defaultRemoteHost;
    const remotePort = pendingRedirect ? pendingRedirect.port : this.defaultRemotePort;

    if (pendingRedirect) {
      console.log(`[Proxy] Using pending redirect: ${remoteHost}:${remotePort}`);
      // Propagate credentials from the login connection so they survive redirect
      if (pendingRedirect.username) connection.connectionState.username = pendingRedirect.username;
      if (pendingRedirect.password) connection.connectionState.password = pendingRedirect.password;
    }

    // Wire up events
    connection.on('packet', (direction: string, opCode: number, data: Uint8Array) => {
      this.emit('packet', direction, opCode, data, connection);
    });

    connection.on('redirect', (host: string, port: number) => {
      console.log(`[Proxy] Queuing redirect target: ${host}:${port}`);
      // Carry credentials from the login connection to the game server connection
      const { username, password } = connection.connectionState;
      this.pendingRedirects.push({ host, port, username: username || undefined, password: password || undefined });
    });

    connection.on('disposed', () => {
      const idx = this.connections.indexOf(connection);
      if (idx !== -1) this.connections.splice(idx, 1);
      this.emit('disconnection', connection);
    });

    try {
      await connection.connectToRemote(remoteHost, remotePort);
      this.emit('connection');
      connection.startForwarding();
    } catch (err: any) {
      console.error(`[Proxy] Failed to connect to ${remoteHost}:${remotePort}:`, err.message);
      connection.dispose();
    }
  }
}
