extends Node
## (Agent A, dev) v1.1d bold floor eyes in the real Shadow Chamber: applies the HANDOFF change W will make (the shadow's
## head_k 2.0, the pair moved to the bigger head's centre and spread to 60 cm) on the running game, then shots:
## the eye pairs on the floor, and with the solution braziers lit (the shadows' heads wearing them).
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/eyes_ingame.tscn -- --shots=/abs/dir
const HEAD_K := 2.0
var game: Node
var shots := ""
var t := 0.0
var step := 0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _apply() -> void:
	var ch = game.chapter
	var qy := 1.01 - 0.15 * HEAD_K
	var eyes: Array = []
	for n in ch.get_children():
		if n is MeshInstance3D and (n as MeshInstance3D).material_override in ch.sh_eye_mats: eyes.append(n)
	var k := 0
	for i in Chapter.SH_SOLUTION:
		var xf: Transform3D = ch._shadow_xf(i, 1.0)
		var mid: Vector3 = xf * Vector3(0.0, 0.0, 0.5 - qy)
		if k < eyes.size(): (eyes[k] as Node3D).global_position = mid + Vector3(0, 0.012, 0)
		k += 1
		var sm: ShaderMaterial = ch.sh_shadows[i]
		sm.set_shader_parameter("head_k", HEAD_K)
		var ax: Vector3 = ch.eye_axis(i)
		var inv := xf.affine_inverse()
		var qa := inv * (mid - ax * 0.30)
		var qb := inv * (mid + ax * 0.30)
		sm.set_shader_parameter("eye_a", Vector2(qa.x * 2.0, 0.5 - qa.z))
		sm.set_shader_parameter("eye_b", Vector2(qb.x * 2.0, 0.5 - qb.z))
	print("applied to ", eyes.size(), " pairs")

func _process(dt: float) -> void:
	t += dt
	match step:
		0:
			if t > 2.0: game.cmd("begin"); game.cmd("jump:shard_gallery"); step = 1; t = 0.0
		1:
			if t > 2.5: _apply(); game.cmd("tp:7.2:-12"); step = 2; t = 0.0
		2:
			if t > 3.5:
				_shot("eyes-bold-floor")
				for i in Chapter.SH_SOLUTION: game.chapter.toggle_brazier(i)
				step = 3; t = 0.0
		3:
			if t > 3.0: _shot("eyes-bold-lit"); get_tree().quit()

func _shot(n: String) -> void:
	if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, n])
	print("shot ", n)
