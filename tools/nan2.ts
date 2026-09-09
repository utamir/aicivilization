import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, resolveDecision } from '../src/sim';
const w = createWorld(7, applyDelta(DEFAULT_PARAMS, SCENARIO_PRESETS.find(p=>p.id==='resource_crunch')!.delta), 'x', 'x');
for (let m=0;m<1186;m++){ stepWorld(w,1); for (const p of [...w.pendingDecisions]) resolveDecision(w,p.key, p.defId==='synthetic_births' ? 'both' : p.defId==='conflict' ? 'war' : null); }
const c = w.civs[0];
const flat = (o: any, pre=''): string[] => Object.entries(o).flatMap(([k,v]) => typeof v === 'number' ? (!Number.isFinite(v) || Math.abs(v) > 1e6 || (Math.abs(v) < 1e-9 && v !== 0) ? [`${pre}${k}=${v}`] : []) : (v && typeof v === 'object' && !Array.isArray(v) && pre.split('.').length < 4 ? flat(v, `${pre}${k}.`) : []));
console.log('suspect fields:', flat(c).join(' '));
console.log('pop', c.population.total, 'sum', c.population.cohorts.reduce((a,b)=>a+b,0), 'stab', c.society.stability, 'trust', c.society.trust, 'debt', c.economy.publicDebt, 'out', c.economy.output, 'capex', c.economy.capexAvailability, 'inst', c.economy.institutionalCapacity, 'demand', c.energy.demandTWh, 'served', c.energy.servedTWh, 'price', c.energy.priceIndex, 'margin', c.energy.marginPct, 'gridcap', c.energy.gridCapGW, 'syn', c.society.syntheticBirthsPerYear, 'research', c.researchCapacity, 'wars', w.conflicts.map(k=>`${k.a}-${k.b}:${k.months}`).join(','));
