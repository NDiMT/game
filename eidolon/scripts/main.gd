class_name Game
extends Node
## EIDOLON: state machine (title -> select -> play -> solved), input, undo, saving, story, test hooks.

const SAVE_PATH := "user://eidolon_save.json"
const SWIPE_MIN := 22.0
const HINTS := {1: "swipe to roll the stone  ·  your eidolon answers in the glass",
	2: "a column stops the eidolon, but not you",
	6: "this glass rides a rail, and slides against your every step"}
const ENDING := "Only the reflection remained. It was enough to carry."

static var autotest := false

var world: World
var ui: GameUI
var sfx: Sfx
var board: Board
var levels: Array = []
var level_index := 0
var rules: Rules
var state: Dictionary
var history: Array = []
var moves := 0
var mode := "boot"            # boot, title, select, play, solved, transition
var best := {}
var queued := Vector2i.ZERO
var _touches := {}
var _gesture := ""            # "", "single", "multi", "ignored"
var _swipe_dir := Vector2i.ZERO
var _multi_start := {}
var _js_cb: JavaScriptObject
var _js_t := 0.0
var _title_spin := true
var solved_count := 0
var swipes := 0
var board_gone := false

func _ready() -> void:
	if "--autotest" in OS.get_cmdline_user_args(): autotest = true
	levels = Rules.load_all()
	_load_save()
	world = World.new()
	add_child(world)
	sfx = Sfx.new()
	add_child(sfx)
	ui = GameUI.new()
	add_child(ui)
	ui.begin_pressed.connect(_on_begin)
	ui.level_chosen.connect(_on_level_chosen)
	ui.action.connect(_on_action)
	_setup_js()
	# title: level I rises out of the fog behind the word
	_load_level(0, false)
	ui.set_screen("title")
	mode = "title"
	board.set_rise(0.0)
	ui.title_word.reveal = 0.0
	var tw := create_tween()
	tw.tween_property(ui.fade, "color:a", 0.0, 1.6)
	tw.parallel().tween_method(board.set_rise, 0.0, 1.0, 2.6).set_delay(0.3)
	tw.parallel().tween_method(func(v: float) -> void:
		ui.title_word.reveal = v
		ui.title_word.queue_redraw(), 0.0, 1.0, 2.4).set_delay(0.8)

# ------------------------------------------------------------------ flow
func _on_begin() -> void:
	if mode != "title": return
	sfx.start_drone()
	sfx.chord([-3, 4, 11], -14.0, 0.25)
	_show_select()

func _show_select() -> void:
	mode = "select"
	_title_spin = true
	ui.refresh_select(levels, best)
	ui.set_screen("select")
	if not board_gone:
		board_gone = true
		create_tween().tween_method(board.set_dissolve, 0.0, 1.0, 1.4)

func _on_level_chosen(i: int) -> void:
	if mode != "select": return
	sfx.play("chime", -14.0, 0.75)
	_title_spin = false
	world.rotate_view(0)
	mode = "transition"
	ui.set_screen("play")
	ui.hud.modulate.a = 0.0
	await _transition_to(i)

func _transition_to(i: int) -> void:
	mode = "transition"
	sfx.play("whoosh", -10.0, 1.0)
	if not board_gone:
		var tw := create_tween()
		tw.tween_method(board.set_dissolve, 0.0, 1.0, 1.6)
		await tw.finished
	else:
		await get_tree().create_timer(0.4).timeout
	_load_level(i, true)
	board_gone = false
	board.set_rise(0.0)
	sfx.play("thud", -16.0, 0.55)
	var tr := create_tween()
	tr.tween_method(board.set_rise, 0.0, 1.0, 1.9)
	tr.parallel().tween_property(ui.hud, "modulate:a", 1.0, 1.2).set_delay(0.6)
	await tr.finished
	mode = "play"
	ui.show_hint(HINTS.get(rules.id, ""))

func _load_level(i: int, frame_anim: bool) -> void:
	level_index = i
	rules = levels[i]
	state = Rules.copy_state(rules.start)
	history.clear()
	moves = 0
	queued = Vector2i.ZERO
	if board:
		board.queue_free()
	board = Board.new()
	board.name = "Board"
	world.add_child(board)
	board.setup(rules, state, world.noise_tex)
	board.turn_finished.connect(_on_turn_finished)
	board.mirror_moved.connect(_on_mirror_moved)
	board.cube_landed.connect(func(_p: Vector3) -> void: sfx.play("thud", -3.0, randf_range(0.9, 1.08)))
	world.frame_board(rules.w, rules.h, not frame_anim)
	ui.set_level(rules, 0)

func _on_action(name: String) -> void:
	match name:
		"undo": undo()
		"restart": restart()
		"rotl": rotate_view(-1)
		"rotr": rotate_view(1)
		"menu":
			if mode == "play":
				board.hide_preview()
				_show_select()

# ------------------------------------------------------------------ moves
func try_move(d: Vector2i) -> bool:
	if mode != "play": return false
	if board.busy:
		queued = d
		return false
	var ev := rules.step(state, d)
	if not ev["changed"]:
		board.play_turn(ev, d)
		sfx.play("thud", -16.0, 1.5)
		return false
	ui.fade_hint()
	var before := rules.lit(state)
	history.append(Rules.copy_state(state))
	state = ev["state"]
	moves += 1
	ui.set_moves(moves)
	var eid_moved := false
	for i in rules.mirrors.size():
		if ev["state"]["eids"][i] != ev["eid_from"][i]: eid_moved = true
	if eid_moved:
		sfx.play("chime", -15.0, [1.0, 1.122, 1.335, 1.498][moves % 4])
	board.play_turn(ev, d)
	var after := rules.lit(state)
	for k in after.size():
		if after[k] and not before[k]:
			get_tree().create_timer(0.3).timeout.connect(func() -> void: sfx.play("piano", -13.0, pow(2.0, [7, 11, 14][k % 3] / 12.0)))
	return true

func _on_mirror_moved(strength: float) -> void:
	sfx.play("grind", -4.0, randf_range(0.92, 1.05))
	world.shake(0.10 + 0.04 * strength)
	Input.vibrate_handheld(18)

func _on_turn_finished() -> void:
	if mode == "play" and rules.won(state):
		_solved()
		return
	if queued != Vector2i.ZERO:
		var d := queued
		queued = Vector2i.ZERO
		try_move(d)

func undo() -> void:
	if mode != "play" or board.busy or history.is_empty(): return
	state = history.pop_back()
	moves -= 1
	ui.set_moves(moves)
	board.set_state(state)
	sfx.play("chime", -18.0, 0.6)

func restart() -> void:
	if mode != "play" or board.busy or moves == 0: return
	history.clear()
	state = Rules.copy_state(rules.start)
	moves = 0
	ui.set_moves(0)
	board.set_state(state)
	sfx.play("whoosh", -14.0, 1.6)

func rotate_view(dir: int) -> void:
	if mode == "title": return
	world.rotate_view(dir)
	sfx.play("whoosh", -20.0, 2.2)

func _solved() -> void:
	mode = "solved"
	solved_count += 1
	var key := str(rules.id)
	if not best.has(key) or moves < int(best[key]):
		best[key] = moves
	_save()
	ui.show_par(moves, rules.par)
	board.pulse_win()
	sfx.chord([-3, 4, 7, 11, 16], -5.0, 0.11)
	await get_tree().create_timer(1.0).timeout
	ui.show_story(rules.line, 2.6)
	await get_tree().create_timer(1.8).timeout
	if level_index + 1 < levels.size():
		await _transition_to(level_index + 1)
	else:
		var tw := create_tween()
		tw.tween_method(board.set_dissolve, 0.0, 1.0, 2.0)
		await tw.finished
		board_gone = true
		await get_tree().create_timer(1.0).timeout
		ui.show_story(ENDING, 3.0)
		await get_tree().create_timer(4.5).timeout
		_show_select()

# ------------------------------------------------------------------ input
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		_key(e)
		return
	# real touches arrive as ScreenTouch/Drag; a real mouse is handled here as pointer 99 (Godot's own
	# mouse->touch emulation is off because browsers on touch-capable laptops disable it). Mouse events
	# that Godot synthesises from touches carry DEVICE_ID_EMULATION and are ignored.
	if e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed: _press(t.index, t.position)
		else: _release(t.index, t.position)
	elif e is InputEventScreenDrag:
		var dr := e as InputEventScreenDrag
		_drag(dr.index, dr.position)
	elif e is InputEventMouseButton and e.device != InputEvent.DEVICE_ID_EMULATION:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed: _press(99, mb.position)
			else: _release(99, mb.position)
	elif e is InputEventMouseMotion and e.device != InputEvent.DEVICE_ID_EMULATION:
		if _touches.has(99): _drag(99, (e as InputEventMouseMotion).position)

func _press(index: int, pos: Vector2) -> void:
	_touches[index] = {"start": pos, "pos": pos}
	if _touches.size() == 1:
		_gesture = "ignored" if (ui.is_over_button(pos) or mode != "play") else "single"
		_swipe_dir = Vector2i.ZERO
	else:
		if _gesture == "single": board.hide_preview()
		_gesture = "multi"
		_multi_start = {}
		for k in _touches: _multi_start[k] = _touches[k]["pos"]

func _release(index: int, pos: Vector2) -> void:
	if not _touches.has(index): return
	_touches[index]["pos"] = pos
	if _gesture == "single" and _touches.size() == 1:
		var delta: Vector2 = pos - _touches[index]["start"]
		board.hide_preview()
		if delta.length() >= SWIPE_MIN:
			swipes += 1
			try_move(world.grid_dir_for_screen(delta))
	elif _gesture == "multi" and _touches.size() == 2:
		_finish_multi()
	_touches.erase(index)
	if _touches.is_empty(): _gesture = ""

func _drag(index: int, pos: Vector2) -> void:
	if not _touches.has(index): return
	_touches[index]["pos"] = pos
	if _gesture == "single" and mode == "play" and not board.busy:
		var delta: Vector2 = pos - _touches[index]["start"]
		if delta.length() >= SWIPE_MIN:
			var d := world.grid_dir_for_screen(delta)
			if d != _swipe_dir:
				_swipe_dir = d
				board.show_preview(rules.step(state, d))
		else:
			_swipe_dir = Vector2i.ZERO
			board.hide_preview()

func _finish_multi() -> void:
	var keys := _touches.keys()
	if keys.size() < 2 or not _multi_start.has(keys[0]) or not _multi_start.has(keys[1]): return
	var a0: Vector2 = _multi_start[keys[0]]; var b0: Vector2 = _multi_start[keys[1]]
	var a1: Vector2 = _touches[keys[0]]["pos"]; var b1: Vector2 = _touches[keys[1]]["pos"]
	var ang := wrapf((b1 - a1).angle() - (b0 - a0).angle(), -PI, PI)
	var centroid := ((a1 + b1) - (a0 + b0)) * 0.5
	if absf(ang) > 0.35:
		rotate_view(1 if ang > 0.0 else -1)
	elif centroid.length() > 50.0:
		undo()

func _key(e: InputEventKey) -> void:
	if mode == "title":
		if e.keycode in [KEY_SPACE, KEY_ENTER]: _on_begin()
		return
	if mode == "select":
		if e.keycode in [KEY_SPACE, KEY_ENTER]:
			var i := 0
			for k in levels.size():
				if not ui.medallions[k].locked: i = k
			_on_level_chosen(i)
		return
	# screen-relative: Up = up-left, Right = up-right, Down = down-right, Left = down-left (iso diagonals)
	var sv := Vector2.ZERO
	match e.keycode:
		KEY_UP, KEY_W: sv = Vector2(-1, -1)
		KEY_RIGHT, KEY_D: sv = Vector2(1, -1)
		KEY_DOWN, KEY_S: sv = Vector2(1, 1)
		KEY_LEFT, KEY_A: sv = Vector2(-1, 1)
		KEY_Z, KEY_BACKSPACE: undo()
		KEY_R: restart()
		KEY_Q: rotate_view(-1)
		KEY_E: rotate_view(1)
		KEY_ESCAPE: _on_action("menu")
	if sv != Vector2.ZERO:
		try_move(world.grid_dir_for_screen(sv))

func _process(dt: float) -> void:
	if _title_spin and (mode == "title" or mode == "select"):
		world.rig.rotation.y += dt * 0.06
	_js_state(dt)

# ------------------------------------------------------------------ save
func _load_save() -> void:
	if not FileAccess.file_exists(SAVE_PATH): return
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if d is Dictionary and d.has("best"): best = d["best"]

func _save() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f: f.store_string(JSON.stringify({"best": best, "version": 1}))

# ------------------------------------------------------------------ test hooks (web)
## window.eidolonCmd('begin'|'play:N'|'move:R'|'solve_step'|'preview:R'|'rotate:1'|'undo'|'reset_save');
## window.eidolonState mirrors {mode, level, moves, ...}.
func _setup_js() -> void:
	if not OS.has_feature("web"): return
	_js_cb = JavaScriptBridge.create_callback(_on_js_cmd)
	var win := JavaScriptBridge.get_interface("window")
	win.eidolonCmd = _js_cb

func _on_js_cmd(args: Array) -> void:
	var cmd := str(args[0]) if args.size() > 0 else ""
	var parts := cmd.split(":")
	match parts[0]:
		"begin": _on_begin()
		"play": _on_level_chosen(int(parts[1]) - 1)
		"move": try_move(Rules.DNAME[parts[1]])
		"preview": board.show_preview(rules.step(state, Rules.DNAME[parts[1]]))
		"rotate": rotate_view(int(parts[1]))
		"slowmo": Engine.time_scale = float(parts[1])
		"undo": undo()
		"restart": restart()
		"menu": _on_action("menu")
		"solve_step":
			var path := str(rules.solve(500000, state)["path"])
			if path.length() > 0: try_move(Rules.DNAME[path[0]])
		"unlock_all":
			for r: Rules in levels:
				if not best.has(str(r.id)): best[str(r.id)] = r.par + (r.id % 3)
			ui.refresh_select(levels, best)
		"reset_save":
			best = {}
			_save()

func _js_state(dt: float) -> void:
	if _js_cb == null: return
	_js_t -= dt
	if _js_t > 0.0: return
	_js_t = 0.2
	var st := {"mode": mode, "level": rules.id if rules else 0, "moves": moves, "busy": board.busy if board else false,
		"won": rules.won(state) if rules else false, "fps": Engine.get_frames_per_second(), "yaw": world.yaw_index,
		"solved": solved_count, "swipes": swipes, "gesture": _gesture, "best_count": best.size(), "dissolved": board_gone, "draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)}
	JavaScriptBridge.eval("window.eidolonState = " + JSON.stringify(st) + ";", true)
