shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

uniform vec3 color : source_color = vec3(1.0, 0.85, 0.5);
uniform float lit = 0.0;
uniform float phase = 0.0;
uniform float fade = 1.0;
uniform float boost = 1.0;

void vertex() {
	vec3 up = vec3(0.0, 1.0, 0.0);
	vec3 side = normalize(cross(up, INV_VIEW_MATRIX[2].xyz));
	vec3 fwd = normalize(cross(side, up));
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(vec4(side, 0.0), vec4(up, 0.0), vec4(fwd, 0.0), MODEL_MATRIX[3]);
}

void fragment() {
	float x = abs(UV.x - 0.5) * 2.0;
	float h = 1.0 - UV.y;                       // 0 at the floor, 1 at the top
	float pulse = 0.75 + 0.25 * sin(TIME * 1.8 + phase);
	float k = mix(pulse, 1.0, lit);
	float width = mix(0.55, 0.85, lit);
	float body = pow(1.0 - smoothstep(0.0, width, x), 1.6);
	float core = 1.0 - smoothstep(0.0, mix(0.10, 0.18, lit), x);
	float vfade = smoothstep(0.0, 0.05, h) * pow(1.0 - h, 0.85);
	float motes = smoothstep(0.92, 1.0, sin(h * 40.0 - TIME * 2.5 + x * 3.0)) * 0.3;
	float a = (body * mix(0.42, 0.62, lit) + core * mix(0.5, 0.8, lit) + motes * body) * vfade * k * fade * boost;
	ALBEDO = mix(color, vec3(1.0), core * 0.35 * lit);
	ALPHA = clamp(a, 0.0, 0.9);
}
