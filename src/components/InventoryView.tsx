import { useState } from 'react';
import { Coins, Package } from 'lucide-react';

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
  items: InventoryItem[];
  gold: number;
  onItemClick?: (item: InventoryItem) => void;
}

export default function InventoryView({ items, gold, onItemClick }: Props) {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const slots = Array.from({ length: 60 }, (_, i) => {
    return items.find((item) => item.slot === i + 1);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="section-header" style={{ marginBottom: 0 }}>
          <Package size={16} className="section-icon" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }} className="gold-text">Inventory</h3>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
            ({items.length}/60)
          </span>
        </div>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 16,
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.15)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-warning)',
        }}>
          <Coins size={12} />
          {formatGold(gold)}
        </span>
      </div>
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: 'repeat(15, 1fr)',
          background: 'var(--color-surface-500)',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-surface-500)',
        }}
      >
        {slots.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-center relative aspect-square"
            style={{
              background: hoveredSlot === i && item
                ? 'var(--color-surface-400)'
                : item
                  ? 'var(--color-surface-100)'
                  : 'var(--color-surface-200)',
              cursor: item && onItemClick ? 'pointer' : 'default',
              transition: 'all 150ms ease',
              borderRadius: 2,
              boxShadow: hoveredSlot === i && item
                ? 'inset 0 0 0 1px var(--color-border-hover), 0 0 8px var(--color-gold-glow)'
                : 'none',
            }}
            title={item ? `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}${item.isStackable ? ' [stackable]' : ''} — click to list` : `Slot ${i + 1}`}
            onClick={() => item && onItemClick?.(item)}
            onMouseEnter={() => setHoveredSlot(i)}
            onMouseLeave={() => setHoveredSlot(null)}
          >
            {item && (
              <>
                <img
                  src={`items/${item.sprite > 32768 ? item.sprite - 32768 : item.sprite}.png`}
                  alt={item.name}
                  draggable={false}
                  style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '100%' }}
                  onLoad={(e) => {
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'none';
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = '';
                  }}
                />
                <span
                  className="absolute inset-0 flex items-center justify-center text-center leading-tight p-0.5 overflow-hidden"
                  style={{
                    color: 'var(--color-text-primary)',
                    fontSize: '7px',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                  }}
                >
                  {item.name}
                </span>
                {item.quantity > 1 && (
                  <span
                    className="absolute bottom-0 right-0.5 font-bold leading-none"
                    style={{
                      fontSize: '9px',
                      color: 'var(--color-gold-400)',
                      textShadow: '0 0 3px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.8)',
                    }}
                  >
                    {item.quantity > 999 ? Math.floor(item.quantity / 1000) + 'k' : item.quantity}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>
        Click an item to create a listing
      </p>
    </div>
  );
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}
