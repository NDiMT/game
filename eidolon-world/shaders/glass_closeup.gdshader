shader_type canvas_item;
// v0.5b: the close-up of a small fogged pane (GlassTalk). Behind the glass: dim stone and HER faint,
// faceless silhouette. On it: your breath as fog, thinning at the edges. The wipe mask (a SubViewport
// drawn by GlassTalk.Ink): R = clear glass where a finger passed (hers or yours), G = a faint hint
// trace, B = her fingertip on the glass (v0.8.1: her pressed hand is drawn here, see hand_d). `glow` lights the finished glyph
// in the carved-glow colours.
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
uniform sampler2D mask : filter_linear, repeat_disable;
uniform sampler2D mask_mine : filter_linear, repeat_disable;    // v0.8: your strokes; the rest is hers (v0.8.1: both aqua, hers softer)
global uniform vec4 her;
global uniform vec4 her_core;
uniform float fog = 1.0;
uniform float glow = 0.0;
uniform float t = 0.0;
// v0.7: her hand behind the glass (mask uv): the fingertip while she writes, the palm she presses flat
uniform vec2 finger = vec2(-9.0);
uniform float finger_k = 0.0;
uniform vec2 palm_at = vec2(-9.0);
uniform float palm_k = 0.0;
uniform sampler2D her_tex : filter_linear, repeat_disable;    // v0.8: her (the model) rendered behind the pane
// her coverage seen through fog: a disc of taps whose radius grows with the fog's density
float her_cov(vec2 uv, float r) {
	float c = texture(her_tex, uv).a * 0.2;
	for (int i = 0; i < 8; i++) {
		float a = float(i) * 0.785398 + 0.3;
		vec2 o = vec2(cos(a), sin(a) * 0.75);
		c += texture(her_tex, uv + o * r * 0.45).a * 0.04;
		c += texture(her_tex, uv + o * r).a * 0.06;
	}
	return clamp(c, 0.0, 1.0);
}

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
// ---- v0.8.2: HER HAND, ONE soft shape. A palm pressed on steamy glass, seen from the other side: no bones,
// no joints, no separate mounds. The palm is one rounded shape (a little fuller on the thumb side); each
// finger is ONE smoothly tapering, gently curving stroke, and fingers and thumb flow into the palm through
// wide smooth unions (the webs between them); the fingers stay apart from each other. Authored in the
// hand's frame (heel at 0, middle fingertip near 0.89: middle finger = 0.9 x the palm's length; thumb
// toward +x, y up) and placed as her LEFT hand, palm-on. Besides its distance it gives `con`, how hard
// the skin presses: the five fingertip pads and the heel most, the fingers and the knuckle line well,
// the middle of the palm a little less; never a line or a gap. `rid` / `rv`: a whisper of the whorls.
uniform float press_t = 0.0;            // seconds since her palm touched the glass (the droplets run)
float sd_tcap(vec2 p, vec2 a, vec2 b, float ra, float rb, out float tq) {
	vec2 pa = p - a, ba = b - a;
	tq = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * tq) - mix(ra, rb, tq);
}
vec2 dir_of(float an) { return vec2(sin(an), cos(an)); }
float g2(vec2 h, vec2 c, vec2 r) { vec2 q = (h - c) / r; return exp(-dot(q, q)); }
float sd_palm(vec2 p) {
	vec2 v[5] = vec2[5](vec2(0.075, 0.07), vec2(0.13, 0.4), vec2(0.03, 0.43), vec2(-0.12, 0.38), vec2(-0.085, 0.08));
	float d = dot(p - v[0], p - v[0]);
	float s = 1.0;
	for (int i = 0; i < 5; i++) {
		int j = (i + 4) % 5;
		vec2 e = v[j] - v[i];
		vec2 w = p - v[i];
		vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
		d = min(d, dot(b, b));
		bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
		if (all(c) || all(not(c))) s *= -1.0;
	}
	return s * sqrt(d);
}
// one finger: a single tapering stroke from its root, bending gently (two spans, the same radius where
// they meet, so no joint shows); curl 0 lies flat on the glass, 1 folds away (shorter, out of the print).
// Returns its distance; `tip` = the centre of its fingertip pad.
float finger_sd(vec2 h, vec2 base, float an, float len, float r, float bend, float curl, out vec2 tip) {
	float L = len * (1.0 - 0.62 * curl);
	vec2 m = base + dir_of(an) * L * 0.55;
	vec2 e = m + dir_of(an + bend) * (L * 0.45 - r * 0.72);
	float tq;
	float d = min(sd_tcap(h, base, m, r, r * 0.86, tq), sd_tcap(h, m, e, r * 0.86, r * 0.72, tq));
	tip = e - dir_of(an + bend) * r * 0.15;
	return d;
}
float hand_d(vec2 h, float pose, out float con, out float rid, out float rv, out float arm) {
	arm = 9.0;                                    // (no forearm: the wrist simply fades below the heel)
	rid = 0.0; rv = 0.0;
	float tq;
	float d = sd_palm(h) - 0.065;
	d = smin(d, length((h - vec2(0.105, 0.19)) / vec2(1.0, 1.35)) - 0.105, 0.05);      // the thumb's fullness (no separate mound: one shape)
	d = smin(d, sd_tcap(h, vec2(0.0, 0.1), vec2(0.0, -0.22), 0.1, 0.092, tq), 0.06);                              // the wrist
	// the thumb, angled out from the base of the palm
	vec2 t0 = vec2(0.1, 0.13);
	vec2 t1 = mix(vec2(0.225, 0.255), vec2(0.18, 0.25), pose);
	vec2 t2 = mix(vec2(0.315, 0.37), vec2(0.13, 0.33), pose);
	float dT = min(sd_tcap(h, t0, t1, 0.056, 0.046, tq), sd_tcap(h, t1, t2, 0.046, 0.035, tq));
	d = smin(d, dT, 0.055);
	// the four fingers, slender, slightly spread; their roots melt into the palm (wide unions: the webs)
	float co = pose * 0.85;
	vec2 ti, tm, tr, tl;
	float fi = finger_sd(h, vec2(0.115, 0.4), mix(0.15, 0.05, pose), 0.37, 0.041, -0.04, 0.0, ti);
	float fm = finger_sd(h, vec2(0.03, 0.42), mix(0.03, 0.0, pose), 0.42, 0.043, -0.015, co, tm);
	float fr = finger_sd(h, vec2(-0.055, 0.405), mix(-0.1, -0.04, pose), 0.39, 0.04, 0.025, co, tr);
	float fl = finger_sd(h, vec2(-0.13, 0.37), mix(-0.27, -0.1, pose), 0.3, 0.034, 0.06, co, tl);
	float fingers = min(min(fi, fm), min(fr, fl));
	d = smin(d, fingers, 0.045);
	// how hard it presses: a soft whole-hand print, the fingertip pads and the heel the clearest
	float inside = smoothstep(0.0, 0.03, -d);
	float c = 0.55;
	c -= 0.22 * g2(h, vec2(0.0, 0.27), vec2(0.085, 0.08));                    // the hollow of the palm (only a little)
	c = max(c, 0.95 * g2(h, vec2(0.0, 0.11), vec2(0.13, 0.075)));             // the heel
	c = max(c, 0.82 * g2(h, vec2(0.11, 0.2), vec2(0.06, 0.09)));             // the thumb's mound
	c = max(c, 0.72 * g2(h, vec2(0.0, 0.39), vec2(0.15, 0.04)));             // along the knuckles
	c = max(c, 0.66 * smoothstep(0.0, 0.02, -fingers));                       // the fingers
	float pads = 0.0;
	pads = max(pads, g2(h, ti, vec2(0.045)));
	pads = max(pads, g2(h, tm, vec2(0.047)) * (1.0 - co));
	pads = max(pads, g2(h, tr, vec2(0.044)) * (1.0 - co));
	pads = max(pads, g2(h, tl, vec2(0.038)) * (1.0 - co));
	pads = max(pads, g2(h, t2, vec2(0.05)) * (1.0 - pose));
	c = max(c, pads);
	con = c * inside * (1.0 - pose) * smoothstep(-0.04, 0.06, h.y);
	// a whisper of the whorls on the fingertip pads (faded out where they would alias)
	vec2 pc = ti;
	float best = length(h - ti);
	if (length(h - tm) < best) { pc = tm; best = length(h - tm); }
	if (length(h - tr) < best) { pc = tr; best = length(h - tr); }
	if (length(h - tl) < best) { pc = tl; best = length(h - tl); }
	rid = pads * smoothstep(0.004, 0.012, best) * (1.0 - pose);
	rv = sin(length((h - pc) * vec2(1.0, 0.8)) * 6.2832 / 0.0115);
	return d;
}
// the pane (aspect-corrected units) into the hand's frame: hand point `lp` lies at `at`, tilted by
// `th`, scaled by L (pane widths per hand length); a left hand, palm-on (the authored image mirrored)
vec2 to_hand(vec2 P, vec2 at, vec2 lp, float th, float L) {
	vec2 v = (P - at) / L;
	float c = cos(th), s = sin(th);
	v = vec2(c * v.x + s * v.y, -s * v.x + c * v.y);
	return lp - v;
}
vec2 from_hand(vec2 h, vec2 at, vec2 lp, float th, float L) {
	vec2 v = (lp - h) * L;
	float c = cos(th), s = sin(th);
	return at + vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
const float HAND_L = 0.46;
const vec2 HAND_LP = vec2(0.0, 0.3);       // the middle of her palm sits where your stroke ended
const float HAND_TH = -0.08;

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
	float mm = texture(mask_mine, uv).r * 0.4;
	mm += texture(mask_mine, uv + vec2(px.x * 1.5, 0.0)).r * 0.15;
	mm += texture(mask_mine, uv - vec2(px.x * 1.5, 0.0)).r * 0.15;
	mm += texture(mask_mine, uv + vec2(0.0, px.y * 1.5)).r * 0.15;
	mm += texture(mask_mine, uv - vec2(0.0, px.y * 1.5)).r * 0.15;
	float yours = clamp(mm, 0.0, 1.0) / max(clamp(m.r, 0.0, 1.0) + clamp(mm, 0.0, 1.0), 0.001);
	float wipe = clamp(max(m.r, mm), 0.0, 1.0);
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
	vec2 A = vec2(1.0, 1.33);
	vec2 P = uv * A;
	float cov = her_cov(uv, w);
	float sil = smoothstep(0.08, 0.92, cov);
	float sd = (0.5 - cov) * w * 2.0;                      // (a signed distance from her coverage)
	// v0.8.1: her hand. While she writes: the pointing hand, close behind the fog, only the fingertip
	// on the glass. At the end: her hand comes out of the fog (blurred, smaller, farther) and presses
	// flat: where the skin touches, the fog is gone and the print is sharp (the fingertip pads and the
	// heel cleanest); round it the condensation thickens; then droplets run down from it.
	float arm_m = 0.0, hand_m = 0.0, prnt = 0.0, halo = 0.0, soft = 0.0, hdist = 9.0, press = 0.0, inner = 0.0;
	float con = 0.0, rid = 0.0, rv = 0.0, armd = 9.0;
	if (finger_k > 0.01) {
		vec2 tip = finger * A;
		vec2 D = normalize(tip - vec2(0.72, 0.83) * A + vec2(0.0001));
		float th = atan(D.x, -D.y);
		vec2 h = to_hand(P, tip, vec2(0.14, 0.79), th, HAND_L);
		float dd = hand_d(h, 1.0, con, rid, rv, armd) * HAND_L;
		float wp = w * 0.25 + 0.01;            // (close behind the glass: softened by the fog, still a hand)
		hand_m = max(1.0 - smoothstep(-wp, wp, dd), (1.0 - smoothstep(-w - 0.03, w + 0.03, armd * HAND_L)) * 0.85) * finger_k;
		hdist = dd;
	}
	if (palm_k > 0.01) {
		float nearer = smoothstep(0.0, 0.55, palm_k);
		press = smoothstep(0.4, 1.0, palm_k);
		float L = HAND_L * mix(0.84, 1.0, nearer);
		vec2 h = to_hand(P, palm_at * A, HAND_LP, HAND_TH, L);
		float dd = hand_d(h, 0.0, con, rid, rv, armd) * L;
		float aa = max(fwidth(dd), 0.0005);
		// (sharp where the hand meets the glass; the wrist and forearm lean away, softer and softer)
		float wb = mix(w + 0.05, mix(aa + 0.004 + w * 0.05, 0.03 + w * 0.3, smoothstep(0.1, -0.2, h.y)), press);
		float hm = (1.0 - smoothstep(-wb, wb, dd)) * nearer * smoothstep(-0.2, 0.05, h.y);   // (v0.8.2: no forearm: the wrist fades into the fog)
		float am = (1.0 - smoothstep(-w - 0.07, w + 0.07, armd * L)) * nearer * 0.7;
		inner = 1.0 - smoothstep(-aa, aa, dd);
		hand_m = max(hand_m, hm);
		arm_m = am;
		hdist = min(hdist, dd);
		// the print: contact sharpened, a fine frost of micro-droplets in it, the fingertip whorls
		float pr = smoothstep(0.12, 0.9, con) * press;
		pr *= mix(0.55 + 0.45 * vnoise(uv * vec2(300.0, 400.0)), 1.0, smoothstep(0.3, 0.8, con));    // a frost of micro-droplets where it barely touched
		float rvis = 1.0 - smoothstep(0.35, 0.9, fwidth(rv));
		pr *= 1.0 - 0.08 * rid * (0.5 + 0.5 * rv) * rvis;
		prnt = pr;
		soft = inner * press * (1.0 - pr);
		halo = (1.0 - inner) * exp(-max(dd, 0.0) / 0.018) * press * smoothstep(-0.2, 0.05, h.y);
	}
	// droplets: from the heel, the thumb and the little finger, slow at first, then running
	float drop_c = 0.0, bead_m = 0.0, bead_hl = 0.0, bead_rim = 0.0;
	if (press_t > 0.0 && palm_k > 0.5) {
		vec2 srcs[5] = vec2[5](vec2(-0.085, 0.05), vec2(0.005, 0.02), vec2(0.08, 0.04), vec2(0.37, 0.36), vec2(-0.255, 0.64));
		float dl[5] = float[5](0.7, 1.4, 2.0, 1.0, 2.6);
		float sp[5] = float[5](0.03, 0.04, 0.026, 0.034, 0.022);
		float aa2 = max(fwidth(P.x), 0.0005);
		for (int i = 0; i < 5; i++) {
			float tt = press_t - dl[i];
			if (tt <= 0.0) continue;
			float fi = float(i);
			vec2 s0 = from_hand(srcs[i], palm_at * A, HAND_LP, HAND_TH, HAND_L);
			float y = min(sp[i] * tt * tt / (tt + 0.9), 0.4);
			float ry = P.y - s0.y;
			float wob = 0.0022 * sin(ry * 55.0 + fi * 2.1) + 0.0012 * sin(ry * 131.0 + fi);
			float tw = 0.0022 + 0.0016 * clamp(ry / max(y, 0.001), 0.0, 1.0);
			float tr = (1.0 - smoothstep(tw - aa2, tw + aa2, abs(P.x - s0.x - wob))) * step(0.0, ry) * step(ry, y);
			drop_c = max(drop_c, tr * (0.55 + 0.45 * smoothstep(0.0, 0.02, ry)));
			float hw = 0.0022 * sin(y * 55.0 + fi * 2.1) + 0.0012 * sin(y * 131.0 + fi);
			vec2 hd2 = P - (s0 + vec2(hw, y));
			float rb = 0.0085 * smoothstep(0.0, 0.01, y + 0.004);
			float db = length(hd2 * vec2(1.0, 0.82)) - rb;
			float bm = 1.0 - smoothstep(-aa2, aa2, db);
			bead_m = max(bead_m, bm);
			bead_rim = max(bead_rim, bm * smoothstep(0.2, 0.95, hd2.y / max(rb, 0.001)) * 0.8);     // light gathered at its lower edge
			bead_hl = max(bead_hl, exp(-dot(hd2 + vec2(0.0028, 0.003), hd2 + vec2(0.0028, 0.003)) / (0.002 * 0.002)));
		}
	}
	float glowd = max(her_cov(uv, w * 2.5 + 0.05), exp(-max(hdist, 0.0) / (0.04 + 0.16 * dens)) * max(finger_k, smoothstep(0.0, 0.55, palm_k)));     // the fog scatters her shadow
	vec3 shade = vec3(0.07, 0.08, 0.09);
	vec3 skin_far = mix(vec3(0.33, 0.345, 0.36), vec3(0.52, 0.535, 0.545), press);      // (nearer the glass than she is: lighter; pressed, it catches your light)
	back = mix(back, shade, max(sil, arm_m) * 0.9);
	back = mix(back, skin_far + vec3(0.07) * smoothstep(0.0, 0.5, con) * press, hand_m * 0.92);
	float her_m = mix(max(sil, arm_m), 0.3, hand_m);      // (her hand, nearer the glass, is not darkened like her body)
	back = mix(back, back * 0.82, glowd * 0.35 * (1.0 - max(sil, hand_m)));
	back += vec3(0.42, 0.5, 0.56) * 0.08 * (1.0 - smoothstep(0.0, w + 0.01, abs(sd))) * (1.0 - dens);    // a cold rim where she is clear
	cond *= 1.0 - prnt * 0.97;
	cond *= 1.0 - 0.15 * soft;
	cond *= 1.0 - 0.85 * max(drop_c, bead_m);
	cond = mix(cond, min(cond * 1.3 + 0.06, 1.0), halo * fog);
	vec3 fogc = vec3(0.82, 0.85, 0.87);
	vec3 c = mix(back, fogc, cond * 0.86 * (1.0 - 0.3 * her_m));
	c *= 1.0 - her_m * 0.42 * cond;                       // seen through the fog, a darker, diffuse shape
	// her skin where it touches: pale as marble, a little shadow where it presses less
	vec3 skin = vec3(0.83, 0.85, 0.855) * (0.78 + 0.22 * smoothstep(0.1, 0.95, con));
	c = mix(c, skin, prnt * 0.88);
	c += her.rgb * prnt * glow * 0.1;
	// the droplets: clear trails, beads with a dark lensing body and a bright point
	c = mix(c, back * 0.9 + vec3(0.1), bead_m * 0.35);
	c += vec3(0.95) * bead_hl * 0.85 * bead_m;
	c += vec3(0.5) * bead_rim;
	// droplets at the edges of a wiped line: tiny bright beads
	float rim = smoothstep(0.08, 0.3, wipe) * (1.0 - smoothstep(0.35, 0.7, wipe));
	float bead = step(0.93, h21(floor(uv * vec2(160.0, 213.0))));
	c = mix(c, vec3(0.97, 0.99, 1.0), rim * bead * fog * 0.8);
	// her fingertip, pressed against the glass from her side: pale, softly lit
	c = mix(c, vec3(0.78, 0.86, 0.87), palm * 0.55);
	c += her.rgb * palm * glow * 0.25;
	// the finished glyph glows in the carved-glow colours, blooming a little into the fog
	float core = smoothstep(0.55, 0.95, wipe);
	float bloom = smoothstep(0.02, 0.5, wipe) * (1.0 - core);
	// (v0.6: every wiped line keeps a faint carved glow; the answered glyph lights fully)
	float gk = max(glow, 0.5);
	// (v0.8.1: her lines and yours are the same aqua; hers softer)
	vec3 lc = mix(her.rgb, accent.rgb, yours);
	vec3 lcc = mix(her_core.rgb, accent_core.rgb, yours);
	float hk = mix(0.72, 1.0, yours);       // (v0.8.1: one aqua; her lines softer than yours)
	c = mix(c, mix(lc, lcc, core * 0.85), (core * 0.9 + bloom * 0.45) * gk * hk);
	c += lcc * core * 0.12 * gk;
	// a faint sheen across the glass, and the bronze frame
	c += vec3(0.05) * smoothstep(0.035, 0.0, abs(uv.x * 0.7 - uv.y * 0.45 + 0.1));
	float frame = 1.0 - smoothstep(0.0, 0.025, em);
	c = mix(c, vec3(0.16, 0.14, 0.11), frame);
	COLOR = vec4(c, 1.0);
}
