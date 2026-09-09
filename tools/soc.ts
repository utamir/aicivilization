declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, resolveDecision } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'baseline_2026'))!;
for (const seed of [7, 11, 23]) {
  const w = createWorld(seed, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
  const asked: string[] = [];
  for (let y=0;y<Number(process.argv[3]??200);y++){ stepWorld(w,12); for (const p of [...w.pendingDecisions]) { asked.push(`${2027+y}:${p.defId}/${p.civId[0]}`); resolveDecision(w,p.key,null); } }
  const ev = (re: RegExp) => w.chronicle.filter(e=>re.test(e.title)).map(e=>`${e.year} ${e.title}`).slice(0,4).join(' | ');
  console.log(`seed ${seed}: pop=${w.civs.reduce((a,c)=>a+c.population.total,0).toFixed(0)} traj=${w.frontier.trajectory} syn=${w.civs.map(c=>c.society.syntheticProgram[0]+c.society.syntheticBirthsPerYear.toFixed(2)).join(',')} tfr=${w.civs.map(c=>c.population.fertility.toFixed(2)).join(',')} tension=${w.relations.map(r=>r.tension.toFixed(2)).join(',')}`);
  console.log('  asked:', asked.filter(a=>!/agi_work|land_out|fusion_first|fuel_price|longevity_access|debt_wall|dikes|space_program|climate_2_5|shrinking/.test(a)).join(' '));
  console.log('  events:', ev(/pandemic|War|Ceasefire|gerontocracy|fragments|pro-natal|drought|cascade|solar storm|post-biological|edge of war/i));
}
