import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Panel({ title, right, children, className = '' }) {
    return (_jsxs("div", { className: `glass-panel ${className}`, children: [title && (_jsxs("div", { className: "panel-head", children: [_jsx("span", { className: "panel-title", children: title }), right] })), children] }));
}
export function Stat({ label, value, sub, tone }) {
    return (_jsxs("div", { className: "stat", children: [_jsx("div", { className: "stat-label", children: label }), _jsx("div", { className: `stat-value ${tone ? 'tone-' + tone : ''}`, children: value }), sub && _jsx("div", { className: "stat-sub", children: sub })] }));
}
export function Bar({ value, max = 1, color = '#6E7BFF', height = 4 }) {
    const pct = Math.max(0, Math.min(1, value / max)) * 100;
    return (_jsx("div", { className: "bar-track", style: { height }, children: _jsx("div", { className: "bar-fill", style: { width: `${pct}%`, background: color } }) }));
}
export function Sparkline({ data, width = 120, height = 28, color = '#6E7BFF', refValue }) {
    if (data.length < 2)
        return _jsx("div", { style: { width, height }, className: "spark-empty" });
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`).join(' ');
    const refY = refValue !== undefined ? height - ((refValue - min) / span) * (height - 4) - 2 : null;
    return (_jsxs("svg", { width: width, height: height, className: "sparkline", children: [refY !== null && refY >= 0 && refY <= height && _jsx("line", { x1: 0, y1: refY, x2: width, y2: refY, stroke: "#4a4a5a", strokeDasharray: "3 3", strokeWidth: 1 }), _jsx("polyline", { points: pts, fill: "none", stroke: color, strokeWidth: 1.5, strokeLinejoin: "round" }), _jsx("circle", { cx: width, cy: height - ((data[data.length - 1] - min) / span) * (height - 4) - 2, r: 2, fill: color })] }));
}
export function fmt(n, digits = 1) {
    if (!isFinite(n))
        return '—';
    if (Math.abs(n) >= 1e6)
        return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000)
        return (n / 1000).toFixed(1) + 'k';
    return n.toFixed(digits);
}
export function pct(n, digits = 0) {
    return (n * 100).toFixed(digits) + '%';
}
export function signed(n, digits = 1) {
    return (n >= 0 ? '+' : '') + n.toFixed(digits);
}
export const CIV_TINT = { veloria: '#5B8CFF', ardan: '#FFB454', nemea: '#4FD1A5' };
export const CATEGORY_COLOR = {
    technology: '#6E7BFF', energy: '#ffc107', economy: '#4caf50', politics: '#ef5350',
    society: '#ab7bd8', science: '#22d3ee', conflict: '#f44336', environment: '#8bc34a',
    milestone: '#ECEFF4', intervention: '#FFB454', character: '#f48fb1',
};
