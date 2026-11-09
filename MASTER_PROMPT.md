# WHAT IF? CIVILIZATION LAB
## Autonomous Reconstruction Master Prompt — v11.10

> **Start with the world we have. Watch what comes next.**
>
> **Change one assumption. Watch the future diverge.**

This document is a constitution for rebuilding WHAT IF? Civilization Lab from scratch. It is intentionally **not** a file-by-file implementation specification. A capable model, coding agent, or autonomous swarm should be free to choose the architecture, representation, visual language, interface, scenario structure, algorithms, and technical stack that best realize the idea.

The reference implementation may be inspected for useful mechanisms, but it is not sacred. Recreate the product creatively. Preserve the central idea and the scientific integrity rules below; challenge everything else.

---

# 1. The product idea that must not change

Build an explorable civilization-futures laboratory that begins from a recognizable present and lets a person **watch causal futures unfold, change assumptions, intervene, branch history, and understand why the result changed**.

It is neither a static future timeline nor a prediction engine. It is a playable systems model.

The core experience should make the user feel:

- the future is open rather than prewritten;
- technologies have prerequisites, costs, delays, diffusion and failure modes;
- physical systems matter: energy, land, materials, compute, food, infrastructure and time cannot be wished away;
- social systems matter just as much: governance, trust, distribution, demographics, culture, conflict and coordination change what technology actually does;
- attractive futures are possible without requiring a collapse story;
- technically spectacular futures can still be socially bad;
- modest or Earth-bound futures can be excellent;
- a single changed assumption can produce a visibly different history;
- every surprising result can be traced to a causal chain rather than hidden script.

Everything after this section is a design constraint in service of that idea, not a mandate to clone the current application.

---

# 2. Epistemic contract

Every build must make this distinction explicit:

> **The simulation generates conditional futures. It does not forecast what will happen.**

A valid statement is:

> Given these starting conditions, empirical observations, model assumptions, constraints, uncertainty, stochastic variation and interventions, this is one future produced by the model.

An invalid statement is:

> This technology will arrive in 2043.

## 2.1 Three evidence classes

Every important mechanism belongs to one of these classes and should be discoverable in the UI or evidence registry.

**A. Empirically anchored** — observed stocks, flows, rates or relationships that can be reasonably calibrated from current evidence.

**B. Extrapolative / conditional** — mechanisms with empirical roots but substantial uncertainty outside the observed range.

**C. Speculative** — deep-future mechanisms used to explore coherent possibilities, not to claim likelihood.

Do not blur these classes. Speculative mechanics are welcome; pretending they are measured facts is not.

## 2.2 Never extrapolate a benchmark past the meaning of the benchmark

If an empirical metric stops being valid, stop using its units.

Example: a benchmark that expresses AI task difficulty in hours of human completion time must not be mechanically extended into “AI can autonomously work for ten years” if the benchmark suite cannot measure that range. Beyond the validated region, switch to a clearly named capability proxy, scenario regime, or uncertainty envelope.

This rule applies equally to AI, fusion costs, longevity, climate response, economic productivity, space settlement, resource extraction and every other domain.

## 2.3 Deep uncertainty is a feature

For important uncertain systems, prefer **families of plausible trajectories** over a single privileged curve.

For AI in particular, the model should be able to represent at least qualitatively different regimes such as:

- progress stalls;
- progress slows;
- progress roughly continues;
- progress accelerates;

and should allow bottlenecks in compute, energy, data, hardware, capital, reliability, regulation and institutions to make those regimes diverge.

A baseline may be convenient, but it must not silently become “the forecast.”

---

# 3. Start from the present without pretending the abstraction is literal Earth

The reference world starts around September 2026. If this project is rebuilt materially later, research and re-baseline the present rather than fossilizing old numbers; preserve the principle “start with the world we have.”

The implementation may model:

- literal countries;
- regions;
- representative synthetic civilizations;
- a compressed world model;
- a hybrid of global stocks and representative polities.

Choose what best supports clarity and computational tractability.

But **label the abstraction truthfully**. If the simulated population is a 250-million-person synthetic region while energy is rescaled to a world analogue, never call that number “world population.” If a metric is normalized or rescaled, say so.

A synthetic world is acceptable. A misleading one is not.

---

# 4. Model the future as a causal system, not a collection of counters

The simulation must contain stocks, flows, capacities, queues, delays, feedback loops and state-dependent decisions.

A useful mental model is:

**state → pressures → decisions/projects/research → delayed effects → new state → emergent events**

Do not award outcomes because a date arrived.

## 4.1 Stocks should remain stocks

Examples:

- population by age or demographic structure;
- installed generation and grid capacity;
- housing stock and condition;
- compute capacity;
- physical capital;
- public debt;
- trust and institutional capability;
- research capability;
- finite reserves and recyclable material stocks;
- sea level;
- off-world habitat capacity;
- accumulated waste or environmental damage.

Stocks should generally change through flows, projects, depreciation, births/deaths, migration, extraction/recycling, investment or damage.

## 4.2 Projects need time and resources

Infrastructure and frontier programs should normally move through a lifecycle such as:

proposal → approval → financing → construction → commissioning → operation → aging / maintenance / retirement

The exact implementation is free. The invariant is that new physical capacity cannot appear because a scalar “technology level” went up.

## 4.3 Technology is not adoption

Separate at least conceptually:

1. scientific knowledge;
2. prototype capability;
3. engineering maturity and reliability;
4. manufacturing capacity;
5. unit cost;
6. deployment;
7. adoption / diffusion;
8. intensity of use.

Different civilizations should be able to use the same frontier technology very differently.

## 4.4 Technology is not free productivity

Economic output must remain physically and institutionally supportable.

AI may improve research, planning and productivity, but it must also require compute, power, hardware, capital, integration and organizational adaptation. Robotics requires factories and materials. Biotech requires validation and delivery. Energy systems require construction and grids.

Do not allow a productivity scalar to conjure electricity, housing, food, materials or functioning institutions.

---

# 5. Hard physical constraints

The world should be generous enough to allow positive futures and hard enough that the user can see tradeoffs.

At minimum model the constraints that materially affect the selected future space.

## 5.1 Energy

Represent demand, generation, deliverability, grid capacity, storage/flexibility, reserve margin, price and physical condition well enough that shortages have consequences.

Do **not** reduce the future of energy to solar + batteries + fusion. A credible rebuild should be able to represent a portfolio where relevant: solar, wind, hydro, fission, geothermal, sustainable bioenergy, tidal/wave/ocean-thermal systems, storage, synthetic fuels and fusion if it is actually earned. The exact set may change with geography and horizon.

Treat hydrogen correctly: it is an **energy carrier / storage / industrial feedstock**, not a primary energy source. Hydrogen can matter enormously for seasonal storage, shipping, steel, chemicals or heavy transport, but only if primary energy exists to produce it, conversion losses are paid, and infrastructure is built. The same discipline applies to ammonia, synthetic hydrocarbons and other carriers.

Habitats may have different energy economies. A sea-based civilization, underground civilization, orbital settlement, Mars polity or interstellar habitat should not simply inherit the same terrestrial generation mix and constraints.

Compute and electrification should increase demand, but avoid the simplistic rule “AI electricity constrains everything.” Energy is one important bottleneck among several and its importance changes by scenario.

## 5.2 Materials and finite resources

Represent finite or costly stocks where they matter. Depletion should raise costs or create substitution pressure rather than trigger a magic cliff.

Allow exits such as recycling, efficiency, substitution, new extraction, seabed resources, off-world resources, reduced material intensity or lower demand — each with costs and side effects.

## 5.3 Land, food, housing and cities

Population and prosperity should occupy physical space somehow. Land scarcity can be addressed by ordinary densification, arcologies / extreme vertical construction, underground habitation, redevelopment, reclamation, floating systems, subsea habitats, migration, declining population, off-world settlement, or other plausible paths.

Each path must create its own constraints. Building upward trades land for structural, evacuation and maintenance dependence. Underground habitation trades surface land for excavation, ventilation, pumping, heat rejection and emergency-access dependence. Floating and subsea habitats trade land for marine maintenance. Off-world habitats trade terrestrial scarcity for life-support, radiation, logistics and industrial-autonomy constraints.

Do not make “more land” the only positive solution. Compact cities are a legitimate future. Nor should the model assume that population must eventually stabilize: indefinite growth is allowed until some real carrying-capacity, habitat, energy, material, ecological or social constraint actually binds.

## 5.3.1 City growth must be visible, and settlement can converge

If population rises and the built world does not change, the render is lying about the simulation. Growth needs visible channels: infill, redevelopment of low-rise fabric into higher density, suburbs beyond the original footprint, and — where a civilization earns it — new architectural families. Immutable plots are a modelling convenience, not a law.

Distribute population across a territory, not within one pot. A civilization can concentrate into a single dominant metropolis and leave its older towns to empty, or keep a polycentric network. Make that concentration emergent rather than scripted: it should follow from conditions like automation-mediated aversion, displacement, housing and transport viability — and it should be reversible by policy.

Whatever the mechanism, the two directions must be representable: **dispersion** and **convergence**. A model that can only spread evenly cannot describe either a suburb or a metropolis.

## 5.4 Climate and sea level

Temperature, climate damage and sea level must not be the same variable.

Sea level is a **lagged, path-dependent stock**. Lowering atmospheric temperature cannot instantly lower the ocean. Past warming creates long-lived commitment.

Climate intervention, if included, should be an operated capability with energy, governance, maintenance, side effects and failure risk — not a permanent magic flag.

## 5.5 Time

Lead times matter. A civilization can know exactly what it should build and still fail because transmission, reactors, fabs, ports, housing or institutions cannot scale fast enough.

---

# 6. Society is not a cosmetic modifier

The simulation should be able to produce worlds with similar technology but different lived outcomes.

Model enough social state to create meaningful divergence. Useful dimensions include:

- institutional capacity / execution quality;
- trust and legitimacy;
- inequality / distribution;
- basic provision or social insurance;
- unemployment / labor relevance / work transition;
- education and absorptive capacity;
- demographics and dependency ratios;
- migration;
- political backlash;
- regulation and risk tolerance;
- cooperation, trade and conflict;
- public finance;
- biosecurity and public health capacity;
- **population health as its own stock** (see 6.1);
- **who can obtain cognitively significant technology** (see 6.2);
- settlement geography: how population is distributed across a territory (see 5.3.1);
- climate adaptation capacity.

The exact variables may differ. The invariant is that institutions and distribution must be able to change whether technological abundance becomes broadly beneficial, destabilizing, exclusionary or wasted.

## 6.1 Population health is a stock, not an event log

A model that only subtracts deaths during a shock cannot answer "who could withstand the next shock". Track a population health state that is:

- **built** by healthcare capacity, income and institutional delivery;
- **eroded** by pollution, crowding, hunger and exhausting forms of work;
- **slow to recover** — a damaged population takes years to heal;
- **consequential**: it should change mortality, births, trust, and how many people a given pandemic kills.

Reuse it. The same state should make an epidemic, a heat wave and a famine interact, instead of each being an isolated subtraction. If a shock kills the same share of the population in a healthy society and a broken one, health is decoration.

## 6.2 Distinguish capability from access

A technology can exist, be cheap, and still be unequally held. For any technology that changes what a person can *do* rather than what a firm can *buy*, model access separately from adoption:

- adoption = how widely it is deployed;
- access = who can actually obtain it, as a policy outcome;
- consequence = whether the benefit spreads or concentrates.

The interesting scenarios are not "does the technology work" but "who holds it". Make that a decision with real trade-offs, not an automatic good.

## 6.3 Labour can be sold back to the machines

When automation displaces people faster than institutions absorb them and no floor exists, the last saleable asset is human attention: judgement, verification and accountability sold into machine systems by the task. Model it if you model displacement.

It matters because it is a **stabiliser that hides a bad equilibrium**: measured unemployment falls while health, equality and legitimacy degrade. A functioning income floor should remove most of the supply — that contrast is the point, and it should be testable.

Be honest about the physics. Literal biological brains as bulk compute are not credible: interface bandwidth is many orders of magnitude below what a machine interconnect provides. What is credible is human-shaped work inside machine loops.

---

# 7. Never define “civilization success” as technological expansion

This is a critical rule.

Do not treat any of the following as equivalent to flourishing:

- more frontier milestones;
- AGI or ASI;
- fusion;
- a high Kardashev index;
- Mars settlement;
- orbital habitats;
- inhabiting sea, sky and space;
- higher population;
- higher GDP/output alone.

These can be **capability or development-form dimensions**. They are not a moral score.

## 7.1 Separate outcome from form

The implementation should expose at least two independent descriptions:

### Lived-outcome profile

A multidimensional profile such as:

- material security;
- human development / health / education;
- institutional health;
- ecological safety;
- distribution / broad access to gains;
- resilience.

A composite may be shown for convenience only if the component axes remain visible and the weighting is transparent.

### Development form

A descriptive label such as:

- Earth-bound / compact;
- oceanic;
- spacefaring;
- digital / post-biological;
- mixed.

A civilization may flourish in any form.

A technologically ascending civilization may have poor outcomes.

This separation is mandatory even if the exact labels change.

---

# 8. Demography must have inertia

Do not update population from a one-line growth percentage if the project spans generations.

At minimum capture enough age structure or demographic inertia to produce:

- population momentum after fertility changes;
- aging;
- changing working-age share;
- deaths responding to health and crisis;
- migration;
- fertility affected by living conditions and institutions;
- longevity changing the age structure rather than simply adding people.

If radical longevity, ectogenesis, synthetic births, digital minds or other transhuman mechanisms are included, make their demographic consequences explicit.

Fertility must be a regime, not a hidden target population. Education and urbanization may lower fertility in some trajectories, but affordability, norms, institutions, reproductive technology, migration and cultural change must be able to produce persistence, rebound or renewed high growth.

Distinguish **decline, collapse, remnant society, territorial abandonment and extinction**. Falling below 1% or 10% of an initial population is not extinction. Extinction means there is no surviving embodied, off-world or digital population left. Recovery must conserve population: survivors can return, migrants can resettle territory, or digital/off-world populations may re-embody if the required technology exists, but the model must never respawn people from zero.

---

# 9. AI should change the system, not replace the system

AI is likely to be one of the strongest scenario drivers, but avoid a disguised “AI capability number determines history” model.

Potential channels:

- research tooling;
- software and planning productivity;
- labor substitution and complementarity;
- robotics control;
- design and engineering;
- scientific discovery;
- cyber / misuse / failure risk;
- institutional decision support;
- surveillance or coordination;
- demand for compute and electricity.

Potential brakes:

- reliability;
- evaluation limits;
- data;
- compute and hardware;
- power and grid capacity;
- capital;
- deployment friction;
- organizational integration;
- regulation;
- social acceptance;
- security and incident response;
- diminishing research returns.

Do not assume recursive improvement is either impossible or inevitable. Make it a scenario-sensitive feedback loop with ceilings and counterforces.

---

# 10. Frontier and transhuman futures are welcome — but conditional

The simulation may explore extremely ambitious futures, including:

- advanced autonomous AI;
- major life extension or partial age reversal;
- synthetic reproduction;
- abundant clean energy;
- commercial fusion;
- deep automation;
- floating or subsea habitats;
- orbital industry;
- lunar / asteroid resources;
- Mars settlement;
- large habitats;
- climate intervention;
- digital minds;
- **brain–AI interfaces** that augment a living person rather than replacing the body (distinct from uploading and from germline enhancement);
- Type-I-scale energy capture;
- early solar-system industry.

Do not schedule them merely because the timeline reached a year.

Unlock them through state-dependent prerequisites, research, validation, capital, materials, institutional capability and sustained operation.

Deep-future events should have visibly lower epistemic confidence than near-term infrastructure mechanics.

## 10.1 A positive transhuman path must be possible

One important scenario family is a **Transhuman & Earth-Bound Century**: high AI capability, biotechnology and longevity, high automation, clean energy and a permanent local space presence can reduce material scarcity while most people still live on Earth.

This is neither required to happen nor treated as utopia. It exists to prevent the model from assuming that finite resources imply only collapse or aggressive territorial expansion.

Other positive paths should exist too, including low-growth resilient prosperity.

---

# 11. Scenario space: make assumptions orthogonal

Do not build scenarios that differ only by “technology fast / technology slow.”

Create a scenario space across multiple independent dimensions. Useful axes:

- AI progress regime;
- AI assurance / safety;
- compute availability;
- energy construction and clean-energy learning;
- resource abundance and circularity;
- governance capacity;
- social contract / distribution;
- research collaboration;
- trade / geopolitical fragmentation;
- capital availability;
- technology diffusion;
- robotics;
- climate sensitivity;
- climate adaptation;
- biosecurity;
- fertility / aging / migration;
- frontier investment;
- marine vs space expansion;
- cultural responses.

## 11.1 Recommended scenario archetypes

Names and exact parameters are free, but the delivered build should demonstrate meaningfully different causal histories. Include enough of the following to stress the system:

1. **Present-course baseline** — central assumptions, clearly labeled as one reference case.
2. **AI R&D flywheel** — faster AI/research feedback with physical bottlenecks intact.
3. **AI progress stalls/slows** — a persistent plateau, not a preset that eventually converges to the fast world.
4. **Energy constraint** — demand outruns generation/grid build-out.
5. **Abundant clean energy** — cheap, scalable but not literally free power.
6. **Fragmented world** — lower trade, research spillovers and mobility.
7. **Open knowledge** — high scientific exchange and diffusion.
8. **Resource crunch** — low reserves / costly minerals before substitution arrives.
9. **Ocean / marine century** — marine infrastructure is favored over space.
10. **Capability ascent** — aggressive frontier investment, explicitly not pre-labeled “good.”
11. **Transhuman & Earth-Bound Century** — AI + biotech + longevity + local space presence with Earth remaining the main habitat.
12. **Human-centered abundance** — high productivity plus institutions that spread gains.
13. **Automation divide** — high AI/robotics plus weak distribution/governance.
14. **Resilient Earth** — adaptation, institutions, clean infrastructure and sufficiency prioritized over maximum frontier expansion.
15. **AI safety first** — slower diffusion with stronger evaluation/assurance.
16. **Polycrisis** — several individually manageable stresses compound through weak institutions.
17. **Hothouse / climate failure** — a credible severe climate path capable of state failure and demographic collapse.
18. **Long stagnation** — weak breakthrough dynamics, aging and infrastructure burden.
19. **Population spring / renewed fertility** — long-run demographic rebound tests real carrying constraints rather than a hidden population ceiling.
20. **Vertical world** — surface land is conserved; growth goes upward and underground first.
21. **Hydrogen / industrial archipelago** — marine renewables, hydrogen and derivative fuels become a coupled industrial system; hydrogen remains a carrier, not free energy.
22. **Collapse and return** — regions empty, infrastructure decays, nature reclaims land, and recovery occurs only from surviving populations.
23. **Terminal cascade** — a falsification test where full extinction is genuinely possible and cannot self-reverse.
24. **Deep diaspora** — Earth becomes a declining or abandoned territory while civilization persists in orbit, on other worlds or farther away.

Do not force outcomes. A scenario named “Hothouse” should create assumptions that make collapse plausible; it should not call `collapse = true`. A scenario named “Resilient Earth” should be able to fail if the state cannot execute.

---

# 12. Events should emerge from state

The Chronicle should read like history, not a random-news generator.

**Literal extinction terminates civilization history.** When no embodied, off-world or digital population remains, stop creating research results, negotiations, elections, wars, staffed projects, characters and new civilization milestones. The simulation clock may continue only for physical and ecological processes such as climate/ocean inertia, structural decay, corrosion, flooding and succession. Record the terminal extinction event once; do not manufacture a ghost chronicle afterward.

An event should normally contain:

- what happened;
- when;
- where / to whom;
- the strongest causal factors;
- counterforces;
- confidence;
- significance;
- consequences in state.

Good event:

> Grid reserve fell below demand after three years of data-center growth and delayed transmission projects; prices rose, compute projects were postponed and industrial output contracted.

Bad event:

> In 2041, an energy crisis occurred because the event table says so.

Randomness is appropriate for discovery, accidents, disease emergence, political shocks and other contingent events — but the probability and consequences should depend on state.

---

# 13. Decisions and interventions

The world should be able to make decisions autonomously. The observer may intervene, but the world must not wait for a player to function.

Useful decision classes:

- income floor / retraining after automation;
- energy emergency response;
- public finance / debt restructuring;
- land and housing response;
- migration policy;
- longevity access;
- fusion investment;
- climate adaptation vs intervention research;
- AI assurance / deployment pause / continue;
- pandemic response;
- fertility / synthetic reproduction;
- international cooperation / sanctions / conflict;
- space vs Earth / sea infrastructure priorities.

An intervention should alter the same causal channels autonomous actors use. Avoid “player magic.”

If the product uses an intervention currency/budget, label it as **observer/meta-game state**, not as a civilization property. A value such as `100/100` must mean exactly what it says (for example, a fully replenished budget), have **no passive causal effect**, and change the simulated world only when an explicit intervention spends it. Never let a global action silently charge one arbitrary civilization.

---

# 14. Parallel worlds are central, not optional polish

The user must be able to branch from the same state and seed, change one assumption or intervention, and compare outcomes.

The comparison should answer:

- what changed immediately;
- what changed only after a delay;
- which causal chains diverged;
- which bottleneck moved somewhere else;
- whether the intervention improved one dimension while worsening another;
- whether the conclusion is robust across seeds / parameter uncertainty.

Where feasible, add ensemble comparison rather than relying only on one seed.

---

# 15. Uncertainty and robustness

A serious futures lab should expose at least three types of uncertainty:

**Stochastic uncertainty** — different seeds.

**Parameter uncertainty** — uncertain numerical values.

**Structural uncertainty** — different plausible mechanisms/regimes.

Do not hide these behind a single confidence interval if the uncertainty is actually structural.

Recommended advanced feature: a “robustness mode” that runs a scenario across multiple seeds and/or parameter draws and shows the range of outcomes rather than a single cinematic future.

If performance prevents this in the main UI, provide a CLI or validation tool.

---

# 16. Research protocol for autonomous agents

Before changing a consequential mechanism, research it.

Prefer sources in roughly this order:

1. current official statistics / international agencies;
2. peer-reviewed research and high-quality academic datasets;
3. government or national-lab sources;
4. specialist research organizations with transparent methods;
5. primary industry sources for engineering data;
6. secondary reporting only when necessary.

For every calibrated mechanism record:

- source;
- publication / retrieval date;
- measured quantity;
- units;
- geography / population;
- observation period;
- central estimate and uncertainty/range;
- model mapping;
- confidence;
- valid extrapolation window;
- known limitations;
- whether any additional “gameplay” scaling was introduced.

Do not silently tune an empirical constant to make the UI exciting. If a gameplay scaling exists, label it.

## 16.1 Research anchors to revisit when rebuilding

At the time of this v11 prompt, useful authoritative anchors include:

- International AI Safety Report 2026 — capability progress, uncertainty, risks and bottlenecks;
- OECD 2026 work on possible AI trajectories through 2030 — multiple plausible progress regimes rather than one curve;
- METR long-task evaluations, updated 2026 — useful within the task suite, with explicit warnings about estimates above the current measurable range;
- IEA, *Energy and AI* — data-center electricity demand, grid bottlenecks and uncertainty;
- UN World Population Prospects 2024 — fertility, aging and long-run demographic momentum;
- IPCC AR6 — climate response and long-lived sea-level commitment;
- UNEP Emissions Gap Report 2025 — current-policy warming context;
- robust decision-making / exploratory modeling literature — stress-test strategies across many plausible futures rather than optimizing one forecast;
- clinical brain–computer interface trials (Willett et al. 2023; Metzger et al. 2023; Card et al. 2024) — anchor decoding throughput, and anchor how small the implanted population still is;
- public-attitude survey work on enhancement implants (e.g. Pew 2021) — anchor the gap between therapeutic acceptance and enhancement acceptance.

These are starting points, not immutable citations. Update them when fresher authoritative evidence exists.

---

# 17. Visual and interaction design

The visual form is deliberately open. It may be 3D, 2D, map-based, diagrammatic, data-rich, cinematic, minimalist, or hybrid.

The current Three.js island is not part of the core idea.

Whatever form is chosen, the interface should let a user answer four questions quickly:

1. **What is happening now?**
2. **Why is it happening?**
3. **What is the bottleneck / risk?**
4. **What changed compared with the other world?**

## 17.1 Prefer visible causality over decorative complexity

A beautiful city that cannot explain why it grew is less useful than a simpler world whose causal state can be inspected.

Strong visual candidates include:

- state changes visible on the map/world;
- project construction and decay;
- shrinking as well as growing cities;
- blackouts, abandoned districts, adaptation works;
- trade / migration / conflict links;
- energy and compute overlays;
- demographic age structure;
- outcome-profile radar/bars;
- uncertainty ranges;
- branch comparison.

Do not make every success look like a futuristic neon megacity. A resilient, compact, low-growth future should look intentionally successful rather than visually “behind.”

## 17.2 The visual world is part of the simulation contract

The renderer must not contradict the state. This is a hard invariant, not an aesthetic preference.

Examples:

- zero embodied people on Earth means zero pedestrians, commuter traffic and staffed Earth launches;
- an abandoned city may retain buildings, roads and even autonomous machinery, but lights, traffic and construction must fall unless the model explicitly says autonomous systems remain active;
- shrinking population should create vacancy, darkness, consolidation, demolition and eventually ruins;
- abandoned land should undergo ecological succession and visible rewilding over time;
- growth should be spatially legible: denser skylines, arcologies, underground portals/infrastructure, reclaimed/floating/subsea districts and off-world habitats should appear because the corresponding state exists;
- war, flooding, grid failure and maintenance collapse should damage the visible systems that the model says were damaged;
- off-world civilization must not justify ghost activity on an empty Earth. Render orbit/Mars/deep-space continuity where it actually occurs;
- a district's label must match what is on screen: a civilization that lost a third of its people is not "growing";
- a scenario's stated ceiling must survive repeated breakthroughs, or the ceiling is decoration.

## 17.2.1 Detail does not rescue a wrong primary form

Adding windows, balconies, roofs or textures to a primitive will not make a primitive credible. If a structure reads as a stack of boxes or a cylinder with a pattern, the **primary design** is wrong: massing, proportion, structure, opening rhythm and relationship to the ground. Change the design, not the decoration. Establish one representative place at the target quality before propagating the approach, and evaluate it from actual gameplay cameras with the interface hidden.

## 17.2.2 Lifecycle must preserve identity

One building should be recognisable across its states. Occupied, aged and ruined versions of the same structure must keep its footprint, orientation, structure and material identity, and must be inspectable from a matched camera. Damage must reveal construction: a severed slab shows its thickness, a broken parapet shows its profile, debris carries the building's own materials at believable scale. Arbitrary rubble scattered near an unchanged building is a failure, not a ruin.

Age the ground too: construction disturbance, service yards, then weeds, sediment and succession.

A user should be able to infer a broad state of the civilization from the world before opening a chart. Numbers explain and verify the scene; they should not be required to notice that the city is dying.

## 17.3 Habitat physics is causal state, not theme art

Every unusual habitat must carry the constraints that make that habitat unusual. Do not implement “ocean city”, “underground city” or “arcology” as a skin over ordinary housing.

**Tall / vertical construction**

- Existing neighbouring buildings do not slide outward when density rises.
- Growth occurs through fixed-site infill, discrete redevelopment, new towers, or new districts.
- Extreme height must pay increasing structural/service costs: lateral wind/seismic response, foundations/settlement, elevators and egress, facade drift, stack effect, fire safety, utilities and maintenance.
- A damaged tall building should fail by systems loss and discrete local structural failures, not by continuously scaling its height down.

**Floating / on-water construction**

- Buoyancy, displacement/freeboard, waves, wind, current, mooring/anchoring, hydroelastic response, fatigue/corrosion and service connections matter.
- A floating district is a connected marine system. Render modules, moorings/anchors, access/service links and condition where the representation permits.
- Damage should change motion, flooding risk, connection integrity, habitability and repair cost. Do not make a platform simply shrink.

**Subsea construction**

- Hydrostatic pressure rises strongly with depth (roughly one additional atmosphere per 10 m of seawater near Earth conditions); depth therefore changes pressure-hull, penetration, service and emergency-access requirements.
- Habitats require pressure boundaries, power, air/life support, thermal control, corrosion control, pumping where applicable, communication and a credible connection to surface/offshore logistics.
- Do not require Mars-grade closed-loop life support for every shallow subsea settlement. A physically credible early path is a surface-served shelf habitat with redundant power, air, data and emergency-access umbilicals; deeper or remote habitats should progressively require greater autonomy and closed-loop capability.
- Put the rendered habitat on/below the actual seabed. Normal view must obey depth: do not project an x-ray mesh through terrain or other structures. Let the camera move below/inside the environment or provide an explicit opt-in inspection/cutaway mode; surface buoys/service markers may identify the hidden habitat without falsifying its depth. As subsea stock grows, add fixed modules farther across the shelf and/or at greater depth rather than enlarging one decorative marker.

**Underground construction**

- Geology, excavation/support, groundwater, waterproofing/drainage, pumping, ventilation, heat rejection, smoke/fire control, egress and vertical transport are first-order constraints.
- Deeper/larger underground expansion should not scale at constant marginal cost forever.
- Render entrances and shafts/vents at the surface and the inhabited volume at real negative elevation. Normal view must respect terrain depth. Provide a below-ground camera or explicit opt-in cutaway for inspection; never make subsurface geometry globally depth-test-free. As underground stock grows, add discrete chambers/networks deeper and farther from the original portals rather than scaling one floating marker.

**Condition and maintenance**

- Track physical existence separately from serviceability. A pressure hull, foundation or tower shell can remain after pumps, lifts, seals, ventilation or power fail.
- Long-lived inhabited systems require continuous inspection, repair and component replacement. Do not model either immortal infrastructure or inevitable mechanical failure merely because centuries pass: maintained systems should approach a maintenance-supported condition equilibrium, while abandoned systems should deteriorate toward loss of habitability.
- Replacement/refurbishment costs must remain in the economy; a habitat is not a one-time capex purchase followed by free eternity.

**Off-world construction**

- Earth, orbit/cislunar space, Mars and deep-space populations are distinct **location reservoirs** with distinct infrastructure and logistics. Their accounting must close: Earth + orbit/cislunar + Mars + deep space = total population.
- Digital/post-biological status is a **substrate axis**, not another location reservoir. Do not add digital population on top of total population if those persons are already counted.
- Capacity is not occupancy. A built Mars settlement, orbital habitat, floating district, arcology or underground chamber may remain physically visible while empty; lights, traffic and staffed activity require actual occupants or explicitly modelled autonomous actors.
- If off-world population becomes the main population reservoir, the interface must make that migration legible. The user should never see an empty island and have to guess where hundreds of millions of people went.
- A sky/orbit representation may be schematic/not-to-scale, but that fact must be disclosed while quantities remain exact in the UI.

## 17.4 Decay, collapse and ecological succession

Do not use uniform geometric shrinking as a proxy for age or abandonment.

The sequence should distinguish at least:

1. **occupancy/activity loss** — people, lights, traffic, construction and staffed operation disappear;
2. **maintenance loss** — water ingress, corrosion, facade/roof/MEP failures, blocked drains, grid failures and vegetation begin;
3. **local structural failures** — roofs, floors, cladding or frames fail at different times depending on material/environment;
4. **persistent ruins/rubble/foundations** — the built environment becomes archaeology rather than evaporating;
5. **ecological succession** — plants and later ecosystems occupy roads, lots, roofs, cracks and rubble where climate/substrate allow.

Concrete, steel and masonry do not disappear because the occupancy scalar reached zero. Conversely, do **not** assume a modern reinforced-concrete skyscraper remains intact for ten thousand years. Serviceability usually fails much earlier than material traces disappear. Long-horizon rendering should transition from intact shell → partial ruin → rubble/foundations embedded in a mature ecosystem.

Ecological succession is path- and climate-dependent rather than one universal green fade. The renderer may simplify species/ecosystems, but vegetation must occupy the abandoned geometry instead of replacing it with an unrelated pristine landscape.

Useful engineering anchors to update/research during a rebuild include DNV marine environmental-load guidance, FHWA tunnel waterproofing/drainage guidance, NOAA hydrostatic-pressure references, CTBUH tall-building structural/MEP guidance, NIST concrete durability/corrosion work, and ecology literature on succession. Numeric degradation timelines in a game should be labelled calibrated/illustrative unless directly supported.

---

# 18. Explainability contract

Every important user-facing metric should be inspectable.

For a metric such as political stability, show the strongest positive and negative contributors. For a technology, show accelerators, bottlenecks and maturity. For a milestone, show actual prerequisites and blockers. For a scenario result, show the assumptions that mattered most.

The user should never need to infer whether a number is:

- raw state;
- normalized index;
- synthetic-region quantity;
- world analogue;
- empirical observation;
- speculative proxy.

Label it.

---

# 19. Red-team requirements

Before release, attack the model. Do not only run happy-path unit tests.

## 19.1 Causal invariants

Test at least these classes of failure:

- no free energy, compute, housing or materials;
- no infrastructure built without time/capital;
- failed grid service constrains output and compute;
- high TFP cannot override severe physical shortages;
- technology adoption differs across civilizations;
- a research breakthrough can fail validation or diffuse slowly;
- population has demographic inertia;
- city/housing stock can decay as well as grow;
- debt ratios respond to both deficits and the output denominator;
- resource scarcity affects later build costs;
- collapse damages institutions rather than leaving a high “stability” score attached to a dead civilization;
- historical milestones can remain historical facts while the present capability to operate them can fail;
- sea level does not fall merely because temperature falls;
- a scenario labeled stagnation does not inevitably reach every deep-future milestone after enough time;
- a scenario labeled “positive” is not hard-coded to win;
- frontier expansion is not required for flourishing;
- frontier expansion is not sufficient for flourishing;
- the same seed with no changed assumption reproduces the same future;
- a changed assumption produces attributable divergence;
- a population health stock actually changes how deadly a shock is, rather than being a displayed number;
- access to a capability-changing technology is separable from its existence, and unequal access shows up in distribution;
- a labour market that absorbs displacement cannot simultaneously reduce measured unemployment and improve health and equality;
- settlement can both disperse and converge, and convergence is reversible by policy;
- a claim like "baseline stays fed" or "stagnation never reaches superintelligence" must hold by mechanism, not by a lucky seed;
- visual labels and classifications must not contradict the underlying state they describe.

## 19.2 Extreme stress tests

Try absurd and hostile states:

- remove 80–90% of generation;
- destroy a major food exporter;
- sharply fragment trade;
- set governance capacity very low;
- create fast automation with weak distribution;
- combine climate, debt and energy shocks;
- run hundreds of years;
- run multiple seeds;
- exhaust cheap resources;
- lower warming after severe warming and verify sea-level inertia;
- give very high AI capability and confirm measured benchmark units do not extrapolate beyond their validity.

The model should fail plausibly, not numerically explode or silently recover because a scalar trend dominates everything else.

## 19.3 Anti-convergence test

Run the main scenario presets over 50, 100 and 300 years.

If almost every scenario converges to the same label, same stability, same technology ladder or same “good” ending, the model is over-damped or structurally biased.

Investigate rather than merely widening parameters.

---

## 19.4 Keep a defect ledger, and never whitelist a claim

Every failing invariant carried into a release must be listed with its reason, and the build must fail on any *new* failure. That is a debt register, not a defence: an entry stays only while the failure is understood.

The harder rule: never resolve a violated claim by relaxing the claim, unless the original claim was itself wrong. Distinguish three cases explicitly:

- the model is wrong → fix the mechanism;
- the test was asserting the wrong thing → rewrite the claim and say why in the changelog;
- the claim only held by luck → strengthen the mechanism until it holds for reasons.

A pass produced by a favourable seed is not evidence. Where a scenario states a ceiling, a floor or a label, add the mechanism that makes it true and a test that holds the driver constant.

# 20. Autonomous swarm operating model

A single strong agent may do all work. A swarm may divide it. Do not require a specific organization, but cover these responsibilities:

- **Product steward / model architect:** protects the fixed idea and causal integrity.
- **Research agents:** current evidence by domain.
- **Systems-model agent:** stocks, flows, feedbacks, uncertainty.
- **Simulation implementer(s):** engine and data structures.
- **Experience / visualization agent:** interaction and visual communication.
- **Content / chronicle agent:** language, events, explanations.
- **Validation agent:** numerical runs, invariants, scenario divergence.
- **Red-team agent:** actively tries to break assumptions and expose normative bias.
- **Release agent:** build/run reliability and reproducible package.

Agents may reorganize themselves. File ownership and technical architecture are theirs to decide.

## 20.1 Autonomous loop

Repeat until the definition of done is met:

1. inspect the current product/reference;
2. state the mechanism or product problem;
3. research missing facts;
4. write/update the evidence note;
5. implement the smallest coherent causal change;
6. run compile/tests;
7. run scenario and stress simulations;
8. inspect visual behavior if applicable;
9. red-team the new result;
10. keep, revise or revert;
11. update documentation and validation evidence.

Do not ask the operator questions that can be resolved by research, code inspection, a reasonable reversible choice, or explicit assumption. Record the assumption instead.

---

# 21. Creative latitude

The following are **not fixed** and may be replaced entirely:

- React;
- TypeScript;
- Three.js;
- Zustand;
- the island map;
- the three current civilization names;
- exact population scale;
- exact technology taxonomy;
- exact milestone ladder;
- Kardashev scale;
- exact formulas;
- exact UI layout;
- exact intervention system;
- exact event wording;
- current file structure;
- current art direction;
- current scenario names;
- current numerical calibration.

A new build may be radically different and still be correct.

The mechanisms described in 6.1–6.3, 5.3.1 and 17.2 are **examples of principles already earned**, not required implementations. If you can satisfy the principle with a better model, do so. Do not copy a variable name because it exists here; derive the mechanism you can defend, and say what it assumes.

The following **are fixed in spirit**:

- recognizable present → open causal futures;
- physical and social constraints;
- delayed projects and diffusion;
- explicit uncertainty;
- multiple plausible scenarios;
- branchable counterfactuals;
- explainable causes;
- no date-scripted prophecy;
- no hidden equivalence between technological expansion and flourishing;
- positive as well as negative futures;
- reproducible, testable simulation behavior;
- health, access and attention treated as real state, not decoration;
- growth and decline visible in the world, with labels that match it.

---

# 22. Build and delivery requirements

Deliver a complete working source tree, not screenshots or pseudocode.

At minimum include:

- source code;
- a clear run path;
- production/static build path where applicable;
- deterministic seeded simulation support;
- tests or validation scripts for core invariants;
- evidence/provenance registry;
- scenario definitions;
- red-team / validation report;
- this master prompt or its improved successor;
- README explaining what is literal, synthetic, normalized and speculative.

The application must never fail as a silent blank screen. Boot failures should surface a visible diagnostic.

If a browser-ready build depends on CDNs, state that clearly. If an offline build requires dependency installation, state that clearly. Prefer graceful fallback over pretending a failed build succeeded.

---

# 23. Definition of done

A rebuild is not done because it looks good or because the compiler is green.

It is done when all of these are true:

1. A person can start from a present-like world and watch history evolve without manual input.
2. The world changes through understandable causal mechanisms rather than calendar scripts.
3. At least several scenario archetypes produce materially different histories.
4. The user can change an assumption and branch the future.
5. The simulation can generate both attractive and catastrophic futures without forcing either.
6. An Earth-bound civilization can flourish.
7. A technologically expansive civilization can fail socially.
8. Physical stocks and lead times constrain growth.
9. Demography has inertia.
10. Climate and sea level are path-dependent rather than one scalar.
11. AI empirical metrics are not extrapolated beyond their valid interpretation.
12. Deep-future technologies are visibly speculative and condition-based.
13. Important metrics expose their causes.
14. A red team can run extreme cases without NaNs, silent impossible recovery or obvious accounting violations.
15. Same seed + same state + same assumptions reproduces the same future.
16. The build works from the documented run path and failures are visible.
17. Evidence and assumptions are documented well enough that another agent can recalibrate the model later.
18. The rendered world obeys habitat physics: fixed structures do not slide with growth, marine/subsea/underground habitats occupy plausible physical locations, and off-world population is visibly accounted for.
19. Abandonment separates inactivity from material disappearance: structures can remain as ruins while ecology reclaims them.
20. Literal global extinction freezes civilization history: no post-extinction diplomacy, research, staffed projects, new social milestones or ghost launches; only physical/ecological evolution may continue, and all state remains finite.
21. UI overlays never obscure each other or lie about depth: world labels occlude behind geometry and remain below application panels; very large numbers use bounded formatting rather than shifting layout.
22. Subsurface growth is spatially legible: additional underwater/underground stock adds physically deeper/farther structures, inspectable with a real camera path or explicit opt-in cutaway.
23. The product still feels like **WHAT IF? Civilization Lab**, even if almost every implementation choice changed.
24. Population health is a stock that changes the lethality of shocks and takes years to recover.
25. Capability-changing technologies separate existence from access, and unequal access has distributional consequences.
26. When automation outruns institutions, a market in human attention can appear, and a functioning income floor is the visible alternative to it.
27. Cities visibly densify and redevelop as population grows; settlement can both spread and converge, and the label matches what is rendered.
28. A mature district shows multiple generations of architecture, and one structure remains recognisable across occupied, aged and ruined states with damage that reveals its construction.
29. Every scenario-level claim (a ceiling, a floor, a trajectory label) is enforced by mechanism and covered by a test that does not depend on a lucky draw.

---

# 24. Final instruction to the autonomous builder

Do not optimize for fidelity to the existing codebase.

Optimize for fidelity to the idea.

Use the current implementation as evidence of what has been tried, not as authority. Preserve mechanisms that survive research and red-team review. Delete mechanisms that only exist because an earlier version needed them. Replace weak abstractions. Add scenarios that expose hidden assumptions. Improve the visual language if it helps comprehension. Simplify it if spectacle obscures causality.

Whenever you face a choice between a prettier deterministic story and a messier but more truthful model of uncertainty, choose the latter — then make it understandable.

Build a world worth arguing with.
