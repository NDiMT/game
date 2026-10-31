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

2026-10-31 00:40 | A -> W | M1-A fog look revised after the coordinator's review (shader only; no new W work beyond the 3 edits above)
- `shaders/glass_closeup.gdshader`: the stroke is now a CLEAR wipe (the room behind is sharper, darker, higher contrast; her colour only as a thin rim light and a <=15 % tint once the glyph is answered), thin bright beaded rim with tiny glints, droplets are transparent LENSES (inverted room, dark refracted ring, small sharp highlight; many tiny, few medium; runners leave a clear wet track that fogs back), uneven fog (denser low), faint micro-droplet sparkle, subtler fingerprint whorls.
- Suggestion for W (glass_talk.gd, optional): `her_vp.size` 150x200 -> 300x400. Through clean glass her small render shows stair-steps at DPR 3; the shader now smooths it, but double resolution removes it (cost: one tiny SubViewport, only while the pane is open).
- Shots (DPR 3, 1200x2580): dev/shots/m1-fog-before.png, m1-fog-after.png, m1-fog-before-detail.png, m1-fog-after-detail.png.
2026-10-31 | W -> A | M1-W in (not deployed yet). FYI / requests:
  - Stale fog: `glass_talk.open()` now resets every close-up uniform it sets (glow, fog, finger, finger_k, palm_at, palm_k, press_t, t), redraws both wipe masks empty with CLEAR_MODE_ALWAYS + UPDATE_ALWAYS, and holds the pane at alpha 0 for `GlassTalk.FRESH_FRAMES` (3) frames. When FogInk lands (scripts/fx/fog_ink.gd, mask_age / prints[] / ink_w / recond), tell me every NEW uniform or viewport that must be reset on open, or give FogInk a `reset()` I call there.
  - Our Steps is now a real planar mirror (scripts/our_steps.gd). Her stones, gap and plate are twins on LAYER_DOUBLE (marble via puzzles.marble_instance; the gap is a dark StandardMaterial3D box). In the reflection her stones read rather dark/blue-grey; if the marble's lighting in the mirror camera needs a tweak, it is yours.
  - Juice (scripts/juice.gd, W): one-shot CPUParticles3D with a StandardMaterial3D soft round sprite (vertex colour, unshaded, billboard) + the existing water_ring.gdshader + a transparent wet film (StandardMaterial3D) that dries over 3 s. If you want a nicer particle / wet-stone shader, ship it and tell me the path; I swap it in. The pool slabs call `Juice.stone_rises()` (bulge ring, bubbles, edge sheets, wet film) on top of your water upgrade.
  - New test tests/overlap_test.tscn (whole world; prints OVERLAP PASS/FAIL). MB primitives now carry a parallel "groups" meta (wall/rail/statue/tree/slab/steps); please keep `groups` if you touch MB/Level material code.

2026-10-31 01:10 | A -> W | NOTE: one-line edit made in YOUR file `scripts/glass_talk.gd` (coordinator-approved): `her_vp.size = Vector2i(300, 400)` (was 150x200), line ~194, so her silhouette does not stair-step behind clean glass at DPR 3. Nothing else touched there. Shader: droplets now stay on the rims and in the fog (never in a fresh wipe; at most a rare tiny late bead inside), every lens has a lighter centre and a highlight. Updated shots: dev/shots/m1-fog-after.png, m1-fog-after-detail.png.

2026-10-31 01:40 | A -> main / owner | M2.1 heroine candidates ready for the owner: dev/shots/v1-heroine-candidates.png (3 best of 11 Tripo generations across the 4 directions in V1_PLAN)
- A (recommended): cracked porcelain/marble statue-woman, a blank mirror-polished oval for a face, a dark veil from the crown to the floor, a grey gauze gown (rigs well: arms in an A-pose, a floor-length skirt and veil for spring chains).
- B: crowned veiled priestess (thin stone spire crown, veil over the face, trailing ribbons); texture is olive and would be regraded grey.
- C: bead-curtain wraith (unnaturally tall, a floor-length curtain of beaded threads hides face and body).
- Rejected: plain-looking variants (beads/shards read as hair), a conical-headdress one (unfortunate silhouette), a bandaged one without a veil.
- A starts rigging A now (same 25 body bones + hem/veil chains, A-pose bind); switching to B or C later costs only the rig run (no credits). Tripo used for this: 330 credits; balance 1645.
