extends Puzzle
## I.1 "The Plate She Treads" (CH1_V3 §2): a sheet of still water on the floor; a plate glows in it, ONLY in the
## water (her world, TwoWorld.HER). Stand where it shows: your reflection reaches it half a second after you, and
## the door to the Bell opens. No fail; it latches.

const PLATE := Vector3(6.0, 0.0, 28.5)
const WATER_HALF := Vector2(2.6, 2.2)
const HOLD := 1.0                # s on the plate (her lag 0.5 s + a beat)
var water: Reflector
var plate: MeshInstance3D
var _on := 0.0

func build() -> void:
	gate("I1", "I2")

func post() -> void:
	# (4.5 cm over the floor: the mirror camera drops marble only 3 cm or more below the plane; nearer, the floor
	# under the sheet hid her double)
	water = TwoWorld.still_water(self, game, PLATE + Vector3(0, 0.045, 0), WATER_HALF, Map3.rect("I1"), 0.5)
	(game.get("ch") as Ch1v3).add_refl(water)
	plate = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.55
	cm.bottom_radius = 0.6
	cm.height = 0.04
	plate.mesh = cm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.85, 0.12, 0.16)
	m.emission_enabled = true
	m.emission = Color(0.9, 0.1, 0.15)
	m.emission_energy_multiplier = 1.6
	plate.material_override = m
	plate.position = PLATE + Vector3(0, 0.012, 0)
	add_child(plate)
	TwoWorld.set_her(plate)

func tick(dt: float) -> void:
	if done: return
	if near(PLATE, 0.55):
		if _on == 0.0: progress()
		_on += dt
		if _on >= HOLD: solve()
	else:
		_on = 0.0

func hint() -> void:
	if water: water.reach_override = 0.6          # her hand points down at the plate

func on_solved() -> void:
	if water: water.reach_override = -1.0

## as a player would: walk onto the plate and stand
func autosolve() -> void:
	game.cmd("walk:%f:%f" % [PLATE.x, PLATE.z])
