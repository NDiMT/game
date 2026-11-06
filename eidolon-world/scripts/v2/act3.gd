class_name Act3
extends Node3D
## v2 rebuild, phase 4 (EIDOLON_SCRIPT §6 Act 3, dev/V2_MAP.md): the convergence, in the new world.
##  * the Veiled Way's gate below the Atrium: shut (the promise) until the three Beacons burn; then it sinks
##  * the Pool of Halves (I.20) stays in fog until then: its four stones lie under the murk; when the fires burn the
##    fog lifts and the stones rise into sight (the puzzle itself, her half of the road, is chapter.gd's)
##  * I.21 the bridge that gives way: its spans settle under you, one lurches down, pieces fall into the sea
##  * I.23 the First Shrine: a ruined ring of columns round a brimming round pool (the crystal, the light and the
##    cinematic are puzzles.gd's and chapter.gd's)
## (I.22, the Gate of the Four, is chapter.gd's: the plinths are Map2's)

var game: Game
var chapter: Chapter
const O := Map2.O
const ZONE := Map2.ZP + "act3"
const VW_GAP := [-4.0, 7.85, -1.0, 8.15]             # the Veiled Way's gate, across its top (the Atrium's south edge)
const LURCH := 6                                     # the span that drops under you
const FALLS := [[2, 1.0, 3], [8, -1.0, 8], [10, 1.0, 10]]   # [span, side (+1 south, -1 north), falls when you reach this span]
const FOG_MURK := 0.4                                # (under A's fog bank: the water darker, not a pale wash)

var vw_gate: Node3D
var _open_seen := false                              # (the three Beacons burn, and we have answered it)
var fog: FogBank
var _murky := false
var lurch_node: Node3D
var chunks: Array[Node3D] = []
var _chunk_rest: Array[Transform3D] = []
var _fell: Array[bool] = []
var _settled: Array[bool] = []
var _lurched := false
var _span := -1

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	name = "Act3"
	_build_veiled_way()
	_build_bridge()
	_build_shrine()

static func fresh() -> Dictionary:
	return {"bridge": false}

func st() -> Dictionary:
	if not chapter.state.has("a3"): chapter.state["a3"] = fresh()
	return chapter.state["a3"]

func is_open() -> bool:
	return chapter.hub != null and chapter.hub.beacons_all()

static func R(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Map2.wr(x0, z0, x1, z1)

# ------------------------------------------------------------------ the Veiled Way
func _build_veiled_way() -> void:
	game.level.ob_rect(R(VW_GAP[0], VW_GAP[1], VW_GAP[2], VW_GAP[3]), "vw_gate")
	for side in [-1.0, 1.0]:
		var at := Map2.w(-2.5, 8.0 + 0.6 * side)
		var sd: float = side
		game.level.add_interact("vw_locked" + ("_s" if side > 0.0 else "_n"), at, "locked", func() -> void:
			game.ui.show_text("The veil will not part.\nNot while the three fires sleep." if sd > 0.0 else "Veiled. Beyond it, the pool where you woke.", game.player.position, 3.0), 0.8,
			func() -> bool: return not is_open() and (game.player.position.z > O.z + 8.0) == (sd > 0.0))

func _vw_node() -> Node3D:
	if vw_gate == null and Map2.door_nodes.size() > 2: vw_gate = Map2.door_nodes[2]
	return vw_gate

func open_vw(instant: bool) -> void:
	game.level.set_enabled("vw_gate", false)
	var d := _vw_node()
	if d == null: return
	if instant:
		d.visible = false
		return
	chapter.event.emit("vw_open", null)
	var dp := d.global_position
	if game.juice:
		game.juice.dust_fall(dp + Vector3(0, 2.6, 0), Vector3(1.0, 0, 0), 30)
		game.juice.shake(0.12)
	var tw := d.create_tween()
	tw.tween_interval(0.6)
	# (phase 6) as it starts down: a ring of force out over the stone from its foot, and A's dust, crumble and the seam
	# of light from the far side (the side away from her)
	var away := Vector3.BACK if game.player.position.z < dp.z else Vector3.FORWARD
	tw.tween_callback(func() -> void:
		if game.juice: game.juice.ring(dp + Vector3(0, 0.01, 0), 5.0, 1.8)
		OmenFx.gate_sink(self, dp, Vector3.RIGHT, 3.0, 3.2, away))
	tw.tween_property(d, "position:y", O.y - 3.6, 3.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: d.visible = false)

# ------------------------------------------------------------------ the Pool of Halves' fog
## (phase 6) A's fog bank over the water (FogBank: rolling sheets, curtains, wisps), a light murk under it
func _fog(on: bool, instant: bool) -> void:
	var wm: ShaderMaterial = chapter.act1.pool_water
	if on:
		if not _fog_alive():
			var e: Array = Map2.WATER[0]
			fog = FogBank.make(self, Map2.wr(e[0], e[1], e[2], e[3]), float(e[4]) + O.y)
			if not instant:
				fog._set_k(0.0)
				fog.create_tween().tween_method(fog._set_k, 0.0, 1.0, 3.0).set_trans(Tween.TRANS_SINE)
		if not _murky:
			_murky = true
			OmenFx.murk(wm, FOG_MURK, 0.01 if instant else 3.0)
	else:
		if _fog_alive():
			if instant: fog.queue_free()
			else: fog.lift(4.5)
		fog = null
		if _murky:
			_murky = false
			OmenFx.murk(wm, 0.0, 0.01 if instant else 4.0)

func _fog_alive() -> bool:
	return fog != null and is_instance_valid(fog) and not fog.is_queued_for_deletion()

## the third fire is lit (wherever you are): far below the Veiled Way's gate sinks, the pool's fog lifts and its four
## stones rise into sight
func _on_open() -> void:
	game.ui.show_text("Far off, something heavy gives way.", game.player.position, 3.0)
	game.sfx.play("bell_far", -10.0, 0.8)
	open_vw(false)
	_fog(false, false)
	chapter.pool_unveil(false)

# ------------------------------------------------------------------ I.21 the bridge that gives way
func _span_x(k: int, f := 0.5) -> float:
	var bl: float = (Map2.BRIDGE[2] - Map2.BRIDGE[0]) / Map2.BRIDGE_N
	return O.x + Map2.BRIDGE[0] + bl * (k + f)

func _span_mesh(m: MB, c: Vector3, bl: float, parapets: Array) -> void:
	var hw: float = (Map2.BRIDGE[3] - Map2.BRIDGE[1]) * 0.5
	# (the deck's body stops a centimetre under the walking course: nothing of it is coplanar with the kerbs it meets)
	m.tag = "floor"
	m.box(c + Vector3(0, -0.22, 0), Vector3(bl - 0.04, 0.42, hw * 2.0 + 0.34), Color(0.5, 0.0, 0.0))          # (its sides 1 cm in from the parapets' faces)
	m.box(c + Vector3(0, -0.015, 0), Vector3(bl - 0.08, 0.03, hw * 2.0 - 0.06), Color(0.5, 0.0, 0.0))
	m.tag = ""
	for side in parapets:
		m.box(c + Vector3(0, 0.17, (hw + 0.09) * float(side)), Vector3(bl - 0.06, 0.4, 0.18), Color(0.5, 0.25, 0.0))

func _build_bridge() -> void:
	var bl: float = (Map2.BRIDGE[2] - Map2.BRIDGE[0]) / Map2.BRIDGE_N
	var zc: float = O.z + (Map2.BRIDGE[1] + Map2.BRIDGE[3]) * 0.5
	var hw: float = (Map2.BRIDGE[3] - Map2.BRIDGE[1]) * 0.5
	var lv := game.level
	var falls := {}
	for f in FALLS: falls["%d,%d" % [f[0], int(f[1])]] = true
	for k in Map2.BRIDGE_N:
		_settled.append(false)
		var c := Vector3(_span_x(k), O.y, zc)
		if k == LURCH: continue
		var par := []
		for side in [-1, 1]:
			if not falls.has("%d,%d" % [k, side]) and not (k == 4 and side == -1): par.append(side)
		_span_mesh(lv.mb(ZONE), c, bl, par)
		if k % 4 == 1:
			# a pier down into the sea, its cutwater toward the open water
			lv.mb(ZONE).box(c + Vector3(0, -1.95, 0), Vector3(1.0, 3.1, hw * 2.0 - 0.2), Color(0.5, 0.0, 0.0))
			lv.mb(ZONE).box(c + Vector3(0, -2.0, hw - 0.1 + 0.35), Vector3(0.7, 3.0, 0.7), Color(0.5, 0.0, 0.0), Basis(Vector3.UP, PI * 0.25))
	# (the parapet left broken at span 4: its stub and rubble)
	lv.mb(ZONE).box(Vector3(_span_x(4, 0.15), O.y + 0.1, zc - hw - 0.09), Vector3(0.4, 0.26, 0.18), Color(0.5, 0.25, 0.0))
	# the span that lurches down under you
	lurch_node = Node3D.new()
	lurch_node.name = "BridgeLurch"
	lurch_node.position = Vector3(_span_x(LURCH), O.y, zc)
	add_child(lurch_node)
	var lm := MB.new()
	_span_mesh(lm, Vector3.ZERO, bl, [-1, 1])
	game.puzzles.marble_instance(lm.commit(), lurch_node)
	# the pieces that break away and fall into the sea (outside the walk: they never close the way)
	for f in FALLS:
		var n := Node3D.new()
		n.name = "BridgeFall%d" % int(f[0])
		n.position = Vector3(_span_x(int(f[0])), O.y, zc + (hw + 0.09) * float(f[1]))
		add_child(n)
		var fm := MB.new()
		fm.box(Vector3(0, 0.17, 0), Vector3(bl - 0.06, 0.4, 0.18), Color(0.5, 0.25, 0.0))
		game.puzzles.marble_instance(fm.commit(), n)
		chunks.append(n)
		_chunk_rest.append(n.transform)
		_fell.append(false)

func _region(k: int) -> Level.Region:
	return Map2.bridge_regions[k] if k < Map2.bridge_regions.size() else null

func _span_at(p: Vector3) -> int:
	if absf(p.y - O.y) > 0.5: return -1
	for k in Map2.BRIDGE_N:
		var g := _region(k)
		if g and g.r.has_point(Vector2(p.x, p.z)): return k
	return -1

func _update_bridge() -> void:
	if game.mode != "play": return
	var k := _span_at(game.player.position)
	if _lurched and absf(k - LURCH) <= 1:
		# (the span sank under her: she goes down with it, even standing still)
		var pp := game.player.position
		pp.y = game.level.height_at(Vector2(pp.x, pp.z))
		game.player.position = pp
	if k == _span: return
	_span = k
	if k < 0: return
	if not _settled[k]:
		_settled[k] = true
		chapter.event.emit("bridge_settle", k % 4)
		if game.juice:
			var c := Vector3(_span_x(k), O.y, game.player.position.z)
			game.juice.dust_floor(c, 0.7, 12)
			game.juice.grit(c + Vector3(randf_range(-0.6, 0.6), -0.3, 0), 0.35)
			game.juice.shake(0.04)
	if k == LURCH and not _lurched: _lurch(false)
	for i in FALLS.size():
		if not _fell[i] and k >= int(FALLS[i][2]): _fall(i, false)
	if k == Map2.BRIDGE_N - 1: st()["bridge"] = true

## the span drops a hand's breadth under you, with a crack, and stays there (still walkable: a step down and up)
func _lurch(instant: bool) -> void:
	_lurched = true
	var g := _region(LURCH)
	if g:
		g.y0 = O.y - 0.14
		g.y1 = O.y - 0.14
	if instant:
		lurch_node.position.y = O.y - 0.14
		lurch_node.rotation = Vector3(0.025, 0, 0.012)
		return
	chapter.event.emit("bridge_crumble", null)
	var tw := lurch_node.create_tween()
	tw.tween_interval(0.12)
	tw.tween_property(lurch_node, "position:y", O.y - 0.17, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(lurch_node, "rotation", Vector3(0.03, 0, 0.015), 0.16)
	tw.tween_property(lurch_node, "position:y", O.y - 0.14, 0.35).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(lurch_node, "rotation", Vector3(0.025, 0, 0.012), 0.35)
	if game.juice:
		var p := lurch_node.global_position
		game.juice.shake(0.3)
		for sx in [-1.0, 1.0]:
			game.juice.dust_fall(p + Vector3(sx * 0.95, -0.1, 0), Vector3(0, 0, 1.0), 18)
			game.juice.grit(p + Vector3(sx * 0.95, -0.4, 0), 0.5)
		for sz in [-1.25, 1.25]: FxBurst.crumble(game.juice, p + Vector3(0, -0.05, sz), 1.3)          # (phase 6: A's crumble, off both edges into the sea)
		get_tree().create_timer(0.9).timeout.connect(func() -> void: FxBurst.splash(game.juice, Vector3(p.x, O.y - 0.42, p.z + 1.6), 0.8))

## a piece of parapet shivers, breaks away and falls into the sea
func _fall(i: int, instant: bool) -> void:
	_fell[i] = true
	var n := chunks[i]
	if instant:
		n.visible = false
		return
	chapter.event.emit("bridge_crumble", null)
	var side: float = FALLS[i][1]
	var tw := n.create_tween()
	tw.tween_property(n, "rotation:x", 0.06 * side, 0.08)
	tw.tween_property(n, "rotation:x", -0.04 * side, 0.08)
	tw.tween_property(n, "rotation:x", 0.1 * side, 0.12)
	tw.tween_property(n, "position", n.position + Vector3(0, -4.4, 1.3 * side), 1.15).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(n, "rotation", Vector3(1.3 * side, 0.4, 0.7), 1.15)
	tw.tween_callback(func() -> void: n.visible = false)
	if game.juice:
		game.juice.grit(n.global_position + Vector3(0, -0.2, 0), 0.6)
		FxBurst.crumble(game.juice, n.global_position + Vector3(0, -0.1, 0), 0.6)          # (phase 6: A's crumble where it breaks away)
		var wp := n.global_position
		get_tree().create_timer(1.1).timeout.connect(func() -> void:
			FxBurst.splash(game.juice, Vector3(wp.x, O.y - 0.42, wp.z + 1.2 * side), 1.0)
			game.juice.ring(Vector3(wp.x, O.y - 0.41, wp.z + 1.2 * side), 2.4, 1.6))

func _reset_bridge() -> void:
	_lurched = false
	_span = -1
	for k in _settled.size(): _settled[k] = false
	var g := _region(LURCH)
	if g:
		g.y0 = O.y
		g.y1 = O.y
	lurch_node.position.y = O.y
	lurch_node.rotation = Vector3.ZERO
	for i in chunks.size():
		chunks[i].transform = _chunk_rest[i]
		chunks[i].visible = true
		_fell[i] = false

# ------------------------------------------------------------------ I.23 the First Shrine
func _build_shrine() -> void:
	var lv := game.level
	var c: Vector3 = O + Map2.SHRINE_C
	var b: Vector3 = O + Map2.SHRINE_POOL
	b.y = c.y
	var m := lv.mb(ZONE)
	# a worn marble disc under the ring, flush with the floor
	m.cyl(c + Vector3(0, 0.012, 0), 3.15, 3.2, 0.024, lv.C(0.25), 40)
	# the round pool: a low rim, a dark bowl, brimming water (chapter._build_shrine_pool)
	m.cyl(b + Vector3(0, 0.07, 0), 1.3, 1.34, 0.14, lv.C(0.25), 36)
	m.cyl(b + Vector3(0, 0.02, 0), 1.18, 1.18, 0.06, lv.C(0.5), 36)
	lv.ob_circle(Vector2(b.x, b.z), 1.32, "shrine_pool")
	# a ruined ring of columns, open to the south (the way in from the Gate)
	var ring := [[-15.0, 3.6], [35.0, 2.1], [195.0, 3.6]]          # (the north is A's altar; nothing on the south-west: the camera's side)
	for e in ring:
		var a := deg_to_rad(float(e[0]))
		lv.column(c + Vector3(cos(a) * 2.9, 0, sin(a) * 2.9), float(e[1]))

# ------------------------------------------------------------------ frame, state
func update(_dt: float) -> void:
	var open := is_open()
	if open and not _open_seen:
		_open_seen = true
		_on_open()
	if game.mode == "cine" and game.cine is Prologue and (_fog_alive() or _murky):
		# (the prologue plays on this water: no fog over its shots; it settles when you are yours to move)
		_fog(false, true)
	if not open and game.mode == "play" and (not _murky or not _fog_alive()): _fog(true, false)
	_update_bridge()

func apply_state() -> void:
	var open := is_open()
	_open_seen = open
	var d := _vw_node()
	if open: open_vw(true)
	else:
		game.level.set_enabled("vw_gate", true)
		if d:
			d.visible = true
			d.position.y = O.y
	_murky = false
	if _fog_alive(): fog.queue_free()
	fog = null
	OmenFx.murk(chapter.act1.pool_water, 0.0, 0.01)
	if not open and game.mode == "play": _fog(true, true)
	_reset_bridge()
	if st()["bridge"]:
		_lurch(true)
		for i in chunks.size(): _fall(i, true)
		for k in _settled.size(): _settled[k] = true
