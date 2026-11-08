extends Puzzle
## E.6 / E* "The High Beacon, the Plate" (CH1_V3 §1 #33, landmark + a ★ payoff): the high terrace over everything. Its
## Beacon wears a bronze cap. On the terrace lies a sheet of still water, and in it (only there: HER layer) the plate
## from I.1: stand where it shows, your reflection reaches it half a second late, and the cap lifts (the circle
## closes). Light the Beacon with the Lamp: it catches, the Atrium's east Beacon answers (pz_a), the High Stair down
## to the Singing Stones opens. With three Beacons burning, the Veiled Way south of the Atrium sinks open.

const BEACON := Vector3(32.6, 0.0, -76.2)
const PLATE := Vector3(30.4, 0.0, -75.3)
const WATER_C := Vector3(29.4, 0.0, -74.6)
const WATER_HALF := Vector2(2.0, 1.7)
const HOLD := 1.0
var y0 := 3.0
var water: Reflector
var plate: MeshInstance3D
var cap: Node3D
var fire: BeaconFire
var capped := true
var _on := 0.0

func build() -> void:
	gate("EH", "E2")
	y0 = Map3.height("EB", Vector2(BEACON.x, BEACON.z))
	var b := BEACON + Vector3(0, y0, 0)
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	m.cyl(b + Vector3(0, 0.2, 0), 0.62, 0.7, 0.4, col, 16)
	m.cyl(b + Vector3(0, 1.05, 0), 0.3, 0.38, 1.3, col, 12)
	m.cyl(b + Vector3(0, 1.78, 0), 0.5, 0.3, 0.2, Color(0.5, 0.9, 0.0), 14)
	Kit3.marble(game, m.commit(), self).name = "EB_Beacon"
	game.level.ob_circle(Vector2(BEACON.x, BEACON.z), 0.72)
	cap = Node3D.new()
	cap.name = "EB_Cap"
	add_child(cap)
	cap.position = b + Vector3(0, 1.9, 0)
	var cm := MB.new()
	cm.cyl(Vector3(0, 0.14, 0), 0.12, 0.5, 0.28, Color(0.5, 0.9, 0.0), 14)
	cm.cyl(Vector3(0, 0.34, 0), 0.04, 0.08, 0.16, Color(0.5, 0.9, 0.0), 8)
	Kit3.marble(game, cm.commit(), cap)
	game.level.add_interact("eb_light", b + Vector3(-1.0, -y0 + y0, 0.62), "light", light, 1.2,
		func() -> bool: return not done and not capped and game.call("has_item", "lamp"))

func post() -> void:
	water = TwoWorld.still_water(self, game, WATER_C + Vector3(0, y0 + 0.045, 0), WATER_HALF, Map3.rect("EB"), 0.5)
	(game.get("ch") as Ch1v3).add_refl(water)
	plate = MeshInstance3D.new()
	plate.name = "EB_Plate"
	var pm := CylinderMesh.new()
	pm.top_radius = 0.55
	pm.bottom_radius = 0.6
	pm.height = 0.04
	plate.mesh = pm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.85, 0.12, 0.16)
	mat.emission_enabled = true
	mat.emission = Color(0.9, 0.1, 0.15)
	mat.emission_energy_multiplier = 1.6
	plate.material_override = mat
	plate.position = PLATE + Vector3(0, y0 + 0.012, 0)
	add_child(plate)
	TwoWorld.set_her(plate)
	fire = BeaconFire.new()
	fire.noise = game.level.noise_tex
	add_child(fire)
	fire.position = BEACON + Vector3(0, y0 + 1.86, 0)

func tick(dt: float) -> void:
	if done or not capped: return
	if near(PLATE + Vector3(0, y0, 0), 0.55):
		if _on == 0.0: progress()
		_on += dt
		if _on >= HOLD: _uncap(false)
	else:
		_on = 0.0

## her reflection on the plate: the cap lifts off the Beacon and sets down beside it
func _uncap(snap: bool) -> void:
	capped = false
	state["cap"] = false
	var to := BEACON + Vector3(0.0, y0 + 0.02, 0.0) + Vector3(0.2, 0, 0.82)
	if snap:
		cap.position = to
		return
	if water: water.reach_override = -1.0
	var tw := cap.create_tween()
	tw.tween_property(cap, "position:y", cap.position.y + 0.7, 1.1).set_trans(Tween.TRANS_SINE)
	tw.tween_property(cap, "position", to, 1.2).set_trans(Tween.TRANS_SINE)
	if game.sfx:
		game.sfx.play("glass", -14.0, 0.7)
		game.sfx.play_later("door", 1.9, -18.0, 1.4)
	if game.juice:
		game.juice.ring(PLATE + Vector3(0, y0 + 0.05, 0), 1.4, 1.4)
		game.juice.glint(cap.global_position)

func light() -> void:
	game.call("perform", "light_with_lamp", BEACON + Vector3(0, y0 + 1.7, 0), func() -> void:
		fire.ignite()
		if game.sfx: game.sfx.play("door", -16.0, 0.6)
		solve()
		var all3 := true
		for id in ["WB", "NB"]:
			var ch: Ch1v3 = game.get("ch")
			if not (ch.pz.has(id) and (ch.pz[id] as Puzzle).done): all3 = false
		game.ui.show_text("The High Beacon burns.\n" + ("Three fires now. Far below, a gate sinks." if all3 else "Far off, another answers."), game.player.position, 5.0))

func hint() -> void:
	if capped and water: water.reach_override = 0.6

func apply() -> void:
	super.apply()
	capped = not done and bool(state.get("cap", true))
	if capped:
		cap.position = BEACON + Vector3(0, y0 + 1.9, 0)
	else:
		_uncap(true)
	if fire: fire.set_lit(done)
	_on = 0.0

func autosolve() -> void:
	if not game.call("has_item", "lamp"): game.call("give", "lamp", false)
	game.cmd("walk:%f:%f" % [PLATE.x, PLATE.z])
	var tw := create_tween()
	tw.tween_interval(5.5)
	tw.tween_callback(func() -> void: game.cmd("walk:%f:%f" % [BEACON.x - 1.0, BEACON.z + 0.62]))
	tw.tween_interval(3.0)
	tw.tween_callback(func() -> void: game.try_interact())
