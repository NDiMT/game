shader_type spatial;
// The Eidolon: translucent cold-cyan ghost with fresnel rim, glowing edges, scanline shimmer, flicker.
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;

uniform vec3 tint : source_color = vec3(0.04, 0.62, 0.80);
uniform float half_size = 0.45;
uniform float strength = 1.0;
uniform float pulse = 0.0;
uniform float shimmer = 0.0;

varying vec3 op;
varying vec3 wp;

float hash(float x) { return fract(sin(x * 91.17) * 43758.5453); }

void vertex() {
	op = VERTEX;
	float t = TIME;
	// tiny glitch jitter now and then
	float g = step(0.965, hash(floor(t * 9.0)));
	VERTEX.x += g * 0.025 * sin(VERTEX.y * 40.0 + t * 60.0);
	VERTEX *= 1.0 + pulse * 0.08 + shimmer * 0.04 * sin(t * 40.0 + VERTEX.y * 12.0);
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 a = abs(op);
	float mx = max(a.x, max(a.y, a.z));
	float mid = a.x + a.y + a.z - mx - min(a.x, min(a.y, a.z));
	float edge = smoothstep(half_size - 0.05, half_size - 0.006, mid);
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 2.0);
	float scan = 0.85 + 0.15 * sin(wp.y * 70.0 - TIME * 5.0);
	float flick = 0.86 + 0.14 * sin(TIME * 23.0 + sin(TIME * 7.3) * 3.0);
	flick *= 1.0 - 0.35 * step(0.97, hash(floor(TIME * 13.0)));
	float al = (0.30 + fres * 0.40 + edge * 0.85) * scan * flick;
	al = clamp(al * strength + pulse * 0.3 + shimmer * 0.2, 0.0, 1.0);
	vec3 c = mix(tint, vec3(0.55, 0.97, 1.0), edge * 0.75 + fres * 0.3 + pulse * 0.5);
	ALBEDO = c * (1.0 + pulse);
	ALPHA = al;
}
