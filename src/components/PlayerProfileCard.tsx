import { useState, useEffect, useRef } from 'react';
import { ExternalLink, User, ShoppingBag, Wifi, WifiOff, X } from 'lucide-react';
import { getSpriteDataUrl, getAvatarData, type AvatarData } from '../lib/ae-api';

interface Props {
  playerName: string;
  anchorEl?: HTMLElement | null;
  onClose: () => void;
  onViewFullProfile?: (name: string) => void;
}

interface PlayerProfile {
  name: string;
  className?: string;
  classId?: number;
  title?: string;
  isMaster?: boolean;
  isOnline?: boolean;
}

export default function PlayerProfileCard({ playerName, anchorEl, onClose, onViewFullProfile }: Props) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [listingCount, setListingCount] = useState<{ buy: number; sell: number; trade: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

      const [profileResult, spriteResult, avatarResult, listingsResult] = await Promise.all([
        window.merchantMode?.ae.getPlayerProfile(playerName).catch(() => null),
        getSpriteDataUrl(playerName).catch(() => null),
        getAvatarData(playerName).catch(() => null),
        window.merchantMode?.ae.getPlayerListings(playerName).catch(() => null),
      ]);

      if (cancelled) return;

      if (profileResult) {
        setProfile(profileResult);
      } else {
        // Fallback: show just the name
        setProfile({ name: playerName });
      }

      setSpriteUrl(spriteResult || null);
      setAvatar(avatarResult || null);

      if (listingsResult?.data) {
        const active = listingsResult.data.filter((l: any) => l.status === 'ACTIVE');
        setListingCount({
          buy: active.filter((l: any) => l.type === 'BUY').length,
          sell: active.filter((l: any) => l.type === 'SELL').length,
          trade: active.filter((l: any) => l.type === 'TRADE').length,
        });
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [playerName]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Position near anchor or center
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 200,
    width: 280,
  };

  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    style.top = Math.min(rect.bottom + 8, window.innerHeight - 320);
    style.left = Math.min(rect.left, window.innerWidth - 296);
  } else {
    style.top = '50%';
    style.left = '50%';
    style.transform = 'translate(-50%, -50%)';
  }

  const totalListings = listingCount ? listingCount.buy + listingCount.sell + listingCount.trade : 0;

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.3)' }} />

      <div
        ref={cardRef}
        style={{
          ...style,
          background: 'var(--color-surface-300)',
          border: '1px solid var(--color-surface-500)',
          borderRadius: 12,
          boxShadow: '0 20px 50px -12px rgba(0,0,0,0.6), 0 0 30px rgba(201,168,76,0.06)',
          overflow: 'hidden',
        }}
        className="animate-slide-up"
      >
        {/* Top accent */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--color-gold-400), transparent)' }} />

        {/* Header */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-surface-500)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Player Profile</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
              Loading...
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sprite + Name */}
              <div className="flex items-center gap-3">
                {spriteUrl ? (
                  <div style={{
                    width: 48, height: 48, borderRadius: 8,
                    backgroundImage: `url(${spriteUrl})`,
                    backgroundSize: `${avatar?.zoom ?? 220}%`,
                    backgroundPosition: `${avatar?.offsetX ?? 50}% ${avatar?.offsetY ?? 20}%`,
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'pixelated',
                    border: '1px solid rgba(201,168,76,0.3)',
                    flexShrink: 0,
                  }} />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--color-surface-200), var(--color-surface-400))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <User size={20} style={{ color: 'var(--color-text-tertiary)' }} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {profile?.name || playerName}
                    </span>
                    {profile?.isMaster && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        padding: '1px 5px', borderRadius: 4,
                        background: 'rgba(201,168,76,0.15)', color: 'var(--color-gold-400)',
                      }}>
                        Master
                      </span>
                    )}
                  </div>
                  {profile?.className && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {profile.className}
                      {profile.title ? ` \u2014 ${profile.title}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Online status */}
              {profile && 'isOnline' in profile && (
                <div className="flex items-center gap-2" style={{ fontSize: 11, color: profile.isOnline ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
                  {profile.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {profile.isOnline ? 'Online' : 'Offline'}
                </div>
              )}

              {/* Listing counts */}
              {listingCount && totalListings > 0 && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--color-surface-200)',
                  border: '1px solid var(--color-surface-500)',
                }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    <ShoppingBag size={12} style={{ color: 'var(--color-gold-400)' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Active Listings</span>
                  </div>
                  <div className="flex gap-3">
                    {listingCount.sell > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-success)' }}>
                        {listingCount.sell} Sell
                      </span>
                    )}
                    {listingCount.buy > 0 && (
                      <span style={{ fontSize: 11, color: '#60a5fa' }}>
                        {listingCount.buy} Buy
                      </span>
                    )}
                    {listingCount.trade > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-warning)' }}>
                        {listingCount.trade} Trade
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onViewFullProfile?.(playerName);
                    onClose();
                  }}
                  className="btn-primary flex-1"
                  style={{ padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}
                >
                  View Full Profile
                </button>
                <button
                  onClick={() => window.merchantMode?.shell.openExternal(`https://aislingexchange.com/aislings/${encodeURIComponent(playerName)}`)}
                  className="btn-secondary"
                  style={{ padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}
                >
                  <ExternalLink size={12} /> AE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
