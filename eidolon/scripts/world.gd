class_name World
extends Node3D
## The temple-in-fog around the board: environment, light, isometric camera rig, fog sheets,
## light shafts, looming silhouettes, backdrop and the film-grain overlay.

const PITCH := deg_to_rad(36.0)
const DIST := 40.0

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
var base_v_offset := -0.35
var fog_mats: Array[ShaderMaterial] = []
var silhouettes: MeshInstance3D

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
	_build_silhouettes()
	_build_overlays()

func _build_env() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.78, 0.79, 0.81)
	env.ambient_light_energy = 0.62
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = Color(0.74, 0.74, 0.725)
	env.fog_light_energy = 1.0
	env.fog_depth_begin = DIST + 0.5
	env.fog_depth_end = DIST + 19.0
	env.fog_depth_curve = 1.4
	env.fog_height = -0.9
	env.fog_height_density = 0.42
	env.fog_sky_affect = 0.0
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
	cam.size = 12.0
	cam.near = 1.0
	cam.far = 120.0
	cam.position = Vector3(0, 0, DIST)
	cam.v_offset = base_v_offset
	pitch_node.add_child(cam)
	cam.current = true

func _build_light() -> void:
	sun = DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-52.0), deg_to_rad(-28.0), 0.0)
	sun.light_color = Color(1.0, 0.965, 0.9)
	sun.light_energy = 1.05
	sun.shadow_enabled = true
	sun.shadow_blur = 2.0
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 1.2
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 70.0
	add_child(sun)

func _fog_sheet(y: float, density: float, hole_in: float, hole_out: float, drift: Vector2, scale: float, col: Color) -> MeshInstance3D:
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
	pm.size = Vector2(72, 72)
	mi.mesh = pm
	mi.material_override = m
	mi.position.y = y
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	fog_mats.append(m)
	return mi

func _build_fog() -> void:
	# three sheets only (overdraw): deep floor, under-island cloud, thin veil with a hole over the board
	_fog_sheet(-4.2, 0.95, 0.0, 0.0, Vector2(0.006, 0.003), 0.035, Color(0.70, 0.70, 0.69))
	_fog_sheet(-1.25, 0.85, 0.0, 0.0, Vector2(-0.009, 0.005), 0.05, Color(0.77, 0.77, 0.75))
	_fog_sheet(0.45, 0.6, 5.5, 10.0, Vector2(0.012, -0.004), 0.06, Color(0.83, 0.82, 0.79))

func set_board_radius(r: float) -> void:
	fog_mats[2].set_shader_parameter("hole_inner", r + 0.4)
	fog_mats[2].set_shader_parameter("hole_outer", r + 4.5)

func _build_silhouettes() -> void:
	# broken columns and statues looming behind the board; attached to the yaw rig so they always stay
	# behind the diorama (an orthographic camera has no perspective to betray it). One merged mesh.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	var cols := [[-6.6, -14.0, 7.5, 0.75], [-4.2, -20.0, 10.5, 0.9], [-1.6, -26.0, 13.0, 1.0], [3.4, -17.0, 8.5, 0.8],
		[6.2, -22.0, 12.0, 0.95], [7.4, -13.0, 4.5, 0.7], [-8.0, -24.0, 12.5, 0.95], [1.2, -12.0, 2.5, 0.6]]
	for c in cols:
		var cyl := CylinderMesh.new()
		cyl.top_radius = c[3] * 0.92; cyl.bottom_radius = c[3]
		cyl.height = c[2] + 16.0
		cyl.radial_segments = 14
		cyl.rings = 1
		var tilt := Basis(Vector3(0, 0, 1), rng.randf_range(-0.06, 0.06))
		st.append_from(cyl, 0, Transform3D(tilt, Vector3(c[0], (c[2] - 16.0) * 0.5, c[1])))
		if rng.randf() < 0.3:
			var cap := BoxMesh.new()
			cap.size = Vector3(c[3] * 2.6, 0.6, c[3] * 2.6)
			st.append_from(cap, 0, Transform3D(tilt, Vector3(c[0], c[2] + 0.3, c[1])))
	# a fallen lintel resting across two columns
	var lin := BoxMesh.new()
	lin.size = Vector3(7.5, 1.0, 1.4)
	st.append_from(lin, 0, Transform3D(Basis(Vector3(0, 0, 1), 0.10), Vector3(4.8, 12.4, -20.0)))
	# draped statues: robe (tapered), torso, head (one headless), on tall plinths
	for sdef in [[-5.4, -11.5, 0.85, false], [5.6, -10.5, 1.0, true], [0.4, -30.0, 1.6, true]]:
		var sx: float = sdef[0]; var sz: float = sdef[1]; var sc: float = sdef[2]
		var pl := BoxMesh.new()
		pl.size = Vector3(2.2, 12.0, 2.2) * sc
		st.append_from(pl, 0, Transform3D(Basis(), Vector3(sx, -6.0 * sc - 1.0, sz)))
		var robe := CylinderMesh.new()
		robe.top_radius = 0.55 * sc; robe.bottom_radius = 0.95 * sc
		robe.height = 4.2 * sc; robe.radial_segments = 12; robe.rings = 1
		st.append_from(robe, 0, Transform3D(Basis(Vector3(0, 0, 1), 0.04), Vector3(sx, 2.1 * sc - 1.0, sz)))
		var torso := CapsuleMesh.new()
		torso.radius = 0.62 * sc; torso.height = 2.4 * sc
		torso.radial_segments = 12; torso.rings = 3
		st.append_from(torso, 0, Transform3D(Basis(Vector3(0, 0, 1), -0.05), Vector3(sx + 0.05, 4.6 * sc - 1.0, sz)))
		if sdef[3]:
			var head := SphereMesh.new()
			head.radius = 0.4 * sc; head.height = 0.95 * sc
			head.radial_segments = 12; head.rings = 6
			st.append_from(head, 0, Transform3D(Basis(Vector3(0, 0, 1), 0.3), Vector3(sx + 0.25 * sc, 6.25 * sc - 1.0, sz)))
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.52, 0.52, 0.53)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	silhouettes = mi
	rig.add_child(mi)
	# light shafts: camera-facing additive quads behind the board
	for sdef in [[-3.6, 0.32, 3.6, 0.0, 0.26], [1.2, 0.28, 2.4, 2.0, 0.2], [5.0, 0.36, 4.2, 4.0, 0.18]]:
		var sm := ShaderMaterial.new()
		sm.shader = preload("res://shaders/shaft.gdshader")
		sm.set_shader_parameter("phase", sdef[3])
		sm.set_shader_parameter("intensity", sdef[4])
		var q := QuadMesh.new()
		q.size = Vector2(sdef[2], 34.0)
		var sq := MeshInstance3D.new()
		sq.mesh = q
		sq.material_override = sm
		sq.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		sq.position = Vector3(sdef[0], 8.0, -6.0)
		sq.rotation.z = sdef[1]
		pitch_node.add_child(sq)

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
func frame_board(board_w: int, board_h: int, instant := false) -> void:
	var target := (board_w + board_h) * 0.7071 + 1.5
	set_board_radius(Vector2(board_w, board_h).length() * 0.5)
	# the looming ruins scale with the view so they always frame the diorama
	var sc := Vector3.ONE * (target / 12.0)
	if instant:
		cam.size = target
		silhouettes.scale = sc
	else:
		var tw := create_tween().set_trans(Tween.TRANS_SINE)
		tw.tween_property(cam, "size", target, 1.2)
		tw.parallel().tween_property(silhouettes, "scale", sc, 1.2)

func rotate_view(dir: int) -> void:
	yaw_index += dir
	if _yaw_tw: _yaw_tw.kill()
	_yaw_tw = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_yaw_tw.tween_property(rig, "rotation:y", -PI * 0.25 + yaw_index * PI * 0.5, 0.55)

func shake(amount: float) -> void:
	_shake = maxf(_shake, amount)

func _process(dt: float) -> void:
	_t += dt
	if _shake > 0.0:
		_shake = maxf(0.0, _shake - dt * 0.6)
		cam.h_offset = sin(_t * 91.0) * _shake * 0.5
		cam.v_offset = base_v_offset + cos(_t * 77.0) * _shake * 0.5
	else:
		cam.h_offset = 0.0
		cam.v_offset = base_v_offset

## Screen-space direction of a grid step (for swipe/key remapping after rotation).
func screen_dir(d: Vector2i) -> Vector2:
	var a := cam.unproject_position(Vector3.ZERO)
	var b := cam.unproject_position(Vector3(d.x, 0, d.y))
	return (b - a).normalized()

func grid_dir_for_screen(v: Vector2) -> Vector2i:
	var best := Vector2i.ZERO
	var bd := -2.0
	for d in Rules.DIRS:
		var s := screen_dir(d).dot(v.normalized())
		if s > bd:
			bd = s; best = d
	return best
