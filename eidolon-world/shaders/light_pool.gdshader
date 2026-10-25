shader_type spatial;
// v0.7 a small pool of lamp light on the floor (additive, soft)
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
uniform float intensity = 0.0;
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float g = pow(1.0 - clamp(r, 0.0, 1.0), 2.2);
	float flick = 0.9 + 0.1 * sin(TIME * 11.0) * sin(TIME * 4.3);
	ALBEDO = accent.rgb * g * intensity * flick * 0.55;
}
