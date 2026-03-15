import { useEffect, useState } from 'react';
import { Users, User } from 'lucide-react';
import { getSpriteDataUrl } from '../lib/ae-api';

interface Props {
  characters: string[];
  activeCharacter: string | null;
  onSelect: (name: string) => void;
  characterStates: Record<string, string>;
  characterTypes: Record<string, 'launched' | 'bot'>;
  onSelectAll: () => void;
  isAllSelected: boolean;
  allMerchantsCount: number;
}

function CharacterFace({ name }: { name: string }) {
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);

  useEffect(() => {
    getSpriteDataUrl(name).then(setSpriteUrl);
  }, [name]);

  if (!spriteUrl) {
    return (
      <div
        className="flex-shrink-0 rounded-sm flex items-center justify-center overflow-hidden"
        style={{ width: 16, height: 16, background: 'var(--color-surface-400)' }}
      >
        <User size={10} style={{ color: 'var(--color-gold-600)', opacity: 0.7 }} />
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 rounded-sm overflow-hidden"
      style={{
        width: 16,
        height: 16,
        backgroundImage: `url(${spriteUrl})`,
        backgroundSize: '250%',
        backgroundPosition: '50% 8%',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}

export default function CharacterTabs({ characters, activeCharacter, onSelect, characterStates, characterTypes, onSelectAll, isAllSelected, allMerchantsCount }: Props) {
  return (
    <div
      className="flex border-b"
      style={{ borderColor: 'var(--color-surface-500)', background: 'var(--color-surface-200)' }}
    >
      {characters.map((name) => {
        const isActive = !isAllSelected && name === activeCharacter;
        const state = characterStates[name] ?? 'IDLE';
        const isBusy = state !== 'IDLE';
        const isBot = characterTypes[name] === 'bot';

        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="relative px-4 py-2.5 text-sm transition-all duration-200 flex items-center gap-2"
            style={{
              background: isActive ? 'var(--color-surface-100)' : 'transparent',
              color: isActive ? 'var(--color-gold-400)' : 'var(--color-text-secondary)',
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive ? '2px solid var(--color-gold-400)' : '2px solid transparent',
              boxShadow: isActive ? '0 2px 8px var(--color-gold-glow)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--color-surface-300)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            <CharacterFace name={name} />
            {name}
            {isBot && (
              <span
                className="inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded"
                style={{
                  background: 'var(--color-surface-500)',
                  color: 'var(--color-text-tertiary)',
                  lineHeight: 1,
                  verticalAlign: 'middle',
                }}
              >
                BOT
              </span>
            )}
            {isBusy && (
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  background: 'var(--color-warning)',
                  animation: 'pulse-gold 2s infinite',
                }}
                title={state}
              />
            )}
          </button>
        );
      })}
      <button
        onClick={onSelectAll}
        className="relative px-4 py-2.5 text-sm transition-all duration-200 flex items-center gap-2"
        style={{
          background: isAllSelected ? 'var(--color-surface-100)' : 'transparent',
          color: isAllSelected ? 'var(--color-gold-400)' : 'var(--color-text-secondary)',
          fontWeight: isAllSelected ? 600 : 400,
          borderBottom: isAllSelected ? '2px solid var(--color-gold-400)' : '2px solid transparent',
          boxShadow: isAllSelected ? '0 2px 8px var(--color-gold-glow)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isAllSelected) {
            e.currentTarget.style.background = 'var(--color-surface-300)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isAllSelected) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }
        }}
      >
        <Users size={14} />
        All Merchants
        {allMerchantsCount > 0 && (
          <span
            className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded"
            style={{
              background: 'var(--color-gold-600)',
              color: 'var(--color-text-primary)',
              lineHeight: 1,
            }}
          >
            {allMerchantsCount}
          </span>
        )}
      </button>
    </div>
  );
}
