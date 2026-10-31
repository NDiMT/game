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
// ---- v1.0 (Agent A): a HUMAN FINGER on condensation (scripts/fx/fog_ink.gd draws the masks). The wipe is
// cleanest down the middle of the stroke and thins to its edges (FogInk's soft cross-section); the edge is
// ragged, the water gathered there in a bright rim of beads. From the AGE mask (when each texel was wiped,
// R:G = 16 bits of seconds mod 512, B = the stroke's seed, A = wiped) droplets grow along the edges, some
// run down leaving clear streaks, and the fog slowly re-condenses over old strokes. `prints`: the landing
// pad of each stroke keeps a faint whorl of fog lines (a fingertip's print).
uniform sampler2D mask_age : filter_nearest, repeat_disable;
uniform float ink_w = 0.05;              // the finger's width, in pane widths (FogInk)
uniform vec4 prints[8];                  // stroke starts: uv, birth (s mod 512), strength
uniform float drops_q = 1.0;             // 0: no running drops (a LOW quality tier)
uniform float recond = 0.55;             // how far old strokes fog over again (0..1)
const float AGE_MOD = 512.0;
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
	float inside = smoothstep(0.0, 0.018, -d);
	float c = 0.6;
	c -= 0.22 * g2(h, vec2(0.0, 0.27), vec2(0.085, 0.08));                    // the hollow of the palm (only a little)
	c = max(c, 0.95 * g2(h, vec2(0.0, 0.11), vec2(0.13, 0.075)));             // the heel
	c = max(c, 0.82 * g2(h, vec2(0.11, 0.2), vec2(0.06, 0.09)));             // the thumb's mound
	c = max(c, 0.7 * g2(h, vec2(0.0, 0.4), vec2(0.16, 0.05)));               // along the knuckles
	c = max(c, 0.64 * smoothstep(0.0, 0.018, -fingers) * smoothstep(0.38, 0.46, h.y));   // the fingers (above the knuckles: no stripes into the palm)
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

// seconds since this texel was wiped (-1: never), from the age mask
float age_at(vec2 uv, out float seed) {
	ivec2 ts = textureSize(mask_age, 0);
	vec4 a = texelFetch(mask_age, clamp(ivec2(uv * vec2(ts)), ivec2(0), ts - ivec2(1)), 0);
	seed = a.b;
	if (a.a < 0.5) return -1.0;
	float b = (floor(a.r * 255.0 + 0.5) * 256.0 + floor(a.g * 255.0 + 0.5)) / 65535.0 * AGE_MOD;
	return mod(t - b + AGE_MOD * 4.0, AGE_MOD);
}
// how much a finger wiped here (both masks, unblurred: for droplet sites)
float wipe_at(vec2 uv) { return max(texture(mask, uv).r, texture(mask_mine, uv).r); }
// a water bead / drop is a little LENS: remember the strongest one covering this pixel (centre, radius)
void bead(vec2 P, vec2 c, float r, float aa, inout float m, inout vec3 L) {
	vec2 d = (P - c) * vec2(1.0, 0.9);
	float bm = 1.0 - smoothstep(-aa, aa, length(d) - r);
	if (bm > m) { m = bm; L = vec3(c, r); }
}
// what is behind the glass at pane point uv, seen through CLEAN glass (sharp): the dim room, her shape
vec3 behind(vec2 uv) {
	vec3 b = mix(vec3(0.24, 0.27, 0.29), vec3(0.42, 0.45, 0.47), smoothstep(1.0, 0.0, uv.y));
	vec2 q = clamp(uv, 0.0, 1.0);
	float h = texture(her_tex, q).a * 0.4 + (texture(her_tex, q + vec2(0.006, 0.0)).a + texture(her_tex, q - vec2(0.006, 0.0)).a
		+ texture(her_tex, q + vec2(0.0, 0.006)).a + texture(her_tex, q - vec2(0.0, 0.006)).a) * 0.15;     // (her small render, smoothed)
	return mix(b, vec3(0.07, 0.08, 0.09), h * 0.9);
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
	cond *= 0.86 + 0.24 * smoothstep(0.25, 1.0, uv.y);    // (v1.0: breath fog settles denser low on the pane)
	// v1.0: the finger's wipe. Ragged at the edge (fine noise moves the threshold there), clean in the
	// middle, a thin streaky film between, the water gathered in a rim just outside; old strokes slowly
	// fog over again.
	float seed0;
	float age = age_at(uv, seed0);
	float wsoft = smoothstep(0.03, 0.25, wipe) * (1.0 - smoothstep(0.75, 1.05, wipe));
	float nf = vnoise(uv * vec2(85.0, 113.0) + seed0 * 9.0);
	float nf2 = vnoise(uv * vec2(260.0, 346.0));
	float wn = wipe + ((nf - 0.5) * 0.3 + (nf2 - 0.5) * 0.14) * wsoft;
	float clear = smoothstep(0.5, 0.86, wn);
	float film = smoothstep(0.15, 0.5, wn) * (1.0 - clear);
	float ridge = smoothstep(0.03, 0.15, wn) * (1.0 - smoothstep(0.17, 0.4, wn));
	float rc = age >= 0.0 ? recond * smoothstep(5.0, 45.0, age) : 0.0;
	// the finger's drag lines: faint streaks of film ALONG the stroke (its direction from the mask's gradient)
	float drag = 0.0;
	if (wipe > 0.05) {
		vec2 gx = vec2(px.x * 3.0, 0.0), gy = vec2(0.0, px.y * 3.0);
		vec2 gr = vec2(wipe_at(uv + gx) - wipe_at(uv - gx), (wipe_at(uv + gy) - wipe_at(uv - gy)) * 0.75);
		vec2 nrm = length(gr) > 1e-4 ? normalize(gr) : vec2(1.0, 0.0);
		vec2 tng = vec2(-nrm.y, nrm.x);
		vec2 Q = vec2(dot(uv * vec2(1.0, 1.333), nrm), dot(uv * vec2(1.0, 1.333), tng));
		drag = smoothstep(0.55, 0.95, vnoise(vec2(Q.x * 260.0, Q.y * 9.0) + seed0 * 13.0)) * 0.4
			+ smoothstep(0.62, 0.95, vnoise(vec2(Q.x * 700.0, Q.y * 22.0) + seed0 * 5.0)) * 0.2;
	}
	float streaky = 0.75 + 0.25 * vnoise(uv * vec2(40.0, 600.0) + seed0 * 3.0);     // the film's drag lines
	float wiped = (clear * (0.97 - 0.3 * drag) + film * 0.6 * streaky * (1.0 - 0.4 * drag)) * (1.0 - rc);
	cond *= 1.0 - wiped;
	cond = mix(cond, min(cond * 1.18 + 0.04, 1.0), ridge * fog * (1.0 - rc * 0.7));
	cond *= 1.0 - hint * 0.45;
	// the fingertip's print in the landing pad of each stroke: a faint whorl of fog lines, fading
	float fpf = 0.0;
	for (int i = 0; i < 8; i++) {
		vec4 pr = prints[i];
		if (pr.w <= 0.0 || pr.x < -1.0) continue;
		vec2 dq = (uv - pr.xy) * vec2(1.0, 1.333) / max(ink_w * 0.62, 0.004);
		float rr = length(dq * vec2(1.0, 0.82));
		float ins = 1.0 - smoothstep(0.7, 1.0, rr);
		if (ins <= 0.0) continue;
		float pa = mod(t - pr.z + AGE_MOD * 4.0, AGE_MOD);
		float wv = vnoise(dq * 1.7 + pr.xy * 61.0);
		float rg = 0.5 + 0.5 * sin((rr + 0.22 * wv) * 6.2832 * 4.6 + dq.x * 0.6);
		fpf = max(fpf, ins * smoothstep(0.5, 0.95, rg) * 0.18 * pr.w * (1.0 - smoothstep(18.0, 50.0, pa)));
	}
	cond = max(cond, fog * edge * fpf);
	// v0.7: SHE is there, close behind the pane: frosted by the fog (a wide, soft blur that grows with its
	// density), sharp where a stroke has cleared the glass; her palm sharpens where it touches
	float dens = clamp(cond * 1.35, 0.0, 1.0);
	float w = mix(0.011, 0.12, dens);          // (v1.0: never sharper than her small render allows)
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
		float pr = smoothstep(0.18, 0.78, con) * press;
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
	// v1.0: water on the glass. (a) beads: tiny droplets gather along the wiped edges a moment after the
	// finger passed and slowly swell; (b) drops: larger ones form along the edges, grow for a few seconds,
	// then some let go and run down (stick-slip, a slight wobble), leaving a clear streak that fogs over again
	float aa1 = max(fwidth(P.x), 0.0006);
	float wb_m = 0.0, streak = 0.0;
	vec3 lensL = vec3(-9.0, -9.0, 0.0);
	if (fog > 0.05) {
		vec2 G1 = vec2(105.0, 140.0);
		vec2 cid = floor(uv * G1);
		vec2 hc = vec2(h21(cid), h21(cid + 17.31));
		vec2 ctr = (cid + 0.3 + 0.4 * hc) / G1;
		float w0 = wipe_at(ctr);
		float sd0;
		float ca = age_at(ctr, sd0);
		// a site: in the wet halo round a stroke (aged, not wiped) or on its rim, never in the clear core
		float site = ca >= 0.0 ? (1.0 - smoothstep(0.25, 0.45, w0)) * mix(0.25, 1.0, smoothstep(0.005, 0.04, w0)) : 0.0;
		site *= smoothstep(0.3, 0.7, vnoise(uv * vec2(16.0, 21.0) + sd0 * 7.0));      // (they gather in clumps)
		float h3 = h21(cid + 41.7);
		if (site > 0.1 && h3 > 0.3) {
			float gr = smoothstep(0.3 + h3 * 1.6, 3.5 + h3 * 6.0, ca);
			float rb = mix(0.05, 0.34, pow((h3 - 0.3) / 0.7, 2.6)) * gr / G1.x * (1.0 - rc * 0.5) * (0.6 + 0.4 * site);
			if (rb > 0.0) bead(P, ctr * A, rb, aa1, wb_m, lensL);
		}
	}
	if (fog > 0.05 && drops_q > 0.0) {
		vec2 G2 = vec2(30.0, 40.0);
		vec2 cell = floor(uv * G2);
		for (int j = 0; j < 14; j++) {
			vec2 cc = cell - vec2(0.0, float(j));
			if (cc.y < 0.0) break;
			float ha = h21(cc + 3.1), hb = h21(cc + 7.7), hd = h21(cc + 13.9), he = h21(cc + 23.3);
			if (ha > 0.3) continue;
			vec2 o = (cc + vec2(0.3 + 0.4 * hb, 0.35 + 0.3 * hd)) / G2;
			float w0 = wipe_at(o);
			if (w0 > 0.45) continue;                                  // drops sit in the wet halo of a stroke
			float sd1;
			float ca = age_at(o, sd1);
			if (ca < 0.0) continue;
			float d0 = 0.8 + he * 3.0;
			float R = (0.1 + 0.2 * hb * hb) / G2.x;
			float r = R * smoothstep(d0, d0 + 5.0 + ha * 4.0, ca);
			if (r <= 0.0) continue;
			vec2 O = o * A;
			float runs = step(hd, 0.2 * drops_q);
			float t0 = d0 + 9.0 + he * 22.0;
			float rt = (ca - t0) * runs;
			float yo = 0.0;
			if (rt > 0.0) {
				// stick-slip: it creeps, catches, lets go (a stepped clock), faster as it gathers water
				float slip = rt + 0.6 * sin(rt * 2.3 + he * 6.0);
				yo = min(0.006 * slip + 0.0016 * slip * slip, 1.6);
				r *= 1.0 - 0.35 * smoothstep(0.0, 0.25, yo);
			}
			float dy = P.y - O.y;
			float wob = 0.0035 * sin(dy * 48.0 + he * 9.0) + 0.0015 * sin(dy * 117.0 + hb * 5.0);
			vec2 H = O + vec2(0.0035 * sin(yo * 48.0 + he * 9.0) + 0.0015 * sin(yo * 117.0 + hb * 5.0), yo);
			if (j < 2 || yo > 0.0) bead(P, H, r, aa1, wb_m, lensL);
			if (yo > 0.0 && dy > 0.0 && dy < yo) {
				// the clear streak behind it: its age is the time since the head passed this height
				float sw = r * 0.85 * (0.75 + 0.25 * sin(dy * 31.0 + hb * 4.0));
				float sm = 1.0 - smoothstep(sw - aa1 * 1.5, sw + aa1 * 1.5, abs(P.x - O.x - wob));
				float frac = dy / max(yo, 1e-4);
				float sage = rt * (1.0 - sqrt(frac));
				streak = max(streak, sm * (1.0 - smoothstep(4.0, 30.0, sage) * 0.75));
			}
		}
	}
	cond *= 1.0 - 0.92 * max(streak, wb_m * 0.9);
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
	// (v1.0) through CLEAN glass the room is sharper, darker and higher in contrast than through the fog
	float clr = clamp(1.0 - cond / max(fog * 0.55, 0.02), 0.0, 1.0) * fog;
	vec3 backc = max((back - 0.34) * 1.32 + 0.3, vec3(0.0));
	back = mix(back, backc, clr);
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
	// v1.0: the water on the glass. Beads and drops are LENSES: each shows the room behind, inverted and
	// a little magnified, sharp, with a darker refracted ring at its edge and a small sharp highlight top-left
	if (wb_m > 0.0) {
		vec2 lc = lensL.xy;
		float lr = max(lensL.z, 1e-5);
		vec2 o = (P - lc) / lr;                              // -1..1 across the lens (y down)
		vec2 ruv = (lc - (P - lc) * 0.55) / A;               // inverted
		vec3 rb = max((behind(ruv) - 0.34) * 1.35 + 0.3, vec3(0.0));
		float lo = length(o);
		float tiny = 1.0 - smoothstep(0.002, 0.006, lr);
		vec3 lensc = rb * (1.0 - mix(0.6, 0.25, tiny) * smoothstep(0.55, 1.0, lo));        // the dark refracted ring
		lensc += vec3(0.16, 0.17, 0.18) * smoothstep(0.35, 0.9, o.y) * (1.0 - smoothstep(0.9, 1.0, lo));   // light gathered low in it
		c = mix(c, lensc, wb_m);
		vec2 hp = o - vec2(-0.38, -0.44);
		float hs = max(0.13, 0.0017 / lr);                                // (at least a pixel or so, even on the tiniest bead)
		c += vec3(1.0) * exp(-dot(hp, hp) / (hs * hs)) * wb_m * 0.95;    // the specular point
	}
	// the rim where the finger pushed the water: thin, slightly irregular, glinting with tiny highlights
	float rimthin = ridge * (1.0 - smoothstep(0.08, 0.2, wn)) * fog * (1.0 - rc);
	float glints = smoothstep(0.62, 0.9, vnoise(uv * vec2(420.0, 560.0) + seed0 * 3.0));
	c += vec3(0.72, 0.76, 0.78) * rimthin * (0.18 + 0.6 * glints);
	// the fog's micro-droplet grain: a faint, sparse sparkle
	float gh = h21(floor(uv * vec2(640.0, 853.0)));
	c += vec3(0.07) * step(0.982, gh) * (0.6 + 0.4 * sin(t * 0.8 + gh * 60.0)) * cond;
	// her fingertip, pressed against the glass from her side: pale, softly lit
	c = mix(c, vec3(0.78, 0.86, 0.87), palm * 0.55);
	c += her.rgb * palm * glow * 0.25;
	// the finished glyph glows in the carved-glow colours, blooming a little into the fog
	float core = smoothstep(0.55, 0.95, wipe);
	float bloom = smoothstep(0.02, 0.5, wipe) * (1.0 - core);
	// (v1.0: the wipe stays CLEAR GLASS. Her colour is only a faint warm tint inside it (<= 15 %, when the
	// glyph is answered) and a thin rim light along its edge; the answered glyph blooms a little into the fog)
	vec3 lc = mix(her.rgb, accent.rgb, yours);
	vec3 lcc = mix(her_core.rgb, accent_core.rgb, yours);
	float hk = mix(0.72, 1.0, yours);
	float gk = mix(0.3, 1.0, glow);
	float rimw = smoothstep(0.1, 0.28, wipe) * (1.0 - smoothstep(0.32, 0.55, wipe));
	c = mix(c, c * lc * 2.2, core * 0.15 * glow * hk);
	c += lcc * rimw * 0.2 * gk * hk;
	c += lc * bloom * 0.08 * glow * hk;
	// a faint sheen across the glass, and the bronze frame
	c += vec3(0.05) * smoothstep(0.035, 0.0, abs(uv.x * 0.7 - uv.y * 0.45 + 0.1));
	float frame = 1.0 - smoothstep(0.0, 0.025, em);
	c = mix(c, vec3(0.16, 0.14, 0.11), frame);
	COLOR = vec4(c, 1.0);
}
