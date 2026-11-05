shader_type spatial;
// v2.0 (Agent A) a wing BEACON's fire (scripts/fx/beacon_fire.gd uses part 1 only: its flame is the game's Flame). `part` 0: a flame column (spare) (a cylindrical billboard:
// turns about world up to face the camera), 1: the far glow (a big soft disc, camera-facing, fog-free: it shows through
// the fog from across the Atrium). Web-safe (no depth/screen texture). `k` the fire (0 out .. 1 burning), `flare` the
// ignition swell (decays), `height` the column at rest (m).
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 accent_tint;
uniform float part = 0.0;
uniform float k = 1.0;
uniform float flare = 0.0;
uniform float height = 1.2;
uniform float width = 0.9;
uniform float glow_size = 3.0;
uniform float seed = 0.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.1) * 0.3 + vnoise(p * 4.3) * 0.15; }

varying float hgt;
void vertex() {
	vec3 o = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	if (part < 0.5) {
		hgt = height * (1.0 + flare * 1.2);
		vec3 right = normalize(vec3(INV_VIEW_MATRIX[0].x, 0.0, INV_VIEW_MATRIX[0].z));
		vec3 w = o + right * VERTEX.x * width * (1.0 + flare * 0.4) + vec3(0.0, (VERTEX.y + 0.5) * hgt, 0.0);
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
	} else {
		float s = glow_size * (0.8 + 0.6 * flare);
		vec3 w = o + vec3(0.0, height * 0.45, 0.0) + (INV_VIEW_MATRIX[0].xyz * VERTEX.x + INV_VIEW_MATRIX[1].xyz * VERTEX.y) * s;
		POSITION = PROJECTION_MATRIX * VIEW_MATRIX * vec4(w, 1.0);
		hgt = s;
	}
}

void fragment() {
	float t = TIME + seed * 10.0;
	if (part < 0.5) {
		float x = (UV.x - 0.5) * 2.0;
		float y = 1.0 - UV.y;                                  // 0 base .. 1 top
		// the flame's body: narrows upward, licks (noise rising), a flicker
		float n = fbm(vec2(x * 2.2, y * 3.0 - t * 2.4));
		float n2 = fbm(vec2(x * 4.5 + 3.0, y * 5.0 - t * 3.6));
		float wdt = mix(0.85, 0.08, pow(y, 0.8)) * (0.75 + 0.5 * n);
		float shape = 1.0 - smoothstep(wdt * 0.55, wdt, abs(x + (n - 0.5) * 0.35 * y));
		shape *= smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.55 + 0.35 * n2, 1.0, y));
		float core = 1.0 - smoothstep(0.0, wdt * 0.45, abs(x)) ;
		core *= 1.0 - smoothstep(0.1, 0.55, y);
		// (the ONE light: our fire is crimson, Palette: a rose-white heart, the pale core, the crimson body, deep tongues)
		vec3 hot = vec3(1.0, 0.93, 0.9);
		vec3 mid = mix(accent.rgb, accent_core.rgb, 0.35);
		vec3 edge = accent_tint.rgb * 1.1;
		vec3 c = mix(edge, accent.rgb, smoothstep(0.05, 0.35, shape));
		c = mix(c, mid, smoothstep(0.35, 0.8, shape));
		c = mix(c, accent_core.rgb, core * 0.8);
		c = mix(c, hot, core * core * 0.7);
		ALBEDO = c * (1.0 + flare * 0.3);
		ALPHA = clamp(shape * (0.75 + 0.25 * core) * k, 0.0, 1.0);
	} else {
		float r = length(UV - 0.5) * 2.0;
		float g = pow(max(1.0 - r, 0.0), 1.7);
		float fl = 0.85 + 0.15 * sin(t * 7.0) * sin(t * 2.3 + 1.0);
		ALBEDO = mix(accent.rgb, accent_core.rgb, g * g * 0.55);
		ALPHA = clamp(g * (0.55 + flare * 0.4) * fl * k, 0.0, 0.92);
	}
}
