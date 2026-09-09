---
id: science-output-post-embodied
title: What output means once a polity is partly digital and partly off-world
kind: model-design
confidence: speculative
constrains: [stepEconomy in step.ts, trajectory classifier in frontier.ts]
valid_until: revisit whenever digital/off-world population accounting changes
sources:
  - Coyle, GDP: A Brief but Affectionate History (2014), measurement limits
  - Hulten & Nakamura, expanding the measurement of intangible/digital output
  - Hanson, The Age of Em (2016), speculative hardware-constrained emulation economy
written_by: v11.3 release red-team, 2026-09-09
---

## The accounting problem

A conventional labor/output index becomes conceptually weak when persons can be digital, off-world, or both. The first attempted fix was also wrong: it treated digital minds as an extra labor pool even though they were already included in total population, which double-counted people; its “compute per mind” term was then numerically so small that it usually hit a floor anyway.

The release model therefore treats **location** and **substrate** as orthogonal:

- total population counts persons once;
- Earth + orbit/cislunar + Mars + deep space = total population;
- digital share is an overlapping substrate category, not additional population.

## Current modelling convention

Digital substrate changes effective productivity through **compute adequacy**, not by adding another set of workers:

- compute adequacy is bounded from supply/demand;
- a bounded digital-productivity factor modifies the substrate mix;
- orbital industry contributes a separate bounded service/productivity boost, scaled partly by the share of people actually living off-world.

The exact coefficients are model choices, not empirical predictions. They are deliberately bounded so the model cannot manufacture unlimited output from an abstract “digital” scalar.

## Classifier rule

A falling money/output index alone is not enough to call civilization “collapsed.” Population loss, unmet energy, hunger, institutional failure or similar lived/physical deterioration must corroborate the label. This avoids calling a fed, powered, growing post-embodied society collapsed only because a 2026-style accounting proxy lost meaning.

## How to falsify this implementation

Flag the model if:

- digital share can create persons or labor twice;
- Earth + off-world location accounting fails to close;
- output explodes without corresponding compute/capital/energy support;
- output per person rises while material security and served energy visibly collapse;
- the trajectory classifier calls a healthy growing society “collapse” solely from the output proxy.
