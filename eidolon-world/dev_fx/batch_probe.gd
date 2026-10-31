extends Node
## (Agent A, dev) QuadBatch A/B at the busiest views, in the SAME frame state: at each spot the draw calls are
## sampled with the quads as they are, then QuadBatch.absorb()ed and sampled again, then released.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 390x844 res://dev_fx/batch_probe.tscn -- [--shots=/abs/dir]
const SPOTS := [["start", Vector3.INF], ["pool", Vector3(-5.0, 0, 3.6)], ["hall", Vector3(0, 0, -14)],
	["garden", Vector3(11, 0, -9)], ["court", Vector3(12, 0, -22)], ["shrine", Vector3(25, 0, -33)],
	["atrium", Vector3(5, 0, 16)], ["gate", Vector3(25, 0, -30)], ["echo", Vector3(18, 0, -45)], ["scales", Vector3(29, 0, -48)]]
var game: Node
var qb: QuadBatch
var i := -1
var t := 0.0
var phase := 0
var res := {}
var shots := ""
var samples: Array[float] = []

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _median() -> float:
	samples.sort()
	var m := samples[samples.size() / 2]
	samples.clear()
	return m

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0:
			game.cmd("begin"); i = 0; t = 0.0; phase = 0
		return
	if i >= SPOTS.size():
		var a := 0.0; var b := 0.0
		for k in res: a = maxf(a, res[k][0]); b = maxf(b, res[k][1])
		print("BATCH max off ", a, " on ", b, " ", JSON.stringify(res))
		get_tree().quit()
		return
	match phase:
		0:
			if SPOTS[i][1] != Vector3.INF:
				var p: Vector3 = SPOTS[i][1]
				game.cmd("tp:%f:%f" % [p.x, p.z])
			phase = 1; t = 0.0
		1:
			if t > 2.4:
				samples.append(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
				if samples.size() >= 5:
					res[SPOTS[i][0]] = [_median(), 0.0, {}]
					if shots != "": get_viewport().get_texture().get_image().save_png("%s/batch-off-%s.png" % [shots, SPOTS[i][0]])
					qb = QuadBatch.new(); add_child(qb)
					res[SPOTS[i][0]][2] = qb.absorb(game)
					phase = 2; t = 0.0
		2:
			if t > 0.3:
				samples.append(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
				if samples.size() >= 5:
					res[SPOTS[i][0]][1] = _median()
					if shots != "": get_viewport().get_texture().get_image().save_png("%s/batch-on-%s.png" % [shots, SPOTS[i][0]])
					qb.release(); qb.queue_free(); qb = null
					print("spot ", SPOTS[i][0], " ", res[SPOTS[i][0]])
					i += 1; phase = 0; t = 0.0
