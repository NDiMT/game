shader_type spatial;
// Floating dust (pale, glinting) and ash (dark flecks, slowly falling): one MultiMesh each, every
// instance drifts and wraps inside a box around the player. Mixed (not added) so it reads on marble.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec3 player_pos;
global uniform float awaken;
uniform vec3 box = vec3(16.0, 7.0, 16.0);
uniform float intensity = 0.6;
uniform float ash = 0.0;
varying float fade;
varying float spin;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	float s = fract(sin(dot(o, vec3(12.9, 78.2, 37.7))) * 4375.85);
	vec3 drift = vec3(sin(TIME * 0.11 + s * 6.0) * 0.8 + TIME * 0.05, sin(TIME * 0.07 + s * 9.0) * 0.6 + TIME * (0.03 + s * 0.04), cos(TIME * 0.09 + s * 4.0) * 0.8);
	if (ash > 0.5) drift = vec3(sin(TIME * 0.4 + s * 6.0) * 0.5 + TIME * 0.12, -TIME * (0.12 + s * 0.1), cos(TIME * 0.33 + s * 4.0) * 0.5);
	vec3 base = player_pos + vec3(0.0, 1.5, 0.0);
	vec3 p = mod(o + drift - base + box * 0.5, box) - box * 0.5;
	fade = (1.0 - smoothstep(0.35, 0.5, max(abs(p.x) / box.x, abs(p.z) / box.z))) * (1.0 - smoothstep(0.3, 0.5, abs(p.y) / box.y));
	fade *= 0.55 + 0.45 * sin(TIME * (0.8 + s) + s * 20.0);
	spin = TIME * (1.0 + s * 2.0) + s * 6.0;
	p += base;
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], vec4(p, 1.0));
}

void fragment() {
	vec2 q = UV - 0.5;
	if (ash > 0.5) {
		// a tumbling flake: an ellipse that thins as it turns
		float c = cos(spin), s = sin(spin);
		q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
		q.x /= 0.25 + 0.75 * abs(sin(spin * 0.7));
	}
	float d = length(q) * 2.0;
	float g = pow(1.0 - clamp(d, 0.0, 1.0), ash > 0.5 ? 0.6 : 2.2);
	vec3 col = ash > 0.5 ? vec3(0.30, 0.30, 0.31) : mix(vec3(1.0, 0.98, 0.92), accent_core.rgb, awaken * 0.6);
	ALBEDO = col;
	ALPHA = clamp(g * fade * intensity, 0.0, 1.0);
}
