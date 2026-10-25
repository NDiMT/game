shader_type spatial;
// v0.9 the Sunken Colossus: still BLACK water. Translucent, so the head's mirrored copy below it reads as its
// reflection; a slow sheen of the pale sky drifts over it, darkest straight down.
render_mode unshaded, blend_mix, depth_draw_never, cull_back, shadows_disabled;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.025, 0.03, 0.035);
uniform vec3 sky : source_color = vec3(0.62, 0.64, 0.66);
uniform vec4 area = vec4(0.0, 0.0, 1.0, 1.0);    // (x0, z0, x1, z1): the edges fade into the fog
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	float n1 = texture(noise_tex, p * 0.045 + TIME * vec2(0.004, 0.0025)).r;
	float n2 = texture(noise_tex, p * 0.13 - TIME * vec2(0.006, 0.003)).r;
	float sheen = smoothstep(0.55, 0.85, n1 * 0.7 + n2 * 0.3);
	vec3 c = mix(deep, sky, sheen * 0.16);
	vec2 e = min(p - area.xy, area.zw - p);
	float edge = smoothstep(0.0, 1.2, min(e.x, e.y));
	ALBEDO = c;
	ALPHA = mix(0.0, 0.9, edge);
}
