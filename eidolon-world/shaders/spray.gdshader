shader_type spatial;
// v0.8: water droplets / spray (CPUParticles3D billboards): a soft pale bead with a bright core
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent_core;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0, 0, 0), vec4(0, length(MODEL_MATRIX[1].xyz), 0, 0), vec4(0, 0, length(MODEL_MATRIX[2].xyz), 0), vec4(0, 0, 0, 1));
}
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float a = 1.0 - smoothstep(0.3, 1.0, r);
	ALBEDO = mix(vec3(0.92, 0.95, 0.96), accent_core.rgb, 0.25) + vec3(0.1) * (1.0 - smoothstep(0.0, 0.35, r));
	ALPHA = a * COLOR.a * 0.85;
}
