// ─────────────────────────────────────────────────────────────────────────────
// FRONTIER & DECAY LAYER — everything the original city renderer could not
// show: derelict blocks when people leave, reclaimed districts and floating
// platforms pushed out into the sea when the island is full, fusion plants,
// spaceports with launches, a space elevator and orbital habitats overhead.
// All of it is driven by the simulation state through WorldVisual; nothing
// here appears on a date.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useUI } from '../state/store';
import { CITIES, INFRA_ZONES, civMainCity, type CityLayout, type InfraZone } from './layout';
import { heightAt, SEA_LEVEL } from './terrain';
import { CIV_IDS } from '../sim';
import type { CivId } from '../sim';
import { genLots } from './Buildings';
import type { WorldVisual } from './cityVisuals';

type VRef = React.MutableRefObject<WorldVisual | null>;
const tmp = new THREE.Object3D();
const tmpColor = new THREE.Color();

/** Direction from a city toward the nearest open water (unit vector in xz). */
function seaDirection(city: CityLayout): { dx: number; dz: number; dist: number } {
  let best = { dx: 1, dz: 0, dist: 60 };
  let bestH = Infinity;
  for (let a = 0; a < 24; a++) {
    const th = (a / 24) * Math.PI * 2;
    const dx = Math.cos(th), dz = Math.sin(th);
    for (let r = city.districtRadius + 4; r < 70; r += 3) {
      const h = heightAt(city.x + dx * r, city.z + dz * r);
      if (h < SEA_LEVEL - 0.3) {
        // prefer close water; tie-break on how deep the direction gets
        const score = r + h;
        if (score < bestH) { bestH = score; best = { dx, dz, dist: r }; }
        break;
      }
    }
  }
  return best;
}

// ── Ruins: physical shells persist; failure is heterogeneous and discrete ─────
function Ruins({ city, visualRef }: { city: CityLayout; visualRef: VRef }) {
  const lots = useMemo(() => genLots(city), [city]);
  const shells = useRef<THREE.InstancedMesh>(null);
  const fragments = useRef<THREE.InstancedMesh>(null);
  const rubble = useRef<THREE.InstancedMesh>(null);
  const applied = useRef('');
  useFrame(() => {
    const sm = shells.current, fm = fragments.current, rm = rubble.current; if (!sm || !fm || !rm) return;
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
    if (!vis) return;
    const key = `${Math.round(vis.builtFraction*80)}:${Math.round(vis.activeFraction*80)}:${Math.round(vis.decay*20)}:${Math.round(vis.rewilding*20)}`;
    if (key === applied.current) return; applied.current = key;
    const builtCount = Math.floor(lots.length * vis.builtFraction);
    const activeCount = Math.min(builtCount, Math.floor(lots.length * vis.activeFraction));
    const failurePressure = Math.min(1, vis.rewilding * 0.78 + vis.decay * 0.52);
    let out = 0;
    for (let idx = activeCount; idx < builtCount && out < lots.length; idx++, out++) {
      const lot = lots[idx];
      const x = city.x + lot.dx, z = city.z + lot.dz, ground = heightAt(x,z);
      const individual = ((idx * 37 + city.id.length * 19) % 101) / 100;
      // Abandonment does not scale a building down. It first leaves a full-height dark
      // shell; later failures remove different parts of each structure. We represent
      // that as surviving cores/walls + fallen fragments + rubble on the original lot.
      const stage = failurePressure > individual * 0.9 + 0.36 ? 2 : failurePressure > individual * 0.75 + 0.14 ? 1 : 0;
      if (stage === 0) {
        tmp.position.set(x, ground + lot.baseH/2, z); tmp.rotation.set(0,lot.rot,0); tmp.scale.set(lot.w,lot.baseH,lot.d);
        tmp.updateMatrix(); sm.setMatrixAt(out,tmp.matrix);
        tmp.position.set(0,-70,0); tmp.scale.setScalar(.001); tmp.updateMatrix(); fm.setMatrixAt(out,tmp.matrix); rm.setMatrixAt(out,tmp.matrix);
      } else {
        const coreH = lot.baseH * (stage === 1 ? 0.82 : 0.43);
        const side = stage === 1 ? 0.68 : 0.28;
        tmp.position.set(x + (individual-.5)*lot.w*.25, ground + coreH/2, z - (individual-.5)*lot.d*.18);
        tmp.rotation.set((individual-.5)*.035,lot.rot,(individual-.5)*(stage===1?.06:.13)); tmp.scale.set(lot.w*side,coreH,lot.d*(stage===1?.78:.58));
        tmp.updateMatrix(); sm.setMatrixAt(out,tmp.matrix);
        const fragH = lot.baseH * (stage===1?.44:.24);
        tmp.position.set(x + (individual>.5?1:-1)*lot.w*.48, ground + fragH*.38, z + (individual-.5)*lot.d*.55);
        tmp.rotation.set(.18+(individual*.28),lot.rot+individual*.9,.48*(individual-.5)); tmp.scale.set(lot.w*(stage===1?.28:.42),fragH,lot.d*(stage===1?.62:.48));
        tmp.updateMatrix(); fm.setMatrixAt(out,tmp.matrix);
        const rh = 0.14 + lot.baseH * (stage === 2 ? 0.055 : 0.024);
        tmp.position.set(x + (individual - 0.5) * 0.8, ground + rh/2, z + (0.5-individual)*0.7);
        tmp.rotation.set(0, lot.rot + individual, 0); tmp.scale.set(lot.w * (stage === 2 ? 1.55 : 1.05), rh, lot.d * (stage === 2 ? 1.45 : 1.0));
        tmp.updateMatrix(); rm.setMatrixAt(out,tmp.matrix);
      }
    }
    for (let i=out;i<lots.length;i++) for (const m of [sm,fm,rm]) { tmp.position.set(0,-70,0); tmp.scale.setScalar(.001); tmp.rotation.set(0,0,0); tmp.updateMatrix(); m.setMatrixAt(i,tmp.matrix); }
    for (const m of [sm,fm,rm]) m.instanceMatrix.needsUpdate = true;
  });
  return <group>
    <instancedMesh ref={shells} args={[undefined, undefined, lots.length]} castShadow receiveShadow frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#454844" roughness={1} metalness={0.02} /></instancedMesh>
    <instancedMesh ref={fragments} args={[undefined, undefined, lots.length]} castShadow receiveShadow frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#4b4e49" roughness={1} metalness={0.03} /></instancedMesh>
    <instancedMesh ref={rubble} args={[undefined, undefined, lots.length]} receiveShadow frustumCulled={false}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#55564f" roughness={1} /></instancedMesh>
  </group>;
}

// ── Coastal works: reclaimed slabs and floating modular districts ─────────────
const MAX_RECLAIM = 18;
const MAX_FLOAT = 24;

function CoastalWorks({ civId, visualRef }: { civId: CivId; visualRef: VRef }) {
  const city = useMemo(() => civMainCity(civId), [civId]);
  const sea = useMemo(() => seaDirection(city), [city]);
  const reclaimRef = useRef<THREE.InstancedMesh>(null);
  const reclaimBuildRef = useRef<THREE.InstancedMesh>(null);
  const floatRef = useRef<THREE.InstancedMesh>(null);
  const floatBuildRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const mooringRef = useRef<THREE.InstancedMesh>(null);
  const bridgeRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef({ r: -1, f: -1, c: -1 });
  const slots = useMemo(() => {
    const out: { x: number; z: number; w: number; rot: number }[] = [];
    const px = -sea.dz, pz = sea.dx;
    for (let i = 0; i < MAX_RECLAIM; i++) {
      const row = Math.floor(i / 6), col = (i % 6) - 2.5;
      out.push({ x: city.x + sea.dx * (sea.dist + 1 + row * 4.2) + px * col * 4.2, z: city.z + sea.dz * (sea.dist + 1 + row * 4.2) + pz * col * 4.2, w: 3.8, rot: Math.atan2(sea.dx, sea.dz) });
    }
    const floats: { x: number; z: number; rot: number }[] = [];
    for (let i = 0; i < MAX_FLOAT; i++) {
      const row = Math.floor(i / 8), col = (i % 8) - 3.5, off = row % 2 ? 0.5 : 0;
      const spacing=4.8;
      floats.push({ x: city.x + sea.dx * (sea.dist + 16 + row * spacing) + px * (col + off) * spacing, z: city.z + sea.dz * (sea.dist + 16 + row * spacing) + pz * (col + off) * spacing, rot: Math.atan2(sea.dx,sea.dz) });
    }
    return { fill: out, floats };
  }, [city, sea]);

  useFrame((state) => {
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id); if (!vis) return;
    const t = state.clock.elapsedTime;
    const rq = Math.round(vis.reclaimed * 36) / 36, fq = Math.round(vis.floating * 48) / 48, cq = Math.round(vis.reclaimedCondition * 10) / 10;
    const fcond = Math.max(0.02, vis.floatingCondition);
    if (floatRef.current && floatBuildRef.current && canopyRef.current && mooringRef.current && bridgeRef.current) {
      const n = Math.round(fq * MAX_FLOAT);
      for (let i = 0; i < MAX_FLOAT; i++) {
        const q = slots.floats[i];
        if (i < n) {
          const damage = 1 - fcond;
          const bob = Math.sin(t * (0.55 + damage*.5) + i*1.3) * (.05 + damage*.22);
          const tiltX = Math.sin(t*.5+i)*(.008+damage*.055), tiltZ = Math.cos(t*.6+i)*(.008+damage*.055);
          tmp.position.set(q.x,SEA_LEVEL+.28+bob,q.z); tmp.rotation.set(tiltX,q.rot,tiltZ); tmp.scale.set(1.86,.42,1.86); tmp.updateMatrix(); floatRef.current.setMatrixAt(i,tmp.matrix);
          const bh=1.4+((i*37)%7)*.34;
          tmp.position.set(q.x,SEA_LEVEL+.55+bob+bh/2,q.z); tmp.rotation.set(tiltX,q.rot,tiltZ); tmp.scale.set(2.02,bh,2.02); tmp.updateMatrix(); floatBuildRef.current.setMatrixAt(i,tmp.matrix);
          tmpColor.set(vis.population<=.00001?'#45494a':fcond<.25?'#555c5d':fcond<.55?'#9da5a2':'#e9d9b0'); floatBuildRef.current.setColorAt(i,tmpColor);
          if (i%3===0 && fcond>.18) { tmp.position.set(q.x,SEA_LEVEL+.68+bob+bh+.15,q.z); tmp.rotation.set(tiltX-.08,q.rot+.18,tiltZ); tmp.scale.set(2.8,.08,1.45); }
          else { tmp.position.set(0,-70,0); tmp.scale.setScalar(.001); tmp.rotation.set(0,0,0); }
          tmp.updateMatrix(); canopyRef.current.setMatrixAt(i,tmp.matrix);
          // Service bridges connect only adjacent modules in the same row. They are
          // separate structures, so failure removes a connection without moving the platforms.
          const sameRow=i%8!==0 && i-1<n;
          if(sameRow && fcond>.12){const prev=slots.floats[i-1],dx=q.x-prev.x,dz=q.z-prev.z,dist=Math.hypot(dx,dz);tmp.position.set((q.x+prev.x)/2,SEA_LEVEL+.62+bob*.5,(q.z+prev.z)/2);tmp.rotation.set(0,Math.atan2(dx,dz),0);tmp.scale.set(.46,.12,Math.max(.2,dist-3.55));}
          else{tmp.position.set(0,-70,0);tmp.scale.setScalar(.001);tmp.rotation.set(0,0,0);}
          tmp.updateMatrix();bridgeRef.current.setMatrixAt(i,tmp.matrix);
          const bed=heightAt(q.x,q.z),len=Math.max(.4,SEA_LEVEL-bed); tmp.position.set(q.x,bed+len/2,q.z); tmp.rotation.set(0,0,0); tmp.scale.set(.06,len,.06); tmp.updateMatrix(); mooringRef.current.setMatrixAt(i,tmp.matrix);
        } else for (const m of [floatRef.current,floatBuildRef.current,canopyRef.current,mooringRef.current,bridgeRef.current]) { tmp.position.set(0,-70,0); tmp.scale.setScalar(.001); tmp.rotation.set(0,0,0); tmp.updateMatrix(); m.setMatrixAt(i,tmp.matrix); }
      }
      for (const m of [floatRef.current,floatBuildRef.current,canopyRef.current,mooringRef.current,bridgeRef.current]) m.instanceMatrix.needsUpdate=true;
      if (floatBuildRef.current.instanceColor) floatBuildRef.current.instanceColor.needsUpdate=true;
    }
    if (rq === applied.current.r && cq === applied.current.c && fq === applied.current.f) return;
    applied.current={r:rq,f:fq,c:cq};
    if (reclaimRef.current && reclaimBuildRef.current) {
      const n=Math.round(rq*MAX_RECLAIM),sink=(1-cq)*.9;
      for(let i=0;i<MAX_RECLAIM;i++){
        const q=slots.fill[i];
        if(i<n){ const top=SEA_LEVEL+.55-sink*(.4+(i%3)*.3); tmp.position.set(q.x,top-.6,q.z); tmp.rotation.set(0,q.rot,0); tmp.scale.set(q.w,1.2,q.w); tmp.updateMatrix(); reclaimRef.current.setMatrixAt(i,tmp.matrix); const bh=(1.2+((i*53)%9)*.35)*(cq<.35?.5:1); tmp.position.set(q.x,top+bh/2,q.z); tmp.scale.set(q.w*.7,bh,q.w*.7); tmp.updateMatrix(); reclaimBuildRef.current.setMatrixAt(i,tmp.matrix); tmpColor.set(cq<.35?'#4a4d52':'#b9b3a4'); reclaimBuildRef.current.setColorAt(i,tmpColor); }
        else for(const m of [reclaimRef.current,reclaimBuildRef.current]){tmp.position.set(0,-70,0);tmp.scale.setScalar(.001);tmp.rotation.set(0,0,0);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}
      }
      reclaimRef.current.instanceMatrix.needsUpdate=true; reclaimBuildRef.current.instanceMatrix.needsUpdate=true; if(reclaimBuildRef.current.instanceColor) reclaimBuildRef.current.instanceColor.needsUpdate=true;
    }
  });
  return <group>
    <instancedMesh ref={reclaimRef} args={[undefined,undefined,MAX_RECLAIM]} receiveShadow frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#c9bfa5" roughness={.95} /></instancedMesh>
    <instancedMesh ref={reclaimBuildRef} args={[undefined,undefined,MAX_RECLAIM]} castShadow frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#b9b3a4" roughness={.8} /></instancedMesh>
    <instancedMesh ref={floatRef} args={[undefined,undefined,MAX_FLOAT]} frustumCulled={false}><cylinderGeometry args={[1,1.05,1,6]} /><meshStandardMaterial color="#dfe7ea" metalness={.15} roughness={.55} /></instancedMesh>
    <instancedMesh ref={floatBuildRef} args={[undefined,undefined,MAX_FLOAT]} castShadow frustumCulled={false}><cylinderGeometry args={[.55,.65,1,8]} /><meshStandardMaterial color="#ffffff" roughness={.58} metalness={.12} /></instancedMesh>
    <instancedMesh ref={canopyRef} args={[undefined,undefined,MAX_FLOAT]} frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#4f7892" metalness={.5} roughness={.28} /></instancedMesh>
    <instancedMesh ref={mooringRef} args={[undefined,undefined,MAX_FLOAT]} frustumCulled={false}><cylinderGeometry args={[1,1,1,6]} /><meshStandardMaterial color="#657b7d" roughness={.8} metalness={.35} /></instancedMesh>
    <instancedMesh ref={bridgeRef} args={[undefined,undefined,MAX_FLOAT]} castShadow frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#b8c4c5" metalness={.48} roughness={.38} /></instancedMesh>
  </group>;
}

// ── Fusion plant: appears beside the nuclear zone once fusion is on the grid ─
function FusionPlant({ zone, visualRef }: { zone: InfraZone; visualRef: VRef }) {
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const x = zone.x + 4.6, z = zone.z - 3.2;
  const y = useMemo(() => heightAt(x, z), [x, z]);
  useFrame((state) => {
    const fr = visualRef.current?.frontier[zone.civId];
    if (!group.current || !fr) return;
    const lvl = Math.min(1, fr.fusionLevel);
    group.current.visible = lvl > 0.02;
    group.current.scale.setScalar(0.6 + lvl * 0.6);
    if (glow.current) glow.current.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 2.2) * 0.25 + lvl * 0.8;
  });
  return (
    <group ref={group} position={[x, y, z]} visible={false}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <torusGeometry args={[1.6, 0.55, 12, 28]} />
        <meshStandardMaterial color="#c7ced8" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <torusGeometry args={[1.6, 0.22, 8, 28]} />
        <meshStandardMaterial ref={glow} color="#7fd0ff" emissive="#4fb8ff" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, 0.45, 0]} receiveShadow>
        <cylinderGeometry args={[2.6, 2.8, 0.9, 20]} />
        <meshStandardMaterial color="#8d949c" roughness={0.8} />
      </mesh>
      <mesh position={[2.9, 0.7, 1.4]} castShadow>
        <boxGeometry args={[1.6, 1.4, 1.2]} />
        <meshStandardMaterial color="#aab1b8" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ── Spaceport: pads, gantry, rockets that lift off as launch cadence rises ──
function Spaceport({ zone, visualRef }: { zone: InfraZone; visualRef: VRef }) {
  const group = useRef<THREE.Group>(null);
  const rocket = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const y = useMemo(() => heightAt(zone.x, zone.z), [zone]);
  const launch = useRef({ t: -1, period: 20 });
  useFrame((state, dt) => {
    const fr = visualRef.current?.frontier[zone.civId];
    if (!group.current || !fr) return;
    const lvl = fr.spaceportLevel;
    group.current.visible = lvl > 0.05;
    group.current.scale.setScalar(Math.min(1.4, 0.7 + lvl * 0.25));
    if (!rocket.current || !flame.current || lvl <= 0.05) return;
    const rate = fr.launchRate;
    const L = launch.current;
    if (rate <= 0.001) { L.t = -1; rocket.current.position.y = 0; flame.current.visible = false; return; }
    if (L.t < 0) { if (rate > 0.02 && Math.random() < dt * rate * 0.35) { L.t = 0; L.period = 9; } }
    if (L.t >= 0) {
      L.t += dt;
      const p = L.t / L.period;
      if (p >= 1) { L.t = -1; rocket.current.position.y = 0; flame.current.visible = false; return; }
      // slow lift then acceleration; the flame is bloom-bright
      rocket.current.position.y = Math.pow(p, 2.2) * 140;
      flame.current.visible = true;
      flame.current.scale.set(1, 1 + Math.sin(state.clock.elapsedTime * 40) * 0.3 + p * 2, 1);
    } else {
      flame.current.visible = false;
      rocket.current.position.y = 0;
    }
  });
  return (
    <group ref={group} position={[zone.x, y, zone.z]} visible={false}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[4.2, 4.2, 0.24, 24]} />
        <meshStandardMaterial color="#6b6f74" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, 0]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.6, 0.16, 16]} />
        <meshStandardMaterial color="#3d4247" roughness={0.9} />
      </mesh>
      <mesh position={[-2.6, 3.2, 0]} castShadow>
        <boxGeometry args={[0.5, 6.4, 0.5]} />
        <meshStandardMaterial color="#8a8f95" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[3.6, 0.9, 2.4]} castShadow>
        <boxGeometry args={[2.2, 1.6, 1.6]} />
        <meshStandardMaterial color="#b8bdc3" roughness={0.8} />
      </mesh>
      <group ref={rocket} position={[0, 0, 0]}>
        <mesh position={[0, 2.7, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.5, 4.8, 12]} />
          <meshStandardMaterial color="#e8eaee" metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, 5.5, 0]}>
          <coneGeometry args={[0.42, 1.2, 12]} />
          <meshStandardMaterial color="#d3d6da" metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh ref={flame} position={[0, -0.6, 0]} visible={false}>
          <coneGeometry args={[0.5, 2.6, 10]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.95} />
        </mesh>
      </group>
    </group>
  );
}

// ── Space elevator: a tether from the capital to geostationary (well, the sky) ─
function SpaceElevator({ civId, visualRef }: { civId: CivId; visualRef: VRef }) {
  const city = useMemo(() => civMainCity(civId), [civId]);
  const group = useRef<THREE.Group>(null);
  const y = useMemo(() => heightAt(city.x, city.z), [city]);
  useFrame(() => {
    const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
    if (group.current) group.current.visible = !!vis?.elevator;
  });
  return (
    <group ref={group} position={[city.x, y, city.z]} visible={false}>
      <mesh position={[0, 250, 0]}>
        <cylinderGeometry args={[0.12, 0.35, 500, 6]} />
        <meshStandardMaterial color="#d9e6ff" emissive="#8fb4ff" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[2.2, 3.2, 2.4, 12]} />
        <meshStandardMaterial color="#aeb6c2" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 480, 0]}>
        <sphereGeometry args={[6, 12, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#cfe0ff" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

// ── Orbital habitats, industry and power: schematic, differentiated sky ─────
const MAX_HABITATS = 12, MAX_ORBITAL_INDUSTRY = 10, MAX_POWER_ARRAYS = 8;
function Orbitals({ visualRef }: { visualRef: VRef }) {
  const rings = useRef<THREE.InstancedMesh>(null), hubs = useRef<THREE.InstancedMesh>(null), industry = useRef<THREE.InstancedMesh>(null), panels = useRef<THREE.InstancedMesh>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null), hubMat = useRef<THREE.MeshStandardMaterial>(null);
  const glint = useRef<THREE.Points>(null);
  const glintGeo = useMemo(() => {
    const g=new THREE.BufferGeometry(),pts:number[]=[]; let ss=99; const rnd=()=>{ss=(ss*16807)%2147483647;return ss/2147483647;};
    for(let i=0;i<400;i++){const th=rnd()*Math.PI*2,ph=.25+rnd()*.9,r=760;pts.push(r*Math.sin(ph)*Math.cos(th),r*Math.cos(ph),r*Math.sin(ph)*Math.sin(th));}
    g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); return g;
  },[]);
  useFrame((state)=>{
    const v=visualRef.current; if(!v||!rings.current||!hubs.current||!industry.current||!panels.current)return;
    const habitatCount=Math.min(MAX_HABITATS,Math.max(CIV_IDS.reduce((a,id)=>a+v.frontier[id].habitats,0),Math.ceil(Math.sqrt(Math.max(0,v.orbitalPopulationM))*1.8)));
    const occupiedOrbit=v.orbitalPopulationM>.0001;
    if(ringMat.current) ringMat.current.emissiveIntensity=occupiedOrbit ? .16+Math.min(.42,Math.log1p(v.orbitalPopulationM)*.055) : 0;
    if(hubMat.current) hubMat.current.emissiveIntensity=occupiedOrbit ? .08+Math.min(.24,Math.log1p(v.orbitalPopulationM)*.035) : 0;
    const industrialIndex=CIV_IDS.reduce((a,id)=>a+v.frontier[id].orbitalIndustry,0);
    const industryCount=Math.min(MAX_ORBITAL_INDUSTRY,Math.ceil(Math.sqrt(Math.max(0,industrialIndex))*2.2));
    const powerIndex=CIV_IDS.reduce((a,id)=>a+v.frontier[id].powerSatellites,0);
    const powerCount=Math.min(MAX_POWER_ARRAYS,Math.ceil(powerIndex*2.4));
    const t=state.clock.elapsedTime;
    for(let i=0;i<MAX_HABITATS;i++){
      if(i<habitatCount){const a=t*.012+i*.52,r=420+(i%4)*60,y=260+(i%3)*45;tmp.position.set(Math.cos(a)*r,y,Math.sin(a)*r*.55);tmp.rotation.set(Math.PI/2+Math.sin(a)*.3,a,0);tmp.scale.setScalar(1);tmp.updateMatrix();rings.current.setMatrixAt(i,tmp.matrix);tmp.scale.set(2.4,6.6,2.4);tmp.updateMatrix();hubs.current.setMatrixAt(i,tmp.matrix);} else for(const m of [rings.current,hubs.current]){tmp.position.set(0,-80,0);tmp.scale.setScalar(.001);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}
    }
    for(let i=0;i<MAX_ORBITAL_INDUSTRY;i++){
      if(i<industryCount){const a=-t*.009+i*.83,r=330+(i%3)*45;tmp.position.set(Math.cos(a)*r,190+(i%4)*24,Math.sin(a)*r*.62);tmp.rotation.set(.25,a*.6,.35);tmp.scale.set(7+(i%2)*3,2.4,3.5);}
      else{tmp.position.set(0,-80,0);tmp.scale.setScalar(.001);}tmp.updateMatrix();industry.current.setMatrixAt(i,tmp.matrix);
    }
    for(let i=0;i<MAX_POWER_ARRAYS;i++){
      if(i<powerCount){const a=t*.006+i*1.17,r=500+(i%2)*65;tmp.position.set(Math.cos(a)*r,320+(i%3)*34,Math.sin(a)*r*.48);tmp.rotation.set(.2,a,Math.sin(a)*.18);tmp.scale.set(15,.35,5.2);}
      else{tmp.position.set(0,-80,0);tmp.scale.setScalar(.001);}tmp.updateMatrix();panels.current.setMatrixAt(i,tmp.matrix);
    }
    for(const m of [rings.current,hubs.current,industry.current,panels.current])m.instanceMatrix.needsUpdate=true;
    if(glint.current){const night=(window as any).__nightFactor??0;(glint.current.material as THREE.PointsMaterial).opacity=Math.min(1,v.dysonProgress*3)*(.35+night*.65);glint.current.rotation.y=t*.004;}
  });
  return <>
    <instancedMesh ref={rings} args={[undefined,undefined,MAX_HABITATS]} frustumCulled={false}><torusGeometry args={[9,2.15,12,40]} /><meshStandardMaterial ref={ringMat} color="#e6ecf5" emissive="#9fc4ff" emissiveIntensity={.35} metalness={.55} roughness={.32} /></instancedMesh>
    <instancedMesh ref={hubs} args={[undefined,undefined,MAX_HABITATS]} frustumCulled={false}><cylinderGeometry args={[1,1,1,12]} /><meshStandardMaterial ref={hubMat} color="#bfcbd7" emissive="#6a9bc4" emissiveIntensity={.16} metalness={.52} roughness={.38} /></instancedMesh>
    <instancedMesh ref={industry} args={[undefined,undefined,MAX_ORBITAL_INDUSTRY]} frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#adb5bd" emissive="#d39d58" emissiveIntensity={.12} metalness={.64} roughness={.34} /></instancedMesh>
    <instancedMesh ref={panels} args={[undefined,undefined,MAX_POWER_ARRAYS]} frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#315c7b" emissive="#4b90b8" emissiveIntensity={.22} metalness={.5} roughness={.2} /></instancedMesh>
    <points ref={glint} geometry={glintGeo} renderOrder={-8}><pointsMaterial size={2.2} sizeAttenuation={false} color="#ffe9b0" transparent opacity={0} depthWrite={false} /></points>
  </>;
}

// ── Mars + deep-space continuity: schematic, explicitly not to scale ─────────
const MAX_ARKS = 7;
function OffworldBodies({ visualRef }: { visualRef: VRef }) {
  const mars = useRef<THREE.Group>(null);
  const cityLights = useRef<THREE.Points>(null);
  const arks = useRef<THREE.InstancedMesh>(null);
  const trails = useRef<THREE.InstancedMesh>(null);
  const lightGeo = useMemo(() => {
    const g = new THREE.BufferGeometry(); const pts:number[]=[];
    let ss=811; const rnd=()=>{ss=(ss*48271)%2147483647;return ss/2147483647;};
    for(let i=0;i<90;i++){
      const th=rnd()*Math.PI*2, u=rnd()*2-1, rr=12.25;
      const q=Math.sqrt(Math.max(0,1-u*u)); pts.push(rr*q*Math.cos(th),rr*u,rr*q*Math.sin(th));
    }
    g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); return g;
  },[]);
  useFrame((state)=>{
    const v=visualRef.current; if(!v||!mars.current||!arks.current||!trails.current)return;
    const cap=Math.max(0,v.marsCapacityM), marsPop=Math.max(0,v.marsPopulationM), deep=Math.max(0,v.deepSpacePopulationM), t=state.clock.elapsedTime;
    mars.current.visible=cap>.001;
    if(mars.current.visible){
      const maturity=Math.min(1,Math.log1p(cap*10)/3.2), occupancy=cap>.000001?Math.min(1,marsPop/cap):0;
      mars.current.rotation.y=t*.0025;
      mars.current.scale.setScalar(.82+maturity*.24);
      if(cityLights.current){const mat=cityLights.current.material as THREE.PointsMaterial;mat.opacity=marsPop>.00001 ? (.08+maturity*.34)*(.25+occupancy*.75) : 0;mat.size=1.2+maturity*.65;}
    }
    const n=Math.min(MAX_ARKS,deep<=.0001?0:Math.max(1,Math.ceil(Math.log10(1+deep*200)*2.2)));
    for(let i=0;i<MAX_ARKS;i++){
      if(i<n){
        const a=i*.72+.35, progress=.2+(i+1)/(MAX_ARKS+1)*.8;
        tmp.position.set(-110-Math.cos(a)*65-progress*105,165+Math.sin(a*.8)*32+i*5,-250-progress*230);
        tmp.rotation.set(.25,a*.35,.6+Math.sin(a)*.18); tmp.scale.set(4.8,1.25,1.7); tmp.updateMatrix(); arks.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(tmp.position.x+23,tmp.position.y,tmp.position.z+23); tmp.rotation.set(0,a*.35,0); tmp.scale.set(28,.035,.035); tmp.updateMatrix(); trails.current.setMatrixAt(i,tmp.matrix);
      } else {
        for(const m of [arks.current,trails.current]){tmp.position.set(0,-90,0);tmp.scale.setScalar(.001);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}
      }
    }
    arks.current.instanceMatrix.needsUpdate=true; trails.current.instanceMatrix.needsUpdate=true;
  });
  return <group>
    <group ref={mars} visible={false} position={[-160,145,-255]}>
      <mesh castShadow receiveShadow><sphereGeometry args={[12,48,32]} /><meshStandardMaterial color="#9d5137" roughness={.84} metalness={.02} /></mesh>
      <mesh rotation={[.17,0,.22]}><sphereGeometry args={[12.13,40,26]} /><meshStandardMaterial color="#d48660" transparent opacity={.13} roughness={1} depthWrite={false} /></mesh>
      <mesh position={[0,12.2,0]} rotation={[0,0,.24]}><cylinderGeometry args={[3.8,4.3,.22,28]} /><meshStandardMaterial color="#d7c9b5" roughness={.7} /></mesh>
      <points ref={cityLights} geometry={lightGeo}><pointsMaterial color="#ffd698" transparent opacity={0} size={1.3} sizeAttenuation={false} depthWrite={false} /></points>
      <mesh position={[17,1,0]} rotation={[Math.PI/2,.25,0]}><torusGeometry args={[16.8,.055,6,64]} /><meshBasicMaterial color="#d79a79" transparent opacity={.22} /></mesh>
    </group>
    <instancedMesh ref={arks} args={[undefined,undefined,MAX_ARKS]} frustumCulled={false}><capsuleGeometry args={[1,3,8,16]} /><meshStandardMaterial color="#dce6ec" emissive="#79b6d8" emissiveIntensity={.22} metalness={.58} roughness={.26} /></instancedMesh>
    <instancedMesh ref={trails} args={[undefined,undefined,MAX_ARKS]} frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshBasicMaterial color="#7fc9e8" transparent opacity={.18} depthWrite={false} /></instancedMesh>
  </group>;
}

// ── Sea-floor habitats: physical hulls + explicit diagnostic x-ray overlay ──
const MAX_DOMES = 18, MAX_AERIAL = 4;
function DomesAndPlatforms({ civId, visualRef }: { civId: CivId; visualRef: VRef }) {
  const subsurface = useUI((s) => s.cameraMode === 'subsurface');
  const city=useMemo(()=>civMainCity(civId),[civId]),sea=useMemo(()=>seaDirection(city),[city]);
  const domes=useRef<THREE.InstancedMesh>(null),bases=useRef<THREE.InstancedMesh>(null),shafts=useRef<THREE.InstancedMesh>(null),domeX=useRef<THREE.InstancedMesh>(null),shaftX=useRef<THREE.InstancedMesh>(null),buoys=useRef<THREE.InstancedMesh>(null),platforms=useRef<THREE.InstancedMesh>(null);
  const domeMat=useRef<THREE.MeshStandardMaterial>(null),buoyMat=useRef<THREE.MeshStandardMaterial>(null),aerialMat=useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state)=>{
    const vis=visualRef.current?.cities.find((c)=>c.city.id===city.id); if(!vis||!domes.current||!bases.current||!shafts.current||!domeX.current||!shaftX.current||!buoys.current||!platforms.current)return;
    const t=state.clock.elapsedTime,occupied=vis.population>.00001;
    if(domeMat.current)domeMat.current.emissiveIntensity=occupied?.32*Math.max(.1,vis.subseaCondition):0;
    if(buoyMat.current)buoyMat.current.emissiveIntensity=occupied?.28*Math.max(.15,vis.subseaCondition):0;
    if(aerialMat.current)aerialMat.current.emissiveIntensity=occupied?.32:0;
    const nd=Math.round(vis.subsea*MAX_DOMES),na=Math.round(vis.aerial*MAX_AERIAL),px=-sea.dz,pz=sea.dx;
    for(let i=0;i<MAX_DOMES;i++){
      if(i<nd){const band=Math.floor(i/3),r=sea.dist+27+band*7+(i%3)*3.5,side=((i%6)-2.5)*6.2,x=city.x+sea.dx*r+px*side,z=city.z+sea.dz*r+pz*side,bed=heightAt(x,z),cond=Math.max(.02,vis.subseaCondition),growth=.86+Math.min(.55,band*.075),hullY=bed+1.05*growth;
        tmp.position.set(x,bed+.16,z);tmp.rotation.set(0,i*.41,0);tmp.scale.set(2.5*growth,.28,2.5*growth);tmp.updateMatrix();bases.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,hullY,z);tmp.scale.set(1.9*growth,1.18*growth,1.9*growth);tmp.updateMatrix();domes.current.setMatrixAt(i,tmp.matrix);domeX.current.setMatrixAt(i,tmp.matrix);
        const len=Math.max(.5,SEA_LEVEL-hullY);tmp.position.set(x,hullY+len/2,z);tmp.rotation.set(0,0,0);tmp.scale.set(.10,len,.10);tmp.updateMatrix();shafts.current.setMatrixAt(i,tmp.matrix);shaftX.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,SEA_LEVEL+.34+Math.sin(t*.7+i)*.05,z);tmp.scale.set(.52,.28,.52);tmp.updateMatrix();buoys.current.setMatrixAt(i,tmp.matrix);
        tmpColor.set(cond<.25?'#704f45':cond<.55?'#78969c':'#8fd6e8');domes.current.setColorAt(i,tmpColor);
      } else for(const m of [domes.current,bases.current,shafts.current,domeX.current,shaftX.current,buoys.current]){tmp.position.set(0,-80,0);tmp.scale.setScalar(.001);tmp.rotation.set(0,0,0);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}
    }
    for(let i=0;i<MAX_AERIAL;i++){if(i<na){const a=t*.02+i*1.6;tmp.position.set(city.x+Math.cos(a)*14,62+i*6+Math.sin(t*.3+i)*.6,city.z+Math.sin(a)*14);tmp.rotation.set(0,a,0);tmp.scale.set(1,1,1);}else{tmp.position.set(0,-80,0);tmp.scale.setScalar(.001);}tmp.updateMatrix();platforms.current.setMatrixAt(i,tmp.matrix);}
    for(const m of [domes.current,bases.current,shafts.current,domeX.current,shaftX.current,buoys.current,platforms.current])m.instanceMatrix.needsUpdate=true;if(domes.current.instanceColor)domes.current.instanceColor.needsUpdate=true;
  });
  return <group>
    <instancedMesh ref={bases} args={[undefined,undefined,MAX_DOMES]} frustumCulled={false}><cylinderGeometry args={[1,1.08,1,18]} /><meshStandardMaterial color="#52636b" metalness={.42} roughness={.52} /></instancedMesh>
    <instancedMesh ref={domes} args={[undefined,undefined,MAX_DOMES]} frustumCulled={false}><sphereGeometry args={[1,28,18]} /><meshStandardMaterial ref={domeMat} color="#ffffff" emissive="#184c59" emissiveIntensity={.32} transparent opacity={.78} depthWrite={true} depthTest={true} metalness={.15} roughness={.22} /></instancedMesh>
    <instancedMesh ref={shafts} args={[undefined,undefined,MAX_DOMES]} frustumCulled={false}><cylinderGeometry args={[1,1,1,8]} /><meshStandardMaterial color="#577a82" metalness={.55} roughness={.42} /></instancedMesh>
    {/* Diagnostic cutaway: wireframe only. The physical hulls above still obey depth. */}
    <instancedMesh ref={domeX} args={[undefined,undefined,MAX_DOMES]} frustumCulled={false} visible={subsurface}><sphereGeometry args={[1,18,12]} /><meshBasicMaterial color="#7fe2ef" wireframe transparent opacity={.14} depthWrite={false} depthTest={true} /></instancedMesh>
    <instancedMesh ref={shaftX} args={[undefined,undefined,MAX_DOMES]} frustumCulled={false} visible={subsurface}><cylinderGeometry args={[1,1,1,6]} /><meshBasicMaterial color="#79c9dc" wireframe transparent opacity={.13} depthWrite={false} depthTest={true} /></instancedMesh>
    <instancedMesh ref={buoys} args={[undefined,undefined,MAX_DOMES]} frustumCulled={false}><cylinderGeometry args={[1,1.2,1,12]} /><meshStandardMaterial ref={buoyMat} color="#f0c46c" emissive="#f0a84f" emissiveIntensity={.28} metalness={.2} roughness={.44} /></instancedMesh>
    <instancedMesh ref={platforms} args={[undefined,undefined,MAX_AERIAL]} frustumCulled={false}><cylinderGeometry args={[4.5,3.5,.8,16]} /><meshStandardMaterial ref={aerialMat} color="#eef3ff" emissive="#bcd4ff" emissiveIntensity={.32} metalness={.18} roughness={.36} /></instancedMesh>
  </group>;
}

// ── Ecological succession: shrubs, saplings and trees invade abandoned lots ─
const MAX_REWILD = 72, MAX_SHRUBS = 144;
function Rewilding({ city, visualRef }: { city: CityLayout; visualRef: VRef }) {
  const trunks=useRef<THREE.InstancedMesh>(null),crowns=useRef<THREE.InstancedMesh>(null),shrubs=useRef<THREE.InstancedMesh>(null);
  const pts=useMemo(()=>{const lots=genLots(city);return Array.from({length:MAX_SHRUBS},(_,i)=>{const lot=lots[(i*17+3)%Math.max(1,lots.length)],j=((i*43)%17)/17-.5;return{x:city.x+lot.dx+j*lot.w,z:city.z+lot.dz-j*lot.d,s:.35+((i*29)%13)/13,i};});},[city]);
  useFrame(()=>{
    const vis=visualRef.current?.cities.find((c)=>c.city.id===city.id);if(!vis||!trunks.current||!crowns.current||!shrubs.current)return;
    const succession=Math.min(1,vis.rewilding*(.35+vis.derelict*.9)),nt=Math.round(MAX_REWILD*succession),ns=Math.round(MAX_SHRUBS*Math.min(1, succession*1.35));
    for(let i=0;i<MAX_SHRUBS;i++){const q=pts[i],y=heightAt(q.x,q.z);if(i<ns){tmp.position.set(q.x,y+.13+q.s*.08,q.z);tmp.rotation.set(0,q.i*.43,0);tmp.scale.set(q.s*.42,.16+q.s*.18,q.s*.36);}else{tmp.position.set(0,-70,0);tmp.scale.setScalar(.001);}tmp.updateMatrix();shrubs.current.setMatrixAt(i,tmp.matrix);}
    for(let i=0;i<MAX_REWILD;i++){const q=pts[(i*2)%pts.length];if(i<nt){const y=heightAt(q.x,q.z),m=.65+q.s*.65;tmp.position.set(q.x,y+m*.42,q.z);tmp.rotation.set(0,q.i*.73,0);tmp.scale.set(m*.18,m*.85,m*.18);tmp.updateMatrix();trunks.current.setMatrixAt(i,tmp.matrix);tmp.position.set(q.x,y+m*1.05,q.z);tmp.scale.set(m*.52,m*.9,m*.52);tmp.updateMatrix();crowns.current.setMatrixAt(i,tmp.matrix);}else for(const m of [trunks.current,crowns.current]){tmp.position.set(0,-70,0);tmp.scale.setScalar(.001);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}}
    for(const m of [trunks.current,crowns.current,shrubs.current])m.instanceMatrix.needsUpdate=true;
  });
  return <group>
    <instancedMesh ref={shrubs} args={[undefined,undefined,MAX_SHRUBS]} frustumCulled={false}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color="#557a53" roughness={1} /></instancedMesh>
    <instancedMesh ref={trunks} args={[undefined,undefined,MAX_REWILD]} frustumCulled={false}><cylinderGeometry args={[1,1.15,1,6]} /><meshStandardMaterial color="#5f4d3e" roughness={1} /></instancedMesh>
    <instancedMesh ref={crowns} args={[undefined,undefined,MAX_REWILD]} frustumCulled={false}><icosahedronGeometry args={[1,1]} /><meshStandardMaterial color="#496b4f" roughness={1} /></instancedMesh>
  </group>;
}

// ── Vertical / underground city exits: engineered, fixed-site systems ─────
const MAX_ARCOLOGIES = 7, MAX_UNDERGROUND = 18;
function VerticalHabitats({ civId, visualRef }: { civId: CivId; visualRef: VRef }) {
  const subsurface = useUI((s) => s.cameraMode === 'subsurface');
  const city=useMemo(()=>civMainCity(civId),[civId]);
  const arcs=useRef<THREE.InstancedMesh>(null),skyLobbies=useRef<THREE.InstancedMesh>(null),upperDecks=useRef<THREE.InstancedMesh>(null),cores=useRef<THREE.InstancedMesh>(null),crowns=useRef<THREE.InstancedMesh>(null),portals=useRef<THREE.InstancedMesh>(null),shafts=useRef<THREE.InstancedMesh>(null),chambers=useRef<THREE.InstancedMesh>(null),shaftX=useRef<THREE.InstancedMesh>(null),chamberX=useRef<THREE.InstancedMesh>(null);
  const chamberMat=useRef<THREE.MeshStandardMaterial>(null),skyMat=useRef<THREE.MeshStandardMaterial>(null),coreMat=useRef<THREE.MeshStandardMaterial>(null);
  useFrame(()=>{
    const vis=visualRef.current?.cities.find((c)=>c.city.id===city.id);if(!vis||!arcs.current||!skyLobbies.current||!upperDecks.current||!cores.current||!crowns.current||!portals.current||!shafts.current||!chambers.current||!shaftX.current||!chamberX.current)return;
    const inhabited=vis.population>.00001;
    if(chamberMat.current)chamberMat.current.emissiveIntensity=inhabited?.22*Math.max(.12,vis.undergroundCondition):0;
    if(skyMat.current)skyMat.current.emissiveIntensity=inhabited?.11*Math.max(.15,vis.verticalCondition):0;
    if(coreMat.current)coreMat.current.emissiveIntensity=inhabited?.28*Math.max(.12,vis.verticalCondition):0;
    const na=Math.round(vis.vertical*MAX_ARCOLOGIES),nu=Math.round(vis.underground*MAX_UNDERGROUND);
    for(let i=0;i<MAX_ARCOLOGIES;i++){
      if(i<na){const a=i*1.71+.4,r=city.districtRadius*(.16+(i%3)*.11),x=city.x+Math.cos(a)*r,z=city.z+Math.sin(a)*r,ground=heightAt(x,z),h=18+i*5.5,rad=2.5+(i%2)*.7;
        tmp.position.set(x,ground+h/2,z);tmp.rotation.set(0,a*.4,0);tmp.scale.set(rad,h,rad);tmpColor.set(vis.verticalCondition<.3?'#5f6260':vis.verticalCondition<.6?'#8f9695':'#c8d0d8');arcs.current.setColorAt(i,tmpColor);tmp.updateMatrix();arcs.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,ground+h*.44,z);tmp.rotation.set(0,a*.4+.2,0);tmp.scale.set(rad*1.38,.55,rad*1.38);tmp.updateMatrix();skyLobbies.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,ground+h*.73,z);tmp.rotation.set(0,a*.4-.15,0);tmp.scale.set(rad*1.18,.38,rad*1.18);tmp.updateMatrix();upperDecks.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,ground+h*.52,z);tmp.rotation.set(0,a*.4,0);tmp.scale.set(rad*.34,h*.84,rad*.34);tmp.updateMatrix();cores.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,ground+h+.9,z);tmp.rotation.set(0,a*.4,0);tmp.scale.set(rad*.62,1.8,rad*.62);tmp.updateMatrix();crowns.current.setMatrixAt(i,tmp.matrix);
      }else for(const m of [arcs.current,skyLobbies.current,upperDecks.current,cores.current,crowns.current]){tmp.position.set(0,-80,0);tmp.scale.setScalar(.001);tmp.rotation.set(0,0,0);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}
    }
    for(let i=0;i<MAX_UNDERGROUND;i++){
      if(i<nu){const a=i*2.13+.7,ring=Math.floor(i/6),r=city.districtRadius*(.48+(i%6)*.075),x=city.x+Math.cos(a)*r,z=city.z+Math.sin(a)*r,ground=heightAt(x,z),depth=5.2+i*1.22+ring*1.8,growth=.88+Math.min(.55,i/MAX_UNDERGROUND*.7);
        tmp.position.set(x,ground+.24,z);tmp.rotation.set(0,a,0);tmp.scale.set(1.45+(i%2)*.42,.30,1.45+(i%2)*.42);tmp.updateMatrix();portals.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,ground-depth/2,z);tmp.rotation.set(0,0,0);tmp.scale.set(.11,depth,.11);tmp.updateMatrix();shafts.current.setMatrixAt(i,tmp.matrix);shaftX.current.setMatrixAt(i,tmp.matrix);
        tmp.position.set(x,ground-depth,z);tmp.rotation.set(0,a,0);tmp.scale.set((4.0+(i%3)*.65)*growth,(1.45+ring*.28)*growth,(2.4+(i%2)*.48)*growth);tmpColor.set(vis.undergroundCondition<.3?'#6f554c':vis.undergroundCondition<.6?'#8aa0a0':'#92d2ca');tmp.updateMatrix();chambers.current.setMatrixAt(i,tmp.matrix);chamberX.current.setMatrixAt(i,tmp.matrix);chambers.current.setColorAt(i,tmpColor);
      }else for(const m of [portals.current,shafts.current,chambers.current,shaftX.current,chamberX.current]){tmp.position.set(0,-80,0);tmp.scale.setScalar(.001);tmp.rotation.set(0,0,0);tmp.updateMatrix();m.setMatrixAt(i,tmp.matrix);}
    }
    for(const m of [arcs.current,skyLobbies.current,upperDecks.current,cores.current,crowns.current,portals.current,shafts.current,chambers.current,shaftX.current,chamberX.current])m.instanceMatrix.needsUpdate=true;if(arcs.current.instanceColor)arcs.current.instanceColor.needsUpdate=true;if(chambers.current.instanceColor)chambers.current.instanceColor.needsUpdate=true;
  });
  return <group>
    <instancedMesh ref={arcs} args={[undefined,undefined,MAX_ARCOLOGIES]} castShadow frustumCulled={false}><cylinderGeometry args={[1,.68,1,16]} /><meshStandardMaterial color="#ffffff" roughness={.34} metalness={.28} /></instancedMesh>
    <instancedMesh ref={skyLobbies} args={[undefined,undefined,MAX_ARCOLOGIES]} castShadow frustumCulled={false}><cylinderGeometry args={[1,1,1,20]} /><meshStandardMaterial ref={skyMat} color="#91a7b3" emissive="#7299aa" emissiveIntensity={.08} metalness={.36} roughness={.28} /></instancedMesh>
    <instancedMesh ref={upperDecks} args={[undefined,undefined,MAX_ARCOLOGIES]} castShadow frustumCulled={false}><cylinderGeometry args={[1,1,1,24]} /><meshStandardMaterial color="#bfd0d7" metalness={.42} roughness={.24} /></instancedMesh>
    <instancedMesh ref={cores} args={[undefined,undefined,MAX_ARCOLOGIES]} castShadow frustumCulled={false}><cylinderGeometry args={[1,1,1,16]} /><meshStandardMaterial ref={coreMat} color="#8fb6be" emissive="#62b2c2" emissiveIntensity={.25} metalness={.5} roughness={.2} /></instancedMesh>
    <instancedMesh ref={crowns} args={[undefined,undefined,MAX_ARCOLOGIES]} castShadow frustumCulled={false}><cylinderGeometry args={[.65,1,1,14]} /><meshStandardMaterial color="#d8e2e7" metalness={.42} roughness={.3} /></instancedMesh>
    <instancedMesh ref={portals} args={[undefined,undefined,MAX_UNDERGROUND]} frustumCulled={false}><cylinderGeometry args={[1,1.25,1,18]} /><meshStandardMaterial color="#4e545a" roughness={.78} metalness={.22} /></instancedMesh>
    <instancedMesh ref={shafts} args={[undefined,undefined,MAX_UNDERGROUND]} frustumCulled={false}><cylinderGeometry args={[1,1,1,8]} /><meshStandardMaterial color="#50706c" roughness={.55} metalness={.32} /></instancedMesh>
    <instancedMesh ref={chambers} args={[undefined,undefined,MAX_UNDERGROUND]} frustumCulled={false}><boxGeometry args={[1,1,1]} /><meshStandardMaterial ref={chamberMat} color="#ffffff" emissive="#32675f" emissiveIntensity={.22} transparent opacity={.82} depthWrite={true} depthTest={true} metalness={.18} roughness={.34} /></instancedMesh>
    {/* Explicit cutaway overlay: physical chambers above obey terrain occlusion. */}
    <instancedMesh ref={shaftX} args={[undefined,undefined,MAX_UNDERGROUND]} frustumCulled={false} visible={subsurface}><cylinderGeometry args={[1,1,1,6]} /><meshBasicMaterial color="#79b9b0" wireframe transparent opacity={.12} depthWrite={false} depthTest={true} /></instancedMesh>
    <instancedMesh ref={chamberX} args={[undefined,undefined,MAX_UNDERGROUND]} frustumCulled={false} visible={subsurface}><boxGeometry args={[1,1,1]} /><meshBasicMaterial color="#87dfd2" wireframe transparent opacity={.13} depthWrite={false} depthTest={true} /></instancedMesh>
  </group>;
}

// ── A diversified energy landscape: not every future is solar + fusion ──────
function DiversifiedEnergy({ civId, visualRef }: { civId: CivId; visualRef: VRef }) {
  const city = useMemo(() => civMainCity(civId), [civId]);
  const sea = useMemo(() => seaDirection(city), [city]);
  const geothermal = useRef<THREE.Group>(null), bio = useRef<THREE.Group>(null), hydrogen = useRef<THREE.Group>(null), ocean = useRef<THREE.Group>(null);
  useFrame((state) => {
    const fr = visualRef.current?.frontier[civId]; if (!fr) return;
    const set = (g: THREE.Group | null, level: number) => { if (!g) return; g.visible = level > 0.04; g.scale.setScalar(0.65 + Math.min(1.4, level) * 0.45); };
    set(geothermal.current, fr.geothermalLevel); set(bio.current, fr.bioenergyLevel); set(hydrogen.current, fr.hydrogenLevel); set(ocean.current, fr.oceanEnergyLevel);
    if (ocean.current) ocean.current.position.y = SEA_LEVEL + 0.15 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04;
  });
  const baseY = heightAt(city.x, city.z);
  const ox = city.x + sea.dx * (sea.dist + 24), oz = city.z + sea.dz * (sea.dist + 24);
  return <group>
    <group ref={geothermal} visible={false} position={[city.x + 18, heightAt(city.x + 18, city.z + 12), city.z + 12]}>
      <mesh position={[0, 1.2, 0]} castShadow><cylinderGeometry args={[0.8, 1.05, 2.4, 12]} /><meshStandardMaterial color="#9f8f7b" roughness={0.85} /></mesh>
      <mesh position={[1.3, 0.65, 0]}><torusGeometry args={[0.7, 0.12, 8, 18]} /><meshStandardMaterial color="#786b5c" metalness={0.3} /></mesh>
    </group>
    <group ref={bio} visible={false} position={[city.x - 18, heightAt(city.x - 18, city.z + 14), city.z + 14]}>
      <mesh position={[-0.8, 1.1, 0]} castShadow><cylinderGeometry args={[0.9, 1, 2.2, 12]} /><meshStandardMaterial color="#85916f" roughness={0.75} /></mesh>
      <mesh position={[1, 0.9, 0]} castShadow><cylinderGeometry args={[0.75, 0.85, 1.8, 12]} /><meshStandardMaterial color="#6f7d5c" roughness={0.75} /></mesh>
    </group>
    <group ref={hydrogen} visible={false} position={[city.x + 12, baseY, city.z - 17]}>
      <mesh position={[-0.9, 0.9, 0]} castShadow><sphereGeometry args={[0.9, 14, 10]} /><meshStandardMaterial color="#d9eef2" roughness={0.35} metalness={0.15} /></mesh>
      <mesh position={[1.1, 0.9, 0]} castShadow><sphereGeometry args={[0.9, 14, 10]} /><meshStandardMaterial color="#d9eef2" roughness={0.35} metalness={0.15} /></mesh>
      <mesh position={[0.1, 0.2, 0]}><boxGeometry args={[3.3, 0.18, 0.25]} /><meshStandardMaterial color="#74b9c6" metalness={0.45} /></mesh>
    </group>
    <group ref={ocean} visible={false} position={[ox, SEA_LEVEL + 0.15, oz]}>
      <mesh position={[-2.1, 0, 0]}><cylinderGeometry args={[0.35, 0.55, 0.55, 10]} /><meshStandardMaterial color="#d9b65f" roughness={0.55} /></mesh>
      <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.35, 0.55, 0.55, 10]} /><meshStandardMaterial color="#d9b65f" roughness={0.55} /></mesh>
      <mesh position={[2.1, -0.04, 0]}><cylinderGeometry args={[0.35, 0.55, 0.55, 10]} /><meshStandardMaterial color="#d9b65f" roughness={0.55} /></mesh>
    </group>
  </group>;
}

export function FrontierLayer({ visualRef }: { visualRef: VRef }) {
  return (
    <group>
      {CITIES.map((c) => <Ruins key={`ruins-${c.id}`} city={c} visualRef={visualRef} />)}
      {CITIES.map((c) => <Rewilding key={`rewild-${c.id}`} city={c} visualRef={visualRef} />)}
      {CIV_IDS.map((id) => <CoastalWorks key={`coast-${id}`} civId={id} visualRef={visualRef} />)}
      {CIV_IDS.map((id) => <VerticalHabitats key={`vertical-${id}`} civId={id} visualRef={visualRef} />)}
      {CIV_IDS.map((id) => <DiversifiedEnergy key={`divenergy-${id}`} civId={id} visualRef={visualRef} />)}
      {INFRA_ZONES.filter((z) => z.type === 'nuclear').map((z) => <FusionPlant key={`fusion-${z.id}`} zone={z} visualRef={visualRef} />)}
      {INFRA_ZONES.filter((z) => z.type === 'spaceport').map((z) => <Spaceport key={`sp-${z.id}`} zone={z} visualRef={visualRef} />)}
      {CIV_IDS.map((id) => <SpaceElevator key={`elev-${id}`} civId={id} visualRef={visualRef} />)}
      {CIV_IDS.map((id) => <DomesAndPlatforms key={`dome-${id}`} civId={id} visualRef={visualRef} />)}
      <Orbitals visualRef={visualRef} />
      <OffworldBodies visualRef={visualRef} />
    </group>
  );
}
