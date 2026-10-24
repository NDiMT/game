// Cloak deformation shared by the hooded figure and its reflections (the puppet copies these uniforms).
uniform vec2 sway = vec2(0.0);   // hem displacement in local xz (cloak trails / swings)
uniform float flare = 0.0;       // hem opens outward
uniform float ripple = 0.0;      // fold ripple amplitude while walking
uniform float phase = 0.0;       // walk phase
uniform float breath = 0.0;      // -1..1 idle breathing
uniform float deform = 1.0;      // 0 for rigid parts (the hood)
uniform float veil = 0.0;        // 1 on the veil: hangs from its top edge, sways with stride + wind
uniform float veil_off = 0.0;    // wind phase offset of the veil (the reflection's is out of step)
uniform float turn = 0.0;        // the lean into a turn: tatters swing out and lag behind it
uniform float clasp = 0.0;       // 0..1 sleeves drawn up to the chest, hands clasped (reflection hint)
uniform float holes = 0.0;       // 1 on the cloak: a few torn holes (fragment discard)

// a few torn holes in the cloak, in rest-pose coordinates (angle round the body, height):
// returns x = inside the hole (discard), y = the dark frayed rim around it
vec2 cloak_holes(vec3 p) {
	if (holes < 0.5 || p.y > 0.7) return vec2(0.0);
	float an = atan(p.z, p.x);
	vec4 H[5] = vec4[](vec4(2.1, 0.30, 0.020, 0.030), vec4(-1.8, 0.44, 0.016, 0.024), vec4(0.5, 0.20, 0.022, 0.028),
		vec4(-0.7, 0.52, 0.014, 0.022), vec4(1.3, 0.62, 0.012, 0.018));
	float best = 9.0;
	for (int i = 0; i < 5; i++) {
		float da = mod(an - H[i].x + 3.14159, 6.28318) - 3.14159;
		vec2 d = vec2(da * 0.24 / H[i].z, (p.y - H[i].y) / H[i].w);
		float jag = 0.18 * sin(atan(d.y, d.x) * 7.0 + float(i) * 2.0);
		best = min(best, length(d) - jag);
	}
	return vec2(step(best, 1.0), 1.0 - smoothstep(1.0, 1.5, best));
}

vec3 veil_deform(vec3 v) {
	float k = clamp((0.25 - v.y) / 0.25, 0.0, 1.0);
	k = k * k;
	float wind = sin(TIME * 1.3 + v.x * 7.0 + veil_off) * 0.006 + sin(TIME * 2.9 + v.x * 13.0 + v.y * 5.0 + veil_off) * 0.003;
	v.z += (sway.y + wind) * k;
	v.x += sway.x * 0.6 * k + sin(phase * 2.0 + v.y * 6.0) * 0.004 * ripple * k;
	v.y += abs(sway.y) * 0.25 * k;
	return v;
}

vec3 cloak_deform(vec3 v, vec2 uv) {
	if (veil > 0.5) return veil_deform(v);
	float flag = floor(uv.x + 0.0005);
	// everything on a sleeve: the sleeve itself (6/7), its embroidered cuff (4/5), its rags (10/11)
	float sl = (flag > 3.5 && flag < 4.5) || (flag > 5.5 && flag < 6.5) || (flag > 9.5 && flag < 10.5) ? -1.0 :
		((flag > 4.5 && flag < 5.5) || (flag > 6.5 && flag < 7.5) || (flag > 10.5 && flag < 11.5) ? 1.0 : 0.0);
	if (sl != 0.0 && deform > 0.5) {
		if (clasp > 0.001) {
			// draw the sleeve up about the shoulder so the cuffs meet at the chest (Rodrigues)
			vec3 A = vec3(sl * 0.150, 0.67, -0.012);
			vec3 a = normalize(vec3(sl * 0.212, 0.37, -0.078) - A);
			vec3 b = normalize(vec3(sl * 0.045, 0.56, -0.205) - A);
			vec3 ax = normalize(cross(a, b));
			float ang = acos(clamp(dot(a, b), -1.0, 1.0)) * clasp;
			vec3 q = v - A;
			q = q * cos(ang) + cross(ax, q) * sin(ang) + ax * dot(ax, q) * (1.0 - cos(ang));
			v = A + q;
		}
		// sleeves swing a little with the stride (opposite to each other)
		float k = clamp((0.67 - v.y) / 0.3, 0.0, 1.0);
		v.z += sin(phase) * sl * 0.045 * k * ripple * (1.0 - clasp);
	}
	if (flag > 9.5 && flag < 11.5) {
		// rags hanging from the cuffs: trail, flutter, lag behind turns
		float k = uv.y * uv.y;
		v.xz += sway * 1.8 * k * deform;
		v.x += (sin(TIME * 3.7 + uv.x * 23.0 + v.y * 11.0) * 0.010 - turn * 0.3) * k * (0.5 + ripple) * deform;
		v.z += cos(TIME * 3.1 + uv.x * 13.0) * 0.008 * k * deform;
	}
	if (flag > 7.5 && flag < 9.5) {
		// hem tatters (8) and the torn scarf (9): trail behind the motion, flutter, swing out of turns
		float scarf = step(8.5, flag);
		float k = mix(uv.y * uv.y, uv.y, scarf);
		float amt = mix(2.4, 3.4, scarf);
		v.xz += sway * amt * k * deform;
		v.y += length(sway) * 1.3 * k * scarf * deform;
		v.x += (sin(TIME * 3.3 + uv.x * 17.0 + v.y * 9.0) * mix(0.012, 0.02, scarf) - turn * mix(0.35, 0.6, scarf)) * k * (0.4 + ripple) * deform;
		v.z += (cos(TIME * 2.7 + uv.x * 11.0 + v.y * 5.0) * mix(0.01, 0.016, scarf) * k + flare * 0.06 * k) * deform;
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
