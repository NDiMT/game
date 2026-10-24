// Procedural engraved line designs for the cube faces (shared by the stone cube and its Eidolon).
// face_uv() picks the face of an axis-aligned cube in object space; glyph_lines() returns a 0..1 line
// mask (core) and a soft glow term. Six designs: concentric squares, Greek key, sacred geometry,
// circuit runes, vesica, delta-in-circle. `seed` rotates which design lands on which face.

float g_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float g_seg(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

vec2 face_uv(vec3 o, float hs, out int face) {
	vec3 a = abs(o);
	if (a.x >= a.y && a.x >= a.z) { face = o.x > 0.0 ? 0 : 1; return vec2(o.z * sign(o.x), o.y) / hs; }
	if (a.y >= a.z) { face = o.y > 0.0 ? 2 : 3; return vec2(o.x, o.z * sign(o.y)) / hs; }
	face = o.z > 0.0 ? 4 : 5;
	return vec2(-o.x * sign(o.z), o.y) / hs;
}

// distance (in face units, -1..1) to the design's lines
float glyph_dist(vec2 uv, int design, float seed) {
	float d = 10.0;
	vec2 q = abs(uv);
	if (design == 0) {            // concentric squares + corner ticks
		float sq = max(q.x, q.y);
		d = min(abs(sq - 0.72), min(abs(sq - 0.48), abs(sq - 0.22)));
		d = min(d, max(abs(q.x - q.y), 0.0) + step(sq, 0.72) * 10.0 + step(0.86, sq) * 10.0);
	} else if (design == 1) {     // Greek key (meander) spiral
		vec2 p = uv * 1.25;
		d = g_seg(p, vec2(-0.75, -0.75), vec2(0.75, -0.75));
		d = min(d, g_seg(p, vec2(0.75, -0.75), vec2(0.75, 0.75)));
		d = min(d, g_seg(p, vec2(0.75, 0.75), vec2(-0.45, 0.75)));
		d = min(d, g_seg(p, vec2(-0.45, 0.75), vec2(-0.45, -0.35)));
		d = min(d, g_seg(p, vec2(-0.45, -0.35), vec2(0.35, -0.35)));
		d = min(d, g_seg(p, vec2(0.35, -0.35), vec2(0.35, 0.35)));
		d = min(d, g_seg(p, vec2(0.35, 0.35), vec2(-0.05, 0.35)));
		d = min(d, g_seg(p, vec2(-0.05, 0.35), vec2(-0.05, 0.05)));
		d /= 1.25;
	} else if (design == 2) {     // sacred geometry: circle, inscribed diamond, diagonals, eye
		float r = length(uv);
		d = min(abs(r - 0.70), abs(q.x + q.y - 0.70));
		d = min(d, abs(r - 0.18));
		d = min(d, max(abs(q.x - q.y), step(0.70, r) * 10.0 + step(r, 0.18) * 10.0));
	} else if (design == 3) {     // circuit runes: traces on a 4x4 lattice with nodes
		vec2 g = (uv + 1.0) * 2.0;
		vec2 cell = floor(g);
		vec2 f = fract(g) - 0.5;
		float h = g_hash(cell + seed * 3.7);
		if (h < 0.35) d = abs(f.y);
		else if (h < 0.7) d = abs(f.x);
		else d = min(max(abs(f.x), -f.y) , max(abs(f.y), -f.x));
		d = min(d / 2.0, abs(length(f) - 0.14) / 2.0 + step(0.82, h) * 10.0);
		d = max(d, max(q.x, q.y) - 0.86);
	} else if (design == 4) {     // vesica piscis + pupil
		d = min(abs(length(uv - vec2(0.26, 0.0)) - 0.52), abs(length(uv + vec2(0.26, 0.0)) - 0.52));
		d = min(d, abs(length(uv) - 0.12));
		d = min(d, abs(max(q.x, q.y) - 0.82));
	} else {                      // delta in circle
		vec2 p = uv;
		float tri = max(abs(p.x) * 0.866 + p.y * 0.5, -p.y) - 0.34;
		d = min(abs(tri), abs(length(p) - 0.74));
		d = min(d, g_seg(p, vec2(0.0, -0.74), vec2(0.0, 0.74)) + step(abs(p.y), 0.34) * 10.0);
	}
	return d;
}

// returns (core line, glow halo)
vec2 glyph_lines(vec3 o, float hs, float seed) {
	int face;
	vec2 uv = face_uv(o, hs, face);
	int design = int(mod(float(face) + floor(seed), 6.0));
	float d = glyph_dist(uv, design, seed);
	float core = 1.0 - smoothstep(0.018, 0.04, d);
	float glow = exp(-d * 16.0) * 0.55;
	return vec2(core, glow);
}
