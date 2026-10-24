shader_type spatial;
// Dead creeping vines on stone: a few thin, branching dry stems (cut by alpha), stirring a little.
render_mode cull_disabled;
float hash(float x) { return fract(sin(x * 91.3) * 47453.5); }
float stem(vec2 p, float x0, float seed) {
	// a stem climbing from the bottom, wandering sideways, thinning as it rises
	float y = 1.0 - p.y;
	float x = x0 + sin(y * 6.0 + seed * 5.0) * 0.08 + sin(y * 15.0 + seed) * 0.025;
	float w = mix(0.022, 0.005, y);
	return (1.0 - smoothstep(w * 0.6, w, abs(p.x - x))) * step(y, 0.55 + 0.45 * hash(seed));
}
void vertex() {
	float k = 1.0 - UV.y;
	VERTEX.z += sin(TIME * 1.1 + VERTEX.x * 3.0 + MODEL_MATRIX[3].x) * 0.01 * k;
}
void fragment() {
	vec2 p = UV;
	float s = 0.0;
	float seed = MODEL_MATRIX[3].x * 1.3 + MODEL_MATRIX[3].z * 0.7;
	for (int i = 0; i < 4; i++) {
		float fi = float(i);
		s = max(s, stem(p, 0.2 + 0.2 * fi + (hash(seed + fi) - 0.5) * 0.1, seed + fi * 3.7));
		// side twigs
		float ty = 0.3 + 0.15 * fi + hash(seed + fi * 2.0) * 0.1;
		vec2 a = vec2(0.2 + 0.2 * fi, 1.0 - ty);
		vec2 b = a + vec2((hash(seed - fi) - 0.5) * 0.3, -0.12);
		vec2 pa = p - a, ba = b - a;
		float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
		s = max(s, (1.0 - smoothstep(0.003, 0.008, length(pa - ba * h))) * step(1.0 - p.y, 0.55 + 0.45 * hash(seed + fi)));
	}
	if (s < 0.5) discard;
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 0.3, 1.0, 0.0)).xyz);
	ALBEDO = vec3(0.24, 0.22, 0.19) * (0.85 + 0.3 * hash(floor(p.y * 30.0)));
	ROUGHNESS = 0.95;
}
