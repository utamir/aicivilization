declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'baseline_2026'))!;
const years = Number(process.argv[3] ?? 100);
const seed = Number(process.argv[4] ?? 7);
const every = Number(process.argv[5] ?? 10);
const w = createWorld(seed, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
const f = (x:number,d=2)=>x.toFixed(d);
console.log(`scenario=${preset.id} seed=${seed}`);
for (let y = 0; y < years; y++) {
  stepWorld(w, 12);
  if (y % every === every-1 || y < 1) {
    for (const c of w.civs) {
      const L = c.land; const h = c.housing;
      const proj = w.projects.filter(p => p.civId===c.id && !['operational','cancelled'].includes(p.status)).map(p=>p.kind.slice(0,4)).join(',');
      console.log(`${2026+y+1} ${c.id.padEnd(7)} pop=${f(c.population.total,1)} phys=${f((c.population.total-c.population.offworld)*(1-c.population.digitalShare),1)} ready=${f(c.frontierReadiness)} st=${f(c.society.stability)} debt=${f(c.economy.publicDebt)} m=${f(c.energy.marginPct,0)} opc=${f(c.economy.outputPerCapita)} | land use=${f(L.pressure)} urb=${f(L.urban)} farm=${f(L.farm)} en=${f(L.energy)} free=${f(L.free)} dens=${f(L.densityIndex)} recl=${f(L.reclaimed,3)} shelf=${f(L.shelf,3)} float=${f(L.floating,3)} cond=${f(L.reclaimedCondition)} lost=${f(L.lost,3)} | h=${f(h.stockIndex)} crowd=${f(h.crowding)} rent=${f(h.rentIndex)} ab=${f(h.abandoned)} off=${f(c.population.offworld,2)} [${proj}]`);
    }
    const fr = w.frontier;
    console.log(`   sea=${f(Math.max(0, w.env.warmingC-1.1)*0.38)}m warm=${f(w.env.warmingC)} landP=${f(w.resources.landPressure)} K=${f(fr.kardashev)} traj=${fr.trajectory} era=${fr.era} achieved=[${fr.milestones.filter(m=>m.status==='achieved').map(m=>m.id).join(',')}] rob=${f(w.techs.robotics_ind.cap,1)} float=${w.inventions.some(i=>i.id.startsWith('inv-modular-floating')&&i.status==='deployed')}`);
  }
}
