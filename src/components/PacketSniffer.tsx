import { useState, useEffect, useRef } from 'react';

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
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter by opcode name or hex..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded text-xs border"
          style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
        />
        <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
      </div>

      <div
        ref={listRef}
        className="rounded border overflow-y-auto font-mono text-[11px] leading-5"
        style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-bg-tertiary)', maxHeight: '400px' }}
      >
        {filtered.length === 0 && (
          <p className="p-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>No packets captured yet.</p>
        )}
        {filtered.map((p, i) => (
          <div
            key={i}
            className="flex gap-2 px-2 py-0.5 border-b"
            style={{ borderColor: 'var(--color-bg-secondary)' }}
          >
            <span
              className="shrink-0 w-10 text-center"
              style={{ color: p.direction === 'server' ? '#60a5fa' : '#f59e0b' }}
            >
              {p.direction === 'server' ? 'S->C' : 'C->S'}
            </span>
            <span className="shrink-0 w-8 text-right" style={{ color: 'var(--color-accent)' }}>
              0x{p.opCode.toString(16).padStart(2, '0')}
            </span>
            <span className="shrink-0 w-28 truncate" style={{ color: 'var(--color-text-secondary)' }}>
              {OP_NAMES[p.opCode] || '???'}
            </span>
            <span className="truncate" style={{ color: 'var(--color-text-secondary)' }}>
              {p.dataHex.substring(0, 60)}
            </span>
            <span className="shrink-0 ml-auto" style={{ color: 'var(--color-text-secondary)' }}>
              {new Date(p.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
