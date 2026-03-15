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
    INSERT INTO listings (id, character_name, type, item_name, price, quantity, quantity_remaining, status, wanted_items, offered_items, notes, stack_size, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    listing.createdAt,
    listing.updatedAt,
  );
}

export function updateListing(listing: MerchantListing): void {
  getDb().prepare(`
    UPDATE listings SET character_name=?, type=?, item_name=?, price=?, quantity=?, quantity_remaining=?, status=?, wanted_items=?, offered_items=?, notes=?, stack_size=?, updated_at=?
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
    INSERT INTO transactions (id, listing_id, counterparty_name, type, items_given, items_received, gold_given, gold_received, status, reason, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tx.id,
    tx.listingId,
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
