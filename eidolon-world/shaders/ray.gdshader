shader_type spatial;
// Horizontal light beam segment: a ribbon from the node origin along its local +X (scaled to the segment
// length), always turned to face the camera. Bright core, soft body, travelling motes.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;


uniform float width = 0.38;
uniform float intensity = 1.0;
uniform float length_m = 1.0;
varying vec2 uvv;

void vertex() {
	vec3 a = MODEL_MATRIX[3].xyz;
	vec3 axis = MODEL_MATRIX[0].xyz;
	vec3 cb = normalize(INV_VIEW_MATRIX[2].xyz);
	vec3 side = normalize(cross(normalize(axis), cb));
	vec3 w = a + axis * (VERTEX.x + 0.5) + side * VERTEX.y * width;
	uvv = vec2(VERTEX.x + 0.5, VERTEX.y + 0.5);
	POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
}

void fragment() {
	float x = abs(uvv.y - 0.5) * 2.0;
	float core = 1.0 - smoothstep(0.0, 0.18, x);
	float body = pow(1.0 - smoothstep(0.0, 1.0, x), 2.0);
	float L = uvv.x * length_m;
	float motes = smoothstep(0.85, 1.0, sin(L * 5.0 - TIME * 9.0)) * 0.5;
	float flick = 0.9 + 0.1 * sin(TIME * 23.0 + L);
	vec3 deep = accent.rgb;
	vec3 c = mix(deep, accent_core.rgb, smoothstep(0.35, 0.9, 1.0 - x));
	c = mix(c, mix(accent_core.rgb, vec3(1.0), 0.35), core);
	ALBEDO = c * (1.0 + motes * 0.6);
	ALPHA = clamp((body * 0.75 + core * 1.0 + motes * body * 0.4) * intensity * flick, 0.0, 1.0);
}
