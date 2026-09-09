import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, resolveDecision } from '../src/sim';
import type { SimParams } from '../src/sim';
const cases: [string, Partial<SimParams>][] = [['hothouse', SCENARIO_PRESETS.find(p=>p.id==='hothouse_collapse')!.delta], ['old', { agingMult: 1.8, medianAgeShift: 6 }], ['crunch', SCENARIO_PRESETS.find(p=>p.id==='resource_crunch')!.delta]];
for (const [label, delta] of cases) {
  const w = createWorld(7, applyDelta(DEFAULT_PARAMS, delta), label, label);
  const asked: string[] = [];
  for (let y=0;y<200;y++){ stepWorld(w,12); for (const p of [...w.pendingDecisions]) { asked.push(`${2027+y}:${p.defId}/${p.civId[0]}`); resolveDecision(w,p.key, p.defId==='synthetic_births' ? 'both' : p.defId==='conflict' ? (y%2? 'war':'sanction') : null); } }
  const n = (re: RegExp) => w.chronicle.filter(e=>re.test(e.title)).length;
  console.log(`${label}: pop=${w.civs.reduce((a,c)=>a+c.population.total,0).toFixed(0)} traj=${w.frontier.trajectory} tfr=${w.civs.map(c=>c.population.fertility.toFixed(2)).join(',')} med=${w.civs.map(c=>c.population.medianAge.toFixed(0)).join(',')} syn=${w.civs.map(c=>c.society.syntheticProgram[0]+c.society.syntheticBirthsPerYear.toFixed(2)).join(',')} tension=${w.relations.map(r=>r.tension.toFixed(2)).join(',')} | pandemics ${n(/new pandemic/i)} droughts ${n(/drought/i)} wars ${n(/^War between/)} edge ${n(/edge of war/)} geront ${n(/gerontocracy/)} frag ${n(/fragments/)} revival ${n(/pro-natal movement/)} postbio ${n(/post-biological/)}`);
  console.log('  ', asked.filter(a=>/synthetic|conflict|pandemic|ai_incident|enhancement/.test(a)).slice(0,12).join(' '));
}
