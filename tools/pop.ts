declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, resolveDecision } from '../src/sim';
import { ageGroups } from '../src/sim/core/demography';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'baseline_2026'))!;
const w = createWorld(7, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
const f=(x:number,d=1)=>x.toFixed(d);
for (let y=0;y<Number(process.argv[3]??120);y++){ stepWorld(w,12); for (const p of [...w.pendingDecisions]) resolveDecision(w,p.key,null);
 if (y%10===9) console.log(`${2027+y} ` + w.civs.map(c=>`${c.id[0]}:${f(c.population.total)}M med${f(c.population.medianAge,0)} tfr${f(c.population.fertility,2)} le${f(c.population.lifeExpectancy,0)} b${f(c.population.birthRate*1000)} d${f(c.population.deathRate*1000)} w${f(c.population.workingShare,2)} [${ageGroups(c.population).map(x=>(x*100).toFixed(0)).join('/')}]`).join('  ')); }
