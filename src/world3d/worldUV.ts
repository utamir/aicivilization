// ─────────────────────────────────────────────────────────────────────────────
// WORLD UV — shader patch that maps texture density to real meters. Injected
// into MeshStandardMaterial via onBeforeCompile: facade and roof textures
// sample by world position derived from local position × instance transform
// (a 3 m panel is always 3 m), with the world-space normal choosing the
// dominant face. The material's `map` is sampled exclusively through this path.
// ─────────────────────────────────────────────────────────────────────────────
import type * as THREE from 'three';

export function patchWorldUV(mat: THREE.MeshStandardMaterial, texelScale: number) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNml;
        `)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp4 = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp4 = instanceMatrix * wp4;
          #endif
          wp4 = modelMatrix * wp4;
          vWPos = wp4.xyz;
          vec3 n3 = objectNormal;
          #ifdef USE_INSTANCING
            n3 = mat3(instanceMatrix) * n3;
          #endif
          vWNml = normalize(mat3(modelMatrix) * n3);
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNml;
        uniform float uTexelScale;
        `)
      .replace('#include <map_fragment>', `{
          // world-space UV by dominant normal axis — replaces the default map sample.
          // uTexelScale = meters per texture repeat.
          vec3 an = abs(vWNml);
          vec2 uv;
          if (an.y > an.x && an.y > an.z) uv = vWPos.xz;
          else if (an.x > an.z) uv = vWPos.zy;
          else uv = vWPos.xy;
          uv = uv / max(uTexelScale, 0.001);
          vec4 texel = texture2D(map, uv);
          diffuseColor *= texel;
        }`);
    shader.uniforms.uTexelScale = { value: texelScale };
  };
  mat.customProgramCacheKey = () => 'worlduv' + texelScale;
}
