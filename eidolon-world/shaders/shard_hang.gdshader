shader_type spatial;
// v0.9 the Tree of Shards: hundreds of small mirror shards on threads. Each instance turns slowly about its
// thread (INSTANCE_CUSTOM: phase, speed, tilt, kind; kind 1 = the thread itself, which does not turn); a
// shard glints with the accent light when it turns its face to you.
render_mode unshaded, cull_disabled, shadows_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec3 cam_back;
varying float glint;
varying float is_thread;
varying float shade;
void vertex() {
	float ph = INSTANCE_CUSTOM.x * 6.2832;
	float sp = 0.15 + INSTANCE_CUSTOM.y * 0.35;
	is_thread = step(0.5, INSTANCE_CUSTOM.w);
	if (is_thread < 0.5) {
		float a = ph + TIME * sp;
		float c = cos(a), s = sin(a);
		VERTEX = vec3(VERTEX.x * c, VERTEX.y, -VERTEX.x * s);
		vec3 n = vec3(s, 0.0, c);
		vec3 wn = normalize((MODEL_MATRIX * vec4(n, 0.0)).xyz);
		float f = abs(dot(wn, cam_back));
		glint = pow(f, 24.0);
		shade = 0.35 + 0.5 * f;
	} else {
		glint = 0.0;
		shade = 0.0;
	}
}
void fragment() {
	if (is_thread > 0.5) {
		ALBEDO = vec3(0.78, 0.78, 0.76);
	} else {
		vec3 glass = mix(vec3(0.16, 0.18, 0.2), vec3(0.78, 0.8, 0.82), shade);
		ALBEDO = mix(glass, accent_core.rgb * 1.8, glint) + accent.rgb * glint * 0.6;
	}
}
