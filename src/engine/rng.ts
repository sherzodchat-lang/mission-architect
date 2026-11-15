// Seeded RNG (mulberry32). State is a plain uint32 so it can live inside serializable sim state.

/** Advance a mulberry32 state. Returns [value in [0,1), next state]. */
export function mulberry32Step(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Classic closure form: `const r = mulberry32(seed); r()`. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    const [v, n] = mulberry32Step(s);
    s = n;
    return v;
  };
}

/** Mutable RNG wrapper over a numeric state (used inside the engine on cloned state). */
export class Rng {
  state: number;
  constructor(state: number) {
    this.state = state >>> 0;
  }
  next(): number {
    const [v, n] = mulberry32Step(this.state);
    this.state = n;
    return v;
  }
  /** true with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/** A fresh random seed (non-deterministic; use for new runs). */
export function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}
