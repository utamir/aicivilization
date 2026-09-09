// ─────────────────────────────────────────────────────────────────────────────
// INTERVENTIONS — player actions. Each consumes Influence and applies a
// validated structured effect (param override, queue injection, or civ effect).
// ─────────────────────────────────────────────────────────────────────────────
import type { CivId, InterventionEffect } from '../types';

export type { InterventionEffect };

export interface InterventionDef {
  id: string;
  label: string;
  category: 'research' | 'energy' | 'industry' | 'society' | 'geopolitics';
  description: string;
  cost: number;         // Influence
  scope: 'global' | 'civ' | 'relation';
  make: (civId: CivId | null, otherCiv: CivId | null) => InterventionEffect[];
}

export const INTERVENTIONS: InterventionDef[] = [
  {
    id: 'fund_fusion', label: 'Fund fusion program', category: 'research', scope: 'civ', cost: 30,
    description: 'A decade-scale national fusion program: pilot plants, materials, licensing. Pays off only if the pilot works.',
    make: () => [{ kind: 'effort', techId: 'fusion_power', mult: 2.4, months: 120 }],
  },
  {
    id: 'fund_longevity', label: 'Fund longevity research', category: 'research', scope: 'civ', cost: 25,
    description: 'Large trials of senescence clearance and partial reprogramming. Decades to validate; enormous if it works.',
    make: () => [{ kind: 'effort', techId: 'longevity_bio', mult: 2.2, months: 120 }],
  },
  {
    id: 'space_program', label: 'Commit national space program', category: 'industry', scope: 'civ', cost: 35,
    description: 'Reusable launch, spaceports, in-space industry and settlement. Patient capital for decades-long returns.',
    make: (c) => [{ kind: 'effort', techId: 'space_systems', mult: 2.0, months: 120 }, { kind: 'policy', civId: c!, policy: 'space_program', strength: 1.0, months: 240 }],
  },
  {
    id: 'basic_provision', label: 'Universal income & services floor', category: 'society', scope: 'civ', cost: 30,
    description: 'Decouple basic living standards from employment. Eases automation backlash; costs a permanent share of output.',
    make: (c) => [{ kind: 'policy', civId: c!, policy: 'basic_provision', strength: 0.8, months: 360 }],
  },
  {
    id: 'coastal_expansion', label: 'Coastal expansion programme', category: 'industry', scope: 'civ', cost: 25,
    description: 'National programme to reclaim shallow shelf and build floating districts when the island runs out of land. Decades of dredging, dikes and pumps; the sea gets a vote.',
    make: (c) => [{ kind: 'policy', civId: c!, policy: 'coastal_expansion', strength: 1.0, months: 240 }],
  },
  {
    id: 'circular_economy', label: 'Circular-materials mandate', category: 'industry', scope: 'civ', cost: 20,
    description: 'Design-for-disassembly rules, deposit schemes and recovery plants for critical minerals.',
    make: (c) => [{ kind: 'build', civId: c!, buildType: 'recycling', amountGW: 0.06 }],
  },
  {
    id: 'fund_ai', label: 'Fund frontier AI research', category: 'research', scope: 'civ', cost: 25,
    description: 'Direct a major public-private program at frontier AI capability and agent reliability.',
    make: () => [{ kind: 'effort', techId: 'ai_models', mult: 1.8, months: 48 }, { kind: 'effort', techId: 'ai_agents', mult: 1.8, months: 48 }],
  },
  {
    id: 'fund_biotech', label: 'Fund biotechnology', category: 'research', scope: 'civ', cost: 20,
    description: 'Expand computational discovery and wet-lab capacity for therapeutics and diagnostics.',
    make: () => [{ kind: 'effort', techId: 'biotech_med', mult: 2.0, months: 60 }],
  },
  {
    id: 'build_dc', label: 'Build data-center capacity', category: 'industry', scope: 'civ', cost: 25,
    description: 'Fast-track data-center construction. They will need electricity — a lot of it.',
    make: (c) => [{ kind: 'build', civId: c!, buildType: 'datacenter', amountGW: 3 }],
  },
  {
    id: 'expand_grid', label: 'Emergency grid expansion', category: 'energy', scope: 'civ', cost: 30,
    description: 'Override permitting queues and fund transmission buildout directly.',
    make: (c) => [{ kind: 'build', civId: c!, buildType: 'grid', amountGW: 8 }],
  },
  {
    id: 'build_clean', label: 'Accelerated clean buildout', category: 'energy', scope: 'civ', cost: 25,
    description: 'Subsidize rapid solar and wind deployment with storage pairing.',
    make: (c) => [{ kind: 'build', civId: c!, buildType: 'solar', amountGW: 6 }, { kind: 'build', civId: c!, buildType: 'wind', amountGW: 4 }],
  },
  {
    id: 'build_nuclear', label: 'Commit nuclear program', category: 'energy', scope: 'civ', cost: 35,
    description: 'A decade-long commitment: firm clean power, if institutions hold.',
    make: (c) => [{ kind: 'build', civId: c!, buildType: 'nuclear', amountGW: 4 }],
  },
  {
    id: 'build_fab', label: 'Subsidize semiconductor fab', category: 'industry', scope: 'civ', cost: 40,
    description: 'Commit ~$20B-class incentives toward leading-edge fabrication capacity.',
    make: (c) => [{ kind: 'build', civId: c!, buildType: 'fab', amountGW: 1 }],
  },
  {
    id: 'retraining', label: 'Mass worker retraining', category: 'society', scope: 'civ', cost: 20,
    description: 'Fund large-scale occupational transition programs for displaced workers.',
    make: (c) => [{ kind: 'policy', civId: c!, policy: 'retraining', strength: 1, months: 72 }],
  },
  {
    id: 'ubs', label: 'Universal basic services', category: 'society', scope: 'civ', cost: 35,
    description: 'Guarantee housing, health and connectivity regardless of employment.',
    make: (c) => [{ kind: 'policy', civId: c!, policy: 'ubs', strength: 1, months: 120 }],
  },
  {
    id: 'education', label: 'Education expansion', category: 'society', scope: 'civ', cost: 25,
    description: 'Long-horizon investment in human capital and research capacity.',
    make: (c) => [{ kind: 'policy', civId: c!, policy: 'education', strength: 1, months: 120 }],
  },
  {
    id: 'attract_scientists', label: 'Attract global scientists', category: 'society', scope: 'civ', cost: 20,
    description: 'Open visas and fund chairs for world-class researchers.',
    make: (c) => [{ kind: 'policy', civId: c!, policy: 'attract_scientists', strength: 1, months: 60 }],
  },
  {
    id: 'regulate_ai', label: 'Licensing for high-autonomy AI', category: 'geopolitics', scope: 'civ', cost: 15,
    description: 'Mandatory licensing slows deployment but raises safety and public trust.',
    make: (c) => [{ kind: 'society', civId: c!, stat: 'regCaution', delta: 0.2 }, { kind: 'society', civId: c!, stat: 'trust', delta: 0.05 }],
  },
  {
    id: 'chip_controls', label: 'Semiconductor export controls', category: 'geopolitics', scope: 'relation', cost: 15,
    description: 'Restrict accelerator exports to a rival. Protects lead; corrodes relations.',
    make: (_c, other) => [{ kind: 'relation', a: _c!, b: other!, field: 'chipExportAllowed', value: false }],
  },
  {
    id: 'research_alliance', label: 'International research alliance', category: 'geopolitics', scope: 'relation', cost: 25,
    description: 'Shared programs, common standards, open publication between two civilizations.',
    make: (_c, other) => [{ kind: 'relation', a: _c!, b: other!, field: 'sciCollaboration', value: 1 }],
  },
  {
    id: 'subsidize_robotics', label: 'Subsidize automation adoption', category: 'industry', scope: 'civ', cost: 20,
    description: 'Accelerate diffusion of robotics into manufacturing and logistics.',
    make: (c) => [{ kind: 'policy', civId: c!, policy: 'subsidize_robotics', strength: 1, months: 60 }],
  },
];

export const INFLUENCE_START = 60;
export const INFLUENCE_REGEN_PER_YEAR = 6;
