extends Puzzle
## I.3 "The First Glass" (CH1_V3 §2): a small fogged pane in the corridor's east wall. Touch it and breathe: the pane
## fogs, and on the other side HER finger writes one stroke; trace it (GlassTalk "first": direction-free, generous).
## A wrong trace fades and she writes it again, slower. Solved: the low bars across the way north rise.

const PANE := Vector3(19.66, 1.3, 23.0)         # on the east wall, facing west into the corridor
const SIZE := Vector2(0.8, 1.1)
var breath: ShaderMaterial
var bars: Node3D
var _bar_y := 0.0

func build() -> void:
	var g := gate("I3", "IB1")
	g.mi.visible = false
	g.mi.set_meta("hide", true)
	var d := Map3.door("I3", "IB1")
	var c: Vector2 = d["c"]
	bars = Kit3.bars(game, self, Vector3(c.x, 0.0, c.y + 0.12), float(d["w"]), false)
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	m.box(PANE + Vector3(-0.03, -0.92, 0), Vector3(0.24, 0.6, 1.1), col)                  # (its sill, against the wall)
	m.box(PANE + Vector3(0.0, 0, -0.48), Vector3(0.12, 1.3, 0.1), Color(0.5, 1.0, 0.0))
	m.box(PANE + Vector3(0.0, 0, 0.48), Vector3(0.12, 1.3, 0.1), Color(0.5, 1.0, 0.0))
	m.box(PANE + Vector3(0.0, 0.62, 0), Vector3(0.12, 0.1, 1.06), Color(0.5, 1.0, 0.0))
	Kit3.marble(game, m.commit(), self)
	game.level.ob_rect(Rect2(PANE.x - 0.16, PANE.z - 0.56, 0.34, 1.12))
	game.level.add_interact("i3_pane", Vector3(PANE.x - 0.85, 0.0, PANE.z), "breathe", breathe, 1.1,
		func() -> bool: return not done)

func post() -> void:
	breath = Kit3.breath_pane(self, game, PANE, Basis.looking_at(Vector3.RIGHT, Vector3.UP), SIZE)

func breathe() -> void:
	progress()
	game.call("perform", "touch_glass", PANE + Vector3(-0.04, -0.1, 0.0), func() -> void:
		if game.sfx: game.sfx.cue("touch_glass", -6.0)
		get_tree().create_timer(0.55).timeout.connect(func() -> void: game.open_glass("first")), Vector3.LEFT)

func on_glass(id: String) -> void:
	if id != "first" or done: return
	solve()

func on_solved() -> void:
	breath.set_shader_parameter("fog", 1.0)
	breath.set_shader_parameter("write", 1.0)
	var tw := create_tween()
	tw.tween_interval(6.0)
	tw.tween_method(func(v: float) -> void: breath.set_shader_parameter("fog", v), 1.0, 0.0, 4.0)
	if game.sfx: game.sfx.play("rattle", -12.0, 0.9)
	if game.juice: game.juice.dust_floor(bars.position, 0.8, 12)

func tick(_dt: float) -> void:
	var g: Puzzle.Gate = gates[0]
	var y := Cinematic.ease_k(g.k, 1) * 2.55
	if y != _bar_y:
		_bar_y = y
		bars.position.y = y
		bars.visible = y < 2.5

## she knocks twice from the other side of the pane
func hint() -> void:
	if game.sfx:
		game.sfx.play("glass_tink", -14.0, 1.1)
		game.sfx.play_later("glass_tink", 0.35, -14.0, 1.1)
	if game.juice: game.juice.glint(PANE)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [PANE.x - 0.85, PANE.z])
	var tw := create_tween()
	tw.tween_interval(3.0)
	tw.tween_callback(func() -> void: game.try_interact())
	tw.tween_interval(9.0)
	tw.tween_callback(func() -> void: game.cmd("glass_try:right"))
	tw.tween_interval(1.0)
	tw.tween_callback(func() -> void: if not done: solve())
