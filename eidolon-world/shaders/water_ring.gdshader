shader_type spatial;
// v0.8: a ripple ring spreading on still water (t 0..1: it grows and fades). (a8) finer: three thin crests chasing
// out, each a bright hairline with a soft sheen inside it (never a dark band), easing out at the rim; a faint rose core.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent_core;
uniform float t = 0.0;
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float a = 0.0;
	for (int i = 0; i < 3; i++) {
		float ti = clamp(t * 1.25 - float(i) * 0.16, 0.0, 1.0);
		if (ti <= 0.0) continue;
		float rr = mix(0.04, 0.96, 1.0 - (1.0 - ti) * (1.0 - ti));
		float w = mix(0.012, 0.035, ti);
		float crest = exp(-pow((r - rr) / w, 2.0));
		float sheen = exp(-pow((r - rr + w * 2.2) / (w * 2.5), 2.0)) * 0.25;
		a += (crest + sheen) * (1.0 - ti) * (1.0 - float(i) * 0.3);
	}
	a *= 1.0 - smoothstep(0.88, 1.0, r);
	ALBEDO = mix(vec3(0.95, 0.97, 0.98), accent_core.rgb, 0.18 + 0.2 * exp(-r * 6.0));
	ALPHA = clamp(a * 0.85, 0.0, 0.9);
}
