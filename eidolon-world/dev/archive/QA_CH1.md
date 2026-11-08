# EIDOLON, Chapter I "The Veiled Gate": QA audit

- **Date:** 25/10/2026
- **Build tested:** live v0.7 (https://ndimt.github.io/game/eidolon-world/).
  - Chromium with SwiftShader, mobile touch context, 390×844 at DPR 1, 2 and 3; also 360×780 and 430×932.
- **Logic checks:** headless Godot 4.5.1 on the working tree (v0.8 WIP), including `tests/playthrough.gd`.
- **Scope:** findings only. No game files were changed.
- **Screenshots:** `dev/shots/qa-*.png`.
- **Scratch harness:** `/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/qa/`.
  - `lib.mjs` and `t*.mjs` are the Playwright scripts.
  - `gd/*.gd` are the headless probes.
  - `run_*.txt` are the logs.

## Executive summary

- **Overall:** the chapter is complete, solvable end to end and atmospheric. The scripted playthrough passes 279/280 checks on the v0.8 tree. The single failure is a v0.8 regression in the cinematic (see P1-12).
- **The pool slabs complaint is real, and it is a presentation problem.** The logic is correct and has exactly one solution.
  - What the player sees disagrees with the logic for three reasons:
    - her slabs are drawn as reflections, about 0.7 m off screen from your slab tops;
    - the most obvious route is a decoy that can never close;
    - in v0.7, every joint glows whether it connects or not.
  - Result: players turn the slabs, see a path that "almost" forms, and never see it close.
- **The other high-value problems:**
  - carrying the brazier out of the Hall takes over the interact button everywhere;
  - the Echo Corridor's singing stones are hidden behind the near wall;
  - "far" ruin silhouettes sit right next to the playfield as flat, untextured grey blocks;
  - statues hide the player without triggering the see-through;
  - WebGL feedback-loop errors from the planar mirrors;
  - an overdraw of about 8–9 screens per frame in every space.
- **Story and lore:**
  - No Pygmalion, Galatea, Cyprus, Paphos or Orpheus appears in any shipped text.
  - The voice of the memory lines is inconsistent (third person vs first person).
  - One inscription is written un-mirrored, which contradicts the "you are the reflection" rule.
- **Audio:**
  - All 13 beds and 13 solve/shrine cues exist and switch correctly.
  - The loudness spread across rooms is about 6 dB.
  - Some loop seams are suspicious.
- **Mobile layout:** holds up at all three sizes, with a few small overlaps.

**Severity key:**
- **P0** blocks progress or is broken.
- **P1** is a clearly visible flaw.
- **P2** is polish.

---

## P0

### P0-1 Waking Pool, "The Pool of Halves": rotating your slabs never visibly forms a path (owner report confirmed)

**Logic is sound.**
- `Ch1Geo.pool_path` has exactly one solution shape: turns `[1|3, 3, 1|3, 3]`, in at least 8 presses.
- I verified it by hand and with the playthrough solver checks.
- The piece rotation (`rotation.y = -turns·π/2`) matches `rot_conn` (N→E→S→W).

**The visuals defeat it.**

1. **Parallax offset.**
   - `pool_stones.gdshader` ray-traces her slabs as reflections in the water. Each one's visible top edge is the virtual image at y = 2·WATER_Y = −0.84.
   - Your slab tops are at y = 0.
   - With the 36° orthographic camera, the two are offset on screen by about 0.84·cos 36° ≈ 0.68 m. That is more than half a cell.
   - So a correctly aligned joint (your arm meets her arm) looks offset, and so does a broken one.
   - See `qa-pool-03-solution-laid-close.png`, `qa-pool-04-solution-laid.png` and `qa-pool-05-solution-laid-yaw1/3.png`. In the yaw3 shot, the reflected segments sit visibly down and right of the slab tops.
2. **The decoy route can never close.**
   - Her row-2 slabs `(1,2) NW` and `(2,2) EW` run straight into your slab at `(3,2)`, and `(4,2)–(6,2)` continue straight to the exit.
   - The south row therefore reads as an obvious straight path, broken only at `(3,2)`.
   - But `(3,2)` is an **L** (`NE`), so it can never join E to W. Players will keep turning it.
   - With turns `[1,0,1,0]` the path reaches all the way to `(1,0)` and dead-ends, which makes it look "almost right".
3. **No per-joint feedback (v0.7).**
   - Every arm end of every slab carries the same glowing seam whether or not a neighbour answers it (`floor_mark` kind 3, intensity 1).
   - So there is no local "this joint is right" signal. v0.8 WIP adds `_joint_ok` and `joint` lighting, which is the right direction.
4. **Hidden pivot spots.**
   - Pivots `(2,0)` and `(3,2)` can only be turned from the north rim (z ≈ −0.4) or the south rim (z ≈ 4.05).
   - Nothing signposts that the rims are walkable or within reach.

**Repro**
- `jump:waking_pool`, `tp:-0.35:1.7`.
- `cs:pool_turns:[1,3,1,2]` (one short of the solution), then `call:turn_pool:3` (solved).
- Compare `qa-pool-06-one-short.png` with `qa-pool-07-solved.png`.

**Expected vs actual**
- Expected: when the slabs line up, the water shows one continuous lit path, and each joint you complete lights.
- Actual: reflected segments are parallax-shifted, the obvious route is impossible, and joints give no local feedback.

**Fix (`chapter.gd`, `_build_pool`, `_pool_reflect`, `pool_stones.gdshader`)**
- **(a) Remove the parallax.**
  - Render her slabs at their true top height as a "ghost in the water" volume, using the existing `stone_ghost.gdshader` on her pool-piece meshes. Draw it on `LAYER_MAIN_FX` with depth test against the water only.
  - Or, in `pool_stones.gdshader`, intersect the reflected ray with the slab **top plane at `top_y`** first and draw that face as the primary read. The flanks only add depth.
  - Either way, her arm ends must line up with yours in screen space.
- **(b) Fix the decoy.** Either:
  - change `POOL_REALS[3]` to a straight piece and move the L elsewhere; or
  - drop ghost `(2,2)` so the south row visibly stops short.
  - Re-run the uniqueness check in `tests/playthrough.gd` ("exactly one arrangement") afterwards.
- **(c) Ship the v0.8 joint lighting.** Also pulse both halves of a matched joint for 0.4 s on the turn that completes it.
- **(d) Signpost the rim positions.**
  - Add a faint bronze footplate and a pivot mark on the rims at (−3.75, −0.4) and (−4.5, 4.05), facing the pivot.
  - Optionally raise the interact radius for pieces 2 and 3 only.

---

## P1

### P1-1 Hall of Glass: carrying the brazier out of the Hall hijacks the interact button

**Repro (headless, `gd/carry.gd`)**
1. `jump:hall_glass`, take the brazier at (3, −13).
2. Walk west out of the Hall into the Stair of Breath.

**Expected vs actual**
- Expected: the brazier can't leave the Hall, or it is dropped back.
- Actual:
  - The brazier floats after you anywhere in the world (checked at (−11.1, −11.1)).
  - Focus is permanently `hall_place`: the `place` interact sits at the player's own position, so it is always the nearest.
  - Pressing it only plays `hall_nope`.
  - Every other interact (the stair glass, inscriptions, lamps) is unusable until you walk back.

**Fix (`chapter.gd`)**
- In `_update_hall`, if `carrying` and the player leaves the rect `R(-4.6, -20.6, 4.6, -11.0)`, auto-return the brazier: `carrying = false`, tween it to its last `state.hall.brazier` cell and emit `hall_reset`.
- Also give the `hall_place` interact a cond: `carrying and _in_hall()`.

### P1-2 Echo Corridor: the four singing stones are hidden behind the near (south) wall in the default view

**Repro:** `jump:echo_corridor`, `tp:18.0:-45.3`. See `qa-echo-01-singing-stones.png` and `qa-echo-03-room-open.png`.

**Expected vs actual**
- Expected: the stones (the puzzle) are visible.
- Actual:
  - The 5.2 m south wall `R(11.0,-44.4,26.2,-44.1)` fills the view.
  - Only the circular see-through around the player is open, and the stones on the north wall at z −46.3 sit outside it.
  - In the rotated view (`qa-r-echo_corridor-rot.png`), the corridor reads as blank fog.

**Fix (`ch1_geo.gd`, `_echo`)**
- Lower the south wall to about 1.2 m (a parapet), or make it a colonnade, or mark its boxes as occluders with a wider fade.
- Alternatively, in `main.gd` `_process`, add a per-area camera rule: `if area == "echo_corridor": world.set_yaw_index(2)`, or offset the look toward z −46.

### P1-3 Many spaces: the "far ruins" silhouettes stand next to the playfield as flat grey blocks

**Repro:** `jump:stair_breath`. See `qa-grey-01-stair.png`: a large flat grey "T" covers the lower left. It stays with the fog sheets off (`qa-grey-02-stair-nofogsheets.png`) and with the environment fog off (`qa-grey-03-stair-noenvfog.png`). Similar slabs appear under the Waking Pool and the Scales.

**Cause**
- `level.gd` `_far_ruins()` places "huge drowned columns" with box caps up to 9 m high at points such as (−14, 4). That is 1.2 m from the stair landing.
- Other points sit close to the Echo Corridor and the maze pool: (−16, −14), (2, −40) and (16, −44).
- The material is unshaded, flat and unfogged. With an orthographic camera, "far" never fades, so they read as untextured geometry in front of the playable area.

**Fix**
- Keep every far-ruin point at least 8–10 m from any walk region and its cap below y −3.
- Or switch them to the `backdrop` / fog-tinted material with a height fade, and set `visibility_range_begin` relative to the player.

### P1-4 Stair landing and others: statues hide the player without triggering the see-through

**Repro:** `jump:stair_breath` (entry (−11, 0, 1.6)). In `qa-grey-01-stair.png`, the statue at (−12, 0, 2.9) covers the wanderer completely.

**Cause:** `Level.statue()` colours its vertices as occluders (`C(0.25, true)`) but never appends an AABB to `occluders`. So `World.update_reveal` never trips for statues.

**Fix:** in `Level.statue()`, `occluders.append(AABB(base - Vector3(0.5,0,0.5)*sc, Vector3(1.0*sc, (plinth+2.3)*sc, 1.0*sc)))`. Apply the same to the chapter statue meshes (`_statue_mesh` users) that sit near paths.

### P1-5 Planar mirrors: WebGL "Feedback loop formed between Framebuffer and active Texture"

**Repro**
- In one long live session (wake, all 13 rooms, gate solved), Chromium logged more than 30 lines of `GL_INVALID_OPERATION: glDrawElements: Feedback loop formed between Framebuffer and active Texture`.
- Log: `run_t6.txt` in the scratch folder.
- A shorter 9-room scan was clean, so the error depends on which mirrors are in view.

**Expected vs actual**
- Expected: no GL errors.
- Actual: the offending draws are dropped. That means a missing reflection or pane for a frame or more, and some drivers flicker.

**Cause**
- Mirror quads from `Puzzles._mirror_quad` stay on layer 1 (`LAYER_WORLD`), which is inside `PlanarMirror.REFL_MASK`.
- So a mirror can be drawn inside its own reflection viewport while sampling `refl_tex` from that same viewport. The garden glass is also "shared with the Hall".

**Fix**
- Put every mirror and sheen quad on its own bit, or on `LAYER_MAIN_FX`.
- Give each `PlanarMirror.cam.cull_mask` `REFL_MASK & ~own_bit`.
- Never let two mirror quads share one viewport texture.

### P1-6 Hollow Walk: you cannot turn in place, so "watching" a hollow costs a step

- **Where:** `Player.step` (yaw only follows the input direction) and `Controls` (dead zone 0.12, no response curve).
- **Problem:** the puzzle hinges on which hollow you face (50° cone, `hw_sees`). On a touch stick, any input above the dead zone moves you. Turning to face a hollow therefore changes your cell, which changes where both hollows step.
- **Solver:** the minimum solution is 13 ticks, and no single spot solves it. This is already the hardest puzzle in the chapter, and the control friction makes it worse.
- **Fix:**
  - In `main.gd` `_process`, when `controls.vec.length() < 0.35`, rotate `player.yaw` toward the stick and zero `input_dir` (turn in place).
  - Or let a tap on a hollow face it.
  - Also show the 50° watch cone on the floor (a `floor_mark` wedge) while standing still in the Walk.

### P1-7 See-through: hard-edged circular cut, reads as broken geometry

- **Where:** shots `qa-echo-01`, `qa-gallery-03-wrong-order-gutter.png` and `qa-r-*`.
- **Problem:** the reveal cuts a crisp ellipse through walls and their tops. The cut edges show the wall thickness as a pale crescent, which looks like a carved scoop.
- **Fix (marble / `marble_occ` shader):** dither or alpha-fade over about 25% of `REVEAL_R` instead of a hard discard, and darken the cut rim slightly so it reads as a lens rather than geometry.

### P1-8 Performance: about 8–9 screens of overdraw in every space; the Court/Maze doorway is the heaviest

**`?perf` readings (DPR 1)**

| Space | Draw calls | Primitives | Fill |
|---|---|---|---|
| Waking Pool | 177 | 143k | 9.0 screens |
| Stair of Breath | 174 | 146k | 8.7 screens |
| Hall of Glass | 216 | 169k | 8.5 screens |
| Shard Gallery | 237 | 176k | — |
| Garden | 196–304 | 163k | 9.0 screens |
| Hollow Walk | 153 | 147k | — |
| Court of Light | 194 | 137k | — |
| Court → Maze doorway (12, −26.4) | **335** | **248k** | — |
| Echo Corridor | 145 | 102k | — |
| Scales | 211 | 159k | — |
| Eidolon Ledge | 204 | 142k | — |
| Gate of Four | 153 | 120k | — |
| First Shrine | 204 | 132k | 8.7 screens |

- **Load:** about 24 MB compressed (9.4 MB wasm + 14.7 MB pck, both gzip). The title arrived after about 24 s here.
- **Fix:**
  - **Per-area visibility:** hide `Zone_*` meshes and puzzle nodes more than about 18 m from the player, either with `visibility_range_end` or a zone table in `main._update_area`.
  - **Overdraw:** cut the stacked full-screen fog sheets and grain (`f_fog`, `f_grain` and the shafts) on the AUTO tier. Measure each with `feat:<name>:0`.
  - **Download:** move the room beds out of the main pck, for example to a second pck loaded after the title.

### P1-9 The memory line is lost when the cinematic is skipped

- **Where:** `chapter.gd` `hand_in_the_water`, at `c.at(P + 49.5, … show_memory(Game.MEMORY_LINE, 3.0), false)`.
- **Problem:** `on_skip = false` drops the chapter's only memory line ("He carved her a thousand times…") when the player long-presses to skip.
- **Repro:** run `t9_save.mjs`. After the skip, `played` has no memory, but the milestone still shows.
- **Fix:** pass `true` for that `at`, so the memory line still appears after a skip.

### P1-10 Memory-line voice is inconsistent

- **Chapter memory:** `Game.MEMORY_LINE` is third person: "He carved her a thousand times. None of them would breathe."
- **Hidden memory #1:** `Chapter.MEMORY_1` is first person: "I took the goddess's mirror from her shrine…"
- **Inscriptions:** all first-person Theron.
- **Why it matters:** both memories use the same UI and silhouette, so the switch reads as two narrators.
- **Fix:** choose one voice per kind. For example, inscriptions are Theron in the first person and memories are third person: "He took the goddess's mirror from her shrine at Milos. She did not stop him. She only watched." That version also anchors the final lore (Milos).

### P1-11 Stair rune: the one inscription written un-mirrored

- **Where:** `chapter.gd` `_build_stair` ("carved large in the cliff wall, written normally").
- **Problem:** the core lore says the writing in your world is mirrored, and only the glass shows it the right way round. `inscription.gdshader` and `inscription_ui.gdshader` honour that rule; this rune breaks it in the very first space.
- **Fix:** flip the rune quad's `pts.x` (or UV.x) so it is carved mirrored. Her answer in the glass then reads right, which reinforces the twist instead of contradicting it.

### P1-12 v0.8 WIP regression: "cinematic: her veil lifts" fails

- **Where:** working tree, headless `tests/playthrough.gd`.
- **Result:** 280 checks, 1 failed. `her.veil_lift` read −1.15 at t = 38 s.
- **Status:** the live v0.7 cinematic looks correct (`qa-cine-34_5.png`). This is new in the rig work (`figure.gd` / `wanderer_rig.gd` `set_veil_lift`).
- **Fix:** check what writes `veil_lift` on the rigged path, then clamp it.

---

## P2 (polish)

| # | Space | Issue | Evidence | Suggested fix |
|---|---|---|---|---|
| P2-1 | HUD | The area title's left rule passes through the shard inventory slot (slot at (44, 98), r 22; rule end at about x 46, y 89) from the Gallery onward | `qa-ui-play-390x844@3.png` + layout math | `ui.gd`: shorten the rules to ±150 or move `inv_center()` to y 140 |
| P2-2 | HUD | Interact icons read as letters: `breathe` looks like "3▯", `turn` like "D" | `qa-stair-01`, `qa-garden-02`, `qa-pool-*` | `controls.gd` `_icon`: thicker strokes and a clearer glyph (a puff toward a pane; a circular arrow without the bar) |
| P2-3 | Hall | The reset altar uses the `turn` icon | code `hall_reset` | Use a dedicated "return" glyph |
| P2-4 | Title | "CONTINUE" / "TOUCH TO BEGIN" is light grey on pale fog (low contrast); "I · THE VEILED GATE" sits over the gate bars | `qa-save-01-title-continue.png`, `qa-size-360x780-title.png` | Darker ink, or a soft dark halo like `_halo` on the area label |
| P2-5 | Inscription | The area title shows through the semi-transparent inscription panel when you read right after entering a space | `qa-ui-inscription-390x844@3.png` | Hide `area_label` while `inscr_panel.modulate.a > 0` |
| P2-6 | Credits | In-game credits (`credits.gd`) list only the v0.4 soundscapes. The v5 score sources (Iowa MIS, FreePats, "Breves dies hominis", AuraVoice, qubodup, AntumDeluge, rubberduck) are missing, as is any author line. URLs wrap mid-word | `qa-ui-credits-390x844@3.png` | Regenerate `Credits.TEXT` from `CREDITS.md` (the "in build" items only); set `autowrap_mode = AUTOWRAP_WORD_SMART` |
| P2-7 | Shadows | Stair-stepped, pixelated shadow edges from columns and statues | `qa-pool-05-solution-laid-yaw1.png`, `qa-grey-01-stair.png` | Raise the directional shadow atlas on the High tier or use PCF soft shadows; set `shadow_blur` to about 1.5 |
| P2-8 | Mist Maze | Her petrol footprints are tiny, low-contrast marks in a large dark pool, and the maze floor is a featureless white plane | `qa-maze-01-still-footprints.png` | Larger, brighter prints (quad 0.5×0.82 → 0.7×1.1, `dark` 0.6), plus a faint grid on the maze slab |
| P2-9 | Scales | Interact radii of 0.45 m for weights and pans are fiddly with a touch stick | code `_build_scales` | Raise to 0.7, or prioritise the nearest pan within 0.9 when carrying |
| P2-10 | Hints | `HINT_AFTER = 180 s` per space is long on mobile; after the first hint it repeats every 22 s | `main.gd`, `chapter.gd` | 90–120 s first hint; back off to 45 s |
| P2-11 | Audio | Bed loudness spread: waking −19.7 dBFS RMS, hall_glass −25.7, the rest −20.5 to −23.6 | `run_t6.txt` | +3 dB on the `hall_glass` layer `gain_db` in the manifest |
| P2-12 | Audio | Loop-seam steps (seam jump vs typical sample step): hall_glass 0.023/0.006, hollow_walk 0.027/0.010, eidolon_ledge 0.024/0.010, waking_pool 0.0065/0.0022. RMS step at the loop for stair_breath (0.032→0.046) and mist_maze (0.035→0.048) | ffmpeg analysis | Re-render with a 50–200 ms equal-power crossfade at the loop point |
| P2-13 | Joystick | No response curve: output jumps from 0 to 0.12 at the dead zone, then is linear, so slow precise walking (plates, tiles) is hard | `controls.gd` | Rescale: `vec = off.normalized() * ease_curve((len-0.12)/0.88)` |
| P2-14 | Layout | No `viewport-fit=cover` / `env(safe-area-inset-*)`. Fine in Safari tabs, but a fullscreen or PWA launch would put the rotate buttons (y 44) and inventory under the notch | `index.html` meta | Add the safe-area insets to `Controls.rot_center` / `inv_center` and the UI top offsets via JS `getComputedStyle` |
| P2-15 | Gate of Four | The puzzle solves itself: the `wait` button auto-faces the shrine and locks you still, and the stele says "Stand where she stood. Be still" | code `wait_still` | Keep the button but don't auto-face; let the ring light only when facing (already checked) |
| P2-16 | Ending UI | "The Veiled Gate — awakened" sits over the tholos mid-screen with no backing | `qa-shrine-02-after.png` | Lower it to 0.7 of the height or add the halo |
| P2-17 | Gallery | The lens dims the whole screen and leaves the HUD on top. Readable, but the map sits at the lens edge at 390 wide | `qa-gallery-02-lens-map.png` | Centre the lens on the map (`chapter._update_lens`): bias the target toward (6.8, −10.5) as `main.gd` already does for the camera |

---

## Space-by-space notes

1. **Waking Pool**
   - The water reads well.
   - See P0-1, P1-3 and P2-7.
   - The stele text is correct for the final lore.
2. **Stair of Breath**
   - The glass conversation is clean (`qa-stair-02…06`): the fog, her half, the dotted hint after a miss, and the palm on success.
   - The `breath` cue fires.
   - The solve plays `cue:solve_stair_breath` and her motif.
   - See P1-4 and P1-11.
3. **Hall of Glass**
   - The mirror shows the remembered drum, brazier and bust with glows (`qa-hall-01`, `qa-hall-02`).
   - The floor grid helps.
   - The tablet text is good.
   - See P1-1.
4. **Shard Gallery**
   - Through the lens, the map shows I, II, III mirrored as designed.
   - A wrong order gutters, with sour and whoosh sounds.
   - The hint after two failures works (playthrough).
5. **Garden of the Veiled**
   - The Turned Ones' runes read in the great glass (`qa-garden-01`).
   - The breath message works.
   - The garden carries the most draw calls (up to 304).
6. **Hollow Walk**
   - See P1-6.
   - The gate opens on both locks.
7. **Court of Light**
   - The beam through her world reads well (`qa-court-02`).
   - The veil shadow on the mural is clear (`qa-court-04`).
   - There is exactly one stand setting, and the near way is a decoy (good).
8. **Mist Maze**
   - Invisible walls flash on a bump (`maze_bump` fires).
   - See P2-8.
9. **Echo Corridor**
   - See P1-2.
   - The song logic is correct (A D E F E, with the 2-fail reminder).
   - The room opens.
10. **Scales**
    - Level at a torque of 15/15 with the right weights and her reflection on tile 1 (`qa-scales-02`).
    - 14 ways to level it, all needing her.
11. **Eidolon Ledge**
    - Pushing the statue onto your plate while your reflection stands on hers reads well (`qa-ledge-02`). Good "aha".
12. **Gate of the Four Veiled**
    - See P2-15.
    - The ring lights per plinth.
13. **First Shrine and the cinematic**
    - Timing matches the score: letterbox at about 4 s, palm-touch ring at about 21 s, veil lift at about 34–37 s, memory at about 54 s, I / VII at about 61 s.
    - The framing is good (`qa-cine-*.png`).
    - Skip works with a 1.1 s hold and lands cleanly (letterbox off, awaken 1).
    - See P1-9.

**Save and continue**
- After a reload, the title offers CONTINUE plus NEW GAME, and Continue restores the chapter state (`qa-save-02-continued.png`).
- It resumes at the last checkpoint: the area entry or the 6 s autosave.

**Audio**
- Every room has its bed, and the `music` key matched the room in all 13 spaces.
- The beds cross-fade without doubling: one bed audible after 6 s.
- Solve cues are present for all 12 rooms plus the shrine.
- The manifest validates: 0 missing files.

**Story and text**
- No forbidden names (Pygmalion, Galatea, Cyprus, Paphos, Orpheus) appear in any shipped text.
- "Lyre" appears only in audio file names.
- No typos found.

---

## Per-puzzle scorecard (1–5)

| # | Puzzle | Clarity | Elegance | Aha | Goal discoverable without text? | Unwinnable / accidental solve? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Pool of Halves | **1** | 3 | 4 | Partly (the water shows her slabs) | No unwinnable state; accidental solve unlikely | P0-1: visual vs logic mismatch, decoy route |
| 2 | An Answer on the Glass | 4 | 4 | 3 | Yes (her half plus the carved whole rune) | No / no | A strong onboarding puzzle |
| 3 | What the Glass Remembers | 3 | 4 | 4 | Mostly (the glows in the glass) | No (reset altar, drum roll-back) / no | P1-1 carry bug |
| 4 | Her Lamps (Gallery) | 3 | 4 | 4 | Needs the shard; the map is clear once raised | No / about 1 in 24 by trial | |
| 5 | The Turned Ones | 3 | 4 | 4 | Yes, via the breath glass | No / low | |
| 6 | Hollow Walk | 2 | 3 | 3 | Weak (watch cone invisible) | No / no | P1-6; min 13 ticks: hardest in the chapter |
| 7 | Two Worlds of Light | 2 | 4 | **5** | The idea that "the beam goes INTO her glass" is hard to infer | No / no | Best "aha"; consider a stronger hint glint |
| 8 | Veil Shadow (mural) | 3 | 4 | 4 | Yes (the live shadow) | No / no | |
| 9 | Mist Maze | 3 | 3 | 3 | Yes (prints while still) | No / possible by brute walking | P2-8 |
| 10 | Her Song | 3 | 4 | 4 | Yes, if heard at the stair | No / no | P1-2 visibility |
| 11 | Weight of a Reflection | 3 | 4 | 4 | Partly (the stele helps) | No / several solutions, all need her | P2-9 |
| 12 | Two Plates | 3 | 4 | **5** | Yes (her footprints) | No (statue roll-back) / no | |
| 13 | The Fourth Veiled | 4 | 2 | 2 | Yes (the text gives it) | No / effectively auto | P2-15 |

**Difficulty curve:** the hardest two (Hollow Walk, Court) sit mid-chapter, and the chapter ends on two easy ones. That is fine, but the Hollow Walk needs the control fix to be fair.

---

## Top 10 fixes for the biggest quality jump

1. **Pool of Halves (P0-1).**
   - Draw her slabs at their top-face height, without reflection parallax.
   - Remove the impossible south-row decoy.
   - Ship per-joint lighting.
   - Mark the rim turning spots.
2. **Brazier leash (P1-1).** Auto-return the brazier outside the Hall, and condition `hall_place` on being in the Hall.
3. **Echo Corridor visibility (P1-2).** Lower or colonnade the south wall, or use a per-area camera yaw.
4. **Far-ruin placement (P1-3).** Push them more than 8 m away from the walk regions and fog-fade them.
5. **Statues as see-through occluders (P1-4).** Append an AABB in `Level.statue()`.
6. **Mirror layer isolation (P1-5).** No mirror inside its own reflection viewport, which ends the GL feedback-loop errors.
7. **Turn-in-place plus a visible watch cone in the Hollow Walk (P1-6).**
8. **Per-area visibility culling and less full-screen overdraw on AUTO (P1-8).** This is the biggest win on real phones.
9. **Story polish (P1-9, P1-10, P1-11).**
   - Keep the memory line on skip.
   - Use one voice for the memories, and name Milos.
   - Carve the stair rune mirrored.
10. **HUD polish (P2-1 to P2-5).**
    - Fix the area-rule / inventory overlap.
    - Clearer `breathe` and `turn` icons.
    - Title and CONTINUE contrast.
    - Hide the area title under the inscription panel.

---

## Screenshot index (`dev/shots/`)

- **Spaces:**
  - `qa-r-<room>.png` and `qa-r-<room>-rot.png`: every space at entry, with the perf HUD, and rotated 90°.
- **Pool:**
  - `qa-pool-01` … `07`: start, close-up, solution laid, three yaws, one short, solved.
- **Puzzles:**
  - `qa-stair-*`, `qa-hall-*`, `qa-gallery-*`, `qa-garden-*`, `qa-court-*`, `qa-maze-*`, `qa-echo-*`, `qa-scales-*`, `qa-ledge-*`, `qa-four-*`, `qa-shrine-*`.
- **Cinematic:**
  - `qa-cine-<t>.png` at t = 3, 9, 15, 21, 28, 34.5, 38.5, 46, 52, 56 and 61 s.
  - `qa-cine-skip-ring.png` and `qa-cine-after-skip.png`.
- **UI:**
  - `qa-ui-title|credits|wake|play|joystick|inscription-390x844@3.png`.
  - `qa-save-01|02`.
- **Layout:**
  - `qa-size-360x780-*` and `qa-size-430x932-*` (title, inscription, glass, lens).
- **Diagnostics:**
  - `qa-grey-01|02|03`: the far-ruin block, with and without fog.

## Notes and limits

- SwiftShader runs at 1–7 fps, so I used the test hooks for all positioning; I did not judge real-time feel by hand.
- Joystick and gesture behaviour was inferred from code plus synthetic CDP touches. The touch drive was confirmed: `joy` 0 and `vec` (0.57, −0.76) moved the wanderer.
- In two web runs, the Gate-of-Four wait did not complete within the harness window. It completes headless, and it completed in a longer web run, so I am treating it as a low-fps artefact rather than a bug.
