extends Puzzle
## W* "The Glass Beacon" (CH1_V3 §1 #17, landmark): a tall glass-and-stone beacon on the rock over the lagoon. Light it
## with the Lamp: it catches, and far off in the Atrium the west Beacon answers (pz_a) and the North road opens. The
## stones home past the Observer's face (W.7) open with it.

var BEACON := Vector3(-45.6, 0.0, -5.0)
var fire: BeaconFire

func build() -> void:
	gate("W7", "WR")
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	# (it stands on the stair: its foot reaches down to the lowest step under it)
	var lo := game.level.height_at(Vector2(BEACON.x, BEACON.z))
	BEACON.y = Map3.height("WB", Vector2(BEACON.x, BEACON.z - 0.75)) + 0.02
	m.cyl(Vector3(BEACON.x, (lo + BEACON.y + 0.4) * 0.5, BEACON.z), 0.62, 0.7, BEACON.y + 0.4 - lo + 0.02, col, 16)
	m.cyl(BEACON + Vector3(0, 1.05, 0), 0.3, 0.38, 1.3, col, 12)
	m.cyl(BEACON + Vector3(0, 1.78, 0), 0.5, 0.3, 0.2, Color(0.5, 0.9, 0.0), 14)
	Kit3.marble(game, m.commit(), self).name = "WB_Beacon"
	game.level.ob_circle(Vector2(BEACON.x, BEACON.z), 0.72)
	game.level.add_interact("wb_light", BEACON + Vector3(1.15, 0, 0.5), "light", light, 1.2,
		func() -> bool: return not done and game.call("has_item", "lamp"))

func post() -> void:
	fire = BeaconFire.new()
	fire.noise = game.level.noise_tex
	add_child(fire)
	fire.position = BEACON + Vector3(0, 1.86, 0)

func light() -> void:
	game.call("perform", "reach", BEACON + Vector3(0, 1.7, 0), func() -> void:
		fire.ignite()
		if game.sfx: game.sfx.play("door", -16.0, 0.6)
		solve()
		game.ui.show_text("The Glass Beacon burns.\nFar off, another answers.", game.player.position, 5.0))

func apply() -> void:
	super.apply()
	if fire: fire.set_lit(done)

func autosolve() -> void:
	if not game.call("has_item", "lamp"): game.call("give", "lamp", false)
	game.cmd("walk:%f:%f" % [BEACON.x + 1.15, BEACON.z + 0.5])
	get_tree().create_timer(3.0).timeout.connect(func() -> void: game.try_interact())
