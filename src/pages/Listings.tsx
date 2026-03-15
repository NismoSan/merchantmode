import { useState, useEffect } from 'react';
import { Monitor, Tag, ShoppingBag, ArrowLeftRight, MapPin } from 'lucide-react';
import ListingManager from '../components/ListingManager';
import type { PrefillItem } from '../components/ListingManager';
import { getSpriteDataUrl, getAvatarData, type AvatarData } from '../lib/ae-api';
import { User } from 'lucide-react';

interface Props {
  characterName: string | null;
  prefillItem?: PrefillItem | null;
  onPrefillConsumed?: () => void;
  allMerchantsMode?: boolean;
  allMerchants?: GlobalMerchantData[];
}

export default function Listings({ characterName, prefillItem, onPrefillConsumed, allMerchantsMode, allMerchants }: Props) {
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

    // Don't call removeAllListeners — it kills App-level listeners
  }, [characterName]);

  async function loadListings() {
    const api = window.merchantMode;
    if (!api || !characterName) return;
    const all = await api.listings.getAll(characterName);
    setListings(all);
  }

  if (allMerchantsMode && allMerchants) {
    return <AllMerchantsListings merchants={allMerchants} />;
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

// --- All Merchants Listings View ---

function MerchantAvatar({ name }: { name: string }) {
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);

  useEffect(() => {
    getSpriteDataUrl(name).then(setSpriteUrl);
    getAvatarData(name).then(setAvatar);
  }, [name]);

  if (!spriteUrl) {
    return (
      <div
        className="flex-shrink-0 rounded-full flex items-center justify-center"
        style={{ width: 28, height: 28, background: 'var(--color-surface-400)' }}
      >
        <User size={14} style={{ color: 'var(--color-gold-600)', opacity: 0.7 }} />
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 rounded-full"
      style={{
        width: 28,
        height: 28,
        backgroundImage: `url(${spriteUrl})`,
        backgroundSize: `${avatar?.zoom ?? 220}%`,
        backgroundPosition: `${avatar?.offsetX ?? 50}% ${avatar?.offsetY ?? 20}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        border: '1px solid var(--color-gold-600)',
      }}
    />
  );
}

const TYPE_STYLES: Record<string, { bg: string; color: string; icon: typeof Tag }> = {
  SELL: { bg: '#22c55e20', color: 'var(--color-success)', icon: Tag },
  BUY: { bg: '#3b82f620', color: '#60a5fa', icon: ShoppingBag },
  TRADE: { bg: '#f59e0b20', color: 'var(--color-warning)', icon: ArrowLeftRight },
};

function AllMerchantsListings({ merchants }: { merchants: GlobalMerchantData[] }) {
  // Flatten all merchants' listings with merchant info attached
  const allListings = merchants.flatMap((m) =>
    m.listings.map((l) => ({
      ...l,
      merchantName: m.name,
      mapName: m.mapName,
      x: m.x,
      y: m.y,
    }))
  );

  // Group by type for display
  const sellListings = allListings.filter((l) => l.type === 'SELL');
  const buyListings = allListings.filter((l) => l.type === 'BUY');
  const tradeListings = allListings.filter((l) => l.type === 'TRADE');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          <span className="gold-text">All Merchant Listings</span>
          <span className="ml-2 text-base font-normal" style={{ color: 'var(--color-text-secondary)' }}>
            — {allListings.length} listings from {merchants.length} merchants
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

      {allListings.length === 0 ? (
        <div className="card p-6 text-center animate-fade-in" style={{ color: 'var(--color-text-tertiary)' }}>
          <p className="text-sm">No listings from any merchants right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sellListings.length > 0 && (
            <ListingSection label="Selling" type="SELL" listings={sellListings} />
          )}
          {buyListings.length > 0 && (
            <ListingSection label="Buying" type="BUY" listings={buyListings} />
          )}
          {tradeListings.length > 0 && (
            <ListingSection label="Trading" type="TRADE" listings={tradeListings} />
          )}
        </div>
      )}
    </div>
  );
}

interface MerchantListing extends GlobalMerchantListing {
  merchantName: string;
  mapName: string;
  x: number;
  y: number;
}

function ListingSection({ label, type, listings }: { label: string; type: string; listings: MerchantListing[] }) {
  const style = TYPE_STYLES[type] ?? TYPE_STYLES.SELL;
  const Icon = style.icon;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: style.color }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          ({listings.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {listings.map((l, i) => (
          <div key={`${l.merchantName}-${l.itemName}-${i}`} className="card-inset flex items-center gap-3 p-3">
            <span
              className="badge flex-shrink-0"
              style={{ background: style.bg, color: style.color }}
            >
              {type}
            </span>
            <MerchantAvatar name={l.merchantName} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {l.itemName}
                {l.price > 0 && (
                  <span className="ml-2" style={{ color: 'var(--color-gold-400)' }}>
                    {formatGold(l.price)}
                  </span>
                )}
              </p>
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <span className="gold-text font-medium">{l.merchantName}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                <MapPin size={10} style={{ flexShrink: 0 }} />
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  {l.mapName || 'Unknown'} ({l.x}, {l.y})
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatGold(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}
