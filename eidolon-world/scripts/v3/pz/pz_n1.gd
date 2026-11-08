extends Puzzle
## N.1 "The Flooded Colonnade" (CH1_V3 §2, ★★): the hall is flooded; fifteen stepping-stones, all alike from above.
## Only the stones SHE treads in the still water hold: stop on the bank and she walks ahead in the reflection, a
## crimson ripple at each of her steps, then comes back to you. A false stone sinks slowly under you and the water
## returns you to the last true one (2 s, the soft return). Across = done (every stone settles firm).

const COLS := [-1.8, 0.0, 1.8]
const ROWS := [-12.6, -13.8, -15.0, -16.2, -17.4]      # south (the Atrium side) to north
const TRUE := [1, 2, 1, 0, 1]                           # her column in each row
const BAND := Rect2(-2.7, -18.0, 5.4, 6.0)
var stones := {}                  # Vector2i(col,row) -> Node3D
var water: Reflector
var actor: ReflActor
var last_true := Vector3.INF
var _sinking := false
var _still := 0.0
var _rip := Vector3.INF
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 45.0
	for r in ROWS.size():
		for c in COLS.size():
			var m := MB.new()
			m.box(Vector3(0, -0.25, 0), Vector3(1.45, 0.5, 1.0), Color(0.5, 0.5, 0.0))
			var n := Node3D.new()
			n.name = "N1_Stone_%d_%d" % [c, r]
			add_child(n)
			n.position = Vector3(COLS[c], 0.0, ROWS[r])
			Kit3.marble(game, m.commit(), n)
			stones[Vector2i(c, r)] = n

func post() -> void:
	var cen := BAND.get_center()
	water = TwoWorld.still_water(self, game, Vector3(cen.x, -0.3, cen.y), BAND.size * 0.5 + Vector2(0.3, 0.0), Map3.rect("N1"), 0.5)
	(game.get("ch") as Ch1v3).add_refl(water)
	actor = ReflActor.new(water)
	actor.name = "N1_Actor"
	add_child(actor)

func cell_at(p: Vector3) -> Vector2i:
	if not BAND.has_point(Vector2(p.x, p.z)): return Vector2i(-1, -1)
	var c := clampi(int(round((p.x - COLS[0]) / 1.8)), 0, 2)
	var r := clampi(int(round((ROWS[0] - p.z) / 1.2)), 0, ROWS.size() - 1)
	return Vector2i(c, r)

func tick(dt: float) -> void:
	if done or not here() or _sinking: return
	var p := game.player.position
	var cl := cell_at(p)
	if cl.x >= 0:
		var on := absf(p.x - COLS[cl.x]) < 0.62 and absf(p.z - ROWS[cl.y]) < 0.42          # (on the stone, not between)
		if TRUE[cl.y] == cl.x: last_true = Vector3(COLS[cl.x], 0.0, ROWS[cl.y])
		elif on: _sink(cl)
	elif p.z < BAND.position.y:
		solve()
		return
	else:
		last_true = Vector3.INF
	# still on the bank or a true stone: she walks ahead in the water
	_still = _still + dt if game.player.speed01 < 0.05 and game.mode == "play" else 0.0
	if _still > 1.0 and not actor.busy() and water.active:
		_still = 0.0
		_walk_ahead(cl.y if cl.x >= 0 else -1)
	if actor.busy() and actor.state == "walk":
		var hp := actor.pos
		if _rip == Vector3.INF or Vector2(hp.x - _rip.x, hp.z - _rip.z).length() > 0.6:
			_rip = hp
			if cell_at(hp).x >= 0 and game.juice: game.juice.ring(Vector3(hp.x, -0.29, hp.z), 0.9, 1.3)

func _walk_ahead(from_row: int) -> void:
	var home := game.player.position
	var pts: Array = []
	for r in range(from_row + 1, ROWS.size()): pts.append(Vector3(COLS[TRUE[r]], 0.0, ROWS[r]))
	pts.append(Vector3(COLS[TRUE[ROWS.size() - 1]], 0.0, BAND.position.y - 0.6))
	var back := pts.duplicate()
	back.reverse()
	back.append(Vector3(home.x, 0.0, home.z))
	actor.detach()
	actor.go(pts)
	actor.act("look_at_you", 1.0)
	actor.go(back)
	actor.rejoin()

## a false stone: it sinks under her, and the water gives her back to the last true one
func _sink(cl: Vector2i) -> void:
	_sinking = true
	progress()
	var st: Node3D = stones[cl]
	game.player.locked = true
	if game.sfx: game.sfx.play("hollow", -12.0, 0.7)
	if game.juice: game.juice.ring(Vector3(st.position.x, -0.29, st.position.z), 1.6, 1.6)
	var tw := create_tween()
	tw.tween_property(st, "position:y", -0.32, 0.9).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(game.player, "position:y", -0.3, 0.9).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		game.ui.fade_to(0.6, 0.3)
		if game.sfx: game.sfx.play("step_wet", -10.0, 0.8))
	tw.tween_interval(0.4)
	tw.tween_callback(func() -> void:
		var to := last_true if last_true != Vector3.INF else Vector3(0.0, 0.0, -11.2)
		game.cmd("tp:%f:%f" % [to.x, to.z])
		game.player.locked = false
		game.ui.fade_to(0.0, 0.5))
	tw.tween_property(st, "position:y", 0.0, 0.8).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void: _sinking = false)

func on_solved() -> void:
	if actor: actor.stop()
	for k in stones:
		if TRUE[k.y] == k.x and game.juice: game.juice.ring(Vector3(COLS[k.x], -0.29, ROWS[k.y]), 1.2, 1.4)

func apply() -> void:
	super.apply()
	if actor: actor.stop()
	_sinking = false
	for k in stones: (stones[k] as Node3D).position.y = 0.0

## she knocks under the water, under the next true stone
func hint() -> void:
	var p := game.player.position
	var cl := cell_at(p)
	var r := cl.y + 1 if cl.x >= 0 else 0
	if r < ROWS.size():
		if game.juice: game.juice.ring(Vector3(COLS[TRUE[r]], -0.29, ROWS[r]), 1.2, 1.5)
		if game.sfx:
			game.sfx.play("glass_tink", -16.0, 0.9)
			game.sfx.play_later("glass_tink", 0.35, -16.0, 0.9)

func autosolve() -> void:
	_auto = []
	for r in ROWS.size(): _auto.append(Vector2(COLS[TRUE[r]], ROWS[r]))
	_auto.append(Vector2(0.0, -18.8))

func update(dt: float) -> void:
	super.update(dt)
	if _auto.is_empty() or done: return
	_auto_t += dt
	if game.auto_target != Vector3.INF or _auto_t < 0.3: return
	var q: Vector2 = _auto.pop_front()
	_auto_t = 0.0
	game.cmd("walk:%f:%f" % [q.x, q.y])
