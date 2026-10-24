shader_type spatial;
// The Mist Maze: a thick white mist lying over the maze; only a small clearing travels with you.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec3 player_pos;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float density = 0.9;
uniform float clear_r = 1.3;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	float a1 = texture(noise_tex, p * 0.11 + TIME * vec2(0.012, 0.006)).r;
	float a2 = texture(noise_tex, p * 0.29 - TIME * vec2(0.008, 0.015)).r;
	float n = smoothstep(0.2, 0.8, a1 * 0.65 + a2 * 0.45);
	float r = length(p - player_pos.xz);
	float hole = smoothstep(clear_r * 0.45, clear_r * 1.35, r);
	vec2 e = min(UV, 1.0 - UV);
	float edge = smoothstep(0.0, 0.08, min(e.x, e.y));
	ALBEDO = vec3(0.86, 0.86, 0.84) * (0.95 + 0.08 * a2);
	ALPHA = clamp((0.55 + 0.4 * n) * density * hole * edge, 0.0, 0.93);
}
