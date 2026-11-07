// ─────────────────────────────────────────────────────────────────────────────
// BUILDINGS — part-based architecture on street-facing plots. Buildings are
// composed from positioned parts (walls, gable roofs, recessed windows with
// frames, doors, balconies, chimneys, rooftop equipment, construction cranes)
// generated deterministically per lot (district.ts + architect.ts).
//
// Evolution is driven by the simulation: built/active fractions decide which
// plots stand and which are occupied; the city's era tier decides façade
// modernity (0 contemporary → 1 modernized → 2 advanced) with heritage
// protection for the oldest core; actively growing cities show construction
// sites with cranes on their newest plots. Plots never move.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITIES, type CityLayout } from './layout';
import { cityDistrict } from './district';
import { generateBuilding, type BuildingSpec, type PartKind } from './architect';
import { generateArcology, type ArcPart } from './arcology';
import { skyState } from './skyState';
import type { WorldVisual } from './cityVisuals';
import { heightAt } from './terrain';
import { plasterFacade, brickFacade, concreteFacade, panelFacade, tileRoof, seamRoof, membraneRoof, textureSeed } from './textures';
import { patchWorldUV } from './worldUV';

// ── geometry ─────────────────────────────────────────────────────────────────
// unit box, scaled per instance
const BOX = new THREE.BoxGeometry(1, 1, 1);
// triangular prism with its ridge along +X: houses & sawtooth roofs
function gableGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    // two slope faces (quads → 2 tris each)
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0,     // front slope (z-)
    0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0,       // back slope (z+)
    // triangular ends
    -0.5, 0, -0.5, -0.5, 1, 0, -0.5, 0, 0.5,
    0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0,
    // bottom
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5,
  ]);
  const idx = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const GABLE = gableGeometry();

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

// ── materials ────────────────────────────────────────────────────────────────
function mat(color: string, rough: number, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
// shared glass: windows glow at night; brownouts dim everything
function glassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#2a3138', roughness: 0.2, metalness: 0.35,
    emissive: new THREE.Color('#ffcf8e'), emissiveIntensity: 0,
  });
}

// textured facade/roof materials: light-neutral tiles tinted by instanceColor.
// Textures are generated once (canvas) and applied via the world-UV patch so
// texel density is true to meters on every box regardless of instance scale.
let familyMats: Record<BucketKind, THREE.MeshStandardMaterial> | null = null;
function familyMaterials(): Record<BucketKind, THREE.MeshStandardMaterial> {
  if (familyMats) return familyMats;
  textureSeed(20260907);
  const plaster = plasterFacade('#f0ebe2');
  const brick = brickFacade('#f0e8e0', '#c9c2b6');
  const concrete = concreteFacade('#edeae4');
  const panel = panelFacade('#f0f0ee');
  const tile = tileRoof('#f2e8e0');
  const seam = seamRoof('#e8ecef');
  const membrane = membraneRoof('#efefec');
  const mk = (tex: THREE.CanvasTexture, metersPerRepeat: number, rough = 0.9) => {
    const m = mat('#ffffff', rough);
    m.map = tex;
    patchWorldUV(m, metersPerRepeat);
    return m;
  };
  familyMats = {
    wallPlaster: mk(plaster, 3.4, 0.95),
    wallBrick: mk(brick, 3.4, 0.95),
    wallConcrete: mk(concrete, 3.0, 0.85),
    wallPanel: mk(panel, 3.2, 0.7),
    gableTile: mk(tile, 2.6, 0.85),
    gableSeam: mk(seam, 2.2, 0.6),
    slab: mk(membrane, 3.0, 0.9),
    rail: mat('#8a8478', 0.6, 0.4),
    winFrame: mat('#f2f0ea', 0.7),
    winGlass: glassMaterial(),
    glassBand: glassMaterial(),
    context: mat('#ffffff', 0.9),
    // arcology: warm ceramic with concrete texture (paler = newer, weathered = darker)
    arcCore: mk(concreteFacade('#f0ebe2'), 3.0, 0.65),
    arcSlab: mk(concreteFacade('#ede6da'), 2.4, 0.6),
    arcRing: mat('#3a4148', 0.4, 0.5),
    arcGreen: mat('#4a7a3c', 0.95),
    arcDebris: mk(concreteFacade('#b0aaa0'), 2.0, 0.9),
    // glazing: lit at night through the shared emissive material
    arcGlass: (() => { const m = glassMaterial(); m.color.set('#2f3f4a'); return m; })(),
    arcPier: mk(concreteFacade('#f2ece2'), 1.6, 0.6),
    arcPlanter: mk(concreteFacade('#cfc8ba'), 1.8, 0.85),
  };
  return familyMats;
}

// which parts render into which instanced bucket
type BucketKind =
  | 'wallPlaster' | 'wallBrick' | 'wallConcrete' | 'wallPanel'
  | 'gableTile' | 'gableSeam' | 'slab' | 'rail' | 'winFrame' | 'winGlass' | 'glassBand' | 'context'
  | 'arcCore' | 'arcSlab' | 'arcRing' | 'arcGreen' | 'arcDebris' | 'arcGlass' | 'arcPier' | 'arcPlanter';

// HEX: hexagonal prism with radius 1, height 1, base at y=0 (origin at base center)
// CENTER-origin hex prism, matching the box parts' positioning convention.
function hexGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(1, 1, 1, 6, 1);
}
const HEX = hexGeometry();

// arcology part → bucket
function arcBucket(kind: ArcPart['kind']): BucketKind {
  switch (kind) {
    case 'core': case 'podium': case 'crown': case 'fin': return 'arcCore';
    case 'slab': case 'fascia': case 'bridge': return 'arcSlab';
    case 'ring': return 'arcRing';
    case 'green': return 'arcGreen';
    case 'glass': return 'arcGlass';
    case 'pier': return 'arcPier';
    case 'planter': case 'patch': return 'arcPlanter';
    case 'brace': return 'arcRing';
    default: return 'arcDebris';
  }
}

const WALL_BUCKET: Record<string, BucketKind> = {
  plaster: 'wallPlaster', brick: 'wallBrick', concrete: 'wallConcrete', panel: 'wallPanel',
};
const GABLE_BUCKET: Record<string, BucketKind> = { tile: 'gableTile', seam: 'gableSeam', membrane: 'gableSeam' };

function bucketFor(kind: PartKind, family?: string): BucketKind {
  switch (kind) {
    case 'wall': case 'shell': case 'door': case 'chimney': case 'stack':
    case 'ac': case 'canopy': case 'craneMast':
      return (family && WALL_BUCKET[family]) || 'wallPlaster';
    case 'gable':
      return (family && GABLE_BUCKET[family]) || 'gableTile';
    case 'flatroof': case 'balcony': case 'solarRoof': case 'greenRoof': case 'pier': case 'craneBoom':
      return 'slab';
    case 'context': return 'context';
    case 'debris': return 'context';
    case 'rail': return 'rail';
    case 'winFrame': return 'winFrame';
    case 'winGlass': return 'winGlass';
    case 'glassBand': return 'glassBand';
  }
}
const BUCKETS: BucketKind[] = ['wallPlaster', 'wallBrick', 'wallConcrete', 'wallPanel', 'gableTile', 'gableSeam', 'slab', 'rail', 'winFrame', 'winGlass', 'glassBand', 'context', 'arcCore', 'arcSlab', 'arcRing', 'arcGreen', 'arcDebris', 'arcGlass', 'arcPier', 'arcPlanter'];

const GEO_OF: Record<BucketKind, THREE.BufferGeometry> = {
  wallPlaster: BOX, wallBrick: BOX, wallConcrete: BOX, wallPanel: BOX,
  gableTile: GABLE, gableSeam: GABLE,
  slab: BOX, rail: BOX, winFrame: BOX, winGlass: BOX, glassBand: BOX, context: BOX,
  arcCore: HEX, arcSlab: HEX, arcRing: HEX, arcGreen: HEX, arcDebris: BOX,
  arcGlass: HEX, arcPier: BOX, arcPlanter: HEX,
};
// instanceColor multiplies the (light) texture: keep tints subtle
const TINT_OF: Record<BucketKind, number> = {
  wallPlaster: 0.05, wallBrick: 0.05, wallConcrete: 0.04, wallPanel: 0.05,
  gableTile: 0.05, gableSeam: 0.05, slab: 0.06, rail: 0.1, winFrame: 0.0, winGlass: 0.25, glassBand: 0.2, context: 0.0,
  arcCore: 0.03, arcSlab: 0.02, arcRing: 0.0, arcGreen: 0.18, arcDebris: 0.06,
  arcGlass: 0.05, arcPier: 0.03, arcPlanter: 0.03,
};

function quantize(f: number) { return Math.round(f * 120) / 120; }

function CityArchitecture({ city, visualRef }: { city: CityLayout; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const district = useMemo(() => cityDistrict(city), [city]);
  // plots sorted core → edge: the core is the oldest fabric (heritage), the
  // edge is where growth and construction happen
  const plots = useMemo(
    () => [...district.plots].sort((a, b) => a.dist - b.dist || a.lotIndex - b.lotIndex),
    [district],
  );
  const bucketRefs = useRef<Partial<Record<BucketKind, THREE.InstancedMesh>>>({});
  const applied = useRef({ built: -1, active: -1, era: -1 as number, vert: -1, der: -1, sub: -1, rd: -1 });
  const specsRef = useRef<BuildingSpec[]>([]);
  const arcSetRef = useRef<Set<number>>(new Set());
  const countsRef = useRef<Record<BucketKind, number>>({ wallPlaster: 0, wallBrick: 0, wallConcrete: 0, wallPanel: 0, gableTile: 0, gableSeam: 0, slab: 0, rail: 0, winFrame: 0, winGlass: 0, glassBand: 0, context: 0, arcCore: 0, arcSlab: 0, arcRing: 0, arcGreen: 0, arcDebris: 0, arcGlass: 0, arcPier: 0, arcPlanter: 0 });

  // which plots become arcologies at the advanced era (tier 2). Selected
  // deterministically among the newer half of plots (mid-core → edge), never
  // on heritage fabric or industrial yards. Arcology adoption scales with
  // development: a handful at the start, a cluster at high development.
  const arcologyAdoption = (era: 0 | 1 | 2, vis: NonNullable<WorldVisual['cities'][number]> | undefined): number => {
    if (era < 2) return 0;
    const vertical = vis?.vertical ?? 0; // sim-driven vertical-build pressure
    const base = 0.18 + Math.min(0.35, vertical * 0.6);
    return base;
  };
  const selectArcologies = (era: 0 | 1 | 2, vis: NonNullable<WorldVisual['cities'][number]> | undefined) => {
    const adoption = arcologyAdoption(era, vis);
    const set = new Set<number>();
    if (adoption > 0) {
      const target = Math.max(2, Math.round(plots.length * adoption * 0.18));
      const start = Math.floor(plots.length * 0.24);
      const end = Math.floor(plots.length * 0.92);
      for (let i = start; i < end && set.size < target; i++) {
        const p = plots[i];
        if (!p || p.kind === 'industrial') continue;
        // deterministic hash selects which plots host towers
        const h = Math.abs(Math.sin(p.lotIndex * 37.1 + city.id.length * 3)) % 1;
        if (h < 0.55) set.add(p.lotIndex);
      }
    }
    arcSetRef.current = set;
  };

  // build specs for the whole city at a given era tier (heritage keeps core old)
  const buildSpecs = (era: 0 | 1 | 2) => {
    const heritageMax = Math.floor(plots.length * 0.22);
    specsRef.current = plots.map((p, i) => {
      const heritage = i < heritageMax;
      const tier = heritage ? 0 : (era >= 2 ? 2 : era) as 0 | 1 | 2;
      return generateBuilding(p, { tier, state: 'active', seed: p.lotIndex * 977 + city.id.length * 31 + 7, era });
    });
    // size buckets from the fullest possible spec set
    const counts = countsRef.current;
    for (const k of Object.keys(counts) as BucketKind[]) counts[k] = 0;
    for (const s of specsRef.current) for (const part of s.parts) counts[bucketFor(part.kind, part.family)]++;
    // arcology bucket capacity: generous bound over the maximum possible
    // adoption (adoption ≤ 0.53) and the tallest tower (14 floors), so no
    // tower part is ever silently dropped when vertical pressure is high.
    if (era >= 2) {
      const maxTowers = Math.ceil(plots.length * 0.53 * 0.18) + 1;
      counts.arcCore += maxTowers * 16;
      counts.arcSlab += maxTowers * 18;
      counts.arcRing += maxTowers * 16;
      counts.arcGreen += maxTowers * 40;
      counts.arcDebris += maxTowers * 24;
      counts.arcGlass += maxTowers * 20;
      counts.arcPier += maxTowers * 80;
      counts.arcPlanter += maxTowers * 24;
    }
    countsRef.current = counts;
  };
  // Capacity is computed ONCE for the worst case (era 2) because instanced
  // mesh counts are fixed at mount and cannot grow later. Specs still rebuild
  // per era; only the buffer sizes are pre-allocated.
  const capacity = useMemo(() => {
    buildSpecs(2);
    return { ...countsRef.current };
  }, [plots]);
  // Redevelopment eligibility: non-heritage houses and apartments, ordered
  // core-ward (land value is highest near the centre). These redevelop into
  // higher-density blocks as the city densifies.
  const redevOrder = useMemo(() => {
    const heritageMax = Math.floor(plots.length * 0.22);
    return plots
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i >= heritageMax && (p.kind === 'house' || p.kind === 'apartment'))
      .sort((a, b) => a.p.dist - b.p.dist || a.i - b.i);
  }, [plots]);
  useMemo(() => buildSpecs(0), [plots]);

  const writeCity = (vis: NonNullable<WorldVisual['cities'][number]> | undefined, builtF: number, activeF: number, era: 0 | 1 | 2) => {
    const specs = specsRef.current;
    if (!vis) return;
    const N = plots.length;
    const builtCount = Math.floor(N * builtF);
    const activeCount = Math.min(builtCount, Math.floor(N * activeF));
    const derelictBand = Math.floor(builtCount * vis.derelict * 0.9);
    const constructionBand = vis.growth > 1.03 ? Math.min(5, Math.max(2, Math.floor(N * 0.045))) : 0;
    const cursors: Record<BucketKind, number> = { wallPlaster: 0, wallBrick: 0, wallConcrete: 0, wallPanel: 0, gableTile: 0, gableSeam: 0, slab: 0, rail: 0, winFrame: 0, winGlass: 0, glassBand: 0, context: 0, arcCore: 0, arcSlab: 0, arcRing: 0, arcGreen: 0, arcDebris: 0, arcGlass: 0, arcPier: 0, arcPlanter: 0 };
    const meshes = bucketRefs.current;
    // Redevelopment pressure: population beyond the original footprint, eased by
    // visible crowding (unmet demand pressures land use the fastest).
    const popRatio = vis.population / Math.max(0.001, city.basePop);
    const redev = Math.max(0, Math.min(1, (popRatio - 1.1) * 0.8 + vis.crowding * 0.12));
    const redevCount = Math.floor(redevOrder.length * redev);
    let redevCursor = 0;
    void skyState.nightFactor;
    void vis.nightDim;
    selectArcologies(era, vis);
    const arcSet = arcSetRef.current;

    const writePart = (bucket: BucketKind, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY: number, color: string, tintJitter: number, rot?: [number, number, number]) => {
      const cursor = cursors[bucket]++;
      const mesh = meshes[bucket];
      if (!mesh || cursor >= mesh.count) return;
      tmpObj.position.set(x, y, z);
      if (rot) tmpObj.rotation.set(rot[0], rot[1], rot[2], 'XYZ');
      else tmpObj.rotation.set(0, rotY, 0);
      tmpObj.scale.set(sx, sy, sz);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(cursor, tmpObj.matrix);
      tmpColor.set(color);
      const tint = TINT_OF[bucket];
      if (tint > 0) tmpColor.offsetHSL(0, 0, tintJitter * tint * 2);
      mesh.setColorAt(cursor, tmpColor);
    };

    for (let i = 0; i < N; i++) {
      const spec = specs[i];
      if (!spec) continue;
      let state: BuildingSpec['state'];
      if (i >= builtCount) continue; // not built: hidden (ground shows)
      else if (i >= builtCount - constructionBand && activeCount > 0) state = 'construction';
      else if (i >= builtCount - derelictBand && derelictBand > 0) state = 'derelict';
      else if (i < activeCount) state = 'active';
      else state = 'built'; // vacant but intact

      // arcology: a distinctive future structure replaces the plot's building
      const isArc = arcSet.has(spec.plot.lotIndex);
      if (isArc && era >= 2 && state !== 'construction') {
        // lifecycle derived from this plot's own sim condition + age hash
        const age = (Math.abs(Math.sin(spec.plot.lotIndex * 53.3)) % 1);
        const arcState: 'occupied' | 'aged' | 'ruined' =
          state === 'derelict' ? 'ruined'
          : vis.derelict > 0.04 && age < vis.derelict * 1.4 ? 'ruined'
          : state === 'built' || age < 0.3 ? 'aged'
          : 'occupied';
        const arc = generateArcology(spec.plot, { seed: spec.plot.lotIndex * 977 + 11, state: arcState });
        for (const p of arc.parts) {
          // hex prisms have base at y=0; arcology parts use center-y already
          writePart(arcBucket(p.kind), p.x, p.y, p.z, p.sx, p.sy, p.sz, p.rotY, p.color, 0, p.rot);
        }
        continue;
      }

      // redevelopment: low-rise fabric re-emerges as higher-density blocks,
      // staged plot by plot with construction sites on the current front
      let density = 0;
      const entry = redevOrder[redevCursor];
      if (entry && entry.i === i && redevCount > 0) {
        redevCursor++;
        const k = redevCursor;
        if (k <= redevCount) {
          const h = Math.abs(Math.sin(spec.plot.lotIndex * 53.3 + 7)) % 1;
          density = h < 0.45 ? 1 : 2;
          if (redev < 0.97 && k > redevCount - 3) state = 'construction';
          else state = state === 'derelict' ? 'derelict' : 'active';
        }
      }
      // regenerate this spec's parts for its state
      const fresh = generateBuilding(spec.plot, {
        tier: spec.tier, state,
        seed: spec.plot.lotIndex * 977 + city.id.length * 31 + 7, era,
        density,
      });
      for (const part of fresh.parts) {
        writePart(bucketFor(part.kind, part.family), part.x, part.y, part.z, part.sx, part.sy, part.sz, part.rotY, part.color, (spec.plot.lotIndex % 7 / 7 - 0.5));
      }
    }

    // ── suburb ring: the ground the city grows onto ──────────────────────────
    // Plots beyond the original footprint fill when the settlement outgrows
    // its base (population × primacy pressure), and never exist for shrinking
    // settlements — where the countryside stays open.
    const suburbBuilt = Math.max(0, Math.min(1, (popRatio - 0.94) * 1.4));
    const suburbN = Math.floor(district.suburbPlots.length * suburbBuilt);
    for (let i = 0; i < district.suburbPlots.length; i++) {
      if (i >= suburbN) continue; // open fields: not built yet
      const p = district.suburbPlots[i];
      const state: BuildingSpec['state'] = (i >= suburbN - 2 && vis.growth > 1.05) ? 'construction'
        : (i < activeCount * 0.9) ? 'active' : 'built';
      const fresh = generateBuilding(p, {
        tier: era >= 2 ? 1 : 0, state,
        seed: (p.lotIndex * 977 + city.id.length * 31 + 19), era,
      });
      for (const part of fresh.parts) {
        writePart(bucketFor(part.kind, part.family), part.x, part.y, part.z, part.sx, part.sy, part.sz, part.rotY, part.color, (p.lotIndex % 5 / 5 - 0.5));
      }
    }
    // park unused slots far below
    tmpObj.position.set(0, -90, 0);
    tmpObj.rotation.set(0, 0, 0);
    tmpObj.scale.setScalar(0.001);
    tmpObj.updateMatrix();
    for (const bucket of BUCKETS) {
      const mesh = meshes[bucket];
      const used = cursors[bucket];
      if (!mesh) continue;
      for (let i = used; i < mesh.count; i++) mesh.setMatrixAt(i, tmpObj.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };

  useFrame(() => {
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
    if (!vis) return;
    // night glow of windows: shared emissive material tracks darkness & brownouts
    familyMaterials().winGlass.emissiveIntensity = skyState.nightFactor * 0.9 * (1 - vis.nightDim * 0.82);
    const b = quantize(vis.builtFraction);
    const a = quantize(vis.activeFraction);
    const era = vis.era;
    // vertical pressure changes which plots host arcologies; include it in the
    // dirty key so towers appear as the sim develops and update their state.
    const vert = Math.round(vis.vertical * 10) / 10;
    const der = Math.round(vis.derelict * 20) / 20;
    const popRatio0 = vis.population / Math.max(0.001, city.basePop);
    const sub = Math.round(Math.max(0, Math.min(1, (popRatio0 - 0.94) * 1.4)) * 40) / 40;
    const rd = Math.round(Math.max(0, Math.min(1, (popRatio0 - 1.1) * 0.8 + vis.crowding * 0.12)) * 60) / 60;
    if (b === applied.current.built && a === applied.current.active && era === applied.current.era
        && vert === applied.current.vert && der === applied.current.der && sub === applied.current.sub
        && rd === applied.current.rd) return;
    if (era !== applied.current.era) buildSpecs(era);
    applied.current = { built: b, active: a, era, vert, der, sub, rd };
    writeCity(vis, b, a, era);
  });

  const mats = familyMaterials();
  const counts = capacity;
  return (
    <group>
      {BUCKETS.map((bucket) => {
        const count = Math.max(1, counts[bucket]);
        const shadow = bucket.startsWith('wall') || bucket.startsWith('gable') || bucket === 'slab';
        return (
          <instancedMesh
            key={bucket}
            ref={(m) => { if (m) bucketRefs.current[bucket] = m; }}
            args={[undefined, undefined, count]}
            castShadow={shadow}
            receiveShadow
            frustumCulled={false}
            material={mats[bucket]}
          >
            <primitive object={GEO_OF[bucket]} attach="geometry" />
          </instancedMesh>
        );
      })}
    </group>
  );
}

// legacy scatter-lot generator — kept for Frontier's ruin layer until it
// migrates to plots
export interface Lot { dx: number; dz: number; baseH: number; w: number; d: number; rot: number; district: number; }
export function genLots(city: CityLayout): Lot[] {
  const rng = makeRngCompat(hashStr(city.id), 7);
  const count = city.kind === 'capital' ? 400 : city.kind === 'industrial' ? 470 : city.kind === 'campus' ? 330 : city.kind === 'port' ? 260 : 210;
  const lots: Lot[] = [];
  for (let i = 0; i < count; i++) {
    const ang = nextFloatCompat(rng) * Math.PI * 2;
    const rr = Math.sqrt(nextFloatCompat(rng)) * city.districtRadius;
    const x = city.x + Math.cos(ang) * rr;
    const z = city.z + Math.sin(ang) * rr;
    if (heightAt(x, z) < 1.2) continue;
    const t = rr / city.districtRadius;
    let district: number;
    if (city.kind === 'industrial') district = t < 0.2 ? 0 : t < 0.5 ? 3 : t < 0.8 ? 3 : 2;
    else if (city.kind === 'port') district = t < 0.22 ? 0 : t < 0.55 ? 2 : t < 0.75 ? 3 : 2;
    else district = t < 0.22 ? 0 : t < 0.6 ? 1 : 2;
    if (city.kind === 'campus' && district === 1 && nextFloatCompat(rng) < 0.4) district = 2;
    const tall = district === 0;
    const mid = district === 1;
    const baseH = tall ? 5 + nextFloatCompat(rng) * 10 : mid ? 2 + nextFloatCompat(rng) * 4.5 : district === 3 ? 1.4 + nextFloatCompat(rng) * 1.8 : 1.1 + nextFloatCompat(rng) * 2.3;
    const w = tall ? 1.3 + nextFloatCompat(rng) * 0.9 : 1.0 + nextFloatCompat(rng) * 1.0;
    const d = w;
    lots.push({ dx: x - city.x, dz: z - city.z, baseH, w, d, rot: Math.floor(nextFloatCompat(rng) * 4) * (Math.PI / 2), district });
  }
  return lots.sort((a, b) => (a.dx * a.dx + a.dz * a.dz) - (b.dx * b.dx + b.dz * b.dz));
}
// tiny local rng (mirrors sim/rng helpers without importing)
function makeRngCompat(seed: number, stream: number) { let a = (seed ^ (stream * 7919)) >>> 0; return { get s() { return a; } , next: () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }; }
function nextFloatCompat(r: ReturnType<typeof makeRngCompat>): number { return r.next(); }
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── Shantytowns & smog — housing shortage and waste made visible ─────────────
// Informal settlements appear on the ring just outside the street grid when
// crowding bites; waste reads as soft haze hugging the city.
const MAX_SHANTY = 26;

const SMOG_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SMOG_FRAG = /* glsl */ `
uniform float uWaste;
uniform vec3 uFogColor;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float center = max(dot(vN, V), 0.0);
  float alpha = pow(center, 1.7) * uWaste * 0.55;
  gl_FragColor = vec4(mix(vec3(0.42, 0.38, 0.33), uFogColor, 0.35), alpha);
}
`;

function CityFringe({ city, visualRef }: { city: CityLayout; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const shantyRef = useRef<THREE.InstancedMesh>(null);
  const smogRef = useRef<THREE.Mesh>(null);
  const smogMat = useRef<THREE.ShaderMaterial>(null);
  const huts = useMemo(() => {
    const rng = makeRngCompat(hashStr(city.id + '-sh'), 11);
    return Array.from({ length: MAX_SHANTY }, () => {
      const ang = nextFloatCompat(rng) * Math.PI * 2;
      const rr = city.districtRadius * (1.02 + nextFloatCompat(rng) * 0.33);
      return { dx: Math.cos(ang) * rr, dz: Math.sin(ang) * rr, s: 0.35 + nextFloatCompat(rng) * 0.35, rot: nextFloatCompat(rng) * Math.PI };
    });
  }, [city]);

  useFrame(() => {
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
    const mesh = shantyRef.current;
    if (mesh) {
      const crowd = vis?.crowding ?? 0;
      const n = Math.round(clampN(crowd - 0.1, 0, 1) * MAX_SHANTY * 1.4);
      for (let i = 0; i < MAX_SHANTY; i++) {
        if (i < n) {
          const h = huts[i];
          const x = city.x + h.dx;
          const z = city.z + h.dz;
          tmpObj.position.set(x, heightAt(x, z) + h.s * 0.28, z);
          tmpObj.rotation.set(0, h.rot, 0);
          tmpObj.scale.set(h.s, h.s * 0.55, h.s);
        } else {
          tmpObj.position.set(0, -60, 0);
          tmpObj.scale.setScalar(0.001);
        }
        tmpObj.updateMatrix();
        mesh.setMatrixAt(i, tmpObj.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    const smog = smogRef.current;
    if (smog && smogMat.current) {
      const waste = vis?.waste ?? 0;
      smogMat.current.uniforms.uWaste.value = waste;
      (smogMat.current.uniforms.uFogColor.value as THREE.Color).copy(skyState.fogColor);
      smog.visible = waste > 0.04;
      const r = city.districtRadius * (vis?.sprawl ?? 1) * 1.05;
      smog.scale.set(r, r * 0.34, r);
      smog.position.set(city.x, heightAt(city.x, city.z) + 1.1, city.z);
    }
  });

  return (
    <group>
      <instancedMesh ref={shantyRef} args={[undefined, undefined, MAX_SHANTY]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6b5d4f" roughness={1} />
      </instancedMesh>
      <mesh ref={smogRef} visible={false} renderOrder={2}>
        <sphereGeometry args={[1, 24, 16]} />
        <shaderMaterial
          ref={smogMat}
          vertexShader={SMOG_VERT}
          fragmentShader={SMOG_FRAG}
          uniforms={{ uWaste: { value: 0 }, uFogColor: { value: new THREE.Color('#b8c8d8') } }}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function clampN(x: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, x)); }

export function Buildings({ visualRef }: { visualRef: React.MutableRefObject<WorldVisual | null> }) {
  return (
    <group>
      {CITIES.map((c) => (
        <group key={c.id}>
          <CityArchitecture city={c} visualRef={visualRef} />
          <CityFringe city={c} visualRef={visualRef} />
        </group>
      ))}
    </group>
  );
}
