import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === 'everywhere')!;
const w = createWorld(7, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
const f=(x:number,d=2)=>x.toFixed(d);
for (let y=0;y<300;y++){ stepWorld(w,12); if (y>=210 && y%20===0){ const c=w.civs[2]; const s=c.society, e=c.economy;
 console.log(`${2027+y} st=${f(s.stability)} trust=${f(s.trust)} back=${f(s.backlash)} u=${f(e.unemployment)} lab=${f(s.laborRelevance)} prov=${f(s.basicProvision)} debt=${f(e.publicDebt)} m=${f(c.energy.marginPct,0)} pr=${f(c.energy.priceIndex)} served=${f(c.energy.servedTWh/c.energy.demandTWh)} waste=${f(c.waste.accumulation)} ab=${f(c.housing.abandoned)} crowd=${f(c.housing.crowding)} dig=${f(c.population.digitalShare)} off=${f(c.population.offworld,1)} sh=${f(c.food.shortage)} gini=${f(e.gini)} opc=${f(e.outputPerCapita,1)} inst=${f(e.institutionalCapacity)} sub=${f(c.land.subsea)} projects=${w.projects.filter(p=>p.civId==='ardan'&&!['operational','cancelled'].includes(p.status)).map(p=>p.kind).join(',')}`);}}
