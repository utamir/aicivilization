// Red-team battery: every preset × seeds, long horizon, absurdity list, performance.
declare const process: { argv: string[] };
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, resolveDecision } from '../src/sim';
const years = Number(process.argv[2] ?? 300);
const seeds = [7, 11, 23];
const findings: string[] = [];
const isBad = (x: unknown) => typeof x === 'number' && !Number.isFinite(x);
function scan(o: any, path: string, depth: number, out: string[]) {
  if (depth > 6 || o === null || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) { if (isBad(v)) out.push(`${path}.${k}`); else if (typeof v === 'object') scan(v, `${path}.${k}`, depth + 1, out); }
}
let worst = 0;
for (const preset of SCENARIO_PRESETS) {
  for (const seed of seeds) {
    const w = createWorld(seed, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
    const t0 = Date.now();
    const pops: number[] = []; let maxMargin = 0; let asked = 0; let repeatedAsk = 0; const askKeys = new Set<string>();
    let stuck = false; let earlyExpansion = 0; let labelContradiction = 0; let flat = 0;
    for (let y = 0; y < years; y++) {
      try { stepWorld(w, 12); } catch (e) { findings.push(`${preset.id}/${seed}: THROW year ${2026 + y}: ${(e as Error).message}`); stuck = true; break; }
      for (const p of [...w.pendingDecisions]) { asked++; const k = `${p.defId}/${p.civId}`; if (askKeys.has(k) && p.defId !== 'conflict') repeatedAsk++; askKeys.add(k); resolveDecision(w, p.key, null); }
      const pop = w.civs.reduce((a, c) => a + c.population.total, 0); pops.push(pop);
      for (const c of w.civs) {
        if (c.energy.marginPct > maxMargin) maxMargin = c.energy.marginPct;
        const exp = (c.land.reclaimed ?? 0) + (c.land.floating ?? 0) + (c.land.subsea ?? 0) + (c.space?.habitatCapacityM ?? 0) / 100;
        if (exp > 0.02 && c.land.pressure < 0.8 && w.params.marineMult <= 1 && (w.params.spaceMult ?? 1) <= 1 && y < 100 && c.housing.crowding < 0.06) earlyExpansion++;
      }
      if (y > 60 && pops.length > 31) { const a = pops[pops.length - 31]; if (Math.abs(pop - a) / Math.max(1, a) < 0.001 && pop > 5) flat++; }
      if (y % 25 === 24) { const bad: string[] = []; scan(w.civs, 'civs', 0, bad); scan(w.frontier, 'frontier', 0, bad); scan(w.resources, 'resources', 0, bad); if (bad.length) { findings.push(`${preset.id}/${seed}: NaN at ${2026 + y}: ${bad.slice(0, 4).join(', ')}`); break; } }
    }
    const ms = (Date.now() - t0) / years; worst = Math.max(worst, ms);
    const pop = pops[pops.length - 1], start = pops[0];
    const traj = w.frontier.trajectory;
    if (pop < start * 0.5 && ['growth', 'ascent', 'flourishing'].includes(traj)) labelContradiction++;
    if (pop > start * 1.2 && ['collapse', 'extinction'].includes(traj)) labelContradiction++;
    if (maxMargin > 200) findings.push(`${preset.id}/${seed}: reserve margin peaked at ${maxMargin.toFixed(0)}%`);
    if (repeatedAsk) findings.push(`${preset.id}/${seed}: ${repeatedAsk} repeated decision cards (same question, same civ)`);
    if (earlyExpansion > 12) findings.push(`${preset.id}/${seed}: expansion into sea/orbit with land to spare in ${earlyExpansion} civ-years`);
    if (flat > 0) findings.push(`${preset.id}/${seed}: population flat to 0.1% for 30 years (${flat} yrs)`);
    if (labelContradiction) findings.push(`${preset.id}/${seed}: trajectory '${traj}' contradicts population ${start.toFixed(0)}→${pop.toFixed(0)}`);
    if (stuck) continue;
    const dup: Record<string, number> = {}; for (const i of w.inventions) dup[i.name] = (dup[i.name] ?? 0) + 1;
    const dups = Object.entries(dup).filter(([, v]) => v > 1);
    if (dups.length && (w.params.collaboration ?? 1) >= 1) findings.push(`${preset.id}/${seed}: duplicate inventions ${dups.slice(0, 3).map(([k, v]) => `${k}×${v}`).join('; ')}`);
    const major = w.chronicle.filter((e) => e.significance >= 2).length;
    if (major > years * 6) findings.push(`${preset.id}/${seed}: ${major} major chronicle events in ${years} years (spam)`);
    console.log(`${preset.id.padEnd(24)} s${seed} pop ${start.toFixed(0)}→${pop.toFixed(0)} traj=${traj.padEnd(15)} asked=${asked} maxMargin=${maxMargin.toFixed(0)}% ${ms.toFixed(1)}ms/yr K=${w.frontier.kardashev.toFixed(2)} warm=${w.env.warmingC.toFixed(1)}`);
  }
}
console.log('\nFINDINGS', findings.length, '| worst ms/year', worst.toFixed(1));
for (const f of findings) console.log(' -', f);
