---
name: go-level
description: The system for making an Eidolon GO level (Lara-Croft-GO-like, played by swipes) from a concept picture. It covers laying the level square on a grid, building it as real 3D in Blender, shading it in the picture's style with mist below, and designing a turn-based puzzle proven by a solver. It also covers wiring the puzzle to swipe play and reviewing pass by pass. Use for any new level, and for any change to a level's look, puzzle or controls.
---

# Making a GO level

A level is **real 3D in the picture's style**, never the picture shown. The user judges by images and videos, notices every crooked joint and every floating thing, and wants it "perfect". Do many passes before showing anything.

Everything is in `eidolon-demo/`. The first level, ivory (`goiv/`), is the worked example. Its numbers below are starting values, not laws.

## 1. The plan: square on a grid, from the picture

- **Calibrate the eye on the picture.** Orthographic, yaw 45°, pitch 35°, pixels per metre, and the origin pixel at height 0. `tools/ivory/trace.py` has `at(px, py, h)` to turn a picture point at a height into a world point.
- **Lay the level square on the plan's axes in world metres** (`DESIGN` in `trace.py`).
  - Floors are rectangles or Ls, at the heights the picture shows.
  - Each flight runs straight from one floor's edge to the next, across its whole breadth, with the number of steps counted on the picture.
  - Hand-traced outlines come out on a slant, and the user calls them "crooked".
- **Things stand on floors, never over an edge**: columns, arches, trees and props. Leave about 0.45 m between nodes and floor edges or things.
- **Ledges ("rocks")** are rock without marble that binds the floors into one mountain. Each is `[centre, radius, top]`.

## 2. The build (Blender, `tools/ivory_level.py`)

`python3.11 -I tools/ivory_level.py -- <out.glb> <out.json> <seed> <ao samples> <plan.json>`, then `godot --headless --path . --import`.

- **Slabs**: about 0.36 m thick. The outline is broken: 0.3 m steps, jitter of a few cm, smoothed once.
  - Chip the top edge here and there, but not near a flight's end.
  - Where a flight meets a floor, the edge runs square across it (`square_to_flights`).
- **Flights**: one solid each, with a stringer under the line of nosings and eased nosings.
  - The last tread sits a few mm under the floor and runs on under it. Coplanar faces z-fight into grey hatching.
  - The rock under a flight is flush with its sides: the stair continues the rock.
- **Rock** (`mass`):
  - Broad planes of cut stone, a little in under the slab, then out and in going down, wider far down. Simplify dense outlines (Douglas-Peucker) or the rock striates.
  - A cleft or two starting below the top edge, and a shelf.
  - Upright corners eased by bevels of 0.04–0.12 m: the "missing chips".
  - Never organ-pipe columns, random lumps, domes or mushrooms. Ledge tops are flat breaks that lean one way, with an eased rim.
- **Props**:
  - Cut by hand, never perfect: a block's faces a little uneven, its edges eased unevenly, chips, ornament **cut in**.
  - Trees are simple carved-stone shapes in the level's colours.
- **Baked into the vertex colours**: AO into R, and **each rock's depth under the floor it bears** into G. The mist uses G.

## 3. The look (`IV_SH` in `ch1.gd`)

- **Palettes are sampled from the picture**, each as 4 tones: top, lit, mid, dark.
  - Measure hue and saturation, not only value.
  - Rock is **brown**, not grey: about h 20–28°, s 0.3–0.4.
- **Light is soft and diffuse.**
  - A face-normal ramp with wide smoothsteps.
  - Warm light thrown back into the shade (`bounce`).
  - Soft shadow edges (`shadow_blur` about 2.6).
  - Only the level's one sun lights it: filter the other lights in `light()`.
  - MSAA 4x.
- **The bottom dissolves into mist.** The user has said it a hundred times.
  - Every rock fades a little way under **its own** floor, by depth: `1 - exp(-(depth + wisp - start) / length)`, with start about 0.75 and length about 1.55 m.
  - The fog edge is broken by fbm wisps so it never cuts straight.
  - The global height fog reaches only the far bottom.
  - Fog colour is the sky gradient at that height on the screen; the bottom is a warm beige.
  - Hide any sea-world vignettes and rays.
- **The far off is shapes and gradation, not detail.**
  - Flat silhouettes (`sil`), each band paler with distance.
  - Each fades into the mist from its top down.
  - Forced perspective, because the eye is orthographic: smaller and higher with distance, and rows converging to a vanishing point.
  - Leave open mist between groups.
  - Far things stand on table crags built under their feet.
- **The heroine (Ione)**:
  - The hero shader's level branch: smooth normals, two ramps (skin and cloth) in the picture's colours, the level's sun only.
  - No grain, no extra lights, or her white burns out.

## 4. The puzzle: Lara Croft GO rules, proven before it is built

- **Turn-based on a node graph.** One swipe is one step; then the world takes its turn.
  - A move that cannot be made costs no turn.
  - Death means a quick restart.
  - Every rule must be readable on screen.
- **Vocabulary** (combine, invent, keep each rule one sentence):
  - **watcher**: strikes whoever ends a step on the node it watches; breaks when stepped on from the side.
  - **wanderer**: paces a route one step per turn; caught from the front, broken from behind; watchers strike it too.
  - **stone**: pushed one node straight on along level ways; blocks wanderers.
  - **lever**: turned from beside it, it turns watchers, raises a stair, and so on.
  - **exit ring**.
- **Write the solver first**, a Python breadth-first search over the full state (`tools/ivory/puzzle_design.py` → `<level>/puzzle.json`).
  - Aim for a solution of 14–30 swipes, unique at its length, with no trap states and a forced order.
  - Give it 2–4 insights, each provable: the solution must get longer without that element.
  - Check node margins and clearances, and that the edges leaving a node differ on screen by 50° or more.
  - Write the solution and its state trace into the JSON.
- **The game mirrors the solver's `step()` one to one** (`_ivg_turn` and `_ivg_w_step`).
  - **Swipe**: a drag of more than 26 px picks the neighbour nearest in screen direction, within 50°.
  - **Tap**: a tap on a neighbour is a step there.
- **Autoplay** plays the solution as real swipes and snaps every step.
  - The log's `IV step` lines must equal the solver's trace.
  - Then record a video: `--write-movie`, then ffmpeg to mp4.

## 5. Review loop (before showing anything)

- Render a clean frame: `tools/ivory/render.sh <dir>`.
- Compare large side-by-sides of top and bottom with the concept (`pair.py`). Also run `overlay.py`, and `vstats.py` (value classes; the concept's are about 25/28/17/16/14).
- Zoom on every junction: stairs to floors, the feet of columns and arches, rock corners, the mist line, the far shapes, the heroine.
- Hunt for these faults and fix each one:
  - crooked or slanted edges;
  - floating things or overhangs;
  - hatching;
  - striations;
  - grey rock;
  - fog cutting off sharply;
  - detailed backgrounds;
  - things too pale or too flat.
- Do **at least 10 passes**. Then send one full frame with a one-line Greek caption, and later a video. Reply in Greek, short.

## 6. Commit

- Stage, then run `python3 <scratchpad>/keyscan.py`. It must print `clean`, because API keys must never be committed.
- No model names anywhere but the trailer.
- Push to the session branch; the draft PR is open.
