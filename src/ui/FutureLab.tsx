// ─────────────────────────────────────────────────────────────────────────────
// FUTURE LAB — scenario presets, scenario builder (labeled axes → structured
// parameters), and custom What-If text via the safe parser. Starts a new
// simulation from September 2026 under the chosen assumptions.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useUI } from '../state/store';
import { engine } from '../state/engine';
import { SCENARIO_PRESETS, BUILDER_AXES, parseWhatIf, mergeDeltas } from '../sim';
import type { ParamDelta } from '../sim';

type Mode = 'presets' | 'builder' | 'whatif';

export function FutureLab() {
  const set = useUI((s) => s.set);
  const [mode, setMode] = useState<Mode>('presets');
  const [axes, setAxes] = useState<number[]>(BUILDER_AXES.map((a) => a.defaultIndex));
  const [whatIfText, setWhatIfText] = useState('');
  const parsed = useMemo(() => (whatIfText.trim().length >= 4 ? parseWhatIf(whatIfText) : null), [whatIfText]);

  const builderDelta: ParamDelta = useMemo(
    () => mergeDeltas(...BUILDER_AXES.map((a, i) => a.options[axes[i]].delta)),
    [axes],
  );

  const launch = (scenarioId: string, delta: ParamDelta, label: string) => {
    engine.newScenario(scenarioId, delta, label);
    set({ panel: null, started: true, selectedEventId: null, selectedCharacter: null });
  };

  return (
    <div className="modal-backdrop" onClick={() => set({ panel: null })}>
      <div className="modal glass-panel futurelab" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="panel-title">Future Lab — choose the assumptions</span>
          <button className="ghost-btn" onClick={() => set({ panel: null })}>✕</button>
        </div>
        <div className="modal-modes">
          {(['presets', 'builder', 'whatif'] as Mode[]).map((m) => (
            <button key={m} className={`right-tab ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
              {m === 'presets' ? 'Presets' : m === 'builder' ? 'Scenario Builder' : 'Custom What-If'}
            </button>
          ))}
        </div>

        {mode === 'presets' && (
          <div className="preset-grid">
            {SCENARIO_PRESETS.map((p) => (
              <button key={p.id} className="preset-card" style={{ ['--accent' as any]: p.accent }} onClick={() => launch(p.id, p.delta, p.name)}>
                <span className="preset-name">{p.name}</span>
                <span className="preset-tagline">{p.tagline}</span>
                <span className="preset-desc">{p.description}</span>
                <span className="preset-go">Run this future →</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'builder' && (
          <div className="builder">
            {BUILDER_AXES.map((a, ai) => (
              <div key={a.id} className="axis-row">
                <span className="axis-label">{a.label}</span>
                <div className="axis-options">
                  {a.options.map((o, oi) => (
                    <button
                      key={oi}
                      className={`axis-opt ${axes[ai] === oi ? 'active' : ''}`}
                      onClick={() => setAxes((prev) => prev.map((v, i) => (i === ai ? oi : v)))}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button className="launch-btn" onClick={() => launch('custom', builderDelta, 'Custom scenario')}>
              Start simulation from September 2026 →
            </button>
          </div>
        )}

        {mode === 'whatif' && (
          <div className="whatif">
            <div className="whatif-hint">
              Describe an assumption in plain words. It is parsed into validated simulation parameters — never arbitrary code.
              Try: <i>“AI improves itself rapidly but the grid can’t keep up”</i>, <i>“fusion arrives early”</i>, <i>“a fragmented world with chip controls”</i>.
            </div>
            <textarea
              className="whatif-input"
              rows={3}
              placeholder="What if…"
              value={whatIfText}
              onChange={(e) => setWhatIfText(e.target.value)}
            />
            {parsed && (
              <div className={`whatif-result ${parsed.ok ? 'ok' : 'fail'}`}>
                {parsed.ok ? (
                  <>
                    <b>{parsed.label}</b>
                    <div>{parsed.explanation}</div>
                    <div className="whatif-params">{Object.entries(parsed.delta).map(([k, v]) => `${k} ×${(v as number).toFixed(2)}`).join(' · ') || 'baseline parameters'}</div>
                  </>
                ) : (
                  <div>{parsed.explanation}</div>
                )}
              </div>
            )}
            <button className="launch-btn" disabled={!parsed?.ok} onClick={() => parsed?.ok && launch('custom', parsed.delta, parsed.label)}>
              Start this counterfactual →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
