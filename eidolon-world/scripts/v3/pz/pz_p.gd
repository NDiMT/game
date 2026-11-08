extends Puzzle
## I.20 "The Pool of Halves" (CH1_V3 §2, ★★★★): back at the waking pool, its fog gone. Four broken slabs lie in a line
## across the black water to the far shore: your half of each in your world, its other half only in HER world (the
## water shows it). I.4's rule: turn your half (tap: a quarter) until the carved halves meet; the slab rises and you
## walk onto it to reach the next. Teach: S1 (one turn). Test: S2 (an asymmetric half: three). Twist (S3, S4): here
## she COPIES you: as you turn your half, half a second later her half turns too, so the seam never closes by turning.
## Be still beside it: when you are still, she is free (N.4) and turns hers alone, a quarter at a time, until you move.
## Each joined slab latches and rises; the fourth opens the far shore. Clips: reach (taps), her reach in the water.

const HALF := 0.78
const TOP_LOW := -0.28                     # a half's top before it rises (just proud of the surface, -0.35)
## [centre of the slab, direction from your half to hers, rune design, your goal (quarters), her goal (-1: fixed),
##  where you stand to turn it]
const SLABS := [
	[Vector2(-6.4, 24.85), Vector2(0, 1), 3.0, 1, -1, Vector2(-6.4, 23.82)],
	[Vector2(-6.4, 26.45), Vector2(0, 1), 1.0, 3, -1, Vector2(-6.4, 25.35)],
	[Vector2(-7.6, 27.65), Vector2(-1, 0), 2.0, 2, 3, Vector2(-6.4, 27.65)],
	[Vector2(-9.2, 27.65), Vector2(-1, 0), 4.0, 1, 3, Vector2(-8.05, 27.65)],
]
const ISLAND := Vector2(-6.4, 27.65)
var mine: Array[Node3D] = []
var hers: Array[Node3D] = []
var seams: Array[ShaderMaterial] = []
var runes: Array[ShaderMaterial] = []
var island: Node3D
var y := [0, 0, 0, 0]                      # your halves' quarters
var h := [0, 0, 0, 0]                      # hers
var joined := [false, false, false, false]
var pool: Reflector
var actor: ReflActor
var _still := 0.0
var _turning := false
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 90.0
	var lv := game.level
	for k in SLABS.size():
		var s: Array = SLABS[k]
		var c: Vector2 = s[0]
		var d: Vector2 = s[1]
		var a := _half(c - d * HALF * 0.5, "P_Mine_%d" % k, s[2], d, 0.35)
		var b := _half(c + d * HALF * 0.5, "P_Hers_%d" % k, s[2], -d, 0.9)
		mine.append(a[0])
		runes.append(a[1])
		hers.append(b[0])
		seams.append(Kit3.glow(self, Vector3(c.x, 0.05, c.y), 0.9, Palette.HER, 0.0))
		var r := Rect2(c - Vector2(HALF * 0.5, HALF * 0.5) - d.abs() * HALF * 0.5, Vector2(HALF, HALF) + d.abs() * HALF).grow(0.03)
		lv.walk(r, 0.0, NAN, -1, Map3.ZP + "P~s%d" % k, false)
		var kk := k
		lv.add_interact("p_turn%d" % k, Vector3(s[5].x, 0.0, s[5].y), "turn", func() -> void: turn(kk), 0.75,
			func() -> bool: return not joined[kk] and (kk == 0 or joined[kk - 1]))
	island = Node3D.new()
	island.name = "P_Island"
	add_child(island)
	island.position = Vector3(ISLAND.x, TOP_LOW - 0.15, ISLAND.y)
	var im := MB.new()
	im.tag = "floor"
	im.box(Vector3.ZERO, Vector3(HALF + 0.02, 0.3, HALF + 0.02), Color(0.5, 0.25, 0.0))
	Kit3.marble(game, im.commit(), island)
	lv.walk(Rect2(ISLAND - Vector2(HALF, HALF) * 0.5, Vector2(HALF, HALF)).grow(0.03), 0.0, NAN, -1, Map3.ZP + "P~isle", false)

## one half: a stone with a carved half-rune on its top, the rune toward the seam
func _half(at: Vector2, nm: String, design: float, to_seam: Vector2, lit: float) -> Array:
	var n := Node3D.new()
	n.name = nm
	add_child(n)
	n.position = Vector3(at.x, TOP_LOW - 0.15, at.y)
	var m := MB.new()
	m.tag = "floor"
	m.box(Vector3.ZERO, Vector3(HALF, 0.3, HALF), Color(0.5, 0.25, 0.0))
	Kit3.marble(game, m.commit(), n)
	var rm := Kit3.rune(n, Vector3(to_seam.x * 0.2, 0.158, to_seam.y * 0.2), Vector2(0.42, 0.42), Basis(Vector3.RIGHT, -PI * 0.5), design, lit)
	return [n, rm]

func post() -> void:
	var ws: Puzzle = (game.get("ch") as Ch1v3).pz["WS"]
	pool = ws.get("pool")
	actor = ReflActor.new(pool)
	actor.name = "P_Actor"
	add_child(actor)
	for b in hers: TwoWorld.set_her(b)

func _slab_now() -> int:
	for k in SLABS.size():
		if not joined[k]: return k
	return -1

func turn(k: int) -> void:
	if done or joined[k] or _turning: return
	var s: Array = SLABS[k]
	_still = 0.0
	if actor and actor.busy(): actor.cancel()
	game.call("perform", "reach", mine[k].global_position + Vector3(0, 0.2, 0), func() -> void: _turn_mine(k))

func _turn_mine(k: int) -> void:
	y[k] = (y[k] + 1) % 4
	state["y"] = y.duplicate()
	progress()
	_spin(mine[k], y[k], SLABS[k][1])
	if game.sfx: game.sfx.play("grind", -14.0, 1.2)
	if game.juice: game.juice.grit(mine[k].global_position + Vector3(0, 0.15, 0), 0.4)
	if int(SLABS[k][4]) >= 0:
		# she copies you, half a second late: her half turns the same way (a crimson ripple where it lies)
		_turning = true
		get_tree().create_timer(0.5).timeout.connect(func() -> void:
			_turning = false
			_turn_hers(k, true))
	else:
		get_tree().create_timer(0.55).timeout.connect(func() -> void: _check(k))

func _turn_hers(k: int, copy: bool) -> void:
	if joined[k]: return
	h[k] = (h[k] + 1) % 4
	state["h"] = h.duplicate()
	_spin(hers[k], h[k], -(SLABS[k][1] as Vector2))
	var p := hers[k].global_position
	if game.juice: game.juice.ring(Vector3(p.x, -0.34, p.z), 0.9 if copy else 1.2, 1.2)
	if game.sfx: game.sfx.play("grind", -22.0 if copy else -18.0, 0.95)
	get_tree().create_timer(0.55).timeout.connect(func() -> void: _check(k))

## a half's quarters: its yaw (the seam side's base yaw + quarters)
func _spin(n: Node3D, q: int, _d: Vector2) -> void:
	var tw := n.create_tween()
	var to := -PI * 0.5 * q
	var from := n.rotation.y
	if to > from + 0.01: from += TAU
	n.rotation.y = from
	tw.tween_property(n, "rotation:y", to, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _ok(k: int) -> bool:
	var s: Array = SLABS[k]
	return y[k] == int(s[3]) and (int(s[4]) < 0 or h[k] == int(s[4]))

func _check(k: int) -> void:
	if joined[k] or not _ok(k): return
	_join(k, false)

## the halves meet: the seam flares crimson, her half becomes stone in both worlds, the slab rises to the road
func _join(k: int, snap: bool) -> void:
	joined[k] = true
	state["j"] = joined.duplicate()
	if actor and actor.busy(): actor.cancel()
	TwoWorld._layer(hers[k], TwoWorld.BOTH)
	runes[k].set_shader_parameter("lit", 1.0)
	var nodes: Array = [mine[k], hers[k]]
	if k == 1: nodes.append(island)
	var seam := seams[k]
	if snap:
		for n: Node3D in nodes: n.position.y = -0.15
		seam.set_shader_parameter("intensity", 0.22)
		_regions(k)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: seam.set_shader_parameter("intensity", v), 0.0, 1.5, 0.35)
	tw.tween_method(func(v: float) -> void: seam.set_shader_parameter("intensity", v), 1.5, 0.22, 1.8)
	for n: Node3D in nodes:
		var t2 := n.create_tween()
		t2.tween_interval(0.4)
		t2.tween_property(n, "position:y", -0.15, 1.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var c: Vector2 = SLABS[k][0]
	if game.juice:
		game.juice.ring(Vector3(c.x, -0.33, c.y), 2.0, 1.8)
		game.juice.dust_floor(Vector3(c.x, 0.0, c.y), 0.6, 10)
		game.juice.shake(0.05)
	if game.sfx:
		game.sfx.play("door", -12.0, 1.3)
		game.sfx.play("step_wet", -14.0, 0.7)
	get_tree().create_timer(1.6).timeout.connect(func() -> void:
		_regions(k)
		if k == SLABS.size() - 1: solve()
		else: progress())

func _regions(k: int) -> void:
	_region(Map3.ZP + "P~s%d" % k, true)
	if k == 1: _region(Map3.ZP + "P~isle", true)
	if k == SLABS.size() - 1: _region(Map3.ZP + "P~PW", true)

func _region(nm: String, on: bool) -> void:
	for g in game.level.regions:
		if g.name == nm: g.enabled = on

## (S3, S4) be still beside it: she steps off your reflection and turns her half, a quarter at a time, till you move
func tick(dt: float) -> void:
	if done or actor == null: return
	var k := _slab_now()
	if k < 2 or game.mode != "play":
		_still = 0.0
		return
	var spot: Vector2 = SLABS[k][5]
	var p := game.player.position
	var near_spot := Vector2(p.x, p.z).distance_to(spot) < 0.8
	var still := game.player.speed01 < 0.05 and not bool(game.get("_acting")) and not _turning
	if not still or not near_spot:
		_still = 0.0
		if actor.busy() and actor.state != "rejoin": actor.cancel()
		return
	_still += dt
	if _still < 1.3: return
	var free := actor.state == "follow" and not actor.busy()
	var waiting := actor.state == "hold" and actor._queue.is_empty()
	if not free and not waiting: return
	_still = 0.5
	if free:
		var her_at: Vector3 = hers[k].global_position
		actor.detach()
		actor.go([Vector3(spot.x, 0.0, spot.y).lerp(Vector3(her_at.x, 0.0, her_at.z), 0.35)])
	actor.act("reach", 1.3, func() -> void: _turn_hers(k, false), 0.55)

func hint() -> void:
	var k := _slab_now()
	if k < 0: return
	var n: Node3D = mine[k] if y[k] != int(SLABS[k][3]) else hers[k]
	var p := n.global_position
	if game.juice: game.juice.ring(Vector3(p.x, -0.34, p.z), 0.9, 1.3)
	if game.sfx:
		game.sfx.play("glass_tink", -16.0, 0.9)
		game.sfx.play_later("glass_tink", 0.35, -16.0, 0.9)

func on_solved() -> void:
	if game.sfx: game.sfx.play_later("chime", 0.4, -16.0, 0.9)

func apply() -> void:
	super.apply()
	if actor: actor.stop()
	_still = 0.0
	_turning = false
	var sy: Array = state.get("y", [0, 0, 0, 0])
	var sh: Array = state.get("h", [0, 0, 0, 0])
	var sj: Array = state.get("j", [false, false, false, false])
	for k in SLABS.size():
		var s: Array = SLABS[k]
		joined[k] = done or bool(sj[k])
		y[k] = int(s[3]) if joined[k] else int(sy[k])
		h[k] = (int(s[4]) if int(s[4]) >= 0 else 0) if joined[k] else int(sh[k])
		mine[k].rotation.y = -PI * 0.5 * y[k]
		hers[k].rotation.y = -PI * 0.5 * h[k]
		for n: Node3D in [mine[k], hers[k]]: n.position.y = TOP_LOW - 0.15
		if k == 1: island.position.y = TOP_LOW - 0.15
		seams[k].set_shader_parameter("intensity", 0.0)
		runes[k].set_shader_parameter("lit", 0.35)
		TwoWorld.set_her(hers[k])
		_region(Map3.ZP + "P~s%d" % k, false)
	_region(Map3.ZP + "P~isle", false)
	_region(Map3.ZP + "P~PW", false)
	for k in SLABS.size():
		if joined[k]: _join(k, true)

## as a player would: tap each slab round; at the copying two, tap yours right, then stand still till hers comes round
func autosolve() -> void:
	_auto = []
	for k in SLABS.size():
		var s: Array = SLABS[k]
		_auto.append(s[5])
		var taps: int = (int(s[3]) - int(y[k]) + 4) % 4
		for i in taps: _auto.append("tap")
		_auto.append(["wait", k])

func update(dt: float) -> void:
	super.update(dt)
	if _auto.is_empty() or done: return
	_auto_t += dt
	if game.auto_target != Vector3.INF or _auto_t < 0.6 or _turning or bool(game.get("_acting")): return
	var q: Variant = _auto[0]
	if q is Array:
		if not joined[int(q[1])]: return
		if _auto_t < 1.8: return
	_auto.pop_front()
	_auto_t = 0.0
	if q is String:
		game.try_interact()
	elif q is Vector2:
		game.cmd("walk:%f:%f" % [(q as Vector2).x, (q as Vector2).y])
