shader_type spatial;
// World marble for all merged static geometry. Vertex COLOR packs:
//   r = per-piece random (tint variance)
//   g = material: 0.00 cream floor (1 m tile grid + grout), 0.25 cream carved marble (walls, columns,
//       statues), 0.50 rough island stone (cliffs under the slabs), 0.75 black polished marble floor,
//       1.00 charcoal (dead wood, iron, bronze)
//   a = 1 on boxes: their BoxMesh face UVs give worn, bevelled edges (fake chamfer)
//   b = 1 if the piece may OCCLUDE the player (walls, columns, roofs, arches): those fragments are
//       dithered out in a soft cylinder between the player and the camera.
render_mode cull_back, depth_draw_opaque;

global uniform vec3 player_pos;
global uniform vec3 cam_back;
global uniform float awaken;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 cream : source_color = vec3(0.745, 0.735, 0.705);
uniform vec3 vein : source_color = vec3(0.34, 0.345, 0.36);
uniform vec3 side_col : source_color = vec3(0.36, 0.355, 0.35);
uniform vec3 black_base : source_color = vec3(0.07, 0.07, 0.078);
uniform vec3 black_vein : source_color = vec3(0.55, 0.56, 0.58);
uniform vec3 char_col : source_color = vec3(0.13, 0.13, 0.14);
uniform float occlusion = 1.0;
uniform float dbg_cheap = 0.0;
uniform float fade_y = -99.0;
uniform vec4 moss_rect = vec4(6.8, -15.4, 17.2, -4.8);     // the Garden of the Veiled (x0, z0, x1, z1)      // optional: dissolve everything below this height (rising bridges)

varying vec3 wp;
varying vec3 wn;
varying float rnd;
varying float mat_id;
varying float occ;
varying float boxy;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	rnd = COLOR.r;
	mat_id = COLOR.g;
	occ = COLOR.b;
	boxy = COLOR.a;
}

float marble(vec3 p, float scale, float sharp) {
	float n = texture(noise_tex, p.xz * 0.11 + p.y * 0.07).r;
	float n2 = texture(noise_tex, p.zx * 0.31 + vec2(0.37, p.y * 0.2)).r;
	float v = sin((p.x * 0.9 + p.z * 0.55 + p.y * 0.7) * scale + n * 11.0 + n2 * 3.0);
	return 1.0 - smoothstep(0.0, sharp, abs(v));
}

// 4x4 ordered dither, arithmetic (no local array: cheaper on mobile GPUs)
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 fc) { return bayer2(0.5 * fc) * 0.25 + bayer2(fc) + 0.5 / 16.0; }

void fragment() {
	// --- occluder cut-away: soft dithered cylinder from the player toward the camera
	if (occ > 0.5 && occlusion > 0.0) {
		vec3 c = player_pos + vec3(0.0, 0.65, 0.0);
		vec3 v = wp - c;
		float along = dot(v, cam_back);
		float perp = length(v - cam_back * along);
		// a fully clear window round the wanderer, dithered only at its rim (never dots over them)
		float f = smoothstep(0.1, 0.8, along) * (1.0 - smoothstep(1.05, 1.9, perp)) * occlusion;
		if (f > 0.96 || (f > 0.0 && bayer4(FRAGCOORD.xy) < f)) discard;
	}
	float n = texture(noise_tex, wp.xz * 0.23 + wp.y * 0.13).r;
	if (dbg_cheap > 0.5) { ALBEDO = cream * (0.9 + 0.1 * n); ROUGHNESS = 0.6; SPECULAR = 0.4; } else {
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
		// polished: soft reflections of the pale sky drift across the floor
		float streak = smoothstep(0.55, 1.0, sin((wp.x + wp.z) * 0.55 + n * 3.0)) * (1.0 - side);
		col += vec3(0.07, 0.075, 0.085) * streak + vec3(0.025, 0.03, 0.035);
		rough = mix(0.06, 0.5, side);
		spec = 0.9;
	} else {
		col = char_col * (0.8 + 0.4 * n) * (0.9 + 0.2 * rnd);
		rough = 0.8;
		spec = 0.3;
	}
	// worn, chamfered edges on blocks: a pale bevel catching the light, a soft shadow just inside
	if (boxy > 0.5 && mat_id < 0.87) {
		vec2 fuv = fract(UV * vec2(3.0, 2.0));
		float mpu = length(fwidth(wp)) / max(length(fwidth(fuv)), 1e-5);
		vec2 em = min(fuv, 1.0 - fuv) * mpu;
		float ed = min(em.x, em.y);
		float chip = texture(noise_tex, wp.xz * 1.9 + wp.y * 1.3).r;
		float bevel = 1.0 - smoothstep(0.012, 0.05 + chip * 0.03, ed);
		float inner = smoothstep(0.03, 0.06, ed) * (1.0 - smoothstep(0.06, 0.13, ed));
		col = mix(col, col * 1.18 + vec3(0.03, 0.025, 0.015), bevel * (0.55 + 0.45 * max(wn.y, 0.0)));
		col *= 1.0 - inner * 0.06;
	}
	// moss and lichen in the garden: on upward faces near the ground and in sheltered corners
	if (wp.x > moss_rect.x && wp.x < moss_rect.z && wp.z > moss_rect.y && wp.z < moss_rect.w && mat_id < 0.62) {
		float mn = texture(noise_tex, wp.xz * 0.35 + 3.7).r * 0.7 + texture(noise_tex, wp.xz * 1.7 + wp.y).r * 0.3;
		float low = 1.0 - smoothstep(1.0, 2.2, wp.y);
		float moss = smoothstep(0.60, 0.74, mn) * low * (0.3 + 0.7 * max(wn.y, 0.0));
		col = mix(col, vec3(0.52, 0.55, 0.45) * (0.88 + 0.24 * n), moss * 0.5);
		float li = step(0.86, texture(noise_tex, wp.xz * 6.0 + wp.yy * 5.0).r) * (1.0 - abs(wn.y));
		col = mix(col, vec3(0.76, 0.74, 0.62), li * 0.35);
	}
	// each space has its own stone: cooler in the Hall of Glass, warmer in the Court, golden at the Shrine
	float hall = (1.0 - smoothstep(0.0, 1.5, max(max(-5.5 - wp.x, wp.x - 5.5), max(-21.5 - wp.z, wp.z + 10.5))));
	float court = (1.0 - smoothstep(0.0, 2.0, max(max(6.5 - wp.x, wp.x - 17.5), max(-27.5 - wp.z, wp.z + 16.5))));
	float shrine = (1.0 - smoothstep(0.0, 2.0, max(max(19.5 - wp.x, wp.x - 30.5), max(-40.0 - wp.z, wp.z + 27.5))));
	col *= mix(vec3(1.0), vec3(0.95, 0.985, 1.05), hall);
	col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.92), court);
	col *= mix(vec3(1.0), vec3(1.04, 1.01, 0.94), shrine);
	// a hint of warmth in the pale stone (light seems to sink into the marble)
	if (mat_id < 0.37) col += vec3(0.022, 0.012, 0.0) * smoothstep(0.4, 0.9, dot(col, vec3(0.33)));
	if (wp.y < fade_y) discard;
	ALBEDO = col;
	ROUGHNESS = rough;
	SPECULAR = spec;
	}
}
