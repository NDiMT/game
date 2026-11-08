extends Puzzle
## I.21 "The Bridge that Gives Way" (CH1_V3 §1 #36, story set-piece): eight stone spans over the black lagoon to the
## Gate. No way back: two spans behind her, each one settles with a crack and falls into the water. Over the deep
## middle, the span under her sags; she staggers, and the view swings out to the Observer's veiled head turned toward
## the bridge (CineCam, 4 s), then back. Done = across (the spans behind stay fallen; a story beat: no jingle, no hint).
## A: "I21_Span_*" (deck + balustrade, one marble node each), "I21_Piers" (merged).

const N := 8
const X0 := -14.0                          # the east end (the Far Shore)
const LEN := 2.5
const Z0 := 26.15
const Z1 := 28.85
const SAG := 4                             # the span that sags under her (over the deep middle, by the Observer)
var spans: Array[Node3D] = []
var fallen := []
var _sagged := false

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var col := Color(0.5, 0.25, 0.0)
	var piers := MB.new()
	for i in N:
		var xa := X0 - LEN * (i + 1)
		var xb := X0 - LEN * i
		var sp := Node3D.new()
		sp.name = "I21_Span_%d" % i
		add_child(sp)
		sp.position = Vector3((xa + xb) * 0.5, 0.0, (Z0 + Z1) * 0.5)
		var m := MB.new()
		m.tag = "floor"
		m.box(Vector3(0, -0.14, 0), Vector3(LEN - 0.04, 0.28, Z1 - Z0), col)
		m.box(Vector3(0, -0.36, 0), Vector3(LEN - 0.3, 0.16, Z1 - Z0 - 0.4), Color(0.5, 0.0, 0.0))
		for side in [-1.0, 1.0]:
			var z: float = side * ((Z1 - Z0) * 0.5 - 0.08)
			m.box(Vector3(0, 0.56, z), Vector3(LEN - 0.08, 0.07, 0.12), col)
			for b in 4:
				m.cyl(Vector3(-LEN * 0.5 + 0.3 + b * (LEN - 0.6) / 3.0, 0.27, z), 0.045, 0.055, 0.52, Color(0.5, 0.0, 0.0), 6)
		Kit3.marble(game, m.commit(), sp)
		spans.append(sp)
		fallen.append(false)
		game.level.ob_rect(Rect2(xa + 0.02, Z0, LEN - 0.04, Z1 - Z0), "i21_gone_%d" % i, false)
		if i > 0: piers.cyl(Vector3(xb, -1.05, (Z0 + Z1) * 0.5), 0.42, 0.55, 1.6, col, 12)
	Kit3.marble(game, piers.commit(), self).name = "I21_Piers"

func _span_of(x: float) -> int:
	return clampi(int(floor((X0 - x) / LEN)), -1, N)

func tick(_dt: float) -> void:
	if done or game.mode != "play": return
	var p := game.player.position
	if p.z < Z0 - 0.2 or p.z > Z1 + 0.2: return
	var at := _span_of(p.x)
	# two spans behind her: they go
	for i in range(0, at - 1):
		if i < N - 1 and not fallen[i]: _fall(i, false)
	if not _sagged and at == SAG and p.x < X0 - LEN * SAG - LEN * 0.4:
		_sagged = true
		_sag()
	if p.x < X0 - LEN * (N - 1) - 0.3:
		solve()

## a span settles with a crack, hangs a breath, and drops into the lagoon (the way back is gone)
func _fall(i: int, snap: bool) -> void:
	fallen[i] = true
	state["fallen"] = fallen.duplicate()
	game.level.set_enabled("i21_gone_%d" % i, true)
	var sp := spans[i]
	if snap:
		sp.visible = false
		return
	var tw := sp.create_tween()
	tw.tween_property(sp, "position:y", -0.12, 0.25).set_trans(Tween.TRANS_BOUNCE)
	tw.tween_interval(0.5 + randf() * 0.3)
	tw.tween_property(sp, "position:y", -4.0, 1.4).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(sp, "rotation:z", (0.25 if i % 2 == 0 else -0.25), 1.4)
	tw.tween_callback(func() -> void: sp.visible = false)
	var c := sp.global_position
	if game.sfx:
		game.sfx.play("grind", -12.0, 0.6)
		game.sfx.play_later("hollow", 0.8, -10.0, 0.5)
		game.sfx.play_later("step_wet", 1.6, -6.0, 0.4)
	if game.juice:
		game.juice.dust_floor(c, 1.2, 14)
		game.juice.shake(0.05)
		get_tree().create_timer(1.6).timeout.connect(func() -> void: game.juice.ring(Vector3(c.x, -0.33, c.z), 3.0, 2.2))

## over the deep middle: the span under her drops a hand, she staggers; the view swings out to the veiled head
func _sag() -> void:
	var sp := spans[SAG]
	var tw := sp.create_tween()
	tw.tween_property(sp, "position:y", -0.1, 0.18).set_trans(Tween.TRANS_BOUNCE)
	tw.tween_property(sp, "position:y", -0.06, 0.6)
	if game.juice:
		game.juice.shake(0.12)
		game.juice.dust_floor(game.player.position, 1.0, 16)
	if game.sfx:
		game.sfx.play("door", -8.0, 0.45)
		game.sfx.play_later("hollow", 0.3, -8.0, 0.4)
	game.call("perform", "flinch_seen", game.player.position + Vector3(0, 0.6, 2.0), func() -> void: _look())

func _look() -> void:
	var p := game.player.position
	var head := Map3.OBSERVER + Vector3(0, 4.0, 0)
	var c := Cinematic.new(game)
	c.path(0.0, 4.2, [p + Vector3(-1.4, 1.6, -2.4), p + Vector3(-0.4, 2.4, -3.2)], [p + Vector3(0, 0.8, 0), head], 42.0, 30.0, 1)
	c.handoff(4.2, 1.6)
	c.at(0.6, func() -> void: if game.sfx: game.sfx.cue("glimpse", -12.0), false)
	c.at(1.5, func() -> void: if game.sfx: game.sfx.play("bell_far", -18.0, 0.45), false)
	game.call("play_cine", c)

func apply() -> void:
	super.apply()
	_sagged = done
	for i in N:
		var down := done and i < N - 1          # (an unfinished crossing is whole again on a load)
		fallen[i] = false
		spans[i].visible = true
		spans[i].position.y = 0.0
		spans[i].rotation.z = 0.0
		game.level.set_enabled("i21_gone_%d" % i, false)
		if down: _fall(i, true)

var _auto := false

func autosolve() -> void:
	_auto = true

## (the stagger stops her walk: the test walker walks on, as a player would)
func update(dt: float) -> void:
	super.update(dt)
	if not _auto or done:
		_auto = false
		return
	if game.mode == "play" and game.auto_target == Vector3.INF and not bool(game.get("_acting")):
		game.cmd("walk:%f:%f" % [X0 - LEN * N + 0.9, (Z0 + Z1) * 0.5])
