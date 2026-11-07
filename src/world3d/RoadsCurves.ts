// ─────────────────────────────────────────────────────────────────────────────
// ROAD CURVES — the inter-city highway centerlines, shared by rendering and
// vehicle motion.
// ─────────────────────────────────────────────────────────────────────────────
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
