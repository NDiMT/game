shader_type spatial;
// Engraved lines of the unknown script on a stele, wall or floor slab, CARVED GLOW: light comes from
// inside the grooves (a bright core along each stroke), blooms softly onto the stone around them, and
// the groove walls keep a thin bevel (a highlight on one side, a quiet tint on the other) so it still
// reads as cut stone. It brightens as the wanderer comes near (`near`). Never a dark fill.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/script.gdshaderinc"
uniform float seed = 1.0;
uniform float rows = 4.0;
uniform float cols = 7.0;
uniform float aspect = 1.0;
uniform float near = 0.0;
void fragment() {
	vec2 uv = (UV - 0.5) * 1.16 + 0.5;      // (v0.8: a margin, so the capital's glow is never cut)
	uv.x = 1.0 - uv.x;          // carved MIRRORED: letters reversed, lines running right to left
	                            // (only a mirror shows them the way they were written)
	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
	float d = script_dist(uv, seed, rows, cols, aspect);
	float w = 0.034;
	vec4 m = script_glow(d, w);
	float pulse = 0.9 + 0.1 * sin(TIME * 1.3 + seed);
	float glow = mix(0.6, 1.0, near) * pulse;
	float inner = 1.0 - clamp(d / w, 0.0, 1.0);
	vec3 core_col = mix(accent.rgb, accent_core.rgb, smoothstep(0.1, 0.75, inner) * glow);
	core_col = mix(core_col, vec3(1.0, 0.95, 0.93), m.z * 0.7);        // the lit wall of the groove
	core_col = mix(core_col, accent_tint.rgb, m.w * 0.55);             // the other wall, in its own light
	vec3 c = mix(accent.rgb, core_col, m.x);
	ALBEDO = c * (1.0 + 0.15 * near);
	ALPHA = clamp(m.x * (0.82 + 0.18 * glow) + m.y * glow * 0.55, 0.0, 1.0);
}
