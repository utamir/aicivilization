#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sim = await import(pathToFileURL(path.join(root, 'dist/app/sim/index.js')).href);
const visual = await import(pathToFileURL(path.join(root, 'dist/app/world3d/cityVisuals.js')).href);
const years = 300;
const seed = 7;
const finite = (x) => Number.isFinite(x);
const summary = (w,id,seedUsed) => {
  const total = fn => w.civs.reduce((a,c)=>a+fn(c),0);
  const avg = fn => w.civs.reduce((a,c)=>a+fn(c),0)/w.civs.length;
  return {
    id, seed:seedUsed, year:2026+w.tMonths/12,
    populationM: total(c=>c.population.total),
    earthLocatedM: total(c=>Math.max(0,c.population.total-c.population.offworld)),
    earthEmbodiedM: total(c=>Math.max(0,c.population.total-c.population.offworld)*(1-c.population.digitalShare)),
    offworldM: w.frontier.offworldPopulationM,
    deepSpaceM: total(c=>c.space.interstellarM),
    marsCapacityM: total(c=>c.space.marsCapacityM),
    digitalM: w.frontier.digitalPopulationM,
    habitats: {
      floating: avg(c=>c.land.floating), subsea:avg(c=>c.land.subsea), vertical:avg(c=>c.land.vertical), underground:avg(c=>c.land.underground),
      floatingCondition:avg(c=>c.land.floatingCondition), subseaCondition:avg(c=>c.land.subseaCondition), verticalCondition:avg(c=>c.land.verticalCondition), undergroundCondition:avg(c=>c.land.undergroundCondition),
    },
    rewilding: avg(c=>c.land.wildReclaimed),
    trajectory:w.frontier.trajectory,
    economy: { output: total(c=>c.economy.output), outputPerCapitaMean: avg(c=>c.economy.outputPerCapita), outputPerCapitaMax: Math.max(...w.civs.map(c=>c.economy.outputPerCapita)) },
    energyGW: {
      solar:total(c=>c.energy.sources.solar.cap), wind:total(c=>c.energy.sources.wind.cap), nuclear:total(c=>c.energy.sources.nuclear.cap),
      geothermal:total(c=>c.energy.sources.geothermal.cap), bioenergy:total(c=>c.energy.sources.bioenergy.cap), ocean:total(c=>c.energy.sources.ocean.cap),
      fusion:total(c=>c.energy.sources.fusion.cap), hydrogenElectrolyzer:total(c=>c.energy.hydrogen.electrolyzerGW),
    }
  };
};
function validateWorld(w) {
  const errs=[];
  const check=(v,label,min=-Infinity,max=Infinity)=>{if(!finite(v)||v<min-1e-9||v>max+1e-9)errs.push(`${label}=${v}`)};
  check(w.observerBudget,'observerBudget',0,100);
  for(const c of w.civs){
    check(c.population.total,`${c.id}.population`,0); check(c.population.offworld,`${c.id}.offworld`,0,c.population.total); check(c.population.digitalShare,`${c.id}.digitalShare`,0,1);
    check(c.space.interstellarM,`${c.id}.interstellarM`,0,c.population.offworld); check(c.space.deepSpaceCapacityM,`${c.id}.deepSpaceCapacityM`,0); check(c.space.marsCapacityM,`${c.id}.marsCapacityM`,0);
    check(c.economy.output,`${c.id}.output`,0); check(c.economy.outputPerCapita,`${c.id}.outputPerCapita`,0,1e6); check(c.compute.supplyFlops,`${c.id}.computeSupply`,0); check(c.compute.demandFlops,`${c.id}.computeDemand`,0);
    for(const k of ['floatingCondition','subseaCondition','verticalCondition','undergroundCondition','reclaimedCondition','wildReclaimed'])check(c.land[k],`${c.id}.${k}`,0,1);
    for(const k of ['floating','subsea','vertical','underground','aerial','reclaimed'])check(c.land[k],`${c.id}.${k}`,0);
  }
  const totalPop=w.civs.reduce((a,c)=>a+c.population.total,0);
  const earth=w.civs.reduce((a,c)=>a+Math.max(0,c.population.total-c.population.offworld),0);
  const off=w.civs.reduce((a,c)=>a+c.population.offworld,0);
  const digital=w.civs.reduce((a,c)=>a+c.population.total*c.population.digitalShare,0);
  const deep=w.civs.reduce((a,c)=>a+c.space.interstellarM,0);
  if(Math.abs((earth+off)-totalPop)>1e-6) errs.push(`location accounting ${earth}+${off} != ${totalPop}`);
  if(Math.abs(off-w.frontier.offworldPopulationM)>1e-6) errs.push(`frontier offworld mismatch ${off} != ${w.frontier.offworldPopulationM}`);
  if(Math.abs(digital-w.frontier.digitalPopulationM)>1e-6) errs.push(`frontier digital mismatch ${digital} != ${w.frontier.digitalPopulationM}`);
  if(deep>off+1e-9) errs.push(`deep-space population ${deep} > offworld ${off}`);
  return errs;
}
const scenarios=[]; const invariantErrors=[];
for(const p of sim.SCENARIO_PRESETS){
  let w=sim.createWorld(seed,sim.applyDelta(sim.DEFAULT_PARAMS,p.delta),p.id,p.name);
  for(let y=0;y<years;y++){
    sim.stepWorld(w,12);
    const e=validateWorld(w); if(e.length){invariantErrors.push({scenario:p.id,year:2027+y,errors:e.slice(0,20)});break;}
  }
  scenarios.push(summary(w,p.id,seed));
}
const byId=Object.fromEntries(scenarios.map(x=>[x.id,x]));
const expectations={
  allScenariosFinite: invariantErrors.length===0,
  oceanCenturyIsOceanic: byId.ocean_century.habitats.floating>0.10 && byId.ocean_century.habitats.subsea>0.02,
  verticalWorldIsVertical: byId.vertical_world.habitats.vertical>0.08 && byId.vertical_world.habitats.underground>0.03,
  inhabitEverythingUsesMultipleHabitats: byId.everywhere.habitats.floating>0.08 && byId.everywhere.habitats.subsea>0.015 && byId.everywhere.habitats.vertical>0.04 && byId.everywhere.offworldM>30,
  deepDiasporaLegibleOffworld: byId.deep_diaspora.offworldM>50,
  terminalCascadeCanReachLiteralZero: byId.terminal_cascade.populationM===0 && byId.terminal_cascade.rewilding>0.90,
  hydrogenScenarioActuallyUsesHydrogen: byId.hydrogen_archipelago.energyGW.hydrogenElectrolyzer>0.01,
  locationAccountingCloses: scenarios.every(x=>Math.abs((x.earthLocatedM+x.offworldM)-x.populationM)<1e-6),
  deepSpaceIsSubsetOfOffworld: scenarios.every(x=>x.deepSpaceM<=x.offworldM+1e-9),
  economicOutputFiniteAndBounded: scenarios.every(x=>Number.isFinite(x.economy.output)&&Number.isFinite(x.economy.outputPerCapitaMax)&&x.economy.outputPerCapitaMax<1e6),
};
// literal extinction + persistent ruins / habitat serviceability loss
const base=sim.SCENARIO_PRESETS.find(x=>x.id==='baseline_2026');
let z=sim.createWorld(23,sim.applyDelta(sim.DEFAULT_PARAMS,base.delta),base.id,base.name);
for(const c of z.civs){
  c.land.floating=.2;c.land.subsea=.1;c.land.vertical=.2;c.land.underground=.15;
  c.land.floatingCondition=1;c.land.subseaCondition=1;c.land.verticalCondition=1;c.land.undergroundCondition=1;
  c.population.total=0;c.population.children=0;c.population.working=0;c.population.elderly=0;c.population.offworld=0;c.population.digitalShare=0;
  c.society.autonomousInfrastructure=0;c.economy.institutionalCapacity=.05;c.economy.capexAvailability=.05;c.energy.marginPct=-50;c.energy.gridCondition=.1;
}
sim.stepWorld(z,1200);
const zeroTest={population:z.civs.map(c=>c.population.total), trajectory:z.frontier.trajectory, conditions:z.civs.map(c=>({floating:c.land.floatingCondition,subsea:c.land.subseaCondition,vertical:c.land.verticalCondition,underground:c.land.undergroundCondition,rewilding:c.land.wildReclaimed})), physicalStock:z.civs.map(c=>({floating:c.land.floating,subsea:c.land.subsea,vertical:c.land.vertical,underground:c.land.underground}))};
expectations.zeroStaysZero = zeroTest.population.every(x=>x===0) && zeroTest.trajectory==='extinction';
expectations.abandonedStockPersistsWhileServiceFails = zeroTest.physicalStock.every(x=>x.floating>0&&x.subsea>0&&x.vertical>0&&x.underground>0) && zeroTest.conditions.every(x=>x.subsea<0.10&&x.rewilding>0.85);
const zeroVisual=visual.computeWorldVisual(z,1);
expectations.zeroEarthHasNoActiveCitiesOrLaunches = zeroVisual.cities.every(c=>c.activeFraction===0&&c.population===0) && Object.values(zeroVisual.frontier).every(f=>f.launchRate===0);
expectations.zeroEarthRetainsPhysicalHabitatState = zeroVisual.cities.some(c=>c.floating>0||c.subsea>0||c.vertical>0||c.underground>0);
// observer budget: passive only replenishes; an explicit action spends it
let b=sim.createWorld(31,sim.applyDelta(sim.DEFAULT_PARAMS,base.delta),base.id,base.name); const start=b.observerBudget; sim.stepWorld(b,120); const passive=b.observerBudget;
const iv=sim.INTERVENTIONS.find(x=>x.cost>0 && (!x.available || x.available(b))); let spent=null; let action=null;
if(iv){const before=b.observerBudget; const r=sim.applyIntervention(b,iv.id); spent={before,after:b.observerBudget,cost:iv.cost,ok:r.ok};action=iv.id;}
const observerTest={start,after10YearsPassive:passive,action,spent};
expectations.observerBudgetHasNoPassiveScenarioEffect = start===60 && passive===100 && !!spent && spent.ok && Math.abs((spent.before-spent.after)-spent.cost)<1e-6;
// seed robustness for key habitat scenarios
const seedChecks=[];
for(const id of ['ocean_century','vertical_world','everywhere']) for(const sd of [3,7,19]){
  const p=sim.SCENARIO_PRESETS.find(x=>x.id===id); const w=sim.createWorld(sd,sim.applyDelta(sim.DEFAULT_PARAMS,p.delta),p.id,p.name); sim.stepWorld(w,3600); seedChecks.push(summary(w,id,sd));
}
expectations.oceanCenturyRobustAcrossSeeds=seedChecks.filter(x=>x.id==='ocean_century').every(x=>x.habitats.floating>0.07&&x.habitats.subsea>0.01);
expectations.verticalWorldRobustAcrossSeeds=seedChecks.filter(x=>x.id==='vertical_world').every(x=>x.habitats.vertical>0.05&&x.habitats.underground>0.02);
const result={generatedAt:new Date().toISOString(),release:'v11.4',simulationYears:years,scenarioCount:sim.SCENARIO_PRESETS.length,seed,expectations,invariantErrors,zeroTest,observerTest,scenarios,seedChecks};
fs.writeFileSync(path.join(root,'VALIDATION_RESULTS.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({scenarioCount:result.scenarioCount,pass:Object.values(expectations).every(Boolean),expectations},null,2));
if(!Object.values(expectations).every(Boolean)) process.exitCode=2;
