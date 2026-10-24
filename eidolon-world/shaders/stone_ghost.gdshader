shader_type spatial;
// A stepping stone that exists only in the reflection: seen in the still pool as the dark reflection
// of a worn stone just above the water. `reveal` 0..1 (still water shows it; ripples hide it).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float reveal = 0.0;
uniform float seed = 0.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float n = texture(noise_tex, UV * 0.8 + seed).r;
	float shape = max(abs(p.x), abs(p.y)) + 0.25 * length(p) - 0.12 * (n - 0.5);
	float body = 1.0 - smoothstep(0.82, 0.92, shape);
	float rim = smoothstep(0.62, 0.86, shape) * body;
	float wob = sin(wp.x * 7.0 + TIME * 1.3) * 0.5 + 0.5;
	vec3 c = mix(vec3(0.20, 0.22, 0.25), vec3(0.30, 0.33, 0.36), n);
	c = mix(c, accent.rgb * 0.9, rim * 0.6);
	ALBEDO = c * (0.92 + 0.08 * wob);
	ALPHA = body * reveal * (0.82 + 0.1 * n);
}
