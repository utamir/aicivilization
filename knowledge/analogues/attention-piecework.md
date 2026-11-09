---
id: analogue-attention-piecework
title: Piece-rate human judgement inside machine systems
kind: analogue
confidence: established
constrains: [economy.mindMarket, stepMindMarket, decisions.mind_market, scenario cognitive_proletariat]
valid_until: verification of model output stops being a paid human task, or piece rates stop clearing at subsistence
sources: [Gray & Suri, "Ghost Work" 2019 — microwork and on-demand human computation; Perrigo, TIME 2023 on Kenyan content-moderation and RLHF labelling wages; World Bank and ILO digital piecework studies; classical reservation-wage literature]
written_by: implementation agent, 2026-11-09
---
## Claim
When machine systems need human judgement — labelling, verification, moderation, sign-off — the work is paid by the task, geographically distributed, and priced near the worker's next-best option. It appears first where formal employment is weakest. Measured employment can improve while the rate per task falls, because supply grows faster than demand. This is not speculative: it is the present-tense shape of the data-labelling and content-moderation industry.

## Where it comes from
Ethnographic and journalistic primary reporting (Ghost Work; TIME's Kenya investigation), plus multilateral labour studies and standard reservation-wage economics. They agree on the piece-rate structure and the wage floor; they disagree on scale, because much of the work is informal and unmeasured.

## What it constrains in the model
`economy.mindMarket` is a share of the labour force, not a wage — the model has no wage distribution, so the *rate* collapse is represented only indirectly through Gini and health. Its driver is machine demand × desperation × (1 − income floor), which reproduces the observed pattern that the market appears where the safety net fails. The `mind_market` decision offers regulation, an open market, or a ban paired with a floor.

## How we would know it is wrong
If a strong income floor does not substantially reduce the modelled market, the "consent under constraint" mechanism is wrong. If the market absorbs displacement without any cost to health or legitimacy, the trap is not modelled and the mechanic should be re-derived rather than tuned. Reference run: controlled comparison holding displacement and AI adoption constant while varying `basicProvision` — the market must differ by more than 1.5×.
