shader_type spatial;
// v0.6: a faint bronze grid inlaid in the Hall of Glass's black floor, whole metres (cell centres on
// whole numbers): the glass reflects it too, so a place in the glass can be counted out on the floor.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back;
uniform vec4 rect = vec4(-4.5, -20.5, 4.5, -11.5);
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	if (wp.x < rect.x || wp.x > rect.z || wp.z < rect.y || wp.z > rect.w) discard;
	vec2 g = abs(fract(wp.xz + 0.5) - 0.5);            // 0 on a cell's centre lines... 0.5 at its edges
	vec2 e = 0.5 - g;                                   // distance to the nearest edge line
	float aa = fwidth(wp.x) * 1.2;
	float line = 1.0 - smoothstep(0.012, 0.012 + aa, min(e.x, e.y));
	// small bronze studs where the lines cross
	float stud = 1.0 - smoothstep(0.035, 0.035 + aa, length(e));
	float fade = smoothstep(0.0, 0.6, min(min(wp.x - rect.x, rect.z - wp.x), min(wp.z - rect.y, rect.w - wp.z)));
	ALBEDO = vec3(0.42, 0.36, 0.26);
	ALPHA = max(line * 0.45, stud * 0.8) * fade;
}
