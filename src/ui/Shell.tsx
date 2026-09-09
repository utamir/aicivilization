// ─────────────────────────────────────────────────────────────────────────────
// SHELL — the observer layer around the living world.
// Left: the world at a glance. Right: one civilization, explained. Bottom:
// how to look (perspective, layers, light), how fast to run, and what just
// happened. Every number that could puzzle a player has a "why" behind it.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useUI, type CameraMode, type OverlayMode, type LightingMode } from '../state/store';
import { engine, type Speed } from '../state/engine';
import { dateLabel, CIV_IDS, civDef, ageGroups, explainStability, explainReadiness, demographicAnalogue, civHeadline, parseWhatIf, MILESTONES } from '../sim';
import type { WorldState, CivId, CivState, PendingDecision } from '../sim';
import { CIV_TINT } from './shared';

type WRef = React.MutableRefObject<WorldState>;
const safeN = (x: number, fallback = 0) => Number.isFinite(x) ? x : fallback;
const pct = (x: number, d = 0) => `${(safeN(x) * 100).toFixed(d)}%`;
const fmtM = (millions: number, d = 1) => {
  const m = Math.max(0, safeN(millions));
  if (m < 0.001) return '0M';
  if (m < 1) return `${(m * 1000).toFixed(0)}k`;
  if (m < 1000) return `${m.toFixed(m < 10 ? Math.max(1,d) : m < 100 ? 1 : 0)}M`;
  if (m < 1e6) return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)}B`;
  if (m < 1e9) return `${(m / 1e6).toFixed(2)}T`;
  return `${(m / 1e9).toExponential(2)} quadrillion`;
};
const CIV_GLYPH: Record<CivId, string> = { veloria: '✦', ardan: '⬢', nemea: '❋' };

function eraHeadline(w: WorldState): string {
  // Geography and substrate are different axes. Digital minds may still run on
  // Earth, so Earth is empty only when nobody is located here at all.
  const earthLocated = w.civs.reduce((a,c) => a + Math.max(0,c.population.total-c.population.offworld),0);
  if (earthLocated < 0.001 && w.frontier.offworldPopulationM > 0.001) return 'Earth is empty. Civilization is not.';
  const y = w.startYear + w.tMonths / 12;
  const t = w.frontier.trajectory;
  if (t === 'extinction') return 'The silence after';
  if (t === 'collapse') return 'The age of falling';
  if (t === 'crisis') return 'The age of strain';
  if (t === 'flourishing') return 'The age of broad flourishing';
  if (t === 'ascent') return 'The age of reaching';
  if (y < 2040) return 'The age of beginnings';
  if (t === 'stagnation') return 'The long plateau';
  if (t === 'managed_decline') return 'The age of consolidation';
  return w.frontier.era.replace(/ \(.*\)$/, '').replace(/^The /, 'The ');
}

// ── Top navigation ──────────────────────────────────────────────────────────
function TopNav() {
  const panel = useUI((s) => s.panel);
  const set = useUI((s) => s.set);
  const hasBranch = useUI((s) => s.hasBranch);
  const go = (p: typeof panel) => set({ panel: panel === p ? null : p });
  return (
    <div className="s-topnav">
      <div className="s-brand"><span className="s-brand-what">WHAT IF?</span><span className="s-brand-sub">CIVILIZATION LAB</span></div>
      <nav className="s-nav">
        <button className={`s-nav-item ${panel === null ? 'active' : ''}`} onClick={() => set({ panel: null })}>◉ Living World</button>
        <button className={`s-nav-item ${panel === 'futurelab' ? 'active' : ''}`} onClick={() => go('futurelab')}>⚗ Scenario Lab</button>
        <button className={`s-nav-item ${panel === 'branch' ? 'active' : ''}`} onClick={() => go('branch')}>⫶ Parallel Worlds{hasBranch ? ' ·' : ''}</button>
      </nav>
      <div className="s-nav-right">
        <button className="s-icon-btn" title="Evidence registry: every number's source" onClick={() => go('evidence')}>▤</button>
        <button className="s-icon-btn" title="Hide or show the interface (H)" onClick={() => set({ hudVisible: !useUI.getState().hudVisible })}>◫</button>
        <button className="s-primary-btn" onClick={() => go('futurelab')}>+ New world</button>
      </div>
    </div>
  );
}

// ── World observatory (left) ────────────────────────────────────────────────
function Observatory({ worldRef }: { worldRef: WRef }) {
  const vmTick = useUI((s) => s.vmTick);
  const selectedCiv = useUI((s) => s.selectedCiv);
  const set = useUI((s) => s.set);
  const vm = useMemo(() => {
    const w = worldRef.current;
    const pop = w.civs.reduce((a, c) => a + c.population.total, 0);
    const m = w.metrics; const ago = m[Math.max(0, m.length - 21)];
    const popAgo = ago ? w.civs.reduce((a, c) => a + ago.population[c.id], 0) : pop;
    const meanStab = w.civs.reduce((a, c) => a + c.society.stability, 0) / w.civs.length;
    return {
      title: w.scenarioLabel, pop, trend: pop - popAgo, meanStab,
      trajectory: w.frontier.trajectory.replace('_', ' '), note: w.frontier.trajectoryNote,
      civs: w.civs.map((c) => ({ id: c.id, name: c.name, epithet: civDef(c.id).epithet, pop: c.population.total, head: civHeadline(c, w.conflicts.some((k) => k.a === c.id || k.b === c.id)), stab: c.society.stability })),
      war: w.conflicts.length > 0, pandemic: !!w.pandemic, drought: !!w.drought,
      sea: w.env.seaLevelM, warm: w.env.warmingC, k: w.frontier.kardashev,
      earthLocated: w.civs.reduce((a, c) => a + Math.max(0, c.population.total - c.population.offworld), 0),
      embodiedEarth: w.civs.reduce((a, c) => a + Math.max(0, c.population.total - c.population.offworld) * (1 - c.population.digitalShare), 0),
      offworld: w.frontier.offworldPopulationM,
      orbital: w.civs.reduce((a,c)=>a+Math.max(0,c.population.offworld-c.space.marsPopulationM-c.space.interstellarM),0),
      mars: w.civs.reduce((a,c)=>a+c.space.marsPopulationM,0), deepSpace: w.civs.reduce((a,c)=>a+c.space.interstellarM,0),
      marsCapacity: w.civs.reduce((a,c)=>a+c.space.marsCapacityM,0), digital: w.frontier.digitalPopulationM, outcome: w.frontier.outcome.broadFlourishing, form: w.frontier.developmentForm,
      habitat: {
        floating: w.civs.reduce((a,c)=>a+c.land.floating,0)/w.civs.length, subsea: w.civs.reduce((a,c)=>a+c.land.subsea,0)/w.civs.length,
        vertical: w.civs.reduce((a,c)=>a+c.land.vertical,0)/w.civs.length, underground: w.civs.reduce((a,c)=>a+c.land.underground,0)/w.civs.length,
        floatingCondition: w.civs.reduce((a,c)=>a+c.land.floatingCondition,0)/w.civs.length, subseaCondition: w.civs.reduce((a,c)=>a+c.land.subseaCondition,0)/w.civs.length,
        verticalCondition: w.civs.reduce((a,c)=>a+c.land.verticalCondition,0)/w.civs.length, undergroundCondition: w.civs.reduce((a,c)=>a+c.land.undergroundCondition,0)/w.civs.length,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vmTick, worldRef]);
  return (
    <aside className="s-panel s-left">
      <div className="s-kicker">Civilization observatory <span className="s-live">● live</span></div>
      <h1 className="s-world-title">{vm.title}</h1>
      <div className="s-world-sub">{vm.note || 'An unwritten history.'}</div>
      <div className="s-kicker s-mt" title="Population of the synthetic three-civilization region; not literal world population">Simulated population</div>
      <div className="s-big">{fmtM(vm.pop)}<span className="s-big-unit">people</span></div>
      <div className="s-muted">{vm.trend >= 0 ? '+' : ''}{fmtM(Math.abs(vm.trend))} in ten years</div>
      <div className="s-habitat-ledger" title="Location and substrate are separate. Earth + orbit/cislunar + Mars + deep space equals total population. Digital minds overlap those locations. Built-habitat values are stock indices, not population shares.">
        <div className="s-habitat-title"><span>Where civilization exists</span>{vm.earthLocated < 0.001 && vm.offworld > 0.001 ? <b>EARTH EMPTY</b> : null}</div>
        <div className="s-habitat-pop"><span>Earth <b>{fmtM(vm.earthLocated)}</b></span><span>Orbit / cislunar <b>{fmtM(vm.orbital)}</b></span><span>Mars <b>{fmtM(vm.mars,2)}</b></span><span>Deep space <b>{fmtM(vm.deepSpace,2)}</b></span></div>
        <div className="s-habitat-note"><b>{fmtM(vm.offworld)} off-world total</b> = orbit/cislunar + Mars + deep space. <b>{fmtM(vm.embodiedEarth)}</b> embodied people remain on Earth.</div>
        {vm.digital > .001 && <div className="s-habitat-note"><b>{fmtM(vm.digital)} digital minds</b> describe substrate, not another location; they are already included in the counts above.</div>}
        {vm.marsCapacity > .001 && <div className="s-habitat-note"><b>Mars {fmtM(vm.mars,2)} / {fmtM(vm.marsCapacity,2)} capacity</b>. Empty built capacity stays dark.</div>}
        {(vm.habitat.floating+vm.habitat.subsea+vm.habitat.vertical+vm.habitat.underground)>0.002 && <div className="s-habitat-built">
          <span>Built habitat index · serviceability</span>
          <i title="Floating district stock index · serviceability; index is not a population percentage">≈ sea {vm.habitat.floating.toFixed(2)}× <b>{Math.round(vm.habitat.floatingCondition*100)}% live</b></i><i title="Subsea pressure-hull stock index · serviceability; index is not a population percentage">↓ subsea {vm.habitat.subsea.toFixed(2)}× <b>{Math.round(vm.habitat.subseaCondition*100)}% live</b></i><i title="Arcology stock index · serviceability; index is not a population percentage">↑ vertical {vm.habitat.vertical.toFixed(2)}× <b>{Math.round(vm.habitat.verticalCondition*100)}% live</b></i><i title="Underground stock index · serviceability; index is not a population percentage">↧ underground {vm.habitat.underground.toFixed(2)}× <b>{Math.round(vm.habitat.undergroundCondition*100)}% live</b></i>
          {(vm.habitat.subsea+vm.habitat.underground)>.003 && <small className="s-xray-note">Subsurface structures stay physically below terrain and water. Use ↧ Below ground, or orbit beneath the surface, to inspect them.</small>}
          {vm.offworld>.001 && <small className="s-xray-note">Orbital, Mars and deep-space objects are schematic, not to scale. Use ◌ Beyond Earth for a clearer frontier view.</small>}
        </div>}
      </div>
      <div className="s-badges">
        <span className={`s-badge traj-${vm.trajectory.replace(' ', '-')}`}>◐ {vm.trajectory}</span>
        <span className="s-badge" title="Broad lived-outcome profile: material security, human development, institutions, ecology, distribution and resilience">◎ outcomes {Math.round(vm.outcome * 100)}/100</span>
        <span className="s-badge" title="Development form is descriptive, not a success ranking">⌂ {vm.form}</span>
        <span className="s-badge">◑ {pct(vm.meanStab)} stable</span>
        <span className="s-badge" title="Warming above pre-industrial and the sea-level rise it commits">🌡 {vm.warm.toFixed(1)} °C · sea +{vm.sea.toFixed(2)} m</span>
        <span className="s-badge" title="Kardashev index: captured energy on the Sagan scale (2026 ≈ 0.72, Type I = 1.0)">K {vm.k.toFixed(2)}</span>
        {vm.war && <span className="s-badge traj-crisis">⚔ war</span>}
        {vm.pandemic && <span className="s-badge traj-crisis">☣ pandemic</span>}
        {vm.drought && <span className="s-badge traj-managed-decline">☀ drought</span>}
      </div>
      <div className="s-kicker s-mt">Civilizations <span className="s-muted-num">{vm.civs.length}</span></div>
      <div className="s-civ-list">
        {vm.civs.map((c) => (
          <button key={c.id} className={`s-civ-row ${selectedCiv === c.id ? 'active' : ''}`} onClick={() => set({ selectedCiv: c.id })}>
            <span className="s-civ-glyph" style={{ color: CIV_TINT[c.id] }}>{CIV_GLYPH[c.id]}</span>
            <span className="s-civ-text"><span className="s-civ-name">{c.name}</span><span className="s-civ-epithet">{c.epithet} · {c.head}</span></span>
            <span className="s-civ-pop">{fmtM(c.pop)}</span>
          </button>
        ))}
      </div>
      <button className="s-link" onClick={() => set({ rightOpen: true, rightTab: 'chronicle' })}>Open world chronicle →</button>
      {worldRef.current.pendingDecisions.length > 0 && <button className="s-link s-pending" onClick={() => { engine.dismissedDecisions.clear(); useUI.getState().setSpeed(0); }}>{worldRef.current.pendingDecisions.length} question{worldRef.current.pendingDecisions.length > 1 ? 's' : ''} waiting for you →</button>}
    </aside>
  );
}

// ── Stage title (center top) ────────────────────────────────────────────────
function StageTitle({ worldRef }: { worldRef: WRef }) {
  const vmTick = useUI((s) => s.vmTick);
  const speed = useUI((s) => s.speed);
  const vm = useMemo(() => { const w = worldRef.current; const earth=w.civs.reduce((a,c)=>a+Math.max(0,c.population.total-c.population.offworld),0); return { h: eraHeadline(w), date: dateLabel(w), scenario: w.scenarioLabel, era: w.frontier.era, earth, offworld:w.frontier.offworldPopulationM }; }, [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="s-stage">
      <div className="s-kicker s-center">Living world · {vm.era}</div>
      <div className="s-stage-title">{vm.h}</div>
      <div className="s-stage-sub">{vm.date}{speed === 0 ? ' · paused · take a moment to look around' : ''}{vm.earth < .001 && vm.offworld > .001 ? ` · ${vm.offworld.toFixed(1)}M people continue beyond Earth` : ''}</div>
    </div>
  );
}

// ── Civilization card (right) ───────────────────────────────────────────────
type Tab = 'overview' | 'people' | 'economy' | 'frontier';
function Meter({ label, value, text, tone, why }: { label: string; value: number; text?: string; tone?: 'good' | 'warn' | 'bad'; why?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`s-meter ${why ? 'has-why' : ''}`} onClick={() => why && setOpen(!open)}>
      <div className="s-meter-row"><span>{label}</span><span className={`s-meter-val tone-${tone ?? 'none'}`}>{text ?? pct(value)}{why ? <span className="s-why-dot" title="Click: why?"> ?</span> : null}</span></div>
      <div className="s-meter-bar"><span className={`s-meter-fill tone-${tone ?? 'none'}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>
      {open && why && <div className="s-why">{why}</div>}
    </div>
  );
}
function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="s-fact"><div className="s-fact-label">{label}</div><div className="s-fact-value">{value}</div>{sub && <div className="s-fact-sub">{sub}</div>}</div>;
}
function toneOf(v: number, good: number, warn: number, invert = false): 'good' | 'warn' | 'bad' {
  const x = invert ? -v : v; return x >= (invert ? -good : good) ? 'good' : x >= (invert ? -warn : warn) ? 'warn' : 'bad';
}

function CivCard({ worldRef }: { worldRef: WRef }) {
  const vmTick = useUI((s) => s.vmTick);
  const selectedCiv = useUI((s) => s.selectedCiv);
  const set = useUI((s) => s.set);
  const [tab, setTab] = useState<Tab>('overview');
  const w = worldRef.current;
  const c: CivState = useMemo(() => w.civs.find((x) => x.id === selectedCiv)!, [vmTick, selectedCiv, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
  const def = civDef(c.id);
  const settlements = 2; // fixed geography: two cities per civilization in this region
  const stab = explainStability(c);
  const ready = explainReadiness(c);
  const m = w.metrics; const ago = m[Math.max(0, m.length - 3)];
  const popTrend = ago ? c.population.total - ago.population[c.id] : 0;
  const foodCover = Math.min(1, c.food.selfSufficiency + c.food.importShare);
  const achieved = w.frontier.milestones.filter((x) => x.status === 'achieved').length;
  const projects = w.projects.filter((p) => p.civId === c.id && !['operational', 'cancelled'].includes(p.status));
  const margin = c.energy.marginPct;
  return (
    <aside className="s-panel s-right">
      <div className="s-kicker">Civilization</div>
      <div className="s-civ-head">
        <span className="s-civ-glyph big" style={{ color: CIV_TINT[c.id] }}>{CIV_GLYPH[c.id]}</span>
        <div><div className="s-civ-title">{c.name}</div><div className="s-civ-epithet">{def.epithet} · {civHeadline(c, w.conflicts.some((k) => k.a === c.id || k.b === c.id))}</div></div>
      </div>
      <div className="s-tabs">{(['overview', 'people', 'economy', 'frontier'] as Tab[]).map((t) => <button key={t} className={`s-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>

      {tab === 'overview' && (<>
        <div className="s-facts">
          <Fact label="Population" value={`${c.population.total.toFixed(1)}M`} sub={`${popTrend >= 0 ? '+' : ''}${popTrend.toFixed(2)}M this year`} />
          <Fact label="Settlements" value={`${settlements}`} sub={`${c.population.urbanization > 0.7 ? 'urban' : 'mixed'} · ${pct(c.population.urbanization)} in cities`} />
        </div>
        <Meter label="Food security" value={foodCover} tone={toneOf(foodCover, 0.98, 0.9)} text={pct(foodCover)} />
        <Meter label="Stability" value={c.society.stability} tone={toneOf(c.society.stability, 0.6, 0.4)}
          why={<>{stab.factors.map((f) => <div key={f.label} className="s-why-row"><span>{f.label}{f.note ? <em> · {f.note}</em> : null}</span><b className={f.value < 0 ? 'neg' : 'pos'}>{f.value >= 0 ? '+' : ''}{(f.value * 100).toFixed(0)}</b></div>)}<div className="s-why-foot">Stability drifts toward the sum ({pct(Math.min(0.96, Math.max(0.05, stab.target)))}) over a few years. Trust rises with fed, employed, housed people and falls with backlash.</div></>} />
        <Meter label="Social trust" value={c.society.trust} tone={toneOf(c.society.trust, 0.55, 0.4)} />
        <Meter label="Grid reserve" value={Math.min(1, Math.max(0, (margin + 10) / 40))} text={`${margin > 200 ? '>200' : margin.toFixed(0)}%`} tone={margin < 0 ? 'bad' : margin < 8 ? 'warn' : margin > 60 ? 'warn' : 'good'}
          why={<div className="s-why-foot">Reserve = (deliverable supply − demand) / demand. 10–25% is healthy. Below 0 means load shedding. Far above 40% means idle plants nobody pays for: the fleet mothballs fuel plants until the surplus is gone. Served {pct(c.energy.servedTWh / Math.max(1, c.energy.demandTWh))} of demand at {c.energy.priceIndex.toFixed(2)}× the 2026 price.</div>} />
        <Meter label="Land committed" value={Math.min(1, c.land.pressure)} text={pct(c.land.pressure)} tone={toneOf(c.land.pressure, 0.85, 0.95, true)}
          why={<div className="s-why-foot">Cities {pct(c.land.urban)} · farms {pct(c.land.farm)} · energy {pct(c.land.energy)} of 2026 land. Density {c.land.densityIndex.toFixed(2)}×.{c.land.reclaimed > 0 ? ` Reclaimed from the sea +${(c.land.reclaimed * 100).toFixed(1)}% (dikes ${pct(c.land.reclaimedCondition)}).` : ''}{c.land.floating > 0 ? ` Floating districts ${(c.land.floating * 100).toFixed(1)}% of housing.` : ''} Most societies expand into sea or orbit only when pressure justifies it; marine-first scenarios can choose that form earlier, but they still pay its engineering and maintenance costs.</div>} />
        <div className="s-priority"><div className="s-kicker">Current priority</div><div>{c.strategicPriority || 'Keep the lights on and the people fed.'}</div>{projects.length > 0 && <div className="s-muted">{projects.length} projects under way: {[...new Set(projects.map((p) => p.kind.replace('_', ' ')))].slice(0, 4).join(', ')}</div>}</div>
      </>)}

      {tab === 'people' && (<>
        <div className="s-facts">
          <Fact label="Median age" value={`${c.population.medianAge.toFixed(0)}`} sub={demographicAnalogue(c)} />
          <Fact label="Fertility" value={c.population.fertility.toFixed(2)} sub={`births ${(c.population.birthRate * 1000).toFixed(1)} · deaths ${(c.population.deathRate * 1000).toFixed(1)} per 1,000${c.society.syntheticProgram !== 'none' && c.society.syntheticProgram !== 'ban' ? ` · +${c.society.syntheticBirthsPerYear.toFixed(2)}M/yr synthetic (${c.society.syntheticProgram})` : ''}${c.society.revivalMonths > 0 ? ' · pro-natal movement' : ''}`} />
          <Fact label="Life expectancy" value={`${c.population.lifeExpectancy.toFixed(0)}`} sub={c.population.lifeExpectancy > 95 ? 'longevity therapies in use: longer working lives, more births' : 'rises with wealth and medicine; longevity therapies later'} />
          <Fact label="Education" value={pct(Math.min(1, c.population.education))} sub={`working-age share ${pct(c.population.workingShare)}`} />
        </div>
        <div className="s-kicker">Age structure</div>
        <div className="s-pyramid">{ageGroups(c.population).map((g, i) => <div key={i} className="s-pyr-col" title={['0–14', '15–39', '40–64', '65–84', '85+'][i]}><div className="s-pyr-bar" style={{ height: `${Math.max(2, g * 160)}px` }} /><span>{['0–14', '15–39', '40–64', '65–84', '85+'][i]}</span><b>{pct(g)}</b></div>)}</div>
        <div className="s-why-foot">Population moves by births in the fertile bands, deaths by age, and one band of aging every five years. A young pyramid keeps growing after fertility falls; an old one keeps shrinking after it recovers. Longevity therapies slow aging past 40 and move retirement later.</div>
        <Meter label="Inequality (Gini)" value={c.economy.gini} text={c.economy.gini.toFixed(2)} tone={toneOf(c.economy.gini, 0.36, 0.45, true)}
          why={<div className="s-why-foot">2026 analogues: Nordics 0.27, Germany 0.31, US 0.41, Brazil 0.53. Automation and joblessness push it up; an income floor, retraining, education and institutions pull it down. Above 0.40 it costs stability and trust; above 0.45 it lowers births.</div>} />
        <Meter label="Unemployment" value={Math.min(1, c.economy.unemployment * 4)} text={pct(c.economy.unemployment, 1)} tone={toneOf(c.economy.unemployment, 0.06, 0.09, true)}
          why={<div className="s-why-foot">Labor relevance {pct(c.society.laborRelevance)}: how much a job still decides a person's income. With an income floor of {pct(c.society.basicProvision)} joblessness hurts less.</div>} />
        <Meter label="Income floor" value={c.society.basicProvision} tone={c.society.basicProvision > 0.4 ? 'good' : 'none'} why={<div className="s-why-foot">Universal income and services adopted when automation displaces work and the society can afford it (or when you order it under Shape their future).</div>} />
        <Meter label="Housing crowding" value={c.housing.crowding} tone={toneOf(c.housing.crowding, 0.05, 0.15, true)} text={`${pct(c.housing.crowding)} · rent ${c.housing.rentIndex.toFixed(2)}×`} />
        <Meter label="Derelict housing" value={c.housing.abandoned} tone={toneOf(c.housing.abandoned, 0.05, 0.18, true)} why={<div className="s-why-foot">Homes nobody lives in and nobody maintains. Rises when people leave; cleared by solvent institutions; rebuilt on before new land is taken.</div>} />
      </>)}

      {tab === 'economy' && (<>
        <div className="s-facts">
          <Fact label="Output" value={`${c.economy.output.toFixed(2)}×`} sub={`per person ${c.economy.outputPerCapita.toFixed(2)}× 2026`} />
          <Fact label="Public debt" value={pct(c.economy.publicDebt)} sub="of output · above 220% the frontier is unaffordable" />
          <Fact label="Electricity price" value={`${c.energy.priceIndex.toFixed(2)}×`} sub={`${c.energy.demandTWh.toFixed(0)} TWh/yr demand`} />
          <Fact label="Material cost" value={`${c.economy.materialCostIndex.toFixed(2)}×`} sub={`minerals ${w.resources.mineralCostIndex.toFixed(2)}× · fuel ${w.resources.fossilCostIndex.toFixed(2)}×`} />
          <Fact label="Institutions" value={pct(c.economy.institutionalCapacity)} sub="execution capacity: projects finish on time when high" />
          <Fact label="Research base" value={c.researchCapacity.toFixed(2)} sub={`priority: ${c.strategicPriority || 'balanced'}`} />
        </div>
        <div className="s-kicker s-mt">Projects under way</div>
        {projects.length === 0 && <div className="s-muted">None. Investment is going to maintenance.</div>}
        {projects.slice(0, 6).map((p) => <div key={p.id} className="s-proj"><span>{p.kind.replace('_', ' ')}</span><span className="s-muted">{Math.max(0, p.monthsRemaining).toFixed(0)} mo</span></div>)}
      </>)}

      {tab === 'frontier' && (<>
        <Meter label="Frontier readiness" value={c.frontierReadiness} tone={toneOf(c.frontierReadiness, 0.6, 0.45)}
          why={<>{ready.map((f) => <div key={f.label} className="s-why-row"><span>{f.label}{f.note ? <em> · {f.note}</em> : null}</span><b>{pct(f.value)}</b></div>)}<div className="s-why-foot">Spaceports, reclamation, habitats and every long program only run where this is earned. No scenario hands it out.</div></>} />
        <div className="s-facts">
          <Fact label="Off Earth" value={`${c.population.offworld.toFixed(2)}M`} sub={c.space.spaceportCapacity > 0.05 ? `launch cost ${(c.space.launchCostIndex * 100).toFixed(0)}% of 2026${c.space.elevator ? ' · elevator' : ''}` : 'no spaceport yet'} />
          <Fact label="From the sea" value={`+${(c.land.reclaimed * 100).toFixed(1)}%`} sub={`floating ${(c.land.floating * 100).toFixed(1)}% @ ${pct(c.land.floatingCondition)} condition · subsea ${(c.land.subsea * 100).toFixed(1)}% @ ${pct(c.land.subseaCondition)}${c.land.aerial > 0 ? ` · stratosphere ${(c.land.aerial * 100).toFixed(2)}%` : ''}`} />
          <Fact label="Vertical / below ground" value={`${(c.land.vertical * 100).toFixed(1)}% / ${(c.land.underground * 100).toFixed(1)}%`} sub={`condition ${pct(c.land.verticalCondition)} / ${pct(c.land.undergroundCondition)}`} />
          <Fact label="Fusion" value={`${c.energy.sources.fusion.cap.toFixed(1)} GW`} sub={`nuclear ${c.energy.sources.nuclear.cap.toFixed(1)} · solar ${c.energy.sources.solar.cap.toFixed(0)} · wind ${c.energy.sources.wind.cap.toFixed(0)} GW`} />
          <Fact label="Milestones" value={`${achieved}/${MILESTONES.length}`} sub={w.frontier.era} />
        </div>
        <button className="s-link" onClick={() => set({ rightOpen: true, rightTab: 'frontier' })}>Open the milestone ladder →</button>
      </>)}

      <button className="s-primary-btn s-full" onClick={() => set({ panel: 'interventions' })}>Shape their future →</button>
    </aside>
  );
}

// ── Dock: perspective, layers, light, time ─────────────────────────────────
const CAMS: { m: CameraMode; icon: string; label: string }[] = [
  { m: 'orbit', icon: '◎', label: 'Orbit' }, { m: 'strategic', icon: '◇', label: 'Strategic' }, { m: 'city', icon: '⌂', label: 'City' }, { m: 'subsurface', icon: '↧', label: 'Below ground' }, { m: 'space', icon: '◌', label: 'Beyond Earth' }, { m: 'follow', icon: '➔', label: 'Follow' }, { m: 'cinematic', icon: '◠', label: 'Cinematic' },
];
const LAYERS: { o: OverlayMode; label: string }[] = [{ o: 'none', label: 'Natural' }, { o: 'energy', label: 'Energy' }, { o: 'adoption', label: 'Automation' }, { o: 'compute', label: 'Compute' }];
const LIGHTS: { l: LightingMode; label: string }[] = [{ l: 'cycle', label: 'Cycle' }, { l: 'day', label: 'Day' }, { l: 'dusk', label: 'Dusk' }, { l: 'night', label: 'Night' }];
const SPEEDS: { s: Speed; label: string }[] = [{ s: 1, label: '1×' }, { s: 5, label: '5×' }, { s: 20, label: '20×' }, { s: 100, label: '100×' }];

function Dock({ worldRef }: { worldRef: WRef }) {
  const cameraMode = useUI((s) => s.cameraMode);
  const overlay = useUI((s) => s.overlay);
  const lighting = useUI((s) => s.lighting);
  const speed = useUI((s) => s.speed);
  const setSpeed = useUI((s) => s.setSpeed);
  const set = useUI((s) => s.set);
  const vmTick = useUI((s) => s.vmTick);
  const selectedCiv = useUI((s) => s.selectedCiv);
  const info = useMemo(() => { const w = worldRef.current; return { year: Math.floor(w.startYear + w.tMonths / 12), budget: Math.round(w.observerBudget) }; }, [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="s-dock">
      <div className="s-dock-row">
        <span className="s-kicker">Perspective</span>
        <div className="s-seg">{CAMS.map((c) => <button key={c.m} className={`s-seg-btn ${cameraMode === c.m ? 'active' : ''}`} title={c.label} onClick={() => set({ cameraMode: c.m })}>{c.icon}</button>)}</div>
      </div>
      <div className="s-dock-row">
        <span className="s-kicker">Map layers</span>
        <div className="s-seg text">{LAYERS.map((l) => <button key={l.o} className={`s-seg-btn ${overlay === l.o ? 'active' : ''}`} onClick={() => set({ overlay: l.o })}>{l.label}</button>)}</div>
        <span className="s-kicker">Ask</span>
        <div className="s-seg text"><button className={`s-seg-btn ${useUI.getState().askMode === 'turning-points' ? 'active' : ''}`} onClick={() => useUI.getState().setAskMode('turning-points')} title="Stop the clock at turning points and ask">Turning points</button><button className={`s-seg-btn ${useUI.getState().askMode === 'never' ? 'active' : ''}`} onClick={() => useUI.getState().setAskMode('never')} title="Never ask; civilizations decide in character">Never</button></div>
        <span className="s-kicker">Light</span>
        <div className="s-seg text">{LIGHTS.map((l) => <button key={l.l} className={`s-seg-btn ${lighting === l.l ? 'active' : ''}`} onClick={() => set({ lighting: l.l })}>{l.label}</button>)}</div>
      </div>
      <div className="s-timeline">
        <button className={`s-play ${speed === 0 ? '' : 'running'}`} onClick={() => setSpeed(speed === 0 ? 1 : 0)} title="Play / pause (space)">{speed === 0 ? '▶' : '❚❚'}</button>
        <span className="s-kicker">Year</span><span className="s-year">{info.year}</span>
        <div className="s-seg text">{SPEEDS.map((s) => <button key={s.s} className={`s-seg-btn ${speed === s.s ? 'active' : ''}`} onClick={() => setSpeed(s.s)}>{s.label}</button>)}</div>
        <span className="s-influence" title="Observer intervention budget; no passive effect. Replenishes 6 points per simulated year.">◈ {info.budget}/100 <small>intervention</small></span>
      </div>
    </div>
  );
}

// ── Chronicle strip + ask box ───────────────────────────────────────────────
function ChronicleStrip({ worldRef }: { worldRef: WRef }) {
  const vmTick = useUI((s) => s.vmTick);
  const set = useUI((s) => s.set);
  const [q, setQ] = useState('');
  const events = useMemo(() => [...worldRef.current.chronicle].reverse().filter((e) => e.significance >= 2).slice(0, 3), [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = q.trim().length >= 4 ? parseWhatIf(q) : null;
  const ask = () => {
    if (!parsed || !parsed.ok) { set({ panel: 'futurelab' }); return; }
    engine.newScenario(`whatif-${Date.now()}`, parsed.delta, parsed.label);
    set({ panel: null, started: true }); setQ('');
  };
  return (
    <div className="s-strip">
      <div className="s-strip-events">
        <div className="s-kicker">World chronicle</div>
        <div className="s-events">
          {events.length === 0 && <div className="s-event"><div className="s-event-title">History, unfolding.</div><div className="s-muted">Press play. You set the conditions; they make the history.</div></div>}
          {events.map((e) => (
            <button key={e.id} className="s-event" onClick={() => set({ rightOpen: true, rightTab: 'chronicle', selectedEventId: e.id })}>
              <div className="s-event-year">{e.year}{e.civId ? ` · ${e.civId}` : ''}</div>
              <div className="s-event-title">{e.title}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="s-ask">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="Ask what if… (e.g. what if fusion works by 2045, what if the island runs out of land)" />
        <button className="s-primary-btn" onClick={ask}>{parsed?.ok ? `Run: ${parsed.label}` : 'Scenario Lab'}</button>
        {parsed && <div className="s-ask-hint">{parsed.ok ? parsed.explanation : 'Not understood yet. Open the Scenario Lab to build it by hand.'}</div>}
      </div>
    </div>
  );
}

// ── Decisions: the world stops and asks ─────────────────────────────────────
function DecisionModal({ worldRef }: { worldRef: WRef }) {
  const vmTick = useUI((s) => s.vmTick);
  const setSpeed = useUI((s) => s.setSpeed);
  const set = useUI((s) => s.set);
  const pending: PendingDecision | undefined = useMemo(() => worldRef.current.pendingDecisions.find((p) => !engine.dismissedDecisions.has(p.key)), [vmTick, worldRef]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<string | null>(null);
  if (!pending) return null;
  const w = worldRef.current;
  const civ = w.civs.find((c) => c.id === pending.civId)!;
  const yearsLeft = Math.max(0, (pending.deadline - w.tMonths) / 12);
  const siblings = w.pendingDecisions.filter((p) => p.defId === pending.defId && !engine.dismissedDecisions.has(p.key));
  const choose = (id: string | null, all = false) => { for (const p of all ? siblings : [pending]) engine.decide(p.key, id); setPicked(null); set({ selectedCiv: civ.id }); setSpeed(1); };
  const later = () => { engine.dismissDecision(pending.key); setSpeed(1); };
  return (
    <div className="s-decision-backdrop">
      <div className="s-decision">
        <div className="s-kicker"><span style={{ color: CIV_TINT[civ.id] }}>{CIV_GLYPH[civ.id]} {civ.name}</span> asks · {Math.floor(w.startYear + w.tMonths / 12)}</div>
        <div className="s-decision-title">{pending.title}</div>
        <p className="s-decision-q">{pending.question}</p>
        <div className="s-decision-options">
          {pending.options.map((o) => (
            <button key={o.id} className={`s-option ${picked === o.id ? 'active' : ''}`} onClick={() => setPicked(o.id)}>
              <div className="s-option-label">{o.label}</div>
              <div className="s-option-cons">{o.consequence}</div>
            </button>
          ))}
        </div>
        <div className="s-decision-actions">
          <button className="s-primary-btn" disabled={!picked} onClick={() => choose(picked)}>Decide</button>
          {siblings.length > 1 && <button className="s-primary-btn" disabled={!picked} onClick={() => choose(picked, true)} title="The same question is open for other civilizations">Decide for all {siblings.length}</button>}
          <button className="s-ghost-btn" onClick={() => choose(null)} title="The civilization chooses in character, by its traits">Let them decide</button>
          <button className="s-ghost-btn" onClick={later} title={`Resume without answering; they decide themselves in ${yearsLeft.toFixed(1)} years`}>Later ({yearsLeft.toFixed(1)} yrs)</button>
          <button className="s-ghost-btn" onClick={() => { useUI.getState().setAskMode('never'); choose(null); }} title="Never stop the clock again; every decision resolves in character">Stop asking</button>
        </div>
        <div className="s-muted">Decisions change policy, spending, research or the scenario itself, through the same channels the civilizations use. Everything after this point is a different history. Branch first (Parallel Worlds) if you want to compare.</div>
      </div>
    </div>
  );
}

export function Shell({ worldRef }: { worldRef: WRef }) {
  const hud = useUI((s) => s.hudVisible);
  // Keyboard: space play/pause, 1–4 speeds, H hide interface, N night, D day, C cycle, Esc closes panels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const st = useUI.getState();
      if (e.code === 'Space') { e.preventDefault(); st.setSpeed(st.speed === 0 ? 1 : 0); }
      else if (e.key === '1') st.setSpeed(1); else if (e.key === '2') st.setSpeed(5); else if (e.key === '3') st.setSpeed(20); else if (e.key === '4') st.setSpeed(100);
      else if (e.key === 'h' || e.key === 'H') st.set({ hudVisible: !st.hudVisible });
      else if (e.key === 'n' || e.key === 'N') st.set({ lighting: 'night' }); else if (e.key === 'd' || e.key === 'D') st.set({ lighting: 'day' }); else if (e.key === 'c' || e.key === 'C') st.set({ lighting: 'cycle' });
      else if (e.key === 'Escape') st.set({ panel: null, rightOpen: false });
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className={`s-shell ${hud ? '' : 'hidden'}`}>
      <TopNav />
      <Observatory worldRef={worldRef} />
      <StageTitle worldRef={worldRef} />
      <CivCard worldRef={worldRef} />
      <Dock worldRef={worldRef} />
      <ChronicleStrip worldRef={worldRef} />
      <DecisionModal worldRef={worldRef} />
    </div>
  );
}
