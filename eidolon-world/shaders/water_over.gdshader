shader_type spatial;
// Over the pool and its reflection: drifting sheen, soft rings from drops and from the wanderer's steps,
// sparkling glints (a faint layer, so the reflection stays clear but lives in the water).
// v1.0 (Agent A): splash / rising-body events (water_fx.gdshaderinc: rings, the bulge's sheen, white water),
// normal-like shading of the rings (a lit crest and a darker trough rather than a plain alpha line).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec3 player_pos;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec4 area = vec4(-4.0, -0.1, -0.8, 3.4);   // where drops fall (x0, z0, x1, z1)
uniform float calm = 0.0;                          // 1 = the water has gone completely still
uniform vec3 ring_c = vec3(0.0);                   // a ripple spreading from here (cinematic)
uniform float ring_t = -1.0;                       // seconds since it began (< 0 = none)
uniform float disc = 0.0;
#include "res://shaders/water_fx.gdshaderinc"
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	if (disc > 0.5 && length(UV - 0.5) > 0.5) discard;
	vec2 p = wp.xz;
	float rings = 0.0;
	for (int i = 0; i < 4; i++) {
		float fi = float(i);
		float period = 3.0 + fi * 1.3;
		float t = TIME + fi * 1.7;
		float cyc = floor(t / period);
		float age = fract(t / period) * period;
		vec2 c = mix(area.xy, area.zw, vec2(hash(vec2(cyc, fi)), hash(vec2(fi, cyc + 3.0))));
		float r = length(p - c);
		float front = age * 0.45;
		rings += sin((r - front) * 26.0) * exp(-pow((r - front) * 6.0, 2.0)) * exp(-age * 0.9);
	}
	float rp = length(p - player_pos.xz);
	rings += sin(rp * 22.0 - TIME * 5.0) * exp(-rp * 1.2) * 0.35 * (1.0 - smoothstep(0.0, 2.5, rp));
	rings *= 1.0 - calm;
	if (ring_t >= 0.0) {
		float rr = length(p - ring_c.xz);
		float fr = ring_t * 0.55;
		rings += sin((rr - fr) * 18.0) * exp(-pow((rr - fr) * 3.5, 2.0)) * exp(-ring_t * 0.3) * 3.6;
	}
	float a1 = texture(noise_tex, p * 0.09 + TIME * vec2(0.004, 0.002)).r;
	float a2 = texture(noise_tex, p * 0.21 - TIME * vec2(0.003, 0.006)).r;
	float sheen = smoothstep(0.55, 0.8, a1 * 0.6 + a2 * 0.5);
	float g = texture(noise_tex, p * 1.7 + vec2(TIME * 0.05, -TIME * 0.04)).r * texture(noise_tex, p * 2.3 - vec2(TIME * 0.06, TIME * 0.03)).r;
	float glint = smoothstep(0.50, 0.56, g);
	float nz = texture(noise_tex, p * 0.9 + TIME * vec2(0.02, -0.015)).r;
	float hE, foamE, bulge;
	wfx_events(p, nz, hE, foamE, bulge);
	rings += hE * 2.2;
	// crests lit, troughs a little darker (a hint of a normal): the overlay colour follows the ring's sign
	float crest = clamp(rings, -1.0, 1.0);
	vec3 col = mix(vec3(0.42, 0.47, 0.5), vec3(0.88, 0.91, 0.92), 0.5 + 0.5 * crest);
	float a = clamp(sheen * 0.16 + abs(rings) * 0.16 + glint * 0.5 * (1.0 - calm * 0.6), 0.0, 0.7);
	a = max(a, bulge * 0.28);
	col = mix(col, vec3(0.94, 0.96, 0.96), clamp(foamE, 0.0, 1.0));
	a = max(a, clamp(foamE, 0.0, 1.0) * 0.85);
	col = mix(col, vec3(0.86, 0.89, 0.9), glint * 0.7);
	ALBEDO = col;
	ALPHA = a;
}
