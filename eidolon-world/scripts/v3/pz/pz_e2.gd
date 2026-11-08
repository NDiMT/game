extends Puzzle
## E.2 "The Singing Stones" (CH1_V3 §2, ★★): four sounding stones set flush in the floor, each one note of her motif
## (A D E F). She plays a phrase once, unseen: a crimson ring blooms on each stone as it sings. Step the stones in that
## order. Teach: 2 notes. Test: 4 notes (her own motif, heard since the prologue). The little bell replays the phrase.
## A wrong note: a sour tone, the stones dim softly, the phrase starts over. Solved: the sealed panel east sinks.

const STONES := [Vector2(23.5, -26.6), Vector2(25.2, -26.6), Vector2(23.5, -24.9), Vector2(25.2, -24.9)]
const NOTES := ["A", "D", "E", "F"]
const PHRASES := [[2, 1], [0, 1, 2, 3]]
const R_ON := 0.42                          # on a stone: within this of its middle
const BELL := Vector3(26.9, 0.0, -27.2)
const GAP := 0.75
var inlays: Array[StandardMaterial3D] = []
var phase := 0                              # 0 teach, 1 test
var heard := false
var _in: Array = []                         # the stones stepped so far in this phrase
var _on := -1                               # the stone she stands on now
var _playing := 0.0                         # > 0 while she plays (steps are not counted)
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 60.0
	gate("E2", "IBE")
	var y := Map3.height("E2", STONES[0])
	var m := MB.new()
	for s: Vector2 in STONES:
		m.cyl(Vector3(s.x, y + 0.02, s.y), 0.5, 0.52, 0.04, Color(0.5, 0.75, 0.0), 20)
	m.cyl(BELL + Vector3(0, y + 0.6, 0), 0.06, 0.08, 1.2, Color(0.5, 0.25, 0.0), 8)
	m.box(BELL + Vector3(0, y + 1.22, 0), Vector3(0.5, 0.06, 0.08), Color(0.5, 0.25, 0.0))
	Kit3.marble(game, m.commit(), self).name = "E2_Stones"
	game.level.ob_circle(Vector2(BELL.x, BELL.z), 0.14)
	game.level.add_interact("e2_bell", BELL + Vector3(-0.55, y, 0.35), "ring", ring, 1.1, func() -> bool: return not done and _playing <= 0.0)

func post() -> void:
	var y := Map3.height("E2", STONES[0])
	for i in STONES.size():
		var s: Vector2 = STONES[i]
		var t := MeshInstance3D.new()
		t.name = "E2_Stone_%d" % i
		var tm := TorusMesh.new()
		tm.inner_radius = 0.34
		tm.outer_radius = 0.4
		tm.rings = 24
		t.mesh = tm
		t.scale = Vector3(1.0, 0.12, 1.0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.32, 0.05, 0.07)
		mat.emission_enabled = true
		mat.emission = Palette.HER
		mat.emission_energy_multiplier = 0.0
		t.material_override = mat
		t.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		t.position = Vector3(s.x, y + 0.042, s.y)
		add_child(t)
		inlays.append(mat)
	var bell := MeshInstance3D.new()
	bell.name = "E2_Bell"
	var bm := CylinderMesh.new()
	bm.top_radius = 0.05
	bm.bottom_radius = 0.13
	bm.height = 0.2
	bell.mesh = bm
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = Color(0.42, 0.33, 0.2)
	bmat.metallic = 0.8
	bmat.roughness = 0.35
	bell.material_override = bmat
	bell.position = BELL + Vector3(-0.18, y + 1.08, 0)
	add_child(bell)

func tick(dt: float) -> void:
	if done: return
	_playing = maxf(0.0, _playing - dt)
	if not here() or game.mode != "play": return
	if not heard:
		heard = true
		play_phrase(1.4)
		return
	var p := game.player.position
	var on := -1
	for i in STONES.size():
		if Vector2(p.x, p.z).distance_to(STONES[i]) < R_ON: on = i
	if on == _on: return
	_on = on
	if on < 0 or _playing > 0.0: return
	_step(on)

func _step(i: int) -> void:
	progress()
	_sing(i, 1.0, false)
	var want: Array = PHRASES[phase]
	if want[_in.size()] != i:
		_in.clear()
		get_tree().create_timer(0.25).timeout.connect(func() -> void:
			if game.sfx: game.sfx.sour(-14.0)
			_dim())
		return
	_in.append(i)
	if _in.size() < want.size(): return
	_in.clear()
	if phase == 0:
		phase = 1
		state["phase"] = 1
		if game.sfx: game.sfx.play_later("chime", 0.5, -18.0, 1.2)
		play_phrase(2.2)
	else:
		solve()

## she plays the phrase: each stone sings, a crimson ring on it (her step, unseen)
func play_phrase(delay := 0.4) -> void:
	var ph: Array = PHRASES[phase]
	_in.clear()
	_playing = delay + GAP * ph.size() + 0.4
	for k in ph.size():
		var i: int = ph[k]
		get_tree().create_timer(delay + GAP * k).timeout.connect(func() -> void: if not done: _sing(i, 0.9, true))

func _sing(i: int, k: float, hers: bool) -> void:
	var s: Vector2 = STONES[i]
	var y := Map3.height("E2", s)
	if game.sfx: game.sfx.note(NOTES[i], -10.0 if hers else -8.0, true)
	if game.juice and hers: game.juice.ring(Vector3(s.x, y + 0.05, s.y), 1.1, 1.2)
	var m := inlays[i]
	var tw := create_tween()
	tw.tween_property(m, "emission_energy_multiplier", 2.6 * k, 0.08)
	tw.tween_property(m, "emission_energy_multiplier", 0.35 if not hers else 0.0, 0.9).set_trans(Tween.TRANS_SINE)

func _dim() -> void:
	for m in inlays:
		var tw := create_tween()
		tw.tween_property(m, "emission_energy_multiplier", 0.0, 0.6)

func ring() -> void:
	game.call("perform", "ring_bell", BELL + Vector3(-0.18, Map3.height("E2", STONES[0]) + 1.1, 0), func() -> void:
		if game.sfx: game.sfx.play("bell", -16.0, 1.6)
		if game.juice: game.juice.glint(BELL + Vector3(-0.18, Map3.height("E2", STONES[0]) + 1.1, 0))
		play_phrase(0.9))

## she knocks twice under the stone that comes next
func hint() -> void:
	var want: Array = PHRASES[phase]
	var s: Vector2 = STONES[want[mini(_in.size(), want.size() - 1)]]
	var y := Map3.height("E2", s)
	if game.juice: game.juice.ring(Vector3(s.x, y + 0.05, s.y), 0.8, 1.4)
	if game.sfx:
		game.sfx.play("glass_tink", -16.0, 0.9)
		game.sfx.play_later("glass_tink", 0.35, -16.0, 0.9)

func on_solved() -> void:
	for k in STONES.size():
		get_tree().create_timer(0.15 * k).timeout.connect(func() -> void:
			var m := inlays[k]
			m.emission_energy_multiplier = 2.2
			create_tween().tween_property(m, "emission_energy_multiplier", 0.5, 1.4))

func apply() -> void:
	super.apply()
	phase = 1 if done else int(state.get("phase", 0))
	heard = done
	_in.clear()
	_on = -1
	_playing = 0.0
	for m in inlays: m.emission_energy_multiplier = 0.5 if done else 0.0

## as a player would: stand clear, hear the phrase, step it; then the second one
func autosolve() -> void:
	_auto = [Vector2(22.3, -25.7)]
	for ph in PHRASES:
		_auto.append("wait")
		for i in ph: _auto.append(STONES[i])
		_auto.append(Vector2(22.3, -25.7))

func update(dt: float) -> void:
	super.update(dt)
	if _auto.is_empty() or done: return
	_auto_t += dt
	if game.auto_target != Vector3.INF or _auto_t < 0.4: return
	if _auto[0] is String:
		if _playing > 0.0 or not heard: return
		_auto.pop_front()
		return
	var q: Vector2 = _auto.pop_front()
	_auto_t = 0.0
	game.cmd("walk:%f:%f" % [q.x, q.y])
