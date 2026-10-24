// Cloak deformation shared by the hooded figure and its reflections (the puppet copies these uniforms).
uniform vec2 sway = vec2(0.0);   // hem displacement in local xz (cloak trails / swings)
uniform float flare = 0.0;       // hem opens outward
uniform float ripple = 0.0;      // fold ripple amplitude while walking
uniform float phase = 0.0;       // walk phase
uniform float breath = 0.0;      // -1..1 idle breathing
uniform float deform = 1.0;      // 0 for rigid parts (the hood)

vec3 cloak_deform(vec3 v) {
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
