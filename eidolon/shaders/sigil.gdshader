shader_type spatial;
// Floor sigils (kind 0 = cube glyph, gold; 1 = eidolon glyph, cyan; 2 = swipe preview outline).
// Engraved and faintly glowing when empty; when occupied an outer ring SNAPS in around the body
// (larger than the cube, so it is never hidden) and the halo brightens.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled;

uniform float kind = 0.0;
uniform float lit : hint_range(0.0, 1.0) = 0.0;
uniform float snap : hint_range(0.0, 1.0) = 0.0;
uniform vec3 color : source_color = vec3(0.95, 0.85, 0.6);
uniform float alpha_mul = 1.0;
uniform float glyph_scale = 1.0;

float ring(float d, float r, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.02, abs(d - r)); }

void fragment() {
	vec2 p = (UV - 0.5) * 2.0 * glyph_scale;   // glyph in tile units (|p| < 1 = the tile)
	float d = length(p);
	vec2 q = abs(p);
	float m = 0.0;
	float outer = 0.0;
	if (kind < 0.5) {
		m = max(ring(d, 0.80, 0.07), ring(d, 0.64, 0.03));
		float sq = max(q.x, q.y);
		m = max(m, 1.0 - smoothstep(0.03, 0.05, abs(sq - 0.30)));
		m = max(m, 1.0 - smoothstep(0.08, 0.10, d));
		for (int i = 0; i < 4; i++) {
			float an = float(i) * 1.5708 + 0.7854;
			vec2 dir = vec2(cos(an), sin(an));
			float along = dot(p, dir);
			float perp = abs(dot(p, vec2(-dir.y, dir.x)));
			m = max(m, (1.0 - smoothstep(0.02, 0.04, perp)) * step(0.42, along) * step(along, 0.64));
		}
	} else if (kind < 1.5) {
		m = max(ring(d, 0.80, 0.06), ring(d, 0.70, 0.025));
		float dia = q.x + q.y;
		m = max(m, 1.0 - smoothstep(0.03, 0.05, abs(dia - 0.44)));
		m = max(m, 1.0 - smoothstep(0.10, 0.13, d));
		m = max(m, (1.0 - smoothstep(0.02, 0.035, abs(p.y))) * step(q.x, 0.64) * step(0.47, q.x));
		m = max(m, (1.0 - smoothstep(0.02, 0.035, abs(p.x))) * step(q.y, 0.64) * step(0.47, q.y));
	} else {
		float sq = max(q.x, q.y);
		float line = 1.0 - smoothstep(0.05, 0.09, abs(sq - 0.82));
		float corner = step(0.5, min(q.x, q.y));
		m = line * mix(0.45, 1.0, corner) + 0.16 * step(sq, 0.82);
	}
	float a;
	vec3 c;
	if (kind < 1.5) {
		m *= step(d, 1.0);
		// outer locking ring + notches, scaled in by `snap`
		float s = 1.0 + (1.0 - snap) * 0.45;
		float dd = d / s;
		outer = ring(dd, 1.40, 0.15) + ring(dd, 1.62, 0.05) * 0.9;
		float an = atan(p.y, p.x);
		float notch = (1.0 - smoothstep(0.06, 0.11, abs(sin(an * 2.0 + 0.7854)))) * step(1.42, dd) * step(dd, 1.72);
		outer = max(outer, notch) * snap;
		float halo = (1.0 - smoothstep(0.3, 1.8, d)) * (0.10 + lit * 0.30);
		float breathe = 0.85 + 0.15 * sin(TIME * 1.8 + kind * 2.0);
		c = mix(color * 0.75, mix(color, vec3(1.0), 0.25), lit);
		a = m * mix(0.72 * breathe, 1.0, lit) + outer + halo;
	} else {
		c = color;
		a = m;
	}
	ALBEDO = c;
	ALPHA = clamp(a * alpha_mul, 0.0, 1.0);
}
