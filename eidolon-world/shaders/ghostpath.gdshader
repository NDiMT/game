shader_type spatial;
// Stepping stones that exist only in the reflected world: faint cyan outlines that brighten near the eidolon.
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform vec3 near_pos = vec3(0.0, -100.0, 0.0);
uniform float visible = 0.0;
uniform float solid = 0.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 f = fract(wp.xz * 0.999 + 0.0005);
	vec2 e = min(f, 1.0 - f);
	float ed = min(e.x, e.y);
	float aa = fwidth(wp.x) * 1.5;
	float line = 1.0 - smoothstep(0.03, 0.03 + aa, ed);
	float fill = 0.08;
	float near = 1.0 - smoothstep(0.5, 2.6, length(wp.xz - near_pos.xz));
	float wave = 0.7 + 0.3 * sin(TIME * 1.7 + wp.x * 1.3 + wp.z * 0.9);
	float a = (line * 0.8 + fill) * (0.25 + near * 0.9) * wave * visible * (1.0 - solid);
	ALBEDO = accent_core.rgb * a;
}
