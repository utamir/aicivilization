declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'baseline_2026'))!;
const years = Number(process.argv[3] ?? 80);
const seed = Number(process.argv[4] ?? 7);
const every = Number(process.argv[5] ?? 10);
const w = createWorld(seed, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
const f = (x:number,d=2)=>x.toFixed(d);
console.log(`scenario=${preset.id} seed=${seed}`);
for (let y = 0; y < years; y++) {
  stepWorld(w, 12);
  if (y % every === every-1 || y < 2) {
    for (const c of w.civs) {
      const proj = w.projects.filter(p => p.civId===c.id && !['operational','cancelled'].includes(p.status)).map(p=>p.kind[0]+p.kind[1]).join(',');
      console.log(`${2026+y+1} ${c.id.padEnd(7)} pop=${f(c.population.total,1)}(off ${f(c.population.offworld,2)} dig ${f(c.population.digitalShare,2)}) LE=${f(c.population.lifeExpectancy,0)} b/d=${f(c.population.birthRate*1000,1)}/${f(c.population.deathRate*1000,1)} out=${f(c.economy.output)} opc=${f(c.economy.outputPerCapita)} u=${f(c.economy.unemployment)} prov=${f(c.society.basicProvision)} m=${f(c.energy.marginPct,0)} pr=${f(c.energy.priceIndex)} fus=${f(c.energy.sources.fusion.cap,1)}GW fos=${f(c.energy.sources.fossil.cap,0)} h=${f(c.housing.stockIndex)}/${f(c.housing.condition)}/vac${f(c.housing.vacancy)}/ab${f(c.housing.abandoned)} st=${f(c.society.stability)} debt=${f(c.economy.publicDebt)} inst=${f(c.economy.institutionalCapacity)} mat=${f(c.economy.materialCostIndex)} lc=${f(c.space.launchCostIndex,3)} sp=${f(c.space.spaceportCapacity,1)} orb=${f(c.space.orbitalIndustry,1)} hab=${f(c.space.habitatCapacityM,2)} mars=${f(c.space.marsCapacityM,2)} [${proj}]`);
    }
    const r = w.resources, fr = w.frontier;
    const ach = fr.milestones.filter(m=>m.status==='achieved').map(m=>m.id).join(',');
    const prog = fr.milestones.filter(m=>m.status==='in_progress').map(m=>`${m.id}:${f(m.progress,2)}`).join(',');
    console.log(`   ai=${f(w.techs.ai_models.cap,1)} ag=${f(w.techs.ai_agents.cap,1)} rob=${f(w.techs.robotics_ind.cap,1)} bio=${f(w.techs.biotech_med.cap,1)} lon=${f(w.techs.longevity_bio.cap)} fus=${f(w.techs.fusion_power.cap)}/m${f(w.techs.fusion_power.maturity)}/c${f(w.techs.fusion_power.cost)} spc=${f(w.techs.space_systems.cap)}/c${f(w.techs.space_systems.cost,3)} | fossilRes=${f(r.fossilReserves,0)} fc=${f(r.fossilCostIndex)} minRes=${f(r.mineralReserves,0)} mc=${f(r.mineralCostIndex)} rec=${f(r.recyclingRate)} space=${f(r.mineralSpaceInflow)} | K=${f(fr.kardashev)} TW=${f(fr.energyCaptureTW,0)} warm=${f(w.env.warmingC)} traj=${fr.trajectory} inv=${w.inventions.length} ev=${w.chronicle.length}`);
    console.log(`   achieved=[${ach}] inprogress=[${prog}]`);
  }
}
