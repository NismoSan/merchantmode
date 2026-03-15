import { Download, Receipt } from 'lucide-react';

interface Transaction {
  id: string;
  listingId: string;
  counterpartyName: string;
  type: 'BUY' | 'SELL' | 'TRADE';
  itemsGiven: { name: string; quantity: number }[];
  itemsReceived: { name: string; quantity: number }[];
  goldGiven: number;
  goldReceived: number;
  status: string;
  reason?: string;
  timestamp: string;
}

interface Props {
  transactions: Transaction[];
}

export default function TransactionLog({ transactions }: Props) {
  function exportCsv() {
    const header = 'Time,Type,Counterparty,Items Given,Items Received,Gold Given,Gold Received,Status\n';
    const rows = transactions.map((tx) =>
      [
        tx.timestamp,
        tx.type,
        tx.counterpartyName,
        tx.itemsGiven.map((i) => `${i.name} x${i.quantity}`).join('; '),
        tx.itemsReceived.map((i) => `${i.name} x${i.quantity}`).join('; '),
        tx.goldGiven,
        tx.goldReceived,
        tx.status,
      ].join(','),
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merchantmode-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="stat-label">
          Transaction Log <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>({transactions.length})</span>
        </span>
        {transactions.length > 0 && (
          <button
            onClick={exportCsv}
            className="btn-secondary px-3 py-1 rounded-md text-xs"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}
      </div>

      {transactions.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Receipt size={32} style={{ color: 'var(--color-text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No transactions yet.</p>
        </div>
      )}

      <div className="space-y-1 max-h-80 overflow-y-auto">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="card-inset flex items-center gap-3 p-2"
          >
            <span
              className="badge shrink-0"
              style={{
                background: tx.type === 'SELL' ? '#22c55e20' : tx.type === 'BUY' ? '#3b82f620' : '#f59e0b20',
                color: tx.type === 'SELL' ? 'var(--color-success)' : tx.type === 'BUY' ? '#60a5fa' : 'var(--color-warning)',
              }}
            >
              {tx.type}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                <span className="font-semibold">{tx.counterpartyName}</span>
                {tx.itemsGiven.length > 0 && ` | Gave: ${tx.itemsGiven.map((i) => i.name).join(', ')}`}
                {tx.itemsReceived.length > 0 && ` | Got: ${tx.itemsReceived.map((i) => i.name).join(', ')}`}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {tx.goldGiven > 0 && <span style={{ color: 'var(--color-warning)' }}>Paid {formatGold(tx.goldGiven)}</span>}
                {tx.goldReceived > 0 && <span style={{ color: 'var(--color-warning)' }}>Received {formatGold(tx.goldReceived)}</span>}
                {' | '}
                <span style={{ color: 'var(--color-text-tertiary)' }}>{new Date(tx.timestamp).toLocaleString()}</span>
              </p>
            </div>
            <span
              className="badge shrink-0"
              style={{
                background: tx.status === 'COMPLETED' ? '#22c55e20' : '#f8717120',
                color: tx.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {tx.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}
