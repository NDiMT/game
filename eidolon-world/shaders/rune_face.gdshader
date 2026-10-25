shader_type spatial;
// A single rune of the sculptor's language on a quad (statue plinths, plates, pans, steles).
// design < 0 = empty slot (frame only). numeral 1..3 adds Roman tally strokes beneath the ring.
// lit: 0 = asleep (a faint light in the groove), 1 = awake (a bright core, bloom on the stone);
// flare = solve burst. CARVED GLOW: never a dark fill.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
#include "res://shaders/glyphs.gdshaderinc"
// v0.8 the two lights, `hers` 0..1 (v0.8.1: both are aqua: palette.gd)
global uniform vec4 her;
global uniform vec4 her_core;
global uniform vec4 her_tint;
uniform float hers = 0.0;
vec3 _ha() { return mix(accent.rgb, her.rgb, hers); }
vec3 _hc() { return mix(accent_core.rgb, her_core.rgb, hers); }
vec3 _ht() { return mix(accent_tint.rgb, her_tint.rgb, hers); }

uniform float design = -1.0;
uniform float lit : hint_range(0.0, 1.0) = 0.0;
uniform float flare = 0.0;
uniform float on_floor = 0.0;            // v0.8.3: a rune lying on the floor (stronger, pulsing)
uniform float numeral = 0.0;
uniform float mirror = 0.0;
uniform vec3 carve : source_color = vec3(0.16, 0.17, 0.18);

void fragment() {
	// quad: x spans the ring, y has extra room below for the numeral
	// (v0.8.1: the same scale on both axes: a rune is never squashed; a numeral below needs the extra room)
	vec2 p = (numeral > 0.5) ? (UV - vec2(0.5, 0.40)) * 2.9 : (UV - vec2(0.5)) * 2.45;
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
	vec4 m = carved_glow(d - RUNE_W * 0.35 * on_floor, RUNE_W);          // (v0.8.3: floor runes a little thicker)
	float breathe = 0.88 + 0.12 * sin(TIME * 1.4 + design);
	float k = clamp(lit + flare, 0.0, 1.0);
	float inner = 1.0 - clamp(d / RUNE_W, 0.0, 1.0);
	// asleep: the groove holds a faint tinted light; awake: a bright core
	vec3 asleep = mix(_ht(), _ha(), 0.35);
	vec3 awake = mix(_ha(), _hc(), smoothstep(0.1, 0.8, inner));
	vec3 c = mix(asleep, awake, k);
	c = mix(c, vec3(1.0, 0.95, 0.93), m.z * (0.35 + 0.5 * k));
	c = mix(c, _ht(), m.w * 0.45);
	vec3 bloom_c = _ha();
	float halo = (1.0 - smoothstep(0.0, 1.3, length(rp))) * (k * 0.2 + flare * 0.45);
	vec3 col = mix(bloom_c, c, m.x);
	float fp = mix(1.0, 1.25 * (0.86 + 0.14 * sin(TIME * 1.6 + design)), on_floor);
	ALBEDO = col * (1.0 + flare * 0.6) * fp;
	ALPHA = clamp((m.x * mix(0.7, 1.0, k) + m.y * (0.12 + k * 0.7 * breathe + flare * 0.5) + halo) * mix(1.0, 1.25, on_floor), 0.0, 1.0);
}
