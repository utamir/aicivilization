import { civDef } from './data/civDefs.js';
/** Contributions to the stability target (sum ≈ target before clamping). */
export function explainStability(c) {
    const s = c.society, e = c.economy;
    const jobless = e.unemployment * s.laborRelevance;
    const energyStress = Math.max(0, -c.energy.marginPct / 25) * 0.6 + Math.max(0, c.energy.priceIndex - 1.5) * 0.3;
    const f = [
        { label: 'Baseline', value: 0.48 },
        { label: 'Social trust', value: s.trust * 0.42, note: `${(s.trust * 100).toFixed(0)}% trust` },
        { label: 'Backlash against change', value: -s.backlash * 0.28, note: `${(s.backlash * 100).toFixed(0)}%` },
        { label: 'Joblessness that still matters', value: -Math.max(0, jobless - 0.11) * 0.9, note: `${(e.unemployment * 100).toFixed(0)}% unemployed × ${(s.laborRelevance * 100).toFixed(0)}% labor relevance` },
        { label: 'Inequality', value: -Math.max(0, e.gini - 0.40) * 0.7, note: `Gini ${e.gini.toFixed(2)} (2026 analogues: Nordics 0.27, US 0.41, Brazil 0.53)` },
        { label: 'Energy stress', value: -Math.min(1, energyStress) * 0.34, note: `${c.energy.marginPct.toFixed(0)}% margin · ${c.energy.priceIndex.toFixed(2)}× price` },
        { label: 'Food shortage', value: -c.food.shortage * 0.38, note: `${(c.food.shortage * 100).toFixed(0)}% unmet` },
        { label: 'Housing crowding', value: -c.housing.crowding * 0.10 },
        { label: 'Unmanaged waste', value: -c.waste.accumulation * 0.08 },
        { label: 'Derelict districts', value: -c.housing.abandoned * 0.12 },
    ];
    return { target: f.reduce((a, x) => a + x.value, 0), factors: f };
}
/** Contributions to frontier readiness (weights as in computeFrontierReadiness). */
export function explainReadiness(c) {
    const s = c.society, e = c.economy;
    const clamp01 = (x) => Math.min(1, Math.max(0, x));
    return [
        { label: 'Political stability', value: clamp01((s.stability - 0.3) / 0.5), note: 'weight 20%' },
        { label: 'Institutions', value: clamp01((e.institutionalCapacity - 0.3) / 0.5), note: 'weight 16%' },
        { label: 'Public finances', value: clamp01((2.2 - e.publicDebt) / 1.4), note: `debt ${(e.publicDebt * 100).toFixed(0)}% of output · weight 14%` },
        { label: 'Energy surplus', value: clamp01((c.energy.marginPct + 5) / 20) * Math.min(1, Math.max(0.3, 1.6 - c.energy.priceIndex)), note: 'weight 14%' },
        { label: 'Everyone fed', value: 1 - clamp01(c.food.shortage * 8), note: 'weight 10%' },
        { label: 'Everyone housed', value: clamp01(1 - c.housing.crowding * 2.5 - c.housing.abandoned * 1.5), note: 'weight 8%' },
        { label: 'Research base', value: clamp01(c.researchCapacity / 1.2) * (0.5 + c.population.education * 0.5), note: 'weight 10%' },
        { label: 'Legitimacy', value: clamp01(1 - s.backlash * 1.2 - Math.max(0, e.unemployment * s.laborRelevance - 0.1) * 3), note: 'weight 8%' },
    ];
}
/** Real-world 2026 reference points for the demographic starting values. */
export function demographicAnalogue(c) {
    const d = civDef(c.id);
    const age = d.population.medianAge;
    const ref = age >= 42 ? 'Germany 46, Japan 49' : age >= 36 ? 'United States 38, China 39' : 'Mexico 29, India 28';
    return `2026 median age ${age}, fertility ${d.population.fertility.toFixed(2)} (compare: ${ref}). Change under Scenario Lab → Demographics.`;
}
/** One-line reading of the civilization's current condition for the card header. */
export function civHeadline(c, atWar = false) {
    if (atWar)
        return 'At war';
    if (c.population.total < civDef(c.id).population.total * 0.01)
        return 'No longer exists as a civilization';
    if (c.food.shortage > 0.15)
        return 'Famine';
    if (c.society.fragmented)
        return 'Fragmented';
    if (c.society.lockdown > 0)
        return 'Pandemic';
    if (c.society.stability < 0.2)
        return 'State failure';
    if (c.energy.marginPct < -15)
        return 'Rolling blackouts';
    if (c.society.stability < 0.4)
        return 'Unrest';
    if (c.land.pressure > 0.95 && c.housing.crowding > 0.1)
        return 'Out of land';
    if (c.frontierReadiness >= 0.7)
        return 'Stable and expanding';
    if (c.frontierReadiness >= 0.5)
        return 'Stable';
    return 'Under strain';
}
