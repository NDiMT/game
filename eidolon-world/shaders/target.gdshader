shader_type spatial;
// Flat guidance decal: a soft glowing ring of `radius` metres (tightens as you get close), optionally
// with two footprints in the middle ("stand here"). The quad spans `size` metres.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
uniform float size = 6.0;
uniform float radius = 1.0;
uniform float intensity = 1.0;
uniform float feet = 0.0;
uniform vec3 color : source_color = vec3(0.28, 0.88, 1.0);

float ell(vec2 p, vec2 c, vec2 r, float rot) {
	p -= c;
	float s = sin(rot), co = cos(rot);
	p = vec2(p.x * co - p.y * s, p.x * s + p.y * co);
	return length(p / r) - 1.0;
}

void fragment() {
	vec2 p = (UV - 0.5) * size;
	float d = length(p);
	float pulse = 0.8 + 0.2 * sin(TIME * 3.0 - d * 2.0);
	float ring = exp(-pow((d - radius) / 0.035, 2.0)) + exp(-pow((d - radius) / 0.22, 2.0)) * 0.35;
	ring += exp(-pow((d - radius * 0.62) / 0.02, 2.0)) * 0.35 * step(0.3, radius);
	float a = ring * pulse;
	vec3 c = mix(color, vec3(0.92, 1.0, 1.0), clamp(ring - 0.6, 0.0, 1.0));
	if (feet > 0.0) {
		// two soft footprints pointing toward the glass (local -y of the quad = world -z)
		float f = min(ell(p, vec2(-0.09, 0.0), vec2(0.045, 0.11), 0.08), ell(p, vec2(0.09, -0.03), vec2(0.045, 0.11), -0.08));
		f = min(f, min(ell(p, vec2(-0.1, 0.13), vec2(0.035, 0.04), 0.0), ell(p, vec2(0.1, 0.10), vec2(0.035, 0.04), 0.0)));
		float fp = 1.0 - smoothstep(0.0, 0.25, f);
		a += fp * 0.75 * feet;
		c = mix(c, vec3(0.85, 1.0, 1.0), fp * feet);
	}
	ALBEDO = c;
	ALPHA = clamp(a * intensity, 0.0, 1.0);
}
