---
id: science-bci-acceptance
title: Public acceptance of enhancement brain implants
kind: science
confidence: contested
constrains: [neural_interface diffusion ceiling, society.neuralProgram trigger, decisions.neural_provision]
valid_until: stated-preference surveys are replaced by revealed uptake at scale
sources: [Pew Research Center 2021, "Americans are wary of using brain implants to improve cognitive ability" — majority support for medical use, roughly a third or less for enhancement; Nature Human Behaviour survey work on neuroethics]
written_by: implementation agent, 2026-11-09
---
## Claim
Therapeutic use of implanted devices commands majority support; **enhancement** use does not. Roughly a third or fewer of surveyed adults accept cognitive-enhancement implants, and acceptance falls after well-publicised failures and rises with visible personal benefit. Stated preference is not uptake, and willingness-to-pay at scale is unmeasured.

## Where it comes from
Nationally representative surveys (Pew 2021; academic neuroethics survey work). They agree on the direction — therapy yes, enhancement divided — and disagree on how fast attitudes move.

## What it constrains in the model
Diffusion of `neural_interface` through medicine first, enhancement later and unevenly (`diffusionSpeed 0.09`, `pen0` near zero for all three civilizations in 2026). The `neural_provision` decision is triggered only after clinical adoption meaningfully exceeds the therapy-only population, because before that the political question does not exist.

## How we would know it is wrong
If enhancement adoption approaches therapeutic adoption without any policy intervention in the model, the ceiling is too high. If a ban is costless in the model (no talent or research loss), the social mechanism is too weak. Reference run: compare `Neural Divide` with a `ban` decision against universal provision — the divergence in inequality and research speed should be visible within 40 years.
