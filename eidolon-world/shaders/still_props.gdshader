shader_type spatial;
// v3 (Agent A, a3) The Still Room's props (StillRoomFx): one lit material for the glass's frame, the cleats, the
// ropes and the door bars. Vertex COLOR packs:
//   g = material: 0.00 aged SILVER (polished on the raised edges, tarnished brown-black in the hollows),
//       0.33 bronze (verdigris in patches), 0.50 crimson enamel (the accent), 0.66 old dark timber (grain along the
//       piece), 0.80 black iron (rust spots), 1.00 hemp rope (three twisted strands, one dyed crimson)
//   r = how deep in a hollow (0 raised, 1 deep: more tarnish, darker)
//   b = rope wraps round a cleat: 0 none, else the wrap's order (they come off from the highest, `unwrap` 0..1)
// Rope tubes carry UV.x = metres along the rope, UV.y = round it. Web-safe (no screen / depth texture).
render_mode cull_back, depth_draw_opaque;
global uniform vec4 accent;
uniform float unwrap = 0.0;          // 0..1: the wraps already off a cleat
uniform float rope_gone = -1.0;      // metres of rope (from its cleat end) already run off
uniform float whip = 0.0;            // the freed end's lash (0..1)
uniform vec3 whip_dir = vec3(0.0, 0.0, 1.0);
varying vec3 lp;
varying vec3 wp;
varying float mat_id;

float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec3 p) {
	vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return vnoise(p) * 0.55 + vnoise(p * 2.3 + 7.1) * 0.3 + vnoise(p * 5.1 + 3.7) * 0.15; }

void vertex() {
	mat_id = COLOR.g;
	if (COLOR.g > 0.95 && rope_gone > -0.5) {
		// the freed end lashes: a travelling wave that dies away from the end
		float s = UV.x - max(rope_gone, 0.0);
		VERTEX += whip_dir * whip * 0.09 * sin(s * 9.0 - TIME * 34.0) * exp(-max(s, 0.0) * 2.2);
	}
	lp = VERTEX;
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	if (COLOR.b > 0.01 && COLOR.b > 1.0 - unwrap + 0.001) discard;
	if (mat_id > 0.95 && UV.x < rope_gone) discard;
	vec3 col; float rough; float metal; float spec = 0.5;
	float n = fbm(wp * 3.1);
	float hollow = COLOR.r;
	// box faces: BoxMesh lays its six faces in a 3 x 2 atlas; their edges are the worn, raised (polished) lines
	vec2 f = fract(UV * vec2(3.0, 2.0));
	float edge = 1.0 - smoothstep(0.0, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
	if (mat_id < 0.15) {
		// aged silver: the tarnish gathers in the hollows and in blotches; the raised edges stay rubbed bright
		float tarn = clamp(hollow * 0.75 + smoothstep(0.42, 0.78, n) * 0.55 - edge * 0.6, 0.0, 1.0);
		// (a3: kept mostly dielectric-bright: with no reflection probes a true metal reads as black iron on the web)
		vec3 silver = vec3(0.86, 0.86, 0.84) * (0.94 + 0.08 * vnoise(wp * 23.0));
		vec3 tarnish = mix(vec3(0.34, 0.30, 0.24), vec3(0.16, 0.14, 0.12), smoothstep(0.5, 0.9, fbm(wp * 9.0)));
		col = mix(silver, tarnish, tarn * 0.85);
		metal = mix(0.45, 0.15, tarn);
		rough = mix(0.3, 0.7, tarn);
		spec = 0.6;
	} else if (mat_id < 0.42) {
		float verd = smoothstep(0.5, 0.75, fbm(wp * 6.0 + 2.0)) * (0.4 + 0.6 * hollow);
		col = mix(vec3(0.42, 0.28, 0.14) * (0.85 + 0.3 * n), vec3(0.24, 0.44, 0.37), verd);
		col = mix(col, vec3(0.62, 0.46, 0.26), edge * 0.5 * (1.0 - verd));
		metal = mix(0.85, 0.1, verd);
		rough = mix(0.35, 0.85, verd);
	} else if (mat_id < 0.58) {
		col = accent.rgb * 0.75;
		metal = 0.0;
		rough = 0.12;
		spec = 0.8;
		EMISSION = accent.rgb * 0.12;
	} else if (mat_id < 0.73) {
		// timber: grain along the bar (local x), knots, darker at the hollows
		float g = sin(lp.y * 140.0 + lp.z * 90.0 + vnoise(lp * vec3(1.2, 9.0, 9.0)) * 9.0);
		col = vec3(0.20, 0.13, 0.08) * (0.8 + 0.18 * g + 0.25 * n) * (1.0 - 0.35 * hollow);
		metal = 0.0;
		rough = 0.82;
		spec = 0.3;
	} else if (mat_id < 0.9) {
		float rust = smoothstep(0.55, 0.8, fbm(wp * 7.0 + 5.0));
		col = mix(vec3(0.13, 0.13, 0.14) * (0.85 + 0.3 * n), vec3(0.32, 0.15, 0.07), rust);
		col += vec3(0.12) * edge * (1.0 - rust);
		metal = mix(0.75, 0.0, rust);
		rough = mix(0.5, 0.9, rust);
	} else {
		// hemp rope: three strands twisted round (UV.y round it, UV.x metres along); the third dyed crimson
		float tw = fract(UV.y * 3.0 - UV.x * 9.0);
		float strand = floor(fract(UV.y - UV.x * 3.0) * 3.0);
		float groove = smoothstep(0.0, 0.18, tw) * smoothstep(1.0, 0.82, tw);
		vec3 hemp = vec3(0.58, 0.48, 0.33) * (0.85 + 0.25 * vnoise(vec3(UV * vec2(60.0, 12.0), 0.0)));
		col = (strand > 1.5 ? accent.rgb * 0.62 : hemp) * (0.55 + 0.45 * groove);
		metal = 0.0;
		rough = 0.95;
		spec = 0.25;
	}
	ALBEDO = col;
	METALLIC = metal;
	ROUGHNESS = rough;
	SPECULAR = spec;
}
