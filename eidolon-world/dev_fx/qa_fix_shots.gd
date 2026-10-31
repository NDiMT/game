extends Node
## (Agent A, dev) QA_V1 art fixes in the running game: the Undercroft dark with the lamp, the mirrors seen from the
## Balcony / Ledge (the fallback and the marble backs). Shots to --shots=/abs/dir.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 390x844 res://dev_fx/qa_fix_shots.tscn -- --shots=/abs/dir
var game: Node
var shots := ""
var i := -1
var t := 0.0
var done_setup := -1
var dk := 0.0
const SPOTS := [["uc-before", Vector3(19.5, 0, 11.4), false], ["uc-dark", Vector3(19.5, 0, 11.4), true],
	["balcony", Vector3(28.0, 0, -8.0), false], ["ledge", Vector3(25.0, 0, -22.0), false], ["hall", Vector3(0, 0, -14), false]]

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0:
			game.cmd("begin"); game.cmd("give:lamp"); i = 0; t = 0.0
		return
	if i >= SPOTS.size():
		get_tree().quit(); return
	var s: Array = SPOTS[i]
	if done_setup != i:
		done_setup = i
		game.cmd("tp:%f:%f" % [s[1].x, s[1].z])
	var want := 1.0 if s[2] else 0.0
	dk = move_toward(dk, want, dt * 2.0)
	game.world.set_darkness(dk)
	var lp: Vector3 = game.player.global_position + Vector3(0, 0.9, 0)
	game.level.set_darkness(dk, lp, 3.4)
	var hub = game.chapter.hub
	if hub and hub.lamp_light:
		hub.lamp_light.light_color = Color(1.0, 0.72, 0.45) if dk > 0.0 else Color(1.0, 0.84, 0.66)
		hub.lamp_light.light_energy = lerpf(0.6, 1.6, dk)
		hub.lamp_light.omni_range = lerpf(4.5, 5.5, dk)
	if t > 4.0:
		if shots != "": get_viewport().get_texture().get_image().save_png("%s/qafix-%s.png" % [shots, s[0]])
		print("shot ", s[0])
		i += 1; t = 0.0
