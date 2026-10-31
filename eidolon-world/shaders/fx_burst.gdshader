shader_type spatial;
// v1.1 (Agent A) soft particles, all on the GPU, one MultiMesh (one draw call) per burst / loop. Built by
// scripts/fx/fx_burst.gd (FxBurst). Each instance: transform origin = where it starts; INSTANCE_CUSTOM =
// (random a, random b, random c, start delay 0..1 of life). `kind` picks the look and the motion:
//   0 SPLASH droplets  1 DUST puff  2 SPARK  3 GLINT twinkle  4 EMBER  5 MIST wisp
// Soft particles, WEB-SAFE (v1.1b: no depth or screen texture: those break the web Compatibility build): a particle
// fades as it nears the ground plane `ground_y` (so puffs and wisps never cut hard lines into the floor) and within
// `near_fade` m of the camera. Size and colour change over life; fast droplets and sparks are stretched along their motion.
render_mode skip_vertex_transform, unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;

uniform int kind = 0;
uniform float clock = 0.0;          // seconds since the burst began (FxBurst drives it)
uniform float life = 1.2;
uniform float loop = 0.0;           // 1: an endless emitter (each particle restarts)
uniform float speed = 2.0;          // initial speed (m/s)
uniform float spread = 1.0;         // 0..1: the cone (0 straight up/out along `dir`, 1 a full hemisphere)
uniform vec3 dir = vec3(0.0, 1.0, 0.0);
uniform float gravity = 9.8;
uniform float drag = 0.0;
uniform float size0 = 0.04;
uniform float size1 = 0.02;
uniform vec4 col0 : source_color = vec4(0.9, 0.95, 1.0, 0.9);
uniform vec4 col1 : source_color = vec4(0.8, 0.85, 0.9, 0.0);
uniform float stretch = 0.0;        // seconds of motion a particle is stretched over (0: round)
uniform float soft = 0.25;          // fade distance above the ground (m); 0 = off (the Low tier)
uniform float ground_y = -1000.0;   // the floor / water height under the burst (FxBurst sets it)
uniform float near_fade = 0.0;      // fade within this many metres of the camera (0 = off)
uniform vec3 light_dir = vec3(0.304, -0.819, -0.486);
uniform vec3 wind = vec3(0.0);
uniform float boost = 0.0;          // v1.1c: a brief swell (embers right after ignition; FxBurst decays it)

varying float age_k;
varying vec2 qv;
varying float vlen;
varying float vview_z;
varying float vheight;
varying vec4 vcol;

vec3 h3(vec3 r) { return fract(sin(r * vec3(12.9898, 78.233, 37.719) + r.yzx * 4.1) * 43758.5453); }

void vertex() {
	vec4 c = INSTANCE_CUSTOM;
	vec3 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float L = life * (0.75 + 0.5 * c.g);
	float t = clock - c.a * life;
	if (loop > 0.5) t = mod(clock + c.a * life * 7.0, L);
	age_k = clamp(t / L, 0.0, 1.0);
	float alive = step(0.0, t) * step(t, L);
	// the start velocity: within a cone round `dir`
	vec3 r = h3(c.rgb + 0.37) * 2.0 - 1.0;
	vec3 d0 = normalize(dir);
	vec3 v0 = normalize(mix(d0, normalize(d0 + r * 1.2), spread)) * speed * (0.6 + 0.6 * c.b);
	float tt = max(t, 0.0);
	vec3 p, v;
	if (kind == 5) {                       // mist: a slow drift that swells
		v = wind + v0 * 0.15;
		p = origin + v * tt + vec3(sin(tt * 0.7 + c.r * 6.0), 0.0, cos(tt * 0.5 + c.g * 6.0)) * 0.25;
	} else if (kind == 4) {                // ember: rises, sways, flickers out
		v = (vec3(0.0, 0.55 + 0.4 * c.b, 0.0) + r * 0.12) * (1.0 + boost * 0.8) + wind;
		p = origin + v * tt + vec3(sin(tt * 3.1 + c.r * 9.0), 0.0, cos(tt * 2.7 + c.g * 9.0)) * 0.06 * tt;
	} else if (kind == 3) {                // glint: stays, twinkles
		v = vec3(0.0);
		p = origin + r * vec3(0.18, 0.12, 0.18) + vec3(0.0, 0.08 * sin(tt * 1.3 + c.r * 6.0), 0.0);
	} else {
		float k = drag > 0.0 ? (1.0 - exp(-drag * tt)) / drag : tt;
		v = v0 * exp(-drag * tt) + vec3(0.0, -gravity, 0.0) * tt + wind;
		p = origin + v0 * k + vec3(0.0, -0.5 * gravity, 0.0) * tt * tt + wind * tt;
	}
	float s = mix(size0, size1, age_k) * (0.7 + 0.6 * c.r) * alive;
	s *= 1.0 + boost * 0.5;
	if (kind == 1) s *= 0.6 + 0.8 * smoothstep(0.0, 0.35, age_k);          // dust swells, then thins
	if (kind == 3) s *= 0.4 + 0.6 * abs(sin(tt * 4.0 + c.g * 20.0));     // a twinkle
	// camera-facing quad; stretched along the screen-space motion for fast droplets / sparks
	vec3 right = INV_VIEW_MATRIX[0].xyz, up = INV_VIEW_MATRIX[1].xyz;
	vec3 sv = v - dot(v, INV_VIEW_MATRIX[2].xyz) * INV_VIEW_MATRIX[2].xyz;
	float sl = length(sv) * stretch;
	vec3 ax = up, bx = right;
	if (sl > s * 0.6) { ax = normalize(sv); bx = normalize(cross(ax, INV_VIEW_MATRIX[2].xyz)); }
	float lenk = max(1.0, sl / max(s, 1e-4));
	vec3 w = p + bx * VERTEX.x * s + ax * VERTEX.y * s * lenk;
	vlen = lenk;
	qv = VERTEX.xy * 2.0;
	vheight = p.y - ground_y;
	vec4 vw = VIEW_MATRIX * vec4(w, 1.0);
	vview_z = -vw.z;
	VERTEX = vw.xyz;
	NORMAL = vec3(0.0, 0.0, 1.0);
	vcol = mix(col0, col1, age_k);
	vcol.a = min(vcol.a * (1.0 + boost), 1.0);
	if (kind == 4) vcol.rgb *= 0.75 + 0.25 * sin(tt * 23.0 + c.r * 40.0);
	if (kind == 5 || kind == 3) vcol.a = col0.a * sin(3.14159 * age_k);         // wisps and twinkles fade in and out
	if (kind == 2) vcol.rgb = mix(col0.rgb, col1.rgb, smoothstep(0.0, 0.6, age_k));
}

void fragment() {
	float r = length(qv);
	float a;
	if (kind == 3) {                       // a four-point star
		vec2 q = abs(qv);
		a = max(1.0 - smoothstep(0.0, 0.12, q.y) - smoothstep(0.0, 1.0, q.x), 1.0 - smoothstep(0.0, 0.12, q.x) - smoothstep(0.0, 1.0, q.y));
		a = max(a, 1.0 - smoothstep(0.0, 0.35, r));
	} else if (kind == 1 || kind == 5) {   // a soft puff
		a = pow(max(1.0 - r, 0.0), 1.6);
	} else {                               // a droplet / spark / ember: a bright core, soft edge
		a = 1.0 - smoothstep(0.35, 1.0, r);
	}
	if (a <= 0.003) discard;
	vec3 col = vcol.rgb;
	if (kind == 1 || kind == 5) {
		// lit like a soft ball: brighter on the sun's side (the quad's own up/right stand in for a normal)
		vec3 nrm = normalize(vec3(qv * 0.8, 0.6));
		vec3 lv = normalize((VIEW_MATRIX * vec4(-light_dir, 0.0)).xyz);
		col *= 0.78 + 0.32 * max(dot(nrm, lv), 0.0);
	}
	if (kind == 3) col = mix(col, vec3(1.0, 0.95, 0.93), 1.0 - smoothstep(0.0, 0.3, r));         // a white-hot core in the crimson star
	if (kind == 0) col += vec3(0.3) * (1.0 - smoothstep(0.0, 0.4, length(qv - vec2(-0.25, 0.3))));   // a glint in the drop
	float fade = 1.0;
	if (soft > 0.0) fade = clamp(vheight / soft, 0.0, 1.0);
	if (near_fade > 0.0) fade *= clamp(vview_z / near_fade, 0.0, 1.0);
	ALBEDO = col;
	ALPHA = clamp(a * vcol.a * fade, 0.0, 1.0);
}
