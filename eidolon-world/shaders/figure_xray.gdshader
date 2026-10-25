shader_type spatial;
// v0.6: the wanderer seen THROUGH whatever stands between them and the camera: a soft x-ray outline in
// light petrol (a next pass of the figure's own materials, drawn only where it is hidden: an inverted
// depth test). The vertices are pulled 0.35 m toward the camera so the cloak never outlines itself.
render_mode unshaded, depth_test_inverted, depth_draw_never, blend_add, cull_back, shadows_disabled, fog_disabled;
// v0.8: only where the hero is NOT already visible (the stencil its own pass wrote): never over the model
stencil_mode read, compare_not_equal, 1;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 refl_clip;
#include "res://shaders/figure_deform.gdshaderinc"

void vertex() {
	VERTEX = cloak_deform(VERTEX, UV);
	vec4 vp = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	vp.z += 0.04;
	POSITION = PROJECTION_MATRIX * vp;
}

void fragment() {
	// (not in a planar mirror's own camera)
	if (dot(refl_clip.xyz, refl_clip.xyz) > 0.25 && dot(CAMERA_POSITION_WORLD, refl_clip.xyz) < refl_clip.w - 0.5) discard;
	float rim = pow(1.0 - abs(dot(NORMAL, VIEW)), 1.8);
	vec3 col = mix(accent.rgb, accent_core.rgb, 0.55);
	ALBEDO = col * (0.07 + rim * 0.42);
}
