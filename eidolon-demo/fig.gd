extends Node3D
## The heroine, built from rigid lathe parts (nothing is skinned, so nothing can fold):
## layered bell dress rebuilt per frame from a ring spine, analytic two-bone arms, a long veil simulated as a chain.
const A_LEN := 0.27
const B_LEN := 0.26
const WAIST := 1.04
const HEM := 0.05
const DRESS := [Vector2(0.100, 1.04), Vector2(0.126, 0.93), Vector2(0.154, 0.77), Vector2(0.172, 0.58),
	Vector2(0.190, 0.38), Vector2(0.220, 0.19), Vector2(0.256, 0.05)]
const VN := 8
const VL := 0.17
var mk: Callable
var cloth: Material
var ghost := false
var ghost_mat: StandardMaterial3D
var dress_mi: MeshInstance3D
var over_mi: MeshInstance3D
var trim_mi: MeshInstance3D
var veil_mi: MeshInstance3D
var upper: Node3D
var head: Node3D
var arm := {}
var foot := {}
var hand_ul := {"L": Vector3.ZERO, "R": Vector3.ZERO}
var vp := PackedVector3Array()
var veil_ready := false

func _m(c: String) -> Material:
	return ghost_mat if ghost else mk.call(c)

static func lathe(cs: PackedVector3Array, rs: PackedFloat32Array, segs := 32) -> Array:
	var v := PackedVector3Array(); var n := PackedVector3Array(); var idx := PackedInt32Array()
	var m := cs.size()
	var s := 1.0 if cs[m - 1].y >= cs[0].y else -1.0
	for i in m:
		var i0 := maxi(i - 1, 0); var i1 := mini(i + 1, m - 1)
		var dy := absf(cs[i1].y - cs[i0].y); var dr := (rs[i1] - rs[i0]) * s
		for j in segs + 1:
			var a := TAU * j / segs
			var d := Vector3(cos(a), 0, sin(a))
			v.append(cs[i] + d * rs[i])
			var nn := d * dy + Vector3.UP * -dr
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
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

func _dyn(c: String) -> MeshInstance3D:
	return _prim(self, ArrayMesh.new(), c)

func _ball(parent: Node3D, r: float, h: float, c: String, p: Vector3) -> MeshInstance3D:
	var s := SphereMesh.new(); s.radius = r; s.height = h; s.radial_segments = 20; s.rings = 10
	var mi := _prim(parent, s, c); mi.position = p
	return mi

func build(is_ghost: bool, maker: Callable, cloth_mat: Material) -> void:
	ghost = is_ghost; mk = maker; cloth = cloth_mat
	if ghost:
		ghost_mat = StandardMaterial3D.new()
		ghost_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		ghost_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		ghost_mat.albedo_color = Color("b8232f")
	dress_mi = _dyn("dress"); over_mi = _dyn("dress2"); trim_mi = _dyn("crim")
	veil_mi = _dyn("veil")
	if not ghost: veil_mi.material_override = cloth
	for side in ["L", "R"]:
		var f := _ball(self, 0.042, 0.07, "veil", Vector3.ZERO); f.scale = Vector3(1, 1, 1.9)
		foot[side] = f
	upper = Node3D.new(); add_child(upper)
	_lathe_node(upper, [[0.100, 0.0], [0.110, 0.09], [0.126, 0.20], [0.118, 0.265], [0.082, 0.318], [0.036, 0.348]], "dress")
	_lathe_node(upper, [[0.097, -0.036], [0.112, -0.03], [0.117, 0.0], [0.112, 0.03], [0.097, 0.036]], "crim")
	var tail := BoxMesh.new(); tail.size = Vector3(0.04, 0.36, 0.01)
	var tl := _prim(upper, tail, "crim"); tl.position = Vector3(0.066, -0.20, 0.104); tl.rotation = Vector3(-0.15, 0.5, 0.05)
	var nk := CylinderMesh.new(); nk.top_radius = 0.027; nk.bottom_radius = 0.033; nk.height = 0.12; nk.radial_segments = 12
	_prim(upper, nk, "skin").position = Vector3(0, 0.40, 0)
	head = Node3D.new(); head.position = Vector3(0, 0.535, 0); upper.add_child(head)
	_ball(head, 0.088, 0.208, "veil", Vector3.ZERO)
	_ball(head, 0.058, 0.116, "veil", Vector3(0, 0.07, -0.072))
	# the veil over the face ends in a soft point at the collarbone; the long part hangs behind (simulated)
	_lathe_node(head, [[0.030, -0.215], [0.066, -0.14], [0.086, -0.06], [0.0895, 0.0]], "veil", -0.03)
	for side in ["L", "R"]:
		var sx := 1.0 if side == "L" else -1.0
		var ua := CylinderMesh.new(); ua.height = A_LEN; ua.top_radius = 0.026; ua.bottom_radius = 0.033; ua.radial_segments = 14
		var fa := CylinderMesh.new(); fa.height = B_LEN; fa.top_radius = 0.02; fa.bottom_radius = 0.026; fa.radial_segments = 14
		_ball(upper, 0.038, 0.076, "skin", Vector3(sx * 0.118, 0.305, 0))
		arm[side] = [_prim(upper, ua, "skin"), _prim(upper, fa, "skin"), _ball(upper, 0.031, 0.078, "skin", Vector3.ZERO),
			_ball(upper, 0.026, 0.052, "skin", Vector3.ZERO)]

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
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	var co := PackedVector3Array(); var ro := PackedFloat32Array()
	for p in DRESS:
		var t: float = (WAIST - p.y) / (WAIST - HEM)
		var t2 := t * t
		var c := Vector3(s.sway.x * t2, HEM + (p.y - HEM) * k,
			s.sway.y * t2 + s.kick * 0.05 * sin(PI * minf(t * 1.15, 1.0)) - s.pool * 0.12 * t)
		var r: float = p.x * (1.0 + s.pool * 0.9 * pow(t, 1.3))
		cs.append(c); rs.append(r)
		if t <= 0.5:
			co.append(c + Vector3(0, 0.0, 0)); ro.append(r * 1.07 + 0.012 + (0.016 if t > 0.42 else 0.0))
	_put(dress_mi, lathe(cs, rs))
	_put(over_mi, lathe(co, ro))
	var n := cs.size()
	_put(trim_mi, lathe(PackedVector3Array([cs[n - 1] + Vector3(0, 0.045, 0) + (cs[n - 2] - cs[n - 1]) * 0.3, cs[n - 1]]),
		PackedFloat32Array([lerpf(rs[n - 1], rs[n - 2], 0.3) + 0.004, rs[n - 1] + 0.004])))
	for side in ["L", "R"]:
		var sg := 1.0 if side == "L" else -1.0
		var ph: float = s.phase + (0.0 if side == "L" else PI)
		foot[side].position = Vector3(sg * 0.062, 0.035 + 0.05 * maxf(0.0, cos(ph)) * s.wk - s.bob, 0.05 + 0.19 * sin(ph) * s.wk)
		foot[side].visible = s.pool < 0.2
	upper.position = Vector3(0, wy, 0)
	upper.basis = Basis.from_euler(Vector3(s.lean, s.twist, s.roll))
	head.rotation = Vector3(s.head_pitch, s.head_yaw, -s.roll * 0.6)
	var inv := (transform * upper.transform).affine_inverse()
	for side in ["L", "R"]:
		var sx := 1.0 if side == "L" else -1.0
		var sh := Vector3(sx * 0.118, 0.305, 0)
		var tg := Vector3(sx * 0.185, -0.15, 0.045 + s["swing" + side])
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

## the long veil: a chain hung from the back of the head, each link trailing the one above it (parent space)
func _veil(s: Dictionary) -> void:
	var ht := transform * upper.transform * head.transform
	var anchor := ht * Vector3(0, 0.075, -0.07)
	var back := -Vector3(sin(s.yaw), 0, cos(s.yaw))
	var right := Vector3(cos(s.yaw), 0, -sin(s.yaw))
	if not veil_ready:
		vp.resize(VN)
		for i in VN: vp[i] = anchor + (Vector3.DOWN + back * 0.25).normalized() * VL * i
		veil_ready = true
	var dt: float = s.dt
	var wind: Vector3 = s.wind
	vp[0] = anchor
	for i in range(1, VN):
		var want := vp[i - 1] + (Vector3.DOWN + back * (0.34 if i < 3 else 0.12) + wind * (0.15 + 0.1 * i)).normalized() * VL
		vp[i] = vp[i].lerp(want, 1.0 - exp(-(20.0 - 1.7 * i) * dt))
		vp[i] = vp[i - 1] + (vp[i] - vp[i - 1]).normalized() * VL
		# keep it behind the body
		var lp := vp[i] - position
		var lz := lp.dot(-back); var lx := lp.dot(right)
		var need: float = -(body_r(lp.y + s.drop * 0.6) * (1.0 + s.pool * 0.6) + 0.035) + absf(lx) * 0.4
		if lz > need:
			vp[i] += -back * (need - lz)
			vp[i] = vp[i - 1] + (vp[i] - vp[i - 1]).normalized() * VL
	var inv := transform.affine_inverse()
	var v := PackedVector3Array(); var nrm := PackedVector3Array(); var uv := PackedVector2Array(); var idx := PackedInt32Array()
	for i in VN:
		var f := float(i) / (VN - 1)
		var w := lerpf(0.075, 0.2, smoothstep(0.0, 0.45, f)) * (1.0 - 0.25 * smoothstep(0.75, 1.0, f))
		var tng := (vp[mini(i + 1, VN - 1)] - vp[maxi(i - 1, 0)]).normalized()
		var nb := right.cross(tng).normalized()
		if nb.dot(back) < 0.0: nb = -nb
		for j in 3:
			var u := j - 1.0
			v.append(inv * (vp[i] + right * (u * w) + nb * (0.03 * (1.0 - absf(u)) + 0.012)))
			nrm.append(inv.basis * (nb + right * u * 0.7).normalized())
			uv.append(Vector2(j * 0.5, f))
	for i in VN - 1:
		for j in 2:
			var a := i * 3 + j
			idx.append_array([a, a + 1, a + 4, a, a + 4, a + 3])
	var arr := []; arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = nrm; arr[Mesh.ARRAY_TEX_UV] = uv; arr[Mesh.ARRAY_INDEX] = idx
	_put(veil_mi, arr)

func hand_pos(side: String) -> Vector3:
	return upper.global_transform * hand_ul[side]
