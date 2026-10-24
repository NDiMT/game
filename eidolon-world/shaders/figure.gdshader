shader_type spatial;
// The hooded figure: vertex-coloured low-poly cloth (COLOR.a = emissive: the hem stripe), UV.x = 1 on
// the featureless marble face (faint chisel marks).
render_mode cull_disabled, shadows_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/figure_deform.gdshaderinc"
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/figure_detail.gdshaderinc"

uniform float glint = 1.0;          // hem stripe brightness (rises with each shrine)
varying vec3 lp;
varying vec2 vuv;


void vertex() {
	VERTEX = cloak_deform(VERTEX, UV);
	lp = VERTEX;
	vuv = UV;
}

void fragment() {
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 3.0);
	// simple wrap lighting baked in (the figure does not receive shadows: no acne on the folds)
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	float key = clamp(dot(wn, normalize(vec3(-0.45, 0.8, 0.35))) * 0.5 + 0.5, 0.0, 1.0);
	ALBEDO = COLOR.rgb * mix(0.75, 1.15, key) + vec3(0.06, 0.07, 0.08) * fres;
	vec3 emb = embroidery(vuv);
	if (vuv.x > 0.5 && vuv.x < 1.5) {
		ALBEDO = COLOR.rgb * face_shade(lp - vec3(0.0, 0.14, -0.022));
	}
	// dormant thread: thin, a little lighter than the cloth; awake runes glow faint cyan
	ALBEDO = mix(ALBEDO, vec3(0.30, 0.31, 0.33), emb.x * 0.55 * (1.0 - emb.z));
	ALBEDO = mix(ALBEDO, accent_core.rgb, emb.x * emb.z * 0.6);
	ROUGHNESS = 0.9;
	SPECULAR = 0.15;
	EMISSION = accent_core.rgb * (COLOR.a * glint * 2.4 + (emb.x * 1.4 + emb.y * 0.35) * emb.z);
	// a cool rim of fog light round the silhouette
	float rim = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.6);
	EMISSION += vec3(0.42, 0.50, 0.60) * rim * 0.55 * (1.0 - step(0.5, vuv.x) * step(vuv.x, 1.5));
}
