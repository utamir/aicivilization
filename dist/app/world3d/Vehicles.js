import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// VEHICLES — cars moving along road curves and ships on sea lanes. As EV
// adoption grows in each civ, the fleet visibly shifts color. Ships carry
// running lights at night.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildRoadPaths } from './Roads.js';
import { heightAt } from './terrain.js';
import { cityById } from './layout.js';
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
const CARS_PER_ROAD = 14;
const ICE_COLORS = ['#8a8f96', '#6b7078', '#7a6f63', '#5d6470', '#8f8578'];
const EV_COLORS = ['#cfe6ef', '#a8d8e8', '#e8f4f8', '#9fd4c8'];
export function Vehicles({ visualRef }) {
    const paths = useMemo(() => buildRoadPaths(), []);
    const cars = useMemo(() => {
        const out = [];
        let s = 12345;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        paths.forEach((_, pi) => {
            for (let i = 0; i < CARS_PER_ROAD; i++) {
                out.push({ path: pi, t: rnd(), speed: 0.010 + rnd() * 0.009, dir: rnd() < 0.5 ? 1 : -1, ev: false });
            }
        });
        return out;
    }, [paths]);
    const bodyRef = useRef(null);
    const lightRef = useRef(null);
    const evQuant = useRef(-1);
    useFrame((_, dt) => {
        const body = bodyRef.current;
        const lights = lightRef.current;
        if (!body || !lights)
            return;
        const wv = visualRef.current;
        const avgEv = wv ? (wv.evShare.veloria + wv.evShare.ardan + wv.evShare.nemea) / 3 : 0;
        // repaint fleet when EV share moves (quantized)
        const q = Math.round(avgEv * 20);
        if (q !== evQuant.current) {
            evQuant.current = q;
            let s = 999;
            const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
            cars.forEach((car, i) => {
                car.ev = rnd() < avgEv;
                const palette = car.ev ? EV_COLORS : ICE_COLORS;
                tmpColor.set(palette[Math.floor(rnd() * palette.length)]);
                body.setColorAt(i, tmpColor);
            });
            if (body.instanceColor)
                body.instanceColor.needsUpdate = true;
        }
        const night = window.__nightFactor ?? 0;
        lights.material.emissiveIntensity = night * 2.4;
        const pt = new THREE.Vector3();
        const tan = new THREE.Vector3();
        cars.forEach((car, i) => {
            const path = paths[car.path];
            const ca = cityById(path.a), cb = cityById(path.b);
            const va = wv?.cities.find((c) => c.city.id === ca.id);
            const vb = wv?.cities.find((c) => c.city.id === cb.id);
            const activity = Math.min(1.25, ((va?.population ?? 0) / Math.max(0.001, ca.basePop) + (vb?.population ?? 0) / Math.max(0.001, cb.basePop)) / 2);
            // Deterministically thin traffic as the connected settlements empty.
            const visible = activity > 0 && ((i * 37) % 100) < Math.round(Math.min(1, Math.pow(activity, 0.62)) * 100);
            if (!visible) {
                tmpObj.position.set(0, -80, 0);
                tmpObj.scale.set(0.001, 0.001, 0.001);
                tmpObj.rotation.set(0, 0, 0);
                tmpObj.updateMatrix();
                body.setMatrixAt(i, tmpObj.matrix);
                lights.setMatrixAt(i, tmpObj.matrix);
                return;
            }
            car.t += (car.speed * dt * 60 * car.dir) / path.length;
            if (car.t > 1)
                car.t -= 1;
            if (car.t < 0)
                car.t += 1;
            path.curve.getPointAt(car.t, pt);
            path.curve.getTangentAt(car.t, tan);
            if (car.dir < 0)
                tan.negate();
            const side = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(0.3);
            pt.add(side);
            pt.y = heightAt(pt.x, pt.z) + 0.32;
            tmpObj.position.copy(pt);
            tmpObj.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
            tmpObj.scale.set(0.42, 0.26, 0.85);
            tmpObj.updateMatrix();
            body.setMatrixAt(i, tmpObj.matrix);
            tmpObj.position.add(tan.clone().multiplyScalar(0.5));
            tmpObj.position.y += 0.05;
            tmpObj.scale.set(0.16, 0.08, 0.1);
            tmpObj.updateMatrix();
            lights.setMatrixAt(i, tmpObj.matrix);
        });
        body.instanceMatrix.needsUpdate = true;
        lights.instanceMatrix.needsUpdate = true;
    });
    return (_jsxs("group", { children: [_jsxs("instancedMesh", { ref: bodyRef, args: [undefined, undefined, cars.length], frustumCulled: false, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { roughness: 0.4, metalness: 0.5 })] }), _jsxs("instancedMesh", { ref: lightRef, args: [undefined, undefined, cars.length], frustumCulled: false, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { color: "#fff7d6", emissive: "#ffedb0", emissiveIntensity: 0 })] })] }));
}
// ── Ships ────────────────────────────────────────────────────────────────────
const SHIP_LANES = [
    [[-74, -44], [-88, -10], [-84, 40], [-52, 78], [-4, 94]],
    [[-76, -40], [-96, 10], [-70, 70], [-2, 92]],
    [[30, 70], [44, 86], [8, 96], [-2, 92]],
];
export function Ships({ visualRef }) {
    const shipRefs = useRef([]);
    const curves = useMemo(() => SHIP_LANES.map((lane) => new THREE.CatmullRomCurve3(lane.map(([x, z]) => new THREE.Vector3(x, 0.35, z)))), []);
    const offsets = useMemo(() => curves.map((_, i) => i * 0.31), [curves]);
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        curves.forEach((curve, i) => {
            const g = shipRefs.current[i];
            if (!g)
                return;
            const v = visualRef.current;
            const embodied = v ? v.cities.reduce((a, c) => a + c.population, 0) : 0;
            const baseline = v ? v.cities.reduce((a, c) => a + c.city.basePop, 0) : 1;
            const activity = Math.min(1, embodied / Math.max(0.001, baseline));
            g.visible = activity > 0.01 && i < Math.max(1, Math.ceil(curves.length * Math.pow(activity, 0.55)));
            if (!g.visible)
                return;
            const tt = (t * 0.006 + offsets[i]) % 1;
            const pt = curve.getPointAt(tt);
            const tan = curve.getTangentAt(tt);
            g.position.set(pt.x, 0.42 + Math.sin(t * 1.1 + i) * 0.06, pt.z);
            g.rotation.y = Math.atan2(tan.x, tan.z);
            g.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.02;
        });
    });
    return (_jsx("group", { children: curves.map((_, i) => (_jsxs("group", { ref: (g) => { if (g)
                shipRefs.current[i] = g; }, children: [_jsxs("mesh", { castShadow: true, children: [_jsx("boxGeometry", { args: [1.1, 0.5, 3.4] }), _jsx("meshStandardMaterial", { color: i === 1 ? '#7a4a3a' : '#3f5a6e', roughness: 0.6 })] }), _jsxs("mesh", { position: [0, 0.45, -0.9], children: [_jsx("boxGeometry", { args: [0.7, 0.5, 0.8] }), _jsx("meshStandardMaterial", { color: "#d5d9de", roughness: 0.7 })] }), _jsxs("mesh", { position: [0, 0.42, 0.6], children: [_jsx("boxGeometry", { args: [0.85, 0.35, 1.4] }), _jsx("meshStandardMaterial", { color: i === 2 ? '#4a7a5c' : '#8a6a4a', roughness: 0.7 })] }), _jsxs("mesh", { position: [0, 0.85, -0.9], children: [_jsx("sphereGeometry", { args: [0.09, 6, 6] }), _jsx("meshStandardMaterial", { color: "#ffe9a8", emissive: "#ffd970", emissiveIntensity: 1.6 })] })] }, i))) }));
}
