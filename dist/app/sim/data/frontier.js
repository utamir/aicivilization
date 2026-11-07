export const ERA_LABELS = {
    1: 'The Earth-Bound Century',
    2: 'The Interplanetary Era',
    3: 'The Deep-Future Era',
};
const has = (w, id) => w.frontier.milestones.find((m) => m.id === id)?.status === 'achieved';
const deployed = (w, invId) => w.inventions.some((i) => i.id.startsWith(`inv-${invId}-`) && i.status === 'deployed');
const anyCiv = (w, fn) => w.civs.some(fn);
const worldOutput = (w) => w.civs.reduce((a, c) => a + c.economy.output, 0);
export const MILESTONES = [
    // ── Era 1: 2026–2100 ────────────────────────────────────────────────────
    {
        id: 'agi', name: 'Artificial general intelligence', era: 1, illustrativeYear: 2035, kind: 'threshold',
        summary: 'General-purpose autonomous systems operate across most cognitive domains with high reliability. This is a model-defined regime, not a dated AGI forecast.',
        requires: ['frontier model capability ≥ 5× 2026', 'agent capability ≥ 5× 2026', 'AI reliability ≥ 75%'],
        check: (w) => {
            const out = [];
            if (w.techs.ai_models.cap < 5)
                out.push(`model capability ${w.techs.ai_models.cap.toFixed(1)}× (<5×)`);
            if (w.techs.ai_agents.cap < 5)
                out.push(`agent capability ${w.techs.ai_agents.cap.toFixed(1)}× (<5×)`);
            if (Math.min(w.techs.ai_models.reliability, w.techs.ai_agents.reliability) < 0.75)
                out.push('AI reliability below 75%');
            return out;
        },
        effect: 'Research tooling multiplier rises for every domain; automation exposure jumps; societies must decide how income reaches people who no longer work.',
    },
    {
        id: 'aging_reversal', name: 'Cellular aging reversal in clinical use', era: 1, illustrativeYear: 2045, kind: 'threshold',
        summary: 'Validated therapies clear senescent cells and partially reprogram tissues; healthy lifespan extends by decades.',
        requires: ['partial cellular reprogramming deployed', 'longevity therapies reaching ≥25% of a population'],
        check: (w) => {
            const out = [];
            if (!deployed(w, 'partial-reprogramming'))
                out.push('partial cellular reprogramming not yet validated');
            if (!anyCiv(w, (c) => w.techs.longevity_bio.adoption[c.id].penetration >= 0.25))
                out.push('therapies not yet widely adopted');
            return out;
        },
        effect: 'Death rates fall, working lives lengthen, population decline slows or reverses.',
    },
    {
        id: 'coastal_expansion', name: 'Cities take to the sea', era: 1, illustrativeYear: 2065, kind: 'threshold',
        summary: 'A civilization that ran out of land has added a tenth of its territory from the sea: reclaimed shelf and floating districts.',
        requires: ['reclaimed land + floating districts ≥ 10% of a civilization\'s 2026 land', 'floating-platform technology deployed'],
        check: (w) => {
            const out = [];
            if (!deployed(w, 'modular-floating-platforms'))
                out.push('floating-platform technology not validated');
            const best = Math.max(...w.civs.map((c) => c.land.reclaimed + c.land.floating * 0.3));
            if (best < 0.10)
                out.push(`best civilization has added ${(best * 100).toFixed(1)}% of its land (<10%)`);
            return out;
        },
        effect: 'Living space stops being the binding constraint on population; offshore energy and seabed minerals follow the platforms out to sea.',
    },
    {
        id: 'fusion_commercial', name: 'First commercial fusion plant', era: 1, illustrativeYear: 2050, kind: 'threshold',
        summary: 'A grid-connected fusion plant sells electricity at a price a utility will pay.',
        requires: ['net-electricity fusion pilot deployed', 'a fusion project completed by any civilization'],
        check: (w) => {
            const out = [];
            if (!deployed(w, 'fusion-pilot-plant'))
                out.push('no validated net-electricity pilot plant');
            if (!w.projects.some((p) => p.kind === 'fusion' && p.status === 'operational'))
                out.push('no fusion plant in service');
            return out;
        },
        effect: 'Fusion becomes a buildable firm-power option; its cost falls with every repeat build.',
    },
    {
        id: 'mars_city', name: 'Permanent Mars settlement', era: 2, illustrativeYear: 2055, kind: 'threshold',
        summary: 'Self-sustaining settlement of at least 10,000 people with closed-loop life support.',
        requires: ['launch cost ≤ 10% of 2026', 'closed-loop life support deployed', 'a Mars colony project completed'],
        check: (w) => {
            const out = [];
            if (!anyCiv(w, (c) => c.space.launchCostIndex <= 0.10))
                out.push('launch cost still above 10% of 2026');
            if (!deployed(w, 'closed-loop-habitat'))
                out.push('closed-loop life support not validated');
            if (!anyCiv(w, (c) => c.space.marsCapacityM >= 0.01))
                out.push('no completed Mars colony');
            if (!anyCiv(w, (c) => c.space.marsPopulationM >= 0.01))
                out.push('Mars population below 10,000');
            return out;
        },
        effect: 'A second home for humanity opens, tiny at first. Prestige, science and a migration valve.',
    },
    {
        id: 'asteroid_mining', name: 'Asteroid mining becomes an industry', era: 1, illustrativeYear: 2060, kind: 'threshold',
        summary: 'Off-Earth metals cover a material share of critical-mineral demand.',
        requires: ['in-space resource processing deployed', 'space mineral inflow ≥ 30% of 2026 demand'],
        check: (w) => {
            const out = [];
            if (!deployed(w, 'in-space-resource-processing'))
                out.push('in-space resource processing not validated');
            if (w.resources.mineralSpaceInflow < 0.30)
                out.push(`space inflow ${(w.resources.mineralSpaceInflow * 100).toFixed(0)}% of 2026 demand (<30%)`);
            return out;
        },
        effect: 'Mineral cost pressure eases; Earth mining and its land footprint shrink.',
    },
    {
        id: 'planetary_energy', name: 'Planetary energy mastery', era: 1, illustrativeYear: 2100, kind: 'threshold',
        summary: 'Fusion and orbital power supply most electricity with reserve to spare; warming is being pulled back.',
        requires: ['fusion + orbital power ≥ 50% of generation', 'reserve margin ≥ 20% in every civilization', 'commercial fusion achieved'],
        check: (w) => {
            const out = [];
            if (!has(w, 'fusion_commercial'))
                out.push('commercial fusion not yet achieved');
            const share = fusionAndSpaceShare(w);
            if (share < 0.5)
                out.push(`fusion/orbital share ${(share * 100).toFixed(0)}% (<50%)`);
            if (!w.civs.every((c) => c.energy.marginPct >= 20))
                out.push('reserve margin below 20% somewhere');
            return out;
        },
        effect: 'Energy stops being the binding constraint. Direct air capture and weather mitigation become affordable; warming begins to reverse.',
    },
    // ── Era 2: 2100–2300 ────────────────────────────────────────────────────
    {
        id: 'space_elevator', name: 'Space elevator operational', era: 2, illustrativeYear: 2180, kind: 'threshold',
        summary: 'A tether from equator to geostationary orbit makes orbital transit nearly free.',
        requires: ['tether-grade materials deployed', 'a space elevator project completed'],
        check: (w) => {
            const out = [];
            if (!deployed(w, 'orbital-tether-materials'))
                out.push('tether-grade materials not validated');
            if (!anyCiv(w, (c) => c.space.elevator))
                out.push('no elevator completed');
            return out;
        },
        effect: 'Launch cost collapses to the elevator floor; habitats and power satellites scale.',
    },
    {
        id: 'terraforming', name: 'Terraforming of Mars begins', era: 2, illustrativeYear: 2200, kind: 'program',
        summary: 'Multi-century atmospheric engineering: orbital mirrors, greenhouse gas factories, imported volatiles.',
        requires: ['Mars settlement', 'commercial fusion', 'orbital industry ≥ 2× 2026 space economy', 'general intelligence'],
        check: (w) => {
            const out = [];
            if (!has(w, 'mars_city'))
                out.push('no Mars settlement');
            if (!has(w, 'fusion_commercial'))
                out.push('no commercial fusion');
            if (!has(w, 'agi'))
                out.push('no general intelligence');
            if (totalOrbitalIndustry(w) < 2)
                out.push('orbital industry too small');
            return out;
        },
        baseYears: 120, costShare: 0.006,
        effect: 'Mars capacity grows an order of magnitude; the program absorbs investment for decades.',
    },
    {
        id: 'habitat_network', name: 'Orbital habitat network', era: 2, illustrativeYear: 2250, kind: 'threshold',
        summary: 'Rotating habitats house a significant share of the population; land on Earth is no longer the binding constraint on living space.',
        requires: ['≥ 5% of total population living off Earth'],
        check: (w) => {
            const tot = w.civs.reduce((a, c) => a + c.population.total, 0);
            const off = w.civs.reduce((a, c) => a + c.population.offworld, 0);
            return off / Math.max(1, tot) >= 0.05 ? [] : [`${(off / Math.max(1, tot) * 100).toFixed(1)}% off Earth (<5%)`];
        },
        effect: 'Housing and land pressure on Earth ease; rewilding accelerates.',
    },
    // ── Era 3: 2300–2600 ────────────────────────────────────────────────────
    {
        id: 'climate_control', name: 'Engineered climate', era: 2, illustrativeYear: 2150, kind: 'program',
        summary: 'Large-scale carbon removal and radiative interventions measurably counter warming. The capability can fail, has side effects, and cannot instantly reverse committed sea-level rise.',
        requires: ['planetary energy mastery', 'general intelligence', 'orbital industry ≥ 3×'],
        check: (w) => {
            const out = [];
            if (!has(w, 'planetary_energy'))
                out.push('no planetary energy mastery');
            if (!has(w, 'agi'))
                out.push('no general intelligence');
            if (totalOrbitalIndustry(w) < 3)
                out.push('orbital industry too small');
            return out;
        },
        baseYears: 60, costShare: 0.005,
        effect: 'If institutions and energy remain strong, warming pressure can be reduced over decades. Sea level continues responding to past warming with long inertia.',
    },
    {
        id: 'asi', name: 'Artificial superintelligence', era: 3, illustrativeYear: 2300, kind: 'threshold',
        summary: 'A speculative regime in which AI systems are far beyond 2026 human institutions across science and engineering. No benchmark-derived calendar horizon is claimed.',
        requires: ['general intelligence', 'model capability ≥ 40× 2026', 'agent capability ≥ 25× 2026', 'AI reliability ≥ 90%'],
        check: (w) => {
            const out = [];
            if (!has(w, 'agi'))
                out.push('no general intelligence');
            if (w.techs.ai_models.cap < 40)
                out.push(`model capability ${w.techs.ai_models.cap.toFixed(1)}× (<40×)`);
            if (w.techs.ai_agents.cap < 25)
                out.push(`agent capability ${w.techs.ai_agents.cap.toFixed(1)}× (<25×)`);
            if (Math.min(w.techs.ai_models.reliability, w.techs.ai_agents.reliability) < 0.9)
                out.push('AI reliability below 90%');
            return out;
        },
        effect: 'Research tooling saturates; the remaining constraints are physical: energy, matter, time.',
    },
    {
        id: 'mind_upload', name: 'Digital mind substrates', era: 3, illustrativeYear: 2400, kind: 'program',
        summary: 'Whole-brain emulation validated; a growing share of people live primarily on computational substrates.',
        requires: ['superintelligence', 'aging reversal', 'compute capacity ≥ 30× 2026'],
        check: (w) => {
            const out = [];
            if (!has(w, 'asi'))
                out.push('no superintelligence');
            if (!has(w, 'aging_reversal'))
                out.push('no aging reversal');
            const cs = w.civs.reduce((a, c) => a + c.compute.supplyFlops, 0);
            if (cs < 60)
                out.push('compute supply too small');
            return out;
        },
        baseYears: 65, costShare: 0.005,
        effect: 'Physical resource demand per person falls; compute and electricity demand rise.',
    },
    {
        id: 'dyson_swarm', name: 'Early Dyson swarm', era: 3, illustrativeYear: 2500, kind: 'program',
        summary: 'Mercury and asteroid material is turned into a swarm of collectors around the Sun.',
        requires: ['superintelligence', 'orbital habitat network', 'space elevator', 'orbital industry ≥ 10×'],
        check: (w) => {
            const out = [];
            if (!has(w, 'asi'))
                out.push('no superintelligence');
            if (!has(w, 'habitat_network'))
                out.push('no orbital habitat network');
            if (!has(w, 'space_elevator'))
                out.push('no space elevator');
            if (totalOrbitalIndustry(w) < 10)
                out.push('orbital industry too small');
            return out;
        },
        baseYears: 160, costShare: 0.012,
        effect: 'Captured energy grows by orders of magnitude as the swarm expands; the Kardashev index climbs past 1.',
    },
    {
        id: 'full_spectrum', name: 'Everywhere inhabited', era: 3, illustrativeYear: 2500, kind: 'threshold',
        summary: 'People live on land, on the sea, under it, in the stratosphere, in orbit and on Mars, under an engineered climate.',
        requires: ['engineered climate', 'floating districts', 'sea-floor habitats', 'stratospheric platforms', 'orbital habitats', 'Mars settlement'],
        check: (w) => {
            const out = [];
            if (!has(w, 'climate_control'))
                out.push('climate not under control');
            if (!anyCiv(w, (c) => c.land.floating > 0.02))
                out.push('no floating districts of note');
            if (!anyCiv(w, (c) => c.land.subsea > 0.01))
                out.push('nobody lives under the sea');
            if (!anyCiv(w, (c) => c.land.aerial > 0.002))
                out.push('nobody lives in the stratosphere');
            if (!has(w, 'habitat_network') && w.civs.reduce((a, c) => a + c.population.offworld, 0) < 1)
                out.push('orbital population below one million');
            if (!has(w, 'mars_city'))
                out.push('no Mars settlement');
            return out;
        },
        effect: 'Civilization has multiple habitation domains. This expands optionality but does not imply prosperity, justice, stability or ecological success.',
    },
    {
        id: 'type_i', name: 'Type I civilization', era: 3, illustrativeYear: 2520, kind: 'threshold',
        summary: 'Captured energy reaches 10^16 W, about 500× the 2026 level (Sagan formulation, K = 1.0).',
        requires: ['Kardashev index ≥ 1.0'],
        check: (w) => (w.frontier.kardashev >= 1.0 ? [] : [`K = ${w.frontier.kardashev.toFixed(2)} (<1.0)`]),
        effect: 'Planetary-scale engineering is routine.',
    },
    {
        id: 'system_network', name: 'System-wide integration', era: 3, illustrativeYear: 2550, kind: 'program',
        summary: 'Communication, transport and energy networks link the settled Solar System: habitats, Mars and the swarm stop depending on Earth for anything.',
        requires: ['Dyson swarm under construction', 'orbital habitat network', 'Mars settlement'],
        check: (w) => {
            const out = [];
            const d = w.frontier.milestones.find((m) => m.id === 'dyson_swarm');
            if (!d || (d.status !== 'in_progress' && d.status !== 'achieved'))
                out.push('Dyson swarm not started');
            if (!has(w, 'habitat_network'))
                out.push('no orbital habitat network');
            if (!has(w, 'mars_city'))
                out.push('no Mars settlement');
            return out;
        },
        baseYears: 45, costShare: 0.004,
        effect: 'Off-Earth populations grow on their own; Earth becomes one settled body among several.',
    },
    {
        id: 'type_ii_approach', name: 'Approaching Type II', era: 3, illustrativeYear: 2600, kind: 'threshold',
        summary: 'Captured energy within two orders of magnitude of the Sun\'s output (K ≥ 1.5). End of the calibrated milestone roadmap. Optional deep-space ark settlements can exist outside this roadmap, but are explicitly speculative and do not imply faster-than-light travel.',
        requires: ['Kardashev index ≥ 1.5', 'system-wide integration'],
        check: (w) => {
            const out = [];
            if (w.frontier.kardashev < 1.5)
                out.push(`K = ${w.frontier.kardashev.toFixed(2)} (<1.5)`);
            if (!has(w, 'system_network'))
                out.push('no system-wide integration');
            return out;
        },
        effect: 'End of the calibrated milestone roadmap; farther settlement remains a speculative sandbox branch.',
    },
];
export function milestoneDef(id) {
    return MILESTONES.find((m) => m.id === id);
}
export function fusionAndSpaceShare(w) {
    let fs = 0, tot = 0;
    for (const c of w.civs) {
        const f = c.energy.sources.fusion.cap * 0.9 * 8.76 + c.energy.spaceSolarTWh;
        fs += f;
        tot += c.energy.servedTWh;
    }
    return tot > 0 ? Math.min(1, fs / tot) : 0;
}
export function totalOrbitalIndustry(w) {
    return w.civs.reduce((a, c) => a + c.space.orbitalIndustry, 0);
}
export { worldOutput };
