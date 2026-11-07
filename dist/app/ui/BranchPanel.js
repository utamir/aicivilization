import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// PARALLEL WORLDS — branch the timeline at the current date with one changed
// assumption, run both worlds in lockstep, compare them side by side.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useUI } from '../state/store.js';
import { engine } from '../state/engine.js';
import { parseWhatIf, compareWorlds } from '../sim/index.js';
export function BranchPanel() {
    const set = useUI((s) => s.set);
    const hasBranch = useUI((s) => s.hasBranch);
    const vmTick = useUI((s) => s.vmTick);
    const [text, setText] = useState('');
    const parsed = useMemo(() => (text.trim().length >= 4 ? parseWhatIf(text) : null), [text]);
    const compare = useMemo(() => {
        if (!hasBranch || !engine.worldB)
            return null;
        return compareWorlds(engine.worldA, engine.worldB);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasBranch, vmTick]);
    const active = engine.activeWorld;
    return (_jsx("div", { className: "modal-backdrop", onClick: () => set({ panel: null }), children: _jsxs("div", { className: "modal glass-panel branch", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "panel-head", children: [_jsx("span", { className: "panel-title", children: "Parallel Worlds" }), _jsx("button", { className: "ghost-btn", onClick: () => set({ panel: null }), children: "\u2715" })] }), !hasBranch ? (_jsxs("div", { className: "branch-create", children: [_jsxs("div", { className: "whatif-hint", children: ["Split the timeline ", _jsx("b", { children: "at the current date" }), ". World A continues unchanged; World B gets one changed assumption. Both run from identical state with the same random seed \u2014 any divergence is attributable."] }), _jsx("textarea", { className: "whatif-input", rows: 2, placeholder: "What changes in World B? e.g. \u201CAI research plateaus\u201D or \u201Ccheap clean energy\u201D", value: text, onChange: (e) => setText(e.target.value) }), parsed && (_jsx("div", { className: `whatif-result ${parsed.ok ? 'ok' : 'fail'}`, children: parsed.ok ? _jsxs(_Fragment, { children: [_jsxs("b", { children: ["World B: ", parsed.label] }), _jsx("div", { children: parsed.explanation })] }) : parsed.explanation })), _jsx("button", { className: "launch-btn", disabled: !parsed?.ok, onClick: () => { if (parsed?.ok) {
                                engine.branch(parsed.label, parsed.delta);
                                set({ panel: null });
                            } }, children: "Create parallel world \u2192" })] })) : (_jsxs("div", { className: "branch-compare", children: [_jsx("div", { className: "branch-switch", children: ['A', 'B'].map((w) => (_jsxs("button", { className: `axis-opt ${active === w ? 'active' : ''}`, onClick: () => engine.setActiveWorld(w), children: ["World ", w, " ", w === 'B' ? `— ${engine.branchNote}` : '— unchanged'] }, w))) }), compare && (_jsxs("div", { className: "compare-table", children: [_jsxs("div", { className: "compare-row head", children: [_jsx("span", { children: "Metric" }), _jsx("span", { children: "World A" }), _jsx("span", { children: "World B" }), _jsx("span", { children: "\u0394" })] }), compare.map((r) => {
                                    const delta = r.b - r.a;
                                    const rel = r.a !== 0 ? delta / Math.abs(r.a) : 0;
                                    const tone = r.betterWhenHigher === null ? '' : Math.abs(rel) < 0.01 ? '' : (delta > 0) === r.betterWhenHigher ? 'good' : 'bad';
                                    return (_jsxs("div", { className: "compare-row", children: [_jsx("span", { children: r.label }), _jsxs("span", { className: "num", children: [r.a.toFixed(2), r.unit] }), _jsxs("span", { className: "num", children: [r.b.toFixed(2), r.unit] }), _jsxs("span", { className: `num tone-${tone || 'warn'}`, children: [delta >= 0 ? '+' : '', delta.toFixed(2)] })] }, r.label));
                                })] })), _jsxs("div", { className: "branch-actions", children: [_jsx("button", { className: "iv-btn", onClick: () => { engine.closeBranch(active); }, children: "Keep viewing world, discard other" }), _jsx("button", { className: "ghost-btn", onClick: () => engine.closeBranch(active === 'A' ? 'A' : 'B'), children: "Close branch" })] })] }))] }) }));
}
