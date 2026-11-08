class_name Game
extends Node
## EIDOLON's game base (v3: scenes/main3.tscn runs Game3, which builds Chapter I; v2's chapter code is gone).
## Here: the shared systems' fields, the title tap, keyboard input, interaction, the glass close-up's mode, the
## quality tiers and settings, the shader warm-up, the dev / test commands (web: window.ewCmd / ewState).

const SHRINES_TOTAL := 7
const SAVE_PATH := "user://eidolon_world.json"
const MEMORY_LINE := "The veil was his, not mine."          # (EIDOLON_SCRIPT §6 I.23: the shrine's memory)

static var autotest := false

var world: World
var level: Level
var highlight: Highlight
var juice: Juice                  # the physical little moments (dust, grit, sparks, wet stone)
var _fade_on := false
var _fade_off_t := 0.0
var cine: Cinematic
var _skip_hold := false
var _skip_t := 0.0
var player: Player
var sfx: Sfx
var ui: GameUI
var controls: Controls
var mode := "boot"           # boot, title, play, cine, glass
var focus: Level.Interact
var auto_target := Vector3.INF
var key_vec := Vector2.ZERO
var save_data := {}
var interactions := 0
var _save_t := 0.0
var _last_saved_pos := Vector3.INF
var _js_cb: JavaScriptObject
var _js_t := 0.0
var _keys := {}
var _world_block_t := 0.0
var prof_on := false
var prof := {}
var prof_max := {}                 # the worst single frame per section (us)

## (v3) the systems every game sets up after its world is built: the settings and the tier, the web's pixel
## ratio, the quality button, the shared shader warm-up (no compile hitch the first time a room is seen)
func _setup_common() -> void:
	ui.quality_pressed.connect(func() -> void: set_quality({"auto": "high", "high": "low", "low": "auto"}[world.tier], true))
	_load_settings()
	if OS.has_feature("web"):
		var r = JavaScriptBridge.eval("window.devicePixelRatio || 1")
		if r is float or r is int:
			world.dpr = float(r)
			world.set_tier(world.tier, world.auto_step)
		var q = JavaScriptBridge.eval("String(location.search)")
		if q is String and "perf" in q: _perf_hud(true)
	_warm_up_shaders.call_deferred()

## (profiling, devshot "prof") the time of one section of the frame
func _pm(label: String, t0: int) -> int:
	var now := Time.get_ticks_usec()
	prof[label] = prof.get(label, 0) + (now - t0)
	prof_max[label] = maxi(int(prof_max.get(label, 0)), now - t0)
	return now

# ------------------------------------------------------------------ flow (Game3 fills these in)
func begin(fresh := false) -> void:
	if mode != "title": return
	sfx.start_music()
	ui.hide_title()
	controls.reset()
	if fresh or save_data.is_empty():
		_start_wake()
	else:
		_continue_from_save()

## New Game (confirmed on the title): forget all progress, keep the settings, start again
func _on_anew() -> void:
	save_data = {}
	_delete_save()
	reset_progress()
	begin(true)

func reset_progress() -> void: pass
func _start_wake() -> void: pass
func _continue_from_save() -> void: pass
func _save() -> void: pass
func _delete_save() -> void: pass
func state_dict() -> Dictionary: return {}

func _input(e: InputEvent) -> void:
	if mode == "title":
		var tap := false
		if e is InputEventScreenTouch and e.pressed and not ui.over_anew(e.position): tap = true
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT and not ui.over_anew(e.position): tap = true
		if e is InputEventKey and e.pressed and not e.echo and e.keycode in [KEY_SPACE, KEY_ENTER, KEY_E]: tap = true
		if tap and not (ui.confirm.visible or ui.credits_panel.visible): begin()
		return
	if mode == "glass":
		if e is InputEventKey and e.pressed and not e.echo and e.keycode in [KEY_ESCAPE, KEY_Q]: ui.glass_talk.close()
		return
	if mode == "cine":
		if e is InputEventScreenTouch or (e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT): _skip_hold = e.pressed
		if e is InputEventKey and not e.echo and e.keycode in [KEY_SPACE, KEY_ENTER, KEY_E, KEY_ESCAPE]: _skip_hold = e.pressed
		return
	if _world_block_t > 0.0 and not (e is InputEventKey and not e.pressed): return
	if e is InputEventKey and not e.echo:
		_keys[e.keycode] = e.pressed
		if e.pressed and e.keycode in [KEY_E, KEY_SPACE, KEY_ENTER]: try_interact()

func _key_vector() -> Vector2:
	var v := Vector2.ZERO
	if _keys.get(KEY_W, false) or _keys.get(KEY_UP, false): v.y -= 1.0
	if _keys.get(KEY_S, false) or _keys.get(KEY_DOWN, false): v.y += 1.0
	if _keys.get(KEY_A, false) or _keys.get(KEY_LEFT, false): v.x -= 1.0
	if _keys.get(KEY_D, false) or _keys.get(KEY_RIGHT, false): v.x += 1.0
	return v.normalized()

func try_interact() -> bool:
	if mode != "play" or focus == null or _world_block_t > 0.0: return false
	interactions += 1
	player.interact_pulse()
	focus.action.call()
	return true

## a puff of dust at her heel (a footfall on stone)
func player_dust() -> void:
	if world: world.dust_puff(player.position + player.fig.basis * Vector3(0.09 * (1 if randf() < 0.5 else -1), 0.02, -0.12))

# ------------------------------------------------------------------ the glass close-up (Game3 opens it with its pane)
func open_glass(id: String) -> void:
	if mode != "play": return
	mode = "glass"
	player.input_dir = Vector2.ZERO
	auto_target = Vector3.INF
	key_vec = Vector2.ZERO
	controls.enabled = false
	controls.reset()
	controls.show_interact("")
	ui.hide_text()
	if id == "first":
		ui.glass_talk.open({"id": id, "first": "", "question": "line", "at_q": Vector2(0.0, 0.0)})      # (I.3: one line)
	else:
		ui.glass_talk.open({"id": id, "first": "follow", "question": "together_half"})

func _glass_sound(n: String) -> void:
	match n:
		"breath": sfx.cue("breath")
		"writing": sfx.play("glass_tink", -24.0, 0.8)
		"chime":
			sfx.play("chime", -14.0, 1.0)
			sfx.motif(-10.0)                 # her answer rings with her song
		"wrong": sfx.play("glass_tink", -16.0, 0.53)        # a low, slightly sour glass tone

func _glass_closed() -> void:
	if mode != "glass": return
	mode = "play"
	controls.enabled = true
	controls.block(250)                # the closing tap never reaches the world
	_world_block_t = 0.25

# ------------------------------------------------------------------ quality
const SETTINGS_PATH := "user://eidolon_settings.json"
var quality_auto_dropped := false     # tests / harness: freeze the auto tier where it is
var _aq_t := 0.0
var _aq_frames := 0
var _aq_time := 0.0

## tier: "high" | "auto" | "low" (a bool is accepted: true = high, false = low)
func set_quality(t: Variant, save := false) -> void:
	var tier: String = t if t is String else ("high" if t else "low")
	world.set_tier(tier)
	_apply_tier_extras()
	ui.set_quality_label(tier)
	_aq_t = 0.0; _aq_frames = 0; _aq_time = 0.0
	if save: _save_settings()

## settings file v3: the quality tier (High is the default; a saved "auto" from before v3 moves to High once)
const SETTINGS_V := 3
func _save_settings() -> void:
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify({"v": SETTINGS_V, "quality": world.tier}))

func _load_settings() -> void:
	var tier := "high"
	if FileAccess.file_exists(SETTINGS_PATH) and not autotest:
		var d = JSON.parse_string(FileAccess.get_file_as_string(SETTINGS_PATH))
		if d is Dictionary:
			if d.has("quality"): tier = str(d["quality"])
			elif d.has("quality_high") and not bool(d["quality_high"]): tier = "low"
			if int(d.get("v", 1)) < 3 and tier == "auto": tier = "high"
	if not tier in ["auto", "high", "low"]: tier = "high"
	set_quality(tier)

## AUTO: judge the first seconds of play from real frame times (4 s windows after a 2 s settle); a slow window
## steps the tier down one gentle notch, at most three times; a window at or above 45 fps ends the judging.
func _auto_quality(dt: float) -> void:
	if quality_auto_dropped or world.tier != "auto" or autotest or world.auto_step >= 3: return
	_aq_t += dt
	if _aq_t < 2.0: return
	_aq_frames += 1
	_aq_time += dt
	if _aq_time < 4.0: return
	var fps := _aq_frames / _aq_time
	_aq_t = 0.0; _aq_frames = 0; _aq_time = 0.0
	if fps >= 45.0:
		quality_auto_dropped = true
		return
	world.set_tier("auto", world.auto_step + 1)
	_apply_tier_extras()
	print("[quality] auto step %d (%.0f fps)" % [world.auto_step, fps])

## the reflectors the tier setup tunes (Game3 overrides it)
func _tier_refls() -> Array:
	return []

func _apply_tier_extras() -> void:
	for r in _tier_refls():
		if r.planar:
			r.planar.enabled = true
			# the low tier keeps a half-resolution reflection; high / auto a full one, antialiased
			r.planar.scale = 1.0 if world.quality_high else 0.5
			r.planar.vp.msaa_3d = Viewport.MSAA_2X if world.quality_high and world.auto_step < 2 else Viewport.MSAA_DISABLED
	if level.grass_mmi: level.grass_mmi.set_fraction(1.0 if world.quality_high else 0.5)
	Reflector.cloth_bones = world.quality_high          # (the Low tier's reflections: cloth at rest)
	if ui.glass_talk and ui.glass_talk.glass_mat: ui.glass_talk.glass_mat.set_shader_parameter("drops_q", 1.0 if world.quality_high else 0.0)
	level.set_pbr_quality(world.quality_high)                 # (A: the Low tier skips the PBR detail)
	for m in [level.marble_mat, level.marble_occ_mat]: m.set_shader_parameter("flame_k", 1.0 if world.quality_high else 0.0)
	Flame.high = world.quality_high
	AquaLight.high = world.quality_high
	Flame.budget = 3 if world.tier == "high" else (2 if world.quality_high else 1)
	Flame.shadows = world.tier == "high"             # (no dynamic-light shadows on Auto / Low)

# ------------------------------------------------------------------ the shader warm-up
## draw every material once, a few pixels in front of the camera, for a few frames at start-up, so no shader is
## compiled (a hitch) the first time a flame is lit, a glow lands or a room is entered
const WARM_CHUNK := 48
var warm_done := false              # (tests) the warm-up has drawn every pair
func _warm_up_shaders() -> void:
	var holder := Node3D.new()
	world.cam.add_child(holder)
	holder.position = Vector3(0, 0, -(world.cam.near + 0.5))
	holder.scale = Vector3.ONE * 0.0003            # (sub-pixel: drawn, never seen)
	var mats: Array[Material] = [highlight._in, highlight._ring_mat, level.marble_mat, level.marble_occ_mat]
	# the shaders only an event instances, after start-up: the omens, the rings and sprays of the juice, the waters,
	# the fire, the fog, the glows (the scene's own pairs are found below)
	for nm in ["light_pool", "statue_shadow", "ember", "flame", "lens_only", "veil_glow", "halo", "rune_face_mm", "halo_mm",
			"light_pool_mm", "floor_mark_mm", "moths", "petals", "drips", "veil_strip", "warden_reflection", "veiled_eyes",
			"pickup_glow", "fx_burst", "fog_bank", "omen_fx", "surface_palm", "ring", "water_ring", "spray", "water",
			"still_water", "water_over", "beacon_flame", "beam", "beam_floor", "godray", "ray", "footprint", "observer_veil",
			"observer_rim", "stone_ghost", "pool_stones", "mist_drift", "fog_sheet", "glow", "mote", "shard_hang", "rune_flare"]:
		var path := "res://shaders/%s.gdshader" % nm
		if not ResourceLoader.exists(path): continue
		var m := ShaderMaterial.new()
		m.shader = load(path)
		mats.append(m)
	var n := 0
	for i in mats.size():
		var mi := MeshInstance3D.new()
		var q := BoxMesh.new()
		q.size = Vector3.ONE
		mi.mesh = q
		mi.material_override = mats[i]
		mi.position = Vector3(n * 1.2, 0, 0)
		n += 1
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		holder.add_child(mi)
	# EVERY mesh + material pair in the game (hidden ones too: the cinematics, the solved states), drawn once,
	# tiny, in front of the camera: no shader is compiled the first time it is seen
	var seen := {}
	var pending: Array[GeometryInstance3D] = []
	for g in find_children("*", "GeometryInstance3D", true, false):
		if g.is_ancestor_of(holder) or holder.is_ancestor_of(g): continue
		var mesh: Mesh = null
		var multi := false
		if g is MeshInstance3D:
			if (g as MeshInstance3D).skin != null: continue     # (skinned: the heroine is always on screen)
			mesh = (g as MeshInstance3D).mesh
		elif g is MultiMeshInstance3D and (g as MultiMeshInstance3D).multimesh:
			mesh = (g as MultiMeshInstance3D).multimesh.mesh
			multi = true
		elif g is CPUParticles3D:
			mesh = (g as CPUParticles3D).mesh
		if mesh == null: continue
		var gi := g as GeometryInstance3D
		for si in mesh.get_surface_count():
			var mat: Material = gi.material_override
			if mat == null and g is MeshInstance3D: mat = (g as MeshInstance3D).get_active_material(si)
			if mat == null: mat = mesh.surface_get_material(si)
			if mat == null: continue
			var fmt := (mesh as ArrayMesh).surface_get_format(si) if mesh is ArrayMesh else -1
			var key := "%d/%d/%s/%d/%s" % [mat.get_instance_id(), fmt, mesh.get_class(), si, multi]
			if seen.has(key): continue
			seen[key] = true
			var w: GeometryInstance3D
			if multi:
				var mm := MultiMesh.new()
				mm.transform_format = (g as MultiMeshInstance3D).multimesh.transform_format
				mm.use_colors = (g as MultiMeshInstance3D).multimesh.use_colors
				mm.use_custom_data = (g as MultiMeshInstance3D).multimesh.use_custom_data
				mm.mesh = mesh
				mm.instance_count = 1
				var mmi := MultiMeshInstance3D.new()
				mmi.multimesh = mm
				w = mmi
			else:
				var mi2 := MeshInstance3D.new()
				mi2.mesh = mesh
				w = mi2
			w.material_override = mat
			w.extra_cull_margin = 16384.0
			w.position = Vector3((n % 40) * 1.2, (n / 40) * 1.2, 0)
			w.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			w.layers = 0xFFFFF
			n += 1
			pending.append(w)
	# the 2D materials (the glass close-up, the lens, the UI runes and cards): one tiny quad each
	var cl := CanvasLayer.new()
	cl.layer = -100
	add_child(cl)
	var cseen := {}
	for c in find_children("*", "CanvasItem", true, false):
		var cm: Material = (c as CanvasItem).material
		if cm == null or cseen.has(cm.get_instance_id()): continue
		cseen[cm.get_instance_id()] = true
		var r := ColorRect.new()
		r.material = cm
		r.size = Vector2(2, 2)
		r.position = Vector2(2 * (cseen.size() % 50), 0)
		r.modulate.a = 0.02
		cl.add_child(r)
	# a lit flame with its light (the lit-surface variants of the stone compile too)
	var f := Flame.new(0.0, 0.5, Palette.FIRE_LIGHT, level.noise_tex)
	f.mat.set_shader_parameter("intensity", 1.0)
	f.energy = 0.02
	holder.add_child(f)
	f._allowed = true
	# the planar mirrors' and the glass close-up's own render passes, once each
	for r in _tier_refls():
		if r.planar and r.planar.vp.render_target_update_mode == SubViewport.UPDATE_DISABLED:
			r.planar.vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	var gtk := ui.glass_talk
	for v in [gtk.her_vp, gtk.mask_vp, gtk.mine_vp]:
		if v and v.render_target_update_mode == SubViewport.UPDATE_DISABLED: v.render_target_update_mode = SubViewport.UPDATE_ONCE
	print("[warm-up] %d mesh/material pairs (of %d geometry nodes), %d canvas materials" % [n, find_children("*", "GeometryInstance3D", true, false).size(), cseen.size()])
	for k in 4: await get_tree().process_frame
	# the title draws first, then the pairs go in a few dozen a frame while it is up; each batch is dropped after
	# it has been drawn twice
	for i in range(0, pending.size(), WARM_CHUNK):
		if not is_instance_valid(holder): return
		var batch := pending.slice(i, i + WARM_CHUNK)
		for w in batch: holder.add_child(w)
		for k in 2: await get_tree().process_frame
		for w in batch: w.queue_free()
	warm_done = true
	await get_tree().create_timer(0.4).timeout
	holder.queue_free()
	cl.queue_free()
	for r in _tier_refls():
		if r.planar and not r.planar.active: r.planar.vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	if gtk.her_vp and not gtk.visible: gtk.her_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED

# ------------------------------------------------------------------ dev / test commands
func cmd(c: String) -> Variant:
	var a := c.split(":")
	match a[0]:
		"begin": begin()
		"anew": _on_anew()
		"tp":
			var y := float(a[3]) if a.size() > 3 else player.yaw
			player.teleport(Vector3(float(a[1]), 0, float(a[2])), y)
			auto_target = Vector3.INF
			world.snap_to(player.position)
		"walk": auto_target = Vector3(float(a[1]), 0, float(a[2]))
		"face": player.yaw = float(a[1]); player.fig.rotation.y = player.yaw
		"input": key_vec = Vector2(float(a[1]), float(a[2]))
		"stop": key_vec = Vector2.ZERO; auto_target = Vector3.INF
		"interact": return try_interact()
		"zoom":
			# (dev only: another width, for screenshots)
			world.zoom = float(a[1])
			world.cam.size = float(a[1])
			world.cam_size_target = float(a[1])
		"slowmo": Engine.time_scale = float(a[1])
		"snd": sfx.play(a[1], float(a[2]) if a.size() > 2 else 0.0)
		"reset_save": _delete_save(); save_data = {}
		"save": _save()
		"glass_answer":
			# glass_answer:x,y;x,y;... (panel units) -> the recogniser (tests)
			var pts := PackedVector2Array()
			for pair in c.substr(13).split(";"):
				var xy := pair.split(",")
				if xy.size() == 2: pts.append(Vector2(float(xy[0]), float(xy[1])))
			return ui.glass_talk.answer(pts)
		"glass_close": ui.glass_talk.close()
		"glass_try":
			# synthetic strokes (tests): right = her half mirrored (the answer), right_rev = the same drawn
			# backwards with a shaky hand, left = her half copied, line = a straight stroke
			var gt := ui.glass_talk
			var st := PackedVector2Array()
			match a[1]:
				"right": st = gt.target[0]
				"right_rev":
					var tt: PackedVector2Array = gt.target[0]
					for i in range(tt.size() - 1, -1, -1): st.append(tt[i] + Vector2(sin(i * 1.7) * 0.04, cos(i * 2.3) * 0.04) + Vector2(0.05, -0.03))
				"left": st = gt.her_half[0]
				"line": st = PackedVector2Array([Vector2(0.4, 0.3), Vector2(0.4, -0.9)])
			return gt.answer(GlassTalk.resample(st, 24))
		"skip":
			if cine:
				sfx.stop_cue("cinematic_hand", 1.2)
				cine.skip()
		"title": ui.show_area(a[1])          # (dev / shots: show a title)
		"pitch": world.pitch_node.rotation.x = -deg_to_rad(float(a[1]))
		"camyaw": world.rig.rotation.y = float(a[1])
		"freecam":
			world.follow = null
			world.cam_lock = true
			world.rig.position = Vector3(float(a[1]), float(a[2]), float(a[3]))
			if a.size() > 4: world.cam.size = float(a[4])
		"noauto": quality_auto_dropped = true
		"quality": set_quality({"1": "high", "0": "low"}.get(a[1], a[1]))
		"jingle": sfx.solve_jingle()             # dev / probe: the solve jingle and its duck
		"duck":                                  # dev / probe: [the jingle duck now, the current bed's applied dB]
			var dk := [snappedf(sfx._jingle_duck_now(), 0.01), sfx.drone.volume_db if sfx.drone else null]
			if OS.has_feature("web"): JavaScriptBridge.eval("window.ewDuck = %s;" % JSON.stringify(dk))
			return dk
		"lights":                                # dev / bench: lights:<budget>:<shadows 0|1>
			Flame.budget = int(a[1]); Flame.shadows = a.size() > 2 and a[2] == "1"
		"near": world.cam.near = float(a[1])      # dev: a near cut (shots inside narrow rooms)
		"shadow":
			# dev: shadow:atlas:filter(0..5):blur:max_distance
			RenderingServer.directional_shadow_atlas_set_size(int(a[1]), true)
			RenderingServer.directional_soft_shadow_filter_set_quality(int(a[2]))
			world.sun.shadow_blur = float(a[3])
			world.sun.directional_shadow_max_distance = float(a[4])
		"dpr":
			world.dpr = float(a[1])
			world.set_tier(world.tier, world.auto_step)
		"closeup":
			world.cam_lock = float(a[1]) > 0.0
			if world.cam_lock: world.cam.size = float(a[1])
		"veil": player.fig.veil.visible = a[1] == "1"
		"runes": player.fig.set_runes(int(a[1]))
		"credits": ui.show_credits(a[1] == "1")
		"perf": _perf_hud(a[1] == "1")
		"feat": set_feature(a[1], a[2] == "1")
		"newgame_ui":
			# the title's New Game -> confirmation -> Yes, through the real buttons
			ui.anew_btn.pressed.emit()
			if a.size() > 1 and a[1] == "yes": ui.confirm_yes.pressed.emit()
		"fogd": world.fog_mats[int(a[1])].set_shader_parameter("density", float(a[2]))
		"envfog": world.env.fog_enabled = a[1] == "1"
	return true

var perf_hud: PerfHud
func _perf_hud(on: bool) -> void:
	if on and perf_hud == null:
		perf_hud = PerfHud.new()
		perf_hud.world = world
		add_child(perf_hud)
	if perf_hud: perf_hud.visible = on

## perf bench: switch one feature off / on
func set_feature(f: String, on: bool) -> void:
	match f:
		"bloom": world.env.glow_enabled = on
		"shadows": world.sun.shadow_enabled = on
		"grade": world.env.adjustment_enabled = on
		"msaa": get_viewport().msaa_3d = Viewport.MSAA_2X if on else Viewport.MSAA_DISABLED
		"refl": Reflector.enabled = on
		"envfog": world.env.fog_enabled = on
		"marble": level.marble_mat.set_shader_parameter("dbg_cheap", 0.0 if on else 1.0)
		_:
			for n in get_tree().get_nodes_in_group("f_" + f): n.visible = on

func _setup_js() -> void:
	if not OS.has_feature("web"): return
	_js_cb = JavaScriptBridge.create_callback(func(args: Array) -> void: cmd(str(args[0]) if args.size() > 0 else ""))
	var win := JavaScriptBridge.get_interface("window")
	win.ewCmd = _js_cb
	# (phase 5, perf) the state is published only for a test browser or a probe URL: building and handing it to the
	# page costs a frame a spike of script time five times a second that a player never needs
	_js_live = bool(JavaScriptBridge.eval("!!(navigator.webdriver || /probe|perf|state/.test(location.search))"))

var _js_live := false
func _js_state(dt: float) -> void:
	if _js_cb == null or not _js_live: return
	_js_t -= dt
	if _js_t > 0.0: return
	_js_t = 0.2
	JavaScriptBridge.eval("window.ewState = " + JSON.stringify(state_dict()) + ";", true)
