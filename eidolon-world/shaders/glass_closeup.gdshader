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
uniform sampler2D mask_mine : filter_linear, repeat_disable;    // v0.8: your strokes (aqua); the rest is hers (rose)
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
// ---- v0.8.1: HER HAND. A slender hand, sculpted rather than drawn: a tapered capsule for every phalanx
// joined by smooth unions, a rounded palm with its thenar and hypothenar mounds, a wrist and forearm.
// Authored in the hand's own frame (heel at 0, middle fingertip near 1, thumb toward +x, y up) and
// placed on the pane as her LEFT hand seen palm-on. Besides its distance it returns `con`, how hard
// each part presses the glass (the fingertip pads, the heel, the pads under the knuckles; little in the
// hollow of the palm; none in the creases), and `rid` / `rv`, the whorls of the fingertip pads.
uniform float press_t = 0.0;            // seconds since her palm touched the glass (the droplets run)
float sd_tcap(vec2 p, vec2 a, vec2 b, float ra, float rb, out float tq) {
	vec2 pa = p - a, ba = b - a;
	tq = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * tq) - mix(ra, rb, tq);
}
vec2 dir_of(float an) { return vec2(sin(an), cos(an)); }
float sd_rell(vec2 p, vec2 c, vec2 r, float an) {
	float cs = cos(an), sn = sin(an);
	vec2 q = p - c;
	q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
	return sd_ell(q, r);
}
// a skin pad on a phalanx (a, b): an oval, its centre at c0 along the bone, `ext` past its half length
float pad_sd(vec2 h, vec2 a, vec2 b, float rw, float c0, float ext) {
	vec2 ab = b - a;
	float L = max(length(ab), 0.0001);
	vec2 dn = ab / L;
	vec2 q = h - a;
	return sd_ell(vec2(dot(q, vec2(-dn.y, dn.x)), dot(q, dn) - L * c0), vec2(rw, L * 0.5 + ext));
}
// one finger: its root, angle, length, radius, bend (the gentle curve toward the middle finger) and
// curl (0 flat on the glass .. 1 folded away from it)
float digit(vec2 h, vec2 base, float an, float len, float r, float bend, float curl, inout float con, inout float rid, inout float rv) {
	vec2 j1 = base + dir_of(an) * len * 0.46 * (1.0 - curl * 0.35);
	vec2 j2 = j1 + dir_of(an + bend) * len * 0.29 * (1.0 - curl * 0.8);
	vec2 j3 = j2 + dir_of(an + bend * 2.0) * max(len * 0.25 * (1.0 - curl) - r * 0.8, 0.002);
	float t1, t2, t3;
	float d1 = sd_tcap(h, base, j1, r, r * 0.9, t1);
	float d2 = sd_tcap(h, j1, j2, r * 0.93, r * 0.84, t2);
	float d3 = sd_tcap(h, j2, j3, r * 0.87, r * 0.8, t3);
	float d = smin(smin(d1, d2, 0.006), d3, 0.006);
	// pressed: the pads between the joints touch, the flexion creases at the joints do not
	// pressed: an oval pad on every phalanx (the fingertip's fullest), thin creases between them
	float k1 = 0.74 * smoothstep(0.0, 0.32 * r, -pad_sd(h, base + (j1 - base) * 0.15, j1, r * 0.97, 0.5, r * 0.05));
	float k2 = 0.86 * smoothstep(0.0, 0.3 * r, -pad_sd(h, j1, j2, r * 0.97, 0.5, r * 0.12));
	float k3 = smoothstep(0.0, 0.3 * r, -pad_sd(h, j2, j3, r * 0.95, 0.6, r * 0.7));
	con = max(con, max(max(k1, k2), k3) * (1.0 - curl));
	vec2 pc = mix(j2, j3, 0.8);
	float pm = k3 * (1.0 - smoothstep(r * 0.3, r * 1.05, length(h - pc))) * (1.0 - curl);
	pm *= smoothstep(r * 0.12, r * 0.35, length(h - pc));
	if (pm > rid) { rid = pm; rv = sin(length((h - pc) * vec2(1.0, 0.8)) * 6.2832 / 0.0115); }
	return d;
}
float sd_palm(vec2 p) {
	vec2 v[5] = vec2[5](vec2(0.07, 0.08), vec2(0.135, 0.42), vec2(0.03, 0.465), vec2(-0.125, 0.4), vec2(-0.08, 0.09));
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
float crease(vec2 h, vec2 a, vec2 b) { float tq; return sd_tcap(h, a, b, 0.0022, 0.0012, tq); }
// the whole hand: pose 0 = the palm pressed flat, 1 = pointing (the index finger writing, the others
// folded, the thumb tucked). Returns the distance (hand units) and the arm's distance in `arm`.
float hand_d(vec2 h, float pose, out float con, out float rid, out float rv, out float arm) {
	con = 0.0; rid = 0.0; rv = 0.0;
	float tq;
	float dp = sd_palm(h) - 0.065;
	float dth = sd_rell(h, vec2(0.125, 0.2), vec2(0.085, 0.14), -0.4);
	float dhy = sd_rell(h, vec2(-0.1, 0.19), vec2(0.07, 0.15), 0.1);
	float dwr = sd_tcap(h, vec2(0.0, 0.1), vec2(0.0, -0.3), 0.105, 0.097, tq);
	float d = smin(smin(smin(dp, dth, 0.04), dhy, 0.04), dwr, 0.05);
	arm = sd_tcap(h, vec2(0.0, -0.22), vec2(0.0, -1.6), 0.1, 0.15, tq);
	// the palm's contact: the heel's two mounds, the pads under the knuckles, a little in the hollow
	vec2 hc = h - vec2(0.0, 0.29);
	float con_p = 0.34 * smoothstep(0.0, 0.05, -dp) * (1.0 - 0.75 * exp(-dot(hc * vec2(1.0, 1.3), hc * vec2(1.0, 1.3)) / 0.008));
	con_p = max(con_p, 0.95 * smoothstep(0.0, 0.08, -dth));
	con_p = max(con_p, 0.88 * smoothstep(0.0, 0.07, -dhy));
	// the pads under the knuckles: one continuous ridge across the top of the palm
	float dk = sd_tcap(h, vec2(-0.145, 0.405), vec2(0.03, 0.455), 0.04, 0.048, tq);
	dk = smin(dk, sd_tcap(h, vec2(0.03, 0.455), vec2(0.15, 0.44), 0.048, 0.044, tq), 0.02);
	con_p = max(con_p, 0.78 * smoothstep(0.0, 0.05, -dk));
	// the palm's lines (heart, head, life): fine creases where the skin does not touch
	float cl = min(crease(h, vec2(-0.17, 0.36), vec2(-0.02, 0.405)), crease(h, vec2(-0.02, 0.405), vec2(0.09, 0.455)));
	cl = min(cl, min(crease(h, vec2(0.15, 0.33), vec2(0.02, 0.30)), crease(h, vec2(0.02, 0.30), vec2(-0.15, 0.255))));
	cl = min(cl, min(crease(h, vec2(0.15, 0.33), vec2(0.07, 0.25)), min(crease(h, vec2(0.07, 0.25), vec2(0.045, 0.13)), crease(h, vec2(0.045, 0.13), vec2(0.06, 0.04)))));
	con_p *= 0.62 + 0.38 * smoothstep(0.0, 0.005, cl);
	con = con_p;
	// the thumb (its metacarpal hides in the thenar mound)
	vec2 t0 = vec2(0.12, 0.13);
	vec2 t1 = mix(vec2(0.255, 0.285), vec2(0.2, 0.27), pose);
	vec2 t2 = mix(vec2(0.335, 0.385), vec2(0.17, 0.36), pose);
	vec2 t3 = mix(vec2(0.375, 0.455), vec2(0.12, 0.39), pose);
	float ta, tb, tc;
	float da = sd_tcap(h, t0, t1, 0.058, 0.046, ta);
	float db = sd_tcap(h, t1, t2, 0.045, 0.04, tb);
	float dc = sd_tcap(h, t2, t3, 0.04, 0.034, tc);
	float dT = smin(smin(da, db, 0.008), dc, 0.006);
	con = max(con, (1.0 - pose) * max(0.5 * pow(sin(3.14159 * tb), 0.8) * smoothstep(0.0, 0.02, -db), smoothstep(0.1, 0.5, tc) * smoothstep(0.0, 0.02, -dc)));
	d = smin(d, dT, 0.02);
	// the four fingers, slender and slightly converging; pointing, the three outer ones fold away
	float co = pose * 0.85;
	d = smin(d, digit(h, vec2(0.13, 0.45), mix(0.075, 0.03, pose), 0.45, 0.046, -0.03, 0.0, con, rid, rv), 0.022);
	d = smin(d, digit(h, vec2(0.035, 0.475), mix(0.0, -0.02, pose), 0.53, 0.048, -0.012, co, con, rid, rv), 0.022);
	d = smin(d, digit(h, vec2(-0.062, 0.46), mix(-0.065, -0.04, pose), 0.49, 0.045, 0.022, co, con, rid, rv), 0.022);
	d = smin(d, digit(h, vec2(-0.145, 0.415), mix(-0.16, -0.1, pose), 0.38, 0.038, 0.055, co, con, rid, rv), 0.02);
	con *= smoothstep(-0.03, 0.07, h.y);          // the wrist does not touch
	con *= smoothstep(0.0, 0.007, -d);            // the skin rolls away from the glass at its outline
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
		vec2 h = to_hand(P, tip, vec2(0.155, 0.89), th, HAND_L);
		float dd = hand_d(h, 1.0, con, rid, rv, armd) * HAND_L;
		float wp = w * 0.7 + 0.012;
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
		float wb = mix(w + 0.05, mix(aa + 0.002 + w * 0.03, 0.02 + w * 0.3, smoothstep(0.12, -0.25, h.y)), press);
		float hm = (1.0 - smoothstep(-wb, wb, dd)) * nearer;
		float am = (1.0 - smoothstep(-w - 0.07, w + 0.07, armd * L)) * nearer * 0.7;
		inner = 1.0 - smoothstep(-aa, aa, dd);
		hand_m = max(hand_m, hm);
		arm_m = am;
		hdist = min(hdist, dd);
		// the print: contact sharpened, a fine frost of micro-droplets in it, the fingertip whorls
		float pr = smoothstep(0.06, 0.75, con) * inner * press;
		pr *= mix(0.55 + 0.45 * vnoise(uv * vec2(300.0, 400.0)), 1.0, smoothstep(0.3, 0.8, con));    // a frost of micro-droplets where it barely touched
		float rvis = 1.0 - smoothstep(0.35, 0.9, fwidth(rv));
		pr *= 1.0 - 0.2 * rid * (0.5 + 0.5 * rv) * rvis;
		prnt = pr;
		soft = inner * press * (1.0 - pr);
		halo = (1.0 - inner) * exp(-max(dd, 0.0) / 0.014) * press;
	}
	// droplets: from the heel, the thumb and the little finger, slow at first, then running
	float drop_c = 0.0, bead_m = 0.0, bead_hl = 0.0;
	if (press_t > 0.0 && palm_k > 0.5) {
		vec2 srcs[5] = vec2[5](vec2(-0.085, 0.06), vec2(0.005, 0.03), vec2(0.08, 0.05), vec2(0.405, 0.43), vec2(-0.245, 0.69));
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
			float tw = 0.0016 + 0.0012 * clamp(ry / max(y, 0.001), 0.0, 1.0);
			float tr = (1.0 - smoothstep(tw - aa2, tw + aa2, abs(P.x - s0.x - wob))) * step(0.0, ry) * step(ry, y);
			drop_c = max(drop_c, tr * (0.55 + 0.45 * smoothstep(0.0, 0.02, ry)));
			float hw = 0.0022 * sin(y * 55.0 + fi * 2.1) + 0.0012 * sin(y * 131.0 + fi);
			vec2 hd2 = P - (s0 + vec2(hw, y));
			float rb = 0.0052 * smoothstep(0.0, 0.01, y + 0.004);
			float db = length(hd2 * vec2(1.0, 0.82)) - rb;
			bead_m = max(bead_m, 1.0 - smoothstep(-aa2, aa2, db));
			bead_hl = max(bead_hl, exp(-dot(hd2 + vec2(0.0017, 0.0019), hd2 + vec2(0.0017, 0.0019)) / (0.0013 * 0.0013)));
		}
	}
	float glowd = max(her_cov(uv, w * 2.5 + 0.05), exp(-max(hdist, 0.0) / (0.04 + 0.16 * dens)) * max(finger_k, smoothstep(0.0, 0.55, palm_k)));     // the fog scatters her shadow
	vec3 shade = vec3(0.07, 0.08, 0.09);
	vec3 skin_far = mix(shade, vec3(0.4, 0.415, 0.43), press);     // her hand nearing the glass catches your light
	back = mix(back, shade, max(sil, arm_m) * 0.9);
	back = mix(back, skin_far + vec3(0.07) * smoothstep(0.0, 0.5, con) * press, hand_m * 0.92);
	float her_m = max(max(sil, arm_m), hand_m * (1.0 - 0.5 * press));
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
	vec3 skin = vec3(0.82, 0.84, 0.845) * (0.86 + 0.14 * smoothstep(0.1, 0.9, con));
	c = mix(c, skin, prnt * 0.88);
	c += her.rgb * prnt * glow * 0.1;
	// the droplets: clear trails, beads with a dark lensing body and a bright point
	c = mix(c, back * 0.85 + vec3(0.04), bead_m * 0.6);
	c += vec3(0.95) * bead_hl * 0.85 * bead_m;
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
	// (her lines glow rose, yours aqua; where they meet, the two blend)
	vec3 lc = mix(her.rgb, accent.rgb, yours);
	vec3 lcc = mix(her_core.rgb, accent_core.rgb, yours);
	c = mix(c, mix(lc, lcc, core * 0.85), (core * 0.9 + bloom * 0.45) * gk);
	c += lcc * core * 0.12 * gk;
	// a faint sheen across the glass, and the bronze frame
	c += vec3(0.05) * smoothstep(0.035, 0.0, abs(uv.x * 0.7 - uv.y * 0.45 + 0.1));
	float frame = 1.0 - smoothstep(0.0, 0.025, em);
	c = mix(c, vec3(0.16, 0.14, 0.11), frame);
	COLOR = vec4(c, 1.0);
}
