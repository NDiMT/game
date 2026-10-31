extends Node3D
## (Agent A, dev) the QA P1-8 kit (assets/models/props/kit_*.glb) drawn the way the game draws props: Props._mesh
## (marble vertex colours) with the marble shader; the wood pieces with the WOOD id (0.97). At the game's camera.
##   godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/kit_test.tscn -- --shots=/abs/dir
const WOOD := ["kit_scaffold", "kit_ladder", "kit_awning_post"]
var shots := ""
var t := 0.0
var noise: ImageTexture
var marble: ShaderMaterial

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	var fn := FastNoiseLite.new(); fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH; fn.frequency = 0.012; fn.fractal_octaves = 4; fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true); img.generate_mipmaps()
	noise = ImageTexture.create_from_image(img)
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.74, 0.75, 0.75)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.70, 0.76, 0.86); env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC; env.tonemap_exposure = 0.7
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)
	sun.light_color = Color(1.0, 0.925, 0.80); sun.light_energy = 0.7; sun.shadow_enabled = true; add_child(sun)
	marble = ShaderMaterial.new(); marble.shader = preload("res://shaders/marble.gdshader"); marble.set_shader_parameter("noise_tex", noise)
	var fl := MeshInstance3D.new(); var pm := BoxMesh.new(); pm.size = Vector3(14, 0.1, 14); fl.mesh = _tint(pm, 0.05); fl.material_override = marble; fl.position.y = -0.05; add_child(fl)
	var items := [["kit_face1", Vector3(-2.4, 0, -2.4)], ["kit_face2", Vector3(-1.6, 0, -2.4)], ["kit_face3", Vector3(-0.8, 0, -2.4)],
		["kit_face4", Vector3(-2.4, 0, -1.4)], ["kit_face5", Vector3(-1.6, 0, -1.4)], ["kit_face6", Vector3(-0.8, 0, -1.4)],
		["kit_fountain", Vector3(1.6, 0, -1.8)], ["kit_scaffold", Vector3(-2.6, 0, 1.0)], ["kit_ladder", Vector3(-1.0, 0, 1.2)],
		["kit_bridge_deck", Vector3(1.6, 0, 1.0)], ["kit_bridge_end", Vector3(1.4, 0, 3.4)], ["kit_urns", Vector3(-1.4, 0, 3.2)], ["kit_awning_post", Vector3(-3.0, 0, 3.4)]]
	for it in items:
		var res := Props._mesh(it[0])
		if res.is_empty(): continue
		var mesh: ArrayMesh = res[0]
		if it[0] in WOOD: mesh = _recolor(mesh, 0.97)
		var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = marble; mi.position = it[1]
		# (plinths under the faces, as in the Atrium rows)
		if String(it[0]).begins_with("kit_face"):
			var pl := MeshInstance3D.new(); var b := BoxMesh.new(); b.size = Vector3(0.5, 0.9, 0.5); pl.mesh = _tint(b, 0.25); pl.material_override = marble
			pl.position = it[1] + Vector3(0, 0.45, 0); add_child(pl); mi.position.y = 0.9
		add_child(mi)
	var rig := Node3D.new(); rig.rotation.y = -PI * 0.25; add_child(rig)
	var pitch := Node3D.new(); pitch.rotation.x = -deg_to_rad(36.0); rig.add_child(pitch)
	var cam := Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = 7.5; cam.position = Vector3(0, 0, 24); pitch.add_child(cam)
	rig.position = Vector3(-0.3, 0.6, 0.4)

func _tint(pm: PrimitiveMesh, id: float) -> ArrayMesh:
	var arr := pm.get_mesh_arrays(); var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var c := PackedColorArray(); for i in n: c.append(Color(randf(), id, 0.0, 1.0))
	arr[Mesh.ARRAY_COLOR] = c; var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr); return am

func _recolor(m: ArrayMesh, id: float) -> ArrayMesh:
	var arr := m.surface_get_arrays(0); var c: PackedColorArray = arr[Mesh.ARRAY_COLOR]
	for i in c.size(): c[i] = Color(c[i].r, id, c[i].b, c[i].a)
	arr[Mesh.ARRAY_COLOR] = c; var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr); return am

func _process(dt: float) -> void:
	t += dt
	if t > 1.0 and shots != "":
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(shots + "/kit-test.png")
		get_tree().quit()
