import { INTERVENTIONS } from './data/interventions.js';
import { addEvent, taskHorizonHrs } from './core/step.js';
import { cloneWorld } from './core/world.js';
import { CALIBRATION } from './data/calibration.js';
function interventionProjectSpec(kind, capacity) {
    switch (kind) {
        case 'grid': return { months: CALIBRATION.grid.projectLeadMonths, capex: capacity * 0.014 };
        case 'datacenter': return { months: CALIBRATION.datacenter.leadMonths, capex: capacity * CALIBRATION.datacenter.capexPerGW };
        case 'fab': return { months: CALIBRATION.fab.leadMonths, capex: Math.max(0.01, capacity) * CALIBRATION.fab.capexPerUnit };
        case 'housing': return { months: CALIBRATION.housing.leadMonths, capex: capacity * CALIBRATION.housing.capexPerStockPoint };
        case 'arcology': return { months: 72, capex: capacity * CALIBRATION.housing.capexPerStockPoint * 1.8 };
        case 'underground_habitat': return { months: 84, capex: capacity * CALIBRATION.housing.capexPerStockPoint * 2.2 };
        case 'nuclear': return { months: CALIBRATION.generation.nuclear.leadMonths, capex: capacity * CALIBRATION.generation.nuclear.capexPerGW };
        case 'solar': return { months: CALIBRATION.generation.solar.leadMonths, capex: capacity * CALIBRATION.generation.solar.capexPerGW };
        case 'wind': return { months: CALIBRATION.generation.wind.leadMonths, capex: capacity * CALIBRATION.generation.wind.capexPerGW };
        case 'geothermal': return { months: CALIBRATION.generation.geothermal.leadMonths, capex: capacity * CALIBRATION.generation.geothermal.capexPerGW };
        case 'bioenergy': return { months: CALIBRATION.generation.bioenergy.leadMonths, capex: capacity * CALIBRATION.generation.bioenergy.capexPerGW };
        case 'ocean_energy': return { months: CALIBRATION.generation.ocean.leadMonths, capex: capacity * CALIBRATION.generation.ocean.capexPerGW };
        case 'hydrogen_hub': return { months: 30, capex: capacity * 0.08 };
        case 'fossil': return { months: CALIBRATION.generation.fossil.leadMonths, capex: capacity * CALIBRATION.generation.fossil.capexPerGW };
        case 'storage': return { months: 18, capex: capacity * 0.04 };
        case 'fusion': return { months: CALIBRATION.generation.fusion.leadMonths, capex: capacity * CALIBRATION.generation.fusion.capexPerGW * 3 };
        case 'recycling': return { months: 30, capex: capacity * 1.5 };
        case 'spaceport': return { months: 36, capex: capacity * 0.06 };
        case 'asteroid_mining': return { months: 72, capex: capacity * 2.4 };
        case 'orbital_habitat': return { months: 96, capex: capacity * CALIBRATION.frontier.habitatCapexPerMillion };
        case 'mars_colony': return { months: 120, capex: capacity * 6 };
        case 'interstellar_ark': return { months: 240, capex: capacity * 18 };
        case 'space_elevator': return { months: 180, capex: 1.4 };
        case 'power_satellite': return { months: 48, capex: capacity * 0.2 };
        case 'land_reclamation': return { months: 60, capex: capacity * 9 };
        case 'floating_district': return { months: 30, capex: capacity * CALIBRATION.housing.capexPerStockPoint * 1.45 };
        case 'seabed_mining': return { months: 48, capex: capacity * 1.8 };
        case 'offshore_energy': return { months: 30, capex: capacity * CALIBRATION.generation.wind.capexPerGW * 1.6 };
        case 'subsea_habitat': return { months: 60, capex: capacity * CALIBRATION.housing.capexPerStockPoint * 2.4 };
        case 'aerial_platform': return { months: 72, capex: capacity * CALIBRATION.housing.capexPerStockPoint * 9 };
    }
}
function queueInterventionProject(w, civId, kind, capacity, rationale) {
    const spec = interventionProjectSpec(kind, capacity);
    const id = `observer_${kind}_${civId}_${w.tMonths}_${w.projects.length + 1}`;
    w.projects.push({
        id, civId, kind, status: 'financed', capacity,
        capex: spec.capex, spent: 0,
        monthsRemaining: spec.months, totalMonths: spec.months,
        proposedAt: w.tMonths, delayMonths: 0,
        rationale,
    });
}
export function applyIntervention(w, interventionId, civId, otherCiv) {
    const def = INTERVENTIONS.find((i) => i.id === interventionId);
    if (!def)
        return { ok: false, reason: 'Unknown intervention' };
    if (w.observerBudget < def.cost)
        return { ok: false, reason: 'Not enough intervention budget' };
    w.observerBudget -= def.cost;
    const effects = def.make(civId, otherCiv);
    const maxMonths = Math.max(...effects.map((e) => ('months' in e ? e.months : 1)), 1);
    w.activeInterventions.push({
        id: def.id, label: def.label, tStart: w.tMonths, monthsLeft: maxMonths, effects,
    });
    // immediate structural effects
    for (const ef of effects) {
        if (ef.kind === 'build') {
            const kind = ef.buildType;
            queueInterventionProject(w, ef.civId, kind, ef.amountGW, `Observer intervention: ${def.label}`);
        }
        else if (ef.kind === 'society') {
            const c = w.civs.find((x) => x.id === ef.civId);
            c.society[ef.stat] = Math.min(1, Math.max(0, c.society[ef.stat] + ef.delta));
        }
        else if (ef.kind === 'relation') {
            const r = w.relations.find((x) => (x.a === ef.a && x.b === ef.b) || (x.a === ef.b && x.b === ef.a));
            if (r) {
                if (ef.field === 'chipExportAllowed') {
                    r.chipExportAllowed = Boolean(ef.value);
                    if (!ef.value)
                        r.grievances.push('export controls');
                }
                else {
                    r[ef.field] = Number(ef.value);
                }
            }
        }
    }
    const civName = civId ? w.civs.find((c) => c.id === civId).name : 'the world';
    addEvent(w, {
        title: `Intervention: ${def.label}`,
        body: `Observer intervention directed at ${civName}. ${def.description}`,
        category: 'intervention', civId: civId ?? undefined, significance: 1,
        causes: [{ factor: 'player intervention', weight: 1 }],
        counterforces: [], confidence: 'high',
    });
    return { ok: true };
}
/** Snapshot the world; World B gets one structured change. Same seed → divergence is attributable. */
export function createBranch(w, note, change) {
    const a = cloneWorld(w);
    a.branchOf = w.scenarioId;
    a.branchNote = 'World A — unchanged';
    const b = cloneWorld(w);
    b.branchOf = w.scenarioId;
    b.branchNote = `World B — ${note}`;
    change(b);
    addEvent(b, {
        title: 'Parallel world created',
        body: `Timeline branched at this date. Changed assumption: ${note}. Both worlds continue from identical state and seed.`,
        category: 'milestone', significance: 2,
        causes: [{ factor: 'observer branch', weight: 1 }], counterforces: [], confidence: 'high',
    });
    return { a, b, note };
}
export function compareWorlds(a, b) {
    const sum = (w, fn) => w.civs.reduce((x, c) => x + fn(c), 0);
    const mean = (w, fn) => sum(w, fn) / w.civs.length;
    const rows = [
        { label: 'Population', a: sum(a, (c) => c.population.total), b: sum(b, (c) => c.population.total), unit: 'M', betterWhenHigher: null },
        { label: 'Economic output', a: sum(a, (c) => c.economy.output), b: sum(b, (c) => c.economy.output), unit: 'idx', betterWhenHigher: true },
        { label: 'Unemployment', a: mean(a, (c) => c.economy.unemployment) * 100, b: mean(b, (c) => c.economy.unemployment) * 100, unit: '%', betterWhenHigher: false },
        { label: 'AI capability', a: a.techs.ai_models.cap, b: b.techs.ai_models.cap, unit: '× 2026', betterWhenHigher: null },
        { label: 'Measured agent horizon (capped)', a: taskHorizonHrs(a.techs.ai_agents.cap), b: taskHorizonHrs(b.techs.ai_agents.cap), unit: 'hrs', betterWhenHigher: null },
        { label: 'Robotics adoption', a: mean(a, (c) => a.techs.robotics_ind.adoption[c.id].penetration) * 100, b: mean(b, (c) => b.techs.robotics_ind.adoption[c.id].penetration) * 100, unit: '%', betterWhenHigher: null },
        { label: 'Electricity demand', a: sum(a, (c) => c.energy.demandTWh), b: sum(b, (c) => c.energy.demandTWh), unit: 'TWh/yr', betterWhenHigher: null },
        { label: 'Kardashev index', a: a.frontier.kardashev, b: b.frontier.kardashev, unit: 'K', betterWhenHigher: null },
        { label: 'Life expectancy', a: mean(a, (c) => c.population.lifeExpectancy), b: mean(b, (c) => c.population.lifeExpectancy), unit: 'yrs', betterWhenHigher: true },
        { label: 'Off-Earth population', a: a.frontier.offworldPopulationM, b: b.frontier.offworldPopulationM, unit: 'M', betterWhenHigher: null },
        { label: 'Mineral cost', a: a.resources.mineralCostIndex, b: b.resources.mineralCostIndex, unit: '× 2026', betterWhenHigher: false },
        { label: 'Fossil reserves', a: Math.max(0, a.resources.fossilReserves), b: Math.max(0, b.resources.fossilReserves), unit: 'yrs', betterWhenHigher: null },
        { label: 'Land committed', a: mean(a, (c) => c.land.pressure) * 100, b: mean(b, (c) => c.land.pressure) * 100, unit: '%', betterWhenHigher: false },
        { label: 'Land reclaimed from sea', a: sum(a, (c) => c.land.reclaimed + c.land.floating * 0.3) * 100 / 3, b: sum(b, (c) => c.land.reclaimed + c.land.floating * 0.3) * 100 / 3, unit: '% of 2026', betterWhenHigher: null },
        { label: 'Frontier readiness', a: mean(a, (c) => c.frontierReadiness), b: mean(b, (c) => c.frontierReadiness), unit: '', betterWhenHigher: true },
        { label: 'Derelict housing', a: mean(a, (c) => c.housing.abandoned) * 100, b: mean(b, (c) => c.housing.abandoned) * 100, unit: '%', betterWhenHigher: false },
        { label: 'Electricity price', a: mean(a, (c) => c.energy.priceIndex), b: mean(b, (c) => c.energy.priceIndex), unit: '× 2026', betterWhenHigher: false },
        { label: 'Inequality (Gini)', a: mean(a, (c) => c.economy.gini), b: mean(b, (c) => c.economy.gini), unit: '', betterWhenHigher: false },
        { label: 'Political stability', a: mean(a, (c) => c.society.stability), b: mean(b, (c) => c.society.stability), unit: '', betterWhenHigher: true },
        { label: 'Broad outcome score', a: a.frontier.outcome.broadFlourishing * 100, b: b.frontier.outcome.broadFlourishing * 100, unit: '/100', betterWhenHigher: true },
        { label: 'Sea-level rise', a: a.env.seaLevelM, b: b.env.seaLevelM, unit: 'm', betterWhenHigher: false },
        { label: 'Warming', a: a.env.warmingC, b: b.env.warmingC, unit: '°C', betterWhenHigher: false },
        { label: 'Compute supply', a: sum(a, (c) => c.compute.supplyFlops), b: sum(b, (c) => c.compute.supplyFlops), unit: 'idx', betterWhenHigher: null },
    ];
    return rows;
}
