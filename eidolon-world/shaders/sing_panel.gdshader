shader_type spatial;
// v0.6 "Her Song": a singing stone set into the Echo Corridor's north wall. A carved channel runs up it;
// a small carved notch marks the height of its note (A lowest ... F highest), so the song can be read as
// well as heard. Struck, light climbs the channel to the notch and rings out in rings; `flash` decays.
render_mode unshaded, blend_mix, depth_draw_never, shadows_disabled, cull_back, fog_disabled;
global uniform vec4 accent;
global uniform vec4 accent_core;
#include "res://shaders/glyphs.gdshaderinc"
uniform float pitch = 0.5;          // 0..1: the notch's height
uniform float flash = 0.0;          // 1 when struck
uniform float lit = 0.2;            // resting glow in the groove
uniform float sour = 0.0;           // a wrong note: the light shivers and dims
uniform float t = 0.0;
uniform vec2 size = vec2(1.0, 2.6);

void fragment() {
	vec2 p = vec2((UV.x - 0.5) * size.x, (1.0 - UV.y) * size.y);    // metres, y up from the floor line
	float top = 0.35 + pitch * 1.75;
	// the channel, the notch at the note's height, a ring at its foot
	float ch = g_seg(p, vec2(0.0, 0.25), vec2(0.0, top));
	float notch = g_seg(p, vec2(-0.16, top), vec2(0.16, top));
	float foot = abs(length(p - vec2(0.0, 0.16)) - 0.08);
	float d = min(min(ch, notch), foot);
	vec4 g = carved_glow(d, 0.022);
	// struck: light climbs the channel to the notch, then rings spread from it
	float climb = clamp(flash * 1.6 - 0.6 + 0.6, 0.0, 1.0);
	float fill = (1.0 - smoothstep(top * climb - 0.05, top * climb + 0.05, p.y)) * step(p.y, top + 0.05);
	float ring = 0.0;
	for (int i = 0; i < 3; i++) {
		float rr = (1.0 - flash) * 0.9 + float(i) * 0.12;
		ring += exp(-pow((length(p - vec2(0.0, top)) - rr) * 22.0, 2.0)) * flash;
	}
	float shiver = sour * (0.5 + 0.5 * sin(t * 47.0 + p.y * 30.0));
	float k = lit + flash * 0.9 * fill - shiver * 0.15;
	vec3 col = mix(accent.rgb, accent_core.rgb, g.x * (0.4 + 0.6 * flash));
	ALBEDO = col;
	ALPHA = clamp((g.x + g.y * 0.7) * clamp(k, 0.0, 1.0) * 1.4 + ring * 0.55, 0.0, 1.0);
}
