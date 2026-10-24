shader_type spatial;
// Soft radial glow decal (under the Eidolon, on lit sigils).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

uniform vec3 color : source_color = vec3(0.3, 0.85, 1.0);
uniform float intensity = 0.25;

void fragment() {
	float d = length(UV - 0.5) * 2.0;
	float g = pow(1.0 - clamp(d, 0.0, 1.0), 2.2);
	ALBEDO = color;
	ALPHA = g * intensity * 1.6;
}
