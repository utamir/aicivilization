import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// CITIZENS — the population made visible. Walkers stroll each city's streets;
// their numbers track simulated population and growth. Streets empty at night,
// and empty out when unrest or crisis takes hold.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITIES } from './layout.js';
import { heightAt } from './terrain.js';
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
const WALKERS_PER_CITY = 30;
const CLOTHING = ['#7a8291', '#5d6a7a', '#8a7f6d', '#6d7a68', '#7d6d7a', '#9aa3ad', '#5b6470'];
export function Citizens({ visualRef }) {
    const walkers = useMemo(() => {
        let s = 4242;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        const out = [];
        CITIES.forEach((_, ci) => {
            for (let i = 0; i < WALKERS_PER_CITY; i++) {
                out.push({
                    city: ci,
                    angle: rnd() * Math.PI * 2,
                    radius: 1.5 + rnd() * CITIES[ci].districtRadius * 0.75,
                    speed: (0.25 + rnd() * 0.4) * (rnd() < 0.5 ? 1 : -1),
                    wobble: rnd() * Math.PI * 2,
                });
            }
        });
        return out;
    }, []);
    const bodyRef = useRef(null);
    useFrame((state, dt) => {
        const mesh = bodyRef.current;
        if (!mesh)
            return;
        const wv = visualRef.current;
        const t = state.clock.elapsedTime;
        const night = wv?.night ?? 0;
        // per-city visible walker counts
        CITIES.forEach((city, ci) => {
            const cv = wv?.cities.find((c) => c.city.id === city.id);
            const popRatio = cv ? cv.population / Math.max(0.001, city.basePop) : 0;
            const popFactor = popRatio <= 0 ? 0 : Math.min(1.6, Math.pow(popRatio, 0.58));
            const calm = 1 - (cv?.unrest ?? 0) * 0.85; // unrest empties streets
            const dayFactor = 1 - night * 0.75; // few people out at night
            const count = Math.round(WALKERS_PER_CITY * 0.55 * popFactor * calm * dayFactor);
            for (let i = 0; i < WALKERS_PER_CITY; i++) {
                const wIdx = ci * WALKERS_PER_CITY + i;
                const wk = walkers[wIdx];
                if (i < count) {
                    wk.angle += (wk.speed * dt * 60 * 0.4) / Math.max(2, wk.radius);
                    const r = wk.radius + Math.sin(t * 0.5 + wk.wobble) * 0.4;
                    const x = city.x + Math.cos(wk.angle) * r;
                    const z = city.z + Math.sin(wk.angle) * r * 0.8;
                    tmpObj.position.set(x, heightAt(x, z) + 0.18, z);
                    tmpObj.rotation.set(0, -wk.angle + (wk.speed > 0 ? Math.PI / 2 : -Math.PI / 2), 0);
                    tmpObj.scale.set(0.1, 0.26, 0.1);
                }
                else {
                    tmpObj.position.set(0, -80, 0);
                    tmpObj.scale.set(0.001, 0.001, 0.001);
                }
                tmpObj.updateMatrix();
                mesh.setMatrixAt(wIdx, tmpObj.matrix);
            }
        });
        mesh.instanceMatrix.needsUpdate = true;
    });
    // paint clothing once
    const painted = useRef(false);
    useFrame(() => {
        const mesh = bodyRef.current;
        if (!mesh || painted.current)
            return;
        painted.current = true;
        walkers.forEach((_, i) => {
            tmpColor.set(CLOTHING[i % CLOTHING.length]);
            mesh.setColorAt(i, tmpColor);
        });
        if (mesh.instanceColor)
            mesh.instanceColor.needsUpdate = true;
    });
    return (_jsxs("instancedMesh", { ref: bodyRef, args: [undefined, undefined, walkers.length], frustumCulled: false, children: [_jsx("capsuleGeometry", { args: [0.5, 1.4, 3, 6] }), _jsx("meshStandardMaterial", { roughness: 0.9 })] }));
}
