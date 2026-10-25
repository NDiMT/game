shader_type spatial;
// v0.7: a rune carved large into the stone, glowing faintly in its groove (carved glow): the stair's
// "together", written normally: her half (the left arc) and the half she will ask you for (the right).
// pts[]: one half as a polyline in glyph units (x right, y up, -1..1); the other half is its mirror.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
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
	vec4 g = carved_glow(d, 0.045);
	float k = lit * (0.85 + 0.15 * sin(TIME * 0.9));
	ALBEDO = mix(accent.rgb, accent_core.rgb, g.x);
	ALPHA = clamp(g.x * 0.95 + g.y * 0.7 + g.z * 0.3, 0.0, 1.0) * k;
}
