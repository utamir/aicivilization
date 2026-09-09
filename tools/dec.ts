import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, resolveDecision } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === 'baseline_2026')!;
const w = createWorld(7, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
let asked = 0;
for (let y=0;y<120;y++){ stepWorld(w,12); for (const p of [...w.pendingDecisions]) { asked++; console.log(`${2027+y} ${p.civId}: ${p.title} -> [${p.options.map(o=>o.label).join(' | ')}]`); resolveDecision(w, p.key, y%2? null : p.options[0].id); } }
console.log('asked', asked, 'decided events', w.chronicle.filter(e=>e.title.includes('decides')).length);
