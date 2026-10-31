shader_type spatial;
// v0.9 the Sunken Colossus: still BLACK water. Translucent, so the head's mirrored copy below it reads as its
// reflection; a slow sheen of the pale sky drifts over it, darkest straight down.
render_mode unshaded, blend_mix, depth_draw_never, cull_back, shadows_disabled;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.025, 0.03, 0.035);
uniform vec3 sky : source_color = vec3(0.62, 0.64, 0.66);
uniform vec4 area = vec4(0.0, 0.0, 1.0, 1.0);    // (x0, z0, x1, z1): the edges fade into the fog
// (v1.0 M3c) milky shallows: the lake is lifted toward a pale fog-grey and is less opaque, so stones and drowned
// columns under it read as pale stone under water, not as black blocks (milk 0 / opacity 0.9 = the v0.9 look)
uniform vec3 haze : source_color = vec3(0.56, 0.59, 0.60);
uniform float milk = 0.42;
uniform float opacity = 0.72;
// v1.1c (A, QA_V11 P1-2): over the Flooded Colonnade the water is deeper-looking: milkier and nearly opaque inside
// `veil_rect` (x0, z0, x1, z1; soft 0.6 m edge), so the stones just under it (true and false alike) show only as faint
// shapes and her reflection on top is what shows the way
uniform vec4 veil_rect = vec4(9.2, 4.5, 13.6, 9.5);     // (the Flooded Colonnade: WorldGeo.T4_STONES and T4_DECOYS)
uniform float veil_milk = 0.6;
uniform float veil_opacity = 0.93;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	float n1 = texture(noise_tex, p * 0.045 + TIME * vec2(0.004, 0.0025)).r;
	float n2 = texture(noise_tex, p * 0.13 - TIME * vec2(0.006, 0.003)).r;
	float sheen = smoothstep(0.55, 0.85, n1 * 0.7 + n2 * 0.3);
	vec2 ve = min(p - veil_rect.xy, veil_rect.zw - p);
	float vk = (veil_rect.z > veil_rect.x) ? smoothstep(0.0, 0.6, min(ve.x, ve.y)) : 0.0;
	float mk = mix(milk, veil_milk, vk);
	vec3 c = mix(mix(deep, haze, mk), sky, sheen * 0.16);
	vec2 e = min(p - area.xy, area.zw - p);
	float edge = smoothstep(0.0, 1.2, min(e.x, e.y));
	ALBEDO = c;
	ALPHA = mix(0.0, mix(opacity, veil_opacity, vk), edge);
}
