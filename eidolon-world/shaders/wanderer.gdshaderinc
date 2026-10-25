// The wanderer (Tripo model, skinned). Shared by the figure and its reflections.
// In Godot 4 (Compatibility too: skinning runs in a transform-feedback pass before the draw) VERTEX in
// vertex() is the POST-SKINNING position in the mesh's model space; so the secondary motion below
// rides on top of the bone animation.
// Baked per-vertex data (tests/prep_wanderer.gd): COLOR.r rest height 0..1, COLOR.g distance from
// the body axis / 0.5, COLOR.b marble face, COLOR.a flutter (scarf, sleeve tatters);
// UV2 = embroidery band coords (3 hood rim, 4 / 5 cuffs).
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_disable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_disable;
uniform vec2 sway = vec2(0.0);   // cloak trail in the FIGURE's local xz (figure faces -z, the model +z)
uniform float flare = 0.0;
uniform float ripple = 0.0;      // walking: 0..1
uniform float phase = 0.0;
uniform float glint = 1.0;       // hem stripe brightness (rises with each shrine)
uniform float bone_cloth = 0.0;  // v0.8: 1 when spring bones carry the cloth: the shader keeps only a light breath

vec3 wanderer_deform(vec3 v, vec4 c) {
	float h = c.r;
	float rad = c.g;
	float fl = c.a;
	float low = 1.0 - smoothstep(0.0, 0.62, h);
	low *= low;
	// the skirt trails behind the motion, swings and opens a little with the stride
	float w = low * (0.6 + 0.4 * smoothstep(0.1, 0.5, rad)) * mix(1.0, 0.3, bone_cloth);
	vec2 sw = -sway;                         // model space is the figure turned 180 degrees
	vec2 ax = v.xz - vec2(0.0, 0.085);
	float an = atan(ax.y, ax.x);
	float rip = sin(an * 5.0 + phase * 2.0) * ripple * 0.06 * low;
	v.xz += ax * (flare * low * 0.28 + rip) * mix(1.0, 0.45, bone_cloth);
	v.y += flare * low * 0.02;
	v.xz += sw * w;
	// the scarf and the sleeve tatters: weighted by distance from the body axis and by height,
	// they trail further and flutter (more when moving)
	float k = fl * (0.35 + 0.65 * smoothstep(0.08, 0.45, rad)) * (0.5 + 0.5 * (1.0 - h));
	v.xz += sw * 1.6 * k * (1.0 - bone_cloth);
	v.y += length(sway) * 0.5 * k * (1.0 - bone_cloth);
	k *= mix(1.0, 0.3, bone_cloth);          // (the wind's breath stays, subtle)
	float sp = 0.35 + ripple;
	v.x += (sin(TIME * 3.1 + v.y * 13.0 + v.z * 7.0) * 0.007 + sin(TIME * 5.3 + v.y * 23.0) * 0.003) * k * sp;
	v.z += (cos(TIME * 2.6 + v.y * 11.0 + v.x * 5.0) * 0.008) * k * sp;
	v.y += sin(TIME * 2.2 + v.x * 9.0) * 0.004 * k * sp;
	return v;
}

// charcoal cloth (the texture darkened and cooled), the marble face kept pale
vec3 wanderer_albedo(vec2 uv, float face) {
	vec3 a = texture(albedo_tex, uv).rgb;
	float lum = dot(a, vec3(0.3, 0.59, 0.11));
	float m = face * smoothstep(0.30, 0.55, lum);
	vec3 cloth = a * 0.74 * vec3(0.93, 0.97, 1.04);
	return mix(cloth, a * vec3(0.86, 0.85, 0.82), m);
}

// the faded petrol hem stripe: a thin band at a fixed rest height, so it runs through the tatters
float hem_stripe(float h) {
	return smoothstep(0.052, 0.057, h) * (1.0 - smoothstep(0.064, 0.069, h));
}
