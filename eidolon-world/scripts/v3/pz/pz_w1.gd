extends Puzzle
## W.1 "The Stair of Breath" (CH1_V3 §2, ★★): I.3's glass again, at the foot of a stair that will not let her up.
## Breathe on the pane: she writes the stair's rune one stroke at a time, and each stroke you trace lights on the wall
## rune and lowers the stone at the top of the stair a third. Teach: one stroke written back (as at I.3). Test: the
## steps. Twist: the third she writes as you SEE it (you are inside the glass now): trace what you see, not its mirror.
## The glass reopens by itself for the next stroke. Misses: GlassTalk fades them; after two she traces it once, faint.

const PANE := Vector3(-18.36, 0.0, -2.4)     # on the east wall, facing west (its y is the stair's there)
const SIZE := Vector2(0.8, 1.1)
var breath: ShaderMaterial
var runes: Array = []
var n := 0
var _again := -1.0
var _auto := false

func build() -> void:
	test_s = 70.0
	var y := Map3.height("W1", Vector2(PANE.x, PANE.z))
	gate("W1", "W2")
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	var c := Vector3(PANE.x, y + 1.35, PANE.z)
	var lo := game.level.height_at(Vector2(PANE.x - 0.03, PANE.z))          # (it stands on the step under its middle)
	var top := c.y - 0.62
	m.box(Vector3(PANE.x - 0.03, (lo + top) * 0.5, PANE.z), Vector3(0.24, top - lo, 1.1), col)
	for dz in [-0.48, 0.48]: m.box(c + Vector3(0.0, 0, dz), Vector3(0.12, 1.3, 0.1), Color(0.5, 1.0, 0.0))
	m.box(c + Vector3(0.0, 0.62, 0), Vector3(0.12, 0.1, 1.06), Color(0.5, 1.0, 0.0))
	Kit3.marble(game, m.commit(), self).name = "W1_Pane"
	game.level.ob_rect(Rect2(PANE.x - 0.18, PANE.z - 0.56, 0.34, 1.12))
	game.level.add_interact("w1_pane", Vector3(PANE.x - 0.85, y, PANE.z), "breathe", breathe, 1.1, func() -> bool: return not done)

func post() -> void:
	var y := Map3.height("W1", Vector2(PANE.x, PANE.z))
	breath = Kit3.breath_pane(self, game, Vector3(PANE.x, y + 1.35, PANE.z), Basis.looking_at(Vector3.RIGHT, Vector3.UP), SIZE)
	# the wall rune: three strokes in a column up the east wall beside the pane (they light as you trace them)
	for i in 3:
		var z := PANE.z - 1.0 - i * 0.62
		var ry := Map3.height("W1", Vector2(PANE.x, z)) + 1.2 + i * 0.28
		runes.append(Kit3.rune(self, Vector3(PANE.x - 0.02, ry, z), Vector2(0.5, 0.5), Basis.looking_at(Vector3.RIGHT, Vector3.UP), 6.0 + i, 0.08))

func breathe() -> void:
	progress()
	game.call("perform", "touch_glass", Vector3(PANE.x - 0.04, Map3.height("W1", Vector2(PANE.x, PANE.z)) + 1.25, PANE.z), func() -> void:
		if game.sfx: game.sfx.cue("touch_glass", -6.0)
		get_tree().create_timer(0.55).timeout.connect(func() -> void: game.open_glass("w1_%d" % (n + 1))), Vector3.LEFT)

func on_glass(id: String) -> void:
	if not id.begins_with("w1_") or done: return
	n = mini(3, n + 1)
	state["n"] = n
	progress()
	_light(n - 1, false)
	_lower(false)
	if n >= 3:
		get_tree().create_timer(3.6).timeout.connect(func() -> void: solve())
	else:
		_again = 4.4                            # (the close-up ends at 3.4 s; a breath, then her next stroke)

func _light(i: int, snap: bool) -> void:
	var m: ShaderMaterial = runes[i]
	if snap:
		m.set_shader_parameter("lit", 1.0)
		return
	var tw := create_tween()
	tw.tween_interval(3.4)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("lit", v), 0.08, 1.0, 0.9)
	tw.tween_callback(func() -> void: if game.sfx: game.sfx.play("chime_hall", -16.0, 0.8 + 0.12 * i))

## the stone at the top of the stair goes down a third with each stroke (it sinks the rest of the way when solved)
func _lower(snap: bool) -> void:
	var g: Puzzle.Gate = gates[0]
	var base: float = g.mi.get_meta("base_y0", g.mi.get_meta("base_y"))
	g.mi.set_meta("base_y0", base)
	var to := base - 0.6 * n
	g.mi.set_meta("base_y", to)
	if snap:
		g.mi.position.y = to
		return
	var tw := g.mi.create_tween()
	tw.tween_interval(3.6)
	tw.tween_property(g.mi, "position:y", to, 0.9).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		if game.juice: game.juice.dust_floor(g.mi.global_position + Vector3(0, -1.0, 0), 0.7, 10)
		if game.sfx: game.sfx.play("grind", -14.0, 0.8))

func tick(dt: float) -> void:
	if _again > 0.0:
		_again -= dt
		if _again <= 0.0 and not done and game.mode == "play" and near(Vector3(PANE.x - 0.85, 0, PANE.z), 1.6):
			game.open_glass("w1_%d" % (n + 1))
	if _auto and game.mode == "glass" and game.ui.glass_talk.phase == "waiting": game.cmd("glass_try:right")

func apply() -> void:
	n = 3 if done else int(state.get("n", 0))
	var g: Puzzle.Gate = gates[0]
	if g.mi.has_meta("base_y0"): g.mi.set_meta("base_y", g.mi.get_meta("base_y0"))
	super.apply()
	for i in runes.size(): runes[i].set_shader_parameter("lit", 1.0 if i < n else 0.08)
	if n > 0 and not done: _lower(true)
	_again = -1.0

func hint() -> void:
	if game.sfx:
		game.sfx.play("glass_tink", -14.0, 1.1)
		game.sfx.play_later("glass_tink", 0.35, -14.0, 1.1)
	if game.juice: game.juice.glint(Vector3(PANE.x, Map3.height("W1", Vector2(PANE.x, PANE.z)) + 1.35, PANE.z))

func autosolve() -> void:
	_auto = true
	game.cmd("walk:%f:%f" % [PANE.x - 0.85, PANE.z])
	get_tree().create_timer(3.0).timeout.connect(func() -> void: game.try_interact())

func on_solved() -> void:
	_auto = false
