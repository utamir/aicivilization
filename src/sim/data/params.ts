// ─────────────────────────────────────────────────────────────────────────────
// SIM PARAMS — defaults, presets, Scenario Builder mapping, safe What-If parser.
// Natural language NEVER executes code: it maps to validated structured deltas.
// ─────────────────────────────────────────────────────────────────────────────
import type { SimParams } from '../types';

export const DEFAULT_PARAMS: SimParams = {
  aiTooling: 1.0,
  aiFeedback: 1.0,
  aiProgressMult: 1.0,
  algorithmicHalvingMonths: 10,   // evidence: ~8–12mo provisional
  computeDoublingMonths: 5.5,     // evidence: ~5mo compute doubling baseline
  buildSpeedMult: 1.0,
  energyCapexMult: 1.0,
  cleanLearningMult: 1.0,
  nuclearBuildMult: 1.0,
  collaboration: 1.0,
  tradeOpenness: 1.0,
  regulation: 1.0,
  governanceCapacity: 1.0,
  socialContract: 1.0,
  aiSafety: 1.0,
  biosecurity: 1.0,
  climateAdaptation: 1.0,
  diffusionMult: 1.0,
  capitalAvailability: 1.0,
  roboticsMult: 1.0,
  agingMult: 1.0,
  migrationMult: 1.0,
  climateSensitivity: 1.0,
  resourceAbundance: 1.0,
  spaceMult: 1.0,
  marineMult: 1.0,
  medianAgeShift: 0,
  longevityMult: 1.0,
  fusionMult: 1.0,
  geothermalMult: 1.0,
  bioenergyMult: 1.0,
  oceanEnergyMult: 1.0,
  hydrogenMult: 1.0,
  fertilityMult: 1.0,
  reproductionTechMult: 1.0,
  demographicVolatility: 1.0,
  collapseSeverityMult: 1.0,
  recoveryMult: 1.0,
  verticalMult: 1.0,
  undergroundMult: 1.0,
};

export type ParamDelta = Partial<SimParams>;

export interface ScenarioPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  delta: ParamDelta;
  accent: string;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'baseline_2026',
    name: 'Baseline 2026',
    tagline: 'What happens if the world simply continues?',
    description: 'Calibrated central tendencies plus uncertainty. No artificial intervention.',
    delta: {},
    accent: '#8B93A3',
  },
  {
    id: 'ai_flywheel',
    name: 'AI R&D Flywheel',
    tagline: 'What if AI starts meaningfully improving AI research itself?',
    description: 'Strengthens the recursive loop: capable AI improves software engineering, scientific reasoning and AI research. Watch what becomes the next bottleneck.',
    delta: { aiTooling: 1.9, aiFeedback: 2.4, aiProgressMult: 1.25 },
    accent: '#6E7BFF',
  },
  {
    id: 'energy_constraint',
    name: 'Energy Constraint',
    tagline: 'What if demand races ahead of grids and generation?',
    description: 'Computation and electrification demand grow rapidly while generation and transmission expansion stays slow and expensive.',
    delta: { buildSpeedMult: 0.5, energyCapexMult: 0.6 },
    accent: '#FFC94D',
  },
  {
    id: 'abundant_clean',
    name: 'Abundant Clean Energy',
    tagline: 'What if clean electricity gets cheap, fast?',
    description: 'Accelerated learning and deployment across solar, wind, hydro, geothermal, sustainable bioenergy, storage, hydrogen and nuclear. Fusion may arrive later, but abundance does not depend on it.',
    delta: { cleanLearningMult: 1.7, nuclearBuildMult: 1.9, geothermalMult: 1.5, bioenergyMult: 1.25, oceanEnergyMult: 1.3, hydrogenMult: 1.45, buildSpeedMult: 1.35, energyCapexMult: 1.3 },
    accent: '#4FD1A5',
  },
  {
    id: 'fragmented_world',
    name: 'Fragmented World',
    tagline: 'What if scientific openness collapses into blocs?',
    description: 'Export controls, restricted researcher mobility, incompatible ecosystems. Same physics — different institutions.',
    delta: { collaboration: 0.45, tradeOpenness: 0.5, migrationMult: 0.5 },
    accent: '#FF8A5C',
  },
  {
    id: 'ascent',
    name: 'Capability Ascent (Type I path)',
    tagline: 'What if technological and physical capability expands unusually fast?',
    description: 'A capability-maximizing path: open collaboration, patient capital, fast clean build-out and priority for fusion, longevity, marine and space systems. It is not labeled a good society in advance: distribution, governance, resilience and ecological outcomes are scored separately.',
    delta: { aiTooling: 1.3, aiFeedback: 1.4, collaboration: 1.4, tradeOpenness: 1.2, capitalAvailability: 1.25, cleanLearningMult: 1.35, nuclearBuildMult: 1.5, buildSpeedMult: 1.2, spaceMult: 1.3, longevityMult: 1.3, fusionMult: 1.4, migrationMult: 1.2 },
    accent: '#f6c177',
  },
  {
    id: 'ocean_century',
    name: 'Ocean Century',
    tagline: 'What if the sea, not the sky, is where the island expands?',
    description: 'Marine platforms, offshore energy and seabed minerals get the political priority that space gets in the Ascent preset. Space programs are funded late. Sea-level rise still gets a vote: reclaimed land needs dikes forever, and a civilization that cannot pay for them loses the districts it built.',
    delta: { marineMult: 1.7, spaceMult: 0.75, capitalAvailability: 1.15, cleanLearningMult: 1.2, collaboration: 1.15 },
    accent: '#3fa7c8',
  },
  {
    id: 'hothouse_collapse',
    name: 'Hothouse',
    tagline: 'What if the fuel stays cheap, the climate is touchy, and nobody cooperates?',
    description: 'Abundant cheap fossil fuel keeps burning, the climate responds at the high end of the estimates, trade and research are fragmented, capital is scarce and clean learning slow. Harvests fail first, then states. This is the preset that can end civilization.',
    delta: { climateSensitivity: 2.2, resourceAbundance: 1.8, collaboration: 0.45, tradeOpenness: 0.5, capitalAvailability: 0.65, cleanLearningMult: 0.5, aiProgressMult: 0.55, aiTooling: 0.7, roboticsMult: 0.6, migrationMult: 0.6, nuclearBuildMult: 0.5, fusionMult: 0.5, spaceMult: 0.5, collapseSeverityMult: 1.55, recoveryMult: 0.7 },
    accent: '#c43d2f',
  },
  {
    id: 'everywhere',
    name: 'Inhabit Everything',
    tagline: 'What if sea, sky and orbit all get funded, and the climate is engineered?',
    description: 'A young civilization keeps growing until ordinary land is genuinely scarce. It can answer by building taller, underground, onto the shelf, on floating districts, under the sea, in orbit and eventually farther out. Each habitat has its own energy, maintenance and failure modes.',
    delta: { medianAgeShift: -7, fertilityMult: 1.2, demographicVolatility: 1.3, migrationMult: 1.4, verticalMult: 1.55, undergroundMult: 1.45, marineMult: 1.35, oceanEnergyMult: 1.45, spaceMult: 1.35, fusionMult: 1.45, longevityMult: 1.3, aiTooling: 1.3, aiFeedback: 1.4, collaboration: 1.4, tradeOpenness: 1.2, capitalAvailability: 1.3, cleanLearningMult: 1.35, nuclearBuildMult: 1.5, buildSpeedMult: 1.2 },
    accent: '#7fd0ff',
  },
  {
    id: 'resource_crunch',
    name: 'Resource Crunch',
    tagline: 'What if the cheap reserves run out before the substitutes arrive?',
    description: 'Fossil and critical-mineral reserves are at the low end of estimates, recycling starts weak, and build-out is slow. The model must try substitution: geothermal, bioenergy, hydrogen, ocean power, efficiency, recycling, fission, fusion and eventually off-world materials. There is no single magic exit.',
    delta: { resourceAbundance: 0.55, buildSpeedMult: 0.75, energyCapexMult: 0.8, geothermalMult: 1.25, bioenergyMult: 1.2, hydrogenMult: 1.2, oceanEnergyMult: 1.2, spaceMult: 0.7, fusionMult: 0.7, capitalAvailability: 0.85 },
    accent: '#c0654a',
  },
  {
    id: 'long_stagnation',
    name: 'Long Stagnation',
    tagline: 'What if AI plateaus and the big bets never pay off?',
    description: 'AI progress slows to a crawl, frontier programs stall, aging societies shrink, and infrastructure built for a larger population must be paid for by fewer people.',
    delta: { aiProgressMult: 0.45, aiFeedback: 0.4, aiTooling: 0.6, roboticsMult: 0.6, spaceMult: 0.4, longevityMult: 0.4, fusionMult: 0.4, agingMult: 1.3, fertilityMult: 0.88, demographicVolatility: 0.7, capitalAvailability: 0.85 },
    accent: '#7d8597',
  },
  {
    id: 'open_knowledge',
    name: 'Open Knowledge',
    tagline: 'What if every major civilization shares research openly?',
    description: 'Strong collaboration, researcher mobility, technology transfer and common standards.',
    delta: { collaboration: 1.5, tradeOpenness: 1.35, migrationMult: 1.3, diffusionMult: 1.2 },
    accent: '#4FC3F7',
  },
  {
    id: 'human_centered_abundance',
    name: 'Human-Centered Abundance',
    tagline: 'What if productivity rises fast and institutions deliberately spread the gains?',
    description: 'Fast AI, robotics and clean electricity combined with capable government, strong social insurance, high diffusion and serious safety investment. Space is optional. This scenario tests whether an Earth-bound civilization can flourish without maximizing frontier milestones.',
    delta: { aiProgressMult: 1.2, roboticsMult: 1.35, cleanLearningMult: 1.45, energyCapexMult: 1.25, governanceCapacity: 1.35, socialContract: 1.45, aiSafety: 1.35, biosecurity: 1.25, climateAdaptation: 1.3, diffusionMult: 1.3, spaceMult: 0.75 },
    accent: '#71D6A4',
  },
  {
    id: 'automation_divide',
    name: 'Automation Divide',
    tagline: 'What if machines get much better but the social contract does not?',
    description: 'Fast AI and robotics diffuse through firms while institutions lag and gains concentrate. Output can soar while trust, distribution and political stability deteriorate.',
    delta: { aiProgressMult: 1.35, aiTooling: 1.35, roboticsMult: 1.6, diffusionMult: 1.35, socialContract: 0.58, governanceCapacity: 0.78, aiSafety: 0.75, regulation: 1.2 },
    accent: '#E88973',
  },
  {
    id: 'resilient_earth',
    name: 'Resilient Earth',
    tagline: 'What if civilization chooses adaptation, public capacity and sufficiency over maximum expansion?',
    description: 'Clean build-out, strong institutions, climate adaptation, biosecurity and broad diffusion are prioritized; frontier space programs are modest. A deliberate test of a compact, prosperous, mostly Earth-bound future.',
    delta: { cleanLearningMult: 1.45, energyCapexMult: 1.25, buildSpeedMult: 1.2, governanceCapacity: 1.4, socialContract: 1.25, climateAdaptation: 1.55, biosecurity: 1.4, aiSafety: 1.3, diffusionMult: 1.15, spaceMult: 0.55, marineMult: 0.85 },
    accent: '#7EB8A5',
  },
  {
    id: 'polycrisis',
    name: 'Polycrisis',
    tagline: 'What if several manageable stresses arrive together and institutions are weak?',
    description: 'Energy construction slows, trade fragments, climate impacts intensify, biosecurity and AI assurance are weak, and fiscal/institutional capacity is poor. No single apocalypse switch: compounding interactions create the risk.',
    delta: { buildSpeedMult: 0.7, energyCapexMult: 0.72, collaboration: 0.65, tradeOpenness: 0.65, governanceCapacity: 0.62, socialContract: 0.72, aiSafety: 0.68, biosecurity: 0.62, climateAdaptation: 0.62, climateSensitivity: 1.35, capitalAvailability: 0.75, migrationMult: 0.7 },
    accent: '#B95C57',
  },
  {
    id: 'ai_safety_first',
    name: 'AI Safety First',
    tagline: 'What if deployment is slower but evaluation and institutional control are much stronger?',
    description: 'Frontier research continues, but diffusion is cautious and assurance capacity is high. The scenario tests the real tradeoff between slower deployment, fewer incidents and stronger social legitimacy.',
    delta: { regulation: 0.78, diffusionMult: 0.72, aiSafety: 1.6, governanceCapacity: 1.3, socialContract: 1.15, aiProgressMult: 0.95 },
    accent: '#8EA6E8',
  },
  {
    id: 'population_spring',
    name: 'Population Spring',
    tagline: 'What if rich, educated societies start having large families again?',
    description: 'A deliberately non-consensus demographic branch: family formation rebounds, assisted reproduction becomes routine, and population keeps expanding until food, housing, energy, materials or politics become the real constraint.',
    delta: { fertilityMult: 1.48, reproductionTechMult: 1.5, demographicVolatility: 1.4, socialContract: 1.15, verticalMult: 1.35, undergroundMult: 1.2, marineMult: 1.2, spaceMult: 1.2 },
    accent: '#F0A7C0',
  },
  {
    id: 'vertical_world',
    name: 'Vertical World',
    tagline: 'What if the island refuses to spread outward?',
    description: 'Land is conserved. Growth goes upward into arcologies and downward into underground districts before reclamation or space. Density buys land, but creates construction, evacuation, heat and infrastructure dependencies.',
    delta: { verticalMult: 1.9, undergroundMult: 1.7, marineMult: 0.65, spaceMult: 0.75, fertilityMult: 1.18, buildSpeedMult: 1.25, governanceCapacity: 1.2 },
    accent: '#B7A0E8',
  },
  {
    id: 'hydrogen_archipelago',
    name: 'Hydrogen Archipelago',
    tagline: 'What if cheap clean power turns the coast into an industrial energy network?',
    description: 'Offshore wind, tidal/wave/OTEC, electrolysis, hydrogen storage and derivative fuels become strategic infrastructure for industry, shipping and long-duration storage. Hydrogen helps only when clean primary energy exists to make it.',
    delta: { hydrogenMult: 1.9, oceanEnergyMult: 1.8, marineMult: 1.55, cleanLearningMult: 1.35, buildSpeedMult: 1.25, geothermalMult: 1.15 },
    accent: '#62C9CF',
  },
  {
    id: 'collapse_and_return',
    name: 'Collapse & Return',
    tagline: 'What if states fail, cities empty — and survivors later come back?',
    description: 'Severe compound shocks can depopulate whole regions. Infrastructure decays and vegetation reclaims abandoned districts. Recovery is possible only from surviving embodied, off-world or digital populations with enough energy, knowledge and institutional capacity to resettle.',
    delta: { collapseSeverityMult: 1.90, climateSensitivity: 1.35, governanceCapacity: 0.66, socialContract: 0.72, climateAdaptation: 0.60, biosecurity: 0.65, tradeOpenness: 0.55, collaboration: 0.65, buildSpeedMult: 0.78, fertilityMult: 0.90, migrationMult: 1.25, recoveryMult: 4.5, demographicVolatility: 1.55 },
    accent: '#9DB36A',
  },
  {
    id: 'terminal_cascade',
    name: 'Terminal Cascade',
    tagline: 'Can the model actually lose everyone?',
    description: 'A falsification scenario for extinction logic: severe climate, disease, conflict, infrastructure failure and weak recovery interact. If every embodied, off-world and digital population reaches zero, civilization does not respawn. The island keeps changing without us.',
    delta: { collapseSeverityMult: 2.35, climateSensitivity: 2.35, biosecurity: 0.45, governanceCapacity: 0.45, socialContract: 0.55, climateAdaptation: 0.45, collaboration: 0.45, tradeOpenness: 0.4, buildSpeedMult: 0.55, recoveryMult: 0.35, fertilityMult: 0.85 },
    accent: '#7A302B',
  },
  {
    id: 'deep_diaspora',
    name: 'Deep Diaspora',
    tagline: 'What if the island stops being the center of civilization?',
    description: 'Closed-loop habitats, autonomous industry and space systems receive sustained investment. Population can spread from Earth to orbit, Mars and deep-space settlements. Earth can later decline without implying that civilization itself is extinct.',
    delta: { spaceMult: 1.8, fusionMult: 1.45, nuclearBuildMult: 1.35, aiTooling: 1.25, roboticsMult: 1.45, capitalAvailability: 1.35, collaboration: 1.25, fertilityMult: 1.16, reproductionTechMult: 1.25 },
    accent: '#87A7FF',
  },
];

// ── Scenario Builder: polished labels → structured deltas ───────────────────
export interface BuilderAxis {
  id: string;
  label: string;
  options: Array<{ label: string; delta: ParamDelta }>;
  defaultIndex: number;
}

export const BUILDER_AXES: BuilderAxis[] = [
  {
    id: 'ai', label: 'AI progress', defaultIndex: 1,
    options: [
      { label: 'Slower', delta: { aiProgressMult: 0.6, aiTooling: 0.7, aiFeedback: 0.5 } },
      { label: 'Empirical baseline', delta: {} },
      { label: 'Faster', delta: { aiProgressMult: 1.3, aiTooling: 1.3 } },
      { label: 'Strong R&D feedback', delta: { aiProgressMult: 1.2, aiTooling: 1.8, aiFeedback: 2.2 } },
    ],
  },
  {
    id: 'energy', label: 'Energy availability', defaultIndex: 1,
    options: [
      { label: 'Constrained', delta: { buildSpeedMult: 0.55, energyCapexMult: 0.65 } },
      { label: 'Baseline', delta: {} },
      { label: 'Expanding', delta: { buildSpeedMult: 1.25, energyCapexMult: 1.2 } },
      { label: 'Abundant portfolio', delta: { cleanLearningMult: 1.7, nuclearBuildMult: 1.8, geothermalMult: 1.5, bioenergyMult: 1.3, oceanEnergyMult: 1.35, hydrogenMult: 1.5, buildSpeedMult: 1.35, energyCapexMult: 1.35 } },
    ],
  },
  {
    id: 'collaboration', label: 'Research collaboration', defaultIndex: 2,
    options: [
      { label: 'Fragmented', delta: { collaboration: 0.45, tradeOpenness: 0.55 } },
      { label: 'Competitive', delta: { collaboration: 0.8 } },
      { label: 'Baseline', delta: {} },
      { label: 'Highly open', delta: { collaboration: 1.5, tradeOpenness: 1.35 } },
    ],
  },
  {
    id: 'regulation', label: 'Regulation', defaultIndex: 2,
    options: [
      { label: 'Restrictive', delta: { regulation: 0.6 } },
      { label: 'Cautious', delta: { regulation: 0.85 } },
      { label: 'Baseline', delta: {} },
      { label: 'Permissive', delta: { regulation: 1.35 } },
    ],
  },
  {
    id: 'capital', label: 'Capital availability', defaultIndex: 1,
    options: [
      { label: 'Scarce', delta: { capitalAvailability: 0.65 } },
      { label: 'Baseline', delta: {} },
      { label: 'High', delta: { capitalAvailability: 1.4 } },
    ],
  },
  {
    id: 'robotics', label: 'Robotics progress', defaultIndex: 1,
    options: [
      { label: 'Slow', delta: { roboticsMult: 0.6 } },
      { label: 'Baseline', delta: {} },
      { label: 'Accelerated', delta: { roboticsMult: 1.6 } },
    ],
  },
  {
    id: 'resources', label: 'Finite resources', defaultIndex: 1,
    options: [
      { label: 'Scarce', delta: { resourceAbundance: 0.55 } },
      { label: 'Central estimate', delta: {} },
      { label: 'Abundant', delta: { resourceAbundance: 1.6 } },
    ],
  },
  {
    id: 'frontier', label: 'Frontier programs', defaultIndex: 1,
    options: [
      { label: 'Neglected', delta: { spaceMult: 0.4, longevityMult: 0.5, fusionMult: 0.5 } },
      { label: 'Baseline', delta: {} },
      { label: 'Funded', delta: { spaceMult: 1.3, longevityMult: 1.3, fusionMult: 1.4 } },
      { label: 'Priority', delta: { spaceMult: 1.6, longevityMult: 1.5, fusionMult: 1.7 } },
    ],
  },
  {
    id: 'expansion', label: 'Where to expand', defaultIndex: 1,
    options: [
      { label: 'Sea first', delta: { marineMult: 1.6, spaceMult: 0.8 } },
      { label: 'Let the numbers decide', delta: {} },
      { label: 'Vertical / underground first', delta: { verticalMult: 1.7, undergroundMult: 1.6, marineMult: 0.7, spaceMult: 0.75 } },
      { label: 'Sky / space first', delta: { marineMult: 0.7, spaceMult: 1.5 } },
    ],
  },
  {
    id: 'governance', label: 'Institutional capacity', defaultIndex: 1,
    options: [
      { label: 'Weak', delta: { governanceCapacity: 0.65 } },
      { label: 'Baseline', delta: {} },
      { label: 'Capable', delta: { governanceCapacity: 1.35 } },
    ],
  },
  {
    id: 'distribution', label: 'Social contract', defaultIndex: 1,
    options: [
      { label: 'Concentrated gains', delta: { socialContract: 0.6 } },
      { label: 'Baseline', delta: {} },
      { label: 'Broadly shared', delta: { socialContract: 1.45 } },
    ],
  },
  {
    id: 'risk', label: 'Risk management', defaultIndex: 1,
    options: [
      { label: 'Thin safeguards', delta: { aiSafety: 0.65, biosecurity: 0.65 } },
      { label: 'Baseline', delta: {} },
      { label: 'High assurance', delta: { aiSafety: 1.5, biosecurity: 1.45 } },
    ],
  },
  {
    id: 'adaptation', label: 'Climate adaptation', defaultIndex: 1,
    options: [
      { label: 'Reactive', delta: { climateAdaptation: 0.65 } },
      { label: 'Baseline', delta: {} },
      { label: 'Anticipatory', delta: { climateAdaptation: 1.5 } },
    ],
  },
  {
    id: 'demographics', label: 'Demographics', defaultIndex: 0,
    options: [
      { label: 'Baseline (43 / 38 / 29)', delta: {} },
      { label: 'Older (like Japan, Germany)', delta: { medianAgeShift: 5, agingMult: 1.3 } },
      { label: 'Younger (like India, Nigeria)', delta: { medianAgeShift: -8, migrationMult: 1.2, fertilityMult: 1.12 } },
      { label: 'Low-fertility persistence', delta: { fertilityMult: 0.78, demographicVolatility: 0.55 } },
      { label: 'Fertility rebound', delta: { fertilityMult: 1.35, demographicVolatility: 1.4, reproductionTechMult: 1.25 } },
      { label: 'Higher migration', delta: { migrationMult: 1.8 } },
    ],
  },
];

export function mergeDeltas(...ds: ParamDelta[]): ParamDelta {
  const out: ParamDelta = {};
  for (const d of ds) Object.assign(out, d);
  return out;
}

export function applyDelta(base: SimParams, d: ParamDelta): SimParams {
  return { ...base, ...d };
}

// ── Safe What-If parser ─────────────────────────────────────────────────────
// Maps recognized natural-language patterns to validated structured deltas.
// Unknown text → no-op with explanation. Never arbitrary code.

export interface ParsedWhatIf {
  ok: boolean;
  label: string;
  delta: ParamDelta;
  explanation: string;
}

const PATTERNS: Array<{ re: RegExp; label: string; delta: ParamDelta; explanation: string }> = [
  { re: /ai.{0,40}(rapid|fast|accelerat|improv)/i, label: 'Faster AI progress', delta: { aiProgressMult: 1.35, aiTooling: 1.3 }, explanation: 'AI research speed and tooling multipliers raised.' },
  { re: /ai.{0,50}(improv|accelerat).{0,50}(ai research|itself|recursive|research)/i, label: 'AI improves AI research', delta: { aiFeedback: 2.4, aiTooling: 1.7 }, explanation: 'Recursive AI→R&D feedback strengthened.' },
  { re: /ai.{0,30}(plateau|stop|stagnat|slow)/i, label: 'AI progress plateaus', delta: { aiProgressMult: 0.45, aiFeedback: 0.4 }, explanation: 'AI progress sharply slowed after start.' },
  { re: /(electricity|energy|grid|power).{0,40}(slow|scarce|constrain|limit)/i, label: 'Constrained electricity', delta: { buildSpeedMult: 0.5, energyCapexMult: 0.6 }, explanation: 'Generation & grid buildout slowed and made costlier.' },
  { re: /(clean|solar|renewable|cheap).{0,30}energy|energy.{0,30}(cheap|abundant|clean)/i, label: 'Abundant clean energy', delta: { cleanLearningMult: 1.7, nuclearBuildMult: 1.8, buildSpeedMult: 1.3 }, explanation: 'Clean-energy learning and build speed accelerated.' },
  { re: /robot/i, label: 'Accelerated robotics', delta: { roboticsMult: 1.7 }, explanation: 'Robotics research and diffusion accelerated.' },
  { re: /(open|share|collaborat).{0,40}(research|science|knowledge)/i, label: 'Open scientific knowledge', delta: { collaboration: 1.5, tradeOpenness: 1.3 }, explanation: 'Cross-border research spillovers strengthened.' },
  { re: /(fragment|bloc|decoupl|export control|restrict)/i, label: 'Fragmented research blocs', delta: { collaboration: 0.45, tradeOpenness: 0.5 }, explanation: 'Spillovers and trade weakened; chip export controls tightened.' },
  { re: /(hydrogen|electroly|ammonia|e-fuel|synthetic fuel)/i, label: 'Hydrogen & derivative fuels', delta: { hydrogenMult: 1.8 }, explanation: 'Hydrogen infrastructure and sector coupling accelerated. Hydrogen still consumes primary energy to make.' },
  { re: /(geothermal|egs|deep drilling)/i, label: 'Geothermal expansion', delta: { geothermalMult: 1.8 }, explanation: 'Conventional and enhanced geothermal research/deployment receive priority.' },
  { re: /(biomass|bioenergy|biofuel)/i, label: 'Sustainable bioenergy expansion', delta: { bioenergyMult: 1.6 }, explanation: 'Bioenergy and biofuels expand within food/land/feedstock constraints.' },
  { re: /(tidal|wave power|otec|ocean energy)/i, label: 'Ocean energy expansion', delta: { oceanEnergyMult: 1.8, marineMult: 1.3 }, explanation: 'Tidal, wave and ocean-thermal systems receive priority.' },
  { re: /(fertility|baby boom|population boom|more children|pronatal)/i, label: 'Fertility rebound', delta: { fertilityMult: 1.4, demographicVolatility: 1.3 }, explanation: 'Family-formation regime shifts upward; population is constrained by lived conditions and physical capacity, not a fixed cap.' },
  { re: /(extinct|extinction|everyone dies|zero people|full death)/i, label: 'Terminal cascade stress test', delta: { collapseSeverityMult: 2.3, recoveryMult: 0.35, governanceCapacity: 0.5, biosecurity: 0.5, climateAdaptation: 0.5 }, explanation: 'Collapse severity rises and recovery weakens. If all human/digital/off-world continuity reaches zero, the model does not respawn civilization.' },
  { re: /(underground|arcology|vertical city|build up|under land)/i, label: 'Vertical and underground expansion', delta: { verticalMult: 1.8, undergroundMult: 1.7 }, explanation: 'High-rise arcologies and underground habitats become preferred land-pressure responses.' },
  { re: /fusion/i, label: 'Fusion program funded', delta: { fusionMult: 2.0, nuclearBuildMult: 1.4 }, explanation: 'Fusion research and repeat-build learning accelerated. Plants still take years and must be financed.' },
  { re: /(space|mars|asteroid|orbit|colon)/i, label: 'Space program funded', delta: { spaceMult: 2.0, capitalAvailability: 1.15 }, explanation: 'Launch, in-space industry and settlement research accelerated; patient capital slightly easier.' },
  { re: /(longevity|life extension|live longer|immortal|reverse aging|anti-aging)/i, label: 'Longevity program funded', delta: { longevityMult: 2.0 }, explanation: 'Longevity and regenerative medicine research accelerated. Clinical validation still takes decades.' },
  { re: /(resource|mineral|scarc|run out|deplet|peak oil|copper|lithium)/i, label: 'Scarce reserves', delta: { resourceAbundance: 0.55 }, explanation: 'Fossil and critical-mineral reserves set to the low end of estimates.' },
  { re: /(abundan|unlimited|plenty).{0,20}(resource|mineral)/i, label: 'Abundant reserves', delta: { resourceAbundance: 1.6 }, explanation: 'Reserves set to the high end of estimates.' },
  { re: /(type ?(i|1|one)|kardashev|ascent|utopia|golden age)/i, label: 'Ascent path', delta: { aiTooling: 1.3, aiFeedback: 1.4, collaboration: 1.4, capitalAvailability: 1.25, cleanLearningMult: 1.35, spaceMult: 1.3, longevityMult: 1.3, fusionMult: 1.4 }, explanation: 'Favorable choices for the long-horizon path. Frontier programs still only run where a civilization has earned them: stable, solvent, energy surplus, fed and housed.' },
  { re: /(reclaim|floating cit|sea cit|seastead|ocean|land from the sea|island|run out of land|no land)/i, label: 'Sea-first expansion', delta: { marineMult: 1.6, capitalAvailability: 1.1 }, explanation: 'Reclamation, floating districts, offshore energy and seabed minerals get political priority. They still need the technology, the money and a rising sea that is not already winning.' },
  { re: /(aging|ageing|older population)/i, label: 'Faster population aging', delta: { agingMult: 1.7 }, explanation: 'Working-age share declines faster; care burden rises.' },
  { re: /(migration|immigration)/i, label: 'Higher skilled migration', delta: { migrationMult: 1.9 }, explanation: 'Migration responsiveness to opportunity differentials raised.' },
  { re: /(strong|capable|effective).{0,30}(government|governance|institution)|institution.{0,20}(strong|capable)/i, label: 'Capable institutions', delta: { governanceCapacity: 1.4 }, explanation: 'Institutional execution and recovery capacity raised.' },
  { re: /(weak|failed|fragile).{0,30}(government|governance|institution)|institution.{0,20}(weak|fail)/i, label: 'Weak institutions', delta: { governanceCapacity: 0.62 }, explanation: 'Execution, maintenance and crisis-recovery capacity reduced.' },
  { re: /(inequal|winner.take.all|concentrat.{0,20}gain|weak social contract)/i, label: 'Concentrated gains', delta: { socialContract: 0.6 }, explanation: 'Automation gains translate less into income floors and lower inequality.' },
  { re: /(redistribut|shared prosperity|universal services|strong social contract|broadly shared)/i, label: 'Broad social contract', delta: { socialContract: 1.45 }, explanation: 'Institutions spread productivity gains more broadly and stabilize automation shocks.' },
  { re: /(ai safety|ai assurance|evaluation|oversight)/i, label: 'Stronger AI assurance', delta: { aiSafety: 1.5, regulation: 0.9 }, explanation: 'AI incident prevention and response strengthened; diffusion becomes somewhat more cautious.' },
  { re: /(biosecurity|pandemic preparedness|disease surveillance)/i, label: 'Stronger biosecurity', delta: { biosecurity: 1.5 }, explanation: 'Pandemic hazard and severity reduced through surveillance and response capacity.' },
  { re: /(climate adaptation|resilien.{0,20}climate|flood defence|heat adaptation)/i, label: 'Climate adaptation', delta: { climateAdaptation: 1.5 }, explanation: 'Infrastructure and agricultural adaptation reduce climate damage and drought exposure.' },
  { re: /(semiconductor|chip).{0,30}(shock|shortage|restrict)/i, label: 'Semiconductor shock', delta: { tradeOpenness: 0.6, collaboration: 0.7 }, explanation: 'Chip trade restricted; compute expansion slows outside producers.' },
];

export function parseWhatIf(text: string): ParsedWhatIf {
  const t = text.trim();
  if (t.length < 4) return { ok: false, label: '', delta: {}, explanation: 'Describe an assumption to change — e.g. “AI improves rapidly but electricity grows slowly”.' };
  const matched = PATTERNS.filter((p) => p.re.test(t));
  if (matched.length === 0) {
    return { ok: false, label: '', delta: {}, explanation: 'Could not map this to validated simulation parameters. Try themes: AI speed/safety, energy, robotics, openness/fragmentation, governance, inequality/social contract, biosecurity, climate adaptation, aging, migration, fusion, space, longevity, resources, chips.' };
  }
  const delta = mergeDeltas(...matched.map((m) => m.delta));
  return {
    ok: true,
    label: matched.map((m) => m.label).join(' + '),
    delta,
    explanation: matched.map((m) => m.explanation).join(' '),
  };
}
