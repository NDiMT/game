// The sculptor's unknown SCRIPT (v0.5): a real alphabet of 24 letters written with one even stroke
// and a consistent ductus. Every letter sits on a BASELINE, rises to the X-HEIGHT, and some carry an
// ASCENDER or a DESCENDER; the strokes are stems, bowls (round arcs), arches, Greek-key hooks,
// chevrons and dots. Rows are set like carved calligraphy: letter spacing, word gaps, line spacing,
// ragged line ends, and a CAPITAL (one of the six named runes) opening the text. The engraving and
// the reading card draw the same text from the inscription's seed. Needs glyphs.gdshaderinc first.
//
// Letter space: x 0..0.5 (the letter's width), y: baseline 0, x-height 0.5, ascender 0.85,
// descender -0.3. Distances come back in ROW units (a row = 1).

float s_hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

// an arc of radius r about c, from angle a0 to a1 (radians, a0 < a1, counter-clockwise)
float s_arc(vec2 p, vec2 c, float r, float a0, float a1) {
	vec2 q = p - c;
	float a = atan(q.y, q.x);
	float m = 0.5 * (a0 + a1);
	float h = 0.5 * (a1 - a0);
	float da = mod(a - m + 3.14159265, 6.2831853) - 3.14159265;
	if (abs(da) <= h) return abs(length(q) - r);
	float e0 = length(q - r * vec2(cos(a0), sin(a0)));
	float e1 = length(q - r * vec2(cos(a1), sin(a1)));
	return min(e0, e1);
}
float s_seg(vec2 p, float ax, float ay, float bx, float by) { return g_seg(p, vec2(ax, ay), vec2(bx, by)); }

const float PI_S = 3.14159265;

float s_letter(vec2 p, int id) {
	float d = 9.0;
	vec2 bc = vec2(0.25, 0.25);            // the bowl's centre
	float br = 0.22;
	if (id == 0) {          // a: bowl + right stem
		d = min(g_ring(p - bc, br), min(s_seg(p, 0.47, 0.0, 0.47, 0.62), s_seg(p, 0.47, 0.62, 0.3, 0.62)));
	} else if (id == 1) {   // b: tall stem + bowl
		d = min(min(s_seg(p, 0.03, 0.0, 0.03, 0.85), s_seg(p, 0.03, 0.0, 0.47, 0.0)), min(s_seg(p, 0.47, 0.0, 0.47, 0.45), s_seg(p, 0.47, 0.45, 0.2, 0.45)));
	} else if (id == 2) {   // c: open bowl
		d = min(s_arc(p, bc, br, 0.75, 2.0 * PI_S - 0.75), g_dot(p - bc, 0.04));
	} else if (id == 3) {   // d: bowl + tall right stem
		d = min(g_ring(p - bc, 0.17), min(s_seg(p, 0.47, -0.1, 0.47, 0.85), s_seg(p, 0.47, 0.85, 0.32, 0.85)));
	} else if (id == 4) {   // key: a Greek-key hook on a stem
		d = min(min(s_seg(p, 0.03, 0.0, 0.03, 0.5), s_seg(p, 0.03, 0.5, 0.47, 0.5)), min(s_seg(p, 0.47, 0.5, 0.47, 0.2), s_seg(p, 0.47, 0.2, 0.24, 0.2)));
	} else if (id == 5) {   // i: a stem with its dot
		d = min(s_seg(p, 0.25, 0.0, 0.25, 0.5), g_dot(p - vec2(0.25, 0.72), 0.04));
	} else if (id == 6) {   // n: stem + arch
		d = min(min(s_seg(p, 0.03, 0.0, 0.03, 0.28), s_arc(p, vec2(0.25, 0.28), 0.22, 0.0, PI_S)), min(s_seg(p, 0.47, 0.0, 0.47, 0.28), g_dot(p - vec2(0.25, 0.2), 0.04)));
	} else if (id == 7) {   // u: cup + right stem
		d = min(min(s_seg(p, 0.03, 0.5, 0.03, 0.22), s_arc(p, vec2(0.25, 0.22), 0.22, PI_S, 2.0 * PI_S)), s_seg(p, 0.47, 0.0, 0.47, 0.5));
	} else if (id == 8) {   // lozenge with a seed
		d = min(abs(abs(p.x - 0.25) + abs(p.y - 0.25) - 0.24) * 0.7071, g_dot(p - bc, 0.035));
	} else if (id == 9) {   // k: tall stem + two arms
		d = min(s_seg(p, 0.03, 0.0, 0.03, 0.85), min(s_seg(p, 0.03, 0.2, 0.45, 0.5), s_seg(p, 0.17, 0.3, 0.47, 0.0)));
	} else if (id == 10) {  // v: a chevron
		d = min(s_seg(p, 0.0, 0.5, 0.25, 0.0), s_seg(p, 0.25, 0.0, 0.5, 0.5));
	} else if (id == 11) {  // meander: a running key along the baseline
		d = min(min(s_seg(p, 0.0, 0.0, 0.0, 0.42), s_seg(p, 0.0, 0.42, 0.25, 0.42)), min(min(s_seg(p, 0.25, 0.42, 0.25, 0.1), s_seg(p, 0.25, 0.1, 0.5, 0.1)), s_seg(p, 0.5, 0.1, 0.5, 0.5)));
	} else if (id == 12) {  // q: bowl + descending stem
		d = min(g_ring(p - bc, br), min(s_seg(p, 0.47, 0.5, 0.47, -0.3), s_seg(p, 0.47, -0.3, 0.3, -0.3)));
	} else if (id == 13) {  // z: bar, diagonal, bar
		d = min(min(s_seg(p, 0.03, 0.5, 0.47, 0.5), s_seg(p, 0.47, 0.5, 0.03, 0.0)), s_seg(p, 0.03, 0.0, 0.47, 0.0));
	} else if (id == 14) {  // t: tall stem, crossbar, a foot that turns
		d = min(min(s_seg(p, 0.2, 0.75, 0.2, 0.08), s_seg(p, 0.03, 0.5, 0.42, 0.5)), s_arc(p, vec2(0.34, 0.08), 0.14, PI_S, 1.75 * PI_S));
	} else if (id == 15) {  // omega: an open ring on two feet
		d = min(s_arc(p, vec2(0.25, 0.3), 0.21, -0.35 * PI_S, 1.35 * PI_S), min(s_seg(p, 0.0, 0.0, 0.13, 0.0), s_seg(p, 0.37, 0.0, 0.5, 0.0)));
		d = min(d, min(s_seg(p, 0.13, 0.0, 0.14, 0.12), s_seg(p, 0.37, 0.0, 0.36, 0.12)));
	} else if (id == 16) {  // e: open bowl with a bar
		d = min(s_arc(p, bc, br, 0.35 * PI_S, 1.95 * PI_S), min(s_seg(p, 0.25, 0.25, 0.47, 0.25), g_dot(p - vec2(0.25, 0.62), 0.04)));
	} else if (id == 17) {  // a stem under two dots
		d = min(s_seg(p, 0.25, 0.0, 0.25, 0.5), min(g_dot(p - vec2(0.1, 0.7), 0.04), g_dot(p - vec2(0.4, 0.7), 0.04)));
	} else if (id == 18) {  // h: tall stem + arch
		d = min(min(s_seg(p, 0.03, 0.0, 0.03, 0.85), s_seg(p, 0.03, 0.5, 0.47, 0.5)), min(s_seg(p, 0.47, 0.5, 0.47, 0.0), s_seg(p, 0.47, 0.0, 0.3, 0.0)));
	} else if (id == 19) {  // p: descending stem + bowl
		d = min(min(s_seg(p, 0.03, -0.3, 0.03, 0.5), g_ring(p - bc, br)), g_dot(p - bc, 0.04));
	} else if (id == 20) {  // y: two arms, one descends
		d = min(min(s_seg(p, 0.03, 0.5, 0.25, 0.16), s_seg(p, 0.47, 0.5, 0.25, 0.16)), min(s_seg(p, 0.25, 0.16, 0.25, -0.3), s_seg(p, 0.25, -0.3, 0.42, -0.3)));
	} else if (id == 21) {  // a spiral: bowl turning in to a bar
		d = min(s_arc(p, bc, br, 0.0, 1.5 * PI_S), s_seg(p, 0.25, 0.03, 0.25, 0.25));
	} else if (id == 22) {  // f: tall stem with a hooked top and a bar
		d = min(min(s_seg(p, 0.2, 0.0, 0.2, 0.68), s_arc(p, vec2(0.34, 0.68), 0.14, 0.0, PI_S)), s_seg(p, 0.03, 0.45, 0.4, 0.45));
	} else {                // w: a double chevron
		d = min(min(s_seg(p, 0.0, 0.5, 0.12, 0.0), s_seg(p, 0.12, 0.0, 0.25, 0.32)), min(s_seg(p, 0.25, 0.32, 0.38, 0.0), s_seg(p, 0.38, 0.0, 0.5, 0.5)));
	}
	return d;
}

const float S_SCALE = 0.6;       // letter units -> row units (x-height = 0.3 rows)
const float S_BASE = 0.24;       // baseline sits this far below the row's middle

// distance (row units) to the inscription's strokes at uv (0..1 over the panel; v down)
float script_dist(vec2 uv, float seed, float rows, float cols, float aspect) {
	vec2 g = vec2(uv.x * cols, uv.y * rows);
	vec2 cell = floor(g);
	vec2 f = fract(g) - 0.5;
	f.x *= aspect;                                    // cell space in row units
	// the capital: one of the six named runes, two rows tall, opening the text
	if (cell.x < 2.0 && cell.y < 2.0) {
		vec2 cp = (g - vec2(1.0, 1.0));
		cp.x *= aspect;
		return rune_dist(vec2(cp.x, -cp.y) * 1.12, int(mod(seed, 6.0))) / 1.12 * 0.62;
	}
	float row_len = cols - floor(s_hash(vec3(seed, cell.y, 7.0)) * 3.0) - (cell.y == rows - 1.0 ? 3.0 : 0.0);
	if (cell.x >= row_len) return 9.0;
	float h = s_hash(vec3(seed, cell.y, cell.x));
	if (h < 0.17 && cell.x > 2.0) return 9.0;          // word gap
	int id = int(floor(s_hash(vec3(cell.x * 1.7, cell.y * 3.1, seed)) * 24.0));
	// a letter, centred in its cell on the row's baseline
	vec2 lp = vec2(f.x / S_SCALE + 0.25, (-f.y + S_BASE) / S_SCALE);
	// (only the cells next door could reach into this one: letters are narrower than a cell)
	return s_letter(lp, id) * S_SCALE;
}

// the carved-glow look shared by the engraving and the card (glyphs.gdshaderinc)
vec4 script_glow(float d, float w) { return carved_glow(d, w); }
