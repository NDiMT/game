class_name Palette
extends RefCounted
## v0.8 the two-colour glow language (owner approved). Every glow in the game is one of two lights:
##  AQUA, "your world": runes and inscriptions, your hem stripe and cloak runes, your goal sigils and
##    light pillars, the beam and its floor light, the votive flames, UI accents, the see-through rim,
##    the wisp hints.
##  (v0.8.1, the owner's final word: ONE colour; hers is the same aqua) "her, the other side": her writing on the glass, her hand, her footprints,
##    the path stones in the pool's reflection (plain stone), her
##    glass's plates and her world's stands, the Eidolon plate on her side, her lines in the cinematic.
## Both GLOW: a bright core, a soft bloom halo, a quiet tint at the edge (never a fill). On pale marble
## and fog the contrast comes from luminance: small luminous lines, soft halos, no saturated areas.
## Shaders read them as global uniforms: `accent` / `accent_core` / `accent_tint` (aqua) and `her` /
## `her_core` / `her_tint` (= aqua since v0.8.1), pushed from here at start-up. (A late reveal may swap them: swap().)

## v0.9, the owner: the one light is now a deep CRIMSON (not neon): every rune, flame, light, x-ray rim,
## highlight, light pool, footprint, glass writing, the hand. (The old aqua, for reference: core B6FFF6,
## accent 46E6D8, tint 1FA9A0, fire light (0.52, 0.93, 0.9).)
const CORE := Color("FFB3A8")          # crimson: the light inside a carved line (a hot pale rose)
const ACCENT := Color("D8263F")        # crimson: the glow, bloom, rings, UI accents
const TINT := Color("8E1026")          # crimson: the quiet edge of a glow, never a fill
const ACCENT_DEEP := TINT
const FIRE_LIGHT := Color(1.0, 0.5, 0.46)    # the light our (crimson) fire throws on the stone
const RED_DRESS := Color("7E0E1E")     # v0.9: her reflection's dress (deep crimson cloth)
# (v0.8.1, the owner: ONE light. Hers is the same aqua as yours: where her strokes must be told from
# yours, timing and brightness do it (hers appear first, softer, then brighten), never a second hue)
const HER_CORE := CORE
const HER := ACCENT
const HER_TINT := TINT

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
	RenderingServer.global_shader_parameter_set("red_dress", RED_DRESS)

## (the late-game reveal, if it comes: the two lights trade places)
static func swap(on: bool) -> void:
	swapped = on
	push()

static func a(c: Color, alpha: float) -> Color:
	return Color(c, alpha)
