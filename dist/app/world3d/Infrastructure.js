import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE — generation & compute build-out made visible. Unit counts
// track simulated capacity (infra level relative to 2026 baseline). Wind
// turbines rotate, nuclear cooling towers vent steam, data centers glow.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { INFRA_ZONES, CITIES, civMainCity } from './layout.js';
import { heightAt } from './terrain.js';
import { skyState } from './skyState.js';
import { CIV_IDS } from '../sim/index.js';
import { makeRng, nextFloat } from '../sim/rng.js';
function zoneRng(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return makeRng(h >>> 0, 3);
}
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
// ── Wind turbines ────────────────────────────────────────────────────────────
const MAX_TURBINES = 16;
function WindFarm({ zone, visualRef }) {
    const bladesRef = useRef([]);
    const groupRef = useRef(null);
    const spots = useMemo(() => {
        const rng = zoneRng(zone.id);
        const out = [];
        const cols = 4;
        for (let i = 0; i < MAX_TURBINES; i++) {
            const gx = (i % cols) / cols - 0.375;
            const gz = Math.floor(i / cols) / Math.ceil(MAX_TURBINES / cols) - 0.4;
            out.push([zone.x + gx * zone.size + (nextFloat(rng) - 0.5) * 2, zone.z + gz * zone.size + (nextFloat(rng) - 0.5) * 2]);
        }
        return out;
    }, [zone]);
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        for (const b of bladesRef.current)
            if (b)
                b.rotation.z = t * 2.2;
        const level = visualRef.current?.infra.get(zone.id) ?? 0;
        const n = Math.min(MAX_TURBINES, Math.round(3 + level * 4));
        const g = groupRef.current;
        if (g)
            g.children.forEach((child, i) => { child.visible = i < n; });
    });
    return (_jsx("group", { ref: groupRef, children: spots.map(([x, z], i) => {
            const y = heightAt(x, z);
            return (_jsxs("group", { position: [x, y, z], children: [_jsxs("mesh", { position: [0, 0.06, 0], receiveShadow: true, children: [_jsx("cylinderGeometry", { args: [0.55, 0.65, 0.12, 10] }), _jsx("meshStandardMaterial", { color: "#b0aaa0", roughness: 0.95 })] }), _jsxs("mesh", { position: [0, 4, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.14, 0.3, 8, 8] }), _jsx("meshStandardMaterial", { color: "#e4e8ec", roughness: 0.4, metalness: 0.1 })] }), _jsxs("group", { position: [0, 8, 0], children: [_jsxs("mesh", { castShadow: true, children: [_jsx("boxGeometry", { args: [0.5, 0.42, 1.1] }), _jsx("meshStandardMaterial", { color: "#dde2e6", roughness: 0.45, metalness: 0.2 })] }), _jsxs("group", { ref: (g) => { if (g)
                                    bladesRef.current[i] = g; }, position: [0, 0, 0.62], children: [[0, 1, 2].map((k) => (_jsxs("mesh", { rotation: [0, 0, (k * Math.PI * 2) / 3], position: [0, 0, 0], children: [_jsx("boxGeometry", { args: [0.16, 3.2, 0.05] }), _jsx("meshStandardMaterial", { color: "#eef1f3", roughness: 0.35 })] }, k))), _jsxs("mesh", { children: [_jsx("sphereGeometry", { args: [0.2, 8, 8] }), _jsx("meshStandardMaterial", { color: "#d8dde2" })] })] })] })] }, i));
        }) }));
}
// ── Solar fields ─────────────────────────────────────────────────────────────
const MAX_SOLAR_ROWS = 48;
function SolarField({ zone, visualRef }) {
    const meshRef = useRef(null);
    const applied = useRef(-1);
    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh)
            return;
        const level = visualRef.current?.infra.get(zone.id) ?? 0;
        const rows = Math.min(MAX_SOLAR_ROWS, Math.round(8 + level * 12));
        if (rows === applied.current)
            return;
        applied.current = rows;
        const cols = 8;
        for (let i = 0; i < MAX_SOLAR_ROWS; i++) {
            if (i < rows) {
                const gx = (i % cols) / cols - 0.44;
                const gz = Math.floor(i / cols) / Math.ceil(MAX_SOLAR_ROWS / cols) - 0.45;
                const x = zone.x + gx * zone.size;
                const z = zone.z + gz * zone.size;
                tmpObj.position.set(x, heightAt(x, z) + 0.28, z);
                tmpObj.rotation.set(-0.42, 0.12, 0);
                tmpObj.scale.set(1.7, 0.08, 1.1);
            }
            else {
                tmpObj.position.set(0, -60, 0);
                tmpObj.scale.set(0.001, 0.001, 0.001);
            }
            tmpObj.updateMatrix();
            mesh.setMatrixAt(i, tmpObj.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });
    return (_jsxs("instancedMesh", { ref: meshRef, args: [undefined, undefined, MAX_SOLAR_ROWS], castShadow: true, frustumCulled: false, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { color: "#1d2f52", roughness: 0.25, metalness: 0.65 })] }));
}
// support posts under each solar row
const MAX_SOLAR_POSTS = 96;
function SolarPosts({ zone, visualRef }) {
    const meshRef = useRef(null);
    const applied = useRef(-1);
    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh)
            return;
        const level = visualRef.current?.infra.get(zone.id) ?? 0;
        const rows = Math.min(MAX_SOLAR_ROWS, Math.round(8 + level * 12));
        if (rows === applied.current)
            return;
        applied.current = rows;
        const cols = 8;
        let i = 0;
        for (let r = 0; r < rows; r++) {
            const gx = (r % cols) / cols - 0.44;
            const gz = Math.floor(r / cols) / Math.ceil(MAX_SOLAR_ROWS / cols) - 0.45;
            const x = zone.x + gx * zone.size;
            const z = zone.z + gz * zone.size;
            const y = heightAt(x, z);
            for (const off of [-0.7, 0.7]) {
                if (i >= MAX_SOLAR_POSTS)
                    break;
                tmpObj.position.set(x + off * 0.0 + off, y + 0.14, z);
                tmpObj.rotation.set(0, 0, 0);
                tmpObj.scale.set(0.06, 0.28, 0.06);
                tmpObj.updateMatrix();
                mesh.setMatrixAt(i++, tmpObj.matrix);
            }
        }
        for (let k = i; k < MAX_SOLAR_POSTS; k++) {
            tmpObj.position.set(0, -60, 0);
            tmpObj.scale.setScalar(0.001);
            tmpObj.updateMatrix();
            mesh.setMatrixAt(k, tmpObj.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });
    return (_jsxs("instancedMesh", { ref: meshRef, args: [undefined, undefined, MAX_SOLAR_POSTS], frustumCulled: false, children: [_jsx("cylinderGeometry", { args: [1, 1, 1, 6] }), _jsx("meshStandardMaterial", { color: "#5a616b", roughness: 0.7, metalness: 0.4 })] }));
}
// ── Nuclear plants ───────────────────────────────────────────────────────────
function SteamPuff({ x, y, z, phase }) {
    const ref = useRef(null);
    useFrame((state) => {
        const t = (state.clock.elapsedTime * 0.24 + phase) % 1;
        const m = ref.current;
        if (!m)
            return;
        m.position.set(x, y + t * 3.2, z);
        const s = 0.5 + t * 1.3;
        m.scale.set(s, s, s);
        m.material.opacity = 0.34 * (1 - t);
    });
    return (_jsxs("mesh", { ref: ref, children: [_jsx("sphereGeometry", { args: [0.55, 8, 8] }), _jsx("meshStandardMaterial", { color: "#e8ecef", transparent: true, opacity: 0.3, depthWrite: false })] }));
}
function NuclearPlant({ zone, visualRef }) {
    const groupRef = useRef(null);
    const units = useMemo(() => {
        const y = heightAt(zone.x, zone.z);
        return [
            { x: zone.x - 1.6, z: zone.z, y },
            { x: zone.x + 1.8, z: zone.z + 1.2, y: heightAt(zone.x + 1.8, zone.z + 1.2) },
            { x: zone.x + 0.4, z: zone.z - 2.2, y: heightAt(zone.x + 0.4, zone.z - 2.2) },
        ];
    }, [zone]);
    useFrame(() => {
        const level = visualRef.current?.infra.get(zone.id) ?? 0;
        const n = Math.min(3, Math.max(level > 0.05 ? 1 : 0, Math.round(level)));
        groupRef.current?.children.forEach((c, i) => { c.visible = i < n; });
    });
    return (_jsx("group", { ref: groupRef, children: units.map((u, i) => (_jsxs("group", { position: [u.x, u.y, u.z], children: [_jsxs("mesh", { position: [0, 0.9, 0], castShadow: true, children: [_jsx("sphereGeometry", { args: [0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2] }), _jsx("meshStandardMaterial", { color: "#dfe3e7", roughness: 0.6 })] }), _jsxs("mesh", { position: [0, 0.45, 0], children: [_jsx("cylinderGeometry", { args: [0.95, 0.95, 0.9, 16] }), _jsx("meshStandardMaterial", { color: "#cfd4d9", roughness: 0.7 })] }), _jsxs("mesh", { position: [1.9, 2.0, 0.6], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.72, 1.05, 4.0, 14, 1, true] }), _jsx("meshStandardMaterial", { color: "#d5d9de", roughness: 0.75, side: THREE.DoubleSide })] }), _jsx(SteamPuff, { x: 1.9, y: 4.1, z: 0.6, phase: i * 0.33 }), _jsxs("mesh", { position: [-1.5, 0.5, 1.6], castShadow: true, children: [_jsx("boxGeometry", { args: [2.2, 1.0, 1.5] }), _jsx("meshStandardMaterial", { color: "#b9bfc6", roughness: 0.8 })] }), _jsxs("mesh", { position: [-1.5, 1.02, 1.6], children: [_jsx("boxGeometry", { args: [2.24, 0.08, 0.5] }), _jsx("meshStandardMaterial", { color: "#39424c", emissive: "#8fb4d8", emissiveIntensity: 0.25 })] }), [0, 1, 2].map((k) => (_jsxs("group", { position: [-2.2 + k * 0.9, 0, -1.6], children: [_jsxs("mesh", { position: [0, 0.16, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.5, 0.32, 0.5] }), _jsx("meshStandardMaterial", { color: "#8a8478", roughness: 0.9 })] }), _jsxs("mesh", { position: [0, 0.4, 0], children: [_jsx("cylinderGeometry", { args: [0.08, 0.08, 0.2, 6] }), _jsx("meshStandardMaterial", { color: "#6e7278", roughness: 0.5, metalness: 0.5 })] })] }, k))), _jsxs("mesh", { position: [-1.3, 0.95, -1.6], children: [_jsx("boxGeometry", { args: [2.4, 0.06, 0.08] }), _jsx("meshStandardMaterial", { color: "#5a616b", roughness: 0.6, metalness: 0.5 })] }), _jsxs("mesh", { position: [0, 0.02, 3.4], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [6.5, 2.2] }), _jsx("meshStandardMaterial", { color: "#6e6a62", roughness: 1 })] })] }, i))) }));
}
// ── Data centers ─────────────────────────────────────────────────────────────
const MAX_HALLS = 10;
function DataCenter({ zone, visualRef }) {
    const meshRef = useRef(null);
    const glowRef = useRef(null);
    const applied = useRef(-1);
    useFrame(() => {
        const mesh = meshRef.current;
        const glow = glowRef.current;
        if (!mesh || !glow)
            return;
        const level = visualRef.current?.infra.get(zone.id) ?? 0;
        const halls = Math.min(MAX_HALLS, Math.floor(level * 2.4));
        if (halls === applied.current) { /* still update glow pulse */ }
        const night = skyState.nightFactor;
        glow.material.emissiveIntensity = 0.25 + night * 1.6;
        if (halls === applied.current)
            return;
        applied.current = halls;
        const cols = 5;
        for (let i = 0; i < MAX_HALLS; i++) {
            const visible = i < halls;
            const gx = (i % cols) / cols - 0.4;
            const gz = Math.floor(i / cols) / 2 - 0.25;
            const x = zone.x + gx * zone.size;
            const z = zone.z + gz * zone.size;
            tmpObj.position.set(x, heightAt(x, z) + 0.55, z);
            tmpObj.rotation.set(0, 0, 0);
            tmpObj.scale.set(visible ? 1.9 : 0.001, visible ? 1.1 : 0.001, visible ? 1.3 : 0.001);
            tmpObj.updateMatrix();
            mesh.setMatrixAt(i, tmpObj.matrix);
            // thin cyan roof strip
            tmpObj.position.y += 0.58;
            tmpObj.scale.set(visible ? 1.94 : 0.001, 0.06, visible ? 0.18 : 0.001);
            tmpObj.updateMatrix();
            glow.setMatrixAt(i, tmpObj.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        glow.instanceMatrix.needsUpdate = true;
    });
    return (_jsxs("group", { children: [_jsxs("mesh", { position: [zone.x, heightAt(zone.x, zone.z) + 0.02, zone.z], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [zone.size * 1.15, zone.size * 0.72] }), _jsx("meshStandardMaterial", { color: "#77746c", roughness: 1 })] }), _jsxs("instancedMesh", { ref: meshRef, args: [undefined, undefined, MAX_HALLS], castShadow: true, frustumCulled: false, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { color: "#3a4149", roughness: 0.7, metalness: 0.3 })] }), _jsxs("instancedMesh", { ref: glowRef, args: [undefined, undefined, MAX_HALLS], frustumCulled: false, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { color: "#22d3ee", emissive: "#22d3ee", emissiveIntensity: 0.4 })] }), [0, 1].map((k) => {
                const x = zone.x - zone.size * 0.36 + k * 1.6;
                const z = zone.z + zone.size * 0.3;
                return (_jsxs("group", { position: [x, heightAt(x, z), z], children: [_jsxs("mesh", { position: [0, 0.22, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.7, 0.44, 0.6] }), _jsx("meshStandardMaterial", { color: "#6e7278", roughness: 0.6, metalness: 0.4 })] }), _jsxs("mesh", { position: [0, 0.5, 0], children: [_jsx("cylinderGeometry", { args: [0.07, 0.07, 0.2, 6] }), _jsx("meshStandardMaterial", { color: "#5a616b", metalness: 0.6, roughness: 0.4 })] })] }, k));
            }), (() => {
                const x = zone.x, z = zone.z - zone.size * 0.38;
                const y = heightAt(x, z);
                return (_jsxs("group", { position: [x, y, z], children: [_jsxs("mesh", { position: [0, 0.3, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [1.3, 0.6, 0.4] }), _jsx("meshStandardMaterial", { color: "#8a9096", roughness: 0.6 })] }), _jsxs("mesh", { position: [0, 0.62, 0], children: [_jsx("boxGeometry", { args: [1.34, 0.06, 0.44] }), _jsx("meshStandardMaterial", { color: "#28323c", roughness: 0.4 })] })] }));
            })()] }));
}
// ── Ports ────────────────────────────────────────────────────────────────────
function Port({ zone }) {
    const containers = useMemo(() => {
        const rng = zoneRng(zone.id + '-c');
        return Array.from({ length: 26 }, () => ({
            x: zone.x + (nextFloat(rng) - 0.5) * zone.size * 0.8,
            z: zone.z + (nextFloat(rng) - 0.5) * zone.size * 0.5,
            rot: nextFloat(rng) < 0.5 ? 0 : Math.PI / 2,
            color: tmpColor.setHSL(nextFloat(rng), 0.45, 0.42).getHex(),
        }));
    }, [zone]);
    return (_jsxs("group", { children: [_jsxs("mesh", { position: [zone.x, heightAt(zone.x, zone.z) + 0.15, zone.z], children: [_jsx("boxGeometry", { args: [zone.size * 0.9, 0.3, zone.size * 0.55] }), _jsx("meshStandardMaterial", { color: "#4a4f55", roughness: 0.9 })] }), [-2.4, 0, 2.4].map((dx, i) => {
                const x = zone.x + dx;
                const z = zone.z - zone.size * 0.22;
                const y = heightAt(x, z);
                return (_jsxs("group", { position: [x, y + 0.3, z], children: [_jsxs("mesh", { position: [0, 1.5, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.35, 3, 0.35] }), _jsx("meshStandardMaterial", { color: "#c94f38", roughness: 0.6 })] }), _jsxs("mesh", { position: [0, 2.9, 0.9], castShadow: true, children: [_jsx("boxGeometry", { args: [0.22, 0.22, 2.6] }), _jsx("meshStandardMaterial", { color: "#c94f38", roughness: 0.6 })] })] }, i));
            }), containers.map((c, i) => (_jsxs("mesh", { position: [c.x, heightAt(c.x, c.z) + 0.55, c.z], rotation: [0, c.rot, 0], children: [_jsx("boxGeometry", { args: [1.1, 0.5, 0.5] }), _jsx("meshStandardMaterial", { color: c.color, roughness: 0.8 })] }, i)))] }));
}
// ── Farms & vertical farms ───────────────────────────────────────────────────
// Cultivated patches track simulated land use × yield; they brown out under
// climate stress and food shortage. As artificial food scales, fields are
// rewilded and glowing grow-towers rise at the city edge.
const MAX_PATCHES = 14;
const MAX_VF_TOWERS = 8;
const MAX_ROVERS = 17;
function Farm({ zone, visualRef }) {
    const groupRef = useRef(null);
    const towerRef = useRef(null);
    const roverRef = useRef(null);
    const lightRef = useRef(null);
    const patches = useMemo(() => {
        const rng = zoneRng(zone.id + '-f');
        return Array.from({ length: MAX_PATCHES }, (_, i) => {
            const gx = (i % 4) / 4 - 0.375;
            const gz = Math.floor(i / 4) / 4 - 0.35;
            return {
                x: zone.x + gx * zone.size,
                z: zone.z + gz * zone.size,
                w: zone.size * (0.16 + nextFloat(rng) * 0.06),
                hue: 0.2 + nextFloat(rng) * 0.08, // muted healthy green
                light: 0.3 + nextFloat(rng) * 0.12,
                rot: (nextFloat(rng) - 0.5) * 0.3,
            };
        });
    }, [zone]);
    const city = useMemo(() => civMainCity(zone.civId), [zone.civId]);
    const towerSpots = useMemo(() => {
        const rng = zoneRng(zone.id + '-vf');
        // grow-tower cluster between city and farmland
        const dx = zone.x - city.x, dz = zone.z - city.z;
        const len = Math.max(1, Math.hypot(dx, dz));
        return Array.from({ length: MAX_VF_TOWERS }, (_, i) => {
            const t = 0.28 + (i % 4) * 0.06;
            const side = (i < 4 ? 1 : -1) * (1.5 + nextFloat(rng) * 1.5);
            return {
                x: city.x + (dx / len) * len * t - (dz / len) * side,
                z: city.z + (dz / len) * len * t + (dx / len) * side,
                h: 2.6 + nextFloat(rng) * 2.4,
            };
        });
    }, [zone, city]);
    useFrame(() => {
        const fv = visualRef.current?.food[zone.civId];
        const g = groupRef.current;
        if (g) {
            const stress = fv?.stress ?? 0;
            const landUse = fv?.landUse ?? 1;
            const yld = fv?.yieldIndex ?? 1;
            const n = Math.min(MAX_PATCHES, Math.round((3 + landUse * 8) * Math.min(1.25, 0.5 + yld * 0.45)));
            g.children.forEach((child, i) => {
                child.visible = i < n;
                if (!child.visible)
                    return;
                const m = child.material;
                const p = patches[i];
                // healthy green → drought/shortage brown (muted: real fields are dusty)
                m.color.setHSL(p.hue * (1 - stress) + 0.07 * stress, 0.28 - stress * 0.1, 0.3 * (1 - stress * 0.4) + p.light * 0.18);
            });
        }
        const tg = towerRef.current;
        if (tg) {
            const art = fv?.artificial ?? 0;
            const n = Math.min(MAX_VF_TOWERS, Math.floor(art * 10));
            tg.children.forEach((child, i) => { child.visible = i < n; });
        }
        // ── robot countryside: autonomous rovers working the field rows ─────────
        // The countryside runs on machines when automation is high — the visible
        // face of the segregation between robot-tended land and human settlement.
        const rovers = roverRef.current, rlights = lightRef.current;
        if (rovers && rlights) {
            const agri = visualRef.current?.agriAutomation[zone.civId] ?? 0;
            const n = Math.floor(agri * MAX_PATCHES * 1.2);
            const t = performance.now() / 1000;
            for (let i = 0; i < MAX_ROVERS; i++) {
                const p = patches[i % MAX_PATCHES];
                if (i < n) {
                    // each rover works one field, travelling along its row and back
                    const lap = (t * 0.22 + i * 0.37) % 2;
                    const u = lap < 1 ? lap * 2 - 1 : 1 - (lap - 1) * 2; // -1..1 ping-pong
                    const dir = i % 2 === 0 ? 1 : -1;
                    tmpObj.position.set(p.x + Math.cos(p.rot) * p.w * 0.55 * u * dir, heightAt(p.x, p.z) + 0.14, p.z + Math.sin(p.rot) * p.w * 0.55 * u * dir);
                    tmpObj.rotation.set(0, p.rot + (lap < 1 ? 0 : Math.PI), 0);
                    tmpObj.scale.set(0.55, 0.16, 0.3);
                    tmpObj.updateMatrix();
                    rovers.setMatrixAt(i, tmpObj.matrix);
                    // status beacon on the mast
                    tmpObj.position.y += 0.26;
                    tmpObj.scale.set(0.1, 0.06, 0.06);
                    tmpObj.updateMatrix();
                    rlights.setMatrixAt(i, tmpObj.matrix);
                }
                else {
                    tmpObj.position.set(0, -70, 0);
                    tmpObj.scale.setScalar(0.001);
                    tmpObj.updateMatrix();
                    rovers.setMatrixAt(i, tmpObj.matrix);
                    rlights.setMatrixAt(i, tmpObj.matrix);
                }
            }
            rovers.instanceMatrix.needsUpdate = true;
            rlights.instanceMatrix.needsUpdate = true;
            rlights.material.emissiveIntensity = 0.9 + Math.sin(t * 2.2) * 0.4;
        }
    });
    return (_jsxs("group", { children: [_jsx("group", { ref: groupRef, children: patches.map((p, i) => (_jsxs("mesh", { position: [p.x, heightAt(p.x, p.z) + 0.08, p.z], rotation: [-Math.PI / 2, 0, p.rot], children: [_jsx("planeGeometry", { args: [p.w, p.w * 0.7] }), _jsx("meshStandardMaterial", { color: tmpColor.setHSL(p.hue, 0.5, p.light).getHex(), roughness: 1 })] }, i))) }), _jsxs("instancedMesh", { ref: roverRef, args: [undefined, undefined, MAX_ROVERS], castShadow: true, frustumCulled: false, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { color: "#2f353c", roughness: 0.5, metalness: 0.45 })] }), _jsxs("instancedMesh", { ref: lightRef, args: [undefined, undefined, MAX_ROVERS], frustumCulled: false, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { color: "#ffd9a0", emissive: "#ffcf6e", emissiveIntensity: 1 })] }), _jsx("group", { ref: towerRef, children: towerSpots.map((s, i) => {
                    const y = heightAt(s.x, s.z);
                    return (_jsxs("group", { position: [s.x, y, s.z], children: [_jsxs("mesh", { position: [0, s.h / 2, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [1.3, s.h, 1.3] }), _jsx("meshStandardMaterial", { color: "#dfe6ea", roughness: 0.35, metalness: 0.3 })] }), [0.3, 0.55, 0.8].map((h, k) => (_jsxs("mesh", { position: [0, s.h * h, 0], children: [_jsx("boxGeometry", { args: [1.38, 0.12, 1.38] }), _jsx("meshStandardMaterial", { color: "#7ee8a2", emissive: "#39d97e", emissiveIntensity: 1.4 })] }, k)))] }, i));
                }) })] }));
}
// ── Transmission corridors ───────────────────────────────────────────────────
function Transmission() {
    const { pylons, lines } = useMemo(() => {
        const corridors = [];
        for (const z of INFRA_ZONES) {
            if (z.type === 'solar' || z.type === 'wind' || z.type === 'nuclear' || z.type === 'datacenter') {
                let best = CITIES[0];
                let bd = Infinity;
                for (const c of CITIES) {
                    if (c.civId !== z.civId)
                        continue;
                    const d = (c.x - z.x) ** 2 + (c.z - z.z) ** 2;
                    if (d < bd) {
                        bd = d;
                        best = c;
                    }
                }
                corridors.push([z.x, z.z, best.x, best.z]);
            }
        }
        const pylonPos = [];
        const linePts = [];
        for (const [x0, z0, x1, z1] of corridors) {
            const dist = Math.hypot(x1 - x0, z1 - z0);
            const n = Math.max(2, Math.floor(dist / 9));
            let prev = null;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const x = x0 + (x1 - x0) * t;
                const z = z0 + (z1 - z0) * t;
                const y = heightAt(x, z);
                if (y < 1.1) {
                    prev = null;
                    continue;
                } // skip water spans
                pylonPos.push([x, y, z]);
                const top = new THREE.Vector3(x, y + 1.7, z);
                if (prev) {
                    // catenary sag: 3 segments between tops
                    for (let s = 0; s < 3; s++) {
                        const ta = s / 3;
                        const tb = (s + 1) / 3;
                        const sag = (tt) => Math.sin(tt * Math.PI) * -0.55;
                        const ax = prev.x + (top.x - prev.x) * ta, ay = prev.y + (top.y - prev.y) * ta + sag(ta), az = prev.z + (top.z - prev.z) * ta;
                        const bx = prev.x + (top.x - prev.x) * tb, by = prev.y + (top.y - prev.y) * tb + sag(tb), bz = prev.z + (top.z - prev.z) * tb;
                        linePts.push(ax, ay, az, bx, by, bz);
                    }
                }
                prev = top;
            }
        }
        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
        return { pylons: pylonPos, lines: lineGeom };
    }, []);
    return (_jsxs("group", { children: [pylons.map(([x, y, z], i) => (_jsxs("group", { position: [x, y, z], children: [_jsxs("mesh", { position: [0, 0.85, 0], children: [_jsx("cylinderGeometry", { args: [0.05, 0.09, 1.7, 5] }), _jsx("meshStandardMaterial", { color: "#5a616b", roughness: 0.6, metalness: 0.5 })] }), _jsxs("mesh", { position: [0, 1.55, 0], children: [_jsx("boxGeometry", { args: [0.9, 0.06, 0.06] }), _jsx("meshStandardMaterial", { color: "#5a616b", roughness: 0.6, metalness: 0.5 })] })] }, i))), _jsx("lineSegments", { geometry: lines, children: _jsx("lineBasicMaterial", { color: "#3d434c", transparent: true, opacity: 0.75 }) })] }));
}
// ── Landfills — unmanaged waste piles up at the city edge ────────────────────
function Landfill({ civId, visualRef }) {
    const groupRef = useRef(null);
    const city = useMemo(() => civMainCity(civId), [civId]);
    const mounds = useMemo(() => {
        const rng = zoneRng(civId + '-lf');
        // away from the world center — the edge of town
        const dirX = Math.sign(city.x) || 1, dirZ = Math.sign(city.z) || 1;
        return Array.from({ length: 6 }, (_, i) => ({
            x: city.x + dirX * (city.districtRadius * 1.5 + i * 1.6) + (nextFloat(rng) - 0.5) * 2,
            z: city.z + dirZ * (city.districtRadius * 1.3 + (i % 3) * 1.8) + (nextFloat(rng) - 0.5) * 2,
            r: 1.1 + nextFloat(rng) * 1.2,
            h: 0.5 + nextFloat(rng) * 0.6,
        }));
    }, [city, civId]);
    useFrame(() => {
        const g = groupRef.current;
        if (!g)
            return;
        const waste = visualRef.current?.cities.find((c) => c.city.id === city.id)?.waste ?? 0;
        const n = Math.min(6, Math.floor(waste * 8));
        g.children.forEach((child, i) => {
            child.visible = i < n;
            const s = 0.5 + waste * 0.9;
            child.scale.set(s, s, s);
        });
    });
    return (_jsx("group", { ref: groupRef, children: mounds.map((m, i) => (_jsxs("mesh", { position: [m.x, heightAt(m.x, m.z) + m.h / 2 - 0.1, m.z], children: [_jsx("coneGeometry", { args: [m.r, m.h, 7] }), _jsx("meshStandardMaterial", { color: i % 2 ? '#6e6250' : '#7a6f5a', roughness: 1 })] }, i))) }));
}
export function Infrastructure({ visualRef }) {
    return (_jsxs("group", { children: [INFRA_ZONES.map((z) => {
                switch (z.type) {
                    case 'wind': return _jsx(WindFarm, { zone: z, visualRef: visualRef }, z.id);
                    case 'solar': return _jsxs("group", { children: [_jsx(SolarField, { zone: z, visualRef: visualRef }), _jsx(SolarPosts, { zone: z, visualRef: visualRef })] }, z.id);
                    case 'nuclear': return _jsx(NuclearPlant, { zone: z, visualRef: visualRef }, z.id);
                    case 'datacenter': return _jsx(DataCenter, { zone: z, visualRef: visualRef }, z.id);
                    case 'port': return _jsx(Port, { zone: z, visualRef: visualRef }, z.id);
                    case 'farm': return _jsx(Farm, { zone: z, visualRef: visualRef }, z.id);
                }
            }), CIV_IDS.map((id) => _jsx(Landfill, { civId: id, visualRef: visualRef }, id)), _jsx(Transmission, {})] }));
}
