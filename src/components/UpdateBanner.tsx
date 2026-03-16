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
      if (data.status === 'available' || data.status === 'ready') {
        setDismissed(false);
      }
    });
  }, []);

  if (dismissed || !update) return null;

  if (!['available', 'downloading', 'ready'].includes(update.status)) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        fontSize: 13,
        background:
          update.status === 'ready'
            ? 'linear-gradient(90deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))'
            : 'linear-gradient(90deg, rgba(201,171,105,0.12), rgba(201,171,105,0.04))',
        borderBottom: '1px solid var(--color-surface-500)',
      }}
    >
      {update.status === 'downloading' && (
        <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--color-gold-400)', flexShrink: 0 }} />
      )}
      {update.status === 'ready' && (
        <Download size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
      )}
      {update.status === 'available' && (
        <Download size={14} style={{ color: 'var(--color-gold-400)', flexShrink: 0 }} />
      )}

      <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>
        {update.status === 'available' && `Update v${update.version} is available — downloading...`}
        {update.status === 'downloading' && `Downloading update... ${update.percent ?? 0}%`}
        {update.status === 'ready' && `v${update.version} is ready to install.`}
      </span>

      {update.status === 'downloading' && (
        <div style={{
          width: 120,
          height: 4,
          borderRadius: 2,
          background: 'var(--color-surface-500)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{
            width: `${update.percent ?? 0}%`,
            height: '100%',
            borderRadius: 2,
            background: 'linear-gradient(90deg, var(--color-gold-400), var(--color-gold-300))',
            transition: 'width 300ms ease',
          }} />
        </div>
      )}

      {update.status === 'ready' && (
        <button
          onClick={() => window.merchantMode?.updater.install()}
          className="btn-primary"
          style={{
            padding: '5px 14px',
            borderRadius: 6,
            fontSize: 12,
            background: 'linear-gradient(135deg, #4ade80, #22c55e)',
            color: '#fff',
          }}
        >
          <Download size={12} />
          Restart & Update
        </button>
      )}

      <button
        onClick={() => setDismissed(true)}
        style={{
          padding: 4,
          borderRadius: 4,
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-tertiary)',
          cursor: 'pointer',
          transition: 'color 200ms ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
