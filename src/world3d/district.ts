// ─────────────────────────────────────────────────────────────────────────────
// DISTRICT — the urban fabric. For each city a deterministic street grid with
// plots that face streets, so buildings have frontages, corners and back yards
// instead of scattering in the round. Grid geometry is keyed off city.id only:
// identical layouts across reloads and branches.
//
// Scale convention: 1 world unit ≈ 3 m (capital towers ~15 u ≈ 45 m). Streets
// are 2.6 u (two lanes), sidewalks 0.55 u, house plots ~2×1.7 u.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { CityLayout } from './layout';
import { heightAt } from './terrain';

export interface Plot {
  x: number; z: number;          // plot center in world space
  w: number; d: number;          // footprint extents (along x before rotation)
  rot: number;                   // rotation: building faces the street (+x side)
  dist: number;                  // 0..1 normalized distance from city core (0 core → 1 edge)
  kind: 'house' | 'apartment' | 'office' | 'industrial' | 'civic';
  lotIndex: number;
}

export interface CityStreet {
  x: number; z: number;          // center of the street line
  angle: number;                 // world rotation of the street line
  halfLen: number;
  main: boolean;                 // boulevard (wider, marked)
}

export interface District {
  streets: CityStreet[];
  intersections: Array<[number, number]>;
  plots: Plot[];
  /** outer-ring housing plots: unbuilt until the settlement outgrows its footprint */
  suburbPlots: Plot[];
  plaza: { x: number; z: number } | null;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLOCK = 5.2;               // street pitch (5.2 u ≈ 15.6 m blocks + streets)
export const STREET_HALF = 1.3;  // asphalt half-width (2.6 u street)
const PLOT_W = 3.1;              // along-street plot pitch

export function buildDistrict(city: CityLayout): District {
  const rng = mulberry(hashStr(city.id + '-grid'));
  const baseRot = rng() * Math.PI * 2;          // each city its own grain
  const R = city.districtRadius * 1.06;
  const streets: CityStreet[] = [];
  const intersections: Array<[number, number]> = [];
  const plots: Plot[] = [];

  const mainAngle = baseRot;
  const crossAngle = baseRot + Math.PI / 2;

  // boulevards + streets along both axes
  const mainPitch = BLOCK * 2;
  const pitch = BLOCK;
  const lineSpecs: Array<{ angle: number; offset: number; main: boolean }> = [];
  for (let o = -R; o <= R; o += pitch) {
    lineSpecs.push({ angle: mainAngle, offset: o, main: false });
    lineSpecs.push({ angle: crossAngle, offset: o, main: false });
  }
  lineSpecs.push({ angle: mainAngle, offset: 0, main: true });
  lineSpecs.push({ angle: crossAngle, offset: 0, main: true });
  for (let o = -R; o <= R; o += mainPitch) {
    if (Math.abs(o) < 0.01) continue;
    lineSpecs.push({ angle: mainAngle, offset: o, main: true });
    lineSpecs.push({ angle: crossAngle, offset: o, main: true });
  }

  // trim streets to a circle and skip water
  const dir = (angle: number) => new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  for (const spec of lineSpecs) {
    const d = dir(spec.angle);
    // half length so the line stays inside the circle of radius R
    const half = Math.sqrt(Math.max(0, R * R - spec.offset * spec.offset));
    if (half < 1.6) continue;
    // sample for water: streets stop before the sea
    let cut = half;
    for (let s = half; s > 2.4; s -= 1.2) {
      const x = city.x + d.x * spec.offset - d.y * s;
      const z = city.z + d.y * spec.offset + d.x * s;
      if (heightAt(x, z) > 1.35) break;
      void x; void z;
    }
    let s = 2.4;
    for (; s <= half; s += 1.2) {
      const px = city.x + d.x * spec.offset - d.y * s;
      const pz = city.z + d.y * spec.offset + d.x * s;
      if (heightAt(px, pz) < 1.35) { s -= 1.2; break; }
    }
    cut = Math.min(s, half);
    let s2 = 2.4;
    for (; s2 <= half; s2 += 1.2) {
      const px = city.x + d.x * spec.offset + d.y * s2;
      const pz = city.z + d.y * spec.offset - d.x * s2;
      if (heightAt(px, pz) < 1.35) { s2 -= 1.2; break; }
    }
    const cut2 = Math.min(s2, half);
    const mid = (cut - cut2) / 2;
    if (cut + cut2 < 4.5) continue;
    const cx = city.x + d.x * spec.offset + d.y * (mid);
    const cz = city.z + d.y * spec.offset - d.x * (mid);
    streets.push({ x: cx, z: cz, angle: spec.angle, halfLen: (cut + cut2) / 2, main: spec.main });
  }

  // plots: walk each street, place plots on the positive-side frontage
  // (one side per street to avoid double-fronted collisions; cross streets
  // naturally fill the other sides of blocks)
  let lot = 0;
  for (const st of streets) {
    const d = dir(st.angle);
    const side = 1;
    const off = STREET_HALF + 0.75 + 0.9;   // street half + sidewalk + yard
    const n = Math.floor(st.halfLen / PLOT_W);
    for (let i = 0; i < n; i++) {
      const along = (i - n / 2 + 0.5) * PLOT_W;
      const px = st.x + d.x * along - d.y * side * off;
      const pz = st.z + d.y * along + d.x * side * off;
      const h = heightAt(px, pz);
      if (h < 1.35) continue;
      // facing rotation: plot faces back toward the street
      const rot = st.angle - side * Math.PI / 2;
      // normalized distance from center (drives district kinds)
      const dist = Math.hypot(px - city.x, pz - city.z) / city.districtRadius;
      plots.push({ x: px, z: pz, w: PLOT_W * 0.92, d: 2.1, rot, dist, kind: 'house', lotIndex: lot++ });
    }
  }

  // district assignment by distance & city kind
  for (const p of plots) {
    if (city.kind === 'industrial') {
      if (p.dist < 0.38) p.kind = 'industrial';
      else if (p.dist < 0.62) p.kind = 'apartment';
      else p.kind = 'house';
    } else if (city.kind === 'campus') {
      if (p.dist < 0.34) p.kind = 'office';
      else if (p.dist < 0.42) p.kind = 'civic';
      else if (p.dist < 0.72) p.kind = 'apartment';
      else p.kind = 'house';
    } else if (city.kind === 'port') {
      if (p.dist < 0.3) p.kind = 'industrial';
      else if (p.dist < 0.42) p.kind = 'office';
      else if (p.dist < 0.68) p.kind = 'apartment';
      else p.kind = 'house';
    } else if (city.kind === 'energy') {
      if (p.dist < 0.3) p.kind = 'industrial';
      else if (p.dist < 0.44) p.kind = 'civic';
      else if (p.dist < 0.7) p.kind = 'apartment';
      else p.kind = 'house';
    } else { // capital & frontier
      if (p.dist < 0.3) p.kind = 'office';
      else if (p.dist < 0.34) p.kind = 'civic';
      else if (p.dist < 0.66) p.kind = 'apartment';
      else p.kind = 'house';
    }
  }

  // ── suburb ring: the ground the city grows onto ────────────────────────────
  // Two outer half-rings of plots beyond the original grid. They carry the
  // same Plot identity rules as the inner city; Buildings keeps them unbuilt
  // (open fields) until the settlement actually outgrows its footprint.
  const suburbPlots: Plot[] = [];
  for (const ring of [1.16, 1.42] as const) {
    const rr = city.districtRadius * ring;
    const step = 15;
    for (let a = 0; a < 360; a += step) {
      const ang = (a + ring * 40) * Math.PI / 180;
      const px = city.x + Math.cos(ang) * rr;
      const pz = city.z + Math.sin(ang) * rr;
      if (heightAt(px, pz) < 1.35) continue;
      suburbPlots.push({
        x: px, z: pz, w: PLOT_W * 0.92, d: 2.0, rot: ang + Math.PI / 2,
        dist: 1 + ring, kind: 'house', lotIndex: 5000 + suburbPlots.length,
      });
    }
  }

  return { streets, intersections, plots, suburbPlots, plaza: null };
}

const cache = new Map<string, District>();
export function cityDistrict(city: CityLayout): District {
  let d = cache.get(city.id);
  if (!d) { d = buildDistrict(city); cache.set(city.id, d); }
  return d;
}
