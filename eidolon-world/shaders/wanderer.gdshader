shader_type spatial;
// The wanderer: textured, normal-mapped charcoal cloak, cracked marble face, a cool rim of fog light
// round the silhouette. (v0.8.1: the hem stripe and the rune embroidery are gone: the hero is plain dark.)
render_mode cull_disabled, shadows_disabled;
// v0.8: the hero marks its visible pixels, so its x-ray never draws over the model itself
stencil_mode write, compare_always, 1;
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
	// (v0.8.1, the owner: the hero wears NO colour: no hem stripe, no lit runes at the hood rim or the
	// cuffs, no aqua emission; only the dark cloth and the marble face)
	// v0.8: opaque, double-sided cloth: the inside of the hood and the cloak is dark cloth, never see-through
	if (!FRONT_FACING) { alb *= 0.32; }
	ALBEDO = alb;
	NORMAL_MAP = texture(normal_tex, UV).rgb;
	ROUGHNESS = mix(0.88, 0.55, face);
	SPECULAR = mix(0.18, 0.35, face);
	float rim = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.6);
	EMISSION = vec3(0.42, 0.50, 0.60) * rim * 0.5 * (1.0 - face) * (FRONT_FACING ? 1.0 : 0.0);    // (the fog's cool rim light)
}
