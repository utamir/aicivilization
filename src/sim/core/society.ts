// ─────────────────────────────────────────────────────────────────────────────
// SOCIETY — the things that happen to people between the technology and the
// numbers. Each block is small, state-driven and leaves a trace in the
// chronicle. Where a choice matters, a decision card (decisions.ts) fires.
//
//   synthetic births   IVG + ectogenesis; a birth programme when the pyramid fails
//   fertility contagion norms travel with trade and media; cohesion resists
//   conflict            tension from scarcity and grievance; sanctions, blockade, war
//   pandemic            urban, connected, warm worlds get more of them
//   gerontocracy        a very old polity slows its institutions and loses its young
//   brain drain         research capacity follows the migrants
//   enhancement         germline enhancement, public or private, and what it does to inequality
//   secession           a polity below stability 0.15 fragments
//   cultural revival    fertility can come back by norm, not by money
//   drought             the food system's climate failure mode
//   AI incident         a post-AGI accident and the backlash it earns
//   solar storm         a grid-scale hazard the fleet either survives or does not
//   post-biological     zero births, a billion minds: the model states what it is
// ─────────────────────────────────────────────────────────────────────────────
import type { WorldState, CivState, CivId } from '../types';
import { addEvent, yearOf } from './step';
import { clamp, lerp } from './formulas';
import { civDef } from '../data/civDefs';
import { nextFloat } from '../rng';

const DT = 1 / 12;
const deployed = (w: WorldState, prefix: string) => w.inventions.some((i) => i.id.startsWith(`inv-${prefix}-`) && i.status === 'deployed');
const rnd = (w: WorldState) => nextFloat(w.rng);
const rel = (w: WorldState, a: CivId, b: CivId) => w.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))!;

export function stepSocietyDynamics(w: WorldState) {
  for (const c of w.civs) {
    syntheticBirths(w, c);
    contagion(w, c);
    gerontocracy(w, c);
    secession(w, c);
    revival(w, c);
    postBiological(w, c);
  }
  conflict(w);
  pandemic(w);
  drought(w);
  aiIncident(w);
  solarStorm(w);
  brainDrain(w);
  continuityAndRecovery(w);
}


// ── Collapse, abandonment and resettlement ───────────────────────────────────
function earthPhysical(c: CivState): number {
  return Math.max(0, (c.population.total - c.population.offworld) * (1 - c.population.digitalShare));
}

// Move embodied Earth residents between polities without silently changing their
// substrate. digitalShare is an overlapping fraction of total population, so a
// plain total -= flow / total += flow would incorrectly turn embodied settlers
// into digital minds at the recipient's pre-existing ratio. Preserve the absolute
// number of digital persons in both polities while moving only embodied people.
function transferEmbodiedPeople(donor: CivState, recipient: CivState, requestedM: number): number {
  const donorEarth = earthPhysical(donor);
  const flow = clamp(requestedM, 0, donorEarth);
  if (flow <= 0) return 0;
  const donorDigitalM = donor.population.total * clamp(donor.population.digitalShare, 0, 1);
  const recipientDigitalM = recipient.population.total * clamp(recipient.population.digitalShare, 0, 1);
  donor.population.total = Math.max(0, donor.population.total - flow);
  recipient.population.total += flow;
  donor.population.digitalShare = donor.population.total > 1e-9 ? clamp(donorDigitalM / donor.population.total, 0, 1) : 0;
  recipient.population.digitalShare = recipient.population.total > 1e-9 ? clamp(recipientDigitalM / recipient.population.total, 0, 1) : 0;
  return flow;
}

function continuityAndRecovery(w: WorldState) {
  const allLiving = w.civs.reduce((a, c) => a + c.population.total, 0);
  // Below 1,000 embodied residents the old territorial state is treated as gone.
  // A return is not considered a functioning resettlement until at least 10,000
  // embodied residents are present; this prevents a handful of returnees from
  // flipping an entire territory between abandoned/resettling every month.
  const ABANDONMENT_M = 0.001;
  const RESETTLEMENT_M = 0.010;
  for (const c of w.civs) {
    const s = c.society;
    let earth = earthPhysical(c);

    // Literal extinction is literal. No demographic or institutional floor is
    // allowed to recreate people after the last biological/digital/off-world
    // population has disappeared.
    if (c.population.total <= 1e-6) {
      c.population.total = 0;
      c.population.offworld = 0;
      c.population.digitalShare = 0;
      s.polityStatus = 'abandoned';
      s.stability = Math.min(s.stability, 0.02);
      c.economy.institutionalCapacity = Math.min(c.economy.institutionalCapacity, 0.02);
      s.autonomousInfrastructure *= 1 - 0.035 * DT;
      continue;
    }

    if (earth < ABANDONMENT_M) {
      if (s.polityStatus !== 'abandoned') {
        s.polityStatus = 'abandoned';
        addEvent(w, {
          title: `${c.name} is abandoned`,
          body: `Fewer than a thousand embodied residents remain on the territory. The polity no longer operates as an Earth-based state. Buildings, roads and grids persist for a while; maintenance and street life do not.`,
          category: 'milestone', civId: c.id, significance: 3,
          causes: [{ factor: 'territorial depopulation', weight: 1 }],
          counterforces: [{ factor: 'survivors elsewhere may later resettle', weight: 0.5 }], confidence: 'high',
        });
      }
      s.stability = Math.max(0.01, s.stability * (1 - 0.035 * DT));
      c.economy.institutionalCapacity = Math.max(0.01, c.economy.institutionalCapacity * (1 - 0.04 * DT));

      // Recovery can come from three real survivor reservoirs. None create
      // population: they only move existing people/minds back onto the territory.
      if (allLiving > 1e-6 && w.params.recoveryMult > 0.25) {
        // 1) return migration from this civilization's own off-world population.
        if (c.population.offworld > 0.01 && c.space.habitatCapacityM > 0.02) {
          const back = Math.min(c.population.offworld, Math.max(0, c.population.offworld * 0.0025 * w.params.recoveryMult * DT));
          c.population.offworld -= back;
        }

        // 2) embodiment of digital survivors, but only if advanced robotics,
        // biotech and autonomous infrastructure still exist.
        earth = earthPhysical(c);
        if (earth < RESETTLEMENT_M && c.population.digitalShare > 0.25 && w.techs.robotics_gp.cap > 2.4 && w.techs.biotech_med.cap > 1.8 && s.autonomousInfrastructure > 0.35) {
          const embodied = Math.min(c.population.total * c.population.digitalShare, Math.max(0, c.population.total * 0.0012 * w.params.recoveryMult * DT));
          if (embodied > 0) c.population.digitalShare = clamp(c.population.digitalShare - embodied / Math.max(1e-9, c.population.total), 0, 1);
        }

        // 3) resettlement by a surviving neighboring polity. This is migration,
        // not respawn: every settler is removed from the donor population.
        earth = earthPhysical(c);
        if (earth < RESETTLEMENT_M) {
          const donor = w.civs
            .filter((o) => o.id !== c.id && o.society.polityStatus === 'active' && earthPhysical(o) > 1 && o.society.stability > 0.38 && o.economy.institutionalCapacity > 0.34)
            .sort((a, b) => (b.society.stability + b.economy.outputPerCapita * 0.1) - (a.society.stability + a.economy.outputPerCapita * 0.1))[0];
          if (donor) {
            const donorEarth = earthPhysical(donor);
            // A return expedition has to be large enough to operate utilities,
            // clinics, schools and emergency services. The old 1,500-person cap
            // produced an artificial abandoned/resettling oscillation around the
            // 1,000-person abandonment threshold. Seed a small but viable town;
            // every person is still removed from the donor population.
            const flow = Math.min(0.025, donorEarth * 0.0006 * w.params.recoveryMult * DT);
            transferEmbodiedPeople(donor, c, flow);
          }
        }
      }

      earth = earthPhysical(c);
      if (earth >= RESETTLEMENT_M) {
        s.polityStatus = 'resettling';
        s.stability = Math.max(s.stability, 0.12);
        s.basicProvision = Math.max(s.basicProvision, 0.12);
        addEvent(w, {
          title: `${c.name} is being resettled`,
          body: `People are living on the abandoned territory again. They inherit roads, ruins, contaminated sites and whatever infrastructure survived. Recovery now depends on whether they can rebuild provision and institutions faster than the old systems decay.`,
          category: 'society', civId: c.id, significance: 3,
          causes: [{ factor: 'surviving population returned or migrated in', weight: 1 }],
          counterforces: [{ factor: 'decayed infrastructure and rewilded land', weight: 0.5 }], confidence: 'high',
        });
      }
      continue;
    }

    if (s.polityStatus === 'resettling') {
      // Planned resettlement is a migration process, not a one-off teleport. If
      // a viable neighboring polity exists it can keep sending a few thousand
      // people per month until the settlement is large enough to support a local
      // state. Donor population is conserved exactly.
      if (earth < 0.12 && w.params.recoveryMult > 0.25) {
        const donor = w.civs
          .filter((o) => o.id !== c.id && o.society.polityStatus === 'active' && earthPhysical(o) > 1 && o.society.stability > 0.38 && o.economy.institutionalCapacity > 0.34)
          .sort((a, b) => (b.society.stability + b.economy.outputPerCapita * 0.1) - (a.society.stability + a.economy.outputPerCapita * 0.1))[0];
        if (donor) {
          const donorEarth = earthPhysical(donor);
          const shortfall = Math.max(0, 0.12 - earth);
          const flow = Math.min(shortfall, 0.010, donorEarth * 0.00012 * w.params.recoveryMult * DT);
          transferEmbodiedPeople(donor, c, flow);
          earth = earthPhysical(c);
        }
      }
      s.stability = lerp(s.stability, 0.50, 0.010 * w.params.recoveryMult);
      c.economy.institutionalCapacity = lerp(c.economy.institutionalCapacity, 0.46, 0.004 * w.params.recoveryMult);
      s.basicProvision = lerp(s.basicProvision, 0.55, 0.006 * w.params.recoveryMult);
      if (earth > 0.10 && s.stability > 0.30 && c.economy.institutionalCapacity > 0.28) {
        s.polityStatus = 'active';
        addEvent(w, {
          title: `${c.name} restores a functioning polity`,
          body: `Resettlement has passed the survival phase. A working local state, grid and basic services exist again, though much of the old built environment remains ruined or reclaimed by nature.`,
          category: 'milestone', civId: c.id, significance: 3,
          causes: [{ factor: 'sustained resettlement and institutional recovery', weight: 1 }], counterforces: [], confidence: 'medium',
        });
      }
      continue;
    }

    // A failed state is not a one-way absorbing state if people, food and an energy
    // base survive. High recovery capacity represents institutional memory, outside
    // assistance and the ability to rebuild basic administration. It cannot rescue an
    // actively starving/blackout society and it never creates population.
    if (s.polityStatus === 'failed' && w.params.recoveryMult > 1 && c.population.total > 0.05 && c.food.shortage < 0.12 && c.energy.marginPct > -25 && s.basicProvision > 0.10) {
      const rehab = clamp((w.params.recoveryMult - 1) * 0.0025 * DT, 0, 0.012);
      s.stability = lerp(s.stability, 0.40, rehab);
      c.economy.institutionalCapacity = lerp(c.economy.institutionalCapacity, 0.36, rehab * 0.8);
    }

    if (s.stability < 0.16 && c.economy.institutionalCapacity < 0.18) s.polityStatus = 'failed';
    else if (s.polityStatus === 'failed' && s.stability > 0.34 && c.economy.institutionalCapacity > 0.30) s.polityStatus = 'active';
  }
}

// ── Synthetic births ────────────────────────────────────────────────────────
export function syntheticBirthsAvailable(w: WorldState): boolean {
  return deployed(w, 'in-vitro-gametogenesis') && deployed(w, 'full-ectogenesis');
}
function syntheticBirths(_w: WorldState, c: CivState) {
  const s = c.society;
  if (s.syntheticProgram === 'none' || s.syntheticProgram === 'ban') return;
  const p = c.population;
  const replacementBirths = p.total * 0.012; // births/yr that would hold an old pyramid roughly level
  const natural = p.birthRate * p.total;
  let programme = 0;
  if (s.syntheticProgram === 'state' || s.syntheticProgram === 'both') programme += Math.max(0, replacementBirths - natural) * 0.7;
  if (s.syntheticProgram === 'family' || s.syntheticProgram === 'both') programme += p.total * 0.0025 * clamp(c.economy.outputPerCapita / 2, 0.2, 1.5);
  const born = programme * DT;
  p.cohorts[0] += born; p.total += born;
  s.syntheticBirthsPerYear = programme;
  // Raising a cohort of children with no parents costs money and, for a while, trust.
  c.economy.publicDebt += programme / Math.max(1, c.economy.output * 30) * DT;
  s.trust = clamp(s.trust - born * 0.002 / Math.max(0.05, p.total) * 60, 0.05, 1);
}

// ── Fertility contagion ─────────────────────────────────────────────────────
function contagion(w: WorldState, c: CivState) {
  const others = w.civs.filter((o) => o.id !== c.id);
  let pull = 0, weight = 0;
  for (const o of others) {
    const r = rel(w, c.id, o.id);
    const link = (r.tradeOpenness * 0.5 + r.sciCollaboration * 0.5) * c.traits.openness;
    pull += (o.population.fertility - c.population.fertility) * link; weight += link;
  }
  if (weight <= 0) return;
  // Norms travel; cohesive cultures resist. Speed: a generation to close half the gap at full exposure.
  const rate = 0.0015 * (1 - civDef(c.id).culturalCohesion) * weight;
  c.population.fertility = lerp(c.population.fertility, c.population.fertility + pull / weight, rate);
}

// ── Conflict ────────────────────────────────────────────────────────────────
function conflict(w: WorldState) {
  for (const r of w.relations) {
    const a = w.civs.find((c) => c.id === r.a)!, b = w.civs.find((c) => c.id === r.b)!;
    const scarcity = Math.max(0, w.resources.mineralCostIndex - 1.3) * 0.4 + Math.max(0, w.resources.fossilCostIndex - 1.5) * 0.3 + Math.max(a.food.shortage, b.food.shortage) * 1.5 + Math.max(0, Math.max(a.land.pressure, b.land.pressure) - 0.95) * 2;
    const grievance = Math.abs(a.society.stability - b.society.stability) * 0.3 + (r.grievances.length * 0.05);
    const autonomy = (a.traits.strategicAutonomy + b.traits.strategicAutonomy) * 0.15;
    const ties = r.tradeOpenness * 0.4 + r.sciCollaboration * 0.3 + Math.max(0, r.relation) * 0.3;
    const target = clamp(scarcity + grievance + autonomy - ties, 0, 1);
    r.tension = lerp(r.tension, target, 0.02);
    const key = `war-${r.a}-${r.b}`;
    const war = w.conflicts.find((k) => k.a === r.a && k.b === r.b);
    if (war) {
      war.months += 1;
      for (const c of [a, b]) {
        // capacity destroyed, trade cut, mortality, debt, trust; the weaker side loses more
        const share = c.society.stability < (c === a ? b : a).society.stability ? 1.4 : 0.8;
        for (const k of Object.keys(c.energy.sources) as (keyof typeof c.energy.sources)[]) c.energy.sources[k].cap *= 1 - 0.004 * share * DT * 12;
        c.housing.stockIndex *= 1 - 0.006 * share * DT * 12; c.housing.condition = clamp(c.housing.condition - 0.01 * DT * 12, 0.2, 1);
        c.economy.publicDebt += 0.06 * DT * 12; c.economy.capexAvailability *= 1 - 0.01 * DT * 12;
        c.society.trust = clamp(c.society.trust - 0.006 * DT * 12, 0.05, 1);
        c.population.total *= 1 - 0.0025 * share * DT * 12; // war dead; reconciled into the cohorts by demography
      }
      r.tradeOpenness = Math.min(r.tradeOpenness, 0.1); r.sciCollaboration = Math.min(r.sciCollaboration, 0.05); r.relation = Math.min(r.relation, -0.6);
      // wars end by exhaustion or by the observer
      if (war.months > 24 && (a.society.stability < 0.2 || b.society.stability < 0.2 || rnd(w) < 0.02)) {
        w.conflicts = w.conflicts.filter((k) => k !== war);
        r.tension = 0.35; r.grievances.push(`war of ${Math.floor(yearOf(w))}`);
        addEvent(w, { title: `Ceasefire between ${a.name} and ${b.name}`, body: `${war.months} months of war end in exhaustion. Grids, housing and trust are damaged on both sides; the grievance stays.`, category: 'milestone', significance: 3, causes: [{ factor: 'exhaustion', weight: 1 }], counterforces: [], confidence: 'high' });
      }
      continue;
    }
    const busy = w.conflicts.some((k) => [k.a, k.b].includes(r.a) || [k.a, k.b].includes(r.b));
    if (r.tension > 0.72 && !w.flags[key] && w.tMonths % 3 === 0 && !busy && !w.pendingConflict.length) {
      w.flags[key] = true; // the decision card (decisions.ts: 'conflict') takes it from here
      w.pendingConflict.push({ a: r.a, b: r.b });
    }
    if (r.tension < 0.5) w.flags[key] = false;
  }
}
export function startWar(w: WorldState, a: CivId, b: CivId) {
  if (w.conflicts.some((k) => (k.a === a && k.b === b) || (k.a === b && k.b === a))) return;
  w.conflicts.push({ a, b, months: 0, startedAt: w.tMonths });
  const A = w.civs.find((c) => c.id === a)!, B = w.civs.find((c) => c.id === b)!;
  addEvent(w, { title: `War between ${A.name} and ${B.name}`, body: `Blockade turns to strikes on grids and ports. Every month costs capacity, homes, money and lives on both sides.`, category: 'milestone', significance: 3, causes: [{ factor: 'scarcity and grievance', weight: 0.7 }, { factor: 'failed negotiation', weight: 0.3 }], counterforces: [], confidence: 'high' });
}

// ── Pandemic ────────────────────────────────────────────────────────────────
function pandemic(w: WorldState) {
  const P = w.pandemic;
  if (P) {
    P.months += 1;
    for (const c of w.civs) {
      const exposure = c.population.urbanization * (0.6 + w.relations.reduce((a, r) => a + r.tradeOpenness, 0) / w.relations.length) * (1 - c.society.lockdown * 0.7);
      const kill = P.severity * exposure * 0.004 * DT * 12; // share of population per year at peak
      // the old die first: weight the top bands
      const co = c.population.cohorts; let dead = 0;
      for (let i = 0; i < co.length; i++) { const wgt = i >= 13 ? 3 : i >= 10 ? 1.2 : 0.5; const d = co[i] * kill * wgt; co[i] -= d; dead += d; }
      c.population.total -= dead;
      c.economy.capexAvailability *= 1 - c.society.lockdown * 0.02 * DT * 12; c.economy.output *= 1 - c.society.lockdown * 0.015 * DT * 12;
      c.society.trust = clamp(c.society.trust - 0.003 * DT * 12 * (1 - c.economy.institutionalCapacity), 0.05, 1);
    }
    const bio = w.techs.biotech_med.cap;
    if (P.months > 18 + 12 / Math.max(0.5, bio) || rnd(w) < 0.01 * bio) {
      w.pandemic = null;
      for (const c of w.civs) c.society.lockdown = 0;
      addEvent(w, { title: 'The pandemic ends', body: `After ${P.months} months, vaccines and immunity end it. ${(w.civs.reduce((a, c) => a + c.population.deathRate, 0) / 3 * 1000).toFixed(0)} deaths per thousand at the peak year.`, category: 'milestone', significance: 3, causes: [{ factor: 'biotech capability', weight: 1 }], counterforces: [], confidence: 'high' });
    }
    return;
  }
  // hazard: urban, connected, warmer worlds; biotech both raises (engineered) and lowers (surveillance) it
  const urban = w.civs.reduce((a, c) => a + c.population.urbanization, 0) / 3;
  const trade = w.relations.reduce((a, r) => a + r.tradeOpenness, 0) / w.relations.length;
  // Natural pandemic pressure is the empirically anchored part of this mechanism.
  // Deliberate/accidental engineered outbreaks are kept as a separate, explicitly
  // speculative stress-test prior: capability raises exposure slowly (log scale),
  // biosecurity strongly suppresses it, and the annualized hazard is capped. No
  // published evidence calibrates a precise future engineered-pandemic probability.
  const biosecurity = Math.max(0.35, w.params.biosecurity);
  const natural = 0.025 * (0.5 + urban) * (0.6 + trade) * (1 + Math.max(0, w.env.warmingC - 1.5) * 0.3) / ((1 + Math.max(0, w.techs.biotech_med.cap - 1) * 0.3) * biosecurity);
  const bioCapability = clamp(Math.log2(Math.max(1, w.techs.biotech_med.cap)), 0, 10);
  const engineered = Math.min(0.012, 0.0008 * (1 + bioCapability * 0.18) * (0.75 + trade * 0.5) / Math.pow(biosecurity, 1.6));
  const hazard = natural + engineered;
  if (rnd(w) < hazard * DT) {
    const engineeredOrigin = rnd(w) < engineered / Math.max(1e-9, hazard);
    const severity = (0.5 + rnd(w) * 1.5) / Math.sqrt(Math.max(0.5, biosecurity));
    w.pandemic = { months: 0, severity, startedAt: w.tMonths };
    w.pendingPandemic = true;
    addEvent(w, {
      title: engineeredOrigin ? 'A biosecurity failure becomes a pandemic' : 'A new pandemic',
      body: engineeredOrigin
        ? `A laboratory/synthesis-linked respiratory pathogen escapes containment and spreads through the ports. Severity ${severity.toFixed(1)}. The origin is a scenario stress test, not a calibrated forecast.`
        : `A respiratory pathogen spreads through the ports. Severity ${severity.toFixed(1)}. The old are most at risk.`,
      category: 'milestone', significance: 3,
      causes: engineeredOrigin
        ? [{ factor: 'biosynthesis capability and access', weight: 0.45 }, { factor: 'biosecurity failure', weight: 0.35 }, { factor: 'connected travel network', weight: 0.20 }]
        : [{ factor: 'urban density and trade', weight: 0.6 }, { factor: 'warming', weight: 0.2 }, { factor: 'chance', weight: 0.2 }],
      counterforces: [{ factor: 'biosecurity, surveillance and biotech response', weight: 0.6 }], confidence: engineeredOrigin ? 'low' : 'medium',
    });
  }
}

// ── Gerontocracy ────────────────────────────────────────────────────────────
function gerontocracy(w: WorldState, c: CivState) {
  // Age that matters is biological, not chronological: with slower aging a median of 95 at LE 130 behaves like ~65.
  const effectiveMedian = c.population.medianAge - Math.max(0, c.population.lifeExpectancy - 80) * 0.6;
  const old = Math.max(0, effectiveMedian - 60) / 30; // 0 at 60, 1 at 90
  if (old <= 0) return;
  // institutions get careful and slow; the young leave for younger places
  c.economy.institutionalCapacity = clamp(c.economy.institutionalCapacity - old * 0.004 * DT, 0.1, 1);
  c.traits.riskTolerance = clamp(c.traits.riskTolerance - old * 0.002 * DT, 0.1, 1);
  c.economy.capexAvailability *= 1 - old * 0.002 * DT;
  const youngest = w.civs.reduce((y, o) => (o.population.medianAge < y.population.medianAge ? o : y), c);
  if (youngest !== c) {
    const co = c.population.cohorts; let moved = 0;
    for (let i = 3; i < 8; i++) { const m = co[i] * old * 0.004 * DT; co[i] -= m; moved += m; } // 15–39 leave
    c.population.total -= moved; youngest.population.total += moved;
  }
  const key = `geront-${c.id}`;
  if (effectiveMedian > 70 && !w.flags[key]) {
    w.flags[key] = true;
    addEvent(w, { title: `${c.name} becomes a gerontocracy`, body: `Median age ${c.population.medianAge.toFixed(0)}. The electorate is old, the institutions careful, capital patient to the point of stillness. The young are leaving for younger places.`, category: 'society', civId: c.id, significance: 2, causes: [{ factor: 'longevity and low fertility', weight: 1 }], counterforces: [{ factor: 'synthetic births, immigration', weight: 0.5 }], confidence: 'medium' });
  }
}

// ── Brain drain ─────────────────────────────────────────────────────────────
function brainDrain(w: WorldState) {
  // research capacity follows people: the polity losing population fastest to migration also loses its labs
  for (const c of w.civs) {
    const m = w.metrics; const ago = m[Math.max(0, m.length - 13)];
    if (!ago) continue;
    const loss = (ago.population[c.id] - c.population.total) / Math.max(1, ago.population[c.id]);
    if (loss > 0.01 && c.society.stability < 0.45) {
      const drain = clamp(loss * 0.5 * DT, 0, 0.02); // monthly: a polity losing 10%/yr of its people loses ~5%/yr of its labs
      c.researchCapacity *= 1 - drain;
      const best = w.civs.reduce((y, o) => (o.society.stability > y.society.stability ? o : y), c);
      if (best !== c) best.researchCapacity *= 1 + drain * 0.6;
    }
  }
}

// ── Secession ───────────────────────────────────────────────────────────────
function secession(w: WorldState, c: CivState) {
  const key = `fragment-${c.id}`;
  if (c.society.stability < 0.15 && !c.society.fragmented) {
    c.society.lowStabilityMonths += 1;
    if (c.society.lowStabilityMonths > 36) {
      c.society.fragmented = true; w.flags[key] = true;
      c.economy.institutionalCapacity *= 0.6; c.economy.output *= 0.85; c.researchCapacity *= 0.7;
      addEvent(w, { title: `${c.name} fragments`, body: `Three years below stability 15%. The federation breaks into regions that stop paying each other, stop sharing a grid and stop pretending to a common budget.`, category: 'milestone', civId: c.id, significance: 3, causes: [{ factor: 'state failure', weight: 1 }], counterforces: [], confidence: 'high' });
    }
  } else if (c.society.stability > 0.3) {
    c.society.lowStabilityMonths = 0;
    if (c.society.fragmented && c.society.stability > 0.5 && c.economy.institutionalCapacity > 0.5) {
      c.society.fragmented = false;
      addEvent(w, { title: `${c.name} reunites`, body: `A generation later the regions federate again around a working grid and a common budget.`, category: 'milestone', civId: c.id, significance: 3, causes: [{ factor: 'restored stability', weight: 1 }], counterforces: [], confidence: 'medium' });
    }
  }
}

// ── Cultural revival ────────────────────────────────────────────────────────
function revival(w: WorldState, c: CivState) {
  const key = `revival-${c.id}`;
  const cohesion = civDef(c.id).culturalCohesion;
  if (!w.flags[key] && c.population.fertility < 1.35 && w.tMonths % 12 === 0 && rnd(w) < 0.02 * cohesion) {
    w.flags[key] = true; c.society.revivalMonths = 240;
    addEvent(w, { title: `${c.name}: a pro-natal movement`, body: `Not a subsidy: a norm. Communities that value children grow while the rest of the polity shrinks. Fertility rises for a generation.`, category: 'society', civId: c.id, significance: 2, causes: [{ factor: 'cultural cohesion', weight: 1 }], counterforces: [{ factor: 'contagion of low fertility from partners', weight: 0.5 }], confidence: 'low' });
  }
  if (c.society.revivalMonths > 0) { c.society.revivalMonths -= 1; c.population.fertility = lerp(c.population.fertility, c.population.fertility + 0.45, 0.004); }
}

// ── Drought ─────────────────────────────────────────────────────────────────
function drought(w: WorldState) {
  if (w.drought) {
    w.drought.months -= 1;
    for (const c of w.civs) { c.food.landYield *= 1 - 0.02 * DT * 12 * civDef(c.id).food.climateSensitivity; }
    if (w.drought.months <= 0) { w.drought = null; for (const c of w.civs) c.food.landYield *= 1.12; }
    return;
  }
  const hazard = 0.06 * Math.max(0, w.env.warmingC - 1.3) * w.params.climateSensitivity / Math.max(0.5, w.params.climateAdaptation);
  if (rnd(w) < hazard * DT) {
    w.drought = { months: 12 + Math.floor(rnd(w) * 24) };
    addEvent(w, { title: 'Multi-year drought', body: `Reservoirs fall and the harvest fails in the exposed plains. ${(w.drought.months / 12).toFixed(1)} years of it; indoor farming and desalination are the only buffers.`, category: 'environment', significance: 2, causes: [{ factor: 'warming', weight: 1 }], counterforces: [{ factor: 'artificial food', weight: 0.6 }], confidence: 'medium' });
  }
}

// ── AI incident ─────────────────────────────────────────────────────────────
function aiIncident(w: WorldState) {
  if (!w.frontier.agi || w.flags['ai-incident']) return;
  if (w.tMonths % 12 === 0 && rnd(w) < 0.03 / Math.max(0.5, w.params.aiSafety)) {
    w.flags['ai-incident'] = true;
    for (const c of w.civs) { c.society.backlash = clamp(c.society.backlash + 0.15 * (1 - c.traits.riskTolerance), 0, 1); w.techs.ai_agents.adoption[c.id].penetration *= 0.85; }
    w.pendingAiIncident = true;
    addEvent(w, { title: 'An automated system fails at scale', body: 'A logistics and grid-dispatch agent cascade takes a region dark for a week. Nobody dies of it; everybody notices. Adoption stalls; the question of oversight is open.', category: 'technology', significance: 3, causes: [{ factor: 'autonomy without oversight', weight: 1 }], counterforces: [{ factor: 'verification stacks', weight: 0.6 }], confidence: 'medium' });
  }
}

// ── Solar storm ─────────────────────────────────────────────────────────────
function solarStorm(w: WorldState) {
  if (w.tMonths % 12 !== 0 || rnd(w) > 0.008) return; // Carrington-class every ~125 years
  for (const c of w.civs) {
    const hardened = clamp(c.economy.institutionalCapacity * 0.6 + w.techs.storage_batt.adoption[c.id].penetration * 0.4, 0.2, 1);
    const loss = 0.25 * (1 - hardened);
    c.energy.gridCapGW *= 1 - loss;
    c.compute.accelStock *= 1 - loss * 0.3;
  }
  addEvent(w, { title: 'A Carrington-class solar storm', body: 'Transformers burn where the grid was not hardened. Weeks of outage in the worst-run regions, a day in the best.', category: 'energy', significance: 3, causes: [{ factor: 'space weather', weight: 1 }], counterforces: [{ factor: 'grid hardening and institutions', weight: 1 }], confidence: 'high' });
}

// ── Post-biological polity ──────────────────────────────────────────────────
function postBiological(w: WorldState, c: CivState) {
  const key = `postbio-${c.id}`;
  if (!w.flags[key] && c.population.digitalShare > 0.5 && c.population.birthRate < 0.001) {
    w.flags[key] = true;
    addEvent(w, { title: `${c.name} is a post-biological polity`, body: `More than half its people are digital minds and almost nobody is born. The model's position: it is still a civilization as long as it keeps institutions, an economy and a future it is working toward; the metric that stops meaning anything is population.`, category: 'milestone', civId: c.id, significance: 3, causes: [{ factor: 'digital minds and low fertility', weight: 1 }], counterforces: [], confidence: 'low' });
  }
}
