shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

uniform vec3 color : source_color = vec3(0.2, 0.85, 1.0);
uniform float intensity = 0.4;

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX[3].z += 1.2;
}

void fragment() {
	float d = length(UV - 0.5) * 2.0;
	float g = pow(1.0 - clamp(d, 0.0, 1.0), 2.4);
	float breathe = 0.85 + 0.15 * sin(TIME * 1.7);
	ALBEDO = color;
	ALPHA = g * intensity * breathe;
}
