# HANDOFF log (append-only)

Format: `YYYY-MM-DD HH:MM | FROM -> TO | what is ready / what is needed | paths`


2026-10-30 23:59 | A -> W | M1-A ready: finger-on-fog writing + water upgrade (shaders done; 3 small glass_talk.gd edits + WaterFX hookups needed from W)
- FOG WRITING (realistic human finger on condensation)
  - New A-owned rendering helper `scripts/fx/fog_ink.gd` (class FogInk extends GlassTalk.Ink, drop-in). Shader `shaders/glass_closeup.gdshader` upgraded (A).
  - What it does: her strokes get a human speed profile (accelerate out of the start, slow into curves/corners, ease off, wobble; GlassTalk's time tween is remapped to arc length); width follows pressure (landing pad, uneven press, lift-off taper; your strokes thin when fast); soft cross-section (clean centre, thin film, ragged beaded rim); an AGE mask (own SubViewport inside FogInk, pushed to the pane as `mask_age`) drives beads that gather on the rims and swell, drops that grow and some run down (stick-slip) leaving clear streaks that re-fog, and slow re-condensation of old strokes; a fingerprint whorl in each stroke's landing pad (`prints`); finger drag lines along the stroke. Her hand tracks the REAL writing tip (FogInk pushes the corrected `finger` uniform).
  - W, in `scripts/glass_talk.gd` please:
    1. `ink = Ink.new()` -> `ink = FogInk.new()` and `var im := Ink.new()` -> `var im := FogInk.new()` (nothing else changes; keep Ink's field names: her, mine, hint, finger, finger_k, palm, palm_k, width, only_mine, twin, host, _poly, _dots; and GlassTalk._t, glass_mat, MASK, which FogInk reads).
    2. In `open()` (and anywhere you reset for the stale-fog fix M1-W1), right after `ink.her.clear(); ink.mine.clear(); ink.hint.clear()` call `if ink is FogInk: (ink as FogInk).reset_state()` (clears stroke records, prints and forces one age-mask redraw). Keep the pane hidden until the first clean render, as planned.
    3. LOW tier: `glass_mat.set_shader_parameter("drops_q", 0.0)` (no running drops; beads stay). Optional tuning: `recond` (0..1, default 0.55: how far old strokes fog over).
    (Optional) `ink.tip(idx, v)` gives her fingertip on stroke idx at time fraction v, if you want it for sounds/particles.
  - Test: `godot --path . res://dev_fx/fog_test.tscn` (draw with the mouse), stills: `-- --shots=/abs/dir --ink=new|old`.
  - Shots: dev/shots/m1-fog-before.png, dev/shots/m1-fog-after.png, dev/shots/m1-fog-after-detail.png (t = 2.4 / 4.6 / 8.5 / 15 / 23 / 25 / 28 s).
- WATER (supports the rising-slab juice)
  - `shaders/water.gdshader` (normal-mapped ripples, fresnel sky sheen, depth darkening: pale shallows / deep middle / dark line under the rim, soft broken shoreline foam, sun glitter) and `shaders/water_over.gdshader` (lit crests / dark troughs) both include the new `shaders/water_fx.gdshaderinc` (splash and rising-body events: rings, bulge, white-water collar, chop). New uniforms all have defaults; disc pools still work.
  - New A-owned helper `scripts/fx/water_fx.gd` (class WaterFX extends Node): one per body of water.
        var fx := WaterFX.new(); fx.mats = [water_mat, water_over_mat]; add_child(fx)
        fx.rise(Rect2(x0, z0, w, d), 2.4)          # as a slab breaks the surface (foam collar, sheeting band, rings off its edges)
        fx.splash(Vector3(x, y, z), 1.0)           # drops, steps in shallow water, things falling in
        fx.wet_dry(slab_mesh_instance, 3.0, Ch1Geo.WATER_Y)   # wet, sheeting down its sides, dries in patches over ~3 s
    It pushes uniforms only while something is alive.
  - `marble.gdshaderinc` now has `instance uniform float wet` and `wet_line` (per instance; 0 = dry, no cost at rest). wet_dry() drives them; you can also set_instance_shader_parameter("wet", 1.0) yourself (e.g. just before the slab breaks the surface) and let wet_dry tween it down.
  - W: hook WaterFX into puzzles._pool (water_mat + water_over_mat), the Our Steps pool and the shrine pool (chapter.gd), and call rise/splash/wet_dry from the slab juice. The pool_stones (reflection) shader is unchanged.
  - Test: `dev_fx/water_test.tscn` (game camera and sun): stills `-- --shots=/abs/dir --water=new|old --old=<dir with the v0.9.4 water shaders>`. Shot: dev/shots/m1-water-before-after.png (top v0.9.4 water, bottom v1.0; the wet slab uses the new marble in both rows).
- Tripo: no credits used in M1-A.
