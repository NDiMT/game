extends Node3D
## The heroine, built from rigid lathe parts (nothing is skinned, so nothing can fold):
## layered bell dress rebuilt per frame from a ring spine, analytic two-bone arms, a long veil simulated as a chain.
const A_LEN := 0.27
const B_LEN := 0.26
const HEM := 0.05
var WAIST := 1.04
var DRESS := []
var PLEAT := 0.07
var PLEAT_T := 0.55
var NPL := 14
var TORSO := []
var BELT := true
var NECK := [0.12, 0.03, 0.40]
var HEAD_Y := 0.535
var SH := 0.118
var SH_Y := 0.305
var HOOD := []
var HOOD_AMP := []
var HOOD_DIPS := []
var HOOD_OFF := []
var HOOD_Z := 1.0
var HOOD_TILT := 0.0
var HOOD_SWAY := 99.0
var CAPE := []
var CAPE_AMP := []
var CAPE_DIPS := []
var CAPE_Y := 0.45
var CORD := false
var FACE := false
var CROWN := false
var style := 0

const A_LINE := [Vector2(0.102, 1.04), Vector2(0.128, 0.93), Vector2(0.156, 0.77), Vector2(0.176, 0.58), Vector2(0.196, 0.38), Vector2(0.222, 0.19), Vector2(0.246, 0.05)]
const TORSO_A := [[0.102, 0.0], [0.122, 0.045], [0.119, 0.11], [0.127, 0.20], [0.118, 0.265], [0.082, 0.318], [0.036, 0.348]]
const TORSO_S := [[0.09, 0.0], [0.10, 0.05], [0.098, 0.12], [0.104, 0.20], [0.094, 0.265], [0.06, 0.31], [0.026, 0.335]]
const CAP := [Vector2(0.004, 0.112), Vector2(0.07, 0.097), Vector2(0.10, 0.042), Vector2(0.103, -0.02), Vector2(0.088, -0.08), Vector2(0.05, -0.118), Vector2(0.036, -0.15)]

## 1 kore (pleated dress, veil to the shoulders)  2 bell (one long bell, a smooth oval for a face)
## 3 mantle (long mantle behind, open in front)   4 caryatid (tall fluted column, a capital on her head)
## 5 cowl (pointed veil, knee cloak)              6 idol (shield head, long neck, bell cape)
func set_style(id: int) -> void:
	style = id
	DRESS = A_LINE.duplicate(); TORSO = TORSO_A.duplicate()
	HOOD = [Vector2(0.004, 0.122), Vector2(0.060, 0.108), Vector2(0.093, 0.066), Vector2(0.102, 0.008), Vector2(0.099, -0.055),
		Vector2(0.094, -0.115), Vector2(0.112, -0.175), Vector2(0.152, -0.235), Vector2(0.180, -0.305)]
	HOOD_AMP = [0.0, 0.0, 0.0, 0.004, 0.012, 0.03, 0.05, 0.065, 0.075]; HOOD_DIPS = [0, 0, 0, 0, 0, 0, 0.004, 0.018, 0.04]; HOOD_SWAY = 5.0
	match id:
		2:
			WAIST = 1.0; DRESS = [Vector2(0.09, 1.0), Vector2(0.11, 0.9), Vector2(0.13, 0.74), Vector2(0.15, 0.56), Vector2(0.17, 0.37), Vector2(0.19, 0.18), Vector2(0.2, 0.05)]
			TORSO = TORSO_S.duplicate(); BELT = false; NECK = [0.1, 0.028, 0.385]; HEAD_Y = 0.5; SH = 0.09; SH_Y = 0.29
			HOOD = CAP.slice(0, 6); HOOD_AMP = []; HOOD_DIPS = []; HOOD_SWAY = 99.0; FACE = true; CORD = true; CAPE_Y = 0.40
			CAPE = [Vector2(0.05, 0.0), Vector2(0.12, -0.09), Vector2(0.185, -0.38), Vector2(0.25, -0.78), Vector2(0.305, -1.14), Vector2(0.34, -1.36)]
			CAPE_AMP = [0.0, 0.01, 0.03, 0.045, 0.055, 0.06]; CAPE_DIPS = [0, 0, 0, 0, 0, 0]
		3:
			WAIST = 1.06; DRESS = [Vector2(0.09, 1.06), Vector2(0.115, 0.95), Vector2(0.135, 0.78), Vector2(0.15, 0.58), Vector2(0.168, 0.38), Vector2(0.195, 0.19), Vector2(0.225, 0.05)]
			PLEAT = 0.06; TORSO = TORSO_S.duplicate(); NECK = [0.14, 0.026, 0.405]; HEAD_Y = 0.55; SH = 0.1; SH_Y = 0.295
			HOOD = CAP.duplicate(); HOOD_AMP = []; HOOD_DIPS = []; HOOD_SWAY = 99.0; CORD = true; CAPE_Y = 0.43
			CAPE = [Vector2(0.04, 0.0), Vector2(0.11, -0.08), Vector2(0.17, -0.3), Vector2(0.21, -0.65), Vector2(0.25, -1.0), Vector2(0.28, -1.3)]
			CAPE_AMP = [0.0, 0.02, 0.04, 0.06, 0.07, 0.08]; CAPE_DIPS = [0, 0, -0.18, -0.5, -0.82, -1.1]
		4:
			WAIST = 1.22; DRESS = [Vector2(0.082, 1.22), Vector2(0.1, 1.1), Vector2(0.104, 0.9), Vector2(0.106, 0.6), Vector2(0.11, 0.3), Vector2(0.122, 0.12), Vector2(0.14, 0.05)]
			PLEAT = 0.085; PLEAT_T = 0.1; NPL = 12; TORSO = TORSO_S.duplicate(); NECK = [0.2, 0.022, 0.435]; HEAD_Y = 0.63; SH = 0.09; SH_Y = 0.29
			HOOD = CAP.duplicate(); HOOD_AMP = []; HOOD_DIPS = []; HOOD_SWAY = 99.0; CROWN = true
		5:
			SH = 0.11; SH_Y = 0.3; CAPE_Y = 0.37
			HOOD = [Vector2(0.004, 0.2), Vector2(0.045, 0.155), Vector2(0.09, 0.09), Vector2(0.108, 0.02), Vector2(0.104, -0.05), Vector2(0.096, -0.11), Vector2(0.114, -0.17)]
			HOOD_OFF = [-0.1, -0.065, -0.02, 0, 0, 0, 0]; HOOD_AMP = []; HOOD_DIPS = []; HOOD_SWAY = 99.0
			CAPE = [Vector2(0.11, 0.0), Vector2(0.16, -0.12), Vector2(0.2, -0.4), Vector2(0.23, -0.75), Vector2(0.25, -0.95)]
			CAPE_AMP = [0.0, 0.02, 0.04, 0.06, 0.07]; CAPE_DIPS = [0, -0.02, -0.2, -0.5, -0.68]
		6:
			WAIST = 1.12; DRESS = [Vector2(0.086, 1.12), Vector2(0.112, 1.0), Vector2(0.118, 0.82), Vector2(0.104, 0.58), Vector2(0.118, 0.34), Vector2(0.176, 0.15), Vector2(0.262, 0.05)]
			TORSO = [[0.088, 0.0], [0.102, 0.05], [0.100, 0.12], [0.106, 0.20], [0.096, 0.265], [0.062, 0.31], [0.026, 0.335]]
			BELT = false; NECK = [0.26, 0.022, 0.45]; HEAD_Y = 0.69; SH = 0.092; SH_Y = 0.292; CORD = true; CAPE_Y = 0.55
			HOOD = [Vector2(0.004, 0.128), Vector2(0.086, 0.122), Vector2(0.126, 0.086), Vector2(0.130, 0.02), Vector2(0.112, -0.05), Vector2(0.074, -0.105), Vector2(0.034, -0.142)]
			HOOD_AMP = []; HOOD_DIPS = []; HOOD_SWAY = 99.0; HOOD_Z = 0.66; HOOD_TILT = -0.2
			CAPE = [Vector2(0.034, 0.0), Vector2(0.05, -0.05), Vector2(0.112, -0.12), Vector2(0.158, -0.24), Vector2(0.182, -0.4), Vector2(0.198, -0.56)]
			CAPE_AMP = [0.0, 0.0, 0.02, 0.05, 0.075, 0.09]; CAPE_DIPS = [0, 0, 0, -0.02, -0.07, -0.13]

const VN := 8
const VL := 0.17
var mk: Callable
var cloth: Material
var ghost := false
var ghost_mat: StandardMaterial3D
var dress_mi: MeshInstance3D
var veil_mi: MeshInstance3D
var cape_mi: MeshInstance3D
var upper: Node3D
var head: Node3D
var arm := {}
var foot := {}
var hand_ul := {"L": Vector3.ZERO, "R": Vector3.ZERO}
var vp := PackedVector3Array()
var veil_ready := false

var remap := {}
func _m(c: String) -> Material:
	return ghost_mat if ghost else mk.call(remap.get(c, c))

static func lathe(cs: PackedVector3Array, rs: PackedFloat32Array, segs := 32, amps := PackedFloat32Array(), npl := 0, dips := PackedFloat32Array()) -> Array:
	var v := PackedVector3Array(); var n := PackedVector3Array(); var idx := PackedInt32Array()
	var m := cs.size()
	var s := 1.0 if cs[m - 1].y >= cs[0].y else -1.0
	for i in m:
		var i0 := maxi(i - 1, 0); var i1 := mini(i + 1, m - 1)
		var dy := absf(cs[i1].y - cs[i0].y); var dr := (rs[i1] - rs[i0]) * s
		var amp := amps[i] if amps.size() > i else 0.0
		var dip := dips[i] if dips.size() > i else 0.0
		for j in segs + 1:
			var a := TAU * j / segs
			var d := Vector3(cos(a), 0, sin(a))
			var k := 1.0 + amp * cos(npl * a)
			v.append(cs[i] + d * rs[i] * k - Vector3(0, dip * pow(maxf(0.0, sin(a)), 2.0), 0))
			var nx := (d * k + Vector3(-sin(a), 0, cos(a)) * (amp * npl * sin(npl * a))).normalized()
			var nn := nx * dy + Vector3.UP * -dr
			n.append(nn.normalized() if nn.length() > 0.0001 else d)
	for i in m - 1:
		for j in segs:
			var a := i * (segs + 1) + j; var b := a + 1; var c := a + segs + 1; var d2 := c + 1
			if s > 0.0: idx.append_array([a, b, d2, a, d2, c])
			else: idx.append_array([a, d2, b, a, c, d2])
	var arr := []; arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n; arr[Mesh.ARRAY_INDEX] = idx
	return arr

func _lathe_node(parent: Node3D, prof: Array, c: String, back := 0.0) -> MeshInstance3D:
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	var y0: float = prof[0][1]; var y1: float = prof[prof.size() - 1][1]
	for p in prof:
		var t: float = 1.0 - (p[1] - y0) / (y1 - y0)
		cs.append(Vector3(0, p[1], -back * t * t)); rs.append(p[0])
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, lathe(cs, rs))
	return _prim(parent, am, c)

func _prim(parent: Node3D, mesh: Mesh, c: String) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = _m(c); parent.add_child(mi)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if ghost else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return mi

func _dyn(c: String) -> MeshInstance3D:
	return _prim(self, ArrayMesh.new(), c)

func _ball(parent: Node3D, r: float, h: float, c: String, p: Vector3) -> MeshInstance3D:
	var s := SphereMesh.new(); s.radius = r; s.height = h; s.radial_segments = 20; s.rings = 10
	var mi := _prim(parent, s, c); mi.position = p
	return mi

func build(kind: int, maker: Callable, cloth_mat: Material, face_mat: Material) -> void:
	ghost = kind == 1; mk = maker; cloth = cloth_mat
	if style == 0: set_style(1)
	if kind == 2: remap = {"dress": "crim", "crim": "gold"}
	if kind == 3: remap = {"dress": "marble", "veil": "marble", "skin": "marble", "crim": "shade"}
	if ghost:
		ghost_mat = StandardMaterial3D.new()
		ghost_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		ghost_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		ghost_mat.albedo_color = Color("b8232f")
	dress_mi = _dyn("dress")
	for side in ["L", "R"]:
		var ft := _ball(self, 0.04, 0.066, "skin", Vector3.ZERO); ft.scale = Vector3(1, 1, 1.9)
		foot[side] = ft
	upper = Node3D.new(); add_child(upper)
	_lathe_node(upper, TORSO, "dress")
	var w0: float = TORSO[0][0]
	if BELT: _lathe_node(upper, [[w0 - 0.002, -0.022], [w0 + 0.008, -0.016], [w0 + 0.011, 0.0], [w0 + 0.008, 0.016], [w0 - 0.002, 0.022]], "crim")
	var nk := CylinderMesh.new(); nk.top_radius = NECK[1] * 0.9; nk.bottom_radius = NECK[1] * 1.15; nk.height = NECK[0]; nk.radial_segments = 12
	_prim(upper, nk, "skin").position = Vector3(0, NECK[2], 0)
	if CORD: _lathe_node(upper, [[0.03, CAPE_Y - 0.014], [0.04, CAPE_Y - 0.003], [0.03, CAPE_Y + 0.008]], "crim")
	cape_mi = _prim(upper, ArrayMesh.new(), "veil"); cape_mi.position = Vector3(0, CAPE_Y, 0)
	head = Node3D.new(); head.position = Vector3(0, HEAD_Y, 0); upper.add_child(head)
	veil_mi = _prim(head, ArrayMesh.new(), "veil"); veil_mi.scale = Vector3(1, 1, HOOD_Z); veil_mi.rotation.x = HOOD_TILT
	if FACE:
		var fp := _ball(head, 0.062, 0.168, "skin", Vector3(0, -0.008, 0.078)); fp.scale = Vector3(1, 1, 0.6)
		if kind == 0 and face_mat != null: fp.material_override = face_mat
	if CROWN:
		var ec := CylinderMesh.new(); ec.bottom_radius = 0.075; ec.top_radius = 0.115; ec.height = 0.05; ec.radial_segments = 20
		_prim(head, ec, "skin").position = Vector3(0, 0.13, 0)
		var ab := BoxMesh.new(); ab.size = Vector3(0.26, 0.045, 0.26)
		_prim(head, ab, "skin").position = Vector3(0, 0.178, 0)
	var thick := 1.25 if SH > 0.105 else 1.0
	for side in ["L", "R"]:
		var sx := 1.0 if side == "L" else -1.0
		var ua := CylinderMesh.new(); ua.height = A_LEN; ua.top_radius = 0.02 * thick; ua.bottom_radius = 0.026 * thick; ua.radial_segments = 14
		var fa := CylinderMesh.new(); fa.height = B_LEN; fa.top_radius = 0.016 * thick; fa.bottom_radius = 0.02 * thick; fa.radial_segments = 14
		_ball(upper, 0.03 * thick, 0.06 * thick, "skin", Vector3(sx * SH, SH_Y, 0))
		arm[side] = [_prim(upper, ua, "skin"), _prim(upper, fa, "skin"), _ball(upper, 0.026 * thick, 0.07 * thick, "skin", Vector3.ZERO),
			_ball(upper, 0.02 * thick, 0.04 * thick, "skin", Vector3.ZERO)]

func _seg(mi: MeshInstance3D, a: Vector3, b: Vector3) -> void:
	var y := (b - a).normalized()
	var x := y.cross(Vector3.FORWARD)
	if x.length() < 0.01: x = y.cross(Vector3.RIGHT)
	x = x.normalized()
	mi.transform = Transform3D(Basis(x, y, x.cross(y)), (a + b) * 0.5)

func _put(mi: MeshInstance3D, arr: Array) -> void:
	var am := mi.mesh as ArrayMesh
	am.clear_surfaces(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)

func body_r(y: float) -> float:
	if y >= WAIST: return 0.125
	for i in range(1, DRESS.size()):
		if y >= DRESS[i].y:
			return lerpf(DRESS[i].x, DRESS[i - 1].x, (y - DRESS[i].y) / (DRESS[i - 1].y - DRESS[i].y))
	return DRESS[DRESS.size() - 1].x

## s: pos, yaw, bob, drop, lean, roll, twist, sway(Vector2), pool, kick, phase, wk, head_yaw, head_pitch,
##    swingL/R, hold, raise, open, wL/wR + tL/tR (targets in the parent space), dt, wind
func apply(s: Dictionary) -> void:
	position = s.pos + Vector3(0, s.bob, 0)
	rotation.y = s.yaw
	var wy: float = WAIST - s.drop
	var k := (wy - HEM) / (WAIST - HEM)
	var cs := PackedVector3Array(); var rs := PackedFloat32Array(); var am := PackedFloat32Array()
	for p in DRESS:
		var t: float = (WAIST - p.y) / (WAIST - HEM)
		var t2 := t * t
		cs.append(Vector3(s.sway.x * t2, HEM + (p.y - HEM) * k,
			s.sway.y * t2 + s.kick * 0.05 * sin(PI * minf(t * 1.15, 1.0)) - s.pool * 0.12 * t))
		rs.append(p.x * (1.0 + s.pool * 0.9 * pow(t, 1.3)))
		am.append(PLEAT * smoothstep(0.0, PLEAT_T, t))
	_put(dress_mi, lathe(cs, rs, 56, am, NPL))
	for side in ["L", "R"]:
		var sg := 1.0 if side == "L" else -1.0
		var ph: float = s.phase + (0.0 if side == "L" else PI)
		foot[side].position = Vector3(sg * 0.055, 0.032 + 0.025 * maxf(0.0, cos(ph)) * s.wk - s.bob, 0.05 + 0.11 * sin(ph) * s.wk)
		foot[side].visible = s.pool < 0.2
	upper.position = Vector3(0, wy, 0)
	upper.basis = Basis.from_euler(Vector3(s.lean, s.twist, s.roll))
	head.rotation = Vector3(s.head_pitch, s.head_yaw, -s.roll * 0.6)
	var inv := (transform * upper.transform).affine_inverse()
	for side in ["L", "R"]:
		var sx := 1.0 if side == "L" else -1.0
		var sh := Vector3(sx * SH, SH_Y, 0)
		var tg := Vector3(sx * (SH + 0.05), -0.2, 0.03 + s["swing" + side])
		if side == "R": tg = tg.lerp(Vector3(-0.17, 0.07, 0.25), s.hold).lerp(Vector3(-0.2, 0.74, 0.16), s.raise)
		tg += Vector3(sx * 0.14, 0.04, 0.02) * s.open
		var w: float = s["w" + side]
		if w > 0.0: tg = tg.lerp(inv * s["t" + side], w)
		var dv := tg - sh
		var d := clampf(dv.length(), 0.06, A_LEN + B_LEN - 0.004)
		var dir := dv.normalized()
		var ca := clampf((A_LEN * A_LEN + d * d - B_LEN * B_LEN) / (2.0 * A_LEN * d), -1.0, 1.0)
		var pole := Vector3(sx * 0.45, -0.2, -1.0)
		pole = (pole - dir * pole.dot(dir)).normalized()
		var el := sh + dir * (A_LEN * ca) + pole * (A_LEN * sqrt(1.0 - ca * ca))
		var hd := sh + dir * d
		_seg(arm[side][0], sh, el); _seg(arm[side][1], el, hd)
		arm[side][2].position = hd + (hd - el).normalized() * 0.02
		arm[side][3].position = el
		hand_ul[side] = hd
	_veil(s)

func _veil(s: Dictionary) -> void:
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	for i in HOOD.size():
		var t := clampf((i - HOOD_SWAY) / 3.0, 0.0, 1.0)
		var off: float = HOOD_OFF[i] if HOOD_OFF.size() > i else 0.0
		var fwd := 0.012 if (style == 1 and i >= 3 and i <= 5) else 0.0
		cs.append(Vector3(s.sway.x * 0.7 * t * t, HOOD[i].y, off + fwd - 0.02 * t + s.sway.y * 0.7 * t * t - s.lean * 0.05 * t))
		rs.append(HOOD[i].x)
	_put(veil_mi, lathe(cs, rs, 54, PackedFloat32Array(HOOD_AMP), 9, PackedFloat32Array(HOOD_DIPS)))
	if CAPE.is_empty(): return
	var cc := PackedVector3Array(); var cr := PackedFloat32Array()
	for i in CAPE.size():
		var t := float(i) / (CAPE.size() - 1)
		var tm: float = s.get("tm", 0.0)
		cc.append(Vector3(s.sway.x * 1.25 * t * t + sin(tm * 1.1 + i) * 0.01 * t, CAPE[i].y, -0.015 * t + s.sway.y * 1.25 * t * t - s.lean * 0.1 * t + cos(tm * 0.9 + i * 0.7) * 0.01 * t))
		cr.append(CAPE[i].x)
	_put(cape_mi, lathe(cc, cr, 54, PackedFloat32Array(CAPE_AMP), 9, PackedFloat32Array(CAPE_DIPS)))

func hand_pos(side: String) -> Vector3:
	return upper.global_transform * hand_ul[side]
