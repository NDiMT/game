extends Node
## (Agent A, a5) dev harness, phase 5 polish. Rendered, not headless:
##   xvfb-run -a godot --path . --resolution 390x844 res://dev_rig/a5/a5_demo.tscn -- tier|hitch|look [spaces...]
## Shots: dev/shots/a5-*.png. Prints the worst script frame (ms) over the run.
var game: Game
var _t0 := 0
var worst := 0.0
var worst_at := ""
var _count := false
var args := PackedStringArray()
var log_frames := false
var frames: Array = []
var fpos: Array = []

func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main3.tscn").instantiate()
	add_child(game)
	var b1 := Br.new(); b1.host = self; b1.first = true; b1.process_priority = -100000; add_child(b1)
	var b2 := Br.new(); b2.host = self; b2.first = false; b2.process_priority = 100000; add_child(b2)
	args = OS.get_cmdline_user_args()
	var what := args[0] if args.size() > 0 else "tier"
	await _w(2.5)
	_count = true
	match what:
		"tier": await _tier()
		"hitch": await _hitch()
		"look": await _look()
		"probe": await _probe()
		"art": await _art()
		"end": await _end()
		"sheet": await _sheet()
	print("A5DEMO worst script frame %.2f ms at %s" % [worst, worst_at])
	get_tree().quit()

func _w(s: float) -> void:
	await get_tree().create_timer(s).timeout

func shot(n: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://dev/shots/a5-%s.png" % n)
	print("shot ", n)

class Br extends Node:
	var first := true
	var host
	func _process(_dt: float) -> void:
		if first: host._t0 = Time.get_ticks_usec()
		elif host._count:
			var ms: float = (Time.get_ticks_usec() - host._t0) / 1000.0
			if ms > host.worst: host.worst = ms; host.worst_at = "%s %s" % [host.game.player.global_position, Engine.get_process_frames()]
			if host.log_frames:
				host.frames.append(ms)
				host.fpos.append(host.game.player.global_position)

func _go(space: String, x := NAN, z := NAN, yaw := PI * 0.75) -> void:
	game.cmd("v3jump:" + space)
	await _w(0.3)
	if not is_nan(x): game.cmd("tp:%f:%f:%f" % [x, z, yaw])
	await _w(1.4)

func _tier() -> void:
	for t in ["low", "high"]:
		game.cmd("quality:" + t)
		for s in ["I1", "A", "N4", "E5"]:
			await _go(s)
			await shot("tier-%s-%s" % [s, t])

## walk into the Scales (E.5) from the Mirror Walk and log every frame over 2.5 ms of script (and the render CPU time)
func _hitch() -> void:
	game.cmd("quality:" + (args[1] if args.size() > 1 else "high"))
	var vp_rid := get_viewport().get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(vp_rid, true)
	var route: Array = [["E3", 33.0, -50.0], [33.0, -58.0], [30.0, -61.0], [29.0, -64.5], [33.0, -64.5]]
	await _w(1.0)
	var nw := 0
	var refls: Array = game.call("_tier_refls")
	for r in refls:
		if r.planar and r.planar.has_meta("a5_warm"): nw += 1
		elif r.planar: print("  not warmed: ", r.kind, " ", r.clip_c, " enabled ", r.planar.enabled)
	print("A5WARM warmed %d / %d reflections" % [nw, refls.size()])
	await _go(route[0][0], route[0][1], route[0][2])
	var e5w = null
	for r in game.ch.reflectors:
		if r.kind == "pool" and r.clip_c.z < -56.0 and r.clip_c.z > -68.0: e5w = r
	if e5w: print("A5WARM E5 water size before %s warm %s" % [e5w.planar.vp.size, e5w.planar.get_meta("a5_warm", "-")])
	for k in 3: await _hitch_leg(route, vp_rid)
	if e5w: print("A5WARM E5 water size after %s" % [e5w.planar.vp.size])
	print("A5HITCH done")

func _hitch_leg(route: Array, vp_rid: RID) -> void:
	game.cmd("tp:%f:%f:%f" % [route[0][1], route[0][2], PI])
	await _w(1.0)
	worst = 0.0
	frames.clear()
	fpos.clear()
	log_frames = true
	var marks := []                 # frame index where a planar switched
	var was := {}
	for i in range(1, route.size()):
		game.cmd("walk:%f:%f" % [route[i][0], route[i][1]])
		var t := 0.0
		while t < 4.0 and Vector2(game.player.global_position.x, game.player.global_position.z).distance_to(Vector2(route[i][0], route[i][1])) > 0.3:
			await get_tree().process_frame
			t += get_process_delta_time()
			for r in game.ch.reflectors:
				if r.planar and bool(was.get(r, false)) != r.planar.active:
					was[r] = r.planar.active
					marks.append([frames.size(), "%s %s" % [r.kind, "on" if r.planar.active else "off"]])
	log_frames = false
	var sorted := frames.duplicate(); sorted.sort()
	print("leg frames %d  median %.2f  p95 %.2f  worst %.2f" % [frames.size(), sorted[sorted.size() / 2], sorted[int(sorted.size() * 0.95)], sorted[-1]])
	for j in frames.size():
		if frames[j] > 3.0: print("  slow frame %d %.2f ms at %s" % [j, frames[j], (fpos[j] as Vector3).snapped(Vector3.ONE * 0.05)])
	for m in marks:
		var w := []
		for j in range(maxi(0, m[0] - 2), mini(frames.size(), m[0] + 6)): w.append("%.1f" % frames[j])
		print("  switch %s at frame %d: %s" % [m[1], m[0], " ".join(w)])

const LOOK := ["WS", "I1", "I2", "I3", "IB1", "I4", "I5", "A", "WR", "W1", "W3", "W4", "W5", "W6", "WB", "W7", "N1", "NG", "N2", "N3", "N4", "IBN", "N5",
	"N6", "N7", "NB", "ER", "E1", "E2", "IBE", "E3", "E4", "E5", "EB", "EH", "VW", "P", "I21", "I22", "I23"]
func _look() -> void:
	game.cmd("quality:high")
	var only := args.slice(1)
	for s in LOOK:
		if not only.is_empty() and not s in only: continue
		await _go(s)
		await _w(0.6)
		await shot("look-" + s)

func _probe() -> void:
	game.cmd("quality:low")
	await _go("I1")
	game.world.env.adjustment_contrast = 2.0
	await _w(0.2)
	await shot("probe-con2")
	game.world.env.adjustment_contrast = 1.0
	game.world.env.adjustment_color_correction = null
	await _w(0.2)
	await shot("probe-noCC")

func _art() -> void:
	game.cmd("quality:high")
	var pz: Dictionary = game.ch.pz
	await _go("IBN", 18.0, -37.0)
	await shot("art-ibn")
	await _go("N4", 12.6, -32.6)
	var n4 = pz["N4"]
	for b in n4.rugs: n4.rugs[b].set_shader_parameter("lit", 1.0 if b == "C" else 0.12)
	n4.knock_mat.set_shader_parameter("intensity", 0.5)
	await _w(0.3)
	await shot("art-n4")
	await _go("N5", 6.0, -50.5)
	pz["N5"].fresco_mat.set_shader_parameter("lit", 0.55)
	await _w(0.3)
	await shot("art-n5")
	await _go("E3", 33.0, -30.5)
	for i in pz["E3"].mists.size():
		pz["E3"].mist_q[i].visible = true
		pz["E3"].mists[i].set_shader_parameter("k", 0.8)
	await _w(0.3)
	await shot("art-e3")
	await _go("E4", 29.6, -38.0)
	await shot("art-e4")
	await _go("VW", -7.0, 18.0)
	await shot("art-vw")
	await _go("ER", 14.0, 0.0)
	await shot("art-er")

func _end() -> void:
	game.cmd("quality:" + (args[1] if args.size() > 1 else "high"))
	await _go("I23", -40.0, 19.0, 0.0)
	var p = game.ch.pz["I23"]
	p.touch()
	var marks := [3.0, 7.6, 12.0, 17.5, 22.3, 26.5, 28.5]
	var k := 0
	while k < marks.size():
		await get_tree().process_frame
		var f = p.get("_film")
		if f and f.t >= marks[k]:
			if k <= 2: print("A5END t=%.1f planar active %s current %s on_screen %s vis %.2f hold %s" % [f.t, p.water.planar.active, PlanarMirror.current == p.water.planar, p.water._on_screen(), p.water.vis, p.water.hold])
			if k == 1 and p.fx: print("A5END fingertip-to-touch %.2f m" % (p.fx._fingertip(game.player.fig.rig, "R") as Vector3).distance_to(Vector3(-40.0, 0.05, 17.42)))
			await shot("end-%d" % k)
			k += 1

## the a5 contact sheet's frames (HIGH): dev/shots/a5-s-*.png, composed by dev_rig/a5/sheet.py
func _sheet() -> void:
	game.cmd("quality:high")
	game.cmd("prologue")
	await _w(1.0)
	game.cmd("cine_at:30")
	await _w(1.5)
	await shot("s-0-prologue")
	game.cmd("skip")
	await _w(1.0)
	await _go("I1", 6.4, 29.6)
	await shot("s-1-act1")
	await _go("A", 0.5, 3.0)
	await shot("s-2-atrium")
	await _go("W3", -26.0, -19.5)
	await shot("s-3-west")
	await _go("N4", 12.6, -32.6)
	game.ch.pz["N4"].rugs["C"].set_shader_parameter("lit", 1.0)
	await _w(0.4)
	await shot("s-4-north")
	await _go("IBN", 18.0, -38.5)
	await shot("s-5-ibn")
	await _go("E5", 30.0, -62.0)
	await shot("s-6-east")
	await _go("P")
	await shot("s-7-act3")
	await _go("I23", -40.0, 19.0, 0.0)
	var p = game.ch.pz["I23"]
	p.touch()
	var marks := [[7.6, "s-8-palm"], [26.5, "s-9-end"]]
	var k := 0
	while k < marks.size():
		await get_tree().process_frame
		var f = p.get("_film")
		if f and f.t >= marks[k][0]:
			await shot(marks[k][1])
			k += 1
