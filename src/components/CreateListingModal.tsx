import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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

  useEffect(() => {
    setType('SELL');
    setItemName(prefillItem.name);
    setQuantity(prefillItem.quantity.toString());
    setSellStack(prefillItem.isStackable && prefillItem.quantity > 1);
    setStackSize(prefillItem.isStackable && prefillItem.quantity > 1 ? prefillItem.quantity.toString() : '');
  }, [prefillItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const api = window.merchantMode?.listings;
    if (!api || !itemName.trim()) return;

    const parsedPrice = parsePrice(price);
    const parsedQty = parseInt(quantity) || 1;

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

    onCreated();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card w-full max-w-md mx-4 animate-fade-in"
        style={{
          border: '1px solid var(--color-surface-500)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3" style={{ borderBottom: '1px solid var(--color-surface-500)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-gold-400)' }}>
            Create Listing
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md"
            style={{ color: 'var(--color-text-tertiary)', transition: 'color 200ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
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

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 rounded-md text-xs"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary px-4 py-2 rounded-md text-xs">
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
