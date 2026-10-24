shader_type spatial;
// Soft additive light shaft (camera-facing quad on the camera rig).
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

uniform float intensity = 0.12;
uniform float phase = 0.0;

void fragment() {
	float x = abs(UV.x - 0.5) * 2.0;
	float across = pow(1.0 - smoothstep(0.0, 1.0, x), 2.0);
	float along = smoothstep(0.0, 0.25, UV.y) * smoothstep(1.0, 0.55, UV.y);
	float breathe = 0.7 + 0.3 * sin(TIME * 0.35 + phase);
	float streak = 0.8 + 0.2 * sin(UV.x * 30.0 + phase * 7.0 + TIME * 0.2);
	ALBEDO = vec3(1.0, 0.97, 0.9) * across * along * breathe * streak * intensity;
}
