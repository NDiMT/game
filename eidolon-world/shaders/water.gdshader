shader_type spatial;
// Shallow reflecting pool, v0.3: OPAQUE still water mirroring the fog (the opaque reflection of the
// wanderer stands on it); its ripples, sheen and glints are drawn by water_over above the reflection.
// v1.0 (Agent A): normal-mapped ripples (two scrolling layers + the splash / rising-body events of
// water_fx.gdshaderinc), a fresnel sky sheen, depth darkening (pale stone in the shallows, deep in the
// middle, a dark line under the rim), soft broken shoreline foam.
render_mode unshaded, cull_back, shadows_disabled;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.34, 0.38, 0.41);
uniform vec3 sky : source_color = vec3(0.70, 0.72, 0.73);
uniform vec3 shallow : source_color = vec3(0.50, 0.50, 0.47);   // pale stone seen through the shallows
uniform float disc = 0.0;         // 1: a round pool (the shrine's)
uniform float shore = 0.10;       // the shallow band, in UV
uniform float foam_k = 1.0;       // shoreline foam (0: none)
uniform float ripple_k = 1.0;     // ripple strength (0: glassy still)
uniform vec3 sun_dir = vec3(0.304, -0.819, -0.486);   // the key light's direction (world.gd's sun)
uniform float glint_k = 1.0;
#include "res://shaders/water_fx.gdshaderinc"
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float rh(vec2 q) {
	return texture(noise_tex, q * 0.55 + TIME * vec2(0.012, 0.008)).r * 0.6
		+ texture(noise_tex, q * 1.35 - TIME * vec2(0.01, 0.017)).r * 0.4;
}
void fragment() {
	if (disc > 0.5 && length(UV - 0.5) > 0.5) discard;
	vec2 p = wp.xz;
	float a1 = texture(noise_tex, p * 0.07 + TIME * vec2(0.003, 0.002)).r;
	float nz = texture(noise_tex, p * 0.9 + TIME * vec2(0.02, -0.015)).r;
	// ripples: slopes of a small scrolling height field, plus the events
	float hE, foamE, bulge;
	wfx_events(p, nz, hE, foamE, bulge);
	float e = 0.05;
	vec2 g = vec2(rh(p + vec2(e, 0.0)) - rh(p - vec2(e, 0.0)), rh(p + vec2(0.0, e)) - rh(p - vec2(0.0, e))) / (2.0 * e);
	g *= 0.05 * ripple_k;
	vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
	vec3 V = normalize(CAMERA_POSITION_WORLD - wp);
	float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
	vec3 R = reflect(-V, N);
	vec3 skyc = mix(sky * 0.9, sky * 1.07, smoothstep(-0.1, 0.7, R.y));
	// depth: pale stone in the shallows, deep in the middle; a dark line right under the rim (its shadow)
	float em = disc > 0.5 ? 0.5 - length(UV - 0.5) : min(min(UV.x, 1.0 - UV.x), min(UV.y, 1.0 - UV.y));
	float depth = smoothstep(0.0, shore * 3.0, em + (a1 - 0.5) * 0.04);
	vec3 body = mix(shallow, deep, depth) * (0.95 + 0.1 * a1);
	float sheen = clamp(0.4 + F * 1.8 + (a1 - 0.5) * 0.25, 0.0, 0.8);
	vec3 c = mix(body, skyc, sheen);
	c = mix(c, deep * 0.62, (1.0 - smoothstep(0.0, shore * 0.35, em)) * 0.65);
	// the event ripples catch the light (a bright crest, a dark trough), the bulge glows a little
	c *= 1.0 + 0.12 * clamp(hE, -1.0, 1.0);
	c += vec3(0.05) * bulge;
	// the sun's glitter on the ripples (sharp, sparse, brighter on the event rings)
	vec3 Rg = reflect(-V, normalize(vec3(-g.x * 3.0, 1.0, -g.y * 3.0) + vec3(0.0, 0.0, 0.0)));
	float gl = pow(max(dot(Rg, -sun_dir), 0.0), 220.0) * (0.6 + 0.4 * abs(hE));
	c += vec3(1.0, 0.96, 0.88) * min(gl, 1.0) * 0.55 * glint_k;
	// soft shoreline foam, broken and drifting, plus the events' white water
	float sf = (1.0 - smoothstep(0.0, shore * 0.55, em + (nz - 0.5) * 0.035)) * smoothstep(0.42, 0.72, texture(noise_tex, p * 2.4 + TIME * vec2(0.03, 0.02)).r);
	float foam = clamp(sf * 0.45 * foam_k + foamE, 0.0, 1.0);
	c = mix(c, vec3(0.9, 0.92, 0.92), foam * 0.8);
	ALBEDO = c;
}
