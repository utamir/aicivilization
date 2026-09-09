// Seeded RNG — mulberry32 with explicit serializable state.
// Substreams are derived by hashing (seed, stream) so branches stay deterministic.

export function hash32(a: number, b: number): number {
  let h = (a >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface Rng {
  state: number; // serializable
}

export function makeRng(seed: number, stream = 0): Rng {
  return { state: hash32(seed >>> 0, stream >>> 0) || 0x1a2b3c4d };
}

export function nextFloat(r: Rng): number {
  r.state = (r.state + 0x6d2b79f5) >>> 0;
  let t = r.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(r: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * nextFloat(r);
}

/** Approximate standard normal via Box–Muller. */
export function gaussian(r: Rng): number {
  let u = 0;
  while (u === 0) u = nextFloat(r);
  const v = nextFloat(r);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function normal(r: Rng, mu: number, sigma: number): number {
  return mu + sigma * gaussian(r);
}

export function chance(r: Rng, p: number): boolean {
  return nextFloat(r) < p;
}

/** Logistic draw centered at mu with scale s — used for epistemic parameter sampling. */
export function sampleClamped(r: Rng, mu: number, sigma: number, lo: number, hi: number): number {
  const v = normal(r, mu, sigma);
  return Math.min(hi, Math.max(lo, v));
}
