shader_type canvas_item;
// The reading card: the same text as the engraving (same seed), large, on a pale stone panel, in the
// carved-glow language (v0.8): an inner core past white (the 2D glow cannot bloom it in the Compatibility
// renderer, so the bloom is drawn here: an SDF falloff), a wide soft halo bleeding onto the stone, a thin
// tinted rim so the letters stay legible on the light stone, a little variation from stroke to stroke and
// a slow pulse. Aqua; rose when the writing is hers (`hers`). The text block sits inside a margin wide
// enough for the capital rune's halo, so nothing is cut at the card's edge.
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
global uniform vec4 her;
global uniform vec4 her_core;
global uniform vec4 her_tint;
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/script.gdshaderinc"
uniform float seed = 1.0;
uniform float rows = 4.0;
uniform float cols = 7.0;
uniform float aspect = 1.0;
uniform float alpha = 1.0;
uniform float hers = 0.0;
uniform float margin = 0.07;          // of the card, each side (room for the halo)
void fragment() {
	vec2 uv = (UV - margin) / (1.0 - 2.0 * margin);
	vec3 A = mix(accent.rgb, her.rgb, hers);
	vec3 AC = mix(accent_core.rgb, her_core.rgb, hers);
	vec3 AT = mix(accent_tint.rgb, her_tint.rgb, hers);
	// (outside the text block the distance only grows: the halo fades into the margin, never cut)
	vec2 q = clamp(uv, vec2(0.0), vec2(1.0));
	float outside = length(uv - q) * rows;
	float d = script_dist(vec2(1.0 - q.x, q.y), seed, rows, cols, aspect) + outside;   // as carved: mirrored
	float w = 0.03;
	vec4 m = script_glow(d, w);
	float aa = clamp(fwidth(d), 0.001, w * 0.6);
	float rim = (1.0 - smoothstep(w + aa, w + aa * 2.0 + 0.008, d)) * (1.0 - m.x);
	float inner = 1.0 - clamp(d / w, 0.0, 1.0);
	// a little life: each letter cell a touch brighter or dimmer, and a slow breath through the whole text
	vec2 cell = floor(vec2((1.0 - q.x) * cols, q.y * rows));
	float var = 0.86 + 0.24 * fract(sin(dot(cell + seed, vec2(12.9898, 78.233))) * 43758.5453);
	float pulse = 0.9 + 0.1 * sin(TIME * 0.8 + seed);
	float k = var * pulse;
	vec3 core_col = mix(A, AC * 1.25, smoothstep(0.05, 0.7, inner));
	core_col = mix(core_col, vec3(1.0), m.z * 0.5 * smoothstep(0.3, 0.9, inner));
	core_col = mix(core_col, AT, m.w * 0.45);
	// the halo: a wide SDF falloff (the bloom), plus a tighter glow round the stroke
	float halo = exp(-max(d - w, 0.0) / 0.11) * 0.42 + exp(-max(d - w, 0.0) / 0.035) * 0.45;
	vec3 c = mix(A, core_col, m.x);
	c = mix(c, AT, rim * 0.7 * (1.0 - m.x));
	float a = clamp(m.x + rim * 0.7 + halo * k * (1.0 - m.x), 0.0, 1.0);
	COLOR = vec4(c * mix(1.0, k, 0.6), a * alpha);
}
