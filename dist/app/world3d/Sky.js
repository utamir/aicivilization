import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// SKY & LIGHTING RIG — sun arc, atmosphere, stars, moonlight, haze.
//
// Day/night is cosmetic (a sim month is a tick; a lit cycle cannot be a real
// day). It exists to let the player see the world in two states: lit windows
// and brownouts at night, structure and color by day. The cycle is slow (a
// full day takes ~4 minutes), pauses with the simulation, and can be pinned
// to Day / Dusk / Night from the bottom bar so it never fights the player.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useUI } from '../state/store.js';
import { engine } from '../state/engine.js';
const DAY_PERIOD = 240; // seconds per cosmetic day while the sim runs
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // depth = far
}
`;
const SKY_FRAG = /* glsl */ `
uniform float uNight;
uniform float uDusk;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -0.1, 1.0);
  vec3 dayZen = vec3(0.36, 0.55, 0.78);
  vec3 dayHor = vec3(0.78, 0.83, 0.88);
  vec3 duskZen = vec3(0.22, 0.20, 0.40);
  vec3 duskHor = vec3(0.98, 0.58, 0.32);
  vec3 nightZen = vec3(0.012, 0.018, 0.04);
  vec3 nightHor = vec3(0.05, 0.07, 0.12);
  vec3 zen = mix(mix(dayZen, duskZen, uDusk), nightZen, uNight);
  vec3 hor = mix(mix(dayHor, duskHor, uDusk), nightHor, uNight);
  vec3 col = mix(hor, zen, pow(max(h, 0.0), 0.55));
  float sunGlow = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 18.0);
  col += vec3(1.0, 0.75, 0.45) * sunGlow * (1.0 - uNight) * 0.55;
  col += vec3(0.9, 0.5, 0.3) * sunGlow * uDusk * 0.8;
  gl_FragColor = vec4(col, 1.0);
}
`;
/** Sun elevation for a lighting mode; `phase` is 0..1 around the cosmetic day. */
function sunElevation(mode, phase) {
    switch (mode) {
        case 'day': return 0.85;
        case 'dusk': return 0.04;
        case 'night': return -0.6;
        default: return Math.sin(phase * Math.PI * 2);
    }
}
export function SkyRig() {
    const sun = useRef(null);
    const moon = useRef(null);
    const hemi = useRef(null);
    const skyMat = useRef(null);
    const stars = useRef(null);
    const { scene } = useThree();
    const phase = useRef(0.18); // start mid-morning
    const smoothElev = useRef(sunElevation('cycle', 0.18));
    const skyUniforms = useMemo(() => ({ uNight: { value: 0 }, uDusk: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } }), []);
    const starGeo = useMemo(() => {
        const g = new THREE.BufferGeometry();
        const pts = [];
        let s = 1337;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let i = 0; i < 1100; i++) {
            const th = rnd() * Math.PI * 2;
            const ph = Math.acos(rnd() * 0.92);
            const r = 800;
            pts.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
        }
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        return g;
    }, []);
    useFrame((_, dt) => {
        const mode = useUI.getState().lighting;
        // The cycle advances only while the simulation runs; paused worlds hold still.
        if (mode === 'cycle' && engine.speed !== 0)
            phase.current = (phase.current + Math.min(dt, 0.1) / DAY_PERIOD) % 1;
        const targetElev = sunElevation(mode, phase.current);
        // Ease pinned-mode changes so switching Day → Night is a fade, not a cut.
        smoothElev.current += (targetElev - smoothElev.current) * Math.min(1, dt * 1.6);
        const elev = smoothElev.current;
        // twilight band: night ramps in between +0.10 and -0.16 elevation
        const night = THREE.MathUtils.smoothstep(-elev, -0.10, 0.16);
        const dusk = (1 - night) * THREE.MathUtils.smoothstep(0.32 - Math.abs(elev), 0.0, 0.32);
        const az = mode === 'cycle' ? phase.current * Math.PI * 2 : 1.9;
        const sunDir = new THREE.Vector3(Math.cos(az) * 0.9, Math.max(elev, -0.35), Math.sin(az) * 0.45).normalize();
        window.__nightFactor = night;
        window.__sunDir = sunDir;
        if (sun.current) {
            sun.current.position.copy(sunDir).multiplyScalar(300);
            sun.current.intensity = Math.max(0, elev) * 2.4 + Math.max(0, 0.18 - Math.abs(elev)) * 1.2;
            sun.current.color.set(new THREE.Color('#fff4e0').lerp(new THREE.Color('#ffb070'), dusk));
            sun.current.visible = elev > -0.12;
        }
        if (moon.current) {
            // Moonlight keeps the terrain legible at night; the real fix for a dark
            // city is the lit windows, which the buildings shader provides.
            moon.current.position.set(-120, 220, -80);
            moon.current.intensity = night * 0.32;
            moon.current.visible = night > 0.02;
        }
        if (hemi.current) {
            hemi.current.intensity = THREE.MathUtils.lerp(0.9, 0.22, night);
            hemi.current.color.set(new THREE.Color('#bcd3e8').lerp(new THREE.Color('#ffd0a0'), dusk * 0.6).lerp(new THREE.Color('#1c2a4a'), night));
            hemi.current.groundColor.set(new THREE.Color('#6d7a56').lerp(new THREE.Color('#0d1320'), night));
        }
        if (skyMat.current) {
            skyMat.current.uniforms.uNight.value = night;
            skyMat.current.uniforms.uDusk.value = dusk;
            skyMat.current.uniforms.uSunDir.value.copy(sunDir);
        }
        if (stars.current)
            stars.current.material.opacity = night * 0.9;
        if (scene.fog instanceof THREE.Fog) {
            scene.fog.color.set(new THREE.Color('#b8c8d8').lerp(new THREE.Color('#d9a380'), dusk * 0.5).lerp(new THREE.Color('#070b14'), night));
            scene.fog.near = THREE.MathUtils.lerp(160, 120, night);
        }
    });
    return (_jsxs(_Fragment, { children: [_jsx("fog", { attach: "fog", args: ['#b8c8d8', 160, 700] }), _jsx("hemisphereLight", { ref: hemi, intensity: 0.9 }), _jsx("directionalLight", { ref: sun, castShadow: true, position: [200, 250, 100], intensity: 2.2, "shadow-mapSize": [2048, 2048], "shadow-camera-left": -160, "shadow-camera-right": 160, "shadow-camera-top": 160, "shadow-camera-bottom": -160, "shadow-camera-far": 700, "shadow-bias": -0.0004 }), _jsx("directionalLight", { ref: moon, position: [-120, 220, -80], intensity: 0, color: "#9fb4ff" }), _jsxs("mesh", { scale: [1, 1, 1], renderOrder: -10, children: [_jsx("sphereGeometry", { args: [780, 24, 16] }), _jsx("shaderMaterial", { ref: skyMat, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false })] }), _jsx("points", { ref: stars, geometry: starGeo, renderOrder: -9, children: _jsx("pointsMaterial", { size: 1.6, sizeAttenuation: false, color: "#cdd8ff", transparent: true, opacity: 0, depthWrite: false }) })] }));
}
