import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// WELCOME — title, tagline, scenario selection. The world is already
// rendering behind this screen; entering starts the clock.
// ─────────────────────────────────────────────────────────────────────────────
import { useUI } from '../state/store.js';
import { engine } from '../state/engine.js';
import { SCENARIO_PRESETS } from '../sim/index.js';
const FEATURED = new Set(['baseline_2026', 'human_centered_abundance', 'automation_divide', 'population_spring', 'vertical_world', 'collapse_and_return', 'terminal_cascade', 'deep_diaspora']);
export function WelcomeScreen() {
    const set = useUI((s) => s.set);
    const featured = SCENARIO_PRESETS.filter((p) => FEATURED.has(p.id));
    const enter = (presetId) => {
        if (presetId)
            engine.newPreset(presetId);
        engine.setSpeed(1);
        set({ started: true });
    };
    return (_jsx("div", { className: "welcome", children: _jsxs("div", { className: "welcome-inner", children: [_jsx("div", { className: "welcome-kicker", children: "A machine's theory of civilization \u2014 made playable" }), _jsxs("h1", { className: "welcome-title", children: [_jsx("span", { children: "WHAT IF?" }), _jsx("br", {}), "CIVILIZATION LAB"] }), _jsx("div", { className: "welcome-tagline", children: "Give the world one assumption. Then live with what follows." }), _jsxs("div", { className: "welcome-desc", children: ["September 2026. Three synthetic civilizations share one finite island. People are born, migrate and die; grids age; farms fail; institutions recover or do not. Cities can grow upward, underground, into the sea and eventually away from Earth.", _jsx("br", {}), _jsx("br", {}), "This is not a forecast. It is an inspectable set of assumptions running one month at a time. Pick a question below. The scenario sets the conditions \u2014 it does not choose the ending. ", _jsx("a", { href: "https://github.com/utamir/aicivilization", target: "_blank", children: "GitHub" }), "."] }), _jsx("div", { className: "welcome-presets", children: featured.map((p) => (_jsxs("button", { className: "preset-card", style: { ['--accent']: p.accent }, onClick: () => enter(p.id), children: [_jsx("span", { className: "preset-name", children: p.name }), _jsx("span", { className: "preset-tagline", children: p.tagline })] }, p.id))) }), _jsxs("div", { className: "welcome-foot", children: ["Eight starting questions shown here \u00B7 the full scenario library is inside Scenario Lab \u00B7 seeded & reproducible \u00B7 important events carry their causes", _jsx("br", {}), "Yours, ", _jsx("a", { href: "https://www.linkedin.com/in/tamirk/", target: "_blank", children: "Tamir" })] })] }) }));
}
