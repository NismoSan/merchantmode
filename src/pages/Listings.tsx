import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import ListingManager from '../components/ListingManager';
import type { PrefillItem } from '../components/ListingManager';

interface Props {
  characterName: string | null;
  prefillItem?: PrefillItem | null;
  onPrefillConsumed?: () => void;
}

export default function Listings({ characterName, prefillItem, onPrefillConsumed }: Props) {
  const [listings, setListings] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    const api = window.merchantMode;
    if (!api || !characterName) {
      setListings([]);
      setInventory([]);
      return;
    }

    loadListings();
    api.inventory.get(characterName).then(setInventory);

    const handleTransaction = (tx: any) => {
      if (!tx.characterName || tx.characterName === characterName) {
        loadListings();
      }
    };

    const handleInventoryUpdate = (data: any) => {
      if (data.characterName === characterName) {
        setInventory(data.items);
      }
    };

    api.engine.onTransaction(handleTransaction);
    api.inventory.onUpdate(handleInventoryUpdate);

    return () => {
      api.removeAllListeners();
    };
  }, [characterName]);

  async function loadListings() {
    const api = window.merchantMode;
    if (!api || !characterName) return;
    const all = await api.listings.getAll(characterName);
    setListings(all);
  }

  if (!characterName) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <Monitor size={48} style={{ color: 'var(--color-gold-600)' }} />
        <div className="text-center">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No character selected
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Launch a client to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          <span className="gold-text">Listings</span>
          <span className="ml-2 text-base font-normal" style={{ color: 'var(--color-text-secondary)' }}>
            — {characterName}
          </span>
        </h2>
        <div
          className="mt-2"
          style={{
            width: 80,
            height: 1,
            background: 'linear-gradient(90deg, var(--color-gold-400), transparent)',
          }}
        />
      </div>

      <ListingManager
        listings={listings}
        onRefresh={loadListings}
        characterName={characterName}
        prefillItem={prefillItem}
        onPrefillConsumed={onPrefillConsumed}
        inventory={inventory}
      />
    </div>
  );
}
