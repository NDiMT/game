class_name Palette
extends RefCounted
## The single accent palette. v0.3: deep PETROL instead of bright cyan. Shaders read the same colours
## through the global uniforms `accent` / `accent_core` (pushed from here at start-up).

const ACCENT := Color("2A7F86")        # petrol: outer glow, tint, rings, UI accents
const ACCENT_DEEP := Color("1F6E78")   # the darker petrol (shadows of the glow)
const CORE := Color("8FD3D6")          # light desaturated teal: emissive core lines

static func push() -> void:
	RenderingServer.global_shader_parameter_set("accent", ACCENT)
	RenderingServer.global_shader_parameter_set("accent_core", CORE)

static func a(c: Color, alpha: float) -> Color:
	return Color(c, alpha)
