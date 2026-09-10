// ─────────────────────────────────────────────────────────────────────────────
// UI STORE — zustand. The simulation lives imperatively in `engine`;
// this store holds view state and a throttled view-model snapshot.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { engine } from './engine.js';
export const useUI = create((set) => ({
    started: false,
    speed: 0,
    selectedCiv: 'veloria',
    selectedTech: 'ai_models',
    selectedCharacter: null,
    selectedEventId: null,
    rightTab: 'chronicle',
    rightOpen: true,
    leftOpen: true,
    panel: null,
    cameraMode: 'orbit',
    overlay: 'none',
    compareMode: false,
    hudVisible: true,
    lighting: 'cycle',
    askMode: 'turning-points',
    chronicleFilter: 'major',
    vmTick: 0,
    engineVersion: 0,
    hasBranch: false,
    set: (p) => set(p),
    setSpeed: (s) => { engine.setSpeed(s); set({ speed: s }); },
    setAskMode: (m) => { engine.askMode = m; set({ askMode: m }); },
}));
// engine → store sync
engine.subscribe(() => {
    useUI.setState({
        engineVersion: engine.version,
        hasBranch: !!engine.worldB,
        speed: engine.speed,
    });
});
