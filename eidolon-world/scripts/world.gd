class_name World
extends Node3D
## Environment, light, the orthographic isometric follow camera (90 degree rotation steps), fog sheets
## that follow the player (with a clear bubble projected along the view ray so the bubble is centred on
## the player on screen), light shafts, floating dust, backdrop and the film-grain overlay.
## `awaken` (0..1) drives the shrine finale: fog recedes, light returns.

const PITCH := deg_to_rad(36.0)
const DIST := 40.0
const CAM_SIZE := 10.5
const SHAFT_BASE := [0.20, 0.16, 0.14]

var noise_tex: ImageTexture
var env: Environment
var rig: Node3D
var pitch_node: Node3D
var cam: Camera3D
var sun: DirectionalLight3D
var yaw_index := 0
var _yaw_tw: Tween
var _shake := 0.0
var _t := 0.0
var base_v_offset := 1.6
var fog_mats: Array[ShaderMaterial] = []
var fog_nodes: Array[MeshInstance3D] = []
var cam_back := Vector3(-0.572, 0.588, 0.572)
var follow: Node3D
var look_offset := Vector3.ZERO
## the clear bubble in the fog veil (inner, outer radius); eased toward fog_hole_target
var fog_hole := Vector2(4.6, 11.0)
var fog_hole_target := Vector2(4.6, 11.0)
var awaken := 0.0
var shaft_mats: Array[ShaderMaterial] = []

func _ready() -> void:
	var fn := FastNoiseLite.new()
	fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	fn.frequency = 0.012
	fn.fractal_octaves = 4
	fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true)
	img.generate_mipmaps()
	noise_tex = ImageTexture.create_from_image(img)
	_build_env()
	_build_camera()
	_build_light()
	_build_fog()
	_build_shafts()
	_build_motes()
	_build_overlays()
	set_awaken(0.0)

func _build_env() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.78, 0.79, 0.81)
	env.ambient_light_energy = 0.6
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = Color(0.74, 0.74, 0.725)
	env.fog_light_energy = 1.0
	env.fog_depth_curve = 1.3
	env.fog_height = -1.2
	env.fog_height_density = 0.40
	env.fog_sky_affect = 0.0
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

func _build_camera() -> void:
	rig = Node3D.new()
	rig.name = "Rig"
	rig.rotation.y = -PI * 0.25
	add_child(rig)
	pitch_node = Node3D.new()
	pitch_node.rotation.x = -PITCH
	rig.add_child(pitch_node)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.size = CAM_SIZE
	cam.near = 1.0
	cam.far = 110.0
	cam.position = Vector3(0, 0, DIST)
	cam.v_offset = base_v_offset
	pitch_node.add_child(cam)
	cam.current = true

func _build_light() -> void:
	sun = DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)
	sun.light_color = Color(1.0, 0.965, 0.9)
	sun.light_energy = 1.0
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 1.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 64.0
	add_child(sun)

func _fog_sheet(y: float, density: float, hole_in: float, hole_out: float, drift: Vector2, scale: float, col: Color) -> void:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/fog_sheet.gdshader")
	m.set_shader_parameter("noise_tex", noise_tex)
	m.set_shader_parameter("density", density)
	m.set_shader_parameter("hole_inner", hole_in)
	m.set_shader_parameter("hole_outer", hole_out)
	m.set_shader_parameter("drift", drift)
	m.set_shader_parameter("scale", scale)
	m.set_shader_parameter("color", col)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(150, 150)
	mi.mesh = pm
	mi.material_override = m
	mi.position.y = y
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.extra_cull_margin = 20.0
	add_child(mi)
	fog_mats.append(m)
	fog_nodes.append(mi)

func _build_fog() -> void:
	# three sheets only (overdraw): the deep void, a cloud floor under the islands, and a veil above
	# the walkways with a clear bubble around the wanderer
	_fog_sheet(-7.0, 0.95, 0.0, 0.0, Vector2(0.006, 0.003), 0.03, Color(0.70, 0.70, 0.69))
	_fog_sheet(-2.4, 0.80, 0.0, 0.0, Vector2(-0.009, 0.005), 0.045, Color(0.76, 0.76, 0.745))
	_fog_sheet(6.5, 0.86, 4.6, 11.0, Vector2(0.012, -0.004), 0.05, Color(0.82, 0.815, 0.79))

func _build_shafts() -> void:
	for k in 3:
		var sdef: Array = [[-3.4, 0.30, 3.2, 0.0], [1.6, 0.26, 2.2, 2.0], [5.2, 0.34, 3.8, 4.0]][k]
		sdef.append(SHAFT_BASE[k])
		var sm := ShaderMaterial.new()
		sm.shader = preload("res://shaders/shaft.gdshader")
		sm.set_shader_parameter("phase", sdef[3])
		sm.set_shader_parameter("intensity", sdef[4])
		var q := QuadMesh.new()
		q.size = Vector2(sdef[2], 30.0)
		var sq := MeshInstance3D.new()
		sq.mesh = q
		sq.material_override = sm
		sq.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		sq.position = Vector3(sdef[0], 7.0, -8.0)
		sq.rotation.z = sdef[1]
		sq.extra_cull_margin = 20.0
		pitch_node.add_child(sq)
		shaft_mats.append(sm)

func _build_motes() -> void:
	var q := QuadMesh.new()
	q.size = Vector2(0.07, 0.07)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = q
	mm.instance_count = 160
	var r := RandomNumberGenerator.new()
	r.seed = 5
	for i in mm.instance_count:
		var s := r.randf_range(0.6, 1.6)
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(s, s, s)), Vector3(r.randf_range(-11, 11), r.randf_range(-3.5, 3.5), r.randf_range(-11, 11))))
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/mote.gdshader")
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.extra_cull_margin = 200.0
	mi.custom_aabb = AABB(Vector3(-200, -50, -200), Vector3(400, 100, 400))
	add_child(mi)

func _build_overlays() -> void:
	var back := CanvasLayer.new()
	back.layer = -10
	add_child(back)
	var br := ColorRect.new()
	br.set_anchors_preset(Control.PRESET_FULL_RECT)
	br.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bm := ShaderMaterial.new()
	bm.shader = preload("res://shaders/backdrop.gdshader")
	br.material = bm
	back.add_child(br)
	var front := CanvasLayer.new()
	front.layer = 20
	add_child(front)
	var gr := ColorRect.new()
	gr.set_anchors_preset(Control.PRESET_FULL_RECT)
	gr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var gm := ShaderMaterial.new()
	gm.shader = preload("res://shaders/grain.gdshader")
	gr.material = gm
	front.add_child(gr)

# ------------------------------------------------------------------ camera
func rotate_view(dir: int) -> void:
	yaw_index += dir
	if _yaw_tw: _yaw_tw.kill()
	_yaw_tw = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_yaw_tw.tween_property(rig, "rotation:y", -PI * 0.25 + yaw_index * PI * 0.5, 0.6)

func set_yaw_index(i: int) -> void:
	yaw_index = i
	rig.rotation.y = -PI * 0.25 + yaw_index * PI * 0.5

func snap_to(p: Vector3) -> void:
	rig.position = p + Vector3(0, 0.6, 0)

func shake(amount: float) -> void:
	_shake = maxf(_shake, amount)

## camera-relative input: screen-right / screen-up vectors on the ground plane
func ground_axes() -> Array:
	var y := rig.rotation.y
	var right := Vector3(cos(y), 0, -sin(y))
	var fwd := Vector3(-sin(y), 0, -cos(y))
	return [right, fwd]

func set_awaken(k: float) -> void:
	awaken = k
	env.fog_depth_begin = DIST + lerpf(-1.0, 8.0, k)
	env.fog_depth_end = DIST + lerpf(20.0, 58.0, k)
	env.fog_light_color = Color(0.74, 0.74, 0.725).lerp(Color(0.80, 0.82, 0.83), k)
	env.fog_height_density = lerpf(0.40, 0.22, k)
	env.ambient_light_energy = lerpf(0.52, 0.72, k)
	sun.light_energy = lerpf(0.92, 1.18, k)
	for i in fog_mats.size():
		fog_mats[i].set_shader_parameter("clear", k * (1.0 if i == 2 else 0.45))
	for i in shaft_mats.size():
		shaft_mats[i].set_shader_parameter("intensity", SHAFT_BASE[i] * (1.0 + k * 1.3))
	RenderingServer.global_shader_parameter_set("awaken", k)

func _process(dt: float) -> void:
	_t += dt
	if follow:
		var target := follow.global_position + Vector3(0, 0.6, 0) + look_offset
		rig.position = rig.position.lerp(target, 1.0 - exp(-dt * 4.0))
	if _shake > 0.0:
		_shake = maxf(0.0, _shake - dt * 0.6)
		cam.h_offset = sin(_t * 91.0) * _shake * 0.3
		cam.v_offset = base_v_offset + cos(_t * 77.0) * _shake * 0.3
	else:
		cam.h_offset = 0.0
		cam.v_offset = base_v_offset
	fog_hole = fog_hole.lerp(fog_hole_target, 1.0 - exp(-dt * 1.2))
	fog_mats[2].set_shader_parameter("hole_inner", fog_hole.x)
	fog_mats[2].set_shader_parameter("hole_outer", fog_hole.y)
	cam_back = cam.global_transform.basis.z.normalized()
	RenderingServer.global_shader_parameter_set("cam_back", cam_back)
	var p := follow.global_position if follow else rig.position - Vector3(0, 0.6, 0)
	if true:
		RenderingServer.global_shader_parameter_set("player_pos", p)
		for i in fog_nodes.size():
			var n := fog_nodes[i]
			# keep the sheet under the camera; texture coords are world-space so nothing swims
			n.position = Vector3(snappedf(p.x, 1.0), n.position.y, snappedf(p.z, 1.0))
			var t := (n.position.y - (p.y + 0.6)) / maxf(cam_back.y, 0.05)
			var c := p + cam_back * t
			fog_mats[i].set_shader_parameter("center", Vector2(c.x, c.z))
