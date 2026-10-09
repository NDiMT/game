# Round 3 QA review 4: figure/ground after pass 3

Reviewer: QA/art director. Captured on 09/10/2026 from the live game: 412x860 viewport at DPR 2, swiftshader, map fully revealed.
- Screenshots are `dev/shots/r3q4-*.png`. The script is `dev/shots/r3q4.mjs`, with modes `views`, `towns`, `battles` and `paint`. The `paint` mode repaints a 0.32 radius around the hero to terrain T and calls `layoutWorld()`.
- This seed puts no objects on swamp, lava or dirt, so those terrains were checked with `r3q4-paint-t{5,7,2,6}.png`.

## Summary
Pass 3 fixed most of what the player complained about. On grass, sand, snow, swamp and dirt at the default zoom, every chest, pile, mine, dwelling and monster is easy to spot. The ground is calm.

Fixed since REVIEW3:
- Lava is calm.
- The Haven lime mound is gone.
- Bushes sit back in the backdrop.
- Monsters now read thanks to size and ink.
- The town interiors have lost their confetti, and the Necro town ground is ash-coloured.
- The swamp is now olive and teal.

The loudest elements left are no longer the ground textures. They are the **UI overlay and the surroundings**: the neon battle move grid, the violet fog-of-war, the turquoise sea and the magenta space backdrop. One shared rendering problem also remains: the **constant-width ink hull turns every object into a dark smudge at far zoom**.

## Prioritised fixes (12)

### main.js
1. **P1. The battle move-hex highlight is the loudest thing on every battlefield.**
   - **Evidence:** `r3q4-battle-t1.png`, `r3q4-battle-t5.png` and `r3q4-battle-t7.png`. The grid is the same neon lime on grass, swamp and lava. It drowns the units, and on grass it makes the green orcs harder to see.
   - **Change:** at line 979, `grn = 0x58e04a` on a `MeshBasicMaterial` at opacity 0.5 (line 895).
     - Use a pale warm cream (`0xf6efd0`) at about 0.22 opacity, or keep the green desaturated (`0x9fc884`) at 0.25.
     - Shrink the instance to about 0.92 so a ground gap outlines each hex.
     - Keep red for attack targets, but tone it to `0xe8705e`.

### materials.js (with main.js driving the uniform)
2. **P1. The ink edge turns objects into dark confetti at far zoom.**
   - **Evidence:** `r3q4-far22.png` and `r3q4-far.png`. All objects become dark-outlined chips of the same weight, which is exactly the "uniform" look the player complained about. At dist 10 the edge looks right (`r3q4-grass.png`).
   - **Cause:** the hull pushes out by a constant on-screen width (`uHullW` 0.003, line 324).
   - **Change:** fade the edge with camera distance. Each frame, main.js sets `inkMat.uniforms.uHullW.value = 0.003 * clamp((20 - cam.dist) / 8, 0.25, 1)`. It also lifts `uHullDark` from 0.15 toward 0.45 as dist goes from 12 to 22.

### models_objects.js
3. **P1. The campfire smoke reads as a glitch.**
   - **Evidence:**
     - `r3q4-rough.png` around (690,1040): seen from above, the five opaque, inked puffs lie flat like a white caterpillar.
     - `r3q4-paint-t5.png` and `r3q4-paint-t2.png` around (330,960): they look like a white bead totem.
   - **Change:** at lines 499–501, remove the smoke balls from `body`. Use one or two small, soft puffs from the mapfx particle atlas, or put them in `glow` at low alpha with no ink. Keep the tall flame for the vertical read.
4. **P2. The gem mine is an oversized crystal blob.**
   - **Evidence:** `r3q4-sand.png` (360–600, 360–700). Two purple crystal masses cover about 1.5 hexes, are bigger than the Haven castle footprint, and do not read as a mine.
   - **Change:** shrink it to fit the hex (`SCALE.gemmine` 0.3 → 0.24 in main.js, or shrink the model). Give it a light rock rim and a dark mouth like the new gold mine (`r3q4-lava.png` (270,570)), with crystals only as accents.

### terrain.js
5. **P2. Rough is too pale.**
   - **Evidence:** `r3q4-rough.png`, `r3q4-paint-t6.png` and `r3q4-far22.png`. Rough is now a light grey only one step from snow. It covers the largest area of the planet, so the far view reads as a grey disc. The scattered rock debris is still busy.
   - **Change:** in `PAINT[LAYER.ROUGH]` and `GRADE[LAYER.ROUGH]` (line 475), make the colour about 12% darker and a warm taupe (about `[150,138,118]`). Halve the pebble and debris count.
6. **P2. The sea is the brightest large surface.**
   - **Evidence:** `r3q4-paint-t5.png` and `r3q4-lava.png` (top right). The light turquoise water has white foam blobs that look like smudges (`r3q4-paint-t5.png` (150–330, 1150–1230)).
   - **Change:** desaturate the water about 20% and darken the shallows about 10%. Make the coast foam thinner and smaller. This is REVIEW3 item 6, still open.
7. **P2. The fog of war is the most saturated area on the start screen.**
   - **Evidence:** `r3q4-start.png`, bottom third, which is a violet sea.
   - **Change:** at line 573 (`vec3(0.62,0.55,0.8)`) and line 588 (`vec3(0.15,0.12,0.22)` fog emissive), move the cover toward a desaturated slate blue-grey (about `vec3(0.55,0.57,0.66)`). Keep the swirl motion.
8. **P3. The lava crust has the same hue and value as dirt.**
   - **Evidence:** `r3q4-dirt.png` (top band) against `r3q4-paint-t2.png` and `r3q4-paint-t7.png`. Without the thin seams, lava reads as dark dirt.
   - **Change:** at line 345, set the crust base `[110,78,66]..[150,112,92]` to a cooler maroon-charcoal of about `[92,64,66]..[124,92,88]`. That is still well above near-black.

### town_view.js
9. **P2. The Haven backdrop trees are lime-yellow.**
   - **Evidence:** `r3q4-town-haven.png` and `r3q4-town-haven-full.png`. The canopies are the most saturated green on screen and compete with the white and blue buildings.
   - **Change:** at line 657, set the crown `[0x4c8a44, 0x98c070]` to about `[0x46784a, 0x7aa06a]`. Also cut the gradient so the tops do not go yellow under `sunI` 2.7.
10. **P2. The Necro interior is pastel and flat.**
    - **Evidence:** `r3q4-town-necro-b.png` and `r3q4-town-necro-full.png`. The lilac sky, beige-grey ground and lavender buildings sit in the same narrow value band, so the buildings lack punch. The lamp-post shadows are long, hard and blue.
    - **Change:**
      - In `PAL.necro`, deepen `zenith` and `mid` by about 20%.
      - Darken the ground `grass` entries by about 10%.
      - Raise `sunDir.y` to 0.65 for shorter shadows, and make the shadow tint warmer.
    - **Also (both towns):** the foreground ground texture looks streaky or smeared at the grazing angle. Swiftshader may be exaggerating this, so check it on a device before changing it. If it shows there too, lower the contrast of the foreground detail.

### atmosphere.js
11. **P2. The space and nebula backdrop is too saturated.**
    - **Evidence:** `r3q4-far22.png` (the magenta and violet field) and `r3q4-close-chest.png` / `r3q4-close-hero.png` (the violet sky at the horizon). At far zoom it is the most saturated thing on screen.
    - **Change:** in the nebula bake (line 441 onward), desaturate the magenta clouds about 35% and shift them toward deep blue. Drop the sky band's violet toward periwinkle. The sun disc is acceptable now.

### unit_fit.js / units_*.js
12. **P3. Battle units look small on their hexes.**
    - **Evidence:** `r3q4-battle-t1.png`. The pikeman and archer fill about 55% of a hex. HoMM3 stacks overflow their hex.
    - **Change:** raise the `'battle'` fit scale by about 15%, flyers excluded. On the green grid the green orc (`units_neutral.js`) reads poorly, but item 1 mostly fixes that.

## Regressions and new artefacts
- **Glitchy:**
  - Campfire smoke beads (item 3).
  - Far-zoom ink smudges (item 2).
  - Coast foam blobs (item 6).
- **Too dull:** the Necro town interior has become washed-out pastel (item 10). The map ground is not murky anywhere, and sand and snow are pale but read fine.
- **Z-fighting and blobs:** none found. Blob shadows show under the castle, trees and chest at close zoom (`r3q4-close-chest.png`) with no flicker.
- **Not regressions:**
  - The fog sea and the ocean were never fixed (REVIEW3 items 5 and 6 are still open).
  - The town interior dust cloud covering everything (`r3q4-town-*-full.png`) is a test artefact: I added 12 buildings at once while swiftshader ran at a low frame rate. It does not happen in normal play.
- **Capture note:** close-zoom shots must use dist ≥ 6.4, which is the game's clamp. At dist 4 the camera ends up inside the planet.
