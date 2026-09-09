// ─────────────────────────────────────────────────────────────────────────────
// WHAT IF? CIVILIZATION LAB — core simulation types
// Time unit: months since start (September 2026). All rates are per-year unless noted.
// ─────────────────────────────────────────────────────────────────────────────

export type CivId = 'veloria' | 'ardan' | 'nemea';
export type TechId =
  | 'ai_models' | 'ai_agents'
  | 'compute_accel' | 'semiconductor_fab'
  | 'solar_pv' | 'wind_power' | 'nuclear_power' | 'geothermal_power' | 'bioenergy_systems' | 'ocean_energy' | 'hydrogen_systems' | 'storage_batt' | 'grid_transmission'
  | 'robotics_ind' | 'robotics_gp'
  | 'biotech_med' | 'longevity_bio'
  | 'transport_ev' | 'transport_av'
  | 'fusion_power' | 'space_systems';

export type TechDomain = 'ai' | 'compute' | 'energy' | 'robotics' | 'biotech' | 'transport' | 'frontier';

export type TechPhase =
  | 'science' | 'prototype' | 'engineering' | 'deployment' | 'diffusion' | 'mature';

export interface Adoption {
  arrived: boolean;       // accessible in this civilization at all
  penetration: number;    // 0..1 how widely used
  intensity: number;      // 0..1 how deeply integrated into production/life
}

export interface TechState {
  id: TechId;
  cap: number;            // capability index; 1.0 = 2026 frontier level
  paradigmCap: number;    // asymptote of current paradigm (cap units)
  paradigm: number;       // paradigm generation (1 = 2026 paradigm)
  maturity: number;       // 0..1 engineering maturity
  reliability: number;    // 0..1
  cost: number;           // unit-cost index; 1.0 = 2026
  mfg: number;            // manufacturing capacity index; 1.0 = 2026 global
  cumulative: number;     // cumulative production (experience-curve driver)
  effort: number;         // current effective research effort (index, global)
  uncertainty: number;    // epistemic sigma on growth-rate (fraction)
  phase: TechPhase;
  lastGrowthRate: number; // fractional capability growth per year (for velocity UI)
  growthAccel: number;    // change in growth rate (per year^2)
  adoption: Record<CivId, Adoption>;
  depReady: number;       // 0..1 aggregate dependency readiness (cached)
  bottleneck: string;     // current dominant limiting factor label (cached)
}

export interface EnergySource {
  cap: number;            // installed GW nameplate
  underConstruction: number; // GW in legacy/source-specific pipeline view
  queue: Array<{ gw: number; monthsLeft: number }>; // retained for intervention/UI compatibility
  condition: number;      // 0..1 weighted average physical condition
  avgAgeYears: number;    // weighted fleet age
  maintenanceBacklog: number; // 0..1 deferred maintenance pressure
}

export type ProjectKind =
  | 'solar' | 'wind' | 'nuclear' | 'geothermal' | 'bioenergy' | 'ocean_energy' | 'hydrogen_hub' | 'fossil' | 'grid' | 'datacenter' | 'housing' | 'arcology' | 'underground_habitat' | 'fab' | 'storage'
  | 'fusion' | 'recycling' | 'spaceport' | 'asteroid_mining' | 'orbital_habitat' | 'mars_colony' | 'interstellar_ark' | 'space_elevator' | 'power_satellite'
  | 'land_reclamation' | 'floating_district' | 'seabed_mining' | 'offshore_energy' | 'subsea_habitat' | 'aerial_platform';
export type ProjectStatus = 'proposed' | 'approved' | 'financed' | 'under_construction' | 'commissioning' | 'operational' | 'cancelled';
export interface ProjectState {
  id: string;
  civId: CivId;
  kind: ProjectKind;
  status: ProjectStatus;
  capacity: number;       // GW for power/grid/DC, stock-index points for housing, index for fab/storage
  capex: number;          // normalized investment units
  spent: number;
  monthsRemaining: number;
  totalMonths: number;
  proposedAt: number;
  startedAt?: number;
  completedAt?: number;
  delayMonths: number;
  rationale: string;
}

export type EnergySourceKey = 'fossil' | 'nuclear' | 'solar' | 'wind' | 'hydro' | 'geothermal' | 'bioenergy' | 'ocean' | 'fusion';

export interface EnergyState {
  demandTWh: number;      // annualized electricity demand
  baseDemandTWh: number;
  computeDemandTWh: number;
  sources: Record<EnergySourceKey, EnergySource>;
  spaceSolarTWh: number;  // electricity beamed from orbital power satellites / Dyson swarm elements
  hydrogen: {              // hydrogen is an energy carrier/storage medium, never free primary energy
    electrolyzerGW: number;
    fuelCellGW: number;
    storageTWh: number;
    storageCapacityTWh: number;
    cleanShare: number;
    industryShare: number;
    transportShare: number;
  };
  storageGWh: number;
  gridCapGW: number;      // transmission/distribution delivery ceiling
  gridQueue: Array<{ gw: number; monthsLeft: number }>;
  marginPct: number;      // deliverable supply vs demand margin (%)
  priceIndex: number;     // 1.0 = 2026 retail
  constrained: boolean;
  servedTWh: number;      // electricity actually delivered after load shedding
  unservedTWh: number;    // unmet annualized electricity demand
  criticalServedRatio: number;
  industryServedRatio: number;
  computeServedRatio: number;
  gridCondition: number;  // 0..1 physical grid condition
  gridMaintenanceBacklog: number;
}

export interface ComputeState {
  accelStock: number;      // accelerator stock index (1 = 2026)
  dcCapGW: number;         // data-center capacity GW
  dcQueue: Array<{ gw: number; monthsLeft: number }>;
  supplyFlops: number;     // effective compute-service supply index (legacy field name; NOT literal FLOP/s)
  demandFlops: number;     // demanded compute-service index (same normalized units)
  constrained: boolean;
}

export interface EconomyState {
  output: number;          // GDP proxy index (1 = 2026)
  tfp: number;             // total-factor productivity index
  capital: number;         // capital stock index
  laborForce: number;      // millions
  unemployment: number;    // 0..1
  automationExposure: number; // 0..1 share of tasks technically automatable now
  displacedShare: number;  // cumulative displacement pressure 0..1
  wageIndex: number;       // 1 = 2026 median wage
  gini: number;            // inequality proxy 0..1
  publicDebt: number;      // debt / output
  rdSpendShare: number;    // of output
  infraSpend: number;      // current infra investment index
  capexAvailability: number; // 0..1.5 financing condition
  outputScale: number;     // normalization constant so production fn matches 2026 output
  outputRefTWh: number;    // base electricity demand per unit output (2026)
  potentialOutput: number; // output possible before hard physical bottlenecks
  investmentBudget: number;// annualized investable resources, normalized to 2026 output
  maintenanceBudget: number; // annualized maintenance allocation
  institutionalCapacity: number; // 0..1 ability to execute/maintain projects
  capitalCondition: number; // 0..1 quality/availability of productive capital
  energyIntensityIndex: number; // energy required per unit of economic activity, 1 = 2026
  outputPerCapita: number;  // output index per million people, relative to the civ's own 2026 level (1 = 2026)
  materialCostIndex: number; // capex multiplier from mineral / fuel scarcity (1 = 2026)
}

export interface PopulationState {
  total: number;           // millions
  workingShare: number;    // 0..1
  medianAge: number;
  education: number;       // mean years-of-schooling-equivalent index (1 = 2026)
  fertility: number;       // births per woman
  urbanization: number;    // 0..1
  lifeExpectancy: number;  // years at birth
  offworld: number;        // millions living in orbital habitats / Mars / other bodies (counted in total)
  digitalShare: number;    // 0..1 share of the population living primarily as uploaded/digital minds
  birthRate: number;       // last computed crude birth rate (per year)
  deathRate: number;       // last computed crude death rate (per year)
  cohorts: number[];       // millions per five-year age band, 0–4 … 100+ (21 bands); total = sum
  peakPhysical: number;    // highest physical (Earth-resident, embodied) population so far — infrastructure was sized for it
}

export interface SocietyState {
  trust: number;           // 0..1 social trust
  stability: number;       // 0..1 political stability
  backlash: number;        // 0..1 automation/tech backlash pressure
  regCaution: number;      // 0..1 regulatory caution (dynamic)
  basicProvision: number;  // 0..1 strength of an income/service floor adopted when automation outruns jobs
  laborRelevance: number;  // 0..1 how much of material wellbeing still runs through wage labor
  syntheticProgram: 'none' | 'state' | 'family' | 'both' | 'ban'; // synthetic births policy once IVG and ectogenesis exist
  syntheticBirthsPerYear: number; // millions/yr from the programme
  lockdown: number;        // 0..1 pandemic restrictions in force
  fragmented: boolean;     // the polity has broken into regions
  lowStabilityMonths: number;
  revivalMonths: number;   // months left of a pro-natal cultural movement
  enhancement: 'none' | 'public' | 'private' | 'ban'; // germline enhancement policy
  familyFormation: number; // 0..1 structural/cultural support for having and raising children; evolves, not destiny
  polityStatus: 'active' | 'failed' | 'abandoned' | 'resettling';
  autonomousInfrastructure: number; // 0..1 share of essential systems able to operate without local embodied labor
}

export interface CivTraits {
  openness: number; riskTolerance: number; sciencePriority: number;
  regulatoryCaution: number; marketOrientation: number; strategicAutonomy: number;
  educationBase: number; capitalWealth: number; energyEndowment: number;
}

export interface FoodState {
  demandIndex: number;    // food demand index (1 = 2026), driven by population & affluence
  landCapacity: number;   // max conventional production index (endowment, relative to initial demand)
  landYield: number;      // conventional agriculture yield index (1 = 2026 baseline)
  landUse: number;        // share of land capacity cultivated (falls as artificial food rises → rewilding)
  artificialShare: number; // share of demand met by vertical farms / precision fermentation (0–1)
  productionIndex: number; // total domestic production index (relative to initial demand)
  selfSufficiency: number; // domestic production / demand
  importShare: number;    // share of demand covered by imports
  shortage: number;       // unmet demand after trade 0..0.5 — drives mortality, unrest, prices
  priceIndex: number;     // food price (1 = baseline)
  artificialUnlocked: boolean;
}

export interface HousingState {
  demandIndex: number;  // housing units demanded (1 = 2026), driven by population & urbanization
  stockIndex: number;   // housing stock (1 = 2026)
  crowding: number;     // 0..1 — living-space shortage pressure
  rentIndex: number;    // cost of living space (1 = 2026)
  condition: number;    // 0..1 physical condition of housing stock
  vacancy: number;      // 0..1 unused/abandoned stock
  maintenanceBacklog: number;
  abandoned: number;    // 0..1 share of the stock that is derelict: nobody lives there, nobody maintains it
}

export interface LandState {
  // The world is an island continent. Land is finite; the sea around it is the
  // only place to expand. All indices are relative to the civilization's usable
  // land in 2026 (usable = 1 at start).
  usable: number;       // developable land incl. reclaimed (1 = 2026)
  urban: number;        // share of 2026-usable land under cities, roads, industry
  farm: number;         // share under agriculture
  energy: number;       // share under solar farms / wind / mines
  free: number;         // 0..1 share still free (forest, wild, unusable-but-buildable)
  pressure: number;     // 0..1+ demand for land vs supply (1 = every usable hectare committed)
  densityIndex: number; // urban density relative to 2026 (building up instead of out)
  brownfield: number;   // cleared urban land waiting for reuse (index units): rebuilt on before any new land is taken
  builtStock: number;   // land-based housing stock the urban footprint was last computed for (ratchet: cities do not shrink when they densify)
  reclaimed: number;    // land added from the sea (index units)
  reclaimedCondition: number; // 0..1 dikes, pumps, drainage; falls without maintenance and with sea-level rise
  floating: number;     // housing capacity on floating platforms (housing-stock index units)
  shelf: number;        // cheap-to-reclaim shallow shelf remaining (index units)
  seaExposure: number;  // 0..1 share of urban land exposed to sea-level rise
  lost: number;         // land lost to flooding / abandonment of reclaimed districts (index units)
  seabedInflow: number; // annual critical-mineral supply from seabed nodules and vent deposits (world-stock units)
  offshoreGW: number;   // offshore wind / ocean-thermal capacity: counted in the wind fleet, takes no land
  subsea: number;       // housing capacity in pressure-hull habitats on the shelf floor (housing-stock index units)
  aerial: number;       // housing capacity on stratospheric platforms (housing-stock index units)
  vertical: number;     // above-ground arcology capacity beyond ordinary urban density (housing-stock index units)
  underground: number;  // underground habitat capacity (housing-stock index units)
  wildReclaimed: number;// 0..1 share of abandoned developed land undergoing ecological succession
  floatingCondition: number;   // 0..1 marine platform structure/mooring/service condition
  subseaCondition: number;     // 0..1 pressure hull/seal/pump/life-support condition
  verticalCondition: number;   // 0..1 arcology structure/lift/fire/utility condition
  undergroundCondition: number;// 0..1 waterproofing/drainage/ventilation/access condition
}

export interface WasteState {
  generatedIndex: number;  // waste generated (1 = 2026), population × affluence
  managedShare: number;    // 0..1 share recycled / safely processed
  accumulation: number;    // unmanaged waste stock index — persists, decays slowly
}

export interface CivState {
  id: CivId;
  name: string;
  color: string;
  traits: CivTraits;
  population: PopulationState;
  economy: EconomyState;
  energy: EnergyState;
  food: FoodState;
  housing: HousingState;
  waste: WasteState;
  land: LandState;
  compute: ComputeState;
  society: SocietyState;
  researchAlloc: Record<TechId, number>; // effort shares (sum ~1)
  researchCapacity: number;              // researcher-effort index
  researchProductivity: number;          // current productivity index (cached)
  strategicPriority: string;             // current autonomously chosen priority (display)
  space: SpaceState;
  /** 0..1: has this civilization earned the frontier? Stability, institutions, solvency, energy surplus, fed and housed people. */
  frontierReadiness: number;
}

export interface SpaceState {
  launchCostIndex: number;   // 1 = 2026 cost per kg to orbit; falls with reusable launch, then space elevator
  spaceportCapacity: number; // launch throughput index (0 = none)
  orbitalIndustry: number;   // in-space manufacturing / mining capacity index
  habitatCapacityM: number;  // people the civ's orbital habitats can house (millions)
  marsCapacityM: number;     // people the civ's Mars settlements can house (millions)
  marsPopulationM: number;   // people actually living on Mars (millions); subset of offworld
  deepSpaceCapacityM: number;// people that can live beyond planetary settlements / interstellar craft (millions)
  interstellarM: number;     // people currently living beyond the home star's settled planetary system (millions)
  elevator: boolean;         // space elevator operational
  powerSatelliteGW: number;  // orbital power capacity feeding the grid
  mineralInflow: number;     // annual mineral inflow from asteroid mining (world-stock units)
}

export interface ResourceState {
  // World-level finite stocks. Units are normalized to 2026 annual world consumption (=1/yr at start).
  fossilReserves: number;     // years of 2026-rate consumption remaining
  fossilExtractionRate: number; // current annual draw (in 2026-consumption units)
  fossilCostIndex: number;    // fuel cost (1 = 2026); rises as cheap reserves deplete
  mineralReserves: number;    // years of 2026-rate consumption of critical minerals (Li, Cu, REE, Ni)
  mineralDemand: number;      // annual demand (2026 units) from clean energy, compute, robotics
  mineralRecycled: number;    // annual supply from recycling
  mineralSpaceInflow: number; // annual supply from asteroid / lunar mining
  mineralSeabedInflow: number; // annual supply from seabed mining (nodules, vent deposits, seawater extraction)
  mineralCostIndex: number;   // 1 = 2026; rises as reserves deplete, falls with recycling and space supply
  recyclingRate: number;      // 0..1 circular share of mineral demand
  landPressure: number;       // 0..1 aggregate pressure on land (housing + agriculture + energy footprint)
}

export interface PendingDecision {
  key: string; defId: string; civId: CivId; title: string; question: string; raisedAt: number; deadline: number;
  options: { id: string; label: string; consequence: string }[];
}

export type MilestoneStatus = 'locked' | 'available' | 'in_progress' | 'achieved';

export interface MilestoneState {
  id: string;
  status: MilestoneStatus;
  progress: number;        // 0..1 for in_progress
  achievedAt?: number;     // tMonths
  achievedBy?: CivId;
  blockers: string[];      // human-readable unmet prerequisites (cached)
}

export interface OutcomeProfile {
  materialSecurity: number;   // 0..1 energy, food and housing actually delivered
  humanDevelopment: number;   // 0..1 health, education and basic provision
  institutionalHealth: number;// 0..1 trust, stability and execution capacity
  ecologicalSafety: number;   // 0..1 climate/resource pressure, not a moral score
  distribution: number;       // 0..1 broad access to gains (inverse inequality/exclusion)
  resilience: number;         // 0..1 spare capacity and ability to absorb shocks
  broadFlourishing: number;   // transparent geometric mean of the six axes
}

export type DevelopmentForm = 'earthbound' | 'oceanic' | 'spacefaring' | 'digital' | 'mixed';

export interface FrontierState {
  kardashev: number;       // Sagan formulation: K = (log10(P_watts) - 6) / 10
  energyCaptureTW: number; // total useful energy captured by all civs (TW)
  agi: boolean;
  asi: boolean;
  milestones: MilestoneState[];
  offworldPopulationM: number;
  digitalPopulationM: number;
  trajectory: 'flourishing' | 'ascent' | 'growth' | 'stagnation' | 'managed_decline' | 'crisis' | 'collapse' | 'extinction';
  trajectoryNote: string;
  /** Describes lived outcomes. Expansion is deliberately NOT part of this score. */
  outcome: OutcomeProfile;
  /** Describes where/how civilization lives; this is orthogonal to whether life is going well. */
  developmentForm: DevelopmentForm;
  era: string;
}

export interface RelationState {
  a: CivId; b: CivId;
  relation: number;        // -1..1
  tradeOpenness: number;   // 0..1
  sciCollaboration: number;// 0..1
  chipExportAllowed: boolean;
  tension: number;         // 0..1 conflict pressure
  grievances: string[];
}

export type EventCategory =
  | 'technology' | 'energy' | 'economy' | 'politics' | 'society'
  | 'science' | 'conflict' | 'environment' | 'milestone' | 'intervention' | 'character' | 'frontier' | 'resources';

export interface CausalFactor { factor: string; weight: number }

export interface ChronicleEvent {
  id: string;
  tMonths: number;
  year: number;
  title: string;
  body: string;
  category: EventCategory;
  civId?: CivId;
  techId?: TechId;
  causes: CausalFactor[];
  counterforces: CausalFactor[];
  confidence: 'low' | 'medium' | 'high';
  significance: 1 | 2 | 3;
}

export interface ResearchProgramState {
  id: string;
  civId: CivId;
  techId: TechId;
  title: string;
  objective: string;
  funding: number;       // normalized annual research resources
  progress: number;      // 0..1 toward a decisive result
  maturity: number;      // 0..1 validation/engineering progress after discovery
  status: 'active' | 'breakthrough' | 'validation' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  breakthroughAt?: number;
  leadCharacterId?: string;
  uncertainty: number;
}

export interface InventionState {
  id: string;
  techId: TechId;
  civId: CivId;
  name: string;
  discoveredAt: number;
  validatedAt?: number;
  deployedAt?: number;
  capabilityGain: number;
  paradigmLift: number;
  reliabilityPenalty: number;
  costPenalty: number;
  leadCharacterId?: string;
  sourceProgramId: string;
  status: 'discovered' | 'validated' | 'deployed' | 'failed';
}

export interface CharacterState {
  id: string;
  name: string;
  civId: CivId;
  role: string;
  age: number;
  prominence: number;      // 0..1
  history: Array<{ tMonths: number; text: string }>;
  beliefs: string[];
  concern: string;
  mood: number;            // -1..1 derived from conditions
  active?: boolean;        // false after death; retired characters remain inspectable history
  retiredAt?: number;
  diedAt?: number;
}

export interface EnvState {
  warmingC: number;        // °C above preindustrial (global)
  pressure: number;        // 0..1 aggregate environmental pressure per world
  /** Physical sea-level rise relative to the 2026 start. A lagged stock: it does not fall when air temperature falls. */
  seaLevelM: number;
  /** Slow equilibrium commitment implied by accumulated warming; monotonic on simulation timescales. */
  committedSeaLevelM: number;
}

export interface MetricsPoint {
  tMonths: number;
  year: number;
  // world aggregates
  aiCap: number; taskHorizonHrs: number; roboticsIndPen: number; evPen: number;
  biotechCap: number; computeSupply: number;
  // per civ (indexed by CivId order)
  output: Record<CivId, number>;
  unemployment: Record<CivId, number>;
  energyMargin: Record<CivId, number>;
  energyPrice: Record<CivId, number>;
  gini: Record<CivId, number>;
  stability: Record<CivId, number>;
  population: Record<CivId, number>;
  foodSecurity: Record<CivId, number>; // self-sufficiency incl. imports (1 = fully fed)
  researchVel: Record<CivId, number>; // aggregate research velocity %/yr
  kardashev: number;
  offworldPop: number;
  mineralCost: number;
  fossilReserves: number;
  lifeExpectancy: Record<CivId, number>;
  landPressure: Record<CivId, number>;
  readiness: Record<CivId, number>;
}

// ── Scenario parameters: every knob a preset/builder/parser can turn ─────────
export interface SimParams {
  // AI / research
  aiTooling: number;            // multiplier on AI→research tooling strength
  aiFeedback: number;           // strength of AI→AI-research recursive loop
  aiProgressMult: number;       // broad AI progress speed
  algorithmicHalvingMonths: number; // efficiency doubling pace (lower = faster)
  computeDoublingMonths: number;    // baseline compute supply trend
  // energy & physical build
  buildSpeedMult: number;       // construction speed multiplier (all infra)
  energyCapexMult: number;      // capital availability for energy buildout
  cleanLearningMult: number;    // clean-energy learning-rate multiplier
  nuclearBuildMult: number;     // nuclear construction speed
  // diffusion / institutions
  collaboration: number;        // 0..1.5 scientific collaboration & spillovers
  tradeOpenness: number;        // 0..1.5 baseline trade openness
  regulation: number;           // 0.5 restrictive .. 1.5 permissive (adoption drag inverse)
  governanceCapacity: number;    // 0.5 weak execution .. 1.5 highly capable institutions
  socialContract: number;        // 0.5 gains concentrate .. 1.5 broad distribution / automatic stabilizers
  aiSafety: number;              // 0.5 weak assurance .. 1.5 strong evaluation, monitoring and incident response
  biosecurity: number;           // 0.5 weak prevention/response .. 1.5 strong surveillance and countermeasures
  climateAdaptation: number;     // 0.5 weak adaptation .. 1.5 anticipatory infrastructure/agriculture
  diffusionMult: number;         // frontier-to-economy diffusion speed, separate from invention speed
  capitalAvailability: number;  // financing multiplier
  roboticsMult: number;         // robotics progress speed
  // demographics
  agingMult: number;            // faster aging if >1
  medianAgeShift: number;       // years added to every civilization's 2026 median age (negative = younger, higher fertility)
  migrationMult: number;        // migration responsiveness
  // climate
  climateSensitivity: number;   // warming rate multiplier
  // finite world & frontier
  resourceAbundance: number;    // multiplier on fossil & mineral reserves (1 = central estimate)
  spaceMult: number;            // space-systems research & launch build speed
  marineMult: number;           // priority for the sea: floating platforms, offshore energy, seabed minerals, reclamation (1 = neutral)
  longevityMult: number;        // longevity research speed
  fusionMult: number;           // fusion research speed
  geothermalMult: number;       // geothermal research/deployment priority
  bioenergyMult: number;        // sustainable bioenergy / fuels priority
  oceanEnergyMult: number;      // tidal/wave/OTEC priority
  hydrogenMult: number;         // hydrogen carrier/infrastructure priority
  fertilityMult: number;        // scenario-level shift in fertility regimes; not a fixed population target
  reproductionTechMult: number; // synthetic/assisted reproduction diffusion
  demographicVolatility: number;// how strongly fertility norms can drift/rebound over long horizons
  collapseSeverityMult: number; // shock amplification for wars/pandemics/state failure
  recoveryMult: number;         // resettlement/institutional recovery potential after collapse
  verticalMult: number;         // priority/feasibility for above-ground density/arcologies
  undergroundMult: number;      // priority/feasibility for underground habitats
}

// Structured effect applied by an intervention (validated, never arbitrary code)
export type InterventionEffect =
  | { kind: 'effort'; techId: TechId; mult: number; months: number }
  | { kind: 'build'; civId: CivId; buildType: 'grid' | 'solar' | 'wind' | 'nuclear' | 'geothermal' | 'bioenergy' | 'ocean_energy' | 'hydrogen_hub' | 'datacenter' | 'fab' | 'fusion' | 'spaceport' | 'recycling'; amountGW: number }
  | { kind: 'society'; civId: CivId; stat: 'trust' | 'stability' | 'regCaution'; delta: number }
  | { kind: 'policy'; civId: CivId; policy: 'retraining' | 'ubs' | 'education' | 'subsidize_robotics' | 'attract_scientists' | 'basic_provision' | 'space_program' | 'coastal_expansion'; strength: number; months: number }
  | { kind: 'relation'; a: CivId; b: CivId; field: 'chipExportAllowed' | 'sciCollaboration' | 'tradeOpenness'; value: number | boolean }
  | { kind: 'global'; param: 'collaboration' | 'capitalAvailability' | 'regulation'; mult: number; months: number }
  | { kind: 'fab_complete'; civId: CivId; months: number }; // fires when construction finishes

export interface ActiveIntervention {
  id: string; label: string; tStart: number; monthsLeft: number;
  effects: InterventionEffect[];
}

export interface WorldState {
  seed: number;
  rng: { state: number };
  tMonths: number;
  startYear: number;
  scenarioId: string;
  scenarioLabel: string;
  params: SimParams;
  civs: CivState[];
  techs: Record<TechId, TechState>;
  relations: RelationState[];
  chronicle: ChronicleEvent[];
  characters: CharacterState[];
  env: EnvState;
  metrics: MetricsPoint[];       // recorded annually
  eventCounter: number;
  flags: Record<string, boolean>; // one-shot event flags
  activeInterventions: ActiveIntervention[];
  observerBudget: number;                 // 0..100 meta-game intervention budget; no passive simulation effect
  projects: ProjectState[];
  researchPrograms: ResearchProgramState[];
  inventions: InventionState[];
  pendingTransition: Partial<Record<TechId, number>>; // paradigm research momentum
  resources: ResourceState;
  frontier: FrontierState;
  pendingDecisions: PendingDecision[]; // questions the world is asking the observer right now
  conflicts: { a: CivId; b: CivId; months: number; startedAt: number }[];
  pendingConflict: { a: CivId; b: CivId }[];
  pandemic: { months: number; severity: number; startedAt: number } | null;
  pendingPandemic: boolean;
  drought: { months: number } | null;
  pendingAiIncident: boolean;
  branchOf?: string;
  branchNote?: string;
}

export const CIV_IDS: CivId[] = ['veloria', 'ardan', 'nemea'];
