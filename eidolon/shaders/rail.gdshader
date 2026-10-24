shader_type spatial;
// Readable rail overlay lying on a marble rail: a tick per stop, end stops, a subtle "<>" counter-motion
// motif between ticks, a glowing segment while the mirror slides, a bold arrow during the swipe
// preview (the way the glass WILL slide) and an amber "locked" pulse when a body pins the mirror.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_disabled, fog_disabled;

uniform float n_stops = 3.0;
uniform float pos = 0.0;          // current mirror stop (0..n_stops-1), animated
uniform float seg_a = 0.0;        // glowing segment while sliding
uniform float seg_b = 0.0;
uniform float active = 0.0;
uniform float arrow_dir = 0.0;    // -1 / +1 preview arrow, 0 none
uniform float locked = 0.0;
uniform vec3 col : source_color = vec3(0.35, 0.9, 1.0);

float stop_u(float k) { return (0.25 + k) / (n_stops - 1.0 + 0.5); }

void fragment() {
	float L = n_stops - 1.0 + 0.5;            // rail length in tiles
	float x = UV.x * L - 0.25;                // position in stops
	float y = (UV.y - 0.5) * 2.0;             // -1..1 across the rail
	float aa = fwidth(x) * 1.2;
	float a = 0.0;
	vec3 c = vec3(0.92, 0.9, 0.84);
	// tick per stop
	float fx = abs(x - floor(x + 0.5));
	float tick = (1.0 - smoothstep(0.035 - aa, 0.035 + aa, fx)) * step(abs(y), 0.75) * step(-0.3, x) * step(x, n_stops - 0.7);
	a = max(a, tick * 0.85);
	// end stops (bars)
	float e0 = 1.0 - smoothstep(0.05 - aa, 0.05 + aa, abs(x + 0.12));
	float e1 = 1.0 - smoothstep(0.05 - aa, 0.05 + aa, abs(x - (n_stops - 1.0) - 0.12));
	a = max(a, max(e0, e1) * 0.95);
	// subtle counter-motion motif "< >" between ticks
	float m = fract(x) - 0.5;
	float chev = abs(abs(m) * 2.2 - 0.28 - abs(y) * 0.32);
	float motif = (1.0 - smoothstep(0.04 - aa, 0.04 + aa, chev)) * step(abs(y), 0.55) * step(0.0, x) * step(x, n_stops - 1.0);
	a = max(a, motif * 0.35);
	// glowing slide segment
	float lo = min(seg_a, seg_b), hi = max(seg_a, seg_b);
	float seg = smoothstep(lo - 0.15, lo, x) * (1.0 - smoothstep(hi, hi + 0.15, x)) * step(abs(y), 0.9);
	vec3 glow = col;
	// preview arrow from the mirror toward where it will go
	float ax = (x - pos) * arrow_dir;
	float shaft = step(0.0, ax) * step(ax, 0.75) * (1.0 - smoothstep(0.16, 0.24, abs(y)));
	float head = step(0.5, ax) * step(ax, 1.0) * step(abs(y), (1.0 - ax) * 1.8);
	float arrow = max(shaft, head) * abs(arrow_dir);
	// locked pulse at the mirror position
	float lk = locked * (1.0 - smoothstep(0.0, 0.45, abs(x - pos))) * (0.6 + 0.4 * sin(TIME * 30.0));
	vec3 outc = mix(c, glow, clamp(seg * active + arrow, 0.0, 1.0));
	outc = mix(outc, vec3(1.0, 0.62, 0.2), clamp(lk * 1.5, 0.0, 1.0));
	ALBEDO = outc;
	ALPHA = clamp(a * 0.75 + seg * active * 0.9 + arrow * 0.95 + lk, 0.0, 1.0);
}
