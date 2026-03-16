import { useState, useEffect, useRef } from 'react';
import { Terminal, Radio } from 'lucide-react';

interface PacketEntry {
  direction: string;
  opCode: number;
  dataHex: string;
  timestamp: number;
}

const OP_NAMES: Record<number, string> = {
  0: 'ConnectionInfo', 2: 'LoginMessage', 3: 'Redirect', 8: 'Attributes',
  10: 'ServerMessage', 13: 'ChatMessage', 14: 'PublicMessage/RemoveObject',
  15: 'AddItemToPane', 16: 'RemoveItemFromPane', 21: 'MapInfo',
  25: 'Whisper/Sound', 51: 'DisplayAisling', 55: 'Equipment',
  59: 'HeartBeat', 66: 'Exchange', 74: 'Exchange(C)', 126: 'AcceptConnection',
};

interface Props {
  packets: PacketEntry[];
}

export default function PacketSniffer({ packets }: Props) {
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [packets, autoScroll]);

  const filtered = packets.filter((p) => {
    if (!filter) return true;
    const opName = OP_NAMES[p.opCode] || '';
    const hex = p.opCode.toString(16);
    const searchLower = filter.toLowerCase();
    return (
      opName.toLowerCase().includes(searchLower) ||
      hex.includes(searchLower) ||
      p.direction.includes(searchLower)
    );
  });

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Hero */}
      <div className="page-hero animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="page-hero-icon">
            <Radio size={22} style={{ color: 'var(--color-gold-400)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="page-hero-title">Packet Sniffer</h1>
            <p className="page-hero-subtitle">
              {filtered.length} packets captured
            </p>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ accentColor: 'var(--color-gold-400)' }}
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Filter */}
      <div className="animate-slide-up" style={{ animationDelay: '80ms' }}>
        <input
          type="text"
          placeholder="Filter by opcode name or hex..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input-field w-full"
        />
      </div>

      {/* Packet log */}
      <div
        ref={listRef}
        className="animate-slide-up"
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 10,
          border: '1px solid var(--color-surface-500)',
          background: 'var(--color-surface-100)',
          overflow: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, "Cascadia Mono", monospace',
          fontSize: 11,
          lineHeight: '22px',
          animationDelay: '140ms',
        }}
      >
        {filtered.length === 0 && (
          <div className="empty-state" style={{ paddingTop: 48, paddingBottom: 48 }}>
            <div className="empty-state-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <Terminal size={20} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'inherit' }}>
              No packets captured yet.
            </p>
          </div>
        )}
        {filtered.map((p, i) => (
          <div
            key={i}
            className="flex gap-2 px-3 py-0.5"
            style={{
              borderBottom: '1px solid var(--color-surface-300)',
              transition: 'background 100ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-200)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span
              className="shrink-0 w-10 text-center font-semibold"
              style={{ color: p.direction === 'server' ? '#60a5fa' : '#fbbf24' }}
            >
              {p.direction === 'server' ? 'S->C' : 'C->S'}
            </span>
            <span className="shrink-0 w-8 text-right" style={{ color: 'var(--color-gold-400)' }}>
              0x{p.opCode.toString(16).padStart(2, '0')}
            </span>
            <span className="shrink-0 w-28 truncate" style={{ color: 'var(--color-text-secondary)' }}>
              {OP_NAMES[p.opCode] || '???'}
            </span>
            <span className="truncate" style={{ color: 'var(--color-text-tertiary)' }}>
              {p.dataHex.substring(0, 60)}
            </span>
            <span className="shrink-0 ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
              {new Date(p.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
