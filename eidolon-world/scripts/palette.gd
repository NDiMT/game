class_name Palette
extends RefCounted
## The single accent palette, used everywhere (runes, the hem stripe, plates, pillars, the beam,
## footprints, UI accents). v0.5: the blue-green "opened up": lighter and luminous, never neon.
## Shaders read the same colours through the global uniforms `accent` (outer glow), `accent_core`
## (the glow's bright core) and `accent_tint` (the quiet tint), pushed from here at start-up.

const CORE := Color("A8F6EE")          # glow core: the light inside a carved line
const ACCENT := Color("4CC0BA")        # outer glow: bloom, rings, UI accents
const TINT := Color("2E8F92")          # tint: the quiet edge of a glow, never a fill
const ACCENT_DEEP := TINT

static func push() -> void:
	RenderingServer.global_shader_parameter_set("accent", ACCENT)
	RenderingServer.global_shader_parameter_set("accent_core", CORE)
	RenderingServer.global_shader_parameter_set("accent_tint", TINT)

static func a(c: Color, alpha: float) -> Color:
	return Color(c, alpha)
