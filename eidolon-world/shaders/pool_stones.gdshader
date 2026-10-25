shader_type spatial;
// v0.6 "Trust the Water": the still pool reflects the stepping stones, but only the REAL ones. Each
// water fragment traces its reflected view ray up out of the water against the real stones' blocks
// (stones[]: x, z, half size, 1 = real); a hit shows the stone's reflected flank, a thin bright line
// where its top edge meets the reflection. Ripples break the reflection up; only still water near you
// (calm_c, calm_r) shows it. Illusions are never reflected: the reflection tells the truth.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec4 stones[14];
uniform int count = 0;
uniform float water_y = -0.3;
uniform float top_y = 0.0;
uniform vec2 calm_c = vec2(0.0);
uniform float calm_r = 0.0;
uniform float calm = 0.0;
uniform float glint = 0.0;          // hint: the reflections shine a little more
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

// entry distance of a ray into an axis-aligned box (or -1)
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
	vec3 vd = normalize(-(INV_VIEW_MATRIX * vec4(0.0, 0.0, 1.0, 0.0)).xyz);   // the camera looks along this
	vec3 rd = vec3(vd.x, -vd.y, vd.z);                                          // ...and the water bounces it up
	float k = calm * (1.0 - smoothstep(calm_r - 0.9, calm_r, length(wp.xz - calm_c)));
	// ripples bend the reflected ray (still water: none)
	float n1 = texture(noise_tex, wp.xz * 0.9 + TIME * vec2(0.05, 0.03)).r - 0.5;
	float n2 = texture(noise_tex, wp.xz * 1.7 - TIME * vec2(0.04, 0.06)).r - 0.5;
	vec3 o = vec3(wp.x + n1 * (1.0 - k) * 0.5, water_y + 0.001, wp.z + n2 * (1.0 - k) * 0.5);
	float best = 1e9;
	float hy = 0.0;
	for (int i = 0; i < 14; i++) {
		if (i >= count) break;
		vec4 s = stones[i];
		if (s.w < 0.5) continue;
		float t = box_hit(o, rd, vec3(s.x - s.z, water_y, s.y - s.z), vec3(s.x + s.z, top_y, s.y + s.z));
		if (t >= 0.0 && t < best) { best = t; hy = o.y + rd.y * t; }
	}
	if (best > 1e8 || k < 0.01) discard;
	float up = clamp((hy - water_y) / (top_y - water_y), 0.0, 1.0);     // 0 at the waterline, 1 at the top edge
	// the stone's flank, upside down: darker at the waterline, lighter toward its (mirrored) top edge,
	// a few chisel streaks, and a bright petrol line where the top edge meets the reflection
	float st = texture(noise_tex, vec2(o.x + o.z, hy) * vec2(1.3, 6.0)).r;
	vec3 c = mix(vec3(0.13, 0.15, 0.17), vec3(0.42, 0.44, 0.45), up * up) * (0.9 + 0.2 * st);
	float edge = smoothstep(0.66, 0.95, up);
	c = mix(c, mix(accent.rgb, accent_core.rgb, 0.6), edge * (0.7 + 0.3 * glint));
	ALBEDO = c;
	ALPHA = k * (0.88 + 0.12 * edge);
}
