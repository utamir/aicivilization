# Visual validation checklist

Run the built `dist/` in a real browser, seed 7, and capture screenshots at 2026, 2060, 2100, 2150 in baseline, Hothouse and Inhabit Everything, at Day and Night. For each, confirm and attach:

- Settlement labels present, populations plausible, the largest city of each civilization bold.
- City footprint grows and shrinks with population (compare 2026 vs 2100 per city).
- Night: lit windows where demand is served; dark blocks where derelict; dim districts during blackouts.
- Derelict blocks visible in any civilization whose population fell by 20% (fringe first, half height, dark).
- Coast: reclaimed slabs where `land.reclaimed > 0`; floating hexagons where `land.floating > 0`; slabs sunk where dike condition < 0.35.
- Sea-floor domes and stratospheric platforms only where those states exist (never in baseline 2100).
- Fusion torus at the nuclear zone once fusion capacity exists; spaceport with a launch within two minutes at 100× once launch cadence > 0; elevator; habitat rings.
- Day/night cycle about four minutes, pauses with the sim, twilight visible, moonlight at night.
- Observer interface: no overlapping panels at 1280×720 and 1920×1080; every "?" opens; the decision card appears when the world asks and the clock is stopped; Escape closes drawers.
- Nothing rendered that the state does not justify; nothing in the state that the world does not show (from the II.5 list).
Attach: screenshots, the state values read from the Frontier tab at each capture, and a list of mismatches with severity.
