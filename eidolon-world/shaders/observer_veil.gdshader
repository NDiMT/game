shader_type spatial;
// v2.0 (Agent A) THE OBSERVER: the giant veiled head sunk in the inlet (Dress.observer). Wet veil-cloth over marble:
// pale and cool where the light falls, deep in the folds (the shading carries them), darker and wetter toward the
// water line, the fog taking it with distance like the rest. The crimson rim is a second pass (observer_rim).
render_mode cull_back, diffuse_lambert_wrap, specular_schlick_ggx, fog_disabled;
uniform float water_y = 0.0;
uniform vec3 cloth : source_color = vec3(0.48, 0.50, 0.55);
uniform vec3 wet : source_color = vec3(0.24, 0.25, 0.28);
// (v2.0) its own, lighter fog: the world's fog turned it into a pale blob from afar; it keeps its form (a darker veiled
// mass against the bright fog) and only fades so far toward the fog colour
uniform float fog_max = 0.45;
uniform float fog_dist = 70.0;
uniform vec3 fog_c : source_color = vec3(0.78, 0.78, 0.765);
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	float h = wpos.y - water_y;
	float wetk = 1.0 - smoothstep(0.0, 2.2, h);                       // soaked toward the water line
	float grain = vnoise(wpos.xz * 1.7 + wpos.y * 0.9) * 0.08;         // weathering
	vec3 c = mix(cloth * (0.94 + grain), wet, wetk * 0.85);
	// the folds: the cloth's own normals do the work; a little extra darkness in the hollows (grazing normals)
	float hollow = 1.0 - abs(dot(NORMAL, VIEW));
	c *= 1.0 - 0.4 * smoothstep(0.5, 1.0, hollow);
	float fd = fog_max * (1.0 - exp(-length(VERTEX) / fog_dist));
	ALBEDO = mix(c, fog_c * 0.85, fd);
	ROUGHNESS = mix(0.82, 0.35, wetk);
	SPECULAR = mix(0.25, 0.6, wetk);
}
