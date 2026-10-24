class_name Figure
extends Node3D
## The small hooded, cloaked figure, built procedurally (low-poly lathes, vertex coloured).
## Two meshes: the cloak (deformed in the vertex shader: sway, flare, fold ripple, breathing) and the
## hood (rigid; a void face with two faint cyan eye glints). All animation is driven by a Pose, so a
## reflection puppet can copy (or delay, or bend) the player's pose exactly.

const CLOAK := Color(0.215, 0.21, 0.215)
const TRIM := Color(0.20, 0.55, 0.62)
const HOOD := Color(0.235, 0.23, 0.235)
const VOID := Color(0.0, 0.0, 0.0, 0.0)
const EYE := Color(0.55, 0.97, 1.0)
const NECK_Y := 0.80

class Pose:
	var body_y := 0.0
	var lean_x := 0.0
	var lean_z := 0.0
	var sway := Vector2.ZERO
	var flare := 0.0
	var ripple := 0.0
	var phase := 0.0
	var breath := 0.0
	var head_yaw := 0.0
	var head_pitch := 0.0
	var head_roll := 0.0
	var crouch := 0.0

	func copy() -> Pose:
		var p := Pose.new()
		p.body_y = body_y; p.lean_x = lean_x; p.lean_z = lean_z; p.sway = sway; p.flare = flare
		p.ripple = ripple; p.phase = phase; p.breath = breath; p.head_yaw = head_yaw
		p.head_pitch = head_pitch; p.head_roll = head_roll; p.crouch = crouch
		return p

	func blend(o: Pose, t: float) -> Pose:
		var p := copy()
		p.body_y = lerpf(body_y, o.body_y, t); p.lean_x = lerpf(lean_x, o.lean_x, t); p.lean_z = lerpf(lean_z, o.lean_z, t)
		p.sway = sway.lerp(o.sway, t); p.flare = lerpf(flare, o.flare, t); p.ripple = lerpf(ripple, o.ripple, t)
		p.phase = lerpf(phase, o.phase, t); p.breath = lerpf(breath, o.breath, t)
		p.head_yaw = lerp_angle(head_yaw, o.head_yaw, t); p.head_pitch = lerpf(head_pitch, o.head_pitch, t)
		p.head_roll = lerpf(head_roll, o.head_roll, t); p.crouch = lerpf(crouch, o.crouch, t)
		return p

static var cloak_mesh: ArrayMesh
static var hood_mesh: ArrayMesh

var body: Node3D
var head: Node3D
var cloak_mi: MeshInstance3D
var hood_mi: MeshInstance3D
var body_mat: ShaderMaterial
var head_mat: ShaderMaterial
var pose := Pose.new()

func _init(ghost_shader: Shader = null) -> void:
	if cloak_mesh == null:
		cloak_mesh = _build_cloak()
		hood_mesh = _build_hood()
	body = Node3D.new()
	add_child(body)
	head = Node3D.new()
	head.position.y = NECK_Y
	body.add_child(head)
	var sh: Shader = ghost_shader if ghost_shader else preload("res://shaders/figure.gdshader")
	body_mat = ShaderMaterial.new()
	body_mat.shader = sh
	head_mat = ShaderMaterial.new()
	head_mat.shader = sh
	head_mat.set_shader_parameter("deform", 0.0)
	cloak_mi = MeshInstance3D.new()
	cloak_mi.mesh = cloak_mesh
	cloak_mi.material_override = body_mat
	body.add_child(cloak_mi)
	hood_mi = MeshInstance3D.new()
	hood_mi.mesh = hood_mesh
	hood_mi.material_override = head_mat
	head.add_child(hood_mi)
	if ghost_shader:
		cloak_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		hood_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func set_param(n: String, val: Variant) -> void:
	body_mat.set_shader_parameter(n, val)
	head_mat.set_shader_parameter(n, val)

func apply_pose(p: Pose) -> void:
	pose = p
	var c := p.crouch
	body.position.y = p.body_y - 0.16 * c
	body.rotation = Vector3(p.lean_x - 0.42 * c, 0.0, p.lean_z)
	body.scale = Vector3(1.0 + 0.10 * c, 1.0 - 0.22 * c, 1.0 + 0.10 * c)
	head.rotation = Vector3(p.head_pitch - 0.55 * c, p.head_yaw, p.head_roll)
	body_mat.set_shader_parameter("sway", p.sway)
	body_mat.set_shader_parameter("flare", p.flare)
	body_mat.set_shader_parameter("ripple", p.ripple)
	body_mat.set_shader_parameter("phase", p.phase)
	body_mat.set_shader_parameter("breath", p.breath)

# ------------------------------------------------------------------ meshes
static func _lathe(st: SurfaceTool, rings: Array, segs: int, profile: Callable) -> void:
	## rings: Array of h in 0..1; profile(h, angle) -> [Vector3 pos, Color col]
	var grid := []
	for h in rings:
		var row := []
		for s in segs + 1:
			var an := TAU * float(s) / segs
			row.append(profile.call(float(h), an))
		grid.append(row)
	for j in rings.size() - 1:
		for s in segs:
			var a: Array = grid[j][s]; var b: Array = grid[j][s + 1]
			var cc: Array = grid[j + 1][s + 1]; var d: Array = grid[j + 1][s]
			_tri(st, a, cc, b)
			_tri(st, a, d, cc)

static func _tri(st: SurfaceTool, a: Array, b: Array, c: Array) -> void:
	for p in [a, b, c]:
		st.set_color(p[1])
		st.add_vertex(p[0])

static func _build_cloak() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := [0.0, 0.03, 0.07, 0.16, 0.30, 0.46, 0.62, 0.76, 0.86, 0.93, 0.98, 1.0]
	_lathe(st, rings, 22, func(h: float, an: float) -> Array:
		# profile: wide soft hem, narrowing body, rounded shoulders, closed neck
		var r: float
		if h < 0.62: r = lerpf(0.33, 0.21, pow(h / 0.62, 0.8))
		elif h < 0.86: r = lerpf(0.21, 0.185, (h - 0.62) / 0.24)
		elif h < 0.98: r = lerpf(0.185, 0.10, pow((h - 0.86) / 0.12, 1.5))
		else: r = lerpf(0.10, 0.06, (h - 0.98) / 0.02)
		var fold := (sin(an * 6.0 + 0.4) * 0.075 + sin(an * 11.0 + 1.3) * 0.03) * pow(1.0 - h, 1.3)
		r *= 1.0 + fold
		# the back of the cloak hangs a little lower and wider; the front is cut a touch higher
		var back := cos(an - PI * 0.5)    # +z is the back (figure faces -z)
		var y := h * 0.82
		if h < 0.01: y += 0.035 - back * 0.02
		var pos := Vector3(cos(an) * r * (1.0 + back * 0.04), y, sin(an) * r * (1.0 + 0.06 * back))
		var col := CLOAK * (0.9 + 0.2 * h)
		col.a = 0.0
		if h <= 0.035:
			col = TRIM
			col.a = 0.55
		return [pos, col])
	st.generate_normals()
	return st.commit()

static func _build_hood() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# hood shell: a lathe along -z (s = 0 at the peak behind the head, 1 at the face opening)
	var rings := [0.0, 0.08, 0.2, 0.35, 0.52, 0.68, 0.82, 0.93, 1.0]
	_lathe(st, rings, 18, func(s: float, an: float) -> Array:
		var r: float
		if s < 0.35: r = lerpf(0.015, 0.15, sqrt(s / 0.35))
		elif s < 0.8: r = lerpf(0.15, 0.162, (s - 0.35) / 0.45)
		else: r = lerpf(0.162, 0.135, (s - 0.8) / 0.2)
		var z := 0.20 - s * 0.36
		var cy := 0.15 + pow(1.0 - s, 2.0) * 0.12           # the peak rises behind
		var lower := 1.0 if sin(an) < 0.0 else 0.0
		var ry := r * (1.12 + 0.25 * lower * smoothstep(0.3, 0.9, s))   # drapes down onto the shoulders
		var x := cos(an) * r * 1.0
		var y := cy + sin(an) * ry
		# the opening's rim is pulled forward a little at the top (the overhang)
		if s > 0.9 and sin(an) > 0.3: z -= 0.02
		var col := HOOD * (0.85 + 0.25 * (1.0 - s))
		col.a = 0.0
		return [Vector3(x, y, z), col])
	# the void inside: a dark disc set back in the opening
	var c0 := Vector3(0.0, 0.135, -0.075)
	var segs := 16
	for i in segs:
		var a0 := TAU * i / segs
		var a1 := TAU * (i + 1) / segs
		var p0 := c0 + Vector3(cos(a0) * 0.135, sin(a0) * 0.16, 0.0)
		var p1 := c0 + Vector3(cos(a1) * 0.135, sin(a1) * 0.16, 0.0)
		_tri(st, [c0, VOID], [p1, VOID], [p0, VOID])
	# two faint eye glints
	for sx in [-1.0, 1.0]:
		var e := Vector3(sx * 0.042, 0.145, -0.085)
		var ec := EYE
		ec.a = 1.0
		for i in 8:
			var a0 := TAU * i / 8.0
			var a1 := TAU * (i + 1) / 8.0
			_tri(st, [e, ec], [e + Vector3(cos(a1) * 0.016, sin(a1) * 0.011, -0.001), ec], [e + Vector3(cos(a0) * 0.016, sin(a0) * 0.011, -0.001), ec])
	st.generate_normals()
	return st.commit()
