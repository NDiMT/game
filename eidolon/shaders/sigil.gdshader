shader_type spatial;
// Carved floor sigils (kind 0 = cube glyph, 1 = eidolon glyph, 2 = preview outline). Lit when occupied.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled;

uniform float kind = 0.0;
uniform float lit : hint_range(0.0, 1.0) = 0.0;
uniform vec3 color : source_color = vec3(0.95, 0.85, 0.6);
uniform float alpha_mul = 1.0;
uniform float glyph_scale = 1.0;

float ring(float d, float r, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.012, abs(d - r)); }

void fragment() {
	vec2 p = (UV - 0.5) * 2.0 * glyph_scale;   // glyph drawn in tile units; sigil quads are larger for the lit ring
	float lit_ring = 0.0;
	float d = length(p);
	float m = 0.0;
	if (kind < 0.5) {
		m = max(ring(d, 0.78, 0.05), ring(d, 0.64, 0.02));
		vec2 q = abs(p);
		float sq = max(q.x, q.y);
		m = max(m, 1.0 - smoothstep(0.025, 0.04, abs(sq - 0.30)));
		for (int i = 0; i < 4; i++) {
			float an = float(i) * 1.5708 + 0.7854;
			vec2 dir = vec2(cos(an), sin(an));
			float along = dot(p, dir);
			float perp = abs(dot(p, vec2(-dir.y, dir.x)));
			m = max(m, (1.0 - smoothstep(0.015, 0.03, perp)) * step(0.45, along) * step(along, 0.6));
		}
	} else if (kind < 1.5) {
		m = max(ring(d, 0.78, 0.04), ring(d, 0.70, 0.015));
		vec2 q = abs(p);
		float dia = q.x + q.y;
		m = max(m, 1.0 - smoothstep(0.02, 0.035, abs(dia - 0.42)));
		m = max(m, 1.0 - smoothstep(0.10, 0.12, d));
		m = max(m, (1.0 - smoothstep(0.012, 0.026, abs(p.y))) * step(q.x, 0.62) * step(0.47, q.x));
	} else {
		vec2 q = abs(p);
		float sq = max(q.x, q.y);
		float line = 1.0 - smoothstep(0.05, 0.09, abs(sq - 0.82));
		float corner = step(0.5, min(q.x, q.y));
		m = line * mix(0.45, 1.0, corner) + 0.16 * step(sq, 0.82);
	}
	if (kind < 1.5) {
		// outer ring + four notches that only appear when the sigil is lit (visible around the body)
		lit_ring = ring(d, 1.30, 0.06) + ring(d, 1.42, 0.02) * 0.7;
		float an = atan(p.y, p.x);
		float notch = (1.0 - smoothstep(0.05, 0.09, abs(sin(an * 2.0 + 0.7854)))) * step(1.30, d) * step(d, 1.52);
		lit_ring = max(lit_ring, notch);
		m = max(m * step(d, 1.0), lit_ring * lit);
	}
	float halo = (1.0 - smoothstep(0.2, 1.5, d)) * lit * 0.25;
	vec3 carved = vec3(0.18, 0.17, 0.16);
	vec3 c = mix(carved, color, lit);
	ALBEDO = c;
	ALPHA = clamp((m * mix(0.55, 1.0, lit) + halo) * alpha_mul, 0.0, 1.0);
}
