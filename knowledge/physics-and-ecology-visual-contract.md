# Physics & ecology visual contract

Status: **normative for the reference renderer and for future autonomous rebuilds**.

The renderer is an instrument panel made of space, materials and motion. It is not allowed to tell a different story from the simulation state.

## 1. Existence, serviceability and activity are different states

For every major physical system distinguish:

1. **physical stock** — the structure/material still exists;
2. **serviceability/condition** — pumps, seals, lifts, grids, ventilation, moorings, hulls and utilities still make it usable;
3. **occupancy/activity** — people or explicitly modelled autonomous actors are actually using it.

A building may therefore be physically present, unserviceable and empty. That is a ruin, not a missing building and not an active city.

Hard invariant: if embodied Earth population is zero, ordinary pedestrian traffic, commuter traffic, staffed construction and staffed Earth launches are zero. Autonomous activity is permitted only where an explicit autonomous-infrastructure state supplies the actors and maintenance.

## 2. Growth conserves place

Existing structures have fixed sites. Population or GDP growth cannot multiply their x/z coordinates and push them away from a city centre.

Growth may occur through:
- fixed-site infill;
- discrete redevelopment/replacement;
- new neighbourhoods on newly committed land;
- arcologies on explicit sites;
- underground chambers with explicit portals/shafts;
- reclamation;
- floating districts;
- subsea districts;
- aerial/off-world habitats.

Each path consumes its own stock, capex, time, energy, maintenance and institutional capacity.

## 3. Tall construction

Very tall construction is not ordinary housing with a height multiplier. Increasing height/development intensity should raise marginal cost and/or lead time through at least some of:
- foundations and settlement;
- lateral wind/seismic response;
- vertical transportation;
- evacuation/fire strategy;
- facade movement and stack effect;
- utility pressure zones;
- maintenance access and replacement.

A tower does not become shorter because its condition falls. It first loses serviceability; later local elements fail and rubble accumulates.

Useful engineering background: Council on Tall Buildings and Urban Habitat (CTBUH), tall-building structural/service literature, https://www.ctbuh.org/ .

## 4. Floating/on-water construction

Floating districts are marine structures, not flat decorative markers. Where visible, show enough of the system to communicate:
- buoyant modules/freeboard;
- connections between modules;
- mooring/anchoring or station keeping;
- access/service links;
- wave/current-driven motion;
- condition/damage.

Wind, waves and current are first-order environmental loads for marine structures. DNV-RP-C205 is a useful reference for modelling environmental conditions and loads: https://www.dnv.com/energy/standards-guidelines/dnv-rp-c205-environmental-conditions-and-environmental-loads/ .

Damage changes serviceability, motion, flooding/connectivity risk and repair needs. It must not simply scale the geometry smaller.

## 5. Subsea construction

Put a subsea habitat on/below the actual seabed. Normal view must obey depth. If the camera cannot see it, use surface buoys/service markers and let the user move the camera below/inside the environment, or enable an explicit opt-in cutaway. Never make the hidden habitat globally depth-test-free or draw it through unrelated structures.

Required causal dependencies include:
- pressure hull/boundary integrity;
- corrosion control;
- power and thermal rejection;
- air/life support;
- pumping where relevant;
- data/communications;
- emergency access;
- surface/offshore logistics or closed-loop autonomy.

Early shelf habitats may be **surface-served** by redundant power/air/data/emergency umbilicals. They do not need a fictional Mars-grade closed loop. As distance/depth increases, surface dependence becomes harder and closed-loop autonomy should become more valuable/necessary.

Hydrostatic pressure increases strongly with depth, so deeper habitat should have increasing structural/access costs.

## 6. Underground construction

An underground district has surface interfaces and subsurface volume. Show entrances and ventilation/service shafts at the surface, while the inhabited chambers remain at real negative elevation. A below-ground camera is the preferred inspection method; a labelled cutaway may be offered explicitly, but normal view must preserve occlusion and depth.

Causal constraints include geology, support, groundwater, waterproofing, drainage/pumping, ventilation, heat rejection, smoke/fire control, vertical transport and emergency egress. Increasing depth/network size must not stay at constant marginal cost indefinitely. Increasing underground capacity should create discrete deeper/farther chambers or networks, not scale a single marker. Increasing subsea capacity should likewise add modules farther across and/or deeper on the actual shelf.

## 7. Condition and maintenance

Condition is **serviceability**, not a countdown to material disappearance.

A maintained system should approach a maintenance-supported equilibrium determined by funding, institutions, energy, local/autonomous maintainers and engineering complexity. It should not mechanically reach zero merely because 300 years pass.

An abandoned system should converge toward service failure. Marine and subsea systems should generally lose habitability faster than sheltered massive structures because water, corrosion, seals, moorings, pumps and pressure boundaries are unforgiving. The physical material can remain long after serviceability is gone.

For reinforced concrete, chloride ingress and reinforcing-steel corrosion are established degradation mechanisms, especially in marine exposure. NIST background: https://www.nist.gov/publications/simulation-studies-methods-delay-corrosion-and-increase-service-life-cracked-concrete .

## 8. Ruins and ecological succession

Do not represent abandonment with uniform shrink or disappearance.

Minimum sequence:
1. occupancy/activity stops;
2. lights and staffed systems stop;
3. maintenance failures accumulate;
4. local roof/facade/floor/frame failures happen at different times;
5. rubble and foundations remain at the original footprint;
6. vegetation colonises cracks, lots, roofs, roadsides and rubble where climate permits;
7. over long periods the settlement becomes archaeology inside an ecosystem.

The exact material persistence over millennia is uncertain and environment-specific. Do not claim that a modern skyscraper remains intact for 10,000 years; also do not erase concrete, steel, foundations and altered ground as if they never existed.

## 9. Ocean-first planning

An ocean-oriented civilization does not need to wait until the last square metre of land is occupied. Ports, energy, industry and housing can move offshore strategically before absolute scarcity, provided technology, finance, institutions and maintenance support it.

The scenario parameter changes preference and hurdle rates; it does not grant free structures. A named Ocean Century scenario must produce materially oceanic state in at least some validated seeds or fail validation.

## 10. Off-world continuity must be legible

Earth, orbit/cislunar, Mars and deep-space populations are separate **location reservoirs**. Digital/post-biological status is an overlapping substrate category, not a fifth additive location.

The location accounting must close: **Earth + orbit/cislunar + Mars + deep space = total population**. Capacity and occupancy are separate. An empty built settlement stays physically present but inactive.

If the majority of civilization leaves Earth:
- Earth surface activity must fall with Earth actors;
- off-world population/infrastructure must become visible in the scene and exact in the UI;
- any orbital visualization may be schematic/not-to-scale, but must say so;
- an empty Earth cannot keep launching staffed rockets merely because an old spaceport remains physically present.

## 11. Observer budget is not world physics

The intervention budget belongs to the player/observer, outside civilization. `100/100` means fully replenished intervention capacity. It has **zero passive effect** on any scenario. Only an explicit intervention spends it and changes causal state.

## 12. Terminal-state and interface truth

Literal global extinction is a phase change in the model. Record it once, then terminate civilization-generated history. Research, diplomacy, negotiations, wars, staffed construction, staffed launches, characters and new civilization milestones cannot continue from zero actors. The clock may continue for climate/ocean inertia, corrosion, structural collapse, flooding, debris and ecological succession. Every numerical field exposed to the UI must remain finite after extinction; NaN/Infinity is a release failure.

World-space labels must obey both geometry and interface hierarchy. A city label may be occluded by terrain/buildings and must never render above the application HUD. Large deep-future values must use compact bounded formatting rather than widening panels or shifting controls.

Subsurface structures are not x-ray stickers. Normal rendering preserves depth; inspection uses a real below-ground camera path or an explicitly selected diagnostic mode.

## 12. Validation obligations

A release should test, at minimum:
- literal zero population stays zero without an explicit survivor reservoir;
- zero Earth population yields zero staffed launches/traffic/citizens;
- Ocean Century builds visible floating and, when gates are met, subsea stock;
- Vertical World builds discrete vertical and underground stock without moving existing lots;
- Inhabit Everything/off-world scenarios visibly account for population leaving Earth;
- abandoned structures remain as dark physical stock while ecological succession increases;
- maintained habitat condition does not inevitably fall to zero with age alone;
- unmaintained habitat condition can fail while physical stock remains;
- every scenario stays numerically finite and within declared state bounds;
- after literal global extinction, the chronicle/event count freezes, social/technical state stops advancing, and no NaN/Infinity appears while physical/ecological decay may continue;
- world labels remain below HUD panels and subsurface geometry is not visible through opaque surface structures in normal view;
- large numerical values do not alter panel geometry.
