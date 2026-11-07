import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// ARC PREVIEW — controlled verification harness, not part of the game world.
// Mounted only when the URL carries ?arc=occupied|aged|ruined (plus optional
// &view=a|b). Renders ONE fixed arcology instance at a fixed position with a
// fixed camera, so the three lifecycle states can be compared frame-for-frame.
// Nothing here runs during normal play, and it never touches the simulation.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { generateArcology } from './arcology.js';
// fixed capture resolution shared with WorldCanvas
const PREVIEW_W = 1600;
const PREVIEW_H = 1000;
import { heightAt } from './terrain.js';
// One fixed site, fixed seed: identity is constant across all three states.
const SITE = { x: 0, z: 0, lotIndex: 4242, rot: 0.42, dist: 0, w: 2, d: 2 };
const SEED = 4242 * 977 + 13;
// CENTER-origin hex prism, matching the box parts' positioning convention.
function hexGeometry() {
    return new THREE.CylinderGeometry(1, 1, 1, 6, 1);
}
export function ArcPreview({ state, view }) {
    const HEX = useMemo(hexGeometry, []);
    const BOX = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
    const gl = useThree((s) => s.gl);
    const camera = useThree((s) => s.camera);
    const scene = useThree((s) => s.scene);
    const spec = useMemo(() => generateArcology({ ...SITE, x: SITE.x, z: SITE.z }, { seed: SEED, state }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]);
    const ground = heightAt(SITE.x, SITE.z);
    // Normalise so the tower's foot sits on y = 0 in the preview scene, and frame
    // the full structure.
    const parts = useMemo(() => spec.parts.map((p) => ({ ...p, y: p.y - ground })), [spec, ground]);
    const totalH = useMemo(() => Math.max(...spec.parts.map((p) => p.y - ground + p.sy * 0.5), 8), [spec, ground]);
    const byKind = useMemo(() => {
        const map = {};
        for (const p of parts)
            (map[p.kind] ||= []).push(p);
        return map;
    }, [parts]);
    useEffect(() => {
        // Pin the drawing buffer to a fixed capture size and render exactly one
        // frame synchronously. A static render keeps captures identical, does not
        // depend on frame pacing, and works even when the browser throttles rAF.
        const dom = gl.domElement;
        dom.style.width = `${PREVIEW_W}px`;
        dom.style.height = `${PREVIEW_H}px`;
        gl.setSize(PREVIEW_W, PREVIEW_H, true);
        const cam = camera;
        cam.aspect = PREVIEW_W / PREVIEW_H;
        const H = totalH + 2.2; // headroom for crown masts
        const look = new THREE.Vector3(0, H * 0.48, 0);
        if (view === 'a')
            cam.position.set(H * 1.25, H * 0.82, H * 1.62);
        else
            cam.position.set(-H * 1.5, H * 0.44, -H * 1.15);
        cam.lookAt(look);
        cam.updateProjectionMatrix();
        // Render a few times on a timer: the browser throttles rAF while the pane is
        // hidden, but timers still fire, so the capture buffer is guaranteed filled.
        let n = 0;
        const tick = window.setInterval(() => {
            gl.render(scene, cam);
            if (++n >= 3)
                window.clearInterval(tick);
        }, 120);
        gl.render(scene, cam);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const partMesh = (kind, geo, mat) => {
        const list = byKind[kind];
        if (!list || !list.length)
            return null;
        return (_jsx("group", { children: list.map((p, i) => (_jsx("mesh", { geometry: geo, material: mat, position: [p.x, p.y, p.z], rotation: p.rot ? [p.rot[0], p.rot[1], p.rot[2]] : [0, p.rotY, 0], scale: [p.sx, p.sy, p.sz], castShadow: true, receiveShadow: true }, i))) }));
    };
    // materials mirror the in-game family: warm ceramic core, light plates, dark
    // structural rings, glazing, stone planters, planted terraces, concrete debris.
    const mCore = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e3ddd3', roughness: 0.72, metalness: 0.04 }), []);
    const mSlab = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ded7c9', roughness: 0.78, metalness: 0.02 }), []);
    const mRing = useMemo(() => new THREE.MeshStandardMaterial({ color: '#40474f', roughness: 0.45, metalness: 0.45 }), []);
    const mGreen = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a7a3c', roughness: 0.95 }), []);
    const mDebris = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b6afa2', roughness: 0.92 }), []);
    const mGlass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f3f4a', roughness: 0.14, metalness: 0.55 }), []);
    const mPier = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9e3d7', roughness: 0.6 }), []);
    const mPlanter = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9b2a3', roughness: 0.88 }), []);
    return (_jsxs("group", { children: [_jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, 0.001, 0], receiveShadow: true, children: [_jsx("circleGeometry", { args: [26, 48] }), _jsx("meshStandardMaterial", { color: "#6d7d55", roughness: 1 })] }), _jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, 0.012, 0], receiveShadow: true, children: [_jsx("circleGeometry", { args: [7.5, 40] }), _jsx("meshStandardMaterial", { color: "#8a8578", roughness: 1 })] }), partMesh('core', HEX, mCore), partMesh('podium', HEX, mCore), partMesh('crown', HEX, mCore), partMesh('fin', BOX, mCore), partMesh('slab', HEX, mSlab), partMesh('fascia', HEX, mSlab), partMesh('bridge', BOX, mSlab), partMesh('ring', HEX, mRing), partMesh('glass', HEX, mGlass), partMesh('pier', BOX, mPier), partMesh('planter', HEX, mPlanter), partMesh('patch', BOX, mPlanter), partMesh('green', HEX, mGreen), partMesh('brace', BOX, mRing), partMesh('debris', BOX, mDebris), _jsx("ambientLight", { intensity: 0.55 }), _jsx("hemisphereLight", { args: ['#bcd3e8', '#6d7a56', 0.7] }), _jsx("directionalLight", { position: [14, 22, 10], intensity: 2.1, castShadow: true, "shadow-mapSize": [2048, 2048], "shadow-camera-left": -18, "shadow-camera-right": 18, "shadow-camera-top": 18, "shadow-camera-bottom": -18 })] }));
}
