shader_type canvas_item;
// The reading card: the same text as the engraving (same seed), large, on a pale stone panel.
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/script.gdshaderinc"
uniform float seed = 1.0;
uniform float rows = 4.0;
uniform float cols = 7.0;
uniform float aspect = 1.0;
uniform float alpha = 1.0;
void fragment() {
	vec2 uv = UV;
	float d = script_dist(uv, seed, rows, cols, aspect);
	float aa = max(fwidth(d), 0.001);
	float w = 0.028;
	float core = 1.0 - smoothstep(w - aa, w + aa, d);
	float halo = exp(-max(d - w, 0.0) * 16.0) * (1.0 - core);
	vec3 ink = mix(vec3(0.12, 0.13, 0.14), accent.rgb, 0.55);
	COLOR = vec4(mix(ink, accent_core.rgb, 0.2), clamp(core + halo * 0.55, 0.0, 1.0) * alpha);
	COLOR.rgb = mix(accent.rgb, COLOR.rgb, core);
}
