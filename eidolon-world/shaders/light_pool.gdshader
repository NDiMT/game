shader_type spatial;
// v0.8.1: a soft pool of aqua light thrown on the stone by a glowing glyph (additive, no lighting)
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
uniform float k = 1.0;
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float f = pow(clamp(1.0 - r, 0.0, 1.0), 2.2);
	ALBEDO = accent.rgb * f * k * 0.22;
}
