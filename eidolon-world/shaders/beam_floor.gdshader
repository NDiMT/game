shader_type spatial;
// v0.4: the light beam LIGHTS THE FLOOR. kind 0: a soft glow strip on the ground beneath one beam
// segment (stretched quad, gaussian falloff across, ends faded), with a gentle flicker and pulses
// that travel along the beam; kind 1: a brighter pool of light where the beam strikes a mirror or the
// crystal. Tinted light decals (no real light: cheap on phones; additive light vanished on the pale stone).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform float kind = 0.0;
uniform float length_m = 1.0;
uniform float offset_m = 0.0;     // distance along the whole beam where this segment starts
uniform float intensity = 1.0;
uniform float phase = 0.0;
void fragment() {
	vec3 warm = vec3(1.0, 0.86, 0.62);
	vec3 col = mix(accent_core.rgb, warm, 0.3);
	float flick = 0.9 + 0.06 * sin(TIME * 13.0 + phase * 5.0) + 0.04 * sin(TIME * 29.0 + phase);
	float a;
	if (kind < 0.5) {
		float x = (UV.y - 0.5) * 2.0;
		float across = exp(-x * x * 3.5);
		float s = UV.x * length_m;
		float ends = smoothstep(0.0, 0.5, s) * smoothstep(0.0, 0.5, length_m - s);
		float pulse = 0.75 + 0.25 * sin((s + offset_m) * 2.2 - TIME * 3.0);
		a = across * ends * pulse * 0.55;
	} else {
		float r = length(UV - 0.5) * 2.0;
		a = exp(-r * r * 3.0) * 1.1 * (0.85 + 0.15 * sin(TIME * 2.1 + phase));
		col = mix(col, vec3(1.0, 0.97, 0.9), 0.25);
	}
	ALBEDO = col * 1.15;
	ALPHA = clamp(a * flick * intensity * 1.15, 0.0, 0.9);
}
