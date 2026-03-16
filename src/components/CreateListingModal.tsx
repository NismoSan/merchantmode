import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import ItemAutocomplete from './ItemAutocomplete';

export interface PrefillItem {
  name: string;
  quantity: number;
  isStackable: boolean;
}

interface Props {
  characterName: string;
  prefillItem: PrefillItem;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateListingModal({ characterName, prefillItem, onClose, onCreated }: Props) {
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

  useEffect(() => {
    setType('SELL');
    setItemName(prefillItem.name);
    setQuantity(prefillItem.quantity.toString());
    setSellStack(prefillItem.isStackable && prefillItem.quantity > 1);
    setStackSize(prefillItem.isStackable && prefillItem.quantity > 1 ? prefillItem.quantity.toString() : '');
    setPrice('');
    setNotes('');
    setWantedItem('');
    setWantedQty('1');
    setTradeRepeats('1');
  }, [prefillItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const api = window.merchantMode?.listings;
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

    onCreated();
    onClose();
  }

  const typeColors = {
    SELL: { bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.3)', color: 'var(--color-success)' },
    BUY: { bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)', color: '#60a5fa' },
    TRADE: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', color: 'var(--color-warning)' },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 animate-slide-up"
        style={{
          borderRadius: 14,
          background: 'var(--color-surface-300)',
          border: '1px solid var(--color-surface-500)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(201,168,76,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--color-gold-400), transparent)',
        }} />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 14px',
            borderBottom: '1px solid var(--color-surface-500)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={16} style={{ color: 'var(--color-gold-400)' }} />
            <h3 style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #dbb85e, #c9a84c)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Create Listing
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 4,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.background = 'var(--color-surface-400)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-tertiary)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px 20px' }} className="space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            {(['SELL', 'BUY', 'TRADE'] as const).map((t) => {
              const isSelected = type === t;
              const tc = typeColors[t];
              return (
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
                    background: isSelected
                      ? 'linear-gradient(135deg, #dbb85e, #b8973e)'
                      : 'var(--color-surface-200)',
                    color: isSelected ? 'var(--color-surface-50)' : 'var(--color-text-secondary)',
                    border: isSelected ? 'none' : '1px solid var(--color-surface-500)',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {type === 'TRADE' ? (
            <div className="space-y-2">
              <p className="stat-label" style={{ margin: 0 }}>You give</p>
              <div className="flex gap-2">
                <ItemAutocomplete
                  value={itemName}
                  onChange={setItemName}
                  placeholder="Item you are offering"
                  className="input-field flex-1"
                  autoFocus
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
              <p className="stat-label" style={{ margin: 0 }}>You receive</p>
              <div className="flex gap-2">
                <ItemAutocomplete
                  value={wantedItem}
                  onChange={setWantedItem}
                  placeholder="Item you want in return"
                  className="input-field flex-1"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={wantedQty}
                  onChange={(e) => setWantedQty(e.target.value)}
                  min="1"
                  className="input-field w-20"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="stat-label" style={{ margin: 0 }}>Repeat</span>
                <input
                  type="number"
                  value={tradeRepeats}
                  onChange={(e) => setTradeRepeats(e.target.value)}
                  min="1"
                  className="input-field w-20 py-1"
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  {parseInt(tradeRepeats) > 1 ? 'times' : 'time (closes after trade)'}
                </span>
              </div>
            </div>
          ) : (
            <>
              <ItemAutocomplete
                value={itemName}
                onChange={setItemName}
                placeholder="Item name"
                className="input-field block w-full"
                autoFocus
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
            </>
          )}

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
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>per trade</span>
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

          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
            <input
              type="checkbox"
              checked={syncToAe}
              onChange={(e) => setSyncToAe(e.target.checked)}
              style={{ accentColor: 'var(--color-gold-400)' }}
            />
            Sync to AislingExchange
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2.5 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary px-5 py-2.5 rounded-lg text-xs">
              Create Listing
            </button>
          </div>
        </form>
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
