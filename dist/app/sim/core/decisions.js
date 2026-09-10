import { addEvent, yearOf, proposeProject } from './step.js';
import { clamp } from './formulas.js';
import { startWar, syntheticBirthsAvailable } from './society.js';
const policy = (civId, p, strength, months) => ({ kind: 'policy', civId, policy: p, strength, months });
export const DECISIONS = [
    {
        id: 'synthetic_births', title: 'Children without parents',
        question: (_w, c) => `${c.name}: in vitro gametogenesis and full ectogenesis are validated. Fertility is ${c.population.fertility.toFixed(2)} and the median age ${c.population.medianAge.toFixed(0)}. Children can now be made without a pregnancy, and without a couple. Who decides to make them?`,
        trigger: (w, c) => syntheticBirthsAvailable(w) && c.population.fertility < 1.45 && c.society.syntheticProgram === 'none',
        months: 36,
        options: [
            { id: 'state', label: 'A state birth programme', consequence: 'Cohorts raised by public institutions and care robots to hold the pyramid level. Costly; trust falls for a generation while the first children grow up.', apply: (_w, c) => { c.society.syntheticProgram = 'state'; }, affinity: (c) => (1 - c.traits.marketOrientation) * 0.6 + (c.population.fertility < 1.3 ? 0.3 : 0) },
            { id: 'family', label: 'Licence to families', consequence: 'Any adult or couple may have a child this way; uptake follows wealth. Modest, steady rise in births; inequality of who gets children.', apply: (_w, c) => { c.society.syntheticProgram = 'family'; }, affinity: (c) => c.traits.marketOrientation * 0.6 + c.traits.openness * 0.3 },
            { id: 'both', label: 'Both: programme plus licence', consequence: 'The pyramid holds; the cost and the trust hit are both real.', apply: (_w, c) => { c.society.syntheticProgram = 'both'; }, affinity: (c) => c.traits.riskTolerance * 0.5 + (c.population.medianAge > 60 ? 0.4 : 0) },
            { id: 'ban', label: 'Ban it', consequence: 'No synthetic births. The pyramid keeps aging; the technology moves to a neighbour.', apply: (_w, c) => { c.society.syntheticProgram = 'ban'; }, affinity: (c) => c.traits.regulatoryCaution * 0.9 },
        ],
    },
    {
        id: 'enhancement', title: 'Heritable enhancement',
        question: (_w, c) => `${c.name}: germline edits for disease resistance and cognition are validated across two generations. Public, private, or banned?`,
        trigger: (w, c) => w.inventions.some((i) => i.id.startsWith('inv-germline-enhancement-') && i.status === 'deployed') && c.society.enhancement === 'none',
        options: [
            { id: 'public', label: 'Public and universal', consequence: 'Education and health rise for every cohort born from now on; a large permanent cost.', apply: (_w, c) => { c.society.enhancement = 'public'; c.population.education = Math.min(1.4, c.population.education + 0.05); c.economy.publicDebt += 0.06; }, affinity: (c) => 1 - c.traits.marketOrientation * 0.6 },
            { id: 'private', label: 'Private, market price', consequence: 'A two-tier population inside a generation; inequality climbs; the enhanced leave for where they are paid most.', apply: (_w, c) => { c.society.enhancement = 'private'; c.economy.gini = Math.min(0.78, c.economy.gini + 0.05); c.population.education = Math.min(1.4, c.population.education + 0.02); }, affinity: (c) => c.traits.marketOrientation * 0.8 },
            { id: 'ban', label: 'Ban', consequence: 'No enhancement here. Talent that wants it emigrates.', apply: (_w, c) => { c.society.enhancement = 'ban'; c.researchCapacity *= 0.97; }, affinity: (c) => c.traits.regulatoryCaution },
        ],
    },
    {
        id: 'conflict', title: 'On the edge of war',
        question: (w, c) => { const k = w.pendingConflict[0]; const o = w.civs.find((x) => x.id === (k?.a === c.id ? k?.b : k?.a)); return `${c.name} and ${o?.name ?? 'a neighbour'}: tension over scarce minerals, food and land has reached the point where ports are being watched and fleets moved. What does ${c.name} do?`; },
        trigger: () => false, // raised by society.ts, not by the scan
        months: 12,
        options: [
            { id: 'negotiate', label: 'Negotiate: share the scarce thing', consequence: 'A treaty on minerals, food or water. Tension falls; you give up some of what you have; collaboration improves.', apply: (w, c) => { const k = w.pendingConflict.shift(); if (!k)
                    return; const r = w.relations.find((x) => (x.a === k.a && x.b === k.b) || (x.a === k.b && x.b === k.a)); r.tension = 0.3; r.relation = Math.min(1, r.relation + 0.3); r.tradeOpenness = Math.min(1, r.tradeOpenness + 0.15); c.economy.output *= 0.985; }, affinity: (c) => c.traits.openness * 0.8 },
            { id: 'sanction', label: 'Sanctions and blockade', consequence: 'Trade and science with them stop. Their economy suffers, yours less; tension stays high.', apply: (w) => { const k = w.pendingConflict.shift(); if (!k)
                    return; const r = w.relations.find((x) => (x.a === k.a && x.b === k.b) || (x.a === k.b && x.b === k.a)); r.tradeOpenness = 0.05; r.sciCollaboration = 0.05; r.relation = -0.5; r.tension = 0.6; r.grievances.push('blockade'); }, affinity: (c) => c.traits.strategicAutonomy * 0.7 },
            { id: 'war', label: 'Strike first', consequence: 'War. Grids, ports and homes on both sides; lives; debt; a grievance that outlives everyone alive today.', apply: (w) => { const k = w.pendingConflict.shift(); if (!k)
                    return; startWar(w, k.a, k.b); }, affinity: (c) => c.traits.riskTolerance * 0.4 + c.traits.strategicAutonomy * 0.3 - c.traits.openness * 0.3 },
        ],
    },
    {
        id: 'pandemic', title: 'The pandemic',
        question: (w, c) => `${c.name}: a new pathogen (severity ${w.pandemic?.severity.toFixed(1) ?? '?'}) is in the ports. The old are dying first. Lock down or stay open?`,
        trigger: (w, c) => !!w.pandemic && w.pendingPandemic && c.id === 'veloria',
        months: 3,
        options: [
            { id: 'lockdown', label: 'Lock down hard, everywhere', consequence: 'Deaths cut by two thirds; output and investment fall for the duration; trust in institutions decides how long people comply.', apply: (w) => { w.pendingPandemic = false; for (const c of w.civs)
                    c.society.lockdown = 0.8; }, affinity: (c) => c.traits.regulatoryCaution },
            { id: 'targeted', label: 'Protect the old, keep working', consequence: 'Half the deaths avoided, a quarter of the economic cost.', apply: (w) => { w.pendingPandemic = false; for (const c of w.civs)
                    c.society.lockdown = 0.4; }, affinity: () => 0.6 },
            { id: 'open', label: 'Stay open', consequence: 'The economy runs; the pyramid loses its top; trust depends on how bad it gets.', apply: (w) => { w.pendingPandemic = false; for (const c of w.civs)
                    c.society.lockdown = 0; }, affinity: (c) => c.traits.marketOrientation * 0.7 },
        ],
    },
    {
        id: 'ai_incident', title: 'After the cascade',
        question: (_w, c) => `${c.name}: an automated dispatch cascade took a region dark. Adoption has stalled. What does the polity require of autonomous systems now?`,
        trigger: (w, c) => w.pendingAiIncident && c.id === 'ardan',
        months: 12,
        options: [
            { id: 'oversight', label: 'Mandatory verification and human oversight', consequence: 'Adoption resumes slowly and safely; a permanent cost on every deployment; backlash fades.', apply: (w) => { w.pendingAiIncident = false; for (const c of w.civs) {
                    c.society.backlash = Math.max(0, c.society.backlash - 0.1);
                    c.traits.regulatoryCaution = Math.min(1, c.traits.regulatoryCaution + 0.1);
                } }, affinity: () => 0.7 },
            { id: 'pause', label: 'Pause autonomous deployment for five years', consequence: 'No repeat; five years of lost productivity; neighbours pull ahead.', apply: (w) => { w.pendingAiIncident = false; for (const c of w.civs) {
                    w.techs.ai_agents.adoption[c.id].penetration *= 0.6;
                    c.society.backlash = Math.max(0, c.society.backlash - 0.15);
                } }, affinity: (c) => c.traits.regulatoryCaution },
            { id: 'continue', label: 'Continue; accept the risk', consequence: 'Full speed; backlash stays; the next incident is a matter of time.', apply: (w) => { w.pendingAiIncident = false; }, affinity: (c) => c.traits.riskTolerance },
        ],
    },
    {
        id: 'agi_work', title: 'Work is disappearing faster than it is replaced',
        question: (_w, c) => `${c.name}: general intelligence has arrived. ${(c.economy.displacedShare * 100).toFixed(0)}% of the workforce has been displaced and unemployment is ${(c.economy.unemployment * 100).toFixed(0)}%. How should income reach people who no longer work?`,
        trigger: (w, c) => w.frontier.agi && (c.economy.displacedShare > 0.15 || c.economy.unemployment > 0.09),
        options: [
            { id: 'floor', label: 'Universal income and services floor', consequence: 'Legitimacy holds; a permanent share of output goes to the floor; inequality falls.', effects: [], apply: (_w, c) => { c.society.basicProvision = Math.max(c.society.basicProvision, 0.5); }, affinity: (c) => 1 - c.traits.marketOrientation * 0.6 },
            { id: 'retrain', label: 'Massive retraining and shorter weeks', consequence: 'Slower relief, cheaper; works only where new work actually appears.', effects: [], apply: (w, c) => { w.activeInterventions.push({ id: 'dec-retrain', label: 'Retraining programme', tStart: w.tMonths, monthsLeft: 180, effects: [policy(c.id, 'retraining', 1.0, 180), policy(c.id, 'education', 0.6, 180)] }); }, affinity: (c) => 0.5 + c.population.education * 0.3 },
            { id: 'market', label: 'Let markets sort it out', consequence: 'No new spending. Backlash and inequality rise until something breaks or something new appears.', apply: (_w, c) => { c.society.backlash = clamp(c.society.backlash + 0.12, 0, 1); }, affinity: (c) => c.traits.marketOrientation * 0.8 },
        ],
    },
    {
        id: 'land_out', title: 'The island is full',
        question: (_w, c) => `${c.name}: ${(c.land.pressure * 100).toFixed(0)}% of usable land is committed and rents are ${c.housing.rentIndex.toFixed(1)}× 2026. Where do the next homes go?`,
        trigger: (_w, c) => c.land.pressure > 0.9 && c.housing.crowding > 0.08,
        options: [
            { id: 'up', label: 'Build up: densify the cities', consequence: 'Cheapest. Taller, denser districts; construction cost per home rises with height.', apply: (_w, c) => { c.land.densityIndex = Math.min(2.4, c.land.densityIndex + 0.15); }, affinity: () => 0.6 },
            { id: 'sea', label: 'Build out: reclaim the shelf and float districts', consequence: 'A national coastal programme for twenty years. Expensive, permanent dikes; the sea gets a vote.', apply: (w, c) => { w.activeInterventions.push({ id: 'dec-coast', label: 'Coastal expansion programme', tStart: w.tMonths, monthsLeft: 240, effects: [policy(c.id, 'coastal_expansion', 1.0, 240)] }); }, affinity: (c) => c.traits.riskTolerance * 0.6 + (c.land.shelf > 0.05 ? 0.3 : 0) },
            { id: 'cap', label: 'Cap migration, turn farmland into housing', consequence: 'Food self-sufficiency falls; imports rise; fewer newcomers.', params: { migrationMult: 0.6 }, apply: (_w, c) => { c.food.landUse = Math.max(0.3, c.food.landUse - 0.08); }, affinity: (c) => 1 - c.traits.openness },
        ],
    },
    {
        id: 'fusion_first', title: 'The pilot plant works',
        question: (_w, c) => `${c.name}: a fusion pilot has produced net electricity. The first commercial plant would cost several times a nuclear unit. Build it now, or wait?`,
        trigger: (w, c) => w.inventions.some((i) => i.id.startsWith('inv-fusion-pilot-plant-') && i.status === 'deployed') && c.energy.sources.fusion.cap < 0.01 && c.frontierReadiness > 0.45,
        options: [
            { id: 'build', label: 'Build the first commercial plant', consequence: 'Costly first unit; every plant after it is 10% cheaper. Fusion becomes a real option a decade earlier.', apply: (w, c) => { proposeProject(w, c, 'fusion', 0.5, 'first commercial fusion plant, decided by the council'); }, affinity: (c) => c.traits.sciencePriority * 0.7 + c.traits.riskTolerance * 0.3 },
            { id: 'nuclear', label: 'Fission now, fusion later', consequence: 'Proven firm power today; fusion learning happens elsewhere first.', apply: (w, c) => { proposeProject(w, c, 'nuclear', 2, 'firm capacity decided by the council'); }, affinity: (c) => 0.5 + c.traits.regulatoryCaution * 0.3 },
            { id: 'wait', label: 'Wait for costs to fall', consequence: 'No spending. If nobody builds, costs never fall.', affinity: (c) => c.traits.regulatoryCaution * 0.6 },
        ],
    },
    {
        id: 'fuel_price', title: 'Cheap fuel is over',
        question: (w, c) => `${c.name}: fossil fuel costs ${w.resources.fossilCostIndex.toFixed(1)}× 2026 and ${c.energy.sources.fossil.cap.toFixed(0)} GW of thermal plants still carry the grid. What replaces them?`,
        trigger: (w, c) => w.resources.fossilCostIndex > 1.5 && c.energy.sources.fossil.cap > 5,
        options: [
            { id: 'clean', label: 'Crash clean build-out', consequence: 'Solar, wind, storage and grid at wartime pace; capital diverted from everything else for a decade.', params: { energyCapexMult: 1.3, buildSpeedMult: 1.15 }, apply: (w, c) => { proposeProject(w, c, 'solar', 6, 'crash clean build decided by the council'); proposeProject(w, c, 'storage', 3, 'storage for the crash build'); }, affinity: (c) => 0.5 + c.traits.sciencePriority * 0.3 },
            { id: 'firm', label: 'Nuclear and fusion for firm power', consequence: 'Slower to arrive, steadier when it does.', apply: (w, c) => { proposeProject(w, c, 'nuclear', 3, 'firm capacity decided by the council'); }, affinity: (c) => c.traits.strategicAutonomy * 0.7 },
            { id: 'ration', label: 'Ration and pay the price', consequence: 'Prices rise, industry slows, stability suffers; the fleet keeps running while fuel lasts.', apply: (_w, c) => { c.economy.energyIntensityIndex *= 0.95; c.society.stability = Math.max(0.05, c.society.stability - 0.04); }, affinity: (c) => 0.2 + (1 - c.traits.capitalWealth) * 0.4 },
        ],
    },
    {
        id: 'longevity_access', title: 'Aging can be slowed',
        question: (_w, c) => `${c.name}: senescence-clearance therapy is validated. Who gets it?`,
        trigger: (w, c) => w.inventions.some((i) => i.id.startsWith('inv-senescence-clearance-') && i.status === 'deployed') && w.techs.longevity_bio.adoption[c.id].penetration < 0.15,
        options: [
            { id: 'public', label: 'Public programme for everyone', consequence: 'Fast adoption, longer working lives, a large permanent cost; pensions become a century-long question.', apply: (w, c) => { w.techs.longevity_bio.adoption[c.id].penetration = Math.max(w.techs.longevity_bio.adoption[c.id].penetration, 0.25); c.economy.publicDebt += 0.08; }, affinity: (c) => 1 - c.traits.marketOrientation * 0.5 },
            { id: 'private', label: 'Private access, market price', consequence: 'Slow adoption, the rich first; inequality rises.', apply: (_w, c) => { c.economy.gini = Math.min(0.78, c.economy.gini + 0.03); }, affinity: (c) => c.traits.marketOrientation },
            { id: 'restrict', label: 'Restrict to medical need', consequence: 'Little demographic effect; the research moves elsewhere.', apply: (w, c) => { w.techs.longevity_bio.adoption[c.id].penetration *= 0.5; }, affinity: (c) => c.traits.regulatoryCaution * 0.8 },
        ],
    },
    {
        id: 'debt_wall', title: 'The debt wall',
        question: (_w, c) => `${c.name}: public debt is ${(c.economy.publicDebt * 100).toFixed(0)}% of output and interest crowds out investment. What gives?`,
        trigger: (_w, c) => c.economy.publicDebt > 1.9 && c.economy.institutionalCapacity > 0.3,
        options: [
            { id: 'austerity', label: 'Austerity: cut investment and services', consequence: 'Debt stabilises; projects stall; trust falls.', apply: (_w, c) => { c.economy.publicDebt -= 0.15; c.economy.capexAvailability *= 0.8; c.society.trust = Math.max(0.05, c.society.trust - 0.06); c.society.basicProvision *= 0.7; }, affinity: (c) => c.traits.marketOrientation * 0.7 },
            { id: 'restructure', label: 'Restructure the debt', consequence: 'A third written off; capital is scarce for a decade; institutions bruised.', apply: (_w, c) => { c.economy.publicDebt *= 0.65; c.economy.capexAvailability *= 0.6; c.economy.institutionalCapacity = Math.max(0.1, c.economy.institutionalCapacity - 0.08); }, affinity: (c) => 0.3 + (1 - c.traits.capitalWealth) * 0.5 },
            { id: 'grow', label: 'Borrow into growth', consequence: 'Investment continues; if growth comes, the ratio falls; if not, the wall returns higher.', params: { capitalAvailability: 1.1 }, apply: (_w, c) => { c.economy.capexAvailability *= 1.1; }, affinity: (c) => c.traits.riskTolerance },
        ],
    },
    {
        id: 'dikes', title: 'The sea is winning',
        question: (w, c) => `${c.name}: sea level is +${w.env.seaLevelM.toFixed(2)} m and the dikes around the reclaimed districts are at ${(c.land.reclaimedCondition * 100).toFixed(0)}%. Defend or retreat?`,
        trigger: (_w, c) => c.land.reclaimed > 0.01 && c.land.reclaimedCondition < 0.5,
        options: [
            { id: 'defend', label: 'Defend: a generation of sea walls', consequence: 'Districts saved; debt up; the walls need paying for forever.', apply: (_w, c) => { c.land.reclaimedCondition = Math.min(1, c.land.reclaimedCondition + 0.4); c.economy.publicDebt += 0.12; }, affinity: (c) => c.economy.institutionalCapacity },
            { id: 'retreat', label: 'Managed retreat', consequence: 'The districts are given back to the sea in order; people rehoused inland; crowding rises.', apply: (_w, c) => { const lost = c.land.reclaimed * 0.5; c.land.reclaimed -= lost; c.land.usable -= lost; c.land.lost += lost; c.housing.stockIndex = Math.max(0.15, c.housing.stockIndex * 0.94); }, affinity: (c) => 1 - c.economy.institutionalCapacity },
        ],
    },
    {
        id: 'space_program', title: 'The launch pad is cheap enough',
        question: (_w, c) => `${c.name}: launch costs are ${(c.space.launchCostIndex * 100).toFixed(0)}% of 2026 and the treasury can afford a long bet. Commit to a national space programme?`,
        trigger: (_w, c) => c.space.launchCostIndex < 0.25 && c.frontierReadiness > 0.65 && c.space.spaceportCapacity < 0.5,
        options: [
            { id: 'yes', label: 'Commit for twenty years', consequence: 'Spaceports, asteroid minerals and a Mars outpost become reachable; patient capital tied up for decades.', apply: (w, c) => { w.activeInterventions.push({ id: 'dec-space', label: 'National space programme', tStart: w.tMonths, monthsLeft: 240, effects: [policy(c.id, 'space_program', 1.0, 240), { kind: 'effort', techId: 'space_systems', mult: 1.8, months: 120 }] }); }, affinity: (c) => c.traits.sciencePriority * 0.5 + c.traits.strategicAutonomy * 0.4 },
            { id: 'earth', label: 'Earth first', consequence: 'The money stays on the ground: housing, grid, climate. Space happens when the market wants it.', params: { spaceMult: 0.85 }, affinity: (c) => 1 - c.traits.riskTolerance },
        ],
    },
    {
        id: 'climate_2_5', title: 'Two and a half degrees',
        question: (w, _c) => `Warming has passed ${w.env.warmingC.toFixed(1)} °C. Harvests are beginning to fail in the exposed regions. Fund climate engineering research, or adapt?`,
        trigger: (w, c) => w.env.warmingC > 2.5 && c.frontierReadiness > 0.5 && c.id === 'veloria',
        options: [
            { id: 'engineer', label: 'Fund sunshade and capture research', consequence: 'Decades of work toward an engineered climate; needs planetary energy to run. Collaboration improves.', params: { collaboration: 1.15, cleanLearningMult: 1.15 }, apply: (w) => { for (const c of w.civs)
                    c.researchCapacity *= 1.05; }, affinity: (c) => c.traits.sciencePriority },
            { id: 'adapt', label: 'Adapt: seawalls, indoor farming, migration', consequence: 'Cheaper now; the temperature keeps rising.', apply: (w) => { for (const c of w.civs)
                    c.food.artificialShare = Math.min(1, c.food.artificialShare + 0.05); }, affinity: (c) => c.traits.regulatoryCaution },
        ],
    },
    {
        id: 'shrinking', title: 'The population has peaked',
        question: (_w, c) => `${c.name} has passed its population peak (${c.population.peakPhysical.toFixed(0)}M). Fertility is ${c.population.fertility.toFixed(2)}. Respond, or let the cities consolidate?`,
        trigger: (_w, c) => c.population.total < c.population.peakPhysical * 0.96 && c.population.fertility < 1.7,
        options: [
            { id: 'natal', label: 'Pro-natal: housing, childcare, time', consequence: 'Fertility rises slowly; costs money for a generation before it pays.', apply: (_w, c) => { c.population.fertility = Math.min(3, c.population.fertility + 0.2); c.economy.publicDebt += 0.05; }, affinity: (c) => 1 - c.traits.openness * 0.5 },
            { id: 'migrate', label: 'Open the doors to migrants', consequence: 'Population holds; integration strains trust for a decade.', params: { migrationMult: 1.4 }, apply: (_w, c) => { c.society.trust = Math.max(0.05, c.society.trust - 0.03); }, affinity: (c) => c.traits.openness },
            { id: 'consolidate', label: 'Accept it: consolidate the cities', consequence: 'Fewer, better-kept districts; derelict blocks cleared; a smaller, older, richer polity.', apply: (_w, c) => { c.housing.abandoned *= 0.6; c.housing.stockIndex *= 0.97; }, affinity: (c) => c.traits.regulatoryCaution * 0.6 },
        ],
    },
];
export function stepDecisions(w) {
    if (w.tMonths % 3 !== 0)
        return;
    for (const c of w.civs) {
        for (const d of DECISIONS) {
            const key = `decision-${d.id}-${c.id}`;
            if (w.flags[key])
                continue;
            if (w.pendingDecisions.some((p) => p.key === key))
                continue;
            if (!d.trigger(w, c))
                continue;
            w.flags[key] = true;
            w.pendingDecisions.push({ key, defId: d.id, civId: c.id, title: d.title, question: d.question(w, c), raisedAt: w.tMonths, deadline: w.tMonths + (d.months ?? 24), options: d.options.map((o) => ({ id: o.id, label: o.label, consequence: o.consequence })) });
            addEvent(w, { title: `${c.name} faces a decision: ${d.title}`, body: d.question(w, c), category: 'milestone', civId: c.id, significance: 2, causes: [{ factor: 'a turning point in the simulated state', weight: 1 }], counterforces: [], confidence: 'high' });
        }
    }
    // Conflicts are raised by society.ts for a pair; the card goes to the more autonomous side.
    for (const k of w.pendingConflict) {
        const key = `conflict-${k.a}-${k.b}-${w.tMonths}`;
        if (w.pendingDecisions.some((p) => p.defId === 'conflict'))
            break;
        const d = DECISIONS.find((x) => x.id === 'conflict');
        const A = w.civs.find((c) => c.id === k.a), B = w.civs.find((c) => c.id === k.b);
        const c = A.traits.strategicAutonomy >= B.traits.strategicAutonomy ? A : B;
        w.pendingDecisions.push({ key, defId: d.id, civId: c.id, title: d.title, question: d.question(w, c), raisedAt: w.tMonths, deadline: w.tMonths + (d.months ?? 24), options: d.options.map((o) => ({ id: o.id, label: o.label, consequence: o.consequence })) });
        addEvent(w, { title: `${A.name} and ${B.name} on the edge of war`, body: d.question(w, c), category: 'conflict', civId: c.id, significance: 3, causes: [{ factor: 'scarcity and grievance', weight: 1 }], counterforces: [{ factor: 'trade and science ties', weight: 0.5 }], confidence: 'medium' });
    }
    // Silence is a decision: past the deadline the civilization chooses in character.
    for (const p of [...w.pendingDecisions])
        if (w.tMonths >= p.deadline)
            resolveDecision(w, p.key, null);
}
export function resolveDecision(w, key, optionId) {
    const idx = w.pendingDecisions.findIndex((p) => p.key === key);
    if (idx < 0)
        return false;
    const p = w.pendingDecisions[idx];
    const def = DECISIONS.find((d) => d.id === p.defId);
    const c = w.civs.find((x) => x.id === p.civId);
    const opt = optionId ? def.options.find((o) => o.id === optionId) : null;
    const chosen = opt ?? def.options.reduce((a, b) => (b.affinity(c) > a.affinity(c) ? b : a));
    if (chosen.effects && chosen.effects.length)
        w.activeInterventions.push({ id: `dec-${p.defId}`, label: def.title, tStart: w.tMonths, monthsLeft: 120, effects: chosen.effects });
    if (chosen.params)
        for (const [k, v] of Object.entries(chosen.params))
            w.params[k] = (w.params[k] ?? 1) * v;
    chosen.apply?.(w, c);
    w.pendingDecisions.splice(idx, 1);
    addEvent(w, {
        title: `${c.name} decides: ${chosen.label}`,
        body: `${opt ? 'The observer chose.' : `Left to itself, ${c.name} chose in character.`} ${chosen.consequence} (${Math.floor(yearOf(w))})`,
        category: 'milestone', civId: c.id, significance: 3,
        causes: [{ factor: def.title, weight: 1 }], counterforces: [], confidence: 'high',
    });
    return true;
}
