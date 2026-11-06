shader_type spatial;
// Seen only through the raised MIRROR SHARD: a circular lens on screen (global `lens`: centre x, y,
// radius in render-target pixels, on). kind 0: a glowing rune (design), 1: an opaque patch of plain
// stone (a false doorway is really a wall), 2: the soft glowing outline of a real archway, 3 (v2.0 A, W.4): an
// eight-pointed star carved in a stone ceiling, its incised lines lit crimson from within, light pulsing outward.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 shard_lens;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float kind = 0.0;
uniform float design = 1.0;
uniform float flip = 0.0;
float sd_box(vec2 p, float b) { vec2 d = abs(p) - vec2(b); return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
// the carved star: line strength (incised strokes) and glow, in -1..1
vec2 star8(vec2 p, float t) {
	float r = length(p), an = atan(p.y, p.x);
	vec2 q = vec2(p.x - p.y, p.x + p.y) * 0.70710678;
	float s1 = sd_box(p, 0.5), s2 = sd_box(q, 0.5);
	float d = min(abs(s1), abs(s2));                                   // the two squares: the {8/2} star
	d = min(d, abs(min(s1, s2)) + 0.004);                               // its outer outline
	float sp = abs(sin(an * 4.0)) * r;                                  // eight rays to the points
	d = min(d, max(sp, step(0.708, r) * 9.0 + step(r, 0.14) * 9.0));
	d = min(d, abs(r - 0.86));                                          // the ring round it
	d = min(d, abs(r - 0.14));                                          // the heart
	float dots = length(vec2(fract(an / 6.2831853 * 16.0 + 0.5) - 0.5, (r - 0.95) * 2.0)) * 0.33;   // sixteen studs
	d = min(d, dots - 0.008);
	float line = 1.0 - smoothstep(0.016, 0.032, d);
	float pulse = exp(-pow((r - fract(t * 0.22) * 1.1) * 6.0, 2.0));     // light running outward along the cuts
	float glow = exp(-d * 16.0) * (0.55 + 0.45 * pulse);
	// the star's body: a soft light filling it, brighter toward the heart and the eight tips
	float inside = 1.0 - smoothstep(-0.01, 0.01, min(s1, s2));
	float tips = pow(abs(cos(an * 4.0)), 6.0) * smoothstep(0.3, 0.7, r);
	glow = max(glow, inside * (0.28 + 0.35 * (1.0 - r) + 0.3 * tips) * (0.8 + 0.2 * pulse));
	return vec2(line, glow);
}
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
	} else if (kind > 2.5) {
		vec2 p = (UV - 0.5) * 2.0;
		if (length(p) > 1.0) discard;
		vec2 m = star8(p, TIME);
		float core = 1.0 - smoothstep(0.0, 0.14, length(p));
		// carved: the cuts burn rose-white at their core, crimson round them; the stone between glows faintly
		ALBEDO = mix(accent.rgb * 0.85, accent_core.rgb, clamp(m.x * 0.9 + core * 0.6, 0.0, 1.0));
		ALPHA = clamp(m.x + m.y * 0.75 + core * 0.4, 0.0, 1.0) * edge;
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
