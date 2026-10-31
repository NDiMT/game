// World marble (shared by marble.gdshader and marble_occ.gdshader; see marble.gdshader)
global uniform vec3 player_pos;
global uniform vec3 cam_back;
global uniform float awaken;
global uniform vec4 refl_clip;        // v0.5: the active planar mirror (n.xyz, d); n = 0: none
global uniform vec4 shard_lens;             // v0.5: the raised shard's lens (x, y, radius px, on)
global uniform vec4 reveal;                 // v0.6: see-through (centre x, y px, radius px, strength 0..1)
global uniform vec4 accent;
uniform float lens_hide = 0.0;        // 1: an illusion: this stone is not there inside the lens
// v1.0 (Agent A): per INSTANCE wetness (a slab just risen out of the pool: set_instance_shader_parameter
// ("wet", 1) then tween it to 0 over ~3 s; see scripts/fx/water_fx.gd). Wet stone is darker and glossy; while
// it is very wet, water sheets down its sides in streaks; it dries in patches (the edges and the top first).
instance uniform float wet = 0.0;
// the water line the instance stood in (world y): below it the stone stays darker longest
instance uniform float wet_line = -99.0;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
// v1.0 (Agent A): CC0 PBR detail (ambientCG, see CREDITS.md and assets/textures/pbr/layers.json), two 10-layer
// texture arrays, 512 px, VRAM-compressed (S3TC desktop / ETC2 mobile web). Albedo layers are normalised to a
// mean luminance of 0.5 so they MULTIPLY the painterly procedural colour (x2 = mean 1): the palette stays, the
// stone gains grain, veins, pits and wear. nra = normal x, normal y (GL), roughness. Box-mapped in world space
// (the game is built from axis-aligned boxes: one fetch per array, no triplanar blend). pbr_k 0 = off (LOW).
// Layers: 0 floor marble, 1 white veined marble, 2 plain white marble, 3 cracked plaster, 4 grey rock,
// 5 dark water-stained stone, 6 black veined marble, 7 old wood, 8 moss, 9 worn bronze.
uniform sampler2DArray pbr_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2DArray pbr_nra : filter_linear_mipmap, repeat_enable;
uniform float pbr_k = 1.0;
uniform float pbr_normal_k = 0.55;
// v1.0 (A): the flames' crimson BOUNCE on the stone (no light cost): up to 8 lit flames (xyz, level x flicker),
// pushed by Level.set_flames() (W wires Flame.bounce_list(); see HANDOFF). w <= 0: none.
uniform vec4 flames[8];
uniform vec3 flame_col : source_color = vec3(0.95, 0.32, 0.22);
uniform float flame_k = 1.0;
uniform vec3 cream : source_color = vec3(0.745, 0.735, 0.705);
uniform vec3 vein : source_color = vec3(0.34, 0.345, 0.36);
uniform vec3 side_col : source_color = vec3(0.36, 0.355, 0.35);
uniform vec3 black_base : source_color = vec3(0.07, 0.07, 0.078);
uniform vec3 black_vein : source_color = vec3(0.55, 0.56, 0.58);
uniform vec3 char_col : source_color = vec3(0.13, 0.13, 0.14);
uniform float occlusion = 1.0;
uniform float dbg_cheap = 0.0;
uniform float fade_y = -99.0;
uniform vec4 moss_rect = vec4(6.8, -15.4, 17.2, -4.8);     // the Garden of the Veiled (x0, z0, x1, z1)      // optional: dissolve everything below this height (rising bridges)

varying vec3 wp;
varying vec3 wn;
varying float rnd;
varying float mat_id;
varying float occ;
varying float boxy;

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	rnd = COLOR.r;
	mat_id = COLOR.g;
	occ = COLOR.b;
	boxy = COLOR.a;
}

// box-mapped uv (metres / tile) and its tangent frame, from the world normal
vec2 pbr_uv(vec3 p, vec3 n, float tile, out vec3 T, out vec3 B) {
	vec3 an = abs(n);
	if (an.y >= an.x && an.y >= an.z) { T = vec3(1.0, 0.0, 0.0); B = vec3(0.0, 0.0, 1.0); return p.xz / tile; }
	if (an.x >= an.z) { T = vec3(0.0, 0.0, -sign(n.x)); B = vec3(0.0, -1.0, 0.0); return vec2(-p.z * sign(n.x), -p.y) / tile; }
	T = vec3(sign(n.z), 0.0, 0.0); B = vec3(0.0, -1.0, 0.0); return vec2(p.x * sign(n.z), -p.y) / tile;
}
// the detail of one layer: albedo multiplier (mean 1), roughness, the perturbed world normal
vec3 pbr_layer(float layer, float tile, vec3 p, vec3 n, out float r, inout vec3 nn, float nk) {
	vec3 T, B;
	vec2 uv = pbr_uv(p, n, tile, T, B);
	vec3 a = texture(pbr_albedo, vec3(uv, layer)).rgb * 2.0;
	vec3 t = texture(pbr_nra, vec3(uv, layer)).rgb;
	r = t.b;
	vec2 d = (t.rg * 2.0 - 1.0) * nk;
	nn = normalize(nn + T * d.x + B * d.y);
	return a;
}

float marble(vec3 p, float scale, float sharp) {
	float n = texture(noise_tex, p.xz * 0.11 + p.y * 0.07).r;
	float n2 = texture(noise_tex, p.zx * 0.31 + vec2(0.37, p.y * 0.2)).r;
	float v = sin((p.x * 0.9 + p.z * 0.55 + p.y * 0.7) * scale + n * 11.0 + n2 * 3.0);
	return 1.0 - smoothstep(0.0, sharp, abs(v));
}


void fragment() {
	// --- seen from behind a planar mirror (its reflection camera): nothing behind the glass exists
	bool mirror_cam = dot(refl_clip.xyz, refl_clip.xyz) > 0.25 && dot(CAMERA_POSITION_WORLD, refl_clip.xyz) < refl_clip.w - 0.5;
	if (mirror_cam && dot(wp, refl_clip.xyz) < refl_clip.w - 0.03) discard;
	if (lens_hide > 0.5 && shard_lens.w > 0.5 && length(FRAGCOORD.xy - shard_lens.xy) < shard_lens.z) discard;
	// --- v0.6 see-through: a soft circle opens in what stands between the camera and the wanderer
	float cut_haze = 0.0;
	float cut_rim = 0.0;
	float cut_alpha = 1.0;
	if (occ > 0.5 && occlusion > 0.0 && reveal.w > 0.001 && !mirror_cam) {
		float along = dot(wp - (player_pos + vec3(0.0, 0.9, 0.0)), cam_back);
		float r = reveal.z * reveal.w * smoothstep(0.15, 0.9, along) * occlusion;
		float d = length(FRAGCOORD.xy - reveal.xy);
		float k = smoothstep(2.0, 12.0, r);
#ifdef OCC_ALPHA
		// v0.8: a truly soft edge: the stone FADES (alpha) over the outer 40 % of the radius with a
		// smoothstep, no haze band, no dither; a faint aqua light lingers on the thinning stone
		float t = clamp((d - r * 0.6) / max(r * 0.4, 1.0), 0.0, 1.0);
		cut_alpha = mix(1.0, smoothstep(0.0, 1.0, t), k);
		if (cut_alpha < 0.004) discard;
		cut_rim = (1.0 - t) * step(0.004, 1.0 - t) * 0.12 * k;
#else
		// v0.7: a wide, soft edge: the inner 62 % is open, the outer 38 % a long smooth feather of haze
		float inner = r * 0.62;
		if (d < inner) discard;
		float band = max(r - inner, 1.0);
		float t = clamp((d - inner) / band, 0.0, 1.0);
		cut_haze = (1.0 - smoothstep(0.0, 1.0, t)) * k;
		cut_rim = (1.0 - smoothstep(0.0, 0.45, t)) * 0.35 * k;
#endif
	}
	float n = texture(noise_tex, wp.xz * 0.23 + wp.y * 0.13).r;
	if (dbg_cheap > 0.5) { ALBEDO = cream * (0.9 + 0.1 * n); ROUGHNESS = 0.6; SPECULAR = 0.4; } else {
	vec3 col;
	float rough = 0.6;
	float spec = 0.45;
	vec3 pbr_n = wn;          // (v1.0) the normal-mapped world normal
	float pbr_r = 0.5;        // the texture's roughness, blended in by pbr_w
	float pbr_w = 0.0;
	if (mat_id < 0.12) {
		// cream floor: large slabs (1.5 m, running bond) in world space, per-slab tint, soft worn joints
		vec2 g = wp.xz / 1.5;
		g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5;
		vec2 cell = floor(g);
		vec2 f = fract(g);
		float tr = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
		float v = marble(wp + tr * 7.0, 2.2, 0.10) * 0.8 + marble(wp * 2.7 + 3.1, 2.0, 0.05) * 0.35;
		// (v1.0 rich) every slab its own tone (+-12 %) and polish
		float tr2 = fract(tr * 7.31 + 0.17);
		vec3 tint = cream * (0.86 + 0.24 * tr) * vec3(1.0 + (tr2 - 0.5) * 0.05, 1.0, 1.0 - (tr2 - 0.5) * 0.07);
		col = mix(tint * (0.92 + 0.14 * n), vein, clamp(v, 0.0, 1.0) * 0.5);
		float slab_r = 0.22 + 0.36 * tr2;
		if (pbr_k > 0.0) {
			float pr;
			vec3 det = pbr_layer(0.0, 1.5, wp + vec3(tr * 17.0, 0.0, tr * 9.0), wn, pr, pbr_n, pbr_normal_k);
			col *= mix(vec3(1.0), det, 0.9 * pbr_k);
			pbr_r = mix(pr, slab_r, 0.5); pbr_w = 0.7 * pbr_k;
		}
		vec2 e = min(f, 1.0 - f) * 1.5;
		float ed = min(e.x, e.y);
		float aa = fwidth(wp.x) * 1.2;
		// the joints: a visible grout line (its width wanders), grime gathered beside it, worn rounded
		// edges catching the light, chipped corners
		float gw = 0.011 + 0.006 * texture(noise_tex, wp.xz * 1.7).r;
		float grout = 1.0 - smoothstep(gw, gw + aa, ed);
		col *= mix(0.8, 1.0, smoothstep(0.0, 0.09, ed));                        // grime beside the joints
		col = mix(col, col * 1.07 + vec3(0.015), (1.0 - smoothstep(gw + aa, gw + 0.035, ed)) * (1.0 - grout) * 0.6);   // the worn edge
		vec2 cc = min(f, 1.0 - f) * 1.5;
		float corner = length(cc);
		float chipn = texture(noise_tex, wp.xz * 3.1 + tr).r;
		float chipped = (1.0 - smoothstep(0.05, 0.13, corner + (chipn - 0.5) * 0.08)) * step(0.45, tr2);
		col = mix(col, vec3(0.5, 0.49, 0.47), chipped * 0.55);
		vec3 gcol = vec3(0.34, 0.335, 0.32);
		// outdoors (not the hall), moss and lichen grow in the joints
		float indoor = 1.0 - smoothstep(0.0, 1.5, max(max(-5.5 - wp.x, wp.x - 5.5), max(-21.5 - wp.z, wp.z + 10.5)));
		float jm = smoothstep(0.56, 0.76, texture(noise_tex, wp.xz * 0.6 + 2.3).r) * (1.0 - indoor);
		gcol = mix(gcol, vec3(0.37, 0.39, 0.30), jm * 0.8);
		col = mix(col, gcol, grout * 0.85);
		col = mix(col, mix(col, vec3(0.46, 0.48, 0.38), 0.5), jm * (1.0 - smoothstep(gw, gw + 0.05, ed)) * 0.5);
		// dirt: broad faint patches, heavier toward the edges of a space (where feet seldom go)
		float dirt = smoothstep(0.45, 0.8, texture(noise_tex, wp.xz * 0.07 + 7.1).r);
		col *= 1.0 - dirt * 0.12;
		// sparse cracks and stains
		float ck = texture(noise_tex, wp.xz * 0.21 + 0.5).r;
		float crack = (1.0 - smoothstep(0.0, 0.010, abs(ck - 0.5))) * step(0.62, tr);
		col = mix(col, vec3(0.30), crack * 0.55);
		float stain = smoothstep(0.55, 0.8, texture(noise_tex, wp.xz * 0.05 + 0.2).r);
		col *= 1.0 - stain * 0.10;
		float side = 1.0 - smoothstep(0.55, 0.85, wn.y);
		col = mix(col, side_col * (0.85 + 0.3 * n), side * 0.65);
		rough = slab_r + n * 0.15;
	} else if (mat_id < 0.37) {
		vec3 p = wp + rnd * 11.0;
		float v = marble(p, 2.4, 0.11) * 0.85 + marble(p * 2.3 + 1.7, 2.0, 0.06) * 0.35;
		col = mix(cream * (0.86 + 0.16 * rnd) * (0.92 + 0.12 * n), vein, clamp(v, 0.0, 1.0) * 0.55);
		if (pbr_k > 0.0) {
			// two marbles per piece (veined / plain), weathered toward cracked plaster in patches and low down
			float pr, pr2;
			vec3 nn2 = pbr_n;
			vec3 det = pbr_layer(rnd > 0.5 ? 1.0 : 2.0, 2.2, wp + rnd * 13.0, wn, pr, pbr_n, pbr_normal_k);
			vec3 pl = pbr_layer(3.0, 1.8, wp + rnd * 7.0, wn, pr2, nn2, pbr_normal_k);
			float weather = smoothstep(0.55, 0.8, texture(noise_tex, wp.xz * 0.09 + wp.y * 0.11 + rnd).r) * 0.7 + (1.0 - smoothstep(0.0, 1.4, wp.y - 0.0)) * 0.2;
			det = mix(det, pl, clamp(weather, 0.0, 0.85));
			pbr_n = normalize(mix(pbr_n, nn2, clamp(weather, 0.0, 0.85)));
			col *= mix(vec3(1.0), det, 0.9 * pbr_k);
			// the plaster flakes: a dark lip where the skin of plaster has broken off
			float lip = smoothstep(0.2, 0.32, weather) * (1.0 - smoothstep(0.32, 0.45, weather));
			col *= 1.0 - lip * 0.28;
			pbr_r = mix(pr, pr2, weather); pbr_w = 0.6 * pbr_k;
		}
		// weathering: darker toward the ground and in crevices
		col *= mix(0.78, 1.0, smoothstep(-0.2, 1.2, wn.y + 0.6));
		rough = 0.45;
	} else if (mat_id < 0.62) {
		float depth = clamp((1.5 - wp.y) / 6.0, 0.0, 1.0);
		float strata = 0.88 + 0.12 * sin(wp.y * 19.0 + n * 6.0);
		col = side_col * (0.72 + 0.42 * n) * strata * mix(1.0, 0.55, depth);
		if (pbr_k > 0.0) {
			// grey rock; dark water-stained stone low down (toward the water and the void)
			float pr, pr2;
			vec3 nn2 = pbr_n;
			vec3 det = pbr_layer(4.0, 3.0, wp, wn, pr, pbr_n, pbr_normal_k * 1.2);
			vec3 dk = pbr_layer(5.0, 2.5, wp + 3.0, wn, pr2, nn2, pbr_normal_k * 1.2);
			float wet_low = 1.0 - smoothstep(-1.2, 0.6, wp.y + (n - 0.5) * 0.8);
			det = mix(det, dk, wet_low);
			pbr_n = normalize(mix(pbr_n, nn2, wet_low));
			col *= mix(vec3(1.0), det, 0.75 * pbr_k);
			pbr_r = mix(pr, pr2, wet_low); pbr_w = 0.6 * pbr_k;
		}
		rough = 0.95;
		spec = 0.2;
	} else if (mat_id < 0.87) {
		vec2 g = wp.xz * 0.5;
		vec2 f = fract(g);
		vec2 cell = floor(g);
		float tr = fract(sin(dot(cell, vec2(41.3, 17.7))) * 9431.7);
		float v = marble(wp * 1.3 + tr * 5.0, 2.6, 0.05);
		col = mix(black_base * (0.9 + 0.3 * n), black_vein, v * 0.6);
		if (pbr_k > 0.0) {
			float pr;
			vec3 det = pbr_layer(6.0, 2.0, wp + tr * 11.0, wn, pr, pbr_n, pbr_normal_k * 0.4);
			col = col * mix(vec3(1.0), det, 0.8 * pbr_k) + vec3(0.06, 0.065, 0.075) * smoothstep(1.2, 2.0, det.r) * pbr_k;    // its white veins
		}
		// (v1.0 rich) polished: a soft mirrored glow of the fog and the lights drifting across it (the view
		// is fixed: a broad cloudy pattern in world space that slides with the camera's height)
		float refl = smoothstep(0.35, 0.85, texture(noise_tex, wp.xz * 0.06 + CAMERA_POSITION_WORLD.xz * 0.004).r);
		col += vec3(0.07, 0.075, 0.085) * refl;
		vec2 e = min(f, 1.0 - f);
		float aa = fwidth(g.x) * 1.5;
		float seam = 1.0 - smoothstep(0.006, 0.006 + aa, min(e.x, e.y));
		col = mix(col, vec3(0.32, 0.33, 0.35), seam * 0.5);
		float side = 1.0 - smoothstep(0.55, 0.85, wn.y);
		col = mix(col, side_col * 0.6, side * 0.7);
		// polished: soft reflections of the pale sky drift across the floor
		float streak = smoothstep(0.55, 1.0, sin((wp.x + wp.z) * 0.55 + n * 3.0)) * (1.0 - side);
		col += vec3(0.07, 0.075, 0.085) * streak + vec3(0.025, 0.03, 0.035);
		rough = mix(0.06, 0.5, side);
		spec = 0.9;
	} else {
		// v1.0: COLOR.g 0.87..0.95 = patinated BRONZE (layer 9, verdigris in the hollows), 0.95..0.995 = old brown WOOD,
		// 1.0 = charcoal as before (dead trees, iron: near-black with a wood grain)
		bool bronze = mat_id < 0.95;
		bool wood = !bronze && mat_id < 0.995;
		col = bronze ? vec3(0.30, 0.22, 0.13) * (0.8 + 0.4 * n)
			: (wood ? vec3(0.26, 0.18, 0.115) : char_col) * (0.8 + 0.4 * n) * (0.9 + 0.2 * rnd);
		if (pbr_k > 0.0) {
			float pr;
			vec3 det = pbr_layer(bronze ? 9.0 : 7.0, bronze ? 0.8 : 1.2, wp + rnd * 5.0, wn, pr, pbr_n, pbr_normal_k * (bronze || wood ? 1.2 : 1.0));
			col *= mix(vec3(1.0), det, (bronze || wood ? 0.95 : 0.7) * pbr_k);
			pbr_r = pr; pbr_w = (bronze || wood ? 0.6 : 0.5) * pbr_k;
		}
		if (bronze) {
			float vg = smoothstep(0.5, 0.75, texture(noise_tex, wp.xz * 2.3 + wp.y * 1.7).r);
			col = mix(col, vec3(0.25, 0.42, 0.36), vg * 0.6);                 // verdigris
		}
		rough = bronze ? 0.45 : 0.8;
		spec = bronze ? 0.7 : 0.3;
	}
	// worn, chamfered edges on blocks: a pale bevel catching the light, a soft shadow just inside
	if (boxy > 0.5 && mat_id < 0.87) {
		vec2 fuv = fract(UV * vec2(3.0, 2.0));
		float mpu = length(fwidth(wp)) / max(length(fwidth(fuv)), 1e-5);
		vec2 em = min(fuv, 1.0 - fuv) * mpu;
		float ed = min(em.x, em.y);
		float chip = texture(noise_tex, wp.xz * 1.9 + wp.y * 1.3).r;
		float bevel = 1.0 - smoothstep(0.012, 0.05 + chip * 0.03, ed);
		float inner = smoothstep(0.03, 0.06, ed) * (1.0 - smoothstep(0.06, 0.13, ed));
		col = mix(col, col * 1.26 + vec3(0.04, 0.035, 0.02), bevel * (0.55 + 0.45 * max(wn.y, 0.0)));
		col *= 1.0 - inner * 0.08;
		// (v1.0 rich) chips knocked out of the edges: small darker bites along the bevel
		float bite = (1.0 - smoothstep(0.0, 0.035, ed)) * smoothstep(0.62, 0.72, chip);
		col = mix(col, col * 0.62, bite);
		// water staining: streaks running down the faces from the top edge (under ledges and cornices)
		if (abs(wn.y) < 0.5) {
			float hz = dot(wp.xz, vec2(abs(wn.z), abs(wn.x)));
			float st = texture(noise_tex, vec2(hz * 1.9, wp.y * 0.12)).r;
			float stain = smoothstep(0.52, 0.78, st) * (1.0 - smoothstep(0.0, 0.85, fuv.y + (st - 0.5) * 0.4));
			col *= 1.0 - stain * 0.3 * vec3(1.0, 1.04, 1.1);
		}
		// v1.0 (A): contact AO: a block's sides darken softly toward their bottom edge, where they meet the
		// ground or the block below (a cheap stand-in for SSAO, which the Compatibility renderer lacks)
		if (abs(wn.y) < 0.5) {
			float dbot = (1.0 - fuv.y) * mpu;
			col *= mix(0.74, 1.0, smoothstep(0.0, 0.42, dbot + chip * 0.05));
		}
	}
	// moss and lichen in the garden: on upward faces near the ground and in sheltered corners
	if (wp.x > moss_rect.x && wp.x < moss_rect.z && wp.z > moss_rect.y && wp.z < moss_rect.w && mat_id < 0.62) {
		float mn = texture(noise_tex, wp.xz * 0.35 + 3.7).r * 0.7 + texture(noise_tex, wp.xz * 1.7 + wp.y).r * 0.3;
		float low = 1.0 - smoothstep(1.0, 2.2, wp.y);
		float moss = smoothstep(0.60, 0.74, mn) * low * (0.3 + 0.7 * max(wn.y, 0.0));
		vec3 mcol = vec3(0.52, 0.55, 0.45) * (0.88 + 0.24 * n);
		if (pbr_k > 0.0) {
			float pr;
			vec3 nm_ = pbr_n;
			mcol *= mix(vec3(1.0), pbr_layer(8.0, 1.0, wp, wn, pr, nm_, 0.0), 0.6 * pbr_k);
		}
		col = mix(col, mcol, moss * 0.5);
		float li = step(0.86, texture(noise_tex, wp.xz * 6.0 + wp.yy * 5.0).r) * (1.0 - abs(wn.y));
		col = mix(col, vec3(0.76, 0.74, 0.62), li * 0.35);
	}
	// each space has its own stone: cooler in the Hall of Glass, warmer in the Court, golden at the Shrine
	float hall = (1.0 - smoothstep(0.0, 1.5, max(max(-5.5 - wp.x, wp.x - 5.5), max(-21.5 - wp.z, wp.z + 10.5))));
	float court = (1.0 - smoothstep(0.0, 2.0, max(max(6.5 - wp.x, wp.x - 17.5), max(-27.5 - wp.z, wp.z + 16.5))));
	float shrine = (1.0 - smoothstep(0.0, 2.0, max(max(19.5 - wp.x, wp.x - 30.5), max(-40.0 - wp.z, wp.z + 27.5))));
	col *= mix(vec3(1.0), vec3(0.95, 0.985, 1.05), hall);
	col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.92), court);
	col *= mix(vec3(1.0), vec3(1.04, 1.01, 0.94), shrine);
	// a hint of warmth in the pale stone (light seems to sink into the marble)
	if (mat_id < 0.37) col += vec3(0.022, 0.012, 0.0) * smoothstep(0.4, 0.9, dot(col, vec3(0.33)));
	if (wet > 0.001) {
		float dn = texture(noise_tex, wp.xz * 0.55 + wp.y * 0.4).r;
		// drying: patchy, the top faces and the edges first, the part that stood in the water last
		float hold = 0.25 * (1.0 - max(wn.y, 0.0)) + 0.35 * (1.0 - smoothstep(wet_line, wet_line + 0.25, wp.y));
		float wk = smoothstep(0.0, 0.5, wet * 1.25 + hold * wet + (dn - 0.5) * 0.5 * min(wet * 4.0, 1.0));
		col *= mix(1.0, 0.58, wk);
		rough = mix(rough, 0.12, wk);
		spec = mix(spec, 0.8, wk);
		// sheeting: streaks running down the vertical faces while it is very wet
		float vert = 1.0 - smoothstep(0.35, 0.75, abs(wn.y));
		float sv = texture(noise_tex, vec2(dot(wp.xz, vec2(0.7, 0.7)) * 2.6, wp.y * 0.35 + TIME * 0.55)).r;
		float sheet = smoothstep(0.55, 0.8, sv) * vert * smoothstep(0.45, 0.95, wet);
		col = mix(col, col * 0.75 + vec3(0.05, 0.055, 0.06), sheet * 0.6);
		col += vec3(0.06) * sheet * smoothstep(0.75, 0.9, sv);
	}
	if (wp.y < fade_y) discard;
	// the see-through's edge: the stone thins into pale haze toward the cut, a faint aqua light on it
	col = mix(col, vec3(0.80, 0.82, 0.82), cut_haze * 0.8);
	ALBEDO = col;
	vec3 fb = vec3(0.0);
	if (flame_k > 0.0) {
		for (int i = 0; i < 8; i++) {
			vec4 fl = flames[i];
			if (fl.w <= 0.0) continue;
			vec3 d = fl.xyz - wp;
			float r = length(d);
			if (r > 5.0) continue;
			float fall = fl.w / (1.0 + r * r * 0.9) * (1.0 - smoothstep(3.0, 5.0, r));
			float lam = 0.35 + 0.65 * max(dot(wn, d / max(r, 1e-3)), 0.0);
			fb += flame_col * fall * lam;
		}
	}
	EMISSION = accent.rgb * cut_rim * 0.75 + col * fb * 0.55 * flame_k;
#ifdef OCC_ALPHA
	ALPHA = cut_alpha;
#endif
	ROUGHNESS = mix(rough, pbr_r, pbr_w);
	SPECULAR = spec;
	if (pbr_k > 0.0) NORMAL = normalize((VIEW_MATRIX * vec4(pbr_n, 0.0)).xyz);
	}
}
