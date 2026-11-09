extends Node3D
## EIDOLON style study v2: fine-scale isometric architecture, flat hand-picked colours per face (no lighting),
## rigid-part heroine with procedural animation.
const Fig := preload("res://fig.gd")
const MX := -1.2
const LAMP0 := Vector3(-1.1, 0.17, 1.2)
const WALK := 1.4
const TEAL_D := Color("13283a")
const CRIMSON := Color("b8232f")
const FOG := Color("e9c3a6")
const PALS := {
	"stone": ["f7eee0", "e7d4c4", "ada5c0"], "shade": ["eaddcb", "d6c0b0", "9c94b0"],
	"far": ["cfcbd6", "bab5c9", "9896b4"], "far2": ["b4b3c9", "a3a1bf", "8a8aad"],
	"dark": ["5a5678", "4d4a6e", "44416a"], "crim": ["dc3d46", "bb2530", "7e1c31"],
	"teal": ["13283a", "13283a", "13283a"], "water": ["d6f1ea", "c2e8e0", "a9d6d3"],
	"cream": ["fff3d2", "fff3d2", "fff3d2"],
	"dress": ["c6c2d2", "aeaac0", "8684a2"], "veil": ["fbf8f2", "ece3db", "bdb5c9"], "skin": ["e6dacf", "d0c2b9", "a69aa9"],
}
const SH := """shader_type spatial;
render_mode unshaded;
uniform vec3 c_top : source_color; uniform vec3 c_z : source_color; uniform vec3 c_x : source_color;
uniform vec3 fog_col : source_color; uniform vec3 lamp_pos; uniform float lamp_e = 0.0;
uniform vec3 door_pos; uniform float door_e = 0.0;
varying vec3 wp; varying vec3 wn;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment(){
	vec3 n = normalize(wn);
	float wt = max(n.y, 0.0); float wz = max(n.z, 0.0); float wx = max(n.x, 0.0);
	float s = wt * wt + wz * wz + wx * wx;
	vec3 col = c_top * wt * wt + c_z * wz * wz + c_x * wx * wx + c_x * 0.86 * (1.0 - min(s, 1.0));
	col *= mix(0.94, 1.0, smoothstep(-1.5, 1.5, wp.y) * (1.0 - wt));
	float l = lamp_e * pow(clamp(1.0 - distance(wp, lamp_pos) / 3.0, 0.0, 1.0), 2.0);
	l += door_e * pow(clamp(1.0 - distance(wp, door_pos) / 2.4, 0.0, 1.0), 2.0);
	col = mix(col, col * vec3(1.06, 0.97, 0.80) + vec3(0.09, 0.055, 0.0), clamp(l, 0.0, 1.0) * 0.85);
	col = mix(col, fog_col, smoothstep(-2.6, -9.5, wp.y));
	ALBEDO = col;
}"""

var shader: Shader
var pmats := {}
var umats := {}
var fig: Node3D
var ghost: Node3D
var lamp: Node3D
var lamp_core: MeshInstance3D
var lamp_halo: MeshInstance3D
var door_halo: MeshInstance3D
var blob: MeshInstance3D
var lamp_held := false
var lamp_energy := 0.22
var door_energy := 0.0
var lamp_off := Vector3.ZERO
var lamp_vel := Vector3.ZERO
var cam: Camera3D
var cam2: Camera3D
var door: MeshInstance3D
var ripple: MeshInstance3D
var ripple_p := 1.0
var flash := 0.0
var caption: Label

var pos := Vector3(1.0, 0, 1.9)
var yaw := -2.2
var spd := 0.0
var vel := Vector3.ZERO
var path: Array[Vector3] = []
var face_to = null
var look_at_pt = null
var phase := 0.0
var t := 0.0
var sway := Vector2.ZERO
var sway_v := Vector2.ZERO
var head_yaw := 0.0
var a_drop := 0.0
var a_lean := 0.0
var a_pool := 0.0
var a_hold := 0.0
var a_headp := 0.0
var a_wL := 0.0
var a_wR := 0.0
var tgtL := Vector3.ZERO
var tgtR := Vector3.ZERO
signal arrived
signal faced

func pal(n: String) -> ShaderMaterial:
	if pmats.has(n): return pmats[n]
	var m := ShaderMaterial.new(); m.shader = shader
	m.set_shader_parameter("c_top", Color(PALS[n][0])); m.set_shader_parameter("c_z", Color(PALS[n][1]))
	m.set_shader_parameter("c_x", Color(PALS[n][2])); m.set_shader_parameter("fog_col", FOG)
	pmats[n] = m
	return m

func mat(c: Color, add := false) -> StandardMaterial3D:
	var k := "%s|%s" % [c.to_html(), add]
	if umats.has(k): return umats[k]
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if c.a < 1.0: m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if add: m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	umats[k] = m
	return m

func blk(a: Vector3, b: Vector3, p := "stone", parent: Node = self) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); var bm := BoxMesh.new()
	bm.size = (b - a).abs(); mi.mesh = bm; mi.position = (a + b) * 0.5
	mi.material_override = pal(p); parent.add_child(mi)
	return mi

func prim(mesh: Mesh, p: Vector3, m: Material, parent: Node = self) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.position = p; mi.material_override = m; parent.add_child(mi)
	return mi

func cornice(x0: float, z0: float, x1: float, z1: float, y: float, o := 0.045, h := 0.06, p := "shade") -> void:
	blk(Vector3(x0 - o, y, z0 - o), Vector3(x1 + o, y + h, z1 + o), p)

func win_z(x: float, y: float, z: float, w: float, h: float, p := "dark") -> void:
	blk(Vector3(x - w * 0.5, y, z), Vector3(x + w * 0.5, y + h - w * 0.5, z + 0.012), p)
	var c := CylinderMesh.new(); c.top_radius = w * 0.5; c.bottom_radius = w * 0.5; c.height = 0.012; c.radial_segments = 24
	prim(c, Vector3(x, y + h - w * 0.5, z + 0.006), pal(p)).rotation.x = PI * 0.5

func win_x(x: float, y: float, z: float, w: float, h: float, p := "dark") -> void:
	blk(Vector3(x, y, z - w * 0.5), Vector3(x + 0.012, y + h - w * 0.5, z + w * 0.5), p)
	var c := CylinderMesh.new(); c.top_radius = w * 0.5; c.bottom_radius = w * 0.5; c.height = 0.012; c.radial_segments = 24
	prim(c, Vector3(x + 0.006, y + h - w * 0.5, z), pal(p)).rotation.z = PI * 0.5

func crenels(a: Vector3, b: Vector3, step := 0.3, sz := 0.13, p := "stone") -> void:
	var n := int(a.distance_to(b) / step)
	for i in n + 1:
		var c := a.lerp(b, float(i) / maxf(n, 1))
		blk(c - Vector3(sz, 0, sz) * 0.5, c + Vector3(sz * 0.5, sz * 0.9, sz * 0.5), p)

func dome(p: Vector3, r: float, pl := "crim") -> void:
	var s := SphereMesh.new(); s.radius = r; s.height = r; s.is_hemisphere = true; s.radial_segments = 32; s.rings = 12
	prim(s, p, pal(pl))
	finial(p + Vector3(0, r, 0), r * 0.9)

func cone(p: Vector3, r: float, h: float, pl := "crim", sides := 32) -> void:
	var c := CylinderMesh.new(); c.top_radius = 0.0; c.bottom_radius = r; c.height = h; c.radial_segments = sides
	var mi := prim(c, p + Vector3(0, h * 0.5, 0), pal(pl))
	if sides == 4: mi.rotation.y = PI * 0.25
	finial(p + Vector3(0, h, 0), 0.34)

func finial(p: Vector3, h: float) -> void:
	var c := CylinderMesh.new(); c.top_radius = 0.008; c.bottom_radius = 0.012; c.height = h; c.radial_segments = 8
	prim(c, p + Vector3(0, h * 0.5, 0), pal("shade"))
	var s := SphereMesh.new(); s.radius = 0.035; s.height = 0.07; s.radial_segments = 12; s.rings = 6
	prim(s, p + Vector3(0, h, 0), pal("crim"))

func halo(size: float, c: Color) -> MeshInstance3D:
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.35, 1.0])
	g.colors = PackedColorArray([c, Color(c.r, c.g, c.b, c.a * 0.35), Color(c.r, c.g, c.b, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 128; gt.height = 128
	var q := QuadMesh.new(); q.size = Vector2(size, size)
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_texture = gt
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.no_depth_test = false
	var mi := MeshInstance3D.new(); mi.mesh = q; mi.material_override = m
	return mi

func _ready() -> void:
	shader = Shader.new(); shader.code = SH
	_env(); _world(); _actors(); _ui()
	_run()

func _env() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color("2b3658")
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 11.0 * 1280.0 / 720.0; cam.near = 0.1; cam.far = 90.0
	cam.rotation_degrees = Vector3(-35.264, 45, 0)
	add_child(cam)
	cam.position = Vector3(0.6, 0.45, -0.6) + cam.basis.z * 30.0
	cam.current = true; cam.cull_mask = 3
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.42, 0.78, 1.0])
	g.colors = PackedColorArray([Color("1d2a4a"), Color("46557c"), Color("b88f95"), FOG])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill_from = Vector2(0, 0); gt.fill_to = Vector2(0, 1); gt.width = 8; gt.height = 256
	var qm := QuadMesh.new(); qm.size = Vector2(12.5, 21)
	var bm := StandardMaterial3D.new(); bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; bm.albedo_texture = gt
	var bg := prim(qm, Vector3(0, 0, -85), bm, cam); bg.layers = 2
	var g2 := Gradient.new()
	g2.offsets = PackedFloat32Array([0.0, 0.66, 0.92, 1.0])
	g2.colors = PackedColorArray([Color(FOG.r, FOG.g, FOG.b, 0), Color(FOG.r, FOG.g, FOG.b, 0), Color(FOG.r, FOG.g, FOG.b, 0.85), Color(FOG.r, FOG.g, FOG.b, 1)])
	var gt2 := GradientTexture2D.new(); gt2.gradient = g2; gt2.fill_from = Vector2(0, 0); gt2.fill_to = Vector2(0, 1); gt2.width = 8; gt2.height = 256
	var mm := StandardMaterial3D.new(); mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mm.albedo_texture = gt2
	mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; mm.no_depth_test = true; mm.render_priority = 10
	var mist := prim(qm, Vector3(0, 0, -1), mm, cam); mist.layers = 2
	var motes := CPUParticles3D.new()
	motes.amount = 60; motes.lifetime = 10.0; motes.preprocess = 10.0
	motes.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX; motes.emission_box_extents = Vector3(7, 8, 7)
	motes.position = Vector3(0, 4, -2); motes.gravity = Vector3(0, 0.02, 0); motes.initial_velocity_min = 0.02; motes.initial_velocity_max = 0.06
	motes.spread = 180.0; motes.scale_amount_min = 0.5; motes.scale_amount_max = 1.1
	var pq := QuadMesh.new(); pq.size = Vector2(0.03, 0.03)
	var pmat := StandardMaterial3D.new(); pmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	pmat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; pmat.albedo_color = Color(1, 0.94, 0.84, 0.6)
	pmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pq.material = pmat; motes.mesh = pq
	add_child(motes)

func _world() -> void:
	# ---- lower terrace: thin slab, corbels, slim shaft with arches
	blk(Vector3(-1.7, -0.14, -0.4), Vector3(1.5, 0, 2.5))
	blk(Vector3(-1.74, -0.2, -0.44), Vector3(1.54, -0.14, 2.54), "shade")
	blk(Vector3(-1.5, -0.34, -0.2), Vector3(1.3, -0.2, 2.3))
	blk(Vector3(-1.3, -0.5, 0.0), Vector3(1.1, -0.34, 2.1), "shade")
	blk(Vector3(-1.1, -17, 0.2), Vector3(0.9, -0.5, 1.9))
	for wx in [-0.6, 0.4]: win_z(wx, -1.9, 1.9, 0.44, 1.05)
	for wz in [0.65, 1.45]: win_x(0.9, -1.9, wz, 0.44, 1.05)
	cornice(-1.1, 0.2, 0.9, 1.9, -2.45, 0.04, 0.07)
	cornice(-1.1, 0.2, 0.9, 1.9, -5.2, 0.04, 0.07)
	for wx in [-0.6, 0.4]: win_z(wx, -4.3, 1.9, 0.26, 0.7)
	for wz in [0.65, 1.45]: win_x(0.9, -4.3, wz, 0.26, 0.7)
	# floor inlay lines + parapet
	for i in 3:
		blk(Vector3(-1.6, 0, 0.3 + i * 0.75), Vector3(1.4, 0.004, 0.32 + i * 0.75), "shade")
		blk(Vector3(-0.95 + i * 0.85, 0, -0.3), Vector3(-0.93 + i * 0.85, 0.004, 2.4), "shade")
	crenels(Vector3(-1.63, 0, -0.33), Vector3(-1.63, 0, 2.43), 0.345)
	crenels(Vector3(-1.3, 0, -0.33), Vector3(-0.42, 0, -0.33), 0.29)
	crenels(Vector3(0.84, 0, -0.33), Vector3(1.43, 0, -0.33), 0.295)
	# balcony on the right with a slim lantern post
	blk(Vector3(1.5, -0.1, 0.7), Vector3(2.2, 0, 1.6)); blk(Vector3(1.5, -0.3, 0.9), Vector3(2.0, -0.1, 1.4), "shade")
	var post := CylinderMesh.new(); post.top_radius = 0.018; post.bottom_radius = 0.026; post.height = 1.5; post.radial_segments = 10
	prim(post, Vector3(2.05, 0.75, 0.85), pal("shade"))
	blk(Vector3(1.8, 1.44, 0.835), Vector3(2.07, 1.47, 0.865), "shade")
	blk(Vector3(1.78, 1.2, 0.81), Vector3(1.86, 1.42, 0.89), "crim")
	# ---- floating stairs: 8 slim treads
	for i in 8:
		blk(Vector3(-0.2, 0.125 * (i + 1) - 0.1, -0.4 - 0.2 * (i + 1)), Vector3(0.6, 0.125 * (i + 1), -0.4 - 0.2 * i))
		blk(Vector3(-0.2, 0.125 * (i + 1) - 0.34, -0.4 - 0.2 * (i + 1)), Vector3(-0.14, 0.125 * (i + 1) - 0.1, -0.4 - 0.2 * i), "shade")
		blk(Vector3(0.54, 0.125 * (i + 1) - 0.34, -0.4 - 0.2 * (i + 1)), Vector3(0.6, 0.125 * (i + 1) - 0.1, -0.4 - 0.2 * i), "shade")
	# ---- upper terrace
	blk(Vector3(-2.3, 0.86, -4.3), Vector3(1.5, 1.0, -2.0))
	blk(Vector3(-2.34, 0.8, -4.34), Vector3(1.54, 0.86, -1.96), "shade")
	blk(Vector3(-2.1, -17, -4.1), Vector3(1.3, 0.8, -2.2))
	for wx in [-1.5, 0.95]: win_z(wx, -0.55, -2.2, 0.46, 1.0)
	for wz in [-2.75, -3.55]: win_x(1.3, -0.55, wz, 0.46, 1.0)
	cornice(-2.1, -4.1, 1.3, -2.2, -1.05, 0.04, 0.07)
	for wx in [-1.5, -0.55, 0.2, 0.95]: win_z(wx, -2.6, -2.2, 0.22, 0.6)
	for wz in [-2.6, -3.15, -3.7]: win_x(1.3, -2.6, wz, 0.22, 0.6)
	cornice(-2.1, -4.1, 1.3, -2.2, -3.4, 0.04, 0.07)
	blk(Vector3(-1.8, -17, -3.8), Vector3(1.0, -3.4, -2.5))
	# water: a spout and a thin fall
	blk(Vector3(1.3, -0.02, -3.22), Vector3(1.46, 0.06, -3.08), "shade")
	blk(Vector3(1.40, -17, -3.2), Vector3(1.42, 0.02, -3.1), "water")
	# ---- mirror wall with its niche
	var w1 := CSGBox3D.new(); w1.size = Vector3(1.1, 3.0, 2.3); w1.position = Vector3(-1.75, 2.5, -3.15); w1.material = pal("stone")
	var n1 := CSGBox3D.new(); n1.operation = CSGShape3D.OPERATION_SUBTRACTION; n1.size = Vector3(1.0, 2.2, 1.2)
	n1.position = Vector3(0.06, -0.4, 0.0); n1.material = pal("teal"); w1.add_child(n1); add_child(w1)
	cornice(-2.3, -4.3, -1.2, -2.0, 4.0)
	crenels(Vector3(-1.2, 4.06, -3.2), Vector3(-1.2, 4.06, -2.03), 0.29)
	crenels(Vector3(-2.2, 4.06, -2.03), Vector3(-1.5, 4.06, -2.03), 0.35)
	for fz in [-3.79, -2.55]: blk(Vector3(MX - 0.02, 1.0, fz), Vector3(MX + 0.03, 3.24, fz + 0.04), "dark")
	blk(Vector3(MX - 0.02, 3.2, -3.79), Vector3(MX + 0.03, 3.24, -2.51), "dark")
	var gq := QuadMesh.new(); gq.size = Vector2(1.2, 2.2)
	prim(gq, Vector3(MX - 0.012, 2.1, -3.15), mat(Color(0.62, 0.86, 0.92, 0.09))).rotation.y = PI * 0.5
	win_z(-1.75, 2.2, -2.0, 0.3, 0.8)
	var rq := QuadMesh.new(); rq.size = Vector2(2.4, 2.4)
	ripple = MeshInstance3D.new(); ripple.mesh = rq; ripple.rotation.y = PI * 0.5
	var sh := Shader.new()
	sh.code = "shader_type spatial;\nrender_mode unshaded, blend_add, cull_disabled;\nuniform float p = 1.0;\nvoid fragment(){ float d = distance(UV, vec2(0.5)) * 2.0; float ring = smoothstep(0.05, 0.0, abs(d - p)) + 0.5 * smoothstep(0.035, 0.0, abs(d - p * 0.6)); ALBEDO = vec3(1.0, 0.36, 0.40); ALPHA = ring * (1.0 - p); }"
	var sm := ShaderMaterial.new(); sm.shader = sh; ripple.material_override = sm; add_child(ripple)
	# slim domed tower on the mirror wall
	blk(Vector3(-2.2, 4.06, -4.2), Vector3(-1.45, 6.5, -3.45))
	cornice(-2.2, -4.2, -1.45, -3.45, 6.5)
	win_x(-1.45, 5.0, -3.825, 0.24, 0.66); win_z(-1.825, 5.0, -3.45, 0.24, 0.66)
	win_x(-1.45, 4.35, -3.825, 0.12, 0.3); win_z(-1.825, 4.35, -3.45, 0.12, 0.3)
	blk(Vector3(-2.12, 6.56, -4.12), Vector3(-1.53, 6.72, -3.53), "shade")
	dome(Vector3(-1.825, 6.72, -3.825), 0.3)
	# ---- door wall with an arched opening
	var w2 := CSGBox3D.new(); w2.size = Vector3(2.7, 2.7, 0.4); w2.position = Vector3(0.15, 2.35, -4.1); w2.material = pal("stone")
	var d1 := CSGBox3D.new(); d1.operation = CSGShape3D.OPERATION_SUBTRACTION; d1.size = Vector3(0.9, 1.6, 0.6)
	d1.position = Vector3(0.6, -0.55, 0); d1.material = pal("shade"); w2.add_child(d1)
	var d2 := CSGCylinder3D.new(); d2.operation = CSGShape3D.OPERATION_SUBTRACTION; d2.radius = 0.45; d2.height = 0.6; d2.sides = 32
	d2.rotation.x = PI * 0.5; d2.position = Vector3(0.6, 0.25, 0); d2.material = pal("shade"); w2.add_child(d2)
	add_child(w2)
	cornice(-1.2, -4.3, 1.5, -3.9, 3.7)
	crenels(Vector3(-1.05, 3.76, -3.93), Vector3(1.43, 3.76, -3.93), 0.31)
	blk(Vector3(0.28, 1.0, -4.29), Vector3(1.22, 3.1, -4.28), "cream")
	door = blk(Vector3(0.28, 1.0, -4.14), Vector3(1.22, 3.1, -4.06), "crim")
	blk(Vector3(-0.78, 2.05, -3.9), Vector3(-0.42, 3.2, -3.888), "crim")
	blk(Vector3(-0.83, 3.2, -3.9), Vector3(-0.37, 3.24, -3.87), "shade")
	win_z(-0.1, 2.2, -3.9, 0.16, 0.42)
	# tall slim tower behind the door wall
	blk(Vector3(0.85, -17, -4.95), Vector3(1.5, 8.0, -4.3))
	for wy in [4.4, 5.6, 6.8]:
		win_x(1.5, wy, -4.625, 0.18, 0.5); win_z(1.175, wy, -4.3, 0.18, 0.5)
	cornice(0.85, -4.95, 1.5, -4.3, 7.6, 0.04, 0.05)
	blk(Vector3(0.77, 8.0, -5.03), Vector3(1.58, 8.14, -4.22), "shade")
	crenels(Vector3(0.84, 8.14, -4.29), Vector3(1.51, 8.14, -4.29), 0.223, 0.1)
	crenels(Vector3(1.51, 8.14, -4.96), Vector3(1.51, 8.14, -4.52), 0.22, 0.1)
	cone(Vector3(1.175, 8.14, -4.625), 0.3, 0.95)
	var flag := PrismMesh.new(); flag.size = Vector3(0.22, 0.42, 0.008); flag.left_to_right = 0.5
	var fl := prim(flag, Vector3(1.39, 9.3, -4.625), pal("crim")); fl.rotation.z = -PI * 0.5
	# a thin bridge to the back and two far islets for depth
	blk(Vector3(-2.3, 0.9, -7.5), Vector3(-1.9, 1.0, -4.3), "far")
	for i in 5: win_x(-1.9, 0.0, -4.9 - i * 0.55, 0.3, 0.7, "far2")
	blk(Vector3(-2.3, -17, -7.5), Vector3(-1.9, 0.9, -4.3), "far")
	blk(Vector3(-3.0, -17, -9.2), Vector3(-1.5, 1.6, -7.5), "far")
	cornice(-3.0, -9.2, -1.5, -7.5, 1.6, 0.04, 0.06, "far2")
	blk(Vector3(-2.7, 1.66, -8.9), Vector3(-2.0, 4.6, -8.2), "far")
	win_x(-2.0, 3.4, -8.55, 0.2, 0.55, "far2"); win_z(-2.35, 3.4, -8.2, 0.2, 0.55, "far2")
	dome(Vector3(-2.35, 4.6, -8.55), 0.34)
	blk(Vector3(-7.3, -17, -3.3), Vector3(-6.5, 1.2, -2.5), "far2")
	cornice(-7.3, -3.3, -6.5, -2.5, 1.2, 0.04, 0.06, "far")
	blk(Vector3(-7.12, 1.26, -3.12), Vector3(-6.68, 3.3, -2.68), "far2")
	win_x(-6.68, 2.3, -2.9, 0.16, 0.45, "dark"); win_z(-6.9, 2.3, -2.68, 0.16, 0.45, "dark")
	cone(Vector3(-6.9, 3.3, -2.9), 0.27, 0.7)
	# ---- columns, lamp plinth, inlays
	for cx in [-1.4]:
		blk(Vector3(cx - 0.13, 0, 2.02), Vector3(cx + 0.13, 0.07, 2.28), "shade")
		var cm := CylinderMesh.new(); cm.top_radius = 0.065; cm.bottom_radius = 0.08; cm.height = 1.75; cm.radial_segments = 20
		prim(cm, Vector3(cx, 0.945, 2.15), pal("stone"))
		blk(Vector3(cx - 0.12, 1.82, 2.03), Vector3(cx + 0.12, 1.88, 2.27), "shade")
		var bs := SphereMesh.new(); bs.radius = 0.07; bs.height = 0.14; bs.radial_segments = 16; bs.rings = 8
		prim(bs, Vector3(cx, 1.95, 2.15), pal("crim"))
	var inl := CylinderMesh.new(); inl.top_radius = 0.5; inl.bottom_radius = 0.5; inl.height = 0.008; inl.radial_segments = 48
	prim(inl, Vector3(LAMP0.x, 0.004, LAMP0.z), pal("shade"))
	var inl2 := CylinderMesh.new(); inl2.top_radius = 0.42; inl2.bottom_radius = 0.42; inl2.height = 0.012; inl2.radial_segments = 48
	prim(inl2, Vector3(LAMP0.x, 0.006, LAMP0.z), pal("stone"))
	var slab := CylinderMesh.new(); slab.top_radius = 0.15; slab.bottom_radius = 0.19; slab.height = 0.12; slab.radial_segments = 32
	prim(slab, Vector3(LAMP0.x, 0.06, LAMP0.z), pal("shade"))
	blk(Vector3(-1.12, 1.0, -3.62), Vector3(-0.36, 1.006, -2.68), "shade")
	blk(Vector3(-1.07, 1.0, -3.57), Vector3(-0.41, 1.009, -2.73), "stone")
	blk(Vector3(0.72, 1.0, -3.86), Vector3(0.78, 1.006, -2.2), "crim")
	for mi in find_children("*", "GeometryInstance3D", true, false):
		(mi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _actors() -> void:
	fig = Fig.new(); add_child(fig); fig.build(false, pal)
	var mir := Node3D.new()
	mir.transform = Transform3D(Basis(Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1)), Vector3(2.0 * MX, 0, 0))
	add_child(mir)
	ghost = Fig.new(); mir.add_child(ghost); ghost.build(true, pal)
	var bq := QuadMesh.new(); bq.size = Vector2(0.95, 0.95); bq.orientation = PlaneMesh.FACE_Y
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	g.colors = PackedColorArray([Color(0.2, 0.17, 0.33, 0.34), Color(0.2, 0.17, 0.33, 0.2), Color(0.2, 0.17, 0.33, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 96; gt.height = 96
	var bmt := StandardMaterial3D.new(); bmt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; bmt.albedo_texture = gt
	bmt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	blob = prim(bq, Vector3.ZERO, bmt)
	lamp = Node3D.new(); add_child(lamp); lamp.position = LAMP0
	var core := SphereMesh.new(); core.radius = 0.05; core.height = 0.12
	lamp_core = prim(core, Vector3.ZERO, mat(Color("ffd98a")), lamp)
	var cap := CylinderMesh.new(); cap.top_radius = 0.01; cap.bottom_radius = 0.07; cap.height = 0.055; cap.radial_segments = 16
	prim(cap, Vector3(0, 0.082, 0), pal("dark"), lamp)
	var base := CylinderMesh.new(); base.top_radius = 0.055; base.bottom_radius = 0.04; base.height = 0.028; base.radial_segments = 16
	prim(base, Vector3(0, -0.068, 0), pal("dark"), lamp)
	var ring := TorusMesh.new(); ring.inner_radius = 0.02; ring.outer_radius = 0.031
	prim(ring, Vector3(0, 0.14, 0), pal("dark"), lamp).rotation.x = PI * 0.5
	lamp_halo = halo(1.0, Color(1.0, 0.78, 0.42, 0.55)); lamp.add_child(lamp_halo)
	door_halo = halo(3.2, Color(1.0, 0.86, 0.6, 0.5)); door_halo.position = Vector3(0.75, 2.0, -4.0); add_child(door_halo)

func _ui() -> void:
	var cl := CanvasLayer.new(); add_child(cl)
	var title := Label.new(); title.text = "EIDOLON  ·  μελέτη στυλ"; title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color(0.95, 0.92, 0.86, 0.85)); title.position = Vector2(24, 20); cl.add_child(title)
	caption = Label.new(); caption.add_theme_font_size_override("font_size", 20)
	caption.add_theme_color_override("font_color", Color(0.95, 0.92, 0.86, 0.8)); caption.position = Vector2(24, 50); cl.add_child(caption)
	var fr := ColorRect.new(); fr.color = Color("eadfce"); fr.position = Vector2(20, 796); fr.size = Vector2(348, 464); cl.add_child(fr)
	var svc := SubViewportContainer.new(); svc.position = Vector2(24, 800); svc.size = Vector2(340, 456); svc.stretch = true; cl.add_child(svc)
	var sv := SubViewport.new(); sv.msaa_3d = Viewport.MSAA_4X; sv.own_world_3d = false; svc.add_child(sv)
	cam2 = Camera3D.new(); cam2.projection = Camera3D.PROJECTION_ORTHOGONAL; cam2.size = 2.7; cam2.near = 0.1; cam2.far = 80.0
	cam2.rotation_degrees = Vector3(-35.264, 45, 0); cam2.cull_mask = 5; sv.add_child(cam2)
	var q2 := QuadMesh.new(); q2.size = Vector2(6, 6)
	var b2 := MeshInstance3D.new(); b2.mesh = q2; b2.position = Vector3(0, 0, -75); b2.layers = 4
	b2.material_override = mat(Color("2f3b60")); cam2.add_child(b2)
	var cu := Label.new(); cu.text = "κοντινό"; cu.add_theme_font_size_override("font_size", 16)
	cu.add_theme_color_override("font_color", Color(0.95, 0.92, 0.86, 0.85)); cu.position = Vector2(34, 806); cl.add_child(cu)

func ground(p: Vector3) -> float:
	var f := (-0.4 - p.z) / 1.6 * 8.0 + 0.35
	if f <= 0.0: return 0.0
	return minf(1.0, (floorf(f) + smoothstep(0.0, 0.35, f - floorf(f))) / 8.0)

func _process(dt: float) -> void:
	t += dt
	# --- locomotion
	var target := 0.0
	var want_yaw := yaw
	if not path.is_empty():
		var to := Vector3(path[0].x - pos.x, 0, path[0].z - pos.z)
		var left := to.length()
		for i in range(1, path.size()): left += Vector2(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z).length()
		var top := 1.0 if (pos.z < -0.3 and pos.z > -2.1) else WALK
		target = minf(top, sqrt(2.0 * 2.6 * left) + 0.04)
		want_yaw = atan2(to.x, to.z)
		var turn := absf(angle_difference(yaw, want_yaw))
		target *= clampf(1.25 - turn * 0.8, 0.25, 1.0)
		spd = move_toward(spd, target, 3.2 * dt)
		var step := spd * dt
		if step >= to.length():
			pos.x = path[0].x; pos.z = path[0].z; path.pop_front()
			if path.is_empty(): spd = 0.0; arrived.emit()
		else:
			var d := to.normalized(); pos.x += d.x * step; pos.z += d.z * step
		vel = Vector3(sin(yaw), 0, cos(yaw)) * spd
	else:
		spd = move_toward(spd, 0.0, 6.0 * dt); vel = Vector3.ZERO
		if face_to != null:
			want_yaw = atan2(face_to.x - pos.x, face_to.z - pos.z)
			if absf(angle_difference(yaw, want_yaw)) < 0.02: face_to = null; faced.emit()
	yaw = lerp_angle(yaw, want_yaw, 1.0 - exp(-8.0 * dt))
	pos.y = lerpf(pos.y, ground(pos), 1.0 - exp(-22.0 * dt))
	var wk := clampf(spd / WALK, 0.0, 1.0)
	phase += spd * dt / 0.60 * PI
	# --- secondary motion: the dress trails the body, then settles
	var lv := Vector2(vel.x * cos(yaw) - vel.z * sin(yaw), vel.x * sin(yaw) + vel.z * cos(yaw))
	var sway_t := -lv * 0.105
	sway_v += ((sway_t - sway) * 60.0 - sway_v * 7.0) * dt
	sway += sway_v * dt
	var hy := 0.0
	if look_at_pt != null:
		hy = clampf(angle_difference(yaw, atan2(look_at_pt.x - pos.x, look_at_pt.z - pos.z)), -1.0, 1.0)
	head_yaw = lerpf(head_yaw, hy, 1.0 - exp(-5.0 * dt))
	var breath := sin(t * 1.7)
	var st := {
		"pos": pos, "yaw": yaw,
		"bob": 0.02 * wk * (0.5 - 0.5 * cos(2.0 * phase)) + 0.004 * breath * (1.0 - wk),
		"drop": a_drop, "lean": 0.075 * wk + a_lean + 0.008 * breath,
		"roll": 0.028 * wk * sin(phase) + 0.01 * sin(t * 0.8) * (1.0 - wk), "twist": 0.07 * wk * sin(phase),
		"sway": sway, "pool": a_pool, "kick": wk * sin(phase),
		"head_yaw": head_yaw, "head_pitch": a_headp + 0.03 * wk,
		"swingL": 0.12 * wk * sin(phase) * (1.0 - a_wL), "swingR": -0.12 * wk * sin(phase),
		"hold": a_hold, "wL": a_wL, "wR": a_wR, "tL": tgtL, "tR": tgtR,
	}
	fig.apply(st); ghost.apply(st)
	# --- mirror double: only while she stands before the glass
	var near := smoothstep(-2.25, -2.6, pos.z) * smoothstep(-4.0, -3.7, pos.z) * smoothstep(0.9, 0.99, pos.y)
	ghost.visible = near > 0.01
	var prox := clampf(1.0 - (pos.x - MX - 0.5) / 1.4, 0.0, 1.0)
	flash = move_toward(flash, 0.0, dt * 0.7)
	ghost.ghost_mat.albedo_color = TEAL_D.lerp(CRIMSON, near * (0.3 + 0.7 * prox)).lerp(Color("ff5a62"), flash)
	ripple_p = move_toward(ripple_p, 1.0, dt * 0.75)
	(ripple.material_override as ShaderMaterial).set_shader_parameter("p", ripple_p)
	# --- lamp
	if lamp_held:
		var hang := -vel * 0.045
		lamp_vel += ((hang - lamp_off) * 40.0 - lamp_vel * 4.0) * dt
		lamp_off += lamp_vel * dt
		lamp.position = fig.hand_pos("R") + Vector3(0, -0.175, 0) + lamp_off
	var le := lamp_energy * (1.0 + 0.03 * sin(t * 9.0))
	lamp_halo.scale = Vector3.ONE * (0.35 + le * 1.5)
	door_halo.scale = Vector3.ONE * door_energy; door_halo.visible = door_energy > 0.01
	for m in pmats.values():
		m.set_shader_parameter("lamp_pos", lamp.position); m.set_shader_parameter("lamp_e", le)
		m.set_shader_parameter("door_pos", Vector3(0.75, 1.8, -3.9)); m.set_shader_parameter("door_e", door_energy)
	blob.position = Vector3(pos.x, pos.y + 0.012, pos.z); blob.scale = Vector3.ONE * (1.0 + a_pool * 0.6)
	cam2.position = cam2.position.lerp(pos + Vector3(0, 0.92, 0) + cam2.basis.z * 30.0, 1.0 - exp(-6.0 * dt))

func wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func walk(pts: Array) -> void:
	path.assign(pts)
	await arrived

func face(p: Vector3) -> void:
	face_to = p
	await faced

func tw() -> Tween:
	return create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _run() -> void:
	cam2.position = pos + Vector3(0, 0.92, 0) + cam2.basis.z * 30.0
	caption.text = "ηρεμία"
	await wait(1.3)
	look_at_pt = LAMP0
	await wait(0.7)
	caption.text = "περπάτημα"
	await walk([Vector3(-0.70, 0, 1.36)])
	await face(LAMP0)
	caption.text = "γονατίζει · παίρνει τη λάμπα"
	tgtR = LAMP0 + Vector3(0, 0.15, 0)
	var a := tw()
	a.tween_property(self, "a_drop", 0.55, 0.85); a.tween_property(self, "a_lean", 0.50, 0.85)
	a.tween_property(self, "a_pool", 1.0, 0.85); a.tween_property(self, "a_headp", 0.35, 0.7)
	a.tween_property(self, "a_wR", 1.0, 0.75).set_delay(0.2)
	await a.finished
	await wait(0.2)
	lamp_held = true
	var b := tw()
	b.tween_property(self, "lamp_energy", 1.0, 0.9)
	b.tween_property(self, "a_drop", 0.0, 0.95); b.tween_property(self, "a_lean", 0.0, 0.95)
	b.tween_property(self, "a_pool", 0.0, 0.95); b.tween_property(self, "a_headp", 0.0, 0.8)
	b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_hold", 1.0, 0.8)
	await b.finished
	look_at_pt = null
	await wait(0.5)
	caption.text = "με τη λάμπα · σκάλες"
	await walk([Vector3(0.2, 0, -0.15), Vector3(0.2, 1, -2.3), Vector3(-0.68, 1, -3.15)])
	await face(Vector3(MX, 1, -3.15))
	caption.text = "αγγίζει το γυαλί"
	tgtL = Vector3(MX + 0.012, 2.30, -3.02)
	ripple.position = Vector3(MX - 0.03, 2.30, -3.02)
	var c := tw()
	c.tween_property(self, "a_wL", 1.0, 0.8); c.tween_property(self, "a_lean", 0.09, 0.8)
	await c.finished
	ripple_p = 0.0; flash = 1.0
	var d := tw()
	d.tween_property(door, "position:y", door.position.y - 2.15, 1.7).set_delay(0.3)
	d.tween_property(self, "door_energy", 1.0, 1.7).set_delay(0.3)
	await wait(1.5)
	var e := tw()
	e.tween_property(self, "a_wL", 0.0, 0.7); e.tween_property(self, "a_lean", 0.0, 0.7)
	look_at_pt = Vector3(0.75, 2, -4.2)
	await e.finished
	caption.text = "η πόρτα ανοίγει"
	await walk([Vector3(0.75, 1, -3.3), Vector3(0.75, 1, -4.75)])
	await wait(1.2)
	get_tree().quit()
