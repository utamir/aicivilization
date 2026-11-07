// Public API of the simulation core
export * from './types.js';
export { createWorld, cloneWorld, START_YEAR, CAPACITY_FACTOR } from './core/world.js';
export { stepWorld, dateLabel, yearOf, addEvent, taskHorizonHrs, fmtHorizon, techTickCache, PROJECT_LABEL, energyHardship } from './core/step.js';
export { MILESTONES, ERA_LABELS, milestoneDef } from './data/frontier.js';
export { physicalPopulation } from './core/frontier.js';
export { resolveDecision, DECISIONS } from './core/decisions.js';
export { ageGroups } from './core/demography.js';
export { explainStability, explainReadiness, demographicAnalogue, civHeadline } from './explainState.js';
export { DEFAULT_PARAMS, SCENARIO_PRESETS, BUILDER_AXES, parseWhatIf, mergeDeltas, applyDelta } from './data/params.js';
export { TECH_DEFS, TECH_IDS, DOMAIN_META } from './data/techDefs.js';
export { CIV_DEFS, civDef } from './data/civDefs.js';
export { EVIDENCE, evidenceById } from './data/evidence.js';
export { CALIBRATION } from './data/calibration.js';
export { INVENTION_CANDIDATES, candidatesFor } from './data/inventions.js';
export { INTERVENTIONS, INFLUENCE_START } from './data/interventions.js';
export { applyIntervention, createBranch, compareWorlds } from './branch.js';
export { researchVelocity, whyDidThisHappen } from './explain.js';
