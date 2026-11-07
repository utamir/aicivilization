import { CALIBRATION } from '../data/calibration.js';
import { civDef } from '../data/civDefs.js';
import { addEvent, yearOf } from './step.js';
import { clamp, lerp } from './formulas.js';
const DT = 1 / 12;
export const LAND = {
    // capex per index unit of reclaimed land (1 unit = the civ's entire 2026 usable land).
    // Calibrated from Singapore-scale reclamation: adding ~1% of a small dense
    // country's land is a multi-billion programme; deep-water reclamation runs
    // 4–10× the shallow-shelf cost (sand volume rises from ~1.5M to ~35M m³/km²).
    reclaimCapexPerUnitShallow: 9.0,
    reclaimDeepMultiplier: 4.5,
    reclaimLeadMonths: 60,
    reclaimDeepLeadMonths: 96,
    // floating districts cost 20–50% more than land-based construction today and
    // need marine-grade maintenance for the life of the platform.
    floatingCapexMult: 1.45,
    floatingLeadMonths: 30,
    floatingWearMult: 1.8,
    maxDensity: 2.4, // 2.4× the 2026 built density before cost per unit becomes prohibitive
};
export function seaLevelRiseM(w) {
    return Math.max(0, w.env.seaLevelM);
}
/** Capex multiplier on housing from density and land scarcity (building up costs more than building out). */
export function housingLandCapexMultiplier(c) {
    const L = c.land;
    const scarcity = clamp((L.pressure - 0.85) / 0.15, 0, 1);
    return clamp(1 + (L.densityIndex - 1) * 0.55 + scarcity * scarcity * 1.4, 0.9, 4);
}
/** How much housing stock (index units) could still be built on free land at the current density. */
export function landRoomForHousing(c) {
    const def = civDef(c.id);
    return (Math.max(0, c.land.free) + c.land.brownfield) / Math.max(0.05, def.land.urban) * c.land.densityIndex;
}
export function stepLand(w) {
    const rise = seaLevelRiseM(w);
    for (const c of w.civs) {
        const def = civDef(c.id);
        const L = c.land;
        const h = c.housing;
        const t = w.techs;
        // ── footprint ────────────────────────────────────────────────────────
        // Cities: physical stock on land (floating stock excluded) at current density.
        // The footprint ratchets: new stock is built at today's density, but a
        // city that densifies does not get physically smaller. Demolition of
        // derelict blocks (stock falling) returns half the land.
        // Arcologies and underground districts add housing with far less surface
        // footprint than ordinary stock. They are not free land: arcologies still
        // need foundations/services and underground districts need portals/shafts.
        const landStock = Math.max(0, h.stockIndex - L.floating - L.subsea - L.aerial - L.vertical * 0.78 - L.underground * 0.90);
        const dStock = landStock - L.builtStock;
        if (dStock > 0) {
            const need = def.land.urban * dStock / L.densityIndex;
            const reuse = Math.min(need, L.brownfield); // cleared blocks are rebuilt first
            L.brownfield -= reuse;
            L.urban += need - reuse;
        }
        else if (dStock < 0) {
            const freed = def.land.urban * -dStock / Math.max(1, L.densityIndex);
            L.brownfield += freed * 0.5; // half waits as brownfield, half begins ecological succession
            const earthPhysical = Math.max(0, (c.population.total - c.population.offworld) * (1 - c.population.digitalShare));
            const urbanFloor = def.land.urban * (earthPhysical < 0.001 ? 0.03 : earthPhysical < def.population.total * 0.08 ? 0.12 : 0.30);
            L.urban = Math.max(urbanFloor, L.urban - freed * 0.5);
        }
        L.builtStock = landStock;
        // Farms shrink as food moves indoors (rewilding) and grow when a hungry society ploughs marginal land.
        const farmPush = 1 + clamp(c.food.shortage * 3, 0, 0.35);
        L.farm = def.land.farm * clamp(c.food.landUse * farmPush, 0.25, 1.3);
        // Energy: solar and wind are land-hungry; nuclear, fusion and orbital power are not.
        const e = c.energy.sources;
        const solar0 = Math.max(1, def.energy.solar), wind0 = Math.max(1, def.energy.wind);
        L.offshoreGW = Math.min(L.offshoreGW, e.wind.cap); // retired turbines leave the count
        L.energy = def.land.energy * clamp((e.solar.cap + Math.max(0, e.wind.cap - L.offshoreGW) * 0.35) / (solar0 + wind0 * 0.35), 0.3, 14);
        const committed = L.urban + L.farm + L.energy;
        L.free = Math.max(0, L.usable - committed);
        L.pressure = committed / Math.max(0.2, L.usable);
        // ── density: building up when building out is impossible ─────────────
        // Enabled by construction capability (industrial robotics, materials) and pushed by rent. Slow: cities rebuild over decades.
        const capability = 1 + Math.log1p(Math.max(0, t.robotics_ind.cap - 1)) * 0.5;
        const densityTarget = clamp(1 + clamp((L.pressure - 0.75) / 0.25, 0, 1) * 0.9 * capability + Math.max(0, h.rentIndex - 1.3) * 0.25, 1, LAND.maxDensity);
        const speed = 0.0012 * clamp(c.economy.capexAvailability, 0.2, 1.2) * (0.5 + c.economy.institutionalCapacity);
        L.densityIndex = lerp(L.densityIndex, Math.max(L.densityIndex * 0.999, densityTarget), speed);
        // ── sea-level rise: exposed coastline and reclaimed land ──────────────
        // Protection (dikes, pumps, drainage) is a permanent cost. Solvent, well-run
        // states pay it; the others watch districts flood.
        const protectionNeed = (L.seaExposure * L.urban * 0.5 + L.reclaimed) * (0.4 + rise * 2.2);
        const protectionCapacity = clamp(c.economy.institutionalCapacity * 0.7 + c.economy.capexAvailability * 0.5 - Math.max(0, c.economy.publicDebt - 1.6) * 0.3, 0.05, 1.2);
        const protected_ = protectionNeed <= 0.001 ? 1 : clamp(protectionCapacity / (protectionNeed * 2.5), 0.15, 1);
        // Reclaimed land: condition drifts toward the protection level; sea rise pushes it down.
        const condTarget = clamp(protected_ - rise * 0.35, 0.05, 1);
        L.reclaimedCondition = lerp(L.reclaimedCondition, condTarget, 0.012);
        if (L.reclaimed > 0.0005 && L.reclaimedCondition < 0.35) {
            // districts on reclaimed land flood: land, houses and the people in them are lost to the city.
            const lossShare = 0.06 * DT * 12 * (0.35 - L.reclaimedCondition) / 0.35;
            const lost = L.reclaimed * lossShare;
            L.reclaimed -= lost;
            L.usable -= lost;
            L.lost += lost;
            const stockLost = lost / Math.max(0.05, def.land.urban) * L.densityIndex * 0.6;
            h.stockIndex = Math.max(0.15, h.stockIndex - stockLost);
            h.abandoned = clamp(h.abandoned + stockLost * 0.5, 0, 0.85);
            const key = `flood-${c.id}`;
            if (!w.flags[key]) {
                w.flags[key] = true;
                addEvent(w, {
                    title: `${c.name}: reclaimed districts flood`,
                    body: `Sea level is ${rise.toFixed(2)} m above 2026 and the dikes and pumps around ${(L.reclaimed / Math.max(0.001, L.reclaimed + lost) * 100).toFixed(0)}% of the reclaimed land are no longer funded. Streets built on fill are going under; residents move inland into an already crowded city.`,
                    category: 'environment', civId: c.id, significance: 3,
                    causes: [{ factor: 'sea-level rise', weight: 0.5 }, { factor: 'unfunded coastal protection', weight: 0.5 }],
                    counterforces: [{ factor: 'emergency dike programme', weight: 0.4 }], confidence: 'medium',
                });
            }
        }
        else if (L.reclaimedCondition > 0.55) {
            w.flags[`flood-${c.id}`] = false;
        }
        // Exposed natural coastline: slow permanent loss when protection lags a rising sea.
        if (rise > 0.25 && protected_ < 0.6) {
            const lost = L.seaExposure * L.urban * (0.6 - protected_) * 0.004 * DT * 12 * rise;
            L.usable = Math.max(0.5, L.usable - lost);
            L.lost += lost;
            h.stockIndex = Math.max(0.15, h.stockIndex - lost / Math.max(0.05, def.land.urban) * 0.5);
        }
        // Seabed mining: plumes and habitat loss show up as unmanaged waste and, where
        // people care, as backlash. Supply degrades as the easy fields are worked out.
        if (L.seabedInflow > 0) {
            // DISCOL (1989–2015): biological effects were still evident after 26 years; suspension feeders remained substantially reduced in disturbed tracks. This supports persistent local cost, not a universal claim of irreversible ocean damage.
            c.waste.accumulation += L.seabedInflow * 0.05 * DT;
            c.society.backlash = Math.min(1, c.society.backlash + L.seabedInflow * c.traits.regulatoryCaution * 0.008 * DT);
            L.seabedInflow *= 1 - 0.012 * DT;
        }
        // Habitat systems fail differently. Physical stock persists, but usable capacity
        // falls when moorings, pressure hulls, lifts, drainage, ventilation or life-support
        // are not maintained. Autonomous infrastructure can preserve some systems after
        // people leave, but it never creates occupants.
        const earthPhysical = Math.max(0, (c.population.total - c.population.offworld) * (1 - c.population.digitalShare));
        const localMaintainers = clamp(earthPhysical / Math.max(0.05, def.population.total) + c.society.autonomousInfrastructure * 0.75, 0, 1);
        const maintenance = clamp(localMaintainers * 0.45 + c.economy.institutionalCapacity * 0.28 + c.economy.capexAvailability * 0.17 + Math.max(0, c.energy.marginPct) / 100, 0, 1.15);
        const marineSeverity = 1 + Math.min(1.6, L.floating * 1.6 + rise * 0.35);
        const subseaDepthSeverity = 1 + Math.min(2.4, L.subsea * 5.0);
        const verticalComplexity = 1 + Math.min(1.8, L.vertical * 2.2);
        const undergroundDepth = 1 + Math.min(2.2, L.underground * 3.4);
        const conditionStep = (condition, annualWear, complexity, support) => {
            // Condition is serviceability, not material existence.  Unmaintained systems
            // converge toward failure; maintained systems converge toward an equilibrium
            // set by inspection, replacement, corrosion control, pumping and redundancy.
            // This avoids both immortality and the opposite error: a well-funded habitat
            // mechanically reaching zero just because centuries pass.
            const target = clamp(0.02 + Math.pow(clamp(support, 0, 1.15), 1.25) * 0.98 / Math.pow(complexity, 0.38), 0.02, 0.99);
            const decayRate = annualWear * complexity * (1 - clamp(support, 0, 1) * 0.45);
            const recoveryRate = 0.055 + Math.max(0, support - 0.45) * 0.12;
            const rate = target < condition ? decayRate : recoveryRate;
            return lerp(condition, target, clamp(rate * DT, 0.0002, 0.08));
        };
        if (L.floating > 0)
            L.floatingCondition = conditionStep(L.floatingCondition, 0.060, marineSeverity, maintenance);
        else
            L.floatingCondition = 1;
        if (L.subsea > 0)
            L.subseaCondition = conditionStep(L.subseaCondition, 0.075, subseaDepthSeverity, maintenance * clamp(c.energy.gridCondition, 0.2, 1));
        else
            L.subseaCondition = 1;
        if (L.vertical > 0)
            L.verticalCondition = conditionStep(L.verticalCondition, 0.024, verticalComplexity, maintenance);
        else
            L.verticalCondition = 1;
        if (L.underground > 0)
            L.undergroundCondition = conditionStep(L.undergroundCondition, 0.032, undergroundDepth, maintenance * clamp(c.energy.gridCondition, 0.25, 1));
        else
            L.undergroundCondition = 1;
        // Nature is a state variable too. Empty/brownfield districts rewild over decades;
        // resettlement and redevelopment push succession back. This is intentionally
        // slow enough that a collapsed city remains recognisable before becoming forest.
        const earthRatio = earthPhysical / Math.max(0.001, def.population.total);
        const rewildTarget = clamp(h.abandoned * 0.85 + L.brownfield * 1.8 + (earthRatio < 0.03 ? 0.55 : earthRatio < 0.15 ? 0.25 : 0), 0, 1);
        const successionRate = rewildTarget > L.wildReclaimed ? 0.0022 : 0.0008;
        L.wildReclaimed = lerp(L.wildReclaimed, rewildTarget, successionRate);
    }
    // World land pressure = the mean of the three (used by research priorities and the frontier).
    w.resources.landPressure = clamp(w.civs.reduce((a, c) => a + clamp((c.land.pressure - 0.6) / 0.45, 0, 1), 0) / w.civs.length, 0, 1);
}
export function floatingPlatformsValidated(w) {
    return w.inventions.some((i) => i.id.startsWith('inv-modular-floating-platforms-') && i.status === 'deployed');
}
export function planLandProjects(w, c, propose) {
    const L = c.land;
    const h = c.housing;
    const def = civDef(c.id);
    const room = landRoomForHousing(c);
    const needStock = clamp(h.crowding * 0.16, 0, 0.12);
    const landlocked = L.pressure > 0.92 && room < needStock * 0.6;
    const key = `landlocked-${c.id}`;
    if (landlocked && !w.flags[key] && h.crowding > 0.08) {
        w.flags[key] = true;
        addEvent(w, {
            title: `${c.name} runs out of land`,
            body: `${(L.pressure * 100).toFixed(0)}% of usable land is committed to cities, farms and energy. New housing can only come from building higher, taking farmland, reclaiming the sea or building on it. Rents are ${h.rentIndex.toFixed(1)}× 2026.`,
            category: 'economy', civId: c.id, significance: 2,
            causes: [{ factor: 'population and urban growth on a finite island', weight: 0.6 }, { factor: 'land-hungry solar and farming', weight: 0.4 }],
            counterforces: [{ factor: 'densification', weight: 0.4 }, { factor: 'sea reclamation and floating districts', weight: 0.4 }], confidence: 'high',
        });
    }
    if (!landlocked && L.pressure < 0.85)
        w.flags[key] = false;
    planVerticalProjects(w, c, propose, landlocked, needStock);
    planOceanProjects(w, c, propose);
    // Marine-first polities reclaim ahead of need (Singapore did: ports, industry, room to grow), the rest wait for the wall.
    // Nature is minimum friction: nobody dredges the sea while there is land to build on.
    if (!landlocked || h.crowding < 0.06)
        return;
    // Exits from the land trap are earned: only a solvent, stable, competent state builds dikes that last.
    const earned = c.frontierReadiness;
    const push = (1 + civPolicyStrength(w, c.id, 'coastal_expansion')) * w.params.marineMult;
    const wealth = c.economy.outputPerCapita;
    if (earned < 0.4 && push <= 1)
        return;
    // Reclamation: shallow shelf first, then deep water at several times the price.
    const wantLand = clamp(needStock / L.densityIndex * def.land.urban * 1.5, 0.008, 0.06);
    const deep = L.shelf < wantLand * 0.5;
    const rise = seaLevelRiseM(w);
    const worthIt = deep ? (earned > 0.6 && wealth > 1.6 && rise < 0.9) || push > 1.5 : (earned > 0.45 && wealth > 0.9) || push > 1;
    if (worthIt && L.reclaimedCondition > 0.5) {
        propose(w, c, 'land_reclamation', wantLand * push, deep ? 'shallow shelf exhausted: deep-water reclamation behind new sea walls' : 'reclaim shallow coastal shelf for new districts');
    }
    // Floating districts: once the platform technology is validated, and preferred outright when the sea is rising.
    if (floatingPlatformsValidated(w) && (earned > 0.5 || push > 1) && wealth > 1.2 && (deep || rise > 0.4 || push > 1 || L.floating > 0)) {
        const next = L.floating === 0 ? Math.max(0.02, needStock * 0.5) : clamp(needStock, 0.02, 0.12);
        propose(w, c, 'floating_district', next * push, L.floating === 0 ? 'first modular floating district off the main harbour' : 'expand floating districts: living space without land');
    }
}
function planVerticalProjects(w, c, propose, landlocked, needStock) {
    const L = c.land;
    const earned = c.frontierReadiness;
    const robotics = w.techs.robotics_ind.cap;
    const wealth = c.economy.outputPerCapita;
    const verticalPush = w.params.verticalMult;
    const undergroundPush = w.params.undergroundMult;
    const verticalPreference = clamp((verticalPush - 1) / 0.75, 0, 1.35);
    const undergroundPreference = clamp((undergroundPush - 1) / 0.75, 0, 1.25);
    const strategicVertical = verticalPreference > 0.32;
    // Most polities densify radically only after surface scarcity is visible. A
    // deliberately vertical polity is different: it can choose compact urbanism
    // before literal land exhaustion, just as a marine-first polity can choose the
    // sea before the coast is full. It still needs demand, capital, robotics and
    // competent institutions; the scenario multiplier is a preference, not a cheat.
    if (!landlocked && !strategicVertical)
        return;
    const demandFloor = strategicVertical ? 0.018 : 0.055;
    if (c.housing.crowding < demandFloor && L.pressure < (strategicVertical ? 0.70 : 0.92))
        return;
    // Arcologies are discrete redevelopment/construction projects. Target stock is
    // driven by the polity's compact-city preference plus real pressure; existing
    // buildings are never stretched or moved to reach it.
    const verticalTarget = strategicVertical
        ? clamp(0.035 + verticalPreference * 0.18 + Math.max(0, L.pressure - 0.68) * 0.42 + Math.max(0, c.housing.crowding - 0.02) * 0.55, 0.035, 0.62)
        : 0.8;
    if (robotics > 1.18 && earned > 0.40 / Math.sqrt(verticalPush) && wealth > 1.0 && L.vertical < Math.min(0.8, verticalTarget)) {
        const gap = Math.max(0.012, verticalTarget - L.vertical);
        const next = clamp(Math.max(0.018, Math.max(needStock * 0.65, gap * 0.22)) * Math.sqrt(verticalPush), 0.015, 0.085);
        propose(w, c, 'arcology', next, L.vertical === 0 ? 'compact-city strategy: build the first high-density arcology before outward sprawl becomes inevitable' : 'redevelop selected fixed sites into additional vertical districts');
    }
    // Underground districts are an even more infrastructure-dependent choice. In
    // a vertical-first polity they may begin before absolute scarcity, but only
    // after either some vertical urban systems exist or land pressure is already
    // substantial. Depth progressively raises cost and maintenance elsewhere in
    // the model, so this does not create unlimited free volume.
    const undergroundTarget = strategicVertical
        ? clamp(0.018 + undergroundPreference * 0.095 + Math.max(0, L.pressure - 0.76) * 0.30, 0.018, 0.34)
        : 0.65;
    const undergroundDemand = landlocked || (strategicVertical && (L.vertical > 0.025 || L.pressure > 0.76));
    if (undergroundDemand && robotics > 1.45 && c.energy.marginPct > 5 && earned > 0.48 / Math.sqrt(undergroundPush) && wealth > 1.25 && L.underground < undergroundTarget) {
        const gap = Math.max(0.01, undergroundTarget - L.underground);
        const next = clamp(Math.max(0.012, Math.max(needStock * 0.45, gap * 0.20)) * Math.sqrt(undergroundPush), 0.012, 0.060);
        propose(w, c, 'underground_habitat', next, L.underground === 0 ? 'compact-city strategy: open a serviced underground district beneath existing urban land' : 'extend underground districts where geology, power and maintenance capacity permit');
    }
}
/**
 * The sea as a resource, not only as living space. Offshore wind and ocean
 * thermal plants take no land; seabed nodules and vent deposits are the
 * nearest exit from mineral scarcity, decades before asteroids. Both need the
 * marine-platform industry (the same invention as floating districts), and
 * both are things only an earned, solvent civilization pays for.
 */
function planOceanProjects(w, c, propose) {
    const L = c.land;
    const earned = c.frontierReadiness;
    const marine = floatingPlatformsValidated(w);
    const robotics = w.techs.robotics_ind.cap;
    // A marine-first scenario is a strategic choice, not a synonym for 'wait until
    // every hectare is gone'.  Ports, industry and housing can deliberately move
    // offshore while land still exists, but projects still have to clear finance,
    // institutional and technology gates in proposeProject().
    const marinePreference = clamp((w.params.marineMult - 1) / 0.70, 0, 1.35);
    const strategicMarine = marinePreference > 0.32;
    if (marine && strategicMarine && c.economy.outputPerCapita > 0.95 && earned > 0.16 && L.floatingCondition > 0.30) {
        const target = clamp(0.025 + marinePreference * 0.20 + Math.max(0, L.pressure - 0.72) * 0.38 + Math.max(0, c.housing.crowding - 0.05) * 0.16, 0.025, 0.38);
        if (L.floating + 0.008 < target) {
            const next = clamp(Math.max(0.016, (target - L.floating) * 0.22), 0.016, 0.055);
            propose(w, c, 'floating_district', next, L.floating === 0
                ? 'marine-first development: build a serviced floating district before surface land is exhausted'
                : 'extend the connected floating district network as an intentional urban form');
        }
    }
    // Offshore energy: a marine-first polity may move generation offshore to spare
    // land even before a shortage; other scenarios wait for land/grid pressure.
    if (marine && earned > 0.30 / Math.sqrt(Math.max(1, w.params.marineMult)) && w.techs.wind_power.maturity > 0.6
        && ((strategicMarine && L.pressure > 0.72) || (L.pressure > 0.82 && c.energy.marginPct < 12))) {
        propose(w, c, 'offshore_energy', clamp(c.energy.demandTWh / 8.76 * 0.08, 1, 12), strategicMarine ? 'move part of the energy system offshore to preserve land and build marine industry' : 'offshore generation spares scarce land');
    }
    // Sea-floor habitats come in two engineering regimes. Early shelf habitats are
    // surface-served pressure hulls with power/air/data umbilicals; they do NOT need
    // a magical Mars-grade closed loop. Later/deeper districts can become closed-loop.
    const closedLoop = w.inventions.some((i) => i.id.startsWith('inv-closed-loop-habitat-') && i.status === 'deployed');
    const abundantEnergy = c.energy.sources.fusion.cap > 0.5 || c.energy.marginPct > 18;
    const surfaceServed = robotics > 2.0 && c.energy.gridCondition > 0.72 && L.floating > 0.045;
    const subseaPreference = marinePreference > 0.45 || w.params.marineMult >= 1.30;
    if (marine && subseaPreference && abundantEnergy && (closedLoop || surfaceServed)
        && earned > 0.28 / Math.sqrt(Math.max(1, w.params.marineMult)) && c.economy.outputPerCapita > 1.15
        && L.floating > 0.045 && L.subseaCondition > 0.25) {
        const target = clamp(0.012 + Math.max(0, marinePreference - 0.35) * 0.11 + Math.max(0, L.pressure - 0.80) * 0.16, 0.012, 0.24);
        if (L.subsea + 0.006 < target) {
            const next = clamp(Math.max(0.010, (target - L.subsea) * 0.20), 0.010, 0.035);
            propose(w, c, 'subsea_habitat', next, L.subsea === 0
                ? (closedLoop ? 'first closed-loop pressure-hull district on the shelf floor' : 'first surface-served pressure-hull district, connected by power, air and data umbilicals')
                : (closedLoop ? 'extend deeper closed-loop subsea districts' : 'extend the surface-served shelf habitat network'));
        }
    }
    // Stratospheric platforms: buoyant structures that carry climate-control hardware and, later, people.
    const tether = w.inventions.some((i) => i.id.startsWith('inv-orbital-tether-materials-') && i.status === 'deployed');
    const planetaryEnergy = w.frontier.milestones.find((m) => m.id === 'planetary_energy')?.status === 'achieved';
    if (tether && planetaryEnergy && earned > 0.7 && c.economy.outputPerCapita > 4 && L.aerial < 0.05) {
        propose(w, c, 'aerial_platform', L.aerial === 0 ? 0.005 : 0.01, L.aerial === 0 ? 'first stratospheric platform: climate sensors, sunshade control and a few thousand residents' : 'expand the stratospheric platform network');
    }
    // Seabed mining: once minerals are dear and the machines exist. Cautious societies wait longer.
    if (marine && robotics >= 1.8 && earned > 0.5 && w.resources.mineralCostIndex > 1.15 + c.traits.regulatoryCaution * 0.35 && L.seabedInflow < 0.25) {
        propose(w, c, 'seabed_mining', L.seabedInflow === 0 ? 0.06 : 0.08, L.seabedInflow === 0 ? 'first polymetallic-nodule collector fleet on the continental rise' : 'expand seabed collection as land-based ore grades fall');
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
export function landProjectSpec(w, c, kind, capacity) {
    const L = c.land;
    const mat = w.resources.mineralCostIndex;
    const rise = seaLevelRiseM(w);
    switch (kind) {
        case 'land_reclamation': {
            const deep = L.shelf < capacity * 0.5;
            const robotics = 1 / (1 + Math.log1p(Math.max(0, w.techs.robotics_ind.cap - 1)) * 0.25);
            const capex = capacity * LAND.reclaimCapexPerUnitShallow * (deep ? LAND.reclaimDeepMultiplier : 1) * (0.7 + 0.3 * mat) * (1 + rise * 0.8) * robotics;
            return { capex: capex / Math.sqrt(w.params.marineMult), leadMonths: Math.round((deep ? LAND.reclaimDeepLeadMonths : LAND.reclaimLeadMonths) / Math.min(1.3, w.params.marineMult)) };
        }
        case 'arcology': {
            const learning = Math.pow(0.94, Math.min(6, L.vertical / 0.05));
            const complexity = 1 + Math.pow(Math.max(0, L.vertical) / 0.18, 1.35) * 0.45;
            return { capex: capacity * CALIBRATION.housing.capexPerStockPoint * 1.75 * (0.65 + 0.35 * mat) * learning * complexity / Math.sqrt(w.params.verticalMult), leadMonths: Math.round(54 * Math.sqrt(complexity) / Math.min(1.5, w.params.verticalMult)) };
        }
        case 'underground_habitat': {
            const learning = Math.pow(0.95, Math.min(6, L.underground / 0.04));
            const depthPenalty = 1 + Math.pow(Math.max(0, L.underground) / 0.12, 1.4) * 0.65;
            return { capex: capacity * CALIBRATION.housing.capexPerStockPoint * 2.25 * (0.6 + 0.4 * mat) * learning * depthPenalty / Math.sqrt(w.params.undergroundMult), leadMonths: Math.round(66 * Math.sqrt(depthPenalty) / Math.min(1.5, w.params.undergroundMult)) };
        }
        case 'floating_district': {
            const learning = Math.pow(0.90, Math.min(6, L.floating / 0.05));
            const network = 1 + Math.pow(Math.max(0, L.floating) / 0.18, 1.2) * 0.35;
            return { capex: capacity * CALIBRATION.housing.capexPerStockPoint * LAND.floatingCapexMult * (0.6 + 0.4 * mat) * learning * network / Math.sqrt(w.params.marineMult), leadMonths: Math.round(LAND.floatingLeadMonths * Math.sqrt(network)) };
        }
        case 'seabed_mining':
            return { capex: capacity * 1.8 * (0.7 + 0.3 * mat) / (1 + Math.log1p(Math.max(0, w.techs.robotics_ind.cap - 1)) * 0.2), leadMonths: 48 };
        case 'subsea_habitat': {
            const learning = Math.pow(0.94, Math.min(5, L.subsea / 0.03));
            const depthAccess = 1 + Math.pow(Math.max(0, L.subsea) / 0.08, 1.5) * 0.8;
            return { capex: capacity * CALIBRATION.housing.capexPerStockPoint * 2.4 * (0.6 + 0.4 * mat) * learning * depthAccess / Math.sqrt(w.params.marineMult), leadMonths: Math.round(60 * Math.sqrt(depthAccess)) };
        }
        case 'aerial_platform':
            return { capex: capacity * CALIBRATION.housing.capexPerStockPoint * 9 * (0.5 + 0.5 * mat), leadMonths: 72 };
        case 'offshore_energy':
            return { capex: capacity * CALIBRATION.generation.wind.capexPerGW * 1.6 * clamp(w.techs.wind_power.cost, 0.4, 1.5) * (L.floating > 0 ? 0.85 : 1), leadMonths: 30 };
        default:
            return null;
    }
}
export function applyLandCompletion(w, c, p) {
    const L = c.land;
    switch (p.kind) {
        case 'land_reclamation': {
            const fromShelf = Math.min(L.shelf, p.capacity);
            L.shelf = Math.max(0, L.shelf - fromShelf);
            L.usable += p.capacity;
            L.reclaimed += p.capacity;
            L.reclaimedCondition = Math.min(1, (L.reclaimedCondition * (L.reclaimed - p.capacity) + p.capacity) / Math.max(0.0001, L.reclaimed));
            const key = `reclaim-first-${c.id}`;
            if (!w.flags[key]) {
                w.flags[key] = true;
                addEvent(w, {
                    title: `${c.name} pushes its coastline into the sea`,
                    body: `The first reclamation programme adds ${(p.capacity * 100).toFixed(1)}% to the usable land of the federation. New districts rise on fill behind sea walls. Their pumps and dikes now need paying for as long as people live there.`,
                    category: 'economy', civId: c.id, significance: 2,
                    causes: [{ factor: 'land scarcity and high rents', weight: 0.6 }, { factor: 'fiscal capacity for decade-long works', weight: 0.4 }],
                    counterforces: [{ factor: 'sea-level rise', weight: 0.5 }], confidence: 'high',
                });
            }
            return true;
        }
        case 'arcology': {
            const first = L.vertical === 0;
            const oldCap = L.vertical;
            L.vertical += p.capacity;
            L.verticalCondition = (L.verticalCondition * oldCap + p.capacity) / Math.max(0.0001, L.vertical);
            c.housing.stockIndex += p.capacity;
            L.densityIndex = Math.min(LAND.maxDensity, L.densityIndex + Math.min(0.16, p.capacity * 0.9));
            c.housing.condition = Math.min(1, c.housing.condition + Math.min(0.07, p.capacity * 0.45));
            if (first)
                addEvent(w, {
                    title: `${c.name} builds upward instead of outward`,
                    body: `The first arcology district opens: housing, services and transit stacked into one high-density structure. It saves surface land, but makes maintenance, evacuation and power continuity more consequential.`,
                    category: 'economy', civId: c.id, significance: 2,
                    causes: [{ factor: 'land scarcity', weight: 0.55 }, { factor: 'construction automation', weight: 0.45 }],
                    counterforces: [{ factor: 'systems complexity and maintenance', weight: 0.5 }], confidence: 'medium',
                });
            return true;
        }
        case 'underground_habitat': {
            const first = L.underground === 0;
            const oldCap = L.underground;
            L.underground += p.capacity;
            L.undergroundCondition = (L.undergroundCondition * oldCap + p.capacity) / Math.max(0.0001, L.underground);
            c.housing.stockIndex += p.capacity;
            c.housing.condition = Math.min(1, c.housing.condition + Math.min(0.05, p.capacity * 0.4));
            if (first)
                addEvent(w, {
                    title: `${c.name} moves part of the city underground`,
                    body: `A permanent underground district opens beneath the existing city. Surface land is preserved, but ventilation, pumping, heat rejection and emergency access become permanent operating costs.`,
                    category: 'economy', civId: c.id, significance: 2,
                    causes: [{ factor: 'surface land pressure', weight: 0.55 }, { factor: 'robotic excavation and abundant electricity', weight: 0.45 }],
                    counterforces: [{ factor: 'high operating dependence', weight: 0.55 }], confidence: 'medium',
                });
            return true;
        }
        case 'floating_district': {
            const oldCap = L.floating;
            L.floating += p.capacity;
            L.floatingCondition = (L.floatingCondition * oldCap + p.capacity) / Math.max(0.0001, L.floating);
            c.housing.stockIndex += p.capacity;
            c.housing.condition = Math.min(1, c.housing.condition + Math.min(0.08, p.capacity * 0.6));
            const key = `floating-first-${c.id}`;
            if (!w.flags[key]) {
                w.flags[key] = true;
                addEvent(w, {
                    title: `${c.name} builds its first floating district`,
                    body: `Modular platforms moored off the harbour house the first residents of a district with no land under it. Costlier per home than building on shore, immune to sea level, and the cost falls with every platform built. (${Math.floor(yearOf(w))})`,
                    category: 'economy', civId: c.id, significance: 2,
                    causes: [{ factor: 'validated floating-platform technology', weight: 0.5 }, { factor: 'no land left to build on', weight: 0.5 }],
                    counterforces: [{ factor: 'marine maintenance costs', weight: 0.4 }], confidence: 'medium',
                });
            }
            return true;
        }
        case 'seabed_mining': {
            const first = L.seabedInflow === 0;
            L.seabedInflow += p.capacity;
            if (first)
                addEvent(w, {
                    title: `${c.name} starts mining the seabed`,
                    body: `Collector fleets begin lifting polymetallic nodules from the continental rise. Cheaper than asteroids, dirtier than recycling: plumes, lost habitat and a fight with the fishing ports. Supply from each field fades as the easy nodules go.`,
                    category: 'resources', civId: c.id, significance: 2,
                    causes: [{ factor: 'critical-mineral prices', weight: 0.6 }, { factor: 'autonomous marine robotics', weight: 0.4 }],
                    counterforces: [{ factor: 'ecological backlash', weight: 0.5 }], confidence: 'medium',
                });
            return true;
        }
        case 'subsea_habitat': {
            const first = L.subsea === 0;
            const oldCap = L.subsea;
            L.subsea += p.capacity;
            L.subseaCondition = (L.subseaCondition * oldCap + p.capacity) / Math.max(0.0001, L.subsea);
            c.housing.stockIndex += p.capacity;
            c.housing.condition = Math.min(1, c.housing.condition + Math.min(0.06, p.capacity * 0.5));
            if (first) {
                const closedLoop = w.inventions.some((i) => i.id.startsWith('inv-closed-loop-habitat-') && i.status === 'deployed');
                addEvent(w, {
                    title: `${c.name} moves under the sea`,
                    body: closedLoop
                        ? `The first pressure-hull habitat on the shelf floor opens with closed-loop life support. It is weather-proof but pressure, corrosion and maintenance never go away.`
                        : `The first pressure-hull habitat opens on the shelf floor, serviced from the surface by redundant power, air, data and emergency-access links. It is weather-proof, not infrastructure-proof.`,
                    category: 'frontier', civId: c.id, significance: 3,
                    causes: [{ factor: closedLoop ? 'closed-loop life support' : 'surface-served life support and umbilicals', weight: 0.5 }, { factor: 'abundant reliable energy', weight: 0.5 }],
                    counterforces: [{ factor: 'hull cost and maintenance', weight: 0.5 }], confidence: 'medium',
                });
            }
            return true;
        }
        case 'aerial_platform': {
            const first = L.aerial === 0;
            L.aerial += p.capacity;
            c.housing.stockIndex += p.capacity;
            if (first)
                addEvent(w, {
                    title: `${c.name} raises a platform into the stratosphere`,
                    body: `A buoyant platform holds station above the weather, carrying sensors, infrastructure and a small permanent crew. The sky is now inhabited too.`,
                    category: 'frontier', civId: c.id, significance: 3,
                    causes: [{ factor: 'advanced structural materials', weight: 0.5 }, { factor: 'high energy and maintenance capacity', weight: 0.5 }],
                    counterforces: [{ factor: 'cost per resident', weight: 0.6 }], confidence: 'medium',
                });
            return true;
        }
        case 'offshore_energy': {
            const src = c.energy.sources.wind;
            const old = src.cap;
            src.cap += p.capacity;
            src.condition = Math.min(1, (src.condition * old + p.capacity) / Math.max(0.001, src.cap));
            src.avgAgeYears = (src.avgAgeYears * old) / Math.max(0.001, src.cap);
            L.offshoreGW += p.capacity;
            return true;
        }
        default:
            return false;
    }
}
