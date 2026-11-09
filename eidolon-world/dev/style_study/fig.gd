extends Node3D
## Stylised heroine built from rigid lathe parts: no skinning, so nothing can fold.
## Dress = lathe rebuilt per frame from a ring spine (sway, pooling, step), arms = 2-bone analytic IK.
const A_LEN := 0.27
const B_LEN := 0.26
const WAIST := 1.02
const HEM := 0.03
const DRESS := [Vector2(0.112, 1.02), Vector2(0.142, 0.90), Vector2(0.178, 0.70), Vector2(0.215, 0.46),
	Vector2(0.258, 0.22), Vector2(0.296, 0.08), Vector2(0.306, 0.03)]
const STONE := "dress"
const VEIL := "veil"
const SKIN := "skin"
const CRIMSON := "crim"
var mk: Callable
var ghost := false
var ghost_mat: StandardMaterial3D
var dress_mi: MeshInstance3D
var dress_mesh := ArrayMesh.new()
var upper: Node3D
var head: Node3D
var arm := {}
var hand_ul := {"L": Vector3.ZERO, "R": Vector3.ZERO}

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
	var mi := MeshInstance3D.new(); mi.mesh = am; mi.material_override = _m(c); parent.add_child(mi)
	return mi

func _prim(parent: Node3D, mesh: Mesh, c: String) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = _m(c); parent.add_child(mi)
	return mi

func build(is_ghost: bool, maker: Callable) -> void:
	ghost = is_ghost; mk = maker
	if ghost:
		ghost_mat = StandardMaterial3D.new()
		ghost_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		ghost_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		ghost_mat.albedo_color = Color("b8232f")
	dress_mi = MeshInstance3D.new(); dress_mi.mesh = dress_mesh; dress_mi.material_override = _m(STONE); add_child(dress_mi)
	upper = Node3D.new(); add_child(upper)
	_lathe_node(upper, [[0.112, 0.0], [0.126, 0.10], [0.142, 0.21], [0.136, 0.29], [0.100, 0.345], [0.045, 0.38]], STONE)
	_lathe_node(upper, [[0.108, -0.04], [0.124, -0.032], [0.129, 0.0], [0.124, 0.032], [0.108, 0.04]], CRIMSON)
	var tail := BoxMesh.new(); tail.size = Vector3(0.045, 0.34, 0.012)
	var tl := _prim(upper, tail, CRIMSON); tl.position = Vector3(0.075, -0.19, 0.118); tl.rotation = Vector3(-0.16, 0.5, 0.05)
	head = Node3D.new(); head.position = Vector3(0, 0.50, 0); upper.add_child(head)
	_lathe_node(head, [[0.198, -0.30], [0.186, -0.21], [0.146, -0.118], [0.112, -0.04], [0.114, 0.03],
		[0.100, 0.09], [0.064, 0.128], [0.0, 0.140]], VEIL, 0.075)
	_lathe_node(head, [[0.113, 0.014], [0.1185, 0.03], [0.113, 0.046]], CRIMSON)
	for side in ["L", "R"]:
		var sx := 1.0 if side == "L" else -1.0
		var ua := CylinderMesh.new(); ua.height = A_LEN; ua.top_radius = 0.029; ua.bottom_radius = 0.036; ua.radial_segments = 14
		var fa := CylinderMesh.new(); fa.height = B_LEN; fa.top_radius = 0.022; fa.bottom_radius = 0.029; fa.radial_segments = 14
		var hs := SphereMesh.new(); hs.radius = 0.034; hs.height = 0.082; hs.radial_segments = 14; hs.rings = 8
		var es := SphereMesh.new(); es.radius = 0.029; es.height = 0.058; es.radial_segments = 12; es.rings = 6
		var ss := SphereMesh.new(); ss.radius = 0.044; ss.height = 0.088; ss.radial_segments = 14; ss.rings = 8
		var sh := _prim(upper, ss, SKIN); sh.position = Vector3(sx * 0.135, 0.31, 0)
		arm[side] = [_prim(upper, ua, SKIN), _prim(upper, fa, SKIN), _prim(upper, hs, SKIN), _prim(upper, es, SKIN)]

func _seg(mi: MeshInstance3D, a: Vector3, b: Vector3) -> void:
	var y := (b - a).normalized()
	var x := y.cross(Vector3.FORWARD)
	if x.length() < 0.01: x = y.cross(Vector3.RIGHT)
	x = x.normalized()
	mi.transform = Transform3D(Basis(x, y, x.cross(y)), (a + b) * 0.5)

## s: pos, yaw, bob, drop, lean, roll, twist, sway(Vector2), pool, kick, head_yaw, head_pitch,
##    swingL/R, hold, wL/wR (0..1) + tL/tR (targets in the parent space)
func apply(s: Dictionary) -> void:
	position = s.pos + Vector3(0, s.bob, 0)
	rotation.y = s.yaw
	var wy: float = WAIST - s.drop
	var k := (wy - HEM) / (WAIST - HEM)
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	for p in DRESS:
		var t: float = (WAIST - p.y) / (WAIST - HEM)
		var t2 := t * t
		cs.append(Vector3(s.sway.x * t2, HEM + (p.y - HEM) * k,
			s.sway.y * t2 + s.kick * 0.045 * sin(PI * minf(t * 1.15, 1.0)) - s.pool * 0.12 * t))
		rs.append(p.x * (1.0 + s.pool * 0.62 * pow(t, 1.3)))
	dress_mesh.clear_surfaces()
	dress_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, lathe(cs, rs))
	upper.position = Vector3(0, wy, 0)
	upper.basis = Basis.from_euler(Vector3(s.lean, s.twist, s.roll))
	head.rotation = Vector3(s.head_pitch, s.head_yaw, -s.roll * 0.6)
	var inv := (transform * upper.transform).affine_inverse()
	for side in ["L", "R"]:
		var sx := 1.0 if side == "L" else -1.0
		var sh := Vector3(sx * 0.135, 0.31, 0)
		var tg := Vector3(sx * 0.205, -0.15, 0.045 + s["swing" + side])
		if side == "R": tg = tg.lerp(Vector3(-0.185, 0.07, 0.25), s.hold)
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

func hand_pos(side: String) -> Vector3:
	return upper.global_transform * hand_ul[side]
