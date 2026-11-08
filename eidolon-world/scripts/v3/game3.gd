class_name Game3
extends Game
## v3 (dev/CH1_V3.md): the new Chapter I, run in PARALLEL with the live v2 (scenes/main3.tscn; the web export still
## starts scenes/main.tscn until v3 swaps in). It reuses the kept systems as they are (World, Level's walking and
## kit, Player, Controls, UI, Sfx, Highlight, Cinematic, Reflector / PlanarMirror) and none of v2's chapter code:
## the world is World3 (from Map3), the puzzles are Ch1v3's (one Puzzle each), the save is its own file.
## Test hooks: cmd() adds "v3jump:<space or part>", "pz_solve:<id>", "pz_auto:<id>"; state3() for tests.

const SAVE3_PATH := "user://eidolon_v3.json"
var ch: Ch1v3
var space := ""
var part := ""

func _ready() -> void:
	HeroineRig.VARIANT = "v1"
	if "--autotest" in OS.get_cmdline_user_args(): autotest = true
	Palette.push()
	world = World.new()
	add_child(world)
	level = Level.new(world.noise_tex)
	add_child(level)
	World3.build(level)
	player = Player.new()
	player.level = level
	add_child(player)
	sfx = Sfx.new()
	add_child(sfx)
	ui = GameUI.new()
	add_child(ui)
	controls = Controls.new()
	add_child(controls)
	ui.controls = controls
	ch = Ch1v3.new(self)
	add_child(ch)
	ch.build()
	level.commit()
	World3.post(level, self, level)
	ch.post()
	highlight = Highlight.new()
	add_child(highlight)
	highlight.setup([ch], [level.marble_mat, level.marble_occ_mat])
	var au := level.auto_solids([ch])
	print("[v3] %d spaces, %d regions, %d solid footprints (%d ms)" % [Map3.SPACES.size(), level.regions.size(), au["solids"].size(), au["ms"]])
	controls.interact.connect(try_interact)
	_load3()
	var p0: Vector3 = save_data.get("pos_v", Vector3.INF) if not save_data.is_empty() else Vector3.INF
	if p0 == Vector3.INF:
		var s := Map3.start_of("act1")
		p0 = Vector3(s.x, 0.0, s.y)
	player.teleport(p0, PI * 0.5)
	world.follow = player
	world.snap_to(player.position)
	mode = "play"
	ui.hide_title()
	ui.fade_to(0.0, 0.6)

func _input(e: InputEvent) -> void:
	if e is InputEventKey and e.keycode == KEY_F: return          # (v2's lens: the Shard comes in phase 3)
	super._input(e)

func _process(dt: float) -> void:
	_world_block_t = maxf(0.0, _world_block_t - dt)
	if mode == "play":
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
		player.input_dir = Vector2(dir.x, dir.z)
		player.stick_turn = auto_target == Vector3.INF and kv == Vector2.ZERO and key_vec == Vector2.ZERO
	else:
		player.input_dir = Vector2.ZERO
	player.step(dt)
	world.update_reveal(level.occluders, player.position, dt)
	if world.reveal_k > 0.02:
		_fade_on = true
		_fade_off_t = 0.6
	elif world.reveal_k <= 0.001:
		_fade_off_t -= dt
		if _fade_off_t <= 0.0: _fade_on = false
	level.set_fade(player.position, _fade_on)
	if mode != "cine": level.cull_far(player.position, dt)
	for r in World3.mirrors.values(): (r as Reflector).update(dt, player, world.cam_back)
	for r in ch.reflectors: r.update(dt, player, world.cam_back)
	ch.update(dt)
	if mode == "cine":
		_skip_t = _skip_t + dt if _skip_hold else maxf(0.0, _skip_t - dt * 3.0)
		ui.set_skip(clampf(_skip_t / 1.1, 0.0, 1.0), _skip_hold or _skip_t > 0.0)
		if _skip_t >= 1.1 and cine:
			_skip_t = 0.0
			_skip_hold = false
			cine.skip()
	if mode == "play": _focus3()
	else: controls.show_interact("")
	highlight.update(dt)
	Flame.cull(player.position, dt)
	if mode == "play": world.cam_size_target = world.zoom
	_area3()
	if mode == "play":
		_save_t += dt
		if _save_t > 6.0 and player.speed01 < 0.05 and auto_target == Vector3.INF:
			_save_t = 0.0
			if _last_saved_pos == Vector3.INF or player.position.distance_to(_last_saved_pos) > 0.5: save3()

func _focus3() -> void:
	var best: Level.Interact = null
	var bd := INF
	var p := player.position
	for it in level.interacts:
		if not it.enabled: continue
		if it.cond.is_valid() and not it.cond.call(): continue
		if absf(it.pos.y - p.y) > 1.3: continue
		var d := Vector2(it.pos.x - p.x, it.pos.z - p.z).length()
		if d < it.radius and d < bd:
			bd = d
			best = it
	focus = best
	player.anticipate = 1.0 if best else 0.0
	controls.show_interact(best.icon if best else "")
	highlight.set_target(best)

## the space she stands in (doorways count as the space they lead from), its part and A's mood for it
func _area3() -> void:
	var g := level.region_at(Vector2(player.position.x, player.position.z))
	if g == null: return
	var k := Map3.key_of_region(g.name)
	if k == "" or k == space: return
	space = k
	var pt := Map3.part_of(k)
	if pt == "act1" and k == "A": pt = "hub"
	if k == "A": pt = "hub"
	if pt != part:
		part = pt
		world.set_mood(str(Map3.MOOD.get(pt, "act1")))

## a cinematic run by the v3 game (the prologue later; tests now): the gameplay camera waits, a long press skips
func play_cine(c: Cinematic) -> void:
	cine = c
	add_child(c)
	mode = "cine"
	controls.enabled = false
	c.finished.connect(func() -> void:
		mode = "play"
		controls.enabled = true
		world.cam_lock = false
		world.follow = player
		c.queue_free()
		cine = null, CONNECT_ONE_SHOT)
	c.start()

func cmd(c: String) -> Variant:
	var a := c.split(":")
	match a[0]:
		"v3jump":
			var at: Vector2
			if a[1] in Map3.PARTS: at = Map3.start_of(a[1])
			else: at = Map3.walk_rect(a[1]).get_center()
			return super.cmd("tp:%f:%f" % [at.x, at.y])
		"pz_solve": (ch.pz[a[1]] as Puzzle).solve(); return true
		"pz_auto": (ch.pz[a[1]] as Puzzle).autosolve(); return true
		"save": save3(); return true
	return super.cmd(c)

func state3() -> Dictionary:
	var p := player.position
	return {"pos": [p.x, p.y, p.z], "space": space, "part": part, "mode": mode, "pz": ch.save_state()}

# ------------------------------------------------------------------ save (its own file: the live v2 save is untouched)
func save3() -> void:
	var p := player.position
	var d := {"v": 1, "pos": [p.x, p.y, p.z], "yaw": player.yaw, "pz": ch.save_state()}
	var f := FileAccess.open(SAVE3_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))
		_last_saved_pos = p

func _load3() -> void:
	save_data = {}
	if Game.autotest and not ("--keep-save" in OS.get_cmdline_user_args()): return
	if not FileAccess.file_exists(SAVE3_PATH): return
	var j = JSON.parse_string(FileAccess.get_file_as_string(SAVE3_PATH))
	if not (j is Dictionary): return
	save_data = j
	var pp: Array = j.get("pos", [])
	if pp.size() == 3: save_data["pos_v"] = Vector3(pp[0], pp[1], pp[2])
	ch.load_state(j.get("pz", {}))

func _delete_save() -> void:
	if FileAccess.file_exists(SAVE3_PATH): DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE3_PATH))

## (devshot / web state) the v3 state, not v2's
func state_dict() -> Dictionary:
	return state3()
