// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE REGISTRY — the calibration layer, browsable. Each entry carries
// provenance; provisional entries are marked. Research data is distinct from
// gameplay tuning (gameplay scaling lives in the tech definitions, shown here).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useUI } from '../state/store';
import { EVIDENCE, TECH_DEFS, TECH_IDS } from '../sim';

const CONF_COLOR: Record<string, string> = { high: '#4caf50', medium: '#ffc107', provisional: '#f44336' };

export function EvidencePanel() {
  const set = useUI((s) => s.set);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="modal-backdrop" onClick={() => set({ panel: null })}>
      <div className="modal glass-panel evidence" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span className="panel-title">Evidence Registry — calibration provenance</span>
          <button className="ghost-btn" onClick={() => set({ panel: null })}>✕</button>
        </div>
        <div className="tab-scroll" style={{ maxHeight: '62vh' }}>
          {EVIDENCE.map((e) => (
            <div key={e.id} className="ev-item">
              <button className="ev-head" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                <span className="ev-domain">{e.domain}</span>
                <span className="ev-metric">{e.metric}</span>
                <span className="ev-value">{e.value} {e.unit}</span>
                <span className="ev-conf" style={{ color: CONF_COLOR[e.confidence] }}>{e.confidence}</span>
              </button>
              {openId === e.id && (
                <div className="ev-detail">
                  <div><b>{e.sourceTitle}</b> ({e.sourceType}, published {e.publicationDate}, retrieved {e.retrievalDate})</div>
                  <div className="ev-url">{e.sourceUrl}</div>
                  <div>Observation: {e.observationPeriod} · {e.geography} · model family: {e.modelFamily}</div>
                  {e.fitParameters && <div>Fit: {e.fitParameters}</div>}
                  <div>Valid extrapolation window: {e.validExtrapolationWindow}</div>
                  <div>Known constraints: {e.knownConstraints}</div>
                  {e.notes && <div className="ev-notes">{e.notes}</div>}
                </div>
              )}
            </div>
          ))}
          <div className="sub-head" style={{ marginTop: 14 }}>Gameplay tuning (not empirical)</div>
          <div className="tuning-note">
            Scaling constants used purely for playability — kept separate from research data:
            {TECH_IDS.map((id) => (
              <span key={id} className="tuning-chip">{TECH_DEFS[id].name} ×{TECH_DEFS[id].gameplayScaling}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
