shader_type spatial;
// A hanging veil of mist across a doorway: it bars the way until it dissolves (`density` -> 0).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float density = 1.0;
uniform float glow = 0.0;
void fragment() {
	float n = texture(noise_tex, UV * vec2(1.4, 0.8) + vec2(0.0, TIME * 0.05)).r;
	float n2 = texture(noise_tex, UV * vec2(3.0, 1.6) - vec2(TIME * 0.03, TIME * 0.08)).r;
	float side = smoothstep(0.0, 0.18, UV.x) * smoothstep(1.0, 0.82, UV.x);
	float v = smoothstep(0.0, 0.25, UV.y) * smoothstep(1.0, 0.7, UV.y);
	float a = (0.35 + 0.45 * n + 0.25 * n2) * side * mix(0.6, 1.0, v) * density;
	ALBEDO = mix(vec3(0.86, 0.87, 0.86), accent.rgb, glow * (0.4 + 0.3 * n2));
	ALPHA = clamp(a, 0.0, 0.85);
}
