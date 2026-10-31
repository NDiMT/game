extends Node
## (Agent A, dev) the look's cost at a few places: draw calls, primitives, texture / video memory.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 600x1000 res://dev_fx/perf_probe.tscn -- tag
## env EIDOLON_PBR=0 starts with the PBR detail off; `HeroineRig.VARIANT` from --variant=v1.
const SPOTS := [["start", Vector3.INF], ["pool", Vector3(-5.0, 0, 3.6)], ["hall", Vector3(0, 0, -14)],
	["garden", Vector3(11, 0, -9)], ["court", Vector3(12, 0, -22)], ["shrine", Vector3(25, 0, -33)]]
var game: Node
var i := -1
var t := 0.0
var acc := {}
var tag := "probe"

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--variant="): HeroineRig.VARIANT = a.get_slice("=", 1)
		elif not a.begins_with("--"): tag = a
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	t += dt
	if i == -1 and t > 2.0:
		game.cmd("begin")
		i = 0; t = 0.0
		return
	if i < 0: return
	if i >= SPOTS.size():
		print("PERF ", tag, " ", JSON.stringify(acc))
		get_tree().quit()
		return
	if t < 0.05 and SPOTS[i][1] != Vector3.INF:
		var p: Vector3 = SPOTS[i][1]
		game.cmd("tp:%f:%f" % [p.x, p.z])
	if t > 3.0:
		acc[SPOTS[i][0]] = {
			"draw_calls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
			"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
			"primitives": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
			"tex_mb": snappedf(Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED) / 1048576.0, 0.1),
			"buf_mb": snappedf(Performance.get_monitor(Performance.RENDER_BUFFER_MEM_USED) / 1048576.0, 0.1),
			"vid_mb": snappedf(Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0, 0.1)}
		i += 1; t = 0.0
