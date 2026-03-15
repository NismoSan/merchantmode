import { useEffect, useState } from 'react';
import { MapPin, ShoppingBag, Tag, ArrowLeftRight, Users, User } from 'lucide-react';
import { getSpriteDataUrl, getAvatarData, type AvatarData } from '../lib/ae-api';

interface Props {
  merchants: GlobalMerchantData[];
  proxyStatus: string;
}

export default function AllMerchantsView({ merchants, proxyStatus }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          <span className="gold-text">All Merchants</span>
          <span className="ml-2 text-base font-normal" style={{ color: 'var(--color-text-secondary)' }}>
            — {merchants.length} online
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

      {proxyStatus !== 'connected' && (
        <div
          className="card p-6 text-center animate-fade-in"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <Users size={32} className="mx-auto mb-2" style={{ color: 'var(--color-gold-600)' }} />
          <p className="text-sm">Start the proxy to connect to the merchant network.</p>
        </div>
      )}

      {proxyStatus === 'connected' && merchants.length === 0 && (
        <div
          className="card p-6 text-center animate-fade-in"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <Users size={32} className="mx-auto mb-2" style={{ color: 'var(--color-gold-600)' }} />
          <p className="text-sm">No other merchants online right now.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Other MerchantMode users will appear here when they're online.
          </p>
        </div>
      )}

      {merchants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {merchants.map((merchant) => (
            <MerchantCard key={merchant.name} merchant={merchant} />
          ))}
        </div>
      )}
    </div>
  );
}

function AvatarCircle({ spriteUrl, avatar }: { spriteUrl: string | null; avatar: AvatarData | null }) {
  if (!spriteUrl) {
    return (
      <div
        className="flex-shrink-0 rounded-full flex items-center justify-center"
        style={{ width: 32, height: 32, background: 'var(--color-surface-400)' }}
      >
        <User size={16} style={{ color: 'var(--color-gold-600)', opacity: 0.7 }} />
      </div>
    );
  }

  const offsetX = avatar?.offsetX ?? 50;
  const offsetY = avatar?.offsetY ?? 20;
  const zoom = avatar?.zoom ?? 220;

  return (
    <div
      className="flex-shrink-0 rounded-full"
      style={{
        width: 32,
        height: 32,
        backgroundImage: `url(${spriteUrl})`,
        backgroundSize: `${zoom}%`,
        backgroundPosition: `${offsetX}% ${offsetY}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        border: '1px solid var(--color-gold-600)',
      }}
    />
  );
}

function MerchantCard({ merchant }: { merchant: GlobalMerchantData }) {
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);

  useEffect(() => {
    getAvatarData(merchant.name).then(setAvatar);
    getSpriteDataUrl(merchant.name).then(setSpriteUrl);
  }, [merchant.name]);

  const buyListings = merchant.listings.filter((l) => l.type === 'BUY');
  const sellListings = merchant.listings.filter((l) => l.type === 'SELL');
  const tradeListings = merchant.listings.filter((l) => l.type === 'TRADE');

  return (
    <div className="card relative overflow-hidden p-4 animate-fade-in">
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 2,
          background: 'linear-gradient(90deg, var(--color-gold-400), var(--color-gold-600), transparent)',
        }}
      />

      {/* Header: avatar + name/location + sprite */}
      <div className="flex items-start gap-3 mb-3">
        <AvatarCircle spriteUrl={spriteUrl} avatar={avatar} />

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold gold-text truncate">{merchant.name}</h3>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <MapPin size={12} />
            <span>
              {merchant.mapName || 'Unknown Map'}
              <span style={{ color: 'var(--color-text-tertiary)' }}> ({merchant.x}, {merchant.y})</span>
            </span>
          </div>
        </div>

        {spriteUrl && (
          <div className="flex-shrink-0 self-center">
            <img
              src={spriteUrl}
              alt=""
              style={{
                height: 64,
                imageRendering: 'pixelated',
                opacity: 0.85,
              }}
            />
          </div>
        )}
      </div>

      {/* Listings summary */}
      {merchant.listings.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No active listings</p>
      ) : (
        <div className="space-y-1.5">
          {sellListings.length > 0 && (
            <ListingGroup icon={<Tag size={11} />} label="Selling" listings={sellListings} color="var(--color-success)" />
          )}
          {buyListings.length > 0 && (
            <ListingGroup icon={<ShoppingBag size={11} />} label="Buying" listings={buyListings} color="var(--color-info, #60a5fa)" />
          )}
          {tradeListings.length > 0 && (
            <ListingGroup icon={<ArrowLeftRight size={11} />} label="Trading" listings={tradeListings} color="var(--color-warning)" />
          )}
        </div>
      )}
    </div>
  );
}

function ListingGroup({ icon, label, listings, color }: {
  icon: React.ReactNode;
  label: string;
  listings: GlobalMerchantListing[];
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase mb-0.5" style={{ color }}>
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {listings.map((l, i) => (
          <span
            key={i}
            className="inline-block px-1.5 py-0.5 rounded text-[11px]"
            style={{
              background: 'var(--color-surface-400)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {l.itemName}
            {l.price > 0 && (
              <span style={{ color: 'var(--color-gold-400)', marginLeft: 4 }}>
                {formatGold(l.price)}
              </span>
            )}
          </span>
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
