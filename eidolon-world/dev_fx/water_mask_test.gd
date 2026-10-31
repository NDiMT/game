extends Node3D
## (Agent A, dev) v1.1 water reflection mask: a "reflection" (a figure-sized capsule projected onto the water like
## Reflector's puppets, ghost.gdshader) over a stepping stone whose top is 2 cm above the water: left without the mask
## (it draws over the stone), right with the stone's footprint as a hole (`holes`): only on the open water.
##   godot --path . --rendering-driver opengl3 --resolution 780x844 res://dev_fx/water_mask_test.tscn -- --shots=/abs/dir
const WY := 0.0
var shots := ""
var t := 0.0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	var fn := FastNoiseLite.new(); fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH; fn.frequency = 0.012; fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true); img.generate_mipmaps()
	var noise := ImageTexture.create_from_image(img)
	var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.6, 0.62, 0.64)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.7, 0.75, 0.8); env.ambient_light_energy = 0.5
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0); sun.light_energy = 0.8; add_child(sun)
	var marble := ShaderMaterial.new(); marble.shader = preload("res://shaders/marble.gdshader"); marble.set_shader_parameter("noise_tex", noise)
	for side in [-1.0, 1.0]:
		var ox: float = side * 2.2
		# the pool bed, a stone standing in the water (in front), the water
		_box(marble, Vector3(ox, -0.9, 0), Vector3(3.6, 0.2, 4), 0.5)
		_box(marble, Vector3(ox - 0.3, -0.35, 0.3), Vector3(0.7, 0.75, 0.7), 0.25)      # (its top 2 cm above the water)
		var wm := ShaderMaterial.new(); wm.shader = preload("res://shaders/water.gdshader"); wm.set_shader_parameter("noise_tex", noise)
		var w := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(3.6, 4); w.mesh = pm; w.material_override = wm; w.position = Vector3(ox, WY, 0); add_child(w)
		# the reflection: a figure-sized capsule mirrored under the water, behind the stone in view
		var gm := ShaderMaterial.new()
		gm.shader = preload("res://shaders/ghost.gdshader")
		gm.set_shader_parameter("ghost", 0.0)
		if side > 0:          # the stone's footprint is a hole in the reflection
			gm.set_shader_parameter("wmask", PackedVector4Array([Vector4(ox - 0.3, 0.3, 0.36, 0.36)]))
			gm.set_shader_parameter("wmask_yaw", PackedFloat32Array([0.0]))
			gm.set_shader_parameter("n_wmask", 1)
		# (projected onto the water plane like Reflector's puppets: plane y = WY, clipped to the pool)
		gm.set_shader_parameter("project", 1.0)
		gm.set_shader_parameter("plane_n", Vector3.UP); gm.set_shader_parameter("plane_d", WY)
		gm.set_shader_parameter("clip_c", Vector3(ox, WY, 0)); gm.set_shader_parameter("clip_u", Vector3.RIGHT); gm.set_shader_parameter("clip_v", Vector3.BACK)
		gm.set_shader_parameter("clip_h", Vector2(1.8, 2.0))
		var c := MeshInstance3D.new(); var cm := CapsuleMesh.new(); cm.radius = 0.25; cm.height = 1.6; c.mesh = cm
		var arr := cm.get_mesh_arrays(); var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
		var cols := PackedColorArray(); for i in n: cols.append(Color(0.25, 0.26, 0.3))
		arr[Mesh.ARRAY_COLOR] = cols; var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr); c.mesh = am
		c.material_override = gm; c.position = Vector3(ox + 0.5, WY - 0.82, -0.5); add_child(c)
	var rig := Node3D.new(); rig.rotation.y = -PI * 0.25; add_child(rig)
	var pitch := Node3D.new(); pitch.rotation.x = -deg_to_rad(36.0); rig.add_child(pitch)
	var cam := Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = 8.0; cam.position = Vector3(0, 0, 20); pitch.add_child(cam)

func _box(m: Material, c: Vector3, s: Vector3, id: float) -> void:
	var bm := BoxMesh.new(); bm.size = s
	var arr := bm.get_mesh_arrays(); var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var cols := PackedColorArray(); for i in n: cols.append(Color(0.4, id, 0.0, 1.0))
	arr[Mesh.ARRAY_COLOR] = cols; var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new(); mi.mesh = am; mi.material_override = m; mi.position = c; add_child(mi)

func _process(dt: float) -> void:
	t += dt
	if t > 1.0 and shots != "":
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(shots + "/water-mask.png")
		get_tree().quit()
