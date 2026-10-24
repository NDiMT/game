shader_type spatial;
// A soft god ray falling through an arch: a quad stretched along the light direction (local +Y),
// turned about that axis to face the camera.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform float awaken;
uniform float width = 1.4;
uniform float intensity = 0.13;
uniform float phase = 0.0;
varying vec2 uvv;
void vertex() {
	vec3 a = MODEL_MATRIX[3].xyz;
	vec3 axis = MODEL_MATRIX[1].xyz;
	vec3 cb = normalize(INV_VIEW_MATRIX[2].xyz);
	vec3 side = normalize(cross(normalize(axis), cb));
	vec3 w = a + axis * VERTEX.y + side * VERTEX.x * width;
	uvv = UV;
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
}
void fragment() {
	float x = abs(uvv.x - 0.5) * 2.0;
	float across = pow(1.0 - smoothstep(0.0, 1.0, x), 1.5);
	float along = smoothstep(0.0, 0.35, uvv.y) * smoothstep(1.0, 0.75, uvv.y);
	float breathe = 0.75 + 0.25 * sin(TIME * 0.3 + phase);
	float streak = 0.8 + 0.2 * sin(uvv.x * 23.0 + phase * 5.0 + TIME * 0.15);
	ALBEDO = vec3(1.0, 0.96, 0.86);
	ALPHA = across * along * breathe * streak * intensity * (1.0 + awaken * 0.6);
}
