extends Node
## (Agent A, dev) the P1 "crimson block beside her at the pool's east lip": shots with the pool reflection's puppet on / off
var game: Node
var t := 0.0
var step := 0
var shots := ""
var at := Vector2(-3.6, 218.0)
func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--at="): at = Vector2(float(a.get_slice("=", 1).split(",")[0]), float(a.get_slice("=", 1).split(",")[1]))
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
func _process(dt: float) -> void:
	t += dt
	match step:
		0: if t > 2.0: game.cmd("begin"); step = 1; t = 0.0
		1: if t > 1.5: game.cmd("skip"); step = 2; t = 0.0
		2: if t > 1.5: game.cmd("skip"); step = 3; t = 0.0
		3: if t > 2.0: game.cmd("tp:%f:%f" % [at.x, at.y]); step = 4; t = 0.0
		4: if t > 3.0: _shot("lip-on"); step = 5; t = 0.0
		5:
			var r: Reflector = game.puzzles.pool_refl
			if r and r.puppet:
				for mi in r.puppet.find_children("*", "MeshInstance3D", true, false): print("puppet part ", mi.name, " ", (mi as MeshInstance3D).mesh, " ", mi.visible)
				r.puppet.set_param("vis", 0.0)
				r.puppet.scale = Vector3.ONE * 0.0001
			step = 6; t = 0.0
		6: if t > 1.0: _shot("lip-off"); get_tree().quit()
func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, n]); print("shot ", n)
