shader_type canvas_item;
// v0.5b: the close-up of a small fogged pane (GlassTalk). Behind the glass: dim stone and HER faint,
// faceless silhouette. On it: your breath as fog, thinning at the edges. The wipe mask (a SubViewport
// drawn by GlassTalk.Ink): R = clear glass where a finger passed (hers or yours), G = a faint hint
// trace, B = her fingertip / her palm pressed from the other side. `glow` lights the finished glyph
// in the carved-glow colours.
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
uniform sampler2D mask : filter_linear, repeat_disable;
uniform float fog = 1.0;
uniform float glow = 0.0;
uniform float t = 0.0;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}

void fragment() {
	vec2 uv = UV;
	// --- behind the glass: dark stone, a cold light, her silhouette (a hood, shoulders), no face
	vec2 q = (uv - vec2(0.5, 0.42)) * vec2(1.0, 1.33);
	vec3 back = mix(vec3(0.24, 0.27, 0.29), vec3(0.42, 0.45, 0.47), smoothstep(1.0, 0.0, uv.y));
	float head = length((q - vec2(0.0, -0.18)) * vec2(1.25, 1.0)) - 0.17;
	float body = max(abs(q.x) - (0.2 + max(q.y + 0.02, 0.0) * 0.7), -q.y - 0.02);
	float sil = 1.0 - smoothstep(-0.02, 0.06, min(head, body));
	back = mix(back, vec3(0.07, 0.08, 0.09), sil * 0.8);
	// --- the mask, softened (the wiped edges are soft, as on real glass)
	vec2 px = 1.0 / vec2(textureSize(mask, 0));
	vec4 m = texture(mask, uv) * 0.4;
	m += texture(mask, uv + vec2(px.x * 1.5, 0.0)) * 0.15;
	m += texture(mask, uv - vec2(px.x * 1.5, 0.0)) * 0.15;
	m += texture(mask, uv + vec2(0.0, px.y * 1.5)) * 0.15;
	m += texture(mask, uv - vec2(0.0, px.y * 1.5)) * 0.15;
	float wipe = clamp(m.r, 0.0, 1.0);
	float hint = clamp(m.g, 0.0, 1.0);
	float palm = clamp(m.b, 0.0, 1.0);
	// --- the fog: your breath, uneven, thinning (dissipating) at the edges of the pane
	float n = vnoise(uv * vec2(7.0, 9.0) + t * 0.05) * 0.6 + vnoise(uv * vec2(23.0, 29.0) - t * 0.03) * 0.4;
	float em = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
	float edge = smoothstep(0.0, 0.16 + 0.04 * sin(t * 0.4), em + n * 0.05);
	float cond = fog * edge * (0.56 + 0.3 * n);          // (thin enough to show her, dimly)
	cond *= 1.0 - smoothstep(0.25, 0.85, wipe);
	cond *= 1.0 - hint * 0.45;
	vec3 fogc = vec3(0.82, 0.85, 0.87);
	vec3 c = mix(back, fogc, cond);
	// droplets at the edges of a wiped line: tiny bright beads
	float rim = smoothstep(0.08, 0.3, wipe) * (1.0 - smoothstep(0.35, 0.7, wipe));
	float bead = step(0.93, h21(floor(uv * vec2(160.0, 213.0))));
	c = mix(c, vec3(0.97, 0.99, 1.0), rim * bead * fog * 0.8);
	// her fingertip and her palm, pressed against the glass from her side: pale, softly lit
	c = mix(c, vec3(0.78, 0.86, 0.87), palm * 0.55);
	c += accent.rgb * palm * glow * 0.25;
	// the finished glyph glows in the carved-glow colours, blooming a little into the fog
	float core = smoothstep(0.55, 0.95, wipe);
	float bloom = smoothstep(0.02, 0.5, wipe) * (1.0 - core);
	// (v0.6: every wiped line keeps a faint carved glow; the answered glyph lights fully)
	float gk = max(glow, 0.5);
	c = mix(c, mix(accent.rgb, accent_core.rgb, core * 0.85), (core * 0.9 + bloom * 0.45) * gk);
	c += accent_core.rgb * core * 0.12 * gk;
	// a faint sheen across the glass, and the bronze frame
	c += vec3(0.05) * smoothstep(0.035, 0.0, abs(uv.x * 0.7 - uv.y * 0.45 + 0.1));
	float frame = 1.0 - smoothstep(0.0, 0.025, em);
	c = mix(c, vec3(0.16, 0.14, 0.11), frame);
	COLOR = vec4(c, 1.0);
}
