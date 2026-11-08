extends Puzzle
## N.7 "The Mist Maze" (CH1_V3 §2, ★★★★): the garden is lost in a mist you cannot see through. Inside the Lamp's
## circle her red footprints show on the flagstones, nowhere else. The mist pushes you back softly wherever she did
## not walk (no wall, no reset).
##   Teach   a straight run north to south
##   Test    turns
##   Twist   a fork: one set of prints is not hers (large, glassy, not crimson: the Warden's). It runs into the mist and
##           ends; at its end he whispers.
## Done = out the far side (the mist lets go).

const Y := 2.0
const CELL := 1.5
const X0 := -10.0
const Z0 := -54.0
## walkable cells (col, row): row 0 at the north door (z -54), row 7 at the Garden Beacon's door (z -66)
const HERS := [Vector2i(6, 0), Vector2i(6, 1), Vector2i(6, 2), Vector2i(6, 3), Vector2i(5, 3), Vector2i(4, 3), Vector2i(4, 4),
	Vector2i(4, 5), Vector2i(3, 5), Vector2i(3, 6), Vector2i(3, 7)]
const HIS := [Vector2i(4, 6), Vector2i(5, 6), Vector2i(5, 7)]
var prints: Array = []           # [MeshInstance3D, StandardMaterial3D, Vector3]
var _ok := Vector3.INF
var _whisper := 0.0
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 50.0

func cell_center(c: Vector2i) -> Vector3:
	return Vector3(X0 + (c.x + 0.5) * CELL, Y, Z0 - (c.y + 0.5) * CELL)

func cell_at(p: Vector3) -> Vector2i:
	return Vector2i(floori((p.x - X0) / CELL), floori((Z0 - p.z) / CELL))

func walkable(c: Vector2i) -> bool:
	return c in HERS or c in HIS

func post() -> void:
	for set_i in 2:
		var cells: Array = HERS if set_i == 0 else HIS
		var start: Vector2i = cells[0]
		var prev := cell_center(start) + (Vector3(0, 0, 1.2) if set_i == 0 else Vector3.ZERO)
		if set_i == 1: prev = cell_center(Vector2i(4, 5))
		for k in cells.size():
			var c: Vector3 = cell_center(cells[k])
			var d := (c - prev)
			d.y = 0.0
			var yaw := atan2(-d.x, -d.z) if d.length() > 0.01 else 0.0
			for s in [-1.0, 1.0]:
				var side: Vector3 = Vector3(cos(yaw), 0, -sin(yaw)) * 0.11 * s
				var at := prev.lerp(c, 0.33 if s < 0 else 0.8) + side
				prints.append(_print(at, yaw, set_i == 1))
			prev = c

## a footprint (placeholder: A's "N7_Print"): hers crimson and small, his large and glassy
func _print(at: Vector3, yaw: float, his: bool) -> Array:
	var q := QuadMesh.new()
	q.size = Vector2(0.13, 0.26) if not his else Vector2(0.2, 0.4)
	q.orientation = PlaneMesh.FACE_Y
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.78, 0.86, 0.95, 0.0) if his else Color(0.8, 0.08, 0.13, 0.0)
	var mi := MeshInstance3D.new()
	mi.name = "N7_Print"
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = at + Vector3(0, 0.012, 0)
	mi.rotation.y = yaw
	add_child(mi)
	return [mi, m, at, 0.85 if not his else 0.55]

func tick(dt: float) -> void:
	var h := here()
	# the prints: only inside the Lamp's light (about 2 m round her)
	if h:
		var lp: Vector3 = game.call("lamp_pos")
		var src := lp if lp != Vector3.INF else Vector3.INF
		for pr in prints:
			var a := 0.0
			if src != Vector3.INF:
				var d := Vector2((pr[2] as Vector3).x - src.x, (pr[2] as Vector3).z - src.z).length()
				a = (1.0 - smoothstep(1.3, 2.3, d)) * float(pr[3])
			var m: StandardMaterial3D = pr[1]
			if absf(m.albedo_color.a - a) > 0.01: m.albedo_color.a = move_toward(m.albedo_color.a, a, dt * 2.5)
	if not h or done or game.mode != "play": return
	var p := game.player.position
	var c := cell_at(p)
	if c.y >= 7 and c.x == 3:
		solve()
		return
	if walkable(c) or c.y < 0:
		_ok = p
		if c in HIS and c == HIS[HIS.size() - 1]: _his_end(dt)
		return
	# the mist pushes softly back to where she walked
	if _ok != Vector3.INF:
		var to := p.lerp(_ok, 1.0 - exp(-dt * 7.0))
		game.player.position.x = to.x
		game.player.position.z = to.z
	_whisper -= dt
	if _whisper <= 0.0:
		_whisper = 2.5
		progress()
		if game.sfx: game.sfx.play("cloth", -18.0, 0.6)

func _his_end(dt: float) -> void:
	_whisper -= dt
	if _whisper > 0.0: return
	_whisper = 6.0
	if game.sfx:
		game.sfx.play("hollow", -14.0, 0.55)
		game.sfx.play_later("glass_tink", 0.6, -20.0, 0.5)
	game.ui.show_text("Not hers.", game.player.position, 2.5)

## she knocks: the next print she left ahead of you glints
func hint() -> void:
	var c := cell_at(game.player.position)
	var i := HERS.find(c)
	var nxt: Vector2i = HERS[mini(i + 1, HERS.size() - 1)] if i >= 0 else HERS[0]
	if game.juice: game.juice.glint(cell_center(nxt) + Vector3(0, 0.2, 0))
	if game.sfx:
		game.sfx.play("glass_tink", -16.0, 1.0)
		game.sfx.play_later("glass_tink", 0.4, -16.0, 1.0)

func autosolve() -> void:
	if not game.call("has_item", "lamp"): game.call("give", "lamp", false)
	_auto = []
	for c in HERS: _auto.append(cell_center(c))
	_auto.append(cell_center(HERS[HERS.size() - 1]) + Vector3(0, 0, -0.6))

func update(dt: float) -> void:
	super.update(dt)
	if _auto.is_empty() or done: return
	_auto_t += dt
	if game.auto_target != Vector3.INF or _auto_t < 0.2: return
	var q: Vector3 = _auto.pop_front()
	_auto_t = 0.0
	game.cmd("walk:%f:%f" % [q.x, q.z])
