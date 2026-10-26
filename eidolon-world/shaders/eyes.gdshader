shader_type spatial;
// v0.9.2 the shadow chamber's eyes: one small glowing crimson point (a camera-facing quad): an intense core,
// a soft halo. `k` its strength, `pulse` a slow breath (the hint), `worn` 1 when a shadow's head wears it.
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
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
	float core = 1.0 - smoothstep(0.05, 0.22, r);
	float halo = exp(-r * 4.5) * 0.55 * (1.0 - smoothstep(0.7, 1.0, r));
	float br = k * (1.0 + 0.35 * worn) * (1.0 + pulse * 0.35 * sin(TIME * 3.0));
	ALBEDO = (mix(accent.rgb, accent_core.rgb * 1.8, core) * core + accent.rgb * halo) * br;
}
