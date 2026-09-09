// ─────────────────────────────────────────────────────────────────────────────
// CITY VISUAL STATE — maps simulation state to physical world appearance.
// The world becomes futuristic only through simulated infrastructure.
// ─────────────────────────────────────────────────────────────────────────────
import type { WorldState, CivId } from '../sim';
import { civDef, physicalPopulation } from '../sim';
import { CITIES, INFRA_ZONES, civMainCity, type CityLayout } from './layout';

export interface CityVisual {
  city: CityLayout;
  growth: number;        // 0.6..2.6 — activity/infill pressure; never moves or stretches existing lots
  sprawl: number;        // 0.5..2 — diagnostic footprint pressure; existing geometry stays fixed
  builtFraction: number; // 0..1 — share of lots physically constructed, active or abandoned
  activeFraction: number;// 0..1 — share of lots occupied/serviced; can reach exactly zero
  nightDim: number;      // 0..1 — brownout dimming when power is scarce
  robotics: number;      // industrial adoption → factory automation glow
  research: number;      // research capacity → campus district growth
  unrest: number;        // 0..1 — streets empty when stability collapses
  crowding: number;      // 0..1 — housing shortage → shanties & taller towers
  waste: number;         // 0..1 — accumulated waste → landfills & smog
  derelict: number;      // 0..1 — share of built lots that are abandoned: dark, decayed, half-collapsed
  vacancy: number;       // 0..1 — empty homes: windows stay dark at night
  decay: number;         // 0..1 — general infrastructure decay (grid, housing condition): roads crack, lights flicker
  population: number;    // people living in this city (millions)
  elevator: boolean;     // space elevator anchored at this civ's capital
  reclaimed: number;     // 0..1 — reclaimed-land districts pushed out into the sea (capital only)
  reclaimedCondition: number; // 0..1 — dikes holding (1) or districts going under (0)
  floating: number;      // 0..1 — floating platform districts moored offshore (capital only)
  landPressure: number;  // 0..1 — how full the island is (shanties on the last free land)
  subsea: number;        // 0..1 — sea-floor habitats offshore (capital only)
  aerial: number;        // 0..1 — stratospheric platforms above the capital
  vertical: number;      // 0..1 — arcology / above-ground capacity beyond ordinary density
  underground: number;   // 0..1 — underground habitat capacity
  rewilding: number;     // 0..1 — ecological succession through abandoned developed land
  floatingCondition: number;
  subseaCondition: number;
  verticalCondition: number;
  undergroundCondition: number;
}

export interface FoodVisual {
  stress: number;      // 0..1 — fields brown out under climate/shortage
  artificial: number;  // 0..1 — vertical-farm towers rise as food moves indoors
  landUse: number;     // 0..1 — cultivated share (falls with rewilding)
  yieldIndex: number;  // fields densify as yields rise
}

export interface InfraVisual {
  zoneId: string;
  level: number; // 0..~3 relative to 2026 baseline
}

export interface CivFrontierVisual {
  fusionLevel: number;     // fusion GW relative to the civ's 2026 nuclear fleet
  spaceportLevel: number;  // launch throughput index
  launchRate: number;      // 0..1 — how often rockets lift off
  habitats: number;        // count of visible orbital habitats (0..12)
  marsCity: boolean;
  powerSatellites: number; // 0..1 — orbital power mirror visibility
  orbitalIndustry: number; // abstract orbital industrial/logistics stock; drives schematic industrial modules
  condition: number;       // 0..1 — mean physical condition of the generation fleet (turbines stall, panels fade)
  gridCondition: number;
  geothermalLevel: number;
  bioenergyLevel: number;
  oceanEnergyLevel: number;
  hydrogenLevel: number;
}

export interface WorldVisual {
  cities: CityVisual[];
  infra: Map<string, number>; // zoneId → level
  food: Record<CivId, FoodVisual>;
  evShare: Record<CivId, number>;
  frontier: Record<CivId, CivFrontierVisual>;
  night: number;
  kardashev: number;
  dysonProgress: number;    // 0..1 — swarm elements glint in the sky
  offworldPopulationM: number; // actual people living off Earth
  orbitalPopulationM: number;  // actual orbital/cislunar residents; subset of off-world
  marsPopulationM: number;     // actual Mars residents; subset of off-world
  marsCapacityM: number;       // physical settlement capacity on Mars; not population
  deepSpacePopulationM: number;// actual residents beyond the settled planetary system; subset of off-world
}

export function computeWorldVisual(w: WorldState, night: number): WorldVisual {
  const civOf = (id: CivId) => w.civs.find((c) => c.id === id)!;
  const cities: CityVisual[] = CITIES.map((city) => {
    const civ = civOf(city.civId);
    const def = civDef(city.civId);
    // city population share: urbanization concentrates people in cities even
    // when national population stagnates (the Tokyo effect)
    const urbanFactor = civ.population.urbanization / def.population.urbanization;
    // Only embodied Earth residents live in these streets: off-world settlers and
    // digital minds left houses behind (which is why cities can empty while
    // population grows).
    const cityPop = city.basePop * (physicalPopulation(civ) / def.population.total) * urbanFactor;
    const base = city.basePop;
    // Physical city form follows people, usable housing and vacancy — not a
    // national GDP counter. Rich but shrinking cities renovate rather than
    // growing without bound; prolonged decline removes occupied lots.
    const popFactor = Math.pow(Math.max(0.08, cityPop / base), 0.72);
    const usableHousing = civ.housing.stockIndex * civ.housing.condition * (1 - civ.housing.vacancy * 0.55) * (1 - civ.housing.abandoned);
    const employmentFactor = Math.max(0.45, 1 - civ.economy.unemployment * 0.9);
    const qualityUpgrade = 1 + Math.min(0.28, Math.max(0, civ.economy.wageIndex - 1) * 0.08);
    const growth = Math.min(2.35, Math.max(0.28,
      popFactor * Math.pow(Math.max(0.2, usableHousing), 0.22) * employmentFactor * qualityUpgrade));
    // Built lots follow the housing stock; derelict lots are still standing (dark,
    // decayed) until demolition removes them from the stock.
    const builtFraction = Math.min(1, Math.max(0.08,
      (0.28 + Math.min(1.5, civ.housing.stockIndex) * 0.38) *
      Math.max(0.42, civ.housing.condition) * (1 - civ.housing.abandoned * 0.12)));
    const activeFraction = cityPop <= 0.00001 ? 0 : Math.min(builtFraction, Math.max(0,
      builtFraction * Math.min(1, Math.pow(Math.max(0, cityPop / Math.max(0.001, base)), 0.58)) *
      civ.housing.condition * (1 - civ.housing.abandoned)));
    const decay = Math.max(0, Math.min(1,
      (1 - civ.energy.gridCondition) * 0.6 + (1 - civ.housing.condition) * 0.5 + civ.housing.maintenanceBacklog * 0.3 + civ.energy.gridMaintenanceBacklog * 0.2));
    // blackouts are VISIBLE: deep negative margin kills the lights outright;
    // high prices dim them. A city at −100% margin is dark.
    const blackout = Math.max(0, Math.min(1, -civ.energy.marginPct / 22)) * 0.92;
    const priceDim = Math.max(0, Math.min(0.35, (civ.energy.priceIndex - 1.15) * 0.3));
    const occupiedShare = Math.max(0, Math.min(1, cityPop / Math.max(0.001, base)));
    // Empty cities are dark even if generation capacity still exists. As population
    // shrinks, a growing fraction of windows remain unoccupied.
    const vacancyDim = 1 - Math.pow(occupiedShare, 0.55);
    const nightDim = Math.min(1, Math.max(blackout + priceDim, vacancyDim));
    return {
      city,
      growth,
      // Footprint follows the number of people living here (and how much housing they occupy), not GDP.
      sprawl: Math.min(2.2, Math.max(0.45, Math.sqrt(Math.max(0.08, cityPop / base)) * Math.pow(Math.max(0.3, civ.housing.stockIndex / Math.max(0.3, cityPop / base)), 0.25))),
      population: cityPop,
      builtFraction,
      activeFraction,
      nightDim,
      robotics: w.techs.robotics_ind.adoption[city.civId].intensity,
      research: civ.researchCapacity,
      unrest: Math.max(0, Math.min(1, (0.45 - civ.society.stability) * 2.5)),
      crowding: civ.housing.crowding,
      waste: Math.min(1, civ.waste.accumulation),
      derelict: Math.min(0.85, civ.housing.abandoned),
      vacancy: Math.min(1, civ.housing.vacancy),
      decay,
      elevator: civ.space.elevator && city.id === civMainCity(city.civId).id,
      reclaimed: city.id === civMainCity(city.civId).id ? Math.min(1, civ.land.reclaimed / 0.12) : 0,
      reclaimedCondition: civ.land.reclaimedCondition,
      floating: city.id === civMainCity(city.civId).id ? Math.min(1, civ.land.floating / 0.15) : 0,
      landPressure: Math.max(0, Math.min(1, (civ.land.pressure - 0.8) / 0.2)),
      subsea: city.id === civMainCity(city.civId).id ? Math.min(1, civ.land.subsea / 0.08) : 0,
      aerial: city.id === civMainCity(city.civId).id ? Math.min(1, civ.land.aerial / 0.02) : 0,
      vertical: city.id === civMainCity(city.civId).id ? Math.min(1, civ.land.vertical / 0.12) : 0,
      underground: city.id === civMainCity(city.civId).id ? Math.min(1, civ.land.underground / 0.12) : 0,
      rewilding: Math.min(1, civ.land.wildReclaimed),
      floatingCondition: civ.land.floatingCondition,
      subseaCondition: civ.land.subseaCondition,
      verticalCondition: civ.land.verticalCondition,
      undergroundCondition: civ.land.undergroundCondition,
    };
  });

  const infra = new Map<string, number>();
  for (const z of INFRA_ZONES) {
    const civ = civOf(z.civId);
    let level = 0;
    if (z.type === 'solar') level = civ.energy.sources.solar.cap / (z.civId === 'ardan' ? 16 : z.civId === 'nemea' ? 6 : 9);
    if (z.type === 'wind') level = civ.energy.sources.wind.cap / (z.civId === 'ardan' ? 14 : z.civId === 'nemea' ? 6 : 10);
    if (z.type === 'nuclear') level = civ.energy.sources.nuclear.cap / (z.civId === 'ardan' ? 8 : z.civId === 'nemea' ? 2 : 6);
    if (z.type === 'datacenter') level = civ.compute.dcCapGW / (z.civId === 'ardan' ? 5.5 : z.civId === 'nemea' ? 1.2 : 4.2);
    if (z.type === 'port') level = 1;
    if (z.type === 'farm') level = 1;
    if (z.type === 'spaceport') level = civ.space.spaceportCapacity;
    infra.set(z.id, Math.max(0, level));
  }

  const frontier = {} as Record<CivId, CivFrontierVisual>;
  for (const civ of w.civs) {
    const nuclear0 = civDef(civ.id).energy.nuclear;
    const srcs = civ.energy.sources;
    const totalCap = srcs.solar.cap + srcs.wind.cap + srcs.nuclear.cap + srcs.fossil.cap + srcs.fusion.cap + srcs.hydro.cap + srcs.geothermal.cap + srcs.bioenergy.cap + srcs.ocean.cap;
    const condition = totalCap > 0
      ? (srcs.solar.cap * srcs.solar.condition + srcs.wind.cap * srcs.wind.condition + srcs.nuclear.cap * srcs.nuclear.condition + srcs.fossil.cap * srcs.fossil.condition + srcs.fusion.cap * srcs.fusion.condition + srcs.hydro.cap * srcs.hydro.condition + srcs.geothermal.cap * srcs.geothermal.condition + srcs.bioenergy.cap * srcs.bioenergy.condition + srcs.ocean.cap * srcs.ocean.condition) / totalCap
      : 1;
    frontier[civ.id] = {
      fusionLevel: civ.energy.sources.fusion.cap / Math.max(1, nuclear0),
      spaceportLevel: civ.space.spaceportCapacity,
      // No embodied people on Earth means no Earth launch animation. Off-world
      // industry may continue independently, but that is rendered in orbit.
      launchRate: physicalPopulation(civ) > 0.001 ? Math.min(1, civ.space.spaceportCapacity * 0.25 + civ.space.orbitalIndustry * 0.02) : 0,
      habitats: Math.min(12, Math.floor(Math.sqrt(civ.space.habitatCapacityM * 3))),
      marsCity: civ.space.marsPopulationM > 0.01,
      powerSatellites: Math.min(1, civ.space.powerSatelliteGW / 20),
      orbitalIndustry: civ.space.orbitalIndustry,
      condition,
      gridCondition: civ.energy.gridCondition,
      geothermalLevel: Math.min(1.5, srcs.geothermal.cap / Math.max(1, nuclear0)),
      bioenergyLevel: Math.min(1.5, srcs.bioenergy.cap / Math.max(1, nuclear0)),
      oceanEnergyLevel: Math.min(1.5, srcs.ocean.cap / Math.max(1, nuclear0)),
      hydrogenLevel: Math.min(1.5, (civ.energy.hydrogen.electrolyzerGW + civ.energy.hydrogen.fuelCellGW) / Math.max(1, nuclear0)),
    };
  }
  const dyson = w.frontier.milestones.find((m) => m.id === 'dyson_swarm');

  const evShare: Record<CivId, number> = {
    veloria: w.techs.transport_ev.adoption.veloria.penetration,
    ardan: w.techs.transport_ev.adoption.ardan.penetration,
    nemea: w.techs.transport_ev.adoption.nemea.penetration,
  };
  const food = {} as Record<CivId, FoodVisual>;
  for (const civ of w.civs) {
    const f = civ.food;
    food[civ.id] = {
      // fields brown out when harvests fail, food runs short, or warming bites
      stress: Math.max(0, Math.min(1,
        f.shortage * 2.2 + Math.max(0, 1.05 - f.selfSufficiency) * 0.8 +
        Math.max(0, w.env.warmingC - 1.5) * 0.25)),
      artificial: f.artificialShare,
      landUse: f.landUse,
      yieldIndex: f.landYield,
    };
  }
  return {
    cities, infra, food, evShare, frontier, night,
    kardashev: w.frontier.kardashev,
    dysonProgress: dyson && (dyson.status === 'in_progress' || dyson.status === 'achieved') ? dyson.progress : 0,
    offworldPopulationM: w.frontier.offworldPopulationM,
    orbitalPopulationM: w.civs.reduce((a, c) => a + Math.max(0, c.population.offworld - c.space.marsPopulationM - c.space.interstellarM), 0),
    marsPopulationM: w.civs.reduce((a, c) => a + c.space.marsPopulationM, 0),
    marsCapacityM: w.civs.reduce((a, c) => a + c.space.marsCapacityM, 0),
    deepSpacePopulationM: w.civs.reduce((a, c) => a + c.space.interstellarM, 0),
  };
}
