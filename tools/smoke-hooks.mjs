let stubNames = {};
export async function initialize(data) { stubNames = data; }
export async function resolve(spec, ctx, next) {
  if (/^[^./]/.test(spec) && !spec.startsWith('node:') && !spec.startsWith('file:')) return { url: 'stub:' + spec, shortCircuit: true };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (!url.startsWith('stub:')) return next(url, ctx);
  const spec = url.slice(5);
  const wanted = new Set([...(stubNames[spec] || []), 'default']);
  const lines = [`const mk = () => { const f = function stub() { return mk(); }; return new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : (k in t ? t[k] : mk()), apply: () => mk(), construct: () => mk() }); };`,
    `const ns = mk();`];
  if (spec === 'react') lines.push(`const state = new Map();`);
  for (const n of wanted) {
    if (n === 'default') lines.push(`export default ns;`);
    else if (spec === 'react-dom/client' && n === 'createRoot') lines.push(`export const createRoot = () => ({ render: () => { globalThis.__rendered = true; }, unmount() {} });`);
    else if (spec === 'react' && n === 'createContext') lines.push(`export const createContext = (d) => ({ Provider: mk(), Consumer: mk(), _d: d });`);
    else if (spec === 'zustand' && n === 'create') lines.push(`export const create = (init) => { let s = {}; const set = (p) => { s = { ...s, ...(typeof p === 'function' ? p(s) : p) }; }; const get = () => s; if (typeof init === 'function') s = init(set, get); const hook = (sel) => (sel ? sel(s) : s); hook.getState = get; hook.setState = set; hook.subscribe = () => () => {}; return hook; };`);
    else lines.push(`export const ${n} = mk();`);
  }
  return { format: 'module', source: lines.join('\n'), shortCircuit: true };
}
