# Agent instructions — WHAT IF? Civilization Lab

This file is for any coding, architecture, research or review agent working in this repository. It exists because a change that is "done in code" has repeatedly shipped while its documentation, evidence, knowledge note, tests or manifests were left behind. Follow the checklist for **every** change. Nothing here is optional because a change "looks small".

The project's own rule, from `knowledge/README.md`: *every number in the simulation traces back to a note in `knowledge/` or an entry in `src/sim/data/evidence.ts`.* A number with neither is a hidden assumption.

---

## 1. Before you change anything

1. **Read the current state, not the summary.** Inspect the code path you are about to change and the document that claims what it does. Prior reports in this repository have described work that was not actually wired up.
2. **Decide what kind of change it is:**
   - mechanism / balance / behaviour → §§2–5
   - rendering / visual → §§2, 3, 6
   - documentation only → §§4, 7
   - tooling / pipeline → §§2, 7
3. **Find the owning layer.** If two systems can produce the same object or state, one of them is wrong. Identify the single owner before adding a third.

## 2. Code

- One owner per behaviour. Do not add a parallel renderer, a second decay path, or a duplicate state field; remove or migrate the old one.
- One positioning/origin convention per part system. Assert it once.
- Pre-size buffers for the **worst** case, never the expected case. Silent truncation is a bug, not a performance choice.
- A neutral default must equal the state it claims to be neutral about. Verify by measuring the first simulated months.
- Time constants are part of the model. State the intended response time (months vs decades) and check that the constant delivers it.
- No hidden destiny: no absolute cap that is really a preferred future, and no ceiling that repeated breakthroughs can erode.

## 3. Tests — for every mechanism

- Add a test for the new behaviour and for its failure mode.
- **Hold the driver constant** when testing a causal claim; do not rely on a scenario run that may produce the effect by luck.
- **A claim that passes on one seed is not evidence.** If a scenario states a ceiling, a floor or a label, add the mechanism that makes it true, then a test that exercises that mechanism.
- If an existing invariant now fails, decide honestly which of three cases applies:
  1. the model is wrong → fix the mechanism;
  2. the test was asserting the wrong thing → rewrite the claim and explain why in `CHANGES.md`;
  3. the claim only held by luck → strengthen the mechanism.
  Never resolve a violated claim by adding it to `tools/known-test-failures.txt` unless you understand the failure and record it.
- Run the suite. `python3 tools/check-tests.py` must report *only* known failures. A stale ledger entry (a listed test that now passes) is also a signal — investigate it, do not ignore the warning.

## 4. Evidence and knowledge — always, together

If the change introduces or alters a **number, a rate, a threshold, a capability or a claimed mechanism**:

1. Add or update an entry in `src/sim/data/evidence.ts` (the runtime-visible subset), with source, date, confidence and `knownConstraints`.
2. Add or update a note in `knowledge/science/` or `knowledge/analogues/` using `knowledge/templates/note.md`, with:
   - the claim and the numbers;
   - where it comes from and how far sources agree;
   - **what it constrains in the model** (name the actual fields);
   - **how we would know it is wrong** (the observable and the reference run).
3. If it is a modelling judgment rather than evidence, say so in the note and add it to `knowledge/open-questions.md` with its evidence class.
4. Never present a scenario assumption as a calibration. If the driver is speculative, label it speculative *in the note and in the code comment*.

## 5. Scenario-level claims

When adding a scenario, a decision or a policy:

- state the claim in one sentence (e.g. "stagnation does not reach superintelligence");
- provide the mechanism that enforces it;
- add a test that holds the driver constant;
- verify with a real run and record the observed trajectory, not just "tests pass".

## 6. Rendering changes

- Judge the **rendered image**, not the diff. Capture from a gameplay camera with the interface hidden.
- If it reads as a primitive with decoration, change the primary design (massing, proportion, structure, openings, ground relationship). Do not add more detail.
- Lifecycle: one structure must be recognisable across occupied / aged / ruined, from a matched camera. Damage must reveal construction; debris must carry the building's own materials and rest believably.
- Labels must match the state beneath them. A shrinking civilization is never labelled "growing".
- Record what you actually saw and what still looks wrong. Do not claim photographic fidelity from a list of techniques.

## 7. Documentation — the part that keeps getting skipped

For **every** change, update all that apply, in the same commit:

| File | What to update |
|---|---|
| `CHANGES.md` | A revision entry: **what changed** and **why** (the decision, including rejected alternatives when the choice was close) |
| `README.md` | If a player-visible mechanic or scenario changed: the narrative explanation and a "try breaking it" experiment |
| `MASTER_PROMPT.md` | If a **principle** was learned (not just an implementation): state it for the next builder. Bump the version in the title |
| `RED_TEAM_REPORT.md` | If a defect was found: the symptom, how it was discovered, and the rule that prevents the class |
| `VALIDATION_REPORT.md` | Current test counts, known failures, what was verified and **what was not** |
| `README-DEV.md` | New release invariants, new commands, new module ownership |
| `knowledge/` | Notes per §4; `open-questions.md` for unresolved judgments |
| `knowledge/physics-and-ecology-visual-contract.md` | If a visual/causal contract rule was learned |
| `info.md`, `package.json`, `package-lock.json` | Version bump when behaviour changes |
| `SOURCE_MANIFEST.txt`, `RELEASE_MANIFEST.sha256` | `python3 tools/make_manifests.py` — then `shasum -a 256 -c` |
| `VALIDATION_RESULTS.json` | `node tools/validate-release.mjs` after a `dist/` rebuild |
| `tools/known-test-failures.txt` | Only per §3, with a dated reason |

## 8. Build and delivery

- `npx tsc -b` must pass. `npm run build` must pass. `python3 tools/build-cdn.py` must pass.
- Do not commit locally regenerated `dist/` or `standalone/` artefacts — CI rebuilds and commits them. Revert them before committing code.
- Verify the deployed result, not only the local build: check the live site and the CI run conclusion.
- Report measured performance with the conditions (resolution, DPR, view, simulation speed), or say nothing about performance.

## 9. The change checklist (copy into your own notes)

```
[ ] inspected the real code path and the doc that describes it
[ ] single owner; removed any duplicate path
[ ] defaults measured, not assumed
[ ] worst-case buffers
[ ] mechanism test + failure-mode test, driver held constant
[ ] known-failures ledger honest; no new entry without a reason
[ ] evidence.ts entry (if a number/rate/threshold/capability)
[ ] knowledge note (claim, constraint, falsifier) + open-questions if a judgment
[ ] CHANGES.md: what + why
[ ] README / MASTER_PROMPT / RED_TEAM / VALIDATION as applicable
[ ] version bumped; manifests regenerated and verified
[ ] tsc + build + check-tests green
[ ] dist/standalone reverted; committed only source and docs
[ ] deployed and verified (live site + CI conclusion)
[ ] wrote down what still looks wrong or is unverified
```

## 10. Reporting

Lead with what a person can now see or do. Then state what is verified and how, then what is **not** verified, then the remaining limitations. Never describe a technique as a result. If a limitation is real, say it plainly; this project's value is that its assumptions are attackable, and hiding a gap undermines the only thing it is for.
