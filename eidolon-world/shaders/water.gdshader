shader_type spatial;
// Shallow reflecting pool, v0.3: OPAQUE still water mirroring the fog (the opaque reflection of the
// wanderer stands on it); its ripples, sheen and glints are drawn by water_over above the reflection.
render_mode unshaded, cull_back, shadows_disabled;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.34, 0.38, 0.41);
uniform vec3 sky : source_color = vec3(0.70, 0.72, 0.73);
uniform float disc = 0.0;         // 1: a round pool (the shrine's)
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	if (disc > 0.5 && length(UV - 0.5) > 0.5) discard;
	vec2 p = wp.xz;
	float a1 = texture(noise_tex, p * 0.07 + TIME * vec2(0.003, 0.002)).r;
	vec3 c = mix(deep, sky, 0.52 + (a1 - 0.5) * 0.25);
	vec2 e = min(UV, 1.0 - UV);
	float rim = 1.0 - smoothstep(0.0, 0.10, min(e.x, e.y));
	c = mix(c, deep * 0.7, rim * 0.6);
	ALBEDO = c;
}
