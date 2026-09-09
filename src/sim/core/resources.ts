// ─────────────────────────────────────────────────────────────────────────────
// FINITE RESOURCES — the world has a fixed stock of cheap fossil fuel and of
// the critical minerals (copper, lithium, nickel, rare earths) that every
// solar panel, battery, motor, transformer and data center is built from.
// Drawing them down raises the cost of everything built afterwards. The only
// exits are efficiency, recycling, substitution and, eventually, material from
// off Earth. None of them is free.
// ─────────────────────────────────────────────────────────────────────────────
import type { WorldState, ProjectKind } from '../types';
import { CIV_IDS } from '../types';
import { CALIBRATION } from '../data/calibration';
import { CAPACITY_FACTOR } from './world';
import { clamp, lerp } from './formulas';

const DT = 1 / 12;

// 2026 region fossil generation, computed once per world (cached on first call).
const fossilBase = new WeakMap<WorldState, number>();
const activityBase = new WeakMap<WorldState, number>();

function initialFossilTWh(w: WorldState): number {
  let v = fossilBase.get(w);
  if (v == null) {
    v = w.civs.reduce((a, c) => a + c.energy.sources.fossil.cap * CAPACITY_FACTOR.fossil * 8.76, 0);
    fossilBase.set(w, Math.max(1, v));
  }
  return v;
}
function initialActivity(w: WorldState): number {
  let v = activityBase.get(w);
  if (v == null) {
    v = w.civs.reduce((a, c) => a + c.economy.output, 0);
    activityBase.set(w, Math.max(0.1, v));
  }
  return v;
}

/** Annual GW of clean/compute capacity currently being built (from live projects). */
function buildRatesGWperYear(w: WorldState): { clean: number; compute: number; housing: number } {
  let clean = 0, compute = 0, housing = 0;
  for (const p of w.projects) {
    if (p.status === 'operational' || p.status === 'cancelled') continue;
    const perYear = p.capacity / Math.max(0.5, p.totalMonths / 12);
    const k: ProjectKind = p.kind;
    if (k === 'solar' || k === 'wind' || k === 'geothermal' || k === 'bioenergy' || k === 'ocean_energy' || k === 'storage' || k === 'hydrogen_hub' || k === 'grid' || k === 'nuclear' || k === 'fusion' || k === 'power_satellite') clean += perYear * (k === 'storage' || k === 'hydrogen_hub' ? 3 : k === 'grid' ? 0.35 : 1);
    else if (k === 'datacenter' || k === 'fab') compute += perYear * (k === 'fab' ? 4 : 1);
    else if (k === 'housing' || k === 'arcology' || k === 'underground_habitat' || k === 'floating_district' || k === 'subsea_habitat') housing += perYear * 40;
  }
  return { clean, compute, housing };
}

export function stepResources(w: WorldState) {
  const r = w.resources;
  const cal = CALIBRATION.resources;
  const civs = w.civs;

  // ── fossil ───────────────────────────────────────────────────────────────
  const fossilGen = civs.reduce((a, c) => a + c.energy.sources.fossil.cap * c.energy.sources.fossil.condition * CAPACITY_FACTOR.fossil * 8.76, 0);
  const electricShare = fossilGen / initialFossilTWh(w);
  const activity = civs.reduce((a, c) => a + c.economy.output, 0) / initialActivity(w);
  const meanEv = CIV_IDS.reduce((a, id) => a + w.techs.transport_ev.adoption[id].penetration, 0) / 3;
  const meanH2Transport = civs.reduce((a, c) => a + c.energy.hydrogen.transportShare, 0) / civs.length;
  const meanH2Industry = civs.reduce((a, c) => a + c.energy.hydrogen.industryShare, 0) / civs.length;
  const meanBio = CIV_IDS.reduce((a, id) => a + w.techs.bioenergy_systems.adoption[id].penetration, 0) / 3;
  const meanRobots = CIV_IDS.reduce((a, id) => a + w.techs.robotics_ind.adoption[id].intensity, 0) / 3;
  const meanIntensity = civs.reduce((a, c) => a + c.economy.energyIntensityIndex, 0) / civs.length;
  // Non-electric fossil use (transport, heat, industry) electrifies slowly and
  // decouples from output as intensity falls. It never electrifies completely.
  const nonElectric = Math.pow(activity, 0.55) * meanIntensity
    * (1 - meanEv * 0.45)
    * (1 - meanH2Transport * 0.22)
    * (1 - meanH2Industry * 0.20)
    * (1 - meanBio * 0.18)
    * (1 - meanRobots * 0.15)
    * (1 - Math.min(0.35, (w.techs.grid_transmission.cap - 1) * 0.1));
  const fuelAvailability = clamp(1.7 - r.fossilCostIndex * 0.35, 0.15, 1);
  r.fossilExtractionRate = clamp((0.45 * electricShare + 0.55 * nonElectric) * fuelAvailability, 0.02, 4);
  r.fossilReserves -= r.fossilExtractionRate * DT;
  const totalFossil = cal.fossilReserveYears * w.params.resourceAbundance + cal.fossilTailYears * w.params.resourceAbundance;
  const cheapFossil = cal.fossilReserveYears * w.params.resourceAbundance;
  const remaining = r.fossilReserves + cal.fossilTailYears * w.params.resourceAbundance; // cheap + tail
  // Cost rises smoothly as cheap reserves go, steeply into the tail, and the
  // tail itself runs out. New fossil finds and unconventional extraction are in
  // the tail assumption; there is no infinite tail.
  const depletion = clamp(1 - r.fossilReserves / cheapFossil, 0, 1);
  const tailDepletion = clamp(1 - remaining / totalFossil, 0, 1);
  const demandPressure = clamp(r.fossilExtractionRate - 0.7, 0, 1.5) * 0.25;
  let fossilTarget = 1 + Math.pow(depletion, 2.2) * 1.8 + (r.fossilReserves < 0 ? 1.5 + Math.pow(tailDepletion, 3) * 6 : 0) + demandPressure;
  if (remaining <= 0.5) fossilTarget = 12; // effectively unavailable
  // Falling demand softens prices (2020-style), a floor exists because extraction has real cost.
  fossilTarget = clamp(fossilTarget * (0.85 + 0.15 * clamp(r.fossilExtractionRate, 0.3, 1.2)), 0.7, 12);
  r.fossilCostIndex = lerp(r.fossilCostIndex, fossilTarget, 0.04);

  // ── critical minerals ────────────────────────────────────────────────────
  const rates = buildRatesGWperYear(w);
  const baseline = 0.35 * Math.pow(activity, 0.6); // general economy (construction, vehicles, electronics)
  const clean = rates.clean * cal.mineralDemandPerGWClean; // GW/yr × units per GW
  const compute = rates.compute * cal.mineralDemandPerGWCompute;
  const evDemand = meanEv * 0.25 * Math.pow(activity, 0.4);
  const robotDemand = meanRobots * 0.18 * Math.pow(activity, 0.5);
  const gross = baseline + clean + compute + evDemand + robotDemand + rates.housing * 0.0004;
  // Recycling: grows with waste management capability, robotics/AI sorting and
  // price pressure. Recycled material can only come from stock already in use.
  const managed = civs.reduce((a, c) => a + c.waste.managedShare, 0) / civs.length;
  const sorting = Math.min(0.35, Math.log1p(Math.max(0, w.techs.robotics_ind.cap - 1)) * 0.12 + Math.log1p(Math.max(0, w.techs.ai_models.cap - 1)) * 0.05);
  const pricePull = clamp((r.mineralCostIndex - 1.1) * 0.35, 0, 0.35);
  const recyclingTarget = clamp(0.12 + managed * 0.4 + sorting + pricePull + recyclingProjectBonus(w), 0.08, cal.recyclingCeiling);
  r.recyclingRate = lerp(r.recyclingRate, recyclingTarget, 0.006);
  r.mineralDemand = gross;
  // Recycled material comes from stock already in use. The steady-state part
  // of demand (replacement) is fully recoverable; the growth part (new
  // capacity) is not, because that metal is not old enough to come back yet.
  const replacement = baseline + evDemand * 0.6 + robotDemand * 0.6;
  const growthPart = Math.max(0, gross - replacement);
  r.mineralRecycled = (replacement + growthPart * 0.35) * r.recyclingRate;
  r.mineralSpaceInflow = civs.reduce((a, c) => a + c.space.mineralInflow, 0);
  // Seabed supply: real but capped. Nodule fields and vent deposits are finite and
  // every mine takes a decade; seawater extraction only ever covers a sliver.
  r.mineralSeabedInflow = Math.min(0.40, civs.reduce((a, c) => a + c.land.seabedInflow, 0));
  const netDraw = Math.max(0, gross - r.mineralRecycled - r.mineralSpaceInflow - r.mineralSeabedInflow);
  r.mineralReserves -= netDraw * DT;
  const cheapMin = cal.mineralReserveYears * w.params.resourceAbundance;
  const tailMin = cal.mineralTailYears * w.params.resourceAbundance;
  const minDepletion = clamp(1 - r.mineralReserves / cheapMin, 0, 1);
  const minTail = clamp(1 - (r.mineralReserves + tailMin) / (cheapMin + tailMin), 0, 1);
  // Demand pull matters as much as stock: doubling world mineral demand in a
  // decade raises prices even with reserves in the ground (mines take 15 years).
  const demandPull = clamp(gross - 1, 0, 3) * 0.22; // gross is in 2026-world-demand units
  const supplyRelief = clamp((r.mineralRecycled + r.mineralSpaceInflow + r.mineralSeabedInflow) / Math.max(0.2, gross), 0, 1.2);
  let minTarget = 1 + Math.pow(minDepletion, 1.8) * 1.6 + (r.mineralReserves < 0 ? 0.8 + Math.pow(minTail, 3) * 5 : 0) + demandPull;
  minTarget *= 1 - supplyRelief * 0.45;
  if (r.mineralReserves + tailMin <= 0.5) minTarget = Math.max(minTarget, 6);
  r.mineralCostIndex = lerp(r.mineralCostIndex, clamp(minTarget, 0.55, 8), 0.035);

  // ── land pressure ────────────────────────────────────────────────────────
  let land = 0;
  for (const c of w.civs) {
    const solarGW = c.energy.sources.solar.cap;
    land += clamp(c.housing.demandIndex * 0.35 + c.food.landUse * 0.4 + Math.min(0.3, solarGW / 300) + c.waste.accumulation * 0.1, 0, 1.6);
  }
  r.landPressure = clamp(land / w.civs.length * 0.75, 0, 1);

  // ── per-civ capex multiplier from material scarcity ──────────────────────
  for (const c of w.civs) {
    const strategic = c.traits.strategicAutonomy; // stockpiles and long-term contracts damp shocks
    const target = 1 + (r.mineralCostIndex - 1) * (0.55 - strategic * 0.15) + (r.fossilCostIndex - 1) * 0.08;
    c.economy.materialCostIndex = lerp(c.economy.materialCostIndex, clamp(target, 0.75, 5), 0.06);
  }
}

function recyclingProjectBonus(w: WorldState): number {
  return w.projects.filter((p) => p.kind === 'recycling' && p.status === 'operational').reduce((a, p) => a + p.capacity, 0);
}

/** Capex multiplier applied when a civilization proposes a physical project. */
export function materialCapexMultiplier(w: WorldState, civId: WorldState['civs'][number]['id'], kind: ProjectKind): number {
  const c = w.civs.find((x) => x.id === civId)!;
  const m = c.economy.materialCostIndex;
  switch (kind) {
    case 'solar': case 'wind': case 'geothermal': case 'ocean_energy': case 'storage': case 'hydrogen_hub': case 'grid': case 'datacenter': case 'fab': case 'power_satellite':
      return clamp(1 + (m - 1) * 0.9, 0.8, 4.5);
    case 'housing': case 'arcology': case 'underground_habitat': case 'nuclear': case 'fusion': case 'fossil': case 'bioenergy': case 'recycling':
      return clamp(1 + (m - 1) * 0.4, 0.85, 2.6);
    case 'spaceport': case 'asteroid_mining': case 'orbital_habitat': case 'mars_colony': case 'interstellar_ark': case 'space_elevator':
      return clamp(1 + (m - 1) * 0.5, 0.85, 3);
    case 'land_reclamation': case 'floating_district': case 'seabed_mining': case 'offshore_energy': case 'subsea_habitat': case 'aerial_platform':
      return clamp(1 + (m - 1) * 0.3, 0.85, 2.2);
  }
}

/** Fossil plants run less when fuel is dear: dispatch falls before capacity retires. */
export function fossilDispatchFactor(w: WorldState): number {
  return clamp(1.7 - w.resources.fossilCostIndex * 0.35, 0.12, 1);
}
