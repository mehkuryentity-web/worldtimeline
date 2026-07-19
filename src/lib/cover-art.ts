// Deterministic seed generation for ArticleCover. Same title -> same
// hash -> same seeded sequence -> pixel-identical cover every time,
// across sessions and devices, with no storage needed.

// FNV-1a, 32-bit. Simple, fast, good-enough distribution for a visual
// seed (not cryptographic, doesn't need to be).
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 -- tiny seeded PRNG, deterministic sequence from a 32-bit seed.
export function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(title: string) {
  return mulberry32(hashString(title));
}

// range helper: rng() in [min, max)
export function between(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min);
}
