shader_type spatial;
// Engraved lines of the unknown script on a stele, wall or floor slab: dark grooves with a faint petrol
// glow inside them that brightens as the wanderer comes near (`near`).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/script.gdshaderinc"
uniform float seed = 1.0;
uniform float rows = 4.0;
uniform float cols = 7.0;
uniform float aspect = 1.0;
uniform float near = 0.0;
void fragment() {
	vec2 uv = (UV - 0.5) * 1.12 + 0.5;
	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
	float d = script_dist(uv, seed, rows, cols, aspect);
	float aa = max(fwidth(d), 0.002);
	float w = 0.03;
	float core = 1.0 - smoothstep(w - aa, w + aa, d);
	float halo = exp(-max(d - w, 0.0) * 22.0) * (1.0 - core);
	// the groove: dark stone, its far lip catching the light
	float lip = (1.0 - smoothstep(w, w + aa * 2.0 + 0.01, abs(d - w * 1.6))) * (1.0 - core);
	float pulse = 0.85 + 0.15 * sin(TIME * 1.3 + seed);
	float glow = mix(0.35, 1.0, near) * pulse;
	vec3 groove = mix(vec3(0.22, 0.22, 0.23), accent.rgb, glow * 0.75);
	groove = mix(groove, accent_core.rgb, glow * near * 0.45);
	vec3 c = mix(vec3(0.95, 0.94, 0.9), groove, core);
	ALBEDO = mix(c, accent.rgb, halo * glow * 0.5);
	ALPHA = clamp(core * 0.95 + lip * 0.25 + halo * glow * 0.35, 0.0, 1.0);
}
