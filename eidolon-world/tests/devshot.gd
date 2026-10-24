extends Node
## Dev harness (rendered, not headless): runs a ';'-separated script of Game.cmd() calls plus
##   w:SECONDS   wait      shot:NAME   save the viewport to dev/shots/NAME.png      quit
## xvfb-run godot --path . res://tests/devshot.tscn -- "begin;w:6;shot:a;quit"
var game: Game
var steps: PackedStringArray
var i := 0
var wait := 0.0

func _ready() -> void:
	Game.autotest = true
	var args := OS.get_cmdline_user_args()
	steps = (args[0] if args.size() > 0 else "w:3;shot:dev;quit").split(";")
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

var _bench: Array = []
var _bench_last := 0
var _bench_skip := 0

func _process(dt: float) -> void:
	if not _bench.is_empty():
		var now := Time.get_ticks_usec()
		var d := (now - _bench_last) / 1000.0
		_bench_last = now
		if _bench_skip > 0:
			_bench_skip -= 1
			return
		(_bench[2] as Array).append(d)
		_bench[1] -= d / 1000.0
		if _bench[1] <= 0.0:
			var a: Array = _bench[2]
			a.sort()
			var mean := 0.0
			for v in a: mean += v
			mean /= a.size()
			print("BENCH %-12s mean %6.2f ms  p90 %6.2f  frames %d  dc %d  prim %d  fill %.2f" % [_bench[0], mean, a[int(a.size() * 0.9)], a.size(),
				Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME), game.world.fill_estimate()])
			_bench = []
		return
	if wait > 0.0:
		wait -= dt
		return
	while i < steps.size():
		var s := steps[i].strip_edges()
		i += 1
		if s.begins_with("w:"):
			wait = float(s.substr(2))
			return
		elif s.begins_with("shot:"):
			var img := get_viewport().get_texture().get_image()
			img.save_png("res://dev/shots/" + s.substr(5) + ".png")
			print("shot ", s.substr(5), " ", JSON.stringify(game.state_dict()))
		elif s.begins_with("bench:"):
			# bench:LABEL:SECONDS  mean / p90 frame ms over real time
			var parts := s.split(":")
			_bench = [parts[1], float(parts[2]) if parts.size() > 2 else 4.0, []]
			_bench_last = Time.get_ticks_usec()
			_bench_skip = 10
			return
		elif s.begins_with("vpshot:"):
			var pm: PlanarMirror = game.puzzles.hall_mirror.planar
			pm.vp.get_texture().get_image().save_png("res://dev/shots/" + s.substr(7) + ".png")
		elif s == "vpdbg":
			var pm: PlanarMirror = game.puzzles.hall_mirror.planar
			var P := game.player.global_position + Vector3(0, 0.6, 0)
			var vpm: Projection = Projection(pm.cam.get_camera_projection()) * Projection(pm.cam.global_transform.affine_inverse())
			var c := vpm * Vector4(P.x, P.y, P.z, 1.0)
			print("double ndc ", Vector2(c.x, c.y) / c.w, " unproject ", pm.cam.unproject_position(P) / Vector2(pm.vp.size))
			var Pp := Vector3(P.x, P.y, -41.15 - P.z)
			var cb := game.world.cam_back
			var t := (-20.575 - Pp.z) / cb.z
			var M := Pp + cb * t
			var c2 := vpm * Vector4(M.x, M.y, M.z, 1.0)
			print("mirror pt ", M, " ndc ", Vector2(c2.x, c2.y) / c2.w, " unproject ", pm.cam.unproject_position(M) / Vector2(pm.vp.size))
		elif s == "beamdbg":
			var pz = game.puzzles
			print("pts ", pz.beam_points)
			for i in pz.beam_floor.size(): print(i, " floor vis=", pz.beam_floor[i].visible, " at ", pz.beam_floor[i].global_position, " pool vis=", pz.beam_pools[i].visible, " at ", pz.beam_pools[i].global_position)
		elif s == "quit":
			get_tree().quit()
			return
		elif s.begins_with("print"):
			print(JSON.stringify(game.state_dict()))
		else:
			game.cmd(s)
