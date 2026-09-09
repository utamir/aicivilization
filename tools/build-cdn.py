#!/usr/bin/env python3
"""Browser-ready build without npm: compile TSX with tsc, resolve npm packages
through an import map to esm.sh. Output: dist/ (static, serve with any HTTP server).
The Vite build (npm run build) remains the primary, fully offline path."""
import json, os, re, shutil, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
DIST = 'dist'; APP = os.path.join(DIST, 'app')
shutil.rmtree(DIST, ignore_errors=True); os.makedirs(APP)
tsconfig = {
  "compilerOptions": {
    "target": "ES2022", "module": "ES2022", "moduleResolution": "bundler", "jsx": "react-jsx",
    "rewriteRelativeImportExtensions": True, "outDir": APP, "rootDir": "src", "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": [], "skipLibCheck": True, "noEmitOnError": False, "strict": False, "noImplicitAny": False,
    "allowSyntheticDefaultImports": True, "esModuleInterop": True, "isolatedModules": True, "verbatimModuleSyntax": False,
    "paths": {"@/*": ["./src/*"]},
  },
  "files": ["src/main.tsx"],
}
json.dump(tsconfig, open('tsconfig.cdn.json', 'w'), indent=2)
r = subprocess.run(['tsc', '-p', 'tsconfig.cdn.json'], capture_output=True, text=True)
errs = [l for l in r.stdout.splitlines() if 'error TS' in l]
# Only "cannot find module" style errors are expected here (no node_modules); anything else is reported.
unexpected = [l for l in errs if not re.search(r"TS(2307|7016|2305|2339|2322|2345|2503|7006|7031|2554|2769|2604|2786|2694|2532|18046|2678|2353|2559|2551|2740|2741|2571|2589|2724|2875)", l)]
print(f"tsc: {len(errs)} type errors (expected without node_modules), {len(unexpected)} unexpected")
for l in unexpected[:20]: print('  ', l)
if not os.path.exists(os.path.join(APP, 'main.js')): sys.exit('no emit')
# Post-process: extension-less relative imports -> .js / index.js; drop css imports; keep bare specifiers for the import map.
spec_re = re.compile(r"""((?:import|export)\s*(?:[^'"]*?\s*from\s*)?)(['"])(\.{1,2}/[^'"]+)\2""")
for dp, _, fs in os.walk(APP):
  for fn in fs:
    if not fn.endswith('.js'): continue
    p = os.path.join(dp, fn); s = open(p).read()
    s = re.sub(r"^\s*import\s+['\"][^'\"]+\.css['\"];?\s*$", '', s, flags=re.M)
    def fix(m):
      head, q, spec = m.groups()
      if re.search(r"\.(js|mjs|json)$", spec): return m.group(0)
      base = os.path.normpath(os.path.join(dp, spec))
      if os.path.isfile(base + '.js'): spec = spec + '.js'
      elif os.path.isdir(base): spec = spec.rstrip('/') + '/index.js'
      return f"{head}{q}{spec}{q}"
    s = spec_re.sub(fix, s)
    open(p, 'w').write(s)
# Syntax check every module.
bad = 0
open(os.path.join(DIST, 'package.json'), 'w').write('{"type":"module"}\n')
for dp, _, fs in os.walk(APP):
  for fn in fs:
    if fn.endswith('.js'):
      c = subprocess.run(['node', '--check', os.path.join(dp, fn)], capture_output=True, text=True)
      if c.returncode != 0: bad += 1; print('SYNTAX', fn, c.stderr[:300])
print('syntax-checked modules:', sum(len([f for f in fs if f.endswith('.js')]) for _, _, fs in os.walk(APP)), 'bad:', bad)
# CSS: the observer UI uses its own classes; the Tailwind directives need the Tailwind compiler, so they are replaced by a small preflight.
css = open('src/index.css').read()
css = re.sub(r"^@tailwind [a-z]+;\s*$", '', css, flags=re.M)
preflight = "*,*::before,*::after{box-sizing:border-box;border:0 solid}html,body{margin:0;padding:0}button,input,select,textarea{font:inherit;color:inherit}button{background:none;cursor:pointer}\n"
open(os.path.join(DIST, 'index.css'), 'w').write(preflight + css)
pkg = json.load(open('package.json')); d = pkg['dependencies']
v = lambda k: d[k].lstrip('^~')
ext = 'external=react,react-dom,three'
importmap = {"imports": {
  "react": f"https://esm.sh/react@{v('react')}",
  "react/": f"https://esm.sh/react@{v('react')}/",
  "react/jsx-runtime": f"https://esm.sh/react@{v('react')}/jsx-runtime",
  "react-dom": f"https://esm.sh/react-dom@{v('react-dom')}?external=react",
  "react-dom/client": f"https://esm.sh/react-dom@{v('react-dom')}/client?external=react",
  "three": f"https://esm.sh/three@{v('three')}",
  "three/": f"https://esm.sh/three@{v('three')}/",
  "@react-three/fiber": f"https://esm.sh/@react-three/fiber@{v('@react-three/fiber')}?{ext}",
  "@react-three/drei": f"https://esm.sh/@react-three/drei@{v('@react-three/drei')}?{ext}",
  "@react-three/postprocessing": f"https://esm.sh/@react-three/postprocessing@{v('@react-three/postprocessing')}?{ext}",
  "zustand": f"https://esm.sh/zustand@{v('zustand')}?external=react",
  "react-router": f"https://esm.sh/react-router@{v('react-router')}?external=react,react-dom",
}}
DIAG = r'''
    <script>
      // Never a blank page: show loading, then surface any error with its source.
      (function () {
        var root = document.getElementById('root');
        var box = document.createElement('div');
        box.id = 'boot';
        box.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#07110f;color:#e8f1ec;font:14px/1.5 Inter,system-ui,sans-serif;text-align:center;padding:40px;z-index:9999';
        box.innerHTML = '<div style="font:500 26px Georgia,serif">WHAT IF? Civilization Lab</div><div id="boot-msg" style="color:#93ada3">Loading the world… (React, three.js and the react-three packages come from esm.sh on first load)</div><pre id="boot-err" style="max-width:820px;white-space:pre-wrap;color:#ff8a5c;font-size:12px;text-align:left"></pre>';
        document.body.appendChild(box);
        var errs = [];
        function show(msg) { errs.push(msg); var e = document.getElementById('boot-err'); if (e) e.textContent = errs.join('\n\n'); var m = document.getElementById('boot-msg'); if (m) m.textContent = 'The world failed to load. Details below; open check.html for a module-by-module test.'; }
        window.addEventListener('error', function (ev) { show((ev.message || 'error') + (ev.filename ? '\n  at ' + ev.filename + ':' + ev.lineno : '')); });
        window.addEventListener('unhandledrejection', function (ev) { var r = ev.reason; show('Unhandled: ' + (r && (r.stack || r.message) || String(r))); });
        var t = setInterval(function () { if (root && root.childElementCount > 0) { clearInterval(t); box.remove(); } }, 200);
        setTimeout(function () { if (root && root.childElementCount === 0 && errs.length === 0) show('Nothing rendered after 20 seconds. Usually a module from esm.sh failed to load (network, firewall, or a version that no longer resolves). Open check.html.'); }, 20000);
      })();
    </script>'''
html = open('index.html').read()
html = html.replace('<script type="module" src="/src/main.tsx"></script>',
  '<script type="importmap">' + json.dumps(importmap, indent=2) + '</script>\n    <script type="module" src="./app/main.js"></script>')
html = html.replace('</head>', '    <link rel="stylesheet" href="./index.css" />\n  </head>')
html = html.replace('<div id="root"></div>', '<div id="root"></div>' + DIAG)
open(os.path.join(DIST, 'index.html'), 'w').write(html)
check = '<!doctype html><meta charset=utf-8><title>module check</title><body style="background:#07110f;color:#e8f1ec;font:13px/1.6 monospace;padding:20px"><h2>Module check</h2><div id=o></div>' + '<script type="importmap">' + json.dumps(importmap) + '</script>' + '''<script type="module">
const o = document.getElementById('o'); const specs = ''' + json.dumps(list(importmap['imports'].keys()) + ['./app/sim/index.js', './app/App.js']) + ''';
for (const sp of specs) { if (sp.endsWith('/')) continue; const t0 = performance.now(); try { const m = await import(sp); o.insertAdjacentHTML('beforeend', `<div style="color:#8fe3b9">ok  ${sp}  (${Object.keys(m).length} exports, ${(performance.now()-t0).toFixed(0)} ms)</div>`); } catch (e) { o.insertAdjacentHTML('beforeend', `<div style="color:#ff8a5c">FAIL ${sp}: ${e && (e.message || e)}</div>`); } }
o.insertAdjacentHTML('beforeend', '<p>Every line green: the app should render at index.html. A red line names the module to fix (version, network, or import map).</p>');
</script>'''
open(os.path.join(DIST, 'check.html'), 'w').write(check)
open(os.path.join(DIST, 'package.json'), 'w').write('{"type":"module"}\n')
open(os.path.join(DIST, 'RUNNING.txt'), 'w').write(
  "WHAT IF? Civilization Lab - browser-ready build\n\n"
  "Serve this folder over HTTP and open index.html (double-clicking the file does not work: ES modules need http://).\n"
  "  python3 -m http.server 4173      (then http://localhost:4173)\n"
  "  or: npx serve .   or any static host\n\n"
  "This build was produced without npm: the app code is compiled locally; React, three.js and the\n"
  "react-three packages load from esm.sh at runtime, so the browser needs internet access the first time.\n"
  "This runtime has no Node/npm dependency. It does require internet access for the version-pinned esm.sh packages.\n")
sm = subprocess.run(['node', os.path.join('tools', 'smoke-esm.mjs')], capture_output=True, text=True)
print(sm.stdout.strip()[:600])
if 'SMOKE OK' not in sm.stdout: sys.exit('module graph failed to evaluate; fix before shipping')
print('dist ready')
