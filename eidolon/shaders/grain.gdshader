shader_type canvas_item;
// Film grain + vignette in one premultiplied pass.
render_mode blend_premul_alpha;

uniform float grain = 0.055;
uniform float vignette = 0.62;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void fragment() {
	vec2 uv = SCREEN_UV;
	float t = floor(TIME * 24.0);
	float g = hash(floor(FRAGCOORD.xy * 0.75) + t * 17.13) * 2.0 - 1.0;
	vec2 c = uv - 0.5;
	c.x *= 1.15;
	float v = smoothstep(0.32, 0.92, length(c)) * vignette;
	float add = max(g, 0.0) * grain * 0.6;
	float dark = max(-g, 0.0) * grain;
	COLOR = vec4(vec3(add), clamp(v + dark, 0.0, 1.0));
}
