shader_type canvas_item;
// v2.0 (Agent A) the intro's text cards (scripts/fx/intro_card.gd, IntroCard): on a Label. `reveal` 0..1: the ink spreads
// in through a soft noisy front (as if soaking into wet paper); `fade` 0..1: it dissolves out into fog (paling, breaking
// up). The noise runs in the Label's own space (VERTEX), so a whole line dissolves as one sheet.
uniform float reveal = 1.0;
uniform float fade = 0.0;
uniform vec4 fog_col : source_color = vec4(0.7, 0.72, 0.74, 1.0);
varying vec2 lp;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void vertex() { lp = VERTEX; }
void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	float n = vnoise(lp * 0.012) * 0.6 + vnoise(lp * 0.045 + 7.0) * 0.3 + vnoise(lp * 0.2) * 0.1;
	float r = smoothstep(n - 0.12, n + 0.12, reveal * 1.25 - 0.12);
	float f = smoothstep(n - 0.18, n + 0.18, fade * 1.35 - 0.17);
	c.rgb = mix(c.rgb, fog_col.rgb, f * 0.7);
	c.a *= r * (1.0 - f) * (0.92 + 0.08 * vnoise(lp * 0.6 + TIME));
	COLOR = c;
}
