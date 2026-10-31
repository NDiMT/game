shader_type spatial;
// v1.0 M3c (Agent A) petals (and grit) drifting on the wind through a box: one MultiMesh, one draw call.
// INSTANCE_CUSTOM = (seed x, seed y, seed z, kind 0..1). Petals wrap round the box (shrinking to nothing at
// its edges, so the wrap never shows), tumble and flutter. No CPU work after setup.
render_mode skip_vertex_transform, cull_disabled, shadows_disabled;

uniform vec3 box_min = vec3(-4.0, 0.0, -4.0);
uniform vec3 box_size = vec3(8.0, 3.0, 8.0);
uniform vec3 wind = vec3(1.1, 0.0, -0.45);   // m/s
uniform float fall = 0.28;                    // m/s
uniform float size = 0.06;
uniform float gust = 0.0;                     // 0..1: script-driven extra push (wind sound swells)
uniform vec3 petal : source_color = vec3(0.88, 0.86, 0.82);
uniform vec3 rose : source_color = vec3(0.86, 0.62, 0.62);   // a few faintly rose ones
uniform float rose_share = 0.2;
uniform float leaf_share = 0.0;                 // v1.1: a share of small dry leaves among them
uniform vec3 leaf : source_color = vec3(0.47, 0.46, 0.36);
uniform float clock = -1.0;

varying float kind;

mat3 rot(vec3 ax, float a) {
	ax = normalize(ax);
	float s = sin(a), c = cos(a), oc = 1.0 - c;
	return mat3(vec3(oc * ax.x * ax.x + c, oc * ax.x * ax.y + ax.z * s, oc * ax.z * ax.x - ax.y * s),
		vec3(oc * ax.x * ax.y - ax.z * s, oc * ax.y * ax.y + c, oc * ax.y * ax.z + ax.x * s),
		vec3(oc * ax.z * ax.x + ax.y * s, oc * ax.y * ax.z - ax.x * s, oc * ax.z * ax.z + c));
}

void vertex() {
	float t = clock < 0.0 ? TIME : clock;
	vec4 c = INSTANCE_CUSTOM;
	kind = c.a;
	float k = 0.7 + 0.6 * fract(c.r * 7.13 + c.b * 3.1);          // each one its own speed
	vec3 drift = wind * t * k * (1.0 + gust * 0.8);
	drift.y -= fall * t * k;
	// flutter: side to side and a little up and down
	drift += vec3(sin(t * 1.7 + c.r * 40.0), sin(t * 2.3 + c.g * 30.0) * 0.6, cos(t * 1.3 + c.b * 50.0)) * 0.22;
	vec3 f = fract(c.rgb + drift / box_size);
	vec3 p = box_min + f * box_size;
	vec3 e = min(f, 1.0 - f) * box_size;
	float s = size * (0.7 + 0.6 * fract(c.g * 13.7)) * smoothstep(0.0, 0.6, min(min(e.x, e.y), e.z));
	mat3 R = rot(vec3(c.r - 0.5, 0.6, c.b - 0.5), t * (2.0 + 3.0 * c.g) + c.r * 20.0);
	vec3 local = R * vec3(VERTEX.x, VERTEX.y * 0.7, 0.0) * s;
	vec3 w = p + local;
	VERTEX = (VIEW_MATRIX * vec4(w, 1.0)).xyz;
	NORMAL = normalize((VIEW_MATRIX * vec4(R * vec3(0.0, 0.0, 1.0), 0.0)).xyz);
}

void fragment() {
	vec2 q = (UV - 0.5) * 2.0;
	if (kind > 1.0 - leaf_share) {
		// a small dry leaf: a pointed oval with a midrib and a stalk
		float w = 0.42 * (1.0 - q.y * q.y) * (1.0 - 0.35 * q.y);
		float stalk = step(-1.0, q.y) * step(q.y, -0.82) * step(abs(q.x), 0.05);
		if (abs(q.x) > w && stalk < 0.5) discard;
		float rib = 1.0 - smoothstep(0.0, 0.04, abs(q.x));
		vec3 lc = leaf * (0.85 + 0.3 * fract(kind * 17.0));
		ALBEDO = mix(lc, lc * 0.7, rib);
	} else {
		// a petal: an oval with a notch at its tip
		float d = length(vec2(q.x * 1.2, q.y));
		float notch = step(0.75, q.y) * step(abs(q.x), 0.12);
		if (d > 1.0 || notch > 0.5) discard;
		vec3 col = kind < rose_share ? rose : petal;
		ALBEDO = col * (0.92 + 0.08 * (1.0 - d));
	}
	ROUGHNESS = 0.9;
	BACKLIGHT = vec3(0.35);
}
