extends Puzzle
## I.22 "The Gate of the Four" (CH1_V3 §2, ★★★): a sealed gate of veined stone; on its lintel four lamps, three
## burning (the three Beacons). Before it, four plinths: three veiled statues and one empty. The gate counts
## statues. Be the fourth: stand on the empty plinth and be still. As you hold, the fourth lamp gathers, the stone
## creeps up her limbs (grit, a low grinding), the statues' veils stir; 3 s and the gate counts four and sinks.
## Moving resets the count (the lamp gutters back). Foreshadows the rune: Stillness. Clip: statue_still (A, P1).

const PLINTHS := [Vector2(-44.2, 24.4), Vector2(-42.3, 24.4), Vector2(-37.7, 24.4), Vector2(-35.8, 24.4)]
const EMPTY := 2
const TOP := 0.22
const HOLD := 3.0
const STATUES := ["statue_veiled_mourning", "statue_veiled_kneeling", "", "statue_veiled_unfinished"]
const LAMPS_X := [-41.0, -40.33, -39.67, -39.0]
const LAMP_Y := 2.6
const LINTEL_Z := 22.48
var lamps: Array[Flame] = []
var count := 0.0
var _grit_t := 0.0
var _posed := false

func build() -> void:
	test_s = 30.0
	gate("I22", "I23")
	var lv := game.level
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	for i in PLINTHS.size():
		var p: Vector2 = PLINTHS[i]
		m.box(Vector3(p.x, TOP * 0.5, p.y), Vector3(0.9, TOP, 0.9), col)
		m.box(Vector3(p.x, TOP + 0.015, p.y), Vector3(0.96, 0.03, 0.96), Color(0.5, 0.0, 0.0))
		if i == EMPTY:
			lv.walk(Rect2(p.x - 0.42, p.y - 0.42, 0.84, 0.84), TOP + 0.03, NAN, -1, Map3.ZP + "I22~plinth")
		else:
			lv.ob_circle(p, 0.5)
	# two posts before the gate carry a lintel, and on it the four lamps
	for sx in [-1.0, 1.0]:
		m.box(Vector3(-40.0 + sx * 1.38, 1.2, LINTEL_Z), Vector3(0.3, 2.4, 0.3), col)
		lv.ob_rect(Rect2(-40.0 + sx * 1.38 - 0.17, LINTEL_Z - 0.17, 0.34, 0.34))
	m.box(Vector3(-40.0, 2.47, LINTEL_Z), Vector3(3.1, 0.14, 0.34), col)
	for x: float in LAMPS_X: m.cyl(Vector3(x, LAMP_Y - 0.03, LINTEL_Z), 0.09, 0.06, 0.1, Color(0.5, 0.9, 0.0), 10)
	Kit3.marble(game, m.commit(), self).name = "I22_Plinths"
	lv.add_interact("i22_gate", Vector3(-40.0, 0.0, 23.0), "touch", touch_gate, 0.9, func() -> bool: return not done)

func post() -> void:
	for i in PLINTHS.size():
		var nm: String = STATUES[i]
		if nm == "": continue
		var p: Vector2 = PLINTHS[i]
		Kit3.prop(self, nm, Vector3(p.x, TOP + 0.03, p.y), 1.25, 180.0).name = "I22_Statue_%d" % i
	for i in LAMPS_X.size():
		var f := Kit3.flame(game, self, Vector3(LAMPS_X[i], LAMP_Y + 0.1, LINTEL_Z), 0.14, i < 3)
		f.name = "I22_Lamp_%d" % i
		lamps.append(f)

## the gate does not open to a hand: a dull knock, and the three lamps lean toward the empty plinth
func touch_gate() -> void:
	game.call("perform", "reach", Vector3(-40.0, 1.2, 22.15), func() -> void:
		progress()
		if game.sfx: game.sfx.play("hollow", -12.0, 0.8)
		var p: Vector2 = PLINTHS[EMPTY]
		if game.juice: game.juice.glint(Vector3(p.x, TOP + 0.1, p.y))
		game.ui.show_text("Three lamps burn. It waits for a fourth.", game.player.position, 4.0))

func _on_plinth() -> bool:
	var p := game.player.position
	var q: Vector2 = PLINTHS[EMPTY]
	return Vector2(p.x, p.z).distance_to(q) < 0.36

func tick(dt: float) -> void:
	if done: return
	var still := game.mode == "play" and _on_plinth() and game.player.speed01 < 0.04 and not bool(game.get("_acting"))
	if still:
		if count == 0.0: progress()
		count += dt
		_creep(dt)
		if count >= HOLD:
			solve()
			return
	elif count > 0.0:
		count = 0.0
		_unpose()
		if game.sfx: game.sfx.play("flip", -24.0, 0.7)
	lamps[3].mat.set_shader_parameter("intensity", 0.9 * clampf(count / HOLD, 0.0, 1.0))

## the stone creeps up her (A: statue_still; until then grit at her feet climbing her, a grinding that rises)
func _creep(dt: float) -> void:
	var rig := game.player.fig.rig
	if not _posed and count > 0.4:
		_posed = true
		if rig and HeroineClips.has("statue_still"): rig.play("statue_still", {"hold": true})
		if game.sfx: game.sfx.play("grind", -20.0, 0.55)
	_grit_t -= dt
	if _grit_t <= 0.0 and game.juice:
		_grit_t = 0.45
		var k := clampf(count / HOLD, 0.0, 1.0)
		game.juice.grit(game.player.position + Vector3(0, 0.1 + 0.9 * k, 0), 0.25)
		if game.sfx: game.sfx.play("grind", -26.0 + 6.0 * k, 0.5 + 0.4 * k)

func _unpose() -> void:
	if not _posed: return
	_posed = false
	var rig := game.player.fig.rig
	if rig and rig.is_playing("statue_still"): rig.stop(0.4)

func on_solved() -> void:
	_unpose()
	lamps[3].mat.set_shader_parameter("intensity", 0.9)
	OmenFx.gate_sink(self, Vector3(-40.0, 0.0, 22.0), Vector3.RIGHT, 2.0, 3.4, Vector3.FORWARD)
	if game.sfx:
		game.sfx.play("door", -6.0, 0.55)
		game.sfx.play_later("bell_far", 1.2, -16.0, 0.6)
	if game.juice: game.juice.shake(0.08)
	game.ui.show_text("Four.\nI was the fourth. I was stone.", game.player.position, 4.5)

## the empty plinth glints and the three lamps flicker toward it
func hint() -> void:
	var p: Vector2 = PLINTHS[EMPTY]
	if game.juice:
		game.juice.glint(Vector3(p.x, TOP + 0.1, p.y))
		game.juice.ring(Vector3(p.x, TOP + 0.04, p.y), 1.0, 1.2)
	if game.sfx:
		game.sfx.play("glass_tink", -16.0, 0.9)
		game.sfx.play_later("glass_tink", 0.35, -16.0, 0.9)

func apply() -> void:
	super.apply()
	count = 0.0
	_posed = false
	for i in lamps.size(): lamps[i].mat.set_shader_parameter("intensity", 0.9 if (i < 3 or done) else 0.0)

func autosolve() -> void:
	var p: Vector2 = PLINTHS[EMPTY]
	game.cmd("walk:%f:%f" % [p.x, p.y])
