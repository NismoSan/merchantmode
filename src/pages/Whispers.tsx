import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Check, X } from 'lucide-react';

interface Whisper {
  playerName: string;
  message: string;
  timestamp: number;
  characterName?: string;
  matchedListing?: { itemName: string; price: number; type: string };
}

interface Props {
  characters: string[];
  onViewProfile?: (name: string) => void;
}

export default function Whispers({ characters, onViewProfile }: Props) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [whispersByChar, setWhispersByChar] = useState<Record<string, Whisper[]>>({});
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeTab && characters.length > 0) {
      setActiveTab(characters[0]);
    }
    if (activeTab && !characters.includes(activeTab) && characters.length > 0) {
      setActiveTab(characters[0]);
    }
  }, [characters, activeTab]);

  useEffect(() => {
    const api = window.merchantMode;
    if (!api) return;

    characters.forEach((name) => {
      api.engine.getWhispers(name).then((whispers: Whisper[]) => {
        setWhispersByChar((prev) => ({ ...prev, [name]: whispers }));
      });
    });

    const handleWhisper = (w: Whisper) => {
      const charName = w.characterName;
      if (!charName) return;
      setWhispersByChar((prev) => ({
        ...prev,
        [charName]: [...(prev[charName] || []), w],
      }));
    };

    api.engine.onWhisper(handleWhisper);

    // Don't call removeAllListeners — it kills App-level listeners
  }, [characters]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [whispersByChar, activeTab]);

  const currentWhispers = activeTab ? (whispersByChar[activeTab] || []) : [];

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Hero */}
      <div className="page-hero animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="page-hero-icon">
            <MessageCircle size={22} style={{ color: 'var(--color-gold-400)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="page-hero-title">Whispers</h1>
            <p className="page-hero-subtitle">Incoming trade messages from other players</p>
          </div>
          {activeTab && (
            <div style={{
              padding: '5px 14px',
              borderRadius: 20,
              background: 'rgba(201,168,76,0.1)',
              border: '1px solid rgba(201,168,76,0.25)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-gold-300)',
            }}>
              {currentWhispers.length} messages
            </div>
          )}
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="empty-state animate-fade-in" style={{ flex: 1 }}>
          <div className="empty-state-icon">
            <MessageCircle size={24} style={{ color: 'var(--color-gold-400)' }} />
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            No characters connected
          </p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            Launch a client to see whispers
          </p>
        </div>
      ) : (
        <>
          {/* Character tabs */}
          <div
            className="flex gap-1 animate-slide-up"
            style={{ borderBottom: '1px solid var(--color-surface-500)', animationDelay: '80ms' }}
          >
            {characters.map((name) => {
              const isActive = activeTab === name;
              const count = (whispersByChar[name] || []).length;
              return (
                <button
                  key={name}
                  onClick={() => setActiveTab(name)}
                  className="tab-btn"
                  style={{
                    color: isActive ? 'var(--color-gold-400)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  {name}
                  {count > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
                      ({count})
                    </span>
                  )}
                  {isActive && <div className="tab-btn-indicator" />}
                </button>
              );
            })}
          </div>

          {/* Chat log */}
          <div
            className="flex-1 overflow-y-auto pr-1 animate-slide-up"
            style={{ minHeight: 0, animationDelay: '140ms' }}
          >
            {currentWhispers.length === 0 && (
              <div className="empty-state" style={{ paddingTop: 60, paddingBottom: 60 }}>
                <div className="empty-state-icon">
                  <MessageCircle size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
                  No whispers for {activeTab}.
                </p>
              </div>
            )}
            <div className="space-y-1">
              {currentWhispers.map((w, i) => (
                <div
                  key={`${w.playerName}-${w.timestamp}-${i}`}
                  className="whisper-row"
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-200)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--color-text-tertiary)',
                      minWidth: 60,
                    }}
                  >
                    {new Date(w.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      flexShrink: 0,
                      color: 'var(--color-gold-400)',
                      minWidth: 80,
                      cursor: onViewProfile ? 'pointer' : undefined,
                      textDecoration: onViewProfile ? 'none' : undefined,
                    }}
                    onClick={() => onViewProfile?.(w.playerName)}
                    onMouseEnter={(e) => { if (onViewProfile) e.currentTarget.style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { if (onViewProfile) e.currentTarget.style.textDecoration = 'none'; }}
                  >
                    {w.playerName}
                  </span>
                  <span style={{ fontSize: 13, flex: 1, color: 'var(--color-text-primary)' }}>
                    {w.message}
                  </span>
                  {w.matchedListing && (
                    <span
                      className="badge"
                      style={{ background: '#22c55e20', color: 'var(--color-success)', fontSize: 10, flexShrink: 0 }}
                    >
                      <Check size={10} />
                      {w.matchedListing.itemName}
                    </span>
                  )}
                  {!w.matchedListing && (
                    <span
                      className="badge"
                      style={{ background: '#f8717120', color: 'var(--color-danger)', fontSize: 10, flexShrink: 0 }}
                    >
                      <X size={10} />
                      No match
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div ref={logEndRef} />
          </div>
        </>
      )}
    </div>
  );
}
