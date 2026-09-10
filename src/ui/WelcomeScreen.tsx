// ─────────────────────────────────────────────────────────────────────────────
// WELCOME — title, tagline, scenario selection. The world is already
// rendering behind this screen; entering starts the clock.
// ─────────────────────────────────────────────────────────────────────────────
import { useUI } from '../state/store';
import { engine } from '../state/engine';
import { SCENARIO_PRESETS } from '../sim';

const FEATURED = new Set(['baseline_2026', 'human_centered_abundance', 'automation_divide', 'population_spring', 'vertical_world', 'collapse_and_return', 'terminal_cascade', 'deep_diaspora']);

export function WelcomeScreen() {
  const set = useUI((s) => s.set);
  const featured = SCENARIO_PRESETS.filter((p) => FEATURED.has(p.id));

  const enter = (presetId?: string) => {
    if (presetId) engine.newPreset(presetId);
    engine.setSpeed(1);
    set({ started: true });
  };

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-kicker">A machine's theory of civilization — made playable</div>
        <h1 className="welcome-title"><span>WHAT IF?</span><br />CIVILIZATION LAB</h1>
        <div className="welcome-tagline">Give the world one assumption. Then live with what follows.</div>
        <div className="welcome-desc">
          September 2026. Three synthetic civilizations share one finite island. People are born, migrate and die; grids age; farms fail; institutions recover or do not. Cities can grow upward, underground, into the sea and eventually away from Earth.
          <br /><br />
          This is not a forecast. It is an inspectable set of assumptions running one month at a time. Pick a question below. The scenario sets the conditions — it does not choose the ending. <a href="https://github.com/utamir/aicivilization" target="_blank">GitHub</a>.
        </div>
        <div className="welcome-presets">
          {featured.map((p) => (
            <button key={p.id} className="preset-card" style={{ ['--accent' as any]: p.accent }} onClick={() => enter(p.id)}>
              <span className="preset-name">{p.name}</span>
              <span className="preset-tagline">{p.tagline}</span>
            </button>
          ))}
        </div>
        <div className="welcome-foot">
          Eight starting questions shown here · the full scenario library is inside Scenario Lab · seeded & reproducible · important events carry their causes
          <br />
          Yours, <a href="https://www.linkedin.com/in/tamirk/" target="_blank">Tamir</a>
        </div>
      </div>
    </div>
  );
}
