shader_type spatial;
// v2.0 (Agent A) THE OBSERVER: the giant veiled head sunk in the inlet (Dress.observer). Wet veil-cloth over marble:
// pale and cool where the light falls, deep in the folds (the shading carries them), darker and wetter toward the
// water line, the fog taking it with distance like the rest. The crimson rim is a second pass (observer_rim).
render_mode cull_back, diffuse_lambert_wrap, specular_schlick_ggx;
uniform float water_y = 0.0;
uniform vec3 cloth : source_color = vec3(0.56, 0.58, 0.62);
uniform vec3 wet : source_color = vec3(0.24, 0.25, 0.28);
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
	ALBEDO = c;
	ROUGHNESS = mix(0.82, 0.35, wetk);
	SPECULAR = mix(0.25, 0.6, wetk);
}
