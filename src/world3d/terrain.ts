// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN — deterministic FBM heightfield with coastline shaping, vertex colors.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { WORLD_SIZE, CITIES } from './layout';

// tiny deterministic 2D value noise
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (
    hash2(xi, yi) * (1 - u) * (1 - v) +
    hash2(xi + 1, yi) * u * (1 - v) +
    hash2(xi, yi + 1) * (1 - u) * v +
    hash2(xi + 1, yi + 1) * u * v
  );
}
export function fbm(x: number, y: number, octaves = 5): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * smoothNoise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export function heightAt(x: number, z: number): number {
  const nx = x / WORLD_SIZE + 0.5, nz = z / WORLD_SIZE + 0.5;
  // edge falloff → island continent surrounded by sea
  const ex = Math.min(nx, 1 - nx), ez = Math.min(nz, 1 - nz);
  const edge = Math.min(ex, ez);
  const coast = THREE.MathUtils.smoothstep(edge, 0.02, 0.16); // 0 at rim → 1 inland
  // bay near Port Serein (south-west inlet)
  const bayD = Math.hypot(x + 88, z + 48) / 34;
  const bay = THREE.MathUtils.smoothstep(bayD, 0.4, 1.0);
  // southern gulf near Nemea port
  const gulfD = Math.hypot(x + 2, z - 100) / 26;
  const gulf = THREE.MathUtils.smoothstep(gulfD, 0.35, 1.0);

  let h = fbm(nx * 6.2, nz * 6.2, 5) * 14 + fbm(nx * 18, nz * 18, 3) * 2.2;
  // mountain ridge north-east
  const ridgeD = Math.hypot(x - 70, z + 66) / 55;
  h += Math.max(0, 1 - ridgeD) * 16 * fbm(nx * 10 + 7, nz * 10, 3);
  h *= coast * bay * gulf;
  h -= (1 - coast) * 10 + (1 - bay) * 4 + (1 - gulf) * 4;

  // flatten around cities for buildable ground
  for (const c of CITIES) {
    const d = Math.hypot(x - c.x, z - c.z);
    const flat = THREE.MathUtils.smoothstep(d, c.districtRadius * 0.35, c.districtRadius * 1.4);
    const target = Math.max(1.2, fbm(nx * 4, nz * 4, 2) * 3);
    h = h * flat + target * (1 - flat);
  }
  return h;
}

export const SEA_LEVEL = 0.9;

export function buildTerrain(): THREE.Mesh {
  const segs = 220;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const cGrass = new THREE.Color('#5d7a4a');
  const cMeadow = new THREE.Color('#7d9b5e');
  const cForest = new THREE.Color('#3d5c39');
  const cRock = new THREE.Color('#6f6a63');
  const cSand = new THREE.Color('#b8a888');
  const cSnow = new THREE.Color('#cfd4d8');
  const cDry = new THREE.Color('#9a8f62');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const moist = fbm(x / 40 + 9, z / 40 + 3, 3);
    let c: THREE.Color;
    if (h < SEA_LEVEL + 0.5) c = cSand.clone();
    else if (h > 13.5) c = cSnow.clone().lerp(cRock, 0.4);
    else if (h > 8.5) c = cRock.clone().lerp(cForest, THREE.MathUtils.clamp((12 - h) / 4, 0, 0.6));
    else {
      c = cGrass.clone().lerp(cMeadow, fbm(x / 15, z / 15, 2));
      if (moist > 0.58) c.lerp(cForest, (moist - 0.58) * 2.4);
      // Nemea (south) drier
      const dry = THREE.MathUtils.smoothstep(z, 20, 90) * 0.5;
      c.lerp(cDry, dry * (1 - moist * 0.5));
    }
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}
