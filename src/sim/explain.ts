// ─────────────────────────────────────────────────────────────────────────────
// EXPLANATION LAYER — "Why did this happen?" renders from causal records;
// "Why is this technology accelerating?" decomposes live research velocity.
// No LLM invents explanations after the fact.
// ─────────────────────────────────────────────────────────────────────────────
import type { WorldState, TechId, ChronicleEvent } from './types';
import { TECH_DEFS } from './data/techDefs';
import { taskHorizonHrs } from './core/step';
import { evidenceById } from './data/evidence';

export interface VelocityReport {
  techId: TechId;
  name: string;
  state: 'stagnating' | 'slow' | 'steady' | 'rapid' | 'accelerating';
  growthPctPerYear: number;
  accelerating: boolean;
  accelerators: string[];
  constraints: string[];
  paradigm: number;
  headroomPct: number;   // distance to paradigm asymptote
  confidence: 'low' | 'medium' | 'high';
  uncertaintyNote: string;
  calibration: string[]; // evidence ids with titles
  pipeline: { stage: string; value: number; max: number }[];
}

export function researchVelocity(w: WorldState, techId: TechId): VelocityReport {
  const t = w.techs[techId];
  const d = TECH_DEFS[techId];
  const g = t.lastGrowthRate;
  const state: VelocityReport['state'] =
    g < 0.02 ? 'stagnating' : g < 0.08 ? 'slow' : g < 0.2 ? 'steady' : g < 0.45 ? 'rapid' : 'accelerating';

  const accelerators: string[] = [];
  if (t.effort > d.effortPull * 2.6 * 1.2) accelerators.push('elevated research effort');
  if (d.aiToolingGain > 0 && w.techs.ai_models.cap > 1.3) accelerators.push('AI-assisted research tooling');
  if (d.labAutomationGain > 0 && w.techs.robotics_ind.cap > 1.3) accelerators.push('laboratory automation');
  if (d.computeGain > 0 && w.civs.reduce((a, c) => a + c.compute.supplyFlops, 0) > 3) accelerators.push('compute abundance');
  if ((techId === 'ai_models' || techId === 'ai_agents') && taskHorizonHrs(w.techs.ai_agents.cap) > 24) accelerators.push('AI improving AI research (recursive feedback)');
  if (w.params.collaboration > 1.1) accelerators.push('scientific collaboration spillovers');
  if (t.mfg > 1.5) accelerators.push('manufacturing learning-by-doing');
  if (accelerators.length === 0) accelerators.push('baseline research effort');

  const constraints: string[] = [];
  if (t.cap > t.paradigmCap * 0.72) constraints.push(`paradigm asymptote at ${t.paradigmCap.toFixed(1)}× 2026 level`);
  if (t.depReady < 0.65) constraints.push('immature dependencies');
  if (Math.pow(t.cap, d.difficultyTheta) > 2.5) constraints.push('increasing research difficulty (ideas harder to find)');
  const computeRatio = (() => { let s = 0, dm = 0; for (const c of w.civs) { s += c.compute.supplyFlops; dm += c.compute.demandFlops; } return dm > 0 ? s / dm : 1; })();
  if ((d.computeGain > 0.5) && computeRatio < 1) constraints.push('compute scarcity');
  const meanPrice = w.civs.reduce((a, c) => a + c.energy.priceIndex, 0) / w.civs.length;
  if (meanPrice > 1.4 && (techId === 'compute_accel' || techId === 'semiconductor_fab' || techId === 'ai_models')) constraints.push('electricity cost');
  if (t.cost > 1.5) constraints.push('high unit cost');
  if (t.mfg < 0.7) constraints.push('manufacturing capacity');
  if (t.reliability < 0.55 && t.maturity > 0.4) constraints.push('reliability validation');
  if (constraints.length === 0) constraints.push('no dominant constraint');

  const pipeline = [
    { stage: 'Scientific knowledge', value: Math.min(1, t.cap / 2), max: 1 },
    { stage: 'Prototype', value: t.maturity, max: 1 },
    { stage: 'Reliable system', value: t.reliability, max: 1 },
    { stage: 'Manufacturing', value: Math.min(1, t.mfg / 3), max: 1 },
    { stage: 'Cost reduction', value: Math.min(1, (d.cost0 - t.cost) / Math.max(0.01, d.cost0 - d.costFloor)), max: 1 },
    { stage: 'Adoption (world avg)', value: (t.adoption.veloria.penetration + t.adoption.ardan.penetration + t.adoption.nemea.penetration) / 3, max: 1 },
  ];

  return {
    techId, name: d.name, state,
    growthPctPerYear: g * 100,
    accelerating: t.growthAccel > 0.02,
    accelerators, constraints,
    paradigm: t.paradigm,
    headroomPct: Math.max(0, (1 - t.cap / t.paradigmCap) * 100),
    confidence: t.uncertainty < 0.22 ? 'high' : t.uncertainty < 0.35 ? 'medium' : 'low',
    uncertaintyNote:
      t.uncertainty < 0.25
        ? 'Empirical trend well-measured; exponential continuation plausible near-term.'
        : 'Exponential and accelerated-exponential trajectories remain plausible within the calibration window. Long-range extrapolation is speculative.',
    calibration: d.evidence.map((id) => evidenceById(id)?.sourceTitle ?? id),
    pipeline,
  };
}

export interface WhyReport {
  title: string;
  causes: { factor: string; weight: number }[];
  counterforces: { factor: string; weight: number }[];
  confidence: string;
  context: string[];
}

export function whyDidThisHappen(ev: ChronicleEvent): WhyReport {
  const total = ev.causes.reduce((a, c) => a + c.weight, 0) || 1;
  return {
    title: ev.title,
    causes: ev.causes.map((c) => ({ ...c, weight: c.weight / total })).sort((a, b) => b.weight - a.weight),
    counterforces: ev.counterforces,
    confidence: ev.confidence,
    context: [ev.body],
  };
}
