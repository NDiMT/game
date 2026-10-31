extends Node3D
## (Agent A, dev) ambient life on its own at the game's camera: moths round a flame, petals on the wind, drips
## with splash rings, torn veils on a pole (with a gust pulse).
##   godot --path . --rendering-driver opengl3 --fixed-fps 30 --resolution 390x844 res://dev_fx/ambient_test.tscn -- --shots=/abs/dir [--zoom=3]

const MOMENTS := {"a": 1.2, "b": 2.0, "c": 3.4}

var args := {}
var shots := ""
var queue := []
var t := 0.0
var noise: ImageTexture
var marble: ShaderMaterial
var veils: Node3D
var petals: MultiMeshInstance3D
var splashes := 0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	shots = args.get("shots", "")
	var fn := FastNoiseLite.new()
	fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	fn.frequency = 0.012
	fn.fractal_octaves = 4
	fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true)
	img.generate_mipmaps()
	noise = ImageTexture.create_from_image(img)
	_env()
	marble = ShaderMaterial.new()
	marble.shader = preload("res://shaders/marble.gdshader")
	marble.set_shader_parameter("noise_tex", noise)
	_box(Vector3(0, -0.05, 0), Vector3(9, 0.1, 9), 0.75)      # (the black hall floor: contrast for pale things)
	# a brazier column with a flame-coloured light: the moths' lamp
	_box(Vector3(-1.0, 0.5, 0.5), Vector3(0.45, 1.0, 0.45), 0.25)
	var flame := MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.07; sm.height = 0.16
	flame.mesh = sm
	var fm := StandardMaterial3D.new(); fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; fm.albedo_color = Color(1.0, 0.55, 0.35)
	flame.material_override = fm
	flame.position = Vector3(-1.0, 1.12, 0.5)
	add_child(flame)
	var ol := OmniLight3D.new(); ol.light_color = Color(1.0, 0.6, 0.45); ol.omni_range = 3.0; ol.light_energy = 1.4
	ol.position = flame.position
	add_child(ol)
	add_child(AmbientLife.moths(flame.position + Vector3(0, 0.05, 0), 6))
	# a ledge overhead with drips falling to the floor
	_box(Vector3(0.9, 2.3, -0.9), Vector3(1.4, 0.2, 1.0), 0.25)
	var d := AmbientLife.drips([Vector3(0.6, 2.2, -0.8), Vector3(1.2, 2.2, -1.1), Vector3(0.9, 2.2, -0.6)], 2.2)
	d.splash.connect(func(_p: Vector3) -> void: splashes += 1)
	add_child(d)
	# torn veils on a pole (charcoal pole: the marble material with COLOR.g = 1)
	veils = AmbientLife.veils(Vector3(0.2, 2.0, 1.9), 3, 1.5, Vector3(0.7, 0.0, 0.7), marble, 0.0, 0.9, -PI * 0.25)
	add_child(veils)
	# petals drifting across
	petals = AmbientLife.petals(AABB(Vector3(-3, 0.05, -3), Vector3(6, 2.5, 6)), 80, Vector3(1.1, 0.0, -0.45), 0.2, 0.09)
	add_child(petals)
	# the game's iso camera
	var rig := Node3D.new(); rig.rotation.y = -PI * 0.25; add_child(rig)
	var pitch := Node3D.new(); pitch.rotation.x = -deg_to_rad(38.0); rig.add_child(pitch)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = float(args.get("zoom", "5"))
	cam.position = Vector3(0, 0, 20)
	pitch.add_child(cam)
	rig.position = Vector3(0, 0.9, 0)
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
	env.ambient_light_energy = 0.4
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = Color(0.78, 0.78, 0.765)
	env.fog_depth_begin = 12.0
	env.fog_depth_end = 34.0
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.85
	env.tonemap_white = 4.0
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)
	sun.light_color = Color(1.0, 0.925, 0.80)
	sun.light_energy = 0.6
	sun.shadow_enabled = true
	add_child(sun)

func _box(c: Vector3, s: Vector3, matid: float) -> MeshInstance3D:
	var bm := BoxMesh.new()
	bm.size = s
	var arr := bm.get_mesh_arrays()
	var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var cols := PackedColorArray()
	var r := randf()
	for i in n: cols.append(Color(r, matid, 0.0, 1.0))
	arr[Mesh.ARRAY_COLOR] = cols
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.mesh = am
	mi.material_override = marble
	mi.position = c
	add_child(mi)
	return mi

func _process(dt: float) -> void:
	t += dt
	# a gust swells and fades (as the wind sound would drive it)
	var g := clampf(sin(t * 1.3) * 1.2, 0.0, 1.0)
	AmbientLife.set_gust(veils, g)
	AmbientLife.set_gust(petals, g)
	if shots != "" and not queue.is_empty() and t >= queue[0][0]:
		var m: String = queue.pop_front()[1]
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/ambient-%s-%s.png" % [shots, args.get("zoom", "5"), m])
		print("shot ", m, " splashes ", splashes)
		if queue.is_empty(): get_tree().quit()
