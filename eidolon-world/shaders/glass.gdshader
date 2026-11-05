shader_type spatial;
// Mirror pane: faint tinted glass, bright frame lines and a slow sheen. Its reflection is the puppet.
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;

uniform vec3 tint : source_color = vec3(0.42, 0.58, 0.64);
uniform vec2 size = vec2(2.0, 3.0);
uniform float base_alpha = 0.22;
uniform float pulse = 0.0;
uniform float crack = 0.0;

void fragment() {
	vec2 uv = UV;
	vec2 m = vec2(min(uv.x, 1.0 - uv.x) * size.x, min(uv.y, 1.0 - uv.y) * size.y);
	float e = min(m.x, m.y);
	float aa = fwidth(e) * 1.5;
	float frame = 1.0 - smoothstep(0.035, 0.035 + aa, e);
	float inner = (1.0 - smoothstep(0.004, 0.004 + aa, abs(e - 0.09))) * 0.5;
	// (v2.0 A, global pass) the sheen: a soft wide band with a thin bright streak beside it (glass, not haze), and
	// now and then a glint: a small four-point star that flares on the frame's corner as the streak passes it
	float sp = fract(uv.x * 0.5 - uv.y * 0.3 - TIME * 0.035) - 0.5;
	float sheen = smoothstep(0.09, 0.0, abs(sp)) * 0.7 + smoothstep(0.012, 0.0, abs(sp + 0.06)) * 0.9;
	vec2 gc = vec2(0.035 / size.x, 1.0 - 0.035 / size.y);                         // top-left corner of the glass
	vec2 gq = (uv - gc) * size;
	float gt = smoothstep(0.08, 0.0, abs(fract(gc.x * 0.5 - gc.y * 0.3 - TIME * 0.035) - 0.5));
	float star = (exp(-abs(gq.x) * 60.0) * exp(-abs(gq.y) * 6.0) + exp(-abs(gq.y) * 60.0) * exp(-abs(gq.x) * 6.0)) * gt;
	float low = smoothstep(0.0, 0.6, uv.y);
	float a = base_alpha + frame * 0.75 + inner * 0.4 + sheen * 0.16 + star * 0.8 + pulse * 0.25;
	vec3 c = mix(tint * mix(0.85, 1.05, low), vec3(0.93, 0.98, 1.0), clamp(frame * 0.7 + sheen * 0.6 + inner * 0.4 + star, 0.0, 1.0));
	c = mix(c, accent_core.rgb, pulse * 0.6);
	if (crack > 0.0) {
		vec2 q = (uv - vec2(0.62, 0.35)) * size;
		float an = atan(q.y, q.x);
		float r = length(q);
		float spokes = 1.0 - smoothstep(0.0, 0.025, abs(sin(an * 4.5 + r * 0.6)) * r);
		float rings = (1.0 - smoothstep(0.0, 0.02, abs(r - 0.35))) * step(0.5, sin(an * 3.0 + 1.0));
		float ck = max(spokes * step(r, 1.4), rings) * crack;
		c = mix(c, vec3(0.96, 1.0, 1.0), ck);
		a += ck * 0.5;
	}
	ALBEDO = c;
	ALPHA = clamp(a, 0.0, 0.92);
}
