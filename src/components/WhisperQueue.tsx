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
        <div className="flex flex-col items-center gap-2 py-6">
          <MessageCircle size={32} style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No incoming whispers.</p>
        </div>
      )}
      {whispers.map((w, i) => {
        const hasMatch = !!w.matchedListing;
        const accentColor = hasMatch ? 'var(--color-success)' : 'var(--color-danger)';

        return (
          <div
            key={`${w.playerName}-${w.timestamp}-${i}`}
            className="card-inset flex items-start gap-3 p-2 relative overflow-hidden"
          >
            {/* Left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{ width: 3, background: accentColor, borderRadius: '3px 0 0 3px' }}
            />
            <div className="flex-1 min-w-0 pl-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-gold-400)' }}>
                  {w.playerName}
                </span>
                <span className="text-xs shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                  {new Date(w.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                {w.message}
              </p>
              {w.matchedListing && (
                <span
                  className="badge mt-1"
                  style={{ background: '#22c55e20', color: 'var(--color-success)' }}
                >
                  <Check size={12} />
                  Matched: {w.matchedListing.itemName} ({formatGold(w.matchedListing.price)})
                </span>
              )}
              {!w.matchedListing && (
                <span
                  className="badge mt-1"
                  style={{ background: '#f8717120', color: 'var(--color-danger)' }}
                >
                  <X size={12} />
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
