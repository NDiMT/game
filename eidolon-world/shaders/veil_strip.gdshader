shader_type spatial;
// v1.0 M3c (Agent A) torn veils on poles: ribbons of gauze that stream in the wind. Mesh built by
// scripts/fx/veil_strips.gd: UV.x across the strip, UV.y 0 at the bar -> 1 at the torn end; COLOR.r = the
// strip's seed, COLOR.g = its length (m). The rest pose hangs straight down; the wind bends it up and over,
// gusts come and go on their own (plus `gust`, which a script can pulse with the wind sound).
render_mode cull_disabled, shadows_disabled;

uniform vec3 wind_dir = vec3(0.8, 0.0, -0.6);     // horizontal, normalised by the shader
uniform float strength = 0.65;                    // the steady wind (0..1)
uniform float gust = 0.0;                         // extra, script-driven (0..1)
uniform vec3 cloth : source_color = vec3(0.74, 0.75, 0.76);
uniform vec3 stain : source_color = vec3(0.55, 0.53, 0.50);
uniform float clock = -1.0;

varying vec2 uvv;
varying float seed;

float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }

void vertex() {
	float t = clock < 0.0 ? TIME : clock;
	seed = COLOR.r;
	float L = COLOR.g;
	float v = UV.y;
	uvv = UV;
	vec3 wd = normalize(vec3(wind_dir.x, 0.0, wind_dir.z) + vec3(1e-4, 0.0, 0.0));
	vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), wd));
	// gusts: slow noise, each strip a little out of step with the others
	float g = clamp(strength * (0.55 + 0.6 * n1(t * 0.45 + seed * 3.0)) + gust * 0.6, 0.0, 1.0);
	float th = g * 0.95 * (0.55 + 0.45 * v);                      // how far it is lifted from hanging
	th += 0.12 * sin(t * 3.1 + v * 5.0 + seed * 9.0) * g;          // the long wave along it
	vec3 off = wd * sin(th) * v * L + vec3(0.0, (1.0 - cos(th)) * v * L, 0.0);
	off += side * sin(t * (6.5 + 2.0 * seed) + v * 9.0 + seed * 6.0) * 0.07 * v * (0.25 + g);   // flutter
	off.y += sin(t * 8.3 + v * 12.0 + seed * 4.0) * 0.025 * v * g;
	VERTEX += (inverse(mat3(MODEL_MATRIX)) * off);
	vec3 tng = normalize(-vec3(0.0, cos(th), 0.0) + wd * sin(th));
	NORMAL = normalize(inverse(mat3(MODEL_MATRIX)) * cross(tng, side));
}

void fragment() {
	// the torn end: a ragged line, a few rents, and fraying threads
	float u = uvv.x, v = uvv.y;
	float rag = 0.78 + 0.2 * n1(u * 9.0 + seed * 31.0) - 0.12 * n1(u * 23.0 + seed * 7.0);
	if (v > rag) discard;
	float hole = n1(u * 6.0 + seed * 13.0) * n1(v * 8.0 + seed * 5.0);
	if (hole > 0.62 && v > 0.3) discard;
	float thread = step(0.5, fract(u * 18.0)) * step(rag - 0.06, v);
	if (thread > 0.5) discard;
	float grime = smoothstep(0.4, 1.0, v) * 0.5 + 0.2 * n1(u * 4.0 + v * 6.0 + seed);
	ALBEDO = mix(cloth, stain, grime);
	ROUGHNESS = 1.0;
	BACKLIGHT = vec3(0.3, 0.3, 0.3);    // gauze: the light comes through it
}
