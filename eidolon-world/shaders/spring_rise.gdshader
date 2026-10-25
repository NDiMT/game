shader_type spatial;
// v0.9 the Upward Spring: water falling UP. Streaks scroll upward along the column; it thins and frays as it
// rises into the fog, toward the temple hanging upside down in the sky.
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 water : source_color = vec3(0.42, 0.52, 0.56);
uniform float speed = 0.35;
global uniform vec4 accent;
varying vec3 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	float v = UV.y;                         // 0 at the top .. 1 at the basin
	float u = UV.x;
	float s1 = texture(noise_tex, vec2(u * 3.0, v * 1.4 + TIME * speed)).r;
	float s2 = texture(noise_tex, vec2(u * 7.0 + 0.3, v * 3.2 + TIME * speed * 1.7)).r;
	float streak = smoothstep(0.35, 0.75, s1 * 0.6 + s2 * 0.4);
	float body = 0.6 + 0.4 * streak;
	float edge = 1.0 - abs(dot(normalize(NORMAL), normalize(VIEW)));       // brighter at the silhouette
	streak = max(streak, edge * 0.6);
	float thin = mix(0.25, 1.0, smoothstep(0.0, 0.7, v));       // frays toward the top
	ALBEDO = mix(water, vec3(1.0), streak * 0.5) + accent.rgb * streak * 0.08;
	ALPHA = body * thin * 0.9;
}
