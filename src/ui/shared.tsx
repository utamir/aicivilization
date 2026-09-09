// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES — panel chrome, sparklines, labels, formatting.
// Observer layer: analytical, minimal, premium. Data in tabular numerals.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';

export function Panel({ title, right, children, className = '' }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`glass-panel ${className}`}>
      {title && (
        <div className="panel-head">
          <span className="panel-title">{title}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ? 'tone-' + tone : ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Bar({ value, max = 1, color = '#6E7BFF', height = 4 }: { value: number; max?: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="bar-track" style={{ height }}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Sparkline({ data, width = 120, height = 28, color = '#6E7BFF', refValue }: { data: number[]; width?: number; height?: number; color?: string; refValue?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="spark-empty" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`).join(' ');
  const refY = refValue !== undefined ? height - ((refValue - min) / span) * (height - 4) - 2 : null;
  return (
    <svg width={width} height={height} className="sparkline">
      {refY !== null && refY >= 0 && refY <= height && <line x1={0} y1={refY} x2={width} y2={refY} stroke="#4a4a5a" strokeDasharray="3 3" strokeWidth={1} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / span) * (height - 4) - 2} r={2} fill={color} />
    </svg>
  );
}

export function fmt(n: number, digits = 1): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toFixed(digits);
}

export function pct(n: number, digits = 0): string {
  return (n * 100).toFixed(digits) + '%';
}

export function signed(n: number, digits = 1): string {
  return (n >= 0 ? '+' : '') + n.toFixed(digits);
}

export const CIV_TINT: Record<string, string> = { veloria: '#5B8CFF', ardan: '#FFB454', nemea: '#4FD1A5' };

export const CATEGORY_COLOR: Record<string, string> = {
  technology: '#6E7BFF', energy: '#ffc107', economy: '#4caf50', politics: '#ef5350',
  society: '#ab7bd8', science: '#22d3ee', conflict: '#f44336', environment: '#8bc34a',
  milestone: '#ECEFF4', intervention: '#FFB454', character: '#f48fb1',
};
