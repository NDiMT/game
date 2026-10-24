shader_type spatial;
// Reflection puppet. The mirrored copy of the figure is placed at the reflected world position; when
// `project` is on, every vertex is slid along the view ray onto the mirror plane (identical on screen
// for an orthographic camera) so it depth-tests like a real reflection, and fragments outside the
// glass / pool rectangle are clipped. `ghost` blends from a tinted reflection to the cyan eidolon.
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;
#include "res://shaders/figure_deform.gdshaderinc"

uniform float project = 1.0;
uniform vec3 plane_n = vec3(0.0, 0.0, 1.0);
uniform float plane_d = 0.0;
uniform vec3 clip_c = vec3(0.0);
uniform vec3 clip_u = vec3(1.0, 0.0, 0.0);
uniform vec3 clip_v = vec3(0.0, 1.0, 0.0);
uniform vec2 clip_h = vec2(1.0, 1.0);
uniform float alpha = 0.7;
uniform float ghost = 0.0;
uniform float glint = 1.0;
uniform float shimmer = 1.0;
uniform vec3 tint : source_color = vec3(0.10, 0.36, 0.44);
uniform vec3 hi : source_color = vec3(0.55, 0.95, 1.0);

varying vec3 pp;
varying vec3 wpos;
varying vec4 vcol;

void vertex() {
	vec3 v = cloak_deform(VERTEX);
	vcol = COLOR;
	vec3 w = (MODEL_MATRIX * vec4(v, 1.0)).xyz;
	w.x += sin(w.y * 13.0 + TIME * 2.7) * 0.008 * shimmer;
	w.z += cos(w.y * 11.0 - TIME * 2.1) * 0.006 * shimmer;
	wpos = w;
	pp = w;
	if (project > 0.5) {
		vec3 cb = normalize(INV_VIEW_MATRIX[2].xyz);
		float den = dot(plane_n, cb);
		den = abs(den) < 0.02 ? 0.02 : den;
		float t = (plane_d - dot(plane_n, w)) / den;
		vec3 p = w + cb * t;
		pp = p;
		p += cb * max(0.004, 0.035 - t * 0.003);
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(p, 1.0);
	} else {
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
	}
}

void fragment() {
	float edge = 1.0;
	if (project > 0.5) {
		vec3 d = pp - clip_c;
		vec2 uv = vec2(dot(d, clip_u), dot(d, clip_v)) / clip_h;
		if (abs(uv.x) > 1.0 || abs(uv.y) > 1.0) discard;
		edge = (1.0 - smoothstep(0.86, 1.0, abs(uv.x))) * (1.0 - smoothstep(0.86, 1.0, abs(uv.y)));
	}
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
	float scan = 0.88 + 0.12 * sin(wpos.y * 64.0 - TIME * 4.0);
	float band = smoothstep(0.92, 1.0, sin(wpos.y * 3.0 - TIME * 1.3)) * 0.35 * shimmer;
	vec3 refl = mix(vcol.rgb * 1.1, tint * 0.6, 0.30);
	vec3 eid = mix(tint, hi, clamp(fres * 0.9 + band, 0.0, 1.0));
	vec3 c = mix(refl, eid, ghost);
	c = mix(c, hi, fres * mix(0.25, 0.45, ghost) + band * 0.5);
	c = mix(c, vec3(0.85, 1.0, 1.0), clamp(vcol.a * glint, 0.0, 1.0));
	float a = alpha * mix(0.82, 1.0, fres) * scan + band * 0.2 + vcol.a * glint * 0.5;
	ALBEDO = c;
	ALPHA = clamp(a * edge, 0.0, 0.95);
}
