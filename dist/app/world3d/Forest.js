import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// FOREST — vegetation with real silhouettes. Trees are alpha-card foliage:
// two crossed leaf-cluster cards per canopy (cutout texture, cast shadows via
// alpha-tested depth), trunks with bark texture, plus scrub patches and forest
// floor decals. Placement mirrors the terrain shader: trees grow only where
// buildTerrain paints its dark forest tint (moisture fbm), on land, below the
// snow line, away from cities, their fringes and the roads.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITIES, WORLD_SIZE } from './layout.js';
import { heightAt, fbm } from './terrain.js';
import { buildRoadPaths } from './RoadsCurves.js';
import { makeRng, nextFloat, range } from '../sim/rng.js';
import { leafCard, barkTex, textureSeed } from './textures.js';
function generateTrees() {
    const rng = makeRng(20260907, 31);
    const roads = buildRoadPaths();
    const roadPts = [];
    for (const r of roads) {
        const n = Math.max(8, Math.floor(r.length / 3));
        for (let i = 0; i <= n; i++) {
            const p = r.curve.getPointAt(i / n);
            roadPts.push([p.x, p.z]);
        }
    }
    const trees = [];
    const MAX = 900;
    for (let attempt = 0; attempt < 9000 && trees.length < MAX; attempt++) {
        const x = (nextFloat(rng) - 0.5) * WORLD_SIZE * 0.94;
        const z = (nextFloat(rng) - 0.5) * WORLD_SIZE * 0.94;
        const h = heightAt(x, z);
        if (h < 1.6 || h > 13.2)
            continue;
        const moist = fbm(x / 40 + 9, z / 40 + 3, 3);
        if (moist < 0.56)
            continue;
        let near = false;
        for (const c of CITIES) {
            const d = Math.hypot(x - c.x, z - c.z);
            if (d < c.districtRadius * 1.65) {
                near = true;
                break;
            }
        }
        if (near)
            continue;
        for (const [rx, rz] of roadPts) {
            if (Math.hypot(x - rx, z - rz) < 2.8) {
                near = true;
                break;
            }
        }
        if (near)
            continue;
        const slope = Math.abs(heightAt(x + 1.2, z) - h) + Math.abs(heightAt(x, z + 1.2) - h);
        if (slope > 2.4)
            continue;
        trees.push({
            x, z, y: h - 0.1,
            s: range(rng, 0.55, 1.35) * (moist > 0.66 ? 1.1 : 1.0),
            rot: nextFloat(rng) * Math.PI * 2,
            tint: nextFloat(rng),
            kind: moist > 0.68 ? 0 : nextFloat(rng) < 0.75 ? 0 : 1,
        });
    }
    return trees;
}
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();
export function Forest() {
    const trees = useMemo(generateTrees, []);
    const trunkRef = useRef(null);
    // foliage: two crossed cards per tree (quads sharing one instanced mesh)
    const cardRef = useRef(null);
    const scrubRef = useRef(null);
    const swayUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
    const applied = useRef(false);
    const bark = useMemo(() => { textureSeed(4242); return barkTex(); }, []);
    const leafA = useMemo(() => { textureSeed(1717); return leafCard('#2c4a26'); }, []);
    const swayMat = useMemo(() => {
        const m = new THREE.MeshStandardMaterial({ map: leafA, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
        m.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = swayUniforms.uTime;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nuniform float uTime;')
                .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 1.3;
            transformed.x += sin(uTime * 0.9 + phase) * 0.05 * max(position.y, 0.0);
            transformed.z += cos(uTime * 0.7 + phase) * 0.045 * max(position.y, 0.0);
          #endif`);
        };
        return m;
    }, [swayUniforms, leafA]);
    useFrame((state) => {
        swayUniforms.uTime.value = state.clock.elapsedTime;
        const trunks = trunkRef.current, cards = cardRef.current, scrub = scrubRef.current;
        if (!trunks || !cards || !scrub || applied.current)
            return;
        applied.current = true;
        let ci = 0;
        for (let i = 0; i < trees.length; i++) {
            const t = trees[i];
            // trunk: taller for conifers
            const trunkH = t.kind === 0 ? t.s * 1.15 : t.s * 0.75;
            tmpObj.position.set(t.x, t.y + trunkH / 2, t.z);
            tmpObj.rotation.set(0, t.rot, 0);
            tmpObj.scale.set(t.s * 0.14, trunkH, t.s * 0.14);
            tmpObj.updateMatrix();
            trunks.setMatrixAt(ci, tmpObj.matrix);
            // foliage: two crossed cards centered above the trunk
            const cardH = t.kind === 0 ? t.s * 2.4 : t.s * 1.7;
            const cardW = t.kind === 0 ? t.s * 1.5 : t.s * 1.9;
            const cy = t.y + trunkH * (t.kind === 0 ? 0.62 : 0.86);
            for (let k = 0; k < 2; k++) {
                tmpObj.position.set(t.x, cy, t.z);
                tmpObj.rotation.set(0, t.rot + k * Math.PI / 2, 0);
                tmpObj.scale.set(cardW, cardH, 1);
                tmpObj.updateMatrix();
                cards.setMatrixAt(ci * 2 + k, tmpObj.matrix);
                // per-tree tint: deep wet greens → dry olive
                // lighten the canopy tints a touch so forests read as foliage, not voids
                tmpColor.setHSL(0.26 + t.tint * 0.09, 0.3 + t.tint * 0.18, 0.3 + t.tint * 0.13);
                cards.setColorAt(ci * 2 + k, tmpColor);
            }
            ci++;
        }
        // scrub: low ground patches at the forest edge (every 3rd slot unused)
        tmpObj.position.set(0, -80, 0);
        tmpObj.rotation.set(0, 0, 0);
        tmpObj.scale.setScalar(0.001);
        tmpObj.updateMatrix();
        for (let i = ci * 2; i < cards.count; i++)
            cards.setMatrixAt(i, tmpObj.matrix);
        for (let i = ci; i < trunks.count; i++)
            trunks.setMatrixAt(i, tmpObj.matrix);
        trunks.instanceMatrix.needsUpdate = true;
        cards.instanceMatrix.needsUpdate = true;
        if (cards.instanceColor)
            cards.instanceColor.needsUpdate = true;
    });
    return (_jsxs("group", { children: [_jsx("instancedMesh", { ref: trunkRef, args: [undefined, undefined, trees.length], castShadow: true, receiveShadow: true, frustumCulled: false, material: useMemo(() => { const m = new THREE.MeshStandardMaterial({ map: bark, roughness: 1 }); return m; }, [bark]), children: _jsx("cylinderGeometry", { args: [1, 1.35, 1, 6] }) }), _jsx("instancedMesh", { ref: cardRef, args: [undefined, undefined, trees.length * 2], castShadow: true, frustumCulled: false, material: swayMat, children: _jsx("planeGeometry", { args: [1, 1] }) }), _jsx("instancedMesh", { ref: scrubRef, visible: false, args: [undefined, undefined, 1], frustumCulled: false, children: _jsx("planeGeometry", { args: [1, 1] }) })] }));
}
