shader_type spatial;
// v0.8.1: a rising ember / spark (CPUParticles3D billboard): a tiny bright point that cools as it rises
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent_core;
global uniform vec4 accent;
uniform float style = 0.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float a = 1.0 - smoothstep(0.0, 1.0, r);
	// (v2.0 A: alpha-blended, a rose-white heart in a crimson spark: an additive point was lost on pale stone)
	ALBEDO = mix(accent.rgb, accent_core.rgb, 1.0 - smoothstep(0.0, 0.45, r));
	ALPHA = a * COLOR.a;
}
