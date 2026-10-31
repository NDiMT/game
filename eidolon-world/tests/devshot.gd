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
	var b1 := Bracket.new(); b1.host = self; b1.first = true; b1.process_priority = -100000; add_child(b1)
	var b2 := Bracket.new(); b2.host = self; b2.first = false; b2.process_priority = 100000; add_child(b2)

var _bench: Array = []
var _fd: Array = []          # [label, frames left, previous image, per-frame hot counts, worst count, worst image, worst mask]

## the state that could toggle: which planar mirror renders, which zones wear their faded copy, how many
## zones are culled, how many lights burn, the see-through's opening
func _fd_state() -> String:
	var lv: Level = game.level
	var fz := 0
	for z in lv.fade_zones: if z[4]: fz += 1
	var vis := 0
	for ch in lv.get_children(): if ch is MeshInstance3D and str(ch.name).begins_with("Zone_") and (ch as MeshInstance3D).visible: vis += 1
	var lights := 0
	for l in game.find_children("*", "OmniLight3D", true, false): if (l as Light3D).visible and (l as Light3D).light_energy > 0.001: lights += 1
	return "planar=%s fade=%d zones=%d lights=%d reveal=%.3f" % [str(PlanarMirror.current.name) if PlanarMirror.current else "-", fz, vis, lights, game.world.reveal_k]

func _fdiff_frame() -> void:
	var img := get_viewport().get_texture().get_image()
	img.convert(Image.FORMAT_RGB8)
	var st := _fd_state()
	if _fd[2] != null:
		var a: Image = _fd[2]
		var w := img.get_width(); var h := img.get_height()
		var da := img.get_data(); var db := a.get_data()
		var hot := 0
		var mask := Image.create(w, h, false, Image.FORMAT_L8)
		var lo := Vector2i(w, h); var hi := Vector2i(-1, -1)
		for y in range(0, h, 2):
			for x in range(0, w, 2):
				var o := (y * w + x) * 3
				var d := maxi(absi(da[o] - db[o]), maxi(absi(da[o + 1] - db[o + 1]), absi(da[o + 2] - db[o + 2])))
				if d > 48:
					hot += 1
					mask.set_pixel(x, y, Color.WHITE)
					lo = Vector2i(mini(lo.x, x), mini(lo.y, y)); hi = Vector2i(maxi(hi.x, x), maxi(hi.y, y))
		(_fd[3] as Array).append(hot)
		print("FDIFF %s frame %d hot %d box %s..%s  %s" % [_fd[0], (_fd[3] as Array).size(), hot, lo, hi, st])
		if hot > _fd[4]:
			_fd[4] = hot; _fd[5] = img.duplicate(); _fd[6] = mask
	_fd[2] = img
	_fd[1] -= 1
	if _fd[1] <= 0:
		var hs: Array = _fd[3]
		var tot := 0
		for v in hs: tot += v
		print("FDIFF %s DONE frames %d  worst %d  mean %.1f" % [_fd[0], hs.size(), _fd[4], float(tot) / maxf(hs.size(), 1)])
		if _fd[5] != null:
			(_fd[5] as Image).save_png("res://dev/shots/fdiff-%s-worst.png" % _fd[0])
			(_fd[6] as Image).save_png("res://dev/shots/fdiff-%s-mask.png" % _fd[0])
		_fd = []
var _bench_last := 0
var _bench_skip := 0

var _prof: Array = []
## (v0.8.5) total script time of every node's _process in a frame: a first and a last node bracket it
class Bracket extends Node:
	var first := true
	var host
	func _process(_dt: float) -> void:
		if first: host._fr_t0 = Time.get_ticks_usec()
		else: host._fr_script = Time.get_ticks_usec() - host._fr_t0
var _fr_t0 := 0
var _fr_script := 0
var _scr_acc := 0.0
var _scr_max := 0.0
func _process(dt: float) -> void:
	if not _prof.is_empty():
		_prof[2] += 1
		_prof[3] += _fr_script / 1000.0
		_scr_max = maxf(_scr_max, _fr_script / 1000.0)
		_prof[4] += Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
		var nv := 0
		for v in _prof[6]:
			if is_instance_valid(v) and (v as SubViewport).render_target_update_mode != SubViewport.UPDATE_DISABLED: nv += 1
		_prof[5] += nv
		_prof[7] += dt
		_prof[1] -= dt
		if _prof[1] <= 0.0 and _prof[2] > 5:
			var n := float(_prof[2])
			var secs := []
			for k in game.prof: secs.append([game.prof[k] / n / 1000.0, k])
			secs.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])
			var top := ""
			for e in secs.slice(0, 5): top += "%s %.3f  " % [e[1], e[0]]
			print("PROF %-14s script %.2f ms (max %.1f)  dc %.0f  vps %.2f/%d  | %s" % [_prof[0], _prof[3] / n, _scr_max, _prof[4] / n, _prof[5] / n, (_prof[6] as Array).size(), top])
			var mx := []
			for k in game.prof_max: mx.append([game.prof_max[k] / 1000.0, k])
			mx.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])
			var tm := ""
			for e in mx.slice(0, 6): tm += "%s %.2f  " % [e[1], e[0]]
			print("PROFMAX %-11s worst frame per section (ms): %s" % [_prof[0], tm])
			game.prof_max.clear()
			_scr_max = 0.0
			game.prof_on = false
			_prof = []
		return
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
	if not _fd.is_empty():
		_fdiff_frame()
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
		elif s.begins_with("prof:"):
			# prof:LABEL:SECONDS  script ms per frame (total _process, and main's sections), draw calls,
			# active SubViewports (render target not disabled), over real frames
			var parts := s.split(":")
			_prof = [parts[1], float(parts[2]) if parts.size() > 2 else 4.0, 0, 0.0, 0.0, 0.0, game.find_children("*", "SubViewport", true, false), 0.0]
			game.prof.clear()
			game.prof_max.clear()
			game.prof_on = true
			return
		elif s.begins_with("vpshot:"):
			var pm: PlanarMirror = PlanarMirror.current if PlanarMirror.current else game.puzzles.hall_mirror.planar
			print("planar current ", PlanarMirror.current, " active ", pm.active)
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
		elif s.begins_with("fdiff:"):
			# fdiff:LABEL:N  N consecutive frames standing still: per frame, the pixels that changed a lot from
			# the frame before (max channel diff > 48 / 255) and where; the frame with the most is saved with
			# its diff mask (v0.9.1: the flicker hunt; grain off with "nograin")
			var parts := s.split(":")
			_fd = [parts[1], int(parts[2]) if parts.size() > 2 else 60, null, [], 0, null, null]
			return
		elif s == "nograin":
			for n in get_tree().get_nodes_in_group("f_grain"): (n as CanvasItem).visible = false
		elif s == "quit":
			get_tree().quit()
			return
		elif s.begins_with("print"):
			print(JSON.stringify(game.state_dict()))
		else:
			game.cmd(s)
