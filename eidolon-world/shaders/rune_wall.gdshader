shader_type spatial;
// v0.7: a rune carved large into the stone, glowing faintly in its groove (carved glow): the stair's
// "together", written normally: her half (the left arc) and the half she will ask you for (the right).
// pts[]: one half as a polyline in glyph units (x right, y up, -1..1); the other half is its mirror.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
#include "res://shaders/glyphs.gdshaderinc"
uniform vec2 pts[24];
uniform int count = 0;
uniform float lit = 0.6;
uniform float t = 0.0;
void fragment() {
	vec2 p = (UV - 0.5) * vec2(2.0, -2.0) * 1.15;
	float d = 9.0;
	for (int i = 0; i < 23; i++) {
		if (i + 1 >= count) break;
		d = min(d, g_seg(p, pts[i], pts[i + 1]));
		d = min(d, g_seg(p, pts[i] * vec2(-1.0, 1.0), pts[i + 1] * vec2(-1.0, 1.0)));
	}
	d = min(d, rune_frame(p * 0.62) / 0.62);
	vec4 g = carved_glow(d, 0.06);                 // (v0.8.3: thicker, brighter, a slow pulse)
	float k = lit * (0.85 + 0.15 * sin(TIME * 0.9));
	// (v0.8: a luminous groove: a core past white that the bloom catches, a halo, a quiet tint edge)
	vec3 glow = mix(mix(accent_tint.rgb, accent.rgb, 0.6), accent_core.rgb * 1.45, g.x);
	float glow_a = clamp(g.x * 1.1 + g.y * 0.9 + g.z * 0.3, 0.0, 1.0) * k * (0.86 + 0.14 * sin(TIME * 1.6));
	// (v0.9.4, the owner) at rest it is not there at all: no groove, no outline, only the stone; it glows only
	// while you pass before it (`lit` 0..0.9, eased in and out by the chapter)
	ALBEDO = glow;
	ALPHA = glow_a;                                 // (k carries `lit`: 0 at rest, nothing drawn)
}
