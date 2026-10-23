class_name CarPaint
## Car colours = swappable base-colour (albedo) textures on a shared PBR material
## (normal + ORM are shared). The garage can pick any id in COLOURS later.

const COLOURS := {
	"original": "res://assets/cars/car1_albedo_original.jpg", # yellow, green door (player default)
	"red": "res://assets/cars/car1_albedo_red.jpg",
	"blue": "res://assets/cars/car1_albedo_blue.jpg",
	"teal": "res://assets/cars/car1_albedo_teal.jpg",
	"orange": "res://assets/cars/car1_albedo_orange.jpg",
	"purple": "res://assets/cars/car1_albedo_purple.jpg",
	"green": "res://assets/cars/car1_albedo_green.jpg",
	"white": "res://assets/cars/car1_albedo_white.jpg",
	"black": "res://assets/cars/car1_albedo_black.jpg",
}
## UI tint per colour id (minimap dots, name tags)
const TINT := {
	"original": Color(1.0, 0.78, 0.15), "red": Color(1.0, 0.3, 0.25), "blue": Color(0.3, 0.55, 1.0),
	"teal": Color(0.2, 0.9, 0.85), "orange": Color(1.0, 0.55, 0.15), "purple": Color(0.75, 0.4, 1.0),
	"green": Color(0.4, 0.9, 0.35), "white": Color(0.95, 0.95, 0.95), "black": Color(0.35, 0.35, 0.4),
}

static var _cache := {}

static func material(colour: String) -> Material:
	if _cache.has(colour):
		return _cache[colour]
	var m := ORMMaterial3D.new()
	m.albedo_texture = load(COLOURS.get(colour, COLOURS["original"]))
	m.normal_enabled = true
	m.normal_texture = load("res://assets/cars/car1_normal.jpg")
	m.orm_texture = load("res://assets/cars/car1_orm.jpg")
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_cache[colour] = m
	return m
