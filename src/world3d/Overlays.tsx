// ─────────────────────────────────────────────────────────────────────────────
// OVERLAYS — observer-layer analytics projected onto the world: per-civ
// region discs + signal beams colored by the selected metric (energy margin,
// automation adoption, compute build-out). Hidden when overlay === 'none'.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useUI } from '../state/store';
import { CIV_IDS } from '../sim';
import type { WorldState } from '../sim';
import { civMainCity } from './layout';
import { heightAt } from './terrain';

const ENERGY_OK = new THREE.Color('#3fae6a');
const ENERGY_TIGHT = new THREE.Color('#d9a13b');
const ENERGY_CRISIS = new THREE.Color('#d94b3b');
const BLUE = new THREE.Color('#4f7cff');
const CYAN = new THREE.Color('#22d3ee');

export function Overlays({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const discs = useRef<Record<string, THREE.Mesh | null>>({});
  const beams = useRef<Record<string, THREE.Mesh | null>>({});

  useFrame((state) => {
    const overlay = useUI.getState().overlay;
    const w = worldRef.current;
    const t = state.clock.elapsedTime;
    for (const civId of CIV_IDS) {
      const disc = discs.current[civId];
      const beam = beams.current[civId];
      if (!disc || !beam) continue;
      const visible = overlay !== 'none';
      disc.visible = visible;
      beam.visible = visible && overlay !== 'energy';
      if (!visible) continue;
      const civ = w.civs.find((c) => c.id === civId)!;
      const city = civMainCity(civId);
      const discMat = disc.material as THREE.MeshBasicMaterial;
      const beamMat = beam.material as THREE.MeshBasicMaterial;

      if (overlay === 'energy') {
        const margin = civ.energy.marginPct;
        const col = margin > 9 ? ENERGY_OK : margin > 3 ? ENERGY_TIGHT : ENERGY_CRISIS;
        discMat.color.copy(col);
        discMat.opacity = 0.16 + (margin <= 3 ? (Math.sin(t * 5) * 0.5 + 0.5) * 0.14 : 0);
        disc.scale.setScalar(1);
      } else if (overlay === 'adoption') {
        const a = (w.techs.robotics_ind.adoption[civId].intensity + w.techs.robotics_gp.adoption[civId].penetration
          + w.techs.transport_ev.adoption[civId].penetration + w.techs.transport_av.adoption[civId].penetration) / 4;
        discMat.color.copy(BLUE);
        discMat.opacity = 0.1 + a * 0.14;
        const h = 2 + a * 26;
        beam.scale.set(1, h, 1);
        beam.position.set(city.x, heightAt(city.x, city.z) + h / 2, city.z);
        beamMat.color.copy(BLUE);
        beamMat.opacity = 0.12 + a * 0.2;
      } else if (overlay === 'compute') {
        const gw = civ.compute.dcCapGW;
        const s = 0.5 + Math.min(2.2, gw / 6);
        disc.scale.setScalar(s);
        discMat.color.copy(CYAN);
        discMat.opacity = 0.10 + (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.08;
        const h = 2 + Math.min(30, gw * 1.6);
        beam.scale.set(1, h, 1);
        beam.position.set(city.x, heightAt(city.x, city.z) + h / 2, city.z);
        beamMat.color.copy(CYAN);
        beamMat.opacity = 0.14 + (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.1;
      }
    }
  });

  return (
    <group>
      {CIV_IDS.map((civId) => {
        const city = civMainCity(civId);
        return (
          <group key={civId}>
            <mesh
              ref={(m) => { discs.current[civId] = m; }}
              position={[city.x, heightAt(city.x, city.z) + 0.35, city.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              visible={false}
            >
              <circleGeometry args={[city.districtRadius * 1.7, 40]} />
              <meshBasicMaterial transparent opacity={0.14} depthWrite={false} />
            </mesh>
            <mesh
              ref={(m) => { beams.current[civId] = m; }}
              position={[city.x, 6, city.z]}
              visible={false}
            >
              <cylinderGeometry args={[1.1, 1.6, 1, 16, 1, true]} />
              <meshBasicMaterial transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
