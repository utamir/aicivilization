// ─────────────────────────────────────────────────────────────────────────────
// WATER — animated shader plane: layered normals, fresnel, sun glint.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WORLD_SIZE } from './layout';
import { SEA_LEVEL } from './terrain';

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
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorld;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}

void main() {
  vec2 p = vWorld.xz * 0.12;
  float n1 = noise(p * 1.0 + vec2(uTime*0.05, uTime*0.03));
  float n2 = noise(p * 2.3 - vec2(uTime*0.04, uTime*0.06));
  vec3 N = normalize(vec3((n1-0.5)*0.35 + (n2-0.5)*0.2, 1.0, (n2-0.5)*0.35 - (n1-0.5)*0.2));

  vec3 dayDeep = vec3(0.06, 0.23, 0.34);
  vec3 dayShallow = vec3(0.15, 0.45, 0.52);
  vec3 nightDeep = vec3(0.012, 0.03, 0.06);
  vec3 nightShallow = vec3(0.03, 0.07, 0.12);
  vec3 deep = mix(dayDeep, nightDeep, uNight);
  vec3 shallow = mix(dayShallow, nightShallow, uNight);

  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(V, N), 0.0), 2.4);
  vec3 col = mix(deep, shallow, fres * 0.85 + (n2 - 0.5) * 0.12);

  // sun/moon glint
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 220.0) * (1.0 - uNight * 0.7);
  col += vec3(1.0, 0.9, 0.7) * spec * 0.9;

  // subtle sparkle at night (city light shimmer)
  col += vec3(0.4, 0.5, 0.8) * pow(max(dot(N, H), 0.0), 60.0) * uNight * 0.12;

  gl_FragColor = vec4(col, 0.93);
}
`;

export function Water() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
    }),
    [],
  );
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    const night = (window as any).__nightFactor ?? 0;
    const sun = (window as any).__sunDir as THREE.Vector3 | undefined;
    mat.current.uniforms.uNight.value = night;
    if (sun) mat.current.uniforms.uSunDir.value.copy(sun);
  });
  return (
    <mesh position={[0, SEA_LEVEL, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[WORLD_SIZE * 2.4, WORLD_SIZE * 2.4, 1, 1]} />
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
