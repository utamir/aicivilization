// Evaluates the whole dist/app module graph in Node with stubbed npm packages.
// Catches what a browser would hit before React mounts: syntax, missing exports,
// import cycles that read uninitialized bindings, module-scope crashes.
import { register } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const APP = new URL('../dist/app/', import.meta.url);
const names = {};
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) { const s = readFileSync(p, 'utf8'); for (const m of s.matchAll(/import\s*(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^./][^'"]*)['"]/g)) { const spec = m[3]; names[spec] ??= new Set(); if (m[1]) names[spec].add('default'); for (const part of (m[2] || '').split(',')) { const n = part.trim().split(' as ')[0].trim(); if (n) names[spec].add(n); } } for (const m of s.matchAll(/import\s*\*\s*as\s*(\w+)\s*from\s*['"]([^./][^'"]*)['"]/g)) { names[m[2]] ??= new Set(); for (const u of s.matchAll(new RegExp('\\b' + m[1] + '\\.([A-Za-z_$][\\w$]*)', 'g'))) names[m[2]].add(u[1]); } } } };
walk(new URL('../dist/app', import.meta.url).pathname);
globalThis.__stubNames = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, [...v]]));
register(new URL('./smoke-hooks.mjs', import.meta.url), { data: globalThis.__stubNames });
globalThis.window = globalThis; globalThis.document = { getElementById: () => ({ childElementCount: 0 }), createElement: () => ({ getContext: () => ({}), style: {}, querySelector: () => null }), body: { appendChild() {} }, addEventListener() {}, querySelector: () => null };
globalThis.requestAnimationFrame = (f) => setTimeout(f, 16); globalThis.performance ??= { now: () => Date.now() };
globalThis.addEventListener = () => {}; globalThis.localStorage = { getItem: () => null, setItem() {} }; globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
try { await import(new URL('main.js', APP)); console.log('SMOKE OK: whole module graph evaluated; React root render called'); }
catch (e) { console.log('SMOKE FAIL:', e && (e.stack || e)); process.exitCode = 1; }
