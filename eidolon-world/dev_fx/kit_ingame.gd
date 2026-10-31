extends Node
## (Agent A, dev) v1.1c in-game placement preview for W: the scaffold gallery over the Atrium stair and the Balcony
## dressing (urns, dead plants, awning posts with torn veils), placed with the game's marble material exactly as
## suggested in HANDOFF; then shots at phone size. Nothing here changes the game: it only adds nodes for the shot.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/kit_ingame.tscn -- --shots=/abs/dir
const GALLERY := [Vector3(12.575, 0.5, 15.7), 0.0, Vector3(1.104, 1.444, 1.133)]      # pos (base), yaw, scale (deck 1.8 -> 2.6 m)
const BALCONY := [
	["kit_urns", Vector3(29.25, 2.0, -2.5), 30.0], ["kit_dead_plant", Vector3(26.9, 2.0, -4.2), 0.0],
	["kit_awning_post", Vector3(29.4, 2.0, -6.5), 90.0], ["kit_dead_plant", Vector3(29.2, 2.0, -9.0), 40.0],
	["kit_urns", Vector3(26.9, 2.0, -11.0), 200.0], ["kit_awning_post", Vector3(29.4, 2.0, -13.5), 90.0],
	["kit_dead_plant", Vector3(26.95, 2.0, -15.5), 110.0], ["kit_urns", Vector3(29.25, 2.0, -17.0), 120.0]]
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

func _place(asset: String, pos: Vector3, yaw_deg: float, sc := Vector3.ONE, wood := false) -> void:
	var res := Props._mesh(asset)
	if res.is_empty(): return
	var mesh: ArrayMesh = res[0]
	if wood:
		var arr := mesh.surface_get_arrays(0); var c: PackedColorArray = arr[Mesh.ARRAY_COLOR]
		for i in c.size(): c[i] = Color(c[i].r, WorldGeo.WOOD, c[i].b, c[i].a)
		arr[Mesh.ARRAY_COLOR] = c; mesh = ArrayMesh.new(); mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = game.level.marble_mat
	mi.transform = Transform3D(Basis(Vector3.UP, deg_to_rad(yaw_deg)) * Basis.from_scale(sc), pos)
	game.add_child(mi)

func _process(dt: float) -> void:
	t += dt
	match step:
		0:
			if t > 2.0:
				game.cmd("begin")
				_place("kit_gallery", GALLERY[0], GALLERY[1], GALLERY[2], true)
				for b in BALCONY: _place(b[0], b[1], b[2], Vector3.ONE, b[0] == "kit_awning_post")
				for b in BALCONY:
					if b[0] == "kit_awning_post":
						game.add_child(AmbientLife.veils(b[1] + Vector3(0, 2.45, 0), 2, 1.3, Vector3(0.7, 0, 0.7), null, NAN, 0.9, deg_to_rad(b[2])))
				step = 1; t = 0.0
		1:
			if t > 0.5: game.cmd("tp:12.0:19.0"); step = 2; t = 0.0
		2:
			if t > 4.0: _shot("kit-gallery"); game.cmd("tp:28.0:-8.0"); step = 3; t = 0.0
		3:
			if t > 4.0: _shot("kit-balcony"); game.cmd("tp:28.0:-14.0"); step = 4; t = 0.0
		4:
			if t > 4.0: _shot("kit-balcony2"); get_tree().quit()

func _shot(n: String) -> void:
	if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, n])
	print("shot ", n)
