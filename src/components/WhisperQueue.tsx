import { MessageCircle, Check, X } from 'lucide-react';

interface Whisper {
  playerName: string;
  message: string;
  timestamp: number;
  matchedListing?: { itemName: string; price: number; type: string };
}

interface Props {
  whispers: Whisper[];
}

export default function WhisperQueue({ whispers }: Props) {
  return (
    <div className="space-y-2 overflow-y-auto max-h-96 pr-1">
      {whispers.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 32, paddingBottom: 32 }}>
          <div className="empty-state-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <MessageCircle size={20} style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)' }}>No incoming whispers.</p>
        </div>
      )}
      {whispers.map((w, i) => {
        const hasMatch = !!w.matchedListing;
        const accentColor = hasMatch ? 'var(--color-success)' : 'var(--color-danger)';

        return (
          <div
            key={`${w.playerName}-${w.timestamp}-${i}`}
            className="card-inset listing-row relative overflow-hidden"
            style={{ padding: '10px 12px 10px 15px' }}
          >
            {/* Left accent bar */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: accentColor,
                borderRadius: '3px 0 0 3px',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gold-400)' }}>
                {w.playerName}
              </span>
              <span style={{ fontSize: 11, flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
                {new Date(w.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-primary)' }}>
              {w.message}
            </p>
            <div style={{ marginTop: 6 }}>
              {w.matchedListing && (
                <span
                  className="badge"
                  style={{ background: '#22c55e15', color: 'var(--color-success)' }}
                >
                  <Check size={11} />
                  Matched: {w.matchedListing.itemName} ({formatGold(w.matchedListing.price)})
                </span>
              )}
              {!w.matchedListing && (
                <span
                  className="badge"
                  style={{ background: '#f8717115', color: 'var(--color-danger)' }}
                >
                  <X size={11} />
                  No match
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toString();
}
