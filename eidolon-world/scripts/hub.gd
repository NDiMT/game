class_name Hub
extends Node3D
## v1.0 M3 (dev/V1_WORLD.md): the hub's living parts. The Crumbling Bridge's loose slabs; Theron's oil
## lamp (on his workbench up the scaffold; carried, a real light); the Undercroft's dark (only the lamp
## parts it); the Flooded Colonnade's guide (HER reflection walks the hidden stones ahead of you); the three
## Veil Seals (one rises when a wing is done) and the Gate's three sockets; the wings' shortcuts (the Court's
## lever for the drawbridge, the bolted bars between the Echo Corridor and the Maze); the bars between the
## Scales and the Echo Corridor.
## State lives in chapter.state["inv"] (items, seals, socketed) and chapter.state["hub"].

var game: Game
var chapter: Chapter
var items: Items
# the bridge
var slabs: Array[Node3D] = []
var _settled := [false, false, false]
var _shard: Node3D                   # a corner of the last slab that breaks away behind you, once
# the lamp
var lamp_bench: Node3D
var lamp_held: Node3D
var lamp_light: OmniLight3D
var lamp_flame: Flame
# the undercroft
var uc_veil: ShaderMaterial
var uc_ob: Level.Obstacle
var _uc_open := false
# the colonnade
var t4_refl: Reflector
var t4_pts: Array[Vector3] = []
var t4_s := 0.0                       # (tests) how far along the hidden path she has walked
var _t4_pose := Figure.Pose.new()
var _t4_phase := 0.0
# the seals
const SEAL_POS := {"W": Vector3(9.55, 1.24, -8.95), "N": Vector3(10.62, 2.0, -40.1), "E": Vector3(17.15, 2.0, -49.45)}
const SEAL_DONE := {"W": "gallery", "N": "maze", "E": "echo_room"}
const SEAL_RUNE := {"W": 2, "N": 7, "E": 3}
var seal_nodes := {}
var _seal_up := {}
# the bars
var ec_bars: Node3D
var sc_bars: Node3D

static func fresh_state() -> Dictionary:
	return Items.fresh_inv()

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	_build_bridge()
	_build_lamp()
	_build_undercroft()
	_build_uc_roof()
	_build_colonnade()
	_build_seals()
	_build_bars()
	# (the North wing's way back: the drawbridge lowered from the Court's side, once the Maze is walked)
	for i in 3:
		var idx := i
		game.level.add_interact("socket%d" % i, chapter.four_pos(i) + Vector3(0, 0.25, 0), "place", func() -> void: socket(idx), 1.25,
			func() -> bool: return can_socket(idx))
	game.level.add_interact("drawbridge_w", Vector3(16.55, 2.0, -20.4), "lever", func() -> void: game.puzzles.lower_drawbridge(false), 1.0,
		func() -> bool: return chapter.state["maze"] and not game.puzzles.state.get("drawbridge", false) and game.player.position.x < 17.2)

# ------------------------------------------------------------------ inventory (the satchel's data; its UI is M3b)
func inv() -> Dictionary:
	return chapter.state["inv"]

func has_item(k: String) -> bool:
	return k in (inv()["items"] as Array)

func give(k: String) -> void:
	if not has_item(k): (inv()["items"] as Array).append(k)
	chapter.event.emit("item", k)

# ------------------------------------------------------------------ T1: the crumbling bridge
func _build_bridge() -> void:
	var z0 := 7.3
	var L := (9.65 - z0) / 3.0
	var ang := atan2(WorldGeo.A_Y, 9.65 - z0)
	for i in 3:
		var n := Node3D.new()
		var zc := z0 + L * (i + 0.5)
		n.position = Vector3(0, WorldGeo.A_Y * (zc - z0) / (9.65 - z0) - 0.16, zc)
		n.rotation.x = -ang
		add_child(n)
		var m := MB.new()
		m.tag = "floor"
		m.box(Vector3.ZERO, Vector3(1.94, 0.3, L - 0.03), Color(0.5, 0.0, 0.0))
		game.puzzles.marble_instance(m.commit(), n)
		slabs.append(n)
	# the corner that breaks away (an overhang beside the last slab, outside the way)
	_shard = Node3D.new()
	_shard.position = Vector3(1.42, WorldGeo.A_Y - 0.2, 9.1)
	add_child(_shard)
	var sm := MB.new()
	sm.box(Vector3.ZERO, Vector3(0.36, 0.22, 0.55), Color(0.5, 0.25, 0.0), Basis(Vector3.UP, 0.3))
	game.puzzles.marble_instance(sm.commit(), _shard)

func _update_bridge() -> void:
	var p := game.player.position
	if absf(p.x) > 1.0 or p.z < 7.3 or p.z > 9.65: return
	var i := clampi(int((p.z - 7.3) / ((9.65 - 7.3) / 3.0)), 0, 2)
	if not _settled[i]:
		_settled[i] = true
		var n := slabs[i]
		var y0 := n.position.y
		var tw := n.create_tween()
		tw.tween_property(n, "position:y", y0 - 0.045, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tw.tween_property(n, "position:y", y0 - 0.03, 0.22).set_trans(Tween.TRANS_SINE)
		if game.juice:
			game.juice.dust_floor(Vector3(0, n.position.y, n.position.z), 0.6, 10)
			game.juice.grit(Vector3(randf_range(-0.8, 0.8), n.position.y - 0.2, n.position.z), 0.3)
		chapter.event.emit("bridge_settle", i)
	if i == 2 and _shard.visible and _shard.position.y > 0.0:
		var tw2 := _shard.create_tween()
		tw2.tween_interval(0.35)
		tw2.tween_property(_shard, "position:y", -6.0, 1.3).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tw2.parallel().tween_property(_shard, "rotation", Vector3(1.4, 0.4, 0.9), 1.3)
		tw2.tween_callback(func() -> void: _shard.visible = false)
		_shard.position.y -= 0.001
		chapter.event.emit("bridge_crumble", null)

# ------------------------------------------------------------------ T2: the lamp
func _build_lamp() -> void:
	lamp_bench = _lamp_model()
	add_child(lamp_bench)
	lamp_bench.position = WorldGeo.LAMP_POS + Vector3(0, 0.44, 0)
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
	game.level.add_interact("lamp_take", WorldGeo.LAMP_POS + Vector3(-0.55, 0, 0), "take", take_lamp, 1.0,
		func() -> bool: return not has_item("lamp"))

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
	if game.juice: game.juice.glint(WorldGeo.LAMP_POS + Vector3(0, 0.6, 0))

func _apply_lamp() -> void:
	var on := has_item("lamp")
	lamp_bench.visible = not on
	lamp_held.visible = on
	if on and lamp_held.get_parent() != game.player.fig:
		lamp_held.get_parent().remove_child(lamp_held)
		game.player.fig.add_child(lamp_held)
		lamp_held.position = Vector3(0.27, 0.78, -0.16)            # (in her right hand, a little ahead)

# ------------------------------------------------------------------ T5: the undercroft's dark
func _build_undercroft() -> void:
	uc_veil = ShaderMaterial.new()
	uc_veil.shader = preload("res://shaders/mist_veil.gdshader")
	uc_veil.set_shader_parameter("noise_tex", game.level.noise_tex)
	uc_veil.set_shader_parameter("density", 1.0)
	uc_veil.set_shader_parameter("glow", 0.15)
	var q := QuadMesh.new()
	q.size = Vector2(2.6, 2.4)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = uc_veil
	mi.transform = Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(14.15, WorldGeo.A_Y + 1.2, 11.4))
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(mi)
	uc_ob = game.level.ob_rect(Level.R(14.0, 10.0, 14.3, 12.8), "uc_dark")
	game.level.add_interact("uc_dark", Vector3(13.45, WorldGeo.A_Y, 11.4), "locked", func() -> void:
		game.ui.show_text("Too dark to see your feet.\nA light would part it.", game.player.position, 3.0), 0.9,
		func() -> bool: return not has_item("lamp"))

var uc_roof: Node3D
func _build_uc_roof() -> void:
	uc_roof = Node3D.new()
	add_child(uc_roof)
	var m := MB.new()
	m.box(Vector3(18.975, WorldGeo.A_Y + 2.63, 11.55), Vector3(9.25, 0.3, 2.7), Color(0.5, 0.25, 0.0))       # (between the walls, on the piers)
	game.puzzles.marble_instance(m.commit(), uc_roof)

func _update_undercroft() -> void:
	var lamp := has_item("lamp")
	if lamp and not _uc_open:
		_uc_open = true
		var tw := create_tween()
		tw.tween_method(func(v: float) -> void: uc_veil.set_shader_parameter("density", v), float(uc_veil.get_shader_parameter("density")), 0.0, 1.6)
	# (without the lamp you never go INTO the dark from the Atrium; from inside, the way out is always open)
	uc_ob.enabled = not lamp and game.player.position.x < 14.25
	var pp := game.player.position          # (the lamp's strength in the dark: main, with A's darkness)
	uc_roof.visible = not (pp.x > 13.6 and pp.x < 24.0 and pp.z > 9.6 and pp.z < 13.2 and pp.y < 1.5)       # (never over you)

# ------------------------------------------------------------------ T4: her reflection walks the hidden stones
func _build_colonnade() -> void:
	t4_pts = [Vector3(11.5, WorldGeo.T4_Y, 9.2), Vector3(11.5, WorldGeo.T4_Y, 8.6)]
	for c in WorldGeo.T4_STONES: t4_pts.append(Vector3(c.x, WorldGeo.T4_Y, c.y))
	t4_pts.append(Vector3(12.15, WorldGeo.T4_Y, 4.6))
	var r := Reflector.new()
	r.kind = "pool"; r.plane_n = Vector3.UP; r.plane_d = Ch1Geo.CO_WATER_Y
	r.surface_col = Vector3(0.42, 0.47, 0.5); r.surface_mix = 0.08
	r.clip_c = Vector3(11.4, Ch1Geo.CO_WATER_Y, 6.9); r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.BACK; r.clip_h = Vector2(2.6, 2.6)
	r.region = Level.R(8.5, 3.0, 15.0, 13.0)
	r.alpha = 0.85
	r.hold = true
	game.puzzles._add_refl(r)
	t4_refl = r
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
	var near := Rect2(9.0, 3.5, 5.0, 7.5).has_point(Vector2(pp.x, pp.z))
	if not near:
		t4_s = 0.0
		return
	# she keeps about two stones ahead of you, and waits
	var mine := _t4_arc(pp) if pp.z < 9.8 else 0.0
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

# ------------------------------------------------------------------ the Veil Seals and the Gate's sockets
func _build_seals() -> void:
	for k in SEAL_POS:
		var n := Node3D.new()
		n.position = SEAL_POS[k] + Vector3(0, -1.1, 0)
		add_child(n)
		var m := MB.new()
		m.box(Vector3(0, 0.4, 0), Vector3(0.5, 0.8, 0.5), Color(0.5, 0.25, 0.0))
		var B := Basis(Vector3.UP, Framing.YAW)          # (the seal's face toward the camera)
		m.cyl(Vector3(0, 0.98, 0), 0.2, 0.2, 0.05, Color(0.5, 1.0, 0.0), 18, B * Basis(Vector3.RIGHT, PI * 0.5))
		game.puzzles.marble_instance(m.commit(), n)
		game.puzzles.rune_quad(n, Vector3(0, 0.98, 0) + B * Vector3(0, 0, 0.03), Vector2(0.3, 0.3), B, float(SEAL_RUNE[k]), 1.0)      # (QA P2-13: its wing's own sign)
		n.visible = false
		seal_nodes[k] = n
		_seal_up[k] = false
		var kk: String = k
		game.level.add_interact("seal_" + k, SEAL_POS[k] + Vector3(0, 0, 0), "take", func() -> void: take_seal(kk), 1.0,
			func() -> bool: return _seal_up[kk] and not (kk in (inv()["seals"] as Array)))

func seal_ready(k: String) -> bool:
	if not bool(chapter.state[SEAL_DONE[k]]): return false
	match k:                                 # (v1.0 M3b: each wing's item on its critical path)
		"W": return bool(chapter.state["hub"].get("w_broken", false))       # (the chisel, the reliquary)
		"N": return bool(chapter.state["hub"].get("n_poured", false))       # (the amphora's puddle mirror)
	return true

func take_seal(k: String) -> void:
	if k in (inv()["seals"] as Array): return
	(inv()["seals"] as Array).append(k)
	(seal_nodes[k] as Node3D).visible = false
	game.ui.show_item("seal", k)
	chapter.event.emit("seal", k)
	if game.juice: game.juice.glint(SEAL_POS[k] + Vector3(0, 1.0, 0))

func _update_seals() -> void:
	for k in SEAL_POS:
		var n: Node3D = seal_nodes[k]
		var owned: bool = k in (inv()["seals"] as Array)
		if owned:
			n.visible = false
			continue
		if seal_ready(k) and not _seal_up[k]:
			_seal_up[k] = true
			n.visible = true
			var tw := n.create_tween()
			tw.tween_property(n, "position:y", (SEAL_POS[k] as Vector3).y, 2.2).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
			if game.juice:
				game.juice.dust_floor(SEAL_POS[k], 0.5, 14)
				game.juice.shake(0.12)
			chapter.event.emit("seal_rises", k)

## the Gate of the Four Veiled: a seal into one of the three statues' sockets
func can_socket(i: int) -> bool:
	var s: Array = inv()["socketed"]
	return i < 3 and not (i in s) and (inv()["seals"] as Array).size() > s.size()

func socket(i: int) -> void:
	if not can_socket(i): return
	(inv()["socketed"] as Array).append(i)
	chapter.four_mats[i].set_shader_parameter("lit", 1.0)
	chapter.event.emit("socket", i)
	if game.juice: game.juice.glint(chapter.four_pos(i) + Vector3(0, 0.6, 0))

func sockets_full() -> bool:
	return (inv()["socketed"] as Array).size() >= 3

# ------------------------------------------------------------------ the bars: Scales -> Echo (the balance opens them), Echo -> Maze (unbolted from the echo side)
func _build_bars() -> void:
	ec_bars = _bars(Vector3(10.0, 2.0, -41.0), 2.0, false)
	game.level.ob_rect(Level.R(9.0, -41.15, 11.0, -40.85), "ec_bars")
	game.level.add_interact("ec_unbolt", Vector3(10.0, 2.0, -41.6), "lever", unbolt_ec, 1.0,
		func() -> bool: return chapter.state["echo_room"] and chapter.state["maze"] and game.level.named["ec_bars"].enabled and game.player.position.z < -41.2)
	game.level.add_interact("ec_held", Vector3(10.0, 2.0, -41.6), "locked", func() -> void:
		game.ui.show_text("The bolt will not draw.\nSomething holds it from the far side.", game.player.position, 2.5), 1.0,
		func() -> bool: return chapter.state["echo_room"] and not chapter.state["maze"] and game.level.named["ec_bars"].enabled and game.player.position.z < -41.2)
	game.level.add_interact("ec_bolted", Vector3(9.7, 2.0, -40.75), "locked", func() -> void:
		game.ui.show_text("Bolted, from the other side.", game.player.position, 2.5), 0.6,
		func() -> bool: return game.level.named["ec_bars"].enabled and game.player.position.z > -40.85)
	sc_bars = _bars(Vector3(26.1, 2.0, -45.5), 1.9, true)
	game.level.ob_rect(Level.R(25.95, -46.45, 26.25, -44.55), "sc_bars")

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

func unbolt_ec(instant := false) -> void:
	chapter.state["hub"]["ec_open"] = true
	game.level.set_enabled("ec_bars", false)
	if instant:
		ec_bars.position.y = 2.0 + 2.7
		return
	chapter.event.emit("ec_unbolt", null)
	ec_bars.create_tween().tween_property(ec_bars, "position:y", 2.0 + 2.7, 2.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

func open_sc(instant := false) -> void:
	if not game.level.named["sc_bars"].enabled: return
	game.level.set_enabled("sc_bars", false)
	if instant:
		sc_bars.position.y = 2.0 + 2.7
		return
	sc_bars.create_tween().tween_property(sc_bars, "position:y", 2.0 + 2.7, 2.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

# ------------------------------------------------------------------ frame, state
func update(dt: float) -> void:
	_update_bridge()
	_update_undercroft()
	_update_colonnade(dt)
	_update_seals()
	if chapter.state["scales"] and game.level.named["sc_bars"].enabled: open_sc(false)

func apply_state() -> void:
	var st: Dictionary = chapter.state
	# (v1.0 QA P1-5: a JSON reload turns the sockets' ints into floats; 0 in [0.0] is false)
	if st.has("inv"): st["inv"]["socketed"] = (st["inv"]["socketed"] as Array).map(func(v: Variant) -> int: return int(v))
	if not st.has("inv"): st["inv"] = fresh_state()
	if not st.has("hub"): st["hub"] = Items.fresh_hub()
	_apply_lamp()
	if not has_item("lamp") and lamp_held.get_parent() == game.player.fig:
		game.player.fig.remove_child(lamp_held)
		add_child(lamp_held)
		lamp_held.visible = false
	_uc_open = false
	uc_veil.set_shader_parameter("density", 0.0 if has_item("lamp") else 1.0)
	if has_item("lamp"): _uc_open = true
	for k in SEAL_POS:
		var up: bool = seal_ready(k) and not (k in (inv()["seals"] as Array))
		_seal_up[k] = up
		(seal_nodes[k] as Node3D).visible = up
		(seal_nodes[k] as Node3D).position = SEAL_POS[k] + (Vector3.ZERO if up else Vector3(0, -1.1, 0))
	for i in 3: chapter.four_mats[i].set_shader_parameter("lit", 1.0 if (i in (inv()["socketed"] as Array)) else 0.15)
	if st["hub"].get("ec_open", false): unbolt_ec(true)
	else:
		game.level.set_enabled("ec_bars", true)
		ec_bars.position.y = 2.0
	if st["scales"]: open_sc(true)
	else:
		game.level.set_enabled("sc_bars", true)
		sc_bars.position.y = 2.0
	for i in 3: _settled[i] = false
