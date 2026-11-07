import { CALIBRATION } from '../data/calibration.js';
import { civDef } from '../data/civDefs.js';
import { MILESTONES, ERA_LABELS, milestoneDef } from '../data/frontier.js';
import { addEvent, yearOf } from './step.js';
import { clamp, clamp01, lerp } from './formulas.js';
import { chance } from '../rng.js';
const DT = 1 / 12;
/** People who physically live on Earth in bodies: they need houses, food and land. */
export function physicalPopulation(c) {
    return Math.max(0, (c.population.total - c.population.offworld) * (1 - c.population.digitalShare));
}
/** Off-world location ledger. Mars and deep-space are explicit subsets; the remainder is orbital/cislunar. */
export function marsPopulation(c) {
    return Math.min(Math.max(0, c.space.marsPopulationM), Math.max(0, c.population.offworld));
}
export function deepSpacePopulation(c) {
    return Math.min(Math.max(0, c.space.interstellarM), Math.max(0, c.population.offworld));
}
export function orbitalPopulation(c) {
    return Math.max(0, c.population.offworld - marsPopulation(c) - deepSpacePopulation(c));
}
/**
 * Has this civilization earned the frontier? A score in 0..1 from the things a
 * society must have in order before it can afford decade-long bets: stable
 * politics, competent institutions, sustainable debt, an energy surplus, fed
 * and housed people, a research base. Frontier research, spaceports, sea
 * reclamation and the milestone programs all key off it. No preset hands it
 * out; it is computed from the simulated state every month.
 */
export function computeFrontierReadiness(c) {
    // This is readiness for Earth-based frontier programmes. An empty territory cannot
    // operate a spaceport merely because old infrastructure still exists. Off-world
    // continuity is modelled separately in stepFrontier.
    if (physicalPopulation(c) < 0.001 || c.society.polityStatus === 'abandoned')
        return 0;
    const s = c.society, e = c.economy;
    const stability = clamp((s.stability - 0.3) / 0.5, 0, 1);
    const institutions = clamp((e.institutionalCapacity - 0.3) / 0.5, 0, 1);
    const fiscal = clamp((2.2 - e.publicDebt) / 1.4, 0, 1);
    const energy = clamp((c.energy.marginPct + 5) / 20, 0, 1) * clamp(1.6 - c.energy.priceIndex, 0.3, 1);
    const fed = 1 - clamp(c.food.shortage * 8, 0, 1);
    const housed = clamp(1 - c.housing.crowding * 2.5 - c.housing.abandoned * 1.5, 0, 1);
    const knowledge = clamp(c.researchCapacity / 1.2, 0, 1) * (0.5 + c.population.education * 0.5);
    const legitimacy = clamp(1 - s.backlash * 1.2 - Math.max(0, e.unemployment * s.laborRelevance - 0.1) * 3, 0, 1);
    const score = 0.20 * stability + 0.16 * institutions + 0.14 * fiscal + 0.14 * energy + 0.10 * fed + 0.08 * housed + 0.10 * knowledge + 0.08 * legitimacy;
    // Any single hard failure caps the score: no society launches habitats during a famine.
    const cap = Math.min(1, 0.35 + stability * 0.65, 0.35 + fed * 0.65, 0.4 + energy * 0.6);
    return clamp(Math.min(score, cap), 0, 1);
}
/** Research-tooling multiplier from general/super intelligence (applied on top of the logarithmic AI tooling term). */
export function agiToolingBoost(w) {
    return 1 + (w.frontier.agi ? 0.55 : 0) + (w.frontier.asi ? 1.1 : 0);
}
// ── planning: which frontier projects a civilization proposes this year ────
export function planFrontierProjects(w, c, propose) {
    // No ghost launch economy: Earth projects require an embodied population and a
    // functioning polity. Existing off-world settlements can survive without this.
    if (physicalPopulation(c) < 0.001 || c.society.polityStatus === 'abandoned')
        return;
    const t = w.techs;
    const sp = c.space;
    const wealth = c.economy.outputPerCapita;
    const earned = c.frontierReadiness;
    const stable = earned >= 0.45;
    const wellEarned = earned >= 0.6;
    const spaceReady = t.space_systems.maturity;
    const programPush = 1 + civPolicyStrength(w, c.id, 'space_program');
    // Recycling plants: the cheapest response to mineral scarcity, once it hurts.
    if (w.resources.mineralCostIndex > 1.25 && w.resources.recyclingRate < CALIBRATION.resources.recyclingCeiling - 0.05 && stable) {
        propose(w, c, 'recycling', 0.04, 'critical-mineral prices make recovery cheaper than new mines');
    }
    // Spaceports: launch throughput. Needed before anything else off Earth.
    if (spaceReady > 0.35 && t.space_systems.reliability > 0.5 && wellEarned && (wealth > 1.15 || c.traits.strategicAutonomy > 0.7 || programPush > 1)) {
        const want = sp.spaceportCapacity < 1 ? 0.5 : sp.spaceportCapacity < 3 ? 1 : 0;
        if (want > 0)
            propose(w, c, 'spaceport', want * programPush, sp.spaceportCapacity < 0.5 ? 'establish reusable heavy-launch capacity' : 'expand launch cadence for orbital industry');
    }
    // Asteroid / lunar mining: the exit from Earth's mineral limits.
    if (sp.spaceportCapacity >= 1 && t.space_systems.cap >= 1.8 && sp.launchCostIndex <= 0.2 && wellEarned && (w.resources.mineralCostIndex > 1.2 || c.traits.strategicAutonomy > 0.75 || programPush > 1.5)) {
        const scale = sp.mineralInflow < 0.1 ? 0.1 : 0.2;
        propose(w, c, 'asteroid_mining', scale, w.resources.mineralCostIndex > 1.2 ? 'mineral scarcity on Earth makes off-world metals competitive' : 'secure strategic mineral supply beyond Earth');
    }
    // Orbital habitats: living space that does not come out of Earth's land.
    const closedLoop = w.inventions.some((i) => i.id.startsWith('inv-closed-loop-habitat-') && i.status === 'deployed');
    // Habitats come after the cheaper exits (density, reclamation, floating districts) are used up or the sea is rising.
    const landPush = c.housing.crowding * 2 + clamp((c.land.pressure - 0.9) / 0.15, 0, 1) + (c.land.shelf < 0.01 ? 0.3 : 0);
    if (closedLoop && sp.launchCostIndex <= 0.08 && sp.orbitalIndustry >= 0.5 && wellEarned && wealth > 1.4 && (landPush > 0.5 || programPush > 1 || sp.habitatCapacityM > 0 || wealth > 3)) {
        const next = sp.habitatCapacityM < 0.2 ? 0.2 : clamp(sp.habitatCapacityM * 0.45, 0.3, sp.elevator ? 12 : 3);
        const occupancy = sp.habitatCapacityM > 0 ? orbitalPopulation(c) / Math.max(0.01, sp.habitatCapacityM) : 1;
        if (occupancy > 0.7)
            propose(w, c, 'orbital_habitat', next, sp.habitatCapacityM === 0 ? 'first permanent rotating habitat' : 'orbital habitat demand exceeds capacity');
    }
    // Mars: prestige first, then a real second home.
    if (closedLoop && sp.launchCostIndex <= 0.1 && sp.spaceportCapacity >= 1.5 && t.space_systems.reliability >= 0.6 && wellEarned && (c.traits.riskTolerance > 0.55 || programPush > 1)) {
        // An outpost first (science, prestige, a few thousand people); a real settlement only when Earth is short of room.
        const next = sp.marsCapacityM === 0 ? 0.005 : clamp(sp.marsCapacityM * 0.4, 0.02, 2);
        if (sp.marsCapacityM > 0 && landPush < 0.5 && programPush <= 1)
            return;
        const occupancy = sp.marsCapacityM > 0 ? Math.min(1, marsPopulation(c) / Math.max(0.01, sp.marsCapacityM)) : 1;
        if (occupancy > 0.6 && (sp.marsCapacityM === 0 || w.frontier.milestones.find((m) => m.id === 'terraforming')?.status !== 'locked'))
            propose(w, c, 'mars_colony', next, sp.marsCapacityM === 0 ? 'first permanent settlement on Mars' : 'expand Mars settlement');
    }
    // Space elevator: one per civilization, once the material exists.
    const tether = w.inventions.some((i) => i.id.startsWith('inv-orbital-tether-materials-') && i.status === 'deployed');
    if (tether && !sp.elevator && sp.orbitalIndustry >= 1.5 && wellEarned && wealth > 2) {
        propose(w, c, 'space_elevator', 1, 'replace rocket launch with a permanent tether to geostationary orbit');
    }
    // Power satellites: orbital solar beamed down. Attractive once launch is cheap.
    if (sp.orbitalIndustry >= 1 && (sp.launchCostIndex <= 0.05 || sp.elevator) && stable && (c.energy.marginPct < 15 || c.land.pressure > 0.9 || programPush > 1)) {
        propose(w, c, 'power_satellite', clamp(c.energy.demandTWh / 8.76 * 0.06, 0.5, 40), 'orbital solar power delivered without land or weather');
    }
    // Interstellar settlement is not a date unlock. It requires a mature, largely
    // self-sufficient off-world economy, deep-space population and extreme energy/
    // materials capability. The project represents slow ark / seed infrastructure,
    // not faster-than-light travel.
    const planetary = w.frontier.milestones.find((m) => m.id === 'planetary_energy')?.status === 'achieved';
    if (planetary && closedLoop && sp.orbitalIndustry > 8 && sp.habitatCapacityM + sp.marsCapacityM > 2 && c.population.offworld > 0.5 && t.space_systems.cap > 5 && t.space_systems.reliability > 0.8 && wellEarned && c.economy.outputPerCapita > 4) {
        const next = sp.deepSpaceCapacityM <= 0.001 ? 0.01 : clamp(sp.deepSpaceCapacityM * 0.5, 0.02, 1.5);
        const occupied = sp.deepSpaceCapacityM > 0 ? sp.interstellarM / Math.max(0.001, sp.deepSpaceCapacityM) : 1;
        if (occupied > 0.7)
            propose(w, c, 'interstellar_ark', next, sp.deepSpaceCapacityM <= 0.001 ? 'first self-sufficient interstellar seed mission' : 'expand interstellar settlement capacity');
    }
}
function civPolicyStrength(w, civId, policy) {
    let s = 0;
    for (const iv of w.activeInterventions)
        for (const ef of iv.effects)
            if (ef.kind === 'policy' && ef.civId === civId && ef.policy === policy)
                s += ef.strength;
    return s;
}
// ── project completion effects for frontier kinds ───────────────────────────
export function applyFrontierCompletion(w, c, p) {
    const sp = c.space;
    switch (p.kind) {
        case 'fusion': {
            const src = c.energy.sources.fusion;
            const old = src.cap;
            src.cap += p.capacity;
            src.condition = Math.min(1, (src.condition * old + p.capacity) / Math.max(0.001, src.cap));
            src.avgAgeYears = (src.avgAgeYears * old) / Math.max(0.001, src.cap);
            // Repeat builds are how fusion gets cheap: every completed plant lowers the next one's cost.
            const f = w.techs.fusion_power;
            // Learning per doubling of the fleet (~8%, the best fission programmes), not per plant; cautious regimes learn slower, unstable ones learn nothing (France/US negative learning).
            const plants = w.projects.filter((q) => q.kind === 'fusion' && q.status === 'operational').length + 1;
            const rate = plants <= 1 ? 0.92 : Math.pow(0.92, 1 / Math.log2(plants + 1)) * (1 + (c.traits.regulatoryCaution - 0.5) * 0.06) * (c.economy.institutionalCapacity < 0.4 ? 1.03 : 1);
            f.cost = Math.max(f.cost * Math.min(1, rate), 0.35);
            f.mfg *= 1.12;
            return true;
        }
        case 'spaceport':
            sp.spaceportCapacity += p.capacity;
            sp.orbitalIndustry += p.capacity * 0.15;
            return true;
        case 'asteroid_mining':
            sp.mineralInflow += p.capacity;
            sp.orbitalIndustry += p.capacity * 4;
            return true;
        case 'orbital_habitat':
            sp.habitatCapacityM += p.capacity;
            sp.orbitalIndustry += p.capacity * 0.6;
            return true;
        case 'mars_colony':
            sp.marsCapacityM += p.capacity;
            sp.orbitalIndustry += p.capacity * 0.4;
            return true;
        case 'interstellar_ark':
            sp.deepSpaceCapacityM += p.capacity;
            sp.orbitalIndustry += p.capacity * 0.2;
            return true;
        case 'space_elevator':
            sp.elevator = true;
            sp.orbitalIndustry += 2;
            return true;
        case 'power_satellite':
            sp.powerSatelliteGW += p.capacity;
            sp.orbitalIndustry += p.capacity * 0.05;
            return true;
        case 'recycling': return true; // counted directly from operational projects in resources.ts
        default: return false;
    }
}
export function frontierProjectSpec(w, c, kind, capacity) {
    const sp = c.space;
    const lc = sp.launchCostIndex;
    const mat = w.resources.mineralCostIndex;
    switch (kind) {
        case 'fusion': return { capex: capacity * CALIBRATION.generation.fusion.capexPerGW * clamp(w.techs.fusion_power.cost, 0.35, 8), leadMonths: CALIBRATION.generation.fusion.leadMonths };
        case 'spaceport': return { capex: capacity * 0.06 * (0.6 + 0.4 * mat), leadMonths: 36 };
        case 'asteroid_mining': return { capex: capacity * 2.4 * Math.sqrt(lc / 0.1), leadMonths: 72 };
        case 'orbital_habitat': return { capex: capacity * CALIBRATION.frontier.habitatCapexPerMillion * Math.sqrt(lc / 0.05) * (sp.elevator ? 0.35 : 1) * (0.5 + 0.5 * mat), leadMonths: 96 };
        case 'mars_colony': return { capex: capacity * 6 * Math.sqrt(lc / 0.1), leadMonths: 120 };
        case 'interstellar_ark': return { capex: capacity * 18 * Math.max(0.5, Math.sqrt(lc / 0.03)) * (0.7 + 0.3 * mat), leadMonths: 240 };
        case 'space_elevator': return { capex: 1.4 * (0.5 + 0.5 * mat), leadMonths: 180 };
        case 'power_satellite': return { capex: capacity * 0.2 * Math.pow(lc / 0.05, 0.6) * (sp.elevator ? 0.4 : 1) * (0.6 + 0.4 * mat), leadMonths: 48 };
        case 'recycling': return { capex: capacity * 1.5, leadMonths: 30 };
        default: return null;
    }
}
// ── monthly frontier step ───────────────────────────────────────────────────
export function reconcileFrontierPopulation(w) {
    // Population location/substrate can change again after stepFrontier (for example
    // territorial recovery can move off-world survivors back to Earth or embody
    // digital minds). Keep the world-level frontier ledger synchronized with the
    // civilization records at the end of every simulated month.
    for (const c of w.civs) {
        const sp = c.space;
        const totalCapacity = Math.max(0, sp.habitatCapacityM) + Math.max(0, sp.marsCapacityM) + Math.max(0, sp.deepSpaceCapacityM);
        c.population.offworld = Math.min(Math.max(0, c.population.offworld), Math.max(0, c.population.total), totalCapacity);
        c.population.digitalShare = clamp01(c.population.digitalShare);
        sp.interstellarM = Math.min(Math.max(0, sp.interstellarM), c.population.offworld, Math.max(0, sp.deepSpaceCapacityM));
        sp.marsPopulationM = Math.min(Math.max(0, sp.marsPopulationM), Math.max(0, sp.marsCapacityM), Math.max(0, c.population.offworld - sp.interstellarM));
    }
    w.frontier.offworldPopulationM = w.civs.reduce((a, c) => a + c.population.offworld, 0);
    w.frontier.digitalPopulationM = w.civs.reduce((a, c) => a + c.population.total * c.population.digitalShare, 0);
}
export function stepFrontier(w) {
    const fr = w.frontier;
    const yearly = w.tMonths % 12 === 0;
    for (const c of w.civs) {
        c.frontierReadiness = lerp(c.frontierReadiness, computeFrontierReadiness(c), 0.08);
        const sp = c.space;
        const t = w.techs.space_systems;
        // Launch cost follows the space-systems experience curve, then the elevator floor.
        const rocketTarget = clamp(t.cost * (1 - Math.min(0.5, sp.spaceportCapacity * 0.08)), 0.02, 1.2);
        const target = sp.elevator ? CALIBRATION.frontier.launchCostFloor : rocketTarget;
        sp.launchCostIndex = lerp(sp.launchCostIndex, target, 0.04);
        // Orbital industry needs workers somewhere. Earth launch activity contributes only
        // while embodied Earth residents exist; established off-world settlements can
        // maintain/grow their own orbital industry after the home territory empties.
        const earthPop = physicalPopulation(c);
        const earthActivity = earthPop > 0.001 ? sp.spaceportCapacity * 0.02 * DT * t.adoption[c.id].intensity : 0;
        const offworldActivity = c.population.offworld > 0.01 ? Math.log1p(c.population.offworld * 20) * 0.006 * DT * t.adoption[c.id].intensity : 0;
        const decay = earthPop <= 0.001 && c.population.offworld <= 0.01 ? 0.06 : 0.01;
        sp.orbitalIndustry = Math.max(0, sp.orbitalIndustry * (1 - decay * DT) + earthActivity + offworldActivity);
        t.adoption[c.id].penetration = clamp01(Math.max(t.adoption[c.id].penetration, Math.min(1, (earthPop > 0.001 ? sp.spaceportCapacity * 0.25 : 0) + sp.orbitalIndustry * 0.05)));
        // Migration off Earth: only embodied Earth residents can leave Earth. The
        // destination is now explicit: orbital/cislunar habitats or Mars. Deep-space
        // arks are populated from an already established off-world civilization.
        const orbitalPop = orbitalPopulation(c);
        const marsPop = marsPopulation(c);
        const orbitRoom = Math.max(0, sp.habitatCapacityM - orbitalPop);
        const marsRoom = Math.max(0, sp.marsCapacityM - marsPop);
        const homeRoom = orbitRoom + marsRoom;
        if (earthPop > 0 && homeRoom > 0.001) {
            const push = 0.35 + c.housing.crowding * 1 + clamp((c.land.pressure - 0.85) / 0.2, 0, 1) * 0.6 + Math.max(0, 0.5 - c.society.stability) + civPolicyStrength(w, c.id, 'space_program') * 0.5;
            const flow = Math.min(homeRoom, earthPop * 0.0035 * push * DT);
            const marsWeight = marsRoom * (0.65 + c.traits.riskTolerance * 0.35);
            const orbitWeight = orbitRoom;
            const marsFlow = flow * marsWeight / Math.max(1e-9, marsWeight + orbitWeight);
            sp.marsPopulationM += marsFlow;
            c.population.offworld += Math.max(0, flow);
        }
        // Off-world populations grow once settlements are large enough. Births/created
        // residents occupy actual free volume in orbit, on Mars or in deep-space craft;
        // deep-space capacity no longer consumes a home-system housing slot.
        if (c.population.offworld > 0.05) {
            const orbitFree = Math.max(0, sp.habitatCapacityM - orbitalPopulation(c));
            const marsFree = Math.max(0, sp.marsCapacityM - marsPopulation(c));
            const deepFree = Math.max(0, sp.deepSpaceCapacityM - deepSpacePopulation(c));
            const room = orbitFree + marsFree + deepFree;
            const born = Math.min(room, c.population.offworld * 0.006 * DT);
            if (born > 0) {
                const marsBorn = born * marsFree / Math.max(1e-9, room);
                const deepBorn = born * deepFree / Math.max(1e-9, room);
                sp.marsPopulationM += marsBorn;
                sp.interstellarM += deepBorn;
                c.population.offworld += born;
                c.population.total += born;
            }
        }
        // Off-world share is bounded by the volume that physically exists across all
        // three location classes, not by an arbitrary requirement to leave people on Earth.
        const totalCapacity = sp.habitatCapacityM + sp.marsCapacityM + sp.deepSpaceCapacityM;
        c.population.offworld = Math.min(c.population.offworld, Math.max(0, Math.min(c.population.total, totalCapacity)));
        // Deep-space migration transfers existing off-world residents out of the home
        // system. It changes location, not total population. Prefer drawing from orbital
        // settlements; if those are empty, some migrants can depart Mars.
        if (sp.deepSpaceCapacityM > sp.interstellarM + 0.0001 && c.population.offworld - sp.interstellarM > 0.05) {
            const homeOffworld = Math.max(0, c.population.offworld - sp.interstellarM);
            const flow = Math.min(sp.deepSpaceCapacityM - sp.interstellarM, homeOffworld * 0.00035 * DT);
            const orbitBefore = orbitalPopulation(c);
            sp.interstellarM += Math.max(0, flow);
            if (flow > orbitBefore)
                sp.marsPopulationM = Math.max(0, sp.marsPopulationM - (flow - orbitBefore));
        }
        sp.interstellarM = Math.min(sp.interstellarM, Math.min(c.population.offworld, sp.deepSpaceCapacityM));
        sp.marsPopulationM = Math.min(sp.marsPopulationM, sp.marsCapacityM, Math.max(0, c.population.offworld - sp.interstellarM));
        // Digital minds: only after the substrate exists, and only where compute is spare.
        const upload = fr.milestones.find((m) => m.id === 'mind_upload');
        if (upload?.status === 'achieved') {
            const computeRoom = clamp(c.compute.supplyFlops / Math.max(0.1, c.compute.demandFlops) - 1, 0, 1);
            const targetShare = clamp(0.15 + (w.frontier.asi ? 0.35 : 0) + c.traits.openness * 0.2, 0, 0.7);
            c.population.digitalShare = clamp01(c.population.digitalShare + (targetShare - c.population.digitalShare) * 0.004 * DT * 12 * (0.3 + computeRoom * 0.7));
        }
        c.population.peakPhysical = Math.max(c.population.peakPhysical, physicalPopulation(c));
    }
    // Orbital power feeds the grid.
    for (const c of w.civs) {
        const dyson = fr.milestones.find((m) => m.id === 'dyson_swarm');
        // Swarm power beamed to Earth is capped by what receivers and grids can take; the rest powers space industry.
        const dysonTWh = dyson && dyson.status !== 'locked' && dyson.status !== 'available' ? Math.min(c.energy.demandTWh * 1.5, Math.pow(10, -2 + 5 * dyson.progress) * 1e3) : 0;
        c.energy.spaceSolarTWh = c.space.powerSatelliteGW * 8.76 * 0.95 + dysonTWh;
    }
    // Kardashev index.
    const totalElectric = w.civs.reduce((a, c) => a + Math.max(0, c.energy.servedTWh) + c.energy.spaceSolarTWh * 0.2, 0);
    const meanEv = w.civs.reduce((a, c) => a + w.techs.transport_ev.adoption[c.id].penetration, 0) / w.civs.length;
    const fossilGen = w.civs.reduce((a, c) => a + c.energy.sources.fossil.cap * 0.55, 0);
    const allGen = w.civs.reduce((a, c) => a + Object.values(c.energy.sources).reduce((x, s) => x + s.cap, 0) * 0.5, 0);
    const primaryMult = 1.4 + 1.1 * clamp(1 - meanEv * 0.6 - (1 - fossilGen / Math.max(1, allGen)) * 0.3, 0, 1);
    const dysonM = fr.milestones.find((m) => m.id === 'dyson_swarm');
    const dysonFraction = dysonM && dysonM.status !== 'locked' && dysonM.status !== 'available' ? Math.pow(10, -9 + 5 * dysonM.progress) : 0;
    const dysonTW = dysonFraction * 3.8e14; // solar luminosity 3.8e26 W = 3.8e14 TW
    fr.energyCaptureTW = totalElectric * primaryMult * CALIBRATION.frontier.worldScaleFactor / 8760 + dysonTW;
    fr.kardashev = (Math.log10(Math.max(1e-3, fr.energyCaptureTW) * 1e12) - 6) / 10;
    fr.offworldPopulationM = w.civs.reduce((a, c) => a + c.population.offworld, 0);
    fr.digitalPopulationM = w.civs.reduce((a, c) => a + c.population.total * c.population.digitalShare, 0);
    // Milestones.
    const wasAgi = fr.agi, wasAsi = fr.asi;
    for (const ms of fr.milestones) {
        if (ms.status === 'achieved')
            continue;
        const def = milestoneDef(ms.id);
        const blockers = def.check(w);
        ms.blockers = blockers;
        if (def.kind === 'threshold') {
            if (blockers.length === 0)
                achieve(w, ms.id);
            else
                ms.status = 'locked';
            continue;
        }
        // programs: prerequisites hold → available → in progress while funded
        if (blockers.length > 0) {
            if (ms.status !== 'in_progress')
                ms.status = 'locked';
            continue;
        }
        if (ms.status === 'locked') {
            ms.status = 'available';
            addEvent(w, {
                title: `${def.name}: prerequisites met`,
                body: `${def.summary} The program can begin if civilizations fund it (about ${((def.costShare ?? 0) * 100).toFixed(1)}% of world output per year for roughly ${def.baseYears} years at full funding).`,
                category: 'frontier', significance: 2,
                causes: [{ factor: 'enabling milestones reached', weight: 0.7 }, { factor: 'orbital industry and energy surplus', weight: 0.3 }],
                counterforces: [{ factor: 'decades of sustained financing required', weight: 0.7 }], confidence: 'medium',
            });
        }
        if (ms.status === 'available' || ms.status === 'in_progress') {
            // Funding: wealthy, stable civs contribute; crises pause it.
            const worldOut = w.civs.reduce((a, c) => a + c.economy.output, 0);
            let funded = 0;
            for (const c of w.civs) {
                // Only civilizations that have earned the frontier pay for it; the contribution scales with how well earned.
                if (c.frontierReadiness < 0.55)
                    continue;
                const share = c.economy.output / Math.max(0.1, worldOut);
                const ambition = (0.5 + c.traits.sciencePriority * 0.5 + civPolicyStrength(w, c.id, 'space_program') * 0.5) * clamp((c.frontierReadiness - 0.45) / 0.35, 0, 1);
                funded += share * ambition;
            }
            funded = clamp(funded, 0, 1.1);
            if (funded > 0.2) {
                if (ms.status === 'available') {
                    ms.status = 'in_progress';
                    addEvent(w, {
                        title: `${def.name} — program begins`,
                        body: `${def.effect}`, category: 'frontier', significance: 3,
                        causes: [{ factor: 'sustained investment capacity', weight: 0.5 }, { factor: 'political stability in funding civilizations', weight: 0.5 }],
                        counterforces: [{ factor: 'cost overruns and technical dead ends', weight: 0.6 }], confidence: 'medium',
                    });
                }
                // Intelligence speeds design, not construction: mega-engineering is bound by matter and time.
                const toolMult = Math.sqrt(agiToolingBoost(w));
                ms.progress = clamp01(ms.progress + funded * toolMult / Math.max(5, def.baseYears ?? 30) * DT);
                // Setbacks: launch failures, structural surprises, political reversals. Harder programs suffer more.
                if (ms.progress > 0.05 && chance(w.rng, 0.0045 * DT * 12)) {
                    const loss = 0.04 + 0.10 * (def.baseYears ?? 30) / 160;
                    ms.progress = Math.max(0.02, ms.progress - loss);
                    addEvent(w, {
                        title: `${def.name}: major setback`,
                        body: `A failure in the program erased roughly ${(loss * 100).toFixed(0)}% of accumulated progress. The program continues; the schedule slips.`,
                        category: 'frontier', significance: 2,
                        causes: [{ factor: 'first-of-a-kind engineering risk', weight: 0.6 }, { factor: 'funding and political volatility', weight: 0.4 }],
                        counterforces: [{ factor: 'lessons incorporated into the next attempt', weight: 0.5 }], confidence: 'medium',
                    });
                }
                // The program bills the funders.
                const cost = (def.costShare ?? 0) * worldOut * funded * DT;
                for (const c of w.civs) {
                    const share = c.economy.output / Math.max(0.1, worldOut);
                    c.economy.investmentBudget = Math.max(0.01, c.economy.investmentBudget - cost * share * 12 * 0.5);
                    c.economy.publicDebt = clamp(c.economy.publicDebt + cost * share / Math.max(0.05, c.economy.output) * 0.35, 0.05, 4.5);
                }
                if (ms.progress >= 1)
                    achieve(w, ms.id);
            }
        }
    }
    fr.agi = fr.milestones.find((m) => m.id === 'agi')?.status === 'achieved';
    fr.asi = fr.milestones.find((m) => m.id === 'asi')?.status === 'achieved';
    if (!wasAgi && fr.agi)
        for (const c of w.civs)
            c.economy.automationExposure = clamp(c.economy.automationExposure + 0.15, 0, 0.9);
    if (!wasAsi && fr.asi)
        for (const c of w.civs)
            c.researchCapacity *= 1.5;
    // Program side effects while in progress.
    const terra = fr.milestones.find((m) => m.id === 'terraforming');
    if (terra && terra.status === 'in_progress') {
        for (const c of w.civs)
            if (c.space.marsCapacityM > 0)
                c.space.marsCapacityM += (0.15 + terra.progress * 0.8) * DT;
    }
    const planetary = fr.milestones.find((m) => m.id === 'planetary_energy');
    if (planetary?.status === 'achieved') {
        // Direct air capture and weather mitigation become affordable: warming is pulled back toward pre-crisis levels.
        w.env.warmingC = Math.max(1.0, w.env.warmingC - 0.02 * DT);
    }
    // Era & trajectory (yearly).
    fr.era = currentEra(w);
    if (yearly)
        classifyTrajectory(w);
}
function achieve(w, id) {
    const ms = w.frontier.milestones.find((m) => m.id === id);
    const def = milestoneDef(id);
    ms.status = 'achieved';
    ms.progress = 1;
    ms.achievedAt = w.tMonths;
    ms.blockers = [];
    const year = Math.floor(yearOf(w));
    const deepFuture = def.illustrativeYear > 2100;
    addEvent(w, {
        title: `Milestone: ${def.name}`,
        body: `${def.summary} ${def.effect} Reached in this seeded world in ${year}; the date is generated by model conditions, not a forecast or roadmap commitment.`,
        category: 'frontier', significance: 3,
        causes: def.requires.map((r) => ({ factor: r, weight: 1 / Math.max(1, def.requires.length) })),
        counterforces: [], confidence: deepFuture ? 'low' : 'medium',
    });
}
function currentEra(w) {
    let era = 1;
    for (const ms of w.frontier.milestones) {
        if (ms.status === 'achieved') {
            const d = milestoneDef(ms.id);
            if (d.era > era)
                era = d.era;
        }
    }
    const achievedInEra = w.frontier.milestones.filter((m) => m.status === 'achieved' && milestoneDef(m.id).era === era).length;
    const totalInEra = MILESTONES.filter((m) => m.era === era).length;
    return `${ERA_LABELS[era]} (${achievedInEra}/${totalInEra})`;
}
function updateOutcomeProfile(w) {
    const mean = (fn) => w.civs.reduce((a, c) => a + fn(c), 0) / Math.max(1, w.civs.length);
    const geo = (xs) => Math.pow(xs.reduce((a, x) => a * clamp(x, 0.02, 1), 1), 1 / xs.length);
    const energy = mean((c) => clamp(c.energy.servedTWh / Math.max(1, c.energy.demandTWh), 0, 1));
    const food = mean((c) => clamp(1 - c.food.shortage * 2.5, 0, 1));
    const housing = mean((c) => clamp(1 - c.housing.crowding * 1.6 - c.housing.abandoned * 0.7, 0, 1));
    const materialSecurity = geo([energy, food, housing]);
    const health = mean((c) => clamp((c.population.lifeExpectancy - 55) / 45, 0, 1));
    const education = mean((c) => clamp(c.population.education / 1.15, 0, 1));
    const provision = mean((c) => clamp(0.55 + c.society.basicProvision * 0.5, 0, 1));
    const humanDevelopment = geo([health, education, provision]);
    const institutionalHealth = geo([
        mean((c) => c.society.stability),
        mean((c) => c.society.trust),
        mean((c) => c.economy.institutionalCapacity),
    ]);
    const climate = clamp(1 - Math.max(0, w.env.warmingC - 1.35) / 3.0, 0, 1);
    const waste = mean((c) => clamp(1 - c.waste.accumulation * 1.2, 0, 1));
    const resourceStress = clamp(1 - Math.max(0, w.resources.mineralCostIndex - 1) / 3.5, 0.15, 1);
    const ecologicalSafety = geo([climate, waste, resourceStress]);
    const distribution = geo([
        mean((c) => clamp((0.72 - c.economy.gini) / 0.48, 0, 1)),
        mean((c) => clamp(0.45 + c.society.basicProvision * 0.6 + (1 - c.economy.unemployment) * 0.1, 0, 1)),
    ]);
    const reserve = mean((c) => clamp((c.energy.marginPct + 5) / 25, 0, 1));
    const fiscal = mean((c) => clamp(1.15 - c.economy.publicDebt * 0.28, 0, 1));
    const readiness = mean((c) => c.frontierReadiness);
    const resilience = geo([reserve, fiscal, institutionalHealth, readiness]);
    const axes = { materialSecurity, humanDevelopment, institutionalHealth, ecologicalSafety, distribution, resilience };
    w.frontier.outcome = { ...axes, broadFlourishing: geo(Object.values(axes)) };
    const totalPop = Math.max(0.1, w.civs.reduce((a, c) => a + c.population.total, 0));
    const offShare = w.frontier.offworldPopulationM / totalPop;
    const digitalShare = w.frontier.digitalPopulationM / totalPop;
    const ocean = w.civs.reduce((a, c) => a + c.land.floating + c.land.subsea + c.land.reclaimed * 0.35, 0) / w.civs.length;
    const forms = [offShare > 0.015, digitalShare > 0.10, ocean > 0.035].filter(Boolean).length;
    w.frontier.developmentForm = forms > 1 ? 'mixed' : offShare > 0.015 ? 'spacefaring' : digitalShare > 0.10 ? 'digital' : ocean > 0.035 ? 'oceanic' : 'earthbound';
}
function classifyTrajectory(w) {
    const fr = w.frontier;
    updateOutcomeProfile(w);
    const m = w.metrics;
    const n = m.length;
    const pick = (k) => m[Math.max(0, n - 1 - k)];
    const now = pick(0), ago = pick(40); // 20 years (metrics every 6 months)
    const pop = (x) => w.civs.reduce((a, c) => a + x.population[c.id], 0);
    const out = (x) => w.civs.reduce((a, c) => a + x.output[c.id], 0);
    const startPop = w.civs.reduce((a, c) => a + civDef(c.id).population.total, 0);
    const livingNow = w.civs.reduce((a, c) => a + c.population.total, 0);
    for (const c of w.civs) {
        const remnantKey = `remnant-${c.id}`;
        const extinctKey = `extinct-${c.id}`;
        const remnantThreshold = civDef(c.id).population.total * 0.01;
        if (c.population.total > 1e-6 && c.population.total < remnantThreshold && !w.flags[remnantKey]) {
            w.flags[remnantKey] = true;
            addEvent(w, {
                title: `${c.name} becomes a remnant society`,
                body: `Fewer than one percent of its 2026 population remain. That is demographic and institutional collapse, not extinction: survivors may persist locally, off-world or digitally, and the territory may later be resettled.`,
                category: 'milestone', civId: c.id, significance: 3,
                causes: [{ factor: 'severe demographic loss', weight: 0.6 }, { factor: 'institutional collapse', weight: 0.4 }],
                counterforces: [{ factor: 'survivors and resettlement', weight: 0.5 }], confidence: 'high',
            });
        }
        if (c.population.total <= 1e-6 && !w.flags[extinctKey]) {
            w.flags[extinctKey] = true;
            addEvent(w, {
                title: `${c.name}'s population reaches zero`,
                body: `No embodied, off-world or digital population remains in this civilization. It cannot recover by itself. The territory may still be occupied later by survivors from somewhere else.`,
                category: 'milestone', civId: c.id, significance: 3,
                causes: [{ factor: 'complete population loss', weight: 1 }], counterforces: [], confidence: 'high',
            });
        }
    }
    // Extinction is literal. Falling below an arbitrary percentage of the 2026
    // population is collapse/remnant status, not 'everyone is dead'.
    if (livingNow <= 1e-6) {
        fr.trajectory = 'extinction';
        fr.trajectoryNote = 'No embodied, off-world or digital population remains anywhere in the simulated civilization.';
        if (!w.flags['world-extinct']) {
            w.flags['world-extinct'] = true;
            addEvent(w, { title: 'The last population disappears', body: 'There are no people or surviving digital minds left in the simulated civilization. Cities stand dark, infrastructure decays and ecological succession continues without a human recovery path.', category: 'milestone', significance: 3, causes: [{ factor: 'compound terminal collapse', weight: 1 }], counterforces: [], confidence: 'high' });
        }
        return;
    }
    if (!now || !ago || n < 12) {
        fr.trajectory = 'growth';
        fr.trajectoryNote = 'Too early to classify: the first decade sets the baseline.';
        return;
    }
    const popTrend = pop(now) / Math.max(0.1, pop(ago)) - 1;
    const perCapNow = out(now) / Math.max(0.1, pop(now));
    const perCapAgo = out(ago) / Math.max(0.1, pop(ago));
    const perCapGrowth = Math.pow(Math.max(0.05, perCapNow / Math.max(0.01, perCapAgo)), 1 / 20) - 1;
    const meanStab = w.civs.reduce((a, c) => a + c.society.stability, 0) / w.civs.length;
    const worstServed = Math.min(...w.civs.map((c) => c.energy.servedTWh / Math.max(1, c.energy.demandTWh)));
    const peakOut = Math.max(...m.map(out));
    const outNow = out(now);
    const achieved = fr.milestones.filter((x) => x.status === 'achieved').length;
    const decayed = w.civs.reduce((a, c) => a + c.housing.abandoned, 0) / w.civs.length;
    const meanReadiness = w.civs.reduce((a, c) => a + c.frontierReadiness, 0) / w.civs.length;
    const popAgo30 = w.metrics.length > 30 ? w.civs.reduce((a, c) => a + (w.metrics[w.metrics.length - 31].population[c.id] ?? c.population.total), 0) : livingNow;
    const popLoss30 = 1 - livingNow / Math.max(1, popAgo30);
    if (livingNow < startPop * 0.01) {
        fr.trajectory = 'collapse';
        fr.trajectoryNote = `${livingNow.toFixed(3)}M people remain: a remnant civilization, not literal extinction. Recovery depends on surviving institutions, off-world/digital continuity and resettlement.`;
    }
    else if (livingNow < startPop * 0.5 || popLoss30 > 0.4) {
        fr.trajectory = 'collapse';
        fr.trajectoryNote = `${livingNow.toFixed(0)}M people remain of ${startPop.toFixed(0)}M in 2026${popLoss30 > 0.4 ? `; ${(popLoss30 * 100).toFixed(0)}% lost in thirty years` : ''}.`;
    }
    else if (popLoss30 > 0.2 && !w.civs.every((c) => c.society.stability > 0.5)) {
        fr.trajectory = 'crisis';
        fr.trajectoryNote = `${(popLoss30 * 100).toFixed(0)}% of the population lost in thirty years; not the slow shrinking of an old society but flight and death.`;
    }
    else if (fr.outcome.broadFlourishing >= 0.86 && fr.outcome.institutionalHealth >= 0.78 && fr.outcome.ecologicalSafety >= 0.70 && fr.outcome.distribution >= 0.85 && worstServed >= 0.95 && !w.civs.some((c) => c.food.shortage > 0.05)) {
        fr.trajectory = 'flourishing';
        fr.trajectoryNote = `Broad outcomes are strong (${Math.round(fr.outcome.broadFlourishing * 100)}/100): material security, human development, institutions, ecology, distribution and resilience all remain viable. Development form: ${fr.developmentForm}.`;
    }
    else if (outNow < peakOut * 0.45 && meanStab < 0.35 && (popLoss30 > 0.1 || worstServed < 0.9 || w.civs.some((c) => c.food.shortage > 0.05))) {
        // Output alone is not collapse: a fed, powered, growing population with a shrinking money economy is a different story (see knowledge/open-questions.md).
        fr.trajectory = 'collapse';
        fr.trajectoryNote = `Output is ${((1 - outNow / peakOut) * 100).toFixed(0)}% below its peak and institutions have failed in most of the region.`;
    }
    else if (worstServed < 0.85 || meanStab < 0.4 || w.civs.some((c) => c.food.shortage > 0.08)) {
        fr.trajectory = 'crisis';
        fr.trajectoryNote = 'At least one civilization is in an acute energy, food or political crisis.';
    }
    else if (achieved >= 5 && fr.kardashev > 0.78 && meanReadiness >= 0.58 && fr.outcome.broadFlourishing >= 0.50 && perCapGrowth > 0.008) {
        fr.trajectory = 'ascent';
        fr.trajectoryNote = `Capability is expanding rapidly (${achieved} frontier milestones; K ${fr.kardashev.toFixed(2)}), while lived-outcome score is ${Math.round(fr.outcome.broadFlourishing * 100)}/100. Expansion is not treated as proof of flourishing.`;
    }
    else if (popTrend < -0.06 && perCapGrowth > 0.002 && decayed < 0.25) {
        fr.trajectory = 'managed_decline';
        fr.trajectoryNote = `Population fell ${(-popTrend * 100).toFixed(0)}% in 20 years while living standards held; cities are consolidating, not collapsing.`;
    }
    else if (perCapGrowth < 0.003 && achieved < 2) {
        fr.trajectory = 'stagnation';
        fr.trajectoryNote = `Output per person grew ${(perCapGrowth * 100).toFixed(1)}%/yr over 20 years; no frontier program has paid off.`;
    }
    else {
        fr.trajectory = 'growth';
        fr.trajectoryNote = `Output per person growing ${(perCapGrowth * 100).toFixed(1)}%/yr; ${achieved} frontier milestone${achieved === 1 ? '' : 's'} reached.`;
    }
}
