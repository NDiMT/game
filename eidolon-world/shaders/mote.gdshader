shader_type spatial;
// Floating dust: one MultiMesh, each instance drifts slowly and wraps inside a box around the player.
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec3 player_pos;
global uniform float awaken;
uniform vec3 box = vec3(22.0, 7.0, 22.0);
uniform float intensity = 0.55;
varying float fade;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	float s = fract(sin(dot(o, vec3(12.9, 78.2, 37.7))) * 4375.85);
	vec3 drift = vec3(sin(TIME * 0.11 + s * 6.0) * 0.8 + TIME * 0.05, sin(TIME * 0.07 + s * 9.0) * 0.6 + TIME * (0.03 + s * 0.04), cos(TIME * 0.09 + s * 4.0) * 0.8);
	vec3 base = player_pos + vec3(0.0, 1.0, 0.0);
	vec3 p = mod(o + drift - base + box * 0.5, box) - box * 0.5;
	fade = (1.0 - smoothstep(0.35, 0.5, max(abs(p.x) / box.x, abs(p.z) / box.z))) * (1.0 - smoothstep(0.3, 0.5, abs(p.y) / box.y));
	fade *= 0.6 + 0.4 * sin(TIME * (0.8 + s) + s * 20.0);
	p += base;
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], vec4(p, 1.0));
}

void fragment() {
	float d = length(UV - 0.5) * 2.0;
	float g = pow(1.0 - clamp(d, 0.0, 1.0), 2.5);
	ALBEDO = mix(vec3(1.0, 0.97, 0.9), vec3(0.6, 0.95, 1.0), awaken * 0.6) * g * fade * intensity * (1.0 + awaken);
}
