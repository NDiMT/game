shader_type spatial;
// A fallen leaf lying on the stone (flat quad, shape cut by alpha).
render_mode cull_disabled;
varying float tint;
void vertex() { tint = fract(sin(dot(MODEL_MATRIX[3].xyz, vec3(12.9, 7.1, 3.3))) * 4375.85); }
void fragment() {
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	vec2 p = (UV - 0.5) * 2.0;
	float d = length(vec2(p.x, p.y * 1.7)) - (1.0 - abs(p.y) * 0.25) * 0.85;
	if (d > 0.0) discard;
	float vein = 1.0 - smoothstep(0.0, 0.06, abs(p.x));
	vec3 c = mix(vec3(0.33, 0.29, 0.24), vec3(0.52, 0.47, 0.38), tint);
	ALBEDO = c * (1.0 - vein * 0.15);
	ROUGHNESS = 0.85;
}
