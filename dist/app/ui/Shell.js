import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// SHELL — the observer layer around the living world.
// Left: the world at a glance. Right: one civilization, explained. Bottom:
// how to look (perspective, layers, light), how fast to run, and what just
// happened. Every number that could puzzle a player has a "why" behind it.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useUI } from '../state/store.js';
import { engine } from '../state/engine.js';
import { dateLabel, civDef, ageGroups, explainStability, explainReadiness, demographicAnalogue, civHeadline, parseWhatIf, MILESTONES } from '../sim/index.js';
import { CIV_TINT } from './shared.js';
const safeN = (x, fallback = 0) => Number.isFinite(x) ? x : fallback;
const pct = (x, d = 0) => `${(safeN(x) * 100).toFixed(d)}%`;
const fmtM = (millions, d = 1) => {
    const m = Math.max(0, safeN(millions));
    if (m < 0.001)
        return '0M';
    if (m < 1)
        return `${(m * 1000).toFixed(0)}k`;
    if (m < 1000)
        return `${m.toFixed(m < 10 ? Math.max(1, d) : m < 100 ? 1 : 0)}M`;
    if (m < 1e6)
        return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)}B`;
    if (m < 1e9)
        return `${(m / 1e6).toFixed(2)}T`;
    return `${(m / 1e9).toExponential(2)} quadrillion`;
};
const CIV_GLYPH = { veloria: '✦', ardan: '⬢', nemea: '❋' };
function eraHeadline(w) {
    // Geography and substrate are different axes. Digital minds may still run on
    // Earth, so Earth is empty only when nobody is located here at all.
    const earthLocated = w.civs.reduce((a, c) => a + Math.max(0, c.population.total - c.population.offworld), 0);
    if (earthLocated < 0.001 && w.frontier.offworldPopulationM > 0.001)
        return 'Earth is empty. Civilization is not.';
    const y = w.startYear + w.tMonths / 12;
    const t = w.frontier.trajectory;
    if (t === 'extinction')
        return 'The silence after';
    if (t === 'collapse')
        return 'The age of falling';
    if (t === 'crisis')
        return 'The age of strain';
    if (t === 'flourishing')
        return 'The age of broad flourishing';
    if (t === 'ascent')
        return 'The age of reaching';
    if (y < 2040)
        return 'The age of beginnings';
    if (t === 'stagnation')
        return 'The long plateau';
    if (t === 'managed_decline')
        return 'The age of consolidation';
    return w.frontier.era.replace(/ \(.*\)$/, '').replace(/^The /, 'The ');
}
// ── Top navigation ──────────────────────────────────────────────────────────
function TopNav() {
    const panel = useUI((s) => s.panel);
    const set = useUI((s) => s.set);
    const hasBranch = useUI((s) => s.hasBranch);
    const go = (p) => set({ panel: panel === p ? null : p });
    return (_jsxs("div", { className: "s-topnav", children: [_jsxs("div", { className: "s-brand", children: [_jsx("span", { className: "s-brand-what", children: "WHAT IF?" }), _jsx("span", { className: "s-brand-sub", children: "CIVILIZATION LAB" })] }), _jsxs("nav", { className: "s-nav", children: [_jsx("button", { className: `s-nav-item ${panel === null ? 'active' : ''}`, onClick: () => set({ panel: null }), children: "\u25C9 Living World" }), _jsx("button", { className: `s-nav-item ${panel === 'futurelab' ? 'active' : ''}`, onClick: () => go('futurelab'), children: "\u2697 Scenario Lab" }), _jsxs("button", { className: `s-nav-item ${panel === 'branch' ? 'active' : ''}`, onClick: () => go('branch'), children: ["\u2AF6 Parallel Worlds", hasBranch ? ' ·' : ''] })] }), _jsxs("div", { className: "s-nav-right", children: [_jsx("button", { className: "s-icon-btn", title: "Evidence registry: every number's source", onClick: () => go('evidence'), children: "\u25A4" }), _jsx("button", { className: "s-icon-btn", title: "Hide or show the interface (H)", onClick: () => set({ hudVisible: !useUI.getState().hudVisible }), children: "\u25EB" }), _jsx("button", { className: "s-primary-btn", onClick: () => go('futurelab'), children: "+ New world" })] })] }));
}
// ── World observatory (left) ────────────────────────────────────────────────
function Observatory({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const selectedCiv = useUI((s) => s.selectedCiv);
    const set = useUI((s) => s.set);
    const vm = useMemo(() => {
        const w = worldRef.current;
        const pop = w.civs.reduce((a, c) => a + c.population.total, 0);
        const m = w.metrics;
        const ago = m[Math.max(0, m.length - 21)];
        const popAgo = ago ? w.civs.reduce((a, c) => a + ago.population[c.id], 0) : pop;
        const meanStab = w.civs.reduce((a, c) => a + c.society.stability, 0) / w.civs.length;
        return {
            title: w.scenarioLabel, pop, trend: pop - popAgo, meanStab,
            trajectory: w.frontier.trajectory.replace('_', ' '), note: w.frontier.trajectoryNote,
            civs: w.civs.map((c) => ({ id: c.id, name: c.name, epithet: civDef(c.id).epithet, pop: c.population.total, head: civHeadline(c, w.conflicts.some((k) => k.a === c.id || k.b === c.id)), stab: c.society.stability })),
            war: w.conflicts.length > 0, pandemic: !!w.pandemic, drought: !!w.drought,
            sea: w.env.seaLevelM, warm: w.env.warmingC, k: w.frontier.kardashev,
            earthLocated: w.civs.reduce((a, c) => a + Math.max(0, c.population.total - c.population.offworld), 0),
            embodiedEarth: w.civs.reduce((a, c) => a + Math.max(0, c.population.total - c.population.offworld) * (1 - c.population.digitalShare), 0),
            offworld: w.frontier.offworldPopulationM,
            orbital: w.civs.reduce((a, c) => a + Math.max(0, c.population.offworld - c.space.marsPopulationM - c.space.interstellarM), 0),
            mars: w.civs.reduce((a, c) => a + c.space.marsPopulationM, 0), deepSpace: w.civs.reduce((a, c) => a + c.space.interstellarM, 0),
            marsCapacity: w.civs.reduce((a, c) => a + c.space.marsCapacityM, 0), digital: w.frontier.digitalPopulationM, outcome: w.frontier.outcome.broadFlourishing, form: w.frontier.developmentForm,
            habitat: {
                floating: w.civs.reduce((a, c) => a + c.land.floating, 0) / w.civs.length, subsea: w.civs.reduce((a, c) => a + c.land.subsea, 0) / w.civs.length,
                vertical: w.civs.reduce((a, c) => a + c.land.vertical, 0) / w.civs.length, underground: w.civs.reduce((a, c) => a + c.land.underground, 0) / w.civs.length,
                floatingCondition: w.civs.reduce((a, c) => a + c.land.floatingCondition, 0) / w.civs.length, subseaCondition: w.civs.reduce((a, c) => a + c.land.subseaCondition, 0) / w.civs.length,
                verticalCondition: w.civs.reduce((a, c) => a + c.land.verticalCondition, 0) / w.civs.length, undergroundCondition: w.civs.reduce((a, c) => a + c.land.undergroundCondition, 0) / w.civs.length,
            },
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vmTick, worldRef]);
    return (_jsxs("aside", { className: "s-panel s-left", children: [_jsxs("div", { className: "s-kicker", children: ["Civilization observatory ", _jsx("span", { className: "s-live", children: "\u25CF live" })] }), _jsx("h1", { className: "s-world-title", children: vm.title }), _jsx("div", { className: "s-world-sub", children: vm.note || 'An unwritten history.' }), _jsx("div", { className: "s-kicker s-mt", title: "Population of the synthetic three-civilization region; not literal world population", children: "Simulated population" }), _jsxs("div", { className: "s-big", children: [fmtM(vm.pop), _jsx("span", { className: "s-big-unit", children: "people" })] }), _jsxs("div", { className: "s-muted", children: [vm.trend >= 0 ? '+' : '', fmtM(Math.abs(vm.trend)), " in ten years"] }), _jsxs("div", { className: "s-habitat-ledger", title: "Location and substrate are separate. Earth + orbit/cislunar + Mars + deep space equals total population. Digital minds overlap those locations. Built-habitat values are stock indices, not population shares.", children: [_jsxs("div", { className: "s-habitat-title", children: [_jsx("span", { children: "Where civilization exists" }), vm.earthLocated < 0.001 && vm.offworld > 0.001 ? _jsx("b", { children: "EARTH EMPTY" }) : null] }), _jsxs("div", { className: "s-habitat-pop", children: [_jsxs("span", { children: ["Earth ", _jsx("b", { children: fmtM(vm.earthLocated) })] }), _jsxs("span", { children: ["Orbit / cislunar ", _jsx("b", { children: fmtM(vm.orbital) })] }), _jsxs("span", { children: ["Mars ", _jsx("b", { children: fmtM(vm.mars, 2) })] }), _jsxs("span", { children: ["Deep space ", _jsx("b", { children: fmtM(vm.deepSpace, 2) })] })] }), _jsxs("div", { className: "s-habitat-note", children: [_jsxs("b", { children: [fmtM(vm.offworld), " off-world total"] }), " = orbit/cislunar + Mars + deep space. ", _jsx("b", { children: fmtM(vm.embodiedEarth) }), " embodied people remain on Earth."] }), vm.digital > .001 && _jsxs("div", { className: "s-habitat-note", children: [_jsxs("b", { children: [fmtM(vm.digital), " digital minds"] }), " describe substrate, not another location; they are already included in the counts above."] }), vm.marsCapacity > .001 && _jsxs("div", { className: "s-habitat-note", children: [_jsxs("b", { children: ["Mars ", fmtM(vm.mars, 2), " / ", fmtM(vm.marsCapacity, 2), " capacity"] }), ". Empty built capacity stays dark."] }), (vm.habitat.floating + vm.habitat.subsea + vm.habitat.vertical + vm.habitat.underground) > 0.002 && _jsxs("div", { className: "s-habitat-built", children: [_jsx("span", { children: "Built habitat index \u00B7 serviceability" }), _jsxs("i", { title: "Floating district stock index \u00B7 serviceability; index is not a population percentage", children: ["\u2248 sea ", vm.habitat.floating.toFixed(2), "\u00D7 ", _jsxs("b", { children: [Math.round(vm.habitat.floatingCondition * 100), "% live"] })] }), _jsxs("i", { title: "Subsea pressure-hull stock index \u00B7 serviceability; index is not a population percentage", children: ["\u2193 subsea ", vm.habitat.subsea.toFixed(2), "\u00D7 ", _jsxs("b", { children: [Math.round(vm.habitat.subseaCondition * 100), "% live"] })] }), _jsxs("i", { title: "Arcology stock index \u00B7 serviceability; index is not a population percentage", children: ["\u2191 vertical ", vm.habitat.vertical.toFixed(2), "\u00D7 ", _jsxs("b", { children: [Math.round(vm.habitat.verticalCondition * 100), "% live"] })] }), _jsxs("i", { title: "Underground stock index \u00B7 serviceability; index is not a population percentage", children: ["\u21A7 underground ", vm.habitat.underground.toFixed(2), "\u00D7 ", _jsxs("b", { children: [Math.round(vm.habitat.undergroundCondition * 100), "% live"] })] }), (vm.habitat.subsea + vm.habitat.underground) > .003 && _jsx("small", { className: "s-xray-note", children: "Subsurface structures stay physically below terrain and water. Use \u21A7 Below ground, or orbit beneath the surface, to inspect them." }), vm.offworld > .001 && _jsx("small", { className: "s-xray-note", children: "Orbital, Mars and deep-space objects are schematic, not to scale. Use \u25CC Beyond Earth for a clearer frontier view." })] })] }), _jsxs("div", { className: "s-badges", children: [_jsxs("span", { className: `s-badge traj-${vm.trajectory.replace(' ', '-')}`, children: ["\u25D0 ", vm.trajectory] }), _jsxs("span", { className: "s-badge", title: "Broad lived-outcome profile: material security, human development, institutions, ecology, distribution and resilience", children: ["\u25CE outcomes ", Math.round(vm.outcome * 100), "/100"] }), _jsxs("span", { className: "s-badge", title: "Development form is descriptive, not a success ranking", children: ["\u2302 ", vm.form] }), _jsxs("span", { className: "s-badge", children: ["\u25D1 ", pct(vm.meanStab), " stable"] }), _jsxs("span", { className: "s-badge", title: "Warming above pre-industrial and the sea-level rise it commits", children: ["\uD83C\uDF21 ", vm.warm.toFixed(1), " \u00B0C \u00B7 sea +", vm.sea.toFixed(2), " m"] }), _jsxs("span", { className: "s-badge", title: "Kardashev index: captured energy on the Sagan scale (2026 \u2248 0.72, Type I = 1.0)", children: ["K ", vm.k.toFixed(2)] }), vm.war && _jsx("span", { className: "s-badge traj-crisis", children: "\u2694 war" }), vm.pandemic && _jsx("span", { className: "s-badge traj-crisis", children: "\u2623 pandemic" }), vm.drought && _jsx("span", { className: "s-badge traj-managed-decline", children: "\u2600 drought" })] }), _jsxs("div", { className: "s-kicker s-mt", children: ["Civilizations ", _jsx("span", { className: "s-muted-num", children: vm.civs.length })] }), _jsx("div", { className: "s-civ-list", children: vm.civs.map((c) => (_jsxs("button", { className: `s-civ-row ${selectedCiv === c.id ? 'active' : ''}`, onClick: () => set({ selectedCiv: c.id }), children: [_jsx("span", { className: "s-civ-glyph", style: { color: CIV_TINT[c.id] }, children: CIV_GLYPH[c.id] }), _jsxs("span", { className: "s-civ-text", children: [_jsx("span", { className: "s-civ-name", children: c.name }), _jsxs("span", { className: "s-civ-epithet", children: [c.epithet, " \u00B7 ", c.head] })] }), _jsx("span", { className: "s-civ-pop", children: fmtM(c.pop) })] }, c.id))) }), _jsx("button", { className: "s-link", onClick: () => set({ rightOpen: true, rightTab: 'chronicle' }), children: "Open world chronicle \u2192" }), worldRef.current.pendingDecisions.length > 0 && _jsxs("button", { className: "s-link s-pending", onClick: () => { engine.dismissedDecisions.clear(); useUI.getState().setSpeed(0); }, children: [worldRef.current.pendingDecisions.length, " question", worldRef.current.pendingDecisions.length > 1 ? 's' : '', " waiting for you \u2192"] })] }));
}
// ── Stage title (center top) ────────────────────────────────────────────────
function StageTitle({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const speed = useUI((s) => s.speed);
    const vm = useMemo(() => { const w = worldRef.current; const earth = w.civs.reduce((a, c) => a + Math.max(0, c.population.total - c.population.offworld), 0); return { h: eraHeadline(w), date: dateLabel(w), scenario: w.scenarioLabel, era: w.frontier.era, earth, offworld: w.frontier.offworldPopulationM }; }, [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
    return (_jsxs("div", { className: "s-stage", children: [_jsxs("div", { className: "s-kicker s-center", children: ["Living world \u00B7 ", vm.era] }), _jsx("div", { className: "s-stage-title", children: vm.h }), _jsxs("div", { className: "s-stage-sub", children: [vm.date, speed === 0 ? ' · paused · take a moment to look around' : '', vm.earth < .001 && vm.offworld > .001 ? ` · ${vm.offworld.toFixed(1)}M people continue beyond Earth` : ''] })] }));
}
function Meter({ label, value, text, tone, why }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: `s-meter ${why ? 'has-why' : ''}`, onClick: () => why && setOpen(!open), children: [_jsxs("div", { className: "s-meter-row", children: [_jsx("span", { children: label }), _jsxs("span", { className: `s-meter-val tone-${tone ?? 'none'}`, children: [text ?? pct(value), why ? _jsx("span", { className: "s-why-dot", title: "Click: why?", children: " ?" }) : null] })] }), _jsx("div", { className: "s-meter-bar", children: _jsx("span", { className: `s-meter-fill tone-${tone ?? 'none'}`, style: { width: `${Math.min(100, Math.max(0, value * 100))}%` } }) }), open && why && _jsx("div", { className: "s-why", children: why })] }));
}
function Fact({ label, value, sub }) {
    return _jsxs("div", { className: "s-fact", children: [_jsx("div", { className: "s-fact-label", children: label }), _jsx("div", { className: "s-fact-value", children: value }), sub && _jsx("div", { className: "s-fact-sub", children: sub })] });
}
function toneOf(v, good, warn, invert = false) {
    const x = invert ? -v : v;
    return x >= (invert ? -good : good) ? 'good' : x >= (invert ? -warn : warn) ? 'warn' : 'bad';
}
function CivCard({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const selectedCiv = useUI((s) => s.selectedCiv);
    const set = useUI((s) => s.set);
    const [tab, setTab] = useState('overview');
    const w = worldRef.current;
    const c = useMemo(() => w.civs.find((x) => x.id === selectedCiv), [vmTick, selectedCiv, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
    const def = civDef(c.id);
    const settlements = 2; // fixed geography: two cities per civilization in this region
    const stab = explainStability(c);
    const ready = explainReadiness(c);
    const m = w.metrics;
    const ago = m[Math.max(0, m.length - 3)];
    const popTrend = ago ? c.population.total - ago.population[c.id] : 0;
    const foodCover = Math.min(1, c.food.selfSufficiency + c.food.importShare);
    const achieved = w.frontier.milestones.filter((x) => x.status === 'achieved').length;
    const projects = w.projects.filter((p) => p.civId === c.id && !['operational', 'cancelled'].includes(p.status));
    const margin = c.energy.marginPct;
    return (_jsxs("aside", { className: "s-panel s-right", children: [_jsx("div", { className: "s-kicker", children: "Civilization" }), _jsxs("div", { className: "s-civ-head", children: [_jsx("span", { className: "s-civ-glyph big", style: { color: CIV_TINT[c.id] }, children: CIV_GLYPH[c.id] }), _jsxs("div", { children: [_jsx("div", { className: "s-civ-title", children: c.name }), _jsxs("div", { className: "s-civ-epithet", children: [def.epithet, " \u00B7 ", civHeadline(c, w.conflicts.some((k) => k.a === c.id || k.b === c.id))] })] })] }), _jsx("div", { className: "s-tabs", children: ['overview', 'people', 'economy', 'frontier'].map((t) => _jsx("button", { className: `s-tab ${tab === t ? 'active' : ''}`, onClick: () => setTab(t), children: t[0].toUpperCase() + t.slice(1) }, t)) }), tab === 'overview' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "s-facts", children: [_jsx(Fact, { label: "Population", value: `${c.population.total.toFixed(1)}M`, sub: `${popTrend >= 0 ? '+' : ''}${popTrend.toFixed(2)}M this year` }), _jsx(Fact, { label: "Settlements", value: `${settlements}`, sub: `${c.population.urbanization > 0.7 ? 'urban' : 'mixed'} · ${pct(c.population.urbanization)} in cities` })] }), _jsx(Meter, { label: "Food security", value: foodCover, tone: toneOf(foodCover, 0.98, 0.9), text: pct(foodCover) }), _jsx(Meter, { label: "Stability", value: c.society.stability, tone: toneOf(c.society.stability, 0.6, 0.4), why: _jsxs(_Fragment, { children: [stab.factors.map((f) => _jsxs("div", { className: "s-why-row", children: [_jsxs("span", { children: [f.label, f.note ? _jsxs("em", { children: [" \u00B7 ", f.note] }) : null] }), _jsxs("b", { className: f.value < 0 ? 'neg' : 'pos', children: [f.value >= 0 ? '+' : '', (f.value * 100).toFixed(0)] })] }, f.label)), _jsxs("div", { className: "s-why-foot", children: ["Stability drifts toward the sum (", pct(Math.min(0.96, Math.max(0.05, stab.target))), ") over a few years. Trust rises with fed, employed, housed people and falls with backlash."] })] }) }), _jsx(Meter, { label: "Social trust", value: c.society.trust, tone: toneOf(c.society.trust, 0.55, 0.4) }), _jsx(Meter, { label: "Grid reserve", value: Math.min(1, Math.max(0, (margin + 10) / 40)), text: `${margin > 200 ? '>200' : margin.toFixed(0)}%`, tone: margin < 0 ? 'bad' : margin < 8 ? 'warn' : margin > 60 ? 'warn' : 'good', why: _jsxs("div", { className: "s-why-foot", children: ["Reserve = (deliverable supply \u2212 demand) / demand. 10\u201325% is healthy. Below 0 means load shedding. Far above 40% means idle plants nobody pays for: the fleet mothballs fuel plants until the surplus is gone. Served ", pct(c.energy.servedTWh / Math.max(1, c.energy.demandTWh)), " of demand at ", c.energy.priceIndex.toFixed(2), "\u00D7 the 2026 price."] }) }), _jsx(Meter, { label: "Land committed", value: Math.min(1, c.land.pressure), text: pct(c.land.pressure), tone: toneOf(c.land.pressure, 0.85, 0.95, true), why: _jsxs("div", { className: "s-why-foot", children: ["Cities ", pct(c.land.urban), " \u00B7 farms ", pct(c.land.farm), " \u00B7 energy ", pct(c.land.energy), " of 2026 land. Density ", c.land.densityIndex.toFixed(2), "\u00D7.", c.land.reclaimed > 0 ? ` Reclaimed from the sea +${(c.land.reclaimed * 100).toFixed(1)}% (dikes ${pct(c.land.reclaimedCondition)}).` : '', c.land.floating > 0 ? ` Floating districts ${(c.land.floating * 100).toFixed(1)}% of housing.` : '', " Most societies expand into sea or orbit only when pressure justifies it; marine-first scenarios can choose that form earlier, but they still pay its engineering and maintenance costs."] }) }), _jsxs("div", { className: "s-priority", children: [_jsx("div", { className: "s-kicker", children: "Current priority" }), _jsx("div", { children: c.strategicPriority || 'Keep the lights on and the people fed.' }), projects.length > 0 && _jsxs("div", { className: "s-muted", children: [projects.length, " projects under way: ", [...new Set(projects.map((p) => p.kind.replace('_', ' ')))].slice(0, 4).join(', ')] })] })] })), tab === 'people' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "s-facts", children: [_jsx(Fact, { label: "Median age", value: `${c.population.medianAge.toFixed(0)}`, sub: demographicAnalogue(c) }), _jsx(Fact, { label: "Fertility", value: c.population.fertility.toFixed(2), sub: `births ${(c.population.birthRate * 1000).toFixed(1)} · deaths ${(c.population.deathRate * 1000).toFixed(1)} per 1,000${c.society.syntheticProgram !== 'none' && c.society.syntheticProgram !== 'ban' ? ` · +${c.society.syntheticBirthsPerYear.toFixed(2)}M/yr synthetic (${c.society.syntheticProgram})` : ''}${c.society.revivalMonths > 0 ? ' · pro-natal movement' : ''}` }), _jsx(Fact, { label: "Life expectancy", value: `${c.population.lifeExpectancy.toFixed(0)}`, sub: c.population.lifeExpectancy > 95 ? 'longevity therapies in use: longer working lives, more births' : 'rises with wealth and medicine; longevity therapies later' }), _jsx(Fact, { label: "Education", value: pct(Math.min(1, c.population.education)), sub: `working-age share ${pct(c.population.workingShare)}` })] }), _jsx("div", { className: "s-kicker", children: "Age structure" }), _jsx("div", { className: "s-pyramid", children: ageGroups(c.population).map((g, i) => _jsxs("div", { className: "s-pyr-col", title: ['0–14', '15–39', '40–64', '65–84', '85+'][i], children: [_jsx("div", { className: "s-pyr-bar", style: { height: `${Math.max(2, g * 160)}px` } }), _jsx("span", { children: ['0–14', '15–39', '40–64', '65–84', '85+'][i] }), _jsx("b", { children: pct(g) })] }, i)) }), _jsx("div", { className: "s-why-foot", children: "Population moves by births in the fertile bands, deaths by age, and one band of aging every five years. A young pyramid keeps growing after fertility falls; an old one keeps shrinking after it recovers. Longevity therapies slow aging past 40 and move retirement later." }), _jsx(Meter, { label: "Inequality (Gini)", value: c.economy.gini, text: c.economy.gini.toFixed(2), tone: toneOf(c.economy.gini, 0.36, 0.45, true), why: _jsx("div", { className: "s-why-foot", children: "2026 analogues: Nordics 0.27, Germany 0.31, US 0.41, Brazil 0.53. Automation and joblessness push it up; an income floor, retraining, education and institutions pull it down. Above 0.40 it costs stability and trust; above 0.45 it lowers births." }) }), _jsx(Meter, { label: "Unemployment", value: Math.min(1, c.economy.unemployment * 4), text: pct(c.economy.unemployment, 1), tone: toneOf(c.economy.unemployment, 0.06, 0.09, true), why: _jsxs("div", { className: "s-why-foot", children: ["Labor relevance ", pct(c.society.laborRelevance), ": how much a job still decides a person's income. With an income floor of ", pct(c.society.basicProvision), " joblessness hurts less."] }) }), _jsx(Meter, { label: "Income floor", value: c.society.basicProvision, tone: c.society.basicProvision > 0.4 ? 'good' : 'none', why: _jsx("div", { className: "s-why-foot", children: "Universal income and services adopted when automation displaces work and the society can afford it (or when you order it under Shape their future)." }) }), _jsx(Meter, { label: "Housing crowding", value: c.housing.crowding, tone: toneOf(c.housing.crowding, 0.05, 0.15, true), text: `${pct(c.housing.crowding)} · rent ${c.housing.rentIndex.toFixed(2)}×` }), _jsx(Meter, { label: "Derelict housing", value: c.housing.abandoned, tone: toneOf(c.housing.abandoned, 0.05, 0.18, true), why: _jsx("div", { className: "s-why-foot", children: "Homes nobody lives in and nobody maintains. Rises when people leave; cleared by solvent institutions; rebuilt on before new land is taken." }) })] })), tab === 'economy' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "s-facts", children: [_jsx(Fact, { label: "Output", value: `${c.economy.output.toFixed(2)}×`, sub: `per person ${c.economy.outputPerCapita.toFixed(2)}× 2026` }), _jsx(Fact, { label: "Public debt", value: pct(c.economy.publicDebt), sub: "of output \u00B7 above 220% the frontier is unaffordable" }), _jsx(Fact, { label: "Electricity price", value: `${c.energy.priceIndex.toFixed(2)}×`, sub: `${c.energy.demandTWh.toFixed(0)} TWh/yr demand` }), _jsx(Fact, { label: "Material cost", value: `${c.economy.materialCostIndex.toFixed(2)}×`, sub: `minerals ${w.resources.mineralCostIndex.toFixed(2)}× · fuel ${w.resources.fossilCostIndex.toFixed(2)}×` }), _jsx(Fact, { label: "Institutions", value: pct(c.economy.institutionalCapacity), sub: "execution capacity: projects finish on time when high" }), _jsx(Fact, { label: "Research base", value: c.researchCapacity.toFixed(2), sub: `priority: ${c.strategicPriority || 'balanced'}` })] }), _jsx("div", { className: "s-kicker s-mt", children: "Projects under way" }), projects.length === 0 && _jsx("div", { className: "s-muted", children: "None. Investment is going to maintenance." }), projects.slice(0, 6).map((p) => _jsxs("div", { className: "s-proj", children: [_jsx("span", { children: p.kind.replace('_', ' ') }), _jsxs("span", { className: "s-muted", children: [Math.max(0, p.monthsRemaining).toFixed(0), " mo"] })] }, p.id))] })), tab === 'frontier' && (_jsxs(_Fragment, { children: [_jsx(Meter, { label: "Frontier readiness", value: c.frontierReadiness, tone: toneOf(c.frontierReadiness, 0.6, 0.45), why: _jsxs(_Fragment, { children: [ready.map((f) => _jsxs("div", { className: "s-why-row", children: [_jsxs("span", { children: [f.label, f.note ? _jsxs("em", { children: [" \u00B7 ", f.note] }) : null] }), _jsx("b", { children: pct(f.value) })] }, f.label)), _jsx("div", { className: "s-why-foot", children: "Spaceports, reclamation, habitats and every long program only run where this is earned. No scenario hands it out." })] }) }), _jsxs("div", { className: "s-facts", children: [_jsx(Fact, { label: "Off Earth", value: `${c.population.offworld.toFixed(2)}M`, sub: c.space.spaceportCapacity > 0.05 ? `launch cost ${(c.space.launchCostIndex * 100).toFixed(0)}% of 2026${c.space.elevator ? ' · elevator' : ''}` : 'no spaceport yet' }), _jsx(Fact, { label: "From the sea", value: `+${(c.land.reclaimed * 100).toFixed(1)}%`, sub: `floating ${(c.land.floating * 100).toFixed(1)}% @ ${pct(c.land.floatingCondition)} condition · subsea ${(c.land.subsea * 100).toFixed(1)}% @ ${pct(c.land.subseaCondition)}${c.land.aerial > 0 ? ` · stratosphere ${(c.land.aerial * 100).toFixed(2)}%` : ''}` }), _jsx(Fact, { label: "Vertical / below ground", value: `${(c.land.vertical * 100).toFixed(1)}% / ${(c.land.underground * 100).toFixed(1)}%`, sub: `condition ${pct(c.land.verticalCondition)} / ${pct(c.land.undergroundCondition)}` }), _jsx(Fact, { label: "Fusion", value: `${c.energy.sources.fusion.cap.toFixed(1)} GW`, sub: `nuclear ${c.energy.sources.nuclear.cap.toFixed(1)} · solar ${c.energy.sources.solar.cap.toFixed(0)} · wind ${c.energy.sources.wind.cap.toFixed(0)} GW` }), _jsx(Fact, { label: "Milestones", value: `${achieved}/${MILESTONES.length}`, sub: w.frontier.era })] }), _jsx("button", { className: "s-link", onClick: () => set({ rightOpen: true, rightTab: 'frontier' }), children: "Open the milestone ladder \u2192" })] })), _jsx("button", { className: "s-primary-btn s-full", onClick: () => set({ panel: 'interventions' }), children: "Shape their future \u2192" })] }));
}
// ── Dock: perspective, layers, light, time ─────────────────────────────────
const CAMS = [
    { m: 'orbit', icon: '◎', label: 'Orbit' }, { m: 'strategic', icon: '◇', label: 'Strategic' }, { m: 'city', icon: '⌂', label: 'City' }, { m: 'subsurface', icon: '↧', label: 'Below ground' }, { m: 'space', icon: '◌', label: 'Beyond Earth' }, { m: 'follow', icon: '➔', label: 'Follow' }, { m: 'cinematic', icon: '◠', label: 'Cinematic' },
];
const LAYERS = [{ o: 'none', label: 'Natural' }, { o: 'energy', label: 'Energy' }, { o: 'adoption', label: 'Automation' }, { o: 'compute', label: 'Compute' }];
const LIGHTS = [{ l: 'cycle', label: 'Cycle' }, { l: 'day', label: 'Day' }, { l: 'dusk', label: 'Dusk' }, { l: 'night', label: 'Night' }];
const SPEEDS = [{ s: 1, label: '1×' }, { s: 5, label: '5×' }, { s: 20, label: '20×' }, { s: 100, label: '100×' }];
function Dock({ worldRef }) {
    const cameraMode = useUI((s) => s.cameraMode);
    const overlay = useUI((s) => s.overlay);
    const lighting = useUI((s) => s.lighting);
    const speed = useUI((s) => s.speed);
    const setSpeed = useUI((s) => s.setSpeed);
    const set = useUI((s) => s.set);
    const vmTick = useUI((s) => s.vmTick);
    const selectedCiv = useUI((s) => s.selectedCiv);
    const info = useMemo(() => { const w = worldRef.current; return { year: Math.floor(w.startYear + w.tMonths / 12), budget: Math.round(w.observerBudget) }; }, [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
    return (_jsxs("div", { className: "s-dock", children: [_jsxs("div", { className: "s-dock-row", children: [_jsx("span", { className: "s-kicker", children: "Perspective" }), _jsx("div", { className: "s-seg", children: CAMS.map((c) => _jsx("button", { className: `s-seg-btn ${cameraMode === c.m ? 'active' : ''}`, title: c.label, onClick: () => set({ cameraMode: c.m }), children: c.icon }, c.m)) })] }), _jsxs("div", { className: "s-dock-row", children: [_jsx("span", { className: "s-kicker", children: "Map layers" }), _jsx("div", { className: "s-seg text", children: LAYERS.map((l) => _jsx("button", { className: `s-seg-btn ${overlay === l.o ? 'active' : ''}`, onClick: () => set({ overlay: l.o }), children: l.label }, l.o)) }), _jsx("span", { className: "s-kicker", children: "Ask" }), _jsxs("div", { className: "s-seg text", children: [_jsx("button", { className: `s-seg-btn ${useUI.getState().askMode === 'turning-points' ? 'active' : ''}`, onClick: () => useUI.getState().setAskMode('turning-points'), title: "Stop the clock at turning points and ask", children: "Turning points" }), _jsx("button", { className: `s-seg-btn ${useUI.getState().askMode === 'never' ? 'active' : ''}`, onClick: () => useUI.getState().setAskMode('never'), title: "Never ask; civilizations decide in character", children: "Never" })] }), _jsx("span", { className: "s-kicker", children: "Light" }), _jsx("div", { className: "s-seg text", children: LIGHTS.map((l) => _jsx("button", { className: `s-seg-btn ${lighting === l.l ? 'active' : ''}`, onClick: () => set({ lighting: l.l }), children: l.label }, l.l)) })] }), _jsxs("div", { className: "s-timeline", children: [_jsx("button", { className: `s-play ${speed === 0 ? '' : 'running'}`, onClick: () => setSpeed(speed === 0 ? 1 : 0), title: "Play / pause (space)", children: speed === 0 ? '▶' : '❚❚' }), _jsx("span", { className: "s-kicker", children: "Year" }), _jsx("span", { className: "s-year", children: info.year }), _jsx("div", { className: "s-seg text", children: SPEEDS.map((s) => _jsx("button", { className: `s-seg-btn ${speed === s.s ? 'active' : ''}`, onClick: () => setSpeed(s.s), children: s.label }, s.s)) }), _jsxs("span", { className: "s-influence", title: "Observer intervention budget; no passive effect. Replenishes 6 points per simulated year.", children: ["\u25C8 ", info.budget, "/100 ", _jsx("small", { children: "intervention" })] })] })] }));
}
// ── Chronicle strip + ask box ───────────────────────────────────────────────
function ChronicleStrip({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const set = useUI((s) => s.set);
    const [q, setQ] = useState('');
    const events = useMemo(() => [...worldRef.current.chronicle].reverse().filter((e) => e.significance >= 2).slice(0, 3), [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
    const parsed = q.trim().length >= 4 ? parseWhatIf(q) : null;
    const ask = () => {
        if (!parsed || !parsed.ok) {
            set({ panel: 'futurelab' });
            return;
        }
        engine.newScenario(`whatif-${Date.now()}`, parsed.delta, parsed.label);
        set({ panel: null, started: true });
        setQ('');
    };
    return (_jsxs("div", { className: "s-strip", children: [_jsxs("div", { className: "s-strip-events", children: [_jsx("div", { className: "s-kicker", children: "World chronicle" }), _jsxs("div", { className: "s-events", children: [events.length === 0 && _jsxs("div", { className: "s-event", children: [_jsx("div", { className: "s-event-title", children: "History, unfolding." }), _jsx("div", { className: "s-muted", children: "Press play. You set the conditions; they make the history." })] }), events.map((e) => (_jsxs("button", { className: "s-event", onClick: () => set({ rightOpen: true, rightTab: 'chronicle', selectedEventId: e.id }), children: [_jsxs("div", { className: "s-event-year", children: [e.year, e.civId ? ` · ${e.civId}` : ''] }), _jsx("div", { className: "s-event-title", children: e.title })] }, e.id)))] })] }), _jsxs("div", { className: "s-ask", children: [_jsx("input", { value: q, onChange: (e) => setQ(e.target.value), onKeyDown: (e) => e.key === 'Enter' && ask(), placeholder: "Ask what if\u2026 (e.g. what if fusion works by 2045, what if the island runs out of land)" }), _jsx("button", { className: "s-primary-btn", onClick: ask, children: parsed?.ok ? `Run: ${parsed.label}` : 'Scenario Lab' }), parsed && _jsx("div", { className: "s-ask-hint", children: parsed.ok ? parsed.explanation : 'Not understood yet. Open the Scenario Lab to build it by hand.' })] })] }));
}
// ── Decisions: the world stops and asks ─────────────────────────────────────
function DecisionModal({ worldRef }) {
    const vmTick = useUI((s) => s.vmTick);
    const setSpeed = useUI((s) => s.setSpeed);
    const set = useUI((s) => s.set);
    const pending = useMemo(() => worldRef.current.pendingDecisions.find((p) => !engine.dismissedDecisions.has(p.key)), [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
    const [picked, setPicked] = useState(null);
    if (!pending)
        return null;
    const w = worldRef.current;
    const civ = w.civs.find((c) => c.id === pending.civId);
    const yearsLeft = Math.max(0, (pending.deadline - w.tMonths) / 12);
    const siblings = w.pendingDecisions.filter((p) => p.defId === pending.defId && !engine.dismissedDecisions.has(p.key));
    const choose = (id, all = false) => { for (const p of all ? siblings : [pending])
        engine.decide(p.key, id); setPicked(null); set({ selectedCiv: civ.id }); setSpeed(1); };
    const later = () => { engine.dismissDecision(pending.key); setSpeed(1); };
    return (_jsx("div", { className: "s-decision-backdrop", children: _jsxs("div", { className: "s-decision", children: [_jsxs("div", { className: "s-kicker", children: [_jsxs("span", { style: { color: CIV_TINT[civ.id] }, children: [CIV_GLYPH[civ.id], " ", civ.name] }), " asks \u00B7 ", Math.floor(w.startYear + w.tMonths / 12)] }), _jsx("div", { className: "s-decision-title", children: pending.title }), _jsx("p", { className: "s-decision-q", children: pending.question }), _jsx("div", { className: "s-decision-options", children: pending.options.map((o) => (_jsxs("button", { className: `s-option ${picked === o.id ? 'active' : ''}`, onClick: () => setPicked(o.id), children: [_jsx("div", { className: "s-option-label", children: o.label }), _jsx("div", { className: "s-option-cons", children: o.consequence })] }, o.id))) }), _jsxs("div", { className: "s-decision-actions", children: [_jsx("button", { className: "s-primary-btn", disabled: !picked, onClick: () => choose(picked), children: "Decide" }), siblings.length > 1 && _jsxs("button", { className: "s-primary-btn", disabled: !picked, onClick: () => choose(picked, true), title: "The same question is open for other civilizations", children: ["Decide for all ", siblings.length] }), _jsx("button", { className: "s-ghost-btn", onClick: () => choose(null), title: "The civilization chooses in character, by its traits", children: "Let them decide" }), _jsxs("button", { className: "s-ghost-btn", onClick: later, title: `Resume without answering; they decide themselves in ${yearsLeft.toFixed(1)} years`, children: ["Later (", yearsLeft.toFixed(1), " yrs)"] }), _jsx("button", { className: "s-ghost-btn", onClick: () => { useUI.getState().setAskMode('never'); choose(null); }, title: "Never stop the clock again; every decision resolves in character", children: "Stop asking" })] }), _jsx("div", { className: "s-muted", children: "Decisions change policy, spending, research or the scenario itself, through the same channels the civilizations use. Everything after this point is a different history. Branch first (Parallel Worlds) if you want to compare." })] }) }));
}
export function Shell({ worldRef }) {
    const hud = useUI((s) => s.hudVisible);
    // Keyboard: space play/pause, 1–4 speeds, H hide interface, N night, D day, C cycle, Esc closes panels.
    useEffect(() => {
        const onKey = (e) => {
            if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA')
                return;
            const st = useUI.getState();
            if (e.code === 'Space') {
                e.preventDefault();
                st.setSpeed(st.speed === 0 ? 1 : 0);
            }
            else if (e.key === '1')
                st.setSpeed(1);
            else if (e.key === '2')
                st.setSpeed(5);
            else if (e.key === '3')
                st.setSpeed(20);
            else if (e.key === '4')
                st.setSpeed(100);
            else if (e.key === 'h' || e.key === 'H')
                st.set({ hudVisible: !st.hudVisible });
            else if (e.key === 'n' || e.key === 'N')
                st.set({ lighting: 'night' });
            else if (e.key === 'd' || e.key === 'D')
                st.set({ lighting: 'day' });
            else if (e.key === 'c' || e.key === 'C')
                st.set({ lighting: 'cycle' });
            else if (e.key === 'Escape')
                st.set({ panel: null, rightOpen: false });
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    return (_jsxs("div", { className: `s-shell ${hud ? '' : 'hidden'}`, children: [_jsx(TopNav, {}), _jsx(Observatory, { worldRef: worldRef }), _jsx(StageTitle, { worldRef: worldRef }), _jsx(CivCard, { worldRef: worldRef }), _jsx(Dock, { worldRef: worldRef }), _jsx(ChronicleStrip, { worldRef: worldRef }), _jsx(DecisionModal, { worldRef: worldRef })] }));
}
