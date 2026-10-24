class_name Game
extends Node
## EIDOLON: The Threshold. Title -> wake -> free exploration -> shrine finale. Input, interaction,
## events -> sound / text, checkpoint saving to user://, and test hooks (web: window.ewCmd / ewState).

const SHRINES_TOTAL := 7
## hem stripe brightness by number of shrines woken
const HEM_PER_SHRINE := [1.0, 1.8, 2.4, 2.9, 3.3, 3.6, 3.9, 4.2]
const SAVE_PATH := "user://eidolon_world.json"
const MEMORY_LINE := "He carved her a thousand times.\nNone of them would breathe."

static var autotest := false

var world: World
var level: Level
var puzzles: Puzzles
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
var glimpses := {"lag": 0, "gaze": 0}
var interactions := 0
var _save_t := 0.0
var _last_saved_pos := Vector3.INF
var _js_cb: JavaScriptObject
var _js_t := 0.0
var _title_t := 0.0
var _keys := {}
var _finale_t := -1.0

func _ready() -> void:
	if "--autotest" in OS.get_cmdline_user_args(): autotest = true
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
	level.commit()
	sfx = Sfx.new()
	add_child(sfx)
	ui = GameUI.new()
	add_child(ui)
	controls = Controls.new()
	add_child(controls)
	level.read.connect(_on_read)
	puzzles.event.connect(_on_event)
	player.footstep.connect(_on_footstep)
	for r in puzzles.reflectors: r.glimpse.connect(_on_glimpse)
	controls.interact.connect(try_interact)
	controls.rotate.connect(rotate_view)
	ui.anew_pressed.connect(_on_anew)
	_setup_js()
	_load_save()
	# title: the wanderer lies curled beneath the broken gate, the camera drifts round the Threshold
	player.teleport(Level.WAKE_POS, 0.0)
	player.crouch = 1.0
	player.step(0.016)
	world.rig.position = Level.WAKE_POS + Vector3(-0.6, 0.6, 0.4)
	world.cam.size = 8.0
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

func _on_anew() -> void:
	save_data = {}
	_delete_save()
	begin(true)

func _start_wake() -> void:
	mode = "wake"
	puzzles.reset_state()
	puzzles.apply_state(puzzles.state)
	player.teleport(Level.WAKE_POS, 0.0)
	player.crouch = 1.0
	player.locked = true
	_settle_camera(0, Level.WAKE_POS)
	sfx.play("whoosh", -10.0, 0.7)
	sfx.chord([-3, 4, 11], -15.0, 0.3)
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
	var p: Array = save_data.get("pos", [Level.WAKE_POS.x, 0.0, Level.WAKE_POS.z])
	player.teleport(Vector3(p[0], p[1], p[2]), float(save_data.get("yaw", 0.0)))
	player.crouch = 0.0
	awake = bool(puzzles.state["shrine"])
	world.set_awaken(1.0 if awake else 0.0)
	player.fig.set_hem(HEM_PER_SHRINE[1 if awake else 0])
	_settle_camera(int(save_data.get("cam", 0)), player.position)
	mode = "play"
	controls.enabled = true

func _settle_camera(yaw_i: int, at: Vector3) -> void:
	world.follow = null
	create_tween().tween_property(world.cam, "size", World.CAM_SIZE, 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	var cur := world.rig.rotation.y
	var target := -PI * 0.25 + yaw_i * PI * 0.5
	# turn the short way from wherever the title orbit left us
	target = cur + wrapf(target - cur, -PI, PI)
	world.yaw_index = yaw_i
	var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(world.rig, "rotation:y", target, 2.0)
	tw.parallel().tween_property(world.rig, "position", at + Vector3(0, 0.6, 0), 2.0)
	tw.tween_callback(func() -> void: world.follow = player)

func rotate_view(dir: int) -> void:
	if mode != "play" and mode != "wake": return
	world.rotate_view(dir)
	sfx.play("whoosh", -22.0, 1.6)

# ------------------------------------------------------------------ input
func _input(e: InputEvent) -> void:
	if mode == "title":
		var tap := false
		if e is InputEventScreenTouch and e.pressed and not ui.over_anew(e.position): tap = true
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT and not ui.over_anew(e.position): tap = true
		if e is InputEventKey and e.pressed and not e.echo and e.keycode in [KEY_SPACE, KEY_ENTER, KEY_E]: tap = true
		if tap: begin()
		return
	if e is InputEventKey and not e.echo:
		_keys[e.keycode] = e.pressed
		if e.pressed:
			match e.keycode:
				KEY_E, KEY_SPACE, KEY_ENTER: try_interact()
				KEY_Q: rotate_view(-1)
				KEY_R: rotate_view(1)

func _key_vector() -> Vector2:
	var v := Vector2.ZERO
	if _keys.get(KEY_W, false) or _keys.get(KEY_UP, false): v.y -= 1.0
	if _keys.get(KEY_S, false) or _keys.get(KEY_DOWN, false): v.y += 1.0
	if _keys.get(KEY_A, false) or _keys.get(KEY_LEFT, false): v.x -= 1.0
	if _keys.get(KEY_D, false) or _keys.get(KEY_RIGHT, false): v.x += 1.0
	return v.normalized()

func try_interact() -> bool:
	if mode != "play" or focus == null: return false
	interactions += 1
	focus.action.call()
	return true

# ------------------------------------------------------------------ frame
func _process(dt: float) -> void:
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
	puzzles.update(dt)
	if mode == "play": _update_focus()
	else: controls.show_interact("")
	_update_hum()
	if mode != "title":
		var p := player.position
		var wide := p.x > 20.5 and p.z < -18.5     # the eidolon ledge and the shrine: see across the gap
		world.fog_hole_target = Vector2(12.5, 21.0) if wide else Vector2(4.6, 11.0)
		if mode == "play":
			# on the eidolon ledge, frame the player AND the plate across the gap
			var off := Vector3.ZERO
			if p.x > 20.8 and p.z > -25.2 and p.z < -18.8 and not puzzles.state["plate"]:
				off = (Puzzles.PLATE_POS - p) * 0.5
				off.y = 0.0
			world.look_offset = world.look_offset.lerp(off, 1.0 - exp(-dt * 1.5))
	level.beyond.visible = world.awaken > 0.01
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
func _on_read(text: String) -> void:
	ui.show_text(text, player.position)
	sfx.play("chime", -20.0, 0.5)
	if focus and focus.id == "h_tablet":
		puzzles.state["tablet"] = true
		_save()

func _on_footstep(kind: String, strength: float) -> void:
	if kind == "step":
		sfx.play("step", -13.0 + strength * 4.0, randf_range(0.88, 1.08))
	else:
		sfx.play("cloth", -21.0 + strength * 3.0, randf_range(0.85, 1.15))

func _on_glimpse(kind: String) -> void:
	glimpses[kind] = glimpses.get(kind, 0) + 1
	if kind == "gaze":
		# a faint glass chime as the reflection turns away from you
		sfx.play("chime", -21.0, 0.62)
		get_tree().create_timer(0.9).timeout.connect(func() -> void: sfx.play("chime", -26.0, 0.47))

func _on_event(name: String, data: Variant) -> void:
	match name:
		"statue":
			ui.show_rune(data[0], data[1])
			sfx.play("chime", -16.0, 0.75 + data[1] * 0.08)
		"dial":
			sfx.play("grind", -14.0, 1.5)
			sfx.play("chime", -22.0, 1.0 + data * 0.12)
		"door_solved":
			sfx.chord([0, 4, 7, 11], -9.0, 0.12)
			sfx.play("chime", -8.0, 1.0)
		"door_grind":
			sfx.play("door", -3.0, 1.0)
			world.shake(0.45)
		"door_open":
			_save()
		"gate_locked":
			sfx.play("rattle", -9.0, 1.0)
			ui.show_text("It will not open from this side.", player.position, 2.5)
		"gate_open":
			sfx.play("rattle", -6.0, 0.8)
			sfx.play("grind", -8.0, 0.7)
			_save()
		"mirror_turn":
			sfx.play("grind", -15.0, 1.9)
			sfx.play("chime", -24.0, 1.6)
		"beam_lit":
			sfx.play("chime", -8.0, 1.0)
			sfx.play("bell", -10.0, 1.0)
		"bridge_fall":
			sfx.play("whoosh", -8.0, 0.6)
			get_tree().create_timer(0.85).timeout.connect(func() -> void:
				sfx.play("thud", -2.0, 0.6)
				world.shake(0.4))
		"bridge_down":
			_save()
		"plate_touch":
			sfx.play("chime", -18.0, 0.9)
		"plate_glow":
			sfx.chord([-3, 4, 9, 16], -9.0, 0.14)
		"bridge_rise":
			sfx.play("door", -5.0, 0.8)
			world.shake(0.35)
		"plate_open":
			_save()
		"shrine":
			start_finale()
		"sealed":
			sfx.play("rattle", -14.0, 0.6)
			ui.show_text("The way on is sealed.\nAnother shrine still sleeps beyond the fog." if awake else "The way on is sealed.", player.position, 3.0)

# ------------------------------------------------------------------ the finale
func start_finale() -> void:
	if puzzles.state["shrine"]: return
	puzzles.state["shrine"] = true
	mode = "finale"
	player.locked = true
	controls.show_interact("")
	_finale_t = 0.0
	if world.yaw_index % 4 != 0:
		world.rotate_view(-world.yaw_index)
	sfx.swell()
	sfx.play("whoosh", -6.0, 0.5)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: puzzles.set_shrine_awake(v, v), 0.0, 1.0, 3.0).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_method(player.fig.set_hem, HEM_PER_SHRINE[0], HEM_PER_SHRINE[1], 4.0)
	var t2 := create_tween()
	t2.tween_interval(1.2)
	t2.tween_method(world.set_awaken, 0.0, 1.0, 8.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	var t3 := create_tween()
	t3.tween_interval(1.0)
	t3.tween_property(world.cam, "size", World.CAM_SIZE * 1.6, 6.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t3.parallel().tween_property(world, "look_offset", Level.BEYOND_FWD * 9.0 + Vector3(0, 2.0, 0), 6.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t3.tween_interval(9.0)
	t3.tween_property(world.cam, "size", World.CAM_SIZE, 3.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t3.parallel().tween_property(world, "look_offset", Vector3.ZERO, 3.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	var t4 := create_tween()
	t4.tween_interval(3.2)
	t4.tween_callback(func() -> void: ui.show_memory(MEMORY_LINE, 4.5))
	t4.tween_interval(10.5)
	t4.tween_callback(func() -> void:
		ui.show_milestone(1, SHRINES_TOTAL, 3.5)
		sfx.play("bell", -12.0, 0.5))
	t4.tween_interval(5.5)
	t4.tween_callback(func() -> void:
		awake = true
		player.locked = false
		mode = "play"
		_save())

# ------------------------------------------------------------------ save
func _load_save() -> void:
	if not FileAccess.file_exists(SAVE_PATH): return
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if d is Dictionary and d.has("puzzles"): save_data = d

func _save() -> void:
	if mode == "title": return
	var p := player.position
	_last_saved_pos = p
	save_data = {"v": 1, "pos": [p.x, p.y, p.z], "yaw": player.yaw, "cam": world.yaw_index,
		"puzzles": puzzles.state.duplicate(true), "glimpses": glimpses}
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
			world.snap_to(player.position)
		"walk": auto_target = Vector3(float(a[1]), 0, float(a[2]))
		"face": player.yaw = float(a[1]); player.fig.rotation.y = player.yaw
		"input": key_vec = Vector2(float(a[1]), float(a[2]))
		"stop": key_vec = Vector2.ZERO; auto_target = Vector3.INF
		"interact": return try_interact()
		"rotate": rotate_view(int(a[1]))
		"yaw": world.set_yaw_index(int(a[1]))
		"zoom": world.cam.size = float(a[1])
		"slowmo": Engine.time_scale = float(a[1])
		"snd": sfx.play(a[1], float(a[2]) if a.size() > 2 else 0.0)
		"reset_save": _delete_save(); save_data = {}
		"save": _save()
		"finale": start_finale()
		"fogd": world.fog_mats[int(a[1])].set_shader_parameter("density", float(a[2]))
		"envfog": world.env.fog_enabled = a[1] == "1"
		"rp": puzzles.reflectors[int(a[1])].puppet.set_param(a[2], float(a[3]))
		"rpv": puzzles.reflectors[int(a[1])].puppet.set_param(a[2], Vector2(float(a[3]), float(a[4])))
		"refl":
			for r in puzzles.reflectors:
				print(r.kind, " clip_c=", r.puppet.body_mat.get_shader_parameter("clip_c"), " clip_h=", r.puppet.body_mat.get_shader_parameter("clip_h"), " u=", r.puppet.body_mat.get_shader_parameter("clip_u"), " v=", r.puppet.body_mat.get_shader_parameter("clip_v"), " n=", r.puppet.body_mat.get_shader_parameter("plane_n"), " d=", r.puppet.body_mat.get_shader_parameter("plane_d"))
				print(r.kind, " active=", r.active, " vis=", snappedf(r.vis, 0.01), " puppet=", r.puppet.global_position, " vis_node=", r.puppet.is_visible_in_tree(), " basis_det=", r.puppet.global_transform.basis.determinant())
	return true

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
		"sfx_ready": sfx.ready_ok, "played": sfx.played, "buses": buses, "drone": sfx.drone.playing, "speed": player.speed01,
		"joy": controls.joy_index, "touches": controls._touches.size(), "vec": [snappedf(controls.vec.x, 0.01), snappedf(controls.vec.y, 0.01)], "ctl": controls.enabled,
		"memory": snappedf(ui.memory.modulate.a, 0.01), "counter": snappedf(ui.end_b.modulate.a, 0.01), "title_reveal": ui.title_word.reveal}

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
