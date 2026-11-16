---
name: go-level
description: The system for making an Eidolon GO level (Lara-Croft-GO-like, played by swipes) from a concept picture. It covers laying the level square on a grid, building it as real 3D in Blender, shading it in the picture's style with mist below, and designing a turn-based puzzle proven by a solver. It also covers wiring the puzzle to swipe play and reviewing pass by pass. Use for any new level, and for any change to a level's look, puzzle or controls.
---

# Making a GO level

A level is **real 3D in the picture's style**, never the picture shown. The user judges by images and videos, notices every crooked joint and every floating thing, and wants it "perfect". Do many passes before showing anything.

Everything is in `eidolon-demo/`. The first level, ivory (`goiv/`), is the worked example. Its numbers below are starting values, not laws.

## 0. A new level: from the puzzle to a concept to 3D

The levels are many, in one system. A new level is made in this order (the second level, `gosea/`, "The Drowned Sanctuary", is the worked example):
- **The puzzle first**, proven by a solver on a board of its own (`tools/go/first_trial.py`).
- **The plan from the board**: the board's cells laid square in world metres, with room for the flights between floors (`tools/go/shield_plan.py` writes `<level>/plan.json` and `<level>/puzzle.json`, and asserts that the plan's way is the board's).
- **Build it** with `tools/ivory_level.py` (it runs without trees, columns, arches or a relief).
- **A concept from our own blockout**: render the built level through the game's eye (`tools/go/preview.py -- <glb> <json> <png> [px] [sea y]`, with placeholders for far scenery from the plan's `scenery`), and have the image model repaint it in our style with a new setting, keeping the layout. Then refine its light and sky in a second pass. Store it as `<level>/concept.jpg` (the model returns JPEG data even for .png names).
- **The game loads the level's own folder** (`go_dir`, chosen by `FLIP=<level>`): its own palettes and sky sampled from its concept (tone bands and warm/cool balance by region, not single pixels), its own key light, its own far scenery.
- **A level entirely of our own** (the third, `gomoon/`, "The Moon Dial", is the worked example):
  - Search for the board (`tools/go/moon_search.py`, then `moon_local.py` about a hand-laid one), prove it (`moon_design.py`: unique, every element needed), and lay it out with `moon_plan.py`.
  - The setting comes first in the prompt: a place, a time of day, one strong light, one warm accent, falling weather, a framing thing in a corner.
  - The image model paints its own props (it turned the moon dial into the ivory scroll). Take the concept's light, palette, sky and atmosphere; the layout and the props stay ours.
- **Frame the eye from the level's extent on the screen.** Put every node, floor corner, arch top and the stair's foot on the screen: `sx = p·b.x`, `sy = p·b.y` (b from `_ivp_basis()`: yaw 45°, pitch 35°).
  - The width is the extent plus margins; the height is the width × 16/9.
  - Place the centre so the sky's great thing (the moon, the sun) has room above the level and the mist has room below. The centre is any point `sx·b.x + sy·b.y + t·b.z`; choose t so that y is about 0.5.
  - To fill the bottom, let the first stair come up out of the mist from low on the screen.
- **A new level must be new in its layout and setting, never in its material language.**
  - A reskin is rejected ("this map is the previous one just with snow"), and so is a new way of building: the quarry as a white heightfield of benches had "nothing to do visually with the other levels"; the user wants "the same bulky design" everywhere.
  - Every level is thick carved slabs with chamfered, broken edges on chunky faceted rock, in mist. Colours may change freely (blue slabs are fine).
  - What is new: the layout, the setting, the props, the light, the sky.
  - Design it yourself first, with a blockout through the game's eye (`tools/go/preview.py`); the image model may only paint its look later.
- **The quarry's lessons** (`goquarry/`, scene `quarry`):
  - Every edge on one lattice (0.45 m), so the level is cut as blocks.
    - Benches step down from the walkways into the pit; where two meet, none rises within a hand of the lower floor.
    - The quarry's faces rise behind in steps, like an amphitheatre.
    - Stairs are cut solid down to the bench they rise from (`flight(..., solid=True)`).
  - Sawn faces carry the drill's vertical grooves and horizontal beds in the shader (`drill`), not in the mesh.
  - Walkways must read apart from the benches beside them: darken the benches by their depth under the way (`dk`).
- **The eye's middle line**: the camera looks along the grid's diagonal, so cells (g, g) stand one above another on the screen. Never put two things on that line (the dial behind a face, the start below both).
- **Doors and gates face her way to them**, and must be seen whole.
  - A gate she walks through stands square to the last stretch of her way. The user called a gate 90° off "wrong" three times.
  - Cut low any rock between the eye and a door; a door half behind a face of rock reads as nothing.
- **The builder's dice are its own**: never seed from Python's `hash()`. It is salted per run, so each build would be another level. Seed from the name's characters.
- **Backdrops come from the kit** (`bgkit/`: twenty elements painted in greys and keyed to their own alpha).
  - `tools/bg/compose.py <recipe> <out>` lays them on a sky by a palette (`night`, `dawn`, `day`, `dusk`, `storm`): each element coloured by its depth, hazed toward the sky behind it, its foot fading into the mist.
  - The same recipe in another palette is another place. Write a recipe per level (`tools/bg/recipes/`), and save its output as `<level>/backdrop.jpg`.
  - The level's mist samples the backdrop at each point of the screen (`bg_tex`), so nothing ends on a line.
  - Feather each element's edges widely (12% of its size): clouds painted to the picture's border otherwise end on a straight cut.
- **The campaign** (the ladder of levels, easy to hard):
  - Know the story first: `eidolon-world/dev/EIDOLON_SCRIPT.md`. In these levels she is Ione's soul, faceless, in the real ruin, climbing to the still water where she can see her face again; Theron's carved faces watch for her, and being seen sends her back to the start.
  - Each level opens with two lines of the story and ends with one (`lines`, `end` in its puzzle), telling the truth in order: the sculptor, the condition, the face life carved, the veil and the hidden mirrors, her secret life, the day without a wave, the thousand faces, the mirror, the Guardian. Her only spoken line is the last level's end.
  - The first three levels teach. A mechanism appears first alone with a one-step solution, then at normal difficulty, then combined with others.
  - Even a tutorial has one visible cause and effect, never only a walk: "how is the puzzle solved?" was the user's question to a level that was only a path.
  - **Fully logical, nothing pointless in the way**: every column, rock and prop on or beside the way has a reason the player can read (a chain from a winch to the stones it lifts). Never a stray column she must walk round.
  - An image model's concept is for light, colour and atmosphere only. Its layout and props are random (stones out of line, rings that lead nowhere, an exit beside the gate) and must never become the board.
  - The tutorial hand (`<level>/hand.png`, `tutorial: true` in the puzzle): after a moment of waiting it strokes the next swipe below her, with a fading trail; a mechanism already worked is passed over.
- **Things that move in a level** (the first level, `gowake/`, is the worked example):
  - Floors named in the plan's `risers` are kept as their own objects (`riser_<name>_marble`, `riser_<name>_rock`); the game moves them and their images in the water together.
  - A thing under still water is drawn and fades into the sea by its depth (`under_k`, the water at `clip_y`), so sunken stones show as pale shapes; the rest of the level is clipped at the water (`clip_k`).
  - A volute may be a winch that raises them: kind `winch`, `once: true` (it turns no more), `toggles.bridge` (the ways over the sunken stones are no ways until they are up).
  - The way's discs and lines over the sunken stones sink and rise with them (they are clipped at the water, so no way shows over the water until the stones are up).
  - Never `await a_tween.finished` after other waits: if it has already ended, the signal never comes again and the level hangs (the autoplay stopped after the winch). Guard it: `if t.is_running(): await t.finished`.
- **Her waking** (a level that opens on her): with the rig there is no lying clip, so she lies curled: the kneel clip held by `a_drop = 0.5`, the spine bent by `a_lean`, her palms laid on the stone (`palm_on`, `tgtL/tgtR`, `palm_nL/palm_nR`).
  - She stirs, pushes herself up (the palms lift late), looks out to sea and back (`yaw`), and rises with a halt halfway, unsure of her joints.
  - The eye starts close on her (`ivw_close` in `_ivr_cam`) and draws back to the whole level once she stands.
  - The painted sea must be held to the world (`world_uv` in the sea shader: the backdrop's place under the level's own eye), or a moving eye shows the painted sky on the water.
  - An image in the water dims toward the sea's own colour (`sea_c`): left at its default it dims toward blue and muddies a warm sea.
- **A hero prop from an image** (the Observer, a colossal veiled bust): paint it alone on a plain background, `tripo make <png> --for game-mobile` (it returns FBX), then decimate to about 7k triangles with flat faces and export GLB to `props/` (`fbx2glb.py`). Place it by its foot, height and turn, give it a palette of its own and haze, clip it at the water, and mirror it.
- **Rendering is slow** (about 1.5 s a frame at 720x1280 on the software renderer): iterate at 540x960; capture moments with your own snapshot hooks (`IVW_SNAPS`); skip the clean-frame wait (`IV_CLEAN`) when the line does not matter.
- **Corner overlays** (pine, leaves): have the image model paint them on flat magenta, then key them out.
  - The key is the magenta-ness, `min(R, B) − G`. Despill with the key's alpha, then fade with a separate mask, and fade out before anything the model bled in below.
  - Run `godot --headless --path . --import` before the game can `load()` a new PNG.

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
- **Flights**: one piece of marble each (the user: separate step blocks look like "separate pieces"; they want the stair whole), carved by hand and slightly uneven, the flight itself straight and square on the grid.
  - Each step a little higher or lower (±1 cm) and deeper or shallower (±1.6 cm), all still summing to the flight; each tread a few mm out of level; each nosing rounded its own way (bevel 0.016–0.03 m, 2 segments). The sides stay clean and continuous.
  - A channel cut down the middle (0.07 m wide, 0.03 m deep) through every nosing and riser: the profile shifted in and down by its depth. The way is drawn in it by the steps as cut (`flights[i][4]` and `stair_groove` in the level's JSON).
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

- **The mist is what lies behind.** Its colour at each point of the screen is the backdrop there (the sky above the horizon, the sea's own colour below it), so whatever goes into it is gone without an edge. Never let a far thing end on a line (the sea's edge, a box's bottom): the user sees "stones floating", "cut abruptly".
- **Far things**: rock that is solid under whatever stands on it (columns, a statue) and fades only further down (from about 40% of its height); never a box or a colonnade hanging in the haze. Compose them as the concept does (one great mass in the middle, a tall stack beside it, smaller ones, paler layers behind), not scattered.
- **A level at sea** (the eye has no perspective):
  - A sea without end would climb the whole screen. The sea is a sheet whose far edge is a straight line across the screen at the concept's horizon; the sky shows above it.
  - Far things stand just behind the level (in this eye "far" is only paler, never smaller), each set by its top in the concept and by where it has wholly gone into the mist; below that the sea lies in front of it, and no edge shows.
  - Mist is a band by height just over the water, not by depth under each floor; the sea's own colour lies between the haze far off and the mist below.
  - Nothing under the water is drawn. The surface lets a little through (alpha 0.7) over a deep floor of the same colours, and what stands in the water has its image there: a copy turned over about the sea level, shaded with its own faces' light, dimming as it goes down (`_ivs_mirror`).
  - A great thing in the water (the colossal face) is solid, with its own light and shade, a shadow and its image in the water; the user did not want it faded.
  - A sky with four stops (high, a warm band at the horizon, the haze under it, the mist at the bottom), and a low sun drawn on it.
- **A level in the snow at night** (`gomoon/`):
  - Snow is the top tone of everything outside, rock included.
  - Each floor's edge carries a soft roll of snow (`snow_lip` in the builder, scene `moon`), with its own palette: white, its shade a soft blue.
    - It stands a little proud of the top, rolls over the chamfer, and hangs lower here and there.
    - It dies away where a flight meets the floor.
  - Every warm tint must turn cool: the close corners' darkening (`ao_tint`), the marble's veins (`vein_tint`), and the cast shadow (`shade_tint`). A warm tint greys the snow.
  - The moon is a disc on the sky shader (`moon_k`, `moon_r`, at `sun`), with soft seas and a halo.
  - Far peaks are faceted pyramids (`_ivm_peak`), broader than high, their lit sides snow and their shaded sides blue. Each fades from about 40% of its height.
  - Fire on snow is never added: added light burns white on a bright ground.
    - The flame is an upright billboard (fixed Y) in `blend_mix`.
    - Its glow and its pool of light on the floor are drawn over the snow, golden.
  - Snow falls in two layers of `CPUParticles2D` on the overlay canvas: near flakes larger and slower, far ones small.
  - Value classes: the concept's are about 11/20/32/25/12. A first pass has too much mid (sky and mist), so darken the rock and the top of the sky and brighten the snow.

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

- **New things in the game's trial** (as `tools/go/trials.py` proves them; `goquarry/puzzle.json`):
  - Faces that look a way (`dirs`) rather than at a node, along the board's ways (`grid`: E, S, W, N in the world), over chasms (`gaps`).
  - Bronze mirrors (`mirrors`) turn a look a quarter, and a swipe into one turns it.
  - `faces_break`: a face that another face's look reaches breaks (`_ivg_settle`, after each move of hers).
  - A trial may have no stone (`block: ""`), and its dial may be a capstan.
  - A mirror at 45° is seen edge on by this eye in one of its two states, so a bronze bar on its floor shows the way it turns a look.

## 5. Review loop (before showing anything)

- Render a clean frame: `tools/ivory/render.sh <dir>` (`RES=1080x1920 TMO=1700` for a large one; `IV_DBG=4` shows how much mist each pixel has).
  - A 720×1280 frame takes 5–6 minutes on the software renderer, so use `TMO` 700 or more.
  - Run one Godot at a time: there are 4 cores.
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
