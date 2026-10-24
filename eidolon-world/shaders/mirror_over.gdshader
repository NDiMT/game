shader_type spatial;
// The glass surface drawn OVER the reflection: a soft specular streak that slides as the camera turns,
// and a gentle edge vignette, so the reflection sits inside the glass.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec3 cam_back;
uniform vec2 size = vec2(2.0, 3.0);
void fragment() {
	vec2 uv = UV;
	vec2 m = vec2(min(uv.x, 1.0 - uv.x) * size.x, min(uv.y, 1.0 - uv.y) * size.y);
	float em = min(m.x, m.y);
	float shift = (cam_back.x - cam_back.z) * 0.45;
	float band = smoothstep(0.09, 0.0, abs(fract(uv.x * 0.55 - uv.y * 0.35 + shift + TIME * 0.01) - 0.5));
	float band2 = smoothstep(0.03, 0.0, abs(fract(uv.x * 0.55 - uv.y * 0.35 + shift + 0.08 + TIME * 0.01) - 0.5));
	float vig = smoothstep(0.45, 0.0, em);
	ALBEDO = mix(vec3(0.92, 0.96, 1.0), vec3(0.55, 0.6, 0.66), vig);
	ALPHA = clamp(band * 0.10 + band2 * 0.12 + vig * 0.28, 0.0, 0.6);
}
