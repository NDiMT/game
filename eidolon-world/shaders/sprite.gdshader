shader_type spatial;
// Small camera-facing sprites drawn in code: kind 0 = a puff of dust at a footfall, 1 = a distant bird
// (dark, wings beating), 2 = a moth (pale, fluttering, drawn to light). `life` 0..1 for puffs.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled;
uniform float kind = 0.0;
uniform float life = 0.0;
uniform float phase = 0.0;
uniform float alpha = 1.0;

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * length(MODEL_MATRIX[0].xyz), INV_VIEW_MATRIX[1] * length(MODEL_MATRIX[1].xyz), INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

float wing(vec2 p, float flap) {
	// a curved stroke from the body out to the wing tip
	float x = abs(p.x);
	float y = p.y - x * (0.55 * flap) + x * x * 0.4 * flap;
	return 1.0 - smoothstep(0.035, 0.07, abs(y)) * 1.0;
}

void fragment() {
	vec2 p = (UV - 0.5) * vec2(2.0, -2.0);
	if (kind < 0.5) {
		float d = length(p);
		float g = pow(1.0 - clamp(d, 0.0, 1.0), 1.6);
		ALBEDO = vec3(0.62, 0.60, 0.56);
		ALPHA = g * (1.0 - life) * 0.35 * alpha;
	} else if (kind < 1.5) {
		float flap = sin(TIME * 7.0 + phase);
		float w = wing(p, flap) * step(abs(p.x), 0.95) * (1.0 - smoothstep(0.7, 0.95, abs(p.x)));
		ALBEDO = vec3(0.22, 0.22, 0.24);
		ALPHA = clamp(w, 0.0, 1.0) * 0.75 * alpha;
	} else {
		float flap = abs(sin(TIME * 22.0 + phase));
		vec2 q = vec2(abs(p.x) / max(flap, 0.15), p.y);
		float lobe = 1.0 - smoothstep(0.35, 0.5, length(q - vec2(0.42, 0.08)));
		lobe = max(lobe, 1.0 - smoothstep(0.22, 0.32, length(q - vec2(0.3, -0.3))));
		float body = 1.0 - smoothstep(0.06, 0.1, length(vec2(p.x, p.y * 0.35)));
		ALBEDO = vec3(0.93, 0.92, 0.86);
		ALPHA = clamp(max(lobe * 0.8, body), 0.0, 1.0) * alpha;
	}
}
