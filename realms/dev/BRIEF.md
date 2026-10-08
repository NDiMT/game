# Hex Realms art upgrade: shared brief for all art agents

Game: `/home/user/game/realms/`. This is a HoMM3-like strategy game in Three.js r170, set on a small hex planet. The code is plain ES modules, imported through the importmap `three` → `../vendor/three.module.js`, with no build step.

Read `main.js`, `models.js` and `data.js` to see how models are used today.

The look should be gorgeous, vivid, painterly fantasy in the spirit of Heroes of Might and Magic 3. It is shown on a phone in portrait, so silhouettes must read at small size.

## Hard rules
- **Only edit the files you own** (listed in your task). Never edit `main.js`, `models.js`, `data.js`, `battle.js`, `index.html` or `style.css` unless your task explicitly says so. The lead integrates your module.
- **Do not git commit or push.**
- Keep it fast on phones. Use few draw calls, merge geometry, keep triangle counts modest (a creature ≤ ~2.5k tris, a map object ≤ ~3k, a town ≤ ~8k), and keep canvas textures ≤ 512² (1024² only for one atlas).
- No external assets or network. Everything is procedural: geometry, vertex colours and canvas-generated textures.

## Model contract (creatures, heroes, objects, towns, nature)
- A model function returns `{ body: BufferGeometry, glow: BufferGeometry | null }`.
- `body` has attributes `position`, `normal` and `color` (vertex colours, linear 0..1), and optionally `uv`. It is drawn with a shared `MeshStandardMaterial({ vertexColors: true, flatShading: true })`. If you add `uv`, the shared material may get a detail texture later, so keep `uv` sensible: roughly world-scaled, about 1 unit = 1 UV.
- `glow` holds emissive bits (windows, eyes, magic, fire) drawn with an unlit bright material.
- Orientation and size:
  - Local +Y is up and the base sits at y = 0.
  - Creatures face +Z and are about 1 unit tall. Big tiers (6–7) may be about 1.3–1.6.
  - Map objects and towns fit about a 1.2-unit-wide footprint; the game scales them down onto a hex.
- Reuse the helpers in `models.js` (`kit`, `done`, `mergeParts`, `mulberry32`) or write better ones in your own file. A richer kit is welcome: bevelled boxes, lathe shapes, extrudes, vertex-colour gradients, fake ambient occlusion (darker near the ground), rim highlights.
- Paint with vertex colours generously: gradients, darker crevices, lighter tops, accent trims. Avoid flat single colours.

## Check your work visually
- A static server is already running at `http://localhost:8123/`. If it is not, start one with `cd /home/user/game && nohup python3 -m http.server 8123 &`.
- Make a preview page in `/home/user/game/realms/dev/` named for your task, e.g. `dev/units-haven.html`, that imports your module and renders your models in a turntable grid.
- Screenshot it with Playwright:
  - Import: `import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'`.
  - Launch with `chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })`.
  - Use `devices['Pixel 7']` or a 1000x1000 viewport.
- Look at your screenshots with the Read tool and iterate until it looks great.
- The machine has only 4 CPUs and 10 agents share it. Run one short screenshot script at a time, keep each run under about 60 s, and do not leave browsers open.
- Put scratch scripts and screenshots in `/home/user/game/realms/dev/shots/`, which the lead will delete.

## Hand-back
When done, report:
- the exact exports of your module and how to call them;
- anything the lead must change in `main.js` to integrate it (be precise: function names and what to replace);
- the path of your best screenshot.
