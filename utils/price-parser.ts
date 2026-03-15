/**
 * Parse price strings with K/M/B suffixes.
 * Adapted from AEofficial format.ts
 *
 * Examples:
 *   "500k" -> 500000
 *   "1.5m" -> 1500000
 *   "2b"   -> 2000000000
 *   "1gb"  -> 50000000  (1 gold bar = 50m)
 *   "100"  -> 100
 */
export function parsePrice(input: string): number | null {
  const cleaned = input.trim().toLowerCase().replace(/,/g, '');

  // Gold bar notation
  const gbMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*gb$/);
  if (gbMatch) {
    return Math.floor(parseFloat(gbMatch[1]) * 50_000_000);
  }

  const suffixMap: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
  };

  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const suffix = match[2];

  if (suffix) {
    return Math.floor(value * suffixMap[suffix]);
  }

  return Math.floor(value);
}

/**
 * Format a gold amount to a human-readable string.
 */
export function formatPrice(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return amount.toString();
}
