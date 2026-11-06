shader_type spatial;
// v2.0 (Agent A) the Observer's crimson rim (the next pass over observer_veil): light from behind it, through the fog,
// catching the edges of the veil. Alpha-blended crimson (not additive: additive vanishes in pale fog), fog-free so it
// carries from far out in the inlet; a slow breath. The shell sits 1 cm out along the normal (no fight with the cloth).
render_mode unshaded, blend_mix, depth_draw_never, cull_back, fog_disabled, shadows_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float k = 1.0;
uniform float water_y = 0.0;
uniform float push = 0.01;
uniform float rim_pow = 3.2;          // (higher: the rim only on the silhouette itself; the beyond colossus 7)
uniform float rim_max = 0.9;
varying vec3 wpos;
void vertex() {
	VERTEX += NORMAL * push;
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	float fres = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float rim = pow(fres, rim_pow);
	// the light is behind and above it: the rim is strongest on the upper silhouette, gone under the water line
	vec3 nw = (INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz;
	float up = smoothstep(-0.35, 0.55, nw.y);
	float above = smoothstep(0.0, 0.6, wpos.y - water_y);
	float breath = 0.85 + 0.15 * sin(TIME * 0.7);
	ALBEDO = mix(accent.rgb, accent_core.rgb, rim * rim * 0.6);
	ALPHA = clamp(rim * up * above * 0.85 * breath * k, 0.0, rim_max);
}
