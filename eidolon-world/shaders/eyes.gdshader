shader_type spatial;
// v0.9.2 the shadow chamber's eyes: one small glowing crimson point (a camera-facing quad): an intense core,
// a soft halo (alpha-blended: it must read on white marble). `k` its strength, `pulse` a slow breath (the hint), `worn` 1 when a shadow's head wears it.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float k = 1.0;
uniform float pulse = 0.0;
uniform float worn = 0.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0, 0, 0), vec4(0, length(MODEL_MATRIX[1].xyz), 0, 0), vec4(0, 0, length(MODEL_MATRIX[2].xyz), 0), vec4(0, 0, 0, 1));
}
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	// (the quad is large (~0.3 m) for a 2 cm core: the halo is what makes a pair of eyes read from afar)
	float core = 1.0 - smoothstep(0.05, 0.11, r);
	float halo = exp(-r * 2.6) * 0.75 * (1.0 - smoothstep(0.7, 1.0, r));
	float br = k * (1.0 + 0.35 * worn) * (1.0 + pulse * 0.35 * sin(TIME * 3.0));
	// (mixed, not added: on the pale marble an added red is lost in the white)
	vec3 hot = mix(vec3(1.0, 0.12, 0.16), vec3(1.0, 0.55, 0.5), core * core);
	ALBEDO = mix(accent.rgb * 0.95, hot, core);
	ALPHA = clamp((core + halo * 1.3) * br, 0.0, 1.0);
}
