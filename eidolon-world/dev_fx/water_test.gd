extends Node3D
## (Agent A, dev) the pool on its own, at the game's camera pitch: a marble basin, the water (water +
## water_over) and a slab that rises out of it (WaterFX.rise + wet_dry) and a few splashes.
##   godot --path . --rendering-driver opengl3 --fixed-fps 30 res://dev_fx/water_test.tscn -- --shots=/abs/dir --water=new|old
## `--water=old` loads the v0.9.4 water shaders from --old=/abs/dir (water_old.gdshader, water_over_old.gdshader).

const MOMENTS := {"a_still": 1.5, "b_rising": 3.1, "c_risen": 4.2, "d_drying": 6.0, "e_dry": 9.5}
const WATER_Y := -0.3

var args := {}
var shots := ""
var queue := []
var t := 0.0
var noise: ImageTexture
var marble: ShaderMaterial
var slab: MeshInstance3D
var fx: WaterFX
var wm: ShaderMaterial
var om: ShaderMaterial

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
	# the basin: floor slabs round a 6 x 3.6 pool, its walls down to the bottom
	_box(Vector3(0, -0.05, -3.2), Vector3(9, 0.1, 2.8), 0.05)
	_box(Vector3(0, -0.05, 3.2), Vector3(9, 0.1, 2.8), 0.05)
	_box(Vector3(-3.75, -0.05, 0), Vector3(1.5, 0.1, 3.6), 0.05)
	_box(Vector3(3.75, -0.05, 0), Vector3(1.5, 0.1, 3.6), 0.05)
	_box(Vector3(0, -1.2, 0), Vector3(6, 0.1, 3.6), 0.5)
	# a column and a statue base for scale
	_box(Vector3(-3.5, 1.5, -2.6), Vector3(0.6, 3.0, 0.6), 0.25)
	slab = _box(Vector3(0.6, WATER_Y - 0.5, 0.2), Vector3(1.6, 0.36, 1.0), 0.25)
	# the water
	var old: bool = args.get("water", "new") == "old"
	wm = ShaderMaterial.new()
	om = ShaderMaterial.new()
	if old:
		var dir: String = args.get("old", "")
		var s1 := Shader.new(); s1.code = FileAccess.get_file_as_string(dir + "/water_old.gdshader"); wm.shader = s1
		var s2 := Shader.new(); s2.code = FileAccess.get_file_as_string(dir + "/water_over_old.gdshader"); om.shader = s2
	else:
		wm.shader = preload("res://shaders/water.gdshader")
		om.shader = preload("res://shaders/water_over.gdshader")
	wm.set_shader_parameter("noise_tex", noise)
	om.set_shader_parameter("noise_tex", noise)
	om.set_shader_parameter("area", Vector4(-3.0, -1.8, 3.0, 1.8))
	_plane(wm, WATER_Y)
	_plane(om, WATER_Y + 0.025)
	fx = WaterFX.new()
	fx.mats = [wm, om]
	add_child(fx)
	# the game's iso camera: orthographic, yaw -45 deg, pitched down
	var rig := Node3D.new()
	rig.rotation.y = -PI * 0.25
	add_child(rig)
	var pitch := Node3D.new()
	pitch.rotation.x = -deg_to_rad(float(args.get("pitch", "38")))
	rig.add_child(pitch)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 7.5
	cam.position = Vector3(0, 0, 20)
	pitch.add_child(cam)
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
	env.fog_depth_begin = 8.0
	env.fog_depth_end = 30.0
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.98
	env.tonemap_white = 4.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)      # (as world.gd)
	sun.light_color = Color(1.0, 0.925, 0.80)
	sun.light_energy = 0.85
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

func _plane(m: ShaderMaterial, y: float) -> void:
	var pm := PlaneMesh.new()
	pm.size = Vector2(6.0, 3.6)
	var mi := MeshInstance3D.new()
	mi.mesh = pm
	mi.material_override = m
	mi.position = Vector3(0, y, 0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

var _rose := false
func _process(dt: float) -> void:
	t += dt
	if t > 2.4 and not _rose:
		_rose = true
		var top := 0.02
		var tw := create_tween()
		tw.tween_property(slab, "position:y", top - 0.18, 1.3).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		fx.rise(Rect2(0.6 - 0.8, 0.2 - 0.5, 1.6, 1.0), 2.6)
		fx.splash(Vector3(-0.4, 0, 0.75), 0.6)
		get_tree().create_timer(1.25).timeout.connect(func() -> void: fx.wet_dry(slab, 3.2, WATER_Y))
		slab.set_instance_shader_parameter("wet", 1.0)
		slab.set_instance_shader_parameter("wet_line", WATER_Y)
	if shots != "" and not queue.is_empty() and t >= queue[0][0]:
		var m: String = queue.pop_front()[1]
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/water-%s-%s.png" % [shots, args.get("water", "new"), m])
		print("shot ", m)
		if queue.is_empty(): get_tree().quit()
