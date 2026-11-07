import { jsx as _jsx } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// CAMERA RIG — five camera modes with smooth damped transitions.
// orbit: free user control. strategic: high overview. city: low over the
// selected civ's capital. follow: drifts between cities. cinematic: slow
// sweeping arc around the whole region.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useUI } from '../state/store.js';
import { CITIES, civMainCity } from './layout.js';
import { heightAt } from './terrain.js';
const damp = THREE.MathUtils.damp;
export function CameraRig() {
    const controlsRef = useRef(null);
    const camera = useThree((s) => s.camera);
    const followIdx = useRef(0);
    const followTimer = useRef(0);
    const cineAngle = useRef(0.6);
    useFrame((state, dt) => {
        const mode = useUI.getState().cameraMode;
        const controls = controlsRef.current;
        if (!controls)
            return;
        const civ = useUI.getState().selectedCiv;
        const cam = camera;
        let targetPos = null;
        let targetLook = null;
        if (mode === 'strategic') {
            targetPos = new THREE.Vector3(0, 165, 128);
            targetLook = new THREE.Vector3(0, 0, 10);
        }
        else if (mode === 'city') {
            const c = civMainCity(civ);
            targetPos = new THREE.Vector3(c.x + 30, 19, c.z + 30);
            targetLook = new THREE.Vector3(c.x, 3, c.z);
        }
        else if (mode === 'subsurface') {
            const c = civMainCity(civ);
            const ground = heightAt(c.x, c.z);
            // Deliberate below-ground inspection view. Terrain is front-sided, so from
            // underneath the surface becomes a natural cutaway instead of an x-ray HUD.
            targetPos = new THREE.Vector3(c.x + 24, ground - 18, c.z + 24);
            targetLook = new THREE.Vector3(c.x, ground - 10, c.z);
        }
        else if (mode === 'follow') {
            followTimer.current -= dt;
            if (followTimer.current <= 0) {
                followIdx.current = (followIdx.current + 1) % CITIES.length;
                followTimer.current = 22;
            }
            const c = CITIES[followIdx.current];
            const a = state.clock.elapsedTime * 0.08;
            targetPos = new THREE.Vector3(c.x + Math.cos(a) * 24, 11, c.z + Math.sin(a) * 24);
            targetLook = new THREE.Vector3(c.x, 2.5, c.z);
        }
        else if (mode === 'space') {
            // Schematic frontier view. Off-world geometry is deliberately not to scale;
            // this camera makes continuity beyond Earth legible without pretending the
            // island and Mars share a physical scene scale.
            targetPos = new THREE.Vector3(85, 155, 310);
            targetLook = new THREE.Vector3(-35, 145, -170);
        }
        else if (mode === 'cinematic') {
            cineAngle.current += dt * 0.045;
            const a = cineAngle.current;
            const r = 120 + Math.sin(a * 0.7) * 30;
            targetPos = new THREE.Vector3(Math.cos(a) * r, 46 + Math.sin(a * 0.5) * 22, Math.sin(a) * r);
            const ci = CITIES[Math.floor(a / 1.4) % CITIES.length];
            targetLook = new THREE.Vector3(ci.x * 0.6, 2, ci.z * 0.6);
        }
        if (targetPos && targetLook) {
            const k = 2.2; // damping speed
            cam.position.x = damp(cam.position.x, targetPos.x, k, dt);
            cam.position.y = damp(cam.position.y, targetPos.y, k, dt);
            cam.position.z = damp(cam.position.z, targetPos.z, k, dt);
            controls.target.x = damp(controls.target.x, targetLook.x, k, dt);
            controls.target.y = damp(controls.target.y, targetLook.y, k, dt);
            controls.target.z = damp(controls.target.z, targetLook.z, k, dt);
            controls.update();
        }
    });
    return (_jsx(OrbitControls, { ref: controlsRef, makeDefault: true, enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI * 0.98, minPolarAngle: 0.02, minDistance: 4, maxDistance: 340, target: [0, 0, 10] }));
}
