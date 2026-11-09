extends Node3D
## EIDOLON style study v3 (continuous map, impossible architecture): fine-scale isometric architecture, flat hand-picked colours per face (no lighting),
## rigid-part heroine with procedural animation.
const Fig := preload("res://fig.gd")
const MX := -11.2
const LAMP0 := Vector3(-6.3, 1.17, -1.6)
const CAP := Vector3(0.35, 1.0, -2.9)
const PIV := Vector3(-2.4, 1.0, -2.8)
const K := Vector3(1.6, 1.6, 1.6)
const WALK := 1.4
const TEAL_D := Color("13283a")
const CRIMSON := Color("b8232f")
const FOG := Color("e9c3a6")
const PALS := {
	"stone": ["f7eee0", "e7d4c4", "ada5c0"], "shade": ["eaddcb", "d6c0b0", "9c94b0"],
	"far": ["cfcbd6", "bab5c9", "9896b4"], "far2": ["b4b3c9", "a3a1bf", "8a8aad"],
	"dark": ["5a5678", "4d4a6e", "44416a"], "crim": ["dc3d46", "bb2530", "7e1c31"],
	"teal": ["13283a", "13283a", "13283a"], "water": ["d6f1ea", "c2e8e0", "a9d6d3"],
	"cream": ["fff3d2", "fff3d2", "fff3d2"], "rose": ["efc3b4", "dba595", "a47e93"],
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
	vec3 vd = vec3(0.57735); vec3 dl = wp - lamp_pos; vec3 dd = wp - door_pos;
	float l = lamp_e * pow(clamp(1.0 - length(dl - vd * dot(dl, vd)) / 2.9, 0.0, 1.0), 2.0);
	l += door_e * pow(clamp(1.0 - length(dd - vd * dot(dd, vd)) / 2.4, 0.0, 1.0), 2.0);
	col = mix(col, col * vec3(1.06, 0.97, 0.80) + vec3(0.09, 0.055, 0.0), clamp(l, 0.0, 1.0) * 0.85);
	ALBEDO = col;
}"""

var shader: Shader
var shader2: Shader
var pmats := {}
var umats := {}
var fig: Node3D
var ghost: Node3D
var lamp: Node3D
var lamp_halo: MeshInstance3D
var door_halo: MeshInstance3D
var blob: MeshInstance3D
var pulse: MeshInstance3D
var pulse_p := 1.0
var lamp_held := false
var lamp_energy := 0.22
var door_energy := 0.0
var lamp_off := Vector3.ZERO
var lamp_vel := Vector3.ZERO
var cam: Camera3D
var cam2: Camera3D
var cam_t := Vector3.ZERO
var door: MeshInstance3D
var ripple: MeshInstance3D
var ripple_p := 1.0
var flash := 0.0
var caption: Label
var cap_rot: Node3D
var bridge: Node3D
var pushing := false

var pos := Vector3(1.0, 0, 1.9)
var gy := 0.0
var yaw := -2.2
var spd := 0.0
var vel := Vector3.ZERO
var route: Array = []
var seg_a := Vector3.ZERO
var speed_cap := WALK
var face_to = null
var look_at_pt = null
var phase := 0.0
var t := 0.0
var sway := Vector2.ZERO
var sway_v := Vector2.ZERO
var head_yaw := 0.0
var a_hy := 0.0
var a_drop := 0.0
var a_lean := 0.0
var a_pool := 0.0
var a_hold := 0.0
var a_raise := 0.0
var a_open := 0.0
var a_headp := 0.0
var a_wL := 0.0
var a_wR := 0.0
var tgtL := Vector3.ZERO
var tgtR := Vector3.ZERO
signal arrived
signal faced

func pal(n: String, two := false) -> ShaderMaterial:
	var key := n + ("|2" if two else "")
	if pmats.has(key): return pmats[key]
	var m := ShaderMaterial.new(); m.shader = shader2 if two else shader
	m.set_shader_parameter("c_top", Color(PALS[n][0])); m.set_shader_parameter("c_z", Color(PALS[n][1]))
	m.set_shader_parameter("c_x", Color(PALS[n][2])); m.set_shader_parameter("fog_col", FOG)
	pmats[key] = m
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

func slab(x0: float, z0: float, x1: float, z1: float, y: float, p := "stone", parent: Node = self) -> void:
	blk(Vector3(x0, y - 0.13, z0), Vector3(x1, y, z1), p, parent)
	blk(Vector3(x0 - 0.03, y - 0.18, z0 - 0.03), Vector3(x1 + 0.03, y - 0.13, z1 + 0.03), "shade", parent)

func pier(x: float, z: float, top: float, w := 0.5, p := "stone") -> void:
	var h := w * 0.5
	blk(Vector3(x - h, -26, z - h), Vector3(x + h, top, z + h), p)
	win_z(x, top - 1.35, z + h, w * 0.46, 0.8); win_x(x + h, top - 1.35, z, w * 0.46, 0.8)
	cornice(x - h, z - h, x + h, z + h, top - 1.75, 0.035, 0.06)

func col_faces(c: Vector3, hw: float, y0: float, y1: float, p := "stone") -> void:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	var a := [Vector3(c.x + hw, y0, c.z + hw), Vector3(c.x + hw, y0, c.z - hw), Vector3(c.x + hw, y1, c.z - hw), Vector3(c.x + hw, y1, c.z + hw)]
	var b := [Vector3(c.x - hw, y0, c.z + hw), Vector3(c.x + hw, y0, c.z + hw), Vector3(c.x + hw, y1, c.z + hw), Vector3(c.x - hw, y1, c.z + hw)]
	for q in [[a, Vector3.RIGHT], [b, Vector3.BACK]]:
		for i in [0, 1, 2, 0, 2, 3]:
			v.append(q[0][i]); n.append(q[1])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, pal(p, true))

func wall_to(a: Vector3, b: Vector3, hw: float, top: float, p := "stone") -> void:
	blk(Vector3(minf(a.x, b.x) - hw, -26, minf(a.z, b.z) - hw), Vector3(maxf(a.x, b.x) + hw, top, maxf(a.z, b.z) + hw), p)

## one side of the endless stair: corner landing, four steps, then level to the next corner
func flight(ca: Vector3, dir: Vector3, length: float) -> void:
	var hw := 0.35
	wall_to(ca, ca, hw, ca.y)
	for i in 4:
		var d0 := hw + 0.25 * i
		var a := ca + dir * (d0 + hw); var b := ca + dir * (d0 + 0.25 - hw)
		blk(Vector3(minf(a.x, b.x) - hw * absf(dir.z) - hw * absf(dir.x) , -26, minf(a.z, b.z) - hw * absf(dir.x) - hw * absf(dir.z)),
			Vector3(maxf(a.x, b.x) + hw * absf(dir.z) + hw * absf(dir.x), ca.y + 0.1 * (i + 1), maxf(a.z, b.z) + hw * absf(dir.x) + hw * absf(dir.z)))
	wall_to(ca + dir * (1.35 + hw), ca + dir * (length - 2.0 * hw), hw, ca.y + 0.4)

func float_steps(o: Vector3, n: int, dir: Vector3, p := "far") -> void:
	for i in n:
		var c := o + dir * (0.34 * i) + Vector3(0, 0.3 * i, 0)
		blk(c - Vector3(0.17, 0.13, 0.17), c + Vector3(0.17, 0.13, 0.17), p)

func _ready() -> void:
	shader = Shader.new(); shader.code = SH
	shader2 = Shader.new(); shader2.code = SH.replace("render_mode unshaded;", "render_mode unshaded, cull_disabled;")
	_env(); _world(); _actors(); _ui()
	cam_t = pos
	_run()

func _env() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color("2f3b60")
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 11.0 * 1280.0 / 720.0; cam.near = 0.1; cam.far = 150.0
	cam.rotation_degrees = Vector3(-35.264, 45, 0)
	add_child(cam); cam.current = true; cam.cull_mask = 3
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.42, 0.78, 1.0])
	g.colors = PackedColorArray([Color("1d2a4a"), Color("46557c"), Color("b88f95"), FOG])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill_from = Vector2(0, 0); gt.fill_to = Vector2(0, 1); gt.width = 8; gt.height = 256
	var qm := QuadMesh.new(); qm.size = Vector2(12.5, 21)
	var bm := StandardMaterial3D.new(); bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; bm.albedo_texture = gt
	prim(qm, Vector3(0, 0, -140), bm, cam).layers = 2
	var g2 := Gradient.new()
	g2.offsets = PackedFloat32Array([0.0, 0.70, 0.93, 1.0])
	g2.colors = PackedColorArray([Color(FOG.r, FOG.g, FOG.b, 0), Color(FOG.r, FOG.g, FOG.b, 0), Color(FOG.r, FOG.g, FOG.b, 0.88), Color(FOG.r, FOG.g, FOG.b, 1)])
	var gt2 := GradientTexture2D.new(); gt2.gradient = g2; gt2.fill_from = Vector2(0, 0); gt2.fill_to = Vector2(0, 1); gt2.width = 8; gt2.height = 256
	var mm := StandardMaterial3D.new(); mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mm.albedo_texture = gt2
	mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; mm.no_depth_test = true; mm.render_priority = 10
	prim(qm, Vector3(0, 0, -1), mm, cam).layers = 2
	var motes := CPUParticles3D.new()
	motes.amount = 70; motes.lifetime = 10.0; motes.preprocess = 10.0
	motes.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX; motes.emission_box_extents = Vector3(6, 0.5, 11)
	motes.position = Vector3(0, 0, -20); motes.gravity = Vector3.ZERO; motes.initial_velocity_min = 0.02; motes.initial_velocity_max = 0.06
	motes.spread = 180.0; motes.scale_amount_min = 0.5; motes.scale_amount_max = 1.1; motes.rotation.x = PI * 0.5
	var pq := QuadMesh.new(); pq.size = Vector2(0.03, 0.03)
	var pmat := StandardMaterial3D.new(); pmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	pmat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; pmat.albedo_color = Color(1, 0.94, 0.84, 0.55)
	pmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pq.material = pmat; motes.mesh = pq; motes.layers = 2
	cam.add_child(motes)

func _world() -> void:
	# ---- 1. the first terrace
	slab(-1.7, -0.4, 1.5, 2.5, 0.0)
	blk(Vector3(-1.5, -0.34, -0.2), Vector3(1.3, -0.18, 2.3))
	blk(Vector3(-1.3, -0.5, 0.0), Vector3(1.1, -0.34, 2.1), "shade")
	blk(Vector3(-1.1, -26, 0.2), Vector3(0.9, -0.5, 1.9))
	for wx in [-0.6, 0.4]: win_z(wx, -1.9, 1.9, 0.44, 1.05)
	for wz in [0.65, 1.45]: win_x(0.9, -1.9, wz, 0.44, 1.05)
	cornice(-1.1, 0.2, 0.9, 1.9, -2.45, 0.04, 0.07)
	for i in 3:
		blk(Vector3(-1.6, 0, 0.3 + i * 0.75), Vector3(1.4, 0.004, 0.32 + i * 0.75), "shade")
		blk(Vector3(-0.95 + i * 0.85, 0, -0.3), Vector3(-0.93 + i * 0.85, 0.004, 2.4), "shade")
	crenels(Vector3(-1.63, 0, -0.33), Vector3(-1.63, 0, 2.43), 0.345)
	crenels(Vector3(-1.3, 0, -0.33), Vector3(-0.42, 0, -0.33), 0.29)
	crenels(Vector3(0.84, 0, -0.33), Vector3(1.43, 0, -0.33), 0.295)
	slab(1.5, 0.7, 2.2, 1.6, 0.0)
	var post := CylinderMesh.new(); post.top_radius = 0.018; post.bottom_radius = 0.026; post.height = 1.5; post.radial_segments = 10
	prim(post, Vector3(2.05, 0.75, 0.85), pal("shade"))
	blk(Vector3(1.8, 1.44, 0.835), Vector3(2.07, 1.47, 0.865), "shade")
	blk(Vector3(1.78, 1.2, 0.81), Vector3(1.86, 1.42, 0.89), "crim")
	blk(Vector3(-1.53, 0, 2.02), Vector3(-1.27, 0.07, 2.28), "shade")
	var cm := CylinderMesh.new(); cm.top_radius = 0.065; cm.bottom_radius = 0.08; cm.height = 1.75; cm.radial_segments = 20
	prim(cm, Vector3(-1.4, 0.945, 2.15), pal("stone"))
	blk(Vector3(-1.52, 1.82, 2.03), Vector3(-1.28, 1.88, 2.27), "shade")
	# a doorway lying on its side and a stair that climbs the wall: nobody could use them
	blk(Vector3(-0.2, -3.6, 1.9), Vector3(0.5, -3.3, 1.912), "dark")
	for i in 6: blk(Vector3(-1.0 + 0.2 * i, -3.2 + 0.16 * i, 1.9), Vector3(-0.8 + 0.2 * i, -3.12 + 0.16 * i, 2.05), "shade")
	# ---- floating stairs up to the capstan landing
	for i in 8:
		blk(Vector3(-0.2, 0.125 * (i + 1) - 0.1, -0.4 - 0.2 * (i + 1)), Vector3(0.6, 0.125 * (i + 1), -0.4 - 0.2 * i))
		blk(Vector3(-0.2, 0.125 * (i + 1) - 0.34, -0.4 - 0.2 * (i + 1)), Vector3(-0.14, 0.125 * (i + 1) - 0.1, -0.4 - 0.2 * i), "shade")
		blk(Vector3(0.54, 0.125 * (i + 1) - 0.34, -0.4 - 0.2 * (i + 1)), Vector3(0.6, 0.125 * (i + 1) - 0.1, -0.4 - 0.2 * i), "shade")
	slab(-0.7, -3.6, 1.1, -2.0, 1.0)
	blk(Vector3(-0.5, -26, -3.4), Vector3(0.9, 0.82, -2.2))
	win_z(0.72, -0.4, -2.2, 0.26, 0.8); win_z(-0.36, -0.4, -2.2, 0.2, 0.6)
	for wz in [-2.6, -3.0]: win_x(0.9, -0.4, wz, 0.26, 0.8)
	cornice(-0.5, -3.4, 0.9, -2.2, -0.85, 0.035, 0.06)
	for i in 5: blk(Vector3(0.9, -1.3 - 0.2 * i, -2.5 - 0.18 * i), Vector3(1.04, -1.22 - 0.2 * i, -2.32 - 0.18 * i), "shade")
	crenels(Vector3(1.03, 1.0, -3.52), Vector3(1.03, 1.0, -2.08), 0.36)
	# capstan
	var cd := CylinderMesh.new(); cd.top_radius = 0.26; cd.bottom_radius = 0.3; cd.height = 0.05; cd.radial_segments = 32
	prim(cd, CAP + Vector3(0, 0.025, 0), pal("shade"))
	var cp := CylinderMesh.new(); cp.top_radius = 0.05; cp.bottom_radius = 0.065; cp.height = 1.0; cp.radial_segments = 16
	prim(cp, CAP + Vector3(0, 0.5, 0), pal("stone"))
	cap_rot = Node3D.new(); cap_rot.position = CAP + Vector3(0, 0.98, 0); cap_rot.rotation.y = -0.42; add_child(cap_rot)
	blk(Vector3(-0.022, -0.022, -0.2), Vector3(0.022, 0.022, 0.84), "dark", cap_rot)
	var kn := SphereMesh.new(); kn.radius = 0.045; kn.height = 0.09; kn.radial_segments = 14; kn.rings = 7
	prim(kn, Vector3(0, 0, 0.86), pal("crim"), cap_rot); prim(kn, Vector3(0, 0.06, 0), pal("crim"), cap_rot)
	# ---- 2. the turning bridge and the long bridge
	slab(-1.4, -3.2, -0.7, -2.4, 1.0)
	bridge = Node3D.new(); bridge.position = PIV; bridge.rotation.y = PI * 0.5; add_child(bridge)
	slab(-1.0, -0.4, 1.0, 0.4, 0.0, "stone", bridge)
	blk(Vector3(-0.92, 0, -0.03), Vector3(0.92, 0.004, 0.03), "crim", bridge)
	var pc := CylinderMesh.new(); pc.top_radius = 0.2; pc.bottom_radius = 0.2; pc.height = 26.0; pc.radial_segments = 24
	prim(pc, PIV + Vector3(0, -13.2, 0), pal("stone"))
	var pd := CylinderMesh.new(); pd.top_radius = 0.3; pd.bottom_radius = 0.22; pd.height = 0.12; pd.radial_segments = 24
	prim(pd, PIV + Vector3(0, -0.25, 0), pal("shade"))
	slab(-6.0, -3.2, -3.4, -2.4, 1.0)
	pier(-3.75, -2.8, 0.82, 0.5); pier(-5.65, -2.8, 0.82, 0.5)
	for i in 6: blk(Vector3(-5.35 + 0.22 * i, 0.82 - 0.11 * (6 - i), -3.1), Vector3(-5.13 + 0.22 * i, 0.82, -2.5), "shade")
	# ---- 3. the lamp platform and the impossible triangle
	slab(-7.2, -3.2, -6.0, -1.2, 1.0)
	blk(Vector3(-7.0, -26, -3.0), Vector3(-6.2, 0.82, -1.4))
	win_z(-6.6, -0.4, -1.4, 0.3, 0.85); win_x(-6.2, -0.4, -1.9, 0.26, 0.8); win_x(-6.2, -0.4, -2.55, 0.26, 0.8)
	cornice(-7.0, -3.0, -6.2, -1.4, -0.85, 0.035, 0.06)
	var inl := CylinderMesh.new(); inl.top_radius = 0.36; inl.bottom_radius = 0.36; inl.height = 0.008; inl.radial_segments = 40
	prim(inl, Vector3(LAMP0.x, 1.004, LAMP0.z), pal("shade"))
	var plinth := CylinderMesh.new(); plinth.top_radius = 0.13; plinth.bottom_radius = 0.17; plinth.height = 0.12; plinth.radial_segments = 28
	prim(plinth, Vector3(LAMP0.x, 1.06, LAMP0.z), pal("shade"))
	slab(-10.35, -3.2, -7.2, -2.4, 1.0)
	slab(-10.35, -6.7, -9.55, -3.2, 1.0)
	pier(-9.95, -2.8, 0.82, 0.5); pier(-8.6, -2.8, 0.82, 0.4)
	# the column: its foot stands on the platform, its head carries the far end of the same level road
	blk(Vector3(-7.0, 1.0, -2.76), Vector3(-6.6, 1.07, -2.36), "shade")
	col_faces(Vector3(-6.8, 0, -2.56), 0.14, 1.07, 2.5)
	col_faces(Vector3(-9.8, 0, -5.56), 0.14, -0.5, 0.74)
	blk(Vector3(-10.0, 0.74, -5.76), Vector3(-9.6, 0.82, -5.36), "shade")
	# ---- 4. the endless stair around a deep court
	var c3 := Vector3(-8.6, 1.0, -7.1)
	var c0 := c3 + Vector3(2.0, -1.2, -1.6); var c1 := c0 + Vector3(0, 0.4, -2.0); var c2 := c1 + Vector3(-2.0, 0.4, 0)
	flight(c3, Vector3.RIGHT, 3.6); wall_to(c3 + Vector3(3.6, 0, 0), c3 + Vector3(3.6, 0, 0), 0.35, c3.y + 0.4)
	flight(c0, Vector3.FORWARD, 2.0); flight(c1, Vector3.LEFT, 2.0); flight(c2, Vector3.BACK, 3.6)
	for wx in [-7.9, -7.0, -6.1, -5.2]: win_z(wx, -0.9, -6.75, 0.3, 0.9)
	blk(Vector3(-8.2, -2.2, -6.75), Vector3(-7.3, -1.9, -6.738), "dark")
	for i in 7: blk(Vector3(-7.0 + 0.2 * i, -2.6 + 0.17 * i, -6.75), Vector3(-6.8 + 0.2 * i, -2.52 + 0.17 * i, -6.6), "shade")
	blk(Vector3(-5.6, -1.6, -6.75), Vector3(-5.2, -1.52, -6.5), "shade"); win_z(-5.4, -1.52, -6.75, 0.26, 0.7)
	# ---- 5. the mirror terrace
	slab(-12.3, -8.6, -8.95, -6.7, 1.0)
	blk(Vector3(-12.1, -26, -8.4), Vector3(-9.15, 0.82, -6.9))
	for wx in [-11.5, -10.7, -9.9]: win_z(wx, -0.5, -6.9, 0.34, 0.95)
	cornice(-12.1, -8.4, -9.15, -6.9, -0.95, 0.035, 0.06)
	var w1 := CSGBox3D.new(); w1.size = Vector3(1.1, 3.0, 1.9); w1.position = Vector3(-11.75, 2.5, -7.65); w1.material = pal("stone")
	var n1 := CSGBox3D.new(); n1.operation = CSGShape3D.OPERATION_SUBTRACTION; n1.size = Vector3(1.0, 2.2, 1.2)
	n1.position = Vector3(0.06, -0.4, 0.0); n1.material = pal("teal"); w1.add_child(n1); add_child(w1)
	cornice(-12.3, -8.6, -11.2, -6.7, 4.0)
	crenels(Vector3(-11.2, 4.06, -8.5), Vector3(-11.2, 4.06, -6.78), 0.287)
	for fz in [-8.29, -7.05]: blk(Vector3(MX - 0.02, 1.0, fz), Vector3(MX + 0.03, 3.24, fz + 0.04), "dark")
	blk(Vector3(MX - 0.02, 3.2, -8.29), Vector3(MX + 0.03, 3.24, -7.01), "dark")
	var gq := QuadMesh.new(); gq.size = Vector2(1.2, 2.2)
	prim(gq, Vector3(MX - 0.012, 2.1, -7.65), mat(Color(0.62, 0.86, 0.92, 0.09))).rotation.y = PI * 0.5
	win_z(-11.75, 2.2, -6.7, 0.3, 0.8)
	var rq := QuadMesh.new(); rq.size = Vector2(2.4, 2.4)
	ripple = MeshInstance3D.new(); ripple.mesh = rq; ripple.rotation.y = PI * 0.5
	var sh := Shader.new()
	sh.code = "shader_type spatial;\nrender_mode unshaded, blend_add, cull_disabled;\nuniform float p = 1.0; uniform vec3 tint = vec3(1.0, 0.36, 0.40);\nvoid fragment(){ float d = distance(UV, vec2(0.5)) * 2.0; float ring = smoothstep(0.05, 0.0, abs(d - p)) + 0.5 * smoothstep(0.035, 0.0, abs(d - p * 0.6)); ALBEDO = tint; ALPHA = ring * (1.0 - p); }"
	var sm := ShaderMaterial.new(); sm.shader = sh; ripple.material_override = sm; add_child(ripple)
	var pq2 := QuadMesh.new(); pq2.size = Vector2(7, 7); pq2.orientation = PlaneMesh.FACE_Y
	var sm2 := ShaderMaterial.new(); sm2.shader = sh; sm2.set_shader_parameter("tint", Vector3(1.0, 0.8, 0.45)); sm2.render_priority = 2
	pulse = prim(pq2, Vector3.ZERO, sm2)
	var w2 := CSGBox3D.new(); w2.size = Vector3(2.25, 2.7, 0.4); w2.position = Vector3(-10.075, 2.35, -8.4); w2.material = pal("stone")
	var d1 := CSGBox3D.new(); d1.operation = CSGShape3D.OPERATION_SUBTRACTION; d1.size = Vector3(0.9, 1.6, 0.6)
	d1.position = Vector3(0.075, -0.55, 0); d1.material = pal("shade"); w2.add_child(d1)
	var d2 := CSGCylinder3D.new(); d2.operation = CSGShape3D.OPERATION_SUBTRACTION; d2.radius = 0.45; d2.height = 0.6; d2.sides = 32
	d2.rotation.x = PI * 0.5; d2.position = Vector3(0.075, 0.25, 0); d2.material = pal("shade"); w2.add_child(d2)
	add_child(w2)
	cornice(-11.2, -8.6, -8.95, -8.2, 3.7)
	crenels(Vector3(-11.05, 3.76, -8.23), Vector3(-9.03, 3.76, -8.23), 0.288)
	blk(Vector3(-10.47, 1.0, -8.59), Vector3(-9.53, 3.1, -8.58), "cream")
	door = blk(Vector3(-10.47, 1.0, -8.44), Vector3(-9.53, 3.1, -8.36), "crim")
	blk(Vector3(-9.42, 2.05, -8.2), Vector3(-9.12, 3.2, -8.188), "crim")
	blk(Vector3(-9.46, 3.2, -8.2), Vector3(-9.08, 3.24, -8.17), "shade")
	blk(Vector3(-11.12, 1.0, -8.12), Vector3(-10.36, 1.006, -7.18), "shade")
	blk(Vector3(-11.07, 1.0, -8.07), Vector3(-10.41, 1.009, -7.23), "stone")
	blk(Vector3(-10.03, 1.0, -8.2), Vector3(-9.97, 1.006, -6.8), "crim")
	# ---- fragments adrift: stairs and doorways that lead nowhere
	for fr in [[Vector3(3.3, -0.4, -5.6), Vector3.LEFT, "far"], [Vector3(-12.6, 1.6, -2.4), Vector3.RIGHT, "far"],
			[Vector3(-8.4, 4.2, -13.6), Vector3.LEFT, "far2"], [Vector3(-15.2, 3.0, -9.6), Vector3.RIGHT, "far2"]]:
		var o: Vector3 = fr[0]
		blk(o + Vector3(-0.6, -0.14, -0.5), o + Vector3(0.6, 0, 0.5), fr[2])
		blk(o + Vector3(-0.63, -0.2, -0.53), o + Vector3(0.63, -0.14, 0.53), "far2" if fr[2] == "far" else "far")
		blk(o + Vector3(-0.45, 0, -0.42), o + Vector3(0.45, 0.95, -0.12), fr[2])
		win_z(o.x, o.y, o.z - 0.12, 0.34, 0.74, "dark")
		float_steps(o + fr[1] * 0.75 + Vector3(0, 0.17, 0.25), 5, fr[1], fr[2])
		for i in 4: blk(o + Vector3(-0.5 + 0.2 * i, -0.2 - 0.12 * (i + 1), -0.3), o + Vector3(-0.3 + 0.2 * i, -0.2, 0.3), fr[2])
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
	prim(core, Vector3.ZERO, mat(Color("ffd98a")), lamp)
	var cap := CylinderMesh.new(); cap.top_radius = 0.01; cap.bottom_radius = 0.07; cap.height = 0.055; cap.radial_segments = 16
	prim(cap, Vector3(0, 0.082, 0), pal("dark"), lamp)
	var base := CylinderMesh.new(); base.top_radius = 0.055; base.bottom_radius = 0.04; base.height = 0.028; base.radial_segments = 16
	prim(base, Vector3(0, -0.068, 0), pal("dark"), lamp)
	var ring := TorusMesh.new(); ring.inner_radius = 0.02; ring.outer_radius = 0.031
	prim(ring, Vector3(0, 0.14, 0), pal("dark"), lamp).rotation.x = PI * 0.5
	lamp_halo = halo(1.0, Color(1.0, 0.78, 0.42, 0.55)); lamp.add_child(lamp_halo)
	door_halo = halo(3.2, Color(1.0, 0.86, 0.6, 0.5)); door_halo.position = Vector3(-10.0, 2.0, -8.3); add_child(door_halo)

func _ui() -> void:
	var cl := CanvasLayer.new(); add_child(cl)
	var tg := Gradient.new(); tg.colors = PackedColorArray([Color(0.09, 0.12, 0.24, 0.7), Color(0.09, 0.12, 0.24, 0)])
	var tt := GradientTexture2D.new(); tt.gradient = tg; tt.fill_from = Vector2(0, 0); tt.fill_to = Vector2(0, 1); tt.width = 8; tt.height = 64
	var band := TextureRect.new(); band.texture = tt; band.stretch_mode = TextureRect.STRETCH_SCALE; band.position = Vector2.ZERO; band.size = Vector2(720, 120); cl.add_child(band)
	var title := Label.new(); title.text = "EIDOLON  ·  μελέτη στυλ  ·  συνεχόμενος χάρτης"; title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color(0.95, 0.92, 0.86, 0.85)); title.position = Vector2(24, 20); cl.add_child(title)
	caption = Label.new(); caption.add_theme_font_size_override("font_size", 20)
	caption.add_theme_color_override("font_color", Color(1.0, 0.86, 0.6, 0.95)); caption.position = Vector2(24, 48); cl.add_child(caption)
	var fr := ColorRect.new(); fr.color = Color("eadfce"); fr.position = Vector2(20, 876); fr.size = Vector2(288, 384); cl.add_child(fr)
	var svc := SubViewportContainer.new(); svc.position = Vector2(24, 880); svc.size = Vector2(280, 376); svc.stretch = true; cl.add_child(svc)
	var sv := SubViewport.new(); sv.msaa_3d = Viewport.MSAA_4X; sv.own_world_3d = false; svc.add_child(sv)
	cam2 = Camera3D.new(); cam2.projection = Camera3D.PROJECTION_ORTHOGONAL; cam2.size = 2.8; cam2.near = 0.1; cam2.far = 150.0
	cam2.rotation_degrees = Vector3(-35.264, 45, 0); cam2.cull_mask = 5; sv.add_child(cam2)
	var q2 := QuadMesh.new(); q2.size = Vector2(6, 6)
	prim(q2, Vector3(0, 0, -140), mat(Color("2f3b60")), cam2).layers = 4
	var cu := Label.new(); cu.text = "κοντινό"; cu.add_theme_font_size_override("font_size", 15)
	cu.add_theme_color_override("font_color", Color(0.95, 0.92, 0.86, 0.85)); cu.position = Vector2(34, 886); cl.add_child(cu)

func _teleport(d: Vector3) -> void:
	pos += d; gy += d.y; seg_a += d; cam_t += d
	cam2.position += d

func _process(dt: float) -> void:
	t += dt
	var target := 0.0
	var want_yaw := yaw
	if not route.is_empty():
		var wp: Dictionary = route[0]
		var p3: Vector3 = wp.p
		var to := Vector3(p3.x - pos.x, 0, p3.z - pos.z)
		var left := to.length()
		for i in range(1, mini(route.size(), 4)): left += Vector2(route[i].p.x - route[i - 1].p.x, route[i].p.z - route[i - 1].p.z).length()
		var n: int = wp.get("steps", 0)
		target = minf(speed_cap * (0.74 if n > 0 else 1.0), sqrt(2.0 * 2.6 * left) + 0.04)
		if to.length() > 0.02: want_yaw = atan2(to.x, to.z)
		target *= clampf(1.25 - absf(angle_difference(yaw, want_yaw)) * 0.8, 0.25, 1.0)
		spd = move_toward(spd, target, (3.2 if speed_cap <= WALK else 5.0) * dt)
		var step := spd * dt
		if step >= to.length():
			pos.x = p3.x; pos.z = p3.z; gy = p3.y; seg_a = p3
			route.pop_front()
			if wp.has("tp"): _teleport(wp.tp)
			if route.is_empty(): spd = 0.0; arrived.emit()
		else:
			var d := to.normalized(); pos.x += d.x * step; pos.z += d.z * step
			var sl := Vector2(p3.x - seg_a.x, p3.z - seg_a.z).length()
			var fr := clampf(1.0 - to.length() / maxf(sl, 0.001), 0.0, 1.0)
			if n > 0:
				var f := minf(float(n), fr * n + 0.5)
				gy = seg_a.y + minf(float(n), floorf(f) + smoothstep(0.0, 0.4, f - floorf(f))) * (p3.y - seg_a.y) / n
			else:
				gy = lerpf(seg_a.y, p3.y, fr)
		vel = Vector3(sin(yaw), 0, cos(yaw)) * spd
	else:
		spd = move_toward(spd, 0.0, 6.0 * dt); vel = Vector3.ZERO
		if face_to != null:
			want_yaw = atan2(face_to.x - pos.x, face_to.z - pos.z)
			if absf(angle_difference(yaw, want_yaw)) < 0.02: face_to = null; faced.emit()
	yaw = lerp_angle(yaw, want_yaw, 1.0 - exp(-8.0 * dt))
	pos.y = lerpf(pos.y, gy, 1.0 - exp(-22.0 * dt))
	var wk := clampf(spd / WALK, 0.0, 1.0)
	var rk := clampf((spd - WALK) / 1.2, 0.0, 1.0)
	phase += spd * dt / lerpf(0.60, 0.92, rk) * PI
	if pushing:
		var ph := atan2(pos.x - CAP.x, pos.z - CAP.z)
		var th := ph - 0.42
		cap_rot.rotation.y = th
		var k := smoothstep(0.0, 1.0, clampf(-ph / (PI * 0.5), 0.0, 1.0))
		bridge.rotation.y = PI * 0.5 * (1.0 - k)
		var dir := Vector3(sin(th), 0, cos(th))
		tgtR = CAP + Vector3(0, 0.98, 0) + dir * 0.5; tgtL = CAP + Vector3(0, 0.98, 0) + dir * 0.74
	var lv := Vector2(vel.x * cos(yaw) - vel.z * sin(yaw), vel.x * sin(yaw) + vel.z * cos(yaw))
	var sway_t := -lv * 0.105
	sway_v += ((sway_t - sway) * 60.0 - sway_v * 7.0) * dt
	sway += sway_v * dt
	var hy := a_hy
	if look_at_pt != null:
		hy += clampf(angle_difference(yaw, atan2(look_at_pt.x - pos.x, look_at_pt.z - pos.z)), -1.0, 1.0)
	head_yaw = lerpf(head_yaw, hy, 1.0 - exp(-5.0 * dt))
	var breath := sin(t * 1.7)
	var st := {
		"pos": pos, "yaw": yaw,
		"bob": 0.02 * (wk + 0.9 * rk) * (0.5 - 0.5 * cos(2.0 * phase)) + 0.004 * breath * (1.0 - wk),
		"drop": a_drop, "lean": 0.075 * wk + 0.14 * rk + a_lean + 0.008 * breath,
		"roll": 0.028 * wk * sin(phase) + 0.01 * sin(t * 0.8) * (1.0 - wk), "twist": (0.07 + 0.05 * rk) * wk * sin(phase) + head_yaw * 0.18,
		"sway": sway, "pool": a_pool, "kick": wk * sin(phase),
		"head_yaw": head_yaw * 0.82, "head_pitch": a_headp + 0.03 * wk,
		"swingL": (0.12 + 0.1 * rk) * wk * sin(phase) * (1.0 - a_wL), "swingR": -(0.12 + 0.1 * rk) * wk * sin(phase),
		"hold": a_hold, "raise": a_raise, "open": a_open, "wL": a_wL, "wR": a_wR, "tL": tgtL, "tR": tgtR,
	}
	fig.apply(st); ghost.apply(st)
	var near := smoothstep(-9.1, -9.7, pos.x) * smoothstep(-8.35, -8.05, pos.z) * smoothstep(-6.95, -7.25, pos.z)
	ghost.visible = near > 0.01
	var prox := clampf(1.0 - (pos.x - MX - 0.5) / 1.4, 0.0, 1.0)
	flash = move_toward(flash, 0.0, dt * 0.7)
	ghost.ghost_mat.albedo_color = TEAL_D.lerp(CRIMSON, near * (0.3 + 0.7 * prox)).lerp(Color("ff5a62"), flash)
	ripple_p = move_toward(ripple_p, 1.0, dt * 0.75)
	(ripple.material_override as ShaderMaterial).set_shader_parameter("p", ripple_p)
	pulse_p = move_toward(pulse_p, 1.0, dt * 0.6)
	(pulse.material_override as ShaderMaterial).set_shader_parameter("p", pulse_p)
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
		m.set_shader_parameter("door_pos", Vector3(-10.0, 1.8, -8.2)); m.set_shader_parameter("door_e", door_energy)
	blob.position = Vector3(pos.x, pos.y + 0.012, pos.z); blob.scale = Vector3.ONE * (1.0 + a_pool * 0.6)
	cam_t = cam_t.lerp(pos + vel * 0.55, 1.0 - exp(-2.4 * dt))
	cam.position = cam_t + cam.basis.y * lerpf(3.3, -1.6, smoothstep(-5.0, -9.6, cam_t.x)) + cam.basis.z * 50.0
	cam2.position = cam2.position.lerp(pos + Vector3(0, 0.92, 0) + cam2.basis.z * 50.0, 1.0 - exp(-7.0 * dt))

func wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func go(pts: Array, cap := WALK) -> void:
	speed_cap = cap
	route.clear()
	for q in pts: route.append(q if q is Dictionary else {"p": q})
	seg_a = Vector3(pos.x, gy, pos.z)
	await arrived

func face(p: Vector3) -> void:
	face_to = p
	await faced

func tw() -> Tween:
	return create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func st4(c: Vector3, dir: Vector3, length: float, extra := {}) -> Array:
	var last := {"p": c + dir * length + Vector3(0, 0.4, 0)}
	last.merge(extra)
	return [c + dir * 0.35, {"p": c + dir * 1.35 + Vector3(0, 0.4, 0), "steps": 4}, last]

func _run() -> void:
	cam2.position = pos + Vector3(0, 0.92, 0) + cam2.basis.z * 50.0
	caption.text = "ηρεμία · κοιτάζει γύρω"
	await wait(0.7)
	var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	h.tween_property(self, "a_hy", -0.85, 0.8); h.tween_interval(0.35)
	h.tween_property(self, "a_hy", 0.7, 1.0); h.tween_interval(0.35); h.tween_property(self, "a_hy", 0.0, 0.6)
	await h.finished
	caption.text = "περπάτημα · σκάλες"
	await go([Vector3(0.2, 0, -0.4), {"p": Vector3(0.2, 1, -2.0), "steps": 8}, Vector3(0.35, 1, -2.24)])
	await face(Vector3(-1.0, 1, -2.24))
	caption.text = "σπρώχνει τον μοχλό · η γέφυρα γυρίζει"
	pushing = true
	var a := tw()
	a.tween_property(self, "a_wL", 1.0, 0.45); a.tween_property(self, "a_wR", 1.0, 0.45); a.tween_property(self, "a_lean", 0.2, 0.45)
	await a.finished
	var arc := []
	for i in range(1, 10): arc.append(CAP + Vector3(sin(-PI * 0.5 * i / 9.0), 0, cos(-PI * 0.5 * i / 9.0)) * 0.66)
	await go(arc, 0.5)
	await wait(0.15)
	pushing = false
	var b := tw()
	b.tween_property(self, "a_wL", 0.0, 0.45); b.tween_property(self, "a_wR", 0.0, 0.45); b.tween_property(self, "a_lean", 0.0, 0.45)
	await b.finished
	caption.text = "περνά τη γέφυρα"
	await go([Vector3(-0.75, 1, -2.8), Vector3(-3.5, 1, -2.8)])
	caption.text = "τρέξιμο"
	await go([Vector3(-5.75, 1, -2.8)], 2.7)
	look_at_pt = LAMP0
	await go([Vector3(-6.3, 1, -2.75), Vector3(-6.3, 1, -2.03)])
	await face(LAMP0)
	caption.text = "γονατίζει · παίρνει τη λάμπα"
	tgtR = LAMP0 + Vector3(0, 0.15, 0)
	var c := tw()
	c.tween_property(self, "a_drop", 0.55, 0.85); c.tween_property(self, "a_lean", 0.50, 0.85)
	c.tween_property(self, "a_pool", 1.0, 0.85); c.tween_property(self, "a_headp", 0.35, 0.7)
	c.tween_property(self, "a_wR", 1.0, 0.75).set_delay(0.2)
	await c.finished
	await wait(0.2)
	lamp_held = true
	var d := tw()
	d.tween_property(self, "lamp_energy", 1.0, 0.9)
	d.tween_property(self, "a_drop", 0.0, 0.95); d.tween_property(self, "a_lean", 0.0, 0.95)
	d.tween_property(self, "a_pool", 0.0, 0.95); d.tween_property(self, "a_headp", 0.0, 0.8)
	d.tween_property(self, "a_wR", 0.0, 0.8); d.tween_property(self, "a_hold", 1.0, 0.8)
	await d.finished
	look_at_pt = null
	await wait(0.3)
	caption.text = "ίσιος δρόμος…"
	await go([Vector3(-6.45, 1, -3.0), Vector3(-9.95, 1, -3.0), Vector3(-9.95, 1, -5.56)])
	caption.text = "…κι όμως βρέθηκε πάνω στην κολόνα"
	var e := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	e.tween_property(self, "a_hy", 0.8, 0.5); e.tween_interval(0.5); e.tween_property(self, "a_hy", 0.0, 0.4)
	await e.finished
	var c3 := Vector3(-8.6, 1.0, -7.1)
	var c0 := c3 + Vector3(2.0, -1.2, -1.6); var c1 := c0 + Vector3(0, 0.4, -2.0); var c2 := c1 + Vector3(-2.0, 0.4, 0)
	await go([Vector3(-9.95, 1, -7.1), c3])
	caption.text = "σκάλα χωρίς τέλος · ανεβαίνει συνέχεια…"
	var loop := []
	loop.append_array(st4(c3, Vector3.RIGHT, 3.6, {"tp": -K}))
	loop.append_array(st4(c0, Vector3.FORWARD, 2.0)); loop.append_array(st4(c1, Vector3.LEFT, 2.0))
	await go(loop)
	caption.text = "…και γυρίζει στο ίδιο σημείο"
	await go(st4(c2, Vector3.BACK, 3.6))
	await face(Vector3(-12, 1, -7.4))
	caption.text = "σηκώνει τη λάμπα"
	var f := tw()
	f.tween_property(self, "a_raise", 1.0, 0.7); f.tween_property(self, "a_headp", -0.22, 0.7); f.tween_property(self, "lamp_energy", 1.7, 0.9)
	await f.finished
	pulse.position = Vector3(pos.x, pos.y + 0.03, pos.z); pulse_p = 0.0
	await wait(1.1)
	var g := tw()
	g.tween_property(self, "a_raise", 0.0, 0.7); g.tween_property(self, "a_headp", 0.0, 0.7); g.tween_property(self, "lamp_energy", 1.0, 0.9)
	await g.finished
	await go([Vector3(-9.7, 1, -7.45), Vector3(-10.68, 1, -7.65)])
	await face(Vector3(MX, 1, -7.65))
	caption.text = "υπόκλιση"
	var i := tw()
	i.tween_property(self, "a_drop", 0.16, 0.6); i.tween_property(self, "a_lean", 0.36, 0.6); i.tween_property(self, "a_headp", 0.3, 0.6)
	i.tween_property(self, "a_open", 1.0, 0.6); i.tween_property(self, "a_pool", 0.3, 0.6)
	await i.finished
	await wait(0.35)
	var j := tw()
	j.tween_property(self, "a_drop", 0.0, 0.6); j.tween_property(self, "a_lean", 0.0, 0.6); j.tween_property(self, "a_headp", 0.0, 0.6)
	j.tween_property(self, "a_open", 0.0, 0.6); j.tween_property(self, "a_pool", 0.0, 0.6)
	await j.finished
	caption.text = "αγγίζει το γυαλί"
	tgtL = Vector3(MX + 0.012, 2.30, -7.52)
	ripple.position = Vector3(MX - 0.03, 2.30, -7.52)
	var k := tw()
	k.tween_property(self, "a_wL", 1.0, 0.8); k.tween_property(self, "a_lean", 0.09, 0.8)
	await k.finished
	ripple_p = 0.0; flash = 1.0
	var l := tw()
	l.tween_property(door, "position:y", door.position.y - 2.15, 1.7).set_delay(0.3)
	l.tween_property(self, "door_energy", 1.0, 1.7).set_delay(0.3)
	await wait(1.5)
	var m := tw()
	m.tween_property(self, "a_wL", 0.0, 0.7); m.tween_property(self, "a_lean", 0.0, 0.7)
	look_at_pt = Vector3(-10.0, 2, -8.6)
	await m.finished
	caption.text = "η πόρτα ανοίγει"
	await go([Vector3(-10.0, 1, -7.75), Vector3(-10.0, 1, -9.1)])
	await wait(1.2)
	get_tree().quit()
