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
