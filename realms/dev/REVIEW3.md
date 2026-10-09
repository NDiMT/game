# Round 3 QA review: figure/ground after pass 1

Reviewer: QA/art director. Captured on 2026-10-09 from the live game: 412x860 viewport at DPR 2, swiftshader, map fully revealed. The world is random per run, so the seeds differ between shots.
Screenshots are in `dev/shots/r3qa-*.png`. The script is `dev/shots/r3qa.mjs`; run it as `node r3qa.mjs views '[["name","ter5"|"objchest"|"mon1"|"hero"|"town0",dist]]'`.

## Summary
Pass 1 works on **grass, snow, sand and rough**. The ground is now a calm mid-value backdrop, and chests, piles, sawmills, towns and visit sites pop (see `r3qa-start.png`, `r3qa-grass.png`, `r3qa-snow.png`, `r3qa-dirt.png`). The ink edge reads as a thin, warm-dark line with no visible cracks or glitches.

Five problems remain:
1. **Lava** is now the loudest thing on the map.
2. **Neutral monsters whose hue matches the ground** disappear: gold ogres and orcs on tan or lava ground, green trolls and goblins on grass.
3. **Plain-grass bushes and forest canopies** are brighter and more saturated than the grass, so they compete with objects.
4. **Contact blobs are invisible** at map zoom.
5. **The town interior ground** (neon green with flower confetti on Haven, all-violet on Necro) is the single worst "too intense and uniform" screen.

The battlefield has swung to the other extreme: it is now too dull and grey.

Squint results at the default zoom (dist 10):

| Terrain | Objects found instantly | Objects that blend |
|---|---|---|
| grass | chest, piles, dwellings, artifacts, towns | green monsters (troll, goblin); the campfire is small |
| rough | everything except monsters | small grey or violet monsters (wolf) |
| snow | everything | snow pines look ghostly, which is fine |
| sand / dirt | most objects | gold or ochre monsters; dirt, sand and rough read as the same beige |
| swamp | objects are fine | the campfire nearly vanishes; the ground itself is noisy (cyan puddles, mauve thorn shrubs) |
| lava | the arena and the shrine | the ogre (gold on orange veins), and almost anything warm-coloured |

---

## Prioritised fixes (P1 = do first)

### terrain.js
1. **P1. Calm the lava veins.**
   - **Evidence:** the vein network covers every hex at full brightness and out-shouts objects (`r3qa-lava.png`, `r3qa-close-chest.png`, `r3qa-far.png`).
   - **Change:** in `PAINT[LAYER.LAVA]`:
     - Use fewer and wider crust plates: `voronoi(4,…)` becomes `voronoi(3,…)`.
     - Make the veins thinner: `wid = 0.02 + n2*0.035`.
     - Let only about 40% of the cells glow. Gate `vein` by `lhash(id,…) > 0.6` or by a low-frequency fbm mask; elsewhere draw a dim seam (`[120,60,40]`).
     - Drop the vein colour from `[255,92,14]` to roughly `[220,90,30]`.
     - Lower `glow[q]` from `vein*0.75` to `vein*0.4`.
     - Remove the 20 random hot pixels.
     - Lower the GRADE saturation for lava from 0.82 to 0.7.
   - **Goal:** lava should read as dark warm crust with occasional embers, not as a mesh of neon lines.
2. **P2. Make swamp distinct from grass, and quieter.**
   - **Evidence:** the swamp is grass green with bright cyan puddles, which looks mottled and busy (`r3qa-sand.png` lower half, `r3qa-swamp.png`).
   - **Change:** shift the base to an olive or brown-teal (about `[96,104,70]`). Make the puddles larger, fewer and darker teal (about `[70,100,96]`), not sky cyan. Halve the puddle-edge contrast.
3. **P2. Separate dirt, sand and rough.**
   - **Evidence:** all three are near-identical beige mid-values, which makes the map uniform (`r3qa-dirt.png`, `r3qa-far.png`).
   - **Change:**
     - Dirt: warmer and about 10% darker brown.
     - Rough: cooler grey-taupe.
     - Sand: keep it pale and warm.
   - The goal is distinct biomes, not more contrast inside a tile.
4. **P3. Quieten the rough pebbles.**
   - **Evidence:** the pebble pattern reads as regular polka-dot terrazzo at close zoom (`r3qa-z-campfire.png`).
   - **Change:** in `PAINT[LAYER.ROUGH]`, cut the pebble light/dark contrast by about 40% and vary their size more (fewer, bigger, softer).
5. **P3. Soften the fog frontier glow.**
   - **Evidence:** the violet swirl and `frontier*0.55` glow are the most saturated colour on the start screen (`r3qa-start.png`).
   - **Change:** frontier `0.55` becomes `0.3` and fogRim `0.25` becomes `0.15`. Desaturate the mist layer by about 20%.
6. **P3. Desaturate the water by about 15%.**
   - **Evidence:** the bright turquoise sea is now more saturated than any object near the coast (`r3qa-snow.png`, `r3qa-grass.png`).
   - **Change:** lower the water saturation, or lerp the shallows toward a greyer teal.

### nature.js
7. **P1. Make bushes and canopies sit in the backdrop.**
   - **Evidence:** the lime-yellow bush clumps on plain grass and forest cells are lighter and more saturated than the grass and draw the eye before the objects do (`r3qa-grass.png`, `r3qa-swamp.png`, `r3qa-town-neutral.png`).
   - **Change:**
     - Darken the deciduous/bush leaf ramps (around `leafPaint`/`canopy` call sites, line 249 onward) by about 12%.
     - Shift them slightly toward blue-green and reduce `sun` (0.14 becomes 0.06) so the top faces do not go yellow.
     - Halve the scatter probability of bushes on plain GRASS (`FLORA_FOR_TERRAIN[1].scatter` `p`).
8. **P2. Reduce the swamp and lava shrub confetti.**
   - **Evidence:** dead mauve thorn shrubs and dark spiky debris are scattered on almost every swamp and lava hex (`r3qa-sand.png`, `r3qa-lava.png`).
   - **Change:** cut the scatter probability about 50% and make them a neutral grey-brown instead of mauve/violet.

### models_objects.js
9. **P2. Give the gold mine a mine silhouette.**
   - **Evidence:** the gold mine reads as a big glossy orange blob, too close to the gold pile (`r3qa-z-goldmine.png`, `r3qa-dirt.png`).
   - **Change:** per the brief, use a light grey-brown rock rim (`C.rock`/`C.rockL`) with a **dark, large cave mouth** and a timber frame. Keep the gold only as nuggets, the cart and the glow inside the mouth.
10. **P2. Make the campfire bigger.**
    - **Evidence:** the campfire is too small to find on swamp or grass at dist 10 (`r3qa-sand.png` around (260,1080)).
    - **Change:** set `GROW.campfire` from 1.25 to about 1.6, and add a taller flame plus a pale smoke puff for a vertical silhouette.
11. **P3. Check the ore pit and gem mine against snow and rough.**
    - **Evidence:** the ore pit's blue-grey rock on white snow reads, but only just (`r3qa-snow.png`).
    - **Change:** raise the contrast between the rim and the mouth.

### models_towns.js
12. **P2. Calm the Haven town grass mound.**
    - **Evidence:** the `HV.grass 0x86c64e` lathe pad is a neon lime disc on rough or sand, the most saturated green on screen (`r3qa-start.png`, `r3qa-far.png`).
    - **Change:** desaturate it to about `0x7aa458`, or tint it to a paved stone apron so it works on any terrain.

### materials.js
13. **P1. Make the blob shadows visible.**
    - **Evidence:** at map zoom there is no visible dark contact under chests, piles or monsters on bright ground (`r3qa-z-hero.png` chest, `r3qa-grass.png`, `r3qa-dirt.png`). They show only faintly at very close zoom (`r3qa-z-artifact.png`).
    - **Change:** in `makeBlobShadowMaterial`, raise the default opacity from 0.45 to about 0.65. Flatten the alpha curve (`pow(a,1.1)` becomes `pow(a,0.7)`) so the core is wider. Use a slightly warmer, darker colour (about `0x3a2028`).
14. **P3. Widen the ink edge a little at map zoom.**
    - **Evidence:** at dist 10 the line is about 1 px and disappears on monsters whose hue matches the ground (`r3qa-lava.png` ogre, `r3qa-grass.png` bottom-left).
    - **Change:** `uHullW` from 0.0022 to about 0.003, and `uHullDark` from 0.2 to 0.15. No glitches were seen, so this is safe to raise.

### main.js (lead)
15. **P1. Make monsters readable.**
    - **Evidence:** at dist 10, neutral stacks (gold ogre/orc, green troll/goblin, grey wolf) are the hardest interactive objects to find (`r3qa-lava.png`, `r3qa-grass.png`, `r3qa-start.png` bottom-right, `r3qa-far.png`).
    - **Change:**
      - Raise `SCALE.monster` from 0.2 to about 0.24, with a matching `BLOB_R.monster`.
      - Give monsters a stronger, slightly larger blob.
      - Optionally add a thin threat-coloured ground ring, as HoMM3 does with its stack base.
16. **P2. Give battle units contact blobs.**
    - **Evidence:** units in battle stand on the pale ground with no contact shadow (`r3qa-battle.png`).
    - **Change:** at line 954, `addBlob(meshOf(...), 0.5)` for each stack.
17. **P3. Lower the global grade saturation.**
    - **Evidence:** `atmosphere.js gradeGLSL` applies `sat = 1.1..1.24` to the whole frame, which partly undoes the terrain desaturation.
    - **Change:** the lead and atmosphere owner should try `1.0 + 0.12*...`, and add saturation back on objects through vertex colours if needed.

### atmosphere.js
18. **P3. Shrink the sun.**
    - **Evidence:** at far zoom the sun disc with its god-rays is a large blown-out area (`r3qa-far.png`). At close zoom (camera tilted to the horizon) the rays cross the sky behind the objects (`r3qa-z-*.png`).
    - **Change:** reduce the corona size and ray intensity by about 30%.

### town_view.js (not in the owner list, but this is the worst offender)
19. **P1. Calm the town interior ground.**
    - **Evidence:** the Haven interior grass is neon green with pink and white flower confetti. Necro is violet ground with pink blobs under violet buildings, so the buildings are camouflaged (`r3qa-town-interior.png`, `r3qa-town-interior2.png`).
    - **Change:**
      - Desaturate the `grass` palettes (lines 99 and 110) by about 30% and darken them about 10%.
      - Cut the flower/tuft count (line 517 onward) by about 70%.
      - Necro: move the ground toward grey-olive/ash (not violet) so the violet buildings contrast with it.

### battlefield.js / units_* (another agent is working on battlefields; noted for them)
20. **P2. Restore some contrast on the battlefield.**
    - **Evidence:** it is now too dull: a pale grey-beige ground with rocks of the same value, a washed-out green move grid, and units that look small (`r3qa-battle.png`). The gold ogre (`units_neutral.js`) on beige is weak.
    - **Change:**
      - Ground: mid-value, not pale.
      - Obstacles: darker or warmer than the ground.
      - Move hexes: slightly stronger.
      - Neutrals in `units_neutral.js`: consider less ochre on the ogre and orc (pick hues off the tan/lava family, such as a redder skin or blue cloth) so they separate on desert, dirt and lava.
