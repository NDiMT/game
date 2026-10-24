shader_type canvas_item;
// A rune drawn in the UI (cards, the door close-up): the same SDF language and the same carved glow
// as the world. design < 0 = an empty slot (the frame only, dim). glow adds bloom; numeral 1..3 adds
// Roman tally strokes beneath.
#include "res://shaders/glyphs.gdshaderinc"
uniform float design = 0.0;
uniform float numeral = 0.0;
uniform float alpha = 1.0;
uniform float glow = 0.6;
uniform float aspect = 1.196;          // rect height / width: the rune keeps its true proportions
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
void fragment() {
	vec2 p = (UV - vec2(0.5, 0.42)) * vec2(2.3, 2.3 * aspect);
	vec2 rp = vec2(p.x, -p.y);
	float empty = step(design, -0.5);
	float d = empty > 0.5 ? rune_frame(rp) : rune_dist(rp, int(design + 0.5));
	int n = int(numeral + 0.5);
	for (int i = 0; i < 3; i++) {
		if (i >= n) break;
		float x = (float(i) - float(n - 1) * 0.5) * 0.24;
		d = min(d, g_seg(rp, vec2(x, -1.12), vec2(x, -1.42)));
	}
	vec4 m = carved_glow(d, RUNE_W);
	float aa = max(fwidth(d), 0.002);
	float rim = (1.0 - smoothstep(RUNE_W + aa, RUNE_W + aa * 2.0 + 0.012, d)) * (1.0 - m.x) * (1.0 - empty);
	float inner = 1.0 - clamp(d / RUNE_W, 0.0, 1.0);
	vec3 core_col = mix(accent.rgb, accent_core.rgb, smoothstep(0.05, 0.75, inner));
	core_col = mix(core_col, vec3(0.95, 1.0, 0.99), m.z * 0.55);
	core_col = mix(core_col, accent_tint.rgb, m.w * 0.45);
	float halo = (1.0 - smoothstep(0.0, 1.25, length(rp))) * 0.2 * glow * (1.0 - empty);
	vec3 c = mix(accent.rgb, core_col, m.x);
	c = mix(c, accent_tint.rgb, rim * 0.8);
	float a = m.x * mix(1.0, 0.35, empty) + rim * 0.7 + m.y * (0.4 + 0.6 * glow) * (1.0 - empty * 0.7) + halo;
	COLOR = vec4(c, clamp(a, 0.0, 1.0) * alpha);
}
