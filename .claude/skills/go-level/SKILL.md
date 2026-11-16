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

- **Slabs**: about 0.46 m thick, cut as a mason cuts them (the user: "corners as if carved, cut off").
  - Every corner that stands out is cut off aslant, each cut its own size (0.14–0.3 m), not quite square to the corner.
  - The top edge is a broad chamfer (0.09–0.17 m) whose breadth wanders along the edge; it dies away before a flight.
  - The outline runs in a few flat lengths (0.5–0.95 m), each turned a little its own way, so each face takes the light differently.
  - Pieces hang lower under the edge here and there; chips take the edge only, never the top, which is dead level.
  - Fill the top with `bmesh.ops.triangle_fill`, never an inner ring (it folds at notches) or `EAR_CLIP` (it bridges an L's notch when the face runs the other way). The builder reports any cap triangle outside its outline: it must report none.
  - Where a flight meets a floor, the edge runs square across it (`square_to_flights`), with no chamfer and no chip.
- **Flights**: the flight stays straight and square on the grid; only its stones are uneven (the user: "steps carved and slightly uneven").
  - Each step is two hand-cut half-blocks, either side of a channel down the middle (0.07 m wide, 0.03 m deep) where the way is drawn (`stair_groove` in the level's JSON).
  - Each half differs a little: rise ±1 cm, front ±1.2 cm, its outer end 0–3.5 cm out, a few mm of tilt; its nosing rounded (bevel 0.016–0.03 m, 2 segments); now and then a chip off its outer front corner.
  - The last step is flush with the floor above and runs on under it. Under the steps, the flight's body: a deep white band (0.42 m).
  - The last tread sits a few mm under the floor and runs on under it. Coplanar faces z-fight into grey hatching.
  - The rock under a flight is flush with its sides: the stair continues the rock.
- **The marble is in thick chunks set into the brown rock** (the user: "the white parts are thicker chunks bound inside the brown stone").
  - Under a slab the rock is mostly flush with its side: white above, brown below, no recess (a recess makes a floating table).
  - Here and there a broad block of rock beside the floor, its top 0.1–0.3 m under the floor's, most often on the sides the eye sees.
  - Beside each flight, chunks of rock (as broad as long, never planks) stepping up with it; a deep white band under its steps.
- **Rock under a floor** (`blocks`): soft low-poly, as the picture's.
  - A few broad blocks along each edge (1.6–2.8 m), each turned its own way (up to ±20°), so each takes the light its own way. Pieces stop where a flight's end or a hanging thing begins; they are never dropped whole.
  - Some are set back under the slab (a dark recess beneath it); some stand out a step lower with a lit top (ledges), their faces leaning back above the step.
  - Every block steps out partway down: never one straight pillar. Rows of upright prisms read as organ pipes, which the user hates.
  - Every edge is eased in two facets (bevel, 2 segments): soft, not sharp. Outer corners are cut off.
  - A core of rock behind them all.
- **Ledges** are clusters of soft boulders: a few broad faces, a top leaning one way, a side or a corner cut off, the top smaller than the body.
- **Small things set in the rock** (the relief stone) are placed by a ray cast onto the face the eye sees, half sunk in it.
- **Props**:
  - Cut by hand, never perfect: a block's faces a little uneven, its edges eased unevenly, chips, ornament **cut in**.
  - Trees are simple carved-stone shapes in the level's colours.
- **Baked into the vertex colours**: AO into R, and **each rock's depth under the floor it bears** into G. The mist uses G.

## 3. The look (`IV_SH` in `ch1.gd`)

- **Palettes are sampled from the picture**, each as 4 tones: top, lit, mid, dark.
  - Measure hue and saturation, not only value.
  - Rock is **brown**, not grey: about h 20–28°, s 0.3–0.4.
- **Light is simple and sharp**: one tone per face, crisp edges between faces (the user: "the light in the original is much simpler and sharper").
  - A face-normal ramp with narrow smoothsteps; only the level's one sun (filter the other lights in `light()`); MSAA 4x.
  - No AO, no darkening, no veil, no mist noise and no cast shadow on rock: soft shadows and wisps read as smudges (the user: "lit strangely, like smudges"). Shadows stay on the marble floors (her shadow, the cube's).
- **The bottom dissolves into mist, in one smooth fade.** The user has said it a hundred times.
  - Every rock fades under **its own** floor, by its depth under the slab (vertex colour G): one clean smoothstep from about 0.5 m down over about 1.9 m. Measure the fade on the picture (a column of pixels down a dark face) and match it.
  - Fog colour is the sky gradient at that height on the screen. Hide sea-world vignettes, rays and any screen vignette: the picture's sky and mist are clear to the edges.
  - Keep the sun's glow on the sky warm; a bright glow clips to green-yellow.
- **Palettes are sampled per thing from the picture** (the fallen face near white with grey-brown shade, the cypress a khaki olive, the far rock warm once the haze is over it), and checked with `vstats.py`.
- **The far off is shapes and gradation, not detail.**
  - Place each far thing where the picture has it: a pixel of the picture at a depth, `P(X, Y, depth)`.
  - Flat silhouettes (`sil`), no shadows on them, each band paler with distance, each fading into the mist from its top down.
  - Far rock as towers (upright walls, a step partway, a broken top) or broad soft hills deep in the haze; a row of columns on one sloped ridge, never a table or a row of pillars.
  - Leave open mist between groups: the picture has more air than things.
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
  - **gazer**: looks along a line until a stone or another face stands in the way; whoever ends a step in its look is struck; walked into from beside or behind, it breaks, and its plinth stays.
  - **wanderer**: paces a route one step per turn; caught from the front, broken from behind; watchers strike it too.
  - **stone**: pushed one node straight on along level ways, never onto a plinth or the ring; blocks wanderers and stops a gazer's look (behind it is shade, so it can be pushed ahead as a shield).
  - **lever**: turned from beside it, it turns watchers, raises a stair, and so on.
  - **exit ring**.
- **Write the solver first**, a Python breadth-first search over the full state (`tools/ivory/puzzle_design.py` → `<level>/puzzle.json`; for a level of its own, `tools/go/first_trial.py`: a generator, boards laid by hand in `HAND`, and `--hand` to prove them).
  - Good first trials are laid by hand around one clear idea and proven by the search; random boards are mostly unsolvable or too short.
  - Draw it before building it: `tools/go/draw_trial.py <design> <out.png> <step>:<caption> ...` shows the board and key moments of its solution side by side.
  - Aim for a solution of 14–30 swipes (a first level about 15), unique at its length, with no dead ends (states from which the ring cannot be reached; list them and remove their cause, e.g. a face's plinth stays when it breaks and the stone is never pushed onto it) and a forced order.
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

- Render a clean frame: `tools/ivory/render.sh <dir>` (`RES=1080x1920 TMO=1700` for a large one; `IV_DBG=4` shows how much mist each pixel has).
- Compare large side-by-sides of top and bottom with the concept (`pair.py`), and the same region of both enlarged (`zoom.py <concept> <render> <out> x0 y0 x1 y1`). Also run `overlay.py`, and `vstats.py` (value classes; the concept's are about 25/28/17/16/14).
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
