// ─────────────────────────────────────────────────────────────────────────────
// BUILDINGS — instanced city blocks. Facade windows are procedural (shader);
// lit windows at night dim during power scarcity (nightDim). Heights and the
// share of constructed lots grow with simulated population/output.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITIES, type CityLayout } from './layout';
import { heightAt } from './terrain';
import type { WorldVisual } from './cityVisuals';
import { makeRng, nextFloat, range } from '../sim/rng';

export interface Lot {
  dx: number; dz: number; // immutable offset from city center
  baseH: number;      // un-scaled height in world units
  w: number; d: number;
  rot: number;
  district: number;   // 0 downtown, 1 office, 2 residential, 3 industrial
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function genLots(city: CityLayout): Lot[] {
  const rng = makeRng(hashStr(city.id), 7);
  const count = city.kind === 'capital' ? 400 : city.kind === 'industrial' ? 470 : city.kind === 'campus' ? 330 : city.kind === 'port' ? 260 : 210;
  const lots: Lot[] = [];
  for (let i = 0; i < count; i++) {
    const ang = nextFloat(rng) * Math.PI * 2;
    const rr = Math.sqrt(nextFloat(rng)) * city.districtRadius;
    const x = city.x + Math.cos(ang) * rr;
    const z = city.z + Math.sin(ang) * rr;
    if (heightAt(x, z) < 1.2) continue; // don't build in the sea
    const t = rr / city.districtRadius;
    let district: number;
    if (city.kind === 'industrial') district = t < 0.2 ? 0 : t < 0.5 ? 3 : t < 0.8 ? 3 : 2;
    else if (city.kind === 'port') district = t < 0.22 ? 0 : t < 0.55 ? 2 : t < 0.75 ? 3 : 2;
    else district = t < 0.22 ? 0 : t < 0.6 ? 1 : 2;
    if (city.kind === 'campus' && district === 1 && nextFloat(rng) < 0.4) district = 2;
    const tall = district === 0;
    const mid = district === 1;
    const baseH = tall ? range(rng, 5, 15) : mid ? range(rng, 2, 6.5) : district === 3 ? range(rng, 1.4, 3.2) : range(rng, 1.1, 3.4);
    const w = tall ? range(rng, 1.3, 2.2) : range(rng, 1.0, 2.0);
    const d = tall ? range(rng, 1.3, 2.2) : range(rng, 1.0, 2.0);
    lots.push({ dx: x - city.x, dz: z - city.z, baseH, w, d, rot: Math.floor(nextFloat(rng) * 4) * (Math.PI / 2) + (district === 0 ? 0 : range(rng, -0.12, 0.12)), district });
  }
  return lots.sort((a, b) => (a.dx * a.dx + a.dz * a.dz) - (b.dx * b.dx + b.dz * b.dz));
}

function makeCityMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: '#a7abb2', roughness: 0.82, metalness: 0.08 });
  const uniforms = { uNight: { value: 0 }, uDim: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.uniforms.uDim = uniforms.uDim;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocal; varying vec3 vScaleW; varying float vRand; varying vec3 vObjNormal; varying float vDistrict;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLocal = position; vObjNormal = normal;
        #ifdef USE_INSTANCING
          vec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          vScaleW = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vRand = fract(sin(dot(ipos.xz, vec2(12.9898, 78.233))) * 43758.5453);
          vDistrict = fract(sin(dot(ipos.xz, vec2(39.346, 11.135))) * 24634.6345) * 4.0;
        #else
          vScaleW = vec3(4.0); vRand = 0.5; vDistrict = 0.0;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocal; varying vec3 vScaleW; varying float vRand; varying vec3 vObjNormal; varying float vDistrict;
        uniform float uNight; uniform float uDim;
        float whash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float d = floor(vDistrict);
          vec3 dc = d < 0.5 ? vec3(0.494, 0.576, 0.658) : d < 1.5 ? vec3(0.604, 0.627, 0.651) : d < 2.5 ? vec3(0.702, 0.647, 0.561) : vec3(0.553, 0.522, 0.471);
          diffuseColor.rgb = dc * (0.9 + vRand * 0.2);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (abs(vObjNormal.y) < 0.5) {
          vec2 facadeUv = abs(vObjNormal.x) > 0.5 ? vec2(vLocal.z, vLocal.y) : vec2(vLocal.x, vLocal.y);
          vec2 cells = vec2(max(2.0, floor(vScaleW.x * 1.1)), max(2.0, floor(vScaleW.y * 0.62)));
          vec2 fuv = facadeUv * cells;
          vec2 cellUv = fract(fuv);
          vec2 cellId = floor(fuv);
          float win = step(0.22, cellUv.x) * (1.0 - step(0.72, cellUv.x)) * step(0.28, cellUv.y) * (1.0 - step(0.74, cellUv.y));
          float litR = whash(cellId + floor(vRand * 91.7));
          float litRatio = uNight * (0.66 - uDim * 0.62);
          float lit = step(litR, max(litRatio, 0.0));
          vec3 warm = mix(vec3(1.0, 0.68, 0.38), vec3(0.75, 0.85, 1.0), step(0.82, whash(cellId * 1.7)));
          totalEmissiveRadiance += warm * win * lit * (1.5 - uDim * 1.35);
          diffuseColor.rgb *= 1.0 - win * 0.10;
        }
        // rooftop beacon on tall towers at night
        if (vObjNormal.y > 0.5 && vScaleW.y > 9.0) {
          totalEmissiveRadiance += vec3(1.0, 0.25, 0.2) * uNight * step(0.93, vRand) * 0.9;
        }`);
  };
  return { mat, uniforms };
}

const tmpObj = new THREE.Object3D();

function CityBlocks({ city, visualRef }: { city: CityLayout; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const lots = useMemo(() => genLots(city), [city]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const antennaRef = useRef<THREE.InstancedMesh>(null);
  const { mat, uniforms } = useMemo(() => makeCityMaterial(), []);
  const applied = useRef({ built: -1, active: -1 });

  useFrame(() => {
    const mesh = meshRef.current;
    const crowns = crownRef.current, roofs = roofRef.current, antennas = antennaRef.current;
    if (!mesh || !crowns || !roofs || !antennas) return;
    const night = (window as any).__nightFactor ?? 0;
    uniforms.uNight.value = night;
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
    uniforms.uDim.value = vis ? vis.nightDim : 0;
    if (!vis) return;
    // Existing structures occupy immutable lots. Demographic growth fills new lots
    // or adds explicit arcologies; it never pushes old buildings across the map or
    // stretches every tower at once. Inactive shells are rendered by the ruin layer.
    const b = Math.round(vis.builtFraction * 80) / 80;
    const a = Math.round(vis.activeFraction * 80) / 80;
    if (b === applied.current.built && a === applied.current.active) return;
    applied.current = { built: b, active: a };
    const activeCount = Math.min(Math.floor(lots.length * b), Math.floor(lots.length * a));
    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i];
      if (i < activeCount) {
        const sy = lot.baseH;
        const x = city.x + lot.dx;
        const z = city.z + lot.dz;
        const ground = heightAt(x, z);
        tmpObj.position.set(x, ground + sy / 2 - 0.05, z);
        tmpObj.rotation.set(0, lot.rot, 0);
        tmpObj.scale.set(lot.w, sy, lot.d);
        tmpObj.updateMatrix(); mesh.setMatrixAt(i, tmpObj.matrix);

        // Roof/service geometry gives the ordinary city a built, engineered silhouette
        // without moving lots or scaling the whole city when population changes.
        const roofH = lot.district === 0 ? 0.28 : lot.district === 1 ? 0.18 : 0.10;
        tmpObj.position.set(x, ground + sy + roofH / 2 - 0.08, z);
        tmpObj.rotation.set(0, lot.rot, 0);
        tmpObj.scale.set(lot.w * (lot.district === 0 ? 0.72 : 0.52), roofH, lot.d * (lot.district === 0 ? 0.72 : 0.52));
        tmpObj.updateMatrix(); roofs.setMatrixAt(i, tmpObj.matrix);

        if (lot.district === 0 && sy > 8) {
          const crownH = Math.min(1.8, 0.65 + sy * 0.055);
          tmpObj.position.set(x, ground + sy + roofH + crownH / 2, z);
          tmpObj.rotation.set(0, lot.rot + Math.PI / 8, 0);
          tmpObj.scale.set(lot.w * 0.34, crownH, lot.d * 0.34);
          tmpObj.updateMatrix(); crowns.setMatrixAt(i, tmpObj.matrix);
          const antennaH = ((i * 31 + city.id.length) % 5 === 0) ? Math.min(3.4, sy * 0.2) : 0;
          if (antennaH > 0) {
            tmpObj.position.set(x, ground + sy + roofH + crownH + antennaH / 2, z);
            tmpObj.rotation.set(0, 0, 0); tmpObj.scale.set(0.06, antennaH, 0.06);
            tmpObj.updateMatrix(); antennas.setMatrixAt(i, tmpObj.matrix);
          } else { tmpObj.position.set(0,-70,0); tmpObj.scale.setScalar(.001); tmpObj.updateMatrix(); antennas.setMatrixAt(i,tmpObj.matrix); }
        } else {
          for (const extra of [crowns, antennas]) { tmpObj.position.set(0,-70,0); tmpObj.scale.setScalar(.001); tmpObj.rotation.set(0,0,0); tmpObj.updateMatrix(); extra.setMatrixAt(i,tmpObj.matrix); }
        }
      } else {
        for (const target of [mesh, crowns, roofs, antennas]) {
          tmpObj.position.set(0, -50, 0); tmpObj.scale.set(0.001, 0.001, 0.001); tmpObj.rotation.set(0,0,0);
          tmpObj.updateMatrix(); target.setMatrixAt(i, tmpObj.matrix);
        }
      }
    }
    for (const m of [mesh, crowns, roofs, antennas]) m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, lots.length]} material={mat} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={roofRef} args={[undefined, undefined, lots.length]} castShadow frustumCulled={false}>
        <boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#808991" metalness={0.24} roughness={0.62} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, lots.length]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[1,1.22,1,8]} /><meshStandardMaterial color="#aebbc3" metalness={0.42} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={antennaRef} args={[undefined, undefined, lots.length]} frustumCulled={false}>
        <cylinderGeometry args={[1,1,1,6]} /><meshStandardMaterial color="#d9e5e8" emissive="#ff665c" emissiveIntensity={0.12} metalness={0.55} roughness={0.32} />
      </instancedMesh>
    </group>
  );
}

// ── Shantytowns & smog — housing shortage and waste made visible ─────────────
const MAX_SHANTY = 26;

function CityFringe({ city, visualRef }: { city: CityLayout; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const shantyRef = useRef<THREE.InstancedMesh>(null);
  const smogRef = useRef<THREE.Mesh>(null);
  const huts = useMemo(() => {
    const rng = makeRng(hashStr(city.id + '-sh'), 11);
    return Array.from({ length: MAX_SHANTY }, () => {
      const ang = nextFloat(rng) * Math.PI * 2;
      const rr = city.districtRadius * range(rng, 1.02, 1.35);
      return { dx: Math.cos(ang) * rr, dz: Math.sin(ang) * rr, s: range(rng, 0.35, 0.7), rot: nextFloat(rng) * Math.PI };
    });
  }, [city]);

  useFrame(() => {
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
    const mesh = shantyRef.current;
    if (mesh) {
      const crowd = vis?.crowding ?? 0;
      const n = Math.round(clampN(crowd - 0.1, 0, 1) * MAX_SHANTY * 1.4);
      const sprawl = vis?.sprawl ?? 1;
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
          tmpObj.scale.set(0.001, 0.001, 0.001);
        }
        tmpObj.updateMatrix();
        mesh.setMatrixAt(i, tmpObj.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    const smog = smogRef.current;
    if (smog) {
      const waste = vis?.waste ?? 0;
      const m = smog.material as THREE.MeshStandardMaterial;
      m.opacity = waste * 0.28;
      smog.visible = waste > 0.04;
      const r = city.districtRadius * (vis?.sprawl ?? 1) * 1.15;
      smog.scale.set(r, r * 0.45, r);
      smog.position.set(city.x, heightAt(city.x, city.z) + 2.2, city.z);
    }
  });

  return (
    <group>
      <instancedMesh ref={shantyRef} args={[undefined, undefined, MAX_SHANTY]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6b5d4f" roughness={1} />
      </instancedMesh>
      <mesh ref={smogRef} visible={false}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color="#8a8578" transparent opacity={0} roughness={1} depthWrite={false} />
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
          <CityBlocks city={c} visualRef={visualRef} />
          <CityFringe city={c} visualRef={visualRef} />
        </group>
      ))}
    </group>
  );
}
