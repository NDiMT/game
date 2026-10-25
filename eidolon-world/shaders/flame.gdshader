shader_type spatial;
// v0.8.1: a real-looking flame (a layered, noise-driven fire). Camera-facing about the vertical; two
// layers (the body with its licking tongues, and the hot inner core) give it depth. Additive, soft edges.
// (v0.8.3: every flame burns in the game's aqua: a near-white heart, a pale aqua core, the aqua body,
// teal tongues; `style` is kept for compatibility.) `intensity` 0 = out, `gutter`
// 0..1 shrinks it sputtering to nothing.
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float intensity = 0.0;
uniform float gutter = 0.0;
uniform float seed = 0.0;
uniform float style = 0.0;
uniform float core_layer = 0.0;     // 1 on the inner core layer

void vertex() {
	vec3 cx = normalize(vec3(INV_VIEW_MATRIX[0].x, 0.0, INV_VIEW_MATRIX[0].z));
	vec3 wp = MODEL_MATRIX[3].xyz + cx * VERTEX.x * length(MODEL_MATRIX[0].xyz) + vec3(0.0, 1.0, 0.0) * VERTEX.y * length(MODEL_MATRIX[1].xyz);
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(wp, 1.0);
}

void fragment() {
	float t = TIME + seed * 13.1;
	vec2 uv = vec2(UV.x - 0.5, 1.0 - UV.y);                 // x across, y up from the wick
	// turbulence: two octaves of noise rising through the flame, bending it and tearing its tongues
	float n1 = texture(noise_tex, vec2(uv.x * 1.1 + seed, uv.y * 0.9 - t * 1.3)).r;
	float n2 = texture(noise_tex, vec2(uv.x * 2.7 - seed, uv.y * 2.2 - t * 2.4)).r;
	float n3 = texture(noise_tex, vec2(uv.x * 5.0 + seed * 2.0, uv.y * 4.0 - t * 3.6)).r;
	float flick = 0.88 + 0.12 * sin(t * 11.0 + sin(t * 5.3) * 2.0) * (0.5 + n2);
	float h = flick * (1.0 - gutter * 0.85) * mix(1.0, 0.62, core_layer);
	float y = uv.y / max(h, 0.05);
	float x = uv.x + (n1 - 0.5) * 0.30 * y + (n2 - 0.5) * 0.10 * y * y;
	// the body: a teardrop, its upper half torn into tongues by the noise
	float w = 0.30 * pow(max(y, 0.0), 0.45) * (1.0 - y) * 1.75 * mix(1.0, 0.55, core_layer);
	float shape = w - abs(x);
	shape -= (n3 - 0.45) * 0.10 * smoothstep(0.25, 0.9, y);
	float body = smoothstep(-0.03, 0.06, shape) * smoothstep(0.0, 0.05, uv.y) * (1.0 - smoothstep(0.75, 1.0, y));
	float heat = clamp(shape / max(w, 0.02), 0.0, 1.0) * (1.0 - y * 0.85);   // hotter inside and low
	// (v0.8.3, the owner: OUR fire is aqua) colour by heat: a deep teal at the torn edges, the aqua body,
	// the pale aqua core, a near-white heart
	vec3 c = mix(accent_tint.rgb * 0.75, accent.rgb, smoothstep(0.0, 0.35, heat));
	c = mix(c, accent_core.rgb, smoothstep(0.3, 0.7, heat));
	c = mix(c, vec3(0.93, 1.0, 0.98), smoothstep(0.65, 0.95, heat));
	// a deeper blue root at the wick
	float root = (1.0 - smoothstep(0.0, 0.12, uv.y)) * (1.0 - smoothstep(0.0, 0.1, abs(x)));
	c = mix(c, vec3(0.2, 0.5, 0.95), root * 0.4);
	// a soft glow round the flame (no hard edge)
	float glow = exp(-length(vec2(x * 1.4, (uv.y - 0.3 * h) * 1.1)) * 5.5) * 0.25 * (1.0 - core_layer);
	vec3 gcol = accent.rgb;
	ALBEDO = (c * body * mix(0.85, 1.3, core_layer) + gcol * glow) * intensity * flick;
}
