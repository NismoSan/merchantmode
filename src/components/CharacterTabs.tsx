import { Users } from 'lucide-react';

interface Props {
  characters: string[];
  activeCharacter: string | null;
  onSelect: (name: string) => void;
  characterStates: Record<string, string>;
}

export default function CharacterTabs({ characters, activeCharacter, onSelect, characterStates }: Props) {
  if (characters.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-2.5 text-sm border-b"
        style={{
          color: 'var(--color-text-tertiary)',
          borderColor: 'var(--color-surface-500)',
          background: 'var(--color-surface-200)',
        }}
      >
        <Users size={14} />
        No characters connected. Launch a client to get started.
      </div>
    );
  }

  return (
    <div
      className="flex border-b"
      style={{ borderColor: 'var(--color-surface-500)', background: 'var(--color-surface-200)' }}
    >
      {characters.map((name) => {
        const isActive = name === activeCharacter;
        const state = characterStates[name] ?? 'IDLE';
        const isBusy = state !== 'IDLE';

        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="relative px-4 py-2.5 text-sm transition-all duration-200"
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
            {name}
            {isBusy && (
              <span
                className="inline-block w-2 h-2 rounded-full ml-2"
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
    </div>
  );
}
