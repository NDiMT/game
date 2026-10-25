shader_type spatial;
// v0.8: a ripple ring spreading on still water (t 0..1: it grows and fades), soft and pale with an aqua lip
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent_core;
uniform float t = 0.0;
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float rr = mix(0.08, 0.95, t);
	float w = mix(0.04, 0.12, t);
	float ring = exp(-pow((r - rr) / w, 2.0));
	float ring2 = exp(-pow((r - rr * 0.7) / (w * 0.7), 2.0)) * 0.5;
	ALBEDO = mix(vec3(0.93, 0.96, 0.97), accent_core.rgb, 0.35);
	ALPHA = (ring + ring2) * (1.0 - t) * 0.75;
}
