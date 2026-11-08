extends Puzzle
## I.2 "The Bell" (CH1_V3 §1 #3, a between beat): a bronze bell hangs in a stone frame by the north wall. Tap it: she
## reaches up and strikes it, and far away other bells answer (the world is bigger than this). It teaches the one
## interaction without any pressure. No gate; done = rung once (it rings as often as you like).

const BELL := Vector3(12.5, 0.0, 26.75)        # the frame's foot (between its two posts)
var bell: Node3D
var _swing := 0.0

func build() -> void:
	jingle = false
	var m := MB.new()
	for dx in [-0.72, 0.72]:
		m.box(BELL + Vector3(dx, 1.05, 0), Vector3(0.2, 2.1, 0.2), Color(0.5, 0.25, 0.0))
		game.level.ob_rect(Rect2(BELL.x + dx - 0.12, BELL.z - 0.12, 0.24, 0.24))
	m.box(BELL + Vector3(0, 2.15, 0), Vector3(1.75, 0.2, 0.26), Color(0.5, 0.25, 0.0))
	Kit3.marble(game, m.commit(), self).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF          # (A: its shadow made a dark disc on the N wall)
	bell = Node3D.new()
	bell.name = "BellHang"
	bell.position = BELL + Vector3(0, 2.05, 0)          # (it swings about its hook)
	add_child(bell)
	var b := MB.new()
	b.cyl(Vector3(0, -0.36, 0), 0.08, 0.25, 0.5, Color(0.5, 0.9, 0.0), 14)
	b.cyl(Vector3(0, -0.63, 0), 0.25, 0.27, 0.05, Color(0.5, 0.9, 0.0), 14)
	b.cyl(Vector3(0, -0.07, 0), 0.03, 0.03, 0.14, Color(0.5, 0.9, 0.0), 6)
	Kit3.marble(game, b.commit(), bell).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	game.level.add_interact("i2_bell", BELL + Vector3(0, 0, 0.75), "ring", ring, 1.1)

func ring() -> void:
	game.call("perform", "reach", BELL + Vector3(0, 1.35, 0.12), func() -> void:
		_swing = 1.0
		progress()
		if game.sfx:
			game.sfx.play("bell", -10.0, 1.0)
			game.sfx.play_later("bell_far", 1.7, -20.0, 0.84)
			game.sfx.play_later("bell_far", 2.9, -24.0, 1.12)
			game.sfx.play_later("bell", 4.2, -28.0, 0.7)
		if game.juice: game.juice.dust_floor(BELL + Vector3(0, 2.2, 0), 0.4, 8)
		if not done: solve())

func tick(dt: float) -> void:
	if _swing <= 0.0: return
	_swing = maxf(0.0, _swing - dt / 3.2)
	bell.rotation.x = sin((1.0 - _swing) * 15.0) * 0.32 * _swing

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [BELL.x, BELL.z + 0.75])
	get_tree().create_timer(2.5).timeout.connect(func() -> void: game.try_interact())
