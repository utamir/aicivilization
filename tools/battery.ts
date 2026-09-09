import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta } from '../src/sim';
declare const process: { argv: string[] };
const years = Number(process.argv[2] ?? 200);
let bad = 0;
const t0 = Date.now();
for (const preset of SCENARIO_PRESETS) {
  for (const seed of [7, 42]) {
    const w = createWorld(seed, applyDelta(DEFAULT_PARAMS, preset.delta), preset.id, preset.name);
    const s0 = Date.now();
    stepWorld(w, years * 12);
    const ms = Date.now() - s0;
    const check = (label: string, v: number, lo = -1e12, hi = 1e12) => { if (!Number.isFinite(v) || v < lo || v > hi) { bad++; console.log(`  BAD ${preset.id}/${seed} ${label}=${v}`); } };
    for (const c of w.civs) {
      check('pop', c.population.total, 0.05, 5000); check('out', c.economy.output, 0.005, 1e5); check('margin', c.energy.marginPct, -100, 1e5);
      check('price', c.energy.priceIndex, 0.3, 10); check('LE', c.population.lifeExpectancy, 40, 160); check('abandoned', c.housing.abandoned, 0, 1);
      check('stock', c.housing.stockIndex, 0.1, 50); check('debt', c.economy.publicDebt, 0.2, 5); check('offworld', c.population.offworld, 0, c.population.total);
    }
    check('K', w.frontier.kardashev, 0.5, 2.2); check('warming', w.env.warmingC, 0.5, 6); check('mineralCost', w.resources.mineralCostIndex, 0.4, 9);
    const ach = w.frontier.milestones.filter(m => m.status === 'achieved').length;
    const sum = (fn: (c: any) => number) => w.civs.reduce((a, c) => a + fn(c), 0);
    console.log(`${preset.id.padEnd(18)} seed=${seed} ${ms}ms pop=${sum(c=>c.population.total).toFixed(0)} off=${w.frontier.offworldPopulationM.toFixed(1)} out=${sum(c=>c.economy.output).toFixed(1)} K=${w.frontier.kardashev.toFixed(2)} LE=${(sum(c=>c.population.lifeExpectancy)/3).toFixed(0)} milestones=${ach} traj=${w.frontier.trajectory} events=${w.chronicle.length} inv=${w.inventions.length} warm=${w.env.warmingC.toFixed(2)} abandoned=${(sum(c=>c.housing.abandoned)/3).toFixed(2)} minCost=${w.resources.mineralCostIndex.toFixed(2)} fossil=${w.resources.fossilReserves.toFixed(0)}`);
  }
}
console.log(`total ${Date.now() - t0}ms, bad=${bad}`);
