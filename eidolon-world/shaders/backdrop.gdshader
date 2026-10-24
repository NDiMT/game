shader_type canvas_item;
// Background behind the 3D world: pale lit fog above, deep grey void below.
uniform vec3 top : source_color = vec3(0.80, 0.79, 0.76);
uniform vec3 mid : source_color = vec3(0.70, 0.70, 0.69);
uniform vec3 bottom : source_color = vec3(0.36, 0.37, 0.38);

void fragment() {
	float y = SCREEN_UV.y;
	vec3 c = mix(top, mid, smoothstep(0.0, 0.5, y));
	c = mix(c, bottom, smoothstep(0.5, 1.05, y));
	COLOR = vec4(c, 1.0);
}
