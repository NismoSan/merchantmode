import { EventEmitter } from 'events';
import * as db from '../db/database';

export interface AeUser {
  id: string;
  username: string;
  verified: boolean;
}

export interface AeAuthStatus {
  loggedIn: boolean;
  username?: string;
  verified?: boolean;
}

export interface AeResult<T = any> {
  data?: T;
  error?: string;
}

export class AeApiClient extends EventEmitter {
  private baseUrl = 'https://api.aislingexchange.com/api';
  private token: string | null = null;
  private username: string | null = null;
  private verified = false;

  /** Rate-limiter: sliding window of recent request timestamps per path prefix */
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute = 20;

  constructor() {
    super();
    // Restore persisted auth
    try {
      this.token = db.getSetting('ae_auth_token', '') || null;
      this.username = db.getSetting('ae_username', '') || null;
    } catch {
      // DB might not be ready yet on first call — will retry in init()
    }
  }

  /** Call after DB is ready to restore auth and validate the stored token. */
  async init(): Promise<void> {
    try {
      this.token = db.getSetting('ae_auth_token', '') || null;
      this.username = db.getSetting('ae_username', '') || null;
    } catch { /* ignore */ }

    if (this.token) {
      const result = await this.getMe();
      if (result.error) {
        // Token expired or invalid — clear silently
        this.clearAuth();
      }
    }
  }

  // ── Auth ──────────────────────────────────────────────────

  async login(username: string, password: string): Promise<AeResult<AeUser>> {
    const result = await this.post<{ token: string; user: AeUser }>('/auth/login', { username, password });
    if (result.data) {
      this.token = result.data.token;
      this.username = result.data.user.username;
      this.verified = result.data.user.verified;
      db.setSetting('ae_auth_token', this.token);
      db.setSetting('ae_username', this.username);
      this.emit('authChanged', this.getAuthStatus());
      return { data: result.data.user };
    }
    return { error: result.error || 'Login failed' };
  }

  logout(): void {
    this.clearAuth();
    this.emit('authChanged', this.getAuthStatus());
  }

  async getMe(): Promise<AeResult<AeUser>> {
    if (!this.token) return { error: 'Not logged in' };
    const result = await this.get<{ user: AeUser }>('/auth/me');
    if (result.data?.user) {
      this.username = result.data.user.username;
      this.verified = result.data.user.verified;
      return { data: result.data.user };
    }
    return { error: result.error || 'Failed to fetch user' };
  }

  getAuthStatus(): AeAuthStatus {
    return {
      loggedIn: !!this.token,
      username: this.username || undefined,
      verified: this.verified || undefined,
    };
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  // ── Generic HTTP ──────────────────────────────────────────

  async get<T>(path: string, query?: Record<string, string>): Promise<AeResult<T>> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<AeResult<T>> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<AeResult<T>> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async del<T>(path: string): Promise<AeResult<T>> {
    return this.request<T>(`${this.baseUrl}${path}`, { method: 'DELETE' });
  }

  // ── Internal ──────────────────────────────────────────────

  private async request<T>(url: string, init: RequestInit): Promise<AeResult<T>> {
    // Simple rate limiting
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60_000);
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      return { error: 'Rate limit exceeded — try again shortly' };
    }
    this.requestTimestamps.push(now);

    // Attach auth header
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(url, { ...init, headers, signal: controller.signal });
      clearTimeout(timeout);

      if (res.status === 401) {
        this.clearAuth();
        this.emit('authExpired');
        this.emit('authChanged', this.getAuthStatus());
        return { error: 'Session expired — please log in again' };
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { error: (body as any)?.error || `HTTP ${res.status}` };
      }

      // Some endpoints return empty body (204)
      if (res.status === 204) return { data: undefined as any };

      const data = await res.json();
      return { data: data as T };
    } catch (err: any) {
      if (err.name === 'AbortError') return { error: 'Request timed out' };
      return { error: err.message || 'Network error' };
    }
  }

  private clearAuth(): void {
    this.token = null;
    this.username = null;
    this.verified = false;
    try {
      db.setSetting('ae_auth_token', '');
      db.setSetting('ae_username', '');
    } catch { /* ignore if DB closed */ }
  }
}
