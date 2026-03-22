import { EventEmitter } from 'events';

export interface ReconnectEntry {
  characterName: string;
  username: string;
  password: string;
  attempt: number;
  state: 'waiting' | 'launching' | 'connected' | 'cancelled';
  /** Timestamp when the next attempt will fire */
  nextAttemptAt: number;
}

export interface ReconnectStatusEvent {
  characterName: string;
  attempt: number;
  state: 'waiting' | 'launching' | 'connected' | 'cancelled' | 'failed';
  delay: number;
}

type LaunchFn = (username: string, password: string) => Promise<{ success: boolean; processId?: number; error?: string }>;

const BACKOFF_DELAYS = [5_000, 15_000, 30_000, 30_000];

/**
 * Manages automatic reconnection after server disconnects.
 * Queues characters and processes them sequentially with backoff.
 */
export class ReconnectManager extends EventEmitter {
  private entries = new Map<string, ReconnectEntry>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private launchFn: LaunchFn;

  /** Characters queued for sequential processing */
  private queue: string[] = [];
  private processing = false;

  constructor(launchFn: LaunchFn) {
    super();
    this.launchFn = launchFn;
  }

  scheduleReconnect(characterName: string, username: string, password: string): void {
    // Don't duplicate
    if (this.entries.has(characterName)) return;

    const entry: ReconnectEntry = {
      characterName,
      username,
      password,
      attempt: 0,
      state: 'waiting',
      nextAttemptAt: 0,
    };
    this.entries.set(characterName, entry);
    this.queue.push(characterName);

    console.log(`[Reconnect] Queued ${characterName} for reconnection`);
    this.emitStatus(characterName, 'waiting', 0);
    this.processQueue();
  }

  cancelReconnect(characterName: string): void {
    const entry = this.entries.get(characterName);
    if (!entry) return;

    entry.state = 'cancelled';
    const timer = this.timers.get(characterName);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(characterName);
    }
    this.entries.delete(characterName);
    this.queue = this.queue.filter((n) => n !== characterName);

    console.log(`[Reconnect] Cancelled reconnect for ${characterName}`);
    this.emitStatus(characterName, 'cancelled', 0);
  }

  cancelAll(): void {
    for (const name of [...this.entries.keys()]) {
      this.cancelReconnect(name);
    }
    this.processing = false;
  }

  onCharacterConnected(characterName: string): void {
    const entry = this.entries.get(characterName);
    if (!entry) return;

    entry.state = 'connected';
    const timer = this.timers.get(characterName);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(characterName);
    }
    this.entries.delete(characterName);

    console.log(`[Reconnect] ${characterName} reconnected successfully`);
    this.emitStatus(characterName, 'connected', 0);

    // Process next in queue after a short gap
    setTimeout(() => this.processQueue(), 5000);
  }

  isReconnecting(characterName?: string): boolean {
    if (characterName) return this.entries.has(characterName);
    return this.entries.size > 0;
  }

  /** Get credentials for the character currently being reconnected */
  getReconnectingCredentials(characterName: string): { username: string; password: string } | null {
    const entry = this.entries.get(characterName);
    if (!entry) return null;
    return { username: entry.username, password: entry.password };
  }

  /** Get the character name currently in 'launching' state (for matching new connections) */
  getCurrentlyLaunching(): string | null {
    for (const [name, entry] of this.entries) {
      if (entry.state === 'launching') return name;
    }
    return null;
  }

  getState(): ReconnectStatusEvent[] {
    const result: ReconnectStatusEvent[] = [];
    for (const entry of this.entries.values()) {
      result.push({
        characterName: entry.characterName,
        attempt: entry.attempt,
        state: entry.state,
        delay: Math.max(0, entry.nextAttemptAt - Date.now()),
      });
    }
    return result;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    const characterName = this.queue.shift()!;
    const entry = this.entries.get(characterName);

    if (!entry || entry.state === 'cancelled') {
      this.processing = false;
      this.processQueue();
      return;
    }

    await this.attemptReconnect(characterName);
  }

  private async attemptReconnect(characterName: string): Promise<void> {
    const entry = this.entries.get(characterName);
    if (!entry || entry.state === 'cancelled') {
      this.processing = false;
      this.processQueue();
      return;
    }

    entry.attempt++;
    const delay = BACKOFF_DELAYS[Math.min(entry.attempt - 1, BACKOFF_DELAYS.length - 1)];
    entry.state = 'waiting';
    entry.nextAttemptAt = Date.now() + delay;

    console.log(`[Reconnect] ${characterName} attempt ${entry.attempt} in ${delay / 1000}s`);
    this.emitStatus(characterName, 'waiting', delay);

    this.timers.set(characterName, setTimeout(async () => {
      this.timers.delete(characterName);

      // Check if still active
      const current = this.entries.get(characterName);
      if (!current || current.state === 'cancelled') {
        this.processing = false;
        this.processQueue();
        return;
      }

      current.state = 'launching';
      this.emitStatus(characterName, 'launching', 0);

      try {
        const result = await this.launchFn(current.username, current.password);
        if (!result.success) {
          console.log(`[Reconnect] Launch failed for ${characterName}: ${result.error}`);
          this.emitStatus(characterName, 'failed', 0);
          // Retry — the server may still be down, connectToRemote will fail,
          // and the disconnection handler will NOT re-queue (we're still in entries).
          // So we schedule the next attempt ourselves.
          await this.attemptReconnect(characterName);
        }
        // If launch succeeded, we wait for either:
        // 1. onCharacterConnected() — success, processes next in queue
        // 2. The proxy connection fails (server still down) — the disconnect handler
        //    in main.ts will call scheduleRetry() which re-queues this character
      } catch (err: any) {
        console.error(`[Reconnect] Launch error for ${characterName}:`, err.message);
        this.emitStatus(characterName, 'failed', 0);
        await this.attemptReconnect(characterName);
      }
    }, delay));
  }

  /**
   * Called when a reconnecting character's connection fails (server still down).
   * Re-queues the character for another attempt without resetting the entry.
   */
  scheduleRetry(characterName: string): void {
    const entry = this.entries.get(characterName);
    if (!entry || entry.state === 'cancelled') return;

    this.processing = false;
    this.attemptReconnect(characterName);
  }

  private emitStatus(characterName: string, state: ReconnectStatusEvent['state'], delay: number): void {
    const entry = this.entries.get(characterName);
    this.emit('status', {
      characterName,
      attempt: entry?.attempt ?? 0,
      state,
      delay,
    } satisfies ReconnectStatusEvent);
  }
}
