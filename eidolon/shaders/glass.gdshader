shader_type spatial;
// Mirror pane: faint tinted glass, fresnel rim, bright frame lines and a slow sheen. No real reflection:
// the Eidolon is the reflection.
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec3 tint : source_color = vec3(0.42, 0.60, 0.66);
uniform float ripple = 0.0;
uniform float counter = 0.0;

void fragment() {
	vec2 uv = UV;
	float fres = pow(1.0 - abs(dot(NORMAL, VIEW)), 3.0);
	float frame = 1.0 - smoothstep(0.0, 0.025, min(min(uv.x, 1.0 - uv.x) * 0.25, min(uv.y, 1.0 - uv.y)));
	float sheen = smoothstep(0.08, 0.0, abs(fract(uv.x * 0.6 - uv.y * 0.35 - TIME * 0.045) - 0.5));
	float base_fade = smoothstep(1.0, 0.55, uv.y);   // brighter near the floor (uv.y = 1 at bottom)
	float rip = ripple * (0.5 + 0.5 * sin(uv.x * 40.0 - TIME * 30.0));
	float a = 0.20 + fres * 0.30 + frame * 0.7 + sheen * 0.16 + rip * 0.3;
	a *= mix(0.75, 1.0, base_fade);
	vec3 c = mix(tint, vec3(0.92, 0.98, 1.0), frame * 0.6 + sheen * 0.5);
	c = mix(c, vec3(0.55, 0.95, 1.0), counter * 0.25 + ripple * 0.4);
	ALBEDO = c;
	ALPHA = clamp(a, 0.0, 0.9);
}
