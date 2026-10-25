shader_type spatial;
// v0.7 "The Pool of Halves": the still pool reflects the stone beams of the broken path: yours, and the
// ones that exist only on HER side (seen only here, in the water, until the path is whole). Each water
// fragment traces its reflected view ray up out of the water against the beams' arms (boxes from the
// waterline to the top); a hit shows the beam's flank upside down, a bright line at its top edge, and a
// glowing seam at every connector end, so a reflected path reads at a glance.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
global uniform vec4 her;
global uniform vec4 her_core;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec4 arm_box[40];           // x0, z0, x1, z1
uniform vec4 arm_info[40];          // end direction x, z (the connector face), hers (1) / yours (0), lit
uniform int count = 0;
uniform float water_y = -0.42;
uniform float top_y = 0.0;
uniform float pulse = 0.0;
uniform float flash = 0.0;          // v0.8.1: a joint just answered: a brief light on the seams, then plain stone          // hint: the connectors shine
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

float box_hit(vec3 o, vec3 d, vec3 bmin, vec3 bmax) {
	vec3 inv = 1.0 / d;
	vec3 t0 = (bmin - o) * inv;
	vec3 t1 = (bmax - o) * inv;
	vec3 lo = min(t0, t1);
	vec3 hi = max(t0, t1);
	float tn = max(max(lo.x, lo.y), lo.z);
	float tf = min(min(hi.x, hi.y), hi.z);
	return (tf >= max(tn, 0.0)) ? max(tn, 0.0) : -1.0;
}

// v0.8 (QA P0-1): HER slabs are drawn at their TRUE top height, as a glowing ghost standing in the water
// (no reflection parallax: her arm ends meet yours on screen); YOUR slabs keep their reflection.
float rbox(vec2 p, vec4 b) { vec2 c = 0.5 * (b.xy + b.zw); vec2 h = 0.5 * (b.zw - b.xy); vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

void fragment() {
	vec3 vd = normalize(-(INV_VIEW_MATRIX * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
	vec3 rd = vec3(vd.x, -vd.y, vd.z);
	float n1 = texture(noise_tex, wp.xz * 0.9 + TIME * vec2(0.03, 0.02)).r - 0.5;
	float n2 = texture(noise_tex, wp.xz * 1.7 - TIME * vec2(0.02, 0.03)).r - 0.5;
	vec3 o = vec3(wp.x + n1 * 0.03, water_y + 0.001, wp.z + n2 * 0.03);
	// her top faces: back along the view ray to the plane of the slab tops
	vec3 pt = o - vd * ((top_y - water_y) / max(-vd.y, 0.05));
	float hd = 9.0;
	int hi = -1;
	for (int i = 0; i < 40; i++) {
		if (i >= count) break;
		if (arm_info[i].z < 0.5) continue;
		float d = rbox(pt.xz, arm_box[i]);
		if (d < hd) { hd = d; hi = i; }
	}
	if (hi >= 0 && hd < 0.0) {
		vec4 b = arm_box[hi];
		vec4 inf = arm_info[hi];
		float st = texture(noise_tex, pt.xz * 1.3).r;
		// (v0.8.1, the owner: plain stone, the same marble as yours, seen in the water: no rose, no glow)
		float rim = 1.0 - smoothstep(0.0, 0.05, -hd);
		vec3 c = mix(vec3(0.66, 0.655, 0.635), vec3(0.76, 0.75, 0.725), st);
		c = mix(c, c * 0.8, rim * 0.6);                    // (a worn chamfer at its edge)
		c = mix(c, vec3(0.42, 0.47, 0.5), 0.18);          // (seen through a skin of water)
		// the carved channel down its middle, and the joint seam at its end when answered
		vec2 ed = inf.xy;
		float across = abs(ed.x) > 0.5 ? abs(pt.z - 0.5 * (b.y + b.w)) : abs(pt.x - 0.5 * (b.x + b.z));
		c = mix(c, c * 0.5, (1.0 - smoothstep(0.07, 0.1, across)) * 0.9);   // the engraved channel: a darker line
		float endc = ed.x > 0.5 ? b.z : (ed.x < -0.5 ? b.x : (ed.y > 0.5 ? b.w : b.y));
		float along = abs(ed.x) > 0.5 ? pt.x : pt.z;
		float seam = (1.0 - smoothstep(0.0, 0.06, abs(along - endc))) * inf.w;
		c = mix(c, accent_core.rgb * 1.3, seam * flash);
		ALBEDO = c;
		ALPHA = 0.86 + 0.1 * rim;
	} else {
	float best = 1e9;
	int bi = -1;
	vec3 hp = vec3(0.0);
	for (int i = 0; i < 40; i++) {
		if (i >= count) break;
		if (arm_info[i].z > 0.5) continue;
		vec4 b = arm_box[i];
		float t = box_hit(o, rd, vec3(b.x, water_y, b.y), vec3(b.z, top_y, b.w));
		if (t >= 0.0 && t < best) { best = t; bi = i; hp = o + rd * t; }
	}
	float halo = 0.0;
	if (bi < 0 && halo < 0.02) discard;
	vec3 c = her.rgb;
	float a = halo * 0.45;
	if (bi >= 0) {
		vec4 b = arm_box[bi];
		vec4 inf = arm_info[bi];
		float up = clamp((hp.y - water_y) / (top_y - water_y), 0.0, 1.0);
		float st = texture(noise_tex, vec2(hp.x + hp.z, hp.y) * vec2(1.3, 6.0)).r;
		c = mix(vec3(0.13, 0.15, 0.17), vec3(0.44, 0.46, 0.47), up * up) * (0.9 + 0.2 * st);
		float edge = smoothstep(0.66, 0.95, up);
		c = mix(c, vec3(0.62, 0.62, 0.6), edge * 0.35);
		vec2 ed = inf.xy;
		float endc = ed.x > 0.5 ? b.z : (ed.x < -0.5 ? b.x : (ed.y > 0.5 ? b.w : b.y));
		float along = abs(ed.x) > 0.5 ? hp.x : hp.z;
		float seam = 1.0 - smoothstep(0.0, 0.07, abs(along - endc));
		c = mix(c, accent_core.rgb * 1.3, seam * inf.w * flash);
		a = 0.9;
	}
	ALBEDO = c;
	ALPHA = a;
	}
}
