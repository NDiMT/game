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
var sepia_var := 0.0
var gate_a: Node3D
var mroot: Node3D
var winch_m: Node3D
var tile_hole := Rect2()
const AX0 := -6.5   # the first court, now wide and open around the pool
const AZ0 := -4.0
const AX1 := 3.5
const AZ1 := 5.5
const PX0 := -3.4
const PX1 := 0.6
const PZ0 := -1.0
const PZ1 := 2.4
const PED := Vector3(0.9, 0, -13.2)   # the winch of the second court's gate, on its pedestal in that court's pool
const MYPL := Vector3(PX0 - 0.5, 0, -0.6)   # her own plinth: the empty one in the row at the west rim of the pool
const CX0 := -3.4   # the second court, and its pool
const CZ0 := -16.4
const CX1 := 3.5
const CZ1 := -10.0
const COVERED := false   # the second court built as "the mirror he covered" (kept aside for a later puzzle) instead of the crossing
const QX0 := -2.15 if COVERED else -1.3   # the pool of the second court
const QX1 := -0.15 if COVERED else 2.5
const QZ0 := -15.0
const QZ1 := -11.4 if COVERED else -11.6
const WALLX := -2.85   # the face of the west wall
const WALLH := 2.3
const DOORZ := -14.0   # where the door is, in the water; on the wall itself there is plain stone
const SHEET_C := Vector3(-0.75, 0.035, -13.2)   # the middle of the cloth that lies over the pool
const SHOW_CAPSTAN := false   # the old capstan of this court is out of the way: the room is about the cloth and the wall
var winch_a: Node3D
var ped_a: Node3D         # the pedestal of the winch, which rises out of the pool when the row of statues is whole
var ped_m: Node3D
var glass2: ShaderMaterial
var gate_c: Node3D         # the grille of the second court's west gate
var door_a: Node3D        # the leaf of plain stone in the west wall, and the door the water shows in its place
var door_m: Node3D
var seam_a: Node3D        # the joints of the leaf: they show only once the door has been seen in the water
var door_seen := false    # the wall can be pushed only after the cloth is off and the door has been seen
var sheet: MeshInstance3D   # the cloth: a simulated sheet, played back frame by frame
var sheet_mesh: ArrayMesh
var sheet_data: PackedFloat32Array
var sheet_meta: Dictionary = {}
var sheet_uv: PackedVector2Array
var sheet_ix: PackedInt32Array
var sheet_f := 1.0          # where the cloth is in its simulation, in frames
var sheet_held := false
var her_mats: Array = []
var posing := false
var cam_focus_on := false
var cam_focus := Vector3.ZERO
var refl_mat: ShaderMaterial
var shadow_c := Vector3(0.66, 0.66, 0.86)
var hero_style := 5
var hero_src: Node3D
var H := {}
var ghost_flat: StandardMaterial3D
var walk_on := false
var yaw_v := 0.0          # how fast she is turning: her turns start and end gently
var turn_amt := 0.0       # how far she still has to turn on the spot
var pose_k := 0.0         # 0 moving as usual .. 1 held still as a statue
var rem_dist := 0.0
var floor_mats: Array = []
var rig_norm := {}
var statue_cream := true
var hero_src_yaw_note := true
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
	"cyp": ["4a8576", "316863", "214858"], "terra": ["ecd6c6", "d6b8a8", "a08a9e"], "linen": ["f3ecdc", "ddd0bd", "a99db2"], "rope": ["c99f76", "a67d5c", "7a5e5e"], "wood": ["b98f7a", "9a7064", "6c4e5e"], "clay": ["d2603f", "ad4732", "7c302d"],
	"marble": ["fffbf5", "f0e5de", "bfb6d0"], "crim2": ["ee5a60", "cf3640", "8f2238"],
}
const SH := """shader_type spatial;
render_mode ambient_light_disabled, specular_disabled;
uniform vec3 c_top : source_color; uniform vec3 c_z : source_color; uniform vec3 c_x : source_color;
uniform vec3 fog_col : source_color;
uniform vec4 l0; uniform vec4 l1; uniform vec4 l2; uniform vec4 l3; uniform vec4 l4; uniform vec4 l5;
uniform float sway = 0.0; uniform float time_s = 0.0; uniform float marble = 0.0; uniform float tone_var = 0.0; uniform float rim = 0.0; uniform float flat_n = 0.0; uniform vec3 shadow_col = vec3(0.66, 0.66, 0.86); uniform float mist_k = 0.96; uniform vec3 centre; uniform float mist_r = 7.0; uniform vec3 mist_col : source_color;
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
		if (tone_var > 0.0) {
			float tv = fbm(wp * 0.33 + 31.0); float tv2 = fbm(wp * 0.9 + vec3(57.0, 3.0, 9.0));
			vec3 tone = mix(vec3(1.04, 1.045, 1.06), vec3(0.96, 0.92, 0.845), smoothstep(0.3, 0.7, tv));
			tone *= mix(vec3(1.0), vec3(0.975, 0.945, 0.895), smoothstep(0.52, 0.78, tv2) * 0.75);
			col *= mix(vec3(1.0), tone, tone_var);
		}
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
## the glass of a standing mirror. It shows what stands before it: the ray from the eye is turned back off the glass and
## followed step by step through the picture already drawn, until it meets something (the floor, a post, her). What the
## screen shows there is what the glass shows, a little cool and a little pale, with two slow glints across it
const SH_MIRROR := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;
uniform float ground_y = 0.0; uniform float time_s = 0.0;
varying vec3 wp; varying vec3 wn;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment(){
	vec3 v = -normalize(INV_VIEW_MATRIX[2].xyz);
	vec3 n = normalize(wn); if (dot(n, v) > 0.0) n = -n;
	vec3 r = reflect(v, n);
	vec2 wob = vec2(sin(wp.y * 9.0 + time_s * 0.7), cos(wp.x * 7.0 + time_s * 0.5)) * 0.0009;
	float hit = 0.0; vec2 huv = vec2(0.0); float t = 0.12; float st = 0.07; float t0 = 0.0;
	for (int i = 0; i < 40; i++) {
		vec4 vq = VIEW_MATRIX * vec4(wp + r * t, 1.0);
		vec4 cq = PROJECTION_MATRIX * vq; vec2 uv = cq.xy / cq.w * 0.5 + 0.5;
		if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
		vec4 sv = INV_PROJECTION_MATRIX * vec4(uv * 2.0 - 1.0, textureLod(depth_tex, uv, 0.0).r * 2.0 - 1.0, 1.0);
		float dz = sv.z / sv.w - vq.z;                                     // how far behind what is drawn there the ray now is
		if (dz > 0.0 && dz < 1.1) { hit = 1.0; huv = uv; break; }
		t0 = t; t += st; st *= 1.06;
	}
	if (hit > 0.5) {                                                         // close in on the place it went behind
		float a = t0; float b = t;
		for (int k = 0; k < 5; k++) {
			float m = (a + b) * 0.5;
			vec4 vq = VIEW_MATRIX * vec4(wp + r * m, 1.0);
			vec4 cq = PROJECTION_MATRIX * vq; vec2 uv = cq.xy / cq.w * 0.5 + 0.5;
			vec4 sv = INV_PROJECTION_MATRIX * vec4(uv * 2.0 - 1.0, textureLod(depth_tex, uv, 0.0).r * 2.0 - 1.0, 1.0);
			if (sv.z / sv.w - vq.z > 0.0) { b = m; huv = uv; } else a = m;
		}
	} else {                                                                 // nothing met: the ground (or the sea) further off
		vec3 q = wp + r * clamp((wp.y - ground_y) / max(-r.y, 0.08), 0.25, 9.0);
		vec4 cp = PROJECTION_MATRIX * (VIEW_MATRIX * vec4(q, 1.0));
		huv = cp.xy / cp.w * 0.5 + 0.5;
		hit = step(0.0, huv.x) * step(huv.x, 1.0) * step(0.0, huv.y) * step(huv.y, 1.0);
	}
	vec3 sky = mix(vec3(0.52, 0.74, 0.84), vec3(0.8, 0.92, 0.96), UV.y);
	vec3 c = mix(sky, textureLod(screen_tex, clamp(huv + wob, 0.0, 1.0), 0.6).rgb, hit);
	c = (c - 0.62) * 1.2 + 0.62;                                                           // silvered glass: deeper than the day it shows,
	c = mix(c, sky, 0.5 * (1.0 - smoothstep(0.15, 0.6, dot(c, vec3(0.3, 0.5, 0.2)))));     // but never a dark hole: the dark sea comes back pale,
	c = mix(c, sky, 0.14 + 0.2 * smoothstep(0.4, 1.0, UV.y)) * vec3(0.8, 0.91, 0.98);      // cooler, and paler towards its head
	vec2 e = min(UV, 1.0 - UV);
	c *= 0.8 + 0.2 * smoothstep(0.0, 0.07, min(e.x * 2.2, e.y));                           // the frame's shadow round the edge
	float d = UV.x * 0.62 - UV.y * 0.5 + time_s * 0.012;
	float g = smoothstep(0.085, 0.07, abs(fract(d) - 0.42)) * 0.13 + smoothstep(0.022, 0.014, abs(fract(d) - 0.6)) * 0.2;
	ALBEDO = c + vec3(g);
}"""
## the cloth over the pool: its folds come from a simulation, so the shader only has to light them
const SH_SHEET := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform vec3 base : source_color = vec3(0.8, 0.36, 0.25); uniform float mean_l = 0.2;
varying vec3 wn;
void vertex(){ wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment(){
	vec3 n = normalize(wn); if (!FRONT_FACING) n = -n;
	float ndl = clamp(dot(n, normalize(vec3(-0.5, 0.52, 0.6))), 0.0, 1.0);    // a low light, so that it rakes the folds
	float sh = 0.5 + 0.62 * ndl;
	sh *= mix(0.74, 1.0, smoothstep(0.2, 0.9, abs(n.y)));   // the steep sides of a fold lie in its own shade
	// the colour is her own terracotta; the painted cloth gives only its light and dark, the creases it was made with
	float d = clamp(dot(texture(albedo_tex, UV).rgb, vec3(0.3333)) / mean_l, 0.5, 1.45);
	ALBEDO = base * mix(1.0, d, 0.85) * sh;
}"""
## the reflection, drawn as a soft dark shape lying on the water: every vertex is mirrored in the
## water plane and slid along the view direction until it meets the surface
const SH_REFL := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform float water_y = -1.3; uniform float time_s = 0.0; uniform vec3 tint = vec3(0.04, 0.12, 0.2); uniform float strength = 1.0;
uniform float lift = 0.0; uniform float use_tex = 0.0; uniform float gain = 1.5; uniform float fade_a = 1.0; uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform vec3 under_col = vec3(0.17, 0.39, 0.47);
varying float hh; varying vec3 q;
void vertex(){
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float h = max(w.y - water_y, 0.0); hh = w.y - water_y;
	vec3 f = -normalize(INV_VIEW_MATRIX[2].xyz);
	vec3 p = vec3(w.x, water_y - h, w.z) + f * (h / min(f.y, -0.05));
	float k = clamp(h * 0.45, 0.0, 1.6);
	p.x += (sin(p.z * 2.3 + time_s * 1.2) + 0.5 * sin(p.z * 6.1 - time_s * 1.7)) * 0.05 * k;
	p.z += (sin(p.x * 2.1 + time_s * 1.0) + 0.5 * sin(p.x * 5.3 + time_s * 1.5)) * 0.05 * k;
	p.y = water_y - 0.015 + lift - min(h, 8.0) * 0.0006; q = p;   // low parts lie over high ones, always: no two shapes fight for a pixel
	VERTEX = (inverse(MODEL_MATRIX) * vec4(p, 1.0)).xyz;
}
void fragment(){
	if (hh < 0.03) discard;
	if ((q.x > -6.0 && q.x < 3.0 && q.z > -3.5 && q.z < 5.0) || (q.x > -2.9 && q.x < 3.0 && q.z > -15.9 && q.z < -10.5)) discard;   // nothing lies on the sea inside the hollow of the first court
	// the reflection thins out with height by blending into the colour of the deep water. (It used to be cut
	// into a pattern of dots, which shimmered whenever the camera moved.)
	float fade = mix(1.0, 0.3, smoothstep(1.6, 6.5, hh)) * strength * fade_a;
	vec3 c = tint;
	if (use_tex > 0.5) { vec3 tx = texture(albedo_tex, UV).rgb; float rw = smoothstep(0.08, 0.2, tx.r - tx.b); c = mix(tx * 0.92, clamp(tx * gain, 0.0, 1.0), rw); }
	ALBEDO = mix(under_col, c, fade);
}"""
## the still water of the mirror pool: almost clear, with a few slow glints
const SH_GLASS := """shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
uniform float time_s = 0.0; uniform float blur_px = 3.2; uniform float wave = 1.0; uniform float lod = 1.0;
uniform vec4 lost_rect = vec4(0.0); uniform float lost_a = 0.0; uniform float lost_x = 0.0;   // lost_x: the crossing runs along x
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	vec2 px = 1.0 / VIEWPORT_SIZE;
	// slow ripples bend what the water shows, and a small blur softens it: a reflection, not a thing to step on
	vec2 rip = vec2(sin(wp.z * 7.0 + time_s * 1.1) + 0.6 * sin(wp.x * 11.0 - time_s * 0.8), sin(wp.x * 6.0 + time_s * 0.9) + 0.6 * sin(wp.z * 13.0 + time_s * 1.3)) * px * 3.0 * wave;
	vec2 uv = SCREEN_UV + rip;
	vec3 c = textureLod(screen_tex, uv, lod).rgb * 0.2;
	for (int i = 0; i < 8; i++) {
		float a = float(i) * 0.7854;
		c += textureLod(screen_tex, uv + vec2(cos(a), sin(a)) * px * blur_px * (1.0 + 0.5 * float(i % 2)), lod).rgb * 0.1;
	}
	float l = smoothstep(0.9, 1.0, sin(wp.x * 2.3 + sin(wp.z * 1.7 + time_s * 0.45) * 1.8 + time_s * 0.22) * 0.5 + 0.5);
	float l2 = smoothstep(0.965, 1.0, sin((wp.x - wp.z) * 5.1 + time_s * 0.6) * sin(wp.z * 3.3 - time_s * 0.4) * 0.5 + 0.5);
	if (lost_a > 0.0) {   // the lost crossing: no clear shape, only a soft shadow that the water still holds
		vec2 q2 = wp.xz + vec2(sin(wp.z * 9.0 + time_s * 1.2) + 0.5 * sin(wp.z * 21.0 - time_s * 0.7), sin(wp.x * 7.0 + time_s * 0.9)) * 0.03 * wave;
		vec4 lr = lost_rect;
		if (lost_x > 0.5) { q2 = q2.yx; lr = lost_rect.yxwz; }
		float sx = smoothstep(lr.x - 0.12, lr.x + 0.1, q2.x) * (1.0 - smoothstep(lr.z - 0.1, lr.z + 0.12, q2.x));
		float sz = smoothstep(lr.y - 0.02, lr.y + 0.1, q2.y) * (1.0 - smoothstep(lr.w - 0.12, lr.w + 0.04, q2.y));
		float seg = 0.86 + 0.14 * smoothstep(-0.3, 0.5, sin((q2.y - lr.y) * 19.6));
		c = mix(c, vec3(0.12, 0.29, 0.39), sx * sz * seg * lost_a * 0.62);
	}
	c = mix(c, vec3(0.6, 0.85, 0.88), 0.24);
	c = mix(c, vec3(1.0), clamp(l * 0.3 + l2 * 0.45, 0.0, 1.0));
	ALBEDO = c;
}"""
## what the pool shows where nothing stands over it: the sky
const SH_PIT := """shader_type spatial;
render_mode unshaded, cull_front;
uniform vec3 top_c = vec3(0.73, 0.87, 0.89); uniform vec3 low_c = vec3(0.7, 0.85, 0.88); uniform float y0 = -0.2; uniform float y1 = -2.4;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){ ALBEDO = mix(top_c, low_c, clamp((wp.y - y0) / (y1 - y0), 0.0, 1.0)); }"""
const SH_SEA := """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform vec3 near_col : source_color; uniform vec3 far_col : source_color; uniform vec3 centre; uniform float mist_r = 7.0; uniform float time_s = 0.0; uniform float mist_k = 1.0;
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment(){
	if (((wp.x > -6.0 && wp.x < 3.0 && wp.z > -3.5 && wp.z < 5.0) || (wp.x > -2.9 && wp.x < 3.0 && wp.z > -15.9 && wp.z < -10.5)) && wp.y < -0.1) discard;   // the hollow under the first court holds the mirror pool
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
	if (((wp.x > -6.0 && wp.x < 3.0 && wp.z > -3.5 && wp.z < 5.0) || (wp.x > -2.9 && wp.x < 3.0 && wp.z > -15.9 && wp.z < -10.5)) && wp.y < -0.1) discard;   // the hollow under the first court holds the mirror pool
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
	if sepia_var > 0.0 and n in ["stone", "shade", "sand", "marble"]: m.set_shader_parameter("tone_var", sepia_var)
	if refl_mat != null and variant != "sway": m.next_pass = refl_mat
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

## a standing mirror: a pane in a gilt frame with a small pediment, on lion feet. Modelled in Tripo, then sorted by
## material (tools/mirror_prop.py) and painted here flat, with the world's own colours. kind: "bare", or hidden under a
## sheet: wholly ("tied", "round", "oval") or in part ("hem", "half", "low", "wide", "slip")
const MIRROR_H := {"bare": 2.1, "tied": 2.14, "hem": 2.14, "half": 2.1, "low": 2.1, "slip": 2.08, "round": 1.95, "oval": 2.0, "wide": 1.5}
func mirror_stand(p: Vector3, yaw := 0.0, parent: Node = self, ground_y := 0.0, kind := "bare", _sea := false) -> Node3D:
	var n := Node3D.new(); n.position = p; n.rotation.y = yaw; parent.add_child(n)
	var m := prop_model("mirror_" + kind, n, MIRROR_H[kind], 0.0, false, false, "cloth:linen,rope:rope,gold:gold,stone:stone,gem:crim,pane:shade", ground_y)
	_refl_margins(m)
	return n

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
	var hx0 := tile_hole.position.x; var hz0 := tile_hole.position.y; var hx1 := tile_hole.end.x; var hz1 := tile_hole.end.y; var hole := tile_hole.size.x > 0.0
	var x := x0 + step
	while x < x1 - 0.1:
		if hole and x > hx0 and x < hx1:
			blk(Vector3(x - 0.008, 0, z0 + 0.1), Vector3(x + 0.008, 0.003, hz0), "shade"); blk(Vector3(x - 0.008, 0, hz1), Vector3(x + 0.008, 0.003, z1 - 0.1), "shade")
		else: blk(Vector3(x - 0.008, 0, z0 + 0.1), Vector3(x + 0.008, 0.003, z1 - 0.1), "shade")
		x += step
	var z := z0 + step
	while z < z1 - 0.1:
		if hole and z > hz0 and z < hz1:
			blk(Vector3(x0 + 0.1, 0, z - 0.008), Vector3(hx0, 0.003, z + 0.008), "shade"); blk(Vector3(hx1, 0, z - 0.008), Vector3(x1 - 0.1, 0.003, z + 0.008), "shade")
		else: blk(Vector3(x0 + 0.1, 0, z - 0.008), Vector3(x1 - 0.1, 0.003, z + 0.008), "shade")
		z += step

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

## a sculpted marble head with some detail, for the large decorative faces
var head_cache := {}
## extra turn for each head so that all of them face the same way
var HEAD_TURN := {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0}
func _heads_lineup() -> void:
	started = true; title_box.hide(); hint.hide()
	pos = Vector3(60, 0, 60)
	var c := Vector3(0.2, 0, 0.3); var dir := Vector3(1, 0, -1).normalized()
	for i in 4:
		sculpt_head(c + dir * ((i - 1.5) * 1.5) + Vector3(0, 0.6, 0), 1.0, PI * 0.25, Vector3.ZERO, i + 1)
	await get_tree().create_timer(2.0).timeout
	shot = {"c": c + Vector3(0, 0.9, 0), "s": 7.0}; cam.size = 7.0
	await get_tree().create_timer(0.8).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/heads.png" % OS.get_environment("SHOT_DIR"))
	get_tree().quit()
func sculpt_head(p: Vector3, h: float, yaw := 0.0, tilt := Vector3(-0.12, 0, 0), variant := 1, parent: Node = self) -> Node3D:
	var file := ("head%dlp" if OS.get_environment("HEADS") != "smooth" else "head%d") % variant
	if not head_cache.has(file):
		head_cache[file] = null
		var st := GLTFState.new(); var doc := GLTFDocument.new()
		if doc.append_from_file(ProjectSettings.globalize_path("res://hero_models/%s.glb" % file), st) == OK:
			var src := doc.generate_scene(st) as Node3D
			var vs := PackedVector3Array(); var ns := PackedVector3Array(); var ix := PackedInt32Array()
			var turn := Basis(Vector3.UP, (float(OS.get_environment("HEAD_YAW")) if OS.get_environment("HEAD_YAW") != "" else -PI * 0.5) + float(HEAD_TURN.get(variant, 0.0)))
			for m in src.find_children("*", "MeshInstance3D", true, false):
				var mi := m as MeshInstance3D
				var xf := Transform3D.IDENTITY
				var nd: Node = mi
				while nd != null and nd is Node3D:
					xf = (nd as Node3D).transform * xf
					if nd == src: break
					nd = nd.get_parent()
				xf = Transform3D(turn, Vector3.ZERO) * xf
				for si in mi.mesh.get_surface_count():
					var a := mi.mesh.surface_get_arrays(si)
					var base := vs.size()
					var av: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
					var has_n: bool = a[Mesh.ARRAY_NORMAL] != null
					for i in av.size():
						vs.append(xf * av[i]); ns.append((xf.basis * (a[Mesh.ARRAY_NORMAL][i] as Vector3)).normalized() if has_n else Vector3.UP)
					if a[Mesh.ARRAY_INDEX] != null:
						for j in (a[Mesh.ARRAY_INDEX] as PackedInt32Array): ix.append(base + j)
					else:
						for j in av.size(): ix.append(base + j)
			src.free()
			var lo := Vector3.INF; var hi := -Vector3.INF
			for v in vs: lo = lo.min(v); hi = hi.max(v)
			var sc := 1.0 / maxf(hi.y - lo.y, 0.001)
			var c := Vector3((lo.x + hi.x) * 0.5, lo.y, (lo.z + hi.z) * 0.5)
			for i in vs.size(): vs[i] = (vs[i] - c) * sc
			var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_INDEX] = ix
			var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			head_cache[file] = am
			print("HEAD ", file, " verts ", vs.size())
	if head_cache[file] == null: return null
	var n := Node3D.new(); n.position = p; n.rotation = Vector3(tilt.x, yaw, tilt.z); parent.add_child(n)
	var mi2 := prim(head_cache[file], Vector3(0, -0.45 * h, 0), pal("marble", "flat2" if file.ends_with("lp") else "2"), n)
	mi2.scale = Vector3.ONE * 1.45 * h
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
func her_statue(p: Vector3, yaw: float, pose := "calm", sc := 1.0, parent: Node = self) -> Node3D:
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
	var d := spawn_her(parent, "marble")
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
		if OS.get_environment("HEADS") != "old":
			var hv := 2 if nm == "colossus_head_veiled" else 1 + int(k) % 4
			var sh := sculpt_head(pos + Vector3(0, height * 0.3, 0), height * 0.7, yaw, Vector3(-0.12 + tilt.x, 0, tilt.z), hv)
			if sh != null: return sh
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
			["mir", SH.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled, shadows_disabled;")],
			["water", SH_WATER], ["cloth", SH_CLOTH], ["sheet", SH_SHEET], ["mirror", SH_MIRROR], ["ring", SH_RING], ["sea", SH_SEA], ["refl", SH_REFL], ["glass", SH_GLASS], ["pit", SH_PIT], ["face", SH_FACE], ["foam", SH_FOAM], ["fog", SH_FOG], ["shard", SH_SHARD]]:
		var s := Shader.new(); s.code = k[1]; shaders[k[0]] = s
	if OS.get_environment("MOOD") == "moody":
		sea_c = Color("3a6a7b"); mist_c = Color("b9b4c4"); bg_c = Color("29586a"); shadow_c = Vector3(0.6, 0.61, 0.82); water_deep = Color("2a7d88"); water_shallow = Color("6fc4b8")
	if OS.get_environment("REFL") != "0":
		refl_mat = ShaderMaterial.new(); refl_mat.shader = shaders["refl"]; refl_mat.set_shader_parameter("water_y", WATER)
		refl_mat.set_shader_parameter("under_col", Vector3(bg_c.r, bg_c.g, bg_c.b))
		if OS.get_environment("REFL") != "": refl_mat.set_shader_parameter("strength", float(OS.get_environment("REFL")))
		timed.append(refl_mat)
	pals = PALS.duplicate(true)
	statue_cream = OS.get_environment("STATUES") != "white"
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
	if OS.get_environment("SEPIA") != "0":   # warm sepia cast on the world's marble so a white figure stands out
		var sep := float(OS.get_environment("SEPIA")) if OS.get_environment("SEPIA") != "" else 0.34
		sepia_var = float(OS.get_environment("SEPIA_VAR")) if OS.get_environment("SEPIA_VAR") != "" else 1.0
		for sep_name in ["stone", "shade", "sand", "marble"]:
			var src_p: Array = pals[sep_name]; var out_p := []
			for k in src_p.size():
				var c0 := Color(String(src_p[k])); var tn0 := Color(0.955, 0.875, 0.745) if k < 2 else Color(0.97, 0.92, 0.85)
				out_p.append(Color(lerpf(c0.r, c0.r * tn0.r, sep), lerpf(c0.g, c0.g * tn0.g, sep), lerpf(c0.b, c0.b * tn0.b, sep)).to_html(false))
			pals[sep_name] = out_p
	if statue_cream: pals["marble"] = (pals["stone"] as Array).duplicate(); pals["skin"] = (pals["stone"] as Array).duplicate()
	hero_real = OS.get_environment("REAL") == "1"
	if OS.get_environment("RIG") != "": rig_file = OS.get_environment("RIG") if (OS.get_environment("RIG").begins_with("hq") or OS.get_environment("RIG").begins_with("veil") or OS.get_environment("RIG").begins_with("w") or OS.get_environment("RIG").begins_with("lp") or OS.get_environment("RIG").begins_with("sr") or OS.get_environment("RIG").begins_with("nb") or OS.get_environment("RIG").begins_with("ione")) else "min" + OS.get_environment("RIG"); hero_real = true
	elif OS.get_environment("SHAPE") == "" and OS.get_environment("HERO") == "" and not hero_real: rig_file = "wrap3r"; hero_real = true
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
	st2.code = SH.replace("uniform vec3 fog_col : source_color;", "uniform vec3 fog_col : source_color; uniform sampler2D albedo_tex : source_color, filter_linear_mipmap; uniform vec3 tint = vec3(1.0); uniform float floor_y = -1000.0; uniform float snap = 0.0; uniform float recol3 = 0.0; uniform float rc_detail = 1.0; uniform float wrap_lift = 0.0; uniform vec3 wrap_col = vec3(0.76, 0.32, 0.235); uniform float wrap_ref = 0.27; uniform float rc_split = 1.26; uniform float recol2 = 0.0; uniform float recol = 0.0; uniform vec3 rc_gown = vec3(0.8); uniform vec3 rc_veil = vec3(0.6, 0.13, 0.2); uniform vec3 rc_trim = vec3(0.87, 0.7, 0.3); varying vec3 mpos; varying float mveil;").replace(
		"void fragment(){", "float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); } float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }\nvec3 snapc(vec3 lin){ vec3 c = lin; vec3 best = vec3(0.165, 0.54, 0.58); float bd = distance(c, vec3(0.24, 0.61, 0.65)); float d = distance(c, vec3(0.9, 0.82, 0.65)); if (d < bd) { bd = d; best = vec3(0.955, 0.935, 0.885); } d = distance(c, vec3(0.89, 0.725, 0.3)); if (d < bd) { bd = d; best = vec3(0.86, 0.68, 0.29); } d = distance(c, vec3(0.89, 0.89, 0.88)); if (d < bd) { bd = d; best = vec3(0.965, 0.955, 0.94); } d = distance(c, vec3(0.78, 0.2, 0.18)); if (d < bd) { bd = d; best = vec3(0.75, 0.19, 0.23); } return best; }\nvoid fragment(){").replace(
		"	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;", "	mpos = CUSTOM0.xyz; mveil = CUSTOM0.w;\n	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;\n	if (w0.y < floor_y + 0.012) { VERTEX += (inverse(MODEL_MATRIX) * vec4(0.0, floor_y + 0.012 - w0.y, 0.0, 0.0)).xyz; w0.y = floor_y + 0.012; }").replace(
		"vec3 col = c_top * wt * wt + c_z * wz * wz + c_x * wx * wx + c_x * 0.86 * (1.0 - min(s, 1.0));",
		"vec3 tx = texture(albedo_tex, UV).rgb; if (snap > 0.5) tx = snapc(tx); if (wrap_lift > 0.5) { float rw9 = smoothstep(0.08, 0.2, tx.r - tx.b); float tl9 = dot(tx, vec3(0.3, 0.55, 0.15)); float fc9 = wt * wt * 1.1 + wz * wz * 0.96 + wx * wx * 0.7; float gr9 = n3(mpos * 150.0) - 0.5; float mo9 = n3(mpos * 8.0) - 0.5; vec3 cl9 = wrap_col * clamp(tl9 / wrap_ref, 0.72, 1.14) * mix(1.0, fc9, 0.75) * (1.0 + gr9 * 0.09 + mo9 * 0.1); float vn9 = abs(sin((mpos.x * 1.3 + mpos.y * 0.9 + mpos.z * 0.7) * 8.0 + n3(mpos * 5.0) * 6.0)); float vm9 = (1.0 - smoothstep(0.0, 0.07, vn9)) * smoothstep(0.3, 0.55, n3(mpos * 2.3 + 7.0)); float vn8 = abs(sin((mpos.x * -1.1 + mpos.y * 1.2 + mpos.z * 0.5) * 5.0 + n3(mpos * 4.0 + 3.0) * 7.0)); vm9 = max(vm9, (1.0 - smoothstep(0.0, 0.045, vn8)) * 0.7); vec3 mb9 = vec3(0.975, 0.97, 0.962) * clamp(tl9 / 0.84, 0.86, 1.03); mb9 = mix(mb9, vec3(0.6, 0.61, 0.66), vm9 * 0.55); mb9 = mix(mb9, tx, 1.0 - smoothstep(0.3, 0.5, tl9)); tx = mix(mb9, cl9, rw9); } if (recol3 > 0.5) { float lum3 = dot(tx, vec3(0.3, 0.55, 0.15)); float cl3 = smoothstep(0.02, 0.06, tx.b - tx.r); float vw3 = mveil < -0.5 ? smoothstep(rc_split - 0.04, rc_split + 0.04, mpos.y) : smoothstep(0.3, 0.6, mveil); vec3 cc3 = mix(rc_gown, rc_veil, vw3); float gw3 = 1.0 - vw3; float vd3 = mveil - 1.0; float vb3 = step(0.0, vd3) * smoothstep(0.016, 0.022, vd3) * (1.0 - smoothstep(0.034, 0.04, vd3)) * rc_detail; cc3 = mix(cc3, rc_gown, vb3 * 0.5); cc3 *= mix(1.0, 0.9, step(0.5, mveil) * (1.0 - step(0.9, mveil))); float ang3 = atan(mpos.z, mpos.x); float fold3 = clamp(1.0 + (lum3 - 0.66) * 1.5, 0.74, 1.14); float pl3 = smoothstep(-0.35, 0.35, sin(ang3 * 24.0 + sin(mpos.y * 6.0) * 0.7)); float plw3 = gw3 * smoothstep(1.02, 0.55, mpos.y) * rc_detail; float mot3 = sin(mpos.x * 37.0 + mpos.y * 11.0) * sin(mpos.y * 29.0 + mpos.z * 17.0) * sin(mpos.z * 41.0 + mpos.x * 7.0); float thr3 = sin(ang3 * 70.0 + mpos.y * 3.0) * (1.0 - gw3); float rim3 = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), 2.2); cc3 *= mix(1.0, mix(0.9, 1.04, pl3), plw3) * (1.0 + (0.035 * mot3 + 0.03 * thr3) * rc_detail); cc3 *= 1.0 - 0.1 * rc_detail * gw3 * smoothstep(rc_split - 0.13, rc_split - 0.03, mpos.y) * step(abs(mpos.x), 0.26); float hb3 = (1.0 - smoothstep(0.05, 0.062, mpos.y)) * rc_detail; float hl3 = smoothstep(0.078, 0.088, mpos.y) * (1.0 - smoothstep(0.104, 0.114, mpos.y)) * rc_detail; cc3 = mix(cc3, rc_gown * vec3(0.72, 0.78, 0.92), hb3); cc3 = mix(cc3, rc_veil, hl3 * 0.85); cc3 = mix(cc3, vec3(1.0), rim3 * mix(0.3, 0.14, gw3) * rc_detail); tx = mix(tx, cc3 * mix(clamp(0.6 + lum3 * 0.5, 0.86, 1.08), fold3, rc_detail), cl3); } if (recol2 > 0.5) { float lv = dot(tx, vec3(0.3, 0.55, 0.15)); float mx = max(tx.r, max(tx.g, tx.b)); float mn = min(tx.r, min(tx.g, tx.b)); float sat = (mx - mn) / max(mx, 0.001); float gold = step(0.5, tx.r) * step(0.38, tx.g) * step(0.22, tx.r - tx.b); float crim = smoothstep(0.2, 0.3, tx.r - tx.g) * (1.0 - step(0.4, tx.g)); float body = step(mpos.y, 1.16) * step(abs(mpos.x), 0.3); float teal = smoothstep(0.02, 0.1, min(tx.g, tx.b) - tx.r) * (1.0 - smoothstep(0.75, 0.9, lv)); float gown = max(max(teal, body), crim); tx = mix(tx, rc_gown * clamp(0.95 + (lv - 0.35) * 0.3, 0.92, 1.08), gown); float lowsat = (1.0 - smoothstep(0.12, 0.26, sat)) * smoothstep(0.45, 0.62, lv); float top = step(1.56, mpos.y); float isveil = max(max(lowsat, gold), top) * step(abs(mpos.x), 0.27) * step(1.16, mpos.y) * (1.0 - gown * (1.0 - top)); tx = mix(tx, rc_veil * mix(0.93, clamp(lv / 0.8, 0.78, 1.08), lowsat), isveil); } if (recol > 0.5) { float rg0 = tx.r - tx.g; float lz0 = dot(tx, vec3(0.3, 0.55, 0.15)); float isv = smoothstep(0.18, 0.3, rg0) * (1.0 - step(0.35, tx.g)); float isg = step(0.5, tx.g) * step(0.25, tx.r - tx.b); float arm = step(0.19, abs(mpos.x)) * step(1.2, mpos.y); vec3 oo = mix(rc_gown * clamp(lz0 / 0.8, 0.8, 1.12), vec3(0.96, 0.955, 0.94) * clamp(lz0 / 0.8, 0.85, 1.1), arm); oo = mix(oo, rc_veil * clamp(lz0 / 0.28, 0.8, 1.15), isv); tx = mix(oo, rc_trim, isg * (1.0 - isv)); } float lum = dot(tx, vec3(0.3, 0.55, 0.15)); vec3 col = mix(vec3(lum), tx, 0.85) * 1.12 * tint * (wt * wt + 0.94 * wz * wz + 0.76 * wx * wx + 0.68 * (1.0 - min(s, 1.0)));")
	shaders["tex"] = st2
	var st3 := Shader.new(); st3.code = st2.code.replace("render_mode ambient_light_disabled, specular_disabled;", "render_mode ambient_light_disabled, specular_disabled, cull_disabled;"); shaders["tex2"] = st3
	auto = "auto" in OS.get_cmdline_user_args()
	_env()
	var n0 := get_child_count()
	_world()
	world = Node3D.new(); world.name = "World"; add_child(world)
	for c in get_children().slice(n0):
		if c != world: c.reparent(world)
	_refl_margins(world)
	# the old upside-down copy of the whole world under the sea is gone: it fought with the dark reflections
	# that now lie on the water, and it doubled the scene. The node stays for the few things made only for it
	refl = world.duplicate() if OS.get_environment("OLDREFL") == "1" else Node3D.new()
	refl.name = "Refl"; add_child(refl)
	for nm in ["MirrorPool", "PoolSky"]:   # the copy of the world under the sea must not repeat the pool's own mirror
		var extra := refl.get_node_or_null(nm)
		if extra != null: refl.remove_child(extra); extra.queue_free()
	refl.scale = Vector3(1, -1, 1); refl.position.y = 2.0 * WATER
	slab(-0.6, -7.8, 0.6, -5.8, 0.0, "stone", refl)
	for e in [-1.0, 1.0]: blk(Vector3(e * 0.54 - 0.03, 0, -7.8), Vector3(e * 0.54 + 0.03, 0.06, -5.8), "shade", refl)
	_actors(); _fog(); _nav(); _ui()
	cam_t = pos
	get_viewport().size_changed.connect(_fit)
	_fit()
	if "gallery" in OS.get_cmdline_user_args(): _gallery()
	if OS.get_environment("DEBUG_POOL") == "1":
		for mm in find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			if mi.mesh == null: continue
			var bb: AABB = mi.global_transform * mi.mesh.get_aabb()
			if bb.position.x < 0.6 and bb.end.x > 0.9 and bb.position.z < 0.3 and bb.end.z > 0.6 and bb.end.y > -2.3 and bb.position.y < 0.05:
				var mo := mi.material_override
				print("POOLDBG ", mi.get_path(), " y ", snappedf(bb.position.y, 0.01), "..", snappedf(bb.end.y, 0.01), " size ", bb.size.snapped(Vector3.ONE * 0.1), " mat ", (mo as ShaderMaterial).shader.resource_path if mo is ShaderMaterial else str(mo), " ", shaders.find_key((mo as ShaderMaterial).shader) if mo is ShaderMaterial else "")
	if "shots" in OS.get_cmdline_user_args(): _shots()
	if "lineup" in OS.get_cmdline_user_args(): _lineup()
	if "reals" in OS.get_cmdline_user_args(): _real_lineup()
	if "mins" in OS.get_cmdline_user_args(): _min_lineup()
	if "heads" in OS.get_cmdline_user_args(): _heads_lineup()
	if "zoom" in OS.get_cmdline_user_args(): cam.size = 3.3
	if "statue" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve_statue()
	if "tour" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_tour()
	if "solve2" in OS.get_cmdline_user_args():
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve2()
	if "covered" in OS.get_cmdline_user_args() and COVERED:
		get_viewport().msaa_3d = Viewport.MSAA_2X
		_solve_covered()
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
		{"n": "14-start-zone", "p": Vector3(-2.55, 0, 1.75), "y": 1.2, "c": Vector3(0.2, 0.5, -0.3), "s": 11.5},
		{"n": "15-statue-row", "p": Vector3(-2.55, 0, 1.75), "y": 1.2, "c": Vector3(-2.7, 0.8, -0.4), "s": 6.6},
		{"n": "16-sculptors-corner", "p": Vector3(1.9, 0, -2.2), "y": 2.6, "c": Vector3(2.4, 0.8, -3.0), "s": 5.6},
		{"n": "17-shadow-bridge", "p": Vector3(5.42, 0, 1.0), "y": 1.57, "c": Vector3(6.3, -0.2, 1.3), "s": 7.6},
		{"n": "18-mirror-pool", "p": Vector3(-1.4, 0, -1.14), "y": 0.0, "c": Vector3(-0.8, 0.1, -0.1), "s": 5.2},
		{"n": "19-mirror-pool-wide", "p": Vector3(-1.4, 0, -1.14), "y": 0.0, "c": Vector3(-1.4, 0.3, 0.7), "s": 13.5},
		{"n": "21-sea-check", "p": Vector3(-4.9, 0, 0.4), "y": PI, "c": Vector3(-4.9, 1.9, 0.4), "s": 6.2},
		{"n": "24-statue-row", "p": Vector3(-0.5, 0, MYPL.z), "y": -PI * 0.5, "c": Vector3(-2.2, 0.3, -0.5), "s": 6.0},
		{"n": "25-crossing-court", "p": Vector3(QX0 - 0.14, 0, PED.z), "y": PI * 0.5, "c": Vector3(0.2, 0.3, -12.8), "s": 7.5},
		{"n": "26-causeway-mirrors", "p": Vector3(0, 0, -7.0), "y": -PI * 0.6, "c": Vector3(0.0, 0.2, -7.0), "s": 9.0},
		{"n": "22-covered-pool", "p": Vector3(1.37, 0, -13.2), "y": -PI * 0.5, "c": Vector3(-1.0, 0.4, -13.0), "s": 7.5},
		{"n": "23-door-in-water", "p": Vector3(0.25, 0, -12.4), "y": -PI * 0.6, "c": Vector3(-1.2, 0.4, -13.0), "s": 6.2, "nosheet": true},
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
		if sheet != null: sheet.visible = not sh.get("nosheet", false)
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

## colourways for the column woman: [gown, veil]
const RECOLS := {
	1: [Vector3(0.2, 0.22, 0.48), Vector3(0.62, 0.13, 0.2)],
	2: [Vector3(0.14, 0.48, 0.52), Vector3(0.95, 0.93, 0.88)],
	3: [Vector3(0.66, 0.14, 0.2), Vector3(0.95, 0.93, 0.88)],
	4: [Vector3(0.17, 0.16, 0.21), Vector3(0.62, 0.13, 0.2)],
	5: [Vector3(0.8, 0.42, 0.3), Vector3(0.12, 0.42, 0.47)],
	6: [Vector3(0.85, 0.65, 0.27), Vector3(0.62, 0.13, 0.2)],
	7: [Vector3(0.36, 0.2, 0.46), Vector3(0.86, 0.82, 0.95)],
}

# Finds the veil on the mesh itself: spread from the top of the head across the surface and stop
# where the cloth turns under at its hem. cu.w becomes 1 + distance to the hem (veil), 0.75 (its
# underside) or 0 (everything else); -1 everywhere if the spread escapes onto the gown.
func veil_mask(cu: PackedFloat32Array, a: Array) -> void:
	var nrm: PackedVector3Array = a[Mesh.ARRAY_NORMAL]; var idx: PackedInt32Array = a[Mesh.ARRAY_INDEX]
	var n: int = cu.size() / 4
	if nrm.size() != n or idx.is_empty(): return
	var ids := {}; var wid := PackedInt32Array(); wid.resize(n); var wy := PackedFloat32Array(); var wny := PackedFloat32Array(); var wc := PackedFloat32Array(); var wp := PackedVector3Array()
	for i in n:
		var pv := Vector3(cu[i * 4], cu[i * 4 + 1], cu[i * 4 + 2])
		var k := Vector3i(roundi(pv.x * 8000.0), roundi(pv.y * 8000.0), roundi(pv.z * 8000.0))
		if not ids.has(k): ids[k] = wp.size(); wp.append(pv); wy.append(pv.y); wny.append(0.0); wc.append(0.0)
		wid[i] = ids[k]; wny[wid[i]] += nrm[i].y; wc[wid[i]] += 1.0
	var nw := wp.size(); var adj: Array = []; adj.resize(nw)
	for i in nw: adj[i] = []
	for t in range(0, idx.size(), 3):
		var v0 := wid[idx[t]]; var v1 := wid[idx[t + 1]]; var v2 := wid[idx[t + 2]]
		adj[v0].append(v1); adj[v0].append(v2); adj[v1].append(v0); adj[v1].append(v2); adj[v2].append(v0); adj[v2].append(v1)
	var blocked := PackedByteArray(); blocked.resize(nw); var seed := 0
	for i in nw:
		blocked[i] = 1 if wny[i] / maxf(wc[i], 1.0) < -0.25 else 0
		if wy[i] > wy[seed]: seed = i
	var seen := PackedByteArray(); seen.resize(nw); seen[seed] = 1
	var q := PackedInt32Array([seed]); var qi := 0; var low := 9.0
	while qi < q.size():
		var v := q[qi]; qi += 1; low = minf(low, wy[v])
		for nb in adj[v]:
			if seen[nb] == 0 and blocked[nb] == 0: seen[nb] = 1; q.append(nb)
	print("VEIL mask: ", q.size(), " of ", nw, " verts, hem at ", snappedf(low, 0.001))
	if low < 0.8:
		for i in n: cu[i * 4 + 3] = -1.0
		print("VEIL mask leaked onto the gown, using the height split")
		return
	# small pockets the spread skipped (folds turned downwards) belong to the veil too:
	# everything not reached, except the one big remainder (body, gown, underside), joins it
	var comp := PackedInt32Array(); comp.resize(nw); comp.fill(-1); var sizes := PackedInt32Array(); var big := 0
	for i in nw:
		if seen[i] == 1 or comp[i] >= 0: continue
		var c := sizes.size(); var st := PackedInt32Array([i]); comp[i] = c; var cnt := 0
		while not st.is_empty():
			var v: int = st[st.size() - 1]; st.remove_at(st.size() - 1); cnt += 1
			for nb in adj[v]:
				if seen[nb] == 0 and comp[nb] < 0: comp[nb] = c; st.append(nb)
		sizes.append(cnt)
		if cnt > sizes[big]: big = c
	for i in nw:
		if seen[i] == 0 and comp[i] != big and sizes[comp[i]] < 400: seen[i] = 1; q.append(i)
	# distance from the hem, measured along the veil
	var dist := PackedFloat32Array(); dist.resize(nw); dist.fill(9.0)
	var under := PackedInt32Array(); under.resize(nw); under.fill(-1)
	var q2 := PackedInt32Array(); var q3 := PackedInt32Array()
	for v in q:
		for nb in adj[v]:
			if seen[nb] == 0:
				if dist[v] > 0.0: dist[v] = 0.0; q2.append(v)
				if under[nb] < 0: under[nb] = 0; q3.append(nb)
	qi = 0
	while qi < q2.size():
		var v := q2[qi]; qi += 1
		for nb in adj[v]:
			if seen[nb] == 1:
				var d := dist[v] + wp[v].distance_to(wp[nb])
				if d < dist[nb] - 0.0005: dist[nb] = d; q2.append(nb)
	qi = 0
	while qi < q3.size():
		var v := q3[qi]; qi += 1
		if under[v] >= 7: continue
		for nb in adj[v]:
			if seen[nb] == 0 and blocked[nb] == 1 and under[nb] < 0 and wy[nb] > low - 0.06: under[nb] = under[v] + 1; q3.append(nb)
	for i in n:
		var w := wid[i]
		cu[i * 4 + 3] = 1.0 + minf(dist[w], 0.6) if seen[w] == 1 else (0.75 if under[w] >= 0 else 0.0)

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
			if rig_file.begins_with("ione") and OS.get_environment("VEILMASK") != "0": veil_mask(cu, a)
			a[Mesh.ARRAY_CUSTOM0] = cu
			rig_norm = {"cx": cx, "lo": lo.y, "cz": cz, "sc": sc, "veil": Color("e8e2d2")}
			var om0 := mi.mesh.surface_get_material(si)
			var bare := PackedByteArray(); bare.resize(av.size())   # 1 = bare marble body (wrapped figure), follows the leg bones fully
			if a[Mesh.ARRAY_TEX_UV] != null and om0 is BaseMaterial3D and (om0 as BaseMaterial3D).albedo_texture != null:
				var img := (om0 as BaseMaterial3D).albedo_texture.get_image()
				if img != null:
					if img.is_compressed(): img.decompress()
					if rig_file.begins_with("wrap"):
						var uvs: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
						for i in av.size():
							var cpx := img.get_pixel(clampi(int(fposmod(uvs[i].x, 1.0) * img.get_width()), 0, img.get_width() - 1), clampi(int(fposmod(uvs[i].y, 1.0) * img.get_height()), 0, img.get_height() - 1))
							bare[i] = 1 if cpx.r - cpx.b < 0.12 else 0
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
				if rig_file.begins_with("wrap"):   # a fitted wrap moves with the legs, or the bare legs push through the cloth
					if OS.get_environment("SK_MID") == "": keep_mid = 1.0
					if OS.get_environment("SK_LOW") == "": keep_low = 1.0
				if hips >= 0:
					for i in av.size():
						var y := cu[i * 4 + 1]
						var keep := 1.0
						if y < 0.98: keep = lerpf(keep_mid, 1.0, smoothstep(0.6, 0.98, y)) if y > 0.6 else lerpf(keep_low, keep_mid, smoothstep(0.05, 0.6, y))
						if keep >= 0.999 or bare[i] == 1: continue
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
	if rig_file != "" and OS.get_environment("RIG_YAW") == "":
		var sk0 := src.find_children("*", "Skeleton3D", true, false)
		if not sk0.is_empty():
			var skq: Skeleton3D = sk0[0]; var fb := _bone(skq, "LeftFoot"); var tb := _bone(skq, "LeftToeBase")
			if fb >= 0 and tb >= 0:
				var fw := skq.get_bone_global_rest(tb).origin - skq.get_bone_global_rest(fb).origin
				var fb2 := _bone(skq, "RightFoot"); var tb2 := _bone(skq, "RightToeBase")
				if fb2 >= 0 and tb2 >= 0: fw += skq.get_bone_global_rest(tb2).origin - skq.get_bone_global_rest(fb2).origin
				fw.y = 0.0
				if fw.length() > 0.001:
					src.rotation.y = -atan2(fw.x, fw.z)
					if hero_src_yaw_note: print("RIG faces ", fw.normalized(), " -> yaw ", src.rotation.y); hero_src_yaw_note = false
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
				var sm := ShaderMaterial.new(); sm.shader = shaders["tex2" if mode == "mirror" else "tex"]
				if refl_mat != null and mode == "tex":   # her own reflection keeps her colours and lies over the others
					var rm := ShaderMaterial.new(); rm.shader = shaders["refl"]; rm.set_shader_parameter("water_y", WATER); rm.set_shader_parameter("lift", 0.006); rm.set_shader_parameter("use_tex", 1.0)
					if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: rm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
					timed.append(rm); sm.next_pass = rm
					if mode == "tex": her_mats.append(sm)
				sm.set_shader_parameter("fog_col", sea_c); sm.set_shader_parameter("mist_col", mist_c); sm.set_shader_parameter("shadow_col", shadow_c); sm.set_shader_parameter("mist_k", mist_k)
				if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: sm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
				if mode == "crim": sm.set_shader_parameter("tint", Vector3(1.75, 0.42, 0.5))
				if mode == "mirror": sm.set_shader_parameter("tint", Vector3(0.4, 0.48, 0.62))   # her reflection is dark, and the water blurs it
				if mode == "tex": floor_mats.append(sm)
				if rig_file.begins_with("lp") or rig_file.begins_with("sr") or rig_file.begins_with("nb") or (rig_file.begins_with("wrap") and OS.get_environment("WRAP_SMOOTH") == ""): sm.set_shader_parameter("flat_n", 1.0)
				if rig_file == "lp1r" and OS.get_environment("NOSNAP") != "1": sm.set_shader_parameter("snap", 1.0)
				if rig_file == "wrap3r" and mode == "tex": sm.set_shader_parameter("wrap_col", Vector3(0.82, 0.31, 0.215)); sm.set_shader_parameter("wrap_ref", 0.34)
				if rig_file.begins_with("wrap") and mode == "tex": sm.set_shader_parameter("wrap_lift", float(OS.get_environment("WRAP_LIFT")) if OS.get_environment("WRAP_LIFT") != "" else 1.55)
				if rig_file.begins_with("ione") and mode == "tex" and OS.get_environment("IONE") != "old":
					var dark_veil := OS.get_environment("IONE") == "dark"
					var gown_c := Vector3(0.184, 0.702, 0.678); var veil_c := Vector3(0.827, 0.953, 0.941)   # turquoise gown, pale veil
					if dark_veil: gown_c = Vector3(0.7, 0.84, 0.96); veil_c = Vector3(0.15, 0.28, 0.53)
					elif OS.get_environment("IONE") == "blue": gown_c = Vector3(0.42, 0.63, 0.87); veil_c = Vector3(0.75, 0.89, 0.98)
					var ione_col := OS.get_environment("IONE_COL").split(",")   # "gownhex,veilhex"
					if ione_col.size() == 2: var cg := Color(ione_col[0]); var cv := Color(ione_col[1]); gown_c = Vector3(cg.r, cg.g, cg.b); veil_c = Vector3(cv.r, cv.g, cv.b)
					sm.set_shader_parameter("recol3", 1.0); sm.set_shader_parameter("rc_gown", gown_c); sm.set_shader_parameter("rc_veil", veil_c)
					sm.set_shader_parameter("rc_split", {"ione1r": 1.27, "ione2r": 1.2, "ione3r": 1.27}.get(rig_file, 1.26))
				if rig_file == "w2r" and mode == "tex" and OS.get_environment("IONE") != "old":
					sm.set_shader_parameter("recol2", 1.0); sm.set_shader_parameter("rc_gown", Vector3(0.42, 0.63, 0.87)); sm.set_shader_parameter("rc_veil", Vector3(0.72, 0.87, 0.97))
				var rcid := int(OS.get_environment("RECOL")) if OS.get_environment("RECOL") != "" else 0
				if RECOLS.has(rcid) and mode == "tex":
					sm.set_shader_parameter("recol", 1.0); sm.set_shader_parameter("rc_gown", RECOLS[rcid][0]); sm.set_shader_parameter("rc_veil", RECOLS[rcid][1])
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
	mi.extra_cull_margin = 6.0   # her reflection lies on the water beside her
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
	if OS.get_environment("MOOD") == "moody":
		env.adjustment_enabled = true; env.adjustment_brightness = 0.94; env.adjustment_contrast = 1.04; env.adjustment_saturation = 0.84
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

## mirrored things need their own materials: two-sided, and without the pass that lays a reflection on the sea
## A reflection lies on the water well away from the thing that casts it, so that thing must still be drawn when
## it is itself just off the screen. Without this, each piece's reflection came and went as the camera moved.
func _refl_margins(n: Node) -> void:
	if n is GeometryInstance3D and n.is_inside_tree():
		var g := n as GeometryInstance3D
		var top := (g.global_transform * g.get_aabb()).end.y
		g.extra_cull_margin = maxf(g.extra_cull_margin, clampf((top - WATER) * 2.0, 0.0, 40.0))
	for c in n.get_children(): _refl_margins(c)

## skip: how many of the root's children were already done. sh: the shader the copies get ("mir" takes no shadows:
## a thing that hangs under the floor must not be darkened by that floor). k: how much of the water's colour they take
## the same for a model whose materials sit on its surfaces (a statue of her): no shadows from the floor above, no
## reflection pass, and some of the water's colour
func _mirror_mats(root: Node, k := 0.3) -> void:
	var cache := {}
	for mm in root.find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		for si in mi.mesh.get_surface_count():
			var m := mi.get_surface_override_material(si) as ShaderMaterial
			if m == null: continue
			if not cache.has(m):
				var d: ShaderMaterial = m.duplicate(); d.next_pass = null
				if m.shader == shaders["base"] or m.shader == shaders["two"]: d.shader = shaders["mir"]
				for cn in ["c_top", "c_z", "c_x"]:
					var c0 = d.get_shader_parameter(cn)
					if c0 is Color: d.set_shader_parameter(cn, (c0 as Color).lerp(Color(0.42, 0.62, 0.74), k).darkened(0.16))   # dark enough to read against the pale water
				cache[m] = d
			mi.set_surface_override_material(si, cache[m])
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _strip_refl(root: Node, skip := 0, sh := "two", k := 0.38) -> void:
	var cache := {}
	var list: Array = []
	for c in root.get_children().slice(skip):
		if c is MeshInstance3D: list.append(c)
		list.append_array(c.find_children("*", "MeshInstance3D", true, false))
	for mm in list:
		var mi := mm as MeshInstance3D
		var m := mi.material_override as ShaderMaterial
		if m == null: continue
		if not cache.has(m):
			var d: ShaderMaterial = m.duplicate(); d.next_pass = null
			if m.shader == shaders["base"]: d.shader = shaders[sh]
			for cn in ["c_top", "c_z", "c_x"]:   # what stands in the water takes some of the water's colour
				var c0 = d.get_shader_parameter(cn)
				if c0 is Color: d.set_shader_parameter(cn, (c0 as Color).lerp(Color(0.5, 0.78, 0.83), k).darkened(0.06 if k > 0.2 else 0.0))
			cache[m] = d
		mi.material_override = cache[m]; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## the arrival court: its floor has an opening for the mirror pool and its base is hollow, so that
## the court can stand upside down inside it
func _pool_court(x0: float, z0: float, x1: float, z1: float, qx0: float, qz0: float, qx1: float, qz1: float, wall_p := "stone", sky_name := "PoolSky") -> void:
	for r in [[x0, z0, x1, qz0], [x0, qz1, x1, z1], [x0, qz0, qx0, qz1], [qx1, qz0, x1, qz1]]:
		blk(Vector3(r[0], -0.13, r[1]), Vector3(r[2], 0.0, r[3]), "stone")
	for r in [[x0 - 0.03, z0 - 0.03, x1 + 0.03, qz0], [x0 - 0.03, qz1, x1 + 0.03, z1 + 0.03], [x0 - 0.03, qz0, qx0, qz1], [qx1, qz0, x1 + 0.03, qz1]]:
		blk(Vector3(r[0], -0.18, r[1]), Vector3(r[2], -0.13, r[3]), "shade")
	dentils(x0, z0, x1, z1, -0.18)
	var kr := 0.07   # the kerb of the pool
	blk(Vector3(qx0 - kr, 0, qz0 - kr), Vector3(qx1 + kr, 0.04, qz0), "shade"); blk(Vector3(qx0 - kr, 0, qz1), Vector3(qx1 + kr, 0.04, qz1 + kr), "shade")
	blk(Vector3(qx0 - kr, 0, qz0), Vector3(qx0, 0.04, qz1), "shade"); blk(Vector3(qx1, 0, qz0), Vector3(qx1 + kr, 0.04, qz1), "shade")
	var ins := 0.22; var a := Vector3(x0 + ins, -2.45, z0 + ins); var b := Vector3(x1 - ins, -0.18, z1 - ins); var th := 0.3
	for w in [[a.x, a.z, b.x, a.z + th], [a.x, b.z - th, b.x, b.z], [a.x, a.z + th, a.x + th, b.z - th], [b.x - th, a.z + th, b.x, b.z - th]]:
		blk(Vector3(w[0], a.y, w[1]), Vector3(w[2], b.y, w[3]), wall_p)
	for w in [[a.x - 0.1, a.z - 0.1, b.x + 0.1, a.z + th], [a.x - 0.1, b.z - th, b.x + 0.1, b.z + 0.1], [a.x - 0.1, a.z + th, a.x + th, b.z - th], [b.x - th, a.z + th, b.x + 0.1, b.z - th]]:
		blk(Vector3(w[0], -2.45, w[1]), Vector3(w[2], WATER + 0.07, w[3]), "shade")
	for w in [[a.x - 0.1, a.z - 0.1, b.x + 0.1, a.z + th], [a.x - 0.1, b.z - th, b.x + 0.1, b.z + 0.1], [a.x - 0.1, a.z + th, a.x + th, b.z - th], [b.x - th, a.z + th, b.x + 0.1, b.z - th]]:
		blk(Vector3(w[0], -0.42, w[1]), Vector3(w[2], -0.3, w[3]), "shade")   # the cornice, as a ring: a full plate would close the pool from below
	foam(a.x - 0.1, a.z - 0.1, b.x + 0.1, b.z + 0.1)
	var nx := maxi(1, int((b.x - a.x) / 1.05)); var nz := maxi(1, int((b.z - a.z) / 1.05))
	for i in nx: win_z(a.x + (b.x - a.x) * (i + 0.5) / nx, -1.2, b.z, 0.4, 0.74)
	for i in nz: win_x(b.x, -1.2, a.z + (b.z - a.z) * (i + 0.5) / nz, 0.4, 0.74)
	var pit := MeshInstance3D.new(); pit.name = sky_name; var pm := BoxMesh.new(); pm.size = Vector3(b.x - a.x - th * 2.0 - 0.03, 2.16, b.z - a.z - th * 2.0 - 0.03); pit.mesh = pm
	pit.position = Vector3((a.x + b.x) * 0.5, -0.185 - 1.08, (a.z + b.z) * 0.5)   # its floor stays above the copy of the court that lies under the sea
	var pmat := ShaderMaterial.new(); pmat.shader = shaders["pit"]; pit.material_override = pmat; pit.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(pit)
	if OS.get_environment("NOPIT") == "1": pit.visible = false

## the first zone, "the quay of the last statues": she wakes on the one empty plinth of a row of
## statues of herself, passes the sculptor's corner, and meets the footbridge that is only a shadow
func _start_zone() -> void:
	# the row of statues of her: four finished ones, and in the middle the plinth she stepped down from. Before them
	# lies a long rug, as long as the row, a little rucked up where feet have dragged it
	var poses := ["calm", "pray", "", "mourn", "kneel"]
	mroot = Node3D.new(); mroot.name = "MirrorPool"; mroot.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3.ZERO); add_child(mroot)
	for i in 5:
		var sp := Vector3(MYPL.x, 0, MYPL.z + 0.9 * (i - 2))
		cyl(sp, 0.33, 0.31, 0.07, pal("shade"), 20); cyl(sp + Vector3(0, 0.07, 0), 0.27, 0.27, 0.1, pal("stone"), 20)
		blk(sp + Vector3(0.2, 0, -0.1), sp + Vector3(0.212, 0.1, 0.1), "gold")           # a small name plate, blank
		if poses[i] != "": her_statue(sp + Vector3(0, 0.17, 0), PI * 0.5, poses[i], 0.96)
	var rx0 := MYPL.x + 0.55; var rx1 := rx0 + 2.6; var rz0 := MYPL.z - 2.35; var rz1 := rz0 + 4.7
	var rim2 := Image.load_from_file(ProjectSettings.globalize_path("res://props/rug.png")); rim2.generate_mipmaps()
	var rm := ShaderMaterial.new(); rm.shader = shaders["tex"]; rm.set_shader_parameter("albedo_tex", ImageTexture.create_from_image(rim2))
	rm.set_shader_parameter("fog_col", sea_c); rm.set_shader_parameter("mist_col", mist_c); rm.set_shader_parameter("shadow_col", shadow_c); rm.set_shader_parameter("mist_k", mist_k); pmats["rug"] = rm
	# the rug is not flat: a few long rucks run across it, one corner is turned up, and it lies unevenly everywhere
	var gx := 44; var gz := 80; var rv := PackedVector3Array(); var ruv := PackedVector2Array(); var rix := PackedInt32Array()
	var rucks := [[Vector2(0.9, 1.1), 0.5, 0.1, 0.13, 1.5], [Vector2(1.7, 3.3), -0.35, 0.085, 0.12, 1.3], [Vector2(1.3, 2.3), 1.2, 0.06, 0.16, 1.0], [Vector2(0.5, 3.9), 0.9, 0.07, 0.1, 0.8], [Vector2(2.1, 0.8), -1.0, 0.06, 0.1, 0.7], [Vector2(0.6, 2.9), -0.2, 0.05, 0.09, 0.6]]   # a point on it, its direction, height, width, half length
	for j in gz + 1:
		for i in gx + 1:
			var u := (rx1 - rx0) * i / gx; var v := (rz1 - rz0) * j / gz; var h := 0.0
			for rk in rucks:
				var dir := Vector2(cos(rk[1]), sin(rk[1])); var rel := Vector2(u, v) - (rk[0] as Vector2)
				var along := rel.dot(dir); var across := rel.dot(Vector2(-dir.y, dir.x)) + 0.05 * sin(along * 3.0)
				h += rk[2] * exp(-pow(across / rk[3], 2)) * smoothstep(rk[4], rk[4] * 0.4, absf(along))
			h += 0.085 * pow(clampf(1.0 - Vector2(u - (rx1 - rx0), v - (rz1 - rz0)).length() / 0.55, 0.0, 1.0), 2.0)   # the turned-up corner
			h += 0.005 * (2.0 + sin(u * 7.0 + v * 3.0) + sin(v * 9.0 - u * 2.0))
			rv.append(Vector3(rx0 + u, 0.016 + h, rz0 + v)); ruv.append(Vector2(float(i) / gx, float(j) / gz))
	var rn := PackedVector3Array(); rn.resize(rv.size())
	for j in gz + 1:
		for i in gx + 1:
			var k := j * (gx + 1) + i
			rn[k] = (rv[k + ((gx + 1) if j < gz else 0)] - rv[k - ((gx + 1) if j > 0 else 0)]).cross(rv[k + (1 if i < gx else 0)] - rv[k - (1 if i > 0 else 0)]).normalized()
	for j in gz:
		for i in gx:
			var k := j * (gx + 1) + i
			rix.append_array(PackedInt32Array([k, k + 1, k + gx + 1, k + 1, k + gx + 2, k + gx + 1]))
	var ra := []; ra.resize(Mesh.ARRAY_MAX); ra[Mesh.ARRAY_VERTEX] = rv; ra[Mesh.ARRAY_NORMAL] = rn; ra[Mesh.ARRAY_TEX_UV] = ruv; ra[Mesh.ARRAY_INDEX] = rix
	var rmesh := ArrayMesh.new(); rmesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, ra)
	prim(rmesh, Vector3.ZERO, rm)
	blk(Vector3(rx0 - 0.004, 0, rz0 - 0.004), Vector3(rx1 + 0.004, 0.011, rz1 + 0.004), "teal")   # its thickness
	var fr := mat(Color("eadcbe"))
	for i in 52:   # the fringe at its two ends
		var fx := rx0 + 0.03 + (rx1 - rx0 - 0.06) * i / 51.0
		for e in [[rz0 - 0.13, rz0], [rz1, rz1 + 0.13]]:
			var tq := BoxMesh.new(); tq.size = Vector3(0.022, 0.008, 0.13 - 0.02 * (i % 2)); prim(tq, Vector3(fx, 0.005, (e[0] + e[1]) * 0.5 + 0.005 * sin(i * 2.3)), fr).rotation.y = 0.06 * sin(i * 1.7)
	var ep := MYPL
	for c in [[-0.42, 0.1, 0.4], [-0.55, -0.22, 1.1], [-0.3, 0.34, 2.0], [-0.7, 0.05, 0.2], [-0.48, 0.4, 2.7], [-0.62, -0.38, 1.6], [-0.36, -0.3, 0.7]]:
		var ch := blk(Vector3(-0.07, 0, -0.05), Vector3(0.07, 0.07, 0.05), "stone"); ch.position = ep + Vector3(c[0], 0.0, c[1]); ch.rotation = Vector3(0.3, c[2], 0.2)
	var cs := blk(Vector3(-0.34, 0, -0.07), Vector3(0.34, 0.012, 0.07), "clay"); cs.position = ep + Vector3(-0.5, 0.004, 0.12); cs.rotation.y = 0.5
	var cs2 := blk(Vector3(-0.2, 0, -0.06), Vector3(0.2, 0.012, 0.06), "clay"); cs2.position = ep + Vector3(-0.12, 0.172, 0.0); cs2.rotation = Vector3(0, -0.4, 0.0)
	# a stele with the sculptor's first lines, at the head of the row
	blk(Vector3(-5.22, 0, -3.62), Vector3(-4.62, 0.08, -3.38), "shade"); blk(Vector3(-5.16, 0.08, -3.58), Vector3(-4.68, 1.02, -3.44), "stone")
	for i in 6: blk(Vector3(-5.08, 0.86 - 0.11 * i, -3.438), Vector3(-4.76 - 0.07 * (i % 3), 0.875 - 0.11 * i, -3.43), "shade")
	# the sculptor's corner: a block with a figure half out of it, a scaffold, a bench with his tools
	blk(Vector3(2.45, 0, -3.62), Vector3(3.28, 1.36, -2.92), "stone"); blk(Vector3(2.4, 0, -3.66), Vector3(3.32, 0.09, -2.88), "shade")
	blk(Vector3(2.45, 1.36, -3.62), Vector3(2.95, 1.62, -3.2), "stone"); blk(Vector3(2.95, 1.36, -3.62), Vector3(3.28, 1.5, -3.36), "shade")
	her_statue(Vector3(2.86, 0.02, -3.0), 0.0, "offer", 0.9)
	for sx in [2.32, 3.36]:
		for sz in [-3.72, -2.82]: blk(Vector3(sx - 0.03, 0, sz - 0.03), Vector3(sx + 0.03, 2.05, sz + 0.03), "wood")
	blk(Vector3(2.29, 1.98, -3.75), Vector3(3.39, 2.05, -3.69), "wood"); blk(Vector3(2.29, 1.98, -2.85), Vector3(3.39, 2.05, -2.79), "wood")
	blk(Vector3(2.29, 1.1, -3.75), Vector3(2.35, 1.16, -2.79), "wood"); blk(Vector3(2.26, 1.16, -3.7), Vector3(2.6, 1.2, -2.84), "wood")
	var lad := Node3D.new(); lad.position = Vector3(2.18, 0, -2.6); lad.rotation = Vector3(0, 0, -0.22); add_child(lad)
	for lz in [-0.14, 0.14]: blk(Vector3(-0.02, 0, lz - 0.02), Vector3(0.02, 1.35, lz + 0.02), "wood", lad)
	for i in 5: blk(Vector3(-0.015, 0.2 + 0.24 * i, -0.14), Vector3(0.015, 0.23 + 0.24 * i, 0.14), "wood", lad)
	blk(Vector3(1.5, 0.44, -3.66), Vector3(2.2, 0.49, -3.3), "wood")
	for bx in [1.54, 2.16]:
		for bz in [-3.62, -3.34]: blk(Vector3(bx - 0.025, 0, bz - 0.025), Vector3(bx + 0.025, 0.44, bz + 0.025), "wood")
	var mal := cyl(Vector3(1.66, 0.49, -3.5), 0.05, 0.05, 0.1, pal("wood"), 10); mal.rotation.z = 0.0
	blk(Vector3(1.64, 0.53, -3.5), Vector3(1.9, 0.555, -3.48), "trunk")
	for i in 3:
		var chz := blk(Vector3(-0.09, 0, -0.008), Vector3(0.09, 0.016, 0.008), "dark"); chz.position = Vector3(1.98, 0.49, -3.56 + 0.07 * i); chz.rotation.y = 0.5 - 0.3 * i
	for c in [[2.0, -2.75, 0.3, 1.0], [2.25, -2.6, 1.2, 0.8], [2.7, -2.55, 2.2, 1.2], [3.05, -2.62, 0.7, 0.7], [2.45, -2.4, 1.9, 0.6], [1.85, -2.95, 2.6, 0.9], [2.95, -2.36, 0.1, 0.5], [2.15, -3.05, 1.5, 1.1]]:
		var rb := blk(Vector3(-0.08, 0, -0.06), Vector3(0.08, 0.08, 0.06), "stone" if int(c[2] * 10.0) % 2 == 0 else "shade"); rb.position = Vector3(c[0], 0, c[1]); rb.rotation = Vector3(0.25, c[2], 0.15); rb.scale = Vector3.ONE * c[3]
	urn(Vector3(1.45, 0, -3.0), 0.8, "terra")
	# the two strange heads now watch the gate from either side
	plinth_head("kit_face2", Vector3(-1.5, 0, -3.5), 0.0); plinth_head("kit_face3", Vector3(-4.0, 0, AZ1 - 0.48), PI)
	# the gate of the court is a bronze grille until the row of statues is whole
	gate_a = Node3D.new(); gate_a.position = Vector3(0, 0, -3.9); add_child(gate_a)
	for i in 7: blk(Vector3(-0.54 + 0.18 * i - 0.018, 0, -0.018), Vector3(-0.54 + 0.18 * i + 0.018, 2.02, 0.018), "dark", gate_a)
	for gy in [0.5, 1.2, 1.9]: blk(Vector3(-0.58, gy, -0.024), Vector3(0.58, gy + 0.04, 0.024), "gold", gate_a)
	if not ("shots" in OS.get_cmdline_user_args()) or OS.get_environment("GATE_A") == "open": gate_a.position.y = -2.4
	vine(AX0 + 0.7, AZ1 - 0.08, true, 2.0); vine(1.2, AZ1 - 0.08, true, 1.9)

## a dark arched niche on a wall that faces east
func niche_x(x: float, y: float, z: float, w: float, h: float, parent: Node) -> void:
	blk(Vector3(x, y, z - w * 0.5), Vector3(x + 0.012, y + h - w * 0.5, z + w * 0.5), "dark", parent)
	var d := cyl(Vector3(x + 0.006, y + h - w * 0.5, z), w * 0.5, w * 0.5, 0.012, pal("dark"), 24, parent); d.rotation.z = PI * 0.5

## a detailed prop (a Tripo model in props/): loaded, given the lit textured material of the world, scaled so that its
## height (or, with across > 0, its width) is as asked, and set with its foot at the origin of the node returned.
## mirror: the copy that stands in the water
func prop_model(file: String, parent: Node, height: float, across := 0.0, mirror := false, sea_refl := false, flat_pal := "", ground_y := 0.0) -> Node3D:
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	doc.append_from_file(ProjectSettings.globalize_path("res://props/%s.glb" % file), st)
	var src := doc.generate_scene(st) as Node3D
	var holder := Node3D.new(); parent.add_child(holder); holder.add_child(src)
	var box := AABB(); var first := true
	for m in src.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var b: AABB = mi.transform * mi.mesh.get_aabb()
		box = b if first else box.merge(b); first = false
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if mirror else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if flat_pal != "":   # no texture: colours of the world's own palette, flat faces, like its marbles
			var by_part := {}     # "cloth:linen,rope:rope,base:stone" paints each named material of the model with its own
			for kv in flat_pal.split(","):
				if ":" in kv: by_part[kv.get_slice(":", 0)] = kv.get_slice(":", 1)
			if by_part.is_empty(): mi.material_override = pal(flat_pal, "flat2" if mirror else "flat")
			else:
				for si in mi.mesh.get_surface_count():
					var om2 := mi.mesh.surface_get_material(si)
					var nm := om2.resource_name if om2 != null else ""
					if nm == "glass":   # the pane of a mirror shows what stands before it
						var gm2 := ShaderMaterial.new(); gm2.shader = shaders["mirror"]; gm2.set_shader_parameter("ground_y", ground_y); timed.append(gm2)
						mi.set_surface_override_material(si, gm2); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; continue
					mi.set_surface_override_material(si, pal(by_part.get(nm, by_part.values()[0]), "flat2" if (mirror or nm == "cloth") else "flat"))   # cloth is seen from within too
			continue
		for si in mi.mesh.get_surface_count():
			var om := mi.mesh.surface_get_material(si)
			if om != null and om.resource_name == "glass":   # the pane of a mirror shows what lies before it
				var gm := ShaderMaterial.new(); gm.shader = shaders["mirror"]; gm.set_shader_parameter("ground_y", ground_y); timed.append(gm)
				mi.set_surface_override_material(si, gm); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; continue
			var sm := ShaderMaterial.new(); sm.shader = shaders["tex2" if mirror else "tex"]
			sm.set_shader_parameter("fog_col", sea_c); sm.set_shader_parameter("mist_col", mist_c); sm.set_shader_parameter("shadow_col", shadow_c); sm.set_shader_parameter("mist_k", mist_k)
			if om is BaseMaterial3D and (om as BaseMaterial3D).albedo_texture != null: sm.set_shader_parameter("albedo_tex", (om as BaseMaterial3D).albedo_texture)
			sm.set_shader_parameter("flat_n", 1.0)   # flat faces, like everything else in this world
			sm.set_shader_parameter("tint", Vector3(1.0, 1.14, 1.2) if mirror else Vector3(1.0, 0.96, 0.9))   # a little of the world's warm cast
			if sea_refl and refl_mat != null: sm.next_pass = refl_mat   # what stands in the sea lies dark on it, like everything else
			mi.set_surface_override_material(si, sm); pmats["prop|%d|%d" % [holder.get_instance_id(), si]] = sm
	if height <= 0.0 and across <= 0.0: return holder   # as it was made: its own size and place
	var k := (across / maxf(box.size.x, box.size.z)) if across > 0.0 else (height / box.size.y)
	src.scale = Vector3.ONE * k
	src.position = -Vector3(box.position.x + box.size.x * 0.5, box.position.y, box.position.z + box.size.z * 0.5) * k
	return holder

## the sight between the first two courts: "he hid every mirror". Tall mirrors stand in the sea on either side of the
## causeway, each wrapped in a sheet and tied round with rope, like shrouded figures. One or two have begun to come undone
func _shrouds() -> void:
	if not FileAccess.file_exists("res://props/mirror_tied.glb"): return
	# x, z, turn, size, kind. Those whose sheet lies spread on the ground stand on a wider footing
	var spots := [[-2.6, -5.9, 0.75, 1.0, "slip"], [-5.7, -5.3, 0.45, 1.04, "oval"], [-4.6, -7.7, 1.0, 1.08, "tied"], [-2.3, -8.9, 0.6, 1.0, "low"], [-7.2, -8.1, 0.85, 1.05, "round"],
		[2.4, -6.2, 0.95, 1.0, "wide"], [4.9, -7.4, 1.1, 1.1, "tied"], [7.3, -8.3, 0.7, 1.0, "hem"], [4.3, -9.8, 0.55, 1.0, "half"]]
	for sp in spots:
		var base := Vector3(sp[0], WATER + 0.22, sp[1])
		var m := mirror_stand(base, sp[2], self, WATER, sp[4], true); m.scale = Vector3.ONE * sp[3]
		if sp[4] == "slip" or sp[4] == "wide":   # a long plinth, turned with the mirror
			var hx := 1.2 if sp[4] == "slip" else 1.0; var hz := 0.74 if sp[4] == "slip" else 0.46
			blk(Vector3(-hx + 0.06, -1.0, -hz + 0.06), Vector3(hx - 0.06, -0.05, hz - 0.06), "stone", m); blk(Vector3(-hx, -0.05, -hz), Vector3(hx, 0.0, hz), "shade", m)
		else:
			var r: float = 0.66 * sp[3]
			cyl(Vector3(sp[0], WATER - 0.5, sp[1]), r - 0.06, r + 0.02, 0.72, pal("stone"), 14); cyl(base - Vector3(0, 0.05, 0), r, r, 0.05, pal("shade"), 14)

## the second court, "the crossing the water keeps". In its pool stands the winch of the west gate, on a pedestal no
## one can reach: the crossing to it fell long ago. The water still holds its shadow, and her reflection can walk it
func _pool_c() -> void:
	if COVERED:
		_pool_c_covered(); return
	var args := OS.get_cmdline_user_args()
	for both in [self, mroot]:
		var pg := Node3D.new(); both.add_child(pg)
		# the winch: a marble pedestal with its bronze fittings, and on it the wheel with its turned handles
		prop_model("winch_base", pg, 0.74, 0.0, both == mroot).position = PED
		cyl(PED + Vector3(0, 0.72, 0), 0.075, 0.075, 0.1, pal("gold"), 10, pg)
		var wn := Node3D.new(); wn.position = PED + Vector3(0, 0.8, 0); pg.add_child(wn)
		prop_model("winch_wheel", wn, 0.0, 1.22, both == mroot)
		if both == self: winch_a = wn; ped_a = pg
		else: winch_m = wn; ped_m = pg
		blk(Vector3(QX0, 0.0, PED.z - 0.3), Vector3(QX0 + 0.2, 0.07, PED.z + 0.3), "stone", both)   # the stub of the crossing at the west rim
		for rb3 in [[Vector3(QX0 + 0.27, 0.035, PED.z - 0.16), 0.5], [Vector3(QX0 + 0.24, 0.03, PED.z + 0.2), -0.4]]:
			var bk3 := blk(Vector3(-0.07, -0.035, -0.1), Vector3(0.07, 0.035, 0.1), "stone", both); bk3.position = rb3[0]; bk3.rotation.y = rb3[1]
		for cz in [PED.z - 1.05, PED.z + 1.05]:   # two low posts on the west rim: the head of the old crossing
			var cp := Vector3(QX0 - 0.22, 0, cz)
			cyl(cp, 0.17, 0.15, 0.08, pal("shade"), 16, both); cyl(cp + Vector3(0, 0.08, 0), 0.1, 0.09, 0.82, pal("stone"), 16, both); cyl(cp + Vector3(0, 0.9, 0), 0.15, 0.15, 0.06, pal("shade"), 16, both)
			ball(cp + Vector3(0, 1.06, 0), 0.1, pal("gold"), both)
	_strip_refl(mroot)
	if OS.get_environment("NOMIR") == "1": mroot.visible = false
	var wq := QuadMesh.new(); wq.size = Vector2(QX1 - QX0, QZ1 - QZ0); wq.orientation = PlaneMesh.FACE_Y
	glass2 = ShaderMaterial.new(); glass2.shader = shaders["glass"]; timed.append(glass2)
	glass2.set_shader_parameter("lost_rect", Vector4(QX0 + 0.16, PED.z - 0.3, PED.x - 0.34, PED.z + 0.3)); glass2.set_shader_parameter("lost_a", 1.0); glass2.set_shader_parameter("lost_x", 1.0)
	glass2.set_shader_parameter("blur_px", 4.4); glass2.set_shader_parameter("lod", 2.0)   # what this water shows is soft
	prim(wq, Vector3((QX0 + QX1) * 0.5, 0.012, (QZ0 + QZ1) * 0.5), glass2).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the west gate: two piers, a lintel, and a bronze grille until the winch is turned
	for gz in [-13.86, -12.14]:
		blk(Vector3(CX0 - 0.04, 0, gz - 0.14), Vector3(CX0 + 0.24, 2.1, gz + 0.14), "stone"); blk(Vector3(CX0 - 0.07, 0, gz - 0.17), Vector3(CX0 + 0.27, 0.1, gz + 0.17), "shade")
	blk(Vector3(CX0 - 0.04, 2.1, -14.0), Vector3(CX0 + 0.24, 2.42, -12.0), "stone")
	cornice(CX0 - 0.04, -14.0, CX0 + 0.24, -12.0, 2.42, 0.04, 0.06); dentils(CX0 - 0.04, -14.0, CX0 + 0.24, -12.0, 2.42)
	gate_c = Node3D.new(); gate_c.position = Vector3(CX0 + 0.1, 0, -13.0); add_child(gate_c)
	for i in 8: blk(Vector3(-0.018, 0, -0.63 + 0.18 * i - 0.018), Vector3(0.018, 2.02, -0.63 + 0.18 * i + 0.018), "dark", gate_c)
	for gy in [0.5, 1.2, 1.9]: blk(Vector3(-0.024, gy, -0.7), Vector3(0.024, gy + 0.04, 0.7), "gold", gate_c)
	if not ("shots" in args or "solve2" in args or "tour" in args): gate_c.position.y = -2.4

## the second court, "the mirror he covered". Its pool lies under a great cloth, as the sculptor covered every mirror.
## With the cloth drawn off, the water shows the west wall with a door in it, where the wall itself is plain stone.
## Only after that has been seen can the stone be pushed
func _pool_c_covered() -> void:
	var args := OS.get_cmdline_user_args()
	_strip_refl(mroot)
	var m0 := mroot.get_child_count()
	var x := WALLX; var h := WALLH; var z0 := -16.18; var z1 := -11.6; var da := DOORZ - 0.45; var db := DOORZ + 0.45; var dh := 1.85
	# the wall itself: three masses round the place of the door, and a leaf of the same stone that closes it
	blk(Vector3(CX0, 0, z0), Vector3(x, h, da), "stone"); blk(Vector3(CX0, 0, db), Vector3(x, h, z1), "stone"); blk(Vector3(CX0, dh, da), Vector3(x, h, db), "stone")
	blk(Vector3(CX0 - 0.03, 0, z0), Vector3(x + 0.03, 0.1, da), "shade"); blk(Vector3(CX0 - 0.03, 0, db), Vector3(x + 0.03, 0.1, z1 + 0.03), "shade")
	cornice(CX0, z0, x, z1, h); dentils(CX0, z0, x, z1, h); crenels(Vector3(x - 0.09, h + 0.06, z0 + 0.1), Vector3(x - 0.09, h + 0.06, z1 - 0.1), 0.335)
	door_a = Node3D.new(); add_child(door_a)
	blk(Vector3(x - 0.16, 0, da), Vector3(x, dh, db), "stone", door_a)
	blk(Vector3(x - 0.02, 0, da), Vector3(x + 0.03, 0.1, db), "shade", door_a)   # the skirting runs on unbroken: nothing gives the leaf away
	seam_a = Node3D.new(); seam_a.position = Vector3(x + 0.003, 0, DOORZ); seam_a.scale = Vector3(1, 0.001, 1); seam_a.visible = false; door_a.add_child(seam_a)
	for sz in [-0.45, 0.45]: blk(Vector3(0, 0, sz - 0.014), Vector3(0.004, dh, sz + 0.014), "dark", seam_a)
	blk(Vector3(0, dh - 0.028, -0.45), Vector3(0.004, dh, 0.45), "dark", seam_a)
	blk(Vector3(0, 0, -0.01), Vector3(0.004, dh - 0.028, 0.01), "dark", seam_a)
	# in the water the same wall hangs upside down, and there the bay that is blank above has a door
	var xm := x - 0.012
	blk(Vector3(xm, 0, -15.86), Vector3(x, h, da), "stone", mroot); blk(Vector3(xm, 0, db), Vector3(x, h, z1), "stone", mroot); blk(Vector3(xm, dh, da), Vector3(x, h, db), "stone", mroot)
	blk(Vector3(xm, h, -15.86), Vector3(x + 0.03, h + 0.07, z1), "shade", mroot)
	for i in 13: blk(Vector3(xm, h + 0.07, -15.8 + 0.335 * i), Vector3(x, h + 0.19, -15.8 + 0.335 * i + 0.13), "stone", mroot)
	blk(Vector3(x, 0, -15.86), Vector3(x + 0.03, 0.1, da), "shade", mroot); blk(Vector3(x, 0, db), Vector3(x + 0.03, 0.1, z1), "shade", mroot)
	for jz in [da - 0.06, db + 0.06]: blk(Vector3(x, 0, jz - 0.06), Vector3(x + 0.04, dh + 0.12, jz + 0.06), "dark", mroot)   # the frame of the door
	blk(Vector3(x, dh, da - 0.12), Vector3(x + 0.05, dh + 0.14, db + 0.12), "dark", mroot)
	blk(Vector3(x, dh + 0.14, da - 0.18), Vector3(x + 0.06, dh + 0.2, db + 0.18), "gold", mroot)
	door_m = Node3D.new()
	blk(Vector3(x - 0.01, 0, da), Vector3(x + 0.02, dh, db), "crim", door_m)
	blk(Vector3(x + 0.02, 0, DOORZ - 0.02), Vector3(x + 0.026, dh, DOORZ + 0.02), "dark", door_m)
	for sy in [0.4, 0.95, 1.5]:
		for sz in [-0.24, 0.24]: blk(Vector3(x + 0.02, sy - 0.05, DOORZ + sz - 0.05), Vector3(x + 0.034, sy + 0.05, DOORZ + sz + 0.05), "gold", door_m)
	for both in [self, mroot]:
		for nz in [-15.3, -12.7]: niche_x(x, 0.35, nz, 0.5, 1.05, both)
	_strip_refl(mroot, m0, "mir", 0.2)
	_strip_refl(door_m, 0, "mir", 0.0)   # the door keeps its own colour: it is the thing to be seen
	var leaf_m := (door_m.get_child(0) as MeshInstance3D).material_override as ShaderMaterial
	for cn in ["c_top", "c_z", "c_x"]: leaf_m.set_shader_parameter(cn, Color("cf1f2d"))   # deep enough to stay red through the water
	mroot.add_child(door_m)
	if OS.get_environment("NOMIR") == "1": mroot.visible = false
	var wq := QuadMesh.new(); wq.size = Vector2(QX1 - QX0, QZ1 - QZ0); wq.orientation = PlaneMesh.FACE_Y
	glass2 = ShaderMaterial.new(); glass2.shader = shaders["glass"]; timed.append(glass2)
	glass2.set_shader_parameter("blur_px", 1.9); glass2.set_shader_parameter("wave", 0.7)   # a little clearer than the first pool: here there is something to read
	prim(wq, Vector3((QX0 + QX1) * 0.5, 0.012, (QZ0 + QZ1) * 0.5), glass2).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the cloth over the pool
	var sj := "res://props/sheet.json"
	if FileAccess.file_exists(sj) and OS.get_environment("NOSHEET") != "1":
		sheet_meta = JSON.parse_string(FileAccess.get_file_as_string(sj))
		sheet_data = FileAccess.get_file_as_bytes("res://props/sheet.bin").to_float32_array()
		var nx := int(sheet_meta.nx); var ny := int(sheet_meta.ny)
		for j in ny + 1:
			for i in nx + 1: sheet_uv.append(Vector2(float(i) / nx, 1.0 - float(j) / ny))
		for j in ny:
			for i in nx:
				var k := j * (nx + 1) + i
				sheet_ix.append_array(PackedInt32Array([k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2]))
		var im := Image.load_from_file(ProjectSettings.globalize_path("res://props/sheet.png"))
		var small: Image = im.duplicate(); small.resize(1, 1, Image.INTERPOLATE_LANCZOS); var mean := small.get_pixel(0, 0)   # tinted so that on the whole it is the terracotta of her own cloth
		im.generate_mipmaps()
		var sm := ShaderMaterial.new(); sm.shader = shaders["sheet"]; sm.set_shader_parameter("albedo_tex", ImageTexture.create_from_image(im))
		var ml := mean.srgb_to_linear()   # (the texture is read as linear light, so its mean is taken there)
		sm.set_shader_parameter("mean_l", maxf((ml.r + ml.g + ml.b) / 3.0, 0.01)); sm.set_shader_parameter("base", Color(0.78, 0.35, 0.25))
		sheet_mesh = ArrayMesh.new(); sheet = MeshInstance3D.new(); sheet.mesh = sheet_mesh; sheet.material_override = sm; sheet.extra_cull_margin = 6.0; add_child(sheet)
		sheet_f = float(OS.get_environment("SHEET_F")) if OS.get_environment("SHEET_F") != "" else 1.0
		sheet_set(sheet_f)

## the cloth as it lies at frame f of its simulation (the stored frames are every second one; between them it is blended)
func sheet_set(f: float) -> void:
	if sheet_mesh == null: return
	var nx := int(sheet_meta.nx); var ny := int(sheet_meta.ny); var nv := (nx + 1) * (ny + 1); var step := float(sheet_meta.step)
	var q := clampf((f - 1.0) / step, 0.0, float(sheet_meta.frames) - 1.0); var a := int(q); var b := mini(a + 1, int(sheet_meta.frames) - 1); var u := q - a
	var vs := PackedVector3Array(); vs.resize(nv); var o0 := a * nv * 3; var o1 := b * nv * 3
	for k in nv:   # Blender's x east, y north, z up -> x, -z, y here
		var k3 := k * 3
		vs[k] = Vector3(lerpf(sheet_data[o0 + k3], sheet_data[o1 + k3], u) + SHEET_C.x, lerpf(sheet_data[o0 + k3 + 2], sheet_data[o1 + k3 + 2], u) + SHEET_C.y, -lerpf(sheet_data[o0 + k3 + 1], sheet_data[o1 + k3 + 1], u) + SHEET_C.z)
	var ns := PackedVector3Array(); ns.resize(nv)
	for j in ny + 1:
		for i in nx + 1:
			var k := j * (nx + 1) + i
			var dx := vs[k + (1 if i < nx else 0)] - vs[k - (1 if i > 0 else 0)]
			var dy := vs[k + ((nx + 1) if j < ny else 0)] - vs[k - ((nx + 1) if j > 0 else 0)]
			ns[k] = dy.cross(dx).normalized()
	var arr := []; arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns; arr[Mesh.ARRAY_TEX_UV] = sheet_uv; arr[Mesh.ARRAY_INDEX] = sheet_ix
	sheet_mesh.clear_surfaces(); sheet_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)

## where one vertex of the cloth is at frame f
func sheet_vpos(v: int, f: float) -> Vector3:
	var nv := (int(sheet_meta.nx) + 1) * (int(sheet_meta.ny) + 1); var step := float(sheet_meta.step)
	var q := clampf((f - 1.0) / step, 0.0, float(sheet_meta.frames) - 1.0); var a := int(q); var b := mini(a + 1, int(sheet_meta.frames) - 1); var u := q - a
	var o0 := (a * nv + v) * 3; var o1 := (b * nv + v) * 3
	return Vector3(lerpf(sheet_data[o0], sheet_data[o1], u) + SHEET_C.x, lerpf(sheet_data[o0 + 2], sheet_data[o1 + 2], u) + SHEET_C.y, -lerpf(sheet_data[o0 + 1], sheet_data[o1 + 1], u) + SHEET_C.z)

## her hands while she gathers the cloth. Each patch of its middle line is taken by one hand in turn (right, left,
## right ...): the hand reaches for it as it comes, goes with it to her waist, and lets it fall on the heap
func sheet_hands(dt: float) -> void:
	var wl := 0.0; var wr := 0.0; var hi := 0.0
	var grabs: Array = sheet_meta.grabs
	for k in grabs.size():
		var g: Dictionary = grabs[k]; var arr := float(g.arr); var drop := float(g.drop)
		var w := clampf((sheet_f - (arr - 11.0)) / 9.0, 0.0, 1.0) * clampf((drop + 5.0 - sheet_f) / 5.0, 0.0, 1.0)
		if w <= 0.0: continue
		var p := sheet_vpos(int(g.v), sheet_f) + Vector3(0.0, 0.03, 0.0)
		if k % 2 == 0:
			if w > wr: wr = w; tgtR = p + Vector3(0, 0, -0.05)
		else:
			if w > wl: wl = w; tgtL = p + Vector3(0, 0, 0.05)
		hi = maxf(hi, w * clampf(1.0 - (p.y - 0.45) / 0.5, 0.0, 1.0))
	a_wR = lerpf(a_wR, wr, 1.0 - exp(-14.0 * dt)); a_wL = lerpf(a_wL, wl, 1.0 - exp(-14.0 * dt))
	a_lean = lerpf(a_lean, 0.05 + 0.2 * hi, 1.0 - exp(-7.0 * dt))   # she bends to the cloth and straightens as she draws it up

func _world() -> void:
	# ---- A. the arrival court (10 x 9.5 m, open floor all round the mirror pool)
	slab(AX0, AZ0, AX1, AZ1, 0.0); under(AX0, AZ0, AX1, AZ1, 0.22, "stone")   # no pool here any more: the water belongs to the second court
	tiles(AX0, AZ0, AX1, AZ1, 1.0); meander(AX0 + 0.7, AZ0 + 0.7, AX1 - 0.2, AZ1 - 0.2)
	parapet(Vector3(AX0 + 0.1, 0, -3.9), Vector3(AX0 + 0.1, 0, AZ1 - 0.1)); parapet(Vector3(AX0 + 0.1, 0, -3.9), Vector3(-0.85, 0, -3.9)); parapet(Vector3(0.85, 0, -3.9), Vector3(3.4, 0, -3.9))
	parapet(Vector3(3.4, 0, -3.9), Vector3(3.4, 0, -0.3)); parapet(Vector3(3.4, 0, 2.3), Vector3(3.4, 0, AZ1 - 0.1))
	parapet(Vector3(AX0 + 0.1, 0, AZ1 - 0.1), Vector3(-0.95, 0, AZ1 - 0.1)); parapet(Vector3(0.95, 0, AZ1 - 0.1), Vector3(3.4, 0, AZ1 - 0.1))
	tree(Vector3(AX0 + 0.5, 0, AZ1 - 0.55), 1.2); cypress(Vector3(AX0 + 0.45, 0, -3.5), 2.6)
	_start_zone()
	lantern(Vector3(1.15, 0, -3.72), 2); urn(Vector3(2.9, 0, AZ1 - 0.5), 1.0); urn(Vector3(3.1, 0, AZ1 - 0.78), 0.7, "rose")
	for gx in [-0.72, 0.72]:
		blk(Vector3(gx - 0.14, 0, -4.04), Vector3(gx + 0.14, 2.1, -3.76), "stone"); blk(Vector3(gx - 0.17, 0, -4.07), Vector3(gx + 0.17, 0.1, -3.73), "shade")
	var gw := CSGBox3D.new(); gw.size = Vector3(1.72, 0.66, 0.28); gw.position = Vector3(0, 2.43, -3.9); gw.material = pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = 0.58; gc.height = 0.5; gc.sides = 32
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -0.33, 0); gc.material = pal("shade"); gw.add_child(gc); add_child(gw)
	cornice(-0.86, -4.04, 0.86, -3.76, 2.76, 0.04, 0.06); dentils(-0.86, -4.04, 0.86, -3.76, 2.76); blk(Vector3(-0.06, 2.82, -3.94), Vector3(0.06, 2.94, -3.86), "crim")
	for i in 5:
		blk(Vector3(-0.8, -0.26 * (i + 1) - 0.2, AZ1 + 0.26 * i), Vector3(0.8, -0.26 * (i + 1), AZ1 + 0.26 * (i + 1)), "stone")
	blk(Vector3(-0.95, -2.45, AZ1), Vector3(-0.8, -0.05, AZ1 + 1.3), "shade"); blk(Vector3(0.8, -2.45, AZ1), Vector3(0.95, -0.05, AZ1 + 1.3), "shade")
	foam(-0.95, AZ1 + 0.05, 0.95, AZ1 + 1.3, 0.3)
	boat = Node3D.new(); boat.name = "Boat"; boat.position = Vector3(2.5, WATER - 0.12, AZ1 + 1.4); boat.rotation.y = 1.0; add_child(boat)
	build_boat(boat)
	cyl(Vector3(1.2, -0.2, AZ1 + 0.7), 0.045, 0.045, 0.75, pal("wood"), 8)
	slab(3.5, -0.3, 5.1, 2.3, 0.0); under(3.5, -0.3, 5.1, 2.3, 0.2, "sand"); parapet(Vector3(5.0, 0, -0.2), Vector3(5.0, 0, 2.2))
	blk(Vector3(3.9, 0, 1.9), Vector3(4.6, 0.22, 2.12), "shade")
	# (the great veiled head that lay here is taken out of this view: it is kept for another place)
	slab(-10.6, -2.2, -9.2, 2.2, 0.0); under(-10.6, -2.2, -9.2, 2.2, 0.18, "sand")
	for cz in [-1.6, -0.55, 0.55, 1.6]: column(Vector3(-9.9, 0, cz), 2.4, 0.15)
	blk(Vector3(-10.14, 2.45, -1.9), Vector3(-9.66, 2.66, 1.9), "stone"); cornice(-10.14, -1.9, -9.66, 1.9, 2.66, 0.04, 0.06); dentils(-10.14, -1.9, -9.66, 1.9, 2.45)
	# ---- B. the causeway between the two courts, whole. On either side of it, in the sea, stand the mirrors he hid
	slab(-0.6, -10.0, 0.6, -4.0, 0.0)
	pier(0.0, -5.0, -0.18, 0.7); pier(0.0, -7.0, -0.18, 0.7); pier(0.0, -8.9, -0.18, 0.7)
	_shrouds()
	# ---- C. the lever court (6.5 x 6 m)
	_pool_court(CX0, CZ0, CX1, CZ1, QX0, QZ0, QX1, QZ1, "sand", "PoolSky2")
	tile_hole = Rect2(QX0 - 0.08, QZ0 - 0.08, QX1 - QX0 + 0.16, QZ1 - QZ0 + 0.16); tiles(-3.4, -16.4, 3.5, -10.0, 1.0); tile_hole = Rect2()
	if COVERED: rosette(Vector3(1.3, 0, -13.0), 1.2)
	blk(Vector3(-3.4, 0, -16.4), Vector3(3.5, 1.6, -16.18), "stone"); cornice(-3.4, -16.4, 3.5, -16.18, 1.6); dentils(-3.4, -16.4, 3.5, -16.18, 1.6)
	crenels(Vector3(-3.3, 1.66, -16.22), Vector3(3.4, 1.66, -16.22), 0.335)
	for wx in [-2.4, -1.0, 0.4, 1.8]: win_z(wx, 0.25, -16.18, 0.5, 1.05)
	banner(Vector3(-0.3, 1.5, -16.165), 0.34, 0.95); banner(Vector3(2.55, 1.5, -16.165), 0.34, 0.95)
	plinth_head("kit_face6", Vector3(-2.42, 0, -15.72) if COVERED else Vector3(-2.95, 0, -15.95), 0.5); plinth_head("kit_face4", Vector3(3.2, 0, -15.9), -0.4)
	if COVERED: parapet(Vector3(-3.3, 0, -11.6), Vector3(-3.3, 0, -10.1))
	else: parapet(Vector3(-3.3, 0, -16.0), Vector3(-3.3, 0, -13.75)); parapet(Vector3(-3.3, 0, -12.25), Vector3(-3.3, 0, -10.1))
	parapet(Vector3(3.4, 0, -16.0), Vector3(3.4, 0, -10.1))
	parapet(Vector3(-3.3, 0, -10.1), Vector3(-0.85, 0, -10.1)); parapet(Vector3(0.85, 0, -10.1), Vector3(3.4, 0, -10.1))
	lantern(Vector3(3.15, 0, -10.35), 3, -1.0); cypress(Vector3(-3.0, 0, -10.5), 2.1); urn(Vector3(2.2, 0, -15.9), 0.9); urn(Vector3(2.45, 0, -15.75), 0.65, "rose")
	cyl(CAP, 0.3, 0.26, 0.05, pal("shade"), 32).visible = SHOW_CAPSTAN; cyl(CAP + Vector3(0, 0.05, 0), 0.065, 0.05, 0.95, pal("stone"), 16).visible = SHOW_CAPSTAN
	cap_rot = Node3D.new(); cap_rot.name = "Cap"; cap_rot.position = CAP + Vector3(0, 0.98, 0); cap_rot.rotation.y = -0.42; cap_rot.visible = SHOW_CAPSTAN; add_child(cap_rot)
	blk(Vector3(-0.022, -0.022, -0.2), Vector3(0.022, 0.022, 0.84), "dark", cap_rot)
	ball(Vector3(0, 0, 0.86), 0.045, pal("crim"), cap_rot); ball(Vector3(0, 0.06, 0), 0.045, pal("crim"), cap_rot)
	if SHOW_CAPSTAN: decal(CAP + Vector3(0.12, 0, -0.12), 0.9, 0.7, 0.22, 0.78)
	_pool_c()
	# ---- the turning bridge and the long walk west
	slab(-4.2, -13.6, -3.4, -12.4, 0.0)
	if COVERED: slab(-4.2, -14.6, -3.4, -13.6, 0.0)
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
	mirror_stand(Vector3(-17.9, 0, -16.5), 0.2); mirror_stand(Vector3(-14.7, 0, -16.5), -0.2); mirror_stand(Vector3(3.05, 0, -14.6) if COVERED else Vector3(-3.05, 0, -14.6), -PI * 0.5 if COVERED else PI * 0.5)
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
		if mroot != null and rig_file != "": H["mir"] = spawn_her(mroot, "mirror")
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
	for r in [["A", AX0 + 0.85, -3.15, 3.15, AZ1 - 0.35], ["S", 3.15, 0.7, 4.6, 1.3], ["B1", -0.25, -5.8, 0.25, -3.15], ["Bg", -0.25, -7.8, 0.25, -5.8], ["B2", -0.25, -10.35, 0.25, -7.8],
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
	if Engine.get_frames_drawn() == 45 and OS.get_environment("STATS") == "2":
		var g := {"figures": 0, "figures_n": 0, "heads": 0, "world": 0, "world_n": 0, "copy_under_sea": 0, "second_pass": 0}
		var cache := {}
		for mm in find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			if mi.mesh == null or not mi.is_visible_in_tree(): continue
			if not cache.has(mi.mesh): cache[mi.mesh] = mi.mesh.get_faces().size() / 3
			var t: int = cache[mi.mesh]
			var in_copy := refl != null and refl.is_ancestor_of(mi)
			var two := false
			var mo := mi.material_override
			if mo == null and mi.mesh.get_surface_count() > 0: mo = mi.get_surface_override_material(0)
			if mo is ShaderMaterial and (mo as ShaderMaterial).next_pass != null: two = true
			if in_copy: g.copy_under_sea += t
			elif t > 20000: g.figures += t; g.figures_n += 1
			elif t > 1500: g.heads += t
			else: g.world += t; g.world_n += 1
			if two: g.second_pass += t
		print("STATS2 ", g)
	if Engine.get_frames_drawn() == 45 and OS.get_environment("STATS") == "1":
		print("STATS objects ", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME), " triangles ", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME), " draw calls ", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME), " texture MB ", snappedf(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED) / 1048576.0, 0.1), " mesh instances ", find_children("*", "MeshInstance3D", true, false).size())
	t += dt
	var target := 0.0
	var want_yaw := yaw
	if not route.is_empty():
		var p3: Vector3 = route[0].p
		var to := Vector3(p3.x - pos.x, 0, p3.z - pos.z)
		var left := to.length()
		for i in range(1, mini(route.size(), 5)): left += Vector2(route[i].p.x - route[i - 1].p.x, route[i].p.z - route[i - 1].p.z).length()
		rem_dist = left
		target = minf(speed_cap, sqrt(2.0 * (2.4 if shape_file != "" else 1.25 if rig_file != "" else 1.1) * left) + 0.03)   # she slows over a good pace or two, not in one
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
	turn_amt = absf(angle_difference(yaw, want_yaw)) if (route.is_empty() and face_to != null) else 0.0
	if rig_file != "" and shape_file == "":   # a turn that gathers and settles, instead of one that starts at full speed
		yaw_v += (angle_difference(yaw, want_yaw) * 34.0 - yaw_v * 11.8) * dt
		yaw_v = clampf(yaw_v, -3.2, 3.2); yaw += yaw_v * dt
	else:
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
	if sheet_held: sheet_hands(dt)   # she hauls the cloth in hand over hand: each hand goes with the patch it holds
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
	for k in ["Bridge", "Cap", "Door", "Boat"]:
		if refl.has_node(k): (refl.get_node(k) as Node3D).transform = (world.get_node(k) as Node3D).transform
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
	if rig_file != "": moving = (spd > 0.2 if walk_on else (not route.is_empty() and rem_dist > 0.05)) or turn_amt > (0.3 if walk_on else 0.7)   # a big turn on the spot is made with steps
	for fm in floor_mats: fm.set_shader_parameter("floor_y", pos.y)
	if moving != walk_on:
		walk_on = moving
		for h in H.values():
			if h.ap != null: h.ap.play("walk" if moving else "idle", (0.38 if moving else 0.6) if rig_file != "" else 0.25)
	pose_k = move_toward(pose_k, 1.0 if posing else 0.0, dt / 0.9)   # she comes to stillness, and out of it, over most of a second
	for k in H:
		var hd: Node3D = H[k].holder
		hd.position = pos; hd.rotation.y = yaw
		if H[k].ap != null: H[k].ap.speed_scale = (1.0 - smoothstep(0.0, 1.0, pose_k)) * (clampf(spd / 1.1, 0.4 if rig_file != "" else 0.7, 2.3) if moving else 1.0)
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
	if cam_focus_on: cam_t = cam_t.lerp(cam_focus, 1.0 - exp(-1.8 * dt))
	elif rig_file != "": cam_t = cam_t.lerp(pos + vel * 0.25, 1.0 - exp(-4.0 * dt))
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

## the solution of the first puzzle, played out: she stands on the carved feet, her reflection
## leaves her, crosses on the reflection of the lost footbridge and turns the winch in the water
func _eid_go(e: Dictionary, to: Vector3, speed := 0.8) -> void:
	var hd: Node3D = e.holder; var d := to - hd.position; d.y = 0.0
	hd.rotation.y = atan2(d.x, d.z)
	(e.ap as AnimationPlayer).play("walk", 0.25); (e.ap as AnimationPlayer).speed_scale = clampf(speed / 1.1, 0.45, 2.3)
	var t := create_tween(); t.tween_property(hd, "position", to, d.length() / speed)
	await t.finished
	(e.ap as AnimationPlayer).play("idle", 0.4); (e.ap as AnimationPlayer).speed_scale = 1.0

## the first puzzle, "become the statue", solved. No captions: the gate is shut and the pool is empty of any way
## across. The water shows the row of statues whole, the fifth with one arm raised, where her own plinth stands
## empty. She goes back up onto it, raises her arm, and is still. Then the winch rises out of the water
func _solve_statue(alone := true) -> void:
	started = true; title_box.hide(); hint.hide()
	gate_a.position.y = 0.0
	var twin: Node3D = H["mir"].holder
	pos = Vector3(0.9, 0, 3.4); yaw = PI * 1.2; cam_t = pos; cam.size = 6.6
	await wait(1.0)
	cam_focus = Vector3(-2.2, 0.3, -0.5); cam_focus_on = true
	await go([Vector3(-0.35, 0, 1.2), Vector3(-0.5, 0, MYPL.z)])
	await face(Vector3(-3.0, 0, MYPL.z))
	create_tween().tween_property(cam, "size", 5.2, 1.8)
	await wait(2.6)                                     # four statues, and one plinth with nobody on it
	# back to her own plinth, across the rug, and up onto it: one walk, with the step up in it
	create_tween().tween_property(cam, "size", 5.8, 1.6)
	go([Vector3(MYPL.x, 0, MYPL.z)], 0.8)
	while pos.x > MYPL.x + 0.5: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.17, 0.6).set_trans(Tween.TRANS_SINE)
	twin.visible = false
	await arrived
	await wait(0.3)
	await face(Vector3(0.0, 0, MYPL.z))
	await wait(1.4)
	tgtL = MYPL + Vector3(0.21, 1.44, -0.03); tgtR = MYPL + Vector3(0.21, 1.44, 0.03)   # her hands come together before her, as the statue's beside her
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.2); up.tween_property(self, "a_wL", 1.0, 1.2)
	await up.finished
	await wait(0.3)
	posing = true                                       # and she is still
	await wait(2.6)
	# the row is whole: the gate of the court goes down
	cam_focus = Vector3(-1.6, 0.6, -1.6)
	create_tween().tween_property(cam, "size", 7.2, 1.6)
	await wait(1.4)
	var gt := create_tween(); gt.tween_property(gate_a, "position:y", -2.4, 2.6).set_trans(Tween.TRANS_SINE)
	await gt.finished
	await wait(0.8)
	posing = false
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.8); dn.tween_property(self, "a_wL", 0.0, 0.8)
	await dn.finished
	await wait(0.4)
	# down from the plinth and out through the gate, in one walk
	cam_focus_on = false
	create_tween().tween_property(cam, "size", 6.4, 1.4)
	go([Vector3(MYPL.x + 0.7, 0, MYPL.z), Vector3(-0.4, 0, -2.2), Vector3(0, 0, -3.1), Vector3(0, 0, -4.9 if alone else -7.0)])
	while pos.x < MYPL.x + 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.55).set_trans(Tween.TRANS_SINE)
	twin.visible = true
	if not alone:   # on to the causeway: the view opens on the sea and what stands in it
		while pos.z > -3.6: await get_tree().process_frame
		create_tween().tween_property(cam, "size", 8.6, 3.0).set_trans(Tween.TRANS_SINE)
	await arrived
	if alone:
		await wait(0.8)
		get_tree().quit()

## the first two puzzles and the walk between them, in one piece: the statue, the causeway among the hidden mirrors,
## the crossing the water keeps
func _tour() -> void:
	await _solve_statue(false)
	await face(Vector3(-4.0, 0, -7.6))                   # she stops among them
	await wait(2.6)
	await _solve2(false)
	await wait(0.8)
	get_tree().quit()

## the second puzzle, "the crossing the water keeps", solved. No captions: she walks on toward the winch; at the rim
## her body can go no further, and her reflection does not stop
func _solve2(alone := true) -> void:
	started = true; title_box.hide(); hint.hide()
	gate_c.position.y = 0.0
	var rim := Vector3(QX0 - 0.14, 0, PED.z)
	if alone:
		pos = Vector3(0.0, 0, -10.3); yaw = PI; cam_t = pos; cam.size = 6.4
		await wait(1.0)
		cam_focus = Vector3(0.1, 0.1, -12.7); cam_focus_on = true
		await go([Vector3(-1.95, 0, -11.0), Vector3(-2.0, 0, PED.z), Vector3(rim.x - 0.25, 0, PED.z)])
	else:   # she comes in from the causeway: the camera closes on the court as she reaches it
		go([Vector3(0, 0, -10.2), Vector3(-1.95, 0, -11.0), Vector3(-2.0, 0, PED.z), Vector3(rim.x - 0.25, 0, PED.z)])
		while pos.z > -9.3: await get_tree().process_frame
		cam_focus = Vector3(0.1, 0.1, -12.7); cam_focus_on = true
		create_tween().tween_property(cam, "size", 6.4, 2.4).set_trans(Tween.TRANS_SINE)
		await arrived
	await wait(0.5)
	create_tween().tween_property(cam, "size", 5.4, 2.0)
	go([rim])
	while pos.x < rim.x - 0.12: await get_tree().process_frame
	var e: Dictionary = H["mir"]; H.erase("mir")
	await _eid_go(e, Vector3(PED.x - 0.62, 0.0, PED.z), 0.72)
	await wait(0.5)
	var wt := create_tween().set_parallel(); wt.tween_property(winch_a, "rotation:y", -PI * 2.5, 3.0).set_trans(Tween.TRANS_SINE); wt.tween_property(winch_m, "rotation:y", -PI * 2.5, 3.0).set_trans(Tween.TRANS_SINE)
	await wait(1.4)
	cam_focus = Vector3(-1.5, 0.5, -12.8)
	create_tween().tween_property(cam, "size", 7.2, 1.6)
	await wait(2.0)
	var gt := create_tween(); gt.tween_property(gate_c, "position:y", -2.4, 2.4).set_trans(Tween.TRANS_SINE)
	await gt.finished
	await wait(1.0)
	await _eid_go(e, Vector3(pos.x, 0, pos.z), 0.72)
	(e.holder as Node3D).rotation.y = yaw
	H["mir"] = e
	await wait(0.9)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", 6.4, 1.4)
	await go([Vector3(-2.3, 0, -13.0), Vector3(-3.95, 0, -13.0)])
	if alone:
		await wait(0.8)
		get_tree().quit()

## the covered mirror, solved. No captions: she finds the court closed, draws the cloth off the pool, sees in the
## water a door that the wall does not have, goes to that place on the wall and lays her hands on it. Only then do the
## joints of the door show in the stone, and it gives way
func _solve_covered() -> void:
	started = true; title_box.hide(); hint.hide()
	var grabs: Array = sheet_meta.grabs
	var stand := Vector3(SHEET_C.x + float(sheet_meta.xr) + 0.4, 0, SHEET_C.z)
	var done_f := float((grabs[grabs.size() - 1] as Dictionary).drop) + 8.0; var FE := float(sheet_meta.end)
	pos = Vector3(0.4, 0, -10.3); yaw = PI; cam_t = pos; cam.size = 6.8
	await wait(1.0)
	cam_focus = Vector3(-0.2, 0.2, -12.6); cam_focus_on = true
	await go([Vector3(1.5, 0, -11.6), stand])
	await face(Vector3(-1.0, 0, stand.z))
	await wait(0.6)
	# she gathers the cloth in, hand over hand, and it heaps at her feet
	create_tween().tween_property(cam, "size", 5.8, 2.0)
	sheet_f = float(sheet_meta.t0) - 4.0; sheet_held = true
	while sheet_f < done_f:
		sheet_f = minf(sheet_f + get_process_delta_time() * 30.0, done_f); sheet_set(sheet_f)
		await get_tree().process_frame
	sheet_held = false
	var r := tw(); r.tween_property(self, "a_wR", 0.0, 0.5); r.tween_property(self, "a_wL", 0.0, 0.5); r.tween_property(self, "a_lean", 0.0, 0.5)
	var settle := func():   # the heap settles by itself while she turns to the water
		while sheet_f < FE:
			sheet_f = minf(sheet_f + get_process_delta_time() * 30.0, FE); sheet_set(sheet_f)
			await get_tree().process_frame
	settle.call()
	await wait(0.9)
	# the water: the wall upside down, and in it a door
	cam_focus = Vector3(-1.0, 0.3, -12.7)
	create_tween().tween_property(cam, "size", 4.9, 1.8)
	await go([Vector3(1.25, 0, -11.9), Vector3(0.35, 0, -11.75)])
	await face(Vector3(-1.5, 0, -12.9))
	await wait(3.0)
	door_seen = true
	# she goes to that place on the wall. There is nothing to see there, until she lays her hands on the stone
	create_tween().tween_property(cam, "size", 5.8, 1.6)
	cam_focus = Vector3(-1.5, 0.5, -13.2)
	await go([Vector3(0.3, 0, -10.95), Vector3(-2.55, 0, -10.95), Vector3(-2.5, 0, DOORZ)])
	await face(Vector3(WALLX, 0, DOORZ))
	await wait(0.4)
	tgtL = Vector3(WALLX + 0.02, 1.12, DOORZ + 0.16); tgtR = Vector3(WALLX + 0.02, 1.12, DOORZ - 0.16)
	var ph := tw(); ph.tween_property(self, "a_wL", 1.0, 0.5); ph.tween_property(self, "a_wR", 1.0, 0.5); ph.tween_property(self, "a_lean", 0.14, 0.5)
	await ph.finished
	if door_seen:
		seam_a.visible = true   # now the joints show, drawn up the stone from the floor
		var st := create_tween(); st.tween_property(seam_a, "scale:y", 1.0, 1.5).set_trans(Tween.TRANS_SINE)
		await st.finished
		await wait(0.5)
		# and the stone gives way: back into the wall, then down
		create_tween().tween_property(self, "a_lean", 0.2, 0.4)
		var dt1 := create_tween().set_parallel()
		dt1.tween_property(door_a, "position:x", -0.3, 1.1).set_trans(Tween.TRANS_SINE); dt1.tween_property(door_m, "position:x", -0.3, 1.1).set_trans(Tween.TRANS_SINE)
		await wait(0.7)
		var pb := tw(); pb.tween_property(self, "a_wL", 0.0, 0.5); pb.tween_property(self, "a_wR", 0.0, 0.5); pb.tween_property(self, "a_lean", 0.0, 0.5)
		await wait(0.6)
		var dt2 := create_tween().set_parallel()
		dt2.tween_property(door_a, "position:y", -1.95, 2.0).set_trans(Tween.TRANS_SINE); dt2.tween_property(door_m, "position:y", -1.95, 2.0).set_trans(Tween.TRANS_SINE)
		await dt2.finished
	await wait(0.6)
	await go([Vector3(-3.95, 0, DOORZ)])
	await wait(0.8)
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
