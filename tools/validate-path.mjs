#!/usr/bin/env node
import path from 'node:path'; import {pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const sim=await import(pathToFileURL(path.join(root,'dist/app/sim/index.js')).href);
const [id='collapse_and_return',seedS='7',yearsS='300']=process.argv.slice(2); const seed=Number(seedS),years=Number(yearsS);
const p=sim.SCENARIO_PRESETS.find(x=>x.id===id); if(!p) throw new Error(`Unknown ${id}`);
let w=sim.createWorld(seed,sim.applyDelta(sim.DEFAULT_PARAMS,p.delta),p.id,p.name);
let minPop=Infinity,minYear=2026,maxPop=0; const statuses=[]; let last={};
for(let y=0;y<years;y++){
 sim.stepWorld(w,12); const year=2027+y; const pop=w.civs.reduce((a,c)=>a+c.population.total,0);
 if(pop<minPop){minPop=pop;minYear=year;} maxPop=Math.max(maxPop,pop);
 for(const c of w.civs){if(last[c.id]!==c.society.polityStatus){statuses.push({year,civ:c.id,status:c.society.polityStatus,popM:c.population.total});last[c.id]=c.society.polityStatus;}}
}
const events=w.chronicle.filter(e=>/(abandon|resett|reunit|collapse|remnant|return|failed state)/i.test(`${e.title} ${e.body}`)).slice(-60).map(e=>({year:2026+e.tMonths/12,title:e.title,civId:e.civId}));
console.log(JSON.stringify({id,seed,finalYear:2026+w.tMonths/12,minPopM:minPop,minYear,maxPopM:maxPop,finalPopM:w.civs.reduce((a,c)=>a+c.population.total,0),finalTrajectory:w.frontier.trajectory,statusTransitions:statuses,events},null,2));
