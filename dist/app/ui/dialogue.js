import { taskHorizonHrs, fmtHorizon } from '../sim/core/step.js';
import { yearOf } from '../sim/core/step.js';
export const TOPICS = [
    { id: 'work', label: 'How is your work going?' },
    { id: 'worry', label: 'What worries you most?' },
    { id: 'ai', label: 'Where is AI heading?' },
    { id: 'energy', label: 'Is the energy system coping?' },
    { id: 'food', label: 'How is the food supply?' },
    { id: 'people', label: 'How are people taking the changes?' },
    { id: 'history', label: 'What has shaped your view?' },
];
function moodWord(m) {
    return m > 0.4 ? 'optimistic' : m > 0.05 ? 'cautiously hopeful' : m > -0.35 ? 'uneasy' : 'deeply worried';
}
function energyLine(w, c) {
    const civ = w.civs.find((x) => x.id === c.civId);
    const m = civ.energy.marginPct;
    if (m > 9)
        return `Our grid margin sits at ${m.toFixed(0)}% — comfortable. Electricity is at ${civ.energy.priceIndex.toFixed(2)} times the 2026 price.`;
    if (m > 3)
        return `The grid is tight — only ${m.toFixed(1)}% reserve margin, and prices are ${civ.energy.priceIndex.toFixed(2)}× the 2026 level. Every new data center is a negotiation.`;
    return `Honestly? We're short of power. Margin is ${m.toFixed(1)}% and electricity costs ${civ.energy.priceIndex.toFixed(2)}× what it did in 2026. Demand from compute is growing faster than we can build.`;
}
function aiLine(w) {
    const h = taskHorizonHrs(w.techs.ai_agents.cap);
    const g = w.techs.ai_agents.lastGrowthRate * 100;
    return `Frontier agents now handle roughly ${fmtHorizon(h)} of sustained work — capability is growing about ${g.toFixed(0)}% a year. ${g > 45 ? 'That pace is historically unusual, and it is feeding back into research itself.' : g > 20 ? 'Steady, but the compounding is visible.' : 'Progress has slowed — the easy gains are behind us.'}`;
}
function laborLine(w, c) {
    const civ = w.civs.find((x) => x.id === c.civId);
    const u = (civ.economy.unemployment * 100).toFixed(1);
    const d = (civ.economy.displacedShare * 100).toFixed(0);
    const b = civ.society.backlash;
    return `Unemployment is ${u}% and about ${d}% of workers have been displaced by automation pressure. ${b > 0.6 ? 'The backlash is real — people are angry, and I understand why.' : b > 0.35 ? 'There is grumbling, but retraining is absorbing some of the shock.' : 'So far, people are adapting better than I feared.'}`;
}
function foodLine(w, c) {
    const civ = w.civs.find((x) => x.id === c.civId);
    const f = civ.food;
    const coverage = f.selfSufficiency + f.importShare;
    if (f.shortage > 0.05)
        return `People are going hungry. We cover only ${(coverage * 100).toFixed(0)}% of food demand and prices are ${f.priceIndex.toFixed(1)}× the 2026 level. ${f.importShare < 0.03 && f.selfSufficiency < 1 ? 'The imports we depended on have dried up.' : 'The harvests are failing us.'} This is the kind of thing that brings governments down.`;
    if (f.artificialShare > 0.3)
        return `Remarkable, honestly — ${(f.artificialShare * 100).toFixed(0)}% of our food now comes from fermentation tanks and grow-towers, not fields. We only cultivate ${(f.landUse * 100).toFixed(0)}% of the farmland we used to. The catch: it all runs on electricity, so the grid is now a food-security asset.`;
    if (f.selfSufficiency > 1.15)
        return `The land provides — we produce ${(f.selfSufficiency * 100).toFixed(0)}% of what we need and export the surplus. ${civ.id === 'nemea' ? 'Half the region eats Nemean grain. That is leverage, whether we like it or not.' : 'A surplus is a strategic asset.'}`;
    if (f.selfSufficiency < 0.95)
        return `We grow ${(f.selfSufficiency * 100).toFixed(0)}% of what we eat and import the rest — ${(f.importShare * 100).toFixed(0)}% of demand crosses a border before it reaches a plate. It works while relations hold. Yields are at ${f.landYield.toFixed(2)}× the 2026 baseline, which helps.`;
    return `Food is quietly fine — coverage at ${(coverage * 100).toFixed(0)}% of demand, prices at ${f.priceIndex.toFixed(2)}× baseline. Yields keep improving (${f.landYield.toFixed(2)}× 2026), though warming is starting to show in the fields.`;
}
export function characterReply(w, c, topic) {
    const civ = w.civs.find((x) => x.id === c.civId);
    const year = yearOf(w).toFixed(0);
    const role = c.role.toLowerCase();
    switch (topic) {
        case 'work': {
            if (role.includes('energy'))
                return `It's ${year}, and ${energyLine(w, c)} I'm ${moodWord(c.mood)} about keeping the lights on while demand from AI compute keeps climbing.`;
            if (role.includes('ai') || role.includes('director'))
                return `${aiLine(w)} My teams feel the acceleration every quarter — tooling that used to assist research now drives it. I'm ${moodWord(c.mood)}.`;
            if (role.includes('fab') || role.includes('semiconductor'))
                return `Fabrication capacity is the bottleneck everyone discovers eventually. Our fabs run at the edge of what the equipment pipeline allows — capability research means nothing if you cannot manufacture. I'm ${moodWord(c.mood)}.`;
            if (role.includes('labor') || role.includes('union'))
                return laborLine(w, c);
            if (role.includes('minister'))
                return `Governing ${civ.name} in ${year} means balancing energy, jobs, and stability — currently at ${(civ.society.stability * 100).toFixed(0)}%. ${energyLine(w, c)}`;
            return `Robotics adoption in ${civ.name} is at ${(w.techs.robotics_ind.adoption[c.civId].intensity * 100).toFixed(0)}% of feasible sites. Business is good — labor politics, less so. I'm ${moodWord(c.mood)}.`;
        }
        case 'worry': {
            const parts = [];
            if (civ.energy.marginPct < 4)
                parts.push(`power scarcity (margin ${civ.energy.marginPct.toFixed(1)}%)`);
            if (civ.food.shortage > 0.04)
                parts.push(`food shortage (${(civ.food.shortage * 100).toFixed(0)}% of demand unmet, prices ${civ.food.priceIndex.toFixed(1)}×)`);
            if (civ.housing.crowding > 0.15)
                parts.push(`housing crowding (rents ${civ.housing.rentIndex.toFixed(1)}× the 2026 level)`);
            if (civ.waste.accumulation > 0.4)
                parts.push(`waste piling up (only ${(civ.waste.managedShare * 100).toFixed(0)}% processed)`);
            if (civ.society.backlash > 0.5)
                parts.push(`automation backlash (${(civ.society.backlash * 100).toFixed(0)}%)`);
            if (civ.economy.unemployment > 0.08)
                parts.push(`joblessness at ${(civ.economy.unemployment * 100).toFixed(1)}%`);
            if (w.env.warmingC > 1.4)
                parts.push(`${w.env.warmingC.toFixed(2)}°C of warming`);
            const worst = civ.food.shortage > 0.08 ? 'food' : civ.energy.marginPct < 4 ? 'energy' : civ.society.backlash > 0.5 ? 'social cohesion' : civ.economy.unemployment > 0.08 ? 'employment' : 'complacency';
            return `What keeps me up at night is ${worst}. ${parts.length ? 'The numbers behind it: ' + parts.join(', ') + '.' : 'Right now the indicators are calm — but I remember how fast calm ends.'} ${c.concern ? `My long-standing concern: ${c.concern}.` : ''}`;
        }
        case 'ai':
            return aiLine(w) + (role.includes('ai') ? ' We debate daily whether the feedback loop is a tool or a tide.' : ' Whatever your politics, that curve touches everything I do.');
        case 'energy':
            return energyLine(w, c) + ` Data centers alone draw ${civ.energy.computeDemandTWh.toFixed(0)} TWh a year in ${civ.name} — ${(civ.energy.computeDemandTWh / Math.max(1, civ.energy.demandTWh) * 100).toFixed(0)}% of all demand.`;
        case 'food':
            return foodLine(w, c);
        case 'people': {
            const h = civ.housing;
            const ws = civ.waste;
            const living = h.crowding > 0.15
                ? ` Living space is the daily grievance — rents at ${h.rentIndex.toFixed(1)}× and counting.`
                : h.rentIndex < 1.05 ? ' Housing is affordable; people have room to live.' : '';
            const wasteLine = ws.accumulation > 0.35
                ? ` And the waste... only ${(ws.managedShare * 100).toFixed(0)}% is properly processed. You can smell the politics.`
                : ws.managedShare > 0.8 ? ' Even the waste system works — most of what we throw away becomes feedstock again.' : '';
            return `${laborLine(w, c)} Social trust is at ${(civ.society.trust * 100).toFixed(0)}% and stability at ${(civ.society.stability * 100).toFixed(0)}%.${living}${wasteLine}`;
        }
        case 'history': {
            const recent = c.history.slice(-3).map((h) => h.text);
            return `${recent.length ? recent.join(' ') : 'I have lived quietly so far.'} ${c.beliefs.length ? 'I still believe ' + c.beliefs[0].toLowerCase() + '.' : ''}`;
        }
    }
}
