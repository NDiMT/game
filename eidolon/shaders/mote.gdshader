shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

void fragment() {
	float d = length(UV - 0.5) * 2.0;
	float g = pow(1.0 - clamp(d, 0.0, 1.0), 2.0);
	ALBEDO = mix(COLOR.rgb, vec3(1.0), 0.35 * g);
	ALPHA = g * COLOR.a;
}
