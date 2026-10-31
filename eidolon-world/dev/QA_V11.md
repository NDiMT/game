# EIDOLON v1.1b, Chapter I "The Veiled Gate": QA audit (round 2)

- **Date:** 31/10/2026
- **Build tested:** live v1.1b (https://ndimt.github.io/game/eidolon-world/, deployed 31/10/2026 09:21 UTC = commit `1139daf`).
  - Chromium + SwiftShader, mobile touch context, 390×844 and 360×780, DPR 1, High tier.
- **Logic checks:** headless Godot 4.5.1 on a frozen snapshot of `1139daf` (the working tree is being edited): `tests/playthrough.gd` plus `qa2_probe.gd` (Our Steps through the real touch stick, Warden sightings over a grid, sockets across a reload, hotbar layout at 360).
- **Method and rules:** as in `QA_V1.md`. Read-only on game files; Playwright runs under the shotlock.
- **Screenshots:** `dev/shots/qa2-*.png`.
- **Scratch:** `/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/qa2/` (`ta|tb|tc.mjs` + `run_*.txt`, `tree/eidolon-world/tests/qa2_probe.gd` + `probe.log`, `pt.log`).

## Executive summary

- **Big step forward.**
  - The playthrough is 421/421 and now plays every wing order.
  - The QA_V1 P0 and 8 of 15 P1s are fully fixed; the rest are partial, except P1-12, which is not fixed.
  - The Undercroft by lamplight (`qa2-uc-lamp.png`) and the Mirror Walk with the Warden in real glass (`qa2-walk-mid.png`) are now the chapter's best images.
- **No P0.** No softlock, no wing skip, no save loss found.
- **The new P1s:**
  1. **Web console flood.** On High, every flame-shadow pass logs "Dual paraboloid shadow mode not supported in the Compatibility renderer": 96 error lines in one 10-minute session, so those omni shadows don't render on the web. This was introduced by the QA_V1 P1-15 draw-call fix (`flame.gd:87`).
  2. **The Flooded Colonnade's hidden path is visible without her.** The hidden stones read as dry grey blocks and the decoys as round drums, so the path is obvious. Her crimson reflection is painted on top of stone (`qa2-t4-apex-crop.png`).
  3. **The new veiled eyes are too small to read on the floor.** At 390 px wide an almond is about 4–7 px. The v0.9.3 "bold readable eyes" were the owner's ask (`qa2-eyes-crop.png`).
  4. **Long area titles are now cut off at 360** ("…THOUSAND FAC") and still run under the shard slot (QA_V1 P1-12, not fixed).
  5. **Our Steps works, but its rule only shows once you step on.**
     - She is invisible before you step onto the board.
     - The glass line is a thin rod.
     - Stick aim errors above about 35° are swallowed by the direction hysteresis.
- **Polish to finish:**
  - **Hotbar at 360:** it works, but it duplicates the shard slot, sits in the stick's thumb zone, and each slot is about 41 px.
  - **In-between points:** pleasant but thin (one line and a sound each; the coin and the offering show nothing).
  - **Pool rise:** good.
  - **Reflections on the risen pool stones:** gone.
- **Pacing:** much better than v1.0. The hub, the traversals and the points give breathing room between puzzles. The East wing is still mostly a walk (Balcony → Ledge → Walk → Spring) before its two puzzles; the North wing is the reverse (four puzzles back to back).

**Severity key:**
- **P0** blocks progress or is broken.
- **P1** is a clearly visible flaw.
- **P2** is polish.

---

## 1. Verification of every QA_V1 P0 / P1

| QA_V1 | Issue | Status | Evidence |
|---|---|---|---|
| P0-1 | Maze auto-solves from the Echo side; N wing skippable | **Fixed** | `chapter.gd:1754` needs `maze_prog` at the end and z in −39.2…−40.8; `ec_unbolt` needs `state.maze` (`ec_held` text otherwise). Playthrough: "(QA P0-1) E first: the bars will not unbolt before the Maze is walked", plus W-N-E, E-N-W and N-E-W order checks, all PASS |
| P1-1 | Ledge drawbridge lever unconditioned | **Fixed** | `main.gd:746-750`: lever needs `state.maze`; `drawbridge_held` says "held from the far side". Playthrough PASS |
| P1-2 | Warden on the title screen | **Fixed** | `qa2-title.png`: only the heroine in the pool. `warden.gd:308` hides the patrol |
| P1-3 | Mirror Walk: no glass, Warden floating outside | **Fixed, mostly** | `qa2-walk-start.png`, `qa2-walk-mid.png`: a real framed glass with sheen; the Warden is a dark reflection IN it, beside her crimson reflection. Left over: the tholos dome still fills the lower half of the Walk view, and the heroine reads as standing on the dome (P2-1) |
| P1-4 | Undercroft not dark | **Fixed inside; partial outside** | `qa2-uc-lamp.png`: near-black vault, warm 3.4 m lamp circle. Excellent. `qa2-uc-mouth.png`: from the Atrium the mouth is still bright while the text says "Too dark to see your feet" (P2-2) |
| P1-5 | Sockets as floats after reload | **Fixed** | `probe.log` C: `[0, 1]`, lit 1.0, `can_socket(0)` false after save → quit → Continue |
| P1-6 | Item spots invisible, no v1 hints | **Partial** | Hints now cover the lamp, chisel / reliquary, fill / pour, the Walk's end and empty sockets (`chapter.gd` `hint_target`). The reliquary has a crimson sign (`qa2-relic.png`). Pickup markers are pale pillars; on the web the twinkles are off, so the pillar is a faint haze (`qa2-chisel.png`, `qa2-amphora.png`); see §2.6. The dry ring is still hard to see (`qa2-dry-ring.png`) |
| P1-7 | No toast for lamp / seals; toast over title and map | **Fixed** | `hub.gd:164`, `:335`; the toast sits under the title band (`qa2-walk-start.png`) and no longer over the map (`qa2-s360-map.png`) |
| P1-8 | New spaces greybox | **Partial** | Fixed: Atrium busts on plinths, carved dry fountain, ladder (`qa2-atrium-fountain.png`); bridge with broken rails over a visible gap (`qa2-bridge.png`); Balcony urns and a post with cloth (`qa2-balcony.png`). Left: the lamp gallery is still a stone stair on two thin black iron posts (`qa2-lamp-bench.png`), and the Balcony is still a long empty strip with one post on screen |
| P1-9 | Mirror backs: dark X panes | **Fixed (the X)**; view-blocking remains | `qa2-gate.png`: the panes now show the reflected room, no X. But see P1-11 |
| P1-10 | Area names / music for traversals | **Fixed** | Atrium has its own bed (`music: atrium`); the Balcony plays the Atrium bed; the dry ring is area `mist_maze` (`run_ta.txt`) |
| P1-11 | View-blocking geometry | **Partial** | Dome: an occluder was added (`level.gd:1060`), but it still covers the Walk at the player's height (`qa2-walk-mid.png`). Gate: two framed glass panes still fill the lower third (`qa2-gate.png`) |
| P1-12 | Area title under HUD at 360 | **Not fixed; worse** | `qa2-s360-atrium-title.png`: "THE ATRIUM OF A THOUSAND FAC" is cut off at the right edge and still starts under the shard slot |
| P1-13 | Items single-use | **Fixed (most)** | The lamp shows the Maze prints while walking (`chapter.gd:1715`); the lamp keeps the Warden's mist back (`warden.gd:195`); pin at the singing stones and the Spring (`pin_song`, `pin_spring`) |
| P1-14 | Sightings outside the visible glass | **Fixed** | `warden.gd:283` `seen_in_glass`; `probe.log` B: 24 sightings fired over a Hall + Garden grid, each passing the check |
| P1-15 | Draw calls over 250 | **Mostly fixed; caused a new error** | Peaks: Ledge 265, Shadow Chamber 260, Scales 242, Court → Maze door **314**, Hall during a sighting **336–362** (`run_tb.txt`, `run_ta.txt`). The fix's `SHADOW_DUAL_PARABOLOID` errors on the web (new P1-1) |

---

## 2. Fresh pass: the new v1.1 content

### 2.1 Our Steps (2 boards, EIDOLON board rules)

**Solvable with real input:** yes.
- `qa2_probe.gd` A drives the touch stick through `push_input` (the platform path), along each board's BFS solution, with aim errors of 0°, +20° and −30°. Both boards solved, 0 wrong steps.
- At +38° it fails: 5 wrong steps, neither board solved.
  - The cause is the hysteresis in `OurSteps.input`: `if best != _last_dir and dir_world(_last_dir).dot(wd) > bd - 0.2: best = _last_dir`.
  - At 38° off, the right direction's dot (0.79) beats the previous one (0.62) by only 0.17 < 0.2, so the previous direction repeats.
- A held stick repeats steps (2 steps in 2.5 s). That's acceptable.

**Solver:** each board has exactly one shortest solution (4 and 6 moves), with 38 and 108 states. Good: tight, no accidental solve.

**Her reflection before you step on:** no. `qa2-os-before.png` shows the board with your glyph, her glyph, a column and the thin glass rod, but she does not appear until you step through the gap (`qa2-os-on.png`, and the playthrough's "she is not there before you step on").

**Clarity (`qa2-os-on.png`, `qa2-os-board2.png`):**
- The board is now readable at a glance: two glyphs, one column, two figures.
- But the board is small (about 5 m across, roughly 270 px at 390 wide).
- The "glass" down the middle is a rod and a cast shadow, not a pane, so nothing says "mirror" until she moves opposite you.

**Scores:** clarity 3, elegance 4, aha 4. That's the right complexity for mid-chapter.

### 2.2 The in-between points

| Point | What it does | Visual payoff | Worth it? |
|---|---|---|---|
| Bell (`qa2-pt-bell.png`) | Swings; far bells answer | Bell visible on its post | Yes, the best one |
| Votive | Lights; stays lit | A lasting flame | Yes |
| Bench | Camera leans toward the drowned head | A real view change | Yes |
| Relief (Echo) | 3 lines as you pass | Rune quads as "relief" | OK; the panels don't read as carving |
| Cot | One line by lamplight | A low box | Thin |
| Offering | One line, a chime | Nothing changes | Thin |
| Coin (`qa2-pt-coin.png`) | glass_tink + glint | No coin is seen, no coin in the basin | Thin; also the focus did not come up at (5, 13.6) on the web: the approach point is at the rim's west, (3.75, 15.5) |

**Verdict:** they do slow the pacing usefully. But four of seven are "press, read a line", with no change in the world. Each needs one visible consequence (P2-4).

### 2.3 Hotbar UX at 360 px (`qa2-s360-hotbar-tap.png`, `probe.log` D)

**What works:**
- Five 46 px slots (about 41 device px at 360×780) at the bottom left, the chosen one ringed in crimson.
- Tapping a tool where it applies uses it; elsewhere it shows its toast.
- Tapping the shard toggles the lens (verified on web: `lens true`).

**Issues:**
1. **The shard is in two places.** The round shard slot (top left) and the hotbar slot do the same thing.
2. **The bar sits in the stick's zone.** The joystick starts on any touch with x < 60% of the width. The bar covers the bottom 72 px of the left 248 px, so a thumb that lands low presses a tool instead of starting the stick. It is checked first in `Controls._input`, so tools win.
3. **No labels or state.** The full amphora looks the same as the empty one, and nothing marks "usable here". The button glyph changes, but the slot doesn't.
4. **Hidden during area titles** (`qa2-s360-hotbar5.png`: no HUD while the title shows). That's fine, but the toast still appears.

### 2.4 Pool rise (`qa2-pool-rise-0..3.png`, `qa2-pool-risen.png`, `qa2-pool-risen-near.png`)

- The stones rise with mist and spray, then sit cleanly. No floating, no z-fighting.
- No reflection is drawn on the risen stone tops. **Verified clean.**
- The rise is fast at 1 fps, so it can't be judged for weight here. The playthrough confirms the event order.

### 2.5 Reflections on stones

- **Waking Pool:** clean (above).
- **T4 apex / hidden stones:** her crimson reflection is drawn over stone blocks (`qa2-t4-apex.png`, `qa2-t4-apex-crop.png`).
  - By design the hidden stones are under the surface, so her reflection over them is "correct".
  - But they now read as dry grey blocks above milky water, so the image reads as a red figure painted on stone.
  - It also gives the path away (new P1-2).

### 2.6 Eyes: alignment and readability

- **The statue's eyes:** two crimson glows on her face, aligned with the face. Readable (`qa2-eyes-crop.png`).
- **The floor pairs:** aligned with each shadow's throw, but almost invisible at the game camera.
  - Almond 0.105 × 0.042 m × scale 1.5. At about 43 px/m (390 wide) that is about 7 × 3 px, and they sit on pale marble.
  - Only one or two faint specks are visible in the crop.
  - The puzzle depends on seeing them (a shadow's head must land on a pair): new P1-3.

### 2.7 Pickup visibility (`qa2-chisel.png`, `qa2-amphora.png`, `qa2-pin-stele.png`)

- The PickupMarker pillar shows as a faint white haze. The web build has no twinkles (soft particles are off).
- The chisel by the statue and the amphora by the rail are now findable if you look. But on the pale marble the pillar is low contrast, and in fog it disappears.
- **The pin on the stele:** the stele's pink rune is the cue; the pin itself is a 2 px dark stick.

---

## P1 (new or still open)

### P1-1 Web: "Dual paraboloid shadow mode not supported" floods the console; flame shadows missing on High

- **Where:** `scripts/flame.gd:87`: `light.omni_shadow_mode = OmniLight3D.SHADOW_DUAL_PARABOLOID` (labelled "QA P1-15").
- **Repro:** live, High tier, visit any room with lit braziers (Hall, Shadow Chamber, Court). `run_ta.txt` / `run_tb.txt` log `ERROR: Dual paraboloid shadow mode not supported in the Compatibility renderer` from `_render_shadow_pass` on every shadow update: 96 lines in one session.
- **Expected vs actual**
  - Expected: a clean console (it was clean in v1.0-M3c) and the flame shadows working.
  - Actual: the error spam (a cost of its own on mobile browsers), and those omni shadow passes are skipped.
- **Fix:** `light.omni_shadow_mode = OmniLight3D.SHADOW_CUBE if OS.has_feature("web") else OmniLight3D.SHADOW_DUAL_PARABOLOID`. The draw-call saving should come from `Flame.budget` / `Flame.shadows` instead: shadows on the key flame only. Add "0 console errors on High" to `web_smoke.mjs`; it currently renders on Low, which hides this.

### P1-2 Flooded Colonnade: the hidden path is visible without her reflection

- **Where:** `shaders/still_water.gdshader` (`milk` 0.42, `opacity` 0.72), `world_geo.gd` `_colonnade` (true stones are square 0.9 m blocks at y −0.35…0.1; decoys are round drums).
- **Repro:** `jump:atrium`, `tp:11.9:5.4` → `qa2-t4-apex.png`. From the Atrium edge, the true path shows as a line of square pale blocks; the decoys are cylinders.
- **Expected vs actual**
  - Expected (`V1_WORLD.md` §2): "The stones are just under the surface, invisible from above; the still water shows them, and her walking ahead."
  - Actual: the stones are plainly visible, so her guidance is redundant and her reflection reads as painted on stone.
- **Fix:**
  - Per-fragment depth tint in `still_water`: alpha → 0.95 and `milk` → 0.55 where water depth is under 0.1 m, so a 5 cm-deep stone is hidden.
  - Make the decoys square too, so shape gives nothing away.
  - Draw the true stones only in her reflection: a `LAYER_DOUBLE` twin, as Our Steps v1.0 did.

### P1-3 Shadow Chamber: the new floor eyes are too small to read

- **Where:** `chapter.gd:1230` `VeiledEyes.for_shadow(..., 1.5)`, `shaders/veiled_eyes.gdshader` (`eye` 0.105 × 0.042 m).
- **Repro:** `jump:shard_gallery`, `tp:7.2:-12` → `qa2-eyes.png`, `qa2-eyes-crop.png`. The statue's eyes read; the floor pairs show as 1–2 faint specks.
- **Expected vs actual:** the owner's v0.9.3 rule was "bold readable eye-pairs". The pair a shadow's head must cover is now nearly invisible at 360–430 px wide.
- **Fix:**
  - Scale the floor pairs to 3.0 (almonds about 14 × 6 px at 390).
  - Raise the core to near-white with a crimson halo 2× the almond.
  - Keep `k` ≥ 0.9.
  - Or draw them camera-facing (rotated by `roll`, as W asked) so they are not foreshortened by the 36° camera pitch.

### P1-4 Area title cut off at 360 and still under the shard slot (QA_V1 P1-12, not fixed)

- **Where:** `ui.gd` `show_area` / the area label's width.
- **Repro:** `qa2-s360-atrium-title.png`. "THE ATRIUM OF A THOUSAND FAC" runs off the right edge, and the left rule passes under the shard slot at (44, 98).
- **Fix:**
  - Cap the label width at `vp.x - 2*(inv_center.x + 30)`.
  - Shrink the letter-spacing to fit, or wrap to two lines. The Crumbling Bridge already wraps ("THE CRUMBLING / BRIDGE"), so the wrap path exists: apply it whenever the measured width is over the cap.

### P1-5 Our Steps: the rule is invisible until you commit, and aim hysteresis eats corrections

- **Where:** `our_steps.gd` `update()` (`her.visible` only while `active`), `input()` (hysteresis 0.2), `_build_board` (the glass line is a 0.1 m sill and a rod).
- **Repro:** `qa2-os-before.png` (no her), `probe.log` A (err 38° → 5 wrong steps).
- **Expected vs actual:**
  - Expected: you can read "she is my mirror" before stepping on, and a quick correction of the thumb is honoured.
  - Actual: the second figure only appears on the board, and a correction within about 35° of the last direction repeats the last direction.
- **Fix:**
  1. Show her faintly at her start: `_her_vis` → 0.35 while the player is within 3 m of the entry gap. Have her idle-mirror your facing.
  2. Make the line a real low glass pane: 0.6 m high, `mirror` material, `cull_back`.
  3. Lower the hysteresis to 0.08, and apply it only within 0.25 s of the previous step.
  4. Flash both target glyphs when either of you stands on yours.

---

## P2 (polish)

| # | Space | Issue | Evidence | Fix |
|---|---|---|---|---|
| P2-1 | Mirror Walk | The tholos dome fills the lower half; the heroine reads as standing on the dome roof | `qa2-walk-mid.png` | Fade the dome by player distance on `WK` (alpha 0.25), or lower the occluder AABB to the dome's springing line (y 4.2) |
| P2-2 | Undercroft mouth | Bright from the Atrium while the text says "too dark" | `qa2-uc-mouth.png` | A black `mist_veil` volume inside the arch, visible from the Atrium (density 1 until the lamp), so the dark is seen before it is read |
| P2-3 | Lamp gallery | Still a stone stair on two iron posts | `qa2-lamp-bench.png` | Place A's `kit_scaffold` towers under the gallery's corners (HANDOFF 10:30) and wood-flag them |
| P2-4 | In-between points | Offering, coin, cot and relief change nothing in the world | §2.2 | Coin: a coin mesh drops, rings and settles in the basin (stays). Offering: a petal or ribbon lifts on touch. Cot: a blanket fold, or a tablet appears. Relief: a real carved relief (a `kit_face5`-style panel) in place of rune quads |
| P2-5 | Coin | Focus did not come up at (5, 13.6); the approach is at (3.75, 15.5), behind the basin from the camera | `run_tb.txt` | Put the approach on the camera side, `(0.0, 0, -1.6)` → (5, 0.5, 12.65), with a visible coin slot on the rim |
| P2-6 | Hotbar | Shard duplicated; sits in the stick zone; about 41 px slots at 360; no "usable here" state | §2.3 | Drop the round shard slot (or the shard from the bar); start the bar at x ≥ 0.6·vp.x, or move it above the stick zone (y − 90); pulse the slot of an item whose `HOT_USES` contains the focus id; show "full" as a water line on the amphora icon |
| P2-7 | Pickups | Pillar haze low-contrast on marble and in fog; the pin invisible on its stele | §2.7 | On the web, raise pillar alpha 1.5× and add a slow vertical light streak (no depth texture needed); pin model 1.8× |
| P2-8 | Dry ring | Still hard to see from the maze end | `qa2-dry-ring.png` | Darker inset disc and salt rim, lit faintly when the amphora is full (QA_V1 P1-6) |
| P2-9 | Hall sighting | 336–362 draw calls while a sighting is up in the Hall (190 otherwise) | `run_ta.txt` | Draw the sighting ghost only in the nearest planar mirror (its own layer bit); cull it from the other reflection cameras |
| P2-10 | Court → Maze door | 314 draw calls (over budget) | `run_tb.txt` DCS | Hide the Court's mirror rigs while in `MZ_door` / `TS` |
| P2-11 | Load | Title after 49.9 s here (30.7 s in the v1.0 run; pck 25.9 MB vs 24.9) | `run_ta.txt` | As before: room beds in a second pck after the title; check what grew the pck (the kit glbs, particles) |
| P2-12 | Map | Region labels still about 5–6 px at 360 | `qa2-s360-map.png` | Minimum 11 px labels; a 1.6× zoom centred on the player |
| P2-13 | Gate | Two framed panes still fill the lower third at (26.8, −30.4) | `qa2-gate.png` | Mark the panes as occluders, or cull them by camera side (QA_V1 P1-11) |
| P2-14 | Balcony | Long empty strip; veil cloth tiny on its post | `qa2-balcony.png` | 3–4 posts with longer cloth, a broken-rail stretch, petals at 2× size |
| P2-15 | Toast | The pin's toast appeared again on every `give` and every Walk entry while testing | `qa2-walk-*.png` | Show a toast only when the item is new (`give` already guards the list; `ui.show_item` in `main.cmd give` is dev-only, ignore if so) |

---

## 3. Overall feel and pacing

**Pacing across the chapter:**

| Section | Puzzles | Feel |
|---|---|---|
| Hub and traversals | none | Restful; the bridge, lamp and Undercroft now give the opening hour shape |
| West | Pool → Stair → Hall → Shadow Chamber → reliquary | The best-paced wing: points between every puzzle (bell, votive, offering) |
| North | Garden → Our Steps → Court → Maze | Four puzzles back to back, the hardest two (Our Steps, Court) adjacent. Needs one point between Garden and Our Steps (the doorway is listed but has nothing to do) |
| East | Balcony → Ledge → Walk (Warden) → Spring → Scales → Echo | Long walking before the first puzzle; the Warden beat is the only tension. Good contrast to North |
| Gate → Shrine | sockets, Four Veiled, finale | Clean ending; the socket beat is still a chime (QA_V1 juice note) |

**Still flat:**
- the socket beat;
- taking a seal (a bell; no raise);
- the coin, offering and cot points;
- the catch on the Walk (a fade).

**Still cheap:**
- the lamp gallery's iron posts;
- the Balcony's emptiness;
- rune quads standing in for the Echo relief.

**Unclear:**
- T4 (now too clear);
- the floor eyes (too faint);
- Our Steps before you step on.

**Broken:** the web shadow-mode error flood (P1-1).

---

## Scorecard (v1.0 → v1.1b)

| Area | v1.0 | v1.1b | Note |
|---|---|---|---|
| Critical path and gating | 3 | **5** | Every order tested; holes closed |
| Save / load | 4 | **5** | Sockets fixed |
| Puzzles (old) | 4 | 4 | Eyes readability regressed (P1-3) |
| Puzzles and traversal (new) | 2 | **3.5** | Undercroft and Walk excellent; T4 trivialised |
| Our Steps | 3 | 3.5 | Solvable and tight; rule only shown on commit |
| Items, hotbar, satchel | 2.5 | **3.5** | Cross-uses, toasts, hints; hotbar duplication and zone clash |
| Glass Warden | 1.5 | **4** | Real glass, a dark reflection, sightings land in the glass |
| Visual quality (new spaces) | 2 | 3.5 | Busts, fountain, bridge; gallery and Balcony remain |
| Juice and feel | 2.5 | 3 | Pool rise, bell, bench lean; the key item beats still flat |
| In-between points | — | 3 | Good pacing tool; too many are just text |
| Audio | 3 | 3.5 | Atrium bed; Balcony on the Atrium bed |
| Performance | 3 | 3.5 | Most rooms under 250; console errors; load slower |
| Mobile layout | 3.5 | 3 | 360 titles cut off; hotbar in the thumb zone |

## Top 15 fixes for the biggest quality jump

1. **P1-1:** `SHADOW_CUBE` on the web (one line). Add a High-tier "0 console errors" check to the web smoke.
2. **P1-2:** hide the T4 stones under the water (depth tint, or a reflection-only twin) and make the decoys square.
3. **P1-3:** floor eyes at 3× scale with a bright core, camera-facing by `roll`.
4. **P1-4:** area title cap and wrap at 360 (the wrap code exists).
5. **P1-5:** show her faintly before you step onto Our Steps; a real low glass pane down the middle; hysteresis 0.08.
6. **P2-6:** hotbar out of the stick zone; remove the duplicate shard; mark "usable here" on the slot.
7. **P2-4:** give each in-between point one visible world change (a coin in the basin, a ribbon lifting, a carved relief).
8. **P2-1 / P2-13:** fade the tholos dome over the Walk and the Gate's foreground panes.
9. **P2-2:** make the Undercroft's dark visible from the Atrium.
10. **P2-7 / P2-8:** stronger web pickup pillars, a bigger pin, a visible dry ring.
11. **P2-3 / P2-14:** wooden scaffold under the lamp gallery; dress the Balcony.
12. **P2-9 / P2-10:** sighting ghost in one mirror only; hide the Court's mirrors at the Maze door (314 → under 250).
13. **Juice:** socket beat (the statue turns, dust, the third seal's "you are the fourth"), a seal raise, a Warden catch sigh (QA_V1 juice list, still open).
14. **Pacing:** add one point between the Garden and Our Steps (the doorway), e.g. her small glass with a single breath rune, so the North wing's four puzzles get a pause.
15. **P2-11:** split the room beds into a post-title pck (title at 50 s is the first impression).

## Screenshot index (`dev/shots/qa2-*`)

- **Hub:** `title`, `atrium-entry`, `atrium-fountain`, `scaffold-lamp`, `lamp-bench`, `bridge`, `uc-mouth`, `uc-lamp`, `cot`, `balcony`, `bench`, `pin-stele`, `t4-apex` (+ `-crop`).
- **East:** `walk-start`, `walk-mid`, `walk-spring`, `gate`.
- **West:** `sighting-hall`, `sighting-hall2`, `relic`, `chisel`, `eyes` (+ `-crop`), `pool-pre`, `pool-rise-0..3`, `pool-risen`, `pool-risen-near`.
- **North:** `amphora`, `dry-ring`, `os-before`, `os-on`, `os-b1-step3`, `os-board2`, `os-b2-almost`, `os-solved`.
- **Points:** `pt-bell`, `pt-votive`, `pt-offering`, `pt-coin`, `pt-relief`.
- **360 px:** `s360-title`, `s360-atrium-title`, `s360-hotbar5`, `s360-satchel`, `s360-map`, `s360-hotbar-tap`.

## Notes and limits

- SwiftShader renders at about 1 fps, so motion (pool rise, bell swing, bench lean) was judged from stills plus code.
- The web Our Steps run used the `steps:` dev hook at 1 fps and did not finish board 2 inside its waits (`os-solved` shows `hollow_done` false). The headless real-stick probe solves both boards, so this is a harness timing artefact, not a game bug.
- Stale area titles in some stills (for example "THE MIST MAZE" at the Gate) come from `jump:` not re-announcing; they don't appear in normal walking.
