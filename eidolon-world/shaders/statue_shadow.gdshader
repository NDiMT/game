shader_type spatial;
// v0.8.1 "Where Her Shadow Fell": the statue's shadow thrown across the floor by one lit brazier, directly
// away from it (a quad from her feet along +y of its UV, its length set by the flame's distance). A soft
// veiled silhouette (body widening to the shoulders, the veiled head at the far end), blended dark, faintly
// flickering with the flame. `mode` 1: the OUTLINE of where her shadow fell long ago, carved into the floor:
// seen only through the raised shard (global shard_lens), or faintly as a hint (`hint`).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 shard_lens;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float k = 0.0;              // the flame's strength (0 = no shadow)
uniform float dark = 0.55;
uniform float mode = 0.0;
uniform float hint = 0.0;
uniform float seed = 0.0;

float sd_ell(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
float smin(float a, float b, float kk) { float h = clamp(0.5 + 0.5 * (b - a) / kk, 0.0, 1.0); return mix(b, a, h) - kk * h * (1.0 - h); }

// her silhouette laid on the floor: y 0 at her feet .. 1 at the top of her veil (x across, -1..1)
float her_sd(vec2 q) {
	float body = sd_ell(q - vec2(0.0, 0.40), vec2(0.40, 0.40));
	float hips = sd_ell(q - vec2(0.0, 0.12), vec2(0.30, 0.14));
	float sh = sd_ell(q - vec2(0.0, 0.70), vec2(0.46, 0.10));
	float head = sd_ell(q - vec2(0.0, 0.86), vec2(0.20, 0.12));
	return smin(smin(min(body, hips), sh, 0.08), head, 0.06);
}

void fragment() {
	vec2 q = vec2((UV.x - 0.5) * 2.0, 1.0 - UV.y);
	float d = her_sd(q);
	if (mode < 0.5) {
		float flick = 0.92 + 0.08 * sin(TIME * 9.0 + seed * 5.0) * sin(TIME * 3.7 + seed);
		float a = (1.0 - smoothstep(-0.06, 0.07, d)) * smoothstep(0.0, 0.08, q.y);
		a *= mix(1.0, 0.65, q.y);                                  // fainter toward the head (farther from her)
		ALBEDO = vec3(0.05, 0.05, 0.06);
		ALPHA = a * dark * k * flick;
	} else {
		float lens = 0.0;
		if (shard_lens.w > 0.5) lens = 1.0 - smoothstep(shard_lens.z * 0.85, shard_lens.z, length(FRAGCOORD.xy - shard_lens.xy));
		float line = 1.0 - smoothstep(0.018, 0.04, abs(d));            // (v0.8.3: thicker, brighter, a slow pulse)
		float bloom = exp(-abs(d) * 24.0) * 0.5;
		float show = max(lens * (0.88 + 0.12 * sin(TIME * 1.6)), hint * (0.25 + 0.15 * sin(TIME * 2.0)));
		ALBEDO = mix(accent.rgb, accent_core.rgb * 1.55, line);
		ALPHA = clamp(line + bloom, 0.0, 1.0) * show;
	}
}
