shader_type canvas_item;
// A rune drawn in the UI (statue card, the door close-up): same SDF language as the world.
// design < 0 = an empty slot (the frame only, dim). glow adds a soft cyan bloom; numeral 1..3 adds
// Roman tally strokes beneath.
#include "res://shaders/glyphs.gdshaderinc"
uniform float design = 0.0;
uniform float numeral = 0.0;
uniform float alpha = 1.0;
uniform float glow = 0.6;
uniform float aspect = 1.196;          // rect height / width: the rune keeps its true proportions
global uniform vec4 accent;
global uniform vec4 accent_core;
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
	vec2 rm = rune_mask(d);
	vec3 hot = mix(accent_core.rgb, vec3(1.0), 0.15);
	float halo = (1.0 - smoothstep(0.0, 1.25, length(rp))) * 0.22 * glow * (1.0 - empty);
	vec3 c = mix(accent.rgb, hot, rm.x);
	float a = rm.x * mix(1.0, 0.35, empty) + rm.y * (0.45 + 0.6 * glow) * (1.0 - empty * 0.7) + halo;
	COLOR = vec4(c, clamp(a, 0.0, 1.0) * alpha);
}
