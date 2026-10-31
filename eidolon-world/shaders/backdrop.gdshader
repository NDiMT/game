shader_type canvas_item;
// Background behind the 3D world: pale lit fog above, deep grey void below.
uniform vec3 top : source_color = vec3(0.80, 0.79, 0.76);
uniform vec3 mid : source_color = vec3(0.70, 0.70, 0.69);
uniform vec3 bottom : source_color = vec3(0.40, 0.41, 0.42);
uniform vec2 sun_uv = vec2(0.82, 0.08);
uniform float aspect = 0.465;
uniform float dark = 0.0;            // (v1.0 A: World.set_darkness)

void fragment() {
	float y = SCREEN_UV.y;
	vec3 c = mix(top, mid, smoothstep(0.0, 0.5, y));
	c = mix(c, bottom, smoothstep(0.5, 1.05, y));
	// the sun, a soft warm disk lost in the fog
	vec2 d = (SCREEN_UV - sun_uv) * vec2(1.0, aspect);
	float r = length(d);
	c += vec3(0.16, 0.13, 0.08) * exp(-r * 4.5) + vec3(0.07, 0.06, 0.04) * (1.0 - smoothstep(0.035, 0.05, r));
	c = mix(c, vec3(0.03, 0.03, 0.035), dark * 0.95);
	COLOR = vec4(min(c, vec3(0.93)), 1.0);
}
