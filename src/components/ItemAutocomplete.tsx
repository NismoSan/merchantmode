import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  name: string;
  slug: string;
  id: string;
  category: string | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: SearchResult) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export default function ItemAutocomplete({ value, onChange, onSelect, placeholder, className, autoFocus }: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const items = await window.merchantMode?.ae.searchItems(query, 8);
      if (items && items.length > 0) {
        setResults(items);
        setOpen(true);
        setSelectedIndex(0);
      } else {
        setResults([]);
        setOpen(false);
      }
    } catch {
      // AE unavailable — silently degrade
      setResults([]);
      setOpen(false);
    }
  }, []);

  function handleChange(newValue: string) {
    onChange(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(newValue), 150);
  }

  function selectItem(item: SearchResult) {
    onChange(item.name);
    onSelect?.(item);
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectItem(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup debounce
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Highlight the matching portion of the item name
  function highlightMatch(name: string) {
    const q = value.toLowerCase();
    const idx = name.toLowerCase().indexOf(q);
    if (idx === -1) return <span>{name}</span>;
    return (
      <span>
        {name.slice(0, idx)}
        <strong style={{ color: 'var(--color-gold-400)' }}>{name.slice(idx, idx + q.length)}</strong>
        {name.slice(idx + q.length)}
      </span>
    );
  }

  const categoryColors: Record<string, string> = {
    'Consumable': '#4ade80',
    'Material': '#60a5fa',
    'Weapon': '#f87171',
    'Shield': '#a78bfa',
    'Armor': '#fbbf24',
    'Accessory': '#f472b6',
    'Cosmetic': '#c084fc',
    'Ring': '#f472b6',
    'Necklace': '#f472b6',
    'Belt': '#fbbf24',
    'Boots': '#fbbf24',
    'Helmet': '#fbbf24',
    'Earring': '#f472b6',
  };

  function getCategoryColor(cat: string | null) {
    if (!cat) return 'var(--color-text-tertiary)';
    for (const [key, color] of Object.entries(categoryColors)) {
      if (cat.includes(key)) return color;
    }
    return 'var(--color-text-tertiary)';
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder || 'Item name'}
        className={className || 'input-field block w-full'}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 100,
            background: 'var(--color-surface-300)',
            border: '1px solid var(--color-surface-500)',
            borderRadius: 8,
            boxShadow: '0 12px 32px -4px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {results.map((item, i) => (
            <div
              key={item.id}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                background: i === selectedIndex ? 'var(--color-surface-400)' : 'transparent',
                transition: 'background 100ms ease',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                {highlightMatch(item.name)}
              </span>
              {item.category && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: getCategoryColor(item.category),
                    opacity: 0.8,
                    flexShrink: 0,
                  }}
                >
                  {item.category}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
