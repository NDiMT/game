shader_type spatial;
// v1.0 M3c (Agent A) moths round a light: one MultiMesh, one draw call, all motion on the GPU.
// Each instance's transform origin is the light it circles; INSTANCE_CUSTOM = (phase 0..1, radius scale,
// speed, height offset). The quad is a camera-facing billboard; the wings flap by squeezing their width.
render_mode skip_vertex_transform, unshaded, cull_disabled, shadows_disabled;

uniform float radius = 0.38;          // mean orbit radius (m)
uniform float size = 0.1;             // wingspan (m)
uniform vec3 tint : source_color = vec3(0.70, 0.66, 0.58);
uniform vec3 glow : source_color = vec3(1.0, 0.82, 0.62);   // the side toward the flame
uniform float clock = -1.0;           // < 0: the shader's TIME; else this (set by script for sync)

varying float flap;
varying float lit;

void vertex() {
	float t = clock < 0.0 ? TIME : clock;
	vec4 c = INSTANCE_CUSTOM;
	vec3 centre = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float ph = c.r * 6.2832;
	float a = t * (1.2 + 1.6 * c.b) * (c.r > 0.5 ? 1.0 : -1.0) + ph;
	float r = radius * (0.55 + 0.9 * c.g) * (1.0 + 0.25 * sin(t * 1.3 + ph * 2.0));
	vec3 p = centre + vec3(cos(a) * r, (c.a - 0.5) * 0.35 + sin(a * 1.7 + ph * 3.0) * 0.12, sin(a) * r);
	// the erratic dart of a moth: small fast jitter on top of the orbit
	p += 0.05 * vec3(sin(t * 7.3 + ph * 11.0), sin(t * 9.1 + ph * 5.0), cos(t * 6.7 + ph * 7.0));
	flap = 0.25 + 0.75 * abs(sin(t * (28.0 + 9.0 * c.b) + ph * 4.0));
	lit = 1.0 - smoothstep(0.1, 0.9, length(p - centre));
	vec3 right = INV_VIEW_MATRIX[0].xyz;
	vec3 up = INV_VIEW_MATRIX[1].xyz;
	vec3 w = p + (right * VERTEX.x + up * VERTEX.y) * size;
	VERTEX = (VIEW_MATRIX * vec4(w, 1.0)).xyz;
	NORMAL = vec3(0.0, 0.0, 1.0);
}

void fragment() {
	vec2 q = (UV - 0.5) * 2.0;
	float body = step(abs(q.x), 0.07) * step(abs(q.y + 0.05), 0.42);
	float x = abs(q.x) / flap;
	// two rounded wings, the fore wing larger, a little swept back
	float fore = step(length(vec2(x * 0.95, q.y * 1.5 - 0.25 + x * 0.25)), 0.95);
	float hind = step(length(vec2(x * 1.25, q.y * 1.7 + 0.45 - x * 0.1)), 0.7);
	float a = max(body, max(fore, hind) * step(0.04, abs(q.x)));
	if (a < 0.5) discard;
	float edge = smoothstep(0.55, 0.95, x);
	ALBEDO = mix(tint * (0.8 + 0.2 * body), glow, lit * 0.55) * (1.0 - edge * 0.25);
}
