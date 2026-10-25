class_name Game
extends Node
## EIDOLON, first slice (area names: scripts/names.gd). Title -> wake -> free exploration -> shrine finale. Input, interaction,
## events -> sound / text, checkpoint saving to user://, and test hooks (web: window.ewCmd / ewState).

const SHRINES_TOTAL := 7
## hem stripe brightness by number of shrines woken
const HEM_PER_SHRINE := [1.0, 1.8, 2.4, 2.9, 3.3, 3.6, 3.9, 4.2]
const SAVE_PATH := "user://eidolon_world.json"
const MEMORY_LINE := "He carved her a thousand times.\nNone of them would breathe."

static var autotest := false

var world: World
var level: Level
var props: Props
var puzzles: Puzzles
var chapter: Chapter
var cine: Cinematic
var _skip_hold := false
var _skip_t := 0.0
const HINT_AFTER := 110.0        # seconds without progress in a space before a gentle hint
var player: Player
var sfx: Sfx
var ui: GameUI
var controls: Controls
var mode := "boot"           # boot, title, wake, play, finale
var focus: Level.Interact
var auto_target := Vector3.INF
var key_vec := Vector2.ZERO
var save_data := {}
var awake := false
var bridge_focus := 0.0
var area := ""
var visited := {}
var glimpses := {"lag": 0, "gaze": 0}
var interactions := 0
var _save_t := 0.0
var _last_saved_pos := Vector3.INF
var _js_cb: JavaScriptObject
var _js_t := 0.0
var _title_t := 0.0
var _keys := {}
var _finale_t := -1.0
var _world_block_t := 0.0

func _ready() -> void:
	if "--autotest" in OS.get_cmdline_user_args(): autotest = true
	Palette.push()
	world = World.new()
	add_child(world)
	level = Level.new(world.noise_tex)
	add_child(level)
	level.build()
	player = Player.new()
	player.level = level
	add_child(player)
	puzzles = Puzzles.new(level, self)
	add_child(puzzles)
	puzzles.build()
	chapter = Chapter.new(self)
	add_child(chapter)
	chapter.build()
	level.commit()
	sfx = Sfx.new()
	add_child(sfx)
	ui = GameUI.new()
	add_child(ui)
	controls = Controls.new()
	add_child(controls)
	ui.controls = controls
	chapter.post_commit()
	_drawbridge_lever()
	# v0.8: the owner's props, set into the chapter (their footprints join the obstacles before the audit)
	props = Props.new()
	level.add_child(props)
	props.build(level)
	print("[props] %d placed" % props.placed.size())
	# v0.7: every prop and piece of architecture is solid (see Level.auto_solids)
	var au := level.auto_solids([puzzles, chapter])
	print("[solids] %d primitives, %d solid footprints, %d obstacles added (%d ms)" % [au["parts"], au["solids"].size(), au["added"], au["ms"]])
	chapter.event.connect(_on_chapter_event)
	var gt := ui.glass_talk
	gt.solved.connect(func(id: String) -> void: chapter.glass_answered(id))
	gt.closed.connect(func(_id: String) -> void: _glass_closed())
	gt.solved.connect(func(_id: String) -> void: get_tree().create_timer(3.4).timeout.connect(_glass_closed))
	gt.sound.connect(_glass_sound)
	controls.shard.connect(func() -> void: if mode == "play": chapter.toggle_lens())
	level.read.connect(_on_read)
	puzzles.event.connect(_on_event)
	player.footstep.connect(_on_footstep)
	for r in puzzles.reflectors: r.glimpse.connect(_on_glimpse)
	controls.interact.connect(try_interact)
	controls.rotate.connect(rotate_view)
	controls.zoom.connect(zoom_view)
	ui.anew_pressed.connect(_on_anew)
	ui.quality_pressed.connect(func() -> void: set_quality({"auto": "high", "high": "low", "low": "auto"}[world.tier], true))
	_load_settings()
	if OS.has_feature("web"):
		var r = JavaScriptBridge.eval("window.devicePixelRatio || 1")
		if r is float or r is int:
			world.dpr = float(r)
			world.set_tier(world.tier, world.auto_step)
		var q = JavaScriptBridge.eval("String(location.search)")
		if q is String and "perf" in q: _perf_hud(true)
	world.add_moths(Vector3(8.2, 3.45, -24.5), 2)
	world.add_moths(Vector3(25.0, 3.75, -32.25), 3)
	world.add_moths(Puzzles.PLATE_POS + Vector3(0, 0.8, 0), 2)
	world.add_moths(Vector3(-2.4, 0.6, 1.7), 1)
	ui.door_overlay.slot_pressed.connect(door_cycle)
	ui.door_overlay.slot_back.connect(func(i: int) -> void: door_cycle(i, -1))
	ui.door_overlay.closed.connect(_door_overlay_closed)
	_setup_js()
	_load_save()
	# title: the wanderer lies curled beneath the broken gate, the camera drifts round the Veiled Gate
	player.teleport(Level.WAKE_POS, 0.0)
	player.crouch = 1.0
	player.step(0.016)
	world.rig.position = Level.WAKE_POS + Vector3(-0.6, 0.6, 0.4)
	world.cam.size = 8.0
	world.cam_size_target = 8.0
	world.fog_hole = Vector2(1.6, 5.2)
	world.fog_hole_target = world.fog_hole
	mode = "title"
	ui.set_continue(not save_data.is_empty())
	ui.fade_to(0.0, 1.8)
	ui.title_word.reveal = 0.0
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		ui.title_word.reveal = v
		ui.title_word.queue_redraw(), 0.0, 1.0, 2.4).set_delay(0.8)

# ------------------------------------------------------------------ flow
func begin(fresh := false) -> void:
	if mode != "title": return
	sfx.start_music()
	ui.hide_title()
	controls.reset()
	if fresh or save_data.is_empty():
		_start_wake()
	else:
		_continue_from_save()

## New Game (confirmed on the title): forget all progress, keep the settings (music, quality, zoom
## live in their own file / in memory) and start again at the waking scene.
func _on_anew() -> void:
	save_data = {}
	_delete_save()
	reset_progress()
	begin(true)

func reset_progress() -> void:
	puzzles.reset_state()
	puzzles.apply_state(puzzles.state)
	chapter.reset_state()
	chapter.apply_state()
	sfx.far_voice = false
	visited = {}
	area = ""
	glimpses = {"lag": 0, "gaze": 0}
	interactions = 0
	awake = false
	world.set_awaken(0.0)
	player.fig.set_hem(HEM_PER_SHRINE[0])
	player.fig.set_runes(0)
	for r in puzzles.reflectors:
		r.glimpsed = false; r.gazed = false; r.gaze_count = 0; r.skipped = false; r.active = false; r.vis = 0.0; r._hist.clear()

func _start_wake() -> void:
	mode = "wake"
	puzzles.reset_state()
	puzzles.apply_state(puzzles.state)
	chapter.reset_state()
	chapter.apply_state()
	player.teleport(Level.WAKE_POS, 0.0)
	player.crouch = 1.0
	player.locked = true
	_settle_camera(0, Level.WAKE_POS)
	sfx.play("whoosh", -14.0, 0.7)
	sfx.chord([-3, 4, 11], -18.0, 0.3)
	var tw := create_tween()
	tw.tween_interval(1.2)
	tw.tween_property(player, "crouch", 0.0, 3.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void:
		player.locked = false
		mode = "play"
		controls.enabled = true
		_save())

func _continue_from_save() -> void:
	puzzles.apply_state(save_data.get("puzzles", {}))
	var cs: Dictionary = save_data.get("chapter", {})
	chapter.reset_state()
	for k in cs:
		if chapter.state.has(k): chapter.state[k] = cs[k]
	chapter.apply_state()
	var p: Array = save_data.get("pos", [Level.WAKE_POS.x, 0.0, Level.WAKE_POS.z])
	player.teleport(Vector3(p[0], p[1], p[2]), float(save_data.get("yaw", 0.0)))
	player.crouch = 0.0
	awake = bool(puzzles.state["shrine"])
	world.set_awaken(1.0 if awake else 0.0)
	sfx.far_voice = awake
	player.fig.set_hem(HEM_PER_SHRINE[1 if awake else 0])
	player.fig.set_runes(int(save_data.get("runes_awake", 1 if awake else 0)))
	var g: Dictionary = save_data.get("glimpses", {})
	for k in g: glimpses[k] = int(g[k])
	for k in save_data.get("visited", []): visited[k] = true
	_settle_camera(int(save_data.get("cam", 0)), player.position)
	mode = "play"
	controls.enabled = true

func _settle_camera(yaw_i: int, at: Vector3) -> void:
	world.follow = null
	world.cam_size_target = world.zoom
	var cur := world.rig.rotation.y
	var target := -PI * 0.25 + yaw_i * PI * 0.5
	# turn the short way from wherever the title orbit left us
	target = cur + wrapf(target - cur, -PI, PI)
	world.yaw_index = yaw_i
	var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(world.rig, "rotation:y", target, 2.0)
	tw.parallel().tween_property(world.rig, "position", at + Vector3(0, 0.6, 0), 2.0)
	tw.tween_callback(func() -> void: world.follow = player)

## zoom one step: 1 = closer, 0 = farther (pinch / wheel / +-), saved with the settings
func zoom_view(level: int) -> void:
	if mode != "play": return
	if world.zoom_step(level == 1):
		sfx.play("whoosh", -30.0, 1.8 if level == 0 else 1.3)
		_save_settings()

func rotate_view(dir: int) -> void:
	if mode != "play" and mode != "wake": return
	if _world_block_t > 0.0: return
	world.rotate_view(dir)
	sfx.play("whoosh", -26.0, 1.5)

# ------------------------------------------------------------------ input
func _input(e: InputEvent) -> void:
	if mode == "title":
		var tap := false
		if e is InputEventScreenTouch and e.pressed and not ui.over_anew(e.position): tap = true
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT and not ui.over_anew(e.position): tap = true
		if e is InputEventKey and e.pressed and not e.echo and e.keycode in [KEY_SPACE, KEY_ENTER, KEY_E]: tap = true
		if tap and not (ui.confirm.visible or ui.credits_panel.visible): begin()
		return
	if mode == "door":
		if e is InputEventKey and e.pressed and not e.echo:
			var ov := ui.door_overlay
			match e.keycode:
				KEY_LEFT, KEY_A: ov.select((ov.selected + 2) % 3)
				KEY_RIGHT, KEY_D: ov.select((ov.selected + 1) % 3)
				KEY_UP, KEY_W: door_cycle(ov.selected)
				KEY_DOWN, KEY_S: door_cycle(ov.selected, -1)
				KEY_E, KEY_SPACE, KEY_ENTER: door_cycle(ov.selected)
				KEY_ESCAPE, KEY_Q: ov.close()
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
		if e.pressed:
			match e.keycode:
				KEY_E, KEY_SPACE, KEY_ENTER: try_interact()
				KEY_F: if mode == "play": chapter.toggle_lens()
				KEY_Q: rotate_view(-1)
				KEY_R: rotate_view(1)
				KEY_Z:
					world.zoom = World.ZOOM_DEFAULT
					_save_settings()
				KEY_EQUAL, KEY_KP_ADD: zoom_view(1)
				KEY_MINUS, KEY_KP_SUBTRACT: zoom_view(0)
	if e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP: zoom_view(1)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN: zoom_view(0)

func _key_vector() -> Vector2:
	var v := Vector2.ZERO
	if _keys.get(KEY_W, false) or _keys.get(KEY_UP, false): v.y -= 1.0
	if _keys.get(KEY_S, false) or _keys.get(KEY_DOWN, false): v.y += 1.0
	if _keys.get(KEY_A, false) or _keys.get(KEY_LEFT, false): v.x -= 1.0
	if _keys.get(KEY_D, false) or _keys.get(KEY_RIGHT, false): v.x += 1.0
	return v.normalized()

# ------------------------------------------------------------------ the rune door close-up
func open_door_overlay(sel: int) -> void:
	if puzzles.state["door_open"] or mode != "play": return
	mode = "door"
	player.input_dir = Vector2.ZERO
	auto_target = Vector3.INF
	controls.enabled = false
	controls.reset()
	controls.show_interact("")
	ui.door_overlay.open(puzzles.state["door"], sel)
	sfx.play("page", -14.0, 0.9)

## a slot tapped (or E on the selected slot): the rune turns over
func door_cycle(i: int, dir := 1) -> void:
	if mode != "door": return
	ui.door_overlay.select(i)
	puzzles.turn_dial(i, dir)
	ui.door_overlay.flip(i, puzzles.state["door"][i])
	if puzzles.state["door_open"]: ui.door_overlay.flare()

func _door_overlay_closed() -> void:
	if mode == "door":
		mode = "play"
		controls.enabled = true
		controls.block(250)              # the closing tap (and anything right after) never reaches the world
		_world_block_t = 0.25

func try_interact() -> bool:
	if mode != "play" or focus == null or _world_block_t > 0.0: return false
	interactions += 1
	focus.action.call()
	return true

# ------------------------------------------------------------------ frame
func _process(dt: float) -> void:
	_world_block_t = maxf(0.0, _world_block_t - dt)
	if mode == "title":
		_title_t += dt
		world.rig.rotation.y += dt * 0.045
	if mode == "play" or mode == "wake" or mode == "finale":
		var sv := controls.vec
		var kv := _key_vector()
		if kv != Vector2.ZERO: sv = kv
		if key_vec != Vector2.ZERO: sv = key_vec
		var axes := world.ground_axes()
		var dir: Vector3 = axes[0] * sv.x + axes[1] * (-sv.y)
		if auto_target != Vector3.INF:
			var d := auto_target - player.position
			d.y = 0.0
			if d.length() < 0.08:
				auto_target = Vector3.INF
				dir = Vector3.ZERO
			else:
				dir = d.normalized() * clampf(d.length() * 2.5, 0.25, 1.0)
		player.input_dir = Vector2(dir.x, dir.z) if mode == "play" else Vector2.ZERO
	player.step(dt)
	world.update_reveal(level.occluders, player.position, dt)
	level.set_fade(player.position, world.reveal_k > 0.001)
	if mode != "cine" and mode != "finale": level.cull_far(player.position, dt)
	puzzles.update(dt)
	if mode != "title": chapter.update(dt)
	if mode == "cine":
		_skip_t = _skip_t + dt if _skip_hold else maxf(0.0, _skip_t - dt * 3.0)
		ui.set_skip(clampf(_skip_t / 1.1, 0.0, 1.0), _skip_hold or _skip_t > 0.0)
		if _skip_t >= 1.1 and cine:
			_skip_t = 0.0
			_skip_hold = false
			sfx.stop_cue("cinematic_hand", 1.2)
			sfx.stop_cue("shrine_awaken", 1.2)
			cine.skip()
	if mode == "play": _update_focus()
	else: controls.show_interact("")
	_update_hum()
	if mode != "title":
		var p := player.position
		var wide := p.x > 20.5 and p.z < -18.5     # the eidolon ledge and the shrine: see across the gap
		var cs: float = world.zoom
		var on_ledge := p.x > 20.8 and p.z > -25.2 and p.z < -18.8
		if on_ledge: cs = maxf(cs, 9.6)              # see your reflection AND the plate
		if area == "mist_maze" and p.z < -28.5: cs = maxf(cs, 10.6)          # the maze and her pool
		if area == "scales": cs = maxf(cs, 9.8)
		if area == "shard_gallery" and chapter.lens_on: cs = minf(cs, 5.4)      # v0.6: read her map up close
		if area == "waking_pool" and p.x < 0.6 and p.z > -0.6 and p.z < 4.2 and absf(p.y) < 0.4: cs = minf(cs, 6.6)   # v0.6: the stones in the water
		if mode != "finale" and mode != "cine": world.cam_size_target = cs
		world.fog_hole_target = Vector2(12.5, 21.0) if wide else Vector2(0.55, 1.3) * cs
		if mode == "play":
			# on the eidolon ledge, frame the player AND the plate across the gap
			var off := Vector3.ZERO
			if bridge_focus > 0.0:
				bridge_focus -= dt
				off = (Vector3(27.7, 2.0, -26.5) - p) * 0.7         # watch the bridge rise
				off.y = 0.0
			elif p.x > 20.8 and p.z > -25.2 and p.z < -18.8 and p.y < 3.0:
				off = (Puzzles.PLATE_POS - p) * 0.5
				off.y = 0.0
			elif area == "shard_gallery" and chapter.lens_on:
				off = Vector3((6.8 - p.x) * 0.45, 0.0, (-10.5 - p.z) * 0.45)          # v0.6: her map
			elif area == "mist_maze" and p.z < -28.5 and p.x > 8.5:
				off = Vector3((4.6 - p.x) * 0.42, 0.0, (-34.0 - p.z) * 0.3)     # her steps in the pool
			elif area == "garden_veiled" and p.z < -9.0 and p.x > 8.5 and p.x < 15.5:
				off = Vector3(0.0, 0.0, (-14.0 - p.z) * 0.5)                   # the turned ones and their glass
			world.look_offset = world.look_offset.lerp(off, 1.0 - exp(-dt * 1.5))
	level.beyond.visible = world.awaken > 0.01
	if mode == "play": _auto_quality(dt)
	level.update_inscriptions(player.position)
	if mode == "play" or mode == "finale" or mode == "cine":
		_update_area()
		_update_air()
	if ui.text_source != Vector3.INF and player.position.distance_to(ui.text_source) > 3.2: ui.hide_text()
	if mode == "play":
		_save_t += dt
		if _save_t > 6.0:
			_save_t = 0.0
			if _last_saved_pos == Vector3.INF or player.position.distance_to(_last_saved_pos) > 0.5: _save()
	_js_state(dt)

func _update_focus() -> void:
	var best: Level.Interact = null
	var bd := INF
	var p := player.position
	for it in level.interacts:
		if not it.enabled: continue
		if it.cond.is_valid() and not it.cond.call(): continue
		if absf(it.pos.y - p.y) > 1.3: continue
		var d := Vector2(it.pos.x - p.x, it.pos.z - p.z).length()
		if d < it.radius and d < bd:
			bd = d; best = it
	if puzzles.busy: best = null
	focus = best
	controls.show_interact(best.icon if best else "")

const EXPOSED := ["stub", "b1", "HG", "LB", "E", "EB", "sealed_way"]
const AREA_WIND := {"waking_pool": 0.35, "stair_breath": 0.6, "hall_glass": 0.12, "shard_gallery": 0.1, "garden_veiled": 0.3,
	"hollow_walk": 0.25, "court_light": 0.4, "mist_maze": 0.15, "echo_corridor": 0.1, "scales": 0.45, "eidolon_ledge": 0.6,
	"gate_four": 0.5, "first_shrine": 0.4}

func _surface() -> String:
	var q := Vector2(player.position.x, player.position.z)
	var g := level.region_at(q)
	if g and g.name == "LB": return "wood"
	if g and g.name.begins_with("stone"): return "water"
	if area in ["hall_glass", "shard_gallery", "echo_corridor"]: return "hall"
	return "stone"

func _update_air() -> void:
	var q := Vector2(player.position.x, player.position.z)
	var g := level.region_at(q)
	var w: float = AREA_WIND.get(area, 0.35)
	if g and (g.name in EXPOSED or g.name.begins_with("pool") or g.name == "WK"): w = 0.95
	sfx.set_wind(w * (0.7 if awake else 1.0))

func _update_area() -> void:
	var g := level.region_at(Vector2(player.position.x, player.position.z))
	if g == null or not Names.REGION_AREA.has(g.name): return
	var key: String = Names.REGION_AREA[g.name]
	if key == "gate_four" and Vector2(player.position.x - Puzzles.SHRINE_C.x, player.position.z - Puzzles.SHRINE_C.z).length() < 2.4:
		key = "first_shrine"
	if key == area: return
	area = key
	sfx.set_area(key)
	if mode == "play" and area != "": _save()        # a checkpoint in every space
	if not visited.has(key):
		visited[key] = true
		ui.show_area(Names.area(key))

func _update_hum() -> void:
	var pts := puzzles.beam_points
	if pts.size() < 2:
		sfx.set_hum(0.0)
		return
	var p := player.position + Vector3(0, 1, 0)
	var bd := INF
	for i in pts.size() - 1:
		var a := pts[i]; var b := pts[i + 1]
		var ab := b - a
		var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 0.0001), 0.0, 1.0)
		bd = minf(bd, p.distance_to(a + ab * t))
	sfx.set_hum(clampf(1.0 - (bd - 1.0) / 7.0, 0.0, 1.0) * (1.0 if puzzles.beam_lit else 0.6))

# ------------------------------------------------------------------ events
func _on_read(text: String, script: Array) -> void:
	ui.show_inscription(text, script, player.position)
	sfx.play("chime_hall" if area == "hall" else "chime", -23.0, 0.5)
	chapter.progress()
	if focus and focus.id == "h_tablet":
		puzzles.state["tablet"] = true
		_save()

func _on_footstep(kind: String, strength: float) -> void:
	if kind == "step":
		sfx.footstep(_surface(), strength)
		player_dust()
		chapter.on_footstep()
	else:
		sfx.play("cloth", -31.0 + strength * 3.0, randf_range(0.85, 1.15))

## a small puff of dust where the foot lands
func player_dust() -> void:
	if world: world.dust_puff(player.position + player.fig.basis * Vector3(0.09 * (1 if randf() < 0.5 else -1), 0.02, -0.12))

func _on_glimpse(kind: String) -> void:
	glimpses[kind] = glimpses.get(kind, 0) + 1
	if kind == "gaze":
		# a faint glass chime as the reflection turns away from you
		sfx.play("chime_hall", -22.0, 0.62)
		get_tree().create_timer(0.9).timeout.connect(func() -> void: sfx.play("chime_hall", -27.0, 0.47))

func _on_event(name: String, data: Variant) -> void:
	match name:
		"statue":
			ui.show_rune(data[0], data[1])
			sfx.play("glass", -17.0, 0.5 * pow(2.0, [0, 4, 7][data[1] - 1] / 12.0))
		"dial":
			sfx.play("flip", -13.0, 0.95 + data * 0.05)
			sfx.play("grind", -20.0, 1.6)
		"door_solved":
			sfx.resolve(0)
		"door_grind":
			sfx.play("door", 0.0, 0.9)
			world.shake(0.45)
		"door_open":
			_save()
		"gate_locked":
			sfx.play("rattle", -16.0, 1.0)
			ui.show_text("It will not open from this side.", player.position, 2.5)
		"gate_open":
			sfx.play("rattle", -14.0, 0.8)
			sfx.play("grind", -10.0, 0.7)
			sfx.resolve(-2)
			_save()
		"mirror_turn":
			sfx.play("turn", -6.0, 1.25)
		"beam_lit":
			sfx.resolve(4)
			sfx.play("bell", -16.0, 1.0)
		"bridge_fall":
			sfx.play("whoosh", -14.0, 0.6)
			get_tree().create_timer(0.85).timeout.connect(func() -> void:
				sfx.play("thud", -5.0, 0.8)
				world.shake(0.4))
		"bridge_down":
			_save()
		"plate_touch":
			sfx.play("chime_hall", -20.0, 0.75)
		"plate_half":
			sfx.play("glass_tink", -21.0, 0.6)          # (hers stirs, but yours is empty)
		"plate_glow":
			sfx.cue("solve_eidolon_ledge")
		"bridge_rise":
			bridge_focus = 5.0
			sfx.play("door", -1.0, 0.8)
			world.shake(0.35)
		"plate_open":
			_save()
		"shrine":
			start_finale()
		"sealed":
			sfx.play("rattle", -20.0, 0.6)
			ui.show_text("The way on is sealed.\nAnother shrine still sleeps beyond the fog." if awake else "The way on is sealed.", player.position, 3.0)

# ------------------------------------------------------------------ the finale
func start_finale() -> void:
	if puzzles.state["shrine"]: return
	puzzles.state["shrine"] = true
	mode = "cine"
	player.locked = true
	player.input_dir = Vector2.ZERO
	auto_target = Vector3.INF
	key_vec = Vector2.ZERO
	controls.show_interact("")
	controls.enabled = false
	controls.reset()
	chapter.set_lens(false)
	ui.hide_text()
	_skip_t = 0.0
	_skip_hold = false
	sfx.swell()
	cine = Cinematic.new(self)
	add_child(cine)
	cine.cue.connect(func(n: String) -> void: sfx.cue(n))
	chapter.hand_in_the_water(cine)
	cine.finished.connect(_end_cinematic)
	cine.start()

func _end_cinematic() -> void:
	awake = true
	sfx.far_voice = true
	sfx._voice_t = 12.0
	world.set_awaken(1.0)
	puzzles.set_shrine_awake(1.0, 1.0)
	player.fig.set_runes(1)
	player.fig.set_hem(HEM_PER_SHRINE[1])
	player.locked = false
	player.crouch = 0.0
	world.yaw_index = 0
	world.rig.rotation.y = -PI * 0.25
	world.pitch_node.rotation.x = -World.PITCH
	world.cam_lock = false
	world.cam.near = 1.0
	world.look_offset = Vector3.ZERO
	world.cam_size_target = world.zoom
	world.follow = player
	ui.set_letterbox(0.0)
	ui.set_skip(0.0, false)
	ui.skip_ring.show_k = 0.0
	mode = "play"
	controls.enabled = true
	controls.block(300)
	_world_block_t = 0.3
	if cine:
		cine.queue_free()
		cine = null
	_save()

## the drawbridge from the Court to the ledge stays up until you reach the ledge the long way; a lever
## there lowers it (a way back)
func _drawbridge_lever() -> void:
	var m := MB.new()
	m.box(Vector3(21.55, 2.3, -22.2), Vector3(0.3, 0.6, 0.3), Color(0.5, 0.25, 0.0))
	m.cyl(Vector3(21.55, 2.85, -22.2), 0.03, 0.03, 0.7, Color(0.5, 1.0, 0.0), 6, Basis(Vector3.BACK, 0.5))
	puzzles.marble_instance(m.commit(), chapter)
	level.ob_circle(Vector2(21.55, -22.2), 0.25)
	level.add_interact("drawbridge", Vector3(21.55, 2.0, -22.2), "lever", func() -> void: puzzles.lower_drawbridge(false), 1.0,
		func() -> bool: return not puzzles.state.get("drawbridge", false) and player.position.x > 21.0)

# ------------------------------------------------------------------ v0.5b: a conversation through the glass
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
	ui.glass_talk.open({"id": id, "first": "follow", "question": "together_half"})

func _glass_sound(n: String) -> void:
	match n:
		"breath": sfx.cue("breath")
		"writing": sfx.play("glass_tink", -24.0, 0.8)
		"chime":
			sfx.play("chime", -14.0, 1.0)
			sfx.motif(-10.0)                 # v0.6: her answer rings with her song (heard again in the Echo Corridor)
		"wrong": sfx.play("glass_tink", -16.0, 0.53)        # a low, slightly sour glass tone

func _glass_closed() -> void:
	if mode != "glass": return
	mode = "play"
	controls.enabled = true
	controls.block(250)                # the closing tap never reaches the world (as the door panel)
	_world_block_t = 0.25

# ------------------------------------------------------------------ v0.5 chapter events
func _on_chapter_event(name: String, data: Variant) -> void:
	match name:
		"solve":
			chapter.progress()
			sfx.cue("solve_" + str(data))
			_save()
		"breath": sfx.cue("breath")
		"writing": sfx.play("glass_tink", -24.0, 0.8)
		"touch_glass": sfx.cue("touch_glass")
		"shard":
			sfx.play("shard", 0.0, 1.0)
			_save()
		"lens": sfx.play("glass_tink", -20.0, 1.25 if data else 0.85)
		"statue_turn": sfx.cue("statue_turn")
		"door_reflection": sfx.play("chime_hall", -16.0, 0.7)
		"door_real":
			sfx.play("door", -3.0, 0.9)
			world.shake(0.3)
		"hollow_step": sfx.play("hollow", 0.0, 1.0)
		"hollow_lock":
			sfx.play("thud", -10.0, 0.7)
			chapter.progress()
		"maze_bump": sfx.play("glass_tink", -21.0, 0.7)
		"memory":
			ui.show_memory(Chapter.MEMORY_1, 4.0)
			sfx.cue("glimpse")
			_save()
		"scale_groan": sfx.play("creak", -4.0, 1.0 + clampf(float(data) * 0.02, -0.2, 0.2))
		"hint": sfx.play("glass_tink", -30.0, 1.4)
		# v0.6
		"pool_turn":
			sfx.play("grind", -9.0, 1.15)
			sfx.play("step_wet", -12.0, 0.8)
		"pool_joint": sfx.play("chime", -21.0, 1.25 + 0.05 * float(data))
		"pool_rise":
			sfx.play("grind", -6.0, 0.55)
			sfx.play("step_wet", -4.0, 0.7)
			sfx.play("whoosh", -16.0, 0.6)
		"pool_whole":
			sfx.play("chime", -14.0, 0.8)
			sfx.play("step_wet", -6.0, 0.55)
		"hall_push": sfx.play("grind", -8.0, 0.9)
		"hall_take": sfx.play("cloth", -16.0, 1.1)
		"hall_place": sfx.play("grind", -14.0, 1.4)
		"hall_nope": sfx.play("glass_tink", -22.0, 0.5)
		"hall_reset":
			sfx.play("grind", -10.0, 0.7)
			sfx.play("chime_hall", -20.0, 0.6)
		"hall_lock":
			sfx.note(["A", "D", "E"][int(data) % 3], -11.0)
			sfx.play("chime_hall", -16.0, 1.0)
			chapter.progress()
		"brazier": sfx.play("whoosh", -17.0, 1.7)
		"gutter":
			sfx.play("whoosh", -15.0, 0.55)
			sfx.sour(-20.0)
		"song_note": sfx.note(str(data), -5.0, true)
		"song_sour": sfx.sour(-11.0)
		"song_remember": sfx.motif(-21.0, 0.55, true)
		"weight_take": sfx.play("grind", -18.0, 1.6)
		"weight_hang": sfx.play("creak", -8.0, 1.2)
		"lift":
			sfx.play("door", -6.0, 1.1)
			world.shake(0.15)
		"plate_a": sfx.play("thud", -12.0, 0.9)

# ------------------------------------------------------------------ jump (tests, screenshots)
## put the world in the state it has when you first enter `room` (everything before it solved) and
## stand at its entrance
const ROOM_ENTRY := {
	"waking_pool": Vector3(1.4, 0.0, 2.3), "stair_breath": Vector3(-11.0, 0.0, 1.6), "hall_glass": Vector3(-2.0, 1.0, -13.5),
	"shard_gallery": Vector3(5.8, 1.0, -17.0), "garden_veiled": Vector3(8.2, 1.0, -8.6), "hollow_walk": Vector3(17.9, 1.0, -11.8),
	"court_light": Vector3(18.5, 2.0, -17.8), "mist_maze": Vector3(12.0, 2.0, -26.4), "echo_corridor": Vector3(10.0, 2.0, -40.0),
	"scales": Vector3(26.6, 2.0, -45.5), "eidolon_ledge": Vector3(24.0, 2.0, -22.0), "gate_four": Vector3(27.6, 2.0, -27.0),
	"first_shrine": Vector3(25.0, 2.0, -30.8),
}
func jump(room: String) -> void:
	var idx := Names.ORDER.find(room)
	if idx < 0: return
	auto_target = Vector3.INF
	key_vec = Vector2.ZERO
	puzzles.reset_state()
	chapter.reset_state()
	var cs := chapter.state
	var ps := puzzles.state
	for i in idx:
		match Names.ORDER[i]:
			"waking_pool":
				cs["stones"] = true; cs["pool_turns"] = Chapter._pool_solution()
			"stair_breath": cs["breath"] = true
			"hall_glass":
				cs["shard"] = true; cs["hall_door"] = true
				cs["hall"] = {"drum": [Chapter.DRUM_GOAL.x, Chapter.DRUM_GOAL.y], "brazier": [Chapter.BRAZ_GOAL.x, Chapter.BRAZ_GOAL.y],
					"bust": Chapter.BUST_GOAL, "locks": [true, true, true]}
			"shard_gallery": cs["gallery"] = true
			"garden_veiled":
				cs["turned"] = Chapter.TURN_SOLUTION.duplicate(); cs["turned_done"] = true; cs["garden_breath"] = true
			"hollow_walk":
				cs["hollows"] = [[Ch1Geo.HW_PLATES[0].x, Ch1Geo.HW_PLATES[0].y], [Ch1Geo.HW_PLATES[1].x, Ch1Geo.HW_PLATES[1].y]]
				cs["hollow_lock"] = [true, true]; cs["hollow_done"] = true
			"court_light":
				ps["mirrors"] = Puzzles.MIRROR_SOLUTION.duplicate(); ps["bridge"] = true; cs["mural"] = true
			"mist_maze": cs["maze"] = true
			"echo_corridor": cs["echo_room"] = true
			"scales":
				cs["scales"] = true; cs["scale_w"] = [-1, -1, 5]
			"eidolon_ledge":
				ps["plate"] = true; cs["ledge_statue"] = [Chapter.LEDGE_PLATE.x, Chapter.LEDGE_PLATE.y]
			"gate_four": cs["four"] = true
	puzzles.apply_state(ps)
	chapter.apply_state()
	awake = bool(ps["shrine"])
	world.set_awaken(1.0 if awake else 0.0)
	puzzles.set_shrine_awake(1.0 if awake else 0.0, 1.0 if awake else 0.0)
	player.fig.set_hem(HEM_PER_SHRINE[1 if awake else 0])
	player.fig.set_runes(1 if awake else 0)
	var p: Vector3 = ROOM_ENTRY[room]
	player.teleport(p, player.yaw)
	world.snap_to(player.position)
	if mode == "title":
		sfx.start_music()
		ui.hide_title()
	ui.fade_to(0.0, 0.01)
	world.follow = player
	world.cam_lock = false
	world.cam.near = 1.0
	world.cam_size_target = world.zoom
	mode = "play"
	controls.enabled = true
	player.locked = false
	player.crouch = 0.0
	visited[room] = true
	chapter.hint_t = 0.0

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

## settings file v2 (v0.4): quality tier + zoom. Older files keep their quality but the zoom resets
## to the new default once.
const SETTINGS_V := 2
func _save_settings() -> void:
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify({"v": SETTINGS_V, "quality": world.tier, "zoom": snappedf(world.zoom, 0.01)}))

func _apply_tier_extras() -> void:
	for r in puzzles.reflectors:
		if r.planar:
			r.planar.enabled = true
			# the low tier keeps a half-resolution reflection; high / auto a full one, antialiased
			r.planar.scale = 1.0 if world.quality_high else 0.5
			r.planar.vp.msaa_3d = Viewport.MSAA_2X if world.quality_high and world.auto_step < 2 else Viewport.MSAA_DISABLED
	level.grass_mmi.set_fraction(1.0 if world.quality_high else 0.5)
	Reflector.cloth_bones = world.quality_high          # (v0.8: the Low tier's reflections: cloth at rest)
	if props: props.set_quality(world.quality_high)

func _load_settings() -> void:
	var tier := "auto"
	if FileAccess.file_exists(SETTINGS_PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(SETTINGS_PATH))
		if d is Dictionary:
			if d.has("quality"): tier = str(d["quality"])
			elif d.has("quality_high") and not bool(d["quality_high"]): tier = "low"
			if int(d.get("v", 1)) >= SETTINGS_V and d.has("zoom"):
				world.zoom = clampf(float(d["zoom"]), World.ZOOM_MIN, World.ZOOM_MAX)
	if not tier in ["auto", "high", "low"]: tier = "auto"
	set_quality(tier)

## AUTO: judge the first seconds of play from real frame times (4 s windows after a 2 s settle);
## a slow window steps the tier down one gentle notch (1.25x render cap -> no MSAA -> low set), at most
## three times, never further; a window at or above 45 fps ends the judging.
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
		quality_auto_dropped = true          # good enough: stay here
		return
	world.set_tier("auto", world.auto_step + 1)
	_apply_tier_extras()
	print("[quality] auto step %d (%.0f fps)" % [world.auto_step, fps])

# ------------------------------------------------------------------ save
func _load_save() -> void:
	if not FileAccess.file_exists(SAVE_PATH): return
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if d is Dictionary and d.has("puzzles"): save_data = d

func _save() -> void:
	if mode == "title": return
	var p := player.position
	_last_saved_pos = p
	save_data = {"v": 2, "pos": [p.x, p.y, p.z], "yaw": player.yaw, "cam": world.yaw_index,
		"puzzles": puzzles.state.duplicate(true), "chapter": chapter.state.duplicate(true), "area": area, "glimpses": glimpses, "runes_awake": player.fig.runes_awake, "visited": visited.keys()}
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify(save_data))

func _delete_save() -> void:
	if FileAccess.file_exists(SAVE_PATH): DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))

# ------------------------------------------------------------------ test hooks
## Shared by the headless playthrough and the web harness.
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
		"rotate": rotate_view(int(a[1]))
		"yaw": world.set_yaw_index(int(a[1]))
		"zoom":
			world.cam.size = float(a[1])
			world.cam_size_target = float(a[1])
		"zoomlvl": zoom_view(int(a[1]))
		"slowmo": Engine.time_scale = float(a[1])
		"snd": sfx.play(a[1], float(a[2]) if a.size() > 2 else 0.0)
		"reset_save": _delete_save(); save_data = {}
		"save": _save()
		"finale": start_finale()
		"jump": jump(a[1])
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
		"glass_preview":
			# show part of the answer as your stroke, mid-draw (screenshots)
			var gt2 := ui.glass_talk
			var pts: PackedVector2Array = GlassTalk.resample(gt2.target[0], 40)
			var part := PackedVector2Array()
			for i in int(40 * float(a[1])): part.append(pts[i])
			gt2.ink.mine = [[gt2._px(part), 1.0]]
			gt2.phase = "drawing"
			gt2.ink.queue_redraw()
		"skip":
			if cine:
				sfx.stop_cue("cinematic_hand", 1.2)
				cine.skip()
		"lens": chapter.set_lens(a[1] == "1")
		"hintnow":
			var tg := chapter.hint_target(area)
			if tg != Vector3.INF: chapter.show_hint(tg)
		"cs":
			# set one chapter state key from JSON (cs:key:json)
			chapter.state[a[1]] = JSON.parse_string(c.substr(c.find(":", 3) + 1))
			chapter.apply_state()
		"ps":
			puzzles.state[a[1]] = JSON.parse_string(c.substr(c.find(":", 3) + 1))
			puzzles.apply_state(puzzles.state)
		"call":
			# call a chapter method with int args (tests): call:turn_statue:0
			var args := []
			for k in range(2, a.size()): args.append(int(a[k]))
			return chapter.callv(a[1], args)
		"pitch": world.pitch_node.rotation.x = -deg_to_rad(float(a[1]))
		"camyaw": world.rig.rotation.y = float(a[1])
		"freecam":
			world.follow = null
			world.cam_lock = true
			world.rig.position = Vector3(float(a[1]), float(a[2]), float(a[3]))
			if a.size() > 4: world.cam.size = float(a[4])
		"noauto": quality_auto_dropped = true
		"quality": set_quality({"1": "high", "0": "low"}.get(a[1], a[1]))
		"near": world.cam.near = float(a[1])      # dev: a near cut (shots inside narrow rooms)
		"clasp":
			# dev: the reflections' clasped hands (0..1), now
			for r in puzzles.reflectors:
				r.set("_clasp", float(a[1]))
				r.set("_clasp_t", 999.0)
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
		"door_tap": ui.door_overlay.slot_pressed.emit(int(a[1]))
		"door_close": ui.door_overlay.close()
		"veil": player.fig.veil.visible = a[1] == "1"
		"runes": player.fig.set_runes(int(a[1]))
		"credits": ui.show_credits(a[1] == "1")
		"hint":
			# show a reflection hint now (screenshots): clasp = hands at the chest
			var r: Reflector = puzzles.hall_mirror
			if a[1] == "clasp": r._clasp = 1.0; r._clasp_t = 60.0
		"perf": _perf_hud(a[1] == "1")
		"feat": set_feature(a[1], a[2] == "1")
		"newgame_ui":
			# the title's New Game -> confirmation -> Yes, through the real buttons
			ui.anew_btn.pressed.emit()
			if a.size() > 1 and a[1] == "yes": ui.confirm_yes.pressed.emit()
		"fogd": world.fog_mats[int(a[1])].set_shader_parameter("density", float(a[2]))
		"envfog": world.env.fog_enabled = a[1] == "1"
		"rp": puzzles.reflectors[int(a[1])].puppet.set_param(a[2], float(a[3]))
		"rpv": puzzles.reflectors[int(a[1])].puppet.set_param(a[2], Vector2(float(a[3]), float(a[4])))
		"refl":
			for r in puzzles.reflectors:
				print(r.kind, " clip_c=", r.puppet.body_mat.get_shader_parameter("clip_c"), " clip_h=", r.puppet.body_mat.get_shader_parameter("clip_h"), " u=", r.puppet.body_mat.get_shader_parameter("clip_u"), " v=", r.puppet.body_mat.get_shader_parameter("clip_v"), " n=", r.puppet.body_mat.get_shader_parameter("plane_n"), " d=", r.puppet.body_mat.get_shader_parameter("plane_d"))
				print(r.kind, " active=", r.active, " vis=", snappedf(r.vis, 0.01), " puppet=", r.puppet.global_position, " vis_node=", r.puppet.is_visible_in_tree(), " basis_det=", r.puppet.global_transform.basis.determinant())
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

func state_dict() -> Dictionary:
	var p := player.position
	var buses := []
	for b in AudioServer.bus_count:
		buses.append("%s:%.0fdB" % [AudioServer.get_bus_name(b), AudioServer.get_bus_volume_db(b)])
	var refl := []
	for r in puzzles.reflectors:
		if r.active: refl.append(r.kind)
	return {"mode": mode, "pos": [snappedf(p.x, 0.01), snappedf(p.y, 0.01), snappedf(p.z, 0.01)], "focus": focus.id if focus else "",
		"puzzles": puzzles.state, "beam_lit": puzzles.beam_lit, "busy": puzzles.busy, "auto": auto_target != Vector3.INF,
		"refl": refl, "gaze": puzzles.hall_mirror.gaze_head, "glimpses": glimpses, "awaken": world.awaken,
		"fps": Engine.get_frames_per_second(), "draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"sfx_ready": sfx.ready_ok, "played": sfx.played, "buses": buses, "drone": sfx.drone.playing, "music": sfx._music_cur, "speed": player.speed01,
		"joy": controls.joy_index, "touches": controls._touches.size(), "vec": [snappedf(controls.vec.x, 0.01), snappedf(controls.vec.y, 0.01)], "ctl": controls.enabled,
		"memory": snappedf(ui.memory.modulate.a, 0.01), "counter": snappedf(ui.end_b.modulate.a, 0.01), "title_reveal": ui.title_word.reveal, "runes_awake": player.fig.runes_awake, "hem": player.fig.hem, "area": area, "area_label": ui.area_label.text, "card": snappedf(ui.card.modulate.a, 0.01), "door_ui": ui.door_overlay.visible,
		"door_slots": _door_slot_centers(), "quality_high": world.quality_high, "tier": world.tier_name(), "yaw_index": world.yaw_index, "zoom": snappedf(world.zoom, 0.01), "scale3d": snappedf(get_viewport().scaling_3d_scale, 0.01), "vp": get_viewport().get_visible_rect().size, "msaa": get_viewport().msaa_3d, "foot": snappedf(float(puzzles.foot_mat.get_shader_parameter("intensity")), 0.01),
		"near_ring": snappedf(float(puzzles.near_mat.get_shader_parameter("radius")), 0.01),
		"chapter": chapter.state, "lens": chapter.lens_on, "calm": snappedf(chapter.calm, 0.01), "cine_t": snappedf(cine.t, 0.1) if cine else -1.0,
		"letterbox": snappedf(ui.letterbox, 0.01), "glass": ui.glass_talk.phase, "glass_tries": ui.glass_talk.tries, "glass_score": ui.glass_talk.last_score, "hint_t": snappedf(chapter.hint_t, 0.1), "lift": snappedf(chapter.lift_h, 0.01),
		"beam_good": puzzles.beam_good, "carry": chapter.carrying, "sc_carry": chapter.sc_carry, "torque": [chapter.scale_torque().x, chapter.scale_torque().y],
		"reveal": snappedf(world.reveal_k, 0.01), "feet": chapter.maze_feet.filter(func(f: MeshInstance3D) -> bool: return f.visible).size()}

func _door_slot_centers() -> Array:
	var out := []
	if not ui.door_overlay.visible: return out
	var xf := ui.door_overlay.get_global_transform_with_canvas()
	for c in ui.door_overlay.slots:
		var p: Vector2 = xf * (c.position + c.size * 0.5)
		out.append([snappedf(p.x, 0.1), snappedf(p.y, 0.1)])
	var b: Vector2 = xf * ui.door_overlay.big_center()
	out.append([snappedf(b.x, 0.1), snappedf(b.y, 0.1)])     # [3] = the big card
	return out

func _setup_js() -> void:
	if not OS.has_feature("web"): return
	_js_cb = JavaScriptBridge.create_callback(func(args: Array) -> void: cmd(str(args[0]) if args.size() > 0 else ""))
	var win := JavaScriptBridge.get_interface("window")
	win.ewCmd = _js_cb

func _js_state(dt: float) -> void:
	if _js_cb == null: return
	_js_t -= dt
	if _js_t > 0.0: return
	_js_t = 0.2
	JavaScriptBridge.eval("window.ewState = " + JSON.stringify(state_dict()) + ";", true)
