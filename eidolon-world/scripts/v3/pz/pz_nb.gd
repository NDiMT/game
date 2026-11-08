extends Puzzle
## N* "The Garden Beacon" (CH1_V3 §1 #26, landmark): out of the mist, a beacon on a terrace of fig and myrtle. Light it
## with the Lamp: the Atrium's north Beacon answers (pz_a), and the Cloister Stair shortcut home opens at its foot.

const BEACON := Vector3(-2.6, 2.0, -71.6)
var fire: BeaconFire

func build() -> void:
	gate("NS", "A")
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	m.cyl(BEACON + Vector3(0, 0.2, 0), 0.62, 0.7, 0.4, col, 16)
	m.cyl(BEACON + Vector3(0, 1.05, 0), 0.3, 0.38, 1.3, col, 12)
	m.cyl(BEACON + Vector3(0, 1.78, 0), 0.5, 0.3, 0.2, Color(0.5, 0.9, 0.0), 14)
	Kit3.marble(game, m.commit(), self).name = "NB_Beacon"
	game.level.ob_circle(Vector2(BEACON.x, BEACON.z), 0.72)
	game.level.add_interact("nb_light", BEACON + Vector3(-0.9, 0, 0.9), "light", light, 1.2,
		func() -> bool: return not done and game.call("has_item", "lamp"))

func post() -> void:
	fire = BeaconFire.new()
	fire.noise = game.level.noise_tex
	add_child(fire)
	fire.position = BEACON + Vector3(0, 1.86, 0)

func light() -> void:
	game.call("perform", "reach", BEACON + Vector3(0, 1.7, 0), func() -> void:
		fire.ignite()
		solve()
		game.ui.show_text("The Garden Beacon burns.\nThe old stair leads home.", game.player.position, 5.0))

func apply() -> void:
	super.apply()
	if fire: fire.set_lit(done)

func autosolve() -> void:
	if not game.call("has_item", "lamp"): game.call("give", "lamp", false)
	game.cmd("walk:%f:%f" % [BEACON.x - 0.9, BEACON.z + 0.9])
	get_tree().create_timer(3.0).timeout.connect(func() -> void: game.try_interact())
