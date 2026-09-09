declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'baseline_2026'))!;
const years = Number(process.argv[3] ?? 150); const seed = Number(process.argv[4] ?? 7); const every = Number(process.argv[5] ?? 50);
const w = createWorld(seed, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
const f=(x:number,d=2)=>x.toFixed(d);
for (let y=0;y<years;y++){ stepWorld(w,12); if (y%every===every-1){
  const pop=w.civs.reduce((a,c)=>a+c.population.total,0);
  console.log(`${2027+y} pop=${f(pop,0)} [${w.civs.map(c=>`${c.id[0]}:${f(c.population.total,0)}/st${f(c.society.stability)}/sh${f(c.food.shortage)}/d${f(c.population.deathRate*1000,0)}/fl${f(c.land.floating,3)}/sub${f(c.land.subsea,3)}/air${f(c.land.aerial,3)}`).join(' ')}] warm=${f(w.env.warmingC)} K=${f(w.frontier.kardashev)} traj=${w.frontier.trajectory} ms=${w.frontier.milestones.filter(m=>m.status==='achieved').length}/${w.frontier.milestones.length} ${w.frontier.milestones.filter(m=>m.status==='achieved').map(m=>m.id).filter(i=>['climate_control','full_spectrum','type_ii_approach'].includes(i)).join(',')}`);
}}
