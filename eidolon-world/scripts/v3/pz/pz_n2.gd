extends Puzzle
## N.2 "The Turned Ones" (CH1_V3 §2, ★★): three square statues before the great north glass, a carved symbol on each
## of their four faces. Above each, on the glass, she has written the symbol she wants (crimson). Turn a statue (tap =
## a quarter) until the GLASS shows that symbol on it: its north face, seen in the mirror. It glints and locks.
##   Teach   a symmetric symbol (the mirror cannot change it)
##   Test    a second, symmetric
##   Twist   an asymmetric symbol: the face that reads right to you reads reversed in the glass; pick its mirror twin
## No fail: the turns cycle.

const Y := 1.0
const Z := -34.15                        # the statues' row (1.6 m from the glass)
const GZ := -35.71
## statue -> [x, faces [N, E, S, W] as [design, flipped], the symbol she wrote, start turns]
const STATUES := [
	[-5.6, [[0, 0], [3, 0], [5, 0], [2, 0]], 3, 0],
	[-3.0, [[4, 0], [2, 0], [5, 0], [0, 0]], 0, 0],
	[-0.4, [[6, 0], [7, 0], [6, 1], [8, 0]], 6, 0],
]
var nodes: Array = []
var turns: Array = [0, 0, 0]
var locked: Array = [false, false, false]
var written: Array = []          # the symbols on the glass (rune materials)
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 50.0
	gate("N2", "N3")
	for i in STATUES.size():
		var s: Array = STATUES[i]
		var n := Node3D.new()
		n.name = "N2_Statue_%d" % i
		add_child(n)
		n.position = Vector3(s[0], Y, Z)
		var m := MB.new()
		m.box(Vector3(0, 0.08, 0), Vector3(0.86, 0.16, 0.86), Color(0.5, 0.5, 0.0))
		m.box(Vector3(0, 0.75, 0), Vector3(0.7, 1.2, 0.7), Color(0.5, 0.25, 0.0))
		m.box(Vector3(0, 1.4, 0), Vector3(0.78, 0.1, 0.78), Color(0.5, 0.5, 0.0))
		Kit3.marble(game, m.commit(), n)
		nodes.append(n)
		game.level.ob_rect(Rect2(s[0] - 0.46, Z - 0.46, 0.92, 0.92))
		game.level.add_interact("n2_s%d" % i, Vector3(s[0], Y, Z + 1.0), "turn", func() -> void: turn(i), 0.95,
			func() -> bool: return not done and not locked[i])

func post() -> void:
	for i in STATUES.size():
		var s: Array = STATUES[i]
		var n: Node3D = nodes[i]
		var faces: Array = s[1]
		for f in 4:
			var a := -PI * 0.5 * f                          # N, E, S, W: the face's outward normal turned from -z
			var nrm := Basis(Vector3.UP, a) * Vector3.FORWARD
			var basis := Basis.looking_at(-nrm, Vector3.UP)
			var at := nrm * 0.365 + Vector3(0, 0.95, 0)
			var fd: Array = faces[f]
			var mat := Kit3.rune(n, at, Vector2(0.5, 0.5), basis, fd[0], 0.35)
			var mi: MeshInstance3D = n.get_child(n.get_child_count() - 1)
			mi.name = "Face%d" % f
			if fd[1] == 1: mi.scale.x = -1.0                 # (its mirror twin)
			mi.set_meta("mat", mat)
		# what she wrote, on the glass above it
		written.append(Kit3.rune(self, Vector3(s[0], Y + 2.55, GZ + 0.03), Vector2(0.6, 0.6), Basis(), s[2], 0.75))
	_pose(true)

## the face that looks into the glass now
func north_face(i: int) -> int:
	var rot: float = -PI * 0.5 * turns[i]
	for f in 4:
		var nrm := Basis(Vector3.UP, rot) * (Basis(Vector3.UP, -PI * 0.5 * f) * Vector3.FORWARD)
		if nrm.z < -0.9: return f
	return 0

## the glass shows her symbol: the north face carries it, mirror-twinned if it is asymmetric (the glass reverses it)
func matches(i: int) -> bool:
	var s: Array = STATUES[i]
	var fd: Array = s[1][north_face(i)]
	if fd[0] != s[2]: return false
	var asym: bool = int(s[2]) in [1, 6, 7, 8]
	return fd[1] == 1 if asym else true

func turn(i: int) -> void:
	if locked[i] or done: return
	game.call("perform", "reach", nodes[i].position + Vector3(0, 1.0, 0.3), func() -> void:
		turns[i] = (turns[i] + 1) % 4
		state["turns"] = turns.duplicate()
		progress()
		if game.sfx: game.sfx.play("grind", -13.0, 1.1)
		var n: Node3D = nodes[i]
		var tw := n.create_tween()
		var to: float = -PI * 0.5 * turns[i]
		tw.tween_property(n, "rotation:y", to if turns[i] != 0 else -TAU, 0.55).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_callback(func() -> void:
			n.rotation.y = to
			if matches(i): _lock(i, false)))

func _lock(i: int, snap: bool) -> void:
	locked[i] = true
	state["locked"] = locked.duplicate()
	var n: Node3D = nodes[i]
	var face: MeshInstance3D = n.get_node("Face%d" % north_face(i))
	var fm: ShaderMaterial = face.get_meta("mat")
	if snap:
		fm.set_shader_parameter("lit", 1.0)
		written[i].set_shader_parameter("lit", 1.0)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		fm.set_shader_parameter("lit", v)
		written[i].set_shader_parameter("lit", v), 0.35, 1.0, 0.6)
	if game.sfx: game.sfx.play("chime", -14.0, 1.0 + 0.12 * i)
	if game.juice: game.juice.glint(Vector3(n.position.x, Y + 2.55, GZ + 0.1))
	if not locked.has(false): get_tree().create_timer(0.9).timeout.connect(func() -> void: solve())

func _pose(_snap: bool) -> void:
	for i in nodes.size(): (nodes[i] as Node3D).rotation.y = -PI * 0.5 * turns[i]

func apply() -> void:
	super.apply()
	var t: Array = state.get("turns", [])
	for i in STATUES.size():
		turns[i] = int(t[i]) if i < t.size() else int(STATUES[i][3])
		locked[i] = false
		if nodes.size() > i:
			for f in 4:
				var mi: MeshInstance3D = (nodes[i] as Node3D).get_node_or_null("Face%d" % f)
				if mi: (mi.get_meta("mat") as ShaderMaterial).set_shader_parameter("lit", 0.35)
	if done:
		for i in STATUES.size():
			while not matches(i): turns[i] = (turns[i] + 1) % 4
	if nodes.is_empty(): return
	_pose(true)
	for i in STATUES.size():
		written[i].set_shader_parameter("lit", 0.75)
		if matches(i): _lock(i, true)

## she knocks on the glass over the first statue that is not yet right
func hint() -> void:
	for i in STATUES.size():
		if not locked[i]:
			if game.juice: game.juice.glint(Vector3(STATUES[i][0], Y + 2.55, GZ + 0.1))
			break
	if game.sfx:
		game.sfx.play("glass_tink", -13.0, 1.0)
		game.sfx.play_later("glass_tink", 0.4, -13.0, 1.0)

func autosolve() -> void:
	_auto = []
	for i in STATUES.size():
		var need := 0
		var save: int = turns[i]
		while not matches(i) and need < 4:
			turns[i] = (turns[i] + 1) % 4
			need += 1
		turns[i] = save
		if need > 0: _auto.append(["walk", STATUES[i][0], Z + 1.0])
		for k in need: _auto.append(["t", i])

func tick(dt: float) -> void:
	if _auto.is_empty(): return
	_auto_t += dt
	if game.auto_target != Vector3.INF or game.get("_acting") or _auto_t < 1.0: return
	var a: Array = _auto.pop_front()
	_auto_t = 0.0
	match a[0]:
		"walk": game.cmd("walk:%f:%f" % [a[1], a[2]])
		"t": turn(a[1])
