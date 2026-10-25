shader_type spatial;
// v0.7 the gallery's veiled busts: a cloth sheen over the veil that wakes (teal, from within) when she
// is answered. Additive; `intensity` 0 = nothing at all.
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float intensity = 0.0;
void fragment() {
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 1.6);
	float folds = 0.75 + 0.25 * sin(UV.x * 40.0 + UV.y * 6.0 + TIME * 0.6);
	ALBEDO = mix(accent.rgb, accent_core.rgb, 0.3) * (0.25 + fres * 0.9) * folds * intensity;
}
