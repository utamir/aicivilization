---
id: science-population-health-stock
title: Population health as a stock that scales shock lethality
kind: science
confidence: likely
constrains: [society.health, stepHealth, pandemic frailty multiplier, extraDeath, birthSuppression]
valid_until: recheck against pandemic and heat mortality literature each release
sources: [COVID-19 comorbidity and frailty literature on age- and health-stratified IFR; WHO/GBD burden-of-disease work on the environmental share of mortality; heat-wave mortality studies showing prior health status dominating outcomes]
written_by: implementation agent, 2026-11-09
---
## Claim
The same pathogen, heat wave or famine kills very different shares of two populations depending on their prior health: comorbidity, frailty and access to care dominate outcomes far more than the nominal severity of the shock. Population health also moves slowly — degraded by sustained pollution, crowding and hunger, and rebuilt only over years of healthcare provision.

## Where it comes from
Age- and comorbidity-stratified infection-fatality literature from COVID-19; environmental burden-of-disease estimates; heat-mortality studies. Direction is well established; the exact multiplier between "healthy" and "frail" populations is not, which is why this is `likely` rather than `established`.

## What it constrains in the model
`society.health` (0–1) is fed by biotech adoption, income and institutional delivery, and eroded by waste, crowding, food shortage, pandemic load and extraction work. It scales `extraDeath`, `birthSuppression`, trust, and the pandemic kill rate through a frailty multiplier of `1 + 1.6 × (1 − health)` — up to 2.6× deadlier in a collapsed population. The stock moves with a ~4-year time constant, so recovery is not instant.

## How we would know it is wrong
If a shock kills the same share of a healthy and a broken population, health is decoration and the channel must be removed or rebuilt. Reference run: `Polycrisis` vs `Baseline` at 20 years — the frail world must end measurably less healthy, and a forced pandemic must kill more there.
