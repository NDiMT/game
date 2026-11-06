class_name Hub
extends Node3D
## v1.0 M3 / v2: the hub's living parts: Theron's oil lamp (carried, a real light); the Flooded Colonnade's guide (HER
## reflection walks N.1's hidden stones ahead of you); the three Beacons (one per wing, lit with the lamp); the High
## wing's two gates.
## State lives in chapter.state["inv"] (items), chapter.state["beacons"] and chapter.state["hub"].

var game: Game
var chapter: Chapter
var items: Items
# the lamp
var lamp_bench: Node3D
var lamp_held: Node3D
var lamp_light: OmniLight3D
var lamp_flame: Flame
# the colonnade
var t4_refl: Reflector
var t4_pts: Array[Vector3] = []
var t4_s := 0.0                       # (tests) how far along the hidden path she has walked
var _t4_pose := Figure.Pose.new()
var _t4_phase := 0.0
## v2.0 (EIDOLON_SCRIPT §6): each wing ends at its BEACON, lit with the lamp (not an item: a fire). Its twin
## pillar in the Atrium catches with it, so the three fires read from the hub. The Gate wants all three.
## (v2 rebuild) each Beacon is the Tripo brazier at its wing's end (Map2.PIECES: WB on the rock by the Observer's face, NB at
## the Maze's end, EB on the High terrace); no twins in the Atrium (the script puts the fires in the wings)
const BEACON_POS := {"W": Map2.O + Vector3(-19.5, 1.0, -12.2), "N": Map2.O + Vector3(-3.0, 2.0, -59.2), "E": Map2.O + Vector3(28.8, 6.0, -67.2)}
const BEACON_DONE := {"W": "gallery", "N": "maze", "E": "scales"}
var beacon_fires := {}                # k -> BeaconFire (in the wing)

static func fresh_state() -> Dictionary:
	return Items.fresh_inv()

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	_build_lamp()
	_build_colonnade()
	_build_beacons()
	_build_gates()

# ------------------------------------------------------------------ inventory (the satchel's data; its UI is M3b)
func inv() -> Dictionary:
	return chapter.state["inv"]

func has_item(k: String) -> bool:
	return k in (inv()["items"] as Array)

func give(k: String) -> void:
	if not has_item(k): (inv()["items"] as Array).append(k)
	chapter.event.emit("item", k)

# ------------------------------------------------------------------ T2: the lamp
func _build_lamp() -> void:
	lamp_bench = _lamp_model()
	add_child(lamp_bench)
	lamp_bench.position = Act1.LAMP_POS + Vector3(0, 0.44, 0)
	lamp_held = _lamp_model()
	lamp_held.visible = false
	add_child(lamp_held)
	lamp_flame = Flame.new(0.0, 0.16, Palette.FIRE_LIGHT, game.level.noise_tex)
	lamp_flame.position = Vector3(0, 0.14, 0)
	lamp_flame.mat.set_shader_parameter("intensity", 0.85)
	lamp_flame.bounce = false
	lamp_held.add_child(lamp_flame)
	lamp_light = OmniLight3D.new()
	lamp_light.light_color = Color(1.0, 0.72, 0.45)          # (A: warmer, a softer edge)
	lamp_light.omni_range = 4.5
	lamp_light.omni_attenuation = 1.6
	lamp_light.light_energy = 0.6                # (v1.0 M3 polish: a warm glow round her, not a red wash)
	lamp_light.shadow_enabled = false
	lamp_light.position = Vector3(0, 0.3, 0)
	lamp_held.add_child(lamp_light)
	var bf := Flame.new(0.0, 0.16, Palette.FIRE_LIGHT, game.level.noise_tex)
	bf.position = Vector3(0, 0.14, 0)
	bf.mat.set_shader_parameter("intensity", 0.85)
	bf.bounce = false
	lamp_bench.add_child(bf)
	game.level.add_interact("lamp_take", Act1.LAMP_POS + Vector3(-0.55, -0.18, 0.0), "take", take_lamp, 1.0,
		func() -> bool: return not has_item("lamp") and chapter.act1 != null and chapter.act1.lamp_ready())

func _lamp_model() -> Node3D:
	var n := Node3D.new()
	var m := MB.new()
	m.cyl(Vector3(0, 0.05, 0), 0.07, 0.09, 0.1, Color(0.5, 1.0, 0.0), 10)
	m.cyl(Vector3(0, 0.12, 0), 0.02, 0.05, 0.05, Color(0.5, 1.0, 0.0), 8)
	m.box(Vector3(0.08, 0.1, 0), Vector3(0.1, 0.02, 0.02), Color(0.5, 1.0, 0.0))
	var mi := game.puzzles.marble_instance(m.commit(), n)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return n

func take_lamp() -> void:
	give("lamp")
	game.ui.show_item("lamp")
	_apply_lamp()
	if chapter.act1: chapter.act1.lamp_taken()
	if game.juice: game.juice.glint(Act1.LAMP_POS + Vector3(0, 0.6, 0))

func _apply_lamp() -> void:
	var on := has_item("lamp")
	lamp_bench.visible = not on and (chapter.act1 == null or bool(chapter.act1.st()["lamp"]))
	lamp_held.visible = on
	if on and lamp_held.get_parent() != game.player.fig:
		lamp_held.get_parent().remove_child(lamp_held)
		game.player.fig.add_child(lamp_held)
		lamp_held.position = Vector3(0.27, 0.78, -0.16)            # (in her right hand, a little ahead)

# ------------------------------------------------------------------ T4: her reflection walks the hidden stones
func _build_colonnade() -> void:
	# (v2: N.1, the Flooded Colonnade north of the Atrium: Map2.N1_STONES)
	var sy := Map2.N1_Y + Map2.O.y
	t4_pts = [Map2.w(2.5, -8.3, sy), Map2.w(2.5, -8.9, sy)]
	for c in Map2.N1_STONES: t4_pts.append(Map2.w(c[0], c[1], sy))
	t4_pts.append(Map2.w(3.2, -13.4, sy))
	var r := Reflector.new()
	r.kind = "pool"; r.plane_n = Vector3.UP; r.plane_d = Map2.N1_WATER_Y + Map2.O.y
	r.surface_col = Vector3(0.42, 0.47, 0.5); r.surface_mix = 0.08
	r.clip_c = Map2.w(2.5, -12.0, Map2.N1_WATER_Y); r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.BACK; r.clip_h = Vector2(3.0, 3.0)
	r.region = Map2.wr(-0.5, -15.0, 5.5, -7.0)
	r.alpha = 0.85
	r.hold = true
	game.puzzles._add_refl(r)
	t4_refl = r
	# (v1.1, A's footprint mask) her reflection on the colonnade's water is never drawn over a stone in it:
	# the hidden stones, the drowned shafts, the steps down and up
	var wm := PackedVector4Array()
	var wy := PackedFloat32Array()
	for i in Map2.N1_STONES.size():
		var c: Vector3 = Map2.w(Map2.N1_STONES[i][0], Map2.N1_STONES[i][1])
		wm.append(Vector4(c.x, c.z, 0.47, 0.47)); wy.append(0.2 * i)
	for d in Map2.N1_DECOYS:
		var c2: Vector3 = Map2.w(d[0], d[1])
		wm.append(Vector4(c2.x, c2.z, 0.5, 0.5)); wy.append(0.0)
	var lc := Map2.w(2.5, -8.5)
	wm.append(Vector4(lc.x, lc.z, 0.9, 0.5)); wy.append(0.0)
	var rc := Map2.w(3.2, -14.0)
	wm.append(Vector4(rc.x, rc.z, 0.6, 1.0)); wy.append(0.0)
	r.puppet.set_param("wmask", wm)
	r.puppet.set_param("wmask_yaw", wy)
	r.puppet.set_param("n_wmask", wm.size())
	if not r.glimpse.is_connected(game._on_glimpse): r.glimpse.connect(game._on_glimpse)

## how far along the hidden path a point is (its nearest place on the path, in metres)
func _t4_arc(p: Vector3) -> float:
	var best := INF
	var at := 0.0
	var acc := 0.0
	for i in t4_pts.size() - 1:
		var a := t4_pts[i]
		var b := t4_pts[i + 1]
		var ab := Vector2(b.x - a.x, b.z - a.z)
		var t := clampf(Vector2(p.x - a.x, p.z - a.z).dot(ab) / maxf(ab.length_squared(), 0.0001), 0.0, 1.0)
		var d := Vector2(p.x, p.z).distance_to(Vector2(a.x, a.z) + ab * t)
		if d < best: best = d; at = acc + ab.length() * t
		acc += ab.length()
	return at

func _t4_point(s: float) -> Array:
	var acc := 0.0
	for i in t4_pts.size() - 1:
		var a := t4_pts[i]
		var b := t4_pts[i + 1]
		var L := a.distance_to(b)
		if s <= acc + L:
			return [a.lerp(b, (s - acc) / maxf(L, 0.0001)), (b - a).normalized()]
		acc += L
	return [t4_pts[t4_pts.size() - 1], (t4_pts[t4_pts.size() - 1] - t4_pts[t4_pts.size() - 2]).normalized()]

func _update_colonnade(dt: float) -> void:
	var pl := game.player
	var pp := pl.position
	var near := t4_refl.region.has_point(Vector2(pp.x, pp.z))
	if not near:
		t4_s = 0.0
		return
	# she keeps about two stones ahead of you, and waits
	var mine := _t4_arc(pp) if pp.z < Map2.O.z - 8.1 else 0.0
	var goal := minf(mine + 1.9, _t4_total())
	var moving := t4_s < goal - 0.05
	t4_s = move_toward(t4_s, goal, dt * 2.4)          # (QA P2-7: she keeps ahead of you)
	var e := _t4_point(t4_s)
	var dir: Vector3 = e[1]
	var yaw := atan2(-dir.x, -dir.z) if moving else lerp_angle(atan2(-dir.x, -dir.z), atan2(pp.x - (e[0] as Vector3).x, pp.z - (e[0] as Vector3).z), 0.6)
	_t4_phase += dt * (1.5 + 6.2 * (0.7 if moving else 0.0))
	_t4_pose.ripple = 0.7 if moving else 0.0
	_t4_pose.phase = _t4_phase
	_t4_pose.body_y = absf(sin(_t4_phase)) * 0.03 if moving else 0.0
	_t4_pose.breath = sin(Time.get_ticks_msec() * 0.00165)
	t4_refl.hold_pose = _t4_pose
	t4_refl.hold_xf = Transform3D(Basis(Vector3.UP, yaw), e[0])

func _t4_total() -> float:
	var acc := 0.0
	for i in t4_pts.size() - 1: acc += t4_pts[i].distance_to(t4_pts[i + 1])
	return acc

# ------------------------------------------------------------------ the Beacons (v2.0: the seals and sockets are gone)
func _build_beacons() -> void:
	var bowl := Props._mesh("brazier")
	var top := ((bowl[1] as AABB).end.y if not bowl.is_empty() else 1.0) * 0.82          # (the fire stands in the bowl)
	for k in BEACON_POS:
		var f := BeaconFire.new()
		f.noise = game.level.noise_tex
		add_child(f)
		f.position = BEACON_POS[k] + Vector3(0, top, 0)
		beacon_fires[k] = f
		var kk: String = k
		game.level.add_interact("beacon_" + k, BEACON_POS[k] + Vector3(0, 0, 0), "light", func() -> void: light_beacon(kk), 1.1,
			func() -> bool: return beacon_ready(kk) and not beacon_lit(kk))

func beacons() -> Array:
	if not chapter.state.has("beacons"): chapter.state["beacons"] = []
	return chapter.state["beacons"]

func beacon_lit(k: String) -> bool:
	return k in beacons()

func beacons_all() -> bool:
	return beacon_lit("W") and beacon_lit("N") and beacon_lit("E")

## the wing's last puzzle is answered (West: and its hidden way walked, seen through the Shard)
func beacon_ready(k: String) -> bool:
	if not bool(chapter.state[BEACON_DONE[k]]): return false
	if k == "W": return bool(chapter.state["hub"].get("w_seen", false))
	return true

func light_beacon(k: String) -> void:
	if beacon_lit(k): return
	if not has_item("lamp"):
		game.ui.show_text("Cold bronze. It wants a flame.", game.player.position, 2.5)
		return
	beacons().append(k)
	(beacon_fires[k] as BeaconFire).ignite()
	chapter.event.emit("beacon", k)
	game.ui.show_item("beacon", k)

## (v2) the High wing's two gates: bars across the Scales' way up to the High terrace (they rise when the balance is
## answered) and across the High Stair's head (they rise when the Eidolon Plate answers: the circle closes)
var up_bars: Node3D
var eh_bars: Node3D
func _build_gates() -> void:
	up_bars = _bars(Map2.O + Vector3(23.5, 2.0, -57.95), 3.0, false)
	game.level.ob_rect(Map2.wr(22.0, -58.1, 25.0, -57.8), "up_bars")
	eh_bars = _bars(Map2.O + Vector3(22.0, 6.0, -64.0), 4.0, true)
	game.level.ob_rect(Map2.wr(21.85, -66.0, 22.15, -62.0), "eh_bars")

func _gate(n: Node3D, ob: String, y: float, open: bool, instant: bool) -> void:
	if game.level.named[ob].enabled != open: return
	game.level.set_enabled(ob, not open)
	if instant or not open:
		n.position.y = y + (2.7 if open else 0.0)
		return
	chapter.event.emit("bars_up", ob)
	n.create_tween().tween_property(n, "position:y", y + 2.7, 2.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

func _bars(at: Vector3, w: float, along_z: bool) -> Node3D:
	var n := Node3D.new()
	n.position = at
	add_child(n)
	var m := MB.new()
	var cnt := int(w / 0.24)
	for i in cnt + 1:
		var o := -w * 0.5 + w * float(i) / cnt
		var p := Vector3(0, 1.3, o) if along_z else Vector3(o, 1.3, 0)
		m.cyl(p, 0.035, 0.035, 2.6, Color(0.5, 1.0, 0.0), 6)
	m.box(Vector3(0, 2.2, 0), Vector3(0.08, 0.08, w) if along_z else Vector3(w, 0.08, 0.08), Color(0.5, 1.0, 0.0))
	m.box(Vector3(0, 0.5, 0), Vector3(0.08, 0.08, w) if along_z else Vector3(w, 0.08, 0.08), Color(0.5, 1.0, 0.0))
	game.puzzles.marble_instance(m.commit(), n)
	return n

# ------------------------------------------------------------------ frame, state
func update(dt: float) -> void:
	_update_colonnade(dt)
	if chapter.state["scales"]: _gate(up_bars, "up_bars", 2.0, true, false)
	if game.puzzles.state["plate"]: _gate(eh_bars, "eh_bars", 6.0, true, false)

func apply_state() -> void:
	var st: Dictionary = chapter.state
	if not st.has("inv"): st["inv"] = fresh_state()
	if not st.has("hub"): st["hub"] = Items.fresh_hub()
	_apply_lamp()
	if not has_item("lamp") and lamp_held.get_parent() == game.player.fig:
		game.player.fig.remove_child(lamp_held)
		add_child(lamp_held)
		lamp_held.visible = false
	for k in BEACON_POS:
		(beacon_fires[k] as BeaconFire).set_lit(beacon_lit(k))
	for i in 3: chapter.four_mats[i].set_shader_parameter("lit", 1.0 if beacon_lit(["W", "N", "E"][i]) else 0.15)
	_gate(up_bars, "up_bars", 2.0, bool(st["scales"]), true)
	_gate(eh_bars, "eh_bars", 6.0, bool(game.puzzles.state["plate"]), true)
