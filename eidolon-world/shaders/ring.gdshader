shader_type spatial;
// Rune ring set into the floor around a shrine: six runes in a circle, dark until `lit`.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
// v0.8 the two lights, `hers` 0..1 (v0.8.1: both are aqua: palette.gd)
global uniform vec4 her;
global uniform vec4 her_core;
global uniform vec4 her_tint;
uniform float hers = 0.0;
vec3 _ha() { return mix(accent.rgb, her.rgb, hers); }
vec3 _hc() { return mix(accent_core.rgb, her_core.rgb, hers); }
uniform float lit = 0.0;
uniform float sweep = 0.0;     // 0..1 the ignition travelling around the ring

void fragment() {
	vec2 p = (UV - 0.5) * 2.0;           // -1..1
	float r = length(p);
	float an = atan(p.y, p.x);
	float aa = fwidth(r) * 1.5;
	float ring_l = 1.0 - smoothstep(0.008, 0.008 + aa, abs(r - 0.92));
	ring_l = max(ring_l, 1.0 - smoothstep(0.005, 0.005 + aa, abs(r - 0.62)));
	float cell = floor((an + PI) / (TAU / 6.0));
	float ca = (cell + 0.5) * (TAU / 6.0) - PI;
	vec2 cc = vec2(cos(ca), sin(ca)) * 0.77;
	vec2 q = p - cc;
	// rotate so the rune stands upright facing outward
	float s = sin(-ca - PI * 0.5), c = cos(-ca - PI * 0.5);
	q = vec2(q.x * c - q.y * s, q.x * s + q.y * c) / 0.12;
	vec2 rm = rune_mask(rune_dist(q, int(cell)));
	float ang01 = (an + PI) / TAU;
	float on = lit * (1.0 - smoothstep(sweep - 0.02, sweep, ang01)) + lit * step(0.999, sweep);
	on = clamp(on, 0.0, 1.0);
	float m = max(ring_l, rm.x);
	vec3 carved = mix(vec3(0.17, 0.17, 0.18), _ha() * 0.35, 0.35 + 0.1 * sin(TIME * 1.6));   // (v0.8.3: even asleep, the groove holds a little light)
	vec3 hot = mix(_ha(), _hc(), 0.6) * (1.1 + 0.15 * sin(TIME * 1.6));      // (v0.8.3: brighter, a slow pulse)
	vec3 col = mix(carved, hot, on);
	float halo = rm.y * on * 0.9 + (1.0 - smoothstep(0.0, 0.08, abs(r - 0.92))) * on * 0.25;
	ALBEDO = mix(col, _ha(), halo);
	ALPHA = clamp(m * mix(0.55, 1.0, on) + halo, 0.0, 1.0);
}
