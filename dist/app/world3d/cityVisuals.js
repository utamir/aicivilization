import { civDef, physicalPopulation } from '../sim/index.js';
import { CITIES, INFRA_ZONES, civMainCity } from './layout.js';
export function computeWorldVisual(w, night) {
    const civOf = (id) => w.civs.find((c) => c.id === id);
    const cities = CITIES.map((city) => {
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
        const growth = Math.min(2.35, Math.max(0.28, popFactor * Math.pow(Math.max(0.2, usableHousing), 0.22) * employmentFactor * qualityUpgrade));
        // Built lots follow the housing stock; derelict lots are still standing (dark,
        // decayed) until demolition removes them from the stock.
        const builtFraction = Math.min(1, Math.max(0.08, (0.28 + Math.min(1.5, civ.housing.stockIndex) * 0.38) *
            Math.max(0.42, civ.housing.condition) * (1 - civ.housing.abandoned * 0.12)));
        const activeFraction = cityPop <= 0.00001 ? 0 : Math.min(builtFraction, Math.max(0, builtFraction * Math.min(1, Math.pow(Math.max(0, cityPop / Math.max(0.001, base)), 0.58)) *
            civ.housing.condition * (1 - civ.housing.abandoned)));
        const decay = Math.max(0, Math.min(1, (1 - civ.energy.gridCondition) * 0.6 + (1 - civ.housing.condition) * 0.5 + civ.housing.maintenanceBacklog * 0.3 + civ.energy.gridMaintenanceBacklog * 0.2));
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
    const infra = new Map();
    for (const z of INFRA_ZONES) {
        const civ = civOf(z.civId);
        let level = 0;
        if (z.type === 'solar')
            level = civ.energy.sources.solar.cap / (z.civId === 'ardan' ? 16 : z.civId === 'nemea' ? 6 : 9);
        if (z.type === 'wind')
            level = civ.energy.sources.wind.cap / (z.civId === 'ardan' ? 14 : z.civId === 'nemea' ? 6 : 10);
        if (z.type === 'nuclear')
            level = civ.energy.sources.nuclear.cap / (z.civId === 'ardan' ? 8 : z.civId === 'nemea' ? 2 : 6);
        if (z.type === 'datacenter')
            level = civ.compute.dcCapGW / (z.civId === 'ardan' ? 5.5 : z.civId === 'nemea' ? 1.2 : 4.2);
        if (z.type === 'port')
            level = 1;
        if (z.type === 'farm')
            level = 1;
        if (z.type === 'spaceport')
            level = civ.space.spaceportCapacity;
        infra.set(z.id, Math.max(0, level));
    }
    const frontier = {};
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
    const evShare = {
        veloria: w.techs.transport_ev.adoption.veloria.penetration,
        ardan: w.techs.transport_ev.adoption.ardan.penetration,
        nemea: w.techs.transport_ev.adoption.nemea.penetration,
    };
    const food = {};
    for (const civ of w.civs) {
        const f = civ.food;
        food[civ.id] = {
            // fields brown out when harvests fail, food runs short, or warming bites
            stress: Math.max(0, Math.min(1, f.shortage * 2.2 + Math.max(0, 1.05 - f.selfSufficiency) * 0.8 +
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
