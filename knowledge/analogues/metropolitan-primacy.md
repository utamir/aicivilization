---
id: analogue-metropolitan-primacy
title: Urban primacy — one dominant city, and why populations desert the rest
kind: analogue
confidence: speculative
constrains: [society.primacy, stepSociety primacy target, cityVisuals primacyMult, district suburb ring]
valid_until: transport costs, remote work or automation logistics change the concentration incentive
sources: [UN World Urbanization Prospects on urban primacy; national statistics for Seoul, Bangkok, Lima, Cairo; literature on rural depopulation and "left-behind" regions; regional economics on agglomeration and congestion]
written_by: implementation agent, 2026-11-09
---
## Claim
Primacy — the share of a country's urban population in its largest city — ranges from roughly a fifth to more than half in real states, and has risen where internal migration outpaces secondary-city investment. Rural districts and older industrial towns can empty for decades without any disaster, driven by opportunity differentials alone. What is *speculative* is the proposed driver in this model: that pervasive automation, displacement and cultural aversion to living among machines add a new push toward one human metropolis while the countryside is worked by machines.

## Where it comes from
Aggregate urban statistics are solid for the primacy range and for rural depopulation as a phenomenon. The automation-aversion driver is an inference, not an observation — there is no historical case of a robot-tended countryside emptied of people. That inference is the scenario, and it is labelled as one.

## What it constrains in the model
`society.primacy` is bounded 0.25–0.95 with a neutral baseline of 0.62 (the layout's implied largest-city share). The target rises with displacement, backlash, general-purpose robot adoption, urbanization and autonomous infrastructure, and falls with universal provision. Migration is rate-limited to decades. `cityVisuals` redistributes urban population conserving the total; the emptiest towns pass through vacant to derelict to ruined.

## How we would know it is wrong
If concentration happens without aversion or displacement — for instance in a high-floor, low-robot world — the driver is overfit and must be removed. If a policy of dispersal cannot reverse it inside a generation, the mechanism is a script rather than a choice. Reference run: `Automation Divide` against `Human-Centered Abundance`, same seed, 200 years: primacy should diverge, and the floor world should not form a metropolis.
