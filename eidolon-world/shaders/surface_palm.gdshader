shader_type spatial;
// v2.0 (Agent A) prologue: HER palm pressed against the still water's surface FROM BENEATH (she is in the true world,
// below). A flat quad lying on the water (OmenFx.palm_press). Hand frame: x across the palm, y toward the fingers.
// Beneath the surface: a soft dark-crimson silhouette, blurred by the water; where the skin touches the surface it is
// sharp and pale porcelain (fingertip pads, heel); a bright meniscus line hugs the outline where the surface bends.
// `tap` (0..1, decaying) is one of her two knocks: the print flashes paler and the meniscus jumps.
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
global uniform vec4 accent;
uniform float k = 1.0;            // overall (0 = gone)
uniform float press = 1.0;        // 0: just under the surface (blurred), 1: pressed flat on it
uniform float tap = 0.0;
uniform float mirror_x = 1.0;     // 1: her right hand seen palm-up from above (mirrored); -1: unmirrored

float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }

// signed distance to a hand (palm-on), units of the quad (-1..1); `pads` -> how hard each part presses
float hand(vec2 p, out float pads) {
	p.x *= mirror_x;
	float palm = length((p - vec2(0.0, -0.22)) / vec2(0.36, 0.42)) - 1.0;
	palm *= 0.36;
	float d = palm;
	float tips = 9.0;
	// four fingers (spread a little), then the thumb
	vec2 base[4] = vec2[4](vec2(-0.25, 0.14), vec2(-0.085, 0.2), vec2(0.085, 0.2), vec2(0.24, 0.13));
	vec2 tip[4] = vec2[4](vec2(-0.36, 0.62), vec2(-0.12, 0.8), vec2(0.11, 0.82), vec2(0.33, 0.66));
	float rad[4] = float[4](0.065, 0.075, 0.075, 0.068);
	for (int i = 0; i < 4; i++) {
		float f = seg(p, base[i], tip[i]) - rad[i];
		d = min(d, f);
		tips = min(tips, length(p - tip[i] + normalize(tip[i] - base[i]) * 0.06));
	}
	float th = seg(p, vec2(0.3, -0.25), vec2(0.62, 0.05)) - 0.085;
	d = min(d, th);
	tips = min(tips, length(p - vec2(0.58, 0.02)));
	float heel = length((p - vec2(0.0, -0.5)) / vec2(0.28, 0.14));
	pads = max(1.0 - smoothstep(0.03, 0.09, tips), (1.0 - smoothstep(0.6, 1.0, heel)) * 0.8);
	return d;
}

void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	p.y = -p.y;
	float pads;
	float d = hand(p, pads);
	float blur = mix(0.12, 0.02, press);                       // the water blurs what is not touching
	float body = 1.0 - smoothstep(-blur, blur, d);
	float contact = (1.0 - smoothstep(-0.015, 0.015, d)) * press * (0.35 + 0.65 * pads);
	float men = (1.0 - smoothstep(0.0, 0.02 + 0.01 * tap, abs(d - 0.02))) * press;    // the meniscus round it
	float wob = 0.85 + 0.15 * vnoise(p * 7.0 + TIME * 0.6);
	vec3 deep = mix(vec3(0.08, 0.08, 0.1), accent.rgb * 0.45, 0.55);                  // her, below: dark crimson
	vec3 skin = vec3(0.82, 0.84, 0.86);                                                   // porcelain where it touches
	vec3 c = deep;
	float a = body * 0.62 * wob;
	c = mix(c, skin, contact * (0.75 + 0.25 * tap));
	a = max(a, contact * 0.92);
	c = mix(c, vec3(0.96, 0.98, 1.0), men * 0.8);
	a = max(a, men * 0.7);
	a += tap * body * 0.25;
	ALBEDO = c;
	ALPHA = clamp(a * k, 0.0, 1.0);
}
