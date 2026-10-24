shader_type spatial;
// Faint energy line from the sliding mirror to the Eidolon it is carrying (dashes flow toward it).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
uniform float intensity = 0.0;
uniform float flow = 1.0;
void fragment() {
	float across = 1.0 - smoothstep(0.0, 1.0, abs(UV.y - 0.5) * 2.0);
	float dash = 0.55 + 0.45 * sin(UV.x * 40.0 * flow - TIME * 30.0);
	ALBEDO = mix(vec3(0.0, 0.7, 0.95), vec3(0.85, 1.0, 1.0), across * 0.6);
	ALPHA = clamp(across * dash * intensity * 1.4, 0.0, 1.0);
}
