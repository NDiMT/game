shader_type spatial;
// Shallow reflecting pool: dark still water with drifting sheen. The reflection is the puppet.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.34, 0.38, 0.40);
uniform vec3 sky : source_color = vec3(0.68, 0.70, 0.71);
uniform float ripple = 0.0;
uniform vec2 ripple_at = vec2(0.0);

varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

void fragment() {
	float a1 = texture(noise_tex, wp.xz * 0.09 + TIME * vec2(0.004, 0.002)).r;
	float a2 = texture(noise_tex, wp.xz * 0.21 - TIME * vec2(0.003, 0.006)).r;
	float sheen = smoothstep(0.55, 0.75, a1 * 0.6 + a2 * 0.5);
	float r = length(wp.xz - ripple_at);
	float rings = sin(r * 18.0 - TIME * 6.0) * exp(-r * 1.4) * ripple;
	vec3 c = mix(deep, sky, 0.45 + sheen * 0.35 + rings * 0.2);
	vec2 e = min(UV, 1.0 - UV);
	float rim = 1.0 - smoothstep(0.0, 0.06, min(e.x, e.y));
	c = mix(c, deep * 0.7, rim * 0.5);
	ALBEDO = c;
	ALPHA = 0.88;
}
