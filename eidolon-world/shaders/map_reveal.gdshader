shader_type canvas_item;
// v1.0 M3c (Agent A) the chapter map: ink on parchment, revealed region by region (fog of war). Used by
// scripts/fx/map_view.gd (MapView, a TextureRect whose texture is map_paper.jpg). map_ids.png holds each texel's walk
// region id (0 = always shown: frame, compass, title); `reveal` is a 256 x 1 lookup (R = how far that region is
// revealed, 0..1, animated by MapView). Unrevealed parts are blank paper under a faint drifting fog.

uniform sampler2D ink_tex : filter_linear_mipmap;
uniform sampler2D id_tex : filter_nearest;
uniform sampler2D reveal : filter_nearest;
uniform vec3 ink_col : source_color = vec3(0.17, 0.13, 0.11);
uniform vec2 player_uv = vec2(-1.0);
uniform vec3 mark_col : source_color = vec3(0.62, 0.08, 0.10);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float rev_at(vec2 uv) {
	float id = floor(texture(id_tex, uv).r * 255.0 + 0.5);
	if (id < 0.5) return 1.0;
	return texture(reveal, vec2((id + 0.5) / 256.0, 0.5)).r;
}

void fragment() {
	vec3 paper = texture(TEXTURE, UV).rgb;
	vec2 px = 1.0 / vec2(textureSize(id_tex, 0));
	// a soft, ragged edge between known and unknown: the region's reveal, blurred over its neighbours and
	// broken up by noise as it grows in
	float r = rev_at(UV) * 0.4;
	r += (rev_at(UV + vec2(px.x * 6.0, 0.0)) + rev_at(UV - vec2(px.x * 6.0, 0.0))
		+ rev_at(UV + vec2(0.0, px.y * 6.0)) + rev_at(UV - vec2(0.0, px.y * 6.0))) * 0.15;
	float n = vnoise(UV * vec2(40.0, 60.0)) * 0.6 + vnoise(UV * vec2(140.0, 210.0)) * 0.4;
	float shown = smoothstep(n - 0.12, n + 0.12, r * 1.1 - 0.05);
	float ink = texture(ink_tex, UV).r * shown;
	vec3 col = mix(paper, ink_col, ink);
	// the fog over what is not known yet
	float fog = (1.0 - shown) * (0.55 + 0.45 * vnoise(UV * vec2(6.0, 9.0) + TIME * 0.02));
	col = mix(col, col * 0.9 + vec3(0.03, 0.03, 0.035), fog * 0.6);
	// where you are: a crimson dot with a slow ring
	if (player_uv.x >= 0.0) {
		vec2 d = (UV - player_uv) / px;
		float l = length(d);
		float dot_ = 1.0 - smoothstep(5.0, 7.0, l);
		float ring = (1.0 - smoothstep(1.0, 2.5, abs(l - (8.0 + 10.0 * fract(TIME * 0.5))))) * (1.0 - fract(TIME * 0.5));
		col = mix(col, mark_col, clamp(dot_ + ring * 0.7, 0.0, 1.0));
	}
	COLOR = vec4(col, 1.0);
}
