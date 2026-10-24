// The sculptor's unknown SCRIPT: 26 small glyphs built from the rune grammar (circles, strokes,
// Greek-key fragments, ticks, a chevron) with one stroke weight, written in rows with word gaps and
// line breaks, opening with a larger capital rune. Same text in the world and on the reading card:
// both are generated from the inscription's seed. Needs glyphs.gdshaderinc first.

float s_hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

float s_prim(vec2 p, int k) {
	if (k == 0) return g_seg(p, vec2(0.0, -0.62), vec2(0.0, 0.62));
	if (k == 1) return g_ring(p - vec2(0.0, 0.32), 0.22);
	if (k == 2) return g_ring(p + vec2(0.0, 0.32), 0.22);
	if (k == 3) return g_seg(p, vec2(-0.42, 0.0), vec2(0.42, 0.0));
	if (k == 4) return g_seg(p, vec2(-0.4, -0.6), vec2(0.4, 0.6));
	if (k == 5) return min(g_seg(p, vec2(-0.42, 0.6), vec2(0.42, 0.6)), g_seg(p, vec2(0.42, 0.6), vec2(0.42, 0.0)));
	if (k == 6) return min(g_seg(p, vec2(0.42, -0.6), vec2(-0.42, -0.6)), g_seg(p, vec2(-0.42, -0.6), vec2(-0.42, 0.0)));
	if (k == 7) return g_dot(p, 0.09);
	if (k == 8) return g_seg(p, vec2(-0.3, 0.45), vec2(0.3, 0.72));
	return min(g_seg(p, vec2(-0.42, 0.25), vec2(0.0, -0.2)), g_seg(p, vec2(0.0, -0.2), vec2(0.42, 0.25)));
}

// one glyph of the alphabet (id 0..25); p spans about [-0.5,0.5] x [-0.7,0.7]
float s_glyph(vec2 p, int id) {
	int a = id % 10;
	int b = (id * 7 + 3) % 10;
	if (b == a) b = (b + 1) % 10;
	float d = min(s_prim(p, a), s_prim(p, b));
	if (id % 3 == 0) {
		int c = (id * 3 + 5) % 10;
		if (c != a && c != b) d = min(d, s_prim(p, c));
	}
	return d;
}

// distance to the inscription's strokes at uv (0..1 over the panel; v down). rows x cols cells.
float script_dist(vec2 uv, float seed, float rows, float cols, float aspect) {
	vec2 g = vec2(uv.x * cols, uv.y * rows);
	vec2 cell = floor(g);
	vec2 f = fract(g) - 0.5;
	f.x *= aspect;
	// the capital: a full rune spanning the first two rows and columns
	if (cell.x < 2.0 && cell.y < 2.0) {
		vec2 cp = (vec2(uv.x * cols, uv.y * rows) - vec2(1.0, 1.0)) / vec2(1.0, 1.0);
		cp.x *= aspect;
		return rune_dist(vec2(cp.x, -cp.y) * 1.05, int(mod(seed, 6.0))) * 0.5;
	}
	float row_len = cols - floor(s_hash(vec3(seed, cell.y, 7.0)) * 3.0) - (cell.y == rows - 1.0 ? 3.0 : 0.0);
	if (cell.x >= row_len) return 9.0;
	float h = s_hash(vec3(seed, cell.y, cell.x));
	if (h < 0.16 && cell.x > 0.0) return 9.0;                         // word gap
	int id = int(floor(s_hash(vec3(cell.x * 1.7, cell.y * 3.1, seed)) * 26.0));
	return s_glyph(f * vec2(1.0, 1.45), id) * 0.5;
}
