// ─────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE — generation & compute build-out made visible. Unit counts
// track simulated capacity (infra level relative to 2026 baseline). Wind
// turbines rotate, nuclear cooling towers vent steam, data centers glow.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { INFRA_ZONES, CITIES, civMainCity, type InfraZone } from './layout';
import { heightAt } from './terrain';
import { skyState } from './skyState';
import type { WorldVisual } from './cityVisuals';
import type { CivId } from '../sim';
import { CIV_IDS } from '../sim';
import { makeRng, nextFloat } from '../sim/rng';

function zoneRng(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return makeRng(h >>> 0, 3);
}

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

// ── Wind turbines ────────────────────────────────────────────────────────────
const MAX_TURBINES = 16;

function WindFarm({ zone, visualRef }: { zone: InfraZone; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const bladesRef = useRef<THREE.Group[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const spots = useMemo(() => {
    const rng = zoneRng(zone.id);
    const out: [number, number][] = [];
    const cols = 4;
    for (let i = 0; i < MAX_TURBINES; i++) {
      const gx = (i % cols) / cols - 0.375;
      const gz = Math.floor(i / cols) / Math.ceil(MAX_TURBINES / cols) - 0.4;
      out.push([zone.x + gx * zone.size + (nextFloat(rng) - 0.5) * 2, zone.z + gz * zone.size + (nextFloat(rng) - 0.5) * 2]);
    }
    return out;
  }, [zone]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const b of bladesRef.current) if (b) b.rotation.z = t * 2.2;
    const level = visualRef.current?.infra.get(zone.id) ?? 0;
    const n = Math.min(MAX_TURBINES, Math.round(3 + level * 4));
    const g = groupRef.current;
    if (g) g.children.forEach((child, i) => { child.visible = i < n; });
  });

  return (
    <group ref={groupRef}>
      {spots.map(([x, z], i) => {
        const y = heightAt(x, z);
        return (
          <group key={i} position={[x, y, z]}>
            {/* foundation pad */}
            <mesh position={[0, 0.06, 0]} receiveShadow>
              <cylinderGeometry args={[0.55, 0.65, 0.12, 10]} />
              <meshStandardMaterial color="#b0aaa0" roughness={0.95} />
            </mesh>
            {/* tower: hub 8u ≈ 24 m, rotor 6.4u ≈ 19 m (realistic hub/diameter ratio) */}
            <mesh position={[0, 4, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.3, 8, 8]} />
              <meshStandardMaterial color="#e4e8ec" roughness={0.4} metalness={0.1} />
            </mesh>
            <group position={[0, 8, 0]}>
              {/* nacelle */}
              <mesh castShadow>
                <boxGeometry args={[0.5, 0.42, 1.1]} />
                <meshStandardMaterial color="#dde2e6" roughness={0.45} metalness={0.2} />
              </mesh>
              <group ref={(g) => { if (g) bladesRef.current[i] = g; }} position={[0, 0, 0.62]}>
                {[0, 1, 2].map((k) => (
                  <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]} position={[0, 0, 0]}>
                    <boxGeometry args={[0.16, 3.2, 0.05]} />
                    <meshStandardMaterial color="#eef1f3" roughness={0.35} />
                  </mesh>
                ))}
                <mesh>
                  <sphereGeometry args={[0.2, 8, 8]} />
                  <meshStandardMaterial color="#d8dde2" />
                </mesh>
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ── Solar fields ─────────────────────────────────────────────────────────────
const MAX_SOLAR_ROWS = 48;

function SolarField({ zone, visualRef }: { zone: InfraZone; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(-1);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const level = visualRef.current?.infra.get(zone.id) ?? 0;
    const rows = Math.min(MAX_SOLAR_ROWS, Math.round(8 + level * 12));
    if (rows === applied.current) return;
    applied.current = rows;
    const cols = 8;
    for (let i = 0; i < MAX_SOLAR_ROWS; i++) {
      if (i < rows) {
        const gx = (i % cols) / cols - 0.44;
        const gz = Math.floor(i / cols) / Math.ceil(MAX_SOLAR_ROWS / cols) - 0.45;
        const x = zone.x + gx * zone.size;
        const z = zone.z + gz * zone.size;
        tmpObj.position.set(x, heightAt(x, z) + 0.28, z);
        tmpObj.rotation.set(-0.42, 0.12, 0);
        tmpObj.scale.set(1.7, 0.08, 1.1);
      } else {
        tmpObj.position.set(0, -60, 0);
        tmpObj.scale.set(0.001, 0.001, 0.001);
      }
      tmpObj.updateMatrix();
      mesh.setMatrixAt(i, tmpObj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SOLAR_ROWS]} castShadow frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#1d2f52" roughness={0.25} metalness={0.65} />
    </instancedMesh>
  );
}

// support posts under each solar row
const MAX_SOLAR_POSTS = 96;

function SolarPosts({ zone, visualRef }: { zone: InfraZone; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(-1);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const level = visualRef.current?.infra.get(zone.id) ?? 0;
    const rows = Math.min(MAX_SOLAR_ROWS, Math.round(8 + level * 12));
    if (rows === applied.current) return;
    applied.current = rows;
    const cols = 8;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const gx = (r % cols) / cols - 0.44;
      const gz = Math.floor(r / cols) / Math.ceil(MAX_SOLAR_ROWS / cols) - 0.45;
      const x = zone.x + gx * zone.size;
      const z = zone.z + gz * zone.size;
      const y = heightAt(x, z);
      for (const off of [-0.7, 0.7]) {
        if (i >= MAX_SOLAR_POSTS) break;
        tmpObj.position.set(x + off * 0.0 + off, y + 0.14, z);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.set(0.06, 0.28, 0.06);
        tmpObj.updateMatrix();
        mesh.setMatrixAt(i++, tmpObj.matrix);
      }
    }
    for (let k = i; k < MAX_SOLAR_POSTS; k++) {
      tmpObj.position.set(0, -60, 0); tmpObj.scale.setScalar(0.001); tmpObj.updateMatrix();
      mesh.setMatrixAt(k, tmpObj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SOLAR_POSTS]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 6]} />
      <meshStandardMaterial color="#5a616b" roughness={0.7} metalness={0.4} />
    </instancedMesh>
  );
}

// ── Nuclear plants ───────────────────────────────────────────────────────────
function SteamPuff({ x, y, z, phase }: { x: number; y: number; z: number; phase: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.24 + phase) % 1;
    const m = ref.current;
    if (!m) return;
    m.position.set(x, y + t * 3.2, z);
    const s = 0.5 + t * 1.3;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshStandardMaterial).opacity = 0.34 * (1 - t);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.55, 8, 8]} />
      <meshStandardMaterial color="#e8ecef" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

function NuclearPlant({ zone, visualRef }: { zone: InfraZone; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const groupRef = useRef<THREE.Group>(null);
  const units = useMemo(() => {
    const y = heightAt(zone.x, zone.z);
    return [
      { x: zone.x - 1.6, z: zone.z, y },
      { x: zone.x + 1.8, z: zone.z + 1.2, y: heightAt(zone.x + 1.8, zone.z + 1.2) },
      { x: zone.x + 0.4, z: zone.z - 2.2, y: heightAt(zone.x + 0.4, zone.z - 2.2) },
    ];
  }, [zone]);

  useFrame(() => {
    const level = visualRef.current?.infra.get(zone.id) ?? 0;
    const n = Math.min(3, Math.max(level > 0.05 ? 1 : 0, Math.round(level)));
    groupRef.current?.children.forEach((c, i) => { c.visible = i < n; });
  });

  return (
    <group ref={groupRef}>
      {units.map((u, i) => (
        <group key={i} position={[u.x, u.y, u.z]}>
          {/* containment dome */}
          <mesh position={[0, 0.9, 0]} castShadow>
            <sphereGeometry args={[0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#dfe3e7" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.95, 0.95, 0.9, 16]} />
            <meshStandardMaterial color="#cfd4d9" roughness={0.7} />
          </mesh>
          {/* cooling tower: hyperbolic profile, ~2x scale for real presence */}
          <mesh position={[1.9, 2.0, 0.6]} castShadow>
            <cylinderGeometry args={[0.72, 1.05, 4.0, 14, 1, true]} />
            <meshStandardMaterial color="#d5d9de" roughness={0.75} side={THREE.DoubleSide} />
          </mesh>
          <SteamPuff x={1.9} y={4.1} z={0.6} phase={i * 0.33} />
          {/* turbine hall with clerestory */}
          <mesh position={[-1.5, 0.5, 1.6]} castShadow>
            <boxGeometry args={[2.2, 1.0, 1.5]} />
            <meshStandardMaterial color="#b9bfc6" roughness={0.8} />
          </mesh>
          <mesh position={[-1.5, 1.02, 1.6]}>
            <boxGeometry args={[2.24, 0.08, 0.5]} />
            <meshStandardMaterial color="#39424c" emissive="#8fb4d8" emissiveIntensity={0.25} />
          </mesh>
          {/* switchyard: transformer plinths + gantry */}
          {[0, 1, 2].map((k) => (
            <group key={k} position={[-2.2 + k * 0.9, 0, -1.6]}>
              <mesh position={[0, 0.16, 0]} castShadow>
                <boxGeometry args={[0.5, 0.32, 0.5]} />
                <meshStandardMaterial color="#8a8478" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.4, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.2, 6]} />
                <meshStandardMaterial color="#6e7278" roughness={0.5} metalness={0.5} />
              </mesh>
            </group>
          ))}
          <mesh position={[-1.3, 0.95, -1.6]}>
            <boxGeometry args={[2.4, 0.06, 0.08]} />
            <meshStandardMaterial color="#5a616b" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* perimeter: service apron */}
          <mesh position={[0, 0.02, 3.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[6.5, 2.2]} />
            <meshStandardMaterial color="#6e6a62" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Data centers ─────────────────────────────────────────────────────────────
const MAX_HALLS = 10;

function DataCenter({ zone, visualRef }: { zone: InfraZone; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(-1);

  useFrame(() => {
    const mesh = meshRef.current;
    const glow = glowRef.current;
    if (!mesh || !glow) return;
    const level = visualRef.current?.infra.get(zone.id) ?? 0;
    const halls = Math.min(MAX_HALLS, Math.floor(level * 2.4));
    if (halls === applied.current) { /* still update glow pulse */ }
    const night = skyState.nightFactor;
    (glow.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + night * 1.6;
    if (halls === applied.current) return;
    applied.current = halls;
    const cols = 5;
    for (let i = 0; i < MAX_HALLS; i++) {
      const visible = i < halls;
      const gx = (i % cols) / cols - 0.4;
      const gz = Math.floor(i / cols) / 2 - 0.25;
      const x = zone.x + gx * zone.size;
      const z = zone.z + gz * zone.size;
      tmpObj.position.set(x, heightAt(x, z) + 0.55, z);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.set(visible ? 1.9 : 0.001, visible ? 1.1 : 0.001, visible ? 1.3 : 0.001);
      tmpObj.updateMatrix();
      mesh.setMatrixAt(i, tmpObj.matrix);
      // thin cyan roof strip
      tmpObj.position.y += 0.58;
      tmpObj.scale.set(visible ? 1.94 : 0.001, 0.06, visible ? 0.18 : 0.001);
      tmpObj.updateMatrix();
      glow.setMatrixAt(i, tmpObj.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* service apron + perimeter: the halls sit on a fenced gravel yard */}
      <mesh position={[zone.x, heightAt(zone.x, zone.z) + 0.02, zone.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[zone.size * 1.15, zone.size * 0.72]} />
        <meshStandardMaterial color="#77746c" roughness={1} />
      </mesh>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_HALLS]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3a4149" roughness={0.7} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, MAX_HALLS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.4} />
      </instancedMesh>
      {/* transformer yard */}
      {[0, 1].map((k) => {
        const x = zone.x - zone.size * 0.36 + k * 1.6;
        const z = zone.z + zone.size * 0.3;
        return (
          <group key={k} position={[x, heightAt(x, z), z]}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[0.7, 0.44, 0.6]} />
              <meshStandardMaterial color="#6e7278" roughness={0.6} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.2, 6]} />
              <meshStandardMaterial color="#5a616b" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        );
      })}
      {/* entrance pavilion with doors */}
      {(() => {
        const x = zone.x, z = zone.z - zone.size * 0.38;
        const y = heightAt(x, z);
        return (
          <group position={[x, y, z]}>
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[1.3, 0.6, 0.4]} />
              <meshStandardMaterial color="#8a9096" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.62, 0]}>
              <boxGeometry args={[1.34, 0.06, 0.44]} />
              <meshStandardMaterial color="#28323c" roughness={0.4} />
            </mesh>
          </group>
        );
      })()}
    </group>
  );
}

// ── Ports ────────────────────────────────────────────────────────────────────
function Port({ zone }: { zone: InfraZone; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const containers = useMemo(() => {
    const rng = zoneRng(zone.id + '-c');
    return Array.from({ length: 26 }, () => ({
      x: zone.x + (nextFloat(rng) - 0.5) * zone.size * 0.8,
      z: zone.z + (nextFloat(rng) - 0.5) * zone.size * 0.5,
      rot: nextFloat(rng) < 0.5 ? 0 : Math.PI / 2,
      color: tmpColor.setHSL(nextFloat(rng), 0.45, 0.42).getHex(),
    }));
  }, [zone]);
  return (
    <group>
      {/* quay */}
      <mesh position={[zone.x, heightAt(zone.x, zone.z) + 0.15, zone.z]}>
        <boxGeometry args={[zone.size * 0.9, 0.3, zone.size * 0.55]} />
        <meshStandardMaterial color="#4a4f55" roughness={0.9} />
      </mesh>
      {/* cranes */}
      {[-2.4, 0, 2.4].map((dx, i) => {
        const x = zone.x + dx;
        const z = zone.z - zone.size * 0.22;
        const y = heightAt(x, z);
        return (
          <group key={i} position={[x, y + 0.3, z]}>
            <mesh position={[0, 1.5, 0]} castShadow>
              <boxGeometry args={[0.35, 3, 0.35]} />
              <meshStandardMaterial color="#c94f38" roughness={0.6} />
            </mesh>
            <mesh position={[0, 2.9, 0.9]} castShadow>
              <boxGeometry args={[0.22, 0.22, 2.6]} />
              <meshStandardMaterial color="#c94f38" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
      {/* containers */}
      {containers.map((c, i) => (
        <mesh key={i} position={[c.x, heightAt(c.x, c.z) + 0.55, c.z]} rotation={[0, c.rot, 0]}>
          <boxGeometry args={[1.1, 0.5, 0.5]} />
          <meshStandardMaterial color={c.color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ── Farms & vertical farms ───────────────────────────────────────────────────
// Cultivated patches track simulated land use × yield; they brown out under
// climate stress and food shortage. As artificial food scales, fields are
// rewilded and glowing grow-towers rise at the city edge.
const MAX_PATCHES = 14;
const MAX_VF_TOWERS = 8;
const MAX_ROVERS = 17;

function Farm({ zone, visualRef }: { zone: InfraZone; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const groupRef = useRef<THREE.Group>(null);
  const towerRef = useRef<THREE.Group>(null);
  const roverRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const patches = useMemo(() => {
    const rng = zoneRng(zone.id + '-f');
    return Array.from({ length: MAX_PATCHES }, (_, i) => {
      const gx = (i % 4) / 4 - 0.375;
      const gz = Math.floor(i / 4) / 4 - 0.35;
      return {
        x: zone.x + gx * zone.size,
        z: zone.z + gz * zone.size,
        w: zone.size * (0.16 + nextFloat(rng) * 0.06),
        hue: 0.2 + nextFloat(rng) * 0.08, // muted healthy green
        light: 0.3 + nextFloat(rng) * 0.12,
        rot: (nextFloat(rng) - 0.5) * 0.3,
      };
    });
  }, [zone]);
  const city = useMemo(() => civMainCity(zone.civId), [zone.civId]);
  const towerSpots = useMemo(() => {
    const rng = zoneRng(zone.id + '-vf');
    // grow-tower cluster between city and farmland
    const dx = zone.x - city.x, dz = zone.z - city.z;
    const len = Math.max(1, Math.hypot(dx, dz));
    return Array.from({ length: MAX_VF_TOWERS }, (_, i) => {
      const t = 0.28 + (i % 4) * 0.06;
      const side = (i < 4 ? 1 : -1) * (1.5 + nextFloat(rng) * 1.5);
      return {
        x: city.x + (dx / len) * len * t - (dz / len) * side,
        z: city.z + (dz / len) * len * t + (dx / len) * side,
        h: 2.6 + nextFloat(rng) * 2.4,
      };
    });
  }, [zone, city]);

  useFrame(() => {
    const fv = visualRef.current?.food[zone.civId];
    const g = groupRef.current;
    if (g) {
      const stress = fv?.stress ?? 0;
      const landUse = fv?.landUse ?? 1;
      const yld = fv?.yieldIndex ?? 1;
      const n = Math.min(MAX_PATCHES, Math.round((3 + landUse * 8) * Math.min(1.25, 0.5 + yld * 0.45)));
      g.children.forEach((child, i) => {
        child.visible = i < n;
        if (!child.visible) return;
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const p = patches[i];
        // healthy green → drought/shortage brown (muted: real fields are dusty)
        m.color.setHSL(p.hue * (1 - stress) + 0.07 * stress, 0.28 - stress * 0.1, 0.3 * (1 - stress * 0.4) + p.light * 0.18);
      });
    }
    const tg = towerRef.current;
    if (tg) {
      const art = fv?.artificial ?? 0;
      const n = Math.min(MAX_VF_TOWERS, Math.floor(art * 10));
      tg.children.forEach((child, i) => { child.visible = i < n; });
    }
    // ── robot countryside: autonomous rovers working the field rows ─────────
    // The countryside runs on machines when automation is high — the visible
    // face of the segregation between robot-tended land and human settlement.
    const rovers = roverRef.current, rlights = lightRef.current;
    if (rovers && rlights) {
      const agri = visualRef.current?.agriAutomation[zone.civId] ?? 0;
      const n = Math.floor(agri * MAX_PATCHES * 1.2);
      const t = performance.now() / 1000;
      for (let i = 0; i < MAX_ROVERS; i++) {
        const p = patches[i % MAX_PATCHES];
        if (i < n) {
          // each rover works one field, travelling along its row and back
          const lap = (t * 0.22 + i * 0.37) % 2;
          const u = lap < 1 ? lap * 2 - 1 : 1 - (lap - 1) * 2;   // -1..1 ping-pong
          const dir = i % 2 === 0 ? 1 : -1;
          tmpObj.position.set(p.x + Math.cos(p.rot) * p.w * 0.55 * u * dir, heightAt(p.x, p.z) + 0.14, p.z + Math.sin(p.rot) * p.w * 0.55 * u * dir);
          tmpObj.rotation.set(0, p.rot + (lap < 1 ? 0 : Math.PI), 0);
          tmpObj.scale.set(0.55, 0.16, 0.3);
          tmpObj.updateMatrix();
          rovers.setMatrixAt(i, tmpObj.matrix);
          // status beacon on the mast
          tmpObj.position.y += 0.26;
          tmpObj.scale.set(0.1, 0.06, 0.06);
          tmpObj.updateMatrix();
          rlights.setMatrixAt(i, tmpObj.matrix);
        } else {
          tmpObj.position.set(0, -70, 0);
          tmpObj.scale.setScalar(0.001);
          tmpObj.updateMatrix();
          rovers.setMatrixAt(i, tmpObj.matrix);
          rlights.setMatrixAt(i, tmpObj.matrix);
        }
      }
      rovers.instanceMatrix.needsUpdate = true;
      rlights.instanceMatrix.needsUpdate = true;
      (rlights.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + Math.sin(t * 2.2) * 0.4;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {patches.map((p, i) => (
          <mesh key={i} position={[p.x, heightAt(p.x, p.z) + 0.08, p.z]} rotation={[-Math.PI / 2, 0, p.rot]}>
            <planeGeometry args={[p.w, p.w * 0.7]} />
            <meshStandardMaterial color={tmpColor.setHSL(p.hue, 0.5, p.light).getHex()} roughness={1} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={roverRef} args={[undefined, undefined, MAX_ROVERS]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#2f353c" roughness={0.5} metalness={0.45} />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, MAX_ROVERS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#ffcf6e" emissiveIntensity={1} />
      </instancedMesh>
      <group ref={towerRef}>
        {towerSpots.map((s, i) => {
          const y = heightAt(s.x, s.z);
          return (
            <group key={i} position={[s.x, y, s.z]}>
              <mesh position={[0, s.h / 2, 0]} castShadow>
                <boxGeometry args={[1.3, s.h, 1.3]} />
                <meshStandardMaterial color="#dfe6ea" roughness={0.35} metalness={0.3} />
              </mesh>
              {[0.3, 0.55, 0.8].map((h, k) => (
                <mesh key={k} position={[0, s.h * h, 0]}>
                  <boxGeometry args={[1.38, 0.12, 1.38]} />
                  <meshStandardMaterial color="#7ee8a2" emissive="#39d97e" emissiveIntensity={1.4} />
                </mesh>
              ))}
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ── Transmission corridors ───────────────────────────────────────────────────
function Transmission() {
  const { pylons, lines } = useMemo(() => {
    const corridors: Array<[number, number, number, number]> = [];
    for (const z of INFRA_ZONES) {
      if (z.type === 'solar' || z.type === 'wind' || z.type === 'nuclear' || z.type === 'datacenter') {
        let best = CITIES[0];
        let bd = Infinity;
        for (const c of CITIES) {
          if (c.civId !== z.civId) continue;
          const d = (c.x - z.x) ** 2 + (c.z - z.z) ** 2;
          if (d < bd) { bd = d; best = c; }
        }
        corridors.push([z.x, z.z, best.x, best.z]);
      }
    }
    const pylonPos: Array<[number, number, number]> = [];
    const linePts: number[] = [];
    for (const [x0, z0, x1, z1] of corridors) {
      const dist = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(2, Math.floor(dist / 9));
      let prev: THREE.Vector3 | null = null;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const y = heightAt(x, z);
        if (y < 1.1) { prev = null; continue; } // skip water spans
        pylonPos.push([x, y, z]);
        const top = new THREE.Vector3(x, y + 1.7, z);
        if (prev) {
          // catenary sag: 3 segments between tops
          for (let s = 0; s < 3; s++) {
            const ta = s / 3;
            const tb = (s + 1) / 3;
            const sag = (tt: number) => Math.sin(tt * Math.PI) * -0.55;
            const ax = prev.x + (top.x - prev.x) * ta, ay = prev.y + (top.y - prev.y) * ta + sag(ta), az = prev.z + (top.z - prev.z) * ta;
            const bx = prev.x + (top.x - prev.x) * tb, by = prev.y + (top.y - prev.y) * tb + sag(tb), bz = prev.z + (top.z - prev.z) * tb;
            linePts.push(ax, ay, az, bx, by, bz);
          }
        }
        prev = top;
      }
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
    return { pylons: pylonPos, lines: lineGeom };
  }, []);

  return (
    <group>
      {pylons.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.05, 0.09, 1.7, 5]} />
            <meshStandardMaterial color="#5a616b" roughness={0.6} metalness={0.5} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <boxGeometry args={[0.9, 0.06, 0.06]} />
            <meshStandardMaterial color="#5a616b" roughness={0.6} metalness={0.5} />
          </mesh>
        </group>
      ))}
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#3d434c" transparent opacity={0.75} />
      </lineSegments>
    </group>
  );
}

// ── Landfills — unmanaged waste piles up at the city edge ────────────────────
function Landfill({ civId, visualRef }: { civId: CivId; visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const groupRef = useRef<THREE.Group>(null);
  const city = useMemo(() => civMainCity(civId), [civId]);
  const mounds = useMemo(() => {
    const rng = zoneRng(civId + '-lf');
    // away from the world center — the edge of town
    const dirX = Math.sign(city.x) || 1, dirZ = Math.sign(city.z) || 1;
    return Array.from({ length: 6 }, (_, i) => ({
      x: city.x + dirX * (city.districtRadius * 1.5 + i * 1.6) + (nextFloat(rng) - 0.5) * 2,
      z: city.z + dirZ * (city.districtRadius * 1.3 + (i % 3) * 1.8) + (nextFloat(rng) - 0.5) * 2,
      r: 1.1 + nextFloat(rng) * 1.2,
      h: 0.5 + nextFloat(rng) * 0.6,
    }));
  }, [city, civId]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const waste = visualRef.current?.cities.find((c) => c.city.id === city.id)?.waste ?? 0;
    const n = Math.min(6, Math.floor(waste * 8));
    g.children.forEach((child, i) => {
      child.visible = i < n;
      const s = 0.5 + waste * 0.9;
      child.scale.set(s, s, s);
    });
  });

  return (
    <group ref={groupRef}>
      {mounds.map((m, i) => (
        <mesh key={i} position={[m.x, heightAt(m.x, m.z) + m.h / 2 - 0.1, m.z]}>
          <coneGeometry args={[m.r, m.h, 7]} />
          <meshStandardMaterial color={i % 2 ? '#6e6250' : '#7a6f5a'} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export function Infrastructure({ visualRef }: { visualRef: React.MutableRefObject<WorldVisual | null> }) {
  return (
    <group>
      {INFRA_ZONES.map((z) => {
        switch (z.type) {
          case 'wind': return <WindFarm key={z.id} zone={z} visualRef={visualRef} />;
          case 'solar': return <group key={z.id}><SolarField zone={z} visualRef={visualRef} /><SolarPosts zone={z} visualRef={visualRef} /></group>;
          case 'nuclear': return <NuclearPlant key={z.id} zone={z} visualRef={visualRef} />;
          case 'datacenter': return <DataCenter key={z.id} zone={z} visualRef={visualRef} />;
          case 'port': return <Port key={z.id} zone={z} visualRef={visualRef} />;
          case 'farm': return <Farm key={z.id} zone={z} visualRef={visualRef} />;
        }
      })}
      {CIV_IDS.map((id) => <Landfill key={id} civId={id} visualRef={visualRef} />)}
      <Transmission />
    </group>
  );
}
