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

---
# Round 2 (21 agents): additions to the rules above

- **Brighter, more vivid.** The player said the textures are too dark: "there's a blackness". Use a bright, saturated, sunny HoMM3 palette.
  - Avoid near-black surfaces, heavy dark ambient occlusion and dark outlines.
  - Shadows should be soft and coloured, never black.
  - Check every screenshot for murky areas and lift them.
- **Screenshots must be serialized** because 21 agents share 4 CPUs. Always run browser scripts through the lock, with a timeout:
  `flock /home/user/game/realms/dev/.shotlock timeout 150 node your-script.mjs`
  Keep each run short: one page, few screenshots, close the browser.
- **Keep your module's exports and API identical** unless your task says otherwise. The game already imports them. Read `main.js` to see how your module is used.
- **Owner per file.** Edit only the files named in your task, plus your own new `dev/` preview files. Put screenshots under `dev/shots/<your-prefix>-*.png`.
- **The live game** runs at `http://localhost:8123/realms/`. The test hook is `window.__realms`, exposing G, startBattle, openTown, newWorld and more.

## Town interior contract (agents T1, T2, T3)
- **`town_view.js`** (T1) owns the framework.
  - `createTownView(THREE, renderer)` returns `{ scene, camera, setTown({ fac, built: [...ids], name }), update(dt), resize(w, h), pick(clientX, clientY) -> buildingId | null, highlight(id), dispose() }`.
  - It renders a HoMM3-style panoramic town scene: a fixed camera looking at a landscape with slots where buildings appear.
  - `setTown` places the faction's building models for the built ids, using model functions from the two faction files below (import them) with the fallback of a placeholder box.
  - Newly built ids animate in, rising with dust.
  - Exports `TOWN_SLOTS`: id → `{ x, z, ry, s }` in town-view units.
- **Building ids** come from `data.js` BUILDINGS: `hall2`, `hall3`, `fort`, `market`, `tavern`, `mage1`, `mage2`, `mage3`, `d1`..`d7`, `u1`..`u7`. There is also the always-present `village` (the base village hall).
  - An upgraded building replaces its base in the same slot:
    - `hall3` replaces `hall2`, which replaces `village`.
    - `mage2` and `mage3` replace the lower mage guild.
    - `uN` replaces `dN`.
- **Footprints** in town-view units (1 unit is about a small house), base at y = 0, front facing +Z towards the camera:
  - village / hall2 / hall3: 2.4 × 2.4, height up to 3.5
  - fort: a wall and gatehouse spanning about 9 wide × 1.2 deep, height up to 2.5, standing behind the town
  - market 2 × 2
  - tavern 1.8 × 1.8
  - mage1 / mage2 / mage3: 1.6 × 1.6, heights about 2.5, 3.3 and 4.2
  - d1–d3: 1.8 × 1.8
  - d4–d5: 2 × 2
  - d6: 2.4 × 2.4
  - d7: 2.8 × 2.8, height up to 4.5
  - uN: same footprint as dN, visibly grander
- **`haven_town.js`** (T2) exports `havenTownBuilding(id)`. **`necro_town.js`** (T3) exports `necroTownBuilding(id)`. Each returns `{ body, glow }` with vertex colours, under the usual model contract, for every id above.
  - Haven: white stone, blue roofs, gold.
  - Necropolis: dark violet-grey stone (not black), bone, green glows, crimson banners.
  - Dwellings should hint at their creature: pikeman barracks, archer tower, griffin tower, sword guild, monastery, jousting arena, angel portal; graveyard, zombie tomb, wight crypt, vampire mansion, lich mausoleum, black-knight stables, dragon vault.
