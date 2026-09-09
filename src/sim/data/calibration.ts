// Calibrated structural parameters used directly by the simulation.
// Values are intentionally broad/game-scale approximations, but every group
// keeps a provenance link to the evidence registry rather than living as an
// unexplained constant inside the step engine.

export const CALIBRATION = {
  finance: {
    grossInvestmentShare: 0.24,
    publicMaintenanceShare: 0.055,
    debtStressStart: 1.15,
    debtStressSevere: 2.2,
    capitalDepreciationAnnual: 0.045,
    sources: ['research-productivity-decline'],
  },
  grid: {
    targetReserveMargin: 0.14,
    annualPhysicalWear: 0.012,
    overloadWearAnnual: 0.05,
    maintenanceRecoveryAnnual: 0.08,
    projectLeadMonths: 54,
    utilization: 0.62,
    sources: ['global-electricity', 'datacenter-electricity', 'iea-grid-lead-times-2026', 'oecd-infrastructure-lifecycle-2026'],
  },
  generation: {
    fossil: { lifetimeYears: 42, annualWear: 0.018, maintenanceNeed: 0.025, leadMonths: 36, capexPerGW: 0.055 },
    nuclear: { lifetimeYears: 60, annualWear: 0.012, maintenanceNeed: 0.035, leadMonths: 120, capexPerGW: 0.16 },
    solar: { lifetimeYears: 30, annualWear: 0.012, maintenanceNeed: 0.012, leadMonths: 20, capexPerGW: 0.025 },
    wind: { lifetimeYears: 27, annualWear: 0.018, maintenanceNeed: 0.02, leadMonths: 30, capexPerGW: 0.04 },
    hydro: { lifetimeYears: 80, annualWear: 0.009, maintenanceNeed: 0.02, leadMonths: 72, capexPerGW: 0.12 },
    geothermal: { lifetimeYears: 38, annualWear: 0.016, maintenanceNeed: 0.03, leadMonths: 48, capexPerGW: 0.10 },
    bioenergy: { lifetimeYears: 32, annualWear: 0.022, maintenanceNeed: 0.035, leadMonths: 30, capexPerGW: 0.075 },
    ocean: { lifetimeYears: 28, annualWear: 0.025, maintenanceNeed: 0.045, leadMonths: 42, capexPerGW: 0.11 },
    // Fusion: first plants are first-of-a-kind (capex is multiplied by the fusion
    // cost index, which starts at 6× and falls with learning). 90% capacity factor
    // is the design target of pilot-plant programs, not a demonstrated number.
    fusion: { lifetimeYears: 40, annualWear: 0.014, maintenanceNeed: 0.04, leadMonths: 84, capexPerGW: 0.11 },
    sources: ['nuclear-construction', 'solar-learning-rate', 'global-electricity', 'renewable-mix-2025', 'geothermal-potential-2024', 'world-bank-asset-lifecycle', 'fusion-net-gain'],
  },
  resources: {
    // Reserves in years of 2026-rate consumption. Fossil: ~50 yr oil/gas proven,
    // ~130 yr coal → blended, energy-weighted ~70 yr of "cheap" reserves, with a
    // long expensive tail. Minerals: USGS reserve-to-production ratios for Cu
    // (~40 yr), Li (~100+ yr), Ni (~40 yr), REE (>100 yr) → blended ~60 yr at
    // 2026 rates, but clean-energy demand multiplies the draw several-fold.
    fossilReserveYears: 70,
    fossilTailYears: 90,           // additional expensive tail reserves
    mineralReserveYears: 60,
    mineralTailYears: 120,
    mineralDemandPerGWClean: 0.006,   // 2026-consumption units per GW of solar/wind/storage built
    mineralDemandPerGWCompute: 0.004,
    recyclingCeiling: 0.78,
    sources: ['fossil-reserves', 'critical-minerals-outlook', 'asteroid-mining-economics'],
  },
  frontier: {
    // Kardashev (Sagan): K = (log10 P[W] - 6)/10. 2026 humanity ≈ 0.73 (≈20 TW).
    // The three simulated polities are a region, so we scale their captured energy
    // by a fixed world factor to keep the scale honest.
    worldScaleFactor: 60,          // region → world primary-energy multiplier: 1167 TWh × 2.5 × 60 / 8760 h ≈ 20 TW (2026)
    typeIEnergyTW: 17000,          // full planetary insolation budget, 1.7e17 W
    launchCostFloor: 0.004,        // cost per kg to orbit relative to 2026 (~$1500/kg → ~$6/kg elevator-era)
    habitatCapexPerMillion: 1.6,   // normalized investment units per million residents (first units)
    sources: ['kardashev-scale', 'launch-cost-decline', 'asteroid-mining-economics'],
  },
  datacenter: {
    lifetimeYears: 12,
    annualWear: 0.025,
    leadMonths: 26,
    capexPerGW: 0.11,
    sources: ['datacenter-electricity', 'hyperscaler-capex'],
  },
  fab: {
    lifetimeYears: 12,
    leadMonths: 44,
    capexPerUnit: 0.26,
    sources: ['semiconductor-fab-cost'],
  },
  housing: {
    annualWear: 0.012,
    maintenanceNeed: 0.018,
    severeBacklogWear: 0.025,
    leadMonths: 24,
    capexPerStockPoint: 0.22,
    sources: ['housing-supply-elasticity'],
  },
  research: {
    baselineDifficultyGrowth: 0.018,
    programBaseYears: 5.5,
    maxActiveProgramsPerCiv: 6,
    sources: ['research-productivity-decline', 'tech-diffusion-lags'],
  },
  economy: {
    electricityCriticalShare: 0.18,
    electricityHouseholdShare: 0.22,
    electricityIndustryShare: 0.38,
    electricityComputeShare: 0.22,
    outputAdjustmentMonthly: 0.14,
    sources: ['datacenter-electricity', 'global-electricity'],
  },
} as const;

export type Calibration = typeof CALIBRATION;
