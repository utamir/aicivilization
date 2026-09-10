// ─────────────────────────────────────────────────────────────────────────────
// SIM ENGINE — imperative bridge between the pure simulation core and React.
// Holds World A (+ optional World B branch), advances on rAF with fixed
// monthly ticks decoupled from frame rate.
// ─────────────────────────────────────────────────────────────────────────────
import { createWorld, stepWorld, DEFAULT_PARAMS, SCENARIO_PRESETS, applyDelta, applyIntervention, createBranch, resolveDecision, } from '../sim/index.js';
const MONTHS_PER_SEC = { 0: 0, 1: 2.4, 5: 12, 20: 48, 100: 240 };
const MAX_TICKS_PER_FRAME = 30; // stability guard (a frame at 100× may run 2.5 sim-years; rendering keeps up because visuals are throttled)
export class SimEngine {
    worldA;
    worldB = null;
    branchNote = '';
    activeWorld = 'A';
    speed = 0;
    acc = 0;
    dismissedDecisions = new Set();
    /** mirrored from the UI store by setAskMode; the engine must not import the store (module cycle) */
    askMode = 'turning-points';
    decide(key, optionId) {
        const ok = resolveDecision(this.world, key, optionId);
        if (this.worldB && this.worldB !== this.world)
            resolveDecision(this.worldB, key, optionId);
        else if (this.worldA !== this.world)
            resolveDecision(this.worldA, key, optionId);
        this.emit();
        return ok;
    }
    dismissDecision(key) { this.dismissedDecisions.add(key); this.emit(); }
    version = 0; // bumped whenever world identity changes (new scenario/branch)
    listeners = new Set();
    constructor() {
        const p = SCENARIO_PRESETS[0];
        this.worldA = createWorld(20260907, applyDelta(DEFAULT_PARAMS, p.delta), p.id, p.name);
    }
    get world() {
        return this.activeWorld === 'B' && this.worldB ? this.worldB : this.worldA;
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    emit() { this.listeners.forEach((f) => f()); }
    newScenario(scenarioId, delta, label, seed) {
        this.worldA = createWorld(seed ?? (Math.random() * 2 ** 31) >>> 0, applyDelta(DEFAULT_PARAMS, delta), scenarioId, label);
        this.worldB = null;
        this.activeWorld = 'A';
        this.speed = 1;
        this.acc = 0;
        this.version++;
        this.emit();
    }
    newPreset(presetId) {
        const p = SCENARIO_PRESETS.find((s) => s.id === presetId) ?? SCENARIO_PRESETS[0];
        this.newScenario(p.id, p.delta, p.name);
    }
    setSpeed(s) { this.speed = s; this.emit(); }
    /** Advance both worlds (branch runs in lockstep). Called from rAF. */
    frame(dtSec) {
        if (this.speed === 0)
            return;
        this.acc += dtSec * MONTHS_PER_SEC[this.speed];
        let ticks = Math.floor(this.acc);
        this.acc -= ticks;
        if (ticks <= 0)
            return;
        if (ticks > MAX_TICKS_PER_FRAME) {
            ticks = MAX_TICKS_PER_FRAME;
            this.acc = 0;
        }
        stepWorld(this.worldA, ticks);
        if (this.worldB)
            stepWorld(this.worldB, ticks);
        // The world asks; the clock waits for an answer (or for the deadline, if the observer resumes without answering).
        if (this.world.pendingDecisions.length > 0) {
            if (this.askMode === 'never') {
                for (const p of [...this.world.pendingDecisions])
                    this.decide(p.key, null);
            }
            else if (!this.dismissedDecisions.has(this.world.pendingDecisions[0].key)) {
                this.speed = 0;
                this.emit();
            }
        }
    }
    intervene(interventionId, civId, otherCiv) {
        const r = applyIntervention(this.world, interventionId, civId, otherCiv);
        this.emit();
        return r;
    }
    branch(note, change) {
        const { a, b } = createBranch(this.world, note, (bw) => Object.assign(bw.params, change));
        this.worldA = a;
        this.worldB = b;
        this.branchNote = note;
        this.activeWorld = 'B';
        this.version++;
        this.emit();
    }
    closeBranch(keep) {
        const kept = keep === 'B' && this.worldB ? this.worldB : this.worldA;
        this.worldA = kept;
        this.worldB = null;
        this.activeWorld = 'A';
        this.version++;
        this.emit();
    }
    setActiveWorld(w) { this.activeWorld = w; this.emit(); }
}
export const engine = new SimEngine();
