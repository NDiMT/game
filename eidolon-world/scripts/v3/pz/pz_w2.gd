extends Puzzle
## W.2 "The Offering" (CH1_V3 §1 #11, between): a little altar against the east wall, one pale flower on it. Touch it:
## she lays her hand by it and a small flame lights there by itself (someone, somewhere, answers). Done = lit.

const ALTAR := Vector3(-18.75, 1.0, -15.2)
var flame: Flame

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	m.box(ALTAR + Vector3(0, 0.4, 0), Vector3(0.6, 0.8, 0.9), Color(0.5, 0.25, 0.0))
	m.box(ALTAR + Vector3(0, 0.83, 0), Vector3(0.7, 0.06, 1.0), Color(0.5, 0.5, 0.0))
	m.cyl(ALTAR + Vector3(0, 0.92, 0.22), 0.07, 0.09, 0.12, Color(0.5, 0.9, 0.0), 10)          # (the lamp dish)
	Kit3.marble(game, m.commit(), self).name = "W2_Altar"
	game.level.ob_rect(Rect2(ALTAR.x - 0.36, ALTAR.z - 0.5, 0.72, 1.0))
	game.level.add_interact("w2_flower", ALTAR + Vector3(-0.95, -ALTAR.y + 1.0, 0), "touch", touch, 1.1, func() -> bool: return not done)

func post() -> void:
	# the flower (A: "W2_Flower", a placeholder: a pale bloom on a stem)
	var fl := Node3D.new()
	fl.name = "W2_Flower"
	add_child(fl)
	fl.position = ALTAR + Vector3(0, 0.86, -0.18)
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.93, 0.9, 0.86)
	sm.roughness = 0.7
	for i in 5:
		var pe := MeshInstance3D.new()
		var sp := SphereMesh.new()
		sp.radius = 0.045
		sp.height = 0.03
		pe.mesh = sp
		pe.material_override = sm
		var a := TAU * i / 5.0
		pe.position = Vector3(cos(a) * 0.05, 0.03, sin(a) * 0.05)
		fl.add_child(pe)
	flame = Kit3.flame(game, self, ALTAR + Vector3(0, 0.98, 0.22), 0.16, false)

func touch() -> void:
	game.call("perform", "reach", ALTAR + Vector3(0, 0.9, -0.1), func() -> void:
		progress()
		solve()
		var tw := create_tween()
		tw.tween_interval(0.6)
		tw.tween_method(func(v: float) -> void: flame.mat.set_shader_parameter("intensity", v), 0.0, 0.9, 1.4)
		if game.sfx: game.sfx.play_later("chime", 0.6, -18.0, 1.2))

func apply() -> void:
	super.apply()
	if flame: flame.mat.set_shader_parameter("intensity", 0.9 if done else 0.0)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [ALTAR.x - 0.95, ALTAR.z])
	get_tree().create_timer(2.5).timeout.connect(func() -> void: game.try_interact())
