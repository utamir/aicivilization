// Small pure formulas shared across modules (kept dependency-free to avoid import cycles).

/**
 * Empirical autonomous-task-horizon display proxy. METR's 2026 task suite does
 * not support reliable estimates above roughly 16 hours, so the model MUST NOT
 * turn an extrapolated benchmark into months/years of autonomy. Beyond this
 * measurement ceiling, internal dynamics use a dimensionless autonomy index.
 */
export function taskHorizonHrs(agentCap: number): number {
  return Math.min(16, 12 * Math.pow(Math.max(0.05, agentCap), 2.6));
}

/** Dimensionless capability proxy used outside the benchmark's validated range. */
export function autonomyIndex(agentCap: number): number {
  return Math.max(0.05, agentCap);
}


export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
