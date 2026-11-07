// ─────────────────────────────────────────────────────────────────────────────
// VEHICLES — recognizable traffic on the inter-city roads and ships on the
// sea lanes. Cars, vans, buses and trucks are composed parts (body, cabin,
// wheels with hubs, lights, windscreens) at true scale to the 2.6-unit road
// (1 unit ≈ 3 m → a car is ≈ 1.5 units long). EV adoption from the sim
// repaints the fleet; cars keep their identity across the transition.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildRoadPaths } from './RoadsCurves';
import { heightAt } from './terrain';
import type { WorldVisual } from './cityVisuals';
import { cityById } from './layout';
import { skyState } from './skyState';

const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

type VehKind = 'car' | 'van' | 'bus' | 'truck';
interface Vehicle {
  path: number;
  t: number;
  speed: number;
  dir: 1 | -1;
  kind: VehKind;
  ev: boolean;
}

const CARS_PER_ROAD = 12;
const ICE_COLORS = ['#8a8f96', '#6b7078', '#7a6f63', '#5d6470', '#8f8578', '#3e434a', '#7a3a34'];
const EV_COLORS = ['#cfe6ef', '#a8d8e8', '#e8f4f8', '#9fd4c8', '#d8e4ee'];

// dims per kind: [bodyL, bodyH, bodyW, cabinL, cabinH, wheelR]
const KIND_DIMS: Record<VehKind, { bl: number; bh: number; bw: number; cl: number; ch: number; wr: number; roof: number }> = {
  car: { bl: 1.5, bh: 0.34, bw: 0.6, cl: 0.78, ch: 0.26, wr: 0.14, roof: 0.1 },
  van: { bl: 1.7, bh: 0.5, bw: 0.64, cl: 0.7, ch: 0.3, wr: 0.16, roof: 0.2 },
  bus: { bl: 3.1, bh: 0.72, bw: 0.68, cl: 2.6, ch: 0.3, wr: 0.17, roof: 0.12 },
  truck: { bl: 3.4, bh: 0.62, bw: 0.7, cl: 0.95, ch: 0.42, wr: 0.19, roof: 0.1 },
};

export function Vehicles({ visualRef }: { visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const paths = useMemo(() => buildRoadPaths(), []);
  const cars = useMemo<Vehicle[]>(() => {
    const out: Vehicle[] = [];
    let s = 12345;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    paths.forEach((_, pi) => {
      for (let i = 0; i < CARS_PER_ROAD; i++) {
        const kr = rnd();
        const kind: VehKind = kr < 0.62 ? 'car' : kr < 0.78 ? 'van' : kr < 0.9 ? 'bus' : 'truck';
        out.push({ path: pi, t: rnd(), speed: 0.009 + rnd() * 0.008, dir: rnd() < 0.5 ? 1 : -1, kind, ev: false });
      }
    });
    return out;
  }, [paths]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const evQuant = useRef(-1);

  useFrame((_, dt) => {
    const body = bodyRef.current, cabin = cabinRef.current, wheel = wheelRef.current, lights = lightRef.current;
    if (!body || !cabin || !wheel || !lights) return;
    const wv = visualRef.current;
    const avgEv = wv ? (wv.evShare.veloria + wv.evShare.ardan + wv.evShare.nemea) / 3 : 0;
    // repaint fleet when EV share moves (quantized)
    const q = Math.round(avgEv * 20);
    if (q !== evQuant.current) {
      evQuant.current = q;
      let s = 999;
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      cars.forEach((car, i) => {
        car.ev = rnd() < avgEv;
        const palette = car.ev ? EV_COLORS : ICE_COLORS;
        tmpColor.set(palette[Math.floor(rnd() * palette.length)]);
        body.setColorAt(i, tmpColor);
      });
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
    }
    const night = skyState.nightFactor;
    (lights.material as THREE.MeshStandardMaterial).emissiveIntensity = night * 2.6;

    const pt = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const sideV = new THREE.Vector3();
    cars.forEach((car, i) => {
      const path = paths[car.path];
      const ca = cityById(path.a), cb = cityById(path.b);
      const va = wv?.cities.find((c) => c.city.id === ca.id);
      const vb = wv?.cities.find((c) => c.city.id === cb.id);
      const activity = Math.min(1.25, ((va?.population ?? 0) / Math.max(0.001, ca.basePop) + (vb?.population ?? 0) / Math.max(0.001, cb.basePop)) / 2);
      // Deterministically thin traffic as the connected settlements empty.
      const visible = activity > 0 && ((i * 37) % 100) < Math.round(Math.min(1, Math.pow(activity, 0.62)) * 100);
      if (!visible) {
        tmpObj.position.set(0, -80, 0); tmpObj.scale.setScalar(0.001); tmpObj.updateMatrix();
        body.setMatrixAt(i, tmpObj.matrix); cabin.setMatrixAt(i, tmpObj.matrix);
        lights.setMatrixAt(i, tmpObj.matrix);
        for (let w = 0; w < 4; w++) wheel.setMatrixAt(i * 4 + w, tmpObj.matrix);
        return;
      }
      car.t += (car.speed * dt * 60 * car.dir) / path.length;
      if (car.t > 1) car.t -= 1;
      if (car.t < 0) car.t += 1;
      path.curve.getPointAt(car.t, pt);
      path.curve.getTangentAt(car.t, tan);
      if (car.dir < 0) tan.negate();
      // right-hand traffic: offset to the side of travel direction
      sideV.set(-tan.z, 0, tan.x).multiplyScalar(0.62 * car.dir);
      pt.add(sideV);
      const dim = KIND_DIMS[car.kind];
      const yaw = Math.atan2(tan.x, tan.z);
      pt.y = heightAt(pt.x, pt.z) + dim.wr;
      tmpObj.position.copy(pt);
      tmpObj.rotation.set(0, yaw, 0);
      tmpObj.scale.set(dim.bw, dim.bh, dim.bl);
      tmpObj.updateMatrix();
      body.setMatrixAt(i, tmpObj.matrix);
      // cabin: glass-house on top, slightly toward the front for buses/trucks cabs
      const cabForward = car.kind === 'truck' ? 0.9 : car.kind === 'bus' ? 0.7 : -0.05;
      tmpObj.position.set(
        pt.x + tan.x * cabForward,
        pt.y + dim.bh / 2 + dim.ch / 2,
        pt.z + tan.z * cabForward,
      );
      tmpObj.scale.set(dim.bw * 0.92, dim.ch, dim.cl);
      tmpObj.updateMatrix();
      cabin.setMatrixAt(i, tmpObj.matrix);
      // wheels: 4 corners
      const axW = dim.bl * 0.32, axF = dim.bl * 0.3;
      for (let w = 0; w < 4; w++) {
        const sx = (w % 2 === 0 ? -1 : 1) * (dim.bw / 2);
        const sy = w < 2 ? axF : -axW;
        tmpObj.position.set(
          pt.x + tan.x * sy - tan.z * sx,
          pt.y - dim.wr + dim.wr * 0.05 + 0.0,
          pt.z + tan.z * sy + tan.x * sx,
        );
        tmpObj.rotation.set(0, yaw, Math.PI / 2);
        tmpObj.scale.set(dim.wr * 0.8, dim.wr * 1.7, dim.wr * 1.7);
        tmpObj.updateMatrix();
        wheel.setMatrixAt(i * 4 + w, tmpObj.matrix);
      }
      // headlights: small emissive strip at the front
      tmpObj.position.set(pt.x + tan.x * (dim.bl / 2 + 0.02), pt.y + dim.bh * 0.18, pt.z + tan.z * (dim.bl / 2 + 0.02));
      tmpObj.scale.set(dim.bw * 0.7, 0.07, 0.06);
      tmpObj.updateMatrix();
      lights.setMatrixAt(i, tmpObj.matrix);
    });
    body.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
    wheel.instanceMatrix.needsUpdate = true;
    lights.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, cars.length]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.55} />
      </instancedMesh>
      <instancedMesh ref={cabinRef} args={[undefined, undefined, cars.length]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#28323c" roughness={0.15} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={wheelRef} args={[undefined, undefined, cars.length * 4]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial color="#191b1e" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, cars.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fff7d6" emissive="#ffedb0" emissiveIntensity={0} />
      </instancedMesh>
    </group>
  );
}

// ── Ships ────────────────────────────────────────────────────────────────────
const SHIP_LANES: [number, number][][] = [
  [[-74, -44], [-88, -10], [-84, 40], [-52, 78], [-4, 94]],
  [[-76, -40], [-96, 10], [-70, 70], [-2, 92]],
  [[30, 70], [44, 86], [8, 96], [-2, 92]],
];

export function Ships({ visualRef }: { visualRef: React.MutableRefObject<WorldVisual | null> }) {
  const shipRefs = useRef<THREE.Group[]>([]);
  const curves = useMemo(() => SHIP_LANES.map((lane) => new THREE.CatmullRomCurve3(lane.map(([x, z]) => new THREE.Vector3(x, 0.35, z)))), []);
  const offsets = useMemo(() => curves.map((_, i) => i * 0.31), [curves]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    curves.forEach((curve, i) => {
      const g = shipRefs.current[i];
      if (!g) return;
      const v = visualRef.current;
      const embodied = v ? v.cities.reduce((a, c) => a + c.population, 0) : 0;
      const baseline = v ? v.cities.reduce((a, c) => a + c.city.basePop, 0) : 1;
      const activity = Math.min(1, embodied / Math.max(0.001, baseline));
      g.visible = activity > 0.01 && i < Math.max(1, Math.ceil(curves.length * Math.pow(activity, 0.55)));
      if (!g.visible) return;
      const tt = (t * 0.006 + offsets[i]) % 1;
      const pt = curve.getPointAt(tt);
      const tan = curve.getTangentAt(tt);
      g.position.set(pt.x, 0.34 + Math.sin(t * 1.1 + i) * 0.06, pt.z);
      g.rotation.y = Math.atan2(tan.x, tan.z);
      g.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.02;
    });
  });

  return (
    <group>
      {curves.map((_, i) => (
        <group key={i} ref={(g) => { if (g) shipRefs.current[i] = g; }}>
          {/* hull with sheer and bulwark */}
          <mesh castShadow>
            <boxGeometry args={[1.2, 0.55, 4.2]} />
            <meshStandardMaterial color={i === 1 ? '#7a4a3a' : '#3f5a6e'} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[1.06, 0.16, 3.9]} />
            <meshStandardMaterial color="#8a949c" roughness={0.7} />
          </mesh>
          {/* deckhouse aft + bridge */}
          <mesh position={[0, 0.75, -1.4]}>
            <boxGeometry args={[0.86, 0.6, 1.1]} />
            <meshStandardMaterial color="#d5d9de" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.2, -1.6]}>
            <boxGeometry args={[0.7, 0.34, 0.6]} />
            <meshStandardMaterial color="#28323c" roughness={0.3} />
          </mesh>
          {/* funnel */}
          <mesh position={[0, 1.05, -0.6]}>
            <cylinderGeometry args={[0.14, 0.18, 0.5, 8]} />
            <meshStandardMaterial color={i === 2 ? '#4a7a5c' : '#c94f38'} roughness={0.6} />
          </mesh>
          {/* container rows fore of deckhouse */}
          {[-0.2, 0.35, 0.9].map((dz, k) => (
            <mesh key={k} position={[0, 0.5, dz]} castShadow>
              <boxGeometry args={[0.9, 0.26, 0.5]} />
              <meshStandardMaterial color={['#8a5a3a', '#3a6a8a', '#5a7a4a'][(i + k) % 3]} roughness={0.8} />
            </mesh>
          ))}
          {/* running light */}
          <mesh position={[0, 1.45, -1.6]}>
            <sphereGeometry args={[0.09, 6, 6]} />
            <meshStandardMaterial color="#ffe9a8" emissive="#ffd970" emissiveIntensity={1.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
