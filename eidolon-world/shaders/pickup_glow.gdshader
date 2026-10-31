shader_type spatial;
// v1.1 (Agent A) a pickup's call: a soft pillar of light rising from it (a camera-facing vertical quad, `part` 0)
// and a soft pool on the floor under it (a flat quad, `part` 1). Warm white with a faint crimson edge, breathing
// slowly, brightest at the base. v1.1c: alpha-blended in a crimson-warm tint (additive light vanished on the pale
// marble at the phone camera). Built by scripts/fx/pickup_marker.gd.
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform float part = 0.0;
uniform float k = 1.0;                 // 0..1 (fade it out when taken)
uniform float height = 1.6;            // the pillar (m)
uniform float width = 0.7;
uniform vec3 core_col : source_color = vec3(1.0, 0.95, 0.88);
void vertex() {
	if (part < 0.5) {
		// cylindrical billboard: the quad turns about world up to face the camera
		vec3 o = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
		vec3 right = normalize(vec3(INV_VIEW_MATRIX[0].x, 0.0, INV_VIEW_MATRIX[0].z));
		vec3 w = o + right * VERTEX.x * width + vec3(0.0, (VERTEX.y + 0.5) * height, 0.0);
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
	}
}
void fragment() {
	float br = k * (0.8 + 0.2 * sin(TIME * 1.6));
	vec3 c;
	float a;
	if (part < 0.5) {
		float x = abs(UV.x - 0.5) * 2.0;
		float y = 1.0 - UV.y;                                   // 0 at the base, 1 at the top
		float core = exp(-x * x * 22.0);
		float body = exp(-x * x * 5.0);
		float v = pow(1.0 - y, 1.4) * smoothstep(0.0, 0.05, y);
		float sh = 0.85 + 0.15 * sin(y * 14.0 - TIME * 2.2 + x * 3.0);
		c = mix(accent.rgb, core_col, core * 0.75);
		a = (core * 0.85 + body * 0.32) * v * sh;
	} else {
		float r = length(UV - 0.5) * 2.0;
		float g = pow(max(1.0 - r, 0.0), 1.6);
		float ring = exp(-pow((r - 0.55 - 0.1 * fract(TIME * 0.4)) * 9.0, 2.0)) * (1.0 - fract(TIME * 0.4));
		c = mix(accent.rgb, core_col, g * 0.5);
		a = g * 0.38 + ring * 0.35;
	}
	ALBEDO = c;
	ALPHA = clamp(a * br, 0.0, 1.0);
}
