shader_type spatial;
// v0.9.3 the shadow chamber's eyes: ONE eye (a pair is two quads, 15 cm apart along the view's right): a
// camera-facing almond, ~5 x 2.5 cm, a near-white-crimson core in a soft crimson halo that stays tight, so
// that from the fixed view (7.5 m across a phone) a pair reads as two eyes, not one red dot. It breathes
// slowly and now and then blinks (`phase` sets a pair's own rhythm). `k` its strength, `pulse` the hint's
// stronger breath, `worn` 1 when a shadow's head wears it. Alpha-blended: on white marble an added red is lost.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
uniform float k = 1.0;
uniform float pulse = 0.0;
uniform float worn = 0.0;
uniform float phase = 0.0;
uniform float qsize = 0.24;                 // the quad's size in metres (it is drawn unscaled)
uniform vec2 eye = vec2(0.058, 0.03);       // the almond's length and height (m)
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0, 0, 0), vec4(0, length(MODEL_MATRIX[1].xyz), 0, 0), vec4(0, 0, length(MODEL_MATRIX[2].xyz), 0), vec4(0, 0, 0, 1));
}
void fragment() {
	vec2 p = (UV - 0.5) * qsize;
	// a blink: every ~5.3 s the lids close for a fifth of a second
	float bt = fract((TIME + phase * 1.9) / 5.3);
	float lid = 1.0 - 0.92 * smoothstep(0.0, 0.02, bt) * (1.0 - smoothstep(0.02, 0.04, bt));
	float hx = eye.x * 0.5;
	float hy = eye.y * 0.5 * lid;
	float a = abs(p.x) / hx;
	float w = hy * pow(max(1.0 - a * a, 0.0), 0.7) + 1e-4;     // the almond: full in the middle, pointed at the ends
	float m = max(a, abs(p.y) / w);
	float core = 1.0 - smoothstep(0.65, 1.0, m);
	float centre = 1.0 - smoothstep(0.0, 0.7, length(p / vec2(hx, max(hy, 1e-4))));
	float hd = length(vec2(p.x / hx, p.y / (eye.y * 0.8)));
	float halo = exp(-max(hd - 0.7, 0.0) * 2.6) * 0.7 * (1.0 - smoothstep(0.8, 1.0, length(UV - 0.5) * 2.0));
	float br = k * (1.0 + 0.3 * worn) * (1.0 + (0.08 + 0.3 * pulse) * sin(TIME * (1.1 + 1.8 * pulse) + phase));
	vec3 hot = mix(vec3(1.0, 0.22, 0.28), vec3(1.0, 0.86, 0.84), centre);
	vec3 crim = vec3(0.86, 0.05, 0.14);
	ALBEDO = mix(crim, hot, core);
	ALPHA = clamp(max(core, halo) * br, 0.0, 1.0);
}
