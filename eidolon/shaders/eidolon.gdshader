shader_type spatial;
// The Eidolon: a translucent cold-cyan ghost. Deep teal body for contrast on pale marble, bright edge
// highlight, fresnel rim, inner glow, vertical ghost shimmer, and the cube's engraved designs MIRRORED.
// `glitch` flashes and distorts it when it is blocked while the cube moves (the de-sync tell).
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;
#include "res://shaders/glyphs.gdshaderinc"

uniform vec3 tint : source_color = vec3(0.0, 0.40, 0.56);
uniform vec3 hi : source_color = vec3(0.62, 1.0, 1.0);
uniform float half_size = 0.45;
uniform float strength = 1.0;
uniform float pulse = 0.0;
uniform float shimmer = 0.0;
uniform float glitch = 0.0;
uniform float core = 0.0;            // 1 for the small inner core cube
uniform float glyph_seed = 0.0;
uniform vec3 mirror_axis = vec3(-1.0, 1.0, 1.0);

varying vec3 op;
varying vec3 wp;

float hash(float x) { return fract(sin(x * 91.17) * 43758.5453); }

void vertex() {
	op = VERTEX;
	float t = TIME;
	float g = step(0.975, hash(floor(t * 7.0))) * 0.5 + glitch;
	VERTEX.x += g * 0.05 * sin(VERTEX.y * 37.0 + t * 70.0);
	VERTEX.z += glitch * 0.05 * cos(VERTEX.y * 23.0 - t * 50.0);
	VERTEX *= 1.0 + pulse * 0.08 + shimmer * 0.04 * sin(t * 40.0 + VERTEX.y * 12.0) + glitch * 0.06;
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 a = abs(op);
	float mx = max(a.x, max(a.y, a.z));
	float mid = a.x + a.y + a.z - mx - min(a.x, min(a.y, a.z));
	float edge = smoothstep(half_size - 0.045, half_size - 0.004, mid);
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
	// vertical ghost shimmer: slow rising bands, never dark enough to hide the body
	float scan = 0.9 + 0.1 * sin(wp.y * 60.0 - TIME * 4.0);
	float band = smoothstep(0.9, 1.0, sin(wp.y * 3.0 - TIME * 1.6)) * 0.25;
	float flick = 0.94 + 0.06 * sin(TIME * 21.0 + sin(TIME * 6.3) * 3.0);
	vec2 gl = core > 0.5 ? vec2(0.0) : glyph_lines(op * mirror_axis, half_size, glyph_seed);
	float al = 0.56 + fres * 0.30 + edge * 0.9 + gl.x * 0.9 + gl.y * 0.45 + band;
	al = clamp((al * scan * flick) * strength + pulse * 0.3 + shimmer * 0.2 + glitch * 0.4, 0.0, 0.97);
	vec3 c = mix(tint, hi, clamp(edge * 0.85 + fres * 0.35 + gl.y * 0.8 + band + pulse * 0.5 + glitch * 0.7, 0.0, 1.0));
	c = mix(c, vec3(0.92, 1.0, 1.0), gl.x);
	if (core > 0.5) { c = hi; al = (0.75 + 0.25 * sin(TIME * 2.3)) * strength; }
	ALBEDO = c * (1.0 + pulse * 0.6);
	ALPHA = al;
}
