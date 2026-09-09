declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, resolveDecision } from '../src/sim';
const preset = SCENARIO_PRESETS.find(p => p.id === (process.argv[2] ?? 'baseline_2026'))!;
const w = createWorld(Number(process.argv[3] ?? 7), applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
const t0 = Date.now();
for (let y=0;y<150;y++){ stepWorld(w,12); for (const p of [...w.pendingDecisions]) resolveDecision(w, p.key, null); }
console.log('ms per sim year', ((Date.now()-t0)/150).toFixed(1), 'events', w.chronicle.length, 'projects', w.projects.length, 'active', w.projects.filter(p=>!['operational','cancelled'].includes(p.status)).length, 'cancelled', w.projects.filter(p=>p.status==='cancelled').length, 'inventions', w.inventions.length, 'programs', w.researchPrograms.length);
const counts: Record<string, number> = {};
for (const e of w.chronicle) { const k = e.title.replace(/\d{4}/g,'').replace(/(Veloria|Ardan|Nemea)/g,'X'); counts[k]=(counts[k]??0)+1; }
for (const [k,v] of Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,14)) console.log(v, k);
const pk: Record<string, number> = {}; for (const p of w.projects) { const k=`${p.civId}/${p.kind}/${p.status}`; pk[k]=(pk[k]??0)+1; }
console.log(Object.entries(pk).filter(([,v])=>v>8).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`${k}:${v}`).join('  '));
const inv: Record<string, number> = {}; for (const i of w.inventions) { const k=i.id.replace(/-\d+$/,'').replace(/-\d+-\d+$/,''); inv[k]=(inv[k]??0)+1; }
console.log(Object.entries(inv).filter(([,v])=>v>1).map(([k,v])=>`${k}:${v}`).join('  '));
const byName: Record<string, number> = {}; for (const i of w.inventions) byName[i.name]=(byName[i.name]??0)+1;
console.log('dup inventions:', Object.entries(byName).filter(([,v])=>v>1).map(([k,v])=>`${k}:${v}`).slice(0,10).join(' | '));
console.log('sample ids:', w.inventions.slice(0,3).map(i=>i.id).join(', '));
const sp = w.chronicle.filter(e=>/spaceport|nuclear/i.test(e.title)); console.log('spaceport/nuclear events', sp.length, sp.slice(-6).map(e=>`${e.year} ${e.title}`).join(' | '));
const prg: Record<string, number> = {}; for (const p of w.researchPrograms) { const k=`${p.techId}/${p.status}`; prg[k]=(prg[k]??0)+1; } console.log(Object.entries(prg).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`${k}:${v}`).join('  '));
