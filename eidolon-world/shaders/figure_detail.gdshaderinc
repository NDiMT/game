// Fine detail on the hooded figure (needs glyphs.gdshaderinc first).
//  * EMBROIDERY: rune motifs of the sculptor's language stitched in thin, slightly lighter thread along
//    the hem (above the cyan stripe), the hood rim and the sleeve cuffs. UV.x = band + v (2 hem,
//    3 hood rim, 4 left cuff, 5 right cuff; v = across the band), UV.y = u (around the band).
//    Each woken shrine lights one more rune: `runes_awake` (1 = Katoptron, top of the hood rim).
//  * FACE: the unfinished marble face under the veil (UV.x = 1).
uniform float runes_awake = 0.0;

// returns (thread core, thread bloom, glowing 0/1); all zero off the bands
vec3 embroidery(vec2 uv) {
	float band = floor(uv.x + 0.0005);
	if (band < 1.5) return vec3(0.0);
	float v = clamp(uv.x - band, 0.0, 1.0);
	float N; float front; float aspect;
	if (band < 2.5) { N = 14.0; front = 0.75; aspect = 3.0; }
	else if (band < 3.5) { N = 10.0; front = 0.25; aspect = 2.3; }
	else { N = 4.0; front = 0.75; aspect = 3.2; }
	float s = (uv.y - front) * N + 0.5;
	float c = mod(floor(s), N);
	float f = fract(s);
	float design; float order = 99.0;
	if (band < 2.5) { design = mod(c, 6.0); if (c < 0.5) order = 2.0; if (abs(c - 7.0) < 0.5) order = 7.0; }
	else if (band < 3.5) { design = mod(c + 2.0, 6.0); if (c < 0.5) order = 1.0; if (abs(c - 1.0) < 0.5) order = 5.0; if (abs(c - (N - 1.0)) < 0.5) order = 6.0; }
	else { design = band < 4.5 ? 3.0 : 4.0; if (c < 0.5) order = band < 4.5 ? 3.0 : 4.0; }
	vec2 p = vec2((f - 0.5) * aspect, v - 0.5) * 2.3;
	vec2 m = rune_mask(rune_dist(p, int(design + 0.5)));
	return vec3(m.x, m.y, step(order, runes_awake + 0.01));
}

// the unfinished face: smooth carved upper half (a hint of brow and nose bridge); lower half and the
// right cheek left as rough faceted stone; a hairline crack running down from the forehead.
float face_shade(vec3 q) {
	float edge = sin(q.x * 90.0) * 0.006;
	float rough = smoothstep(0.004, -0.02, q.y + edge);
	rough = max(rough, smoothstep(0.02, 0.042, q.x + edge) * smoothstep(0.06, 0.02, q.y));
	vec3 cell = floor(q * 75.0 + vec3(0.0, sin(q.x * 50.0) * 0.5, 0.0));
	float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
	float facets = 0.80 + 0.20 * h;
	float strokes = 0.90 + 0.10 * sin((q.x * 0.7 + q.y) * 260.0);
	float smooth_s = 0.97 + 0.03 * sin(q.y * 160.0 + sin(q.x * 40.0) * 2.0);
	float sh = mix(smooth_s, facets * strokes, rough);
	sh *= 1.0 - 0.12 * smoothstep(0.012, 0.0, abs(q.y - 0.03)) * step(abs(q.x), 0.06) * (1.0 - rough);
	sh *= 1.0 + 0.08 * smoothstep(0.010, 0.0, abs(q.x)) * step(-0.012, q.y) * step(q.y, 0.03) * (1.0 - rough);
	float cx = -0.024 + sin(q.y * 95.0) * 0.004 + sin(q.y * 230.0) * 0.0015;
	float crack = (1.0 - smoothstep(0.0007, 0.002, abs(q.x - cx))) * step(-0.01, q.y) * step(q.y, 0.115);
	return sh * (1.0 - crack * 0.7);
}
