shader_type spatial;
// v1.0 M3c (Agent A) water drips: a drop falls from a ceiling point and leaves a small splash ring on the floor.
// One MultiMesh (one draw call). Each instance: transform origin = where it drips from; INSTANCE_CUSTOM =
// (fall height m, period s, phase 0..1, -). The mesh holds two quads: COLOR.r 0 = the drop (a camera-facing
// streak), 1 = the ring (flat on the floor). `clock` is set by drips.gd so its splash signal is in step.
render_mode skip_vertex_transform, unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;

uniform float clock = 0.0;
uniform vec3 tint : source_color = vec3(0.93, 0.96, 1.0);
uniform float ring_life = 0.7;    // s
uniform float ring_size = 0.24;   // m (final radius)

varying float part;
varying float alpha_k;

void vertex() {
	vec4 c = INSTANCE_CUSTOM;
	float h = max(c.r, 0.05);
	float period = max(c.g, 0.5);
	vec3 top = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float tl = fract(clock / period + c.b) * period;       // time since this drip let go
	float tf = sqrt(2.0 * h / 9.81);                       // its fall time
	part = COLOR.r;
	vec3 w;
	if (part < 0.5) {
		// the drop: swells for a moment, then falls as a streak stretched by its speed
		float y = -0.5 * 9.81 * tl * tl;
		float on = step(tl, tf);
		float v = 9.81 * tl;
		vec3 right = INV_VIEW_MATRIX[0].xyz;
		vec3 p = top + vec3(0.0, max(y, -h), 0.0);
		w = p + right * VERTEX.x * 0.022 * on + vec3(0.0, 1.0, 0.0) * VERTEX.y * (0.02 + v * 0.012) * on;
		alpha_k = 0.9 * on;
	} else {
		float tr = tl - tf;
		float k = clamp(tr / ring_life, 0.0, 1.0);
		float on = step(0.0, tr) * step(tr, ring_life);
		float r = ring_size * (0.15 + 0.85 * sqrt(k));
		w = top + vec3(VERTEX.x * 2.0 * r, -h + 0.006, VERTEX.y * 2.0 * r) * on;
		alpha_k = (1.0 - k) * on;
	}
	VERTEX = (VIEW_MATRIX * vec4(w, 1.0)).xyz;
	NORMAL = vec3(0.0, 0.0, 1.0);
}

void fragment() {
	vec2 q = (UV - 0.5) * 2.0;
	float a;
	if (part < 0.5) {
		a = (1.0 - smoothstep(0.4, 1.0, abs(q.x))) * (1.0 - smoothstep(0.6, 1.0, abs(q.y)));
	} else {
		float d = length(q);
		a = smoothstep(0.78, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d));          // the outer ring
		a += 0.5 * smoothstep(0.42, 0.5, d) * (1.0 - smoothstep(0.5, 0.58, d));  // an inner ring
	}
	ALBEDO = tint;
	ALPHA = clamp(a * alpha_k, 0.0, 1.0);
}
