# WHAT IF? Civilization Lab — v11.4 release red-team report

Date: 2026-09-09  
Scope: source, simulation logic, scenario semantics, UI claims, research assumptions, build path and autonomous reconstruction prompt.

## Executive finding

v8.1 already had unusually strong foundations for a speculative civilization simulator: stocks/flows, projects with lead times, finite resources, research lifecycles, demographic inertia, physical infrastructure and inspectable causal events. Its main remaining weaknesses were **epistemic and structural**, not graphical.

The most serious problem was that several implementation choices silently encoded a worldview: technological expansion was close to the definition of a successful civilization, an AI benchmark was extrapolated far beyond the benchmark's evidential range, and some slow physical processes behaved like reversible counters. Those choices can produce a coherent-looking future that is internally biased or physically misleading.

The current release line changes the model so that the simulation can express **multiple genuinely positive and negative futures** without declaring one geography, technology stack or expansion path to be the objective.


## v10 addendum — hidden demographic destiny and ghost civilization

The v10 pass found four additional structural defects that were more important than another graphics pass.

1. **The ~95M plateau was emergent but still hard-wired in spirit.** Fertility was continuously pulled downward by education/urbanization while urbanization itself tended toward saturation. Successful societies therefore converged on low fertility and a narrow equilibrium. v10 replaces this with a fertility regime shaped by family formation, affordability, security, social contract, culture, assisted reproduction and long-run demographic volatility. Shrinkage remains plausible; it is no longer destiny.
2. **“Extinction” was being used for severe decline.** A percentage of 2026 population is not extinction. v10 distinguishes decline, collapse/remnant conditions, territorial abandonment, resettlement and literal extinction. Extinction now requires population to reach zero across embodied, off-world and digital reservoirs.
3. **Some visual actors survived their people.** Citizens had a minimum activity floor, traffic/shipping did not fully scale with population, and a rocket already in its launch animation could finish after Earth population hit zero. v10 removes those contradictions and makes visual state a hard simulation invariant.
4. **Verticality and alternative energy were partly rhetorical.** The state model contained vertical/underground fields but project planning/completion paths were incomplete, while fusion remained visually privileged. v10 adds reachable arcology/underground projects and visible geothermal, bioenergy, hydrogen and marine-energy infrastructure.

The remaining red-team concern is explicit autonomous civilization. Some infrastructure can survive its builders, and a sufficiently autonomous machine society might continue after biological humans disappear. v10 allows an `autonomousInfrastructure` state to affect recovery, but it does not yet model autonomous machines as a fully separate population with reproduction, goals, maintenance and political continuity. Until that exists, the renderer should prefer darkness/ruins over implying unexplained post-human activity.

## v11 addendum — visual physics was still lying

The v11 pass found that several visual shortcuts were not cosmetic; they changed the story the simulator told.

1. **City growth violated conservation of place.** Building coordinates were multiplied by a changing `sprawl` scalar. As density/growth changed, existing structures physically slid away from the center. Fix: lot coordinates are immutable; growth fills fixed sites or replaces a site with a discrete new form.
2. **Decay confused non-operation with disappearance.** The old ruin layer shortened buildings and could overlap still-active city geometry. Fix: physical stock and active stock are separate; inactive buildings remain at their footprint, then experience heterogeneous local failures, rubble and overgrowth.
3. **Ocean/subsurface state existed without a readable world.** Floating housing was tiny decorative platforms, subsea domes were hidden behind nearly opaque water, and underground housing was represented only by surface disks. Fix: connected/moored floating districts; seabed pressure hulls plus service shafts/buoys; underground chambers placed at their real negative elevation. v11.4 supersedes the earlier x-ray shortcut with a real below-ground camera and opt-in, depth-respecting diagnostics.
4. **Off-world population could become numerically dominant while the scene stayed Earth-centric.** Fix: exact habitat/population ledger plus a clearly schematic sky representation. Earth activity remains tied to Earth actors.
5. **Extreme habitat cost scaled too gently.** A normalized capacity point cost roughly the same whether it was an early or mature vertical/deep/marine network. Fix: increasing marginal engineering penalties for tall foundations/lateral/service systems, underground depth/groundwater, marine mooring/network scale and subsea depth/access.
6. **`influence` was an opaque game variable.** It was actually an observer intervention budget, regenerated passively and had no effect until spent; non-civilization actions were also charged to the first polity. Fix: one explicit world-level intervention budget with no passive causal effect and no arbitrary payer.

One deliberate pushback against an intuitive visual: modern buildings should **not** remain intact for ten thousand years merely because concrete/steel traces can persist. Serviceability and many structural components fail much earlier. The invariant is instead shell → partial collapse → rubble/foundations embedded in mature ecology; the renderer never makes built material simply evaporate when occupancy reaches zero.

## v11.1 addendum, independent red team

An automated battery (`tools/redteam.ts`, 23 presets × 3 seeds × 300 years) found three structural defects the v11 pass had missed: orbital power inflating the terrestrial reserve margin to thousands of percent; project spending accounted as a pure drain on capital, which collapsed output by 90% in healthy growing worlds and produced "collapse" labels on populations that had tripled; and duplicate follow-on inventions in collaborative worlds. All three are fixed in revision 11.1 (see CHANGES.md). One question is left open on purpose: how to measure output once a polity is half digital and half off-world.


## v11.4 terminal-state and visual-truth addendum

A final public-release pass attacked failure states visible to a non-developer rather than accepting prior numerical validation. It found that literal global extinction still allowed the ordinary civilization pipeline to run, which produced ghost negotiations/milestones and eventually non-finite UI values. It also found that diagnostic subsurface overlays violated depth and that world-space city labels could escape the 3D scene and cover HUD panels.

The fix is structural. Literal extinction now switches the engine to a post-civilization physics/ecology phase. The chronicle freezes after one terminal event; technology/relations stop changing; decisions, conflicts and staffed projects are cleared; climate/ocean inertia, material deterioration and ecological succession continue. A direct seed-3 Terminal Cascade test reached extinction in 2291, then ran 50 additional years with exactly zero population, an unchanged chronicle/technology/relations state, no projects/conflicts/decisions, and no NaN/Infinity anywhere in the recursively scanned world state.

The renderer now treats depth as physical truth. Subsea and underground structures are at real negative/seabed coordinates and normal rendering respects occlusion. Inspection is via a real below-ground camera or an explicitly selected diagnostic overlay. More capacity adds more/deeper fixed structures instead of stretching a marker. City labels ray-occlude and remain below the application shell.

Release validation on the rebuilt v11.4 executable ran all 23 presets for 300 years at seed 7 with zero checked invariant errors. Multi-seed checks (3/7/19) confirm Ocean Century remains materially floating+subsea and Vertical World remains vertical+underground. Terminal Cascade is not scripted: seeds 3 and 19 reach literal extinction by 2326; seed 7 leaves a tiny remnant. Collapse & Return is path-validated rather than name-validated: Veloria becomes failed/remnant, is abandoned, receives conserved settlers, and returns to active status before later fragility can recur.

## v11.3 release-candidate addendum

The final pre-public review did not assume the v11.2 agent's fixes were correct. It found several additional defects that would have been misleading in a public release:

1. **Off-world population was not spatially conserved.** The model tracked Mars capacity but not Mars residents, so a constructed Mars base could glow without anyone living there, while deep-space residents could still implicitly occupy home-system habitat. Fix: orbit/cislunar, Mars and deep-space are explicit subsets of off-world population and close exactly to the off-world total. Capacity and occupancy are separate in both simulation and renderer.
2. **The first post-embodied output fix double-counted digital persons.** Digital minds were already present in total population and were then effectively added again as labor. Its compute-per-mind term also collapsed to a floor. Fix: digital substrate changes bounded productivity through compute adequacy; orbital industry is a separate bounded term.
3. **Vertical World still had a hidden land-exhaustion gate.** Across some seeds a “vertical-first” society built no arcologies at all because it was forced to wait until ordinary land was exhausted. Fix: vertical preference lowers the planning hurdle before absolute scarcity, without bypassing demand, finance, robotics, power or rising engineering complexity.
4. **Renderer activity still leaked from capacity.** Mars lights followed capacity and arcology sky-lobbies had fixed emissive glow. Fix: lights/activity follow actual occupants or explicit autonomous operation; empty structures remain visible but dark.
5. **Habitat capacity was visually mislabeled as percent.** The stock variables are normalized indices and can exceed 1.0, so a display such as “sea 220%” looked like a population share. Fix: indices are displayed as `×` values; serviceability remains a percentage.
6. **Marine modules physically overlapped.** Floating-platform spacing was smaller than rendered platform diameter. Fix: larger spacing, smaller module footprint, explicit service bridges and separate moorings.
7. **Public documentation overstated uncertainty as settled.** The AGI note still contained a fixed forecast date; the engineered-pandemic note described a broader catastrophic endpoint than its best recent elicitation; old change notes said some scenarios ended in extinction “by design.” These are corrected.

Release philosophy: a scenario defines pressures and assumptions, not an ending. Validation therefore checks reachability, invariants and qualitative separation across multiple seeds rather than requiring a prerecorded fate.

## Audit method

The review used four lenses:

1. **Static code audit** — data model, equations, thresholds, presets, UI labels and build scripts.
2. **Adversarial scenario runs** — 100- and 300-year seeded runs, including stagnation, hothouse, automation inequality, resilient-Earth and polycrisis cases.
3. **Invariant testing** — checks for impossible reversals, benchmark overclaiming, scenario convergence and semantic contradictions.
4. **Current-source validation** — compared consequential assumptions with current authoritative/specialist sources on AI uncertainty, long-task benchmarks, energy, climate, sea level and demography.

## High-severity findings and fixes

### 1. “World” semantics did not match the simulated scale

**v8.1 behavior:** the three synthetic civilizations began with roughly 256 million people in total, while selected energy quantities were scaled by a factor of 60 for a world-energy/Kardashev analogue. The UI nevertheless called the population “World population.”

**Why it matters:** a valid modeling abstraction becomes misleading when its units are presented as literal reality.

**v9:** the interface explicitly calls this a compressed synthetic civilization region and labels population as simulated population. Frontier/world-analogue scaling remains available but is disclosed.

### 2. “Best outcome” was normatively tied to expansion

**v8.1 behavior:** the strongest trajectory class required the `full_spectrum` milestone — habitation across sea/sky/orbit and related frontier achievements — and described it as the best outcome the model could express.

**Failure mode:** a peaceful, equitable, wealthy, ecologically stable civilization choosing not to colonize Mars could never be the model's best result. Conversely, high-energy expansion could inherit positive framing despite poor lived conditions.

**v9:** success and development form are orthogonal.

Lived outcome axes:
- material security;
- human development;
- institutional health;
- ecological safety;
- distribution;
- resilience.

Development forms:
- Earth-bound;
- oceanic;
- spacefaring;
- digital;
- mixed.

A civilization can now be Earth-bound and flourishing, or technologically ascendant and socially unhealthy.

### 3. AI task-horizon extrapolation outran the evidence

**v8.1 behavior:** a formula transformed an internal AI capability variable into unbounded “task horizon hours”; 1,000 hours contributed to AGI gating and 87,600 hours (ten years) to ASI gating.

**Why this is indefensible:** METR defines time horizon as the human-expert duration of tasks at which an agent is predicted to succeed at a given reliability, on a task suite concentrated in software/ML/cyber. Its May 2026 methodology warns that measurements above about 16 hours are unreliable with the current suite. Turning the same empirical curve into years of autonomous work is therefore a category error, not merely an aggressive forecast.

**v9:** the measured display is capped at 16 hours. Deep-future autonomy uses a separate dimensionless capability index. AGI/ASI remain model-defined speculative regimes with multiple gates and are not presented as benchmark-derived dates.

### 4. Sea level was an instantaneous reversible function of temperature

**v8.1 behavior:** sea-level rise was essentially `max(0, warming - threshold) × constant`; if later warming fell, the apparent sea level could fall too.

**Why it matters:** the IPCC assesses long-lived committed sea-level rise due to ocean heat uptake and ice-sheet response, continuing over centuries to millennia. Atmospheric cooling does not instantly undo historical sea-level rise.

**v9:** sea level and committed sea level are explicit state variables. Peak/past warming can create additional commitment; actual sea level approaches it slowly and never decreases in the current model. Climate engineering can reduce warming but does not erase prior ocean/ice commitment.

### 5. Social futures were under-dimensionalized

**v8.1 behavior:** scenarios varied technology, energy, resources and openness much more strongly than institutions or distribution. As a result, many futures converged on similar social-state values even while their technological stories were supposed to be radically different.

**v9:** added independent parameters for:
- governance capacity;
- social contract;
- AI safety/assurance;
- biosecurity;
- climate adaptation;
- diffusion/absorptive capacity.

These feed institutions, inequality/basic provision, hazard severity, AI incidents, climate damage and adoption speed rather than serving as labels.

### 6. Frontier dates looked like roadmaps

**v8.1 behavior:** milestones carried `roadmapYear` and events could say progress was ahead/behind a published roadmap, even for speculative centuries-ahead technologies.

**v9:** renamed to `illustrativeYear`; deep-future dates are ordering/scenario aids only. The UI uses “illustrative” near-term labels and “exploratory” for deep-future items. Achievement is state-gated, not rewarded for calendar punctuality.

### 7. Collapse could leave healthy-looking institutional counters

**v8.1 long-run failure:** in extreme runs civilization could approach extinction while stability/institution counters remained implausibly high, because slow-moving institutional state was not conditioned strongly enough on population-system collapse.

**v9:** near-extinction clamps institutional/stability/trust capacity to appropriately failed levels. Hothouse and polycrisis stress runs now end with low institutional health rather than a dead-but-stable polity.

### 8. “Long stagnation” could become superintelligent simply by waiting long enough

**v8.1 failure:** long enough simulation time allowed capability accumulation to cross exotic thresholds even in a scenario semantically intended to represent long stagnation.

**v9:** the AI gates and scenario constraints were revised so the 300-year Long Stagnation stress run can reach some earlier breakthroughs but does **not** automatically become ASI merely because centuries elapsed.

### 9. Validation documentation had become stale relative to executable code

The previous `VALIDATION_REPORT.md` contained numerical results from an earlier state of the source. Fresh direct runs no longer matched several values.

**v9:** validation artifacts were regenerated from the current source; this report treats stale validation as a defect, not documentation trivia.

### 10. First-run browser path could still be unfriendly without npm dependencies

The project already had a CDN build and whole-module smoke test from v8.1, but `serve.sh` could still choose a source path that implied dependency installation.

**v9:** automatic serving prefers the browser-ready/CDN route when source is newer but local npm packages are absent. A developer can still force the full Vite path explicitly.

## Research checks that materially changed the model

### AI: use scenario regimes, not one confident curve

The International AI Safety Report 2026 describes plausible progress through 2030 ranging from plateau/slowdown through continuation to dramatic acceleration, with substantial uncertainty and an evaluation gap between benchmarks and real-world performance. That supports a regime/scenario approach rather than a single deterministic “AGI year.”

### Energy: AI can matter without consuming the whole grid

IEA's *Energy and AI* base case has data-centre electricity demand around 945 TWh in 2030, under 3% of global electricity use, while emphasizing that data centres can be built faster than grid infrastructure. v9 therefore retains energy/grid bottlenecks as causal constraints without treating AI electricity as automatically civilization-dominating.

### Climate: near-term policy trajectory is bad but not a single fate

UNEP's 2025 Emissions Gap Report places current-policy warming around 2.8°C this century and full NDC implementation around 2.3–2.5°C. These are anchors for near-term stress, not reasons to force every scenario onto the same temperature path.

### Demography: long-run population is not monotonic exponential growth

UN World Population Prospects 2024 projects global population peaking around 10.3 billion in the mid-2080s and easing to roughly 10.2 billion by 2100. That supports continued demographic inertia, aging and low-fertility decline as first-class dynamics.

## New scenario logic

The added scenarios are deliberately **orthogonal experiments**, not endings:

- **Human-Centered Abundance** — strong automation/clean energy plus institutions and broad distribution.
- **Automation Divide** — strong automation with weak distribution, governance and safety.
- **Resilient Earth** — capable institutions, adaptation and clean infrastructure without making space expansion the objective.
- **Polycrisis** — weak institutions, low resilience, climate/resource pressure and fragmented recovery capacity.
- **AI Safety First** — slower diffusion but higher assurance and institutional quality.

The key test is that “more capability” does not mechanically mean “better civilization.”

## What remains deliberately simplified

v11.4 is substantially more defensible, but it is not a scientific Earth-system/economic model. Remaining limitations include:

- the synthetic 256M-person region is not a geographic Earth digital twin;
- climate uses reduced-form warming/damage rather than a carbon-cycle + ocean/ice model;
- sea-level dynamics preserve the correct lag/commitment direction but are not an IPCC emulator;
- the economy is aggregated rather than a multisector input-output/CGE system;
- geopolitics is compact and does not deeply agentize states, firms or militaries;
- migration, culture and fertility contagion remain reduced-form;
- AI's dimensionless deep-future capability dynamics remain speculative;
- exotic frontier technologies are conditional narrative hypotheses, not forecast probabilities;
- the six-axis broad-outcome metric is transparent but still contains normative modeling choices;
- the main UI still shows one seeded future at a time; the v11 master prompt recommends an ensemble/robustness mode for a future reconstruction.

The correct response to these limitations is **visible uncertainty and stress testing**, not fake precision.

## Red-team conclusion

The project should be understood as a **causal counterfactual laboratory**. Its value is not that it knows 2126. Its value is that a user can change an assumption, observe downstream physical/social effects, inspect why they happened, and discover which conclusions survive across very different plausible worlds.

That principle is now encoded both in the current source and in the v11.4 autonomous reconstruction master prompt.

### v11 release validation correction — maintenance is not a countdown

The first v11 wear implementation fixed immortal habitats but overshot in the other direction: a maintained marine habitat could still drift toward near-zero condition merely because enough centuries elapsed. That is another hidden destiny. The release model now treats condition as serviceability converging toward a maintenance-supported equilibrium. Continuous inspection, replacement, corrosion control, pumping, seals and mooring work can keep a habitat viable; abandonment drives it toward failure. Physical stock remains separately represented in both cases.

The release validator also caught that the reconstructed `Ocean Century` executable still inherited an old “wait until land pressure is extreme” planning gate. That contradicted the scenario premise. The corrected planner allows strategic marine urbanization before absolute land exhaustion while retaining technology, finance, institutional and maintenance constraints. Shallow subsea habitats may be surface-served; closed-loop autonomy becomes progressively important with remoteness/depth.
