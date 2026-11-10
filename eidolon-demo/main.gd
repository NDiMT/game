extends Node3D
## EIDOLON demo: one flat, continuous map in a clean isometric look. Tap to walk, tap things to use them.
const Fig := preload("res://fig.gd")
const WALK := 1.25
const CAP := Vector3(1.6, 0.0, -12.5)
const PIV := Vector3(-5.9, 0.0, -13.0)
const LAMP0 := Vector3(-7.8, 0.17, -6.75)
const MX := -19.4
const MZ := -23.5
const DX := -16.3
const TEAL_D := Color("13283a")
const CRIMSON := Color("b8232f")
const FOG := Color("eab99c")
const WATER := -1.3
var sea_c := Color("3c7d92")
var mist_c := Color("cdb8c6")
var water_deep := Color("2a8790")
var water_shallow := Color("79d8c6")
var bg_c := Color("2c6379")
var pals := {}
var shadow_c := Vector3(0.66, 0.66, 0.86)
var hero_style := 5
var hero_src: Node3D
var H := {}
var ghost_flat: StandardMaterial3D
var walk_on := false
var rem_dist := 0.0
var floor_mats: Array = []
var rig_norm := {}
var hero_real := false
var shape_file := ""
var rig_file := ""
var shape_cache := {}
var shape_tex: Texture2D
var SHP := {}
var body_mats: Array = []
var hover := 0.0
var tilt_f := 0.0
var tilt_r := 0.0
var yaw_prev := 0.0
var spd_prev := 0.0
var gph := 0.0
## how she walks: no forward lean, short steps, a small sway of the hips
var GT := {"lean": 0.0, "trail": 0.06, "stride": 0.9, "arm": 0.15, "step": 0.56, "shift": 0.016, "bob": 0.009, "pelv": 0.07, "shtw": 0.04}
var gait := 0.0

## arms that reach for a point and a spine that bows, on top of whatever animation is playing
class HerMod extends SkeletonModifier3D:
	var main
	func _b(sk: Skeleton3D, n: String) -> int:
		var i := sk.find_bone("mixamorig:" + n)
		return i if i >= 0 else sk.find_bone("mixamorig_" + n)
	func _process_modification() -> void:
		var sk := get_skeleton()
		if sk == null or main == null: return
		var la := _b(sk, "LeftArm"); var ra := _b(sk, "RightArm")
		if la < 0 or ra < 0: return
		var lean: float = main.a_lean
		if absf(lean) > 0.001:
			var sp := _b(sk, "Spine")
			if sp >= 0:
				var axis := (sk.get_bone_global_pose(la).origin - sk.get_bone_global_pose(ra).origin).normalized()
				var g := sk.get_bone_global_pose(sp)
				sk.set_bone_global_pose(sp, Transform3D(Basis(axis, lean * 0.9) * g.basis, g.origin))
		var inv := sk.global_transform.affine_inverse()
		for side in [["Left", main.a_wL, main.tgtL], ["Right", main.a_wR, main.tgtR]]:
			var w: float = side[1]
			if w <= 0.001: continue
			var bi := _b(sk, side[0] + "Arm"); var ci := _b(sk, side[0] + "ForeArm")
			if bi < 0 or ci < 0: continue
			var g2 := sk.get_bone_global_pose(bi); var c := sk.get_bone_global_pose(ci).origin
			var cur := (c - g2.origin).normalized(); var want := ((inv * (side[2] as Vector3)) - g2.origin).normalized()
			var q := Quaternion.IDENTITY.slerp(Quaternion(cur, want), w)
			sk.set_bone_global_pose(bi, Transform3D(Basis(q) * g2.basis, g2.origin))

var mist_k := 0.96
var fog_k := 1.0
var face_m: ShaderMaterial
var veil_m: ShaderMaterial
const PALS := {
	"_": ["ffffff", "ffffff", "ffffff"],
	"stone": ["f8efe1", "e8d5c5", "ada5c0"], "shade": ["ebdecc", "d7c1b1", "9c94b0"],
	"sand": ["f6e3c6", "e3c7a6", "a8959d"], "rose": ["f1dccf", "dcc0b2", "a892a4"],
	"far": ["cfcbd6", "bab5c9", "9896b4"], "far2": ["b4b3c9", "a3a1bf", "8a8aad"],
	"dark": ["5a5678", "4d4a6e", "44416a"], "crim": ["dc3d46", "bb2530", "7e1c31"],
	"teal": ["13283a", "13283a", "13283a"], "cream": ["fff3d2", "fff3d2", "fff3d2"],
	"gold": ["f0cf86", "d2a962", "94775a"], "trunk": ["a58a82", "8a6f6c", "63506a"],
	"leaf": ["9dbfa6", "76a08e", "4f7a7c"], "leaf2": ["b9d2b4", "8fb39a", "5f8a86"], "leaf3": ["aac3a4", "86a48c", "5d7d7c"],
	"dress": ["cdd0da", "b0b3c5", "8789a6"], "dress2": ["e4e5ea", "cacbd6", "9fa0b6"],
	"veil": ["f1f1f4", "d9d9e0", "acadc0"], "skin": ["fffbf5", "f0e5de", "bfb6d0"],
	"cyp": ["4a8576", "316863", "214858"], "terra": ["ecd6c6", "d6b8a8", "a08a9e"], "wood": ["b98f7a", "9a7064", "6c4e5e"],
	"marble": ["fffbf5", "f0e5de", "bfb6d0"], "crim2": ["ee5a60", "cf3640", "8f2238"],
}
const SH := """shader_type spatial;
render_mode ambient_light_disabled, specular_disabled;
uniform vec3 c_top : source_color; uniform vec3 c_z : source_color; uniform vec3 c_x : source_color;
uniform vec3 fog_col : source_color;
uniform vec4 l0; uniform vec4 l1; uniform vec4 l2; uniform vec4 l3; uniform vec4 l4; uniform vec4 l5;
uniform float sway = 0.0; uniform float time_s = 0.0; uniform float marble = 0.0; uniform float rim = 0.0; uniform float flat_n = 0.0; uniform vec3 shadow_col = vec3(0.66, 0.66, 0.86); uniform float mist_k = 0.96; uniform vec3 centre; uniform float mist_r = 7.0; uniform vec3 mist_col : source_color;
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
	col = mix(col, mist_col, smoothstep(mist_r * 0.8, mist_r * 1.7, md) * mist_k);
	ALBEDO = col; ROUGHNESS = 1.0;
}
void light(){
	float facing = smoothstep(0.0, 0.12, dot(NORMAL, LIGHT));
	DIFFUSE_LIGHT += mix(shadow_col, vec3(1.0), mix(1.0, ATTENUATION, facing));
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
uniform vec3 near_col : source_color; uniform vec3 far_col : source_color; uniform vec3 centre; uniform float mist_r = 7.0; uniform float time_s = 0.0; uniform float mist_k = 1.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	vec3 d3 = wp - centre; float md = length(d3 - vec3(0.57735) * dot(d3, vec3(0.57735)));
	float m = smoothstep(mist_r * 0.8, mist_r * 1.75, md) * mist_k;
	vec2 p = wp.xz * 1.1;
	float lines = smoothstep(0.93, 0.995, sin(p.x * 2.3 + sin(p.y * 1.7 + time_s * 0.45) * 1.9 + time_s * 0.2) * 0.5 + 0.5);
	float sp = smoothstep(0.985, 1.0, sin(p.x * 9.1 + time_s * 1.3) * sin(p.y * 8.3 - time_s * 1.1));
	float brk = smoothstep(0.35, 0.75, sin(p.x * 0.63 + p.y * 0.41) * sin(p.y * 0.57 - p.x * 0.29 + 1.3) * 0.5 + 0.5);
	float road = smoothstep(2.4, 0.0, abs((wp.x - wp.z) - (centre.x - centre.z) - 4.2));
	vec2 cell = floor(wp.xz * 11.0);
	float tw = fract(sin(dot(cell, vec2(12.9898, 78.233)) + floor(time_s * 2.5) * 0.37) * 43758.5453);
	float glit = step(0.93, tw) * road * smoothstep(0.38, 0.08, length(fract(wp.xz * 11.0) - 0.5));
	vec3 col = mix(near_col, far_col, m) + vec3(0.5, 0.6, 0.6) * (lines * 0.1 * brk + sp * 0.35) * (1.0 - m);
	col += (vec3(1.0, 0.93, 0.78) * glit * 0.55 + vec3(0.9, 0.8, 0.7) * road * 0.07) * (1.0 - m * 0.6);
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
const SH_FOG := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform float time_s = 0.0; uniform vec3 hero; uniform float dens = 0.5; uniform float scale = 0.05; uniform vec2 vel = vec2(0.02, 0.01);
uniform float clear_r = 0.0; uniform vec3 col : source_color; uniform float far_a = 2.0; uniform float far_b = 9.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	vec2 uv = wp.xz * scale;
	float n = texture(noise_tex, uv + vel * time_s).r * 0.62 + texture(noise_tex, uv * 2.3 - vel.yx * time_s * 1.7 + 0.37).r * 0.38;
	vec3 d3 = wp - hero; float md = length(d3 - vec3(0.57735) * dot(d3, vec3(0.57735)));
	float a = mix(0.72, 1.0, n) * dens * smoothstep(far_a, far_b, md);
	if (clear_r > 0.0) a *= smoothstep(clear_r * 0.3, clear_r, distance(wp.xz, hero.xz));
	ALBEDO = col; ALPHA = a;
}"""
const SH_SHARD := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform float time_s = 0.0; uniform float ph = 0.0;
void fragment(){ float g = pow(abs(sin(time_s * 1.7 + ph)), 6.0); ALBEDO = mix(vec3(0.70, 0.86, 0.93), vec3(1.0, 1.0, 0.98), g); }"""
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
var fogs: Array = []
var red_cloth: ShaderMaterial
var shard_mats: Array = []
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

var pos := Vector3(0.6, 0, 2.2)
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
	var m := ShaderMaterial.new(); m.shader = shaders["two" if variant in ["2", "flat2"] else "base"]
	m.set_shader_parameter("c_top", Color(pals[n][0])); m.set_shader_parameter("c_z", Color(pals[n][1]))
	m.set_shader_parameter("c_x", Color(pals[n][2])); m.set_shader_parameter("fog_col", sea_c); m.set_shader_parameter("mist_col", mist_c); m.set_shader_parameter("shadow_col", shadow_c); m.set_shader_parameter("mist_k", mist_k)
	if variant == "sway": m.set_shader_parameter("sway", 1.0); m.set_shader_parameter("flat_n", 1.0); timed.append(m)
	if variant == "flat" or variant == "flat2": m.set_shader_parameter("flat_n", 1.0)
	if n in ["stone", "shade", "sand", "rose"]: m.set_shader_parameter("marble", 1.0)
	if n == "marble" or n == "skin": m.set_shader_parameter("marble", 0.3)
	pmats[key] = m
	return m

func water(flow := Vector2.ZERO, vert := false) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["water"]
	m.set_shader_parameter("deep", water_deep); m.set_shader_parameter("shallow", water_shallow)
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
	var solid: bool = m is ShaderMaterial and ((m as ShaderMaterial).shader == shaders["base"] or (shaders.has("tex") and (m as ShaderMaterial).shader == shaders["tex"]) or (m as ShaderMaterial).shader == shaders["two"] or (m as ShaderMaterial).shader == shaders["cloth"])
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if solid else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
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

func streamer(p: Vector3, length: float, w := 0.3, yaw := 3.67) -> void:
	if red_cloth == null: red_cloth = cloth(Color("e3454e"), Color("9a1e2f"), 3.2)
	var v := PackedVector3Array(); var n := PackedVector3Array(); var uv := PackedVector2Array(); var idx := PackedInt32Array()
	var segs := 14
	for i in segs + 1:
		var tt := float(i) / segs
		var ww := w * (1.0 - 0.5 * tt)
		for j in 2:
			v.append(Vector3(tt * length, (0.5 - j) * ww - 0.09 * tt * tt * length, 0)); n.append(Vector3(0, 0, 1)); uv.append(Vector2(j, tt))
	for i in segs:
		var a := i * 2
		idx.append_array([a, a + 1, a + 3, a, a + 3, a + 2])
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n; arr[Mesh.ARRAY_TEX_UV] = uv; arr[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, p, red_cloth).rotation.y = yaw

func shard_tree(p: Vector3) -> void:
	if shard_mats.is_empty():
		for i in 4:
			var m := ShaderMaterial.new(); m.shader = shaders["shard"]; m.set_shader_parameter("ph", i * 1.3); timed.append(m); shard_mats.append(m)
	blk(p + Vector3(-0.3, 0, -0.3), p + Vector3(0.3, 0.22, 0.3), "shade"); blk(p + Vector3(-0.34, 0.22, -0.34), p + Vector3(0.34, 0.27, 0.34), "stone")
	cyl(p + Vector3(0, 0.27, 0), 0.07, 0.04, 1.5, pal("trunk"), 7)
	for i in 7:
		var a := i * 0.9
		var br := blk(Vector3(-0.018, 0, -0.018), Vector3(0.018, 0.85 + 0.2 * sin(i * 2.0), 0.018), "trunk")
		br.position = p + Vector3(0, 1.3 + 0.07 * i, 0); br.rotation = Vector3(0.75 + 0.2 * sin(i * 1.3), a, 0)
	var q := QuadMesh.new(); q.size = Vector2(0.075, 0.13)
	for i in 44:
		var a := i * 2.399
		var rr := 0.25 + 0.75 * sqrt(float(i % 11 + 1) / 11.0)
		var c := p + Vector3(cos(a) * rr, 2.25 - 0.9 * absf(sin(i * 1.7)) - rr * 0.25, sin(a) * rr)
		blk(c + Vector3(-0.004, 0.06, -0.004), c + Vector3(0.004, 0.32, 0.004), "dark")
		var sh := prim(q, c, shard_mats[i % 4]); sh.rotation = Vector3(0.2 * sin(i * 3.1), a * 1.7, PI * 0.25)
	decal(p + Vector3(0.35, 0, -0.35), 2.2, 1.6, 0.2, 0.78)

func mirror_stand(p: Vector3, yaw := 0.0) -> void:
	var n := Node3D.new(); n.position = p; n.rotation.y = yaw; add_child(n)
	blk(Vector3(-0.42, 0, -0.14), Vector3(0.42, 0.1, 0.14), "shade", n)
	for sx in [-1.0, 1.0]: blk(Vector3(sx * 0.4 - 0.03, 0.1, -0.03), Vector3(sx * 0.4 + 0.03, 1.9, 0.03), "gold", n)
	blk(Vector3(-0.43, 1.87, -0.03), Vector3(0.43, 1.94, 0.03), "gold", n); blk(Vector3(-0.08, 1.94, -0.03), Vector3(0.08, 2.04, 0.03), "crim", n)
	var g := Gradient.new(); g.colors = PackedColorArray([Color("f6fbfb"), Color("9fd0d6")])
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill_from = Vector2(0.2, 0); gt.fill_to = Vector2(0.8, 1); gt.width = 32; gt.height = 64
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_texture = gt
	var q := QuadMesh.new(); q.size = Vector2(0.74, 1.76)
	prim(q, Vector3(0, 1.0, 0.012), gm, n)
	var q2 := QuadMesh.new(); q2.size = Vector2(0.06, 1.5)
	prim(q2, Vector3(-0.14, 1.0, 0.016), mat(Color(1, 1, 1, 0.55)), n).rotation.z = -0.32

func reeds(p: Vector3, n := 9) -> void:
	for i in n:
		var o := Vector3(0.22 * cos(i * 2.4) * (1.0 + 0.1 * i), 0, 0.22 * sin(i * 2.4) * (1.0 + 0.1 * i))
		var h := 0.5 + 0.35 * absf(sin(i * 1.9))
		var r := blk(Vector3(-0.012, 0, -0.012), Vector3(0.012, h, 0.012), "leaf" if i % 3 else "cyp")
		r.position = Vector3(p.x, WATER - 0.05, p.z) + o; r.rotation = Vector3(0.1 * sin(i * 3.0), 0, 0.12 * cos(i * 2.0))
		if i % 4 == 0: blk(r.position + Vector3(-0.02, h, -0.02), r.position + Vector3(0.02, h + 0.1, 0.02), "trunk")
	for i in 3:
		cyl(Vector3(p.x + 0.5 * cos(i * 2.1 + 1.0), WATER + 0.012, p.z + 0.5 * sin(i * 2.1 + 1.0)), 0.11, 0.11, 0.004, pal("leaf2"), 9)

func rock(p: Vector3, s := 1.0) -> void:
	var m := SphereMesh.new(); m.radius = 0.5; m.height = 1.0; m.radial_segments = 6; m.rings = 3
	var r := prim(m, Vector3(p.x, WATER + 0.05 * s, p.z), pal("shade", "flat")); r.scale = Vector3(1.5, 0.8, 1.1) * s; r.rotation = Vector3(0.2, p.x * 1.3, 0.15)
	foam(p.x - 0.55 * s, p.z - 0.45 * s, p.x + 0.55 * s, p.z + 0.45 * s, 0.3)

## her boat: a small hull built from seven ribs
func build_boat(parent: Node3D) -> void:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	var st := 8
	var ribs := []
	for i in st + 1:
		var tt := -1.0 + 2.0 * i / st
		var w := 0.36 * pow(maxf(0.0, 1.0 - tt * tt), 0.55); var d := 0.26 * pow(maxf(0.0, 1.0 - tt * tt), 0.45)
		var gy := 0.3 + 0.1 * tt * tt
		ribs.append([Vector3(-w, gy, tt * 1.15), Vector3(0, gy - d - 0.02, tt * 1.15), Vector3(w, gy, tt * 1.15)])
	for i in st:
		for side in 2:
			var a: Vector3 = ribs[i][side]; var b: Vector3 = ribs[i][side + 1]; var c: Vector3 = ribs[i + 1][side]; var d2: Vector3 = ribs[i + 1][side + 1]
			for q in [a, b, d2, a, d2, c]:
				v.append(q); n.append(Vector3.UP)
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, pal("wood", "flat2"), parent)
	for tz in [-0.35, 0.4]: blk(Vector3(-0.3, 0.24, tz - 0.06), Vector3(0.3, 0.27, tz + 0.06), "trunk", parent)
	var oar := blk(Vector3(-0.015, 0, -0.9), Vector3(0.015, 0.03, 0.9), "trunk", parent); oar.position = Vector3(0.12, 0.3, 0.1); oar.rotation = Vector3(0.06, 0.25, 0)
	blk(Vector3(-0.16, 0.2, 0.62), Vector3(0.16, 0.3, 0.86), "crim", parent)
	for sx in [-1.0, 1.0]: blk(Vector3(sx * 0.33 - 0.012, 0.3, -0.5), Vector3(sx * 0.33 + 0.012, 0.325, 0.5), "crim", parent)

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
	return
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
	for i in 4:
		cyl(c + Vector3(0, 0.002 * i, 0), r * radii[i], r * radii[i], 0.005, pal(names[i]), 48)
	cyl(c + Vector3(0, 0.008, 0), r * 0.3, r * 0.3, 0.004, pal("gold"), 40); cyl(c + Vector3(0, 0.01, 0), r * 0.25, r * 0.25, 0.004, water(), 40)
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

## a Cycladic head: a smooth shield-shaped face with nothing carved on it but the ridge of the nose
func idol_head(p: Vector3, h: float, yaw := 0.0, tilt := Vector3(-0.22, 0, 0), wide := 1.0, nose := 1.0, parent: Node = self) -> Node3D:
	var n := Node3D.new(); n.position = p; n.rotation = Vector3(tilt.x, yaw, tilt.z); parent.add_child(n)
	var prof := [[0.10, 0.0], [0.25, 0.07], [0.36, 0.22], [0.43, 0.45], [0.45, 0.68], [0.42, 0.86], [0.30, 0.96], [0.0, 1.0]]
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	for q in prof:
		cs.append(Vector3(0, q[1] * h, 0)); rs.append(q[0] * h * wide)
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, Fig.lathe(cs, rs, 36))
	prim(am, Vector3.ZERO, pal("marble"), n).scale = Vector3(1, 1, 0.58)
	var pm := PrismMesh.new(); pm.size = Vector3(0.105 * h, 0.1 * h, 0.44 * h * nose)
	var ns := prim(pm, Vector3(0, (0.86 - 0.22 * nose) * h, 0.44 * 0.58 * h * wide + 0.02 * h), pal("marble"), n); ns.rotation.x = PI * 0.5
	cyl(Vector3(0, -0.42 * h, -0.02 * h), 0.17 * h, 0.14 * h, 0.5 * h, pal("marble"), 24, n)
	return n

## a Cycladic figure with folded arms
func idol(p: Vector3, h: float, yaw := 0.0) -> Node3D:
	var n := Node3D.new(); n.position = p; n.rotation.y = yaw; add_child(n)
	cyl(Vector3.ZERO, 0.24 * h / 1.6, 0.22 * h / 1.6, 0.08, pal("shade"), 24, n)
	var prof := [[0.05, 0.0], [0.072, 0.06], [0.082, 0.25], [0.10, 0.42], [0.125, 0.52], [0.097, 0.60], [0.142, 0.735], [0.135, 0.77], [0.055, 0.80], [0.042, 0.86]]
	var cs := PackedVector3Array(); var rs := PackedFloat32Array()
	for q in prof:
		cs.append(Vector3(0, 0.08 + q[1] * h, 0)); rs.append(q[0] * h)
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, Fig.lathe(cs, rs, 36))
	prim(am, Vector3.ZERO, pal("marble"), n).scale = Vector3(1, 1, 0.44)
	for ay in [0.615, 0.655]:
		blk(Vector3(-0.105 * h, 0.08 + ay * h, 0.035 * h), Vector3(0.105 * h, 0.08 + (ay + 0.024) * h, 0.062 * h), "marble", n)
	blk(Vector3(-0.004 * h, 0.08 + 0.02 * h, 0.03 * h), Vector3(0.004 * h, 0.08 + 0.46 * h, 0.047 * h), "shade", n)
	idol_head(Vector3(0, 0.08 + 0.85 * h, 0), 0.17 * h, 0.0, Vector3(-0.3, 0, 0), 1.0, 1.0, n)
	return n

func pose_state(p: Vector3, yaw: float) -> Dictionary:
	return {"pos": p, "yaw": yaw, "dt": 0.016, "phase": 0.0, "wk": 0.0, "wind": Vector3.ZERO, "bob": 0.0, "drop": 0.0, "lean": 0.0, "roll": 0.0, "twist": 0.0,
		"tm": 0.0, "sway": Vector2.ZERO, "pool": 0.0, "kick": 0.0, "head_yaw": 0.0, "head_pitch": 0.12, "swingL": 0.0, "swingR": 0.0, "hold": 0.0, "raise": 0.0, "open": 0.0,
		"wL": 0.0, "wR": 0.0, "tL": Vector3.ZERO, "tR": Vector3.ZERO}

## the sculptor carved her again and again: a veiled figure in marble, in one of a few poses
func her_statue(p: Vector3, yaw: float, pose := "calm", sc := 1.0) -> Node3D:
	if shape_file != "":
		var d := spawn_shape(self, "marble")
		var hd: Node3D = d.holder
		hd.position = p; hd.scale = Vector3.ONE * sc
		hd.rotation = Vector3({"mourn": 0.1, "kneel": 0.08, "reach": -0.05}.get(pose, 0.0), yaw, 0.0)
		return hd
	if not hero_real:
		var f = Fig.new(); add_child(f); f.set_style(hero_style); f.build(3, pal, null, null)
		f.scale = Vector3.ONE * sc
		var ps := pose_state(p, yaw)
		var bas := Basis(Vector3.UP, yaw) * sc
		match pose:
			"mourn":
				ps.lean = 0.26; ps.head_pitch = 0.5; ps.drop = 0.06; ps.wL = 1.0; ps.wR = 1.0
				ps.tL = p + bas * Vector3(0.06, 1.5, 0.17); ps.tR = p + bas * Vector3(-0.06, 1.5, 0.17)
			"pray":
				ps.head_pitch = 0.3; ps.wL = 1.0; ps.wR = 1.0
				ps.tL = p + bas * Vector3(0.025, 1.26, 0.2); ps.tR = p + bas * Vector3(-0.025, 1.26, 0.2)
			"kneel": ps.drop = 0.55; ps.pool = 1.0; ps.lean = 0.22; ps.head_pitch = 0.32
			"reach": ps.raise = 1.0; ps.head_pitch = -0.25
			"offer": ps.hold = 1.0; ps.open = 0.25; ps.head_pitch = 0.18
		f.apply(ps)
		return f
	var d := spawn_her(self, "marble")
	var holder: Node3D = d.holder
	holder.position = p; holder.rotation.y = yaw; holder.scale = Vector3.ONE * sc
	var ap: AnimationPlayer = d.ap; var sk: Skeleton3D = d.sk
	if ap != null and ap.has_animation("idle"):
		ap.play("idle"); ap.seek(fmod(absf(p.x * 1.7 + p.z * 0.9), 12.0), true); ap.stop(true)
	if sk == null: return holder
	var la := _bone(sk, "LeftArm"); var ra := _bone(sk, "RightArm")
	if la < 0 or ra < 0: return holder
	var left := (sk.get_bone_global_pose(la).origin - sk.get_bone_global_pose(ra).origin).normalized()
	var up := Vector3.UP; var fwd := left.cross(up).normalized()
	match pose:
		"pray", "offer":
			_aim(sk, "LeftArm", "LeftForeArm", fwd * 0.8 - up * 0.5 - left * 0.25); _aim(sk, "RightArm", "RightForeArm", fwd * 0.8 - up * 0.5 + left * 0.25)
			_bend(sk, "Head", left, 0.3)
		"reach":
			_aim(sk, "RightArm", "RightForeArm", up * 0.9 + fwd * 0.45); _bend(sk, "Head", left, -0.25)
		"mourn", "kneel":
			_bend(sk, "Spine", left, 0.3 if pose == "mourn" else 0.45)
			_aim(sk, "LeftArm", "LeftForeArm", fwd * 0.7 + up * 0.25 - left * 0.3); _aim(sk, "RightArm", "RightForeArm", fwd * 0.7 + up * 0.25 + left * 0.3)
			_bend(sk, "Head", left, 0.45)
	return holder

func model(nm: String, pos: Vector3, height: float, yaw := 0.0, tilt := Vector3.ZERO, _p := "marble") -> Node3D:
	if nm.begins_with("kit_face") or nm == "colossus_head_veiled":
		var k := float(nm.unicode_at(nm.length() - 1) % 5)
		return idol_head(pos + Vector3(0, height * 0.3, 0), height * 0.7, yaw, Vector3(-0.2 + tilt.x, 0, tilt.z), 0.9 + 0.05 * k, 0.85 + 0.07 * k)
	if nm == "observer_veiled": return her_statue(pos, yaw, "calm", height / 1.7)
	if nm == "statue_veiled_broken": return idol(pos, height, yaw)
	if nm == "statue_veiled_kneeling": return her_statue(pos, yaw, "kneel", 1.0)
	if nm == "statue_veiled_mourning": return her_statue(pos, yaw, "mourn", height / 1.7)
	if nm == "statue_veiled_praying": return her_statue(pos, yaw, "pray", height / 1.7)
	if nm == "statue_veiled_unfinished": return her_statue(pos, yaw, "offer", height / 1.7)
	return null

# ---------------------------------------------------------------- setup
func _ready() -> void:
	for k in [["base", SH], ["two", SH.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled;")],
			["water", SH_WATER], ["cloth", SH_CLOTH], ["ring", SH_RING], ["sea", SH_SEA], ["face", SH_FACE], ["foam", SH_FOAM], ["fog", SH_FOG], ["shard", SH_SHARD]]:
		var s := Shader.new(); s.code = k[1]; shaders[k[0]] = s
	pals = PALS.duplicate(true)
	if OS.get_environment("PAL") == "mono":
		for k in ["leaf", "leaf2", "leaf3"]: pals[k] = ["e6e4e3", "d0ced2", "a8a7b8"]
		pals["cyp"] = ["bfc2ca", "9fa3b1", "787c92"]; pals["trunk"] = ["b3acae", "958e95", "6f6b7d"]
		pals["gold"] = ["ece7de", "d5cfc9", "a4a0b0"]; pals["terra"] = ["f3ede6", "dfd6d0", "aca6b8"]; pals["rose"] = ["f3ede6", "dfd6d0", "aca6b8"]
		pals["wood"] = ["cbc4c2", "aca5a8", "827d8e"]; pals["dark"] = ["9796aa", "86859e", "767592"]; pals["teal"] = ["66728a", "66728a", "66728a"]
		pals["stone"] = ["fbf8f3", "ebe4e0", "b7b2c6"]; pals["shade"] = ["efeae4", "dcd4d0", "a6a1b6"]; pals["sand"] = ["f7f2ec", "e6ddd8", "b0aabf"]
		pals["dress"] = ["dfe0e5", "c5c6d0", "9a9bb0"]; pals["veil"] = ["f6f5f4", "e0dfe3", "b2b2c2"]; pals["skin"] = ["fbf6f0", "e9e0da", "bcb5c6"]; shadow_c = Vector3(0.7, 0.7, 0.84)
		sea_c = Color("a7b8c1"); mist_c = Color("e4e0e3"); water_deep = Color("a3b6be"); water_shallow = Color("dbe5e6"); bg_c = Color("9dafb9")
	var tones := {
		"dusk": [["fbe9d9", "f0cdb8", "b98fa0"], ["f3dcc9", "e2bba6", "a57f94"], "5f4a78", "e9bba9", "8a6a94", "f0b7a6", Vector3(0.74, 0.58, 0.74), ["77708f", "5b567c", "433f66"], ["b9a0ab", "988392", "72617a"]],
		"night": [["dfe6f4", "b9c5e0", "7f8ab8"], ["cfd8ec", "a9b6d6", "7480ae"], "1f2f5c", "3d4d7e", "24407a", "6a90cc", Vector3(0.52, 0.58, 0.84), ["3f5f7a", "2f4a66", "213552"], ["6f8fa8", "567690", "3d5a78"]],
		"jade": [["fbf3e3", "ecdcc6", "b3a9a6"], ["f1e7d4", "dccab2", "a39a98"], "2f8f7f", "cfe6d6", "2a9a86", "9fe6cf", Vector3(0.64, 0.74, 0.76), ["3f7f6a", "2c6457", "1f4a48"], ["a5caa4", "7dab89", "56877b"]],
		"dawn": [["fffaf4", "fbe3dc", "d9b9cf"], ["fbf0e8", "f1d3cc", "c8a8c0"], "e8a6a4", "fde3d6", "e39a9c", "ffd9cc", Vector3(0.84, 0.68, 0.82), ["9a9ab8", "7c7ca6", "5e5e8e"], ["cdbac9", "ae9cb5", "8c7b9e"]],
	}
	var bold := {
		"coral": [["ffe9d2", "ff9f8a", "b0527e"], ["ffd9bd", "f08874", "9a4470"], "1f6f8f", "8fc0cc", "1f8fa0", "8fe6dc", Vector3(0.62, 0.5, 0.78), ["2f7a6a", "1f6058", "154648"], ["8fd0a8", "5fae8c", "3a8474"]],
		"citrus": [["fff3c4", "ffc24a", "e0703c"], ["ffe7a8", "f2ae36", "c85e30"], "2b4a9b", "8ea6dc", "2f5fb8", "9fc4ff", Vector3(0.72, 0.55, 0.62), ["2f7f5a", "226648", "164c3a"], ["9fd27a", "74b05a", "4c8848"]],
		"lagoon": [["eafff4", "7fe0c4", "3a9aa8"], ["d6f7e6", "68cdb2", "2f8696"], "20306e", "7f8fc8", "2a3f8c", "8fb0ff", Vector3(0.5, 0.62, 0.8), ["2a6a7a", "1f5466", "153e52"], ["bfeec0", "8fd09c", "5fa884"]],
		"rosewater": [["fff0f3", "f7a8c4", "9a6ad0"], ["ffe0e8", "e892b2", "865abc"], "3fb8c8", "b9e6ea", "36a8ba", "b6f2ee", Vector3(0.7, 0.56, 0.84), ["5a6ab0", "46549a", "343f80"], ["cfe0a8", "a6c486", "7ea070"]],
	}
	var bn := OS.get_environment("PAL")
	if bold.has(bn):
		var tb: Array = bold[bn]
		pals["stone"] = tb[0]; pals["sand"] = tb[0]; pals["shade"] = tb[1]; pals["terra"] = tb[1]; pals["rose"] = tb[1]
		sea_c = Color(tb[2]); mist_c = Color(tb[3]); water_deep = Color(tb[4]); water_shallow = Color(tb[5]); bg_c = Color(tb[2]).darkened(0.2); shadow_c = tb[6]
		pals["cyp"] = tb[7]; pals["leaf"] = tb[8]; pals["leaf2"] = tb[8]; pals["leaf3"] = tb[8]
		mist_k = 0.55; fog_k = 0.4
	var pn := OS.get_environment("PAL")
	if tones.has(pn):
		var tn: Array = tones[pn]
		pals["stone"] = tn[0]; pals["sand"] = tn[0]; pals["marble"] = tn[0]; pals["skin"] = tn[0]; pals["shade"] = tn[1]; pals["terra"] = tn[1]; pals["rose"] = tn[1]
		sea_c = Color(tn[2]); mist_c = Color(tn[3]); water_deep = Color(tn[4]); water_shallow = Color(tn[5]); bg_c = Color(tn[2]).darkened(0.15); shadow_c = tn[6]
		pals["cyp"] = tn[7]; pals["leaf"] = tn[8]; pals["leaf2"] = tn[8]; pals["leaf3"] = tn[8]
		pals["dress"] = [Color(tn[1][0]).darkened(0.08).to_html(false), Color(tn[1][1]).darkened(0.1).to_html(false), Color(tn[1][2]).darkened(0.1).to_html(false)]
		pals["veil"] = tn[0]
	if OS.get_environment("HERO") != "": hero_style = int(OS.get_environment("HERO"))
	hero_real = OS.get_environment("REAL") == "1"
	if OS.get_environment("RIG") != "": rig_file = OS.get_environment("RIG") if (OS.get_environment("RIG").begins_with("hq") or OS.get_environment("RIG").begins_with("veil") or OS.get_environment("RIG").begins_with("w") or OS.get_environment("RIG").begins_with("lp") or OS.get_environment("RIG").begins_with("sr")) else "min" + OS.get_environment("RIG"); hero_real = true
	elif OS.get_environment("SHAPE") == "" and OS.get_environment("HERO") == "" and not hero_real: rig_file = "lp1r"; hero_real = true
	if OS.get_environment("SHAPE") != "": shape_file = "min" + OS.get_environment("SHAPE")
	elif not hero_real and OS.get_environment("HERO") == "": shape_file = "min9t"
	var sb := Shader.new()
	sb.code = SH.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled;").replace(
		"void fragment(){", "float bx(vec2 p, vec2 a, vec2 b){ vec2 q = step(a, p) * step(p, b); return q.x * q.y; }\nfloat key(vec2 p){ float m = bx(p, vec2(0.0, 0.76), vec2(0.86, 0.9)); m = max(m, bx(p, vec2(0.72, 0.24), vec2(0.86, 0.9))); m = max(m, bx(p, vec2(0.3, 0.24), vec2(0.86, 0.38))); m = max(m, bx(p, vec2(0.3, 0.24), vec2(0.44, 0.62))); m = max(m, bx(p, vec2(0.3, 0.48), vec2(0.58, 0.62))); m = max(m, bx(p, vec2(0.0, 0.06), vec2(0.14, 0.9))); m = max(m, bx(p, vec2(0.0, 0.06), vec2(1.0, 0.14))); return m; }\nvoid fragment(){").replace(
		"void vertex(){", "void pull(vec3 p, vec3 ra, vec3 rb, vec3 na, vec3 nb, float sig, inout vec3 acc, inout float ws){ vec3 ab = rb - ra; float tt = clamp(dot(p - ra, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0); vec3 c = ra + ab * tt; float d = length(p - c); float w = exp(-d * d / (sig * sig)); vec3 dl = mix(na, nb, tt) - c; float fr = smoothstep(-0.05, 0.05, p.z - leg_zc); dl.z = mix(min(dl.z, 0.0), max(dl.z, 0.0), fr); acc += w * dl; ws += w * mix(0.35, 1.0, step(0.0001, abs(dl.z))); }\nvoid vertex(){").replace(
		"uniform vec3 fog_col : source_color;", "uniform vec3 fog_col : source_color; uniform sampler2D albedo_tex : source_color, filter_linear_mipmap; uniform float use_tex = 0.0; uniform float tex_gain = 1.22; uniform vec3 veil_col = vec3(0.9, 0.9, 0.92); varying float notex; uniform vec3 trail = vec3(0.0);
uniform vec3 hipL; uniform vec3 kneeL; uniform vec3 footL; uniform vec3 hipR; uniform vec3 kneeR; uniform vec3 footR;
uniform vec3 rkneeL; uniform vec3 rfootL; uniform vec3 rkneeR; uniform vec3 rfootR;
uniform vec4 armp = vec4(0.17, 1.4, -0.01, -0.012); uniform float arm_on = 0.0; uniform float adduct = 0.0; uniform vec2 swing = vec2(0.0);
uniform float design = 0.0; uniform float geo = 0.0; uniform float crim_line = 0.0; uniform vec3 o_rim : source_color = vec3(1.0, 0.95, 0.85); uniform vec3 d_shade = vec3(0.64, 0.62, 0.8); uniform float d_sheen = 0.14; uniform float trim = 1.0;
uniform float orn = 0.0; uniform float plain = 0.0; uniform sampler2D veil_mask : source_color, filter_linear_mipmap; uniform float use_mask = 0.0; uniform float fore_y = -1.0; uniform float key_n = 24.0; uniform float sash_y = -1.0; uniform float brace_y = -1.0; uniform float veil_y = 1.46;
uniform vec3 o_dress_hi : source_color = vec3(0.8, 0.81, 0.86); uniform vec3 o_dress_lo : source_color = vec3(0.55, 0.57, 0.68);
uniform vec3 o_veil : source_color = vec3(0.97, 0.96, 0.93); uniform vec3 o_marble : source_color = vec3(0.99, 0.97, 0.94);
uniform vec3 o_crim : source_color = vec3(0.72, 0.13, 0.18); uniform vec3 o_gold : source_color = vec3(0.87, 0.7, 0.34);
varying vec3 mp; varying float armw; varying float vw;
uniform float pelv = 0.0; uniform float shtw = 0.0; uniform vec2 leg_sig = vec2(0.3, 0.11); uniform vec2 leg_hang = vec2(0.06, 0.25); uniform float leg_zc = 0.0; uniform vec3 grad_lo = vec3(0.74, 0.75, 0.84); varying float hv;").replace(
		"	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;", """	float hh = clamp(VERTEX.y / 1.72, 0.0, 1.0); hv = hh; notex = COLOR.g; mp = VERTEX; vw = COLOR.r;
	float wgt = pow(1.0 - smoothstep(0.0, 0.62, hh), 1.5);
	float rr = length(VERTEX.xz); vec2 rad = VERTEX.xz / max(rr, 0.001); float ang = atan(VERTEX.x, VERTEX.z);
	float edge = smoothstep(0.03, 0.16, rr);
	{
		float axx = abs(VERTEX.x - armp.w); float sd = sign(VERTEX.x - armp.w);
		float bl = mix(0.215, 0.127, smoothstep(0.92, 1.16, VERTEX.y));
		float wl = smoothstep(bl - 0.015, bl + 0.015, axx) * step(0.6, VERTEX.y);
		float wu = smoothstep(0.115, 0.19, axx) * (1.0 - smoothstep(1.3, 1.47, VERTEX.y));
		float aw = mix(wl, wu, smoothstep(1.14, 1.26, VERTEX.y)) * arm_on; armw = aw;
		vec3 pv = vec3(armp.w + sd * armp.x, armp.y, armp.z); vec3 q = VERTEX - pv;
		float bb = -adduct * sd * aw; q.xy = vec2(q.x * cos(bb) - q.y * sin(bb), q.x * sin(bb) + q.y * cos(bb));
		float aa = -(sd > 0.0 ? swing.x : swing.y) * aw; q.yz = vec2(q.y * cos(aa) - q.z * sin(aa), q.y * sin(aa) + q.z * cos(aa));
		VERTEX = pv + q;
		float ta = shtw * smoothstep(0.95, 1.3, VERTEX.y) + pelv * smoothstep(0.5, 0.85, VERTEX.y) * (1.0 - smoothstep(1.0, 1.25, VERTEX.y));
		VERTEX.xz = vec2(VERTEX.x * cos(ta) + VERTEX.z * sin(ta), -VERTEX.x * sin(ta) + VERTEX.z * cos(ta));
		if (VERTEX.y < 1.0) {
			vec3 p0 = VERTEX; vec3 acc = vec3(0.0); float ws = 0.0; float lo = smoothstep(0.05, 0.4, p0.y);
			float sig = mix(leg_sig.x, leg_sig.y, lo);
			pull(p0, hipL, rkneeL, hipL, kneeL, sig, acc, ws); pull(p0, rkneeL, rfootL, kneeL, footL, sig, acc, ws);
			pull(p0, hipR, rkneeR, hipR, kneeR, sig, acc, ws); pull(p0, rkneeR, rfootR, kneeR, footR, sig, acc, ws);
			VERTEX += acc / (ws + mix(leg_hang.x, leg_hang.y, lo)) * (1.0 - smoothstep(0.78, 1.0, p0.y));
		}
	}
	VERTEX.xz += trail.xz * wgt;
	vec2 tv = trail.xz * 0.35; tv.y = max(tv.y, -0.012);
	VERTEX.xz += (tv + vec2(sin(time_s * 1.3 + VERTEX.y * 9.0), 0.6 + cos(time_s * 1.05 + VERTEX.x * 14.0)) * 0.006) * COLOR.r;
	VERTEX.xz += rad * (sin(time_s * 1.4 + ang * 3.0 + hh * 5.0) * 0.016 + sin(time_s * 0.8 - ang * 2.0) * 0.01) * wgt * edge;
	VERTEX.y += trail.y * wgt * edge * (0.6 + 0.4 * sin(time_s * 1.1 + ang * 2.0));
	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;""").replace(
		"	col *= mix(0.9, 1.0, clamp(smoothstep(-1.6, -0.1, wp.y) + wt, 0.0, 1.0));",
		"	if (use_tex > 0.0) { vec3 t0 = texture(albedo_tex, UV).rgb; float fl = smoothstep(0.035, 0.09, t0.r - t0.g) * (1.0 - smoothstep(0.24, 0.34, t0.r - t0.g)) * smoothstep(0.02, 0.07, t0.g - t0.b) * smoothstep(0.45, 0.6, t0.r); t0 = mix(t0, vec3(0.95, 0.94, 0.93) * (0.86 + 0.14 * dot(t0, vec3(0.34))), fl); vec3 tx = mix(t0, veil_col, notex); tx = mix(tx, vec3(dot(tx, vec3(0.3, 0.55, 0.15))), 0.08); col = tx * tex_gain * (wt * wt + 0.95 * wz * wz + 0.82 * wx * wx + 0.74 * (1.0 - min(s, 1.0))); }\n	col *= mix(mix(grad_lo, vec3(1.0), smoothstep(0.0, 0.86, hv)), vec3(1.0), use_tex);\n" + ORN_FRAG + DESIGN_FRAG)
	shaders["body"] = sb
	var sk2 := Shader.new()
	var i0 := sb.code.find("void pull("); var i1 := sb.code.find("float bx(vec2 p")
	sk2.code = sb.code.substr(0, i0) + "void vertex(){\n	mp = CUSTOM0.xyz; hv = clamp(mp.y / 1.72, 0.0, 1.0); notex = 0.0; vw = 0.0; armw = 0.0;\n	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);\n}\n" + sb.code.substr(i1)
	shaders["bodyskin"] = sk2
	var st2 := Shader.new()
	st2.code = SH.replace("uniform vec3 fog_col : source_color;", "uniform vec3 fog_col : source_color; uniform sampler2D albedo_tex : source_color, filter_linear_mipmap; uniform vec3 tint = vec3(1.0); uniform float floor_y = -1000.0; uniform float snap = 0.0;").replace(
		"void fragment(){", "vec3 snapc(vec3 lin){ vec3 c = lin; vec3 best = vec3(0.165, 0.54, 0.58); float bd = distance(c, vec3(0.24, 0.61, 0.65)); float d = distance(c, vec3(0.9, 0.82, 0.65)); if (d < bd) { bd = d; best = vec3(0.955, 0.935, 0.885); } d = distance(c, vec3(0.89, 0.725, 0.3)); if (d < bd) { bd = d; best = vec3(0.86, 0.68, 0.29); } d = distance(c, vec3(0.89, 0.89, 0.88)); if (d < bd) { bd = d; best = vec3(0.965, 0.955, 0.94); } d = distance(c, vec3(0.78, 0.2, 0.18)); if (d < bd) { bd = d; best = vec3(0.75, 0.19, 0.23); } return best; }\nvoid fragment(){").replace(
		"	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;", "	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;\n	if (w0.y < floor_y + 0.012) { VERTEX += (inverse(MODEL_MATRIX) * vec4(0.0, floor_y + 0.012 - w0.y, 0.0, 0.0)).xyz; w0.y = floor_y + 0.012; }").replace(
		"vec3 col = c_top * wt * wt + c_z * wz * wz + c_x * wx * wx + c_x * 0.86 * (1.0 - min(s, 1.0));",
		"vec3 tx = texture(albedo_tex, UV).rgb; if (snap > 0.5) tx = snapc(tx); float lum = dot(tx, vec3(0.3, 0.55, 0.15)); vec3 col = mix(vec3(lum), tx, 0.85) * 1.12 * tint * (wt * wt + 0.94 * wz * wz + 0.76 * wx * wx + 0.68 * (1.0 - min(s, 1.0)));")
	shaders["tex"] = st2
	auto = "auto" in OS.get_cmdline_user_args()
	_env()
	var n0 := get_child_count()
	_world()
	world = Node3D.new(); world.name = "World"; add_child(world)
	for c in get_children().slice(n0):
		if c != world: c.reparent(world)
	refl = world.duplicate(); refl.name = "Refl"; add_child(refl)
	refl.scale = Vector3(1, -1, 1); refl.position.y = 2.0 * WATER
	slab(-0.6, -7.8, 0.6, -5.8, 0.0, "stone", refl)
	for e in [-1.0, 1.0]: blk(Vector3(e * 0.54 - 0.03, 0, -7.8), Vector3(e * 0.54 + 0.03, 0.06, -5.8), "shade", refl)
	_actors(); _fog(); _nav(); _ui()
	cam_t = pos
	get_viewport().size_changed.connect(_fit)
	_fit()
	if "gallery" in OS.get_cmdline_user_args(): _gallery()
	if "shots" in OS.get_cmdline_user_args(): _shots()
	if "lineup" in OS.get_cmdline_user_args(): _lineup()
	if "reals" in OS.get_cmdline_user_args(): _real_lineup()
	if "mins" in OS.get_cmdline_user_args(): _min_lineup()
	if "zoom" in OS.get_cmdline_user_args(): cam.size = 3.3
	if "glide" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		RenderingServer.directional_shadow_atlas_set_size(2048, true)
		_glide()
	if auto:
		get_viewport().msaa_3d = Viewport.MSAA_2X
		RenderingServer.directional_shadow_atlas_set_size(2048, true)
		_auto()

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
	cam.position = o + Vector3(0, 1.0, 0) + cam.basis.z * 34.0
	await get_tree().create_timer(0.5).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_environment("SHOT_DIR") + "/gallery.png")
	get_tree().quit()

func _shots() -> void:
	started = true; title_box.hide(); hint.hide()
	var dir := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.0).timeout
	var list := [
		{"n": "00-key-art", "p": Vector3(1.6, 0, 2.2), "y": 0.9, "c": Vector3(2.3, 1.6, -0.6), "s": 15.5},
		{"n": "01-map", "p": Vector3(0.5, 0, 2.0), "y": 0.6, "c": Vector3(-8.5, 0, -11.5), "s": 36.0},
		{"n": "02-arrival-court", "p": Vector3(0.6, 0, 1.4), "y": 0.5, "c": Vector3(0.2, 0.4, 0.0), "s": 13.0},
		{"n": "03-colossus", "p": Vector3(4.4, 0, 1.0), "y": 1.3, "c": Vector3(6.2, 0.9, 1.0), "s": 10.5},
		{"n": "04-steps-and-boat", "p": Vector3(0.3, 0, 2.9), "y": 0.3, "c": Vector3(1.0, 0.0, 3.8), "s": 7.0},
		{"n": "05-bridge-only-in-the-water", "p": Vector3(0.0, 0, -5.5), "y": PI, "c": Vector3(0.0, 0.0, -6.8), "s": 8.5},
		{"n": "06-lever-court", "p": Vector3(0.4, 0, -11.8), "y": -1.2, "c": Vector3(-0.6, 0.4, -13.2), "s": 12.5},
		{"n": "07-turning-bridge", "p": Vector3(-3.2, 0, -13.0), "y": -1.57, "c": Vector3(-7.0, 0.2, -13.0), "s": 11.0},
		{"n": "08-half-gate", "p": Vector3(-16.3, 0, -15.0), "y": PI, "c": Vector3(-16.3, 0.4, -16.6), "s": 12.5},
		{"n": "09-mirror-garden", "p": Vector3(MX + 0.52, 0, MZ), "y": -PI * 0.5, "c": Vector3(-16.6, 0.8, -23.6), "s": 12.5, "touch": true},
		{"n": "10-heroine", "p": Vector3(0.9, 0, 1.2), "y": 0.78, "c": Vector3(0.9, 0.95, 1.2), "s": 3.1},
		{"n": "11-heroine-back", "p": Vector3(0.9, 0, 1.2), "y": -2.3, "c": Vector3(0.9, 0.95, 1.2), "s": 3.1},
		{"n": "12-strange-heads", "p": Vector3(-2.2, 0, 0.3), "y": -1.2, "c": Vector3(-3.1, 0.7, 0.0), "s": 5.0},
		{"n": "13-statues", "p": Vector3(-17.0, 0, -22.0), "y": 0.4, "c": Vector3(-16.4, 0.8, -24.4), "s": 8.0},
	]
	var only := OS.get_environment("SHOT_ONLY")
	for sh in list:
		if only != "":
			var hit := false
			for pre in only.split(","):
				if (sh.n as String).begins_with(pre): hit = true
			if not hit: continue
		shot = sh
		route.clear(); pos = sh.p; yaw = sh.y; cam.size = sh.s; cam_t = pos
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

func _fog() -> void:
	var fn := FastNoiseLite.new(); fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH; fn.frequency = 0.012; fn.fractal_octaves = 3
	var nt := NoiseTexture2D.new(); nt.noise = fn; nt.seamless = true; nt.width = 256; nt.height = 256
	var q := QuadMesh.new(); q.size = Vector2(260, 260); q.orientation = PlaneMesh.FACE_Y
	for L in [[WATER + 0.18, 0.5, 0.02, Vector2(0.006, 0.003), 0.0, 1], [WATER + 0.8, 0.42, 0.015, Vector2(-0.004, 0.005), 0.0, 2], [0.25, 0.3, 0.02, Vector2(0.008, -0.005), 0.0, 3]]:
		var m := ShaderMaterial.new(); m.shader = shaders["fog"]; m.render_priority = L[5]
		m.set_shader_parameter("noise_tex", nt); m.set_shader_parameter("dens", L[1] * fog_k); m.set_shader_parameter("scale", L[2])
		m.set_shader_parameter("vel", L[3]); m.set_shader_parameter("clear_r", L[4]); m.set_shader_parameter("col", Color("f1e8ef"))
		prim(q, Vector3(0, L[0], 0), m); fogs.append(m); timed.append(m)

## one of the real sculpted heroine models, dressed in the flat style of this world
func real_hero(file: String, at: Vector3, yaw: float, anim := "", arms_down := false) -> Node3D:
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	if doc.append_from_file(ProjectSettings.globalize_path("res://hero_models/%s.glb" % file), st) != OK: return null
	var src := doc.generate_scene(st) as Node3D
	var holder := Node3D.new(); holder.position = at; holder.rotation.y = yaw; add_child(holder); holder.add_child(src)
	if file == "tripo_v1": src.rotation.y = -PI * 0.5
	var bb := AABB(); var first := true
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		for si in mi.mesh.get_surface_count():
			var om := mi.mesh.surface_get_material(si)
			var sm := ShaderMaterial.new(); sm.shader = shaders["tex"]
			sm.set_shader_parameter("fog_col", sea_c); sm.set_shader_parameter("mist_col", mist_c); sm.set_shader_parameter("shadow_col", shadow_c); sm.set_shader_parameter("mist_k", mist_k)
			if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: sm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
			mi.set_surface_override_material(si, sm); pmats["tex|%s|%d" % [file, si]] = sm
		var a: AABB = mi.global_transform * mi.get_aabb()
		if first: bb = a; first = false
		else: bb = bb.merge(a)
	var a2 := holder.global_transform.affine_inverse() * bb
	var sc := 1.72 / maxf(a2.size.y, 0.001)
	src.scale *= sc; src.position -= Vector3(a2.get_center().x, a2.position.y, a2.get_center().z) * sc
	var ap := src.find_children("*", "AnimationPlayer", true, false)
	if anim != "" and not ap.is_empty():
		var pl := ap[0] as AnimationPlayer
		if pl.has_animation(anim):
			pl.get_animation(anim).loop_mode = Animation.LOOP_LINEAR; pl.play(anim)
	if arms_down:
		for sk in src.find_children("*", "Skeleton3D", true, false):
			var skel := sk as Skeleton3D
			for side in [["L_Upperarm", "L_Forearm", 1.0], ["R_Upperarm", "R_Forearm", -1.0]]:
				var bi := skel.find_bone(side[0]); var ci := skel.find_bone(side[1])
				if bi < 0 or ci < 0: continue
				var g := skel.get_bone_global_rest(bi); var c := skel.get_bone_global_rest(ci)
				var cur := (c.origin - g.origin).normalized()
				var side_dir := signf(cur.x) if absf(cur.x) > 0.2 else float(side[2])
				var want := Vector3(side_dir * 0.2, -1.0, 0.06).normalized()
				var q := Quaternion(cur, want)
				skel.set_bone_global_pose(bi, Transform3D(Basis(q) * g.basis, g.origin))
	return holder

## the idle and walk clips must stand on the same spot, or she slides sideways whenever she stops
func align_clips(src: Node3D) -> void:
	var aps := src.find_children("*", "AnimationPlayer", true, false)
	if aps.is_empty(): return
	var ap: AnimationPlayer = aps[0]
	var mean := {}
	for an in ["walk", "idle"]:
		if not ap.has_animation(an): return
		var a := ap.get_animation(an)
		for ti in a.get_track_count():
			if a.track_get_type(ti) == Animation.TYPE_POSITION_3D and String(a.track_get_path(ti)).ends_with("Hips"):
				var m := Vector3.ZERO
				for ki in a.track_get_key_count(ti): m += a.track_get_key_value(ti, ki)
				mean[an] = [ti, m / maxf(a.track_get_key_count(ti), 1.0)]
	if mean.size() < 2: return
	var d: Vector3 = mean["idle"][1] - mean["walk"][1]; d.y = 0.0
	var ia := ap.get_animation("idle"); var it: int = mean["idle"][0]
	for ki in ia.track_get_key_count(it): ia.track_set_key_value(it, ki, (ia.track_get_key_value(it, ki) as Vector3) - d)
	print("RIG clips aligned, idle moved by ", -d)

func add_rest_coords(src: Node3D) -> void:
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var am := ArrayMesh.new()
		for si in mi.mesh.get_surface_count():
			var a := mi.mesh.surface_get_arrays(si)
			var raw: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
			var av := PackedVector3Array(); av.resize(raw.size())
			for i in raw.size(): av[i] = Vector3(-raw[i].z, raw[i].y, raw[i].x)
			var lo := Vector3.INF; var hi := -Vector3.INF
			for v in av: lo = lo.min(v); hi = hi.max(v)
			var hgt := hi.y - lo.y; var cx := 0.0; var cz := 0.0; var cn := 0.0
			for v in av:
				if v.y > lo.y + hgt * 0.62: cx += v.x; cz += v.z; cn += 1.0
			cx /= maxf(cn, 1.0); cz /= maxf(cn, 1.0)
			var sc := 1.72 / maxf(hgt, 0.001)
			var cu := PackedFloat32Array(); cu.resize(av.size() * 4)
			for i in av.size():
				cu[i * 4] = (av[i].x - cx) * sc; cu[i * 4 + 1] = (av[i].y - lo.y) * sc; cu[i * 4 + 2] = (av[i].z - cz) * sc; cu[i * 4 + 3] = 0.0
			a[Mesh.ARRAY_CUSTOM0] = cu
			rig_norm = {"cx": cx, "lo": lo.y, "cz": cz, "sc": sc, "veil": Color("e8e2d2")}
			var om0 := mi.mesh.surface_get_material(si)
			if a[Mesh.ARRAY_TEX_UV] != null and om0 is BaseMaterial3D and (om0 as BaseMaterial3D).albedo_texture != null:
				var img := (om0 as BaseMaterial3D).albedo_texture.get_image()
				if img != null:
					if img.is_compressed(): img.decompress()
					var best := -1; var bd := 9.0
					for i in av.size():
						var yy := cu[i * 4 + 1]; var zz := cu[i * 4 + 2]
						if yy > 1.5 and yy < 1.66 and zz < -0.04 and absf(cu[i * 4]) < bd: bd = absf(cu[i * 4]); best = i
					if best >= 0:
						var uv: Vector2 = (a[Mesh.ARRAY_TEX_UV] as PackedVector2Array)[best]
						rig_norm.veil = img.get_pixel(clampi(int(fposmod(uv.x, 1.0) * img.get_width()), 0, img.get_width() - 1), clampi(int(fposmod(uv.y, 1.0) * img.get_height()), 0, img.get_height() - 1))
						print("RIG veil colour ", rig_norm.veil)
			# the gown hangs from the hips: take most of the leg bones' pull out of the skirt
			var bones: PackedInt32Array = a[Mesh.ARRAY_BONES]; var wts: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
			var per: int = bones.size() / maxi(av.size(), 1)
			var skin := mi.skin; var hips := -1; var legs := {}
			var sks := src.find_children("*", "Skeleton3D", true, false)
			if skin != null and per > 0:
				for bi in skin.get_bind_count():
					var bn := String(skin.get_bind_name(bi))
					if bn == "" and not sks.is_empty(): bn = (sks[0] as Skeleton3D).get_bone_name(skin.get_bind_bone(bi))
					if bn.ends_with("Hips"): hips = bi
					for key in ["UpLeg", "Leg", "Foot", "Toe"]:
						if bn.contains(key): legs[bi] = true
				var keep_mid := float(OS.get_environment("SK_MID")) if OS.get_environment("SK_MID") != "" else 0.45
				var keep_low := float(OS.get_environment("SK_LOW")) if OS.get_environment("SK_LOW") != "" else 0.15
				if hips >= 0:
					for i in av.size():
						var y := cu[i * 4 + 1]
						var keep := 1.0
						if y < 0.98: keep = lerpf(keep_mid, 1.0, smoothstep(0.6, 0.98, y)) if y > 0.6 else lerpf(keep_low, keep_mid, smoothstep(0.05, 0.6, y))
						if keep >= 0.999: continue
						var moved := 0.0; var hslot := -1; var minslot := 0
						for k in per:
							var o := i * per + k
							if legs.has(bones[o]): moved += wts[o] * (1.0 - keep); wts[o] *= keep
							if bones[o] == hips: hslot = k
							if wts[o] < wts[i * per + minslot]: minslot = k
						if moved <= 0.0: continue
						if hslot < 0:
							hslot = minslot; moved += wts[i * per + hslot]; bones[i * per + hslot] = hips; wts[i * per + hslot] = 0.0
						wts[i * per + hslot] += moved
				# the veil hangs from the head and the back: nothing outside the arms themselves may follow the arm bones
				var arms := {}; var spine := {}
				for bi in skin.get_bind_count():
					var bn2 := String(skin.get_bind_name(bi))
					if bn2 == "" and not sks.is_empty(): bn2 = (sks[0] as Skeleton3D).get_bone_name(skin.get_bind_bone(bi))
					if bn2.contains("Shoulder") or bn2.contains("Arm") or bn2.contains("Hand"): arms[bi] = true
					for key in ["Head", "Neck", "Spine2", "Spine1", "Spine", "Hips"]:
						if bn2.ends_with(key): spine[key] = bi
				var ay := 0.0; var az := 0.0; var an := 0.0
				for i in av.size():
					if absf(cu[i * 4]) > 0.55 and cu[i * 4 + 1] > 1.0: ay += cu[i * 4 + 1]; az += cu[i * 4 + 2]; an += 1.0
				if an > 20.0 and spine.size() == 6 and OS.get_environment("ARM_FIX") == "1":
					ay /= an; az /= an
					var tube := float(OS.get_environment("ARM_TUBE")) if OS.get_environment("ARM_TUBE") != "" else 0.085
					var fixed := 0
					for i in av.size():
						var x := cu[i * 4]; var y := cu[i * 4 + 1]; var z := cu[i * 4 + 2]
						var dist := Vector2(y - ay, z - az).length()
						var t := smoothstep(tube, tube + 0.04, dist) if absf(x) > 0.13 else 1.0
						if t <= 0.0: continue
						var moved := 0.0; var slot := -1
						for k in per:
							var o := i * per + k
							if arms.has(bones[o]) and wts[o] > 0.0:
								moved += wts[o] * t; wts[o] *= 1.0 - t
								if slot < 0 and t >= 0.999: slot = k
						if moved <= 0.0: continue
						var tgt: int = spine["Head"] if y > 1.52 else spine["Neck"] if y > 1.42 else spine["Spine2"] if y > 1.2 else spine["Spine1"] if y > 1.05 else spine["Spine"] if y > 0.95 else spine["Hips"]
						for k in per:
							if bones[i * per + k] == tgt: slot = k
						if slot < 0:
							slot = 0
							for k in per:
								if wts[i * per + k] < wts[i * per + slot]: slot = k
							moved += wts[i * per + slot]; wts[i * per + slot] = 0.0
						bones[i * per + slot] = tgt; wts[i * per + slot] += moved; fixed += 1
					print("RIG veil freed from the arms: ", fixed, " verts, arm height ", ay)
				a[Mesh.ARRAY_BONES] = bones; a[Mesh.ARRAY_WEIGHTS] = wts
				print("RIG skirt reweighted, hips bind ", hips, " leg binds ", legs.size(), " per ", per)
			var fl: int = Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT
			if a[Mesh.ARRAY_BONES] != null and (a[Mesh.ARRAY_BONES] as PackedInt32Array).size() == av.size() * 8: fl |= Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a, [], {}, fl)
			am.surface_set_material(si, mi.mesh.surface_get_material(si))
			print("RIG mesh verts ", av.size(), " size ", hi - lo)
		mi.mesh = am

## a small faceted cloth that hangs from the circlet in front of the face, so the veil really hides it
func add_face_panel(src: Node3D, mode: String) -> void:
	var sks := src.find_children("*", "Skeleton3D", true, false)
	if sks.is_empty() or rig_norm.is_empty(): return
	var sk: Skeleton3D = sks[0]
	var hb := _bone(sk, "Head")
	if hb < 0: return
	var inv := sk.get_bone_global_rest(hb).affine_inverse()
	var to_local := func(n: Vector3) -> Vector3:
		var avx: float = n.x / rig_norm.sc + rig_norm.cx; var avy: float = n.y / rig_norm.sc + rig_norm.lo; var avz: float = n.z / rig_norm.sc + rig_norm.cz
		return inv * Vector3(avz, avy, -avx)
	# rows from the circlet down to the chest: [height, half width, forward at the edge, forward at the ridge]
	var rows := [[1.705, 0.07, 0.085, 0.112], [1.63, 0.092, 0.125, 0.158], [1.53, 0.108, 0.135, 0.176], [1.405, 0.118, 0.15, 0.19]]
	var vs := PackedVector3Array(); var ns := PackedVector3Array()
	var gv := PackedVector3Array(); var gn := PackedVector3Array()
	var tri := func(a: Vector3, b: Vector3, c: Vector3, arr_v: PackedVector3Array, arr_n: PackedVector3Array) -> void:
		var nn := (b - a).cross(c - a).normalized()
		for q in [a, b, c]: arr_v.append(q); arr_n.append(nn)
	for r in rows.size() - 1:
		var t: Array = rows[r]; var b2: Array = rows[r + 1]
		var tl: Vector3 = to_local.call(Vector3(-t[1], t[0], t[2])); var tm: Vector3 = to_local.call(Vector3(0, t[0], t[3])); var tr: Vector3 = to_local.call(Vector3(t[1], t[0], t[2]))
		var bl: Vector3 = to_local.call(Vector3(-b2[1], b2[0], b2[2])); var bm: Vector3 = to_local.call(Vector3(0, b2[0] - (0.03 if r == rows.size() - 2 else 0.0), b2[3])); var br: Vector3 = to_local.call(Vector3(b2[1], b2[0], b2[2]))
		tri.call(tl, bl, tm, vs, ns); tri.call(tm, bl, bm, vs, ns); tri.call(tm, bm, tr, vs, ns); tri.call(tr, bm, br, vs, ns)
		# wings that tuck back into the veil at the sides
		var tlb: Vector3 = to_local.call(Vector3(-t[1] - 0.012, t[0], t[2] - 0.09)); var blb: Vector3 = to_local.call(Vector3(-b2[1] - 0.012, b2[0], b2[2] - 0.09))
		var trb: Vector3 = to_local.call(Vector3(t[1] + 0.012, t[0], t[2] - 0.09)); var brb: Vector3 = to_local.call(Vector3(b2[1] + 0.012, b2[0], b2[2] - 0.09))
		tri.call(tlb, blb, tl, vs, ns); tri.call(tl, blb, bl, vs, ns); tri.call(tr, br, trb, vs, ns); tri.call(trb, br, brb, vs, ns)
	var l: Array = rows[rows.size() - 1]
	for sd in [-1.0, 1.0]:
		var e0 := Vector3(sd * l[1], l[0], l[2] + 0.004); var e1 := Vector3(0, l[0] - 0.03, l[3] + 0.004)
		var up := Vector3(0, 0.02, 0)
		tri.call(to_local.call(e0), to_local.call(e1), to_local.call(e0 + up), gv, gn); tri.call(to_local.call(e0 + up), to_local.call(e1), to_local.call(e1 + up), gv, gn)
	var ba := BoneAttachment3D.new(); sk.add_child(ba); ba.bone_idx = hb
	var vc: Color = rig_norm.veil
	for part in [[vs, ns, "cloth"], [gv, gn, "gold"]]:
		var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = part[0]; arr[Mesh.ARRAY_NORMAL] = part[1]
		var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var mi := MeshInstance3D.new(); mi.mesh = am; ba.add_child(mi)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if mode in ["tex", "marble"] else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if mode == "flat": mi.material_override = ghost_flat
		elif mode == "marble": mi.material_override = pal("marble", "2")
		elif mode == "crim": mi.material_override = pal("crim", "2")
		elif part[2] == "gold": mi.material_override = pal("gold", "2")
		else:
			var m := ShaderMaterial.new(); m.shader = shaders["two"]
			m.set_shader_parameter("c_top", Color(minf(vc.r * 1.1, 1.0), minf(vc.g * 1.1, 1.0), minf(vc.b * 1.1, 1.0))); m.set_shader_parameter("c_z", vc); m.set_shader_parameter("c_x", Color(vc.r * 0.84, vc.g * 0.84, vc.b * 0.86))
			m.set_shader_parameter("fog_col", sea_c); m.set_shader_parameter("mist_col", mist_c); m.set_shader_parameter("shadow_col", shadow_c); m.set_shader_parameter("mist_k", mist_k)
			pmats["panel|%d" % mi.get_instance_id()] = m; mi.material_override = m

func spawn_her(parent: Node, mode: String) -> Dictionary:
	if hero_src == null:
		var st := GLTFState.new(); var doc := GLTFDocument.new()
		doc.append_from_file(ProjectSettings.globalize_path("res://hero_models/%s.glb" % (rig_file if rig_file != "" else "tripo_v1")), st)
		hero_src = doc.generate_scene(st) as Node3D
		if rig_file != "": add_rest_coords(hero_src); align_clips(hero_src)
	var src: Node3D = hero_src.duplicate()
	var holder := Node3D.new(); parent.add_child(holder); holder.add_child(src)
	src.scale = Vector3.ONE * 1.72; src.rotation.y = float(OS.get_environment("RIG_YAW")) if OS.get_environment("RIG_YAW") != "" else (PI * 0.5 if rig_file == "lp1r" else -PI * 0.5)
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if mode in ["tex", "marble"] else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		for si in mi.mesh.get_surface_count():
			var om := mi.mesh.surface_get_material(si)
			if mode == "flat": mi.set_surface_override_material(si, ghost_flat)
			elif mode == "marble": mi.set_surface_override_material(si, pal("marble", "2" if rig_file != "" else ""))
			elif rig_file != "" and mode == "crim": mi.set_surface_override_material(si, pal("crim", "2"))
			elif rig_file == "min14r":
				var bm := body_mat("veil", "rig" + str(holder.get_instance_id())); bm.shader = shaders["bodyskin"]
				var did := int(OS.get_environment("DESIGN")) if OS.get_environment("DESIGN") != "" else 32
				apply_design(bm, did, rig_file); bm.set_shader_parameter("geo", 1.0)
				mi.set_surface_override_material(si, bm)
			else:
				var sm := ShaderMaterial.new(); sm.shader = shaders["tex"]
				sm.set_shader_parameter("fog_col", sea_c); sm.set_shader_parameter("mist_col", mist_c); sm.set_shader_parameter("shadow_col", shadow_c); sm.set_shader_parameter("mist_k", mist_k)
				if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: sm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
				if mode == "crim": sm.set_shader_parameter("tint", Vector3(1.75, 0.42, 0.5))
				if mode == "tex": floor_mats.append(sm)
				if rig_file.begins_with("lp") or rig_file.begins_with("sr"): sm.set_shader_parameter("flat_n", 1.0)
				if rig_file == "lp1r" and OS.get_environment("NOSNAP") != "1": sm.set_shader_parameter("snap", 1.0)
				mi.set_surface_override_material(si, sm); pmats["her|%d|%d" % [holder.get_instance_id(), si]] = sm
	if rig_file == "lp3r" and OS.get_environment("NOPANEL") != "1": add_face_panel(src, mode)
	var aps := src.find_children("*", "AnimationPlayer", true, false); var sks := src.find_children("*", "Skeleton3D", true, false)
	var ap: AnimationPlayer = aps[0] if not aps.is_empty() else null
	var sk: Skeleton3D = sks[0] if not sks.is_empty() else null
	if ap != null:
		for an in ["idle", "walk"]:
			if ap.has_animation(an): ap.get_animation(an).loop_mode = Animation.LOOP_LINEAR
	return {"holder": holder, "ap": ap, "sk": sk}

func _bone(sk: Skeleton3D, n: String) -> int:
	var i := sk.find_bone("mixamorig:" + n)
	return i if i >= 0 else sk.find_bone("mixamorig_" + n)

func _aim(sk: Skeleton3D, bone: String, child: String, want: Vector3) -> void:
	var bi := _bone(sk, bone); var ci := _bone(sk, child)
	if bi < 0 or ci < 0: return
	var g := sk.get_bone_global_pose(bi); var c := sk.get_bone_global_pose(ci).origin
	sk.set_bone_global_pose(bi, Transform3D(Basis(Quaternion((c - g.origin).normalized(), want.normalized())) * g.basis, g.origin))

func _bend(sk: Skeleton3D, bone: String, axis: Vector3, ang: float) -> void:
	var bi := _bone(sk, bone)
	if bi < 0: return
	var g := sk.get_bone_global_pose(bi)
	sk.set_bone_global_pose(bi, Transform3D(Basis(axis, ang) * g.basis, g.origin))

func _real_lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3)
	var dir := Vector3(1, 0, -1).normalized()
	var names := [["tripo_v1", "idle", false], ["porcelain", "", true], ["h4", "", true]]
	var labels := ["A", "B", "C"]; var gap := 1.5; var vs := 5.4
	if OS.get_environment("REALS") != "":
		names = []; labels = []
		for nm in OS.get_environment("REALS").split(","): names.append([nm, "", true]); labels.append(nm.right(1))
		gap = 2.0; vs = 7.6
	var hs := []
	for i in names.size():
		hs.append(real_hero(names[i][0], c + dir * ((i - (names.size() - 1) * 0.5) * gap), PI * 0.25, names[i][1], names[i][2]))
		var l := Label3D.new(); l.text = labels[i]; l.font_size = 96; l.pixel_size = 0.004 * vs / 5.4; l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.modulate = Color(0.72, 0.14, 0.18); l.outline_modulate = Color(1, 1, 1, 0.9); l.no_depth_test = true
		l.position = c + dir * ((i - (names.size() - 1) * 0.5) * gap) + Vector3(0.75, 0.05, 0.75) * (vs / 5.4); add_child(l)
	var dirn := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.5).timeout
	for view in [["real-front", PI * 0.25], ["real-back", PI * 1.12]]:
		shot = {"c": c + Vector3(0, 0.95, 0), "s": vs}
		cam.size = vs
		for h in hs:
			if h != null: (h as Node3D).rotation.y = view[1] + (float(OS.get_environment("REAL_OFF")) if OS.get_environment("REAL_OFF") != "" else 0.0)
		await get_tree().create_timer(0.8).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dirn, view[0]])
		print("SHOT ", view[0])
	get_tree().quit()

func bake_shape(file: String) -> ArrayMesh:
	shape_tex = null
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	if doc.append_from_file(ProjectSettings.globalize_path("res://hero_models/%s.glb" % file), st) != OK: return null
	var src := doc.generate_scene(st) as Node3D
	var vs := PackedVector3Array(); var ns := PackedVector3Array(); var ix := PackedInt32Array(); var uvs := PackedVector2Array()
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var xf := Transform3D.IDENTITY
		var n: Node = mi
		while n != null and n is Node3D:
			xf = (n as Node3D).transform * xf
			if n == src: break
			n = n.get_parent()
		xf = Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3.ZERO) * xf
		for si in mi.mesh.get_surface_count():
			var a := mi.mesh.surface_get_arrays(si)
			var base := vs.size()
			var av: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
			var has_n: bool = a[Mesh.ARRAY_NORMAL] != null
			var has_uv: bool = a[Mesh.ARRAY_TEX_UV] != null
			var om := mi.mesh.surface_get_material(si)
			if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: shape_tex = (om as BaseMaterial3D).albedo_texture
			for i in av.size():
				uvs.append((a[Mesh.ARRAY_TEX_UV][i] as Vector2) if has_uv else Vector2.ZERO)
				vs.append(xf * av[i])
				ns.append((xf.basis * (a[Mesh.ARRAY_NORMAL][i] as Vector3)).normalized() if has_n else Vector3.UP)
			if a[Mesh.ARRAY_INDEX] != null:
				for j in (a[Mesh.ARRAY_INDEX] as PackedInt32Array): ix.append(base + j)
			else:
				for j in av.size(): ix.append(base + j)
	src.free()
	var lo := Vector3.INF; var hi := -Vector3.INF
	for v in vs: lo = lo.min(v); hi = hi.max(v)
	var cx := 0.0; var cz := 0.0; var cn := 0.0
	for v in vs:
		if v.y > lo.y + (hi.y - lo.y) * 0.62: cx += v.x; cz += v.z; cn += 1.0
	var sc := 1.72 / maxf(hi.y - lo.y, 0.001)
	var c := Vector3(cx / maxf(cn, 1.0), lo.y, cz / maxf(cn, 1.0))
	for i in vs.size(): vs[i] = (vs[i] - c) * sc
	var cols := PackedColorArray(); cols.resize(vs.size()); cols.fill(Color(0, 0, 0))
	var vk := file.substr(0, file.find("t")) if file.find("t") > 0 else file
	if FACE_VEIL.has(vk) and OS.get_environment("NOVEIL") != "1": add_face_veil(FACE_VEIL[vk], vs, ns, cols, ix)
	uvs.resize(vs.size())
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_COLOR] = cols; arr[Mesh.ARRAY_TEX_UV] = uvs; arr[Mesh.ARRAY_INDEX] = ix
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	print("SHAPE ", file, " verts ", vs.size(), " tris ", ix.size() / 3)
	return am

## the costume, redesigned: soft two-tone shading, a light on the outline, a satin sheen, one thin gold line
const DESIGN_FRAG := """	if (design > 0.5) {
		vec3 L = normalize(vec3(-0.62, 0.56, 0.5)); vec3 V = vec3(0.57735);
		float kf = 0.0; float kw = smoothstep(veil_y - 0.015, veil_y + 0.015, mp.y); float fold = 1.0;
		if (use_tex > 0.0) {
			vec3 t1 = texture(albedo_tex, UV).rgb; float lum = dot(t1, vec3(0.3, 0.55, 0.15)); float rg = t1.r - t1.g; float kc = smoothstep(0.2, 0.34, rg);
			kf = smoothstep(0.035, 0.09, rg) * (1.0 - kc) * smoothstep(0.02, 0.07, t1.g - t1.b) * smoothstep(0.45, 0.6, t1.r);
			kw = smoothstep(0.7, 0.8, lum) * (1.0 - kc) * (1.0 - kf);
			fold = clamp(mix(lum / 0.56, lum / 0.92, kw), 0.8, 1.08);
			if (use_mask > 0.5) { vec3 t2 = texture(veil_mask, UV).rgb; kw = smoothstep(0.2, 0.34, t2.r - t2.g); kf *= 1.0 - kw; }
		}
		if (geo > 0.5) {
			float ax = abs(mp.x);
			float isarm = smoothstep(0.165, 0.18, ax) * (1.0 - smoothstep(1.3, 1.42, mp.y)) * step(0.6, mp.y);
			float vth = mix(1.33, 1.43 - 0.21 * max(0.0, 1.0 - ax / 0.12), step(0.02, mp.z));
			kw = step(vth, mp.y) * (1.0 - isarm);
			kf = isarm * step(mp.y, 1.02);
		}
		kf = max(kf, step(0.5, armw) * step(mp.y, fore_y));
		float isveil = max(notex, kw); float ismar = kf * (1.0 - isveil);
		float ndl = dot(n, L); float ramp = smoothstep(-0.2, 0.55, ndl);
		float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.4);
		float sheen = pow(clamp(dot(n, normalize(L + V)), 0.0, 1.0), 14.0);
		vec3 dc = mix(o_dress_lo, o_dress_hi, smoothstep(0.0, 1.0, mp.y));
		dc *= mix(d_shade, vec3(1.0), ramp) * mix(1.0, fold, 0.6 * (1.0 - notex));
		dc += o_rim * fres * 0.38 + vec3(1.0, 0.96, 0.9) * sheen * d_sheen;
		vec3 gold = o_gold * (0.82 + 0.34 * ramp) + vec3(1.0, 0.9, 0.6) * sheen * 0.3;
		dc = mix(dc, gold, step(abs(mp.y - 0.052), 0.008) * trim);
		dc = mix(dc, o_crim * (0.8 + 0.3 * ramp), step(abs(mp.y - 0.075), 0.006) * crim_line);
		vec3 vc = o_veil * mix(mix(d_shade, vec3(1.0), 0.25), vec3(1.0), ramp) * mix(1.0, fold, 0.35 * (1.0 - notex)) + o_rim * fres * 0.3;
		vc = mix(vc, gold, step(0.93, vw) * trim);
		vec3 q2 = mp * 7.0; float w2 = fbm(q2 + vec3(fbm(q2 * 0.6 + 11.0), 0.0, fbm(q2 * 0.6 + 5.0)) * 1.6);
		vec3 mc = o_marble * (1.0 + (w2 - 0.5) * 0.08) * mix(vec3(0.76, 0.76, 0.9), vec3(1.0), ramp);
		mc = mix(mc, mc * vec3(0.72, 0.75, 0.88), (1.0 - smoothstep(0.0, 0.035, abs(w2 - 0.5))) * 0.65);
		mc = mix(mc, mc * vec3(0.8, 0.81, 0.9), (1.0 - smoothstep(0.0, 0.007, abs(fbm(q2 * 1.7 + 20.0) - 0.47))) * 0.8);
		mc += vec3(0.92, 0.94, 1.0) * fres * 0.12;
		col = mix(mix(dc, mc, step(0.5, ismar)), vc, step(0.5, isveil));
	}
"""
const DESIGNS := {
	1: {"hi": "f1ebe1", "lo": "c9beb6", "veil": "fdfbf6", "rim": "fff4dc", "sheen": 0.1},
	2: {"hi": "23808a", "lo": "144a59", "veil": "c9ebe6", "rim": "9fe8e0", "sheen": 0.2},
	3: {"hi": "363d80", "lo": "1c2050", "veil": "d3d7f6", "rim": "a9b4ff", "sheen": 0.22},
	4: {"hi": "8c2239", "lo": "50162e", "veil": "f4deda", "rim": "ff9aa0", "sheen": 0.2},
	5: {"hi": "302d3a", "lo": "16151d", "veil": "f6f3eb", "rim": "9a94c8", "sheen": 0.24},
	6: {"hi": "d37050", "lo": "9a4536", "veil": "f9e9d6", "rim": "ffc79a", "sheen": 0.14},
	7: {"hi": "8c9e76", "lo": "596a4f", "veil": "f0f3e2", "rim": "dff0b8", "sheen": 0.14},
	8: {"hi": "dfae47", "lo": "a6762a", "veil": "fff6da", "rim": "ffe9a0", "sheen": 0.18},
	31: {"hi": "4f4c8c", "lo": "2e2b5c", "veil": "ece7f6", "rim": "cbc4ff", "sheen": 0.2},
	32: {"hi": "2d5f7b", "lo": "1a3a55", "veil": "dceeee", "rim": "a5e6e6", "sheen": 0.2},
	33: {"hi": "5d3c7a", "lo": "361f50", "veil": "f3e6ef", "rim": "e3b8ff", "sheen": 0.2},
	34: {"hi": "484e86", "lo": "2a2e5e", "veil": "f7f1e6", "rim": "ffe9c8", "sheen": 0.2, "crim": 1.0},
}

func apply_design(m: ShaderMaterial, id: int, file: String) -> void:
	var d: Dictionary = DESIGNS[id]; var rr := rig_of(file)
	m.set_shader_parameter("design", 1.0); m.set_shader_parameter("orn", 0.0); m.set_shader_parameter("marble", 0.0)
	m.set_shader_parameter("o_dress_hi", Color(d.hi)); m.set_shader_parameter("o_dress_lo", Color(d.lo)); m.set_shader_parameter("o_veil", Color(d.veil))
	m.set_shader_parameter("o_rim", Color(d.rim)); m.set_shader_parameter("d_sheen", d.sheen); m.set_shader_parameter("crim_line", d.get("crim", 0.0)); m.set_shader_parameter("fore_y", rr.get("fore", -1.0))

## the drawn-on costume: marble limbs with gold seams, a pleated gown with a meander hem, a trimmed veil
const ORN_FRAG := """	if (orn > 0.5) {
		float shd = wt * wt + 0.95 * wz * wz + 0.84 * wx * wx + 0.76 * (1.0 - min(s, 1.0));
		float ang = atan(mp.x, mp.z);
		float kc = 0.0; float kf = armw; float kw = smoothstep(veil_y - 0.015, veil_y + 0.015, mp.y); float fold = 1.0;
		if (use_tex > 0.0) {
			vec3 t1 = texture(albedo_tex, UV).rgb; float lum = dot(t1, vec3(0.3, 0.55, 0.15)); float rg = t1.r - t1.g;
			kc = smoothstep(0.2, 0.34, rg);
			kf = smoothstep(0.035, 0.09, rg) * (1.0 - kc) * smoothstep(0.02, 0.07, t1.g - t1.b) * smoothstep(0.45, 0.6, t1.r);
			kw = smoothstep(0.7, 0.8, lum) * (1.0 - kc) * (1.0 - kf);
			fold = clamp(mix(lum / 0.56, lum / 0.92, kw), 0.86, 1.06);
			if (use_mask > 0.5) { vec3 t2 = texture(veil_mask, UV).rgb; kw = smoothstep(0.2, 0.34, t2.r - t2.g); kf *= 1.0 - kw; }
		}
		kf = max(kf, step(0.5, armw) * step(mp.y, fore_y));
		float isveil = max(notex, kw); float ismar = kf * (1.0 - isveil);
		float pl = smoothstep(0.2, 0.95, sin(ang * 44.0) * 0.5 + 0.5);
		vec3 dc = mix(o_dress_lo, o_dress_hi, smoothstep(0.1, 1.25, mp.y)) * (1.0 - 0.08 * (1.0 - plain) * pl * (1.0 - smoothstep(0.35, 0.9, mp.y))) * mix(1.0, mix(fold, 1.0, plain * 0.5), 1.0 - notex);
		dc = mix(dc, o_crim * 0.92, kc * (1.0 - plain));
		float bv = (mp.y - 0.05) / 0.1;
		if (bv > 0.0 && bv < 1.0 && plain < 0.5) dc = mix(o_crim, o_gold, key(vec2(fract(ang / 6.28318 * key_n), bv)));
		float ln = step(abs(mp.y - 0.046), 0.004) + step(abs(mp.y - 0.154), 0.004) + step(abs(mp.y - 0.172), 0.0025);
		dc = mix(dc, o_gold, clamp(ln, 0.0, 1.0) * (1.0 - plain));
		float sv = abs(mp.y - sash_y);
		if (sv < 0.032 && armw < 0.5 && plain < 0.5) dc = mix(o_crim, o_gold, step(0.024, sv));
		vec3 q2 = mp * 7.0; float w2 = fbm(q2 + vec3(fbm(q2 * 0.6 + 11.0), 0.0, fbm(q2 * 0.6 + 5.0)) * 1.6);
		vec3 mc = o_marble * (1.0 + (w2 - 0.5) * 0.08);
		mc = mix(mc, mc * vec3(0.74, 0.76, 0.88), (1.0 - smoothstep(0.0, 0.035, abs(w2 - 0.5))) * mix(0.5, 0.7, plain));
		mc = mix(mc, mix(o_gold, mc * vec3(0.8, 0.81, 0.9), plain), (1.0 - smoothstep(0.0, 0.007, abs(fbm(q2 * 1.7 + 20.0) - 0.47))) * 0.9);
		mc = mix(mc, o_gold, step(abs(mp.y - brace_y), 0.011) * step(0.5, armw) * (1.0 - plain));
		vec3 vc = o_veil * mix(1.0, fold, 1.0 - notex);
		vc = mix(vc, o_crim, step(0.8, vw) * step(vw, 0.86) * (1.0 - plain)); vc = mix(vc, o_gold, step(0.92, vw) * (1.0 - plain));
		col = mix(mix(dc, mc, step(0.5, ismar)), vc, step(0.5, isveil)) * shd * 1.05;
	}
"""

## where the head of each figure is, so a cloth can be laid over the face
const FACE_VEIL := {"min9": {"cx": -0.008, "cz": 0.03, "rx": 0.108, "rzf": 0.139, "rzb": 0.12, "top": 1.731, "eq": 1.62, "chin": 1.5, "hem": 1.365},
	"min13": {"cx": 0.006, "cz": -0.03, "rx": 0.116, "rzf": 0.14, "rzb": 0.125, "top": 1.732, "eq": 1.62, "chin": 1.5, "hem": 1.41}}
const VEIL_COL := {"min13tb": Vector3(0.80, 0.11, 0.14), "min13ta": Vector3(0.93, 0.91, 0.86)}

func add_face_veil(d: Dictionary, vs: PackedVector3Array, ns: PackedVector3Array, cols: PackedColorArray, ix: PackedInt32Array) -> void:
	var NT := 30; var NV := 20; var TH := deg_to_rad(104.0)
	var base := vs.size()
	var pts: Array = []; var wts: Array = []
	for iv in NV + 1:
		var v := float(iv) / NV
		for it in NT + 1:
			var th := lerpf(-TH, TH, float(it) / NT)
			var a := absf(th) / TH
			var hem: float = d.hem + 0.11 * a * a + 0.006 * cos(th * 9.0)
			var f := 1.0; var y := 0.0; var w := 0.0
			var tuck := 0.2 * smoothstep(0.55, 1.0, a)
			if v < 0.4:
				var ph := v / 0.4 * PI * 0.5
				f = pow(sin(ph), 0.36) * (1.0 - tuck)
				y = d.top - (d.top - d.eq) * (1.0 - cos(ph))
			else:
				var q := (v - 0.4) / 0.6
				y = lerpf(d.eq, hem, q)
				var below := clampf((d.eq - y) / (d.eq - d.chin), 0.0, 1.0)
				f = (1.0 - tuck * (1.0 - below)) * (1.0 + 0.05 * q + 0.012 * cos(th * 8.0) * q)
				w = q
			var rz: float = d.rzf if cos(th) > 0.0 else d.rzb
			pts.append(Vector3(d.cx + d.rx * f * sin(th), y, d.cz + rz * f * cos(th))); wts.append(w)
	var W := NT + 1
	for iv in NV + 1:
		for it in NT + 1:
			var pp: Vector3 = pts[iv * W + it]
			var du: Vector3 = pts[iv * W + mini(it + 1, NT)] - pts[iv * W + maxi(it - 1, 0)]
			var dv: Vector3 = pts[mini(iv + 1, NV) * W + it] - pts[maxi(iv - 1, 0) * W + it]
			var n := dv.cross(du)
			var out := Vector3(pp.x - d.cx, 0.0, pp.z - d.cz)
			if n.length() < 1e-7: n = Vector3.UP
			elif n.dot(out) < 0.0: n = -n
			vs.append(pp); ns.append(n.normalized()); cols.append(Color(wts[iv * W + it], 1, 0))
	for iv in NV:
		for it in NT:
			var a0 := base + iv * W + it
			ix.append_array(PackedInt32Array([a0, a0 + 1, a0 + W, a0 + 1, a0 + W + 1, a0 + W]))

## where the joints are inside each figure (model space, 1.72 m tall, facing +Z)
const RIGS := {"min9": {"cx": -0.012, "hx": 0.065, "hy": 0.9, "zc": -0.02, "A": 0.26, "l1": 0.43, "l2": 0.43, "arm": Vector4(0.17, 1.4, -0.01, -0.012), "arm_on": 1.0, "adduct": 0.1, "sash": 1.09, "brace": 0.835, "fore": 1.0},
	"min14": {"cx": 0.0, "hx": 0.06, "hy": 0.9, "zc": 0.0, "A": 0.24, "l1": 0.43, "l2": 0.43, "arm": Vector4(0.19, 1.38, 0.0, 0.0), "arm_on": 0.0, "adduct": 0.0, "sash": -1.0, "brace": -1.0},
	"min13": {"cx": 0.0, "hx": 0.065, "hy": 0.9, "zc": 0.03, "A": 0.24, "l1": 0.43, "l2": 0.43, "arm": Vector4(0.17, 1.4, 0.0, 0.0), "arm_on": 0.0, "adduct": 0.0, "sash": -1.0, "brace": -1.0, "keys": 44.0, "mask": "min13tb"}}

func rig_of(file: String) -> Dictionary:
	var k := file.substr(0, file.find("t")) if file.find("t") > 0 else file
	return RIGS.get(k, RIGS["min13"])

func leg_pose(ph: float, side: float, amt: float, R: Dictionary) -> Array:
	var hip := Vector3(R.cx + side * R.hx, R.hy, R.zc)
	var u := fposmod(ph, TAU) / TAU
	var z := 0.0; var lift := 0.0
	if u < 0.62: z = lerpf(1.0, -1.0, u / 0.62)
	else:
		var q := (u - 0.62) / 0.38
		z = -cos(q * PI); lift = sin(q * PI)
	var foot := Vector3(hip.x - side * 0.012, 0.06 + 0.08 * lift * amt, R.zc + z * R.A * amt)
	var d := foot - hip
	var L := minf(d.length(), R.l1 + R.l2 - 0.002)
	var a := acos(clampf((R.l1 * R.l1 + L * L - R.l2 * R.l2) / (2.0 * R.l1 * L), -1.0, 1.0))
	var dn := d.normalized()
	var fw := (Vector3(0, 0, 1) - dn * dn.z).normalized()
	return [hip, hip + (dn * cos(a) + fw * sin(a)) * R.l1, foot]

func body_mat(pl: String, key: String) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["body"]
	m.set_shader_parameter("c_top", Color(pals[pl][0])); m.set_shader_parameter("c_z", Color(pals[pl][1])); m.set_shader_parameter("c_x", Color(pals[pl][2]))
	m.set_shader_parameter("fog_col", sea_c); m.set_shader_parameter("mist_col", mist_c); m.set_shader_parameter("shadow_col", shadow_c); m.set_shader_parameter("mist_k", mist_k)
	if OS.get_environment("FACET") == "1": m.set_shader_parameter("flat_n", 1.0)
	pmats["body|" + key] = m; timed.append(m); body_mats.append(m)
	return m

func spawn_shape(parent: Node, mode: String, file := "", design_id := -1) -> Dictionary:
	if file == "": file = shape_file
	if not shape_cache.has(file):
		var bm := bake_shape(file); shape_cache[file] = {"mesh": bm, "tex": shape_tex}
	var stex: Texture2D = shape_cache[file].tex
	var holder := Node3D.new(); parent.add_child(holder)
	var mi := MeshInstance3D.new(); mi.mesh = shape_cache[file].mesh; holder.add_child(mi)
	mi.extra_cull_margin = 1.0
	match mode:
		"main":
			var m := body_mat("veil", "main" + file + str(holder.get_instance_id())); m.set_shader_parameter("marble", 0.22); mi.material_override = m
			if stex != null:
				m.set_shader_parameter("albedo_tex", stex); m.set_shader_parameter("use_tex", 1.0); m.set_shader_parameter("marble", 0.0)
				if VEIL_COL.has(file): m.set_shader_parameter("veil_col", VEIL_COL[file])
			if OS.get_environment("ORN") != "0":
				var rr := rig_of(file)
				m.set_shader_parameter("orn", 1.0); m.set_shader_parameter("marble", 0.0); m.set_shader_parameter("sash_y", rr.sash); m.set_shader_parameter("brace_y", rr.brace); m.set_shader_parameter("key_n", rr.get("keys", 24.0))
				if OS.get_environment("COSTUME") != "ornate":
					m.set_shader_parameter("plain", 1.0)
					m.set_shader_parameter("o_dress_hi", Color("c22a35")); m.set_shader_parameter("o_dress_lo", Color("ad202c")); m.set_shader_parameter("o_veil", Color("e0656e"))
					m.set_shader_parameter("fore_y", rr.get("fore", -1.0))
					if rr.has("mask") and stex != null:
						if not shape_cache.has(rr.mask):
							var mm := bake_shape(rr.mask); shape_cache[rr.mask] = {"mesh": mm, "tex": shape_tex}
						if shape_cache[rr.mask].tex != null: m.set_shader_parameter("veil_mask", shape_cache[rr.mask].tex); m.set_shader_parameter("use_mask", 1.0)
			if design_id < 0 and OS.get_environment("DESIGN") != "": design_id = int(OS.get_environment("DESIGN"))
			if design_id < 0 and OS.get_environment("COSTUME") == "": design_id = 32
			if design_id > 0: apply_design(m, design_id, file)
			var r0 := rig_of(file)
			m.set_shader_parameter("armp", r0.arm); m.set_shader_parameter("arm_on", r0.arm_on)
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		"crim":
			var m2 := body_mat("crim", "refl"); m2.set_shader_parameter("grad_lo", Vector3(0.8, 0.8, 0.85)); mi.material_override = m2
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		"flat":
			mi.material_override = ghost_flat; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		"marble":
			mi.material_override = pal("marble", "2"); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return {"holder": holder, "mi": mi}

func load_shape(file: String, at: Vector3, yaw: float, pl := "veil") -> Node3D:
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	if doc.append_from_file(ProjectSettings.globalize_path("res://hero_models/%s.glb" % file), st) != OK: return null
	var src := doc.generate_scene(st) as Node3D
	var holder := Node3D.new(); holder.position = at; holder.rotation.y = yaw; add_child(holder); holder.add_child(src)
	src.rotation.y = -PI * 0.5
	var bb := AABB(); var first := true
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		for si in mi.mesh.get_surface_count(): mi.set_surface_override_material(si, pal(pl, "2"))
		var a: AABB = mi.global_transform * mi.get_aabb()
		if first: bb = a; first = false
		else: bb = bb.merge(a)
	var a2 := holder.global_transform.affine_inverse() * bb
	var sc := 1.72 / maxf(a2.size.y, 0.001)
	src.scale *= sc; src.position -= Vector3(a2.get_center().x, a2.position.y, a2.get_center().z) * sc
	return holder

func _min_lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3)
	var dir := Vector3(1, 0, -1).normalized()
	var hs := []
	var names := (OS.get_environment("MINS") if OS.get_environment("MINS") != "" else "1,2,3,4").split(",")
	var tag := OS.get_environment("MIN_TAG")
	var dz := OS.get_environment("DESIGNS").split(",") if OS.get_environment("DESIGNS") != "" else PackedStringArray()
	var gap := float(OS.get_environment("MIN_SPACE")) if OS.get_environment("MIN_SPACE") != "" else 1.35
	var vsz := float(OS.get_environment("MIN_SIZE")) if OS.get_environment("MIN_SIZE") != "" else 6.4
	for i in names.size():
		var off := (i - (names.size() - 1) * 0.5) * gap
		if OS.get_environment("TEX") == "1":
			var sd := spawn_shape(self, "main", "min" + names[i], int(dz[i]) if i < dz.size() else -1); (sd.holder as Node3D).position = c + dir * off; hs.append(sd.holder)
		else:
			hs.append(load_shape("min" + names[i], c + dir * off, PI * 0.25))
		var l := Label3D.new(); l.text = names[i] if OS.get_environment("TEX") != "1" else (dz[i] if i < dz.size() else "ABCDEF"[i])
		if OS.get_environment("MIN_LABELS") != "": l.text = OS.get_environment("MIN_LABELS").split(",")[i]
		l.font_size = 96; l.pixel_size = 0.004 * vsz / 6.4; l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.modulate = Color(0.72, 0.14, 0.18); l.outline_modulate = Color(1, 1, 1, 0.9); l.no_depth_test = true
		l.position = c + dir * off + Vector3(0.75, 0.05, 0.75) * (vsz / 6.4); add_child(l)
	var dirn := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.5).timeout
	for view in [["minimal-front", PI * 0.25], ["minimal-back", PI * 1.12], ["minimal-side", -PI * 0.2]]:
		shot = {"c": c + Vector3(0, 0.95 if vsz > 5.0 else 0.6, 0), "s": vsz}
		cam.size = vsz
		for h in hs:
			if h != null: (h as Node3D).rotation.y = view[1]
		await get_tree().create_timer(0.8).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s%s.png" % [dirn, view[0], tag])
		print("SHOT ", view[0])
	get_tree().quit()

func _lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3)
	var dir := Vector3(1, 0, -1).normalized()
	var figs := []
	for i in 5:
		var f = Fig.new(); add_child(f); f.set_style(i + 1); f.build(0, pal, veil_m, face_m)
		figs.append(f)
		var l := Label3D.new(); l.text = str(i + 1); l.font_size = 96; l.pixel_size = 0.004; l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.modulate = Color(0.72, 0.14, 0.18); l.outline_modulate = Color(1, 1, 1, 0.9); l.no_depth_test = true
		l.position = c + dir * ((i - 2) * 1.3) + Vector3(0.75, 0.05, 0.75); add_child(l)
	var dirn := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.0).timeout
	for view in [["heroines-front", PI * 0.25], ["heroines-back", PI * 1.12], ["heroines-side", -PI * 0.25]]:
		shot = {"c": c + Vector3(0, 1.0, 0), "s": 7.6}
		cam.size = 7.6
		for i in 5:
			figs[i].veil_ready = false
			figs[i].apply(pose_state(c + dir * ((i - 2) * 1.3), view[1]))
		await get_tree().create_timer(0.6).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dirn, view[0]])
		print("SHOT ", view[0])
	get_tree().quit()

func ring_mat(tint: Vector3) -> ShaderMaterial:
	var m := ShaderMaterial.new(); m.shader = shaders["ring"]; m.set_shader_parameter("tint", tint); m.render_priority = 2
	return m

func _env() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = bg_c
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sunl := DirectionalLight3D.new()
	sunl.look_at_from_position(Vector3.ZERO, Vector3(0.62, -0.56, -0.5), Vector3.UP)
	sunl.light_energy = 1.0; sunl.shadow_enabled = true; sunl.shadow_blur = 0.8; sunl.shadow_bias = 0.04; sunl.shadow_normal_bias = 1.2
	sunl.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL; sunl.directional_shadow_max_distance = 70.0
	add_child(sunl)
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = 11.0; cam.near = 0.1; cam.far = 150.0
	cam.rotation_degrees = Vector3(-35.264, 45, 0)
	add_child(cam); cam.current = true
	var sq := QuadMesh.new(); sq.size = Vector2(260, 260); sq.orientation = PlaneMesh.FACE_Y
	foam_mat = ShaderMaterial.new(); foam_mat.shader = shaders["foam"]; timed.append(foam_mat)
	sea_mat = ShaderMaterial.new(); sea_mat.shader = shaders["sea"]
	sea_mat.set_shader_parameter("near_col", sea_c); sea_mat.set_shader_parameter("far_col", mist_c); sea_mat.set_shader_parameter("mist_k", clampf(mist_k + 0.15, 0.0, 1.0))
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

func ring_gate(c: Vector3, rad: float, n := 17) -> void:
	for i in n:
		var th := PI * (i + 0.5) / n
		var bx := blk(Vector3(-0.21, -0.2, -0.21), Vector3(0.21, 0.2, 0.21), "stone" if i % 2 == 0 else "shade")
		bx.position = c + Vector3(cos(th) * rad, sin(th) * rad, 0); bx.rotation.z = th
		bx.scale = Vector3(1.0, PI * rad / n / 0.4 * 1.02, 1.0)
	for sx in [-1.0, 1.0]:
		cyl(c + Vector3(sx * rad, -1.2, 0), 0.34, 0.3, 1.25, pal("shade"), 16); foam(c.x + sx * rad - 0.34, c.z - 0.34, c.x + sx * rad + 0.34, c.z + 0.34, 0.3)

func plinth_head(nm: String, fp: Vector3, yaw: float) -> void:
	blk(fp + Vector3(-0.19, 0, -0.19), fp + Vector3(0.19, 0.72, 0.19), "stone")
	blk(fp + Vector3(-0.23, 0, -0.23), fp + Vector3(0.23, 0.08, 0.23), "shade"); blk(fp + Vector3(-0.23, 0.72, -0.23), fp + Vector3(0.23, 0.78, 0.23), "shade")
	model(nm, fp + Vector3(0, 0.78, 0), 0.62, yaw)
	decal(fp + Vector3(0.12, 0, -0.12), 0.9, 0.7, 0.2, 0.78)

func statue_on(nm: String, sp: Vector3, h: float, yaw: float) -> void:
	cyl(sp, 0.32, 0.3, 0.07, pal("shade"), 20); cyl(sp + Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone"), 20)
	model(nm, sp + Vector3(0, 0.17, 0), h, yaw)
	decal(sp + Vector3(0.15, 0, -0.15), 1.1, 0.8, 0.2, 0.78)

func _world() -> void:
	# ---- A. the arrival court (7 x 7 m of open floor)
	slab(-4.0, -4.0, 3.5, 3.5, 0.0); under(-4.0, -4.0, 3.5, 3.5)
	tiles(-4.0, -4.0, 3.5, 3.5, 1.0); rosette(Vector3(0, 0, 0), 1.5); meander(-3.3, -3.3, 3.3, 3.3)
	parapet(Vector3(-3.9, 0, -3.9), Vector3(-3.9, 0, 3.4)); parapet(Vector3(-3.9, 0, -3.9), Vector3(-0.85, 0, -3.9)); parapet(Vector3(0.85, 0, -3.9), Vector3(3.4, 0, -3.9))
	parapet(Vector3(3.4, 0, -3.9), Vector3(3.4, 0, -0.3)); parapet(Vector3(3.4, 0, 2.3), Vector3(3.4, 0, 3.4))
	parapet(Vector3(-3.9, 0, 3.4), Vector3(-0.95, 0, 3.4)); parapet(Vector3(0.95, 0, 3.4), Vector3(3.4, 0, 3.4))
	tree(Vector3(-3.5, 0, 2.85), 1.35); cypress(Vector3(-3.55, 0, -3.5), 2.6); cypress(Vector3(-3.55, 0, -2.6), 2.0)
	plinth_head("kit_face2", Vector3(-3.55, 0, -1.1), PI * 0.5); plinth_head("kit_face3", Vector3(-3.55, 0, 1.1), PI * 0.5)
	lantern(Vector3(1.15, 0, -3.72), 2); urn(Vector3(2.9, 0, 3.0), 1.0); urn(Vector3(3.1, 0, 2.72), 0.7, "rose")
	for gx in [-0.72, 0.72]:
		blk(Vector3(gx - 0.14, 0, -4.04), Vector3(gx + 0.14, 2.1, -3.76), "stone"); blk(Vector3(gx - 0.17, 0, -4.07), Vector3(gx + 0.17, 0.1, -3.73), "shade")
	var gw := CSGBox3D.new(); gw.size = Vector3(1.72, 0.66, 0.28); gw.position = Vector3(0, 2.43, -3.9); gw.material = pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = 0.58; gc.height = 0.5; gc.sides = 32
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -0.33, 0); gc.material = pal("shade"); gw.add_child(gc); add_child(gw)
	cornice(-0.86, -4.04, 0.86, -3.76, 2.76, 0.04, 0.06); dentils(-0.86, -4.04, 0.86, -3.76, 2.76); blk(Vector3(-0.06, 2.82, -3.94), Vector3(0.06, 2.94, -3.86), "crim")
	for i in 5:
		blk(Vector3(-0.8, -0.26 * (i + 1) - 0.2, 3.5 + 0.26 * i), Vector3(0.8, -0.26 * (i + 1), 3.5 + 0.26 * (i + 1)), "stone")
	blk(Vector3(-0.95, -2.45, 3.5), Vector3(-0.8, -0.05, 4.8), "shade"); blk(Vector3(0.8, -2.45, 3.5), Vector3(0.95, -0.05, 4.8), "shade")
	foam(-0.95, 3.55, 0.95, 4.8, 0.3)
	boat = Node3D.new(); boat.name = "Boat"; boat.position = Vector3(2.5, WATER - 0.12, 4.9); boat.rotation.y = 1.0; add_child(boat)
	build_boat(boat)
	cyl(Vector3(1.2, -0.2, 4.2), 0.045, 0.045, 0.75, pal("wood"), 8)
	slab(3.5, -0.3, 5.1, 2.3, 0.0); under(3.5, -0.3, 5.1, 2.3, 0.2, "sand"); parapet(Vector3(5.0, 0, -0.2), Vector3(5.0, 0, 2.2))
	blk(Vector3(3.9, 0, 1.9), Vector3(4.6, 0.22, 2.12), "shade")
	model("colossus_head_veiled", Vector3(8.6, WATER - 1.15, -2.2), 6.6, 0.55, Vector3(-0.08, 0, 0.14))
	slab(-8.0, -2.2, -6.6, 2.2, 0.0); under(-8.0, -2.2, -6.6, 2.2, 0.18, "sand")
	for cz in [-1.6, -0.55, 0.55, 1.6]: column(Vector3(-7.3, 0, cz), 2.4, 0.15)
	blk(Vector3(-7.54, 2.45, -1.9), Vector3(-7.06, 2.66, 1.9), "stone"); cornice(-7.54, -1.9, -7.06, 1.9, 2.66, 0.04, 0.06); dentils(-7.54, -1.9, -7.06, 1.9, 2.45)
	# ---- B. the causeway: its middle is gone above the water, yet whole in the reflection
	slab(-0.6, -5.8, 0.6, -4.0, 0.0); slab(-0.6, -10.0, 0.6, -7.8, 0.0)
	pier(0.0, -5.0, -0.18, 0.7); pier(0.0, -8.8, -0.18, 0.7)
	for rb in [[Vector3(-0.35, 0, -5.95), 0.3], [Vector3(0.3, -0.05, -6.0), -0.4], [Vector3(-0.2, -0.04, -7.7), 0.5], [Vector3(0.38, 0, -7.62), -0.2]]:
		var bk := blk(Vector3(-0.2, -0.13, -0.16), Vector3(0.2, 0, 0.16), "stone"); bk.position = rb[0]; bk.rotation = Vector3(0.12, rb[1], 0.1)
	# ---- C. the lever court (6.5 x 6 m)
	slab(-3.4, -16.4, 3.5, -10.0, 0.0); under(-3.4, -16.4, 3.5, -10.0, 0.22, "sand")
	tiles(-3.4, -16.4, 3.5, -10.0, 1.0); rosette(Vector3(-0.6, 0, -13.0), 1.2); meander(-2.85, -15.85, 3.3, -10.2)
	blk(Vector3(-3.4, 0, -16.4), Vector3(3.5, 1.6, -16.18), "stone"); cornice(-3.4, -16.4, 3.5, -16.18, 1.6); dentils(-3.4, -16.4, 3.5, -16.18, 1.6)
	crenels(Vector3(-3.3, 1.66, -16.22), Vector3(3.4, 1.66, -16.22), 0.335)
	for wx in [-2.4, -1.0, 0.4, 1.8]: win_z(wx, 0.25, -16.18, 0.5, 1.05)
	banner(Vector3(-0.3, 1.5, -16.165), 0.34, 0.95); banner(Vector3(2.55, 1.5, -16.165), 0.34, 0.95)
	plinth_head("kit_face6", Vector3(-2.95, 0, -15.95), 0.5); plinth_head("kit_face4", Vector3(3.2, 0, -15.9), -0.4)
	parapet(Vector3(-3.3, 0, -16.0), Vector3(-3.3, 0, -13.75)); parapet(Vector3(-3.3, 0, -12.25), Vector3(-3.3, 0, -10.1)); parapet(Vector3(3.4, 0, -16.0), Vector3(3.4, 0, -10.1))
	parapet(Vector3(-3.3, 0, -10.1), Vector3(-0.85, 0, -10.1)); parapet(Vector3(0.85, 0, -10.1), Vector3(3.4, 0, -10.1))
	lantern(Vector3(3.15, 0, -10.35), 3, -1.0); cypress(Vector3(-3.0, 0, -10.5), 2.1); urn(Vector3(2.2, 0, -15.9), 0.9); urn(Vector3(2.45, 0, -15.75), 0.65, "rose")
	cyl(CAP, 0.3, 0.26, 0.05, pal("shade"), 32); cyl(CAP + Vector3(0, 0.05, 0), 0.065, 0.05, 0.95, pal("stone"), 16)
	cap_rot = Node3D.new(); cap_rot.name = "Cap"; cap_rot.position = CAP + Vector3(0, 0.98, 0); cap_rot.rotation.y = -0.42; add_child(cap_rot)
	blk(Vector3(-0.022, -0.022, -0.2), Vector3(0.022, 0.022, 0.84), "dark", cap_rot)
	ball(Vector3(0, 0, 0.86), 0.045, pal("crim"), cap_rot); ball(Vector3(0, 0.06, 0), 0.045, pal("crim"), cap_rot)
	decal(CAP + Vector3(0.12, 0, -0.12), 0.9, 0.7, 0.22, 0.78)
	# ---- the turning bridge and the long walk west
	slab(-4.2, -13.6, -3.4, -12.4, 0.0)
	bridge = Node3D.new(); bridge.name = "Bridge"; bridge.position = PIV; bridge.rotation.y = PI * 0.5; add_child(bridge)
	slab(-1.7, -0.6, 1.7, 0.6, 0.0, "stone", bridge)
	blk(Vector3(-1.6, 0, -0.03), Vector3(1.6, 0.004, 0.03), "crim", bridge)
	for e in [-1.0, 1.0]: blk(Vector3(-1.65, 0, e * 0.54 - 0.03), Vector3(1.65, 0.06, e * 0.54 + 0.03), "shade", bridge)
	cyl(PIV + Vector3(0, -2.45, 0), 0.26, 0.24, 2.25, pal("stone"), 24); cyl(PIV + Vector3(0, -2.45, 0), 0.34, 0.34, 2.45 + WATER + 0.06, pal("shade"), 24)
	foam(PIV.x - 0.34, PIV.z - 0.34, PIV.x + 0.34, PIV.z + 0.34, 0.3)
	slab(-13.0, -13.6, -7.6, -12.4, 0.0)
	for px in [-8.6, -10.3, -12.0]: pier(px, -13.0, -0.18, 0.7)
	slab(-11.1, -10.6, -9.5, -9.0, 0.0); under(-11.1, -10.6, -9.5, -9.0, 0.2, "sand")
	model("statue_veiled_broken", Vector3(-10.3, 0, -9.8), 2.0, 0.6)
	# ---- E. the court of the half gate (6.5 x 6 m): half an arch in the sea, a whole ring with its reflection
	slab(-19.9, -16.9, -13.0, -10.5, 0.0); under(-19.9, -16.9, -13.0, -10.5)
	tiles(-19.9, -16.9, -13.0, -10.5, 1.0); rosette(Vector3(-16.3, 0, -13.5), 1.3); meander(-19.35, -16.35, -13.2, -10.7)
	parapet(Vector3(-19.8, 0, -16.8), Vector3(-19.8, 0, -10.6)); parapet(Vector3(-19.8, 0, -16.8), Vector3(-17.15, 0, -16.8)); parapet(Vector3(-15.45, 0, -16.8), Vector3(-13.1, 0, -16.8))
	parapet(Vector3(-19.8, 0, -10.6), Vector3(-13.1, 0, -10.6)); parapet(Vector3(-13.1, 0, -16.8), Vector3(-13.1, 0, -13.75)); parapet(Vector3(-13.1, 0, -12.25), Vector3(-13.1, 0, -10.6))
	statue_on("statue_veiled_unfinished", Vector3(-19.45, 0, -11.1), 1.5, 0.8); plinth_head("kit_face1", Vector3(-19.45, 0, -14.6), PI * 0.5)
	tree(Vector3(-19.4, 0, -16.4), 1.1, "leaf3"); lantern(Vector3(-13.35, 0, -10.85), 4, -1.0); cypress(Vector3(-13.5, 0, -16.45), 2.2)
	urn(Vector3(-18.6, 0, -16.4), 1.0); urn(Vector3(-18.35, 0, -16.25), 0.7, "rose")
	slab(-16.9, -20.0, -15.7, -16.9, 0.0); pier(-16.3, -18.4, -0.18, 0.8)
	ring_gate(Vector3(-16.3, WATER, -18.4), 2.5)
	# ---- F. the mirror garden (8 x 7 m)
	slab(-20.5, -27.0, -12.5, -20.0, 0.0); under(-20.5, -27.0, -12.5, -20.0)
	tiles(-19.4, -26.6, -12.5, -20.0, 1.0); rosette(Vector3(-17.0, 0, -23.5), 1.3); meander(-19.25, -26.45, -15.0, -20.2)
	var w1 := CSGBox3D.new(); w1.size = Vector3(1.1, 3.0, 1.9); w1.position = Vector3(MX - 0.55, 1.5, MZ); w1.material = pal("stone")
	var n1 := CSGBox3D.new(); n1.operation = CSGShape3D.OPERATION_SUBTRACTION; n1.size = Vector3(1.0, 2.2, 1.2)
	n1.position = Vector3(0.06, -0.4, 0.0); n1.material = pal("teal"); w1.add_child(n1); add_child(w1)
	cornice(MX - 1.1, MZ - 0.95, MX, MZ + 0.95, 3.0); dentils(MX - 1.1, MZ - 0.95, MX, MZ + 0.95, 3.0); crenels(Vector3(MX, 3.06, MZ - 0.85), Vector3(MX, 3.06, MZ + 0.87), 0.287)
	for fz in [MZ - 0.64, MZ + 0.6]: blk(Vector3(MX - 0.02, 0, fz), Vector3(MX + 0.03, 2.24, fz + 0.04), "gold")
	blk(Vector3(MX - 0.02, 2.2, MZ - 0.64), Vector3(MX + 0.03, 2.24, MZ + 0.64), "gold")
	var gq := QuadMesh.new(); gq.size = Vector2(1.2, 2.2)
	prim(gq, Vector3(MX - 0.012, 1.1, MZ), mat(Color(0.62, 0.86, 0.92, 0.09))).rotation.y = PI * 0.5
	blk(Vector3(MX - 1.1, 0, -27.0), Vector3(MX, 2.2, MZ - 0.95), "stone"); blk(Vector3(MX - 1.1, 0, MZ + 0.95), Vector3(MX, 1.2, -20.0), "stone")
	cornice(MX - 1.1, MZ + 0.95, MX, -20.0, 1.2, 0.03, 0.05); cornice(MX - 1.1, -27.0, MX, MZ - 0.95, 2.2, 0.03, 0.05)
	bush(Vector3(MX - 0.5, 1.2, -20.5), 1.1); bush(Vector3(MX - 0.55, 1.2, -21.4), 0.9, "leaf3"); cypress(Vector3(MX - 0.55, 1.2, -22.1), 2.0)
	var rq := QuadMesh.new(); rq.size = Vector2(2.4, 2.4)
	ripple = prim(rq, Vector3.ZERO, ring_mat(Vector3(1.0, 0.36, 0.40))); ripple.rotation.y = PI * 0.5
	var w2 := CSGBox3D.new(); w2.size = Vector3(6.9, 2.7, 0.4); w2.position = Vector3(-15.95, 1.35, -26.8); w2.material = pal("stone")
	var d1 := CSGBox3D.new(); d1.operation = CSGShape3D.OPERATION_SUBTRACTION; d1.size = Vector3(0.9, 1.6, 0.6)
	d1.position = Vector3(DX + 15.95, -0.55, 0); d1.material = pal("shade"); w2.add_child(d1)
	var d2 := CSGCylinder3D.new(); d2.operation = CSGShape3D.OPERATION_SUBTRACTION; d2.radius = 0.45; d2.height = 0.6; d2.sides = 32
	d2.rotation.x = PI * 0.5; d2.position = Vector3(DX + 15.95, 0.25, 0); d2.material = pal("shade"); w2.add_child(d2)
	add_child(w2)
	cornice(MX, -27.0, -12.5, -26.6, 2.7); dentils(MX, -27.0, -12.5, -26.6, 2.7); crenels(Vector3(MX + 0.15, 2.76, -26.63), Vector3(-12.6, 2.76, -26.63), 0.31)
	blk(Vector3(DX - 0.47, 0, -26.99), Vector3(DX + 0.47, 2.1, -26.98), "cream")
	door = blk(Vector3(DX - 0.47, 0, -26.84), Vector3(DX + 0.47, 2.1, -26.76), "crim"); door.name = "Door"
	for py in [0.25, 1.15]:
		for px in [-0.36, 0.04]: blk(Vector3(px, py - 1.05, 0.04), Vector3(px + 0.32, py - 0.35, 0.05), "crim2", door)
	banner(Vector3(-14.3, 2.25, -26.585), 0.34, 1.15); banner(Vector3(-18.3, 2.25, -26.585), 0.34, 1.15)
	for wx in [-13.3, -17.5]: win_z(wx, 0.3, -26.6, 0.4, 0.9)
	statue_on("statue_veiled_mourning", Vector3(-18.9, 0, -20.45), 1.8, 0.8); statue_on("statue_veiled_praying", Vector3(-15.2, 0, -26.3), 1.8, 0.2)
	plinth_head("kit_face5", Vector3(-19.0, 0, -26.25), 0.6)
	pool(-14.4, -25.4, -13.2, -22.0); model("statue_veiled_kneeling", Vector3(-14.72, 0, -23.7), 1.1, PI * 0.5)
	for lp in [Vector3(-13.9, 0.016, -24.6), Vector3(-13.6, 0.016, -23.2), Vector3(-14.1, 0.016, -22.5)]:
		cyl(lp, 0.09, 0.09, 0.004, pal("leaf2"), 14); ball(lp + Vector3(0.02, 0.02, 0), 0.025, pal("leaf3"))
	lantern(Vector3(-15.2, 0, -20.25), 5, -1.0); cypress(Vector3(-12.95, 0, -26.2), 2.3)
	blk(Vector3(MX + 0.1, 0, MZ - 0.45), Vector3(MX + 0.95, 0.004, MZ + 0.45), "shade"); blk(Vector3(MX + 0.15, 0, MZ - 0.4), Vector3(MX + 0.9, 0.006, MZ + 0.4), "stone")
	blk(Vector3(DX - 0.03, 0, -26.6), Vector3(DX + 0.03, 0.005, -25.2), "crim")
	slab(-20.5, -28.8, -12.5, -27.0, 0.0, "sand"); under(-20.5, -28.8, -12.5, -27.0, 0.22, "sand")
	tree(Vector3(-18.6, 0, -27.8), 1.5); tree(Vector3(-13.6, 0, -27.9), 1.35, "leaf3"); cypress(Vector3(-15.0, 0, -28.2), 2.9); cypress(Vector3(-17.4, 0, -28.3), 2.4)
	# ---- the sea around: colossi, ruins, vines, mist
	model("observer_veiled", Vector3(-31.0, WATER - 1.2, -27.0), 11.0, 0.75)
	model("kit_face5", Vector3(-4.5, WATER - 1.15, -21.5), 4.4, 0.7, Vector3(0.2, 0, -0.15))
	model("kit_face2", Vector3(-10.0, WATER - 1.15, -4.2), 4.1, 0.5, Vector3(-0.15, 0, 0.12))
	var ped := Node3D.new(); ped.position = Vector3(5.2, WATER - 0.12, 5.9); ped.rotation = Vector3(0.1, 0.5, 0.14); add_child(ped)
	var pm := PrismMesh.new(); pm.size = Vector3(2.4, 0.7, 0.5)
	prim(pm, Vector3(0, 0.53, 0), pal("stone"), ped)
	blk(Vector3(-1.28, 0.0, -0.3), Vector3(1.28, 0.18, 0.3), "shade", ped); blk(Vector3(-1.22, 0.1, -0.27), Vector3(1.22, 0.2, 0.27), "stone", ped)
	var pm2 := PrismMesh.new(); pm2.size = Vector3(1.5, 0.4, 0.02)
	prim(pm2, Vector3(0, 0.44, 0.255), pal("shade"), ped)
	foam(4.1, 5.4, 6.3, 6.4, 0.3)
	model("column_fallen", Vector3(-24.5, WATER - 0.25, -12.5), 0.6, 0.9)
	for cp in [Vector3(6.6, 0, -4.8), Vector3(7.6, 0, -6.0), Vector3(-4.6, 0, -9.2), Vector3(-9.0, 0, -17.4), Vector3(-10.2, 0, -18.4), Vector3(-22.6, 0, -8.8), Vector3(-23.6, 0, -19.6), Vector3(-9.0, 0, -24.4)]:
		cyl(Vector3(cp.x, -2.45, cp.z), 0.3, 0.3, 2.45 + WATER + 0.12, pal("shade"), 20)
		column(Vector3(cp.x, WATER + 0.12, cp.z), 2.6 + 0.9 * sin(cp.x * 3.0), 0.19, int(absf(cp.x * 10.0)) % 2 == 0)
		foam(cp.x - 0.3, cp.z - 0.3, cp.x + 0.3, cp.z + 0.3, 0.3)
	vine(-3.6, 3.52, true, 1.8); vine(3.52, -3.4, false, 1.4); vine(-3.2, -9.98, true, 1.6); vine(3.52, -15.6, false, 2.0)
	vine(-19.6, -10.48, true, 2.4); vine(-12.98, -16.4, false, 1.6); vine(-20.2, -19.98, true, 2.6); vine(-12.48, -25.6, false, 2.2)
	# crimson veils in the wind, mirrors, the tree of shards, reeds and rocks
	for sp in [[Vector3(-7.3, 2.72, 1.9), 2.6], [Vector3(0.0, 2.95, -3.9), 1.9], [Vector3(-16.3, WATER + 2.72, -18.4), 2.4], [Vector3(MX - 0.5, 3.12, MZ + 0.9), 2.2],
			[Vector3(6.6, WATER + 2.3, -4.8), 2.0], [Vector3(-9.0, WATER + 3.0, -17.4), 2.3], [Vector3(-22.6, WATER + 2.5, -8.8), 2.1], [Vector3(3.4, 1.75, -16.3), 1.8]]:
		streamer(sp[0], sp[1], 0.32)
		cyl(sp[0] + Vector3(0, -0.2, 0), 0.012, 0.012, 0.4, pal("dark"), 6)
	mirror_stand(Vector3(-17.9, 0, -16.5), 0.2); mirror_stand(Vector3(-14.7, 0, -16.5), -0.2); mirror_stand(Vector3(-3.05, 0, -14.6), PI * 0.5)
	shard_tree(Vector3(-13.7, 0, -20.9))
	reeds(Vector3(-1.9, 0, 4.4)); reeds(Vector3(4.4, 0, 3.0), 7); reeds(Vector3(-4.6, 0, -11.2)); reeds(Vector3(-12.2, 0, -10.0), 8); reeds(Vector3(-20.8, 0, -18.6)); reeds(Vector3(-11.8, 0, -21.6), 7)
	rock(Vector3(6.0, 0, 4.2), 1.2); rock(Vector3(6.9, 0, 3.6), 0.7); rock(Vector3(-6.4, 0, -7.2), 1.0); rock(Vector3(-22.0, 0, -13.2), 1.3); rock(Vector3(-10.8, 0, -22.8), 0.9); rock(Vector3(5.6, 0, -8.8), 1.0)
	for mp in [Vector3(6.5, WATER + 0.3, 8.5), Vector3(-13.0, WATER + 0.3, 3.5), Vector3(9.5, WATER + 0.4, -12.0), Vector3(-25.0, WATER + 0.3, -4.0),
			Vector3(-4.0, WATER + 0.4, -26.0), Vector3(-27.0, WATER + 0.3, -18.0), Vector3(-2.0, WATER + 0.2, 9.5), Vector3(-9.0, WATER + 0.3, -31.0)]:
		var mh := halo(11.0 + 2.0 * sin(mp.x), Color(mist_c.r, mist_c.g, mist_c.b, 0.14))
		(mh.material_override as StandardMaterial3D).blend_mode = BaseMaterial3D.BLEND_MODE_MIX
		mh.position = mp; add_child(mh)

func _actors() -> void:
	var veil := cloth(Color("f1f1f4"), Color("dcdce4"))
	var face := ShaderMaterial.new(); face.shader = shaders["face"]; timed.append(face)
	face_m = face; veil_m = veil
	fig = Fig.new(); add_child(fig); fig.set_style(hero_style); fig.build(0, pal, veil, face)
	var wm := Node3D.new(); wm.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * WATER, 0)); add_child(wm)
	wfig = Fig.new(); wm.add_child(wfig); wfig.set_style(hero_style); wfig.build(2, pal, veil, face)
	var mir := Node3D.new()
	mir.transform = Transform3D(Basis(Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, 0, 1)), Vector3(2.0 * MX, 0, 0))
	add_child(mir)
	ghost = Fig.new(); mir.add_child(ghost); ghost.set_style(hero_style); ghost.build(1, pal, veil, face)
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
	lamp = Node3D.new(); add_child(lamp); lamp.position = Vector3(0, -50, 0); lamp.visible = false; lamp_energy = 0.0
	ball(Vector3.ZERO, 0.055, mat(Color("ffd98a")), lamp)
	cyl(Vector3(0, 0.055, 0), 0.07, 0.01, 0.055, pal("gold"), 16, lamp); cyl(Vector3(0, -0.082, 0), 0.04, 0.055, 0.028, pal("gold"), 16, lamp)
	var ring := TorusMesh.new(); ring.inner_radius = 0.02; ring.outer_radius = 0.031
	prim(ring, Vector3(0, 0.14, 0), pal("gold"), lamp).rotation.x = PI * 0.5
	lamp_halo = halo(1.0, Color(1.0, 0.78, 0.42, 0.55)); lamp.add_child(lamp_halo)
	door_halo = halo(3.2, Color(1.0, 0.86, 0.6, 0.5)); door_halo.position = Vector3(DX, 1.0, -26.7); add_child(door_halo)
	for i in 3:
		var gn := Node3D.new(); add_child(gn)
		for sgn in [-1.0, 1.0]:
			var wq := QuadMesh.new(); wq.size = Vector2(0.3, 0.09)
			var wn2 := Node3D.new(); gn.add_child(wn2)
			prim(wq, Vector3(sgn * 0.15, 0, 0), mat(Color(0.98, 0.97, 0.95)), wn2).rotation.x = -PI * 0.5
		gulls.append(gn)
	ghost_flat = StandardMaterial3D.new(); ghost_flat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ghost_flat.cull_mode = BaseMaterial3D.CULL_DISABLED; ghost_flat.albedo_color = Color("b8232f")
	if hero_real:
		H["main"] = spawn_her(self, "tex"); H["refl"] = spawn_her(wm, "crim"); H["ghost"] = spawn_her(mir, "flat")
		for k in H:
			var sk: Skeleton3D = H[k].sk
			if sk != null:
				var hm := HerMod.new(); hm.main = self; sk.add_child(hm)
			if H[k].ap != null: H[k].ap.play("idle")
		fig.visible = false; wfig.visible = false
	if shape_file != "":
		SHP["main"] = spawn_shape(self, "main"); SHP["refl"] = spawn_shape(wm, "crim"); SHP["ghost"] = spawn_shape(mir, "flat")
		fig.visible = false; wfig.visible = false
	# things to tap
	objs["capstan"] = {"at": CAP + Vector3(0, 0.9, 0), "stand": CAP + Vector3(0, 0, 0.66)}
	objs["mirror"] = {"at": Vector3(MX, 1.2, MZ), "stand": Vector3(MX + 0.52, 0, MZ)}
	for k in objs:
		var n := Node3D.new(); add_child(n); n.position = objs[k].at + Vector3(0, 0.55 if k != "mirror" else 1.35, 0)
		var d := blk(Vector3(-0.05, -0.05, -0.05), Vector3(0.05, 0.05, 0.05), "crim", n)
		d.material_override = mat(Color("ff5a62")); d.rotation = Vector3(0.6155, PI * 0.25, 0)
		var h := halo(0.5, Color(1.0, 0.4, 0.42, 0.5)); n.add_child(h)
		markers[k] = n

func _nav() -> void:
	for r in [["A", -3.15, -3.15, 3.15, 3.15], ["S", 3.15, 0.7, 4.6, 1.3], ["B1", -0.25, -5.8, 0.25, -3.15], ["Bg", -0.25, -7.8, 0.25, -5.8], ["B2", -0.25, -10.35, 0.25, -7.8],
			["C", -2.65, -15.65, 3.0, -10.35], ["Cw", -4.2, -13.25, -2.65, -12.75], ["BR", -7.6, -13.25, -4.2, -12.75], ["D", -13.35, -13.25, -7.6, -12.75],
			["E", -19.15, -16.15, -13.35, -10.85], ["G1", -16.55, -20.35, -16.05, -16.15], ["F", -18.9, -26.2, -15.0, -20.35], ["G", -16.5, -28.3, -16.1, -26.2]]:
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
	var sg := Gradient.new(); sg.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	sg.colors = PackedColorArray([Color(1.0, 0.9, 0.74, 0.22), Color(1.0, 0.86, 0.72, 0.08), Color(1.0, 0.86, 0.72, 0)])
	var sgt := GradientTexture2D.new(); sgt.gradient = sg; sgt.fill = GradientTexture2D.FILL_RADIAL; sgt.fill_from = Vector2(0.5, 0.5); sgt.fill_to = Vector2(1.0, 0.5); sgt.width = 128; sgt.height = 128
	var sun := TextureRect.new(); sun.texture = sgt; sun.stretch_mode = TextureRect.STRETCH_SCALE; sun.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sun.size = Vector2(1300, 1300); sun.position = Vector2(180, -560)
	var scm := CanvasItemMaterial.new(); scm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD; sun.material = scm; sun.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(sun)
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
		rem_dist = left
		target = minf(speed_cap, sqrt(2.0 * (2.4 if shape_file != "" else 3.0 if rig_file != "" else 1.1) * left) + 0.03)
		if to.length() > 0.02: want_yaw = atan2(to.x, to.z)
		target *= clampf(1.25 - absf(angle_difference(yaw, want_yaw)) * 0.8, 0.25, 1.0)
		spd = move_toward(spd, target, (3.4 if shape_file != "" else (1.5 if speed_cap <= WALK else 2.6)) * dt)
		var step := spd * dt
		if step >= to.length():
			pos.x = p3.x; pos.z = p3.z
			route.pop_front()
			if route.is_empty(): spd = 0.0; _arrive()
		else:
			var d := to.normalized(); pos.x += d.x * step; pos.z += d.z * step
		vel = Vector3(sin(yaw), 0, cos(yaw)) * spd
	else:
		spd = move_toward(spd, 0.0, 6.0 * dt); vel = Vector3.ZERO; rem_dist = 0.0
		if face_to != null:
			want_yaw = atan2(face_to.x - pos.x, face_to.z - pos.z)
			if absf(angle_difference(yaw, want_yaw)) < 0.02: face_to = null; faced.emit()
	yaw = lerp_angle(yaw, want_yaw, 1.0 - exp(-(7.5 if shape_file != "" else 4.2) * dt))
	var wk := clampf(spd / WALK, 0.0, 1.0)
	var rk := clampf((spd - WALK) / 1.2, 0.0, 1.0)
	phase += spd * dt / lerpf(0.92, 1.15, rk) * PI
	if pushing:
		var ph := atan2(pos.x - CAP.x, pos.z - CAP.z)
		var th := ph - 0.42
		cap_rot.rotation.y = th
		bridge.rotation.y = PI * 0.5 * (1.0 - smoothstep(0.0, 1.0, clampf(-ph / (PI * 0.5), 0.0, 1.0)))
		var dir := Vector3(sin(th), 0, cos(th))
		tgtR = CAP + Vector3(0, 0.98, 0) + dir * 0.5; tgtL = CAP + Vector3(0, 0.98, 0) + dir * 0.74
	var lv := Vector2(vel.x * cos(yaw) - vel.z * sin(yaw), vel.x * sin(yaw) + vel.z * cos(yaw))
	sway_v += ((-lv * 0.17 + Vector2(sin(t * 0.6), cos(t * 0.45)) * 0.02 - sway) * 16.0 - sway_v * 3.4) * dt
	sway += sway_v * dt
	var hy := a_hy
	if look_at_pt != null: hy += clampf(angle_difference(yaw, atan2(look_at_pt.x - pos.x, look_at_pt.z - pos.z)), -1.0, 1.0)
	head_yaw = lerpf(head_yaw, hy, 1.0 - exp(-5.0 * dt))
	var breath := sin(t * 1.7)
	var st := {
		"pos": pos, "yaw": yaw, "dt": dt, "phase": phase, "wk": wk,
		"wind": Vector3(0.10 + 0.07 * sin(t * 0.7), 0, -0.05 + 0.05 * sin(t * 1.1 + 1.0)) - vel * 0.16,
		"bob": 0.02 + 0.013 * sin(t * 1.3) + 0.005 * (wk + rk) * (0.5 - 0.5 * cos(2.0 * phase)), "tm": t,
		"drop": a_drop, "lean": 0.045 * wk + 0.1 * rk + a_lean + 0.008 * breath,
		"roll": 0.012 * wk * sin(phase) + 0.012 * sin(t * 0.8), "twist": (0.02 + 0.04 * rk) * wk * sin(phase) + head_yaw * 0.18,
		"sway": sway, "pool": a_pool, "kick": 0.5 * wk * sin(phase),
		"head_yaw": head_yaw * 0.82, "head_pitch": a_headp + 0.03 * wk,
		"swingL": ((0.03 + 0.08 * rk) * wk * sin(phase) + 0.012 * sin(t * 0.9)) * (1.0 - a_wL), "swingR": (-(0.03 + 0.08 * rk) * wk * sin(phase) + 0.012 * sin(t * 0.9 + 1.7)) * (1.0 - a_wR),
		"hold": a_hold, "raise": a_raise, "open": a_open, "wL": a_wL, "wR": a_wR, "tL": tgtL, "tR": tgtR,
	}
	fig.apply(st); wfig.apply(st)
	for k in ["Bridge", "Cap", "Door", "Boat"]: (refl.get_node(k) as Node3D).transform = (world.get_node(k) as Node3D).transform
	var near := smoothstep(MX + 2.2, MX + 1.5, pos.x) * smoothstep(MZ - 0.8, MZ - 0.5, pos.z) * smoothstep(MZ + 0.8, MZ + 0.5, pos.z)
	ghost.visible = (not hero_real) and shape_file == "" and near > 0.01
	if shape_file != "":
		var R := rig_of(shape_file)
		gph += spd * dt / lerpf(GT.step, 0.85, rk) * PI
		gait = lerpf(gait, clampf(spd / 0.8, 0.0, 1.0) * (1.0 + 0.3 * rk), 1.0 - exp(-9.0 * dt))
		var gp := gph - 0.37
		hover = 0.003 * sin(t * 1.3) - GT.bob * gait * cos(2.0 * gp)
		var turn := angle_difference(yaw_prev, yaw) / maxf(dt, 0.001); yaw_prev = yaw
		tilt_r = lerpf(tilt_r, clampf(-turn * 0.02, -0.05, 0.05), 1.0 - exp(-5.0 * dt))
		tilt_f = lerpf(tilt_f, GT.lean * wk + 0.04 * rk + clampf((spd - spd_prev) / maxf(dt, 0.001) * 0.005, -0.012, 0.012) + a_lean, 1.0 - exp(-5.0 * dt)); spd_prev = spd
		var side: Vector3 = Vector3(cos(yaw), 0, -sin(yaw)) * (float(GT.shift) * gait * sin(gp))
		for k in SHP:
			var sh: Node3D = SHP[k].holder
			sh.position = pos + side + Vector3(0, hover, 0); sh.rotation = Vector3(tilt_f, yaw + head_yaw * 0.4, tilt_r - 0.012 * gait * sin(gp))
		var lg := leg_pose(gph, 1.0, gait * GT.stride, R); var rg := leg_pose(gph + PI, -1.0, gait * GT.stride, R)
		var l0 := leg_pose(0.0, 1.0, 0.0, R); var r0 := leg_pose(0.0, -1.0, 0.0, R)
		for bm in body_mats:
			bm.set_shader_parameter("trail", Vector3(sway.x, 0.0, sway.y) * GT.trail)
			bm.set_shader_parameter("hipL", lg[0]); bm.set_shader_parameter("kneeL", lg[1]); bm.set_shader_parameter("footL", lg[2])
			bm.set_shader_parameter("hipR", rg[0]); bm.set_shader_parameter("kneeR", rg[1]); bm.set_shader_parameter("footR", rg[2])
			bm.set_shader_parameter("rkneeL", l0[1]); bm.set_shader_parameter("rfootL", l0[2]); bm.set_shader_parameter("rkneeR", r0[1]); bm.set_shader_parameter("rfootR", r0[2])
			bm.set_shader_parameter("leg_zc", R.zc)
			bm.set_shader_parameter("armp", R.arm); bm.set_shader_parameter("arm_on", R.arm_on); bm.set_shader_parameter("adduct", R.adduct)
			bm.set_shader_parameter("swing", Vector2(-GT.arm * gait * cos(gph), GT.arm * gait * cos(gph)) + Vector2(0.012 * sin(t * 0.9), 0.012 * sin(t * 0.9 + 1.7)))
			bm.set_shader_parameter("pelv", -GT.pelv * gait * cos(gph)); bm.set_shader_parameter("shtw", GT.shtw * gait * cos(gph))
		(SHP["ghost"].holder as Node3D).visible = near > 0.01
	if ghost.visible: ghost.apply(st)
	var moving := spd > 0.15
	if rig_file != "": moving = spd > 0.2 if walk_on else (not route.is_empty() and rem_dist > 0.05)
	for fm in floor_mats: fm.set_shader_parameter("floor_y", pos.y)
	if moving != walk_on:
		walk_on = moving
		for h in H.values():
			if h.ap != null: h.ap.play("walk" if moving else "idle", (0.25 if moving else 0.4) if rig_file != "" else 0.25)
	for k in H:
		var hd: Node3D = H[k].holder
		hd.position = pos; hd.rotation.y = yaw
		if H[k].ap != null: H[k].ap.speed_scale = clampf(spd / 1.1, 0.45 if rig_file != "" else 0.7, 2.3) if moving else 1.0
	if hero_real: (H["ghost"].holder as Node3D).visible = near > 0.01
	var prox := clampf(1.0 - (pos.x - MX - 0.5) / 1.4, 0.0, 1.0)
	flash = move_toward(flash, 0.0, dt * 0.7)
	ghost_flat.albedo_color = TEAL_D.lerp(CRIMSON, near * (0.3 + 0.7 * prox)).lerp(Color("ff5a62"), flash)
	ghost.ghost_mat.albedo_color = ghost_flat.albedo_color
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
	lights[1] = Vector4(DX, 0.8, -26.5, door_energy)
	var cc := cam_t if shot == null else (shot.c as Vector3)
	for m in pmats.values():
		for i in 6: m.set_shader_parameter("l%d" % i, lights[i])
		m.set_shader_parameter("centre", cc); m.set_shader_parameter("mist_r", maxf(cam.size * 0.64, 6.5))
	for fm in fogs:
		fm.set_shader_parameter("hero", cc); fm.set_shader_parameter("far_a", maxf(cam.size * 0.3, 3.5)); fm.set_shader_parameter("far_b", maxf(cam.size * 0.95, 10.0))
	sea_mat.set_shader_parameter("centre", cc); sea_mat.set_shader_parameter("mist_r", maxf(cam.size * 0.64, 6.5)); sea_mat.set_shader_parameter("time_s", t)
	for m in timed: m.set_shader_parameter("time_s", t)
	for i in gulls.size():
		var gn: Node3D = gulls[i]
		var ga := t * (0.16 + 0.03 * i) + i * 2.1
		gn.position = cam_t + Vector3(cos(ga) * (4.0 + i), 3.2 + i * 0.6 + 0.3 * sin(t * 0.7 + i), sin(ga) * (3.0 + i * 0.8)) + Vector3(-1.5, 0, -1.5)
		gn.rotation.y = -ga
		var flap := sin(t * 5.0 + i) * 0.45
		(gn.get_child(0) as Node3D).rotation.z = -flap; (gn.get_child(1) as Node3D).rotation.z = flap
	boat.position.y = WATER - 0.12 + 0.03 * sin(t * 1.1); boat.rotation.z = 0.04 * sin(t * 0.8)
	blob.visible = false
	for k in markers:
		var n: Node3D = markers[k]
		n.visible = started and not done.has(k) and shot == null
		n.position.y = objs[k].at.y + (0.55 if k != "mirror" else 1.35) + 0.05 * sin(t * 2.4)
		n.rotation.y = t * 1.2
	if rig_file != "": cam_t = cam_t.lerp(pos + vel * 0.25, 1.0 - exp(-4.0 * dt))
	else: cam_t = cam_t.lerp(pos + vel * 0.55, 1.0 - exp(-2.4 * dt))
	cam.position = cam_t + cam.basis.y * (1.9 if cam.size > 5.0 else 0.85) + cam.basis.z * 34.0
	if shot != null: cam.position = (shot.c as Vector3) + cam.basis.z * 34.0
	if started and not ended and pos.z < -27.2: _end()

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
	return create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT).set_speed_scale(0.7)

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

func _do_mirror() -> void:
	await face(Vector3(MX, 0, MZ))
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
	get_tree().create_timer(140.0).timeout.connect(func() -> void: print("AUTO watchdog at ", pos, " busy ", busy, " pending ", pending); get_tree().quit())
	await wait(1.2)
	tap(Vector2(360, 600))
	await wait(1.0)
	await _a_walk(Vector3(-1.8, 0, 1.6))
	_self(); await settled
	await _a_walk(Vector3(4.4, 0, 1.0))
	await wait(0.5)
	await _a_use("capstan")
	await _a_walk(Vector3(-16.3, 0, -13.5), 2.7)
	_self(); await settled
	await _a_use("mirror")
	await wait(0.5)
	await _a_walk(Vector3(DX, 0, -28.2))
	await wait(3.0)
	print("AUTO done ended=", ended, " done=", done)
	get_tree().quit()

func _glide() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(0.9, 0, 1.2); yaw = 0.78; cam_t = pos; cam.size = 4.8
	for kv in OS.get_environment("GT").split(",", false): GT[kv.split("=")[0]] = float(kv.split("=")[1])
	if OS.get_environment("PROFILE") == "1":
		pos = Vector3(-2.6, 0, 1.7); yaw = atan2(1.0, -1.0); cam_t = pos + Vector3(1.2, 0, -1.2); cam.size = 3.6
		await wait(0.6)
		await go([Vector3(1.6, 0, -2.5)])
		await wait(0.5)
		get_tree().quit(); return
	await wait(1.4)
	if OS.get_environment("HIPS") == "1" and H.has("main") and H["main"].sk != null:
		var skd: Skeleton3D = H["main"].sk; var hb := _bone(skd, "Hips")
		print("HIPS idle ", skd.get_bone_global_pose(hb).origin)
		get_tree().create_timer(2.6).timeout.connect(func() -> void: print("HIPS walk ", skd.get_bone_global_pose(hb).origin, " spd ", spd))
		get_tree().create_timer(3.1).timeout.connect(func() -> void: print("HIPS walk ", skd.get_bone_global_pose(hb).origin, " spd ", spd))
	await go([Vector3(-1.9, 0, 1.7), Vector3(-2.1, 0, -1.5)])
	if OS.get_environment("HIPS") == "1" and H.has("main") and H["main"].sk != null:
		get_tree().create_timer(1.0).timeout.connect(func() -> void: print("HIPS idle after stop ", (H["main"].sk as Skeleton3D).get_bone_global_pose(_bone(H["main"].sk, "Hips")).origin))
	await wait(1.3)
	await go([Vector3(1.7, 0, -1.3)])
	await wait(1.4)
	await go([Vector3(1.3, 0, 1.5)])
	await wait(1.8)
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
