shader_type spatial;
// v0.8.1: the interaction highlight where the target is part of the merged stone (a glass, a carved
// inscription): a soft aqua ring of light on the floor before it, with the same fade and slow pulse
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float k = 0.0;
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float ring = exp(-pow((r - 0.72) / 0.14, 2.0));
	float fill = (1.0 - smoothstep(0.0, 0.8, r)) * 0.12;
	float pulse = 0.82 + 0.18 * sin(TIME * 2.4);
	ALBEDO = mix(accent.rgb, accent_core.rgb, ring) * (ring * 0.45 + fill) * k * pulse;
}
