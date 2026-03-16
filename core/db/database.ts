import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import type { MerchantListing } from '../models/listing';
import type { Transaction } from '../models/transaction';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'merchantmode.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL', 'TRADE')),
      item_name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      quantity_remaining INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'SOLD_OUT', 'PAUSED')),
      wanted_items TEXT,
      offered_items TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      listing_id TEXT,
      counterparty_name TEXT NOT NULL,
      type TEXT NOT NULL,
      items_given TEXT,
      items_received TEXT,
      gold_given INTEGER NOT NULL DEFAULT 0,
      gold_received INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      reason TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add character_name column to listings
  const version = getSchemaVersion(db);
  if (version < 1) {
    // Check if column already exists (safe for first run where table was just created)
    const cols = db.prepare("PRAGMA table_info(listings)").all() as any[];
    const hasCharName = cols.some((c: any) => c.name === 'character_name');
    if (!hasCharName) {
      db.exec("ALTER TABLE listings ADD COLUMN character_name TEXT NOT NULL DEFAULT ''");
    }
    setSchemaVersion(db, 1);
  }

  if (version < 2) {
    const cols = db.prepare("PRAGMA table_info(listings)").all() as any[];
    const hasStackSize = cols.some((c: any) => c.name === 'stack_size');
    if (!hasStackSize) {
      db.exec("ALTER TABLE listings ADD COLUMN stack_size INTEGER");
    }
    setSchemaVersion(db, 2);
  }

  if (version < 3) {
    const cols = db.prepare("PRAGMA table_info(transactions)").all() as any[];
    const hasCharName = cols.some((c: any) => c.name === 'character_name');
    if (!hasCharName) {
      db.exec("ALTER TABLE transactions ADD COLUMN character_name TEXT NOT NULL DEFAULT ''");
    }
    setSchemaVersion(db, 3);
  }

  // v4: AE item cache
  if (version < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ae_items (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        image_url TEXT,
        aliases TEXT,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    setSchemaVersion(db, 4);
  }

  // v5: AE listing sync mapping + retry queue
  if (version < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ae_listing_map (
        local_id TEXT PRIMARY KEY,
        ae_id TEXT NOT NULL,
        ae_item_id TEXT,
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS ae_sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL CHECK(operation IN ('CREATE','UPDATE','DELETE')),
        local_listing_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    setSchemaVersion(db, 5);
  }

  // v6: per-listing sync toggle
  if (version < 6) {
    const cols = db.prepare("PRAGMA table_info(listings)").all() as any[];
    const hasSyncCol = cols.some((c: any) => c.name === 'sync_to_ae');
    if (!hasSyncCol) {
      db.exec("ALTER TABLE listings ADD COLUMN sync_to_ae INTEGER NOT NULL DEFAULT 1");
    }
    setSchemaVersion(db, 6);
  }
}

function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key='schema_version'").get() as any;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").run(version.toString());
}

// --- Listings ---

export function getAllListings(characterName?: string): MerchantListing[] {
  if (characterName) {
    // Include legacy listings (empty character_name) along with character-specific ones
    const rows = getDb().prepare("SELECT * FROM listings WHERE character_name = ? OR character_name = '' ORDER BY created_at DESC").all(characterName) as any[];
    return rows.map(rowToListing);
  }
  const rows = getDb().prepare('SELECT * FROM listings ORDER BY created_at DESC').all() as any[];
  return rows.map(rowToListing);
}

export function getActiveListings(characterName?: string): MerchantListing[] {
  if (characterName) {
    const rows = getDb().prepare("SELECT * FROM listings WHERE status = 'ACTIVE' AND (character_name = ? OR character_name = '') ORDER BY created_at DESC").all(characterName) as any[];
    return rows.map(rowToListing);
  }
  const rows = getDb().prepare("SELECT * FROM listings WHERE status = 'ACTIVE' ORDER BY created_at DESC").all() as any[];
  return rows.map(rowToListing);
}

/**
 * Assign all legacy listings (empty character_name) to a specific character.
 */
export function claimUnassignedListings(characterName: string): void {
  getDb().prepare("UPDATE listings SET character_name = ? WHERE character_name = ''").run(characterName);
}

export function insertListing(listing: MerchantListing): void {
  getDb().prepare(`
    INSERT INTO listings (id, character_name, type, item_name, price, quantity, quantity_remaining, status, wanted_items, offered_items, notes, stack_size, sync_to_ae, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    listing.id,
    listing.characterName ?? '',
    listing.type,
    listing.itemName,
    listing.price,
    listing.quantity,
    listing.quantityRemaining,
    listing.status,
    listing.wantedItems ? JSON.stringify(listing.wantedItems) : null,
    listing.offeredItems ? JSON.stringify(listing.offeredItems) : null,
    listing.notes || null,
    listing.stackSize || null,
    listing.syncToAe === false ? 0 : 1,
    listing.createdAt,
    listing.updatedAt,
  );
}

export function updateListing(listing: MerchantListing): void {
  getDb().prepare(`
    UPDATE listings SET character_name=?, type=?, item_name=?, price=?, quantity=?, quantity_remaining=?, status=?, wanted_items=?, offered_items=?, notes=?, stack_size=?, sync_to_ae=?, updated_at=?
    WHERE id=?
  `).run(
    listing.characterName ?? '',
    listing.type,
    listing.itemName,
    listing.price,
    listing.quantity,
    listing.quantityRemaining,
    listing.status,
    listing.wantedItems ? JSON.stringify(listing.wantedItems) : null,
    listing.offeredItems ? JSON.stringify(listing.offeredItems) : null,
    listing.notes || null,
    listing.stackSize || null,
    listing.syncToAe === false ? 0 : 1,
    new Date().toISOString(),
    listing.id,
  );
}

export function deleteListing(id: string): void {
  getDb().prepare('DELETE FROM listings WHERE id=?').run(id);
}

function rowToListing(row: any): MerchantListing {
  return {
    id: row.id,
    characterName: row.character_name ?? '',
    type: row.type,
    itemName: row.item_name,
    price: row.price,
    quantity: row.quantity,
    quantityRemaining: row.quantity_remaining,
    status: row.status,
    wantedItems: row.wanted_items ? JSON.parse(row.wanted_items) : undefined,
    offeredItems: row.offered_items ? JSON.parse(row.offered_items) : undefined,
    notes: row.notes || undefined,
    stackSize: row.stack_size || undefined,
    syncToAe: row.sync_to_ae !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Transactions ---

export function getAllTransactions(): Transaction[] {
  const rows = getDb().prepare('SELECT * FROM transactions ORDER BY timestamp DESC').all() as any[];
  return rows.map(rowToTransaction);
}

export function getTransactionsByDate(startDate: string, endDate: string): Transaction[] {
  const rows = getDb().prepare('SELECT * FROM transactions WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC').all(startDate, endDate) as any[];
  return rows.map(rowToTransaction);
}

export function insertTransaction(tx: Transaction): void {
  getDb().prepare(`
    INSERT INTO transactions (id, listing_id, character_name, counterparty_name, type, items_given, items_received, gold_given, gold_received, status, reason, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tx.id,
    tx.listingId,
    tx.characterName ?? '',
    tx.counterpartyName,
    tx.type,
    JSON.stringify(tx.itemsGiven),
    JSON.stringify(tx.itemsReceived),
    tx.goldGiven,
    tx.goldReceived,
    tx.status,
    tx.reason || null,
    tx.timestamp,
  );
}

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    listingId: row.listing_id,
    characterName: row.character_name ?? '',
    counterpartyName: row.counterparty_name,
    type: row.type,
    itemsGiven: JSON.parse(row.items_given || '[]'),
    itemsReceived: JSON.parse(row.items_received || '[]'),
    goldGiven: row.gold_given,
    goldReceived: row.gold_received,
    status: row.status,
    reason: row.reason || undefined,
    timestamp: row.timestamp,
  };
}

// --- Settings ---

export function getSetting(key: string, defaultValue: string = ''): string {
  const row = getDb().prepare('SELECT value FROM settings WHERE key=?').get(key) as any;
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function closeDb(): void {
  db?.close();
  db = null;
}

// --- AE Item Cache ---

export interface AeItemRow {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  image_url: string | null;
  aliases: string[];
}

export function getAeItems(): AeItemRow[] {
  const rows = getDb().prepare('SELECT * FROM ae_items').all() as any[];
  return rows.map(r => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    image_url: r.image_url,
    aliases: r.aliases ? JSON.parse(r.aliases) : [],
  }));
}

export function replaceAeItems(items: AeItemRow[]): void {
  const d = getDb();
  const del = d.prepare('DELETE FROM ae_items');
  const ins = d.prepare('INSERT INTO ae_items (id, slug, name, category, image_url, aliases, fetched_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))');
  const tx = d.transaction(() => {
    del.run();
    for (const item of items) {
      ins.run(item.id, item.slug, item.name, item.category, item.image_url, JSON.stringify(item.aliases || []));
    }
  });
  tx();
}

// --- AE Listing Map ---

export function getAeListingMap(localId: string): { aeId: string; aeItemId: string | null } | null {
  const row = getDb().prepare('SELECT ae_id, ae_item_id FROM ae_listing_map WHERE local_id = ?').get(localId) as any;
  return row ? { aeId: row.ae_id, aeItemId: row.ae_item_id } : null;
}

export function setAeListingMap(localId: string, aeId: string, aeItemId: string | null): void {
  getDb().prepare('INSERT OR REPLACE INTO ae_listing_map (local_id, ae_id, ae_item_id, synced_at) VALUES (?, ?, ?, datetime(\'now\'))').run(localId, aeId, aeItemId);
}

export function deleteAeListingMap(localId: string): void {
  getDb().prepare('DELETE FROM ae_listing_map WHERE local_id = ?').run(localId);
}

// --- AE Sync Queue ---

export function enqueueAeSync(operation: string, localListingId: string, payload: string): void {
  // Replace any existing queue item for same listing+operation
  getDb().prepare('DELETE FROM ae_sync_queue WHERE local_listing_id = ? AND operation = ?').run(localListingId, operation);
  getDb().prepare('INSERT INTO ae_sync_queue (operation, local_listing_id, payload) VALUES (?, ?, ?)').run(operation, localListingId, payload);
}

export function getAeSyncQueue(): { id: number; operation: string; localListingId: string; payload: string; attempts: number }[] {
  const rows = getDb().prepare('SELECT * FROM ae_sync_queue WHERE attempts < 3 ORDER BY created_at ASC').all() as any[];
  return rows.map(r => ({
    id: r.id,
    operation: r.operation,
    localListingId: r.local_listing_id,
    payload: r.payload,
    attempts: r.attempts,
  }));
}

export function getAeSyncQueueItem(localListingId: string): { attempts: number } | null {
  const row = getDb().prepare('SELECT attempts FROM ae_sync_queue WHERE local_listing_id = ?').get(localListingId) as any;
  return row ? { attempts: row.attempts } : null;
}

export function removeAeSyncQueueItem(id: number): void {
  getDb().prepare('DELETE FROM ae_sync_queue WHERE id = ?').run(id);
}

export function bumpAeSyncQueueAttempt(id: number): void {
  getDb().prepare("UPDATE ae_sync_queue SET attempts = attempts + 1, last_attempt = datetime('now') WHERE id = ?").run(id);
}

export function resetAeSyncQueueItem(localListingId: string): void {
  getDb().prepare('UPDATE ae_sync_queue SET attempts = 0 WHERE local_listing_id = ?').run(localListingId);
}
