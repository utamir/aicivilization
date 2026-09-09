// ─────────────────────────────────────────────────────────────────────────────
// UI STORE — zustand. The simulation lives imperatively in `engine`;
// this store holds view state and a throttled view-model snapshot.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { CivId, TechId } from '../sim';
import { engine, type Speed } from './engine';

export type CameraMode = 'orbit' | 'strategic' | 'city' | 'subsurface' | 'follow' | 'cinematic' | 'space';
export type OverlayMode = 'none' | 'energy' | 'adoption' | 'compute';
export type RightTab = 'chronicle' | 'technology' | 'frontier' | 'characters';
export type LightingMode = 'cycle' | 'day' | 'dusk' | 'night';
export type ChronicleFilter = 'major' | 'all';
export type PanelId = 'futurelab' | 'interventions' | 'branch' | 'why' | 'evidence' | null;

interface UIState {
  started: boolean;
  speed: Speed;
  selectedCiv: CivId;
  selectedTech: TechId;
  selectedCharacter: string | null;
  selectedEventId: string | null;
  rightTab: RightTab;
  rightOpen: boolean;
  leftOpen: boolean;
  panel: PanelId;
  cameraMode: CameraMode;
  overlay: OverlayMode;
  compareMode: boolean;
  hudVisible: boolean;
  lighting: LightingMode;
  askMode: 'turning-points' | 'never'; // 'never': decisions resolve in character without stopping the clock
  setAskMode: (m: 'turning-points' | 'never') => void;
  chronicleFilter: ChronicleFilter;
  // view-model tick (forces React refresh at ~5 Hz)
  vmTick: number;
  engineVersion: number;
  hasBranch: boolean;

  set: (p: Partial<UIState>) => void;
  setSpeed: (s: Speed) => void;
}

export const useUI = create<UIState>((set) => ({
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
