shader_type spatial;
// v1.0 QA P1-3 (Agent A) the Glass Warden as seen IN a mirror (WardenRig.set_reflection(true)): a dark figure
// (his own texture, deep in shadow) with a subtle crimson rim where his silhouette turns away, so his shape
// and facing read clearly against the pale reflected room. Unshaded: the same at any light.
render_mode unshaded, cull_back, shadows_disabled;
global uniform vec4 accent;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform float dark = 0.22;
uniform float rim_k = 0.75;
void fragment() {
	vec3 base = texture(albedo_tex, UV).rgb;
	float l = dot(base, vec3(0.333));
	vec3 c = mix(vec3(l), base, 0.4) * dark;
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	c += accent.rgb * rim * rim_k * 0.6;
	ALBEDO = c;
}
