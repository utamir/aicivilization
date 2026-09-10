import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// INTERVENTIONS — spend Influence on real actions: funding, build-outs,
// policy, diplomacy. Effects enter the simulation as structured state changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useUI } from '../state/store.js';
import { engine } from '../state/engine.js';
import { INTERVENTIONS, civDef, CIV_IDS } from '../sim/index.js';
const CAT_LABEL = { research: 'Research', energy: 'Energy', industry: 'Industry', society: 'Society', geopolitics: 'Geopolitics' };
export function Interventions({ worldRef }) {
    const set = useUI((s) => s.set);
    const selectedCiv = useUI((s) => s.selectedCiv);
    useUI((s) => s.vmTick);
    const [targetCiv, setTargetCiv] = useState(selectedCiv);
    const [otherCiv, setOtherCiv] = useState('ardan');
    const [message, setMessage] = useState('');
    const budget = () => Math.round(worldRef.current.observerBudget);
    const run = (id, scope) => {
        const r = engine.intervene(id, scope === 'civ' ? targetCiv : null, scope === 'relation' ? otherCiv : null);
        setMessage(r.ok ? '✓ Intervention applied — consequences will unfold in the simulation.' : `✕ ${r.reason ?? 'Failed'}`);
    };
    return (_jsx("div", { className: "modal-backdrop", onClick: () => set({ panel: null }), children: _jsxs("div", { className: "modal glass-panel interventions", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "panel-head", children: [_jsx("span", { className: "panel-title", children: "Interventions" }), _jsx("button", { className: "ghost-btn", onClick: () => set({ panel: null }), children: "\u2715" })] }), _jsxs("div", { className: "iv-budget-note", children: [_jsxs("b", { children: ["Observer budget ", budget(), "/100."] }), " It is outside the simulated civilization and has no passive effect. It changes history only when you spend it here. +6 points per simulated year."] }), _jsxs("div", { className: "target-row", children: [_jsx("span", { className: "axis-label", children: "Target" }), _jsx("div", { className: "axis-options", children: CIV_IDS.map((id) => (_jsx("button", { className: `axis-opt ${targetCiv === id ? 'active' : ''}`, onClick: () => setTargetCiv(id), children: civDef(id).name }, id))) }), _jsx("span", { className: "axis-label", style: { marginLeft: 12 }, children: "With" }), _jsx("div", { className: "axis-options", children: CIV_IDS.filter((id) => id !== targetCiv).map((id) => (_jsx("button", { className: `axis-opt ${otherCiv === id ? 'active' : ''}`, onClick: () => setOtherCiv(id), children: civDef(id).name }, id))) })] }), message && _jsx("div", { className: "iv-message", children: message }), _jsx("div", { className: "iv-list", children: Object.entries(CAT_LABEL).map(([cat, label]) => (_jsxs("div", { children: [_jsx("div", { className: "sub-head", children: label }), INTERVENTIONS.filter((iv) => iv.category === cat).map((iv) => {
                                const afford = budget() >= iv.cost;
                                return (_jsxs("div", { className: `iv-item ${afford ? '' : 'disabled'}`, children: [_jsxs("div", { className: "iv-info", children: [_jsxs("div", { className: "iv-label", children: [iv.label, " ", _jsxs("span", { className: "iv-cost", children: [iv.cost, " \u25C8 \u00B7 ", iv.scope, " \u00B7 budget ", budget(), "/100"] })] }), _jsx("div", { className: "iv-desc", children: iv.description })] }), _jsx("button", { className: "iv-btn", disabled: !afford, onClick: () => run(iv.id, iv.scope), children: "Apply" })] }, iv.id));
                            })] }, cat))) })] }) }));
}
