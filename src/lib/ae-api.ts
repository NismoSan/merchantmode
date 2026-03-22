const api = window.merchantMode;

export interface AvatarData {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

const AVATAR_DEFAULTS: AvatarData = { offsetX: 50, offsetY: 20, zoom: 220 };

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const avatarCache = new Map<string, CacheEntry<AvatarData>>();
const spriteCache = new Map<string, CacheEntry<string | null>>();

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && (Date.now() - entry.timestamp) < CACHE_TTL;
}

export function refreshPlayerCache(name?: string) {
  if (name) {
    const key = name.toLowerCase();
    avatarCache.delete(key);
    spriteCache.delete(key);
  } else {
    avatarCache.clear();
    spriteCache.clear();
  }
}

export async function getAvatarData(name: string): Promise<AvatarData> {
  const key = name.toLowerCase();
  const cached = avatarCache.get(key);
  if (isFresh(cached)) return cached.value;

  try {
    const res = await api.ae.getAvatar(name);
    const data: AvatarData = res
      ? { offsetX: res.avatar_offset_x ?? 50, offsetY: res.avatar_offset_y ?? 20, zoom: res.avatar_zoom ?? 220 }
      : AVATAR_DEFAULTS;
    avatarCache.set(key, { value: data, timestamp: Date.now() });
    return data;
  } catch {
    return AVATAR_DEFAULTS;
  }
}

export async function getSpriteDataUrl(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  const cached = spriteCache.get(key);
  if (isFresh(cached)) return cached.value;

  try {
    const base64 = await api.ae.getSprite(name);
    if (!base64) {
      spriteCache.set(key, { value: null, timestamp: Date.now() });
      return null;
    }
    const dataUrl = `data:image/png;base64,${base64}`;
    spriteCache.set(key, { value: dataUrl, timestamp: Date.now() });
    return dataUrl;
  } catch {
    spriteCache.set(key, { value: null, timestamp: Date.now() });
    return null;
  }
}
