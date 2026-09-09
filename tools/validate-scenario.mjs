#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const [id,seedS='7',yearsS='300']=process.argv.slice(2); const seed=Number(seedS), years=Number(yearsS);
const sim=await import(pathToFileURL(path.join(root,'dist/app/sim/index.js')).href);
const p=sim.SCENARIO_PRESETS.find(x=>x.id===id); if(!p) throw new Error(`Unknown scenario ${id}`);
const finite=Number.isFinite;
function validateWorld(w){
  const errs=[]; const check=(v,label,min=-Infinity,max=Infinity)=>{if(!finite(v)||v<min-1e-9||v>max+1e-9)errs.push(`${label}=${v}`)};
  check(w.observerBudget,'observerBudget',0,100);
  for(const c of w.civs){
    check(c.population.total,`${c.id}.population`,0);check(c.population.offworld,`${c.id}.offworld`,0,c.population.total);check(c.population.digitalShare,`${c.id}.digitalShare`,0,1);
    check(c.space.interstellarM,`${c.id}.interstellarM`,0,c.population.offworld);check(c.space.deepSpaceCapacityM,`${c.id}.deepSpaceCapacityM`,0);check(c.space.marsCapacityM,`${c.id}.marsCapacityM`,0);check(c.space.marsPopulationM,`${c.id}.marsPopulationM`,0,Math.min(c.population.offworld,c.space.marsCapacityM));
    check(c.economy.output,`${c.id}.output`,0);check(c.economy.outputPerCapita,`${c.id}.outputPerCapita`,0,1e6);check(c.compute.supplyFlops,`${c.id}.computeSupply`,0);check(c.compute.demandFlops,`${c.id}.computeDemand`,0);
    for(const k of ['floatingCondition','subseaCondition','verticalCondition','undergroundCondition','reclaimedCondition','wildReclaimed'])check(c.land[k],`${c.id}.${k}`,0,1);
    for(const k of ['floating','subsea','vertical','underground','aerial','reclaimed'])check(c.land[k],`${c.id}.${k}`,0);
  }
  const total=w.civs.reduce((a,c)=>a+c.population.total,0),earth=w.civs.reduce((a,c)=>a+Math.max(0,c.population.total-c.population.offworld),0),off=w.civs.reduce((a,c)=>a+c.population.offworld,0),digital=w.civs.reduce((a,c)=>a+c.population.total*c.population.digitalShare,0),deep=w.civs.reduce((a,c)=>a+c.space.interstellarM,0),mars=w.civs.reduce((a,c)=>a+c.space.marsPopulationM,0),orbital=w.civs.reduce((a,c)=>a+Math.max(0,c.population.offworld-c.space.marsPopulationM-c.space.interstellarM),0);
  if(Math.abs(earth+off-total)>1e-6)errs.push(`location accounting ${earth}+${off}!=${total}`);
  if(Math.abs(off-w.frontier.offworldPopulationM)>1e-6)errs.push(`frontier offworld mismatch ${off}!=${w.frontier.offworldPopulationM}`);
  if(Math.abs(digital-w.frontier.digitalPopulationM)>1e-6)errs.push(`frontier digital mismatch ${digital}!=${w.frontier.digitalPopulationM}`);
  if(deep>off+1e-9)errs.push(`deep-space population ${deep}>offworld ${off}`);
  if(mars+deep>off+1e-9)errs.push(`Mars+deep population ${mars+deep}>offworld ${off}`);
  if(Math.abs(orbital+mars+deep-off)>1e-6)errs.push(`offworld location split ${orbital}+${mars}+${deep}!=${off}`); return errs;
}
const total=fn=>w.civs.reduce((a,c)=>a+fn(c),0); // initialized below; functions close over w
const avg=fn=>w.civs.reduce((a,c)=>a+fn(c),0)/w.civs.length;
let w=sim.createWorld(seed,sim.applyDelta(sim.DEFAULT_PARAMS,p.delta),p.id,p.name); const errors=[];
for(let y=0;y<years;y++){sim.stepWorld(w,12);const e=validateWorld(w);if(e.length){errors.push({scenario:id,seed,year:2027+y,errors:e.slice(0,30)});break;}}
const s={
  id,seed,year:2026+w.tMonths/12,
  populationM:total(c=>c.population.total),
  earthLocatedM:total(c=>Math.max(0,c.population.total-c.population.offworld)),
  earthEmbodiedM:total(c=>Math.max(0,c.population.total-c.population.offworld)*(1-c.population.digitalShare)),
  offworldM:w.frontier.offworldPopulationM,
  offworldShare:w.frontier.offworldPopulationM/Math.max(1e-9,total(c=>c.population.total)),
  orbitalM:total(c=>Math.max(0,c.population.offworld-c.space.marsPopulationM-c.space.interstellarM)),marsPopulationM:total(c=>c.space.marsPopulationM),deepSpaceM:total(c=>c.space.interstellarM),marsCapacityM:total(c=>c.space.marsCapacityM),digitalM:w.frontier.digitalPopulationM,
  habitats:{floating:avg(c=>c.land.floating),subsea:avg(c=>c.land.subsea),vertical:avg(c=>c.land.vertical),underground:avg(c=>c.land.underground),floatingCondition:avg(c=>c.land.floatingCondition),subseaCondition:avg(c=>c.land.subseaCondition),verticalCondition:avg(c=>c.land.verticalCondition),undergroundCondition:avg(c=>c.land.undergroundCondition)},
  rewilding:avg(c=>c.land.wildReclaimed),
  trajectory:w.frontier.trajectory,trajectoryNote:w.frontier.trajectoryNote,developmentForm:w.frontier.developmentForm,kardashev:w.frontier.kardashev,agi:w.frontier.agi,asi:w.frontier.asi,outcome:w.frontier.outcome,
  society:{basicProvision:avg(c=>c.society.basicProvision),trust:avg(c=>c.society.trust),stability:avg(c=>c.society.stability),gini:avg(c=>c.economy.gini),foodShortage:avg(c=>c.food.shortage)},
  economy:{output:total(c=>c.economy.output),outputPerCapitaMean:avg(c=>c.economy.outputPerCapita),outputPerCapitaMax:Math.max(...w.civs.map(c=>c.economy.outputPerCapita))},
  energyGW:{solar:total(c=>c.energy.sources.solar.cap),wind:total(c=>c.energy.sources.wind.cap),nuclear:total(c=>c.energy.sources.nuclear.cap),geothermal:total(c=>c.energy.sources.geothermal.cap),bioenergy:total(c=>c.energy.sources.bioenergy.cap),ocean:total(c=>c.energy.sources.ocean.cap),fusion:total(c=>c.energy.sources.fusion.cap),hydrogenElectrolyzer:total(c=>c.energy.hydrogen.electrolyzerGW)},
  polityStatuses:Object.fromEntries(w.civs.map(c=>[c.id,c.society.polityStatus])),
};
console.log(JSON.stringify({summary:s,errors}));
