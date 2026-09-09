# WHAT IF? Civilization Lab — Developer Guide

Public visitors should start with `README.md`. This file is only for running, changing and validating the implementation.

The current implementation is React + TypeScript + Three.js. The project itself is technology-agnostic: `MASTER_PROMPT.md` is the reconstruction constitution for another model or autonomous agent swarm.

## Run the included release without Node/npm

The archive includes a prebuilt browser runtime in `dist/`. Node.js, npm, Vite, TypeScript and `node_modules` are **not required to run it**.

- **macOS:** double-click `RUN_NO_NODE.command` (or run `./RUN_NO_NODE.sh`). If Gatekeeper blocks the first launch, right-click the `.command` file and choose **Open**.
- **Linux:** `./RUN_NO_NODE.sh`
- **Windows:** run `RUN_NO_NODE.bat` or `RUN_NO_NODE.ps1`
- **Python directly:** `python3 run_no_node.py`

The launcher uses Python's standard library to serve `dist/` locally and opens the browser. The current prebuilt runtime loads version-pinned React/Three/react-three packages from `esm.sh`, so the browser needs internet access for those third-party modules. All project-owned source, simulation logic, CSS, documentation and validation material are included locally.

A single-file Python runtime is also included under `standalone/CivilizationLab_NoNode.pyz`.

## Development

With Node.js 20+ and npm:

```bash
npm install
npm run dev
```

Build/test:

```bash
npm run build
npm test
```

Simulation-only strict type check (does not require React/Three packages):

```bash
tsc -p tsconfig.sim.json --noEmit
```

Rebuild the no-node/CDN browser artifact without local `node_modules`:

```bash
python3 tools/build-cdn.py
python3 tools/build-no-node-pyz.py
```

## Release invariants

The renderer is part of the causal contract. In particular:

- existing structures keep fixed sites; growth is infill/redevelopment/new habitat, not coordinate drift;
- physical stock, serviceability and occupancy are separate states;
- empty structures may remain, but ordinary lights/traffic/staffed launches require inhabitants;
- floating, subsea, vertical and underground systems have different engineering/maintenance failure modes;
- underground/subsea geometry obeys terrain/water depth; use the **Below ground** camera to inspect it;
- Earth + orbit/cislunar + Mars + deep space must equal total population; digital minds are an overlapping substrate category;
- literal global extinction is absorbing: no research, diplomacy, decisions, new civilization milestones or respawn after zero;
- after extinction, climate/ocean inertia, infrastructure decay and ecological succession may continue;
- deep-future uncertainty must be labelled as modelling assumption rather than presented as measured precision.

See `knowledge/physics-and-ecology-visual-contract.md` for the detailed visual/physics contract.

## Important source areas

- `src/sim/core/step.ts` — monthly causal engine and post-civilization physics phase
- `src/sim/core/demography.ts` — births, deaths, cohorts and population accounting
- `src/sim/core/land.ts` — finite land, habitat planning, maintenance and ecological succession
- `src/sim/core/frontier.ts` — off-world location accounting, milestones, outcomes and trajectory interpretation
- `src/sim/core/society.ts` — institutions, hazards, collapse and recovery
- `src/sim/core/resources.ts` — finite fossil/mineral stocks and substitution
- `src/sim/data/params.ts` — scenario presets and natural-language what-if mapping
- `src/sim/data/evidence.ts` — evidence registry
- `src/world3d/` — state-driven 3D interpretation
- `src/ui/Shell.tsx` — primary observer interface
- `tools/build-cdn.py` — prebuilt browser artifact
- `tools/validate-*.mjs` / `.py` — release/adversarial validation

## Documentation map

There are intentionally only two README files at repository root:

- `README.md` — public project page
- `README-DEV.md` — execution/development guide

Other top-level documents have specific roles rather than duplicating onboarding:

- `MASTER_PROMPT.md` — autonomous reconstruction specification
- `RED_TEAM_REPORT.md` — adversarial review
- `VALIDATION_REPORT.md` / `VALIDATION_RESULTS.json` — release evidence
- `CHANGES.md` — model history

## Epistemic status

This is a game-scale causal counterfactual laboratory, not an Earth digital twin and not a forecast. Near-term calibration can be empirical; century-scale mechanisms become increasingly structural/speculative. Code that makes uncertainty look more precise than the evidence is a modelling defect, even when it is technically valid.
