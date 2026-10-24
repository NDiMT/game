shader_type spatial;
// Island: merged tiles + columns. COLOR.r = per-tile random (rise/dissolve delay), COLOR.g = material
// (0 cream marble top, 0.5 weathered side stone, 1 black marble). UV = tile-top coords for grout.
render_mode cull_back, depth_draw_opaque;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float rise : hint_range(0.0, 1.0) = 1.0;
uniform float dissolve : hint_range(0.0, 1.0) = 0.0;
uniform vec3 cream : source_color = vec3(0.86, 0.835, 0.78);
uniform vec3 cream_vein : source_color = vec3(0.42, 0.41, 0.40);
uniform vec3 black_base : source_color = vec3(0.06, 0.06, 0.065);
uniform vec3 black_vein : source_color = vec3(0.62, 0.58, 0.52);
uniform vec3 side_col : source_color = vec3(0.34, 0.335, 0.33);

varying vec3 wp;
varying float mat_id;
varying float rnd;
varying float dis;
varying float crack;
varying vec3 wn;

void vertex() {
	wp = VERTEX;
	rnd = COLOR.r;
	mat_id = COLOR.g;
	crack = COLOR.b;
	wn = NORMAL;
	float delay = rnd * 0.45;
	float r = clamp((rise - delay) / 0.55, 0.0, 1.0);
	r = 1.0 - pow(1.0 - r, 3.0);
	float d = clamp((dissolve - delay) / 0.55, 0.0, 1.0);
	dis = d;
	VERTEX.y -= (1.0 - r) * 16.0 + d * d * 5.0;
}

float marble(vec3 p, float scale, float sharp) {
	float n = texture(noise_tex, p.xz * 0.11 + p.y * 0.07).r;
	float n2 = texture(noise_tex, p.zx * 0.31 + vec2(0.37, p.y * 0.2)).r;
	float v = sin((p.x * 0.9 + p.z * 0.55 + p.y * 0.7) * scale + n * 11.0 + n2 * 3.0);
	return 1.0 - smoothstep(0.0, sharp, abs(v));
}

void fragment() {
	float n = texture(noise_tex, wp.xz * 0.23 + wp.y * 0.13).r;
	if (dis > 0.0 && texture(noise_tex, wp.xz * 0.9 + vec2(wp.y * 0.3)).r < dis * 1.15) discard;
	vec3 col;
	float rough;
	if (mat_id < 0.25) {
		// polished cream marble slab: veins, per-tile tint, chamfered + worn edges, optional crack
		float v = marble(wp + rnd * 7.0, 2.2, 0.10) * 0.8 + marble(wp * 2.7 + 3.1, 2.0, 0.05) * 0.35;
		float fine = marble(wp * 6.0 + rnd * 3.0, 3.0, 0.03) * 0.25;
		vec3 tint = cream * vec3(1.0 + (rnd - 0.5) * 0.05, 1.0, 1.0 - (rnd - 0.5) * 0.07) * (0.95 + 0.08 * rnd);
		col = mix(tint * (0.94 + 0.10 * n), cream_vein, clamp(v + fine, 0.0, 1.0) * 0.5);
		vec2 e = min(UV, 1.0 - UV);
		float ed = min(e.x, e.y);
		float wear = texture(noise_tex, wp.xz * 1.7 + rnd).r;
		col *= mix(0.80, 1.0, smoothstep(0.0, 0.07 + wear * 0.05, ed));   // worn rim
		float chamfer = 1.0 - smoothstep(0.80, 0.98, wn.y);
		col *= 1.0 - chamfer * 0.12;
		if (crack > 0.5) {
			vec2 c2 = UV - 0.5;
			float an = rnd * 6.283;
			vec2 dir = vec2(cos(an), sin(an));
			float jag = (texture(noise_tex, UV * 0.9 + rnd * 5.0).r - 0.5) * 0.22;
			float cl = abs(dot(c2, vec2(-dir.y, dir.x)) + jag);
			float along = abs(dot(c2, dir));
			float crk = (1.0 - smoothstep(0.004, 0.012, cl)) * step(along, 0.42 + rnd * 0.1);
			col = mix(col, vec3(0.22, 0.21, 0.2), crk * 0.85);
		}
		rough = 0.28 + n * 0.2 + chamfer * 0.2;
	} else if (mat_id < 0.42) {
		col = vec3(0.10, 0.10, 0.105) * (0.8 + 0.4 * n);   // grout
		rough = 1.0;
	} else if (mat_id < 0.75) {
		float depth = clamp(-wp.y / 2.5, 0.0, 1.0);
		float strata = 0.9 + 0.1 * sin(wp.y * 23.0 + n * 6.0);
		col = side_col * (0.75 + 0.4 * n) * strata * mix(1.0, 0.45, depth);
		rough = 0.9;
	} else {
		float v = marble(wp * 1.3, 2.6, 0.06);
		col = mix(black_base * (0.9 + 0.3 * n), black_vein, v * 0.42);
		rough = 0.28;
	}
	ALBEDO = col;
	ROUGHNESS = rough;
	SPECULAR = 0.45;
}
