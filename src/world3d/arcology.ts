// ─────────────────────────────────────────────────────────────────────────────
// ARCOLOGY — hexagonal terraced lattice tower, the advanced settlement family.
//
// What makes it read as a building rather than a stack of trays:
//   • every floor has an ENCLOSED inhabited volume (glazed hexagonal drum) that
//     fills most of the plate; the terrace is a recessed margin outside it;
//   • the tower tapers slightly with height, so the silhouette is one volume;
//   • three continuous buttress fins run the full height at alternating corners;
//   • diagonal lattice braces cross each façade bay between floors (the
//     exoskeleton that carries the plates) — this is the family's signature;
//   • a stone parapet forms the terrace edge, with planting inside it and
//     greenery spilling over the lip;
//   • a wider podium at grade holds entrances and the service apron; a framed
//     crown closes the top.
//
// Lifecycle keeps footprint, orientation, seed and structure:
//   occupied — clean glazing, lush terraces, intact crown.
//   aged     — worn ceramic, some glazing replaced by opaque panels, one fin
//              weathered, terraces overgrown.
//   ruined   — upper floors gone. Surviving floors keep their glazing, mullions
//              and parapets; the severed plates show slab edge, broken parapet
//              ends, exposed rebar and the hollow core mouth. Debris is this
//              building's own material: slab shards at plate thickness, parapet
//              blocks, cladding panels, all at believable scale on the ground.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { Plot } from './district';
import { heightAt } from './terrain';

export type ArcPartKind =
  | 'core' | 'slab' | 'fascia' | 'ring' | 'green' | 'planter'
  | 'pier' | 'glass' | 'fin' | 'podium' | 'crown' | 'brace'
  | 'patch' | 'bridge' | 'debris';

export interface ArcPart {
  kind: ArcPartKind;
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  /** full euler when the part is not axis-aligned (lattice braces) */
  rot?: [number, number, number];
  rotY: number;
  color: string;
}

export interface ArcSpec {
  parts: ArcPart[];
  state: 'occupied' | 'aged' | 'ruined';
  floors: number;
  height: number;
}

const CERAMIC = ['#e9e3d8', '#e2dbce', '#ece6dc', '#dcd5c7'];
const CERAMIC_AGED = ['#c9c2b4', '#bdb6a8', '#d0c9bb'];
const SLAB_EDGE = '#e0d9cb';
const FASCIA = '#5f5d57';
const PLANTER = '#bdb6a7';
const GLASS = '#5d7787';
const GLASS_DARK = '#33424b';
const PATCH = ['#8f8779', '#a38f74', '#7d7a72'];
const GREEN = ['#4d7a3e', '#5c8a49', '#3f6b34', '#6b9a55'];
const DEBRIS = ['#e0d9cb', '#c9c2b4', '#bdb6a7', '#8f8779'];

function pick<T>(arr: T[], r: number): T { return arr[Math.floor(r * arr.length) % arr.length]; }

/** euler for a strut from A to B whose local +Y is the length axis */
function strutRot(dx: number, dy: number, dz: number): [number, number, number] {
  const d = new THREE.Vector3(dx, dy, dz).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

export function generateArcology(
  plot: Plot,
  opts: { seed: number; state: 'occupied' | 'aged' | 'ruined' },
): ArcSpec {
  const r1 = Math.abs(Math.sin(opts.seed * 127.1)) % 1;
  const r2 = Math.abs(Math.sin(opts.seed * 311.7)) % 1;
  const r3 = Math.abs(Math.sin(opts.seed * 74.7)) % 1;
  const r4 = Math.abs(Math.sin(opts.seed * 53.9)) % 1;
  const { state } = opts;

  const parts: ArcPart[] = [];
  const baseH = heightAt(plot.x, plot.z);

  const floors = 6 + Math.floor(r1 * 6);      // 6–11 inhabited terraces
  const floorH = 1.12;
  const coreR = 0.36 + r2 * 0.06;             // service core (lifts, stairs, ducts)
  const plateR0 = coreR * (1.62 + r3 * 0.16); // terrace radius at the base
  const slabT = 0.16;
  const glassH = 0.56;                        // inhabited floor volume height
  const hexRot = r2 * Math.PI / 3;

  const ceramic = state === 'ruined' ? '#b8b1a4'
    : state === 'aged' ? pick(CERAMIC_AGED, r4)
    : pick(CERAMIC, r1);

  /** taper: the tower narrows slightly with height so it reads as one form */
  const taper = (f: number) => 1 - 0.26 * (f / Math.max(1, floors));

  const push = (
    kind: ArcPartKind, dx: number, y: number, dz: number,
    sx: number, sy: number, sz: number, rotY: number, color: string,
    rot?: [number, number, number],
  ) => {
    parts.push({ kind, x: plot.x + dx, y: baseH + y, z: plot.z + dz, sx, sy, sz, rotY, color, rot });
  };

  const standing = state === 'ruined'
    ? Math.max(2, Math.round(floors * (0.34 + r3 * 0.16)))
    : floors;

  // ── podium: wider base with entrance bays and a service apron ─────────────
  const podiumR = plateR0 * 1.18;
  push('podium', 0, 0.2, 0, podiumR * 2, 0.4, podiumR * 2, hexRot, '#d2cbbc');
  push('fascia', 0, 0.0, 0, podiumR * 2.02, 0.1, podiumR * 2.02, hexRot, FASCIA);
  for (let k = 0; k < 3; k++) {
    const a = hexRot + (k * 2 * Math.PI) / 3;
    const er = podiumR * 0.8;
    push('glass', Math.cos(a) * er, 0.42, Math.sin(a) * er, 1.0, 0.5, 0.12, a, GLASS);
    push('ring', Math.cos(a) * (er + 0.2), 0.72, Math.sin(a) * (er + 0.2), 1.25, 0.08, 0.46, a, '#565d65');
  }

  // ── core: hexagonal service spine, full standing height ───────────────────
  const coreTop = 0.4 + standing * floorH;
  push('core', 0, 0.4 + (coreTop - 0.4) / 2, 0, coreR * 2, coreTop - 0.4, coreR * 2, hexRot, ceramic);

  // ── three buttress fins: continuous vertical structure, full height ───────
  const finTop = state === 'ruined' ? coreTop + (r4 - 0.5) * 1.1 : 0.4 + floors * floorH + 0.5;
  for (let k = 0; k < 3; k++) {
    const a = hexRot + (k * 2 * Math.PI) / 3;
    const fr = (coreR + plateR0 * 0.98) / 2;
    push('fin', Math.cos(a) * fr, 0.4 + (finTop - 0.4) / 2, Math.sin(a) * fr,
      plateR0 * 0.98 - coreR, finTop - 0.4, 0.16, a,
      state === 'aged' && k === 1 ? '#9a8f7e' : state === 'ruined' ? '#a7a093' : '#d8d1c3');
  }

  // ── terraces ─────────────────────────────────────────────────────────────
  for (let f = 1; f <= standing; f++) {
    const y = 0.4 + f * floorH;
    const plateR = plateR0 * taper(f);
    // slab: the terrace floor, with a visible light edge
    push('slab', 0, y, 0, plateR * 2, slabT, plateR * 2, hexRot, SLAB_EDGE);
    push('fascia', 0, y - slabT / 2 - 0.06, 0, plateR * 1.99, 0.12, plateR * 1.99, hexRot, FASCIA);

    // INHABITED FLOOR: the glazed volume reaches almost to the plate edge, so
    // the façade is visible from outside. Terraces are recessed INTO it on
    // alternate sectors rather than ringing the whole floor.
    const volR = plateR * 0.9;
    const glassY = y + slabT / 2 + glassH / 2;
    push('glass', 0, glassY, 0, volR * 2, glassH, volR * 2, hexRot,
      state === 'ruined' ? GLASS_DARK : GLASS);

    // continuous structural piers at the six hex corners: these align floor to
    // floor and give the tower its vertical rhythm
    for (let k = 0; k < 6; k++) {
      const a = hexRot + (k * Math.PI) / 3;
      push('pier', Math.cos(a) * volR, glassY, Math.sin(a) * volR, 0.24, glassH + slabT, 0.24, a,
        state === 'aged' && (k + f) % 5 === 0 ? '#a8a196' : '#efe9dd');
    }
    // horizontal spandrel at each floor line (reads as the slab band in elevation)
    push('ring', 0, y + slabT / 2 + 0.04, 0, volR * 2.02, 0.1, volR * 2.02, hexRot, '#cfc8ba');

    // recessed terrace on three sectors: parapet wall + planting behind it
    const sectors = 3;
    for (let k = 0; k < sectors; k++) {
      const a = hexRot + ((k * 2 + (f % 2)) * Math.PI) / 3;
      const lush = state === 'occupied' ? 1 : state === 'aged' ? 0.8 : 0.6;
      // parapet segment at the plate edge (a slab-like wall on that face)
      const prow = plateR * 1.84;
      push('planter', Math.cos(a) * prow, y + slabT / 2 + 0.16, Math.sin(a) * prow,
        plateR * 1.05, 0.34, 0.5, a + Math.PI / 2, PLANTER);
      // planting in the recess between façade and parapet
      push('green', Math.cos(a) * (plateR * 1.62), y + slabT / 2 + 0.34,
        Math.sin(a) * (plateR * 1.62),
        plateR * 0.95 * lush, 0.34 + 0.22 * lush, 0.7 * lush, a + Math.PI / 2,
        pick(GREEN, r2 + f * 0.19 + k));
      // greenery spilling over the parapet lip
      if (f % 2 === 1) {
        push('green', Math.cos(a) * (plateR * 0.99), y + slabT / 2 + 0.06,
          Math.sin(a) * (plateR * 0.99), 0.5, 0.5 * lush, 0.42, a, pick(GREEN, r1 + f + k));
      }
    }

    // diagonal lattice braces between floors, at the perimeter bays (thick
    // enough to read at gameplay distance; they are the family's signature)
    if (f < standing) {
      const y2 = y + floorH;
      const plateR2 = plateR0 * taper(f + 1);
      for (let k = 0; k < 6; k++) {
        const a0 = hexRot + (k * Math.PI) / 3;
        const a1 = hexRot + ((k + 1) * Math.PI) / 3;
        const r0 = plateR * 0.95, r1b = plateR2 * 0.95;
        const from = k % 2 === 0
          ? { x: Math.cos(a0) * r0, z: Math.sin(a0) * r0, y }
          : { x: Math.cos(a1) * r1b, z: Math.sin(a1) * r1b, y: y2 };
        const to = k % 2 === 0
          ? { x: Math.cos(a1) * r1b, z: Math.sin(a1) * r1b, y: y2 }
          : { x: Math.cos(a0) * r0, z: Math.sin(a0) * r0, y };
        const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
        const len = Math.hypot(dx, dy, dz);
        push('brace', (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2,
          0.2, len, 0.2, 0, state === 'aged' ? '#938d83' : '#d6d9dd', strutRot(dx, dy, dz));
      }
    }

    // aged: opaque replacement panel where glazing failed
    if (state === 'aged' && (f + 1) % 3 === 0) {
      const a = hexRot + (f % 6) * Math.PI / 3;
      push('patch', Math.cos(a) * (volR * 1.01), glassY, Math.sin(a) * (volR * 1.01),
        0.5, glassH * 0.94, 0.08, a, pick(PATCH, r1 + f));
    }
  }

  // ── severed top of a ruin ────────────────────────────────────────────────
  if (state === 'ruined') {
    const yTop = 0.4 + standing * floorH;
    const plateR = plateR0 * taper(standing);
    // exposed slab with broken parapet stubs at three points
    push('slab', 0, yTop + 0.06, 0, plateR * 1.55, slabT, plateR * 1.55, hexRot, SLAB_EDGE);
    for (let k = 0; k < 3; k++) {
      const a = hexRot + k * 2.1 + r2;
      const r = plateR * 1.36;
      push('planter', Math.cos(a) * r, yTop + 0.24, Math.sin(a) * r, 0.8, 0.28, 0.3, a, PLANTER);
    }
    // bent reinforcement protruding from the severed slab and core
    for (let k = 0; k < 9; k++) {
      const a = r1 * 6.283 + k * 0.74;
      const r = plateR * (0.42 + (k % 3) * 0.22);
      push('debris', Math.cos(a) * r, yTop + 0.18, Math.sin(a) * r,
        0.05, 0.42 + (k % 3) * 0.2, 0.05, a, '#7c6a58', strutRot(Math.cos(a) * 0.22, 1, Math.sin(a) * 0.22));
    }
    // hollow core mouth
    push('fascia', 0, yTop + 0.16, 0, coreR * 1.35, 0.16, coreR * 1.35, hexRot, '#3a3833');
  }

  // ── crown: framed top with mechanical plant and roof garden ──────────────
  if (state !== 'ruined') {
    const yTop = 0.4 + floors * floorH;
    const plateR = plateR0 * taper(floors);
    // crown: a stepped cap that closes the silhouette
    push('crown', 0, yTop + 0.30, 0, plateR * 1.72, 0.60, plateR * 1.72, hexRot, state === 'aged' ? '#b3aca0' : '#e6e0d4');
    push('ring', 0, yTop + 0.62, 0, plateR * 1.76, 0.08, plateR * 1.76, hexRot, '#5a6169');
    push('crown', 0, yTop + 0.86, 0, plateR * 1.05, 0.5, plateR * 1.05, hexRot + 0.3, state === 'aged' ? '#a8a196' : '#ded8cc');
    push('green', 0, yTop + 1.14, 0, plateR * 0.92, 0.2, plateR * 0.92, hexRot + 0.3, pick(GREEN, r3));
    push('pier', 0, yTop + 1.75, 0, 0.12, 1.5, 0.12, 0, '#9aa1a8');
    // four crown masts at the rim, so the top reads as engineered
    for (let k = 0; k < 4; k++) {
      const a = hexRot + k * Math.PI / 2 + 0.4;
      push('pier', Math.cos(a) * plateR * 0.8, yTop + 0.95, Math.sin(a) * plateR * 0.8,
        0.07, 1.0, 0.07, a, '#9aa1a8');
    }
  }

  // ── sky-bridge to a neighbouring tower ───────────────────────────────────
  if (r1 > 0.58 && state !== 'ruined') {
    const by = 0.4 + floorH * Math.max(2, Math.round(floors * 0.62));
    const out = plateR0 * taper(6) * 0.95;
    push('bridge', out + 0.95, by, 0, 2.0, 0.32, 0.66, hexRot + 0.35, '#d3ccbe');
    push('ring', out + 0.95, by - 0.21, 0, 2.05, 0.07, 0.72, hexRot + 0.35, '#565d65');
  }

  // ── debris: this structure's own materials, at believable scale ─────────
  if (state === 'ruined') {
    const n = 9 + Math.floor(r2 * 7);
    for (let i = 0; i < n; i++) {
      const a = r1 * 6.283 + i * 2.399;
      const dist = plateR0 * (0.85 + (i % 4) * 0.38) + r3 * 0.4;
      const w = 0.4 + (i % 5) * 0.19;
      const kind = i % 3;
      if (kind === 0) {
        // slab shard: exactly the terrace slab thickness
        push('debris', Math.cos(a) * dist, 0.02 + slabT / 2, Math.sin(a) * dist,
          w, slabT, w * (0.7 + r3 * 0.8), a, pick(DEBRIS, i / n));
      } else if (kind === 1) {
        // parapet / planter block
        push('planter', Math.cos(a) * dist, 0.14, Math.sin(a) * dist,
          w * 0.8, 0.28, w * 0.42, a + 0.4, PLANTER);
      } else {
        // cladding panel lying face-up
        push('debris', Math.cos(a) * dist, 0.03, Math.sin(a) * dist,
          w * 0.95, 0.06, w * 0.62, a - 0.3, pick(['#e2dbcf', '#c9c2b4', '#b8b1a4'], r4));
      }
    }
    // colonising vegetation among the debris
    for (let i = 0; i < 5; i++) {
      const a = r3 * 6.283 + i * 1.45;
      const d = plateR0 * (0.9 + (i % 3) * 0.42);
      push('green', Math.cos(a) * d, 0.13, Math.sin(a) * d,
        0.55 + (i % 2) * 0.3, 0.24, 0.5, a, pick(GREEN, r1 + i));
    }
  }

  return { parts, state, floors, height: 0.4 + floors * floorH };
}
