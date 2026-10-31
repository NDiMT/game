// v1.0 (Agent A): water events shared by water.gdshader and water_over.gdshader, fed by scripts/fx/water_fx.gd.
//  ev[i]     = (x, z, age s, strength): a splash: a raised bulge for the first half second, then rings running
//              outwards (a fast front and a slower train), a short burst of white water at the centre
//  ev_box[i] = (x0, z0, x1, z1) and ev_box_k[i] = (age s, duration s, strength, 0): a body breaking the surface
//              (a slab rising): a foam collar hugging its sides, water sheeting off it (a bright band
//              spreading out), rings running off its edges; all of it settles over `duration`
uniform vec4 ev[8];
uniform vec4 ev_box[8];
uniform vec4 ev_box_k[8];
uniform int wfx_n = 8;          // (Low tier: 3; set by scripts/fx/water_fx.gd)

float wfx_box(vec2 p, vec4 b) {
	vec2 c = 0.5 * (b.xy + b.zw); vec2 h = 0.5 * (b.zw - b.xy);
	vec2 d = abs(p - c) - h;
	return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// height-like ripple signal (for normals and shading), foam and the bulge, at water point p
void wfx_events(vec2 p, float nz, out float h, out float foam, out float bulge) {
	h = 0.0; foam = 0.0; bulge = 0.0;
	for (int i = 0; i < 8; i++) {
		if (i >= wfx_n) break;
		vec4 e = ev[i];
		if (e.z < 0.0 || e.w <= 0.0) continue;
		float r = length(p - e.xy);
		float a = e.z;
		float f1 = a * 0.95;
		float f2 = a * 0.55;
		float env = exp(-a * 0.55) * e.w;
		h += sin((r - f1) * 22.0) * exp(-pow((r - f1) * 4.0, 2.0)) * env;
		h += 0.6 * sin((r - f2) * 30.0) * exp(-pow((r - f2) * 3.0, 2.0)) * exp(-r * 0.6) * env;
		float b = exp(-r * r / 0.18) * smoothstep(0.0, 0.08, a) * (1.0 - smoothstep(0.15, 0.7, a)) * e.w;
		bulge += b;
		foam += exp(-r * r / (0.05 + a * 0.08)) * (1.0 - smoothstep(0.2, 1.6, a)) * e.w * (0.55 + 0.45 * nz);
	}
	for (int i = 0; i < 8; i++) {
		if (i >= wfx_n) break;
		vec4 k = ev_box_k[i];
		if (k.x < 0.0 || k.z <= 0.0) continue;
		float d = wfx_box(p, ev_box[i]);
		if (d > 3.5) continue;
		float a = k.x;
		float life = 1.0 - smoothstep(k.y * 0.4, k.y, a);
		float fr = a * 0.8;
		float dd = max(d, 0.0);
		h += sin((dd - fr) * 20.0) * exp(-pow((dd - fr) * 3.2, 2.0)) * exp(-a * 0.45) * k.z;
		h += 0.35 * sin(dd * 34.0 - a * 9.0) * exp(-dd * 4.0) * life * k.z;           // chop against its sides
		// the collar: white water hugging the sides, broken up, spreading as the sheet runs off
		float band = 0.08 + 0.3 * smoothstep(0.0, 1.2, a);
		float col = (1.0 - smoothstep(0.0, band, dd)) * step(-0.02, d);
		float brk = smoothstep(0.25, 0.75, nz + 0.25 * sin(dd * 40.0 - a * 6.0));
		foam += col * brk * life * k.z * 1.4;
		bulge += exp(-dd * 7.0) * step(-0.02, d) * (1.0 - smoothstep(0.1, 0.9, a)) * k.z;
	}
}
