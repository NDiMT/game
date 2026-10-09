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

---
# Round 3: figure/ground readability (5 passes)
Player feedback (2026-10-09): "the ground and its textures don't stand apart from the objects on top (chests, caves...); everything is too intense and uniform."
Goal: the HoMM3 read: the GROUND is a calm, lower-saturation, lower-contrast backdrop with large soft shapes (no confetti of flowers/pebbles/high-frequency noise); OBJECTS (towns, mines, caves, chests, piles, heroes, monsters, visit sites) pop with saturated local colour, clear dark-ish silhouette edge, and a soft contact shadow so they sit ON the ground.
- Value hierarchy: ground mid-values, objects use the full value range (bright lit tops + darker openings/edges). Still NO near-black murk (the player hated "μαυρίλα") — dark accents are allowed only as small contrast details (cave mouths, chest seams, door openings, silhouette ink edge).
- Colour: ground desaturated ~25–35% vs now and harmonised per biome; objects keep/raise saturation and use hues that contrast with the terrain they usually sit on (e.g. chests: red-brown wood + gold on any ground; caves: dark mouth + light rock rim).
- Screenshot check for every change at map zoom (412x860, default zoom ~ cam.dist 10–12): squint test — can you spot every object instantly?

---
# Round 4: mobile readability of MODELS (2026-10-09)
Player: "models — chests, monsters, heroes — lose their detail; how do we make them look better on a phone screen?"
At default map zoom a creature/hero/chest is only ~25–40 px tall; in battle ~60–90 px. Detail smaller than ~2–3 px turns into noise.
Rules (mobile-game readability, like HoMM mobile / Clash / Rumble):
- SILHOUETTE FIRST: exaggerate the 1–2 identity features of each model (pikeman = huge halberd + kettle helm; griffin = big wings + beak; skeleton = skull + ribcage + bone white; chest = big lid + gold bands; hero = horse + big banner). Heads ~1.25–1.4×, weapons/shields ~1.3×, chunkier limbs. A creature must be identifiable as a black silhouette at 32 px.
- COLOUR BLOCKING: 2–3 large flat-ish colour regions per model with one strong accent; avoid many small parts of similar value. Each faction/creature gets a signature colour that differs from its neighbours.
- VALUE BANDS: light top / mid body / dark-ish underside (not black). Strong value contrast between adjacent big regions (e.g. skin vs armour).
- REMOVE micro-detail: delete parts smaller than ~3% of model height (rivets, tiny straps, fingers) unless they are an identity feature; merge small parts into bolder ones. Fewer, larger polygons on curved parts read better than many tiny facets.
- Check every model at 40 px and 90 px tall (render the preview grid small!) plus one big view.
- Keep APIs, orientation (+Z front, base y=0), triangle budgets, bright palette (no murk).

---
# Round 5: animations (2026-10-09)
Player asked for animations. Approach: GPU "shader rig" — see /home/user/game/realms/rig.js (the contract; read it).
- Model modules tag parts with `aBone` + `aPivot` (rig.js tagPart before merging, or tagRange after). Untagged = static. Body AND glow geometries both need tags (glow parts like eyes/orbs must follow their bone).
- materials.js (tech agent) deforms vertices in makeBodyMaterial, makeGlowMaterial, makeInkHullMaterial and makeHitMaterial from per-mesh uniforms set via mesh.onBeforeRender: uAnimState (ANIM.*), uAnimT (seconds in state), uAnimSpeed, uSeed. Exported helper `setAnim(mesh/group, state, opts)`.
- Animations must read at phone size: big, clear, snappy poses (anticipation → strike → recover), not subtle wiggles. Idle breathing + slight sway so the battlefield feels alive. Different seeds desync units.
- Each model module: pivots at sensible joints; quadrupeds use LEG_FL/FR/BL/BR; mounted units: horse legs LEG_*, horse body BODY, rider RIDER; flyers WING_L/WING_R; weapons on ARM_R; shields on ARM_L.

---
# Round 6: three new factions (2026-10-09)
New factions in data.js FACTIONS/UNITS/UPGRADES (read them for ids, names, colours, flags):
- **sylvan** (green/gold/wood, elven forest): centaur, dwarf, woodelf, pegasus, dendroid, unicorn, greendragon; upgrades centaurcpt, battledwarf, grandelf, silverpegasus, dendroidsoldier, warunicorn, golddragon.
- **inferno** (fire/brimstone, crimson-orange-black-gold — NOT murky: glowing lava accents, bright reds): imp, hellhound, demon, succubus, efreet, nightmare, devil (named "Pit Lord"); upgrades familiar, cerberus (3 heads), horneddemon, succubusmistress, efreetsultan, hellcharger, archdevil.
- **dungeon** (violet/teal underworld, warlocks): troglodyte, harpy, beholder, medusa, minotaur, manticore, blackdragon; upgrades infernaltrog, harpyhag, evileye, medusaqueen, minotaurking, scorpicore, reddragon.
All rules from rounds 2–5 apply: bright palette (no murk), mobile readability (Round 4: chunky silhouettes, colour blocking, big identity features, check at 40 px & 90 px), and Round 5 shader rig tags (aBone/aPivot via rig.js on body AND glow; read rig.js header conventions, +Z front, +X = *_R weapon side).
Model contract: `{ body, glow }` with position/normal/color/uv (+ aBone/aPivot), base y=0, facing +Z, ~1 unit tall (tier 6–7 up to ~1.5, dragons wider). Upgrades keep the base silhouette but grander (gold trims, crowns, bigger wings/weapons) — build them with one builder per creature + an `up` flag, like units_haven.js / units_necro.js (read those as reference implementations!).
Import other modules with the '?v=1.3' query that main.js uses (the lead bumps all ?v= together).

---
# Round 7: more detail (2026-10-09)
Player: "design even more detailed units, and their icons, for everything, and heroes".
Keep EVERYTHING from Rounds 4–6 (silhouette first, colour blocking, value bands, rig tags on body+glow, API/export names identical, base y=0, +Z front, upgrades = same builder with up flag). Now ADD a layer of secondary/tertiary detail that rewards close-up viewing (battle close-ups, portraits) without muddying the silhouette:
- Faces: eyes with whites/irises or glowing pupils, brows, noses/snouts, mouths/teeth where fitting; hair/beards with locks; helmets with visors, rivets, crests.
- Armour/clothing: layered plates, trims, belts with buckles, straps, pouches, embroidery bands, cloth folds (subtle extra segments), fur collars, scale/feather patterns via vertex-colour striping on extra segments.
- Weapons/shields: fullers, guards, grips with wraps, emblems on shields (faction sigil), arrows in quivers.
- Creatures: claws, scales (banded colour), feathers layered, manes/tails with tufts, wing membranes with veins/bones, horns with ridges.
- Smoother curved forms: more radial segments on heads/limbs/bodies (8–12 instead of 5–6) so they look sculpted, not boxy.
- Budget: up to ~4.5k tris per creature (tier 7 / mounted up to ~6k). Still CPU-friendly (merged geometry).
- Check at 40 px (silhouette must still read) and at large size (detail must look rich). Preview + anim bench check (dev/anim.html supports family:id). Rig tags must still be complete (no ROOT figure parts).
