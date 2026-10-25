shader_type spatial;
// v0.7: small carved-glow marks on the floor. kind 0: a push arrow (chevron, pointing +y of the quad);
// 1: a cell outline (a remembered place); 2: a facing arc (a quarter sweep with a pointer, `sweep` 0..1)
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
// v0.8 the two lights, `hers` 0..1 (v0.8.1: both are aqua: palette.gd)
global uniform vec4 her;
global uniform vec4 her_core;
global uniform vec4 her_tint;
uniform float hers = 0.0;
vec3 _ha() { return mix(accent.rgb, her.rgb, hers); }
global uniform vec4 accent_tint;
vec3 _ht() { return mix(accent_tint.rgb, her_tint.rgb, hers); }
vec3 _hc() { return mix(accent_core.rgb, her_core.rgb, hers); }
uniform float kind = 0.0;
uniform float intensity = 0.0;
uniform float sweep = 0.0;
uniform float fill = 0.0;
uniform float joint = 0.0;          // kind 4: the notch's seam lit (the stone across the joint answers)           // a lit cell: the whole square glows faintly
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	p.y = -p.y;
	float d = 9.0;
	float body = 0.0;
	float wid = 0.05;
	float amul = 1.0;
	// kind 4 (v0.8): an ENGRAVED channel along the quad (no glow), flaring into a notch at the far (+y) edge;
	// `joint` lights a thin aqua seam across the notch
	bool carved = kind > 3.5 && kind < 4.5;
	vec3 c_alb = vec3(0.0);
	float c_a = 0.0;
	if (carved) {
		float hw = p.y > 0.66 ? mix(0.2, 0.62, smoothstep(0.66, 0.97, p.y)) : 0.2;
		float gd = abs(p.x) - hw;
		float groove = (1.0 - smoothstep(-0.03, 0.03, gd)) * smoothstep(-1.0, -0.86, p.y);
		float lip = (1.0 - smoothstep(0.0, 0.07, abs(gd - 0.05))) * smoothstep(-1.0, -0.86, p.y);
		float shade = groove * (0.62 - 0.22 * smoothstep(-0.25, 0.0, gd));
		float seam = joint * (1.0 - smoothstep(0.02, 0.07, abs(p.y - 0.94))) * (1.0 - smoothstep(hw - 0.04, hw + 0.04, abs(p.x)));
		float sg = joint * groove * exp(-max(0.0, 0.94 - p.y) * 7.0);
		c_alb = mix(vec3(0.26, 0.26, 0.255), vec3(0.93, 0.92, 0.89), lip * (1.0 - groove));
		c_alb = mix(c_alb, _hc() * 1.45, clamp(seam + sg * 0.7, 0.0, 1.0));
		c_a = clamp(shade + lip * 0.25 + seam + sg * 0.6, 0.0, 1.0);
	}
	// kind 5 (v0.8, QA P1-6): your watch cone on the floor (a soft 100 deg wedge, faint fill, lit edges)
	bool cone = kind > 4.5;
	if (cone) {
		float r = length(p);
		float an = abs(atan(p.x, p.y));
		float inside = (1.0 - smoothstep(0.85, 1.0, r)) * (1.0 - smoothstep(0.86, 0.88, an));
		float edge = (1.0 - smoothstep(0.0, 0.025, abs(an - 0.8727) * r)) * (1.0 - smoothstep(0.85, 1.0, r)) * smoothstep(0.05, 0.15, r);
		c_alb = mix(_ha(), _hc(), edge);
		c_a = clamp(inside * 0.10 * (1.0 - r * 0.6) + edge * 0.55, 0.0, 1.0);
		carved = true;
	}
	if (kind > 2.5 && kind < 3.5) {
		// an inlaid path: a line along the quad, widening into a notch at the far (+y) end
		d = abs(p.x);
		wid = p.y > 0.78 ? 0.8 : 0.26;
		amul = p.y > 0.78 ? 1.0 : 0.75;
	} else if (kind < 0.5) {
		float ph = fract(TIME * 0.8);
		for (int i = 0; i < 2; i++) {
			float y0 = -0.3 + float(i) * 0.45 + ph * 0.12;
			d = min(d, min(g_seg(p, vec2(-0.45, y0 - 0.25), vec2(0.0, y0 + 0.15)), g_seg(p, vec2(0.45, y0 - 0.25), vec2(0.0, y0 + 0.15))));
		}
	} else if (kind < 1.5) {
		vec2 q = abs(p);
		d = abs(max(q.x, q.y) - 0.86);
		vec2 cq = abs(q - vec2(0.86));
		body = (1.0 - smoothstep(0.84, 0.88, max(q.x, q.y))) * fill;
	} else {
		float r = length(p);
		float an = atan(-p.x, p.y);            // 0 = pointing +y
		float a1 = sweep * 1.5708;
		d = (an >= 0.0 && an <= a1) ? abs(r - 0.8) : 9.0;
		d = min(d, g_seg(p, vec2(0.0), vec2(-sin(a1), cos(a1)) * 0.9));
	}
	// (v0.8.3: floor runes must catch the eye: a thicker line, a brighter core, a slow gentle pulse)
	float fpulse = 0.86 + 0.14 * sin(TIME * 1.6);
	vec4 g = carved_glow(d, wid * 1.35);
	// (v0.8: a luminous inlay: a core past white that the bloom catches, an aqua halo, a quiet tint edge)
	if (carved) { ALBEDO = c_alb; ALPHA = c_a * intensity; }
	else {
	ALBEDO = mix(mix(_ht(), _ha(), 0.7), _hc() * 1.6, g.x) * fpulse;
	ALPHA = clamp((g.x * amul * 1.15 + g.y * 0.8) * intensity * (0.9 + 0.1 * fpulse) + body * 0.35, 0.0, 1.0);
	}
}
