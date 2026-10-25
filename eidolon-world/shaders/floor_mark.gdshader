shader_type spatial;
// v0.7: small carved-glow marks on the floor. kind 0: a push arrow (chevron, pointing +y of the quad);
// 1: a cell outline (a remembered place); 2: a facing arc (a quarter sweep with a pointer, `sweep` 0..1)
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
uniform float kind = 0.0;
uniform float intensity = 0.0;
uniform float sweep = 0.0;
uniform float fill = 0.0;           // a lit cell: the whole square glows faintly
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	p.y = -p.y;
	float d = 9.0;
	float body = 0.0;
	float wid = 0.05;
	float amul = 1.0;
	if (kind > 2.5) {
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
	vec4 g = carved_glow(d, wid);
	// (a petrol inlay, darker at its core: it reads on pale stone and on the dark hall floor alike)
	ALBEDO = mix(accent.rgb, accent.rgb * 0.55, g.x) + accent_core.rgb * g.y * 0.15;
	ALPHA = clamp((g.x * amul * 0.95 + g.y * 0.6) * intensity + body * 0.35, 0.0, 1.0);
}
