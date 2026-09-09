#!/usr/bin/env python3
from __future__ import annotations
import json, math, os, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCENARIOS=['baseline_2026','ai_flywheel','energy_constraint','abundant_clean','fragmented_world','ascent','ocean_century','hothouse_collapse','everywhere','resource_crunch','long_stagnation','open_knowledge','human_centered_abundance','automation_divide','resilient_earth','polycrisis','ai_safety_first','population_spring','vertical_world','hydrogen_archipelago','collapse_and_return','terminal_cascade','deep_diaspora']
YEARS=300; SEED=7

def run_one(task):
    sid, seed = task
    p=subprocess.run(['node','tools/validate-scenario.mjs',sid,str(seed),str(YEARS)],cwd=ROOT,text=True,capture_output=True,timeout=90)
    if p.returncode:
        raise RuntimeError(f'{sid}/{seed}: {p.stderr[-2000:]}')
    return json.loads(p.stdout)

tasks=[(s,SEED) for s in SCENARIOS]+[(s,sd) for s in ['ocean_century','vertical_world','everywhere','terminal_cascade'] for sd in [3,19]]
workers=1
rows=[]
for i,task in enumerate(tasks,1):
    print(f'[{i}/{len(tasks)}] {task[0]} seed {task[1]}', file=sys.stderr, flush=True)
    rows.append(run_one(task))

main=[r for r in rows if r['summary']['seed']==SEED]
by={r['summary']['id']:r['summary'] for r in main}
inv=[e for r in rows for e in r['errors']]
seed_checks=[]
for sid in ['ocean_century','vertical_world','everywhere']:
    for sd in [3,7,19]:
        r=next(r for r in rows if r['summary']['id']==sid and r['summary']['seed']==sd)
        seed_checks.append(r['summary'])

sp=subprocess.run(['node','tools/validate-special.mjs'],cwd=ROOT,text=True,capture_output=True,timeout=90,check=True)
special=json.loads(sp.stdout); z=special['zeroTest']; o=special['observerTest']
finite=lambda x:isinstance(x,(int,float)) and math.isfinite(x)
expect={
'allScenariosFinite': not inv,
'oceanCenturyIsOceanic': by['ocean_century']['habitats']['floating']>.10 and by['ocean_century']['habitats']['subsea']>.02,
'verticalWorldIsVertical': by['vertical_world']['habitats']['vertical']>.08 and by['vertical_world']['habitats']['underground']>.03,
'inhabitEverythingUsesMultipleHabitats': by['everywhere']['habitats']['floating']>.08 and by['everywhere']['habitats']['subsea']>.015 and by['everywhere']['habitats']['vertical']>.04 and by['everywhere']['offworldM']>30,
'deepDiasporaLegibleOffworld': by['deep_diaspora']['offworldM']>50,
'terminalCascadeCanReachLiteralZero': any(r['summary']['id']=='terminal_cascade' and r['summary']['populationM']==0 for r in rows),
'hydrogenScenarioActuallyUsesHydrogen': by['hydrogen_archipelago']['energyGW']['hydrogenElectrolyzer']>.01,
'locationAccountingCloses': all(abs((x['earthLocatedM']+x['offworldM'])-x['populationM'])<1e-6 for x in by.values()),
'offworldLocationSplitCloses': all(abs((x['orbitalM']+x['marsPopulationM']+x['deepSpaceM'])-x['offworldM'])<1e-6 for x in by.values()),
'deepSpaceIsSubsetOfOffworld': all(x['deepSpaceM']<=x['offworldM']+1e-9 for x in by.values()),
'marsPopulationNeverExceedsCapacity': all(x['marsPopulationM']<=x['marsCapacityM']+1e-9 for x in by.values()),
'economicOutputFiniteAndBounded': all(finite(x['economy']['output']) and finite(x['economy']['outputPerCapitaMax']) and x['economy']['outputPerCapitaMax']<1e6 for x in by.values()),
'humanCenteredBeatsAutomationDivideOnDistribution': by['human_centered_abundance']['outcome']['distribution'] > by['automation_divide']['outcome']['distribution'] + .12,
'humanCenteredBeatsAutomationDivideOnInstitutions': by['human_centered_abundance']['outcome']['institutionalHealth'] > by['automation_divide']['outcome']['institutionalHealth'] + .08,
'resilientEarthRemainsMostlyEarthbound': by['resilient_earth']['offworldShare'] < .15,
'longStagnationDoesNotGetASIByElapsedTime': not by['long_stagnation']['asi'],
'populationSpringActuallyExpands': by['population_spring']['populationM'] > 600,
'zeroStaysZero': all(v==0 for v in z['population']) and z['trajectory']=='extinction',
'abandonedStockPersistsWhileServiceFails': all(all(v>0 for v in x.values()) for x in z['physicalStock']) and all(x['subsea']<.10 and x['rewilding']>.85 for x in z['conditions']),
'zeroEarthHasNoActiveCitiesOrLaunches': all(v==0 for v in z['visual']['activeFractions']) and all(v==0 for v in z['visual']['cityPopulations']) and all(v==0 for v in z['visual']['launchRates'].values()),
'zeroEarthRetainsPhysicalHabitatState': any(any(v>0 for v in x.values()) for x in z['physicalStock']),
'observerBudgetHasNoPassiveScenarioEffect': o['start']==60 and o['after10YearsPassive']==100 and bool(o['spent']) and o['spent']['ok'] and abs((o['spent']['before']-o['spent']['after'])-o['spent']['cost'])<1e-6,
'oceanCenturyRobustAcrossSeeds': all(x['habitats']['floating']>.07 and x['habitats']['subsea']>.01 for x in seed_checks if x['id']=='ocean_century'),
'verticalWorldRobustAcrossSeeds': all(x['habitats']['vertical']>.05 and x['habitats']['underground']>.02 for x in seed_checks if x['id']=='vertical_world'),
}
result={'generatedAt':datetime.now(timezone.utc).isoformat(),'release':'v11.4','simulationYears':YEARS,'scenarioCount':len(SCENARIOS),'seed':SEED,'workerConcurrency':workers,'expectations':expect,'invariantErrors':inv,'zeroTest':z,'observerTest':o,'scenarios':[by[s] for s in SCENARIOS],'seedChecks':seed_checks}
(ROOT/'VALIDATION_RESULTS.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
pass_all=all(expect.values())
print(json.dumps({'scenarioCount':len(SCENARIOS),'pass':pass_all,'expectations':expect},indent=2))
sys.exit(0 if pass_all else 2)
