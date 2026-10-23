class_name Mine
extends Node3D
## Proximity mine dropped behind a car. Arms after a moment, owner is immune briefly.

const ARM := 0.5
const RADIUS := 2.6
const LIFE := 30.0

var owner_car: Car
var game: Node
var _t := 0.0
var _light: MeshInstance3D
var _lmat: StandardMaterial3D

func _ready() -> void:
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new(); cm.top_radius = 0.5; cm.bottom_radius = 0.65; cm.height = 0.28; cm.radial_segments = 10; cm.rings = 1
	disc.mesh = cm
	var m := StandardMaterial3D.new(); m.albedo_color = Color(0.2, 0.2, 0.22); m.metallic = 0.7; m.roughness = 0.45
	disc.material_override = m
	disc.position.y = 0.14
	add_child(disc)
	var band := MeshInstance3D.new()
	var bm := CylinderMesh.new(); bm.top_radius = 0.67; bm.bottom_radius = 0.67; bm.height = 0.08; bm.radial_segments = 10; bm.rings = 1
	band.mesh = bm
	var hm := StandardMaterial3D.new(); hm.albedo_color = Color(0.95, 0.7, 0.1)
	band.material_override = hm
	band.position.y = 0.06
	add_child(band)
	_light = MeshInstance3D.new()
	var sm := SphereMesh.new(); sm.radius = 0.13; sm.height = 0.26; sm.radial_segments = 8; sm.rings = 4
	_light.mesh = sm
	_lmat = StandardMaterial3D.new()
	_lmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_lmat.albedo_color = Color(1, 0.1, 0.05)
	_lmat.emission_enabled = true; _lmat.emission = Color(1, 0.1, 0.05); _lmat.emission_energy_multiplier = 5.0
	_light.material_override = _lmat
	_light.position.y = 0.32
	add_child(_light)

func _physics_process(dt: float) -> void:
	_t += dt
	_light.visible = _t < ARM or fmod(_t, 0.5) < 0.25
	if _t > LIFE:
		queue_free(); return
	if _t < ARM or game == null: return
	for c: Car in game.cars:
		if not c.alive: continue
		if c == owner_car and _t < 1.5: continue
		var d := c.global_position - global_position
		if Vector2(d.x, d.z).length() < RADIUS and absf(d.y) < 2.5:
			game.explode(global_position + Vector3.UP * 0.4, 5.0, 28.0, owner_car, c, 0.9)
			queue_free()
			return
