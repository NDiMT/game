shader_type spatial;
// v0.8.1: a rising ember / spark (CPUParticles3D billboard): a tiny bright point that cools as it rises
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent_core;
uniform float style = 0.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float a = 1.0 - smoothstep(0.0, 1.0, r);
	vec3 c = accent_core.rgb;                 // (v0.8.3: aqua sparks)
	ALBEDO = c * a * 1.4 * COLOR.a;
}
