import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// ROADS — the street network. Inter-city highways connect the settlements;
// each city's district grid (district.ts) renders as local streets with
// sidewalks, intersection patches and center markings, all merged per city
// into single meshes for performance.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITIES } from './layout.js';
import { cityDistrict, STREET_HALF } from './district.js';
import { heightAt } from './terrain.js';
import { buildRoadPaths } from './RoadsCurves.js';
export { buildRoadPaths } from './RoadsCurves.js';
function ribbonGeometry(path, width, yLift = 0.14) {
    const segments = Math.max(12, Math.floor(path.length * 1.2));
    const positions = [];
    const normals = [];
    const uvs = [];
    const index = [];
    const pt = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const side = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        path.curve.getPointAt(t, pt);
        path.curve.getTangentAt(t, tan);
        side.crossVectors(up, tan).normalize().multiplyScalar(width / 2);
        const y = heightAt(pt.x, pt.z) + yLift;
        positions.push(pt.x - side.x, y, pt.z - side.z, pt.x + side.x, y, pt.z + side.z);
        normals.push(0, 1, 0, 0, 1, 0);
        uvs.push(0, t * path.length, 1, t * path.length);
        if (i < segments) {
            const a = i * 2;
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(index);
    return g;
}
/** straight street segment as a ribbon geometry */
function streetRibbon(x, z, angle, halfLen, width, yLift) {
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const pts = [
        [x - dx * halfLen, z - dz * halfLen],
        [x + dx * halfLen, z + dz * halfLen],
    ];
    const curve = new THREE.CatmullRomCurve3(pts.map(([px, pz]) => new THREE.Vector3(px, heightAt(px, pz) + yLift, pz)));
    return ribbonGeometry({ key: 'street', a: '', b: '', curve, length: halfLen * 2 }, width, 0);
}
function CityStreets({ city }) {
    const { asphalt, sidewalk, markings } = useMemo(() => {
        const d = cityDistrict(city);
        const asphalts = [];
        const walks = [];
        const dashes = [];
        const tmp = new THREE.Object3D();
        for (const st of d.streets) {
            const w = st.main ? STREET_HALF * 2 + 0.4 : STREET_HALF * 2;
            asphalts.push(streetRibbon(st.x, st.z, st.angle, st.halfLen, w, 0.02));
            // sidewalks both sides
            const dx = Math.cos(st.angle), dz = Math.sin(st.angle);
            const so = STREET_HALF + 0.28;
            walks.push(streetRibbon(st.x - dz * so, st.z + dx * so, st.angle, st.halfLen, 0.5, 0.028));
            walks.push(streetRibbon(st.x + dz * so, st.z - dx * so, st.angle, st.halfLen, 0.5, 0.028));
            // center dashes on boulevards
            if (st.main) {
                const n = Math.floor(st.halfLen / 1.6);
                for (let i = 0; i < n; i++) {
                    const along = (i - n / 2 + 0.5) * 1.6;
                    tmp.position.set(st.x + dx * along, 0, st.z + dz * along);
                    tmp.position.y = heightAt(tmp.position.x, tmp.position.z) + 0.045;
                    tmp.rotation.set(0, st.angle, 0);
                    tmp.scale.set(0.07, 1, 0.028);
                    tmp.updateMatrix();
                    dashes.push(tmp.matrix.clone());
                }
            }
        }
        // intersection patches cover street-street overlaps (kills z-fighting)
        for (let i = 0; i < d.streets.length; i++) {
            for (let j = i + 1; j < d.streets.length; j++) {
                const a = d.streets[i], b = d.streets[j];
                const dxA = Math.cos(a.angle), dzA = Math.sin(a.angle);
                const dxB = Math.cos(b.angle), dzB = Math.sin(b.angle);
                // solve a(t) = b(s) for perpendicular pair
                const ex = b.x - a.x, ez = b.z - a.z;
                const det = -dzA * dxB + dxA * dzB;
                if (Math.abs(det) < 0.01)
                    continue;
                const t = (ex * dzB - ez * dxB) / det;
                const s = (dxA * ez - dzA * ex) / det;
                if (Math.abs(t) > a.halfLen || Math.abs(s) > b.halfLen)
                    continue;
                const px = a.x + dxA * t, pz = a.z + dzA * t;
                if (Math.hypot(px - city.x, pz - city.z) > city.districtRadius)
                    continue;
                asphalts.push(streetRibbon(px, pz, b.angle, STREET_HALF + 0.1, STREET_HALF * 2 + 0.4, 0.012));
                asphalts.push(streetRibbon(px, pz, a.angle, STREET_HALF + 0.1, STREET_HALF * 2 + 0.4, 0.014));
            }
        }
        const merged = mergeGeometries(asphalts, false) ?? new THREE.BufferGeometry();
        const mergedWalks = mergeGeometries(walks, false) ?? new THREE.BufferGeometry();
        return { asphalt: merged, sidewalk: mergedWalks, markings: dashes };
    }, [city]);
    return (_jsxs("group", { children: [_jsx("mesh", { geometry: asphalt, receiveShadow: true, children: _jsx("meshStandardMaterial", { color: "#2a2e34", roughness: 0.96, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }) }), _jsx("mesh", { geometry: sidewalk, receiveShadow: true, children: _jsx("meshStandardMaterial", { color: "#9a978e", roughness: 0.98, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }) }), markings.map((m, i) => (_jsxs("mesh", { matrixAutoUpdate: false, matrix: m, children: [_jsx("boxGeometry", { args: [1, 1, 1] }), _jsx("meshStandardMaterial", { color: "#d8d5c8", roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })] }, i)))] }));
}
export function Roads() {
    const paths = useMemo(() => buildRoadPaths(), []);
    const geoms = useMemo(() => paths.map((p) => ribbonGeometry(p, 2.3)), [paths]);
    return (_jsxs("group", { children: [geoms.map((g, i) => (_jsx("mesh", { geometry: g, receiveShadow: true, children: _jsx("meshStandardMaterial", { color: "#33383f", roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 }) }, paths[i].key))), CITIES.map((c) => _jsx(CityStreets, { city: c }, c.id))] }));
}
