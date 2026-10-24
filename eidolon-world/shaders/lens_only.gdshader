shader_type spatial;
// Seen only through the raised MIRROR SHARD: a circular lens on screen (global `lens`: centre x, y,
// radius in render-target pixels, on). kind 0: a glowing rune (design), 1: an opaque patch of plain
// stone (a false doorway is really a wall), 2: the soft glowing outline of a real archway.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 shard_lens;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float kind = 0.0;
uniform float design = 1.0;
uniform float flip = 0.0;
void fragment() {
	if (shard_lens.w < 0.5) discard;
	float r = length(FRAGCOORD.xy - shard_lens.xy);
	if (r > shard_lens.z) discard;
	float edge = 1.0 - smoothstep(shard_lens.z * 0.85, shard_lens.z, r);
	if (kind < 0.5) {
		vec2 p = (UV - 0.5) * 2.3;
		if (flip > 0.5) p.x = -p.x;
		vec2 m = rune_mask(rune_dist(vec2(p.x, -p.y), int(design + 0.5)));
		ALBEDO = mix(accent.rgb, accent_core.rgb, m.x);
		ALPHA = clamp(m.x + m.y * 0.8, 0.0, 1.0) * edge;
	} else if (kind < 1.5) {
		float n = texture(noise_tex, UV * vec2(1.5, 2.5)).r;
		ALBEDO = vec3(0.56, 0.55, 0.53) * (0.85 + 0.25 * n);
		ALPHA = edge;
	} else {
		vec2 p = (UV - vec2(0.5, 0.0)) * vec2(2.0, 1.0);
		float arch = abs(length(vec2(p.x, max(p.y - 0.7, 0.0) * 1.6)) - 0.92);
		arch = min(arch, max(abs(abs(p.x) - 0.92), 0.0) + step(0.7, p.y) * 10.0);
		float line = exp(-arch * 30.0);
		float inner = (1.0 - smoothstep(0.85, 0.92, length(vec2(p.x, max(p.y - 0.7, 0.0) * 1.6)))) * step(abs(p.x), 0.92);
		ALBEDO = mix(accent.rgb, accent_core.rgb, line);
		ALPHA = clamp(line * 0.9 + inner * 0.18, 0.0, 1.0) * edge;
	}
}
