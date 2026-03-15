interface Props {
  proxyStatus: string;
  engineState: string;
}

export default function ConnectionStatus({ proxyStatus, engineState }: Props) {
  const connected = proxyStatus === 'connected';
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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: connected ? 'var(--color-success)' : 'var(--color-surface-600)',
            boxShadow: connected ? '0 0 6px rgba(74, 222, 128, 0.5)' : 'none',
          }}
        />
        <span className="text-xs" style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
          {connected ? 'Connected' : 'Waiting'}
        </span>
      </div>
      {connected && engineState !== 'IDLE' && (
        <div
          className="flex items-center gap-2 px-2 py-1 rounded"
          style={{ background: 'rgba(201, 168, 76, 0.1)' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: stateColors[engineState] || 'var(--color-text-secondary)',
              animation: 'pulse-gold 2s infinite',
            }}
          />
          <span
            className="text-[10px]"
            style={{
              color: stateColors[engineState] || 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {engineState.replace(/_/g, ' ')}
          </span>
        </div>
      )}
    </div>
  );
}
