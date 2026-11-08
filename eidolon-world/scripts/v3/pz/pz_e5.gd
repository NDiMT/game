extends Puzzle
## E.5 "The Scales" (CH1_V3 §2, ★★★★): a great balance fills the hall: a bronze beam on a post, a stone pan at each end.
## The west (near) pan carries a sealed stone that weighs FIVE; three bronze weights (one each) hang on the near arm.
## The east (far) pan is half dry stone, half a sheet of still water in a bronze frame. Level the beam and the lift (the
## north door) rises. Teach: step on a pan, it dips a notch: you count (one). Test: hang the weights on the far arm:
## 5 against 3, close, but the weights can't win alone. Twist: on the far pan's dry half you make it 4; stand in its
## WATER and your reflection stands there with you: the balance counts her too (two). 5 = 5. Free to undo; it latches
## once level for a breath. Clips: reach_high / hang_weight (A; reach stands in).

const SEAL := 5
const PIVOT := Vector3(29.4, 0.0, -62.0)
const ARM := 4.2                              # pivot to each pan's middle
const BEAM_Y := 2.3
const NEAR_SLOTS := [-3.0, -2.2, -1.4]        # along the beam from the pivot (west: negative)
const FAR_SLOTS := [1.4, 2.2, 3.0]
const NOTCH := 0.028                          # beam tilt per unit of difference (radians)
var y0 := 3.0
var beam: Node3D
var pans: Array[Node3D] = []
var weights: Array[Node3D] = []
var w_far := [false, false, false]            # each weight: on the far arm
var interacts: Array = []
var water: Reflector
var tilt := 0.0
var _level_t := 0.0
var _on_k := -1                               # the pan she stood on last frame (-1 none, 0 near, 1 far dry, 2 far water)
var _auto: Array = []
var _auto_t := 0.0
var _moving := 0

func build() -> void:
	test_s = 60.0
	gate("E5", "EB")
	y0 = Map3.height("E5", Vector2(PIVOT.x, PIVOT.z))
	var piv := PIVOT + Vector3(0, y0, 0)
	var m := MB.new()
	m.cyl(piv + Vector3(0, 0.12, 0), 0.55, 0.6, 0.24, Color(0.5, 0.25, 0.0), 16)
	m.cyl(piv + Vector3(0, BEAM_Y * 0.5, 0), 0.2, 0.26, BEAM_Y, Color(0.5, 0.0, 0.0), 14)
	m.box(piv + Vector3(0, BEAM_Y - 0.02, 0), Vector3(0.22, 0.36, 0.5), Color(0.5, 0.9, 0.0))
	# the level mark on the post: a crimson-inlaid notch the needle meets when the beam is level
	m.box(piv + Vector3(0, BEAM_Y - 0.55, 0.27), Vector3(0.05, 0.22, 0.02), Color(0.5, 0.75, 0.0))
	Kit3.marble(game, m.commit(), self).name = "E5_Post"
	game.level.ob_circle(Vector2(PIVOT.x, PIVOT.z), 0.6)
	# the beam (it tilts about the post's head): bronze, with its needle
	beam = Node3D.new()
	beam.name = "E5_Beam"
	add_child(beam)
	beam.position = piv + Vector3(0, BEAM_Y + 0.12, 0)
	var bm := MB.new()
	bm.box(Vector3.ZERO, Vector3(ARM * 2.0 + 0.5, 0.16, 0.2), Color(0.5, 0.9, 0.0))
	for sx in [-1.0, 1.0]: bm.box(Vector3(sx * ARM, -0.04, 0), Vector3(0.12, 0.3, 0.32), Color(0.5, 0.9, 0.0))
	bm.box(Vector3(0, -0.42, 0.2), Vector3(0.04, 0.6, 0.04), Color(0.5, 0.9, 0.0))
	Kit3.marble(game, bm.commit(), beam)
	# the pans (flush in the floor: they ride a hand's breadth), with their hangers (child of the beam: they tilt with it)
	for i in 2:
		var sx := -1.0 if i == 0 else 1.0
		var pan := Node3D.new()
		pan.name = "E5_Pan_" + ("near" if i == 0 else "far")
		add_child(pan)
		pan.position = Vector3(PIVOT.x + sx * ARM, y0, PIVOT.z)
		var pm := MB.new()
		pm.box(Vector3(0, 0.012, 0), Vector3(2.3, 0.024, 1.7), Color(0.5, 0.9, 0.0))
		if i == 0:
			pm.box(Vector3(-0.55, 0.38, 0), Vector3(0.8, 0.7, 0.8), Color(0.5, 0.75, 0.0))          # the sealed stone (5)
			pm.box(Vector3(-0.55, 0.75, 0), Vector3(0.86, 0.06, 0.86), Color(0.5, 0.9, 0.0))
		Kit3.marble(game, pm.commit(), pan)
		pans.append(pan)
		var h := MB.new()
		for dz in [-0.8, 0.8]:
			h.box(Vector3(sx * ARM, -(BEAM_Y + 0.12) * 0.5, dz), Vector3(0.04, BEAM_Y + 0.12, 0.04), Color(0.5, 0.9, 0.0))
		h.box(Vector3(sx * ARM, -0.08, 0), Vector3(0.06, 0.06, 1.66), Color(0.5, 0.9, 0.0))
		Kit3.marble(game, h.commit(), beam)
	game.level.ob_rect(Rect2(PIVOT.x - ARM - 1.0, PIVOT.z - 0.45, 0.9, 0.9))          # (the sealed stone)
	# the three weights, hanging on the near arm
	for k in 3:
		var w := Node3D.new()
		w.name = "E5_Weight_%d" % k
		beam.add_child(w)
		w.position = Vector3(NEAR_SLOTS[k], 0, 0)
		var wm := MB.new()
		wm.box(Vector3(0, -0.32, 0), Vector3(0.03, 0.56, 0.03), Color(0.5, 0.9, 0.0))
		wm.cyl(Vector3(0, -0.76, 0), 0.15, 0.18, 0.34, Color(0.5, 0.9, 0.0), 12)
		wm.cyl(Vector3(0, -0.57, 0), 0.06, 0.06, 0.06, Color(0.5, 0.9, 0.0), 8)
		Kit3.marble(game, wm.commit(), w)
		weights.append(w)
		var kk := k
		interacts.append(game.level.add_interact("e5_w%d" % k, Vector3.ZERO, "push", func() -> void: move(kk), 0.9,
			func() -> bool: return not done and _moving == 0))
	_place_interacts()

func post() -> void:
	var far := pans[1].position
	water = TwoWorld.still_water(self, game, Vector3(far.x + 0.55, y0 + 0.045, far.z), Vector2(0.52, 0.72), Map3.rect("E5"), 0.5)
	(game.get("ch") as Ch1v3).add_refl(water)

func _place_interacts() -> void:
	for k in 3:
		var x: float = PIVOT.x + (FAR_SLOTS[k] if w_far[k] else NEAR_SLOTS[k])
		(interacts[k] as Level.Interact).pos = Vector3(x, y0, PIVOT.z + 0.75)

## where she stands: 0 the near pan, 1 the far pan's dry half, 2 its water (her reflection there too), -1 off
func pan_at() -> int:
	var p := game.player.position
	if absf(p.z - PIVOT.z) > 0.85: return -1
	var dx := p.x - PIVOT.x
	if dx < -ARM + 1.15 and dx > -ARM - 1.15: return 0
	if dx > ARM - 1.15 and dx < ARM + 1.15: return 2 if dx > ARM - 0.05 else 1
	return -1

func weigh() -> int:
	var nf := w_far.count(true)
	var near := SEAL + (3 - nf)
	var far := nf
	match pan_at():
		0: near += 1
		1: far += 1
		2: far += 2
	return near - far

func tick(dt: float) -> void:
	var d := 0 if done else weigh()
	var want := clampf(float(d), -3.0, 3.0) * NOTCH
	tilt = move_toward(tilt, want, dt * 0.05)
	beam.rotation.z = tilt          # (+: the near (west) end down)
	pans[0].position.y = y0 - tilt * 0.6
	pans[1].position.y = y0 + tilt * 0.6
	if done or not here(): return
	var on := pan_at()
	if on != _on_k:
		_on_k = on
		if game.sfx: game.sfx.play("creak", -12.0, 0.9 + randf() * 0.15)
		if on >= 0: progress()
		if on == 2 and game.juice:
			game.juice.ring(Vector3(pans[1].position.x + 0.55, y0 + 0.06, PIVOT.z), 1.0, 1.2)
			game.juice.glint(game.player.position + Vector3(0, 0.05, 0))
	if d == 0 and absf(tilt) < 0.004:
		_level_t += dt
		if _level_t > 0.9: solve()
	else:
		_level_t = 0.0

## she reaches up and slides a weight along the beam to the other arm
func move(k: int) -> void:
	if done or _moving > 0: return
	var w := weights[k]
	game.call("perform", "hang_weight", w.global_position + Vector3(0, -0.75, 0), func() -> void:
		w_far[k] = not w_far[k]
		state["far"] = w_far.duplicate()
		progress()
		_moving += 1
		var to: float = FAR_SLOTS[k] if w_far[k] else NEAR_SLOTS[k]
		var tw := w.create_tween()
		tw.tween_property(w, "position:x", to, 1.4).set_trans(Tween.TRANS_SINE)
		tw.tween_callback(func() -> void:
			_moving -= 1
			if game.sfx: game.sfx.play("click", -16.0, 0.6))
		if game.sfx: game.sfx.play("hollow", -18.0, 1.4)
		_place_interacts())

func on_solved() -> void:
	if game.sfx:
		game.sfx.play("chime", -10.0, 1.0)
		game.sfx.play_later("door", 0.8, -12.0, 0.7)
	if game.juice:
		game.juice.glint(beam.global_position + Vector3(0, -0.4, 0.25))
		game.juice.shake(0.05)

func apply() -> void:
	super.apply()
	var f: Array = state.get("far", [false, false, false])
	for k in 3:
		w_far[k] = done or bool(f[k] if k < f.size() else false)
		weights[k].position.x = FAR_SLOTS[k] if w_far[k] else NEAR_SLOTS[k]
	_moving = 0
	_level_t = 0.0
	_place_interacts()

## the next weight still on the near arm glints; once all three hang far, she knocks twice under the water half
func hint() -> void:
	for k in 3:
		if not w_far[k]:
			if game.juice: game.juice.glint(weights[k].global_position + Vector3(0, -0.76, 0))
			return
	if game.juice: game.juice.ring(Vector3(pans[1].position.x + 0.55, y0 + 0.05, PIVOT.z), 0.8, 1.4)
	if game.sfx:
		game.sfx.play("glass_tink", -16.0, 0.9)
		game.sfx.play_later("glass_tink", 0.35, -16.0, 0.9)

## as a player would: the three weights over, then into the water half
func autosolve() -> void:
	_auto = []
	for k in 3:
		_auto.append((interacts[k] as Level.Interact).pos)
		_auto.append("tap")
	_auto.append(Vector3(PIVOT.x + ARM + 0.6, 0, PIVOT.z))

func update(dt: float) -> void:
	super.update(dt)
	if _auto.is_empty() or done: return
	_auto_t += dt
	if game.auto_target != Vector3.INF or _auto_t < 0.5 or _moving > 0 or game.get("_acting"): return
	if _auto[0] is String and game.focus == null: return
	var q: Variant = _auto.pop_front()
	_auto_t = 0.0
	if q is String:
		game.try_interact()
		return
	game.cmd("walk:%f:%f" % [(q as Vector3).x, (q as Vector3).z])
