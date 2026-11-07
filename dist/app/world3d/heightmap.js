// ─────────────────────────────────────────────────────────────────────────────
// ISLAND HEIGHTMAP — the height field baked once into a texture so water (and
// later vegetation) can know the land shape without calling heightAt() per
// fragment in GLSL. Coordinates are world-space, centered on the origin.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { heightAt } from './terrain.js';
export const HM_SIZE = 256; // texture resolution
export const HM_WORLD = 560; // world units covered (water plane is 220*2.4 ≈ 528)
const data = new Float32Array(HM_SIZE * HM_SIZE);
for (let j = 0; j < HM_SIZE; j++) {
    for (let i = 0; i < HM_SIZE; i++) {
        const x = (i / (HM_SIZE - 1) - 0.5) * HM_WORLD;
        const z = (j / (HM_SIZE - 1) - 0.5) * HM_WORLD;
        data[j * HM_SIZE + i] = heightAt(x, z);
    }
}
export const heightTexture = new THREE.DataTexture(data, HM_SIZE, HM_SIZE, THREE.RedFormat, THREE.FloatType);
heightTexture.magFilter = THREE.LinearFilter;
heightTexture.minFilter = THREE.LinearFilter;
heightTexture.wrapS = THREE.ClampToEdgeWrapping;
heightTexture.wrapT = THREE.ClampToEdgeWrapping;
heightTexture.needsUpdate = true;
/** GLSL: sample the heightmap at a world XZ position. */
export const HM_SAMPLER_GLSL = /* glsl */ `
uniform sampler2D uHeightMap;
uniform vec2 uHMWorld;          // world units covered by the heightmap
float islandHeight(vec2 worldXZ) {
  vec2 uv = worldXZ / uHMWorld + 0.5;
  uv = clamp(uv, vec2(0.001), vec2(0.999));
  return texture2D(uHeightMap, uv).r;
}
`;
