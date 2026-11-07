// palettes keyed by tier: believable regional range
const WALL_T0 = ['#c9bfae', '#d8cfbc', '#b8ab94', '#cfc0a5', '#c2b3a0', '#d3c2ab'];
const WALL_T1 = ['#e3ddd3', '#d9d5cc', '#cfc6b6', '#e8e2d8'];
const WALL_T2 = ['#e9ecee', '#dde4e8', '#eef0f2', '#d5dde2'];
const ROOF_T0 = ['#8a4a3a', '#7a4a3c', '#6e4a3f', '#83503e', '#935543']; // clay tiles
const ROOF_T1 = ['#4a4f55', '#3e434a', '#565b60']; // standing seam
const ROOF_T2 = ['#c9cfd4', '#b7bfc6']; // light membrane
const DOOR = ['#5a4634', '#4a3c30', '#6a5440', '#3e3a36'];
const FRAME = '#f2f0ea';
const CONCRETE = '#b5aca0';
const PLOT_EDGE = 2.6;
const FENCE = ['#6e6a62', '#7a7468', '#5d5a52', '#8a8276'];
const SHED = ['#8a7a62', '#7a6a52', '#6e7a6a', '#9a8a70'];
function pick(arr, r) { return arr[Math.floor(r * arr.length) % arr.length]; }
/** Height (in units) of one storey. */
const FLOOR = 0.82;
const WIN_W = 0.46;
const WIN_H = 0.5;
export function generateBuilding(plot, opts) {
    const r1 = Math.abs(Math.sin(opts.seed * 127.1)) % 1;
    const r2 = Math.abs(Math.sin(opts.seed * 311.7)) % 1;
    const r3 = Math.abs(Math.sin(opts.seed * 74.7)) % 1;
    const r4 = Math.abs(Math.sin(opts.seed * 53.1)) % 1;
    const { tier, state } = opts;
    const parts = [];
    const cos = Math.cos(plot.rot), sin = Math.sin(plot.rot);
    // local plot frame: u along street, v into the plot
    const at = (u, v, y) => ({
        x: plot.x + u * cos + v * sin,
        z: plot.z - u * sin + v * cos,
        y,
    });
    let height = 1;
    const walls = tier === 0 ? WALL_T0 : tier === 1 ? WALL_T1 : WALL_T2;
    const roofs = tier === 0 ? ROOF_T0 : tier === 1 ? ROOF_T1 : ROOF_T2;
    const winRow = (u0, u1, y, depth, count, skipDoors) => {
        for (let i = 0; i < count; i++) {
            const u = u0 + ((i + 0.5) / count) * (u1 - u0);
            if (skipDoors && i === skipDoors - 1)
                continue;
            const p = at(u, depth, y);
            parts.push({ kind: 'winFrame', x: p.x, y, z: p.z, sx: WIN_W, sy: WIN_H, sz: 0.1, rotY: plot.rot, color: FRAME });
            // recessed glass: pushed into the wall
            const g = at(u, depth - 0.045, y);
            parts.push({ kind: 'winGlass', x: g.x, y, z: g.z, sx: WIN_W * 0.82, sy: WIN_H * 0.78, sz: 0.04, rotY: plot.rot, color: '#20262e', lit: true });
        }
    };
    const ctx = (u, v, y, sx, sy, sz, color) => addBox('context', u, v, y, sx, sy, sz, color);
    const addBox = (kind, u, v, y, sx, sy, sz, color, lit = false) => {
        const p = at(u, v, y);
        parts.push({ kind, x: p.x, y, z: p.z, sx, sy, sz, rotY: plot.rot, color, lit });
    };
    /**
     * Ruin remains derived from THIS building's own dimensions and materials.
     * A collapse does not replace the building with generic rubble: the surviving
     * lower storeys stay in place, the upper structure is gone leaving exposed
     * floor plates and a torn wall edge, roof material lies in identifiable
     * sheets, and fragments carry the building's own wall/roof colours.
     */
    const ruinParts = (o) => {
        const keepFloors = Math.max(1, Math.floor(o.storeys * 0.45));
        const keepH = keepFloors * FLOOR;
        // surviving lower storeys, one corner torn away
        addBox('wall', 0, 0, keepH / 2, o.w * 0.94, keepH, o.d * 0.94, o.wallColor);
        parts[parts.length - 1].family = 'plaster';
        // torn upper fragment still standing on one side
        const stubH = Math.max(0.35, (o.wallH - keepH) * 0.42);
        addBox('wall', -o.w * 0.3, 0, keepH + stubH / 2, o.w * 0.34, stubH, o.d * 0.9, o.wallColor);
        parts[parts.length - 1].family = 'plaster';
        // exposed floor plate where the storey above collapsed
        addBox('flatroof', 0, 0, keepH + 0.04, o.w * 0.9, 0.06, o.d * 0.9, '#8c857a');
        parts[parts.length - 1].family = 'membrane';
        // fragmented slab edge (broken concrete teeth)
        for (let i = 0; i < 4; i++) {
            const u = (i - 1.5) * o.w * 0.22;
            const len = o.d * (0.12 + ((i * 7) % 5) / 14);
            addBox('debris', u + o.w * 0.2, o.d * 0.36, keepH + 0.05, 0.16, 0.05, len, '#9a938a');
        }
        // roof material fallen as identifiable sheets, matching the original roof
        if (o.gable) {
            addBox('gable', o.w * 0.55, o.d * 0.2, 0.12, o.w * 0.38, 0.2, o.d * 0.42, o.roofColor);
            parts[parts.length - 1].family = 'tile';
        }
        else {
            addBox('flatroof', -o.w * 0.5, o.d * 0.24, 0.1, o.w * 0.34, 0.05, o.d * 0.38, o.roofColor);
            parts[parts.length - 1].family = 'membrane';
        }
        // wall fragments: same thickness and colour as the surviving wall
        const fragN = 4 + Math.floor(r2 * 4);
        for (let i = 0; i < fragN; i++) {
            const a = r1 * 6.283 + i * 2.399;
            const dist = 0.45 + (i % 3) * 0.42 + r3 * 0.2;
            const fw = 0.16 + (i % 4) * 0.09;
            addBox('debris', Math.cos(a) * dist, Math.sin(a) * dist * 0.7, 0.05 + (i % 2) * 0.04, fw, 0.05 + r3 * 0.04, fw * (0.6 + r2 * 0.9), i % 3 === 0 ? o.roofColor : o.wallColor);
        }
        // vegetation reclaiming the lot, tied to the building's own footprint
        if (r1 < 0.7)
            addBox('greenRoof', o.w * 0.3, o.d * 0.28, 0.13, o.w * 0.3, 0.1, o.d * 0.26, '#557a53');
    };
    const cosR = Math.cos(plot.rot), sinR = Math.sin(plot.rot);
    void cosR;
    void sinR;
    if (plot.kind === 'house') {
        // ── small house: 1–2 storeys, gable roof, yard-facing entrance ──────────
        const storeys = r1 < 0.55 ? 1 : 2;
        const w = 1.5 + r2 * 0.5; // along street
        const d = 1.35 + r3 * 0.4; // into plot
        const wallH = storeys * FLOOR;
        height = wallH + 0.75;
        const wallColor = pick(walls, r4);
        const roofColor = pick(roofs, r1);
        const wallFamily = tier === 0 ? (r3 < 0.5 ? 'plaster' : 'brick') : tier === 1 ? 'plaster' : 'panel';
        const roofFamily = tier === 0 ? 'tile' : 'seam';
        if (state === 'construction') {
            addBox('shell', 0, 0, wallH * 0.45, w, wallH * 0.9, d, CONCRETE);
            addBox('craneMast', w * 0.5, -1.6, wallH * 0.7, 0.12, wallH * 1.4, 0.12, '#c9803a');
            addBox('craneBoom', w * 0.5, -1.2, wallH * 1.35, 1.6, 0.09, 0.09, '#c9803a');
            return { plot, tier, state, parts, height };
        }
        if (state === 'derelict') {
            ruinParts({ w, d, wallH, wallColor, roofColor, storeys, gable: true });
            return { plot, tier, state, parts, height: wallH * 0.45 };
        }
        addBox('wall', 0, 0, wallH / 2, w, wallH, d, wallColor);
        parts[parts.length - 1].family = wallFamily;
        // gable roof ridge along the street axis
        addBox('gable', 0, 0, wallH + 0.3, w + 0.3, 0.62, d + 0.25, roofColor);
        parts[parts.length - 1].family = roofFamily;
        // windows front (street side is -v... plot faces street at -v direction)
        const frontWin = storeys === 1 ? 2 : 3;
        winRow(-w * 0.32, w * 0.38, FLOOR * 0.55, -(d / 2 + 0.02), frontWin, 0);
        if (storeys === 2)
            winRow(-w * 0.32, w * 0.38, FLOOR * 1.55, -(d / 2 + 0.02), frontWin, 0);
        // door with canopy (front face)
        addBox('door', w * 0.32, -(d / 2 + 0.03), FLOOR * 0.42, 0.3, 0.7, 0.06, pick(DOOR, r2));
        addBox('canopy', w * 0.32, -(d / 2 + 0.16), FLOOR * 0.86, 0.5, 0.05, 0.3, '#7a736a');
        // chimney
        if (r3 < 0.75)
            addBox('chimney', -w * 0.22, 0.15, wallH + 0.75, 0.16, 0.5, 0.16, '#8a7f72');
        // ── plot context: driveway, parked car, fence, shed, bins ────────────────
        ctx(w * 0.34, -(d / 2 + 0.95), 0.03, 0.9, 0.02, 1.6, '#8f8b82'); // front path
        if (r2 < 0.7) { // parked car on the drive
            const cc = pick(['#7a3a34', '#3e434a', '#8a8f96', '#5d6470', '#cfe6ef'], r1);
            ctx(w * 0.34, -(d / 2 + 0.95), 0.26, 0.42, 0.26, 0.95, cc);
            ctx(w * 0.34, -(d / 2 + 1.12), 0.42, 0.38, 0.18, 0.5, '#28323c');
        }
        if (r4 < 0.85) { // low fence along the street edge
            ctx(-w / 2 - 0.1, -(d / 2 + 1.55), 0.28, 0.04, 0.55, PLOT_EDGE, pick(FENCE, r3));
        }
        if (r3 < 0.5) { // garden shed at the rear
            ctx(-w * 0.28, d / 2 + 0.75, 0.32, 0.8, 0.6, 0.62, pick(SHED, r2));
            ctx(-w * 0.28, d / 2 + 0.75, 0.66, 0.88, 0.06, 0.7, '#6e675e');
        }
        ctx(w * 0.1, d / 2 + 0.9, 0.22, 0.16, 0.42, 0.4, '#3a4148'); // bins
        ctx(w * 0.22, d / 2 + 0.92, 0.22, 0.16, 0.42, 0.4, '#3a4148');
        // era upgrades: rooftop solar + green roof on modern tiers
        if (opts.era >= 1 && r2 < 0.5)
            addBox('solarRoof', 0, 0.1, wallH + 0.66, w * 0.5, 0.04, 0.5, '#1d2f52');
        if (opts.era >= 2 && r3 < 0.4)
            addBox('greenRoof', w * 0.2, -0.2, wallH + 0.64, w * 0.4, 0.05, d * 0.35, '#4a7a3c');
    }
    else if (plot.kind === 'apartment') {
        // ── apartment block: 3–6 storeys, balconies, parapet, roof equipment ────
        const floors = 3 + Math.floor(r1 * 4) + (tier >= 1 ? 1 : 0);
        const w = 2.6 + r2 * 0.7;
        const d = 1.7 + r3 * 0.3;
        const wallH = floors * FLOOR;
        height = wallH + 0.3;
        const wallColor = pick(walls, r4);
        if (state === 'construction') {
            addBox('shell', 0, 0, wallH * 0.45, w, wallH * 0.9, d, CONCRETE);
            addBox('craneMast', 0, -2.1, wallH * 0.8, 0.14, wallH * 1.6, 0.14, '#c9803a');
            addBox('craneBoom', 0.9, -1.4, wallH * 1.55, 2.4, 0.11, 0.11, '#c9803a');
            return { plot, tier, state, parts, height };
        }
        if (state === 'derelict') {
            ruinParts({
                w, d, wallH, wallColor, storeys: floors,
                roofColor: pick(ROOF_T2, r1), gable: false,
            });
            return { plot, tier, state, parts, height: wallH * 0.45 };
        }
        addBox('wall', 0, 0, wallH / 2, w, wallH, d, wallColor);
        parts[parts.length - 1].family = tier === 0 ? (r1 < 0.6 ? 'plaster' : 'brick') : 'concrete';
        addBox('flatroof', 0, 0, wallH + 0.07, w + 0.06, 0.14, d + 0.06, pick(ROOF_T2, r1));
        parts[parts.length - 1].family = 'membrane';
        // entrance bay (slightly protruding, with door + canopy)
        addBox('wall', 0, -(d / 2 + 0.06), 0.75, 0.9, 1.5, 0.12, pick(WALL_T0, r2));
        addBox('door', 0, -(d / 2 + 0.14), 0.45, 0.34, 0.85, 0.06, pick(DOOR, r3));
        addBox('canopy', 0, -(d / 2 + 0.22), 1.05, 1.0, 0.06, 0.4, '#6e6a62');
        // façade windows + balconies per floor (skip ground floor front = entrance)
        const bays = Math.max(3, Math.round(w / 0.85));
        for (let f = 1; f < floors; f++) {
            const y = f * FLOOR + FLOOR * 0.55;
            winRow(-w / 2 + 0.2, w / 2 - 0.2, y, -(d / 2 + 0.02), bays, 0);
            // string course: floor-slab band articulates the facade
            addBox('flatroof', 0, -(d / 2 + 0.01), f * FLOOR + 0.02, w, 0.07, 0.06, pick(['#b8b2a4', '#a8a296', '#c4beb0'], f));
            parts[parts.length - 1].family = 'membrane';
            if (f % 2 === 1 && r2 > 0.25) {
                addBox('balcony', 0, -(d / 2 + 0.3), y - 0.18, w * 0.72, 0.08, 0.55, '#c9c2b4');
                addBox('rail', 0, -(d / 2 + 0.55), y + 0.12, w * 0.72, 0.42, 0.04, '#8a8478');
            }
        }
        // rear & side windows
        winRow(-w / 2 + 0.2, w / 2 - 0.2, FLOOR * 1.55, d / 2 + 0.02, Math.max(2, bays - 1), 0);
        // downpipes at the corners
        ctx(-w / 2 - 0.03, d / 2 - 0.1, wallH * 0.45, 0.05, wallH * 0.9, 0.05, '#8a8478');
        ctx(w / 2 + 0.03, d / 2 - 0.1, wallH * 0.45, 0.05, wallH * 0.9, 0.05, '#8a8478');
        // rooftop equipment
        const acN = 1 + Math.floor(r3 * 2);
        for (let i = 0; i < acN; i++)
            addBox('ac', (i - 0.5) * 0.5, 0.2, wallH + 0.26, 0.3, 0.22, 0.28, '#9aa0a6');
        if (r1 < 0.5)
            addBox('stack', w * 0.3, d * 0.2, wallH + 0.5, 0.12, 0.7, 0.12, '#7a7268');
        if (opts.era >= 1 && r2 < 0.45)
            addBox('solarRoof', -w * 0.2, 0, wallH + 0.18, w * 0.5, 0.05, d * 0.4, '#1d2f52');
        if (opts.era >= 2 && r4 < 0.35)
            addBox('greenRoof', w * 0.25, -d * 0.2, wallH + 0.18, w * 0.4, 0.06, d * 0.35, '#4a7a3c');
    }
    else if (plot.kind === 'office' || plot.kind === 'civic') {
        // ── offices: towers with glass bands; civic: stone with portico ─────────
        const floors = plot.kind === 'office' ? 5 + Math.floor(r1 * 5) + tier : 2 + Math.floor(r1 * 2);
        const w = 2.5 + r2 * 0.9;
        const d = 2.0 + r3 * 0.5;
        const wallH = floors * FLOOR;
        height = wallH + 0.4;
        if (state === 'construction') {
            addBox('shell', 0, 0, wallH * 0.45, w, wallH * 0.9, d, CONCRETE);
            addBox('craneMast', 0, -2.2, wallH * 0.85, 0.15, wallH * 1.7, 0.15, '#c9803a');
            addBox('craneBoom', 1.0, -1.5, wallH * 1.66, 2.6, 0.12, 0.12, '#c9803a');
            return { plot, tier, state, parts, height };
        }
        if (state === 'derelict') {
            ruinParts({
                w, d, wallH, storeys: floors, gable: false,
                wallColor: pick(['#c4b8a4', '#bfb3a0', '#cbc0ac'], r1),
                roofColor: '#8a8276',
            });
            return { plot, tier, state, parts, height: wallH * 0.45 };
        }
        if (plot.kind === 'civic') {
            const stone = pick(['#c4b8a4', '#bfb3a0', '#cbc0ac'], r1);
            addBox('wall', 0, 0, wallH / 2, w, wallH, d, stone);
            addBox('flatroof', 0, 0, wallH + 0.09, w + 0.1, 0.18, d + 0.1, '#8a8276');
            // portico: 3 columns + pediment
            for (let i = -1; i <= 1; i++)
                addBox('wall', i * 0.6, -(d / 2 + 0.3), wallH * 0.4, 0.14, wallH * 0.8, 0.14, '#d8d0be');
            addBox('canopy', 0, -(d / 2 + 0.32), wallH * 0.86, 2.0, 0.12, 0.7, '#d8d0be');
            winRow(-w / 2 + 0.25, w / 2 - 0.25, wallH * 0.55, -(d / 2 + 0.02), 4, 0);
        }
        else {
            const pier = pick(walls, r2);
            const glass = tier === 2 ? '#3e5666' : '#43545e';
            addBox('wall', 0, 0, wallH / 2, w, wallH, d, pier);
            parts[parts.length - 1].family = tier === 0 ? 'concrete' : tier === 1 ? 'panel' : 'concrete';
            // continuous glass bands between piers on the street face
            for (let f = 0; f < floors; f++) {
                const y = f * FLOOR + FLOOR * 0.55;
                const p = at(0, -(d / 2 + 0.03), y);
                parts.push({ kind: 'glassBand', x: p.x, y, z: p.z, sx: w * 0.86, sy: FLOOR * 0.62, sz: 0.07, rotY: plot.rot, color: glass, lit: true });
            }
            // side glass
            for (let f = 0; f < floors; f++) {
                const y = f * FLOOR + FLOOR * 0.55;
                const p = at(w / 2 + 0.03, 0, y);
                parts.push({ kind: 'glassBand', x: p.x, y, z: p.z, sx: 0.07, sy: FLOOR * 0.62, sz: d * 0.8, rotY: plot.rot, color: glass, lit: true });
            }
            // setback crown at higher tiers
            if (tier >= 1)
                addBox('wall', 0, 0, wallH + 0.2, w * 0.55, 0.4, d * 0.55, pier);
            addBox('flatroof', 0, 0, wallH + 0.07, w + 0.06, 0.14, d + 0.06, pick(ROOF_T2, r1));
            addBox('ac', w * 0.2, -d * 0.15, wallH + 0.3, 0.34, 0.26, 0.3, '#9aa0a6');
            if (r3 < 0.4)
                addBox('stack', -w * 0.25, d * 0.2, wallH + 0.55, 0.14, 0.8, 0.14, '#7a7268');
            // ground-floor lobby
            addBox('canopy', 0, -(d / 2 + 0.2), 1.15, 1.4, 0.08, 0.5, '#3a3f45');
        }
    }
    else {
        // ── industrial: shed with sawtooth roof, clerestory, loading doors ─────
        const w = 3.2 + r1 * 1.2;
        const d = 2.4 + r2 * 0.8;
        const wallH = 1.5 + r3 * 0.6;
        height = wallH + 1.0;
        if (state === 'construction') {
            addBox('shell', 0, 0, wallH * 0.45, w, wallH * 0.9, d, CONCRETE);
            addBox('craneMast', 0, -2.4, wallH, 0.16, wallH * 2, 0.16, '#c9803a');
            addBox('craneBoom', 1.2, -1.6, wallH * 1.9, 3.0, 0.12, 0.12, '#c9803a');
            return { plot, tier, state, parts, height };
        }
        if (state === 'derelict') {
            ruinParts({
                w, d, wallH, storeys: 2, gable: false,
                wallColor: '#7e848c', roofColor: pick(ROOF_T1, r1),
            });
            return { plot, tier, state, parts, height: wallH * 0.45 };
        }
        const shedColor = pick(['#8a8f96', '#7e848c', '#949aa2'], r4);
        addBox('wall', 0, 0, wallH / 2, w, wallH, d, shedColor);
        parts[parts.length - 1].family = r1 < 0.5 ? 'panel' : 'concrete';
        // sawtooth roof: 2 ridges stepping up toward the street
        addBox('gable', -w * 0.24, 0, wallH + 0.18, w * 0.52, 0.42, d + 0.15, pick(ROOF_T1, r1));
        parts[parts.length - 1].family = 'seam';
        addBox('gable', w * 0.26, 0, wallH + 0.34, w * 0.5, 0.42, d + 0.15, pick(ROOF_T1, r2));
        parts[parts.length - 1].family = 'seam';
        // clerestory glass between the sawteeth
        {
            const p = at(0, 0, wallH + 0.28);
            parts.push({ kind: 'glassBand', x: p.x, y: p.y, z: p.z, sx: w * 0.9, sy: 0.3, sz: d * 0.85, rotY: plot.rot, color: '#39424c', lit: true });
        }
        // loading doors on the yard side
        addBox('door', -w * 0.25, d / 2 + 0.04, 0.6, 0.8, 1.1, 0.06, '#5a6068');
        addBox('door', w * 0.25, d / 2 + 0.04, 0.6, 0.8, 1.1, 0.06, '#5a6068');
        // office block attached at the corner
        addBox('wall', w * 0.34, -(d / 2 + 0.35), 0.55, 0.8, 1.1, 0.6, pick(walls, r1));
        winRow(w * 0.34, w * 0.34, 0.55, -(d / 2 + 0.68), 2, 0);
        // stack for heavy industry
        if (r2 < 0.55)
            addBox('stack', -w * 0.3, d * 0.1, wallH + 1.1, 0.22, 2.2, 0.22, '#6e6a64');
        if (opts.era >= 1 && r1 < 0.4)
            addBox('solarRoof', 0, 0, wallH + 0.6, w * 0.6, 0.05, d * 0.5, '#1d2f52');
    }
    return { plot, tier, state, parts, height };
}
