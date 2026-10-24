shader_type spatial;
// Reflection puppet (v0.3: OPAQUE). The mirrored copy of the figure stands at the reflected world
// position; when `project` is on, every vertex is slid along the view ray onto the mirror plane
// (identical on screen for an orthographic camera) so it depth-tests like a real reflection, and
// fragments outside the glass / pool rectangle are clipped. No transparency: it reads as a reflection
// through a slight cool grade and lower contrast, while the glass / water draws its own sheen over it.
// `vis` fades it in and out with a dither (never a see-through figure). `ghost` = 1 for the eidolon
// beyond the great glass: petrol-tinted, with a slow shimmer band.
render_mode cull_disabled, depth_draw_opaque, shadows_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/figure_deform.gdshaderinc"
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/figure_detail.gdshaderinc"

uniform float project = 1.0;
uniform vec3 plane_n = vec3(0.0, 0.0, 1.0);
uniform float plane_d = 0.0;
uniform vec3 clip_c = vec3(0.0);
uniform vec3 clip_u = vec3(1.0, 0.0, 0.0);
uniform vec3 clip_v = vec3(0.0, 1.0, 0.0);
uniform vec2 clip_h = vec2(1.0, 1.0);
uniform float vis = 1.0;
uniform float ghost = 0.0;
uniform float glint = 1.0;
uniform float shimmer = 1.0;
uniform float ripple_amt = 0.0;        // pools: a tiny watery wobble
uniform vec3 surface_col = vec3(0.5);  // the surface the reflection lives in
uniform float surface_mix = 0.0;       // polished floor: mostly the floor's own colour
uniform vec2 skip = vec2(0.0);         // a one-frame offset (the rare "skip")

varying vec3 pp;
varying vec3 wpos;
varying vec4 vcol;
varying vec2 vuv;
varying vec3 lpos;

void vertex() {
	vec3 v = cloak_deform(VERTEX, UV);
	vcol = COLOR;
	vuv = UV;
	lpos = v;
	vec3 w = (MODEL_MATRIX * vec4(v, 1.0)).xyz;
	w.x += sin(w.y * 13.0 + TIME * 2.7) * 0.006 * shimmer * ghost;
	w.xz += vec2(sin(w.z * 9.0 + TIME * 3.1), cos(w.x * 8.0 + TIME * 2.6)) * 0.012 * ripple_amt;
	w.xz += skip;
	wpos = w;
	pp = w;
	if (project > 0.5) {
		vec3 cb = normalize(INV_VIEW_MATRIX[2].xyz);
		float den = dot(plane_n, cb);
		den = abs(den) < 0.02 ? 0.02 : den;
		float t = (plane_d - dot(plane_n, w)) / den;
		vec3 p = w + cb * t;
		pp = p;
		p += cb * max(0.004, 0.03 - t * 0.003);
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(p, 1.0);
	} else {
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
	}
}

// 4x4 ordered dither, arithmetic (no local array: cheaper on mobile GPUs)
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 fc) { return bayer2(0.5 * fc) * 0.25 + bayer2(fc) + 0.5 / 16.0; }

void fragment() {
	if (project > 0.5) {
		vec3 d = pp - clip_c;
		vec2 uv = vec2(dot(d, clip_u), dot(d, clip_v)) / clip_h;
		if (abs(uv.x) > 1.0 || abs(uv.y) > 1.0) discard;
	}
	if (vis < 0.999 && bayer4(FRAGCOORD.xy) > vis) discard;
	vec3 base = vcol.rgb;
	if (vuv.x > 0.5 && vuv.x < 1.5) base *= face_shade(lpos - vec3(0.0, 0.14, -0.022));
	// a reflection: a touch cooler and flatter than the real thing
	float lum = dot(base, vec3(0.3, 0.55, 0.15));
	vec3 refl = mix(base, vec3(lum), 0.18) * vec3(0.90, 0.97, 1.04) + vec3(0.03, 0.04, 0.05);
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
	float band = smoothstep(0.92, 1.0, sin(wpos.y * 3.0 - TIME * 1.3)) * shimmer;
	vec3 eid = mix(base * 0.6 + accent.rgb * 0.45, accent_core.rgb, clamp(fres * 0.6 + band * 0.5, 0.0, 1.0));
	vec3 c = mix(refl, eid, ghost);
	c = mix(c, surface_col, surface_mix);
	vec3 emb = embroidery(vuv);
	ALBEDO = c;
	ROUGHNESS = 0.9;
	SPECULAR = 0.15;
	EMISSION = accent_core.rgb * (vcol.a * glint * 2.2 + emb.x * emb.z * 1.3) * (1.0 - surface_mix * 0.6) + accent.rgb * fres * 0.25 * ghost;
}
