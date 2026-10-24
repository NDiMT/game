shader_type spatial;
// Shallow reflecting pool: pale still water mirroring the fog, slow drifting sheen, soft rings from
// falling drops, sparkling glints, darker toward the stone edge. Its reflection is the puppet.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
global uniform vec3 player_pos;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.30, 0.35, 0.38);
uniform vec3 sky : source_color = vec3(0.70, 0.72, 0.73);
uniform float ripple = 0.0;
uniform vec2 ripple_at = vec2(0.0);

varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float drops(vec2 p) {
	// a few drops land at random places every few seconds; each spreads a soft ring
	float acc = 0.0;
	for (int i = 0; i < 4; i++) {
		float fi = float(i);
		float period = 3.0 + fi * 1.3;
		float t = TIME + fi * 1.7;
		float cyc = floor(t / period);
		float age = fract(t / period) * period;
		vec2 c = vec2(hash(vec2(cyc, fi)), hash(vec2(fi, cyc + 3.0)));
		c = mix(vec2(-4.0, -0.0), vec2(-0.8, 3.4), c);
		float r = length(p - c);
		float front = age * 0.45;
		acc += sin((r - front) * 26.0) * exp(-pow((r - front) * 6.0, 2.0)) * exp(-age * 0.9);
	}
	return acc;
}

void fragment() {
	vec2 p = wp.xz;
	float a1 = texture(noise_tex, p * 0.09 + TIME * vec2(0.004, 0.002)).r;
	float a2 = texture(noise_tex, p * 0.21 - TIME * vec2(0.003, 0.006)).r;
	float sheen = smoothstep(0.52, 0.78, a1 * 0.6 + a2 * 0.5);
	float rings = drops(p);
	// the wanderer's steps at the edge send small rings across
	float rp = length(p - player_pos.xz);
	rings += sin(rp * 22.0 - TIME * 5.0) * exp(-rp * 1.2) * 0.35 * (1.0 - smoothstep(0.0, 2.5, rp));
	vec3 c = mix(deep, sky, 0.48 + sheen * 0.32 + rings * 0.10);
	// glints: tiny bright sparkles where the surface catches the light
	float g = texture(noise_tex, p * 1.7 + vec2(TIME * 0.05, -TIME * 0.04)).r * texture(noise_tex, p * 2.3 - vec2(TIME * 0.06, TIME * 0.03)).r;
	float glint = smoothstep(0.50, 0.56, g);
	c += vec3(1.0, 0.98, 0.92) * glint * 0.28;
	vec2 e = min(UV, 1.0 - UV);
	float rim = 1.0 - smoothstep(0.0, 0.08, min(e.x, e.y));
	c = mix(c, deep * 0.75, rim * 0.55);
	ALBEDO = c;
	ALPHA = 0.9;
}
