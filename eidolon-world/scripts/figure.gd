class_name Figure
extends Node3D
## The small hooded, cloaked figure, built procedurally (low-poly lathes, vertex coloured).
## Three meshes: the cloak (deformed in the vertex shader: sway, flare, fold ripple, breathing) with a
## thin faded cyan hem stripe (emissive, brightens as shrines wake: `hem`), the hood with a smooth,
## featureless pale MARBLE face inside it, and a SEPARATE pale grey cloth VEIL node hanging over the
## face (sways with walking and wind; a node of its own so it can later lift or fall away).
## All animation is driven by a Pose, so a reflection puppet copies (or delays, or bends) it exactly.

const CLOAK := Color(0.105, 0.11, 0.122, 0.0)     # charcoal, almost black, cool
const HOOD := Color(0.118, 0.123, 0.135, 0.0)
const STRIPE := Color(0.30, 0.62, 0.68, 0.5)       # faded cyan, emissive (alpha = emission)
const MARBLE := Color(0.84, 0.83, 0.80, 0.0)
const VEIL := Color(0.50, 0.505, 0.50, 0.0)
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
static var veil_mesh: ArrayMesh

var body: Node3D
var head: Node3D
var veil: MeshInstance3D
var cloak_mi: MeshInstance3D
var hood_mi: MeshInstance3D
var body_mat: ShaderMaterial
var head_mat: ShaderMaterial
var veil_mat: ShaderMaterial
var pose := Pose.new()
var hem := 1.0
var runes_awake := 0

func _init(ghost_shader: Shader = null) -> void:
	if cloak_mesh == null:
		cloak_mesh = _build_cloak()
		hood_mesh = _build_hood()
		veil_mesh = _build_veil()
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
	veil_mat = ShaderMaterial.new()
	veil_mat.shader = sh
	veil_mat.set_shader_parameter("deform", 0.0)
	veil_mat.set_shader_parameter("veil", 1.0)
	cloak_mi = MeshInstance3D.new()
	cloak_mi.mesh = cloak_mesh
	cloak_mi.material_override = body_mat
	body.add_child(cloak_mi)
	hood_mi = MeshInstance3D.new()
	hood_mi.mesh = hood_mesh
	hood_mi.material_override = head_mat
	head.add_child(hood_mi)
	veil = MeshInstance3D.new()
	veil.name = "Veil"
	veil.mesh = veil_mesh
	veil.material_override = veil_mat
	head.add_child(veil)
	if ghost_shader:
		for mi in [cloak_mi, hood_mi, veil]: mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func mats() -> Array[ShaderMaterial]:
	return [body_mat, head_mat, veil_mat]

func set_param(n: String, val: Variant) -> void:
	for m in mats(): m.set_shader_parameter(n, val)

## the hem stripe brightens as shrines are woken
func set_hem(k: float) -> void:
	hem = k
	set_param("glint", k)

## dormant rune embroidery: each woken shrine lights one more rune (1 = Katoptron on the hood rim)
func set_runes(n: int) -> void:
	runes_awake = n
	set_param("runes_awake", float(n))

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
	# the veil streams back a little with the walk and lifts with the stride
	veil_mat.set_shader_parameter("sway", p.sway * 1.6 + Vector2(0.0, p.ripple * 0.035))
	veil_mat.set_shader_parameter("phase", p.phase)
	veil_mat.set_shader_parameter("ripple", p.ripple)

# ------------------------------------------------------------------ meshes
## SurfaceTool vertices carry COLOR (rgb albedo, a = emission) and UV.x = material (0 cloth, 1 marble).
static func _lathe(st: SurfaceTool, rings: Array, segs: int, profile: Callable, mat := 0.0) -> void:
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
			_tri(st, a, cc, b, mat)
			_tri(st, a, d, cc, mat)

static func _tri(st: SurfaceTool, a: Array, b: Array, c: Array, mat := 0.0) -> void:
	for p in [a, b, c]:
		st.set_color(p[1])
		st.set_uv(p[2] if p.size() > 2 else Vector2(mat, 0.0))
		st.add_vertex(p[0])

static func _cloak_point(h: float, an: float, grow := 1.0) -> Vector3:
	# profile: wide soft hem, narrowing body, rounded shoulders, closed neck
	var r: float
	if h < 0.62: r = lerpf(0.33, 0.21, pow(h / 0.62, 0.8))
	elif h < 0.86: r = lerpf(0.21, 0.185, (h - 0.62) / 0.24)
	elif h < 0.98: r = lerpf(0.185, 0.10, pow((h - 0.86) / 0.12, 1.5))
	else: r = lerpf(0.10, 0.06, (h - 0.98) / 0.02)
	var fold := (sin(an * 6.0 + 0.4) * 0.075 + sin(an * 11.0 + 1.3) * 0.03) * pow(1.0 - h, 1.3)
	r *= (1.0 + fold) * grow
	var back := cos(an - PI * 0.5)    # +z is the back (figure faces -z)
	var y := h * 0.82
	if h < 0.01: y += 0.035 - back * 0.02
	elif h < 0.08: y += (0.035 - back * 0.02) * (1.0 - h / 0.08)
	return Vector3(cos(an) * r * (1.0 + back * 0.04), y, sin(an) * r * (1.0 + 0.06 * back))

static func _build_cloak() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := [0.0, 0.07, 0.16, 0.30, 0.46, 0.62, 0.76, 0.86, 0.93, 0.98, 1.0]
	_lathe(st, rings, 22, func(h: float, an: float) -> Array:
		var col := CLOAK * (0.9 + 0.2 * h)
		col.a = 0.0
		return [_cloak_point(h, an), col])
	# the hem stripe: a thin band just proud of the cloth, softly glowing
	_lathe(st, [0.024, 0.036, 0.048], 22, func(h: float, an: float) -> Array:
		var c := STRIPE
		if h < 0.03 or h > 0.045: c.a = 0.15
		return [_cloak_point(h, an, 1.012), c])
	# dormant rune embroidery just above the stripe (band 2)
	_lathe(st, [0.055, 0.0825, 0.11], 44, func(h: float, an: float) -> Array:
		return [_cloak_point(h, an, 1.008), CLOAK, Vector2(2.0 + (h - 0.055) / 0.0551, an / TAU)])
	# sleeves hanging at the sides, open cuffs embroidered (bands 4 and 5)
	for side in [-1.0, 1.0]:
		var band := 4.0 if side < 0.0 else 5.0
		var sl := func(h: float, an: float, grow: float) -> Vector3:
			var A := Vector3(side * 0.150, 0.67, -0.012)
			var B := Vector3(side * 0.212, 0.37, -0.078)
			var d := B - A
			var e1 := d.cross(Vector3.BACK).normalized()
			var e2 := d.cross(e1).normalized()
			if e2.z < 0.0: e2 = -e2
			var r := lerpf(0.042, 0.066, h) * grow
			return A + d * h + (e1 * cos(an) + e2 * sin(an)) * r
		_lathe(st, [0.0, 0.3, 0.6, 0.86, 1.0], 12, func(h: float, an: float) -> Array:
			return [sl.call(h, an, 1.0), CLOAK * (0.95 + 0.1 * h)])
		_lathe(st, [0.86, 0.93, 1.0], 24, func(h: float, an: float) -> Array:
			return [sl.call(h, an, 1.025), CLOAK, Vector2(band + (h - 0.86) / 0.1401, an / TAU)])
	st.generate_normals()
	return st.commit()

static func _hood_point(s: float, an: float, grow: float) -> Vector3:
	var r: float
	if s < 0.35: r = lerpf(0.015, 0.15, sqrt(s / 0.35))
	elif s < 0.8: r = lerpf(0.15, 0.162, (s - 0.35) / 0.45)
	else: r = lerpf(0.162, 0.135, (s - 0.8) / 0.2)
	r *= grow
	var z := 0.20 - s * 0.36
	var cy := 0.15 + pow(1.0 - s, 2.0) * 0.12           # the peak rises behind
	var lower := 1.0 if sin(an) < 0.0 else 0.0
	var ry := r * (1.12 + 0.25 * lower * smoothstep(0.3, 0.9, s))   # drapes down onto the shoulders
	var y := cy + sin(an) * ry
	if s > 0.9 and sin(an) > 0.3: z -= 0.02 * clampf((s - 0.9) / 0.07, 0.0, 1.0)   # the overhang
	return Vector3(cos(an) * r, y, z)

static func _build_hood() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# hood shell: a lathe along -z (s = 0 at the peak behind the head, 1 at the face opening)
	var rings := [0.0, 0.08, 0.2, 0.35, 0.52, 0.68, 0.82, 0.86, 0.93, 0.97, 1.0]
	_lathe(st, rings, 18, func(s: float, an: float) -> Array:
		var col := HOOD * (0.85 + 0.25 * (1.0 - s))
		col.a = 0.0
		return [_hood_point(s, an, 1.0), col])
	_lathe(st, [0.86, 0.915, 0.97], 40, func(s: float, an: float) -> Array:
		return [_hood_point(s, an, 1.014), HOOD * 0.95, Vector2(3.0 + (s - 0.86) / 0.1101, an / TAU)])
	# the face: smooth, featureless pale marble (chisel marks in the shader), set back in the hood
	_lathe(st, [0.0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.9, 1.0], 14, func(h: float, an: float) -> Array:
		var el := PI * (h - 0.5)
		var p := Vector3(cos(an) * cos(el) * 0.082, sin(el) * 0.108, sin(an) * cos(el) * 0.072)
		p.z -= 0.018 * maxf(0.0, -sin(an)) * cos(el)       # a gentle brow-to-chin fullness at the front
		return [p + Vector3(0.0, 0.14, -0.022), MARBLE], 1.0)
	st.generate_normals()
	return st.commit()

static func _build_veil() -> ArrayMesh:
	## a separate cloth sheet over the whole face, hung from inside the hood's rim
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cols := 9
	var rows := 7
	var grid := []
	for j in rows:
		var v := float(j) / (rows - 1)            # 0 top (attached), 1 hem of the veil
		var row := []
		for i in cols:
			var u := float(i) / (cols - 1) * 2.0 - 1.0
			var w := lerpf(0.100, 0.122, v)
			var x := u * w
			var y := lerpf(0.25, 0.005, v) - (1.0 - u * u) * 0.010 * v + sin(u * 9.0) * 0.005 * v
			var fold := sin(u * PI * 3.0 + 0.6) * 0.007 * v
			var z := -0.128 + u * u * 0.06 * (1.0 - v * 0.35) - v * 0.028 + fold
			var c := VEIL * (0.86 + 0.16 * (1.0 - v)) * (0.94 + 0.06 * sin(u * PI * 3.0 + 0.6))
			c.a = 0.0
			row.append([Vector3(x, y, z), c])
		grid.append(row)
	for j in rows - 1:
		for i in cols - 1:
			_tri(st, grid[j][i], grid[j + 1][i + 1], grid[j][i + 1])
			_tri(st, grid[j][i], grid[j + 1][i], grid[j + 1][i + 1])
	st.generate_normals()
	return st.commit()
