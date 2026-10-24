shader_type spatial;
// A single rune of the sculptor's language on a quad (door slots, dials, statue plinths, the plate).
// design < 0 = empty slot (frame only). numeral 1..3 adds Roman tally strokes beneath the ring.
// lit: 0 = carved (dark groove), 1 = glowing cyan; flare = solve burst.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
#include "res://shaders/glyphs.gdshaderinc"

uniform float design = -1.0;
uniform float lit : hint_range(0.0, 1.0) = 0.0;
uniform float flare = 0.0;
uniform float numeral = 0.0;
uniform float mirror = 0.0;
uniform vec3 color : source_color = vec3(0.30, 0.92, 1.0);
uniform vec3 carve : source_color = vec3(0.16, 0.17, 0.18);

void fragment() {
	// quad: x spans the ring, y has extra room below for the numeral
	vec2 p = (UV - vec2(0.5, 0.40)) * vec2(2.3, 2.9);
	if (mirror > 0.5) p.x = -p.x;
	vec2 rp = vec2(p.x, -p.y);
	float d = design < -0.5 ? rune_frame(rp) : rune_dist(rp, int(design + 0.5));
	if (numeral > 0.5) {
		int n = int(numeral + 0.5);
		for (int i = 0; i < 3; i++) {
			if (i >= n) break;
			float x = (float(i) - float(n - 1) * 0.5) * 0.24;
			d = min(d, g_seg(rp, vec2(x, -1.12), vec2(x, -1.42)));
		}
	}
	vec2 rm = rune_mask(d);
	float breathe = 0.85 + 0.15 * sin(TIME * 1.4 + design);
	vec3 hot = mix(color, vec3(0.92, 1.0, 1.0), 0.5 + flare * 0.5);
	vec3 c = mix(carve, hot, lit);
	c = mix(c, color, rm.y * lit);
	float a = rm.x * mix(0.75, 1.0, lit) + rm.y * (lit * 0.75 * breathe + flare * 0.6);
	float halo = (1.0 - smoothstep(0.0, 1.3, length(rp))) * (lit * 0.10 + flare * 0.5);
	ALBEDO = c * (1.0 + flare * 0.8);
	ALPHA = clamp(a + halo, 0.0, 1.0);
}
