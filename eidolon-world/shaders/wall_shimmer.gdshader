shader_type spatial;
// The invisible walls of the Mist Maze flash faintly where you bump into them; kind 1 is the cracked,
// hollow wall of the Echo Corridor answering a footstep.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float flash = 0.0;
uniform float kind = 0.0;
void fragment() {
	vec2 p = UV;
	float a;
	if (kind < 0.5) {
		vec2 g = fract(p * vec2(6.0, 4.0));
		float line = 1.0 - smoothstep(0.0, 0.06, min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y)));
		float n = texture(noise_tex, p * 2.0 + TIME * 0.05).r;
		float side = smoothstep(0.0, 0.2, p.y) * smoothstep(1.0, 0.6, p.y);
		a = (line * 0.6 + n * 0.3) * side;
	} else {
		float n = texture(noise_tex, p * vec2(3.0, 4.5)).r;
		float crack = 1.0 - smoothstep(0.0, 0.02, abs(n - 0.5));
		float n2 = texture(noise_tex, p * vec2(7.0, 9.0) + 0.4).r;
		crack = max(crack, 1.0 - smoothstep(0.0, 0.015, abs(n2 - 0.5)));
		a = crack * smoothstep(0.0, 0.15, p.y) * smoothstep(1.0, 0.8, p.y);
	}
	ALBEDO = mix(accent.rgb, accent_core.rgb, 0.5);
	ALPHA = clamp(a * flash, 0.0, 0.9);
}
