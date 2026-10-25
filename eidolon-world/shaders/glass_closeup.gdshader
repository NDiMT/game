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
// v0.7: her hand behind the glass (mask uv): the fingertip while she writes, the palm she presses flat
uniform vec2 finger = vec2(-9.0);
uniform float finger_k = 0.0;
uniform vec2 palm = vec2(-9.0);
uniform float palm_k = 0.0;

float sd_ell(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
float sd_cap(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }

// her shade: a veiled head and shoulders close behind the pane, swaying and breathing (signed distance,
// in pane units with y down, aspect-corrected)
float her_sd(vec2 uv, float tt) {
	vec2 q = (uv - vec2(0.5 + 0.012 * sin(tt * 0.53) + 0.006 * sin(tt * 1.31), 0.47)) * vec2(1.0, 1.33);
	float br = 0.006 * sin(tt * 1.65);
	float head = sd_ell(q - vec2(0.0, -0.16 + br), vec2(0.15, 0.19));
	// the veil falls from the crown over the shoulders, flaring
	float veil = sd_cap(q, vec2(0.0, -0.26 + br), vec2(0.0, 0.1 + br), 0.13 + max(q.y + 0.1, 0.0) * 0.55);
	float sh = sd_ell(q - vec2(0.0, 0.42 + br * 0.5), vec2(0.42, 0.28));
	float d = smin(min(head, veil), sh, 0.08);
	return d;
}
// her arm and hand rising to the glass (fingertip at f, or the palm at p pressed flat)
float hand_sd(vec2 uv, vec2 f, float fk, vec2 pm, float pk) {
	vec2 a = vec2(1.0, 1.33);
	float d = 9.0;
	if (fk > 0.01) {
		vec2 tip = f * a;
		vec2 sho = vec2(0.5 + 0.22, 0.47 + 0.36) * a;
		vec2 wrist = tip + vec2(0.035, 0.11);
		d = min(sd_cap(uv * a, sho, wrist, 0.045 * fk + 0.001), sd_ell(uv * a - (wrist + tip) * 0.5, vec2(0.045, 0.075)));
	}
	if (pk > 0.01) d = min(d, sd_ell(uv * a - pm * a - vec2(0.0, 0.02), vec2(0.075, 0.095) * pk));
	return d;
}

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}

void fragment() {
	vec2 uv = UV;
	// --- behind the glass: dark stone, a cold light, her silhouette (a hood, shoulders), no face
	vec3 back = mix(vec3(0.24, 0.27, 0.29), vec3(0.42, 0.45, 0.47), smoothstep(1.0, 0.0, uv.y));
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
	// v0.7: SHE is there, close behind the pane: frosted by the fog (a wide, soft blur that grows with its
	// density), sharp where a stroke has cleared the glass; her palm sharpens where it touches
	float dens = clamp(cond * 1.35, 0.0, 1.0);
	float w = mix(0.006, 0.12, dens);
	float sd = her_sd(uv, t);
	float hd = hand_sd(uv, finger, finger_k, palm, palm_k);
	float sil = 1.0 - smoothstep(-w, w, sd);
	float wh = mix(w, 0.004, palm_k * (1.0 - smoothstep(0.0, 0.08, hd + 0.02)));
	float hand = 1.0 - smoothstep(-wh, wh, hd);
	float glowd = exp(-max(min(sd, hd), 0.0) / (0.04 + 0.16 * dens));     // the fog scatters her shadow
	vec3 shade = vec3(0.07, 0.08, 0.09);
	back = mix(back, shade, max(sil, hand) * 0.9);
	back = mix(back, back * 0.82, glowd * 0.35 * (1.0 - max(sil, hand)));
	back += vec3(0.42, 0.5, 0.56) * 0.08 * (1.0 - smoothstep(0.0, w + 0.01, abs(sd))) * (1.0 - dens);    // a cold rim where she is clear
	vec3 fogc = vec3(0.82, 0.85, 0.87);
	vec3 c = mix(back, fogc, cond * 0.86);
	c *= 1.0 - max(sil, hand) * 0.22 * cond;              // seen through the fog, a darker shape
	c = mix(c, vec3(0.80, 0.84, 0.85), palm_k * (1.0 - smoothstep(-0.004, 0.006, hd)) * 0.5);   // the pressed palm, pale
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
