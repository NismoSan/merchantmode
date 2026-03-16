import { useState, useEffect } from 'react';
import { Package, Plus, X as XIcon, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import ItemAutocomplete from './ItemAutocomplete';

interface Listing {
  id: string;
  type: 'BUY' | 'SELL' | 'TRADE';
  itemName: string;
  price: number;
  quantity: number;
  quantityRemaining: number;
  status: 'ACTIVE' | 'SOLD_OUT' | 'PAUSED';
  wantedItems?: { name: string; quantity: number }[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  stackSize?: number;
  syncToAe?: boolean;
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
  const [wantedItem, setWantedItem] = useState('');
  const [wantedQty, setWantedQty] = useState('1');
  const [tradeRepeats, setTradeRepeats] = useState('1');
  const [syncToAe, setSyncToAe] = useState(true);

  const [syncStatuses, setSyncStatuses] = useState<Record<string, string>>({});

  const api = window.merchantMode?.listings;

  // Fetch sync statuses when listings change
  useEffect(() => {
    const ids = listings.map(l => l.id);
    if (ids.length === 0) return;
    window.merchantMode?.ae.getSyncStatuses(ids).then(setSyncStatuses).catch(() => {});
  }, [listings]);

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
    if (type === 'TRADE' && !wantedItem.trim()) return;

    const parsedPrice = parsePrice(price);
    const parsedQty = parseInt(quantity) || 1;
    const parsedWantedQty = parseInt(wantedQty) || 1;
    const parsedRepeats = parseInt(tradeRepeats) || 1;
    const tradeWanted = type === 'TRADE' && wantedItem.trim()
      ? [{ name: wantedItem.trim(), quantity: parsedWantedQty }]
      : undefined;

    const qty = parsedQty;
    const qtyRemaining = type === 'TRADE' ? parsedRepeats : parsedQty;

    if (editId) {
      const existing = listings.find((l) => l.id === editId);
      if (existing) {
        await api.update({
          ...existing,
          characterName,
          type,
          itemName: itemName.trim(),
          price: parsedPrice,
          quantity: qty,
          quantityRemaining: qtyRemaining,
          wantedItems: tradeWanted,
          notes: notes.trim() || undefined,
          stackSize: sellStack ? (parseInt(stackSize) || 0) : undefined,
          syncToAe,
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
        quantity: qty,
        quantityRemaining: qtyRemaining,
        status: 'ACTIVE',
        wantedItems: tradeWanted,
        notes: notes.trim() || undefined,
        stackSize: sellStack ? (parseInt(stackSize) || 0) : undefined,
        syncToAe,
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
    setWantedItem(listing.wantedItems?.[0]?.name || '');
    setWantedQty(listing.wantedItems?.[0]?.quantity?.toString() || '1');
    setTradeRepeats(listing.type === 'TRADE' ? listing.quantityRemaining.toString() : '1');
    setSyncToAe(listing.syncToAe !== false);
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
    setWantedItem('');
    setWantedQty('1');
    setTradeRepeats('1');
    setSyncToAe(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <Package size={16} className="section-icon" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }} className="gold-text">Listings</h3>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
            ({listings.filter((l) => l.status === 'ACTIVE').length} active)
          </span>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className={showForm ? 'btn-secondary' : 'btn-primary'}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {showForm ? (
            <><XIcon size={13} /> Cancel</>
          ) : (
            <><Plus size={13} /> New Listing</>
          )}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="animate-slide-up" style={{
          padding: '16px 18px',
          borderRadius: 10,
          background: 'var(--color-surface-200)',
          border: '1px solid var(--color-surface-500)',
        }}>
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['SELL', 'BUY', 'TRADE'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    background: type === t
                      ? 'linear-gradient(135deg, #dbb85e, #b8973e)'
                      : 'var(--color-surface-400)',
                    color: type === t ? 'var(--color-surface-50)' : 'var(--color-text-secondary)',
                    border: type === t ? 'none' : '1px solid var(--color-surface-500)',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {type === 'TRADE' ? (
              <div className="space-y-2">
                <p className="stat-label" style={{ margin: 0 }}>You give</p>
                <div className="flex gap-2">
                  <ItemAutocomplete value={itemName} onChange={setItemName} placeholder="Item you are offering" className="input-field flex-1" />
                  <input type="number" placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" className="input-field w-20" />
                </div>
                <p className="stat-label" style={{ margin: 0 }}>You receive</p>
                <div className="flex gap-2">
                  <ItemAutocomplete value={wantedItem} onChange={setWantedItem} placeholder="Item you want in return" className="input-field flex-1" />
                  <input type="number" placeholder="Qty" value={wantedQty} onChange={(e) => setWantedQty(e.target.value)} min="1" className="input-field w-20" />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="stat-label" style={{ margin: 0 }}>Repeat</span>
                  <input type="number" value={tradeRepeats} onChange={(e) => setTradeRepeats(e.target.value)} min="1" className="input-field w-20 py-1" />
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {parseInt(tradeRepeats) > 1 ? 'times' : 'time (closes after trade)'}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <ItemAutocomplete value={itemName} onChange={setItemName} placeholder="Item name" className="input-field block w-full" />
                <div className="flex gap-2">
                  <input type="text" placeholder="Price (e.g. 500k, 1.5m)" value={price} onChange={(e) => setPrice(e.target.value)} className="input-field flex-1" />
                  <input type="number" placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" className="input-field w-20" />
                </div>
              </>
            )}
            {type === 'SELL' && (
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
                  <input type="checkbox" checked={sellStack} onChange={(e) => { setSellStack(e.target.checked); if (!e.target.checked) setStackSize(''); }} style={{ accentColor: 'var(--color-gold-400)' }} />
                  Sell as stack
                </label>
                {sellStack && (
                  <div className="flex items-center gap-2 pl-5">
                    <input type="number" placeholder="Stack size" value={stackSize} onChange={(e) => setStackSize(e.target.value)} min="1" className="input-field w-28 py-1" />
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>per trade</span>
                  </div>
                )}
              </div>
            )}
            <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field block w-full" />
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <input
                type="checkbox"
                checked={syncToAe}
                onChange={(e) => setSyncToAe(e.target.checked)}
                style={{ accentColor: 'var(--color-gold-400)' }}
              />
              Sync to AislingExchange
            </label>
            <button type="submit" className="btn-primary px-5 py-2.5 rounded-lg text-xs w-full">
              {editId ? 'Update Listing' : 'Create Listing'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {listings.length === 0 && (
          <div className="empty-state" style={{ paddingTop: 32, paddingBottom: 32 }}>
            <div className="empty-state-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <Package size={20} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)' }}>No listings yet.</p>
          </div>
        )}
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="card-inset listing-row flex items-center gap-3 p-3"
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
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: 'var(--color-surface-300)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <img
                    src={spriteUrl}
                    alt=""
                    style={{ imageRendering: 'pixelated', width: 28, height: 28 }}
                    draggable={false}
                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              ) : null;
            })()}
            <div className="flex-1 min-w-0">
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }} className="truncate">
                {listing.type === 'TRADE' ? (
                  <>
                    {listing.quantity > 1 ? `${listing.quantity}x ` : ''}{listing.itemName}
                    {listing.wantedItems?.[0] && (
                      <span style={{ color: 'var(--color-warning)' }}>
                        {' '}&#8594;{' '}
                      </span>
                    )}
                    {listing.wantedItems?.[0] && (
                      <>
                        {listing.wantedItems[0].quantity > 1 ? `${listing.wantedItems[0].quantity}x ` : ''}{listing.wantedItems[0].name}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {listing.itemName}
                    {listing.stackSize && (
                      <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>[x{listing.stackSize}]</span>
                    )}
                  </>
                )}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                {listing.type === 'TRADE'
                  ? `${listing.quantityRemaining} trade${listing.quantityRemaining !== 1 ? 's' : ''} remaining`
                  : <>{formatGold(listing.price)} | {listing.quantityRemaining}/{listing.quantity} remaining</>
                }
                {listing.status === 'SOLD_OUT' && <span style={{ color: 'var(--color-danger)' }}> {listing.type === 'TRADE' ? 'COMPLETED' : 'SOLD OUT'}</span>}
                {listing.status === 'PAUSED' && syncStatuses[listing.id] === 'synced' && (
                  <span style={{ color: 'var(--color-warning)' }}> WAITING FOR INVENTORY</span>
                )}
                {listing.status === 'PAUSED' && syncStatuses[listing.id] !== 'synced' && (
                  <span style={{ color: 'var(--color-warning)' }}> PAUSED</span>
                )}
              </p>
            </div>
            <div className="flex gap-1.5 items-center">
              {syncStatuses[listing.id] === 'synced' && (
                <span title="Synced to AislingExchange"><CheckCircle size={13} style={{ color: 'var(--color-success)', opacity: 0.7 }} /></span>
              )}
              {syncStatuses[listing.id] === 'pending' && (
                <span title="Syncing to AislingExchange..."><Clock size={13} style={{ color: 'var(--color-warning)', opacity: 0.7 }} /></span>
              )}
              {syncStatuses[listing.id] === 'failed' && (
                <span
                  title="Sync failed — click to retry"
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.merchantMode?.ae.retrySync(listing.id)}
                >
                  <AlertTriangle size={13} style={{ color: 'var(--color-danger)', opacity: 0.7 }} />
                </span>
              )}
              <button
                onClick={() => togglePause(listing)}
                className="btn-secondary"
                style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11 }}
              >
                {listing.status === 'PAUSED' ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={() => startEdit(listing)}
                className="btn-secondary"
                style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11 }}
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(listing.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  background: 'rgba(220,38,38,0.08)',
                  color: 'var(--color-danger)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-danger)'; e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
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
