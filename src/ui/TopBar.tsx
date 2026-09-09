// ─────────────────────────────────────────────────────────────────────────────
// TOP BAR — date, scenario, time controls, influence, panel buttons.
// ─────────────────────────────────────────────────────────────────────────────
import { useUI } from '../state/store';
import type { Speed } from '../state/engine';
import { dateLabel } from '../sim';
import type { WorldState } from '../sim';
import { useMemo } from 'react';

const SPEEDS: { s: Speed; label: string }[] = [
  { s: 0, label: '❚❚' },
  { s: 1, label: '1×' },
  { s: 5, label: '5×' },
  { s: 20, label: '20×' },
  { s: 100, label: '100×' },
];

export function TopBar({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const speed = useUI((s) => s.speed);
  const setSpeed = useUI((s) => s.setSpeed);
  const vmTick = useUI((s) => s.vmTick);
  const panel = useUI((s) => s.panel);
  const set = useUI((s) => s.set);
  const hasBranch = useUI((s) => s.hasBranch);

  const vm = useMemo(() => {
    const w = worldRef.current;
    if (!w) return null;
    return {
      date: dateLabel(w),
      scenario: w.scenarioLabel,
      budget: Math.round(w.observerBudget),
      year: 2026 + w.tMonths / 12,
      kardashev: w.frontier.kardashev,
      era: w.frontier.era,
      trajectory: w.frontier.trajectory.replace('_', ' '),
      trajectoryNote: w.frontier.trajectoryNote,
      readiness: w.civs.reduce((a, c) => a + c.frontierReadiness, 0) / w.civs.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vmTick, worldRef]);

  if (!vm) return null;

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <span className="brand-what">WHAT IF?</span>
          <span className="brand-sub">CIVILIZATION LAB</span>
        </div>
        <div className="scenario-chip" onClick={() => set({ panel: panel === 'futurelab' ? null : 'futurelab' })} title="Open Future Lab">
          {vm.scenario}
        </div>
      </div>

      <div className="topbar-center">
        <div className="date-display">{vm.date}</div>
        <div className="speed-controls">
          {SPEEDS.map(({ s, label }) => (
            <button key={s} className={`speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)} title={s === 0 ? 'Pause' : `Speed ${label}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="topbar-right">
        <div className={`kardashev-chip traj-${vm.trajectory.replace(' ', '-')}`} title={`${vm.era}\n${vm.trajectoryNote}\nFrontier readiness (mean) ${(vm.readiness * 100).toFixed(0)}%`} onClick={() => set({ rightTab: 'frontier', rightOpen: true })}>
          <span className="k-label">K</span>
          <span className="k-value">{vm.kardashev.toFixed(3)}</span>
          <span className="k-bar"><span className="k-fill" style={{ width: `${Math.min(100, Math.max(0, (vm.kardashev - 0.7) / 0.3 * 100))}%` }} /></span>
          <span className="k-traj">{vm.trajectory}</span>
        </div>
        <div className="influence-chip" title="Observer intervention budget. It has no passive effect on the simulation; only explicit interventions spend it. Replenishes by 6 points per simulated year.">
          ◈ {vm.budget}/100 <span className="chip-label">intervention budget</span>
        </div>
        <button className={`top-btn ${panel === 'futurelab' ? 'active' : ''}`} onClick={() => set({ panel: panel === 'futurelab' ? null : 'futurelab' })}>Future Lab</button>
        <button className={`top-btn ${panel === 'interventions' ? 'active' : ''}`} onClick={() => set({ panel: panel === 'interventions' ? null : 'interventions' })}>Intervene</button>
        <button className={`top-btn ${panel === 'branch' ? 'active' : ''} ${hasBranch ? 'has-branch' : ''}`} onClick={() => set({ panel: panel === 'branch' ? null : 'branch' })}>
          {hasBranch ? 'A ⇄ B' : 'Branch'}
        </button>
        <button className={`top-btn ${panel === 'evidence' ? 'active' : ''}`} onClick={() => set({ panel: panel === 'evidence' ? null : 'evidence' })}>Evidence</button>
      </div>
    </div>
  );
}
