import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL — Chronicle (history feed + Why Did This Happen), Technology
// inspector (pipeline, Research Velocity, calibration), Characters (+ Talk).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useUI } from '../state/store.js';
import { MILESTONES, ERA_LABELS } from '../sim/index.js';
import { TECH_IDS, TECH_DEFS, DOMAIN_META, researchVelocity, whyDidThisHappen, CIV_IDS, fmtHorizon, taskHorizonHrs, } from '../sim/index.js';
import { Bar, pct, signed, CATEGORY_COLOR, CIV_TINT } from './shared.js';
import { TOPICS, characterReply } from './dialogue.js';
// ── Chronicle ────────────────────────────────────────────────────────────────
function ChronicleTab({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const selectedEventId = useUI((s) => s.selectedEventId);
    const set = useUI((s) => s.set);
    const chronicleFilter = useUI((s) => s.chronicleFilter);
    // A century of simulation produces thousands of events; by default only the ones that changed the story are shown.
    const events = useMemo(() => [...worldRef.current.chronicle].reverse().filter((e) => chronicleFilter === 'all' || e.significance >= 2), [vmTick, worldRef, chronicleFilter]);
    const selected = selectedEventId ? worldRef.current.chronicle.find((e) => e.id === selectedEventId) : null;
    if (selected) {
        const why = whyDidThisHappen(selected);
        return (_jsxs("div", { className: "tab-scroll", children: [_jsx("button", { className: "ghost-btn back", onClick: () => set({ selectedEventId: null }), children: "\u2190 Chronicle" }), _jsxs("div", { className: "why-block", children: [_jsx("div", { className: "why-kicker", children: "Why did this happen?" }), _jsx("div", { className: "why-title", children: why.title }), _jsxs("div", { className: "why-date", children: [selected.year.toFixed(0), " \u00B7 ", selected.category] }), _jsx("p", { className: "why-body", children: selected.body }), _jsx("div", { className: "sub-head", children: "Causal drivers" }), why.causes.map((c, i) => (_jsxs("div", { className: "cause-row", children: [_jsx("span", { className: "cause-factor", children: c.factor }), _jsx(Bar, { value: c.weight, color: "#6E7BFF" }), _jsx("span", { className: "metric-val", children: pct(c.weight) })] }, i))), why.counterforces.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "sub-head", children: "Counterforces" }), why.counterforces.map((c, i) => (_jsxs("div", { className: "cause-row", children: [_jsx("span", { className: "cause-factor", children: c.factor }), _jsx(Bar, { value: c.weight, color: "#8B93A3" }), _jsx("span", { className: "metric-val", children: pct(c.weight) })] }, i)))] })), _jsxs("div", { className: "why-confidence", children: ["Attribution confidence: ", why.confidence, ". Rendered from the simulation\u2019s machine-readable causal record \u2014 not generated prose."] })] })] }));
    }
    return (_jsxs("div", { className: "tab-scroll", children: [_jsxs("div", { className: "chron-filter", children: [_jsx("button", { className: `bottom-btn ${chronicleFilter === 'major' ? 'active' : ''}`, onClick: () => set({ chronicleFilter: 'major' }), children: "Major" }), _jsxs("button", { className: `bottom-btn ${chronicleFilter === 'all' ? 'active' : ''}`, onClick: () => set({ chronicleFilter: 'all' }), children: ["All (", worldRef.current.chronicle.length, ")"] })] }), events.map((ev) => (_jsxs("button", { className: "chron-item", onClick: () => set({ selectedEventId: ev.id }), children: [_jsx("span", { className: "chron-year", children: ev.year.toFixed(0) }), _jsx("span", { className: "chron-dot", style: { background: CATEGORY_COLOR[ev.category] ?? '#8B93A3' } }), _jsxs("span", { className: "chron-text", children: [_jsx("span", { className: "chron-title", children: ev.title }), _jsxs("span", { className: "chron-cat", children: [ev.category, ev.significance >= 3 ? ' · major' : ''] })] }), _jsx("span", { className: "chron-why", children: "why \u2192" })] }, ev.id))), events.length === 0 && _jsx("div", { className: "empty-note", children: "History has not happened yet. Unpause time." })] }));
}
// ── Technology ───────────────────────────────────────────────────────────────
const PHASE_ORDER = ['science', 'prototype', 'engineering', 'deployment', 'diffusion', 'mature'];
function TechInspector({ worldRef, techId }) {
    const vmTick = useUI((s) => s.vmTick);
    const vm = useMemo(() => {
        const w = worldRef.current;
        const t = w.techs[techId];
        const def = TECH_DEFS[techId];
        const v = researchVelocity(w, techId);
        const horizon = techId === 'ai_agents' || techId === 'ai_models' ? fmtHorizon(taskHorizonHrs(w.techs.ai_agents.cap)) : null;
        const velSeries = w.metrics.map((m) => m.aiCap);
        const programs = w.researchPrograms.filter((p) => p.techId === techId && !['failed', 'cancelled'].includes(p.status)).slice(-6);
        const inventions = w.inventions.filter((i) => i.techId === techId).slice(-6);
        return { t, def, v, horizon, velSeries, programs, inventions };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vmTick, techId, worldRef]);
    const { t, def, v } = vm;
    const phaseIdx = PHASE_ORDER.indexOf(t.phase);
    return (_jsxs("div", { className: "tech-inspector", children: [_jsxs("div", { className: "tech-head", children: [_jsx("span", { className: "tech-name", children: def.name }), _jsx("span", { className: `velocity-badge state-${v.state}`, children: v.state })] }), _jsxs("div", { className: "tech-sub", children: ["Paradigm ", t.paradigm, " \u00B7 capability ", t.cap.toFixed(2), "\u00D7 2026 \u00B7 asymptote ", t.paradigmCap.toFixed(1), "\u00D7"] }), vm.horizon && _jsxs("div", { className: "tech-sub", children: ["Measured agent benchmark: ", vm.horizon] }), _jsx("div", { className: "sub-head", children: "Pipeline" }), _jsx("div", { className: "pipeline", children: v.pipeline.map((p) => (_jsxs("div", { className: `pipe-stage ${PHASE_ORDER.indexOf(p.stage) <= phaseIdx ? 'reached' : ''} ${p.stage === t.phase ? 'current' : ''}`, children: [_jsx("span", { className: "pipe-dot" }), _jsx("span", { className: "pipe-label", children: p.stage })] }, p.stage))) }), _jsxs("div", { className: "sub-head", children: ["Research velocity \u2014 ", signed(v.growthPctPerYear), "%/yr"] }), _jsxs("div", { className: "metric-row", children: [_jsx("span", { className: "metric-label", children: "Headroom" }), _jsx(Bar, { value: v.headroomPct / 100, color: "#6E7BFF" }), _jsxs("span", { className: "metric-val", children: [v.headroomPct.toFixed(0), "%"] })] }), _jsxs("div", { className: "metric-row", children: [_jsx("span", { className: "metric-label", children: "Maturity" }), _jsx(Bar, { value: t.maturity, color: "#4FC3F7" }), _jsx("span", { className: "metric-val", children: pct(t.maturity) })] }), _jsxs("div", { className: "metric-row", children: [_jsx("span", { className: "metric-label", children: "Reliability" }), _jsx(Bar, { value: t.reliability, color: "#4caf50" }), _jsx("span", { className: "metric-val", children: pct(t.reliability) })] }), _jsxs("div", { className: "metric-row", children: [_jsx("span", { className: "metric-label", children: "Unit cost" }), _jsxs("span", { className: "metric-val", children: [t.cost.toFixed(2), "\u00D7 2026"] })] }), _jsxs("div", { className: "metric-row", children: [_jsx("span", { className: "metric-label", children: "Mfg capacity" }), _jsxs("span", { className: "metric-val", children: [t.mfg.toFixed(2), "\u00D7 2026"] })] }), v.accelerators.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "sub-head", children: "Accelerators" }), v.accelerators.map((a, i) => _jsxs("div", { className: "factor-line accel", children: ["\u25B2 ", a] }, i))] })), v.constraints.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "sub-head", children: "Constraints" }), v.constraints.map((c, i) => _jsxs("div", { className: "factor-line constr", children: ["\u25BC ", c] }, i))] })), _jsxs("div", { className: "bottleneck-line", children: ["Dominant bottleneck: ", _jsx("b", { children: t.bottleneck })] }), _jsx("div", { className: "sub-head", children: "Research programs & inventions" }), vm.programs.length === 0 && vm.inventions.length === 0 && _jsx("div", { className: "uncertainty-note", children: "No major program has yet produced a new paradigm in this domain." }), vm.programs.map((p) => (_jsxs("div", { className: "priority-note", children: [p.title, " \u00B7 ", p.status, " \u00B7 ", pct(Math.min(1, p.status === 'active' ? p.progress : p.maturity))] }, p.id))), vm.inventions.map((i) => (_jsxs("div", { className: "factor-line accel", children: ["\u25C6 ", i.name, " \u00B7 ", i.status] }, i.id))), _jsx("div", { className: "sub-head", children: "Adoption by civilization" }), CIV_IDS.map((id) => (_jsxs("div", { className: "metric-row", children: [_jsx("span", { className: "metric-label", style: { color: CIV_TINT[id] }, children: id }), _jsx(Bar, { value: t.adoption[id].penetration, color: CIV_TINT[id] }), _jsx("span", { className: "metric-val", children: pct(t.adoption[id].penetration) })] }, id))), _jsxs("div", { className: "uncertainty-note", children: ["Forecast confidence: ", v.confidence, " (\u03C3 ", pct(t.uncertainty), "). ", v.uncertaintyNote] }), v.calibration.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "sub-head", children: "Calibration sources" }), v.calibration.map((c, i) => _jsx("div", { className: "calib-line", children: c }, i))] }))] }));
}
function TechnologyTab({ worldRef }) {
    const selectedTech = useUI((s) => s.selectedTech);
    const set = useUI((s) => s.set);
    const domains = Object.entries(DOMAIN_META);
    return (_jsxs("div", { className: "tab-scroll", children: [_jsx("div", { className: "tech-list", children: domains.map(([domain, meta]) => (_jsxs("div", { className: "tech-domain", children: [_jsx("div", { className: "domain-label", style: { color: meta.color }, children: meta.label }), TECH_IDS.filter((id) => TECH_DEFS[id].domain === domain).map((id) => (_jsx("button", { className: `tech-item ${id === selectedTech ? 'active' : ''}`, onClick: () => set({ selectedTech: id }), children: TECH_DEFS[id].name }, id)))] }, domain))) }), _jsx(TechInspector, { worldRef: worldRef, techId: selectedTech })] }));
}
// ── Characters ───────────────────────────────────────────────────────────────
function CharacterView({ worldRef, charId }) {
    const set = useUI((s) => s.set);
    const vmTick = useUI((s) => s.vmTick);
    const [log, setLog] = useState([]);
    const c = worldRef.current.characters.find((x) => x.id === charId);
    // reset conversation when world identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const engineVersion = useUI((s) => s.engineVersion);
    useMemo(() => setLog([]), [engineVersion]);
    if (!c)
        return null;
    return (_jsxs("div", { children: [_jsx("button", { className: "ghost-btn back", onClick: () => set({ selectedCharacter: null }), children: "\u2190 Characters" }), _jsxs("div", { className: "char-head", children: [_jsx("div", { className: "char-name", children: c.name }), _jsxs("div", { className: "char-role", children: [c.role, " \u00B7 ", c.civId, " \u00B7 age ", Math.floor(c.age)] }), _jsxs("div", { className: "char-mood", children: ["mood ", c.mood >= 0 ? '+' : '', c.mood.toFixed(2), " \u00B7 prominence ", pct(c.prominence)] })] }), _jsx("div", { className: "sub-head", children: "Talk" }), _jsx("div", { className: "topic-grid", children: TOPICS.map((t) => (_jsx("button", { className: "topic-btn", onClick: () => {
                        const a = characterReply(worldRef.current, c, t.id);
                        setLog((l) => [...l, { q: t.label, a }]);
                        void vmTick;
                    }, children: t.label }, t.id))) }), _jsx("div", { className: "chat-log", children: log.map((m, i) => (_jsxs("div", { className: "chat-pair", children: [_jsx("div", { className: "chat-q", children: m.q }), _jsx("div", { className: "chat-a", children: m.a })] }, i))) }), _jsx("div", { className: "sub-head", children: "History" }), c.history.slice(-6).reverse().map((h, i) => (_jsx("div", { className: "char-history-line", children: h.text }, i))), c.beliefs.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "sub-head", children: "Beliefs" }), c.beliefs.map((b, i) => _jsxs("div", { className: "char-belief", children: ["\u201C", b, "\u201D"] }, i))] }))] }));
}
function CharactersTab({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const selectedCharacter = useUI((s) => s.selectedCharacter);
    const set = useUI((s) => s.set);
    const chars = [...worldRef.current.characters]
        .sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || b.prominence - a.prominence || (b.retiredAt ?? -1) - (a.retiredAt ?? -1))
        .slice(0, 50);
    void vmTick;
    if (selectedCharacter)
        return _jsx("div", { className: "tab-scroll", children: _jsx(CharacterView, { worldRef: worldRef, charId: selectedCharacter }) });
    return (_jsx("div", { className: "tab-scroll", children: chars.map((c) => (_jsxs("button", { className: "char-item", onClick: () => set({ selectedCharacter: c.id }), children: [_jsx("span", { className: "char-avatar", style: { background: CIV_TINT[c.civId] }, children: c.name.split(' ').map((x) => x[0]).join('') }), _jsxs("span", { className: "char-meta", children: [_jsx("span", { className: "char-item-name", children: c.name }), _jsxs("span", { className: "char-item-role", children: [c.role, " \u00B7 ", c.civId, c.active === false ? ' · deceased' : c.retiredAt != null ? ' · retired' : ''] })] }), _jsx("span", { className: `char-mood-dot ${c.mood > 0.1 ? 'good' : c.mood > -0.3 ? 'warn' : 'bad'}` })] }, c.id))) }));
}
// ── Panel shell ──────────────────────────────────────────────────────────────
function FrontierTab({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const w = worldRef.current;
    const vm = useMemo(() => {
        const fr = w.frontier;
        const r = w.resources;
        return {
            fr, r,
            readiness: w.civs.map((c) => ({ id: c.id, name: c.name, v: c.frontierReadiness, land: c.land.pressure, reclaimed: c.land.reclaimed, floating: c.land.floating, subsea: c.land.subsea, aerial: c.land.aerial, offworld: c.population.offworld, le: c.population.lifeExpectancy })),
            byEra: [1, 2, 3].map((era) => ({ era, label: ERA_LABELS[era], items: MILESTONES.filter((m) => m.era === era).map((m) => ({ def: m, st: fr.milestones.find((x) => x.id === m.id) })) })),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vmTick, worldRef]);
    const tone = (v) => (v >= 0.6 ? 'good' : v >= 0.45 ? 'warn' : 'bad');
    return (_jsxs("div", { className: "tab-scroll", children: [_jsxs("div", { className: "frontier-head", children: [_jsxs("div", { className: "frontier-k", children: ["K = ", vm.fr.kardashev.toFixed(3), " ", _jsxs("span", { className: "muted", children: ["\u00B7 ", vm.fr.energyCaptureTW.toFixed(0), " TW captured"] })] }), _jsx("div", { className: "frontier-era", children: vm.fr.era }), _jsx("div", { className: `frontier-traj traj-${vm.fr.trajectory}`, children: vm.fr.trajectory.replace('_', ' ') }), _jsx("p", { className: "why-body", children: vm.fr.trajectoryNote })] }), _jsx("div", { className: "sub-head", children: "Lived outcomes \u00B7 independent of expansion" }), [['Material security', vm.fr.outcome.materialSecurity], ['Human development', vm.fr.outcome.humanDevelopment], ['Institutions', vm.fr.outcome.institutionalHealth], ['Ecological safety', vm.fr.outcome.ecologicalSafety], ['Distribution', vm.fr.outcome.distribution], ['Resilience', vm.fr.outcome.resilience]].map(([label, v]) => (_jsxs("div", { className: "cause-row", children: [_jsx("span", { className: "cause-factor", children: label }), _jsx(Bar, { value: v, color: v >= 0.7 ? '#3fae6a' : v >= 0.5 ? '#d9a13b' : '#d94b3b' }), _jsx("span", { className: `metric-val tone-${tone(v)}`, children: Math.round(v * 100) })] }, label))), _jsxs("div", { className: "frontier-line muted", children: ["Broad outcome ", Math.round(vm.fr.outcome.broadFlourishing * 100), "/100 \u00B7 development form: ", vm.fr.developmentForm, ". Neither Kardashev level nor habitation domain is counted as wellbeing."] }), _jsx("div", { className: "sub-head", children: "Frontier readiness" }), _jsx("p", { className: "muted small", children: "Frontier research, spaceports, sea reclamation and the milestone programs only run where a civilization is stable, solvent, powered, fed and housed. No preset hands this out." }), vm.readiness.map((c) => (_jsxs("div", { className: "cause-row", children: [_jsx("span", { className: "cause-factor", style: { color: CIV_TINT[c.id] }, children: c.name }), _jsx(Bar, { value: c.v, color: c.v >= 0.6 ? '#3fae6a' : c.v >= 0.45 ? '#d9a13b' : '#d94b3b' }), _jsx("span", { className: `metric-val tone-${tone(c.v)}`, children: pct(c.v) })] }, c.id))), _jsx("div", { className: "sub-head", children: "Land and sea" }), vm.readiness.map((c) => (_jsxs("div", { className: "frontier-line", children: [_jsx("span", { style: { color: CIV_TINT[c.id] }, children: c.name }), ": ", pct(c.land), " of usable land committed", c.reclaimed > 0.0005 ? ` · +${(c.reclaimed * 100).toFixed(1)}% reclaimed from the sea` : '', c.floating > 0.0005 ? ` · floating districts ${(c.floating * 100).toFixed(1)}% of housing` : '', c.subsea > 0.0005 ? ` · under the sea ${(c.subsea * 100).toFixed(1)}%` : '', c.aerial > 0.0002 ? ` · stratosphere ${(c.aerial * 100).toFixed(2)}%` : '', c.offworld > 0.005 ? ` · ${c.offworld.toFixed(2)}M off Earth` : ''] }, c.id))), _jsxs("div", { className: "frontier-line muted", children: ["Sea level +", (w.env.seaLevelM).toFixed(2), " m \u00B7 fossil reserves ", Math.max(0, vm.r.fossilReserves).toFixed(0), " yr \u00B7 mineral cost ", vm.r.mineralCostIndex.toFixed(2), "\u00D7 \u00B7 recycling ", pct(vm.r.recyclingRate), " \u00B7 seabed ", pct(vm.r.mineralSeabedInflow), " \u00B7 space ", pct(vm.r.mineralSpaceInflow), " of 2026 demand"] }), vm.byEra.map((e) => (_jsxs("div", { children: [_jsxs("div", { className: "sub-head", children: ["Era ", e.era, " \u00B7 ", e.label] }), e.items.map(({ def, st }) => (_jsxs("div", { className: `milestone ms-${st.status}`, children: [_jsxs("div", { className: "ms-row", children: [_jsx("span", { className: "ms-dot" }), _jsx("span", { className: "ms-name", children: def.name }), _jsx("span", { className: "ms-status", children: st.status === 'achieved' ? `${Math.floor(2026 + (st.achievedAt ?? 0) / 12)}` : st.status === 'in_progress' ? `${pct(st.progress)}` : st.status === 'available' ? 'ready to fund' : def.illustrativeYear <= 2100 ? `illustrative ~${def.illustrativeYear}` : 'exploratory' })] }), st.status === 'in_progress' && _jsx(Bar, { value: st.progress, color: "#f6c177" }), _jsx("div", { className: "ms-summary", children: def.summary }), st.status !== 'achieved' && st.blockers.length > 0 && (_jsxs("div", { className: "ms-blockers", children: ["Blocked by: ", st.blockers.join('; ')] })), st.status === 'achieved' && _jsx("div", { className: "ms-effect", children: def.effect })] }, def.id)))] }, e.era)))] }));
}
export function RightPanel({ worldRef }) {
    const rightTab = useUI((s) => s.rightTab);
    const rightOpen = useUI((s) => s.rightOpen);
    const set = useUI((s) => s.set);
    if (!rightOpen)
        return null;
    return (_jsxs("div", { className: "right-panel glass-panel s-drawer", children: [_jsxs("div", { className: "panel-head", children: [_jsx("div", { className: "right-tabs", children: ['chronicle', 'technology', 'frontier', 'characters'].map((t) => (_jsx("button", { className: `right-tab ${rightTab === t ? 'active' : ''}`, onClick: () => set({ rightTab: t }), children: t === 'chronicle' ? 'Chronicle' : t === 'technology' ? 'Technology' : t === 'frontier' ? 'Frontier' : 'Characters' }, t))) }), _jsx("button", { className: "ghost-btn", onClick: () => set({ rightOpen: false }), children: "\u25C2" })] }), rightTab === 'chronicle' && _jsx(ChronicleTab, { worldRef: worldRef }), rightTab === 'technology' && _jsx(TechnologyTab, { worldRef: worldRef }), rightTab === 'frontier' && _jsx(FrontierTab, { worldRef: worldRef }), rightTab === 'characters' && _jsx(CharactersTab, { worldRef: worldRef })] }));
}
