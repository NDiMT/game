shader_type spatial;
// A silvered mirror (opaque). Each pixel follows the reflected view ray into a cheap model of the room
// in front of the glass: the polished floor's tile grid, the colonnade's columns, the fog beyond; then
// the silvering: a cool tint, a soft vertical sheen, faint streaks, age spots (foxing) toward the edges
// and a bright thin edge along the frame. The opaque reflection of the wanderer stands on this plane.
render_mode unshaded, cull_disabled, depth_draw_opaque, shadows_disabled;
global uniform vec3 cam_back;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 n = vec3(0.0, 0.0, 1.0);
uniform float floor_y = 1.0;
uniform vec2 size = vec2(2.0, 3.0);
uniform vec4 cols[8];
uniform int ncols = 0;
uniform float crack = 0.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

void fragment() {
	if (!FRONT_FACING) {
		ALBEDO = vec3(0.16, 0.16, 0.17);
	} else {
		vec3 d = -normalize(cam_back);
		vec3 r = d - 2.0 * dot(d, n) * n;
		vec3 fog = mix(vec3(0.60, 0.63, 0.66), vec3(0.80, 0.80, 0.79), smoothstep(-0.4, 0.5, r.y));
		vec3 c = fog;
		float best = 1e5;
		if (r.y < -0.01) {
			float t = (floor_y - wp.y) / r.y;
			vec3 h = wp + r * t;
			vec2 g = h.xz * 0.5;
			vec2 f = fract(g);
			float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
			float seam = 1.0 - smoothstep(0.004, 0.02, e);
			float v = texture(noise_tex, h.xz * 0.13).r;
			vec3 fl = vec3(0.075, 0.078, 0.085) * (0.85 + 0.4 * v) + vec3(0.20) * seam;
			fl += vec3(0.06) * smoothstep(0.55, 1.0, sin((h.x + h.z) * 0.55 + v * 3.0));
			c = mix(fl, fog, 1.0 - exp(-t * 0.07));
			best = t;
		}
		vec2 rd = r.xz;
		float hs = max(length(rd), 1e-4);
		rd /= hs;
		for (int i = 0; i < 8; i++) {
			if (i >= ncols) break;
			vec4 cl = cols[i];
			vec2 o = wp.xz - cl.xy;
			float b = dot(o, rd);
			float cc = dot(o, o) - cl.z * cl.z;
			float disc = b * b - cc;
			if (disc > 0.0) {
				float s = -b - sqrt(disc);
				float t3 = s / hs;
				float y = wp.y + r.y * t3;
				if (s > 0.0 && t3 < best && y > floor_y && y < floor_y + cl.w) {
					vec2 nn = normalize(o + rd * s);
					float sh = 0.62 + 0.38 * max(dot(nn, normalize(vec2(-0.6, 0.5))), 0.0);
					float flute = 0.94 + 0.06 * sin(atan(nn.y, nn.x) * 16.0);
					vec3 cm = vec3(0.72, 0.71, 0.68) * sh * flute;
					c = mix(cm, fog, 1.0 - exp(-t3 * 0.07));
					best = t3;
				}
			}
		}
		// silvering
		c = c * vec3(0.84, 0.89, 0.94) + vec3(0.03, 0.04, 0.05);
		vec2 uv = UV;
		vec2 m = vec2(min(uv.x, 1.0 - uv.x) * size.x, min(uv.y, 1.0 - uv.y) * size.y);
		float em = min(m.x, m.y);
		c += vec3(0.05, 0.055, 0.06) * smoothstep(1.0, 0.0, uv.y);
		float streak = texture(noise_tex, vec2(uv.x * 3.0, uv.y * 0.15)).r;
		c *= 0.97 + 0.06 * smoothstep(0.45, 0.75, streak);
		float fox = smoothstep(0.42, 0.0, em) * smoothstep(0.58, 0.72, texture(noise_tex, uv * size * 0.9 + 3.1).r);
		c = mix(c, vec3(0.42, 0.38, 0.31), fox * 0.55);
		c = mix(c, c * 0.8, smoothstep(0.3, 0.0, em) * 0.5);
		float edge = 1.0 - smoothstep(0.0, 0.025, em);
		c = mix(c, vec3(0.97, 0.99, 1.0), edge * 0.85);
		if (crack > 0.0) {
			vec2 q = (uv - vec2(0.62, 0.35)) * size;
			float an = atan(q.y, q.x);
			float rr = length(q);
			float spokes = 1.0 - smoothstep(0.0, 0.02, abs(sin(an * 4.5 + rr * 0.6)) * rr);
			c = mix(c, vec3(0.95, 0.97, 1.0), spokes * step(rr, 1.3) * crack * 0.8);
		}
		ALBEDO = c;
	}
}
