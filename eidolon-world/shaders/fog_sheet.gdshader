shader_type spatial;
// Horizontal drifting fog sheet that follows the player, with a soft clear hole around them.
// `clear` (0..1) thins the fog when a shrine awakens.
// v0.3 perf: `layer2` = 1 also draws a DEEPER sheet (l2_depth metres below) in the same pass: for the
// orthographic camera the deeper sheet's point on this pixel's view ray is a constant xz offset, so the
// two blended layers become one full-screen pass (same look, one layer of overdraw less).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec3 cam_back;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 color : source_color = vec3(0.80, 0.79, 0.76);
uniform float density = 0.8;
uniform float hole_inner = 0.0;
uniform float hole_outer = 0.0;
uniform vec2 drift = vec2(0.012, 0.006);
uniform float scale = 0.05;
uniform vec2 center = vec2(0.0);
uniform float clear = 0.0;
uniform float layer2 = 0.0;
uniform float l2_depth = 4.6;
uniform vec3 l2_color : source_color = vec3(0.70, 0.70, 0.69);
uniform float l2_density = 0.95;
uniform vec2 l2_drift = vec2(0.006, 0.003);
uniform float l2_scale = 0.03;

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
	vec3 c1 = color * (0.96 + 0.08 * b);
	float a1 = clamp(n * density * hole * edge * (1.0 - clear * 0.7), 0.0, 1.0);
	if (layer2 > 0.5) {
		vec2 q = (wp.xz - cam_back.xz * (l2_depth / max(cam_back.y, 0.05))) * l2_scale;
		float a2n = texture(noise_tex, q + TIME * l2_drift).r;
		float b2 = texture(noise_tex, q * 2.3 - TIME * l2_drift * 1.7 + 0.31).r;
		float n2 = smoothstep(0.25, 0.85, a2n * 0.65 + b2 * 0.45);
		vec3 c2 = l2_color * (0.96 + 0.08 * b2);
		float a2 = clamp(n2 * l2_density * edge * (1.0 - clear * 0.7), 0.0, 1.0);
		float ao = a1 + a2 * (1.0 - a1);
		c1 = (c1 * a1 + c2 * a2 * (1.0 - a1)) / max(ao, 0.0001);
		a1 = ao;
	}
	ALBEDO = c1;
	ALPHA = a1;
}
