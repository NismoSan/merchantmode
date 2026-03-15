const api = window.merchantMode;

export interface AvatarData {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

const AVATAR_DEFAULTS: AvatarData = { offsetX: 50, offsetY: 20, zoom: 220 };

const avatarCache = new Map<string, AvatarData>();
const spriteCache = new Map<string, string | null>();

export async function getAvatarData(name: string): Promise<AvatarData> {
  const key = name.toLowerCase();
  const cached = avatarCache.get(key);
  if (cached) return cached;

  try {
    const res = await api.ae.getAvatar(name);
    const data: AvatarData = res
      ? { offsetX: res.avatar_offset_x ?? 50, offsetY: res.avatar_offset_y ?? 20, zoom: res.avatar_zoom ?? 220 }
      : AVATAR_DEFAULTS;
    avatarCache.set(key, data);
    return data;
  } catch {
    return AVATAR_DEFAULTS;
  }
}

export async function getSpriteDataUrl(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  if (spriteCache.has(key)) return spriteCache.get(key) ?? null;

  try {
    const base64 = await api.ae.getSprite(name);
    if (!base64) {
      spriteCache.set(key, null);
      return null;
    }
    const dataUrl = `data:image/png;base64,${base64}`;
    spriteCache.set(key, dataUrl);
    return dataUrl;
  } catch {
    spriteCache.set(key, null);
    return null;
  }
}
