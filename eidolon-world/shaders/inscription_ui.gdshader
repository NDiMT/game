shader_type canvas_item;
// The reading card: the same text as the engraving (same seed), large, on a pale stone panel, in the
// same carved glow: luminous cores, a soft bloom, and a thin tinted rim so the letters stay legible
// on the light stone.
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/script.gdshaderinc"
uniform float seed = 1.0;
uniform float rows = 4.0;
uniform float cols = 7.0;
uniform float aspect = 1.0;
uniform float alpha = 1.0;
void fragment() {
	float d = script_dist(UV, seed, rows, cols, aspect);
	float w = 0.03;
	vec4 m = script_glow(d, w);
	float aa = max(fwidth(d), 0.001);
	float rim = (1.0 - smoothstep(w + aa, w + aa * 2.0 + 0.008, d)) * (1.0 - m.x);
	float inner = 1.0 - clamp(d / w, 0.0, 1.0);
	vec3 core_col = mix(accent.rgb, accent_core.rgb, smoothstep(0.05, 0.7, inner));
	core_col = mix(core_col, vec3(0.95, 1.0, 0.99), m.z * 0.6);
	core_col = mix(core_col, accent_tint.rgb, m.w * 0.5);
	vec3 c = mix(accent.rgb, core_col, m.x);
	c = mix(c, accent_tint.rgb, rim * 0.85);
	COLOR = vec4(c, clamp(m.x + rim * 0.8 + m.y * 0.5, 0.0, 1.0) * alpha);
}
