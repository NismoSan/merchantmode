/**
 * Modifies DisplayAisling (0x33) packets in-flight to show merchant names
 * persistently above their heads (guild-member style).
 *
 * The 0x33 packet ends with:
 *   [...appearance data...][nameDisplayStyle u8][name string8][groupName string8][possible extra string8]
 *
 * nameDisplayStyle values:
 *   0x00 = default (name only on mouseover)
 *   0x03 = persistent name above head (guild-member style)
 */

const NAME_DISPLAY_GUILD = 0x03;
const NAME_PREFIX = '[M] ';

/**
 * Patch a DisplayAisling (0x33) packet to show "Merchant: PlayerName" persistently
 * above the head if they are a known merchant.
 *
 * Strategy: strip trailing string8 fields from the end, then the name string8
 * is next, and the byte before it is nameDisplayStyle. Set the style byte and
 * rebuild the packet with the prefixed name.
 */
export function patchDisplayAisling(data: Uint8Array, merchantNames: Set<string>): Uint8Array {
  if (data.length < 20) return data;

  try {
    for (let trailingCount = 1; trailingCount <= 2; trailingCount++) {
      const nameEnd = stripTrailingString8s(data, trailingCount);
      if (nameEnd === null) continue;

      const result = readString8EndingAt(data, nameEnd);
      if (!result) continue;

      const { name, nameLenOffset } = result;

      // Validate: DA character names are letters, digits, spaces, starting with a letter
      if (!/^[A-Za-z][A-Za-z0-9 ]*$/.test(name)) continue;

      // Check if this player is a merchant
      if (!merchantNames.has(name.toLowerCase())) return data;

      // The nameDisplayStyle byte is immediately before nameLen
      const styleOffset = nameLenOffset - 1;
      if (styleOffset < 0) return data;

      // Build the new display name
      const displayName = NAME_PREFIX + name;
      if (displayName.length > 255) return data; // string8 max

      // Reconstruct the packet with the new name
      const before = data.slice(0, styleOffset);
      const trailing = data.slice(nameEnd);

      const patched = Buffer.alloc(before.length + 1 + 1 + displayName.length + trailing.length);
      let offset = 0;

      patched.set(before, offset);
      offset += before.length;

      patched[offset++] = NAME_DISPLAY_GUILD;

      patched[offset++] = displayName.length;
      patched.set(Buffer.from(displayName, 'ascii'), offset);
      offset += displayName.length;

      patched.set(trailing, offset);

      console.log(`[DisplayMod] Patched "${name}" → "${displayName}"`);
      return patched;
    }
  } catch {
    // On any error, return original packet unmodified
  }

  return data;
}

/**
 * Strip `count` trailing string8 fields from the end of data.
 * Returns the offset of the first stripped string8's length byte
 * (i.e., the end of the content before the trailing string8s).
 */
function stripTrailingString8s(data: Uint8Array, count: number): number | null {
  let end = data.length;

  for (let i = 0; i < count; i++) {
    let found = false;
    for (let lenPos = end - 1; lenPos >= end - 40 && lenPos >= 0; lenPos--) {
      const len = data[lenPos];
      if (lenPos + 1 + len === end) {
        end = lenPos;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }

  return end;
}

/**
 * Read a string8 field that ends at the given offset.
 * Returns the name and the offset of the length byte.
 */
function readString8EndingAt(data: Uint8Array, endOffset: number): { name: string; nameLenOffset: number } | null {
  for (let nameLenPos = endOffset - 2; nameLenPos >= endOffset - 16 && nameLenPos >= 0; nameLenPos--) {
    const nameLen = data[nameLenPos];
    if (nameLen === 0 || nameLen > 15) continue;
    if (nameLenPos + 1 + nameLen !== endOffset) continue;

    const nameBytes = data.slice(nameLenPos + 1, nameLenPos + 1 + nameLen);
    const name = Buffer.from(nameBytes).toString('ascii');
    return { name, nameLenOffset: nameLenPos };
  }
  return null;
}
