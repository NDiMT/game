class_name Palette
extends RefCounted
## v0.8 the two-colour glow language (owner approved). Every glow in the game is one of two lights:
##  AQUA, "your world": runes and inscriptions, your hem stripe and cloak runes, your goal sigils and
##    light pillars, the beam and its floor light, the votive flames, UI accents, the see-through rim,
##    the wisp hints.
##  ROSE-MAGENTA, "her, the other side": her writing on the glass, her footprints, her reflection's hem
##    stripe and hood rune, the path stones in the pool's reflection (aqua once they are real), her
##    glass's plates and her world's stands, the Eidolon plate on her side, her lines in the cinematic.
## Both GLOW: a bright core, a soft bloom halo, a quiet tint at the edge (never a fill). On pale marble
## and fog the contrast comes from luminance: small luminous lines, soft halos, no saturated areas.
## Shaders read them as global uniforms: `accent` / `accent_core` / `accent_tint` (aqua) and `her` /
## `her_core` / `her_tint` (rose), pushed from here at start-up. (A late reveal may swap them: swap().)

const CORE := Color("B6FFF6")          # aqua: the light inside a carved line
const ACCENT := Color("46E6D8")        # aqua: the glow, bloom, rings, UI accents
const TINT := Color("1FA9A0")          # aqua: the quiet edge of a glow, never a fill
const ACCENT_DEEP := TINT
const HER_CORE := Color("FFD1F0")      # rose: the light inside her lines
const HER := Color("FF4FB8")           # rose-magenta: her glow
const HER_TINT := Color("C2368E")      # rose: the quiet edge of her glow

static var swapped := false

static func push() -> void:
	var y := [CORE, ACCENT, TINT]
	var h := [HER_CORE, HER, HER_TINT]
	if swapped:
		var t := y; y = h; h = t
	RenderingServer.global_shader_parameter_set("accent_core", y[0])
	RenderingServer.global_shader_parameter_set("accent", y[1])
	RenderingServer.global_shader_parameter_set("accent_tint", y[2])
	RenderingServer.global_shader_parameter_set("her_core", h[0])
	RenderingServer.global_shader_parameter_set("her", h[1])
	RenderingServer.global_shader_parameter_set("her_tint", h[2])

## (the late-game reveal, if it comes: the two lights trade places)
static func swap(on: bool) -> void:
	swapped = on
	push()

static func a(c: Color, alpha: float) -> Color:
	return Color(c, alpha)
