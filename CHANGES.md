# Changes in this build

## Revision 11.9: neural interface — the brain–AI link (2026-11-09)

A new technology, and a new kind of inequality. It was not previously modelled: the tree had whole-brain emulation (people *leaving* the body) and germline enhancement (editing offspring), but nothing for a living person whose cognition runs through a machine.

- **`neural_interface`**, a new `neuro` tech domain. Starts at the real 2026 state — a few dozen clinical implants decoding speech and cursor movement — with `cap0 0.06`, low maturity and high cost. Depends on frontier AI, biotech and leading-edge fabrication. Two curated pathways (high-bandwidth decoding, closed-loop cognitive co-processing) and numbered follow-on generations. Calibrated against two new evidence entries: clinical decoding throughput (Willett/Metzger 2023, Card 2024) and stated public acceptance of enhancement implants (Pew 2021) — the latter sets a deliberately low diffusion ceiling.
- **Benefit channel.** Neural dependency adds a bounded research-throughput multiplier (≤1.45×) — capability added per researcher, which more compute cannot buy. This is the only channel of its kind in the model.
- **Access channel.** `society.neuralAccess` and `society.neuralProgram` decide who can obtain one, independent of how good the technology is. Market-tiered access widens `gini`; universal provision does not. A public programme crossing 60% access records a milestone.
- **Risk channel.** `society.neuralDependency` feeds the trust equation: a dependent population pays far more for the same blackout, and weak institutions leave the link open to manipulation when frontier AI is loose. This is what makes the technology a real trade-off rather than a free upgrade.
- **Decision fork: "Who gets a neural link?"** — universal provision, market allocation, or therapy-only restriction (which also suppresses adoption).
- **Scenario preset: "Neural Divide"** — `neuroMult 2.3`, fast diffusion, weak social contract and institutions, so the interface lands early and only some people get it.
- **`aiCeilingMult`**, a new parameter and an honest correction: probing revealed that "Long Stagnation" reached superintelligence by 2195 (~44× capability), contradicting the scenario's own claim. The scenario now carries a capability ceiling (0.55), and the trajectory plateaus near 35×, below the ASI threshold. The invariant "long stagnation does not become superintelligence merely because centuries pass" now holds by mechanism, not by luck.
- **Corrected claim in the food test.** "Baseline stays fed" had been passing on a lucky draw. Baseline warming produces multi-year droughts, and a drought landing on a tight year causes a real, recorded, recoverable food crisis (observed 2056: demand 1.36 vs production 1.17). The test now asserts the structural claim — the civilization ends the period fed, any crisis is transient, and every crisis names its causes — and a new test verifies recovery.
- **Known-failure ledger** updated to the three invariants that currently fail; "Hothouse ends with far fewer people than the baseline" now passes and was removed.

## Revision 11.8.1: build pipeline and housekeeping (2026-11-07)

No simulation or rendering change; everything here is about the pipeline around the build and the honesty of the repo's own verification files.

- **The world renders on the deployed build again.** The CDN delivery resolves shared dependencies on its own: when `@react-three/fiber` 9.8.2 appeared on esm.sh, the drei bundle began carrying a *second* fiber copy whose hook context was not the context the app's fiber 9.7.0 `<Canvas>` created, and entering the world failed with "R3F: Hooks can only be used within the Canvas component!" — a break that landed with zero repository changes and passed every CI gate, because none of them renders. `tools/build-cdn.py` now pins the react-three family's dependency graph to exactly the fiber version `package.json` names (esm.sh's `deps=` parameter), so all of them share one fiber instance regardless of what esm.sh publishes next. Verified by actually entering the world in a real browser, which the build pipeline still does not do.

- **Deploys work again.** The xhostd MCP server renamed `get_deploy_log` to `get_logs`, so every release after the server-side change built, tested, packed and pushed successfully — and then failed at the last step, leaving the prod channel serving nothing. `tools/xhost-deploy.py` now discovers the log tool by name and builds its arguments from the inputSchema the server itself advertises, so a future rename degrades to a precise error, not a mystery exit code. Verified against a local fake MCP server for both the success and failure paths.
- **Deploy failures are visible without log access.** The script now emits `::error::` GitHub annotations on every failure path (auth, missing tools, no deploy id, failed or timed-out deploy); job logs require admin rights to read, annotations do not.
- **Lint errors at zero for the whole non-React backlog.** Fourteen `no-explicit-any`, `prefer-const`, `no-unused-vars` and `no-useless-escape` findings across `src/ui`, `src/sim` and `tools/` are fixed with real types (`CSSProperties` for CSS custom properties, a typed capacity-factor table, `CivState`/`unknown` parameter types, a narrowed relation-field write in `branch.ts`). The react-hooks and react-refresh findings remain the known, reported-only backlog.
- **Release manifests regenerated — they had never been.** `RELEASE_MANIFEST.sha256` and `SOURCE_MANIFEST.txt` dated from the initial commit: 15+ files missing (everything from today's world3d work and CI tooling) and dozens of failing hashes. `tools/make_manifests.py` now regenerates both from `git ls-files` in the original formats (`sha256sum`/`shasum`-compatible), excluding the manifest's own always-failing self-entry. Nothing consumed the manifests automatically; they are the by-hand "is this release what it says it is" check, and now that check actually passes.

## Revision 11.8: verification pass and implementation corrections (2026-11-07)

This pass verified the render paths rather than adding new ones. It found several integration defects that previous reports had described as finished, and fixed them.

**Corrections**
- **Ruins were not at the buildings' locations.** `Frontier.tsx`'s `Ruins` layer positioned shells and rubble using the legacy `genLots()` scatter, while buildings stand on street-facing district plots. Ruined structures therefore appeared where no building had ever been. The layer is removed; decay is now rendered by `CityArchitecture` at each plot's own footprint and orientation.
- **Building-specific remains.** `architect.ts` gained `ruinParts()`: the surviving lower storeys stay in place, the severed top exposes the floor plate, roof material lies in identifiable sheets matching the original roof type, and fragments carry the building's own wall/roof colours and thickness. Applied to all four building kinds.
- **Two competing arcology renderers.** `VerticalHabitats` drew its own hexagonal towers at district-radius positions while `CityArchitecture` drew arcologies on plots. The duplicate is removed; `VerticalHabitats` now renders only the underground access system.
- **Arcology parts were silently truncated.** Instanced bucket capacity was sized from a much smaller adoption figure than the selection pass used, so tall towers lost parts. Capacity is now pre-allocated once for the worst case (era 2, maximum adoption, 14 floors).
- **Hex geometry origin was wrong.** The hex prism was base-origin while every part is positioned by its centre, so all hexagonal parts were displaced upward by half their height. Fixed; this is what made the first tower look like a stack of trays on a pole.
- **Arcology updates never triggered.** The dirty-check keyed only on built/active/era, so towers never appeared or changed state when vertical pressure and dereliction moved. Vertical and derelict are now part of the key.
- **Rewilding used the wrong coordinates** (legacy scatter). Now placed on district plots.

**Verification harness**
- `?arc=occupied|aged|ruined[&view=a|b]` renders one fixed arcology instance (fixed site, fixed seed) with a fixed camera and no interface chrome, at a pinned 1600×1000 drawing buffer, so the three lifecycle states are directly comparable. It is a controlled preview, not gameplay, and never touches the simulation.

**Measured performance**
- 800×655 canvas, devicePixelRatio 1, City view, 100× simulation speed, desktop Chrome: **57 fps average, 17.7 ms/frame** over a 4 s sample. The main canvas now uses `preserveDrawingBuffer` so runtime captures are possible; that setting is included in the measurement.

## Revision 11.7: arcology family (2026-11-07)

A genuinely new architectural language replaces the giant cylinder landmarks: hexagonal terraced lattice towers with cascading greenery, thin structural rings and sky-bridges. Full lifecycle states (occupied → aged → ruined) are derived from simulation condition.

- **Arcology generator** (`src/world3d/arcology.ts`): thin hexagonal core spine with wide terraced floor plates (hexagon slabs), structural ring bands, cascading green terraces on alternate plates, occasional sky-bridges to twin columns. Proportions tuned to the reference: thin plates with visible gaps between floors, not solid stacked boxes.
- **Lifecycle states**: occupied (intact, rooftop garden cap), aged (weathered tint, patch plates on the core face), ruined (upper terraces collapsed — exposed stepped core, debris fragments with real thickness scattered at the foot, green overgrowth on debris). States derived from per-plot sim condition + age hash; the same structure keeps its identity across states.
- **Instanced rendering**: hexagonal prisms + box parts, ~5 draw calls per tower cluster. Arcology adoption scales with sim vertical-build pressure; heritage plots keep their original architecture.
- **Frontier layer replaced**: the old giant cylinder arcologies (h=18–40u) in `VerticalHabitats` are now the same hex-lattice family, sized to the city. Orbital habitat rings pushed higher (y=360+) and dimmed so they read as sky-orbits, not city-scale objects.
- **Verification**: matched before/after views of the same district (2026 contemporary → deep-future arcology); intact vs ruined states of the same tower family; multiple camera angles confirming hex geometry, thin plates and cascading greenery; performance profile at 100× speed shows render-bound frames with no script hotspots.

## Revision 11.6: material pass (2026-11-07)

This pass attacks the "procedural prototype" look directly: every surface now carries a generated texture at true meter scale, vegetation has real foliage silhouettes, and energy facilities sit in believable yards.

- **Procedural texture system** (`src/world3d/textures.ts`): canvas-generated, tileable textures distributed with the build — plaster (fine blotches + weathering streaks), running-bond brick (per-brick value variation, soot aging), precast concrete (board joints, form-tie holes, rain stains), vertical composite panels (seams + shadow gaps), clay-tile roofs (staggered courses with shadow lines), standing-seam metal roofs, membrane roofs, asphalt (aggregate noise + patched repairs), bark, and leaf-cluster alpha cards.
- **True meter-scale UVs** (`src/world3d/worldUV.ts`): a shader patch samples these textures by world position with the dominant-face normal, so texture density is constant in meters regardless of instance scale — a 3 m brick course is always 3 m. Building families pick textured buckets (plaster/brick/concrete/panel walls; tile/seam roofs; membrane slabs) tinted per-lot by instanceColor.
- **Buildings gained façade articulation and plot context**: string-course bands between floors, corner downpipes, front paths, low garden fences, rear sheds, bins, and parked cars on driveways. Vacant and derelict states render as grayed shells without glazing.
- **Trees are alpha-card foliage**: two crossed leaf-cluster cards per canopy (cutout alpha, alpha-tested shadows, wind sway), trunks with bark texture, sizes tightened to 0.55–1.35 u and forests pushed to ≥1.65× city radius so trees no longer bury the towns. From above they read as tree crowns, not cones.
- **Terrain micro-detail**: a grayscale noise texture multiplies the vertex colors at high repeat — grass and dry hills have surface grain instead of flat fills.
- **Energy facilities have supporting context**: nuclear plants gained scaled hyperbolic cooling towers, turbine halls with clerestory glazing, a transformer switchyard with gantry, and a gravel service apron; data centers sit on fenced gravel yards with a transformer yard, entrance pavilion, and cyan roof strips; solar rows got support posts.
- **Performance re-checked**: texture generation is one-time; rendering remains the bottleneck with the frame script clean.

## Revision 11.5: high-fidelity world pass (2026-11-07)

The rendered world was rebuilt from "boxes on the ground" to street-and-plot urban fabric with part-based architecture, real-scale vehicles and coherent infrastructure. The simulation, its state, city identities, controls and time progression are untouched; the visual layer reads the same sim state as before through the same `WorldVisual` bridge.

- **Street-and-plot districts** (`src/world3d/district.ts`): every city now has a deterministic street grid — boulevards and side streets with per-city grain rotation — and plots that face streets with frontages, corners and yards. City ground is already flat in `heightAt`; streets, sidewalks and intersection patches are merged per city into single meshes (3 draw calls per city), with dashed center markings on boulevards.
- **Part-based architecture** (`src/world3d/architect.ts` + rewritten `Buildings.tsx`): houses are houses (plinth, gable roof with overhang, chimney, recessed framed windows, door with canopy), apartments are apartment blocks (entrance bay, per-floor window rows, balcony bands with railings, parapet, rooftop AC), offices are towers (continuous glass bands between piers, lobby canopy, setback crown at higher tiers), industry is a sawtooth shed (clerestory glazing, loading doors, yard-side office, stack). All parts are instanced (7 draw calls per city); colors vary per lot deterministically.
- **The world evolves with the sim**: built/active fractions decide which plots stand, which are vacant and which are derelict shells; a new per-city `era` (0 contemporary → 1 modernized → 2 advanced, computed from automation/computing adoption, wage index and fusion capacity) drives façade modernity and adds rooftop solar and green roofs; actively growing cities stage construction sites with cranes on their newest plots; the oldest 22% of plots keep their original architecture (heritage fabric). Verified live: the same city at the 2026 start and at year 2293 ("Deep-Future Era") reads as the same place transformed.
- **Real-scale transport**: cars, vans, buses and trucks are composed parts (body, glass cabin, four wheels with correct radius, headlight strip) at true scale to the widened 2.6-unit roads (1 unit ≈ 3 m; a car ≈ 1.5 units long), with right-hand lane offsets. EV adoption from the sim still repaints the fleet; ships gained sheer, deckhouse, funnel and container rows.
- **Infrastructure proportions**: wind turbines are now hub 8u / rotor 6.4u (realistic hub-to-rotor ratio) with foundation pads and tapered towers; solar rows gained support posts and cast shadows; data centers unchanged (already reading well).
- **Compact labels**: city tags are small pills that scale with camera distance (`distanceFactor` 140 → 38), population sub-lines only for the principal/selected city; the unobstructed-aerial-view HUD toggle still hides them.
- **Performance**: a quantized `heightAt` memo cache removed the dominant CPU cost (heightAt+fbm were ~14% of frame time from per-frame vehicle/citizen/fringe sampling). Profiling at 100× speed now shows render-bound frames with no script hotspots.
- **Vegetation, water, clouds and smog** from revision 11.4.2 are retained and unchanged.

## Revision 11.4.2: 3D fidelity pass (2026-11-07)

No simulation semantics changed; this pass makes the rendered world itself more physical. All layers verified in the running app (day and night).

- **Water is now depth-aware and coastal.** A baked heightmap of the island (`src/world3d/heightmap.ts`) lets the water shader know the land beneath it: sandy shallows blend to turquoise then deep offshore, the bed is visible through the water column at the shore, travelling swell waves (two directional trains + detail noise) replace the flat ripple pattern, a fresnel band reflects the sky's actual dusk/night mood, and animated foam lines appear along the coast. Far water melts into the fog color so the plane boundary never reads.
- **The island grew forests.** A new vegetation layer (`src/world3d/Forest.tsx`) places up to 900 instanced conifers and broadleaf trees exactly where the terrain shader paints its dark forest tint (same moisture field), rejecting beaches, the snowline, cliffs, cities and their fringes, and road curves. Canopies carry per-tree color variation and a gentle wind sway; trunks and canopies cast and receive shadows.
- **Smog became haze.** The waste domes over strained cities were hard grey ellipsoids that read as soap bubbles; they are now a fresnel-soft shader volume that hugs the city lower and dissolves at the rim, tinted by the scene fog so night smog does not glow.
- **Clouds exist.** A high, slowly drifting fbm cloud plane (`src/world3d/Clouds.tsx`) fills the sky dome with soft cumulus cells that fade at the horizon and track the same fog/night colors as everything else. It casts no shadow (a transparent plane would block light harshly).
- **Shared lighting state expanded.** `skyState` now also publishes the per-frame dusk factor and fog color (previously recomputed ad hoc by consumers); water, clouds and smog all read from it.

## Revision 11.4.1: engineering-hygiene pass (2026-11-06)

No simulation semantics changed. This pass fixed the development pipeline and removed dead weight, so future model changes get caught by gates instead of by inspection.

- **`npm run build` (`tsc -b`) works again.** Six type errors had accumulated because the CDN build compiles with `strict: false`: an unimported `resolveDecision` in the test suite (which had actually broken two invariant tests at runtime — they now pass, and their entries were removed from `tools/known-test-failures.txt`, shrinking the known-failure ledger from 6 to 4), unused variables in `Shell.tsx`/`Buildings.tsx`, and a `'none'` tone leaking into a `"good" | "warn" | "bad"` prop.
- **CI now runs `tsc -b` as a blocking gate and eslint as a report-only step.** The shipped browser build stays intentionally permissive (`tools/build-cdn.py`), so the strict typecheck previously ran only on developer machines. Lint stays non-blocking until its backlog (react-hooks/refs in the two shell files) is cleared.
- **Deleted ~6,100 dead lines and 45 unused dependencies.** The entire committed shadcn/radix kit (`src/components/ui`, 53 files) was referenced by nothing but itself, along with `src/hooks`, `src/lib`, the Vite-template `src/pages/Home.tsx`, the route wrapper around a routeless app, and all radix/recharts/react-hook-form/zod/etc. dependencies. The live UI is hand-rolled CSS; this halves install surface and ends lint noise from files nothing uses.
- **A dismissal leak between worlds was fixed.** `dismissedDecisions` was never cleared on new scenario or branch, and decision keys are scenario-stable, so a card dismissed in one world silently never appeared (and never paused the clock) in the next one. Dismissals now clear on `newScenario`, `branch` and `closeBranch`.
- **Decision pausing is now symmetric with decision resolution.** `decide()` already applied to both branch worlds, but `frame()` only checked the active world's pending decisions; a turning point in the unfocused branch no longer resolves silently at its deadline.
- **The chronicle is bounded at 1,500 entries** (founding 150 kept, oldest middle block evicted) to match the metrics cap; unbounded array growth leaked into a full copy+filter at 2 Hz in the UI.
- **Dependency-readiness arithmetic was simplified at fixed semantics.** The divide-by-total-weight in `dependencyReadiness` cancelled out exactly, leaving a weighted sum; since every `TECH_DEFS` deps total ≤ 1 the gate's behavior is unchanged, and the comment now states the invariant instead of implying a normalization that didn't happen.
- **`window.__nightFactor` / `__sunDir` were replaced** by a typed shared module (`src/world3d/skyState.ts`), removing all seven `(window as any)` bridges across water/buildings/vehicles/infrastructure/frontier/canvas.
- **World seeds are visible and copyable** (chip in the bottom dock) — the welcome screen claims "seeded & reproducible", but the default seed was previously invisible. A stale "~5 Hz" refresh comment was corrected to the actual 0.5 s.
- **Dependency hygiene:** `npm install` regenerates the lockfile against the pruned dependency list; CI's regenerate-lockfile fallback path still covers stale-lockfile protection.

## Revision 11.4: terminal-state, subsurface and public-release correction

This pass continued from the v11.3 release candidate and was intentionally narrow: it fixed contradictions that a public viewer could see directly.

- **Extinction is now a real phase change.** When the final embodied/off-world/digital population reaches zero, the civilization pipeline stops. No research, diplomacy, negotiations, elections, staffed projects, characters or new civilization milestones are generated. Climate/ocean inertia, corrosion, structural decay and ecological succession may continue. The terminal event is recorded once.
- **Post-extinction NaNs were removed at the source.** The post-civilization phase explicitly keeps exposed state finite while demand/output/social activity fall to zero and physical stock continues degrading. A 50-year-after-extinction recursive state scan found no NaN or Infinity.
- **Subsurface geometry obeys depth.** Underground and subsea structures no longer render through terrain/other objects in normal view. A real `Below ground` camera can orbit beneath the one-sided terrain; diagnostic wireframes are opt-in and still depth-tested.
- **Subsurface growth has physical direction.** Additional underground stock creates discrete chambers progressively deeper/farther from portals. Additional subsea stock creates fixed modules farther across/deeper on the actual shelf rather than scaling one hovering marker.
- **World labels no longer sit above the application UI.** City labels occlude behind 3D geometry and render below the observer shell; this fixes cases such as Ember Fields appearing on top of controls/structures.
- **Large-number UI is bounded.** Deep-future population/location values use compact units and panel children may shrink/wrap/ellipsis without moving the left bar.
- **Repository entry points were simplified.** Root documentation now has only `README.md` for public visitors and `README-DEV.md` for developers. Runtime notes are named `RUNNING.txt`. Public demo URL is `https://aicivilization.fyi`.
- **Release validation was rerun from the rebuilt executable.** All 23 presets complete 300 years at seed 7 with zero checked invariant errors; Ocean Century and Vertical World retain their intended physical forms across seeds 3/7/19; Terminal Cascade reaches literal zero in seeds 3 and 19 while seed 7 retains a stochastic remnant.

## Revision 11.3: public-release hardening

This pass revalidated the independently red-teamed v11.2 candidate rather than assuming its conclusions were correct. It found and fixed release-level accounting, scenario, renderer and documentation problems:

- **Off-world residence is now explicit.** `offworld` is split into orbit/cislunar, Mars and deep-space residents; Earth + those three locations closes exactly to total population. Digital share remains an overlapping substrate category. Mars capacity no longer creates Mars city lights or milestone credit without actual Mars residents. Deep-space residents no longer consume a hidden home-system housing slot.
- **Research collaboration no longer means suppression.** Collaborative polities may join/benefit from an existing programme, but one polity's invention does not silently forbid independent parallel research when collaboration is weak.
- **Post-embodied output accounting was corrected.** Digital persons are not added as a second labor pool; compute adequacy changes bounded productivity for the existing population, while orbital industry contributes a bounded separate service term.
- **Vertical World now means vertical across seeds.** The planner no longer waits for literal land exhaustion before a vertical-first society can choose arcologies/underground districts; it still requires demand, robotics, energy, finance and institutions and pays rising height/depth complexity. Seeds 3/7/19 all build both forms in the release validation.
- **Ocean visual grammar improved.** Floating modules are spaced without physical overlap, connected by explicit service bridges and independently moored; bridge failure does not move platforms.
- **Arcologies are compound structures.** Fixed-site towers now include service cores, multiple transfer/sky-lobby decks and crowns. Empty arcologies remain as dark physical stock rather than glowing without occupants.
- **Beyond-Earth visualization follows residents, not only construction.** Orbital habitat activity follows orbital/cislunar population, Mars bases may exist dark when unoccupied, and deep-space craft require actual deep-space residents. The public HUD shows the exact location ledger.
- **Habitat UI stopped presenting stock indices as percentages.** Sea/subsea/vertical/underground values are displayed as normalized stock indices (`×`) with serviceability separately shown as `% live`.
- **Scenario validation is semantic, not only numerical.** In addition to finite/bounded state, release gates check that Ocean Century is oceanic, Vertical World is vertical, Human-Centered Abundance materially outperforms Automation Divide on distribution/institutions, Resilient Earth remains mostly Earth-bound, Long Stagnation does not obtain ASI just because centuries pass, and Terminal Cascade can reach literal extinction without scripting every seed to do so.
- **Documentation was reconciled with the executable.** The placeholder hosted URL is removed; AI timing, engineered-pandemic risk, post-embodied output, deep-sea ecology and scenario-ending claims now distinguish evidence from model choice. Open questions remain open where evidence does not close them.

## Revision 11.2: independent red-team follow-up

The independent pass raised four questions. Three were translated into bounded model mechanisms; the fourth (how to value output in a post-embodied economy) remains a modelling convention rather than an empirical answer. The v11.3 pass corrected overclaims in the original 11.2 notes.
- **Output in a post-embodied economy.** The first v11.2 fix double-counted digital persons and had an ineffective compute-per-mind term. v11.3 replaces it with substrate productivity driven by bounded compute adequacy plus a bounded orbital-industry term.
- **Engineered pathogens.** A separate hazard term remains as a stress-test mechanism, but its absolute scale is not presented as a measured civilization-ending frequency. The evidence note now uses the actual FRI epidemic endpoint and safeguard conditions.
- **Seabed plumes.** DISCOL supports persistent biological effects after 26 years; the model charges stronger ecological/social costs without calling the damage universally irreversible.
- **Income floor and fertility.** The effect remains modest (about +0.16 at the relevant setting) and secondary to broader demographic mechanisms.

## Revision 11.1: red team of v11 (independent pass)

Method: a new battery, `tools/redteam.ts`, runs every preset (23) × seeds 7/11/23 for 300 years and checks the absurdity list automatically: NaN or Infinity, reserve margin above 200%, trajectory label contradicting population, duplicate inventions in collaborative worlds, repeated decision cards, expansion into sea or orbit with land to spare, chronicle spam, populations frozen to 0.1% for 30 years, and time per simulated year.

Found in v11 and fixed:
- **Reserve margins of 1,000–2,900%** in most presets after 2200. Orbital and swarm power was dumped onto the terrestrial deliverable, bypassing the grid ceiling. Now orbital power is imported to meet demand plus a 20% reserve; the rest of the swarm's output goes to orbital industry and the Kardashev capture, never into the grid margin. Two outliers remain at 250–720% in single runs (demand collapse events); acceptable and visible on the card.
- **Growing, fed, powered polities labelled "collapse"** (Population Spring seed 11: 1,739M people, label collapse). Root cause was economic: v10 treated every project's spending as a pure drain on the capital stock, so a long frontier pipeline starved productive capital to near zero and output fell 90% in healthy worlds. Project spending now counts as capital formation (50%) and crowds out other investment only in part (25%); depreciation from poor maintenance is halved. Output recovers and grows in the same runs. In addition the classifier no longer calls output loss "collapse" unless people are also being lost, unserved or hungry; the remaining late-game output decline in digital and off-world eras is recorded as open question 8 (the output index does not measure production by digital minds or off-world industry).
- **Duplicate follow-on inventions in collaborative worlds** ("storage chemistry, generation 11" invented twice): a civilization could launch a generation that another had already validated or had running in a proposed state. Both cases now join the existing programme when collaboration is above 0.35.

Verified clean across 69 runs: no NaN or Infinity, no exceptions, no repeated decision cards, no expansion for show, no chronicle spam, 1.3–16 ms per simulated year. Trajectory distribution at 300 years across all presets: growth 40, collapse 13, extinction 6, flourishing 5, crisis 4, ascent 1. The built module graph passes the Node smoke test.

Not changed, worth knowing: stress presets make collapse, extinction and recovery reachable; they do not script a required ending. For example, Terminal Cascade reaches literal extinction in some validated seeds while seed 7 leaves a small remnant. Long Stagnation remains intentionally slow and does not receive ASI merely because centuries pass.


## Revision 11: the renderer must obey physics

Revision 11 is intentionally not a graphics pass. It treats spatial representation, engineering constraints and ecological decay as part of the simulation contract.

- **Fixed-city geometry.** Existing buildings no longer move radially when population/density changes. Cities grow through fixed-lot infill and discrete redevelopment. Arcologies occupy selected sites; neighbouring buildings are not "pushed" outward.
- **Activity is not existence.** `builtFraction` and `activeFraction` are separate. At zero embodied Earth population ordinary buildings are never rendered as active. They move into the ruin layer while their physical shell remains.
- **Ruins do not uniformly shrink.** Abandoned buildings pass through heterogeneous, discrete failure stages. Roof/frame loss creates rubble at the original footprint; walls/foundations remain. Vegetation grows on and through the ruin geometry. Exact visual collapse years are illustrative, not claimed engineering forecasts.
- **Ecology is spatial.** Rewilding is no longer only a green ring around a city. Succession occupies abandoned lots/structures and continues after civilization is gone.
- **Floating districts are marine systems.** Connected modular platforms now show buoyant decks, buildings, flexible links and mooring/anchor schematics. Damage increases motion/tilt and can darken/fail modules; it does not make the platform shrink.
- **Subsea means subsea.** Pressure-hull habitats sit on the actual seabed. Surface buoys and service/umbilical shafts make them visible through the ocean without moving them to a false depth. Occupancy and condition control light/activity.
- **Underground means underground.** Entrances and ventilation shafts remain on the surface; habitation chambers are below terrain and placed at real negative elevation; v11.4 makes inspection use a below-ground camera/opt-in diagnostic mode. The renderer no longer represents an underground district as a flat disk.
- **Tall/deep/marine physics affects economics.** Successive vertical construction pays rising foundation/lateral/service complexity; underground expansion pays increasing depth/water/ventilation complexity; floating systems pay larger mooring/network costs; deeper subsea expansion pays depth/access penalties. Each habitat has its own physical condition and wear.
- **Ocean Century now becomes oceanic.** A marine-first polity may build serviced floating districts before literal land exhaustion once platform technology, capital and institutional readiness exist. Early shelf subsea development can use redundant surface-served power/air/data/emergency links; deeper or remote districts progressively require closed-loop autonomy. In the seed-7 2326 validation, Ocean Century averages ~0.34 floating capacity and ~0.13 subsea capacity, with those habitats physically visible and separately serviceable.
- **Vertical World now has physical vertical/subsurface stock.** Seed-7 at 2326 averages ~0.27 arcology capacity and ~0.15 underground capacity. Existing ordinary lots remain fixed; growth appears as discrete infill/redevelopment and dedicated vertical/subsurface projects rather than geometry being pushed outward.
- **Off-world growth is visible.** A habitat ledger shows surface, vertical, underground, floating, subsea, off-world and digital population. A schematic/not-to-scale sky layer grows with off-world population and distinguishes orbital/Mars/deep-space continuity from an empty Earth.
- **Intervention "influence" is no longer ambiguous.** The UI says `100/100 intervention budget`. It is outside the civilization model, has zero passive effect and changes a scenario only when the observer explicitly spends points. Global interventions no longer silently debit an arbitrary civilization.
- **Infrastructure can remain without pretending to be active.** Capacity geometry may remain after abandonment, but staffed animation/lights require actors; explicitly autonomous infrastructure is handled separately and conservatively.
- Added `knowledge/physics-and-ecology-visual-contract.md` and upgraded `MASTER_PROMPT.md` to v11 with strict habitat-physics, ruins/succession and off-world-legibility requirements.

Fresh validation: the simulation TypeScript check passes; the CDN/no-Node build syntax-checks all 51 generated modules with zero unexpected errors and reaches the React root. A forced zero-population/zero-autonomy habitat test leaves population at exactly zero while 100 years of abandonment drives serviceability down (floating ~0.07–0.14, subsea ~0.03, vertical ~0.19–0.22, underground ~0.04–0.05) and ecological succession to ~0.93. Maintained Ocean Century habitats instead remain serviceable rather than mechanically decaying to zero by age alone.

---

## Revision 10: civilization can grow, leave, collapse, die — and the world has to show it

Revision 10 attacks the remaining hidden attractors and visual contradictions.

- Replaced the low-fertility demographic destination with a regime model: fertility can remain low, rebound, become technology-assisted, or rise until real physical/social constraints bind. No fixed ~95M equilibrium is encoded.
- Removed the last hidden population floors. Literal zero is literal extinction; a zero-population civilization does not respawn.
- Added territorial states (`active`, `failed`, `abandoned`, `resettling`) and conservative recovery paths from surviving embodied, off-world or digital populations. A dead civilization cannot recover merely because a scenario wants a happy ending.
- Added ecological succession over abandoned developed land and deeper physical decay/abandonment semantics.
- Expanded settlement choices with real arcology and underground project paths, in addition to reclamation, floating, subsea, aerial and off-world habitation.
- Expanded the energy portfolio with geothermal, sustainable bioenergy and ocean energy. Hydrogen is modeled as a carrier/storage/industrial system with conversion infrastructure, not as a magical primary source.
- Added scenario families: Population Spring, Vertical World, Hydrogen Archipelago, Collapse & Return, Terminal Cascade and Deep Diaspora.
- Hardened the renderer contract: embodied Earth population controls street life and staffed launches; traffic can fall to zero; rockets abort when operators disappear; ruins and rewilding appear; vertical/underground and diversified energy infrastructure are visible.
- Simplified the first-run experience: the welcome screen now shows eight genuinely different questions instead of dumping the full scenario catalog; the complete set remains in Scenario Lab.
- The observatory now separates embodied Earth, off-world and digital population when those diverge.
- Rewrote the public `README.md` as the repository welcome; moved development detail to `README-DEV.md`.
- Upgraded `MASTER_PROMPT.md` to v10 so future autonomous rebuilds must preserve plural energy, demographic uncertainty, literal extinction/resettlement semantics and state-consistent visualization without copying this implementation.

Fresh validation shows seed-7 300-year outcomes ranging from ~592M in Deep Diaspora to literal zero in Terminal Cascade; the latter reaches ~99.5% mean ecological succession and remains extinct for a subsequent zero-population invariant run. See `VALIDATION_REPORT.md`.

---

## Revision 9: plural futures, epistemic hardening, and a reconstruction constitution

Revision 9 red-teams the simulation as a model, not only as an application. The central change is that **technological expansion is no longer the definition of civilization success**. The frontier now tracks a six-axis lived-outcome profile (material security, human development, institutions, ecology, distribution, resilience) independently from development form (Earth-bound/oceanic/spacefaring/digital/mixed). `flourishing` can therefore be Earth-bound, while a high-capability/spacefaring civilization can be brittle or collapsing.

Other high-impact changes:
- disclosed the compressed ~256M-person synthetic-region scale instead of labelling it literal world population;
- capped the evidence-labelled METR-style task horizon at 16h and separated speculative deep autonomy into a dimensionless capability index;
- replaced instantaneous/reversible sea-level calculation with lagged `seaLevelM` and monotonic `committedSeaLevelM` state;
- added governance capacity, social contract, AI safety, biosecurity, climate adaptation and diffusion as causal scenario dimensions;
- added Human-Centered Abundance, Automation Divide, Resilient Earth, Polycrisis and AI Safety First scenario families;
- renamed frontier `roadmapYear` to `illustrativeYear` and removed ahead/behind-roadmap framing;
- made climate-control milestones reduce warming only while supported; they do not erase committed sea-level rise;
- hardened collapse semantics so near-extinction cannot display healthy institutional state;
- made Long Stagnation capable of remaining non-ASI even over centuries;
- changed `serve.sh` auto behavior to prefer the CDN/browser-ready build when local npm dependencies are absent;
- replaced the old implementation-heavy master prompt with `MASTER_PROMPT.md` v9: an autonomous reconstruction constitution that fixes the product idea and epistemic/causal requirements while giving models/agent swarms broad creative authority over architecture, UI, world representation and scenario implementation.

Validation: simulation-only TypeScript check passes; the browser CDN build syntax-checks/evaluates 51 modules and reaches React root render. Current seeded scenario/stress snapshots are in `VALIDATION_REPORT.md` and `VALIDATION_RESULTS.json`.

---

## Revision 8.1: the blank page, found and fixed

Cause: revision 8 made `engine.ts` import the UI store to read the Ask setting, which created a module cycle (`store` → `engine` → `store`). In the browser the engine module evaluated first, the store's module-scope code then read `engine` before it was initialized, the whole graph threw before React mounted, and the page stayed blank. Fixed: the engine no longer imports the store; the store mirrors the Ask setting into the engine (`setAskMode`).

So that this class of failure cannot ship again: `tools/smoke-esm.mjs` evaluates the entire built module graph in Node with stubbed npm packages (react, three, react-three, zustand, react-router) and fails on any syntax error, missing export, uninitialized-binding cycle or module-scope crash; `tools/build-cdn.py` runs it and refuses to produce `dist/` unless it passes. `dist/index.html` now shows a loading panel and prints any error on screen instead of going blank; `dist/check.html` imports every module in the import map one by one and reports which one fails. `serve.sh` no longer needs Node: without Node 20+ it serves the prebuilt `dist/` with Python; Node is needed only to rebuild.

## Revision 8: the discovery pass, and the autonomy rule

Historical note: revision 8 attempted to close seven open questions, including by assigning an AGI calendar threshold. That AGI treatment is **superseded**. Current releases do not derive an AGI date from forecast aggregates or extrapolate the METR task-horizon benchmark beyond its validated range; see `knowledge/science/agi-timeline.md` and the v11.3 open-questions register. Other revision-8 changes (longevity fertility cap, fleet-scale fusion learning, seabed cap, fertility contagion and biological-age gerontocracy correction) remain subject to their evidence notes. New rule in the master prompt (IV.5) and `knowledge/README.md`: the system and its agents never ask the operator unless absolutely necessary; they find or decide and record the assumption. In the game: an Ask setting in the dock (Turning points / Never) and a "Stop asking" button on every decision card; in Never mode decisions resolve in character without stopping the clock.

## Revision 7.2: agent organization

`MASTER_PROMPT.md` Part IV: roles (steward/architect, discovery agents by field, knowledge curator, implementers by file ownership, content, numeric validation, visual validation, playtest, red team, release), the loop from note to release, handoffs, definition of done, governance and cadence, minimum and maximum swarms. New `knowledge/` folder with the framework README, templates (note, mechanism spec, validation report, visual validation checklist), an open-questions list, and seed notes.

## Revision 7.1: the master prompt

`MASTER_PROMPT.md` is now three parts: Part I the founding brief (unchanged), Part II the complete specification of the current system (contract, state model, step order, every subsystem's rules with its constants, world and visuals, interface, build, validation with reference numbers), Part III the latitude (what is fixed, what is open, how a swarm divides the work), and Appendix A, generated from the code by `tools/spec.ts` (civilizations, technology domains, invention pathways, milestone ladder, decision cards, presets, builder axes, default parameters, interventions, evidence ids, calibration constants). Regenerate the appendix after any data change.

## Revision 7: society

New module `src/sim/core/society.ts`, thirteen dynamics, five new decision cards, all state-driven:
- **Synthetic births.** Two biotech inventions (human in vitro gametogenesis, full ectogenesis; realistic dates 2040s–2070s). When both exist and fertility is below 1.45 the card asks: state birth programme / licence to families / both / ban. Births enter cohort 0, cost money for twenty years, cost trust for a generation. The programme holds an old pyramid level; the licence adds a steady trickle that follows wealth.
- **Fertility contagion.** Norms travel with trade and science ties, weighted by openness; a new civilization trait `culturalCohesion` (0.3 / 0.5 / 0.7) resists. Low fertility spreads to open, connected polities; cohesive ones hold.
- **Conflict.** Tension per pair from scarcity (minerals, fuel, food, land), grievance and autonomy, minus trade and science ties. Above 0.72 the more autonomous side gets the card: negotiate and share / sanctions and blockade / strike first. War destroys capacity and homes, kills, borrows, cuts trade and science, ends by exhaustion. Grievances persist.
- **Pandemic.** Hazard from urbanization, trade and warming, cut by biotech; the old die first; card: hard lockdown / protect the old / stay open.
- **Gerontocracy.** Median age past 60 slows institutions and capital; the young leave for the youngest polity.
- **Brain drain.** Research capacity follows people out of an unstable, shrinking polity.
- **Germline enhancement.** Public / private / ban; private builds a two-tier population.
- **Secession.** Three years below stability 0.15 fragments the polity; it can reunite later.
- **Cultural revival.** A pro-natal movement can appear in a cohesive low-fertility society and raise fertility for a generation.
- **Drought.** Warming-driven multi-year harvest failures.
- **AI incident.** A post-AGI cascade; card: oversight / five-year pause / continue.
- **Solar storm.** Carrington-class every ~125 years; unhardened grids lose a quarter of delivery.
- **Post-biological polity.** When most people are digital and almost none are born, the model says what that is.
Also fixed: the trajectory classifier now calls a population collapse a collapse (it read "growth" while 90% of people were gone).

## Revision 6: a real population

The old population was one number with a fertility target and a median age that drifted toward a formula; it settled where births met deaths and sat there. Replaced by an age-structured model (`src/sim/core/demography.ts`): twenty-one five-year cohorts, births from the women in the fertile bands by an age schedule, deaths by age from a Gompertz life table, one band of aging every five years. Median age, working share and dependency are read off the pyramid. Consequences: Nemea (median 29, fertility 2.3) keeps growing to the 2060s after its fertility falls below replacement and only then shrinks; Veloria (median 43, fertility 1.45) shrinks from the start and its shrinking slows when longevity therapies cut old-age deaths; longevity is modelled as slower aging past 40 (at life expectancy 130 a 100-year-old dies like a 67-year-old) and moves retirement later (65 at LE 80, about 96 at LE 130). Crisis mortality (famine, state failure, heat) hits the very young and the very old twice as hard. The People tab shows the age structure. Populations now grow, peak, shrink, recover or die out according to the pyramid, never flatline by construction.

## Revision 5.1: the build loop

Long runs showed civilizations building nuclear plants and solar every year on top of a fat reserve: mothballing removed surplus capacity, the planner counted the removals as retirements to replace, and built again. Fixed: a fleet already above a 30% reserve is its own replacement reserve (no builds), firm power is never proposed above 22%, and the build order needs at least 1% of demand. Routine capacity builds are now significance 1 (hidden under the Major chronicle filter); only the first of a kind per civilization is a headline. Research programs that retry a failed pathway say so ("retries, attempt 2") instead of reading as a second invention. The decision card offers "Decide for all" when the same question is open for several civilizations (AGI, fusion pilot).

## Revision 5: the world asks

Ten decision points, triggered by the simulated state, not by dates. When one fires the clock stops and the civilization asks the observer: work disappearing after AGI (income floor / retraining / markets), the island full (build up / reclaim and float / cap migration), the fusion pilot works (build first plant / fission / wait), cheap fuel over (crash clean build / firm power / ration), longevity validated (public / private / restrict), the debt wall (austerity / restructure / borrow into growth), the sea winning against reclaimed districts (defend / retreat), a cheap launch pad (space programme / Earth first), 2.5 °C (climate engineering research / adapt), the population peak (pro-natal / migrants / consolidate). Each option acts through the same channels the civilizations use: policies, projects, research effort, scenario parameters, direct state. "Let them decide" picks in character from the polity's traits; ignored for two years, the civilization decides itself. Every decision is a chronicle event; branch first under Parallel Worlds to compare the two histories. Baseline seed 7 asks ten questions in 120 years.

## Revision 4 (UX and realism pass)

Answers to the review of the previous build:
- **Grid reserve of thousands of percent.** Capacity far above demand is now mothballed (fuel plants first), planners stop proposing generation above a healthy reserve, and output no longer collapses when people move off-world or into digital form (robots and digital minds count as labor). The card explains the number and flags anything above 60% as waste.
- **Stability unclear.** Click any "?" meter on the civilization card: stability, grid reserve, land, inequality, unemployment, readiness each show the arithmetic behind the number, with 2026 reference points.
- **No longevity breakthrough.** Senescence clearance and partial reprogramming are calibrated to 2030s trial timelines (difficulty lowered, reachable earlier). Life expectancy above 85 now raises fertility (up to +0.55), lengthens working lives and lowers deaths; it shows up in births per 1,000 on the People tab.
- **Settlement size not proportional to population.** City footprint now scales with the people living in that city (square root of the ratio to 2026), building count with occupied housing. Each settlement carries a label with its name, population and condition (crowded, emptying, blackouts).
- **Inequality.** Gini is a mean-reverting level driven by automation exposure and joblessness, pulled down by an income floor, retraining, education and institutions. Above 0.40 it costs stability and trust; above 0.45 it lowers births. Shown with analogues (Nordics 0.27, US 0.41, Brazil 0.53).
- **Median age 40.** The three polities start at 43 / 38 / 29, the 2026 values of Germany-Japan / US-China / Mexico-India analogues; the People tab says so. Scenario Lab → Demographics now offers Older / Younger / Higher migration, which move median age and fertility together.
- **Nothing settled for show.** Reclamation, floating districts, sea-floor habitats and Mars settlements are proposed only when cheaper room is gone (land committed, shelf used, floating built), and Mars begins as a science outpost of a few thousand. Presets tilt costs and priorities; they never force an expansion. "Inhabit Everything" now works through a young, growing population that runs out of land.
- **New interface.** Cinematic observer layer: world observatory (left) with population, trajectory, climate, Kardashev and the three civilizations at a glance; stage title that names the age the world is in; civilization card (right) with Overview / People / Economy / Frontier tabs and a "Shape their future" action; a dock for perspective, map layers, light and time; a chronicle strip with the last major events and an "Ask what if…" box that runs a new world from a sentence. Keyboard: space, 1–4, H, N/D/C, Esc.

Known open item: in the 300-year "Inhabit Everything" run the weakest polity (Nemea) still slides into unrest after 2250 while the other two flourish; the cause is a late-game interaction between off-world migration, housing and legitimacy that needs another session.


## What was wrong before

- `npm run build` failed on unused-variable errors in `src/sim/core/step.ts`, so no `dist/` was ever produced. The "browser-ready" folder served the raw `index.html`, whose `<script src="/src/main.tsx">` only works under the Vite dev server. Result: a blank page from `./serve.sh`.
- The delivered source already had projects, inventions and asset degradation; the user's observed behaviour came from an older build. But scenarios were over-damped: prices stuck at 1.00, debt sank to a floor, every population declined, no finite resources, no frontier.
- Day/night was a 96-second cosmetic cycle that ran while paused, with a short dusk and near-black nights.

## Simulation

### Finite world
- `src/sim/core/resources.ts`: fossil reserves (cheap + tail), critical minerals, recycling, off-Earth and seabed supply. Scarcity raises the cost of everything built afterwards.
- `src/sim/core/land.ts`: the continent is an island. Each civilization has fixed usable land split into cities, farms, energy and free land. Cities ratchet outward (densifying does not shrink them), farms shrink as food moves indoors, solar and onshore wind eat land. When free land is gone: build up (density up to 2.4×, housing capex rises), reclaim shallow shelf, then deep water at 4.5× cost, then floating districts once "mass-produced modular floating platforms" (a robotics invention) is validated. Sea-level rise (0.38 m per °C above 1.1 °C, IPCC AR6) needs permanent dike and pump funding; unfunded reclaimed districts flood, houses are lost, an event fires.
- Ocean as a resource: offshore wind / ocean-thermal capacity (no land footprint, 1.6× onshore capex) and seabed mineral collection (cheaper than asteroids, dirtier than recycling, capped at 45% of 2026 demand, fades per field, adds waste and backlash).

### The frontier has to be earned
- `frontierReadiness` per civilization (stability, institutions, debt, energy margin and price, food, housing, research base, legitimacy; any hard failure caps the score). It gates frontier research allocation, spaceports, asteroid mining, habitats, Mars, the space elevator, sea reclamation, floating districts, seabed mining and the funding of every milestone program.
- The "ascent" trajectory label requires 5 milestones including commercial fusion, K > 0.78, mean readiness ≥ 0.65, every civilization ≥ 0.45, and real per-capita growth.
- The Ascent preset is now "favorable choices": collaboration, patient capital, priority for fusion/longevity/space at modest multipliers. It does not guarantee anything; a civilization that lets its grid, debt or politics fail drops out.

### Roadmap
- Only the interstellar entries are removed (von Neumann probes, interstellar ship). Everything inside the Solar System stays: Mars, elevator, habitats, terraforming, Dyson swarm, Type I, system-wide integration, approaching Type II. Orbit engineering is out on energy grounds (moving a planet costs years of the whole Sun's output; K 1.5 captures 3% of it).
- New milestone "Cities take to the sea" (a civilization adds ≥ 10% of its land from reclamation and floating districts).
- Era 1 The Earth-Bound Century: AGI, aging reversal, coastal expansion, commercial fusion, asteroid mining, planetary energy mastery. Era 2 The Interplanetary Era: Mars settlement, space elevator, terraforming, orbital habitat network. Era 3 The Post-Scarcity Era: ASI, digital minds, early Dyson swarm, Type I.

### The full range of endings
The trajectory label now runs from **extinction** to **flourishing**:
- Extinction: famine, state failure and heat compound in mortality (up to 30%/yr in a failed, starving, hothouse polity); a civilization below 1% of its 2026 population ends with an event; the region below 1% ends the story. Climate feedbacks past 3 °C and convex crop losses past 2.5 °C make this reachable. Preset **Hothouse** (cheap fuel, touchy climate, no cooperation) reaches crisis around 2200 and near-total collapse by 2270 in the reference seed.
- Flourishing: milestone **Engineered climate** (program: sunshades and capture at scale, needs planetary energy, AGI and orbital industry) pulls warming to 1.2 °C; milestone **Everywhere inhabited** requires people on land, on the sea, under it (new sea-floor pressure-hull habitats), in the stratosphere (new buoyant platforms), in orbit and on Mars under an engineered climate. Preset **Inhabit Everything** reaches it around 2320 in the reference seed, with K ≈ 1.45 and the Type II approach milestone. Sub-sea and stratospheric living are included as engineering options once closed-loop life support, fusion-scale energy and tether-grade materials exist; gills and ocean-capping still are not.
- In between: growth, ascent, stagnation, managed decline, crisis, collapse, as before.
Also fixed on the way: an interest spiral that could bankrupt a healthy civilization (rates now cap, debt above 3× output restructures), a housing feedback where empty homes and crowding reinforced each other, and off-world migration that emptied a polity faster than its habitats could justify.

### Sea or sky
Both exits are always available; the simulated state decides which one a civilization takes. Land pressure pulls research toward marine platforms; cheap launch and a mineral crunch pull toward orbit. The `marineMult` parameter tilts the balance: preset **Ocean Century** (sea first, space late), builder axis **Where to expand** (sea first / let the numbers decide / sky first), and What-If phrases mentioning oceans, floating cities or islands.

### Ocean civilization proposal: what was taken, what was rejected
The three-phase "pelagic → deep-sea → shell Earth" proposal (2300–2600) was reviewed against the evidence.
- Taken: floating modular platforms (prototypes exist in the Maldives and Busan today, so they enter when a civilization needs them, decades earlier than 2300); offshore wind and ocean-thermal energy; seabed mineral extraction (nodule collector trials 2022–2025); aquaculture is implied by floating districts. Longevity therapies already exist in the model.
- Rejected: sub-sea cities near hydrothermal vents (pressure, corrosion, no sunlight, no economic reason once platforms and robots exist); engineered gills and liquid breathing (no biological pathway; a robot goes down, a person does not need to); "reverse speciation"; capping the oceans with an artificial crust (the ocean is the planet's heat and water buffer; the proposal's own dependency table says the planet freezes or desertifies without megastructures to replace it). The realistic uses of the sea are its surface and its floor, both modelled.

### Economy and society
- Fiscal realism: aging burden, income-floor cost, interest that rises with debt, debt floor 0.15, baseline productivity tied to education and institutions.
- Housing abandonment when population shrinks; stranded infrastructure maintenance; automatic universal income floor where automation displaces work and the society can afford it.
- Age-structured births and deaths, life expectancy with longevity therapies, warming driven by fossil extraction and reversed only by planetary energy mastery.

## 3D world
- `src/world3d/Sky.tsx`: about four-minute day, pauses with the simulation, twilight band, moonlight; pin Day / Dusk / Night from the bottom bar.
- `src/world3d/Frontier.tsx`: derelict blocks (fringe empties first, half-collapsed, dark), reclaimed districts that sink when the dikes fail, bobbing hexagonal floating districts, fusion torus beside nuclear zones, spaceports with launches, space elevator, orbital habitat rings, Dyson glint.

## UI
- Top bar: Kardashev chip with trajectory, 100× speed. Bottom bar: lighting control. Right panel: Frontier tab (readiness per civilization, land and sea, milestone ladder with blockers), Chronicle major/all filter. Civ inspector: land, sea, readiness, life expectancy, derelict housing, income floor. App: WebGL check and error boundary instead of a blank page.

## Build
- `serve.sh` installs, builds and serves `dist/`. `kimi-plugin-inspect-react` removed. `npm test` runs the simulation tests (new: land accounting, readiness gating, no interstellar milestones, ascent preset does not hand out ascent).
- The simulation core was type-checked here (`tsc -p tsconfig.sim.json`). The UI cannot be type-checked in this environment (no `node_modules`), so run `npm install && npm run build` on a networked machine before serving.

## Reference runs (seed 7, baseline)
AGI ~2066; first commercial fusion ~2100; Ardan hits its land wall in the 2040s and reclaims about 10% of its land; floating platform technology ~2100; ASI ~2106; trajectory reaches "ascent" only after 2100. Long Stagnation: Nemea's debt climbs past 2× output by 2150 with stalled income and no frontier programs.

## v9.0 complete-release packaging — 2026-09-09

- Added explicit Node-free runtime launchers for macOS, Linux and Windows.
- Added `run_no_node.py`, a Python-standard-library local server that executes the prebuilt `dist/` without Node/npm.
- Added `standalone/CivilizationLab_NoNode.pyz`, a single-file Python zipapp containing the complete project-owned browser runtime.
- Changed `serve.sh` to use the prebuilt Node-free runtime by default rather than rebuilding opportunistically.
- Rebuilt `dist/` from the latest v9 source, including the final evidence-layer changes.
- Hardened `tools/build-cdn.py` classification so missing JSX runtime typings are recognized as expected in the no-`node_modules` fallback; latest build reports 0 unexpected fallback errors.
- Added `NO_NODE_README.md` and platform-specific launch instructions at that revision; v11.4 later consolidated runtime guidance into `README-DEV.md` plus `RUNNING.txt`.
- Added no-Node runtime smoke tests to `VALIDATION_REPORT.md`.
