shader_type spatial;
// Soft contact shadow / ambient occlusion decal (MultiMesh of flat quads; non-uniform scale allowed:
// elongated blobs at the base of walls).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled;
uniform float strength = 0.38;
uniform vec3 tint = vec3(0.10, 0.10, 0.12);
uniform float edge = 0.0;          // 1: an elongated strip, darkest along its long axis
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float d = edge > 0.5 ? abs(p.y) + max(abs(p.x) - 0.8, 0.0) * 4.0 : length(p);
	float g = pow(1.0 - clamp(d, 0.0, 1.0), 1.8);
	ALBEDO = tint;
	ALPHA = g * strength;
}
