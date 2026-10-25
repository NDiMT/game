shader_type spatial;
// v0.6 "The Other Side's Map": a mural on the Shard Gallery's east wall, readable only through the raised
// shard (global shard_lens). A plan of the gallery for a viewer facing the wall (up = east, left =
// north), drawn as SHE sees it from the other side of the glass: left and right swapped. Its marks:
// the way in from the Hall, the true arch, the veiled statue at the dead end, and the four braziers,
// three of them carrying tally strokes I, II, III (the order to light them). `marks` = the tally count
// of the braziers drawn at map slots (top-left, top-right, bottom-left, bottom-right).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 shard_lens;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
uniform vec4 marks = vec4(1.0, 3.0, 0.0, 2.0);
uniform float pulse = 0.0;          // hint: the arch and the way in (the clues that it is reversed) pulse
uniform vec2 size = vec2(2.4, 1.6);

float sd_box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

void fragment() {
	if (shard_lens.w < 0.5) discard;
	float r = length(FRAGCOORD.xy - shard_lens.xy);
	if (r > shard_lens.z) discard;
	float edge = 1.0 - smoothstep(shard_lens.z * 0.85, shard_lens.z, r);
	// map space in metres on the wall: x right (left = north, mirrored already below), y up (= east)
	vec2 p = vec2((UV.x - 0.5) * size.x, (0.5 - UV.y) * size.y);
	float w = 0.026;
	// the gallery's outline: a long room, its way in (a gap) and its dead end
	float room = abs(sd_box(p, vec2(1.02, 0.5)));
	// (as she draws it: the way in from the Hall is at the RIGHT end of the lower (west) wall)
	float gap_in = sd_box(p - vec2(0.78, -0.5), vec2(0.16, 0.06));
	room = max(room, -gap_in);
	float d = room;
	// the true arch in the upper (east) wall, near the LEFT end (it is near the south end really)
	vec2 ap = p - vec2(-0.62, 0.5);
	float arch = abs(length(vec2(ap.x, max(ap.y + 0.0, 0.0) * 1.4)) - 0.14);
	arch = max(arch, -ap.y - 0.02);
	float hint_k = 1.0 + pulse * 1.5;
	// the veiled statue at the dead end: a small hooded figure, lower left
	vec2 sp = p - vec2(-0.84, -0.3);
	float stat = min(abs(length(sp - vec2(0.0, 0.07)) - 0.045), g_seg(sp, vec2(-0.05, -0.1), vec2(0.0, 0.03)));
	stat = min(stat, g_seg(sp, vec2(0.05, -0.1), vec2(0.0, 0.03)));
	d = min(d, stat);
	// the four braziers: a bowl ring on a short stem; tallies beneath the ones she lit
	vec2 slots[4] = vec2[](vec2(-0.3, 0.2), vec2(0.3, 0.2), vec2(-0.3, -0.2), vec2(0.3, -0.2));
	float m[4] = float[](marks.x, marks.y, marks.z, marks.w);
	float tal = 9.0;
	for (int i = 0; i < 4; i++) {
		vec2 q = p - slots[i];
		d = min(d, abs(length(q) - 0.1));
		d = min(d, g_seg(q, vec2(-0.055, 0.02), vec2(0.055, 0.02)));
		int n = int(m[i] + 0.5);
		for (int k = 0; k < 3; k++) {
			if (k >= n) break;
			float x = (float(k) - float(n - 1) * 0.5) * 0.065;
			tal = min(tal, g_seg(q, vec2(x, -0.14), vec2(x, -0.26)));
		}
	}
	d = min(d, tal);
	vec4 g = carved_glow(d, w);
	vec4 ga = carved_glow(min(arch, gap_in < 0.0 ? 9.0 : 9.0), w);
	float glow_a = clamp(ga.x + ga.y * 0.8, 0.0, 1.0) * hint_k;
	vec3 col = mix(accent.rgb, accent_core.rgb, max(g.x, ga.x));
	float a = clamp(g.x + g.y * 0.75 + glow_a, 0.0, 1.0);
	// a faint wash of light over the whole mural, so it reads as a painted plan
	float wash = (1.0 - smoothstep(0.0, 0.08, sd_box(p, vec2(1.12, 0.66)))) * 0.10;
	ALBEDO = col + accent_core.rgb * pulse * 0.15 * (ga.x + ga.y);
	ALPHA = clamp(a + wash, 0.0, 1.0) * edge;
}
