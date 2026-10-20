// node loader: maps the browser importmap specifiers to the vendored files
const map = {
  three: new URL('../vendor/three.module.min.js', import.meta.url).href,
  'cannon-es': new URL('../vendor/cannon-es.js', import.meta.url).href,
};
export async function resolve(spec, ctx, next) { return map[spec] ? { url: map[spec], shortCircuit: true } : next(spec, ctx); }
