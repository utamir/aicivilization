---
id: science-bci-throughput
title: Brain–computer interface decoding throughput
kind: science
confidence: established
constrains: [TECH_DEFS.neural_interface.cap0, phase0, cost0, diffusionSpeed, paradigmCap0]
valid_until: decoding throughput stops doubling every few years, or healthy-user implants appear at scale
sources: [Willett et al., Nature 2023, high-performance speech neuroprosthesis ~62–78 words/min; Metzger et al., Nature 2023, speech decoding from ECoG; Card et al., NEJM 2024, intracortical BCI in ALS; Hochberg et al. 2012 for the 2010s cursor baseline]
written_by: implementation agent, 2026-11-09
---
## Claim
Clinical intracortical and ECoG interfaces now decode intended speech at roughly 60–80 words per minute and cursor/pointing tasks at tens of characters per minute, against a 2015-era baseline of single-digit words per minute. The population is tiny: on the order of dozens of chronic implants worldwide, almost all in severe paralysis, not healthy users. Durability remains the unresolved engineering constraint (electrode degradation, gliosis, signal loss over years) and each implantation is neurosurgery.

## Where it comes from
Peer-reviewed clinical trials (Nature 2023 ×2, NEJM 2024), plus older intracortical work for the baseline. They agree on the direction and rough magnitude of decoding improvement, and agree equally clearly that deployment is limited by surgery, participant selection and long-term reliability rather than by demand.

## What it constrains in the model
`neural_interface.cap0 = 0.06` (research-grade, not a consumer product), `phase0 = 'science'`, `maturity0 = 0.07`, `reliability0 = 0.16`, `cost0 = 3.2`. Diffusion is deliberately slow (`diffusionSpeed 0.09`) because the binding constraints are clinical and surgical, not aspirational. The technology's *promise* — thinking through an AI — is the extrapolation, and is marked as such.

## How we would know it is wrong
Either of two observables would contradict this note: healthy users adopting implants at consumer-product rates within a decade (which would make `cap0` and diffusion far too conservative), or throughput stagnating at current levels for twenty years (which would make the paradigm ceiling too generous). Reference run: `Neural Divide`, seed 7, 300 years — implant adoption should stay low and uneven unless policy spreads it.
