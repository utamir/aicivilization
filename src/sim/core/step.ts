// ─────────────────────────────────────────────────────────────────────────────
// STEP ENGINE — one monthly tick of the whole world.
// Systems: technology/research → energy → compute → economy → population →
// society → diplomacy → events → characters → metrics.
// Every number is either calibrated (see evidence registry) or marked tuning.
// ─────────────────────────────────────────────────────────────────────────────
import type { WorldState, CivState, TechId, CivId, ChronicleEvent, CausalFactor, ProjectKind, ResearchProgramState } from '../types';
import { CIV_IDS } from '../types';
import { TECH_DEFS, TECH_IDS } from '../data/techDefs';
import { civDef } from '../data/civDefs';
import { CAPACITY_FACTOR } from './world';
import { CALIBRATION } from '../data/calibration';
import { candidatesFor, nextCandidate, followOnCandidate } from '../data/inventions';
import { nextFloat, gaussian, chance } from '../rng';
import { taskHorizonHrs, autonomyIndex, clamp01, clamp, lerp } from './formulas';
import { stepResources, materialCapexMultiplier } from './resources';
import { stepFrontier, reconcileFrontierPopulation, planFrontierProjects, agiToolingBoost, physicalPopulation, applyFrontierCompletion, frontierProjectSpec } from './frontier';
import { fossilDispatchFactor } from './resources';
import { stepDecisions } from './decisions';
import { stepSocietyDynamics } from './society';
import { reconcile, stepCohorts } from './demography';
import { stepLand, planLandProjects, landProjectSpec, applyLandCompletion, landRoomForHousing, housingLandCapexMultiplier } from './land';

const DT = 1 / 12; // one month, in years
const RESEARCH_SCALE = 2.6; // global research-effort scale (tuning; sets baseline AI trend to empirical ~7mo task-horizon doubling)

export function yearOf(w: WorldState): number { return w.startYear + w.tMonths / 12; }

/**
 * 0..1 — how hard electricity scarcity is biting a civilization.
 * Driven by unmet demand (margin < 0 = load shedding/blackouts) and compounded
 * by sustained high prices. This is THE coupling variable: deep shortage must
 * contract output, raise unemployment, erode stability, kill and displace
 * people, and sour international relations — as it would in the real world.
 */
export function energyHardship(c: CivState): number {
  const unmetShare = c.energy.demandTWh > 0 ? c.energy.unservedTWh / c.energy.demandTWh : 0;
  const servicePain = 1 - (0.35 * c.energy.criticalServedRatio + 0.45 * c.energy.industryServedRatio + 0.20 * c.energy.computeServedRatio);
  const pricePain = clamp((c.energy.priceIndex - 1.35) / 3, 0, 0.35);
  return clamp(unmetShare * 1.4 + servicePain * 0.8 + pricePain, 0, 1);
}
export function dateLabel(w: WorldState): string {
  const total = 8 + w.tMonths; // September 2026 start (month idx 8)
  const y = w.startYear + Math.floor(total / 12);
  const m = total % 12;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m]} ${y}`;
}

export function addEvent(
  w: WorldState,
  e: Omit<ChronicleEvent, 'id' | 'tMonths' | 'year'>,
): ChronicleEvent {
  const ev: ChronicleEvent = {
    ...e,
    id: `ev-${w.eventCounter++}`,
    tMonths: w.tMonths,
    year: Math.floor(yearOf(w)),
  };
  // Once literal global extinction has been recorded, civilization no longer
  // produces a chronicle. Climate, sea level, ruins and ecology continue to
  // evolve, but there are no researchers, diplomats, councils or observers
  // inside the world to create milestones or negotiations. The one exception
  // is the terminal event itself, written at the instant extinction is detected.
  if (w.flags['world-extinct'] && e.title !== 'The last population disappears') return ev;
  w.chronicle.push(ev);
  return ev;
}

function activeEffortMult(w: WorldState, techId: TechId): number {
  let m = 1;
  for (const iv of w.activeInterventions)
    for (const ef of iv.effects)
      if (ef.kind === 'effort' && ef.techId === techId) m *= ef.mult;
  return m;
}

function civPolicy(w: WorldState, civId: CivId, policy: string): number {
  let s = 0;
  for (const iv of w.activeInterventions)
    for (const ef of iv.effects)
      if (ef.kind === 'policy' && ef.civId === civId && ef.policy === policy) s += ef.strength;
  return s;
}

function activeGlobalMult(w: WorldState, param: 'collaboration' | 'capitalAvailability' | 'regulation'): number {
  let m = 1;
  for (const iv of w.activeInterventions)
    for (const ef of iv.effects)
      if (ef.kind === 'global' && ef.param === param) m *= ef.mult;
  return m;
}

export { taskHorizonHrs };

// ── 1. TECHNOLOGY & RESEARCH ────────────────────────────────────────────────
// Progress emerges from: effort × productivity × tooling × spillover ÷ difficulty,
// gated by dependencies and physical constraints, with per-paradigm asymptotes,
// experience-curve costs, paradigm transitions and epistemic uncertainty.

export interface TechTickInfo {
  growthRate: number;
  accelerators: string[];
  constraints: string[];
}

export const techTickCache: Record<string, TechTickInfo> = {};

function dependencyReadiness(w: WorldState, techId: TechId): number {
  const deps = TECH_DEFS[techId].deps;
  const keys = Object.keys(deps) as TechId[];
  if (keys.length === 0) return 1;
  let sum = 0;
  for (const k of keys) {
    const dep = w.techs[k];
    // dependency "ready" when its capability ≈ 2× its 2026 level and mature
    const ready = clamp01((dep.cap / 2) * 0.7 + dep.maturity * 0.3);
    sum += deps[k]! * ready;
  }
  return clamp01(sum / Math.max(0.001, keys.reduce((a, k) => a + deps[k]!, 0)) * (keys.reduce((a, k) => a + deps[k]!, 0)));
}

function globalComputeBoost(w: WorldState): number {
  let supply = 0;
  for (const c of w.civs) supply += c.compute.supplyFlops;
  // supply index relative to start-of-world (~sum of accelStock at t0 ≈ 2.05)
  return clamp(supply / 2.05, 0.2, 40);
}

function toolingMultiplier(w: WorldState, techId: TechId, computeBoost: number): { mult: number; parts: string[] } {
  const d = TECH_DEFS[techId];
  const ai = w.techs.ai_models;
  const lab = w.techs.robotics_ind;
  const parts: string[] = [];
  let mult = 1;
  // Tooling gains are logarithmic in capability (diminishing returns to tools)
  // and capped — they bend curves, they do not create runaway by themselves.
  if (d.aiToolingGain > 0) {
    const g = Math.min(3, d.aiToolingGain * Math.log(Math.max(1, ai.cap)) * 0.5 * w.params.aiTooling);
    if (g > 0.1) parts.push('AI-assisted research');
    mult *= 1 + g;
  }
  if (d.labAutomationGain > 0) {
    const g = Math.min(2, d.labAutomationGain * Math.log(Math.max(1, lab.cap)) * 0.45);
    if (g > 0.1) parts.push('laboratory automation');
    mult *= 1 + g;
  }
  if (d.computeGain > 0) {
    const g = Math.min(2, d.computeGain * (Math.pow(Math.max(0.2, computeBoost), 0.18) - 1));
    if (g > 0.1) parts.push('compute abundance');
    mult *= 1 + g;
  }
  return { mult, parts };
}

function stepTechnology(w: WorldState) {
  const computeBoost = globalComputeBoost(w);
  // AI recursive feedback: a dimensionless autonomy-capability proxy multiplies AI-domain research.
  // Capped — feedback bends the trajectory, physical constraints still bind.
  const horizonDoublings = Math.log2(Math.max(0.5, autonomyIndex(w.techs.ai_agents.cap))); // dimensionless beyond the empirical task-suite ceiling
  const aiFeedbackMult = 1 + Math.min(3.5, w.params.aiFeedback * 0.13 * Math.max(0, horizonDoublings));

  // collaboration spillover from relations + scenario
  let collab = w.params.collaboration * activeGlobalMult(w, 'collaboration');
  const meanSci = w.relations.reduce((a, r) => a + r.sciCollaboration, 0) / w.relations.length;
  const spillover = 1 + (collab - 1) * 0.6 + meanSci * 0.25;

  for (const id of TECH_IDS) {
    const d = TECH_DEFS[id];
    const t = w.techs[id];
    const info: TechTickInfo = { growthRate: 0, accelerators: [], constraints: [] };

    // dependency readiness gate (can't outrun what you depend on)
    const depReady = dependencyReadiness(w, id);
    t.depReady = depReady;
    const depGate = 0.2 + 0.8 * depReady;
    if (depReady < 0.65) info.constraints.push(`dependencies immature (${(depReady * 100) | 0}%)`);

    // research effort: Σ civ capacity × allocation, × intervention boosts
    let effort = 0;
    for (const c of w.civs) {
      effort += c.researchCapacity * c.researchAlloc[id] * (0.6 + 0.4 * c.traits.sciencePriority);
    }
    effort *= RESEARCH_SCALE * activeEffortMult(w, id);

    const { mult: toolBase, parts } = toolingMultiplier(w, id, computeBoost);
    const tool = toolBase * agiToolingBoost(w);
    info.accelerators.push(...parts);
    if (w.frontier.asi) info.accelerators.push('superintelligent research systems');
    else if (w.frontier.agi) info.accelerators.push('general-intelligence research systems');

    // domain speed knobs
    let domainMult = 1;
    if (id === 'ai_models' || id === 'ai_agents') domainMult *= w.params.aiProgressMult * aiFeedbackMult;
    if (id === 'robotics_ind' || id === 'robotics_gp') domainMult *= w.params.roboticsMult;
    if (id === 'solar_pv' || id === 'wind_power' || id === 'storage_batt') domainMult *= 0.7 + 0.3 * w.params.cleanLearningMult;
    if (id === 'fusion_power') domainMult *= w.params.fusionMult;
    if (id === 'longevity_bio') domainMult *= w.params.longevityMult;
    if (id === 'space_systems') domainMult *= w.params.spaceMult;

    if ((id === 'ai_models' || id === 'ai_agents') && aiFeedbackMult > 1.15) info.accelerators.push('AI improving AI research');

    // physical constraints on research itself
    let constraintGate = 1;
    if (id === 'ai_models' || id === 'ai_agents' || id === 'compute_accel') {
      // compute scarcity binds AI research
      let sup = 0, dem = 0;
      for (const c of w.civs) { sup += c.compute.supplyFlops; dem += c.compute.demandFlops; }
      const ratio = dem > 0 ? sup / dem : 1;
      if (ratio < 1) {
        constraintGate *= clamp(0.35 + 0.65 * ratio, 0.2, 1);
        info.constraints.push('compute scarcity');
      }
    }
    if (id === 'compute_accel' || id === 'semiconductor_fab' || id === 'ai_models' || id === 'ai_agents') {
      // electricity scarcity binds compute-heavy research & fab expansion
      const meanPrice = w.civs.reduce((a, c) => a + c.energy.priceIndex, 0) / w.civs.length;
      if (meanPrice > 1.18) { constraintGate *= clamp(1.9 - meanPrice * 0.62, 0.3, 1); info.constraints.push('electricity cost'); }
    }
    if (id === 'semiconductor_fab' || id === 'nuclear_power' || id === 'grid_transmission') {
      // hardware research cannot outrun the physical industrial ecosystem:
      // you cannot design what you cannot yet build (mfg catches up slowly)
      const physGate = clamp(0.35 + 0.65 * Math.sqrt(Math.max(0.05, t.mfg) / Math.max(0.2, t.cap)), 0.15, 1);
      if (physGate < 0.85) info.constraints.push('physical build-out lags designs');
      constraintGate *= physGate;
    }

    // difficulty: ideas get harder to find (Bloom et al.)
    const difficulty = Math.pow(Math.max(0.2, t.cap), d.difficultyTheta);
    if (t.cap > 2) info.constraints.push('increasing research difficulty');

    const researchOutput = (effort * tool * spillover * domainMult * constraintGate * depGate) / difficulty;

    // logistic-in-capability toward paradigm asymptote + stochastic discovery
    const noise = 1 + d.sigma * gaussian(w.rng) * Math.sqrt(DT) * 0.6;
    const headroom = Math.max(0, 1 - t.cap / t.paradigmCap);
    const dCap = d.kGrowth * researchOutput * headroom * noise * DT * d.gameplayScaling;
    const prevRate = t.lastGrowthRate;
    t.cap = Math.max(0.05, t.cap + dCap);
    t.lastGrowthRate = dCap / Math.max(0.01, t.cap) / DT; // fractional per-year
    t.growthAccel = (t.lastGrowthRate - prevRate) / DT;
    t.effort = effort;
    info.growthRate = t.lastGrowthRate;
    techTickCache[`${id}`] = info;

    // maturity & reliability chase capability (validation takes real time)
    const matureTarget = clamp01(0.35 + t.cap / (t.paradigmCap * 1.2));
    t.maturity = lerp(t.maturity, Math.min(0.99, matureTarget), d.maturityRate * DT * (0.5 + researchOutput * 0.5));
    const relTarget = clamp01(0.3 + 0.65 * t.maturity + 0.1 * clamp01(t.cap / 2));
    t.reliability = lerp(t.reliability, relTarget, d.maturityRate * 0.8 * DT);

    // experience-curve cost decline (learning rate decays toward floor)
    const demandSignal = CIV_IDS.reduce((a, c) => a + t.adoption[c].penetration, 0) / 3;
    const prodGrowth = d.mfgGrowth * (0.3 + demandSignal) * DT;
    t.mfg = Math.max(0.05, t.mfg * (1 + prodGrowth * clamp(researchOutput, 0.2, 3)));
    t.cumulative *= 1 + prodGrowth;
    const lrEff = d.learningRate * Math.max(0, 1 - d.costFloor / Math.max(d.costFloor, t.cost));
    t.cost = Math.max(d.costFloor, t.cost * Math.pow(1 - lrEff, prodGrowth * 8) * (1 - 0.05 * dCap));

    // phase pipeline
    t.phase =
      t.maturity < 0.25 ? 'science'
      : t.maturity < 0.45 ? 'prototype'
      : t.reliability < 0.55 ? 'engineering'
      : t.cost > 1.6 || t.mfg < 0.6 ? 'deployment'
      : 'diffusion';

    // Paradigm transitions are no longer random cap jumps. They are produced
    // by explicit ResearchProgram → Invention → validation/deployment state.

    // ── adoption / diffusion per civ ──
    for (const c of w.civs) {
      const ad = t.adoption[c.id];
      // arrival: needs minimal global maturity + (local capacity or trade access)
      if (!ad.arrived) {
        const tradeAccess = w.relations
          .filter((r) => r.a === c.id || r.b === c.id)
          .reduce((a, r) => a + r.tradeOpenness, 0) / 2;
        if (t.maturity > 0.3 && (c.researchCapacity > 0.5 || tradeAccess > 0.25)) {
          ad.arrived = true;
        } else continue;
      }
      // target penetration: affordability × readiness × infra × regulation × acceptance
      const afford = clamp(1.6 - t.cost / (0.5 + c.traits.capitalWealth), 0.05, 1);
      const ready = t.maturity * 0.5 + t.reliability * 0.5;
      const regCaution = c.society.regCaution / Math.max(0.3, w.params.regulation * activeGlobalMult(w, 'regulation'));
      const regSensitive = (id === 'transport_av' || id === 'ai_agents' || id === 'nuclear_power' || id === 'biotech_med' || id === 'robotics_gp') ? 1 : 0.3;
      const regGate = 1 - regSensitive * clamp(regCaution - 0.4, 0, 0.7) * 0.7;
      let infraGate = 1;
      if (d.energyPerAdoption > 0.2) {
        infraGate = c.energy.marginPct > 2 ? 1 : clamp(0.3 + c.energy.marginPct * 0.1, 0.15, 1);
        if (infraGate < 0.8) info.constraints.push(`${c.name}: electricity margin`);
      }
      if (id === 'transport_ev') infraGate *= clamp(0.4 + w.techs.grid_transmission.adoption[c.id].penetration, 0.3, 1);
      const backlashGate = (id === 'robotics_gp' || id === 'robotics_ind' || id === 'ai_agents') ? 1 - c.society.backlash * 0.35 : 1;
      const eduGate = 0.5 + c.population.education * 0.5;
      const target = clamp01(afford * ready * regGate * infraGate * backlashGate * eduGate * 1.35);
      const speed = d.diffusionSpeed * w.params.diffusionMult * (0.5 + c.traits.openness * 0.5) * (0.6 + 0.4 * w.params.tradeOpenness);
      const subsidized = civPolicy(w, c.id, 'subsidize_robotics') > 0 && (id === 'robotics_ind' || id === 'robotics_gp') ? 1.6 : 1;
      ad.penetration = clamp01(ad.penetration + speed * subsidized * (target - ad.penetration) * DT * 2);
      // intensity lags penetration (Comin & Hobijn intensive margin)
      ad.intensity = clamp01(ad.intensity + 0.6 * speed * (ad.penetration - ad.intensity) * DT * 2);
    }

    // dominant bottleneck label for UI (cached)
    const bottlenecks: string[] = [];
    if (headroom < 0.25) bottlenecks.push('paradigm asymptote');
    if (t.depReady < 0.6) bottlenecks.push('immature dependencies');
    if (difficulty > 3) bottlenecks.push('research difficulty');
    if (constraintGate < 0.85) bottlenecks.push('compute/energy constraint');
    if (t.cost > 1.5) bottlenecks.push('unit cost');
    if (t.reliability < 0.55) bottlenecks.push('reliability');
    if (t.mfg < 0.8) bottlenecks.push('manufacturing capacity');
    t.bottleneck = bottlenecks[0] ?? (info.constraints[0] ?? 'none — demand & diffusion');
  }
}

// ── 1b. CIVILIZATION PLANNING / PROJECTS / RESEARCH PROGRAMS ────────────────

const PROJECT_LEADS: Record<ProjectKind, number> = {
  solar: CALIBRATION.generation.solar.leadMonths,
  wind: CALIBRATION.generation.wind.leadMonths,
  nuclear: CALIBRATION.generation.nuclear.leadMonths,
  geothermal: CALIBRATION.generation.geothermal.leadMonths,
  bioenergy: CALIBRATION.generation.bioenergy.leadMonths,
  ocean_energy: CALIBRATION.generation.ocean.leadMonths,
  hydrogen_hub: 30,
  fossil: CALIBRATION.generation.fossil.leadMonths,
  grid: CALIBRATION.grid.projectLeadMonths,
  datacenter: CALIBRATION.datacenter.leadMonths,
  housing: CALIBRATION.housing.leadMonths,
  arcology: 48,
  underground_habitat: 60,
  fab: CALIBRATION.fab.leadMonths,
  storage: 18,
  fusion: CALIBRATION.generation.fusion.leadMonths,
  recycling: 30,
  spaceport: 36,
  asteroid_mining: 72,
  orbital_habitat: 96,
  mars_colony: 120,
  interstellar_ark: 240,
  space_elevator: 180,
  power_satellite: 48,
  land_reclamation: 60,
  floating_district: 30,
  seabed_mining: 48,
  offshore_energy: 30,
  subsea_habitat: 60,
  aerial_platform: 72,
};
const LAND_KINDS: ProjectKind[] = ['land_reclamation', 'floating_district', 'seabed_mining', 'offshore_energy', 'subsea_habitat', 'aerial_platform', 'arcology', 'underground_habitat'];
const FRONTIER_KINDS: ProjectKind[] = ['fusion', 'recycling', 'spaceport', 'asteroid_mining', 'orbital_habitat', 'mars_colony', 'interstellar_ark', 'space_elevator', 'power_satellite'];

function projectCapex(kind: ProjectKind, capacity: number): number {
  if (kind === 'solar') return capacity * CALIBRATION.generation.solar.capexPerGW;
  if (kind === 'wind') return capacity * CALIBRATION.generation.wind.capexPerGW;
  if (kind === 'nuclear') return capacity * CALIBRATION.generation.nuclear.capexPerGW;
  if (kind === 'geothermal') return capacity * CALIBRATION.generation.geothermal.capexPerGW;
  if (kind === 'bioenergy') return capacity * CALIBRATION.generation.bioenergy.capexPerGW;
  if (kind === 'ocean_energy') return capacity * CALIBRATION.generation.ocean.capexPerGW;
  if (kind === 'hydrogen_hub') return capacity * 0.085;
  if (kind === 'fossil') return capacity * CALIBRATION.generation.fossil.capexPerGW;
  if (kind === 'grid') return capacity * 0.014; // normalized from multi-year transmission capex; derived gameplay scale
  if (kind === 'datacenter') return capacity * CALIBRATION.datacenter.capexPerGW;
  if (kind === 'housing') return capacity * CALIBRATION.housing.capexPerStockPoint;
  if (kind === 'fab') return capacity * CALIBRATION.fab.capexPerUnit;
  if (kind === 'storage') return capacity * 0.035;
  return 0; // frontier kinds are priced by frontierProjectSpec (needs world state)
}

function activeProjectCount(w: WorldState, civId: CivId, kind: ProjectKind): number {
  return w.projects.filter((p) => p.civId === civId && p.kind === kind && !['operational', 'cancelled'].includes(p.status)).length;
}
function projectExists(w: WorldState, civId: CivId, kind: ProjectKind): boolean {
  return activeProjectCount(w, civId, kind) > 0;
}

export function proposeProject(w: WorldState, c: CivState, kind: ProjectKind, capacity: number, rationale: string): boolean {
  const limit = kind === 'fab' ? 1 : kind === 'nuclear' ? 3 : kind === 'grid' ? 8 : ['solar','wind','geothermal','bioenergy','ocean_energy'].includes(kind) ? 8 : kind === 'storage' || kind === 'hydrogen_hub' ? 6
    : kind === 'fusion' ? 3 : kind === 'space_elevator' ? 1 : kind === 'orbital_habitat' ? 2 : kind === 'mars_colony' ? 1 : kind === 'spaceport' || kind === 'asteroid_mining' || kind === 'power_satellite' || kind === 'recycling' ? 2 : 4;
  if (capacity <= 0 || activeProjectCount(w, c.id, kind) >= limit) return false;
  let capex = projectCapex(kind, capacity);
  let leadOverride: number | null = null;
  if (FRONTIER_KINDS.includes(kind)) {
    const spec = frontierProjectSpec(w, c, kind, capacity);
    if (!spec) return false;
    capex = spec.capex; leadOverride = spec.leadMonths;
  }
  if (LAND_KINDS.includes(kind)) {
    const spec = landProjectSpec(w, c, kind, capacity);
    if (!spec) return false;
    capex = spec.capex; leadOverride = spec.leadMonths;
  }
  // Housing on a full island: building up costs more, and there is only so much free land to build on.
  if (kind === 'housing') {
    const room = landRoomForHousing(c);
    if (room < capacity) { capacity = Math.max(0, room); if (capacity < 0.004) return false; capex = projectCapex(kind, capacity); }
    capex *= housingLandCapexMultiplier(c);
  }
  // Every physical project is built from finite materials: scarcity makes it dearer.
  capex *= materialCapexMultiplier(w, c.id, kind);
  // Technology affects the cost of what society can actually build.
  if (kind === 'solar') capex *= clamp(w.techs.solar_pv.cost, 0.35, 1.5);
  if (kind === 'wind') capex *= clamp(w.techs.wind_power.cost, 0.4, 1.5);
  if (kind === 'nuclear') capex *= clamp(w.techs.nuclear_power.cost, 0.55, 1.8);
  if (kind === 'geothermal') capex *= clamp(w.techs.geothermal_power.cost, 0.35, 2.0) / Math.sqrt(w.params.geothermalMult);
  if (kind === 'bioenergy') capex *= clamp(w.techs.bioenergy_systems.cost, 0.45, 1.8) / Math.sqrt(w.params.bioenergyMult);
  if (kind === 'ocean_energy') capex *= clamp(w.techs.ocean_energy.cost, 0.45, 2.5) / Math.sqrt(w.params.oceanEnergyMult);
  if (kind === 'hydrogen_hub') capex *= clamp(w.techs.hydrogen_systems.cost, 0.4, 2.5) / Math.sqrt(w.params.hydrogenMult);
  if (kind === 'storage') capex *= clamp(w.techs.storage_batt.cost, 0.3, 1.5);
  if (kind === 'grid') capex *= clamp(w.techs.grid_transmission.cost, 0.5, 1.4);
  const activeAnnualSpend = w.projects
    .filter((p) => p.civId === c.id && !['operational', 'cancelled'].includes(p.status))
    .reduce((a, p) => a + Math.max(0, p.capex - p.spent) / Math.max(1, p.monthsRemaining) * 12, 0);
  const energyKind = ['solar','wind','nuclear','geothermal','bioenergy','ocean_energy','hydrogen_hub','fossil','grid','storage','fusion','power_satellite'].includes(kind);
  const room = Math.max(0, c.economy.investmentBudget - c.economy.maintenanceBudget - activeAnnualSpend) * (energyKind ? w.params.energyCapexMult : 1);
  // Planners build what they can finance: an unaffordable proposal is scaled down
  // to the financeable size (never below a fifth of the original) rather than
  // dropped outright. Weak institutions and debt still leave needs unmet.
  const annualNeed = capex / Math.max(1, (leadOverride ?? PROJECT_LEADS[kind]) / 12) * 0.55;
  if (room < annualNeed) {
    const scale = room / Math.max(0.0001, annualNeed);
    if (scale < 0.2 || FRONTIER_KINDS.includes(kind) && kind !== 'fusion' && kind !== 'recycling') return false;
    capacity *= scale; capex *= scale;
  }
  const speed = Math.max(0.35, w.params.buildSpeedMult) * (['spaceport','asteroid_mining','orbital_habitat','mars_colony','interstellar_ark','space_elevator','power_satellite'].includes(kind) ? w.params.spaceMult : kind === 'fusion' ? w.params.fusionMult : 1);
  const lead = clamp((leadOverride ?? PROJECT_LEADS[kind]) / speed, 8, 260); // institutional capacity affects execution speed in stepProjects; do not double-count it here
  w.projects.push({
    id: `prj-${c.id}-${kind}-${w.tMonths}-${w.eventCounter++}`,
    civId: c.id,
    kind,
    status: 'financed',
    capacity,
    capex,
    spent: 0,
    monthsRemaining: lead,
    totalMonths: lead,
    proposedAt: w.tMonths,
    delayMonths: 0,
    rationale,
  });
  addEvent(w, {
    title: `${c.name} commits to ${PROJECT_LABEL[kind]}`,
    body: `${rationale} The project is financed, but completion depends on construction capacity, institutions and continued funding.`,
    category: kind === 'housing' ? 'economy' : kind === 'datacenter' || kind === 'fab' ? 'technology' : FRONTIER_KINDS.includes(kind) && kind !== 'fusion' && kind !== 'recycling' ? 'frontier' : 'energy',
    civId: c.id,
    significance: (FRONTIER_KINDS.includes(kind) || LAND_KINDS.includes(kind)) && !w.projects.some((q) => q.civId === c.id && q.kind === kind) ? 2 : 1,
    causes: [{ factor: rationale, weight: 0.65 }, { factor: 'available investment capacity', weight: 0.35 }],
    counterforces: [{ factor: 'construction and financing risk', weight: 0.5 }],
    confidence: 'high',
  });
  return true;
}

export const PROJECT_LABEL: Record<ProjectKind, string> = {
  solar: 'solar capacity', wind: 'wind capacity', nuclear: 'nuclear capacity', geothermal: 'geothermal capacity', bioenergy: 'sustainable bioenergy capacity', ocean_energy: 'tidal, wave and ocean-thermal capacity', hydrogen_hub: 'a hydrogen production and storage hub', fossil: 'thermal capacity', grid: 'grid expansion',
  datacenter: 'data-center construction', housing: 'housing construction', arcology: 'an arcology district', underground_habitat: 'an underground district', fab: 'semiconductor fabrication capacity', storage: 'grid storage',
  fusion: 'a fusion power plant', recycling: 'a materials-recovery plant', spaceport: 'a spaceport', asteroid_mining: 'an asteroid-mining operation',
  orbital_habitat: 'an orbital habitat', mars_colony: 'a Mars settlement', interstellar_ark: 'a deep-space ark', space_elevator: 'a space elevator', power_satellite: 'orbital power satellites',
  land_reclamation: 'sea reclamation', floating_district: 'a floating district', seabed_mining: 'a seabed mining operation', offshore_energy: 'offshore wind and ocean-thermal capacity', subsea_habitat: 'a sea-floor habitat', aerial_platform: 'a stratospheric platform',
};

function completeProject(w: WorldState, p: WorldState['projects'][number]) {
  const c = w.civs.find((x) => x.id === p.civId)!;
  if (applyFrontierCompletion(w, c, p) || applyLandCompletion(w, c, p)) {
    // handled in frontier.ts / land.ts
  } else if (p.kind === 'grid') {
    c.energy.gridCapGW += p.capacity;
    c.energy.gridCondition = Math.min(1, c.energy.gridCondition + 0.12);
  } else if (p.kind === 'datacenter') {
    c.compute.dcCapGW += p.capacity;
  } else if (p.kind === 'housing') {
    c.housing.stockIndex += p.capacity;
    c.housing.condition = Math.min(1, c.housing.condition + Math.min(0.12, p.capacity * 0.8));
  } else if (p.kind === 'fab') {
    w.techs.semiconductor_fab.mfg *= 1 + p.capacity * 0.12;
    c.economy.capital *= 1 + p.capacity * 0.012;
  } else if (p.kind === 'storage') {
    c.energy.storageGWh += p.capacity * 1000;
  } else if (p.kind === 'hydrogen_hub') {
    c.energy.hydrogen.electrolyzerGW += p.capacity;
    c.energy.hydrogen.fuelCellGW += p.capacity * 0.55;
    c.energy.hydrogen.storageCapacityTWh += p.capacity * 0.18;
    c.energy.hydrogen.cleanShare = Math.max(c.energy.hydrogen.cleanShare, 0.55);
  } else {
    const sourceKey = p.kind === 'ocean_energy' ? 'ocean' : p.kind;
    const source = c.energy.sources[sourceKey as 'solar' | 'wind' | 'nuclear' | 'geothermal' | 'bioenergy' | 'ocean' | 'fossil'];
    const oldCap = source.cap;
    source.cap += p.capacity;
    source.avgAgeYears = (source.avgAgeYears * oldCap) / Math.max(0.001, source.cap);
    source.condition = Math.min(1, (source.condition * oldCap + p.capacity) / Math.max(0.001, source.cap));
  }
  p.status = 'operational';
  p.completedAt = w.tMonths;
  p.monthsRemaining = 0;
  addEvent(w, {
    title: `${c.name} completes ${PROJECT_LABEL[p.kind]}`,
    body: `${completionText(p)} entered service after ${Math.round((p.totalMonths + p.delayMonths) / 12 * 10) / 10} years.`,
    category: p.kind === 'housing' ? 'economy' : p.kind === 'datacenter' || p.kind === 'fab' ? 'technology' : FRONTIER_KINDS.includes(p.kind) && p.kind !== 'fusion' && p.kind !== 'recycling' ? 'frontier' : 'energy',
    civId: c.id,
    significance: FRONTIER_KINDS.includes(p.kind) || LAND_KINDS.includes(p.kind) ? (w.projects.some((q) => q !== p && q.civId === c.id && q.kind === p.kind && q.status === 'operational') ? 1 : 3) : 1,
    causes: [{ factor: 'project completion', weight: 1 }], counterforces: [], confidence: 'high',
  });
}

function completionText(p: WorldState['projects'][number]): string {
  switch (p.kind) {
    case 'housing': case 'arcology': case 'underground_habitat': case 'fab': case 'storage': case 'hydrogen_hub': case 'recycling': case 'spaceport': case 'floating_district': case 'subsea_habitat': case 'aerial_platform': return `${p.capacity.toFixed(2)} capacity units`;
    case 'land_reclamation': return `${(p.capacity * 100).toFixed(1)}% of 2026 land`;
    case 'seabed_mining': return `${(p.capacity * 100).toFixed(0)}% of 2026 mineral demand`;
    case 'offshore_energy': return `${p.capacity.toFixed(1)} GW`;
    case 'asteroid_mining': return `Mining capacity worth ${(p.capacity * 100).toFixed(0)}% of 2026 world mineral demand`;
    case 'orbital_habitat': case 'mars_colony': case 'interstellar_ark': return `Living space for ${(p.capacity * 1000).toFixed(0)} thousand people`;
    case 'space_elevator': return 'A permanent tether to geostationary orbit';
    default: return `${p.capacity.toFixed(2)} GW`;
  }
}

function stepProjects(w: WorldState) {
  for (const p of w.projects) {
    if (p.status === 'operational' || p.status === 'cancelled') continue;
    const c = w.civs.find((x) => x.id === p.civId)!;
    if (p.status === 'financed') { p.status = 'under_construction'; p.startedAt ??= w.tMonths; }
    const earthPop = physicalPopulation(c);
    const continuity = c.population.total > 0
      ? (earthPop > 0.001 ? 1 : c.society.autonomousInfrastructure * (c.population.offworld > 0.01 || c.population.digitalShare > 0.1 ? 0.45 : 0.15))
      : 0;
    // Empty territories do not keep building by narrative inertia. Existing highly
    // autonomous systems may finish some remote work for an off-world/digital polity,
    // but an extinct civilization has zero construction activity.
    if (continuity <= 0.001) {
      p.delayMonths += 1;
      if (p.delayMonths > 24) p.status = 'cancelled';
      continue;
    }
    const monthlyPlan = p.capex / Math.max(1, p.totalMonths);
    const debtGate = clamp(1.2 - Math.max(0, c.economy.publicDebt - 0.9) * 0.18, 0.30, 1);
    // Private contractors and mature supply chains keep straightforward projects
    // moving even when central institutions weaken; complex nuclear/fab projects
    // remain much more institution-sensitive.
    const complexityFloor = ['solar','wind','geothermal','bioenergy','storage','hydrogen_hub','housing'].includes(p.kind) ? 0.34 : p.kind === 'grid' || p.kind === 'fossil' ? 0.24 : 0.10;
    const institutionalExecution = 0.28 + c.economy.institutionalCapacity * 0.72;
    const exec = clamp(Math.max(complexityFloor * c.economy.capexAvailability, institutionalExecution * debtGate * c.economy.capexAvailability), 0.06, 1.2);
    const disruption = energyHardship(c) * 0.5 + Math.max(0, 0.45 - c.society.stability) * 0.6;
    const effective = exec * (1 - clamp(disruption, 0, 0.8)) * continuity;
    p.spent += monthlyPlan * effective;
    // Weak execution slows projects; it does not freeze every construction site
    // forever. Remaining duration is measured in effective construction-months.
    p.monthsRemaining -= effective;
    if (effective < 0.8) p.delayMonths += 1 - effective;
    if (c.economy.publicDebt > 2.7 && c.society.stability < 0.3 && p.spent < p.capex * 0.35 && chance(w.rng, 0.015)) {
      p.status = 'cancelled';
      addEvent(w, {
        title: `${c.name} cancels a ${p.kind} project`,
        body: `Fiscal and institutional stress made continued financing impossible. Sunk costs remain, but the promised capacity will not arrive.`,
        category: 'economy', civId: c.id, significance: 2,
        causes: [{ factor: 'fiscal stress', weight: 0.5 }, { factor: 'institutional breakdown', weight: 0.5 }],
        counterforces: [{ factor: 'strategic need for the project', weight: 0.5 }], confidence: 'high',
      });
      continue;
    }
    if (p.spent >= p.capex * 0.98 && p.monthsRemaining <= 0) completeProject(w, p);
  }
  if (w.projects.length > 250) w.projects = w.projects.filter((p) => p.status !== 'operational' || (p.completedAt ?? 0) > w.tMonths - 360);
}

function planningScores(w: WorldState, c: CivState) {
  const powerGap = clamp(-c.energy.marginPct / 25, 0, 1);
  const gridNeed = clamp((1 - c.energy.gridCondition) + c.energy.gridMaintenanceBacklog + powerGap * 0.8, 0, 2);
  const housingNeed = clamp(c.housing.crowding + c.housing.maintenanceBacklog + Math.max(0, 0.04 - c.housing.vacancy), 0, 2);
  const computeNeed = c.compute.constrained ? 0.8 : clamp(w.techs.ai_models.lastGrowthRate * 0.3, 0, 0.5);
  const fiscalStress = clamp((c.economy.publicDebt - 1) / 1.5 + (0.5 - c.society.stability), 0, 1.5);
  return { powerGap, gridNeed, housingNeed, computeNeed, fiscalStress };
}

function rebalanceResearch(w: WorldState, c: CivState) {
  const scores = planningScores(w, c);
  const raw = {} as Record<TechId, number>;
  let sum = 0;
  for (const id of TECH_IDS) {
    const d = TECH_DEFS[id];
    let v = d.effortPull * (0.6 + c.traits.sciencePriority * 0.7);
    if (['solar_pv','wind_power','nuclear_power','geothermal_power','bioenergy_systems','ocean_energy','hydrogen_systems','storage_batt','grid_transmission'].includes(id)) v *= 1 + scores.powerGap * 6 + scores.gridNeed * 1.8;
    if (id === 'geothermal_power') v *= w.params.geothermalMult * (1 + scores.powerGap * 2.2);
    if (id === 'bioenergy_systems') v *= w.params.bioenergyMult * (1 + scores.powerGap * 1.1 + Math.max(0, w.resources.fossilCostIndex - 1) * 0.8);
    if (id === 'ocean_energy') v *= w.params.oceanEnergyMult * w.params.marineMult * (1 + c.land.pressure * 0.8);
    if (id === 'hydrogen_systems') v *= w.params.hydrogenMult * (1 + Math.max(0, c.energy.sources.solar.cap + c.energy.sources.wind.cap - c.energy.demandTWh / 8.76 * 0.5) * 0.01);
    if (['ai_models','ai_agents','compute_accel','semiconductor_fab'].includes(id)) v *= 1 + c.traits.sciencePriority * 0.8 + scores.computeNeed * 1.2;
    if (['robotics_ind','robotics_gp'].includes(id)) v *= 1 + (1 - c.population.workingShare) * 1.4 + Math.max(0, c.economy.unemployment < 0.04 ? 0.4 : 0);
    // The marine-platform pathway lives in industrial robotics: a full island pulls research toward it.
    if (id === 'robotics_ind') v *= 1 + clamp((c.land.pressure - 0.8) / 0.2, 0, 1) * 0.5 * w.params.marineMult + (w.params.marineMult - 1) * 0.3;
    if (id === 'biotech_med') v *= 1 + Math.max(0, c.population.medianAge - 38) * 0.025;
    // Frontier research is a luxury of societies that have earned it: a state in
    // crisis funds grid repair and food, not fusion pilots and launch pads.
    const earned = 0.25 + 0.75 * clamp((c.frontierReadiness - 0.3) / 0.4, 0, 1);
    if (id === 'longevity_bio') v *= (1 + Math.max(0, c.population.medianAge - 36) * 0.05 + (c.population.total < c.population.peakPhysical * 0.9 ? 0.8 : 0)) * w.params.longevityMult * (0.4 + c.economy.outputPerCapita * 0.4) * earned;
    if (id === 'fusion_power') v *= (1 + scores.powerGap * 4 + Math.max(0, w.resources.fossilCostIndex - 1.2) * 1.5 + c.traits.sciencePriority * 0.6) * w.params.fusionMult * earned;
    if (id === 'space_systems') v *= (1 + Math.max(0, w.resources.mineralCostIndex - 1.2) * 1.2 + w.resources.landPressure * 0.8 + c.traits.strategicAutonomy * 0.5 + c.traits.riskTolerance * 0.4) * w.params.spaceMult * (0.5 + Math.min(2, c.economy.outputPerCapita) * 0.35) * earned;
    if (id === 'semiconductor_fab') v *= 1 + c.traits.strategicAutonomy * 0.8;
    raw[id] = Math.max(0.001, v); sum += raw[id];
  }
  for (const id of TECH_IDS) {
    const target = raw[id] / sum;
    c.researchAlloc[id] = lerp(c.researchAlloc[id], target, 0.45);
  }
  const norm = TECH_IDS.reduce((a, id) => a + c.researchAlloc[id], 0);
  for (const id of TECH_IDS) c.researchAlloc[id] /= norm;
}

function stepCivilizationPlanning(w: WorldState) {
  if (!(w.tMonths === 1 || w.tMonths % 12 === 0)) return;
  for (const c of w.civs) {
    const ec = c.economy;
    // New terrestrial plans require an inhabited territory. Off-world continuity
    // can preserve existing assets, but it does not make empty cities propose roads,
    // housing or launch pads.
    if (physicalPopulation(c) < 0.001 || c.society.polityStatus === 'abandoned') {
      ec.investmentBudget = 0;
      ec.maintenanceBudget = c.population.total > 0 ? Math.max(0, ec.output * 0.01 * c.society.autonomousInfrastructure) : 0;
      continue;
    }
    // Debt tightens investment, but routine maintenance is a protected first claim.
    // Otherwise a modest recession mechanically destroys the asset base and creates
    // an unrealistically deterministic collapse spiral.
    const debtPenalty = clamp(1.15 - Math.max(0, ec.publicDebt - 0.9) * 0.20, 0.35, 1.08);
    ec.investmentBudget = Math.max(0.015, ec.output * CALIBRATION.finance.grossInvestmentShare * ec.capexAvailability * debtPenalty * w.params.capitalAvailability);
    const backlogPressure = c.energy.gridMaintenanceBacklog + c.housing.maintenanceBacklog + Math.max(0, 0.88 - ec.capitalCondition);
    const maintenanceDebtPenalty = clamp(1.04 - Math.max(0, ec.publicDebt - 1.5) * 0.10, 0.62, 1.04);
    ec.maintenanceBudget = Math.max(0.008, ec.output * CALIBRATION.finance.publicMaintenanceShare * maintenanceDebtPenalty * (1 + Math.min(1.5, backlogPressure * 0.95)));
    rebalanceResearch(w, c);
    const sc = planningScores(w, c);
    // Credible governments can temporarily borrow through an emergency to
    // protect a critical system. This is finite and disappears once debt or
    // institutional capacity becomes too weak.
    if (sc.powerGap > 0.04 && ec.publicDebt < 2.4 && ec.institutionalCapacity > 0.32) {
      const emergency = ec.output * 0.10 * sc.powerGap * ec.institutionalCapacity;
      ec.investmentBudget += emergency;
      ec.publicDebt += emergency / Math.max(0.08, ec.output) * 0.06;
    }
    const priorities: Array<[string, number]> = [
      ['Restore electricity reliability', sc.powerGap * 2 + sc.gridNeed],
      ['Repair aging infrastructure', c.energy.gridMaintenanceBacklog + c.housing.maintenanceBacklog + (1 - ec.capitalCondition)],
      ['Expand housing supply', sc.housingNeed],
      ['Expand compute and semiconductor capacity', sc.computeNeed + c.traits.strategicAutonomy * 0.25],
      ['Stabilize public finances', sc.fiscalStress * 1.3],
      ['Balanced development', 0.35],
    ];
    priorities.sort((a,b) => b[1]-a[1]);
    ec.infraSpend = ec.investmentBudget;
    c.strategicPriority = priorities[0][0];

    // The planner can fail to solve obvious problems when financing/execution is weak.
    const agingRisk = (Object.keys(c.energy.sources) as Array<keyof typeof c.energy.sources>).reduce((mx, k) => {
      const src = c.energy.sources[k]; const life = CALIBRATION.generation[k].lifetimeYears;
      return Math.max(mx, src.avgAgeYears / life, 1 - src.condition);
    }, 0);
    // Generation that the grid cannot move is worthless. When the transmission
    // ceiling binds, expand the grid first and stop adding curtailed capacity.
    const genNow = generationTWh(w, c);
    const gridLimitNow = c.energy.gridCapGW * c.energy.gridCondition * (1 + Math.min(0.45, Math.log1p(Math.max(0, w.techs.grid_transmission.cap - 1)) * 0.16)) * 8.76 * CALIBRATION.grid.utilization;
    const gridBound = genNow > gridLimitNow * 1.04;
    if (gridBound) {
      const requiredGridGW = Math.max(c.energy.demandTWh, genNow * 0.9) / 8.76 / Math.max(0.35, CALIBRATION.grid.utilization) * (1 + CALIBRATION.grid.targetReserveMargin);
      const gap = Math.max(3, requiredGridGW - c.energy.gridCapGW);
      proposeProject(w, c, 'grid', Math.min(gap * 0.5, Math.max(20, c.energy.gridCapGW * 0.22)), 'generation exceeds what the grid can deliver');
      proposeProject(w, c, 'grid', Math.min(gap * 0.3, Math.max(10, c.energy.gridCapGW * 0.12)), 'second corridor to relieve curtailment');
    }
    if (!gridBound && (sc.powerGap > 0.02 || c.energy.marginPct < 14 || agingRisk > 0.62)) {
      // Plan against actual demand plus a reserve margin, and also replace the
      // energy expected to retire over the next several years. This makes aging
      // visible *before* the lights go out instead of reacting after collapse.
      const reserveGapTWh = Math.max(0, c.energy.demandTWh * (1 + CALIBRATION.grid.targetReserveMargin) - Math.max(0, c.energy.servedTWh));
      let expectedRetirementTWh = 0;
      for (const k of Object.keys(c.energy.sources) as Array<keyof typeof c.energy.sources>) {
        const src = c.energy.sources[k];
        const cfg = CALIBRATION.generation[k];
        const ageRatio = src.avgAgeYears / Math.max(1, cfg.lifetimeYears);
        const annualRetireRisk = clamp(0.003 + Math.pow(ageRatio, 4) * 0.026 + src.maintenanceBacklog * 0.012, 0.003, 0.10);
        expectedRetirementTWh += src.cap * CAPACITY_FACTOR[k] * 8.76 * annualRetireRisk * 2.2;
      }
      const pipelineTWh = w.projects
        .filter((p) => p.civId === c.id && !['operational','cancelled'].includes(p.status) && ['solar','wind','nuclear','geothermal','bioenergy','ocean_energy','fossil'].includes(p.kind))
        .reduce((sum, p) => {
          const cf = p.kind === 'solar' ? 0.22 : p.kind === 'wind' ? 0.35 : p.kind === 'nuclear' ? 0.90 : p.kind === 'geothermal' ? 0.88 : p.kind === 'bioenergy' ? 0.72 : p.kind === 'ocean_energy' ? 0.42 : 0.55;
          return sum + p.capacity * cf * 8.76;
        }, 0);
      const excessReserveTWh = c.energy.demandTWh * Math.max(0, c.energy.marginPct / 100 - CALIBRATION.grid.targetReserveMargin);
      // A fleet already far above demand is its own replacement reserve: no new
      // builds until the margin comes back toward target (this is what stopped the
      // build/mothball/build churn seen in long runs).
      const surplusGate = c.energy.marginPct > 30 ? 0 : c.energy.marginPct > 22 ? 0.35 : 1;
      const needTWh = Math.max(0, reserveGapTWh + expectedRetirementTWh - pipelineTWh * 0.72 - excessReserveTWh * 0.85) * surplusGate;

      // During a shortage, speed matters more than ideology: build fast capacity
      // first, then add firm/strategic capacity for the long run.
      const solarFirmCost = projectCapex('solar', 1) * clamp(w.techs.solar_pv.cost, 0.35, 1.5) / 0.22;
      const windFirmCost = projectCapex('wind', 1) * clamp(w.techs.wind_power.cost, 0.4, 1.5) / 0.35;
      const fastPreferred: ProjectKind = solarFirmCost <= windFirmCost ? 'solar' : 'wind';
      const fastCf = fastPreferred === 'solar' ? 0.22 : 0.35;
      const fastNeedGW = clamp(needTWh / Math.max(0.1, 8.76 * fastCf), 0.5, 80);
      const maxFast = fastPreferred === 'solar' ? Math.max(12, c.energy.demandTWh / 38) : Math.max(10, c.energy.demandTWh / 48);
      if (needTWh > c.energy.demandTWh * 0.01) proposeProject(w, c, fastPreferred, Math.min(fastNeedGW, maxFast), c.energy.marginPct < 4 ? 'urgent power shortage and near-term retirement risk' : 'reserve-margin and fleet-replacement requirement');

      // Diversification is valuable once the deficit is material.
      if (c.energy.marginPct < 4 || expectedRetirementTWh > c.energy.demandTWh * 0.08) {
        const second: ProjectKind = fastPreferred === 'solar' ? 'wind' : 'solar';
        const secondCf = second === 'solar' ? 0.22 : 0.35;
        proposeProject(w, c, second, Math.min(Math.max(4, needTWh * 0.35 / (8.76 * secondCf)), second === 'solar' ? 18 : 14), 'diversify supply and replace retiring generation');
      }

      const variableCap = c.energy.sources.solar.cap + c.energy.sources.wind.cap;
      const variableShare = variableCap / Math.max(1, variableCap + c.energy.sources.fossil.cap + c.energy.sources.nuclear.cap + c.energy.sources.hydro.cap + c.energy.sources.geothermal.cap + c.energy.sources.bioenergy.cap + c.energy.sources.ocean.cap);

      // A real energy system is a portfolio, not a two-way race between wind/solar
      // and fusion. Firm geothermal, sustainable bioenergy and marine power compete
      // when their local/resource constraints make sense. None is an unlimited pool.
      const fastCostPerTWh = Math.min(solarFirmCost / 8.76, windFirmCost / 8.76);
      const geothermalCostPerTWh = projectCapex('geothermal', 1) * clamp(w.techs.geothermal_power.cost, 0.35, 2) / (8.76 * CAPACITY_FACTOR.geothermal);
      if (w.techs.geothermal_power.maturity > 0.45 && c.energy.sources.geothermal.cap < Math.max(4, c.energy.demandTWh / 8.76 * 0.30) && geothermalCostPerTWh < fastCostPerTWh * 1.9 && (c.energy.marginPct < 14 || variableShare > 0.38)) {
        proposeProject(w, c, 'geothermal', clamp(needTWh / (8.76 * CAPACITY_FACTOR.geothermal) * 0.22, 0.5, 8), 'dispatchable geothermal diversifies the grid without consuming much surface land');
      }
      const sustainableBioCap = Math.max(1.5, c.energy.demandTWh / 8.76 * (0.045 + c.waste.managedShare * 0.045 + c.food.artificialShare * 0.03));
      if (w.techs.bioenergy_systems.maturity > 0.45 && c.energy.sources.bioenergy.cap < sustainableBioCap && (w.resources.fossilCostIndex > 1.25 || c.energy.marginPct < 5)) {
        proposeProject(w, c, 'bioenergy', clamp(Math.min(sustainableBioCap - c.energy.sources.bioenergy.cap, needTWh / (8.76 * CAPACITY_FACTOR.bioenergy) * 0.12), 0.3, 4), 'use bounded waste and sustainable biomass for firm heat, fuels and power');
      }
      const oceanPotential = Math.max(1, c.energy.demandTWh / 8.76 * 0.22 * w.params.marineMult);
      if (w.techs.ocean_energy.maturity > 0.45 && c.energy.sources.ocean.cap < oceanPotential && (c.land.pressure > 0.82 || w.params.oceanEnergyMult > 1.1) && c.energy.marginPct < 16) {
        proposeProject(w, c, 'ocean_energy', clamp(Math.min(oceanPotential - c.energy.sources.ocean.cap, needTWh / (8.76 * CAPACITY_FACTOR.ocean) * 0.15), 0.3, 5), 'tidal, wave and ocean-thermal power move part of the energy footprint offshore');
      }

      // Storage is a system asset, not a decorative statistic. Build it when
      // variable renewables are expanding or shortages are chronic.
      if ((variableShare > 0.32 && c.energy.marginPct < 10) || c.energy.marginPct < -6) {
        proposeProject(w, c, 'storage', clamp(c.energy.demandTWh / 900, 0.4, 3.5), 'firm variable generation and reduce load shedding');
      }
      // Hydrogen is a carrier: build it when there is variable-energy surplus to
      // store or when hard-to-electrify industry/transport creates demand. It never
      // appears as a primary source in the generation mix.
      if (w.techs.hydrogen_systems.maturity > 0.42 && ((variableShare > 0.38 && c.energy.marginPct > 8) || w.resources.fossilCostIndex > 1.45) && c.energy.hydrogen.electrolyzerGW < Math.max(2, c.energy.demandTWh / 8.76 * 0.16)) {
        proposeProject(w, c, 'hydrogen_hub', clamp(c.energy.demandTWh / 8.76 * 0.025, 0.4, 5), variableShare > 0.38 ? 'convert otherwise-curtailed clean electricity into stored hydrogen' : 'replace fossil molecules in industry and heavy transport');
      }

      // Firm capacity. Fusion competes with fission on cost per firm TWh once a
      // validated pilot exists; before that, fission is the only firm clean option.
      const fusionReady = fusionBuildable(w);
      const fusionCostPerTWh = fusionReady ? (frontierProjectSpec(w, c, 'fusion', 1)?.capex ?? 99) / (8.76 * 0.9) : Infinity;
      const nuclearCostPerTWh = projectCapex('nuclear', 1) * clamp(w.techs.nuclear_power.cost, 0.55, 1.8) / (8.76 * 0.9);
      // Firm power is wanted for autonomy, dear fuel or a thermal-heavy fleet, but never on top of a fat reserve.
      const firmWant = c.energy.marginPct < 22 && (c.traits.strategicAutonomy > 0.68 || w.resources.fossilCostIndex > 1.4 || c.energy.sources.fossil.cap > c.energy.demandTWh / 8.76 * 0.4);
      const firstPlant = c.energy.sources.fusion.cap <= 0.01 && !projectExists(w, c.id, 'fusion');
      if (fusionReady && fusionCostPerTWh <= nuclearCostPerTWh * 1.35 && c.energy.marginPct > -12 && c.economy.institutionalCapacity > 0.45 && (firstPlant || needTWh > c.energy.demandTWh * 0.02)) {
        const gw = firstPlant ? 0.4 : clamp(needTWh / (8.76 * 0.9) * 0.6 + c.energy.sources.fossil.cap * 0.15, 0.5, 12);
        proposeProject(w, c, 'fusion', gw, firstPlant ? 'first commercial fusion plant after a validated pilot' : fusionCostPerTWh < nuclearCostPerTWh ? 'fusion is now the cheapest firm power' : 'replace retiring thermal capacity with fusion');
      } else if (firmWant && w.techs.nuclear_power.maturity > 0.55 && c.energy.marginPct > -12) {
        proposeProject(w, c, 'nuclear', Math.min(4, Math.max(1.2, needTWh / (8.76 * 0.9) * 0.12)), 'long-term firm capacity and strategic energy security');
      }

      // In a deep emergency, resource-rich systems may choose dispatchable
      // thermal capacity as a bridge rather than accepting indefinite blackouts,
      // but only while fuel is still affordable.
      if (c.energy.marginPct < -22 && c.traits.energyEndowment > 0.5 && w.resources.fossilCostIndex < 1.8) {
        proposeProject(w, c, 'fossil', clamp(c.energy.demandTWh / 110, 3, 10), 'emergency dispatchable capacity during prolonged load shedding');
      }
    }
    // Once fusion is cheap it also replaces existing thermal plants that are still running on dear fuel.
    if (fusionBuildable(w) && w.resources.fossilCostIndex > 1.6 && c.energy.sources.fossil.cap > 1 && c.economy.institutionalCapacity > 0.5) {
      proposeProject(w, c, 'fusion', clamp(c.energy.sources.fossil.cap * 0.2, 0.5, 10), 'fuel costs make thermal generation uneconomic');
    }
    planFrontierProjects(w, c, proposeProject);
    stepBasicProvisionPolicy(w, c);
    if (sc.gridNeed > 0.10 || c.energy.gridCondition < 0.88 || c.energy.marginPct < 8) {
      const requiredGridGW = (c.energy.demandTWh / 8.76) / Math.max(0.35, CALIBRATION.grid.utilization) * (1 + CALIBRATION.grid.targetReserveMargin);
      const gridGapGW = Math.max(0, requiredGridGW - c.energy.gridCapGW);
      const expansion = Math.max(3, Math.min(
        Math.max(c.energy.gridCapGW * 0.16, gridGapGW * 0.38),
        Math.max(18, (c.energy.demandTWh / 8.76) * 0.28),
      ));
      proposeProject(w, c, 'grid', expansion, 'grid congestion, demand growth, aging equipment and reserve-margin risk');
      if (gridGapGW > c.energy.gridCapGW * 0.28 || c.energy.marginPct < -8) {
        proposeProject(w, c, 'grid', Math.min(expansion, Math.max(8, gridGapGW * 0.24)), 'second transmission corridor required by a large deliverability deficit');
      }
    }
    if (c.housing.crowding > 0.08) proposeProject(w, c, 'housing', clamp(c.housing.crowding * 0.16, 0.015, 0.12), c.land.pressure > 0.9 ? 'high rents: building higher on the last free land' : 'high rents and insufficient usable housing');
    planLandProjects(w, c, proposeProject);
    // Shrinking cities: demolition and consolidation are projects too, but cheap ones; modeled directly in stepUrban.
    if (c.compute.constrained && c.energy.marginPct > 8) proposeProject(w, c, 'datacenter', clamp(c.compute.dcCapGW * 0.12, 0.2, 2.5), 'compute demand exceeds available data-center capacity');
    if (c.traits.strategicAutonomy > 0.65 && w.techs.semiconductor_fab.mfg < 2.5 && !projectExists(w, c.id, 'fab')) proposeProject(w, c, 'fab', 1, 'strategic dependence on imported leading-edge semiconductors');
  }
}

function fusionBuildable(w: WorldState): boolean {
  const f = w.techs.fusion_power;
  return w.inventions.some((i) => i.id.startsWith('inv-fusion-pilot-plant-') && i.status === 'deployed') && f.reliability > 0.45 && f.maturity > 0.45;
}

/**
 * When automation removes paid work faster than new work appears, wealthy and
 * stable societies extend an income/service floor. This is the mechanism by
 * which a post-scarcity economy avoids becoming a post-legitimacy one. Poor,
 * indebted or weak states cannot afford it, and their backlash spirals.
 */
function stepBasicProvisionPolicy(w: WorldState, c: CivState) {
  const ec = c.economy;
  const s = c.society;
  const need = clamp((ec.displacedShare * 1.3 + Math.max(0, ec.unemployment - 0.06) * 1.5) * (w.frontier.agi ? 1.3 : 1), 0, 1);
  const affordable = clamp((ec.outputPerCapita - 1.15) * 1.2, 0, 1) * clamp(1.6 - ec.publicDebt * 0.5, 0.2, 1);
  const willing = (1 - c.traits.marketOrientation * 0.35 + s.backlash * 0.4 + civPolicy(w, c.id, 'basic_provision')) * w.params.socialContract;
  const target = clamp(need * affordable * willing, 0, 0.92);
  const prev = s.basicProvision;
  s.basicProvision = lerp(s.basicProvision, Math.max(target, civPolicy(w, c.id, 'basic_provision') * 0.6), 0.18);
  s.laborRelevance = clamp(1 - s.basicProvision * 0.65 - ec.automationExposure * 0.25, 0.1, 1);
  if (prev < 0.4 && s.basicProvision >= 0.4 && !w.flags[`provision-${c.id}`]) {
    w.flags[`provision-${c.id}`] = true;
    addEvent(w, {
      title: `${c.name} adopts a universal income and services floor`,
      body: `With ${(ec.unemployment * 100).toFixed(0)}% of adults outside paid work and output per person ${ec.outputPerCapita.toFixed(1)}× the 2026 level, ${c.name} decouples basic living standards from employment. Backlash eases; the fiscal cost is permanent.`,
      category: 'politics', civId: c.id, significance: 3,
      causes: [{ factor: 'automation displacing paid work', weight: 0.5 }, { factor: 'productivity gains large enough to fund it', weight: 0.3 }, { factor: 'political pressure from backlash', weight: 0.2 }],
      counterforces: [{ factor: 'fiscal cost and work-ethic politics', weight: 0.5 }], confidence: 'medium',
    });
  }
}

const INVENTOR_FIRST = ['Mira','Noah','Lina','Elias','Anika','Jon','Sora','Nadia','Ilan','Tomas','Mei','Arun'];
const INVENTOR_LAST = ['Chen','Varga','Okafor','Levin','Rao','Keller','Sato','Mendez','Hale','Novak','Ibrahim','Park'];
function createInventor(w: WorldState, c: CivState, program: ResearchProgramState): string {
  const i = Math.floor(nextFloat(w.rng) * INVENTOR_FIRST.length);
  const j = Math.floor(nextFloat(w.rng) * INVENTOR_LAST.length);
  const id = `inventor-${c.id}-${program.techId}-${w.eventCounter++}`;
  const role = program.techId.includes('grid') || program.techId.includes('power') || ['solar_pv','wind_power','nuclear_power','storage_batt'].includes(program.techId) ? 'Research engineer' : 'Research program lead';
  w.characters.push({
    id, name: `${INVENTOR_FIRST[i]} ${INVENTOR_LAST[j]}`, civId: c.id, role, age: 30 + Math.floor(nextFloat(w.rng) * 28), prominence: 0.72,
    history: [{ tMonths: w.tMonths, text: `${Math.floor(yearOf(w))} — became historically significant while leading ${program.title}.` }],
    beliefs: ['Evidence matters more than forecasts', 'A discovery is not useful until it survives engineering'],
    concern: 'Turning the new result into a reliable, manufacturable system', mood: 0.25, active: true,
  });
  return id;
}

function maybeStartResearchPrograms(w: WorldState, c: CivState) {
  let active = w.researchPrograms.filter((p) => p.civId === c.id && ['active','breakthrough','validation'].includes(p.status)).length;
  if (active >= CALIBRATION.research.maxActiveProgramsPerCiv) return;
  const ranked = TECH_IDS
    .map((id) => ({ id, score: c.researchAlloc[id] * (0.5 + w.techs[id].cap / Math.max(0.1, w.techs[id].paradigmCap)) * (TECH_DEFS[id].domain === 'frontier' ? 1.6 : 1) }))
    .sort((a,b) => b.score - a.score);
  let started = 0;
  for (const { id } of ranked) {
    if (started >= 2 || active >= CALIBRATION.research.maxActiveProgramsPerCiv) break;
    const t = w.techs[id];
    const invented = w.inventions.filter((iv) => iv.techId === id).map((iv) => iv.name);
    const candidate = nextCandidate(id, invented);
    // Independent laboratories may race toward the same result. We do not make a
    // research programme disappear merely because another polity is working on it.
    // If a second team reaches an already-known result, the completion logic below
    // treats it as a smaller replication/spillover gain rather than a second full
    // breakthrough. Explicit collaboration should be modelled as shared funding or
    // knowledge transfer, not as silent suppression of parallel research.
    if (!candidate || t.cap < t.paradigmCap * candidate.minCapFraction) continue;
    if (w.researchPrograms.some((p) => p.techId === id && p.civId === c.id && p.status !== 'failed' && p.status !== 'cancelled' && p.status !== 'completed')) continue;
    const funding = c.economy.output * c.economy.rdSpendShare * c.researchAlloc[id];
    if (funding < 0.0015) continue;
    const program: ResearchProgramState = {
      id: `rp-${c.id}-${id}-${w.eventCounter++}`,
      civId: c.id, techId: id, title: candidate.name, objective: candidate.objective,
      funding, progress: 0, maturity: 0, status: 'active', startedAt: w.tMonths,
      uncertainty: candidate.baseDifficulty,
    };
    w.researchPrograms.push(program);
    addEvent(w, {
      title: `${c.name} ${w.researchPrograms.filter((p) => p.civId === c.id && p.title === candidate!.name && p.status === 'failed').length > 0 ? `retries (attempt ${w.researchPrograms.filter((p) => p.civId === c.id && p.title === candidate!.name && p.status === 'failed').length + 1})` : 'launches'} research program: ${candidate.name}`,
      body: candidate.objective,
      category: 'science', civId: c.id, techId: id, significance: 1,
      causes: [{ factor: 'research priority', weight: 0.5 }, { factor: 'current paradigm nearing diminishing returns', weight: 0.5 }],
      counterforces: [{ factor: 'technical uncertainty', weight: candidate.baseDifficulty }], confidence: 'medium',
    });
    started++; active++;
  }
}

function stepResearchPrograms(w: WorldState) {
  if (w.tMonths === 1 || w.tMonths % 12 === 0) for (const c of w.civs) maybeStartResearchPrograms(w, c);
  for (const p of w.researchPrograms) {
    if (['completed','failed','cancelled'].includes(p.status)) continue;
    const c = w.civs.find((x) => x.id === p.civId)!;
    const t = w.techs[p.techId];
    const genMatch = /— generation (\d+)$/.exec(p.title);
    const candidate = genMatch ? followOnCandidate(p.techId, Number(genMatch[1])) : candidatesFor(p.techId).find((x) => x.name === p.title);
    if (!candidate) { p.status = 'cancelled'; continue; }
    if (p.status === 'active') {
      const fundingNow = c.economy.output * c.economy.rdSpendShare * c.researchAlloc[p.techId];
      p.funding = lerp(p.funding, fundingNow, 0.08);
      const tool = (1 + Math.log1p(w.techs.ai_models.cap) * 0.18 * w.params.aiTooling) * agiToolingBoost(w);
      const domainSpeed = p.techId === 'fusion_power' ? w.params.fusionMult : p.techId === 'longevity_bio' ? w.params.longevityMult : p.techId === 'space_systems' ? w.params.spaceMult : 1;
      const physicalGate = ['biotech_med','semiconductor_fab','nuclear_power','robotics_gp','robotics_ind'].includes(p.techId)
        ? clamp(0.35 + c.energy.industryServedRatio * 0.45 + c.economy.institutionalCapacity * 0.2, 0.2, 1)
        : clamp(0.55 + c.energy.computeServedRatio * 0.3 + c.economy.institutionalCapacity * 0.15, 0.2, 1);
      const effort = Math.sqrt(Math.max(0.0001, p.funding * 40)) * c.researchCapacity * tool * physicalGate * domainSpeed;
      const baseMonths = CALIBRATION.research.programBaseYears * 12 * candidate.baseDifficulty;
      const noise = clamp(1 + gaussian(w.rng) * 0.08, 0.7, 1.3);
      p.progress += effort * noise / Math.max(18, baseMonths);
      // Programs can fail after substantial effort; this creates dead ends.
      if (p.progress > 0.35 && chance(w.rng, 0.0007 * candidate.baseDifficulty * (1 + p.progress))) {
        p.status = 'failed';
        addEvent(w, {
          title: `${p.title} research program fails validation`,
          body: `After years of work, the program did not produce a result strong enough to justify continued funding. Researchers retain partial knowledge, but no new technology is deployed.`,
          category: 'science', civId: c.id, techId: p.techId, significance: 1,
          causes: [{ factor: 'technical uncertainty', weight: 0.7 }, { factor: 'failed experimental validation', weight: 0.3 }], counterforces: [], confidence: 'high',
        });
        continue;
      }
      if (p.progress >= 1) {
        p.status = 'breakthrough'; p.breakthroughAt = w.tMonths;
        const lead = createInventor(w, c, p); p.leadCharacterId = lead;
        const inv = {
          id: `inv-${candidate.id}-${w.eventCounter++}`, techId: p.techId, civId: c.id, name: candidate.name,
          discoveredAt: w.tMonths, capabilityGain: candidate.capabilityGain, paradigmLift: candidate.paradigmLift,
          reliabilityPenalty: candidate.reliabilityPenalty, costPenalty: candidate.costPenalty,
          leadCharacterId: lead, sourceProgramId: p.id, status: 'discovered' as const,
        };
        const duplicate = w.inventions.some((x) => x.name === candidate.name && x.id !== inv.id);
        w.inventions.push(inv);
        if (duplicate) {
          // A second, independent route to the same result: it deepens the field but does not move the frontier twice.
          t.cap *= 1 + candidate.capabilityGain * 0.35;
          t.reliability = Math.min(0.99, t.reliability + 0.03);
        } else {
          t.cap *= 1 + candidate.capabilityGain;
          t.paradigmCap *= candidate.paradigmLift;
          t.paradigm += 1;
          t.maturity *= 0.82; t.reliability *= 1 - candidate.reliabilityPenalty; t.cost *= candidate.costPenalty;
        }
        addEvent(w, {
          title: `Breakthrough: ${candidate.name}`,
          body: `${c.name}'s research program produced a new result after ${((w.tMonths - p.startedAt) / 12).toFixed(1)} years. It expands the reachable ${TECH_DEFS[p.techId].short} frontier, but still requires validation and engineering before broad deployment.`,
          category: 'science', civId: c.id, techId: p.techId, significance: 3,
          causes: [{ factor: 'sustained funded research program', weight: 0.45 }, { factor: 'enabling technology and tooling', weight: 0.3 }, { factor: 'successful experimental result', weight: 0.25 }],
          counterforces: [{ factor: 'engineering maturity and cost', weight: 0.8 }], confidence: 'medium',
        });
      }
    } else if (p.status === 'breakthrough' || p.status === 'validation') {
      p.status = 'validation';
      const validationRate = (0.006 + t.maturity * 0.006) * c.economy.institutionalCapacity * (0.6 + c.energy.industryServedRatio * 0.4);
      p.maturity += validationRate;
      if (p.maturity >= 1) {
        p.status = 'completed';
        const inv = w.inventions.find((x) => x.sourceProgramId === p.id);
        if (inv) { inv.status = 'deployed'; inv.validatedAt = w.tMonths; inv.deployedAt = w.tMonths; }
        t.maturity = Math.max(t.maturity, 0.58); t.reliability = Math.max(t.reliability, 0.55); t.mfg *= 1.05;
        addEvent(w, {
          title: `${p.title} enters engineering deployment`,
          body: `Validation is complete enough for initial deployment. Diffusion will now depend on cost, manufacturing, regulation and complementary infrastructure.`,
          category: 'technology', civId: c.id, techId: p.techId, significance: 2,
          causes: [{ factor: 'successful engineering validation', weight: 0.65 }, { factor: 'manufacturing readiness', weight: 0.35 }], counterforces: [{ factor: 'diffusion and scaling remain incomplete', weight: 0.8 }], confidence: 'high',
        });
      }
    }
  }
}

// ── 2. ENERGY — physical system: demand, supply, grid, construction, price ──

function generationTWh(w: WorldState, c: CivState): number {
  let g = 0;
  const fossilDispatch = fossilDispatchFactor(w);
  for (const k of Object.keys(c.energy.sources) as Array<keyof typeof c.energy.sources>) {
    const src = c.energy.sources[k];
    let techGain = 1;
    if (k === 'fossil') techGain *= fossilDispatch;
    if (k === 'fusion') techGain *= 0.85 + Math.min(0.2, Math.log1p(Math.max(0, w.techs.fusion_power.cap - 1)) * 0.1);
    if (k === 'solar') techGain += Math.min(0.35, Math.log1p(Math.max(0, w.techs.solar_pv.cap - 1)) * 0.10);
    if (k === 'wind') techGain += Math.min(0.28, Math.log1p(Math.max(0, w.techs.wind_power.cap - 1)) * 0.08);
    if (k === 'nuclear') techGain += Math.min(0.12, Math.log1p(Math.max(0, w.techs.nuclear_power.cap - 1)) * 0.04);
    if (k === 'geothermal') techGain += Math.min(0.18, Math.log1p(Math.max(0, w.techs.geothermal_power.cap - 1)) * 0.06);
    if (k === 'bioenergy') techGain += Math.min(0.12, Math.log1p(Math.max(0, w.techs.bioenergy_systems.cap - 1)) * 0.04);
    if (k === 'ocean') techGain += Math.min(0.20, Math.log1p(Math.max(0, w.techs.ocean_energy.cap - 1)) * 0.07);
    g += src.cap * src.condition * CAPACITY_FACTOR[k] * techGain * 8.76;
  }
  return g;
}

function deliverableTWh(w: WorldState, c: CivState, genTWh: number): number {
  const gridTechGain = 1 + Math.min(0.45, Math.log1p(Math.max(0, w.techs.grid_transmission.cap - 1)) * 0.16);
  const gridLimit = c.energy.gridCapGW * c.energy.gridCondition * gridTechGain * 8.76 * CALIBRATION.grid.utilization;
  const storageTechGain = 1 + Math.min(0.8, Math.log1p(Math.max(0, w.techs.storage_batt.cap - 1)) * 0.22);
  const storageBonus = Math.min(c.energy.storageGWh / 1000 * storageTechGain, genTWh * 0.11);
  // Orbital power lands at dedicated receivers; it still needs the grid to move, but a
  // large surplus (Dyson-era) bypasses the terrestrial ceiling through dedicated industry.
  // Orbital power is dispatched to fill the gap between terrestrial supply and demand (plus a
  // 20% reserve); the rest of the swarm's output goes to orbital industry and counts in the
  // Kardashev capture, never in the terrestrial reserve margin.
  const terrestrial = Math.min(genTWh + storageBonus, gridLimit);
  const wanted = Math.max(0, c.energy.demandTWh * 1.2 - terrestrial);
  const spaceImport = Math.min(c.energy.spaceSolarTWh, wanted);
  return Math.max(0, terrestrial + spaceImport);
}

function progressLegacyEnergyQueues(c: CivState) {
  // Intervention compatibility: old intervention API may still inject queues.
  for (const k of Object.keys(c.energy.sources) as Array<keyof typeof c.energy.sources>) {
    const src = c.energy.sources[k];
    for (const q of src.queue) q.monthsLeft -= 1;
    const done = src.queue.filter((q) => q.monthsLeft <= 0);
    for (const q of done) {
      const old = src.cap;
      src.cap += q.gw;
      src.condition = Math.min(1, (src.condition * old + q.gw) / Math.max(0.001, src.cap));
      src.avgAgeYears = (src.avgAgeYears * old) / Math.max(0.001, src.cap);
    }
    src.queue = src.queue.filter((q) => q.monthsLeft > 0);
    src.underConstruction = src.queue.reduce((a, q) => a + q.gw, 0);
  }
  for (const q of c.energy.gridQueue) q.monthsLeft -= 1;
  const gridDone = c.energy.gridQueue.filter((q) => q.monthsLeft <= 0);
  for (const q of gridDone) c.energy.gridCapGW += q.gw;
  c.energy.gridQueue = c.energy.gridQueue.filter((q) => q.monthsLeft > 0);
}

function stepAssetMaintenance(w: WorldState, c: CivState) {
  const ec = c.economy;
  const e = c.energy;
  void w;
  const budget = ec.maintenanceBudget; // annualized budget compared with annualized maintenance need
  let need = 0;
  for (const k of Object.keys(e.sources) as Array<keyof typeof e.sources>) {
    const cfg = CALIBRATION.generation[k];
    need += e.sources[k].cap * cfg.maintenanceNeed * 0.005;
  }
  need += e.gridCapGW * 0.0003 + c.housing.stockIndex * CALIBRATION.housing.maintenanceNeed * 0.10 + ec.capital * 0.004;
  // Infrastructure sized for a larger population still has to be kept up by the
  // people who remain. Fewer users per kilometre of pipe and wire means either
  // higher bills or deferred maintenance; here it shows up as unmet need.
  const physical = physicalPopulation(c);
  const stranded = clamp((c.population.peakPhysical - physical) / Math.max(1, c.population.peakPhysical), 0, 0.6);
  need *= 1 + stranded * 0.8;
  const maintenanceExecution = 0.5 + 0.5 * ec.institutionalCapacity;
  const coverage = clamp(budget * maintenanceExecution / Math.max(0.001, need), 0, 1.35);

  for (const k of Object.keys(e.sources) as Array<keyof typeof e.sources>) {
    const src = e.sources[k];
    const cfg = CALIBRATION.generation[k];
    src.avgAgeYears += DT;
    const overload = e.marginPct < 0 ? clamp(-e.marginPct / 40, 0, 1) : 0;
    const wear = (cfg.annualWear + overload * 0.012) * DT;
    const recovery = coverage * cfg.annualWear * 1.08 * DT;
    src.condition = clamp(src.condition - wear + recovery, 0.2, 1);
    src.maintenanceBacklog = clamp(src.maintenanceBacklog + (1 - coverage) * cfg.maintenanceNeed * DT - coverage * 0.02 * DT, 0, 1.5);
    const agePressure = Math.pow(src.avgAgeYears / cfg.lifetimeYears, 5);
    // A fleet far larger than demand is mothballed, fuel plants first: keeping idle
    // capacity costs money and nobody pays for a 300% reserve.
    const surplus = clamp((e.marginPct - 35) / 120, 0, 0.6);
    const mothball = surplus * (k === 'fossil' ? 0.10 : k === 'nuclear' || k === 'fusion' ? 0.02 : 0.05);
    const retireRate = clamp(0.002 + agePressure * 0.035 + src.maintenanceBacklog * 0.012 + mothball, 0.001, 0.2);
    const retired = src.cap * retireRate * DT;
    if (retired > 0) {
      src.cap = Math.max(0, src.cap - retired);
      // retirements remove the oldest assets, so mean fleet age falls somewhat.
      src.avgAgeYears = Math.max(1, src.avgAgeYears - retireRate * 6 * DT);
    }
  }

  const gridWear = (CALIBRATION.grid.annualPhysicalWear + Math.max(0, -e.marginPct) / 100 * CALIBRATION.grid.overloadWearAnnual) * DT;
  e.gridCondition = clamp(e.gridCondition - gridWear + coverage * CALIBRATION.grid.annualPhysicalWear * 1.08 * DT, 0.2, 1);
  e.gridMaintenanceBacklog = clamp(e.gridMaintenanceBacklog + (1 - coverage) * 0.025 * DT - coverage * 0.02 * DT, 0, 1.5);

  c.housing.condition = clamp(c.housing.condition - (CALIBRATION.housing.annualWear + c.housing.maintenanceBacklog * CALIBRATION.housing.severeBacklogWear) * DT + coverage * CALIBRATION.housing.annualWear * 1.08 * DT, 0.25, 1);
  c.housing.maintenanceBacklog = clamp(c.housing.maintenanceBacklog + (1 - coverage) * 0.02 * DT - coverage * 0.016 * DT, 0, 1.5);

  ec.capitalCondition = clamp(ec.capitalCondition - (0.008 + Math.max(0, 1 - coverage) * 0.012) * DT + coverage * 0.0108 * DT, 0.35, 1);
}

function allocateElectricity(c: CivState, deliverable: number, totalDemand: number) {
  const e = c.energy;
  const baseRaw = Math.max(0, e.baseDemandTWh);
  const computeRaw = Math.max(0, e.computeDemandTWh);
  // Price response and artificial-food load mean total demand is not always the
  // simple sum of base + compute. Scale the familiar loads to the actual demand
  // and treat residual electrified processes as industrial demand.
  const familiarRaw = Math.max(0.001, baseRaw + computeRaw);
  const familiarScale = Math.min(1, totalDemand / familiarRaw);
  const base = baseRaw * familiarScale;
  const computeReq = computeRaw * familiarScale;
  const otherReq = Math.max(0, totalDemand - base - computeReq);
  const criticalReq = base * CALIBRATION.economy.electricityCriticalShare;
  const householdReq = base * CALIBRATION.economy.electricityHouseholdShare;
  const industryReq = Math.max(0, base - criticalReq - householdReq) + otherReq;
  let remaining = Math.max(0, Math.min(deliverable, totalDemand));

  const critical = Math.min(criticalReq, remaining); remaining -= critical;
  // Keep a household floor before commercial rationing.
  const householdFloorReq = householdReq * 0.65;
  const householdFloor = Math.min(householdFloorReq, remaining); remaining -= householdFloor;

  let industry = 0, compute = 0;
  const commercialNeed = industryReq + computeReq;
  if (remaining >= commercialNeed) {
    industry = industryReq;
    compute = computeReq;
    remaining -= commercialNeed;
  } else if (remaining > 0 && commercialNeed > 0) {
    const industryWeight = 1.0 + c.traits.marketOrientation * 0.25;
    const computeWeight = 0.55 + c.traits.sciencePriority * 0.7 + c.traits.strategicAutonomy * 0.25;
    const weightedNeed = industryReq * industryWeight + computeReq * computeWeight;
    industry = Math.min(industryReq, remaining * (industryReq * industryWeight / Math.max(0.001, weightedNeed)));
    compute = Math.min(computeReq, remaining * (computeReq * computeWeight / Math.max(0.001, weightedNeed)));
    remaining -= industry + compute;
    // Reallocate residual caused by one category hitting its cap.
    if (remaining > 0) {
      const indGap = Math.max(0, industryReq - industry);
      const compGap = Math.max(0, computeReq - compute);
      const gap = indGap + compGap;
      if (gap > 0) {
        const addI = Math.min(indGap, remaining * indGap / gap);
        industry += addI; remaining -= addI;
        const addC = Math.min(compGap, remaining);
        compute += addC; remaining -= addC;
      }
    }
  }

  const householdExtra = Math.min(Math.max(0, householdReq - householdFloor), remaining);
  const householdServed = householdFloor + householdExtra;
  remaining -= householdExtra;
  // With positive reserve margin every requested load must be fully served.
  const served = critical + householdServed + industry + compute;
  e.servedTWh = Math.min(totalDemand, served);
  e.unservedTWh = Math.max(0, totalDemand - e.servedTWh);
  e.criticalServedRatio = criticalReq > 0 ? clamp(critical / criticalReq, 0, 1) : 1;
  e.industryServedRatio = industryReq > 0 ? clamp(industry / industryReq, 0, 1) : 1;
  e.computeServedRatio = computeReq > 0 ? clamp(compute / computeReq, 0, 1) : 1;
}

function stepEnergy(w: WorldState) {
  for (const c of w.civs) {
    const e = c.energy;
    const t = w.techs;

    progressLegacyEnergyQueues(c);
    stepAssetMaintenance(w, c);

    // Demand is generated by useful economic activity, not by the previous output number alone.
    e.computeDemandTWh = c.compute.dcCapGW * 8.76 * 0.7;
    const evPen = t.transport_ev.adoption[c.id].penetration;
    const electrification = 1 + evPen * 0.3 + t.robotics_ind.adoption[c.id].intensity * 0.10;
    const efficiency = clamp(1 - Math.min(0.32, Math.log1p(Math.max(0, t.ai_models.cap - 1)) * 0.035 + Math.log1p(Math.max(0, t.grid_transmission.cap - 1)) * 0.045), 0.65, 1);
    // Electricity demand follows activity that actually exists. Latent
    // technological potential creates only a small investment/expansion signal;
    // a collapsed economy does not keep demanding the electricity of a fantasy
    // economy that its physical infrastructure cannot operate.
    const latentRatio = clamp(c.economy.potentialOutput / Math.max(0.05, c.economy.output) - 1, 0, 2);
    const activityBase = Math.max(0.05, c.economy.output * (1 + latentRatio * 0.025));
    // Scarcity causes slow structural adaptation: efficiency, relocation and substitution.
    const scarcitySignal = clamp((e.priceIndex - 1.15) * 0.25 + (e.unservedTWh / Math.max(1, e.demandTWh)) * 1.2, 0, 1);
    c.economy.energyIntensityIndex = clamp(c.economy.energyIntensityIndex * (1 - scarcitySignal * 0.022 * DT) * (1 + (e.priceIndex < 0.85 ? 0.003 : 0) * DT), 0.48, 1.08);
    e.baseDemandTWh = c.economy.outputRefTWh * activityBase * c.economy.energyIntensityIndex * electrification * efficiency;
    const foodElecTWh = c.food.artificialShare * e.baseDemandTWh * 0.14;
    const priceElasticity = 1 / Math.pow(Math.max(1, e.priceIndex), 0.16);
    e.demandTWh = c.population.total <= 0 && c.economy.output <= 0.001 ? 0 : Math.max(0.02, (e.baseDemandTWh + e.computeDemandTWh + foodElecTWh) * priceElasticity);

    const gen = generationTWh(w, c);

    // Hydrogen storage is energy-conserving. Electrolysers only charge from real
    // annualised electrical surplus; fuel cells return less electricity later.
    // Values in storage are actual TWh, while demand/generation are TWh/year.
    const h2 = e.hydrogen;
    const cleanGen = Object.entries(e.sources).reduce((sum, [k, src]) => k === 'fossil' ? sum : sum + src.cap * src.condition * CAPACITY_FACTOR[k as keyof typeof CAPACITY_FACTOR] * 8.76, 0) + e.spaceSolarTWh;
    const cleanShare = clamp(cleanGen / Math.max(0.001, gen + e.spaceSolarTWh), 0, 1);
    h2.cleanShare = lerp(h2.cleanShare, cleanShare, 0.03);
    const h2Tech = t.hydrogen_systems.adoption[c.id].penetration * w.params.hydrogenMult;
    h2.industryShare = clamp(lerp(h2.industryShare, h2Tech * h2.cleanShare * clamp(1.1 - e.priceIndex * 0.12, 0.35, 1), 0.012), 0, 0.72);
    h2.transportShare = clamp(lerp(h2.transportShare, h2Tech * h2.cleanShare * 0.42, 0.008), 0, 0.45);
    const preCarrier = deliverableTWh(w, c, gen);
    const surplusAnnual = Math.max(0, preCarrier - e.demandTWh);
    const chargeInputTWh = Math.min(surplusAnnual * DT, h2.electrolyzerGW * 8.76 * DT, Math.max(0, h2.storageCapacityTWh - h2.storageTWh) / 0.70);
    h2.storageTWh = Math.min(h2.storageCapacityTWh, h2.storageTWh + chargeInputTWh * 0.70);
    const deficitAnnual = Math.max(0, e.demandTWh - preCarrier);
    const h2OutAnnual = Math.min(deficitAnnual, h2.fuelCellGW * 8.76, h2.storageTWh * 0.55 / DT);
    h2.storageTWh = Math.max(0, h2.storageTWh - h2OutAnnual * DT / 0.55);
    const del = preCarrier + h2OutAnnual;
    e.marginPct = e.demandTWh <= 0.001 ? (del > 0 ? 100 : 0) : ((del - e.demandTWh) / e.demandTWh) * 100;
    allocateElectricity(c, del, e.demandTWh);
    const shortageShare = e.unservedTWh / Math.max(1, e.demandTWh);
    // Price = fuel + capital + scarcity. Fuel share follows the fossil fleet and
    // fuel cost; capital share follows what the mix cost to build; scarcity adds
    // spikes; a large clean surplus (fusion, orbital power) pushes toward the floor.
    const fossilTWh = e.sources.fossil.cap * e.sources.fossil.condition * CAPACITY_FACTOR.fossil * 8.76 * fossilDispatchFactor(w);
    const fossilShare = clamp(fossilTWh / Math.max(1, gen), 0, 1);
    const fuelComponent = 0.45 * fossilShare * w.resources.fossilCostIndex;
    const cleanCost = (w.techs.solar_pv.cost * e.sources.solar.cap + w.techs.wind_power.cost * e.sources.wind.cap + w.techs.nuclear_power.cost * e.sources.nuclear.cap + w.techs.geothermal_power.cost * e.sources.geothermal.cap + w.techs.bioenergy_systems.cost * e.sources.bioenergy.cap + w.techs.ocean_energy.cost * e.sources.ocean.cap + clamp(w.techs.fusion_power.cost / 4, 0.15, 1.6) * e.sources.fusion.cap + 0.6 * e.sources.hydro.cap)
      / Math.max(0.5, e.sources.solar.cap + e.sources.wind.cap + e.sources.nuclear.cap + e.sources.geothermal.cap + e.sources.bioenergy.cap + e.sources.ocean.cap + e.sources.fusion.cap + e.sources.hydro.cap);
    const capitalComponent = 0.55 * ((1 - fossilShare) * clamp(cleanCost, 0.2, 2) * (0.7 + 0.3 * w.resources.mineralCostIndex) + fossilShare * 0.6);
    const surplus = clamp((e.marginPct - 20) / 80, 0, 1);
    const networkComponent = 0.35 * (0.8 + 0.2 * w.resources.mineralCostIndex); // wires, transformers, retail: does not go away with cheap generation
    const targetPrice = clamp(fuelComponent + capitalComponent + networkComponent + shortageShare * 5.5 + Math.max(0, 0.9 - e.gridCondition) * 0.8 - surplus * 0.2, 0.45, 8);
    e.priceIndex = lerp(e.priceIndex, targetPrice, shortageShare > 0.05 ? 0.22 : 0.05);
    e.constrained = shortageShare > 0.015 || e.marginPct < 4;

    // Storage can grow only through actual investment projects. Existing storage also ages modestly.
    e.storageGWh *= 1 - 0.015 * DT;
  }
}

// ── 3. COMPUTE — accelerators, data centers, supply vs demand ───────────────

function stepCompute(w: WorldState) {
  const fab = w.techs.semiconductor_fab;
  const accel = w.techs.compute_accel;
  const globalFabOutput = fab.mfg * (0.45 + 0.55 * fab.cap);

  for (const c of w.civs) {
    const cp = c.compute;
    // Legacy intervention queue compatibility.
    for (const q of cp.dcQueue) q.monthsLeft -= 1;
    const done = cp.dcQueue.filter((q) => q.monthsLeft <= 0);
    for (const q of done) cp.dcCapGW += q.gw;
    cp.dcQueue = cp.dcQueue.filter((q) => q.monthsLeft > 0);

    // Physical data centers and accelerator fleets age/obsolesce.
    cp.dcCapGW = Math.max(0.05, cp.dcCapGW * (1 - (1 / CALIBRATION.datacenter.lifetimeYears) * 0.32 * DT));
    cp.accelStock *= 1 - 0.11 * DT; // frontier accelerators become economically obsolete quickly

    const importAccess = w.relations
      .filter((r) => r.a === c.id || r.b === c.id)
      .some((r) => r.chipExportAllowed);
    const domesticShare = clamp(w.techs.semiconductor_fab.adoption[c.id].penetration * 0.42 + c.traits.strategicAutonomy * 0.10, 0.03, 0.6);
    const importShare = importAccess ? 0.20 * w.params.tradeOpenness : 0;
    const chipInvestmentGate = clamp(c.economy.investmentBudget / Math.max(0.04, c.economy.output * 0.22), 0.25, 1.4);
    const growth = (domesticShare + importShare) * globalFabOutput * 0.045 * chipInvestmentGate;
    cp.accelStock += Math.max(0, growth) * DT * (w.params.computeDoublingMonths > 0 ? (5.5 / w.params.computeDoublingMonths) : 1);

    const algoGain = Math.pow(2, w.tMonths / Math.max(5, w.params.algorithmicHalvingMonths));
    const nameplateSupply = cp.accelStock * Math.pow(accel.cap, 0.82) * Math.pow(algoGain, 0.20) * 0.55;
    // A dark data center is not compute supply. Electricity allocation is a hard gate.
    cp.supplyFlops = nameplateSupply * c.energy.computeServedRatio;

    const trainWant = w.techs.ai_models.effort * 0.32 * (1 + c.researchAlloc.ai_models * 3.5);
    const inferWant = (w.techs.ai_models.adoption[c.id].intensity + w.techs.ai_agents.adoption[c.id].intensity) * Math.max(0.1, c.economy.output) * 0.7;
    const digitalWant = c.population.total * c.population.digitalShare * 0.12; // substrate minds are a standing compute load
    cp.demandFlops = Math.max(0.05, trainWant + inferWant + digitalWant);
    cp.constrained = cp.demandFlops > cp.supplyFlops * 1.03 || c.energy.computeServedRatio < 0.92;
  }
}

// ── 3b. FOOD & AGRICULTURE — land, yields, climate, artificial food, trade ──
// Demand follows population & affluence. Land production = capacity × yield ×
// climate penalty × energy availability. Biotech capability unlocks artificial
// food (precision fermentation / vertical farms) which decouples food from
// land but moves its cost onto the electricity grid. Surplus civs export to
// deficit civs — unless relations turn hostile: food is leverage.

function stepFood(w: WorldState) {
  const t = w.techs;
  for (const c of w.civs) {
    const f = c.food;
    const def = civDef(c.id);
    const hardship = energyHardship(c);

    // demand: embodied Earth-resident population + richer diets as economies grow.
    // Off-world settlements run closed loops; digital minds eat electricity.
    f.demandIndex =
      (physicalPopulation(c) / def.population.total) *
      (1 + 0.12 * Math.min(4, c.economy.outputPerCapita - 1));

    // conventional yields: agronomy science (biotech), farm robotics, AI advisory
    const bioCap = t.biotech_med.cap;
    const yieldTarget =
      1 + Math.max(0, bioCap - 1) * 0.28 +
      t.robotics_ind.adoption[c.id].penetration * 0.15 +
      Math.max(0, t.ai_models.cap - 1) * 0.05;
    f.landYield = lerp(f.landYield, yieldTarget, 0.015);

    // warming bites (regional sensitivity); energy crisis means no fuel, no cold chain
    // Yield loss is convex in warming: mild to 2.5 °C, then heat waves, drought and
    // failed monsoons compound (IPCC AR6 WG2; Burke et al.). At 5 °C the breadbasket is gone.
    const wC = w.env.warmingC;
    const climatePenalty = clamp(1 - (Math.max(0, wC - 1.1) * 0.07 + Math.pow(Math.max(0, wC - 2.5), 2) * 0.06) * def.food.climateSensitivity, 0.05, 1);
    const energyFactor = 1 - hardship * 0.4;

    // artificial food: unlocked by biotech capability, built where power is spare.
    // Scarcity pulls investment toward it; strategic-autonomy doctrine adds push.
    if ((bioCap > 1.3 || f.artificialShare > 0.05) && !f.artificialUnlocked) f.artificialUnlocked = true;
    if (f.artificialUnlocked) {
      const gridHeadroom = clamp((c.energy.marginPct - 4) / 12, 0, 1);
      const techPull = clamp((bioCap - 1.3) * 0.55, 0, 0.85);
      const needPush = clamp((0.95 - f.selfSufficiency) * 1.6, 0, 0.8);
      const target = clamp(Math.max(techPull, needPush) + c.traits.strategicAutonomy * 0.15 * techPull, 0, 0.85) *
        (0.25 + 0.75 * gridHeadroom);
      f.artificialShare = lerp(f.artificialShare, target, 0.012 + (f.selfSufficiency < 0.9 ? 0.014 : 0));
    }
    // rewilding: as production moves indoors, marginal farmland is abandoned
    f.landUse = lerp(f.landUse, clamp(1 - f.artificialShare * 0.6, 0.25, 1), 0.01);

    f.productionIndex = f.landCapacity * f.landYield * climatePenalty * energyFactor * f.landUse + f.artificialShare * f.demandIndex;
    f.selfSufficiency = f.productionIndex / Math.max(0.05, f.demandIndex);
  }

  // food trade: surplus civs cover deficits — but only across friendly borders.
  // Hostility cuts shipments (food weaponization), war cuts them entirely.
  for (const c of w.civs) {
    const f = c.food;
    const deficit = Math.max(0, f.demandIndex - f.productionIndex);
    let imports = 0;
    if (deficit > 0.001) {
      for (const o of w.civs) {
        if (o.id === c.id) continue;
        const surplus = Math.max(0, o.food.productionIndex - o.food.demandIndex);
        if (surplus <= 0.001) continue;
        const rel = w.relations.find((r) => (r.a === c.id && r.b === o.id) || (r.b === c.id && r.a === o.id))!;
        const politics = rel.relation > -0.2 ? 1 : clamp(1 + (rel.relation + 0.2) * 2.5, 0, 1);
        // food trades readily across open borders (staples are globally traded goods)
        const openness = clamp(rel.tradeOpenness * 1.6, 0, 1);
        const ship = Math.min(deficit - imports, surplus * 0.6) * politics * openness;
        imports += Math.max(0, ship);
      }
    }
    f.importShare = imports / Math.max(0.05, f.demandIndex);
    const covered = f.selfSufficiency + f.importShare;
    f.shortage = clamp(1 - covered, 0, 0.5);
    // food demand is price-inelastic: small gaps, big spikes (2008 / 2022 style)
    const targetPrice = clamp(1 + Math.pow(Math.max(0, 1 - covered), 1.6) * 5 - Math.max(0, covered - 1.1) * 0.25, 0.6, 4);
    f.priceIndex = lerp(f.priceIndex, targetPrice, 0.08);
  }
}

// ── 3c. HOUSING & WASTE — living space and the physical byproducts of life ──
// Housing: demand tracks population & urbanization; construction responds to
// crowding but needs capital, energy and (increasingly) construction robotics.
// Crowded cities suppress births, repel migrants and breed unrest.
// Waste: everything consumed becomes waste. Managed share rises with
// institutions and technology — but only under investment pressure; the rest
// accumulates, poisoning health and politics until someone deals with it.

function stepUrban(w: WorldState) {
  const t = w.techs;
  for (const c of w.civs) {
    const def = civDef(c.id);
    const h = c.housing;
    const hardship = energyHardship(c);

    const popIndex = physicalPopulation(c) / def.population.total;
    const urbanFactor = Math.pow(Math.max(0.55, c.population.urbanization / def.population.urbanization), 0.5);
    // Wealth raises desired quality/space slowly, but does not force endless physical expansion.
    const incomeFactor = clamp(1 + Math.log1p(Math.max(0, c.economy.wageIndex - 1)) * 0.08, 0.85, 1.12);
    h.demandIndex = popIndex * urbanFactor * incomeFactor;
    const habitatOutage =
      c.land.floating * (1 - c.land.floatingCondition) +
      c.land.subsea * (1 - c.land.subseaCondition) +
      c.land.vertical * (1 - c.land.verticalCondition) +
      c.land.underground * (1 - c.land.undergroundCondition);
    const usable = Math.max(0.001, (h.stockIndex - habitatOutage) * h.condition * (1 - h.abandoned));
    const excess = usable - h.demandIndex;
    h.crowding = clamp(h.demandIndex / usable - 1, 0, 1);
    // A shrinking population leaves empty houses where people used to live even
    // when the remaining residents want more space elsewhere (Japan's akiya).
    const shrinkNow = clamp((c.population.peakPhysical - physicalPopulation(c)) / Math.max(1, c.population.peakPhysical), 0, 1);
    const vacancyTarget = Math.max(excess > 0 ? clamp(excess / usable, 0.02, 0.55) : 0.025, shrinkNow * 0.55);
    h.vacancy = lerp(h.vacancy, vacancyTarget, 0.045);
    h.rentIndex = lerp(h.rentIndex, clamp(1 + Math.pow(h.crowding, 1.35) * 3.1 - h.vacancy * 0.55, 0.55, 4.5), 0.07);

    // Empty homes decay. When people leave, nobody fixes the roof; when they
    // leave for good, whole streets go dark. Strong, solvent institutions
    // demolish or renovate derelict stock; weak ones let it rot in place.
    const institutions = c.economy.institutionalCapacity;
    const shrinkage = clamp((c.population.peakPhysical - physicalPopulation(c)) / Math.max(1, c.population.peakPhysical), 0, 1);
    const dereliction = (Math.max(0, h.vacancy - 0.08) * 0.09 + shrinkage * 0.03 * (1.1 - institutions) + Math.max(0, 0.6 - h.condition) * 0.06) * (1.3 - institutions * 0.6) * DT * (h.crowding > 0.1 ? 0.15 : 1);
    // Rich, well-run places clear derelict blocks quickly (and turn them into parks); poor ones cannot afford demolition.
    const wealthClearance = 0.02 * clamp(c.economy.outputPerCapita - 1, 0, 3);
    const clearance = h.abandoned * (0.02 + institutions * 0.06 + h.crowding * 0.5 + wealthClearance) * clamp(c.economy.capexAvailability, 0.3, 1.2) * DT;
    h.abandoned = clamp(h.abandoned + dereliction - clearance, 0, 0.85);
    // Vacant stock takes no maintenance; its decay drags the average condition down.
    h.condition = clamp(h.condition - h.abandoned * 0.035 * DT, 0.25, 1);
    // Demolition removes derelict stock; a shrinking city gets physically smaller.
    if (h.abandoned > 0.05) {
      const demolish = clearance * 0.6;
      h.stockIndex = Math.max(0.15, h.stockIndex * (1 - demolish));
    }

    const ws = c.waste;
    ws.generatedIndex = popIndex * clamp(0.55 + 0.45 * c.economy.output / Math.max(0.1, def.economy.output), 0.35, 2.5);
    const techCapacity = 0.3 + c.population.education * 0.25 + t.robotics_ind.adoption[c.id].penetration * 0.15 + Math.log1p(Math.max(0, t.ai_models.cap - 1)) * 0.04;
    const pressure = clamp(ws.accumulation * 1.5 + c.society.backlash * 0.25, 0, 1);
    const institutionGate = 0.4 + c.economy.institutionalCapacity * 0.6;
    const targetManaged = clamp(techCapacity * institutionGate * (0.75 + pressure * 0.45), 0.08, 0.95) * (1 - hardship * 0.45);
    ws.managedShare = lerp(ws.managedShare, targetManaged, 0.01 + pressure * 0.018);
    const unmanaged = ws.generatedIndex * (1 - ws.managedShare);
    ws.accumulation = Math.max(0, ws.accumulation + (unmanaged * 0.012 - ws.accumulation * 0.02) * DT * 12);
  }
}

// ── 4. ECONOMY — production, labor, automation, distribution ───────────────

function stepEconomy(w: WorldState) {
  for (const c of w.civs) {
    const ec = c.economy;
    const t = w.techs;
    const pop = c.population;
    const prevOutput = ec.output;
    ec.laborForce = pop.total * pop.workingShare * 0.62;

    const autonomy = autonomyIndex(t.ai_agents.cap);
    const cognitiveExposure = clamp(Math.log2(Math.max(1, autonomy)) / 5, 0, 0.75);
    const aiAdopt = t.ai_agents.adoption[c.id].intensity * 0.6 + t.ai_models.adoption[c.id].intensity * 0.4;
    const robotAdopt = t.robotics_ind.adoption[c.id].intensity * 0.7 + t.robotics_gp.adoption[c.id].intensity * 0.3;
    ec.automationExposure = clamp(cognitiveExposure * aiAdopt + 0.35 * robotAdopt, 0, 0.9);

    const retrain = civPolicy(w, c.id, 'retraining');
    const displacementRate = ec.automationExposure * 0.018 * (1 - retrain * 0.35);
    const absorptionRate = 0.028 * (0.6 + Math.min(2.5, ec.tfp) * 0.25) * (1 + retrain * 0.4) * ec.institutionalCapacity;
    ec.displacedShare = clamp01(ec.displacedShare + (displacementRate - absorptionRate * ec.displacedShare) * DT);

    // Productivity growth comes from *new* technological improvement and its
    // absorption, not from re-counting the entire accumulated capability level
    // every year. The old formulation effectively granted the 2040 AI frontier
    // again in 2041, 2042, ... and drove theoretical output to absurd values.
    const absorptiveCapacity = clamp(0.45 + ec.institutionalCapacity * 0.28 + pop.education * 0.18, 0.45, 1.05);
    const aiFrontierGrowth = clamp(t.ai_models.lastGrowthRate, 0, 2.5);
    const agentFrontierGrowth = clamp(t.ai_agents.lastGrowthRate, 0, 2.5);
    const robotFrontierGrowth = clamp(t.robotics_ind.lastGrowthRate, 0, 1.5);
    const bioFrontierGrowth = clamp(t.biotech_med.lastGrowthRate, 0, 1.2);
    const aiGain = aiAdopt * (aiFrontierGrowth * 0.014 + agentFrontierGrowth * 0.007) * absorptiveCapacity;
    const robotGain = robotAdopt * robotFrontierGrowth * 0.010 * absorptiveCapacity;
    const bioGain = t.biotech_med.adoption[c.id].intensity * bioFrontierGrowth * 0.004 * absorptiveCapacity;
    const diffusionGain = clamp((t.ai_models.adoption[c.id].penetration - t.ai_models.adoption[c.id].intensity) * 0.010 + (t.robotics_ind.adoption[c.id].penetration - t.robotics_ind.adoption[c.id].intensity) * 0.008, 0, 0.010);
    // Cumulative technology creates a productivity *level* opportunity. TFP
    // converges toward that level once, rather than re-booking the same
    // capability as fresh growth forever.
    const techLevelTarget = 1
      + aiAdopt * Math.log1p(Math.max(0, t.ai_models.cap - 1)) * 0.85
      + t.ai_agents.adoption[c.id].intensity * Math.log1p(Math.max(0, t.ai_agents.cap - 1)) * 0.30
      + robotAdopt * Math.log1p(Math.max(0, t.robotics_ind.cap - 1)) * 0.42
      + t.biotech_med.adoption[c.id].intensity * Math.log1p(Math.max(0, t.biotech_med.cap - 1)) * 0.18;
    const levelCatchup = clamp((techLevelTarget / Math.max(0.45, ec.tfp) - 1) * 0.055, -0.01, w.params.aiFeedback > 1.5 ? 0.055 : 0.040);
    const baseGrowth = 0.003 + 0.007 * clamp(pop.education, 0.3, 1.1) * clamp(ec.institutionalCapacity + 0.3, 0.4, 1.1);
    const tfpAnnual = clamp(baseGrowth + aiGain + robotGain + bioGain + diffusionGain + levelCatchup, -0.03, w.params.aiFeedback > 1.5 ? 0.11 : 0.075);
    ec.tfp = Math.max(0.45, ec.tfp * (1 + tfpAnnual * DT));

    // Capital is a stock. Active projects consume finite investment resources;
    // whatever remains can expand productive capital. Depreciation always exists.
    const activeProjectSpendAnnual = w.projects
      .filter((p) => p.civId === c.id && !['operational','cancelled'].includes(p.status))
      .reduce((a, p) => a + (p.capex / Math.max(1, p.totalMonths)) * 12, 0);
    const maintenance = ec.maintenanceBudget;
    // Project spending is capital formation too: a fusion plant, a reclaimed district or a
    // spaceport is productive capital once built. It crowds out other investment only in part.
    // (The earlier accounting treated every project as a pure drain, and long frontier
    // pipelines starved the capital stock to zero: output fell 90% in healthy, growing polities.)
    const crowdOut = 0.25;
    const productiveInvestment = Math.max(0, ec.investmentBudget - maintenance - activeProjectSpendAnnual * crowdOut) + activeProjectSpendAnnual * 0.5;
    const depreciation = CALIBRATION.finance.capitalDepreciationAnnual * (1 + Math.max(0, 0.75 - ec.capitalCondition) * 0.4);
    ec.capital = Math.max(0.05, ec.capital * (1 - depreciation * DT) + productiveInvestment * 0.32 * DT);

    // Determine employment from realized utilization rather than TFP alone.
    const energyService = clamp(0.05 + 0.20 * c.energy.criticalServedRatio + 0.58 * c.energy.industryServedRatio + 0.17 * c.energy.computeServedRatio, 0.03, 1);
    const foodService = clamp(1 - c.food.shortage * 0.85, 0.2, 1);
    const housingService = clamp(1 - c.housing.crowding * 0.22, 0.65, 1);
    const institutionalService = clamp(0.64 + Math.sqrt(Math.max(0, ec.institutionalCapacity)) * 0.40, 0.64, 1);
    const nonEnergyUtilization = Math.min(foodService, institutionalService) * housingService;
    const utilization = Math.min(energyService, foodService, institutionalService) * housingService;

    const natural = 0.045;
    const shortageUnemployment = (1 - utilization) * 0.42;
    // "Unemployment" here is the share of working-age adults outside paid work.
    // After a provision floor exists it is no longer a hardship measure; the
    // society layer uses laborRelevance to weigh it.
    const uTarget = clamp(natural + ec.displacedShare * 0.20 + shortageUnemployment, 0.02, 0.65);
    ec.unemployment = lerp(ec.unemployment, uTarget, 0.10 + (1 - utilization) * 0.18);

    // Robots and general-purpose machines are labor: as they scale, output decouples from the number of human hands.
    const laborInput = ec.laborForce * (1 - ec.unemployment) * (1 + robotAdopt * Math.log1p(Math.max(0, t.robotics_ind.cap - 1)) * 0.45 + t.robotics_gp.adoption[c.id].penetration * Math.log1p(Math.max(0, t.robotics_gp.cap - 1)) * 0.3);
    // Population.total already includes digital minds and off-world residents, so they
    // must not be added to labour a second time. Instead, substrate changes the
    // productivity of the digital share. `supplyFlops`/`demandFlops` are legacy field
    // names for abstract compute-service indices, not literal FLOP/s; their ratio is
    // therefore the only defensible quantity to use here. A compute-starved digital
    // population can be less productive than the embodied baseline; abundant compute
    // raises its effective contribution, but only within a bounded range.
    const digitalShare = clamp(c.population.digitalShare, 0, 1);
    const computeAdequacy = clamp(c.compute.supplyFlops / Math.max(0.05, c.compute.demandFlops), 0.25, 1.6);
    const digitalProductivity = clamp(0.72 + computeAdequacy * 0.48, 0.84, 1.49);
    const substrateMix = (1 - digitalShare) + digitalShare * digitalProductivity;
    // Orbital industry is productive capital/services, not free extra workers. Its
    // contribution is deliberately sub-linear and tied to the share of the population
    // that actually lives off Earth, preventing a tiny orbital sector from multiplying
    // the entire terrestrial economy by several times.
    const offworldShare = clamp(c.population.offworld / Math.max(0.001, c.population.total), 0, 1);
    const orbitalServiceBoost = 1 + Math.min(0.38, Math.log1p(Math.max(0, c.space.orbitalIndustry)) * 0.075 * (0.35 + offworldShare * 1.65));
    const laborInputEff = laborInput * substrateMix * orbitalServiceBoost;
    const rawPotential = ec.tfp * Math.pow(Math.max(0.05, laborInputEff / 26), 0.60) * Math.pow(Math.max(0.05, ec.capital), 0.35) * ec.capitalCondition;
    ec.potentialOutput = Math.max(0.02, rawPotential * ec.outputScale);

    // Hard physical bottleneck. The electricity margin is computed against
    // the activity that actually exists this month. If deliverable electricity
    // is only 75% of that requirement, output cannot keep expanding because TFP
    // happens to be high; it must contract toward the physically supportable
    // level. Surplus power provides headroom for growth, bounded by potential.
    const deliverableRatio = clamp(1 + c.energy.marginPct / 100, 0.06, 1.35);
    const electricityOutputCeiling = Math.max(0.01, prevOutput * deliverableRatio);
    const nonEnergyCeiling = ec.potentialOutput * nonEnergyUtilization;
    // Even a failed state has a subsistence and informal economy: people farm,
    // trade and repair. Output cannot fall below roughly a fifth of the 2026
    // level per person unless famine takes the people too.
    const def0 = civDef(c.id);
    const subsistence = def0.economy.output * 0.22 * (c.population.total / def0.population.total) * (0.5 + 0.5 * foodService);
    const targetOutput = Math.max(subsistence, Math.min(nonEnergyCeiling, electricityOutputCeiling));
    const adjust = CALIBRATION.economy.outputAdjustmentMonthly + Math.max(0, 1 - deliverableRatio) * 0.28 + Math.max(0, 1 - nonEnergyUtilization) * 0.12;
    ec.output = Math.max(0.01, lerp(ec.output, targetOutput, clamp(adjust, 0.08, 0.55)));

    const wageTarget = clamp(ec.tfp * (1 - ec.unemployment * 0.65 * c.society.laborRelevance) * (0.8 + utilization * 0.2), 0.25, 12);
    ec.wageIndex = lerp(ec.wageIndex, wageTarget, 0.035);
    const ubs = civPolicy(w, c.id, 'ubs') + c.society.basicProvision * 0.9;
    // Inequality is a level, not a ratchet: automation and joblessness push it up,
    // an income floor, retraining, education and strong institutions pull it down.
    const giniTarget = clamp(0.30 + ec.automationExposure * 0.22 + Math.max(0, ec.unemployment - 0.06) * 0.6 * c.society.laborRelevance
      - c.society.basicProvision * 0.16 - ubs * 0.06 - retrain * 0.03 - pop.education * 0.05 - ec.institutionalCapacity * 0.06
      - (w.params.socialContract - 1) * 0.14, 0.20, 0.82);
    ec.gini = lerp(ec.gini, giniTarget, 0.02 * DT * 12);
    ec.outputPerCapita = ec.output / Math.max(0.05, c.population.total) / (civDef(c.id).economy.output / civDef(c.id).population.total);

    // Public finance becomes harder when the tax base contracts. Debt is a ratio,
    // so collapse in output can make an existing burden suddenly severe.
    const crisisGap = clamp(1 - utilization, 0, 1);
    // Structural spending: an aging population (pensions, care), an income floor
    // for people automation left behind, and the cost of carrying old debt at a
    // rate that rises with the debt itself. Growth and prosperity pay for some of it.
    const agingBurden = Math.max(0, (1 - c.population.workingShare) - 0.36) * 0.12 + Math.max(0, c.population.lifeExpectancy - 84) * 0.0006 * (1 - c.society.basicProvision * 0.3);
    const provisionCost = c.society.basicProvision * 0.028 * clamp(1 - ec.outputPerCapita * 0.04, 0.4, 1);
    const primaryDeficit = -0.006 + agingBurden + provisionCost + Math.max(0, ec.unemployment - 0.06) * 0.10 * c.society.laborRelevance + crisisGap * 0.045 + ubs * 0.03 * clamp(ec.unemployment * 3, 0.2, 1) - Math.max(0, ec.outputPerCapita - 1.5) * 0.004 - Math.max(0, tfpAnnual - 0.015) * 0.15;
    const interestBurden = Math.min(0.06, ec.publicDebt * Math.min(0.03, 0.004 + Math.max(0, ec.publicDebt - 0.9) * 0.018));
    // Debt above three times output does not get paid; it gets restructured, at a price already charged through capex availability.
    if (ec.publicDebt > 3 && c.society.stability < 0.45) ec.publicDebt *= 1 - 0.08 * DT;
    // Debt is a ratio to output. Real growth erodes the ratio; contraction
    // mechanically raises it. The previous implementation omitted this
    // denominator effect and therefore drove every growing baseline into debt.
    const realGrowthAnnualized = clamp((ec.output / Math.max(0.01, prevOutput) - 1) / DT, -0.65, 0.65);
    ec.publicDebt = clamp(ec.publicDebt + (primaryDeficit + interestBurden - realGrowthAnnualized * ec.publicDebt * 0.72) * DT, 0.15, 4.5);
    const financeTarget = clamp(1.15 - Math.max(0, ec.publicDebt - 0.7) * 0.30 + ec.institutionalCapacity * 0.18, 0.16, 1.45);
    ec.capexAvailability = lerp(ec.capexAvailability, financeTarget, 0.035);

    // Institutions are a stock too: prolonged crisis damages execution capacity;
    // stable, solvent government can rebuild it only gradually.
    const hardship = energyHardship(c);
    const institutionTarget = clamp((0.38 + c.society.stability * 0.48 + c.society.trust * 0.18 - Math.max(0, ec.publicDebt - 1.2) * 0.10 - hardship * 0.18) * w.params.governanceCapacity, 0.05, 0.98);
    ec.institutionalCapacity = lerp(ec.institutionalCapacity, institutionTarget, 0.012);

    const attract = civPolicy(w, c.id, 'attract_scientists');
    const edu = civPolicy(w, c.id, 'education');
    pop.education = clamp(pop.education * (1 + (0.0035 + edu * 0.009) * DT), 0.3, 1.6);
    const researchTarget = clamp((0.45 + pop.education * 0.55) * ec.institutionalCapacity * (0.65 + ec.output * 0.25) * (1 + attract * 0.12), 0.08, 8);
    c.researchCapacity = lerp(c.researchCapacity, researchTarget, 0.012);
  }
}

// ── 5. POPULATION & DEMOGRAPHICS (UN WPP-calibrated drift) ──────────────────

function stepPopulation(w: WorldState) {
  for (const c of w.civs) {
    const p = c.population;
    const bio = w.techs.biotech_med;
    const lon = w.techs.longevity_bio;
    const hardship = energyHardship(c);

    // Life expectancy: education and conventional medicine raise it slowly;
    // longevity therapies raise it a lot, but only for the share of people who
    // get them; crisis, famine and pollution cut it.
    const medGain = Math.min(8, Math.max(0, bio.cap - 1) * 1.6 * bio.adoption[c.id].intensity);
    const longevityYears = lon.adoption[c.id].intensity * Math.min(40, Math.max(0, lon.cap - 0.5) * 8);
    const leTarget = clamp(66 + p.education * 12 + medGain + longevityYears - hardship * 6 - c.food.shortage * 12 - c.waste.accumulation * 3, 45, 150);
    p.lifeExpectancy = lerp(p.lifeExpectancy, leTarget, 0.03 * DT * 12);

    // Crude rates from age structure (UN WPP-style relationships):
    // young societies have high births and low deaths; aged ones the reverse.
    // Crisis mortality on top of the age-specific life table: famine, state
    // failure and heat compound; this is where extinction becomes reachable.
    const famine = Math.pow(Math.max(0, c.food.shortage - 0.18) / 0.32, 2) * 0.09;
    const stateFailure = Math.pow(Math.max(0, 0.2 - c.society.stability) / 0.2, 2) * 0.05;
    const heat = (Math.max(0, w.env.warmingC - 3) * 0.006 + Math.pow(Math.max(0, w.env.warmingC - 4), 2) * 0.01) * (1 - c.society.basicProvision * 0.3);
    const extraDeath = Math.min(0.65, (hardship * 0.012 + c.food.shortage * 0.014 + c.housing.crowding * 0.002 + c.waste.accumulation * 0.004 + Math.max(0, 0.35 - c.society.stability) * 0.01 + famine + stateFailure + heat) * w.params.collapseSeverityMult);
    // Hardship, hunger and crowded, expensive cities suppress births.
    const birthSuppression = clamp(hardship * 0.8 + c.food.shortage * 0.9 + c.housing.crowding * 0.3, 0, 0.95);
    reconcile(p); // migration, off-world moves and off-world births changed total since last month
    const rates = stepCohorts(p, extraDeath, birthSuppression, DT);
    p.birthRate = rates.birthRate; p.deathRate = rates.deathRate;

    // Fertility is a regime, not a demographic destiny. Education and urbanisation
    // can push family formation down during a transition, but affordability,
    // institutions, culture, long healthy lives and reproductive technology can
    // stabilise or reverse it. A slow stochastic component represents the wide
    // long-run uncertainty in UN population projections; scenarios can deliberately
    // explore persistent low fertility or renewed growth without a hidden population cap.
    const def = civDef(c.id);
    const startingNorm = clamp((def.population.fertility - 0.6) / 3.2, 0.08, 0.9);
    const transition = Math.max(0, p.education - def.population.education) * 0.12 + Math.max(0, p.urbanization - def.population.urbanization) * 0.10;
    const affordability = (1 - c.housing.crowding) * 0.055 + clamp(1.2 - c.housing.rentIndex, -0.4, 0.4) * 0.05;
    const security = c.society.basicProvision * 0.05 + (c.society.stability - 0.55) * 0.08 - Math.max(0, c.economy.gini - 0.44) * 0.12;
    const healthyYears = Math.min(0.07, Math.max(0, p.lifeExpectancy - 88) * 0.0025);
    const assisted = Math.max(0, w.techs.biotech_med.adoption[c.id].intensity - 0.55) * 0.04 * w.params.reproductionTechMult;
    const scenarioShift = (w.params.fertilityMult - 1) * 0.30;
    const normTarget = clamp(startingNorm + scenarioShift - transition + affordability + security + healthyYears + assisted + (c.society.revivalMonths > 0 ? 0.16 : 0), 0.01, 0.98);
    if (w.tMonths % 12 === 0 && p.total > 0) {
      c.society.familyFormation = clamp(c.society.familyFormation + gaussian(w.rng) * 0.006 * w.params.demographicVolatility, 0.01, 0.98);
    }
    c.society.familyFormation = lerp(c.society.familyFormation, normTarget, 0.004 * DT * 12);
    const longLife = Math.min(0.30, Math.max(0, p.lifeExpectancy - 92) * 0.008);
    const fertTarget = clamp(0.6 + 3.2 * c.society.familyFormation + longLife, 0.45, 5.2);
    p.fertility = lerp(p.fertility, fertTarget / Math.pow(w.params.agingMult, 0.22), 0.004 * DT * 12);

    // Urbanisation also has an equilibrium rather than an automatic march to 100%.
    // Failed states and depopulating regions can deurbanise; prosperous dense worlds
    // can settle near the high 80s/90s without consuming every hectare.
    const urbanTarget = c.society.polityStatus === 'abandoned' ? 0.25 : clamp(def.population.urbanization + Math.log1p(Math.max(0, c.economy.outputPerCapita - 0.7)) * 0.08 + c.land.vertical * 0.03 - c.housing.abandoned * 0.18, 0.30, 0.97);
    p.urbanization = clamp01(lerp(p.urbanization, urbanTarget, 0.004 * DT * 12));
    // Age structure follows fertility and longevity with a long lag.
    // Working-age share: fewer children and elders means more workers, until
    // aging bites; longevity extends healthy working lives.
    // Off-world residents are part of the total; deaths and births above apply to them too.
    p.offworld = Math.min(p.offworld, p.total * 0.95);
  }
  // migration between civs: wage & stability differentials (× scenario knob)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      const a = w.civs[i], b = w.civs[j];
      const pull = clamp(
        (b.economy.wageIndex / Math.max(0.2, a.economy.wageIndex) - 1) * 0.5 +
        (b.society.stability - a.society.stability) * 0.4 +
        (b.economy.unemployment * b.society.laborRelevance - a.economy.unemployment * a.society.laborRelevance) * -0.8 +
        (energyHardship(a) - energyHardship(b)) * 0.7 + // crisis exodus
        (a.food.shortage - b.food.shortage) * 1.2 +     // hunger migration
        (a.housing.crowding - b.housing.crowding) * 0.4 + // people leave crowded, expensive cities
        (a.waste.accumulation - b.waste.accumulation) * 0.3 +
        (b.society.basicProvision - a.society.basicProvision) * 0.25,
        -0.5, 0.5,
      );
      if (pull > 0.05) {
        const flow = (a.population.total - a.population.offworld) * 0.0006 * pull * w.params.migrationMult * (1 + energyHardship(a) * 2 + a.food.shortage * 2) * DT;
        a.population.total -= flow;
        b.population.total += flow;
      }
    }
  }
}

// ── 6. SOCIETY — trust, stability, backlash (all causal) ────────────────────

function stepSociety(w: WorldState) {
  for (const c of w.civs) {
    const s = c.society;
    const ec = c.economy;
    // backlash: fast displacement + inequality + visible price shocks + blackouts
    const hardship = energyHardship(c);
    const severeEnergyStress = clamp((hardship - 0.12) / 0.55, 0, 1);
    const jobless = ec.unemployment * s.laborRelevance;
    const displacePressure = clamp((jobless - 0.07) * 3.2, 0, 1) * 0.42 + clamp(ec.gini - 0.44, 0, 0.4) * 0.45 + clamp(c.energy.priceIndex - 1.45, 0, 1.5) * 0.20 + severeEnergyStress * 0.55 +
      c.food.shortage * 1.0 + clamp(c.food.priceIndex - 1.4, 0, 1) * 0.4 +
      c.housing.crowding * 0.35 + clamp(c.housing.rentIndex - 1.55, 0, 1) * 0.22 +
      c.waste.accumulation * 0.25;
    const ubs = civPolicy(w, c.id, 'ubs');
    const retrain = civPolicy(w, c.id, 'retraining');
    s.backlash = clamp01(s.backlash + (displacePressure * 0.045 - (0.022 + ubs * 0.04 + retrain * 0.03)) * DT);
    // Trust changes from lived outcomes, but mature institutions do not lose all
    // legitimacy from a modest reserve-margin problem. Severe, persistent
    // blackouts still destroy trust rapidly.
    const trustTarget = clamp(- Math.max(0, c.economy.gini - 0.42) * 0.35 + 
      0.46 + (0.07 - jobless) * 1.2 + (1.25 - c.energy.priceIndex) * 0.10 + (0.5 - ec.gini) * 0.22 + s.basicProvision * 0.06 + Math.min(0.08, Math.max(0, ec.outputPerCapita - 1) * 0.03)
      - severeEnergyStress * 0.28 - c.food.shortage * 0.48 - c.waste.accumulation * 0.12 - c.housing.abandoned * 0.15,
      0.08, 0.90,
    );
    s.trust = clamp01(lerp(s.trust, trustTarget, 0.006 + severeEnergyStress * 0.012) - s.backlash * 0.002 * DT);
    // State collapse is nonlinear. Ordinary recessions/price spikes hurt; they do
    // not automatically turn every country into a failed state.
    const inequality = Math.max(0, c.economy.gini - 0.40) * 0.7;
    const stabTarget = clamp(0.48 + s.trust * 0.42 - s.backlash * 0.28 - inequality - Math.max(0, jobless - 0.11) * 0.9 - severeEnergyStress * 0.34 - c.food.shortage * 0.38 - c.housing.crowding * 0.10 - c.waste.accumulation * 0.08 - c.housing.abandoned * 0.12, 0.05, 0.96);
    s.stability = lerp(s.stability, stabTarget, 0.008 + severeEnergyStress * 0.018);
    // regulatory caution responds to backlash and accidents-of-record
    const regTarget = clamp(c.traits.regulatoryCaution + s.backlash * 0.35, 0.1, 0.95);
    s.regCaution = lerp(s.regCaution, regTarget, 0.01);
  }
}

// ── 7. DIPLOMACY & CONFLICT PRESSURE ────────────────────────────────────────

function stepDiplomacy(w: WorldState) {
  const aiGap = (a: CivId, b: CivId) =>
    w.techs.ai_models.adoption[a].intensity * w.techs.ai_models.cap - w.techs.ai_models.adoption[b].intensity * w.techs.ai_models.cap;
  for (const r of w.relations) {
    const ca = w.civs.find((c) => c.id === r.a)!;
    const cb = w.civs.find((c) => c.id === r.b)!;
    // rivalry: frontier AI gap + trade friction raise tension; collaboration lowers it
    const rivalry = Math.abs(aiGap(r.a, r.b)) * 0.05;
    const griev = r.grievances.length * 0.03;
    // resource competition: scarcity makes neighbors rivals, not partners
    const scarcity = energyHardship(ca) + energyHardship(cb) + (ca.food.shortage + cb.food.shortage) * 0.6;
    // food interdependence binds: importers court exporters (until they don't)
    const foodBind =
      Math.min(ca.food.importShare, Math.max(0, cb.food.selfSufficiency - 1)) +
      Math.min(cb.food.importShare, Math.max(0, ca.food.selfSufficiency - 1));
    const collabBonus = r.sciCollaboration * 0.1 + r.tradeOpenness * 0.05 + foodBind * 0.3;
    const target = clamp(0.1 + collabBonus - rivalry - griev - scarcity * 0.3, -1, 1);
    r.relation = lerp(r.relation, target, 0.008);
    // desperate, scarce states become dangerous: collapse of domestic order +
    // resource competition push tension toward open conflict
    r.tension = clamp01(r.tension + (rivalry * 1.5 + griev + scarcity * 0.55 - collabBonus * 0.4 + (1 - ca.society.stability) * 0.18 + (1 - cb.society.stability) * 0.18 - r.tension) * 0.01);
    // war: emerges only from high tension + hostility, never coin flips
    if (r.tension > 0.75 && r.relation < -0.35 && !w.flags[`war-${r.a}-${r.b}`] && chance(w.rng, 0.008)) {
      w.flags[`war-${r.a}-${r.b}`] = true;
      const weaker = ca.economy.output < cb.economy.output ? ca : cb;
      const stronger = weaker === ca ? cb : ca;
      // war is catastrophic: output collapse, capital destruction, lives lost,
      // infrastructure damaged — and the winner pays too
      weaker.economy.output *= 0.8;
      weaker.economy.capital *= 0.85;
      weaker.population.total *= 0.97;
      weaker.society.stability *= 0.55;
      weaker.society.trust *= 0.7;
      let largest: keyof typeof weaker.energy.sources = 'fossil';
      for (const k of Object.keys(weaker.energy.sources) as Array<keyof typeof weaker.energy.sources>) {
        if (weaker.energy.sources[k].cap > weaker.energy.sources[largest].cap) largest = k;
      }
      weaker.energy.sources[largest].cap *= 0.88; // strikes on energy infrastructure
      stronger.economy.output *= 0.94;
      stronger.society.stability *= 0.9;
      stronger.society.backlash = clamp01(stronger.society.backlash + 0.12);
      r.relation = -0.9;
      r.chipExportAllowed = false;
      r.grievances.push('war');
      addEvent(w, {
        title: `War breaks out between ${ca.name} and ${cb.name}`,
        body: `After years of rising tension — strategic rivalry, grievances and eroded trust — open conflict erupted. ${weaker.name}'s economy contracts sharply; trade and scientific ties collapse.`,
        category: 'conflict', significance: 3,
        causes: [
          { factor: 'sustained strategic tension', weight: 0.4 },
          { factor: 'accumulated grievances', weight: 0.25 },
          { factor: 'frontier technology rivalry', weight: 0.2 },
          { factor: 'domestic instability', weight: 0.15 },
        ],
        counterforces: [{ factor: 'economic interdependence', weight: 0.6 }],
        confidence: 'medium',
      });
    }
  }
}

// ── 8. ENVIRONMENT ──────────────────────────────────────────────────────────

function stepEnvironment(w: WorldState) {
  // warming ≈ linear vs cumulative emissions (IPCC); clean deployment bends it
  let fossilShare = 0, totalGen = 0;
  for (const c of w.civs) {
    const f = c.energy.sources.fossil.cap * CAPACITY_FACTOR.fossil;
    let g = f;
    for (const k of ['nuclear', 'solar', 'wind', 'hydro'] as const) g += c.energy.sources[k].cap * CAPACITY_FACTOR[k];
    fossilShare += f; totalGen += g;
  }
  const fossilFrac = totalGen > 0 ? fossilShare / totalGen : 0.5;
  // Emissions follow fossil extraction (electric and non-electric). Calibrated so
  // the 2026 draw ≈ +0.025°C/yr (≈2.4–2.6°C by 2100 under current policies, CAT).
  // With extraction near zero, natural sinks draw warming down very slowly.
  const extraction = w.resources.fossilExtractionRate * (0.6 + 0.4 * fossilFrac / Math.max(0.05, fossilFrac + 0.5));
  // Past ~3 °C the carbon cycle stops helping: permafrost, forest dieback, albedo loss.
  const feedback = Math.max(0, w.env.warmingC - 3) * 0.004 + Math.max(0, w.env.warmingC - 4.5) * 0.006;
  const warmingRate = (0.031 * extraction - 0.004 + feedback) * w.params.climateSensitivity; // °C/yr
  w.env.warmingC += warmingRate * DT;
  // Engineered climate control (sunshade, capture at scale) pulls the planet back toward a chosen setpoint.
  if (w.frontier.milestones.find((m) => m.id === 'climate_control')?.status === 'achieved') {
    // Climate intervention is an operated capability, not magic. Failed states
    // and energy-starved grids cannot maintain a planetary-scale intervention.
    const operatingCapacity = w.civs.reduce((a, c) => a + c.economy.institutionalCapacity * Math.max(0, c.energy.marginPct + 10) / 30, 0) / w.civs.length;
    const control = clamp(operatingCapacity, 0, 1);
    w.env.warmingC = lerp(w.env.warmingC, 1.2, 0.035 * control * DT);
  }

  // Sea level is a slow, path-dependent stock. Warming can be reversed in the
  // air faster than ocean heat content and land ice respond, so cooling NEVER
  // causes an instant sea-level fall. `committedSeaLevelM` is deliberately
  // monotonic on the centuries represented by this simulation.
  const newCommitment = Math.max(0, (w.env.warmingC - 1.05) * 0.82);
  w.env.committedSeaLevelM = Math.max(w.env.committedSeaLevelM, newCommitment, w.env.seaLevelM);
  const remainingSeaRise = Math.max(0, w.env.committedSeaLevelM - w.env.seaLevelM);
  const physicalRiseRate = 0.0035 + Math.max(0, w.env.warmingC - 1.3) * 0.003; // m/yr, stylized AR6-consistent near-term order of magnitude
  const lagLimitedRate = Math.min(physicalRiseRate, 0.001 + remainingSeaRise * 0.025);
  w.env.seaLevelM += Math.max(0, lagLimitedRate) * DT;

  w.env.pressure = clamp01((w.env.warmingC - 1.2) / 1.8);
  // Damage is convex in warming (IPCC AR6 / Burke et al.): mild at 1.5°C, serious
  // past 2.5°C. It hits output directly (heat, storms, adaptation spending) and
  // wears infrastructure faster; food yields are handled in stepFood. Rich,
  // educated societies adapt better; nothing adapts fully.
  for (const c of w.civs) {
    const adapt = clamp((1 - c.population.education * 0.25 - Math.min(0.3, Math.max(0, c.economy.outputPerCapita - 1) * 0.08)) / Math.max(0.5, w.params.climateAdaptation), 0.28, 1.25);
    const drag = Math.pow(w.env.pressure, 2) * 0.012 * adapt;
    c.economy.output *= 1 - drag * DT;
    const stormWear = w.env.pressure * 0.006 * DT;
    c.energy.gridCondition = clamp(c.energy.gridCondition - stormWear, 0.2, 1);
    c.housing.condition = clamp(c.housing.condition - stormWear * 0.6, 0.25, 1);
  }
  for (const [thr, key, title] of [[2.0, 'warming-2.0', 'Warming passes 2°C'], [2.5, 'warming-2.5', 'Warming passes 2.5°C'], [3.0, 'warming-3.0', 'Warming passes 3°C']] as Array<[number, string, string]>) {
    if (w.env.warmingC > thr && !w.flags[key]) {
      w.flags[key] = true;
      addEvent(w, {
        title,
        body: thr >= 3 ? 'Heat, storms and crop failures are now a permanent drag on every economy. Adaptation spending competes with everything else, including the programs that could reverse it.'
          : 'Storm damage, heat and water stress now show up in infrastructure wear, harvests and growth every year.',
        category: 'environment', significance: 3,
        causes: [{ factor: 'cumulative fossil extraction', weight: 0.7 }, { factor: 'slow displacement of fossil fuels', weight: 0.3 }],
        counterforces: [{ factor: 'fusion and orbital power replacing fossil fuels', weight: 0.5 }, { factor: 'direct air capture once energy is abundant', weight: 0.4 }], confidence: 'high',
      });
    }
  }
}

// ── 9. EMERGENT EVENTS — every entry arises from state, with causal metadata ─

function stepEvents(w: WorldState) {
  const t = w.techs;
  const autonomy = autonomyIndex(t.ai_agents.cap);

  // AI autonomy events. Once the benchmark reaches its validated measurement
  // ceiling we stop translating capability into fake months/years of autonomy.
  const aiCauses: CausalFactor[] = [
    { factor: 'sustained AI research effort', weight: 0.3 },
    { factor: 'compute supply expansion', weight: 0.25 },
    { factor: 'AI-assisted research tooling', weight: 0.25 },
    { factor: 'algorithmic efficiency gains', weight: 0.2 },
  ];
  const autonomyMilestones: Array<[number, string, string]> = [
    [1.35, 'AI autonomy reaches the benchmark ceiling', 'Frontier systems have moved beyond the range where the 2026 task suite can reliably convert capability into an hours-long horizon. From here the simulation tracks a dimensionless autonomy capability index instead of inventing calendar-duration claims.'],
    [3, 'AI systems coordinate complex multi-stage workflows', 'The model now treats long-horizon autonomy as a scenario-dependent capability, constrained by reliability, institutions, compute and real-world access rather than a benchmark-derived number of days.'],
    [8, 'AI autonomy becomes a general production input', 'Autonomous systems are mature enough to reshape planning, research and operations across sectors, but their reliability and diffusion still differ by civilization.'],
    [20, 'AI autonomy enters an unvalidated frontier regime', 'This is explicitly speculative territory. Capability continues to affect the model, but no empirical task-horizon claim is attached to it.'],
  ];
  for (const [threshold, title, body] of autonomyMilestones) {
    const key = `autonomy-${threshold}`;
    if (autonomy >= threshold && !w.flags[key]) {
      w.flags[key] = true;
      addEvent(w, { title, body, category: 'technology', techId: 'ai_agents', significance: threshold >= 8 ? 3 : 2, causes: aiCauses, counterforces: [{ factor: 'reliability on messy real-world tasks', weight: 0.7 }], confidence: threshold <= 1.35 ? 'high' : 'low' });
    }
  }

  // per-civ events
  for (const c of w.civs) {
    const e = c.energy;
    const key = (k: string) => `${k}-${c.id}`;

    // energy crisis: margin collapse with causal chain
    if (e.marginPct < 2 && !w.flags[key('grid-crisis')]) {
      w.flags[key('grid-crisis')] = true;
      addEvent(w, {
        title: `Electricity supply crisis in ${c.name}`,
        body: `Deliverable power fell to within ${e.marginPct.toFixed(1)}% of demand. Data-center construction stalls, electricity prices spike to ${e.priceIndex.toFixed(1)}× baseline, and industrial output is curtailed.`,
        category: 'energy', civId: c.id, significance: 3,
        causes: [
          { factor: 'compute-driven demand growth', weight: 0.35 },
          { factor: 'slow generation construction', weight: 0.3 },
          { factor: 'grid transmission limits', weight: 0.25 },
          { factor: 'capital/permitting constraints', weight: 0.1 },
        ],
        counterforces: [{ factor: 'demand curtailment & price response', weight: 0.5 }],
        confidence: 'high',
      });
    }
    // widespread blackouts: margin deeply negative — load shedding, real damage
    if (e.marginPct < -8 && !w.flags[key('blackouts')]) {
      w.flags[key('blackouts')] = true;
      addEvent(w, {
        title: `Blackouts spread across ${c.name}`,
        body: `Demand exceeds deliverable power by ${(-e.marginPct).toFixed(0)}%. Rolling blackouts shut factories, idle data centers and darkened cities. Output contracts, jobs vanish, and anger grows.`,
        category: 'energy', civId: c.id, significance: 3,
        causes: [
          { factor: 'demand outrunning generation build-out', weight: 0.4 },
          { factor: 'compute load growth', weight: 0.3 },
          { factor: 'grid transmission ceiling', weight: 0.2 },
          { factor: 'underinvestment', weight: 0.1 },
        ],
        counterforces: [{ factor: 'emergency construction & demand destruction', weight: 0.6 }],
        confidence: 'high',
      });
    }
    if (e.marginPct > 2 && w.flags[key('blackouts')]) {
      w.flags[key('blackouts')] = false;
      addEvent(w, {
        title: `Power restored in ${c.name}`,
        body: `Load shedding ended as new capacity came online and demand adapted. The margin recovered to ${e.marginPct.toFixed(0)}%.`,
        category: 'energy', civId: c.id, significance: 2,
        causes: [{ factor: 'generation & grid build-out', weight: 0.6 }, { factor: 'demand adaptation', weight: 0.4 }],
        counterforces: [], confidence: 'high',
      });
    }

    // recession: output materially below a year ago
    const mPrevYear = w.metrics.length >= 3 ? w.metrics[w.metrics.length - 3] : null;
    if (mPrevYear && c.economy.output < mPrevYear.output[c.id] * 0.94 && (energyHardship(c) > 0.15 || c.economy.unemployment > 0.075) && !w.flags[key('recession')]) {
      w.flags[key('recession')] = true;
      addEvent(w, {
        title: `${c.name} enters recession`,
        body: `Economic output has contracted ${((1 - c.economy.output / Math.max(0.01, mPrevYear.output[c.id])) * 100).toFixed(0)}% year over year. Unemployment is ${(c.economy.unemployment * 100).toFixed(0)}% and rising.`,
        category: 'economy', civId: c.id, significance: 3,
        causes: [
          { factor: 'energy scarcity', weight: energyHardship(c) > 0.2 ? 0.5 : 0.1 },
          { factor: 'automation displacement', weight: c.economy.displacedShare > 0.15 ? 0.35 : 0.1 },
          { factor: 'capital destruction', weight: 0.2 },
        ],
        counterforces: [{ factor: 'autonomous investment response', weight: 0.4 }],
        confidence: 'high',
      });
    }
    if (mPrevYear && c.economy.output > mPrevYear.output[c.id] * 1.005) w.flags[key('recession')] = false;

    // mass unrest: stability collapse
    if (c.society.stability < 0.35 && !w.flags[key('unrest')]) {
      w.flags[key('unrest')] = true;
      addEvent(w, {
        title: `Mass unrest in ${c.name}`,
        body: `Protests and strikes paralyze major cities. Trust in institutions is ${(c.society.trust * 100).toFixed(0)}%, backlash at ${(c.society.backlash * 100).toFixed(0)}%. The government's survival is in question.`,
        category: 'politics', civId: c.id, significance: 3,
        causes: [
          { factor: 'automation backlash', weight: c.society.backlash * 0.5 },
          { factor: 'energy hardship', weight: energyHardship(c) * 0.4 },
          { factor: 'unemployment', weight: Math.max(0, c.economy.unemployment - 0.06) * 2 },
        ],
        counterforces: [{ factor: 'policy response capacity', weight: 0.5 }],
        confidence: 'high',
      });
    }
    if (c.society.stability > 0.55 && w.flags[key('unrest')]) {
      w.flags[key('unrest')] = false;
      addEvent(w, {
        title: `Order returns to ${c.name}`,
        body: `After a period of mass unrest, stability recovered to ${(c.society.stability * 100).toFixed(0)}%.`,
        category: 'politics', civId: c.id, significance: 2,
        causes: [{ factor: 'improving material conditions', weight: 0.6 }, { factor: 'policy concessions', weight: 0.4 }],
        counterforces: [], confidence: 'medium',
      });
    }

    // crisis exodus: population shrinking under hardship
    if (mPrevYear && c.population.total < mPrevYear.population[c.id] * 0.985 && energyHardship(c) > 0.25 && !w.flags[key('exodus')]) {
      w.flags[key('exodus')] = true;
      addEvent(w, {
        title: `Exodus from ${c.name}`,
        body: `People are leaving and deaths outpace births: excess mortality from failing infrastructure plus emigration to more stable neighbors. Population down ${((1 - c.population.total / mPrevYear.population[c.id]) * 100).toFixed(1)}% in a year.`,
        category: 'society', civId: c.id, significance: 3,
        causes: [
          { factor: 'energy hardship & failing services', weight: 0.45 },
          { factor: 'emigration toward stability', weight: 0.35 },
          { factor: 'excess mortality', weight: 0.2 },
        ],
        counterforces: [{ factor: 'border controls & attachment to home', weight: 0.4 }],
        confidence: 'high',
      });
    }
    if (energyHardship(c) < 0.1) w.flags[key('exodus')] = false;

    // ── food events ──
    const f = c.food;
    if (f.shortage > 0.08 && !w.flags[key('food-crisis')]) {
      w.flags[key('food-crisis')] = true;
      const importCut = f.importShare < 0.05 && f.selfSufficiency < 1;
      addEvent(w, {
        title: `Food crisis in ${c.name}`,
        body: `${c.name} can only cover ${((f.selfSufficiency + f.importShare) * 100).toFixed(0)}% of food demand. Prices at ${f.priceIndex.toFixed(1)}× baseline. ${f.selfSufficiency < 0.9 ? 'Harvests are failing under climate stress' : 'Import supply lines have broken down'} — hunger is now a political force.`,
        category: 'society', civId: c.id, significance: 3,
        causes: [
          { factor: 'climate pressure on yields', weight: w.env.warmingC > 1.5 ? 0.35 : 0.1 },
          { factor: importCut ? 'import supply cut off' : 'domestic production gap', weight: 0.3 },
          { factor: 'energy hardship on farms & cold chains', weight: energyHardship(c) * 0.4 },
          { factor: 'population growth outpacing agriculture', weight: clamp(f.demandIndex - 1, 0, 0.5) * 0.5 },
        ],
        counterforces: [
          { factor: 'artificial food build-out', weight: f.artificialShare * 0.8 },
          { factor: 'imports from surplus neighbors', weight: f.importShare * 2 },
        ],
        confidence: 'high',
      });
    }
    if (f.shortage < 0.02 && w.flags[key('food-crisis')]) {
      w.flags[key('food-crisis')] = false;
      addEvent(w, {
        title: `Food supply stabilizes in ${c.name}`,
        body: `Food coverage recovered to ${((f.selfSufficiency + f.importShare) * 100).toFixed(0)}% of demand (${f.artificialShare > 0.15 ? `artificial food now provides ${(f.artificialShare * 100).toFixed(0)}%` : 'harvests and imports recovered'}). Prices easing to ${f.priceIndex.toFixed(1)}×.`,
        category: 'society', civId: c.id, significance: 2,
        causes: [
          { factor: f.artificialShare > 0.15 ? 'artificial food scale-up' : 'harvest recovery', weight: 0.5 },
          { factor: 'trade flows restored', weight: f.importShare * 2 },
        ],
        counterforces: [], confidence: 'high',
      });
    }
    if (f.artificialShare > 0.35 && !w.flags[key('artificial-food')]) {
      w.flags[key('artificial-food')] = true;
      addEvent(w, {
        title: `Artificial food goes mainstream in ${c.name}`,
        body: `Vertical farms and precision fermentation now supply ${(f.artificialShare * 100).toFixed(0)}% of calories. Food production is decoupling from weather and land — and moving onto the electricity grid.`,
        category: 'technology', civId: c.id, techId: 'biotech_med', significance: 2,
        causes: [
          { factor: 'biotech capability threshold crossed', weight: 0.4 },
          { factor: 'spare clean electricity', weight: 0.3 },
          { factor: 'food-security pressure', weight: clamp(1 - f.selfSufficiency, 0, 1) * 0.4 },
        ],
        counterforces: [{ factor: 'energy cost of indoor agriculture', weight: 0.6 }],
        confidence: 'medium',
      });
    }
    if (f.artificialShare > 0.4 && f.landUse < 0.78 && !w.flags[key('rewilding')]) {
      w.flags[key('rewilding')] = true;
      addEvent(w, {
        title: `Farmland rewilding begins in ${c.name}`,
        body: `As food production moves indoors, ${((1 - f.landUse) * 100).toFixed(0)}% of former farmland has been returned to grassland and forest — one of the largest land-use shifts in the region's history.`,
        category: 'environment', civId: c.id, significance: 2,
        causes: [{ factor: 'artificial food substitution', weight: 0.8 }, { factor: 'rising land yields', weight: 0.2 }],
        counterforces: [{ factor: 'cultural attachment to farming landscapes', weight: 0.4 }],
        confidence: 'medium',
      });
    }
    // breadbasket leverage: a surplus civ feeding a dependent neighbor gains sway
    if (f.selfSufficiency > 1.15 && !w.flags[key('breadbasket')]) {
      const dependents = w.civs.filter((o) => o.id !== c.id && o.food.importShare > 0.12);
      if (dependents.length > 0) {
        w.flags[key('breadbasket')] = true;
        addEvent(w, {
          title: `${c.name} becomes the region's breadbasket`,
          body: `${c.name}'s harvest surplus now feeds ${dependents.map((d) => d.name).join(' and ')}. Food has become diplomatic leverage — and a vulnerability if relations sour.`,
          category: 'economy', civId: c.id, significance: 2,
          causes: [{ factor: 'land endowment & yield growth', weight: 0.6 }, { factor: 'neighbor demand growth', weight: 0.4 }],
          counterforces: [{ factor: 'artificial food could erode this leverage', weight: 0.5 }],
          confidence: 'high',
        });
      }
    }

    // ── housing & waste events ──
    const hs = c.housing;
    if (hs.crowding > 0.25 && !w.flags[key('housing-crisis')]) {
      w.flags[key('housing-crisis')] = true;
      addEvent(w, {
        title: `Housing crisis in ${c.name}`,
        body: `Demand for living space outruns the housing stock by ${(hs.crowding * 100).toFixed(0)}%. Rents are ${hs.rentIndex.toFixed(1)}× the 2026 level; informal settlements spread at the city edges, and young families delay children.`,
        category: 'society', civId: c.id, significance: 2,
        causes: [
          { factor: 'population & urbanization pressure', weight: 0.45 },
          { factor: 'construction lag (capital, permits, energy)', weight: 0.35 },
          { factor: 'in-migration', weight: 0.2 },
        ],
        counterforces: [{ factor: 'construction response to high rents', weight: 0.5 }],
        confidence: 'high',
      });
    }
    if (hs.crowding < 0.08) w.flags[key('housing-crisis')] = false;
    const ws = c.waste;
    if (ws.accumulation > 0.5 && !w.flags[key('waste-crisis')]) {
      w.flags[key('waste-crisis')] = true;
      addEvent(w, {
        title: `Waste emergency in ${c.name}`,
        body: `Only ${(ws.managedShare * 100).toFixed(0)}% of waste is properly processed; the rest piles up in landfills and waterways. Respiratory illness clusters near dumps, and "deal with the piles" has become a political slogan.`,
        category: 'environment', civId: c.id, significance: 2,
        causes: [
          { factor: 'consumption growth outpacing waste infrastructure', weight: 0.5 },
          { factor: 'weak institutions / underinvestment', weight: 0.3 },
          { factor: 'energy shortage idling processing plants', weight: energyHardship(c) * 0.4 },
        ],
        counterforces: [{ factor: 'public pressure forces investment', weight: 0.6 }],
        confidence: 'high',
      });
    }
    if (ws.accumulation < 0.15 && w.flags[key('waste-crisis')]) {
      w.flags[key('waste-crisis')] = false;
      addEvent(w, {
        title: `${c.name} gets its waste under control`,
        body: `Recycling and processing now handle ${(ws.managedShare * 100).toFixed(0)}% of waste. The landfills are finally shrinking.`,
        category: 'environment', civId: c.id, significance: 1,
        causes: [{ factor: 'sustained waste-infrastructure investment', weight: 0.6 }, { factor: 'automation of sorting & recycling', weight: 0.4 }],
        counterforces: [], confidence: 'high',
      });
    }
    if (ws.managedShare > 0.85 && !w.flags[key('circular')]) {
      w.flags[key('circular')] = true;
      addEvent(w, {
        title: `Circular economy milestone in ${c.name}`,
        body: `${(ws.managedShare * 100).toFixed(0)}% of waste is now recovered or safely processed. Automated sorting and materials science turned garbage back into feedstock.`,
        category: 'technology', civId: c.id, significance: 2,
        causes: [{ factor: 'robotics & AI sorting at scale', weight: 0.5 }, { factor: 'decades of waste-infrastructure investment', weight: 0.5 }],
        counterforces: [{ factor: 'consumption keeps growing', weight: 0.5 }],
        confidence: 'medium',
      });
    }

    if (e.marginPct > 9 && w.flags[key('grid-crisis')] && !w.flags[key('grid-recovered')]) {
      w.flags[key('grid-recovered')] = true;
      addEvent(w, {
        title: `${c.name} emerges from its electricity crunch`,
        body: `New generation and transmission capacity finally came online. The supply margin recovered to ${e.marginPct.toFixed(0)}%.`,
        category: 'energy', civId: c.id, significance: 2,
        causes: [
          { factor: 'construction pipeline completion', weight: 0.5 },
          { factor: 'grid expansion', weight: 0.3 },
          { factor: 'demand response to prices', weight: 0.2 },
        ],
        counterforces: [{ factor: 'demand keeps growing', weight: 0.8 }],
        confidence: 'high',
      });
    }

    // robotics adoption acceleration
    const robotPen = t.robotics_ind.adoption[c.id].penetration;
    if (robotPen > 0.45 && !w.flags[key('robotics-boom')]) {
      w.flags[key('robotics-boom')] = true;
      addEvent(w, {
        title: `Robotics adoption accelerates in ${c.name}`,
        body: `Industrial robot penetration crossed 45%. Factories report easing labor shortages; maintenance and technician roles surge.`,
        category: 'technology', civId: c.id, techId: 'robotics_ind', significance: 2,
        causes: [
          { factor: 'manipulation reliability crossed industrial threshold', weight: 0.3 },
          { factor: 'unit costs fell on manufacturing scale', weight: 0.25 },
          { factor: 'AI planning improvements', weight: 0.25 },
          { factor: 'labor shortage pressure', weight: 0.2 },
        ],
        counterforces: [{ factor: 'maintenance costs and technician scarcity', weight: 0.6 }],
        confidence: 'medium',
      });
    }

    // automation backlash
    if (c.society.backlash > 0.62 && !w.flags[key('backlash')]) {
      w.flags[key('backlash')] = true;
      addEvent(w, {
        title: `Automation backlash erupts in ${c.name}`,
        body: `Protests against rapid automation spread through industrial districts. Politicians demand licensing, taxes on robots, and job guarantees.`,
        category: 'politics', civId: c.id, significance: 3,
        causes: [
          { factor: 'fast labor displacement', weight: 0.4 },
          { factor: 'rising inequality', weight: 0.25 },
          { factor: 'weak retraining uptake', weight: 0.2 },
          { factor: 'visible corporate profit concentration', weight: 0.15 },
        ],
        counterforces: [{ factor: 'productivity gains and lower prices', weight: 0.5 }],
        confidence: 'high',
      });
    }

    // EV majority
    if (t.transport_ev.adoption[c.id].penetration > 0.5 && !w.flags[key('ev-majority')]) {
      w.flags[key('ev-majority')] = true;
      addEvent(w, {
        title: `Electric vehicles dominate new sales in ${c.name}`,
        body: `EVs passed 50% penetration. Fuel demand has peaked; charging load is reshaping the evening grid.`,
        category: 'technology', civId: c.id, techId: 'transport_ev', significance: 1,
        causes: [
          { factor: 'battery cost decline', weight: 0.4 },
          { factor: 'charging infrastructure buildout', weight: 0.3 },
          { factor: 'total-cost parity with combustion', weight: 0.3 },
        ],
        counterforces: [{ factor: 'grid peak-load stress', weight: 0.4 }],
        confidence: 'high',
      });
    }

    // debt crisis
    if (c.economy.publicDebt > 1.6 && !w.flags[key('debt')]) {
      w.flags[key('debt')] = true;
      c.economy.capexAvailability *= 0.7;
      addEvent(w, {
        title: `Debt stress constrains ${c.name}`,
        body: `Public debt passed 160% of output. Financing costs rise; infrastructure and research budgets face pressure.`,
        category: 'economy', civId: c.id, significance: 2,
        causes: [
          { factor: 'sustained social spending under weak growth', weight: 0.5 },
          { factor: 'unemployment-driven revenue loss', weight: 0.3 },
          { factor: 'earlier crisis borrowing', weight: 0.2 },
        ],
        counterforces: [{ factor: 'productivity growth raises revenue', weight: 0.6 }],
        confidence: 'medium',
      });
    }
  }

  // biotech breakthrough: capability crossing with adoption lag
  if (t.biotech_med.cap > 2.2 && !w.flags['biotech-wave']) {
    w.flags['biotech-wave'] = true;
    addEvent(w, {
      title: 'Biotechnology research enters rapid acceleration',
      body: `AI-guided discovery and automated laboratories have compressed early drug-discovery timelines. Clinical validation remains the long pole — therapies take years to reach patients.`,
      category: 'science', techId: 'biotech_med', significance: 2,
      causes: [
        { factor: 'AI-guided molecular design', weight: 0.4 },
        { factor: 'automated laboratory throughput', weight: 0.3 },
        { factor: 'compute availability', weight: 0.2 },
        { factor: 'accumulated biological data', weight: 0.1 },
      ],
      counterforces: [{ factor: 'clinical validation time and regulation', weight: 0.9 }],
      confidence: 'medium',
    });
  }

  // sustained 1.5°C
  if (w.env.warmingC > 1.5 && !w.flags['warming-1.5']) {
    w.flags['warming-1.5'] = true;
    addEvent(w, {
      title: 'Sustained warming crosses 1.5°C',
      body: `The world has crossed the Paris threshold on a sustained basis. Heat stress, water pressure and adaptation costs are now structural features of the economy.`,
      category: 'environment', significance: 3,
      causes: [
        { factor: 'cumulative fossil generation', weight: 0.6 },
        { factor: 'slow clean-energy displacement of incumbents', weight: 0.4 },
      ],
      counterforces: [{ factor: 'accelerating clean deployment', weight: 0.7 }],
      confidence: 'high',
    });
  }
}

// ── 9b. RESOURCE & FRONTIER EVENTS ──────────────────────────────────────────

function stepResourceEvents(w: WorldState) {
  const r = w.resources;
  const once = (key: string, cond: boolean, make: () => Omit<ChronicleEvent, 'id' | 'tMonths' | 'year'>) => {
    if (cond && !w.flags[key]) { w.flags[key] = true; addEvent(w, make()); }
  };
  once('fossil-cheap-era-ends', r.fossilCostIndex > 1.6, () => ({
    title: 'The cheap fossil era ends',
    body: `Fuel costs have reached ${r.fossilCostIndex.toFixed(1)}× the 2026 level as the easy reserves deplete (${Math.max(0, r.fossilReserves).toFixed(0)} years of cheap supply left at current draw). Thermal plants run less, electricity from them costs more, and every unbuilt clean gigawatt is now a bargain by comparison.`,
    category: 'resources', significance: 3,
    causes: [{ factor: 'cumulative extraction of cheap reserves', weight: 0.6 }, { factor: 'continued non-electric fossil demand', weight: 0.4 }],
    counterforces: [{ factor: 'electrification and efficiency', weight: 0.5 }, { factor: 'expensive tail reserves', weight: 0.3 }], confidence: 'medium',
  }));
  once('fossil-exhausted', r.fossilReserves + CALIBRATION.resources.fossilTailYears * w.params.resourceAbundance <= 1, () => ({
    title: 'Fossil reserves effectively exhausted',
    body: 'What remains costs more energy to extract than it yields. Whatever is not electrified now runs on synthetic fuels made from electricity, or does not run.',
    category: 'resources', significance: 3,
    causes: [{ factor: 'finite reserves', weight: 1 }], counterforces: [], confidence: 'high',
  }));
  once('mineral-crunch', r.mineralCostIndex > 1.5, () => ({
    title: 'Critical-mineral crunch',
    body: `Copper, lithium, nickel and rare-earth prices are ${r.mineralCostIndex.toFixed(1)}× the 2026 level. Clean energy, storage, data centers and robots all get dearer; projects slip. Recycling covers ${(r.recyclingRate * 100).toFixed(0)}% of demand${r.mineralSpaceInflow > 0.01 ? `, off-world supply ${(r.mineralSpaceInflow * 100).toFixed(0)}%` : ''}.`,
    category: 'resources', significance: 3,
    causes: [{ factor: 'clean-energy and compute build-out demand', weight: 0.5 }, { factor: 'depletion of high-grade ores', weight: 0.35 }, { factor: 'mine lead times of 10–15 years', weight: 0.15 }],
    counterforces: [{ factor: 'recycling and substitution', weight: 0.5 }, { factor: 'asteroid mining', weight: 0.3 }], confidence: 'medium',
  }));
  once('mineral-relief', w.flags['mineral-crunch'] && r.mineralCostIndex < 1.15, () => ({
    title: 'Mineral prices normalize',
    body: `Recycling now returns ${(r.recyclingRate * 100).toFixed(0)}% of demand${r.mineralSpaceInflow > 0.05 ? ` and off-world mining supplies ${(r.mineralSpaceInflow * 100).toFixed(0)}%` : ''}. Earth mining and its land and water footprint contract.`,
    category: 'resources', significance: 2,
    causes: [{ factor: 'circular materials economy', weight: 0.6 }, { factor: 'off-world supply', weight: 0.4 }], counterforces: [], confidence: 'high',
  }));
  once('circular-half', r.recyclingRate > 0.5, () => ({
    title: 'Recycling covers half of mineral demand',
    body: 'Automated sorting, urban mining and design-for-disassembly mean most of the metal in a new device came out of an old one.',
    category: 'resources', significance: 2,
    causes: [{ factor: 'robotic sorting and AI materials tracing', weight: 0.5 }, { factor: 'price pressure from scarcity', weight: 0.5 }], counterforces: [], confidence: 'medium',
  }));
  const off = w.frontier.offworldPopulationM;
  once('offworld-100k', off >= 0.1, () => ({
    title: '100,000 people live off Earth',
    body: 'Rotating habitats and the Mars settlement are now permanent communities with schools, clinics and their own politics.',
    category: 'frontier', significance: 3,
    causes: [{ factor: 'cheap launch', weight: 0.5 }, { factor: 'closed-loop life support', weight: 0.5 }], counterforces: [{ factor: 'radiation, isolation, cost', weight: 0.5 }], confidence: 'medium',
  }));
  once('offworld-10m', off >= 10, () => ({
    title: 'Ten million people live off Earth',
    body: 'Off-world populations are now a demographic force of their own, with their own birth rates, industries and demands.',
    category: 'frontier', significance: 3,
    causes: [{ factor: 'habitat construction at scale', weight: 0.6 }, { factor: 'Earth-side land and housing pressure', weight: 0.4 }], counterforces: [], confidence: 'medium',
  }));
  const dig = w.frontier.digitalPopulationM;
  once('digital-1m', dig >= 1, () => ({
    title: 'A million minds run on substrate',
    body: 'Uploaded and substrate-native people now number over a million. They need electricity and compute rather than food and housing, and they vote.',
    category: 'frontier', significance: 3,
    causes: [{ factor: 'validated whole-brain emulation', weight: 0.6 }, { factor: 'spare compute capacity', weight: 0.4 }], counterforces: [{ factor: 'cultural and legal resistance', weight: 0.5 }], confidence: 'low',
  }));
  for (const c of w.civs) {
    const key = `derelict-${c.id}`;
    once(key, c.housing.abandoned > 0.18, () => ({
      title: `Streets go dark in ${c.name}`,
      body: `${(c.housing.abandoned * 100).toFixed(0)}% of the housing stock is derelict: population ${c.population.total < c.population.peakPhysical * 0.95 ? 'has fallen' : 'has moved'} and nobody maintains what nobody lives in. Grid, roads and services built for a larger city are now a burden on those who stayed.`,
      category: 'society', civId: c.id, significance: 2,
      causes: [{ factor: 'population decline', weight: 0.5 }, { factor: 'vacancy without demolition', weight: 0.3 }, { factor: 'weak institutions', weight: 0.2 }],
      counterforces: [{ factor: 'consolidation and demolition programs', weight: 0.5 }], confidence: 'high',
    }));
    if (c.housing.abandoned < 0.06 && w.flags[key]) {
      w.flags[key] = false;
      addEvent(w, {
        title: `${c.name} consolidates its shrinking cities`,
        body: `Derelict districts were cleared or renovated; the housing stock now matches the people who live there.`,
        category: 'society', civId: c.id, significance: 1,
        causes: [{ factor: 'demolition and renovation programs', weight: 0.7 }, { factor: 'renewed demand', weight: 0.3 }], counterforces: [], confidence: 'high',
      });
    }
    const leKey = `le-100-${c.id}`;
    once(leKey, c.population.lifeExpectancy >= 100, () => ({
      title: `Life expectancy passes 100 in ${c.name}`,
      body: `Longevity therapies reach ${(w.techs.longevity_bio.adoption[c.id].penetration * 100).toFixed(0)}% of the population. Working lives lengthen, the age pyramid inverts more slowly, and pensions are being rewritten.`,
      category: 'science', civId: c.id, techId: 'longevity_bio', significance: 3,
      causes: [{ factor: 'validated longevity therapies', weight: 0.6 }, { factor: 'broad access', weight: 0.4 }], counterforces: [{ factor: 'cost and unequal access', weight: 0.4 }], confidence: 'low',
    }));
  }
}

// ── 10. CHARACTERS — persistent people with causal attitudes ────────────────

function stepCharacters(w: WorldState) {
  const yearly = w.tMonths % 12 === 0;
  for (const ch of w.characters) {
    const c = w.civs.find((x) => x.id === ch.civId)!;
    if (ch.active === false) continue;
    ch.age += DT;
    const le = c.population.lifeExpectancy;
    const retireAge = Math.max(62, le - 16);
    if (yearly && ch.age >= retireAge && ch.retiredAt == null) {
      const retireChance = clamp(0.08 + (ch.age - retireAge) * 0.018, 0.08, 0.55);
      if (chance(w.rng, retireChance)) {
        ch.retiredAt = w.tMonths;
        ch.prominence *= 0.62;
        if (!ch.role.startsWith('Retired ')) ch.role = `Retired ${ch.role}`;
        ch.history.push({ tMonths: w.tMonths, text: `${Math.floor(yearOf(w))} — retired from active leadership but remained part of the historical record.` });
      }
    }
    const frailAge = Math.max(70, le - 4);
    if (yearly && ch.age >= frailAge) {
      const mortality = clamp(0.025 + (ch.age - frailAge) * 0.018 * (79 / Math.max(45, le)), 0.02, 0.65);
      if (chance(w.rng, mortality)) {
        ch.diedAt = w.tMonths;
        ch.active = false;
        ch.prominence = 0;
        ch.history.push({ tMonths: w.tMonths, text: `${Math.floor(yearOf(w))} — died at age ${Math.round(ch.age)}. Their earlier actions remain part of the world history.` });
        ch.role = 'Historical figure';
        addEvent(w, {
          title: `${ch.name} dies at age ${Math.round(ch.age)}`,
          body: `${ch.name}'s active role in ${c.name} ends, but their decisions and discoveries remain in the Chronicle and continue to shape later events.`,
          category: 'character', civId: c.id, significance: ch.history.length > 3 ? 2 : 1,
          causes: [{ factor: 'character lifecycle', weight: 1 }], counterforces: [], confidence: 'high',
        });
        continue;
      }
    }
    // mood from lived conditions in their civilization
    ch.mood = clamp(
      0.3 * (1 - c.economy.unemployment * 4) + 0.3 * (1.4 - c.energy.priceIndex) + 0.4 * c.society.trust - 0.5 - c.food.shortage * 0.6 - c.housing.crowding * 0.2 - Math.min(0.3, c.waste.accumulation * 0.2),
      -1, 1,
    );
    // prominence rises when their domain is in the news
    const domainHot =
      (ch.id === 'elena_voss' && c.energy.constrained) ||
      (ch.id === 'kael_morrow' && w.techs.ai_models.lastGrowthRate > 0.5) ||
      (ch.id === 'dasha_iren' && w.techs.semiconductor_fab.lastGrowthRate > 0.1) ||
      (ch.id === 'tomas_fenn' && c.society.backlash > 0.4) ||
      (ch.id === 'amara_sol' && c.economy.output > 0.75) ||
      (ch.id === 'rio_kade' && w.techs.robotics_gp.adoption[c.id].penetration > 0.1);
    ch.prominence = clamp01(ch.prominence + (domainHot ? 0.01 : -0.003));
    if (yearly && ch.history.length < 40 && nextFloat(w.rng) < 0.25) {
      const y = Math.floor(yearOf(w));
      if (ch.id === 'elena_voss' && c.energy.marginPct < 5) {
        ch.history.push({ tMonths: w.tMonths, text: `${y} — fought to keep the grid stable as data-center load requests piled up.` });
        ch.beliefs = ['Electrification cannot wait for perfect planning', 'Compute demand is now a grid-planning variable'];
        ch.concern = 'Interconnection queues are measured in years while AI load doubles in months';
      } else if (ch.id === 'tomas_fenn' && c.society.backlash > 0.5) {
        ch.history.push({ tMonths: w.tMonths, text: `${y} — led strikes in automated plants as displacement outpaced retraining.` });
        ch.concern = 'Workers are being automated faster than society absorbs them';
      } else if (ch.id === 'kael_morrow' && w.techs.ai_agents.lastGrowthRate > 0.4) {
        ch.history.push({ tMonths: w.tMonths, text: `${y} — published evaluations showing autonomous capability improving faster than assurance practices.` });
        ch.concern = 'Whether reliability research can keep pace with capability';
      }
    }
  }
}

// ── 11. METRICS & MILESTONE SUMMARIES ───────────────────────────────────────

function recordMetrics(w: WorldState) {
  if (w.tMonths % 6 !== 0) return; // every 6 months
  const t = w.techs;
  const rec: Record<CivId, number> = { veloria: 0, ardan: 0, nemea: 0 };
  const grab = (fn: (c: (typeof w.civs)[0]) => number) => {
    for (const c of w.civs) rec[c.id] = fn(c);
    return { ...rec };
  };
  w.metrics.push({
    tMonths: w.tMonths,
    year: yearOf(w),
    aiCap: t.ai_models.cap,
    taskHorizonHrs: taskHorizonHrs(t.ai_agents.cap),
    roboticsIndPen: CIV_IDS.reduce((a, id) => a + t.robotics_ind.adoption[id].penetration, 0) / 3,
    evPen: CIV_IDS.reduce((a, id) => a + t.transport_ev.adoption[id].penetration, 0) / 3,
    biotechCap: t.biotech_med.cap,
    computeSupply: w.civs.reduce((a, c) => a + c.compute.supplyFlops, 0),
    output: grab((c) => c.economy.output),
    unemployment: grab((c) => c.economy.unemployment),
    energyMargin: grab((c) => c.energy.marginPct),
    energyPrice: grab((c) => c.energy.priceIndex),
    gini: grab((c) => c.economy.gini),
    stability: grab((c) => c.society.stability),
    population: grab((c) => c.population.total),
    foodSecurity: grab((c) => c.food.selfSufficiency + c.food.importShare),
    researchVel: grab((c) =>
      TECH_IDS.reduce((a, id) => a + c.researchAlloc[id] * w.techs[id].lastGrowthRate, 0) * 100,
    ),
    kardashev: w.frontier.kardashev,
    offworldPop: w.frontier.offworldPopulationM,
    mineralCost: w.resources.mineralCostIndex,
    fossilReserves: w.resources.fossilReserves,
    lifeExpectancy: grab((c) => c.population.lifeExpectancy),
    landPressure: grab((c) => c.land.pressure),
    readiness: grab((c) => c.frontierReadiness),
  });
  if (w.metrics.length > 800) w.metrics.splice(0, w.metrics.length - 800);

  // 5-year world-state milestone summary
  if (w.tMonths > 0 && w.tMonths % 60 === 0) {
    const y = Math.floor(yearOf(w));
    const totPop = w.civs.reduce((a, c) => a + c.population.total, 0);
    const totDemand = w.civs.reduce((a, c) => a + c.energy.demandTWh, 0);
    const bottlenecks = TECH_IDS.map((id) => w.techs[id].bottleneck).filter((b) => b && b !== 'none — demand & diffusion');
    addEvent(w, {
      title: `World state — ${y}`,
      body: `Population ${totPop.toFixed(0)}M (${w.frontier.offworldPopulationM >= 0.01 ? `${w.frontier.offworldPopulationM.toFixed(2)}M off Earth · ` : ''}life expectancy ${(w.civs.reduce((a, c) => a + c.population.lifeExpectancy, 0) / 3).toFixed(0)}) · electricity demand ${totDemand.toFixed(0)} TWh/yr · Kardashev ${w.frontier.kardashev.toFixed(2)} · AI capability ${t.ai_models.cap.toFixed(1)}× (measured agent benchmark ${fmtHorizon(taskHorizonHrs(t.ai_agents.cap))}) · fossil reserves ${Math.max(0, w.resources.fossilReserves).toFixed(0)} yr · mineral cost ${w.resources.mineralCostIndex.toFixed(2)}× · warming ${w.env.warmingC.toFixed(2)}°C. Trajectory: ${w.frontier.trajectory.replace('_', ' ')}. Active bottlenecks: ${[...new Set(bottlenecks)].slice(0, 3).join(', ') || 'none critical'}.`,
      category: 'milestone', significance: 1,
      causes: [], counterforces: [], confidence: 'high',
    });
  }
}

export function fmtHorizon(hrs: number): string {
  if (hrs >= 15.99) return '≥16 hours (measurement ceiling)';
  if (hrs < 48) return `${hrs.toFixed(0)} hours`;
  if (hrs < 720) return `${(hrs / 24).toFixed(0)} days`;
  if (hrs < 8760) return `${(hrs / 720).toFixed(1)} months`;
  return `${(hrs / 8760).toFixed(1)} years`;
}

// ── ORCHESTRATOR ────────────────────────────────────────────────────────────

function decayInterventions(w: WorldState) {
  for (const iv of w.activeInterventions) iv.monthsLeft -= 1;
  const expired = w.activeInterventions.filter((iv) => iv.monthsLeft <= 0);
  w.activeInterventions = w.activeInterventions.filter(
    (iv) => iv.monthsLeft > 0 || iv.effects.some((e) => e.kind === 'build' || e.kind === 'relation' || e.kind === 'society'),
  );
  // delayed completions fire on expiry
  for (const iv of expired) {
    for (const ef of iv.effects) {
      if (ef.kind === 'fab_complete') {
        w.techs.semiconductor_fab.mfg *= 1.18;
        const civ = w.civs.find((c) => c.id === ef.civId);
        if (civ) civ.economy.capital *= 1.03;
        addEvent(w, {
          title: `New leading-edge fab enters production in ${civ?.name ?? ef.civId}`,
          body: 'Four years after commitment, the new fabrication facility ramps toward volume production. Global accelerator supply expands.',
          category: 'technology', civId: ef.civId, techId: 'semiconductor_fab', significance: 2,
          causes: [{ factor: 'targeted industrial subsidy', weight: 0.6 }, { factor: 'construction pipeline completion', weight: 0.4 }],
          counterforces: [{ factor: 'yield ramp and workforce ramp take additional years', weight: 0.7 }],
          confidence: 'high',
        });
      }
    }
  }
  w.observerBudget = Math.min(100, w.observerBudget + 6 / 12);
}

function literalWorldPopulation(w: WorldState): number {
  return w.civs.reduce((sum, c) => sum + (Number.isFinite(c.population.total) ? Math.max(0, c.population.total) : 0), 0);
}

function finite(v: number, fallback = 0): number { return Number.isFinite(v) ? v : fallback; }

/**
 * Physics/ecology after literal extinction. Time keeps moving, but civilization
 * does not. No research, projects, diplomacy, negotiations, characters, staffed
 * launches or milestone generation is allowed here. Physical structures remain
 * and lose serviceability while ecological succession continues.
 */
function stepPostCivilization(w: WorldState) {
  w.pendingDecisions = [];
  w.pendingConflict = [];
  w.conflicts = [];
  w.pendingPandemic = false;
  w.pendingAiIncident = false;
  w.pandemic = null;
  w.projects = [];
  w.activeInterventions = [];
  for (const r of w.researchPrograms) if (r.status === 'active' || r.status === 'validation' || r.status === 'breakthrough') r.status = 'cancelled';
  for (const ch of w.characters) ch.active = false;

  // Fossil extraction ends with the extracting civilization. Atmospheric and
  // ocean stocks retain inertia; sea-level commitment never snaps backward.
  w.resources.fossilExtractionRate = Math.max(0, finite(w.resources.fossilExtractionRate) * 0.94);
  const feedback = Math.max(0, finite(w.env.warmingC, 1.2) - 3) * 0.004 + Math.max(0, finite(w.env.warmingC, 1.2) - 4.5) * 0.006;
  const naturalWarmingRate = (-0.004 + feedback) * finite(w.params.climateSensitivity, 1);
  w.env.warmingC = Math.max(0, finite(w.env.warmingC, 1.2) + naturalWarmingRate * DT);
  w.env.committedSeaLevelM = Math.max(finite(w.env.committedSeaLevelM), finite(w.env.seaLevelM), Math.max(0, (w.env.warmingC - 1.05) * 0.82));
  const remainingSeaRise = Math.max(0, w.env.committedSeaLevelM - finite(w.env.seaLevelM));
  const physicalRiseRate = 0.0035 + Math.max(0, w.env.warmingC - 1.3) * 0.003;
  const lagLimitedRate = Math.min(physicalRiseRate, 0.001 + remainingSeaRise * 0.025);
  w.env.seaLevelM = Math.max(0, finite(w.env.seaLevelM) + Math.max(0, lagLimitedRate) * DT);
  w.env.pressure = clamp01((w.env.warmingC - 1.2) / 1.8);

  for (const c of w.civs) {
    // Population/accounting is exact and absorbing.
    c.population.total = 0;
    c.population.offworld = 0;
    c.population.digitalShare = 0;
    c.space.marsPopulationM = 0;
    c.space.interstellarM = 0;
    c.society.polityStatus = 'abandoned';
    c.society.stability = 0;
    c.society.trust = 0;
    c.society.backlash = 0;
    c.society.syntheticBirthsPerYear = 0;

    c.economy.output = 0; c.economy.outputPerCapita = 0; c.economy.laborForce = 0; c.economy.unemployment = 0;
    c.economy.capexAvailability = 0; c.researchCapacity = 0; c.frontierReadiness = 0;
    c.compute.demandFlops = 0;
    c.energy.demandTWh = 0; c.energy.servedTWh = 0; c.energy.unservedTWh = 0; c.energy.marginPct = 0;
    c.energy.criticalServedRatio = 0; c.energy.industryServedRatio = 0; c.energy.computeServedRatio = 0;
    c.energy.gridCondition = Math.max(0.02, finite(c.energy.gridCondition, 0.5) * 0.996);
    c.housing.vacancy = 1;
    c.housing.abandoned = lerp(finite(c.housing.abandoned), 0.97, 0.004);
    c.housing.condition = Math.max(0.04, finite(c.housing.condition, 0.5) * 0.9975);
    // Stock is archaeological material, not usable housing. Do not shrink it to
    // visualize decay; serviceability and ruin geometry carry the decay instead.
    c.land.floatingCondition = Math.max(0.01, finite(c.land.floatingCondition, 1) * 0.992);
    c.land.subseaCondition = Math.max(0.01, finite(c.land.subseaCondition, 1) * 0.989);
    c.land.verticalCondition = Math.max(0.03, finite(c.land.verticalCondition, 1) * 0.997);
    c.land.undergroundCondition = Math.max(0.03, finite(c.land.undergroundCondition, 1) * 0.996);
    c.land.reclaimedCondition = Math.max(0.01, finite(c.land.reclaimedCondition, 1) * 0.994);
    c.land.wildReclaimed = lerp(finite(c.land.wildReclaimed), 1, 0.0035);
    c.land.brownfield = lerp(finite(c.land.brownfield), 1, 0.0025);
  }

  w.frontier.offworldPopulationM = 0;
  w.frontier.digitalPopulationM = 0;
  w.frontier.trajectory = 'extinction';
  w.frontier.trajectoryNote = 'No embodied, off-world or digital population remains. Only physical and ecological processes continue.';
  w.frontier.outcome = { materialSecurity: 0, humanDevelopment: 0, institutionalHealth: 0, ecologicalSafety: finite(w.frontier.outcome.ecologicalSafety), distribution: 0, resilience: 0, broadFlourishing: 0 };
  w.observerBudget = Math.min(100, finite(w.observerBudget));
  recordMetrics(w);
}

export function stepWorld(w: WorldState, months = 1) {
  for (let i = 0; i < months; i++) {
    w.tMonths += 1;

    // Extinction is an absorbing civilization state, not an excuse for ghost
    // diplomacy/research. Once it has been recorded, only nature/physics runs.
    if (w.flags['world-extinct'] || literalWorldPopulation(w) <= 1e-6) {
      if (!w.flags['world-extinct']) {
        w.flags['world-extinct'] = true;
        addEvent(w, { title: 'The last population disappears', body: 'There are no people or surviving digital minds left in the simulated civilization. Cities stand dark; infrastructure and coastlines keep changing, but civilization no longer generates decisions, negotiations or milestones.', category: 'milestone', significance: 3, causes: [{ factor: 'complete population loss', weight: 1 }], counterforces: [], confidence: 'high' });
      }
      stepPostCivilization(w);
      continue;
    }

    stepCivilizationPlanning(w);
    stepProjects(w);
    stepTechnology(w);
    stepResearchPrograms(w);
    stepResources(w);
    stepEnergy(w);
    stepCompute(w);
    stepFood(w);
    stepUrban(w);
    stepLand(w);
    stepEconomy(w);
    stepPopulation(w);
    stepSociety(w);
    stepDiplomacy(w);
    stepEnvironment(w);
    // Population can hit literal zero in stepPopulation. Do not let the later
    // frontier/event pipeline invent one last research or diplomatic act by a
    // population that is already gone.
    if (literalWorldPopulation(w) <= 1e-6) {
      w.flags['world-extinct'] = true;
      addEvent(w, { title: 'The last population disappears', body: 'There are no people or surviving digital minds left in the simulated civilization. Cities stand dark; infrastructure and coastlines keep changing, but civilization no longer generates decisions, negotiations or milestones.', category: 'milestone', significance: 3, causes: [{ factor: 'complete population loss', weight: 1 }], counterforces: [], confidence: 'high' });
      stepPostCivilization(w);
      continue;
    }
    stepFrontier(w);

    // stepFrontier can discover literal extinction this month. From that instant
    // onward, do not manufacture any more civilization activity in this tick.
    if (w.flags['world-extinct'] || literalWorldPopulation(w) <= 1e-6) {
      stepPostCivilization(w);
      continue;
    }

    stepEvents(w);
    stepResourceEvents(w);
    stepSocietyDynamics(w);
    reconcileFrontierPopulation(w);
    stepDecisions(w);
    stepCharacters(w);
    recordMetrics(w);
    decayInterventions(w);
  }
}
