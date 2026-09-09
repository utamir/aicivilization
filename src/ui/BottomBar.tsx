// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM BAR — camera modes and analytical overlay toggles.
// ─────────────────────────────────────────────────────────────────────────────
import { useUI, type CameraMode, type OverlayMode, type LightingMode } from '../state/store';

const LIGHTS: { l: LightingMode; label: string; hint: string }[] = [
  { l: 'cycle', label: 'Cycle', hint: 'Slow day/night cycle (about four minutes); pauses with the simulation' },
  { l: 'day', label: 'Day', hint: 'Pin daylight' },
  { l: 'dusk', label: 'Dusk', hint: 'Pin golden hour' },
  { l: 'night', label: 'Night', hint: 'Pin night: lit windows, dark derelict blocks, blackouts' },
];

const CAMERAS: { m: CameraMode; label: string; hint: string }[] = [
  { m: 'orbit', label: 'Orbit', hint: 'Free camera — drag to rotate, scroll to zoom' },
  { m: 'strategic', label: 'Strategic', hint: 'High overview of the whole region' },
  { m: 'city', label: 'City', hint: 'Low view over the selected civilization’s capital' },
  { m: 'subsurface', label: 'Below ground', hint: 'Inspect underground structures from below the terrain surface' },
  { m: 'space', label: 'Beyond Earth', hint: 'Schematic view of orbital, Mars and deep-space continuity' },
  { m: 'follow', label: 'Follow', hint: 'Drifts from city to city' },
  { m: 'cinematic', label: 'Cinematic', hint: 'Slow sweeping arc around the region' },
];

const OVERLAYS: { o: OverlayMode; label: string }[] = [
  { o: 'none', label: 'None' },
  { o: 'energy', label: 'Energy margin' },
  { o: 'adoption', label: 'Automation' },
  { o: 'compute', label: 'Compute' },
];

export function BottomBar() {
  const cameraMode = useUI((s) => s.cameraMode);
  const overlay = useUI((s) => s.overlay);
  const lighting = useUI((s) => s.lighting);
  const set = useUI((s) => s.set);
  const activeCam = CAMERAS.find((c) => c.m === cameraMode);

  return (
    <div className="bottombar">
      <div className="bottom-group">
        <span className="bottom-label">Camera</span>
        {CAMERAS.map((c) => (
          <button key={c.m} className={`bottom-btn ${cameraMode === c.m ? 'active' : ''}`} onClick={() => set({ cameraMode: c.m })} title={c.hint}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="bottom-hint">{activeCam?.hint}</div>
      <div className="bottom-group">
        <span className="bottom-label">Light</span>
        {LIGHTS.map((l) => (
          <button key={l.l} className={`bottom-btn ${lighting === l.l ? 'active' : ''}`} onClick={() => set({ lighting: l.l })} title={l.hint}>
            {l.label}
          </button>
        ))}
      </div>
      <div className="bottom-group">
        <span className="bottom-label">Overlay</span>
        {OVERLAYS.map((o) => (
          <button key={o.o} className={`bottom-btn ${overlay === o.o ? 'active' : ''}`} onClick={() => set({ overlay: o.o })}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
