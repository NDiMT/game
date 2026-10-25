shader_type spatial;
// v0.7 "The Pool of Halves": the still pool reflects the stone beams of the broken path: yours, and the
// ones that exist only on HER side (seen only here, in the water, until the path is whole). Each water
// fragment traces its reflected view ray up out of the water against the beams' arms (boxes from the
// waterline to the top); a hit shows the beam's flank upside down, a bright line at its top edge, and a
// glowing seam at every connector end, so a reflected path reads at a glance.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 her;
global uniform vec4 her_core;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec4 arm_box[40];           // x0, z0, x1, z1
uniform vec4 arm_info[40];          // end direction x, z (the connector face), hers (1) / yours (0), lit
uniform int count = 0;
uniform float water_y = -0.42;
uniform float top_y = 0.0;
uniform float pulse = 0.0;          // hint: the connectors shine
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

float box_hit(vec3 o, vec3 d, vec3 bmin, vec3 bmax) {
	vec3 inv = 1.0 / d;
	vec3 t0 = (bmin - o) * inv;
	vec3 t1 = (bmax - o) * inv;
	vec3 lo = min(t0, t1);
	vec3 hi = max(t0, t1);
	float tn = max(max(lo.x, lo.y), lo.z);
	float tf = min(min(hi.x, hi.y), hi.z);
	return (tf >= max(tn, 0.0)) ? max(tn, 0.0) : -1.0;
}

void fragment() {
	vec3 vd = normalize(-(INV_VIEW_MATRIX * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
	vec3 rd = vec3(vd.x, -vd.y, vd.z);
	// the faintest stir of the water (the reflection stays readable)
	float n1 = texture(noise_tex, wp.xz * 0.9 + TIME * vec2(0.03, 0.02)).r - 0.5;
	float n2 = texture(noise_tex, wp.xz * 1.7 - TIME * vec2(0.02, 0.03)).r - 0.5;
	vec3 o = vec3(wp.x + n1 * 0.03, water_y + 0.001, wp.z + n2 * 0.03);
	float best = 1e9;
	int bi = -1;
	vec3 hp = vec3(0.0);
	for (int i = 0; i < 40; i++) {
		if (i >= count) break;
		vec4 b = arm_box[i];
		float t = box_hit(o, rd, vec3(b.x, water_y, b.y), vec3(b.z, top_y, b.w));
		if (t >= 0.0 && t < best) { best = t; bi = i; hp = o + rd * t; }
	}
	if (bi < 0) discard;
	vec4 b = arm_box[bi];
	vec4 inf = arm_info[bi];
	float up = clamp((hp.y - water_y) / (top_y - water_y), 0.0, 1.0);
	float st = texture(noise_tex, vec2(hp.x + hp.z, hp.y) * vec2(1.3, 6.0)).r;
	vec3 c = mix(vec3(0.13, 0.15, 0.17), vec3(0.44, 0.46, 0.47), up * up) * (0.9 + 0.2 * st);
	// v0.8: hers glow rose in the water (her side of the glass); yours are plain carved stone
	c = mix(c, mix(c, vec3(0.62, 0.55, 0.6), 0.55) + her.rgb * 0.12, inf.z);
	float edge = smoothstep(0.66, 0.95, up);
	c = mix(c, mix(her.rgb, her_core.rgb, 0.55), edge * 0.75 * inf.z);
	c = mix(c, vec3(0.62, 0.62, 0.6), edge * 0.35 * (1.0 - inf.z));
	// the joint seam at the arm's end: lit only when the stone across answers (rose for hers, aqua yours)
	vec2 ed = inf.xy;
	float endc = ed.x > 0.5 ? b.z : (ed.x < -0.5 ? b.x : (ed.y > 0.5 ? b.w : b.y));
	float along = abs(ed.x) > 0.5 ? hp.x : hp.z;
	float seam = 1.0 - smoothstep(0.0, 0.07, abs(along - endc));
	vec3 sc = mix(accent_core.rgb, her_core.rgb, inf.z);
	c = mix(c, sc * 1.3, seam * (0.15 + 0.85 * inf.w) * (0.8 + 0.2 * pulse * (0.5 + 0.5 * sin(TIME * 4.0))));
	ALBEDO = c;
	ALPHA = 0.9 + 0.1 * edge;

}
