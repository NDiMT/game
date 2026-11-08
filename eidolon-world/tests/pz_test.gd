extends Node
## v3 PUZZLE TEST (headless, ~10 s each): one Chapter I puzzle (or all) solved the way a player would (its autosolve:
## real walking / interacting), then its contract checked: solved, its gates open, the state saves and loads back.
## Two foundation checks ride along:
##   cine   a CineCam path + handoff: the perspective camera takes the view, then the fixed camera is back, framed
##          the same; a skipped one also ends on the fixed camera
##   actor  her reflection in the N.4 glass detaches, walks in her world, gestures, and rejoins you (ReflActor)
##   godot --headless --fixed-fps 60 --path . res://tests/pz_test.tscn -- --pz=<id[,id...]|all|cine|actor|foundations>
## Prints PZ PASS / PZ FAIL.

var game: Game3
var jobs: Array = []
var errors := 0
var checks := 0
var t := 0.0
var job_t := 0.0
var job := ""
var step := 0
var data := {}

func ok(label: String, pass_: bool, detail := "") -> void:
	checks += 1
	if not pass_: errors += 1
	print("%s  %s %s" % ["PASS" if pass_ else "FAIL", label, detail])

func _ready() -> void:
	Game.autotest = true
	var want := "all"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--pz="): want = a.substr(5)
	game = load("res://scenes/main3.tscn").instantiate()
	add_child(game)
	match want:
		"all": jobs = game.ch.pz.keys() + ["cine", "actor", "prologue"]
		"foundations": jobs = ["cine", "actor", "prologue"]
		_: jobs = Array(want.split(","))          # (one id, or a comma list)
	for j in jobs:
		if not (j in ["cine", "actor", "prologue"]) and not game.ch.pz.has(j):
			print("PZ FAIL  unknown puzzle '%s' (registered: %s)" % [j, ", ".join(game.ch.pz.keys())])
			set_process(false)
			get_tree().quit(1)

func _process(dt: float) -> void:
	t += dt
	if t < 0.5: return
	if job == "":
		if jobs.is_empty():
			print("PZ %s  checks=%d  failed=%d" % ["PASS" if errors == 0 else "FAIL", checks, errors])
			set_process(false)
			get_tree().quit(0 if errors == 0 else 1)
			return
		if game.mode == "cine" and game.cine:          # (the last beat's film, e.g. I.23's: skip it before the next job)
			game.cine.skip()
			return
		if game.mode != "play" or bool(game.get("_acting")): return          # (a clip that starts a film at its contact)
		job = jobs.pop_front()
		game.cmd("lens:0")          # (each job starts with the Shard lowered)
		for k in game.ch.pz:           # (and no beat's test walker left running from the last job)
			var o: Puzzle = game.ch.pz[k]
			if not ("_auto" in o): continue
			var v: Variant = o.get("_auto")
			o.set("_auto", [] if v is Array else (-1 if v is int else false))
		game.cmd("stop")
		job_t = 0.0
		step = 0
		data = {}
	job_t += dt
	match job:
		"cine": _cine()
		"actor": _actor()
		"prologue": _prologue()
		_: _puzzle(job)

func _done() -> void:
	job = ""

# ------------------------------------------------------------------ a puzzle, by its autosolve
func _puzzle(id: String) -> void:
	var pz: Puzzle = game.ch.pz[id]
	if step == 0:
		if game.mode == "cine" and game.cine: game.cine.skip()          # (the last beat's cinematic: WR's look)
		if game.mode != "play" and job_t < 10.0: return
		job_t = 0.0
		pz.reset()
		ok("%s starts unsolved, its gates shut" % id, not pz.done and pz.gates.all(func(g: Puzzle.Gate) -> bool: return g.ob.enabled))
		game.cmd("v3jump:" + pz.space)
		data["t0"] = job_t
		step = 1
		return
	if step == 1:
		if job_t - data["t0"] < 0.6: return
		game.cmd("pz_auto:" + id)
		step = 2
		return
	if step == 2:
		if not pz.done and job_t < pz.test_s: return
		ok("%s solved by its autosolve" % id, pz.done, "after %.1f s" % job_t)
		ok("%s opened its gates" % id, pz.gates.all(func(g: Puzzle.Gate) -> bool: return not g.ob.enabled))
		var saved := pz.save_state()
		pz.reset()
		pz.load_state(JSON.parse_string(JSON.stringify(saved)))
		ok("%s state round-trips through the save" % id, pz.done and pz.gates.all(func(g: Puzzle.Gate) -> bool: return not g.ob.enabled))
		_done()

# ------------------------------------------------------------------ the CineCam
func _cine() -> void:
	var w := game.world
	if step == 0:
		game.cmd("v3jump:A")
		step = 1
		data["t0"] = job_t
		return
	if step == 1:
		if job_t - data["t0"] < 0.5: return
		var c := Cinematic.new(game)
		var p := game.player.position
		c.path(0.0, 2.0, [p + Vector3(-8, 12, 8), p + Vector3(-4, 4, 6), p + Vector3(-2, 1.6, 3)], [p + Vector3(0, 1, 0)], 50.0, 35.0)
		c.handoff(2.0, 1.5)
		# (its last frame, measured before the game frees it)
		c.finished.connect(func() -> void:
			data["cam_ok"] = get_viewport().get_camera_3d() == w.cam
			if c.cine_cam:
				var fr: Array = c._gameplay_frame(Cinematic.HANDOFF_FOV)
				data["land_d"] = c.cine_cam.global_position.distance_to(fr[0])
				data["land_dir"] = (-c.cine_cam.global_transform.basis.z).dot(-w.cam.global_transform.basis.z))
		game.play_cine(c)
		data["c"] = c
		data["t1"] = job_t
		step = 2
		return
	if step == 2:
		if not data.has("mid") and job_t - data["t1"] > 1.0:
			var c: Cinematic = data["c"]
			var vc := get_viewport().get_camera_3d()
			data["mid"] = true
			ok("cine: the CineCam (perspective) has the view mid-path", vc == c.cine_cam and vc.projection == Camera3D.PROJECTION_PERSPECTIVE, "camera %s" % (vc.name if vc else "none"))
		if game.mode == "cine" and job_t - data["t1"] < 8.0: return
		var vc2 := get_viewport().get_camera_3d()
		ok("cine: the fixed camera is back after the handoff", vc2 == w.cam and data.get("cam_ok", false), "camera %s" % (vc2.name if vc2 else "none"))
		ok("cine: the handoff lands on the gameplay framing", data.get("land_d", 99.0) < 0.5 and data.get("land_dir", 0.0) > 0.995,
			"%.2f m off, dir %.4f" % [data.get("land_d", 99.0), data.get("land_dir", 0.0)])
		ok("cine: play mode again", game.mode == "play")
		# a skipped one
		var c2 := Cinematic.new(game)
		var p := game.player.position
		c2.path(0.0, 3.0, [p + Vector3(-6, 6, 6), p + Vector3(-3, 2, 3)], [p], 45.0)
		c2.handoff(3.0, 1.5)
		game.play_cine(c2)
		data["t2"] = job_t
		step = 3
		return
	if step == 3:
		if job_t - data["t2"] < 0.4: return
		if game.cine: game.cine.skip()
		step = 4
		data["t3"] = job_t
		return
	if step == 4:
		if job_t - data["t3"] < 0.3: return
		ok("cine: a skipped cinematic ends on the fixed camera", get_viewport().get_camera_3d() == w.cam and game.mode == "play")
		_done()

# ------------------------------------------------------------------ her reflection as an actor (the N.4 glass)
func _actor() -> void:
	var r: Reflector = World3.mirrors.get("N4")
	if step == 0:
		ok("actor: the N.4 glass exists", r != null)
		if r == null:
			_done()
			return
		var rr := Map3.rect("N4")
		game.cmd("tp:%f:%f:%f" % [rr.get_center().x, rr.position.y + 4.0, 0.0])
		data["t0"] = job_t
		step = 1
		return
	if step == 1:
		if job_t - data["t0"] < 1.2: return
		ok("actor: her double shows in the glass while you stand before it", r.active, "vis %.2f" % r.vis)
		var a := ReflActor.new(r)
		game.add_child(a)
		data["a"] = a
		data["acted"] = []
		a.acted.connect(func(gname: String) -> void: (data["acted"] as Array).append(gname))
		a.rejoined.connect(func() -> void: data["rejoined"] = true)
		var rr := Map3.rect("N4")
		data["goal"] = Vector3(rr.end.x - 2.0, game.player.position.y, rr.position.y + 1.2)
		a.detach()
		a.go([data["goal"]])
		a.act("untie_cleat", 1.2)
		a.rejoin()
		data["t1"] = job_t
		step = 2
		return
	if step == 2:
		var a: ReflActor = data["a"]
		var goal: Vector3 = data["goal"]
		if not data.has("far") and a.state == "act":
			data["far"] = true
			var src := r.last_src_xf.origin
			var dd := Vector2(a.pos.x - goal.x, a.pos.z - goal.z).length()
			ok("actor: she walked to her mark in her world", dd < 0.15, "%.2f m off" % dd)
			ok("actor: she stands apart from you meanwhile", Vector2(a.pos.x - src.x, a.pos.z - src.z).length() > 2.0)
			ok("actor: the glass shows her there (hold drives the double)", r.hold and r.hold_k >= 1.0 and r.hold_xf.origin.distance_to(a.pos) < 0.01)
		if not data.has("rejoined") and job_t - data["t1"] < 15.0: return
		ok("actor: the gesture played to its end", "untie_cleat" in (data["acted"] as Array))
		ok("actor: she rejoined you (copying again)", data.has("rejoined") and not r.hold and a.state == "follow")
		a.queue_free()
		_done()

## the prologue: the first time it cannot be skipped; once seen, a long press skips it and lands in play at the
## shore, the comb in hand, the fixed camera on, her world's pieces gone
func _prologue() -> void:
	if step == 0:
		game.cmd("seen:0")
		game.cmd("pz_reset:WS")
		game.cmd("prologue")
		data["t0"] = job_t
		step = 1
		return
	if step == 1:
		if job_t - data["t0"] < 1.0: return
		game.set("_skip_hold", true)
		data["t1"] = job_t
		step = 2
		return
	if step == 2:
		if job_t - data["t1"] < 1.8: return
		ok("prologue: the first view is not skipped by a long press", game.mode == "cine" and game.cine is Prologue3)
		game.set("_skip_hold", false)
		game.cmd("cine_at:20")
		ok("prologue: it runs on the perspective CineCam", get_viewport().get_camera_3d() != game.world.cam)
		ok("prologue: Ione stands in her world (only the glass draws her)", game.cine.ione != null and game.cine.ione.rig != null)
		data["ione"] = game.cine.ione
		game.cmd("seen:1")
		game.set("_skip_hold", true)
		data["t2"] = job_t
		step = 3
		return
	if step == 3:
		if game.mode == "cine" and job_t - data["t2"] < 4.0: return
		game.set("_skip_hold", false)
		data["t3"] = job_t
		step = 4
		return
	if step == 4:
		if job_t - data["t3"] < 0.5: return
		ok("prologue: once seen, a long press skips it into play", game.mode == "play" and game.cine == null)
		ok("prologue: the fixed camera is back", get_viewport().get_camera_3d() == game.world.cam)
		ok("prologue: she has the comb and the shore is done", game.has_item("comb") and game.ch.pz["WS"].done)
		ok("prologue: she stands at the shore", Map3.rect("WS").has_point(Vector2(game.player.position.x, game.player.position.z)))
		ok("prologue: her world's pieces are put away", not is_instance_valid(data.get("ione")) and game.level.marble_mat.get_shader_parameter("dark_k") == 0.0)
		data["p0"] = game.player.position
		data["t4"] = job_t
		game.cmd("input:1:-1")
		step = 5
		return
	if step == 5:
		if job_t - data["t4"] < 1.2: return
		game.cmd("stop")
		ok("prologue: she can walk off the lip at once", game.player.position.distance_to(data["p0"]) > 1.0, "%.2f m" % game.player.position.distance_to(data["p0"]))
		_done()
