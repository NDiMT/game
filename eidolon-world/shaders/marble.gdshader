shader_type spatial;
// World marble for all merged static geometry. Vertex COLOR packs:
//   r = per-piece random (tint variance)
//   g = material: 0.00 cream floor (1 m tile grid + grout), 0.25 cream carved marble (walls, columns,
//       statues), 0.50 rough island stone (cliffs under the slabs), 0.75 black polished marble floor,
//       1.00 charcoal (dead wood, iron, bronze)
//   b = 1 if the piece may OCCLUDE the player (walls, columns, roofs, arches): those fragments are
//       dithered out in a soft cylinder between the player and the camera.
render_mode cull_back, depth_draw_opaque;

global uniform vec3 player_pos;
global uniform vec3 cam_back;
global uniform float awaken;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 cream : source_color = vec3(0.80, 0.79, 0.76);
uniform vec3 vein : source_color = vec3(0.40, 0.40, 0.40);
uniform vec3 side_col : source_color = vec3(0.36, 0.355, 0.35);
uniform vec3 black_base : source_color = vec3(0.07, 0.07, 0.078);
uniform vec3 black_vein : source_color = vec3(0.55, 0.56, 0.58);
uniform vec3 char_col : source_color = vec3(0.13, 0.13, 0.14);
uniform float occlusion = 1.0;
uniform float fade_y = -99.0;      // optional: dissolve everything below this height (rising bridges)

varying vec3 wp;
varying vec3 wn;
varying float rnd;
varying float mat_id;
varying float occ;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	rnd = COLOR.r;
	mat_id = COLOR.g;
	occ = COLOR.b;
}

float marble(vec3 p, float scale, float sharp) {
	float n = texture(noise_tex, p.xz * 0.11 + p.y * 0.07).r;
	float n2 = texture(noise_tex, p.zx * 0.31 + vec2(0.37, p.y * 0.2)).r;
	float v = sin((p.x * 0.9 + p.z * 0.55 + p.y * 0.7) * scale + n * 11.0 + n2 * 3.0);
	return 1.0 - smoothstep(0.0, sharp, abs(v));
}

float bayer4(vec2 fc) {
	ivec2 p = ivec2(mod(fc, 4.0));
	int i = p.x + p.y * 4;
	float m[16] = float[](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
	return (m[i] + 0.5) / 16.0;
}

void fragment() {
	// --- occluder cut-away: soft dithered cylinder from the player toward the camera
	if (occ > 0.5 && occlusion > 0.0) {
		vec3 c = player_pos + vec3(0.0, 0.65, 0.0);
		vec3 v = wp - c;
		float along = dot(v, cam_back);
		float perp = length(v - cam_back * along);
		float f = smoothstep(0.3, 1.2, along) * (1.0 - smoothstep(0.8, 1.6, perp)) * occlusion;
		if (f > 0.0 && bayer4(FRAGCOORD.xy) < f * 0.92) discard;
	}
	float n = texture(noise_tex, wp.xz * 0.23 + wp.y * 0.13).r;
	vec3 col;
	float rough = 0.6;
	float spec = 0.45;
	if (mat_id < 0.12) {
		// cream floor: large slabs (1.5 m, running bond) in world space, per-slab tint, soft worn joints
		vec2 g = wp.xz / 1.5;
		g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5;
		vec2 cell = floor(g);
		vec2 f = fract(g);
		float tr = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
		float v = marble(wp + tr * 7.0, 2.2, 0.10) * 0.8 + marble(wp * 2.7 + 3.1, 2.0, 0.05) * 0.35;
		vec3 tint = cream * (0.92 + 0.10 * tr) * vec3(1.0 + (tr - 0.5) * 0.03, 1.0, 1.0 - (tr - 0.5) * 0.05);
		col = mix(tint * (0.93 + 0.12 * n), vein, clamp(v, 0.0, 1.0) * 0.42);
		vec2 e = min(f, 1.0 - f) * 1.5;
		float ed = min(e.x, e.y);
		float aa = fwidth(wp.x) * 1.2;
		float grout = 1.0 - smoothstep(0.006, 0.006 + aa, ed);
		col *= mix(0.90, 1.0, smoothstep(0.0, 0.10, ed));
		col = mix(col, vec3(0.42, 0.42, 0.41), grout * 0.55);
		// sparse cracks and stains
		float ck = texture(noise_tex, wp.xz * 0.21 + 0.5).r;
		float crack = (1.0 - smoothstep(0.0, 0.010, abs(ck - 0.5))) * step(0.62, tr);
		col = mix(col, vec3(0.30), crack * 0.55);
		float stain = smoothstep(0.55, 0.8, texture(noise_tex, wp.xz * 0.05 + 0.2).r);
		col *= 1.0 - stain * 0.10;
		float side = 1.0 - smoothstep(0.55, 0.85, wn.y);
		col = mix(col, side_col * (0.85 + 0.3 * n), side * 0.65);
		rough = 0.32 + n * 0.2;
	} else if (mat_id < 0.37) {
		vec3 p = wp + rnd * 11.0;
		float v = marble(p, 2.4, 0.09) * 0.8 + marble(p * 2.3 + 1.7, 2.0, 0.05) * 0.3;
		col = mix(cream * (0.88 + 0.12 * rnd) * (0.92 + 0.12 * n), vein, clamp(v, 0.0, 1.0) * 0.45);
		// weathering: darker toward the ground and in crevices
		col *= mix(0.78, 1.0, smoothstep(-0.2, 1.2, wn.y + 0.6));
		rough = 0.45;
	} else if (mat_id < 0.62) {
		float depth = clamp((1.5 - wp.y) / 6.0, 0.0, 1.0);
		float strata = 0.88 + 0.12 * sin(wp.y * 19.0 + n * 6.0);
		col = side_col * (0.72 + 0.42 * n) * strata * mix(1.0, 0.55, depth);
		rough = 0.95;
		spec = 0.2;
	} else if (mat_id < 0.87) {
		vec2 g = wp.xz * 0.5;
		vec2 f = fract(g);
		vec2 cell = floor(g);
		float tr = fract(sin(dot(cell, vec2(41.3, 17.7))) * 9431.7);
		float v = marble(wp * 1.3 + tr * 5.0, 2.6, 0.05);
		col = mix(black_base * (0.9 + 0.3 * n), black_vein, v * 0.38);
		vec2 e = min(f, 1.0 - f);
		float aa = fwidth(g.x) * 1.5;
		float seam = 1.0 - smoothstep(0.006, 0.006 + aa, min(e.x, e.y));
		col = mix(col, vec3(0.32, 0.33, 0.35), seam * 0.5);
		float side = 1.0 - smoothstep(0.55, 0.85, wn.y);
		col = mix(col, side_col * 0.6, side * 0.7);
		rough = mix(0.06, 0.5, side);
		spec = 0.9;
	} else {
		col = char_col * (0.8 + 0.4 * n) * (0.9 + 0.2 * rnd);
		rough = 0.8;
		spec = 0.3;
	}
	if (wp.y < fade_y) discard;
	ALBEDO = col;
	ROUGHNESS = rough;
	SPECULAR = spec;
}
