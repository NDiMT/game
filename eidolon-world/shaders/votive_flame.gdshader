shader_type spatial;
// v0.7 a votive flame: teal / petrol, a white-cyan core, flickering. A camera-facing quad (its bottom at
// the wick). `intensity` 0 = out; `gutter` 0..1 shrinks it, sputtering, to nothing.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float intensity = 0.0;
uniform float gutter = 0.0;
uniform float seed = 0.0;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;

void vertex() {
	// billboard round the vertical axis only (a flame stands up)
	vec3 cx = normalize(vec3(INV_VIEW_MATRIX[0].x, 0.0, INV_VIEW_MATRIX[0].z));
	vec3 up = vec3(0.0, 1.0, 0.0);
	vec3 wp = MODEL_MATRIX[3].xyz + cx * VERTEX.x + up * VERTEX.y;
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(wp, 1.0);
}

void fragment() {
	float t = TIME * 1.0 + seed * 7.3;
	vec2 uv = vec2(UV.x - 0.5, 1.0 - UV.y);            // x across, y up from the wick (0..1)
	float n1 = texture(noise_tex, vec2(uv.x * 0.6 + seed, uv.y * 0.5 - t * 0.9)).r;
	float n2 = texture(noise_tex, vec2(uv.x * 1.3 - seed, uv.y * 1.1 - t * 1.7)).r;
	float flick = 0.86 + 0.14 * sin(t * 13.0 + sin(t * 7.1) * 2.0) * (0.6 + 0.4 * n2);
	float h = flick * (1.0 - gutter * 0.85);
	float y = uv.y / max(h, 0.05);
	// sway: the tip leans with the noise
	float sway = (n1 - 0.5) * 0.22 * y * y;
	float x = uv.x - sway;
	// a teardrop: wide near the base, a point at the top
	float wdt = 0.24 * sqrt(max(y, 0.0)) * (1.0 - y) * 1.9 * (1.0 - gutter * 0.4);
	float body = 1.0 - smoothstep(wdt * 0.55, wdt + 0.02, abs(x));
	body *= smoothstep(0.0, 0.06, uv.y) * (1.0 - smoothstep(0.82, 1.0, y));
	float core = 1.0 - smoothstep(wdt * 0.1, wdt * 0.5, abs(x));
	core *= smoothstep(0.02, 0.1, uv.y) * (1.0 - smoothstep(0.2, 0.55, y));
	// the blue root at the wick
	float root = (1.0 - smoothstep(0.0, 0.14, uv.y)) * (1.0 - smoothstep(0.0, 0.12, abs(x)));
	float halo = exp(-length(vec2(x * 1.6, (uv.y - 0.28) * 1.1)) * 6.0) * 0.35;
	vec3 petrol = vec3(0.10, 0.42, 0.46);
	// (mixed, not added: a teal flame must read as teal against pale marble and fog)
	vec3 col = mix(petrol, accent.rgb * 1.05, clamp(body * 1.2, 0.0, 1.0));
	col = mix(col, accent_core.rgb * 1.15, core);
	col = mix(col, vec3(0.2, 0.45, 0.75), root * 0.5);
	ALBEDO = col;
	ALPHA = clamp(max(body * 0.95, halo * 1.2) + core, 0.0, 1.0) * clamp(intensity, 0.0, 1.0);
}
