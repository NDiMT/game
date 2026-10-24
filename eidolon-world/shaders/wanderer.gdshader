shader_type spatial;
// The wanderer: textured, normal-mapped charcoal cloak, cracked marble face, a petrol hem stripe,
// dormant rune embroidery at the hood rim and cuffs (lit one by one as shrines wake), a cool rim of
// fog light round the silhouette.
render_mode cull_disabled, shadows_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/figure_detail.gdshaderinc"
#include "res://shaders/wanderer.gdshaderinc"

varying vec4 vcol;
varying vec2 vuv2;

void vertex() {
	VERTEX = wanderer_deform(VERTEX, COLOR);
	vcol = COLOR;
	vuv2 = UV2;
}

void fragment() {
	vec3 alb = wanderer_albedo(UV, vcol.b);
	float face = vcol.b;
	vec3 emb = embroidery(vuv2);
	alb = mix(alb, vec3(0.27, 0.28, 0.30), emb.x * 0.6 * (1.0 - emb.z));
	alb = mix(alb, accent_core.rgb, emb.x * emb.z * 0.6);
	float hs = hem_stripe(vcol.r);
	alb = mix(alb, accent.rgb * 0.8, hs * 0.7);
	ALBEDO = alb;
	NORMAL_MAP = texture(normal_tex, UV).rgb;
	ROUGHNESS = mix(0.88, 0.55, face);
	SPECULAR = mix(0.18, 0.35, face);
	float rim = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.6);
	EMISSION = accent_core.rgb * (hs * glint * 1.5 + (emb.x * 1.4 + emb.y * 0.35) * emb.z)
		+ vec3(0.42, 0.50, 0.60) * rim * 0.5 * (1.0 - face);
}
