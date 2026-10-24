// EIDOLON rune language. Every rune = the shared FRAME (circle + four cardinal ticks) + one CORE motif
// built from the same grammar of circles, straight strokes and Greek-key fragments, drawn as exact
// signed distances with one consistent stroke weight and analytic anti-aliasing.
//   0 EIDOS  - the eye: a lens with a pupil
//   1 MEANDROS - a Greek-key spiral
//   2 KATOPTRON - the mirror axis: a staff with bars and a central lozenge
//   3 KYKLOS - two rings around a seed
//   4 TRIGONON - an inscribed triangle around a seed
//   5 TETRAKTYS - a lozenge around a square
// Shared by the stone cube, the Eidolon (mirrored) and the floor sigils.

const float RUNE_W = 0.055;      // half stroke width, in rune units (rune spans -1..1)

float g_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float g_seg(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

float g_ring(vec2 p, float r) { return abs(length(p) - r); }
float g_dot(vec2 p, float r) { return max(length(p) - r, 0.0); }

vec2 face_uv(vec3 o, float hs, out int face) {
	vec3 a = abs(o);
	if (a.x >= a.y && a.x >= a.z) { face = o.x > 0.0 ? 0 : 1; return vec2(o.z * sign(o.x), o.y) / hs; }
	if (a.y >= a.z) { face = o.y > 0.0 ? 2 : 3; return vec2(o.x, o.z * sign(o.y)) / hs; }
	face = o.z > 0.0 ? 4 : 5;
	return vec2(-o.x * sign(o.z), o.y) / hs;
}

float rune_frame(vec2 p) {
	float d = g_ring(p, 0.80);
	vec2 q = abs(p);
	d = min(d, g_seg(q, vec2(0.0, 0.80), vec2(0.0, 0.95)));
	d = min(d, g_seg(q, vec2(0.80, 0.0), vec2(0.95, 0.0)));
	return d;
}

float rune_core(vec2 p, int design) {
	vec2 q = abs(p);
	float d = 10.0;
	if (design == 0) {
		float lens = max(length(p - vec2(0.0, -0.34)) - 0.62, length(p + vec2(0.0, -0.34)) - 0.62);
		d = min(abs(lens), g_ring(p, 0.15));
		d = min(d, g_dot(p, 0.045));
	} else if (design == 1) {
		vec2 s = p / 0.58;
		float k = g_seg(s, vec2(-0.85, -0.85), vec2(0.85, -0.85));
		k = min(k, g_seg(s, vec2(0.85, -0.85), vec2(0.85, 0.85)));
		k = min(k, g_seg(s, vec2(0.85, 0.85), vec2(-0.85, 0.85)));
		k = min(k, g_seg(s, vec2(-0.85, 0.85), vec2(-0.85, -0.25)));
		k = min(k, g_seg(s, vec2(-0.85, -0.25), vec2(0.25, -0.25)));
		k = min(k, g_seg(s, vec2(0.25, -0.25), vec2(0.25, 0.25)));
		k = min(k, g_seg(s, vec2(0.25, 0.25), vec2(-0.3, 0.25)));
		d = k * 0.58;
	} else if (design == 2) {
		d = g_seg(p, vec2(0.0, -0.62), vec2(0.0, 0.62));
		d = min(d, g_seg(q, vec2(0.0, 0.62), vec2(0.22, 0.62)));
		d = min(d, abs(q.x + q.y - 0.24) * 0.7071);
		d = min(d, g_seg(q, vec2(0.30, 0.0), vec2(0.48, 0.0)));
	} else if (design == 3) {
		d = min(g_ring(p, 0.52), g_ring(p, 0.27));
		d = min(d, g_dot(p, 0.06));
	} else if (design == 4) {
		vec2 a = vec2(0.0, 0.58), b = vec2(-0.5023, -0.29), c = vec2(0.5023, -0.29);
		d = min(min(g_seg(p, a, b), g_seg(p, b, c)), g_seg(p, c, a));
		d = min(d, g_ring(p, 0.14));
	} else {
		d = abs(q.x + q.y - 0.58) * 0.7071;
		d = max(d, max(q.x, q.y) - 0.58);
		d = min(d, abs(max(q.x, q.y) - 0.2));
		d = min(d, g_dot(p, 0.045));
	}
	return d;
}

float rune_dist(vec2 p, int design) { return min(rune_frame(p), rune_core(p, design)); }

int rune_for_face(int face, float seed) { return int(mod(float(face) + floor(seed), 6.0)); }

// (crisp core, soft bloom) for a point on an axis-aligned cube in object space
vec2 rune_mask(float d) {
	float aa = max(fwidth(d), 0.004);
	float core = 1.0 - smoothstep(RUNE_W - aa, RUNE_W + aa, d);
	float bloom = exp(-max(d - RUNE_W, 0.0) * 9.0) * 0.45 + exp(-max(d - RUNE_W, 0.0) * 26.0) * 0.55;
	return vec2(core, bloom * (1.0 - core));
}

vec2 glyph_lines(vec3 o, float hs, float seed) {
	int face;
	vec2 uv = face_uv(o, hs, face) * 1.08;
	return rune_mask(rune_dist(uv, rune_for_face(face, seed)));
}
