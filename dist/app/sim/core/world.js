import { CIV_IDS } from '../types.js';
import { CIV_DEFS } from '../data/civDefs.js';
import { TECH_DEFS, TECH_IDS } from '../data/techDefs.js';
import { makeRng } from '../rng.js';
import { INFLUENCE_START } from '../data/interventions.js';
import { initialCohorts } from './demography.js';
import { CALIBRATION } from '../data/calibration.js';
import { MILESTONES } from '../data/frontier.js';
export const START_YEAR = 2026;
export const START_MONTH = 8; // September (0-indexed)
function initTech(id, _params) {
    void _params;
    const d = TECH_DEFS[id];
    const adoption = {};
    for (const c of CIV_IDS) {
        const pen = d.pen0[c];
        adoption[c] = { arrived: pen > 0.005, penetration: pen, intensity: pen * 0.7 };
    }
    return {
        id,
        cap: d.cap0,
        paradigmCap: d.paradigmCap0,
        paradigm: 1,
        maturity: d.maturity0,
        reliability: d.reliability0,
        cost: d.cost0,
        mfg: 1,
        cumulative: 1,
        effort: d.effortPull,
        uncertainty: d.sigma,
        phase: d.phase0,
        lastGrowthRate: 0,
        growthAccel: 0,
        adoption,
        depReady: 1,
        bottleneck: '',
    };
}
// Capacity factors (share of nameplate → average generation)
export const CAPACITY_FACTOR = { fossil: 0.55, nuclear: 0.9, solar: 0.22, wind: 0.35, hydro: 0.45, geothermal: 0.88, bioenergy: 0.72, ocean: 0.42, fusion: 0.9 };
const GRID_UTILIZATION = 0.62;
/** Rescale source mix so initial generation ≈ demand × 1.13, grid ≈ peak × 1.12 */
function initEnergy(d) {
    const demand = d.energy.demandTWh;
    const raw = { fossil: d.energy.fossil, nuclear: d.energy.nuclear, solar: d.energy.solar, wind: d.energy.wind, hydro: d.energy.hydro, geothermal: d.energy.geothermal, bioenergy: d.energy.bioenergy, ocean: d.energy.ocean };
    let gen = 0;
    for (const k of Object.keys(raw))
        gen += raw[k] * CAPACITY_FACTOR[k] * 8.76;
    const scale = (demand * 1.13) / gen;
    const mk = (gw) => ({ cap: gw * scale, underConstruction: 0, queue: [], condition: 0.94, avgAgeYears: 15, maintenanceBacklog: 0 });
    const avgDemandGW = demand / 8.76;
    const computeTWh = d.compute.dcCapGW * 8.76 * 0.7; // consistent with stepCompute's demand model
    return {
        demandTWh: demand,
        baseDemandTWh: Math.max(1, demand - computeTWh),
        computeDemandTWh: computeTWh,
        sources: { fossil: mk(raw.fossil), nuclear: mk(raw.nuclear), solar: mk(raw.solar), wind: mk(raw.wind), hydro: mk(raw.hydro), geothermal: mk(raw.geothermal), bioenergy: mk(raw.bioenergy), ocean: mk(raw.ocean), fusion: { ...mk(0), avgAgeYears: 0, condition: 1 } },
        spaceSolarTWh: 0,
        hydrogen: { electrolyzerGW: 0.15, fuelCellGW: 0.05, storageTWh: 0.01, storageCapacityTWh: 0.05, cleanShare: 0.18, industryShare: 0.02, transportShare: 0.003 },
        storageGWh: d.energy.storageGWh,
        gridCapGW: (avgDemandGW / GRID_UTILIZATION) * 1.25,
        gridQueue: [],
        marginPct: 13,
        priceIndex: 1,
        constrained: false,
        servedTWh: demand,
        unservedTWh: 0,
        criticalServedRatio: 1,
        industryServedRatio: 1,
        computeServedRatio: 1,
        gridCondition: 0.93,
        gridMaintenanceBacklog: 0,
    };
}
/** Solve normalization so production function reproduces 2026 output exactly. */
function solveOutputScale(d) {
    const computeTWh0 = d.compute.dcCapGW * 8.76 * 0.7;
    const laborForce = d.population.total * d.population.workingShare * 0.62;
    const laborInput = laborForce * (1 - d.economy.unemployment);
    const raw = Math.pow(Math.max(0.1, laborInput / 26), 0.6) * Math.pow(Math.max(0.1, d.economy.output), 0.35);
    // normalize base electricity demand against the *initial* electrification/efficiency
    // state (EV + robotics penetration at 2026), so month-1 demand reproduces 2026 levels
    const evPen0 = TECH_DEFS.transport_ev.pen0[d.id];
    const robPen0 = TECH_DEFS.robotics_ind.pen0[d.id];
    const electrification0 = 1 + evPen0 * 0.35 + robPen0 * 0.7 * 0.12;
    const efficiency0 = 1 - Math.min(0.25, (TECH_DEFS.ai_models.cap0 - 1) * 0.02 + (TECH_DEFS.grid_transmission.cap0 - 1) * 0.03);
    return {
        outputScale: d.economy.output / Math.max(0.01, raw),
        outputRefTWh: Math.max(1, d.energy.demandTWh - computeTWh0) / (d.economy.output * electrification0 * efficiency0),
    };
}
function initFood(d) {
    const production = d.food.land * (1 - d.food.artificial0 * 0.55) + d.food.artificial0;
    return {
        demandIndex: 1,
        landCapacity: d.food.land,
        landYield: 1,
        landUse: 1 - d.food.artificial0 * 0.55,
        artificialShare: d.food.artificial0,
        productionIndex: production,
        selfSufficiency: production,
        importShare: Math.max(0, 1 - production),
        shortage: 0,
        priceIndex: 1,
        artificialUnlocked: d.food.artificial0 > 0,
    };
}
function initCiv(defId, params) {
    const d = CIV_DEFS.find((c) => c.id === defId);
    const alloc = {};
    // allocation ~ effortPull weighted by science priority and industrial fit
    let sum = 0;
    for (const t of TECH_IDS) {
        const pull = TECH_DEFS[t].effortPull;
        let fit = 1;
        if (defId === 'ardan' && (t === 'semiconductor_fab' || t === 'robotics_ind' || t === 'storage_batt'))
            fit = 1.5;
        if (defId === 'veloria' && (t === 'ai_models' || t === 'ai_agents' || t === 'biotech_med'))
            fit = 1.5;
        if (defId === 'nemea' && (t === 'solar_pv' || t === 'wind_power' || t === 'grid_transmission'))
            fit = 1.4;
        const v = pull * fit * (0.5 + d.traits.sciencePriority);
        alloc[t] = v;
        sum += v;
    }
    for (const t of TECH_IDS)
        alloc[t] /= sum;
    return {
        id: defId,
        name: d.name,
        color: d.color,
        traits: { ...d.traits },
        population: {
            ...d.population,
            medianAge: d.population.medianAge + params.medianAgeShift,
            fertility: Math.max(1.0, d.population.fertility - params.medianAgeShift * 0.045),
            lifeExpectancy: 68 + d.population.education * 12 + (d.population.medianAge - 29) * 0.25,
            offworld: 0, digitalShare: 0, birthRate: 0, deathRate: 0,
            peakPhysical: d.population.total,
            cohorts: initialCohorts(d.population.total, d.population.medianAge + params.medianAgeShift),
        },
        economy: {
            output: d.economy.output,
            tfp: 1,
            capital: d.economy.output,
            laborForce: d.population.total * d.population.workingShare * 0.62,
            unemployment: d.economy.unemployment,
            automationExposure: 0.12,
            displacedShare: 0,
            wageIndex: 1,
            gini: d.economy.gini,
            publicDebt: d.economy.publicDebt,
            rdSpendShare: d.economy.rdSpendShare,
            infraSpend: 1,
            capexAvailability: d.economy.capexAvailability * params.capitalAvailability,
            ...solveOutputScale(d),
            potentialOutput: d.economy.output,
            investmentBudget: d.economy.output * CALIBRATION.finance.grossInvestmentShare,
            maintenanceBudget: d.economy.output * CALIBRATION.finance.publicMaintenanceShare,
            institutionalCapacity: Math.min(0.95, 0.55 + d.society.stability * 0.35 + d.traits.educationBase * 0.1),
            capitalCondition: 0.94,
            energyIntensityIndex: 1,
            outputPerCapita: 1,
            materialCostIndex: 1,
        },
        energy: initEnergy(d),
        food: initFood(d),
        housing: { demandIndex: 1, stockIndex: 1, crowding: 0, rentIndex: 1, condition: 0.92, vacancy: 0.07, maintenanceBacklog: 0, abandoned: 0.01 },
        // richer, better-governed civs start with more waste infrastructure
        waste: { generatedIndex: 1, managedShare: Math.min(0.85, 0.35 + d.population.education * 0.35), accumulation: 0.05 },
        land: {
            usable: 1, urban: d.land.urban, farm: d.land.farm, energy: d.land.energy,
            free: 1 - d.land.urban - d.land.farm - d.land.energy,
            pressure: (d.land.urban + d.land.farm + d.land.energy) / 1,
            densityIndex: 1, brownfield: 0, builtStock: 1, seabedInflow: 0, offshoreGW: 0, subsea: 0, aerial: 0, vertical: 0, underground: 0, wildReclaimed: 0, floatingCondition: 1, subseaCondition: 1, verticalCondition: 1, undergroundCondition: 1, reclaimed: 0, reclaimedCondition: 1, floating: 0, shelf: d.land.shelf, seaExposure: d.land.seaExposure, lost: 0,
        },
        frontierReadiness: 0.5,
        compute: {
            accelStock: d.compute.accelStock,
            dcCapGW: d.compute.dcCapGW,
            dcQueue: [],
            supplyFlops: d.compute.accelStock,
            demandFlops: d.compute.accelStock * 0.8,
            constrained: false,
        },
        society: {
            trust: d.society.trust,
            stability: d.society.stability,
            backlash: 0.1,
            regCaution: d.society.regCaution,
            basicProvision: d.traits.marketOrientation < 0.5 ? 0.12 : 0.06,
            laborRelevance: 1, syntheticProgram: 'none', syntheticBirthsPerYear: 0, lockdown: 0, fragmented: false, lowStabilityMonths: 0, revivalMonths: 0, enhancement: 'none',
            familyFormation: Math.min(0.9, Math.max(0.08, (d.population.fertility - 0.6) / 3.2)), polityStatus: 'active', autonomousInfrastructure: 0.03,
        },
        researchAlloc: alloc,
        researchCapacity: d.researchCapacity,
        researchProductivity: 1,
        strategicPriority: 'Balanced development',
        space: {
            launchCostIndex: 1,
            spaceportCapacity: d.id === 'nemea' ? 0 : d.id === 'ardan' ? 0.15 : 0.12,
            orbitalIndustry: 0,
            habitatCapacityM: 0,
            marsCapacityM: 0,
            marsPopulationM: 0,
            deepSpaceCapacityM: 0, interstellarM: 0,
            elevator: false,
            powerSatelliteGW: 0,
            mineralInflow: 0,
        },
    };
}
const CHARACTER_SEEDS = [
    { id: 'elena_voss', name: 'Elena Voss', civId: 'veloria', role: 'Energy systems engineer', age: 38,
        beliefs: ['Electrification is the backbone of everything else', 'Poorly planned subsidies waste a decade'], concern: 'New AI data centers are requesting more power than the regional grid can deliver' },
    { id: 'kael_morrow', name: 'Kael Morrow', civId: 'veloria', role: 'AI research director', age: 44,
        beliefs: ['Capability is compounding faster than institutions understand', 'Evaluation matters more than hype'], concern: 'Whether compute supply or caution will bind first' },
    { id: 'dasha_iren', name: 'Dasha Iren', civId: 'ardan', role: 'Fab operations executive', age: 51,
        beliefs: ['Whoever masters manufacturing masters the century', 'Dependence is vulnerability'], concern: 'Export controls squeezing equipment supply chains' },
    { id: 'tomas_fenn', name: 'Tomas Fenn', civId: 'ardan', role: 'Labor union leader', age: 47,
        beliefs: ['Productivity must reach wages, not just margins', 'Retraining promises are usually empty'], concern: 'Robotics spreading through the plants faster than workers can adapt' },
    { id: 'amara_sol', name: 'Amara Sol', civId: 'nemea', role: 'Minister for development', age: 42,
        beliefs: ['Energy abundance is destiny', 'Institutions can be built faster than people think'], concern: 'Keeping the lights on while the economy doubles' },
    { id: 'rio_kade', name: 'Rio Kade', civId: 'nemea', role: 'Robotics entrepreneur', age: 31,
        beliefs: ['Leapfrogging is real if the grid cooperates', 'Talent leaves when opportunity stalls'], concern: 'Capital for automation dries up when power is unreliable' },
];
export function createWorld(seed, params, scenarioId, scenarioLabel) {
    const techs = {};
    for (const t of TECH_IDS)
        techs[t] = initTech(t, params);
    const relations = [];
    for (let i = 0; i < CIV_IDS.length; i++) {
        for (let j = i + 1; j < CIV_IDS.length; j++) {
            const a = CIV_IDS[i], b = CIV_IDS[j];
            const open = Math.min(1, params.tradeOpenness * 0.6);
            relations.push({
                a, b,
                relation: 0.15,
                tradeOpenness: open,
                sciCollaboration: Math.min(1, params.collaboration * 0.5),
                chipExportAllowed: params.tradeOpenness > 0.55,
                tension: 0.08,
                grievances: [],
            });
        }
    }
    const characters = CHARACTER_SEEDS.map((c) => ({
        id: c.id, name: c.name, civId: c.civId, role: c.role, age: c.age,
        prominence: 0.4,
        history: [{ tMonths: 0, text: `At the start of the simulation, ${c.name} works as ${c.role.toLowerCase()} in ${c.civId === 'veloria' ? 'Veloria' : c.civId === 'ardan' ? 'Ardan' : 'Nemea'}.` }],
        beliefs: [...(c.beliefs ?? [])],
        concern: c.concern ?? '',
        mood: 0.1,
        active: true,
    }));
    const world = {
        seed,
        rng: makeRng(seed, 0),
        tMonths: 0,
        startYear: START_YEAR,
        scenarioId,
        scenarioLabel,
        params,
        civs: CIV_IDS.map((id) => initCiv(id, params)),
        techs,
        relations,
        chronicle: [{
                id: 'ev-start', tMonths: 0, year: START_YEAR,
                title: 'The simulation begins',
                body: `September 2026. Three modern civilizations — Veloria, Ardan and Nemea — stand at the frontier humanity actually reached: frontier AI, semiconductor manufacturing, renewable energy, global logistics. Nothing is predetermined. Scenario: ${scenarioLabel}.`,
                category: 'milestone', causes: [], counterforces: [], confidence: 'high', significance: 3,
            }],
        characters,
        env: { warmingC: 1.37, pressure: 0.15, seaLevelM: 0, committedSeaLevelM: 0.15 },
        metrics: [],
        eventCounter: 1,
        flags: {},
        activeInterventions: [],
        observerBudget: INFLUENCE_START,
        projects: [],
        researchPrograms: [],
        inventions: [],
        pendingTransition: {},
        resources: {
            fossilReserves: CALIBRATION.resources.fossilReserveYears * params.resourceAbundance,
            fossilExtractionRate: 1,
            fossilCostIndex: 1,
            mineralReserves: CALIBRATION.resources.mineralReserveYears * params.resourceAbundance,
            mineralDemand: 1,
            mineralRecycled: 0.22,
            mineralSpaceInflow: 0, mineralSeabedInflow: 0,
            mineralCostIndex: 1,
            recyclingRate: 0.22,
            landPressure: 0.35,
        },
        pendingDecisions: [],
        conflicts: [], pendingConflict: [], pandemic: null, pendingPandemic: false, drought: null, pendingAiIncident: false,
        frontier: {
            kardashev: 0.73,
            energyCaptureTW: 20,
            agi: false, asi: false,
            milestones: MILESTONES.map((m) => ({ id: m.id, status: 'locked', progress: 0, blockers: [] })),
            offworldPopulationM: 0,
            digitalPopulationM: 0,
            trajectory: 'growth',
            trajectoryNote: 'The simulation has just begun.',
            outcome: { materialSecurity: 0.8, humanDevelopment: 0.72, institutionalHealth: 0.68, ecologicalSafety: 0.72, distribution: 0.65, resilience: 0.62, broadFlourishing: 0.69 },
            developmentForm: 'earthbound',
            era: 'The Earth-bound century',
        },
    };
    // pre-arm one-shot flags for thresholds already crossed at the 2026 start,
    // so "boom/crisis" events only fire on genuine crossings
    for (const c of world.civs) {
        if (techs.robotics_ind.adoption[c.id].penetration > 0.45)
            world.flags[`robotics-boom-${c.id}`] = true;
        if (techs.transport_ev.adoption[c.id].penetration > 0.5)
            world.flags[`ev-majority-${c.id}`] = true;
    }
    return world;
}
export function cloneWorld(w) {
    return structuredClone(w);
}
