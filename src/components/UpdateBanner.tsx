import { useState, useEffect } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

type UpdateStatus = {
  status: string;
  version?: string;
  percent?: number;
  message?: string;
};

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.merchantMode;
    if (!api?.updater) return;

    api.updater.onStatus((data) => {
      setUpdate(data);
      // Un-dismiss when a new state comes in that's worth showing
      if (data.status === 'available' || data.status === 'ready') {
        setDismissed(false);
      }
    });
  }, []);

  if (dismissed || !update) return null;

  // Only show for states the user cares about — hide errors silently
  // (no published releases, network issues, etc. are not actionable for users)
  if (!['available', 'downloading', 'ready'].includes(update.status)) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{
        background:
          update.status === 'ready'
            ? 'linear-gradient(90deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
            : 'linear-gradient(90deg, rgba(201,171,105,0.15), rgba(201,171,105,0.05))',
        borderBottom: '1px solid var(--color-surface-500)',
      }}
    >
      {update.status === 'downloading' && (
        <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-gold-400)' }} />
      )}
      {update.status === 'ready' && (
        <Download size={14} style={{ color: '#22c55e' }} />
      )}

      <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>
        {update.status === 'available' && `Update v${update.version} is available — downloading...`}
        {update.status === 'downloading' && `Downloading update... ${update.percent ?? 0}%`}
        {update.status === 'ready' && `v${update.version} is ready to install.`}
      </span>

      {update.status === 'ready' && (
        <button
          onClick={() => window.merchantMode?.updater.install()}
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{
            background: '#22c55e',
            color: '#fff',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          Restart & Update
        </button>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-tertiary)',
          cursor: 'pointer',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
