shader_type spatial;
// Her portrait on the Court's south wall, half erased: a standing veiled woman whose head is gone.
// When the beam is lit, the light behind you throws your veil's shadow onto the wall (`shadow`: uv,
// radius, strength); fit it into the missing head and the portrait completes (`complete`).
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float lit = 0.0;
uniform vec4 shadow = vec4(0.5, 0.5, 0.1, 0.0);
uniform vec2 head = vec2(0.5, 0.353);
uniform float complete = 0.0;
uniform vec2 size = vec2(5.2, 3.4);

float robe(vec2 p) {
	// a kneeling veiled woman (distance in wall-height units, negative inside): her robe pooled on the
	// floor, shoulders bowed; the head (at `head`) has been scraped away
	vec2 q = p - vec2(head.x, 0.0);
	q.x *= size.x / size.y;
	float H = head.y - 0.075;
	float y = clamp(q.y / H, 0.0, 1.0);
	float w = mix(0.30, 0.12, smoothstep(0.0, 1.0, y)) + 0.012 * sin(y * 30.0) * (1.0 - y);
	float body = max(abs(q.x) - w, max(q.y - H, -q.y));
	float shoulders = length((q - vec2(0.0, H)) * vec2(1.0, 2.2)) - 0.15;
	return min(body, shoulders);
}

void fragment() {
	vec2 p = UV;
	p.y = 1.0 - p.y;
	float n = texture(noise_tex, p * vec2(3.0, 2.0)).r;
	float n2 = texture(noise_tex, p * vec2(11.0, 7.0) + 0.3).r;
	float d = robe(p);
	float fill = 1.0 - smoothstep(-0.004, 0.006, d);
	float outline = exp(-abs(d) * 160.0);
	float erased = smoothstep(0.45, 0.62, n * 0.7 + n2 * 0.4);
	vec3 paint = mix(vec3(0.16, 0.24, 0.27), accent.rgb, 0.3);
	vec2 hq = (p - head) * vec2(size.x / size.y, 1.0);
	float hd = length(hq * vec2(1.0, 0.82)) - 0.06;
	// painted around her: a halo arch and the sea she was lost to
	float halo = exp(-abs(length(hq) - 0.2) * 70.0) * 0.5;
	float sea = (exp(-abs(p.y - 0.06 - 0.015 * sin(p.x * 40.0)) * 120.0) + exp(-abs(p.y - 0.11 - 0.012 * sin(p.x * 31.0 + 1.3)) * 140.0) * 0.6) * 0.55 * (1.0 - smoothstep(0.3, 0.5, abs(p.x - 0.5)));
	float a = (fill * 0.62 * (1.0 - erased * 0.6) + outline * 0.8 + (halo + sea) * (1.0 - erased * 0.5)) * (0.55 + 0.45 * lit);
	// the missing head: a pale scar in the plaster
	float scar = (1.0 - smoothstep(0.0, 0.02, hd)) * (1.0 - complete);
	vec3 c = paint;
	c = mix(c, vec3(0.80, 0.79, 0.76), scar * 0.6);
	a = max(a, scar * 0.35);
	// your veil's shadow
	vec2 sq = (p - shadow.xy) * vec2(size.x / size.y, 1.0);
	float sd = length(sq * vec2(1.0, 0.82)) - shadow.z;
	float sh = (1.0 - smoothstep(-0.01, 0.03, sd)) * shadow.w;
	c = mix(c, vec3(0.05, 0.06, 0.07), sh * 0.85);
	a = max(a, sh * 0.8);
	// completed: the head is painted in light, the whole portrait wakes
	float headf = (1.0 - smoothstep(0.0, 0.02, hd)) * complete;
	c = mix(c, accent_core.rgb, headf * 0.8 + (outline + halo) * complete * 0.6);
	a = max(a, headf * 0.9);
	a = max(a, outline * complete);
	ALBEDO = c * (1.0 + complete * 0.6);
	ALPHA = clamp(a, 0.0, 0.95);
}
