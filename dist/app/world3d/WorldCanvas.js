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
import { skyState } from './skyState.js';
import { Water } from './Water.js';
import { SkyRig } from './Sky.js';
import { Buildings } from './Buildings.js';
import { Roads } from './Roads.js';
import { Forest } from './Forest.js';
import { Clouds } from './Clouds.js';
import { Infrastructure } from './Infrastructure.js';
import { FrontierLayer } from './Frontier.js';
import { Labels } from './Labels.js';
import { Vehicles, Ships } from './Vehicles.js';
import { Citizens } from './Citizens.js';
import { Overlays } from './Overlays.js';
import { CameraRig } from './CameraRig.js';
import { computeWorldVisual } from './cityVisuals.js';
import { ArcPreview } from './ArcPreview.js';
import { readArcPreview } from './arcPreviewFlag.js';
// fixed capture size for the controlled preview (keeps captures comparable)
const PREVIEW_W = 1600;
const PREVIEW_H = 1000;
function SimDriver({ worldRef, visualRef }) {
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
export function WorldCanvas({ worldRef, visualRef }) {
    const terrain = useMemo(() => buildTerrain(), []);
    const preview = useMemo(() => readArcPreview(), []);
    if (preview) {
        return (_jsx(Canvas, { shadows: true, dpr: 1, frameloop: "never", camera: { position: [9.5, 11.5, 13.5], fov: 38, near: 0.1, far: 400 }, gl: { antialias: true, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true }, onCreated: ({ gl, scene }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.05;
                gl.outputColorSpace = THREE.SRGBColorSpace;
                gl.shadowMap.type = THREE.PCFSoftShadowMap;
                scene.background = new THREE.Color('#c3d2dd');
                scene.fog = new THREE.Fog('#c3d2dd', 90, 220);
            }, style: { position: 'absolute', top: 0, left: 0, width: `${PREVIEW_W}px`, height: `${PREVIEW_H}px` }, children: _jsx(ArcPreview, { state: preview.state, view: preview.view }) }));
    }
    return (_jsxs(Canvas, { shadows: true, dpr: [1, 2], camera: { position: [60, 70, 120], fov: 42, near: 0.12, far: 1600 }, gl: { antialias: true, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: true }, onCreated: ({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.06;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }, style: { position: 'absolute', inset: 0 }, children: [_jsx(SimDriver, { worldRef: worldRef, visualRef: visualRef }), _jsx(SkyRig, {}), _jsx(Clouds, {}), _jsx("primitive", { object: terrain }), _jsx(Water, {}), _jsx(Roads, {}), _jsx(Forest, {}), _jsx(Buildings, { visualRef: visualRef }), _jsx(Infrastructure, { visualRef: visualRef }), _jsx(FrontierLayer, { visualRef: visualRef }), _jsx(Labels, { visualRef: visualRef }), _jsx(Vehicles, { visualRef: visualRef }), _jsx(Citizens, { visualRef: visualRef }), _jsx(Ships, { visualRef: visualRef }), _jsx(Overlays, { worldRef: worldRef }), _jsx(CameraRig, {}), _jsxs(EffectComposer, { multisampling: 0, children: [_jsx(Bloom, { intensity: 0.48, luminanceThreshold: 0.70, luminanceSmoothing: 0.24, mipmapBlur: true }), _jsx(Vignette, { eskil: false, offset: 0.30, darkness: 0.54 })] })] }));
}
