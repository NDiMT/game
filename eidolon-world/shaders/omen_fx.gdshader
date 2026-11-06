shader_type spatial;
// v2.0 (Agent A) one shader for the flat "omen" decals of Chapter I (all built by scripts/fx/omen_fx.gd), picked by
// `kind`. Each is a quad (PlaneMesh) lying on water or standing on a glass; alpha-blended, unshaded, no depth/screen
// texture (web-safe). Quad space p: -1..1, +y = "up" on the decal.
//   0 CAUSTIC: wavering caustic light (a thing pushed up through still water is lit from beneath)
//   1 CRACK: a star of glass cracks spreading from the centre, a glint sweeping along them (a mirror crack)
//   2 FROST: the Warden snuffs a reflection: dark spreads from the centre, frost-cracks grow in it, then it clears
//   3 WRITING: her fingertip writes in the water, stroke by stroke (`segs`), a caustic glow along the strokes
//   4 EYE: a glass eye deep in the water opens (`open`), a crimson ring, a glassy iris, water over it
//   5 RING: a meniscus ring (a pop as something breaks the surface)
//   6 FLASH: a bloom with a four-point flare (glass giving way)
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform int kind = 0;
uniform float k = 1.0;                 // overall strength
uniform float grow = 1.0;              // 0..1 spread (crack / frost / ring)
uniform float open = 0.0;              // the eye
uniform float progress = 0.0;          // the writing: metres of stroke drawn (in quad units)
uniform vec4 segs[48];                 // the writing's strokes: (a.x, a.y, b.x, b.y) in quad units
uniform float seg_acc[48];             // arc length at each segment's start
uniform int n_segs = 0;
uniform float aspect = 1.0;            // quad width / height (for round shapes on long quads)
uniform vec3 tint : source_color = vec3(1.0, 0.94, 0.9);
uniform float fog_k = 0.0;             // mix toward the fog colour (for far glows)
uniform float ring_tint = 0.0;         // RING: 0 white water .. 1 `tint`

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float seg(vec2 p, vec2 a, vec2 b, out float h) { vec2 pa = p - a, ba = b - a; h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba * h); }
vec2 h22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float cell_edge(vec2 uv) {
	vec2 g = floor(uv), f = fract(uv); float d1 = 8.0, d2 = 8.0;
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 o = vec2(float(x), float(y)); vec2 r = o + h22(g + o) - f; float d = dot(r, r);
		if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
	}
	return sqrt(d2) - sqrt(d1);
}
// caustic light: two warped sine lattices
float caustic(vec2 p, float t) {
	vec2 q = p * 3.2 + vec2(vnoise(p * 2.0 + t * 0.4), vnoise(p * 2.0 - t * 0.37)) * 1.6;
	float a = abs(sin(q.x + t * 0.9) + sin(q.y * 1.13 - t * 0.7));
	float b = abs(sin((q.x + q.y) * 0.8 - t * 0.6) + sin((q.x - q.y) * 0.9 + t * 0.5));
	return pow(clamp(1.0 - min(a, b) * 0.5, 0.0, 1.0), 6.0);
}
// a radial crack star with a few branches (glass): returns the line strength
float crack_star(vec2 p, float r_max, out float halo) {
	float r = length(p), an = atan(p.y, p.x);
	float s = 0.0;
	halo = 0.0;
	for (int i = 0; i < 9; i++) {
		float fi = float(i);
		float a0 = fi * 0.698 + hash(vec2(fi, 3.1)) * 0.5;
		float bend = sin(r * (6.0 + fi) + fi) * 0.08;
		float da = abs(mod(an - a0 - bend + 3.14159, 6.28318) - 3.14159) * r;
		float len = r_max * (0.55 + 0.45 * hash(vec2(fi, 7.7)));
		s = max(s, (1.0 - smoothstep(0.008, 0.02 + 0.012 * (1.0 - r), da)) * step(r, len));
		halo = max(halo, exp(-da / 0.035) * step(r, len));
	}
	// rings of the impact
	for (int j = 0; j < 2; j++) {
		float rr = r_max * (0.18 + 0.2 * float(j));
		s = max(s, (1.0 - smoothstep(0.0, 0.008, abs(r - rr - 0.01 * sin(an * 7.0 + float(j))) - 0.006)) * step(r, r_max) * 0.75);
	}
	return s;
}

void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	p.y = -p.y;
	vec2 pa = vec2(p.x * aspect, p.y);
	float t = TIME;
	vec3 c = tint;
	float a = 0.0;
	if (kind == 0) {
		float r = length(p);
		float fall = 1.0 - smoothstep(0.3, 1.0, r);
		float cs = caustic(p, t);
		c = mix(accent.rgb, tint, 0.65 + 0.35 * cs);
		a = (cs * 0.85 + fall * 0.25) * fall;
	} else if (kind == 1) {
		float halo;
		float s = crack_star(pa, grow * 0.95, halo);
		float an = atan(pa.y, pa.x);
		float glint = exp(-pow(mod(an - t * 1.4, 6.28318) - 3.14159, 2.0) * 3.0);
		c = mix(vec3(0.9, 0.95, 1.0), vec3(1.0), glint);
		a = max(s * (0.7 + 0.3 * glint), halo * (0.22 + 0.35 * glint));     // the lines, and a soft sheen round them
		float core = (1.0 - smoothstep(0.0, 0.06, length(pa))) * grow;
		c = mix(c, accent_core.rgb, core * 0.4);
		a = max(a, core * 0.8);
	} else if (kind == 2) {
		float r = length(pa);
		float front = grow * 1.15;
		float n = vnoise(pa * 4.0) * 0.18;
		float inside = 1.0 - smoothstep(front - 0.12, front + 0.02, r + n);
		float edge = cell_edge(pa * 7.0 + 3.0);
		float frost = (1.0 - smoothstep(0.0, 0.06, edge)) * inside;
		float dend = (1.0 - smoothstep(0.0, 0.02, abs(sin(atan(pa.y, pa.x) * 11.0 + r * 9.0) * r))) * inside * 0.6;
		float rim = (1.0 - smoothstep(0.0, 0.06, abs(r + n - front))) * step(0.02, grow);
		vec3 dark = vec3(0.05, 0.055, 0.07);
		c = mix(dark, vec3(0.86, 0.9, 0.95), clamp(frost + dend + rim * 0.8, 0.0, 1.0));
		a = max(inside * 0.82, max(frost, rim) * 0.95);
		a *= 1.0 - smoothstep(0.85, 1.0, r);
	} else if (kind == 3) {
		float best = 9.0, at = 0.0;
		float tip = 9.0;
		for (int i = 0; i < 48; i++) {
			if (i >= n_segs) break;
			vec4 sg = segs[i];
			float L = length(sg.zw - sg.xy);
			float drawn = clamp(progress - seg_acc[i], 0.0, L);
			if (drawn <= 0.0) break;
			vec2 b = sg.xy + (sg.zw - sg.xy) * (drawn / max(L, 1e-5));
			float h;
			float d = seg(pa, sg.xy, b, h);
			if (d < best) { best = d; at = seg_acc[i] + drawn * h; }
			if (drawn < L) tip = length(pa - b);
		}
		float w = 0.05;
		float line = 1.0 - smoothstep(w * 0.45, w, best);
		float glow = exp(-best / 0.11) * 0.6;
		float shim = 0.75 + 0.25 * caustic(pa * 0.6, t * 1.3);
		float age = clamp((progress - at) / 1.5, 0.0, 1.0);          // a stroke cools a little after it is drawn
		float pen = exp(-tip * tip / 0.008);
		c = mix(accent.rgb, mix(accent_core.rgb, vec3(1.0, 0.92, 0.9), 0.5), line * (1.0 - age * 0.4));
		c = mix(c, vec3(1.0), pen * 0.8);
		a = clamp((line * 0.95 + glow * shim) * (1.0 - age * 0.25) + pen, 0.0, 1.0);
	} else if (kind == 4) {
		vec2 q = pa;
		q += vec2(sin(q.y * 9.0 + t * 1.4), cos(q.x * 8.0 - t * 1.2)) * 0.012;          // water over it
		float lid = open;
		float hx = 0.95, hy = 0.42 * lid;
		float ax = abs(q.x) / hx;
		float wy = hy * pow(max(1.0 - ax * ax, 0.0), 0.7) + 1e-4;
		float inside = 1.0 - smoothstep(0.92, 1.0, max(ax, abs(q.y) / wy));
		float r = length(q);
		float iris = 1.0 - smoothstep(0.33, 0.36, r);
		float ring = 1.0 - smoothstep(0.015, 0.05, abs(r - 0.345));
		float pupil = 1.0 - smoothstep(0.1, 0.13, r * (1.0 + 0.3 * (1.0 - lid)));
		float rays = 0.5 + 0.5 * sin(atan(q.y, q.x) * 28.0 + r * 30.0);
		vec3 white = vec3(0.84, 0.87, 0.9);
		vec3 irc = mix(vec3(0.3, 0.4, 0.48), vec3(0.7, 0.8, 0.88), rays * smoothstep(0.12, 0.33, r));
		c = mix(white, irc, iris);
		c = mix(c, accent.rgb, ring);
		c = mix(c, vec3(0.02, 0.02, 0.03), pupil);
		c += vec3(0.9) * exp(-dot(q - vec2(-0.14, 0.12), q - vec2(-0.14, 0.12)) / 0.002) * lid;     // the glassy highlight
		float depth = 0.45 + 0.55 * (1.0 - smoothstep(0.0, 1.0, r));
		c = mix(vec3(0.42, 0.46, 0.5), c, depth);                                                   // deep in the water
		float lidline = (1.0 - smoothstep(0.0, 0.06, abs(max(ax, abs(q.y) / wy) - 1.0))) * step(0.02, lid);
		c = mix(c, vec3(0.1, 0.06, 0.07), lidline * 0.85);
		a = max(inside * 0.92, lidline * 0.9) * smoothstep(0.0, 0.08, lid);
		a = max(a, exp(-r * r * 2.0) * 0.18 * lid);                                                 // a faint glow round it
	} else if (kind == 6) {
		// 6 FLASH (v2.0): the moment glass gives: a hot rose-white bloom with crimson round it, a four-point flare
		float r = length(pa);
		float bloom = exp(-r * r * 9.0);
		float flare = exp(-abs(pa.x) * 22.0) * exp(-abs(pa.y) * 2.2) + exp(-abs(pa.y) * 22.0) * exp(-abs(pa.x) * 2.2);
		c = mix(accent.rgb, vec3(1.0, 0.95, 0.93), clamp(bloom * 1.3 + flare * 0.5, 0.0, 1.0));
		a = clamp(bloom * 0.9 + flare * 0.7 + exp(-r * 3.0) * 0.25, 0.0, 1.0);
	} else {
		float r = length(pa);
		float rr = grow * 0.95;
		float ring = exp(-pow((r - rr) / 0.035, 2.0)) * (1.0 - grow);
		float hl = ring * (0.6 + 0.4 * sin(atan(pa.y, pa.x) * 5.0 + t * 3.0));
		c = mix(vec3(0.95, 0.97, 1.0), tint, ring_tint);     // (white water; a beacon's ignition ring is crimson)
		a = hl;
	}
	c = mix(c, vec3(0.8, 0.8, 0.79), fog_k);
	ALBEDO = c;
	ALPHA = clamp(a * k, 0.0, 1.0);
}
