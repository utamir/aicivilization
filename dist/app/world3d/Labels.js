import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// LABELS — compact settlement tags. Small pill with the name and (only for the
// selected or principal city) the population; scales down with camera
// distance, never covers the world. Detailed data lives in the inspector
// panels, not on the label.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CITIES, civMainCity } from './layout.js';
import { heightAt } from './terrain.js';
import { useUI } from '../state/store.js';
function CityLabel({ id, visualRef }) {
    const city = CITIES.find((c) => c.id === id);
    const el = useRef(null);
    const main = civMainCity(city.civId).id === city.id;
    useFrame(() => {
        const vis = visualRef.current?.cities.find((c) => c.city.id === city.id);
        if (!el.current || !vis)
            return;
        const pop = vis.population;
        const sub = el.current.querySelector('.lbl-sub');
        if (sub)
            sub.textContent = `${pop >= 1 ? pop.toFixed(1) : (pop * 1000).toFixed(0)}${pop >= 1 ? 'M' : 'k'} · ${vis.derelict > 0.18 ? 'emptying' : vis.crowding > 0.15 ? 'crowded' : vis.nightDim > 0.4 ? 'blackouts' : city.kind}`;
        el.current.style.opacity = useUI.getState().hudVisible ? '1' : '0';
        el.current.classList.toggle('lbl-selected', useUI.getState().selectedCiv === city.civId);
    });
    return (_jsx(Html, { position: [city.x, heightAt(city.x, city.z) + 2.2 + (main ? 0.6 : 0), city.z], center: true, distanceFactor: 38, zIndexRange: [2, 1], occlude: true, style: { pointerEvents: 'none' }, children: _jsxs("div", { ref: el, className: `city-label city-label-sm civ-${city.civId} ${main ? 'lbl-main' : ''}`, children: [_jsx("div", { className: "lbl-name", children: city.name }), _jsx("div", { className: "lbl-sub" })] }) }));
}
export function Labels({ visualRef }) {
    return _jsx(_Fragment, { children: CITIES.map((c) => _jsx(CityLabel, { id: c.id, visualRef: visualRef }, c.id)) });
}
