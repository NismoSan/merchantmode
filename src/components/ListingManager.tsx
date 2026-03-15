import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

interface Listing {
  id: string;
  type: 'BUY' | 'SELL' | 'TRADE';
  itemName: string;
  price: number;
  quantity: number;
  quantityRemaining: number;
  status: 'ACTIVE' | 'SOLD_OUT' | 'PAUSED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  stackSize?: number;
}

export interface PrefillItem {
  name: string;
  quantity: number;
  isStackable: boolean;
}

interface InventoryItem {
  slot: number;
  sprite: number;
  color: number;
  name: string;
  quantity: number;
  isStackable: boolean;
  maxDurability: number;
  durability: number;
}

interface Props {
  listings: Listing[];
  onRefresh: () => void;
  characterName: string;
  prefillItem?: PrefillItem | null;
  onPrefillConsumed?: () => void;
  inventory?: InventoryItem[];
}

function getSpriteUrl(itemName: string, inventory?: InventoryItem[]): string | null {
  if (!inventory) return null;
  const match = inventory.find((i) => i.name === itemName);
  if (!match) return null;
  const id = match.sprite > 32768 ? match.sprite - 32768 : match.sprite;
  return `items/${id}.png`;
}

export default function ListingManager({ listings, onRefresh, characterName, prefillItem, onPrefillConsumed, inventory }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [type, setType] = useState<'BUY' | 'SELL' | 'TRADE'>('SELL');
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [sellStack, setSellStack] = useState(false);
  const [stackSize, setStackSize] = useState('');

  const api = window.merchantMode?.listings;

  // Handle prefill from inventory click
  useEffect(() => {
    if (prefillItem) {
      resetForm();
      setType('SELL');
      setItemName(prefillItem.name);
      setQuantity(prefillItem.quantity.toString());
      setSellStack(prefillItem.isStackable && prefillItem.quantity > 1);
      setStackSize(prefillItem.isStackable && prefillItem.quantity > 1 ? prefillItem.quantity.toString() : '');
      setShowForm(true);
      onPrefillConsumed?.();
    }
  }, [prefillItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!api || !itemName.trim()) return;

    const parsedPrice = parsePrice(price);
    const parsedQty = parseInt(quantity) || 1;

    if (editId) {
      const existing = listings.find((l) => l.id === editId);
      if (existing) {
        await api.update({
          ...existing,
          characterName,
          type,
          itemName: itemName.trim(),
          price: parsedPrice,
          quantity: parsedQty,
          quantityRemaining: parsedQty,
          notes: notes.trim() || undefined,
          stackSize: sellStack ? (parseInt(stackSize) || 0) : undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      await api.create({
        id: crypto.randomUUID(),
        characterName,
        type,
        itemName: itemName.trim(),
        price: parsedPrice,
        quantity: parsedQty,
        quantityRemaining: parsedQty,
        status: 'ACTIVE',
        notes: notes.trim() || undefined,
        stackSize: sellStack ? (parseInt(stackSize) || 0) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    resetForm();
    onRefresh();
  }

  function startEdit(listing: Listing) {
    setEditId(listing.id);
    setType(listing.type);
    setItemName(listing.itemName);
    setPrice(formatPriceInput(listing.price));
    setQuantity(listing.quantity.toString());
    setNotes(listing.notes || '');
    setSellStack(!!listing.stackSize);
    setStackSize(listing.stackSize ? listing.stackSize.toString() : '');
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!api) return;
    await api.delete(id, characterName);
    onRefresh();
  }

  async function togglePause(listing: Listing) {
    if (!api) return;
    await api.update({
      ...listing,
      characterName,
      status: listing.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
      updatedAt: new Date().toISOString(),
    });
    onRefresh();
  }

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setType('SELL');
    setItemName('');
    setPrice('');
    setQuantity('1');
    setNotes('');
    setSellStack(false);
    setStackSize('');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="stat-label">
          Listings <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>({listings.filter((l) => l.status === 'ACTIVE').length} active)</span>
        </span>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className={`px-3 py-1 rounded-md text-xs font-medium ${showForm ? 'btn-secondary' : 'btn-primary'}`}
        >
          {showForm ? 'Cancel' : '+ New Listing'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card-inset p-3 space-y-2 animate-fade-in">
          <div className="flex gap-2">
            {(['SELL', 'BUY', 'TRADE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="px-3 py-1 rounded-md text-xs font-medium"
                style={{
                  background: type === t
                    ? 'linear-gradient(135deg, #dbb85e, #b8973e)'
                    : 'var(--color-surface-400)',
                  color: type === t ? 'var(--color-surface-50)' : 'var(--color-text-secondary)',
                  border: type === t ? 'none' : '1px solid var(--color-surface-500)',
                  transition: 'all 200ms ease',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Item name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="input-field block w-full"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Price (e.g. 500k, 1.5m)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input-field flex-1"
            />
            <input
              type="number"
              placeholder="Qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="input-field w-20"
            />
          </div>
          {type === 'SELL' && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={sellStack}
                  onChange={(e) => { setSellStack(e.target.checked); if (!e.target.checked) setStackSize(''); }}
                  className="rounded"
                  style={{ accentColor: 'var(--color-gold-400)' }}
                />
                Sell as stack
              </label>
              {sellStack && (
                <div className="flex items-center gap-2 pl-5">
                  <input
                    type="number"
                    placeholder="Stack size"
                    value={stackSize}
                    onChange={(e) => setStackSize(e.target.value)}
                    min="1"
                    className="input-field w-28 py-1"
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>per trade</span>
                </div>
              )}
            </div>
          )}
          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field block w-full"
          />
          <button type="submit" className="btn-primary px-4 py-2 rounded-md text-xs">
            {editId ? 'Update Listing' : 'Create Listing'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {listings.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6">
            <Package size={32} style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No listings yet.</p>
          </div>
        )}
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="card-inset flex items-center gap-3 p-3"
            style={{
              opacity: listing.status === 'PAUSED' ? 0.6 : 1,
              filter: listing.status === 'PAUSED' ? 'grayscale(0.3)' : 'none',
            }}
          >
            <span
              className="badge"
              style={{
                background: listing.type === 'SELL' ? '#22c55e20' : listing.type === 'BUY' ? '#3b82f620' : '#f59e0b20',
                color: listing.type === 'SELL' ? 'var(--color-success)' : listing.type === 'BUY' ? '#60a5fa' : 'var(--color-warning)',
              }}
            >
              {listing.type}
            </span>
            {(() => {
              const spriteUrl = getSpriteUrl(listing.itemName, inventory);
              return spriteUrl ? (
                <img
                  src={spriteUrl}
                  alt=""
                  style={{ imageRendering: 'pixelated', width: 28, height: 28, flexShrink: 0 }}
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : null;
            })()}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {listing.itemName}
                {listing.stackSize && (
                  <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--color-text-tertiary)' }}>[x{listing.stackSize}]</span>
                )}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {formatGold(listing.price)} | {listing.quantityRemaining}/{listing.quantity} remaining
                {listing.status === 'SOLD_OUT' && <span style={{ color: 'var(--color-danger)' }}> SOLD OUT</span>}
                {listing.status === 'PAUSED' && <span style={{ color: 'var(--color-warning)' }}> PAUSED</span>}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => togglePause(listing)}
                className="btn-secondary px-2 py-1 rounded-md text-xs"
              >
                {listing.status === 'PAUSED' ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={() => startEdit(listing)}
                className="btn-secondary px-2 py-1 rounded-md text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(listing.id)}
                className="px-2 py-1 rounded-md text-xs"
                style={{
                  background: '#dc262620',
                  color: 'var(--color-danger)',
                  border: '1px solid transparent',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-danger)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function parsePrice(input: string): number {
  const cleaned = input.trim().toLowerCase().replace(/,/g, '');
  const gbMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*gb$/);
  if (gbMatch) return Math.floor(parseFloat(gbMatch[1]) * 50_000_000);
  const suffixes: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  return Math.floor(val * (suffixes[match[2]] || 1));
}

function formatPriceInput(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000)}b`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000)}m`;
  if (amount >= 1_000) return `${(amount / 1_000)}k`;
  return amount.toString();
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toString();
}
