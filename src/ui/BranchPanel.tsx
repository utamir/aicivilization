// ─────────────────────────────────────────────────────────────────────────────
// PARALLEL WORLDS — branch the timeline at the current date with one changed
// assumption, run both worlds in lockstep, compare them side by side.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useUI } from '../state/store';
import { engine } from '../state/engine';
import { parseWhatIf, compareWorlds } from '../sim';

export function BranchPanel() {
  const set = useUI((s) => s.set);
  const hasBranch = useUI((s) => s.hasBranch);
  const vmTick = useUI((s) => s.vmTick);
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim().length >= 4 ? parseWhatIf(text) : null), [text]);

  const compare = useMemo(() => {
    if (!hasBranch || !engine.worldB) return null;
    return compareWorlds(engine.worldA, engine.worldB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBranch, vmTick]);

  const active = engine.activeWorld;

  return (
    <div className="modal-backdrop" onClick={() => set({ panel: null })}>
      <div className="modal glass-panel branch" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="panel-title">Parallel Worlds</span>
          <button className="ghost-btn" onClick={() => set({ panel: null })}>✕</button>
        </div>

        {!hasBranch ? (
          <div className="branch-create">
            <div className="whatif-hint">
              Split the timeline <b>at the current date</b>. World A continues unchanged; World B gets one changed
              assumption. Both run from identical state with the same random seed — any divergence is attributable.
            </div>
            <textarea className="whatif-input" rows={2} placeholder="What changes in World B? e.g. “AI research plateaus” or “cheap clean energy”" value={text} onChange={(e) => setText(e.target.value)} />
            {parsed && (
              <div className={`whatif-result ${parsed.ok ? 'ok' : 'fail'}`}>
                {parsed.ok ? <><b>World B: {parsed.label}</b><div>{parsed.explanation}</div></> : parsed.explanation}
              </div>
            )}
            <button
              className="launch-btn"
              disabled={!parsed?.ok}
              onClick={() => { if (parsed?.ok) { engine.branch(parsed.label, parsed.delta); set({ panel: null }); } }}
            >
              Create parallel world →
            </button>
          </div>
        ) : (
          <div className="branch-compare">
            <div className="branch-switch">
              {(['A', 'B'] as const).map((w) => (
                <button key={w} className={`axis-opt ${active === w ? 'active' : ''}`} onClick={() => engine.setActiveWorld(w)}>
                  World {w} {w === 'B' ? `— ${engine.branchNote}` : '— unchanged'}
                </button>
              ))}
            </div>
            {compare && (
              <div className="compare-table">
                <div className="compare-row head">
                  <span>Metric</span><span>World A</span><span>World B</span><span>Δ</span>
                </div>
                {compare.map((r) => {
                  const delta = r.b - r.a;
                  const rel = r.a !== 0 ? delta / Math.abs(r.a) : 0;
                  const tone = r.betterWhenHigher === null ? '' : Math.abs(rel) < 0.01 ? '' : (delta > 0) === r.betterWhenHigher ? 'good' : 'bad';
                  return (
                    <div key={r.label} className="compare-row">
                      <span>{r.label}</span>
                      <span className="num">{r.a.toFixed(2)}{r.unit}</span>
                      <span className="num">{r.b.toFixed(2)}{r.unit}</span>
                      <span className={`num tone-${tone || 'warn'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="branch-actions">
              <button className="iv-btn" onClick={() => { engine.closeBranch(active); }}>Keep viewing world, discard other</button>
              <button className="ghost-btn" onClick={() => engine.closeBranch(active === 'A' ? 'A' : 'B')}>Close branch</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
