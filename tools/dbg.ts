declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'abundant_clean'))!;
const civId = process.argv[3] ?? 'ardan';
const w = createWorld(7, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
const f=(x:number,d=2)=>x.toFixed(d);
for (let y=0;y<70;y++){ stepWorld(w,12); if (y%5!==4) continue; const c=w.civs.find(x=>x.id===civId)!; const e=c.energy;
  const gen = Object.entries(e.sources).map(([k,s])=>`${k}:${f(s.cap,0)}gw/c${f(s.condition,2)}/a${f(s.avgAgeYears,0)}`).join(' ');
  const active = w.projects.filter(p=>p.civId===civId && !['operational','cancelled'].includes(p.status)).map(p=>`${p.kind}:${f(p.capacity,1)}:${f(p.capex,2)}:${f(p.monthsRemaining,0)}m`).join(' ');
  const done5 = w.projects.filter(p=>p.civId===civId && p.status==='operational' && (p.completedAt??0) > w.tMonths-60).length;
  console.log(`${2027+y} out=${f(c.economy.output)} dem=${f(e.demandTWh,0)} srv=${f(e.servedTWh,0)} grid=${f(e.gridCapGW,0)}gw/c${f(e.gridCondition)} m=${f(e.marginPct,1)} pr=${f(e.priceIndex)} inv=${f(c.economy.investmentBudget,3)} maint=${f(c.economy.maintenanceBudget,3)} debt=${f(c.economy.publicDebt)} capexAv=${f(c.economy.capexAvailability)} inst=${f(c.economy.institutionalCapacity)} mat=${f(c.economy.materialCostIndex)} storage=${f(e.storageGWh,0)} intensity=${f(c.economy.energyIntensityIndex)} pot=${f(c.economy.potentialOutput)} u=${f(c.economy.unemployment)} dc=${f(c.compute.dcCapGW,1)}\n   ${gen}\n   active[${active}] done5y=${done5}`); }
