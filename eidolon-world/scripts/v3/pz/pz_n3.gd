extends Puzzle
## N.3 "The Votive" (CH1_V3 §1 #21, between): a small votive niche against the north wall, its wick dead. Light it
## with the Lamp. Done = lit (it burns on; the Still Room lies beyond).

const VOTIVE := Vector3(4.0, 1.0, -29.25)
var flame: Flame

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	game.level.ob_rect(Rect2(VOTIVE.x - 0.55, VOTIVE.z - 0.45, 1.1, 0.7))
	game.level.add_interact("n3_votive", VOTIVE + Vector3(0, 0, 1.05), "light", light, 1.1,
		func() -> bool: return not done and game.call("has_item", "lamp"))

func post() -> void:
	Kit3.prop(self, "kit_votive", VOTIVE, 0.95, 0.0)
	flame = Kit3.flame(game, self, VOTIVE + Vector3(0, 1.0, 0.05), 0.18, false)

func light() -> void:
	game.call("perform", "reach", VOTIVE + Vector3(0, 0.95, 0.1), func() -> void:
		solve()
		var tw := create_tween()
		tw.tween_method(func(v: float) -> void: flame.mat.set_shader_parameter("intensity", v), 0.0, 0.95, 0.8)
		if game.juice: game.juice.sparks(VOTIVE + Vector3(0, 1.0, 0.05))
		if game.sfx: game.sfx.play("flip", -14.0, 1.2))

func apply() -> void:
	super.apply()
	if flame: flame.mat.set_shader_parameter("intensity", 0.95 if done else 0.0)

func autosolve() -> void:
	if not game.call("has_item", "lamp"): game.call("give", "lamp", false)
	game.cmd("walk:%f:%f" % [VOTIVE.x, VOTIVE.z + 1.05])
	get_tree().create_timer(2.5).timeout.connect(func() -> void: game.try_interact())
