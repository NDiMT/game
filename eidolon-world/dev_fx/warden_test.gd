extends Node3D
## (Agent A, dev) the Glass Warden on his own: idle, the heavy walk (walking in place across the frame), and the
## head turning toward the camera. Shots at the game's camera pitch, closer than the game for detail.
##   godot --path . --rendering-driver opengl3 --fixed-fps 30 --resolution 780x1000 res://dev_fx/warden_test.tscn -- --shots=/abs/dir [--zoom=3.2]

const MOMENTS := {"a_idle": 1.0, "b_walk1": 2.6, "c_walk2": 3.2, "d_walk3": 3.8, "e_turn0": 5.0, "f_turn1": 7.2}

var args := {}
var shots := ""
var queue := []
var t := 0.0
var noise: ImageTexture
var marble: ShaderMaterial
var w: WardenRig
var cam: Camera3D

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	shots = args.get("shots", "")
	var fn := FastNoiseLite.new()
	fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	fn.frequency = 0.012
	fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true)
	img.generate_mipmaps()
	noise = ImageTexture.create_from_image(img)
	_env()
	marble = ShaderMaterial.new()
	marble.shader = preload("res://shaders/marble.gdshader")
	marble.set_shader_parameter("noise_tex", noise)
	_box(Vector3(0, -0.05, 0), Vector3(8, 0.1, 8), 0.05)
	w = WardenRig.new()
	add_child(w)
	w.rotation.y = -PI * 0.25          # facing the camera's side, a quarter turned
	var rig := Node3D.new(); rig.rotation.y = -PI * 0.25; add_child(rig)
	var pitch := Node3D.new(); pitch.rotation.x = -deg_to_rad(38.0); rig.add_child(pitch)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = float(args.get("zoom", "3.2"))
	cam.position = Vector3(0, 0, 20)
	pitch.add_child(cam)
	rig.position = Vector3(0, 0.85, 0)
	if shots != "":
		DirAccess.make_dir_recursive_absolute(shots)
		for m in MOMENTS: queue.append([MOMENTS[m], m])
		queue.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])

func _env() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.74, 0.75, 0.75)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.70, 0.76, 0.86)
	env.ambient_light_energy = 0.6
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = Color(0.78, 0.78, 0.765)
	env.fog_depth_begin = 18.0
	env.fog_depth_end = 40.0
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.98
	env.tonemap_white = 4.0
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)
	sun.light_color = Color(1.0, 0.925, 0.80)
	sun.light_energy = 0.85
	sun.shadow_enabled = true
	add_child(sun)

func _box(c: Vector3, s: Vector3, matid: float) -> void:
	var bm := BoxMesh.new()
	bm.size = s
	var arr := bm.get_mesh_arrays()
	var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var cols := PackedColorArray()
	for i in n: cols.append(Color(0.4, matid, 0.0, 1.0))
	arr[Mesh.ARRAY_COLOR] = cols
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.mesh = am
	mi.material_override = marble
	mi.position = c
	add_child(mi)

func _process(dt: float) -> void:
	t += dt
	if t > 1.5 and t < 4.2: w.walk(true)
	if t >= 4.2:
		w.walk(false)
		w.rotation.y = PI * 0.25          # turned away to the east...
		w.look_at_point(cam.global_position)   # ...his head comes round toward us
	if shots != "" and not queue.is_empty() and t >= queue[0][0]:
		var m: String = queue.pop_front()[1]
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/warden-%s.png" % [shots, m])
		print("shot ", m)
		if queue.is_empty(): get_tree().quit()
