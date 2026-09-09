// ─────────────────────────────────────────────────────────────────────────────
// INTERVENTIONS — spend Influence on real actions: funding, build-outs,
// policy, diplomacy. Effects enter the simulation as structured state changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useUI } from '../state/store';
import { engine } from '../state/engine';
import { INTERVENTIONS, civDef, CIV_IDS } from '../sim';
import type { CivId, WorldState } from '../sim';

const CAT_LABEL: Record<string, string> = { research: 'Research', energy: 'Energy', industry: 'Industry', society: 'Society', geopolitics: 'Geopolitics' };

export function Interventions({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const set = useUI((s) => s.set);
  const selectedCiv = useUI((s) => s.selectedCiv);
  useUI((s) => s.vmTick);
  const [targetCiv, setTargetCiv] = useState<CivId>(selectedCiv);
  const [otherCiv, setOtherCiv] = useState<CivId>('ardan');
  const [message, setMessage] = useState('');

  const budget = () => Math.round(worldRef.current.observerBudget);

  const run = (id: string, scope: string) => {
    const r = engine.intervene(id, scope === 'civ' ? targetCiv : null, scope === 'relation' ? otherCiv : null);
    setMessage(r.ok ? '✓ Intervention applied — consequences will unfold in the simulation.' : `✕ ${r.reason ?? 'Failed'}`);
  };

  return (
    <div className="modal-backdrop" onClick={() => set({ panel: null })}>
      <div className="modal glass-panel interventions" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="panel-title">Interventions</span>
          <button className="ghost-btn" onClick={() => set({ panel: null })}>✕</button>
        </div>
        <div className="iv-budget-note"><b>Observer budget {budget()}/100.</b> It is outside the simulated civilization and has no passive effect. It changes history only when you spend it here. +6 points per simulated year.</div>
        <div className="target-row">
          <span className="axis-label">Target</span>
          <div className="axis-options">
            {CIV_IDS.map((id) => (
              <button key={id} className={`axis-opt ${targetCiv === id ? 'active' : ''}`} onClick={() => setTargetCiv(id)}>{civDef(id).name}</button>
            ))}
          </div>
          <span className="axis-label" style={{ marginLeft: 12 }}>With</span>
          <div className="axis-options">
            {CIV_IDS.filter((id) => id !== targetCiv).map((id) => (
              <button key={id} className={`axis-opt ${otherCiv === id ? 'active' : ''}`} onClick={() => setOtherCiv(id)}>{civDef(id).name}</button>
            ))}
          </div>
        </div>
        {message && <div className="iv-message">{message}</div>}
        <div className="iv-list">
          {Object.entries(CAT_LABEL).map(([cat, label]) => (
            <div key={cat}>
              <div className="sub-head">{label}</div>
              {INTERVENTIONS.filter((iv) => iv.category === cat).map((iv) => {
                const afford = budget() >= iv.cost;
                return (
                  <div key={iv.id} className={`iv-item ${afford ? '' : 'disabled'}`}>
                    <div className="iv-info">
                      <div className="iv-label">{iv.label} <span className="iv-cost">{iv.cost} ◈ · {iv.scope} · budget {budget()}/100</span></div>
                      <div className="iv-desc">{iv.description}</div>
                    </div>
                    <button className="iv-btn" disabled={!afford} onClick={() => run(iv.id, iv.scope)}>Apply</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
