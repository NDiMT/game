shader_type spatial;
// Marble in object space (the pattern tumbles with the cube), with carved bevel darkening on edges.
render_mode cull_back;
#include "res://shaders/glyphs.gdshaderinc"

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float black = 0.0;
uniform float half_size = 0.45;
uniform float pulse = 0.0;
uniform float bevel = 1.0;
uniform float alpha_cut = 0.0;
uniform float glyphs = 0.0;          // 1 on the player cube: engraved cyan line designs
uniform float glyph_seed = 0.0;
uniform float roll_glow = 0.0;
uniform vec3 glyph_col : source_color = vec3(0.25, 0.92, 1.0);
uniform vec3 cream : source_color = vec3(0.90, 0.875, 0.82);
uniform vec3 vein : source_color = vec3(0.38, 0.37, 0.36);

varying vec3 op;

void vertex() {
	op = VERTEX;
}

void fragment() {
	vec3 p = op * 2.2;
	float n = texture(noise_tex, p.xz * 0.21 + p.y * 0.17).r;
	float n2 = texture(noise_tex, p.zy * 0.27 + 0.5).r;
	float v = sin((p.x * 1.1 + p.y * 0.6 + p.z * 0.8) * 2.4 + n * 10.0 + n2 * 4.0);
	float vv = 1.0 - smoothstep(0.0, 0.09, abs(v));
	vec3 base = mix(cream * (0.92 + 0.14 * n), vein, vv * 0.5);
	vec3 bl = mix(vec3(0.055, 0.055, 0.06) * (0.9 + 0.3 * n), vec3(0.6, 0.56, 0.5), vv * 0.4);
	vec3 col = mix(base, bl, black);
	// bevel: second-largest |coord| close to half size => near an edge
	vec3 a = abs(op);
	float mx = max(a.x, max(a.y, a.z));
	float mid = a.x + a.y + a.z - mx - min(a.x, min(a.y, a.z));
	float edge = smoothstep(half_size - 0.07, half_size - 0.005, mid) * bevel;
	col = mix(col * (1.0 - edge * 0.45), mix(vec3(0.75, 0.72, 0.66), col, 0.4), edge * black * 0.5);
	ALBEDO = col;
	ROUGHNESS = mix(0.3, 0.6, edge);
	SPECULAR = 0.5;
	EMISSION = vec3(0.95, 0.85, 0.6) * pulse * 0.6 * (1.0 - glyphs);
	if (glyphs > 0.5) {
		vec2 gl = glyph_lines(op, half_size, glyph_seed);
		float breathe = 0.8 + 0.2 * sin(TIME * 1.1 + glyph_seed);
		float k = breathe + roll_glow * 0.8 + pulse * 1.5;
		vec3 hot = mix(glyph_col, vec3(0.85, 1.0, 1.0), 0.55);      // near-white core
		ALBEDO = mix(ALBEDO, vec3(0.0), gl.x * 0.9);
		EMISSION += (hot * gl.x * 2.2 + glyph_col * gl.y * 1.1) * k;
	}
}
