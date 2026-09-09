declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'baseline_2026'))!;
const w = createWorld(Number(process.argv[4] ?? 7), applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
stepWorld(w, 12 * Number(process.argv[3] ?? 100));
for (const i of w.inventions.filter(i => ['space_systems','fusion_power','longevity_bio'].includes(i.techId))) console.log(i.techId, i.name, i.status, 2026 + Math.floor(i.discoveredAt/12), i.deployedAt ? 2026+Math.floor(i.deployedAt/12) : '-');
console.log('programs:', w.researchPrograms.filter(p=>['space_systems','fusion_power','longevity_bio'].includes(p.techId)).map(p=>`${p.techId}:${p.title.slice(0,25)}:${p.status}:${(p.progress).toFixed(2)}/${p.maturity.toFixed(2)}`).join(' | '));
for (const c of w.civs) console.log(c.id, 'space adoption', w.techs.space_systems.adoption[c.id].penetration.toFixed(2), 'alloc space', c.researchAlloc.space_systems.toFixed(3), 'fusion', c.researchAlloc.fusion_power.toFixed(3), 'lon', c.researchAlloc.longevity_bio.toFixed(3), 'rd', (c.economy.output*c.economy.rdSpendShare).toFixed(3));
