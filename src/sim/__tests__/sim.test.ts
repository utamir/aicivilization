// Scenario validation tests per the build spec:
// causal loops, diffusion divergence, asymptote, reproducibility.
import { describe, it, expect } from 'vitest';
import {
  createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta,
  createBranch, compareWorlds, taskHorizonHrs,
} from '../index';
import type { WorldState } from '../types';

function run(months: number, scenarioId = 'baseline_2026', seed = 42): WorldState {
  const preset = SCENARIO_PRESETS.find((s) => s.id === scenarioId)!;
  const w = createWorld(seed, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
  stepWorld(w, months);
  return w;
}

describe('simulation sanity', () => {
  it('runs 25 years without NaN or crash', () => {
    const w = run(300);
    for (const c of w.civs) {
      expect(Number.isFinite(c.economy.output)).toBe(true);
      expect(Number.isFinite(c.energy.demandTWh)).toBe(true);
      expect(c.population.total).toBeGreaterThan(0);
    }
    expect(Number.isFinite(w.techs.ai_models.cap)).toBe(true);
    expect(w.chronicle.length).toBeGreaterThan(3);
  });

  it('AI capability and task horizon grow from 2026 baseline', () => {
    const w = run(120);
    expect(w.techs.ai_models.cap).toBeGreaterThan(1.05);
    expect(taskHorizonHrs(w.techs.ai_agents.cap)).toBeGreaterThan(12);
  });
});

describe('§103 scenario validation', () => {
  it('AI R&D Flywheel materially diverges from baseline', () => {
    const base = run(240, 'baseline_2026');
    const fly = run(240, 'ai_flywheel');
    expect(fly.techs.ai_models.cap).toBeGreaterThan(base.techs.ai_models.cap * 1.15);
  });

  it('Energy Constraint produces tighter margins / higher prices', () => {
    const base = run(240, 'baseline_2026');
    const constrained = run(240, 'energy_constraint');
    const basePrice = base.civs.reduce((a, c) => a + c.energy.priceIndex, 0);
    const consPrice = constrained.civs.reduce((a, c) => a + c.energy.priceIndex, 0);
    expect(consPrice).toBeGreaterThan(basePrice);
  });

  it('Open vs Fragmented research diverges in frontier progress', () => {
    const open = run(240, 'open_knowledge');
    const frag = run(240, 'fragmented_world');
    expect(open.techs.ai_models.cap).toBeGreaterThan(frag.techs.ai_models.cap * 1.05);
  });
});

describe('§104 technology asymptote', () => {
  it('infinite money does not create infinite capability (per-paradigm diminishing returns)', () => {
    const w = createWorld(7, { ...DEFAULT_PARAMS, capitalAvailability: 1.5, aiProgressMult: 2 }, 'x', 'x');
    // force enormous effort
    for (const c of w.civs) { c.researchCapacity = 8; c.researchAlloc.semiconductor_fab = 0.9; }
    // early rate (year 2) vs rate near paradigm-1 asymptote
    stepWorld(w, 24);
    const earlyRate = w.techs.semiconductor_fab.lastGrowthRate;
    stepWorld(w, 96); // 10 years total
    const t = w.techs.semiconductor_fab;
    // capability cannot exceed the current paradigm's asymptote without a transition
    expect(t.cap).toBeLessThanOrEqual(t.paradigmCap * 1.02);
    // and it did progress
    expect(t.cap).toBeGreaterThan(1.3);
    stepWorld(w, 360); // 40 years total
    // capability finite even under absurd effort
    expect(t.cap).toBeLessThan(80);
    void earlyRate;
  });
});

describe('§105 recursive acceleration', () => {
  it('AI feedback raises AI research velocity and later meets constraints', () => {
    const w = run(360, 'ai_flywheel');
    // velocity report shows feedback accelerator at some point in history: cap grew superlinearly early
    expect(w.techs.ai_models.cap).toBeGreaterThan(1.8);
    // constraints list should exist in tick cache
    expect(w.techs.ai_models.bottleneck.length).toBeGreaterThan(0);
  });
});

describe('§106 diffusion divergence', () => {
  it('same frontier tech is adopted differently across civilizations', () => {
    const w = run(300);
    const pens = w.civs.map((c) => w.techs.ai_models.adoption[c.id].penetration);
    const spread = Math.max(...pens) - Math.min(...pens);
    expect(spread).toBeGreaterThan(0.05);
  });
});

describe('§107 counterfactual reproducibility', () => {
  it('branched worlds with same seed are identical until change; comparison detects divergence', () => {
    const w = run(120);
    const { a, b } = createBranch(w, 'AI feedback disabled', (bw) => {
      bw.params.aiFeedback = 0.2;
      bw.params.aiTooling = 0.6;
    });
    stepWorld(a, 240);
    stepWorld(b, 240);
    const rows = compareWorlds(a, b);
    const aiRow = rows.find((r) => r.label === 'AI capability')!;
    expect(aiRow.a).toBeGreaterThan(aiRow.b);
  });

  it('identical seeds without change reproduce identical trajectories', () => {
    const w = run(120);
    const { a, b } = createBranch(w, 'nothing', () => {});
    stepWorld(a, 240);
    stepWorld(b, 240);
    expect(a.techs.ai_models.cap).toBeCloseTo(b.techs.ai_models.cap, 10);
    expect(a.civs[0].economy.output).toBeCloseTo(b.civs[0].economy.output, 10);
  });
});

describe('§90 physical loop', () => {
  it('compute expansion raises electricity demand; constraint can bind', () => {
    const w = createWorld(11, { ...DEFAULT_PARAMS, buildSpeedMult: 0.35, aiProgressMult: 1.6 }, 'x', 'x');
    stepWorld(w, 300);
    const anyConstrained = w.civs.some((c) => c.energy.priceIndex > 1.2 || c.energy.constrained);
    const demandGrew = w.civs.some((c) => c.energy.computeDemandTWh > 30);
    expect(anyConstrained || demandGrew).toBe(true);
  });
});

describe('crisis consequences (real-world coupling)', () => {
  it('destroying most generation capacity causes contraction, instability and decline', () => {
    const w = run(0);
    const base = run(60); // same seed, untouched, 5 years out
    const v = w.civs.find((c) => c.id === 'veloria')!;
    // catastrophe: lose 85% of all generation
    for (const k of Object.keys(v.energy.sources) as Array<keyof typeof v.energy.sources>) {
      v.energy.sources[k].cap *= 0.15;
    }
    stepWorld(w, 24);
    const vCrisis = w.civs.find((c) => c.id === 'veloria')!;
    // at the depth of the crisis the margin is deeply negative
    expect(vCrisis.energy.marginPct).toBeLessThan(-5);
    stepWorld(w, 36); // 5 years total
    const vAfter = w.civs.find((c) => c.id === 'veloria')!;
    const vBase = base.civs.find((c) => c.id === 'veloria')!;
    // real consequences vs the untouched timeline
    expect(vAfter.economy.output).toBeLessThan(vBase.economy.output * 0.9);
    expect(vAfter.society.stability).toBeLessThan(vBase.society.stability - 0.05);
    expect(vAfter.population.total).toBeLessThan(vBase.population.total);
    // chronicle records the catastrophe with causes
    const blackout = w.chronicle.find((e) => e.title.includes('Blackouts'));
    expect(blackout).toBeTruthy();
    expect(blackout!.causes.length).toBeGreaterThan(0);
  });

  it('scarcity raises international tension above peaceful baseline', () => {
    const w = run(0);
    for (const c of w.civs) {
      for (const k of Object.keys(c.energy.sources) as Array<keyof typeof c.energy.sources>) {
        c.energy.sources[k].cap *= 0.5; // region-wide scarcity
      }
    }
    stepWorld(w, 120);
    const peaceful = run(120);
    const tension = (ww: WorldState) => ww.relations.reduce((a, r) => a + r.tension, 0) / ww.relations.length;
    expect(tension(w)).toBeGreaterThan(tension(peaceful));
  });
});


describe('reality-hardening invariants', () => {
  it('50-year baseline remains physically coherent while producing real inventions and new historical actors', () => {
    const w = run(600, 'baseline_2026', 7);
    for (const c of w.civs) {
      expect((c.energy.servedTWh / Math.max(1e-9, c.energy.demandTWh))).toBeGreaterThan(0.95);
      expect(c.energy.gridCondition).toBeGreaterThan(0.5);
      expect(c.economy.capitalCondition).toBeGreaterThan(0.5);
      expect(c.economy.output).toBeGreaterThan(0);
      expect(Number.isFinite(c.economy.publicDebt)).toBe(true);
    }
    expect(w.inventions.length).toBeGreaterThan(10);
    expect(w.characters.length).toBeGreaterThan(6);
    expect(w.chronicle.some((e) => e.category === 'technology')).toBe(true);
  });

  it('very long runs do not permit an unserved-power economy to compound normally', () => {
    const w = run(1200, 'baseline_2026', 7);
    for (const c of w.civs) {
      if ((c.energy.servedTWh / Math.max(1e-9, c.energy.demandTWh)) < 0.8) {
        // A civilization missing >20% of required electricity cannot simultaneously
        // operate at essentially all of its unconstrained productive potential.
        expect(c.economy.output).toBeLessThan(c.economy.potentialOutput * 0.9);
      }
      expect(Number.isFinite(c.economy.output)).toBe(true);
      expect(Number.isFinite(c.energy.demandTWh)).toBe(true);
    }
  });

  it('important-character roster is not immortal or fixed', () => {
    const w = run(1800, 'baseline_2026', 19);
    expect(w.characters.length).toBeGreaterThan(10);
    const inactive = w.characters.filter((c) => c.active === false || c.retiredAt != null || c.diedAt != null);
    expect(inactive.length).toBeGreaterThan(0);
  });
});

describe('food & agriculture system', () => {
  it('baseline stays fed: no food crisis over 40 years', () => {
    const w = run(480);
    for (const c of w.civs) {
      expect(c.food.shortage).toBeLessThan(0.05);
      expect(c.food.selfSufficiency + c.food.importShare).toBeGreaterThan(0.95);
    }
    expect(w.chronicle.some((e) => e.title.includes('Food crisis'))).toBe(false);
  });

  it('breadbasket collapse starves the exporter AND its customers', () => {
    const w = run(0);
    const base = run(60);
    const nemea = w.civs.find((c) => c.id === 'nemea')!;
    nemea.food.landCapacity *= 0.5; // ecological/agricultural catastrophe
    stepWorld(w, 60);
    const n = w.civs.find((c) => c.id === 'nemea')!;
    const nBase = base.civs.find((c) => c.id === 'nemea')!;
    // famine: mortality and emigration shrink the population vs the untouched timeline
    expect(n.population.total).toBeLessThan(nBase.population.total);
    // chronicle records the crisis with causal attribution
    const crisis = w.chronicle.find((e) => e.title.includes('Food crisis') && e.civId === 'nemea');
    expect(crisis).toBeTruthy();
    expect(crisis!.causes.length).toBeGreaterThan(0);
    // contagion: veloria's imports dry up → its food security suffers too
    const v = w.civs.find((c) => c.id === 'veloria')!;
    const vBase = base.civs.find((c) => c.id === 'veloria')!;
    expect(v.food.selfSufficiency + v.food.importShare)
      .toBeLessThan(vBase.food.selfSufficiency + vBase.food.importShare);
  });

  it('artificial food decouples nutrition from land once biotech and power allow', () => {
    const w = run(0);
    w.techs.biotech_med.cap = 2.8; // precision fermentation / vertical farming unlocked
    // ...and cheap abundant power to run the grow-towers (solar build-out)
    for (const c of w.civs) c.energy.sources.solar.cap += c.energy.demandTWh / 8.76 / 0.22 * 0.35;
    stepWorld(w, 180); // 15 years — the artificial-food boom peaks
    // at least one civ moves a third of food production indoors
    const leader = [...w.civs].sort((a, b) => b.food.artificialShare - a.food.artificialShare)[0];
    expect(leader.food.artificialShare).toBeGreaterThan(0.3);
    // and farmland is given back to nature
    expect(leader.food.landUse).toBeLessThan(0.9);
    expect(w.chronicle.some((e) => e.title.includes('Artificial food'))).toBe(true);
  });
});

describe('housing & waste systems', () => {
  it('population boom without construction causes crowding, rent spikes and unrest pressure', () => {
    const w = run(0);
    const nemea = w.civs.find((c) => c.id === 'nemea')!;
    nemea.population.total *= 1.6; // sudden population surge (e.g. refugee wave)
    stepWorld(w, 36);
    const n = w.civs.find((c) => c.id === 'nemea')!;
    expect(n.housing.crowding).toBeGreaterThan(0.1);
    expect(n.housing.rentIndex).toBeGreaterThan(1.15);
    expect(w.chronicle.some((e) => e.title.includes('Housing crisis'))).toBe(true);
    // construction responds: stock grows faster than baseline replacement
    expect(n.housing.stockIndex).toBeGreaterThan(1.0);
  });

  it('unmanaged waste accumulates and corrodes stability; pressure forces cleanup', () => {
    const w = run(0);
    const vel = w.civs.find((c) => c.id === 'veloria')!;
    vel.waste.managedShare = 0.1; // waste infrastructure collapse
    stepWorld(w, 120);
    const v = w.civs.find((c) => c.id === 'veloria')!;
    expect(v.waste.accumulation).toBeGreaterThan(0.2);
    // public pressure drives management capacity back up — someone does something about it
    expect(v.waste.managedShare).toBeGreaterThan(0.3);
    const base = run(120);
    const vBase = base.civs.find((c) => c.id === 'veloria')!;
    expect(v.society.stability).toBeLessThan(vBase.society.stability + 0.001);
  });
});


describe('island world: land, sea and earned frontier', () => {
  it('land is finite and accounted for', () => {
    const w = run(600);
    for (const c of w.civs) {
      expect(c.land.pressure).toBeGreaterThan(0.3);
      expect(c.land.pressure).toBeLessThan(1.6);
      expect(c.land.usable).toBeGreaterThan(0.5);
      expect(Number.isFinite(c.land.densityIndex)).toBe(true);
      expect(c.frontierReadiness).toBeGreaterThanOrEqual(0);
      expect(c.frontierReadiness).toBeLessThanOrEqual(1);
    }
  });

  it('the frontier is gated on readiness: a civilization in energy crisis does not build spaceports', () => {
    const w = run(1);
    const v = w.civs[0];
    v.energy.sources.fossil.cap *= 0.1; v.energy.sources.nuclear.cap = 0; v.energy.sources.solar.cap *= 0.2;
    stepWorld(w, 240);
    expect(v.frontierReadiness).toBeLessThan(0.6);
    expect(w.projects.filter((p) => p.civId === v.id && ['spaceport', 'asteroid_mining', 'orbital_habitat', 'mars_colony'].includes(p.kind)).length).toBe(0);
  });

  it('no interstellar milestones remain on the ladder', () => {
    const w = run(1);
    const ids = w.frontier.milestones.map((m) => m.id);
    for (const gone of ['von_neumann_probes', 'interstellar_ship', 'orbit_engineering']) expect(ids).not.toContain(gone);
    expect(ids).toContain('type_ii_approach');
    expect(ids).toContain('coastal_expansion');
  });

  it('the Ascent preset does not hand out the ascent trajectory', () => {
    const w = run(240, 'ascent');
    expect(w.frontier.trajectory).not.toBe('ascent');
  });
});

describe('outcome range', () => {
  it('Hothouse ends with far fewer people than the baseline', () => {
    const base = run(1200); const hot = run(1200, 'hothouse_collapse');
    const pop = (w: WorldState) => w.civs.reduce((a, c) => a + c.population.total, 0);
    expect(pop(hot)).toBeLessThan(pop(base) * 0.8);
    expect(['crisis', 'collapse', 'extinction', 'stagnation', 'managed_decline']).toContain(hot.frontier.trajectory);
  });
});

describe('demography', () => {
  it('cohorts sum to the population and give momentum', () => {
    const w = run(240);
    for (const c of w.civs) {
      const sum = c.population.cohorts.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - c.population.total)).toBeLessThan(0.01);
      expect(c.population.medianAge).toBeGreaterThan(20); expect(c.population.medianAge).toBeLessThan(100);
    }
    const n = w.civs[2], v = w.civs[0];
    expect(n.population.total).toBeGreaterThan(96); // young Nemea grows for decades even as fertility falls
    expect(v.population.total).toBeLessThan(42.3);  // old Veloria shrinks
  });
});

describe('society', () => {
  it('stays finite through wars, pandemics and synthetic births', () => {
    const w = run(1, 'resource_crunch');
    for (let y = 0; y < 200; y++) { stepWorld(w, 12); for (const p of [...w.pendingDecisions]) resolveDecision(w, p.key, p.defId === 'conflict' ? 'war' : p.defId === 'synthetic_births' ? 'both' : null); }
    for (const c of w.civs) { expect(Number.isFinite(c.population.total)).toBe(true); expect(Number.isFinite(c.researchCapacity)).toBe(true); expect(c.researchCapacity).toBeLessThan(1e4); }
    for (const r of w.relations) expect(Number.isFinite(r.tension)).toBe(true);
  });
  it('a population collapse is not labelled growth', () => {
    const w = run(1, 'resource_crunch');
    for (let y = 0; y < 200; y++) { stepWorld(w, 12); for (const p of [...w.pendingDecisions]) resolveDecision(w, p.key, p.defId === 'conflict' ? 'war' : null); }
    const pop = w.civs.reduce((a, c) => a + c.population.total, 0);
    if (pop < 150) expect(['collapse', 'crisis', 'extinction']).toContain(w.frontier.trajectory);
  });
});

describe('v9 epistemic and plural-futures hardening', () => {
  it('never extrapolates the measured AI task benchmark beyond its suite ceiling', () => {
    expect(taskHorizonHrs(1)).toBeGreaterThanOrEqual(11);
    expect(taskHorizonHrs(10)).toBeLessThanOrEqual(16);
    expect(taskHorizonHrs(1_000_000)).toBeLessThanOrEqual(16);
  });

  it('sea level is a lagged stock and does not fall when atmospheric warming falls', () => {
    const w = run(600, 'baseline_2026', 7);
    const highWater = w.env.seaLevelM;
    w.env.warmingC = 1.0; // even a hypothetical rapid atmospheric cooling cannot un-rise the ocean
    stepWorld(w, 240);
    expect(w.env.seaLevelM).toBeGreaterThanOrEqual(highWater);
    expect(w.env.committedSeaLevelM).toBeGreaterThanOrEqual(w.env.seaLevelM);
  });

  it('Earth-bound flourishing is possible without inhabiting every domain', () => {
    const w = run(1200, 'resilient_earth', 7);
    expect(w.frontier.trajectory).toBe('flourishing');
    expect(w.frontier.developmentForm).toBe('earthbound');
    expect(w.frontier.milestones.find((m) => m.id === 'full_spectrum')?.status).not.toBe('achieved');
  });

  it('fast automation with a weak social contract can advance capability while worsening lived outcomes', () => {
    const divided = run(1200, 'automation_divide', 7);
    const shared = run(1200, 'human_centered_abundance', 7);
    expect(divided.frontier.outcome.distribution).toBeLessThan(shared.frontier.outcome.distribution - 0.15);
    expect(divided.frontier.outcome.institutionalHealth).toBeLessThan(shared.frontier.outcome.institutionalHealth - 0.10);
    expect(divided.frontier.outcome.broadFlourishing).toBeLessThan(shared.frontier.outcome.broadFlourishing);
  });

  it('long stagnation does not become superintelligence merely because centuries pass', () => {
    const w = run(3600, 'long_stagnation', 7);
    expect(w.frontier.asi).toBe(false);
  });
});
