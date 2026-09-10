import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { engine } from '../state/engine.js';
import { useUI } from '../state/store.js';
import { buildTerrain } from './terrain.js';
import { Water } from './Water.js';
import { SkyRig } from './Sky.js';
import { Buildings } from './Buildings.js';
import { Roads } from './Roads.js';
import { Infrastructure } from './Infrastructure.js';
import { FrontierLayer } from './Frontier.js';
import { Labels } from './Labels.js';
import { Vehicles, Ships } from './Vehicles.js';
import { Citizens } from './Citizens.js';
import { Overlays } from './Overlays.js';
import { CameraRig } from './CameraRig.js';
import { computeWorldVisual } from './cityVisuals.js';
function SimDriver({ worldRef, visualRef }) {
    const acc = useRef(0);
    useFrame((_, dt) => {
        engine.frame(Math.min(dt, 0.1));
        worldRef.current = engine.world;
        acc.current += dt;
        if (acc.current > 0.5) {
            acc.current = 0;
            visualRef.current = computeWorldVisual(engine.world, window.__nightFactor ?? 0);
            useUI.setState((s) => ({ vmTick: s.vmTick + 1 }));
        }
    });
    return null;
}
export function WorldCanvas({ worldRef, visualRef }) {
    const terrain = useMemo(() => buildTerrain(), []);
    return (_jsxs(Canvas, { shadows: true, dpr: [1, 2], camera: { position: [60, 70, 120], fov: 42, near: 0.12, far: 1600 }, gl: { antialias: true, powerPreference: 'high-performance', alpha: false }, onCreated: ({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.06;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }, style: { position: 'absolute', inset: 0 }, children: [_jsx(SimDriver, { worldRef: worldRef, visualRef: visualRef }), _jsx(SkyRig, {}), _jsx("primitive", { object: terrain }), _jsx(Water, {}), _jsx(Roads, {}), _jsx(Buildings, { visualRef: visualRef }), _jsx(Infrastructure, { visualRef: visualRef }), _jsx(FrontierLayer, { visualRef: visualRef }), _jsx(Labels, { visualRef: visualRef }), _jsx(Vehicles, { visualRef: visualRef }), _jsx(Citizens, { visualRef: visualRef }), _jsx(Ships, { visualRef: visualRef }), _jsx(Overlays, { worldRef: worldRef }), _jsx(CameraRig, {}), _jsxs(EffectComposer, { multisampling: 0, children: [_jsx(Bloom, { intensity: 0.48, luminanceThreshold: 0.70, luminanceSmoothing: 0.24, mipmapBlur: true }), _jsx(Vignette, { eskil: false, offset: 0.30, darkness: 0.54 })] })] }));
}
