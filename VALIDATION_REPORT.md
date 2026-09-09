# Validation Report — WHAT IF? Civilization Lab v11.4

Validated: 9 September 2026

This report records checks run against the **v11.4 executable tree** prepared for the public release at `https://aicivilization.fyi`. Scenario values below are test snapshots, not forecasts.

## Release result

**PASS** for the checked release gates.

- **23/23 scenarios** completed 300 simulated years at reference seed 7 with zero checked finite/accounting errors.
- Simulation TypeScript: `tsc -p tsconfig.sim.json --noEmit` — **PASS**.
- Browser/CDN build: **51 modules**, 0 syntax failures; whole module graph evaluated and React root render was reached — **PASS**.
- Standard no-Node launcher served `index.html` and `app/main.js` with `node` absent from `PATH` — **PASS**.
- Standalone `CivilizationLab_NoNode.pyz` served the same runtime with `node` absent from `PATH` — **PASS**.
- Clean archive candidate: all **249** listed release files passed `sha256sum -c`; exactly two root READMEs and no embedded historical ZIPs/obsolete README entry points — **PASS**.

The browser-ready runtime still loads version-pinned React/Three packages from `esm.sh`, so browser internet access is required. Node/npm are not required to run the included build.

## Terminal civilization gate

A direct **Terminal Cascade, seed 3** run reached literal global extinction in **2291**. The simulation then ran another 50 years.

After extinction:

- total population remained exactly **0**;
- the chronicle length remained frozen at the extinction event;
- the final chronicle entry remained **“The last population disappears”**;
- technology and diplomatic relations remained unchanged;
- pending decisions, staffed projects and conflicts remained **0**;
- a recursive walk over the world state found **no NaN or Infinity**;
- ecological succession continued to roughly **99%** in the abandoned polities;
- physical habitat condition continued to deteriorate.

This validates the post-civilization phase: **history stops; physics and ecology do not**.

## Zero-actor renderer gate

The same extinct world was converted through the current renderer-state mapping after additional decay.

- maximum city `activeFraction`: **0**;
- maximum Earth `launchRate`: **0**;
- physical built stock remained non-zero (maximum city built fraction about **0.126**);
- rewilding reached about **0.984**;
- renderer state contained no non-finite numerical values.

Therefore an empty civilization can leave buildings, foundations and ruins without producing lights, staffed launches or an active city.

## Habitat/scenario gates

Reference seed 7, year 2326:

| Scenario | Population | Off-world | Floating | Subsea | Vertical | Underground | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Ocean Century | 376.9M | 129.0M | 0.323 | 0.097 | 0.000 | 0.000 | materially oceanic |
| Vertical World | 606.1M | 205.6M | 0.017 | 0.000 | 0.738 | 0.191 | vertical + underground |
| Inhabit Everything | 1,454.7M | 496.3M | 2.237 | 0.071 | 0.574 | 0.181 | multiple habitat classes |
| Hydrogen Archipelago | 468.0M | 184.7M | 0.314 | 0.091 | 0.000 | 0.000 | marine + hydrogen path |
| Deep Diaspora | 1,250.4M | 418.3M | 1.460 | 0.000 | 0.805 | 0.400 | large off-world population visibly accounted for |
| Hothouse Collapse | 0 | 0 | 0 | 0 | 0.057 | 0 | extinction with physical stock able to remain |

Habitat values are normalized physical stock indices, **not percentages of humanity**. Serviceability is tracked separately.

### Multi-seed robustness

Seeds **3, 7 and 19** were rerun for the habitat-critical presets.

- **Ocean Century:** every seed builds both floating and subsea stock.
- **Vertical World:** every seed builds both vertical and underground stock.
- **Inhabit Everything:** every seed uses floating, subsea, vertical and underground stock.
- **Terminal Cascade:** seeds 3 and 19 reach literal extinction by 2326; seed 7 leaves a tiny ~5,000-person remnant. The scenario creates pressure, not a scripted ending.

## Scenario semantics

The release gates also check meaning, not only numerical stability.

- **Human-Centered Abundance** vs **Automation Divide:** distribution is **1.00 vs ~0.65** and institutional health **~0.82 vs ~0.49**. Similar technological capability does not force similar lived outcomes.
- **Resilient Earth:** off-world population remains below **10%** of total in the reference run.
- **Long Stagnation:** AGI can emerge but **ASI remains false** after 300 years; elapsed time alone does not unlock it.
- **Collapse & Return:** path validation records Veloria going `active → failed/remnant → abandoned → resettling → active`. Settlers are conserved from surviving population; no people are respawned from zero.

## Off-world accounting

For every checked scenario:

**Earth-located + orbit/cislunar + Mars + deep space = total population.**

Digital/post-biological population remains an overlapping substrate category rather than an additional location. Mars capacity and Mars occupancy are separate, so an empty constructed Mars settlement does not imply residents or city activity.

## Subsurface/rendering corrections checked in source/build

- Underground chambers use actual negative elevation and additional stock adds deeper/farther fixed chambers.
- Subsea pressure-hull modules sit on the actual seabed; additional stock expands farther/deeper on the shelf.
- Normal view preserves depth testing. Diagnostic wireframes are only visible in the selected below-ground mode and still respect depth.
- The camera can orbit below terrain and has a dedicated **Below ground** view.
- World-space city labels ray-occlude and render below the application shell, so labels such as **Ember Fields** cannot sit above the left HUD.
- Large population/location numbers use compact bounded formatting; panel children are permitted to shrink/wrap/ellipsis instead of shifting the left bar.

## Documentation/repository gate

- Public demo URL: **https://aicivilization.fyi**.
- Root contains exactly two README entry points: `README.md` and `README-DEV.md`.
- `README.md` describes the project as a causal counterfactual lab, explains the agent-built/red-teamed development process, and distinguishes evidence, modelling choices and speculation.
- Runtime-specific notes are `dist/RUNNING.txt` and `standalone/RUNNING.txt`, not additional READMEs.
- `MASTER_PROMPT.md` is v11.4 and explicitly requires terminal-state silence, physical subsurface depth, real subsurface growth, HUD/label hierarchy and finite post-extinction state.

## Limits of this validation

The container can verify simulation behavior, generated module syntax/evaluation, React root render and HTTP serving. It cannot provide a trustworthy automated **pixel-perfect WebGL visual review** because the available headless graphics environment does not provide a dependable GPU/WebGL context. The release therefore does **not** claim automated visual-regression coverage.

The model is also intentionally not an Earth digital twin, climate emulator, CGE economy or forecast distribution. Deep-future technologies and social dynamics remain explicit scenario assumptions. `RED_TEAM_REPORT.md` documents those limitations.

## Reproduce

Development checks:

```bash
tsc -p tsconfig.sim.json --noEmit
python3 tools/build-cdn.py
node tools/validate-scenario.mjs baseline_2026 7 300
python3 tools/build-no-node-pyz.py
```

Run the release without Node/npm:

```bash
./RUN_NO_NODE.sh
# or
python3 standalone/CivilizationLab_NoNode.pyz
```

The detailed machine-readable results are in `VALIDATION_RESULTS.json`.
