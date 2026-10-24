shader_type spatial;
// The hooded figure: vertex-coloured low-poly cloth (COLOR.a = emissive: the hem stripe), UV.x = 1 on
// the featureless marble face (faint chisel marks).
render_mode cull_disabled, shadows_disabled;
#include "res://shaders/figure_deform.gdshaderinc"

uniform float glint = 1.0;          // hem stripe brightness (rises with each shrine)
varying vec3 lp;
varying float marble;
uniform vec3 glow_col : source_color = vec3(0.35, 0.95, 1.0);

void vertex() {
	VERTEX = cloak_deform(VERTEX);
	lp = VERTEX;
	marble = UV.x;
}

void fragment() {
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 3.0);
	// simple wrap lighting baked in (the figure does not receive shadows: no acne on the folds)
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	float key = clamp(dot(wn, normalize(vec3(-0.45, 0.8, 0.35))) * 0.5 + 0.5, 0.0, 1.0);
	ALBEDO = COLOR.rgb * mix(0.75, 1.15, key) + vec3(0.06, 0.07, 0.08) * fres;
	if (marble > 0.5) {
		// pale marble, smooth and blind; faint chisel strokes running across it
		float ch = sin(lp.y * 160.0 + sin(lp.x * 40.0) * 2.0) * 0.5 + 0.5;
		float ch2 = sin((lp.x + lp.y) * 210.0) * 0.5 + 0.5;
		ALBEDO = COLOR.rgb * (0.94 + 0.05 * ch + 0.03 * ch2);
	}
	ROUGHNESS = 0.9;
	SPECULAR = 0.15;
	EMISSION = glow_col * COLOR.a * glint * 2.4;
}
