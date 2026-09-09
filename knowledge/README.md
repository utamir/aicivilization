# Knowledge framework

This folder is the memory of the project that is not code. Discovery agents write here first; the architect turns notes into mechanism specs; implementers cite the note id in code comments and in `src/sim/data/evidence.ts`; validators check the reference numbers the note promised.

Rules
- One note per claim. A note answers: what is known, how well, what in the model it constrains, and how we would notice if it were wrong.
- Every number in the simulation traces back to a note here or an entry in `evidence.ts` (the compiled, runtime-visible subset of these notes).
- Notes are never deleted. A superseded note keeps its id and gets a `superseded_by` line.
- Confidence is one of: established / likely / contested / speculative. Speculative notes may still drive content (a decision card, an event) but never a calibrated constant.

Layout
- `analogues/` historical and present-day cases the simulation should be able to reproduce in spirit (a place, a period, what happened, what it constrains).
- `science/` findings and forecasts from research: energy, biotech, space, climate, demography, economics, computing.
- `open-questions.md` what nobody in the swarm knows yet, ranked by how much the model depends on it.
- `physics-and-ecology-visual-contract.md` normative rules tying renderer geometry/activity to physical simulation state.
- `templates/` the note, mechanism spec, validation report and visual validation checklist.

Note format: see `templates/note.md`. Ids: `kind-slug`, e.g. `analogue-singapore-reclamation`, `science-ivg-timeline`.

## The autonomy rule
Agents do not ask the operator questions. When information is missing, an agent searches (the web, the literature, the code, the batch runners) and decides; it records the decision and its reasoning in a note or in CHANGES.md and marks the confidence. A question to the operator is allowed only when the answer cannot be found or reasoned to at all and the wrong choice would destroy work that cannot be redone (for example: deleting a deliverable, changing the product's purpose, spending money). Even then the agent proposes its own default and proceeds with it if no answer arrives. "Should I do X or Y" is never a question; it is a decision with a note. The same rule governs the game: the world asks the observer only at real turning points, offers "Let them decide" and "Stop asking", and never blocks on an answer past the deadline.
