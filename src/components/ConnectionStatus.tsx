import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

interface Props {
  proxyStatus: string;
  engineState: string;
}

export default function ConnectionStatus({ proxyStatus, engineState }: Props) {
  const connected = proxyStatus === 'connected';
  const [aeLoggedIn, setAeLoggedIn] = useState(false);
  const [aeUsername, setAeUsername] = useState('');

  useEffect(() => {
    window.merchantMode?.ae.getAuthStatus().then((status) => {
      setAeLoggedIn(status.loggedIn);
      setAeUsername(status.username || '');
    }).catch(() => {});

    window.merchantMode?.ae.onAuthChanged((status) => {
      setAeLoggedIn(status.loggedIn);
      setAeUsername(status.username || '');
    });
  }, []);

  const stateColors: Record<string, string> = {
    IDLE: 'var(--color-text-secondary)',
    WHISPER_QUEUED: 'var(--color-warning)',
    EXCHANGE_OPEN: 'var(--color-gold-400)',
    VALIDATING: 'var(--color-warning)',
    FILLING: 'var(--color-gold-400)',
    AWAITING_CONFIRM: 'var(--color-gold-400)',
    COMPLETE: 'var(--color-success)',
    CANCELLED: 'var(--color-danger)',
  };

  return (
    <div className="flex items-center gap-2.5">
      {/* AE status */}
      <div
        className="flex items-center gap-1.5"
        style={{
          padding: '3px 8px',
          borderRadius: 6,
          background: aeLoggedIn ? 'rgba(74,222,128,0.06)' : 'transparent',
          border: aeLoggedIn ? '1px solid rgba(74,222,128,0.12)' : '1px solid var(--color-surface-500)',
        }}
        title={aeLoggedIn ? `AE: ${aeUsername}` : 'Not logged in to AislingExchange'}
      >
        <Globe size={11} style={{ color: aeLoggedIn ? 'var(--color-success)' : 'var(--color-text-tertiary)', opacity: 0.8 }} />
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          color: aeLoggedIn ? 'var(--color-success)' : 'var(--color-text-tertiary)',
        }}>
          {aeLoggedIn ? 'AE' : 'AE'}
        </span>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: aeLoggedIn ? 'var(--color-success)' : 'var(--color-surface-600)',
          boxShadow: aeLoggedIn ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
        }} />
      </div>

      {/* Proxy status */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: connected ? 'var(--color-success)' : 'var(--color-surface-600)',
          boxShadow: connected ? '0 0 8px rgba(74, 222, 128, 0.5)' : 'none',
          animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{
        fontSize: 12,
        fontWeight: connected ? 500 : 400,
        color: connected ? 'var(--color-success)' : 'var(--color-text-tertiary)',
      }}>
        {connected ? 'Connected' : 'Waiting'}
      </span>
      {connected && engineState !== 'IDLE' && (
        <div
          className="flex items-center gap-2"
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(201, 168, 76, 0.08)',
            border: '1px solid rgba(201, 168, 76, 0.12)',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: stateColors[engineState] || 'var(--color-text-secondary)',
              animation: 'pulse-gold 2s infinite',
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: stateColors[engineState] || 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 600,
            }}
          >
            {engineState === 'IDLE' ? 'READY' : engineState.replace(/_/g, ' ')}
          </span>
        </div>
      )}
    </div>
  );
}
