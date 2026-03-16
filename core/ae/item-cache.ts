import { AeApiClient } from './ae-api-client';
import * as db from '../db/database';

export interface AeItem {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  image_url: string | null;
  aliases: string[];
}

export interface SearchResult {
  name: string;
  slug: string;
  id: string;
  category: string | null;
}

interface SearchTerm {
  term: string;
  canonical: string;
  slug: string;
  id: string;
  category: string | null;
}

export class ItemCache {
  private items: AeItem[] = [];
  private searchTerms: SearchTerm[] = [];
  private itemsByName: Map<string, AeItem> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly refreshIntervalMs = 30 * 60_000;

  constructor(private api: AeApiClient) {}

  /** Initialize: fetch from API, fallback to SQLite cache, start refresh timer. */
  async init(): Promise<void> {
    const fetched = await this.fetchFromApi();
    if (!fetched) {
      this.loadFromDb();
    }
    this.refreshTimer = setInterval(() => this.fetchFromApi(), this.refreshIntervalMs);
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Search & Lookup ─────────────────────────────────────

  searchItems(query: string, limit = 8): SearchResult[] {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    for (const term of this.searchTerms) {
      if (seen.has(term.id)) continue;
      if (term.term.toLowerCase().includes(q)) {
        seen.add(term.id);
        results.push({ name: term.canonical, slug: term.slug, id: term.id, category: term.category });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  resolveItemName(input: string): { canonical: string; slug: string; id: string } | null {
    const normalized = input.toLowerCase().trim();
    for (const term of this.searchTerms) {
      if (term.term.toLowerCase() === normalized) {
        return { canonical: term.canonical, slug: term.slug, id: term.id };
      }
    }
    return null;
  }

  getItemByName(name: string): AeItem | undefined {
    if (!this.itemsByName) {
      this.itemsByName = new Map(this.items.map(i => [i.name.toLowerCase(), i]));
    }
    return this.itemsByName.get(name.toLowerCase());
  }

  getItemCount(): number {
    return this.items.length;
  }

  // ── Internal ────────────────────────────────────────────

  private async fetchFromApi(): Promise<boolean> {
    const result = await this.api.get<{ data: AeItem[] }>('/items');
    if (result.data?.data && result.data.data.length > 0) {
      this.setItems(result.data.data);
      this.persistToDb(result.data.data);
      return true;
    }
    return false;
  }

  private loadFromDb(): void {
    try {
      const items = db.getAeItems();
      if (items.length > 0) {
        this.setItems(items);
        console.log(`[ItemCache] Loaded ${items.length} items from local cache`);
      }
    } catch (err) {
      console.error('[ItemCache] Failed to load from DB:', err);
    }
  }

  private persistToDb(items: AeItem[]): void {
    try {
      db.replaceAeItems(items);
      console.log(`[ItemCache] Persisted ${items.length} items to local cache`);
    } catch (err) {
      console.error('[ItemCache] Failed to persist to DB:', err);
    }
  }

  private setItems(items: AeItem[]): void {
    this.items = items;
    this.itemsByName = null;
    this.searchTerms = this.buildSearchTerms(items);
    console.log(`[ItemCache] Loaded ${items.length} items, ${this.searchTerms.length} search terms`);
  }

  /** Port of AE's buildSearchTerms — names + aliases, sorted by term length descending. */
  private buildSearchTerms(items: AeItem[]): SearchTerm[] {
    const results: SearchTerm[] = [];

    for (const item of items) {
      const base = { canonical: item.name, slug: item.slug, id: item.id, category: item.category };
      results.push({ term: item.name, ...base });

      if (item.aliases) {
        for (const alias of item.aliases) {
          if (alias) {
            results.push({ term: alias, ...base });
          }
        }
      }
    }

    return results.sort((a, b) => b.term.length - a.term.length);
  }
}
