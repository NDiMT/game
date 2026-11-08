shader_type spatial;
// v2.0 (Agent A) the Glass Warden IN THE WATER (prologue shot 7; WardenRig.set_look("glass")): a figure of dark
// cracked glass. His own texture sunk deep and cool; a web of cracks across him (cellular, in his UV space so they
// ride the skin) that glint as a slow shimmer sweeps up through them; a refraction-like wobble of the shading; a
// cold glassy fresnel edge and a crimson rim. Unshaded (reads the same in any light), opaque (skinned, depth-correct).
render_mode unshaded, cull_back, shadows_disabled;
global uniform vec4 accent;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform float k = 1.0;              // 0 = plain dark figure, 1 = full glass
uniform float crack_scale = 6.0;
uniform float rise = 1.0;           // 0..1: emerging (the cracks light from the feet up)
uniform float clip_dir = 1.0;      // 1: keep what is above clip_y (rising out of it); -1: keep below (a reflected puppet, upside down IN the water)
uniform float clip_y = -1000.0;     // the water's surface while he rises out of it: nothing drawn below, a pale meniscus line at it
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

vec2 h22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// distance to the nearest cell edge (a crack); `id` = a value per shard (each pane catches the light differently)
float cracks(vec2 uv, out float id) {
	vec2 g = floor(uv), f = fract(uv);
	float d1 = 8.0, d2 = 8.0; vec2 c1 = vec2(0.0);
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
		vec2 o = vec2(float(x), float(y));
		vec2 r = o + h22(g + o) - f;
		float d = dot(r, r);
		if (d < d1) { d2 = d1; d1 = d; c1 = g + o; } else if (d < d2) d2 = d;
	}
	id = h22(c1 * 1.37).x;
	return sqrt(d2) - sqrt(d1);
}

void fragment() {
	if ((wpos.y - clip_y) * clip_dir < 0.0) discard;
	vec2 wob = vec2(sin(wpos.y * 7.0 + TIME * 1.3), cos(wpos.x * 6.0 - TIME * 1.1)) * 0.004 * k;
	vec3 base = texture(albedo_tex, UV + wob).rgb;
	float l = dot(base, vec3(0.333));
	vec3 c = mix(vec3(l), base, 0.3) * vec3(0.55, 0.62, 0.72) * 0.5;            // deep, cool
	float id;
	float cr = cracks(UV * crack_scale, id);
	// each pane of glass catches the light differently: a slow shimmer moves across them (the refraction)
	float pane = 0.5 + 0.5 * sin(id * 31.0 + TIME * 0.9 + wpos.y * 2.0);
	c *= 0.75 + 0.6 * pane * k;
	c += vec3(0.5, 0.6, 0.72) * pow(pane, 6.0) * 0.22 * k;
	float line = 1.0 - smoothstep(0.0, 0.085, cr);
	float sweep = exp(-pow((fract(wpos.y * 0.35 - TIME * 0.22) - 0.5) * 5.0, 2.0));
	// (a3) the height up HIS body (his own up axis): right side up, or hung upside-down in the water world
	float hb = dot(wpos - MODEL_MATRIX[3].xyz, normalize(MODEL_MATRIX[1].xyz));
	float lit = rise >= 0.999 ? 1.0 : 1.0 - smoothstep(rise * 2.4 - 0.3, rise * 2.4, hb);
	c += vec3(0.7, 0.8, 0.9) * line * (0.4 + 0.6 * sweep) * 0.75 * k * lit;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	c += vec3(0.55, 0.65, 0.75) * fres * 0.35 * k;                                // the glass edge
	c += accent.rgb * pow(fres, 1.6) * 0.55 * k;                                   // the crimson rim
	c = mix(c, vec3(0.85, 0.9, 0.95), (1.0 - smoothstep(0.0, 0.035, (wpos.y - clip_y) * clip_dir)) * 0.8);   // wet line at the surface
	ALBEDO = c;
}
