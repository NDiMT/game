shader_type spatial;
// A faint petrol footprint left by the REFLECTION (yours leave none); fades over `life` 0..1.
// Projected onto the glass like the projected puppet when `project` is on (cheap mirrors), plain
// decal on the floor in the planar reflection view.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent_core;
uniform float project = 1.0;
uniform vec3 plane_n = vec3(0.0, 0.0, 1.0);
uniform float plane_d = 0.0;
uniform vec3 clip_c = vec3(0.0);
uniform vec3 clip_u = vec3(1.0, 0.0, 0.0);
uniform vec3 clip_v = vec3(0.0, 1.0, 0.0);
uniform vec2 clip_h = vec2(1.0, 1.0);
uniform float life = 1.0;
uniform float dark = 0.0;        // v0.5: her steps in still water: the outer glow, stronger
global uniform vec4 accent;
// v0.8 the two lights: aqua (yours) or rose (hers): `hers` 0..1
global uniform vec4 her;
global uniform vec4 her_core;
global uniform vec4 her_tint;
uniform float hers = 1.0;
vec3 _ha() { return mix(accent.rgb, her.rgb, hers); }
vec3 _hc() { return mix(accent_core.rgb, her_core.rgb, hers); }
varying vec3 pp;
void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	pp = w;
	if (project > 0.5) {
		vec3 cb = normalize(INV_VIEW_MATRIX[2].xyz);
		float den = dot(plane_n, cb);
		den = abs(den) < 0.02 ? 0.02 : den;
		vec3 p = w + cb * ((plane_d - dot(plane_n, w)) / den);
		pp = p;
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(p + cb * 0.035, 1.0);
	} else {
		// (writing POSITION anywhere turns off the default transform: do it ourselves)
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
	}
}
void fragment() {
	if (project > 0.5) {
		vec3 d = pp - clip_c;
		vec2 uv = vec2(dot(d, clip_u), dot(d, clip_v)) / clip_h;
		if (abs(uv.x) > 1.0 || abs(uv.y) > 1.0) discard;
	}
	vec2 q = (UV - 0.5) * vec2(2.0, 2.0);
	float sole = length(vec2(q.x * 1.6, (q.y - 0.18) * 1.15)) - 0.62;
	float heel = length(vec2(q.x * 1.5, (q.y + 0.55) * 1.6)) - 0.42;
	float s = 1.0 - smoothstep(-0.12, 0.05, min(sole, heel));
	float a = s * pow(1.0 - life, 1.5) * mix(0.55, 0.9, dark);
	if (a < 0.003) discard;
	ALBEDO = mix(_hc(), _ha(), dark);
	ALPHA = a;
}
