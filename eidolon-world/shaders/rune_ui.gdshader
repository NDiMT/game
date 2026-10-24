shader_type canvas_item;
// A rune drawn in the UI (reading a statue): same SDF language as the world.
#include "res://shaders/glyphs.gdshaderinc"
uniform float design = 0.0;
uniform float numeral = 0.0;
uniform float alpha = 1.0;
uniform vec4 color : source_color = vec4(0.30, 0.92, 1.0, 1.0);
void fragment() {
	vec2 p = (UV - vec2(0.5, 0.42)) * vec2(2.3, 2.75);
	vec2 rp = vec2(p.x, -p.y);
	float d = rune_dist(rp, int(design + 0.5));
	int n = int(numeral + 0.5);
	for (int i = 0; i < 3; i++) {
		if (i >= n) break;
		float x = (float(i) - float(n - 1) * 0.5) * 0.24;
		d = min(d, g_seg(rp, vec2(x, -1.12), vec2(x, -1.42)));
	}
	vec2 rm = rune_mask(d);
	vec3 hot = mix(color.rgb, vec3(0.93, 1.0, 1.0), 0.55);
	COLOR = vec4(mix(color.rgb, hot, rm.x), clamp(rm.x + rm.y * 0.7, 0.0, 1.0) * alpha);
}
