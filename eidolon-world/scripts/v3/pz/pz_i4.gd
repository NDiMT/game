extends Puzzle
## I.4 "The One Slab" (CH1_V3 §2): the crossing over the still stream has only one slab, and it lies turned. Its other
## half is only in HER world: you see it in the stream's reflection, beside yours. Tap: she turns your half a quarter.
## When the carved halves meet (2 quarters), the seam glows crimson and the stone grows a real bridge. 4 states, it
## cycles; no fail.

const C := Vector3(9.0, 0.0, 13.5)               # the crossing's middle (the stream x 8.2..9.8)
const GOAL := 2
var slab: Node3D
var her_half: Node3D
var mine_mat: ShaderMaterial
var her_mat: ShaderMaterial
var seam: ShaderMaterial
var stream: Reflector
var turns := 0

func build() -> void:
	var lv := game.level
	lv.ob_rect(Rect2(8.2, 10.0, 1.6, 3.0))
	lv.ob_rect(Rect2(8.2, 14.0, 1.6, 3.0))
	lv.ob_rect(Rect2(8.2, 13.0, 1.6, 1.0), "i4_bridge")
	var col := Color(0.5, 0.25, 0.0)
	# your half: it turns about its middle, a carved half-rune on its top
	slab = Node3D.new()
	slab.position = C + Vector3(0.4, -0.15, 0)
	add_child(slab)
	var sm := MB.new()
	sm.tag = "floor"
	sm.box(Vector3.ZERO, Vector3(0.78, 0.3, 0.96), col)
	Kit3.marble(game, sm.commit(), slab)
	mine_mat = Kit3.rune(slab, Vector3(-0.18, 0.158, 0), Vector2(0.42, 0.42), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.35)
	# her half: where the crossing's west half should be, at the bank's height: only the stream shows it
	her_half = Node3D.new()
	her_half.position = C + Vector3(-0.4, -0.15, 0)
	add_child(her_half)
	var hm := MB.new()
	hm.tag = "floor"
	hm.box(Vector3.ZERO, Vector3(0.78, 0.3, 0.96), col)
	Kit3.marble(game, hm.commit(), her_half)
	her_mat = Kit3.rune(her_half, Vector3(0.18, 0.158, 0), Vector2(0.42, 0.42), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.9)
	seam = Kit3.glow(self, C + Vector3(0, 0.05, 0), 0.9, Palette.HER, 0.0)
	game.level.add_interact("i4_turn", C + Vector3(1.45, 0.0, 0.0), "turn", turn, 1.1, func() -> bool: return not done)

func post() -> void:
	stream = TwoWorld.still_water(self, game, Vector3(C.x, -0.35 + 0.012, C.z), Vector2(0.8, 2.6), Map3.rect("I4"), 0.5)
	(game.get("ch") as Ch1v3).add_refl(stream)
	TwoWorld.set_her(her_half)

func turn() -> void:
	if done: return
	game.call("perform", "reach", slab.global_position + Vector3(0.1, 0.2, 0), func() -> void: _turn())

func _turn() -> void:
	turns = (turns + 1) % 4
	state["turns"] = turns
	progress()
	var tw := slab.create_tween()
	tw.tween_property(slab, "rotation:y", -PI * 0.5 * turns if turns != 0 else -TAU, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if turns == 0: tw.tween_callback(func() -> void: slab.rotation.y = 0.0)
	if game.sfx: game.sfx.play("grind", -14.0, 1.2)
	if game.juice: game.juice.grit(slab.global_position + Vector3(0, 0.15, 0), 0.4)
	if turns == GOAL: tw.tween_callback(func() -> void: solve())

func on_solved() -> void:
	_joined(false)

func apply() -> void:
	super.apply()
	turns = GOAL if done else int(state.get("turns", 0))
	slab.rotation.y = -PI * 0.5 * turns
	if done: _joined(true)
	else: _parted()

func _parted() -> void:
	game.level.set_enabled("i4_bridge", true)
	TwoWorld.set_her(her_half)
	mine_mat.set_shader_parameter("lit", 0.35)
	seam.set_shader_parameter("intensity", 0.0)

## the halves meet: the seam glows, her half becomes real stone (both worlds), the crossing is open
func _joined(instant: bool) -> void:
	game.level.set_enabled("i4_bridge", false)
	TwoWorld._layer(her_half, TwoWorld.BOTH)
	mine_mat.set_shader_parameter("lit", 1.0)
	if instant:
		seam.set_shader_parameter("intensity", 0.25)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: seam.set_shader_parameter("intensity", v), 0.0, 1.4, 0.35)
	tw.tween_method(func(v: float) -> void: seam.set_shader_parameter("intensity", v), 1.4, 0.25, 1.6)
	her_half.scale = Vector3(1, 0.05, 1)
	var t2 := her_half.create_tween()
	t2.tween_property(her_half, "scale", Vector3.ONE, 1.1).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if game.juice:
		game.juice.dust_floor(C, 0.6, 12)
		game.juice.glint(C + Vector3(0, 0.4, 0))
		game.juice.shake(0.06)
	if game.sfx: game.sfx.play("door", -12.0, 1.3)

## her hand knocks under the water, under her half
func hint() -> void:
	if game.juice: game.juice.ring(C + Vector3(-0.4, -0.34, 0), 0.9, 1.2)
	if game.sfx:
		game.sfx.play("glass_tink", -16.0, 0.9)
		game.sfx.play_later("glass_tink", 0.35, -16.0, 0.9)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [C.x + 1.45, C.z])
	var tw := create_tween()
	tw.tween_interval(3.0)
	for i in GOAL:
		tw.tween_callback(func() -> void: game.try_interact())
		tw.tween_interval(1.8)
