// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL — Chronicle (history feed + Why Did This Happen), Technology
// inspector (pipeline, Research Velocity, calibration), Characters (+ Talk).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useUI } from '../state/store';
import { MILESTONES, ERA_LABELS } from '../sim';
import {
  TECH_IDS, TECH_DEFS, DOMAIN_META, researchVelocity, whyDidThisHappen,
  CIV_IDS, fmtHorizon, taskHorizonHrs,
} from '../sim';
import type { WorldState, TechId } from '../sim';
import { Bar, pct, signed, CATEGORY_COLOR, CIV_TINT } from './shared';
import { TOPICS, characterReply, type TopicId } from './dialogue';

// ── Chronicle ────────────────────────────────────────────────────────────────
function ChronicleTab({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const vmTick = useUI((s) => s.vmTick);
  const selectedEventId = useUI((s) => s.selectedEventId);
  const set = useUI((s) => s.set);
  const chronicleFilter = useUI((s) => s.chronicleFilter);
  // A century of simulation produces thousands of events; by default only the ones that changed the story are shown.
  const events = useMemo(() => [...worldRef.current.chronicle].reverse().filter((e) => chronicleFilter === 'all' || e.significance >= 2), [vmTick, worldRef, chronicleFilter]);
  const selected = selectedEventId ? worldRef.current.chronicle.find((e) => e.id === selectedEventId) : null;

  if (selected) {
    const why = whyDidThisHappen(selected);
    return (
      <div className="tab-scroll">
        <button className="ghost-btn back" onClick={() => set({ selectedEventId: null })}>← Chronicle</button>
        <div className="why-block">
          <div className="why-kicker">Why did this happen?</div>
          <div className="why-title">{why.title}</div>
          <div className="why-date">{selected.year.toFixed(0)} · {selected.category}</div>
          <p className="why-body">{selected.body}</p>
          <div className="sub-head">Causal drivers</div>
          {why.causes.map((c, i) => (
            <div key={i} className="cause-row">
              <span className="cause-factor">{c.factor}</span>
              <Bar value={c.weight} color="#6E7BFF" />
              <span className="metric-val">{pct(c.weight)}</span>
            </div>
          ))}
          {why.counterforces.length > 0 && (
            <>
              <div className="sub-head">Counterforces</div>
              {why.counterforces.map((c, i) => (
                <div key={i} className="cause-row">
                  <span className="cause-factor">{c.factor}</span>
                  <Bar value={c.weight} color="#8B93A3" />
                  <span className="metric-val">{pct(c.weight)}</span>
                </div>
              ))}
            </>
          )}
          <div className="why-confidence">Attribution confidence: {why.confidence}. Rendered from the simulation’s machine-readable causal record — not generated prose.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-scroll">
      <div className="chron-filter">
        <button className={`bottom-btn ${chronicleFilter === 'major' ? 'active' : ''}`} onClick={() => set({ chronicleFilter: 'major' })}>Major</button>
        <button className={`bottom-btn ${chronicleFilter === 'all' ? 'active' : ''}`} onClick={() => set({ chronicleFilter: 'all' })}>All ({worldRef.current.chronicle.length})</button>
      </div>
      {events.map((ev) => (
        <button key={ev.id} className="chron-item" onClick={() => set({ selectedEventId: ev.id })}>
          <span className="chron-year">{ev.year.toFixed(0)}</span>
          <span className="chron-dot" style={{ background: CATEGORY_COLOR[ev.category] ?? '#8B93A3' }} />
          <span className="chron-text">
            <span className="chron-title">{ev.title}</span>
            <span className="chron-cat">{ev.category}{ev.significance >= 3 ? ' · major' : ''}</span>
          </span>
          <span className="chron-why">why →</span>
        </button>
      ))}
      {events.length === 0 && <div className="empty-note">History has not happened yet. Unpause time.</div>}
    </div>
  );
}

// ── Technology ───────────────────────────────────────────────────────────────
const PHASE_ORDER = ['science', 'prototype', 'engineering', 'deployment', 'diffusion', 'mature'];

function TechInspector({ worldRef, techId }: { worldRef: React.MutableRefObject<WorldState>; techId: TechId }) {
  const vmTick = useUI((s) => s.vmTick);
  const vm = useMemo(() => {
    const w = worldRef.current;
    const t = w.techs[techId];
    const def = TECH_DEFS[techId];
    const v = researchVelocity(w, techId);
    const horizon = techId === 'ai_agents' || techId === 'ai_models' ? fmtHorizon(taskHorizonHrs(w.techs.ai_agents.cap)) : null;
    const velSeries = w.metrics.map((m) => m.aiCap);
    const programs = w.researchPrograms.filter((p) => p.techId === techId && !['failed','cancelled'].includes(p.status)).slice(-6);
    const inventions = w.inventions.filter((i) => i.techId === techId).slice(-6);
    return { t, def, v, horizon, velSeries, programs, inventions };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vmTick, techId, worldRef]);
  const { t, def, v } = vm;

  const phaseIdx = PHASE_ORDER.indexOf(t.phase);
  return (
    <div className="tech-inspector">
      <div className="tech-head">
        <span className="tech-name">{def.name}</span>
        <span className={`velocity-badge state-${v.state}`}>{v.state}</span>
      </div>
      <div className="tech-sub">Paradigm {t.paradigm} · capability {t.cap.toFixed(2)}× 2026 · asymptote {t.paradigmCap.toFixed(1)}×</div>
      {vm.horizon && <div className="tech-sub">Measured agent benchmark: {vm.horizon}</div>}

      <div className="sub-head">Pipeline</div>
      <div className="pipeline">
        {v.pipeline.map((p) => (
          <div key={p.stage} className={`pipe-stage ${PHASE_ORDER.indexOf(p.stage) <= phaseIdx ? 'reached' : ''} ${p.stage === t.phase ? 'current' : ''}`}>
            <span className="pipe-dot" />
            <span className="pipe-label">{p.stage}</span>
          </div>
        ))}
      </div>

      <div className="sub-head">Research velocity — {signed(v.growthPctPerYear)}%/yr</div>
      <div className="metric-row"><span className="metric-label">Headroom</span><Bar value={v.headroomPct / 100} color="#6E7BFF" /><span className="metric-val">{v.headroomPct.toFixed(0)}%</span></div>
      <div className="metric-row"><span className="metric-label">Maturity</span><Bar value={t.maturity} color="#4FC3F7" /><span className="metric-val">{pct(t.maturity)}</span></div>
      <div className="metric-row"><span className="metric-label">Reliability</span><Bar value={t.reliability} color="#4caf50" /><span className="metric-val">{pct(t.reliability)}</span></div>
      <div className="metric-row"><span className="metric-label">Unit cost</span><span className="metric-val">{t.cost.toFixed(2)}× 2026</span></div>
      <div className="metric-row"><span className="metric-label">Mfg capacity</span><span className="metric-val">{t.mfg.toFixed(2)}× 2026</span></div>

      {v.accelerators.length > 0 && (
        <>
          <div className="sub-head">Accelerators</div>
          {v.accelerators.map((a, i) => <div key={i} className="factor-line accel">▲ {a}</div>)}
        </>
      )}
      {v.constraints.length > 0 && (
        <>
          <div className="sub-head">Constraints</div>
          {v.constraints.map((c, i) => <div key={i} className="factor-line constr">▼ {c}</div>)}
        </>
      )}
      <div className="bottleneck-line">Dominant bottleneck: <b>{t.bottleneck}</b></div>

      <div className="sub-head">Research programs &amp; inventions</div>
      {vm.programs.length === 0 && vm.inventions.length === 0 && <div className="uncertainty-note">No major program has yet produced a new paradigm in this domain.</div>}
      {vm.programs.map((p) => (
        <div key={p.id} className="priority-note">{p.title} · {p.status} · {pct(Math.min(1, p.status === 'active' ? p.progress : p.maturity))}</div>
      ))}
      {vm.inventions.map((i) => (
        <div key={i.id} className="factor-line accel">◆ {i.name} · {i.status}</div>
      ))}

      <div className="sub-head">Adoption by civilization</div>
      {CIV_IDS.map((id) => (
        <div key={id} className="metric-row">
          <span className="metric-label" style={{ color: CIV_TINT[id] }}>{id}</span>
          <Bar value={t.adoption[id].penetration} color={CIV_TINT[id]} />
          <span className="metric-val">{pct(t.adoption[id].penetration)}</span>
        </div>
      ))}
      <div className="uncertainty-note">Forecast confidence: {v.confidence} (σ {pct(t.uncertainty)}). {v.uncertaintyNote}</div>

      {v.calibration.length > 0 && (
        <>
          <div className="sub-head">Calibration sources</div>
          {v.calibration.map((c, i) => <div key={i} className="calib-line">{c}</div>)}
        </>
      )}
    </div>
  );
}

function TechnologyTab({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const selectedTech = useUI((s) => s.selectedTech);
  const set = useUI((s) => s.set);
  const domains = Object.entries(DOMAIN_META);
  return (
    <div className="tab-scroll">
      <div className="tech-list">
        {domains.map(([domain, meta]) => (
          <div key={domain} className="tech-domain">
            <div className="domain-label" style={{ color: meta.color }}>{meta.label}</div>
            {TECH_IDS.filter((id) => TECH_DEFS[id].domain === domain).map((id) => (
              <button key={id} className={`tech-item ${id === selectedTech ? 'active' : ''}`} onClick={() => set({ selectedTech: id })}>
                {TECH_DEFS[id].name}
              </button>
            ))}
          </div>
        ))}
      </div>
      <TechInspector worldRef={worldRef} techId={selectedTech} />
    </div>
  );
}

// ── Characters ───────────────────────────────────────────────────────────────
function CharacterView({ worldRef, charId }: { worldRef: React.MutableRefObject<WorldState>; charId: string }) {
  const set = useUI((s) => s.set);
  const vmTick = useUI((s) => s.vmTick);
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const c = worldRef.current.characters.find((x) => x.id === charId);
  // reset conversation when world identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const engineVersion = useUI((s) => s.engineVersion);
  useMemo(() => setLog([]), [engineVersion]);
  if (!c) return null;

  return (
    <div>
      <button className="ghost-btn back" onClick={() => set({ selectedCharacter: null })}>← Characters</button>
      <div className="char-head">
        <div className="char-name">{c.name}</div>
        <div className="char-role">{c.role} · {c.civId} · age {Math.floor(c.age)}</div>
        <div className="char-mood">mood {c.mood >= 0 ? '+' : ''}{c.mood.toFixed(2)} · prominence {pct(c.prominence)}</div>
      </div>
      <div className="sub-head">Talk</div>
      <div className="topic-grid">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            className="topic-btn"
            onClick={() => {
              const a = characterReply(worldRef.current, c, t.id as TopicId);
              setLog((l) => [...l, { q: t.label, a }]);
              void vmTick;
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="chat-log">
        {log.map((m, i) => (
          <div key={i} className="chat-pair">
            <div className="chat-q">{m.q}</div>
            <div className="chat-a">{m.a}</div>
          </div>
        ))}
      </div>
      <div className="sub-head">History</div>
      {c.history.slice(-6).reverse().map((h, i) => (
        <div key={i} className="char-history-line">{h.text}</div>
      ))}
      {c.beliefs.length > 0 && (
        <>
          <div className="sub-head">Beliefs</div>
          {c.beliefs.map((b, i) => <div key={i} className="char-belief">“{b}”</div>)}
        </>
      )}
    </div>
  );
}

function CharactersTab({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const vmTick = useUI((s) => s.vmTick);
  const selectedCharacter = useUI((s) => s.selectedCharacter);
  const set = useUI((s) => s.set);
  const chars = [...worldRef.current.characters]
    .sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || b.prominence - a.prominence || (b.retiredAt ?? -1) - (a.retiredAt ?? -1))
    .slice(0, 50);
  void vmTick;
  if (selectedCharacter) return <div className="tab-scroll"><CharacterView worldRef={worldRef} charId={selectedCharacter} /></div>;
  return (
    <div className="tab-scroll">
      {chars.map((c) => (
        <button key={c.id} className="char-item" onClick={() => set({ selectedCharacter: c.id })}>
          <span className="char-avatar" style={{ background: CIV_TINT[c.civId] }}>{c.name.split(' ').map((x) => x[0]).join('')}</span>
          <span className="char-meta">
            <span className="char-item-name">{c.name}</span>
            <span className="char-item-role">{c.role} · {c.civId}{c.active === false ? ' · deceased' : c.retiredAt != null ? ' · retired' : ''}</span>
          </span>
          <span className={`char-mood-dot ${c.mood > 0.1 ? 'good' : c.mood > -0.3 ? 'warn' : 'bad'}`} />
        </button>
      ))}
    </div>
  );
}

// ── Panel shell ──────────────────────────────────────────────────────────────
function FrontierTab({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const vmTick = useUI((s) => s.vmTick);
  const w = worldRef.current;
  const vm = useMemo(() => {
    const fr = w.frontier;
    const r = w.resources;
    return {
      fr, r,
      readiness: w.civs.map((c) => ({ id: c.id, name: c.name, v: c.frontierReadiness, land: c.land.pressure, reclaimed: c.land.reclaimed, floating: c.land.floating, subsea: c.land.subsea, aerial: c.land.aerial, offworld: c.population.offworld, le: c.population.lifeExpectancy })),
      byEra: ([1, 2, 3] as const).map((era) => ({ era, label: ERA_LABELS[era], items: MILESTONES.filter((m) => m.era === era).map((m) => ({ def: m, st: fr.milestones.find((x) => x.id === m.id)! })) })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vmTick, worldRef]);
  const tone = (v: number) => (v >= 0.6 ? 'good' : v >= 0.45 ? 'warn' : 'bad');
  return (
    <div className="tab-scroll">
      <div className="frontier-head">
        <div className="frontier-k">K = {vm.fr.kardashev.toFixed(3)} <span className="muted">· {vm.fr.energyCaptureTW.toFixed(0)} TW captured</span></div>
        <div className="frontier-era">{vm.fr.era}</div>
        <div className={`frontier-traj traj-${vm.fr.trajectory}`}>{vm.fr.trajectory.replace('_', ' ')}</div>
        <p className="why-body">{vm.fr.trajectoryNote}</p>
      </div>
      <div className="sub-head">Lived outcomes · independent of expansion</div>
      {([['Material security', vm.fr.outcome.materialSecurity], ['Human development', vm.fr.outcome.humanDevelopment], ['Institutions', vm.fr.outcome.institutionalHealth], ['Ecological safety', vm.fr.outcome.ecologicalSafety], ['Distribution', vm.fr.outcome.distribution], ['Resilience', vm.fr.outcome.resilience]] as Array<[string, number]>).map(([label, v]) => (
        <div key={label} className="cause-row"><span className="cause-factor">{label}</span><Bar value={v} color={v >= 0.7 ? '#3fae6a' : v >= 0.5 ? '#d9a13b' : '#d94b3b'} /><span className={`metric-val tone-${tone(v)}`}>{Math.round(v * 100)}</span></div>
      ))}
      <div className="frontier-line muted">Broad outcome {Math.round(vm.fr.outcome.broadFlourishing * 100)}/100 · development form: {vm.fr.developmentForm}. Neither Kardashev level nor habitation domain is counted as wellbeing.</div>
      <div className="sub-head">Frontier readiness</div>
      <p className="muted small">Frontier research, spaceports, sea reclamation and the milestone programs only run where a civilization is stable, solvent, powered, fed and housed. No preset hands this out.</p>
      {vm.readiness.map((c) => (
        <div key={c.id} className="cause-row">
          <span className="cause-factor" style={{ color: CIV_TINT[c.id] }}>{c.name}</span>
          <Bar value={c.v} color={c.v >= 0.6 ? '#3fae6a' : c.v >= 0.45 ? '#d9a13b' : '#d94b3b'} />
          <span className={`metric-val tone-${tone(c.v)}`}>{pct(c.v)}</span>
        </div>
      ))}
      <div className="sub-head">Land and sea</div>
      {vm.readiness.map((c) => (
        <div key={c.id} className="frontier-line">
          <span style={{ color: CIV_TINT[c.id] }}>{c.name}</span>: {pct(c.land)} of usable land committed
          {c.reclaimed > 0.0005 ? ` · +${(c.reclaimed * 100).toFixed(1)}% reclaimed from the sea` : ''}
          {c.floating > 0.0005 ? ` · floating districts ${(c.floating * 100).toFixed(1)}% of housing` : ''}
          {c.subsea > 0.0005 ? ` · under the sea ${(c.subsea * 100).toFixed(1)}%` : ''}
          {c.aerial > 0.0002 ? ` · stratosphere ${(c.aerial * 100).toFixed(2)}%` : ''}
          {c.offworld > 0.005 ? ` · ${c.offworld.toFixed(2)}M off Earth` : ''}
        </div>
      ))}
      <div className="frontier-line muted">Sea level +{(w.env.seaLevelM).toFixed(2)} m · fossil reserves {Math.max(0, vm.r.fossilReserves).toFixed(0)} yr · mineral cost {vm.r.mineralCostIndex.toFixed(2)}× · recycling {pct(vm.r.recyclingRate)} · seabed {pct(vm.r.mineralSeabedInflow)} · space {pct(vm.r.mineralSpaceInflow)} of 2026 demand</div>
      {vm.byEra.map((e) => (
        <div key={e.era}>
          <div className="sub-head">Era {e.era} · {e.label}</div>
          {e.items.map(({ def, st }) => (
            <div key={def.id} className={`milestone ms-${st.status}`}>
              <div className="ms-row">
                <span className="ms-dot" />
                <span className="ms-name">{def.name}</span>
                <span className="ms-status">{st.status === 'achieved' ? `${Math.floor(2026 + (st.achievedAt ?? 0) / 12)}` : st.status === 'in_progress' ? `${pct(st.progress)}` : st.status === 'available' ? 'ready to fund' : def.illustrativeYear <= 2100 ? `illustrative ~${def.illustrativeYear}` : 'exploratory'}</span>
              </div>
              {st.status === 'in_progress' && <Bar value={st.progress} color="#f6c177" />}
              <div className="ms-summary">{def.summary}</div>
              {st.status !== 'achieved' && st.blockers.length > 0 && (
                <div className="ms-blockers">Blocked by: {st.blockers.join('; ')}</div>
              )}
              {st.status === 'achieved' && <div className="ms-effect">{def.effect}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function RightPanel({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const rightTab = useUI((s) => s.rightTab);
  const rightOpen = useUI((s) => s.rightOpen);
  const set = useUI((s) => s.set);

  if (!rightOpen) return null;

  return (
    <div className="right-panel glass-panel s-drawer">
      <div className="panel-head">
        <div className="right-tabs">
          {(['chronicle', 'technology', 'frontier', 'characters'] as const).map((t) => (
            <button key={t} className={`right-tab ${rightTab === t ? 'active' : ''}`} onClick={() => set({ rightTab: t })}>
              {t === 'chronicle' ? 'Chronicle' : t === 'technology' ? 'Technology' : t === 'frontier' ? 'Frontier' : 'Characters'}
            </button>
          ))}
        </div>
        <button className="ghost-btn" onClick={() => set({ rightOpen: false })}>◂</button>
      </div>
      {rightTab === 'chronicle' && <ChronicleTab worldRef={worldRef} />}
      {rightTab === 'technology' && <TechnologyTab worldRef={worldRef} />}
      {rightTab === 'frontier' && <FrontierTab worldRef={worldRef} />}
      {rightTab === 'characters' && <CharactersTab worldRef={worldRef} />}
    </div>
  );
}
