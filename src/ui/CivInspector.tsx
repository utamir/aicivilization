// ─────────────────────────────────────────────────────────────────────────────
// CIV INSPECTOR — left panel. Per-civilization state with metric history
// sparklines, energy mix, and current strategic priority.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useUI } from '../state/store';
import { CIV_IDS, civDef } from '../sim';
import type { WorldState, CivId } from '../sim';
import { Stat, Bar, Sparkline, pct, CIV_TINT } from './shared';

const MIX_ORDER = ['fossil', 'nuclear', 'hydro', 'wind', 'solar'] as const;
const MIX_COLORS: Record<string, string> = { fossil: '#6b6157', nuclear: '#e8e3d5', hydro: '#4a90c2', wind: '#9fd4c8', solar: '#e8c552' };

export function CivInspector({ worldRef }: { worldRef: React.MutableRefObject<WorldState> }) {
  const selectedCiv = useUI((s) => s.selectedCiv);
  const set = useUI((s) => s.set);
  const leftOpen = useUI((s) => s.leftOpen);
  const vmTick = useUI((s) => s.vmTick);

  const vm = useMemo(() => {
    const w = worldRef.current;
    const civ = w.civs.find((c) => c.id === selectedCiv)!;
    const hist = w.metrics;
    const series = (fn: (m: (typeof w.metrics)[0]) => number) => hist.map(fn);
    const totalGen = MIX_ORDER.reduce((a, k) => a + civ.energy.sources[k].cap * ({ fossil: 0.55, nuclear: 0.9, hydro: 0.45, wind: 0.35, solar: 0.22 } as any)[k], 0) || 1;
    return {
      civ,
      def: civDef(selectedCiv),
      outputS: series((m) => m.output[selectedCiv]),
      unempS: series((m) => m.unemployment[selectedCiv]),
      marginS: series((m) => m.energyMargin[selectedCiv]),
      priceS: series((m) => m.energyPrice[selectedCiv]),
      popS: series((m) => m.population[selectedCiv]),
      foodS: series((m) => m.foodSecurity[selectedCiv] ?? 1),
      giniS: series((m) => m.gini[selectedCiv]),
      stabS: series((m) => m.stability[selectedCiv]),
      outGrowth: (() => { const o = series((m) => m.output[selectedCiv]); return o.length > 2 ? (o[o.length - 1] / Math.max(0.01, o[o.length - 2]) - 1) : 0; })(),
      mix: MIX_ORDER.map((k) => ({ k, share: (civ.energy.sources[k].cap * ({ fossil: 0.55, nuclear: 0.9, hydro: 0.45, wind: 0.35, solar: 0.22 } as any)[k]) / totalGen })),
      projects: w.projects.filter((p) => p.civId === selectedCiv && p.status !== 'operational' && p.status !== 'cancelled'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vmTick, selectedCiv, worldRef]);

  if (!leftOpen) {
    return (
      <button className="edge-tab left" onClick={() => set({ leftOpen: true })}>◂</button>
    );
  }

  const { civ, def } = vm;
  const marginTone = civ.energy.marginPct > 9 ? 'good' : civ.energy.marginPct > 3 ? 'warn' : 'bad';

  return (
    <div className="left-panel glass-panel">
      <div className="panel-head">
        <span className="panel-title">Civilizations</span>
        <button className="ghost-btn" onClick={() => set({ leftOpen: false })}>▸</button>
      </div>
      <div className="civ-tabs">
        {CIV_IDS.map((id: CivId) => (
          <button key={id} className={`civ-tab ${id === selectedCiv ? 'active' : ''}`} style={{ ['--tint' as any]: CIV_TINT[id] }} onClick={() => set({ selectedCiv: id })}>
            {civDef(id).name}
          </button>
        ))}
      </div>
      <div className="civ-scroll">
        <div className="civ-tagline">{def.epithet}</div>

        <div className="stat-grid">
          <Stat label="Population" value={`${civ.population.total.toFixed(1)}M`} sub={`median age ${civ.population.medianAge.toFixed(0)}`} />
          <Stat label="Output index" value={civ.economy.output.toFixed(2)} sub={`${vm.outGrowth >= 0 ? '+' : ''}${(vm.outGrowth * 100).toFixed(1)}%/yr`} />
          <Stat label="Unemployment" value={pct(civ.economy.unemployment, 1)} tone={civ.economy.unemployment > 0.09 ? 'bad' : civ.economy.unemployment > 0.06 ? 'warn' : 'good'} />
          <Stat label="Grid margin" value={`${civ.energy.marginPct.toFixed(1)}%`} tone={marginTone} sub={`${pct(civ.energy.servedTWh / Math.max(1, civ.energy.demandTWh))} served · ${civ.energy.priceIndex.toFixed(2)}×`} />
          <Stat label="Stability" value={pct(civ.society.stability)} tone={civ.society.stability > 0.6 ? 'good' : civ.society.stability > 0.4 ? 'warn' : 'bad'} />
          <Stat label="Inequality" value={civ.economy.gini.toFixed(2)} sub="gini" />
        </div>

        <div className="metric-row"><span className="metric-label">Output</span><Sparkline data={vm.outputS} color={CIV_TINT[selectedCiv]} /></div>
        <div className="metric-row"><span className="metric-label">Unemployment</span><Sparkline data={vm.unempS} color="#ef5350" /></div>
        <div className="metric-row"><span className="metric-label">Grid margin %</span><Sparkline data={vm.marginS} color="#ffc107" refValue={3} /></div>
        <div className="metric-row"><span className="metric-label">Elec. price ×</span><Sparkline data={vm.priceS} color="#ffc107" refValue={1} /></div>
        <div className="metric-row"><span className="metric-label">Population M</span><Sparkline data={vm.popS} color="#4FD1A5" /></div>
        <div className="metric-row"><span className="metric-label">Food security</span><Sparkline data={vm.foodS} color="#9ccc65" refValue={1} /></div>
        <div className="metric-row"><span className="metric-label">Stability</span><Sparkline data={vm.stabS} color="#ab7bd8" /></div>

        <div className="sub-head">Land, sea &amp; frontier</div>
        {(() => {
          const L = civ.land; const sp = civ.space; const s = civ.society;
          const landTone = L.pressure > 0.95 ? 'bad' : L.pressure > 0.85 ? 'warn' : 'good';
          return (
            <div className="stat-grid">
              <Stat label="Land committed" value={pct(L.pressure)} tone={landTone} sub={`density ${L.densityIndex.toFixed(2)}× · free ${pct(L.free)}`} />
              <Stat label="From the sea" value={`+${(L.reclaimed * 100).toFixed(1)}%`} sub={L.reclaimed > 0 ? `dikes ${pct(L.reclaimedCondition)} · floating ${(L.floating * 100).toFixed(1)}%` : L.floating > 0 ? `floating ${(L.floating * 100).toFixed(1)}%` : 'no reclamation yet'} tone={L.reclaimed > 0 && L.reclaimedCondition < 0.4 ? 'bad' : undefined} />
              <Stat label="Frontier readiness" value={pct(civ.frontierReadiness)} tone={civ.frontierReadiness >= 0.6 ? 'good' : civ.frontierReadiness >= 0.45 ? 'warn' : 'bad'} sub="earned, not granted" />
              <Stat label="Life expectancy" value={civ.population.lifeExpectancy.toFixed(0)} sub={`${civ.population.offworld > 0.005 ? `${civ.population.offworld.toFixed(2)}M off Earth` : 'all on Earth'}`} />
              <Stat label="Derelict housing" value={pct(civ.housing.abandoned)} tone={civ.housing.abandoned > 0.18 ? 'bad' : civ.housing.abandoned > 0.06 ? 'warn' : 'good'} sub={`condition ${pct(civ.housing.condition)}`} />
              <Stat label="Income floor" value={pct(s.basicProvision)} sub={sp.spaceportCapacity > 0.05 ? `launch ${sp.spaceportCapacity.toFixed(1)} · cost ${(sp.launchCostIndex * 100).toFixed(0)}%` : 'no spaceport'} />
            </div>
          );
        })()}

        <div className="sub-head">Food &amp; agriculture</div>
        {(() => {
          const f = civ.food;
          const coverage = f.selfSufficiency + f.importShare;
          const tone = coverage > 1.0 ? 'good' : coverage > 0.92 ? 'warn' : 'bad';
          return (
            <>
              <div className="metric-row"><span className="metric-label">Food coverage</span><Bar value={Math.min(1, coverage / 1.2)} color={tone === 'good' ? '#4caf50' : tone === 'warn' ? '#ffc107' : '#f44336'} /><span className="metric-val">{pct(coverage)}</span></div>
              <div className="metric-row"><span className="metric-label">Domestic</span><span className="metric-val">{pct(f.selfSufficiency)}{f.importShare > 0.01 ? ` · imports ${pct(f.importShare)}` : ''}</span></div>
              <div className="metric-row"><span className="metric-label">Artificial food</span><Bar value={f.artificialShare} color="#39d97e" /><span className="metric-val">{pct(f.artificialShare)}</span></div>
              <div className="metric-row"><span className="metric-label">Farmland in use</span><Bar value={f.landUse} color="#8d9e63" /><span className="metric-val">{pct(f.landUse)}</span></div>
              <div className="metric-row"><span className="metric-label">Food price</span><span className="metric-val" style={f.priceIndex > 1.3 ? { color: '#f44336' } : undefined}>{f.priceIndex.toFixed(2)}×</span></div>
              {f.shortage > 0.03 && <div className="priority-note" style={{ color: f.shortage > 0.08 ? '#f44336' : '#ffc107' }}>{f.shortage > 0.08 ? `Famine: ${pct(f.shortage)} of food demand unmet` : `Food gap: ${pct(f.shortage)} of demand unmet`}</div>}
            </>
          );
        })()}

        <div className="sub-head">Living space &amp; waste</div>
        {(() => {
          const h = civ.housing;
          const ws = civ.waste;
          return (
            <>
              <div className="metric-row"><span className="metric-label">Housing stock</span><Bar value={Math.min(1, h.stockIndex / Math.max(0.5, h.demandIndex))} color="#6E7BFF" /><span className="metric-val">{pct(h.stockIndex / Math.max(0.2, h.demandIndex))} of need</span></div>
              <div className="metric-row"><span className="metric-label">Housing condition</span><Bar value={h.condition} color={h.condition > 0.75 ? '#4caf50' : h.condition > 0.5 ? '#ffc107' : '#f44336'} /><span className="metric-val">{pct(h.condition)}</span></div>
              <div className="metric-row"><span className="metric-label">Vacancy</span><span className="metric-val">{pct(h.vacancy)}</span></div>
              <div className="metric-row"><span className="metric-label">Rent index</span><span className="metric-val" style={h.rentIndex > 1.4 ? { color: '#f44336' } : h.rentIndex > 1.15 ? { color: '#ffc107' } : undefined}>{h.rentIndex.toFixed(2)}×</span></div>
              {h.crowding > 0.12 && <div className="priority-note" style={{ color: '#ffc107' }}>Crowded cities — informal settlements forming at the edges</div>}
              <div className="metric-row"><span className="metric-label">Waste managed</span><Bar value={ws.managedShare} color={ws.managedShare > 0.7 ? '#4caf50' : ws.managedShare > 0.45 ? '#ffc107' : '#f44336'} /><span className="metric-val">{pct(ws.managedShare)}</span></div>
              <div className="metric-row"><span className="metric-label">Waste buildup</span><Bar value={Math.min(1, ws.accumulation)} color="#8d6e63" /><span className="metric-val">{pct(Math.min(1, ws.accumulation))}</span></div>
            </>
          );
        })()}

        <div className="sub-head">Electricity mix</div>
        <div className="mix-bar">
          {vm.mix.map(({ k, share }) => share > 0.005 && (
            <div key={k} className="mix-seg" style={{ width: `${share * 100}%`, background: MIX_COLORS[k] }} title={`${k}: ${pct(share)}`} />
          ))}
        </div>
        <div className="mix-legend">
          {vm.mix.map(({ k, share }) => share > 0.01 && (
            <span key={k} className="mix-item"><i style={{ background: MIX_COLORS[k] }} />{k} {pct(share)}</span>
          ))}
        </div>
        <div className="metric-row"><span className="metric-label">Demand</span><span className="metric-val">{civ.energy.demandTWh.toFixed(0)} TWh/yr</span></div>
        <div className="metric-row"><span className="metric-label">Data centers</span><span className="metric-val">{civ.compute.dcCapGW.toFixed(1)} GW</span></div>
        <div className="metric-row"><span className="metric-label">Compute draw</span><span className="metric-val">{civ.energy.computeDemandTWh.toFixed(0)} TWh/yr</span></div>
        <div className="metric-row"><span className="metric-label">Industry power served</span><Bar value={civ.energy.industryServedRatio} color={civ.energy.industryServedRatio > 0.9 ? '#4caf50' : civ.energy.industryServedRatio > 0.7 ? '#ffc107' : '#f44336'} /><span className="metric-val">{pct(civ.energy.industryServedRatio)}</span></div>
        <div className="metric-row"><span className="metric-label">Grid condition</span><Bar value={civ.energy.gridCondition} color={civ.energy.gridCondition > 0.78 ? '#4caf50' : civ.energy.gridCondition > 0.55 ? '#ffc107' : '#f44336'} /><span className="metric-val">{pct(civ.energy.gridCondition)}</span></div>

        <div className="sub-head">State capacity &amp; investment</div>
        <div className="metric-row"><span className="metric-label">Institutions</span><Bar value={civ.economy.institutionalCapacity} color={civ.economy.institutionalCapacity > 0.65 ? '#4caf50' : civ.economy.institutionalCapacity > 0.4 ? '#ffc107' : '#f44336'} /><span className="metric-val">{pct(civ.economy.institutionalCapacity)}</span></div>
        <div className="metric-row"><span className="metric-label">Public debt</span><span className="metric-val">{civ.economy.publicDebt.toFixed(2)}× output</span></div>
        <div className="metric-row"><span className="metric-label">Investment budget</span><span className="metric-val">{civ.economy.investmentBudget.toFixed(2)} idx/yr</span></div>

        <div className="sub-head">Active projects</div>
        {vm.projects.length === 0 ? <div className="priority-note">No major project currently under construction.</div> : vm.projects.slice(0, 6).map((p) => (
          <div key={p.id} className="priority-note">{p.kind} · {p.status.replace('_', ' ')} · ~{Math.max(0, p.monthsRemaining / 12).toFixed(1)}y remaining{p.delayMonths > 1 ? ` · ${p.delayMonths.toFixed(0)}mo delay` : ''}</div>
        ))}

        <div className="sub-head">Strategic priority</div>
        <div className="priority-note">{civ.strategicPriority}</div>

        <div className="sub-head">Automation</div>
        <div className="metric-row"><span className="metric-label">Exposure</span><Bar value={civ.economy.automationExposure} color="#6E7BFF" /><span className="metric-val">{pct(civ.economy.automationExposure)}</span></div>
        <div className="metric-row"><span className="metric-label">Displaced</span><Bar value={civ.economy.displacedShare} color="#FFB454" /><span className="metric-val">{pct(civ.economy.displacedShare)}</span></div>
      </div>
    </div>
  );
}
