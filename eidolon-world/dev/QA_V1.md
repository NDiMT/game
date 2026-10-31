# EIDOLON v1.0, Chapter I "The Veiled Gate": QA audit (v1.0-M3c)

- **Date:** 31/10/2026
- **Build tested:** live v1.0-M3c (https://ndimt.github.io/game/eidolon-world/, deployed 31/10/2026 03:22 UTC, the same tree as `911752c`).
  - Chromium with SwiftShader, mobile touch context: 390×844, 360×780 and 430×932 at DPR 1.
- **Logic checks:** headless Godot 4.5.1 on a frozen snapshot of `911752c` (other agents are editing the working tree), including `tests/playthrough.gd` and four QA probes.
- **Scope:** findings only. No game files were changed.
- **Screenshots:** `dev/shots/qa1-*.png`.
- **Scratch harness:** `/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/qa1/`.
  - `lib.mjs`, `t1_spaces.mjs` … `t4_rooms.mjs` are the Playwright scripts; `run_*.txt` their logs.
  - `tree/eidolon-world/tests/qa1_probe*.gd` are the headless probes; `probe*.log` their output.

## Executive summary

- **The scripted playthrough is green:** 387/387 checks, W → N → E order, save/continue, v2 migration.
- **But the free world has one real hole (P0-1).** The Mist Maze marks itself solved when you walk into the Echo Corridor's west end. Once the E wing is done and the bars are unbolted, the North seal costs only the amphora: no Garden, Our Steps, Court or Maze puzzle.
  - A second hole: the Ledge's drawbridge lever has no condition (P1-1). An E-first player walks straight into the Court and skips the Garden and Our Steps.
- **No softlock was found in any wing order.**
  - Every required item (lamp, shard, chisel, amphora, pin) is reachable before it is needed.
  - Every item gate gives a text answer when you try it early.
  - Saves restore position, satchel, panel, seals and map in the middle of each wing.
  - One save bug, though: socketed seals come back as floats after a reload. Statues show unlit and a filled socket asks to be filled again (P1-5).
- **The new spaces read as greybox next to the old rooms.** This is the biggest quality gap.
  - The "thousand faces" are plain cubes and the fountain is a black disc.
  - The "scaffold" is a stone stair on two iron posts.
  - The Undercroft is bright white while the text says "too dark to see your feet".
  - On the Mirror Walk, the glass is invisible (a floating black wire frame), and the Warden floats in the void beyond it. He even walks through the Upward Spring's gap in plain sight.
  - On the title screen, the Warden stands in the Waking Pool (P1-2).
  - His mirror sightings land outside the visible glass, so the sting plays with nothing to see (P1-14).
- **Items work but are not yet a system.**
  - Each item opens exactly one door.
  - The brief's cross-uses are missing: lamp + maze, lamp + Warden mist, pin replaying the motif, the puddle as a real mirror.
  - The places to use items are hard to see: the dry ring is invisible, and the reliquary is a generic block.
  - The hint wisp knows nothing about v1 content.
  - The Lamp and the Veil Seals get no toast.
- **Performance is split.**
  - The new spaces are cheap: 64–166 draw calls.
  - The mirror rooms got heavier. Frames that also render the planar mirrors peak at 391 draw calls in the Court (194 in v0.7), 363 in the Shadow Chamber (237), 342 at the Court/Maze door, 331 in Our Steps, and about 280 in the Hall, Scales and Ledge: all over the 250 budget (P1-15).
  - Overdraw is still about 9–9.8 screens, and the download is 32.3 MB compressed: title after about 31 s here.
- **Console and story:**
  - The console is clean: 0 errors, 0 WebGL feedback-loop warnings.
  - The lore is clean: no Pygmalion, Galatea, Orpheus or Cyprus; Milos and the goddess are used correctly. One contradiction between a tablet and a stele.

**Severity key:**
- **P0** blocks progress or is broken.
- **P1** is a clearly visible flaw.
- **P2** is polish.

---

## Critical path: every wing order

**How it was checked**
- Headless reachability flood (`qa1_probe.gd`, the playthrough's `_reach` from any start).
- The real interact path (`try_interact`).
- Web runs with `jump:` / `give:` / `cs:`.

| Order | Result | Notes |
|---|---|---|
| W → N → E (the playthrough) | OK | 387/387. Pin picked up on the Balcony during the hub tour. |
| W → E → N | OK, **sequence break** | After E, `ec_unbolt` → the maze end. The Maze auto-solves and the N seal needs only the amphora (P0-1). |
| N → W → E | OK | Drawbridge `drawbridge_w` only after the maze: correct. |
| N → E → W | OK | The Balcony pin is a short detour south from the Ledge; nothing points there (P1-6). |
| E → N → W | OK, **sequence break** | At the Ledge, the `drawbridge` lever lowers LB at once. The Court is open with the Garden and Our Steps unsolved (P1-1). Then P0-1 as above. |
| E → W → N | OK, **sequence break** | Same as above. |

**Item availability:** every required item is reachable before its gate.

| Item | Where it is | Reachable before its gate? |
|---|---|---|
| Lamp | Atrium scaffold | Yes, always |
| Shard | Hall | Yes, before the reliquary |
| Chisel | Shadow Chamber, after its solve | Yes, before the reliquary |
| Amphora | Garden | Yes, from T4 without any solve |
| Pin | Balcony stele | Yes, before the panel |

**Early-use texts:** every item gate answers in text when used early (`strike_relic`, `pour`, `strike_panel`, `uc_dark`).

**Saves in the middle of a wing** (`qa1_probe.gd` C): save, quit and Continue restored the position, the satchel, `amph_full`, the panel state, the Warden patrol and the map.
- **W:** shard, chisel and sign seen, reliquary intact.
- **N:** amphora full, Garden done.
- **E:** pin taken, panel open, standing on the Walk.

**Exceptions:** P1-5 (sockets) and P2-14 (a save on the Walk in the open is caught at once on load).

**Shortcuts:**
- **W gate:** works, from the colossus side.
- **N drawbridge:** works, but it is also open from the wrong side (P1-1).
- **E bars:** they lead into the maze's end. For an E-first player, that end is closed at `MZ_door` (mural unsolved), so the "shortcut back" is a dead end. The way home is the long way again: Walk → Ledge → Balcony → Undercroft.
- **Missing:** the brief's ladder from the Walk's south end down to the Balcony (`V1_WORLD.md` §3) is not built.

---

## P0

### P0-1 Mist Maze / Echo Corridor: the North wing can be skipped; the Maze "solves" when you walk the Echo Corridor

**Where:** `chapter.gd` `_update_maze()` (the last 3 lines), `hub.gd` `unbolt_ec`, `items.gd` `POUR_POS` / `FILL_POS`.

**Cause**
- `state["maze"] = true` fires for any position with `z < -39.2`, `8.5 < x < 11.5`, `y ≈ 2`.
- That rect is the whole of `EC_a`, which also covers the Echo Corridor's west end north of the bars (z −41 … −44.4).
- That end is part of the E wing.

**Repro** (`qa1_probe.gd` B, `probe1.log`)
1. Fresh state after the pool. Set `echo_room` and `scales` (the E wing done), then `unbolt_ec`.
2. `tp:10:-42.6` (inside the Echo Corridor, north of the bars). Result: `maze = true` immediately, `solve:mist_maze` emitted and the solve jingle plays.
3. Walk south to (10, −40): the Maze's end.
4. `give:amphora` (the Garden's niche is reachable from T4 without any solve).
5. Interact at `FILL_POS` (9.35, −36): fills. Interact at `POUR_POS` (9.6, −39.62): pours.
6. `seal_ready("N") = true`, and the seal rises, with `turned_done`, `hollow_done` and `mural` all false.

**Expected vs actual**
- Expected: the North seal needs the North wing: Garden → Our Steps → Court → Maze.
- Actual:
  - Four puzzles of the wing are optional for any player who does E before N.
  - A solve jingle plays in a corridor of the other wing, with no maze in sight.

**Fix**
- In `_update_maze`, require the walk to come from inside the Maze. For example:
  ```
  if not state["maze"] and maze_prog >= Ch1Geo.MZ_PATH.size() - 2 and _in_maze_exit(p)
  ```
  where `_in_maze_exit` is `R(8.5, -39.6, 11.5, -39.0)` (the strip between the Maze's last cell and the dry ring), never north of z −40.8.
- Make `unbolt_ec` lower the bars only when `state["maze"]` is already true. Before that, `ec_unbolt` shows "Something holds it from the far side." The E wing's shortcut then opens after both wings.
- Or move the E shortcut to the brief's Walk → Balcony ladder (`V1_WORLD.md` §3), so the E wing never opens into the end of the N wing.
- Add a playthrough order check:
  1. E first with jumps.
  2. Unbolt.
  3. Assert `not state["maze"]` after walking EC_a north of the bars.
  4. Assert `not seal_ready("N")` with the amphora poured.

---

## P1

### P1-1 Eidolon Ledge: the drawbridge lever has no condition, so the Garden and Our Steps can be skipped

- **Where:** `main.gd` `_drawbridge_lever()`. The cond is only `not drawbridge and player.position.x > 21.0`.
- **Repro** (`probe1.log` A):
  1. `jump:atrium`, `tp:22.2:-23.0`. Focus is `drawbridge`. Interact.
  2. LB is enabled.
  3. A flood from the Ledge now reaches `mirror1`, `mirror3` and `l_mural` while `turned_done` and `hollow_done` are false.
- **Expected vs actual**
  - Expected (`V1_WORLD.md` §3): "the Court's drawbridge (LB) to the Ledge" is the N wing's shortcut, opened from the Court once the Maze is walked. That is what `drawbridge_w` does.
  - Actual: anyone who reaches the Ledge (E route) can lower it from the east and enter the Court.
- **Fix:** give the east lever the same gate as the west one: `chapter.state["maze"] and ...`. Better: remove the east lever and keep only `drawbridge_w`. Before that, show a "Raised from the far side." text on the east end.

### P1-2 Title screen: the Glass Warden stands in the Waking Pool, in plain view

- **Where:** `warden.gd` `setup()` / `_figure()`. `patrol_fig` is visible by default at (0, 0, 0). `chapter.update()` does not run in `mode == "title"` (`main.gd:366`), so `_update_patrol` never hides it until play starts.
- **Repro:** load the game. `qa1-s360-title.png` shows the hunched figure left of the heroine. `qa1_probe3.gd`: `patrol fig => [true, (0,0,0)]`, `in camera frustum => true`.
- **Expected vs actual**
  - Expected: he is seen only in glass (`STORY.md`: "φαίνεται μόνο μέσα σε αντανακλάσεις").
  - Actual: the first image of the game shows him standing in the pool.
- **Fix:** in `_figure()`, set `root.visible = false`. In `apply_state()`, set `patrol_fig.visible = false`; `_update_patrol` turns it on when it is active. Add a playthrough check at the title.

### P1-3 Mirror Walk: no visible glass, and the Warden floats in the void and walks through the Spring's gap in plain sight

**Where**
- `warden.gd` `_build_walk()`: the pane is a `StandardMaterial3D` with alpha 0.22 and no reflection.
- `_update_patrol()`: `patrol_fig.position = (2·32.75 − 31.4, 4, wz)`, i.e. x = 34.1.

**Repro**
- `qa1-walk-panel.png`, `qa1-walk-warden.png`, `qa1-walk-warden2.png`, `qa1-spring.png`: `give:pin`, `cs:hub:{…e_open:true…}`, `tp:31.4:-28.6` / `tp:31.6:-37` / `tp:33.3:-32`.
- What the shots show:
  - The "long glass" is a black wire rectangle floating over the walkway (the sill, cap and posts are all that show).
  - At x 34.1 there is no floor, so the Warden hangs in the fog beyond the frame.
  - In `qa1-spring.png` he walks past at the player's shoulder, through `SPRING_GAP` (no glass there).
  - He is fully visible to the camera, not as a reflection.
- Also: the First Shrine's tholos dome covers the middle of the Walk (`qa1-walk-warden2.png`), so the stealth beat plays half behind a dome.

**Expected vs actual**
- Expected: a long mirror; his REFLECTION paces it; you read his facing and slip between pillar shadows.
- Actual: no mirror, a ghost floating outside the building, and a dome over the action.

**Fix**
1. Make the pane a real `PlanarMirror` (the `Reflector` / `planar.gd` path the Hall uses). Put `patrol_fig` on `LAYER_DOUBLE` at the mirrored position, on YOUR side (x = 31.4), exactly like the sightings' `ghost_fig`. Only the mirror then shows him.
2. Give the pane a visible material: fresnel sheen, faint dirt and a stronger frame, e.g. `mirror_over` reused.
3. Clamp `wz` out of `SPRING_GAP` (`PATROL = (-43, -34)` plus a second beat `(-30.2, -26)`), or let him "step behind the pier" there.
4. Fade the tholos dome while the player is on WK. Add the dome's AABB to `occluders`, or use per-area `visibility_range` for the shrine roof.
5. Make the floor shadow bands readable: alpha 0.22 → 0.4, and a cool tint so the safe spots read at a glance.

### P1-4 The Undercroft: not dark, the lamp does nothing visible, and the vault hides the player

**Where:** `hub.gd` `_build_undercroft()` (a pale `mist_veil` quad), `world_geo.gd` `_undercroft()` (a 9.6×3 m roof slab at y 3.05), the lamp's `OmniLight3D` (energy 0.6, range 4.5).

**Repro:** `qa1-undercroft-dark.png` and `qa1-undercroft-lamp.png` (`tp:13.3:11.4`, then `give:lamp`, `tp:18.5:11.4`).

**Expected vs actual**
- Expected: "too dark to see your feet"; the lamp's real light shapes the space.
- Actual:
  - The mouth shows a faint white haze in a fully lit scene, so the text contradicts the picture.
  - Inside, it is as bright as the Atrium.
  - The roof slab covers the heroine from the fixed camera, and a dark round blot shows on the roof.

**Fix**
- **Darkness:** add a "dark" mask to the zone's marble. Darken the `UC` zone vertex colours (or a `dark_k` uniform in `marble.gdshaderinc` driven by distance from `lamp_light.global_position`), plus an unshaded black `mist_veil` volume inside the vault. The lamp then cuts a 3 m clear circle (`lamp_r` in the veil shader).
- **The vault:** register the roof as an occluder (`occluders.append(AABB(...))`) so the see-through cut opens, or replace the slab with three arches (ribs) so the walkway shows between them.
- **The lamp:** raise the energy to about 1.4 in `UC` only, so it reads as warm light on the walls.

### P1-5 Gate of the Four Veiled: socketed seals break after a save / load

- **Where:** `hub.gd` `can_socket` / `socket` / `apply_state`, `chapter.gd:2345`.
- **Cause:** `inv.socketed` holds ints, which JSON reloads as floats (`[0.0, 1.0]`). In Godot 4, `0 in [0.0]` is false (checked: `has=false`).
- **Repro** (`probe2.log` 1):
  1. With three seals, socket 0 and 1. Save, reload, Continue.
  2. Both statues' runes are unlit (`lit 0.15`), and `can_socket(0)` is true again.
  3. Socketing 0 again makes `socketed = [0.0, 1.0, 0]`. `sockets_full()` is then true while statue 2 never lights.
- **Expected vs actual**
  - Expected: socketed statues stay lit, and each socket takes one seal.
  - Actual: after a reload the Gate looks empty, the same socket asks for a seal again, and one statue can stay dark through the finale.
- **Fix:** normalise on load, either `inv.socketed = socketed.map(func(v): return int(v))` in `Hub.apply_state()`, or store the sockets as strings ("0", "1", "2"). Audit the other int arrays restored from JSON the same way (`hall`, `scale_w`, `turned`, `ledge_statue` differ after a reload, per `probe1.log`).

### P1-6 Items: the places to use them are invisible, and no hint knows about v1

**Where:** `items.gd` (`pour_ring`: a torus at alpha 0.35, flattened 0.02; the reliquary: an unmarked 0.8 m block; the pin and the amphora as 15–20 cm models), `chapter.gd` `hint_target()` (no case for atrium, the reliquary, the amphora, the pin, the panel, the sockets).

**Repro**
- `qa1-n-pour-ring.png`: standing on the dry ring with focus `pour`. Nothing is drawn on the floor.
- `qa1-n-amphora.png`: focus `amph_take`. The amphora can't be picked out.
- `qa1-balcony-pin.png`: the pin on the stele can't be seen; only the pink stele glows.
- `qa1-w-relic.png`: the reliquary is one more block among plinths.
- `probe2.log` 4: `hint_target("atrium") = INF`.
  - After the Shadow Chamber (`gallery`), the `shard_gallery` hint is INF, so nothing points to the reliquary.
  - On the Walk (`y > 3`), the `eidolon_ledge` hint points BACK to `WK_down`.
  - At the Maze's end (area `echo_corridor`), the hint points to the Echo room through the bolted bars.

**Expected vs actual**
- Expected: the player can find, without text, where an item applies.
- Actual: they find it by walking into the interact radius.

**Fix**
- **The dry ring:** an inset darker stone disc with a pale salt-stain rim, about 0.9 m, through `floor_mark` (kind 2 or a new kind 4), lit faintly when you carry the full amphora.
- **The reliquary:** a bronze-banded casket on the plinth, with a hairline-crack decal; when the lens is up, the crack glows (`lens_only` design 5 is already there).
- **The pin and the amphora:** scale the models 1.6×. Add a slow `juice.glint` every 6 s while they lie untaken and the player is within 6 m.
- **The interact button:** when an interact consumes or uses an item (`pour`, `amph_fill`, `relic_w`, `e_panel`, `sec_*`), draw the item's 128 px icon in the button instead of the generic glyph (`controls.show_interact(icon, item_key)`).
- **Hints:** extend `hint_target`.

| Area / state | Hint target |
|---|---|
| `atrium` without the lamp | `LAMP_POS` |
| `shard_gallery` with `gallery` done and not `w_broken` | `RELIC_POS` |
| `echo_corridor` while z > −41 and not `n_poured` | `POUR_POS` |
| `eidolon_ledge` with `y > 3` and not `wk_crossed` | `(31.4, 5, END_Z)` |
| `gate_four` with seals in hand | the first empty socket |

### P1-7 Item feedback is inconsistent: no toast for the Lamp or the Veil Seals; the toast covers the area title and the map

**Where:**
- `hub.gd` `take_lamp` and `take_seal`: no `_toast`. Only `items.gd` calls `ui.show_item`.
- `satchel.gd` `show_item`: the toast at y 64, under `host`.

**Repro**
- Take the lamp in the playthrough: the `item` event plays a chime, but no card appears.
- The same for every seal: a bell only.
- `qa1-toast-chisel.png` / `qa1-w-relic.png`: the chisel toast covers "WHERE HER SHADOW FELL".
- `qa1-s360-map.png`: the pin's toast draws OVER the map.

**Expected vs actual**
- Expected: every new thing in the satchel gets the same card.
- Actual: the first item of the game (the Lamp) and the three key items (the Seals) are silent. The toast also fights the area title and sits on top of the map.

**Fix**
- Call `game.ui.show_item("lamp")` in `take_lamp` and `game.ui.show_item("seal", k)` in `take_seal`. For a seal, use a name per wing ("Seal of the Glass Wing" and so on) and the line "1 of 3".
- Place the toast at `y = 150` while `ui.area_label.modulate.a > 0.05`, or delay it until the label fades.
- Move the toast to a layer below `map_layer` (`host.move_child(toast, map_layer.get_index())`).
- Pulse the satchel slot (the `inv_pulse` treatment the shard slot has) on the first item.

### P1-8 New spaces read as greybox: the Atrium, the "scaffold", the bridge, the Balcony

**Repro**
- `qa1-atrium-entry.png`, `qa1-atrium-fountain.png`, `qa1-atrium-west.png`: the "thousand faces" are 0.5 m cubes stacked on plinths, with no face, chisel marks or variation. The dry fountain's basin is a flat pure-black disc that reads as a hole. The hub is a vast flat white floor; its three exits (the bridge north, the steps into the lake north-east, the Undercroft east) have no landmark or light to draw the eye.
- `qa1-scaffold-climb.png` / `qa1-scaffold-lamp.png`: "Theron's Scaffold" is a solid marble stair and a stone gallery on two thin black posts. There are no planks, ladder or poles. The 2-post gallery looks structurally wrong.
- `qa1-bridge-T1.png`: the Crumbling Bridge is a normal walkway between rails. No gap shows under it, and a 3–4.5 cm settle is invisible at this zoom.
- `qa1-balcony-south.png` / `qa1-balcony-north.png`: the Wind-swept Balcony is one long empty balustraded strip. The torn veils on the poles don't read at all, and petals are not visible. No narrow ledge or broken rail stretch.

**Expected vs actual:** `V1_WORLD.md` §2 describes Theron's open-air workshop (half-carved faces, scaffolds, crane arm), a bridge of loose slabs over a gap, plank ramps that flex, and veils streaming in gusts. The build has placeholders.

**Fix (`world_geo.gd`, A's prop kit)**
- **Faces:** swap the face cubes for 3–4 Tripo bust / half-face models (A's kit), as a MultiMesh with random yaw and scale, or the existing `statue` heads at 0.6 scale with `dbg_cheap` off.
- **Fountain:** give the basin the dry-stone material (marble with a moss stain) instead of black.
- **Exits:** place a lit brazier or a banner at each exit.
- **Scaffold:** rebuild the climb as WOOD (g 0.97) planks on poles, with an X-brace. Keep the stone stair as the gallery's base only.
- **Bridge:** cut the bridge's side walls to a broken rail. Show the void below (no slab under T1), and raise the settle to 8 cm with a 0.15 s camera shake.
- **Balcony:**
  - Double the veil length and opacity (`AmbientLife.veils(..., 2.4 length, 0.9 → 1.0 alpha)`).
  - Add 2 more poles and the broken-rail ledge (a 6 m stretch at x 26.6–27.4 with `balustrade` missing).
  - Put BAL in `main.EXPOSED` (P2-22).

### P1-9 Planar mirrors seen from behind: dark panes with white X lines and a sky reflection (placeholder look)

- **Where:** the Our Steps glass (and similar framed panes) seen from the Balcony, the Ledge and the Gate.
- **Repro:**
  - `qa1-balcony-north.png`: a dark slate pane with a large white X at the left.
  - `qa1-balcony-pin.png`: the bottom third of the screen is a mirror back showing clouds.
  - `qa1-ledge.png` and `qa1-gate-sockets.png`: the framed panes in the foreground block the view.
- **Expected vs actual:** the back of a mirror reads as stone or wood. Instead, the reflective face (plus its cross-brace lines) shows from outside the room, and it looks like a missing-texture placeholder.
- **Fix:**
  - Back every mirror quad with an opaque `marble` box 4 cm behind it (`Puzzles._mirror_quad`).
  - Set `cull_mode = CULL_BACK` on `mirror` / `mirror_over`, so the reflection is never drawn on the back face.
  - Drop the X lines from the back.

### P1-10 Area naming and music for the traversals point to the wrong place

**Where:** `names.gd` `REGION_AREA` / `AUDIO_ALIAS`.

**Repro**
- `qa1-balcony-south.png`: on the Balcony's south end (28, 2, 6), 25 m from the Ledge, the title shows "THE EIDOLON LEDGE" and the Ledge's bed plays (`BAL → eidolon_ledge`).
- The Atrium (the hub, where you spend the most time) plays the Court of Light's bed (`AUDIO_ALIAS atrium → court_light`), so the Court has no musical identity of its own later.
- The North wing's finale (the dry ring, the N seal at `EC_a`) is titled "THE ECHO CORRIDOR", with the E wing's music (`qa1-n-poured.png`: area `echo_corridor`).

**Fix**
- Map BAL to "atrium" until z < −17. Or add an "outer" area with its own wind-heavy bed (the `wind_gust` loop at 0.9 plus the ledge bed at −8 dB).
- Split `EC_a` into `MZ_end` (z > −41, area `mist_maze`) and `EC_a` (z < −41).
- Give the Atrium its own bed. Until A delivers one, alias it to `waking_pool` at −3 dB, which is closer in mood and not reused by a later room.

### P1-11 View-blocking geometry on the critical path

| Place | Shot | Blocker | Fix |
|---|---|---|---|
| The Mirror Walk, middle | `qa1-walk-warden2.png`, `qa1-gate-sockets.png` | The First Shrine's tholos dome | Occluder AABB for the dome, or hide the roof while `area == eidolon_ledge and y > 3` |
| The Undercroft | `qa1-undercroft-lamp.png` | The roof slab | See P1-4 |
| The Ledge entry (24, −22) | `qa1-ledge.png` | The upright drawbridge leaf (x 21) and a framed glass pane cover the heroine's left side | Lower the leaf's visual height while up, or add it to `occluders` |
| The Gate (27.4, −30.6) | `qa1-gate-sockets.png` | Two framed panes in the foreground fill the lower third | Mark them as occluders (the see-through cut), or cull them by camera side |

### P1-12 All sizes (worst at 360×780): long area titles run under the HUD slots

- **Where:** `ui.gd` `show_area`. The title is centred with no width cap.
- **Repro:** `qa1-s360-atrium-title.png` and `qa1-s430-atrium-title.png`. "THE ATRIUM OF A THOUSAND FACES" runs under the shard slot at (44, 98) at 430 wide too, and is wider than the screen at 360 ("THE" sits under the slot). "WHERE HER SHADOW FELL" and "GATE OF THE FOUR VEILED" also touch the slot.
- **Fix:**
  - Cap the label at `vp.x − 2·(inv_center.x + 30)`, i.e. 236 px at 360 wide.
  - Reduce the letter-spacing (the spaced caps) when the title is too long, or wrap to two lines.
  - Or move the HUD slots below the title band (y 140 / 194).

### P1-13 The items are single-use keys; most of the brief's item × puzzle combinations are missing

- **Where:** `items.gd`, `hub.gd`. The only reads of `has_item("lamp")` are the Undercroft (`hub.gd:396-402`).
- **What is there:**

  | Item | Uses |
  |---|---|
  | Lamp | the Undercroft |
  | Chisel | the reliquary, plus 2 memory locks |
  | Amphora | 1 pour, plus 1 memory |
  | Pin | 1 panel, plus 2 memories |
  | Shard | the lens, plus the reliquary sign, plus 2 memories |

- **Missing (`V1_PLAN.md` M3 / `V1_WORLD.md` §4):**
  - the lamp showing her footprints in the Maze, keeping the Warden's mist back, and lighting the Shadow Chamber's braziers from the floor;
  - the pin replaying the motif at singing stone and glass;
  - the puddle as a real planar mirror that shows "a sign carved overhead" (it is a metallic disc with a rune quad on it);
  - the chisel on the Hall's cracked wall.
- **Impact:** the "pick it up, use it later" loop happens once per item, so the satchel feels like a key ring.
- **Fix (cheapest first):**
  1. **The Maze:** if `has_item("lamp")`, raise the `_maze_still` threshold from 0.5 → 0 inside a 2.5 m radius of the player (the lamp shows the next prints while walking). One line in `_update_maze`.
  2. **The pin:** in `strike_song` and at the stair glass, an interact `pin_ring` within 2 m plays `sfx.motif(-12)` and flashes the stones in order. That teaches the song in any wing order (P2-9).
  3. **The puddle:** reuse the T4 `Reflector` (kind "pool", `plane_d` = floor + 0.01, `clip_h` 0.4) and put a carved sign quad overhead on the reflection-only layer.
  4. **The Walk:** the lamp's light pushes the `mist` quad back (`mist_mat.density *= 0.3` within 3 m of the player): the brief's "keeps his mist away".

### P1-14 Warden sightings: he appears, but his reflection falls outside the visible glass

- **Where:** `warden.gd` `_update_sightings()`. The ghost is placed at `player − n·min(1, 0.45·d)` with no test of whether its mirror image is on screen.
- **Repro** (`qa1_probe4.gd`, `probe4.log`):
  1. Trigger a sighting at the playthrough's own spot: Hall (0, 1, −16.6), yaw π.
  2. Project the ghost's reflected head and body along the orthographic camera ray onto the mirror plane.
  3. The hit lands 0.4 m outside the glass rect (`lu −2.96 / 2.58`, `lv 2.46 / 2.20`).
  4. Same in the Garden (`lu −2.42 / 2.20`).
  5. The web stills `qa1-f390-warden-s1..s3.png` show no Warden in the Hall's glass while the sighting runs.
- **Expected vs actual**
  - Expected: the rare cold sting coincides with a figure in the glass behind you.
  - Actual: the sting (already too quiet, P2-16) plays with nothing to see. The playthrough check passes because it tests `ghost_fig.visible`, not the image.
- **Fix:**
  1. Before showing him, test the reflected point with the camera-ray / clip-rect check from `qa1_probe4.gd` (`vis_in_mirror`).
  2. If it misses, slide `at` along the glass (`clip_u`) toward the visible part, or skip this chance.
  3. Change the playthrough check to assert the image is inside `clip_h`.

### P1-15 Performance: mirror rooms peak over the 250 draw-call budget (a regression since v0.7)

- **Where:** the planar mirror passes (`planar.gd` / `Reflector`) on top of the v1 scene: the PBR marble, props, ambient life and the Warden's two figures.
- **Repro:** `t4_rooms.mjs` (`run_t4.txt`, `qa1-r-<room>.png`): `jump:<room>`, wait 4.5 s, sample `ewState.draw_calls` (`RENDER_TOTAL_DRAW_CALLS_IN_FRAME`, the same measure as QA_CH1) three times, at 390×844 High.

**Draw calls per space**

| Space | Now (peak) | v0.7 |
|---|---|---|
| Court of Light | **391** / 377 | 194 |
| Shadow Chamber (`shard_gallery`) | **363** | 237 |
| Court → Maze door (12, −26.4) | **342** | 335 |
| Our Steps | 136 → **331** | 153 |
| Hall of Glass | 205 → **282** | 216 |
| Eidolon Ledge | **282** | 204 |
| Scales | **281** | 211 |
| First Shrine | 218 | 204 |
| Mist Maze | 207 | — |
| Waking Pool | 202 | 177 |

The perf HUD shows lower numbers on in-between frames (e.g. Court 209), so the cost is spiky: frames that also render a planar mirror nearly double the calls. On a mid phone that is a hitch at the mirror's update rate.

- **Expected vs actual:** under 250 per view (`V1_PLAN.md` M2-5). Seven views peak over it.
- **Fix:**
  1. Give each `PlanarMirror` a `cull_mask` that drops the props, ambient-life and fog-sheet layers (the reflections are soft and fogged anyway). Only the marble zone meshes, the puppets and the flames should reach the mirror cameras.
  2. Stagger the mirror updates (round-robin, one mirror per frame) instead of updating several on the same frame.
  3. Land A's MultiMesh batching for `rune_face` / `halo` / `light_pool` / `floor_mark` (HANDOFF 05:30 (b); W is waiting on the `INSTANCE_CUSTOM` layout). About 70 calls saved in exactly these rooms.
  4. Add a playthrough or web-smoke assertion: max draw calls per room under 250 on High.

---

## P2 (polish)

| # | Space | Issue | Evidence | Suggested fix |
|---|---|---|---|---|
| P2-1 | Satchel / Walk | The Warden still patrols and catches you while the satchel or map is open (controls are off, the world runs) | `probe2.log` 2: `caught 1, satchel open true` | In `Warden._update_patrol`: `if game.satchel.is_open or game.satchel.map_open: return` (or pause the tree under the card) |
| P2-2 | Map | Mostly blank paper. Labels of about 5–6 px at 360 wide ("The Atrium of a Thousand Faces"); region labels overflow their regions; the seal markers at alpha 0.3 grey are invisible on parchment; no legend | `qa1-s360-map.png`, `qa1-map.png` | Labels at a minimum of 11 px; seal markers as crimson rings (`Color(0.6, 0.1, 0.1, 0.5)` until taken); a pinch-zoom or a 1.6× crop centred on the player |
| P2-3 | Map | Seal markers sit on unrevealed fog, giving away where seals are while showing nothing around them | `qa1-map.png` | Show a seal marker only when its region is revealed (`map.is_revealed(region_of(SEAL_POS[k]))`) |
| P2-4 | Satchel | No close control (tap outside only); the counts "3" / "1" sit on the slot rim at 13 px | `qa1-satchel.png` | An "×" at the top right of the card; counts as a small dark badge |
| P2-5 | Satchel | Tablets: only the LAST one can be re-read ("3 of 8. The last: …") | `satchel.gd` `describe` | Tap the tablet slot again to page through all the tablets read |
| P2-6 | Memory shards | 7 collectables with no payoff in Chapter I (no "Face" ending code; no 7/7 reward) | grep `mem` | At least a 7/7 line on the ending card, or a toast "the Face remembers" |
| P2-7 | T4 colonnade | Her guide walks at 0.95 m/s against your 2.7 m/s, so you overtake your guide. Missteps onto decoys are refused silently (no splash, as the brief asked) | `hub.gd` `_update_colonnade`; `qa1-colonnade-T4b.png` (she stands beside you, not ahead) | `t4_s = move_toward(..., dt * 2.4)`. A refused move on T4 plays `step_wet` −10 and a `juice.ring` at the edge |
| P2-8 | T4 colonnade | The drowned shafts read as floating white marshmallows in a milky plane; the lake does not read as water from the Atrium | `qa1-atrium-entry.png`, `qa1-bridge-T1.png` | Water-line darkening on the shafts (wet band 0.3 m), a ripple ring per shaft, `milk` 0.42 → 0.3 near the Atrium |
| P2-9 | Echo, E-first | Her motif is taught at the Stair of Breath (W). An E-first player meets the song cold; `song_remember` fires only at the 2nd failure, once | `chapter.gd:1786` | Replay the remembered motif at every 2nd failure (`song_fails % 2 == 0`), or let the pin (P1-13) replay it |
| P2-10 | Reliquary | Breaking it leaves the plinth with a small 0.4 m seal disc that is hard to see; the "Close-set stone…" text appears before you ever saw the sign | `qa1-w-relic-broken.png` | Seal scale 1.5×, a rising glint; show the first text only after the lens has been raised once anywhere |
| P2-11 | Amphora | The puddle is a metallic disc, not a mirror; the toast says "(full)" for 4 s after the pour | `qa1-n-poured.png` | See P1-13 (3); kill the toast tween on `pour` |
| P2-12 | Pin panel | A pink box with a disc; its "ring" icon reads like a phone or speaker | `qa1-walk-panel.png` | Bronze inlay with the motif's 5 notches; a tuning-fork glyph for `ring` in `controls._icon` |
| P2-13 | Seals | The three seals are identical; no name per wing | `hub.gd` `_build_seals` | Per-wing rune (`design` 2/7/3) and toast name (P1-7) |
| P2-14 | Walk / save | A checkpoint written on the Walk restores the Warden at `PATROL.x` facing south; if you saved in the open within 8 m you are caught on the first frame | `probe1.log` D | In `apply_state`, start him facing away from the saved position (`facing = sign(wz - p.z)`), or skip `_save_pending` while `on_walk` and not `in_shadow` |
| P2-15 | Walk | The catch is flat: fade, teleport, one line. No glass ring, no sigh (the brief) | `warden.gd` `_catch` | `sfx.play("@ev_voice_sigh", -14)`, a white flash on the pane (`mist_mat` density 1 for 0.3 s), a `juice.shake(0.1)` |
| P2-16 | Sightings | The sting is a glass hum at pitch 0.42, at about −27 LUFS effective: under the room bed | `main.gd` `warden_glimpse`, ebur128 | A real string sting (a manifest cue, or `ev_voice_sigh` reversed) at about −18 LUFS, ducking the bed by 4 dB for 2 s |
| P2-17 | Audio | Every new event reuses 5 sounds (glass hum, glass tap, statue grind, wet step, far bell): item pickups are a pitched glass hum about 10 dB under the solve jingle | ebur128: `glass_hum` −24.7 LUFS, `solve_jingle` −16 | An item pickup cue (`shard_pickup` at −6 dB is already there and unused for items); the seal: `resolve(2)` plus the motif's first two notes |
| P2-18 | Balcony | Not in `EXPOSED`, so the wind is 0.6 (the Ledge's), not 0.95; the veils' gusts (`life.gd` g) are not sent to `sfx.set_wind` | `main.gd` `EXPOSED`, `life.gd:148` | Add "BAL" to `EXPOSED`; `game.sfx.swell_boost = g * 0.4` while on BAL |
| P2-19 | Hints | The first hint after 180 s per space (unchanged); with hubs and traversals the "space" changes often, so the timer resets and players lost in the hub never get one | `chapter._update_hints` | Keep `hint_t` per WING, not per area; a hub hint toward the next unopened wing |
| P2-20 | Lore | Tablet t4 "Glass first, then marble, I told the guild" contradicts the garden stele "White marble first. Then a thousand faces. Then glass." | `items.gd` TABLETS, `level.gd:952` | t4: "Marble first, then glass, I told the guild. They thought it a riddle." (or make the stele the riddle's answer on purpose and say so) |
| P2-21 | Lore | Kythira, Theron's home, is never named; Ione is named only in comments. Fine for Chapter I, but the tablets are the natural place for one "Kythira" mention | — | t1: "…my hands do. Even on Kythira they said so." |
| P2-22 | Credits | No Godot MIT notice, no Liberation Serif OFL, no ambientCG / Tripo models (Warden, items, heroine v1); still lists v0.4 soundscapes excluded from the build | `credits.gd` vs `CREDITS.md` | Regenerate `Credits.TEXT` from CREDITS.md "in build" items; include the Godot licence text (MIT requires the notice in copies) |
| P2-23 | HUD / safe areas | The satchel slot (44, 152) and the toast have no safe-area inset (as P2-14 in QA_CH1) | `controls.gd` | As before: `env(safe-area-inset-top)` into the slot centres |
| P2-24 | Performance | Overdraw still about 9.0–9.4 screens everywhere (`?perf` fill); download 9.4 MB wasm + 22.9 MB pck (gzip), title about 31 s on this link; `cache-control: max-age=600` | `run_t1.txt`, curl | Drop the shaft and grain sheets on Auto; split the room beds into a second pck after the title; ask Pages for longer caching via hashed file names |
| P2-25 | Atrium | The wax tablet t1 and the memory lock m1 are generic boxes; the "cracked marble" shows no crack | `qa1-atrium-crack.png`, `qa1-s360-tablet.png` | A crack decal (`rune_quad` design 5 at 0.5 alpha, always on) on every chisel lock |
| P2-26 | Lamp | Once taken, the lamp is in her hand forever (every cutscene, the finale); no put-down | `hub._apply_lamp` | Hide `lamp_held` during `cine` and the finale; or hang it from her belt outside dark areas |
| P2-27 | Our Steps / dev | `steps.active` survives a `tp:` or `jump:` out of the grid. `steps_reset` then follows the player everywhere, takes the interact button and, pressed in the Atrium, teleports her back onto the Our Steps floor (seen in `run_t3c.txt`: focus `steps_reset` at the fountain; after the interact, pos (20.85, 1, −9.35)). Not reachable by walking, but it corrupts test runs and any future fast travel | `our_steps.gd:327-388` | In `OurSteps.update`: `if active and not _on_floor(pp): active = false`; reset `steps.active` in `Chapter.reset_state()` |

---

## Puzzles and traversal: scorecard (1–5)

Old puzzles are scored on the current build. Most QA_CH1 fixes landed: the pool decoy, the Echo parapet, the brazier leash, turn-in-place, the Gate auto-face.

| # | Puzzle / section | Wing | Clarity | Elegance | Aha | Goal clear without text? | Softlock / accidental solve? | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Crumbling Bridge (T1) | hub | 3 | 2 | 1 | Yes (it is just a walk) | No / n.a. | P1-8: does not read as a bridge |
| 2 | Theron's Scaffold + lamp (T2) | hub | 3 | 2 | 1 | Yes | No / n.a. | Lamp tiny on the bench; no toast (P1-7) |
| 3 | Undercroft (T5) | hub → E | 2 | 2 | 1 | No: not dark (P1-4) | No / n.a. | |
| 4 | Flooded Colonnade (T4) | hub → N | 3 | 4 | **4** | Mostly: her crimson figure leads | No / no | Best new beat; P2-7, P2-8 |
| 5 | Wind-swept Balcony (T3) + pin | hub → E | 3 | 2 | 1 | Yes | No / n.a. | No wind, veils or ledge (P1-8, P2-18) |
| 6 | Pool of Halves | W | 3 | 3 | 4 | Partly | No / no | Decoy removed (QA_CH1 P0-1) |
| 7 | An Answer on the Glass | W | 4 | 4 | 3 | Yes | No / no | |
| 8 | What the Glass Remembers | W | 3 | 4 | 4 | Mostly | No / no | Brazier leash fixed |
| 9 | Where Her Shadow Fell | W | 3 | 4 | 4 | Yes (live shadows, eyes) | No / low | |
| 10 | Reliquary (lens + chisel) | W | 2 | 3 | 3 | No: a generic block; the text carries it | No / no | P1-6, P2-10 |
| 11 | The Turned Ones | N | 3 | 4 | 4 | Yes, via the breath glass | No / low | **Skippable** (P0-1, P1-1) |
| 12 | Our Steps | N | 3 | 4 | 4 | Partly | No / no | **Skippable** (P0-1, P1-1) |
| 13 | Two Worlds of Light + mural | N | 2 | 4 | **5** | Hard | No / no | **Skippable** (P0-1) |
| 14 | Mist Maze | N | 3 | 3 | 3 | Yes (prints while still) | No / **auto-solved from the Echo side** (P0-1) | |
| 15 | Amphora: fill, then pour | N | **1** | 3 | 2 | No: ring invisible, fill spot unmarked | No / no | P1-6, P2-11 |
| 16 | Two Plates (Ledge) | E (gate) | 3 | 4 | **5** | Yes | No / no | |
| 17 | Pin panel | E | 3 | 2 | 1 | Yes (it hums) | No / no | A key and a door (P1-13) |
| 18 | Mirror Walk (Warden) | E | **1** | 2 | 2 | No: no visible glass; he floats outside (P1-3) | No (soft reset) / possible by luck | |
| 19 | Weight of a Reflection | E | 3 | 4 | 4 | Partly (the stele) | No / several solutions, all need her | |
| 20 | Her Song | E | 3 | 4 | 4 | Only if the W wing was done first | No / brute-forceable (≤ 20 strikes) | P2-9 |
| 21 | Seal sockets | gate | 4 | 3 | 2 | Yes | No / no | P1-5 save bug |
| 22 | The Fourth Veiled | gate | 3 | 3 | 3 | Yes (the stele) | No / no | No longer auto-faces |

---

## Visual quality: concrete spots

Ordered by how bad each looks to a player.

1. **The Warden, three places:**
   - on the title screen in the pool (`qa1-s360-title.png`);
   - floating in the void beyond the Walk (`qa1-walk-warden2.png`);
   - beside you in the Spring gap (`qa1-spring.png`).
2. **The Mirror Walk glass:** a black wire rectangle in the air (`qa1-walk-panel.png`, `qa1-walk-warden.png`).
3. **Mirror backs:**
   - dark panes with white X lines from the Balcony, the Ledge and the Gate (`qa1-balcony-north.png`, `qa1-balcony-pin.png`, `qa1-ledge.png`);
   - the bottom third of `qa1-balcony-pin.png` is a sky reflection on the back of a wall.
4. **The Atrium:**
   - cubes for faces and a black hole for a fountain basin (`qa1-atrium-fountain.png`);
   - a fallen "crane arm" that reads as a loose plank (`qa1-s360-tablet.png`).
5. **The Undercroft:**
   - a bright arcade with a roof that hides you;
   - a dark round blot on the roof (`qa1-undercroft-lamp.png`).
6. **The scaffold:** a stone stair, and a stone gallery on two iron posts (`qa1-scaffold-lamp.png`).
7. **The Balcony:** a long empty strip; one pole, no visible veils (`qa1-balcony-south.png`).
8. **The T4 lake:**
   - milky plane, floating drums;
   - a stair stub rising out of the water to nowhere (`qa1-colonnade-T4b.png`: the T4 steps onto the colossus stones, read without context).
9. **The heroine's readability:**
   - in the West court she is as pale as the statues around her and hard to find (`qa1-w-relic.png`);
   - the held lamp shows as an orange blob at her head (`qa1-n-amphora.png`, `qa1-n-fill.png`).
10. **Placement:** `tests/overlap_test` and the playthrough's collision audit are green (2468 primitives, 0 hits). Nothing floats or intersects in the shots, except the Warden (above) and the dev-only bench lamp after `give:lamp`.

## Juice and feel: flat moments

- **Taking the Lamp:** no toast, no lift, no flare. The bench flame should flare, then settle, in her hand. This is the hub's key moment.
- **Taking a Veil Seal:** a bell only. Each seal should get a 2 s hold: she raises it, the rune flares, the bed resolves, a toast appears.
- **Setting a seal in the Gate:**
  - Currently a chime and a grind. It should be a beat of its own: the statue's head turns to you, dust falls, and the ring lights one third.
  - On the third seal, show the "you are the fourth" text and a camera micro-push.
- **The Crumbling Bridge:** a 3–4.5 cm settle at a 7.5 m zoom is invisible. Add a creak, an 8 cm drop and pebbles into the void.
- **The Undercroft:** no darkness to part. The best possible "lamp" moment is lost (P1-4).
- **The Balcony:** no gust audio, veils too faint, no petals visible at 390 wide.
- **The Warden:** the catch is a fade; the sighting sting is inaudible (P2-15, P2-16).
- **The pour:** the puddle grows, but there is no splash, no ripple shine and no reflection reveal.
- **The pin on the panel:** a pitched glass hum. It should ring the motif (P1-13).
- **The map:** the ink reveal is lovely but silent. Add a pen-scratch or `page` sound when a region inks in while the map is open.
- **Picking up a tablet:** the text only; no "3 of 8" chip.

## Story and text

- **Forbidden names:** none (Pygmalion, Galatea, Orpheus, Cyprus, Paphos) in any shipped string. "Lyre" appears only in audio file names.
- **Final lore:**
  - **Milos:** used in `MEMORY_1` ("the goddess's mirror from her shrine at Milos"), `SH_LORE` and m1.
  - **The goddess:** unnamed, which is fine.
  - **Ione:** unnamed in Chapter I, as `STORY.md` plans (the name is revealed in V).
  - **Theron:** named in "Theron's Chisel" and "Theron's Scaffold". That is fine, because the Warden = Theron reveal stays hidden.
- **Voice:** consistent. Tablets and inscriptions are Theron in the first person; memories are third person (QA_CH1 P1-10 done).
- **Issues:** the t4 tablet vs the garden stele contradiction (P2-20); Kythira missing (P2-21).
- **Typos:** none found in `items.gd`, `hub.gd`, `chapter.gd`, `level.gd`, `wonders.gd`, `warden.gd` or `main.gd`.
- **Tone:** the new lines are strong, especially t2 ("Then carve me moving"), t8 and m7.
- **Canon break:** the Warden is visible outside glass (P1-2, P1-3).

## Audio

- **Beds:** all 13 beds load (`[audio] v5 manifest: 13 rooms, 34 cues, 94/94 room events`).
- **New spaces have no bed of their own:**
  - Atrium → `court_light` (alias), and the Undercroft, Scaffold and T4 are part of it;
  - Balcony → `eidolon_ledge` (P1-10).
- **Solve jingle:** plays on every solve, including the false Maze solve (P0-1).
- **Item sounds:** a glass hum for every item (P2-17); the bell for seals.
- **Warden stings:**
  - catch: `chime_hall` + `whoosh`, no sigh;
  - sighting: too quiet (P2-15, P2-16).
- **Ambience:**
  - Undercroft drips: `step_wet` at −34 LUFS effective, within 9 m. Fine.
  - Far bells every 50–110 s at −32. Fine.
- **Loudness (ebur128 on the source files):**

  | Sound | Integrated loudness |
  |---|---|
  | `solve_jingle` | −16.0 LUFS |
  | `glass_hum` | −24.7 LUFS |
  | `shard_pickup` | −29.2 LUFS |
  | `ev_bell_far_a` | −19.9 LUFS |
  | `ev_voice_sigh` | −20.0 LUFS (available for the Warden's sigh) |

  No clipping in any of them (peaks ≤ −3.1 dBFS).

## Performance

**`?perf` readings** (390×844, DPR 1, High, SwiftShader; draw calls are what matter, since the fps is SwiftShader's):

| Space | Draw calls | Primitives | Fill |
|---|---|---|---|
| Atrium entry | 130–166 | 200k | 9.2 |
| Atrium fountain | 72 | 173k | 9.0 |
| Crumbling Bridge | 110 | 208k | 9.4 |
| Scaffold / lamp | 71 / 96 | 167–173k | 9.0 |
| Undercroft | 84–98 | 167–169k | 9.0 |
| Balcony S / N / pin | 68 / 79 / 115 | 115–208k | 9.0 |
| Flooded Colonnade | 89–92 | 181–188k | 9.0 |
| Eidolon Ledge | 151 | 196k | 9.1 |
| Mirror Walk panel / Warden | 124 / 97–114 | 137–167k | 9.0–9.4 |
| Upward Spring | 115–120 | 151k | 9.0 |

- **Draw calls:** the new spaces are all well under the 250 budget. The old mirror rooms are not: see the P1-15 table (the Court peaks at 391).
- **Overdraw:** about 9 screens (unchanged; P2-24).
- **Load:** title at 30.7 s in this harness. Download: wasm 9.4 MB plus pck 22.9 MB, both gzip.
- **Console:** 0 errors, 0 warnings across 4 web sessions (no `GL_INVALID_OPERATION` feedback loops: QA_CH1 P1-5 is fixed).

## Mobile layout

| Size | Result |
|---|---|
| 390×844 | Satchel card, toast and map all fit. The toast covers the area title (P1-7). |
| 360×780 | Long area titles run under the shard slot (P1-12). The map labels are unreadable (P2-2). The toast fits (x 72–344). The satchel card fits with a 20 px margin. |
| 430×932 | Satchel, toast and map fit. The Atrium title still runs under the shard slot (`qa1-s430-atrium-title.png`). The toast draws over the map (`qa1-s430-map.png`). |
| Safe areas | Still none (P2-23). |

---

## Scorecard

| Area | Score (1–5) | One line |
|---|---|---|
| Critical path and gating | 3 | No softlock in any order; but the N wing can be skipped (P0-1, P1-1) |
| Save / load | 4 | Robust mid-wing; the socket float bug (P1-5) |
| Puzzles (old) | 4 | The chapter's strength; most QA_CH1 fixes landed |
| Puzzles and traversal (new) | 2 | T4 is lovely; the rest are walks and keys |
| Items and satchel UX | 2.5 | Clean card and icons; single-use keys, invisible use-spots, missing toasts |
| Glass Warden | 1.5 | Visible on the title, floating outside the glass, no mirror; sightings land outside the visible glass |
| Visual quality (new spaces) | 2 | Greybox next to the polished rooms |
| Visual quality (old rooms) | 4 | Rich marble, good light; mirror backs leak |
| Juice and feel | 2.5 | Old rooms juicy; the new key moments are flat |
| Story and text | 4.5 | Consistent, evocative; one contradiction |
| Audio | 3 | Beds solid; the new spaces borrow beds; generic item sounds |
| Performance | 3 | New spaces cheap; mirror rooms peak at 280–391 calls (P1-15); overdraw and download remain |
| Mobile layout | 3.5 | Fits at 390/430; 360 titles and map labels |

## Top 15 fixes for the biggest quality jump

1. **P0-1:** the Maze solves only from inside it, and the E bars open only after the Maze. One rect, one condition, and a playthrough order check (E → N with jumps).
2. **P1-1:** gate the Ledge's drawbridge lever on `state["maze"]`, or remove it.
3. **P1-2:** hide the Warden until play (`root.visible = false`). One line; it is the game's first frame.
4. **P1-3 / P1-14:** make the Mirror Walk a real mirror, and place every sighting where the glass actually shows him. Put him on `LAYER_DOUBLE` on your side (as the sightings already do); keep him out of the Spring gap; fade the tholos dome over the Walk.
5. **P1-4:** make the Undercroft dark, with the lamp's circle and the vault as an occluder. This turns the hub's dullest walk into its best moment.
6. **P1-5:** cast `socketed` (and the other int arrays) to int on load.
7. **P1-6:** make the item spots visible: a stained dry ring, a banded reliquary, bigger glinting pickups, the item icon on the interact button.
8. **P1-6 / P2-19:** cover v1 in the hints: the lamp, the reliquary, the dry ring, the Walk's end, empty sockets; a per-wing hint timer.
9. **P1-7:** toasts for the Lamp and the Seals; keep the toast off the area title and under the map; pulse the satchel slot.
10. **P1-8:** dress the Atrium:
    - real half-carved faces;
    - a dry stone basin;
    - a lit landmark at each exit;
    - a wooden scaffold;
    - a broken-rail bridge over a visible gap;
    - streaming veils on the Balcony.
11. **P1-9:** opaque backs on every mirror (`CULL_BACK` plus a marble backing): this removes the "X pane" placeholders from three spaces.
12. **P1-13:** give items second uses. Cheapest first:
    - the lamp shows the Maze prints while walking;
    - the pin rings the motif at the Echo stones (also fixes E-first, P2-9);
    - the puddle as a real `Reflector`.
13. **P1-10:** give the Atrium its own bed; the Balcony is not "The Eidolon Ledge"; split `EC_a` so the N finale is not "The Echo Corridor".
14. **P1-15:** cull props and fx from the planar mirror cameras and stagger their updates, to bring the Court (391) and the Shadow Chamber (363) under 250. Also **P1-11 / P1-12:** view blockers (the dome, the vault, the drawbridge leaf, the gate panes) as occluders; cap the area title width at 360.
15. **Juice for the hub's key beats:**
    - lamp flare in hand;
    - seal raise with a resolve;
    - a socket beat with the third-seal "you are the fourth";
    - the Warden's glass ring and sigh (P2-15, P2-16).

---

## Screenshot index (`dev/shots/`)

- **Hub and traversal:** `qa1-atrium-entry|fountain|west|crack.png`, `qa1-bridge-T1.png`, `qa1-scaffold-climb|lamp.png`, `qa1-undercroft-dark|lamp.png`, `qa1-balcony-south|north|pin.png`, `qa1-colonnade-T4|T4b.png`.
- **East:** `qa1-ledge.png`, `qa1-walk-panel.png`, `qa1-walk-warden|warden2.png`, `qa1-spring.png`, `qa1-e-seal.png`, `qa1-wk-lapse-0..3.png`.
- **West:** `qa1-w-chisel.png`, `qa1-w-relic|relic-lens|relic-broken.png`.
- **North:** `qa1-n-amphora.png`, `qa1-n-fill.png`, `qa1-n-pour-ring.png`, `qa1-n-poured.png`.
- **Gate:** `qa1-gate-sockets.png`.
- **UI:**
  - `qa1-satchel.png`, `qa1-map.png`, `qa1-toast-chisel.png`;
  - `qa1-s360-*` (title, atrium-title, toast, satchel, map, tablet);
  - `qa1-s430-*`;
  - `qa1-f390-*` (map-full, atrium-lens, memory, warden sightings).
- **Rooms with `?perf`:** `qa1-r-<room>.png`.

## Notes and limits

- SwiftShader renders at 1–2 fps, so every position was set through the dev hooks and the feel was judged from code plus stills. Tween-driven juice (the bridge settle, the seal rise) could not be judged frame by frame.
- `give:lamp` (dev) does not move the lamp from the bench to her hand (`hub._apply_lamp` is only called by `take_lamp`), so the shots after `give:lamp` still show it on the bench. This is a dev-only artefact, not a game bug.
- The wing-order checks combine real interacts with state set through the probes; the reachability flood uses a 0.25 m grid and under-reports narrow stepping-stone paths (T4), so "n" results across T4 are not findings.
