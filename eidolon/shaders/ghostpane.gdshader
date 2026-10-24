shader_type spatial;
// Swipe-preview ghost of a mirror's destination: a glowing outline with a whisper of glass.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
void fragment() {
	vec2 e = min(UV, 1.0 - UV);
	float aa = fwidth(UV.x) + fwidth(UV.y);
	float frame = 1.0 - smoothstep(0.02, 0.02 + aa * 2.0, min(e.x * 0.2, e.y));
	float pulse = 0.75 + 0.25 * sin(TIME * 6.0);
	ALBEDO = vec3(0.4, 0.92, 1.0);
	ALPHA = (frame * 0.85 + 0.10) * pulse;
}
