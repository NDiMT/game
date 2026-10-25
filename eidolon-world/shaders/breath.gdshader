shader_type spatial;
// Breath on the glass: your breath fogs a small mirror, and from the OTHER side a finger writes in the
// condensation. Up to three runes (glyph ids in `glyphs`, -1 = none) are traced one after another as
// `write` goes 0..1; seen from your side, her writing is mirror-reversed (`flip`).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
// v0.8 the two lights, `hers` 0..1 (v0.8.1: both are aqua: palette.gd)
global uniform vec4 her;
global uniform vec4 her_core;
global uniform vec4 her_tint;
uniform float hers = 1.0;
vec3 _ha() { return mix(accent.rgb, her.rgb, hers); }
vec3 _hc() { return mix(accent_core.rgb, her_core.rgb, hers); }
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float fog = 0.0;
uniform float write = 0.0;
uniform vec3 glyphs = vec3(-1.0);
uniform float flip = 1.0;
uniform vec2 size = vec2(1.0, 1.3);
uniform float vertical = 0.0;        // 1: runes stacked top to bottom, 0: in a row

float stroke(vec2 p, int id, float prog) {
	if (id < 0) return 10.0;
	float d = id >= 100 ? 10.0 : rune_core(p, id);
	if (id == 99) {
		// "follow me": a hooked arrow climbing up and to the right
		d = g_seg(p, vec2(-0.45, -0.55), vec2(-0.45, 0.25));
		d = min(d, g_seg(p, vec2(-0.45, 0.25), vec2(0.35, 0.25)));
		d = min(d, g_seg(p, vec2(0.35, 0.25), vec2(0.12, 0.5)));
		d = min(d, g_seg(p, vec2(0.35, 0.25), vec2(0.12, 0.0)));
	}
	// the finger draws from the top down
	float shown = step(1.0 - (p.y * 0.5 + 0.5), prog * 1.15);
	return mix(10.0, d, shown);
}

void fragment() {
	vec2 uv = UV;
	vec2 q = (uv - 0.5) * size;
	float n = texture(noise_tex, uv * vec2(2.6, 3.2) + TIME * 0.01).r;
	float n2 = texture(noise_tex, uv * vec2(9.0, 11.0) - TIME * 0.02).r;
	float edge = smoothstep(0.0, 0.12, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
	float cond = fog * edge * (0.55 + 0.35 * n + 0.15 * n2);
	// her writing: wiped clear lines through the fog, with a faint petrol shimmer in them
	float d = 10.0;
	int count = int(step(-0.5, glyphs.x) + step(-0.5, glyphs.y) + step(-0.5, glyphs.z));
	for (int i = 0; i < 3; i++) {
		float gid = i == 0 ? glyphs.x : (i == 1 ? glyphs.y : glyphs.z);
		if (gid < -0.5) continue;
		float fc = float(count);
		vec2 c = vertical > 0.5 ? vec2(0.0, (float(i) - (fc - 1.0) * 0.5) * -size.y / fc) : vec2((float(i) - (fc - 1.0) * 0.5) * size.x / fc, 0.0);
		float s = vertical > 0.5 ? size.y / fc * 0.42 : min(size.x / fc, size.y) * 0.42;
		vec2 p = (q - c) / s;
		if (flip > 0.5) p.x = -p.x;
		float prog = clamp(write * fc - float(i), 0.0, 1.0);
		d = min(d, stroke(p, int(gid + 0.5), prog) * s);
	}
	float line = 1.0 - smoothstep(0.018, 0.034, d);
	float wipe = 1.0 - smoothstep(0.03, 0.07, d);
	vec3 fogc = vec3(0.86, 0.88, 0.9);
	vec3 c = mix(fogc, _hc(), line * 0.55);
	float a = cond * (1.0 - wipe * 0.85) + line * fog * 0.55;
	ALBEDO = c;
	ALPHA = clamp(a, 0.0, 0.92);
}
