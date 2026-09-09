// ─────────────────────────────────────────────────────────────────────────────
// ROADS — terrain-following asphalt ribbons connecting cities. Also exports
// the 3D curves so vehicles can travel them.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import * as THREE from 'three';
import { ROADS } from './layout';
import { heightAt } from './terrain';

export interface RoadPath {
  key: string;
  a: string;
  b: string;
  curve: THREE.CatmullRomCurve3;
  length: number;
}

export function buildRoadPaths(): RoadPath[] {
  return ROADS.map((r) => {
    const pts = r.pts.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.12, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
    return { key: `${r.a}-${r.b}`, a: r.a, b: r.b, curve, length: curve.getLength() };
  });
}

function ribbonGeometry(path: RoadPath, width: number): THREE.BufferGeometry {
  const segments = Math.max(12, Math.floor(path.length * 1.2));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    path.curve.getPointAt(t, pt);
    path.curve.getTangentAt(t, tan);
    side.crossVectors(up, tan).normalize().multiplyScalar(width / 2);
    const y = heightAt(pt.x, pt.z) + 0.14;
    positions.push(pt.x - side.x, y, pt.z - side.z, pt.x + side.x, y, pt.z + side.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * path.length, 1, t * path.length);
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

export function Roads() {
  const paths = useMemo(() => buildRoadPaths(), []);
  const geoms = useMemo(() => paths.map((p) => ribbonGeometry(p, 1.15)), [paths]);
  return (
    <group>
      {geoms.map((g, i) => (
        <mesh key={paths[i].key} geometry={g} receiveShadow>
          <meshStandardMaterial color="#262a31" roughness={0.94} metalness={0} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
    </group>
  );
}
