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

2026-10-31 16:30 | A -> W | v1.1c: particles tuned in game, QA_V11 (bold floor eyes, Colonnade hidden path, pickup beacons), gallery + Balcony kit
All verified in the REAL game (devshots / dev_fx in-game probes at 390x844, High). Shots: dev/shots/v11c-particles-ingame.png, v11c-qa-fixes.png, v11c-kit-ingame.png. Nothing for you to change in your calls unless noted.
**1. Particles (scripts/fx/fx_burst.gd, shaders/fx_burst.gdshader; your calls unchanged):** sizes raised to read at the phone camera (a particle needs 6-10 cm: ~52 css px per metre). Splash 46 drops 8.5 cm, footstep 12 drops 7.5 cm + a bigger WaterFX ring, door dust bigger and a shade darker than the stone (it was lost on cream), sparks a 36-spark orange-crimson ignition burst (warm white vanished on marble), embers 16 per flame that SWELL for ~2 s after lighting then settle (automatic), mist darker cool grey 0.52 alpha in broad wisps, pickup twinkles crimson stars with a white core. Still web-safe (no depth/screen texture). In-game probe: dev_fx/fx_ingame.tscn.
**2. QA_V11 P1-3 bold floor eyes (scripts/fx/veiled_eyes.gd; your call at chapter.gd:1230 unchanged):** at your scale 1.5 each floor eye is now ~21 x 12 cm (the floor is seen at 36 deg, so it shows ~21 x 7), 38 cm apart, crimson-hot core (no white centre: on pale marble it read as a hole), wide halo, no brow. The statue's pair is unchanged.
**3. QA_V11 P1-2 Flooded Colonnade (live, shader side; one geometry change for you):**
- still_water: over the Colonnade (`veil_rect` 9.2..13.6 x 4.5..9.5) the water is milkier and nearly opaque (`veil_milk` 0.6, `veil_opacity` 0.93): the stones 5 cm under it show only as faint shapes.
- marble: stone in that rect below the water (+3 cm) reads wet, dark and mossy (`sub_rect`, `sub_y`), true and false alike.
- ghost.gdshader: EVERY reflection on water (pool puppets: ripple_amt > 0.5) now wavers, breaks into drifting ripple bands and sits darker (no longer looks painted on stone).
- W (geometry, world_geo.gd `_colonnade`): make the decoys the same as the true stones: square 0.9 m blocks, top at T4_Y (5 cm under the water), slight yaw like the stones, in place of the round drums standing out of it; and since every stone is now under the surface, drop the T4 `wmask` rects in hub.gd (her reflection SHOULD show over the submerged stones: that is the guide).
**4. Pickup beacons (shaders/pickup_glow.gdshader; your PickupMarker calls unchanged):** a wider, crimson-pink pillar (a white core was lost on cream marble), 1.6x alpha, a slow bright streak climbing it, a stronger pool. Reads at phone size in fog (amphora, pin stele, lamp in the shots). The pin itself is your model: QA's 1.8x scale on pin_node still applies.
**5. Greybox replacements (Tripo 60 credits; placed for the preview by dev_fx/kit_ingame.tscn, which shows the exact transforms):**
- `kit_gallery.glb` (WOOD): a scaffold gallery: plank deck on four braced posts, rope-lashed rails on three sides, 2.49 x 3.0 m, deck at 1.8 m. Over the Atrium gallery: base (12.575, 0.5, 15.7), yaw 0, scale (1.104, 1.444, 1.133) -> deck at GAL_Y 3.1, footprint 2.75 x 3.4 (your gallery rect). Remove the stone slab and the two iron posts; keep your walk regions and the stair (its open side faces west, the rails do not block it). Flag WOOD (0.97) in props.gd's per-asset id map (with kit_scaffold, kit_ladder, kit_awning_post).
- Balcony (x 26.5..29.5, y 2): `kit_dead_plant.glb` (0.6 m cracked pot, dead twigs) + `kit_urns` + `kit_awning_post` (WOOD) with `AmbientLife.veils(post + Vector3(0, 2.45, 0), 2, 1.3, Vector3(0.7, 0, 0.7), null, NAN, 0.9, yaw)`. Placements used in the preview (asset, pos, yaw deg): urns (29.25, 2, -2.5) 30; plant (26.9, 2, -4.2) 0; post (29.4, 2, -6.5) 90; plant (29.2, 2, -9.0) 40; urns (26.9, 2, -11.0) 200; post (29.4, 2, -13.5) 90; plant (26.95, 2, -15.5) 110; urns (29.25, 2, -17.0) 120. All on the rails' sides, the walkway clear (obstacle circles r 0.35 for plants, 0.5 for urns, 0.2 for posts). The existing `balustrade` kit stays the railing.
- Tripo: 60 credits; balance 505.

2026-10-31 17:20 | A -> W | v1.1d BOLDER floor eyes (owner) + the shadow's head to wear them; a QuadBatch fix
- scripts/fx/veiled_eyes.gd (live, your call at chapter.gd:1230 unchanged): at scale 1.5 each floor eye is now 40 x 20 cm, centres 60 cm apart, a clear almond (corners lifted), a brighter crimson-hot core and a stronger halo (the quad is 1.6 x 0.95 m).
- The shadow's head must scale to match (YOUR lines, 3 changes in chapter.gd; dev_fx/eyes_ingame.tscn applies exactly these on the running game for the shot):
  1. the statue_shadow material: add `"head_k": 2.0` to its `_smat` params (line ~1216; shaders/statue_shadow.gdshader gained `head_k`, default 1 = as before; the head grows down from the top of the veil, 1.04 m wide at wid 1.45, the body unchanged);
  2. `eye_head(i)`: the head's centre moves to q.y 0.71: `return _shadow_xf(i, 1.0) * Vector3(0.0, 0.0, 0.5 - 0.71)`;
  3. `const EYE_HALF := 0.30` (was 0.11), so `eye_pos` and the decal's own `eye_a` / `eye_b` match the 60 cm pair.
  Check your "a shadow wears a pair" tolerance: the pair is now ~1 m across, so a head within ~0.3 m of it already covers both eyes.
- Shot: dev/shots/v11d-eyes-bold.png (before | after on the floor | braziers lit, the heads wearing them).
- QuadBatch fix (scripts/fx/quad_batch.gd): after a level rebuild (`jump`, new game) a freed quad raised "Trying to assign invalid previously freed instance" every frame in `_sync`; it now skips freed quads and `absorb()` prunes them (and their batch slots).
- FYI: the in-game run still logs your "Dual paraboloid shadow mode not supported in the Compatibility renderer" (QA_V11 P1-1) when braziers light.

2026-10-31 | W -> A, coordinator | v1.1d Our Steps (big glass, old board rules) proved by real touch in the web build; your 17:20 eye edits applied; Shadow Chamber braziers re-placed
- **Our Steps v1.1d** (`scripts/our_steps.gd`, M1 geometry restored in `ch1_geo.gd`): a 6 x 3.5 m planar glass, a 4 x 3 floor; her side only in the glass (her column and glyph on LAYER_DOUBLE, shown only while you play the board). Boards "The Column" (par 4), "Two Stones" (par 6).
- **Touch fixes** found by the new web test:
  - one drag = one step (a quick flick inside one frame is a step too);
  - a held drag repeats after 600 ms and 3 frames;
  - the drag that walks you on never steps;
  - a push toward the glass in front of the gap is funnelled through it;
  - QA_V11: the aim hysteresis holds only within one held drag (0.12).
- **`tests/web_oursteps.mjs`**: a REQUIRED part of `tests/smoke.sh`. It solves both boards in the exported build using only CDP touch drags on the joystick, then walks out to the Court. Shots: `<tag>-os-step-NN.png`.
- **A's 17:20 edits applied:**
  - `head_k` 2.0 on statue_shadow;
  - `eye_head` q.y 0.71;
  - `EYE_HALF` 0.30.
  - The "wears the pair" test now asks for another head ≥ 1.2 m from a pair's head.
- **Shadow Chamber** (the owner: a tripod stood on a pair): `SH_BRAZ` re-placed by a search; the rules are unchanged (`SH_SOLUTION` [0, 1, 4], `SH_PRELIT` 3).
  - Every pair is ≥ 30 cm from every brazier footprint and from her plinth.
  - Every pair is in full sight. New checks:
    - `framing_test`: "SHADOW EYES";
    - `overlap_test`: "EYES";
    - playthrough: a clearance check.
  - A: if you re-shoot `v11d-eyes-bold`, the braziers have moved.
- **QA_V11:**
  - flame shadows are off on the web (no dual-paraboloid errors); the web smoke runs a High stretch;
  - area titles break onto two lines and step their size down;
  - the hotbar is a right-edge column of 52 px slots, and the round shard slot is gone;
  - the coin, offering, cot and relief now change the world;
  - two new points (a votive at the Court's entry, a lookout seat on the Balcony);
  - the shader warm-up is spread over the title screen;
  - the tholos dome fades on the Mirror Walk and at the sealed door.
- **Still open:**
  - the Hall sighting draw calls (could not reproduce a sighting at the spot I measured: 242 → 243);
  - the Court → Maze door at 314;
  - the Gate's two framed panes.

2026-11-05 | A -> W | v2.0 Chapter I effects: prologue, PassThrough, Beacons, the Warden's snuff, the First Shrine finale, intro cards, the comb; global pass (flames)
Every effect below is verified IN THE GAME (dev_fx/v2_fx_ingame.tscn fires the real builders on the running main.tscn at 390x844, High; dev_fx/v2_global.tscn shoots the before/after). Web-safe: no depth or screen texture anywhere; all decals alpha-blended crimson (additive light vanishes on cream marble). Low tier wired in world.gd set_tier (`OmenFx.high`, `BeaconFire.high`). NOTE: your working tree did not parse while I tested (hub `SEAL_POS`/`BEACON_POS`, items `amphora_full`), so the shots come from a copy with your files at HEAD 2717aed + mine; nothing of yours was touched.
Sheets (all in-game): dev/shots/v2-fx-prologue.png, v2-fx-passthrough-snuff.png, v2-fx-beacons.png, v2-fx-shrine.png, v2-fx-cards.png, v2-global-before-after.png, v2-fx-low.png. Web: every new effect fired at once in a real Web export (dev_fx/v2_web.tscn as main scene, headless Chromium/WebGL2): 0 console errors.

**1. Prologue (EIDOLON_SCRIPT §5 shots 5-11).** `pool` = the waking pool surface point (y = Ch1Geo.WATER_Y), `fx` = puzzles.pool_fx, `j` = game.juice.
```gdscript
# 5. her palm on the surface from beneath, two knocks (returns the print; fade it when she is taken)
var palm := OmenFx.palm_press(j, pool, yaw, puzzles.pool_fx, 2)          # ~2.3 s: rises into the surface, presses, tap, tap
# 7. the Glass Warden rises IN the water behind her (cracked glass, pane shimmer, crimson rim, wet line at the surface)
var w := WardenRig.new(); j.add_child(w); w.global_position = behind_her; w.rotation.y = yaw
w.set_look("glass")
await w.rise_from(Ch1Geo.WATER_Y, 3.2, Ch1Geo.WATER_Y - 0.55, puzzles.pool_fx).finished   # (stand_y: waist-deep)
# 9. dragged into the fog of the water: the pool clouds over (and clears again for shot 11)
OmenFx.fade_out(palm, 0.6)
OmenFx.murk(puzzles.water_mat, 1.0, 2.0)        # ... later: OmenFx.murk(puzzles.water_mat, 0.0, 2.5)
# 10. the comb passes up THROUGH the surface and clinks onto the marble
var comb: Node3D = load("res://assets/models/items/item_comb.glb").instantiate(); j.add_child(comb)
PassThrough.water(j, pool, comb, puzzles.pool_fx, 0.35, 1.6, rim_point_on_marble)   # caustics, bulge, meniscus ring, drops, drips, glint
```
- If he must be seen upside down IN the glass of the water (a reflected puppet) instead of rising out of it: `w.glass_param("clip_dir", -1.0)` keeps only what is below the surface.
- `w.set_look("reflection")` is the old mirror-only look; `w.set_look("")` his own.

**2. PassThrough (scripts/fx/pass_through.gd): "only still water and cracked glass let things pass".** The item node is yours, already where it should end up.
```gdscript
# I.5 the crypt basin: the LIT lamp pushed up through the still water
PassThrough.water(crypt_node, BASIN_SURFACE, lamp_node, basin_fx_or_null, 0.45, 1.8)
# West wing, Hall of Glass solve: the Shard through the crack at one corner of the great mirror (glass faces +Z)
PassThrough.mirror(self, Vector3(1.9, 2.0, -20.46), Vector3.BACK, shard_node, 1.6, true)     # the crack stays as a scar
```
`water_fx` may be null (then the decals and particles alone). `keep_crack` leaves the crack decal (child of `parent`) glinting at 55%.

**3. Beacons (scripts/fx/beacon_fire.gd).** One per wing brazier and one per Atrium pillar:
```gdscript
var bf := BeaconFire.new(); bf.noise = level.noise_tex; pillar.add_child(bf); bf.position = Vector3(0, top_of_bowl, 0)
bf.ignite()          # on lighting: the flame leaps to ~2.4x (0.22 s), holds, settles over 2.2 s; two spark bursts, embers swelling, a fog-free far glow
bf.set_lit(true)     # on load (no ignition); set_lit(false) puts it out; bf.lit to read
```
Its fire IS the game's `Flame` (same crimson fire as the braziers; its light joins the shared light budget, `Flame.cull`; crimson bounce on the marble) at `height` 1.3 m, plus a fog-free crimson far glow (`glow_size` 3.2 m) that reads across the Atrium. `bf.flame` is the Flame if you want its `key`. Low: no extra ember loop or second spark burst (Flame's own Low rules apply).

**4. The Warden snuffs a reflection (mirror or pool):**
```gdscript
OmenFx.frost(j, glass_centre, glass_normal, Vector2(glass_w, glass_h), 1.6)   # dark spreads with frost-cracks (0.9 s), holds, clears (1.2 s)
OmenFx.frost(j, POOL_C, Vector3.UP, Vector2(1.6, 1.6), 1.6)                    # on water
```
Hide the reflection puppet yourself at ~0.5 s (under the dark) and show it again (or not) as it clears.

**5. First Shrine finale (I.23):**
```gdscript
OmenFx.write_in_water(self, POOL_C, cam_yaw, "ΒΡΕΣ ΜΕ", 4.2, 0.36, 3.0)   # stroke by stroke with a pen-tip glow, lingers 3 s, fades
await get_tree().create_timer(5.0).timeout
OmenFx.glass_eye(self, POOL_C + Vector3(0, 0, -0.1), 1.3, 1.1, 2.4)       # opens 1.1 s, holds 2.4 s, closes, gone
```
`yaw` turns the line of writing (pass your shrine camera's yaw so it reads upright). Glyphs for Β Ρ Ε Σ Μ Α Ι Ο Ν Η and space.

**6. Intro cards (scripts/fx/intro_card.gd, IntroCard).** One stanza of §5 = one card; `*...*` lines are italic (may span lines):
```gdscript
var cl := CanvasLayer.new(); cl.layer = 60; add_child(cl)
var ic := IntroCard.new(); cl.add_child(ic)
await ic.play_all(INTRO_STANZAS, 3.0)     # each: ink soaks in mirrored, card flips true, holds, dissolves to fog
cl.queue_free()                          # ic.skip() finishes the current card
```

**7. The comb (Tripo, 30 credits):** `assets/models/items/item_comb.glb` (scallop-shell comb, 9 x 9 x 5.8 cm, base y 0, front +Z, 4.9k tris, 256 px base colour) and `assets/textures/icons/comb.png` (128 px); manifest entry added. It glows in the satchel: give it the PickupMarker / glow you use for story items.

**8. Global effects pass (live; none of your calls change). Before/after in game: dev/shots/v2-global-before-after.png; Low: v2-fx-low.png.**
- FLAMES (scripts/flame.gd, shaders/flame.gdshader, ember.gdshader): every Flame (braziers, votives, hand lamp, beacons) was additive: on cream marble and in fog it read as a pale wisp. Now alpha-blended crimson (deep tongues, crimson body, rose-white heart, a crimson veil of glow), embers 6 cm (were 2.5) and crimson with a rose core. Same timing, same `intensity`/`gutter`, same light budget.
- MIRRORS (shaders/glass.gdshader): the sheen is a soft band plus a thin bright streak, and a small four-point glint flares on the frame's corner as it passes. Subtle by design.
- COLOUR: everything new uses the one crimson light (accent / accent_core / accent_tint, Palette.FIRE_LIGHT); the only non-crimson accents are silver glass sparkles (glass) and white water (meniscus, drops).
- WATER, DUST, MIST, PETALS, PICKUPS: re-shot in game; they already read at 390x844 after v1.1c, kept. New: `FxBurst.drip_off(parent, pos)` (drops off a lifted thing) and `FxBurst.shards(parent, pos, normal)` (glass sparkles), used by PassThrough.
- DECALS ON WATER sit `OmenFx.LIFT` (2.5 cm) above it with render_priority 10, so the water never swallows them.
- LOW: OmenFx (no extra ring decals), BeaconFire (above), FxBurst a third of the particles; all wired in world.gd set_tier.

**Notes**
- The writing and the eye are flat decals: pass the shrine camera's yaw (`get_viewport().get_camera_3d().global_rotation.y`) so the line reads level on screen. At the default 7.5 m camera the pool is small; your shrine cinematic zoom (4.2) is what the shots use.
- `OmenFx.frost` is a disc inside the quad you give it: pass the glass's (or pool's) own centre and size and it stays on it.
- Test tools (mine): dev_fx/v2_fx_ingame.tscn (`--only=palm,warden,murk,comb,shard,frost,beacon,write,eye,card`, `--low`), dev_fx/v2_global.tscn (`--tag=before|after`), dev_fx/v2_web.tscn, dev_fx/card_test.gd, dev_rig/tools/item_view.gd (item turnaround + 128 px icon).
- Tripo: 30 credits (the comb); balance 475.


2026-11-05 | A -> W | v2.0 Chapter I rebuild: landmark set dressing (Dress), per-space moods (world.set_mood), the prologue set
No V2_MAP.md / landmark list from you yet, so everything is position-free: you pass each landmark's floor rect and height, and the recipe fills it. Every recipe is shot IN THE GAME (dev_fx/dress_ingame.tscn: each landmark on a bare test floor out in the game's own world, with its camera, fog, mood and tier; the game camera plus an overview). Sheets: dev/shots/v2-dress-act1.png, v2-dress-west.png, v2-dress-north.png, v2-dress-east.png, v2-dress-act3.png, v2-dress-low.png. Built on the existing Tripo assets first (statues, kit_*, door, gate, braziers, altar, mirror frames, columns, items' wax tablets); 4 new kit pieces where nothing existing fitted (below).

**1. Dressing a landmark (scripts/fx/dress.gd, class Dress): one line each, after the landmark's walls / walk regions / puzzle obstacles exist** (it tests against them):
```gdscript
var d := Dress.build(level, self, "atrium", Rect2(x0, z0, width_x, depth_z), floor_y, [path_rect, puzzle_rect])
# d.beacons  (atrium) the three BeaconFire nodes, W, N, E: d.beacons[i].ignite() / set_lit(true)
# d.flames   votive / bench flames (Flame, crimson, in the shared light budget)
# d.skipped  pieces it left out, with the reason: print it once while you lay out
```
Landmark ids (EIDOLON_SCRIPT §6): Act 1 `stub_gateway`, `glass_niche`, `crypt`, `atrium`; W wing `stair_breath`, `hall_glass`, `shadow_chamber`, `hidden_way`, `colossus`; N wing `colonnade`, `turned_ones`, `votive`, `tree_shards`, `mist_maze`; E wing `balcony`, `singing_stones`, `mirror_walk`, `spring`, `scales`; Act 3 `pool_halves`, `bridge`, `gate_four`, `shrine`.
What it guarantees:
- **The view stays clear.** The camera looks from the south-west, so tall pieces only stand on a landmark's NORTH and EAST edges (the back of the view). The south and west edges get low pieces only. Anything taller than 1.6 m joins the see-through (`level.occluders`).
- **Nothing overlaps.** Each piece is tested against your solids and obstacles, the earlier pieces, the `keep` rects and the landmark rect. Edge pieces slide inward to fit. A piece that still does not fit is skipped, never forced. Every piece gets an obstacle footprint (a circle, or a chain of circles for long pieces).
- **Budget.** One landmark = 1 merged marble mesh + 1 see-through mesh + 1 small-dressing mesh + 1 glass-pane mesh (mirror frames) + 1 contact-shadow multimesh, plus its flames, veils and mist. Measured in game in the test bays: 30-47 draw calls per view in total (game camera, High; the Atrium with its 3 beacons is the 47), 28-41 on Low.
- **Low tier** (wired in world.gd set_tier via `Dress.apply_tier`): the small dressing goes; the veils are not built.
- **One crimson light.** The only lights are Flame votives and BeaconFire; nothing else glows.
- **The crypt.** The bench flame is small; your lamp beat and `set_darkness` do the rest.
- **The Atrium.** The fountain recipe piece is the kit_fountain. Your still water goes in its basin.
- **Shadow Chamber.** I put NO braziers in it: yours are the puzzle.
- **Glass niche.** The pylon niche on the north edge is the frame for your one-stroke glass.

**2. Moods (scripts/world.gd, live): light and fog per space; the crimson accent is unchanged everywhere.**
```gdscript
world.set_mood("w_glass")    # on entering any W-wing space: glass and cold (blue-grey fog, cool light, crisp, desaturated)
world.set_mood("n_garden")   # N wing: garden mist (green-grey low mist, soft warm light, closer fog)
world.set_mood("e_high")     # E wing: high and windy (thin bright air, strong sun, fog sheets racing ~3x)
world.set_mood("act1")       # Act 1 (default), "act3" the convergence (dusk, rose fog), "prologue" (near night)
```
- Blends over 2.5 s (second argument). `set_darkness` and `set_awaken` still apply on top.
- Suggested hook: wherever you change area (main.gd, by `AREA_WIND` / `_area_group`), add `world.set_mood(MOOD_OF[area])` with your new area names.
- The fog drift is now accumulated by World (fog_sheet `drift_off`), so wind changes never jump.

**3. Prologue set (Dress.prologue_set): the black-water threshold.**
```gdscript
var set := Dress.prologue_set(level, self, lip_point, head_point, 12.0)   # lip: her marble lip (water to its north); head: the Observer, half sunk
world.set_mood("prologue", 0.0)
# set.water_mat is the black water (OmenFx.murk works on it); free `set` when the prologue ends
```
- Black, glassy, still water spreads 60 m north of the lip.
- The marble lip is two worn slabs stepping down into it.
- The giant veiled head is the existing `colossus_head_veiled`, 12 m tall, sunk to 42%, seen from the back. Put `head_point` to the lip's north-east (straight up the screen) about 10 m out.
- Today your prologue uses the waking pool and CO_HEAD. Use this set if the new layout gives the prologue its own space.

**4. New kit pieces (Tripo, 120 credits; balance 355; cap 150 respected).** Prepped like the rest of the kit by `dev_rig/tools/kit_prep.py`: front +Z, base y 0, marble or wood placeholder, no textures. Dress draws them in wood. Listed in the props manifest.json.
- kit_workbench (1.6 x 0.96 x 0.7 m: mallets, chisels, a half-carved face);
- kit_cot (2.0 x 1.14 m, rumpled linen);
- kit_windbells (2.4 m frame of five bronze bells and torn ribbons, the Singing Stones);
- kit_votive (1.1 m roadside niche with clay lamps, N wing).
Dress has fallbacks if any is missing.
- Ask: please post V2_MAP.md / the landmark list with rects as soon as it exists; I will then re-shoot each landmark in its real place and tune the recipes to your walls and paths (the `keep` rects are how you protect paths and puzzle floors).

2026-11-05 | W -> A | v2 REBUILD: the new Chapter I layout is up. Landmark rects, floors and keep rects are in dev/V2_MAP.md §3
**Where:**
- The map is `dev/shots/v2-map.png`. The source is `scripts/v2/map2.gd` (`Map2.SPACES`, `WALK`, `ROUTE`, `DOORS`, `PIECES`).
- Phase 1 stands BESIDE the live chapter, at `Map2.O = (0, 0, 200)`. It is built only with `EIDOLON_V2=1`, or `--v2` after `--`. Example: `EIDOLON_V2=1 godot --path . res://tests/devshot.tscn -- "begin;jump:waking_pool;tp:3:203;w:3;shot:x"`.
- World = local + O. The table in V2_MAP.md §3 gives WORLD coordinates.
- O goes to 0 in phase 2, when the old world comes out. Keep your positions relative to the rects.

**Dressing:**
- I already call your `Dress.build` for every space that has a recipe. Keep = the play route, 1.6 m wide, plus the doorways and road mouths. This is `Map2.dress`.
- The `skipped` log goes to stdout as `[v2 dress] <space> <piece>: <reason>`.
- Landmark → recipe:

| Space | Recipe |
|---|---|
| I3 | glass_niche |
| I5 | crypt |
| A | atrium |
| W3 | hall_glass |
| W5 | shadow_chamber |
| N2 | turned_ones |
| N3 | votive |
| N7 | mist_maze |
| E1 | balcony |
| E2 | singing_stones |
| E5 | scales |
| I21 | bridge |
| I22 | gate_four |
| I23 | shrine |

**Not yet given a recipe:**

| Recipe | Where it would go | Why it waits |
|---|---|---|
| stair_breath | W1 | stairs |
| hidden_way | IBW / W6 | |
| colossus | WB + W7 | ramp |
| colonnade | N1 | ramp |
| tree_shards | N6 | 3.8 x 2 m nook |
| mirror_walk | E3 | 2 m wide |
| spring | E4 | |
| pool_halves | P / WS | |
| stub_gateway | — | no stub any more; I.1 is a court with its closed door on the north edge |

These are yours to fit as you re-shoot. Tell me the rect you want, or a flat-only variant.

**Please:**
1. **No Beacon pillars in the Atrium.** The script puts the three Beacons in the wings: W on the rock by the Observer's face, N at the Maze's end, E on the High terrace above the Scales. I keep the recipe's three spots clear for now, so they are skipped.
2. **Doors and gates are mine:**
   - the I.1 closed door;
   - the crypt's way out;
   - the Veiled Way gate (Act 3);
   - the Shadow Chamber's gate;
   - the Gate of the Four, in I.22's NORTH edge with the Shrine north of it.

   They stand in kept doorways, so a recipe's own door or gate there is skipped. Leave them out of the recipes, or keep them decorative and off-centre.
3. **Ramps:** the following have a sloped floor: N1 (1 → 0), NS (2 → 0), W1 (stairs 0 → 1), ER (0 → 2), EH (6 → 2), E5u (2 → 6). Dress has one height per rect.
4. **Wax tablets:** in the crypt recipe they float when kit_workbench is skipped (`"on": true` on a missing base). The overlap test caught this. With your kit_workbench now in props/ it should hold; I will re-check.
5. **Two kinds of z-fight report on your side.** The z-fight test (EIDOLON_V2=1, spots on every space) finds no fights BETWEEN meshes. It does report:
   - (a) coplanar faces INSIDE the Tripo meshes: door_temple, gate_veiled, statue_veiled_mourning (tiny slivers, gap 0);
   - (b) every Flame's two coplanar layers (flame.gdshader, transparent).

   If either can flicker, it is yours.

**Moods:** wired. `world.set_mood(Map2.mood_of_region(...))` runs on every new-world region:

| Area | Mood |
|---|---|
| south / hub | act1 |
| west | w_glass |
| north | n_garden |
| east | e_high |
| Act 3 | act3 |
- (W, later the same day) the crypt recipe in its real rect (x 10..14.6, z 199..207, y 0): the overlap test finds kit_workbench and the toppled kit_face5 (small) interpenetrating by 4 cm at (12.63, 0.32, 199.84). The crypt is left undressed in the block-out until that is fixed; tell me and I switch it back on (`Map2.SPACES` I5).

2026-11-05 | W -> A | v2 phase 2: Act 1 now lives in the new world. One visual bug that looks like it is on your side.
**Act 1 in the new world.** The new world is the game now (`Map2.enabled` defaults to true; `EIDOLON_V2=0` turns it off). Act 1 is played in its own spaces:
- I.1 plate court, with the temple door that sinks.
- I.2 bell.
- I.3 glass road: the pane stands in front of your glass_niche pylon, and the low gate is across the road.
- I.4 stream crossing.
- I.5 crypt: four piers, the vault, the basin and the lamp.
- I.6 Atrium fountain gaze.

The prologue plays on the Pool of Halves' east shore. Shots are in dev/shots/v2p2-*.png; the contact sheet is v2p2-sheet.png.

**BUG (please look): a crimson screen-aligned block beside her at the pool's edge.**
- **Where it shows:** wherever she stands right at a pool's east lip, a solid crimson rectangle hangs beside her, from her feet up to her head height, with a vertical right edge and a flat bottom.
- **Shots:** v2p2-c-shore.png, v2p2-d-warden.png, and dev/shots/v2p3-s1/s2/s4.png from the old pool.
- **Since when:** it was faint pink in v1.1d (git ea19fa1 dev/shots/smoke-waking_pool.png). Since your 7c5bb58 it is strong crimson.
- **What I found:**
  - Hiding the pool Reflector's puppet (`reflector.puppet.visible = false`, process off) removes it.
  - The puppet is the `wanderer_ghost` heroine_v1 rig mesh, on LAYER_MAIN_FX.
  - The block draws OVER the floor slab, so it is not the projected reflection; that one is clipped to the water and depth-tested at the water plane.
  - My guess: a next pass or a red tint on the rig's ghost material: the x-ray (`figure_xray` / `wanderer_xray`, inverted depth) or `her_tint`, drawing where the floor hides the sunk puppet.
- **Why it matters now:** the prologue's opening shots stand her exactly there.

**The crypt recipe.** It is still off (kit_workbench overlapping the toppled kit_face5 by 4 cm). The crypt now has four corner piers and a vault, so please fit the recipe to: rect x 10..14.6, z 199..207, y 0. Keep:
- the door way z 202..204 on its west edge (x 10);
- the slab way z 202.75..203.75 on its east edge (x 14.6);
- the basin at (13.5, 201.4), r 0.5;
- the lamp's rim and her approach, x 12.3..13.9, z 200.9..203.

2026-11-05 | A -> W | v2 world: Dress fitted to V2_MAP (in place), the crypt fixed, ramps, the internal z-fights, the Flame layers
All shot IN PLACE in the v2 world (EIDOLON_V2=1, the real camera, standing in each space): dev/shots/v2-inplace-1.png .. v2-inplace-4.png (every Map2 space, in route order). Your tests, run by me with EIDOLON_V2=1 and the proposed recipes below built too (dev_fx/overlap_v2_proposed.tscn and framing_v2_proposed.tscn: your tests, subclassed, with my extras built first):
- **Occlusion: PASS.** V2 WORLD: the whole way is in sight (581 points).
- **Overlap: no hits on my side.** The 2 remaining hits are yours (both "FLOATS"): `CryptRoof` at (12.30, 2.75, 203.00), and `n1024/mi1025` at (7.45, 1.92, 213.70).
- **Draw calls in view:** 26-85 per space (game camera, High; the crypt is the 85).

**1. Dress changes (scripts/fx/dress.gd; your `Map2.dress` call is unchanged):**
- **Atrium:** the Beacon pillars are gone from the recipe.
- **Crypt fixed:** the toppled face moved off the bench, and pieces now also test against each other. A shared box registry spans all landmarks, because N2 holds N3; that was the one overlap your test found after the fix. The wax tablets and the bench flame ride on the bench wherever it lands (`"on"` follows its base's final spot). **Please switch I5 back on (`crypt`).**
- **Ramps (the rule):** each piece stands on the walk-region height under it (`level.region_at`). If its footprint spans more than 3 cm of height (a ramp or a stair), it is left out, never tilted. Terraces and landings at any height are fine. So N1, NS, ER, EH and E5u take no pieces on their slopes; W1 takes them only on its flat landings.
- **Placement search:** a piece whose recipe spot is taken (your route, a wall, another piece) takes the nearest free spot within 2 m. Before, it was simply skipped, which emptied I3 and half the Atrium.
- **View rules, enforced in the search:**
  - A tall piece (over 1.6 m) stays in the back of the view: the north 45% or the east 45% of the landmark.
  - No piece over 0.6 m may hide any point of a kept path from the camera (a ray test against the route, at 0.25 m and 1 m height). This is the same check as your framing test, run at placement time.

**2. The unplaced recipes, fitted to their real rects.** The recipe for each is retuned in dress.gd. Please add these to `Map2.SPACES`:

| space | recipe | result in place |
|---|---|---|
| I5 | crypt | 9 pieces (cot, bench + tablets + flame, unfinished statue, faces, urns) |
| W1 | stair_breath | 5 on the flat landings, east strip (column, glass, praying figure, stump) |
| IBW | hidden_way | 3 (glass, rubble, plant). Use it on the Ash Landing: W6 itself (4 x 2 m) is all route |
| WB | colossus | 2 (stump, fragment) in the rock's free strips (the head is yours) |
| N6 | tree_shards | 2 (plant, bust) in the nook's free strip |
| E4 | spring | 2 (urn, plant) |
| P | pool_halves | 5 (two kneeling figures, stump, fragment, rubble) on the strips beside the halves' road |
| N1 | colonnade | 0: the whole rect is ramp + route. Give me a flat ledge beside the ramp (e.g. 1 m either side at its low end) and the columns stand there |
| E3 | mirror_walk | 0: 2 m wide and all route. Leave it undressed (its glass is yours) |

- `stub_gateway`: unused now, kept in the file.
- `mist` / `petals` / `veils` go with their recipes, as before.

**3. Z-fights:**
- **(a) Inside the Tripo meshes** (`dev_rig/tools/glb_coplanar.py`, new): it finds same-plane, same-facing, overlapping triangle pairs inside a GLB (your zfight criterion, in model space) and drops the smaller sliver. Only the index buffers change; backups are in my scratch. Results:
  - door_temple: 33 dropped;
  - gate_veiled: 4 dropped;
  - statue_veiled_mourning: 1 dropped;
  - the same scan found and cleaned 16 more: altar, archway, balustrade, column_fallen, awning_post, bridge_end, dead_plant, face4, fountain, gallery, votive, windbells, workbench, temple_small, wall_ashlar_window, wall_ruin_low.

  Your zfight at the I.22 gate, I1 door, N2 and crypt spots: 0 on these meshes now.
- **The one pair left:** `V2Door_gate_veiled_2` at (-2.34, 0.79, 207.95). It is two ADJACENT slivers of one fan (triangles 3289 / 3290, 1.3 cm tall and 0.75 m long) sharing an edge, with the third vertices on opposite sides. They do not actually overlap, so it cannot flicker; the 1 mm shrink is not enough for triangles that thin. Whitelist it, or tell me and I will drop the fan (that leaves a 1.3 cm strip open on a ledge top).
- **(b) The Flame's two layers:** the core layer now stands 2 cm toward the camera (scripts/flame.gd), so your zfight reports 0 for every flame.
- **Not mine** (for your list):
  - water.gdshader | mirror.gdshader coplanar at (15.8, -0.55, 203.85): the crypt basin's water and its mirror plane;
  - pickup_glow | StandardMaterial transparent pairs at (13.3, 0.63, 201.5): the lamp's pickup glow over its own disc.

2026-11-05 | A -> W2 | P1 crimson block at the pool lip FIXED; the Observer made a veiled head (Dress.observer, needs your 2 lines); imports; marble budget
Shots (real game, real prologue framing): dev/shots/v2-p1-lip-before-after.png, dev/shots/v2-observer-before-after.png.

**1. P1, the crimson block beside her at the pool's east lip: fixed (shaders/wanderer_ghost.gdshader, ghost.gdshader; live, nothing to call).**
- **The cause:** the pool reflection's puppet. Her body's reflection (wanderer_ghost) had none of the in-water treatment her veil's has (ghost.gdshader since v1.1c). Right below her at the lip, the sunlit crimson hem of the reflected dress was cut flat by the pool's edge: a hard crimson slab beside her feet. It was stronger since the v1.1→v2 brighter crimson grade.
- **The fix:** on water (`ripple_amt > 0.5`), her body's reflection now breaks into the same drifting ripple bands as her veil's, and dissolves (dither) over the last 30 cm before the pool's edge. The same edge dissolve is on the veil.
- **Still red:** the reflection keeps its red ("wears red", §5 shot 4), just no slab at the lip.
- **Mirrors are unchanged** (`project` without ripples).

**2. The Observer: Dress.observer (scripts/fx/dress.gd).** It uses a new Tripo model, `observer_veiled.glb` (30 credits; balance 325): a colossal figure under a wet veil. Sunk to its head and shoulders, it reads from behind as a giant VEILED head:
- long cloth folds down its back (observer_veil.gdshader: cool cloth, deep folds, soaked dark toward the water);
- a crimson rim from behind through the fog (observer_rim.gdshader: a second pass, alpha-blended, fog-free).

It is one MeshInstance with its own material, not marble. Your 2 lines in `Map2.pieces` (in its PIECES loop, before `Props._mesh`):
```gdscript
if str(e[0]) == "colossus_head_veiled":
	Dress.observer(parent, w(e[1], e[3], -0.42), 135.0, 22.0, -0.42 + O.y, 0.7)      # face away from the prologue camera (NE): we see the back of the veil
	continue
```
- Shot from your prologue camera as it is (`cam(0.0, 0.01, HEAD + Vector3(-3.0, 3.5, 4.0), ...)`): it fills the frame's middle; see the sheet. If you want more of the black water around it, `size * 1.5` there.
- `yaw` 135 turns its face away from that camera. W.7's stones pass beside it, and the ending turns it toward land: tween the node's yaw (it is the returned MeshInstance3D).

**3. Imports:** every GLB of mine is at `embedded_image_handling=0`: the 4 kit pieces, the comb and observer_veiled. None carries textures anyway (marble or wood placeholder).

**4. Marble budget:** a Dress landmark is now ONE marble MeshInstance (its small dressing is merged into it; it was 2). The see-through slot uses marble_occ, plus glass panes and contact shadows.

**5. FX polish (beacons, the PassThrough shard, the Shrine):** waiting on your wing / Act 3 ports. Tell me in HANDOFF when W3 (Hall), the beacon terraces and I23 are in, and I re-shoot and polish them in place.

2026-11-05 | A -> W2, coordinator | GLB textures: `embedded_image_handling` audit (0 = DISCARD ALL TEXTURES)
- **The comb: fixed, 0 -> 3 (Embed as Uncompressed).** It is the one 0-set GLB the game draws with its OWN material (prologue shot 10, the satchel), so it had lost its scallop texture. Its texture is already 256 px.
  - pck +82 KB: 28,115,636 -> 28,197,956 bytes (real Web preset).
  - Web build: 0 console errors, both booting the real export and in a dev export that loads the comb and fires every v2 effect.
  - Shots: dev/shots/v2-comb-texture-before-after.png.
- **door_temple, gate_veiled, the braziers, the six statues, colossus_head_veiled: keep them at 0.** The game never draws their GLB materials: every one goes through `Props._mesh`, which re-bakes the geometry with the marble vertex colours and draws it with `marble_mat` (the doors through `Map2._occ_copy` of that mesh, the braziers through `Props._mesh("brazier")`). So 0 loses nothing on screen.
  - Measured with all of them at 3, in game: identical frames (dev/shots/v2-glb-textures.png: the I.22 gate + statues, the I.1 door, the W beacon brazier, 0 vs 3).
  - The pck grows from 28.2 MB to 76.5 MB (+48 MB) for nothing.
  - If any of them is ever drawn with its own material, set that one to 3 and downscale its maps to 512 first.
- heroine_rigged / heroine_v1_rigged / wanderer_rigged stay at 0 by design: their JPEG maps are loaded separately (heroine_rig.gd).
- My other GLBs (the 4 kit pieces, observer_veiled) carry no textures: 0 is right.
- The items at 1 (Extract) are fine on the web: their extracted PNGs live in assets/models/items/, which the export does not exclude (only props/*.png / *.jpg are excluded).

2026-11-05 | W2 -> A | v2 phase 3: the three wings are in the new world (the Hall W3 and the beacon terraces are in; the Shrine I23 comes with phase 4)
**What moved where.** Every v1 wing room is its v1 geometry, unchanged in its numbers, drawn at a module offset (`scripts/v2/wings_geo.gd` through `scripts/v2/lv_off.gd`; offsets in `Map2`: `GW` Stair/Offering/Hall, `GG` Shadow Chamber, `GN` Turned Ones/Our Steps/Court/Tree/Maze, `GE` Singing Stones/Veil Stair/Mirror Walk/Spring/Scales, `GX` the Eidolon Plate up on EB). The old world's wing rooms are no longer built; the old Atrium, pool and Act 3 still stand until phase 4.
- **Beacons:** each is the Tripo `brazier` of `Map2.PIECES` (WB, NB, EB) with your `BeaconFire` in its bowl (hub.gd). No Atrium twins.
- **The Shard:** the Hall's solve now calls `PassThrough.mirror(chapter, Map2.GW + (-1.9, 2.0, -20.46), BACK, shard, 1.6, true)`; it rests before the glass.
- **The Observer:** wired as you asked (`Dress.observer(parent, w(x, z, -0.42), 135, 22, -0.42 + O.y, 0.7)` in `Map2.pieces`). Your crimson-slab fix in wanderer_ghost is in this phase's build.
- **New pieces of mine you will see:** W.7 stepping drums (`Map2.W7_STONES`), N.1 hidden stones + 4 broken shafts in a shallow sheet of water (`Map2.N1_STONES`, water y 0), bars across the Scales' way up (E5u foot) and across the High Stair's head (EB west edge), a lens-only stone roof + star over W.4.
**Please:**
1. **Keep rects grew.** `Map2.KEEP_EXTRA` now keeps the wings' puzzle floors whole (Hall, Chamber, Turned Ones + her glass, Our Steps, Court, Maze, the stones row of E2, Scales, EB): the puzzles need every cell. Your recipes `hall_glass`, `shadow_chamber`, `turned_ones`, `mist_maze`, `scales`, `singing_stones` lose their interior pieces; please refit them to the rooms' edges (the `[v2 dress]` log lists what is skipped). I removed my v1 column at E2's south-east corner (it met a `singing_stones` piece).
2. **A star glyph** for `lens_only.gdshader` (W.4: "a star carved in a ceiling that is not in your world"). I use `design 5` (the four-pointed fallback) on a 1.7 m quad over a stone-roof quad (kind 1). An eight-pointed star as `design 9` would read better; tell me and I switch.
3. **The satchel map** (`scripts/fx/map_view.gd`) still draws the old world. The new world's regions are `V2_<space>` plus the v1 names, mapped by `Map2.V1_KEY` / `Map2.key_of_region()`.
4. **N.1's water** (y 0, rect local x -0.5..5.5, z -15..-9) reads as pale floor through the fog; the script wants murky water with the stones 5 cm under it, all alike.

2026-11-06 | A -> W2 / W3 | phase 3 in place: wing recipes refit, the W.4 star, N.1 water, the Shard through the mirror, the Beacons
Shots (v2 world, real camera, before | after): dev/shots/v2-p3-fx.png, dev/shots/v2-p3-wings.png.
- **Tests, run by me with EIDOLON_V2=1 on this build: all pass.** OVERLAP PASS (0 hits) | OCCLUSION PASS (the whole way in sight, 593 points) | zfight 0 at N.1 and W.4.

**1. Wing recipes refit (scripts/fx/dress.gd, live through your `Map2.dress`).** With the puzzle floors kept whole, W3, W4, W5, N3, N4, N5, N7 and E5 have no free floor at all (a 25 cm map of every space: `dev_fx/free_map.tscn`). So:
- **hall_glass, shadow_chamber, scales:** nothing stands in them (their identity is your puzzle pieces).
- **mist_maze:** mist and petals only.
- **votive:** N.3 is all kept, so the votive niche and its two flames moved into N.2's free south-west corner.
- **turned_ones:** low pieces in that corner.
- **singing_stones:** the bells stand in E.2's free south-east corner, low pieces on the west strip.
- **balcony:** urns, the bench and plants on the west strip. Its veil posts are skipped: on the west strip they would hide the route.
- **Pieces may not hide an interact point now.** The Dress hide test also covers `level.interacts`: the N.2 votive was hiding the garden tablet `tab_t5`.
- **Skip messages say why at the asked spot** ("…(no free spot within 2 m)").

**2. The W.4 star:** a new `kind 3` in lens_only.gdshader, an eight-pointed star carved in her ceiling. The {8/2} star, rays, a ring, sixteen studs; the cuts burn rose-white in crimson, the body glows, light runs outward along the cuts. Your one change in `chapter.gd _build_star`:
```gdscript
star_mat.set_shader_parameter("kind", 3.0)          # (and drop the "design" line)
```

**3. N.1's water:** `WaterLook.flooded_n1(parent)` (scripts/fx/water_look.gd).
- Murky green-grey water, ripples and glints, a drifting foam edge.
- The stones 5 cm under it show as soft paler blocks wavering in the ripples. The true ones (`Map2.N1_STONES`) and five false ones (`WaterLook.N1_FALSE`, clear of your shafts and the ramp) are ALIKE, so her reflection is the only guide.
- water.gdshader gained `sub[]`, `n_sub`, `sub_k`, `sub_c`.

Your one line in main.gd, right after `Map2.water(level, level)`:
```gdscript
WaterLook.flooded_n1(level)
```

**4. The Shard through the great mirror.** `PassThrough.mirror` now opens with a flash (a rose-white bloom with a four-point flare, 0.9 s; omen_fx kind 6 FLASH), then the crack spreads and the sparks fly. **Please move the spot:** from the Hall's camera, `GW + (-1.9, 2.0, -20.46)` is hidden behind the near column. `GW + (0.6, 2.5, -20.46)` is in clear sight (the shot uses it):
```gdscript
PassThrough.mirror(chapter, Map2.GW + Vector3(0.6, 2.5, -20.46), Vector3.BACK, shard, 1.6, true)
```

**5. The Beacons (live, nothing to call):** an ignition now also runs a crimson ring of light out over the stone from the bowl (6 m). Shot at all three in place (W rock, N maze end, E terrace).

**Waiting on:**
- W3 posting that the Act 3 spaces and the Shrine (I23) are in: then I polish the Shrine finale (ΒΡΕΣ ΜΕ, the eye) and the bridge / Gate in place.
- The satchel map (scripts/fx/map_view.gd) for the new world: next on my list. I will re-draw it from `tests/map2_dump.gd` with `Map2.key_of_region()` names.

2026-11-06 | A -> W3 | the satchel map is the NEW Chapter I (live); please drop the old seal icons
Shot (in game, EIDOLON_V2=1): dev/shots/v2-satchel-map.png (explored so far | all, three Beacons lit).
- **Map textures:** assets/textures/map/* are now drawn from the v2 world by `dev_rig/tools/make_map2.py` (same parchment and ink as v1). The layout comes from `dev_rig/tools/map2_layout.tscn`, which dumps every walk region with its Map2 space, the spaces, the water, the Beacons and the Observer.
  - Regenerate after a layout change: `EIDOLON_V2=1 godot --headless --path . res://dev_rig/tools/map2_layout.tscn | grep ^MAP2LAYOUT | cut -c12- > layout2.json; python3 dev_rig/tools/make_map2.py layout2.json assets/textures/map`.
  - The v1 textures are backed up in my scratch.
- **What it shows:** the three wings as titled districts, the Atrium, the Waking Pool, each beat's name, stairs hatched, every water sheet waved, the Observer drawn in the inlet, and each Beacon as a brazier.
  - Labels never overlap; the in-between spaces carry no label.
  - Everything is revealed region by region, as before. Your `see_region` keeps working: the region names are the level's walk regions (V2_<space> and the wings' v1 room names). `reveal_area()` now takes a Map2 space id ("W3").
- **Lit Beacons on the map:** `map.set_beacon("W" | "N" | "E", lit)` (MapView). A lit Beacon's brazier is inked crimson with a slow crimson glow, shown only once its space is revealed.
- **Please, in scripts/satchel.gd:**
  - `_build` (≈ line 108): drop the `seal_marks` loop (the old veil_seal icons; one is drawn as a crimson blob over the new brazier).
  - `open_map` (≈ line 275): in place of its `for k in seal_marks` block,
```gdscript
for k in Hub.BEACON_POS: map.set_beacon(k, k in (game.chapter.state.get("beacons", []) as Array))
```
- Still waiting on your Act 3 post (I21 bridge, I22 Gate, I23 Shrine) to polish the bridge, the Gate and the Shrine finale in place.

2026-11-06 | W3 -> A | v2 phase 4: Act 3 and the First Shrine are IN, in the new world; the old world is gone; O = 0. Please polish in place.
**Where (world = local now, `Map2.O` is zero):** the Veiled Way (VW, x -4..-1, z 8..15), the Pool of Halves (P, its grid at `Map2.GP`, rims `Pr` z 15..17 and 20.7..22), the far shore (PW), I.21 the bridge (x -40..-16.15, z 17.6..20.1), I.22 the Gate of the Four (x -50..-40, z 13..24), I.23 the First Shrine (x -51..-39, z 3..13; pool centre `Map2.SHRINE_POOL` = (-45, 0.155, 7.0), she kneels at `Map2.SHRINE_STAND` (-45, 0, 8.6)). All in `dev/V2_MAP.md` §5c and `dev/shots/v2-map.png`. Shots: `dev/shots/p4-*.png`, sheet `p4-sheet.png`.
**Your hooks are wired:** the W.4 star (`kind` 3), `WaterLook.flooded_n1(level)` after `Map2.water`, the Shard's PassThrough at `GW + (0.6, 2.5, -20.46)`, and the satchel map (seal overlay gone; `map.set_beacon(k, lit)` for W/N/E on open). I re-ran your `map2_layout` + `make_map2.py` after my layout changes (the pool's rims, the far shore, the crypt's low west wall): assets/textures/map/* regenerated. `Map2.map_spaces()` gives every space as [id, beat, name, kind, Rect2, floor y, part] if you need it.
**What is mine in Act 3 (scripts/v2/act3.gd, chapter.gd), for you to dress round / polish:**
1. **The pool's fog** (until the 3 Beacons): `OmenFx.murk(pool_water, 0.85)` + three `FxBurst.mist(.., 2.4)` over the water; the four stones sunk 1.15 m. On the third fire: fog lifts (murk 0 over 4 s, mists stop), the stones rise with my heavy rise (`chapter._rise`: your `juice.stone_rises` + my tween). **The mist reads weak in-game** (p4-a-fog.png: the water just looks pale): if you want a proper fog bank there, give me a call and I swap it in.
2. **I.21:** 12 spans (one zone mesh), span 6 a node (`Act3/BridgeLurch`) that drops 14 cm, three parapet pieces (`Act3/BridgeFall2/8/10`) that fall into the sea (I call `FxBurst.splash` + `juice.ring` where they land). Your `bridge` recipe dresses round it.
3. **I.22:** three Tripo veiled ones on 1 m marble plinths (`Map2.PIECES` / `FOUR_PLINTHS`), the empty fourth with a ring (ring.gdshader) and a rune on each plinth's south face; the gate is `Map2.door_nodes[3]` (it sinks 4.2 m over 3.4 s on the solve).
4. **I.23:** a worn disc (r 3.2), the brimming round pool (rim r 1.3), a ruined ring of four columns (open south; your altar holds the north), the crystal / ring / pillar / light from puzzles.gd at `Map2.SHRINE_C`. **The cinematic** keeps the one fixed view (yaw -45, pitch 36: the owner's no-turning rule, as in the prologue) and centres on the pool; `OmenFx.write_in_water(self, POOL_C, cam_yaw, "ΒΡΕΣ ΜΕ", 4.2, 0.4, 3.2)` at P+23, `OmenFx.glass_eye(self, POOL_C + (0, -0.01, -0.1), 1.3, 1.1, 2.4, cam_yaw)` at P+29.6 (both get the live camera's yaw). At pitch 36 the writing is foreshortened (sin 36 = 0.59): if it wants larger letters, tell me the size.
**Please:**
1. **`pool_halves` recipe is OFF** (`Map2.SPACES` P): its pieces stood on my new rims, which are the only places to turn stones 3 and 4 from (overlap: on Pr's centreline, into the rim's rail). The P rect is now x -12.75..-4, z 15..22 (rims included); keep the rims' middle 1.2 m clear. Tell me and I switch it back on.
2. **The gate_four pylon** (your `pylon_ashlar` at fx 0.92) touches the gate wall's east end by 7 cm: whitelisted in my overlap test as designed (it reads as built against it); move it 10 cm east if you prefer it clean.
3. **The `colonnade` recipe's occ#1 column floats** over N.1's water (180 cm over its support, at (4.78, 2.3, -10.45)); I whitelisted N.1's water volume (its shafts stand in the murk). Please check it stands on something.
4. **WorldGeo is deleted.** `dev_fx/kit_ingame.gd` and `dev_fx/v2_fx_ingame.gd` still name `WorldGeo.WOOD` / `WorldGeo.A_Y`: use `Props.WOOD` and 0.0.

2026-11-06 | W3 -> A | v2 phase 5 (story): the prologue checked shot by shot in real time; two looks for you
Shots (real time, 390x844): dev/shots/p5-01..p5-12.png (one per §5 shot), sheet p5-prologue-sheet.png; after my fixes p5-fix-sheet.png.
- Mine, done: shot 1 widened to `size * 1.5`; the camera settles on her lying by 7.2 s (2 s before she rises); no area title over a cinematic any more; after the prologue the pool's road marks no longer pop back into the fogged water.
- **Yours, please:** (1) shot 1 asks for BLACK water round the Observer: the inlet and the pool read pale grey-white at the prologue's opening (p5-01.png); (2) the pool's fog after the prologue (p5-12.png, p5-13-play.png) is a soft grey wash: if a low fog bank would read better, it is `Act3._fog()` (three `FxBurst.mist` + `OmenFx.murk` 0.85): tell me what to call.
- Text per the script: the intro cards already match §5 word for word; the I.5 tablet and the I.23 memory are the script's. Chapter I no longer names Milos (it is Kythira in m1 and the shadow chamber's lore); the shadow chamber's memory no longer tells of the stolen mirror (Chapter IV's): "He hid every mirror in the house. / She found her face in a cup of still water."

2026-11-06 | W4 -> A | W4 takes over from W3 (phase 6: feel, polish, QA). I see your Act 3 hooks in progress; I wire them as soon as you post.
- **I will wire, when you post "ready" here** (from your act3_probe `_apply_hooks` / comments): `FogBank.make(act3, pool rect, water y)` in place of my three `FxBurst.mist` + murk 0.85 (I keep a light murk under it if you say so, `lift(4.5)` on the third fire, `set_on(false)` on a loaded open pool); `OmenFx.rune_wake` per Gate plinth rune as it lights; `OmenFx.gate_sink` for the Gate of the Four AND the Veiled Way gate as they sink; `FxBurst.crumble` where you want it (bridge spans?); `Dress.beyond_colossus(level.beyond, at, h, yaw)` in place of the primitive statue in `Level._beyond`. Tell me the `at` / height / yaw you want for the colossus; I own the shot's camera (`chapter.hand_in_the_water`, `c.cam(P + 49.0, ...)`) and will frame the second shrine's pillar with it.
- **Flicker sweep (done, mine):** balustrade posts shared where two rails meet; rail / coping / base of a z-running balustrade 7 mm above an x-running one; kerb ends that butt into another space stop a few mm short; underside cones and wall cornices jittered; a few v1 wing slabs trimmed. zfight over every space centre + W3's spots now finds only YOURS:
  - `Dress_atrium/Dress_main`: two pieces' tops coplanar at y 0.9, at (5.87, 0.9, -7.14) and (9.03, 0.9, 1.3);
  - `Dress_balcony/Dress_main`: a sliver at (17.55, 2.29, -6.29);
  - `Props/Prop_statue_veiled_mourning_1`: internal, at (-18.94, 1.15, -15.42) (the GLB itself; ignore if invisible).
- Six Scales rods stood at the world origin (the Atrium's centre, 0.5 m up) until the Scales first posed them: hidden now until posed (in case you saw a thin post in Atrium shots).

2026-11-06 | W4 -> A | phase 6: your committed Act 3 hooks are WIRED (as your act3_probe applies them); the "beyond" re-framed; asks
Shots (real game, 390x844, the cinematic frozen at exact times): dev/shots/w4-cine-27.5.png (writing), -33.5 (eye), -50.0 (memory, now before the last look), -58.5 (the beyond); every space: dev/shots/w4-qa-01..19-*.png.
- **Wired:**
  - `FogBank.make(act3, Map2.WATER[0] rect, -0.42)` over the Pool of Halves in place of my mists, faded in over 3 s via `fog._set_k` (please give me a public `fade_in(seconds)` and I switch), murk 0.4 under it (your probe's), `lift(4.5)` on the third fire, freed during the prologue and on a loaded open pool.
  - `OmenFx.gate_sink`: the Gate of the Four (`dp, RIGHT, 3.7, 3.4, FORWARD`) AND the Veiled Way gate (`dp, RIGHT, 3.0, 3.2`, beyond = the side away from her), plus a `juice.ring` 5 m at the Veiled Way's foot.
  - `OmenFx.rune_wake(chapter, rune pos, BACK, 0.7)` as each Gate rune lights in the hold; `FxBurst.crumble` off both edges of the lurching span (1.3) and where each parapet piece breaks (0.6).
  - `Dress.beyond_colossus(level.beyond, at, 18.0, -30.0)` in place of the primitive statue. `at` is placed BY SCREEN (`Level.BEYOND_COLOSSUS` = [screen right of the second shrine 4.2 m, screen up 1.5 m, foot on the cloud line y -6, height 18, yaw -30]): tune those five numbers freely.
- **What the "pale blob" really was:** (1) `ui.silhouette` of the memory overlay (shown with "The veil was his, not mine." right over the last look; the memory now comes at P+44.5 as her reflection walks away); (2) a `_far_ruins` statue pushed out to just behind the Shrine (removed: your colossus stands in for it); (3) the W.7 Observer, fogged pale, under the camera's slide out and back (hidden from P+48.9 to P+59.3). The last look now slides onto the second shrine (its pillar at full fade) and holds 3 s.
- **Your look, please:** the beyond colossus reads pink-washed in that fog (w4-cine-58.5.png): a touch darker or a cooler cloth at that range would set it apart from the sky; a faint dark parallelogram floats left of its head (a FarestRuins top?).
- **The Atrium's turned head (an open item):** the Atrium's plinth statues are merged into your `Dress_main`. If you can give me ONE of them (a "row ... plinth" bust, say the north row's middle) as its own Node3D (e.g. `Dress_atrium/TurnedHead`, pivot at the neck), I bring back v1's life effect (it turns toward where you came in when you return; Life._update_head).
- **zfight**: as in my last entry, only your three (Dress_atrium x2, Dress_balcony sliver, statue_veiled_mourning internal).

2026-11-07 | A -> W3 | Act 3 polished in place: the pool's fog bank and its lift, the bridge, the Gate, the Shrine, the final image; contacts; WorldGeo
Shots, in place, BEFORE | AFTER (my hooks applied by `dev_fx/act3_probe.tscn --tag=after`, exactly as below): dev/shots/v2-a3-pool-fog.png, dev/shots/v2-a3-bridge-gate.png, dev/shots/v2-a3-shrine.png.
- **Tests:** your overlap test, with my Dress changes: OVERLAP PASS (0 hits).

**1. pool_halves:** refit, and it places nothing. Its recipe now keeps your rims' turning band clear (a recipe can declare its own kept rects now). What is left of the rims is a 0.4 m strip, too thin for any piece. **Leave P's recipe OFF:** the pool's identity is its fog bank (2).

**2. The pool's fog: FogBank (scripts/fx/fog_bank.gd, live class).** A rolling bank lies on the water:
- three stacked sheets of billows, lit on their shoulders and shadowed in their hollows, so it reads as a mass, not a haze;
- low banks standing in the water;
- drifting wisps;
- a slow crimson glow breathing deep in it (something waits there).

**Lift:** a ragged clearing rolls back from her side (east), the billows thin, and a sheen of light runs west over the uncovered water. Then your stones rise. Low tier: one sheet, no standing banks.

In `act3.gd _fog`, in place of your three `FxBurst.mist` and `murk 0.85`:
```gdscript
var fog_bank: FogBank
# on:
if fog_bank == null:
	var e: Array = Map2.WATER[0]
	fog_bank = FogBank.make(self, Map2.wr(e[0], e[1], e[2], e[3]), float(e[4]))
OmenFx.murk(wm, 0.4, 0.01 if instant else 3.0)          # (a lighter murk under it)
# off:
if is_instance_valid(fog_bank):
	if instant: fog_bank.queue_free()
	else: fog_bank.lift(4.5)
fog_bank = null
OmenFx.murk(wm, 0.0, 0.01 if instant else 4.0)
```

**3. I.21 the bridge:** `FxBurst.crumble(parent, pos, strength)` (new). Tumbling marble chunks, grit and a falling grey dust plume, into the sea. Your 2 lines:
- in `_lurch`, after your dust: `for sz in [-1.25, 1.25]: FxBurst.crumble(game.juice, p + Vector3(0, -0.05, sz), 1.3)` (off both edges of the deck; your x ±0.95 is along the bridge, under the deck where the camera cannot see);
- in `_fall`, at its start: `FxBurst.crumble(game.juice, n.global_position + Vector3(0, -0.1, 0), 0.6)`.

**4. I.22 the Gate of the Four:**
- **Each rune as it wakes:** `OmenFx.rune_wake(parent, pos, normal)` gives a rose-white flash with a four-point flare on its face, crimson sparks and twinkles. In `_update_four`, where a plinth's rune turns on (off → on):
```gdscript
OmenFx.rune_wake(self, four_pos(i) + Vector3(0, Map2.PLINTH_H * 0.5, 0.505), Vector3.BACK)
```
- **The sinking:** `OmenFx.gate_sink(...)` keeps grinding dust and grit along the gate's foot as it goes down, and a crimson seam of light spills under it on the far side. In `open_four`, after your tween:
```gdscript
OmenFx.gate_sink(self, dp, Vector3.RIGHT, 3.7, 3.4, Vector3.FORWARD)
```

**5. I.23 the Shrine (live, no call changes):**
- **ΒΡΕΣ ΜΕ:** now drawn upright for the camera. The decal is 1/sin(pitch) deeper, so the letters stand at their true height on screen. The same applies to the eye, which is round on screen now.
- **The eye and the writing:** the eye takes the writing away as it opens (it sinks out in 0.6 s): the two no longer overlap. Before, the eye opened over the letters.

**6. The final image (the "beyond").** The pale blob is NOT the statue. It is `ui.gd`'s `Silhouette`, the 2D memory picture that `show_memory` draws over the view: a pale fill with a crimson outline, exactly what p4-o showed. It stays under the scene however the 3D is changed. Please:
- `ui.show_memory`: drop the silhouette (`silhouette.visible = false`, or remove it): the line alone carries the memory.
- **The camera misses its subject:** at P+54 your `c.cam(P + 49.0, ..., Level.SECOND_SHRINE.lerp(STAND, 0.62) + ...)` puts the second shrine off-screen (screen x -390 of 400 px). The old primitive colossus is off-screen too (x -715). Re-aim it at what you want seen.
- **The colossus:** `Dress.beyond_colossus(parent, foot_on_the_cloud, height, yaw)` (new). The veiled Tripo figure, standing out of the cloud: pale veil folds, a crimson rim from behind carried through the fog. In my shot it stands where your camera looks:
```gdscript
Dress.beyond_colossus(level.beyond, foot, 28.0, -30.0)     # foot: e.g. the ground under screen (0.42, 0.36) of that shot, y -6
```
  It replaces the primitive statue in `Level._beyond` (the `cm` / `cmi` block). The three primitive veiled statues in `_far_ruins` (`sdef`) can be the same call, smaller (8-12 m).
- **The Observer** gets its own lighter fog now (`observer_veil.gdshader`, fog_disabled with its own falloff): a darker veiled mass against the bright fog from afar, not a pale shape.

**7. Overlap contacts: both gone; please remove your 2 whitelist entries.** Dress pieces now need a floor under their whole body, may never stand in water, and keep 8% clear of walls.
- The gate_four pylon no longer fits by the gate wall and is left out.
- N.1's column is not placed. N.1's `colonnade` now places nothing (the rect is ramp and water): switch it off, or give me a dry ledge.

**8. WorldGeo:** `dev_fx/kit_ingame.gd` now uses `Props.WOOD`, `dev_fx/v2_fx_ingame.gd` uses 0.0.

2026-11-06 | W4 -> A, coordinator | phase 6: your 2026-11-07 Act 3 entry is fully wired; the last look re-done; one ask
- **Done, per your entry:** FogBank on the pool (murk 0.4 under it, `lift(4.5)` on the third fire; the stones' rise reads after it: dev/shots/w4-juice-2-fog-lifting.png, -3-pool-turn.png); `FxBurst.crumble` off both deck edges of the lurching span + where each parapet piece breaks; `OmenFx.rune_wake` per rune (your default size now) and `OmenFx.gate_sink` for the Gate and the Veiled Way gate; `Dress.beyond_colossus` in place of the primitive (18 m so its head is never cropped: dev/shots/w4-cine-58.5.png).
- **The memory silhouette:** `ui.show_memory(line, hold, figure := true)`; the First Shrine's memory passes `false` (the line alone over the last look, back at its scripted P+49.5). Other memories keep it.
- **Dressing:** `pool_halves` stays OFF; N.1's `colonnade` recipe is now OFF (`Map2.SPACES` N1). Both overlap whitelist entries (the gate pylon, the N.1 column/shafts) are REMOVED: OVERLAP PASS (0 hits) without them.
- **New (mine): the Gate of the Four was wider than the screen.** From the empty plinth the gate stood 8 m screen-left and two runes were off the 7.5 m frame. The camera now leans (a slide, never a turn) 3 m toward the plinths while she holds, and onto the gate for 5 s as it sinks (`Chapter.four_lean`, main's camera rules, like the Eidolon Plate's focus). dev/shots/w4-juice-7..10-*.png.
- **Ask (A):** the rune flashes still read small and pale on the plinths at play distance (w4-juice-8-runes.png): bolder, please (bigger flare, more crimson in the core).
- Sheet of every space + the cinematic beats + the new juice: dev/shots/w4-final-sheet.png.

2026-11-06 | A -> W4, coordinator | phase 6: bolder Gate runes, the beyond colossus (no pink, no floating shape), FogBank.fade_in, the Atrium's TurnedHead, z-fights
Shots, in the real game (`dev_fx/phase6_probe.tscn`, your wiring as is): dev/shots/a6-runes-before-after.png (your w4-juice-8 | now), a6-runes-sequence.png (the hold, every 0.7 s), a6-beyond.png (your w4-cine-58.5 | my new look only | my look + hook 2 below), a6-beyond-final-full.png, a6-atrium-turnedhead.png (the bust, then turned 70 deg about its neck).
- **Tests:** OVERLAP PASS (0 hits); OCCLUSION PASS (0 of 14 rooms); zfight 0 pairs at all of your spots (5.87,0.9,-7.14), (9.03,0.9,1.3), (17.55,2.29,-6.29), (-18.94,1.15,-15.42), and on 9 m sweeps of the Atrium (also clears a third plinth at (-3.6,0.9,-7.14) and three floor-bust pairs at (6.5,0,-2.2..-3.4)).

**1. The Gate runes (no call change).** `OmenFx.rune_wake` now adds a camera-facing crimson flare with a white-hot core over each rune (new `shaders/rune_flare.gdshader`, drawn over its plinth so the plinth corner and statue never cut it), a burst ring, a crimson ring of light running out over the floor in front, and a double spark spray (High). The size is at least 1.6 m whatever is passed. **Please add `"res://shaders/rune_flare.gdshader"` to the shader list in `main.gd _warm_up_shaders`** (the first rune would hitch on the web otherwise).

**2. The beyond colossus.**
- The pink wash was the scene's warm and crimson light on its cloth. `Dress.beyond_colossus` now gives it its own neutral light (`observer_veil.gdshader` has a new `self_lit` uniform; default 0, so the Observer is unchanged), a cool grey cloth a shade darker than the sky, and a crimson rim only on its outline (`observer_rim.gdshader` has new `rim_pow` / `rim_max` uniforms; the defaults keep the Observer as it was).
- The dark parallelogram is a **FarRuins** capital (`_far_ruins`, the `st.box` on a column around (-43..-57, -19..-34)), seen beside its head. It is in your `level.gd`. The hook below sinks under the cloud any far column whose top is within 9 m of the colossus's centre line on screen. It keeps the RNG sequence. Tested in my snapshot (a6-beyond.png, right panel):
```gdscript
# in _far_ruins, right after `var top := r.randf_range(-3.0, 5.0)`:
		if _behind_colossus(Vector3(p.x, top, p.y)): top -= 16.0        # (not beside the beyond colossus's head)

## the beyond colossus's foot (placed on screen, as in _beyond; use it there too: `var cat := beyond_colossus_at()`)
static func beyond_colossus_at() -> Vector3:
	var cb := Framing.basis()
	var fwd := -cb.z
	var on_screen: Vector3 = SECOND_SHRINE + cb.x * BEYOND_COLOSSUS[0] + cb.y * BEYOND_COLOSSUS[1]
	return on_screen + fwd * ((BEYOND_COLOSSUS[2] - on_screen.y) / fwd.y)

## a far ruin's top that the camera sees beside or behind the colossus: sunk under the cloud
static func _behind_colossus(top: Vector3) -> bool:
	var cb := Framing.basis()
	var d := top - beyond_colossus_at()
	return absf(d.dot(cb.x)) < 9.0 and d.dot(cb.y) > -2.0
```

**3. `FogBank.fade_in(seconds := 3.0) -> Tween`** (public). It gathers from nothing to full. A `lift()` during it takes over from wherever it is. In `act3.gd _fog`, in place of your two `_set_k` lines:
```gdscript
			if not instant: fog.fade_in(3.0)
```

**4. The Atrium's turned head: `Dress_atrium/TurnedHead`.**
- It is the north row's middle bust (the west north row, at (-3.6, 1.26, -7.2)): a Node3D whose origin is the neck pivot, holding child `Bust` (one marble MeshInstance, not merged; one more per-instance slot).
- Its `rotation.y` is free to set (v1's `head.rotation.y = ...` works). It starts at its row yaw (0).
- Use global positions, since its parent is the Dress node:
```gdscript
var head: Node3D = level.find_child("Dress_atrium", true, false).get_node_or_null("TurnedHead")   # (or Dress.own["TurnedHead"] on the Dress)
var yaw0 := head.rotation.y
# on return: head.global_rotation.y = game.level.yaw_to(head.global_position, game.player.position)
```
  Any row can carry one: the recipe option `"head": <index in the row>`.

**5. Z-fights.**
- Atrium: the plinth busts sit 1.5 cm into their plinths' tops, and the floor busts 1.2 cm into the floor.
- statue_veiled_mourning.glb: the last two sliver triangles dropped (8153 -> 8151). The previous file is backed up in my scratchpad.
- Balcony: already 0 pairs.
- **FYI, not mine (seen on the 9 m sweeps):** `V2Door_door_temple_1` vs the hub floor at (9.78, 0, 2.21), `V2Door_gate_veiled_2` vs the hub floor at (-1.37, 0, 7.52) (both have a face exactly at y 0), and a TRANSPARENT pair (a marble mesh and a StandardMaterial quad, 5 mm apart, y 0.6) at (13.5, 0.6, 1.4) under one `@Node3D`.

Tripo: 0 credits used this phase.

2026-11-06 | W4 -> A, coordinator | phase 6 follow-up: your last entry's hooks are in (far-ruins sink, rune_flare warm-up, fog.fade_in, TurnedHead in Life: turns toward her on a return, first time then 1 in 3, only while off-screen); doors 1/2 lifted 3 mm, crypt basin film 1.5 cm over its cap. Smoke PASS, OVERLAP/OCCLUSION PASS, marble 172/256. zfight leaves one: `Dress_balcony/Dress_main` sliver at (17.55, 2.29, -6.29) (1 pair, 1.3 mm; your note said 0: maybe not in the tree yet).
