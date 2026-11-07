import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// CLOUDS — a high, slowly drifting fbm cloud plane. Cosmetic (like the day
// cycle): cumulus cells with soft edges, tinted by the same fog color the
// water reflects, alpha-faded at the horizon so the plane never reads as a
// disc. Casts no shadow — a transparent plane would block light harshly.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WORLD_SIZE } from './layout.js';
import { skyState } from './skyState.js';
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
uniform vec3 uFogColor;
varying vec2 vUv;
varying vec3 vWorld;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.11 + vec2(17.3, 9.1); a *= 0.5; }
  return s;
}

void main() {
  vec2 drift = vec2(uTime * 0.006, uTime * 0.0025);
  float n = fbm(vUv * 7.0 + drift);
  n += 0.4 * fbm(vUv * 19.0 - drift * 2.2);
  n /= 1.4;
  // cumulus cells: sharp-ish lower cutoff, soft top
  float cover = smoothstep(0.52, 0.68, n);
  // sun-side shading inside the cloud (fake relief via a shifted sample)
  float n2 = fbm(vUv * 7.0 + drift + vec2(0.03, 0.05));
  float relief = clamp((n - n2) * 6.0 + 0.5, 0.0, 1.0);

  vec3 lit = mix(vec3(1.0, 0.99, 0.97), vec3(0.16, 0.20, 0.30), uNight);
  vec3 shade = mix(vec3(0.72, 0.75, 0.82), vec3(0.05, 0.07, 0.12), uNight);
  vec3 col = mix(shade, lit, relief);

  // melt into fog color at dusk/night so clouds never outshine the sky
  col = mix(col, uFogColor, uNight * 0.55);

  // horizon fade: nothing at the plane rim, and thinner toward grazing views
  float rim = smoothstep(0.5, 0.36, length(vUv - 0.5));
  vec3 V = normalize(cameraPosition - vWorld);
  float graze = clamp(V.y, 0.0, 1.0);
  float alpha = cover * rim * mix(0.10, 0.62, graze);
  gl_FragColor = vec4(col, alpha);
}
`;
export function Clouds() {
    const mat = useRef(null);
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uNight: { value: 0 },
        uFogColor: { value: new THREE.Color('#b8c8d8') },
    }), []);
    useFrame((state) => {
        if (!mat.current)
            return;
        mat.current.uniforms.uTime.value = state.clock.elapsedTime;
        mat.current.uniforms.uNight.value = skyState.nightFactor;
        mat.current.uniforms.uFogColor.value.copy(skyState.fogColor);
    });
    return (_jsxs("mesh", { position: [0, 96, 0], rotation: [-Math.PI / 2, 0, 0], renderOrder: 1, children: [_jsx("planeGeometry", { args: [WORLD_SIZE * 3.4, WORLD_SIZE * 3.4, 1, 1] }), _jsx("shaderMaterial", { ref: mat, vertexShader: VERT, fragmentShader: FRAG, uniforms: uniforms, transparent: true, depthWrite: false })] }));
}
