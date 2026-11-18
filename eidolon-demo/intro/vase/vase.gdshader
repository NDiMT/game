// The intro film, drawn by the game itself (the owner: the film inside Godot, not a video): the painted amphora of
// eidolon-world/dev/intro/amphora/tools/vase.py, turning, lit in flat facets, its scenes in their panels and its words
// on the black band, graded into the first level's dawn (intro_dawn.cube), with the first level's sky behind it.
// Every length here is the original's: screen pixels of the 1080x1920 film, texture pixels of its strips.
// Its pictures come in three texture arrays (strips, pans, texts) and two more textures: a phone's graphics give a
// picture-drawing shader 16 textures at most, Godot keeps three of them and the six highest for itself, and one
// texture to a piece (14) passed that: on a phone the film was not drawn at all.
shader_type canvas_item;
render_mode unshaded;

uniform vec2 rect_px = vec2(1080.0, 1920.0);   // the size of what this covers, in screen pixels
uniform float phi = -1.0;                     // how far the vase has turned, in places (72 degrees each)
uniform float fade = 1.0;                     // the film against the plum it opens on and closes into
uniform vec3 plum = vec3(0.1294, 0.0784, 0.1294);
uniform vec4 prof[16];                        // the vase's radius (in R0) at 64 heights over [-130, 2100]
uniform vec4 facj[15];                        // each facet's own shade
uniform float k0 = -2.0;                      // the first of the four places in view
uniform sampler2DArray strips : filter_linear_mipmap, repeat_disable;   // the five ornament bands
uniform vec4 strip_l = vec4(0.0);             // which band each of the four places in view wears
uniform sampler2DArray pans : filter_linear_mipmap, repeat_disable;     // each scene's first picture (layers 0-6) and last (7-13)
uniform vec4 pan_l = vec4(0.0);               // which picture each place shows
uniform sampler2D vid : filter_linear, repeat_disable;   // the scene in front, playing
uniform vec4 has_pan = vec4(0.0);             // which of the four places carry a scene
uniform float vid_slot = -1.0;                // which of them shows it playing
uniform sampler2DArray texts : filter_linear_mipmap, repeat_disable;    // each card's words, its pages one under another, three pages' room
uniform vec4 txt_l = vec4(0.0);               // which card each place carries
uniform vec4 txt_info[4];                     // per place: the page shown, its pages, the lines on that page, written at all
uniform vec4 ink_a[4];                        // the ink of the page's lines 1-4, and 5-8
uniform vec4 ink_b[4];
uniform sampler2D lut : filter_linear, repeat_disable;

const float R0 = 830.0;
const float TILT = 0.15707963;                // 9 degrees
const float SLOT = 72.0;
const float PXD = 17.741935;                  // texture pixels to a degree
const float KK = 1.2865497;                   // texture pixels to a screen pixel down the surface
const float H_TOP = -120.0;
const float SW = 1277.0;
const float TH = 2830.0;
const float FAC = 6.0;
const vec4 PAN = vec4(79.0, 579.0, 1118.0, 1112.0);
const float TXT0 = 1705.0;
const float BH = 635.0;
const float LH = 104.0;
const float NPG = 3.0;                        // (pages' room in each card's words)
const vec3 SUN = vec3(1.05, 1.0, 0.93);
const vec3 SHADE = vec3(0.66, 0.62, 0.80);
const vec3 LIFT = vec3(24.0, 17.0, 42.0) / 255.0;
const vec3 RIM = vec3(236.0, 228.0, 250.0) / 255.0;
const vec3 INK = vec3(252.0, 243.0, 222.0) / 255.0;

float prof_at(float h) {
	float f = clamp((h + 130.0) / 2230.0 * 63.0, 0.0, 63.0);
	int i = int(floor(f)); int j = min(i + 1, 63);
	float a = prof[i / 4][i % 4]; float b = prof[j / 4][j % 4];
	return mix(a, b, f - float(i));
}

vec3 sky(float v) {      // the first level's dawn, the start screen's five stops, top to bottom
	vec3 c0 = vec3(0.890, 0.824, 0.902); vec3 c1 = vec3(0.973, 0.890, 0.863); vec3 c2 = vec3(0.965, 0.851, 0.839);
	vec3 c3 = vec3(0.925, 0.827, 0.875); vec3 c4 = vec3(0.863, 0.784, 0.878);
	if (v < 0.3) return mix(c0, c1, clamp(v / 0.3, 0.0, 1.0));
	if (v < 0.55) return mix(c1, c2, (v - 0.3) / 0.25);
	if (v < 0.8) return mix(c2, c3, (v - 0.55) / 0.25);
	return mix(c3, c4, clamp((v - 0.8) / 0.2, 0.0, 1.0));
}

vec3 grade(vec3 c) {     // the dawn LUT: 33 slices of red (x) by green (y), one beside the other by blue
	c = clamp(c, 0.0, 1.0) * 32.0;
	float b0 = floor(c.b); float b1 = min(b0 + 1.0, 32.0);
	vec2 q = vec2(c.r + 0.5, c.g + 0.5);
	vec3 a = textureLod(lut, vec2((b0 * 33.0 + q.x) / 1089.0, q.y / 33.0), 0.0).rgb;
	vec3 b = textureLod(lut, vec2((b1 * 33.0 + q.x) / 1089.0, q.y / 33.0), 0.0).rgb;
	return mix(a, b, c.b - b0);
}

vec4 tex4(int j, int what, vec2 uv, float lod) {      // one of the four places' strip, picture or words
	if (what == 0) return textureLod(strips, vec3(uv, strip_l[j]), lod);
	if (what == 1) return textureLod(pans, vec3(uv, pan_l[j]), lod);
	return textureLod(texts, vec3(uv, txt_l[j]), lod);
}

void fragment() {
	float sc = 1080.0 / rect_px.x;
	float xs = UV.x * 1080.0;
	float ys = UV.y * rect_px.y * sc - (rect_px.y * sc - 1920.0) * 0.5;
	float x = xs - 540.0; float sy = ys;
	// where on the vase this pixel lies (as the film's own geometry: a surface of revolution, tilted 9 degrees)
	float h = sy / cos(TILT); float R; float s; float c;
	for (int it = 0; it < 5; it++) {
		R = prof_at(h) * R0; s = clamp(x / R, -1.0, 1.0); c = sqrt(1.0 - s * s);
		h = (sy + R * (c - 1.0) * sin(TILT)) / cos(TILT);
	}
	R = prof_at(h) * R0; s = clamp(x / R, -1.0, 1.0); c = sqrt(1.0 - s * s);
	float th = degrees(asin(s));
	float cov = clamp((R - abs(x)) * 0.9 / sc + 0.5, 0.0, 1.0);
	float rim = pow(clamp(1.0 - c * 2.6, 0.0, 1.0), 2.0) * 0.22;
	float u = th + phi * SLOT;
	float sl = floor((u + SLOT * 0.5) / SLOT);
	float ul = u - sl * SLOT;
	vec2 hp = vec2((ul + SLOT * 0.5) * PXD, (h - H_TOP) * KK);          // in the strip, texture pixels
	vec2 hpc = vec2((u + SLOT * 0.5) * PXD, hp.y);                       // the same, without the wrap from place to place
	vec2 dd = max(abs(dFdx(hpc)), abs(dFdy(hpc)));
	float lod = max(log2(sqrt(max(dd.x * dd.y, 1e-6))) - 0.35, 0.0);   // (the strips and the words hold the film's full size, a texel to a texture pixel; the mean of the two ways, a little sharp, so the leaning neck keeps its line)
	int j = int(sl - k0);
	vec3 col = vec3(0.094, 0.075, 0.078);
	if (j >= 0 && j <= 3) {
		col = tex4(j, 0, hp / vec2(SW, TH), lod).rgb;
		vec2 pu = (hp - PAN.xy) / PAN.zw;
		if (has_pan[j] > 0.5 && pu.x >= 0.0 && pu.x <= 1.0 && pu.y >= 0.0 && pu.y <= 1.0) {
			if (abs(vid_slot - float(j)) < 0.5) col = textureLod(vid, pu, 0.0).rgb;
			else col = tex4(j, 1, pu, max(lod - 0.714, 0.0)).rgb;      // (the pictures are their clips' size, 864 for the 1118 of their frame: log2 of that, and a little sharp, as before)
		}
		vec4 ti = txt_info[j];
		float yb = hp.y - TXT0;
		if (ti.w > 0.5 && yb >= 0.0 && yb < BH) {
			float a = tex4(j, 2, vec2(hp.x / SW, (ti.x * BH + yb) / (NPG * BH)), lod).r;
			float top = (BH - ti.z * LH) * 0.5 - 8.0;
			int l = int(clamp(floor((yb - top) / LH), 0.0, max(ti.z - 1.0, 0.0)));
			float ink = l < 4 ? ink_a[j][l] : ink_b[j][l - 4];
			col = mix(col, INK, a * ink);
		}
	}
	// the game's light: flat facets that turn with the vase, warm where the sun falls, lilac in the shade
	float fq = floor(u / FAC + 0.5);
	float thq = radians(clamp(fq * FAC - phi * SLOT, -88.0, 88.0));
	int fi = int(mod(fq, 60.0));
	float L = clamp(cos(thq) * 0.95 - sin(thq) * 0.34 + 0.08 + facj[fi / 4][fi % 4], 0.0, 1.0);
	col = col + (1.0 - col) * (1.0 - col) * LIFT;
	col = col * (L * SUN + (1.0 - L) * SHADE) + RIM * rim;
	col = grade(col);
	vec3 o = mix(sky(ys / 1920.0), col, cov);
	COLOR = vec4(mix(plum, o, fade), 1.0);
}
