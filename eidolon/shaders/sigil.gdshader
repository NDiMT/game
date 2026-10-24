shader_type spatial;
// Floor sigils in the rune language (kind 0 = cube goal, gold; 1 = Eidolon goal, cyan; 2 = swipe
// preview outline). Each goal shows the rune that faces UP on its body when it arrives along the
// intended path. Engraved and glowing when empty; when occupied an outer ring SNAPS in around the body
// (larger than the cube, so it is never hidden) and everything brightens.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled;
#include "res://shaders/glyphs.gdshaderinc"

uniform float kind = 0.0;
uniform float lit : hint_range(0.0, 1.0) = 0.0;
uniform float snap : hint_range(0.0, 1.0) = 0.0;
uniform vec3 color : source_color = vec3(0.95, 0.85, 0.6);
uniform float alpha_mul = 1.0;
uniform float glyph_scale = 1.0;
uniform float design = 0.0;
uniform float mirror = 0.0;

float ring(float d, float r, float w) {
	float x = abs(d - r);
	float aa = max(fwidth(d), 0.004);
	return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, x);
}

void fragment() {
	vec2 p = (UV - 0.5) * 2.0 * glyph_scale;   // tile units (|p| < 1 = the tile)
	float d = length(p);
	vec2 q = abs(p);
	if (kind > 1.5) {
		float sq = max(q.x, q.y);
		float line = 1.0 - smoothstep(0.05, 0.09, abs(sq - 0.82));
		float corner = step(0.5, min(q.x, q.y));
		ALBEDO = color;
		ALPHA = clamp((line * mix(0.45, 1.0, corner) + 0.16 * step(sq, 0.82)) * alpha_mul, 0.0, 1.0);
	} else {
		// the rune, engraved into the slab
		vec2 rp = p / 0.86;
		if (mirror > 0.5) rp.x = -rp.x;
		float rd = rune_dist(vec2(rp.x, -rp.y), int(design + 0.5));
		vec2 rm = rune_mask(rd);
		// outer locking ring + notches, scaled in by `snap`
		float s = 1.0 + (1.0 - snap) * 0.45;
		float dd = d / s;
		float outer = ring(dd, 1.40, 0.14) + ring(dd, 1.62, 0.05) * 0.9;
		float an = atan(p.y, p.x);
		float notch = (1.0 - smoothstep(0.06, 0.11, abs(sin(an * 2.0 + 0.7854)))) * step(1.42, dd) * step(dd, 1.74);
		outer = max(outer, notch) * snap;
		float breathe = 0.85 + 0.15 * sin(TIME * 1.6 + kind * 2.0);
		float halo = (1.0 - smoothstep(0.2, 1.7, d)) * (0.12 + lit * 0.32);
		vec3 deep = color * 0.62;                       // engraved groove
		vec3 hot = mix(color, vec3(1.0, 0.98, 0.9), 0.45);
		vec3 c = mix(deep, color, rm.y * 0.8);
		c = mix(c, mix(color, hot, lit), rm.x);
		c = mix(c, hot, outer * 0.6);
		float a = rm.x * mix(0.85 * breathe, 1.0, lit) + rm.y * mix(0.45, 0.8, lit) * breathe + outer + halo;
		ALBEDO = c;
		ALPHA = clamp(a * alpha_mul, 0.0, 1.0);
	}
}
