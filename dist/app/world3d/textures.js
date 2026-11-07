// ─────────────────────────────────────────────────────────────────────────────
// TEXTURES — procedural canvas textures for every surface family. Generated
// once at startup, distributed with the build (no external asset pipeline is
// needed or used). Each texture is tileable and applied through a world-space
// UV patch (worldUV.ts) so texel density stays true to meters regardless of
// instance scale.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    return [c, ctx];
}
function toTexture(c, srgb = true) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb)
        t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
let seedState = 77;
function rand() {
    seedState = (seedState * 16807) % 2147483647;
    return seedState / 2147483647;
}
export function textureSeed(s) { seedState = s >>> 0 || 1; }
// smooth value noise on a lattice, for blotches
function latticeNoise(size, cells) {
    const g = [];
    const n = cells + 1;
    for (let i = 0; i < n; i++) {
        g[i] = [];
        for (let j = 0; j < n; j++)
            g[i][j] = rand();
    }
    const out = [];
    for (let y = 0; y < size; y++) {
        out[y] = [];
        const gy = (y / size) * cells, yi = Math.floor(gy), yf = gy - yi;
        const v = yf * yf * (3 - 2 * yf);
        for (let x = 0; x < size; x++) {
            const gx = (x / size) * cells, xi = Math.floor(gx), xf = gx - xi;
            const u = xf * xf * (3 - 2 * xf);
            out[y][x] =
                g[yi][xi] * (1 - u) * (1 - v) + g[yi][xi + 1] * u * (1 - v) +
                    g[yi + 1][xi] * (1 - u) * v + g[yi + 1][xi + 1] * u * v;
        }
    }
    return out;
}
// ── facades ──────────────────────────────────────────────────────────────────
// Plastered masonry: fine color noise, faint streaks under floor lines
export function plasterFacade(base) {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const blotch = latticeNoise(S, 7);
    const img = ctx.getImageData(0, 0, S, S);
    const [br, bg, bb] = [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)];
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            const n = blotch[y][x];
            const i = (y * S + x) * 4;
            const m = 0.82 + n * 0.3;
            img.data[i] = br * m;
            img.data[i + 1] = bg * m;
            img.data[i + 2] = bb * m;
        }
    ctx.putImageData(img, 0, 0);
    // faint horizontal weathering streaks
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#3a3a38';
    for (let i = 0; i < 24; i++) {
        const x = rand() * S, w = 2 + rand() * 6, h = 8 + rand() * 40;
        ctx.fillRect(x, 0, w, h);
    }
    ctx.globalAlpha = 1;
    // micro grain
    return toTexture(c);
}
// Running-bond brick with mortar courses
export function brickFacade(base, mortar) {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, S, S);
    const bh = 8, bw = 22; // px per brick (texel density from worldUV)
    const rng = () => rand();
    for (let row = 0; row * bh < S + bh; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let bx = -bw; bx < S + bw; bx += bw) {
            const v = 0.78 + rng() * 0.36;
            const r = parseInt(base.slice(1, 3), 16) * v | 0;
            const g = parseInt(base.slice(3, 5), 16) * v | 0;
            const b = parseInt(base.slice(5, 7), 16) * v | 0;
            ctx.fillStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
            ctx.fillRect(bx + off + 1, row * bh + 1, bw - 2, bh - 2);
        }
    }
    // soot / aging on lower rows
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(0, S * 0.62, S, S * 0.38);
    ctx.globalAlpha = 1;
    return toTexture(c);
}
// Precast concrete panels: board joints, tie holes, subtle streaks
export function concreteFacade(base) {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const blotch = latticeNoise(S, 5);
    const img = ctx.getImageData(0, 0, S, S);
    const [br, bg, bb] = [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)];
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            const i = (y * S + x) * 4;
            const n = blotch[y][x];
            const m = 0.86 + n * 0.22;
            img.data[i] = br * m;
            img.data[i + 1] = bg * m;
            img.data[i + 2] = bb * m;
        }
    ctx.putImageData(img, 0, 0);
    // panel joints: vertical every 64px + horizontal every 85px
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= S; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, S);
        ctx.stroke();
    }
    for (let y = 0; y <= S; y += 85) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
        ctx.stroke();
    }
    // form tie holes
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 42; y < S; y += 85)
        for (let x = 32; x < S; x += 64) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 7);
            ctx.fill();
        }
    // rain streaks under joints
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#4a4640';
    for (let x = 0; x < S; x += 64)
        ctx.fillRect(x + 6, 0, 3, S);
    ctx.globalAlpha = 1;
    return toTexture(c);
}
// Vertical composite/siding panels (modern)
export function panelFacade(base) {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const blotch = latticeNoise(S, 6);
    const img = ctx.getImageData(0, 0, S, S);
    const [br, bg, bb] = [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)];
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            const i = (y * S + x) * 4;
            const n = blotch[y][x];
            const m = 0.9 + n * 0.16;
            img.data[i] = br * m;
            img.data[i + 1] = bg * m;
            img.data[i + 2] = bb * m;
        }
    ctx.putImageData(img, 0, 0);
    // vertical seams + shadow gaps
    for (let x = 0; x < S; x += 32) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, 0, 2, S);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + 2, 0, 1, S);
    }
    return toTexture(c);
}
// ── roofs ────────────────────────────────────────────────────────────────────
export function tileRoof(base) {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const rows = 8, cols = 16;
    for (let r = 0; r < rows; r++)
        for (let col = 0; col < cols; col++) {
            const v = 0.82 + rand() * 0.3;
            const r0 = parseInt(base.slice(1, 3), 16) * v | 0;
            const g0 = parseInt(base.slice(3, 5), 16) * v | 0;
            const b0 = parseInt(base.slice(5, 7), 16) * v | 0;
            ctx.fillStyle = `rgb(${r0},${g0},${b0})`;
            const w = S / cols, h = S / rows;
            ctx.fillRect(col * w + 1, r * h + 2, w - 2, h - 4);
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(col * w, r * h + h - 3, w, 3); // shadow course
        }
    return toTexture(c);
}
export function seamRoof(base) {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 24) {
        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.fillRect(x, 0, 3, S);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 3, 0, 2, S);
    }
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#000';
    for (let i = 0; i < 40; i++)
        ctx.fillRect(rand() * S, rand() * S, 8 + rand() * 30, 2);
    ctx.globalAlpha = 1;
    return toTexture(c);
}
export function membraneRoof(base) {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    const blotch = latticeNoise(S, 8);
    const img = ctx.getImageData(0, 0, S, S);
    const [br, bg, bb] = [parseInt(base.slice(1, 3), 16), parseInt(base.slice(3, 5), 16), parseInt(base.slice(5, 7), 16)];
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            const i = (y * S + x) * 4;
            const m = 0.88 + blotch[y][x] * 0.2;
            img.data[i] = br * m;
            img.data[i + 1] = bg * m;
            img.data[i + 2] = bb * m;
        }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= S; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
        ctx.stroke();
    }
    return toTexture(c);
}
// ── ground ───────────────────────────────────────────────────────────────────
// grayscale micro-detail multiplied by terrain vertex colors
export function groundDetail() {
    const S = 512;
    const [c, ctx] = canvas(S);
    const blotch = latticeNoise(S, 24);
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            const i = (y * S + x) * 4;
            const n = blotch[y][x];
            const v = 168 + n * 80 + (rand() - 0.5) * 26;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, false);
}
// asphalt with wear and patches
export function asphaltTex() {
    const S = 256;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = '#2c3036';
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const grainy = latticeNoise(S, 40);
    for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
            const i = (y * S + x) * 4;
            const n = grainy[y][x];
            const m = 0.8 + n * 0.5;
            img.data[i] *= m;
            img.data[i + 1] *= m;
            img.data[i + 2] *= m;
        }
    ctx.putImageData(img, 0, 0);
    // patched repairs (slightly different tone)
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#3a3f46' : '#26292e';
        ctx.fillRect(rand() * S, rand() * S, 20 + rand() * 60, 8 + rand() * 26);
    }
    ctx.globalAlpha = 1;
    return toTexture(c);
}
// ── foliage ──────────────────────────────────────────────────────────────────
// leaf-cluster alpha cards: blobs with holes, used with transparent material
export function leafCard(dark) {
    const S = 128;
    const [c, ctx] = canvas(S);
    ctx.clearRect(0, 0, S, S);
    const [dr, dg, db] = [parseInt(dark.slice(1, 3), 16), parseInt(dark.slice(3, 5), 16), parseInt(dark.slice(5, 7), 16)];
    // cluster centers → random leaf blobs
    for (let i = 0; i < 46; i++) {
        const x = rand() * S, y = rand() * S;
        const r = 6 + rand() * 16;
        const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
        const v = 0.62 + rand() * 0.55;
        grad.addColorStop(0, `rgba(${dr * v | 0},${dg * v | 0},${db * v | 0},1)`);
        grad.addColorStop(1, `rgba(${dr * v | 0},${dg * v | 0},${db * v | 0},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 7);
        ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
// bark
export function barkTex() {
    const S = 128;
    const [c, ctx] = canvas(S);
    ctx.fillStyle = '#4a3a28';
    ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 6) {
        ctx.fillStyle = `rgba(0,0,0,${0.12 + rand() * 0.2})`;
        ctx.fillRect(x, 0, 2 + rand() * 2, S);
    }
    return toTexture(c);
}
