// ─────────────────────────────────────────────────────────────────────────────
// APP — composition root. 3D world layer underneath, observer UI layer above.
// ─────────────────────────────────────────────────────────────────────────────
import { Component, useRef, type ReactNode } from 'react';
import { WorldCanvas, type WorldRef, type VisualRef } from './world3d/WorldCanvas';
import { engine } from './state/engine';
import { useUI } from './state/store';
import { Shell } from './ui/Shell';
import { RightPanel } from './ui/RightPanel';
import { FutureLab } from './ui/FutureLab';
import { Interventions } from './ui/Interventions';
import { BranchPanel } from './ui/BranchPanel';
import { EvidencePanel } from './ui/EvidencePanel';
import { WelcomeScreen } from './ui/WelcomeScreen';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <h2>The world failed to render</h2>
          <pre>{String(this.state.error.message || this.state.error)}</pre>
          <p>Open the browser console for the stack. If this is a blank page after <code>./serve.sh</code>, the build step probably did not run: <code>npm install &amp;&amp; npm run build</code>.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function webglAvailable(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export default function App() {
  if (!webglAvailable()) {
    return <div className="fatal"><h2>WebGL is not available</h2><p>The 3D world needs WebGL. Enable hardware acceleration or try another browser.</p></div>;
  }
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}

function AppInner() {
  const worldRef = useRef(engine.world) as WorldRef;
  const visualRef = useRef(null) as VisualRef;
  const started = useUI((s) => s.started);
  const panel = useUI((s) => s.panel);

  return (
    <div className="app-root">
      <WorldCanvas worldRef={worldRef} visualRef={visualRef} />
      {started && (
        <>
          <Shell worldRef={worldRef} />
          <RightPanel worldRef={worldRef} />
          {panel === 'futurelab' && <FutureLab />}
          {panel === 'interventions' && <Interventions worldRef={worldRef} />}
          {panel === 'branch' && <BranchPanel />}
          {panel === 'evidence' && <EvidencePanel />}
        </>
      )}
      {!started && <WelcomeScreen />}
    </div>
  );
}
