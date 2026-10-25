shader_type spatial;
// v0.8.1: the interaction highlight: a soft aqua fresnel rim laid over the target's own surfaces
// (material_overlay: same geometry, depth-tested, so nothing glows through a wall), fading in and out
// over ~0.15 s with a gentle slow pulse. Never a hard outline.
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float k = 0.0;
void fragment() {
	float rim = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), 2.2);
	float pulse = 0.82 + 0.18 * sin(TIME * 2.4);
	ALBEDO = mix(accent.rgb, accent_core.rgb, rim) * (0.08 + rim * 0.75) * k * pulse;
}
