shader_type spatial;
// v2.0 (Agent A) the flare of a waking rune (OmenFx.rune_wake): a camera-facing quad over the rune, drawn over its
// plinth (no depth test: the plinth's own corner and the statue above never cut it). A white-hot core, a crimson
// halo, a four-point flare with long crimson arms, and a burst ring that runs out (`grow`). Alpha-blended, so the
// crimson reads on pale marble (additive would only whiten it). Web-safe (no screen / depth reads).
render_mode unshaded, blend_mix, depth_draw_never, depth_test_disabled, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform float k = 0.0;                 // strength 0..1
uniform float grow = 0.0;              // the burst ring 0..1
uniform float spin = 0.0;              // the flare's slow turn (rad)

void vertex() {
	// billboard, keeping the quad's scale
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * length(MODEL_MATRIX[0].xyz),
		INV_VIEW_MATRIX[1] * length(MODEL_MATRIX[1].xyz), INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
}

void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float cs = cos(spin), sn = sin(spin);
	vec2 q = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
	float r = length(p);
	float core = exp(-r * r * 60.0);
	float halo = exp(-r * r * 7.0);
	// the four-point flare: thin hot spines inside long crimson arms
	float arms = exp(-abs(q.x) * 16.0) * exp(-abs(q.y) * 2.4) + exp(-abs(q.y) * 16.0) * exp(-abs(q.x) * 2.4);
	float spine = exp(-abs(q.x) * 70.0) * exp(-abs(q.y) * 4.0) + exp(-abs(q.y) * 70.0) * exp(-abs(q.x) * 4.0);
	// the diagonal glints, shorter
	vec2 d = vec2(q.x + q.y, q.x - q.y) * 0.7071;
	float diag = (exp(-abs(d.x) * 30.0) * exp(-abs(d.y) * 6.0) + exp(-abs(d.y) * 30.0) * exp(-abs(d.x) * 6.0)) * 0.5;
	// the burst ring
	float rr = 0.2 + grow * 0.75;
	float ring = exp(-pow((r - rr) / 0.05, 2.0)) * (1.0 - grow) * step(0.001, grow);
	vec3 crim = accent.rgb * 1.15;
	float hot = clamp(core * 1.4 + spine * 0.9, 0.0, 1.0);
	vec3 c = mix(crim, vec3(1.0, 0.93, 0.9), hot);
	float a = clamp(halo * 0.7 + arms * 0.85 + diag * 0.6 + core + spine + ring * 0.9, 0.0, 1.0) * smoothstep(1.0, 0.75, r);
	ALBEDO = c;
	ALPHA = clamp(a * k, 0.0, 1.0);
}
