class_name Game3
extends Game
## v3 (dev/CH1_V3.md): the new Chapter I, run in PARALLEL with the live v2 (scenes/main3.tscn; the web export still
## starts scenes/main.tscn until v3 swaps in). It reuses the kept systems as they are (World, Level's walking and
## kit, Player, Controls, UI, Sfx, Juice, Highlight, Cinematic, Reflector / PlanarMirror) and none of v2's chapter
## code: the world is World3 (from Map3), the beats are Ch1v3's (one Puzzle each), the save is its own file.
## Flow: title -> (first time) the cards + the prologue "Η Αρπαγή" (Prologue3; unskippable the first time, then a
## long press skips it) -> Act 1 (I.1..I.5) -> the Atrium (I.6). Footsteps come from the rig's real foot plants.
## Test hooks: cmd() adds "v3jump:<space or part>", "pz_solve:<id>", "pz_auto:<id>", "prologue", "cine_at:<s>",
## "give:<item>"; state3() for tests. `--autotest` starts in play at Act 1's start (no title, no prologue).

const SAVE3_PATH := "user://eidolon_v3.json"
const WALK_SPEED := 1.95          # (A: 2.7 m/s made her scurry under the gown; ~2 steps/s reads calm)
var ch: Ch1v3
var space := ""
var part := ""
var items: Array = []             # "comb" (story), "lamp" (tool)
var seen := {}                    # "prologue"
var lamp_node: Node3D
var _acting := false
var lens_on := false              # (phase 3) the Shard raised: her world shows through its circle (lens_only shaders)
var lens_at := Vector3.INF        # a beat may hold the lens over a point (the W.4 star, the W.6 door); else over her head

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
	player.speed = WALK_SPEED
	player.rig_steps = true
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
	Dress3.dress_all(level, level)
	highlight = Highlight.new()
	add_child(highlight)
	highlight.setup([ch], [level.marble_mat, level.marble_occ_mat])
	var au := level.auto_solids([ch])
	print("[v3] %d spaces, %d regions, %d solid footprints (%d ms)" % [Map3.SPACES.size(), level.regions.size(), au["solids"].size(), au["ms"]])
	juice = Juice.new()
	add_child(juice)
	juice.setup(self)
	controls.interact.connect(try_interact)
	controls.shard.connect(func() -> void: if mode == "play": set_lens(not lens_on))
	if player.fig.rig: player.fig.rig.step.connect(_on_rig_step)
	var gt := ui.glass_talk
	gt.solved.connect(func(id: String) -> void:
		ch.glass_solved(id)
		get_tree().create_timer(3.4).timeout.connect(_glass_closed))
	gt.closed.connect(func(_id: String) -> void: _glass_closed())
	gt.sound.connect(_glass_sound)
	ui.anew_pressed.connect(_on_anew)
	_setup_js()
	_load3()
	if autotest and not ("--title" in OS.get_cmdline_user_args()):
		_place_from_save()
		mode = "play"
		controls.enabled = true
		ui.hide_title()
		ui.fade_to(0.0, 0.6)
		return
	# the title: she lies curled on the marble lip of the black pool (the prologue's first frame, from above)
	player.teleport(Prologue3.WS.LIE, Prologue3.WS.LIE_YAW)
	if player.fig.rig: player.fig.rig.play("lie_side")
	world.snap_to(player.position)
	mode = "title"
	ui.set_continue(not save_data.is_empty())
	ui.fade_to(0.0, 1.8)
	ui.title_word.reveal = 0.0
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		ui.title_word.reveal = v
		ui.title_word.queue_redraw(), 0.0, 1.0, 2.4).set_delay(0.8)

func _input(e: InputEvent) -> void:
	if e is InputEventKey and e.keycode == KEY_F:
		if e.pressed and not e.echo and mode == "play": set_lens(not lens_on)
		return
	super._input(e)

# ------------------------------------------------------------------ flow
func _start_wake() -> void:
	reset_progress()
	play_prologue()

func _continue_from_save() -> void:
	if not seen.get("prologue", false):
		_start_wake()
		return
	_place_from_save()
	mode = "play"
	controls.enabled = true
	ui.fade_to(0.0, 0.8)

func _place_from_save() -> void:
	if player.fig.rig: player.fig.rig.stop(0.01)
	var p0: Vector3 = save_data.get("pos_v", Vector3.INF) if not save_data.is_empty() else Vector3.INF
	if p0 == Vector3.INF:
		var s := Map3.start_of("act1")
		p0 = Vector3(s.x, 0.0, s.y)
	player.teleport(p0, float(save_data.get("yaw", PI * 0.5)))
	player.locked = false
	world.follow = player
	world.cam_lock = false
	world.snap_to(player.position)
	_apply_items()

func reset_progress() -> void:
	ch.load_state({})
	items = []
	seen = {}
	set_lens(false)
	_apply_items()

## the cards + "Η Αρπαγή"; the first time it cannot be skipped
func play_prologue() -> void:
	var p := Prologue3.new(self)
	p.finished.connect(_end_prologue, CONNECT_ONE_SHOT)
	cine = p
	add_child(p)
	mode = "cine"
	controls.enabled = false
	controls.reset()
	_skip_t = 0.0
	_skip_hold = false
	p.begin()

func _end_prologue() -> void:
	seen["prologue"] = true
	if not ("comb" in items): items.append("comb")
	(ch.pz["WS"] as Puzzle).solve()
	player.locked = false
	world.cam_lock = false
	world.follow = player
	world.look_offset = Vector3.ZERO
	world.cam_size_target = world.zoom
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
	save3()

# ------------------------------------------------------------------ frame
func _process(dt: float) -> void:
	_world_block_t = maxf(0.0, _world_block_t - dt)
	if mode == "play" and not _acting:
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
	for r in ch.reflectors:
		if not r.has_meta("cine"): r.update(dt, player, world.cam_back)
	ch.update(dt)
	if mode == "cine":
		var can: bool = cine != null and (bool(seen.get("prologue", false)) or not (cine is Prologue3))
		_skip_t = _skip_t + dt if (_skip_hold and can) else maxf(0.0, _skip_t - dt * 3.0)
		ui.set_skip(clampf(_skip_t / 1.1, 0.0, 1.0), can and (_skip_hold or _skip_t > 0.0))
		if _skip_t >= 1.1 and cine:
			_skip_t = 0.0
			_skip_hold = false
			cine.skip()
	if mode == "play": _focus3()
	else: controls.show_interact("")
	_update_lens()
	highlight.update(dt)
	Flame.cull(player.position, dt)
	if mode == "play": world.cam_size_target = world.zoom
	_area3()
	_js_state(dt)
	if mode == "play":
		_save_t += dt
		if _save_t > 6.0 and player.speed01 < 0.05 and auto_target == Vector3.INF:
			_save_t = 0.0
			if _last_saved_pos == Vector3.INF or player.position.distance_to(_last_saved_pos) > 0.5: save3()

func _focus3() -> void:
	var best: Level.Interact = null
	var bd := INF
	var p := player.position
	if not _acting:
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
	var first := not ch.visited.has(k)
	ch.visited[k] = true
	space = k
	var pt := Map3.part_of(k)
	if k == "A": pt = "hub"
	if pt != part:
		part = pt
		if mode != "cine": world.set_mood(str(Map3.MOOD.get(pt, "act1")))
	if first and mode == "play" and not k.contains("~"):
		var sp := Map3.space(k)
		if sp.size() > 3 and str(sp[3]) in ["hub", "landmark"]: ui.show_area(str(sp[2]))

# ------------------------------------------------------------------ the heroine acts (A's clips at each interaction)
## she turns to `at`, plays `clip` (reach, pickup, kneel_touch, touch_glass) and calls `then` at the clip's contact
## event (or at its end); input waits until the clip is done. `hold`: a held clip waits at its hold point until
## the returned release is called (or for hold_s seconds).
## (phase 4) the clips W asks A for, by name; until A's clip lands, the nearest one there is plays ("" = none: the
## beat's own motion carries it). A's clip replaces the stand-in by name, with no change here.
const CLIP_STANDIN := {"push": "reach", "light_with_lamp": "reach", "reach_high": "reach", "ring_bell": "reach",
	"reach_low": "kneel_touch", "sit_bench": "", "hide_column": "", "flinch_seen": "recoil", "statue_still": "",
	"palm_to_palm": "kneel_reach", "hang_weight": "reach"}

func perform(clip: String, at: Vector3, then: Callable = Callable(), n := Vector3.ZERO, hold_s := 0.0) -> void:
	if _acting: return
	if not HeroineClips.has(clip) and CLIP_STANDIN.has(clip): clip = str(CLIP_STANDIN[clip])
	var rig := player.fig.rig
	auto_target = Vector3.INF
	key_vec = Vector2.ZERO
	var to := at - player.position
	if Vector2(to.x, to.z).length() > 0.05:
		var yaw := atan2(-to.x, -to.z)
		var tw := create_tween()
		tw.tween_method(func(v: float) -> void:
			player.yaw = v
			player.fig.rotation.y = v, player.yaw, player.yaw + wrapf(yaw - player.yaw, -PI, PI), 0.28).set_trans(Tween.TRANS_SINE)
	if rig == null or not HeroineClips.has(clip):
		if then.is_valid(): then.call()
		return
	_acting = true
	player.locked = true
	var opts := {"at": at}
	if n != Vector3.ZERO: opts["n"] = n
	if hold_s > 0.0: opts["hold"] = true
	var fired := [false]
	var fire := func() -> void:
		if fired[0]: return
		fired[0] = true
		if then.is_valid(): then.call()
	var on_ev := func(c: String, _ev: String) -> void: if c == clip: fire.call()
	rig.clip_event.connect(on_ev)
	var dur := rig.play(clip, opts)
	var total := dur + hold_s
	if hold_s > 0.0: get_tree().create_timer(hold_s + dur * 0.5).timeout.connect(func() -> void: rig.release())
	get_tree().create_timer(total * 0.9).timeout.connect(func() -> void:
		fire.call()
		if rig.clip_event.is_connected(on_ev): rig.clip_event.disconnect(on_ev)
		player.locked = false
		_acting = false)

func _on_rig_step(_side: int) -> void:
	if mode != "play" and mode != "cine": return
	if player.locked and mode == "play": return
	var surf := "water" if _wet(player.position) else "stone"
	sfx.footstep(surf, maxf(player.speed01, 0.5))
	if surf == "stone" and randf() < 0.35: player_dust()
	elif surf == "water" and juice: juice.ring(player.position + Vector3(0, 0.012, 0), 0.7, 0.8)
	_step_cloth = not _step_cloth
	if _step_cloth: sfx.play("cloth", -34.0 + player.speed01 * 3.0, randf_range(0.85, 1.15))
var _step_cloth := false

func _wet(p: Vector3) -> bool:
	for id in ch.pz:
		var pz: Puzzle = ch.pz[id]
		if pz.has_method("wet_at") and pz.call("wet_at", p): return true
	return false

# ------------------------------------------------------------------ items (Chapter I: the comb, the Lamp)
func has_item(k: String) -> bool:
	return k in items

func give(k: String, show := true) -> void:
	if not (k in items): items.append(k)
	if show: ui.show_item(k)
	_apply_items()

func _apply_items() -> void:
	var rig := player.fig.rig
	var lamp := has_item("lamp")
	if lamp and lamp_node == null and rig:
		lamp_node = Kit3.lamp(self, true)
		rig.hand_node("R").add_child(lamp_node)
		lamp_node.position = Vector3(0.0, -0.02, 0.0)
	if lamp_node: lamp_node.visible = lamp
	if rig: rig.hold("lamp" if lamp else "")
	ui.set_inventory(has_item("shard"), lens_on)

# ------------------------------------------------------------------ the Shard (W.3 gives it; W.4 teaches it; W.6 uses it)
func set_lens(on: bool) -> void:
	if on and not has_item("shard"): return
	if on == lens_on: return
	lens_on = on
	sfx.play("glass_tink", -20.0, 1.25 if on else 0.85)
	ui.set_inventory(has_item("shard"), on)
	if not on:
		RenderingServer.global_shader_parameter_set("shard_lens", Vector4.ZERO)
		ui.set_lens(false, Vector2.ZERO, 0.0)

func _update_lens() -> void:
	if not lens_on: return
	if mode != "play" and mode != "glass":
		set_lens(false)
		return
	var vp := get_viewport()
	var cam := world.cam
	var vis := vp.get_visible_rect().size
	var sp := cam.unproject_position(player.position + Vector3(0, 1.5, 0))
	var r := vis.x * 0.42
	if lens_at != Vector3.INF: sp = sp.lerp(cam.unproject_position(lens_at), 0.7)
	# (3D shaders see FRAGCOORD in render-target pixels: the window size x the 3D render scale)
	var k := Vector2(vp.size) * vp.scaling_3d_scale / vis
	RenderingServer.global_shader_parameter_set("shard_lens", Vector4(sp.x * k.x, sp.y * k.y, r * k.x, 1.0))
	ui.set_lens(true, sp, r)

## (W.1) the Stair of Breath's three glasses: one stroke each; the third is traced as SEEN
func open_glass(id: String) -> void:
	if not id.begins_with("w1_"):
		super.open_glass(id)
		return
	if mode != "play": return
	mode = "glass"
	player.input_dir = Vector2.ZERO
	auto_target = Vector3.INF
	key_vec = Vector2.ZERO
	controls.enabled = false
	controls.reset()
	controls.show_interact("")
	ui.hide_text()
	var k := clampi(int(id.substr(3)), 1, 3)
	ui.glass_talk.open({"id": id, "first": "", "question": ["w1_a", "w1_b", "w1_c"][k - 1], "at_q": Vector2.ZERO, "seen": k == 3})

## the Lamp's world position (crypt darkness, Beacons later), or INF
func lamp_pos() -> Vector3:
	return lamp_node.global_position if lamp_node and lamp_node.visible else Vector3.INF

## (I.20 later, tests now) the pool's road: the waking pool is water until Act 3 raises its stones
func set_pool_road(on: bool) -> void:
	for g in level.regions:
		var k := Map3.key_of_region(g.name)
		for pid in Map3.POOLS:
			if k == pid or g.name.contains("~" + pid) or g.name.begins_with(Map3.ZP + pid + "~"): g.enabled = on

# ------------------------------------------------------------------ the glass (I.3)
func _glass_closed() -> void:
	if mode != "glass": return
	mode = "play"
	controls.enabled = true
	controls.block(250)
	_world_block_t = 0.25

## a play-through cinematic run by the v3 game (tests): the gameplay camera waits, a long press skips
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
			else:
				at = Map3.walk_rect(a[1]).get_center()
				for e in Map3.route("all"):          # (where the route enters it: a space's middle may be water or a plinth)
					if e[2] == a[1]:
						at = Vector2(e[0], e[1])
						break
			return super.cmd("tp:%f:%f" % [at.x, at.y])
		"pz_solve": (ch.pz[a[1]] as Puzzle).solve(); return true
		"pz_auto": (ch.pz[a[1]] as Puzzle).autosolve(); return true
		"pz_reset": (ch.pz[a[1]] as Puzzle).reset(); return true
		"save": save3(); return true
		"give": give(a[1]); return true
		"prologue": mode = "play"; play_prologue(); return true
		"seen": seen["prologue"] = a[1] == "1"; return true
		"cine_at": if cine is Prologue3: (cine as Prologue3).dev_seek(float(a[1])); return true
		"pool_road": set_pool_road(a[1] == "1"); return true
		"lens": set_lens(a[1] == "1"); return true
		"end": return bool(seen.get("ch1_end", false))
		"finale", "jump", "steps", "poolrise", "ghost", "satchel", "map", "hintnow": return false   # (v2 only)
	return super.cmd(c)

func state3() -> Dictionary:
	var p := player.position
	return {"pos": [p.x, p.y, p.z], "space": space, "part": part, "mode": mode, "pz": ch.save_state(), "items": items,
		"seen": seen, "end": bool(seen.get("ch1_end", false)), "acting": _acting, "lens": lens_on, "cine_t": snappedf(cine.t, 0.1) if cine else -1.0, "glass": _glass_state()}

## (web touch test) the open glass: its phase and the stroke to trace, in viewport pixels
func _glass_state() -> Dictionary:
	var gt := ui.glass_talk
	if mode != "glass" or gt.target.is_empty(): return {}
	var px := []
	for q in GlassTalk.resample(gt.target[0], 12):          # (panel units -> screen: the inverse of GlassTalk.to_panel)
		var sp: Vector2 = gt.panel.global_position + Vector2(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5) * gt.panel.size
		px.append([snappedf(sp.x, 0.1), snappedf(sp.y, 0.1)])
	return {"phase": gt.phase, "px": px, "vp": [get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y]}

# ------------------------------------------------------------------ save (its own file: the live v2 save is untouched)
func save3() -> void:
	var p := player.position
	var d := {"v": 2, "pos": [p.x, p.y, p.z], "yaw": player.yaw, "pz": ch.save_state(), "items": items, "seen": seen,
		"visited": ch.visited.keys()}
	var f := FileAccess.open(SAVE3_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))
		_last_saved_pos = p

func _save() -> void:
	save3()

func _load3() -> void:
	save_data = {}
	if Game.autotest and not ("--keep-save" in OS.get_cmdline_user_args()): return
	if not FileAccess.file_exists(SAVE3_PATH): return
	var j = JSON.parse_string(FileAccess.get_file_as_string(SAVE3_PATH))
	if not (j is Dictionary): return
	save_data = j
	var pp: Array = j.get("pos", [])
	if pp.size() == 3: save_data["pos_v"] = Vector3(pp[0], pp[1], pp[2])
	items = (j.get("items", []) as Array).duplicate()
	seen = (j.get("seen", {}) as Dictionary).duplicate()
	for k in j.get("visited", []): ch.visited[k] = true
	ch.load_state(j.get("pz", {}))

func _delete_save() -> void:
	if FileAccess.file_exists(SAVE3_PATH): DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE3_PATH))

## (devshot / web state) the v3 state, not v2's
func state_dict() -> Dictionary:
	return state3()
