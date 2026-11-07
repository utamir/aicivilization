// ─────────────────────────────────────────────────────────────────────────────
// ARC PREVIEW FLAG — separated from the component so React Fast Refresh can
// treat ArcPreview.tsx as a components-only module.
// ─────────────────────────────────────────────────────────────────────────────
export type ArcStateName = 'occupied' | 'aged' | 'ruined';

export function readArcPreview(): { state: ArcStateName; view: 'a' | 'b' } | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const s = q.get('arc');
  if (s !== 'occupied' && s !== 'aged' && s !== 'ruined') return null;
  return { state: s, view: q.get('view') === 'b' ? 'b' : 'a' };
}
