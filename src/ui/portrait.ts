// ─────────────────────────────────────────────────────────────────────────────
// PORTRAITS — deterministic documentary-style character images, drawn on a
// canvas at runtime from the character's own identity (name, role, civ, age,
// mood). No faces: a rim-lit silhouette bust in role attire, against the
// skyline of the city they are based in. Avoids uncanny generated faces while
// giving each person real presence; the same seed always draws the same
// portrait, so a character keeps their image across sessions and branches.
// ─────────────────────────────────────────────────────────────────────────────
import type { CivId } from '../sim';
import { CIV_TINT } from './shared';

export interface PortraitSubject {
  id: string;
  name: string;
  role: string;
  civId: CivId;
  age: number;
  mood: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, string>();

/** Draws the portrait and returns a data URL. Identical inputs → identical image. */
export function characterPortrait(c: PortraitSubject, w = 220, h = 260): string {
  const key = `${c.id}|${c.name}|${c.role}|${c.civId}|${c.age}|${c.mood.toFixed(2)}|${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  const R = rng(hash(c.id + c.name));

  const tint = CIV_TINT[c.civId] ?? '#5B8CFF';
  const role = c.role.toLowerCase();

  // ── backdrop: evening sky over their city's skyline ──────────────────────
  const sky = g.createLinearGradient(0, 0, 0, h);
  const dim = c.mood < -0.3 ? 0.55 : c.mood < 0.1 ? 0.34 : 0.2;   // troubled mood = darker sky
  sky.addColorStop(0, `rgba(10,14,22,${0.96 - dim * 0.4})`);
  sky.addColorStop(0.62, `rgba(16,22,34,0.92)`);
  sky.addColorStop(1, '#0a0d14');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // faint warm band at the horizon (city glow)
  const glow = g.createLinearGradient(0, h * 0.52, 0, h * 0.8);
  glow.addColorStop(0, 'rgba(0,0,0,0)');
  glow.addColorStop(1, c.mood > 0.1 ? 'rgba(255,190,120,0.20)' : 'rgba(90,120,180,0.14)');
  g.fillStyle = glow;
  g.fillRect(0, h * 0.5, w, h * 0.36);

  // skyline: procedural building blocks with a few lit windows
  const baseY = h * 0.86;
  let bx = -4;
  while (bx < w + 8) {
    const bw = 8 + R() * 16;
    const bh = 10 + R() * (role.includes('minister') || role.includes('director') ? 44 : 30);
    g.fillStyle = 'rgba(14,18,28,0.94)';
    g.fillRect(bx, baseY - bh, bw, bh);
    // lit windows
    const litN = 1 + Math.floor(R() * 4);
    for (let k = 0; k < litN; k++) {
      g.fillStyle = `rgba(255,214,150,${0.25 + R() * 0.4})`;
      g.fillRect(bx + 2 + R() * (bw - 5), baseY - bh + 3 + R() * (bh - 8), 2, 3);
    }
    bx += bw + 2 + R() * 5;
  }
  // haze over the skyline for depth
  const haze = g.createLinearGradient(0, baseY - 26, 0, baseY + 8);
  haze.addColorStop(0, 'rgba(10,13,20,0)');
  haze.addColorStop(1, 'rgba(10,13,20,0.85)');
  g.fillStyle = haze;
  g.fillRect(0, baseY - 30, w, 40);

  // ── figure: silhouette bust in role attire, rim-lit on one side ──────────
  const cx = w / 2;
  const headR = w * 0.135 * (c.age > 60 ? 0.97 : 1.02);
  const headCy = h * 0.44;
  const shoulderW = w * (role.includes('labor') || role.includes('union') ? 0.62 : 0.56);
  const shoulderY = h * 0.78;

  // attire silhouette
  g.fillStyle = '#07090d';
  g.beginPath();
  g.moveTo(cx - shoulderW / 2, h);
  g.quadraticCurveTo(cx - shoulderW / 2 + 4, shoulderY, cx - headR * 1.7, shoulderY - 6);
  g.lineTo(cx - headR * 0.9, headCy + headR * 1.15);
  g.lineTo(cx + headR * 0.9, headCy + headR * 1.15);
  g.lineTo(cx + headR * 1.7, shoulderY - 6);
  g.quadraticCurveTo(cx + shoulderW / 2 - 4, shoulderY, cx + shoulderW / 2, h);
  g.closePath();
  g.fill();

  // role attire hints (drawn as silhouette notches so they read without colour)
  g.fillStyle = '#07090d';
  if (role.includes('engineer') || role.includes('energy') || role.includes('grid')) {
    // hard-hat brim: a short horizontal ledge over the brow
    g.fillRect(cx - headR * 1.25, headCy - headR * 0.42, headR * 2.5, headR * 0.22);
  } else if (role.includes('labor') || role.includes('union')) {
    // flat cap
    g.fillRect(cx - headR * 1.15, headCy - headR * 0.92, headR * 2.3, headR * 0.5);
  } else if (role.includes('research') || role.includes('science') || role.includes('ai')) {
    // collar band of a lab coat
    g.fillRect(cx - headR * 0.55, shoulderY - 4, headR * 1.1, headR * 0.3);
  } else {
    // suit lapels: two thin wedges below the chin
    g.beginPath();
    g.moveTo(cx, headCy + headR * 1.2);
    g.lineTo(cx - headR * 0.55, shoulderY - 2);
    g.lineTo(cx - headR * 0.15, shoulderY - 2);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(cx, headCy + headR * 1.2);
    g.lineTo(cx + headR * 0.55, shoulderY - 2);
    g.lineTo(cx + headR * 0.15, shoulderY - 2);
    g.closePath(); g.fill();
  }

  // head silhouette
  g.beginPath();
  g.ellipse(cx, headCy, headR * 0.86, headR * 1.06, 0, 0, Math.PI * 2);
  g.fill();

  // rim light on the civ-tint side: two strokes tracing the figure
  g.strokeStyle = tint;
  g.lineCap = 'round';
  g.globalAlpha = 0.85;
  g.lineWidth = 2.2;
  g.beginPath();
  g.ellipse(cx, headCy, headR * 0.86, headR * 1.06, 0, -Math.PI * 0.62, Math.PI * 0.12);
  g.stroke();
  g.beginPath();
  g.moveTo(cx + headR * 1.62, shoulderY - 4);
  g.quadraticCurveTo(cx + shoulderW / 2 - 4, shoulderY, cx + shoulderW / 2, h);
  g.stroke();
  g.globalAlpha = 1;

  // ── photographic grain ───────────────────────────────────────────────────
  const grainN = Math.floor(w * h / 90);
  for (let k = 0; k < grainN; k++) {
    g.fillStyle = `rgba(255,255,255,${0.015 + R() * 0.02})`;
    g.fillRect(R() * w, R() * h, 1, 1);
  }
  // vignette
  const vig = g.createRadialGradient(w / 2, h * 0.46, h * 0.28, w / 2, h * 0.5, h * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);

  const url = cv.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
