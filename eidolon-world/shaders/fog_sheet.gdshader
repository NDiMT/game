shader_type spatial;
// Horizontal drifting fog sheet that follows the player, with a soft clear hole around them.
// `clear` (0..1) thins the fog when a shrine awakens.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 color : source_color = vec3(0.80, 0.79, 0.76);
uniform float density = 0.8;
uniform float hole_inner = 0.0;
uniform float hole_outer = 0.0;
uniform vec2 drift = vec2(0.012, 0.006);
uniform float scale = 0.05;
uniform vec2 center = vec2(0.0);
uniform float clear = 0.0;

varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

void fragment() {
	vec2 p = wp.xz * scale;
	float a = texture(noise_tex, p + TIME * drift).r;
	float b = texture(noise_tex, p * 2.3 - TIME * drift * 1.7 + 0.31).r;
	float n = smoothstep(0.25, 0.85, a * 0.65 + b * 0.45);
	float r = length(wp.xz - center);
	float hole = hole_outer > 0.0 ? smoothstep(hole_inner * (1.0 + clear * 2.5), hole_outer * (1.0 + clear * 2.5), r) : 1.0;
	float edge = 1.0 - smoothstep(48.0, 70.0, r);
	ALBEDO = color * (0.96 + 0.08 * b);
	ALPHA = clamp(n * density * hole * edge * (1.0 - clear * 0.7), 0.0, 1.0);
}
