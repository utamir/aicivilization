// ─────────────────────────────────────────────────────────────────────────────
// TECHNOLOGY DEFINITIONS — data-driven tech graph.
// frontier growth:  dCap/dt = researchOutput · kGrowth · (1 − cap/paradigmCap)
// researchOutput  = Σ_civ (effort·capacity) · tooling · spillover / difficulty(cap)
// difficulty      = cap^difficultyTheta   (Bloom et al.: ideas get harder to find)
// ─────────────────────────────────────────────────────────────────────────────
import type { TechId, TechDomain } from '../types';

export interface TechDef {
  id: TechId;
  name: string;
  short: string;
  domain: TechDomain;
  /** 2026 starting capability index */
  cap0: number;
  /** current-paradigm asymptote (cap units) */
  paradigmCap0: number;
  /** paradigm jump factor distribution [lo, hi] when a transition fires */
  paradigmJump: [number, number];
  /** base annual breakthrough probability at full effort once near asymptote */
  paradigmBreakRate: number;
  /** growth calibration constant (per-year at unit effort/output) */
  kGrowth: number;
  /** ideas-get-harder exponent */
  difficultyTheta: number;
  /** baseline research effort share this tech attracts (global, pre-allocation) */
  effortPull: number;
  /** how strongly AI capability multiplies research tooling here (0 = none) */
  aiToolingGain: number;
  /** how strongly lab automation / robotics multiplies tooling */
  labAutomationGain: number;
  /** how strongly compute supply multiplies tooling */
  computeGain: number;
  /** dependencies: tech → required readiness contribution (weight sums to 1) */
  deps: Partial<Record<TechId, number>>;
  /** experience-curve learning rate (cost decline per doubling of cumulative), decays */
  learningRate: number;
  /** cost floor as fraction of 2026 cost */
  costFloor: number;
  /** annual mfg-capacity growth responsiveness to demand/profit */
  mfgGrowth: number;
  /** maturity/reliability drift per year at unit effort */
  maturityRate: number;
  /** deployment friction: how slowly adoption responds (per-year adoption speed) */
  diffusionSpeed: number;
  /** energy demand per unit adoption (TWh/yr per civ-unit, index) */
  energyPerAdoption: number;
  /** research uncertainty sigma on growth (epistemic) */
  sigma: number;
  /** evidence registry ids backing calibration */
  evidence: string[];
  /** constraints that can gate research/deployment, with labels for bottleneck UI */
  constraintLabels: string[];
  /** gameplay scaling factor (tuning, NOT empirical) */
  gameplayScaling: number;
  phase0: 'science' | 'prototype' | 'engineering' | 'deployment' | 'diffusion' | 'mature';
  maturity0: number;
  reliability0: number;
  cost0: number;
  pen0: Record<'veloria' | 'ardan' | 'nemea', number>; // 2026 penetration per civ
}

export const TECH_DEFS: Record<TechId, TechDef> = {
  // ── A. AI & computation ─────────────────────────────────────────────────
  ai_models: {
    id: 'ai_models', name: 'Frontier AI Models', short: 'AI models', domain: 'ai',
    cap0: 1, paradigmCap0: 6, paradigmJump: [2.5, 5], paradigmBreakRate: 0.18,
    kGrowth: 0.55, difficultyTheta: 1.05, effortPull: 0.20,
    aiToolingGain: 1.6, labAutomationGain: 0.15, computeGain: 1.3,
    deps: { compute_accel: 0.55, semiconductor_fab: 0.15, ai_agents: 0.3 },
    learningRate: 0.30, costFloor: 0.02, mfgGrowth: 0.5, maturityRate: 0.10,
    diffusionSpeed: 0.30, energyPerAdoption: 0.0, sigma: 0.35,
    evidence: ['ai-training-compute-doubling', 'algorithmic-efficiency', 'ai-inference-cost-decline'],
    constraintLabels: ['compute supply', 'training capital', 'electricity for data centers', 'algorithmic insight'],
    gameplayScaling: 1.0,
    phase0: 'deployment', maturity0: 0.62, reliability0: 0.55, cost0: 1,
    pen0: { veloria: 0.34, ardan: 0.28, nemea: 0.18 },
  },
  ai_agents: {
    id: 'ai_agents', name: 'Autonomous AI Agents', short: 'AI agents', domain: 'ai',
    cap0: 1, paradigmCap0: 8, paradigmJump: [3, 6], paradigmBreakRate: 0.15,
    kGrowth: 0.85, difficultyTheta: 0.9, effortPull: 0.12,
    aiToolingGain: 1.4, labAutomationGain: 0.1, computeGain: 1.0,
    deps: { ai_models: 0.7, compute_accel: 0.3 },
    learningRate: 0.35, costFloor: 0.02, mfgGrowth: 0.6, maturityRate: 0.12,
    diffusionSpeed: 0.22, energyPerAdoption: 0.6, sigma: 0.4,
    evidence: ['ai-task-horizon-doubling'],
    constraintLabels: ['model reliability', 'evaluation difficulty', 'compute supply', 'organizational trust'],
    gameplayScaling: 1.0,
    phase0: 'engineering', maturity0: 0.42, reliability0: 0.38, cost0: 1,
    pen0: { veloria: 0.16, ardan: 0.13, nemea: 0.08 },
  },
  // ── B. Semiconductors / compute hardware ────────────────────────────────
  compute_accel: {
    id: 'compute_accel', name: 'AI Accelerators & Compute Supply', short: 'accelerators', domain: 'compute',
    cap0: 1, paradigmCap0: 5, paradigmJump: [2, 4], paradigmBreakRate: 0.12,
    kGrowth: 0.5, difficultyTheta: 1.1, effortPull: 0.12,
    aiToolingGain: 0.7, labAutomationGain: 0.2, computeGain: 0.35,
    deps: { semiconductor_fab: 0.7, ai_models: 0.3 },
    learningRate: 0.22, costFloor: 0.08, mfgGrowth: 0.45, maturityRate: 0.08,
    diffusionSpeed: 0.5, energyPerAdoption: 1.4, sigma: 0.25,
    evidence: ['ai-training-compute-doubling', 'hyperscaler-capex'],
    constraintLabels: ['fab output', 'packaging capacity', 'electricity', 'export controls'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.8, reliability0: 0.85, cost0: 1,
    pen0: { veloria: 0.5, ardan: 0.42, nemea: 0.25 },
  },
  semiconductor_fab: {
    id: 'semiconductor_fab', name: 'Leading-Edge Semiconductor Fabrication', short: 'semiconductor fabs', domain: 'compute',
    cap0: 1, paradigmCap0: 3.2, paradigmJump: [1.8, 3], paradigmBreakRate: 0.07,
    kGrowth: 0.16, difficultyTheta: 1.35, effortPull: 0.08,
    aiToolingGain: 0.5, labAutomationGain: 0.3, computeGain: 0.2,
    deps: { compute_accel: 0.3, robotics_ind: 0.2 },
    learningRate: 0.12, costFloor: 0.5, mfgGrowth: 0.14, maturityRate: 0.05,
    diffusionSpeed: 0.25, energyPerAdoption: 0.9, sigma: 0.2,
    evidence: ['moore-slowing', 'semiconductor-fab-cost', 'research-productivity-decline'],
    constraintLabels: ['lithography equipment', 'fab capital ($20B+/fab)', 'skilled workforce', 'construction time (2–4 yr)'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.85, reliability0: 0.9, cost0: 1,
    pen0: { veloria: 0.4, ardan: 0.65, nemea: 0.15 },
  },
  // ── C. Energy ────────────────────────────────────────────────────────────
  solar_pv: {
    id: 'solar_pv', name: 'Solar Photovoltaics', short: 'solar PV', domain: 'energy',
    cap0: 1, paradigmCap0: 2.6, paradigmJump: [1.6, 2.6], paradigmBreakRate: 0.06,
    kGrowth: 0.10, difficultyTheta: 0.9, effortPull: 0.05,
    aiToolingGain: 0.35, labAutomationGain: 0.3, computeGain: 0.1,
    deps: { storage_batt: 0.25, grid_transmission: 0.25 },
    learningRate: 0.14, costFloor: 0.25, mfgGrowth: 0.25, maturityRate: 0.05,
    diffusionSpeed: 0.16, energyPerAdoption: 0, sigma: 0.15,
    evidence: ['solar-learning-rate'],
    constraintLabels: ['grid interconnection queues', 'land/permitting', 'storage pairing'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.9, reliability0: 0.9, cost0: 1,
    pen0: { veloria: 0.35, ardan: 0.22, nemea: 0.3 },
  },
  wind_power: {
    id: 'wind_power', name: 'Wind Power', short: 'wind', domain: 'energy',
    cap0: 1, paradigmCap0: 2.2, paradigmJump: [1.4, 2.2], paradigmBreakRate: 0.04,
    kGrowth: 0.08, difficultyTheta: 0.9, effortPull: 0.03,
    aiToolingGain: 0.25, labAutomationGain: 0.15, computeGain: 0.05,
    deps: { grid_transmission: 0.3 },
    learningRate: 0.10, costFloor: 0.4, mfgGrowth: 0.2, maturityRate: 0.04,
    diffusionSpeed: 0.13, energyPerAdoption: 0, sigma: 0.15,
    evidence: ['global-electricity'],
    constraintLabels: ['permitting', 'transmission access', 'supply chain'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.9, reliability0: 0.88, cost0: 1,
    pen0: { veloria: 0.3, ardan: 0.25, nemea: 0.35 },
  },
  nuclear_power: {
    id: 'nuclear_power', name: 'Nuclear Fission (incl. advanced)', short: 'nuclear', domain: 'energy',
    cap0: 1, paradigmCap0: 2.8, paradigmJump: [1.8, 3.2], paradigmBreakRate: 0.05,
    kGrowth: 0.07, difficultyTheta: 1.1, effortPull: 0.04,
    aiToolingGain: 0.4, labAutomationGain: 0.35, computeGain: 0.15,
    deps: { robotics_ind: 0.15 },
    learningRate: 0.06, costFloor: 0.45, mfgGrowth: 0.1, maturityRate: 0.04,
    diffusionSpeed: 0.07, energyPerAdoption: 0, sigma: 0.25,
    evidence: ['nuclear-construction'],
    constraintLabels: ['licensing & regulation', 'construction time (7–10 yr)', 'financing', 'workforce'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.88, reliability0: 0.93, cost0: 1,
    pen0: { veloria: 0.25, ardan: 0.18, nemea: 0.1 },
  },
  geothermal_power: {
    id: 'geothermal_power', name: 'Geothermal & Enhanced Geothermal', short: 'geothermal', domain: 'energy',
    cap0: 0.75, paradigmCap0: 4.2, paradigmJump: [1.6, 2.8], paradigmBreakRate: 0.055,
    kGrowth: 0.11, difficultyTheta: 1.0, effortPull: 0.025,
    aiToolingGain: 0.45, labAutomationGain: 0.45, computeGain: 0.15,
    deps: { robotics_ind: 0.2, grid_transmission: 0.2 },
    learningRate: 0.11, costFloor: 0.30, mfgGrowth: 0.15, maturityRate: 0.05,
    diffusionSpeed: 0.09, energyPerAdoption: 0, sigma: 0.28,
    evidence: ['geothermal-potential-2024'],
    constraintLabels: ['drilling risk', 'subsurface mapping', 'permitting', 'project finance'],
    gameplayScaling: 1.0,
    phase0: 'deployment', maturity0: 0.72, reliability0: 0.78, cost0: 1.4,
    pen0: { veloria: 0.04, ardan: 0.03, nemea: 0.025 },
  },
  bioenergy_systems: {
    id: 'bioenergy_systems', name: 'Sustainable Bioenergy & Synthetic Fuels', short: 'bioenergy', domain: 'energy',
    cap0: 0.85, paradigmCap0: 3.0, paradigmJump: [1.4, 2.3], paradigmBreakRate: 0.04,
    kGrowth: 0.08, difficultyTheta: 1.0, effortPull: 0.018,
    aiToolingGain: 0.3, labAutomationGain: 0.35, computeGain: 0.08,
    deps: { biotech_med: 0.2, robotics_ind: 0.15 },
    learningRate: 0.07, costFloor: 0.42, mfgGrowth: 0.12, maturityRate: 0.04,
    diffusionSpeed: 0.08, energyPerAdoption: 0, sigma: 0.22,
    evidence: ['renewable-mix-2025', 'renewable-heat-2025'],
    constraintLabels: ['sustainable feedstock', 'land and food competition', 'supply logistics', 'carbon accounting'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.82, reliability0: 0.84, cost0: 1.2,
    pen0: { veloria: 0.08, ardan: 0.06, nemea: 0.10 },
  },
  ocean_energy: {
    id: 'ocean_energy', name: 'Ocean Energy (tidal, wave & OTEC)', short: 'ocean energy', domain: 'energy',
    cap0: 0.35, paradigmCap0: 4.0, paradigmJump: [1.6, 2.8], paradigmBreakRate: 0.055,
    kGrowth: 0.10, difficultyTheta: 1.05, effortPull: 0.014,
    aiToolingGain: 0.35, labAutomationGain: 0.5, computeGain: 0.1,
    deps: { robotics_ind: 0.25, grid_transmission: 0.2 },
    learningRate: 0.12, costFloor: 0.32, mfgGrowth: 0.12, maturityRate: 0.05,
    diffusionSpeed: 0.07, energyPerAdoption: 0, sigma: 0.35,
    evidence: ['renewable-mix-2025'],
    constraintLabels: ['marine survivability', 'subsea maintenance', 'grid connection', 'site-specific resource'],
    gameplayScaling: 1.0,
    phase0: 'prototype', maturity0: 0.45, reliability0: 0.50, cost0: 2.0,
    pen0: { veloria: 0.01, ardan: 0.005, nemea: 0.005 },
  },
  hydrogen_systems: {
    id: 'hydrogen_systems', name: 'Hydrogen & Derivative Fuel Systems', short: 'hydrogen', domain: 'energy',
    cap0: 0.7, paradigmCap0: 3.8, paradigmJump: [1.5, 2.6], paradigmBreakRate: 0.045,
    kGrowth: 0.10, difficultyTheta: 0.95, effortPull: 0.022,
    aiToolingGain: 0.35, labAutomationGain: 0.3, computeGain: 0.1,
    deps: { grid_transmission: 0.25, storage_batt: 0.10 },
    learningRate: 0.10, costFloor: 0.28, mfgGrowth: 0.16, maturityRate: 0.05,
    diffusionSpeed: 0.075, energyPerAdoption: 0.15, sigma: 0.25,
    evidence: ['hydrogen-review-2026'],
    constraintLabels: ['clean electricity supply', 'electrolyzer cost', 'storage and pipelines', 'offtake demand'],
    gameplayScaling: 1.0,
    phase0: 'deployment', maturity0: 0.62, reliability0: 0.70, cost0: 1.8,
    pen0: { veloria: 0.035, ardan: 0.025, nemea: 0.015 },
  },
  storage_batt: {
    id: 'storage_batt', name: 'Battery Storage', short: 'batteries', domain: 'energy',
    cap0: 1, paradigmCap0: 4.5, paradigmJump: [2, 4], paradigmBreakRate: 0.08,
    kGrowth: 0.22, difficultyTheta: 1.0, effortPull: 0.06,
    aiToolingGain: 0.55, labAutomationGain: 0.45, computeGain: 0.2,
    deps: {},
    learningRate: 0.17, costFloor: 0.2, mfgGrowth: 0.28, maturityRate: 0.07,
    diffusionSpeed: 0.2, energyPerAdoption: 0, sigma: 0.2,
    evidence: ['battery-cost'],
    constraintLabels: ['lithium/material supply', 'manufacturing capacity', 'safety validation'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.8, reliability0: 0.82, cost0: 1,
    pen0: { veloria: 0.28, ardan: 0.3, nemea: 0.18 },
  },
  grid_transmission: {
    id: 'grid_transmission', name: 'Grid & Transmission', short: 'grid', domain: 'energy',
    cap0: 1, paradigmCap0: 2.4, paradigmJump: [1.5, 2.4], paradigmBreakRate: 0.04,
    kGrowth: 0.09, difficultyTheta: 1.0, effortPull: 0.03,
    aiToolingGain: 0.4, labAutomationGain: 0.15, computeGain: 0.1,
    deps: {},
    learningRate: 0.05, costFloor: 0.6, mfgGrowth: 0.12, maturityRate: 0.05,
    diffusionSpeed: 0.09, energyPerAdoption: 0, sigma: 0.2,
    evidence: ['datacenter-electricity', 'global-electricity'],
    constraintLabels: ['permitting & rights-of-way', 'construction workforce', 'transformer supply'],
    gameplayScaling: 1.0,
    phase0: 'mature', maturity0: 0.92, reliability0: 0.9, cost0: 1,
    pen0: { veloria: 0.6, ardan: 0.55, nemea: 0.4 },
  },
  // ── D. Robotics ──────────────────────────────────────────────────────────
  robotics_ind: {
    id: 'robotics_ind', name: 'Industrial Robotics', short: 'industrial robots', domain: 'robotics',
    cap0: 1, paradigmCap0: 3.4, paradigmJump: [1.8, 3], paradigmBreakRate: 0.06,
    kGrowth: 0.2, difficultyTheta: 1.0, effortPull: 0.06,
    aiToolingGain: 0.9, labAutomationGain: 0.3, computeGain: 0.4,
    deps: { ai_agents: 0.3, compute_accel: 0.25, storage_batt: 0.15 },
    learningRate: 0.16, costFloor: 0.25, mfgGrowth: 0.24, maturityRate: 0.07,
    diffusionSpeed: 0.14, energyPerAdoption: 0.25, sigma: 0.2,
    evidence: ['robot-density'],
    constraintLabels: ['integration labor', 'task flexibility', 'capex cycles'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.85, reliability0: 0.86, cost0: 1,
    pen0: { veloria: 0.4, ardan: 0.55, nemea: 0.22 },
  },
  robotics_gp: {
    id: 'robotics_gp', name: 'General-Purpose Robotics', short: 'general robots', domain: 'robotics',
    cap0: 1, paradigmCap0: 10, paradigmJump: [3, 7], paradigmBreakRate: 0.1,
    kGrowth: 0.3, difficultyTheta: 1.0, effortPull: 0.07,
    aiToolingGain: 1.2, labAutomationGain: 0.4, computeGain: 0.7,
    deps: { ai_agents: 0.4, robotics_ind: 0.2, storage_batt: 0.2, compute_accel: 0.2 },
    learningRate: 0.25, costFloor: 0.1, mfgGrowth: 0.3, maturityRate: 0.08,
    diffusionSpeed: 0.1, energyPerAdoption: 0.35, sigma: 0.45,
    evidence: ['ai-task-horizon-doubling', 'robot-density'],
    constraintLabels: ['manipulation reliability', 'safety certification', 'unit cost', 'maintenance workforce'],
    gameplayScaling: 1.0,
    phase0: 'prototype', maturity0: 0.3, reliability0: 0.28, cost0: 4.5,
    pen0: { veloria: 0.02, ardan: 0.03, nemea: 0.01 },
  },
  // ── E. Biotech / medicine ────────────────────────────────────────────────
  biotech_med: {
    id: 'biotech_med', name: 'Biotechnology & Medicine', short: 'biotech', domain: 'biotech',
    cap0: 1, paradigmCap0: 4, paradigmJump: [2, 4.5], paradigmBreakRate: 0.08,
    kGrowth: 0.14, difficultyTheta: 1.2, effortPull: 0.09,
    aiToolingGain: 1.0, labAutomationGain: 0.8, computeGain: 0.5,
    deps: { ai_models: 0.35, robotics_ind: 0.15, compute_accel: 0.2 },
    learningRate: 0.08, costFloor: 0.4, mfgGrowth: 0.12, maturityRate: 0.05,
    diffusionSpeed: 0.07, energyPerAdoption: 0.1, sigma: 0.3,
    evidence: ['research-productivity-decline'],
    constraintLabels: ['clinical validation time', 'regulatory approval', 'wet-lab throughput', 'manufacturing (GMP)'],
    gameplayScaling: 1.0,
    phase0: 'deployment', maturity0: 0.7, reliability0: 0.75, cost0: 1,
    pen0: { veloria: 0.3, ardan: 0.25, nemea: 0.15 },
  },
  // ── F. Transportation ───────────────────────────────────────────────────
  transport_ev: {
    id: 'transport_ev', name: 'Electric Vehicles', short: 'EVs', domain: 'transport',
    cap0: 1, paradigmCap0: 2.5, paradigmJump: [1.5, 2.5], paradigmBreakRate: 0.04,
    kGrowth: 0.16, difficultyTheta: 0.85, effortPull: 0.04,
    aiToolingGain: 0.4, labAutomationGain: 0.3, computeGain: 0.15,
    deps: { storage_batt: 0.55, robotics_ind: 0.15 },
    learningRate: 0.15, costFloor: 0.45, mfgGrowth: 0.25, maturityRate: 0.06,
    diffusionSpeed: 0.12, energyPerAdoption: 0.5, sigma: 0.15,
    evidence: ['ev-adoption', 'battery-cost'],
    constraintLabels: ['charging infrastructure', 'battery cost', 'grid capacity'],
    gameplayScaling: 1.0,
    phase0: 'diffusion', maturity0: 0.85, reliability0: 0.85, cost0: 1,
    pen0: { veloria: 0.22, ardan: 0.26, nemea: 0.1 },
  },
  transport_av: {
    id: 'transport_av', name: 'Autonomous Transport', short: 'autonomous transport', domain: 'transport',
    cap0: 1, paradigmCap0: 6, paradigmJump: [2.5, 5], paradigmBreakRate: 0.08,
    kGrowth: 0.24, difficultyTheta: 1.05, effortPull: 0.04,
    aiToolingGain: 1.1, labAutomationGain: 0.2, computeGain: 0.6,
    deps: { ai_agents: 0.5, transport_ev: 0.2, compute_accel: 0.3 },
    learningRate: 0.2, costFloor: 0.2, mfgGrowth: 0.2, maturityRate: 0.07,
    diffusionSpeed: 0.08, energyPerAdoption: 0.2, sigma: 0.35,
    evidence: ['ai-task-horizon-doubling'],
    constraintLabels: ['safety validation', 'regulation & liability', 'public trust', 'edge-case reliability'],
    gameplayScaling: 1.0,
    phase0: 'engineering', maturity0: 0.4, reliability0: 0.35, cost0: 2.8,
    pen0: { veloria: 0.03, ardan: 0.04, nemea: 0.01 },
  },

  // ── G. Frontier — long-horizon pathways. These start at the 2026 state of the
  // art (fusion: net-gain experiments; longevity: senolytics/partial reprogramming
  // trials; space: partially reusable heavy launch) and are deliberately slow and
  // dependency-gated. They never arrive on a schedule; they arrive if the
  // enabling technologies, energy and institutions exist.
  fusion_power: {
    id: 'fusion_power', name: 'Fusion Power (magnetic & inertial)', short: 'fusion', domain: 'frontier',
    cap0: 0.35, paradigmCap0: 3.0, paradigmJump: [1.6, 2.6], paradigmBreakRate: 0.03,
    kGrowth: 0.09, difficultyTheta: 1.25, effortPull: 0.03,
    aiToolingGain: 0.9, labAutomationGain: 0.5, computeGain: 0.6,
    deps: { nuclear_power: 0.25, compute_accel: 0.2, robotics_ind: 0.2, ai_models: 0.35 },
    learningRate: 0.10, costFloor: 0.25, mfgGrowth: 0.12, maturityRate: 0.035,
    diffusionSpeed: 0.06, energyPerAdoption: 0, sigma: 0.45,
    evidence: ['fusion-net-gain', 'nuclear-construction'],
    constraintLabels: ['plasma confinement & materials', 'tritium supply', 'first-of-a-kind plant cost', 'licensing'],
    gameplayScaling: 1.0,
    phase0: 'science', maturity0: 0.12, reliability0: 0.10, cost0: 6,
    pen0: { veloria: 0, ardan: 0, nemea: 0 },
  },
  longevity_bio: {
    id: 'longevity_bio', name: 'Longevity & Regenerative Medicine', short: 'longevity', domain: 'frontier',
    cap0: 0.5, paradigmCap0: 4.0, paradigmJump: [1.6, 2.8], paradigmBreakRate: 0.04,
    kGrowth: 0.08, difficultyTheta: 1.35, effortPull: 0.03,
    aiToolingGain: 1.1, labAutomationGain: 0.7, computeGain: 0.5,
    deps: { biotech_med: 0.6, ai_models: 0.25, robotics_ind: 0.15 },
    learningRate: 0.18, costFloor: 0.12, mfgGrowth: 0.2, maturityRate: 0.04,
    diffusionSpeed: 0.09, energyPerAdoption: 0, sigma: 0.45,
    evidence: ['longevity-trials', 'research-productivity-decline'],
    constraintLabels: ['clinical validation (decades)', 'regulation', 'cost of therapies', 'biological complexity'],
    gameplayScaling: 1.0,
    phase0: 'science', maturity0: 0.15, reliability0: 0.15, cost0: 4,
    pen0: { veloria: 0, ardan: 0, nemea: 0 },
  },
  space_systems: {
    id: 'space_systems', name: 'Space Systems (launch, in-space industry)', short: 'space', domain: 'frontier',
    cap0: 1.0, paradigmCap0: 4.5, paradigmJump: [1.8, 3.0], paradigmBreakRate: 0.05,
    kGrowth: 0.14, difficultyTheta: 1.15, effortPull: 0.03,
    aiToolingGain: 0.6, labAutomationGain: 0.6, computeGain: 0.3,
    deps: { robotics_ind: 0.35, robotics_gp: 0.2, ai_agents: 0.2, storage_batt: 0.1, semiconductor_fab: 0.15 },
    learningRate: 0.14, costFloor: 0.05, mfgGrowth: 0.14, maturityRate: 0.045,
    diffusionSpeed: 0.08, energyPerAdoption: 0.1, sigma: 0.4,
    evidence: ['launch-cost-decline', 'asteroid-mining-economics'],
    constraintLabels: ['launch cost', 'life support & radiation', 'in-space manufacturing', 'capital for decades-long returns'],
    gameplayScaling: 1.0,
    phase0: 'prototype', maturity0: 0.3, reliability0: 0.55, cost0: 1,
    pen0: { veloria: 0.02, ardan: 0.03, nemea: 0.005 },
  },
};

export const TECH_IDS = Object.keys(TECH_DEFS) as TechId[];

/** Domain display metadata */
export const DOMAIN_META: Record<TechDomain, { label: string; color: string }> = {
  frontier: { label: 'Frontier (fusion · longevity · space)', color: '#f6c177' },
  ai: { label: 'AI & Computation', color: '#6E7BFF' },
  compute: { label: 'Semiconductors & Compute', color: '#4FC3F7' },
  energy: { label: 'Energy', color: '#FFC94D' },
  robotics: { label: 'Robotics & Automation', color: '#FF8A5C' },
  biotech: { label: 'Biotech & Medicine', color: '#6BD88F' },
  transport: { label: 'Transportation', color: '#B49CFF' },
};
