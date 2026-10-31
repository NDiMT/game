shader_type spatial;
// v1.1 (Agent A) the eyes of a veiled stone face: ONE quad per PAIR, laid on the face (a statue's face, or the
// head of a shadow on the floor) and oriented with it by its transform: quad +X = across the face (the eyes'
// line), quad +Y = up the face (toward the brow). Each eye: an almond glow with a soft near-white inner core,
// a faint tear-streak of glow running down from it, and a slight brow shadow above. Breathes, now and then
// blinks (`phase` = the pair's own rhythm). Alpha-blended (an added red is lost on white marble).
// Built by scripts/fx/veiled_eyes.gd (VeiledEyes.for_statue / for_shadow).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float k = 1.0;                       // strength (0 = closed / gone)
uniform float pulse = 0.0;                   // a stronger breath (a hint)
uniform float phase = 0.0;
uniform vec2 qsize = vec2(0.44, 0.40);       // the quad's size in metres (the mesh is 1 x 1, scaled to this)
uniform float gap = 0.22;                    // between the two eyes' centres (m)
uniform vec2 eye = vec2(0.105, 0.042);       // one almond's length and height (m)
uniform float tears = 0.6;                   // the glow trails running down (0..1)
uniform float brow = 0.5;                    // the brow shadow above each eye (0..1)
uniform float tilt = 0.12;                   // the outer corners lift a little (a veiled, downcast look)
uniform float halo_k = 0.45;                 // v1.1c: the soft halo round each eye (floor pairs: bold, 1.0)
uniform float hot_white = 0.6;               // v1.1c: how white the core runs (floor pairs 0: a pale centre reads as a hole)
uniform float core_k = 1.0;                  // v1.1c: the inner core's strength (floor pairs: 1.4)

float almond(vec2 p, vec2 e, float lid) {
	float hx = e.x * 0.5, hy = e.y * 0.5 * lid;
	float a = abs(p.x) / hx;
	float w = hy * pow(max(1.0 - a * a, 0.0), 0.65) + 1e-4;
	return max(a, abs(p.y) / w);             // < 1 inside
}

void fragment() {
	vec2 P = (UV - 0.5) * qsize;
	P.y = -P.y;                                // +y up the face
	float bt = fract((TIME + phase * 1.9) / 5.3);
	float lid = 1.0 - 0.92 * smoothstep(0.0, 0.02, bt) * (1.0 - smoothstep(0.02, 0.045, bt));
	float br = k * (1.0 + (0.08 + 0.3 * pulse) * sin(TIME * (1.1 + 1.8 * pulse) + phase));
	vec3 col = vec3(0.0);
	float glow_a = 0.0, dark_a = 0.0;
	for (int s = 0; s < 2; s++) {
		float sg = s == 0 ? -1.0 : 1.0;
		vec2 p = P - vec2(sg * gap * 0.5, 0.0);
		p.y -= tilt * p.x * sg;                // outer corner lifted
		float m = almond(p, eye, lid);
		float core = 1.0 - smoothstep(0.55, 1.0, m);
		float inner = 1.0 - smoothstep(0.0, 0.55, length(p / vec2(eye.x * 0.5, max(eye.y * 0.5 * lid, 1e-4))));
		float halo = exp(-max(length(p / vec2(eye.x * 0.62, eye.y * 0.95)) - 0.75, 0.0) * mix(3.4, 1.8, clamp(halo_k - 0.45, 0.0, 1.0))) * halo_k;
		// the tear: a thin glow trail from the inner lower lid down the cheek, fading
		float tx = p.x + sg * eye.x * 0.18;
		float ty = -p.y - eye.y * 0.35;
		float trail = (1.0 - smoothstep(0.004, 0.012, abs(tx + 0.004 * sin(ty * 60.0)))) * smoothstep(0.0, 0.01, ty) * (1.0 - smoothstep(0.0, 0.12, ty));
		trail *= tears * (0.55 + 0.45 * sin(TIME * 0.7 + phase + sg));
		// the brow: a soft dark arc just above the eye (the stone's shadow under the veil's edge)
		vec2 b = p - vec2(0.0, eye.y * 1.05);
		float bm = (1.0 - smoothstep(0.0, eye.y * 0.55, abs(b.y + 0.9 * b.x * b.x / eye.x))) * (1.0 - smoothstep(eye.x * 0.45, eye.x * 0.7, abs(b.x)));
		vec3 hot = mix(accent.rgb, mix(accent_core.rgb, vec3(1.0, 0.92, 0.9), hot_white), clamp(inner * core_k, 0.0, 1.0));
		core = clamp(core * core_k, 0.0, 1.0);
		float g = max(core, max(halo, trail * 0.8)) * br;
		col = mix(col, mix(accent.rgb * 0.95, hot, core), clamp(g, 0.0, 1.0));
		glow_a = max(glow_a, g);
		dark_a = max(dark_a, bm * brow * 0.55 * k);
	}
	vec3 dark = vec3(0.05, 0.05, 0.06);
	float a = max(glow_a, dark_a);
	ALBEDO = glow_a >= dark_a ? col : dark;
	ALPHA = clamp(a, 0.0, 1.0);
}
