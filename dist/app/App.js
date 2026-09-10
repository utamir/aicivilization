import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// APP — composition root. 3D world layer underneath, observer UI layer above.
// ─────────────────────────────────────────────────────────────────────────────
import { Component, useRef } from 'react';
import { WorldCanvas } from './world3d/WorldCanvas.js';
import { engine } from './state/engine.js';
import { useUI } from './state/store.js';
import { Shell } from './ui/Shell.js';
import { RightPanel } from './ui/RightPanel.js';
import { FutureLab } from './ui/FutureLab.js';
import { Interventions } from './ui/Interventions.js';
import { BranchPanel } from './ui/BranchPanel.js';
import { EvidencePanel } from './ui/EvidencePanel.js';
import { WelcomeScreen } from './ui/WelcomeScreen.js';
class ErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (this.state.error) {
            return (_jsxs("div", { className: "fatal", children: [_jsx("h2", { children: "The world failed to render" }), _jsx("pre", { children: String(this.state.error.message || this.state.error) }), _jsxs("p", { children: ["Open the browser console for the stack. If this is a blank page after ", _jsx("code", { children: "./serve.sh" }), ", the build step probably did not run: ", _jsx("code", { children: "npm install && npm run build" }), "."] })] }));
        }
        return this.props.children;
    }
}
function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    }
    catch {
        return false;
    }
}
export default function App() {
    if (!webglAvailable()) {
        return _jsxs("div", { className: "fatal", children: [_jsx("h2", { children: "WebGL is not available" }), _jsx("p", { children: "The 3D world needs WebGL. Enable hardware acceleration or try another browser." })] });
    }
    return _jsx(ErrorBoundary, { children: _jsx(AppInner, {}) });
}
function AppInner() {
    const worldRef = useRef(engine.world);
    const visualRef = useRef(null);
    const started = useUI((s) => s.started);
    const panel = useUI((s) => s.panel);
    return (_jsxs("div", { className: "app-root", children: [_jsx(WorldCanvas, { worldRef: worldRef, visualRef: visualRef }), started && (_jsxs(_Fragment, { children: [_jsx(Shell, { worldRef: worldRef }), _jsx(RightPanel, { worldRef: worldRef }), panel === 'futurelab' && _jsx(FutureLab, {}), panel === 'interventions' && _jsx(Interventions, { worldRef: worldRef }), panel === 'branch' && _jsx(BranchPanel, {}), panel === 'evidence' && _jsx(EvidencePanel, {})] })), !started && _jsx(WelcomeScreen, {})] }));
}
