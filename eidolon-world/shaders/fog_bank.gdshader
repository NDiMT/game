shader_type spatial;
// v2.0 (Agent A) a FOG BANK lying on still water (scripts/fx/fog_bank.gd): the Pool of Halves is hidden until the three
// Beacons burn. part 0: a horizontal sheet (three are stacked: the bank has depth from above); part 1: a standing curtain
// of fog (a camera-facing quad about the vertical: the bank's silhouette). Rolling noise, soft edges, darker and denser
// at the water, a faint crimson glow breathing deep in it (something waits there). `k` its strength, `front` the lift:
// a ragged clearing sweeping from `from_x1` side across it (0 none .. 1 all clear). Web-safe, fog-free (it IS the fog).
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform float part = 0.0;
uniform float k = 1.0;
uniform float front = 0.0;
uniform float layer = 0.0;           // 0 the lowest sheet .. 1 the highest
uniform vec4 rect = vec4(0.0, 0.0, 10.0, 4.0);   // x0, z0, x1, z1 (world)
uniform float from_x1 = 1.0;         // 1: the clearing starts at the x1 (east) end
uniform float height = 2.2;          // curtains
uniform float seed = 0.0;
uniform vec3 col_lo : source_color = vec3(0.40, 0.42, 0.46);
uniform vec3 col_hi : source_color = vec3(0.93, 0.93, 0.94);
uniform float glow = 1.0;            // the crimson deep in it
varying vec3 wpos;
varying float vy;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 2.3) * 0.2; }

void vertex() {
	vy = UV.y;
	if (part > 0.5) {
		vec3 o = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
		vec3 right = normalize(vec3(INV_VIEW_MATRIX[0].x, 0.0, INV_VIEW_MATRIX[0].z));
		float w = length(MODEL_MATRIX[0].xyz);
		vec3 p = o + right * VERTEX.x * w + vec3(0.0, (VERTEX.y + 0.5) * height * (1.0 - 0.6 * front), 0.0);
		wpos = p;
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(p, 1.0);
	} else {
		wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	}
}

void fragment() {
	float t = TIME * (0.6 + 0.3 * layer) + seed * 13.0;
	vec2 q = wpos.xz;
	vec2 drift = vec2(t * 0.07, -t * 0.035) * (1.0 + layer);
	float n = fbm(q * (0.32 + 0.1 * layer) + drift + seed);
	float n2 = fbm(q * 0.9 - drift * 1.7 + 3.0);
	// soft edges of the bank (a ragged margin)
	float ex = min(q.x - rect.x, rect.z - q.x), ez = min(q.y - rect.y, rect.w - q.y);
	float edge = smoothstep(-0.4, 1.4, min(ex, ez) + (n - 0.5) * 1.2);
	// the lift: a ragged clearing sweeping across
	float u = from_x1 > 0.5 ? (rect.z - q.x) / max(rect.z - rect.x, 0.01) : (q.x - rect.x) / max(rect.z - rect.x, 0.01);
	float clear = smoothstep(-0.12, 0.12, front * 1.35 - u - (n2 - 0.5) * 0.35);
	float a;
	vec3 c;
	if (part > 0.5) {
		float y = 1.0 - vy;                                            // 0 at the water .. 1 at the top
		float body = smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.35 + 0.45 * n, 1.0, y));
		float w = 1.0 - smoothstep(0.55, 1.0, abs(UV.x - 0.5) * 2.0 + (n2 - 0.5) * 0.4);
		a = body * w * (0.55 + 0.4 * n);
		c = mix(col_lo, col_hi, y * 0.8 + n * 0.2);
	} else {
		// the lowest sheet is a solid bank (the water is gone under it), the upper ones its rolling billows: lit tops,
		// shadowed hollows, so it reads as a mass, not a haze
		float dens = layer < 0.25 ? smoothstep(0.0, 0.35, n * 0.6 + n2 * 0.4 + 0.15) : smoothstep(0.32, 0.7, n * 0.75 + n2 * 0.25);
		a = dens * mix(0.97, 0.78, layer) * edge;
		float lit = smoothstep(0.35, 0.8, n) * 0.7 + layer * 0.3;
		c = mix(col_lo, col_hi, clamp(lit + 0.15 * (n2 - 0.5), 0.0, 1.0));
		// something waits in it: a slow crimson glow deep in the lowest sheet
		float pulse = 0.5 + 0.5 * sin(TIME * 0.55 + seed);
		float g = (1.0 - layer) * glow * smoothstep(0.55, 0.9, vnoise(q * 0.18 + vec2(TIME * 0.02, 0.0) + 11.0)) * (0.35 + 0.35 * pulse);
		c = mix(c, accent.rgb * 0.8, g * 0.55);
	}
	ALBEDO = c;
	ALPHA = clamp(a * k * (1.0 - clear), 0.0, 0.95);
}
