extends Node3D
## (Agent A, dev) QuadBatch look check: rune faces (wall + floor, numerals), halos, light pools and floor marks built
## the way the game builds them; shot A as they are, shot B absorbed into QuadBatch: the two must match.
##   godot --path . --rendering-driver opengl3 --resolution 600x600 res://dev_fx/batch_test.tscn -- --shots=/abs/dir
var shots := ""
var t := 0.0
var step := 0
var qb: QuadBatch
var mats: Array[ShaderMaterial] = []

func _q(sh: String, size: Vector2, xf: Transform3D, params: Dictionary, plane := false) -> void:
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/%s.gdshader" % sh)
	for k in params: m.set_shader_parameter(k, params[k])
	var mesh: PlaneMesh = PlaneMesh.new() if plane else QuadMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.transform = xf
	add_child(mi)
	mats.append(m)

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.55, 0.55, 0.56)
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var floor_ := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(8, 8); floor_.mesh = pm
	var fm := StandardMaterial3D.new(); fm.albedo_color = Color(0.8, 0.79, 0.76); floor_.material_override = fm; add_child(floor_)
	var wall := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(6, 2, 0.2); wall.mesh = bm; wall.material_override = fm
	wall.position = Vector3(0, 1, -1.6); add_child(wall)
	for k in 4:
		_q("rune_face", Vector2(0.5, 0.5), Transform3D(Basis(), Vector3(-1.5 + k, 1.2, -1.49)), {"design": float(k * 3 + 1), "lit": [0.0, 1.0, 0.5, 1.0][k], "numeral": float(k)})
	_q("rune_face", Vector2(0.7, 0.7), Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(-1.2, 0.01, 0.4)), {"design": 5.0, "lit": 1.0, "on_floor": 1.0})
	_q("halo", Vector2(1.2, 1.2), Transform3D(Basis(), Vector3(1.6, 1.0, 0.2)), {"color": Color(0.9, 0.15, 0.15), "intensity": 0.6})
	_q("halo", Vector2(0.7, 0.7), Transform3D(Basis(), Vector3(0.4, 1.6, 0.2)), {"color": Color(0.2, 0.85, 1.0), "intensity": 0.5})
	_q("light_pool", Vector2(1.6, 1.6), Transform3D(Basis(), Vector3(0.2, 0.01, 0.9)), {"k": 1.0}, true)
	_q("floor_mark", Vector2(0.62, 0.62), Transform3D(Basis(), Vector3(1.4, 0.012, 1.3)), {"kind": 0.0, "intensity": 1.0}, true)
	_q("floor_mark", Vector2(0.8, 0.8), Transform3D(Basis(), Vector3(-0.2, 0.012, 1.6)), {"kind": 2.0, "intensity": 1.0, "sweep": 0.7}, true)
	_q("floor_mark", Vector2(0.46, 1.0), Transform3D(Basis(Vector3.UP, 0.6), Vector3(-1.9, 0.012, 1.5)), {"kind": 4.0, "intensity": 1.0, "joint": 1.0}, true)
	var cam := Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.size = 5.0
	cam.transform = Transform3D(Basis.from_euler(Vector3(-0.6, -0.5, 0)), Vector3(-2.6, 3.6, 4.6)); add_child(cam)
	if shots != "": DirAccess.make_dir_recursive_absolute(shots)

func _process(dt: float) -> void:
	t += dt
	if step == 0 and t > 0.8:
		step = 1
		print("A calls ", Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
		await RenderingServer.frame_post_draw
		if shots != "": get_viewport().get_texture().get_image().save_png(shots + "/bt-a.png")
		qb = QuadBatch.new(); add_child(qb); print(qb.absorb(self))
	elif step == 1 and t > 1.6:
		step = 2
		print("B calls ", Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
		await RenderingServer.frame_post_draw
		if shots != "": get_viewport().get_texture().get_image().save_png(shots + "/bt-b.png")
		get_tree().quit()
