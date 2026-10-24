shader_type spatial;
// v0.3 perf: the three soft additive light shafts in ONE camera-plane quad (they used to be three
// overlapping blended quads, ~2.8 screens of fill; now about one). Same shapes as shaft.gdshader:
// each shaft is a (w x 30) quad at (x, 7) in the camera rig's pitch plane, turned by `rot`.
render_mode unshaded, blend_add, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

uniform vec3 sx = vec3(-3.4, 1.6, 5.2);
uniform vec3 rot = vec3(0.30, 0.26, 0.34);
uniform vec3 wid = vec3(3.2, 2.2, 3.8);
uniform vec3 phase = vec3(0.0, 2.0, 4.0);
uniform vec3 intensity = vec3(0.20, 0.16, 0.14);
uniform vec2 offset = vec2(0.0, 7.0);

varying vec2 lp;
void vertex() { lp = VERTEX.xy + offset; }

float shaft(vec2 p, float x0, float th, float w, float ph, float k) {
	vec2 d = p - vec2(x0, 7.0);
	float c = cos(th), s = sin(th);
	vec2 u = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
	vec2 uv = vec2(u.x / w + 0.5, 0.5 - u.y / 30.0);
	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
	float x = abs(uv.x - 0.5) * 2.0;
	float across = pow(1.0 - smoothstep(0.0, 1.0, x), 2.0);
	float along = smoothstep(0.0, 0.25, uv.y) * smoothstep(1.0, 0.55, uv.y);
	float breathe = 0.7 + 0.3 * sin(TIME * 0.35 + ph);
	float streak = 0.8 + 0.2 * sin(uv.x * 30.0 + ph * 7.0 + TIME * 0.2);
	return across * along * breathe * streak * k;
}

void fragment() {
	float v = shaft(lp, sx.x, rot.x, wid.x, phase.x, intensity.x)
		+ shaft(lp, sx.y, rot.y, wid.y, phase.y, intensity.y)
		+ shaft(lp, sx.z, rot.z, wid.z, phase.z, intensity.z);
	if (v <= 0.0) discard;
	ALBEDO = vec3(1.0, 0.97, 0.9) * v;
}
