extends Node3D
## EIDOLON demo: one flat, continuous map in a clean isometric look. Tap to walk, tap things to use them.
const Fig := preload("res://fig.gd")
const WALK := 1.4
const CAP := Vector3(0.9, 0.0, -5.0)
const PIV := Vector3(-3.6, 0.0, -5.1)
const LAMP0 := Vector3(-7.8, 0.17, -6.75)
const MX := -13.1
const MZ := -11.2
const DX := -12.0
const TEAL_D := Color("13283a")
const CRIMSON := Color("b8232f")
const FOG := Color("eab99c")
const WATER := -1.3
const SEA := Color("3c7d92")
const MIST := Color("cdb8c6")
const PALS := {
	"stone": ["f8efe1", "e8d5c5", "ada5c0"], "shade": ["ebdecc", "d7c1b1", "9c94b0"],
	"sand": ["f6e3c6", "e3c7a6", "a8959d"], "rose": ["f0c4b5", "dca696", "a47e93"],
	"far": ["cfcbd6", "bab5c9", "9896b4"], "far2": ["b4b3c9", "a3a1bf", "8a8aad"],
	"dark": ["5a5678", "4d4a6e", "44416a"], "crim": ["dc3d46", "bb2530", "7e1c31"],
	"teal": ["13283a", "13283a", "13283a"], "cream": ["fff3d2", "fff3d2", "fff3d2"],
	"gold": ["f0cf86", "d2a962", "94775a"], "trunk": ["a58a82", "8a6f6c", "63506a"],
	"leaf": ["7cc7a6", "4f9f8c", "2f6d74"], "leaf2": ["a5d9a8", "6fb793", "3f8480"], "leaf3": ["e6a3a0", "cf7f86", "93577a"],
	"dress": ["cdd0da", "b0b3c5", "8789a6"], "dress2": ["e4e5ea", "cacbd6", "9fa0b6"],
	"veil": ["f1f1f4", "d9d9e0", "acadc0"], "skin": ["f4e1d4", "dfc7ba", "b59da9"],
	"cyp": ["4f8f7c", "356f6a", "234d5c"], "terra": ["e9a98f", "cf8474", "96586a"], "wood": ["b98f7a", "9a7064", "6c4e5e"],
	"marble": ["fffaf3", "efe4dd", "c9c1d6"], "crim2": ["ee5a60", "cf3640", "8f2238"],
}
const SH := """shader_type spatial;
render_mode unshaded;
uniform vec3 c_top : source_color; uniform vec3 c_z : source_color; uniform vec3 c_x : source_color;
uniform vec3 fog_col : source_color;
uniform vec4 l0; uniform vec4 l1; uniform vec4 l2; uniform vec4 l3; uniform vec4 l4; uniform vec4 l5;
uniform float sway = 0.0; uniform float time_s = 0.0; uniform float marble = 0.0; uniform float rim = 0.0; uniform float flat_n = 0.0; uniform vec3 centre; uniform float mist_r = 7.0; uniform vec3 mist_col : source_color;
varying vec3 wp; varying vec3 wn;
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p){ return vn(p) * 0.55 + vn(p * 2.1 + 3.1) * 0.3 + vn(p * 4.3 + 7.7) * 0.15; }
float lit(vec4 l, vec3 p){ vec3 v = vec3(0.57735); vec3 d = p - l.xyz; return l.w * pow(clamp(1.0 - length(d - v * dot(d, v)) / 2.7, 0.0, 1.0), 2.0); }
void vertex(){
	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	if (sway > 0.0) { float k = sway * clamp(VERTEX.y + 0.3, 0.0, 2.0); VERTEX.x += sin(time_s * 1.2 + w0.x * 0.9 + w0.z * 0.6) * 0.035 * k; VERTEX.z += cos(time_s * 0.95 + w0.z * 0.8) * 0.025 * k; }
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment(){
	vec3 n = normalize(wn);
	if (flat_n > 0.5) { n = normalize(cross(dFdx(wp), dFdy(wp))); if (dot(n, vec3(1.0)) < 0.0) n = -n; }
	float wt = max(n.y, 0.0); float wz = max(n.z, 0.0); float wx = max(n.x, 0.0);
	float s = wt * wt + wz * wz + wx * wx;
	vec3 col = c_top * wt * wt + c_z * wz * wz + c_x * wx * wx + c_x * 0.86 * (1.0 - min(s, 1.0));
	col *= mix(0.9, 1.0, clamp(smoothstep(-1.6, -0.1, wp.y) + wt, 0.0, 1.0));
	if (marble > 0.0) {
		vec3 q = wp * 1.25;
		float w = fbm(q + vec3(fbm(q * 0.6 + 11.0), 0.0, fbm(q * 0.6 + 5.0)) * 1.6);
		float vein = smoothstep(0.022, 0.0, abs(w - 0.5));
		float vein2 = smoothstep(0.012, 0.0, abs(fbm(q * 2.6 + 20.0) - 0.47));
		col = mix(col, col * vec3(0.80, 0.81, 0.91), (vein * 0.34 + vein2 * 0.16) * marble);
		col *= 1.0 + (w - 0.5) * 0.06 * marble;
	}
	if (rim > 0.0) { float ndv = clamp(dot(n, vec3(0.57735)), 0.0, 1.0); col *= mix(1.0 - 0.2 * rim, 1.0, pow(ndv, 0.8)); }
	float l = lit(l0, wp) + lit(l1, wp) + lit(l2, wp) + lit(l3, wp) + lit(l4, wp) + lit(l5, wp);
	col = mix(col, col * vec3(1.06, 0.97, 0.80) + vec3(0.09, 0.055, 0.0), clamp(l, 0.0, 1.0) * 0.85);
	col = mix(col, fog_col, smoothstep(-1.35, -4.6, wp.y) * 0.9);
	vec3 d3 = wp - centre; float md = length(d3 - vec3(0.57735) * dot(d3, vec3(0.57735)));
	col = mix(col, mist_col, smoothstep(mist_r, mist_r * 1.9, md) * 0.94);
	ALBEDO = col;
}"""
const SH_WATER := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform vec3 deep : source_color; uniform vec3 shallow : source_color; uniform float time_s = 0.0;
uniform vec2 flow = vec2(0.0); uniform float vert = 0.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	vec2 p = wp.xz * 2.4 + flow * time_s;
	if (vert > 0.5) { p = vec2((wp.x - wp.z) * 5.0, (wp.y - (wp.x + wp.z) * 0.5) * 1.6 + time_s * 2.6); }
	float w = sin(p.x * 1.7 + time_s * 0.9) * sin(p.y * 2.3 - time_s * 0.7);
	float lines = smoothstep(0.86, 0.99, sin(p.x * 3.1 + sin(p.y * 2.0 + time_s * 0.6) * 1.6) * 0.5 + 0.5);
	ALBEDO = mix(deep, shallow, 0.5 + 0.3 * w) + vec3(0.45, 0.55, 0.5) * lines * 0.55;
}"""
const SH_CLOTH := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform vec3 ca : source_color; uniform vec3 cb : source_color; uniform float wave = 0.0; uniform float time_s = 0.0;
varying vec3 wn;
void vertex(){
	if (wave > 0.0) { VERTEX += NORMAL * sin(time_s * 2.2 + UV.y * 5.0 + UV.x * 2.0) * 0.04 * UV.y * wave; }
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment(){
	vec3 n = normalize(wn); if (!FRONT_FACING) n = -n;
	float sh = 0.8 + 0.2 * clamp(dot(n, normalize(vec3(-0.25, 0.7, 0.66))) * 0.5 + 0.5, 0.0, 1.0);
	ALBEDO = mix(ca, cb, UV.y) * sh;
}"""
const SH_SEA := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform vec3 near_col : source_color; uniform vec3 far_col : source_color; uniform vec3 centre; uniform float mist_r = 7.0; uniform float time_s = 0.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	vec3 d3 = wp - centre; float md = length(d3 - vec3(0.57735) * dot(d3, vec3(0.57735)));
	float m = smoothstep(mist_r * 0.8, mist_r * 1.75, md);
	vec2 p = wp.xz * 1.1;
	float lines = smoothstep(0.93, 0.995, sin(p.x * 2.3 + sin(p.y * 1.7 + time_s * 0.45) * 1.9 + time_s * 0.2) * 0.5 + 0.5);
	float sp = smoothstep(0.985, 1.0, sin(p.x * 9.1 + time_s * 1.3) * sin(p.y * 8.3 - time_s * 1.1));
	float brk = smoothstep(0.35, 0.75, sin(p.x * 0.63 + p.y * 0.41) * sin(p.y * 0.57 - p.x * 0.29 + 1.3) * 0.5 + 0.5);
	vec3 col = mix(near_col, far_col, m) + vec3(0.5, 0.6, 0.6) * (lines * 0.1 * brk + sp * 0.35) * (1.0 - m);
	ALBEDO = col; ALPHA = mix(0.6, 1.0, m);
}"""
const SH_FACE := """shader_type spatial;
render_mode unshaded;
uniform float time_s = 0.0;
varying vec3 lp;
void vertex(){ lp = VERTEX; }
void fragment(){
	float g = smoothstep(0.022, 0.0, abs(lp.x * 0.8 + lp.y - 0.02 - sin(time_s * 0.5) * 0.07));
	ALBEDO = mix(vec3(1.0, 0.99, 0.97), vec3(0.80, 0.85, 0.97), smoothstep(0.07, -0.09, lp.y)) + g * 0.2;
}"""
const SH_FOAM := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform float time_s = 0.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	float d = UV.x; float ph = fract(time_s * 0.13 + UV.y);
	float wob = sin(wp.x * 5.0 + wp.z * 4.0 + time_s * 1.2) * 0.03;
	float edge = smoothstep(0.09, 0.0, abs(d - 0.07 - wob));
	float wave = smoothstep(0.07, 0.0, abs(d - ph * 0.95 - wob)) * (1.0 - ph) * 0.8;
	ALBEDO = vec3(0.93, 0.98, 0.97); ALPHA = clamp(edge * 0.75 + wave, 0.0, 1.0) * 0.8;
}"""
const SH_RING := "shader_type spatial;\nrender_mode unshaded, blend_add, cull_disabled;\nuniform float p = 1.0; uniform vec3 tint = vec3(1.0, 0.36, 0.40);\nvoid fragment(){ float d = distance(UV, vec2(0.5)) * 2.0; float ring = smoothstep(0.05, 0.0, abs(d - p)) + 0.5 * smoothstep(0.035, 0.0, abs(d - p * 0.6)); ALBEDO = tint; ALPHA = ring * (1.0 - p); }"

var shaders := {}
var pmats := {}
var umats := {}
var timed: Array = []
var lights: Array = [Vector4.ZERO, Vector4.ZERO, Vector4.ZERO, Vector4.ZERO, Vector4.ZERO, Vector4.ZERO]
var fig: Node3D
var ghost: Node3D
var lamp: Node3D
var lamp_halo: MeshInstance3D
var door_halo: MeshInstance3D
var blob: MeshInstance3D
var pulse: MeshInstance3D
var tapring: MeshInstance3D
var ripple: MeshInstance3D
var door: MeshInstance3D
var cap_rot: Node3D
var bridge: Node3D
var cam: Camera3D
var sky: MeshInstance3D
var mist: MeshInstance3D
var cam_t := Vector3.ZERO
var world: Node3D
var refl: Node3D
var wfig: Node3D
var sea_mat: ShaderMaterial
var shot = null
var bv := PackedVector3Array()
var bn := PackedVector3Array()
var foam_mat: ShaderMaterial
var gulls: Array = []
var boat: Node3D
var pulse_p := 1.0
var tap_p := 1.0
var ripple_p := 1.0
var flash := 0.0
var lamp_held := false
var lamp_energy := 0.25
var door_energy := 0.0
var lamp_off := Vector3.ZERO
var lamp_vel := Vector3.ZERO
var pushing := false
var busy := false
var started := false
var ended := false
var auto := false
var pending := ""
var done := {}
var rects := {}
var objs := {}
var markers := {}
var hint: Label
var title_box: Control
var end_box: Control
var last_tap := -9.0

var pos := Vector3(0.6, 0, 2.1)
var yaw := -2.4
var spd := 0.0
var vel := Vector3.ZERO
var route: Array = []
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
signal settled

func pal(n: String, variant := "") -> ShaderMaterial:
	var key := n + "|" + variant
	if pmats.has(key): return pmats[key]
	var m := ShaderMaterial.new(); m.shader = shaders["two" if variant == "2" else "base"]
	m.set_shader_parameter("c_top", Color(PALS[n][0])); m.set_shader_parameter("c_z", Color(PALS[n][1]))
	m.set_shader_parameter("c_x", Color(PALS[n][2])); m.set_shader_parameter("fog_col", SEA); m.set_shader_parameter("mist_col", MIST)
	if variant == "sway": m.set_shader_parameter("sway", 1.0); m.set_shader_parameter("flat_n", 1.0); timed.append(m)
	if variant == "flat": m.set_shader_parameter("flat_n", 1.0)
	if n in ["stone", "shade", "sand", "rose"]: m.set_shader_parameter("marble", 1.0)
	if n == "marble": m.set_shader_parameter("marble", 0.3)
	pmats[key] = m
	return m

func water(flow := Vector2.ZERO, vert := false) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["water"]
	m.set_shader_parameter("deep", Color("2a8790")); m.set_shader_parameter("shallow", Color("79d8c6"))
	m.set_shader_parameter("flow", flow); m.set_shader_parameter("vert", 1.0 if vert else 0.0)
	timed.append(m)
	return m

func cloth(a: Color, b: Color, wave := 0.0) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["cloth"]
	m.set_shader_parameter("ca", a); m.set_shader_parameter("cb", b); m.set_shader_parameter("wave", wave)
	if wave > 0.0: timed.append(m)
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
	dentils(x0, z0, x1, z1, y - 0.18, parent)

func pier(x: float, z: float, top: float, w := 0.5, p := "stone") -> void:
	var h := w * 0.5
	blk(Vector3(x - h, -2.45, z - h), Vector3(x + h, top, z + h), p)
	blk(Vector3(x - h - 0.06, -2.45, z - h - 0.06), Vector3(x + h + 0.06, WATER + 0.06, z + h + 0.06), "shade")
	win_z(x, -1.15, z + h, w * 0.46, 0.6); win_x(x + h, -1.15, z, w * 0.46, 0.6)
	foam(x - h - 0.06, z - h - 0.06, x + h + 0.06, z + h + 0.06, 0.3)

func col_faces(c: Vector3, hw: float, y0: float, y1: float, p := "stone") -> void:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	var a := [Vector3(c.x + hw, y0, c.z + hw), Vector3(c.x + hw, y0, c.z - hw), Vector3(c.x + hw, y1, c.z - hw), Vector3(c.x + hw, y1, c.z + hw)]
	var b := [Vector3(c.x - hw, y0, c.z + hw), Vector3(c.x + hw, y0, c.z + hw), Vector3(c.x + hw, y1, c.z + hw), Vector3(c.x - hw, y1, c.z + hw)]
	for q in [[a, Vector3.RIGHT], [b, Vector3.BACK]]:
		for i in [0, 1, 2, 0, 2, 3]:
			v.append(q[0][i]); n.append(q[1])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, pal(p, "2"))


# ---------------------------------------------------------------- scenery pieces
## many small boxes merged into one mesh (dentils, balusters, inlays)
func bb(a: Vector3, b: Vector3) -> void:
	var lo := Vector3(minf(a.x, b.x), minf(a.y, b.y), minf(a.z, b.z)); var hi := Vector3(maxf(a.x, b.x), maxf(a.y, b.y), maxf(a.z, b.z))
	var c := [Vector3(lo.x, lo.y, lo.z), Vector3(hi.x, lo.y, lo.z), Vector3(hi.x, hi.y, lo.z), Vector3(lo.x, hi.y, lo.z),
		Vector3(lo.x, lo.y, hi.z), Vector3(hi.x, lo.y, hi.z), Vector3(hi.x, hi.y, hi.z), Vector3(lo.x, hi.y, hi.z)]
	for f in [[[7, 6, 2, 3], Vector3.UP], [[4, 5, 6, 7], Vector3.BACK], [[5, 1, 2, 6], Vector3.RIGHT], [[0, 4, 7, 3], Vector3.LEFT], [[1, 0, 3, 2], Vector3.FORWARD]]:
		for i in [0, 1, 2, 0, 2, 3]:
			bv.append(c[f[0][i]]); bn.append(f[1])

func bb_end(p: String, parent: Node = self) -> MeshInstance3D:
	if bv.is_empty(): return null
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = bv; arr[Mesh.ARRAY_NORMAL] = bn
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	bv = PackedVector3Array(); bn = PackedVector3Array()
	return prim(am, Vector3.ZERO, pal(p, "2"), parent)

func dentils(x0: float, z0: float, x1: float, z1: float, y: float, parent: Node = self) -> void:
	var x := x0 + 0.05
	while x < x1 - 0.08:
		bb(Vector3(x, y - 0.06, z1), Vector3(x + 0.06, y, z1 + 0.035)); x += 0.13
	var z := z0 + 0.05
	while z < z1 - 0.08:
		bb(Vector3(x1, y - 0.06, z), Vector3(x1 + 0.035, y, z + 0.06)); z += 0.13
	bb_end("stone", parent)

## a Greek key border laid into the floor along the inside of a rectangle
func meander(x0: float, z0: float, x1: float, z1: float, p := "shade") -> void:
	var u := 0.26; var h := 0.13; var w := 0.022; var y0 := 0.0; var y1 := 0.004
	for side in 4:
		var horiz := side % 2 == 0
		var a0 := (x0 if horiz else z0) + 0.0; var a1 := (x1 if horiz else z1)
		var base := z0 if side == 0 else (x1 - h if side == 1 else (z1 - h if side == 2 else x0))
		var n := int((a1 - a0) / u)
		var uu := (a1 - a0) / maxf(n, 1)
		for i in n:
			var o := a0 + i * uu
			for seg in [[0.0, 0.0, uu, w], [0.0, 0.0, w, h], [0.0, h - w, uu * 0.72, h], [uu * 0.72 - w, h * 0.38, uu * 0.72, h], [uu * 0.32, h * 0.38, uu * 0.72, h * 0.38 + w]]:
				if horiz: bb(Vector3(o + seg[0], y0, base + seg[1]), Vector3(o + seg[2], y1, base + seg[3]))
				else: bb(Vector3(base + seg[1], y0, o + seg[0]), Vector3(base + seg[3], y1, o + seg[2]))
	bb_end(p)

func foam(x0: float, z0: float, x1: float, z1: float, wdt := 0.42) -> void:
	var v := PackedVector3Array(); var uv := PackedVector2Array()
	var y := WATER + 0.012
	var inn := [Vector3(x0, y, z0), Vector3(x1, y, z0), Vector3(x1, y, z1), Vector3(x0, y, z1)]
	var out := [Vector3(x0 - wdt, y, z0 - wdt), Vector3(x1 + wdt, y, z0 - wdt), Vector3(x1 + wdt, y, z1 + wdt), Vector3(x0 - wdt, y, z1 + wdt)]
	for i in 4:
		var j := (i + 1) % 4
		for q in [[inn[i], 0.0], [inn[j], 0.0], [out[j], 1.0], [inn[i], 0.0], [out[j], 1.0], [out[i], 1.0]]:
			v.append(q[0]); uv.append(Vector2(q[1], i * 0.25))
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_TEX_UV] = uv
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, foam_mat)

## a fluted column with base and capital
func column(p: Vector3, h: float, r := 0.15, broken := false) -> void:
	var segs := 48; var nfl := 12
	var v := PackedVector3Array(); var n := PackedVector3Array(); var idx := PackedInt32Array()
	for i in 2:
		var rr := r * (1.0 if i == 0 else 0.84)
		for j in segs + 1:
			var a := TAU * j / segs
			var k := 1.0 - 0.07 * (0.5 + 0.5 * cos(a * nfl))
			var d := Vector3(cos(a), 0, sin(a))
			var tdir := Vector3(-sin(a), 0, cos(a))
			v.append(p + d * rr * k + Vector3(0, 0.1 + (h - 0.2) * i, 0))
			n.append((d * k - tdir * (0.035 * nfl * sin(a * nfl))).normalized())
	for j in segs:
		var a0 := j; var b0 := j + 1; var c0 := j + segs + 1; var d0 := c0 + 1
		idx.append_array([a0, b0, d0, a0, d0, c0])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n; arr[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, pal("stone", "2"))
	cyl(p, r * 1.35, r * 1.35, 0.05, pal("shade"), 24); cyl(p + Vector3(0, 0.05, 0), r * 1.18, r * 1.05, 0.05, pal("stone"), 24)
	if broken:
		cyl(p + Vector3(0, h - 0.1, 0), r * 0.84, r * 0.6, 0.07, pal("shade"), 7)
	else:
		cyl(p + Vector3(0, h - 0.1, 0), r * 0.86, r * 1.25, 0.08, pal("stone"), 24)
		blk(p + Vector3(-r * 1.35, h - 0.02, -r * 1.35), p + Vector3(r * 1.35, h + 0.05, r * 1.35), "shade")

func cypress(p: Vector3, h := 2.2) -> void:
	cyl(p, 0.05, 0.04, h * 0.2, pal("trunk"), 6)
	cyl(p + Vector3(0, h * 0.14, 0), 0.26, 0.2, h * 0.32, pal("cyp", "sway"), 7)
	cyl(p + Vector3(0, h * 0.46, 0), 0.2, 0.02, h * 0.54, pal("cyp", "sway"), 7)
	decal(p + Vector3(0.14, 0, -0.14), 0.8, 0.6, 0.2, 0.78)

func urn(p: Vector3, sc := 1.0, pl := "terra") -> void:
	var prof := [[0.05, 0.0], [0.11, 0.05], [0.14, 0.16], [0.12, 0.27], [0.06, 0.33], [0.055, 0.38], [0.085, 0.41]]
	for i in prof.size() - 1:
		cyl(p + Vector3(0, prof[i][1] * sc, 0), prof[i][0] * sc, prof[i + 1][0] * sc, (prof[i + 1][1] - prof[i][1]) * sc, pal(pl, "flat"), 8)

func vine(x: float, z: float, along_x: bool, length: float) -> void:
	var n := int(length / 0.16)
	for i in n:
		var o := i * 0.16
		var c := Vector3(x + (o if along_x else 0.02), -0.02 - 0.09 * absf(sin(i * 1.7)), z + (0.02 if along_x else o))
		var b := ball(c, 0.07 + 0.03 * sin(i * 2.3), pal("leaf" if i % 3 else "leaf2", "sway")); b.mesh = _lowball(0.07 + 0.03 * sin(i * 2.3))
		if i % 2 == 0:
			var l := 0.25 + 0.2 * absf(sin(i * 0.9))
			blk(c + Vector3(-0.012, -l, -0.012), c + Vector3(0.012, 0, 0.012), "leaf")

func _lowball(r: float) -> SphereMesh:
	var m := SphereMesh.new(); m.radius = r; m.height = r * 2.0; m.radial_segments = 7; m.rings = 4
	return m

func cyl(p: Vector3, r0: float, r1: float, h: float, m: Material, seg := 20, parent: Node = self) -> MeshInstance3D:
	var c := CylinderMesh.new(); c.bottom_radius = r0; c.top_radius = r1; c.height = h; c.radial_segments = seg
	return prim(c, p + Vector3(0, h * 0.5, 0), m, parent)

func ball(p: Vector3, r: float, m: Material, parent: Node = self) -> MeshInstance3D:
	var s := SphereMesh.new(); s.radius = r; s.height = r * 2.0; s.radial_segments = 20; s.rings = 10
	return prim(s, p, m, parent)

func decal(p: Vector3, sx: float, sz: float, a := 0.26, rot := 0.0) -> void:
	var q := QuadMesh.new(); q.size = Vector2(1, 1); q.orientation = PlaneMesh.FACE_Y
	if not umats.has("decal%f" % a):
		var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
		g.colors = PackedColorArray([Color(0.22, 0.17, 0.34, a), Color(0.22, 0.17, 0.34, a * 0.55), Color(0.22, 0.17, 0.34, 0)])
		var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 64; gt.height = 64
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_texture = gt
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		umats["decal%f" % a] = m
	var mi := prim(q, p + Vector3(0, 0.007, 0), umats["decal%f" % a])
	mi.scale = Vector3(sx, 1, sz); mi.rotation.y = rot

func under(x0: float, z0: float, x1: float, z1: float, inset := 0.22, p := "stone") -> void:
	var a := Vector3(x0 + inset, -2.45, z0 + inset); var b := Vector3(x1 - inset, -0.18, z1 - inset)
	blk(a, b, p)
	blk(Vector3(a.x - 0.1, -2.45, a.z - 0.1), Vector3(b.x + 0.1, WATER + 0.07, b.z + 0.1), "shade")
	cornice(a.x, a.z, b.x, b.z, -0.42, 0.1, 0.12, "shade")
	foam(a.x - 0.1, a.z - 0.1, b.x + 0.1, b.z + 0.1)
	var nx := maxi(1, int((b.x - a.x) / 1.05)); var nz := maxi(1, int((b.z - a.z) / 1.05))
	for i in nx: win_z(a.x + (b.x - a.x) * (i + 0.5) / nx, -1.2, b.z, 0.4, 0.74)
	for i in nz: win_x(b.x, -1.2, a.z + (b.z - a.z) * (i + 0.5) / nz, 0.4, 0.74)

func tiles(x0: float, z0: float, x1: float, z1: float, step := 0.8) -> void:
	var x := x0 + step
	while x < x1 - 0.1:
		blk(Vector3(x - 0.008, 0, z0 + 0.1), Vector3(x + 0.008, 0.003, z1 - 0.1), "shade"); x += step
	var z := z0 + step
	while z < z1 - 0.1:
		blk(Vector3(x0 + 0.1, 0, z - 0.008), Vector3(x1 - 0.1, 0.003, z + 0.008), "shade"); z += step

func rosette(c: Vector3, r: float) -> void:
	var names := ["shade", "stone", "rose", "stone", "crim"]
	var radii := [1.0, 0.9, 0.62, 0.5, 0.16]
	for i in 5:
		cyl(c + Vector3(0, 0.002 * i, 0), r * radii[i], r * radii[i], 0.005, pal(names[i]), 48)
	for i in 8:
		var a := TAU * i / 8.0
		var d := blk(Vector3(-0.07, 0.008, -0.07), Vector3(0.07, 0.014, 0.07), "crim" if i % 2 == 0 else "gold")
		d.position = c + Vector3(cos(a), 0, sin(a)) * r * 0.76 + Vector3(0, 0.011, 0); d.rotation.y = PI * 0.25 - a

func parapet(a: Vector3, b: Vector3, h := 0.34) -> void:
	var w := 0.06
	var lo := Vector3(minf(a.x, b.x), 0, minf(a.z, b.z)); var hi := Vector3(maxf(a.x, b.x), 0, maxf(a.z, b.z))
	blk(lo + Vector3(-w, 0, -w), hi + Vector3(w, 0.05, w), "shade")
	blk(lo + Vector3(-w - 0.015, h, -w - 0.015), hi + Vector3(w + 0.015, h + 0.05, w + 0.015), "stone")
	var along_x := (hi.x - lo.x) > (hi.z - lo.z)
	var ln := (hi.x - lo.x) if along_x else (hi.z - lo.z)
	var n := maxi(2, int(ln / 0.2))
	for i in n + 1:
		var c := lo + (Vector3(ln * i / n, 0, 0) if along_x else Vector3(0, 0, ln * i / n))
		if i % 6 == 0: bb(c + Vector3(-0.07, 0.05, -0.07), c + Vector3(0.07, h, 0.07))
		else:
			bb(c + Vector3(-0.022, 0.05, -0.022), c + Vector3(0.022, h, 0.022)); bb(c + Vector3(-0.04, 0.13, -0.04), c + Vector3(0.04, 0.2, 0.04))
	bb_end("stone")

func tree(p: Vector3, s := 1.0, leaf := "leaf") -> void:
	blk(p + Vector3(-0.3, 0, -0.3), p + Vector3(0.3, 0.22, 0.3), "shade")
	blk(p + Vector3(-0.34, 0.22, -0.34), p + Vector3(0.34, 0.27, 0.34), "stone")
	cyl(p + Vector3(0, 0.27, 0), 0.06 * s, 0.04 * s, 1.0 * s, pal("trunk"), 10)
	var n := Node3D.new(); n.position = p + Vector3(0, 0.27 + 1.0 * s, 0); add_child(n)
	for q in [[Vector3(0, 0.2, 0), 0.46], [Vector3(0.24, 0.5, 0.1), 0.34], [Vector3(-0.22, 0.56, -0.08), 0.3], [Vector3(0.02, 0.86, 0.02), 0.27]]:
		ball(q[0] * s, q[1] * s, pal(leaf, "sway"), n).mesh = _lowball(q[1] * s)
	decal(p + Vector3(0.3, 0, -0.3), 1.5 * s, 1.1 * s, 0.2, 0.78)

func bush(p: Vector3, s := 1.0, leaf := "leaf2") -> void:
	var n := Node3D.new(); n.position = p; add_child(n)
	ball(Vector3(0, 0.14 * s, 0), 0.2 * s, pal(leaf, "sway"), n).mesh = _lowball(0.2 * s)
	ball(Vector3(0.16 * s, 0.1 * s, 0.06 * s), 0.14 * s, pal(leaf, "sway"), n).mesh = _lowball(0.14 * s)
	ball(Vector3(-0.13 * s, 0.09 * s, -0.05 * s), 0.13 * s, pal("leaf", "sway"), n).mesh = _lowball(0.13 * s)
	for i in 3: ball(Vector3(0.12 * cos(i * 2.1), 0.2 * s + 0.05 * sin(i * 3.0), 0.12 * sin(i * 2.1)) * s, 0.03, pal("crim", "sway"), n)

func lantern(p: Vector3, li: int, dirx := 1.0) -> void:
	cyl(p, 0.035, 0.02, 1.45, pal("dark"), 10)
	blk(p + Vector3(-0.07, 0, -0.07), p + Vector3(0.07, 0.06, 0.07), "shade")
	blk(p + Vector3(minf(0, 0.3 * dirx), 1.42, -0.012), p + Vector3(maxf(0, 0.3 * dirx), 1.45, 0.012), "dark")
	var c := p + Vector3(0.28 * dirx, 1.26, 0)
	ball(c, 0.055, mat(Color("ffdf94")))
	cyl(c + Vector3(0, 0.05, 0), 0.07, 0.012, 0.06, pal("gold"), 12)
	cyl(c + Vector3(0, -0.085, 0), 0.03, 0.05, 0.03, pal("gold"), 12)
	var h := halo(0.9, Color(1.0, 0.8, 0.45, 0.5)); h.position = c; add_child(h)
	lights[li] = Vector4(c.x, 0.2, c.z, 0.5)
	decal(p + Vector3(0.1, 0, -0.1), 0.5, 0.36, 0.2, 0.78)

func banner(p: Vector3, w: float, h: float, facing_x := false) -> void:
	var q := QuadMesh.new(); q.size = Vector2(w, h); q.subdivide_depth = 8; q.subdivide_width = 2
	var mi := prim(q, p + Vector3(0, -h * 0.5, 0), cloth(Color("d63a44"), Color("a81f2c"), 1.0))
	if facing_x: mi.rotation.y = PI * 0.5
	blk(p + Vector3(-0.02 if facing_x else -w * 0.5 - 0.03, 0, -w * 0.5 - 0.03 if facing_x else -0.02), p + Vector3(0.03 if facing_x else w * 0.5 + 0.03, 0.04, w * 0.5 + 0.03 if facing_x else 0.03), "gold")

func pool(x0: float, z0: float, x1: float, z1: float, flow := Vector2.ZERO) -> void:
	var q := QuadMesh.new(); q.size = Vector2(x1 - x0, z1 - z0); q.orientation = PlaneMesh.FACE_Y
	prim(q, Vector3((x0 + x1) * 0.5, 0.012, (z0 + z1) * 0.5), water(flow))
	var r := 0.07
	blk(Vector3(x0 - r, 0, z0 - r), Vector3(x1 + r, 0.05, z0), "shade"); blk(Vector3(x0 - r, 0, z1), Vector3(x1 + r, 0.05, z1 + r), "shade")
	blk(Vector3(x0 - r, 0, z0), Vector3(x0, 0.05, z1), "shade"); blk(Vector3(x1, 0, z0), Vector3(x1 + r, 0.05, z1), "shade")

func strip(x0: float, z0: float, x1: float, z1: float, flow: Vector2) -> void:
	var q := QuadMesh.new(); q.size = Vector2(x1 - x0, z1 - z0); q.orientation = PlaneMesh.FACE_Y
	prim(q, Vector3((x0 + x1) * 0.5, 0.006, (z0 + z1) * 0.5), water(flow))

func fall(x: float, zc: float, y0: float, y1: float) -> void:
	var v := PackedVector3Array([Vector3(x, y0, zc + 0.18), Vector3(x, y0, zc - 0.18), Vector3(x, y1, zc - 0.18),
		Vector3(x, y0, zc + 0.18), Vector3(x, y1, zc - 0.18), Vector3(x, y1, zc + 0.18)])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, water(Vector2.ZERO, true))

func islet(o: Vector3, p := "far", q := "far2") -> void:
	blk(o + Vector3(-0.9, -0.14, -0.8), o + Vector3(0.9, 0, 0.8), p)
	blk(o + Vector3(-0.7, -1.1, -0.6), o + Vector3(0.7, -0.14, 0.6), q)
	blk(o + Vector3(-0.45, -2.6, -0.4), o + Vector3(0.45, -1.1, 0.4), p)
	blk(o + Vector3(-0.2, -3.6, -0.2), o + Vector3(0.2, -2.6, 0.2), q)
	blk(o + Vector3(-0.6, 0, -0.62), o + Vector3(0.3, 1.0, -0.36), p); win_z(o.x - 0.15, o.y, o.z - 0.36, 0.36, 0.78, "dark")
	cyl(o + Vector3(0.55, 0, 0.3), 0.04, 0.03, 0.6, pal(q), 8); ball(o + Vector3(0.55, 0.8, 0.3), 0.3, pal("leaf", "sway"))
	for i in 4: blk(o + Vector3(-0.9 - 0.3 * (i + 1), -0.14 - 0.24 * (i + 1), 0.1), o + Vector3(-0.9 - 0.3 * i, -0.24 * (i + 1), 0.5), q)

var model_cache := {}
func _xf(n: Node3D, root: Node) -> Transform3D:
	var tr := n.transform
	var q := n.get_parent()
	while q != null and q != root and q is Node3D:
		tr = (q as Node3D).transform * tr; q = q.get_parent()
	return tr

## a marble model from our library, set on the ground at `pos`, scaled to `height`
func model(nm: String, pos: Vector3, height: float, yaw := 0.0, tilt := Vector3.ZERO, p := "marble") -> Node3D:
	if not model_cache.has(nm):
		var st := GLTFState.new(); var doc := GLTFDocument.new()
		if doc.append_from_file(ProjectSettings.globalize_path("res://models_lp/%s.glb" % nm), st) != OK:
			push_warning("model missing: " + nm); return null
		model_cache[nm] = doc.generate_scene(st)
	var src: Node3D = model_cache[nm].duplicate()
	var bb := AABB(); var first := true
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		mi.material_override = pal(p, "flat")
		var a: AABB = (src.transform * _xf(mi, src)) * mi.get_aabb()
		if first: bb = a; first = false
		else: bb = bb.merge(a)
	var h := Node3D.new(); h.position = pos; h.rotation = Vector3(tilt.x, yaw, tilt.z); add_child(h)
	var sc := height / maxf(bb.size.y, 0.001)
	src.scale *= sc
	src.position = src.position * sc - Vector3(bb.get_center().x, bb.position.y, bb.get_center().z) * sc
	h.add_child(src)
	return h

# ---------------------------------------------------------------- setup
func _ready() -> void:
	for k in [["base", SH], ["two", SH.replace("render_mode unshaded;", "render_mode unshaded, cull_disabled;")],
			["water", SH_WATER], ["cloth", SH_CLOTH], ["ring", SH_RING], ["sea", SH_SEA], ["face", SH_FACE], ["foam", SH_FOAM]]:
		var s := Shader.new(); s.code = k[1]; shaders[k[0]] = s
	auto = "auto" in OS.get_cmdline_user_args()
	_env()
	var n0 := get_child_count()
	_world()
	world = Node3D.new(); world.name = "World"; add_child(world)
	for c in get_children().slice(n0):
		if c != world: c.reparent(world)
	refl = world.duplicate(); refl.name = "Refl"; add_child(refl)
	refl.scale = Vector3(1, -1, 1); refl.position.y = 2.0 * WATER
	_actors(); _nav(); _ui()
	cam_t = pos
	get_viewport().size_changed.connect(_fit)
	_fit()
	if "gallery" in OS.get_cmdline_user_args(): _gallery()
	if "shots" in OS.get_cmdline_user_args(): _shots()
	if "zoom" in OS.get_cmdline_user_args(): cam.size = 3.3
	if auto: _auto()

func _gallery() -> void:
	var names := ["kit_face1", "kit_face2", "kit_face3", "kit_face4", "kit_face5", "kit_face6", "colossus_head_veiled", "observer_veiled",
		"statue_veiled_broken", "statue_veiled_bust", "statue_veiled_kneeling", "statue_veiled_mourning", "statue_veiled_praying", "statue_veiled_unfinished",
		"column_doric", "column_fallen", "column_stump", "pediment_fragment", "rubble_pile", "kit_urns", "kit_fountain", "archway_ruined"]
	var o := Vector3(60, 0, 60)
	blk(o + Vector3(-9, -0.2, -9), o + Vector3(9, 0, 9), "shade")
	for i in names.size():
		var c := o + Vector3(-4.2 + (i % 4) * 2.8, 0, 5.5 - (i / 4) * 2.4) + Vector3(1, 0, -1) * ((i / 4) * 1.1)
		model(names[i], c, 1.6)
		var l := Label3D.new(); l.text = "%d %s" % [i, names[i].replace("statue_veiled_", "st_").replace("kit_", "")]; l.font_size = 40; l.pixel_size = 0.004
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED; l.position = c + Vector3(0.9, 0.1, 0.9); l.modulate = Color(0.2, 0.1, 0.2); l.no_depth_test = true; add_child(l)
	started = true; title_box.hide()
	cam.size = 16.0
	set_process(false)
	cam.position = o + Vector3(0, 1.0, 0) + cam.basis.z * 50.0
	await get_tree().create_timer(0.5).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_environment("SHOT_DIR") + "/gallery.png")
	get_tree().quit()

func _shots() -> void:
	started = true; title_box.hide(); hint.hide()
	var dir := OS.get_environment("SHOT_DIR")
	var list := [
		{"n": "01-map", "p": Vector3(0.4, 0, 1.6), "y": 0.6, "c": Vector3(-5.6, 0, -5.4), "s": 27.0},
		{"n": "02-first-court", "p": Vector3(0.5, 0, 1.7), "y": 0.5, "c": Vector3(1.2, 0.6, 0.4), "s": 11.0},
		{"n": "03-colossus", "p": Vector3(2.95, 0, 1.2), "y": 1.3, "c": Vector3(3.6, 1.2, 1.0), "s": 9.0},
		{"n": "04-lever-bridge", "p": Vector3(0.45, 0, -4.5), "y": -1.5, "c": Vector3(-1.2, 0.4, -5.0), "s": 9.5},
		{"n": "05-lamp-island", "p": Vector3(-7.9, 0, -5.5), "y": 0.7, "c": Vector3(-8.4, 0.9, -5.6), "s": 8.5, "lamp": true},
		{"n": "06-water-that-returns", "p": Vector3(-11.68, 0, -7.5), "y": 0.9, "c": Vector3(-9.9, 0.6, -6.2), "s": 9.0, "lamp": true},
		{"n": "07-mirror-garden", "p": Vector3(MX + 0.52, 0, MZ), "y": -PI * 0.5, "c": Vector3(-11.7, 1.0, -11.2), "s": 8.5, "lamp": true, "touch": true},
		{"n": "07b-steps-and-boat", "p": Vector3(0.3, 0, 2.7), "y": 0.3, "c": Vector3(0.9, 0.2, 3.4), "s": 6.5, "lamp": true},
		{"n": "08-heroine", "p": Vector3(0.6, 0, 1.9), "y": 0.78, "c": Vector3(0.6, 0.95, 1.9), "s": 3.1},
		{"n": "09-heroine-veil", "p": Vector3(0.6, 0, 1.9), "y": -2.3, "c": Vector3(0.6, 0.95, 1.9), "s": 3.1, "lamp": true},
		{"n": "10-strange-heads", "p": Vector3(-1.2, 0, 1.4), "y": -1.2, "c": Vector3(-1.9, 0.7, 1.4), "s": 4.6},
		{"n": "11-statues", "p": Vector3(-11.6, 0, -10.6), "y": 0.4, "c": Vector3(-11.6, 0.9, -11.3), "s": 6.5, "lamp": true},
	]
	for sh in list:
		shot = sh
		route.clear(); pos = sh.p; yaw = sh.y; cam.size = sh.s; cam_t = pos
		if sh.get("lamp", false): lamp_held = true; a_hold = 1.0; lamp_energy = 1.0
		a_wL = 0.0
		if sh.get("touch", false):
			tgtL = Vector3(MX + 0.012, 1.30, MZ + 0.13); a_wL = 1.0; a_lean = 0.09
			door.position.y = 1.05 - 2.15; door_energy = 1.0; ripple.position = Vector3(MX - 0.03, 1.30, MZ + 0.13); ripple_p = 0.3; flash = 0.6
		fig.veil_ready = false; wfig.veil_ready = false; ghost.veil_ready = false
		await get_tree().create_timer(1.2).timeout
		if sh.get("touch", false): ripple_p = 0.3
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, sh.n])
		print("SHOT ", sh.n)
	get_tree().quit()

func ring_mat(tint: Vector3) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["ring"]; m.set_shader_parameter("tint", tint); m.render_priority = 2
	return m

func _env() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color("2c6379")
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = 11.0; cam.near = 0.1; cam.far = 150.0
	cam.rotation_degrees = Vector3(-35.264, 45, 0)
	add_child(cam); cam.current = true
	var sq := QuadMesh.new(); sq.size = Vector2(260, 260); sq.orientation = PlaneMesh.FACE_Y
	foam_mat = ShaderMaterial.new(); foam_mat.shader = shaders["foam"]; timed.append(foam_mat)
	sea_mat = ShaderMaterial.new(); sea_mat.shader = shaders["sea"]
	sea_mat.set_shader_parameter("near_col", SEA); sea_mat.set_shader_parameter("far_col", MIST)
	prim(sq, Vector3(0, WATER, 0), sea_mat)
	var flies := _particles(26, 7.0, Vector3(5, 0.6, 9), 0.05, Color(1.0, 0.82, 0.45, 0.85), Vector3(0, 0.02, 0), 0.12, true)
	flies.position = Vector3(0, 0.5, -48); flies.rotation.x = PI * 0.5; cam.add_child(flies)
	var petals := _particles(16, 9.0, Vector3(5, 0.5, 9), 0.05, Color(0.86, 0.25, 0.3, 0.85), Vector3(0.06, -0.12, 0), 0.05)
	petals.position = Vector3(0, 3.0, -46); petals.rotation.x = PI * 0.5; cam.add_child(petals)

func _particles(n: int, life: float, ext: Vector3, size: float, c: Color, grav: Vector3, v: float, add := false) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = n; p.lifetime = life; p.preprocess = life
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX; p.emission_box_extents = ext
	p.gravity = grav; p.initial_velocity_min = v * 0.3; p.initial_velocity_max = v; p.spread = 180.0
	p.scale_amount_min = 0.5; p.scale_amount_max = 1.2
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.2, 0.8, 1.0])
	g.colors = PackedColorArray([Color(c.r, c.g, c.b, 0), c, c, Color(c.r, c.g, c.b, 0)]); p.color_ramp = g
	var q := QuadMesh.new(); q.size = Vector2(size, size)
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.vertex_color_use_as_albedo = true
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if add: m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	q.material = m; p.mesh = q
	return p

func _fit() -> void:
	pass

func _world() -> void:
	# ---- A. the first court
	slab(-2.6, -1.4, 2.2, 3.2, 0.0); under(-2.6, -1.4, 2.2, 3.2)
	tiles(-2.6, -1.4, 2.2, 3.2, 0.8); rosette(Vector3(0, 0, 1.1), 0.95); meander(-2.3, -1.1, 2.0, 3.0)
	parapet(Vector3(-2.5, 0, -1.3), Vector3(-2.5, 0, 3.1)); parapet(Vector3(-2.5, 0, -1.3), Vector3(-0.75, 0, -1.3)); parapet(Vector3(0.75, 0, -1.3), Vector3(2.1, 0, -1.3))
	tree(Vector3(-2.05, 0, -0.85), 1.15); bush(Vector3(-2.15, 0, 0.1), 0.8); bush(Vector3(-2.15, 0, 2.7), 0.8, "leaf3")
	lantern(Vector3(1.05, 0, -1.02), 2)
	# gate
	for gx in [-0.68, 0.68]:
		blk(Vector3(gx - 0.13, 0, -1.43), Vector3(gx + 0.13, 2.0, -1.17), "stone")
		blk(Vector3(gx - 0.16, 0, -1.46), Vector3(gx + 0.16, 0.1, -1.14), "shade")
	var gw := CSGBox3D.new(); gw.size = Vector3(1.62, 0.62, 0.26); gw.position = Vector3(0, 2.31, -1.3); gw.material = pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = 0.55; gc.height = 0.5; gc.sides = 32
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -0.31, 0); gc.material = pal("shade"); gw.add_child(gc); add_child(gw)
	cornice(-0.81, -1.43, 0.81, -1.17, 2.62, 0.04, 0.06)
	blk(Vector3(-0.06, 2.68, -1.34), Vector3(0.06, 2.8, -1.26), "crim")
	# pool + balcony on the east side
	slab(2.2, -1.0, 3.5, 1.9, 0.0); under(2.2, -1.0, 3.5, 1.9, 0.25, "sand")
	pool(2.45, -0.75, 3.25, 0.35); bush(Vector3(3.2, 0, 1.65), 0.8)
	blk(Vector3(2.5, 0, 1.55), Vector3(3.0, 0.22, 1.75), "shade")
	parapet(Vector3(3.4, 0, 0.6), Vector3(3.4, 0, 1.8))
	# ---- B. path with a rill of water
	slab(-0.5, -3.6, 0.5, -1.4, 0.0)
	for pz in [-2.0, -3.0]: pier(0.0, pz, -0.18, 0.6)
	strip(0.36, -3.6, 0.46, -1.4, Vector2(0, -1.0))
	# ---- C. the capstan court
	slab(-1.6, -6.6, 1.8, -3.6, 0.0); under(-1.6, -6.6, 1.8, -3.6, 0.22, "sand")
	tiles(-1.6, -6.6, 1.8, -3.6, 0.85); meander(-1.45, -6.25, 1.65, -3.75)
	blk(Vector3(-1.6, 0, -6.6), Vector3(1.8, 1.5, -6.38), "stone"); cornice(-1.6, -6.6, 1.8, -6.38, 1.5)
	crenels(Vector3(-1.5, 1.56, -6.42), Vector3(1.7, 1.56, -6.42), 0.32)
	for wx in [-0.9, 0.1, 1.1]: win_z(wx, 0.25, -6.38, 0.4, 0.95)
	banner(Vector3(-0.4, 1.4, -6.365), 0.3, 0.9)
	bush(Vector3(-0.2, 0, -6.2), 0.8); lantern(Vector3(1.6, 0, -3.8), 3, -1.0)
	cyl(CAP, 0.3, 0.26, 0.05, pal("shade"), 32); cyl(CAP + Vector3(0, 0.05, 0), 0.065, 0.05, 0.95, pal("stone"), 16)
	cap_rot = Node3D.new(); cap_rot.name = "Cap"; cap_rot.position = CAP + Vector3(0, 0.98, 0); cap_rot.rotation.y = -0.42; add_child(cap_rot)
	blk(Vector3(-0.022, -0.022, -0.2), Vector3(0.022, 0.022, 0.84), "dark", cap_rot)
	ball(Vector3(0, 0, 0.86), 0.045, pal("crim"), cap_rot); ball(Vector3(0, 0.06, 0), 0.045, pal("crim"), cap_rot)
	decal(CAP + Vector3(0.12, 0, -0.12), 0.9, 0.7, 0.22, 0.78)
	# ---- the turning bridge
	slab(-2.4, -5.6, -1.6, -4.6, 0.0)
	bridge = Node3D.new(); bridge.name = "Bridge"; bridge.position = PIV; bridge.rotation.y = PI * 0.5; add_child(bridge)
	slab(-1.2, -0.5, 1.2, 0.5, 0.0, "stone", bridge)
	blk(Vector3(-1.1, 0, -0.03), Vector3(1.1, 0.004, 0.03), "crim", bridge)
	for e in [-1.0, 1.0]: blk(Vector3(-1.15, 0, e * 0.44 - 0.03), Vector3(1.15, 0.06, e * 0.44 + 0.03), "shade", bridge)
	cyl(PIV + Vector3(0, -2.45, 0), 0.24, 0.22, 2.25, pal("stone"), 24); cyl(PIV + Vector3(0, -2.45, 0), 0.3, 0.3, 2.45 + WATER + 0.06, pal("shade"), 24); cyl(PIV + Vector3(0, -0.32, 0), 0.24, 0.34, 0.14, pal("shade"), 24)
	slab(-6.6, -5.6, -4.8, -4.6, 0.0); pier(-5.7, -5.1, -0.18, 0.6)
	# ---- E. the lamp island and the water that falls back to its own spring
	slab(-9.0, -7.0, -6.6, -3.8, 0.0); under(-9.0, -7.0, -6.6, -3.8)
	tiles(-9.0, -7.0, -6.6, -3.8, 0.8); meander(-8.85, -6.8, -6.75, -3.95)
	blk(Vector3(-8.45, 0, -7.0), Vector3(-7.15, 1.15, -6.9), "stone"); cornice(-8.45, -7.0, -7.15, -6.9, 1.15, 0.03, 0.05)
	win_z(LAMP0.x, 0.2, -6.9, 0.5, 0.8, "teal")
	for cx in [-8.5, -7.1]:
		column(Vector3(cx, 0, -6.9), 1.7, 0.085)
		ball(Vector3(cx, 1.84, -6.9), 0.07, pal("crim"))
	cyl(Vector3(LAMP0.x, 0, LAMP0.z), 0.2, 0.15, 0.12, pal("shade"), 28)
	tree(Vector3(-6.95, 0, -6.6), 1.0, "leaf3"); lantern(Vector3(-8.85, 0, -6.8), 4)
	pool(-8.42, -5.2, -7.74, -4.5)
	strip(-9.0, -5.18, -8.42, -5.04, Vector2(1.2, 0))
	slab(-12.0, -5.9, -9.0, -5.0, 0.0); slab(-12.0, -9.4, -11.1, -5.9, 0.0)
	pier(-10.0, -5.45, -0.18, 0.5); pier(-11.55, -5.45, -0.18, 0.6); pier(-11.55, -7.0, -0.18, 0.5)
	strip(-11.3, -5.18, -9.0, -5.04, Vector2(1.2, 0)); strip(-11.3, -7.67, -11.16, -5.04, Vector2(0, 1.2))
	strip(-11.3, -8.03, -11.1, -7.67, Vector2(0, 1.2))
	blk(Vector3(-11.1, -0.2, -8.05), Vector3(-11.04, 0.02, -7.65), "shade")
	fall(-8.085, -4.85, 0.02, 1.5); fall(-11.085, -7.85, -1.5, 0.0)
	# ---- F. the mirror garden
	slab(-14.2, -13.0, -9.4, -9.4, 0.0); under(-14.2, -13.0, -9.4, -9.4)
	tiles(-13.1, -12.6, -9.4, -9.4, 0.8); rosette(Vector3(-11.8, 0, -10.6), 0.8); meander(-13.0, -12.5, -10.4, -9.5)
	var w1 := CSGBox3D.new(); w1.size = Vector3(1.1, 3.0, 1.9); w1.position = Vector3(MX - 0.55, 1.5, MZ); w1.material = pal("stone")
	var n1 := CSGBox3D.new(); n1.operation = CSGShape3D.OPERATION_SUBTRACTION; n1.size = Vector3(1.0, 2.2, 1.2)
	n1.position = Vector3(0.06, -0.4, 0.0); n1.material = pal("teal"); w1.add_child(n1); add_child(w1)
	cornice(MX - 1.1, MZ - 0.95, MX, MZ + 0.95, 3.0); crenels(Vector3(MX, 3.06, MZ - 0.85), Vector3(MX, 3.06, MZ + 0.87), 0.287)
	for fz in [MZ - 0.64, MZ + 0.6]: blk(Vector3(MX - 0.02, 0, fz), Vector3(MX + 0.03, 2.24, fz + 0.04), "gold")
	blk(Vector3(MX - 0.02, 2.2, MZ - 0.64), Vector3(MX + 0.03, 2.24, MZ + 0.64), "gold")
	var gq := QuadMesh.new(); gq.size = Vector2(1.2, 2.2)
	prim(gq, Vector3(MX - 0.012, 1.1, MZ), mat(Color(0.62, 0.86, 0.92, 0.09))).rotation.y = PI * 0.5
	blk(Vector3(MX, 0, MZ + 0.95), Vector3(MX + 0.0, 0.0, MZ + 0.95), "stone")
	blk(Vector3(MX - 1.1, 0, -13.0), Vector3(MX, 2.2, MZ - 0.95), "stone"); blk(Vector3(MX - 1.1, 0, MZ + 0.95), Vector3(MX, 1.2, -9.4), "stone")
	cornice(MX - 1.1, MZ + 0.95, MX, -9.4, 1.2, 0.03, 0.05); bush(Vector3(MX - 0.5, 1.2, -9.9), 1.1); bush(Vector3(MX - 0.55, 1.2, -9.55), 0.9, "leaf3")
	var rq := QuadMesh.new(); rq.size = Vector2(2.4, 2.4)
	ripple = prim(rq, Vector3.ZERO, ring_mat(Vector3(1.0, 0.36, 0.40))); ripple.rotation.y = PI * 0.5
	var w2 := CSGBox3D.new(); w2.size = Vector3(3.7, 2.7, 0.4); w2.position = Vector3(-11.25, 1.35, -12.8); w2.material = pal("stone")
	var d1 := CSGBox3D.new(); d1.operation = CSGShape3D.OPERATION_SUBTRACTION; d1.size = Vector3(0.9, 1.6, 0.6)
	d1.position = Vector3(DX + 11.25, -0.55, 0); d1.material = pal("shade"); w2.add_child(d1)
	var d2 := CSGCylinder3D.new(); d2.operation = CSGShape3D.OPERATION_SUBTRACTION; d2.radius = 0.45; d2.height = 0.6; d2.sides = 32
	d2.rotation.x = PI * 0.5; d2.position = Vector3(DX + 11.25, 0.25, 0); d2.material = pal("shade"); w2.add_child(d2)
	add_child(w2)
	cornice(-13.1, -13.0, -9.4, -12.6, 2.7); crenels(Vector3(-12.95, 2.76, -12.63), Vector3(-9.5, 2.76, -12.63), 0.3136)
	blk(Vector3(DX - 0.47, 0, -12.99), Vector3(DX + 0.47, 2.1, -12.98), "cream")
	door = blk(Vector3(DX - 0.47, 0, -12.84), Vector3(DX + 0.47, 2.1, -12.76), "crim"); door.name = "Door"
	banner(Vector3(-10.5, 2.25, -12.585), 0.34, 1.15); banner(Vector3(-13.0, 2.25, -12.585)+Vector3(0.45,0,0), 0.34, 1.15)
	pool(-10.25, -12.0, -9.65, -10.0); lantern(Vector3(-10.4, 0, -9.52), 5)
	for lp in [Vector3(-10.0, 0.016, -11.5), Vector3(-9.85, 0.016, -10.6), Vector3(-10.1, 0.016, -10.3)]:
		cyl(lp, 0.09, 0.09, 0.004, pal("leaf2"), 14); ball(lp + Vector3(0.02, 0.02, 0), 0.025, pal("leaf3"))
	blk(Vector3(MX + 0.1, 0, MZ - 0.45), Vector3(MX + 0.95, 0.004, MZ + 0.45), "shade")
	blk(Vector3(MX + 0.15, 0, MZ - 0.4), Vector3(MX + 0.9, 0.006, MZ + 0.4), "stone")
	blk(Vector3(DX - 0.03, 0, -12.6), Vector3(DX + 0.03, 0.005, -11.4), "crim")
	# beyond the door: a bed of trees whose crowns show over the wall
	slab(-14.2, -14.6, -9.4, -13.0, 0.0, "sand"); under(-14.2, -14.6, -9.4, -13.0, 0.22, "sand")
	tree(Vector3(-13.3, 0, -13.7), 1.5); tree(Vector3(-10.4, 0, -13.75), 1.35, "leaf3"); tree(Vector3(-9.8, 0, -13.5), 1.0)
	# ---- our marble: strange heads on plinths, veiled statues, a colossus in the sea, ruins in the water
	for f in [["kit_face2", Vector3(-2.2, 0, 0.95), PI * 0.5], ["kit_face3", Vector3(-2.2, 0, 1.85), PI * 0.5],
			["kit_face6", Vector3(-1.2, 0, -6.08), 0.3], ["kit_face4", Vector3(1.45, 0, -6.08), -0.3],
			["kit_face1", Vector3(-6.85, 0, -4.0), 0.5], ["kit_face5", Vector3(-10.5, 0, -9.5), 0.9]]:
		var fp: Vector3 = f[1]
		blk(fp + Vector3(-0.19, 0, -0.19), fp + Vector3(0.19, 0.72, 0.19), "stone")
		blk(fp + Vector3(-0.23, 0, -0.23), fp + Vector3(0.23, 0.08, 0.23), "shade"); blk(fp + Vector3(-0.23, 0.72, -0.23), fp + Vector3(0.23, 0.78, 0.23), "shade")
		model(f[0], fp + Vector3(0, 0.78, 0), 0.62, f[2])
		decal(fp + Vector3(0.12, 0, -0.12), 0.9, 0.7, 0.2, 0.78)
	model("colossus_head_veiled", Vector3(5.9, WATER - 1.15, 0.7), 4.9, 0.25, Vector3(0.06, 0, 0.1))
	for sp in [["statue_veiled_unfinished", Vector3(-8.72, 0, -4.02), 1.5, 0.8], ["statue_veiled_mourning", Vector3(-12.85, 0, -9.72), 1.8, 0.8], ["statue_veiled_praying", Vector3(-10.9, 0, -12.36), 1.8, 0.2]]:
		cyl(sp[1], 0.32, 0.3, 0.07, pal("shade"), 20); cyl(sp[1] + Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone"), 20)
		model(sp[0], sp[1] + Vector3(0, 0.17, 0), sp[2], sp[3])
	model("statue_veiled_bust", Vector3(-12.9, 0.78, -12.36), 0.8, 0.3)
	blk(Vector3(-13.08, 0, -12.54), Vector3(-12.72, 0.78, -12.18), "stone")
	model("statue_veiled_kneeling", Vector3(-10.44, 0, -11.3), 1.1, PI * 0.5)
	slab(-6.4, -8.4, -5.0, -7.0, 0.0); under(-6.4, -8.4, -5.0, -7.0, 0.2, "sand")
	model("statue_veiled_broken", Vector3(-5.7, 0, -7.7), 2.0, 0.6)
	model("observer_veiled", Vector3(-7.5, WATER - 1.2, -19.5), 11.0, 0.75)
	model("kit_face5", Vector3(-18.2, WATER - 1.15, -8.2), 4.6, 1.1, Vector3(0.2, 0, -0.15))
	model("kit_face2", Vector3(3.4, WATER - 1.15, -9.6), 4.1, 0.5, Vector3(-0.15, 0, 0.12))
	model("pediment_fragment", Vector3(3.4, WATER - 0.35, 5.4), 1.3, 0.5, Vector3(0.1, 0, 0.06))
	model("column_stump", Vector3(-3.0, WATER - 0.3, -2.6), 1.5, 0.3); model("column_stump", Vector3(-4.6, WATER - 0.5, -2.2), 1.3, 1.3, Vector3(0.12, 0, 0))
	model("column_fallen", Vector3(-9.6, WATER - 0.2, -2.4), 0.9, 0.9)
	for cp in [Vector3(4.2, 0, -3.4), Vector3(5.0, 0, -4.4), Vector3(-15.6, 0, -6.2), Vector3(-2.2, 0, -10.4), Vector3(-3.1, 0, -11.2), Vector3(-14.4, 0, -1.6)]:
		cyl(Vector3(cp.x, -2.45, cp.z), 0.3, 0.3, 2.45 + WATER + 0.12, pal("shade"), 20)
		column(Vector3(cp.x, WATER + 0.12, cp.z), 2.6 + 0.9 * sin(cp.x * 3.0), 0.19, int(absf(cp.x * 10.0)) % 2 == 0)
		foam(cp.x - 0.3, cp.z - 0.3, cp.x + 0.3, cp.z + 0.3, 0.3)
	# ---- small life: steps to the water and her boat, urns, cypresses, vines, a colonnade
	for i in 5:
		blk(Vector3(-0.7, -0.26 * (i + 1) - 0.2, 3.2 + 0.26 * i), Vector3(0.7, -0.26 * (i + 1), 3.2 + 0.26 * (i + 1)), "stone")
	blk(Vector3(-0.85, -2.45, 3.2), Vector3(-0.7, -0.05, 4.5), "shade"); blk(Vector3(0.7, -2.45, 3.2), Vector3(0.85, -0.05, 4.5), "shade")
	foam(-0.85, 3.25, 0.85, 4.5, 0.3)
	boat = Node3D.new(); boat.name = "Boat"; boat.position = Vector3(1.75, WATER, 4.25); boat.rotation.y = 0.5; add_child(boat)
	var hull := SphereMesh.new(); hull.radius = 1.0; hull.height = 1.0; hull.is_hemisphere = true; hull.radial_segments = 8; hull.rings = 3
	var hm := prim(hull, Vector3(0, 0.3, 0), pal("wood", "flat"), boat); hm.scale = Vector3(0.36, 0.36, 1.0); hm.rotation.x = PI
	var deck := cyl(Vector3(0, 0.22, 0), 1.0, 1.0, 0.012, pal("trunk"), 8, boat); deck.scale = Vector3(0.33, 1, 0.93)
	var rim := cyl(Vector3(0, 0.285, 0), 1.0, 1.0, 0.03, pal("crim"), 8, boat); rim.scale = Vector3(0.375, 1, 1.02)
	var rim2 := cyl(Vector3(0, 0.29, 0), 1.0, 1.0, 0.03, pal("trunk"), 8, boat); rim2.scale = Vector3(0.33, 1, 0.95)
	blk(Vector3(-0.3, 0.26, -0.08), Vector3(0.3, 0.3, 0.08), "wood", boat)
	cyl(Vector3(1.0, -0.2, 3.9), 0.045, 0.045, 0.75, pal("wood"), 8)
	for u in [[Vector3(1.95, 0, 2.95), 1.0, "terra"], [Vector3(1.72, 0, 3.0), 0.7, "rose"], [Vector3(-1.2, 0, -6.1), 0.9, "terra"], [Vector3(1.2, 0, -6.12), 0.75, "terra"],
			[Vector3(-8.8, 0, -6.4), 1.0, "terra"], [Vector3(-8.62, 0, -6.62), 0.7, "rose"], [Vector3(-10.6, 0, -12.35), 1.0, "terra"], [Vector3(-12.2, 0, -9.6), 0.8, "rose"]]:
		urn(u[0], u[1], u[2])
	cypress(Vector3(-2.3, 0, -1.15), 2.4); cypress(Vector3(1.55, 0, -6.15), 2.0); cypress(Vector3(-13.6, 0, -9.7) + Vector3(0, 1.2, 0), 2.2)
	cypress(Vector3(-11.9, 0, -13.9), 2.9); cypress(Vector3(-12.6, 0, -14.2), 2.3)
	vine(-2.2, 3.22, true, 1.3); vine(2.22, 1.9, false, 1.0); vine(-1.2, -3.58, true, 1.4); vine(-6.58, -6.6, false, 1.2); vine(-13.4, -9.38, true, 2.2); vine(-9.38, -12.4, false, 1.6)
	slab(-4.2, 0.6, -3.2, 3.0, 0.0); under(-4.2, 0.6, -3.2, 3.0, 0.18, "sand")
	for cz in [0.95, 1.8, 2.65]:
		column(Vector3(-3.7, 0, cz), 2.3, 0.14)
	blk(Vector3(-3.92, 2.35, 0.7), Vector3(-3.48, 2.55, 2.9), "stone"); cornice(-3.92, 0.7, -3.48, 2.9, 2.55, 0.04, 0.06); dentils(-3.92, 0.7, -3.48, 2.9, 2.35)
	# door furniture
	for py in [0.25, 1.15]:
		for px in [-0.36, 0.04]:
			blk(Vector3(DX + px, py, -12.755), Vector3(DX + px + 0.32, py + 0.7, -12.745), "crim2")
	var rg := TorusMesh.new(); rg.inner_radius = 0.045; rg.outer_radius = 0.065
	prim(rg, Vector3(DX + 0.3, 1.0, -12.74), pal("gold")).rotation.x = PI * 0.5
	# drifting mist
	for mp in [Vector3(4.5, WATER + 0.3, 6.5), Vector3(-9.0, WATER + 0.3, 1.5), Vector3(-17.0, WATER + 0.4, -5.0), Vector3(4.0, WATER + 0.3, -8.0),
			Vector3(-4.0, WATER + 0.4, -14.0), Vector3(-17.5, WATER + 0.3, -13.5), Vector3(-1.0, WATER + 0.2, 7.5), Vector3(-12.0, WATER + 0.3, 0.5)]:
		var mh := halo(8.0 + 2.0 * sin(mp.x), Color(MIST.r, MIST.g, MIST.b, 0.34))
		(mh.material_override as StandardMaterial3D).blend_mode = BaseMaterial3D.BLEND_MODE_MIX
		mh.position = mp; add_child(mh)
	for mi in find_children("*", "GeometryInstance3D", true, false):
		(mi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _actors() -> void:
	var veil := cloth(Color("f1f1f4"), Color("dcdce4"))
	var face := ShaderMaterial.new(); face.shader = shaders["face"]; timed.append(face)
	fig = Fig.new(); add_child(fig); fig.build(0, pal, veil, face)
	var wm := Node3D.new(); wm.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * WATER, 0)); add_child(wm)
	wfig = Fig.new(); wm.add_child(wfig); wfig.build(2, pal, veil, face)
	var mir := Node3D.new()
	mir.transform = Transform3D(Basis(Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1)), Vector3(2.0 * MX, 0, 0))
	add_child(mir)
	ghost = Fig.new(); mir.add_child(ghost); ghost.build(1, pal, veil, face)
	var bq := QuadMesh.new(); bq.size = Vector2(0.95, 0.95); bq.orientation = PlaneMesh.FACE_Y
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	g.colors = PackedColorArray([Color(0.2, 0.17, 0.33, 0.36), Color(0.2, 0.17, 0.33, 0.2), Color(0.2, 0.17, 0.33, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 96; gt.height = 96
	var bmt := StandardMaterial3D.new(); bmt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; bmt.albedo_texture = gt
	bmt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	blob = prim(bq, Vector3.ZERO, bmt)
	var pq := QuadMesh.new(); pq.size = Vector2(7, 7); pq.orientation = PlaneMesh.FACE_Y
	pulse = prim(pq, Vector3.ZERO, ring_mat(Vector3(1.0, 0.8, 0.45)))
	var tq := QuadMesh.new(); tq.size = Vector2(1.1, 1.1); tq.orientation = PlaneMesh.FACE_Y
	tapring = prim(tq, Vector3.ZERO, ring_mat(Vector3(1.0, 0.9, 0.7)))
	lamp = Node3D.new(); add_child(lamp); lamp.position = LAMP0
	ball(Vector3.ZERO, 0.055, mat(Color("ffd98a")), lamp)
	cyl(Vector3(0, 0.055, 0), 0.07, 0.01, 0.055, pal("gold"), 16, lamp); cyl(Vector3(0, -0.082, 0), 0.04, 0.055, 0.028, pal("gold"), 16, lamp)
	var ring := TorusMesh.new(); ring.inner_radius = 0.02; ring.outer_radius = 0.031
	prim(ring, Vector3(0, 0.14, 0), pal("gold"), lamp).rotation.x = PI * 0.5
	lamp_halo = halo(1.0, Color(1.0, 0.78, 0.42, 0.55)); lamp.add_child(lamp_halo)
	door_halo = halo(3.2, Color(1.0, 0.86, 0.6, 0.5)); door_halo.position = Vector3(DX, 1.0, -12.7); add_child(door_halo)
	for i in 3:
		var gn := Node3D.new(); add_child(gn)
		for sgn in [-1.0, 1.0]:
			var wq := QuadMesh.new(); wq.size = Vector2(0.3, 0.09)
			var wn2 := Node3D.new(); gn.add_child(wn2)
			prim(wq, Vector3(sgn * 0.15, 0, 0), mat(Color(0.98, 0.97, 0.95)), wn2).rotation.x = -PI * 0.5
		gulls.append(gn)
	# things to tap
	objs["capstan"] = {"at": CAP + Vector3(0, 0.9, 0), "stand": CAP + Vector3(0, 0, 0.66)}
	objs["lamp"] = {"at": LAMP0 + Vector3(0, 0.1, 0), "stand": Vector3(LAMP0.x, 0, LAMP0.z + 0.45)}
	objs["mirror"] = {"at": Vector3(MX, 1.2, MZ), "stand": Vector3(MX + 0.52, 0, MZ)}
	for k in objs:
		var n := Node3D.new(); add_child(n); n.position = objs[k].at + Vector3(0, 0.55 if k != "mirror" else 1.35, 0)
		var d := blk(Vector3(-0.05, -0.05, -0.05), Vector3(0.05, 0.05, 0.05), "crim", n)
		d.material_override = mat(Color("ff5a62")); d.rotation = Vector3(0.6155, PI * 0.25, 0)
		var h := halo(0.5, Color(1.0, 0.4, 0.42, 0.5)); n.add_child(h)
		markers[k] = n

func _nav() -> void:
	for r in [["A", -1.9, -0.7, 1.9, 2.9], ["S", 1.9, 0.75, 3.1, 1.35], ["B", -0.2, -3.9, 0.2, -0.7], ["C", -1.3, -6.0, 1.5, -3.9],
			["Cw", -2.4, -5.3, -1.3, -4.9], ["BR", -4.8, -5.3, -2.4, -4.9], ["D", -6.9, -5.3, -4.8, -4.9], ["E", -8.7, -6.3, -6.9, -4.1],
			["P1", -11.75, -5.65, -8.7, -5.45], ["P2", -11.75, -9.6, -11.6, -5.45], ["F", -12.6, -12.2, -10.6, -9.6], ["G", -12.2, -14.1, -11.8, -12.2]]:
		rects[r[0]] = {"x0": r[1], "z0": r[2], "x1": r[3], "z1": r[4], "on": true}
	rects["BR"].on = false; rects["G"].on = false

func in_rect(r: Dictionary, p: Vector3, m := 0.0) -> bool:
	return p.x >= r.x0 - m and p.x <= r.x1 + m and p.z >= r.z0 - m and p.z <= r.z1 + m

func rect_of(p: Vector3) -> String:
	for m in [0.0, 0.12, 0.4]:
		for n in rects:
			if rects[n].on and in_rect(rects[n], p, m): return n
	return ""

func portal(a: Dictionary, b: Dictionary):
	var x0 := maxf(a.x0, b.x0); var x1 := minf(a.x1, b.x1); var z0 := maxf(a.z0, b.z0); var z1 := minf(a.z1, b.z1)
	if x1 - x0 < -0.02 or z1 - z0 < -0.02: return null
	if maxf(x1 - x0, z1 - z0) < 0.1: return null
	return [x0, z0, maxf(x1, x0), maxf(z1, z0)]

func find_path(from: Vector3, to: Vector3) -> Array:
	var a := rect_of(from); var b := rect_of(to)
	if a == "" or b == "": return []
	var prev := {a: ""}
	var q := [a]
	while not q.is_empty() and not prev.has(b):
		var c: String = q.pop_front()
		for n in rects:
			if rects[n].on and not prev.has(n) and portal(rects[c], rects[n]) != null:
				prev[n] = c; q.append(n)
	if not prev.has(b): return []
	var chain := [b]
	while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
	var pts := []
	var cur := from
	for i in range(chain.size() - 1):
		var pr: Array = portal(rects[chain[i]], rects[chain[i + 1]])
		var mid := cur.lerp(to, 0.5)
		var pt := Vector3(clampf(mid.x, pr[0], pr[2]), 0, clampf(mid.z, pr[1], pr[3]))
		pts.append(pt); cur = pt
	pts.append(Vector3(to.x, 0, to.z))
	return pts

func _ui() -> void:
	var cl := CanvasLayer.new(); add_child(cl)
	var vg := Gradient.new(); vg.offsets = PackedFloat32Array([0.0, 0.62, 1.0])
	vg.colors = PackedColorArray([Color(0.05, 0.06, 0.14, 0), Color(0.05, 0.06, 0.14, 0), Color(0.05, 0.06, 0.14, 0.3)])
	var vt := GradientTexture2D.new(); vt.gradient = vg; vt.fill = GradientTexture2D.FILL_RADIAL
	vt.fill_from = Vector2(0.5, 0.5); vt.fill_to = Vector2(1.05, 0.5); vt.width = 128; vt.height = 128
	var vr := TextureRect.new(); vr.texture = vt; vr.stretch_mode = TextureRect.STRETCH_SCALE; vr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vr.set_anchors_preset(Control.PRESET_FULL_RECT); vr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(vr)
	for i in 3:
		var rg2 := Gradient.new(); rg2.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
		rg2.colors = PackedColorArray([Color(1, 0.93, 0.78, 0), Color(1, 0.93, 0.78, 0.085 - 0.015 * i), Color(1, 0.93, 0.78, 0)])
		var rt := GradientTexture2D.new(); rt.gradient = rg2; rt.fill_from = Vector2(0, 0); rt.fill_to = Vector2(1, 0); rt.width = 64; rt.height = 8
		var ray := TextureRect.new(); ray.texture = rt; ray.stretch_mode = TextureRect.STRETCH_SCALE; ray.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ray.size = Vector2(190 + 70 * i, 2600); ray.position = Vector2(430 - 250 * i, -500); ray.rotation = 0.42
		var cm := CanvasItemMaterial.new(); cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; ray.material = cm
		ray.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(ray)
	hint = Label.new(); hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.add_theme_font_size_override("font_size", 24); hint.add_theme_color_override("font_color", Color(0.24, 0.16, 0.22, 0.9))
	hint.anchor_left = 0; hint.anchor_right = 1; hint.anchor_top = 1; hint.anchor_bottom = 1; hint.offset_top = -92; hint.offset_bottom = -52
	hint.mouse_filter = Control.MOUSE_FILTER_IGNORE; hint.modulate.a = 0.0; cl.add_child(hint)
	title_box = _card("EIDOLON", "demo  ·  πάτα για να ξεκινήσεις", cl)
	end_box = _card("EIDOLON", "τέλος του demo  ·  πάτα για ξανά", cl); end_box.modulate.a = 0.0; end_box.visible = false

func _card(big: String, small: String, cl: CanvasLayer) -> Control:
	var c := Control.new(); c.set_anchors_preset(Control.PRESET_FULL_RECT); c.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(c)
	var bg := ColorRect.new(); bg.color = Color(0.09, 0.12, 0.25, 0.5); bg.set_anchors_preset(Control.PRESET_FULL_RECT); bg.mouse_filter = Control.MOUSE_FILTER_IGNORE; c.add_child(bg)
	var a := Label.new(); a.text = big; a.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	a.add_theme_font_size_override("font_size", 76); a.add_theme_color_override("font_color", Color(0.98, 0.95, 0.88))
	a.anchor_left = 0; a.anchor_right = 1; a.anchor_top = 0.33; a.anchor_bottom = 0.33; a.offset_bottom = 110; c.add_child(a)
	var ln := ColorRect.new(); ln.color = Color("dc3d46"); ln.anchor_left = 0.5; ln.anchor_right = 0.5; ln.anchor_top = 0.33; ln.anchor_bottom = 0.33
	ln.offset_left = -60; ln.offset_right = 60; ln.offset_top = 118; ln.offset_bottom = 121; c.add_child(ln)
	var b := Label.new(); b.text = small; b.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_theme_font_size_override("font_size", 24); b.add_theme_color_override("font_color", Color(0.98, 0.92, 0.84, 0.9))
	b.anchor_left = 0; b.anchor_right = 1; b.anchor_top = 0.33; b.anchor_bottom = 0.33; b.offset_top = 140; b.offset_bottom = 180; c.add_child(b)
	return c

func say(s: String) -> void:
	hint.text = s
	var tw2 := create_tween(); tw2.tween_property(hint, "modulate:a", 1.0, 0.4); tw2.tween_interval(3.2); tw2.tween_property(hint, "modulate:a", 0.0, 0.8)

# ---------------------------------------------------------------- input
func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch and ev.pressed: tap(ev.position)

func tap(sp: Vector2) -> void:
	if ended:
		if end_box.modulate.a > 0.9: get_tree().reload_current_scene()
		return
	if not started:
		started = true
		var tw2 := create_tween(); tw2.tween_property(title_box, "modulate:a", 0.0, 0.7); tw2.tween_callback(title_box.hide)
		say("πάτα στο έδαφος για να περπατήσεις")
		return
	if busy: return
	var px := get_viewport().get_visible_rect().size.x / 720.0
	for k in objs:
		if done.has(k): continue
		if cam.unproject_position(objs[k].at).distance_to(sp) < 70.0 * px or cam.unproject_position(markers[k].position).distance_to(sp) < 60.0 * px:
			use(k); return
	if cam.unproject_position(pos + Vector3(0, 0.9, 0)).distance_to(sp) < 62.0 * px:
		_self(); return
	var o := cam.project_ray_origin(sp); var d := cam.project_ray_normal(sp)
	var g := o + d * (-o.y / d.y)
	var best := ""; var bp := Vector3.ZERO; var bd := 1e9
	for n in rects:
		var r: Dictionary = rects[n]
		if not r.on: continue
		var c := Vector3(clampf(g.x, r.x0, r.x1), 0, clampf(g.z, r.z0, r.z1))
		var dd := cam.unproject_position(c).distance_to(sp)
		if dd < bd: bd = dd; best = n; bp = c
	if best == "" or bd > 150.0 * px: return
	var run := (t - last_tap) < 0.38
	last_tap = t
	pending = ""
	walk_to(bp, 2.7 if run else WALK)
	tapring.position = bp + Vector3(0, 0.02, 0); tap_p = 0.0

func walk_to(p: Vector3, cap := WALK) -> bool:
	var pts := find_path(pos, p)
	if pts.is_empty(): return false
	speed_cap = cap; face_to = null
	route.clear()
	for q in pts: route.append({"p": q})
	return true

func use(k: String) -> void:
	if not walk_to(objs[k].stand):
		say("δεν υπάρχει δρόμος ακόμα"); return
	pending = k

func _arrive() -> void:
	arrived.emit()
	if busy: return
	if pending != "":
		var k := pending; pending = ""
		busy = true
		await call("_do_" + k)
		busy = false
	settled.emit()

# ---------------------------------------------------------------- frame
func _process(dt: float) -> void:
	t += dt
	var target := 0.0
	var want_yaw := yaw
	if not route.is_empty():
		var p3: Vector3 = route[0].p
		var to := Vector3(p3.x - pos.x, 0, p3.z - pos.z)
		var left := to.length()
		for i in range(1, mini(route.size(), 5)): left += Vector2(route[i].p.x - route[i - 1].p.x, route[i].p.z - route[i - 1].p.z).length()
		target = minf(speed_cap, sqrt(2.0 * 2.6 * left) + 0.04)
		if to.length() > 0.02: want_yaw = atan2(to.x, to.z)
		target *= clampf(1.25 - absf(angle_difference(yaw, want_yaw)) * 0.8, 0.25, 1.0)
		spd = move_toward(spd, target, (3.2 if speed_cap <= WALK else 5.0) * dt)
		var step := spd * dt
		if step >= to.length():
			pos.x = p3.x; pos.z = p3.z
			route.pop_front()
			if route.is_empty(): spd = 0.0; _arrive()
		else:
			var d := to.normalized(); pos.x += d.x * step; pos.z += d.z * step
		vel = Vector3(sin(yaw), 0, cos(yaw)) * spd
	else:
		spd = move_toward(spd, 0.0, 6.0 * dt); vel = Vector3.ZERO
		if face_to != null:
			want_yaw = atan2(face_to.x - pos.x, face_to.z - pos.z)
			if absf(angle_difference(yaw, want_yaw)) < 0.02: face_to = null; faced.emit()
	yaw = lerp_angle(yaw, want_yaw, 1.0 - exp(-8.0 * dt))
	var wk := clampf(spd / WALK, 0.0, 1.0)
	var rk := clampf((spd - WALK) / 1.2, 0.0, 1.0)
	phase += spd * dt / lerpf(0.60, 0.92, rk) * PI
	if pushing:
		var ph := atan2(pos.x - CAP.x, pos.z - CAP.z)
		var th := ph - 0.42
		cap_rot.rotation.y = th
		bridge.rotation.y = PI * 0.5 * (1.0 - smoothstep(0.0, 1.0, clampf(-ph / (PI * 0.5), 0.0, 1.0)))
		var dir := Vector3(sin(th), 0, cos(th))
		tgtR = CAP + Vector3(0, 0.98, 0) + dir * 0.5; tgtL = CAP + Vector3(0, 0.98, 0) + dir * 0.74
	var lv := Vector2(vel.x * cos(yaw) - vel.z * sin(yaw), vel.x * sin(yaw) + vel.z * cos(yaw))
	sway_v += ((-lv * 0.105 - sway) * 60.0 - sway_v * 7.0) * dt
	sway += sway_v * dt
	var hy := a_hy
	if look_at_pt != null: hy += clampf(angle_difference(yaw, atan2(look_at_pt.x - pos.x, look_at_pt.z - pos.z)), -1.0, 1.0)
	head_yaw = lerpf(head_yaw, hy, 1.0 - exp(-5.0 * dt))
	var breath := sin(t * 1.7)
	var st := {
		"pos": pos, "yaw": yaw, "dt": dt, "phase": phase, "wk": wk,
		"wind": Vector3(0.10 + 0.07 * sin(t * 0.7), 0, -0.05 + 0.05 * sin(t * 1.1 + 1.0)) - vel * 0.16,
		"bob": 0.02 * (wk + 0.9 * rk) * (0.5 - 0.5 * cos(2.0 * phase)) + 0.004 * breath * (1.0 - wk),
		"drop": a_drop, "lean": 0.07 * wk + 0.14 * rk + a_lean + 0.008 * breath,
		"roll": 0.026 * wk * sin(phase) + 0.01 * sin(t * 0.8) * (1.0 - wk), "twist": (0.07 + 0.05 * rk) * wk * sin(phase) + head_yaw * 0.18,
		"sway": sway, "pool": a_pool, "kick": wk * sin(phase),
		"head_yaw": head_yaw * 0.82, "head_pitch": a_headp + 0.03 * wk,
		"swingL": (0.12 + 0.1 * rk) * wk * sin(phase) * (1.0 - a_wL), "swingR": -(0.12 + 0.1 * rk) * wk * sin(phase),
		"hold": a_hold, "raise": a_raise, "open": a_open, "wL": a_wL, "wR": a_wR, "tL": tgtL, "tR": tgtR,
	}
	fig.apply(st); wfig.apply(st)
	for k in ["Bridge", "Cap", "Door", "Boat"]: (refl.get_node(k) as Node3D).transform = (world.get_node(k) as Node3D).transform
	var near := smoothstep(-10.9, -11.6, pos.x) * smoothstep(MZ - 0.8, MZ - 0.5, pos.z) * smoothstep(MZ + 0.8, MZ + 0.5, pos.z)
	ghost.visible = near > 0.01
	if ghost.visible: ghost.apply(st)
	var prox := clampf(1.0 - (pos.x - MX - 0.5) / 1.4, 0.0, 1.0)
	flash = move_toward(flash, 0.0, dt * 0.7)
	ghost.ghost_mat.albedo_color = TEAL_D.lerp(CRIMSON, near * (0.3 + 0.7 * prox)).lerp(Color("ff5a62"), flash)
	ripple_p = move_toward(ripple_p, 1.0, dt * 0.75); (ripple.material_override as ShaderMaterial).set_shader_parameter("p", ripple_p)
	pulse_p = move_toward(pulse_p, 1.0, dt * 0.6); (pulse.material_override as ShaderMaterial).set_shader_parameter("p", pulse_p)
	tap_p = move_toward(tap_p, 1.0, dt * 1.6); (tapring.material_override as ShaderMaterial).set_shader_parameter("p", tap_p)
	if lamp_held:
		lamp_vel += ((-vel * 0.045 - lamp_off) * 40.0 - lamp_vel * 4.0) * dt
		lamp_off += lamp_vel * dt
		lamp.position = fig.hand_pos("R") + Vector3(0, -0.175, 0) + lamp_off
	var le := lamp_energy * (1.0 + 0.03 * sin(t * 9.0))
	lamp_halo.scale = Vector3.ONE * (0.35 + le * 1.5)
	door_halo.scale = Vector3.ONE * door_energy; door_halo.visible = door_energy > 0.01
	lights[0] = Vector4(lamp.position.x, lamp.position.y, lamp.position.z, le)
	lights[1] = Vector4(DX, 0.8, -12.5, door_energy)
	var cc := cam_t if shot == null else (shot.c as Vector3)
	for m in pmats.values():
		for i in 6: m.set_shader_parameter("l%d" % i, lights[i])
		m.set_shader_parameter("centre", cc); m.set_shader_parameter("mist_r", cam.size * 0.64)
	sea_mat.set_shader_parameter("centre", cc); sea_mat.set_shader_parameter("mist_r", cam.size * 0.64); sea_mat.set_shader_parameter("time_s", t)
	for m in timed: m.set_shader_parameter("time_s", t)
	for i in gulls.size():
		var gn: Node3D = gulls[i]
		var ga := t * (0.16 + 0.03 * i) + i * 2.1
		gn.position = cam_t + Vector3(cos(ga) * (4.0 + i), 3.2 + i * 0.6 + 0.3 * sin(t * 0.7 + i), sin(ga) * (3.0 + i * 0.8)) + Vector3(-1.5, 0, -1.5)
		gn.rotation.y = -ga
		var flap := sin(t * 5.0 + i) * 0.45
		(gn.get_child(0) as Node3D).rotation.z = -flap; (gn.get_child(1) as Node3D).rotation.z = flap
	boat.position.y = WATER + 0.03 * sin(t * 1.1); boat.rotation.z = 0.04 * sin(t * 0.8)
	blob.position = Vector3(pos.x, 0.012, pos.z); blob.scale = Vector3.ONE * (1.0 + a_pool * 0.6)
	for k in markers:
		var n: Node3D = markers[k]
		n.visible = started and not done.has(k) and shot == null
		n.position.y = objs[k].at.y + (0.55 if k != "mirror" else 1.35) + 0.05 * sin(t * 2.4)
		n.rotation.y = t * 1.2
	cam_t = cam_t.lerp(pos + vel * 0.55, 1.0 - exp(-2.4 * dt))
	cam.position = cam_t + cam.basis.y * (1.9 if cam.size > 5.0 else 0.85) + cam.basis.z * 50.0
	if shot != null: cam.position = (shot.c as Vector3) + cam.basis.z * 50.0
	if started and not ended and pos.z < -13.2: _end()

# ---------------------------------------------------------------- what she can do
func wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

func go(pts: Array, cap := WALK) -> void:
	speed_cap = cap
	route.clear()
	for q in pts: route.append({"p": q})
	await arrived

func face(p: Vector3) -> void:
	face_to = p
	await faced

func tw() -> Tween:
	return create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _self() -> void:
	busy = true
	if lamp_held:
		var f := tw()
		f.tween_property(self, "a_raise", 1.0, 0.6); f.tween_property(self, "a_headp", -0.22, 0.6); f.tween_property(self, "lamp_energy", 1.7, 0.8)
		await f.finished
		pulse.position = Vector3(pos.x, 0.03, pos.z); pulse_p = 0.0
		await wait(0.9)
		var g := tw()
		g.tween_property(self, "a_raise", 0.0, 0.6); g.tween_property(self, "a_headp", 0.0, 0.6); g.tween_property(self, "lamp_energy", 1.0, 0.8)
		await g.finished
	else:
		var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		h.tween_property(self, "a_hy", -0.85, 0.7); h.tween_interval(0.3)
		h.tween_property(self, "a_hy", 0.7, 0.9); h.tween_interval(0.3); h.tween_property(self, "a_hy", 0.0, 0.5)
		await h.finished
	busy = false
	settled.emit()

func _do_capstan() -> void:
	await face(CAP + Vector3(-1.4, 0, 0.66))
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
	rects["BR"].on = true; done["capstan"] = true
	say("η γέφυρα γύρισε")

func _do_lamp() -> void:
	await face(LAMP0)
	tgtR = LAMP0 + Vector3(0, 0.15, 0)
	var c := tw()
	c.tween_property(self, "a_drop", 0.55, 0.85); c.tween_property(self, "a_lean", 0.50, 0.85)
	c.tween_property(self, "a_pool", 1.0, 0.85); c.tween_property(self, "a_headp", 0.35, 0.7)
	c.tween_property(self, "a_wR", 1.0, 0.75).set_delay(0.2)
	await c.finished
	await wait(0.2)
	lamp_held = true; done["lamp"] = true
	var d := tw()
	d.tween_property(self, "lamp_energy", 1.0, 0.9)
	d.tween_property(self, "a_drop", 0.0, 0.95); d.tween_property(self, "a_lean", 0.0, 0.95)
	d.tween_property(self, "a_pool", 0.0, 0.95); d.tween_property(self, "a_headp", 0.0, 0.8)
	d.tween_property(self, "a_wR", 0.0, 0.8); d.tween_property(self, "a_hold", 1.0, 0.8)
	await d.finished
	say("πάτα πάνω της για να σηκώσει τη λάμπα")

func _do_mirror() -> void:
	await face(Vector3(MX, 0, MZ))
	if not lamp_held:
		var h := tw(); h.tween_property(self, "a_headp", -0.12, 0.5)
		await h.finished
		say("το γυαλί είναι σκοτεινό · χρειάζεται φως")
		await wait(0.8)
		var h2 := tw(); h2.tween_property(self, "a_headp", 0.0, 0.5)
		await h2.finished
		return
	var i := tw()
	i.tween_property(self, "a_drop", 0.16, 0.6); i.tween_property(self, "a_lean", 0.36, 0.6); i.tween_property(self, "a_headp", 0.3, 0.6)
	i.tween_property(self, "a_open", 1.0, 0.6); i.tween_property(self, "a_pool", 0.3, 0.6)
	await i.finished
	await wait(0.35)
	var j := tw()
	j.tween_property(self, "a_drop", 0.0, 0.6); j.tween_property(self, "a_lean", 0.0, 0.6); j.tween_property(self, "a_headp", 0.0, 0.6)
	j.tween_property(self, "a_open", 0.0, 0.6); j.tween_property(self, "a_pool", 0.0, 0.6)
	await j.finished
	tgtL = Vector3(MX + 0.012, 1.30, MZ + 0.13)
	ripple.position = Vector3(MX - 0.03, 1.30, MZ + 0.13)
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
	await m.finished
	rects["G"].on = true; done["mirror"] = true
	say("η πόρτα άνοιξε")

func _end() -> void:
	ended = true
	end_box.visible = true
	create_tween().tween_property(end_box, "modulate:a", 1.0, 1.6)

# ---------------------------------------------------------------- scripted run (for recordings and tests)
func _auto() -> void:
	get_tree().create_timer(95.0).timeout.connect(func() -> void: print("AUTO watchdog at ", pos, " busy ", busy, " pending ", pending); get_tree().quit())
	await wait(1.2)
	tap(Vector2(360, 600))
	await wait(1.0)
	await _a_walk(Vector3(-1.2, 0, 1.6))
	_self(); await settled
	await _a_walk(Vector3(3.0, 0, 1.05))
	await wait(0.5)
	await _a_use("capstan")
	await _a_use("lamp")
	await wait(0.4)
	await _a_walk(Vector3(-7.4, 0, -4.6), 2.7)
	_self(); await settled
	await _a_use("mirror")
	await wait(0.5)
	await _a_walk(Vector3(DX, 0, -14.0))
	await wait(3.0)
	print("AUTO done ended=", ended, " done=", done)
	get_tree().quit()

func _a_walk(p: Vector3, cap := WALK) -> void:
	print("AUTO walk ", p, " from ", pos, " f=", Engine.get_frames_drawn())
	if walk_to(p, cap): await settled
	else: print("AUTO no path to ", p)

func _a_use(k: String) -> void:
	print("AUTO use ", k, " f=", Engine.get_frames_drawn())
	use(k)
	if pending == k: await settled
	else: print("AUTO cannot reach ", k)
