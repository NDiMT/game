shader_type spatial;
// Cloth veils hung on the statues: pinned at the top (UV.y = 0), swaying gently in the wind.
render_mode cull_disabled;
varying float k;
void vertex() {
	k = UV.y;
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float t = TIME * 0.9 + w.x * 0.4 + w.z * 0.3;
	VERTEX.z += (sin(t) * 0.05 + sin(t * 2.3 + UV.x * 3.0) * 0.015) * k * k;
	VERTEX.x += sin(t * 0.7 + 1.0) * 0.025 * k * k;
}
void fragment() {
	float edge = smoothstep(0.0, 0.06, min(UV.x, 1.0 - UV.x));
	float fray = step(0.94 - 0.05 * sin(UV.x * 40.0), UV.y);
	if (fray > 0.5) discard;
	ALBEDO = vec3(0.70, 0.70, 0.68) * (0.85 + 0.15 * edge) * (0.92 + 0.08 * sin(UV.x * 30.0));
	ROUGHNESS = 0.95;
	SPECULAR = 0.15;
}
