# EIDOLON chapter 1 — how the chapter is built (notes for whoever adds a court)

The design is `eidolon-world/dev/CH1_FLOW_V4.md`. The engine is `main.gd` (do not restructure it). The chapter is
`ch1.gd`, which **extends** `main.gd` and owns the world (`_world`), the things to tap (`_things`), the walkable floor
(`_nav`), the hollows under pool courts (`_hollows`), and the acts (`_do_<name>`). Scene: `ch1.tscn`.

## The picture
- Orthographic camera, fixed: yaw 45°, pitch -35.264°. Screen right = +x -z, screen up = -x -z. Only faces toward
  **+x** and **+z** are seen. A wall of height h hides the floor behind it (to its -x / -z side) for h metres, so tall
  walls stand only on the NORTH (-z) and WEST (-x) edges of a court; south and east edges get `parapet(...)`.
- All floors are at y = 0 over a sea at y = -1.3 (`WATER`). Pools lie in the floor with their water at y ≈ 0.012.
- **A thing of height h over a water is seen in that water shifted by (+h, +h) in (x, z).** So a water must lie to
  the SOUTH and EAST of what it is meant to show, and extend at least h metres that way. She (1.72 m) and what she
  or her reflection uses stand at a water's north and west rims.
- Flat low-poly, palettes only: `pal("stone" | "shade" | "marble" | "gold" | "dark" | "wood" | "rope" | "crim" | ...)`,
  variants `pal(p, "flat")`, and `"flat2"` for a twin in the water. No textures. The world must not get darker or
  lighter than it is (`WORLD_DEPTH`).
- No floating icons over things. Every `objs[...]` entry carries `"mark": false`. What can be used is shown by its
  bronze/gold parts and by where it stands.
- **Smooth, nothing blinks**: nothing appears, vanishes or jumps in one frame. Use tweens (`create_tween()`, `tw()`),
  scale things in and out, turn bodies with a tween, move the camera with `cam_focus` + a tween on `cam.size`. No
  timers that the player must beat; every act can be done at any pace and nothing can fail.

## Pools and their mirror world
- `_pool_court(x0, z0, x1, z1, qx0, qz0, qx1, qz1, "stone", "PoolSkyN", open_n := false)` builds a court with a
  rectangular pool (q...) in it: the floor ring, the hollow base, and the pit in which the mirror world is seen. The
  pool must be at least 0.75 m inside the court on every side (0.4 on the north with `open_n`, when the pool lies at
  the foot of a north wall that is mirrored in it). Then `tile_hole = Rect2(...); tiles(...); tile_hole = Rect2()`,
  `glass(qx0, qz0, qx1, qz1)` for the surface, and add the court's hollow to `_hollows()`:
  `[x0 + 0.5, z0 + 0.5 (z0 - 0.1 with open_n), x1 - 0.5, z1 - 0.5]`. A court without a pool: `floor_plain(...)`.
- The mirror world is real geometry under `mroot` (a node flipped in y). Whatever must be seen in a water is built
  twice: `for both in [self, mroot]:` with helpers that take a parent (`blk`, `cyl`, `ball`, `turned`, `her_statue`,
  `prop_model(..., twin, ...)`, `winch`, `leaf`, `her_plinth`). Only the parts at y ≥ 0. Things that exist ONLY in
  the water are built under `mroot` alone. `_strip_refl(mroot)` at the end of `_world()` tints the twins.
- Under the water everything is paled by haze. A twin that must keep its colour (a wall, a grille, stones that
  exist only in the water) gets `under_mat(Color(...))` (unshaded, two-sided). `wall(x0, z0, x1, z1, h, true)`
  builds a wall and its twin that way.
- Anything that moves or is hidden later must be kept in the dictionary `N` (e.g. `N["g2"] = node`): the still world
  is joined into a few meshes at start and only nodes held in `N` (or other variables) stay separate. Removing a
  piece at build time: `remove_child(n); n.queue_free()` (a bare `queue_free()` is too late: it gets joined first).
  Check with `LIGHTEN=check ... -- act1 | grep "moved or hid"` → must say `0 of N`.

## Her reflection: a second body
- A tap on still water calls `_send_reflection`; a tap on a thing registered with `"water": id` sends it to that
  thing's `"rstand"` and then runs `_do_<name>()` with `refl_out` (its entity: `.holder` Node3D under `mroot`,
  `.ap` AnimationPlayer, `.sk` Skeleton3D; `_hermod(e)` gives the hand/bow controller).
- Each water is `W[id] = {"r": [x0, z0, x1, z1], "heads": [R(...), ...], "foot": {name: R(x0, z0, x1, z1, on, h)}}`
  and `WL.append(id)`. `foot` = where it can stand (mirrored floor she herself walks on, plus what exists only in
  the water), as rectangles that touch or overlap to connect; `on = false` closes one (a grille in the water).
  `heads` = floor from which it can be sent. Rules, all in `_refl_to`: it starts from under her feet; it goes as near
  to the tapped place as its footing lets it and, if short, shows it (`_refl_no`); it stays out while she walks; if
  it cannot get nearer from where it stands but could from under her feet, it melts back to her first
  (`_refl_melt`). A water with no footing at her feet: she looks down and shakes her head (`_her_no`).
- A tap on a thing means the nearest thing under the finger (`_tap_dist`). Give things in the water `"hits"` with
  their mirrored points (negative y), and real things real points.

## Things, looks, words
- `objs[name] = {"at": Vector3, "stand": Vector3 (where she stands), "mark": false, "hits": [points]}` (+ `"water"`,
  `"rstand"` for a thing her reflection uses). The act is `func _do_<name>() -> void` (awaited; `busy` is set
  around it). Set `done[name] = true` when it can no longer be used.
- `_look_add(key, foot, height, [line1, line2])`: a thing to look at (English, lower case, short). `stele(key, p,
  yaw, [his words, a sideways hint])`: one per court, his voice, capitalised sentences with `\n` line breaks.
  `say("...")` a small line; `quote(key, text, hold, true)` a big one.
- The pocket: `_pocket_add("crank")`, `_pocket_take("crank")`, at most three, each thing used once (icons exist
  for "crank" and "key": add one in `class Pocket` of main.gd if you carry something else).

## Walking
- `rects[name] = R(x0, z0, x1, z1, on)`: walkable floor as rectangles that overlap or touch to connect (0.1 m of
  shared edge at least). Keep 0.45 m from parapets and pool kerbs, 0.3 from walls. `solids.append(Vector3(x, z,
  radius))` for things she walks round. Open a way with `rects[name].on = true`.
- Floors that are not level: `ramps.append({"r": rects[..], "z0":, "z1":, "y0":, "y1":})` (see the Gate's stair).
- In an act: `await walk(p)` (by the floor's own ways), `await go([p], speed)` (straight, ignores the floor: onto a
  plinth), `await face(p)`, `await wait(s)`, hands: `tgtL`/`tgtR` (world points) with weights `a_wL`/`a_wR`, body
  `a_lean`, head `a_headp`, `a_hy`; `posing = true` holds her still as a statue; `tw()` is a parallel sine tween.

## Ready-made pieces (ch1.gd)
`sluice(key, c, along_x, half, h)` + `await sluice_open(key)`; `leaf(key, c, along_x, half, h, parent, twin)`;
`channel(a, b)`; `winch(at, yaw, parent, twin)` + `_refl_wheel(id, water, focus, size, opens)`; `_crank_pts(...)`;
`her_plinth(p, yaw, pose, parent)` (poses of `her_statue`: "calm", "pray", "mourn", "kneel", "point", "pointl",
"point2"); `drape(c, w, h, pleats, material)`; `wall(...)`; `floor_plain(...)`; `under_mat(color)`; `glass(...)`.
From main.gd: `blk`, `cyl`, `ball`, `turned` (a lathe), `prim`, `cornice`, `parapet`, `tiles`, `urn`, `cypress`,
`tree`, `rock`, `reeds`, `stele`, `prop_model`, `thing`, `_gear`, `_crank_handle`, `arch_band` + `bb_end`.
The seven shader lights are all taken (`lantern(p, i)` uses one each): new lamps are a stand with a `halo(...)`.

## Trying things
- Parse: `timeout 60 /opt/godot/godot --headless --path . --check-only -s ch1.gd 2>&1 | grep -A2 -E "Parse Error|SCRIPT ERROR"` (nothing = good).
- Stills: `SHOT_DIR=<existing dir> VIEWS="name,cx,cz,size[,px,pz,yaw];..." timeout 1500 xvfb-run -a /opt/godot/godot --path . --rendering-driver opengl3 --resolution 720x1280 res://ch1.tscn -- views`
  (cx, cz: the ground point in the middle; size: metres across; px, pz, yaw: where she stands and faces).
- By taps, without a screen: `HAND=1 [FROM=T|V|F|G|U] timeout 900 /opt/godot/godot --headless --path . --fixed-fps 30 --quit-after 16000 res://ch1.tscn -- act1 | grep ACT1`
  (`_play_act1` taps as a player would, with `await _tap_wait(point)`, and prints each step; `_open_to` starts at a
  later court with everything before it done). Add your own run in the same manner.
- Video: add `--write-movie out.avi --quit-after N` to the stills command line with `-- act1`; about 2-2.5 frames
  a second; encode `ffmpeg -c:v libx264 -pix_fmt yuv420p -crf 24 -an`, then delete the .avi. Look at frames.

## Added after the owner's feedback ("not rooms; one place; more like an open world")
- **The island.** `_island()` (called at the end of `_world()`) lays land round every floor that exists by then: level
  with the floors to the north and west (meadow, low hills, cypresses), a sea wall over a low rock shelf to the south
  and east, an inlet under every floor narrower than 2.6 m (a bridge). A narrow floor that is a path over land goes
  into `land_paths` (as `[x0, z0, x1, z1]`) so that no inlet is cut under it. No hill stands between the eye and a
  floor. You need do nothing for it; do not build your own sea-level surroundings.
- **Walls.** `wall(...)` dresses itself (pilasters, sunk panels, string course, dentils, coping, a pier at each end).
  Use a wall only where a puzzle needs one. Otherwise: `stoa(x0, z0, x1, z1, h := 2.5)`, an open row of columns on a
  balustrade under an architrave; `parapet(a, b)`; or nothing, where the land runs on. Walls and stoas of
  neighbouring places should meet at shared corners. A place may be larger than the screen.
- **Places off the way.** `_temple()` is the model: a path (`floor_plain`, listed in `land_paths`), a court, things to
  look at, a stele; walkable rects in `_nav()`; nothing there is needed for the way on.
- **Waters at a level of their own** (in ch1.gd): `_cs_water(key, x0, z0, x1, z1, level, round := false)` returns the
  root its mirror world hangs under (twins go under it, coloured with `_cs_umat(key, Color)`), registers her mirrored
  body `"mir_" + key` (name it in `W[id].mir`); `_cs_level(key, to, secs)`; `_veil_glass(color)` is a surface that can
  lie as a film (uniforms `veil`, `alpha`) before it shows anything; `cs_courts.append([x0, z0, x1, z1])` for the
  court it lies in.
- **Her reflection.** A tap on a water names the place whose image lies under the finger (what stands h over the
  water is seen h to the south-east of itself); footing rects carry their height (`R(..., on, h)`), connect when
  their heights differ by less than 0.3, and a way is walked as far as it is open (it stops at the first shut rect,
  and shows that it cannot go on). `W[id].far` = how far she may go from that water before her reflection is called
  back (default 3.2).
- **The atrium's water.** `_wing_done(id)` only records; when she is next in the atrium the water runs down that
  wing's channel (`chan_run`) and the basin takes it (`_hub_fill`). `HUB=1|2|3` (environment) starts with so many
  waters in; runs: `-- hub`, `-- gate`.
- **Gate slots.** `sluice(key, c, along_x, ...)`: `along_x` = the WAY through it runs along x (its leaf lies along z).

## The house stands in the sea (latest)

The island and the closing walls were tried and taken out again: the courts are terraces in the sea, edged with
balustrades, as in the first demo.

- `_island()` returns at once unless `LAND=1` is set: no ground, no trees. A court's podium, its arcade and the sea
  are what is seen round it.
- `wall(...)` draws a balustrade along the wall's line unless `WALLS=1` is set. A wall that is part of a building or
  of a puzzle is kept by setting `wall_keep = true` round the call (the Gate's own wall in the atrium, whose
  reflection has a breach the wall has not; the front of the spring house). Walls built directly with `blk` for a
  puzzle (the wall with the arch in court F) are not touched.
- Two parts must not be built on the same ground: before adding a court, list the floors that exist
  (`floors`), or render the `whole` view. (The Spring's second court and the shrine's round room once overlapped.)
