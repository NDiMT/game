class_name CarPaint
## Car colours = swappable base-colour (albedo) textures on a shared PBR material
## (normal + ORM are shared). The garage can pick any id in COLOURS later.

const CAR := "car1"
## colour id -> albedo (two-tone body/door variants from the owner)
const COLOURS := {
	"yellow": "res://assets/cars/car1_albedo_yellow.jpg", # green door - player default
	"purple": "res://assets/cars/car1_albedo_purple.jpg",
	"blue": "res://assets/cars/car1_albedo_blue.jpg",
	"teal": "res://assets/cars/car1_albedo_teal.jpg",
	"red": "res://assets/cars/car1_albedo_red.jpg",
	"orange": "res://assets/cars/car1_albedo_orange.jpg",
	"green": "res://assets/cars/car1_albedo_green.jpg",
	"white": "res://assets/cars/car1_albedo_white.jpg",
	"black": "res://assets/cars/car1_albedo_black.jpg",
}
## UI tint per colour id (minimap dots, results)
const TINT := {
	"yellow": Color(1.0, 0.78, 0.15), "red": Color(1.0, 0.3, 0.25), "blue": Color(0.3, 0.55, 1.0),
	"teal": Color(0.2, 0.9, 0.85), "orange": Color(1.0, 0.55, 0.15), "purple": Color(0.78, 0.45, 1.0),
	"green": Color(0.4, 0.9, 0.35), "white": Color(0.95, 0.95, 0.95), "black": Color(0.35, 0.35, 0.4),
}

static var _cache := {}

static func material(colour: String) -> Material:
	if _cache.has(colour):
		return _cache[colour]
	var m := ORMMaterial3D.new()
	m.albedo_texture = load(COLOURS.get(colour, COLOURS["yellow"]))
	m.normal_enabled = true
	m.normal_texture = load("res://assets/cars/%s_normal.jpg" % CAR)
	m.orm_texture = load("res://assets/cars/%s_orm.jpg" % CAR)
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_cache[colour] = m
	return m
