extends "res://main.gd"
## EIDOLON, chapter 1, "The Veiled Gate": one house that climbs from the sea, and one dry watercourse through it.
## He hid every mirror; water is a mirror too, so he drove it out of the house. She brings it back.
## The engine (materials, the heroine, walking by taps, the look of water) is main.gd; this script is the world of
## the chapter and what can be done in it. See eidolon-world/dev/CH1_FLOW_V4.md for the design.
##
## How a court is laid out here. The eye looks from the south-east and from above, so what stands over a water is
## seen in it shifted toward the south-east by about its own height: a water lies to the SOUTH and EAST of the things
## it is meant to show, and she and what she uses stand at its north and west rims.

# ---------------------------------------------------------------- the harbour (I.1)
const HX0 := -5.0
const HZ0 := 0.0
const HX1 := 5.0
const HZ1 := 11.0
const BX0 := -3.6      # its basin: the sea, held still inside the mole
const BZ0 := 3.0
const BX1 := 3.6
const BZ1 := 9.6
const MOLE_W := 0.5      # half the width of the mole, which runs south from the quay along x = 0
const MOLE_A := 5.0      # the stub ends here...
const MOLE_B := 6.8      # ...and the piece that is left in the open begins here
const MOLE_C := 8.4      # and ends here
const HERPL := Vector3(0, 0, 3.75)      # the plinth she wakes on, on the stub, facing the sea
const WHEEL1 := Vector3(0, 0, 7.75)      # the wheel of the first sluice, on the far piece
const WINCH_YAW := -PI * 0.5      # the wheel faces north, toward whoever comes along the mole

# ---------------------------------------------------------------- the long basin (I.3), the well (I.4), the fountain (I.5), the forecourt (I.6)
const TX0 := -3.4
const TZ0 := -16.0
const TX1 := 2.6
const TZ1 := -7.0
const TPX0 := -1.5      # its water: rain, which he could not forbid
const TPZ0 := -15.0
const TPX1 := 1.2
const TPZ1 := -8.2
const TWX0 := -2.75     # the walk along its west side, where the channel runs
const TWX1 := -1.85
const TG_REAL := -13.2      # the grille that stands across the walk above...
const TG_WATER := -10.6     # ...and the one that stands across it only in the water
const WHEEL2 := Vector3(-2.72, 0, -15.0)
const VX0 := -6.2       # the court of the well
const VZ0 := -24.2
const VX1 := 0.6
const VZ1 := -17.5
const WELL := Vector3(-2.6, 0, -20.6)
const WELL_H := 0.56      # half the side of the square of water inside its round kerb
const WELL_R := 0.9       # the kerb's outer radius
const BUCKET := Vector3(-0.42, 0, -0.2)      # where the bucket hangs, from the well's middle
const POST3 := Vector3(-5.3, 0, -19.95)
const FX0 := -14.6      # the court of the fountain
const FZ0 := -25.0
const FX1 := -7.4
const FZ1 := -17.6
const FPX0 := -12.9
const FPZ0 := -24.6
const FPX1 := -8.5
const FPZ1 := -21.2
const ARCH_X := -11.0
const ARCH_W := 0.55      # half its width
const ARCH_Y := 1.55      # where it springs
const FWALL_H := 2.6
const GX0 := -16.0      # the forecourt of the atrium
const GZ0 := -37.0
const GX1 := -5.2
const GZ1 := -26.6
const GPX0 := -13.0
const GPZ0 := -34.2
const GPX1 := -6.8
const GPZ1 := -28.6
const ROW_Z := -34.9      # the row of statues along the pool's north rim, and the one along its west rim
const ROW_X := [-12.6, -11.5, -10.4, -9.3]
const HERS := 2           # which place of that row is empty
const ROWW_X := -13.7
const ROWW_Z := [-33.3, -32.1, -30.9]
const DOOR6 := Vector3(-15.85, 0, -32.0)
# ---------------------------------------------------------------- the atrium (I.7)
const UX0 := -34.0
const UZ0 := -43.0
const UX1 := -16.0
const UZ1 := -24.0
const UC := Vector3(-25.0, 0, -32.6)      # (the line the west door and its channel lie on)
const GATE_X := -28.0                     # the middle of the Gate, in the north wall
const UB := Vector3(-25.0, 0, -36.9)      # the middle of the great basin: it lies at the Gate's feet, south-east of it, where a water must lie to show it
const UBR := 3.9                          # its radius
const UBH := 4.0                          # half the side of the square opening it sits in
const POD_H := 1.2                        # the landing before the Gate
const LAND_X0 := GATE_X - 2.8
const LAND_X1 := GATE_X + 2.2
const LAND_Z := -41.0                     # its front edge, which stands at the basin's rim
const STAIR_X := LAND_X1 + 2.1            # the foot of its stair, which comes down eastward along the wall
const CLEFT_X0 := -27.1                   # in the water the landing is broken through here
const CLEFT_X1 := -26.4
const BREACH_X0 := -30.7                  # and the wall beside the Gate is breached here
const BREACH_X1 := -30.12
const TURN3 := Vector3(-26.75, 0, -40.68) # the statue that holds a stone, at the landing's foot
const ROW3_X := -29.55                    # the row of her along the basin's west rim
const ROW3_Z := [-39.4, -38.2, -37.0, -35.8]
const HERS3 := 2                          # which of its places is empty
const UC_STONE := "d8ccb9"                # the plain colours of the atrium's things as the basin's water shows them
const UC_TOP := "e9dfcc"
const UC_SHADE := "b9ab98"
const UC_GOLD := "d2aa58"
const UC_DARK := "7a708a"
const UC_ROPE := "b9a888"
const UC_CRIM := "cf5a40"

var N := {}      # the pieces that move, by name (kept here so that the joined world leaves them alone)
var WL: Array = []      # the still waters, in order: their names
var W := {}      # each water: {"r": [x0, z0, x1, z1], "heads": [rects of floor from which her reflection can be sent], "foot": {name: {x0, z0, x1, z1, on, h}}}
var refl_w := ""      # the water her reflection is out on
var refl_key := "mir"      # which of her mirrored bodies it is (a water whose surface is not at the floor's height has one of its own: W[id].mir)
var ramps: Array = []      # floor that is not level: {"r": its rect, "z0", "z1": between these it goes from height "y0" to "y1"}
var on_ramp := false
var refl_busy := 0      # how many orders to her reflection are still being carried out
var refl_img := false   # the place it is being sent to was named by a tap on the water (on the image of the place)
var woke := false
var flags := {}
var wing_open := {"W": false, "N": false, "S": false}      # which wings are built: a script that extends this one and builds a wing sets its own to true in _init (after super._init())
var wings_done: Array = []      # the wings whose water has been set free, in the order it was done
var cs_mirs: Array = []      # the mirrored bodies of her that belong to waters below the floor's height, to be made once she exists: [key, root]
var cs_courts: Array = []    # the courts with such waters: in them her ordinary mirrored body is put away

func _init() -> void:
	old_world = false
	title_sub = "I  ·  The Veiled Gate\ntap to begin"; end_sub = "end of the first chapter\ntap to begin again"
	if flip_demo: title_sub = "the turning water  ·  a trial\ntap to begin"; end_sub = "end of the trial\ntap to begin again"
	if match_demo: title_sub = "the still water  ·  a trial\ntap to begin"
	if figure_demo: title_sub = "the face in the water  ·  a trial\ntap to begin"
	if geo_demo: title_sub = "what is looked at, stays\ntap to begin"
	if go_demo: title_sub = "two worlds  ·  a trial\ntap to begin"; sea_c = Color("2b6880"); mist_c = Color("7f8fb4"); bg_c = Color("1c4a5e"); shadow_c = Vector3(0.5, 0.52, 0.8)
	if go_iv: title_sub = "the fallen faces  ·  a trial\ntap to begin"; sea_c = Color("dcbd9c"); mist_c = Color("f1d6b1"); bg_c = Color("f1d6b1"); shadow_c = Vector3(0.84, 0.74, 0.68)
	if go_drown: title_sub = "the drowned sanctuary  ·  a trial\ntap to begin"; sea_c = Color("5f8199"); mist_c = Color("7f9cb2"); bg_c = Color("9a9fc2"); shadow_c = Vector3(0.72, 0.77, 0.88)
	if go_moon: title_sub = "the moon dial  ·  a trial\ntap to begin"; sea_c = Color("8aabd3"); mist_c = Color("8eafd8"); bg_c = Color("4f6c9e"); shadow_c = Vector3(0.6, 0.67, 0.84)
	if go_wake: title_sub = "1  ·  The Waking\ntap to begin"; sea_c = Color("d9b5b6"); mist_c = Color("e8bdb1"); bg_c = Color("efd3c8"); shadow_c = Vector3(0.82, 0.74, 0.84)
	if go_quarry: title_sub = "the quarry  ·  a trial\ntap to begin"; sea_c = Color("d9cbb6"); mist_c = Color("eadfcd"); bg_c = Color("efe3cf"); shadow_c = Vector3(0.78, 0.75, 0.82)
	if geo_demo: sea_c = Color("2b6880"); mist_c = Color("7f8fb4"); bg_c = Color("1c4a5e"); shadow_c = Vector3(0.5, 0.52, 0.8)      # (this trial: the same sea toward evening)

func _hollows() -> Array:
	return [[HX0 + 0.5, HZ0 + 0.5, HX1 - 0.5, HZ1 - 0.5], [TX0 + 0.5, TZ0 + 0.5, TX1 - 0.5, TZ1 - 0.5], [VX0 + 0.5, VZ0 + 0.5, VX1 - 0.5, VZ1 - 0.5],
		[FX0 + 0.5, FZ0 - 0.1, FX1 - 0.5, FZ1 - 0.5], [GX0 + 0.5, GZ0 + 0.5, GX1 - 0.5, GZ1 - 0.5], [UX0 + 0.5, UZ0 + 0.5, UX1 - 0.5, UZ1 - 0.5]] + ([[MT_X0 + 0.3, MT_Z0 + 0.5, MT_X1 - 0.3, MT_Z1 - 0.5]] if match_demo else []) + (_fig_hollows() if figure_demo else []) + ([[107.15, -2.85, 112.85, 2.85]] if geo_demo else [])

# ---------------------------------------------------------------- small builders
func R(x0: float, z0: float, x1: float, z1: float, on := true, h := 0.0) -> Dictionary:
	return {"x0": x0, "z0": z0, "x1": x1, "z1": z1, "on": on, "h": h}

## a plain colour for a thing that lies under a water (the haze of the water pales everything else that is there)
func under_mat(c: Color) -> StandardMaterial3D:
	var k := "under|" + c.to_html(false)
	if not N.has(k):
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c; m.cull_mode = BaseMaterial3D.CULL_DISABLED; N[k] = m
	return N[k]

## ---- the turn-over (a trial, in one court; FLIP=1). A tap on a pool turns the whole picture over: a ring spreads
## from the finger, and behind it the world is what the water showed (soft, rippling, upside down), while the water
## shows its picture plainly and upright. A second tap on the water turns it back.
## The world is made soft by one sheet drawn over the whole view before every water (so the waters, drawn after it,
## stay clear, and whatever stands in front of a water is still soft); the turning over is done on the finished picture.
const SH_WORLDWAVE := """shader_type spatial;
render_mode unshaded, depth_test_disabled, depth_draw_never, cull_disabled;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear, repeat_disable;
uniform float k = 0.0; uniform float veil = 0.0; uniform float time_s = 0.0;      // k: how much it ripples and blurs; veil: the pale of the water over it
void vertex(){ POSITION = vec4(VERTEX.xy, 1.0, 1.0); }
void fragment(){
	vec2 px = 1.0 / VIEWPORT_SIZE;
	vec4 v = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, 0.0, 1.0);
	vec3 w0 = (INV_VIEW_MATRIX * vec4(v.xyz / v.w, 1.0)).xyz; vec3 dir = -normalize(INV_VIEW_MATRIX[2].xyz);
	vec3 g = w0 + dir * (-w0.y / dir.y);      // the place on the ground under this pixel: the ripples lie on the world, not on the screen
	vec2 rip = vec2(sin(g.z * 3.1 + time_s * 1.1) + 0.6 * sin(g.x * 5.3 - time_s * 0.8), sin(g.x * 2.7 + time_s * 0.9) + 0.6 * sin(g.z * 6.1 + time_s * 1.3)) * px * 4.5 * k;
	vec2 uv = SCREEN_UV + rip;
	vec3 c = texture(screen_tex, uv).rgb * 0.2;
	for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854; c += texture(screen_tex, uv + vec2(cos(a), sin(a)) * px * 2.2 * k * (1.0 + 0.5 * float(i % 2))).rgb * 0.1; }
	ALBEDO = mix(c, vec3(0.6, 0.85, 0.88), 0.2 * veil);
}"""
const SH_TURN := """shader_type canvas_item;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear, repeat_disable;
uniform vec2 c = vec2(0.5); uniform float r = 0.0; uniform float aspect = 0.5625;
uniform float from_s = 0.0; uniform float to_s = 0.0; uniform float turn = 1.0;
uniform sampler2D her_mask : filter_linear, repeat_disable;      // where her own body is in the picture (mode 3)
uniform float th = 1.0;      // mode 3: +1 the eye looks down on the world as always, 0 it looks along the waterline, -1 it looks from under it
uniform float line = 0.5;      // mode 3: where the waterline under her feet lies in the picture
uniform vec3 dark = vec3(0.4, 0.48, 0.62);
// the picture at q as the world is seen (m = 0: warm, clear) or as what the water shows is seen (m = 1: cool, softer, a
// little less colour). Both a little softened, and neither lighter nor darker than the picture was.
vec3 take(vec2 q, vec2 ps, float m){
	vec2 px = ps * 1.8;
	vec3 k3 = texture(screen_tex, q).rgb;
	vec3 s3 = (k3 * 2.0 + texture(screen_tex, q + vec2(px.x, 0.0)).rgb + texture(screen_tex, q - vec2(px.x, 0.0)).rgb + texture(screen_tex, q + vec2(0.0, px.y)).rgb + texture(screen_tex, q - vec2(0.0, px.y)).rgb) / 6.0;
	k3 = mix(k3, s3, mix(0.4, 0.72, m));
	float l3 = dot(k3, vec3(0.3, 0.59, 0.11));
	vec3 g3 = mix(mix(vec3(l3), k3, 1.08) * vec3(1.05, 1.0, 0.93), mix(vec3(l3), k3, 0.76) * vec3(0.92, 1.02, 1.1), m);
	return g3 * (l3 / max(dot(g3, vec3(0.3, 0.59, 0.11)), 0.001));
}
uniform int mode = 0;      // 3: the eye itself goes down to the waterline and under it (see _flip_real). 0: a ring spreads from the finger. 1: the whole picture tips over through the sea. 2: the eye goes down, past the waterline, into what the water shows
const vec3 SEA = vec3(0.325, 0.565, 0.635);
void fragment(){
	float pp = clamp(r / 1.35, 0.0, 1.0); float st = mix(from_s, to_s, pp);      // 0: as it is; 1: turned over
	if (mode == 3) {
		// What is drawn is always the world from above. From under the water it is the same picture turned over, and at
		// the waterline the two are one picture: the world above the line, what the water shows of it below.
		float w = smoothstep(0.5, 0.0, abs(th));      // how much the water mirrors: all of it when the eye is level with it
		vec2 uv = SCREEN_UV;
		float d = abs(uv.y - line); float dp = min(d * 5.0, 1.0);
		vec2 rip = vec2(sin(d * 80.0 + TIME * 2.6) * 0.006, sin(d * 120.0 - TIME * 3.4 + uv.x * 5.0) * 0.004) * dp;
		vec3 col;
		if (th >= 0.0) {
			col = take(uv, SCREEN_PIXEL_SIZE, 0.0);
			if (uv.y > line && w > 0.0) {
				vec2 q = clamp(vec2(uv.x, 2.0 * line - uv.y) + rip, vec2(0.0), vec2(1.0));
				vec3 b = take(q, SCREEN_PIXEL_SIZE, 1.0) * mix(vec3(1.0), dark, texture(her_mask, q).a);      // below the line she is her shadow
				col = mix(col, mix(b, vec3(0.6, 0.85, 0.88), 0.16), w);
			}
		} else {
			col = take(vec2(uv.x, 1.0 - uv.y), SCREEN_PIXEL_SIZE, 1.0);
			if (uv.y < line && w > 0.0) {
				vec2 q = clamp(vec2(uv.x, uv.y + 1.0 - 2.0 * line) + rip, vec2(0.0), vec2(1.0));
				vec3 a = take(q, SCREEN_PIXEL_SIZE, 0.0) / mix(vec3(1.0), dark, texture(her_mask, q).a);      // above the line she is herself
				col = mix(col, mix(a, vec3(0.6, 0.85, 0.88), 0.16), w);
			}
		}
		// the edges of the picture fall away a little: warm in the world, cooler and deeper in what the water shows
		float vr = length((SCREEN_UV - 0.5) * vec2(1.25, 1.0)) / 0.72;
		float vg = smoothstep(0.55, 1.2, vr);      // (soft: it begins far out and never goes deep)
		float vm = th >= 0.0 ? 0.0 : 1.0;
		col *= mix(vec3(1.0), mix(vec3(0.88, 0.85, 0.84), vec3(0.78, 0.84, 0.91), vm), vg);
		COLOR = vec4(col, 1.0);
	} else if (mode == 1) {
		float ang = 3.14159265 * st; float D = 2.6;
		vec2 q = SCREEN_UV - 0.5;
		float den = D * cos(ang) - q.y * sin(ang);
		float Y = q.y * D / (abs(den) < 0.0001 ? 0.0001 : den);
		float X = q.x * (D + Y * sin(ang)) / D;
		float inside = smoothstep(0.5, 0.494, abs(X)) * smoothstep(0.5, 0.494, abs(Y)) * step(0.0, D + Y * sin(ang));
		float w = sin(3.14159265 * st);
		vec2 a = clamp(vec2(X, Y) + 0.5, vec2(0.0), vec2(1.0));
		vec3 sea = SEA + 0.03 * sin(SCREEN_UV.y * 42.0 + TIME * 1.6 + sin(SCREEN_UV.x * 9.0) * 1.5) * w;
		COLOR = vec4(mix(sea, texture(screen_tex, a).rgb, inside), 1.0);
	} else if (mode == 2) {
		float y = SCREEN_UV.y + st; vec2 a = vec2(SCREEN_UV.x, y);
		float w = sin(3.14159265 * st); float under = max(y - 1.0, 0.0);
		if (y > 1.0) {
			a.y = 2.0 - y;
			float dp = min(under * 3.0, 1.0);      // the water bends what it shows, more the farther from the line
			a.x += sin(under * 70.0 + TIME * 3.0) * 0.007 * w * dp;
			a.y += sin(under * 110.0 - TIME * 4.2 + SCREEN_UV.x * 5.0) * 0.009 * w * dp;
		}
		vec3 col = texture(screen_tex, clamp(a, vec2(0.0), vec2(1.0))).rgb;
		col = mix(col, vec3(0.6, 0.85, 0.88), 0.14 * w * step(1.0, y));
		float wl = exp(-(y - 1.0) * (y - 1.0) / 0.000012) * w;
		COLOR = vec4(col + wl * 0.06, 1.0);
	} else {
	vec2 d = (SCREEN_UV - c) * vec2(aspect, 1.0); float dist = length(d); float edge = dist - r;
	float lip = exp(-(edge * edge) / 0.0011) * smoothstep(0.0, 0.08, r);      // the ring itself: it bends what it passes over, and carries a little light
	vec2 n = dist > 0.0001 ? d / dist : vec2(0.0);
	vec2 a = SCREEN_UV - n * lip * 0.022 * vec2(1.0 / aspect, 1.0);
	float s = mix(from_s, to_s, smoothstep(0.006, -0.006, edge)) * turn;
	vec3 col = mix(texture(screen_tex, a).rgb, texture(screen_tex, vec2(a.x, 1.0 - a.y)).rgb, s);
	COLOR = vec4(col + lip * 0.10, 1.0);
	}
}"""
var flip_test := OS.get_environment("FLIP") == "1"      # every water turns the picture
var go_demo := OS.has_feature("godemo") or OS.get_environment("FLIP") == "go" or OS.get_environment("FLIP") == "goiv" or OS.has_feature("goiv") or OS.get_environment("FLIP") == "gosea" or OS.has_feature("gosea") or OS.get_environment("FLIP") == "gomoon" or OS.has_feature("gomoon") or OS.get_environment("FLIP") == "goquarry" or OS.has_feature("goquarry") or OS.get_environment("FLIP") == "gowake" or OS.has_feature("gowake")      # the trial played a step at a time (Eidolon GO)
var geo_demo := OS.has_feature("geodemo") or OS.get_environment("FLIP") == "geo"      # the trial of the hall of images: ways that join where their pictures join
var figure_demo := OS.has_feature("figuredemo") or OS.get_environment("FLIP") == "figure"      # the trial of the face in the water: three courts where a picture is made whole in the water
var match_demo := OS.has_feature("matchdemo") or OS.get_environment("FLIP") == "match"      # the trial of the still water: one new court, where the world and what its water shows are to be made to agree
var flip_demo := OS.has_feature("flipdemo") or OS.get_environment("FLIP") == "demo" or match_demo or figure_demo or geo_demo or go_demo      # the trial as a thing to play: the first two waters turn the picture, and it ends behind the second sluice
var FLIP_DEMO_WATERS := ["M"] if match_demo else ([] if (figure_demo or geo_demo or go_demo) else ["H", "T"])
var flip_wid := ""      # the water the picture was turned over at
var flip_anchor := Vector3.ZERO      # where she stands, while her shadow is played
var flip_anchor_yaw := 0.0
var flip_turn := OS.get_environment("FLIP_TURN") != "0"      # (FLIP_TURN=0: the looks change places but the picture is not turned upside down)
var flip_on := false
var flip_busy := false
var flip_r := 0.0      # how far the ring has spread
var flip_fx := OS.get_environment("FLIP_FX")      # "": the eye goes down to the waterline and under it. "ring", "turn", "dive": the three earlier ways (of the flat picture), kept to compare
var flip_th := 1.0      # +1: the eye looks down on the world; 0: along the waterline; -1: from under it
var flip_side := 1.0      # which side of the waterline the picture is drawn for just now
var flip_moving := false
var flip_icon: Control      # the sign that turns the world over: it shows only where she stands by a water that can be turned (and, turned, always)
var flip_icon_a := 0.0
var flip_icon_wid := ""
var flip_mask_vp: SubViewport
var FLIP_LEASH := 99.0 if match_demo else 5.5      # how far from her the shadow may go: farther, and it is with her again (in the court of the still water it has the run of the place)
var flip_homing := false
var smoke := []      # the puffs of the shadow when it goes back to her: {n, a, b, t0, life, ph, lift}
var smoke_t := -1.0
var smoke_dur := 1.0
var flip_mask_cam: Camera3D
const FLIP_PITCH := 35.264
var flip_k := 0.0      # how much the turned picture ripples and blurs just now
const FLIP_CALM := 0.3      # what it settles to once it has turned: the turned picture must be easy to read and to play in
var flip_wave: ShaderMaterial
var flip_mat: ShaderMaterial
var flip_mi: MeshInstance3D
var flip_rect: ColorRect
var flip_glass := []      # every pool's surface, with the softness it had
var flip_mir := []      # the materials of her image in the waters
const FLIP_DARK := Vector3(0.4, 0.48, 0.62)      # the dark of her image in a water (as spawn_her gives it)
func _flip_setup() -> void:
	var sh := Shader.new(); sh.code = SH_WORLDWAVE
	flip_wave = ShaderMaterial.new(); flip_wave.shader = sh; flip_wave.render_priority = -8; timed.append(flip_wave)
	var q := QuadMesh.new(); q.size = Vector2(2, 2)
	flip_mi = MeshInstance3D.new(); flip_mi.mesh = q; flip_mi.material_override = flip_wave; flip_mi.extra_cull_margin = 16000.0
	flip_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; flip_mi.visible = false; add_child(flip_mi)
	var cl := CanvasLayer.new(); cl.layer = 0; add_child(cl)
	flip_rect = ColorRect.new(); flip_rect.set_anchors_preset(Control.PRESET_FULL_RECT); flip_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var cs := Shader.new(); cs.code = SH_TURN
	flip_mat = ShaderMaterial.new(); flip_mat.shader = cs; flip_mat.set_shader_parameter("turn", 1.0 if flip_turn else 0.0)
	flip_mat.set_shader_parameter("mode", {"ring": 0, "turn": 1, "dive": 2}.get(flip_fx, 3))
	# a small picture of her body alone, from the same eye: by it the turn knows which of the picture is she
	flip_mask_vp = SubViewport.new(); flip_mask_vp.transparent_bg = true; flip_mask_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	flip_mask_vp.size = Vector2i(get_viewport().get_visible_rect().size * 0.5); add_child(flip_mask_vp)
	flip_mask_cam = Camera3D.new(); flip_mask_cam.projection = Camera3D.PROJECTION_ORTHOGONAL; flip_mask_cam.keep_aspect = cam.keep_aspect
	flip_mask_cam.cull_mask = 1 << 19; flip_mask_vp.add_child(flip_mask_cam); flip_mask_cam.current = true
	for mm0 in (H["main"].holder as Node).find_children("*", "MeshInstance3D", true, false): (mm0 as MeshInstance3D).set_layer_mask_value(20, true)
	flip_mat.set_shader_parameter("her_mask", flip_mask_vp.get_texture()); flip_mat.set_shader_parameter("dark", FLIP_DARK)
	_flip_icon_setup(); _smoke_setup()
	flip_rect.material = flip_mat; flip_rect.visible = _flip_pane_always(); cl.add_child(flip_rect)
	for m in timed:
		if m is ShaderMaterial and (m as ShaderMaterial).shader == shaders["glass"]: flip_glass.append([m, float((m as ShaderMaterial).get_shader_parameter("blur_px"))])
	for k in H:      # her image in the waters: every body that was made as a mirror of her
		if not (H[k] is Dictionary) or not H[k].has("holder"): continue
		for mm in (H[k].holder as Node).find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			for si in mi.get_surface_override_material_count():
				var sm := mi.get_surface_override_material(si) as ShaderMaterial
				if sm != null and sm.get_shader_parameter("tint") is Vector3 and (sm.get_shader_parameter("tint") as Vector3).distance_to(FLIP_DARK) < 0.01 and not flip_mir.has(sm): flip_mir.append(sm)
	print("FLIP her materials ", her_mats.size(), ", her image's ", flip_mir.size())

## the picture turns over (or back), from where the finger fell on the water.
## Turned over, the player is her shadow: she herself stays where she stood (the water shows her there, as she is), and
## the dark body is the shadow. It walks on what the water of this place gives it to stand on (`W[wid].foot`: here the
## mole is whole, the world's grille is not there and the water's is), and what it does there is done. Turned back, she
## is herself again, where she stood.
func _flip(sp: Vector2, wu: Array) -> void:
	var to := 0.0 if flip_on else 1.0
	if to > 0.5:
		var wid: String = WL[wu[0]]
		if (W[wid].foot as Dictionary).is_empty(): await _her_no(); return      # this water gives a shadow nothing to stand on
		flip_busy = true
		hold_id = -1; route.clear(); pending = ""
		if _foot_of(wid, pos, 0.25) == "":      # she goes to the water's edge first: her shadow begins under her feet
			var hp := _head_point(wid)
			if not walk_to(hp, PLAY_WALK): flip_busy = false; await _her_no(); return
			while not route.is_empty(): await get_tree().process_frame
			if _foot_of(wid, pos, 0.4) == "": flip_busy = false; return
		flip_wid = wid; flip_anchor = pos; flip_anchor_yaw = yaw
		if refl_out.is_empty(): _refl_out_now(wid)      # her image stays where she stands: it is she, now
		var hm0 := _hermod(refl_out)      # and she stands as she stood: what her shadow does with its hands, she does not do
		if hm0 != null: hm0.own = true; hm0.wL = 0.0; hm0.wR = 0.0; hm0.bow = 0.0
		if refl_out.ap != null: (refl_out.ap as AnimationPlayer).play("idle", 0.4)
	else:
		flip_busy = true
		hold_id = -1; route.clear(); pending = ""
		# the shadow goes back into her: it sinks where it is, and she is where she stood
		if flip_fx == "":      # it is with her again by the time the eye is level with the water: it goes as smoke, while the eye comes down
			if _flat(pos, flip_anchor) > 0.05: _shadow_home()
			else: pos = flip_anchor; yaw = flip_anchor_yaw
		else:
			var sk := create_tween(); sk.tween_property(self, "sink_main", 1.95, 0.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
			await sk.finished
			pos = flip_anchor; yaw = flip_anchor_yaw; cam_t = pos
	if flip_fx == "": await _flip_real(to > 0.5); return
	flip_r = 0.0
	var vs := get_viewport().get_visible_rect().size
	# she is brought to the middle line of the view: the picture turns over about that line, so she keeps her place
	var up0 := create_tween(); up0.tween_property(self, "cam_up_k", 0.0, 0.45).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await up0.finished
	var on_screen: Vector2 = cam.unproject_position(wu[1]) if wu.size() > 1 else cam.unproject_position(pos + Vector3(0, 0.9, 0))
	if flip_on and flip_turn: on_screen.y = vs.y - on_screen.y
	flip_mi.visible = true; flip_rect.visible = true
	flip_mat.set_shader_parameter("c", Vector2(on_screen.x / vs.x, on_screen.y / vs.y)); flip_mat.set_shader_parameter("aspect", vs.x / vs.y)
	flip_mat.set_shader_parameter("from_s", 1.0 - to); flip_mat.set_shader_parameter("to_s", to); flip_mat.set_shader_parameter("r", 0.0)
	var T := 1.9
	_flip_world(flip_wid, to > 0.5, T * 0.8)
	var tw3 := create_tween().set_parallel(true)
	tw3.tween_method(func(v: float) -> void: flip_r = v; flip_mat.set_shader_parameter("r", v), 0.0, 1.35, T).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw3.tween_method(func(v: float) -> void: flip_k = v; flip_wave.set_shader_parameter("k", v), flip_k, to, T * 0.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw3.tween_method(func(v: float) -> void: flip_wave.set_shader_parameter("veil", v), 1.0 - to, to, T * 0.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	for g in flip_glass:
		var gm: ShaderMaterial = g[0]; var b0: float = g[1]
		tw3.tween_method(func(v: float) -> void: gm.set_shader_parameter("clear", v); gm.set_shader_parameter("wave", 1.0 - v); gm.set_shader_parameter("blur_px", b0 * (1.0 - v)), 1.0 - to, to, T * 0.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	# the body the player moves is the dark one in the turned picture, and the water shows her as she is
	tw3.tween_method(func(v: float) -> void:
		for hm in her_mats: (hm as ShaderMaterial).set_shader_parameter("tint", Vector3.ONE.lerp(FLIP_DARK, v))
		for mm2 in flip_mir: (mm2 as ShaderMaterial).set_shader_parameter("tint", FLIP_DARK.lerp(Vector3.ONE, v)), 1.0 - to, to, T * 0.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if to < 0.5: tw3.tween_property(self, "sink_main", 0.0, 0.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	await tw3.finished
	flip_on = to > 0.5
	flip_mat.set_shader_parameter("from_s", to); flip_mat.set_shader_parameter("r", 0.0)
	if not flip_on:
		flip_mi.visible = false; flip_rect.visible = false
		if not refl_out.is_empty():      # her image is under her feet again, and does as she does
			var hm1 := _hermod(refl_out)
			if hm1 != null: hm1.own = false
			H[refl_key] = refl_out; refl_out = {}; refl_w = ""
	if flip_on: create_tween().tween_method(func(v: float) -> void: flip_k = v; flip_wave.set_shader_parameter("k", v), flip_k, FLIP_CALM, 1.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)      # it settles: only a slow breath of the ripple is left
	# and she is given her usual place in the view again (in the turned picture that is the other side of the middle line)
	create_tween().tween_property(self, "cam_up_k", -1.0 if flip_on else 1.0, 0.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	flip_busy = false
	if flip_demo and flip_on and not flags.get("flip_said", false) and not done.has("wheel1"): flags["flip_said"] = true; say("you are her shadow  ·  what you turn here, turns in the water" if match_demo else "you are her shadow  ·  here the mole is whole")
	print("FLIP ", "over" if flip_on else "back")

const SH_SMOKE := """shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix;
uniform vec3 col = vec3(0.19, 0.18, 0.26);
void fragment(){ float d = distance(UV, vec2(0.5)) * 2.0; ALBEDO = col; ALPHA = smoothstep(1.0, 0.0, d) * 0.46; }"""
func _smoke_setup() -> void:
	var sh := Shader.new(); sh.code = SH_SMOKE
	var m := ShaderMaterial.new(); m.shader = sh; m.render_priority = 4
	var q := QuadMesh.new(); q.size = Vector2(1, 1)
	for i in 40:
		var n := MeshInstance3D.new(); n.mesh = q; n.material_override = m; n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; n.visible = false; add_child(n)
		smoke.append({"n": n})

## the shadow as smoke: it leaves the body where that stands and gathers again at `to`
func _smoke_go(from: Vector3, to: Vector3, dur: float) -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = 7
	for s in smoke:
		s["a"] = from + Vector3(rng.randf_range(-0.16, 0.16), rng.randf_range(0.15, 1.55), rng.randf_range(-0.16, 0.16))
		s["b"] = to + Vector3(rng.randf_range(-0.14, 0.14), rng.randf_range(0.15, 1.55), rng.randf_range(-0.14, 0.14))
		s["t0"] = rng.randf_range(0.0, 0.42) * dur; s["life"] = rng.randf_range(0.48, 0.58) * dur
		s["ph"] = rng.randf_range(0.0, TAU); s["lift"] = rng.randf_range(0.15, 0.5); s["sz"] = rng.randf_range(0.7, 1.15)
	smoke_t = 0.0; smoke_dur = dur

func _smoke_frame(dt: float) -> void:
	if smoke_t < 0.0: return
	smoke_t += dt
	var cb := cam.global_transform.basis
	for s in smoke:
		var n: MeshInstance3D = s.n
		var u := (smoke_t - float(s.t0)) / float(s.life)
		if u <= 0.0 or u >= 1.0: n.visible = false; continue
		var a: Vector3 = s.a; var b: Vector3 = s.b
		var side := Vector3(-(b - a).z, 0, (b - a).x).normalized() if _flat(a, b) > 0.01 else Vector3.RIGHT
		var e := smoothstep(0.0, 1.0, u)
		var grow := smoothstep(0.0, 0.16, u) * smoothstep(1.0, 0.8, u)
		n.visible = true
		n.global_transform = Transform3D(cb.scaled(Vector3.ONE * float(s.sz) * (0.55 + 0.45 * sin(PI * u)) * grow), a.lerp(b, e) + Vector3.UP * sin(PI * u) * float(s.lift) + side * sin(TAU * u + float(s.ph)) * 0.13)
	if smoke_t > smoke_dur + 0.05:
		smoke_t = -1.0
		for s in smoke: (s.n as Node3D).visible = false

## the shadow is with her again: it goes as smoke from where it is to under her feet
func _shadow_home() -> void:
	if flip_homing: return
	flip_homing = true
	route.clear(); pending = ""
	_smoke_go(pos, flip_anchor, 1.0)
	var sk := create_tween(); sk.tween_property(self, "sink_main", 1.95, 0.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await sk.finished
	pos = flip_anchor; yaw = flip_anchor_yaw
	await wait(0.12)
	var ru := create_tween(); ru.tween_property(self, "sink_main", 0.0, 0.45).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await ru.finished
	flip_homing = false

## The sign under the picture: a ring with the waterline across it, a mark above the line and the same mark, hollow, below.
func _flip_icon_setup() -> void:
	var cl := CanvasLayer.new(); cl.layer = 5; add_child(cl)
	flip_icon = Control.new(); flip_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE; flip_icon.modulate.a = 0.0; cl.add_child(flip_icon)
	flip_icon.draw.connect(func() -> void:
		var px := get_viewport().get_visible_rect().size.x / 720.0; var R := 34.0 * px
		var ink := Color(1.0, 0.985, 0.94); var soft := Color(0.06, 0.1, 0.25, 0.3)
		flip_icon.draw_circle(Vector2.ZERO, R + 1.0 * px, Color(0.06, 0.1, 0.25, 0.16))
		flip_icon.draw_arc(Vector2.ZERO, R, 0.0, TAU, 64, soft, 5.0 * px, true); flip_icon.draw_arc(Vector2.ZERO, R, 0.0, TAU, 64, ink, 2.2 * px, true)
		flip_icon.draw_line(Vector2(-R * 0.64, 0), Vector2(R * 0.64, 0), ink, 2.0 * px, true)
		flip_icon.draw_colored_polygon(PackedVector2Array([Vector2(0, -R * 0.66), Vector2(R * 0.27, -R * 0.14), Vector2(-R * 0.27, -R * 0.14)]), ink)
		flip_icon.draw_polyline(PackedVector2Array([Vector2(0, R * 0.66), Vector2(R * 0.27, R * 0.14), Vector2(-R * 0.27, R * 0.14), Vector2(0, R * 0.66)]), Color(ink, 0.8), 1.8 * px, true))

## the water she stands by, if it can be turned
func _flip_water_near() -> String:
	for wid in (WL if flip_test else FLIP_DEMO_WATERS if flip_demo else []):
		if W.has(wid) and not (W[wid].foot as Dictionary).is_empty() and _rect_dist(pos, W[wid].r) < 2.0: return wid
	return ""

func _flip_icon_frame(dt: float) -> void:
	var wid := ""
	if started and not ended and woke and not flip_busy and not busy: wid = flip_wid if flip_on else _flip_water_near()
	flip_icon_wid = wid
	flip_icon_a = move_toward(flip_icon_a, 1.0 if wid != "" else 0.0, dt / 0.5)
	var vs := get_viewport().get_visible_rect().size
	flip_icon.modulate.a = smoothstep(0.0, 1.0, flip_icon_a) * 0.96
	flip_icon.position = Vector2(vs.x * 0.5, vs.y - 168.0 * vs.x / 720.0); flip_icon.rotation = PI * (0.5 - 0.5 * flip_th)
	if wid != "" and not flip_on and flip_demo and not flags.get("icon_said", false): flags["icon_said"] = true; say("tap the sign  ·  the world turns over")

func _flip_icon_press() -> void:
	if flip_busy or busy or flip_icon_wid == "": return
	var pr := create_tween(); pr.tween_property(flip_icon, "scale", Vector2.ONE * 0.88, 0.09); pr.tween_property(flip_icon, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	if flip_on: _flip(Vector2.ZERO, [])
	else: _flip(Vector2.ZERO, [WL.find(flip_icon_wid)])

## (the trial, with the eye's own turn) the pane over the picture stays: it gives the world its look, and the turned picture its other look
func _flip_pane_always() -> bool: return flip_fx == "" and (flip_demo or flip_test) and not geo_demo and not go_demo      # (not in the trial of the look: its waters are the game's own, as they were)

## The turn itself, as a thing the eye does: it comes down until it looks along the waterline (the world stands above the
## line and what the water shows of it hangs below, she above and her shadow under her feet), and goes on under it.
## Under the water the same world is drawn, turned over; at the line the two pictures are the same picture, so nothing
## jumps. What changes sides (who is dark, the stones, the grilles, the waters' look) changes there, at the line.
func _flip_real(over: bool) -> void:
	var T := 2.7      # the eye comes down to the waterline and goes on under it, in one move
	flip_rect.visible = true
	flip_mask_vp.size = Vector2i(get_viewport().get_visible_rect().size * 0.5); flip_mask_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	flip_moving = true
	var tw3 := create_tween()
	tw3.tween_property(self, "flip_th", -1.0 if over else 1.0, T).from(1.0 if over else -1.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await tw3.finished
	await get_tree().process_frame
	flip_moving = false; flip_mask_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	flip_on = over
	if not flip_on:
		flip_mi.visible = false; flip_rect.visible = _flip_pane_always()
		if not refl_out.is_empty():      # her image is under her feet again, and does as she does
			var hm1 := _hermod(refl_out)
			if hm1 != null: hm1.own = false
			H[refl_key] = refl_out; refl_out = {}; refl_w = ""
	flip_busy = false
	if flip_demo and flip_on and not flags.get("flip_said", false) and not done.has("wheel1"): flags["flip_said"] = true; say("you are her shadow  ·  what you turn here, turns in the water" if match_demo else "you are her shadow  ·  here the mole is whole")
	print("FLIP ", "over" if flip_on else "back")

## (every frame of the turn, before the eye is placed) the eye's steepness and her place in the view follow the turn; and
## at the waterline what changes sides changes
func _flip_pre() -> void:
	var v := flip_th
	cam_pitch = FLIP_PITCH * absf(v); cam_up_k = v * absf(v)
	var side := flip_side if absf(v) < 0.0005 else (1.0 if v > 0.0 else -1.0)
	if side == flip_side: return
	flip_side = side
	var over := side < 0.0
	for hm in her_mats: (hm as ShaderMaterial).set_shader_parameter("tint", FLIP_DARK if over else Vector3.ONE)
	for mm2 in flip_mir: (mm2 as ShaderMaterial).set_shader_parameter("tint", Vector3.ONE if over else FLIP_DARK)
	for g in flip_glass:
		var gm: ShaderMaterial = g[0]
		gm.set_shader_parameter("clear", 0.7 if over else 0.0); gm.set_shader_parameter("wave", 0.55 if over else 1.0); gm.set_shader_parameter("blur_px", float(g[1]) * (0.4 if over else 1.0))
	_flip_world(flip_wid, over, 0.55)

## (every frame of the turn, once the eye is placed) the picture is told where the eye is
func _flip_post() -> void:
	var vs := get_viewport().get_visible_rect().size
	var lr := cam.unproject_position(Vector3(flip_anchor.x, 0, flip_anchor.z)).y / vs.y
	flip_mat.set_shader_parameter("th", flip_side * maxf(absf(flip_th), 0.0001)); flip_mat.set_shader_parameter("line", lr if flip_side > 0.0 else 1.0 - lr)      # (at rest on the line the picture is still the side it came from)
	flip_mask_cam.global_transform = cam.global_transform; flip_mask_cam.size = cam.size; flip_mask_cam.near = cam.near; flip_mask_cam.far = cam.far

## what exists on one side only changes sides with the picture: the stones of the mole's middle, the two grilles of the
## trough. (A thing of the world is put away by sinking; a thing of the water by being drawn flat, since "down" in the
## water is up in the world.)
func _flip_world(wid: String, over: bool, d: float) -> void:
	if wid == "M": match_view_m = over; _match_apply(); return
	var real := func(n: Node3D, shown: bool, low: float) -> void:
		if shown: n.visible = true
		var q := create_tween(); q.tween_property(n, "position:y", 0.0 if shown else low, d).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		if not shown: q.tween_callback(func() -> void: n.visible = false)
	var water := func(n: Node3D, shown: bool) -> void:
		if shown: n.visible = true
		var q := create_tween(); q.tween_property(n, "scale:y", 1.0 if shown else 0.001, d).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		if not shown: q.tween_callback(func() -> void: n.visible = false)
	if wid == "H":
		real.call(N["cross_r"], over, -0.4); water.call(N["cross_m"], not over)
	elif wid == "T":
		real.call(N["g2w_r"], over, -2.1); water.call(N["g2w_m"], not over)
		if not done.has("wheel2"):      # (once the wheel is turned the world's grille is down for good, on both sides)
			real.call(N["g2"], not over, -2.1); water.call(N["g2_m"], over)

## (the turned picture) the shadow walks a way over its footing
func _shadow_go(pts: Array) -> void:
	route.clear(); speed_cap = PLAY_WALK; face_to = null
	pts = _round_solids(pos, pts, func(q: Vector3) -> bool: return _foot_of(flip_wid, q, 0.01) != "")
	for q in pts: route.append({"p": Vector3(q.x, 0, q.z)})

## (the turned picture) the shadow's way to a place. A way that would take it farther from her than it may go is no way:
## then it goes by its nearer footing alone, as far as that is open (to the grille that stops it, not round the water).
func _shadow_way(to: Vector3) -> Dictionary:
	var way := _refl_path(flip_wid, pos, to)
	var far := false; var a := pos
	for q in way.pts:
		var n := int(ceil(_flat(a, q) / 0.25)) + 1
		for i in n + 1:
			if _flat(a.lerp(q, float(i) / n), flip_anchor) > FLIP_LEASH - 0.15: far = true
		a = q
	var wide: Array = W[flip_wid].get("wide", [])
	if not far or wide.is_empty(): return way
	var F: Dictionary = W[flip_wid].foot; var was := {}
	for n2 in wide: was[n2] = F[n2].on; F[n2].on = false
	var near := _refl_path(flip_wid, pos, to)
	for n2 in wide: F[n2].on = was[n2]
	return near if not near.pts.is_empty() or _foot_of(flip_wid, pos, 0.9) != "" else way

## (the turned picture) a thing of this water: the shadow goes to it and does what her image would have done
func _shadow_use(k: String) -> void:
	var o: Dictionary = objs[k]
	var way := _shadow_way(o.rstand)
	if way.pts.is_empty() and _flat(pos, o.rstand) > 0.3: await _her_no(); return
	busy = true
	if not way.pts.is_empty(): _shadow_go(way.pts)
	while not route.is_empty(): await get_tree().process_frame
	if flip_homing or (way.left <= 0.25 and _flat(pos, o.rstand) > 0.4): busy = false; return      # (it was taken back to her on the way)
	if way.left > 0.25:      # something stands in its way: it has come as near as it can
		busy = false; await _her_no(); return
	await call("_do_" + k)
	busy = false; settled.emit()

## (the turned picture) the shadow turns a wheel with its own hands, and what the wheel works goes
func _shadow_wheel(id: String, focus: Vector3, opens: Callable) -> void:
	var hub: Vector3 = N["hub" + id]; var hn: Vector3 = N["hubn" + id]
	await face(hub)
	var wa: Node3D = N["wheel" + id]; var wm: Node3D = N["wheel" + id + "_m"]
	var crank := func(_v: float) -> void:
		var pts := _crank_pts(hub, hn, wa.rotation.x, 0.35)
		tgtL = pts[0]; tgtR = pts[1]
	crank.call(0.0)
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.5); up.tween_property(self, "a_wR", 1.0, 0.5); up.tween_property(self, "a_lean", 0.1, 0.5)
	await up.finished
	var wt := create_tween().set_parallel(); wt.tween_property(wa, "rotation:x", wa.rotation.x + PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE); wt.tween_property(wm, "rotation:x", wm.rotation.x + PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE)
	wt.tween_method(crank, 0.0, 1.0, 5.2)
	await wait(1.2)
	cam_focus = focus; cam_focus_on = true      # the eye goes to what the wheel works (it does not draw back)
	await wait(0.9)
	await opens.call()
	if wt.is_running(): await wt.finished
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.5); dn.tween_property(self, "a_wR", 0.0, 0.5); dn.tween_property(self, "a_lean", 0.0, 0.5)
	await dn.finished
	cam_focus_on = false

## how far (on the screen) a tap falls from a thing of the water, taken at its own place in the world (the turned picture shows the thing itself)
func _tap_dist_world(k: String, sp: Vector2) -> float:
	var best := 1e9; var prev = null
	for q in objs[k].get("hits", [objs[k].at]):
		var s := cam.unproject_position(Vector3(q.x, absf(q.y), q.z))
		if prev != null:
			var ab: Vector2 = s - prev; var u := clampf((sp - prev).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
			best = minf(best, sp.distance_to(prev + ab * u))
		else: best = minf(best, sp.distance_to(s))
		prev = s
	return best

## (the turned picture) what a tap means
func _shadow_tap(sp: Vector2) -> void:
	if flip_busy or busy: return
	var px := get_viewport().get_visible_rect().size.x / 720.0
	var best := ""; var bd := 64.0 * px
	for k in objs:
		if done.has(k) or not objs[k].has("water") or objs[k].water != flip_wid: continue
		var d := _tap_dist_world(k, sp)
		if d < bd: bd = d; best = k
	if best != "":
		usering.position = Vector3(objs[best].at.x, 0.03, objs[best].at.z); use_p = 0.0
		_shadow_use(best); return
	var o := cam.project_ray_origin(sp); var dr := cam.project_ray_normal(sp)
	var g := o + dr * (-o.y / dr.y); g.y = 0.0
	var way := _shadow_way(g)
	if not way.pts.is_empty() and _foot_of(flip_wid, g, 0.12) != "":      # a place it can stand on
		_shadow_go(way.pts); tapring.position = Vector3(g.x, 0.02, g.z); tap_p = 0.0; return
	if not way.pts.is_empty(): _shadow_go(way.pts)      # anywhere else: as near as its footing comes

## (the trial) the words under the picture speak of the turning water
func say(s: String) -> void:
	if flip_demo and s.begins_with("tap the water"): s = "tap the sign  ·  the world turns over"
	super.say(s)

## while the picture is turned over, a finger on the screen means the place it would have meant the right way up.
## In the ivory level (Eidolon GO) a finger drawn across the screen is a swipe: one step that way (as in Lara Croft GO);
## a touch that does not travel is still a tap.
var ivg_sw0 := Vector2.ZERO
var ivg_sw_id := -1
func _unhandled_input(ev: InputEvent) -> void:
	if go_iv and ivr_on and started and not ended:
		if ev is InputEventScreenTouch:
			if ev.pressed: ivg_sw0 = ev.position; ivg_sw_id = ev.index; return
			if ev.index == ivg_sw_id:
				ivg_sw_id = -1
				var dv: Vector2 = (ev.position as Vector2) - ivg_sw0
				if dv.length() > 26.0 * get_viewport().get_visible_rect().size.x / 720.0: _ivg_swipe(dv)
				else: tap(ivg_sw0)
			return
		if ev is InputEventScreenDrag: return
	if ev is InputEventScreenTouch and ev.pressed and flip_icon != null and flip_icon_wid != "" and flip_icon_a > 0.6 and (ev.position as Vector2).distance_to(flip_icon.position) < 50.0 * get_viewport().get_visible_rect().size.x / 720.0:
		_flip_icon_press(); return
	if flip_on and flip_turn and (ev is InputEventScreenTouch or ev is InputEventScreenDrag):
		ev = ev.duplicate(); ev.position.y = get_viewport().get_visible_rect().size.y - ev.position.y
	super._unhandled_input(ev)

# ---------------------------------------------------------------- what is looked at, stays (a trial)
## The monument is alive: its deck turns and its slabs drift, rocked by the sea. What a statue of her looks at stands
## still, and can be walked on; what nothing looks at cannot. The statues are veiled; a tap on one sends her to it,
## and she takes its veil off, or puts it back. Inside the square lies a still pool, as in the game's courts.
## The riddle: the gate stands at the far corner. The road to it is broken by a gap whose slab drifts out to sea and
## back; the turning deck in the pool carries a bridge across from the right-hand road to that gap. The statue on the
## right looks at the deck. The statue on the near side looks away from the gap, into a bronze mirror on the left
## corner, and the mirror turns its look up the far-left road onto the slab. So: unveil the near statue while the slab
## is in its gap; unveil the right one while the bridge lies across; cross.
const GD_G := 9.3
const GCX := 110.0
const GH_VIEW := 15.0
const GH_MID_PT := Vector3(109.7, 0, 1.0)
var gh_pic: Node3D
var gh_hang: Node3D
var gh_inv: Node3D
var gh_bx := {}
var gh_sh: Shader
var gh_clear := {}
var gh_t := 0.0
var gh_flies := []
var gh_said := {}
var gh_st := {}      # the statues: id -> {statue, veil, fold, beams, stand, looks, tied, head}
var gh := {"deck": 30.0, "deck_held": false, "slab_t": 0.0, "slab_held": false, "slab_out": 1.2, "busy": false}

func _gh_clear_code(code: String) -> String:      # (a thing of the picture is not paled by the water's haze: the sea's face tints it)
	return code.replace("col = mix(col, fog_col, smoothstep(sea_y - 0.05, sea_y - 3.3, wp.y) * 0.9);", "").replace("col *= mix(0.9, 1.0, clamp(smoothstep(-1.6, -0.1, wp.y) + wt, 0.0, 1.0));", "")

## the colour n of the world's palette: for the monument as it stands ("real"), or for its picture under the water ("twin")
func _gm(n: String, kind: String) -> ShaderMaterial:
	if kind == "real": return pal(n, "flat")
	var key := n + "|ghtwin"
	if pmats.has(key): return pmats[key]
	if gh_sh == null:
		gh_sh = Shader.new(); gh_sh.code = _gh_clear_code((shaders["mir"] as Shader).code)
	var m := ShaderMaterial.new(); m.shader = gh_sh
	m.set_shader_parameter("c_top", Color(pals[n][0])); m.set_shader_parameter("c_z", Color(pals[n][1])); m.set_shader_parameter("c_x", Color(pals[n][2]))
	m.set_shader_parameter("fog_col", sea_c); m.set_shader_parameter("mist_col", mist_c); m.set_shader_parameter("shadow_col", shadow_c); m.set_shader_parameter("mist_k", mist_k)
	m.set_shader_parameter("flat_n", 1.0)
	if n in ["stone", "shade", "sand", "rose"]: m.set_shader_parameter("marble", 1.0)
	m.set_meta("gh", true); pmats[key] = m
	return m

func _gm_like(src: ShaderMaterial) -> ShaderMaterial:
	if src.has_meta("gh"): return src
	var ct = src.get_shader_parameter("c_top")
	if ct == null: return src
	var key := "%s|%s|%s|%s|ghtwin" % [str(ct), str(src.get_shader_parameter("flat_n")), str(src.get_shader_parameter("rim")), str(src.get_shader_parameter("marble"))]
	if pmats.has(key): return pmats[key]
	_gm("stone", "twin")
	var m := ShaderMaterial.new(); m.shader = gh_sh
	for p in ["c_top", "c_z", "c_x", "fog_col", "mist_col", "shadow_col", "mist_k", "flat_n", "rim", "marble"]:
		var v = src.get_shader_parameter(p)
		if v != null: m.set_shader_parameter(p, v)
	m.set_meta("gh", true); pmats[key] = m
	return m

## everything under root (a thing of the picture) takes the picture's own materials, and casts no shadow
func _gh_remat(root: Node) -> void:
	for mm in root.find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if mi.material_override is ShaderMaterial: mi.material_override = _gm_like(mi.material_override)
		if mi.mesh == null: continue
		for si in mi.mesh.get_surface_count():
			var sm = mi.get_surface_override_material(si)
			if sm is ShaderMaterial: mi.set_surface_override_material(si, _gm_like(sm))

## her image is to be seen plainly at any depth
func _gh_her_clear() -> void:
	for mm in (H["mir"].holder as Node).find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		var ms := [mi.material_override]
		if mi.mesh != null:
			for si in mi.mesh.get_surface_count(): ms.append(mi.get_surface_override_material(si)); ms.append(mi.mesh.surface_get_material(si))
		for m in ms:
			if not (m is ShaderMaterial) or (m as ShaderMaterial).shader == null: continue
			var s: Shader = (m as ShaderMaterial).shader
			if s.has_meta("gh") or not ("smoothstep(-1.35, -4.6, wp.y)" in s.code): continue
			if not gh_clear.has(s):
				var s2 := Shader.new(); s2.code = _gh_clear_code(s.code); s2.set_meta("gh", true); gh_clear[s] = s2
			(m as ShaderMaterial).shader = gh_clear[s]

## a box of the monument: from x0, z0 to x1, z1, from depth dt (its top) down to depth db
func _cb(x0: float, z0: float, x1: float, z1: float, dt: float, db: float, m := "stone") -> void:
	if not gh_bx.has(m): gh_bx[m] = []
	(gh_bx[m] as Array).append([Vector3(minf(x0, x1), GD_G - maxf(dt, db), minf(z0, z1)), Vector3(maxf(x0, x1), GD_G - minf(dt, db), maxf(z0, z1))])

func _gh_flush() -> void:
	for m in gh_bx:
		for inv in [false]:      # (here the sea itself shows the square, as a shade: no second building under it)
			var vs := PackedVector3Array(); var ns := PackedVector3Array()
			for ab in gh_bx[m]:
				var a: Vector3 = ab[0]; var b: Vector3 = ab[1]
				if inv:      # (the water shows what stands over it)
					if b.y <= 0.001: continue
					a.y = maxf(a.y, 0.0)
				var c := (a + b) * 0.5; var e := (b - a) * 0.5
				for f in 6:
					var ax := int(f / 2)
					var n := Vector3.ZERO; n[ax] = 1.0 if f % 2 == 1 else -1.0
					var u := Vector3.ZERO; u[(ax + 1) % 3] = 1.0
					var w := n.cross(u)
					var q := [c + (n - u - w) * e, c + (n + u - w) * e, c + (n + u + w) * e, c + (n - u + w) * e]
					for i in ([0, 2, 1, 0, 3, 2] if not inv else [0, 1, 2, 0, 2, 3]):
						var v: Vector3 = q[i]
						vs.append(Vector3(v.x, -v.y if inv else v.y, v.z)); ns.append(Vector3(n.x, -n.y if inv else n.y, n.z))
			if vs.is_empty(): continue
			var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_NORMAL] = ns
			var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			var mi := MeshInstance3D.new(); mi.mesh = am; mi.material_override = _gm(m, "twin" if inv else "real")
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if inv else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			gh_hang.add_child(mi)
	gh_bx.clear()

func _gpar(kind: String) -> Node3D:
	return gh_pic if kind == "real" else gh_inv

func _gsh(mi: MeshInstance3D, kind: String) -> void:
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if kind == "real" else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## a round piece of the monument: from depth dt down to db, rb wide (half) at the bottom and rt at the top
func _cc(x: float, z: float, dt: float, db: float, rb: float, rt: float, m := "stone", seg := 12) -> void:
	for kind in ["real"]: _gsh(cyl(Vector3(x, -db, z), rb, rt, db - dt, _gm(m, kind), seg, _gpar(kind)), kind)

func _cdome(x: float, z: float, d: float, r: float, m := "terra", squash := 1.0) -> void:
	for kind in ["real"]:
		var sm := SphereMesh.new(); sm.radius = r; sm.height = r * squash; sm.is_hemisphere = true; sm.radial_segments = 16; sm.rings = 6
		_gsh(prim(sm, Vector3(x, -d, z), _gm(m, kind), _gpar(kind)), kind)
	_cc(x, z, d - r * squash - 0.2, d - r * squash + 0.02, 0.04, 0.012, "gold", 6)

## an arched opening, dark, on a wall: face "z" is a south face at z (x: its middle), face "x" an east face at x
func _carch(x: float, z: float, d_bot: float, w: float, h: float, face: String, m := "dark") -> void:
	var top := d_bot - (h - w * 0.5)
	if face == "z": _cb(x - w * 0.5, z, x + w * 0.5, z + 0.03, top, d_bot, m)
	else: _cb(x, z - w * 0.5, x + 0.03, z + w * 0.5, top, d_bot, m)
	for kind in ["real"]:
		var c := CylinderMesh.new(); c.top_radius = w * 0.5; c.bottom_radius = w * 0.5; c.height = 0.03; c.radial_segments = 14; c.rings = 1
		var mi := prim(c, Vector3(x, -top, z) + (Vector3(0, 0, 0.018) if face == "z" else Vector3(0.018, 0, 0)), _gm(m, kind), _gpar(kind))
		mi.rotation = Vector3(PI * 0.5, 0, 0) if face == "z" else Vector3(0, 0, PI * 0.5); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## a building of the monument: its body down to db, and its dress
func _ctower(x0: float, z0: float, x1: float, z1: float, dt: float, m := "stone", db := GD_G, arches := true) -> void:
	_cb(x0, z0, x1, z1, dt, db, m); _cdress(x0, z0, x1, z1, dt, db, arches)

## the dress of a building: a cornice with dentils, a plinth, and rows of arched doors and windows on the two faces the
## eye sees (none between gap0 and gap1 along the east face)
func _cdress(x0: float, z0: float, x1: float, z1: float, dt: float, db: float, arches := true, gap0 := 0.0, gap1 := 0.0) -> void:
	_cb(x0 - 0.07, z0 - 0.07, x1 + 0.07, z1 + 0.07, dt + 0.08, dt + 0.2, "shade")
	for i in int((x1 - x0) / 0.2): _cb(x0 + 0.06 + i * 0.2, z1, x0 + 0.15 + i * 0.2, z1 + 0.05, dt + 0.2, dt + 0.28, "stone")
	for i in int((z1 - z0) / 0.2): _cb(x1, z0 + 0.06 + i * 0.2, x1 + 0.05, z0 + 0.15 + i * 0.2, dt + 0.2, dt + 0.28, "stone")
	_cb(x0 - 0.07, z0 - 0.07, x1 + 0.07, z1 + 0.07, db - 0.18, db, "shade")
	if not arches: return
	var bot := db - 0.18; var first := true
	while bot - 0.85 > dt + 0.3:
		var ah := minf(0.95, bot - dt - 0.45) if first else 0.75; var aw := 0.44 if first else 0.36
		var b2 := bot if first else bot - 0.3
		var nx := maxi(1, int(round((x1 - x0) / 0.8))); var nz := maxi(1, int(round((z1 - z0) / 0.8)))
		for i in nx: _carch(x0 + (i + 0.5) * (x1 - x0) / nx, z1, b2, aw, ah, "z")
		for i in nz:
			var az := z0 + (i + 0.5) * (z1 - z0) / nz
			if gap1 > gap0 and az > gap0 and az < gap1: continue
			_carch(x1, az, b2, aw, ah, "x")
		if not first: _cb(x0 - 0.03, z0 - 0.03, x1 + 0.03, z1 + 0.03, bot + 0.02, bot + 0.08, "shade")
		bot -= 1.4; first = false

## a rect [x0, z0, x1, z1], or (sw) its image on the other side of the monument
func _gsw(r: Array, sw: bool) -> Array:
	return [GCX + r[1], r[0] - GCX, GCX + r[3], r[2] - GCX] if sw else r

## the lines of a paving on a floor at depth d
func _ctiles(x0: float, z0: float, x1: float, z1: float, d: float, step := 0.8) -> void:
	var x := x0 + step
	while x < x1 - 0.2: _cb(x - 0.008, z0 + 0.04, x + 0.008, z1 - 0.04, d - 0.004, d, "shade"); x += step
	var z := z0 + step
	while z < z1 - 0.2: _cb(x0 + 0.04, z - 0.008, x1 - 0.04, z + 0.008, d - 0.004, d, "shade"); z += step

## steps: from depth d0 (where the axis begins) to d1 (where it ends); solid: each step stands on the ground
func _cstair(x0: float, z0: float, x1: float, z1: float, d0: float, d1: float, ax: String, m := "stone", n := 8, solid := false) -> void:
	for i in n:
		var t0 := float(i) / n; var t1 := float(i + 1) / n
		var dd := lerpf(d0, d1, (i + 0.5) / n)
		var bot := GD_G if solid else dd + 0.36
		if ax == "x": _cb(lerpf(x0, x1, t0), z0, lerpf(x0, x1, t1), z1, dd, bot, m)
		else: _cb(x0, lerpf(z0, z1, t0), x1, lerpf(z0, z1, t1), dd, bot, m)

func _ccol(x: float, z: float, d: float, h: float, r := 0.15, broken := false) -> void:
	_cc(x, z, d - 0.07, d, r * 1.4, r * 1.4, "shade", 12)
	if broken:
		_cc(x, z, d - h, d - 0.07, r * 1.1, r, "stone", 10); _cc(x, z, d - h - 0.08, d - h, r * 0.95, r * 0.5, "shade", 7)
	else:
		_cc(x, z, d - h + 0.17, d - 0.07, r * 1.1, r, "stone", 10); _cc(x, z, d - h + 0.08, d - h + 0.17, r, r * 1.3, "stone", 10)
		_cb(x - r * 1.45, z - r * 1.45, x + r * 1.45, z + r * 1.45, d - h, d - h + 0.08, "shade")

## a balustrade along an edge (level, along x or z), on a floor at depth d
func _crail(x0: float, z0: float, x1: float, z1: float, d: float) -> void:
	var n := maxi(1, int(maxf(absf(x1 - x0), absf(z1 - z0)) / 0.22))
	for i in n + 1:
		var px := lerpf(x0, x1, float(i) / n); var pz := lerpf(z0, z1, float(i) / n)
		_cb(px - 0.028, pz - 0.028, px + 0.028, pz + 0.028, d - 0.3, d, "dark" if i % 6 != 0 else "stone")
	_cb(minf(x0, x1) - 0.05, minf(z0, z1) - 0.05, maxf(x0, x1) + 0.05, maxf(z0, z1) + 0.05, d - 0.38, d - 0.3, "stone")

## a model of the world's, standing on the monument at depth d
func _cprop(file: String, x: float, z: float, d: float, height: float, parts: String, yaw := 0.0, across := 0.0) -> void:
	for kind in ["real"]:
		var n := Node3D.new(); n.position = Vector3(x, -d, z); n.rotation.y = yaw; _gpar(kind).add_child(n)
		prop_model(file, n, height, across, kind == "twin", false, parts.replace("~", "") if kind == "twin" else parts)

func _cstatue(x: float, z: float, d: float, yaw: float, pose: String, sc := 1.0, tilt := Vector3.ZERO) -> void:
	for kind in ["real"]:
		var s := her_statue(Vector3(x, -d, z), yaw, pose, sc)
		s.get_parent().remove_child(s); _gpar(kind).add_child(s)
		if tilt != Vector3.ZERO: s.rotation = Vector3(tilt.x, yaw, tilt.z)

## a brazier: a bronze bowl of fire on a stem
func _gh_brazier(p: Vector3) -> void:
	cyl(p, 0.16, 0.05, 0.06, pal("gold", "flat"), 10); cyl(p + Vector3(0, 0.06, 0), 0.035, 0.035, 0.62, pal("gold", "flat"), 8)
	cyl(p + Vector3(0, 0.68, 0), 0.07, 0.25, 0.19, pal("gold", "flat"), 14); cyl(p + Vector3(0, 0.85, 0), 0.21, 0.21, 0.03, pal("dark", "flat"), 14)
	_gh_flame(p + Vector3(0, 0.88, 0), 1.0)

## a lantern of stone: a short pillar with a lit house on it under a little roof
func _gh_stone_lamp(p: Vector3) -> void:
	blk(p + Vector3(-0.21, 0, -0.21), p + Vector3(0.21, 0.1, 0.21), "shade").material_override = pal("shade", "flat")
	blk(p + Vector3(-0.12, 0.1, -0.12), p + Vector3(0.12, 0.62, 0.12), "stone").material_override = pal("stone", "flat")
	blk(p + Vector3(-0.19, 0.62, -0.19), p + Vector3(0.19, 0.68, 0.19), "shade").material_override = pal("shade", "flat")
	for e in [Vector3(-0.15, 0, -0.15), Vector3(0.15, 0, -0.15), Vector3(-0.15, 0, 0.15), Vector3(0.15, 0, 0.15)]:
		blk(p + e + Vector3(-0.03, 0.68, -0.03), p + e + Vector3(0.03, 0.98, 0.03), "stone").material_override = pal("stone", "flat")
	blk(p + Vector3(-0.12, 0.7, -0.12), p + Vector3(0.12, 0.96, 0.12), "lamp").material_override = mat(Color("ffd98a"))
	blk(p + Vector3(-0.22, 0.98, -0.22), p + Vector3(0.22, 1.03, 0.22), "shade").material_override = pal("shade", "flat")
	var rf := cyl(p + Vector3(0, 1.03, 0), 0.29, 0.03, 0.2, pal("terra", "flat"), 4); rf.rotation.y = PI * 0.25
	cyl(p + Vector3(0, 1.22, 0), 0.035, 0.035, 0.06, pal("gold", "flat"), 8)
	var halo := SphereMesh.new(); halo.radius = 0.42; halo.height = 0.84; halo.radial_segments = 14; halo.rings = 7
	prim(halo, p + Vector3(0, 0.83, 0), mat(Color(1.0, 0.78, 0.4, 0.13), true)).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## a lamp that floats: a little dish of wood with a flame
func _gh_float_lamp(p: Vector3) -> void:
	cyl(p, 0.11, 0.17, 0.05, pal("wood", "flat"), 12); cyl(p + Vector3(0, 0.05, 0), 0.06, 0.06, 0.03, pal("gold", "flat"), 8)
	_gh_flame(p + Vector3(0, 0.08, 0), 0.55)

func _gh_flame(p: Vector3, k: float) -> void:
	cyl(p, 0.12 * k, 0.0, 0.36 * k, mat(Color("ffb648")), 8).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cyl(p, 0.065 * k, 0.0, 0.24 * k, mat(Color("fff0b8")), 8).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var halo := SphereMesh.new(); halo.radius = 0.5 * k; halo.height = 1.0 * k; halo.radial_segments = 14; halo.rings = 7
	prim(halo, p + Vector3(0, 0.16 * k, 0), mat(Color(1.0, 0.72, 0.34, 0.14), true)).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## the joints of a paving, drawn flat on its top (so that the sea does not show them as lines floating on the water)
func _gh_tiles(r: Array, y: float, step := 0.65) -> void:
	var m := mat(Color(pals["stone"][0]).darkened(0.13))
	var x: float = r[0] + step
	while x < r[2] - 0.15: blk(Vector3(x - 0.008, y, r[1] + 0.03), Vector3(x + 0.008, y + 0.004, r[3] - 0.03), "shade").material_override = m; x += step
	var z: float = r[1] + step
	while z < r[3] - 0.15: blk(Vector3(r[0] + 0.03, y, z - 0.008), Vector3(r[2] - 0.03, y + 0.004, z + 0.008), "shade").material_override = m; z += step

## the still water inside the square: as the game's courts have it. A pit with the sky in it, the glass that ripples
## and blurs over it, a kerb where a road's gap meets it; and everything that stands about, mirrored in it (the game's
## own mirrored body of her shows in it by itself)
func _gh_pool() -> void:
	var x0 := 107.05; var z0 := -2.95; var x1 := 112.95; var z1 := 2.95
	var tall := Node3D.new(); tall.name = "GhTall"; add_child(tall)
	var before: Dictionary = gh_pic.get_meta("before")
	for ch in get_children():
		if before.has(ch) or ch == tall or not (ch is Node3D): continue
		(ch as Node3D).reparent(tall, true)
	var pit := MeshInstance3D.new(); var pm := BoxMesh.new(); pm.size = Vector3(x1 - x0, 2.4, z1 - z0); pit.mesh = pm
	pit.position = Vector3((x0 + x1) * 0.5, -0.19 - 1.2, (z0 + z1) * 0.5)
	var pmat := ShaderMaterial.new(); pmat.shader = shaders["pit"]; pmat.set_shader_parameter("y0", -0.2); pmat.set_shader_parameter("y1", -2.4)
	pit.material_override = pmat; pit.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(pit)
	glass(x0, z0, x1, z1)      # (the deck that turns in it stands over it: the glass does not show over the deck)
	for r in [[106.95, -1.0, 107.05, 1.0], [107.8, 2.95, 109.2, 3.05], [110.8, -3.05, 112.2, -2.95]]:
		blk(Vector3(r[0], WATER - 0.8, r[1]), Vector3(r[2], 0.03, r[3]), "stone").material_override = pal("stone", "flat")
	# the mirrored copy: the same things, turned over about the water, drawn from both sides and not mirrored again in
	# the sea. Only what stands over the water: what reaches down under it (the decks' footings, what stands in the sea)
	# would stand up out of it, turned over
	for mm in tall.find_children("*", "MeshInstance3D", true, false):
		var mo := mm as MeshInstance3D
		if mo.mesh == null: continue
		var box: AABB = mo.global_transform * mo.get_aabb()
		if box.position.y < -0.08: mo.set_meta("no_twin", true)
	var tw := tall.duplicate() as Node3D; mroot.add_child(tw); tw.transform = Transform3D.IDENTITY
	var conv := {}
	for mm in tw.find_children("*", "MeshInstance3D", true, false):
		var mi := mm as MeshInstance3D
		if mi.has_meta("no_twin"): mi.queue_free(); continue
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if mi.material_override is ShaderMaterial: mi.material_override = _gh_twin_mat(mi.material_override, conv)
		if mi.mesh == null: continue
		for si in mi.mesh.get_surface_count():
			var sm = mi.get_surface_override_material(si)
			if sm is ShaderMaterial: mi.set_surface_override_material(si, _gh_twin_mat(sm, conv))

func _gh_twin_mat(m: ShaderMaterial, conv: Dictionary) -> ShaderMaterial:
	if conv.has(m): return conv[m]
	var c := m.duplicate() as ShaderMaterial
	if m.shader == shaders["base"]: c.shader = shaders["two"]
	c.next_pass = null
	conv[m] = c
	return c

## a look: a faint beam of light from a to b (hidden till the statue looks)
func _gh_beam(a: Vector3, b: Vector3) -> Node3D:
	var n := Node3D.new(); add_child(n)
	var d := b - a
	for k in [[0.035, Color(1.0, 0.93, 0.72, 0.55)], [0.11, Color(1.0, 0.85, 0.55, 0.12)], [0.24, Color(1.0, 0.8, 0.5, 0.05)]]:
		var c := CylinderMesh.new(); c.top_radius = k[0]; c.bottom_radius = k[0]; c.height = d.length(); c.radial_segments = 10; c.rings = 1
		var mi := MeshInstance3D.new(); mi.mesh = c; mi.material_override = mat(k[1], true); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; n.add_child(mi)
		mi.position = (a + b) * 0.5; mi.basis = Basis(Quaternion(Vector3.UP, d.normalized()))
	var sm := SphereMesh.new(); sm.radius = 0.16; sm.height = 0.32; sm.radial_segments = 12; sm.rings = 6
	prim(sm, b, mat(Color(1.0, 0.88, 0.6, 0.35), true), n).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	n.visible = false
	return n

## a line of gold light round a box held by a look (local to its parent)
func _gh_held(a: Vector3, b: Vector3, parent: Node3D) -> Node3D:
	var n := Node3D.new(); parent.add_child(n)
	for e in [[a.x - 0.03, a.z - 0.03, b.x + 0.03, a.z + 0.03], [a.x - 0.03, b.z - 0.03, b.x + 0.03, b.z + 0.03], [a.x - 0.03, a.z, a.x + 0.03, b.z], [b.x - 0.03, a.z, b.x + 0.03, b.z]]:
		blk(Vector3(e[0], b.y - 0.01, e[1]), Vector3(e[2], b.y + 0.025, e[3]), "lamp", n).material_override = mat(Color("ffd890"))
	n.visible = false
	return n

## the plinth of a statue (it stands still, and the pool shows it)
func _gh_plinth(p: Vector3) -> void:
	blk(Vector3(p.x - 0.55, 0, p.z - 0.55), Vector3(p.x + 0.55, 0.8, p.z + 0.55), "stone").material_override = pal("stone", "flat")
	blk(Vector3(p.x - 0.62, 0.68, p.z - 0.62), Vector3(p.x + 0.62, 0.8, p.z + 0.62), "shade").material_override = pal("shade", "flat")
	blk(Vector3(p.x - 0.62, 0, p.z - 0.62), Vector3(p.x + 0.62, 0.12, p.z + 0.62), "shade").material_override = pal("shade", "flat")

## a statue of her on its plinth, and its veil: {statue, veil, folded, beam, stand, looks, tied}
func _gh_statue(id: String, p: Vector3, yaw: float, stand: Vector3, eye_to: Array, tied := false) -> void:
	var top := Vector3(p.x, 0.8, p.z)
	var st := her_statue(top, yaw, "calm", 1.6)
	var veil := Node3D.new(); veil.position = top; add_child(veil)
	cyl(Vector3.ZERO, 0.56, 0.26, 2.15, pal("linen", "flat"), 14, veil); ball(Vector3(0, 2.32, 0), 0.3, pal("linen", "flat"), veil)
	cyl(Vector3(0, 1.25, 0), 0.4, 0.38, 0.06, pal("rope", "flat"), 14, veil); cyl(Vector3(0, 0.4, 0), 0.53, 0.51, 0.06, pal("rope", "flat"), 14, veil)
	for k in 5:
		var a := k * TAU / 5.0 + 0.3
		var f := ball(Vector3(cos(a) * 0.5, 0.04, sin(a) * 0.5), 0.17, pal("linen", "flat"), veil); f.scale = Vector3(1.3, 0.45, 1.0)
	var fold := ball(top + Vector3(0.38, 0.05, 0.38), 0.22, pal("linen", "flat")); fold.scale = Vector3(1.4, 0.35, 1.1); fold.visible = false
	var beams := []
	for i in range(eye_to.size() - 1): beams.append(_gh_beam(eye_to[i], eye_to[i + 1]))
	st.visible = false
	gh_st[id] = {"statue": st, "veil": veil, "fold": fold, "beams": beams, "stand": stand, "looks": false, "tied": tied, "head": top + Vector3(0, 2.4, 0)}

func _gh_build() -> void:
	gh_pic = Node3D.new(); add_child(gh_pic); gh_hang = Node3D.new(); add_child(gh_hang); gh_inv = Node3D.new(); add_child(gh_inv); gh_inv.visible = false
	var yD := 0.0      # (the decks stand where the game's floors stand, a man's height over the sea)
	var before := {}
	for ch in get_children(): before[ch] = true
	gh_pic.set_meta("before", before)
	var slab := func(r: Array) -> void:
		blk(Vector3(r[0], WATER - 0.8, r[1]), Vector3(r[2], yD, r[3]), "stone").material_override = pal("stone", "flat")
		blk(Vector3(r[0] - 0.05, yD - 0.26, r[1] - 0.05), Vector3(r[2] + 0.05, yD - 0.1, r[3] + 0.05), "shade").material_override = pal("shade", "flat")
	# the square: four roads (the far-left one broken by a gap, the far-right one by another), the corners, the statues' footings
	for r in [[105.75, 2.95, 114.25, 4.25], [112.95, -4.25, 114.25, 4.25], [105.75, -4.25, 110.8, -2.95], [112.2, -4.25, 114.25, -2.95], [105.75, -4.25, 107.05, -1.0], [105.75, 1.0, 107.05, 4.25],
			[112.6, 2.6, 115.0, 5.0], [104.6, 2.3, 107.7, 5.4], [112.3, -5.4, 115.4, -2.3], [104.8, -5.2, 108.0, -2.0], [109.3, 4.25, 110.7, 5.6], [114.25, -0.7, 115.6, 0.7], [110.8, -5.6, 112.2, -4.25]]:
		slab.call(r)
	for r in [[105.75, 2.95, 112.95, 4.25], [112.95, -2.95, 114.25, 2.95], [107.05, -4.25, 110.8, -2.95], [112.2, -4.25, 112.95, -2.95], [105.75, -2.0, 107.05, -1.0], [105.75, 1.0, 107.05, 2.95]]: _gh_tiles(r, yD)
	cyl(Vector3(113.6, yD - 0.012, 3.6), 0.5, 0.5, 0.025, pal("gold", "flat"), 24); cyl(Vector3(113.6, yD - 0.004, 3.6), 0.36, 0.36, 0.02, pal("stone", "flat"), 24)
	# balustrades along the pool's near and far edges (the bridge lands only on the left and on the right)
	for z in [2.98, -2.98]:
		for i in 25: blk(Vector3(107.2 + i * 0.235 - 0.03, 0, z - 0.03), Vector3(107.2 + i * 0.235 + 0.03, 0.42, z + 0.03), "stone").material_override = pal("stone", "flat")
		blk(Vector3(107.12, 0.42, z - 0.06), Vector3(112.88, 0.5, z + 0.06), "stone").material_override = pal("stone", "flat")
	# the gate at the far corner: two steps, eight columns in a ring, a dome, and light within
	var gx := 106.4; var gz := -3.6
	blk(Vector3(gx - 1.5, yD, gz - 1.5), Vector3(gx + 1.5, yD + 0.22, gz + 1.5), "stone").material_override = pal("stone", "flat")
	blk(Vector3(gx - 1.25, yD + 0.22, gz - 1.25), Vector3(gx + 1.25, yD + 0.44, gz + 1.25), "stone").material_override = pal("stone", "flat")
	for k in 8: column(Vector3(gx + cos(k * PI * 0.25 + PI * 0.125) * 1.0, yD + 0.44, gz + sin(k * PI * 0.25 + PI * 0.125) * 1.0), 2.5, 0.085)
	cyl(Vector3(gx, yD + 2.94, gz), 1.18, 1.18, 0.22, pal("shade", "flat"), 28)
	var dm := SphereMesh.new(); dm.radius = 1.12; dm.height = 1.12 * 0.85; dm.is_hemisphere = true; dm.radial_segments = 24; dm.rings = 8
	prim(dm, Vector3(gx, yD + 3.16, gz), pal("terra", "flat"))
	for b2 in [[gx - 0.03, gz - 0.4, gx + 0.03, gz + 0.4], [gx - 0.4, gz - 0.03, gx + 0.4, gz + 0.03]]: blk(Vector3(b2[0], yD + 0.44, b2[1]), Vector3(b2[2], yD + 2.34, b2[3]), "lamp").material_override = under_mat(Color("ffe2a0"))
	for sw in [false, true]:
		var b1 := _gsw([107.65, -4.85, 107.65, -4.85], sw); _gh_brazier(Vector3(b1[0], yD, b1[1]))
	lights[4] = Vector4(107.65, yD + 0.9, -4.85, 0.75); lights[5] = Vector4(105.15, yD + 0.9, -2.35, 0.75); lights[6] = Vector4(gx, yD + 1.4, gz, 0.85)
	cyl(Vector3(110, -0.9, 0), 0.5, 0.5, 0.6, pal("shade", "flat"), 16)      # (the deck's pillar, in the pool)
	for sp in [Vector3(114.95, 0, 0.0), Vector3(110.0, 0, 4.95), Vector3(111.5, 0, -4.95)]: _gh_plinth(sp)
	var mr := mirror_stand(Vector3(105.25, yD, 4.95), PI * 0.25, self, yD, "bare"); mr.scale = Vector3.ONE * 1.35      # the bronze mirror on the left corner
	_gh_around()
	_gh_pool()
	# --- what moves, what looks (not mirrored in the pool: they move)
	var dk := Node3D.new(); dk.position = Vector3(110, 0, 0); add_child(dk); N["ghdeck"] = dk
	cyl(Vector3(0, -0.3, 0), 1.55, 1.55, 0.34, pal("stone", "flat"), 36, dk); cyl(Vector3(0, -0.34, 0), 1.6, 1.6, 0.08, pal("shade", "flat"), 36, dk)
	cyl(Vector3(0, 0.035, 0), 0.32, 0.32, 0.02, pal("gold", "flat"), 20, dk)
	blk(Vector3(-2.95, -0.16, -0.6), Vector3(2.95, 0.04, 0.6), "stone", dk).material_override = pal("stone", "flat")
	blk(Vector3(-2.9, -0.3, -0.45), Vector3(2.9, -0.16, 0.45), "shade", dk).material_override = pal("shade", "flat")
	for e in [-2.95, 2.95]: blk(Vector3(e - 0.04, -0.17, -0.62), Vector3(e + 0.04, 0.05, 0.62), "gold", dk).material_override = pal("gold", "flat")
	N["ghdeck_held"] = _gh_held(Vector3(-2.95, 0.04, -0.6), Vector3(2.95, 0.04, 0.6), dk)
	var sl := Node3D.new(); sl.position = Vector3(106.4, 0, 0); add_child(sl); N["ghslab"] = sl
	blk(Vector3(-0.62, -0.2, -0.95), Vector3(0.62, 0.03, 0.95), "stone", sl).material_override = pal("stone", "flat")
	blk(Vector3(-0.56, -0.34, -0.85), Vector3(0.56, -0.2, 0.85), "shade", sl).material_override = pal("shade", "flat")
	for i in 2: blk(Vector3(-0.62, 0.03, -0.32 + 0.64 * i - 0.008), Vector3(0.62, 0.034, -0.32 + 0.64 * i + 0.008), "shade", sl).material_override = mat(Color(pals["stone"][0]).darkened(0.13))
	N["ghslab_held"] = _gh_held(Vector3(-0.62, 0.03, -0.95), Vector3(0.62, 0.03, 0.95), sl)
	var sf := Node3D.new(); sf.position = Vector3(111.5, 0, -3.6); add_child(sf); N["ghslab2"] = sf      # the far-right gap's slab: its statue's veil is tied fast
	blk(Vector3(-0.7, -0.2, -0.62), Vector3(0.7, 0.03, 0.62), "stone", sf).material_override = pal("stone", "flat")
	blk(Vector3(-0.62, -0.34, -0.55), Vector3(0.62, -0.2, 0.55), "shade", sf).material_override = pal("shade", "flat")
	_gh_statue("R", Vector3(114.95, 0, 0.0), -PI * 0.5, Vector3(113.85, 0, 0.0), [Vector3(114.75, 3.05, 0.0), Vector3(110.6, 0.08, 0.0)])
	_gh_statue("N", Vector3(110.0, 0, 4.95), -PI * 0.5, Vector3(110.0, 0, 3.85), [Vector3(109.8, 3.05, 4.95), Vector3(105.25, 2.7, 4.95), Vector3(106.4, 0.06, 0.0)])
	_gh_statue("F", Vector3(111.5, 0, -4.95), 0.0, Vector3(111.5, 0, -4.4), [Vector3(111.5, 3.05, -4.75), Vector3(111.5, 0.06, -3.6)], true)
	# the floors
	rects["GHnl"] = R(105.75, 2.95, 114.25, 4.25); rects["GHr"] = R(112.95, -4.25, 114.25, 4.25)
	rects["GHfr1"] = R(105.75, -4.25, 110.8, -2.95); rects["GHfr2"] = R(112.2, -4.25, 114.25, -2.95)
	rects["GHfl1"] = R(105.75, 1.0, 107.05, 4.25); rects["GHfl2"] = R(105.75, -4.25, 107.05, -1.0)
	rects["GHcn"] = R(112.6, 2.6, 115.0, 5.0); rects["GHcl"] = R(104.6, 2.3, 107.7, 5.4); rects["GHcr"] = R(112.3, -5.4, 115.4, -2.3); rects["GHcg"] = R(104.8, -5.2, 108.0, -2.0)
	rects["GHgap"] = R(105.75, -1.0, 107.05, 1.0, false); rects["GHbridge"] = R(107.0, -0.5, 113.0, 0.5, false)
	stele("gh_st0", Vector3(113.2, 0.0, 3.2), 0.0, ["What is looked at,\nstays."])
	# the look of it: a hard vignette, and small lights adrift over the water
	var cl := CanvasLayer.new(); cl.layer = 0; add_child(cl)
	var vg := Gradient.new(); vg.offsets = PackedFloat32Array([0.0, 0.36, 0.72, 1.0])
	vg.colors = PackedColorArray([Color(0.02, 0.04, 0.1, 0), Color(0.02, 0.04, 0.1, 0), Color(0.02, 0.04, 0.1, 0.42), Color(0.02, 0.04, 0.1, 0.86)])
	var vt := GradientTexture2D.new(); vt.gradient = vg; vt.fill = GradientTexture2D.FILL_RADIAL; vt.fill_from = Vector2(0.5, 0.47); vt.fill_to = Vector2(1.12, 0.47); vt.width = 256; vt.height = 256
	var vr := TextureRect.new(); vr.texture = vt; vr.stretch_mode = TextureRect.STRETCH_SCALE; vr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vr.set_anchors_preset(Control.PRESET_FULL_RECT); vr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(vr)
	var rng := RandomNumberGenerator.new(); rng.seed = 11
	for k in 34:
		var sm := SphereMesh.new(); sm.radius = 0.035; sm.height = 0.07; sm.radial_segments = 6; sm.rings = 3
		var fm := prim(sm, Vector3.ZERO, mat(Color(1.0, 0.86, 0.5, 0.85), true)); fm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		gh_flies.append({"n": fm, "c": Vector3(rng.randf_range(103.0, 118.0), WATER + rng.randf_range(0.5, 3.4), rng.randf_range(-7.0, 8.0)), "ph": rng.randf_range(0.0, TAU), "r": rng.randf_range(0.5, 1.6), "sp": rng.randf_range(0.15, 0.4)})

## what lies about the square in the sea: a colossal head of her sinking behind the gate, mirrors standing in the
## water (some under their sheets), drums of columns, rocks, a moored boat, a statue half drowned, jars afloat
func _gh_around() -> void:
	var hd := sculpt_head(Vector3(106.8, WATER - 1.3, -8.6), 4.4, 1.3, Vector3(-0.2, 0, -0.16), 2)
	if hd == null: thing("broken_statue", Vector3(101.6, WATER - 0.6, -8.2), 4.0, "stone:marble", 0.4)
	for sw in [false, true]:
		for m in [[117.4, -3.2, -0.55, "bare", 1.0], [117.0, -0.4, -0.85, "tied", 0.95], [116.0, -6.8, -0.2, "hem", 1.0]]:
			var p := _gsw([m[0], m[1], m[0], m[1]], sw)
			var yaw: float = m[2] + (PI * 0.5 if sw else 0.0) + (PI if sw else 0.0)
			blk(Vector3(p[0] - 0.42, WATER - 0.6, p[1] - 0.42), Vector3(p[0] + 0.42, WATER + 0.16, p[1] + 0.42), "stone").material_override = pal("stone", "flat")
			blk(Vector3(p[0] - 0.48, WATER + 0.16, p[1] - 0.48), Vector3(p[0] + 0.48, WATER + 0.22, p[1] + 0.48), "shade").material_override = pal("shade", "flat")
			var ms := mirror_stand(Vector3(p[0], WATER + 0.22, p[1]), yaw, self, WATER, m[3], true); ms.scale = Vector3.ONE * float(m[4])
		var cl := _gsw([118.6, -5.2, 118.6, -5.2], sw); column(Vector3(cl[0], WATER - 0.5, cl[1]), 2.2, 0.17, true)
		var c2 := _gsw([119.2, -1.6, 119.2, -1.6], sw); column(Vector3(c2[0], WATER - 0.5, c2[1]), 1.1, 0.17, true)
		var rk := _gsw([119.4, -7.4, 119.4, -7.4], sw); rock(Vector3(rk[0], 0, rk[1]), 1.3)
		var fl := _gsw([118.2, 1.0, 118.2, 1.0], sw); _gh_float_lamp(Vector3(fl[0], WATER, fl[1]))
	# before the square: a rock with a broken column and a cypress, the boat at its mooring, a statue half drowned, jars afloat
	rock(Vector3(118.4, 0, 9.6), 1.6)
	blk(Vector3(117.5, WATER - 0.4, 8.8), Vector3(119.3, WATER + 0.18, 10.4), "stone").material_override = pal("stone", "flat")
	column(Vector3(118.0, WATER + 0.18, 9.3), 1.5, 0.15, true); thing("cypress", Vector3(118.8, WATER + 0.18, 10.0), 2.0, "leaf:cyp~,trunk:trunk")
	var bt := Node3D.new(); bt.position = Vector3(115.6, WATER, 9.4); bt.rotation.y = -PI * 0.2; add_child(bt); build_boat(bt)
	cyl(Vector3(116.6, WATER - 0.4, 8.6), 0.07, 0.07, 1.25, pal("trunk", "flat"), 8); cyl(Vector3(116.6, WATER + 0.85, 8.6), 0.085, 0.06, 0.07, pal("gold", "flat"), 8)
	thing("broken_statue", Vector3(104.0, WATER - 0.7, 9.4), 2.6, "stone:marble", 2.4)
	for a in [[113.2, 8.6, 0.6], [108.6, 10.4, 1.9], [120.6, 4.8, 2.6]]:
		var am := thing("amphora", Vector3(a[0], WATER - 0.16, a[1]), 0.5, "terra:terra,band:wood", a[2]); am.rotation = Vector3(1.2, a[2], 0.3)
	for p in [Vector3(115.8, WATER, 11.2), Vector3(103.0, WATER, 7.6), Vector3(117.6, WATER, -8.6), Vector3(120.4, WATER, 7.4)]: thing("reeds", p, 0.0, "leaf:leaf~,trunk:wood~,pad:leaf2,flower:rose", p.x * 0.9 + p.z * 1.7, 0.95)

func _gh_flame_on(n: Node3D, p: Vector3, k: float) -> void:
	cyl(p, 0.12 * k, 0.0, 0.36 * k, mat(Color("ffb648")), 8, n).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cyl(p, 0.065 * k, 0.0, 0.24 * k, mat(Color("fff0b8")), 8, n).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## (she sets out from the near corner)
func _gh_begin() -> void:
	_wake_now(); pos = Vector3(113.6, 0.0, 3.6); yaw = PI * 1.25; cam_t = GH_MID_PT
	cam_focus = GH_MID_PT; cam_focus_on = true
	# every written thing: white, with a dark shade behind it
	for ql in quote_lbls:
		var l := ql as Label
		var o := l.get_theme_constant("outline_size")
		if o == 0: l.add_theme_color_override("font_color", Color(1, 1, 1, 1))
		elif l.material != null: l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0))
		else: l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.16))
	hint.add_theme_color_override("font_color", Color(1, 1, 1, 1)); hint.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.72)); hint.add_theme_constant_override("outline_size", 10)

func _gh_write(text: String, hold := 5.5) -> void:
	for ql in quote_lbls: (ql as Label).text = text
	var qt := create_tween(); qt.tween_property(quote_box, "modulate:a", 1.0, 0.5); qt.tween_interval(hold); qt.tween_property(quote_box, "modulate:a", 0.0, 0.7)
	quote_glow.modulate.a = 1.0

func _gh_pre(_dt: float) -> void:
	pos.y = 0.0

## how far the slab is out of its gap now (0: in it)
func _gh_slab_off() -> float:
	return float(gh.slab_out) if bool(gh.slab_held) else 1.7 * (0.5 - 0.5 * cos(float(gh.slab_t) * TAU / 9.0))

func _gh_post(dt: float) -> void:
	cam_focus = GH_MID_PT; cam_focus_on = true
	if started:
		gh_t += dt
		if not gh_said.has("rule") and gh_t > 1.2: gh_said["rule"] = true; _gh_write("What is looked at,\nstays.")
		if not gh_said.has("hint") and gh_t > 9.0 and not gh_said.has("tapped"): gh_said["hint"] = true; say("tap a statue")
	# the deck turns, and the slabs drift, while nothing looks at them
	if not bool(gh.deck_held): gh.deck = fmod(float(gh.deck) + 18.0 * dt, 360.0)
	(N["ghdeck"] as Node3D).rotation.y = deg_to_rad(float(gh.deck))
	if not bool(gh.slab_held): gh.slab_t = float(gh.slab_t) + dt
	var off := _gh_slab_off()
	(N["ghslab"] as Node3D).position = Vector3(106.4 - off, sin(gh_t * 0.9) * 0.03 * minf(off, 1.0), 0.0)
	(N["ghslab"] as Node3D).rotation = Vector3(0.0, sin(gh_t * 0.4) * 0.12 * minf(off, 1.0), sin(gh_t * 0.7) * 0.05 * minf(off, 1.0))
	var o2 := 0.9 + 0.5 * sin(gh_t * 0.55)
	(N["ghslab2"] as Node3D).position = Vector3(111.5 + o2 * 0.4, sin(gh_t * 0.8) * 0.03, -3.6 - o2 * 1.4); (N["ghslab2"] as Node3D).rotation = Vector3(0.05 * sin(gh_t * 0.6), 0.3 + 0.15 * sin(gh_t * 0.3), 0.04)
	for f in gh_flies:
		var t := gh_t * float(f.sp) + float(f.ph)
		(f.n as Node3D).position = (f.c as Vector3) + Vector3(cos(t) * float(f.r), sin(t * 1.7) * 0.35, sin(t * 0.8) * float(f.r))
		(f.n as Node3D).scale = Vector3.ONE * (0.55 + 0.45 * sin(t * 3.1 + float(f.ph)))
	if not ended and not flags.get("gh_end", false) and Vector3(pos.x, 0, pos.z).distance_to(Vector3(106.6, 0, -3.4)) < 0.7: _gh_end()

func _gh_end() -> void:
	flags["gh_end"] = true
	print("GH through the gate")
	route.clear(); route.append({"p": Vector3(106.4, 0, -3.6)})
	await wait(1.4)
	_end()

## a statue looks (its veil comes off), or stops looking (it goes back on): what it looks at stands still, or is let go
func _gh_toggle(id: String) -> void:
	var s: Dictionary = gh_st[id]
	if bool(s.tied): say("its veil is tied fast"); await _her_no(); return
	gh.busy = true; gh_said["tapped"] = true
	face_to = s.head
	var lean := tw(); lean.tween_property(self, "a_lean", 0.12, 0.3)
	await lean.finished
	s.looks = not bool(s.looks)
	var v: Node3D = s.veil
	if bool(s.looks):
		var vt := create_tween(); vt.tween_property(v, "scale", Vector3(1.0, 0.02, 1.0), 0.45).set_trans(Tween.TRANS_SINE); vt.tween_callback(v.hide)
		(s.statue as Node3D).show(); (s.fold as Node3D).show()
	else:
		v.show(); var vt2 := create_tween(); vt2.tween_property(v, "scale", Vector3.ONE, 0.45).set_trans(Tween.TRANS_SINE)
		(s.fold as Node3D).hide()
		await vt2.finished
		(s.statue as Node3D).hide()
	for b in s.beams: (b as Node3D).visible = bool(s.looks)
	if id == "R": _gh_hold_deck(bool(s.looks))
	elif id == "N": _gh_hold_slab(bool(s.looks))
	var back := tw(); back.tween_property(self, "a_lean", 0.0, 0.4)
	await back.finished
	print("GH statue ", id, " looks: ", s.looks, " | deck ", snappedf(float(gh.deck), 0.1), " held ", gh.deck_held, " | slab out ", snappedf(_gh_slab_off(), 0.01), " held ", gh.slab_held, " | bridge ", rects["GHbridge"].on, " gap ", rects["GHgap"].on)
	gh.busy = false

func _gh_hold_deck(on: bool) -> void:
	gh.deck_held = on
	(N["ghdeck_held"] as Node3D).visible = on
	lights[2] = Vector4(110.0, 0.2, 0.0, 0.6 if on else 0.0)
	rects["GHbridge"].on = false
	if not on: return
	var a := float(gh.deck); var a2 := roundf(a / 90.0) * 90.0
	if absf(a - a2) < 25.0:      # (near enough: it settles there)
		var stw := create_tween(); stw.tween_property(self, "gh:deck", a2, 0.4)
		stw.tween_callback(func() -> void: gh.deck = fmod(a2 + 360.0, 360.0))
		await stw.finished
		if int(roundf(a2 / 90.0)) % 2 == 0: rects["GHbridge"].on = true      # the bridge lies across, from the right-hand road to the gap

func _gh_hold_slab(on: bool) -> void:
	var off := _gh_slab_off()
	gh.slab_held = on; gh.slab_out = off
	(N["ghslab_held"] as Node3D).visible = on
	lights[3] = Vector4(106.4, 0.2, 0.0, 0.55 if on else 0.0)
	rects["GHgap"].on = false
	if not on:      # (let go: it drifts on from where it was)
		gh.slab_t = acos(clampf(1.0 - 2.0 * off / 1.7, -1.0, 1.0)) * 9.0 / TAU
		return
	if off < 0.4:
		var stw := create_tween(); stw.tween_property(self, "gh:slab_out", 0.0, 0.35)
		await stw.finished
		rects["GHgap"].on = true

## a tap: a statue (she goes to it, and takes its veil off or puts it back), the gate, or a place to walk to
func _gh_tap(sp: Vector2) -> void:
	if busy or bool(gh.busy): return
	var px := get_viewport().get_visible_rect().size.x / 720.0
	for id in gh_st:
		var s: Dictionary = gh_st[id]
		var hp := s.head as Vector3
		if cam.unproject_position(hp - Vector3(0, 1.0, 0)).distance_to(sp) < 70.0 * px or cam.unproject_position(hp).distance_to(sp) < 60.0 * px:
			var stand: Vector3 = s.stand
			if _flat(pos, stand) < 0.45: _gh_toggle(id); return
			var pts := find_path(Vector3(pos.x, 0, pos.z), stand)
			if pts.is_empty(): if bool(s.tied): say("its veil is tied fast"); await _her_no(); return
			if pts.is_empty(): await _her_no(); return
			gh.busy = true
			route.clear(); speed_cap = PLAY_WALK; face_to = null
			for q in pts: route.append({"p": Vector3(q.x, 0, q.z)})
			while not route.is_empty(): await get_tree().process_frame
			gh.busy = false
			_gh_toggle(id); return
	var to = null
	if cam.unproject_position(Vector3(106.4, 1.6, -3.6)).distance_to(sp) < 70.0 * px: to = Vector3(106.6, 0, -3.4)
	else:
		var o := cam.project_ray_origin(sp); var dr := cam.project_ray_normal(sp)
		var a: Vector3 = o + dr * (-o.y / dr.y)
		var n := rect_of(Vector3(a.x, 0, a.z))
		if n.begins_with("GH"): to = Vector3(clampf(a.x, rects[n].x0 + 0.05, rects[n].x1 - 0.05), 0, clampf(a.z, rects[n].z0 + 0.05, rects[n].z1 - 0.05))
	if to == null: return
	var pts2 := find_path(Vector3(pos.x, 0, pos.z), to)
	if pts2.is_empty(): print("GH no way to ", to); await _her_no(); return
	tapring.position = Vector3(to.x, 0.04, to.z); tap_p = 0.0
	route.clear(); speed_cap = PLAY_WALK; face_to = null
	for q in pts2: route.append({"p": Vector3(q.x, 0, q.z)})

## (the trial, played through as a player would: FLIP=geo ... -- geodemo)
func _play_geo() -> void:
	var dir := OS.get_environment("SHOT_DIR")
	var snap := func(n: String) -> void:
		if dir != "": await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, n])
	var idle := func() -> void:
		var still := 0
		while still < 12:
			await get_tree().process_frame
			still = still + 1 if (not busy and not bool(gh.busy) and route.is_empty()) else 0
	var at := func(p: Vector3) -> Vector2: return cam.unproject_position(p)
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(5.5); await snap.call("p0_start")
	print("GH begins at ", pos)
	if OS.get_environment("GH_ONLY") == "start": get_tree().quit(); return
	# she cannot cross yet: the bridge does not lie across, and the slab is out at sea
	tap(at.call(Vector3(106.4, 0, -1.6))); await idle.call(); await wait(0.8)
	# 1: to the near statue; when the slab comes into its gap, its veil off: it looks into the mirror, and the slab stays
	tap(at.call(Vector3(110.0, 0, 3.85))); await idle.call()
	while _gh_slab_off() > 0.12: await get_tree().process_frame
	tap(at.call((gh_st["N"].head as Vector3) - Vector3(0, 1.0, 0))); await idle.call(); await wait(0.6); await snap.call("p1_slab_held")
	# 2: to the right-hand statue; when the bridge comes round, its veil off: the deck stays
	tap(at.call(Vector3(113.85, 0, 0.0))); await idle.call()
	while true:
		var m := fmod(float(gh.deck), 180.0)
		if m > 172.0 or m < 4.0: break
		await get_tree().process_frame
	tap(at.call((gh_st["R"].head as Vector3) - Vector3(0, 1.0, 0))); await idle.call(); await wait(0.6); await snap.call("p2_bridge_held")
	# 3: over the bridge, onto the slab, and through the gate
	tap(at.call(Vector3(106.4, 1.6, -3.6))); await wait(3.0); await snap.call("p3_crossing"); await idle.call()
	var n2 := 0
	while not ended and n2 < 900: await get_tree().process_frame; n2 += 1
	await wait(2.5)
	print("GH ended: ", ended); await snap.call("p9_end")
	get_tree().quit()

# ---------------------------------------------------------------- Eidolon GO: two worlds, one push (a trial)
## A court in the sea, seen from the front, cut across by a channel of still water. Beyond the water lies its eidolon:
## the same court, mirrored, in dark stone, and not quite the same. Every stone she pushes has its image over there, and
## the image moves as in a mirror (towards the water when the stone goes towards it, along with it when it goes along
## it), if its own way is free; if not, it stays where it is, and the two come apart. A stone and its image that come
## into the water at one place at one moment become one: a slab, on which she can cross; over there she pushes the
## images, and the stones follow them. Gold rings lie on both sides: when a stone stands on every ring of the court and
## an image on every ring of its eidolon, the gate rises out of the middle of the water, and she walks into its light.
## Maps, rows from the far side to the near: ' ' sea, '.' floor, '#' a column, '*' a ring, '@' she, 'A'.. stones,
## 'a'.. their images, '~' the channel, '=' a slab in it. "sol": the steps of a way through (x, z, w: a walk, p: a push).
const GO_D := 1.6
const GO_VIEW := 12.0
const MW_TOP := WATER + 1.7      # the floor of both courts: tall pillars out of the sea
const MW_NONE := Vector2i(-99, -99)
const MW_REACH := 0.42      # how far into her square she stands to set her hands on a stone
const MW_PITCH := 35.264
const MW_YAW := 45.0
const GO_LEVELS := [
	{"map": [".....", ".a...", "...*.", "~~~~~", "...*.", ".A...", ".@..."], "line": "What you move\nmoves in the water.",
		"sol": [[1, 5, "p"], [0, 5, "w"], [0, 4, "w"], [1, 4, "p"], [2, 4, "p"], [2, 3, "g"]]},
	{"map": [".....", ".a.#.", "..*..", "~~~~~", "...*.", ".A...", ".@..."], "line": "Over there, a wall\nholds only the image.",
		"sol": [[0, 6, "w"], [0, 5, "w"], [1, 5, "p"], [2, 5, "p"], [2, 6, "w"], [3, 6, "w"], [3, 5, "p"], [2, 5, "w"], [2, 4, "w"], [2, 3, "g"]]},
	{"map": [".....", ".a.b.", ".*#.*", "~~~~~", ".*.*.", ".A.B.", "..@.."], "line": "Two stones,\ntwo images.",
		"sol": [[3, 6, "w"], [3, 5, "p"], [4, 5, "w"], [4, 4, "w"], [3, 4, "p"], [2, 4, "p"], [2, 5, "w"], [2, 6, "w"], [1, 6, "w"], [0, 6, "w"], [0, 5, "w"], [0, 4, "w"], [1, 4, "p"], [2, 4, "p"], [2, 5, "w"], [2, 6, "w"], [1, 6, "w"], [1, 5, "p"], [2, 5, "w"], [2, 4, "w"], [2, 3, "g"]]},
	{"map": [".....", "..a.*", ".b...", "~~~~~", ".B.#.", "..A*.", "..@.."], "line": "A thing and its image\nbecome one.",
		"sol": [[2, 5, "p"], [1, 5, "w"], [1, 4, "p"], [1, 3, "w"], [1, 2, "w"], [2, 2, "p"], [2, 1, "w"], [3, 1, "w"], [4, 1, "w"], [4, 2, "w"], [3, 2, "p"], [3, 1, "w"], [2, 1, "w"], [1, 1, "w"], [1, 2, "w"], [1, 3, "w"], [1, 4, "p"], [0, 4, "w"], [0, 5, "w"], [1, 5, "p"], [2, 5, "p"], [2, 4, "w"], [2, 3, "g"]]},
	{"map": [" ..... ", "*.a.b.*", ".....c.", "~~~~~~~", ".....C.", "#.A.B.#", " *.@.* "], "line": "Over there,\nthe stones follow.",
		"sol": [[4, 6, "w"], [5, 6, "w"], [5, 5, "w"], [5, 4, "p"], [5, 3, "w"], [5, 2, "w"], [4, 2, "w"], [3, 2, "w"], [3, 1, "w"], [2, 1, "p"], [1, 1, "p"], [2, 1, "w"], [3, 1, "w"], [4, 1, "p"], [5, 1, "p"], [5, 2, "w"], [5, 3, "w"], [5, 4, "w"], [5, 5, "p"], [4, 5, "w"], [3, 5, "w"], [2, 5, "w"], [2, 4, "w"], [1, 4, "w"], [1, 5, "p"], [2, 5, "w"], [3, 5, "w"], [3, 4, "w"], [3, 3, "g"]]},
	{"map": [" .*.*. ", ".a...b.", "...c...", "~~~~~~~", "..C.#..", ".A...B.", " .*@*. "], "line": "Both worlds\nat once.",
		"sol": [[2, 6, "w"], [1, 6, "w"], [1, 5, "p"], [1, 4, "p"], [1, 3, "w"], [1, 2, "w"], [2, 2, "w"], [2, 1, "w"], [3, 1, "w"], [4, 1, "w"], [4, 2, "w"], [5, 2, "w"], [6, 2, "w"], [6, 1, "w"], [5, 1, "p"], [4, 1, "p"], [4, 2, "w"], [3, 2, "p"], [2, 2, "p"], [2, 1, "w"], [1, 1, "w"], [0, 1, "w"], [0, 2, "w"], [1, 2, "p"], [1, 3, "w"], [1, 4, "p"], [0, 4, "w"], [0, 5, "w"], [1, 5, "p"], [1, 4, "w"], [1, 3, "w"], [1, 2, "w"], [2, 2, "w"], [2, 1, "p"], [3, 1, "p"], [3, 2, "w"], [4, 2, "w"], [4, 1, "p"], [3, 1, "w"], [3, 2, "w"], [3, 3, "g"]]},
]
var gs := {}
var go_root: Node3D
var go_fade: ColorRect
var go_t := 0.0
var go_said := {}
var go_flies := []
var go_sea: Node3D
var go_lv_lbl: Label
var mw_push := {}      # the push under way: the stone she pushes follows her hands, its image follows it

func _go_cx(lv: int) -> float: return 190.0 + 40.0 * lv      # (clear of the square of the other trial, whose waters change the sea about it)
func _mw_p(v: Vector2i) -> Vector3:
	return Vector3(_go_cx(int(gs.lv)) + (v.x - (int(gs.W) - 1) * 0.5) * GO_D, MW_TOP, (v.y - int(gs.c)) * GO_D)
func _mw_side(v: Vector2i) -> int:
	return 0 if v.y == int(gs.c) else (1 if v.y > int(gs.c) else -1)
## what stands on a square: (pair, 0 a stone / 1 an image), or (-1, -1)
func _mw_at(v: Vector2i) -> Vector2i:
	for k in (gs.sb as Array).size():
		if gs.sb[k] == v: return Vector2i(k, 0)
		if gs.si[k] == v: return Vector2i(k, 1)
	return Vector2i(-1, -1)
func _mw_free(v: Vector2i, sd: int) -> bool:
	return (gs.floor as Dictionary).has(v) and _mw_side(v) == sd and _mw_at(v).x < 0
func _mw_full() -> bool:
	for r in gs.rings:
		if _mw_at(r).x < 0: return false
	return true
func _mw_walkable(v: Vector2i) -> bool:
	if v == gs.gate: return bool(gs.open)
	if (gs.chan as Dictionary).has(v): return (gs.slabs as Dictionary).has(v)
	return (gs.floor as Dictionary).has(v) and _mw_at(v).x < 0
func _mw_view() -> float: return (float(gs.get("W", 5)) + float(gs.get("H", 7))) * GO_D * 0.7071 + 0.9      # (the board is a diamond to the eye: so wide)
func _mw_focus() -> Vector3:
	return Vector3(_go_cx(int(gs.get("lv", 0))), MW_TOP, ((float(gs.get("H", 7)) - 1.0) * 0.5 - float(gs.get("c", 3))) * GO_D - 0.2)

## what a step of hers that way does: {} (nothing: it cannot be), a walk, a push, or a stone and its image made one
func _mw_try(d: Vector2i) -> Dictionary:
	var me: Vector2i = gs.me
	var q := me + d
	if q == gs.gate: return {"kind": "walk"} if bool(gs.open) else {}
	if (gs.chan as Dictionary).has(q): return {"kind": "walk"} if (gs.slabs as Dictionary).has(q) else {}
	if not (gs.floor as Dictionary).has(q): return {}
	var o := _mw_at(q)
	if o.x < 0: return {"kind": "walk"}
	var k := o.x; var which := o.y
	var tw: Vector2i = gs.si[k] if which == 0 else gs.sb[k]
	var q2 := q + d; var md := Vector2i(d.x, -d.y)
	var t2 := tw + md
	if (gs.chan as Dictionary).has(q2):
		if (gs.slabs as Dictionary).has(q2) or q2 == gs.gate or tw == MW_NONE or t2 != q2: return {}
		return {"kind": "merge", "k": k, "which": which, "q": q, "q2": q2, "tw": tw, "t2": t2, "d": d}
	if not _mw_free(q2, _mw_side(q)): return {}
	var nt := tw
	if tw != MW_NONE and _mw_free(t2, _mw_side(tw)): nt = t2
	return {"kind": "push", "k": k, "which": which, "q": q, "q2": q2, "tw": tw, "t2": nt, "d": d, "slip": tw != MW_NONE and nt == tw}

## her way to a square, over free floor and slabs (not through the gate: she goes into it only at the end of a way)
func _mw_path(a: Vector2i, b: Vector2i) -> Array:
	if not _mw_walkable(b): return []
	var prev := {a: a}
	var q := [a]
	while not q.is_empty():
		var v: Vector2i = q.pop_front()
		if v == b: break
		if v == gs.gate: continue
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var n: Vector2i = v + d
			if prev.has(n) or not _mw_walkable(n): continue
			prev[n] = v; q.append(n)
	if not prev.has(b): return []
	var path := []
	var v2 := b
	while v2 != a: path.push_front(v2); v2 = prev[v2]
	return path

func _mw_palettes() -> void:
	pals["eid"] = ["4d6c87", "3b5770", "304a62"]; pals["eid2"] = ["2e455b", "253a4e", "1e3143"]
	pals["eidst"] = ["8eb1c9", "7096b1", "5c819d"]; pals["eidband"] = ["dcf0f7", "b8d9e7", "93bbd0"]
	pals["block"] = ["efdfc0", "dcc49e", "a8969d"]
	pals["niche"] = ["6e5c4d", "5a4a3e", "493c33"]; pals["eidniche"] = ["1f3042", "1a283a", "152132"]
	pal("eid", "flat").set_shader_parameter("marble", 0.55); pal("eidst", "flat").set_shader_parameter("marble", 0.35)

func _go_build(lv: int) -> void:
	if go_root != null: go_root.queue_free()
	go_root = Node3D.new(); add_child(go_root)
	mw_push = {}
	var L: Dictionary = GO_LEVELS[lv]
	var rows: Array = L.map
	var H := rows.size(); var W := 0
	for r in rows: W = maxi(W, String(r).length())
	var c := -1
	for z in H:
		var s := String(rows[z]).strip_edges()
		if s != "" and s.replace("~", "").replace("=", "") == "": c = z; break
	gs = {"lv": lv, "W": W, "H": H, "c": c, "gate": Vector2i(W / 2, c), "floor": {}, "cols": {}, "rings": {}, "chan": {}, "slabs": {},
		"sb": [], "si": [], "me": Vector2i.ZERO, "open": false, "busy": false, "won": false, "hist": [], "nb": [], "ni": [], "ns": {}, "nr": {}, "pushes": 0}
	var bodies := {}; var images := {}
	for z in H:
		var row: String = rows[z]
		for x in row.length():
			var ch := row[x]; var v := Vector2i(x, z)
			if z == c:
				if ch == "~" or ch == "=": gs.chan[v] = true
				if ch == "=": gs.slabs[v] = true
				continue
			if ch == " ": continue
			if ch == "#": gs.cols[v] = true; continue
			gs.floor[v] = true
			if ch == "*": gs.rings[v] = true
			elif ch == "@": gs.me = v
			elif ch >= "A" and ch <= "Z": bodies[ch] = v
			elif ch >= "a" and ch <= "z": images[ch.to_upper()] = v
	var keys: Array = bodies.keys()
	for kk in images.keys():
		if not keys.has(kk): keys.append(kk)
	keys.sort()
	for kk in keys:
		gs.sb.append(bodies.get(kk, MW_NONE)); gs.si.append(images.get(kk, MW_NONE))
	var before := {}
	for ch in get_children(): before[ch] = true
	for v in (gs.floor as Dictionary).keys() + (gs.cols as Dictionary).keys(): _mw_tile(v)
	_mw_edges()
	for v in gs.cols: _mw_column(v)
	for v in gs.rings: gs.nr[v] = _mw_ring(v)
	for k in (gs.sb as Array).size():
		gs.nb.append(_mw_stone(gs.sb[k], false)); gs.ni.append(_mw_stone(gs.si[k], true))
		(gs.nb[k] as Node3D).visible = gs.sb[k] != MW_NONE; (gs.ni[k] as Node3D).visible = gs.si[k] != MW_NONE
	for v in gs.slabs: gs.ns[v] = _mw_slab(v)
	gs["gate_n"] = _mw_gate()
	_mw_around()
	var deco := Node3D.new(); go_root.add_child(deco)
	for ch in get_children():
		if before.has(ch) or not (ch is Node3D) or ch == go_root: continue
		(ch as Node3D).reparent(deco, true)
	pos = _mw_p(gs.me); route.clear(); face_to = null; yaw = PI * 0.92
	lights[6] = Vector4.ZERO
	_go_water_y(); _mw_rings(true)
	if go_lv_lbl != null: go_lv_lbl.text = "%d / %d" % [lv + 1, GO_LEVELS.size()]

## the courts' edges, dressed as the houses of the chapter are: along every edge that does not give onto the channel
## a balustrade (balusters with a belly, between a plinth and a rail, a post at each end), under the paving a moulding
## standing out of the face, and in the face of every pillar that looks out an arched window, dark, in a frame
func _mw_edges() -> void:
	var cells := {}
	for v in (gs.floor as Dictionary).keys() + (gs.cols as Dictionary).keys(): cells[v] = true
	var h := GO_D * 0.5
	for far in [false, true]:
		var wins := []
		var runs := {}      # the straight runs of edge: (which way it looks out, its line) -> the squares along it
		for v in cells:
			if (_mw_side(v) < 0) != far: continue
			var p := _mw_p(v)
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var nb: Vector2i = v + d
				if cells.has(nb) or (gs.chan as Dictionary).has(nb): continue
				var out := Vector3(d.x, 0, d.y); var al := Vector3(absf(float(d.y)), 0, absf(float(d.x)))
				var fc := p + out * h
				bb(fc - al * h + Vector3(0, -0.25, 0), fc + al * h + out * 0.05 + Vector3(0, -0.15, 0))      # the moulding
				bb(fc - al * h + Vector3(0, -0.3, 0), fc + al * h + out * 0.025 + Vector3(0, -0.25, 0))
				var ww := 0.26; var wy0 := -1.4; var wy1 := -0.88      # (the window low in the pillar's face)
				bb(fc - al * (ww + 0.07) + Vector3(0, wy0 - 0.07, 0), fc + al * (ww + 0.07) + out * 0.02 + Vector3(0, wy1, 0))      # its frame
				wins.append([fc, out, al, ww, wy0, wy1])
				var line: int = v.x if d.x != 0 else v.y
				var key: String = "%d,%d,%d" % [d.x, d.y, line]
				if not runs.has(key): runs[key] = {"d": d, "line": line, "a": []}
				(runs[key].a as Array).append(v.y if d.x != 0 else v.x)
		for key in runs:      # one balustrade along each run, unbroken: a post only where it ends
			var r: Dictionary = runs[key]
			var a: Array = r.a; a.sort()
			var st := 0
			for i in range(1, a.size() + 1):
				if i == a.size() or int(a[i]) != int(a[i - 1]) + 1:
					_mw_rail(cells, r.d, int(r.line), int(a[st]), int(a[i - 1])); st = i
		bb_end("eid" if far else "stone", go_root)
		for w in wins:      # the windows: dark, under a round head
			var fc: Vector3 = w[0]; var out: Vector3 = w[1]; var al: Vector3 = w[2]; var ww: float = w[3]
			bb(fc - al * ww + Vector3(0, float(w[4]), 0), fc + al * ww + out * 0.032 + Vector3(0, float(w[5]), 0))
		bb_end("eidniche" if far else "niche", go_root)
		for w in wins:
			var fc: Vector3 = w[0]; var out: Vector3 = w[1]; var ww: float = w[3]
			var fr := cyl(fc, ww + 0.07, ww + 0.07, 0.02, pal("eid" if far else "stone", "flat"), 20, go_root)
			var dk := cyl(fc, ww, ww, 0.02, pal("eidniche" if far else "niche", "flat"), 20, go_root)
			for c3 in [fr, dk]:      # (a disc turned to face out of the wall; only its upper half shows over the window)
				var ci := c3 as MeshInstance3D
				ci.position = fc + out * (0.01 if c3 == fr else 0.022) + Vector3(0, float(w[5]), 0)
				if absf(out.x) > 0.5: ci.rotation.z = PI * 0.5
				else: ci.rotation.x = PI * 0.5

## a balustrade along a straight run of edge: the squares a0..a1 of the line (a column for an edge that looks out
## along x, a row for one that looks out along z). At an outer corner it stops where the next run's line comes, at an
## inner one it goes on to meet it: so the runs join, and the rail goes round the court unbroken
func _mw_rail(cells: Dictionary, d: Vector2i, line: int, a0: int, a1: int) -> void:
	var h := GO_D * 0.5
	var ag := Vector2i(0, 1) if d.x != 0 else Vector2i(1, 0)      # along the run, in squares
	var c0 := Vector2i(line, a0) if d.x != 0 else Vector2i(a0, line); var c1 := Vector2i(line, a1) if d.x != 0 else Vector2i(a1, line)
	var out := Vector3(d.x, 0, d.y); var al := Vector3(ag.x, 0, ag.y)
	var ins := 0.13      # how far in from the edge the rail stands
	var s0 := _mw_p(c0) + out * (h - ins) - al * h; var s1 := _mw_p(c1) + out * (h - ins) + al * h
	s0 += al * (-ins if cells.has(c0 - ag) else ins); s1 += al * (ins if cells.has(c1 + ag) else -ins)
	var ln := (s1 - s0).dot(al)
	bb(s0 - out * 0.07, s1 + out * 0.07 + Vector3(0, 0.05, 0))      # the plinth
	bb(s0 - out * 0.08 + Vector3(0, 0.33, 0), s1 + out * 0.08 + Vector3(0, 0.39, 0))      # the rail
	var n := maxi(1, int(round((ln - 0.3) / 0.23)))
	for k in n + 1:      # the balusters: a foot, a belly, a neck
		var c := s0 + al * (0.15 + (ln - 0.3) * k / n)
		bb(c - al * 0.03 - out * 0.03 + Vector3(0, 0.05, 0), c + al * 0.03 + out * 0.03 + Vector3(0, 0.1, 0))
		bb(c - al * 0.045 - out * 0.045 + Vector3(0, 0.1, 0), c + al * 0.045 + out * 0.045 + Vector3(0, 0.22, 0))
		bb(c - al * 0.026 - out * 0.026 + Vector3(0, 0.22, 0), c + al * 0.026 + out * 0.026 + Vector3(0, 0.33, 0))
	for c2 in [s0, s1]:      # a post where it ends
		bb((c2 as Vector3) - al * 0.07 - out * 0.07, (c2 as Vector3) + al * 0.07 + out * 0.07 + Vector3(0, 0.43, 0))

## what lies about the courts, few things, strewn as if by chance and turned anyhow (each court its own way, the same
## each time): her boat, one mirror under its sheet, large, on a pillar of its own, and one rock worn into the shape of
## a strange statue (props/stat_*: made in Tripo, brought down to a few faces and flat colours), each with its picture
## on the water. Nothing is put where it would hide a square, the gate, or the words at the top
func _mw_around() -> void:
	var rng := RandomNumberGenerator.new(); rng.seed = 7919 + int(gs.lv) * 31
	var cells: Array = (gs.floor as Dictionary).keys() + (gs.cols as Dictionary).keys() + (gs.chan as Dictionary).keys()
	var placed := []
	var kinds := []
	for k in ["stat_hood", "stat_face", "stat_cairn", "stat_hand", "stat_monk", "stat_profile", "stat_balance"]:
		if FileAccess.file_exists("res://props/%s.glb" % k): kinds.append(k)
	var hgt := rng.randf_range(2.2, 3.3)
	var items := [["mirror", 4.9, 1.0], ["rock", hgt, 0.32 * hgt + 0.25], ["boat", 1.2, 1.7]]
	var ki := int(gs.lv) * 3 + rng.randi_range(0, 2)      # (a different one at each court)
	for it in items:
		var h: float = it[1]; var r: float = it[2]
		var p := Vector3.ZERO; var found := false
		for tries in 120:
			p = _mw_spot(rng)
			if _mw_spot_ok(p, h, r, cells, placed): found = true; break
		if not found: continue
		placed.append(Vector4(p.x, p.z, r, 0.0))
		var yw := rng.randf_range(-PI, PI)
		match String(it[0]):
			"mirror":
				var top := WATER + 0.95
				blk(p + Vector3(-0.8, -0.3, -0.8), Vector3(p.x + 0.8, top - 0.1, p.z + 0.8), "stone").material_override = _mw_flat("stone")
				blk(Vector3(p.x - 0.9, top - 0.14, p.z - 0.9), Vector3(p.x + 0.9, top, p.z + 0.9), "stone").material_override = _mw_flat("stone")
				var my: float = PI * 0.25 + rng.randf_range(0.45, 1.05) * (1.0 if rng.randf() < 0.5 else -1.0)      # turned anyhow, but never edge-on to the eye
				var ms := mirror_stand(Vector3(p.x, top, p.z), my, self, top, "tied", true); ms.scale = Vector3.ONE * 2.0
			"boat":
				var bt := Node3D.new(); bt.position = p; bt.rotation.y = yw; add_child(bt); build_boat(bt)
			"rock":
				if kinds.is_empty(): rock(Vector3(p.x, 0, p.z), h * 0.6); continue
				var n := Node3D.new(); n.position = p + Vector3(0, -0.25, 0); n.rotation.y = yw; add_child(n)
				prop_model(String(kinds[ki % kinds.size()]), n, h, 0.0, false, true, "")      # (with its picture on the water)
				ki += 1

## a place on the sea about the courts, anywhere within the picture
func _mw_spot(rng: RandomNumberGenerator) -> Vector3:
	var f := _mw_focus(); var view := _mw_view()
	var sx := rng.randf_range(-view * 0.5, view * 0.5)
	var sz := rng.randf_range(-view * 1.45, view * 1.45)      # (from far behind the courts to well before them)
	var ax := sx / 0.7071
	return Vector3(f.x + (sz + ax) * 0.5, WATER, f.z + (sz - ax) * 0.5)

## where a thing on the sea falls in the picture: across, and down
func _mw_scr(p: Vector3) -> Vector2: return Vector2((p.x - p.z) * 0.7071, (p.x + p.z) * 0.4082 - p.y * 0.8165)

## a thing of that height and girth may stand there: clear of the courts, hiding no square (nor the gate), whole in the
## picture and clear of the words at its top, not crowding what already stands about
func _mw_spot_ok(p: Vector3, h: float, r: float, cells: Array, placed: Array) -> bool:
	var sp := _mw_scr(p); var st := _mw_scr(p + Vector3(0, h, 0))
	for v in cells:
		var c := _mw_p(v)
		if Vector2(c.x - p.x, c.z - p.z).length() < GO_D * 0.75 + r + 0.7: return false
		if (c.x + c.z) >= (p.x + p.z): continue      # (nearer the eye than the thing: it cannot be hidden by it)
		var sc := _mw_scr(c)
		if absf(sc.x - sp.x) < r + 1.25 and sc.y > st.y - 0.7 and sc.y < sp.y + 0.4: return false
	var view := _mw_view(); var hh := view * 16.0 / 9.0 * 0.5
	var f := _mw_scr(_mw_focus()); var cy := f.y - 1.9
	if absf(sp.x - f.x) > view * 0.5 - r - 0.2: return false
	if st.y < cy - hh + view * 0.42 or sp.y > cy + hh - 0.8: return false
	for q in placed:
		if Vector2(q.x - p.x, q.y - p.z).length() < float(q.z) + r + 1.1: return false
	return true

## the stone of the courts, with its veins, and its picture on the water as everything has it
func _mw_flat(n: String) -> ShaderMaterial: return pal(n, "flat")

## a square of the floor: a pillar out of the sea, of the very stone of the slab it carries (shaded as the slab is),
## paved; over there in the dark stone of the eidolon
func _mw_tile(v: Vector2i) -> void:
	var p := _mw_p(v); var far := _mw_side(v) < 0
	var h := GO_D * 0.5
	blk(p + Vector3(-h, WATER - 0.3 - MW_TOP, -h), p + Vector3(h, -0.1, h), "stone", go_root).material_override = _mw_flat("eid" if far else "stone")
	blk(p + Vector3(-h + 0.035, -0.14, -h + 0.035), p + Vector3(h - 0.035, 0.0, h - 0.035), "stone", go_root).material_override = _mw_flat("eid" if far else "stone")

## a column, broken: a plinth and two drums
func _mw_column(v: Vector2i) -> void:
	var p := _mw_p(v); var far := _mw_side(v) < 0
	var m := _mw_flat("eid" if far else "stone"); var m2 := _mw_flat("eid2" if far else "shade")
	blk(p + Vector3(-0.5, 0.0, -0.5), p + Vector3(0.5, 0.18, 0.5), "shade", go_root).material_override = m2
	cyl(p + Vector3(0, 0.18, 0), 0.36, 0.33, 0.66, m, 16, go_root)
	var d2 := cyl(p + Vector3(0.03, 0.85, 0.02), 0.33, 0.31, 0.42, m, 16, go_root); d2.rotation = Vector3(0.05, 0.3, -0.04)

func _mw_ring(v: Vector2i) -> Node3D:
	var r := Node3D.new(); r.position = _mw_p(v) + Vector3(0, 0.006, 0); go_root.add_child(r)
	var a := 0.64; var w := 0.11      # (half its side, and the width of its band: it shows round a stone set on it)
	for e in [[Vector3(-a, 0, -a), Vector3(a, 0.012, -a + w)], [Vector3(-a, 0, a - w), Vector3(a, 0.012, a)], [Vector3(-a, 0, -a + w), Vector3(-a + w, 0.012, a - w)], [Vector3(a - w, 0, -a + w), Vector3(a, 0.012, a - w)]]:
		var b := MeshInstance3D.new(); b.mesh = _box((e[1] as Vector3) - (e[0] as Vector3)); b.position = ((e[0] as Vector3) + (e[1] as Vector3)) * 0.5
		b.material_override = mat(Color("d9a648")); b.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; r.add_child(b)
	return r

## a stone: a block with a band of bronze. Its image over there: the same, in the pale glass of the eidolon
func _mw_stone(v: Vector2i, img: bool) -> Node3D:
	var n := Node3D.new(); go_root.add_child(n)
	n.position = _mw_p(v) if v != MW_NONE else Vector3.ZERO
	var body := "eidst" if img else "block"
	blk(Vector3(-0.5, 0.0, -0.5), Vector3(0.5, 0.94, 0.5), "stone", n).material_override = _mw_flat(body)
	blk(Vector3(-0.52, 0.32, -0.52), Vector3(0.52, 0.43, 0.52), "gold", n).material_override = _mw_flat("eidband" if img else "gold")
	blk(Vector3(-0.44, 0.94, -0.44), Vector3(0.44, 0.985, 0.44), "shade", n).material_override = _mw_flat(body)
	return n

## a slab in the water, where a stone and its image became one: a seam of gold across it
func _mw_slab(v: Vector2i) -> Node3D:
	var n := Node3D.new(); n.position = _mw_p(v); go_root.add_child(n)
	var h := GO_D * 0.5 - 0.06
	blk(Vector3(-h, WATER - 0.3 - MW_TOP, -h), Vector3(h, -0.1, h), "stone", n).material_override = _mw_flat("block")
	blk(Vector3(-h + 0.03, -0.14, -h + 0.03), Vector3(h - 0.03, 0.0, h - 0.03), "stone", n).material_override = _mw_flat("block")
	blk(Vector3(-h + 0.03, -0.004, -0.035), Vector3(h - 0.03, 0.004, 0.035), "gold", n).material_override = _mw_flat("gold")
	return n

## the gate: an arch of the same stone under a pediment, its opening only light, on a footing in the middle of the
## water. It waits under the sea until every ring is filled
func _mw_gate() -> Node3D:
	var g := Node3D.new(); g.position = _mw_p(gs.gate) + Vector3(0, -6.5, 0); go_root.add_child(g)
	var h := GO_D * 0.5 - 0.06
	blk(Vector3(-h, WATER - 0.3 - MW_TOP, -h), Vector3(h, -0.1, h), "stone", g).material_override = _mw_flat("stone")
	blk(Vector3(-h + 0.03, -0.14, -h + 0.03), Vector3(h - 0.03, 0.0, h - 0.03), "stone", g).material_override = _mw_flat("stone")
	var an := Node3D.new(); an.position = Vector3(0, 0, -0.45); g.add_child(an)
	var st := func(a: Vector3, b: Vector3, m := "stone") -> void: blk(a, b, m, an).material_override = pal(m, "flat")
	st.call(Vector3(-0.78, 0.0, -0.22), Vector3(0.78, 0.1, 0.22), "shade")
	for sx in [-1.0, 1.0]:      # the two piers, with a capital and a base
		st.call(Vector3(sx * 0.62 - 0.17, 0.1, -0.17), Vector3(sx * 0.62 + 0.17, 1.55, 0.17))
		st.call(Vector3(sx * 0.62 - 0.21, 0.1, -0.21), Vector3(sx * 0.62 + 0.21, 0.22, 0.21), "shade")
		st.call(Vector3(sx * 0.62 - 0.21, 1.55, -0.21), Vector3(sx * 0.62 + 0.21, 1.66, 0.21), "shade")
	for m in 9:      # the round of the arch, in nine stones
		var a0 := PI * (m + 0.5) / 9.0
		var vb := MeshInstance3D.new(); vb.mesh = _box(Vector3(0.36, 0.17, 0.34)); vb.material_override = pal("stone", "flat"); an.add_child(vb)
		vb.position = Vector3(-cos(a0) * 0.55, 1.66 + sin(a0) * 0.55, 0); vb.rotation.z = a0 - PI * 0.5
	st.call(Vector3(-0.8, 1.66, -0.2), Vector3(-0.55, 2.3, 0.2)); st.call(Vector3(0.55, 1.66, -0.2), Vector3(0.8, 2.3, 0.2))
	st.call(Vector3(-0.86, 2.3, -0.24), Vector3(0.86, 2.48, 0.24), "shade")
	var pd := PrismMesh.new(); pd.size = Vector3(1.8, 0.48, 0.44)
	var pm := MeshInstance3D.new(); pm.mesh = pd; pm.material_override = pal("stone", "flat"); pm.position = Vector3(0, 2.72, 0); an.add_child(pm)
	var lm := StandardMaterial3D.new(); lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; lm.albedo_color = Color("ffd66e"); lm.cull_mode = BaseMaterial3D.CULL_DISABLED
	var lq := QuadMesh.new(); lq.size = Vector2(0.9, 1.56)
	var l1 := MeshInstance3D.new(); l1.mesh = lq; l1.material_override = lm; l1.position = Vector3(0, 0.1 + 0.78, 0); an.add_child(l1)
	var ld := CylinderMesh.new(); ld.top_radius = 0.45; ld.bottom_radius = 0.45; ld.height = 0.02; ld.radial_segments = 20
	var l2 := MeshInstance3D.new(); l2.mesh = ld; l2.material_override = lm; l2.position = Vector3(0, 1.66, 0); l2.rotation.x = PI * 0.5; an.add_child(l2)
	for mi in [l1, l2]: (mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var glow := SphereMesh.new(); glow.radius = 1.0; glow.height = 2.0; glow.radial_segments = 14; glow.rings = 7
	prim(glow, Vector3(0, 1.1, 0), mat(Color(1.0, 0.82, 0.45, 0.1), true), an).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return g

## the rings: lit where something stands on them. All filled: the gate rises (and goes down again if one is left)
func _mw_rings(instant := false) -> void:
	for v in gs.nr:
		var on := _mw_at(v).x >= 0
		for b in (gs.nr[v] as Node3D).get_children(): (b as MeshInstance3D).material_override = mat(Color("fff0b4") if on else Color("d9a648"))
	var full := _mw_full()
	if full == bool(gs.open) and not instant: return
	gs.open = full
	var g: Node3D = gs.gate_n
	var to := MW_TOP if full else MW_TOP - 6.5
	var gp := _mw_p(gs.gate)
	if instant:
		g.position.y = to; g.visible = full; lights[6] = Vector4(gp.x, MW_TOP + 1.1, gp.z - 0.45, 0.95) if full else Vector4.ZERO
		return
	g.visible = true      # (down there it is hidden: the sea is clear enough to show a pale ghost of it)
	if full:
		print("GO the rings are filled: the gate rises")
		if not go_said.has("gate"): go_said["gate"] = true; say("the gate rises")
		lights[6] = Vector4(gp.x, MW_TOP + 1.1, gp.z - 0.45, 0.95)
	else:
		lights[6] = Vector4.ZERO
	var t := create_tween(); t.tween_property(g, "position:y", to, 1.8 if full else 1.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if not full: t.tween_callback(func() -> void: if not bool(gs.open): g.visible = false)

## the sea's own picture of things lies on the sea where it stands
func _go_water_y() -> void:
	var y := go_sea.position.y
	RenderingServer.global_shader_parameter_set("sea_y", y)
	if refl_mat != null: refl_mat.set_shader_parameter("water_y", y)
	for dct in [H, SHP]:
		if not dct.has("main"): continue
		for mm in (dct["main"].holder as Node).find_children("*", "MeshInstance3D", true, false):
			var mi := mm as MeshInstance3D
			var ms := [mi.material_override]
			if mi.mesh != null:
				for si in mi.mesh.get_surface_count(): ms.append(mi.get_surface_override_material(si))
			for m in ms:      # her picture on the sea: dark, as all pictures are
				if m is ShaderMaterial and (m as ShaderMaterial).next_pass is ShaderMaterial:
					var rp := (m as ShaderMaterial).next_pass as ShaderMaterial
					rp.set_shader_parameter("water_y", y); rp.set_shader_parameter("use_tex", 0.0); rp.set_shader_parameter("fade_a", 1.0)

func _go_begin() -> void:
	_wake_now()
	if go_iv: _iv_begin(); return
	for ch in get_children():
		if ch is MeshInstance3D and (ch as MeshInstance3D).material_override == sea_mat: go_sea = ch
	if go_sea == null: go_sea = Node3D.new(); go_sea.position.y = WATER; add_child(go_sea)
	_mw_palettes()
	for fm in fogs: (fm as ShaderMaterial).set_shader_parameter("dens", 0.0)      # (the world's low mist lay over the first court only, and through the pillars: here the air is clear)
	for ql in quote_lbls:
		var l := ql as Label
		var o := l.get_theme_constant("outline_size")
		if o == 0: l.add_theme_color_override("font_color", Color(1, 1, 1, 1))
		elif l.material != null: l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0))
		else: l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.16))
	hint.add_theme_color_override("font_color", Color(1, 1, 1, 1)); hint.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.72)); hint.add_theme_constant_override("outline_size", 10)
	var cl := CanvasLayer.new(); cl.layer = 0; add_child(cl)
	var vg := Gradient.new(); vg.offsets = PackedFloat32Array([0.0, 0.36, 0.72, 1.0])
	vg.colors = PackedColorArray([Color(0.02, 0.04, 0.1, 0), Color(0.02, 0.04, 0.1, 0), Color(0.02, 0.04, 0.1, 0.16), Color(0.02, 0.04, 0.1, 0.42)])      # (gentle: only the corners darken)
	var vt := GradientTexture2D.new(); vt.gradient = vg; vt.fill = GradientTexture2D.FILL_RADIAL; vt.fill_from = Vector2(0.5, 0.47); vt.fill_to = Vector2(1.2, 0.47); vt.width = 256; vt.height = 256
	var vr := TextureRect.new(); vr.texture = vt; vr.stretch_mode = TextureRect.STRETCH_SCALE; vr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vr.set_anchors_preset(Control.PRESET_FULL_RECT); vr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(vr)
	var cl2 := CanvasLayer.new(); cl2.layer = 5; add_child(cl2)
	go_fade = ColorRect.new(); go_fade.color = Color(0.03, 0.05, 0.1, 0.0); go_fade.set_anchors_preset(Control.PRESET_FULL_RECT); go_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl2.add_child(go_fade)
	var mk := func(t: String, x0: float) -> Button:
		var b := Button.new(); b.text = t; b.flat = true; b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 54); b.add_theme_color_override("font_color", Color(1, 1, 1, 0.85)); b.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6)); b.add_theme_constant_override("outline_size", 8)
		b.anchor_left = 1.0; b.anchor_right = 1.0; b.offset_left = x0; b.offset_right = x0 + 86; b.offset_top = 24; b.offset_bottom = 110
		cl2.add_child(b)
		return b
	(mk.call("↺", -110.0) as Button).pressed.connect(func() -> void:
		if started and not ended and not busy and not bool(gs.busy) and not bool(gs.won): _go_again())
	(mk.call("↶", -206.0) as Button).pressed.connect(func() -> void:
		if started and not ended: _mw_undo())
	go_lv_lbl = Label.new(); go_lv_lbl.position = Vector2(30, 40); go_lv_lbl.add_theme_font_size_override("font_size", 34)
	go_lv_lbl.add_theme_color_override("font_color", Color(1, 1, 1, 0.9)); go_lv_lbl.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6)); go_lv_lbl.add_theme_constant_override("outline_size", 8)
	if hint.get_theme_font("font") != null: go_lv_lbl.add_theme_font_override("font", hint.get_theme_font("font"))
	cl2.add_child(go_lv_lbl)
	var rng := RandomNumberGenerator.new(); rng.seed = 11
	for k in 30:
		var sm := SphereMesh.new(); sm.radius = 0.035; sm.height = 0.07; sm.radial_segments = 6; sm.rings = 3
		var fm := prim(sm, Vector3.ZERO, mat(Color(1.0, 0.86, 0.5, 0.85), true)); fm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		go_flies.append({"n": fm, "c": Vector3(rng.randf_range(-7.0, 7.0), WATER + rng.randf_range(1.0, 3.6), rng.randf_range(-6.0, 6.0)), "ph": rng.randf_range(0.0, TAU), "r": rng.randf_range(0.5, 1.6), "sp": rng.randf_range(0.15, 0.4)})
	cam.rotation_degrees.y = MW_YAW; cam_pitch = MW_PITCH
	# her other bodies (in the sea, in the old pools, in the mirror wall): taken out of every picture for good. (Hiding
	# them is not enough: the old wings show the one in the sea again each frame, after the trial has hidden it)
	for dct in [H, SHP]:
		for hk in dct:
			if String(hk) == "main": continue
			for mm in (dct[hk].holder as Node).find_children("*", "MeshInstance3D", true, false): (mm as MeshInstance3D).layers = 0
	_go_build(clampi(int(OS.get_environment("GO_LV0")) - 1, 0, GO_LEVELS.size() - 1) if OS.get_environment("GO_LV0") != "" else 0)
	cam_t = _mw_focus(); cam_focus = cam_t; cam_focus_on = true

func _go_write(text: String, hold := 4.5) -> void:
	for ql in quote_lbls: (ql as Label).text = text
	var qt := create_tween(); qt.tween_property(quote_box, "modulate:a", 1.0, 0.5); qt.tween_interval(hold); qt.tween_property(quote_box, "modulate:a", 0.0, 0.7)
	quote_glow.modulate.a = 1.0

func _go_pre(_dt: float) -> void:
	if go_iv: _iv_pre(_dt); return
	if gs.is_empty(): return
	pos.y = MW_TOP

func _go_post(dt: float) -> void:
	if go_iv: _iv_post(dt); return
	for dct in [H, SHP]:      # no pool, no mirror wall, no picture on the sea here: of her bodies only her own
		for hk in dct:
			if String(hk) != "main": (dct[hk].holder as Node3D).visible = false
	cam_focus = _mw_focus(); cam_focus_on = true
	if not mw_push.is_empty():      # the stone goes before her hands; its image goes as in a mirror, or stays
		var dv: Vector3 = mw_push.d
		var pr := maxf(float(mw_push.prog), clampf((pos - (mw_push.start as Vector3)).dot(dv), 0.0, GO_D))
		mw_push.prog = pr
		(mw_push.mover as Node3D).position = (mw_push.m0 as Vector3) + dv * pr
		if bool(mw_push.has_tw):
			var tn: Node3D = mw_push.twin
			if bool(mw_push.slip): tn.position = (mw_push.t0 as Vector3) + (mw_push.md as Vector3) * (0.16 * sin(PI * pr / GO_D))
			else: tn.position = (mw_push.t0 as Vector3) + (mw_push.md as Vector3) * pr
		var face := (mw_push.mover as Node3D).position - dv * 0.52 + Vector3(0, 0.74, 0)
		var sd := Vector3(-dv.z, 0, dv.x) * 0.2
		tgtL = face + sd; tgtR = face - sd
	if started:
		go_t += dt
		var lk := "line%d" % int(gs.lv)
		if not go_said.has(lk) and go_t > 1.0: go_said[lk] = true; _go_write(String(GO_LEVELS[int(gs.lv)].line))
		if not go_said.has("hint") and go_t > 6.5 and int(gs.pushes) == 0: go_said["hint"] = true; say("tap a stone beside her to push it")
	for f in go_flies:
		var t := go_t * float(f.sp) + float(f.ph)
		(f.n as Node3D).position = Vector3(_go_cx(int(gs.get("lv", 0))), 0, 0) + (f.c as Vector3) + Vector3(cos(t) * float(f.r), sin(t * 1.7) * 0.35, sin(t * 0.8) * float(f.r))
		(f.n as Node3D).scale = Vector3.ONE * (0.55 + 0.45 * sin(t * 3.1 + float(f.ph)))

## a tap: on a square next to her (a step, or a push), or further off (she walks there, round what stands in the way)
func _go_tap(sp: Vector2) -> void:
	if go_iv: await _iv_tap(sp); return
	if busy or bool(gs.busy) or bool(gs.won): return
	var px := get_viewport().get_visible_rect().size.x / 720.0
	var best := MW_NONE; var bd := 70.0 * px
	for v in (gs.floor as Dictionary).keys() + (gs.chan as Dictionary).keys():
		var d2 := cam.unproject_position(_mw_p(v)).distance_to(sp)
		if d2 < bd: bd = d2; best = v
	if best == MW_NONE or best == gs.me: return
	var me: Vector2i = gs.me
	var d := best - me
	if absi(d.x) + absi(d.y) == 1:
		var r := _mw_try(d)
		if r.is_empty(): await _her_no(); return
		if String(r.kind) == "walk": await _mw_walk([best])
		else: await _mw_do_push(r)
		return
	var path := _mw_path(me, best)
	if path.is_empty(): await _her_no(); return
	await _mw_walk(path)

func _mw_walk(path: Array) -> void:
	gs.busy = true
	route.clear(); speed_cap = PLAY_WALK; face_to = null
	for v in path: route.append({"p": _mw_p(v)})
	gs.me = path[-1]
	while not route.is_empty(): await get_tree().process_frame
	gs.busy = false
	if gs.me == gs.gate: await _go_win()

func _mw_snap() -> Dictionary:
	return {"me": gs.me, "sb": (gs.sb as Array).duplicate(), "si": (gs.si as Array).duplicate(), "slabs": (gs.slabs as Dictionary).duplicate()}

## a push: she sets her hands on the stone (or on the image, over there) and walks it one square on
func _mw_do_push(r: Dictionary) -> void:
	gs.busy = true; gs.pushes = int(gs.pushes) + 1
	(gs.hist as Array).append(_mw_snap())
	var d: Vector2i = r.d
	var dv := Vector3(d.x, 0, d.y)
	var k: int = r.k; var which: int = r.which
	var merge := String(r.kind) == "merge"
	var twc: Vector2i = r.tw
	var start := _mw_p(gs.me) + dv * MW_REACH
	mw_push = {"d": dv, "md": Vector3(d.x, 0, -d.y), "start": start, "mover": gs.nb[k] if which == 0 else gs.ni[k], "twin": gs.ni[k] if which == 0 else gs.nb[k],
		"m0": _mw_p(r.q), "t0": _mw_p(twc) if twc != MW_NONE else Vector3.ZERO, "has_tw": twc != MW_NONE, "slip": bool(r.get("slip", false)), "prog": 0.0}
	gs.me = r.q
	if merge:
		gs.sb[k] = MW_NONE; gs.si[k] = MW_NONE
	elif which == 0:
		gs.sb[k] = r.q2; gs.si[k] = r.t2
	else:
		gs.si[k] = r.q2; gs.sb[k] = r.t2
	print("GO push ", r.q, " -> ", r.q2, (" (made one with its image)" if merge else (" (its image held)" if bool(r.get("slip", false)) else "")))
	route.clear(); speed_cap = 1.6; face_to = null
	if _flat(pos, start) > 0.06: route.append({"p": start})
	route.append({"p": _mw_p(r.q) + dv * MW_REACH})
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.3); up.tween_property(self, "a_wR", 1.0, 0.3); up.tween_property(self, "a_lean", 0.14, 0.3)
	while not route.is_empty(): await get_tree().process_frame
	mw_push.prog = GO_D
	(mw_push.mover as Node3D).position = _mw_p(r.q2)
	if twc != MW_NONE: (mw_push.twin as Node3D).position = _mw_p(r.t2)
	mw_push = {}
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.35); dn.tween_property(self, "a_wR", 0.0, 0.35); dn.tween_property(self, "a_lean", 0.0, 0.35)
	if merge: await _mw_merge_fx(k, r.q2)
	_mw_rings()
	gs.busy = false

## a stone and its image meet in the water: they go down into it together, and a slab comes up where they met
func _mw_merge_fx(k: int, at: Vector2i) -> void:
	var p := _mw_p(at)
	var a: Node3D = gs.nb[k]; var b: Node3D = gs.ni[k]
	if not go_said.has("merge"): go_said["merge"] = true; say("a thing and its image, made one")
	var fm := StandardMaterial3D.new(); fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	fm.albedo_color = Color(1.0, 0.9, 0.62, 0.0)
	var sm := SphereMesh.new(); sm.radius = 1.0; sm.height = 2.0; sm.radial_segments = 16; sm.rings = 8
	var fl := prim(sm, p + Vector3(0, 0.5, 0), fm, go_root); fl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var sl := _mw_slab(at); sl.position.y = WATER - 2.6
	gs.ns[at] = sl
	var t := create_tween(); t.set_parallel()
	t.tween_property(fm, "albedo_color:a", 0.55, 0.35); t.tween_property(fm, "albedo_color:a", 0.0, 0.9).set_delay(0.35)
	t.tween_property(a, "position:y", WATER - 1.2, 1.1).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	t.tween_property(b, "position:y", WATER - 1.2, 1.1).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	t.tween_property(sl, "position:y", MW_TOP, 1.4).set_delay(0.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	await t.finished
	a.visible = false; b.visible = false; fl.queue_free()
	gs.slabs[at] = true

## one push taken back (with what she did since): all is put as it stood before it
func _mw_undo() -> void:
	if (gs.hist as Array).is_empty() or busy or bool(gs.busy) or bool(gs.won): return
	gs.busy = true
	var f := create_tween(); f.tween_property(go_fade, "color:a", 0.5, 0.16)
	await f.finished
	var s: Dictionary = (gs.hist as Array).pop_back()
	gs.me = s.me; gs.sb = s.sb; gs.si = s.si; gs.slabs = s.slabs
	for k in (gs.sb as Array).size():
		var a: Node3D = gs.nb[k]; var b: Node3D = gs.ni[k]
		a.visible = gs.sb[k] != MW_NONE; b.visible = gs.si[k] != MW_NONE
		if a.visible: a.position = _mw_p(gs.sb[k])
		if b.visible: b.position = _mw_p(gs.si[k])
	for v in (gs.ns as Dictionary).keys():
		if not (gs.slabs as Dictionary).has(v): (gs.ns[v] as Node).queue_free(); gs.ns.erase(v)
	for v in gs.slabs:
		if not (gs.ns as Dictionary).has(v): gs.ns[v] = _mw_slab(v)
	route.clear(); pos = _mw_p(gs.me); a_wL = 0.0; a_wR = 0.0; a_lean = 0.0
	_mw_rings(true)
	print("GO undo: back to ", gs.me)
	var f2 := create_tween(); f2.tween_property(go_fade, "color:a", 0.0, 0.25)
	await f2.finished
	gs.busy = false

func _go_again() -> void:
	gs.busy = true
	var f := create_tween(); f.tween_property(go_fade, "color:a", 1.0, 0.45)
	await f.finished
	_go_build(int(gs.lv))
	var f2 := create_tween(); f2.tween_property(go_fade, "color:a", 0.0, 0.45)
	await f2.finished

func _go_win() -> void:
	gs.won = true
	print("GO level ", int(gs.lv) + 1, " done, in ", int(gs.pushes), " pushes")
	route.clear(); speed_cap = 1.2; route.append({"p": _mw_p(gs.gate) + Vector3(0, 0, -0.95)})      # on through the arch, into its light
	var f0 := create_tween(); f0.tween_interval(0.5); f0.tween_property(go_fade, "color", Color(1.0, 0.93, 0.75, 0.0), 0.01)
	await wait(1.1)
	if int(gs.lv) + 1 >= GO_LEVELS.size():
		print("GO all levels done"); _end(); return
	var f := create_tween(); f.tween_property(go_fade, "color:a", 1.0, 0.7)
	await f.finished
	go_fade.color = Color(0.03, 0.05, 0.1, 1.0)
	_go_build(int(gs.lv) + 1)
	cam_t = _mw_focus(); go_t = 0.0
	create_tween().tween_property(cam, "size", _mw_view(), 0.6)
	var f2 := create_tween(); f2.tween_property(go_fade, "color:a", 0.0, 0.7)
	await f2.finished

## (the trial played through by its own solutions: FLIP=go ... -- godemo)
func _play_go() -> void:
	if go_iv: await _play_iv(); return
	var dir := OS.get_environment("SHOT_DIR")
	var snap := func(n: String) -> void:
		if dir != "": await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, n])
	var idle := func() -> void:
		var still := 0
		while still < 8:
			await get_tree().process_frame
			still = still + 1 if (not busy and not bool(gs.busy) and route.is_empty()) else 0
	var step := func(i: int, j: int) -> void:
		_go_tap(cam.unproject_position(_mw_p(Vector2i(i, j))))
		await get_tree().process_frame
		await idle.call()
		await wait(0.06)
	var next := func(lv: int) -> void:
		while go_fade.color.a > 0.01 or int(gs.lv) < lv: await get_tree().process_frame
		await wait(1.7)
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(4.5); await snap.call("t0_level1")
	print("GO begins at ", gs.me)
	var only := OS.get_environment("GO_LV")
	var n0 := 0
	if OS.get_environment("GH_ONLY") == "start": get_tree().quit(); return
	for lv in range(int(gs.lv), GO_LEVELS.size()):
		if n0 > 0: await next.call(lv); await snap.call("t%d_level%d" % [lv * 2, lv + 1])
		n0 += 1
		if only != "" and int(only) != lv + 1:      # (a run of one level: the others are skipped through)
			_go_win(); continue
		var sol: Array = GO_LEVELS[lv].sol
		var i := 0; var n := 0
		while i < sol.size():
			if String(sol[i][2]) == "w":
				while i + 1 < sol.size() and String(sol[i + 1][2]) == "w": i += 1
			var was_open := bool(gs.open)
			await step.call(int(sol[i][0]), int(sol[i][1])); i += 1; n += 1
			if n == 4: await snap.call("t%d_level%d_mid" % [lv * 2 + 1, lv + 1])
			if bool(gs.open) and not was_open: await wait(1.9); await snap.call("t%d_level%d_gate" % [lv * 2 + 1, lv + 1])
			if OS.get_environment("SHOT_EVERY") != "": await snap.call("s%d_%02d" % [lv + 1, n])
		if not bool(gs.won): print("GO level ", lv + 1, " NOT done: the way did not lead through")
	var n2 := 0
	while not ended and n2 < 900: await get_tree().process_frame; n2 += 1
	await wait(2.5)
	print("GO ended: ", ended); await snap.call("t9_end")
	get_tree().quit()

# ---------------------------------------------------------------- Eidolon GO, ivory (a trial of the look)
## One level in the look of the "ivory" picture (FLIP=goiv): refined low-poly marble in one hue, cliffs that sink into a
## mist of that same hue, the way drawn on the stone as pale lines between nodes. She walks it by taps: she turns the
## volute so that a pillar rises out of the mist to close the gap above, pushes the meander stone off the foot of the
## stair, and walks up into the ring of light. The fallen face beside the way is one of the thousand he carved.
var go_drown := OS.get_environment("FLIP") == "gosea" or OS.has_feature("gosea")      # the second level: the drowned sanctuary (gosea/), in the same system
var go_moon := OS.get_environment("FLIP") == "gomoon" or OS.has_feature("gomoon")      # the third level: the moon dial (gomoon/), a sanctuary in the snow at night
var go_quarry := OS.get_environment("FLIP") == "goquarry" or OS.has_feature("goquarry")      # the fourth level: the quarry (goquarry/), where the faces were cut
var go_wake := OS.get_environment("FLIP") == "gowake" or OS.has_feature("gowake")      # the first level: the waking (gowake/), dawn over a still sea
var iv_at_sea := go_drown or go_wake      # (a level standing in still water: the sea, the level's image in it)
var go_iv := OS.get_environment("FLIP") == "goiv" or OS.has_feature("goiv") or go_drown or go_moon or go_quarry or go_wake
var go_dir := "res://gowake/" if go_wake else ("res://gosea/" if go_drown else ("res://gomoon/" if go_moon else ("res://goquarry/" if go_quarry else "res://goiv/")))      # the level's own folder: its level.glb, level.json, puzzle.json
const IV_O := Vector3(460.0, 0.0, 0.0)      # (far from the world, and from the courts of the other trial)
const IV_T := 2.0      # from one node of the way to the next
const IV_PITCH := 37.0
const IV_VIEW := 10.5
const IV_Y := [0.0, 2.4, 4.8, 7.2]      # the four floors
const IV_KEY := Vector3(-0.33, 0.79, 0.51)      # where the light comes from: the tops brightest, the faces to the left lit, those to the right in shade
const IV_PAL := {      # top, lit face, face half turned away, face in shade (sampled from the picture)
	"marble": ["fdeccf", "f3d9b8", "dfc2a2", "c8a688"],
	"rock": ["dcc1a0", "c4a385", "987b62", "684d3e"],
	"olive": ["a3a067", "8e8c57", "6f6d43", "4f4c30"],
	"terra": ["dc6b4b", "c75a3e", "a8452f", "7c3022"],
	"pmarble": ["fde5c7", "dcbfa0", "b49680", "8e705c"],
	"pterra": ["c65a3e", "a84a33", "7f3a2a", "5c2b22"],
	"marble2": ["ffefd2", "f6d8b3", "d9b28d", "ad8664"],
	"phead": ["fff2dc", "f9e5c9", "e6ccb0", "bfa48c"],      # (the fallen face: as the picture's, near white, its shade a soft grey-brown)
	"rock2": ["aa8e76", "917460", "6b5244", "47342d"],      # (as the picture's rock: lit faces a mid brown, shaded ones dark)
	"olive2": ["b8986e", "a38564", "8b6f53", "765e45"],      # (the cypress, as the picture's: a khaki olive, darker than the rock's lit faces)
	"bark": ["9a5f48", "86513d", "6c4031", "4e2e24"],
	"far": ["f4dcc0", "eccfae", "e8c4a2", "deb795"],      # (far rock in the haze: warm, as the picture's, once the haze is over it)
	"far1": ["e6c9a9", "d3ae8c", "c29e7f", "a9886d"],
	"farsil": ["ecccaa", "e6c5a3", "e3bf9d", "d8b392"],      # (things far off seen against the light: little between their faces)
	"line": ["fff6e6", "fff6e6", "fff6e6", "fff6e6"],
	"groove": ["e9cfae", "e9cfae", "e9cfae", "e9cfae"],
	"ring": ["fffaf0", "fffaf0", "fffaf0", "fffaf0"],
}
const IV_BG := ["fff1d8", "f8dfbb", "d8ba98"]      # the mist: above, in the middle, below
const IV_SEA_PAL := {      # the drowned sanctuary at dusk: warm coral light on the faces toward the sun, cool blue-grey shade
	"marble2": ["dcd2d1", "d6b3ab", "9eaabd", "6f8299"],
	"rock2": ["7f8aa2", "ad8a89", "5c6d88", "3a4e6b"],
	"phead": ["e2d8d6", "d6b0a8", "9ea6b8", "6a7c93"],
	"far": ["9da1c2", "9399bb", "878eb2", "7c84a9"],
	"far1": ["9198b9", "868db1", "7a83a8", "6f799f"],
	"farsil": ["959bbd", "8c93b6", "838bb0", "7a83a9"],
	"seaface": ["d9cfd0", "cf9f96", "8890a8", "5b6d88"],
	"groove": ["d8c2bf", "d8c2bf", "d8c2bf", "d8c2bf"],
	"line": ["f7efec", "f7efec", "f7efec", "f7efec"],
}
const IV_SEA_BG := ["8a8db3", "ebb3a2", "a2a8c4", "7093a8"]      # the sky over the sea: high, at the horizon, the haze under it, the mist at the bottom
const IV_SEA_SKY_S := Vector3(0.185, 0.34, 0.84)      # (where on the screen, top to bottom, each of the last three is reached)
const IV_MOON_PAL := {      # the moon dial: a night in the snow under the moon. Snow on every top, pale blue marble, deep blue-violet rock; the moonlight from the left
	"marble2": ["e2edf9", "abc6e6", "8da5cc", "7083ab"],
	"rock2": ["c9dcf0", "56619a", "3f4a80", "2c3264"],      # (its tops under snow; as the picture's: the faces to the left a deep violet-blue, those to the right near navy)
	"phead": ["e8edf4", "d0d8e6", "a4afc6", "7c88a5"],
	"guard": ["e6f2fc", "bcd6ef", "8eaed6", "6a8aba"],      # (the frozen guardian: pale blue stone rimmed with frost)
	"snow": ["eef5fd", "dce8f6", "b8cbe6", "9bb2d8"],      # (the snow lying on the edges: white, its shade a soft blue)
	"far": ["e4eef9", "d6e5f6", "a6bfe2", "7f9bc9"],      # (far peaks: their lit sides snow, the shaded ones a soft blue)
	"far1": ["cddcf0", "bfd2ec", "98b2da", "7894c3"],
	"farsil": ["a5bfe0", "9fb9dc", "97b2d8", "8fabd3"],
	"bronze": ["e2bd78", "c4924c", "8e6236", "5f4128"],
	"silver": ["f4f7fb", "e2e9f2", "b8c5d8", "8e9db6"],
	"iron": ["59607a", "474d66", "353a50", "25283a"],
	"groove": ["a8bcd8", "a8bcd8", "a8bcd8", "a8bcd8"],
	"line": ["f1f7fe", "f1f7fe", "f1f7fe", "f1f7fe"],
	"ring": ["ffe6a6", "ffe6a6", "ffe6a6", "ffe6a6"],
}
const IV_MOON_BG := ["3a5486", "7e9ecb", "8eadd6", "86a7cf"]      # the night sky: high, low over the peaks, the haze under it, the mist at the bottom
const IV_MOON_SKY_S := Vector3(0.24, 0.46, 0.9)
const IV_QUARRY_PAL := {      # the quarry in the afternoon: marble cut white and warm, its shade a cool lilac; wood; bronze
	"quarry": ["f8f1e4", "ede1cc", "d2c4b0", "aaa0a4"],
	"marble2": ["f8f1e4", "ede1cc", "d2c4b0", "aaa0a4"],
	"phead": ["fdf8f0", "f2e8d8", "d6cab9", "afa4a4"],
	"wood": ["bd8f62", "9f734b", "7c5637", "573b27"],
	"bronze": ["ecc985", "cd9e55", "966a3b", "64462c"],
	"silver": ["f4f7fb", "e2e9f2", "b8c5d8", "8e9db6"],
	"groove": ["ded2be", "ded2be", "ded2be", "ded2be"],
	"line": ["fffaf0", "fffaf0", "fffaf0", "fffaf0"],
	"ring": ["ffd884", "ffd884", "ffd884", "ffd884"],
}
const IV_QUARRY_BG := ["a9bdd2", "f2dcbc", "ecdcc4", "e6d6c0"]      # the sky over the quarry: high, low, the dust in the air, the haze in the pit
const IV_QUARRY_SKY_S := Vector3(0.22, 0.46, 0.9)
const IV_WAKE_PAL := {      # the waking: dawn over a still sea. Pearl and rose marble, its shade lilac; warm mauve rock; the Observer pale in the haze
	"marble2": ["f3e2dc", "f6e6e1", "cdb7c2", "9d8599"],
	"rock2": ["c39f98", "93727c", "684a57", "4a3140"],
	"observer": ["fbf3f0", "efe0dd", "c9b1c0", "93799a"],
	"phead": ["f3e4df", "dcc4c4", "b9a0ad", "917b93"],
	"groove": ["e2cac6", "e2cac6", "e2cac6", "e2cac6"],
	"line": ["fff4ee", "fff4ee", "fff4ee", "fff4ee"],
	"ring": ["fff3e2", "fff3e2", "fff3e2", "fff3e2"],
	"bronze": ["f2d398", "d7a660", "9c6e40", "6b4a30"],
	"wood": ["b88d68", "96714f", "74533b", "533b2b"],
	"iron": ["6c5f6a", "554a55", "40373f", "2c262d"],
}
const IV_WAKE_BG := ["d7c3dd", "fbdcc8", "f5d8ce", "efcfc3"]      # the dawn: lilac above, peach at the sea's rim, the rose haze, the mist at the bottom
const IV_WAKE_SKY_S := Vector3(0.2, 0.33, 0.95)
func _iv_pal(kind: String) -> Array:
	if go_wake and IV_WAKE_PAL.has(kind): return IV_WAKE_PAL[kind] as Array
	if go_quarry and IV_QUARRY_PAL.has(kind): return IV_QUARRY_PAL[kind] as Array
	if go_moon and IV_MOON_PAL.has(kind): return IV_MOON_PAL[kind] as Array
	return (IV_SEA_PAL[kind] if (go_drown and IV_SEA_PAL.has(kind)) else IV_PAL[kind]) as Array
func _iv_sky(m: ShaderMaterial) -> void:      # the sky's colours (and the mist's, which is the sky at that height on the screen)
	if go_wake:
		m.set_shader_parameter("bg_top", Color(String(IV_WAKE_BG[0]))); m.set_shader_parameter("bg_hz", Color(String(IV_WAKE_BG[1])))
		m.set_shader_parameter("bg_mid", Color(String(IV_WAKE_BG[2]))); m.set_shader_parameter("bg_bot", Color(String(IV_WAKE_BG[3])))
		m.set_shader_parameter("sky4", 1.0); m.set_shader_parameter("sky_s", IV_WAKE_SKY_S)
	elif go_quarry:
		m.set_shader_parameter("bg_top", Color(String(IV_QUARRY_BG[0]))); m.set_shader_parameter("bg_hz", Color(String(IV_QUARRY_BG[1])))
		m.set_shader_parameter("bg_mid", Color(String(IV_QUARRY_BG[2]))); m.set_shader_parameter("bg_bot", Color(String(IV_QUARRY_BG[3])))
		m.set_shader_parameter("sky4", 1.0); m.set_shader_parameter("sky_s", IV_QUARRY_SKY_S)
	elif go_moon:
		m.set_shader_parameter("bg_top", Color(String(IV_MOON_BG[0]))); m.set_shader_parameter("bg_hz", Color(String(IV_MOON_BG[1])))
		m.set_shader_parameter("bg_mid", Color(String(IV_MOON_BG[2]))); m.set_shader_parameter("bg_bot", Color(String(IV_MOON_BG[3])))
		m.set_shader_parameter("sky4", 1.0); m.set_shader_parameter("sky_s", IV_MOON_SKY_S)
	elif go_drown:
		m.set_shader_parameter("bg_top", Color(String(IV_SEA_BG[0]))); m.set_shader_parameter("bg_hz", Color(String(IV_SEA_BG[1])))
		m.set_shader_parameter("bg_mid", Color(String(IV_SEA_BG[2]))); m.set_shader_parameter("bg_bot", Color(String(IV_SEA_BG[3])))
		m.set_shader_parameter("sky4", 1.0); m.set_shader_parameter("sky_s", IV_SEA_SKY_S); m.set_shader_parameter("sea_k", 1.0)
	else:
		for i in 3: m.set_shader_parameter(["bg_top", "bg_mid", "bg_bot"][i], Color(String(IV_BG[i])))
const IV_SH := """
shader_type spatial;
render_mode ambient_light_disabled, specular_disabled, cull_disabled;
uniform vec3 c_top : source_color = vec3(0.99, 0.93, 0.81);
uniform vec3 c_lit : source_color = vec3(0.95, 0.85, 0.72);
uniform vec3 c_mid : source_color = vec3(0.87, 0.76, 0.64);
uniform vec3 c_dark : source_color = vec3(0.78, 0.65, 0.53);
uniform vec3 bg_top : source_color = vec3(0.99, 0.92, 0.8);
uniform vec3 bg_mid : source_color = vec3(0.95, 0.84, 0.69);
uniform vec3 bg_bot : source_color = vec3(0.86, 0.74, 0.61);
uniform vec3 key_dir = vec3(-0.33, 0.79, 0.51);
uniform float fog_hi = -2.6;
uniform float fog_lo = -10.5;
uniform float fog_ref = 0.0;
uniform float far_k = 0.0;
uniform float veins = 0.0;
uniform float flat_mode = 0.0;
uniform float emit = 0.0;
uniform vec3 shade_tint : source_color = vec3(0.86, 0.79, 0.74);
uniform float uv_flip = 0.0;
uniform float alb_in_light = 0.0;
uniform float dbg = 0.0;
uniform float ao_k = 0.0;
uniform float dk = 0.0;
uniform float haze = 0.0;
uniform float bounce = 0.0;
uniform float sil = 0.0;      // (far off: a shape in the haze, its faces hardly told apart; no detail, only gradation)
uniform float lf_len = 1.9;
uniform float lfog = 0.0;      // (the level's own rock: its depth under the floor it bears is in COLOR.g, a quarter of a metre to one)
uniform float lf_hi = 0.5;
uniform float sea_k = 0.0;      // (a level at sea: the mist is the sea's colour where the sea lies behind, so what sinks into it leaves no edge)
uniform float clip_k = 0.0; uniform float clip_y = -1e9;      // (a level at sea: nothing under the water is drawn; the water shows a thing's image instead)
uniform float under_k = 0.0;      // (a thing that is under the water, or goes under it: drawn, fading into the sea by its depth under clip_y)
uniform float smooth_k = 0.0;      // (a statue: soft marble shaded by its own smooth normals, not in the facets' bands)
uniform float mirror_fade = 0.0; uniform float mirror_wob = 0.0;      // (an image in the water: gone into the sea by this depth; wavering by this much)
uniform float rim_k = 0.0; uniform vec3 rim_col : source_color = vec3(1.0, 0.86, 0.62); uniform vec3 rim_dir = vec3(-0.6, 0.3, -0.6);      // (the low sun behind it: its edges catch the light)
uniform float wline_k = 0.0;      // (where a thing meets the still water: a fine line of light)
uniform float rich_k = 0.0; uniform vec3 lichen_col : source_color = vec3(0.77, 0.73, 0.57);      // (rock as it weathers: each break its own tone, beds across its faces, lichen on what faces the sky)
varying vec3 wn;
uniform float mirror_k = 0.0; uniform float mirror_y = 0.0;      // (a thing's image in the water: drawn below it, shaded as the thing itself is)
uniform vec3 sea_c : source_color = vec3(0.3, 0.45, 0.56);
uniform float shadow_k = 1.0;      // (how much cast shadow falls on it: none on the rock, whose faces are each one clean tone)
uniform float lf_lo = 3.2;
uniform vec3 ao_tint : source_color = vec3(0.93, 0.83, 0.78);      // (the colour the close corners darken toward: warm in the sun, cool under the moon)
uniform sampler2D bg_tex : source_color, filter_linear, repeat_disable;      // (a painted backdrop: the mist is its colour at that place on the screen)
uniform float bg_tex_k = 0.0; uniform vec2 bg_scale = vec2(1.0);
uniform vec3 vein_tint : source_color = vec3(0.9, 0.86, 0.83);
uniform float drill = 0.0;      // (a face sawn in the quarry: the drill's grooves down it, the beds across it)
varying vec3 wp;
void vertex(){
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
	if (mirror_k > 0.5 && mirror_wob > 0.0) {      // (the water is not glass: its image wavers, more the deeper it lies)
		float dep = clamp((mirror_y - wp.y) * 0.9, 0.0, 1.0);
		float sc = max(length(MODEL_MATRIX[0].xyz), 1e-3);
		vec2 o = vec2(sin(wp.y * 6.5 + wp.x * 1.3 + TIME * 1.5), sin(wp.y * 5.2 - wp.z * 1.1 + TIME * 1.2)) * mirror_wob * dep;
		VERTEX.x += o.x / sc; VERTEX.z += o.y / sc;
		wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	}
}
uniform float sky4 = 0.0; uniform vec3 bg_hz : source_color = vec3(1.0); uniform vec3 sky_s = vec3(0.19, 0.36, 0.84);
vec3 bgc(float s){
	if (sky4 > 0.5) { vec3 c = mix(bg_top, bg_hz, smoothstep(sky_s.x * 0.3, sky_s.x, s)); c = mix(c, bg_mid, smoothstep(sky_s.x, sky_s.y, s)); return mix(c, bg_bot, smoothstep(sky_s.y, sky_s.z, s)); }
	vec3 c = mix(bg_top, bg_mid, smoothstep(0.0, 0.55, s)); return mix(c, bg_bot, smoothstep(0.45, 1.0, s)); }
float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p){ return vn(p) * 0.55 + vn(p * 2.1 + 3.1) * 0.3 + vn(p * 4.3 + 7.7) * 0.15; }
void fragment(){
	if (clip_k > 0.5 && wp.y < clip_y) discard;
	if (mirror_k > 0.5 && wp.y > mirror_y) discard;
	vec3 fn = normalize(cross(dFdx(wp), dFdy(wp)));
	if (dot(fn, INV_VIEW_MATRIX[2].xyz) < 0.0) fn = -fn;
	if (mirror_k > 0.5) fn.y = -fn.y;      // (in the water: each face as lit as it is above)
	float wy = mirror_k > 0.5 ? 2.0 * mirror_y - wp.y : wp.y;
	float d = dot(fn, normalize(key_dir));
	vec3 c = mix(c_dark, c_mid, smoothstep(-0.34, -0.14, d));      // (the light simple and sharp, as the picture's: each face one tone)
	c = mix(c, c_lit, smoothstep(0.16, 0.34, d));
	c = mix(c, c_top, smoothstep(0.7, 0.84, fn.y));
	if (smooth_k > 0.5) {
		vec3 sn = normalize(wn); if (mirror_k > 0.5) sn.y = -sn.y;
		vec3 vd = normalize(INV_VIEW_MATRIX[2].xyz);
		if (dot(sn, vd) < 0.0) sn = -sn;
		float sd = dot(sn, normalize(key_dir));
		c = mix(c_dark, c_mid, smoothstep(-0.95, -0.05, sd));
		c = mix(c, c_lit, smoothstep(-0.2, 0.85, sd));
		c = mix(c, c_top, smoothstep(0.25, 0.95, sn.y) * 0.7);
		float fr = pow(1.0 - clamp(dot(sn, vd), 0.0, 1.0), 2.2);
		c += rim_col * rim_k * fr * (0.35 + 0.65 * smoothstep(-0.4, 0.7, dot(sn, normalize(rim_dir))));
		fn = sn;
	} else if (rim_k > 0.0) {
		vec3 vd2 = normalize(INV_VIEW_MATRIX[2].xyz);
		float fr2 = pow(1.0 - clamp(dot(fn, vd2), 0.0, 1.0), 2.0);
		c += rim_col * rim_k * fr2 * (0.3 + 0.7 * smoothstep(-0.3, 0.7, dot(fn, normalize(rim_dir))));
	}
	c *= 1.0 + bounce * vec3(0.16, 0.07, -0.02) * smoothstep(0.15, -0.55, d);      // (warm light thrown back from the mist into the shade)
	if (sil > 0.5) c = c_mid * mix(0.95, 1.03, smoothstep(-0.3, 0.7, d));
	if (veins > 0.0) {      // (veins as marble has them: thin, wandering, now and then two together; a cloud in the stone)
		vec3 q = wp * 0.9;
		float w = fbm(q + vec3(fbm(q * 0.55 + 11.0), 0.0, fbm(q * 0.55 + 5.0)) * 1.7);
		float px = max(length(dFdx(q)), length(dFdy(q)));
		float v1 = 1.0 - smoothstep(0.0, 0.03 + px * 0.6, abs(w - 0.5));
		float v2 = 1.0 - smoothstep(0.0, 0.016 + px * 0.6, abs(fbm(q * 2.3 + 20.0) - 0.47));
		c = mix(c, c * vein_tint, veins * (0.6 * v1 + 0.3 * v2));
		c *= 1.0 + veins * (w - 0.5) * 0.05;
	}
	if (rich_k > 0.0) {
		vec3 cell = floor(wp * 1.7 + fn * 2.0);
		float hv = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
		c *= 1.0 + rich_k * (hv - 0.5) * 0.18;
		c = mix(c, c * vec3(1.04, 0.97, 1.05), rich_k * step(0.5, fract(hv * 7.3)) * 0.7);
		if (abs(fn.y) < 0.55) {
			float bed = abs(fract(wy * 2.4 + fbm(wp * 0.8) * 0.9) - 0.5) * 2.0;
			float px2 = max(length(dFdx(wp)), length(dFdy(wp)));
			c *= 1.0 - rich_k * 0.08 * (1.0 - smoothstep(0.05, 0.11 + px2 * 3.0, bed));
		}
		float lich = smoothstep(0.56, 0.7, fbm(wp * 2.2 + 31.0)) * smoothstep(0.4, 0.8, fn.y);
		c = mix(c, lichen_col, rich_k * lich * 0.6);
		c *= 1.0 - rich_k * 0.07 * smoothstep(0.76, 0.9, fbm(wp * 9.0 + 7.0));
	}
	if (drill > 0.0 && abs(fn.y) < 0.35) {
		vec2 tg = normalize(vec2(-fn.z, fn.x));
		float u = dot(wp.xz, tg); float px = max(length(dFdx(wp)), length(dFdy(wp)));
		float g = abs(fract(u / 0.34 + 0.5) - 0.5) * 2.0;
		float lv = 1.0 - smoothstep(0.06, 0.06 + px / 0.34 * 1.5 + 0.08, g);
		float gh = abs(fract(wy / 1.15 + 0.5) - 0.5) * 2.0;
		float lh = 1.0 - smoothstep(0.015, 0.015 + px / 1.15 * 1.5 + 0.025, gh);
		c *= 1.0 - drill * (0.075 * lv + 0.06 * lh);
	}
	if (ao_k > 0.0) { float ao = max(pow(clamp(COLOR.r, 0.0, 1.0), 0.3), 0.22); c *= mix(1.0, ao, ao_k); c = mix(c, c * ao_tint, (1.0 - ao) * ao_k * 0.6); }
	float ld = COLOR.g * 4.0;
	if (lfog > 0.5) c *= 1.0 - dk * smoothstep(0.0, 0.9, ld);      // (the rock darker under the floor it bears, before the mist takes it)
	else c *= 1.0 - dk * smoothstep(fog_ref + fog_hi + 2.4, fog_ref + fog_hi, wy);      // (the rock darkens as it goes down, before the mist takes it)
	if (flat_mode > 0.5) c = c_top;
	float sy = uv_flip > 0.5 ? 1.0 - SCREEN_UV.y : SCREEN_UV.y;
	float fk = max(1.0 - smoothstep(fog_ref + fog_lo, fog_ref + fog_hi, wy), far_k);
	if (haze > 0.0) fk = max(fk, haze * 0.22 * smoothstep(44.0, 52.0, -VERTEX.z));      // (VERTEX: from the eye)
	if (lfog > 0.5) {      // (into the mist softly, as mist does: a long fading, its edge in wisps)
		float lt = clamp((ld - lf_hi) / lf_len, 0.0, 1.0);      // (one clean fade down each face: no wisps, they smudged the rock)
		fk = max(fk, lt * lt * (3.0 - 2.0 * lt));
	}
	if (mirror_k > 0.5) c = mix(c, sea_c, 0.28 + 0.5 * smoothstep(0.0, 3.2, mirror_y - wp.y));      // (the image dims as it goes down into the water)
	if (under_k > 0.5) fk = max(fk, smoothstep(-0.02, 1.7, clip_y - wp.y) * 0.8);
	if (mirror_k > 0.5 && mirror_fade > 0.0) fk = max(fk, smoothstep(0.0, mirror_fade, mirror_y - wp.y));
	if (wline_k > 0.0) { float hw = wp.y - clip_y; c = mix(c, vec3(1.0, 0.97, 0.93), wline_k * (1.0 - smoothstep(0.0, 0.05, hw)) * step(-0.002, hw)); }
	ALBEDO = c * (1.0 - fk);
	vec3 mist = bgc(sy);
	if (bg_tex_k > 0.5) mist = texture(bg_tex, vec2(0.5 + (SCREEN_UV.x - 0.5) * bg_scale.x, 0.5 + (sy - 0.5) * bg_scale.y)).rgb;
	if (sea_k > 0.0) mist = mix(mist, sea_c, smoothstep(0.21, 0.38, sy) * (1.0 - smoothstep(0.5, 0.92, sy)) * 0.9 * sea_k);
	EMISSION = mist * fk + c_top * emit;
	if (dbg > 0.5) { ALBEDO = vec3(0.0); EMISSION = dbg > 3.5 ? vec3(fk) : (dbg > 2.5 ? c : (dbg > 1.5 ? vec3(d * 0.5 + 0.5) : fn * 0.5 + 0.5)); }
}
void light(){
	vec3 lw = normalize((INV_VIEW_MATRIX * vec4(LIGHT, 0.0)).xyz);      // (key_dir is this place's sun)
	if (LIGHT_IS_DIRECTIONAL && dot(lw, normalize(key_dir)) > 0.98) {      // (only the one sun of this place: no other light of the world)
		vec3 k = mix(shade_tint, vec3(1.0), sil > 0.5 ? 1.0 : mix(1.0, ATTENUATION, shadow_k));      // (far off, or rock: no shadow on it)
		DIFFUSE_LIGHT += alb_in_light > 0.5 ? k * ALBEDO : k;
	}
}
"""
const IV_BG_SH := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
uniform vec3 bg_top : source_color; uniform vec3 bg_mid : source_color; uniform vec3 bg_bot : source_color;
uniform float uv_flip = 0.0;
uniform vec2 sun = vec2(0.42, 0.1);
uniform float sun_k = 0.0;      // (a sun low in the sky: its disc and its glow)
uniform float moon_k = 0.0; uniform float moon_r = 0.16;      // (a moon: at sun, so wide across the screen)
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
uniform float sky4 = 0.0; uniform vec3 bg_hz : source_color = vec3(1.0); uniform vec3 sky_s = vec3(0.19, 0.36, 0.84);
vec3 bgc(float s){
	if (sky4 > 0.5) { vec3 c = mix(bg_top, bg_hz, smoothstep(sky_s.x * 0.3, sky_s.x, s)); c = mix(c, bg_mid, smoothstep(sky_s.x, sky_s.y, s)); return mix(c, bg_bot, smoothstep(sky_s.y, sky_s.z, s)); }
	vec3 c = mix(bg_top, bg_mid, smoothstep(0.0, 0.55, s)); return mix(c, bg_bot, smoothstep(0.45, 1.0, s)); }
void fragment(){
	float sy = uv_flip > 0.5 ? 1.0 - SCREEN_UV.y : SCREEN_UV.y;
	vec2 d = (SCREEN_UV - sun) * vec2(1.0, 1.8);
	ALBEDO = bgc(sy) + vec3(0.03, 0.02, 0.008) * exp(-dot(d, d) * 9.0);      // (a little light where the sun is, warm as the picture's sky: never toward green)
	if (sun_k > 0.0) { vec2 q = (SCREEN_UV - sun) * vec2(1.0, 1.778); float r = length(q);
		ALBEDO = mix(ALBEDO, vec3(1.0, 0.95, 0.85), sun_k * (1.0 - smoothstep(0.052, 0.058, r)));
		ALBEDO += sun_k * vec3(0.12, 0.07, 0.03) * exp(-r * r * 14.0); }
	if (moon_k > 0.0) {      // (a great full moon: its halo, its disc, its seas soft grey-blue, its limb a little darker)
		vec2 q = (SCREEN_UV - sun) * vec2(1.0, 1.778 * (uv_flip > 0.5 ? -1.0 : 1.0)); float r = length(q) / moon_r;
		ALBEDO += moon_k * vec3(0.17, 0.21, 0.26) * exp(-max(r - 1.0, 0.0) * 1.7) * smoothstep(0.98, 1.0, r);
		ALBEDO += moon_k * vec3(0.05, 0.06, 0.08) * exp(-max(r - 1.0, 0.0) * 0.45);
		vec2 m = q / moon_r;
		float sea = vn2(m * 2.3 + vec2(3.1, 1.7)) * 0.62 + vn2(m * 5.1 + vec2(7.3, 2.9)) * 0.38;
		vec3 mc = mix(vec3(0.92, 0.95, 0.98), vec3(0.8, 0.85, 0.92), smoothstep(0.52, 0.74, sea) * 0.6);
		mc *= 1.0 - 0.07 * dot(m, m);
		ALBEDO = mix(ALBEDO, mc, moon_k * (1.0 - smoothstep(0.988, 1.0, r)));
	}
}
"""
var iv_shader: Shader
const IV_BGTEX_SH := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
uniform sampler2D bg_tex : source_color, filter_linear, repeat_disable;
uniform vec2 bg_scale = vec2(1.0);
uniform vec3 bg_top : source_color;
uniform float uv_flip = 0.0;
void fragment(){
	float sy = uv_flip > 0.5 ? 1.0 - SCREEN_UV.y : SCREEN_UV.y;
	vec2 uv = vec2(0.5 + (SCREEN_UV.x - 0.5) * bg_scale.x, 0.5 + (sy - 0.5) * bg_scale.y);
	vec3 c = texture(bg_tex, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
	ALBEDO = mix(c, bg_top, smoothstep(0.0, -0.12, uv.y));      // (on a screen taller than the painting: above it, the sky's own colour)
}
"""
var iv_bgtex: Texture2D      # (the level's painted backdrop, if it has one: <level>/backdrop.jpg)
func _iv_bg_scale() -> Vector2:      # (the painting is 9:16; on a taller or a wider screen it keeps its shape, its middle at the screen's middle)
	var vp := get_viewport().get_visible_rect().size
	var r := vp.y / maxf(vp.x, 1.0); var rb := 16.0 / 9.0
	return Vector2(1.0, r / rb) if r >= rb else Vector2(r / rb, 1.0)
var iv_key := (Vector3(0.6, 0.66, -0.45) if go_drown else Vector3(-0.56, 0.72, 0.41)) if (OS.get_environment("IV_MODE") != "plate" and OS.get_environment("IV_MODE") != "3d") else IV_KEY      # (the sea: the low sun on the faces toward the eye's right)
var iv_mats := {}
var iv_uvf := float(OS.get_environment("IV_UVF")) if OS.get_environment("IV_UVF") != "" else 0.0
var iv_alb := float(OS.get_environment("IV_ALB")) if OS.get_environment("IV_ALB") != "" else 0.0
var iv_root: Node3D
var iv_nodes := {}      # name -> where it is (world)
var iv_edges := []      # [a, b, kind ("flat" | "stair" | "bridge"), where its flight begins, where it ends (0..1 from a)]
var iv_me := "a0"
var iv_block := "c0"
var iv_block_n: Node3D
var iv_wheel: Node3D
var iv_bridge_n: Node3D
var iv_bridge_up := false
var iv_ring: Node3D
var iv_glow: MeshInstance3D
var iv_busy := false
var iv_won := false
var iv_t := 0.0
var iv_push := {}
var iv_said := {}
var iv_hidden := []
var iv_leaves: TextureRect
var iv_fade: ColorRect
var iv_hold = null      # a place the eye goes to for a while (the pillar as it rises)
var iv_moves := 0

func _iv_mat(kind: String, far_k := 0.0, extra := {}) -> ShaderMaterial:
	var key := "%s|%.2f|%s" % [kind, far_k, str(extra)]
	if iv_mats.has(key): return iv_mats[key]
	if iv_shader == null: iv_shader = Shader.new(); iv_shader.code = IV_SH
	var m := ShaderMaterial.new(); m.shader = iv_shader
	var p: Array = _iv_pal(kind)
	for i in 4: m.set_shader_parameter(["c_top", "c_lit", "c_mid", "c_dark"][i], Color(String(p[i])))
	_iv_sky(m)
	if iv_bgtex != null: m.set_shader_parameter("bg_tex", iv_bgtex); m.set_shader_parameter("bg_tex_k", 1.0); m.set_shader_parameter("bg_scale", _iv_bg_scale())
	if go_drown:
		m.set_shader_parameter("shade_tint", Color(0.74, 0.79, 0.9)); m.set_shader_parameter("clip_k", 1.0); m.set_shader_parameter("clip_y", IV_O.y + ivr_sea_y)
	if go_wake:      # (dawn: the shade lilac; what lies under the still water is not drawn, its image is)
		m.set_shader_parameter("shade_tint", Color(0.85, 0.79, 0.9)); m.set_shader_parameter("ao_tint", Color(0.9, 0.83, 0.88)); m.set_shader_parameter("vein_tint", Color(0.93, 0.88, 0.9))
		m.set_shader_parameter("clip_k", 1.0); m.set_shader_parameter("clip_y", IV_O.y + ivr_sea_y); m.set_shader_parameter("sea_c", Color("ead2cf"))      # (an image in the water dims toward the pearl of the sea, not toward blue)
		m.set_shader_parameter("wline_k", 0.6); m.set_shader_parameter("mirror_fade", 2.0); m.set_shader_parameter("mirror_wob", 0.035)
		if kind == "rock2": m.set_shader_parameter("rich_k", 1.0)
	if go_quarry:      # (the afternoon: shadows a cool lilac on the warm marble)
		m.set_shader_parameter("shade_tint", Color(0.76, 0.74, 0.84)); m.set_shader_parameter("ao_tint", Color(0.9, 0.85, 0.86)); m.set_shader_parameter("vein_tint", Color(0.93, 0.9, 0.87))
		if kind == "quarry": m.set_shader_parameter("drill", 1.0)
	if go_moon:      # (a shadow on the snow is blue; so are its close corners and the veins of its marble)
		m.set_shader_parameter("shade_tint", Color(0.6, 0.68, 0.84)); m.set_shader_parameter("ao_tint", Color(0.82, 0.87, 0.97)); m.set_shader_parameter("vein_tint", Color(0.87, 0.91, 0.98))
	m.set_shader_parameter("key_dir", iv_key); m.set_shader_parameter("far_k", far_k)
	m.set_shader_parameter("uv_flip", iv_uvf); m.set_shader_parameter("alb_in_light", iv_alb)
	if OS.get_environment("IV_DBG") != "": m.set_shader_parameter("dbg", float(OS.get_environment("IV_DBG")))
	if kind == "line" or kind == "ring" or kind == "groove": m.set_shader_parameter("flat_mode", 1.0)
	if kind == "ring": m.set_shader_parameter("emit", 0.55)
	for k in extra: m.set_shader_parameter(k, extra[k])
	iv_mats[key] = m
	return m

func _iv_st() -> SurfaceTool:
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	return st

func _iv_tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, out: Vector3) -> void:
	var n := (b - a).cross(c - a)
	if n.length_squared() < 1e-12: return
	n = n.normalized()
	if n.dot(out) < 0.0: n = -n
	for v in [a, b, c]: st.set_normal(n); st.add_vertex(v)

func _iv_quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, out: Vector3) -> void:
	_iv_tri(st, a, b, c, out); _iv_tri(st, a, c, d, out)

## eight corners (the four below, then the four above in the same order): the six faces, each turned outward
func _iv_hexa(st: SurfaceTool, v: Array) -> void:
	var cen := Vector3.ZERO
	for p in v: cen += p
	cen /= 8.0
	for f in [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]:
		var a: Vector3 = v[f[0]]; var b: Vector3 = v[f[1]]; var c: Vector3 = v[f[2]]; var d: Vector3 = v[f[3]]
		_iv_quad(st, a, b, c, d, (a + b + c + d) * 0.25 - cen)

func _iv_box(st: SurfaceTool, lo: Vector3, hi: Vector3) -> void:
	_iv_hexa(st, [Vector3(lo.x, lo.y, lo.z), Vector3(hi.x, lo.y, lo.z), Vector3(hi.x, lo.y, hi.z), Vector3(lo.x, lo.y, hi.z),
		Vector3(lo.x, hi.y, lo.z), Vector3(hi.x, hi.y, lo.z), Vector3(hi.x, hi.y, hi.z), Vector3(lo.x, hi.y, hi.z)])

## a box along a line: from a to b, so wide across, so thick upward
func _iv_bar(st: SurfaceTool, a: Vector3, b: Vector3, w: float, h: float) -> void:
	var d := b - a; var s := Vector3(-d.z, 0, d.x).normalized() * (w * 0.5)
	if s.length_squared() < 1e-8: s = Vector3(w * 0.5, 0, 0)
	var u := Vector3(0, h, 0)
	_iv_hexa(st, [a - s, b - s, b + s, a + s, a - s + u, b - s + u, b + s + u, a + s + u])

func _iv_commit(st: SurfaceTool, kind: String, parent: Node3D, far_k := 0.0, extra := {}, shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = st.commit(); mi.material_override = _iv_mat(kind, far_k, extra)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if (shadow and far_k < 0.01) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

func _iv_prim(mesh: Mesh, p: Vector3, kind: String, parent: Node3D, extra := {}) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.position = p; mi.material_override = _iv_mat(kind, 0.0, extra)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON; parent.add_child(mi)
	return mi

func _iv_w(i: float, j: float) -> Vector2: return Vector2(i * IV_T, j * IV_T)      # a place on the plan (tile units) in metres from the level's origin

func _iv_rect(i0: float, i1: float, j0: float, j1: float, grow := 0.0, ch := 0.0) -> Array:
	var a := _iv_w(i0, j0) - Vector2(grow, grow); var b := _iv_w(i1, j1) + Vector2(grow, grow)
	if ch <= 0.0: return [Vector2(a.x, a.y), Vector2(b.x, a.y), Vector2(b.x, b.y), Vector2(a.x, b.y)]
	return [Vector2(a.x + ch, a.y), Vector2(b.x - ch, a.y), Vector2(b.x, a.y + ch), Vector2(b.x, b.y - ch), Vector2(b.x - ch, b.y), Vector2(a.x + ch, b.y), Vector2(a.x, b.y - ch), Vector2(a.x, a.y + ch)]

func _iv_sub(poly: Array, step: float) -> Array:
	var out := []
	for i in poly.size():
		var a: Vector2 = poly[i]; var b: Vector2 = poly[(i + 1) % poly.size()]
		var n := maxi(1, int(ceil(a.distance_to(b) / step)))
		for k in n: out.append(a.lerp(b, float(k) / float(n)))
	return out

## a prism of the plan between two heights; with jit, its rings below the top wander, so its sides break into facets
func _iv_prism(st: SurfaceTool, poly: Array, y_top: float, y_bot: float, rng: RandomNumberGenerator, jit := 0.0, cap := true, step := 1.05) -> void:
	var pts := _iv_sub(poly, step) if jit > 0.0 else poly
	var cen := Vector2.ZERO
	for p in pts: cen += p
	cen /= float(pts.size())
	var ys := [y_top, y_bot] if jit <= 0.0 else [y_top, y_top - 0.5, y_top - 1.5, y_top - 2.9, y_top - 4.6, lerpf(y_top, y_bot, 0.45), y_bot]
	var rings := []
	for li in ys.size():
		var ring := []
		for p in pts:
			var q: Vector2 = p
			if jit > 0.0 and li > 0:
				var o: Vector2 = (p - cen).normalized()
				var amt: float = [0.0, 0.35, 0.75, 0.95, 1.1, 1.25, 1.5][li] * jit
				var ledge := 1.0 if rng.randf() < 0.22 else 0.0      # (here and there the rock juts out in a shelf)
				q = p + o * (rng.randf_range(-0.5, 1.0) * amt + ledge * jit * 0.9) + Vector2(rng.randf_range(-1.0, 1.0), rng.randf_range(-1.0, 1.0)) * amt * 0.35
			ring.append(Vector3(q.x, float(ys[li]) + (rng.randf_range(-0.25, 0.25) * jit if (jit > 0.0 and li > 0 and li < ys.size() - 1) else 0.0), q.y))
		rings.append(ring)
	var n := pts.size()
	for li in rings.size() - 1:
		for k in n:
			var a: Vector3 = rings[li][k]; var b: Vector3 = rings[li][(k + 1) % n]; var c: Vector3 = rings[li + 1][(k + 1) % n]; var d: Vector3 = rings[li + 1][k]
			var mid := (a + b + c + d) * 0.25
			_iv_quad(st, a, b, c, d, Vector3(mid.x - cen.x, 0, mid.z - cen.y))
	if cap:
		var c0 := Vector3(cen.x, y_top, cen.y)
		for k in n: _iv_tri(st, c0, rings[0][k], rings[0][(k + 1) % n], Vector3.UP)

## a floor of the way: a slab of cut marble (its edge a little proud), a band of cut stone, and under it the rough rock
## going down into the mist
func _iv_floor(parent: Node3D, poly: Array, y: float, rng: RandomNumberGenerator, band := 0.85, depth := 26.0, grow := 0.07) -> void:
	var slab := []
	var cen := Vector2.ZERO
	for p in poly: cen += p
	cen /= float(poly.size())
	for p in poly: slab.append(p + (p - cen).normalized() * grow * 1.41)
	var st := _iv_st(); _iv_prism(st, slab, y, y - 0.16, rng); _iv_commit(st, "marble", parent, 0.0, {"veins": 1.0})
	var st2 := _iv_st(); _iv_prism(st2, poly, y - 0.16, y - band, rng, 0.0, false); _iv_commit(st2, "marble", parent)
	var st3 := _iv_st(); _iv_prism(st3, poly, y - band, y - depth, rng, 0.42, false); _iv_commit(st3, "rock", parent)

## a flight of steps from its foot (the middle of its lowest edge, on the lower floor) to its head (on the upper), with
## low walls at its sides and the rock under it
func _iv_stairs(parent: Node3D, foot: Vector3, head: Vector3, w: float, rng: RandomNumberGenerator, walls := true) -> void:
	var d := Vector3(head.x - foot.x, 0, head.z - foot.z); var L := d.length(); d /= L
	var s := Vector3(-d.z, 0, d.x)
	var rise := head.y - foot.y; var n := maxi(1, int(round(absf(rise) / 0.2)))
	var st := _iv_st()
	for k in n:
		var t0 := L * float(k) / float(n); var t1 := L * float(k + 1) / float(n)
		var top := foot.y + rise * float(k + 1) / float(n); var bot := foot.y - 0.9
		var p0 := foot + d * t0; var p1 := foot + d * t1
		var hw := s * (w * 0.5)
		_iv_hexa(st, [Vector3(p0.x, bot, p0.z) - hw, Vector3(p1.x, bot, p1.z) - hw, Vector3(p1.x, bot, p1.z) + hw, Vector3(p0.x, bot, p0.z) + hw,
			Vector3(p0.x, top, p0.z) - hw, Vector3(p1.x, top, p1.z) - hw, Vector3(p1.x, top, p1.z) + hw, Vector3(p0.x, top, p0.z) + hw])
	_iv_commit(st, "marble", parent, 0.0, {"veins": 0.6})
	if walls:
		var sw := _iv_st()
		for sg in [-1.0, 1.0]:
			var o: Vector3 = s * (sg * (w * 0.5 + 0.09)); var hw2 := s * 0.09
			var a0 := foot + o; var a1 := head + o
			_iv_hexa(sw, [Vector3(a0.x, foot.y - 0.9, a0.z) - hw2, Vector3(a1.x, head.y - 0.9, a1.z) - hw2, Vector3(a1.x, head.y - 0.9, a1.z) + hw2, Vector3(a0.x, foot.y - 0.9, a0.z) + hw2,
				Vector3(a0.x, foot.y + 0.3, a0.z) - hw2, Vector3(a1.x, head.y + 0.3, a1.z) - hw2, Vector3(a1.x, head.y + 0.3, a1.z) + hw2, Vector3(a0.x, foot.y + 0.3, a0.z) + hw2])
		_iv_commit(sw, "marble", parent)
	var sr := _iv_st()
	var hw3 := s * (w * 0.5 + 0.35)
	_iv_hexa(sr, [Vector3(foot.x, -24.0, foot.z) - hw3, Vector3(head.x, -24.0, head.z) - hw3, Vector3(head.x, -24.0, head.z) + hw3, Vector3(foot.x, -24.0, foot.z) + hw3,
		Vector3(foot.x, foot.y - 0.85, foot.z) - hw3, Vector3(head.x, head.y - 0.85, head.z) - hw3, Vector3(head.x, head.y - 0.85, head.z) + hw3, Vector3(foot.x, foot.y - 0.85, foot.z) + hw3])
	_iv_commit(sr, "rock", parent)

func _iv_column(parent: Node3D, p: Vector3, h: float, r: float, broken := false) -> void:
	var st := _iv_st()
	_iv_box(st, p + Vector3(-r * 1.3, 0, -r * 1.3), p + Vector3(r * 1.3, 0.2, r * 1.3))
	_iv_commit(st, "marble", parent)
	var hh := h - 0.2 - (0.0 if broken else 0.36)
	var cm := CylinderMesh.new(); cm.top_radius = r * 0.88; cm.bottom_radius = r; cm.height = hh; cm.radial_segments = 8; cm.rings = 1
	_iv_prim(cm, p + Vector3(0, 0.2 + hh * 0.5, 0), "marble", parent)
	if broken:
		var ch := _iv_st()      # the break: a sloped stub of the drum
		var y0 := p.y + 0.2 + hh
		_iv_hexa(ch, [p + Vector3(-r * 0.8, y0 - p.y, -r * 0.5), p + Vector3(r * 0.8, y0 - p.y, -r * 0.5), p + Vector3(r * 0.8, y0 - p.y, r * 0.6), p + Vector3(-r * 0.8, y0 - p.y, r * 0.6),
			p + Vector3(-r * 0.7, y0 - p.y + 0.3, -r * 0.4), p + Vector3(r * 0.6, y0 - p.y + 0.12, -r * 0.4), p + Vector3(r * 0.6, y0 - p.y + 0.05, r * 0.5), p + Vector3(-r * 0.7, y0 - p.y + 0.22, r * 0.5)])
		_iv_commit(ch, "marble", parent)
		return
	var top := p.y + 0.2 + hh
	var cap := _iv_st()
	_iv_box(cap, Vector3(p.x - r * 1.1, top, p.z - r * 0.9), Vector3(p.x + r * 1.1, top + 0.2, p.z + r * 0.9))
	_iv_box(cap, Vector3(p.x - r * 1.35, top + 0.2, p.z - r * 1.35), Vector3(p.x + r * 1.35, top + 0.36, p.z + r * 1.35))
	_iv_commit(cap, "marble", parent)
	for sg in [-1.0, 1.0]:      # the two scrolls of the Ionic capital
		var vm := CylinderMesh.new(); vm.top_radius = r * 0.42; vm.bottom_radius = r * 0.42; vm.height = r * 1.9; vm.radial_segments = 8; vm.rings = 1
		var vi := _iv_prim(vm, Vector3(p.x + sg * r * 1.12, top + 0.08, p.z), "marble", parent); vi.rotation.x = PI * 0.5

## a free-standing arch: two piers and a round head, its opening of radius r; yaw turns it about its foot
func _iv_arch(parent: Node3D, foot: Vector3, yaw: float, W := 2.3, Hh := 3.3, r := 0.62, D := 0.62) -> void:
	var st := _iv_st()
	var hs := Hh - r - 0.55
	var xf := Basis(Vector3.UP, yaw)
	var P := func(x: float, y: float, z: float) -> Vector3: return foot + xf * Vector3(x, y, z)
	for sg in [-1.0, 1.0]:      # the piers
		var x0: float = sg * r; var x1: float = sg * W * 0.5
		var lo := minf(x0, x1); var hi := maxf(x0, x1)
		_iv_hexa(st, [P.call(lo, 0.0, -D * 0.5), P.call(hi, 0.0, -D * 0.5), P.call(hi, 0.0, D * 0.5), P.call(lo, 0.0, D * 0.5),
			P.call(lo, hs, -D * 0.5), P.call(hi, hs, -D * 0.5), P.call(hi, hs, D * 0.5), P.call(lo, hs, D * 0.5)])
	var th := [0.0]
	var tc := atan2(Hh - hs, W * 0.5)
	for k in range(1, 9): th.append(PI * float(k) / 9.0)
	th.append(tc); th.append(PI - tc); th.append(PI); th.sort()
	var ps := []; var qs := []
	for t in th:
		var a: float = t
		ps.append(Vector2(r * cos(a), hs + r * sin(a)))
		var q: Vector2
		if a <= tc + 1e-4: q = Vector2(W * 0.5, hs + W * 0.5 * tan(a))
		elif a >= PI - tc - 1e-4: q = Vector2(-W * 0.5, hs + W * 0.5 * tan(PI - a))
		else: q = Vector2((Hh - hs) / tan(a), Hh)
		qs.append(q)
	var c3: Vector3 = P.call(0.0, hs, 0.0)
	for k in th.size() - 1:
		var p0: Vector2 = ps[k]; var p1: Vector2 = ps[k + 1]; var q0: Vector2 = qs[k]; var q1: Vector2 = qs[k + 1]
		for zz in [-D * 0.5, D * 0.5]:
			_iv_quad(st, P.call(p0.x, p0.y, zz), P.call(p1.x, p1.y, zz), P.call(q1.x, q1.y, zz), P.call(q0.x, q0.y, zz), xf * Vector3(0, 0, signf(zz)))
		var pin: Vector3 = (P.call(p0.x, p0.y, 0.0) + P.call(p1.x, p1.y, 0.0)) * 0.5
		_iv_quad(st, P.call(p0.x, p0.y, -D * 0.5), P.call(p1.x, p1.y, -D * 0.5), P.call(p1.x, p1.y, D * 0.5), P.call(p0.x, p0.y, D * 0.5), c3 - pin)
		_iv_quad(st, P.call(q0.x, q0.y, -D * 0.5), P.call(q1.x, q1.y, -D * 0.5), P.call(q1.x, q1.y, D * 0.5), P.call(q0.x, q0.y, D * 0.5), (P.call(q0.x, q0.y, 0.0) + P.call(q1.x, q1.y, 0.0)) * 0.5 - c3)
	_iv_commit(st, "marble", parent)
	var cor := _iv_st()      # its cornice
	_iv_hexa(cor, [P.call(-W * 0.5 - 0.1, Hh, -D * 0.5 - 0.08), P.call(W * 0.5 + 0.1, Hh, -D * 0.5 - 0.08), P.call(W * 0.5 + 0.1, Hh, D * 0.5 + 0.08), P.call(-W * 0.5 - 0.1, Hh, D * 0.5 + 0.08),
		P.call(-W * 0.5 - 0.1, Hh + 0.22, -D * 0.5 - 0.08), P.call(W * 0.5 + 0.1, Hh + 0.22, -D * 0.5 - 0.08), P.call(W * 0.5 + 0.1, Hh + 0.22, D * 0.5 + 0.08), P.call(-W * 0.5 - 0.1, Hh + 0.22, D * 0.5 + 0.08)])
	_iv_commit(cor, "marble", parent)

## a lump of rock: a box whose corners wander, so its faces catch the light each its own way
func _iv_rock(parent: Node3D, c: Vector3, sz: Vector3, rng: RandomNumberGenerator, kind := "rock") -> void:
	var st := _iv_st(); var v := []
	for k in 8:
		var sx := -1.0 if (k % 4 == 0 or k % 4 == 3) else 1.0
		var sz2 := -1.0 if (k % 4 < 2) else 1.0
		var sy := -1.0 if k < 4 else 1.0
		v.append(c + Vector3(sx * sz.x * rng.randf_range(0.6, 1.0), sy * sz.y * rng.randf_range(0.7, 1.0), sz2 * sz.z * rng.randf_range(0.6, 1.0)) * 0.5)
	_iv_hexa(st, v); _iv_commit(st, kind, parent)

## a drum of a fallen column, lying on its side
func _iv_drum(parent: Node3D, p: Vector3, r: float, l: float, yaw: float) -> void:
	var cm := CylinderMesh.new(); cm.top_radius = r; cm.bottom_radius = r; cm.height = l; cm.radial_segments = 8; cm.rings = 1
	var mi := _iv_prim(cm, p + Vector3(0, r, 0), "marble", parent); mi.rotation = Vector3(0, yaw, PI * 0.5)

func _iv_cypress(parent: Node3D, p: Vector3, h: float) -> void:
	var tr := _iv_st(); _iv_box(tr, p + Vector3(-0.09, 0, -0.09), p + Vector3(0.09, 0.45, 0.09)); _iv_commit(tr, "rock", parent)
	var c1 := CylinderMesh.new(); c1.top_radius = 0.3; c1.bottom_radius = 0.42; c1.height = h * 0.38; c1.radial_segments = 6; c1.rings = 1
	_iv_prim(c1, p + Vector3(0, 0.35 + h * 0.19, 0), "olive", parent)
	var c2 := CylinderMesh.new(); c2.top_radius = 0.0; c2.bottom_radius = 0.33; c2.height = h * 0.62; c2.radial_segments = 6; c2.rings = 1
	_iv_prim(c2, p + Vector3(0, 0.35 + h * 0.38 + h * 0.31, 0), "olive", parent)

## the stone that can be pushed: a block of marble, a Greek key cut on each of its faces
func _iv_meander_block(parent: Node3D, s := 1.1) -> Node3D:
	var n := Node3D.new(); parent.add_child(n)
	var st := _iv_st()
	_iv_box(st, Vector3(-s * 0.5, 0, -s * 0.5), Vector3(s * 0.5, s, s * 0.5))
	var u := s / 7.0; var pr := 0.028; var bw := u * 0.42
	var key := [Vector2(1, 1), Vector2(6, 1), Vector2(6, 6), Vector2(1.9, 6), Vector2(1.9, 2.9), Vector2(4.1, 2.9), Vector2(4.1, 4.1)]
	for f in 4:
		var ax := Basis(Vector3.UP, PI * 0.5 * f)
		var out := ax * Vector3(0, 0, 1)
		var right := ax * Vector3(1, 0, 0)
		var org := out * (s * 0.5) - right * (s * 0.5)
		for k in key.size() - 1:
			var a: Vector2 = key[k]; var b: Vector2 = key[k + 1]
			var pa := org + right * (a.x * u) + Vector3(0, a.y * u, 0)
			var pb := org + right * (b.x * u) + Vector3(0, b.y * u, 0)
			var dd := (pb - pa); var ln := dd.length(); dd /= ln
			var side := dd.cross(out).normalized() * (bw * 0.5)
			var e0 := pa - dd * (bw * 0.5); var e1 := pb + dd * (bw * 0.5)
			_iv_hexa(st, [e0 - side, e1 - side, e1 + side, e0 + side, e0 - side + out * pr, e1 - side + out * pr, e1 + side + out * pr, e0 + side + out * pr])
	_iv_commit(st, "marble", n)
	return n

## the volute: a stone post at the edge of the floor with a wheel cut as an Ionic scroll; a red cloth hangs from it
## over the edge
func _iv_volute(parent: Node3D, p: Vector3, out_dir: Vector3) -> void:
	var st := _iv_st(); _iv_box(st, p + Vector3(-0.38, 0, -0.3), p + Vector3(0.38, 0.72, 0.3)); _iv_box(st, p + Vector3(-0.45, 0.72, -0.36), p + Vector3(0.45, 0.82, 0.36))
	_iv_commit(st, "marble", parent)
	iv_wheel = Node3D.new(); iv_wheel.position = p + Vector3(0, 1.28, 0); parent.add_child(iv_wheel)
	var dm := CylinderMesh.new(); dm.top_radius = 0.46; dm.bottom_radius = 0.46; dm.height = 0.18; dm.radial_segments = 14; dm.rings = 1
	var di := _iv_prim(dm, Vector3.ZERO, "marble", iv_wheel); di.rotation.x = PI * 0.5
	var sp := _iv_st()      # the scroll, raised on both of its faces
	for zf in [-1.0, 1.0]:
		var prev := Vector3.ZERO; var first := true
		for k in 64:
			var t := float(k) / 63.0
			var a := t * TAU * 2.25
			var rr := 0.4 * (1.0 - t * 0.82)
			var q := Vector3(cos(a) * rr, sin(a) * rr, zf * 0.09)
			if not first:
				var dd := q - prev; var side := Vector3(-dd.y, dd.x, 0).normalized() * 0.03
				var o := Vector3(0, 0, zf * 0.035)
				_iv_hexa(sp, [prev - side, q - side, q + side, prev + side, prev - side + o, q - side + o, q + side + o, prev + side + o])
			prev = q; first = false
	_iv_commit(sp, "marble", iv_wheel)
	var hub := CylinderMesh.new(); hub.top_radius = 0.1; hub.bottom_radius = 0.1; hub.height = 0.36; hub.radial_segments = 8; hub.rings = 1
	var hi := _iv_prim(hub, Vector3.ZERO, "marble", iv_wheel); hi.rotation.x = PI * 0.5
	var cl := _iv_st()      # the cloth: over the post, over the edge, and down the face of the rock
	var o2 := out_dir.normalized(); var s2 := Vector3(-o2.z, 0, o2.x) * 0.3
	var pts := [p + Vector3(0, 0.83, 0) - o2 * 0.2, p + Vector3(0, 0.83, 0) + o2 * 0.42, p + o2 * 0.62 + Vector3(0, 0.02, 0), p + o2 * 0.7 + Vector3(0, -0.85, 0), p + o2 * 0.8 + Vector3(0, -1.66, 0), p + o2 * 1.3 + Vector3(0, -1.68, 0)]
	for k in pts.size() - 1:
		var a: Vector3 = pts[k]; var b: Vector3 = pts[k + 1]
		var wv := 0.06 * sin(float(k) * 1.9)
		var sa := s2 * (1.0 + 0.04 * float(k)); var sb := s2 * (1.0 + 0.04 * float(k + 1))
		_iv_quad(cl, a - sa + o2 * wv, b - sb, b + sb, a + sa + o2 * wv, o2 + Vector3(0, 0.3, 0))
	_iv_commit(cl, "terra", parent)

func _iv_line(parent: Node3D, a: Vector3, b: Vector3) -> void:
	var st := _iv_st(); _iv_bar(st, a + Vector3(0, 0.005, 0), b + Vector3(0, 0.005, 0), 0.055 if ivr_on else 0.07, 0.018); _iv_commit(st, "groove" if ivr_on else "line", parent, 0.0, {}, false)

## a groove up the face of a riser
func _iv_riser(parent: Node3D, a: Vector3, b: Vector3) -> void:
	var st := _iv_st()
	var w := 0.0275
	var d := Vector3(1, 0, 0)
	_iv_hexa(st, [a + Vector3(-w, 0, -w), a + Vector3(w, 0, -w), a + Vector3(w, 0, w), a + Vector3(-w, 0, w), b + Vector3(-w, 0, -w), b + Vector3(w, 0, -w), b + Vector3(w, 0, w), b + Vector3(-w, 0, w)])
	_iv_commit(st, "groove", parent, 0.0, {}, false)

func _iv_node_ring(parent: Node3D, p: Vector3) -> void:
	var tm := TorusMesh.new(); tm.inner_radius = 0.2; tm.outer_radius = 0.27; tm.rings = 18; tm.ring_segments = 6
	var mi := _iv_prim(tm, p + Vector3(0, 0.02, 0), "line", parent); mi.scale = Vector3(1, 0.4, 1); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _iv_edge(a: String, b: String) -> Array:
	for e in iv_edges:
		if (e[0] == a and e[1] == b) or (e[0] == b and e[1] == a): return e
	return []

func _iv_nbrs(k: String) -> Array:
	var out := []
	for e in iv_edges:
		if String(e[2]) == "bridge" and not iv_bridge_up: continue
		if e[0] == k: out.append(String(e[1]))
		elif e[1] == k: out.append(String(e[0]))
	return out

func _iv_path(a: String, b: String) -> Array:
	var prev := {a: ""}; var q := [a]
	while not q.is_empty():
		var k: String = q.pop_front()
		if k == b: break
		for n in _iv_nbrs(k):
			if prev.has(n) or n == iv_block: continue
			prev[n] = k; q.append(n)
	if not prev.has(b) or b == iv_block: return []
	var path := []; var k2 := b
	while k2 != a: path.push_front(k2); k2 = String(prev[k2])
	return path

func _iv_node_at(p: Vector3) -> String:
	for k in iv_nodes:
		var q: Vector3 = iv_nodes[k]
		if q.distance_to(p) < 0.3: return String(k)
	return ""

## how high she stands where she is: on a floor its height, on a flight of steps the height of the step under her
func _iv_height(p: Vector3) -> float:
	var best := 1e9; var hy := p.y
	for e in iv_edges:
		if String(e[2]) == "bridge" and not iv_bridge_up: continue
		var a: Vector3 = iv_nodes[e[0]]; var b: Vector3 = iv_nodes[e[1]]
		var ab := Vector2(b.x - a.x, b.z - a.z); var ap := Vector2(p.x - a.x, p.z - a.z)
		var t := clampf(ap.dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0)
		var dd := (ap - ab * t).length()
		if dd < best - 0.01:
			best = dd
			if String(e[2]) == "stair": hy = lerpf(a.y, b.y, clampf((t - float(e[3])) / maxf(float(e[4]) - float(e[3]), 1e-4), 0.0, 1.0))
			else: hy = lerpf(a.y, b.y, t)
	return hy

func _iv_build() -> void:
	iv_root = Node3D.new(); iv_root.position = IV_O; add_child(iv_root)
	var R := iv_root
	var rng := RandomNumberGenerator.new(); rng.seed = 4242
	var N := {"a0": [0.0, 4.0, 0], "a1": [0.0, 3.0, 0], "b0": [0.0, 1.0, 1], "b1": [1.0, 1.0, 1], "c1": [1.0, 0.0, 1], "c0": [0.0, 0.0, 1], "w0": [-1.0, 0.0, 1],
		"d0": [0.0, -2.0, 2], "d1": [-1.0, -2.0, 2], "e0": [-2.0, -2.0, 2], "f0": [-3.0, -2.0, 2], "g0": [-3.0, -4.25, 3], "g1": [-2.0, -4.25, 3]}
	for k in N:
		var v: Array = N[k]
		iv_nodes[k] = IV_O + Vector3(float(v[0]) * IV_T, float(IV_Y[int(v[2])]), float(v[1]) * IV_T)
	iv_edges = [["a0", "a1", "flat", 0.0, 1.0], ["a1", "b0", "stair", 0.14, 0.86], ["b0", "b1", "flat", 0.0, 1.0], ["b1", "c1", "flat", 0.0, 1.0],
		["c1", "c0", "flat", 0.0, 1.0], ["c0", "w0", "flat", 0.0, 1.0], ["c0", "d0", "stair", 0.14, 0.86], ["d0", "d1", "flat", 0.0, 1.0],
		["d1", "e0", "bridge", 0.0, 1.0], ["e0", "f0", "bridge", 0.0, 1.0], ["f0", "g0", "stair", 0.244, 0.867], ["g0", "g1", "flat", 0.0, 1.0]]
	# the floors (plan in tile units: i from, to; j from, to; which floor)
	for f in [[-0.62, 0.62, 2.72, 4.6, 0, 0.0], [-1.62, 1.95, -0.28, 1.28, 1, 0.3], [-1.6, 0.75, -2.62, -1.72, 2, 0.2], [-3.62, -2.4, -2.55, -1.45, 2, 0.0], [-3.7, -1.3, -4.95, -3.95, 3, 0.25]]:
		_iv_floor(R, _iv_rect(float(f[0]), float(f[1]), float(f[2]), float(f[3]), 0.0, float(f[5])), float(IV_Y[int(f[4])]), rng)
	# the flights: x of their middle, j of the foot, j of the head, the floors they join
	var fl := [[0.0, 2.72, 1.28, 0, 1], [0.0, -0.28, -1.72, 1, 2], [-3.0, -2.55, -3.95, 2, 3]]
	for s in fl:
		var foot := Vector3(float(s[0]) * IV_T, float(IV_Y[int(s[3])]), float(s[1]) * IV_T)
		var head := Vector3(float(s[0]) * IV_T, float(IV_Y[int(s[4])]), float(s[2]) * IV_T)
		_iv_stairs(R, foot, head, 1.3, rng)
	_iv_stairs(R, Vector3(0, -2.4, 6.05 * IV_T), Vector3(0, 0.0, 4.6 * IV_T), 1.3, rng)      # the way she came up, out of the mist
	# the pillar that will close the gap: deep in the mist until the volute is turned
	iv_bridge_n = Node3D.new(); iv_bridge_n.position = Vector3(0, -11.0, 0); R.add_child(iv_bridge_n)
	_iv_floor(iv_bridge_n, _iv_rect(-2.4, -1.6, -2.45, -1.55), float(IV_Y[2]), rng, 0.85, 22.0, 0.0)
	# the rock the fallen face lies in, and the spur by the top floor where the cypress grows
	var st := _iv_st()
	_iv_prism(st, [_iv_w(-3.6, 0.0), _iv_w(-2.1, -0.45), _iv_w(-1.62, 0.35), _iv_w(-1.62, 1.3), _iv_w(-2.3, 1.75), _iv_w(-3.5, 1.5)], float(IV_Y[1]) - 1.05, -24.0, rng, 0.5, true)
	_iv_commit(st, "rock", R)
	var st2 := _iv_st()
	_iv_prism(st2, [_iv_w(-4.7, -3.7), _iv_w(-3.78, -3.55), _iv_w(-3.7, -2.62), _iv_w(-4.2, -2.3), _iv_w(-4.8, -2.8)], float(IV_Y[2]) + 1.15, -24.0, rng, 0.45, true)
	_iv_commit(st2, "rock", R)
	var st3 := _iv_st()      # a low ledge of rock east of the middle floor, under the volute's cloth
	_iv_prism(st3, [_iv_w(1.95, -0.1), _iv_w(2.55, 0.2), _iv_w(2.6, 1.1), _iv_w(1.95, 1.35)], float(IV_Y[1]) - 1.7, -24.0, rng, 0.4, true)
	_iv_commit(st3, "rock", R)
	_iv_cypress(R, Vector3(-4.25 * IV_T, float(IV_Y[2]) + 1.15, -3.05 * IV_T), 3.0)
	_iv_drum(R, Vector3(-1.2 * IV_T, float(IV_Y[1]), 0.95 * IV_T), 0.24, 0.62, 0.4)
	_iv_drum(R, Vector3(-0.95 * IV_T, float(IV_Y[2]), -2.4 * IV_T), 0.22, 0.5, 1.2)
	_iv_rock(R, Vector3(-1.3 * IV_T, float(IV_Y[3]) + 0.15, -3.95 * IV_T), Vector3(0.7, 0.45, 0.6), rng, "marble")
	# the fallen face: one of the thousand, lying on its cheek in the rock
	var hp := Node3D.new(); R.add_child(hp)
	var hd := prop_model("iv_head", hp, 4.3); hd.position = Vector3(0, -2.15, 0)
	for m in hd.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _iv_mat("marble", 0.0, {"veins": 0.5}); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	hp.position = Vector3(-2.6 * IV_T, float(IV_Y[1]) - 0.75, 0.7 * IV_T)
	hp.rotation = Vector3(0.0, deg_to_rad(float(OS.get_environment("IV_HYAW")) if OS.get_environment("IV_HYAW") != "" else 20.0), deg_to_rad(84.0))
	# columns, arches
	_iv_column(R, Vector3(-1.38 * IV_T, float(IV_Y[1]), -0.08 * IV_T), 1.3, 0.22, true)
	_iv_column(R, Vector3(1.75 * IV_T, float(IV_Y[1]), -0.06 * IV_T), 0.9, 0.22, true)
	_iv_column(R, Vector3(-1.4 * IV_T, float(IV_Y[2]), -2.42 * IV_T), 2.8, 0.22)
	_iv_column(R, Vector3(-1.5 * IV_T, float(IV_Y[3]), -4.72 * IV_T), 1.1, 0.22, true)
	_iv_column(R, Vector3(0.42 * IV_T, float(IV_Y[0]), 4.35 * IV_T), 0.8, 0.2, true)
	_iv_arch(R, Vector3(0.48 * IV_T, float(IV_Y[2]), -2.17 * IV_T), PI * 0.5)
	_iv_arch(R, Vector3(-2.55 * IV_T, float(IV_Y[3]), -4.72 * IV_T), 0.0)
	# the stone, the volute
	iv_block_n = _iv_meander_block(R); iv_block_n.global_position = iv_nodes[iv_block]
	_iv_volute(R, Vector3(1.72 * IV_T, float(IV_Y[1]), 1.0 * IV_T), Vector3(1, 0, 0))
	# the way: its lines and nodes (those on the pillar go up with it)
	for e in iv_edges:
		var a: Vector3 = iv_nodes[e[0]] - IV_O; var b: Vector3 = iv_nodes[e[1]] - IV_O
		var par: Node3D = iv_bridge_n if String(e[2]) == "bridge" else R
		if String(e[2]) == "stair":
			var s0 := a.lerp(b, float(e[3])); var s1 := a.lerp(b, float(e[4]))
			var n := int(round(absf(b.y - a.y) / 0.2)); var rz := (b.y - a.y) / float(n)
			var lo := Vector3(s0.x, a.y + rz, s0.z)
			var hi := s0.lerp(Vector3(s1.x, s0.y, s1.z), float(n - 1) / float(n)); hi.y = b.y
			_iv_line(R, a, Vector3(s0.x, a.y, s0.z)); _iv_line(R, lo, hi); _iv_line(R, hi, b)
		else:
			_iv_line(par, a, b)
	for k in iv_nodes:
		if k == "g1": continue
		var p: Vector3 = iv_nodes[k] - IV_O
		_iv_node_ring(iv_bridge_n if k == "e0" else R, p)
	# the ring of light where the way ends
	iv_ring = Node3D.new(); iv_ring.position = iv_nodes["g1"] - IV_O; R.add_child(iv_ring)
	var tm := TorusMesh.new(); tm.inner_radius = 0.42; tm.outer_radius = 0.52; tm.rings = 24; tm.ring_segments = 6
	var rm := _iv_prim(tm, Vector3(0, 0.05, 0), "ring", iv_ring); rm.scale = Vector3(1, 0.5, 1); rm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var gq := QuadMesh.new(); gq.size = Vector2(2.6, 2.6)
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_texture = load("res://goiv/glow.png")
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; gm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	gm.albedo_color = Color(1.0, 0.96, 0.86, 0.75)
	iv_glow = MeshInstance3D.new(); iv_glow.mesh = gq; iv_glow.material_override = gm; iv_glow.position = Vector3(0, 0.55, 0); iv_glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_ring.add_child(iv_glow)
	# far off in the mist: spires of rock, a colonnade on a cliff, a colossal figure; each further one paler
	_iv_far()

## things far behind, placed by where they are to be seen: across (sx) and up (sy) the picture, and how deep (dep)
func _iv_far() -> void:
	var eb := Basis.from_euler(Vector3(deg_to_rad(-IV_PITCH), deg_to_rad(MW_YAW), 0.0))
	var bx := eb.x; var by := eb.y; var fwd := -eb.z
	var ref := IV_O + Vector3(-3.0, 3.6, -4.0)      # (about the middle of the level)
	var rng := RandomNumberGenerator.new(); rng.seed = 99
	var spot := func(sx: float, sy: float, dep: float) -> Vector3: return ref + bx * sx + by * sy + fwd * dep
	# [sx, sy of its top, depth, width, haze]
	for f in [[-6.4, -1.0, 16.0, 4.5, 0.14], [6.2, 1.5, 18.0, 4.0, 0.18], [-5.6, 6.5, 24.0, 6.0, 0.24], [6.0, 8.0, 26.0, 5.0, 0.28], [-4.0, 11.5, 34.0, 7.0, 0.34], [5.2, 13.5, 40.0, 7.0, 0.4], [-6.5, 15.0, 48.0, 8.0, 0.46], [1.0, 17.0, 56.0, 10.0, 0.52]]:
		var top: Vector3 = spot.call(float(f[0]), float(f[1]), float(f[2]))
		var w: float = f[3]
		var poly := []
		for k in 7:
			var a := TAU * float(k) / 7.0 + rng.randf_range(-0.2, 0.2)
			poly.append(Vector2(top.x + cos(a) * w * 0.5 * rng.randf_range(0.7, 1.1), top.z + sin(a) * w * 0.5 * rng.randf_range(0.7, 1.1)))
		var st := _iv_st(); _iv_prism(st, poly, top.y, top.y - 40.0, rng, 0.9, true, 2.5)
		_iv_commit(st, "rock", self, float(f[4]), {"fog_hi": top.y - 3.0, "fog_lo": top.y - 24.0})
	# a colonnade on the second spire's crown
	var ct: Vector3 = spot.call(-4.0, 11.5, 34.0)
	var cs := _iv_st()
	for k in 6:
		var px := ct + bx * (-2.6 + float(k) * 1.05)
		_iv_box(cs, px + Vector3(-0.28, 0, -0.28), px + Vector3(0.28, 3.4, 0.28))
	_iv_bar(cs, ct + bx * -2.9 + Vector3(0, 3.4, 0), ct + bx * 2.9 + Vector3(0, 3.4, 0), 0.8, 0.6)
	_iv_commit(cs, "marble", self, 0.3, {"fog_hi": ct.y - 3.0, "fog_lo": ct.y - 24.0})
	# the colossus (the first statue, they say, that he made of her) far to the left
	var cl: Vector3 = spot.call(-6.5, 15.0, 44.0)
	var sp := _iv_st(); _iv_prism(sp, [Vector2(cl.x - 2.5, cl.z - 2.0), Vector2(cl.x + 2.5, cl.z - 2.5), Vector2(cl.x + 2.8, cl.z + 2.0), Vector2(cl.x - 2.2, cl.z + 2.6)], cl.y, cl.y - 40.0, rng, 0.8, true, 2.0)
	_iv_commit(sp, "rock", self, 0.38, {"fog_hi": cl.y - 3.0, "fog_lo": cl.y - 24.0})
	var col := prop_model("broken_statue", self, 13.0)
	col.position = cl; col.rotation.y = PI * 0.25
	for m in col.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _iv_mat("marble", 0.36, {"fog_hi": cl.y + 2.0, "fog_lo": cl.y - 20.0}); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _iv_focus() -> Vector3:
	if iv_hold != null: return iv_hold
	return pos + Vector3(-0.9, 1.5, -0.9)

func _iv_overlay(cl: CanvasLayer, file: String, at: Vector2, sz: Vector2) -> TextureRect:
	var tr := TextureRect.new(); tr.texture = load(file); tr.stretch_mode = TextureRect.STRETCH_SCALE; tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.position = at; tr.size = sz; tr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(tr)
	return tr

## the world of the chapter out of the picture: its sea, its mists, its birds, her other bodies and her image below
func _iv_hide_world() -> void:
	for fm in fogs: (fm as ShaderMaterial).set_shader_parameter("dens", 0.0)
	for ch in get_children():
		if ch is MeshInstance3D and (ch as MeshInstance3D).material_override == sea_mat: iv_hidden.append(ch)
	if sky != null: iv_hidden.append(sky)
	for ch in cam.get_children():
		if ch is CPUParticles3D or ch is GPUParticles3D: iv_hidden.append(ch)
	for g in gulls: iv_hidden.append(g)
	for hm in her_mats: (hm as ShaderMaterial).next_pass = null      # (no water here: no image of her below)
	for nd in iv_hidden: (nd as Node3D).visible = false
	for dct in [H, SHP]:
		for hk in dct:
			if String(hk) == "main": continue
			for mm in (dct[hk].holder as Node).find_children("*", "MeshInstance3D", true, false): (mm as MeshInstance3D).layers = 0
	sun_light.look_at_from_position(Vector3.ZERO, -iv_key.normalized(), Vector3.UP)
	sun_light.directional_shadow_max_distance = 60.0
	sun_light.shadow_blur = 1.0
	for c in get_children():      # (the sea's blue shade at the edges of the screen and its rays of light: not here)
		if c is CanvasLayer:
			for t in c.get_children():
				if t is TextureRect and (t as TextureRect).texture is GradientTexture2D: (t as TextureRect).visible = false

func _iv_begin() -> void:
	if ivp_on:
		_iv_hide_world(); _ivp_begin(); _iv_card_warm(title_box); _iv_card_warm(end_box); return
	_iv_hide_world()
	cam.rotation_degrees.y = MW_YAW; cam_pitch = IV_PITCH
	var bm := ShaderMaterial.new(); var bs := Shader.new(); bs.code = IV_BG_SH; bm.shader = bs
	for i in 3: bm.set_shader_parameter(["bg_top", "bg_mid", "bg_bot"][i], Color(String(IV_BG[i])))
	bm.set_shader_parameter("uv_flip", iv_uvf)
	var bq := QuadMesh.new(); bq.size = Vector2(900, 900)
	var bg := MeshInstance3D.new(); bg.mesh = bq; bg.material_override = bm; bg.position = Vector3(0, 0, -140.0); bg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; cam.add_child(bg)
	_iv_build()
	pos = iv_nodes["a0"]; yaw = PI; route.clear()
	cam.size = 15.0
	cam_t = _iv_focus() + Vector3(-1.5, 1.5, -1.5); cam_focus = cam_t; cam_focus_on = true
	# the dark leaves and rocks before the eye, the warm shade in the corners, the fade
	var k := get_viewport().get_visible_rect().size.x / 720.0
	var vh := get_viewport().get_visible_rect().size.y
	var cl := CanvasLayer.new(); cl.layer = 1; add_child(cl)
	var vg := Gradient.new(); vg.offsets = PackedFloat32Array([0.0, 0.45, 0.8, 1.0])
	vg.colors = PackedColorArray([Color(0.3, 0.2, 0.12, 0), Color(0.3, 0.2, 0.12, 0), Color(0.3, 0.2, 0.12, 0.1), Color(0.3, 0.2, 0.12, 0.28)])
	var vt := GradientTexture2D.new(); vt.gradient = vg; vt.fill = GradientTexture2D.FILL_RADIAL; vt.fill_from = Vector2(0.5, 0.48); vt.fill_to = Vector2(1.15, 0.48); vt.width = 256; vt.height = 256
	var vr := TextureRect.new(); vr.texture = vt; vr.stretch_mode = TextureRect.STRETCH_SCALE; vr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vr.set_anchors_preset(Control.PRESET_FULL_RECT); vr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(vr)
	iv_leaves = _iv_overlay(cl, "res://goiv/leaves_tl.png", Vector2(-70, -90) * k, Vector2(470, 470) * k)
	_iv_overlay(cl, "res://goiv/rock_bl.png", Vector2(-60 * k, vh - 380 * k), Vector2(430, 430) * k)
	_iv_overlay(cl, "res://goiv/rock_br.png", Vector2(720 * k - 380 * k, vh - 360 * k), Vector2(430, 430) * k)
	var cl2 := CanvasLayer.new(); cl2.layer = 5; add_child(cl2)
	iv_fade = ColorRect.new(); iv_fade.color = Color(0.86, 0.92, 1.0, 0.0) if go_moon else Color(1.0, 0.95, 0.86, 0.0); iv_fade.set_anchors_preset(Control.PRESET_FULL_RECT); iv_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl2.add_child(iv_fade)
	for ql in quote_lbls:
		var l := ql as Label
		if l.get_theme_constant("outline_size") == 0: l.add_theme_color_override("font_color", Color(0.3, 0.21, 0.15, 1))
		else: l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0))
	hint.add_theme_color_override("font_color", Color(0.3, 0.21, 0.15, 1)); hint.add_theme_color_override("font_outline_color", Color(1, 0.95, 0.85, 0.6))
	_iv_card_warm(title_box); _iv_card_warm(end_box)

## the cards (the title, the end) in this place's own warm shade, and its name
func _iv_card_warm(box: Control) -> void:
	for ch in box.get_children():
		if ch is TextureRect and (ch as TextureRect).texture is GradientTexture2D:
			var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 0.17, 0.3, 0.38, 0.47, 0.64, 1.0])
			var cs := PackedColorArray()
			for va in [0.5, 0.16, 0.34, 0.42, 0.32, 0.08, 0.4]: cs.append(Color(0.3, 0.2, 0.13, va))
			g.colors = cs
			var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill_from = Vector2(0.5, 0.0); gt.fill_to = Vector2(0.5, 1.0); gt.width = 8; gt.height = 256
			(ch as TextureRect).texture = gt

func _iv_pre(_dt: float) -> void:
	if ivp_on: _ivp_pre(_dt); return
	if iv_root == null: return
	pos.y = _iv_height(pos)

func _iv_post(dt: float) -> void:
	for dct in [H, SHP]:
		for hk in dct:
			if String(hk) != "main": (dct[hk].holder as Node3D).visible = false
	for nd in iv_hidden: (nd as Node3D).visible = false
	if iv_root == null: return
	if ivp_on: _ivp_post(dt)
	else:
		pos.y = _iv_height(pos)
		cam_focus = _iv_focus(); cam_focus_on = true
	if not iv_push.is_empty() and not ivp_on:      # the stone goes before her hands
		var dv: Vector3 = iv_push.d
		var pr := clampf((pos - (iv_push.start as Vector3)).dot(dv), 0.0, float(iv_push.len))
		var bp: Vector3 = (iv_push.m0 as Vector3) + dv * pr
		iv_block_n.global_position = bp
		var face := bp - dv * 0.6 + Vector3(0, 0.88, 0)
		var sd := Vector3(-dv.z, 0, dv.x) * 0.22
		tgtL = face + sd; tgtR = face - sd
	iv_t += dt
	for mk in iv_mats:
		if not String(mk).contains("fog_hi"): (iv_mats[mk] as ShaderMaterial).set_shader_parameter("fog_ref", cam_t.y)
	if iv_glow == null: return
	var pl := 0.5 + 0.5 * sin(iv_t * 2.2)
	(iv_glow.material_override as StandardMaterial3D).albedo_color.a = (0.16 + 0.14 * pl) if ivp_on else (0.5 + 0.35 * pl)
	if not iv_won: iv_glow.scale = Vector3.ONE * (0.92 + 0.12 * pl)
	if iv_leaves != null: iv_leaves.pivot_offset = Vector2.ZERO; iv_leaves.rotation = deg_to_rad(1.3 * sin(iv_t * 0.9) + 0.6 * sin(iv_t * 2.3))
	if started and ivp_on:
		if not iv_said.has("line") and iv_t > 1.6: iv_said["line"] = true; _go_write(_ivg_line(), 4.5)
	elif started:
		if not iv_said.has("line") and iv_t > 1.2 and (not go_wake or ivw_awake): iv_said["line"] = true; _go_write(_ivg_line(), 4.5)
		if not iv_said.has("hint") and iv_t > 8.0 and iv_moves == 0 and not go_wake: iv_said["hint"] = true; say("tap the way to walk")

func _iv_scr(p: Vector3, sp: Vector2) -> float: return cam.unproject_position(p).distance_to(sp)

func _iv_tap(sp: Vector2) -> void:
	if ivp_on: await _ivp_tap(sp); return
	if iv_busy or iv_won or busy: return
	var px := get_viewport().get_visible_rect().size.x / 720.0
	if _iv_scr(iv_wheel.global_position, sp) < 70.0 * px: iv_moves += 1; await _iv_lever(); return
	if _iv_scr(iv_block_n.global_position + Vector3(0, 0.55, 0), sp) < 62.0 * px: iv_moves += 1; await _iv_try_push(); return
	var best := ""; var bd := 80.0 * px
	for k in iv_nodes:
		if k == "e0" and not iv_bridge_up: continue
		var d2 := _iv_scr(iv_nodes[k], sp)
		if d2 < bd: bd = d2; best = String(k)
	if best == "" or best == iv_me: return
	var path := _iv_path(iv_me, best)
	if path.is_empty(): await _her_no(); return
	iv_moves += 1
	await _iv_walk(path)

func _iv_walk(path: Array) -> void:
	iv_busy = true
	route.clear(); speed_cap = PLAY_WALK; face_to = null
	for k in path: route.append({"p": iv_nodes[k]})
	iv_me = String(path[-1])
	while not route.is_empty(): await get_tree().process_frame
	iv_busy = false
	if iv_me == "g1": await _iv_win()

func _iv_lever() -> void:
	if iv_bridge_up: await _her_no(); return
	if iv_me != "b1":
		var path := _iv_path(iv_me, "b1")
		if path.is_empty(): await _her_no(); return
		await _iv_walk(path)
	iv_busy = true
	var wp: Vector3 = iv_wheel.global_position
	face_to = wp
	var n := 0
	while face_to != null and n < 90: await get_tree().process_frame; n += 1
	tgtL = wp + Vector3(-0.3, 0.32, 0.1); tgtR = wp + Vector3(-0.3, -0.12, -0.1)
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.35); up.tween_property(self, "a_wR", 1.0, 0.35); up.tween_property(self, "a_lean", 0.1, 0.35)
	await up.finished
	var sp := create_tween(); sp.tween_property(iv_wheel, "rotation:z", iv_wheel.rotation.z - TAU * 1.25, 1.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await sp.finished
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.4); dn.tween_property(self, "a_wR", 0.0, 0.4); dn.tween_property(self, "a_lean", 0.0, 0.4)
	print("IV the volute is turned: the pillar rises")
	iv_hold = (iv_nodes["e0"] as Vector3) + Vector3(0, -1.2, 0)
	await wait(0.7)
	var rs := create_tween(); rs.tween_property(iv_bridge_n, "position:y", 0.0, 2.8).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	await rs.finished
	iv_bridge_up = true
	await wait(0.6)
	iv_hold = null
	await wait(0.6)
	iv_busy = false

func _iv_try_push() -> void:
	var cands := []
	for n in _iv_nbrs(iv_block):
		if String(_iv_edge(n, iv_block)[2]) != "flat": continue
		var bp: Vector3 = iv_nodes[iv_block]; var np: Vector3 = iv_nodes[n]
		var dest := _iv_node_at(bp + (bp - np))
		if dest == "" or _iv_edge(iv_block, dest).is_empty() or String(_iv_edge(iv_block, dest)[2]) != "flat": continue
		var path := [] if n == iv_me else _iv_path(iv_me, n)
		if n != iv_me and path.is_empty(): continue
		cands.append([path.size(), n, dest, path])
	if cands.is_empty(): await _her_no(); return
	cands.sort_custom(func(a: Array, b: Array) -> bool: return int(a[0]) < int(b[0]))
	var c: Array = cands[0]
	if not (c[3] as Array).is_empty(): await _iv_walk(c[3])
	await _iv_do_push(String(c[2]))

func _iv_do_push(dest: String) -> void:
	iv_busy = true
	var bp: Vector3 = iv_nodes[iv_block]; var tp: Vector3 = iv_nodes[dest]
	var dv := Vector3(tp.x - bp.x, 0, tp.z - bp.z).normalized()
	var reach := 1.05
	var start := bp - dv * reach
	iv_push = {"d": dv, "start": start, "m0": bp, "len": Vector2(tp.x - bp.x, tp.z - bp.z).length()}
	print("IV push ", iv_block, " -> ", dest)
	route.clear(); speed_cap = 1.25; face_to = null
	if _flat(pos, start) > 0.06: route.append({"p": start})
	route.append({"p": tp - dv * reach})
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.3); up.tween_property(self, "a_wR", 1.0, 0.3); up.tween_property(self, "a_lean", 0.14, 0.3)
	while not route.is_empty(): await get_tree().process_frame
	iv_block_n.global_position = tp
	iv_me = iv_block; iv_block = dest; iv_push = {}
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.35); dn.tween_property(self, "a_wR", 0.0, 0.35); dn.tween_property(self, "a_lean", 0.0, 0.35)
	await dn.finished
	iv_busy = false

func _iv_win() -> void:
	iv_won = true
	print("IV level done in ", iv_moves, " moves")
	var gm := iv_glow.material_override as StandardMaterial3D
	var f := create_tween().set_parallel()
	f.tween_property(iv_glow, "scale", Vector3.ONE * 3.2, 1.6).set_trans(Tween.TRANS_SINE)
	f.tween_property(iv_fade, "color:a", 1.0, 2.2).set_delay(0.9)
	await wait(1.0)
	_go_write(String(ivg.get("end", "None of them would breathe.")) if ivg_on else "None of them would breathe.", 3.0)      # (each level its own last line)
	await wait(2.6)
	gm.albedo_color.a = 0.0
	_end()

## (the level played through by its own way: FLIP=goiv ... -- godemo)
func _play_iv() -> void:
	if ivp_on: await _play_ivp(); return
	var dir := OS.get_environment("SHOT_DIR")
	var snap := func(n: String) -> void:
		if dir != "": await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, n])
	var idle := func() -> void:
		var still := 0
		while still < 8:
			await get_tree().process_frame
			still = still + 1 if (not busy and not iv_busy and route.is_empty()) else 0
	var tapw := func(p: Vector3) -> void:
		_go_tap(cam.unproject_position(p)); await get_tree().process_frame
		await idle.call(); await wait(0.35)
	await get_tree().create_timer(2.2).timeout
	await snap.call("i0_title")
	tap(Vector2(360, 640)); await wait(3.6); await snap.call("i1_start")
	if OS.get_environment("GH_ONLY") == "start":
		if OS.get_environment("IV_WIDE") != "":
			var tws := create_tween(); tws.tween_property(cam, "size", float(OS.get_environment("IV_WIDE")), 0.01); await wait(2.5); await snap.call("i1_wide")
		get_tree().quit(); return
	await tapw.call(iv_nodes["b1"]); await snap.call("i2_at_volute")
	await tapw.call(iv_wheel.global_position); await snap.call("i3_pillar")
	await tapw.call(iv_block_n.global_position + Vector3(0, 0.55, 0)); await snap.call("i4_pushed")
	await tapw.call(iv_nodes["d1"]); await snap.call("i5_upper")
	await tapw.call(iv_nodes["g0"]); await snap.call("i6_top")
	await tapw.call(iv_nodes["g1"])
	var n2 := 0
	while not ended and n2 < 900: await get_tree().process_frame; n2 += 1
	await wait(1.5); await snap.call("i9_end")
	print("IV ended: ", ended)
	get_tree().quit()


# ---------------------------------------------------------------- Eidolon GO, ivory: the painted level
## The level as its own picture (unless IV_MODE=3d): the picture is the world the eye sees, from the very same eye
## (looking down 35 degrees, turned 45, without perspective); what moves in it (she, the meander stone, the volute
## and its cloth, the light of the ring) is made in 3D over it. Where she can go is the picture's own way: nodes at
## points of the picture, each at the height it stands at.
## The puzzle: the meander stone stands at the head of the first stair. She pushes it on to come up, and it comes to
## rest at the foot of the next stair, closing it. The volute at the edge of the floor is the stone's key: turned, it
## lets the stone down into its bed, flush with the floor, and the way up is open.
const IVP_S := 206.0      # pixels of the picture to a metre
const IVP_TH := 35.0      # how steeply the picture's eye looks down
const IVP_W := 1536.0
const IVP_H := 2752.0
const IVP_O := Vector2(950.0, 1684.0)      # the level's origin (on the middle floor), in the picture
const IVP_REACH := 0.74      # from the stone's middle to her, when her hands are on it
const IVP_BG_SH := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
uniform sampler2D plate : source_color, filter_linear_mipmap;
uniform vec2 k = vec2(1.0);
void fragment(){ vec2 uv = vec2(0.5) + (SCREEN_UV - vec2(0.5)) * k; ALBEDO = texture(plate, uv).rgb; }
"""
var ivp_on := OS.get_environment("IV_MODE") != "3d"      # (the painted level and the 3D one play by the same way)
var ivp_nodes := {}      # name -> where (world)
var ivp_edges := []      # [a, b, the points between them on the way (world)]
var ivp_wp_prev := Vector3.ZERO
var ivp_wp_cur := Vector3.INF
var ivp_sunk := false
var ivp_bg: ShaderMaterial
var ivp_shadow: MeshInstance3D
var ivp_bshadow: MeshInstance3D
var ivp_intro := false

func _ivp_basis() -> Basis: return Basis.from_euler(Vector3(deg_to_rad(-IVP_TH), deg_to_rad(MW_YAW), 0.0))

## a point of the picture (its pixels), standing at a height: where that is in the world
func _ivp_at(px: Vector2, h: float) -> Vector3:
	var b := _ivp_basis()
	var u := (px.x - IVP_O.x) / IVP_S; var v := (IVP_O.y - px.y) / IVP_S
	var t := (h - b.y.y * v) / b.z.y
	return IV_O + b.x * u + b.y * v + b.z * t

## the eye: the picture's own, holding all of it (cut a little at the top and bottom, or the sides, to fit the screen)
func _ivp_cam() -> void:
	var b := _ivp_basis()
	var vp := get_viewport().get_visible_rect().size
	var wm := IVP_W / IVP_S; var hm := IVP_H / IVP_S
	var c := _ivp_at(Vector2(IVP_W * 0.5, IVP_H * 0.5), 0.0)
	cam.global_transform = Transform3D(b, c + b.z * 40.0)
	var k := Vector2.ONE
	if vp.y / vp.x > hm / wm:
		cam.keep_aspect = Camera3D.KEEP_HEIGHT; cam.size = hm; k.x = (vp.x / vp.y) / (wm / hm)
	else:
		cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = wm; k.y = (vp.y / vp.x) / (hm / wm)
	if ivp_bg != null: ivp_bg.set_shader_parameter("k", k)

func _ivp_mat(kind: String) -> ShaderMaterial: return _iv_mat(kind, 0.0, {"fog_hi": -40.0, "fog_lo": -60.0})

func _ivp_flat_shadow(parent: Node3D, sz: Vector2, a: float) -> MeshInstance3D:
	var pm := PlaneMesh.new(); pm.size = sz
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_texture = load("res://goiv/shadow.png")
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.albedo_color = Color(1, 1, 1, a); m.cull_mode = BaseMaterial3D.CULL_DISABLED
	var mi := MeshInstance3D.new(); mi.mesh = pm; mi.material_override = m; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; parent.add_child(mi)
	return mi

## the stone: a block of marble a little taller than wide, a Greek key cut on each side
func _ivp_block(parent: Node3D, s := 0.72, h := 0.84) -> Node3D:
	var n := Node3D.new(); parent.add_child(n)
	var st := _iv_st()
	_iv_box(st, Vector3(-s * 0.5, 0, -s * 0.5), Vector3(s * 0.5, h, s * 0.5))
	var u := s / 7.0; var hu := h / 7.0; var pr := 0.022; var bw := u * 0.5
	var key := [Vector2(1, 1), Vector2(6, 1), Vector2(6, 6), Vector2(1.9, 6), Vector2(1.9, 2.9), Vector2(4.1, 2.9), Vector2(4.1, 4.1)]
	for f in 4:
		var ax := Basis(Vector3.UP, PI * 0.5 * f)
		var out := ax * Vector3(0, 0, 1)
		var right := ax * Vector3(1, 0, 0)
		var org := out * (s * 0.5) - right * (s * 0.5)
		for k in key.size() - 1:
			var a: Vector2 = key[k]; var b: Vector2 = key[k + 1]
			var pa := org + right * (a.x * u) + Vector3(0, a.y * hu, 0)
			var pb := org + right * (b.x * u) + Vector3(0, b.y * hu, 0)
			var dd := pb - pa; dd = dd.normalized()
			var side := dd.cross(out).normalized() * (bw * 0.5)
			var e0 := pa - dd * (bw * 0.5); var e1 := pb + dd * (bw * 0.5)
			_iv_hexa(st, [e0 - side, e1 - side, e1 + side, e0 + side, e0 - side + out * pr, e1 - side + out * pr, e1 + side + out * pr, e0 + side + out * pr])
	var mi := MeshInstance3D.new(); mi.mesh = st.commit(); mi.material_override = _ivp_mat("pmarble"); n.add_child(mi)
	return n

## the volute: a stone scroll lying along the floor, its spiral face to the eye; a red cloth over it, its end lying
## along the floor; turned, the whole scroll rolls about its axis
func _ivp_volute(base: Vector3, r := 0.36, l := 0.7) -> void:
	iv_wheel = Node3D.new(); iv_root.add_child(iv_wheel)
	iv_wheel.global_position = base + Vector3(0, r, 0)
	var cm := CylinderMesh.new(); cm.top_radius = r; cm.bottom_radius = r; cm.height = l; cm.radial_segments = 36 if ivr_on else 14; cm.rings = 1
	var ci := MeshInstance3D.new(); ci.mesh = cm; ci.material_override = _ivp_mat("pmarble"); ci.rotation.x = PI * 0.5; iv_wheel.add_child(ci)
	var sp := _iv_st()
	for zf in [-1.0, 1.0]:
		if ivr_on:      # (the scroll's spiral: one smooth ridge winding in, as carved, not a row of blocks)
			var cs := []
			for k in 150:
				var t := float(k) / 149.0
				var a := t * TAU * 2.4; var rr := r * 0.9 * (1.0 - t * 0.85)
				cs.append(Vector3(cos(a) * rr, sin(a) * rr, zf * l * 0.5))
			var o := Vector3(0, 0, zf * 0.05)
			var ins := []; var outs := []
			for k in cs.size():
				var tg: Vector3 = (cs[mini(k + 1, cs.size() - 1)] - cs[maxi(k - 1, 0)]).normalized()
				var side := Vector3(-tg.y, tg.x, 0) * 0.034
				ins.append(cs[k] - side); outs.append(cs[k] + side)
			for k in cs.size() - 1:
				var i0: Vector3 = ins[k]; var i1: Vector3 = ins[k + 1]; var o0: Vector3 = outs[k]; var o1: Vector3 = outs[k + 1]
				_iv_quad(sp, i0 + o, o0 + o, o1 + o, i1 + o, Vector3(0, 0, zf))
				_iv_quad(sp, o0, o1, o1 + o, o0 + o, o0 - Vector3(0, 0, o0.z))
				_iv_quad(sp, i0, i1, i1 + o, i0 + o, -(i0 - Vector3(0, 0, i0.z)))
			continue
		var prev := Vector3.ZERO; var first := true
		for k in 70:
			var t := float(k) / 69.0
			var a := t * TAU * 2.4
			var rr := r * 0.9 * (1.0 - t * 0.85)
			var q := Vector3(cos(a) * rr, sin(a) * rr, zf * l * 0.5)
			if not first:
				var dd := q - prev; var side := Vector3(-dd.y, dd.x, 0).normalized() * (0.036 if ivr_on else 0.024)
				var o := Vector3(0, 0, zf * (0.05 if ivr_on else 0.03))
				_iv_hexa(sp, [prev - side, q - side, q + side, prev + side, prev - side + o, q - side + o, q + side + o, prev + side + o])
			prev = q; first = false
	var si := MeshInstance3D.new(); si.mesh = sp.commit(); si.material_override = _ivp_mat("pmarble"); iv_wheel.add_child(si)
	# the cloth: from the floor behind, over the scroll, down its far side and away along the floor
	var cl := _iv_st()
	var c0 := base
	var E := 0.62      # (where the floor ends, along the cloth's way: there it goes down over the edge)
	if ivr_on and not ivr_floors.is_empty():
		var ed := _ivr_edge_dist(base, Vector3(1, 0, 0))
		if ed > 0.5: E = ed + 0.04
	var pts := [c0 + Vector3(-0.6, 0.01, -0.05), c0 + Vector3(-0.36, 0.02, -0.05), c0 + Vector3(-0.22, r * 1.65, -0.05), c0 + Vector3(0.0, r * 2.06, -0.05), c0 + Vector3(0.24, r * 1.7, -0.05),
		c0 + Vector3(0.38, r * 0.9, -0.05), c0 + Vector3(0.44, 0.02, -0.05), c0 + Vector3(E, 0.012, -0.05), c0 + Vector3(E + 0.07, -0.06, -0.05), c0 + Vector3(E + 0.09, -0.5, -0.05), c0 + Vector3(E + 0.12, -1.25, -0.05), c0 + Vector3(E + 0.15, -1.9, -0.05)]
	var w := Vector3(0, 0, 0.27)
	for k in pts.size() - 1:
		var a: Vector3 = pts[k]; var b: Vector3 = pts[k + 1]
		var ws := w * (1.0 + 0.05 * sin(float(k) * 1.7))
		_iv_quad(cl, a - ws, b - ws, b + ws, a + ws, Vector3(0, 1, 0) + (a - c0).normalized() * 0.5)
	var cmi := MeshInstance3D.new(); cmi.mesh = cl.commit(); iv_root.add_child(cmi)
	if ivr_on:
		var bs := _iv_st()
		for yb in [-1.42, -1.56]:
			var y0: float = c0.y + float(yb)
			var xx: float = c0.x + E + 0.15 * ((y0 - c0.y) / -1.9) + 0.006
			_iv_quad(bs, Vector3(xx, y0, c0.z - 0.05 - 0.27), Vector3(xx, y0, c0.z - 0.05 + 0.27), Vector3(xx, y0 + 0.055, c0.z - 0.05 + 0.27), Vector3(xx, y0 + 0.055, c0.z - 0.05 - 0.27), Vector3(1, 0, 0))
		var bmi := MeshInstance3D.new(); bmi.mesh = bs.commit(); iv_root.add_child(bmi); bmi.global_position = Vector3.ZERO; bmi.position = -IV_O
		bmi.material_override = _iv_mat("marble2", 0.0, {"fog_hi": base.y - IV_O.y - 0.7, "fog_lo": base.y - IV_O.y - 2.6})
	var fy := base.y - IV_O.y      # (in the level built in 3D, the cloth hanging over the edge goes into the mist as the rock does)
	cmi.material_override = _iv_mat("pterra", 0.0, {"fog_hi": fy - 0.7, "fog_lo": fy - 2.6}) if ivr_on else _ivp_mat("pterra")
	cmi.global_position = Vector3.ZERO; cmi.position = -IV_O

func _ivp_build() -> void:
	iv_root = Node3D.new(); iv_root.position = IV_O; add_child(iv_root)
	var ps := Shader.new(); ps.code = IVP_BG_SH
	ivp_bg = ShaderMaterial.new(); ivp_bg.shader = ps; ivp_bg.set_shader_parameter("plate", load("res://goiv/plate.jpg"))
	var bq := QuadMesh.new(); bq.size = Vector2(900, 900)
	var bg := MeshInstance3D.new(); bg.mesh = bq; bg.material_override = ivp_bg; bg.position = Vector3(0, 0, -140.0); bg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; cam.add_child(bg)
	var P := func(x: float, y: float, h: float) -> Vector3: return _ivp_at(Vector2(x, y), h)
	ivp_nodes = {"s": P.call(640.0, 2700.0, -2.3), "n0": P.call(422.0, 2470.0, -1.25), "n1": P.call(227.0, 2357.0, -1.25), "n2": P.call(422.0, 2242.0, -1.25),
		"t1": P.call(690.0, 1862.0, 0.0), "b0": P.call(775.0, 1802.0, 0.0), "i1": P.call(950.0, 1688.0, 0.0), "v": P.call(960.0, 1902.0, 0.0), "n": P.call(1192.0, 1762.0, 0.0),
		"l": P.call(1240.0, 1430.0, 0.7), "t2": P.call(775.0, 1025.0, 1.5), "r": P.call(1220.0, 648.0, 2.3)}
	ivp_edges = [["s", "n0", [P.call(470.0, 2515.0, -1.25)]], ["n0", "n1", []], ["n1", "n2", []],
		["n2", "t1", [P.call(512.0, 2178.0, -1.25)]], ["t1", "b0", []], ["b0", "i1", []], ["b0", "v", []], ["v", "n", []],
		["i1", "l", [P.call(1050.0, 1622.0, 0.0), P.call(1160.0, 1440.0, 0.7)]],
		["l", "t2", [P.call(1185.0, 1395.0, 0.7), P.call(955.0, 1132.0, 1.5)]],
		["t2", "r", [P.call(950.0, 930.0, 1.5), P.call(1120.0, 722.0, 2.3)]]]
	iv_me = "s"; iv_block = "b0"
	iv_block_n = _ivp_block(iv_root); iv_block_n.global_position = ivp_nodes["b0"]
	var pm := PlaneMesh.new(); pm.size = Vector2(2.7, 2.7)
	var patch := MeshInstance3D.new(); patch.mesh = pm; patch.material_override = ivp_bg; patch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	iv_root.add_child(patch); patch.global_position = (ivp_nodes["i1"] as Vector3) + Vector3(0.55, -0.002, 0.55)
	ivp_bshadow = _ivp_flat_shadow(iv_root, Vector2(1.5, 1.0), 0.55)
	ivp_bshadow.global_position = (ivp_nodes["b0"] as Vector3) + Vector3(0.42, 0.012, -0.18)
	var nw: Vector3 = ivp_nodes["n"]
	_ivp_volute(nw + Vector3(0.38, 0.0, -0.66))
	ivp_shadow = _ivp_flat_shadow(iv_root, Vector2(0.95, 0.62), 0.6)
	iv_ring = Node3D.new(); iv_root.add_child(iv_ring); iv_ring.global_position = ivp_nodes[ivg_exit if ivg_on else "r"]
	var gq := QuadMesh.new(); gq.size = Vector2(1.3, 1.3)
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_texture = load("res://goiv/glow.png")
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; gm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; gm.albedo_color = Color(1.0, 0.96, 0.86, 0.3)
	iv_glow = MeshInstance3D.new(); iv_glow.mesh = gq; iv_glow.material_override = gm; iv_glow.position = Vector3(0, 0.25, 0); iv_glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_ring.add_child(iv_glow)

func _ivp_begin() -> void:
	RenderingServer.global_shader_parameter_set("sea_y", -80.0)      # (no sea here: nothing of her goes under its mist)
	for hm in her_mats:      # she is seen as the picture shows her: no haze of distance on her; smooth white marble in terracotta bands, lit by this place's sun
		var sm := hm as ShaderMaterial
		sm.set_shader_parameter("mist_k", 0.0); sm.set_shader_parameter("flat_n", 0.0)
		if ivr_on:
			sm.set_shader_parameter("iv_look", 1.0); sm.set_shader_parameter("iv_key", iv_key)
			sm.set_shader_parameter("iv_skin_lt", Color("f7eadc")); sm.set_shader_parameter("iv_skin_dk", Color("bc9f87"))
			if OS.get_environment("IV_HDBG") != "": sm.set_shader_parameter("iv_skin_lt", Color(1, 0, 0)); sm.set_shader_parameter("iv_skin_dk", Color(0, 0, 1))
			sm.set_shader_parameter("iv_cloth_lt", Color("b45d3b")); sm.set_shader_parameter("iv_cloth_dk", Color("6a2c1f")); sm.set_shader_parameter("iv_shade", Color(0.74, 0.78, 0.9) if go_drown else (Color(0.66, 0.72, 0.9) if go_moon else (Color(0.84, 0.76, 0.86) if go_wake else Color(0.86, 0.79, 0.74))))
	if ivr_on:
		get_viewport().msaa_3d = Viewport.MSAA_4X      # (its edges smooth, as the picture's are)
		_ivr_build()
	else: _ivp_build()
	var s0: Vector3 = ivp_nodes["s"]; var s1: Vector3 = ivp_nodes[String(ivg.start) if ivg_on else "n0"]
	pos = s0; yaw = atan2(s1.x - s0.x, s1.z - s0.z); route.clear()
	ivp_wp_cur = s0; ivp_wp_prev = s0
	if ivr_on: _ivr_cam()
	else: _ivp_cam()
	var cl2 := CanvasLayer.new(); cl2.layer = 5; add_child(cl2)
	iv_fade = ColorRect.new(); iv_fade.color = Color(0.86, 0.92, 1.0, 0.0) if go_moon else Color(1.0, 0.95, 0.86, 0.0); iv_fade.set_anchors_preset(Control.PRESET_FULL_RECT); iv_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl2.add_child(iv_fade)

func _ivp_pre(_dt: float) -> void:
	if iv_root == null: return
	if not route.is_empty():
		var nxt: Vector3 = route[0].p
		if nxt != ivp_wp_cur:
			ivp_wp_prev = ivp_wp_cur if ivp_wp_cur != Vector3.INF else pos
			ivp_wp_cur = nxt
		var a := Vector2(ivp_wp_prev.x, ivp_wp_prev.z); var b := Vector2(nxt.x, nxt.z)
		var t := clampf(a.distance_to(Vector2(pos.x, pos.z)) / maxf(a.distance_to(b), 1e-4), 0.0, 1.0)
		pos.y = lerpf(ivp_wp_prev.y, nxt.y, t)
	elif ivp_wp_cur != Vector3.INF: pos.y = ivp_wp_cur.y

func _ivp_post(dt: float) -> void:
	_ivp_pre(dt)
	if ivr_on: _ivr_cam()
	else: _ivp_cam()
	cam_t = pos; cam_focus = pos; cam_focus_on = true      # (the world's own mist and lights keep to her)
	if not iv_push.is_empty():      # the stone goes before her hands
		var dv: Vector3 = iv_push.d
		var pr := clampf((pos - (iv_push.start as Vector3)).dot(dv), 0.0, float(iv_push.len))
		var bp: Vector3 = (iv_push.m0 as Vector3) + dv * pr
		iv_block_n.global_position = bp
		if ivp_bshadow != null: ivp_bshadow.global_position = bp + Vector3(0.42, 0.012, -0.18)
		var face := bp - dv * 0.42 + Vector3(0, 0.66, 0)
		var sd := Vector3(-dv.z, 0, dv.x) * 0.2
		tgtL = face + sd; tgtR = face - sd
	if ivp_shadow != null: ivp_shadow.global_position = Vector3(pos.x, pos.y + 0.01, pos.z) + Vector3(0.3, 0.0, -0.14)
	if go_wake: _ivw_tick(dt)
	if not go_text_styled: _go_restyle_text()
	if started and not ivp_intro:      # she comes up out of the mist to the first floor
		ivp_intro = true
		if go_wake and OS.get_environment("IVW_SKIP") != "": ivw_awake = true; iv_me = String(ivg.start)
		elif go_wake: _ivw_rise()      # (the first level: she wakes where she lies, and rises)
		else: _ivp_walk([String(ivg.start) if ivg_on else "n0"])

func _ivp_nbrs(k: String) -> Array:
	var out := []
	for e in ivp_edges:
		if e[0] == k: out.append(String(e[1]))
		elif e[1] == k: out.append(String(e[0]))
	return out

func _ivp_edge(a: String, b: String) -> Array:
	for e in ivp_edges:
		if (e[0] == a and e[1] == b) or (e[0] == b and e[1] == a): return e
	return []

func _ivp_path(a: String, b: String) -> Array:
	var blocked := "" if ivp_sunk else iv_block
	if b == blocked: return []
	var prev := {a: ""}; var q := [a]
	while not q.is_empty():
		var k: String = q.pop_front()
		if k == b: break
		for n in _ivp_nbrs(k):
			if prev.has(n) or n == blocked: continue
			prev[n] = k; q.append(n)
	if not prev.has(b): return []
	var path := []; var k2 := b
	while k2 != a: path.push_front(k2); k2 = String(prev[k2])
	return path

func _ivp_walk(path: Array) -> void:
	iv_busy = true
	route.clear(); speed_cap = PLAY_WALK * 0.8; face_to = null
	var last := iv_me
	for k in path:
		var e := _ivp_edge(last, String(k))
		var mids: Array = (e[2] as Array).duplicate() if not e.is_empty() else []
		if not e.is_empty() and e[0] != last: mids.reverse()
		for m in mids: route.append({"p": m})
		route.append({"p": ivp_nodes[k]})
		last = String(k)
	iv_me = last
	while not route.is_empty(): await get_tree().process_frame
	iv_busy = false
	if (not ivg_on and iv_me == "r") or (ivg_on and iv_me == ivg_exit): await _iv_win()

func _ivp_tap(sp: Vector2) -> void:
	if iv_busy or iv_won or busy or not ivp_intro:
		if OS.get_environment("IV_TRACE") != "": print("IV tap ignored: busy ", iv_busy, " ", busy, " won ", iv_won)
		return
	if ivg_on:      # a tap on a node beside her (or on the stone, or the volute, beside her) is a step that way
		var pxg := get_viewport().get_visible_rect().size.x / 720.0
		var bestg := ""; var bdg := 80.0 * pxg
		for n in _ivp_nbrs(iv_me):
			if n == "s": continue
			var at: Vector3 = ivp_nodes[n]
			if n == iv_block: at = iv_block_n.global_position + Vector3(0, 0.42, 0)
			elif n == ivg_vol: at = iv_wheel.global_position
			var dg := _iv_scr(at, sp)
			if dg < bdg: bdg = dg; bestg = String(n)
		if bestg != "": await _ivg_turn(bestg)
		return
	var px := get_viewport().get_visible_rect().size.x / 720.0
	if not ivp_sunk and _iv_scr(iv_wheel.global_position, sp) < 70.0 * px: iv_moves += 1; await _ivp_turn(); return
	if not ivp_sunk and _iv_scr(iv_block_n.global_position + Vector3(0, 0.42, 0), sp) < 66.0 * px: iv_moves += 1; await _ivp_try_push(); return
	var best := ""; var bd := 90.0 * px
	for k in ivp_nodes:
		var d2 := _iv_scr(ivp_nodes[k], sp)
		if d2 < bd: bd = d2; best = String(k)
	if best == "" or best == iv_me: return
	var path := _ivp_path(iv_me, best)
	if OS.get_environment("IV_TRACE") != "": print("IV tap ", best, " from ", iv_me, " path ", path)
	if path.is_empty(): await _her_no(); return
	iv_moves += 1
	await _ivp_walk(path)

## a swipe: one step, to the neighbour whose way lies, on the screen, nearest the swipe's direction (within 50 degrees)
func _ivg_swipe(dv: Vector2) -> void:
	if iv_busy or iv_won or busy or not ivp_intro: return
	var n := _ivg_dir_nbr(iv_me, dv)
	if OS.get_environment("IV_TRACE") != "": print("IV swipe ", dv, " from ", iv_me, " -> ", n)
	if n == "": await _her_no(); return
	await _ivg_step(n)

func _ivg_dir_nbr(k: String, dv: Vector2) -> String:
	var sp0 := cam.unproject_position(ivp_nodes[k])
	var best := ""; var bc := cos(deg_to_rad(50.0))
	for n in _ivp_nbrs(k):
		if n == "s": continue
		if not _ivw_open(k, String(n)): continue
		var sd := cam.unproject_position(ivp_nodes[n]) - sp0
		if sd.length() < 1.0: continue
		var c := sd.normalized().dot(dv.normalized())
		if c > bc: bc = c; best = String(n)
	return best

## one step of hers to a neighbouring node (the rules of the level's trial decide what else happens)
func _ivg_step(n: String) -> void:
	if ivg_on: await _ivg_turn(n); return
	if n == iv_block and not ivp_sunk: await _ivp_try_push(); return
	iv_moves += 1
	await _ivp_walk([n])

## from which neighbour can the stone be pushed on, straight along the way, to a free node beyond?
func _ivp_try_push() -> void:
	var k := iv_block
	var kp: Vector3 = ivp_nodes[k]
	var cands := []
	for p in _ivp_nbrs(k):
		if not (_ivp_edge(p, k)[2] as Array).is_empty(): continue
		var pp: Vector3 = ivp_nodes[p]
		var d := Vector3(kp.x - pp.x, 0, kp.z - pp.z).normalized()
		var q := ""
		for o in _ivp_nbrs(k):
			if o == p or not (_ivp_edge(k, o)[2] as Array).is_empty(): continue
			var op: Vector3 = ivp_nodes[o]
			if Vector3(op.x - kp.x, 0, op.z - kp.z).normalized().dot(d) > 0.9: q = o
		if q == "": continue
		var path := [] if p == iv_me else _ivp_path(iv_me, p)
		if p != iv_me and path.is_empty(): continue
		cands.append([path.size(), p, q, path])
	if cands.is_empty(): await _her_no(); return
	cands.sort_custom(func(a: Array, b: Array) -> bool: return int(a[0]) < int(b[0]))
	var c: Array = cands[0]
	if not (c[3] as Array).is_empty(): await _ivp_walk(c[3])
	await _ivp_do_push(String(c[2]))

func _ivp_do_push(q: String) -> void:
	iv_busy = true
	var kp: Vector3 = ivp_nodes[iv_block]; var qp: Vector3 = ivp_nodes[q]
	var dv := Vector3(qp.x - kp.x, 0, qp.z - kp.z).normalized()
	var start := kp - dv * IVP_REACH; start.y = kp.y
	var endp := qp - dv * IVP_REACH; endp.y = kp.y
	iv_push = {"d": dv, "start": start, "m0": kp, "len": Vector2(qp.x - kp.x, qp.z - kp.z).length()}
	print("IV push ", iv_block, " -> ", q)
	route.clear(); speed_cap = 1.0; face_to = null
	if _flat(pos, start) > 0.05: route.append({"p": start})
	route.append({"p": endp})
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.3); up.tween_property(self, "a_wR", 1.0, 0.3); up.tween_property(self, "a_lean", 0.16, 0.3)
	while not route.is_empty(): await get_tree().process_frame
	iv_block_n.global_position = qp
	if ivp_bshadow != null: ivp_bshadow.global_position = qp + Vector3(0.42, 0.012, -0.18)
	iv_me = iv_block; iv_block = q; iv_push = {}
	ivp_wp_cur = endp
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.35); dn.tween_property(self, "a_wR", 0.0, 0.35); dn.tween_property(self, "a_lean", 0.0, 0.35)
	await dn.finished
	iv_busy = false

## the volute: she turns it; if the stone stands on its bed at the foot of the stair, it goes down into the floor
func _ivp_turn() -> void:
	if iv_me != "n":
		var path := _ivp_path(iv_me, "n")
		if path.is_empty(): await _her_no(); return
		await _ivp_walk(path)
	iv_busy = true
	var wp: Vector3 = iv_wheel.global_position
	face_to = wp
	var n := 0
	while face_to != null and n < 90: await get_tree().process_frame; n += 1
	var fr := wp + Vector3(0, 0, 0.36)
	tgtL = fr + Vector3(-0.12, 0.2, 0.0); tgtR = fr + Vector3(0.12, -0.05, 0.0)
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.35); up.tween_property(self, "a_wR", 1.0, 0.35); up.tween_property(self, "a_lean", 0.18, 0.35)
	await up.finished
	var sp := create_tween(); sp.tween_property(iv_wheel, "rotation:z", iv_wheel.rotation.z - TAU * 1.0, 1.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await sp.finished
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.4); dn.tween_property(self, "a_wR", 0.0, 0.4); dn.tween_property(self, "a_lean", 0.0, 0.4)
	if iv_block == "i1" and not ivp_sunk:
		print("IV the volute is turned: the stone goes down into its bed")
		var sk := create_tween().set_parallel()
		sk.tween_property(iv_block_n, "position:y", iv_block_n.position.y - 0.8, 2.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
		if ivp_bshadow != null: sk.tween_property(ivp_bshadow.material_override, "albedo_color:a", 0.0, 1.6)
		await sk.finished
		ivp_sunk = true
	await wait(0.3)
	iv_busy = false

## (the level played through by its own way)
func _play_ivp() -> void:
	var dir := OS.get_environment("SHOT_DIR")
	var snap := func(nm: String) -> void:
		if dir != "": await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, nm])
	var idle := func() -> void:
		var still := 0
		while still < 8:
			await get_tree().process_frame
			still = still + 1 if (not busy and not iv_busy and route.is_empty()) else 0
	var tapw := func(p: Vector3) -> void:
		_go_tap(cam.unproject_position(p)); await get_tree().process_frame
		await idle.call(); await wait(0.4)
	await get_tree().create_timer(2.2).timeout
	await snap.call("p0_title")
	tap(Vector2(360, 640)); await wait(1.0)
	await idle.call(); await wait(0.6)
	if OS.get_environment("IV_CLEAN") != "": await wait(7.0)      # (for the look alone: after the line has gone)
	if OS.get_environment("IV_BG_ONLY") != "":
		for n in [fig, wfig]:
			if n != null: (n as Node3D).visible = false
	await snap.call("p1_start")
	if OS.get_environment("GH_ONLY") == "start": get_tree().quit(); return
	if ivg_on:      # the trial played by swipes, as a player would: each a stroke from her toward the next node
		var sol: Array = ivg.solution
		for i in sol.size():
			var tgt := String(sol[i])
			if go_wake and bool(ivg.get("tutorial", false)) and i < 2:      # (as a new player would: she waits, and the hand shows the swipe)
				await wait(2.6); await _ivw_snap("w9_hand%d" % i)
			var at: Vector3 = ivp_nodes[tgt]
			var dv := cam.unproject_position(at) - cam.unproject_position(ivp_nodes[iv_me])
			_ivg_swipe(dv); await get_tree().process_frame
			await idle.call(); await wait(0.3)
			print("IV step %d %s: she is at %s, stone %s, volute %d, statue %s" % [i + 1, tgt, iv_me, iv_block, ivg_v, _ivg_w_node()])
			if not iv_won: await snap.call("s%02d_%s" % [i + 1, tgt])
		var n3 := 0
		while not ended and n3 < 900: await get_tree().process_frame; n3 += 1
		await wait(1.5); await snap.call("p9_end")
		print("IV ended: ", ended, " in ", iv_moves, " moves")
		get_tree().quit(); return
	await tapw.call(ivp_nodes["n2"]); await snap.call("p2_lower")
	await tapw.call(iv_block_n.global_position + Vector3(0, 0.42, 0)); await snap.call("p3_pushed")
	await tapw.call(iv_wheel.global_position); await snap.call("p4_sunk")
	await tapw.call(ivp_nodes["t2"]); await snap.call("p5_upper")
	await tapw.call(ivp_nodes["r"])
	var n2 := 0
	while not ended and n2 < 900: await get_tree().process_frame; n2 += 1
	await wait(1.5); await snap.call("p9_end")
	print("IV ended: ", ended)
	get_tree().quit()


# ---------------------------------------------------------------- Eidolon GO, ivory: the level in 3D
## The level built in 3D in the look of the picture (the default; IV_MODE=plate shows the picture itself, IV_MODE=3d the
## first build): its floors, flights, rocks, columns and arches are made by tools/ivory_level.py in Blender, with the shade
## of corners and clefts baked into their vertices; here they are coloured as the picture is (cream tops, lit faces to
## the left, umber in shade), the far cliffs and ruins stand in the mist, and the way, the stone, the volute and the
## ring are as in the painted level.
const IVR_W := 8.0      # the width the eye holds, in metres
const IVR_C := Vector2(0.45, 2.7)      # the middle of the picture, across and up, from the level's origin
var ivr_on := OS.get_environment("IV_MODE") != "plate" and OS.get_environment("IV_MODE") != "3d"

var ivr_eye := {}      # the eye of the picture the level was traced from: its middle (from the level's origin) and its width
var ivr_steps := {}      # how many steps each flight has (as counted on the picture), by its foot and head
var ivr_floors := {}      # the floors of the level: their heights and outlines (x, z), for what must lie on them or hang over their edges
var ivr_groove := 0.0      # how deep the channel down the middle of each flight: the way is drawn in it
var ivr_sea_y := -1.6      # the sea level under the drowned sanctuary (from the level's origin)
var ivr_hz := 0.215      # (where the sea meets the sky in the level's backdrop, from the top of the screen)
const IVS_HORIZON := 520.0      # (where the sea meets the sky in its concept, in the concept's pixels from the top)
var ivs_horizon := Vector3.ZERO
var ivr_shore := {}      # (the level's shore map, <level>/shore.png: its rect over the water and its reach)
var ivs_sea_mat: ShaderMaterial      # (the sea's surface: its small waves along the stones that rise come with them)
var ivr_stepl := {}      # each flight's steps as cut (along it from its foot, and height), by its foot and head

## how far from p, going along d on the floor p is on, its edge is (or -1)
func _ivr_edge_dist(p: Vector3, d: Vector3) -> float:
	var best := -1.0
	for nm in ivr_floors:
		var fl: Dictionary = ivr_floors[nm]
		if absf(float(fl.h) - (p.y - IV_O.y)) > 0.08: continue
		var poly: Array = fl.xz
		var q := Vector2(p.x - IV_O.x, p.z - IV_O.z); var dd := Vector2(d.x, d.z).normalized()
		for i in poly.size():
			var a := Vector2(float(poly[i][0]), float(poly[i][1])); var b := Vector2(float(poly[(i + 1) % poly.size()][0]), float(poly[(i + 1) % poly.size()][1]))
			var e := b - a; var den := dd.x * e.y - dd.y * e.x
			if absf(den) < 1e-9: continue
			var t := ((a.x - q.x) * e.y - (a.y - q.y) * e.x) / den; var u := ((a.x - q.x) * dd.y - (a.y - q.y) * dd.x) / den
			if t > 0.0 and u >= 0.0 and u <= 1.0 and (best < 0.0 or t < best): best = t
	return best

func _ivr_fkey(a: Vector3, b: Vector3) -> String: return "%.2f,%.2f,%.2f|%.2f,%.2f,%.2f" % [a.x, a.y, a.z, b.x, b.y, b.z]

func _ivr_cam() -> void:
	var b := _ivp_basis()
	var c := IV_O + b.x * IVR_C.x + b.y * IVR_C.y
	var w := IVR_W
	if not ivr_eye.is_empty():
		var ce: Array = ivr_eye.centre
		c = IV_O + Vector3(float(ce[0]), float(ce[1]), float(ce[2])); w = float(ivr_eye.width)
	if go_wake and ivw_close > 0.001:      # (the waking: the eye close on her, drawn back as she stands)
		var u := ivw_close * ivw_close * (3.0 - 2.0 * ivw_close)
		c = c.lerp(pos + Vector3(0, 0.5, 0), u); w = lerpf(w, 3.6, u)
	if OS.get_environment("IV_ZOOM") != "":      # (for judging her: the eye close on her)
		c = pos + Vector3(0, 0.75, 0); w = float(OS.get_environment("IV_ZOOM"))
		if OS.get_environment("IV_FACE") != "": yaw = atan2(b.z.x, b.z.z)
	cam.global_transform = Transform3D(b, c + b.z * 40.0)
	var vp := get_viewport().get_visible_rect().size
	cam.keep_aspect = Camera3D.KEEP_WIDTH; cam.size = w * maxf(1.0, (vp.x / vp.y) / 0.5625)

func _ivr_mat(kind: String, ao := 1.0, local := false) -> ShaderMaterial: return _iv_mat(kind, 0.0, {"lfog": 1.0 if (local and not iv_at_sea) else 0.0, "fog_hi": (ivr_sea_y + (0.04 if go_wake else 1.5)) if iv_at_sea else (-1.4 if go_moon else (-1.6 if go_quarry else -3.6)), "fog_lo": (ivr_sea_y - (0.7 if go_wake else 0.15)) if iv_at_sea else (-5.4 if go_moon else (-6.0 if go_quarry else -7.5)), "ao_k": ao * ({"marble2": 0.4, "olive2": 0.2, "bark": 0.3, "rock2": 0.0, "quarry": 0.55} as Dictionary).get(kind, 1.0), "veins": (0.35 if go_moon else (0.25 if go_quarry else (0.4 if go_wake else 0.6))) if (kind == "marble2" or kind == "quarry") else 0.0, "dk": 0.17 if kind == "quarry" else 0.0, "bounce": 0.0, "haze": 1.0, "shadow_k": 0.0 if kind == "rock2" else 1.0, "lf_hi": 1.0 if iv_at_sea else (1.0 if go_moon else (1.4 if go_quarry else 0.5)), "lf_len": 2.6 if iv_at_sea else (2.8 if go_moon else (3.2 if go_quarry else 1.9))})

## the way drawn on the stone: a pale line, and at each node a pale disc in a darker ring
func _ivr_way() -> void:
	for e in ivp_edges:
		var pts := [ivp_nodes[e[0]]]
		var mids: Array = e[2]
		if mids.size() == 2:      # a flight: along the floor to its foot, then over each tread and up each riser, then on from its head
			var f: Vector3 = mids[0]; var h: Vector3 = mids[1]
			var lo_p := f if f.y < h.y else h; var hi_p := h if f.y < h.y else f
			var n := int(ivr_steps.get(_ivr_fkey(f, h), 0))
			if n <= 0: n = maxi(1, int(round(absf(hi_p.y - lo_p.y) / 0.12)))
			var rz := (hi_p.y - lo_p.y) / float(n)
			var dd := Vector3(hi_p.x - lo_p.x, 0, hi_p.z - lo_p.z); var run := dd.length() / float(n); dd = dd.normalized()
			var a0 := (pts[0] as Vector3) if f.y < h.y else (ivp_nodes[e[1]] as Vector3)
			var a1 := (ivp_nodes[e[1]] as Vector3) if f.y < h.y else (pts[0] as Vector3)
			_iv_line(iv_root, a0 - IV_O, lo_p - IV_O)
			var sl: Array = ivr_stepl.get(_ivr_fkey(lo_p, hi_p), [])
			if ivr_on and not sl.is_empty():      # (the steps as they were cut, a little uneven: down the channel in their middle)
				var g := ivr_groove; var ln := Vector3(hi_p.x - lo_p.x, 0, hi_p.z - lo_p.z).length()
				var at := func(t: float, y: float) -> Vector3: var q := lo_p + dd * t; return Vector3(q.x, y, q.z) - IV_O
				var y_prev := lo_p.y - g
				for k in sl.size():
					var tk := float(sl[k][0]) + g; var yk := IV_O.y + float(sl[k][1]) - g
					var tn := (float(sl[k + 1][0]) + g) if k < sl.size() - 1 else ln
					_iv_riser(iv_root, at.call(tk - 0.012, y_prev), at.call(tk - 0.012, yk))
					_iv_line(iv_root, at.call(tk, yk), at.call(tn, yk))
					y_prev = yk
				_iv_riser(iv_root, at.call(ln - 0.012, y_prev), at.call(ln - 0.012, hi_p.y))
			else:
				for k in n:
					var foot_k := lo_p + dd * (run * float(k)) + Vector3(0, rz * float(k), 0)
					var up_k := foot_k + Vector3(0, rz, 0)
					_iv_riser(iv_root, foot_k - IV_O - dd * 0.012, up_k - IV_O - dd * 0.012)
					_iv_line(iv_root, up_k - IV_O, up_k + dd * run - IV_O)
			_iv_line(iv_root, hi_p - IV_O, a1 - IV_O)
		else: _iv_line(iv_root, (pts[0] as Vector3) - IV_O, (ivp_nodes[e[1]] as Vector3) - IV_O)
	for k in ivp_nodes:
		if k == "r" or k == "s" or (ivg_on and (k == ivg_exit or k == ivg_vol)): continue
		var p: Vector3 = (ivp_nodes[k] as Vector3) - IV_O
		var rm := CylinderMesh.new(); rm.top_radius = 0.215; rm.bottom_radius = 0.215; rm.height = 0.02; rm.radial_segments = 24; rm.rings = 1
		var ri := _iv_prim(rm, p + Vector3(0, 0.008, 0), "groove", iv_root); ri.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var dm := CylinderMesh.new(); dm.top_radius = 0.16; dm.bottom_radius = 0.165; dm.height = 0.035; dm.radial_segments = 24; dm.rings = 1
		var di := MeshInstance3D.new(); di.mesh = dm; di.material_override = _ivr_mat("marble2", 0.0); di.position = p + Vector3(0, 0.02, 0); di.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_root.add_child(di)

## far off, as the picture has it, one band behind another, each paler and smaller than the one before: tall crags at
## the eye's sides; behind them a colonnade on its pillar of rock and lesser crags; far behind, highest, the hill of
## the colossus and the ridge of its temple; farthest, low hills in the haze. Each stands where the picture shows it, in
## the picture's own measure (metres across and up from its middle). The eye here sees without perspective, so the far
## is made as an eye with perspective would see it: smaller the farther, and the rows of columns drawing together as
## they go away, toward a point on the horizon.
func _ivr_far() -> void:
	var b := _ivp_basis()
	var bx := b.x; var by := b.y; var fwd := -b.z
	var ref := IV_O + b.x * IVR_C.x + b.y * IVR_C.y
	if not ivr_eye.is_empty():
		var ce: Array = ivr_eye.centre
		ref = IV_O + Vector3(float(ce[0]), float(ce[1]), float(ce[2]))
	var rng := RandomNumberGenerator.new(); rng.seed = 23
	var spot := func(sx: float, sy: float, dep: float) -> Vector3: return ref + bx * sx + by * sy + fwd * dep
	var spot_y := func(sx: float, sy: float, y: float) -> Vector3: return ref + bx * sx + by * sy + fwd * ((y - ref.y - by.y * sy) / fwd.y)      # (that place in the picture, at that height)
	var fog := func(top: float, w: float, near := false) -> Dictionary: return {"sil": 1.0, "fog_hi": top - (2.2 if near else 0.4 + w * 0.9), "fog_lo": top - (9.0 if near else 3.2 + w * 2.8)}
	var P := func(X: float, Y: float, dep: float) -> Vector3: return spot.call((X - 768.0) / 206.0, (1376.0 - Y) / 206.0, dep)      # (a pixel of the picture, that far off)
	# crags, each where the picture has it: [its top in the picture (x, y), width, depth, haze, palette]
	for f in [
			[1231, 346, 1.3, 8.0, 0.04, "rock2"], [1396, 717, 1.4, 7.5, 0.1, "far1"],
			[300, 880, 1.0, 15.0, 0.42, "far"],      # (under the colonnade on the left)
			[340, 442, 0.75, 19.0, 0.68, "far"],      # (the tall tower behind it)
			[575, 470, 1.5, 24.0, 0.74, "hill"], [455, 590, 1.3, 22.0, 0.72, "hill"],      # (the hill going down to the left from the temple: broad and soft, deep in the haze)
			[905, 420, 0.95, 26.5, 0.6, "far"],      # (the crown the colossus stands on)
			[1365, 222, 1.1, 36.0, 0.72, "far"]]:
		var top: Vector3 = P.call(float(f[0]), float(f[1]), float(f[3]))
		var pal := "far" if String(f[5]) == "hill" else String(f[5])
		var st := _iv_st(); _ivr_crag(st, top, float(f[2]), rng, false, 0.5 if String(f[5]) == "hill" else 0.62, false, String(f[5]) == "far" or String(f[5]) == "far1")
		_iv_commit(st, pal, self, float(f[4]), fog.call(top.y, float(f[2]), pal == "far1"), false)
	# the colonnade on the left, going away to the right as the picture's: low, its lintel over all of it, on its rock
	var c0: Vector3 = P.call(182, 852, 15.0)
	var cs := _iv_st()
	var feet: Array = _ivr_colonnade(cs, spot_y, Vector2((182.0 - 768.0) / 206.0, (1376.0 - 852.0) / 206.0), Vector2(5.5, 4.4), c0.y, 4, 0.8, 0.27, 4, rng)
	_ivr_ridge_under(cs, feet, 0.1, rng)
	_iv_commit(cs, "farsil", self, 0.3, fog.call(c0.y, 1.0), false)
	# the temple on the far ridge, going away to the left, on its ridge
	var ty: float = (spot.call(0.42, 4.6, 27.0) as Vector3).y
	var ts := _iv_st()
	feet = _ivr_colonnade(ts, spot_y, Vector2(0.42, 4.6), Vector2(-4.8, 5.7), ty, 7, 0.84, 0.25, 7, rng)
	_ivr_ridge_under(ts, feet, 0.1, rng)
	_iv_commit(ts, "farsil", self, 0.42, fog.call(ty, 1.0), false)
	# the colossus on the crown of the far hill: on a plinth, as the picture's, the plinth on a crown of rock that goes
	# down into the haze (never a block hanging in the air)
	var cl: Vector3 = P.call(878, 398, 25.5)
	var ss := _iv_st()
	_iv_box(ss, cl + Vector3(-0.27, -0.95, -0.27), cl + Vector3(0.27, 0.0, 0.27))
	_iv_box(ss, cl + Vector3(-0.32, -0.95, -0.32), cl + Vector3(0.32, -0.8, 0.32))
	_ivr_crag(ss, cl + Vector3(0, -0.93, 0), 1.3, rng, false, 0.62, true, true)
	_iv_commit(ss, "farsil", self, 0.42, {"sil": 1.0, "fog_hi": cl.y - 1.1, "fog_lo": cl.y - 3.6}, false)
	var col := prop_model("iv_colossus", self, 2.4)
	col.position = cl; col.rotation.y = PI * 0.3
	for m in col.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _iv_mat("farsil", 0.12, {"sil": 1.0, "fog_hi": cl.y - 1.0, "fog_lo": cl.y - 6.0}); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## a thing's image in the still water: a copy of it turned over about the sea's level, shaded as the thing is
func _ivs_mirror(src: Node3D, kind_of: Callable) -> Node3D:
	var sea_w := IV_O.y + ivr_sea_y
	var mn := src.duplicate() as Node3D
	src.get_parent().add_child(mn)
	mn.global_transform = Transform3D(Basis.from_scale(Vector3(1, -1, 1)), Vector3(0, 2.0 * sea_w, 0)) * src.global_transform
	for m in mn.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var kd: Array = kind_of.call(mi)
		var ex: Dictionary = (kd[2] as Dictionary).duplicate()
		ex["mirror_k"] = 1.0; ex["mirror_y"] = sea_w; ex["clip_k"] = 0.0; ex["shadow_k"] = 0.0
		mi.material_override = _iv_mat(String(kd[0]), float(kd[1]), ex); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mn


# ---------------------------------------------------------------- the waking (gowake/): the Observer, the veil, her rising, the hand
## The first level. Dawn; the sea still as glass. Far out in it stands the Observer, the first statue of her, veiled,
## looking out to where she was lost; its image lies in the water under it. A torn veil hangs from the gate's lintel,
## stirring. She kneels at the threshold until the level begins, then rises. While she waits, a hand shows the next swipe.
var ivw_hand: TextureRect
var ivw_mirror: Node3D
var ivw_trail: Line2D
var ivw_idle := 0.0
var ivw_veil_m: ShaderMaterial

func _ivw_scene(j: Dictionary) -> void:
	if j.get("observer") != null: _ivw_observer(j)
	_ivw_scene2(j)

func _ivw_observer(j: Dictionary) -> void:
	var ob: Array = j.get("observer") as Array      # (x, the foot (under the water), z, its height, its turn)
	var hp := Node3D.new(); iv_root.add_child(hp)
	hp.position = Vector3(float(ob[0]), float(ob[1]), float(ob[2])); hp.rotation.y = float(ob[4])
	var hd := prop_model(String(j.get("observer_model", "observer")), hp, float(ob[3]))
	var sea := IV_O.y + ivr_sea_y
	var lowp := String(j.get("observer_model", "observer")).ends_with("_lp")      # (a low-poly one: faceted as everything else is)
	var rim := {"smooth_k": 0.0 if lowp else 1.0, "rim_k": 0.45 if lowp else 0.55, "rim_col": Color(1.0, 0.84, 0.6), "rim_dir": Vector3(-0.62, 0.3, -0.62)}      # (the sun low behind it gilds its edges)
	var ex := {"fog_hi": ivr_sea_y + 1.7, "fog_lo": ivr_sea_y - 0.1, "haze": 1.0, "clip_k": 1.0, "clip_y": sea, "shadow_k": 0.0, "wline_k": 0.0}      # (its foot lost in the mist on the water: no hard line where it meets it)
	if ivr_shore.is_empty(): _ivw_rings(Vector3(hp.global_position.x, sea, hp.global_position.z), float(ob[3]) * 0.55)      # (else the sea's own small waves follow her outline)
	ex.merge(rim)
	for m in hd.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _iv_mat("observer", float(j.get("observer_haze", 0.28)), ex); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_ivs_mirror(hp, func(_mi: MeshInstance3D) -> Array:
		var mx := {"fog_hi": ivr_sea_y + 1.7, "fog_lo": ivr_sea_y - 0.1, "haze": 1.0, "mirror_fade": 4.0, "mirror_wob": 0.07}; mx.merge(rim); return ["observer", float(j.get("observer_haze", 0.28)), mx])

## rings of ripples spreading slowly about a thing standing in the still water, one after another, fading
const IVW_RINGS_SH := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;
uniform vec3 col : source_color = vec3(1.0, 0.97, 0.95);
uniform float inner = 0.32;
void fragment(){
	float r = length(UV - 0.5) * 2.0;
	float a = 0.0;
	for (int i = 0; i < 3; i++) {
		float p = fract(TIME * 0.07 + float(i) / 3.0);
		float rr = mix(inner, 1.0, p);
		a += (1.0 - smoothstep(0.0, 0.012 + 0.02 * p, abs(r - rr))) * (1.0 - p) * smoothstep(0.0, 0.15, p);
	}
	ALBEDO = col; ALPHA = clamp(a, 0.0, 1.0) * 0.4 * smoothstep(inner - 0.05, inner + 0.05, r);
}
"""
func _ivw_rings(at: Vector3, size: float) -> void:
	var q := QuadMesh.new(); q.size = Vector2(size, size) * 2.0; q.orientation = PlaneMesh.FACE_Y
	var m := ShaderMaterial.new(); var sh := Shader.new(); sh.code = IVW_RINGS_SH; m.shader = sh
	var mi := MeshInstance3D.new(); mi.mesh = q; mi.material_override = m; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi); mi.global_position = at + Vector3(0, 0.015, 0)

func _ivw_scene2(j: Dictionary) -> void:
	for ar in (j.get("arches", []) as Array): _ivw_veil(Vector3(float(ar[0][0]), float(ar[0][1]), float(ar[0][2])), String(ar[1]))
	var lvn := iv_root.get_child(0) as Node3D      # (the level as Blender made it: its sunken stones)
	for ch in iv_root.get_children():
		if ch is Node3D and not (ch as Node3D).find_children("riser_*", "MeshInstance3D", true, false).is_empty() and ch != ivw_mirror: lvn = ch; break
	_ivw_risers_find(lvn, ivw_mirror)
	a_drop = 0.5; a_headp = 0.3; a_lean = 0.86; palm_on = true; a_wL = 1.0; a_wR = 1.0; palm_nL = Vector3.UP; palm_nR = Vector3.UP      # (she lies curled where she woke, her palms on the stone)
	if OS.get_environment("IVW_SKIP") != "": a_drop = 0.0; a_headp = 0.0; a_lean = 0.0; palm_on = false; a_wL = 0.0; a_wR = 0.0; ivw_close = 0.0      # (to judge the look: awake already)

const IVW_VEIL_SH := """
shader_type spatial;
render_mode cull_disabled, unshaded, shadows_disabled, depth_draw_always;
uniform vec3 lit : source_color = vec3(1.0, 0.97, 0.95);
uniform vec3 shade : source_color = vec3(0.9, 0.84, 0.88);
uniform vec3 wind = vec3(0.0, 0.0, 1.0);
uniform float t = 0.0;
varying float vv; varying float uu;
void vertex(){
	uu = UV.x; vv = UV.y;      // (0 at the lintel, 1 at its torn end)
	float hang = vv * vv;
	float sway = 0.38 + 0.16 * sin(t * 1.3 + uu * 1.7) + 0.06 * sin(t * 3.7 + vv * 5.0);
	VERTEX += wind * hang * sway * 1.1;
	VERTEX.y += hang * 0.18 * sway;
	VERTEX += vec3(0.0, 0.0, 0.0) + cross(wind, vec3(0.0, 1.0, 0.0)) * sin(t * 2.4 + vv * 6.0 + uu * 2.0) * 0.05 * vv;
}
float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
void fragment(){
	float edge = 0.78 + 0.16 * h(floor(uu * 9.0)) + 0.05 * sin(uu * 37.0);      // (its end torn ragged)
	if (vv > edge) discard;
	float f = 0.5 + 0.5 * sin(uu * 18.0 + vv * 3.0 + t * 0.9);      // (its folds)
	ALBEDO = mix(shade, lit, 0.55 + 0.45 * f);
	ALPHA = 0.78 * (1.0 - smoothstep(edge - 0.08, edge, vv) * 0.5);
}
"""

func _ivw_veil(p: Vector3, ax: String) -> void:
	# a strip of veil from the left of the lintel's underside, the wind off the sea taking it out to the side
	var along := Vector3(1, 0, 0) if ax == "x" else Vector3(0, 0, 1)
	var front := Vector3(0, 0, 1) if ax == "x" else Vector3(1, 0, 0)      # (the face of the gate toward her way up)
	var top := IV_O + p + Vector3(0, 1.98, 0) - along * 0.27 + front * 0.21
	var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var nu := 4; var nv := 16; var wdt := 0.42; var ln := 1.45
	var pts := []
	for iv in nv + 1:
		var row := []
		for iu in nu + 1:
			var u := float(iu) / nu; var v := float(iv) / nv
			row.append([top + along * ((u - 0.5) * wdt) + Vector3(0, -v * ln, 0), Vector2(u, v)])
		pts.append(row)
	for iv in nv:
		for iu in nu:
			for q in [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]:
				var c: Array = pts[iv + q[1]][iu + q[0]]
				st.set_uv(c[1]); st.set_normal(Vector3(0, 0, 1)); st.add_vertex(c[0])
	var mi := MeshInstance3D.new(); mi.mesh = st.commit()
	ivw_veil_m = ShaderMaterial.new(); var sh := Shader.new(); sh.code = IVW_VEIL_SH; ivw_veil_m.shader = sh
	ivw_veil_m.set_shader_parameter("wind", (-along * 0.55 + Vector3(0, 0, 0.75)).normalized() if ax == "x" else (-along * 0.55 + Vector3(0.75, 0, 0)).normalized())
	mi.material_override = ivw_veil_m; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

var ivw_close := 1.0      # (the eye close on her: 1 while she lies there, 0 when it holds the whole level)
var ivw_awake := false
var ivw_risers := []      # [[mesh, its place up, its image or null]] the sunken stones
var ivw_up := 0.0      # (how far up the stones are: 0 sunk, 1 risen)
const IVW_SINK := 0.62      # (how deep the stones lie under their places: their tops a hand under the water, plain to see)
var ivw_chain: Node3D
var ivw_links := []
var ivw_chain_pts := []      # [[point, moves with the stones]]

## the waking: she lies curled at the threshold, her palms on the stone. She stirs; she pushes herself up; she looks out
## to sea, toward the Observer, and back; she rises, unsure of her joints, halting halfway. Then the eye draws back.
## the words of the levels: white letters with a black shadow, nothing red over them (the user's wish), on the title
## card as on each line of the story
var go_text_styled := false
func _go_restyle_text() -> void:
	go_text_styled = true
	var white := func(l: Label) -> void:
		l.add_theme_color_override("font_color", Color(1, 1, 1))
	for box in [quote_box, title_box]:
		if box == null: continue
		for n in (box as Node).find_children("*", "ColorRect", true, false):
			var cr := n as ColorRect
			if cr.color.r > 0.75 and cr.color.g < 0.45: cr.visible = false      # (the red rule, the lozenge)
		for n in (box as Node).find_children("*", "Label", true, false):
			var lb := n as Label
			if lb.get_theme_constant("outline_size") > 0 and lb.get_theme_color("font_color").a < 0.01:
				if lb.material is CanvasItemMaterial: lb.visible = false      # (the warm glow: gone)
				else:      # (the haze in thin steps: black now, a soft shadow all round the letters)
					var oc := lb.get_theme_color("font_outline_color")
					lb.add_theme_color_override("font_outline_color", Color(0, 0, 0, minf(oc.a * 1.9, 0.3)))
			else: white.call(lb)

func _ivw_snap(nm: String) -> void:      # (to judge the waking: a frame at each of its moments, when shots are asked for)
	var d := OS.get_environment("SHOT_DIR")
	if d == "" or OS.get_environment("IVW_SNAPS") == "": return
	await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [d, nm])

func _ivw_rise() -> void:
	iv_busy = true
	await _ivw_snap("w0_lying")
	await get_tree().create_timer(0.7).timeout
	var t0 := create_tween(); t0.tween_property(self, "a_lean", 0.74, 0.35).set_trans(Tween.TRANS_SINE); t0.tween_property(self, "a_lean", 0.86, 0.45).set_trans(Tween.TRANS_SINE)
	await t0.finished
	_ivw_ripple(pos, 1.1)
	await get_tree().create_timer(0.4).timeout
	var t1 := create_tween(); t1.set_parallel(true)
	t1.tween_property(self, "a_lean", 0.3, 1.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t1.tween_property(self, "a_wL", 0.0, 0.7).set_delay(0.95); t1.tween_property(self, "a_wR", 0.0, 0.7).set_delay(0.8)
	await t1.finished
	await _ivw_snap("w1_up")
	palm_on = false
	var y0 := yaw
	var t2 := create_tween(); t2.tween_property(self, "yaw", y0 + 0.6, 0.9).set_trans(Tween.TRANS_SINE); t2.tween_interval(0.7); t2.tween_property(self, "yaw", y0, 0.8).set_trans(Tween.TRANS_SINE)
	await get_tree().create_timer(1.2).timeout
	await _ivw_snap("w2_look")
	if t2.is_running(): await t2.finished
	var t3 := create_tween()
	t3.tween_property(self, "a_drop", 0.27, 0.7).set_trans(Tween.TRANS_SINE)
	t3.parallel().tween_property(self, "a_lean", 0.16, 0.7)
	t3.tween_interval(0.35)
	t3.tween_property(self, "a_drop", 0.0, 0.95).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t3.parallel().tween_property(self, "a_lean", 0.0, 0.95)
	await get_tree().create_timer(0.75).timeout
	await _ivw_snap("w3_halfway")
	if t3.is_running(): await t3.finished
	await _ivw_snap("w4_stand")
	_ivw_ripple(pos, 1.5)
	var t4 := create_tween(); t4.tween_property(self, "ivw_close", 0.0, 2.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await get_tree().create_timer(1.3).timeout
	await _ivw_snap("w5_pull")
	if t4.is_running(): await t4.finished
	await _ivw_snap("w6_full")
	ivw_awake = true
	iv_me = String(ivg.start) if ivg_on else iv_me
	iv_busy = false

## a way over a sunken stone is no way until the stones are up
func _ivw_open(a: String, b: String) -> bool:
	if not go_wake or not ivg_on or ivg.get("volute") == null: return true
	var br: Array = ((ivg.volute as Dictionary).get("toggles", {}) as Dictionary).get("bridge", []) as Array
	for e in br:
		if (String(e[0]) == a and String(e[1]) == b) or (String(e[0]) == b and String(e[1]) == a): return ivg_v == 1 and ivw_up > 0.99
	return true

## the winch: a drum of marble on a plinth, banded in bronze, its chain wound on it; four bars of wood through its head.
## It turns about its upright (its own z, as the capstan's), and the chain runs from it over the threshold's edge into the
## water, to the stones lying under it
func _ivw_winch(p: Vector3) -> void:
	var base := Node3D.new(); iv_root.add_child(base); base.global_position = p
	var M := func(mesh: Mesh, kind: String, at: Vector3, par: Node3D, rot: Vector3) -> MeshInstance3D:
		var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = _ivr_mat(kind, 0.0); mi.position = at; mi.rotation = rot
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON; par.add_child(mi); return mi
	var pl := BoxMesh.new(); pl.size = Vector3(0.6, 0.16, 0.6); M.call(pl, "marble2", Vector3(0, 0.08, 0), base, Vector3.ZERO)
	var pl2 := BoxMesh.new(); pl2.size = Vector3(0.5, 0.05, 0.5); M.call(pl2, "marble2", Vector3(0, 0.185, 0), base, Vector3.ZERO)
	iv_wheel = Node3D.new(); iv_root.add_child(iv_wheel); iv_wheel.global_position = p + Vector3(0, 0.21, 0); iv_wheel.rotation = Vector3(-PI * 0.5, 0, 0)
	var X := Vector3(PI * 0.5, 0, 0)      # (a cylinder's axis laid along the wheel's own z: upright)
	var cyl := func(r0: float, r1: float, h: float, seg: int) -> CylinderMesh:
		var c := CylinderMesh.new(); c.top_radius = r0; c.bottom_radius = r1; c.height = h; c.radial_segments = seg; c.rings = 1; return c
	M.call(cyl.call(0.17, 0.19, 0.5, 18), "marble2", Vector3(0, 0, 0.25), iv_wheel, X)
	for zb in [0.035, 0.465]: M.call(cyl.call(0.205, 0.205, 0.045, 18), "bronze", Vector3(0, 0, zb), iv_wheel, X)
	M.call(cyl.call(0.196, 0.2, 0.15, 24), "iron", Vector3(0, 0, 0.2), iv_wheel, X)      # (the chain wound on the drum)
	M.call(cyl.call(0.2, 0.2, 0.05, 18), "bronze", Vector3(0, 0, 0.515), iv_wheel, X)
	var kn := SphereMesh.new(); kn.radius = 0.06; kn.height = 0.1; kn.radial_segments = 10; kn.rings = 5; M.call(kn, "bronze", Vector3(0, 0, 0.56), iv_wheel, Vector3.ZERO)
	for k in 2:      # (two bars through its head: four arms to push)
		var bx := BoxMesh.new(); bx.size = Vector3(1.0, 0.055, 0.055)
		M.call(bx, "wood", Vector3(0, 0, 0.42), iv_wheel, Vector3(0, 0, PI * 0.5 * k))
		for sgn in [-1.0, 1.0]:
			var tip := BoxMesh.new(); tip.size = Vector3(0.06, 0.07, 0.07)
			var a := PI * 0.5 * k
			M.call(tip, "bronze", Vector3(cos(a) * 0.5 * sgn, sin(a) * 0.5 * sgn, 0.42), iv_wheel, Vector3(0, 0, a))
	# the chain: off the drum toward the stones, over the threshold's edge, down into the water, from stone to stone
	var O := IV_O; var sy := ivr_sea_y
	var pts := [[Vector3(1.09, 0.32, 0.13), false], [Vector3(0.92, 0.035, 0.24), false], [Vector3(0.62, 0.035, 0.2), false], [Vector3(0.46, 0.035, -0.12), false], [Vector3(0.44, 0.035, -0.55), false], [Vector3(0.45, sy - 0.22, -0.85), false],
		[Vector3(0.52, -0.16, -1.5), true], [Vector3(0.56, -0.42, -2.25), true], [Vector3(0.52, -0.16, -3.0), true],
		[Vector3(0.56, -0.42, -3.75), true], [Vector3(0.52, -0.16, -4.5), true]]
	var off := p - (O + Vector3(1.25, 0.0, 0.0))      # (the chain is laid for the winch where the plan has it)
	for q in pts: ivw_chain_pts.append([O + (q[0] as Vector3) + off * (0.0 if q[1] else 1.0), q[1]])
	var lm := BoxMesh.new(); lm.size = Vector3(0.05, 0.062, 0.13)      # (links big enough to be read from the eye: the chain is what tells that the winch lifts the stones)
	var cm: Material = _iv_mat("iron", 0.0, {"under_k": 1.0, "clip_k": 0.0, "clip_y": IV_O.y + ivr_sea_y, "shadow_k": 0.0})
	if OS.get_environment("IVW_RED") != "": var sm := StandardMaterial3D.new(); sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; sm.albedo_color = Color(1, 0, 0); cm = sm
	ivw_chain = Node3D.new(); add_child(ivw_chain); ivw_chain.global_transform = Transform3D.IDENTITY
	for k in 90:      # (each link its own mesh: few enough to keep simple)
		var li := MeshInstance3D.new(); li.mesh = lm; li.material_override = cm; li.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; li.visible = false
		ivw_chain.add_child(li); ivw_links.append(li)
	_ivw_chain_lay()

func _ivw_chain_lay() -> void:
	if ivw_chain == null: return
	var dy := -IVW_SINK * (1.0 - ivw_up)
	var P := []
	for q in ivw_chain_pts: P.append((q[0] as Vector3) + Vector3(0, dy if q[1] else 0.0, 0))
	var n := 0
	for i in P.size() - 1:
		var a: Vector3 = P[i]; var b: Vector3 = P[i + 1]
		var L := a.distance_to(b); var cnt := maxi(1, int(L / 0.105))
		var z := (b - a).normalized(); var x := z.cross(Vector3.UP).normalized() if absf(z.y) < 0.98 else Vector3.RIGHT
		var y := z.cross(x)
		for j in cnt:
			if n >= ivw_links.size(): break
			var bs := Basis(x, y, z) if (n % 2 == 0) else Basis(y, -x, z)      # (each link turned a quarter to the last)
			var li := ivw_links[n] as MeshInstance3D
			li.global_transform = Transform3D(bs, a.lerp(b, (j + 0.5) / cnt)); li.visible = true; n += 1
	for k in range(n, ivw_links.size()): (ivw_links[k] as MeshInstance3D).visible = false
	if OS.get_environment("IV_TRACE") != "" and n > 0:
		var l0 := ivw_links[0] as MeshInstance3D
		print("IVW chain ", n, " links; first at ", l0.global_position, " in tree ", l0.is_visible_in_tree(), " mat ", l0.material_override)

## the stones of the plan's risers, sunk under their places; their images in the water with them
func _ivw_risers_find(lv: Node3D, mn: Node3D) -> void:
	for m in lv.find_children("riser_*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var nm := String(mi.name).to_lower()
		mi.material_override = _ivr_mat("rock2" if nm.contains("rock") else "marble2", 1.0, true).duplicate() as ShaderMaterial
		(mi.material_override as ShaderMaterial).set_shader_parameter("clip_k", 0.0); (mi.material_override as ShaderMaterial).set_shader_parameter("under_k", 1.0)
		var img: MeshInstance3D = null
		if mn != null:
			var f := mn.find_children(String(mi.name), "MeshInstance3D", true, false)
			if not f.is_empty(): img = f[0] as MeshInstance3D
		ivw_risers.append([mi, mi.position, img, img.position if img != null else Vector3.ZERO])
	# the way's discs on the stones and its lines over the water: they sink and rise with them
	var br: Array = ((ivg.volute as Dictionary).get("toggles", {}) as Dictionary).get("bridge", []) as Array if (ivg_on and ivg.get("volute") != null) else []
	var rz := []      # (the stones' outlines, on the water)
	for r in ivw_risers:
		var rm := r[0] as MeshInstance3D
		if String(rm.name).to_lower().contains("marble"): rz.append(rm.global_transform * rm.get_aabb())
	for ch in iv_root.get_children():
		if not (ch is MeshInstance3D) or (ch as MeshInstance3D).mesh == null: continue
		var mi2 := ch as MeshInstance3D
		var cc := mi2.global_transform * mi2.get_aabb().get_center()
		var on := false
		for e in br:
			var a: Vector3 = ivp_nodes[String(e[0])]; var b: Vector3 = ivp_nodes[String(e[1])]
			var ab := Vector2(b.x - a.x, b.z - a.z); var t := clampf(Vector2(cc.x - a.x, cc.z - a.z).dot(ab) / maxf(ab.length_squared(), 1e-4), 0.0, 1.0)
			var q := Vector2(a.x, a.z) + ab * t
			if q.distance_to(Vector2(cc.x, cc.z)) < 0.3 and absf(cc.y - lerpf(a.y, b.y, t)) < 0.25:
				var at_node := t < 0.05 or t > 0.95
				var on_stone := false
				for bx in rz:
					if (bx as AABB).grow(0.05).has_point(Vector3(cc.x, (bx as AABB).get_center().y, cc.z)): on_stone = true
				if not at_node or on_stone: on = true
		if on: ivw_risers.append([mi2, mi2.position, null, Vector3.ZERO])
	_ivw_risers_set(0.0)

func _ivw_risers_set(u: float) -> void:
	ivw_up = u
	var e := u * u * (3.0 - 2.0 * u)
	for r in ivw_risers:
		var d := Vector3(0, -IVW_SINK * (1.0 - e), 0)
		(r[0] as MeshInstance3D).position = (r[1] as Vector3) + d
		if r[2] != null: (r[2] as MeshInstance3D).position = (r[3] as Vector3) + d
	if ivs_sea_mat != null: ivs_sea_mat.set_shader_parameter("riser_up", clampf(1.0 - IVW_SINK * (1.0 - e) / maxf(0.05, -ivr_sea_y), 0.0, 1.0))      # (their waves as their tops break the water)
	_ivw_chain_lay()

func _ivw_raise(up: bool) -> void:
	if ivw_risers.is_empty(): ivw_up = 1.0 if up else 0.0; return
	var t := create_tween(); t.tween_method(_ivw_risers_set, ivw_up, 1.0 if up else 0.0, 1.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await get_tree().create_timer(0.75).timeout
	for r in ivw_risers:
		var rm := r[0] as MeshInstance3D
		if String(rm.name).to_lower().contains("marble"): _ivw_ripple(rm.global_transform * rm.get_aabb().get_center(), 1.6)
	await get_tree().create_timer(0.3).timeout
	await _ivw_snap("w7_rising")
	if t.is_running(): await t.finished
	await _ivw_snap("w8_risen")

## a ring spreading on the still water
const IVW_RIP_SH := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;
uniform float p = 0.0;
uniform vec3 col : source_color = vec3(1.0, 0.97, 0.94);
void fragment(){
	float r = length(UV - 0.5) * 2.0;
	float rr = mix(0.12, 1.0, p);
	float a = (1.0 - smoothstep(0.0, 0.06 + 0.05 * p, abs(r - rr))) * (1.0 - p) * 0.55;
	float a2 = (1.0 - smoothstep(0.0, 0.05, abs(r - rr * 0.62))) * (1.0 - p) * 0.3 * step(0.15, p);
	ALBEDO = col; ALPHA = max(a, a2);
}
"""
func _ivw_ripple(at: Vector3, size: float) -> void:
	var q := QuadMesh.new(); q.size = Vector2(size, size) * 2.0; q.orientation = PlaneMesh.FACE_Y
	var m := ShaderMaterial.new(); var sh := Shader.new(); sh.code = IVW_RIP_SH; m.shader = sh
	var mi := MeshInstance3D.new(); mi.mesh = q; mi.material_override = m; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi); mi.global_position = Vector3(at.x, IV_O.y + ivr_sea_y + 0.012, at.z)
	var t := create_tween(); t.tween_method(func(v: float) -> void: m.set_shader_parameter("p", v), 0.0, 1.0, 2.2).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	t.tween_callback(mi.queue_free)

func _ivw_hand_make(cl: CanvasLayer) -> void:
	if not FileAccess.file_exists(go_dir + "hand.png"): return
	var k := get_viewport().get_visible_rect().size.x / 720.0
	ivw_trail = Line2D.new(); ivw_trail.width = 7.0 * k; ivw_trail.default_color = Color(1, 1, 1, 0.0)
	var g := Gradient.new(); g.offsets = PackedFloat32Array([0.0, 1.0]); g.colors = PackedColorArray([Color(1, 1, 1, 0.0), Color(1, 0.98, 0.95, 0.75)])
	ivw_trail.gradient = g; ivw_trail.begin_cap_mode = Line2D.LINE_CAP_ROUND; ivw_trail.end_cap_mode = Line2D.LINE_CAP_ROUND
	cl.add_child(ivw_trail)
	ivw_hand = TextureRect.new(); ivw_hand.texture = load(go_dir + "hand.png"); ivw_hand.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ivw_hand.size = Vector2(84, 84) * k; ivw_hand.mouse_filter = Control.MOUSE_FILTER_IGNORE; ivw_hand.modulate.a = 0.0
	cl.add_child(ivw_hand)

func _ivw_next() -> String:      # the next node of the way from where she stands
	if not ivg_on: return ""
	var path: Array = [String(ivg.start)] + (ivg.solution as Array)
	for i in path.size() - 1:
		if String(path[i]) == iv_me:
			if String(path[i + 1]) == ivg_vol and ivg_v == 1 and i + 2 < path.size(): return String(path[i + 2])
			return String(path[i + 1])
	return ""

func _ivw_tick(dt: float) -> void:
	if ivw_veil_m != null: ivw_veil_m.set_shader_parameter("t", Time.get_ticks_msec() / 1000.0)
	if palm_on and not ivw_awake:      # (her palms on the stone before her knees, wherever she is turned)
		var fw := Vector3(sin(yaw), 0, cos(yaw)); var sd := Vector3(fw.z, 0, -fw.x)
		tgtL = Vector3(pos.x, pos.y + 0.012, pos.z) + fw * 0.5 + sd * 0.17; tgtR = Vector3(pos.x, pos.y + 0.012, pos.z) + fw * 0.5 - sd * 0.17
	if ivw_hand == null: return
	var waiting := ivg_on and bool(ivg.get("tutorial", false)) and started and ivp_intro and not iv_busy and not iv_won and iv_me != "s"
	if not waiting:
		ivw_idle = 0.0; ivw_hand.modulate.a = move_toward(ivw_hand.modulate.a, 0.0, dt * 6.0); ivw_trail.clear_points(); return
	ivw_idle += dt
	var nx := _ivw_next()
	if nx == "" or ivw_idle < 0.8: ivw_hand.modulate.a = 0.0; ivw_trail.clear_points(); return
	var a3: Vector3 = ivp_nodes[iv_me]
	var e := _ivp_edge(iv_me, nx)
	var tgt: Vector3 = ivp_nodes[nx]
	if not e.is_empty() and not (e[2] as Array).is_empty(): tgt = ((e[2] as Array)[0] if String(e[0]) == iv_me else (e[2] as Array)[(e[2] as Array).size() - 1])
	var fd := Vector3(tgt.x - a3.x, 0, tgt.z - a3.z).normalized()
	var p0 := cam.unproject_position(a3); var d2 := (cam.unproject_position(a3 + fd) - p0).normalized()
	var k := get_viewport().get_visible_rect().size.x / 720.0
	var tt := fmod(ivw_idle - 0.8, 1.7) / 1.7
	var u := clampf((tt - 0.12) / 0.5, 0.0, 1.0); u = u * u * (3.0 - 2.0 * u)
	var vs := get_viewport().get_visible_rect().size
	var c0 := p0 + Vector2(0, 70) * k      # (just below her feet)
	c0.x = clampf(c0.x, 110.0 * k, vs.x - 110.0 * k); c0.y = clampf(c0.y, 110.0 * k, vs.y - ivw_hand.size.y - 70.0 * k)      # (the hand whole on the screen)
	var tip := c0 + d2 * lerpf(-70.0, 70.0, u) * k
	ivw_hand.position = tip - Vector2(0.33, 0.02) * ivw_hand.size      # (its fingertip on the stroke)
	var al := smoothstep(0.0, 0.12, tt) * (1.0 - smoothstep(0.72, 0.95, tt))
	ivw_hand.modulate.a = al
	ivw_trail.clear_points()
	if u > 0.02:
		ivw_trail.add_point(c0 + d2 * -70.0 * k); ivw_trail.add_point(tip)
		ivw_trail.modulate.a = al * 0.9

## the drowned sanctuary's sea: still water under the level, its own colour between the haze far off and the mist
## below, a warm path where the low sun lies on it, broken by ripples
const IV_SEA_SH := """
shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
uniform vec3 bg_top : source_color; uniform vec3 bg_mid : source_color; uniform vec3 bg_bot : source_color;
uniform float sky4 = 0.0; uniform vec3 bg_hz : source_color = vec3(1.0); uniform vec3 sky_s = vec3(0.19, 0.36, 0.84);
uniform vec3 sea_c : source_color = vec3(0.3, 0.45, 0.56);
uniform vec3 glint_c : source_color = vec3(0.99, 0.87, 0.76);
uniform vec2 sun = vec2(0.305, 0.19);
uniform float sea_a = 1.0;      // (the surface: how much of the sea's own colour; the rest is what lies under it, the images in the water)
uniform sampler2D bg_tex : source_color, filter_linear, repeat_disable;      // (a painted sea: its colour, and the sun's path on it, are the backdrop's)
uniform float bg_tex_k = 0.0; uniform vec2 bg_scale = vec2(1.0); uniform float uv_flip = 0.0;
uniform float world_uv = 0.0; uniform vec3 eye_c; uniform vec3 eye_bx; uniform vec3 eye_by; uniform float eye_w = 11.0;      // (where the painting lies under the level's own eye)
uniform sampler2D shore_tex : filter_linear, repeat_disable;      // (how far each spot of the water lies from the stone in it: red what stands for good, green the stones that rise)
uniform vec4 shore_rect = vec4(0.0, 0.0, 1.0, 1.0); uniform float shore_k = 0.0; uniform float shore_d = 1.6; uniform float riser_up = 0.0;
uniform vec3 foam_c : source_color = vec3(1.0, 0.98, 0.96);
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
vec3 bgc(float s){
	if (sky4 > 0.5) { vec3 c = mix(bg_top, bg_hz, smoothstep(sky_s.x * 0.3, sky_s.x, s)); c = mix(c, bg_mid, smoothstep(sky_s.x, sky_s.y, s)); return mix(c, bg_bot, smoothstep(sky_s.y, sky_s.z, s)); }
	vec3 c = mix(bg_top, bg_mid, smoothstep(0.0, 0.55, s)); return mix(c, bg_bot, smoothstep(0.45, 1.0, s)); }
void fragment(){
	float s = SCREEN_UV.y;
	float k = smoothstep(0.21, 0.38, s) * (1.0 - smoothstep(0.5, 0.92, s));
	vec3 c = mix(bgc(s), sea_c, k * 0.9);
	float rip = sin(wp.x * 2.3 + wp.z * 1.7) * sin(wp.z * 3.1 - wp.x * 0.9);
	if (bg_tex_k > 0.5) {
		float sy = uv_flip > 0.5 ? 1.0 - s : s;
		vec2 suv = vec2(0.5 + (SCREEN_UV.x - 0.5) * bg_scale.x, 0.5 + (sy - 0.5) * bg_scale.y);
		if (world_uv > 0.5) { vec3 r = wp - eye_c; suv = vec2(0.5 + dot(r, eye_bx) / eye_w, 0.5 - dot(r, eye_by) / (eye_w * 16.0 / 9.0)); }
		c = texture(bg_tex, clamp(suv, vec2(0.001), vec2(0.999))).rgb;
		c = mix(c, c * 1.04 + vec3(0.01), smoothstep(0.55, 0.95, rip) * 0.5);      // (the faintest swell; no lines across the water: the user wants it still, the small waves along the stones are enough)
		float lum = dot(c, vec3(0.3333));
		vec2 gq = wp.xz * vec2(9.0, 4.0); vec2 gi = floor(gq); vec2 gf = fract(gq) - 0.5;
		float rr = fract(sin(dot(gi, vec2(127.1, 311.7))) * 43758.5453);
		float tw = 0.5 + 0.5 * sin(TIME * (1.4 + rr * 3.2) + rr * 40.0);
		float spark = (1.0 - smoothstep(0.0, 0.16, length(gf * vec2(1.0, 0.45)))) * step(0.8, rr) * tw * tw;
		c += vec3(1.0, 0.95, 0.86) * spark * smoothstep(0.72, 0.88, lum) * 0.85;      // (the sun's path on the water: points of light coming and going)
	} else {
	float path = exp(-pow((SCREEN_UV.x - sun.x) * 5.0, 2.0)) * (1.0 - smoothstep(0.19, 0.55, s));
	c = mix(c, glint_c, path * 0.35 * smoothstep(0.1, 0.9, rip));
	}
	float fo = 0.0;
	if (shore_k > 0.5) {      // (where the still water meets the stone: a thin brightness hugging it, and small waves going out, slow, one after another)
		vec2 su = (wp.xz - shore_rect.xy) * shore_rect.zw;
		vec2 sm = texture(shore_tex, clamp(su, vec2(0.001), vec2(0.999))).rg;
		float inb = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0);
		float d = min((1.0 - sm.r) * shore_d, mix(shore_d, (1.0 - sm.g) * shore_d, riser_up));
		d = mix(shore_d, d, inb);
		float nz = sin(wp.x * 3.7 + wp.z * 2.9 + TIME * 0.4) * 0.5 + sin(wp.z * 5.3 - wp.x * 1.9 - TIME * 0.3) * 0.5;      // (a little unevenness: no line drawn with a compass)
		float dd = d + nz * 0.03;
		float lip = 1.0 - smoothstep(0.02, 0.1, dd);
		float wv = 0.0;
		for (int i = 0; i < 3; i++) {
			float p = fract(TIME * 0.12 + float(i) / 3.0);
			float r = 0.06 + p * 0.62;
			wv += (1.0 - smoothstep(0.0, 0.035 + p * 0.035, abs(dd - r))) * (1.0 - p) * smoothstep(0.0, 0.08, p);
		}
		float brk = smoothstep(-0.4, 0.7, sin(wp.x * 2.1 - wp.z * 3.3 + TIME * 0.25) + nz * 0.7);      // (each wave broken here and there)
		fo = clamp(lip * 0.7 + wv * 0.7 * brk, 0.0, 1.0) * shore_k;
	}
	ALBEDO = mix(c, foam_c, fo);
	if (sea_a < 0.999) ALPHA = mix(sea_a, 1.0, fo);
}
"""
func _ivs_sea(sea_y: float) -> void:
	var m := ShaderMaterial.new(); var sh := Shader.new(); sh.code = IV_SEA_SH; m.shader = sh
	_iv_sky(m)
	# (the eye has no perspective: a sea without end would climb the whole screen; so it ends at the horizon, its far
	# edge a straight line across the screen where the concept has it, and the sky is seen above it)
	var b := _ivp_basis(); var bx := b.x; var by := b.y; var fwd := -b.z
	var ce: Array = ivr_eye.centre
	var ref := IV_O + Vector3(float(ce[0]), float(ce[1]), float(ce[2]))
	var ppm := 1536.0 / float(ivr_eye.width)
	var y := IV_O.y + sea_y
	var sy_h := ((0.5 - ivr_hz) * float(ivr_eye.width) * 16.0 / 9.0) if go_wake else (1376.0 - IVS_HORIZON) / ppm      # (the waking: where its painted backdrop has the sea's rim)
	var ph := ref + by * sy_h + fwd * ((y - ref.y - by.y * sy_h) / fwd.y)      # (the horizon, below the middle of the screen)
	var hb := Vector3(-fwd.x, 0, -fwd.z).normalized()
	var c := [ph - bx * 80.0, ph + bx * 80.0, ph + bx * 80.0 + hb * 120.0, ph - bx * 80.0 + hb * 120.0]
	# (two sheets: the surface, a little clear; and deep under it, along the eye, a floor of the same colours over the
	# same part of the screen: where nothing is in the water the sea looks as before, where an image is it shows)
	if go_wake and iv_bgtex != null:
		m.set_shader_parameter("bg_tex", iv_bgtex); m.set_shader_parameter("bg_tex_k", 1.0); m.set_shader_parameter("bg_scale", _iv_bg_scale()); m.set_shader_parameter("uv_flip", iv_uvf)
		m.set_shader_parameter("world_uv", 1.0); m.set_shader_parameter("eye_c", ref); m.set_shader_parameter("eye_bx", bx); m.set_shader_parameter("eye_by", by); m.set_shader_parameter("eye_w", float(ivr_eye.width))
	var mf := m.duplicate() as ShaderMaterial
	m.set_shader_parameter("sea_a", 0.5 if go_wake else 0.7)
	if not ivr_shore.is_empty():      # (small waves along every stone standing in the water: the surface only)
		var rc: Array = ivr_shore.rect
		m.set_shader_parameter("shore_tex", load(go_dir + "shore.png")); m.set_shader_parameter("shore_k", 1.0); m.set_shader_parameter("shore_d", float(ivr_shore.get("D", 1.6)))
		m.set_shader_parameter("shore_rect", Vector4(IV_O.x + float(rc[0]), IV_O.z + float(rc[1]), 1.0 / (float(rc[2]) - float(rc[0])), 1.0 / (float(rc[3]) - float(rc[1]))))
		m.set_shader_parameter("riser_up", 1.0 if ivw_up > 0.5 else 0.0)
	ivs_sea_mat = m
	for pass_i in 2:
		var off := Vector3.ZERO if pass_i == 0 else fwd * 40.0
		var st := SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for t in [[0, 1, 2], [0, 2, 3]]:
			for i in t: st.set_normal(Vector3.UP); st.add_vertex((c[i] as Vector3) + off)
		var mi := MeshInstance3D.new(); mi.mesh = st.commit(); mi.material_override = m if pass_i == 0 else mf; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
	ivs_horizon = ph

## far off over the sea, where the concept (gosea/concept.png) has each thing: the colossal face of the one who was
## drowned, lying in the water by the causeway; an island with a colonnade and a tall statue on its crown, the low
## sun behind its shoulder; stacks of rock standing in the sea, one with a colonnade; low isles along the horizon.
## Shapes in the haze, paler with distance, each fading into the mist from its top down.
func _ivs_far() -> void:
	var b := _ivp_basis()
	var bx := b.x; var by := b.y; var fwd := -b.z
	var ce: Array = ivr_eye.centre
	var ref := IV_O + Vector3(float(ce[0]), float(ce[1]), float(ce[2]))
	var ppm := 1536.0 / float(ivr_eye.width)      # (the concept's pixels a metre)
	var rng := RandomNumberGenerator.new(); rng.seed = 41
	var spot := func(sx: float, sy: float, dep: float) -> Vector3: return ref + bx * sx + by * sy + fwd * dep
	var spot_y := func(sx: float, sy: float, y: float) -> Vector3: return ref + bx * sx + by * sy + fwd * ((y - ref.y - by.y * sy) / fwd.y)
	var P := func(X: float, Y: float, dep: float) -> Vector3: return spot.call((X - 768.0) / ppm, (1376.0 - Y) / ppm, dep)
	var S2 := func(X: float, Y: float) -> Vector2: return Vector2((X - 768.0) / ppm, (1376.0 - Y) / ppm)
	var fog := func(top: float, w: float) -> Dictionary: return {"sil": 1.0, "fog_hi": top - (0.5 + w * 1.1), "fog_lo": top - (3.6 + w * 3.0)}
	# the colossal face, lying in the sea by the causeway, looking up at the eye
	var sea_y := IV_O.y + float(ivr_sea_y)
	var fc: Vector3 = spot_y.call((1180.0 - 768.0) / ppm, (1376.0 - 1230.0) / ppm, sea_y)
	var hp := Node3D.new(); add_child(hp); hp.global_position = fc + Vector3(0, -1.0, 0)      # (half sunk: the water at its cheek)
	var hd := prop_model("iv_head", hp, 3.9); hd.position = Vector3(0, -1.3, 0)
	for m in hd.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _iv_mat("seaface", 0.0, {"fog_hi": -900.0, "fog_lo": -901.0}); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var fzv := Vector3(0.52, 0.42, 0.74); var fyv := Vector3(-0.78, 0.55, -0.1)      # (as the fallen face of the ivory level: it looks up at the eye, its crown to the upper left)
	if OS.get_environment("IVS_FZ") != "": var q := OS.get_environment("IVS_FZ").split(","); fzv = Vector3(float(q[0]), float(q[1]), float(q[2]))
	if OS.get_environment("IVS_FY") != "": var q2 := OS.get_environment("IVS_FY").split(","); fyv = Vector3(float(q2[0]), float(q2[1]), float(q2[2]))
	var fz := fzv.normalized()
	var fy := (fyv - fz * fyv.dot(fz)).normalized()
	var fx := fy.cross(fz)
	hp.basis = Basis(fz, fy, -fx)
	_ivs_mirror(hp, func(_mi: MeshInstance3D) -> Array: return ["seaface", 0.0, {"fog_hi": -900.0, "fog_lo": -901.0}])
	# its shadow on the water, away from the low sun: a soft dark pool beside it
	var sdir := Vector3(-iv_key.x, 0, -iv_key.z).normalized()
	var sq := QuadMesh.new(); sq.size = Vector2(4.2, 2.6); sq.orientation = PlaneMesh.FACE_Y
	var smat := StandardMaterial3D.new(); smat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; smat.albedo_texture = load("res://goiv/shadow.png")
	smat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; smat.albedo_color = Color(0.1, 0.17, 0.27, 0.5); smat.render_priority = 2; smat.no_depth_test = false
	var shq := MeshInstance3D.new(); shq.mesh = sq; shq.material_override = smat; shq.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(shq)
	shq.global_position = Vector3(fc.x, sea_y + 0.012, fc.z) + sdir * 1.1
	shq.basis = Basis(Vector3.UP, atan2(sdir.x, sdir.z) + PI * 0.5)
	# far off, as the concept has it: cliffs and stacks rising out of the haze. The eye has no perspective, so "far" is
	# only paler and smaller; each stands just behind the level, set by its top in the concept and by where its body
	# has gone wholly into the mist (its foot, below which the sea lies in front of it). It fades into the mist from a
	# little under its top down to that foot; the mist there is the sea's own colour, so it has no edge anywhere.
	var cosp := cos(deg_to_rad(IVP_TH))
	var dep_at := func(Yw: float) -> float:      # (how deep the sea lies behind the concept's height Yw on the screen)
		var syw := (1376.0 - Yw) / ppm
		return (sea_y - ref.y - by.y * syw) / fwd.y
	# [x, top y, the y where it is wholly gone (concept px), width (m), haze, palette, how soon it fades (0..1)]
	for f in [
			[1290, 120, 640, 4.6, 0.6, "far", 0.25],      # (a great pale mountain behind, at the right)
			[150, 330, 640, 2.8, 0.56, "far", 0.25],      # (low pale hills at the left, beyond the sun)
			[853, 425, 1000, 2.5, 0.22, "far", 0.42],      # (the island in the middle: its cliff under the colonnade and the statue)
			[620, 560, 960, 1.6, 0.34, "far", 0.36], [1075, 545, 940, 1.3, 0.34, "far", 0.36],      # (its shoulders, further back and paler)
			[1228, 345, 900, 1.25, 0.2, "far1", 0.38],      # (a tall stack right of the island)
			[338, 425, 820, 0.9, 0.26, "far1", 0.36],      # (a stack at the left, by the sun)
			[40, 505, 980, 1.7, 0.24, "far1", 0.36],      # (a headland at the far left)
			[1415, 640, 1060, 1.5, 0.16, "far1", 0.45]]:      # (the stack of the colonnade at the right)
		var dd: float = dep_at.call(float(f[2]))
		var top: Vector3 = P.call(float(f[0]), float(f[1]), dd)
		var tall := top.y - sea_y
		var st := _iv_st(); _ivr_crag(st, top, float(f[3]), rng, false, 0.62, false, true)
		_iv_commit(st, String(f[5]), self, float(f[4]), {"sil": 1.0, "fog_hi": top.y - tall * float(f[6]), "fog_lo": sea_y + 0.05}, false)
	# the colonnade on the island's crown, going away to the left; the statue at its end, on its pedestal
	var di: float = dep_at.call(1000.0)
	var c0: Vector3 = P.call(853, 425, di)
	var cs := _iv_st()
	_ivr_colonnade(cs, spot_y, S2.call(880, 425), Vector2(-7.0, 6.0), c0.y, 6, 0.95, 0.3, 6, rng)
	_iv_commit(cs, "farsil", self, 0.24, {"sil": 1.0, "fog_hi": c0.y - 0.2, "fog_lo": sea_y + 0.05}, false)
	var sp: Vector3 = spot_y.call(S2.call(912, 400).x, S2.call(912, 400).y, c0.y)
	var ps := _iv_st(); _iv_box(ps, sp + Vector3(-0.25, -0.5, -0.25), sp + Vector3(0.25, 0.3, 0.25)); _iv_commit(ps, "farsil", self, 0.24, {"sil": 1.0, "fog_hi": c0.y - 0.2, "fog_lo": sea_y + 0.05}, false)
	var col := prop_model("iv_colossus", self, 2.4)
	col.position = sp + Vector3(0, 0.3, 0); col.rotation.y = PI * 0.15
	for m in col.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _iv_mat("farsil", 0.24, {"sil": 1.0, "fog_hi": c0.y - 0.2, "fog_lo": sea_y + 0.05}); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# the colonnade on the stack at the right, going away to the right
	var dr: float = dep_at.call(1060.0)
	var r0: Vector3 = P.call(1415, 640, dr)
	var rs := _iv_st()
	_ivr_colonnade(rs, spot_y, S2.call(1330, 640), Vector2(9.0, 4.6), r0.y, 4, 0.85, 0.34, 4, rng)
	_iv_commit(rs, "farsil", self, 0.16, {"sil": 1.0, "fog_hi": r0.y - 0.2, "fog_lo": sea_y + 0.05}, false)

# ---------------------------------------------------------------- the quarry (goquarry/): looks along the board, bronze mirrors, the capstan
## A face may look a way rather than at a node: straight on along the board's level ways (and over a chasm), turned a
## quarter by a bronze mirror as light is, until the dial, the stone or another face stops it; and a face that another
## face's look reaches breaks (tools/go/trials.py: the same rules, proven first).
var ivg_mir := {}      # the bronze mirrors: node -> {turn (0 '/', 1 '\'), turn0, n (what turns), mark (on the floor)}
var ivg_gaps := []      # (chasms a look goes over and nobody walks)
var ivg_fbreak := false
var ivg_dirv := {}      # the board's ways in the world: "E", "S", "W", "N"
const IVQ_MIRROR := [{"E": "N", "N": "E", "W": "S", "S": "W"}, {"E": "S", "S": "E", "W": "N", "N": "W"}]

func _ivg_dname(d: Vector3) -> String:
	var best := "E"; var bc := -2.0
	for k in ivg_dirv:
		var c := (ivg_dirv[k] as Vector3).dot(d)
		if c > bc: bc = c; best = String(k)
	return best

## the node a look goes on to from c the way d: along a level way, or over a chasm
func _ivg_look_next(c: String, d: Vector3) -> String:
	var best := ""; var bc := 0.9
	var pc: Vector3 = ivp_nodes[c]
	for e in ivp_edges:
		var o := ""
		if e[0] == c: o = String(e[1])
		elif e[1] == c: o = String(e[0])
		else: continue
		if not (e[2] as Array).is_empty() or o == "s": continue
		var v: Vector3 = (ivp_nodes[o] as Vector3) - pc; v.y = 0.0
		if v.length() < 0.01: continue
		var k := v.normalized().dot(d)
		if k > bc: bc = k; best = o
	for g in ivg_gaps:
		var o2 := String(g[1]) if String(g[0]) == c else (String(g[0]) if String(g[1]) == c else "")
		if o2 == "": continue
		var v2: Vector3 = (ivp_nodes[o2] as Vector3) - pc; v2.y = 0.0
		var k2 := v2.normalized().dot(d)
		if k2 > bc: bc = k2; best = o2
	return best

## a face's look along the board: the nodes it strikes, the points it passes (to draw it), the face it ends on
func _ivg_dlook(f: Dictionary) -> Dictionary:
	var d: Vector3 = ivg_dirv[String(f.dirs[ivg_v])]
	var c := String(f.node); var out := []; var pts := [ivp_nodes[c]]; var hit := -1; var seen := {}
	for _i in 60:
		var n := _ivg_look_next(c, d)
		if n == "" or n == iv_block or n == ivg_vol: break
		var fi := _ivg_face_on(n)
		if fi >= 0: hit = fi; pts.append(ivp_nodes[n]); break
		if ivg_mir.has(n):
			var key := n + _ivg_dname(d)
			if seen.has(key): break
			seen[key] = true
			d = ivg_dirv[String(IVQ_MIRROR[int(ivg_mir[n].turn)][_ivg_dname(d)])]
			pts.append(ivp_nodes[n]); c = n; continue
		out.append(n); pts.append(ivp_nodes[n]); c = n
	if hit < 0 and pts.size() >= 2:      # (a look that runs off the board: drawn a little way on)
		pts.append((pts[pts.size() - 1] as Vector3) + d * 0.7)
	return {"nodes": out, "pts": pts, "hit": hit}

## a face whose look another's reaches breaks; then the looks are looked again, until none does
func _ivg_settle() -> void:
	if not ivg_fbreak: return
	for _k in 8:
		var hit := []
		for f in ivg_faces:
			if not f.alive or not f.has("dirs"): continue
			var h := int(_ivg_dlook(f).hit)
			if h >= 0 and not hit.has(h): hit.append(h)
		if hit.is_empty(): return
		await wait(0.25)
		for i in hit:
			print("IV a look breaks the face at ", ivg_faces[i].node)
			_ivg_face_break(int(i))
		_ivg_gaze_all()
		await wait(0.6)

## a look drawn: a red line along the floor round every corner a mirror turns, a ring on each node it strikes
func _ivg_dgaze_draw(f: Dictionary) -> void:
	if not f.has("segs"):
		var gm := (f.gaze[0] as MeshInstance3D).material_override
		var segs := []
		for _s in 6:
			var lm := BoxMesh.new(); lm.size = Vector3(1.0, 0.004, 0.05)
			var ln := MeshInstance3D.new(); ln.mesh = lm; ln.material_override = gm; ln.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_root.add_child(ln)
			segs.append(ln)
		f["segs"] = segs; (f.gaze[0] as Node3D).visible = false
	var L := _ivg_dlook(f) if f.alive else {"nodes": [], "pts": [], "hit": -1}
	var pts: Array = L.pts; var segs2: Array = f.segs
	for i in segs2.size():
		var ln2: MeshInstance3D = segs2[i]
		ln2.visible = f.alive and i + 1 < pts.size()
		if not ln2.visible: continue
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]
		var a2 := Vector3(a.x, a.y, a.z); var b2 := Vector3(b.x, b.y, b.z)
		if i == 0: a2 = a + (b - a).normalized() * 0.3
		var dv := Vector3(b2.x - a2.x, 0, b2.z - a2.z); var LL := maxf(dv.length(), 0.01); dv = dv / LL
		ln2.global_position = (a2 + b2) * 0.5 + Vector3(0, 0.03, 0)
		ln2.basis = Basis(dv * LL, Vector3.UP, dv.cross(Vector3.UP))
	var g: Array = f.gaze
	(g[0] as Node3D).visible = false
	for i in range(1, g.size()):
		var rg: MeshInstance3D = g[i]
		rg.visible = f.alive and i - 1 < (L.nodes as Array).size()
		if rg.visible: rg.global_position = (ivp_nodes[L.nodes[i - 1]] as Vector3) + Vector3(0, 0.04, 0)

## the quarry's own things: the colossal face the sculptor began in the north face and never finished, half out of the
## rock above the corridor; scaffolding of wood on the steps of the faces, its planks and its ladder
func _ivq_decor() -> void:
	var hp := Node3D.new(); iv_root.add_child(hp); hp.global_position = IV_O + Vector3(-4.6, 3.25, -9.75)
	var hd := prop_model("iv_head", hp, 3.1); hd.position = Vector3(0, -1.55, 0)
	for m in hd.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _ivr_mat("phead", 0.0); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var fz := Vector3(0.12, -0.18, 1.0).normalized()      # (it looks out of the rock, a little down, at the corridor)
	hp.basis = Basis(fz, Vector3.UP, fz.cross(Vector3.UP)).orthonormalized()
	var ws := _iv_st()      # (the scaffolding: posts, two floors of planks, a ladder)
	var y0 := 2.35; var hgt := 2.3
	for px in [-0.6, 0.6, 1.8]:
		_iv_box(ws, Vector3(px - 0.05, y0, -9.0), Vector3(px + 0.05, y0 + hgt, -8.9))
		_iv_box(ws, Vector3(px - 0.05, y0, -9.42), Vector3(px + 0.05, y0 + hgt, -9.32))
	for py in [y0 + 1.05, y0 + 2.2]:
		for k in 3: _iv_box(ws, Vector3(-0.75, py, -9.4 + float(k) * 0.16), Vector3(1.95, py + 0.035, -9.27 + float(k) * 0.16))
		_iv_box(ws, Vector3(-0.75, py - 0.08, -9.12), Vector3(1.95, py, -9.04))
	for ry in range(6): _iv_box(ws, Vector3(1.9, y0 + 0.15 + ry * 0.36, -9.12), Vector3(2.25, y0 + 0.19 + ry * 0.36, -9.06))
	_iv_box(ws, Vector3(1.88, y0, -9.13), Vector3(1.92, y0 + 2.25, -9.05)); _iv_box(ws, Vector3(2.23, y0, -9.13), Vector3(2.27, y0 + 2.25, -9.05))
	var wmi := MeshInstance3D.new(); wmi.mesh = ws.commit(); wmi.material_override = _ivr_mat("wood", 0.0); wmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	iv_root.add_child(wmi)

## a bronze mirror on its stand: a disc in a ring of bronze, turned to send a look on a quarter round; a bar of bronze
## let into the floor under it shows the way it turns a look, from wherever it is seen
func _ivq_mirror(nd: String, turn: int) -> void:
	var p: Vector3 = ivp_nodes[nd]
	var root := Node3D.new(); iv_root.add_child(root); root.global_position = p
	var bs := _iv_st()
	_iv_box(bs, Vector3(-0.3, 0.0, -0.3), Vector3(0.3, 0.12, 0.3)); _iv_box(bs, Vector3(-0.22, 0.12, -0.22), Vector3(0.22, 0.2, 0.22))
	var bmi := MeshInstance3D.new(); bmi.mesh = bs.commit(); bmi.material_override = _ivr_mat("marble2", 0.0); root.add_child(bmi)
	var head := Node3D.new(); root.add_child(head)
	var post := CylinderMesh.new(); post.top_radius = 0.035; post.bottom_radius = 0.05; post.height = 0.5; post.radial_segments = 10; post.rings = 1
	var pmi := MeshInstance3D.new(); pmi.mesh = post; pmi.material_override = _ivr_mat("bronze", 0.0); pmi.position = Vector3(0, 0.45, 0); head.add_child(pmi)
	var disc := CylinderMesh.new(); disc.top_radius = 0.34; disc.bottom_radius = 0.34; disc.height = 0.04; disc.radial_segments = 36; disc.rings = 1
	var dmi := MeshInstance3D.new(); dmi.mesh = disc; dmi.material_override = _ivr_mat("silver", 0.0); dmi.position = Vector3(0, 1.02, 0); dmi.rotation.x = PI * 0.5; head.add_child(dmi)
	var rim := TorusMesh.new(); rim.inner_radius = 0.33; rim.outer_radius = 0.39; rim.rings = 36; rim.ring_segments = 8
	var rmi := MeshInstance3D.new(); rmi.mesh = rim; rmi.material_override = _ivr_mat("bronze", 0.0); rmi.position = Vector3(0, 1.02, 0); rmi.rotation.x = PI * 0.5; rmi.scale = Vector3(1, 1.6, 1); head.add_child(rmi)
	var bar := BoxMesh.new(); bar.size = Vector3(0.95, 0.012, 0.06)
	var mk := MeshInstance3D.new(); mk.mesh = bar; mk.material_override = _ivr_mat("bronze", 0.0); mk.position = Vector3(0, 0.205, 0); head.add_child(mk)
	for m in [bmi, pmi, dmi, rmi]: (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	ivg_mir[nd] = {"turn": turn, "turn0": turn, "n": head}
	_ivq_mirror_pose(nd, 0.0)

## where a mirror's face lies: along the diagonal between the two ways it joins ('/' joins E and N, '\' E and S)
func _ivq_mirror_basis(turn: int) -> Basis:
	var dg: Vector3 = ((ivg_dirv["E"] as Vector3) + (ivg_dirv["N"] if turn == 0 else ivg_dirv["S"])).normalized()
	return Basis(dg, Vector3.UP, dg.cross(Vector3.UP))
func _ivq_mirror_pose(nd: String, t: float) -> void:
	var head: Node3D = ivg_mir[nd].n; var b := _ivq_mirror_basis(int(ivg_mir[nd].turn))
	if t <= 0.0: head.basis = b; return
	var q0 := head.quaternion; var q1 := b.get_rotation_quaternion()
	if q0.dot(q1) < 0.0: q1 = -q1
	var tw2 := create_tween(); tw2.tween_method(func(k: float) -> void: head.quaternion = q0.slerp(q1, k), 0.0, 1.0, t).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await tw2.finished

## she turns a mirror a quarter round, her hands on its rim
func _ivq_mirror_turn(nd: String) -> void:
	iv_busy = true
	var wp: Vector3 = (ivp_nodes[nd] as Vector3) + Vector3(0, 0.9, 0)
	face_to = wp
	var n := 0
	while face_to != null and n < 90: await get_tree().process_frame; n += 1
	var to_her := Vector3(pos.x - wp.x, 0, pos.z - wp.z).normalized()
	var fr := wp + to_her * 0.3
	tgtL = fr + Vector3(0, 0.15, 0) + to_her.cross(Vector3.UP) * 0.16; tgtR = fr + Vector3(0, -0.05, 0) - to_her.cross(Vector3.UP) * 0.16
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.3); up.tween_property(self, "a_wR", 1.0, 0.3); up.tween_property(self, "a_lean", 0.14, 0.3)
	await up.finished
	ivg_mir[nd].turn = 1 - int(ivg_mir[nd].turn)
	print("IV the mirror at ", nd, " turns: ", ivg_mir[nd].turn)
	await _ivq_mirror_pose(nd, 0.8)
	_ivg_gaze_all()
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.35); dn.tween_property(self, "a_wR", 0.0, 0.35); dn.tween_property(self, "a_lean", 0.0, 0.35)
	await dn.finished
	iv_busy = false

## the capstan of the quarry: a drum of wood with its bars; turned, it turns the face on its turntable
func _ivq_capstan(p: Vector3) -> void:
	var base := Node3D.new(); iv_root.add_child(base); base.global_position = p
	var ring := CylinderMesh.new(); ring.top_radius = 0.42; ring.bottom_radius = 0.46; ring.height = 0.1; ring.radial_segments = 20; ring.rings = 1
	var rmi := MeshInstance3D.new(); rmi.mesh = ring; rmi.material_override = _ivr_mat("marble2", 0.0); rmi.position = Vector3(0, 0.05, 0); base.add_child(rmi)
	iv_wheel = Node3D.new(); iv_root.add_child(iv_wheel); iv_wheel.global_position = p + Vector3(0, 0.55, 0); iv_wheel.rotation = Vector3(-PI * 0.5, 0, 0)
	var drum := CylinderMesh.new(); drum.top_radius = 0.17; drum.bottom_radius = 0.2; drum.height = 0.62; drum.radial_segments = 14; drum.rings = 1
	var dmi := MeshInstance3D.new(); dmi.mesh = drum; dmi.material_override = _ivr_mat("wood", 0.0); dmi.rotation.x = PI * 0.5; dmi.position = Vector3(0, 0, -0.2); iv_wheel.add_child(dmi)
	var cap := CylinderMesh.new(); cap.top_radius = 0.21; cap.bottom_radius = 0.21; cap.height = 0.06; cap.radial_segments = 14; cap.rings = 1
	var cmi := MeshInstance3D.new(); cmi.mesh = cap; cmi.material_override = _ivr_mat("bronze", 0.0); cmi.rotation.x = PI * 0.5; cmi.position = Vector3(0, 0, 0.1); iv_wheel.add_child(cmi)
	for k in 4:      # (the bars)
		var bx := BoxMesh.new(); bx.size = Vector3(0.62, 0.055, 0.055)
		var bmi := MeshInstance3D.new(); bmi.mesh = bx; bmi.material_override = _ivr_mat("wood", 0.0); bmi.position = Vector3(cos(TAU * k / 4.0) * 0.48, sin(TAU * k / 4.0) * 0.48, 0.02); bmi.rotation.z = TAU * k / 4.0; iv_wheel.add_child(bmi)
	for m in [rmi, dmi, cmi]: (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

## the dust of the quarry in the light: motes drifting slowly
func _ivq_dust(cl: CanvasLayer) -> void:
	var vs := get_viewport().get_visible_rect().size
	var k := vs.x / 720.0
	var pt := CPUParticles2D.new(); cl.add_child(pt)
	pt.amount = 46; pt.lifetime = 16.0; pt.preprocess = 16.0
	pt.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE; pt.emission_rect_extents = Vector2(vs.x * 0.55, vs.y * 0.5)
	pt.position = vs * 0.5
	pt.direction = Vector2(0.4, -1.0); pt.spread = 70.0; pt.gravity = Vector2.ZERO
	pt.initial_velocity_min = 4.0 * k; pt.initial_velocity_max = 14.0 * k
	pt.texture = load("res://goiv/glow.png")
	pt.scale_amount_min = 0.012 * k; pt.scale_amount_max = 0.03 * k
	var gr := Gradient.new(); gr.offsets = PackedFloat32Array([0.0, 0.2, 0.8, 1.0])
	gr.colors = PackedColorArray([Color(1, 0.96, 0.86, 0.0), Color(1, 0.96, 0.86, 0.55), Color(1, 0.96, 0.86, 0.55), Color(1, 0.96, 0.86, 0.0)])
	pt.color_ramp = gr

# ---------------------------------------------------------------- the moon dial (gomoon/): its own things
const IVM_MOON := Vector2(0.7, 0.15)      # (the moon on the screen: where its middle is, and how wide it is across the screen)
const IVM_MOON_R := 0.15
const IVM_FLAME_SH := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;      // (drawn over what is behind it, not added: on the snow an added flame burns out white)
uniform float seed = 0.0;
uniform float k = 1.0;
void vertex(){      // (always upright, always turned to the eye)
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], MODEL_MATRIX[1], vec4(normalize(cross(INV_VIEW_MATRIX[0].xyz, MODEL_MATRIX[1].xyz)), 0.0), MODEL_MATRIX[3]);
}
void fragment(){
	float t = TIME * 5.0 + seed * 17.0;
	float y = 1.0 - UV.y;
	float sway = (sin(t * 1.3 + y * 4.0) * 0.07 + sin(t * 2.3 + y * 8.0) * 0.035) * y;
	float x = abs((UV.x - 0.5 - sway) * 2.0);
	float lick = 0.9 + 0.1 * sin(t * 3.1);
	float w = (y < 0.22 ? sqrt(y / 0.22) : pow(max(1.0 - (y - 0.22) / (0.78 * lick), 0.0), 1.15)) * 0.62;
	float a = 1.0 - smoothstep(w * 0.55, w + 0.02, x);
	float core = (1.0 - smoothstep(w * 0.15, w * 0.6, x)) * (1.0 - smoothstep(0.25, 0.75, y));
	vec3 c = mix(vec3(1.0, 0.36, 0.06), vec3(1.0, 0.72, 0.28), smoothstep(0.0, 0.6, 1.0 - x / max(w, 0.001)));
	c = mix(c, vec3(1.0, 0.95, 0.75), core);
	ALBEDO = c; ALPHA = clamp(a * k * (0.9 + 0.1 * sin(t * 2.0)), 0.0, 1.0);
}
"""
var ivm_flame_sh: Shader

## the moon dial: a bronze disc that faces the eye, on a pedestal of marble behind it, turned about its axle. On its face
## a full moon above and a crescent below, in silver; turned half round, the crescent stands above: the moon's other
## face, and every face bound to it looks the other way
func _ivm_dial(base: Vector3) -> void:
	var b := _ivp_basis(); var fz := Vector3(b.z.x, 0, b.z.z).normalized()      # (its face to the eye)
	var fx := Vector3.UP.cross(fz)
	var R := 0.36; var T := 0.08; var H := 0.64      # (its radius, its thickness, the height of its axle)
	var sd := Node3D.new(); iv_root.add_child(sd); sd.global_position = base; sd.basis = Basis(fx, Vector3.UP, fz)
	var ps := _iv_st()
	_iv_box(ps, Vector3(-0.44, 0.0, -0.22), Vector3(0.44, 0.1, 0.16))      # (the plinth)
	_iv_box(ps, Vector3(-0.38, 0.1, -0.18), Vector3(0.38, 0.17, 0.1))
	_iv_box(ps, Vector3(-0.09, 0.17, -T * 0.5 - 0.17), Vector3(0.09, H + 0.02, -T * 0.5 - 0.03))      # (the pedestal behind the disc)
	_iv_box(ps, Vector3(-0.12, H + 0.02, -T * 0.5 - 0.2), Vector3(0.12, H + 0.08, -T * 0.5 - 0.0))
	var pm := MeshInstance3D.new(); pm.mesh = ps.commit(); pm.material_override = _ivr_mat("marble2", 0.0); sd.add_child(pm)
	var hub := CylinderMesh.new(); hub.top_radius = 0.045; hub.bottom_radius = 0.045; hub.height = 0.2; hub.radial_segments = 12; hub.rings = 1      # (the axle, bronze, from the pedestal into the disc's middle)
	var hm := MeshInstance3D.new(); hm.mesh = hub; hm.material_override = _ivr_mat("bronze", 0.0); hm.position = Vector3(0, H, -T * 0.5 - 0.02); hm.rotation.x = PI * 0.5; sd.add_child(hm)
	iv_wheel = Node3D.new(); iv_root.add_child(iv_wheel); iv_wheel.global_position = base + Vector3(0, H, 0); iv_wheel.basis = Basis(fx, Vector3.UP, fz)
	var dm := CylinderMesh.new(); dm.top_radius = R; dm.bottom_radius = R; dm.height = T; dm.radial_segments = 40; dm.rings = 1
	var di := MeshInstance3D.new(); di.mesh = dm; di.material_override = _ivr_mat("bronze", 0.0); di.rotation.x = PI * 0.5; iv_wheel.add_child(di)
	var rim := TorusMesh.new(); rim.inner_radius = R - 0.035; rim.outer_radius = R + 0.012; rim.rings = 40; rim.ring_segments = 8
	var ri := MeshInstance3D.new(); ri.mesh = rim; ri.material_override = _ivr_mat("bronze", 0.0); ri.rotation.x = PI * 0.5; ri.scale = Vector3(1, 1.6, 1); iv_wheel.add_child(ri)
	# the full moon above, the crescent below: silver, standing a little proud of the face
	var sv := _iv_st(); var z0 := T * 0.5; var z1 := T * 0.5 + 0.018
	var c0 := Vector2(0, 0.19); var r0 := 0.082
	for k in 28:
		var a0 := TAU * float(k) / 28.0; var a1 := TAU * float(k + 1) / 28.0
		var p0 := Vector3(c0.x + cos(a0) * r0, c0.y + sin(a0) * r0, 0); var p1 := Vector3(c0.x + cos(a1) * r0, c0.y + sin(a1) * r0, 0)
		_iv_tri(sv, Vector3(c0.x, c0.y, z1), p0 + Vector3(0, 0, z1), p1 + Vector3(0, 0, z1), Vector3(0, 0, 1))
		_iv_quad(sv, p0 + Vector3(0, 0, z0), p1 + Vector3(0, 0, z0), p1 + Vector3(0, 0, z1), p0 + Vector3(0, 0, z1), Vector3(p0.x + p1.x - 2.0 * c0.x, p0.y + p1.y - 2.0 * c0.y, 0))
	for sp in [Vector2(-0.2, 0.06), Vector2(0.21, 0.02), Vector2(-0.15, -0.12), Vector2(0.17, -0.15), Vector2(0.0, 0.0)]:      # (stars between them)
		var sr := 0.022 if sp.length() > 0.01 else 0.03
		for k in 4:
			var a0 := TAU * float(k) / 4.0; var a1 := TAU * float(k + 1) / 4.0; var am := (a0 + a1) * 0.5
			var q0 := Vector3(sp.x + cos(a0) * sr, sp.y + sin(a0) * sr, z1); var q1 := Vector3(sp.x + cos(a1) * sr, sp.y + sin(a1) * sr, z1)
			var qm := Vector3(sp.x + cos(am) * sr * 0.35, sp.y + sin(am) * sr * 0.35, z1)
			_iv_tri(sv, Vector3(sp.x, sp.y, z1 + 0.004), q0, qm, Vector3(0, 0, 1)); _iv_tri(sv, Vector3(sp.x, sp.y, z1 + 0.004), qm, q1, Vector3(0, 0, 1))
	var cc := Vector2(0, -0.19); var cr := 0.082; var dd := 0.05      # (the crescent: the moon's disc, less a disc of the same size moved aside)
	var ty := sqrt(cr * cr - dd * dd * 0.25); var th0 := atan2(ty, -dd * 0.5); var ph0 := atan2(ty, dd * 0.5)
	var outer := []; var inner := []
	for k in 25:
		var t := float(k) / 24.0
		var ao := lerpf(th0, -th0, t); var ai := lerpf(ph0, -ph0, t)
		outer.append(Vector3(cc.x + cos(ao) * cr, cc.y + sin(ao) * cr, 0)); inner.append(Vector3(cc.x - dd + cos(ai) * cr, cc.y + sin(ai) * cr, 0))
	for k in 24:
		var o0: Vector3 = outer[k]; var o1: Vector3 = outer[k + 1]; var i0: Vector3 = inner[k]; var i1: Vector3 = inner[k + 1]
		_iv_quad(sv, o0 + Vector3(0, 0, z1), o1 + Vector3(0, 0, z1), i1 + Vector3(0, 0, z1), i0 + Vector3(0, 0, z1), Vector3(0, 0, 1))
		_iv_quad(sv, o0 + Vector3(0, 0, z0), o1 + Vector3(0, 0, z0), o1 + Vector3(0, 0, z1), o0 + Vector3(0, 0, z1), Vector3(o0.x + o1.x - 2.0 * cc.x, o0.y + o1.y - 2.0 * cc.y, 0))
		_iv_quad(sv, i0 + Vector3(0, 0, z0), i1 + Vector3(0, 0, z0), i1 + Vector3(0, 0, z1), i0 + Vector3(0, 0, z1), -Vector3(i0.x + i1.x - 2.0 * (cc.x - dd), i0.y + i1.y - 2.0 * cc.y, 0))
	var smi := MeshInstance3D.new(); smi.mesh = sv.commit(); smi.material_override = _ivr_mat("silver", 0.0); iv_wheel.add_child(smi)
	for m in [pm, hm, di, ri, smi]: (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

## a brazier: an iron drum on the snow with a fire in it, its glow, and a warm pool of light on the floor about it
func _ivm_brazier(p: Vector3) -> void:
	var n := Node3D.new(); iv_root.add_child(n); n.global_position = p
	var parts := [[0.15, 0.15, 0.05, 0.025], [0.115, 0.13, 0.36, 0.23], [0.155, 0.15, 0.045, 0.43], [0.14, 0.14, 0.03, 0.465]]      # (top r, bottom r, height, middle)
	for q in parts:
		var cm := CylinderMesh.new(); cm.top_radius = float(q[0]); cm.bottom_radius = float(q[1]); cm.height = float(q[2]); cm.radial_segments = 14; cm.rings = 1
		var mi := MeshInstance3D.new(); mi.mesh = cm; mi.material_override = _ivr_mat("iron", 0.0); mi.position = Vector3(0, float(q[3]), 0); n.add_child(mi)
	var em := StandardMaterial3D.new(); em.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; em.albedo_color = Color(1.0, 0.42, 0.12)
	var ec := CylinderMesh.new(); ec.top_radius = 0.125; ec.bottom_radius = 0.125; ec.height = 0.01; ec.radial_segments = 14; ec.rings = 1
	var emb := MeshInstance3D.new(); emb.mesh = ec; emb.material_override = em; emb.position = Vector3(0, 0.476, 0); emb.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; n.add_child(emb)
	if ivm_flame_sh == null: ivm_flame_sh = Shader.new(); ivm_flame_sh.code = IVM_FLAME_SH
	for f in [[0.36, 0.56, 0.0, 1.0], [0.24, 0.4, 0.07, 0.8]]:
		var fq := QuadMesh.new(); fq.size = Vector2(float(f[0]), float(f[1]))
		var fm := ShaderMaterial.new(); fm.shader = ivm_flame_sh; fm.set_shader_parameter("seed", p.x * 0.37 + p.z * 0.71 + float(f[2]) * 9.0); fm.set_shader_parameter("k", float(f[3]))
		var fi := MeshInstance3D.new(); fi.mesh = fq; fi.material_override = fm; fi.position = Vector3(float(f[2]) * 0.3, 0.47 + float(f[1]) * 0.5, 0); fi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; n.add_child(fi)
	var gq := QuadMesh.new(); gq.size = Vector2(1.5, 1.5)
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_texture = load("res://goiv/glow.png")
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; gm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; gm.albedo_color = Color(1.0, 0.55, 0.22, 0.42)
	var gi := MeshInstance3D.new(); gi.mesh = gq; gi.material_override = gm; gi.position = Vector3(0, 0.66, 0); gi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; n.add_child(gi)
	var lq := QuadMesh.new(); lq.size = Vector2(2.3, 2.3); lq.orientation = PlaneMesh.FACE_Y
	var lm := StandardMaterial3D.new(); lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; lm.albedo_texture = load("res://goiv/glow.png")
	lm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; lm.albedo_color = Color(1.0, 0.66, 0.36, 0.34); lm.render_priority = 2
	var li := MeshInstance3D.new(); li.mesh = lq; li.material_override = lm; li.position = Vector3(0, 0.014, 0); li.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; n.add_child(li)

## a snowy peak far off: a pyramid of a few broad faces, its ridges running down from the summit and out into the haze
func _ivm_peak(st: SurfaceTool, top: Vector3, w: float, h: float, rng: RandomNumberGenerator) -> void:
	var n := 7
	var a0 := rng.randf_range(0.0, TAU)
	var dirs := []
	for k in n: dirs.append(a0 + TAU * float(k) / float(n) + rng.randf_range(-0.28, 0.28))
	var lv := [[0.2, 0.3], [0.55, 0.68], [1.0, 1.0], [7.0, 3.0]]      # (how far down, how far out: of its height, of its half width)
	var rings := []
	for li in lv.size():
		var ring := []
		for k in n:
			var a: float = float(dirs[k]) + rng.randf_range(-0.06, 0.06) * float(li)
			var rr := w * 0.5 * float(lv[li][1]) * rng.randf_range(0.72, 1.22)
			var y := top.y - h * float(lv[li][0]) + (rng.randf_range(-0.07, 0.07) * h if li < lv.size() - 1 else 0.0)
			ring.append(Vector3(top.x + cos(a) * rr, y, top.z + sin(a) * rr))
		rings.append(ring)
	for k in n:
		var a: Vector3 = rings[0][k]; var c: Vector3 = rings[0][(k + 1) % n]
		var o := a + c - top * 2.0
		_iv_tri(st, top, a, c, Vector3(o.x, 0.3, o.z))
	for li in rings.size() - 1:
		for k in n:
			var a: Vector3 = rings[li][k]; var c: Vector3 = rings[li][(k + 1) % n]; var d: Vector3 = rings[li + 1][(k + 1) % n]; var e: Vector3 = rings[li + 1][k]
			var mid := (a + c + d + e) * 0.25
			_iv_quad(st, a, c, d, e, Vector3(mid.x - top.x, 0, mid.z - top.z))

## far off: snowy peaks in the haze under the moon, paler with distance, each going into the mist from a little under its top
func _ivm_far() -> void:
	var b := _ivp_basis(); var bx := b.x; var by := b.y; var fwd := -b.z
	var ce: Array = ivr_eye.centre
	var ref := IV_O + Vector3(float(ce[0]), float(ce[1]), float(ce[2]))
	var rng := RandomNumberGenerator.new(); rng.seed = 57
	var spot := func(sx: float, sy: float, dep: float) -> Vector3: return ref + bx * sx + by * sy + fwd * dep
	# [its summit on the screen (across, up, metres from the eye's middle), width, height, depth, haze, palette, how soon it fades]
	for f in [
			[3.7, 3.7, 7.0, 4.6, 26.0, 0.1, "far", 0.42],      # (the great peak at the right, under the moon)
			[-3.6, 4.4, 5.0, 3.8, 30.0, 0.2, "far", 0.42],      # (one behind the arch at the left)
			[1.0, 2.8, 5.0, 3.4, 30.0, 0.2, "far", 0.42],
			[6.2, 2.6, 4.4, 3.2, 23.0, 0.1, "far", 0.42],
			[-1.6, 1.8, 4.4, 2.8, 34.0, 0.3, "far1", 0.4],
			[2.6, 1.4, 5.0, 2.4, 20.0, 0.12, "far1", 0.45]]:
		var top: Vector3 = spot.call(float(f[0]), float(f[1]), float(f[4]))
		var h := float(f[3])
		var st := _iv_st(); _ivm_peak(st, top, float(f[2]), h, rng)
		_iv_commit(st, String(f[6]), self, float(f[5]), {"fog_hi": top.y - h * float(f[7]), "fog_lo": top.y - h * 1.1}, false)

## the snow falling before the eye: near flakes larger and slower, far ones small
func _ivm_snow(cl: CanvasLayer) -> void:
	var vs := get_viewport().get_visible_rect().size
	var k := vs.x / 720.0
	for layer in 2:
		var pt := CPUParticles2D.new(); cl.add_child(pt)
		pt.amount = 60 if layer == 0 else 45
		pt.lifetime = 22.0 if layer == 0 else 13.0
		pt.preprocess = pt.lifetime
		pt.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE; pt.emission_rect_extents = Vector2(vs.x * 0.65, 4.0)
		pt.position = Vector2(vs.x * 0.42, -14.0)
		pt.direction = Vector2(0.16, 1.0); pt.spread = 9.0; pt.gravity = Vector2.ZERO
		pt.initial_velocity_min = (52.0 if layer == 0 else 92.0) * k; pt.initial_velocity_max = (78.0 if layer == 0 else 130.0) * k
		pt.texture = load("res://goiv/glow.png")
		pt.scale_amount_min = (0.017 if layer == 0 else 0.026) * k; pt.scale_amount_max = (0.025 if layer == 0 else 0.038) * k
		pt.color = Color(1.0, 1.0, 1.0, 0.7 if layer == 0 else 0.9)

## the rock that bears a row of things far off: one ridge, its crest flat under the feet, its sides going down and out
## as a hill does (as the picture's: no table, no row of pillars), wider and wider into the haze
func _ivr_ridge_under(st: SurfaceTool, feet: Array, margin: float, rng: RandomNumberGenerator) -> void:
	var f0: Vector3 = feet[0]; var f1: Vector3 = feet[feet.size() - 1]
	var d := Vector3(f1.x - f0.x, 0, f1.z - f0.z)
	if d.length() < 0.01: d = Vector3(1, 0, 0)
	d = d.normalized(); var pp := Vector3(-d.z, 0, d.x)
	var y0 := f0.y - 0.01
	var m := margin + 0.12
	# the crest: about the line of feet, its ends rounded off in a few corners
	var crest := [f0 - d * m - pp * m, f0 - d * (m * 1.3), f0 - d * m + pp * m, f1 + d * m + pp * m, f1 + d * (m * 1.3), f1 + d * m - pp * m]
	var n := crest.size()
	var c := (f0 + f1) * 0.5
	var downs := [[0.0, 0.0], [0.25, 0.12], [0.9, 0.5], [2.6, 1.5], [34.0, 9.0]]      # (how far down, how far out)
	var rings := []
	for li in downs.size():
		var ring := []
		for k in n:
			var q: Vector3 = crest[k]
			var out := Vector3(q.x - c.x, 0, q.z - c.z).normalized()
			var g := float(downs[li][1]) * rng.randf_range(0.8, 1.25) if li > 0 else 0.0
			ring.append(Vector3(q.x, y0 - float(downs[li][0]) + (rng.randf_range(-0.08, 0.08) if li > 0 and li < downs.size() - 1 else 0.0), q.z) + out * g)
		rings.append(ring)
	for li in rings.size() - 1:
		for k in n:
			var a: Vector3 = rings[li][k]; var b: Vector3 = rings[li][(k + 1) % n]; var e: Vector3 = rings[li + 1][(k + 1) % n]; var f: Vector3 = rings[li + 1][k]
			var mid := (a + b + e + f) * 0.25
			_iv_quad(st, a, b, e, f, Vector3(mid.x - c.x, 0, mid.z - c.z))
	for k in n: _iv_tri(st, Vector3(c.x, y0, c.z), rings[0][k], rings[0][(k + 1) % n], Vector3.UP)

## the rock that bears things far off: a table of rock whose flat top holds every foot given, a little more round them
func _ivr_crag_under(st: SurfaceTool, feet: Array, margin: float, rng: RandomNumberGenerator) -> void:
	var c := Vector3.ZERO
	for f in feet: c += f as Vector3
	c /= float(feet.size())
	var r := 0.0
	for f in feet: r = maxf(r, Vector2((f as Vector3).x - c.x, (f as Vector3).z - c.z).length())
	_ivr_crag(st, Vector3(c.x, (feet[0] as Vector3).y - 0.01, c.z), (r + margin) * 2.0 / 0.82, rng, false, 1.0, true)

## a crag far off: a spire or a table of rock, its top cut aslant, its sides in a few broad facets, widening into the mist
func _ivr_crag(st: SurfaceTool, top: Vector3, w: float, rng: RandomNumberGenerator, sharp := false, top_k := 0.62, flat := false, tower := false) -> void:
	var n := 7 if tower else 6
	var hs := [0.0, w * 0.45, w * 1.4, w * 3.4, 34.0]
	var ks := [top_k, maxf(1.0, top_k * 1.08), 1.28 * maxf(1.0, top_k), 1.55 * maxf(1.0, top_k), 2.1 * maxf(1.0, top_k)]
	if tower:      # (as the picture's far rock: upright walls, a step out partway down, a top broken flat)
		var s1 := rng.randf_range(0.6, 1.1)
		hs = [0.0, w * 0.07, w * s1, w * (s1 + 0.08), w * (s1 + 1.5), 34.0]
		ks = [0.72, 1.0, 1.04, rng.randf_range(1.18, 1.34), 1.4, 1.75]
	var a0 := rng.randf_range(0.0, TAU)
	var jit := []
	for k in n: jit.append(Vector2(rng.randf_range(-0.22, 0.22), rng.randf_range(0.82, 1.12)))
	var tilt := Vector3(rng.randf_range(-1.0, 1.0), 0, rng.randf_range(-1.0, 1.0)).normalized()
	var rings := []
	for li in hs.size():
		var ring := []
		for k in n:
			var j: Vector2 = jit[k]
			var a := a0 + TAU * float(k) / float(n) + j.x + rng.randf_range(-0.07, 0.07) * float(li)
			var r := w * 0.5 * float(ks[li]) * j.y * rng.randf_range(0.93, 1.07)
			var y := top.y - float(hs[li])
			if li > 0 and li < hs.size() - 1: y += rng.randf_range(-0.1, 0.1) * w
			var p := Vector3(top.x + cos(a) * r, y, top.z + sin(a) * r)
			if li == 0 and not flat: p.y += (p - top).dot(tilt) * (0.55 if sharp else (0.2 if tower else 0.22))
			ring.append(p)
		rings.append(ring)
	for li in rings.size() - 1:
		for k in n:
			var a: Vector3 = rings[li][k]; var c: Vector3 = rings[li][(k + 1) % n]; var d: Vector3 = rings[li + 1][(k + 1) % n]; var e: Vector3 = rings[li + 1][k]
			var mid := (a + c + d + e) * 0.25
			_iv_quad(st, a, c, d, e, Vector3(mid.x - top.x, 0, mid.z - top.z))
	var apex := top + (Vector3(0, w * 0.45, 0) + tilt * w * 0.15 if sharp else Vector3(0, 0.0 if flat else w * 0.04, 0))
	for k in n: _iv_tri(st, apex, rings[0][k], rings[0][(k + 1) % n], Vector3.UP)

## a row of columns going away, as an eye with perspective sees it: the nearest one's foot at `near` (in the picture),
## the rest smaller and closer together toward the point `vp` on the horizon; a lintel over the first `lintel` of them
func _ivr_colonnade(st: SurfaceTool, spot_y: Callable, near: Vector2, vp: Vector2, y0: float, n: int, h: float, gap: float, lintel: int, rng: RandomNumberGenerator) -> Array:
	var shrink := 1.0 - gap / near.distance_to(vp)
	var tops := []
	var sc := 1.0
	for k in n:
		var f2: Vector2 = vp + (near - vp) * sc
		var p: Vector3 = spot_y.call(f2.x, f2.y, y0)
		var hh := h * sc; var r := h * 0.06 * sc
		var oct := []
		for m in 8: oct.append(Vector2(p.x + cos(TAU * float(m) / 8.0) * r, p.z + sin(TAU * float(m) / 8.0) * r))
		_iv_prism(st, oct, p.y + hh * 0.92, p.y + hh * 0.06, rng, 0.0, false)
		_iv_box(st, Vector3(p.x - r * 1.55, p.y + hh * 0.92, p.z - r * 1.55), Vector3(p.x + r * 1.55, p.y + hh, p.z + r * 1.55))
		_iv_box(st, Vector3(p.x - r * 1.45, p.y, p.z - r * 1.45), Vector3(p.x + r * 1.45, p.y + hh * 0.06, p.z + r * 1.45))
		tops.append([p + Vector3(0, hh, 0), sc, r])
		sc *= shrink
	# the lintel: a beam from top to top, as thick and as deep as the columns under it
	var bz := _ivp_basis().z; var fh := Vector3(bz.x, 0, bz.z).normalized()      # (across the beam: toward the eye)
	for k in mini(lintel, n) - 1:
		var a: Vector3 = tops[k][0]; var c: Vector3 = tops[k + 1][0]
		var ra: float = tops[k][2] * 1.7; var rc: float = tops[k + 1][2] * 1.7
		var ea := h * 0.1 * float(tops[k][1]); var ec := h * 0.1 * float(tops[k + 1][1])
		var dd := (c - a); dd.y = 0.0; dd = dd.normalized()
		a -= dd * ra * (1.0 if k == 0 else 0.0); c += dd * rc * (1.0 if k == mini(lintel, n) - 2 else 0.0)
		_iv_hexa(st, [a - fh * ra, c - fh * rc, c + fh * rc, a + fh * ra, a - fh * ra + Vector3(0, ea, 0), c - fh * rc + Vector3(0, ec, 0), c + fh * rc + Vector3(0, ec, 0), a + fh * ra + Vector3(0, ea, 0)])
	var feet := []
	for t in tops: feet.append((t[0] as Vector3) - Vector3(0, h * float(t[1]), 0))
	return feet

## the meander stone, cut as by hand (tools/ivory/block.py): its faces not quite flat, its edges eased, chips gone
func _ivr_block() -> Node3D:
	if not FileAccess.file_exists("res://goiv/block.glb"):
		var b0 := _ivp_block(iv_root)
		for m in b0.find_children("*", "MeshInstance3D", true, false): (m as MeshInstance3D).material_override = _ivr_mat("marble2", 0.0)
		return b0
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	doc.append_from_buffer(FileAccess.get_file_as_bytes("res://goiv/block.glb"), "", st)
	var n := Node3D.new(); iv_root.add_child(n)
	n.add_child(doc.generate_scene(st))
	for m in n.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _ivr_mat("marble2"); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return n

func _ivr_build() -> void:
	iv_root = Node3D.new(); iv_root.position = IV_O; add_child(iv_root)
	var j0 = JSON.parse_string(FileAccess.get_file_as_string(go_dir + "level.json"))
	if j0 is Dictionary and (j0 as Dictionary).get("sea_y") != null: ivr_sea_y = float(j0.sea_y)
	if (go_moon or go_quarry or go_wake) and OS.get_environment("IV_NO_BACKDROP") == "" and FileAccess.file_exists(go_dir + "backdrop.jpg"): iv_bgtex = load(go_dir + "backdrop.jpg")
	var bm := ShaderMaterial.new(); var bs := Shader.new(); bs.code = IV_BG_SH if iv_bgtex == null else IV_BGTEX_SH; bm.shader = bs
	_iv_sky(bm)
	if iv_bgtex != null: bm.set_shader_parameter("bg_tex", iv_bgtex); bm.set_shader_parameter("bg_scale", _iv_bg_scale()); bm.set_shader_parameter("uv_flip", iv_uvf)
	if go_drown: bm.set_shader_parameter("sun", Vector2(0.305, 0.19)); bm.set_shader_parameter("sun_k", 1.0)
	if go_moon and iv_bgtex == null: bm.set_shader_parameter("sun", IVM_MOON); bm.set_shader_parameter("moon_k", 1.0); bm.set_shader_parameter("moon_r", IVM_MOON_R)
	var bq := QuadMesh.new(); bq.size = Vector2(900, 900)
	var bgi := MeshInstance3D.new(); bgi.mesh = bq; bgi.material_override = bm; bgi.position = Vector3(0, 0, -140.0); bgi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; cam.add_child(bgi)
	# the level, as Blender made it
	var st := GLTFState.new(); var doc := GLTFDocument.new()
	doc.append_from_buffer(FileAccess.get_file_as_bytes(go_dir + "level.glb"), "", st)
	var lv := doc.generate_scene(st) as Node3D
	iv_root.add_child(lv)
	for m in lv.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var nm := String(mi.name).to_lower() + "|" + String(mi.get_parent().name).to_lower()
		var kind := "rock2" if nm.contains("rock") else ("olive2" if nm.contains("olive") else ("bark" if nm.contains("bark") else ("snow" if nm.contains("snow") else ("quarry" if nm.contains("quarry") else "marble2"))))
		mi.material_override = _ivr_mat(kind, 1.0, true); mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	if iv_at_sea:      # (the level's image in the still water: faint at dusk, clear at dawn)
		ivw_mirror = _ivs_mirror(lv, func(mi: MeshInstance3D) -> Array:
			var nm := String(mi.name).to_lower() + "|" + String(mi.get_parent().name).to_lower()
			var kd := "rock2" if nm.contains("rock") else "marble2"
			return [kd, 0.0, {"fog_hi": ivr_sea_y + (0.04 if go_wake else 1.5), "fog_lo": ivr_sea_y - 0.15, "veins": 0.6 if kd == "marble2" else 0.0, "haze": 1.0}])
	# its way
	var j: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(go_dir + "level.json"))
	if j.has("eye"): ivr_eye = j.eye
	if j.has("floors"): ivr_floors = j.floors
	ivr_groove = float(j.get("stair_groove", 0.0))
	ivr_sea_y = float(j.get("sea_y", -1.6)) if j.get("sea_y") != null else -1.6
	ivr_hz = float(j.get("horizon", 0.215)) if j.get("horizon") != null else 0.215
	ivr_shore = j.shore if (j.get("shore") is Dictionary and ResourceLoader.exists(go_dir + "shore.png")) else {}
	var V := func(a: Array) -> Vector3: return IV_O + Vector3(float(a[0]), float(a[1]), float(a[2]))
	ivg_on = _ivg_load()      # the trial played as Lara Croft GO is (goiv/puzzle.json); else the first trial's way
	var src: Dictionary = ivg if ivg_on else j
	ivp_nodes = {}
	for k in (src.nodes as Dictionary): ivp_nodes[k] = V.call(src.nodes[k])
	if j.has("flights"):
		for fl in (j.flights as Array):
			ivr_steps[_ivr_fkey(V.call(fl[0]), V.call(fl[1]))] = int(fl[3]) if (fl as Array).size() > 3 else 0
			if (fl as Array).size() > 4: ivr_stepl[_ivr_fkey(V.call(fl[0]), V.call(fl[1]))] = fl[4]
	ivp_edges = []
	for e in (src.edges as Array):
		var mids := []
		for p in (e[2] as Array): mids.append(V.call(p))
		ivp_edges.append([String(e[0]), String(e[1]), mids])
	if ivg_on:      # she comes up the first stair out of the mist to where the trial starts
		var it: Array = ivg.intro
		ivp_nodes["s"] = V.call(it[0]); ivp_edges.append(["s", String(ivg.start), [V.call(it[0]), V.call(it[1])]])
		ivg_vol = String(ivg.volute.node) if ivg.get("volute") != null else ""; ivg_exit = String(ivg.exit)
		ivg_gaps = ivg.get("gaps", []) as Array; ivg_fbreak = bool(ivg.get("faces_break", false))
		var gd: Dictionary = ivg.get("grid", {"E": [0, 0, -1], "S": [1, 0, 0], "W": [0, 0, 1], "N": [-1, 0, 0]})
		for gk in gd: ivg_dirv[gk] = Vector3(float(gd[gk][0]), float(gd[gk][1]), float(gd[gk][2]))
	_ivr_way()
	iv_me = "s"; iv_block = String(ivg.block) if ivg_on else "b0"
	iv_block_n = _ivr_block()
	if ivp_nodes.has(iv_block): iv_block_n.global_position = ivp_nodes[iv_block]
	else: iv_block_n.visible = false; iv_block_n.global_position = IV_O + Vector3(0, -60, 0)      # (a trial without the stone)
	if ivg_vol != "":
		if go_wake: _ivw_winch(ivp_nodes[ivg_vol])
		elif go_quarry: _ivq_capstan(ivp_nodes[ivg_vol])
		elif go_moon: _ivm_dial(ivp_nodes[ivg_vol])
		else: _ivp_volute(ivp_nodes[ivg_vol])
	elif not ivg_on and j.get("volute") != null: _ivp_volute(V.call(j.volute))
	if ivg_on: _ivg_build()
	if ivg_on and ivg.get("mirrors") != null:
		for mm in (ivg.mirrors as Array): _ivq_mirror(String(mm.node), int(mm.turn))
		_ivg_gaze_all()
	if j.get("relief") != null:
		var rs := _ivr_block(); rs.global_position = V.call(j.relief); rs.scale = Vector3.ONE * 0.42; rs.rotation = Vector3(0.12, 0.6, -0.08)
	# the fallen face: one of the thousand, on its cheek in the rock, looking up at the eye
	var hp := Node3D.new(); iv_root.add_child(hp); hp.global_position = V.call(j.head) if j.get("head") != null else IV_O + Vector3(0, -40, 0)
	hp.visible = j.get("head") != null
	var hd := prop_model("iv_head", hp, 2.8); hd.position = Vector3(0, -1.4, 0)
	for m in hd.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).material_override = _ivr_mat("phead", 0.0); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var fz := Vector3(0.52, 0.42, 0.74).normalized()      # where the face looks: to the eye, a little up
	var fy := (Vector3(-0.78, 0.55, -0.1) - fz * Vector3(-0.78, 0.55, -0.1).dot(fz)).normalized()      # where the crown points: to the upper left of the picture
	var fx := fy.cross(fz)
	var hax := OS.get_environment("IV_HAXIS") if OS.get_environment("IV_HAXIS") != "" else "-x"      # (the model's own face looks along its -x)
	match hax:
		"x": hp.basis = Basis(-fz, fy, fx)
		"-x": hp.basis = Basis(fz, fy, -fx)
		"-z": hp.basis = Basis(-fx, fy, -fz)
		_: hp.basis = Basis(fx, fy, fz)
	# the ring of light where the way ends
	iv_ring = Node3D.new(); iv_root.add_child(iv_ring); iv_ring.global_position = ivp_nodes[ivg_exit if ivg_on else "r"]
	var tm := TorusMesh.new(); tm.inner_radius = 0.3 if ivr_on else 0.36; tm.outer_radius = 0.46; tm.rings = 32; tm.ring_segments = 8
	var rm := _iv_prim(tm, Vector3(0, 0.06, 0), "ring", iv_ring); rm.scale = Vector3(1, 0.62, 1); rm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if ivr_on:
		var hm := CylinderMesh.new(); hm.top_radius = 0.31; hm.bottom_radius = 0.31; hm.height = 0.02; hm.radial_segments = 28; hm.rings = 1
		var hi := MeshInstance3D.new(); hi.mesh = hm; hi.material_override = _iv_mat("rock2", 0.0, {"fog_hi": -9.0, "fog_lo": -14.0}); hi.position = Vector3(0, 0.012, 0); iv_ring.add_child(hi)
	var gq := QuadMesh.new(); gq.size = Vector2(1.7, 1.7)
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.albedo_texture = load("res://goiv/glow.png")
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.blend_mode = BaseMaterial3D.BLEND_MODE_MIX if go_moon else BaseMaterial3D.BLEND_MODE_ADD; gm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; gm.albedo_color = Color(1.0, 0.76, 0.36, 0.42) if go_moon else Color(1.0, 0.96, 0.86, 0.5)      # (on the snow a glow added burns white: drawn over it, golden)
	iv_glow = MeshInstance3D.new(); iv_glow.mesh = gq; iv_glow.material_override = gm; iv_glow.position = Vector3(0, 0.4, 0); iv_glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_ring.add_child(iv_glow)
	if go_quarry: _ivq_decor()
	if go_moon:
		if iv_bgtex == null: _ivm_far()      # (the far peaks are in the painted backdrop when there is one)
		for bz in (j.get("braziers", []) as Array): _ivm_brazier(V.call(bz))
	if iv_at_sea or go_moon:
		if iv_at_sea: _ivs_sea(float(j.get("sea_y", -1.6)))
		if go_drown: _ivs_far()
		if go_wake: _ivw_scene(j)
		for ar in (j.get("arches", []) as Array):      # (a pale light standing in the arch over the ring: the way out)
			var pq := QuadMesh.new(); pq.size = Vector2(1.1, 2.0)
			var pmat := StandardMaterial3D.new(); pmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; pmat.albedo_texture = load("res://goiv/glow.png")
			pmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; pmat.blend_mode = BaseMaterial3D.BLEND_MODE_MIX if go_moon else BaseMaterial3D.BLEND_MODE_ADD; pmat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
			pmat.albedo_color = Color(1.0, 0.8, 0.46, 0.34) if go_moon else (Color(1.0, 0.9, 0.82, 0.36) if go_wake else Color(0.72, 0.88, 1.0, 0.42))
			var pg := MeshInstance3D.new(); pg.mesh = pq; pg.material_override = pmat; pg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			iv_root.add_child(pg); pg.global_position = V.call(ar[0]) + Vector3(0, 1.0, 0)
	else: _ivr_far()
	# before the eye: dark leaves at the top, dark rocks at the foot, the warm shade in the corners
	var k := get_viewport().get_visible_rect().size.x / 720.0
	var vh := get_viewport().get_visible_rect().size.y
	var cl := CanvasLayer.new(); cl.layer = 1; add_child(cl)
	var mg := Gradient.new(); mg.offsets = PackedFloat32Array([0.0, 0.58, 0.84, 1.0])
	var mc := Color("ddbf9d")
	mg.colors = PackedColorArray([Color(mc, 0.0), Color(mc, 0.0), Color(mc, 0.0), Color(mc, 0.0)])
	var mt := GradientTexture2D.new(); mt.gradient = mg; mt.fill_from = Vector2(0.5, 0.0); mt.fill_to = Vector2(0.5, 1.0); mt.width = 4; mt.height = 256
	var mr := TextureRect.new(); mr.texture = mt; mr.stretch_mode = TextureRect.STRETCH_SCALE; mr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mr.set_anchors_preset(Control.PRESET_FULL_RECT); mr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(mr)
	var vg := Gradient.new(); vg.offsets = PackedFloat32Array([0.0, 0.5, 0.82, 1.0])
	vg.colors = PackedColorArray([Color(0.3, 0.2, 0.12, 0), Color(0.3, 0.2, 0.12, 0), Color(0.3, 0.2, 0.12, 0.0), Color(0.3, 0.2, 0.12, 0.06)])      # (the picture's sky and mist are clear to the edges: only the very corners darken)
	var vt := GradientTexture2D.new(); vt.gradient = vg; vt.fill = GradientTexture2D.FILL_RADIAL; vt.fill_from = Vector2(0.5, 0.5); vt.fill_to = Vector2(1.15, 0.5); vt.width = 256; vt.height = 256
	var vr := TextureRect.new(); vr.texture = vt; vr.stretch_mode = TextureRect.STRETCH_SCALE; vr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	vr.set_anchors_preset(Control.PRESET_FULL_RECT); vr.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(vr)
	iv_leaves = _iv_overlay(cl, "res://goiv/leaves_tl.png", Vector2(-70, -90) * k, Vector2(470, 470) * k)
	var lr := _iv_overlay(cl, "res://goiv/leaves_tl.png", Vector2(720 * k + 60 * k, -150 * k), Vector2(440, 440) * k); lr.flip_h = true; lr.position.x -= 440 * k; lr.rotation = 0.18
	if go_wake:      # (the first dawn: the sky open above, nothing before the eye)
		iv_leaves.visible = false; lr.visible = false
		_ivw_hand_make(cl)
	elif go_drown:      # (at sea: the leaves above, cool in the dusk; no rocks before the eye, the mist is open)
		for ov in [iv_leaves, lr]: (ov as CanvasItem).modulate = Color(0.62, 0.66, 0.8)
	elif go_quarry:      # (the quarry: the leaves above at the left, warm; dust in the air; the pit open below)
		lr.visible = false; iv_leaves.modulate = Color(0.92, 0.86, 0.8)
		_ivq_dust(cl)
	elif go_moon:      # (in the snow at night: snowy pine above at the left, the snow falling; the mist open below)
		lr.visible = false
		if FileAccess.file_exists("res://gomoon/pine_tl.png"): iv_leaves.texture = load("res://gomoon/pine_tl.png")
		else: iv_leaves.modulate = Color(0.24, 0.29, 0.42)
		_ivm_snow(cl)
	else:
		_iv_overlay(cl, "res://goiv/rock_bl.png", Vector2(-80 * k, vh - 360 * k), Vector2(400, 400) * k)
		_iv_overlay(cl, "res://goiv/rock_br.png", Vector2(720 * k - 330 * k, vh - 330 * k), Vector2(400, 400) * k)
		_iv_overlay(cl, "res://goiv/rock_r.png", Vector2(720 * k - 150 * k, vh * 0.36), Vector2(170 * k, vh * 0.66))
	if OS.get_environment("IV_BG_ONLY") != "":      # (what lies behind the level alone: to be painted as its backdrop)
		iv_root.visible = false; cl.visible = false


# ---------------------------------------------------------------- Eidolon GO, ivory: the trial played as Lara Croft GO is
## tools/ivory/puzzle_design.py makes goiv/puzzle.json and proves it (the shortest way 20 swipes, no trap). Each swipe
## is one step of hers along the way; after it the walking statue takes one step. Faces of stone each watch one node:
## to end a step there is to be struck; to step onto a face from anywhere but before it breaks it. The faces strike
## the statue too. The stone is pushed one node straight on along a level way; the volute, turned from beside it,
## turns two of the faces on their stands. Struck or caught, the trial begins again. (The rules are the solver's own:
## keep the two the same.)
const IVG_PUSH_COS := 0.9
const IVG_BEHIND_COS := -0.9
var ivg_on := false
var ivg := {}
var ivg_v := 0      # the volute: 0 or 1
var ivg_faces := []      # {node, look: [watched in 0, watched in 1], alive, n: the face, gaze: [line, ring]}
var ivg_route := []
var ivg_wi := -1      # the statue: its place on its route (-1: broken), and which way along it it goes
var ivg_wd := 1
var ivg_w: Node3D
var ivg_vol := ""
var ivg_exit := ""

func _ivg_load() -> bool:
	if OS.get_environment("IV_OLD") != "" or not FileAccess.file_exists(go_dir + "puzzle.json"): return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(go_dir + "puzzle.json"))
	if d == null or not (d as Dictionary).has("nodes"): return false
	ivg = d
	return true

func _ivg_line() -> String:
	if ivg_on and ivg.has("lines"): return "\n".join(PackedStringArray(ivg.lines))
	return "He carved her a thousand faces.\nNone of them was hers."

func _ivg_build() -> void:
	var tog: Dictionary = {}
	if ivg.get("volute") != null and (ivg.volute as Dictionary).has("toggles"): tog = (ivg.volute.toggles as Dictionary).get("watchers", {})
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	gm.albedo_color = Color(0.72, 0.3, 0.2, 0.55); gm.cull_mode = BaseMaterial3D.CULL_DISABLED
	for w in (ivg.watchers as Array):
		var nd := String(w.node)
		var lk: Array = tog.get(nd, [String(w.get("facing", "")), String(w.get("facing", ""))])
		var f := {"node": nd, "look": [String(lk[0]), String(lk[1])], "alive": true, "line": bool(w.get("gaze", false))}
		if w.get("dirs") != null: f["dirs"] = [String(w.dirs[0]), String(w.dirs[1])]      # (it looks a way, not at a node: on along the board, bent by mirrors)
		# the face: a head of hers in stone on a low stand, turned to the node it watches
		var st := Node3D.new(); iv_root.add_child(st); st.global_position = ivp_nodes[nd]
		var ph := 0.08 if f.line else 0.16      # (a face that looks along a line: on a low plinth, which stays when it falls)
		var bx := BoxMesh.new(); bx.size = Vector3(0.5, ph, 0.5) if f.line else Vector3(0.44, 0.16, 0.44)
		var pl := MeshInstance3D.new(); pl.mesh = bx; pl.material_override = _ivr_mat("marble2", 0.0); pl.position = Vector3(0, ph * 0.5, 0); st.add_child(pl)
		var hn := Node3D.new(); st.add_child(hn); hn.position = Vector3(0, ph, 0)
		var hd := prop_model("iv_head", hn, 0.74 if f.line else 0.62)
		for m in hd.find_children("*", "MeshInstance3D", true, false):
			(m as MeshInstance3D).material_override = _ivr_mat("phead" if go_moon else "marble2", 0.0); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		f.n = st; f.head = hn
		# its gaze: a faint red line along the floor to the node it watches, and a ring on that node
		var lm := BoxMesh.new(); lm.size = Vector3(1.0, 0.004, 0.05)
		var ln := MeshInstance3D.new(); ln.mesh = lm; ln.material_override = gm; ln.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_root.add_child(ln)
		var tm := TorusMesh.new(); tm.inner_radius = 0.2; tm.outer_radius = 0.25; tm.rings = 24; tm.ring_segments = 4
		var rg := MeshInstance3D.new(); rg.mesh = tm; rg.material_override = gm; rg.scale = Vector3(1, 0.2, 1); rg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_root.add_child(rg)
		f.gaze = [ln, rg]
		if f.line:      # (a ring on every node its look strikes: as many as the longest look)
			for _r in 9:
				var r2 := MeshInstance3D.new(); r2.mesh = tm; r2.material_override = gm; r2.scale = Vector3(1, 0.2, 1); r2.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; iv_root.add_child(r2)
				(f.gaze as Array).append(r2)
		ivg_faces.append(f)
		_ivg_face_aim(f, 0.0)
	var wr: Array = ivg.get("wanderers", [])
	if not wr.is_empty():
		for k in (wr[0].route as Array): ivg_route.append(String(k))
		ivg_wi = 0; ivg_wd = 1
		ivg_w = Node3D.new(); iv_root.add_child(ivg_w)
		var sh := Node3D.new(); ivg_w.add_child(sh); sh.name = "body"
		var sm := prop_model("iv_colossus", sh, 1.3)
		for m in sm.find_children("*", "MeshInstance3D", true, false):
			(m as MeshInstance3D).material_override = _ivr_mat("guard" if go_moon else "marble2", 0.0); (m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		ivg_w.global_position = ivp_nodes[ivg_route[0]]
		_ivg_w_aim(0.0)

## which way a face looks just now, and what it watches
func _ivg_watched(f: Dictionary) -> String:
	if f.has("dirs"): return _ivg_look_next(String(f.node), ivg_dirv[String(f.dirs[ivg_v])])
	return String(f.look[ivg_v])
## the nodes a face's look strikes now: the one it looks at, and (a face that looks along a line) on straight along
## level ways until the stone or another face stands in the way (behind the stone is shade)
func _ivg_seen(f: Dictionary) -> Array:
	if f.has("dirs"): return _ivg_dlook(f).nodes
	var k := _ivg_watched(f)
	if not f.get("line", false): return [k]
	var out := []
	if k == iv_block or _ivg_face_on(k) >= 0: return out
	out.append(k)
	var a := String(f.node)
	for _i in 40:
		var c := _ivg_cont(a, k)
		if c == "" or c == iv_block or _ivg_face_on(c) >= 0: break
		out.append(c); a = k; k = c
	return out
func _ivg_looked_at(n: String) -> bool:
	for f in ivg_faces:
		if f.alive and _ivg_seen(f).has(n): return true
	return false
func _ivg_plinth(n: String) -> bool:      # a face's plinth there, the face on it standing or fallen
	for f in ivg_faces:
		if String(f.node) == n: return true
	return false
## a look along a line, drawn: a red line on the floor from the face to the end of its look, a ring on each node of it
func _ivg_gaze_draw(f: Dictionary) -> void:
	if f.has("dirs"): _ivg_dgaze_draw(f); return
	if not f.get("line", false): return
	var g: Array = f.gaze
	var sn := _ivg_seen(f) if f.alive else []
	var at: Vector3 = ivp_nodes[f.node]
	var ln: MeshInstance3D = g[0]
	ln.visible = not sn.is_empty()
	if not sn.is_empty():
		var lk: Vector3 = ivp_nodes[sn[sn.size() - 1]]
		var d := Vector3(lk.x - at.x, 0, lk.z - at.z); var L := d.length(); d = d.normalized()
		ln.global_position = at + d * (0.3 + (L - 0.3) * 0.5) + Vector3(0, 0.03, 0)
		ln.basis = Basis(d * maxf(L - 0.3, 0.01), Vector3.UP, d.cross(Vector3.UP))
	for i in range(1, g.size()):
		var rg: MeshInstance3D = g[i]
		rg.visible = i - 1 < sn.size()
		if rg.visible: rg.global_position = (ivp_nodes[sn[i - 1]] as Vector3) + Vector3(0, 0.04, 0)
func _ivg_gaze_all() -> void:
	for f in ivg_faces: _ivg_gaze_draw(f)
func _ivg_face_on(n: String) -> int:
	for i in ivg_faces.size():
		if ivg_faces[i].alive and ivg_faces[i].node == n: return i
	return -1
func _ivg_dir(a: String, b: String) -> Vector2:
	var pa: Vector3 = ivp_nodes[a]; var pb: Vector3 = ivp_nodes[b]
	return Vector2(pb.x - pa.x, pb.z - pa.z).normalized()
func _ivg_flat(a: String, b: String) -> bool:
	var e := _ivp_edge(a, b)
	return not e.is_empty() and (e[2] as Array).is_empty()
func _ivg_cont(a: String, k: String) -> String:      # the node straight on from k, coming from a, along level ways
	if not _ivg_flat(a, k): return ""
	var d := _ivg_dir(a, k)
	for c in _ivp_nbrs(k):
		if c != a and c != "s" and _ivg_flat(k, c) and d.dot(_ivg_dir(k, c)) >= IVG_PUSH_COS: return String(c)
	return ""
func _ivg_w_node() -> String: return String(ivg_route[ivg_wi]) if ivg_wi >= 0 else ""
func _ivg_w_front() -> String:
	var j := ivg_wi + ivg_wd
	return String(ivg_route[j]) if j >= 0 and j < ivg_route.size() else ""
func _ivg_w_behind(me: String) -> bool:
	var w := _ivg_w_node(); var f := _ivg_w_front()
	var fd := _ivg_dir(w, f) if f != "" else _ivg_dir(ivg_route[ivg_wi - ivg_wd], w)
	return fd.dot(_ivg_dir(w, me)) <= IVG_BEHIND_COS

func _ivg_face_aim(f: Dictionary, t := 0.6) -> void:
	if f.has("dirs"):
		var dd: Vector3 = ivg_dirv[String(f.dirs[ivg_v])]
		var hb := Basis(dd, Vector3.UP, dd.cross(Vector3.UP)); var hn0: Node3D = f.head
		if t <= 0.0: hn0.basis = hb
		else:
			var q0d := hn0.quaternion; var q1d := hb.get_rotation_quaternion()
			create_tween().tween_method(func(k: float) -> void: hn0.quaternion = q0d.slerp(q1d, k), 0.0, 1.0, t).set_trans(Tween.TRANS_SINE)
		_ivg_gaze_draw(f)
		return
	if f.get("line", false):
		var a0: Vector3 = ivp_nodes[f.node]; var l0: Vector3 = ivp_nodes[_ivg_watched(f)]
		var d0 := Vector3(l0.x - a0.x, 0, l0.z - a0.z).normalized()
		(f.head as Node3D).basis = Basis(d0, Vector3.UP, d0.cross(Vector3.UP))
		_ivg_gaze_draw(f)
		return
	var at: Vector3 = ivp_nodes[f.node]; var lk: Vector3 = ivp_nodes[_ivg_watched(f)]
	var d := Vector3(lk.x - at.x, 0, lk.z - at.z).normalized()
	var b := Basis(d, Vector3.UP, d.cross(Vector3.UP))
	var hn: Node3D = f.head
	var ln: MeshInstance3D = f.gaze[0]; var rg: MeshInstance3D = f.gaze[1]
	var L := Vector2(lk.x - at.x, lk.z - at.z).length() - 0.3
	var mid := at + d * (0.15 + L * 0.5) + Vector3(0, 0.03, 0)
	if t <= 0.0:
		hn.basis = b; ln.global_position = mid; ln.basis = Basis(d * L, Vector3.UP, d.cross(Vector3.UP)); rg.global_position = lk + Vector3(0, 0.04, 0)
		return
	var q0 := hn.quaternion; var q1 := b.get_rotation_quaternion()
	var tw0 := create_tween().set_parallel()
	tw0.tween_method(func(k: float) -> void: hn.quaternion = q0.slerp(q1, k), 0.0, 1.0, t).set_trans(Tween.TRANS_SINE)
	tw0.tween_property(ln, "global_position", mid, t); tw0.tween_property(ln, "basis", Basis(d * L, Vector3.UP, d.cross(Vector3.UP)), t)
	tw0.tween_property(rg, "global_position", lk + Vector3(0, 0.04, 0), t)

func _ivg_w_aim(t := 0.4) -> void:
	if ivg_wi < 0 or ivg_w == null: return
	var w := _ivg_w_node(); var f := _ivg_w_front()
	var d2 := _ivg_dir(w, f) if f != "" else _ivg_dir(ivg_route[ivg_wi - ivg_wd], w)
	var yw := atan2(d2.x, d2.y) + (float(OS.get_environment("IV_WYAW")) if OS.get_environment("IV_WYAW") != "" else 0.0)
	var body := ivg_w.get_node("body") as Node3D
	if t <= 0.0: body.rotation.y = yw; return
	var cur := body.rotation.y; var dy := wrapf(yw - cur, -PI, PI)
	create_tween().tween_property(body, "rotation:y", cur + dy, t).set_trans(Tween.TRANS_SINE)

## one turn: she acts along the way to nb; then the statue takes its step
func _ivg_turn(nb: String) -> void:
	if iv_busy or iv_won: return
	var me := iv_me
	var wn := _ivg_w_node()
	if OS.get_environment("IV_TRACE") != "": print("IV turn ", me, " -> ", nb, "  block ", iv_block, " volute ", ivg_v, " statue ", wn)
	if ivg_mir.has(nb):      # she turns a bronze mirror: the looks that reach it go on the other way
		iv_moves += 1
		await _ivq_mirror_turn(nb)
		await _ivg_settle()
		if _ivg_looked_at(me): await _ivg_fail("struck", me); return
		if wn != "" and _ivg_looked_at(wn): await _ivg_w_break()
		await _ivg_w_step()
		return
	if nb == ivg_vol:      # she turns the volute: the faces on their stands turn with it
		if ivg_v == 1 and bool((ivg.volute as Dictionary).get("once", false)): await _her_no(); return      # (it has done its work: it turns no more)
		iv_moves += 1
		await _ivg_turn_volute()
		await _ivg_settle()
		if _ivg_looked_at(me): await _ivg_fail("struck", me); return
		if wn != "" and _ivg_looked_at(wn): await _ivg_w_break()
	else:
		if nb == iv_block:      # the stone goes on before her, one node straight on
			var c := _ivg_cont(me, nb)
			if c == "" or c == ivg_vol or _ivg_face_on(c) >= 0 or c == wn: await _her_no(); return
			if bool(ivg.get("plinths", false)) and (_ivg_plinth(c) or c == ivg_exit): await _her_no(); return
			iv_moves += 1
			await _ivg_push(nb, c)
			_ivg_gaze_all()
		else:
			var fi := _ivg_face_on(nb)
			if fi >= 0:      # onto a face: from before it she is struck; from anywhere else it falls
				if _ivg_watched(ivg_faces[fi]) == me: await _ivg_fail("struck", me, fi); return
				iv_moves += 1
				_ivg_face_break(fi)
				await _ivp_walk([nb])
			elif nb == wn:      # onto the statue: from behind it breaks; from before it, it takes her; from the side, no
				if _ivg_w_front() == me: await _ivg_fail("caught", me); return
				if not _ivg_w_behind(me): await _her_no(); return
				iv_moves += 1
				await _ivg_w_break()
				await _ivp_walk([nb])
			else:
				iv_moves += 1
				await _ivp_walk([nb])
		if iv_won: return
		await _ivg_settle()
		if _ivg_looked_at(iv_me): await _ivg_fail("struck", iv_me); return
	await _ivg_w_step()

## the statue's step along its route, or its turning back where the way is held
func _ivg_w_step() -> void:
	if ivg_wi < 0: return
	var j := ivg_wi + ivg_wd
	var nx: String = ivg_route[j] if j >= 0 and j < ivg_route.size() else ""
	if nx == "" or nx == iv_block or _ivg_face_on(nx) >= 0 or nx == ivg_vol:
		if ivg_wi - ivg_wd >= 0 and ivg_wi - ivg_wd < ivg_route.size():
			ivg_wd = -ivg_wd; _ivg_w_aim(0.45); await wait(0.45)
		return
	var fr := _ivg_w_node()
	ivg_wi = j
	iv_busy = true
	var e := _ivp_edge(fr, nx); var pts: Array = (e[2] as Array).duplicate() if not e.is_empty() else []
	if not e.is_empty() and e[0] != fr: pts.reverse()
	pts.append(ivp_nodes[nx])
	_ivg_w_aim(0.25)
	for p in pts:
		var q: Vector3 = p
		var dd := ivg_w.global_position.distance_to(q)
		var mv := create_tween(); mv.tween_property(ivg_w, "global_position", q, maxf(0.15, dd / 1.15)); await mv.finished
	iv_busy = false
	if nx == iv_me: await _ivg_fail("caught", iv_me); return
	if ivg_wi == 0 or ivg_wi == ivg_route.size() - 1: ivg_wd = -ivg_wd
	_ivg_w_aim(0.45)
	if _ivg_looked_at(nx): await _ivg_w_break()

func _ivg_push(nb: String, c: String) -> void:
	iv_busy = true
	var kp: Vector3 = ivp_nodes[nb]; var qp: Vector3 = ivp_nodes[c]
	var dv := Vector3(qp.x - kp.x, 0, qp.z - kp.z).normalized()
	iv_push = {"d": dv, "start": pos, "m0": kp, "len": Vector2(qp.x - kp.x, qp.z - kp.z).length()}
	print("IV push ", nb, " -> ", c)
	route.clear(); speed_cap = 1.0; face_to = null
	route.append({"p": kp})
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.3); up.tween_property(self, "a_wR", 1.0, 0.3); up.tween_property(self, "a_lean", 0.16, 0.3)
	while not route.is_empty(): await get_tree().process_frame
	iv_push = {}
	var sl := create_tween(); sl.tween_property(iv_block_n, "global_position", qp, 0.18); await sl.finished
	iv_me = nb; iv_block = c; ivp_wp_cur = kp
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.35); dn.tween_property(self, "a_wR", 0.0, 0.35); dn.tween_property(self, "a_lean", 0.0, 0.35)
	await dn.finished
	iv_busy = false

func _ivg_turn_volute() -> void:
	iv_busy = true
	var wp: Vector3 = iv_wheel.global_position
	face_to = wp
	var n := 0
	while face_to != null and n < 90: await get_tree().process_frame; n += 1
	var to_her := Vector3(pos.x - wp.x, 0, pos.z - wp.z).normalized()
	var fr := wp + to_her * 0.36
	tgtL = fr + Vector3(0, 0.2, 0) + to_her.cross(Vector3.UP) * 0.12; tgtR = fr + Vector3(0, -0.05, 0) - to_her.cross(Vector3.UP) * 0.12
	var up := tw(); up.set_parallel(); up.tween_property(self, "a_wL", 1.0, 0.3); up.tween_property(self, "a_wR", 1.0, 0.3); up.tween_property(self, "a_lean", 0.18, 0.3)
	await up.finished
	ivg_v ^= 1
	print("IV the volute turns: ", ivg_v)
	var sp := create_tween(); sp.tween_property(iv_wheel, "rotation:z", iv_wheel.rotation.z - (TAU if go_wake else PI), 1.6 if go_wake else 1.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	for f in ivg_faces:
		if f.alive: _ivg_face_aim(f, 1.0)
	if go_wake: await _ivw_raise(ivg_v == 1)      # (the chains draw the stones up out of the water)
	if sp.is_running(): await sp.finished      # (a tween already done sends no signal again)
	var dn := tw(); dn.set_parallel(); dn.tween_property(self, "a_wL", 0.0, 0.35); dn.tween_property(self, "a_wR", 0.0, 0.35); dn.tween_property(self, "a_lean", 0.0, 0.35)
	await dn.finished
	iv_busy = false

## a face broken: it falls from its stand and is gone
func _ivg_face_break(i: int) -> void:
	var f: Dictionary = ivg_faces[i]
	f.alive = false
	print("IV a face breaks at ", f.node)
	var st: Node3D = f.n
	for g in (f.gaze as Array): (g as Node3D).visible = false
	for g in (f.get("segs", []) as Array): (g as Node3D).visible = false
	var hn: Node3D = f.head
	var k := create_tween().set_parallel()
	k.tween_property(hn, "rotation:z", hn.rotation.z + 1.4, 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	if f.get("line", false):      # (its head falls and is gone; the plinth stays)
		k.tween_property(hn, "scale", Vector3(0.01, 0.01, 0.01), 0.5).set_delay(0.25).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		k.tween_callback(func() -> void: hn.visible = false).set_delay(0.76)
		_ivg_gaze_all()
		return
	k.tween_property(st, "scale", Vector3(0.01, 0.01, 0.01), 0.5).set_delay(0.25).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	k.tween_callback(func() -> void: st.visible = false).set_delay(0.76)

## the statue broken
func _ivg_w_break() -> void:
	if ivg_wi < 0: return
	ivg_wi = -1
	print("IV the statue breaks")
	var body := ivg_w.get_node("body") as Node3D
	var k := create_tween().set_parallel()
	k.tween_property(body, "rotation:x", 0.5, 0.35).set_trans(Tween.TRANS_QUAD)
	k.tween_property(ivg_w, "scale", Vector3(0.01, 0.01, 0.01), 0.55).set_delay(0.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	await k.finished
	ivg_w.visible = false

## struck or caught: the light goes, and the trial begins again
func _ivg_fail(why: String, at: String, fi := -1) -> void:
	iv_busy = true
	print("IV ", why, " at ", at)
	if fi >= 0:      # the face strikes: it leans at her
		var hn: Node3D = ivg_faces[fi].head
		var p0 := hn.position
		var lk: Vector3 = ivp_nodes[_ivg_watched(ivg_faces[fi])] - (ivp_nodes[ivg_faces[fi].node] as Vector3)
		var lu := create_tween(); lu.tween_property(hn, "position", p0 + Vector3(lk.x, 0, lk.z).normalized() * 0.25, 0.15); lu.tween_property(hn, "position", p0, 0.3)
	var f := create_tween(); f.tween_property(iv_fade, "color:a", 1.0, 0.8).set_delay(0.3); await f.finished
	_ivg_reset()
	await wait(0.4)
	var g := create_tween(); g.tween_property(iv_fade, "color:a", 0.0, 0.8); await g.finished
	iv_busy = false

func _ivg_reset() -> void:
	route.clear(); iv_push = {}
	iv_me = String(ivg.start); pos = ivp_nodes[iv_me]; ivp_wp_cur = pos; ivp_wp_prev = pos
	iv_block = String(ivg.block)
	if ivp_nodes.has(iv_block): iv_block_n.global_position = ivp_nodes[iv_block]
	ivg_v = 0
	if iv_wheel != null: iv_wheel.rotation.z = 0.0
	for mk in ivg_mir:      # (the mirrors as they were)
		ivg_mir[mk].turn = int(ivg_mir[mk].turn0); _ivq_mirror_pose(String(mk), 0.0)
	for f in ivg_faces:
		f.alive = true; (f.n as Node3D).visible = true; (f.n as Node3D).scale = Vector3.ONE; (f.head as Node3D).rotation = Vector3.ZERO
		(f.head as Node3D).scale = Vector3.ONE; (f.head as Node3D).visible = true
		for g in (f.gaze as Array): (g as Node3D).visible = true
		for g in (f.get("segs", []) as Array): (g as Node3D).visible = true
		_ivg_face_aim(f, 0.0)
	if not ivg_route.is_empty():
		ivg_wi = 0; ivg_wd = 1; ivg_w.visible = true; ivg_w.scale = Vector3.ONE; (ivg_w.get_node("body") as Node3D).rotation = Vector3.ZERO
		ivg_w.global_position = ivp_nodes[ivg_route[0]]; _ivg_w_aim(0.0)
	iv_moves = 0

# ---------------------------------------------------------------- the face in the water (a trial)
## Three courts by themselves in the sea, one after another. In each a medallion of square stones stands on two posts
## over a still water, leaning so that, from where the eye is, its face is turned away: in the world one sees the
## edges of the stones; in the water their undersides, and on them a picture. A tap on a stone's picture in the water
## (or, where its top can be seen, on the stone) turns it a quarter round. When the picture in the water is whole the
## water is still and the gate to the south opens.
## 1: her face (four stones). 2: her walk to the sea (three stones, chained by bronze wheels: a stone turns its
## neighbours too). 3: her with the mirror (nine stones, the middle one fixed); on top the sculptor cut his own seal,
## whole as the stones are found: to make hers, his must be broken.
const FG_X0 := 33.0
const FG_X1 := 45.0
const FG_GX := 39.0
const FG_TH := 0.08      # the thickness of a stone
var fg_lay := []      # the courts: their measures (`_fig_layout`), and once built their things and their state
var fg_taps := 0
var fg_wait := 0.0
var fg_look_t := 0.0
var fg_tw := {}      # the tween that turns each stone just now

func _fig_specs() -> Array:
	return [
		{"nx": 2, "nz": 2, "s": 1.5, "tilt": 31.0, "pic": "face", "top": "", "start": [1, 0, 3, 2], "off": [0, 0, 0, 0], "links": {}, "fixed": [],
			"lines": ["He carved her face where no one would look.", "Under the stone. Only the water sees it."]},
		{"nx": 3, "nz": 1, "s": 1.3, "tilt": 31.0, "pic": "frieze", "top": "", "start": [1, 0, 1], "off": [0, 0, 0], "links": {0: [1], 1: [0, 2], 2: [1]}, "fixed": [],
			"lines": ["Some stones he chained together,", "so that mending one would break the next."]},
		{"nx": 3, "nz": 3, "s": 1.15, "tilt": 14.0, "pic": "mirror", "top": "seal", "start": [0, 0, 0, 0, 0, 0, 0, 0, 0], "off": [1, 3, 2, 2, 0, 1, 3, 1, 2], "links": {}, "fixed": [4],
			"lines": ["On top he cut his own seal.", "Hers he hid underneath."]},
	]

## the measures of the three courts. The medallion's frame: X to the right of the picture (the right of the view), T
## the face of its top, Z down the picture. Its lowest edge stands half a metre over the water. Its image in the water
## is seen where the ground point (x + y, z + y) of each of its points is: the pool is made to hold all of that.
func _fig_layout() -> Array:
	if not fg_lay.is_empty(): return fg_lay
	var z0 := 0.0
	for sp in _fig_specs():
		var phi := deg_to_rad(float(sp.tilt))
		var X := Vector3(1, 0, -1).normalized()
		var T := Vector3(-sin(phi) / sqrt(2.0), cos(phi), -sin(phi) / sqrt(2.0))
		var Z := X.cross(T)
		var g := 0.05; var s: float = sp.s
		var W := (int(sp.nx) * s + (int(sp.nx) - 1) * g) * 0.5; var D := (int(sp.nz) * s + (int(sp.nz) - 1) * g) * 0.5
		var hc := 0.5 + D * sin(phi)
		var pts := []
		for u in [-W, W]:
			for v in [-D, D]:
				var c := Vector3(0, hc, 0) + X * float(u) + Z * float(v)
				pts.append(Vector2(c.x + c.y, c.z + c.y))
		var mir_c := Vector2.ZERO
		for q in pts: mir_c += (q as Vector2) / 4.0
		for u in [-(W - 0.25), W - 0.25]:
			var c2 := Vector3(0, hc, 0) + X * float(u) - Z * D
			pts.append(Vector2(c2.x, c2.z))
		var lo := Vector2(1e9, 1e9); var hi := Vector2(-1e9, -1e9)
		for q in pts: lo = Vector2(minf(lo.x, q.x), minf(lo.y, q.y)); hi = Vector2(maxf(hi.x, q.x), maxf(hi.y, q.y))
		lo -= Vector2(0.45, 0.45); hi += Vector2(0.45, 0.45)
		var off := Vector2(FG_GX - (lo.x + hi.x) * 0.5, z0 + 2.8 - lo.y)      # where the medallion's middle goes, over the ground
		var pool := [lo.x + off.x, lo.y + off.y, hi.x + off.x, hi.y + off.y]
		var z1: float = float(pool[3]) + 2.6
		var C := Vector3(off.x, hc, off.y)
		var view := Vector2(C.x - hc, C.z - hc).lerp(mir_c + off, 0.62)
		fg_lay.append({"spec": sp, "X": X, "T": T, "Z": Z, "W": W, "D": D, "g": g, "hc": hc, "C": C, "pool": pool, "court": [FG_X0, z0, FG_X1, z1],
			"view": Vector3(view.x, 0, view.y), "top_k": (cos(phi) - sqrt(2.0) * sin(phi)) / sqrt(3.0), "k": (sp.start as Array).duplicate(), "solved": false})
		z0 = z1 + 2.2
	return fg_lay

func _fig_hollows() -> Array:
	var out := []
	for L in _fig_layout(): out.append([float(L.court[0]) + 0.3, float(L.court[1]) + 0.5, float(L.court[2]) - 0.3, float(L.court[3]) - 0.5])
	return out

## a face of a stone, `y` over (or under) its middle, its picture taken from the medallion's picture as the stone lies
## when it is turned `off` quarters round
func _fig_quad(s: float, y: float, lc: Vector3, off: int, W: float, D: float, mat: Material) -> MeshInstance3D:
	var rb := Basis(Vector3.UP, -float(off) * PI * 0.5)
	var vs := PackedVector3Array(); var uvs := PackedVector2Array(); var ns := PackedVector3Array()
	var h := s * 0.5 - 0.01
	for q in [Vector2(-h, -h), Vector2(h, -h), Vector2(h, h), Vector2(-h, -h), Vector2(h, h), Vector2(-h, h)]:
		vs.append(Vector3(q.x, y, q.y)); ns.append(Vector3(0, signf(y), 0))
		var m := lc + rb * Vector3(q.x, 0, q.y)
		uvs.append(Vector2((m.x + W) / (2.0 * W), (m.z + D) / (2.0 * D)))
	var arr := []; arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = vs; arr[Mesh.ARRAY_TEX_UV] = uvs; arr[Mesh.ARRAY_NORMAL] = ns
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new(); mi.mesh = am; mi.material_override = mat; mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

func _fig_mat(tx: Texture2D, c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.albedo_color = c
	if tx != null: m.albedo_texture = tx; m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m

func _fig_build() -> void:
	var lay := _fig_layout()
	for ri in lay.size():
		var L: Dictionary = lay[ri]; var sp: Dictionary = L.spec
		var c: Array = L.court; var p: Array = L.pool
		var x0: float = c[0]; var z0: float = c[1]; var x1: float = c[2]; var z1: float = c[3]
		_pool_court(x0, z0, x1, z1, p[0], p[1], p[2], p[3], "stone", "PoolSkyF%d" % ri)
		tile_hole = Rect2(p[0] - 0.08, p[1] - 0.08, p[2] - p[0] + 0.16, p[3] - p[1] + 0.16); tiles(x0, z0, x1, z1, 1.0); tile_hole = Rect2()
		var gm := glass(p[0], p[1], p[2], p[3], 0.35)
		gm.set_shader_parameter("wave", 0.3); gm.set_shader_parameter("clear", 0.55)
		L["glass"] = gm
		# its low walls: open to the north where one comes in (but in the first), a gate to the south
		if ri == 0: parapet(Vector3(x0 + 0.1, 0, z0 + 0.1), Vector3(x1 - 0.1, 0, z0 + 0.1))
		else:
			parapet(Vector3(x0 + 0.1, 0, z0 + 0.1), Vector3(FG_GX - 0.7, 0, z0 + 0.1)); parapet(Vector3(FG_GX + 0.7, 0, z0 + 0.1), Vector3(x1 - 0.1, 0, z0 + 0.1))
		parapet(Vector3(x0 + 0.1, 0, z0 + 0.1), Vector3(x0 + 0.1, 0, z1 - 0.1)); parapet(Vector3(x1 - 0.1, 0, z0 + 0.1), Vector3(x1 - 0.1, 0, z1 - 0.1))
		parapet(Vector3(x0 + 0.1, 0, z1 - 0.1), Vector3(FG_GX - 0.7, 0, z1 - 0.1)); parapet(Vector3(FG_GX + 0.7, 0, z1 - 0.1), Vector3(x1 - 0.1, 0, z1 - 0.1))
		for e in [-1.0, 1.0]: blk(Vector3(FG_GX + e * 0.7 - 0.09, 0, z1 - 0.22), Vector3(FG_GX + e * 0.7 + 0.09, 2.0, z1 - 0.04), "stone")
		leaf("fgx%d" % ri, Vector3(FG_GX, 0, z1 - 0.13), false, 0.61, 1.75)
		var zn: float = (float(lay[ri + 1].court[1])) if ri + 1 < lay.size() else z1 + 3.4
		blk(Vector3(FG_GX - 0.7, -0.18, z1), Vector3(FG_GX + 0.7, 0.0, zn), "stone")      # the landing to the next
		cypress(Vector3(x0 + 0.95, 0, z0 + 0.95)); cypress(Vector3(x1 - 0.95, 0, z0 + 0.95)); urn(Vector3(x0 + 0.9, 0, z1 - 0.9)); urn(Vector3(x1 - 0.9, 0, z1 - 0.9))
		# the medallion
		var tex: Texture2D = load("res://figure/%s.jpg" % String(sp.pic))
		var picm := _fig_mat(tex, Color(0.9, 0.9, 0.9)); L["mats"] = [picm]
		var topm := _fig_mat(load("res://figure/%s.jpg" % String(sp.top)) if String(sp.top) != "" else null, Color(0.88, 0.85, 0.82) if String(sp.top) != "" else Color("d9c8ae"))
		var nx: int = sp.nx; var nz: int = sp.nz; var s: float = sp.s; var g: float = L.g; var W: float = L.W; var D: float = L.D
		var X: Vector3 = L.X; var Z: Vector3 = L.Z; var C: Vector3 = L.C
		L["tiles"] = []; L["tiles_m"] = []; L["gears"] = {}
		for both in [self, mroot]:
			var twin: bool = both == mroot
			var gold: Material = under_mat(Color("c98f2c")) if twin else pal("gold")
			var stone: Material = under_mat(Color("857fa4")) if twin else pal("stone")
			var med := Node3D.new(); med.transform = Transform3D(Basis(X, L.T, Z), C); both.add_child(med)
			for u in [-(W - 0.25), W - 0.25]:      # its two posts, under its far edge
				var tp := C + X * float(u) - Z * D
				cyl(Vector3(tp.x, -0.4, tp.z), 0.09, 0.11, tp.y + 0.4 - 0.03, stone, 12, both)
			for e in [-1.0, 1.0]:      # its bronze frame
				blk(Vector3(-W - 0.07, -0.05, e * (D + 0.04) - 0.035), Vector3(W + 0.07, 0.05, e * (D + 0.04) + 0.035), "gold", med).material_override = gold
				blk(Vector3(e * (W + 0.04) - 0.035, -0.05, -D - 0.07), Vector3(e * (W + 0.04) + 0.035, 0.05, D + 0.07), "gold", med).material_override = gold
			for i in nx * nz:
				var lc := Vector3(-W + s * 0.5 + (i % nx) * (s + g), 0, -D + s * 0.5 + (i / nx) * (s + g))
				var tn := Node3D.new(); tn.position = lc; med.add_child(tn)
				blk(Vector3(-s * 0.5 + 0.01, -FG_TH * 0.5, -s * 0.5 + 0.01), Vector3(s * 0.5 - 0.01, FG_TH * 0.5, s * 0.5 - 0.01), "stone", tn).material_override = stone
				tn.add_child(_fig_quad(s, FG_TH * 0.5 + 0.003, lc, 0, W, D, topm))
				tn.add_child(_fig_quad(s, -(FG_TH * 0.5 + 0.003), lc, int(sp.off[i]), W, D, picm))
				tn.rotation.y = -float(sp.start[i]) * PI * 0.5
				(L["tiles_m" if twin else "tiles"] as Array).append(tn)
				if i in (sp.fixed as Array):      # a stone that does not turn: four bronze studs
					for q in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
						for fy in [-1.0, 1.0]: cyl(lc + Vector3(q.x * (s * 0.5 - 0.1), fy * FG_TH * 0.5 - 0.03, q.y * (s * 0.5 - 0.1)), 0.045, 0.045, 0.06, gold, 8, med)
			for a in (sp.links as Dictionary):      # the bronze wheels that chain two stones, on the lower edge of the frame
				for b in sp.links[a]:
					if int(b) <= int(a): continue
					var gx := -W + s * 0.5 + (int(a) % nx + 0.5) * (s + g)
					var gn := Node3D.new(); gn.position = Vector3(gx, 0, D + 0.24); med.add_child(gn)
					cyl(Vector3(0, -0.06, 0), 0.19, 0.19, 0.12, gold, 16, gn)
					for ti in 8:
						var tq := blk(Vector3(-0.035, -0.06, 0.17), Vector3(0.035, 0.06, 0.25), "gold", gn); tq.material_override = gold
						var hold := Node3D.new(); gn.add_child(hold); hold.rotation.y = TAU * ti / 8.0; tq.reparent(hold, false)
					var key := "%d-%d" % [a, b]
					if not (L.gears as Dictionary).has(key): L.gears[key] = []
					(L.gears[key] as Array).append(gn)
		# floor
		rects["Fn%d" % ri] = R(x0 + 0.5, z0 + 0.6, x1 - 0.5, float(p[1]) - 0.3)
		rects["Fw%d" % ri] = R(x0 + 0.5, z0 + 0.6, float(p[0]) - 0.3, z1 - 0.5)
		rects["Fe%d" % ri] = R(float(p[2]) + 0.3, z0 + 0.6, x1 - 0.5, z1 - 0.5)
		rects["Fs%d" % ri] = R(x0 + 0.5, float(p[3]) + 0.3, x1 - 0.5, z1 - 0.5)
		rects["Fg%d" % ri] = R(FG_GX - 0.3, z1 - 0.7, FG_GX + 0.3, z1 + 0.3, false)
		rects["Fl%d" % ri] = R(FG_GX - 0.4, z1 - 0.1, FG_GX + 0.4, zn + 0.9)
		stele("fg_st%d" % ri, Vector3(FG_GX - 1.6, 0, z0 + 1.3), 0.0, sp.lines)

## (the trial begins in the first court, with her awake)
func _fig_begin() -> void:
	_wake_now()
	var L: Dictionary = _fig_layout()[0]
	pos = Vector3(FG_GX - 1.6, 0, float(L.court[1]) + 1.3); yaw = 0.0; cam_t = L.view
	cam_focus = L.view; cam_focus_on = true

## the court she is in
func _fig_room() -> int:
	var lay := _fig_layout(); var ri := 0
	for i in lay.size():
		if pos.z > float(lay[i].court[1]) - 0.4: ri = i
	return ri

func _fig_frame(dt: float) -> void:
	var lay := _fig_layout()
	cam_focus = lay[_fig_room()].view; cam_focus_on = true
	if fg_look_t > 0.0:
		fg_look_t -= dt
		if fg_look_t <= 0.0: look_at_pt = null
	if started and woke and fg_taps == 0 and not ended:
		fg_wait += dt
		if fg_wait > 10.0 and not flags.get("fg_hint", false): flags["fg_hint"] = true; say("tap a stone's picture in the water: it turns")
	var last: Dictionary = lay[lay.size() - 1]
	if not ended and bool(last.solved) and pos.z > float(last.court[3]) + 1.6: route.clear(); _end()

## a tap: on a stone's picture in the water (or on a stone whose top can be seen) it turns; anywhere else she walks there
func _fig_tap(sp: Vector2) -> void:
	var lay := _fig_layout()
	var best := Vector2i(-1, -1); var bd := 1e9
	for ri in lay.size():
		var L: Dictionary = lay[ri]
		if bool(L.solved): continue
		var s: float = L.spec.s
		for i in (L.tiles as Array).size():
			var b: Vector3 = (L.tiles_m[i] as Node3D).global_position
			var r := cam.unproject_position(b).distance_to(cam.unproject_position(b + (L.X as Vector3) * s * 0.5))      # half a stone, on the screen
			var d := cam.unproject_position(b).distance_to(sp) / r
			if float(L.top_k) > 0.2:      # (its top can be seen)
				var a: Vector3 = (L.tiles[i] as Node3D).global_position
				d = minf(d, cam.unproject_position(a).distance_to(sp) / r / 0.8)
			if d < 1.25 and d < bd: bd = d; best = Vector2i(ri, i)
	if best.x >= 0:
		hold_id = -1
		if best.y in (lay[best.x].spec.fixed as Array):      # it does not turn: it knocks
			var tn: Node3D = lay[best.x].tiles[best.y]; var tm: Node3D = lay[best.x].tiles_m[best.y]
			for n in [tn, tm]:
				var q := create_tween(); q.tween_property(n, "rotation:y", n.rotation.y - 0.08, 0.08); q.tween_property(n, "rotation:y", n.rotation.y, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			return
		_fig_turn(best.x, best.y); return
	if busy: return
	var gp = _ground_under(sp)
	if gp != null: walk_to(gp, PLAY_WALK); tapring.position = Vector3((gp as Vector3).x, 0.02, (gp as Vector3).z); tap_p = 0.0

## a stone turns a quarter round, and those chained to it
func _fig_turn(ri: int, i: int) -> void:
	var L: Dictionary = _fig_layout()[ri]; var sp: Dictionary = L.spec
	fg_taps += 1
	look_at_pt = (L.tiles_m[i] as Node3D).global_position; fg_look_t = 1.4
	var who := [i] + ((sp.links as Dictionary).get(i, []) as Array)
	for j in who:
		L.k[j] = int(L.k[j]) + 1
		var to := -float(L.k[j]) * PI * 0.5
		for n in [L.tiles[j], L.tiles_m[j]]:
			var old = fg_tw.get(n)
			if old != null and (old as Tween).is_valid(): (old as Tween).kill()
			var q := create_tween(); q.tween_property(n, "rotation:y", to, 0.42).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			fg_tw[n] = q
	for j in who:      # the wheels between the stones that turned
		if j == i: continue
		var key := "%d-%d" % [mini(i, j), maxi(i, j)]
		for gn in (L.gears as Dictionary).get(key, []): create_tween().tween_property(gn, "rotation:y", (gn as Node3D).rotation.y + PI * 0.5, 0.42).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if _fig_whole(L) and not bool(L.solved):
		L.solved = true
		await wait(0.55)
		_fig_still(ri)

func _fig_whole(L: Dictionary) -> bool:
	var sp: Dictionary = L.spec
	for j in (L.k as Array).size():
		if j in (sp.fixed as Array): continue
		if posmod(int(L.k[j]) - int(sp.off[j]), 4) != 0: return false
	return true

## the picture is whole: the water is still, the picture clears, and the gate opens
func _fig_still(ri: int) -> void:
	var L: Dictionary = _fig_layout()[ri]
	print("FIG court ", ri + 1, " whole, after ", fg_taps, " taps in all")
	var gm: ShaderMaterial = L.glass
	var q := create_tween().set_parallel(true)
	q.tween_method(func(v: float) -> void: gm.set_shader_parameter("wave", v), 0.3, 0.0, 2.0).set_trans(Tween.TRANS_SINE)
	q.tween_method(func(v: float) -> void: gm.set_shader_parameter("blur_px", v), 0.35, 0.0, 2.0).set_trans(Tween.TRANS_SINE)
	for m in L.mats: q.tween_property(m, "albedo_color", Color(1.0, 1.0, 1.0), 2.0).set_trans(Tween.TRANS_SINE)
	say("the water is still")
	await wait(1.1)
	create_tween().tween_property(N["fgx%d" % ri], "position:y", -2.0, 2.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	rects["Fg%d" % ri].on = true

## the taps that make a court's picture whole from where its stones are (for the play-through)
func _fig_solution(L: Dictionary) -> Array:
	var sp: Dictionary = L.spec; var d := []
	for j in (L.k as Array).size(): d.append(posmod(int(sp.off[j]) - int(L.k[j]), 4))
	var plan := []
	if (sp.links as Dictionary).is_empty():
		for j in d.size():
			if not (j in (sp.fixed as Array)):
				for n in int(d[j]): plan.append(j)
	else:      # three in a row, each turning its neighbours: taps a, b, c on them give a+b, a+b+c, b+c
		var c := posmod(int(d[1]) - int(d[0]), 4); var a := posmod(int(d[1]) - int(d[2]), 4); var b := posmod(int(d[0]) - a, 4)
		for n in a: plan.append(0)
		for n in b: plan.append(1)
		for n in c: plan.append(2)
	return plan

## (the trial, played through as a player would: FLIP=figure ... -- figuredemo)
func _play_figure() -> void:
	var dir := OS.get_environment("SHOT_DIR")
	var snap := func(n: String) -> void:
		if dir != "": await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, n])
	var idle := func() -> void:
		var still := 0
		while still < 14:
			await get_tree().process_frame
			still = still + 1 if (not busy and route.is_empty() and pending == "") else 0
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(8.0); await snap.call("f0_start")
	var lay := _fig_layout()
	for ri in lay.size():
		var L: Dictionary = lay[ri]
		var plan := _fig_solution(L)
		print("FIG court ", ri + 1, ": the stones are at ", L.k, ", ", plan.size(), " taps to make it whole: ", plan)
		var first := true
		for i in plan:
			_fig_tap(cam.unproject_position((L.tiles_m[i] as Node3D).global_position)); await wait(0.75)
			if first: first = false; await snap.call("f%d_a_one_turned" % (ri + 1))
		await wait(2.6); await snap.call("f%d_b_whole" % (ri + 1))
		print("FIG court ", ri + 1, ": whole ", L.solved, ", the stones at ", L.k)
		await wait(1.6)
		_tap_at(Vector3(FG_GX, 0, float(L.court[3]) + 1.2)); await idle.call()
		print("FIG through gate ", ri + 1, ": she at ", pos)
		if ri + 1 < lay.size():
			_tap_at(Vector3(FG_GX - 1.6, 0, float(lay[ri + 1].court[1]) + 1.3)); await idle.call()
			await wait(3.5); await snap.call("f%d_c_entered" % (ri + 2))
		else:
			_tap_at(Vector3(FG_GX, 0, float(L.court[3]) + 2.6)); await idle.call()
	var n2 := 0
	while not ended and n2 < 600: await get_tree().process_frame; n2 += 1
	await wait(2.5)
	print("FIG ended: ", ended, " at ", pos, ", ", fg_taps, " taps"); await snap.call("f9_end")
	get_tree().quit()

# ---------------------------------------------------------------- the court of the still water (a trial)
## A court by itself in the sea: a terrace to the north where she begins, a terrace to the south with the way out, and
## between them a water from wall to wall. In the water a pier with a bridge that turns on it, and by the east wall a
## row of stones that rise and sink. Two wheels: A on the north terrace turns the bridge; B on the south terrace turns
## the bridge and moves the stones, both at once.
## The world and what the water shows are two courts with the same things, each in its own state (`mt`): a wheel moves
## the things of the court its turner stands in (she the world's, her shadow the water's). In the world wheel A is gone
## from its post; the water still has it. Where a thing and its image do not agree its image is red; when all agree the
## water is still and the way out opens.
const MT_X0 := 14.0
const MT_X1 := 24.0
const MT_Z0 := 0.0
const MT_Z1 := 11.0
const MT_PZ0 := 2.6      # the water, from wall to wall
const MT_PZ1 := 8.4
const MT_C := Vector3(19.0, 0, 5.5)      # the pier
const MT_SX := 22.9      # the row of stones
const MT_START := Vector3(19.0, 0, 1.55)
const MT_EXIT_X := 21.5
var mt := {"bW": 1, "bM": 1, "sW": 0, "sM": 1}      # b: the bridge (1: it joins the terraces); s: the stones (1: up). W: the world's; M: the water's
var match_view_m := false      # the turned picture is drawn: the things of the water's court are the ones that stand, and the world's are in the water
var mt_mat := {}      # the look of the images of the bridge and of the stones (red where they do not agree)
const MT_CALM := Color("857fa4")
const MT_RED := Color("c4506a")
func _match_room() -> void:
	var qx0 := MT_X0 + 0.42; var qx1 := MT_X1 - 0.42
	_pool_court(MT_X0, MT_Z0, MT_X1, MT_Z1, qx0, MT_PZ0, qx1, MT_PZ1, "stone", "PoolSkyM")
	tile_hole = Rect2(qx0 - 0.08, MT_PZ0 - 0.08, qx1 - qx0 + 0.16, MT_PZ1 - MT_PZ0 + 0.16); tiles(MT_X0, MT_Z0, MT_X1, MT_Z1, 1.0); tile_hole = Rect2()
	glass(qx0, MT_PZ0, qx1, MT_PZ1)
	parapet(Vector3(MT_X0 + 0.1, 0, MT_Z0 + 0.1), Vector3(MT_X1 - 0.1, 0, MT_Z0 + 0.1)); parapet(Vector3(MT_X0 + 0.1, 0, MT_Z0 + 0.1), Vector3(MT_X0 + 0.1, 0, MT_Z1 - 0.1)); parapet(Vector3(MT_X1 - 0.1, 0, MT_Z0 + 0.1), Vector3(MT_X1 - 0.1, 0, MT_Z1 - 0.1))
	parapet(Vector3(MT_X0 + 0.1, 0, MT_Z1 - 0.1), Vector3(MT_EXIT_X - 0.7, 0, MT_Z1 - 0.1)); parapet(Vector3(MT_EXIT_X + 0.7, 0, MT_Z1 - 0.1), Vector3(MT_X1 - 0.1, 0, MT_Z1 - 0.1))
	blk(Vector3(MT_EXIT_X - 0.7, -0.18, MT_Z1), Vector3(MT_EXIT_X + 0.7, 0.0, MT_Z1 + 1.9), "stone")      # the landing outside
	for e in [-1.0, 1.0]: blk(Vector3(MT_EXIT_X + e * 0.7 - 0.09, 0, MT_Z1 - 0.22), Vector3(MT_EXIT_X + e * 0.7 + 0.09, 2.0, MT_Z1 - 0.04), "stone")
	leaf("mx", Vector3(MT_EXIT_X, 0, MT_Z1 - 0.13), false, 0.61, 1.75)
	cypress(Vector3(MT_X0 + 0.95, 0, MT_Z0 + 0.95)); cypress(Vector3(MT_X1 - 0.95, 0, MT_Z0 + 0.95)); urn(Vector3(MT_X0 + 0.9, 0, MT_Z1 - 0.9)); urn(Vector3(MT_X1 - 0.9, 0, MT_Z1 - 0.9))
	for wk in ["b", "s"]:
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = MT_CALM; m.cull_mode = BaseMaterial3D.CULL_DISABLED; mt_mat[wk] = m
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		cyl(MT_C + Vector3(0, -0.02, 0), 0.62, 0.7, 0.1, pal("shade", flat), 24, both)      # the pier
		# the bridge: a deck with a rail on each side, turning on the pier
		var br := Node3D.new(); br.position = MT_C; both.add_child(br); N["mbr_m" if twin else "mbr"] = br
		var half := (MT_PZ1 - MT_PZ0) * 0.5 + 0.12
		var parts := [blk(Vector3(-0.46, 0.05, -half), Vector3(0.46, 0.11, half), "stone", br)]
		for e in [-1.0, 1.0]:
			parts.append(blk(Vector3(e * 0.43 - 0.025, 0.56, -half + 0.05), Vector3(e * 0.43 + 0.025, 0.61, half - 0.05), "gold", br))
			for i in 7: parts.append(blk(Vector3(e * 0.43 - 0.02, 0.11, -half + 0.08 + (2.0 * half - 0.16) * i / 6.0 - 0.02), Vector3(e * 0.43 + 0.02, 0.56, -half + 0.08 + (2.0 * half - 0.16) * i / 6.0 + 0.02), "dark", br))
		if twin:
			for q in parts: (q as MeshInstance3D).material_override = mt_mat["b"]
		# the stones: five, in a row by the east wall, from terrace to terrace
		var sn := Node3D.new(); both.add_child(sn); N["mst_m" if twin else "mst"] = sn
		for i in 5:
			var z := MT_PZ0 + 0.62 + (MT_PZ1 - MT_PZ0 - 1.24) * i / 4.0
			var sb := blk(Vector3(MT_SX - 0.42, 0.0 if twin else -0.4, z - 0.42), Vector3(MT_SX + 0.42, 0.07, z + 0.42), "stone", sn)      # (the image is of what stands out of the water, not of what is under it)
			if twin: sb.material_override = mt_mat["s"]
		# the two wheels
		var wa := winch(Vector3(16.4, 0, MT_Z0 + 1.05), PI * 0.5, both, twin); N["wheelA_m" if twin else "wheelA"] = wa.wheel
		var wb2 := winch(Vector3(16.4, 0, MT_Z1 - 1.05), -PI * 0.5, both, twin); N["wheelB_m" if twin else "wheelB"] = wb2.wheel
		if not twin: N["hubA"] = wa.hub; N["hubnA"] = wa.n; N["hubB"] = wb2.hub; N["hubnB"] = wb2.n
	solids.append(Vector3(16.4, MT_Z0 + 1.05, 0.5)); solids.append(Vector3(16.4, MT_Z1 - 1.05, 0.5))
	# floor: hers in the world, her shadow's in the water
	rects["Mn"] = R(MT_X0 + 0.5, MT_Z0 + 0.75, MT_X1 - 0.5, MT_PZ0 - 0.3); rects["Ms"] = R(MT_X0 + 0.5, MT_PZ1 + 0.3, MT_X1 - 0.5, MT_Z1 - 0.7)
	rects["Mb"] = R(MT_C.x - 0.3, MT_PZ0 - 0.35, MT_C.x + 0.3, MT_PZ1 + 0.35); rects["Mst"] = R(MT_SX - 0.25, MT_PZ0 - 0.35, MT_SX + 0.25, MT_PZ1 + 0.35)
	rects["Mx"] = R(MT_EXIT_X - 0.3, MT_Z1 - 0.75, MT_EXIT_X + 0.3, MT_Z1 + 1.6, false)
	W["M"] = {"r": [qx0, MT_PZ0, qx1, MT_PZ1], "heads": [rects["Mn"], rects["Ms"]],
		"foot": {"n": R(MT_X0 + 0.5, MT_Z0 + 0.75, MT_X1 - 0.5, MT_PZ0 - 0.3), "s": R(MT_X0 + 0.5, MT_PZ1 + 0.3, MT_X1 - 0.5, MT_Z1 - 0.7),
			"b": R(MT_C.x - 0.3, MT_PZ0 - 0.35, MT_C.x + 0.3, MT_PZ1 + 0.35), "st": R(MT_SX - 0.25, MT_PZ0 - 0.35, MT_SX + 0.25, MT_PZ1 + 0.35)}}
	WL.append("M")
	for id in ["A", "B"]:
		var hub: Vector3 = N["hub" + id]; var hn: Vector3 = N["hubn" + id]
		objs["mw" + id] = {"at": Vector3(hub.x, -hub.y, hub.z), "stand": Vector3(hub.x, 0, hub.z) + hn * 0.56, "mark": false, "water": "M", "match": true, "rstand": hub + hn * 0.56,
			"hits": [Vector3(hub.x, -hub.y - 0.4, hub.z), Vector3(hub.x, -0.1, hub.z), Vector3(hub.x, 0.2, hub.z), Vector3(hub.x, hub.y + 0.3, hub.z)]}
	stele("m_stele", MT_START + Vector3(0.4, 0, 0.3), 0.0, ["He turned things apart.\nThe water kept them as they were.", "Where the two agree,\nthe water is still."])

## (the trial begins in that court, with her awake)
func _match_begin() -> void:
	_wake_now(); pos = MT_START; yaw = 0.0; cam_t = pos
	_match_apply(); _match_tint(0.0)

## the things of the court are put as they are: those that stand are the world's (or, turned, the water's), and their
## images are the other court's. Floor follows.
func _match_apply() -> void:
	var real := "M" if match_view_m else "W"; var img := "W" if match_view_m else "M"
	(N["mbr"] as Node3D).rotation.y = 0.0 if mt["b" + real] == 1 else PI * 0.5; (N["mbr_m"] as Node3D).rotation.y = 0.0 if mt["b" + img] == 1 else PI * 0.5
	for pr in [["mst", real], ["mst_m", img]]:
		var up: bool = mt["s" + String(pr[1])] == 1
		(N[pr[0]] as Node3D).visible = up; (N[pr[0]] as Node3D).position.y = 0.0 if up else -0.5
	(N["wheelA"] as Node3D).visible = match_view_m; (N["wheelA_m"] as Node3D).visible = not match_view_m      # the wheel the world has lost
	rects["Mb"].on = mt.bW == 1; rects["Mst"].on = mt.sW == 1
	W["M"].foot["b"].on = mt.bM == 1; W["M"].foot["st"].on = mt.sM == 1

## the images of the things that do not agree with them turn red, the others the pale of the water
func _match_tint(dur := 0.9) -> void:
	for wk in ["b", "s"]:
		var to_c := MT_RED if mt[wk + "W"] != mt[wk + "M"] else MT_CALM
		if dur <= 0.0: (mt_mat[wk] as StandardMaterial3D).albedo_color = to_c
		else: create_tween().tween_property(mt_mat[wk], "albedo_color", to_c, dur).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

## a wheel has moved a thing of the court its turner stands in: `el` "b" or "s". What stands is what is seen to move.
func _match_turn(el: String) -> void:
	var w := "M" if flip_on else "W"
	mt[el + w] = 1 - int(mt[el + w])
	var v: int = mt[el + w]
	if el == "b":
		var q := create_tween(); q.tween_property(N["mbr"], "rotation:y", 0.0 if v == 1 else PI * 0.5, 2.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		await q.finished
	else:
		var sn: Node3D = N["mst"]
		if v == 1: sn.visible = true
		var q2 := create_tween(); q2.tween_property(sn, "position:y", 0.0 if v == 1 else -0.5, 1.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		await q2.finished
		if v == 0: sn.visible = false
	_match_apply(); _match_tint()
	if mt.bW == mt.bM and mt.sW == mt.sM and not flags.get("m_still", false): _match_still()

## all agree: the water is still, and the way out opens
func _match_still() -> void:
	flags["m_still"] = true
	say("the water is still")
	create_tween().tween_property(N["mx"], "position:y", -2.0, 2.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	rects["Mx"].on = true
	print("MATCH the water is still: the way out is open")

func _do_mwA() -> void:      # wheel A: the bridge
	await _shadow_wheel("A", MT_C + Vector3(0, 0.3, 0), func() -> void: await _match_turn("b"))

func _do_mwB() -> void:      # wheel B: the bridge and the stones, both
	await _shadow_wheel("B", MT_C + Vector3(1.6, 0.3, 0), func() -> void:
		_match_turn("s")
		await _match_turn("b"))

## (the trial, played through as a player would: FLIP=match ... -- matchdemo)
func _play_match() -> void:
	var dir := OS.get_environment("SHOT_DIR")
	var snap := func(n: String) -> void:
		if dir != "": await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, n])
	var idle := func() -> void:
		var still := 0
		while still < 14:
			await get_tree().process_frame
			still = still + 1 if (not busy and not flip_busy and not flip_homing and route.is_empty() and pending == "" and refl_busy == 0) else 0
	var sign := func() -> void:
		var n0 := 0
		while flip_icon_wid == "" and n0 < 240: await get_tree().process_frame; n0 += 1
		if flip_icon_wid == "": print("MATCH the sign does not show at ", pos)
		_flip_icon_press(); await get_tree().process_frame
	var state := func() -> String: return "world bridge %d stones %d | water bridge %d stones %d" % [mt.bW, mt.sW, mt.bM, mt.sM]
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(7.0); await snap.call("m0_the_court")
	print("MATCH begins at ", pos, ": ", state.call())
	_tap_at(N["hubA"]); await idle.call()      # the wheel by her: in the world it is gone
	print("MATCH wheel A in the world: ", state.call(), ", she at ", pos)
	_tap_at(N["hubB"])      # over the bridge to wheel B: the stones rise, and the bridge turns away
	while a_wL < 0.9: await get_tree().process_frame
	await wait(3.4); await snap.call("m1_she_turns_wheel_b")
	await idle.call()
	print("MATCH wheel B in the world: ", state.call(), ", she at ", pos); await wait(0.6); await snap.call("m2_the_bridge_does_not_agree")
	await sign.call(); await idle.call()
	print("MATCH turned over: ", flip_on); await wait(0.8); await snap.call("m3_turned")
	_tap_at(N["hubA"])      # her shadow, over the water's bridge, to the wheel the water still has
	while a_wL < 0.9 and not flags.get("m_still", false): await get_tree().process_frame
	await wait(3.4); await snap.call("m4_the_shadow_turns_wheel_a")
	await idle.call()
	print("MATCH wheel A in the water: ", state.call(), ", still ", flags.get("m_still", false)); await wait(0.8); await snap.call("m5_still")
	await sign.call(); await idle.call()
	print("MATCH turned back: ", not flip_on, ", she at ", pos); await wait(0.6); await snap.call("m6_back")
	_tap_at(Vector3(MT_EXIT_X, 0, MT_Z1 + 1.2))
	var n2 := 0
	while not ended and n2 < 900: await get_tree().process_frame; n2 += 1
	await wait(2.5)
	print("MATCH ended: ", ended, " at ", pos); await snap.call("m7_end")
	get_tree().quit()

## (the trial, played through as a player would: FLIP=demo ... -- flipdemo) both rooms, by her shadow
func _play_flipdemo() -> void:
	var dir := OS.get_environment("SHOT_DIR")
	var snap := func(n: String) -> void:
		if dir != "": await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, n])
	var idle := func() -> void:      # until nothing is happening any more
		var still := 0
		while still < 14:
			await get_tree().process_frame
			still = still + 1 if (not busy and not flip_busy and route.is_empty() and pending == "" and refl_busy == 0) else 0
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)      # the title
	tap(Vector2(360, 640))      # she wakes
	await settled
	await wait(1.6); await snap.call("demo_0_words_of_the_place")
	var sign := func() -> void:      # the sign is pressed, once it shows
		var n0 := 0
		while flip_icon_wid == "" and n0 < 240: await get_tree().process_frame; n0 += 1
		if flip_icon_wid == "": print("DEMO the sign does not show at ", pos)
		_flip_icon_press(); await get_tree().process_frame
	print("DEMO she woke at ", pos, ", the water by her: ", _flip_water_near())
	await sign.call(); await idle.call()      # the picture turns over
	print("DEMO 1 turned over: ", flip_on, ", she stays at ", flip_anchor); await wait(2.4); await snap.call("demo_1_harbour_turned")
	_tap_at(Vector3(4.25, 0, 10.2))      # the far corner of the quay: farther from her than a shadow may go
	var far := 0.0; var n1 := 0
	while n1 < 900 and (n1 < 30 or not route.is_empty() or flip_homing): await get_tree().process_frame; n1 += 1; far = maxf(far, _flat(pos, flip_anchor))
	print("DEMO 1 the far corner: it went ", snappedf(far, 0.01), " m from her and is now at ", pos); await wait(0.6)
	var hub: Vector3 = N["hub1"]
	_tap_at(hub); await wait(2.6); await snap.call("demo_2_shadow_on_the_mole")
	while a_wL < 0.9 and not done.has("wheel1"): await get_tree().process_frame
	await wait(0.7); await snap.call("demo_2b_shadow_at_the_wheel")      # (she, in the water, stands as she stood)
	await idle.call()
	print("DEMO 1 wheel ", done.has("wheel1"), " sluice ", rects["S1"].on, " shadow at ", pos); await snap.call("demo_3_wheel_turned")
	await sign.call(); await idle.call()      # back
	print("DEMO 1 turned back: ", not flip_on, ", she is at ", pos); await wait(0.8); await snap.call("demo_4_harbour_back")
	_tap_at(Vector3(-2.3, 0, -9.0)); await idle.call()      # she walks on, into the second room
	print("DEMO 2 on the walk at ", pos)
	await sign.call(); await idle.call()      # its water
	print("DEMO 2 turned over: ", flip_on, " at ", pos); await wait(0.8); await snap.call("demo_5_trough_turned")
	var h2: Vector3 = N["hub2"]
	_tap_at(h2); await idle.call()      # the wheel: the shadow is stopped by the grille that stands here, in the turned picture
	print("DEMO 2 first try: wheel ", done.has("wheel2"), " shadow at ", pos); await snap.call("demo_6_stopped_at_the_grille")
	await sign.call(); await idle.call()      # back
	_tap_at(Vector3(-2.3, 0, TG_REAL + 0.6)); await idle.call()      # she walks on, past where that grille stood
	print("DEMO 2 she walked on to ", pos)
	await sign.call(); await idle.call()      # over again
	_tap_at(h2); await wait(2.0); await snap.call("demo_7_shadow_past_the_grille")
	await idle.call()
	print("DEMO 2 second try: wheel ", done.has("wheel2"), " sluice ", rects["S2"].on, " shadow at ", pos); await snap.call("demo_8_second_wheel")
	await sign.call(); await idle.call()      # back
	print("DEMO 2 turned back: ", not flip_on, ", she is at ", pos)
	_tap_at(Vector3(-2.05, 0, TZ0 - 1.6))      # through the sluice: the end
	var n2 := 0
	while not ended and n2 < 900: await get_tree().process_frame; n2 += 1
	await wait(2.5)
	print("DEMO ended: ", ended, " at ", pos); await snap.call("demo_9_end")
	get_tree().quit()

## the still surface of a pool
func glass(x0: float, z0: float, x1: float, z1: float, blur := 0.6) -> ShaderMaterial:
	var wq := QuadMesh.new(); wq.size = Vector2(x1 - x0, z1 - z0); wq.orientation = PlaneMesh.FACE_Y
	var g := ShaderMaterial.new(); g.shader = shaders["glass"]; timed.append(g)
	g.set_shader_parameter("lost_a", 0.0); g.set_shader_parameter("blur_px", blur); g.set_shader_parameter("lod", 0.0)
	prim(wq, Vector3((x0 + x1) * 0.5, 0.012, (z0 + z1) * 0.5), g).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return g

## a capstan with a handwheel (the models of the old winch), turned to face a way. Returns its turning wheel; "hub"
## is where the middle of that wheel is, and "n" the way it faces (toward whoever turns it)
func winch(at: Vector3, yaw: float, parent: Node, twin: bool) -> Dictionary:
	var parts := "wood:wood,rope:linen,gold:gold,stone:stone"
	var hold := Node3D.new(); hold.position = at; hold.rotation.y = yaw; parent.add_child(hold)
	var wb := prop_model("winch_base", hold, 0.0, 0.0, twin, false, parts); wb.rotation.y = PI; wb.scale = Vector3.ONE * WINCH_K
	var wn := Node3D.new(); wn.position = Vector3(-WINCH_HUB.x, WINCH_HUB.y, 0) * WINCH_K; wn.rotation.y = PI; hold.add_child(wn)
	prop_model("winch_wheel", wn, 0.0, 0.0, twin, false, parts).scale = Vector3.ONE * WINCH_K
	var n := Vector3(-cos(yaw), 0, sin(yaw))
	return {"wheel": wn, "hub": at + n * (WINCH_HUB.x * WINCH_K) + Vector3(0, WINCH_HUB.y * WINCH_K, 0), "n": n}

## a sluice across the dry channel: two piers, and between them a bronze leaf that sinks into the floor. The leaf
## is kept under N[key]. along_x: the channel runs along x here (the leaf lies along z)
func sluice(key: String, c: Vector3, along_x := false, half := 0.62, h := 1.5) -> void:
	var ax := Vector3(0, 0, 1) if along_x else Vector3(1, 0, 0)      # along the leaf
	var th := Vector3(1, 0, 0) if along_x else Vector3(0, 0, 1)      # through it
	for e in [-1.0, 1.0]:
		var pc: Vector3 = c + ax * e * (half + 0.17)
		blk(pc - ax * 0.17 - th * 0.17, pc + ax * 0.17 + th * 0.17 + Vector3(0, h + 0.2, 0), "stone")
		blk(pc - ax * 0.2 - th * 0.2, pc + ax * 0.2 + th * 0.2 + Vector3(0, 0.1, 0), "shade")
		blk(pc - ax * 0.2 - th * 0.2 + Vector3(0, h + 0.2, 0), pc + ax * 0.2 + th * 0.2 + Vector3(0, h + 0.27, 0), "shade")
		ball(pc + Vector3(0, h + 0.36, 0), 0.09, pal("gold"))
	gate_slot(c, half, not along_x)      # (the slot lies along the leaf, across the way)
	var leaf := Node3D.new(); leaf.position = c; add_child(leaf)
	if along_x: leaf.rotation.y = PI * 0.5
	var n := 7
	for i in n: bb(Vector3(-half + 0.08 + (2.0 * half - 0.16) * i / (n - 1) - 0.018, 0, -0.018), Vector3(-half + 0.08 + (2.0 * half - 0.16) * i / (n - 1) + 0.018, h - 0.04, 0.018))
	bb_end("dark", leaf)
	for gy in [0.38, 0.95, h - 0.06]: bb(Vector3(-half, gy, -0.024), Vector3(half, gy + 0.04, 0.024))
	bb(Vector3(-half, 0.42, -0.012), Vector3(half, 0.95, 0.012))      # the board that held the water back
	bb_end("gold", leaf)
	N[key] = leaf; N[key + "_h"] = h

## a bronze grille as a leaf of its own: across a walk, or (twin) one that stands only in a water
func leaf(key: String, c: Vector3, along_x: bool, half: float, h: float, parent: Node = self, twin := false) -> Node3D:
	var lf := Node3D.new(); lf.position = c; parent.add_child(lf)
	if along_x: lf.rotation.y = PI * 0.5
	var n := maxi(5, int(half * 2.0 / 0.19))
	for i in n: bb(Vector3(-half + 0.06 + (2.0 * half - 0.12) * i / (n - 1) - 0.018, 0, -0.018), Vector3(-half + 0.06 + (2.0 * half - 0.12) * i / (n - 1) + 0.018, h - 0.04, 0.018))
	var b1 := bb_end("dark", lf)
	for gy in [0.45, h * 0.62, h - 0.06]: bb(Vector3(-half, gy, -0.024), Vector3(half, gy + 0.04, 0.024))
	for i in n: spear(Vector3(-half + 0.06 + (2.0 * half - 0.12) * i / (n - 1), h - 0.045, 0))
	var b2 := bb_end("gold", lf)
	if twin: b1.material_override = under_mat(Color("4a4468")); b2.material_override = under_mat(Color("c98f2c"))
	if key != "": N[key] = lf
	return lf

## a cloth that hangs in folds from a level edge: c is the middle of that edge, w its width, h how far it hangs
func drape(c: Vector3, w: float, h: float, pleats: int, m: Material) -> MeshInstance3D:
	var v := PackedVector3Array(); var nn := PackedVector3Array(); var uv := PackedVector2Array()
	var cols := pleats * 2; var rows := 9
	var at := func(i: int, j: int) -> Vector3:
		var fy := float(j) / rows
		var amp := 0.045 + 0.06 * fy
		var hem := 0.05 * sin(i * 1.7) * fy * fy      # the hem is not cut straight
		return Vector3(-w * 0.5 + w * i / cols + 0.02 * sin(i * 0.9 + j * 0.8) * fy, -(h + hem) * fy, amp * (1.0 if i % 2 == 1 else -1.0) + 0.03 * sin(i * 0.45) * fy)
	for i in cols:
		for j in rows:
			var q := [at.call(i, j), at.call(i + 1, j), at.call(i + 1, j + 1), at.call(i, j + 1)]
			var fn: Vector3 = ((q[1] as Vector3) - (q[0] as Vector3)).cross((q[3] as Vector3) - (q[0] as Vector3)).normalized()
			if fn.z < 0.0: fn = -fn
			for k in [0, 1, 2, 0, 2, 3]:
				v.append(q[k]); nn.append(fn); uv.append(Vector2(float(i + (1 if k in [1, 2] else 0)) / cols, float(j + (1 if k in [2, 3] else 0)) / rows))
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = nn; arr[Mesh.ARRAY_TEX_UV] = uv
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return prim(am, c, m)

## a plain floor over the sea
func floor_plain(x0: float, z0: float, x1: float, z1: float, tile := 1.0) -> void:
	slab(x0, z0, x1, z1, 0.0); under(x0, z0, x1, z1, 0.22, "stone")
	if tile > 0.0: tiles(x0, z0, x1, z1, tile)

## a wall: a base course, the wall with its pilasters and panels, a string course, dentils and a cornice; it ends in
## piers. twin: its copy in the water as well, in plain colours
## the house stands open to the sea: where a wall would close a court there is a balustrade (WALLS=1 brings the walls
## back; wall_keep = true round a call keeps one that is part of a building)
var walls_on := OS.get_environment("WALLS") == "1"
var wall_keep := false
func wall(x0: float, z0: float, x1: float, z1: float, h: float, twin := false, y0 := 0.0) -> void:
	if not walls_on and not wall_keep and y0 == 0.0:
		if (x1 - x0) >= (z1 - z0): parapet(Vector3(x0, 0, (z0 + z1) * 0.5), Vector3(x1, 0, (z0 + z1) * 0.5))
		else: parapet(Vector3((x0 + x1) * 0.5, 0, z0), Vector3((x0 + x1) * 0.5, 0, z1))
		return
	blk(Vector3(x0, y0, z0), Vector3(x1, h, z1), "stone")
	if y0 == 0.0: blk(Vector3(x0 - 0.03, 0, z0 - 0.03), Vector3(x1 + 0.03, 0.14, z1 + 0.03), "shade")
	cornice(x0, z0, x1, z1, h, 0.04, 0.06)
	if y0 == 0.0 and h > 1.8: _wall_dress(x0, z0, x1, z1, h)
	if twin:
		blk(Vector3(x0, y0, z0), Vector3(x1, h, z1), "stone", mroot).material_override = under_mat(Color("d8ccb9"))
		blk(Vector3(x0 - 0.04, h, z0 - 0.04), Vector3(x1 + 0.04, h + 0.06, z1 + 0.04), "stone", mroot).material_override = under_mat(Color("b9ab98"))

## the face of a wall that the eye sees (south, or east): pilasters on plinths with small capitals, a sunk panel in
## each bay, a string course, dentils under the cornice, a coping; and a pier at each end, a little taller, capped
func _wall_dress(x0: float, z0: float, x1: float, z1: float, h: float) -> void:
	var ax := (x1 - x0) >= (z1 - z0)      # it runs east-west: its south face is seen
	var l := (x1 - x0) if ax else (z1 - z0)
	var o := Vector3(x0, 0, z1) if ax else Vector3(x1, 0, z0)      # the foot of the seen face, at its start
	var u := Vector3(1, 0, 0) if ax else Vector3(0, 0, 1)          # along it
	var w := Vector3(0, 0, 1) if ax else Vector3(1, 0, 0)          # out of it
	var B := func(a0: float, a1: float, ya: float, yb: float, out0: float, out1: float, p: String) -> void:
		var pa: Vector3 = o + u * a0 + w * out0 + Vector3(0, ya, 0); var pb: Vector3 = o + u * a1 + w * out1 + Vector3(0, yb, 0)
		blk(Vector3(minf(pa.x, pb.x), ya, minf(pa.z, pb.z)), Vector3(maxf(pa.x, pb.x), yb, maxf(pa.z, pb.z)), p)
	var n := maxi(1, int(round(l / 2.3)))
	var bay := l / n
	for i in n + 1:
		var a := bay * i
		if i == 0 or i == n:      # the pier that ends it
			var c := clampf(a, 0.2, l - 0.2)
			B.call(c - 0.26, c + 0.26, 0.0, h + 0.16, -0.36, 0.1, "stone"); B.call(c - 0.3, c + 0.3, 0.0, 0.2, -0.4, 0.14, "shade")
			B.call(c - 0.31, c + 0.31, h + 0.16, h + 0.23, -0.41, 0.15, "shade"); B.call(c - 0.2, c + 0.2, h + 0.23, h + 0.33, -0.3, 0.04, "stone")
		else:
			B.call(a - 0.17, a + 0.17, 0.14, h - 0.2, 0.0, 0.05, "stone"); B.call(a - 0.2, a + 0.2, 0.14, 0.3, 0.0, 0.075, "shade")
			B.call(a - 0.21, a + 0.21, h - 0.2, h - 0.12, 0.0, 0.08, "shade")
	for i in n:      # the bays: a sunk panel, and over it a string course
		var a0 := bay * i + 0.42; var a1 := bay * (i + 1) - 0.42
		if a1 - a0 < 0.5: continue
		B.call(a0, a1, 0.46, h * 0.7 - 0.12, 0.0, 0.012, "shade")
		B.call(a0 + 0.06, a1 - 0.06, 0.52, h * 0.7 - 0.18, 0.0, 0.02, "stone")
		B.call(bay * i + 0.2, bay * (i + 1) - 0.2, h * 0.7, h * 0.7 + 0.05, 0.0, 0.03, "shade")
	var dx := 0.3      # dentils under the cornice
	while dx < l - 0.3:
		B.call(dx, dx + 0.07, h - 0.1, h - 0.03, 0.0, 0.035, "shade"); dx += 0.16
	B.call(0.0, l, h + 0.06, h + 0.1, -0.33, 0.07, "stone")      # the coping

## an open screen in place of a wall: a row of columns on a low balustrade, carrying an architrave. The land beyond
## shows through it
func stoa(x0: float, z0: float, x1: float, z1: float, h := 2.5) -> void:
	var ax := (x1 - x0) >= (z1 - z0)
	var l := (x1 - x0) if ax else (z1 - z0)
	var o := Vector3(x0, 0, (z0 + z1) * 0.5) if ax else Vector3((x0 + x1) * 0.5, 0, z0)
	var u := Vector3(1, 0, 0) if ax else Vector3(0, 0, 1)
	var hw := Vector3(0, 0, 0.21) if ax else Vector3(0.21, 0, 0)
	blk(o - hw, o + u * l + hw + Vector3(0, 0.1, 0), "shade")      # the stylobate
	var n := maxi(2, int(round(l / 1.75)))
	for i in n + 1:
		var c: Vector3 = o + u * clampf(l * i / n, 0.22, l - 0.22)
		blk(c + Vector3(-0.2, 0.1, -0.2), c + Vector3(0.2, 0.2, 0.2), "stone")
		column(c + Vector3(0, 0.2, 0), h - 0.36, 0.135)
		blk(c + Vector3(-0.2, h - 0.16, -0.2), c + Vector3(0.2, h - 0.08, 0.2), "shade"); blk(c + Vector3(-0.23, h - 0.08, -0.23), c + Vector3(0.23, h, 0.23), "stone")
		if i < n:
			var c2: Vector3 = o + u * clampf(l * (i + 1) / n, 0.22, l - 0.22)
			parapet(c + u * 0.2, c2 - u * 0.2)
	blk(o - hw * 1.05 + Vector3(0, h, 0), o + u * l + hw * 1.05 + Vector3(0, h + 0.2, 0), "stone")      # the architrave
	blk(o - hw * 1.3 - u * 0.05 + Vector3(0, h + 0.2, 0), o + u * (l + 0.05) + hw * 1.3 + Vector3(0, h + 0.27, 0), "shade")
	blk(o - hw * 1.15 + Vector3(0, h + 0.27, 0), o + u * l + hw * 1.15 + Vector3(0, h + 0.33, 0), "stone")

## a plinth for a statue of her, and the statue (pose "": none stands on it)
func her_plinth(p: Vector3, yaw: float, pose: String, parent: Node) -> Node3D:
	var flat := "flat2" if parent == mroot else "flat"
	cyl(p, 0.32, 0.3, 0.07, pal("shade", flat), 20, parent); cyl(p + Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone", flat), 20, parent)
	if pose == "": return null
	return her_statue(p + Vector3(0, 0.17, 0), yaw, pose, 1.0, parent)

func sluice_open(key: String, secs := 2.4) -> void:
	var gt := create_tween(); gt.tween_property(N[key], "position:y", -(float(N[key + "_h"]) + 0.25), secs).set_trans(Tween.TRANS_SINE)
	await gt.finished

## the dry channel: a band of darker stone between two thin kerbs, flush with the floor
func channel(a: Vector3, b: Vector3, w := 0.5) -> void:
	var along_x := absf(b.x - a.x) > absf(b.z - a.z)
	var lo := Vector3(minf(a.x, b.x), 0, minf(a.z, b.z)); var hi := Vector3(maxf(a.x, b.x), 0, maxf(a.z, b.z))
	if along_x:
		blk(Vector3(lo.x, 0, lo.z - w), Vector3(hi.x, 0.004, hi.z + w), "shade")
		for e in [-1.0, 1.0]: blk(Vector3(lo.x, 0, lo.z + e * w - 0.03), Vector3(hi.x, 0.018, lo.z + e * w + 0.03), "stone")
	else:
		blk(Vector3(lo.x - w, 0, lo.z), Vector3(hi.x + w, 0.004, hi.z), "shade")
		for e in [-1.0, 1.0]: blk(Vector3(lo.x + e * w - 0.03, 0, lo.z), Vector3(lo.x + e * w + 0.03, 0.018, hi.z), "stone")

# ---------------------------------------------------------------- waters that lie below the floor
## a still water at a level of its own: its mirror world hangs under a root that turns everything over about that
## level, so that when the water sinks by one step what it shows sinks by two. Returns that root
func _cs_water(key: String, x0: float, z0: float, x1: float, z1: float, level: float, round := false) -> Node3D:
	var mr := Node3D.new(); mr.name = "Mirror_" + key; mr.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * level, 0)); add_child(mr)
	var wq := QuadMesh.new(); wq.size = Vector2(x1 - x0, z1 - z0); wq.orientation = PlaneMesh.FACE_Y
	var g := ShaderMaterial.new(); g.shader = shaders["glass"]; timed.append(g)
	g.set_shader_parameter("lost_a", 0.0); g.set_shader_parameter("blur_px", 0.6); g.set_shader_parameter("lod", 0.0)
	var gl: MeshInstance3D
	if round:      # a round water: a disc, as wide as the rectangle given
		var dm := CylinderMesh.new(); dm.top_radius = 0.5; dm.bottom_radius = 0.5; dm.height = 0.001; dm.radial_segments = 72; dm.rings = 0; dm.cap_bottom = false
		gl = prim(dm, Vector3((x0 + x1) * 0.5, level + 0.012, (z0 + z1) * 0.5), g); gl.scale = Vector3(x1 - x0, 1, z1 - z0)
	else: gl = prim(wq, Vector3((x0 + x1) * 0.5, level + 0.012, (z0 + z1) * 0.5), g)
	gl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	N[key + "_mr"] = mr; N[key + "_glass"] = gl; N[key + "_level"] = level; N[key + "_rect"] = [x0, z0, x1, z1]
	cs_mirs.append(["mir_" + key, mr])
	return mr

## the plain colour of a thing mirrored in such a water. Only what stands above the water is mirrored in it: of
## the copy that hangs under the water's root, whatever would come out above the surface is not drawn
var cs_ush: Shader
func _cs_umat(key: String, c: Color) -> ShaderMaterial:
	if cs_ush == null:
		cs_ush = Shader.new(); cs_ush.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled;\nuniform vec3 col : source_color; uniform float level = 0.0;\nvarying vec3 wp;\nvoid vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }\nvoid fragment(){ if (wp.y > level) discard; ALBEDO = col; }"
	var m := ShaderMaterial.new(); m.shader = cs_ush; m.set_shader_parameter("col", c); m.set_shader_parameter("level", float(N[key + "_level"]))
	if not N.has(key + "_umats"): N[key + "_umats"] = []
	(N[key + "_umats"] as Array).append(m)
	return m

## the water of such a tank goes to a level, slowly: its surface, and under it its whole mirror world twice as far
func _cs_level(key: String, to: float, secs := 2.6) -> void:
	var from: float = N[key + "_level"]
	var lt := create_tween(); lt.tween_method(func(v: float) -> void:
		N[key + "_level"] = v
		(N[key + "_mr"] as Node3D).position.y = 2.0 * v; (N[key + "_glass"] as Node3D).position.y = v + 0.012
		for m in N.get(key + "_umats", []): (m as ShaderMaterial).set_shader_parameter("level", v), from, to, secs).set_trans(Tween.TRANS_SINE)
	await lt.finished

## a deeper pit for a pool whose water must show things that stand high over it
func _cs_deep_pit(sky: String, depth: float) -> void:
	var pit := get_node_or_null(sky) as MeshInstance3D
	if pit == null: return
	var pm := pit.mesh as BoxMesh
	pm.size = Vector3(pm.size.x, depth, pm.size.z); pit.position.y = -0.185 - depth * 0.5

# ---------------------------------------------------------------- the world
func _world() -> void:
	mroot = Node3D.new(); mroot.name = "MirrorPool"; mroot.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3.ZERO); add_child(mroot)
	_harbour(); _causeway(); _basin(); _well(); _fountain(); _forecourt(); _atrium()
	if match_demo: _match_room()
	if figure_demo: _fig_build()
	if geo_demo: _gh_build()
	_temple()
	_wings()
	_strip_refl(mroot)
	_island()
	_landmarks()
	pos = HERPL + Vector3(0, 0.17, 0); yaw = 0.0

# ---------------------------------------------------------------- the island
## the house does not stand in the open sea: it is built on a rock. A low shelf of stone, just out of the water, runs
## out round every court and joins them; it reaches far to the north and west (inland) and little to the south and
## east, where the sea comes up to the terraces. Away from the courts it mounds up, green, with cypresses
func _hash2(ix: int, iz: int) -> float:
	var n := (ix * 73856093) ^ (iz * 19349663) ^ 0x5bd1e995
	n = ((n ^ (n >> 13)) * 1274126177) & 0x7fffffff
	return float((n ^ (n >> 16)) & 0xffff) / 65535.0

func _vnoise(x: float, z: float) -> float:
	var ix := int(floor(x)); var iz := int(floor(z)); var fx := x - ix; var fz := z - iz
	fx = fx * fx * (3.0 - 2.0 * fx); fz = fz * fz * (3.0 - 2.0 * fz)
	return lerpf(lerpf(_hash2(ix, iz), _hash2(ix + 1, iz), fx), lerpf(_hash2(ix, iz + 1), _hash2(ix + 1, iz + 1), fx), fz)

## how far a place lies from the nearest floor, and which way from it: [distance, x, z of the way out, as a unit]
func _land_d(x: float, z: float) -> Array:
	var best := 1e9; var bx := 0.0; var bz := 0.0
	for f in land_rects:
		var dx := maxf(maxf(f[0] - x, 0.0), x - f[2]) * (-1.0 if x < f[0] else 1.0); var dz := maxf(maxf(f[1] - z, 0.0), z - f[3]) * (-1.0 if z < f[1] else 1.0)
		var d := sqrt(dx * dx + dz * dz)
		if d < best: best = d; bx = dx; bz = dz
	return [best, bx / maxf(best, 0.001), bz / maxf(best, 0.001)]

## how high the land stands at a place (the sea lies at WATER). To the north and west of a floor the land is level
## with it and runs on as a meadow that rises into low hills and falls to a far shore; to the south and east the
## floor ends in a sea wall over a low shelf of rock. Under and beside a bridge the land is cut by an inlet. No hill
## stands between the eye and a floor
func _land_h(x: float, z: float) -> float:
	var q := _land_d(x, z); var d: float = q[0]
	var n1 := _vnoise(x * 0.085 + 11.3, z * 0.085 + 4.1); var n2 := _vnoise(x * 0.2 + 3.1, z * 0.2 + 7.7)
	var sea_side := smoothstep(0.3, 0.8, clampf((float(q[1]) + float(q[2])) * 0.75 + 0.5, 0.0, 1.0))      # 1: south or east of the house, toward the open sea
	var reach := 15.0 + 12.0 * n1
	var tl := d / reach
	var y_land := lerpf(-0.03, WATER - 1.1, smoothstep(0.62, 1.0, tl)) + (0.5 + 3.4 * n2) * smoothstep(2.0, 8.0, d) * (1.0 - smoothstep(0.5, 0.95, tl))
	var reach_s := 1.2 + 2.6 * n1
	var y_sea := lerpf(WATER - 1.1, WATER + 0.3, smoothstep(0.0, 0.32, clampf(1.0 - d / reach_s, 0.0, 1.0)))
	var y := lerpf(y_land, y_sea, sea_side)
	var db := 1e9      # an inlet runs under every bridge
	for f in land_bridges: db = minf(db, Vector2(maxf(maxf(f[0] - x, 0.0), x - f[2]), maxf(maxf(f[1] - z, 0.0), z - f[3])).length())
	if db < 2.6: y = minf(y, lerpf(WATER + 0.22, y, smoothstep(1.3, 2.6, db)))
	if y > 0.0:      # a hill hides what lies behind it for as far as it is high
		for k in range(1, 10):
			var bx := x - k; var bz := z - k
			for f in land_rects:
				if bx > f[0] - 0.6 and bx < f[2] + 0.6 and bz > f[1] - 0.6 and bz < f[3] + 0.6: y = minf(y, maxf(k - 1.3, 0.0)); break
	return y + 0.05 * (n2 - 0.5) + (0.05 * (_hash2(int(x * 2.0), int(z * 2.0)) - 0.5) if d > 0.7 else 0.0)

var land_bridges: Array = []
var land_paths: Array = []      # narrow floors that are paths over land, not bridges: no inlet under them
var land_rects: Array = []
func _island() -> void:
	land_rects = []; land_bridges = []
	if OS.get_environment("LAND") != "1": return      # (the house stands in the sea, on its terraces; LAND=1 brings the island back)
	var x0 := 1e9; var z0 := 1e9; var x1 := -1e9; var z1 := -1e9
	for f in floors:
		land_rects.append([f[0], f[1], f[2], f[3]])
		if minf(f[2] - f[0], f[3] - f[1]) <= 2.6 and not ([f[0], f[1], f[2], f[3]] in land_paths): land_bridges.append([f[0], f[1], f[2], f[3]])
		x0 = minf(x0, f[0]); z0 = minf(z0, f[1]); x1 = maxf(x1, f[2]); z1 = maxf(z1, f[3])
	x0 = floor(x0) - 30.0; z0 = floor(z0) - 30.0; x1 = ceil(x1) + 7.0; z1 = ceil(z1) + 7.0
	var nx := int(x1 - x0); var nz := int(z1 - z0)
	var hs := PackedFloat32Array(); hs.resize((nx + 1) * (nz + 1))
	var ds := PackedFloat32Array(); ds.resize((nx + 1) * (nz + 1))
	for j in nz + 1:
		for i in nx + 1: hs[j * (nx + 1) + i] = _land_h(x0 + i, z0 + j); ds[j * (nx + 1) + i] = _land_d(x0 + i, z0 + j)[0]
	for pass_i in 2:      # the land is worn smooth, away from the house
		var h2 := hs.duplicate()
		for j in range(1, nz):
			for i in range(1, nx):
				if ds[j * (nx + 1) + i] < 1.3: continue
				var sum := 0.0
				for dj in [-1, 0, 1]:
					for di in [-1, 0, 1]: sum += hs[(j + dj) * (nx + 1) + i + di]
				h2[j * (nx + 1) + i] = sum / 9.0
		hs = h2
	var groups := {"sand": [], "far": [], "rose": [], "leaf2": [], "leaf3": []}
	for j in nz:
		for i in nx:
			var cx := x0 + i + 0.5; var cz := z0 + j + 0.5
			var inside := false
			for f in land_rects:
				if cx > f[0] and cx < f[2] and cz > f[1] and cz < f[3]: inside = true; break
			if inside: continue
			var a := Vector3(x0 + i, hs[j * (nx + 1) + i], z0 + j); var b := Vector3(x0 + i + 1, hs[j * (nx + 1) + i + 1], z0 + j)
			var c := Vector3(x0 + i + 1, hs[(j + 1) * (nx + 1) + i + 1], z0 + j + 1); var d := Vector3(x0 + i, hs[(j + 1) * (nx + 1) + i], z0 + j + 1)
			if maxf(maxf(a.y, b.y), maxf(c.y, d.y)) < WATER - 0.25: continue      # (under the sea)
			var tris := [[a, b, c], [a, c, d]] if (i + j) % 2 == 0 else [[a, b, d], [b, c, d]]      # (clockwise from above: the side that is seen)
			var cell_y := (a.y + b.y + c.y + d.y) * 0.25; var cell_steep := maxf(maxf(a.y, b.y), maxf(c.y, d.y)) - minf(minf(a.y, b.y), minf(c.y, d.y))
			var n3 := _vnoise(cx * 0.11 + 31.0, cz * 0.11 + 9.0)
			var g := "sand" if cell_y < WATER + 0.06 else ("far" if (cell_y < WATER + 0.55 or cell_steep > 1.05) else ("rose" if (cell_y < WATER + 0.8 or n3 > 0.82) else ("leaf2" if n3 < 0.42 else "leaf3")))
			for t in tris:
				for v in t: (groups[g] as Array).append(v)
	for g in groups:
		var v := PackedVector3Array(groups[g] as Array)
		if v.is_empty(): continue
		var nn := PackedVector3Array(); nn.resize(v.size())
		for k in range(0, v.size(), 3):
			var fn := (v[k + 2] - v[k]).cross(v[k + 1] - v[k]).normalized()
			nn[k] = fn; nn[k + 1] = fn; nn[k + 2] = fn
		var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = nn
		var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var mi := prim(am, Vector3.ZERO, pal(g, "flat")); mi.name = "Island_" + g
		if OS.get_environment("LAND_DBG") != "": print("LAND ", g, " tris ", v.size() / 3, " aabb ", am.get_aabb())
	# what grows on it, and the rocks at its edge: nothing that would stand between the eye and a floor
	var gx := x0 + 1.3
	while gx < x1:
		var gz := z0 + 1.3
		while gz < z1:
			var r := _hash2(int(gx * 3.1), int(gz * 2.7)); var r2 := _hash2(int(gx * 1.7) + 91, int(gz * 4.3) + 17)
			var p := Vector3(gx + (r - 0.5) * 1.6, 0, gz + (r2 - 0.5) * 1.6)
			var gi := clampi(int(p.x - x0), 0, nx - 1); var gj := clampi(int(p.z - z0), 0, nz - 1)
			p.y = minf(minf(hs[gj * (nx + 1) + gi], hs[gj * (nx + 1) + gi + 1]), minf(hs[(gj + 1) * (nx + 1) + gi], hs[(gj + 1) * (nx + 1) + gi + 1]))
			var d: float = _land_d(p.x, p.z)[0]
			var tall := 0.0; var kind := ""
			if p.y > WATER + 0.85 and d > 2.2:
				if r < 0.2: kind = "cyp"; tall = 2.3 + 2.4 * r2
				elif r < 0.42: kind = "bush"; tall = 0.9
			elif p.y > WATER - 0.05 and p.y < WATER + 0.25 and d > 1.5 and r < 0.14: kind = "rock"
			elif p.y > WATER - 0.2 and p.y < WATER + 0.1 and d > 1.2 and r > 0.93: kind = "reeds"
			if kind != "" and tall > 0.0:      # would it hide a floor? (what stands h high hides what lies up to h behind it)
				for k in int(tall + p.y + 2.0):
					var bx := p.x - 0.5 - k; var bz := p.z - 0.5 - k
					for f in land_rects:
						if bx > f[0] - 0.4 and bx < f[2] + 0.4 and bz > f[1] - 0.4 and bz < f[3] + 0.4: kind = ""; break
					if kind == "": break
			match kind:
				"cyp": cypress(p, tall)
				"bush": bush(p + Vector3(0, -0.05, 0), 1.2 + 1.4 * r2, "leaf2" if r2 > 0.5 else "leaf3")
				"rock": rock(Vector3(p.x, 0, p.z), 0.6 + 0.8 * r2)
				"reeds": reeds(Vector3(p.x, 0, p.z))
			gz += 2.6
		gx += 2.6

## off the way: a garden path runs south from the fountain's court to a round temple without a roof, in the meadow.
## Nothing there is needed. Eight columns, three of them broken; in the middle, a statue of her, mourning
const TEMPLE := Vector3(-11.0, 0, -10.5)
func _temple() -> void:
	floor_plain(ARCH_X - 0.8, FZ1, ARCH_X + 0.8, TEMPLE.z - 4.0, 0.8); land_paths.append([ARCH_X - 0.8, FZ1, ARCH_X + 0.8, TEMPLE.z - 4.0])
	floor_plain(TEMPLE.x - 4.0, TEMPLE.z - 4.0, TEMPLE.x + 4.0, TEMPLE.z + 4.0, 1.0)
	for e in [-1.0, 1.0]:      # the path is marked by low posts
		for k in 3: blk(Vector3(ARCH_X + e * 0.74 - 0.07, 0, FZ1 + 0.4 + 1.1 * k), Vector3(ARCH_X + e * 0.74 + 0.07, 0.32, FZ1 + 0.54 + 1.1 * k), "shade")
	var tc := TEMPLE
	cyl(tc, 2.6, 2.7, 0.16, pal("shade"), 32); cyl(tc + Vector3(0, 0.16, 0), 2.4, 2.45, 0.14, pal("stone"), 32)
	for i in 8:
		var a := TAU * i / 8.0 + 0.2
		var cp := tc + Vector3(cos(a) * 2.0, 0.3, sin(a) * 2.0)
		var broken: bool = i in [1, 4, 6]
		column(cp, 1.0 + 0.6 * _hash2(i, 7) if broken else 2.7, 0.17, broken)
	for i in [7, 2]:      # what is left of its ring beam, on the columns that still stand side by side
		var a0: float = TAU * float(i) / 8.0 + 0.2; var a1: float = TAU * float(i + 1) / 8.0 + 0.2
		var m := tc + Vector3((cos(a0) + cos(a1)) * 1.0, 3.0 + 0.11, (sin(a0) + sin(a1)) * 1.0)
		var bm := blk(Vector3(-0.85, -0.11, -0.17), Vector3(0.85, 0.11, 0.17), "stone"); bm.position = m; bm.rotation.y = -(a0 + a1) * 0.5 + PI * 0.5
	her_plinth(tc + Vector3(0, 0.3, 0), 0.6, "mourn", self)
	for dk in [[2.9, 3.1, 0.4], [3.4, 2.6, 1.3], [-3.2, 3.0, 0.2]]:      # drums of the broken ones, where they rolled
		var dr := cyl(Vector3.ZERO, 0.17, 0.17, 0.5, pal("stone"), 12); dr.position = tc + Vector3(dk[0], 0.17, dk[1]); dr.rotation = Vector3(0, dk[2], PI * 0.5)
	stele("stele_t", tc + Vector3(3.2, 0, -3.2), 0.0, ["I built her a house\nwith no roof,\nso that she would never\nlook up for one.", "Rain is a water\nI could not forbid."])
	_look_add("", tc, 2.2, ["a round temple with no roof. she is in it, in stone, mourning", "eight columns. three were broken on purpose: the cuts are clean"])
	urn(tc + Vector3(-3.3, 0, -3.3), 1.1, "rose")

## what stands on the island beyond the courts: the things he left where they fell
func _landmarks() -> void:
	# a head of her, colossal, half under the sea off the harbour: the first thing she sees when she wakes
	sculpt_head(Vector3(7.6, WATER - 1.2, 15.2), 5.6, 0.7, Vector3(-0.2, 0, 0.16), 2)
	foam_ring(Vector3(7.6, 0, 15.4), 2.5, 0.45)
	# drums of a fallen column in the meadow west of the long basin, and a statue of her that was never finished
	for k in 4:
		var dp := Vector3(-8.2 - 0.75 * k, 0, -9.2 + 0.28 * k); dp.y = _land_h(dp.x, dp.z) + 0.2
		var dr := cyl(Vector3.ZERO, 0.2, 0.2, 0.62, pal("stone"), 12); dr.position = dp; dr.rotation = Vector3(0, 0.3 * k, PI * 0.5)
	var bs := Vector3(-19.5, 0, -19.0); bs.y = _land_h(bs.x, bs.z) - 0.05
	thing("broken_statue", bs, 2.2, "stone:marble", 0.7)

## the wings of the atrium. A script that extends this one builds its wing here (and calls super._wings() first);
## likewise _wing_things() for what can be tapped there and _wing_nav() for its floor
func _wings() -> void:
	pass
func _wing_things() -> void:
	pass
func _wing_nav() -> void:
	pass

## water runs along a dry channel: from point to point (each leg along x or along z), a band of running water grows
## at walking pace. Returns when it has reached the last point
func chan_run(pts: Array, speed := 2.2, w := 0.42) -> void:
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]
		var d := b - a; var l := d.length()
		if l < 0.01: continue
		var along_x := absf(d.x) > absf(d.z)
		var n := Node3D.new(); n.position = Vector3(a.x, 0.02, a.z); add_child(n)
		var q := QuadMesh.new(); q.size = Vector2(l, w * 2.0) if along_x else Vector2(w * 2.0, l); q.orientation = PlaneMesh.FACE_Y
		var mi := prim(q, Vector3(d.x * 0.5, 0, d.z * 0.5), water(Vector2(signf(d.x) * 0.5, 0) if along_x else Vector2(0, signf(d.z) * 0.5)), n)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		n.scale = Vector3(0.001, 1, 1) if along_x else Vector3(1, 1, 0.001)
		var g := create_tween(); g.tween_property(n, "scale", Vector3.ONE, l / speed)
		await g.finished

## a wing's water has been set free: when she is next in the atrium it runs down that wing's channel into the basin
func _wing_done(id: String) -> void:
	if id in wings_done: return
	wings_done.append(id); hub_pending.append(id)
	var all_built := true      # (a build in which some wing is not there yet: when every wing that is there has given its water, the others' waters come too, from under their shut doors, so that the chapter can be played to its end)
	for w in ["W", "N", "S"]:
		if wing_open[w] and not (w in wings_done): all_built = false
	if all_built:
		for w in ["W", "N", "S"]:
			if not wing_open[w] and not (w in wings_done): wings_done.append(w); hub_pending.append(w)
	print("WING done ", id, " (", wings_done.size(), " of 3)")

# ---------------------------------------------------------------- the atrium's water
var beyond := false       # what lies behind the Gate is built (by a script that extends this one)
var hub_n := 0            # how many waters have come into the basin
var hub_pending: Array = []
var hub_busy := false
var hub_gust := false     # a new water lies in the basin and no reflection has been sent over it yet

## the way a wing's water takes through the atrium, from its door to the basin's rim
func _hub_way(id: String) -> Array:
	match id:
		"W": return [Vector3(UX0 + 0.3, 0, UC.z), Vector3(UB.x, 0, UC.z), Vector3(UB.x, 0, UB.z + UBR)]
		"S": return [Vector3(-30.0, 0, UZ1 - 0.2), Vector3(-30.0, 0, -34.5), Vector3(-28.05, 0, -34.5)]
	return [Vector3(-19.5, 0, UZ0 + 0.3), Vector3(-19.5, 0, -39.0), Vector3(-21.75, 0, -39.0)]

## the basin's water stands at a level and lies so wide
func _u_set(level: float, rad: float) -> void:
	N["U_level"] = level; W["U"].level = level; W["U"].rad = rad; W["U"].r = [UB.x - rad, UB.z - rad, UB.x + rad, UB.z + rad]
	(N["U_mr"] as Node3D).position.y = 2.0 * level
	var gl: Node3D = N["U_glass"]; gl.position.y = level + 0.012; gl.scale = Vector3(rad * 2.0, 1, rad * 2.0)
	for m in N.get("U_umats", []): (m as ShaderMaterial).set_shader_parameter("level", level)
	for key in ["lampW", "lampE"]:      # the glare of each lamp lies where the water shows the lamp
		var c: Vector3 = N[key + "_c"]
		(N[key + "_glare"] as Node3D).position = Vector3(c.x + (c.y - level), level + 0.03, c.z + (c.y - level))

func _u_rise(level: float, rad: float, secs: float) -> void:
	var l0: float = N["U_level"]; var r0: float = W["U"].rad
	var t := create_tween(); t.tween_method(func(v: float) -> void: _u_set(lerpf(l0, level, v), lerpf(r0, rad, v)), 0.0, 1.0, secs).set_trans(Tween.TRANS_SINE)
	await t.finished

## the glare of the Gate's lamps on the water: there once the water lies wide enough to show them, and while they burn
func _u_glares(secs := 1.2) -> void:
	for key in ["lampW", "lampE"]:
		var gm: StandardMaterial3D = N[key + "_glare_m"]; var gl: Node3D = N[key + "_glare"]
		var to := 0.9 if (hub_n >= 2 and flags.get(key, true)) else 0.0
		if to > 0.0: gl.visible = true
		create_tween().tween_property(gm, "albedo_color:a", to, secs)

## where the basin's water lets her reflection stand, as things are: the floor round the basin; the Gate's stair once
## the second water has come; the landing once the third has, where no lamp's glare lies; the stone, where it is held
## over the cleft; the breach, and the far side of the Gate
func _u_foot() -> void:
	var F := {}
	for n in ["Us", "Uw", "Unw", "Ue", "Une", "Ucor"]:
		var r: Dictionary = rects[n]; F[n] = R(r.x0, r.z0, r.x1, r.z1, true, 0.0)
	var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	F["pl3"] = R(pl.x - 0.3, pl.z - 0.3, pl.x + 0.3, pl.z + 0.3, true, 0.17)
	for i in 5: F["st%d" % i] = R(STAIR_X - 0.42 * (i + 1), LAND_Z - 0.6, STAIR_X - 0.42 * i + (0.25 if i == 0 else 0.0), LAND_Z - 0.05, hub_n >= 2, 0.24 * (i + 1))
	var le: bool = hub_n >= 3 and not flags.get("lampE", true); var lw: bool = hub_n >= 3 and not flags.get("lampW", true)
	F["ldE"] = R(CLEFT_X1, UZ0 + 1.2, LAND_X1, LAND_Z - 0.05, le, POD_H)
	F["slab"] = R(CLEFT_X0 - 0.02, LAND_Z - 0.45, CLEFT_X1 + 0.02, LAND_Z - 0.05, le and flags.get("turn3", false), POD_H)
	F["ldW"] = R(LAND_X0 + 0.1, UZ0 + 1.2, CLEFT_X0, LAND_Z - 0.05, lw, POD_H)
	F["breach"] = R(BREACH_X0 + 0.05, UZ0 - 0.6, BREACH_X1 - 0.05, UZ0 + 1.25, lw, POD_H)
	F["back"] = R(BREACH_X0 + 0.05, UZ0 - 0.9, GATE_X + 0.8, UZ0 - 0.45, hub_n >= 3, POD_H)
	W["U"].foot = F
	W["U"].heads = [rects["Us"], rects["Uw"], rects["Unw"], rects["Ue"], rects["Une"], rects["Ucor"], F["pl3"]]
	if not refl_out.is_empty() and refl_w == "U" and _foot_of("U", (refl_out.holder as Node3D).position, 0.3) == "": _refl_melt()      # what it stood on is gone

## a water comes into the basin: down its channel from its wing's door, then the basin takes it. The first fills the
## floor of the basin and covers the lower step; the second covers the upper step; the third stands at the brim, at the
## Gate's feet. While it comes in the water is stirred and shows nothing; then it stills, and is a mirror
func _hub_fill(id: String) -> void:
	hub_busy = true; busy = true; route.clear(); pending = ""
	if not refl_out.is_empty(): await _refl_melt()
	var k := hub_n; var gm: ShaderMaterial = N["U_gm"]; var gl: Node3D = N["U_glass"]
	var s0 := cam.size
	cam_focus = UB + Vector3(-1.2, 0.2, -0.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 15.5, 1.8).set_trans(Tween.TRANS_SINE)
	await wait(0.8)
	await chan_run(_hub_way(id), 3.0)
	var veil := func(a: float, b: float, secs: float) -> void:
		var vt := create_tween(); vt.tween_method(func(v: float) -> void: gm.set_shader_parameter("veil", v), a, b, secs)
		await vt.finished
	if k == 0:
		_u_set(-0.43, 2.1); gm.set_shader_parameter("veil", 1.0); gm.set_shader_parameter("alpha", 0.0); gl.visible = true
		var f := create_tween(); f.tween_method(func(v: float) -> void: gm.set_shader_parameter("alpha", v), 0.0, 1.0, 1.0)
		await f.finished
		await _u_rise(-0.3, 2.1, 2.4); await _u_rise(-0.29, 3.0, 2.2)
		(N["u_b0"] as Node3D).visible = false; (N["u_pit"] as Node3D).visible = true; (N["U_mr"] as Node3D).visible = true; W["U"].wet = true
	elif k == 1:
		await veil.call(0.0, 1.0, 1.0)
		await _u_rise(-0.15, 3.0, 2.4); await _u_rise(-0.14, UBR, 2.2)
		(N["u_b1"] as Node3D).visible = false
	else:
		await veil.call(0.0, 1.0, 1.0)
		await _u_rise(-0.01, UBR, 2.8)
		(N["u_b2"] as Node3D).visible = false
	hub_n = k + 1; hub_gust = true
	if hub_n >= 3: done.erase("knots")
	await veil.call(1.0, 0.0, 2.0)
	_u_foot(); _u_glares()
	await wait(1.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.6).set_trans(Tween.TRANS_SINE)
	busy = false; hub_busy = false; settled.emit()
	print("HUB water ", hub_n, " level ", N["U_level"], " radius ", W["U"].rad)

## (for stills and runs) so many waters stand in the basin already
func _hub_instant(n: int) -> void:
	if n <= 0: return
	var gm: ShaderMaterial = N["U_gm"]
	hub_n = n; wings_done = ["W", "N", "S"].slice(0, n)
	_u_set([-0.29, -0.14, -0.01][n - 1], [3.0, UBR, UBR][n - 1])
	gm.set_shader_parameter("veil", 0.0); gm.set_shader_parameter("alpha", 1.0); (N["U_glass"] as Node3D).visible = true
	(N["u_b0"] as Node3D).visible = false; (N["u_pit"] as Node3D).visible = true; (N["U_mr"] as Node3D).visible = true; W["U"].wet = true
	if n >= 2: (N["u_b1"] as Node3D).visible = false
	if n >= 3: (N["u_b2"] as Node3D).visible = false; done.erase("knots")
	_u_foot(); _u_glares(0.1)

## a breath of wind crosses the basin: for as long as it lasts the water holds no image, and her reflection is back
## under her feet
func _gust() -> void:
	var gm: ShaderMaterial = N["U_gm"]
	if not refl_out.is_empty() and refl_w == "U": _refl_melt()
	var g := create_tween(); g.tween_method(func(v: float) -> void:
		gm.set_shader_parameter("wave", 1.0 + 8.0 * sin(v * PI)); gm.set_shader_parameter("blur_px", 0.6 + 6.0 * sin(v * PI)), 0.0, 1.0, 3.0)
	await g.finished

## I.1 the shore. The sea stands still inside a small harbour. A quay on the north side; from it a mole runs south
## into the basin, broken in the middle. The wheel of the first sluice was left on the far piece. In the water the
## mole is whole
func _harbour() -> void:
	_pool_court(HX0, HZ0, HX1, HZ1, BX0, BZ0, BX1, BZ1, "stone", "PoolSky")
	tile_hole = Rect2(BX0 - 0.08, BZ0 - 0.08, BX1 - BX0 + 0.16, BZ1 - BZ0 + 0.16); tiles(HX0, HZ0, HX1, HZ1, 1.0); tile_hole = Rect2()
	glass(BX0, BZ0, BX1, BZ1)
	W["H"] = {"r": [BX0, BZ0, BX1, BZ1], "heads": [R(-MOLE_W, BZ0 - 0.6, MOLE_W, MOLE_A)],
		"foot": {"stub": R(-MOLE_W, BZ0 - 0.6, MOLE_W, MOLE_A + 0.02), "gap": R(-MOLE_W, MOLE_A - 0.02, MOLE_W, MOLE_B + 0.02), "far": R(-MOLE_W, MOLE_B - 0.02, MOLE_W, MOLE_C),
			# (the quay all round the basin: the shadow has the run of the court, as far as it may go from her)
			"qn": R(HX0 + 0.45, HZ0 + 0.45, HX1 - 0.45, BZ0 - 0.3), "qw": R(HX0 + 0.45, HZ0 + 0.45, BX0 - 0.3, HZ1 - 0.45), "qe": R(BX1 + 0.3, HZ0 + 0.45, HX1 - 0.45, HZ1 - 0.45), "qs": R(HX0 + 0.45, BZ1 + 0.3, HX1 - 0.45, HZ1 - 0.45)}}
	WL.append("H")
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		# the mole: the stub that is left on the quay, and the piece in the open with the wheel
		for seg in [[BZ0, MOLE_A], [MOLE_B, MOLE_C]]:
			var d := blk(Vector3(-MOLE_W, 0, seg[0]), Vector3(MOLE_W, 0.05, seg[1]), "stone", both); d.material_override = pal("stone", flat)
			for e in [-1.0, 1.0]: blk(Vector3(e * MOLE_W - 0.04, 0.05, seg[0]), Vector3(e * MOLE_W + 0.04, 0.085, seg[1]), "shade", both)
		# the broken ends: stones fallen askew
		for rb in [[Vector3(-0.22, 0.05, MOLE_A - 0.12), 0.5, 0.13], [Vector3(0.24, 0.05, MOLE_A - 0.07), -0.4, 0.1], [Vector3(0.12, 0.05, MOLE_B + 0.1), 0.9, 0.12], [Vector3(-0.27, 0.05, MOLE_B + 0.06), -0.2, 0.09]]:
			var bk := blk(Vector3(-rb[2], 0, -0.08), Vector3(rb[2], 0.07, 0.08), "stone", both); bk.position = rb[0] + Vector3(0, 0.035, 0); bk.rotation.y = rb[1]
		# her plinth
		cyl(HERPL, 0.32, 0.3, 0.07, pal("shade", flat), 20, both); cyl(HERPL + Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone", flat), 20, both)
		# the wheel
		var wd := winch(WHEEL1, WINCH_YAW, both, twin)
		N["wheel1_m" if twin else "wheel1"] = wd.wheel
		if not twin: N["hub1"] = wd.hub; N["hubn1"] = wd.n
		# the middle of the mole, stone by stone, as it lay: in the water only. (It is built in the world too and put
		# away there: when the picture is turned over, the two change places.)
		var crs := Node3D.new(); both.add_child(crs); N["cross_m" if twin else "cross_r"] = crs
		var n1 := 4
		for k in n1:
			var s0 := MOLE_A + (MOLE_B - MOLE_A) * k / n1; var s1 := MOLE_A + (MOLE_B - MOLE_A) * (k + 1) / n1
			var sb := blk(Vector3(-MOLE_W + 0.03 + 0.03 * (k % 2), 0, -(s1 - s0) * 0.5 + 0.07), Vector3(MOLE_W - 0.03 - 0.03 * ((k + 1) % 2), 0.05, (s1 - s0) * 0.5 - 0.07), "stone", crs)
			if twin: sb.material_override = under_mat(Color("857fa4"))
			sb.position += Vector3(0, 0, (s0 + s1) * 0.5); sb.rotation.y = 0.03 * sin(k * 2.3 + 0.7)
		if not twin: crs.position.y = -0.4; crs.visible = false
	# the quay: a low wall to the sea on three sides, lamps, her boat outside
	parapet(Vector3(HX0 + 0.1, 0, HZ0 + 0.1), Vector3(HX0 + 0.1, 0, HZ1 - 0.1)); parapet(Vector3(HX0 + 0.1, 0, HZ1 - 0.1), Vector3(HX1 - 0.1, 0, HZ1 - 0.1)); parapet(Vector3(HX1 - 0.1, 0, HZ0 + 0.1), Vector3(HX1 - 0.1, 0, HZ1 - 0.1))
	parapet(Vector3(HX0 + 0.1, 0, HZ0 + 0.1), Vector3(-0.98, 0, HZ0 + 0.1)); parapet(Vector3(0.98, 0, HZ0 + 0.1), Vector3(HX1 - 0.1, 0, HZ0 + 0.1))
	channel(Vector3(0, 0, HZ0 + 0.02), Vector3(0, 0, BZ0 - 0.1))
	sluice("s1", Vector3(0, 0, HZ0 + 0.3))
	lantern(Vector3(1.7, 0, 0.9), 2); lantern(Vector3(-3.9, 0, 2.2), 3, -1.0)
	urn(Vector3(-4.2, 0, 0.8), 1.0); urn(Vector3(-3.85, 0, 1.1), 0.7, "rose"); urn(Vector3(4.2, 0, 2.1), 0.9)
	boat = Node3D.new(); boat.name = "Boat"; boat.position = Vector3(HX1 + 1.5, WATER - 0.12, 8.2); boat.rotation.y = 0.5; add_child(boat)
	build_boat(boat)
	rock(Vector3(HX1 + 1.2, 0, 4.0), 1.2); rock(Vector3(HX0 - 1.3, 0, 9.4), 1.0); rock(Vector3(2.2, 0, HZ1 + 1.4), 0.9); reeds(Vector3(HX0 - 0.9, 0, 6.2)); reeds(Vector3(-2.4, 0, HZ1 + 0.9), 7)
	stele("stele_1", Vector3(2.9, 0, 1.2), 0.0, ["The sea I could not cover.", "I broke the mole instead.\nThe sea did not notice."])
	_look_add("", HERPL, 0.4, ["a plinth, at the end of what is left of the mole", "it faces the open water"])

## I.2 the dry channel: a causeway north from the harbour, the channel down its middle
func _causeway() -> void:
	floor_plain(-1.3, TZ1, 1.3, HZ0, 0.0)
	channel(Vector3(0, 0, TZ1), Vector3(0, 0, HZ0))
	for e in [-1.0, 1.0]: parapet(Vector3(e * 1.2, 0, TZ1 + 0.1), Vector3(e * 1.2, 0, HZ0 - 0.1))
	# a weir stone beside the channel, with half a carving at the old waterline: a half ring of bronze, cut off flat
	blk(Vector3(0.62, 0, -3.9), Vector3(1.02, 0.5, -3.1), "stone"); blk(Vector3(0.6, 0, -3.92), Vector3(1.04, 0.06, -3.08), "shade")
	arch_band(Vector3(0.62, 0.12, -3.5), 0.2, 0.26, 0.012, true); arch_band(Vector3(0.62, 0.12, -3.5), 0.07, 0.11, 0.012, true); bb_end("gold")
	_look_add("", Vector3(0.82, 0, -3.5), 0.5, ["half a carving, cut off at the old waterline", "the other half was never carved"])
	stele("stele_2", Vector3(-0.85, 0, -5.4), PI * 0.5, ["So I turned the water\naway from the house.", "The channel is dry from the sea\nto the top. Follow it."])
	lantern(Vector3(0.95, 0, -6.3), 4)

## I.3 the long basin of rain. The walk runs along its west side, under a wall. A grille stands across the walk
## near its far end, with the wheel that lifts it behind it. In the water another grille stands across the walk
## half way along, where above there is none
func _basin() -> void:
	_pool_court(TX0, TZ0, TX1, TZ1, TPX0, TPZ0, TPX1, TPZ1, "stone", "PoolSky3")
	tile_hole = Rect2(TPX0 - 0.08, TPZ0 - 0.08, TPX1 - TPX0 + 0.16, TPZ1 - TPZ0 + 0.16); tiles(TX0, TZ0, TX1, TZ1, 1.0); tile_hole = Rect2()
	glass(TPX0, TPZ0, TPX1, TPZ1)
	W["T"] = {"r": [TPX0, TPZ0, TPX1, TPZ1], "heads": [R(TWX0, TG_REAL + 0.2, TWX1, TZ1 - 0.4)],
		"foot": {"a": R(TWX0, TG_WATER + 0.15, TWX1, TZ1 - 0.4), "wg": R(TWX0, TG_WATER - 0.15, TWX1, TG_WATER + 0.15, false), "b": R(TWX0, TZ0 + 0.65, TWX1, TG_WATER - 0.15),
			# (round the water by its other side: a long way, and farther from her than a shadow may go)
			"n": R(TWX0, TPZ1 + 0.3, TX1 - 0.45, TZ1 - 0.4), "e": R(TPX1 + 0.3, TZ0 + 0.65, TX1 - 0.45, TZ1 - 0.4), "s": R(TWX0, TZ0 + 0.65, TX1 - 0.45, TPZ0 - 0.3)},
		"wide": ["n", "e", "s"]}
	WL.append("T")
	wall(TX0, TZ0, TX0 + 0.3, TZ1, 2.3, true)      # the west wall
	stoa(-1.3, TZ0, TX1, TZ0 + 0.3)      # the north side, east of the sluice: a row of columns
	parapet(Vector3(TX1 - 0.1, 0, TZ0 + 0.4), Vector3(TX1 - 0.1, 0, TZ1 - 0.1)); parapet(Vector3(1.3, 0, TZ1 - 0.1), Vector3(TX1 - 0.1, 0, TZ1 - 0.1)); parapet(Vector3(TX0 + 0.4, 0, TZ1 - 0.1), Vector3(-1.3, 0, TZ1 - 0.1))
	channel(Vector3(-0.5, 0, TZ1 - 0.62), Vector3(-2.3, 0, TZ1 - 0.62)); channel(Vector3(-2.3, 0, TZ1 - 0.12), Vector3(-2.3, 0, TZ0 + 0.02)); channel(Vector3(0, 0, TZ1 - 1.12), Vector3(0, 0, TZ1))
	leaf("g2", Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_REAL), false, (TPX0 - TX0 - 0.3) * 0.5, 1.9)      # the grille above
	gate_slot(Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_REAL), (TPX0 - TX0 - 0.3) * 0.5, true)
	leaf("g2w_m", Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_WATER), false, (TPX0 - TX0 - 0.3) * 0.5, 1.9, mroot, true)      # the grille the water keeps
	# (for the turned picture, where the two grilles change places: the water's grille as a thing of the world, and the world's as a thing of the water; both put away)
	var gwr := leaf("g2w_r", Vector3((TX0 + 0.3 + TPX0) * 0.5, -2.1, TG_WATER), false, (TPX0 - TX0 - 0.3) * 0.5, 1.9); gwr.visible = false
	var g2m := leaf("g2_m", Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_REAL), false, (TPX0 - TX0 - 0.3) * 0.5, 1.9, mroot, true); g2m.scale.y = 0.001; g2m.visible = false
	for both in [self, mroot]:
		var wd := winch(WHEEL2, PI * 0.5, both, both == mroot)
		N["wheel2_m" if both == mroot else "wheel2"] = wd.wheel
		if both == self: N["hub2"] = wd.hub; N["hubn2"] = wd.n
	sluice("s2", Vector3(-2.05, 0, TZ0 + 0.3), false, 0.5)
	stele("stele_3", Vector3(1.95, 0, TZ1 - 0.62), 0.0, ["Rain.\nI cannot forbid the rain.", "What bars the one\ndoes not bar the other."])
	urn(Vector3(2.0, 0, TZ0 + 0.9), 1.0); cypress(Vector3(TX0 + 0.75, 0, TZ1 - 0.6), 2.4)

## I.4 the well. Its windlass still turns; the handle of the next sluice lies in the bucket, but only in the water
func _well() -> void:
	floor_plain(-2.8, VZ1, -1.3, TZ0, 0.0); channel(Vector3(-2.05, 0, VZ1), Vector3(-2.05, 0, TZ0))
	_pool_court(VX0, VZ0, VX1, VZ1, WELL.x - WELL_H, WELL.z - WELL_H, WELL.x + WELL_H, WELL.z + WELL_H, "stone", "PoolSky4")
	tiles(VX0, VZ0, VX1, VZ1, 1.0)
	glass(WELL.x - WELL_H, WELL.z - WELL_H, WELL.x + WELL_H, WELL.z + WELL_H, 0.4)
	var kq := WELL_R + 0.2
	W["V"] = {"r": [WELL.x - WELL_H, WELL.z - WELL_H, WELL.x + WELL_H, WELL.z + WELL_H], "foot": {},
		"heads": [R(WELL.x - kq, WELL.z + kq, WELL.x + kq, WELL.z + kq + 0.05), R(WELL.x - kq - 0.05, WELL.z - kq, WELL.x - kq, WELL.z + kq), R(WELL.x + kq + 0.3, WELL.z - kq, WELL.x + kq + 0.35, WELL.z + kq)]}
	WL.append("V")
	channel(Vector3(-2.05, 0, VZ1 - 0.02), Vector3(-2.05, 0, WELL.z + WELL_R + 0.05)); channel(Vector3(WELL.x - WELL_R - 0.05, 0, -20.8), Vector3(VX0 + 0.02, 0, -20.8))
	var ax := WELL + Vector3(0, 1.15, BUCKET.z)      # the middle of the windlass's axle, which lies along x
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		turned(WELL, [[WELL_R, 0.0], [WELL_R, 0.2], [WELL_R - 0.1, 0.2], [WELL_R - 0.1, 0.0]], "stone", 28, both)      # the round kerb
		turned(WELL, [[WELL_R + 0.06, 0.0], [WELL_R + 0.06, 0.05], [WELL_R, 0.05]], "shade", 28, both)
		for e in [-1.0, 1.0]:      # the two posts, each on a stone foot
			var pp := WELL + Vector3(e * (WELL_R + 0.16), 0, BUCKET.z)
			blk(pp + Vector3(-0.13, 0, -0.13), pp + Vector3(0.13, 0.12, 0.13), "shade", both)
			blk(pp + Vector3(-0.07, 0.12, -0.07), pp + Vector3(0.07, 1.3, 0.07), "wood", both)
			blk(pp + Vector3(-0.09, 1.07, -0.09), pp + Vector3(0.09, 1.23, 0.09), "gold", both)
		var axle := Node3D.new(); axle.position = ax; both.add_child(axle)
		var a1 := cyl(Vector3.ZERO, 0.035, 0.035, (WELL_R + 0.3) * 2.0, pal("gold", flat), 10, axle); a1.rotation.z = PI * 0.5; a1.position = Vector3.ZERO
		var dr := cyl(Vector3.ZERO, 0.09, 0.09, 0.62, pal("wood", flat), 12, axle); dr.rotation.z = PI * 0.5; dr.position = Vector3(BUCKET.x, 0, 0)
		for i in 5:
			var rc := cyl(Vector3.ZERO, 0.1, 0.1, 0.045, pal("rope", flat), 12, axle); rc.rotation.z = PI * 0.5; rc.position = Vector3(BUCKET.x - 0.1 + 0.05 * i, 0, 0)
		var hw := Node3D.new(); hw.position = Vector3(WELL_R + 0.33, 0, 0); axle.add_child(hw)      # the handwheel, outside the east post
		prop_model("winch_wheel", hw, 0.0, 0.0, twin, false, "wood:wood,rope:linen,gold:gold,stone:stone").scale = Vector3.ONE * 1.25
		var bk := Node3D.new(); bk.position = WELL + Vector3(BUCKET.x, 0.3, BUCKET.z); both.add_child(bk)      # the bucket: its foot is at this node
		turned(Vector3.ZERO, [[0.0, 0.0], [0.12, 0.0], [0.155, 0.27], [0.135, 0.27], [0.11, 0.03], [0.0, 0.03]], "wood", 14, bk)
		for by in [0.05, 0.2]: turned(Vector3(0, by, 0), [[0.128 + by * 0.13, 0.0], [0.132 + by * 0.13, 0.03]], "gold", 14, bk)
		var bail := TorusMesh.new(); bail.inner_radius = 0.135; bail.outer_radius = 0.15; bail.rings = 16; bail.ring_segments = 6
		var bl := prim(bail, Vector3(0, 0.27, 0), pal("gold", flat), bk); bl.rotation.x = PI * 0.5; bl.scale = Vector3(1, 1, 0.9)
		var rope := cyl(Vector3.ZERO, 0.014, 0.014, 1.0, pal("rope", flat), 6, both)      # the rope: its length follows the bucket
		var ck := _crank_handle(bk); ck.position = Vector3(0.02, 0.2, 0.0); ck.rotation = Vector3(0.0, 0.6, 1.25); ck.scale = Vector3.ONE * 0.9
		ck.visible = twin      # the handle of the next sluice: it lies in the bucket only in the water
		N["bucket_m" if twin else "bucket"] = bk; N["axle_m" if twin else "axle"] = axle; N["rope_m" if twin else "rope"] = rope; N["bcrank_m" if twin else "bcrank"] = ck
	_bucket_set(0.3)
	# the next sluice, on the west side, and the post that works it: a square bronze socket on top, nothing in it
	sluice("s3", Vector3(VX0 + 0.3, 0, -20.8), true, 0.5)
	blk(POST3 + Vector3(-0.16, 0, -0.16), POST3 + Vector3(0.16, 0.1, 0.16), "shade"); blk(POST3 + Vector3(-0.11, 0.1, -0.11), POST3 + Vector3(0.11, 0.86, 0.11), "stone")
	var gr := Node3D.new(); gr.position = POST3 + Vector3(0, 0.86, 0); add_child(gr); _gear(gr, 0.17, 14, 0.05); N["post3_gear"] = gr
	blk(POST3 + Vector3(-0.035, 0.91, -0.035), POST3 + Vector3(0.035, 0.97, 0.035), "gold")
	var c3 := _crank_handle(gr); c3.position = Vector3(0, 0.1, 0); c3.rotation = Vector3(-PI * 0.5, 0, 0); c3.visible = false; N["crank3"] = c3
	stoa(VX0, VZ0, VX1, VZ0 + 0.3)      # the north side: columns, and the hill behind them
	stoa(VX0, VZ0 + 0.3, VX0 + 0.3, -21.6); stoa(VX0, -20.0, VX0 + 0.3, VZ1)      # the west side, either side of the sluice
	parapet(Vector3(VX1 - 0.1, 0, VZ0 + 0.4), Vector3(VX1 - 0.1, 0, VZ1 - 0.1)); parapet(Vector3(-1.3, 0, VZ1 - 0.1), Vector3(VX1 - 0.1, 0, VZ1 - 0.1)); parapet(Vector3(VX0 + 0.4, 0, VZ1 - 0.1), Vector3(-2.8, 0, VZ1 - 0.1))
	stele("stele_4", Vector3(-0.1, 0, VZ1 - 0.75), 0.0, ["I threw the handle\ndown the well.", "The well kept it.\nIt keeps whatever touches it."])
	tree(Vector3(VX0 + 0.9, 0, VZ0 + 0.95), 1.1); urn(Vector3(-0.1, 0, VZ0 + 0.8), 1.0); urn(Vector3(-4.6, 0, VZ1 - 0.8), 0.8, "rose")

## the bucket hangs with its foot y over the water; the rope follows it
func _bucket_set(y: float) -> void:
	for sfx in ["", "_m"]:
		var bk: Node3D = N["bucket" + sfx]; bk.position.y = y
		var rope: MeshInstance3D = N["rope" + sfx]
		var top := 1.15; var bot := y + 0.42
		rope.position = Vector3(bk.position.x, (top + bot) * 0.5, bk.position.z); rope.scale = Vector3(1, maxf(top - bot, 0.01), 1)
		(N["axle" + sfx] as Node3D).rotation.x = (0.3 - y) * 9.0

## I.5 the fountain. The channel runs into a basin at the foot of a plain wall, and ends there. In the water the wall
## has an arch
func _fountain() -> void:
	floor_plain(FX1, -21.5, VX0, -20.1, 0.0); channel(Vector3(FX1, 0, -20.8), Vector3(VX0, 0, -20.8))
	_pool_court(FX0, FZ0, FX1, FZ1, FPX0, FPZ0, FPX1, FPZ1, "stone", "PoolSky5", true)
	tile_hole = Rect2(FPX0 - 0.08, FPZ0 - 0.5, FPX1 - FPX0 + 0.16, FPZ1 - FPZ0 + 0.58); tiles(FX0, FPZ0, FX1, FZ1, 1.0); tile_hole = Rect2()
	glass(FPX0, FPZ0, FPX1, FPZ1)
	var ledge := R(FPX0 - 0.3, FPZ0 + 0.15, FPX1 + 0.3, FPZ0 + 0.42)
	W["F"] = {"r": [FPX0, FPZ0, FPX1, FPZ1], "heads": [ledge, R(FX0 + 0.45, FPZ0 + 0.15, FPX0 - 0.3, FZ1 - 0.45), R(FPX1 + 0.3, FPZ0 + 0.15, FX1 - 0.45, FZ1 - 0.45)],
		"foot": {"l": ledge, "w": R(FX0 + 0.45, FPZ0 + 0.15, FPX0 - 0.3, FZ1 - 0.45), "e": R(FPX1 + 0.3, FPZ0 + 0.15, FX1 - 0.45, FZ1 - 0.45), "arch": R(ARCH_X - 0.25, FZ0 + 0.2, ARCH_X + 0.25, FPZ0 + 0.42)}}
	WL.append("F")
	channel(Vector3(FX1 + 0.02, 0, -20.8), Vector3(ARCH_X + 0.5, 0, -20.8)); channel(Vector3(ARCH_X, 0, -20.3), Vector3(ARCH_X, 0, FPZ1 + 0.1))
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		blk(Vector3(FPX0, 0, FPZ0), Vector3(FPX1, 0.05, FPZ0 + 0.55), "stone", both).material_override = pal("stone", flat)      # the ledge along the wall's foot
		# the wall, with the opening of the arch in it
		for seg in [[FX0, ARCH_X - ARCH_W], [ARCH_X + ARCH_W, FX1]]:
			var wl := blk(Vector3(seg[0], 0, FZ0), Vector3(seg[1], FWALL_H, FZ0 + 0.3), "stone", both)
			if twin: wl.material_override = under_mat(Color("c9b8a0"))
		var gw := CSGBox3D.new(); gw.size = Vector3(ARCH_W * 2.0, FWALL_H - ARCH_Y, 0.3); gw.position = Vector3(ARCH_X, (FWALL_H + ARCH_Y) * 0.5, FZ0 + 0.15); gw.material = under_mat(Color("c9b8a0")) if twin else pal("stone")
		var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = ARCH_W; gc.height = 0.5; gc.sides = 28
		gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -(FWALL_H - ARCH_Y) * 0.5, 0); gc.material = under_mat(Color("b9ab98")) if twin else pal("shade"); gw.add_child(gc); both.add_child(gw)
		if twin:
			blk(Vector3(FX0 - 0.04, FWALL_H, FZ0 - 0.04), Vector3(FX1 + 0.04, FWALL_H + 0.06, FZ0 + 0.34), "stone", both).material_override = under_mat(Color("b9ab98"))
			arch_band(Vector3(ARCH_X, ARCH_Y, FZ0 + 0.3), ARCH_W, ARCH_W + 0.09, 0.014); bb_end("shade", both).material_override = under_mat(Color("a89a8c"))
			blk(Vector3(ARCH_X - 0.5, 0, FZ0 + 0.13), Vector3(ARCH_X + 0.5, 0.012, FZ0 + 0.3), "shade", both).material_override = under_mat(Color("9d93a8"))      # the channel goes on through the arch
			blk(Vector3(ARCH_X - ARCH_W - 0.02, 0, FZ0 + 0.115), Vector3(ARCH_X + ARCH_W + 0.02, ARCH_Y + ARCH_W + 0.02, FZ0 + 0.13), "shade", both).material_override = under_mat(Color("57527a"))      # and the dark of the passage behind it
		# the spout: a bronze mask over a small shelf, dry
		var sx := ARCH_X + 1.5
		blk(Vector3(sx - 0.22, 0.78, FZ0 + 0.3), Vector3(sx + 0.22, 0.84, FZ0 + 0.48), "shade", both)
		ball(Vector3(sx, 1.12, FZ0 + 0.31), 0.12, pal("gold", flat), both); cyl(Vector3(sx, 1.02, FZ0 + 0.38), 0.03, 0.02, 0.06, pal("gold", flat), 8, both)
	cornice(FX0, FZ0, FX1, FZ0 + 0.3, FWALL_H, 0.04, 0.06)
	blk(Vector3(FX0 - 0.03, 0, FZ0 + 0.27), Vector3(FPX0, 0.14, FZ0 + 0.33), "shade"); blk(Vector3(FPX1, 0, FZ0 + 0.27), Vector3(FX1 + 0.03, 0.14, FZ0 + 0.33), "shade")
	# the plug: the opening walled up and plastered over, flush with the wall. Eight courses and the round of the arch
	var plug := Node3D.new(); add_child(plug); N["plug5"] = plug
	for row in 4:
		for col in 2:
			var pb := blk(Vector3(-ARCH_W * 0.5, -ARCH_Y * 0.125, -0.15), Vector3(ARCH_W * 0.5, ARCH_Y * 0.125, 0.15), "stone", plug)
			pb.position = Vector3(ARCH_X + (col - 0.5) * ARCH_W, ARCH_Y * (row + 0.5) / 4.0, FZ0 + 0.15)
	var pc := cyl(Vector3.ZERO, ARCH_W - 0.002, ARCH_W - 0.002, 0.3, pal("stone"), 28, plug); pc.rotation.x = PI * 0.5; pc.position = Vector3(ARCH_X, ARCH_Y, FZ0 + 0.15)
	stoa(FX0, FZ0 + 0.3, FX0 + 0.3, FZ1)      # the west side
	parapet(Vector3(FX1 - 0.1, 0, FZ0 + 0.4), Vector3(FX1 - 0.1, 0, -21.5)); parapet(Vector3(FX1 - 0.1, 0, -20.1), Vector3(FX1 - 0.1, 0, FZ1 - 0.1)); parapet(Vector3(FX0 + 0.4, 0, FZ1 - 0.1), Vector3(ARCH_X - 0.8, 0, FZ1 - 0.1)); parapet(Vector3(ARCH_X + 0.8, 0, FZ1 - 0.1), Vector3(FX1 - 0.1, 0, FZ1 - 0.1))
	stele("stele_5", Vector3(FX1 - 0.75, 0, FZ1 - 0.75), 0.0, ["I built that wall in one night.", "The water has not learned it.\nIt still shows what was there."])
	_look_add("", Vector3(ARCH_X + 1.5, 0.05, FZ0 + 0.3), 1.3, ["the spout is dry", "a hand's depth of water is left under it"])
	_look_add("fwall", Vector3(ARCH_X - 1.6, 0.05, FZ0 + 0.3), 1.8, ["a wall of plain stone", "in the water this wall has an arch"])
	cypress(Vector3(FX0 + 0.8, 0, FZ1 - 0.7), 2.5); urn(Vector3(FX0 + 0.8, 0, -21.0), 1.0, "rose")

## I.6 the forecourt of the atrium. A shallow pool, the largest water so far, with a row of statues of her along its
## north rim and another along its west rim. One plinth is empty. In the water none is: a statue stands there
func _forecourt() -> void:
	floor_plain(ARCH_X - 0.8, GZ1, ARCH_X + 0.8, FZ0, 0.0); channel(Vector3(ARCH_X, 0, GZ1), Vector3(ARCH_X, 0, FZ0))
	_pool_court(GX0, GZ0, GX1, GZ1, GPX0, GPZ0, GPX1, GPZ1, "stone", "PoolSky6")
	tile_hole = Rect2(GPX0 - 0.08, GPZ0 - 0.08, GPX1 - GPX0 + 0.16, GPZ1 - GPZ0 + 0.16); tiles(GX0, GZ0, GX1, GZ1, 1.0); tile_hole = Rect2()
	glass(GPX0, GPZ0, GPX1, GPZ1)
	var qn := R(GX0 + 0.8, GZ0 + 0.8, GX1 - 0.45, ROW_Z - 0.6); var qw := R(GX0 + 0.8, GZ0 + 0.8, ROWW_X - 0.6, GZ1 - 0.45)
	W["G"] = {"r": [GPX0, GPZ0, GPX1, GPZ1], "heads": [qn, qw], "foot": {"n": qn, "w": qw}}
	WL.append("G")
	channel(Vector3(ARCH_X, 0, GZ1 - 0.02), Vector3(ARCH_X, 0, GPZ1 + 0.1)); channel(Vector3(GX0 + 1.25, 0, GZ1 - 1.0), Vector3(ARCH_X - 0.5, 0, GZ1 - 1.0)); channel(Vector3(GX0 + 1.25, 0, DOOR6.z), Vector3(GX0 + 1.25, 0, GZ1 - 0.5)); channel(Vector3(GX0 + 0.3, 0, DOOR6.z), Vector3(GX0 + 1.75, 0, DOOR6.z))
	var poses := ["calm", "pray", "", "mourn"]
	for both in [self, mroot]:
		for i in ROW_X.size():
			var st := her_plinth(Vector3(ROW_X[i], 0, ROW_Z), 0.0, poses[i] if i != HERS else ("pray" if both == mroot else ""), both)
			if i == HERS and both == mroot: N["place6_m"] = st      # the one that stands only in the water: in her place
		for i in ROWW_Z.size(): her_plinth(Vector3(ROWW_X, 0, ROWW_Z[i]), PI * 0.5, ["mourn", "calm", "pray"][i], both)
	wall(GX0, GZ0, GX1, GZ0 + 0.3, 2.6)      # the north wall
	wall(GX0, GZ0 + 0.3, GX0 + 0.3, DOOR6.z - 0.94, 2.6); wall(GX0, DOOR6.z + 0.94, GX0 + 0.3, GZ1, 2.6)      # the west wall, with the great door in it
	blk(Vector3(GX0, 2.35, DOOR6.z - 0.94), Vector3(GX0 + 0.3, 2.6, DOOR6.z + 0.94), "stone"); cornice(GX0, DOOR6.z - 0.94, GX0 + 0.3, DOOR6.z + 0.94, 2.6, 0.04, 0.06)
	sluice("door6", DOOR6, true, 0.6, 2.1)
	parapet(Vector3(GX1 - 0.1, 0, GZ0 + 0.4), Vector3(GX1 - 0.1, 0, GZ1 - 0.1)); parapet(Vector3(ARCH_X + 0.8, 0, GZ1 - 0.1), Vector3(GX1 - 0.1, 0, GZ1 - 0.1)); parapet(Vector3(GX0 + 0.4, 0, GZ1 - 0.1), Vector3(ARCH_X - 0.8, 0, GZ1 - 0.1))
	stele("stele_6", Vector3(GX1 - 0.75, 0, GZ1 - 0.8), 0.0, ["I left one place empty.\nI knew who it was for.", "The door counts them.\nIt opens when none is missing."])
	for i in ROW_X.size():
		if i != HERS: _look_add("", Vector3(ROW_X[i], 0, ROW_Z), 1.9, ["one of his. veiled, like all of them", "it stands where he put it"])
	urn(Vector3(GX1 - 0.8, 0, GZ0 + 1.0), 1.0)

## I.7 the atrium. A great round basin, three steps deep, dry: all three waters of the house came together here.
## Three dry channels come in from the three wings, one goes down to the sea. The Gate stands at the basin's north
## rim on a landing, its stair coming down eastward along the wall: barred, tied, and covered with the one cloth.
## Two lamps burn on its piers by day. The basin lies south-east of the Gate: where a water must lie to show it
func _atrium() -> void:
	var n0 := get_child_count()
	_pool_court(UX0, UZ0, UX1, UZ1, UB.x - UBH, UB.z - UBH, UB.x + UBH, UB.z + UBH, "stone", "PoolSkyU")
	for c in get_children().slice(n0):      # this opening holds a stepped basin, not a pool: no kerb, and (while it is dry) nothing to see below
		var mi := c as MeshInstance3D
		if mi == null: continue
		if mi.name == "PoolSkyU": mi.visible = false; N["u_pit"] = mi
		elif mi.mesh is BoxMesh and absf((mi.mesh as BoxMesh).size.y - 0.04) < 0.001 and absf(mi.position.y - 0.02) < 0.001: remove_child(mi); mi.queue_free()
	_cs_deep_pit("PoolSkyU", 7.4)
	tile_hole = Rect2(UB.x - UBH, UB.z - UBH, UBH * 2.0, UBH * 2.0); tiles(UX0, UZ0, UX1, UZ1, 1.0); tile_hole = Rect2()
	cs_courts.append([UX0, UZ0, UX1, UZ1])
	var mr := _cs_water("U", UB.x - 2.1, UB.z - 2.1, UB.x + 2.1, UB.z + 2.1, -0.43, true)
	mr.visible = false
	var gm := _veil_glass(Color("d9cdb9")); (N["U_glass"] as MeshInstance3D).material_override = gm; (N["U_glass"] as Node3D).visible = false; N["U_gm"] = gm
	# the basin: a rim and two steps down to a round floor with a bronze drain. Each piece goes under the water in its turn
	turned(UB, [[UBH * 1.432, 0.006], [UBR, 0.006]], "stone", 64)
	turned(UB, [[UBR + 0.22, 0.01], [UBR, 0.01]], "shade", 64); turned(UB, [[UBH * 1.432, 0.008], [UBH * 1.432 - 0.1, 0.008]], "shade", 64)
	var b2 := Node3D.new(); add_child(b2); N["u_b2"] = b2; turned(UB, [[UBR, 0.006], [UBR, -0.15]], "stone", 64, b2)
	var b1 := Node3D.new(); add_child(b1); N["u_b1"] = b1; turned(UB, [[UBR, -0.15], [3.0, -0.15], [3.0, -0.3]], "stone", 64, b1)
	var b0 := Node3D.new(); add_child(b0); N["u_b0"] = b0; turned(UB, [[3.0, -0.3], [2.1, -0.3], [2.1, -0.45], [0.0, -0.45]], "stone", 64, b0)
	cyl(UB + Vector3(0, -0.45, 0), 0.3, 0.3, 0.012, pal("gold"), 24, b0)
	for a in 12: blk(Vector3(-0.012, 0, 0.45), Vector3(0.012, 0.004, 1.95), "shade", b0).transform = Transform3D(Basis(Vector3.UP, TAU * a / 12.0), UB + Vector3(0, -0.449, 0)) * Transform3D(Basis(), Vector3(0, 0, 1.2))
	# the half carvings on the risers, where the water will stand: each is made whole by its reflection
	for both in [b1, mr]:      # half a hand mirror, lying on the line of the first water
		var hc := Node3D.new(); hc.position = UB + Vector3(-0.7071, 0, -0.7071) * 2.985 + Vector3(0, -0.3, 0); hc.rotation.y = PI * 0.25; both.add_child(hc)
		var gmat: Material = _cs_umat("U", Color(UC_GOLD)) if both == mr else pal("gold")
		var dk := cyl(Vector3.ZERO, 0.13, 0.13, 0.014, gmat, 24, hc); dk.rotation.x = PI * 0.5
		var hb := blk(Vector3(0.12, -0.02, -0.007), Vector3(0.36, 0.02, 0.007), "gold", hc)
		if both == mr: hb.material_override = gmat
	for both in [b2, mr]:      # a small figure standing on the line of the second water: with its reflection, two joined at the feet. The lower one looks elsewhere
		var hc2 := Node3D.new(); hc2.position = UB + Vector3(-0.7071, 0, -0.7071) * 3.885 + Vector3(0, -0.15, 0); hc2.rotation.y = PI * 0.25; both.add_child(hc2)
		var gmat2: Material = _cs_umat("U", Color(UC_GOLD)) if both == mr else pal("gold")
		var bd := blk(Vector3(-0.016, 0.0, -0.007), Vector3(0.016, 0.085, 0.007), "gold", hc2)
		var hd := cyl(Vector3(0.028 if both == mr else 0.0, 0.108, 0), 0.024, 0.024, 0.014, gmat2, 12, hc2); hd.rotation.x = PI * 0.5
		if both == mr: bd.material_override = gmat2
	# the row of her along the basin's west rim: three statues and an empty place, which a chain ties to the Gate's bar
	var poses := ["calm", "pray", "", "mourn"]
	for both in [self, mr]:
		for i in ROW3_Z.size(): her_plinth(Vector3(ROW3_X, 0, ROW3_Z[i]), PI * 0.5, poses[i], both)
	_strip_refl(mr)
	var pl3 := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	blk(pl3 + Vector3(0.262, 0.09, -0.08), pl3 + Vector3(0.276, 0.13, 0.08), "gold")      # its name plate, blank
	# the landing and its stair
	blk(Vector3(LAND_X0, 0, UZ0 + 0.3), Vector3(LAND_X1, POD_H, LAND_Z), "stone"); blk(Vector3(LAND_X0 - 0.04, 0, UZ0 + 0.3), Vector3(LAND_X1, 0.16, LAND_Z + 0.04), "shade")
	cornice(LAND_X0, UZ0 + 0.3, LAND_X1, LAND_Z, POD_H - 0.06, 0.04, 0.06)
	for seg in [[LAND_X0, CLEFT_X0], [CLEFT_X1, LAND_X1]]:      # in the water it is broken through
		_ublk(Vector3(seg[0], 0, UZ0 + 0.3), Vector3(seg[1], POD_H - 0.05, LAND_Z), "stone", UC_STONE, false); _ublk(Vector3(seg[0], POD_H - 0.05, UZ0 + 0.3), Vector3(seg[1], POD_H, LAND_Z), "stone", UC_TOP, false)
	for rb in [[0.1, 0.0, 0.3, 0.22], [0.32, 0.12, 0.55, 0.3], [0.05, 0.4, 0.3, 0.16], [0.3, 0.75, 0.5, 0.2]]:
		_ublk(Vector3(CLEFT_X0 + rb[0], 0, LAND_Z - 1.0 + rb[1]), Vector3(CLEFT_X0 + rb[2], rb[3], LAND_Z - 0.75 + rb[1]), "stone", UC_SHADE, false)
	for k in 7:
		var sx := LAND_X1 + 0.3 * k; var top := POD_H - 0.15 * (k + 1)
		_ublk(Vector3(sx, 0, UZ0 + 0.3), Vector3(sx + 0.3, top, LAND_Z), "stone", UC_STONE if k % 2 == 0 else UC_TOP)
		blk(Vector3(sx + 0.3, top - 0.03, UZ0 + 0.3), Vector3(sx + 0.32, top, LAND_Z + 0.02), "shade")
	# the north wall, with the Gate and the door of the Spring in it. In the water it is breached beside the Gate
	wall_keep = true      # (the Gate's own wall stays a wall: the water shows a breach in it that the wall itself has not)
	wall(UX0, UZ0, GATE_X - 1.95, UZ0 + 0.3, 3.2); wall(GATE_X + 1.95, UZ0, -20.44, UZ0 + 0.3, 3.2); wall(-18.56, UZ0, UX1, UZ0 + 0.3, 3.2)
	wall_keep = false
	blk(Vector3(-20.44, 2.35, UZ0), Vector3(-18.56, 3.2, UZ0 + 0.3), "stone")
	_ublk(Vector3(UX0, 0, UZ0), Vector3(BREACH_X0, 3.2, UZ0 + 0.3), "stone", UC_STONE, false); _ublk(Vector3(BREACH_X1, 0, UZ0), Vector3(GATE_X - 1.95, 3.2, UZ0 + 0.3), "stone", UC_STONE, false)
	_ublk(Vector3(BREACH_X0, POD_H + 2.05, UZ0), Vector3(BREACH_X1, 3.2, UZ0 + 0.3), "stone", UC_STONE, false); _ublk(Vector3(GATE_X + 1.95, 0, UZ0), Vector3(-21.0, 3.2, UZ0 + 0.3), "stone", UC_STONE, false)
	_ublk(Vector3(UX0, 3.2, UZ0 - 0.04), Vector3(-21.0, 3.26, UZ0 + 0.34), "stone", UC_SHADE, false)
	for rb in [[0.02, 0.12, 0.16], [0.3, 0.2, 0.1]]: _ublk(Vector3(BREACH_X0 + rb[0], POD_H, UZ0 + 0.32), Vector3(BREACH_X0 + rb[0] + rb[1], POD_H + rb[2], UZ0 + 0.5), "stone", UC_SHADE, false)
	for both in [self, mr]: _gate(both, both == mr)
	# the chain from the empty plinth to the bar: along the floor, up the landing, up the wall to a pulley by the pier
	_chain([pl3 + Vector3(-0.34, 0.02, 0), Vector3(LAND_X0 + 0.25, 0.02, pl3.z), Vector3(LAND_X0 + 0.25, 0.02, LAND_Z + 0.03), Vector3(LAND_X0 + 0.25, POD_H + 0.02, LAND_Z + 0.03), Vector3(LAND_X0 + 0.25, POD_H + 0.02, UZ0 + 0.34), Vector3(LAND_X0 + 0.25, 3.0, UZ0 + 0.34), Vector3(GATE_X - 2.1, 3.0, UZ0 + 0.34)])
	cyl(Vector3(GATE_X - 2.1, 2.93, UZ0 + 0.36), 0.07, 0.07, 0.03, pal("gold"), 12).rotation.x = PI * 0.5
	for both in [self, mr]: _turn3_build(both, both == mr)
	# the post that turns the statue: a pinion at the turntable's ring, a crank on top
	var p3 := TURN3 + Vector3(-0.47, 0, 0)
	blk(p3 + Vector3(-0.15, 0, -0.15), p3 + Vector3(0.15, 0.1, 0.15), "shade"); blk(p3 + Vector3(-0.1, 0.1, -0.1), p3 + Vector3(0.1, 0.84, 0.1), "stone")
	var pg := Node3D.new(); pg.position = p3 + Vector3(0, 0.03, 0); add_child(pg); _gear(pg, 0.16, 12, 0.04); N["p3_gear"] = pg
	var pt := Node3D.new(); pt.position = p3 + Vector3(0, 0.84, 0); add_child(pt); _gear(pt, 0.13, 12, 0.04); N["p3_top"] = pt
	var ch3 := _crank_handle(pt); ch3.position = Vector3(0, 0.1, 0); ch3.rotation = Vector3(-PI * 0.5, 0, 0); ch3.scale = Vector3.ONE * 0.85
	# the sides: an open row of columns to the west, either side of the Cistern's door; the forecourt's wall to the east
	stoa(UX0, UZ0 + 0.3, UX0 + 0.3, UC.z - 0.94, 2.9); stoa(UX0, UC.z + 0.94, UX0 + 0.3, UZ1, 2.9)
	sluice("doorW", Vector3(UX0 + 0.15, 0, UC.z), true, 0.6, 2.1); sluice("doorN", Vector3(-19.5, 0, UZ0 + 0.15), false, 0.6, 2.1); sluice("doorS", Vector3(-30.0, 0, UZ1 - 0.2), false, 0.6, 1.5)
	parapet(Vector3(UX0 + 0.4, 0, UZ1 - 0.1), Vector3(-30.95, 0, UZ1 - 0.1)); parapet(Vector3(-29.05, 0, UZ1 - 0.1), Vector3(UX1 - 0.1, 0, UZ1 - 0.1))
	parapet(Vector3(UX1 - 0.1, 0, GZ1 + 0.1), Vector3(UX1 - 0.1, 0, UZ1 - 0.1))
	wall(UX1 - 0.3, UZ0 + 0.3, UX1, GZ0, 3.2)
	# the channels: three come in, one goes down to the sea
	channel(Vector3(UX0 + 0.3, 0, UC.z), Vector3(UB.x + 0.5, 0, UC.z)); channel(Vector3(UB.x, 0, UC.z - 0.02), Vector3(UB.x, 0, UB.z + UBR + 0.05))
	channel(Vector3(-30.0, 0, UZ1 - 0.2), Vector3(-30.0, 0, -35.0)); channel(Vector3(-29.5, 0, -34.5), Vector3(-28.05, 0, -34.5))
	channel(Vector3(-19.5, 0, UZ0 + 0.3), Vector3(-19.5, 0, -38.5)); channel(Vector3(-20.0, 0, -39.0), Vector3(-21.75, 0, -39.0))
	channel(Vector3(UB.x + UBR + 0.05, 0, UB.z), Vector3(-17.0, 0, UB.z)); channel(Vector3(-17.5, 0, UB.z + 0.5), Vector3(-17.5, 0, DOOR6.z - 0.5)); channel(Vector3(-18.0, 0, DOOR6.z), Vector3(UX1, 0, DOOR6.z))
	stele("stele_7", Vector3(STAIR_X + 0.9, 0, UZ0 + 0.95), 0.0, ["This one I could not turn,\nor sink, or blind.\nSo I covered it.", "A pool this size shows too much.\nI let it run dry."])
	_look_add("ubasin", UB + Vector3(UBR - 0.4, 0, 1.2), 0.3, ["no water. no one", "three channels come in here, and one goes down to the sea"])
	_look_add("", Vector3(GATE_X + 1.7, POD_H, UZ0 + 1.15), 2.0, ["a lamp, burning by day", "its light falls where the water would be"])
	_look_add("", TURN3, 1.7, ["she holds out a stone, as if it were wanted somewhere", "a toothed ring under her feet, and a post beside it"])
	_look_add("", pl3, 0.4, ["an empty place. a chain goes from under it to the bar of the Gate", "it waits for a weight"])
	for dl in [[Vector3(UX0 + 0.3, 0, UC.z), "the channel of the cistern comes in under it"], [Vector3(-19.5, 0, UZ0 + 0.3), "the channel of the spring comes in under it"], [Vector3(-30.0, 0, UZ1 - 0.2), "the channel of the lamps comes in under it"]]:
		_look_add("", dl[0], 1.6, ["a door, shut", dl[1]])
	urn(Vector3(UX1 - 0.9, 0, UZ1 - 0.9), 1.0); urn(Vector3(UX0 + 0.9, 0, UZ1 - 0.9), 1.0, "rose"); cypress(Vector3(UX0 + 0.9, 0, UZ0 + 1.0), 2.8); cypress(Vector3(UX1 - 0.9, 0, UZ0 + 1.0), 2.8)
	W["U"] = {"r": [UB.x - 2.1, UB.z - 2.1, UB.x + 2.1, UB.z + 2.1], "round": true, "c": UB, "rad": 2.1, "level": -0.43, "mir": "mir_U", "wet": false, "far": 20.0, "heads": [], "foot": {}}
	WL.append("U")

## a piece of the atrium and its copy in the basin's water (in a plain colour of its own)
func _ublk(a: Vector3, b: Vector3, p: String, c: String, real := true, twin := true) -> void:
	if real: blk(a, b, p)
	if twin: blk(a, b, p, N["U_mr"]).material_override = _cs_umat("U", Color(c))

## the surface of a water that can lie as a film over stone before it shows anything: the glass, with a veil
func _veil_glass(veil_col: Color) -> ShaderMaterial:
	if not N.has("veil_sh"):
		var gsh := Shader.new(); gsh.code = SH_GLASS.replace("//GLINT", GLSL_GLINT).replace("uniform float time_s = 0.0;", "uniform float time_s = 0.0; uniform float veil = 0.0; uniform float alpha = 1.0; uniform vec3 veil_col : source_color = vec3(0.8);").replace("	ALBEDO = c;", "	c = mix(c, mix(veil_col, vec3(0.6, 0.85, 0.88), 0.18), veil);\n	ALBEDO = c; ALPHA = alpha;")
		N["veil_sh"] = gsh
	var gm := ShaderMaterial.new(); gm.shader = N["veil_sh"]; timed.append(gm)
	gm.set_shader_parameter("lost_a", 0.0); gm.set_shader_parameter("blur_px", 0.6); gm.set_shader_parameter("lod", 0.0); gm.set_shader_parameter("veil", 1.0); gm.set_shader_parameter("alpha", 0.0); gm.set_shader_parameter("veil_col", veil_col)
	return gm

## a chain laid from point to point: links, every other one turned
func _chain(pts: Array) -> void:
	var k := 0
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]; var l := a.distance_to(b); var d := (b - a) / l
		var t := 0.04
		while t < l:
			var lk := blk(Vector3(-0.034, -0.008, -0.016) if k % 2 == 0 else Vector3(-0.034, -0.016, -0.008), Vector3(0.034, 0.008, 0.016) if k % 2 == 0 else Vector3(0.034, 0.016, 0.008), "dark")
			lk.position = a + d * t
			if absf(d.y) > 0.9: lk.rotation.z = PI * 0.5
			else: lk.rotation.y = atan2(-d.z, d.x)
			t += 0.062; k += 1

## the Gate: two piers, an arch, two leaves of polished bronze under a bar, the cloth hung before them from a rod and
## tied with three cords that go round the piers to the far side; a lamp on each pier. (twin: its copy in the water)
func _gate(par: Node, twin: bool) -> void:
	var gx := GATE_X; var sfx := "_m" if twin else ""
	var B := func(a: Vector3, b: Vector3, p: String, c: String, to: Node = par) -> MeshInstance3D:
		var m := blk(a, b, p, to)
		if twin: m.material_override = _cs_umat("U", Color(c))
		return m
	for e in [-1.0, 1.0]:
		var px: float = gx + e * 1.7
		B.call(Vector3(px - 0.3, POD_H, UZ0 + 0.2), Vector3(px + 0.3, 5.0, UZ0 + 0.8), "stone", UC_STONE); B.call(Vector3(px - 0.34, POD_H, UZ0 + 0.16), Vector3(px + 0.34, POD_H + 0.2, UZ0 + 0.84), "shade", UC_SHADE)
		B.call(Vector3(px - 0.34, 4.86, UZ0 + 0.16), Vector3(px + 0.34, 5.0, UZ0 + 0.84), "shade", UC_SHADE); B.call(Vector3(px - 0.2, 5.36, UZ0 + 0.3), Vector3(px + 0.2, 5.54, UZ0 + 0.7), "stone", UC_STONE)
		var bl := ball(Vector3(px, 5.72, UZ0 + 0.5), 0.2, pal("gold"), par)
		if twin: bl.material_override = _cs_umat("U", Color(UC_GOLD))
	var gw := CSGBox3D.new(); gw.size = Vector3(4.0, 1.9, 0.6); gw.position = Vector3(gx, 4.42, UZ0 + 0.5); gw.material = _cs_umat("U", Color(UC_STONE)) if twin else pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = 1.4; gc.height = 0.8; gc.sides = 36
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -0.95, 0); gc.material = _cs_umat("U", Color(UC_SHADE)) if twin else pal("shade"); gw.add_child(gc); par.add_child(gw)
	if twin: B.call(Vector3(gx - 2.05, 5.36, UZ0 + 0.15), Vector3(gx + 2.05, 5.44, UZ0 + 0.85), "shade", UC_SHADE)
	else: cornice(gx - 2.0, UZ0 + 0.2, gx + 2.0, UZ0 + 0.8, 5.36, 0.05, 0.08)
	for e in [-1.0, 1.0]:      # the leaves: each hangs on its pier and swings inward
		var lf := Node3D.new(); lf.position = Vector3(gx + e * 1.4, POD_H, UZ0 + 0.4); par.add_child(lf); N[("leafL" if e < 0.0 else "leafR") + sfx] = lf
		B.call(Vector3(minf(0.0, -e * 1.4), 0, -0.04), Vector3(maxf(0.0, -e * 1.4), 2.26, 0.04), "gold", UC_GOLD, lf)
		for i in 10:      # its rounded head
			var y0 := 1.4 * i / 10.0; var y1 := 1.4 * (i + 1) / 10.0; var wdt := sqrt(maxf(1.96 - y0 * y0, 0.0)) + 0.02
			B.call(Vector3(minf(-e * 1.4, -e * 1.4 + e * wdt), 2.26 + y0, -0.04), Vector3(maxf(-e * 1.4, -e * 1.4 + e * wdt), 2.26 + y1, 0.04), "gold", UC_GOLD, lf)
		for ry in [0.25, 1.1, 2.05]: B.call(Vector3(minf(-e * 0.12, -e * 1.3), ry, 0.04), Vector3(maxf(-e * 0.12, -e * 1.3), ry + 0.05, 0.055), "shade", UC_SHADE, lf)      # its rails
		B.call(Vector3(-e * 1.3 - 0.03, 1.0, 0.04), Vector3(-e * 1.3 + 0.03, 1.3, 0.075), "dark", UC_DARK, lf)      # a ring to pull it by
	var bar := Node3D.new(); bar.position = Vector3(gx - 1.78, 2.5, UZ0 + 0.53); par.add_child(bar); N["bar" + sfx] = bar      # (it hangs by its west end, where the chain takes it)
	B.call(Vector3(0, 0, -0.07), Vector3(3.56, 0.22, 0.07), "dark", UC_DARK, bar)
	for e in [-1.0, 1.0]: B.call(Vector3(gx + e * 1.52 - 0.06, 2.36, UZ0 + 0.44), Vector3(gx + e * 1.52 + 0.06, 2.5, UZ0 + 0.64), "gold", UC_GOLD)      # the hooks it lies in
	# the cloth: it hangs in folds from a rod between the piers, down to a hand above the landing
	var veil := drape(Vector3(gx, 4.56, UZ0 + 0.92), 3.5, 4.56 - POD_H - 0.22, 20, _cs_umat("U", Color(UC_CRIM)) if twin else cloth(Color("d9553a"), Color("a63a26"), 0.5))
	if twin: veil.reparent(par, false)
	N["veil" + sfx] = veil
	var rod := cyl(Vector3.ZERO, 0.025, 0.025, 3.7, _cs_umat("U", Color(UC_GOLD)) if twin else pal("gold"), 8, par); rod.rotation.z = PI * 0.5; rod.position = Vector3(gx, 4.58, UZ0 + 0.9)
	var ci := 0
	for ry in [2.05, 2.85, 3.65]:      # the three cords that hold it shut
		var cd := Node3D.new(); cd.position = Vector3(gx, ry, UZ0 + 1.0); par.add_child(cd); N["cord%d%s" % [ci, sfx]] = cd; ci += 1
		B.call(Vector3(-2.02, 0, 0), Vector3(2.02, 0.035, 0.03), "rope", UC_ROPE, cd)
		for e in [-1.0, 1.0]: B.call(Vector3(e * 2.02 - 0.017, 0, -0.7), Vector3(e * 2.02 + 0.017, 0.035, 0.03), "rope", UC_ROPE, cd)
	if twin: return
	for e in [-1.0, 1.0]: _gate_lamp("lampW" if e < 0.0 else "lampE", gx + e * 1.7, 5 if e < 0.0 else 6)

## a lamp on a pier of the Gate: a bracket, a lantern on a short chain, over it a bronze cap that a pull-chain lets
## down; and the glare it throws on the basin's water, where that water holds no image
func _gate_lamp(key: String, px: float, li: int) -> void:
	var c := Vector3(px, 2.75, UZ0 + 1.15)
	blk(Vector3(px - 0.025, 3.12, UZ0 + 0.8), Vector3(px + 0.025, 3.16, UZ0 + 1.19), "gold"); blk(Vector3(px - 0.02, 2.95, UZ0 + 0.8), Vector3(px + 0.02, 3.12, UZ0 + 0.84), "gold")
	cyl(Vector3(px, 2.98, UZ0 + 1.15), 0.008, 0.008, 0.15, pal("dark"), 6)
	cyl(c + Vector3(0, -0.13, 0), 0.11, 0.09, 0.03, pal("gold"), 14); cyl(c + Vector3(0, 0.1, 0), 0.09, 0.11, 0.03, pal("gold"), 14)
	for a in 4: cyl(c + Vector3(cos(TAU * a / 4.0) * 0.09, -0.1, sin(TAU * a / 4.0) * 0.09), 0.008, 0.008, 0.2, pal("gold"), 6)
	var glow := cyl(c + Vector3(0, -0.1, 0), 0.07, 0.07, 0.2, pal("lamp"), 12); N[key + "_glow"] = glow
	var cap := cyl(Vector3.ZERO, 0.03, 0.15, 0.24, pal("gold"), 16); cap.position = c + Vector3(0, 0.2, 0); N[key + "_cap"] = cap
	var h := halo(0.9, Color(1.0, 0.8, 0.45, 0.5)); h.position = c; add_child(h); N[key + "_halo"] = h
	var pull := Node3D.new(); pull.position = Vector3(px + 0.2, POD_H + 1.42, UZ0 + 1.15); add_child(pull); N[key + "_pull"] = pull
	cyl(Vector3(0, 0.05, 0), 0.007, 0.007, 3.14 - (POD_H + 1.47), pal("dark"), 6, pull)
	var rg := TorusMesh.new(); rg.inner_radius = 0.03; rg.outer_radius = 0.05; rg.rings = 12; rg.ring_segments = 6
	prim(rg, Vector3.ZERO, pal("gold"), pull).rotation.x = PI * 0.5
	blk(Vector3(px + 0.18, 3.12, UZ0 + 1.13), Vector3(px + 0.22, 3.16, UZ0 + 1.17), "gold")
	lights[li] = Vector4(c.x, 0.2, c.z, 0.5)
	var gr := Gradient.new(); gr.offsets = PackedFloat32Array([0.0, 0.45, 1.0]); gr.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.75), Color(1, 1, 1, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = gr; gt.fill = GradientTexture2D.FILL_RADIAL; gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 128; gt.height = 128
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.albedo_texture = gt; gm.albedo_color = Color(1.0, 0.95, 0.8, 0.0); gm.render_priority = 4
	var q := QuadMesh.new(); q.size = Vector2(3.6, 3.6); q.orientation = PlaneMesh.FACE_Y
	var gl := prim(q, c, gm); gl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; gl.visible = false; N[key + "_glare"] = gl; N[key + "_glare_m"] = gm; N[key + "_c"] = c
	flags[key] = true      # it burns

## the statue at the landing's foot that holds a stone out on both hands, on a toothed turntable
func _turn3_build(par: Node, twin: bool) -> void:
	var st := her_statue(TURN3, 0.0, "offer", 1.0, par)
	var mid := Vector3(0, 1.12, 0.42)
	var sks := st.find_children("*", "Skeleton3D", true, false)
	if not sks.is_empty():
		var sk: Skeleton3D = sks[0]; var li := _bone(sk, "LeftHand"); var ri := _bone(sk, "RightHand")
		if li >= 0 and ri >= 0:
			var inv := st.global_transform.affine_inverse()
			mid = ((inv * (sk.global_transform * sk.get_bone_global_pose(li).origin)) + (inv * (sk.global_transform * sk.get_bone_global_pose(ri).origin))) * 0.5
	var dirf := Vector3(mid.x, 0, mid.z).normalized()
	var by := maxf(POD_H + 0.012 - (mid.y + 0.02), 0.03)
	st.position.y = by
	var sl := Node3D.new(); sl.position = mid + dirf * 0.14 + Vector3(0, 0.02 + 0.035, 0); sl.rotation.y = atan2(dirf.x, dirf.z); st.add_child(sl)
	var sb := blk(Vector3(-0.36, -0.035, -0.25), Vector3(0.36, 0.035, 0.25), "stone", sl)
	if twin: sb.material_override = _cs_umat("U", Color(UC_TOP))
	var yin := PI - atan2(dirf.x, dirf.z)
	st.rotation.y = yin + PI * 0.5      # it stands turned away: the stone held out over the floor to the west
	N["turn3" + ("_m" if twin else "")] = st
	if twin: return
	N["turn3_in"] = yin; flags["turn3"] = false
	var tt := Node3D.new(); tt.position = TURN3; tt.rotation.y = st.rotation.y; add_child(tt); N["turn3_tt"] = tt
	cyl(Vector3.ZERO, 0.24, 0.26, by, pal("stone"), 24, tt)
	var gr := Node3D.new(); gr.position = Vector3(0, 0.03, 0); tt.add_child(gr); _gear(gr, 0.29, 22, 0.04)

# ---------------------------------------------------------------- what can be tapped, and where she can walk
func _things() -> void:
	var hub: Vector3 = N["hub1"]; var hn: Vector3 = N["hubn1"]
	objs["wheel1"] = {"at": Vector3(hub.x, -hub.y, hub.z), "stand": Vector3(0, 0, MOLE_A - 0.45), "mark": false, "water": "H", "rstand": hub + hn * 0.56,
		"hits": [Vector3(hub.x, -hub.y - 0.4, hub.z), Vector3(hub.x, -0.1, hub.z), Vector3(hub.x, 0.2, hub.z), Vector3(hub.x, hub.y + 0.3, hub.z)]}
	var h2: Vector3 = N["hub2"]; var n2: Vector3 = N["hubn2"]
	objs["wheel2"] = {"at": Vector3(h2.x, -h2.y, h2.z), "stand": Vector3(-2.3, 0, TG_REAL + 0.5), "mark": false, "water": "T", "rstand": h2 + n2 * 0.56,
		"hits": [Vector3(h2.x, -h2.y - 0.4, h2.z), Vector3(h2.x, -0.1, h2.z), Vector3(h2.x, 0.2, h2.z), Vector3(h2.x, h2.y + 0.3, h2.z)]}
	var ax := WELL + Vector3(0, 1.15, BUCKET.z)
	objs["well"] = {"at": ax + Vector3(WELL_R + 0.33, 0, 0), "stand": WELL + Vector3(WELL_R + 0.33 + 0.56, 0, BUCKET.z), "mark": false,
		"hits": [ax + Vector3(-WELL_R - 0.2, 0, 0), ax + Vector3(WELL_R + 0.33, 0, 0), ax + Vector3(WELL_R + 0.33, -0.5, 0)]}
	objs["bucket"] = {"at": WELL + Vector3(BUCKET.x, 0.75, BUCKET.z), "stand": WELL + Vector3(-WELL_R - 0.22, 0, 0.18), "mark": false, "hits": [WELL + Vector3(BUCKET.x, 0.3, BUCKET.z), WELL + Vector3(BUCKET.x, 0.75, BUCKET.z)]}
	done["bucket"] = true      # nothing to take from it until the well has given the handle up
	objs["post3"] = {"at": POST3 + Vector3(0, 0.95, 0), "stand": POST3 + Vector3(0, 0, -0.52), "mark": false, "hits": [POST3 + Vector3(0, 0.1, 0), POST3 + Vector3(0, 1.0, 0)]}
	objs["arch5"] = {"at": Vector3(ARCH_X, -1.0, FZ0 + 0.3), "stand": Vector3(ARCH_X, 0, FPZ0 + 0.28), "mark": false, "water": "F", "rstand": Vector3(ARCH_X, 0, FZ0 + 0.36),
		"hits": [Vector3(ARCH_X, -0.15, FZ0 + 0.3), Vector3(ARCH_X, -ARCH_Y - 0.4, FZ0 + 0.3)]}
	objs["wall5"] = {"at": Vector3(ARCH_X, 1.0, FZ0 + 0.3), "stand": Vector3(ARCH_X, 0, FPZ0 + 0.3), "mark": false, "hits": [Vector3(ARCH_X, 0.25, FZ0 + 0.3), Vector3(ARCH_X, ARCH_Y + 0.3, FZ0 + 0.3)]}
	var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
	objs["place6w"] = {"at": pl + Vector3(0, -1.0, 0), "stand": pl + Vector3(0, 0, -0.72), "mark": false, "water": "G", "rstand": pl + Vector3(0.75, 0, -0.72),
		"hits": [pl + Vector3(0, -0.2, 0), pl + Vector3(0, -1.9, 0)]}
	for mk in cs_mirs:      # her mirrored bodies for the waters that lie below the floor
		var e: Dictionary = spawn_her(mk[1], "mirror"); H[mk[0]] = e
		if e.sk != null:
			var hm := HerMod.new(); hm.main = self; (e.sk as Skeleton3D).add_child(hm)
		if e.ap != null: (e.ap as AnimationPlayer).play("idle")
	_wing_things()
	objs["gate"] = {"at": Vector3(GATE_X, POD_H + 1.6, UZ0 + 0.9), "stand": Vector3(GATE_X, 0, UZ0 + 1.5), "mark": false, "hits": [Vector3(GATE_X, POD_H + 0.3, UZ0 + 0.9), Vector3(GATE_X, POD_H + 3.4, UZ0 + 0.9)]}
	objs["place6"] = {"at": pl + Vector3(0, 0.3, 0), "stand": pl + Vector3(0, 0, -0.72), "mark": false, "hits": [pl + Vector3(0, 0.02, 0), pl + Vector3(0, 0.5, 0)]}
	# the Gate's own things
	for key in ["lampW", "lampE"]:
		var lc: Vector3 = N[key + "_c"]
		objs[key] = {"at": lc, "stand": Vector3(lc.x + 0.2, 0, UZ0 + 1.45), "mark": false, "hits": [lc + Vector3(0, 0.3, 0), Vector3(lc.x + 0.2, POD_H + 1.3, lc.z)]}
	var p3 := TURN3 + Vector3(-0.47, 0, 0)
	objs["turn3"] = {"at": TURN3 + Vector3(0, 1.0, 0), "stand": p3 + Vector3(-0.5, 0, 0.08), "mark": false, "hits": [p3 + Vector3(0, 0.1, 0), p3 + Vector3(0, 0.95, 0), TURN3 + Vector3(0, 0.3, 0), TURN3 + Vector3(0, 1.6, 0)]}
	var pl3 := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	objs["place3"] = {"at": pl3 + Vector3(0, 0.3, 0), "stand": pl3 + Vector3(-0.72, 0, 0), "mark": false, "hits": [pl3 + Vector3(0, 0.02, 0), pl3 + Vector3(0, 0.5, 0)]}
	objs["knots"] = {"at": Vector3(GATE_X, 0, UZ0 + 1.0), "stand": pl3, "mark": false, "water": "U", "rstand": Vector3(GATE_X - 0.5, POD_H, UZ0 - 0.65), "hits": [Vector3(GATE_X, -2.1, UZ0 + 1.0), Vector3(GATE_X, -3.7, UZ0 + 1.0)]}
	done["knots"] = true      # (the water does not show the Gate until it stands at its feet)
	objs["bronze"] = {"at": Vector3(GATE_X, POD_H + 1.4, UZ0 + 0.45), "stand": pl3, "mark": false, "hits": [Vector3(GATE_X, POD_H + 0.2, UZ0 + 0.45), Vector3(GATE_X, POD_H + 3.2, UZ0 + 0.45)]}
	done["bronze"] = true      # (under the cloth)
	objs["through"] = {"at": Vector3(GATE_X, POD_H + 1.0, UZ0 + 0.4), "stand": Vector3(GATE_X, 0, UZ0 - 0.32), "mark": false, "hits": [Vector3(GATE_X, POD_H + 0.1, UZ0 + 0.4), Vector3(GATE_X, POD_H + 2.7, UZ0 + 0.4)]}
	done["through"] = true      # (while the Gate is shut)
	# her image in the bronze, for when the cloth is off it; the cloth as it will lie on the water; and folded
	var bi: Dictionary = spawn_her(self, "marble"); var bh: Node3D = bi.holder
	bh.position = Vector3(GATE_X, POD_H + 0.02, UZ0 + 0.5); bh.scale = Vector3(0.3, 0.3, 0.02); bh.visible = false; N["bronze_img"] = bh; N["bronze_ap"] = bi.ap
	var fv := PackedVector3Array(); var fn := PackedVector3Array(); var fu := PackedVector2Array()
	for i in 48:
		var a0 := TAU * i / 48.0; var a1 := TAU * (i + 1) / 48.0
		var r0 := 1.0 + 0.05 * sin(a0 * 5.0) + 0.035 * sin(a0 * 11.0 + 1.0); var r1 := 1.0 + 0.05 * sin(a1 * 5.0) + 0.035 * sin(a1 * 11.0 + 1.0)
		for q in [Vector3.ZERO, Vector3(cos(a1) * r1, 0, sin(a1) * r1), Vector3(cos(a0) * r0, 0, sin(a0) * r0)]:
			fv.append(q); fn.append(Vector3.UP); fu.append(Vector2(q.x * 0.5 + 0.5, q.z * 0.5 + 0.5))
	var farr := []; farr.resize(Mesh.ARRAY_MAX); farr[Mesh.ARRAY_VERTEX] = fv; farr[Mesh.ARRAY_NORMAL] = fn; farr[Mesh.ARRAY_TEX_UV] = fu
	var fam := ArrayMesh.new(); fam.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, farr)
	var cm := StandardMaterial3D.new(); cm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; cm.albedo_color = Color("cf5a40"); cm.cull_mode = BaseMaterial3D.CULL_DISABLED
	var fcl := prim(fam, Vector3(GATE_X + 0.8, 0.03, LAND_Z + 0.4), cm); fcl.scale = Vector3.ONE * 0.05; fcl.visible = false; fcl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; N["u_cloth"] = fcl
	for i in 7:      # its folds, as darker rings
		var rr := 0.2 + 0.11 * i
		var rm := TorusMesh.new(); rm.inner_radius = rr - 0.006; rm.outer_radius = rr + 0.006; rm.rings = 40; rm.ring_segments = 3
		var dm := StandardMaterial3D.new(); dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; dm.albedo_color = Color("a8402c")
		var rmi := prim(rm, Vector3(0.05 * sin(i * 2.1), 0.004, 0.05 * cos(i * 1.7)), dm, fcl); rmi.scale = Vector3(1, 0.2, 1)
	var fold := Node3D.new(); add_child(fold); fold.visible = false; N["cloth_fold"] = fold
	blk(Vector3(-0.13, 0, -0.1), Vector3(0.13, 0.03, 0.1), "crim", fold); blk(Vector3(-0.125, 0.03, -0.095), Vector3(0.12, 0.055, 0.095), "crim2", fold); blk(Vector3(-0.13, 0.055, -0.1), Vector3(0.1, 0.08, 0.09), "crim", fold)

func _nav() -> void:
	rects["Hq"] = R(HX0 + 0.45, HZ0 + 0.75, HX1 - 0.45, BZ0 - 0.3)      # the quay
	rects["Hw"] = R(HX0 + 0.45, HZ0 + 0.75, BX0 - 0.3, HZ1 - 0.45); rects["He"] = R(BX1 + 0.3, HZ0 + 0.75, HX1 - 0.45, HZ1 - 0.45); rects["Hs"] = R(HX0 + 0.45, BZ1 + 0.3, HX1 - 0.45, HZ1 - 0.45)
	rects["Hm"] = R(-MOLE_W + 0.2, BZ0 - 0.35, MOLE_W - 0.2, MOLE_A - 0.3)      # the stub of the mole
	rects["S1"] = R(-0.3, HZ0 - 0.6, 0.3, HZ0 + 0.8, false)      # through the first sluice
	solids.append(Vector3(HERPL.x, HERPL.z, 0.42))
	rects["P"] = R(-0.85, TZ1 - 0.45, 0.85, HZ0 - 0.55)      # the causeway
	rects["Ts"] = R(TWX0, TZ1 - 0.85, TX1 - 0.5, TZ1 - 0.4); rects["Te"] = R(TPX1 + 0.35, TZ0 + 0.7, TX1 - 0.5, TZ1 - 0.4)
	rects["Tw1"] = R(TWX0, TG_REAL + 0.2, TWX1, TZ1 - 0.4); rects["Tg"] = R(TWX0, TG_REAL - 0.2, TWX1, TG_REAL + 0.2, false); rects["Tw2"] = R(TWX0, TZ0 + 0.65, TWX1, TG_REAL - 0.2)
	rects["S2"] = R(-2.3, TZ0 - 0.3, -1.8, TZ0 + 0.65, false); rects["C2"] = R(-2.4, VZ1 - 0.45, -1.7, TZ0 - 0.3)
	solids.append(Vector3(WHEEL2.x, WHEEL2.z, 0.5))
	var k0 := WELL_R + 0.2      # she keeps this far from the middle of the well
	rects["Vs"] = R(VX0 + 0.45, WELL.z + k0, VX1 - 0.45, VZ1 - 0.45); rects["Vn"] = R(VX0 + 0.45, VZ0 + 0.75, VX1 - 0.45, WELL.z - k0 - 0.3)
	rects["Vw"] = R(VX0 + 0.45, VZ0 + 0.75, WELL.x - k0, VZ1 - 0.45); rects["Ve"] = R(WELL.x + k0 + 0.3, VZ0 + 0.75, VX1 - 0.45, VZ1 - 0.45)
	rects["S3"] = R(VX0 - 0.4, -21.05, VX0 + 0.45, -20.55, false); rects["C3"] = R(FX1 - 0.45, -21.05, VX0 - 0.4, -20.55)
	solids.append(Vector3(POST3.x, POST3.z, 0.3))
	rects["Fe"] = R(FPX1 + 0.3, FPZ0 + 0.15, FX1 - 0.45, FZ1 - 0.45); rects["Fs"] = R(FX0 + 0.45, FPZ1 + 0.3, FX1 - 0.45, FZ1 - 0.45); rects["Fw"] = R(FX0 + 0.45, FPZ0 + 0.15, FPX0 - 0.3, FZ1 - 0.45)
	rects["Fl"] = R(FPX0 - 0.3, FPZ0 + 0.15, FPX1 + 0.3, FPZ0 + 0.42); rects["F5"] = R(ARCH_X - 0.25, GZ1 - 0.5, ARCH_X + 0.25, FPZ0 + 0.42, false)
	rects["Fp"] = R(ARCH_X - 0.45, FZ1 - 0.5, ARCH_X + 0.45, TEMPLE.z - 3.5)      # the garden path, and the walk round the temple
	rects["Ft1"] = R(TEMPLE.x - 3.55, TEMPLE.z - 3.55, TEMPLE.x + 3.55, TEMPLE.z - 3.0); rects["Ft2"] = R(TEMPLE.x - 3.55, TEMPLE.z + 3.0, TEMPLE.x + 3.55, TEMPLE.z + 3.55)
	rects["Ft3"] = R(TEMPLE.x - 3.55, TEMPLE.z - 3.55, TEMPLE.x - 3.0, TEMPLE.z + 3.55); rects["Ft4"] = R(TEMPLE.x + 3.0, TEMPLE.z - 3.55, TEMPLE.x + 3.55, TEMPLE.z + 3.55)
	solids.append(Vector3(TEMPLE.x + 3.2, TEMPLE.z - 3.2, 0.4))
	rects["Gs"] = R(GX0 + 0.8, GPZ1 + 0.3, GX1 - 0.45, GZ1 - 0.45); rects["Ge"] = R(GPX1 + 0.35, GZ0 + 0.8, GX1 - 0.45, GZ1 - 0.45)
	rects["Gw"] = R(GX0 + 0.8, GZ0 + 0.8, ROWW_X - 0.6, GZ1 - 0.45); rects["Gn"] = R(GX0 + 0.8, GZ0 + 0.8, GX1 - 0.45, ROW_Z - 0.6)
	rects["D6"] = R(GX0 - 0.7, DOOR6.z - 0.25, GX0 + 0.8, DOOR6.z + 0.25, false); rects["D6"].x0 = UX1 - 0.7
	var kb := UBH + 0.1      # she keeps this far from the middle of the basin
	rects["Us"] = R(UX0 + 0.8, UB.z + kb, UX1 - 0.45, UZ1 - 0.45); rects["Uw"] = R(UX0 + 0.8, LAND_Z + 0.3, UB.x - kb, UZ1 - 0.45)
	rects["Unw"] = R(UX0 + 0.8, UZ0 + 0.8, LAND_X0 - 0.3, LAND_Z + 0.35); rects["Ue"] = R(UB.x + kb, UZ0 + 0.8, UX1 - 0.75, UZ1 - 0.45)
	rects["Une"] = R(STAIR_X - 0.1, UZ0 + 0.8, UB.x + kb + 0.1, LAND_Z - 0.05)
	rects["Ucor"] = R(UB.x - kb - 0.1, LAND_Z + 0.3, TURN3.x - 0.9, LAND_Z + 0.7)      # the strip between the landing and the basin, as far as the statue's post
	rects["Ust"] = R(LAND_X1 - 0.05, UZ0 + 0.9, STAIR_X + 0.1, LAND_Z - 0.3); rects["Upod"] = R(LAND_X0 + 0.3, UZ0 + 1.25, LAND_X1 - 0.05, LAND_Z - 0.3)
	ramps = [{"r": rects["Ust"], "ax": "x", "z0": LAND_X1, "z1": STAIR_X, "y0": POD_H, "y1": 0.0}, {"r": rects["Upod"], "z0": 0.0, "z1": 1.0, "y0": POD_H, "y1": POD_H}]
	rects["Ugate"] = R(GATE_X - 0.55, UZ0 - 0.45, GATE_X + 0.55, UZ0 + 1.3, false)      # through the Gate, when it stands open
	ramps.append({"r": rects["Ugate"], "z0": 0.0, "z1": 1.0, "y0": POD_H, "y1": POD_H})
	for i in ROW3_Z.size(): solids.append(Vector3(ROW3_X, ROW3_Z[i], 0.45))
	solids.append(Vector3(TURN3.x, TURN3.z, 0.4)); solids.append(Vector3(STAIR_X + 0.9, UZ0 + 0.95, 0.4))
	# the doors of the wings: open from the start where a wing is built
	rects["DW"] = R(UX0 - 0.7, UC.z - 0.25, UX0 + 0.8, UC.z + 0.25, wing_open["W"]); rects["DN"] = R(-19.75, UZ0 - 0.7, -19.25, UZ0 + 0.8, wing_open["N"]); rects["DS"] = R(-30.25, UZ1 - 0.65, -29.75, UZ1 + 0.7, wing_open["S"])
	for wk in [["W", "doorW"], ["N", "doorN"], ["S", "doorS"]]:
		if wing_open[wk[0]]: (N[wk[1]] as Node3D).position.y = -(float(N[wk[1] + "_h"]) + 0.25)
	_wing_nav()
	_u_foot()
	for i in ROW_X.size(): solids.append(Vector3(ROW_X[i], ROW_Z, 0.45))
	for i in ROWW_Z.size(): solids.append(Vector3(ROWW_X, ROWW_Z[i], 0.45))
	posing = true; pose_k = 1.0
	tgtL = HERPL + Vector3(0.03, 1.44 + 0.17, 0.21); tgtR = HERPL + Vector3(-0.03, 1.44 + 0.17, 0.21); a_wL = 1.0; a_wR = 1.0
	if not hand_play: _wake_now()

# ---------------------------------------------------------------- her reflection, as a second body
func _pools() -> Array:
	var out := []
	for k in WL: out.append(W[k].r)
	return out

func _water_under(sp: Vector2):
	var o := cam.project_ray_origin(sp); var d := cam.project_ray_normal(sp)
	for i in WL.size():
		var r: Array = W[WL[i]].r
		if not W[WL[i]].get("wet", true): continue      # (a tank that stands empty)
		var g := o + d * ((float(W[WL[i]].get("level", 0.0)) + 0.012 - o.y) / d.y)      # where the finger meets this water's own surface
		if g.x > r[0] and g.x < r[2] and g.z > r[1] and g.z < r[3]:
			if W[WL[i]].get("round", false) and _flat(g, W[WL[i]].c) > float(W[WL[i]].rad): continue
			for n in rects:      # floor that stands in the water (a mole, a quay) is floor
				if rects[n].on and in_rect(rects[n], g): return null
			return [i, Vector3(g.x, 0, g.z)]
	return null

func _near_in(r: Dictionary, p: Vector3) -> Vector3:
	return Vector3(clampf(p.x, r.x0, r.x1), 0, clampf(p.z, r.z0, r.z1))

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

## the footing of a water that holds the point p (or lies nearest to it, within reach): its name, or ""
func _foot_of(wid: String, p: Vector3, reach := 0.2) -> String:
	var best := ""; var bd := reach
	for n in W[wid].foot:
		var f: Dictionary = W[wid].foot[n]
		if not f.on or absf(float(f.h) - p.y) > 0.35: continue      # (a footing at another height is another place)
		var d := _flat(_near_in(f, p), p)
		if d < bd: bd = d; best = n
	return best

## the way of her reflection over a water from one place toward another: only over what the water has for it to
## stand on. If the place cannot be reached it goes as near to it as it can. {"pts": the way, "left": how far short
## of the place it ends, "h": how high over the water it then stands}
func _refl_path(wid: String, from: Vector3, to: Vector3) -> Dictionary:
	var F: Dictionary = W[wid].foot
	var a := _foot_of(wid, from, 0.9)
	if a == "": return {"pts": [], "left": 1e9, "h": 0.0, "hs": []}
	var lvl := float(W[wid].get("level", 0.0))
	# the place that was meant, on whatever this water has to stand on, open or not. (A tap on the water names the
	# place whose image lies under the finger: what stands h over the water is seen h to the south-east of itself)
	var goal := to; var gn := ""; var gd := 1e9
	for n in F:
		var tn: Vector3 = (to - Vector3(1, 0, 1) * (float(F[n].h) - lvl)) if refl_img else to
		var c2 := _near_in(F[n], tn)
		var dd := _flat(c2, tn) + (0.0 if F[n].on else 0.15)
		if dd < gd: gd = dd; goal = c2; gn = n
	# the way there over all of it; what is shut costs dear, so a way that is open is taken if there is one
	var cost := {a: 0.0}; var prev := {a: ""}; var open_set := [a]
	while not open_set.is_empty():
		var c: String = open_set[0]
		for o in open_set:
			if cost[o] < cost[c]: c = o
		open_set.erase(c)
		for n in F:
			if n == c or absf(float(F[c].h) - float(F[n].h)) >= 0.3 or portal(F[c], F[n]) == null: continue
			var nc: float = cost[c] + (1.0 if F[n].on else 100.0)
			if not cost.has(n) or nc < cost[n] - 0.001:
				cost[n] = nc; prev[n] = c
				if not (n in open_set): open_set.append(n)
	var chain := []; var dest := goal
	if gn != "" and prev.has(gn):
		chain = [gn]
		while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
		for i in chain.size():      # it is walked as far as it is open
			if not F[chain[i]].on:
				var pr0: Array = portal(F[chain[i - 1]], F[chain[i]])
				dest = _near_in(F[chain[i - 1]], Vector3(clampf(goal.x, pr0[0], pr0[2]), 0, clampf(goal.z, pr0[1], pr0[3])))
				chain = chain.slice(0, i); break
	else:      # no way at all: as near as what can be reached comes to it
		var b := a; var bd := 1e9
		for n in prev:
			if cost[n] >= 100.0: continue
			var c3 := _near_in(F[n], goal)
			if _flat(c3, goal) < bd: bd = _flat(c3, goal); b = n; dest = c3
		chain = [b]
		while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
	var pts := []; var hs := []; var cur := from
	for i in range(chain.size() - 1):
		var pr: Array = portal(F[chain[i]], F[chain[i + 1]])
		var mid := cur.lerp(dest, 0.5)
		var pt := Vector3(clampf(mid.x, pr[0], pr[2]), 0, clampf(mid.z, pr[1], pr[3]))
		pts.append(pt); hs.append(float(F[chain[i + 1]].h)); cur = pt
	var last: String = chain[chain.size() - 1]
	pts.append(dest); hs.append(float(F[last].h))
	return {"pts": pts, "left": _flat(dest, goal) + (0.0 if last == gn else 0.3), "h": F[last].h, "hs": hs}

## where she stands to send her reflection out on a water: the place nearest to her on the floor that touches its footing
func _head_point(wid: String) -> Vector3:
	var best := pos; var bd := 1e9
	for h in W[wid].heads:
		var c := _near_in(h, pos)
		if _flat(c, pos) < bd: bd = _flat(c, pos); best = c
	return best

## where her reflection stands when it is under her feet
func _refl_start(_wid: String) -> Vector3:
	return pos      # (a mirrored body's own height is the height of what it mirrors: the root it hangs under does the turning over)

## her reflection is taken from under her feet, to be moved on its own
func _refl_out_now(wid: String) -> Dictionary:
	if refl_out.is_empty():
		refl_key = W[wid].get("mir", "mir")
		var e0: Dictionary = H[refl_key]; H.erase(refl_key); refl_out = e0
	refl_w = wid
	return refl_out

## it walks a way, stone by stone. False if a newer order overtook this one
func _refl_walk_pts(e: Dictionary, pts: Array, hv, my: int, speed := 1.3) -> bool:      # hv: how high it stands, the whole way (a number) or at each point of it (a list)
	var hd: Node3D = e.holder
	(e.ap as AnimationPlayer).play("walk", 0.25); (e.ap as AnimationPlayer).speed_scale = clampf(speed / 1.1, 0.45, 2.3)
	for wi in pts.size():
		var wp: Vector3 = pts[wi]
		var h: float = float(hv[wi]) if hv is Array else float(hv)
		var d: Vector3 = wp - hd.position; d.y = 0.0
		if d.length() > 0.02:
			var want := atan2(d.x, d.z)
			var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, want), clampf(absf(angle_difference(hd.rotation.y, want)) * 0.22, 0.05, 0.4)).set_trans(Tween.TRANS_SINE)
		while refl_token == my and _flat(hd.position, wp) > 0.03:
			hd.position = hd.position.move_toward(Vector3(wp.x, h, wp.z), speed * get_process_delta_time())
			await get_tree().process_frame
		if refl_token != my: return false
	(e.ap as AnimationPlayer).play("idle", 0.4); (e.ap as AnimationPlayer).speed_scale = 1.0
	return true

## it is drawn back into the surface where it stands, and is under her feet again
func _refl_melt() -> void:
	if refl_out.is_empty(): return
	refl_token += 1
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	if _flat(hd.position, pos) > 0.25:
		var a := create_tween(); a.tween_property(hd, "scale:y", 0.02, 0.32).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
		await a.finished
		hd.position = pos; hd.rotation.y = yaw
		var b := create_tween(); b.tween_property(hd, "scale:y", 1.0, 0.32).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		await b.finished
	else:
		var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, yaw), 0.3).set_trans(Tween.TRANS_SINE)
		await rt.finished
	hd.position.y = pos.y; hd.scale = Vector3.ONE
	(e.ap as AnimationPlayer).play("walk" if walk_on else "idle", 0.3)
	H[refl_key] = e; refl_out = {}; refl_w = ""

## it has nowhere to go: it looks down at the water, and from side to side
func _refl_no(e: Dictionary) -> void:
	var hd: Node3D = e.holder; var y0 := hd.rotation.y
	var s := create_tween().set_trans(Tween.TRANS_SINE)
	s.tween_property(hd, "rotation:y", y0 + 0.4, 0.28); s.tween_property(hd, "rotation:y", y0 - 0.4, 0.5); s.tween_property(hd, "rotation:y", y0, 0.3)
	await s.finished

## her reflection goes toward a place on a water. She must stand where the floor touches the water's footing; if she
## does not, she goes to the nearest such place first. It starts from where it is; if it cannot get there from where
## it is but could from under her feet, it comes back to her first. True if it arrived at the place itself
func _refl_to(wid: String, to: Vector3) -> bool:
	refl_token += 1; var my := refl_token
	if not H.has(W[wid].get("mir", "mir")) and refl_out.is_empty(): return false
	if not refl_out.is_empty() and refl_w != wid: await _refl_melt(); refl_token += 1; my = refl_token
	if refl_out.is_empty():
		var hp := _head_point(wid)
		if _flat(pos, hp) > 0.3:
			if not walk_to(hp, PLAY_WALK): return false
			pending = ""
			while not route.is_empty() and refl_token == my: await get_tree().process_frame
			if refl_token != my or _flat(pos, hp) > 0.4: return false
		if not posing: face_to = Vector3(to.x, 0, to.z)
		if _foot_of(wid, _refl_start(wid), 0.9) == "":      # this water has nothing for it to stand on
			await _her_no()
			return false
	else:      # it is out: could it get nearer from under her feet than from where it stands?
		var here := _refl_path(wid, (refl_out.holder as Node3D).position, to)
		var hp2 := _head_point(wid)
		if _flat(pos, hp2) < 0.4:
			var home := _refl_path(wid, _refl_start(wid), to)
			if home.left < here.left - 0.3:
				await _refl_melt(); refl_token += 1; my = refl_token
	var e := _refl_out_now(wid)
	var hd: Node3D = e.holder
	var way := _refl_path(wid, hd.position, to)
	if way.pts.is_empty() or (way.pts.size() == 1 and _flat(way.pts[0], hd.position) < 0.08 and way.left > 0.25):
		await _refl_no(e)
		if refl_token == my and _flat(hd.position, pos) < 0.25: await _refl_melt()
		return false
	if not await _refl_walk_pts(e, way.pts, way.hs, my): return false
	if way.left > 0.25:
		await _refl_no(e)
		return false
	return true

## she looks down at a water that gives her reflection no footing, and shakes her head
func _her_no() -> void:
	busy = true
	var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	h.tween_property(self, "a_headp", 0.3, 0.45); h.tween_property(self, "a_hy", -0.3, 0.3); h.tween_property(self, "a_hy", 0.3, 0.45); h.tween_property(self, "a_hy", 0.0, 0.3); h.tween_property(self, "a_headp", 0.0, 0.45)
	await h.finished
	busy = false; settled.emit()

## she walks to a place by the floor's own ways, and is there
func walk(p: Vector3, cap := 1.25) -> void:
	if _flat(pos, p) < 0.06: return
	if walk_to(p, cap): await arrived

func _send_reflection(pi: int, to: Vector3, _sp: Vector2) -> void:
	if busy: return
	if flip_test or (flip_demo and WL[pi] in FLIP_DEMO_WATERS):      # (the trial) open water turns the picture over
		if not flip_busy: walk_to(_head_point(WL[pi]), PLAY_WALK)      # (the sign turns it: a tap on the water only brings her to its edge)
		return
	refl_ring.position = Vector3(to.x, 0.03, to.z); refl_p = 0.0
	hold_id = -1; route.clear(); pending = ""
	refl_busy += 1
	refl_img = true
	await _refl_to(WL[pi], to)
	refl_img = false
	if WL[pi] == "U" and hub_gust:      # the first time over a new water: a breath of wind takes the image away
		hub_gust = false
		await wait(0.9)
		await _gust()
	refl_busy -= 1

func _refl_return() -> void:
	_refl_melt()

## she walks: her reflection stays where it is on the water (it is called back when she leaves that water)
func walk_to(p: Vector3, cap := WALK) -> bool:
	var pts := find_path(pos, p)
	if pts.is_empty(): return false
	speed_cap = cap; face_to = null
	route.clear()
	for q in pts: route.append({"p": q})
	return true

func use(k: String) -> void:
	var o: Dictionary = objs[k]
	if o.has("match"):      # a wheel of the court of the still water, in the world: she turns it herself, if she can come to it and it is there
		if busy or flip_busy: return
		var st := Vector3(o.rstand.x, 0, o.rstand.z)
		if not walk_to(st, PLAY_WALK): await _her_no(); return
		busy = true
		while not route.is_empty(): await get_tree().process_frame
		if _flat(pos, st) > 0.3: busy = false; return
		if k == "mwA": busy = false; await face(N["hubA"]); await _her_no(); return      # (in the world its wheel is gone: only the water has it)
		await call("_do_" + k)
		busy = false; settled.emit(); return
	if o.has("water") and (flip_test or (flip_demo and o.water in FLIP_DEMO_WATERS)):      # (the trial) a thing in a turning water: the picture turns over first; the shadow is what does things there
		if busy or flip_busy: return
		walk_to(_head_point(o.water), PLAY_WALK)      # (she goes to the water's edge; the sign turns the world, and the shadow does the thing)
		return
	if o.has("water"):      # a thing in a water: her reflection goes to it
		if busy: return
		route.clear(); pending = ""
		refl_busy += 1
		if await _refl_to(o.water, o.rstand):
			busy = true
			await call("_do_" + k)
			busy = false; settled.emit()
		refl_busy -= 1
		return
	if not walk_to(o.stand):
		say("there is no way there yet"); return
	pending = k

func _self() -> void:
	if not refl_out.is_empty():      # a tap on her: her reflection comes back
		await _refl_melt(); return
	await super._self()

# ---------------------------------------------------------------- I.1
func tap(sp: Vector2) -> void:
	if go_demo and not started:      # (the trial played a step at a time: the eye draws back to hold the board)
		started = true
		var tg2 := create_tween(); tg2.tween_property(title_box, "modulate:a", 0.0, 0.7); tg2.tween_callback(title_box.hide)
		create_tween().tween_property(cam, "size", IV_VIEW if go_iv else _mw_view(), 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		return
	if go_demo and started and not ended and woke:
		_go_tap(sp); return
	if geo_demo and not started:      # (the trial of what the water does not show: the eye draws back to hold the whole square)
		started = true
		var tg := create_tween(); tg.tween_property(title_box, "modulate:a", 0.0, 0.7); tg.tween_callback(title_box.hide)
		create_tween().tween_property(cam, "size", GH_VIEW, 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		say("tap to walk")
		return
	if started and not ended and not woke:
		if not busy: _wake()
		return
	if geo_demo and started and not ended and woke:      # (the trial of the hall of images: a wheel, or a place, in the world or in its picture)
		_gh_tap(sp); return
	if figure_demo and started and not ended and woke:      # (the trial of the face in the water: a stone, or a place to walk to)
		_fig_tap(sp); return
	if flip_on or flip_busy:      # the turned picture: the shadow is played
		if flip_on and started and not ended: _shadow_tap(sp)
		return
	if started and not ended and not busy and flags.get("posed3", false):      # she stands as a statue on the empty place
		var px0 := get_viewport().get_visible_rect().size.x / 720.0
		if flags.get("stone3", false):      # and is stone: nothing answers but the bronze
			if _tap_dist("bronze", sp) < 70.0 * px0: _bronze()
			return
		if _water_under(sp) == null and not (not done.has("knots") and _tap_dist("knots", sp) < 64.0 * px0):
			_leave3(sp); return      # anything but an order to her reflection: she steps down first
	if started and not ended and not busy:      # of the things under the finger, the nearest one is meant
		var px := get_viewport().get_visible_rect().size.x / 720.0
		var best := ""; var bd := 64.0 * px
		for k in objs:
			if done.has(k): continue
			var d := _tap_dist(k, sp)
			if d < bd: bd = d; best = k
		if best != "":
			usering.position = Vector3(objs[best].at.x, 0.03, objs[best].at.z); use_p = 0.0
			use(best); return
	super.tap(sp)

## how far (on the screen) a tap falls from the thing k: from the line through the points it names
func _tap_dist(k: String, sp: Vector2) -> float:
	var pts := []
	for q in objs[k].get("hits", [objs[k].at]): pts.append(cam.unproject_position(q))
	var best := 1e9
	for i in pts.size() - 1:
		var a: Vector2 = pts[i]; var b: Vector2 = pts[i + 1]; var ab := b - a
		var u := clampf((sp - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		best = minf(best, sp.distance_to(a + ab * u))
	if pts.size() == 1: best = sp.distance_to(pts[0])
	return best

## the engine's own test of a tap on a thing: here the nearest thing has been chosen already
func _tap_hits(_k: String, _sp: Vector2, _px: float) -> bool:
	return false

func _wake_now() -> void:
	woke = true; posing = false; pose_k = 0.0; a_wL = 0.0; a_wR = 0.0
	pos = Vector3(0, 0, MOLE_A - 0.55); yaw = 0.0

## the first tap: the statue on the plinth lets its hands fall, looks about, and steps down toward the sea
func _wake() -> void:
	busy = true; woke = true
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 1.4); dn.tween_property(self, "a_wL", 0.0, 1.4)
	await wait(0.9)
	posing = false
	await wait(1.3)
	var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	h.tween_property(self, "a_hy", -0.8, 0.9); h.tween_interval(0.4); h.tween_property(self, "a_hy", 0.7, 1.1); h.tween_interval(0.4); h.tween_property(self, "a_hy", 0.0, 0.6)
	await h.finished
	go([Vector3(0, 0, MOLE_A - 0.55)], 0.7)
	while pos.z < HERPL.z + 0.2: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	busy = false; settled.emit()

## hands on a wheel that stands across the way one faces: each goes round with the rim for part of a turn, lets go,
## and comes back. For her reflection the wheel is the mirrored one (under the water)
func _crank_hands(hm: HerMod, hub: Vector3, n: Vector3, a: float, mirror: bool) -> void:
	var s := Vector3(n.z, 0, n.x)
	for sd in 2:
		var u := fposmod(a / 2.8 + 0.5 * sd, 1.0)
		var hold := u < 0.57
		var k := (u / 0.57) if hold else smoothstep(1.0, 0.0, (u - 0.57) / 0.43)
		var psi := (0.4 + 1.6 * k) if sd == 0 else (-2.0 + 1.6 * k)
		var off := 0.0 if hold else 0.08 * sin(PI * (u - 0.57) / 0.43)
		var pt := hub + n * (0.06 + off) + Vector3(0, 0.35 * cos(psi), 0) + s * (0.35 * sin(psi))
		if mirror: pt.y = -pt.y
		if sd == 0: hm.tL = pt
		else: hm.tR = pt

## a wheel in a water: her reflection, standing before it, turns it hand over hand; what it opens happens meanwhile
func _refl_wheel(id: String, wid: String, focus: Vector3, size: float, opens: Callable) -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var hub: Vector3 = N["hub" + id]; var hn: Vector3 = N["hubn" + id]
	var s0 := cam.size
	var want := atan2(-hn.x, -hn.z)
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, want), 0.3)
	await rt.finished
	var hm := _hermod(e)
	var wa: Node3D = N["wheel" + id]; var wm: Node3D = N["wheel" + id + "_m"]
	var crank := func(_v: float) -> void:
		var pts := _crank_pts(hub, hn, wm.rotation.x, 0.35)
		hm.tL = Vector3(pts[0].x, -pts[0].y, pts[0].z); hm.tR = Vector3(pts[1].x, -pts[1].y, pts[1].z)
	crank.call(0.0); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wL", 1.0, 0.5); hu.tween_property(hm, "wR", 1.0, 0.5); hu.tween_property(hm, "bow", 0.1, 0.5)
	await hu.finished
	var wt := create_tween().set_parallel(); wt.tween_property(wa, "rotation:x", wa.rotation.x + PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE); wt.tween_property(wm, "rotation:x", wm.rotation.x + PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE)
	wt.tween_method(crank, 0.0, 1.0, 5.2)
	await wait(1.2)
	cam_focus = focus; cam_focus_on = true
	create_tween().tween_property(cam, "size", size, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(0.9)
	await opens.call()
	if wt.is_running(): await wt.finished
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wL", 0.0, 0.5); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	await hd2.finished
	hm.own = false
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	refl_token += 1; var my := refl_token
	var back := _refl_path(wid, hd.position, pos)
	if await _refl_walk_pts(e, back.pts, back.h, my, 1.1): await _refl_melt()

## where two hands lie on a wheel of radius r that stands across the way n (toward whoever turns it), when the wheel
## has turned by a: each goes round with the rim for part of a turn, lets go, and comes back for the next hold
func _crank_pts(hub: Vector3, n: Vector3, a: float, r: float) -> Array:
	var sdir := Vector3(n.z, 0, n.x); var out := []
	for sd in 2:
		var u := fposmod(a / 2.8 + 0.5 * sd, 1.0)
		var hold := u < 0.57
		var k := (u / 0.57) if hold else smoothstep(1.0, 0.0, (u - 0.57) / 0.43)
		var psi := (0.4 + 1.6 * k) if sd == 0 else (-2.0 + 1.6 * k)
		var off := 0.0 if hold else 0.08 * sin(PI * (u - 0.57) / 0.43)
		out.append(hub + n * (0.06 + off) + Vector3(0, r * cos(psi), 0) + sdir * (r * sin(psi)))
	return out

## I.1: the wheel on the far piece of the mole. Her reflection, come along the mole the water keeps, turns it, and
## the first sluice goes down
func _do_wheel1() -> void:
	var opens := func() -> void:
		await sluice_open("s1", 2.6)
		rects["S1"].on = true; done["wheel1"] = true
	if flip_on: await _shadow_wheel("1", Vector3(0, 0.4, 2.6), opens)
	else: await _refl_wheel("1", "H", Vector3(0, 0.4, 2.6), 10.5, opens)

## I.3: the wheel behind the grille. Her reflection passes where the grille is not (in the water there is none
## there), and turns it: the grille and the sluice beyond it go down
func _do_wheel2() -> void:
	var opens := func() -> void:
		if (N["g2"] as Node3D).position.y > -2.0: create_tween().tween_property(N["g2"], "position:y", -2.1, 2.6).set_trans(Tween.TRANS_SINE)
		if (N["g2_m"] as Node3D).visible: var gq := create_tween(); gq.tween_property(N["g2_m"], "scale:y", 0.001, 2.6).set_trans(Tween.TRANS_SINE); gq.tween_callback(func() -> void: (N["g2_m"] as Node3D).visible = false)
		await sluice_open("s2", 2.8)
		rects["Tg"].on = true; rects["S2"].on = true; done["wheel2"] = true
	if flip_on: await _shadow_wheel("2", Vector3(-1.6, 0.4, -13.6), opens)
	else: await _refl_wheel("2", "T", Vector3(-1.6, 0.4, -13.6), 9.5, opens)

## I.4: the windlass of the well. She lowers the empty bucket until it touches the water; there it meets its own
## reflection, which holds the handle, and comes up with it
func _do_well() -> void:
	var hub := WELL + Vector3(WELL_R + 0.33, 1.15, BUCKET.z); var hn := Vector3(1, 0, 0)
	await face(hub)
	var hands := func(y: float) -> void:
		_bucket_set(y)
		var pts := _crank_pts(hub, hn, (N["axle"] as Node3D).rotation.x, 0.27)
		tgtL = pts[0]; tgtR = pts[1]
	hands.call(0.3)
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.7); up.tween_property(self, "a_wR", 1.0, 0.7); up.tween_property(self, "a_lean", 0.06, 0.7)
	await up.finished
	var s0 := cam.size
	cam_focus = WELL + Vector3(0.2, 0.3, 0.2); cam_focus_on = true
	create_tween().tween_property(cam, "size", 6.2, 1.6).set_trans(Tween.TRANS_SINE)
	var dn := create_tween(); dn.tween_method(hands, 0.3, 0.012, 3.4).set_trans(Tween.TRANS_SINE)
	await dn.finished
	refl_ring.position = WELL + Vector3(BUCKET.x, 0.03, BUCKET.z); refl_p = 0.0      # the bucket touches the water, and is one with what the water held
	var ck: Node3D = N["bcrank"]; ck.scale = Vector3.ONE * 0.01; ck.visible = true
	create_tween().tween_property(ck, "scale", Vector3.ONE * 0.9, 0.6).set_trans(Tween.TRANS_SINE)
	await wait(1.1)
	var rise := create_tween(); rise.tween_method(hands, 0.012, 0.5, 3.0).set_trans(Tween.TRANS_SINE)
	await rise.finished
	var off := tw(); off.tween_property(self, "a_wL", 0.0, 0.6); off.tween_property(self, "a_wR", 0.0, 0.6); off.tween_property(self, "a_lean", 0.0, 0.6)
	await off.finished
	done["well"] = true; flags["well"] = true
	await _take_crank()
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## she goes round to the bucket and takes the handle out of it
func _take_crank() -> void:
	var bk: Node3D = N["bucket"]
	await walk(objs["bucket"].stand)
	await face(Vector3(bk.position.x, 0, bk.position.z))
	tgtR = bk.position + Vector3(0.02, 0.32, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.8); a.tween_property(self, "a_lean", 0.3, 0.8); a.tween_property(self, "a_headp", 0.2, 0.8)
	await a.finished
	await wait(0.25)
	var ck: Node3D = N["bcrank"]
	var sh := create_tween(); sh.tween_property(ck, "scale", Vector3.ONE * 0.01, 0.3)
	await sh.finished
	ck.visible = false; (N["bcrank_m"] as Node3D).visible = false
	_pocket_add("crank")
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_lean", 0.0, 0.8); b.tween_property(self, "a_headp", 0.0, 0.8)
	await b.finished

func _do_bucket() -> void:
	if "crank" in pocket or done.has("post3"): return
	await _take_crank()

## I.4: the post of the third sluice. With nothing in its socket it cannot be turned; with the handle, she turns it
func _do_post3() -> void:
	await face(POST3)
	if not ("crank" in pocket):
		var h := create_tween().set_trans(Tween.TRANS_SINE); h.tween_property(self, "a_headp", 0.25, 0.4); h.tween_interval(0.8); h.tween_property(self, "a_headp", 0.0, 0.5)
		say("a square socket, and nothing to turn it by")
		await h.finished
		return
	var gr: Node3D = N["post3_gear"]; var c3: Node3D = N["crank3"]
	var grip := func() -> Vector3: return gr.global_transform * Vector3(0.25, 0.14, 0.0)
	tgtR = POST3 + Vector3(0, 1.0, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(self, "a_lean", 0.1, 0.7)
	await a.finished
	_pocket_take("crank"); c3.scale = Vector3.ONE * 0.01; c3.visible = true
	create_tween().tween_property(c3, "scale", Vector3.ONE * 0.85, 0.35)
	await wait(0.5)
	var follow := func(v: float) -> void:
		gr.rotation.y = v; tgtR = grip.call()
	var g0 := create_tween(); g0.tween_property(self, "tgtR", grip.call(), 0.35)
	await g0.finished
	var s0 := cam.size
	cam_focus = Vector3(VX0 + 0.6, 0.4, -20.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 7.6, 1.4).set_trans(Tween.TRANS_SINE)
	var tn := create_tween(); tn.tween_method(follow, 0.0, -TAU * 3.0, 5.0).set_trans(Tween.TRANS_SINE)
	await wait(1.0)
	await sluice_open("s3", 2.8)
	rects["S3"].on = true; done["post3"] = true
	if tn.is_running(): await tn.finished
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.7); b.tween_property(self, "a_lean", 0.0, 0.7)
	await b.finished
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## I.5: the arch the water shows. Her reflection goes and stands in it, and looks back at her
func _do_arch5() -> void:
	var hd: Node3D = refl_out.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, 0.0), 0.5).set_trans(Tween.TRANS_SINE)
	await rt.finished
	await wait(0.6)

## I.5: the plain wall where the water shows an arch. She lays both palms on it and pushes: the plaster cracks and
## falls, and the arch is there
func _do_wall5() -> void:
	if not refl_out.is_empty(): _refl_melt()
	await face(Vector3(ARCH_X, 0, FZ0))
	tgtL = Vector3(ARCH_X + 0.17, 1.22, FZ0 + 0.31); tgtR = Vector3(ARCH_X - 0.17, 1.22, FZ0 + 0.31)
	var a := tw(); a.tween_property(self, "a_wL", 1.0, 0.8); a.tween_property(self, "a_wR", 1.0, 0.8); a.tween_property(self, "a_lean", 0.16, 0.8)
	await a.finished
	await wait(0.5)
	var plug: Node3D = N["plug5"]; var i := 0
	for c in plug.get_children():
		var pb := c as Node3D
		var d := 0.05 * i + 0.12 * (1.0 - pb.position.y / 2.2); i += 1
		var f := create_tween().set_parallel()
		f.tween_property(pb, "position", pb.position + Vector3(0.12 * sin(i * 2.1), -2.9, 0.75 + 0.1 * cos(i * 1.7)), 0.95).set_delay(d).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		f.tween_property(pb, "rotation", Vector3(0.9 + 0.3 * sin(i), 0.2 * cos(i * 1.3), 0.25 * sin(i * 0.7)), 0.95).set_delay(d)
	await wait(0.5)
	refl_ring.position = Vector3(ARCH_X, 0.03, FPZ0 + 0.75); refl_p = 0.0
	var b := tw(); b.tween_property(self, "a_wL", 0.0, 0.8); b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_lean", 0.0, 0.8)
	await b.finished
	await wait(0.6)
	plug.visible = false
	rects["F5"].on = true; done["wall5"] = true; done["arch5"] = true; looks.erase("fwall")

## I.7: the Gate. She lays a hand on the cloth. (For now the chapter ends here.)
func _do_gate() -> void:
	await face(Vector3(GATE_X, 0, UZ0))
	tgtR = Vector3(GATE_X - 0.12, POD_H + 1.28, UZ0 + 0.93)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.9); a.tween_property(self, "a_headp", -0.2, 0.9)
	await a.finished
	quote("gate", "Barred, and covered,\nand tied on the far side.", 4.5, true)
	await wait(3.2)
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.9); b.tween_property(self, "a_headp", 0.0, 0.9)
	await b.finished
	flags["gate_seen"] = true
	if wing_open["W"] or wing_open["N"] or wing_open["S"]: return      # the three ways stand open: the chapter goes on through them
	await wait(2.0)
	_end()

# ---------------------------------------------------------------- III.2 the Gate counts statues
func _do_lampW() -> void: await _lamp3("lampW", 5)
func _do_lampE() -> void: await _lamp3("lampE", 6)

## a lamp of the Gate: she pulls its chain. The cap comes down over the flame (or goes up off it), and the glare on
## the water goes with the flame
func _lamp3(key: String, li: int) -> void:
	var c: Vector3 = N[key + "_c"]; var pull: Node3D = N[key + "_pull"]; var cap: Node3D = N[key + "_cap"]; var glow: Node3D = N[key + "_glow"]; var hl: Node3D = N[key + "_halo"]
	var on: bool = flags[key]
	await face(Vector3(c.x + 0.2, 0, UZ0))
	tgtR = pull.global_position
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.8); a.tween_property(self, "a_headp", -0.3, 0.8)
	await a.finished
	var y0 := pull.position.y
	var d := create_tween().set_trans(Tween.TRANS_SINE); d.tween_method(func(v: float) -> void:
		pull.position.y = y0 - 0.14 * v; tgtR = pull.global_position, 0.0, 1.0, 0.5)
	await d.finished
	flags[key] = not on
	var t := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	t.tween_property(cap, "position:y", c.y + (-0.02 if on else 0.2), 0.7)
	t.tween_property(glow, "scale", Vector3.ONE * (0.05 if on else 1.0), 0.7)
	t.tween_property(hl, "scale", Vector3.ONE * (0.01 if on else 1.0), 0.9)
	t.tween_method(func(v: float) -> void: lights[li] = Vector4(c.x, 0.2, c.z, v), 0.5 if on else 0.0, 0.0 if on else 0.5, 0.9)
	_u_glares(1.0)
	await t.finished
	var u := create_tween().set_trans(Tween.TRANS_SINE); u.tween_method(func(v: float) -> void:
		pull.position.y = y0 - 0.14 * (1.0 - v); tgtR = pull.global_position, 0.0, 1.0, 0.5)
	await u.finished
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_headp", 0.0, 0.8)
	await b.finished
	_u_foot()

## the statue that holds a stone: she turns the crank of its post, and it turns a quarter: the stone over the
## landing's edge (in the water: into the cleft), or away again
func _do_turn3() -> void:
	var p3 := TURN3 + Vector3(-0.47, 0, 0); var pt: Node3D = N["p3_top"]; var pg: Node3D = N["p3_gear"]
	var to_in: bool = not flags["turn3"]
	await face(p3)
	if not to_in and not refl_out.is_empty() and refl_w == "U" and _foot_of("U", (refl_out.holder as Node3D).position, 0.1) == "slab": await _refl_melt()
	var grip := func() -> Vector3: return pt.global_transform * Vector3(0.25, 0.14, 0.0)
	tgtR = grip.call()
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(self, "a_lean", 0.1, 0.7)
	await a.finished
	var s0 := cam.size
	cam_focus = TURN3 + Vector3(0.9, 0.5, 1.0); cam_focus_on = true
	create_tween().tween_property(cam, "size", 8.0, 1.2).set_trans(Tween.TRANS_SINE)
	var yin: float = N["turn3_in"]; var y_from: float = (N["turn3"] as Node3D).rotation.y; var y_to := yin if to_in else yin + PI * 0.5
	var t0 := pt.rotation.y
	var tn := create_tween().set_trans(Tween.TRANS_SINE); tn.tween_method(func(v: float) -> void:
		var y := lerpf(y_from, y_to, v)
		(N["turn3"] as Node3D).rotation.y = y; (N["turn3_m"] as Node3D).rotation.y = y; (N["turn3_tt"] as Node3D).rotation.y = y
		pt.rotation.y = t0 + v * TAU * 2.0 * (-1.0 if to_in else 1.0); pg.rotation.y = pt.rotation.y
		tgtR = grip.call(), 0.0, 1.0, 3.4)
	await tn.finished
	flags["turn3"] = to_in
	_u_foot()
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.7); b.tween_property(self, "a_lean", 0.0, 0.7)
	await b.finished
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.2).set_trans(Tween.TRANS_SINE)

## the bar of the Gate goes up off its hooks (her weight is on the plinth) or comes down again; the cords with it
func _bar3(up: bool) -> void:
	var t := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	for sfx in ["", "_m"]:
		t.tween_property(N["bar" + sfx], "position:y", 2.95 if up else 2.5, 1.4)
		for i in 3:
			if not flags.get("untied", false): t.tween_property(N["cord%d%s" % [i, sfx]], "position:y", [2.05, 2.85, 3.65][i] - (0.07 if up else 0.0), 1.4)
	await t.finished

## the empty place of the row: she steps up and takes the stance. The chain draws tight and the bar lifts. She stays
## so until something else is asked of her
func _do_place3() -> void:
	var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	var s0 := cam.size
	cam_focus = Vector3(GATE_X + 1.4, 0.8, -39.4); cam_focus_on = true
	create_tween().tween_property(cam, "size", 12.0, 1.6).set_trans(Tween.TRANS_SINE)
	go([pl], 0.8)
	while pos.x < pl.x - 0.48: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.17, 0.45).set_trans(Tween.TRANS_SINE)
	await arrived
	await face(pl + Vector3(3.0, 0, 0))
	await wait(0.5)
	tgtL = pl + Vector3(0.21, 1.61, -0.03); tgtR = pl + Vector3(0.21, 1.61, 0.03)
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.2); up.tween_property(self, "a_wL", 1.0, 1.2)
	await up.finished
	posing = true; flags["posed3"] = true
	await _bar3(true)
	await wait(0.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## she steps down from the place (the bar comes down again), and then the tap that asked for it is taken
func _leave3(sp: Vector2) -> void:
	busy = true
	posing = false; flags["posed3"] = false
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.7); dn.tween_property(self, "a_wL", 0.0, 0.7)
	_bar3(false)
	await dn.finished
	var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	go([pl + Vector3(-0.72, 0, 0)], 0.8)
	while pos.x > pl.x - 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	busy = false; settled.emit()
	tap(sp)

## the knots, on the far side of the Gate: her reflection has come round to them through the breach. While the bar
## hangs on the cords they are tight as stone; when the bar is lifted they come away one by one, and the cloth falls
func _do_knots() -> void:
	var s0 := cam.size
	cam_focus = Vector3(GATE_X + 1.2, 1.8, UZ0 + 2.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 9.5, 1.4).set_trans(Tween.TRANS_SINE)
	await wait(1.0)
	if not flags.get("posed3", false):
		for k in 2:      # it pulls: the cord jumps, and holds
			var tw2 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
			for sfx in ["", "_m"]: tw2.tween_property(N["cord0" + sfx], "position:z", UZ0 + 0.965, 0.12)
			await tw2.finished
			var tw3 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
			for sfx in ["", "_m"]: tw3.tween_property(N["cord0" + sfx], "position:z", UZ0 + 1.0, 0.3)
			await tw3.finished
			await wait(0.25)
		say("the knots hold. the bar hangs on them")
		await wait(1.6)
		cam_focus_on = false
		create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
		return
	flags["untied"] = true
	for i in 3:      # one by one
		var j := 2 - i
		var pull := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
		for sfx in ["", "_m"]: pull.tween_property(N["cord%d%s" % [j, sfx]], "position:z", UZ0 + 0.95, 0.15)
		await pull.finished
		var fall := create_tween().set_parallel().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		for sfx in ["", "_m"]:
			fall.tween_property(N["cord%d%s" % [j, sfx]], "position:y", POD_H + 0.02, 0.55 + 0.12 * j); fall.tween_property(N["cord%d%s" % [j, sfx]], "position:z", UZ0 + 1.12, 0.55 + 0.12 * j)
		await fall.finished
		await wait(0.45)
	done["knots"] = true
	await _veil_fall()
	cam_focus = Vector3(ROW3_X + 2.2, 0.6, ROW3_Z[HERS3] + 0.4)
	create_tween().tween_property(cam, "size", 8.6, 1.8).set_trans(Tween.TRANS_SINE)
	await wait(2.0)
	cam_focus_on = false

## the cloth slides off the Gate, over the landing's edge into the basin, and spreads on the water. The water is
## covered: it shows nothing, her reflection is cut off behind the Gate, and she is stone on her plinth
func _veil_fall() -> void:
	var veil: Node3D = N["veil"]; var fcl: Node3D = N["u_cloth"]; var lvl: float = N["U_level"]
	(N["veil_m"] as Node3D).visible = false
	fcl.position = Vector3(GATE_X + 0.3, lvl + 0.03, LAND_Z + 0.5); fcl.scale = Vector3.ONE * 0.05; fcl.visible = true
	var t := create_tween().set_parallel()
	t.tween_property(veil, "position:y", POD_H + 0.5, 1.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.tween_property(veil, "scale:y", 0.12, 1.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.tween_property(veil, "position:z", LAND_Z - 0.1, 1.5).set_trans(Tween.TRANS_SINE)
	await t.finished
	var t2 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	t2.tween_property(veil, "scale", Vector3(0.3, 0.02, 0.3), 1.2); t2.tween_property(veil, "position:y", lvl + 0.1, 1.2); t2.tween_property(veil, "position:z", LAND_Z + 0.5, 1.2)
	t2.tween_property(fcl, "scale", Vector3.ONE * 1.4, 1.2)
	await t2.finished
	veil.visible = false
	flags["stone3"] = true; W["U"].wet = false; done.erase("bronze")
	for key in ["lampW", "lampE"]: create_tween().tween_property(N[key + "_glare_m"], "albedo_color:a", 0.0, 1.0)
	var t3 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	t3.tween_property(fcl, "scale", Vector3.ONE * (UBR - 0.12), 3.6); t3.tween_property(fcl, "position", Vector3(UB.x, lvl + 0.03, UB.z), 3.6)
	await t3.finished

## the Gate, uncovered, is polished bronze. In it her image comes nearer from the far side, and pushes: the leaves
## open. Then the cloth is drawn under the water and handed up to her at the foot of her plinth; she wakes
func _bronze() -> void:
	busy = true
	var s0 := cam.size
	cam_focus = Vector3(GATE_X + 1.0, 2.0, UZ0 + 2.4); cam_focus_on = true
	create_tween().tween_property(cam, "size", 8.2, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.2)
	var img: Node3D = N["bronze_img"]; var iap: AnimationPlayer = N["bronze_ap"]
	img.scale = Vector3(0.28, 0.28, 0.012); img.visible = true
	if iap != null: iap.play("walk")
	var ap := create_tween().set_trans(Tween.TRANS_SINE); ap.tween_property(img, "scale", Vector3(0.96, 0.96, 0.03), 3.2)
	await ap.finished
	if iap != null: iap.play("idle", 0.4)
	await wait(0.7)
	var op := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)      # it pushes: the bar is thrown off, the leaves swing in
	for sfx in ["", "_m"]:
		op.tween_property(N["bar" + sfx], "rotation:z", -1.45, 1.6)
		op.tween_property(N["leafL" + sfx], "rotation:y", 1.42, 3.0).set_delay(0.5); op.tween_property(N["leafR" + sfx], "rotation:y", -1.42, 3.0).set_delay(0.5)
	op.tween_property(img, "scale:x", 0.01, 1.4).set_delay(0.6)
	await op.finished
	img.visible = false
	rects["Ugate"].on = true; flags["gate_open"] = true; done["gate"] = true; done["bronze"] = true; done.erase("through")
	await wait(0.6)
	# the cloth goes under, drawn toward her; the water is a mirror again and her reflection is under her feet
	var fcl: Node3D = N["u_cloth"]; var lvl: float = N["U_level"]; var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	var rim := Vector3(UB.x - UBR + 0.25, lvl, pl.z)
	cam_focus = pl + Vector3(1.6, 0.6, 0.6)
	create_tween().tween_property(cam, "size", 7.4, 1.8).set_trans(Tween.TRANS_SINE)
	var dr := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	dr.tween_property(fcl, "scale", Vector3.ONE * 0.12, 2.6); dr.tween_property(fcl, "position", rim + Vector3(0, 0.03, 0), 2.6)
	await dr.finished
	var sk := create_tween(); sk.tween_property(fcl, "position:y", lvl - 0.25, 0.6)
	await sk.finished
	fcl.visible = false
	W["U"].wet = true; flags["stone3"] = false
	if not refl_out.is_empty():
		refl_token += 1
		var e: Dictionary = refl_out; var hd: Node3D = e.holder
		hd.position = pos; hd.rotation.y = yaw; hd.scale = Vector3(1, 0.02, 1)
		H[refl_key] = e; refl_out = {}; refl_w = ""
		(e.ap as AnimationPlayer).play("idle", 0.3)
		var b0 := create_tween(); b0.tween_property(hd, "scale:y", 1.0, 0.5).set_trans(Tween.TRANS_SINE)
		await b0.finished
	_u_glares(1.0)
	# from hand to hand
	var fold: Node3D = N["cloth_fold"]
	fold.position = rim + Vector3(0, -0.05, 0); fold.scale = Vector3.ONE * 0.05; fold.visible = true
	var ri := create_tween().set_parallel().set_trans(Tween.TRANS_SINE); ri.tween_property(fold, "scale", Vector3.ONE, 0.6); ri.tween_property(fold, "position", pl + Vector3(0.42, 1.05, 0.05), 1.6)
	posing = false; flags["posed3"] = false
	tgtR = pl + Vector3(0.42, 1.08, 0.05)
	var dn := tw(); dn.tween_property(self, "a_wL", 0.0, 0.9); dn.tween_property(self, "a_headp", 0.25, 0.9)
	await ri.finished
	await wait(0.3)
	var tk := create_tween(); tk.tween_property(fold, "scale", Vector3.ONE * 0.02, 0.4)
	await tk.finished
	fold.visible = false
	_pocket_add("cloth")
	var hb := tw(); hb.tween_property(self, "a_wR", 0.0, 0.8); hb.tween_property(self, "a_headp", 0.0, 0.8)
	await hb.finished
	go([pl + Vector3(-0.72, 0, 0)], 0.8)
	while pos.x > pl.x - 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	done["place3"] = true
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.6).set_trans(Tween.TRANS_SINE)
	busy = false; settled.emit()
	print("GATE open; pocket ", pocket)

## the open Gate: she goes through
func _do_through() -> void:
	pass

## III.5: the basin overflows into the great channel, and the eye follows the water down past every gate she opened,
## to the shore where she woke
func _ch1_finale() -> void:
	busy = true; route.clear(); pending = ""
	var ways := [[Vector3(UB.x + UBR, 0, UB.z), Vector3(-17.5, 0, UB.z), Vector3(-17.5, 0, DOOR6.z), Vector3(GX0 + 1.25, 0, DOOR6.z), Vector3(GX0 + 1.25, 0, GZ1 - 1.0), Vector3(ARCH_X, 0, GZ1 - 1.0), Vector3(ARCH_X, 0, FPZ0)],
		[Vector3(ARCH_X, 0, FPZ1), Vector3(ARCH_X, 0, -20.8), Vector3(WELL.x - WELL_R, 0, -20.8)],
		[Vector3(-2.05, 0, WELL.z + WELL_R), Vector3(-2.05, 0, TZ0), Vector3(-2.3, 0, TZ0), Vector3(-2.3, 0, TZ1 - 0.62), Vector3(0, 0, TZ1 - 0.62), Vector3(0, 0, BZ0)]]
	cam_focus = UB; cam_focus_on = true
	create_tween().tween_property(cam, "size", 13.0, 2.0).set_trans(Tween.TRANS_SINE)
	await wait(2.2)
	var speed := 5.0
	for way in ways:
		var ct := create_tween()
		for i in range(1, way.size()): ct.tween_property(self, "cam_focus", way[i], (way[i] as Vector3).distance_to(way[i - 1]) / speed)
		await chan_run(way, speed)
		await wait(0.5)
	cam_focus = Vector3(0, 0, BZ0 + 3.0)
	create_tween().tween_property(cam, "size", 16.0, 3.0).set_trans(Tween.TRANS_SINE)
	await wait(1.5)
	quote("fin", "The water has found the sea again.", 5.0, true)
	await wait(5.5)
	_end()

## I.6: the statue that stands, in the water, on the plinth that is empty above. Her reflection goes up to it, looks
## at it, and looks back at her
func _do_place6w() -> void:
	var hd: Node3D = refl_out.holder
	var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
	var rt := create_tween().set_trans(Tween.TRANS_SINE)
	rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(pl.x - hd.position.x, pl.z - hd.position.z)), 0.5); rt.tween_interval(1.1)
	await rt.finished
	var rb := create_tween().set_trans(Tween.TRANS_SINE)
	rb.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(pos.x - hd.position.x, pos.z - hd.position.z)), 0.6); rb.tween_interval(0.5)
	await rb.finished

## I.6: the empty plinth. She steps up onto it, turns to the pool, brings her hands together as the statue in the
## water holds them, and is still: the rows are whole, and the great door goes down
func _do_place6() -> void:
	var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
	if not refl_out.is_empty(): await _refl_melt()
	var s0 := cam.size
	cam_focus = pl + Vector3(-0.8, 0.3, 1.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 7.2, 1.6).set_trans(Tween.TRANS_SINE)
	go([pl], 0.8)
	while pos.z < pl.z - 0.48: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.17, 0.45).set_trans(Tween.TRANS_SINE)
	await arrived
	(N["place6_m"] as Node3D).visible = false      # the statue the water showed there was her: her own reflection stands in its place now
	await wait(0.3)
	await face(pl + Vector3(0, 0, 3.0))
	await wait(0.8)
	tgtL = pl + Vector3(0.03, 1.61, 0.21); tgtR = pl + Vector3(-0.03, 1.61, 0.21)
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.2); up.tween_property(self, "a_wL", 1.0, 1.2)
	await up.finished
	await wait(0.3)
	posing = true
	await wait(2.2)
	cam_focus = Vector3(GX0 + 2.6, 0.6, DOOR6.z + 0.6)
	create_tween().tween_property(cam, "size", 9.6, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.4)
	await sluice_open("door6", 3.0)
	rects["D6"].on = true; done["place6"] = true; done["place6w"] = true
	await wait(0.7)
	cam_focus = pl + Vector3(-0.8, 0.3, 1.6)
	posing = false
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.8); dn.tween_property(self, "a_wL", 0.0, 0.8)
	await dn.finished
	await wait(0.3)
	go([pl + Vector3(0, 0, -0.72)], 0.8)
	while pos.z > pl.z - 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

# ---------------------------------------------------------------- frame, and the runs that try the chapter
func _process(dt: float) -> void:
	if geo_demo: _gh_pre(dt)
	if go_demo: _go_pre(dt)
	if flip_moving: _flip_pre()
	super._process(dt)
	if flip_moving: _flip_post()
	if flip_icon != null: _flip_icon_frame(dt)
	_smoke_frame(dt)
	if flip_on and not flip_busy and not flip_homing and _flat(pos, flip_anchor) > FLIP_LEASH: _shadow_home()      # too far from her
	if figure_demo: _fig_frame(dt)
	if geo_demo: _gh_post(dt)
	if go_demo: _go_post(dt)
	if match_demo and not ended and not flip_on and not flip_busy and pos.z > MT_Z1 + 0.7: route.clear(); _end()
	if flip_demo and not ended and not busy and not flip_busy and not flip_on and rects.has("S2") and rects["S2"].on and pos.z < TZ0 - 0.9: route.clear(); _end()      # (the trial ends behind the second sluice)
	if not flip_on and not flip_busy and woke: _stele_watch()
	if flip_on or flip_busy: return      # (the shadow is played: her image stays with her, and the floor's own rules are not the shadow's)
	if not refl_out.is_empty() and not busy and refl_w != "" and _rect_dist(pos, W[refl_w].r) > float(W[refl_w].get("far", 3.2)): _refl_melt()      # she has left that water
	var inside := false
	for c in cs_courts:
		if pos.x > c[0] and pos.x < c[2] and pos.z > c[1] and pos.z < c[3]: inside = true
	if H.has("mir") and not go_demo: (H["mir"].holder as Node3D).visible = not inside      # in a court whose water lies below the floor, that water's own body mirrors her (not in the GO trial: there she has only her dark image on the sea)
	for k in H:      # and such a body shows only in its own water's court: everywhere else it lay under her other image, one body below another
		if not String(k).begins_with("mir_"): continue
		var wr = N.get(String(k).substr(4) + "_rect")
		if wr == null: continue
		var own := false
		for c in cs_courts:
			if wr[0] >= c[0] - 0.01 and wr[2] <= c[2] + 0.01 and wr[1] >= c[1] - 0.01 and wr[3] <= c[3] + 0.01 and pos.x > c[0] and pos.x < c[2] and pos.z > c[1] and pos.z < c[3]: own = true
		(H[k].holder as Node3D).visible = own
	if not hub_pending.is_empty() and not hub_busy and not busy and woke and pos.x > UX0 + 0.6 and pos.x < UX1 - 0.4 and pos.z > UZ0 and pos.z < UZ1: _hub_fill(hub_pending.pop_front())
	if flags.get("gate_open", false) and not beyond and not ended and not flags.get("fin", false) and pos.z < UZ0 - 0.15: flags["fin"] = true; _ch1_finale()
	var fy = _floor_y(pos)      # the stair and the podium: she stands as high as the floor is there
	if fy != null: pos.y = fy; on_ramp = true
	elif on_ramp: pos.y = 0.0; on_ramp = false

## how high the floor is at a place, where it is not level (null: level floor)
func _floor_y(p: Vector3):
	for rp in ramps:
		if rp.r.on and in_rect(rp.r, p): return lerpf(rp.y0, rp.y1, clampf(((p.x if rp.get("ax", "z") == "x" else p.z) - rp.z0) / (rp.z1 - rp.z0), 0.0, 1.0))
	return null

## a tap on floor that stands higher than the rest names a place on it
func _ground_under(sp: Vector2):
	var o := cam.project_ray_origin(sp); var d := cam.project_ray_normal(sp)
	for rp in ramps:
		for y in [rp.y0, (rp.y0 + rp.y1) * 0.5, rp.y1]:
			var g: Vector3 = o + d * ((float(y) - o.y) / d.y)
			if rp.r.on and in_rect(rp.r, g) and absf(float(_floor_y(g)) - float(y)) < 0.16: return Vector3(g.x, 0, g.z)
	return super._ground_under(sp)

func _ready() -> void:
	super._ready()
	var args := OS.get_cmdline_user_args()
	_flip_setup()
	if match_demo: _match_begin()
	if figure_demo: _fig_begin()
	if geo_demo: _gh_begin()
	if "geodemo" in args: hand_play = true; _play_geo()
	if go_demo: _go_begin()
	if "godemo" in args: hand_play = true; _play_go()
	if "figuredemo" in args: hand_play = true; _play_figure()
	if "matchdemo" in args: hand_play = true; _play_match()
	if "flipdemo" in args: hand_play = true; _play_flipdemo()
	if "views" in args: _views()
	if "act1" in args: _play_act1()
	if OS.get_environment("HUB") != "": _hub_instant(int(OS.get_environment("HUB")))
	if "hub" in args: _play_hub()
	if "gate" in args: _play_gate()
	if OS.get_environment("GATE_AT") != "": _gate_state(int(OS.get_environment("GATE_AT")))
	if OS.get_environment("PATHCHK") != "":      # (a check of the floor's ways: "x,z,x,z")
		var pc := OS.get_environment("PATHCHK").split(",")
		print("PATH ", find_path(Vector3(float(pc[0]), 0, float(pc[1])), Vector3(float(pc[2]), 0, float(pc[3]))).size(), " points")

## stills. VIEWS="name,cx,cz,size[,px,pz,yaw];..." : the middle of the view on the ground, how many metres it holds
## across, and where she stands (away from everything, if not given)
func _views() -> void:
	started = true; title_box.hide(); hint.hide()
	if not woke: _wake_now()
	var dir := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(float(OS.get_environment("VIEW_WAIT")) if OS.get_environment("VIEW_WAIT") != "" else 2.0).timeout
	for at in OS.get_environment("VIEWS").split(";", false):
		var f := at.split(",")
		var sh := {"n": f[0], "c": Vector3(float(f[1]), 0.4, float(f[2])), "s": float(f[3])}
		shot = sh
		route.clear(); cam.size = sh.s
		pos = Vector3(float(f[4]), 0, float(f[5])) if f.size() > 5 else Vector3(90, 0, 90)
		yaw = float(f[6]) if f.size() > 6 else 0.0
		cam_t = pos
		await get_tree().create_timer(1.2).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, sh.n])
		print("VIEW ", sh.n)
	get_tree().quit()

func _tap_at(p: Vector3) -> void:
	tap(cam.unproject_position(p))

## (the runs) a tap, and then until nothing is happening any more
func _tap_wait(p: Vector3) -> void:
	_tap_at(p)
	var still := 0
	while still < 12:
		await get_tree().process_frame
		still = still + 1 if (not busy and route.is_empty() and pending == "" and refl_busy == 0) else 0

## the first act played by taps, as a player would: prints what happens
func _play_act1() -> void:
	var from := OS.get_environment("FROM")
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)      # the title
	if from == "":
		tap(Vector2(360, 640))      # she wakes
		await settled
		print("ACT1 woke at ", pos)
		_tap_at(Vector3(1.6, 0, 6.0))      # open water: it goes as near as it can along the mole
		await wait(6.0)
		print("ACT1 I.1 reflection sent to open water stands at ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
		var hub: Vector3 = N["hub1"]
		await _tap_wait(Vector3(hub.x, -hub.y, hub.z))      # the wheel in the water
		print("ACT1 I.1 wheel ", done.has("wheel1"), " sluice ", rects["S1"].on, " reflection ", "out" if not refl_out.is_empty() else "under her")
	else:
		_wake_now(); _open_to(from)
	if from in ["", "T"]:
		await _tap_wait(Vector3(-2.3, 0, -9.0))
		print("ACT1 I.3 on the walk at ", pos)
		var h2: Vector3 = N["hub2"]
		_tap_at(Vector3(h2.x, -h2.y, h2.z))      # the wheel in the water, from before the water's grille: it is stopped there
		await wait(7.0)
		print("ACT1 I.3 first try: wheel ", done.has("wheel2"), ", reflection at ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
		await _tap_wait(Vector3(-2.3, 0, TG_REAL + 0.6))      # she walks on, past where the water's grille stands
		await _tap_wait(Vector3(h2.x, -h2.y, h2.z))
		print("ACT1 I.3 second try: wheel ", done.has("wheel2"), " grille ", rects["Tg"].on, " sluice ", rects["S2"].on)
	if from in ["", "T", "V"]:
		await _tap_wait(Vector3(-2.05, 0, VZ1 - 1.0))
		await _tap_wait(POST3 + Vector3(0, 0.6, 0))
		print("ACT1 I.4 post without the handle: done ", done.has("post3"), " at ", pos)
		await _tap_wait(WELL + Vector3(0.2, 0.012, 0.25))      # the water of the well
		print("ACT1 I.4 tapped the well's water: reflection ", "out" if not refl_out.is_empty() else "under her", " at ", pos)
		await _tap_wait(objs["well"].at)
		print("ACT1 I.4 well ", done.has("well"), " pocket ", pocket)
		await _tap_wait(POST3 + Vector3(0, 0.6, 0))
		print("ACT1 I.4 post with the handle: done ", done.has("post3"), " sluice ", rects["S3"].on, " pocket ", pocket)
	if from in ["", "T", "V", "F"]:
		await _tap_wait(Vector3(FX1 - 0.9, 0, -20.8))
		await _tap_wait(Vector3(ARCH_X, -1.0, FZ0 + 0.3))      # the arch in the water
		print("ACT1 I.5 reflection in the arch: ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her", " she at ", pos)
		await _tap_wait(Vector3(ARCH_X, 1.0, FZ0 + 0.3))      # the wall
		print("ACT1 I.5 wall ", done.has("wall5"), " way through ", rects["F5"].on, " she at ", pos)
	if from != "U":
		await _tap_wait(Vector3(ARCH_X, 0, GZ1 - 1.0))
		var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
		await _tap_wait(pl + Vector3(0, -1.0, 0))      # the statue in the water
		print("ACT1 I.6 reflection by the statue of the water: ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her", " she at ", pos)
		await _tap_wait(pl + Vector3(0, 0.3, 0))      # the empty plinth
		print("ACT1 I.6 place ", done.has("place6"), " door ", rects["D6"].on, " she at ", pos)
	await _tap_wait(Vector3(UX1 - 2.0, 0, DOOR6.z))
	print("ACT1 I.7 in the atrium at ", pos)
	await _tap_wait(Vector3(GATE_X, POD_H + 1.6, UZ0 + 0.9))
	print("ACT1 I.7 at the gate: ", pos, " ended ", ended)
	get_tree().quit()

## (to try a later court) everything before it is done, and she stands at its entry
## the run that tries the atrium's water: each wing's water in turn, and how far her reflection gets toward the Gate
func _play_hub() -> void:
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)
	_wake_now(); _open_to("U")
	await wait(1.0)
	for id in ["W", "S", "N"]:
		_wing_done(id)
		while hub_pending.size() > 0 or hub_busy: await get_tree().process_frame
		await wait(0.5)
		await _tap_wait(Vector3(UB.x - 1.0, float(N["U_level"]), UB.z - 1.0))      # the water, toward the Gate
		print("HUB ", id, " reflection ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her", " she at ", pos)
		await wait(4.5)
		await _tap_wait(Vector3(GATE_X + 1.0, POD_H - 2.0 * (POD_H - float(N["U_level"])), LAND_Z - 0.3))      # the landing, as the water shows it
		print("HUB ", id, " to the landing: reflection ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
	get_tree().quit()

## (for stills) the Gate's puzzle as it stands after so many of its steps: 1 the lamps capped and the stone turned in,
## 2 she on the empty place and the bar up, 3 the cloth on the water, 4 the Gate open
func _gate_state(n: int) -> void:
	_hub_instant(3)
	var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3]); var lvl: float = N["U_level"]
	if n >= 1:
		var li := 5
		for key in ["lampW", "lampE"]:
			var c: Vector3 = N[key + "_c"]
			flags[key] = false; (N[key + "_cap"] as Node3D).position.y = c.y - 0.02; (N[key + "_glow"] as Node3D).scale = Vector3.ONE * 0.05; (N[key + "_halo"] as Node3D).scale = Vector3.ONE * 0.01
			lights[li] = Vector4(c.x, 0.2, c.z, 0.0); li += 1
		for k in ["turn3", "turn3_m", "turn3_tt"]: (N[k] as Node3D).rotation.y = N["turn3_in"]
		flags["turn3"] = true
	if n >= 2:
		_wake_now(); pos = pl + Vector3(0, 0.17, 0); yaw = PI * 0.5; cam_t = pos
		tgtL = pl + Vector3(0.21, 1.61, -0.03); tgtR = pl + Vector3(0.21, 1.61, 0.03); a_wL = 1.0; a_wR = 1.0; posing = true; flags["posed3"] = true
		for sfx in ["", "_m"]: (N["bar" + sfx] as Node3D).position.y = 2.95
	if n >= 3:
		flags["untied"] = true; done["knots"] = true
		for sfx in ["", "_m"]:
			for i in 3: (N["cord%d%s" % [i, sfx]] as Node3D).position = Vector3(GATE_X, POD_H + 0.02, UZ0 + 1.12)
			(N["veil" + sfx] as Node3D).visible = false
		var fcl: Node3D = N["u_cloth"]; fcl.position = Vector3(UB.x, lvl + 0.03, UB.z); fcl.scale = Vector3.ONE * (UBR - 0.12); fcl.visible = true
		flags["stone3"] = true; W["U"].wet = false; done.erase("bronze")
	if n >= 4:
		for sfx in ["", "_m"]:
			(N["bar" + sfx] as Node3D).rotation.z = -1.45; (N["leafL" + sfx] as Node3D).rotation.y = 1.42; (N["leafR" + sfx] as Node3D).rotation.y = -1.42
		(N["u_cloth"] as Node3D).visible = false; W["U"].wet = true; flags["stone3"] = false; posing = false; flags["posed3"] = false; a_wL = 0.0; a_wR = 0.0
		pos = pl + Vector3(-0.72, 0, 0); rects["Ugate"].on = true; flags["gate_open"] = true; done["gate"] = true; done["bronze"] = true; done.erase("through")
		_pocket_add("cloth")
	_u_foot(); _u_glares(0.1)

## the run that tries the Gate: the obvious plans first, then the way that works
func _play_gate() -> void:
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)
	_wake_now(); _open_to("U"); _hub_instant(3)
	await wait(1.0)
	var rp := func() -> String: return str((refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01)) if not refl_out.is_empty() else "under her"
	var knots := Vector3(GATE_X, -2.9, UZ0 + 1.0)
	await _tap_wait(knots)
	print("GATE 1 knots with the lamps burning: reflection ", rp.call())
	await _tap_wait(N["lampE_c"]); await _tap_wait(N["lampW_c"])
	print("GATE 2 lamps capped: E ", flags["lampE"], " W ", flags["lampW"], " she at ", pos)
	await _tap_wait(knots)
	print("GATE 3 knots with the cleft open: reflection ", rp.call())
	await _tap_wait(TURN3 + Vector3(0, 1.0, 0))
	print("GATE 4 the stone turned in: ", flags["turn3"], " she at ", pos)
	await _tap_wait(knots)
	print("GATE 5 knots with the bar down: reflection ", rp.call(), " untied ", flags.get("untied", false))
	await _tap_wait(Vector3(ROW3_X, 0.3, ROW3_Z[HERS3]))
	print("GATE 6 on the plinth: posed ", flags.get("posed3", false), " bar at ", (N["bar"] as Node3D).position.y)
	await _tap_wait(knots)
	print("GATE 7 knots with the bar up: untied ", flags.get("untied", false), " stone ", flags.get("stone3", false))
	await _tap_wait(Vector3(UX1 - 3.0, 0, UZ1 - 3.0))
	print("GATE 8 a tap on the floor: she at ", pos)
	await _tap_wait(Vector3(GATE_X, POD_H + 1.4, UZ0 + 0.45))
	print("GATE 9 the bronze: open ", flags.get("gate_open", false), " pocket ", pocket, " she at ", pos)
	_tap_at(Vector3(GATE_X, POD_H + 1.2, UZ0 + 0.4))
	while not flags.get("fin", false): await get_tree().process_frame
	print("GATE 10 through: she at ", pos, " fin ", flags.get("fin", false))
	while not ended: await get_tree().process_frame
	print("GATE ended ", ended)
	get_tree().quit()

func _open_to(c: String) -> void:
	var order := ["T", "V", "F", "G", "U"]; var k := order.find(c)
	rects["S1"].on = true; (N["s1"] as Node3D).position.y = -1.75; done["wheel1"] = true
	pos = Vector3(0, 0, TZ1 + 0.5); yaw = PI
	if k >= 1:
		rects["Tg"].on = true; rects["S2"].on = true; done["wheel2"] = true; (N["g2"] as Node3D).position.y = -2.1; (N["s2"] as Node3D).position.y = -1.75
		pos = Vector3(-2.05, 0, TZ0 - 0.6)
	if k >= 2:
		rects["S3"].on = true; done["post3"] = true; done["well"] = true; (N["s3"] as Node3D).position.y = -1.75
		pos = Vector3(VX0 - 0.6, 0, -20.8); yaw = -PI * 0.5
	if k >= 3:
		rects["F5"].on = true; done["wall5"] = true; done["arch5"] = true; (N["plug5"] as Node3D).visible = false
		pos = Vector3(ARCH_X, 0, FZ0 - 0.6); yaw = PI
	if k >= 4:
		rects["D6"].on = true; done["place6"] = true; done["place6w"] = true; (N["door6"] as Node3D).position.y = -2.4; (N["place6_m"] as Node3D).visible = false
		pos = Vector3(UX1 - 1.6, 0, DOOR6.z); yaw = -PI * 0.5
	cam_t = pos
