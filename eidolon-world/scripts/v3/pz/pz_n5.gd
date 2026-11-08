extends Puzzle
## N.5 "The Court of Light" (CH1_V3 §2, ★★★): a shaft of sun comes in through a slit in the north wall. Three standing
## mirrors on turntables (tap = 45 deg) carry it round the court toward her fresco on the north wall; the fresco lights
## section by section as the beam gets closer.
##   Teach   the first mirror: one turn sends the shaft on
##   Test    three mirrors in a chain
##   Twist   the last stand is empty: the beam stops at a bare plinth. YOU are its last piece: stand on it, and her
##           mirror-oval face takes the light and throws it to the fresco
## Free toggles, no fail; it latches when the fresco is whole.

const Y := 2.0
const BEAM_Y := 1.25
const SRC := Vector2(14.0, -53.6)
const SRC_DIR := Vector2(0.0, 1.0)                     # (south)
## the turntables: position; the right turn is found by angle (8 states, 45 deg)
const MIRRORS := [Vector2(14.0, -51.0), Vector2(8.0, -51.0), Vector2(8.0, -48.5)]
const START := [2, 0, 6]
const GAP := Vector2(4.5, -48.5)                        # the empty plinth (you)
const FRESCO := Vector2(4.5, -53.75)
var turns: Array = [0, 0, 0]
var stands: Array = []
var beam: MeshInstance3D
var fresco_mat: ShaderMaterial
var _sections := 0
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 55.0
	var lv := game.level
	for i in MIRRORS.size():
		var p: Vector2 = MIRRORS[i]
		var n := Node3D.new()
		n.name = "N5_Mirror_%d" % i
		add_child(n)
		n.position = Vector3(p.x, Y, p.y)
		var m := MB.new()
		m.cyl(Vector3(0, 0.12, 0), 0.42, 0.46, 0.24, Color(0.5, 0.5, 0.0), 14)
		m.box(Vector3(0, 0.95, 0), Vector3(0.06, 1.3, 0.9), Color(0.5, 0.9, 0.0))
		Kit3.marble(game, m.commit(), n)
		var gq := QuadMesh.new()
		gq.size = Vector2(0.8, 1.15)
		var gm := StandardMaterial3D.new()
		gm.albedo_color = Color(0.82, 0.86, 0.9)
		gm.metallic = 1.0
		gm.roughness = 0.04
		gm.cull_mode = BaseMaterial3D.CULL_DISABLED
		var gi := MeshInstance3D.new()
		gi.name = "Glass"
		gi.mesh = gq
		gi.material_override = gm
		gi.transform = Transform3D(Basis(Vector3.UP, PI * 0.5), Vector3(0.035, 0.95, 0))
		n.add_child(gi)
		stands.append(n)
		lv.ob_circle(p, 0.5)
		lv.add_interact("n5_m%d" % i, Vector3(p.x, Y, p.y + 0.95), "turn", func() -> void: turn(i), 0.9, func() -> bool: return not done)
	# the empty plinth (low: you step up on it) and the slit of sun
	var pm := MB.new()
	pm.cyl(Vector3(GAP.x, Y + 0.04, GAP.y), 0.5, 0.55, 0.08, Color(0.5, 0.5, 0.0), 16)
	pm.box(Vector3(SRC.x, Y + BEAM_Y, SRC.y - 0.12), Vector3(0.5, 0.9, 0.12), Color(0.5, 1.0, 0.0))
	Kit3.marble(game, pm.commit(), self).name = "N5_Plinth"

func post() -> void:
	# (placeholder: A's "N5_Beam") one ribbon mesh rebuilt when the path changes
	beam = MeshInstance3D.new()
	beam.name = "N5_Beam"
	var bm := StandardMaterial3D.new()
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.albedo_color = Color(1.0, 0.93, 0.78, 0.75)
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	bm.cull_mode = BaseMaterial3D.CULL_DISABLED
	beam.material_override = bm
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(beam)
	# her fresco on the north wall: four sections (rune faces in a row; A swaps "N5_Fresco")
	var f := Node3D.new()
	f.name = "N5_Fresco"
	add_child(f)
	fresco_mat = Kit3.rune(f, Vector3(FRESCO.x, Y + 1.5, FRESCO.y), Vector2(2.2, 2.2), Basis(), 0.0, 0.05)
	_pose()
	_trace(true)

func turn(i: int) -> void:
	if done: return
	game.call("perform", "reach", (stands[i] as Node3D).position + Vector3(0, 1.0, 0.3), func() -> void:
		turns[i] = (turns[i] + 1) % 8
		state["turns"] = turns.duplicate()
		progress()
		if game.sfx: game.sfx.play("turn", -12.0, 1.15)
		var n: Node3D = stands[i]
		var tw := n.create_tween()
		tw.tween_property(n, "rotation:y", _yaw(i), 0.4).set_trans(Tween.TRANS_SINE)
		tw.tween_callback(func() -> void: _trace(false)))

## the mirror's yaw for its turn (turn 0: its glass faces east-west)
func _yaw(i: int) -> float:
	return -PI * 0.25 * float((START[i] + turns[i]) % 8)

func _pose() -> void:
	for i in stands.size():
		(stands[i] as Node3D).rotation.y = _yaw(i)

## the beam's path: from the slit, bouncing off each mirror it meets, stopping at a wall; at the plinth it bounces off
## you (if you stand there) to the fresco. Returns [points, reached fresco, mirrors used]
func path() -> Array:
	var pts: Array = [SRC]
	var p := SRC
	var d := SRC_DIR
	var used := 0
	var reached := false
	for hop in 6:
		var hit := -1
		var best := 99.0
		for i in MIRRORS.size():
			var q: Vector2 = MIRRORS[i]
			var t := (q - p).dot(d)
			if t > 0.3 and t < best and absf((q - p).cross(d)) < 0.3:
				best = t
				hit = i
		var gt := (GAP - p).dot(d)
		var at_gap := gt > 0.3 and absf((GAP - p).cross(d)) < 0.3 and gt < best
		if at_gap:
			p = GAP
			pts.append(p)
			if _on_plinth():
				pts.append(FRESCO)
				reached = true
			break
		if hit < 0:
			pts.append(_wall(p, d))
			break
		p = MIRRORS[hit]
		pts.append(p)
		used = maxi(used, hit + 1)
		var a := (stands[hit] as Node3D).rotation.y if stands.size() > hit else _yaw(hit)
		var nrm := Vector2(cos(a), -sin(a))               # the glass's normal (local +x turned by the yaw)
		if absf(d.dot(nrm)) < 0.2:
			break                                        # edge on: the light dies on its frame
		d = d - 2.0 * d.dot(nrm) * nrm
		d = d.normalized()
	return [pts, reached, used]

func _wall(p: Vector2, d: Vector2) -> Vector2:
	var r := Map3.walk_rect("N5").grow(0.25)
	var t := 99.0
	if d.x > 0.01: t = minf(t, (r.end.x - p.x) / d.x)
	if d.x < -0.01: t = minf(t, (r.position.x - p.x) / d.x)
	if d.y > 0.01: t = minf(t, (r.end.y - p.y) / d.y)
	if d.y < -0.01: t = minf(t, (r.position.y - p.y) / d.y)
	return p + d * t

func _on_plinth() -> bool:
	var q := game.player.position
	return Vector2(q.x - GAP.x, q.z - GAP.y).length() < 0.55

var _last_key := ""
func _trace(snap: bool) -> void:
	var r := path()
	var pts: Array = r[0]
	var key := str(pts)
	if key == _last_key and not snap: return
	_last_key = key
	var im := ImmediateMesh.new()
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in pts.size() - 1:
		var a: Vector2 = pts[i]
		var b: Vector2 = pts[i + 1]
		var A := Vector3(a.x, Y + BEAM_Y, a.y)
		var B := Vector3(b.x, Y + BEAM_Y + (0.25 if bool(r[1]) and i == pts.size() - 2 else 0.0), b.y)
		var up := Vector3(0, 0.07, 0)
		for v in [A - up, A + up, B + up, A - up, B + up, B - up]: im.surface_add_vertex(v)
	im.surface_end()
	beam.mesh = im
	var sec := clampi(int(r[2]) + (1 if bool(r[1]) else 0), 0, 4)
	if sec != _sections:
		_sections = sec
		var tw := create_tween()
		tw.tween_method(func(v: float) -> void: fresco_mat.set_shader_parameter("lit", v), float(fresco_mat.get_shader_parameter("lit")), 0.05 + 0.95 * sec / 4.0, 0.6)
		if not snap and game.sfx: game.sfx.play("chime_hall", -18.0, 0.8 + 0.1 * sec)
	if bool(r[1]) and not done and not snap: solve()

func tick(_dt: float) -> void:
	if here(): _trace(false)
	_tick_auto(_dt)

func on_solved() -> void:
	if game.juice: game.juice.glint(Vector3(FRESCO.x, Y + 1.5, FRESCO.y + 0.2))
	game.ui.show_text("She is the last piece of her own picture.", game.player.position, 4.5)

func apply() -> void:
	super.apply()
	var t: Array = state.get("turns", [])
	for i in turns.size(): turns[i] = int(t[i]) if i < t.size() else 0
	if done: turns = _solution()
	if stands.is_empty(): return
	_pose()
	_last_key = ""
	_sections = -1
	if beam: _trace(true)
	if done and fresco_mat: fresco_mat.set_shader_parameter("lit", 1.0)

## the turns that carry the beam to the plinth (found by trying them: 8 x 8 x 8)
func _solution() -> Array:
	var save := turns.duplicate()
	var rots: Array = []
	for n in stands: rots.append((n as Node3D).rotation.y)
	for a in 8:
		for b in 8:
			for c in 8:
				turns = [a, b, c]
				_pose()
				var r := path()
				var pts: Array = r[0]
				if (pts[pts.size() - 1] as Vector2).distance_to(GAP) < 0.01 or bool(r[1]):
					var sol := turns.duplicate()
					turns = save
					for i in stands.size(): (stands[i] as Node3D).rotation.y = rots[i]
					return sol
	turns = save
	return save

func hint() -> void:
	var r := path()
	var pts: Array = r[0]
	var end: Vector2 = pts[pts.size() - 1]
	if game.juice: game.juice.glint(Vector3(end.x, Y + BEAM_Y, end.y))
	if game.sfx:
		game.sfx.play("glass_tink", -14.0, 1.0)
		game.sfx.play_later("glass_tink", 0.4, -14.0, 1.0)

func autosolve() -> void:
	var sol := _solution()
	_auto = []
	for i in MIRRORS.size():
		var need: int = (int(sol[i]) - int(turns[i]) + 8) % 8
		if need > 0: _auto.append(["walk", MIRRORS[i].x, MIRRORS[i].y + 0.95])
		for k in need: _auto.append(["t", i])
	_auto.append(["walk", GAP.x, GAP.y])

func _tick_auto(dt: float) -> void:
	if _auto.is_empty(): return
	_auto_t += dt
	if game.auto_target != Vector3.INF or game.get("_acting") or _auto_t < 0.7: return
	var a: Array = _auto.pop_front()
	_auto_t = 0.0
	match a[0]:
		"walk": game.cmd("walk:%f:%f" % [a[1], a[2]])
		"t": turn(a[1])
