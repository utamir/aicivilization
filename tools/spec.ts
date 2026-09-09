// Emits the data appendix of the master prompt from the code itself, so the
// document can never drift from what the simulation actually contains.
import { CIV_DEFS } from '../src/sim/data/civDefs';
import { TECH_DEFS, TECH_IDS } from '../src/sim/data/techDefs';
import { INVENTION_CANDIDATES as INVENTION_PATHWAYS } from '../src/sim/data/inventions';
import { MILESTONES, ERA_LABELS } from '../src/sim/data/frontier';
import { DECISIONS } from '../src/sim/core/decisions';
import { SCENARIO_PRESETS, BUILDER_AXES, DEFAULT_PARAMS } from '../src/sim/data/params';
import { INTERVENTIONS } from '../src/sim/data/interventions';
import { EVIDENCE } from '../src/sim/data/evidence';
import { CALIBRATION } from '../src/sim/data/calibration';
import { LAND } from '../src/sim/core/land';
const out: string[] = [];
const p = (s: string) => out.push(s);
p('### A.1 Civilizations (2026 starting state)');
for (const d of CIV_DEFS) p(`- **${d.name}** (${d.id}), ${d.epithet}. Population ${d.population.total}M, median age ${d.population.medianAge}, fertility ${d.population.fertility}, education ${d.population.education}, urbanization ${d.population.urbanization}. Traits: ${Object.entries(d.traits).map(([k,v])=>`${k} ${v}`).join(', ')}. Land: cities ${d.land.urban}, farms ${d.land.farm}, energy ${d.land.energy}, shelf ${d.land.shelf}, sea exposure ${d.land.seaExposure}; cultural cohesion ${d.culturalCohesion}. Energy 2026: ${Object.entries(d.energy).map(([k,v])=>`${k} ${v}`).join(', ')}. Food: ${Object.entries(d.food).map(([k,v])=>`${k} ${v}`).join(', ')}.`);
p('\n### A.2 Technology domains');
for (const id of TECH_IDS) { const t = TECH_DEFS[id]; p(`- **${id}** (${t.domain}): ${t.name}. Depends on: ${Object.entries(t.deps).map(([k,v])=>`${k} ${v}`).join(', ') || 'none'}.`); }
p('\n### A.3 Invention pathways (named, in the order a domain reaches them)');
for (const iv of INVENTION_PATHWAYS) p(`- ${iv.techId} → **${iv.name}** [${iv.id}]: ${iv.objective} (needs ${Math.round(iv.minCapFraction*100)}% of the paradigm cap; difficulty ${iv.baseDifficulty}; gain ${iv.capabilityGain}; paradigm lift ${iv.paradigmLift})`);
p('\n### A.4 Milestone ladder');
for (const era of [1,2,3] as const) { p(`- Era ${era}: ${ERA_LABELS[era]}`); for (const m of MILESTONES.filter(x=>x.era===era)) p(`  - **${m.name}** [${m.id}], ${m.kind}, illustrative horizon ${m.illustrativeYear}. Requires: ${m.requires.join('; ')}. Effect: ${m.effect}${m.kind==='program' ? ` Program: ~${m.baseYears} years, ${((m.costShare ?? 0)*100).toFixed(1)}% of world output/yr while funded.` : ''}`); }
p('\n### A.5 Decision cards');
for (const d of DECISIONS) p(`- **${d.title}** [${d.id}]${d.months ? `, deadline ${d.months} months` : ''}: ${d.options.map(o=>`${o.label} (${o.consequence})`).join(' / ')}`);
p('\n### A.6 Scenario presets');
for (const s of SCENARIO_PRESETS) p(`- **${s.name}** [${s.id}]: ${s.tagline} Δ ${Object.entries(s.delta).map(([k,v])=>`${k}×${v}`).join(', ') || 'none'}`);
p('\n### A.7 Builder axes'); for (const a of BUILDER_AXES) p(`- ${a.label}: ${a.options.map(o=>o.label).join(' / ')}`);
p('\n### A.8 Default parameters'); p(Object.entries(DEFAULT_PARAMS).map(([k,v])=>`${k}=${v}`).join(', '));
p('\n### A.9 Interventions'); for (const i of INTERVENTIONS) p(`- **${i.label}** [${i.id}] (${i.category}, ${i.scope}, cost ${i.cost}): ${i.description}`);
p('\n### A.10 Evidence registry (ids)'); p(EVIDENCE.map(e=>`${e.id} (${e.domain}: ${e.metric})`).join('; '));
p('\n### A.11 Calibration constants'); p('```json\n'+JSON.stringify({ CALIBRATION, LAND }, null, 1).replace(/\n\s*/g,' ')+'\n```');
console.log(out.join('\n'));
