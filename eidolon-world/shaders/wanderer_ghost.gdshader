shader_type spatial;
// The wanderer's REFLECTION (opaque). The puppet is the same skinned model whose node transform is
// the player's reflected across the mirror plane (det -1, hence cull_disabled). When `project` is on,
// every vertex is slid along the view ray onto the mirror plane (identical on screen for an
// orthographic camera) so it depth-tests like a real reflection; fragments outside the glass / pool
// rectangle are discarded. It reads as a reflection through a cool grade and lower contrast; `vis`
// dithers it in and out. `ghost` = 1 for the eidolon beyond the great glass (petrol, shimmering).
render_mode cull_disabled, depth_draw_opaque, shadows_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
#include "res://shaders/figure_detail.gdshaderinc"
#include "res://shaders/wanderer.gdshaderinc"

uniform float project = 1.0;
uniform vec3 plane_n = vec3(0.0, 0.0, 1.0);
uniform float plane_d = 0.0;
uniform vec3 clip_c = vec3(0.0);
uniform vec3 clip_u = vec3(1.0, 0.0, 0.0);
uniform vec3 clip_v = vec3(0.0, 1.0, 0.0);
uniform vec2 clip_h = vec2(1.0, 1.0);
uniform float vis = 1.0;
uniform float ghost = 0.0;
uniform float shimmer = 1.0;
uniform float ripple_amt = 0.0;
uniform vec3 surface_col = vec3(0.5);
uniform float surface_mix = 0.0;
uniform vec2 skip = vec2(0.0);
uniform float graded = 1.0;            // 0 in the planar mirror view (the glass grades it itself)
uniform float clip_disc = 0.0;         // 1: a round pool (clip to the inscribed circle)

varying vec3 pp;
varying vec3 wpos;
varying vec4 vcol;
varying vec2 vuv2;

void vertex() {
	vec3 v = wanderer_deform(VERTEX, COLOR);
	vcol = COLOR;
	vuv2 = UV2;
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
		if (clip_disc > 0.5 && length(uv) > 1.0) discard;
	}
	if (vis < 0.999 && bayer4(FRAGCOORD.xy) > vis) discard;
	vec3 base = wanderer_albedo(UV, vcol.b);
	float lum = dot(base, vec3(0.3, 0.55, 0.15));
	vec3 refl = mix(base, mix(base, vec3(lum), 0.18) * vec3(0.90, 0.97, 1.04) + vec3(0.03, 0.04, 0.05), graded);
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
	float band = smoothstep(0.92, 1.0, sin(wpos.y * 3.0 - TIME * 1.3)) * shimmer;
	vec3 eid = mix(base * 0.6 + accent.rgb * 0.45, accent_core.rgb, clamp(fres * 0.6 + band * 0.5, 0.0, 1.0));
	vec3 c = mix(refl, eid, ghost);
	c = mix(c, surface_col, surface_mix);
	vec3 emb = embroidery(vuv2);
	float hs = hem_stripe(vcol.r);
	c = mix(c, accent.rgb * 0.8, hs * 0.7 * (1.0 - surface_mix));
	ALBEDO = c;
	NORMAL_MAP = texture(normal_tex, UV).rgb;
	ROUGHNESS = 0.9;
	SPECULAR = 0.15;
	EMISSION = accent_core.rgb * (hs * glint * 0.55 + emb.x * emb.z * 1.3) * (1.0 - surface_mix * 0.6) + accent.rgb * fres * 0.25 * ghost;
}
