#!/usr/bin/env node
/**
 * Regenerates the game's illustrations with Google Gemini image generation.
 *
 *   GEMINI_API_KEY=... node tools/snowman-gemini-art.mjs [--only snowman,scarf] [--model gemini-2.5-flash-image]
 *
 * Output: PNG files in assets/sprites/gemini/ (inside site/snowman). When present, the game prefers
 * these PNGs over the built-in SVG sprites (see SPRITES in js/game.js — set
 * USE_GEMINI_ART=true there, or run with --apply to switch automatically).
 *
 * Nothing in the game depends on this script: the SVG sprites work offline.
 * Requires Node 18+ (global fetch). No npm dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site', 'snowman');
const OUT_DIR = path.join(ROOT, 'assets', 'sprites', 'gemini');
const API_KEY = process.env.GEMINI_API_KEY;
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MODEL = argVal('--model', 'gemini-2.5-flash-image');
const ONLY = argVal('--only', '')?.split(',').filter(Boolean);
const APPLY = args.includes('--apply');

if (!API_KEY) {
  console.error('GEMINI_API_KEY is not set. Get a key at https://aistudio.google.com/apikey and re-run.');
  process.exit(1);
}

const STYLE = 'Cute, friendly, flat vector cartoon style for a children\'s mobile game. Soft shading, thick clean outlines, bright cheerful winter palette (sky blue, white, red, gold). Centered subject. PNG with fully transparent background, no text, no watermark.';

/** name -> prompt. Keep names identical to the SVG sprites so they can replace them 1:1. */
const PROMPTS = {
  snowman: `${STYLE} A happy snowman with three snowballs, coal buttons, carrot nose, rosy cheeks, a navy top hat with a light-blue ribbon, stick arms. The right arm is raised holding a snowball, ready to throw. Full body, front view, portrait orientation.`,
  snowman_throw: `${STYLE} The same happy snowman (navy top hat, light-blue ribbon, carrot nose, stick arms) in a throwing pose: right stick arm extended forward to the right, having just released a snowball. Full body, front view, portrait orientation.`,
  snowman_scarf: `${STYLE} The same happy snowman (navy top hat, carrot nose, stick arms) proudly wearing a long knitted RED scarf with gold stripes and fringed ends, smiling widely. Full body, front view, portrait orientation.`,
  snowball: `${STYLE} A single round snowball, fluffy white with subtle blue shading and small sparkles. Square image.`,
  target_bullseye: `${STYLE} A round red-and-white archery bullseye target board, front view, no stand. Square image.`,
  target_can: `${STYLE} A shiny tin can with a yellow label with a red dot, standing upright, front view. Portrait orientation.`,
  target_ice: `${STYLE} A translucent light-blue ice cube block with a crack and highlights, front view. Square image.`,
  target_star: `${STYLE} A glossy golden five-point star with a light inner glow. Square image.`,
  scarf: `${STYLE} A long knitted RED scarf with gold stripes and fringed ends, laid loosely in a gentle curve, as a trophy/prize icon. Landscape orientation.`,
  background: `Flat vector cartoon winter landscape background for a children's mobile game, portrait orientation 9:16: bright blue sky with a soft sun and fluffy clouds at the top, snowy mountains in the middle, a few pine trees, gently rolling white snow hills at the bottom. Clean, cheerful, no characters, no text.`,
  icon: `App icon, square, rounded: a cute cartoon snowman with a red scarf and a navy top hat next to a red bullseye target, on a sky-blue gradient. Flat vector style, no text.`,
};

async function generate(name, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`${name}: no image in response: ${JSON.stringify(json).slice(0, 300)}`);
  const ext = part.inlineData.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const file = path.join(OUT_DIR, `${name}.${ext}`);
  fs.writeFileSync(file, Buffer.from(part.inlineData.data, 'base64'));
  return file;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const names = Object.keys(PROMPTS).filter((n) => !ONLY?.length || ONLY.includes(n));
let ok = 0;
for (const name of names) {
  try {
    const f = await generate(name, PROMPTS[name]);
    ok++;
    console.log('✔', path.relative(ROOT, f));
  } catch (e) {
    console.error('✖', e.message);
  }
}
console.log(`\n${ok}/${names.length} images generated in ${path.relative(ROOT, OUT_DIR)}/`);

if (APPLY && ok > 0) {
  const gamePath = path.join(ROOT, 'js', 'game.js');
  const src = fs.readFileSync(gamePath, 'utf8').replace('const USE_GEMINI_ART = false;', 'const USE_GEMINI_ART = true;');
  fs.writeFileSync(gamePath, src);
  console.log('Switched js/game.js to USE_GEMINI_ART = true');
}
