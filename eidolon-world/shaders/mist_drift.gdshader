shader_type spatial;
// v0.9 low mist drifting over still water (a few soft sheets; cheap)
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 color : source_color = vec3(0.86, 0.86, 0.84);
uniform float density = 0.45;
uniform vec2 drift = vec2(0.02, 0.008);
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	float n = texture(noise_tex, wp.xz * 0.06 + TIME * drift).r * 0.65 + texture(noise_tex, wp.xz * 0.17 - TIME * drift * 1.7).r * 0.35;
	vec2 e = min(UV, 1.0 - UV);
	float edge = smoothstep(0.0, 0.35, min(e.x, e.y));
	ALBEDO = color;
	ALPHA = smoothstep(0.42, 0.8, n) * density * edge;
}
