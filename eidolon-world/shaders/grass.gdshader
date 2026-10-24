shader_type spatial;
// Pale dead grass tufts (3 crossed quads per instance): blades cut by alpha, swaying in the wind.
render_mode cull_disabled, depth_draw_opaque;
global uniform vec3 player_pos;
varying float h;
varying vec3 wp;
void vertex() {
	h = 1.0 - UV.y;
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float sway = sin(TIME * 1.4 + wp.x * 0.7 + wp.z * 0.5) * 0.05 + sin(TIME * 3.1 + wp.z * 2.0) * 0.015;
	// the wanderer's cloak brushes the grass aside
	vec3 away = wp - player_pos;
	float push = (1.0 - smoothstep(0.2, 0.7, length(away.xz))) * 0.12;
	VERTEX.x += (sway + normalize(away.xz + 0.001).x * push) * h * h;
	VERTEX.z += (sway * 0.6 + normalize(away.xz + 0.001).y * push) * h * h;
}
float hash(float x) { return fract(sin(x * 91.3) * 47453.5); }
void fragment() {
	NORMAL = normalize((VIEW_MATRIX * vec4(0.15, 1.0, 0.1, 0.0)).xyz);
	float k = UV.x * 9.0;
	float id = floor(k);
	float bx = fract(k) - 0.5 + (hash(id) - 0.5) * 0.3;
	float bh = 0.45 + 0.55 * hash(id + 7.0);
	float w = 0.42 * (1.0 - h / bh);
	if (h > bh || abs(bx) > w) discard;
	vec3 base = vec3(0.52, 0.50, 0.42);
	vec3 tip = vec3(0.82, 0.78, 0.64) * (0.9 + 0.2 * hash(id + 3.0));
	ALBEDO = mix(base, tip, smoothstep(0.0, 0.8, h));
	ROUGHNESS = 0.9;
	SPECULAR = 0.1;
}
