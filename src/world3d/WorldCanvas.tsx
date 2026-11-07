// ─────────────────────────────────────────────────────────────────────────────
// WORLD CANVAS — 3D composition root. Owns the live world refs, advances the
// simulation engine on the render loop, throttles UI refresh ticks, and
// composes terrain / water / sky / cities / infrastructure / vehicles /
// overlays / post-processing.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { engine } from '../state/engine';
import { useUI } from '../state/store';
import type { WorldState } from '../sim';
import { buildTerrain } from './terrain';
import { skyState } from './skyState';
import { Water } from './Water';
import { SkyRig } from './Sky';
import { Buildings } from './Buildings';
import { Roads } from './Roads';
import { Forest } from './Forest';
import { Clouds } from './Clouds';
import { Infrastructure } from './Infrastructure';
import { FrontierLayer } from './Frontier';
import { Labels } from './Labels';
import { Vehicles, Ships } from './Vehicles';
import { Citizens } from './Citizens';
import { Overlays } from './Overlays';
import { CameraRig } from './CameraRig';
import { computeWorldVisual, type WorldVisual } from './cityVisuals';
import { ArcPreview } from './ArcPreview';
import { readArcPreview } from './arcPreviewFlag';

export type WorldRef = React.MutableRefObject<WorldState>;
export type VisualRef = React.MutableRefObject<WorldVisual | null>;

// fixed capture size for the controlled preview (keeps captures comparable)
const PREVIEW_W = 1600;
const PREVIEW_H = 1000;

function SimDriver({ worldRef, visualRef }: { worldRef: WorldRef; visualRef: VisualRef }) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    engine.frame(Math.min(dt, 0.1));
    worldRef.current = engine.world;
    acc.current += dt;
    if (acc.current > 0.5) {
      acc.current = 0;
      visualRef.current = computeWorldVisual(engine.world, skyState.nightFactor);
      useUI.setState((s) => ({ vmTick: s.vmTick + 1 }));
    }
  });
  return null;
}

export function WorldCanvas({ worldRef, visualRef }: { worldRef: WorldRef; visualRef: VisualRef }) {
  const terrain = useMemo(() => buildTerrain(), []);
  const preview = useMemo(() => readArcPreview(), []);  if (preview) {
    return (
      <Canvas
        shadows
        dpr={1}
        frameloop="never"
        camera={{ position: [9.5, 11.5, 13.5], fov: 38, near: 0.1, far: 400 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          scene.background = new THREE.Color('#c3d2dd');
          scene.fog = new THREE.Fog('#c3d2dd', 90, 220);
        }}
        style={{ position: 'absolute', top: 0, left: 0, width: `${PREVIEW_W}px`, height: `${PREVIEW_H}px` }}
      >
        <ArcPreview state={preview.state} view={preview.view} />
      </Canvas>
    );
  }
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [60, 70, 120], fov: 42, near: 0.12, far: 1600 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <SimDriver worldRef={worldRef} visualRef={visualRef} />
      <SkyRig />
      <Clouds />
      <primitive object={terrain} />
      <Water />
      <Roads />
      <Forest />
      <Buildings visualRef={visualRef} />
      <Infrastructure visualRef={visualRef} />
      <FrontierLayer visualRef={visualRef} />
      <Labels visualRef={visualRef} />
      <Vehicles visualRef={visualRef} />
      <Citizens visualRef={visualRef} />
      <Ships visualRef={visualRef} />
      <Overlays worldRef={worldRef} />
      <CameraRig />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.48} luminanceThreshold={0.70} luminanceSmoothing={0.24} mipmapBlur />
        <Vignette eskil={false} offset={0.30} darkness={0.54} />
      </EffectComposer>
    </Canvas>
  );
}
