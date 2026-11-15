---
name: ivory-level
description: Build or refine an Eidolon GO "ivory" level (Lara-Croft-GO-like, marble terraces on rock in warm mist) as real 3D from a concept picture, and review it pass by pass until it matches. Use when making a new ivory level, changing its look (rocks, stairs, mist, background, props, Ione) or judging renders against the concept.
---

# Ivory level: from a concept picture to a 3D level in its style

The level is built in **3D in the picture's style**, never by showing the picture itself (the user rejects that).
Everything lives in `eidolon-demo/`. Scratch outputs go in the session scratchpad (`$S`).

## Pipeline

1. **Trace the concept into a plan**: `python3 -I tools/ivory/trace.py <concept.png> goiv/trace.json [debug.png]`.
   - Hand-draw the floor polygons in picture pixels (`FLOOR_PX`) and give their heights (`H`).
   - List the flights as `[foot, head, width, steps]`. **Count the steps on the picture.**
   - Also list columns, arches, `rocks` (ledges `[centre, radius, top]`), the cypress, head, relief, block, volute, ring, nodes and edges.
   - Camera calibration: orthographic, yaw 45°, pitch 35°, 206 px/m, origin pixel (950, 1684) = level origin at height 0.
   - `square_flights` sets every flight along a plan axis. The edges climbing the flights follow.
2. **Build the 3D level in Blender**: `python3.11 -I tools/ivory_level.py -- goiv/level.glb goiv/level.json 7 96 goiv/trace.json` (seed 7, 96 AO samples).
   - It writes the slabs, flights, rock masses, ledges, columns, arches, cypress and relief.
   - It bakes ambient occlusion into the vertex colour R, and each rock's depth under its own floor into G (metres / 4).
3. **Build the meander stone**: `python3.11 -I tools/ivory/block.py -- goiv/block.glb 5`.
4. **Import**: `godot --headless --path . --import`.
5. **Render a clean frame** (the title line has faded): `tools/ivory/render.sh <out_dir>` writes `<out_dir>/p1_start.png`.
   Without `GH_ONLY=start` the game plays the level through and snaps every stage.
6. **Compare with the concept** (scripts in `tools/ivory/`, run with `python3 -I`):
   - `overlay.py` gives concept | render | 50% blend.
   - `pair.py <concept> <render> <out> top|bottom` gives large side-by-side halves.
   - `vstats.py` gives the share of cream, light, mid, shade and deep. The concept is about 25 / 28 / 17 / 16 / 14.
   - Zoom on every junction.

## Rules (each one is a mistake the user caught)

- **The bottom dissolves into mist.** This matters most.
  - Every rock fades a short way under **its own** floor: local depth in COLOR.g, with `lf_hi` 0.9 and `lf_lo` 3.2 m.
  - Do not use one global fog height. Low terraces would fog and high rocks would hang.
  - Keep the global fog only far below (-2.8 / -6.5).
  - The volute's cloth fades the same way.
- **Rock is broad planes of cut stone.**
  - No organ-pipe column blocks and no random lumps sticking out.
  - Outline resampled at 0.8–1.4 m. Simplify densified outlines (Douglas-Peucker) or they striate.
  - Upright corners eased by bevels of 0.04–0.12 m on about 60% of them: the "missing chips".
  - A cleft or two, starting **below** the top edge, and one shelf.
  - Darker right under the slab (`dk`, AO), then into the mist.
  - Ledges have a flat top that leans one way, with its rim eased all round. Never a dome or a mushroom.
- **Slabs**:
  - 0.36 m thick, on a broken outline (0.3 m steps, jitter ±0.045, smoothed once), the rock set 0.06 m in under them.
  - Chips on the top edge, but none within 0.9 m of a flight's end.
- **Stairs are a continuation of the rock.**
  - Each flight runs along a plan axis, with the counted number of steps.
  - One solid per flight: a stringer 0.24 m deep and nosings bevelled 0.014 m.
  - The last tread sits 4 mm under the floor and runs on under it, so no two faces are coplanar. Coplanar faces z-fight into grey hatching.
  - Every floor edge is cut square across a flight's breadth where the flight meets it (`square_to_flights`). A diagonal floor edge over the top step looks "crooked".
  - The rock under a flight is flush with its sides.
  - The groove zigzag uses the same step count, read from `level.json` → `flights`.
- **Nothing floats.**
  - `on_floor()` pulls columns and the tree inward until their footprint is on the floor.
  - Arches stand where traced, with the floor polygon drawn to hold them. Keep the exit ring clear of their bases.
  - Far colonnades and statues stand on table crags built under their feet: `spot_y` puts every foot at one height.
- **Background**: forced perspective, because the eye is orthographic.
  - Hazed bands: near crags in `far1`/`rock2` with little haze, the middle band in `far` (haze 0.3–0.55), far silhouettes in `farsil` (low contrast).
  - Rows of columns shrink toward a vanishing point.
  - Leave open mist between groups.
  - Hide the sea world's blue vignettes and rays (`_iv_hide_world`).
- **Props**:
  - The block is hand-cut: faces a little uneven, edges eased unevenly, chips, and the Greek key **cut in**, not raised.
  - The cypress is a simple carved-stone spindle (7 sides, 6 rings) in the level's khaki-brown, not a fir or a leafy tree.
  - The relief is an upright tablet in the rock face, turned to the eye.
- **Ione** (the `IONE_IV_*` branch of the hero shader in `main.gd`):
  - Smooth normals and the level's single sun.
  - Skin and terracotta ramps taken from the concept: skin #f7eadc–#c8ab92, cloth #b45d3b–#6a2c1f.
  - No grain, no extra lights (other lights blow her white out).
- **Shader (`IV_SH`)**:
  - Face normal from screen derivatives, a 4-tone ramp by the key light, soft fbm marble veins.
  - AO from COLOR.r and local mist from COLOR.g.
  - `light()` adds only the sun whose direction matches `key_dir`.
- **Edges**: MSAA 4x in the ivory level.

## Gameplay: swipe, turns, a puzzle proven first

The user wants Lara-Croft-GO play: one **swipe** = one step along the way, then the world takes its turn.

- **Input** (`ch1.gd`, `_unhandled_input`, ivory level only):
  - Press, then release: a drag of more than 26 px is a swipe; a shorter touch is a tap.
  - `_ivg_dir_nbr` picks the neighbour whose on-screen direction is nearest the swipe, within 50°.
  - A tap on a neighbouring node, or on the stone or volute beside her, is a step that way.
- **Design the puzzle with a solver before writing any game code** (`tools/ivory/puzzle_design.py`, run with `python3 -I`).
  - It writes `goiv/puzzle.json`: nodes, edges, start, exit, block, volute toggles, watchers, wanderers, solution, lines, intro.
  - It proves the puzzle by breadth-first search over the whole state. Wanted: the solution unique at its length, about 14–30 swipes, no trap states.
  - It also checks:
    - node margins on the floors (≥ 0.45 m);
    - clearance from columns and arches;
    - that the edges leaving a node differ on screen by ≥ 50°.
  - Re-run it after any re-trace.
- **The game mirrors the solver's `step()` exactly** (`_ivg_turn` and `_ivg_w_step`): faces strike whoever stands where they look, they break when stepped on from the side, the statue paces its route, the stone is pushed straight on along level ways, the volute turns the faces.
  - Keep the two in lockstep; the rules are written in `puzzle.json` → `rules`.
- **Make the rules visible**: each face's gaze is drawn as a faint red line and a ring on the node it watches.
  - Breaking, striking and the restart are animated.
  - A refused move costs no turn (`_her_no`).
- **Autoplay** (`_play_ivp`): it plays `solution` as real swipes, from screen positions, and snaps every step (`sNN_<node>.png`).
  - Check that the log's `IV step` lines match the solver's `solution_trace`.

## Review loop

- Do at least **10 passes** before showing the user.
- Each pass: rebuild, render a clean frame, then compare large side-by-sides and zooms on junctions (stairs to floors), feet of columns and arches, rocks, the mist line and Ione.
- Look for these faults:
  - things floating or overhanging;
  - crooked joints;
  - hatching (coplanar faces);
  - striations (too many vertices);
  - mushrooms or tables in the rock;
  - too pale a mid-tone (rocks fogged too soon).
- Then fix and repeat.
- Show the user a full frame (`SendUserFile`) with a one-line Greek caption. Reply in Greek, briefly.

## Commit

- Before every commit, stage the files, then run `python3 $S/keyscan.py`. It must print `clean`.
- Never put a model name anywhere but the trailer.
- Push to the session branch. The draft PR is already open.
