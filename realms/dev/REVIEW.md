# Hex Realms: art and QA review (round 2)

Reviewer: QA / art direction agent. Viewport: 412×860 CSS px, phone emulation (touch, `isMobile`), SwiftShader. Seed 4242 on Normal unless noted.
Screenshots: `dev/shots/qa-p1-*` (pass 1, about 22:05–23:25) and `dev/shots/qa-p2-*` (pass 2, see the end).
Scripts: `dev/shots/qa-lib.mjs` and `dev/shots/qa-s1..s7.mjs`. Run one with `flock dev/.shotlock timeout 150 node qa-sN.mjs p2 [args]`.

Note: the game changed a lot during pass 1, with a new blue/parchment UI, unit portraits and a new town sheet. Early shots (01–06) show the older purple UI. Items fixed during pass 1 are marked **[fixed]**.

---

## Pass 1: prioritized issues

### P0: broken or game-feel killers

1. **The map renders upside down at close zoom on some cells.** At max zoom on the home capital (`qa-p1-04-map-zoomin.png`) and around the ore pit at v506 (`qa-p1-40-objA-orepit.png`), the whole world flips 180°: castle spires point down and the sky is at the bottom. Cause: `cphi = cam.phi + f*0.5` passes the pole while `camera.up` was world +Y. **Lead patched `updateCamera` (north-tangent `up`) during pass 1. Re-verified in pass 2, see below.** Also clamp `cphi ≤ π − 0.05`.
2. **Foreground mountains hide the focus at close and mid zoom.** In most mid-zoom shots (`qa-p1-09`, `-10`, `40-objA-monster/goldmine/sawmill/dwelling/library`, `40-objB-stables`), the bottom 40–60 % of the screen is one or two giant mountain meshes between the camera and the hero. The hero, mines and towns sit squeezed against the horizon.
   - Fixes:
     - (a) Fade or hide `PEAK` and forest instances whose screen position is below the focus and within about 2 hexes of the camera ray: dither them, or set alpha to 0.25.
     - (b) Lower mountain height by about 35 % and keep each peak inside its own hex. Peaks currently spill 1–2 hexes over neighbours.
     - (c) Reduce the tilt at close zoom: `cphi` offset 0.5 → about 0.35.
3. **The battlefield is wider than a portrait phone, so the left column is cut off.** In every battle (`qa-p1-20-battle-*`, `30-siege`), the player's leftmost stack is half off-screen: the pikeman badge reads "0" instead of "30". The angel on the right edge and its yellow active ring are clipped. Floating spell text "🔥 Fireball −25" also runs off the left edge (`33-spell-cast`).
   - Fix: fit `bcam` to the hex bounds using the horizontal FOV (`dist = halfWidth / tan(hfov/2) * 1.08`), or pull the default `bview.dist` back. Clamp floaters to `[8, innerWidth − 8]`.
4. **Siege looks like a normal field with a wall dropped on it.** In `qa-p1-30-siege.png`, defenders stand on and behind the wall and their badges ("20", "5") sit on the battlements. The red-roofed tower is cut off at the right edge. There is no visible gate, moat or keep backdrop.
   - Fix:
     - Put the wall one row in front of the defenders.
     - Add a gatehouse in the gap.
     - Move the tower inside the frame, or add two symmetric towers.
     - Add a faction-tinted keep silhouette behind the defenders, as in HoMM3.

### P1: clearly wrong and visible every session

5. **Mountains have a translucent green "skirt".** Every mountain shows a semi-transparent green gradient over its lower half that bleeds over rock (`qa-p1-09`, `40-objA-goldmine`, `40-ter-forest`). It reads as a rendering glitch, not grass. Fix: make the grass blend opaque vertex colour on the base ring only, or remove the alpha/fog-like fade.
6. **Unexplored fog reads as snow or ice.** At default zoom, the bottom third of the first screen is pale white-blue blurred hexes (`qa-p1-03-map-default.png`). Zoomed out, 85 % of the planet is a pale icy shell (`qa-p1-05-map-zoomout.png`). New players will think it is snow.
   - Fix: give fog a distinct HoMM-style treatment, such as darker desaturated violet parchment or cloud wisps with a soft edge. Use no near-black, but make it clearly not terrain.
7. **Units are too small in battle, and badges cover their heads.** Creatures are about 25–35 px tall at 412 px width. Count badges sit right over the models, for example griffin "6" and archers "15" in `qa-p1-20-battle-1-grass.png`. Enemy wolves and goblins are grey or orange specks.
   - Fix: scale battle units ×1.3–1.5 (big tiers are fine), move the badge to the bottom-front of the hex, and shrink it to about 18 px.
8. **The hex grid overlay is the same green-yellow on every terrain.** On lava (`20-battle-7-lava`) and snow (`20-battle-4-snow`), the hexes look like green glass tiles painted on the ground. On snow, the grid is nearly invisible. Fix: use the per-terrain `grid`/`field` colours already in `battlefield.js TERRAINS`. The overlay material in main.js (`hexes` MeshBasicMaterial) seems to ignore them. Use a darker outline on snow and sand and a warm outline on lava.
9. **The battle message says "Auto battle…" during the player's own animations** (`qa-p1-33-spell-cast.png`), and every button greys out. Cause: in `refreshBattle`, `mineTurn` is false while `banim.length` is non-zero, so the else-branch prints "Auto battle…". Fix: show nothing, or "…", while animating unless `bauto` is set.
10. **The recruit tab lists the same unit twice.** When `d1` and `u1` are both built, "Halberdier ×14" appears twice (`qa-p1-51-town-recruit.png`). Fix: skip the base row when its upgrade is built.
11. **Plural bugs in user-facing text.** `plural()` turns "Pikemen" into "Pikemens" and "Swordsmen" into "Swordsmens" (`51-town-army`, `53-week`). The upgrade line reads "12 Pikemens → Halberdier", which should be "Halberdiers". The Victory dialog says "after 1 days" (`61-win-after`).
    - Fix the regex: apply `/([^s])$/` only when the name does not already end in "men".
    - Pluralise the target unit.
    - Use day/days.
12. **The gold amount was truncated in the resource bar ("10,0…")** (`qa-p1-04`/`05`/`06`). **[fixed]** It reads 10,000 later. Re-check with 6-digit gold (100,000+), because the gold cell is still the narrowest.
13. **The selected hero is often not at screen centre after `selectHero`/fly.** The hero lands at the right edge or near the horizon (`40-objA-shrine`, `40-objB-windmill`). This is partly because the flight was still in progress at low fps. Even when settled, the look-at sits about 40 % from the top with the bottom half foreground. Suggest moving the focus to about 55 % of screen height so the hero and his path have room.

### P2: art polish

14. **The menu title collides with the planet.** "Might and magic on a tiny world" is drawn over bright snow and is nearly unreadable (`qa-p1-01-menu.png`). Fix: add a dark soft text-shadow or a translucent vignette band behind the logo, or push the planet lower.
15. **Hero scale is tiny next to the castle.** On the default map (`qa-p1-03`), the hero is about ⅙ of castle height and is hidden by its own selection ring. HoMM3 heroes read about ⅓ to ½ of a town. Suggest hero scale 0.22 → 0.28 and a thinner ring (0.016 → 0.010) or a ring that sits under the base.
16. **Resource pickups are hard to read** (gold, ore and gem piles in `40-objB-gold`, `40-objB-ore`). At normal zoom they are yellow or grey specks. Bump `SCALE` for pickups (default 0.24 → 0.3) and add a small glint or glow to gold and gems.
17. **Mixed biomes look random.** Palms and cacti sit on lush grass next to snowy pines (`40-ter-rough`, `40-objB-chest`). The menu shows palms on a snow edge. Tie palms and cacti to sand only, and snowy pines to snow plus one ring.
18. **The sun disc and bloom are too strong at close zoom.** A large white disc with heavy glare is at the top centre of almost every close shot and washes the castle silhouettes (`40-objA-*`). Reduce the sun sprite size or bloom by about 40 % when the camera is tilted.
19. **Some monsters read as translucent green wireframes** (the bone-like creature and green dragon in `40-ter-forest`, hydra and troll elsewhere). They look glassy or ghostly in daylight. Check that the necro/neutral glow material isn't drawn over the body at high opacity, and give trolls and hydras a more saturated, opaque body colour.
20. **The battle spell button shows only "60".** The icon is a book plus a number, with no label (`20-battle-5..7`). Players don't know it is mana. Use "Spells · 60" or "🔮 60" with the small label "Mana".
21. **Victory and Defeat are tiny plain cards** (`61-win-after`, `61-lose-after`), the same size as a "Gravenreach is yours!" toast. Make them full-screen moments with a large crest or banner, faction colour, confetti or gloom, and a summary (days, towns, creatures killed).
22. **The victory flow skips the battle summary.** The first dialog after the winning siege is "Gravenreach is yours!", and the 🏆 casualties card is not seen before it (`60-win-battle-result`). Check the dialog order.
23. **Town side buttons truncate names** ("Highca…", "Graven…", "Duskm…", "Stormh…", `61-win-after`). With 4 towns, the column covers a quarter of the map height. Use 2-line names, or icon plus initials, and make the column scrollable or collapsible.
24. **Market rows wrap the coin icon onto its own line** ("sell 1 for 100 / 🪙", `51-town-more`). Use `white-space: nowrap` on price spans.
25. **Fonts: Cinzel and Nunito load from Google Fonts,** which failed here with a certificate error. Offline or PWA players will see the fallback serif. Self-host the two fonts or set a deliberate fallback stack.
26. **The town screen has no interior view yet.** The town sheet shows the map castle above the list (`50-town-build`), and town_view.js is not wired in. Also, the 3D castle on the map shows no change when Fort or Mage Guild is built. Consider at least adding walls to the map model when `fort` is built.

### What already looks good
- The bright water with surf foam (`40-ter-swamp` is really the ocean) is gorgeous.
- The grass texture is lush with flowers. Roads read clearly.
- The Haven capital silhouette (blue spires) is iconic at every zoom.
- The sand, dirt and rough battlefields are bright and readable. The props on rough and sand battlefields are nicely scaled.
- The new parchment and blue UI (dialogs, spellbook, hero sheet) is much more readable than the old purple. The spellbook descriptions are clear.
- Arena, sawmill, crystal cavern, campfire and Magic Well are all readable at mid zoom.
