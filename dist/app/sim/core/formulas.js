// Small pure formulas shared across modules (kept dependency-free to avoid import cycles).
/**
 * Empirical autonomous-task-horizon display proxy. METR's 2026 task suite does
 * not support reliable estimates above roughly 16 hours, so the model MUST NOT
 * turn an extrapolated benchmark into months/years of autonomy. Beyond this
 * measurement ceiling, internal dynamics use a dimensionless autonomy index.
 */
export function taskHorizonHrs(agentCap) {
    return Math.min(16, 12 * Math.pow(Math.max(0.05, agentCap), 2.6));
}
/** Dimensionless capability proxy used outside the benchmark's validated range. */
export function autonomyIndex(agentCap) {
    return Math.max(0.05, agentCap);
}
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
