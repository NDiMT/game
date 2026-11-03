#!/usr/bin/env node
/**
 * Bundles site/snowman into ONE self-contained HTML file (CSS, JS and SVG
 * sprites inlined as data URIs). Useful for sending the game as a single
 * file or publishing it where separate assets cannot be served.
 *
 *   node tools/snowman-bundle.mjs [out.html] [--fragment]
 *
 * --fragment  omit <!doctype>/<html>/<head>/<body> wrappers (for hosts that
 *             wrap the page themselves). Default output: dist/snowman.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'site', 'snowman');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || path.join(ROOT, 'dist', 'snowman.html');

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const svgDataUri = (rel) => 'data:image/svg+xml;base64,' + Buffer.from(read(rel)).toString('base64');

// 1. Concatenate ES modules into one module script (order matters).
const modules = ['js/audio.js', 'js/levels.js', 'js/game.js', 'js/ui.js', 'js/main.js'];
let js = modules.map((m) => `// ---- ${m} ----\n` + read(m)
  .replace(/^import\s[^;]*;\s*$/gm, '')
  .replace(/^export\s+(class|const|function|let)\s/gm, '$1 ')
).join('\n');
// No service worker in the single-file build.
js = js.replace(/\/\/ Register the service worker[\s\S]*?\n}\n/, '');

// 2. Inline sprites everywhere they are referenced.
let html = read('index.html');
let css = read('css/style.css');
const sprites = fs.readdirSync(path.join(SRC, 'assets', 'sprites')).filter((f) => f.endsWith('.svg'));
for (const f of sprites) {
  const uri = svgDataUri('assets/sprites/' + f);
  const re = new RegExp('assets/sprites/' + f.replace('.', '\\.'), 'g');
  js = js.replace(re, uri); html = html.replace(re, uri); css = css.replace(re, uri);
}

// 3. Assemble.
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/\s*<link[^>]*(manifest|icon|stylesheet)[^>]*>/g, '')
  .replace(/\s*<meta name="(mobile-web-app-capable|apple-mobile-web-app-[a-z-]+)"[^>]*>/g, '');
let body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/\s*<script type="module" src="js\/main.js"><\/script>/, '');
const titleTag = head.match(/<title>[\s\S]*?<\/title>/)[0];
const metas = head.replace(titleTag, '').trim();

const inner = `${titleTag}
<style>
${css}
</style>
${body}
<script type="module">
${js}
</script>
`;
const doc = fragment ? inner : `<!DOCTYPE html>
<html lang="el">
<head>
${metas}
${inner.replace(/^(<title>[\s\S]*?<\/title>\n<style>[\s\S]*?<\/style>\n)/, '$1</head>\n<body>\n')}
</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, doc);
console.log(`${path.relative(ROOT, out)}  ${(doc.length / 1024).toFixed(0)} KB, ${sprites.length} sprites inlined${fragment ? ' (fragment)' : ''}`);
