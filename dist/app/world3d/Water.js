import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// WATER — animated shader plane: depth-aware color from the island heightmap
// (sandy shallows → turquoise → deep offshore), animated swell normals,
// fresnel sky reflection (tracks the same dusk/fog colors as the sky), sun
// and moon glint, shore foam, crest sparkle. Transparent so the sea bed
// shows through close to the coast.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WORLD_SIZE } from './layout.js';
import { SEA_LEVEL } from './terrain.js';
import { skyState } from './skyState.js';
import { heightTexture, HM_WORLD, HM_SAMPLER_GLSL } from './heightmap.js';
const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FRAG = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uDusk;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
varying vec2 vUv;
varying vec3 vWorld;
${HM_SAMPLER_GLSL}

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; }
  return s;
}

void main() {
  vec2 p = vWorld.xz * 0.12;

  // ── animated swell: two travelling directional waves + fine detail ────────
  float t = uTime * 0.22;
  float w1 = sin(dot(p, vec2(0.55, 0.28)) * 2.6 + t * 1.9);
  float w2 = sin(dot(p, vec2(-0.32, 0.62)) * 3.4 + t * 1.3 + w1 * 0.6);
  float n1 = noise(p * 1.0 + vec2(uTime*0.05, uTime*0.03));
  float n2 = noise(p * 2.3 - vec2(uTime*0.04, uTime*0.06));

  vec3 N = normalize(vec3(
    w1 * 0.28 + (n1-0.5)*0.30 + (n2-0.5)*0.14 + w2 * 0.10,
    1.0,
    w2 * 0.24 - (n2-0.5)*0.30 - (n1-0.5)*0.12 - w1 * 0.08
  ));

  // ── land-aware shading from the baked heightmap ───────────────────────────
  float h = islandHeight(vWorld.xz);          // terrain height under this texel
  float depth = max(0.0, ${'0.9'} - h);       // water column depth (SEA_LEVEL)
  float bed = clamp(depth / 8.0, 0.0, 1.0);   // 0 at shoreline → 1 deep

  vec3 dayDeep = vec3(0.05, 0.20, 0.32);
  vec3 dayShallow = vec3(0.30, 0.62, 0.63);
  vec3 dayBed = vec3(0.62, 0.58, 0.42);       // sandy bed seen through water
  vec3 nightDeep = vec3(0.010, 0.026, 0.055);
  vec3 nightShallow = vec3(0.05, 0.11, 0.15);
  vec3 deep = mix(dayDeep, nightDeep, uNight);
  vec3 shallow = mix(dayShallow, nightShallow, uNight);

  // a steeper sight line sees more of the bed (classic shallow-water approximation)
  vec3 V = normalize(cameraPosition - vWorld);
  float down = clamp(V.y, 0.0, 1.0);
  vec3 bedTint = dayBed * (1.0 - uNight * 0.88);
  vec3 col = mix(shallow, deep, bed);
  col = mix(col, bedTint, (1.0 - bed) * (1.0 - bed) * down * 0.75);

  // subsurface glow where wavecrests catch light over shallow water
  float crest = smoothstep(0.45, 1.0, w1 * 0.5 + w2 * 0.5);
  col += shallow * crest * (1.0 - bed) * 0.35 * (1.0 - uNight);

  // fresnel reflection of the sky band (same mood the sky dome shows)
  float fres = pow(1.0 - max(dot(V, N), 0.0), 2.4);
  vec3 skyRef = mix(vec3(0.62, 0.74, 0.86), vec3(0.05, 0.07, 0.13), uNight);
  skyRef = mix(skyRef, vec3(0.95, 0.62, 0.38), uDusk * 0.55);
  col = mix(col, skyRef, fres * 0.65);

  // ── shore foam: thin band where depth ≈ 0, broken up by swell + noise ─────
  float shore = 1.0 - smoothstep(0.0, 0.9, depth);
  float foamNoise = fbm(vWorld.xz * 0.9 + vec2(uTime * 0.30, uTime * 0.22));
  float foamBand = smoothstep(0.55, 0.95, shore + w1 * 0.22 - 0.20);
  float foam = foamBand * smoothstep(0.35, 0.75, foamNoise) * (1.0 - uNight * 0.85);
  col = mix(col, vec3(0.94, 0.97, 0.96), foam * 0.85);

  // ── sun/moon glint ─────────────────────────────────────────────────────────
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float glint = pow(max(dot(N, H), 0.0), 240.0) * (1.0 - uNight * 0.7);
  col += vec3(1.0, 0.92, 0.75) * glint * 1.15;
  col += vec3(0.4, 0.5, 0.8) * pow(max(dot(N, H), 0.0), 60.0) * uNight * 0.14;

  // fade far water into the fog color so the plane boundary never reads
  float distF = smoothstep(240.0, 300.0, length(vWorld.xz));
  col = mix(col, uFogColor, distF);

  float alpha = mix(0.80, 0.97, bed) + fres * 0.10;
  alpha = max(alpha, foam);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.98));
}
`;
export function Water() {
    const mat = useRef(null);
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uNight: { value: 0 },
        uDusk: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uFogColor: { value: new THREE.Color('#b8c8d8') },
        uHeightMap: { value: heightTexture },
        uHMWorld: { value: new THREE.Vector2(HM_WORLD, HM_WORLD) },
    }), []);
    useFrame((state) => {
        if (!mat.current)
            return;
        mat.current.uniforms.uTime.value = state.clock.elapsedTime;
        mat.current.uniforms.uNight.value = skyState.nightFactor;
        mat.current.uniforms.uDusk.value = skyState.duskFactor;
        mat.current.uniforms.uSunDir.value.copy(skyState.sunDir);
        mat.current.uniforms.uFogColor.value.copy(skyState.fogColor);
    });
    return (_jsxs("mesh", { position: [0, SEA_LEVEL, 0], rotation: [-Math.PI / 2, 0, 0], children: [_jsx("planeGeometry", { args: [WORLD_SIZE * 2.4, WORLD_SIZE * 2.4, 1, 1] }), _jsx("shaderMaterial", { ref: mat, vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms, transparent: true, depthWrite: false })] }));
}
