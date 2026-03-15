import { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';

interface Whisper {
  playerName: string;
  message: string;
  timestamp: number;
  characterName?: string;
  matchedListing?: { itemName: string; price: number; type: string };
}

interface Props {
  characters: string[];
}

export default function Whispers({ characters }: Props) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [whispersByChar, setWhispersByChar] = useState<Record<string, Whisper[]>>({});
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first character tab
  useEffect(() => {
    if (!activeTab && characters.length > 0) {
      setActiveTab(characters[0]);
    }
    if (activeTab && !characters.includes(activeTab) && characters.length > 0) {
      setActiveTab(characters[0]);
    }
  }, [characters, activeTab]);

  // Load whispers for all characters and listen for new ones
  useEffect(() => {
    const api = window.merchantMode;
    if (!api) return;

    // Load existing whispers for all characters
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

    return () => {
      api.removeAllListeners();
    };
  }, [characters]);

  // Auto-scroll to bottom when new whispers come in
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [whispersByChar, activeTab]);

  const currentWhispers = activeTab ? (whispersByChar[activeTab] || []) : [];

  return (
    <div className="flex flex-col h-full space-y-4">
      <div>
        <h2 className="text-xl font-semibold gold-text">Whispers</h2>
        <div
          className="mt-2"
          style={{
            width: 80,
            height: 1,
            background: 'linear-gradient(90deg, var(--color-gold-400), transparent)',
          }}
        />
      </div>

      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 animate-fade-in">
          <MessageCircle size={48} style={{ color: 'var(--color-gold-600)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No characters connected
          </p>
        </div>
      ) : (
        <>
          {/* Character tabs */}
          <div className="flex gap-1" style={{ borderBottom: '1px solid var(--color-surface-500)' }}>
            {characters.map((name) => {
              const isActive = activeTab === name;
              const count = (whispersByChar[name] || []).length;
              return (
                <button
                  key={name}
                  onClick={() => setActiveTab(name)}
                  className="px-4 py-2 text-sm relative"
                  style={{
                    color: isActive ? 'var(--color-gold-400)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 200ms ease',
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
                    <span
                      className="ml-1.5 text-[10px]"
                      style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}
                    >
                      ({count})
                    </span>
                  )}
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-0 right-0"
                      style={{
                        height: 2,
                        background: 'var(--color-gold-400)',
                        borderRadius: '1px 1px 0 0',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Chat log */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1" style={{ minHeight: 0 }}>
            {currentWhispers.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12">
                <MessageCircle size={32} style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  No whispers for {activeTab}.
                </p>
              </div>
            )}
            {currentWhispers.map((w, i) => (
              <div
                key={`${w.playerName}-${w.timestamp}-${i}`}
                className="flex gap-2 py-1.5 px-2 rounded"
                style={{
                  background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-200)',
                }}
              >
                <span
                  className="text-xs shrink-0 tabular-nums"
                  style={{ color: 'var(--color-text-tertiary)', minWidth: 60 }}
                >
                  {new Date(w.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className="text-sm font-semibold shrink-0"
                  style={{ color: 'var(--color-gold-400)', minWidth: 80 }}
                >
                  {w.playerName}
                </span>
                <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>
                  {w.message}
                </span>
                {w.matchedListing && (
                  <span
                    className="badge shrink-0"
                    style={{ background: '#22c55e20', color: 'var(--color-success)', fontSize: 10 }}
                  >
                    {w.matchedListing.itemName}
                  </span>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </>
      )}
    </div>
  );
}
