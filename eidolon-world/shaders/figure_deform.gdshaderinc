// Cloak deformation shared by the hooded figure and its reflections (the puppet copies these uniforms).
uniform vec2 sway = vec2(0.0);   // hem displacement in local xz (cloak trails / swings)
uniform float flare = 0.0;       // hem opens outward
uniform float ripple = 0.0;      // fold ripple amplitude while walking
uniform float phase = 0.0;       // walk phase
uniform float breath = 0.0;      // -1..1 idle breathing
uniform float deform = 1.0;      // 0 for rigid parts (the hood)
uniform float veil = 0.0;        // 1 on the veil: hangs from its top edge, sways with stride + wind

vec3 veil_deform(vec3 v) {
	float k = clamp((0.25 - v.y) / 0.25, 0.0, 1.0);
	k = k * k;
	float wind = sin(TIME * 1.3 + v.x * 7.0) * 0.006 + sin(TIME * 2.9 + v.x * 13.0 + v.y * 5.0) * 0.003;
	v.z += (sway.y + wind) * k;
	v.x += sway.x * 0.6 * k + sin(phase * 2.0 + v.y * 6.0) * 0.004 * ripple * k;
	v.y += abs(sway.y) * 0.25 * k;
	return v;
}

vec3 cloak_deform(vec3 v, vec2 uv) {
	if (veil > 0.5) return veil_deform(v);
	float flag = floor(uv.x + 0.0005);
	if (flag > 5.5 && flag < 7.5) {
		// sleeves swing a little with the stride (opposite to each other)
		float side = flag < 6.5 ? -1.0 : 1.0;
		float k = clamp((0.67 - v.y) / 0.3, 0.0, 1.0);
		v.z += sin(phase) * side * 0.045 * k * ripple * deform;
	}
	if (flag > 7.5) {
		// torn strips: trail and flutter more than the cloak
		float k = uv.y * uv.y;
		v.xz += sway * 2.4 * k * deform;
		v.x += sin(TIME * 3.3 + uv.x * 17.0 + v.y * 9.0) * 0.012 * k * (0.4 + ripple);
		v.z += cos(TIME * 2.7 + uv.x * 11.0) * 0.01 * k + flare * 0.06 * k;
	}
	float h = clamp(v.y / 0.82, 0.0, 1.0);
	float w = (1.0 - h) * (1.0 - h) * deform;
	float an = atan(v.z, v.x);
	float rip = sin(an * 5.0 + phase * 2.0) * ripple * 0.07 * w;
	v.xz *= 1.0 + flare * w * 0.30 + rip;
	v.y += flare * w * 0.05;
	v.xz += sway * w;
	v.y += breath * 0.012 * h * deform;
	v.xz *= 1.0 + breath * 0.025 * smoothstep(0.55, 0.9, h) * deform;
	return v;
}
