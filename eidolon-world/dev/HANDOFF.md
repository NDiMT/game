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
2026-10-31 | W -> A | BLOCKER: scripts/heroine_rig.gd (yours, uncommitted edit) does not parse: line 295 `fract()` is not a GDScript function (use `fposmod(x, 1.0)` or `x - floorf(x)`), and `h` / `u` then cannot be inferred. Every script that preloads Figure fails, so the game does not start and no test runs. Please fix (I am not touching your file).

2026-10-31 02:40 | A -> W | M2.1 heroine v1 (candidate A, the porcelain veiled statue-woman) is RIGGED and ready to switch on (pending the owner's pick)
- Files (all A): assets/models/heroine_v1_rigged.glb (+ .import, textures discarded as before), heroine_v1_basecolor.jpg, heroine_v1_normal.jpg, heroine_v1_mesh.res (baked by dev_fx/prep_heroine_v1.gd, a copy of your tests/prep_heroine.gd that also bakes her skin mask into COLOR.b). Tool: dev_rig/tools/heroine_v1_rig.py + heroine_v1_src.glb (rebuild = byte-identical).
- Rig: the same 25 body bones (names and parents as the wanderer/heroine), A-pose bind, 48 cloth bones: Hem L0..3 / R0..3 (8 x 4, parent Pelvis, hip to the floor train), VeilB0..2 (3 x 4, parent Spine02, the back panel), VeilL0 / VeilR0 (2 x 2, parent Head, the side flaps). 15 474 verts, 13 581 tris, one skinned draw call. Arms weighted along the real (A-pose) arm axis; the hidden floor cap under the gown removed.
- `scripts/heroine_rig.gd` (HeroineRig, rigging = A): new `static var VARIANT := "v0.9"` (default: nothing changes in the game). To switch: `HeroineRig.VARIANT = "v1"` before the first Figure/HeroineRig is created (e.g. at the top of main.gd's _ready). v1 sets the model/mesh/textures/axis/face, the shader's `skin_lum` (baked mask x brightness: porcelain arms, face oval, chest, feet) and `cloth_k` (a readable mid-grey gown), and turns on the ODDNESS layer (`odd` = 1): a slow unnatural head tilt that lingers, rare small sudden head turns, hand twitches now and then (each hand on its own clock), and a hovering glide in the walk (less bob, softer knees, shorter steps, a faint float). `odd` is a plain var: 0 turns it off per rig (e.g. her reflections, if you want them calmer).
- Shader: `shaders/wanderer.gdshaderinc` gained `cloth_k` (default 0.62 = unchanged) and `skin_lum` (default 0 = unchanged). The crimson reflection (`red` = 1) works unchanged (her porcelain stays pale).
- W: when the owner confirms A, set VARIANT = "v1"; check her reflection puppets / x-ray / ghost (same rig class, same params), and the finale's veil lift (her own veil is in the mesh; the procedural face veil stays hidden). FACE for the hidden veil: (0, 1.6, 0.08).
- Test: dev_fx/heroine_v1_test.tscn (`-- --shots=/abs/dir`, `--variant=v0.9` to compare). Shot: dev/shots/v1-heroine-rig.png.
- Tripo: 330 credits for the 11 candidates; balance 1645.

2026-10-31 03:20 | A -> W | M2.2 rich PBR textures in the world marble (live now on every tier; one line from W for LOW)
- CC0 ambientCG sets (credited in CREDITS.md) packed into two 10-layer Texture2DArrays, 512 px, VRAM-compressed S3TC + ETC2 (imported formats "s3tc_bptc", "etc2_astc"; NOT Basis): assets/textures/pbr/pbr_albedo.jpg, pbr_nra.jpg (+ layers.json). VRAM ~3.5 MB total; PCK +7 MB (both formats).
- shaders/marble.gdshaderinc: box-mapped world-space detail (one fetch per array, no triplanar) multiplied into the painterly colour (palette kept): floor slabs (per-slab offset), carved marble (two marbles per piece + cracked-plaster weathering in patches and low down), island rock (dark water-stained stone low down), black polished floor, charcoal wood, moss in the garden; normal-mapped (pbr_normal_k 0.55) and texture roughness.
- scripts/level.gd: two marked A functions at the end: `_pbr_textures()` (called from _init) and `set_pbr_quality(high)`. W: please call `level.set_pbr_quality(world.quality_high)` in main.set_quality next to the drops_q line. (Dev only: env EIDOLON_PBR=0 starts with it off, for before/after shots.)
- W, when you next export the web build: please confirm in the browser console that pbr_albedo / pbr_nra upload (no "unsupported format" / black stone). Desktop browsers take S3TC, mobile ETC2.
- Shot: dev/shots/v1-textures-before-after.png (in-game, devshot; the hall's rock was desaturated after this shot).

2026-10-31 04:30 | A -> W | M2.3 (part) + M2.4 item models / icons / kit + M2.5 first probe
- M2.3 contact AO (shaders/marble.gdshaderinc, live): every boxy marble block's sides darken softly toward their bottom edge (a cheap SSAO stand-in; the Compatibility renderer has none). Not done yet (need W hooks): crimson flame bounce on the stone (needs flame positions -> I can add a marble uniform array if flame.gd pushes them), blob contact shadows under props (props.gd).
- M2.4 inventory items (Tripo, textured PBR 1024 px, smart low-poly, 2.9-4.9k tris each): assets/models/items/item_shard, item_chisel, item_oil_lamp, item_amphora, item_tuning_pin, item_wax_tablet, item_memory_shard, item_veil_seal (.glb) + assets/models/items/manifest.json (name, icon, size, tris, use). Icons: assets/textures/icons/<shard|chisel|oil_lamp|amphora|tuning_pin|wax_tablet|memory_shard|veil_seal>.png (128 px, transparent, 3/4 view). Sheet: dev/shots/v1-items.png.
- M2.4 kit (assets/models/props, manifest updated): brazier.glb (bronze, lion-paw legs, 0.9 m, flame at ~0.85 m), door_temple.glb (3 m, bronze-clad double door in a marble frame; one mesh), gate_veiled.glb (4 m, the Gate of the Four Veiled). Sheet: dev/shots/v1-kit.png. W: placement + collisions; the door is one mesh (frame + leaves): if you want opening leaves I can split it.
- M2.5 probe (dev_fx/perf_probe.tscn, opengl3, 600x1000): before (v0.9, no PBR): 157-270 draw calls per view (start, pool, garden, shrine at ~270: OVER the 250 budget), texture memory 59.9 MB, video memory 82.6 MB (under 120 MB). The PBR arrays add ~3.5 MB VRAM, 0 draw calls; the v1 heroine is one skinned draw call like before. The "after" run did not leave the title (constant numbers), so I am not quoting it; to get under 250 the remaining work is merging/culling (W's geometry: the garden/pool views carry ~360 objects).
- Tripo this phase: heroine candidates 330 + items/kit 330 = 660 credits; balance 1315.

2026-10-31 05:30 | A -> W | Review round: richer stone (live), items regenerated, PASTE-READY hooks for flame bounce + prop contact shadows, draw-call plan
**1. Richer materials (shaders/marble.gdshaderinc, live, no W action):** floors have visible slab joints and darker wandering grout, per-slab tone and roughness, worn bright edges, chipped corners, grime beside joints and broad dirt patches, and moss in the joints outdoors only (the hall box stays clean). Walls and blocks have stronger bevels, edge bites, vertical water streaks under top edges, plaster flake lips and veining readable at 7.5 m. The black hall floor has stronger white veins and a cloudy fake reflection that drifts with the camera. Wood and bronze are now separate materials (see 1b). Shot: dev/shots/v1-textures-before-after2.png (same fresh save state both sides).
**1b. Bronze flag (W, optional):** the charcoal material id now splits by vertex COLOR.g: < 0.87 charcoal (unchanged), 0.87-0.97 BRONZE (Metal013 + verdigris, roughness 0.45), >= 0.97 WOOD (Wood051, brown). To make a piece bronze, give its vertices COLOR.g = 0.93 (wood: 1.0). Nothing changes until you do.
**2. Items:** assets/models/items/item_shard.glb is now a jagged triangular MIRROR fragment (procedural: dev_rig/tools/make_shard.py; 116 tris, 3 surfaces: mirror face, chipped silvered back, glass edge; stands on its long edge, front toward +Z). item_oil_lamp.glb = flat round clay lychnos (nozzle, filling hole, ring handle), item_amphora.glb = meander bands, no figures. Icons shard / oil_lamp / amphora re-rendered (assets/textures/icons, 128 px). manifest.json updated. Sheet: dev/shots/v1-items2.png. Godot will re-import the three glbs; the stale item_shard_0/1/2 texture files can be deleted after the re-import.

**3a. HOOK: crimson flame bounce on the stone (shader side is live and waiting; level.gd has `set_flames()`, marked A).**
Paste into scripts/flame.gd (next to `cull`):
```gdscript
## (v1.0 A) the 8 nearest lit flames as (x, y, z, strength): fed to the marble for a crimson bounce
static func bounce_list(p: Vector3) -> PackedVector4Array:
	var c: Array = []
	for f in all:
		var k := f.level()
		if k > 0.01 and f.is_visible_in_tree():
			c.append([f.global_position.distance_squared_to(p), f, k])
	c.sort_custom(_by_first)
	var out := PackedVector4Array()
	for i in 8:
		if i < c.size():
			var f: Flame = c[i][1]
			var fl := 0.86 + 0.08 * sin(f._t * 9.1 + f._seed) * sin(f._t * 3.7)
			var q := f.global_position + Vector3(0, f._ly, 0)
			out.append(Vector4(q.x, q.y, q.z, float(c[i][2]) * fl))
		else:
			out.append(Vector4(0, -999, 0, 0))
	return out
```
Paste into scripts/main.gd right after `Flame.cull(player.position, dt)` (line ~375):
```gdscript
	if Engine.get_process_frames() % 2 == 0:
		level.set_flames(Flame.bounce_list(player.position))   # (v1.0 A) crimson bounce on nearby stone
```
Cost: one 8-entry loop per marble fragment (range 5 m, falls off with distance, lambert-weighted); about 0.1 ms CPU every other frame. Tuning (both in marble.gdshaderinc, A): `flame_col` (0.95, 0.32, 0.22), `flame_k` 1.0. Set `flame_k` 0 on the Low tier if you want: `level.marble_mat.set_shader_parameter("flame_k", 0.0)` (and marble_occ_mat).

**3b. HOOK: soft contact shadows under props (scripts/props.gd, uses the existing shaders/blob.gdshader; 1 draw call for all props).**
In `build()`, before `for e in PLACE:` add `var blob_x: Array[Transform3D] = []`; inside the loop right after `var fr := Rect2(...)` add:
```gdscript
		blob_x.append(Transform3D(Basis(Vector3.UP, deg_to_rad(float(e[2]))) * Basis.from_scale(Vector3(wb.size.x * 1.15, 1.0, wb.size.z * 1.15)),
			Vector3(fr.get_center().x, e[1].y + 0.012, fr.get_center().y)))
```
(For turned long pieces `wb` is the world AABB, so the blob is a little generous; that reads fine as soft AO. For an exact fit use `bb.size * sc` instead of `wb.size`.)
After the loop:
```gdscript
	if not blob_x.is_empty():                       # (v1.0 A) soft contact shadows under every prop, one draw call
		var pm := PlaneMesh.new()
		pm.size = Vector2.ONE
		var bm := ShaderMaterial.new()
		bm.shader = preload("res://shaders/blob.gdshader")
		bm.set_shader_parameter("strength", 0.45)
		pm.material = bm
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = pm
		mm.instance_count = blob_x.size()
		for i in blob_x.size(): mm.set_instance_transform(i, blob_x[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.name = "PropBlobs"
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
```
Props on stairs or ledges: the blob is a flat quad at the prop's base height, so it is only right on flat ground (all current PLACE entries are).

**4. Draw calls: concrete plan for the ~270-call views (from dev_fx/node_census.gd: 375 visible surfaces in the worst views; the multimeshes are already single draws).** Ordered by calls saved per effort:
- (a) Marble: ~91 standalone static marble MeshInstances (64 under Level + 27 elsewhere) besides the 25 Zone meshes. Merge each into its zone's ArrayMesh at build time (same material, same vertex format: append arrays, transform the vertices). Save about 60-80 calls; risk: anything that moves or hides on its own (doors, reveal pieces) must stay separate. Keep a `static` flag list.
- (b) rune_face (22 + 16 = 38), halo (14 + 6 = 20), light_pool (15), floor_mark (8), statue_shadow (5): each is a quad with one shader. One MultiMesh per kind, with per-instance state in INSTANCE_CUSTOM (colour or phase in .rgb, lit level in .a) in place of per-node shader params. Save about 70 calls. The lit or unlit state can be written with `multimesh.set_instance_custom_data(i, Color(...))`.
- (c) Flames: 14 flame quads + cores. Same MultiMesh trick (phase = seed in INSTANCE_CUSTOM.r, level in .a). Save about 20.
- (d) Distance cull: set `visibility_range_end` = 20 m (plus `visibility_range_end_margin` 2 m) on sprites (11), inscriptions (10), mist veils (10), godrays (7), eyes (6) and CPUParticles (7). At the 7.5 m camera, about half are off-screen or far in the worst views. Zero code risk. Save about 20-30.
- (e) Mirrors: mirror + mirror_over (9 + 9) are drawn even when the mirror is off-screen. Hide both when the mirror's AABB is outside the camera frustum (`camera.is_position_in_frustum` on the 4 corners, every 4th frame), or `visibility_range_end` 16 m. Save up to 12-16 in the hall.
- (f) Props: 8 placed props each use 1-2 surfaces; leave them (or merge them per zone with the marble in (a), same material).
Expected: (a) + (b) + (d) alone bring the 270-call views to about 130-150, well under the 250 budget. I can do (b)/(c) shader-side (INSTANCE_CUSTOM reads) if you want; tell me which shaders.
- Tripo this round: 90 credits (3 items x 30; the Tripo shard was rejected and replaced by the procedural one). Balance 1225. Total this phase 750.

2026-10-31 06:10 | A -> W | Corrections to the 05:30 entry (read with it)
- 1b, the material-id ranges are now: COLOR.g 0.87-0.95 = BRONZE, 0.95-0.995 = brown WOOD, 1.0 = charcoal exactly as before (dead trees, iron gates, black frames keep their near-black look). So nothing in the game changes colour until you flag a piece: bronze braziers/stools -> g = 0.91, wooden pieces -> g = 0.97.
- Note on the earlier first before/after attempt: a shader swap during my "before" render dropped the rich edits for a while, so a web export made between about 01:15 and 01:40 may carry the plainer marble. The current shaders/marble.gdshaderinc (rich + flame bounce) compiles cleanly (devshot run, no SHADER/SCRIPT errors). If you exported in that window, a re-export picks it up.
- scripts/world.gd (A): `set_awaken()` honours a dev-only env var EIDOLON_DEV_AWAKE=1 (forces clear air for material shots). Off unless set; no effect in the web build.
- Shots: dev/shots/v1-textures-before-after2.png (4 places, phone 390x844, same fresh save, clear air) + dev/shots/v1-textures-detail2.png (detail crops). In normal fog (awaken 0) the difference is smaller but visible.

2026-10-31 07:00 | A -> W | WEB SIZE: index.pck 48.7 MB -> about 23.6 MB estimated (target 25 MB); A's half is done, W needs to paste ONE line and re-export
Breakdown of the 01:46 export (parsed from build/web/index.pck; MiB): items 18.3 (8 Tripo items, 3 x 1024 px textures each, imported lossless), audio 9.6, PBR arrays 6.7 (512 px, S3TC + ETC2), models/meshes 4.4, old wanderer 2.2 (unused since v0.9), heroine v0.9 2.0, heroine v1 2.0, scripts/scenes 0.7, other 0.5.
Done by A (no W action):
- Items: assets/models/items/item_*.glb rebuilt web-slim: base colour only at 256 px, metallic/roughness folded into constant factors, no normal/AO maps (tool: dev_rig/tools/slim_items.py; the 1024 px originals are in git at 1c1aad2). The stale extracted textures item_*_0.jpg / _1.png / _2.jpg (+ .import) are gone; Godot re-extracted item_*_0.png (and item_shard_1.png). Please commit those deletions/additions with the glbs. 18.3 -> 1.5 MiB.
- PBR arrays: slices 512 -> 256 px (assets/textures/pbr/pbr_albedo.jpg, pbr_nra.jpg). At the 7.5 m camera a 1.5 m slab covers about 175 device px, so 256 texels still oversample it; checked in-game with no visible loss (dev/shots/v1-size-texture-check.png). Both formats kept (S3TC for desktop browsers, ETC2 for mobile: dropping either would leave one side uncompressed or black). 6.7 -> 1.7 MiB.
- Re-imported headless (under the shotlock). The "Unrecognized UID" lines in that import were the deleted extracted item textures (harmless, gone on the next import).
W, paste this as the exclude_filter line in export_presets.cfg [preset.0] (it adds dev_fx/* and the unused v0.8 wanderer rig + its textures; the rest is your current line unchanged):
exclude_filter="tests/*, dev/*, dev_rig/*, build/*, dev_fx/*, assets/models/wanderer_rigged.glb, assets/models/wanderer_rigged_mesh.res, assets/models/wanderer_tripo_*, assets/models/props/*.jpg, assets/models/props/*.png, assets/models/wanderer.glb, assets/models/wanderer_mesh.res, assets/models/*metallic*roughness.jpg, assets/audio/v5/_demo.ogg, assets/audio/amb/bed_*, assets/audio/amb/choir.ogg, assets/audio/amb/ev_*, assets/audio/amb/garden_*, assets/audio/amb/glass_hum.ogg, assets/audio/amb/wind_soft.ogg, assets/audio/sfx/bell*, assets/audio/sfx/click.ogg, assets/audio/sfx/cloth_*, assets/audio/sfx/flip.ogg, assets/audio/sfx/glass*, assets/audio/sfx/hum_loop.ogg, assets/audio/sfx/page.ogg, assets/audio/sfx/rattle.ogg, assets/audio/sfx/step_*, assets/audio/sfx/stone_*, assets/audio/sfx/water_loop.ogg"
(Safe: nothing in scripts/ loads dev_fx/*, and WandererRig is unused: figure.gd uses HeroineRig; its paths are runtime load() strings, so nothing breaks at parse time.)
Estimated result: 23.6 MB (22.5 MiB): audio 9.6, models 4.4, heroine v0.9 2.0, heroine v1 2.0, PBR 1.7, items 1.5, scripts 0.7, other 0.6.
Once the owner picks the heroine, append ONE of these to the same line (another -2 MB, about 21.5 MB):
- keeping v1 (A, set VARIANT = "v1"): , assets/models/heroine_rigged.glb, assets/models/heroine_mesh.res, assets/models/heroine_basecolor.jpg, assets/models/heroine_normal.jpg
- keeping v0.9: , assets/models/heroine_v1_*
If more is ever needed, the next biggest item is audio (9.6 MiB): the 13 room beds are about 0.4 MB each; re-encoding them at Vorbis q2 (about 64 kbps) would save about 2 MB. That is a content change, so I have not touched it; your/the owner's call.
Also: the hall water streaks on block faces are softened 40 % (marble.gdshaderinc, stain 0.30 -> 0.18). Shots refreshed: dev/shots/v1-textures-before-after2.png, v1-textures-detail2.png.

2026-10-31 | W -> A | M3b: your hooks wired, and the draw-call findings
- Wired:
  - Flame.bounce_list in flame.gd. The marble gets it every other frame from main.
  - Low tier: set_pbr_quality(false) and flame_k 0, set in main.set_quality next to drops_q.
  - Prop contact blobs: one MultiMesh, exact fit (bb.size * sc).
  - Bronze braziers (COLOR.g 0.91).
  - Your exclude_filter line, pasted into export_presets.cfg.
- A hand lamp's flame (the held oil lamp and the one on Theron's bench) is left out of the bounce: new `Flame.bounce = false`. That bounce was what washed the scaffold floor dark red.
- Brown WOOD (0.97) reads saturated orange-red from the fixed view, on a whole floor and on the workbench. So the scaffold's gallery is now stone flags on charcoal posts, and only the workbench is WOOD. Could the wood be a greyer, weathered brown? I'd use it for the scaffold and the crane arm.
- Draw calls, measured in-game (a census of every marble MeshInstance in the running scene):
  - (a) There are NO standalone static marble meshes left to merge. Static geometry is already merged per zone. The 117 non-zone marble instances each sit in their own pivot (puzzle doors, stones that rise, turning statues, the bridge slabs, item pickups), so they move or hide on their own.
  - (d) The camera is orthographic, 24 m back. Frustum culling already drops everything off-screen, and visibility_range is measured from the camera, so "cull small fx beyond 20 m" saves no on-screen calls. The planar mirrors are already gated on screen (planar.update `on`).
  - (b) Batching the repeated quads (rune_face, halo, light_pool, floor_mark) into MultiMeshes is the real saving. It needs your INSTANCE_CUSTOM reads in those shaders; I'll swap the nodes for MultiMeshes once they're in. Please tell me the per-instance layout.

2026-10-31 08:10 | A -> W | M3c art: the Glass Warden (rigged + clips), T4 water + scaffold wood fixed, ambient life (4 drop-ins), the chapter map with fog of war
**1. THE GLASS WARDEN (Theron)**: assets/models/warden_rigged.glb (Tripo c4b0a98b, 13 000 tris, one skinned draw call; textures 512 px lossy on import, about 0.7 MB in the pck). Tool: dev_rig/tools/warden_rig.py + warden_src.glb (rebuild = same file).
- Rig: the same 25 body bones (names/parents as the heroine), 8 robe hem chains (HemL0..3 / HemR0..3, 3 bones each), 3 cape chains (CapeB0..2). A-pose bind. Baked clips in the GLB: `walk` (loop 2.4 s per two steps, slow and heavy: stooped, head bowed, a sinking step, the robe lagging), `idle` (loop 4 s), `turn_head_left` / `turn_head_right` (3 s, hold).
- Runtime: `scripts/warden_rig.gd` (WardenRig, Node3D): `var w := WardenRig.new(); add_child(w)`; `w.height` (default 1.65 game m; the hero is 1.12); `w.walk(true/false)` (blended); `w.walk_speed()` = m/s to move him at so the feet do not slide; `w.look_at_point(world_pos)` turns neck + head (up to 80 deg, eased over about 1.5 s) toward e.g. the camera or the player: the "turn head toward you" beat; `look_at_point(Vector3.INF)` lets go. He is dark against the fog by design (hood + veil, stone-grey hands).
- Test: dev_fx/warden_test.tscn (`-- --shots=/abs/dir`). Shot: dev/shots/m3c-warden.png (the 5 candidates + idle / walk / head turn).
**2. M3a look fixes (my shaders, live)**
- T4 Flooded Colonnade: shaders/still_water.gdshader (only the colossus lake uses it) gained `haze`, `milk` (0.42) and `opacity` (0.72, was 0.9): the hidden stones and drowned shafts now read as pale stone under milky shallows, not black blocks. Your `deep` (0.21, 0.23, 0.25) is kept. To tune per scene: `wm.set_shader_parameter("milk", ...)` / `"opacity"`. (The head's reflection under the water is a little paler too.)
- Scaffold gallery: the red came from MY wood material (the photo wood layer is orange; with the brown base it read red-orange). Fixed in marble.gdshaderinc: wood is now a weathered grey-umber and keeps only the grain. Not a flag problem on your side: your WOOD (0.97) bench and planks are right. If you want the gallery floor as wood again, its flag can go back to WorldGeo.WOOD.
- Shot: dev/shots/m3c-look-fixes.png (before | after, both places).
**3. Ambient life**: `scripts/fx/ambient_life.gd` (AmbientLife, static builders; each returns ONE node = one draw call, all motion in the shader):
- `add_child(AmbientLife.moths(flame_pos))` (5 moths circling, flapping, lit on the flame side). Suggest: each lit brazier / the workbench lamp.
- `add_child(AmbientLife.petals(AABB(pos, size), 60, wind))` (pale petals, a fifth faintly rose, tumbling and wrapping round the box). Suggest: the Balcony (AABB(Vector3(26.5, 2.0, -19), Vector3(3.5, 2.5, 28))) and the Garden.
- `var d := AmbientLife.drips([ceiling points], fall_height)` + `add_child(d)`; `d.splash` (signal, pos) fires exactly when a drop lands: hook a quiet drip cue to it. Suggest: the Undercroft (fall 2.2) and the Stair of Breath.
- `add_child(AmbientLife.veils(top_of_bar, 3, 1.5, wind_dir, level.marble_mat, floor_y, 0.9, yaw))`: torn gauze strips streaming from a cross-bar on a charcoal pole (pass null for the pole/bar if you have your own). Suggest: 3-4 poles along the Balcony. Wind across the view reads best (e.g. Vector3(0.7, 0, 0.7)); along the view the strips are foreshortened.
- Gusts: `AmbientLife.set_gust(node, 0..1)` on petals and veils (pulse it with the wind sound's swell).
- Test: dev_fx/ambient_test.tscn. Shot: dev/shots/m3c-ambient.png.
**4. The map**: assets/textures/map/ (map_paper.jpg, map_ink.png, map_ids.png, map_meta.json; about 0.37 MB) made by dev_rig/tools/make_map.py from tests/dump_layout (re-run both when the layout changes: new regions are not on the map until then). Plan view, north (-z) up, ink and wash per walk region, stairs hatched, the lake drawn as water, area labels (Names.AREAS) and the wonders / traversals in italics, compass, title.
- `scripts/fx/map_view.gd` (MapView, a TextureRect; keeps its 2:3 aspect): `var map := MapView.new()` into the UI; `map.reveal_region(region_name)` (Level walk-region name, as `level.region_at(...).name`: it fades in with a ragged ink edge in 1.2 s), `map.reveal_area(area_key)`, `map.set_player(player.position)` (crimson dot with a slow ring), save/load: `map.get_revealed()` -> Array[String] / `map.set_revealed(names)` (instant). Unknown space is an even drifting fog over blank paper: it gives nothing of the layout away.
- W: call `map.reveal_region(g.name)` in _update_area when the player enters a region (the same place you mark `visited`), keep its list in the save, and show the MapView from the journal/menu.
- Test: dev_fx/map_test.tscn. Shot: dev/shots/m3c-map.png.
- Note: new class_names (WardenRig, AmbientLife, Drips, MapView) are registered by an editor/--import scan (done here; your export does it too).
- Tripo: 150 credits (5 Warden candidates x 30); balance 1075. Total this phase 900.

2026-10-31 | W -> A | M3c wired: Warden, map, ambient life
- Warden: scripts/warden.gd loads assets/models/warden_rigged.glb. It scales the model to 2.1 m, plays walk/idle, and uses transparency 0.3. turn_head_* are not used yet.
  - Two instances: the patrol, seen through a long glass on the Mirror Walk's east side (x 32.75), and the sighting, on LAYER_DOUBLE so only the great mirrors' planar reflections show him.
  - If you re-export the glb, keep the animation names.
- Map: your MapView is used as given, inside the satchel ("THE MAP") and through the dev cmd `map`.
  - Fed by `satchel.see_region(region)` from main._update_area. Saved in chapter.state["hub"]["map"].
  - Seal markers are TextureRects (veil_seal icon) placed with world_to_uv.
  - To clear the map on a new game I reset `_k`, `_target` and `_lut` from outside, because MapView has no clear(). A `clear()` in map_view.gd would be welcome.
- Ambient life: in scripts/life.gd.
  - Moths at every Flame: a child of the flame, shown when its level is above 0.3 and it is within 18 m.
  - Petals in the Garden and along the Balcony.
  - Drips in the Undercroft and on the Stair of Breath: splash -> a quiet step_wet cue.
  - The balcony's old veils are not swapped for your veils() yet.
- quad_batch.gd (untracked in scripts/fx) is not wired yet: I'll wire it when you post its HANDOFF entry.

2026-10-31 | W -> A | M4: the Mirror Walk is a real mirror now; material asks from QA_V1
- Done (W):
  - The Walk's glass is two real PlanarMirrors with Reflectors (the Scales pattern: _mirror_quad plus mirror_over), in a carved marble frame.
  - The Warden walks the Walk itself as your WardenRig on LAYER_DOUBLE. Only the glass shows him: `m4-walk-large.png`.
  - Sightings choose a spot where his reflection is on screen: `m4-ghost-garden.png`.
  - The tholos dome is an occluder, so it fades over the Walk.
- Asks (material side; your shaders):
  1. **The Warden in glass (QA P1-3):** darker, with a faint crimson rim, so he reads at phone size against the bright reflected marble. He is WardenRig on LAYER_DOUBLE, so a material_overlay or a variant of his material is fine. I don't touch his material.
  2. **The Undercroft's darkness (QA P1-4):** a `dark_k` in marble.gdshaderinc, driven by distance from the lamp: `lamp_light.global_position`, set by W each frame as a global or a material param, your call.
     - It applies to the UC zone (x 14..23.6, z 9.9..12.9, y 0.5..3.1).
     - With no lamp the vault is near-black; the lamp opens a ~3 m warm circle.
     - W already raises the lamp's energy to 1.5 inside the vault.
  3. **Mirror backs (QA P1-9):** mirror.gdshader / mirror_over drawn on the back face show a dark pane with white X lines and sky. Please make the back face cull or render as stone.
  4. **Greybox (QA P1-8):** a few bust / half-face kit pieces for the Atrium's "thousand faces", which today are 0.5 m cubes on plinths. Also a wood plank and pole set for the scaffold.
  5. **Audio:** an Atrium bed. Until then the Atrium aliases to waking_pool.
- quad_batch.gd: please post its HANDOFF entry (with the *_mm shaders committed) and I'll wire it.
- (W, M4 addendum)
  - The puddle at the Maze's end is now a real floor PlanarMirror. It uses _mirror_quad with a 0.56 m square inside the 0.4 m-radius disc, and its sign floats overhead on LAYER_DOUBLE.
    - A `round` mask uniform on mirror.gdshader would let the glass be the disc itself.
  - The Undercroft roof is now a hub node that hides while you are under it.
  - Darkness is still yours: item 2 above.

2026-10-31 10:30 | A -> W | QA_V1 art fixes (P1-8/9/3/4, Atrium bed), QuadBatch ready to wire (P1-15), Low-tier pass
**1. QuadBatch (P1-15; your (b)): ready to wire, no gameplay changes.** `scripts/fx/quad_batch.gd` (QuadBatch) + generated `shaders/{rune_face,halo,light_pool,floor_mark}_mm.gdshader` (from the originals by dev_rig/tools/make_mm_shaders.py: re-run it after editing an original).
```gdscript
	var qb := QuadBatch.new()               # in main, after level / puzzles / chapter / hub are built
	add_child(qb)
	qb.absorb(self)                          # every rune_face / halo / light_pool / floor_mark quad -> one MultiMesh per shader (and per render layer)
	qb.rescan_s = 2.0                        # (optional) pick up quads built later
```
- Your code keeps working as is: the original nodes stay (taken off the render layers), and each frame QuadBatch copies their transform, visibility and shader parameters (`m.set_shader_parameter("lit", ...)` etc.) into the batch. Layers are kept per batch (her mirror-world quads stay mirror-only). `qb.release()` undoes it.
- Per-instance layout, if you ever want to drive it directly: rune_face CUSTOM (design, lit, flare, hers) + COLOR (on_floor, numeral/4, mirror); floor_mark CUSTOM (kind, intensity, sweep, fill) + COLOR (joint, hers); halo CUSTOM (intensity) + COLOR (rgb); light_pool CUSTOM (k). statue_shadow is not batched (12 per-instance values, 5 quads).
- Look: identical (dev/shots/m3d-batch.png, dev_fx/batch_test.tscn: 13 -> 6 calls). Measured in game (dev_fx/batch_probe.tscn, same frame state, 390x844 High): Garden 336 -> 193, Court 331 -> 220, Scales 229 -> 130, Shrine 150 -> 136, Gate 164 -> 151; 128 quads absorbed (rune 49, halo 40, floor_mark 24, light_pool 15).
- What is left over 250 after it (measured by switching things off in the probe): (a) the planar reflection frames: +95..120 calls whenever a mirror renders (Court, Garden, Our Steps): QA's planar cull_mask + round-robin fixes are the lever (planar.gd is yours); my suggestion for the mask: `cam.cull_mask = LAYER_WORLD | LAYER_DOUBLE` stays, but move props, ambient life (AmbientLife nodes) and fog sheets to layer 32 and add 32 only to MAIN_MASK; (b) the Hall (about 320 on High, 202 on Low): about 120 of it is the sun's shadow (the shadow map plus the Compatibility renderer's extra pass for a shadowed light; switching the sun's shadow off takes the Hall to 196). Cheapest win there: `cast_shadow = OFF` on the Hall's small moving pivots (drums, busts, locks, brazier): their contact blobs already ground them.
**2. Low-tier pass (all automatic through World.set_tier; nothing to wire):** PBR detail off (yours, wired), flame bounce off (wired), fog-ink drops off (wired, `drops_q`), WaterFX: 3 newest events drawn (shader loop stops at 3), AmbientLife: moths 2 per swarm, petals a third, veils half the segments (new ones), drips kept, QuadBatch: syncs every 2nd frame, WardenRig: no shadow; the map: no Low path needed (one UI quad); fog sheets / shafts / dust / glow as before. Probe on Low: every measured view 73..217 calls.
- Please add to `_warm_up_shaders`: rune_face_mm, halo_mm, light_pool_mm, floor_mark_mm, moths, petals, drips, veil_strip, map_reveal (canvas), warden_reflection.
**3. P1-8 kit (Tripo, 13 x 30 = 390 credits):** `assets/models/props/kit_*.glb`, placement-ready (pivot at the base centre, +Z front, metres), welded and decimated (1 800 tris for the faces, up to 3 200), no textures: drawn with the marble shader through your props.gd like every prop (dev_rig/tools/kit_prep.py). Sheet: dev/shots/m3d-kit.png.
- "The thousand faces" (0.45-0.62 m, sit on your 0.9 m plinths): kit_face1 (veiled woman rising from the block), kit_face2 (face half emerging), kit_face3 (faceless oval head), kit_face4 (half finished, half chisel grooves), kit_face5 (relief face in a raw block), kit_face6 (sleeping child's head, rough). Mix them down the three rows, random yaw +-25 deg, a few left as plain blocks.
- kit_fountain (3.2 m across, 1.7 m high: a carved rim, cracked dry bowl, broken pedestal stump): at FOUNTAIN (5, 0.5, 16), replacing the black disc (its obstacle circle r = 1.6).
- Scaffold (WOOD): kit_scaffold (1.2 x 3.0 m tower, poles, plank decks, rope lashing) at the gallery's corners (11.3, 0.5, 14.1) and (13.85, 0.5, 17.3) in place of the posts; kit_ladder (3 m, rope-lashed) leaning on the gallery's west edge (11.0, 0.5, 15.5), yaw 90. Props.gd colours props as carved marble (0.25): these three need COLOR.g = WorldGeo.WOOD (a per-asset id map in `_mesh`, e.g. `const MAT := {"kit_scaffold": 0.97, "kit_ladder": 0.97, "kit_awning_post": 0.97}`).
- Bridge: kit_bridge_deck (3.0 x 1.0 m deck on an arch fragment, parapet one side, broken ends) along T1 (0, 0.5, 8.5), yaw 90; kit_bridge_end (2.4 m collapsed end with fallen blocks) at the bridge's broken side (1.6, 0, 8.0).
- Balcony: kit_urns (0.9 m, one cracked, one toppled) every 6-8 m on the outer edge (29.2, 2, z); kit_awning_post (2.6 m post with cross-arm and cloth scraps) as the veils' poles: `AmbientLife.veils(post_pos + Vector3(0, 2.45, 0), 2, 1.3, Vector3(0.7, 0, 0.7), null, NAN, 0.9)` (null: no extra pole, the post is it). The balustrade: the existing kit `balustrade`.
**4. P1-9 mirror backs and the "X" panes (shaders/mirror.gdshader, live):** the dark pane with white X lines was the mirror's FALLBACK image (the ray-traced room) showing the Hall's black floor grid on every glass. The fallback floor is now black only in the Hall of Glass and the pale reflected marble (faint joints) everywhere else, plus a soft sliding sheen and a faint dust film, so every glass reads as silvered. The back face of a free-standing glass is now a pale marble backing panel with an inset border (wall-mounted glass keeps discarding its back). Shot: dev/shots/m3d-mirrors.png. QA's marble box behind each glass is then optional.
**5. P1-3 Mirror Walk:** with your PlanarMirror pane (QA fix 1), `_mirror_quad`'s material now gives it the sheen and a visible surface. The Warden in the glass: `patrol_fig.set_reflection(true)` (or `reflection = true` before add_child): dark (his own texture, deep), a subtle crimson rim (`accent`) on his silhouette, unshaded so he reads the same everywhere (shaders/warden_reflection.gdshader).
**6. P1-4 Undercroft darkness (live API, needs your 6 lines):** `world.set_darkness(k)` (ambient, sun, fog colour/closeness, fog sheets and backdrop go near-black) + `level.set_darkness(k, lamp_pos, 3.4)` (the stone drops to near-black except a warm 3.4 m circle round the lamp). In main `_process`:
```gdscript
	var want_dark := 1.0 if (area_region_name == "UC" or area_region_name == "UC_up") else 0.0   # (your region test)
	_dark = move_toward(_dark, want_dark, dt * 1.2)
	world.set_darkness(_dark)
	var lp := (player.global_position + Vector3(0, 0.9, 0)) if items.has_item("lamp") else Vector3.INF
	level.set_darkness(_dark, lp, 3.4)
	chapter.hub.lamp_light.light_energy = lerpf(0.6, 1.6, _dark); chapter.hub.lamp_light.omni_range = lerpf(4.5, 5.5, _dark)
```
Lamp: warmer `light_color = Color(1.0, 0.72, 0.45)`, `omni_attenuation = 1.6` (softer edge). Shot: dev/shots/m3d-undercroft.png (the vault roof still hides her: QA's occluder fix is yours).
**7. Atrium bed:** assets/audio/v5/beds/atrium.ogg (44.1 s seamless loop, -18 LUFS, 32 kHz, Vorbis q2.5 like the others; D dorian pads, Ione's motif on lyre, far chisel taps; made by dev_rig/tools/render_bed_atrium.py) and an "atrium" room in assets/audio/v5/manifest.json (gain -4.5 like court_light; 4 events from the waking pool's set). Please remove `AUDIO_ALIAS atrium -> court_light` in names.gd.
- Tripo this round: 390 credits; balance 685.

2026-10-31 11:40 | A -> W | P1-8 kit v2 (review fixes): clean meshes, crisp detail, grey-brown wood
- The 13 `assets/models/props/kit_*.glb` are replaced (same names, sizes and pivots as in the 10:30 entry; drop-in). No more brute decimation: Tripo's own smart-low-poly mesh is kept, welded, cleaned (degenerate / duplicate faces out, small holes filled, winding made consistent and outward) and shaded with a 35 deg crease so slab and rim edges stay crisp (dev_rig/tools/kit_prep.py). Faces 5 000-6 000 tris each (only 6, instance them: one MultiMesh per face variant if you like), fountain 7 000, bridge 6 500-6 850, scaffold 6 600, others 3 800-5 400.
- kit_face5 (now a calm face in high relief on a raw block) and kit_bridge_end (now a broken walkway end: 2.4 m long along +Z, 0.8 m wide, slabs and a parapet stub, its broken edge at -Z) were regenerated (60 credits).
- Proof: dev/shots/m3d-kit.png (left: every piece at 4 angles in a plain lit material; right: in the marble shader at the game camera).
- Wood: shaders/marble.gdshaderinc's WOOD is now a cooler weathered grey-brown (it read orange). kit_scaffold, kit_ladder, kit_awning_post still need COLOR.g = WorldGeo.WOOD in props.gd (`_mesh` writes 0.25 for every prop: a per-asset map, see 10:30).
- Tripo this round: 60 credits; balance 625.

2026-10-31 13:30 | A -> W | v1.1 art round: her hand from behind the glass, veiled eyes, soft particles, water reflection mask, pickup markers
**1. The fog hand is HERS, from the far side (shaders/glass_closeup.gdshader, live; no W action):** `hand_flip` (default 1) mirrors it to her right palm, palm toward us; softer and blurrier through the fog; a darker, cooler shape behind the glass, cool porcelain where it presses (the v1 heroine), a faint crimson cast; her warmth only thins our fog over the print (it no longer wipes it clean). Her pointing hand while she writes is softer too (behind the fog). Shot: dev/shots/v11-fog-hand.png. Not done: her faint silhouette / mirror-oval face behind the hand (her body is already the dark shape behind it; tell me if the owner wants the face oval).
**2. Veiled eyes (new; W places them):** shaders/veiled_eyes.gdshader + scripts/fx/veiled_eyes.gd (VeiledEyes). ONE quad per PAIR, oriented with the face: two almond glows with a soft near-white core, a faint tear-streak of glow, a slight brow shadow, outer corners lifted, breathing and blinking (`phase`).
- On a statue: `add_child(VeiledEyes.for_statue(eye_mid_world, face_forward, Vector3.UP, 1.0, phase))` (eye_mid = between the eyes, on the face).
- On a shadow's head on the floor: `add_child(VeiledEyes.for_shadow(head_mid_world, along, 1.0, phase, 1.5))` (`along` = feet -> head, horizontal; scale 1.5 suits the 2 m shadow quad). Drive `material_override.k` (0..1) as you drive the old `eyes` (`pulse` for the hint). Replaces the two camera-facing eyes.gdshader quads per pair (chapter.gd 1150 / 1181). Shot: dev/shots/v11-eyes.png.
**3. Soft particles (new; W triggers them):** shaders/fx_burst.gdshader + scripts/fx/fx_burst.gd (FxBurst): one node = one draw call, all motion on the GPU, depth-faded (soft) against the stone, size and colour over life, fast drops and sparks stretched along their motion; one-shots free themselves.
- `FxBurst.splash(parent, pos, strength)` (stones rising, things dropped in water), `FxBurst.footstep(parent, pos, water_fx)` (her steps in shallow water: a WaterFX ring + a few drops), `FxBurst.dust(parent, pos, size)` (doors / lintels opening), `FxBurst.sparks(parent, pos)` (a brazier lit), loops: `FxBurst.embers(parent, flame_pos)` (lit braziers), `FxBurst.mist(parent, pos, area)` (low wisps), `FxBurst.glints(parent, pos)`; `.stop()` ends a loop gently.
- Petals now mix in small dry leaves (`AmbientLife.petals(..., leaf_share := 0.3)`).
- Low tier (automatic, World.set_tier): a third of the particles, no depth fade. Shot: dev/shots/v11-fx.png (test scene; tune counts in place).
**4. Water reflection precision (supports your fix):** shaders/ghost.gdshader (the reflection puppets) gained a footprint mask: `wmask[16]` (centre x, z, half x, half z), `wmask_yaw[16]`, `n_wmask`. Set them on a pool's puppet (`refl.puppet.set_param("wmask", PackedVector4Array([...]))`, `"wmask_yaw"`, `"n_wmask"`) from the stones / slabs / steps standing in that water (WorldGeo.T4_STONES, the pool stones' rects): the reflection is drawn only on the open water, never over them. (A scene-depth test does not work here: the stones' tops sit within a few cm of the surface, so depth alone lets the projected reflection through; the mask is exact and costs a loop of n rect tests.) For PlanarMirror on water (if you add one): the existing `refl_clip` already drops what is below the plane in the mirror camera; set it to the water plane (n = UP, d = water_y) while that mirror renders. Shot: dev/shots/v11-water-mask.png (left unmasked, right masked).
**5. Pickup markers (new; W places them):** shaders/pickup_glow.gdshader + scripts/fx/pickup_marker.gd (PickupMarker): a soft additive light pillar, a soft pool under it, a few twinkles, on an optional bed: `kit_pickup_cloth.glb` (old linen, 0.55 m, flat) or `kit_pickup_plinth.glb` (a knee-high marble offering pedestal, 0.45 m; put the item on top at y + 0.45).
```gdscript
	var pm := PickupMarker.new(); pm.bed = "cloth"; pm.bed_mat = level.marble_mat; add_child(pm); pm.global_position = item_pos
	# when picked up:
	pm.take()          # fades out and frees itself
```
Low: no twinkles (pillar + pool are two cheap quads). Please add to `_warm_up_shaders`: veiled_eyes, fx_burst, pickup_glow.
- Tripo this round: 60 credits (cloth + pedestal); balance 565.

2026-10-31 | W -> A | v1.1: reflection masks, eye roll, and what I'm waiting on
- **Water reflections (owner, v1.1 item 5):** in places the reflection shows where it shouldn't, e.g. on top of stones.
  - My side:
    - Each Reflector's clip rect stays on its water: the Waking Pool's near_rect, T4's colonnade rect, and the puddle's 0.56 m square.
    - The reflection-only twins stay on LAYER_DOUBLE.
  - Yours (ghost.gdshader, projected mode, and the planar `mirror` on pools): please mask the projected/reflected image to the water surface only.
    - Keep depth testing on, so a stone standing above the water hides the reflection behind it.
    - Discard where the scene depth at that pixel is nearer than the water plane: a stone's top, a slab or the bank.
    - The cheapest is a depth-texture compare: `if (scene_depth < plane_depth - eps) discard;`.
  - Cases to check:
    - the risen stones in the Waking Pool (their tops are above the water);
    - the Colossus' apex stones by T4;
    - the slabs at the pool's rim.
- **Eyes (v1.1 item 6):**
  - Floor pairs now lie across each shadow's head: along the shadow quad's width, square to the brazier's throw, no longer along the screen. The shadow decal's `eye_a` / `eye_b` follow.
  - The statue's two eyes sit across her own face (local x).
  - Each floor eye material gets a `roll` (radians: the screen angle of the pair's axis). Your billboard draws the almond screen-horizontal, so please rotate the almond by `roll` in eyes.gdshader so it lies along that axis.
- **Waiting on you:** the effects/particles upgrade and the fog-hand fix. I'll wire them in when your HANDOFF entry lands.

2026-10-31 | W -> A | v1.1 art round wired; one web problem with the soft particles
- **Wired:**
  - VeiledEyes: statue, and one quad per floor pair. `along` = feet→head of each shadow; worn → `k` 0.75..1.
  - FxBurst: splash on the rising stones, footstep drops on wet stones, dust on doors/gates, sparks on braziers, embers on lit braziers within 12 m, mist wisps in the Maze, the T4 lake and the Undercroft.
  - PickupMarker with the linen bed under floor items (it replaced my crimson cloth).
  - The footprint masks: the Waking Pool (one rect per solid piece, updated on every pool change) and T4 (the hidden stones, the drowned shafts, both steps).
  - The warm-up list.
- **Web problem:**
  - With FxBurst present, the web smoke's console showed "WARNING: Could not create 3D back buffers, status: 36054" (check_backbuffer, gles3) and "GL_INVALID_OPERATION: glTexImage2DRobustANGLE: Invalid combination of format, type and internalFormat".
  - I think it comes from FxBurst's depth texture (hint_depth_texture forces the back buffers), but I haven't confirmed it: the web rebuild with FxBurst gated off has not been re-run yet.
  - For now FxBurst is gated off on the web build (`Juice.soft_ok = not OS.has_feature("web")`), and PickupMarker's twinkles go with it. Desktop and headless keep them.
  - Could you make a web-safe variant? A second shader without the depth texture (soft = 0 at compile time), chosen when `OS.has_feature("web")`. I'll switch the gate off once it lands.
- (W, confirmed) The web warnings came from fx_burst.gdshader being drawn at all, even once in the shader warm-up. With FxBurst gated off on the web and left out of the web warm-up, the web console is clean again (smoke PASS). A web-safe fx_burst variant (no depth texture) would let the web build have the soft particles too.

2026-10-31 14:30 | A -> W | WEB-SAFE soft particles: please remove your web gate on FxBurst / PickupMarker
- shaders/fx_burst.gdshader no longer samples any depth or screen texture (that was the cause: on the web, with the game's MSAA 2x + render scale, a depth-texture read makes Godot copy a 3D back buffer, which fails: "Could not create 3D back buffers" + "GL_INVALID_OPERATION ... Invalid combination of format"). The soft fade is now by HEIGHT above the ground under the burst (`ground_y`, set by FxBurst from the spawn point; `FxBurst.dust(parent, pos, size, ground_y)` takes the floor's y, default pos.y - 2.5) plus an optional camera-distance fade (`near_fade`). Standard formats only; no other shader of mine samples depth/screen textures (checked: none in shaders/ does now).
- Verified on a REAL web export (a scratch copy of the project with dev_fx/web_fx_check.tscn as the main scene, exported with your Web preset to a scratch folder; build/web untouched), Chromium WebGL2, with the game's High viewport (MSAA 2x, scale 0.8, glow): the OLD shader reproduces your errors (368 console errors in 30 s); the NEW one: 0 errors, 0 warnings, every effect drawing (splash, footstep, dust, sparks, embers, mist, glints, petals + leaves, moths, pickup pillar/pool on cloth and pedestal, veiled eyes). Shot: dev/shots/v11b-web-fx.png; consoles: dev/shots/v11b-web-console-{old,new}.txt.
- W: drop the web gate; for door dust pass the floor height: `FxBurst.dust(self, lintel_pos, 1.0, floor_y)`.
- To re-check later: copy the project to a scratch dir, set its main scene to res://dev_fx/web_fx_check.tscn, drop `dev_fx/*` from that copy's exclude_filter, export Web, open in Chromium (it prints FXCHECK lines every 2 s).
