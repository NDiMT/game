class_name Chapter
extends Node3D
## v0.6: Chapter I, "The Veiled Gate": the puzzles of the new spaces (the geometry is in ch1_geo.gd;
## the Court's beam, the eidolon plate and the shrine are in puzzles.gd). v0.6 made them puzzles of
## reasoning, each with one idea to discover (solver checks: tests/playthrough.gd):
##
##  1 Waking Pool     "Trust the Water": stepping stones, some illusions; still water near you reflects
##                    only the real ones; an illusion sinks softly and returns you to the shore
##  2 Stair of Breath "An Answer on the Glass": she writes a letter of the script and half a rune, you
##                    finish its mirror (calligraphic strokes); her glass then sings her motif
##  3 Hall of Glass   "What the Glass Remembers": set the drum, the brazier and the bust back as the
##                    mirror shows them (depth and facing mirrored); the walled door returns, the shard
##                    lies on its threshold
##  4 Shard Gallery   "The Other Side's Map": through the shard, her map numbers three braziers, drawn
##                    from her side; light them in her order, read the right way round
##  5 Garden          THE TURNED ONES (kept): asymmetric runes; her pane gives them as she sees them
##  6 Hollow Walk     two hollows with interfering paths step toward you while you stand unwatching
##  7 Court of Light  "Two Worlds of Light": the beam must go INTO her great glass, off her own glasses
##                    and your stands' twins, and out again; only that route lights her mural
##  8 Mist Maze       her footprints, mirrored, show the next stretch while you stand still
##  9 Echo Corridor   "Her Song": sing her motif back on four singing stones (memory #1)
## 10 The Scales      "Weight of a Reflection": weight x hook; your reflection weighs 2 on the far side
## 11 Eidolon Ledge   "Two Plates": a pushed statue holds your plate while your reflection holds hers
## 12 Gate of Four    stand on the empty plinth, face the shrine, be still (kept)
## 13 First Shrine    (puzzles.gd) + the closing cinematic, "The Hand in the Water"

signal event(name: String, data: Variant)

const L_LIGHT := Vector3(15.7, 2.4, -25.6)          # the lit crystal's light falls from here (mural)
const MURAL_Z := -26.93
const MURAL_HEAD := Vector2(12.0, 3.3)               # where the head is missing (x, y on the wall)
const TURN_FACES := [[[6, 0.0], [6, 1.0], [3, 0.0], [5, 0.0]], [[7, 1.0], [7, 0.0], [4, 0.0], [0, 0.0]],
	[[8, 0.0], [3, 0.0], [8, 1.0], [5, 0.0]]]        # per statue: faces N, E, S, W at rest: [design, flip]
const TURN_SOLUTION := [0, 1, 0]                       # orientation that puts the true rune toward the glass
const TURN_START := [2, 3, 1]
const TURN_X := [11.4, 12.8, 14.2]          # (v0.8.1: the garden starts at x 10.3 now; before its narrowed glass)
const TURN_Z := -13.5
const FOUR_R := 3.9
const FOUR_ANGLES := [20.0, 160.0, -20.0, -160.0]      # degrees round the tholos; the last is empty
# (QA P1-10: memories speak of him in the third person; the inscriptions are his own voice)
const MEMORY_1 := "He took the goddess's mirror from her shrine at Milos.\nShe did not stop him. She only watched."

var game: Game
var level: Level
var puzzles: Puzzles
var state := {}
var calm := 0.0
var lens_on := false
var lens_px := Vector4.ZERO
var _t := 0.0
var _moved := false

# pool / stair
const POOL_SHORE := Vector3(-0.3, 0.0, 1.7)
var breath_mats := {}              # id -> ShaderMaterial
var stair_veil: ShaderMaterial
var stair_rune: MeshInstance3D          # v0.7: the whole rune, carved large beside the stair (her half + yours)
var _breathing := ""
# hall / gallery
var shard_node: Node3D
var hall_mirror_mat: ShaderMaterial
var gls_mat: ShaderMaterial
# garden
var garden_refl: Reflector
var turn_pivots: Array[Node3D] = []
var turn_face_mats: Array = []     # per statue: 4 ShaderMaterials
var turn_tw: Array = [null, null, null]
var door_real: Array[Node3D] = []
var door_refl: Array[Node3D] = []
# hollow walk
var hollow_nodes: Array[Node3D] = []
var hollow_glints: Array[ShaderMaterial] = []
var hollow_obs: Array = []
var plate_mats: Array[ShaderMaterial] = []
var hw_gate: Node3D
var _still := 0.0
var _tick := 0.0
var hollow_moving := false
# court mural
var mural_mat: ShaderMaterial
var mural_hold := 0.0
var shadow_world := Vector3.INF
# maze
var maze_mist: ShaderMaterial
var shimmers: Array[MeshInstance3D] = []
var _shim_i := 0
var _bump_cd := 0.0
var maze_feet: Array[MeshInstance3D] = []
var maze_feet_t: Array[float] = []
var maze_feet_seg: Array[int] = []      # v0.6: which stretch of her path each footprint belongs to
var _maze_loop := 0.0
var maze_prog := -1                     # the farthest cell of her path you have stood in
var _maze_still := 0.0
# echo
var crack_mat: ShaderMaterial
var _echo_flash := 0.0
# ledge footprints
var ledge_feet: Array[MeshInstance3D] = []
var ledge_feet_t: Array[float] = []
var _ledge_loop := 0.0
# gate of four
var four_mats: Array[ShaderMaterial] = []
var four_ring: ShaderMaterial
var four_hold := 0.0
var gap_veils: Array[ShaderMaterial] = []
var front_veil: ShaderMaterial
var waiting := 0.0
# shrine pool
var shrine_water: ShaderMaterial
var shrine_over: ShaderMaterial
# hints
var hint_t := 0.0
var hint_area := ""
var _hint_cd := 0.0
var wisp: MeshInstance3D
var wisp_mat: ShaderMaterial

func _init(g: Game) -> void:
	game = g
	level = g.level
	puzzles = g.puzzles
	reset_state()

func reset_state() -> void:
	state = {"stones": false, "pool_turns": Ch1Geo.POOL_START.duplicate(), "breath": false, "shard": false, "hall_door": false, "gallery": false,
		"gallery_lit": [],
		"hall": {"drum": [DRUM_START.x, DRUM_START.y], "brazier": [BRAZ_START.x, BRAZ_START.y], "bust": BUST_START, "locks": [false, false, false]},
		"turned": TURN_START.duplicate(), "turned_done": false, "garden_breath": false,
		"hollows": [[5, 2], [1, 1]], "hollow_lock": [false, false], "hollow_done": false,
		"mural": false, "maze": false, "echo_room": false, "memories": [], "scale_w": [-1, -1, -1], "scales": false,
		"four": false, "ledge_statue": [LEDGE_STATUE.x, LEDGE_STATUE.y]}

# ================================================================== build (before level.commit)
func build() -> void:
	_build_pool()
	_build_stair()
	_build_hall()
	_build_gallery()
	_build_garden()
	_build_hollow()
	_build_mural()
	_build_maze()
	_build_echo()
	_build_scales()
	_build_ledge_feet()
	_build_ledge_plate()
	_build_four()
	_build_shrine_pool()
	_build_wisp()

## after level.commit: the zone meshes exist now
func post_commit() -> void:
	var hd := level.get_node_or_null("Zone_Hdoor") as MeshInstance3D
	if hd: hd.layers = PlanarMirror.LAYER_MAIN_FX            # the mirror remembers no wall there
	var gn := level.get_node_or_null("Zone_Gn") as MeshInstance3D
	if gn: gn.layers = PlanarMirror.LAYER_BEHIND
	var gls := level.get_node_or_null("Zone_GLs") as MeshInstance3D
	if gls:
		gls_mat = level.marble_mat.duplicate()
		gls_mat.set_shader_parameter("lens_hide", 1.0)
		gls.material_override = gls_mat
	apply_state()

func _mi(mesh: Mesh, mat: Material, xf: Transform3D, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.transform = xf
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	(parent if parent else self).add_child(mi)
	return mi

func _smat(path: String, params := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(path)
	for k in params: m.set_shader_parameter(k, params[k])
	return m

func _quad(size: Vector2) -> QuadMesh:
	var q := QuadMesh.new()
	q.size = size
	return q

func _plane(size: Vector2) -> PlaneMesh:
	var q := PlaneMesh.new()
	q.size = size
	return q

## a veiled statue as its own mesh (it moves or turns): local origin at the base
func _statue_mesh(sc: float, plinth: float, mat_id := 0.25) -> ArrayMesh:
	var m := MB.new()
	var col := Color(0.5, mat_id, 0.0, 1.0)
	var y := plinth + 0.08
	var at := func(x: float, yy: float, z: float) -> Vector3: return Vector3(x, y + yy, z) * Vector3(1, 1, 1) * 1.0 if false else Vector3(x * sc, y + yy * sc, z * sc)
	if plinth > 0.01:
		m.box(Vector3(0, plinth * 0.5, 0), Vector3(0.95 * sc, plinth, 0.95 * sc), col)
		m.box(Vector3(0, plinth + 0.04, 0), Vector3(1.08 * sc, 0.08, 1.08 * sc), col)
	m.cyl(at.call(0, 0.62, 0), 0.25 * sc, 0.34 * sc, 1.24 * sc, col, 14, Basis(Vector3.BACK, 0.03))
	m.cyl(at.call(0, 1.5, 0.01), 0.27 * sc, 0.23 * sc, 0.56 * sc, col, 14)
	m.sphere(at.call(0, 1.78, 0.01), Vector3(0.30, 0.10, 0.19) * sc, col, 14, 5)
	for sx in [-1.0, 1.0]:
		m.cyl(at.call(sx * 0.27, 1.55, 0.0), 0.065 * sc, 0.075 * sc, 0.46 * sc, col, 8, Basis(Vector3.BACK, sx * 0.12))
		m.cyl(at.call(sx * 0.13, 1.36, -0.13), 0.06 * sc, 0.065 * sc, 0.34 * sc, col, 8, Basis(Vector3.BACK, -sx * 1.15) * Basis(Vector3.RIGHT, 0.3))
	m.sphere(at.call(0, 1.33, -0.19), Vector3(0.09, 0.07, 0.07) * sc, col, 8, 4)
	var hb := Basis(Vector3.RIGHT, -0.20)
	m.cyl(at.call(0, 1.94, 0.02), 0.14 * sc, 0.25 * sc, 0.34 * sc, col, 14)
	m.sphere(at.call(0, 2.12, 0.0), Vector3(0.155, 0.19, 0.17) * sc, col, 14, 7, hb)
	m.sphere(at.call(0, 2.11, -0.075), Vector3(0.10, 0.13, 0.09) * sc, col, 10, 5, hb)
	m.sphere(at.call(0, 2.19, 0.03), Vector3(0.165, 0.15, 0.17) * sc, col, 12, 6, hb)
	return m.commit()

# ------------------------------------------------------------------ 1. waking pool: "The Pool of Halves"
## A broken path of stone beams crosses the pool. Some beams are YOURS: they stand in the water on
## pivots (straights and Ls) and turn a quarter at a touch, from the shore or from a beam you stand on.
## The others exist only in the reflection (HERS): you see them in the still water, nothing stands there.
## Turn yours until yours and hers, together, make one unbroken path in the water: then the truth in the
## reflection becomes real, her beams rise into your world as solid stone, and you walk across.
## Every beam end that meets a neighbour carries a glowing seam (in the water, and on your stones).
var pool_pieces := {}               # cell -> {"node", "conn", "real" index or -1, "regions": [Region, Region], "seams": [...]}
var pool_mat: ShaderMaterial
var pool_turns_made := 0
var _pool_tw := {}

func _arm_rect(p: Vector2, d: String) -> Rect2:
	var hx := absf(Ch1Geo.POOL_DX) * 0.5
	var hz := Ch1Geo.POOL_DZ * 0.5
	var w := Ch1Geo.BEAM_W * 0.5
	match d:
		"E": return Level.R(p.x - w, p.y - w, p.x + hx, p.y + w)
		"W": return Level.R(p.x - hx, p.y - w, p.x + w, p.y + w)
		"N": return Level.R(p.x - w, p.y - hz, p.x + w, p.y + w)
		_: return Level.R(p.x - w, p.y - w, p.x + w, p.y + hz)

static func _dir3(d: String) -> Vector3:
	return {"E": Vector3(1, 0, 0), "W": Vector3(-1, 0, 0), "N": Vector3(0, 0, -1), "S": Vector3(0, 0, 1)}[d]

func _pool_piece_mesh(conn: String) -> ArrayMesh:
	# v0.8: clean carved slabs: a body and a slightly inset top course, so every edge reads chamfered
	var m := MB.new()
	var hx := absf(Ch1Geo.POOL_DX) * 0.5
	var hz := Ch1Geo.POOL_DZ * 0.5
	var w := Ch1Geo.BEAM_W
	var col := Color(0.5, 0.25, 0.0)
	for d in conn:
		var v := _dir3(d)
		var L := (hx if absf(v.x) > 0.5 else hz) + w * 0.5 - 0.03
		var c := v * (L * 0.5 - w * 0.5)
		var size := Vector3(L if absf(v.x) > 0.5 else w, 0.86, w if absf(v.x) > 0.5 else L)
		m.box(Vector3(c.x, -0.47, c.z), size, col)
		var top := Vector3(size.x - (0.06 if absf(v.x) < 0.5 else 0.0), 0.05, size.z - (0.06 if absf(v.x) > 0.5 else 0.0))
		m.box(Vector3(c.x, -0.025, c.z), top, col)
	return m.commit()

func _build_pool() -> void:
	var pieces := {}
	for c in Ch1Geo.POOL_GHOSTS: pieces[c] = [Ch1Geo.POOL_GHOSTS[c], -1]
	for i in Ch1Geo.POOL_REALS.size(): pieces[Ch1Geo.POOL_REALS[i][0]] = [Ch1Geo.POOL_REALS[i][1], i]
	for c in pieces:
		var base: String = pieces[c][0]
		var ri: int = pieces[c][1]
		var p := Ch1Geo.cell_pos(c)
		var node := Node3D.new()
		node.position = Vector3(p.x, 0.0, p.y)
		add_child(node)
		puzzles.marble_instance(_pool_piece_mesh(base), node)
		# v0.8: the path ENGRAVED into its top: a carved channel from the centre out along each arm, ending
		# in a notch at the edge that meets the next stone (they turn with it). A notch lights (a thin aqua
		# seam) only when the stone across the joint answers it.
		var seams := []
		var dirs := []
		for d in base:
			var v := _dir3(d)
			var L := absf(Ch1Geo.POOL_DX) * 0.5 if absf(v.x) > 0.5 else Ch1Geo.POOL_DZ * 0.5
			var sm := _smat("res://shaders/floor_mark.gdshader", {"kind": 4.0, "intensity": 1.0, "joint": 0.0})
			seams.append(_mi(_plane(Vector2(0.46, L)), sm, Transform3D(Basis(Vector3.UP, atan2(-v.x, -v.z)), v * (L * 0.5 - 0.01) + Vector3(0, 0.003, 0)), node))
			dirs.append(d)
		if ri >= 0:
			# a small worn bronze pin: it turns about it
			var bm := MB.new()
			bm.cyl(Vector3(0, 0.012, 0), 0.035, 0.045, 0.03, Color(0.5, 1.0, 0.0), 10)
			puzzles.marble_instance(bm.commit(), node)
			var idx := ri
			level.add_interact("pool_turn%d" % ri, Vector3(p.x, 0.0, p.y), "turn", func() -> void: turn_pool(idx), 1.6,
				func() -> bool: return not state["stones"] and not _on_pool_piece(idx) and not _pool_tw.has(idx))
		var regs := []
		for k in 2: regs.append(level.walk(Rect2(), 0.0, NAN, -1, "pool%d_%d_%d" % [c.x, c.y, k], false))
		pool_pieces[c] = {"node": node, "base": base, "real": ri, "regions": regs, "seams": seams, "dirs": dirs}
	# the reflections, on the water
	pool_mat = _smat("res://shaders/pool_stones.gdshader", {"noise_tex": level.noise_tex, "water_y": Ch1Geo.WATER_Y, "top_y": 0.0, "pulse": 0.0})
	pool_mat.render_priority = -1            # (under the sheen: a fixed order, never a sort flicker)
	var pm := _mi(_plane(Vector2(9.0, 3.8)), pool_mat, Transform3D(Basis(), Vector3(-5.1, Ch1Geo.WATER_Y + 0.012, 1.7)))
	pm.layers = PlanarMirror.LAYER_MAIN_FX

func _piece_conn(c: Vector2i) -> String:
	var pc: Dictionary = pool_pieces[c]
	if pc["real"] < 0: return pc["base"]
	return Ch1Geo.rot_conn(pc["base"], int(state["pool_turns"][pc["real"]]))

## yours: walkable (and turned); hers: walkable only once the path is whole
func _pool_apply(c: Vector2i) -> void:
	var pc: Dictionary = pool_pieces[c]
	var conn := _piece_conn(c)
	var p := Ch1Geo.cell_pos(c)
	var solid: bool = pc["real"] >= 0 or state["stones"]
	for k in 2:
		var g: Level.Region = pc["regions"][k]
		g.r = _arm_rect(p, conn[mini(k, conn.length() - 1)])
		g.enabled = solid
	if pc["real"] >= 0: (pc["node"] as Node3D).rotation.y = -float(state["pool_turns"][pc["real"]]) * PI * 0.5
	else:
		(pc["node"] as Node3D).visible = state["stones"]
		(pc["node"] as Node3D).position.y = 0.0

func _pool_reflect() -> void:
	var boxes := PackedVector4Array()
	var infos := PackedVector4Array()
	for c in pool_pieces:
		var pc: Dictionary = pool_pieces[c]
		var p := Ch1Geo.cell_pos(c)
		var hers := 1.0 if pc["real"] < 0 and not state["stones"] else 0.0
		for d in _piece_conn(c):
			var r := _arm_rect(p, d)
			boxes.append(Vector4(r.position.x, r.position.y, r.end.x, r.end.y))
			var v := _dir3(d)
			infos.append(Vector4(v.x, v.z, hers, 1.0 if _joint_ok(c, d) else 0.0))
	pool_mat.set_shader_parameter("arm_box", boxes)
	pool_mat.set_shader_parameter("arm_info", infos)
	pool_mat.set_shader_parameter("count", boxes.size())

func _on_pool_piece(ri: int) -> bool:
	var c: Vector2i = Ch1Geo.POOL_REALS[ri][0]
	var q := Vector2(game.player.position.x, game.player.position.z)
	for g in pool_pieces[c]["regions"]:
		if (g as Level.Region).enabled and (g as Level.Region).r.grow(Player.RADIUS).has_point(q): return true
	return false

func turn_pool(ri: int) -> void:
	if state["stones"] or _pool_tw.has(ri): return
	var c: Vector2i = Ch1Geo.POOL_REALS[ri][0]
	var turns: Array = state["pool_turns"]
	turns[ri] = (int(turns[ri]) + 1) % 4
	pool_turns_made += 1
	event.emit("pool_turn", ri)
	var node: Node3D = pool_pieces[c]["node"]
	# (its walk regions go while it turns, and come back in the new shape)
	for g in pool_pieces[c]["regions"]: (g as Level.Region).enabled = false
	var tw := create_tween()
	_pool_tw[ri] = tw
	var goal := node.rotation.y - PI * 0.5
	tw.tween_property(node, "rotation:y", goal, 0.55).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void:
		_pool_tw.erase(ri)
		_pool_apply(c)
		_pool_reflect()
		_pool_joints()
		if Ch1Geo.pool_path(state["pool_turns"]): _complete_pool(false))

## the reflection is whole: her beams rise into your world, solid
func _complete_pool(instant: bool) -> void:
	state["stones"] = true
	for c in pool_pieces:
		var pc: Dictionary = pool_pieces[c]
		if pc["real"] >= 0: continue
		var node: Node3D = pc["node"]
		node.visible = true
		if instant:
			node.position.y = 0.0
		else:
			# v0.8: her stones RISE out of the water one after another: a burst of spray and droplets, a
			# ring spreading on the still water, a deep stone rumble and a splash
			node.position.y = -0.95
			var tw := create_tween()
			var dl: float = 0.35 * (c.x + c.y * 0.3)
			tw.tween_interval(dl)
			var at := Vector3(node.position.x, Ch1Geo.WATER_Y, node.position.z)
			tw.tween_callback(func() -> void:
				_water_burst(at)
				event.emit("pool_rise", null))
			tw.tween_property(node, "position:y", 0.06, 1.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			tw.tween_property(node, "position:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	for c in pool_pieces: _pool_apply(c)
	_pool_reflect()
	if not instant:
		event.emit("pool_whole", null)
		event.emit("solve", "waking_pool")

## spray, droplets and a spreading ring where a stone breaks the surface
func _water_burst(at: Vector3) -> void:
	var p := CPUParticles3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.07, 0.07)
	p.mesh = q
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/spray.gdshader")
	p.material_override = m
	p.amount = 70
	p.one_shot = true
	p.explosiveness = 0.85
	p.lifetime = 1.3
	p.direction = Vector3.UP
	p.spread = 38.0
	p.initial_velocity_min = 1.6
	p.initial_velocity_max = 3.6
	p.gravity = Vector3(0, -9.0, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.6
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = Vector3(0.5, 0.02, 0.5)
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 1, 1, 1))
	ramp.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = ramp
	p.position = at + Vector3(0, 0.03, 0)
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(p)
	p.emitting = true
	var rm := _smat("res://shaders/water_ring.gdshader", {"t": 0.0})
	var ring := _mi(_plane(Vector2(3.2, 3.2)), rm, Transform3D(Basis(), at + Vector3(0, 0.02, 0)))
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: rm.set_shader_parameter("t", v), 0.0, 1.0, 1.8).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tw.tween_interval(0.6)
	tw.tween_callback(func() -> void:
		ring.queue_free()
		p.queue_free())

func _update_pool(_dt: float) -> void:
	# the pool is still now (no waiting: what it shows is always there to read)
	calm = 0.85
	puzzles.water_over_mat.set_shader_parameter("calm", calm)
	if puzzles.pool_refl: puzzles.pool_refl.puppet.set_param("ripple_amt", 0.15)
	pool_mat.set_shader_parameter("pulse", smoothstep(12.0, 16.0, float(pool_turns_made)) if not state["stones"] else 0.0)

## (tests) every setting of your beams that makes the path whole
static func pool_solutions() -> Array:
	var out := []
	for a in 4:
		for b in 4:
			for c in 4:
				for d in 4:
					if Ch1Geo.pool_path([a, b, c, d]): out.append([a, b, c, d])
	return out

static func _pool_solution() -> Array:
	var s := pool_solutions()
	return s[0] if s.size() > 0 else Ch1Geo.POOL_START.duplicate()

func _apply_pool() -> void:
	for ri in _pool_tw.keys(): (_pool_tw[ri] as Tween).kill()
	_pool_tw.clear()
	pool_turns_made = 0
	for c in pool_pieces: _pool_apply(c)
	_pool_reflect()
	_pool_joints(true)

## is the joint on side d of cell c answered (a stone across it with the opposite connector, or the shore)?
func _joint_ok(c: Vector2i, d: String) -> bool:
	if c == Ch1Geo.POOL_IN and d == "E": return true
	if c == Ch1Geo.POOL_OUT and d == "W": return true
	var dv := Ch1Geo.dir_v(d)
	var n := c + dv
	if not pool_pieces.has(n): return false
	var opp := {"N": "S", "S": "N", "E": "W", "W": "E"}[d] as String
	return opp in _piece_conn(n)

## v0.8 per-joint feedback: every answered joint lights at once (a thin aqua seam in its notch, a soft
## chime when it first lights); the reflection lights hers in rose. Returns the number of answered joints.
var pool_joints_lit := {}                 # "cx,cy,d" -> true
func _pool_joints(instant := false) -> int:
	var n := 0
	var fresh := 0
	var now := {}
	for c in pool_pieces:
		var pc: Dictionary = pool_pieces[c]
		var real_dirs: Array = pc["dirs"]
		for k in real_dirs.size():
			# the seam quads were laid along the BASE connectors; the node's turn carries them round
			var d: String = real_dirs[k]
			if pc["real"] >= 0: d = Ch1Geo.rot_conn(d, int(state["pool_turns"][pc["real"]]))
			var ok := _joint_ok(c, d)
			var sm: ShaderMaterial = (pc["seams"][k] as MeshInstance3D).material_override
			if instant: sm.set_shader_parameter("joint", 0.35 if ok else 0.0)       # (v0.8.1: at rest a faint seam)
			else:
				var from: float = sm.get_shader_parameter("joint")
				var jt := create_tween()
				if ok and from < 0.5:
					# (a joint just answered: both halves pulse, then settle lit)
					jt.tween_method(func(v: float) -> void: sm.set_shader_parameter("joint", v), from, 2.2, 0.15)
					jt.tween_method(func(v: float) -> void: sm.set_shader_parameter("joint", v), 2.2, 0.35, 0.6)
				else:
					jt.tween_method(func(v: float) -> void: sm.set_shader_parameter("joint", v), from, 0.35 if ok else 0.0, 0.35)
			if ok:
				n += 1
				var key := "%d,%d,%s" % [c.x, c.y, d]
				now[key] = true
				if not pool_joints_lit.has(key) and pc["real"] >= 0: fresh += 1
	if fresh > 0 and not instant:
		event.emit("pool_joint", fresh)
		create_tween().tween_method(func(v: float) -> void: pool_mat.set_shader_parameter("flash", v), 1.0, 0.0, 0.8)
	pool_joints_lit = now
	return n

# ------------------------------------------------------------------ 2. stair of breath
## a small glass to breathe on (own_glass false: a patch of a larger mirror that is already there)
func _breath_glass(id: String, center: Vector3, basis: Basis, size: Vector2, glyphs: Vector3, vertical: bool, own_glass := true) -> void:
	if own_glass:
		var mm := puzzles._mirror_quad(center, basis, size, false, 1.0)
		mm.set_shader_parameter("floor_y", center.y - 1.2)
		mm.set_shader_parameter("ncols", 0)
	var bm := _smat("res://shaders/breath.gdshader", {"noise_tex": level.noise_tex, "glyphs": glyphs, "flip": 1.0,
		"size": size, "vertical": 1.0 if vertical else 0.0})
	var mi := _mi(_quad(size), bm, Transform3D(basis, center + basis * Vector3(0, 0, 0.06)))
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	bm.render_priority = 2                 # always over the glass's own sheen (no sort flicker)
	breath_mats[id] = bm

func _build_stair() -> void:
	_breath_glass("stair", Vector3(-10.345, 1.75, -5.3), Basis(Vector3.UP, -PI * 0.5), Vector2(1.0, 1.25), Vector3(99, -1, -1), false)
	level.add_interact("breathe_stair", Vector3(-11.1, 0.5, -5.3), "breathe", func() -> void: breathe("stair"), 1.25)
	# v0.7: before the glass, the whole rune she will ask about, carved large in the cliff wall: her half and
	# its mirror, the half you must give her. (QA P1-11: "together" is mirror-symmetric, so carved as your
	# world carves all writing, mirrored, it reads the same: it never contradicts the mirror rule)
	var half: Array = GlassTalk.TEMPLATES["together_half"][0]
	var gp := PackedVector2Array()
	for q in GlassTalk.smooth(PackedVector2Array(half), 3): gp.append(q * 1.3 + Vector2(0.0, 0.04))
	var rw := _smat("res://shaders/rune_wall.gdshader", {"pts": gp, "count": mini(gp.size(), 24), "lit": 0.9})
	stair_rune = _mi(_quad(Vector2(1.6, 1.6)), rw, Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(-10.215, 1.75, -2.6)))     # (proud of the wall face at x -10.2)
	stair_veil = _smat("res://shaders/mist_veil.gdshader", {"noise_tex": level.noise_tex, "density": 1.0, "glow": 0.35})
	_mi(_quad(Vector2(1.9, 3.2)), stair_veil, Transform3D(Basis(), Vector3(-11.3, 0.5 + 1.6, -6.8)))

## breathe on a small glass; from the other side she writes in the fog
func breathe(id: String) -> void:
	if _breathing != "": return
	if id == "stair" and not state["breath"]:
		# v0.5b: "An Answer on the Glass": the close-up of the pane, her question, your finger
		event.emit("breath", id)
		game.open_glass("stair")
		return
	_breathing = id
	var m: ShaderMaterial = breath_mats[id]
	game.player.locked = true
	event.emit("breath", id)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("fog", v), 0.0, 1.0, 1.1)
	tw.tween_interval(0.5)
	tw.tween_callback(func() -> void: event.emit("writing", id))
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("write", v), 0.0, 1.0, 2.6 if id == "stair" else 4.2)
	tw.tween_callback(func() -> void:
		game.player.locked = false
		_breathing = ""
		_breath_done(id))
	tw.tween_interval(9.0)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("fog", v), 1.0, 0.0, 5.0)
	tw.tween_callback(func() -> void: m.set_shader_parameter("write", 0.0))

## the conversation through the glass ended well: the pane in the world keeps her writing a while
func glass_answered(id: String) -> void:
	if id != "stair": return
	var m: ShaderMaterial = breath_mats["stair"]
	m.set_shader_parameter("fog", 1.0)
	m.set_shader_parameter("write", 1.0)
	var tw := create_tween()
	tw.tween_interval(8.0)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("fog", v), 1.0, 0.0, 5.0)
	tw.tween_callback(func() -> void: m.set_shader_parameter("write", 0.0))
	if not state["breath"]: _open_stair(false)

func _breath_done(id: String) -> void:
	if id == "stair" and not state["breath"]:
		_open_stair(false)
	elif id == "garden":
		state["garden_breath"] = true

func _open_stair(instant: bool) -> void:
	state["breath"] = true
	level.set_enabled("breath_gate", false)
	if instant:
		stair_veil.set_shader_parameter("density", 0.0)
		return
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: stair_veil.set_shader_parameter("density", v), 1.0, 0.0, 2.5)
	event.emit("solve", "stair_breath")

# ------------------------------------------------------------------ 3. hall of glass: "What the Glass Remembers"
## The great mirror shows the hall as it WAS: the walled-up doorway open, and three things where they
## stood: a fallen column drum, a brazier, a veiled bust. Your hall today is the same hall, rearranged
## (and none of it is in the glass: the glass only remembers). Set it back: push the drum, carry the
## brazier, turn the bust. The glass is a mirror: what stands deeper in it stands farther from it, and
## a face it shows you is turned toward the glass. Each thing set right appears in the glass and its
## memory fades; when all three are back, the doorway opens and the Mirror Shard lies on its threshold.
## Cells are whole metres (x, z); the floor carries a faint bronze grid, seen in the glass as well.
const DRUM_START := Vector2i(-1, -13)
const DRUM_GOAL := Vector2i(0, -19)
const BRAZ_START := Vector2i(3, -13)
const BRAZ_GOAL := Vector2i(2, -19)
const BUST_POS := Vector3(1.0, 1.0, -18.0)
const BUST_START := 2                   # quarter turns; 0 = facing north (the glass), 2 = south
const BUST_GOAL := 0
const SHARD_SPOT := Vector3(4.55, 1.0, -17.5)
var drum_node: Node3D
var braz_node: Node3D
var bust_pivot: Node3D
var twins: Array[Node3D] = []           # drum, brazier, bust as the glass remembers them
var twin_mats: Array = []               # their glows (they pulse as a hint)
var hall_obs: Array = []                # drum, brazier, bust obstacles
var carrying := false
var hall_moves := 0                     # moves since the last thing set right (a hint after a while)
var _drum_tw: Tween
var _bust_tw: Tween
var shard_take: Level.Interact
var push_arrow: MeshInstance3D
var push_arrow_mat: ShaderMaterial
var bust_arc: MeshInstance3D
var bust_arc_mat: ShaderMaterial
var goal_mats: Array[ShaderMaterial] = []
var match_glows: Array[ShaderMaterial] = []

func _drum_mesh() -> ArrayMesh:
	# a fluted column drum standing on its bed face: it slides, it never rolls (v0.7); a chip broken from its rim
	var m := MB.new()
	var c := Color(0.5, 0.25, 0.0)
	m.cyl(Vector3(0, 0.36, 0), 0.43, 0.43, 0.66, c, 20)
	m.cyl(Vector3(0, 0.71, 0), 0.4, 0.43, 0.05, c, 20)
	m.cyl(Vector3(0, 0.025, 0), 0.43, 0.41, 0.05, c, 20)
	for k in 10:
		var a := TAU * k / 10.0
		m.box(Vector3(cos(a) * 0.43, 0.36, sin(a) * 0.43), Vector3(0.05, 0.6, 0.05), Color(0.42, 0.25, 0.0), Basis(Vector3.UP, -a))
	m.box(Vector3(0.3, 0.7, 0.18), Vector3(0.16, 0.12, 0.2), c, Basis(Vector3.UP, 0.6))
	return m.commit()

func _brazier_mesh() -> ArrayMesh:
	var m := MB.new()
	var br := Color(0.5, 1.0, 0.0)
	for k in 3:
		var a := k * TAU / 3.0
		var foot := Vector3(cos(a) * 0.3, 0.0, sin(a) * 0.3)
		var top := Vector3(cos(a) * 0.17, 0.82, sin(a) * 0.17)
		var mid := (foot + top) * 0.5
		var dir := (top - foot).normalized()
		var ax := dir.cross(Vector3.UP).normalized()
		m.cyl(mid, 0.025, 0.035, foot.distance_to(top), br, 6, Basis(ax, -acos(dir.dot(Vector3.UP))) if ax.length() > 0.5 else Basis())
	m.cyl(Vector3(0, 0.92, 0), 0.34, 0.18, 0.22, br, 16)
	m.cyl(Vector3(0, 1.04, 0), 0.36, 0.35, 0.04, br, 16)
	m.box(Vector3(0, 0.03, 0), Vector3(0.5, 0.06, 0.5), Color(0.5, 0.25, 0.0))
	return m.commit()

## a veiled bust on its plinth; its face (and the eye rune on the veil) look toward local -z
func _bust_mesh() -> ArrayMesh:
	var m := MB.new()
	var c := Color(0.5, 0.25, 0.0)
	m.box(Vector3(0, 0.5, 0), Vector3(0.55, 1.0, 0.55), c)
	m.box(Vector3(0, 1.03, 0), Vector3(0.66, 0.06, 0.66), c)
	m.cyl(Vector3(0, 1.3, 0), 0.24, 0.3, 0.5, c, 14)
	m.box(Vector3(0, 1.36, -0.2), Vector3(0.42, 0.4, 0.2), c)
	m.sphere(Vector3(0, 1.55, 0.01), Vector3(0.3, 0.1, 0.19), c, 14, 5)
	m.cyl(Vector3(0, 1.69, 0.02), 0.14, 0.25, 0.3, c, 14)
	var hb := Basis(Vector3.RIGHT, -0.2)
	m.sphere(Vector3(0, 1.86, 0.0), Vector3(0.155, 0.19, 0.17), c, 14, 7, hb)
	m.sphere(Vector3(0, 1.85, -0.1), Vector3(0.11, 0.14, 0.11), c, 10, 5, hb)
	m.sphere(Vector3(0, 1.83, -0.17), Vector3(0.05, 0.07, 0.05), c, 8, 4, hb)
	m.sphere(Vector3(0, 1.93, 0.03), Vector3(0.165, 0.15, 0.17), c, 12, 6, hb)
	return m.commit()

func _hall_thing(mesh: Mesh, twin: bool) -> Node3D:
	var n := Node3D.new()
	add_child(n)
	var mi := puzzles.marble_instance(mesh, n)
	mi.layers = PlanarMirror.LAYER_DOUBLE if twin else PlanarMirror.LAYER_MAIN_FX
	return n

func _build_hall() -> void:
	# the doorway as the glass remembers it (seen only in the reflection): warm light in the opening
	var dm := _smat("res://shaders/mist_veil.gdshader", {"noise_tex": level.noise_tex, "density": 0.55, "glow": 1.0})
	var d := _mi(_quad(Vector2(1.7, 2.7)), dm, Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(4.82, 2.35, -17.5)))
	d.layers = PlanarMirror.LAYER_DOUBLE
	# a faint bronze grid inlaid in the black floor (whole metres), in the glass as well
	var gm := _smat("res://shaders/floor_grid.gdshader", {"rect": Vector4(-4.5, -20.5, 4.5, -11.5)})
	_mi(_plane(Vector2(9.0, 9.0)), gm, Transform3D(Basis(), Vector3(0.0, 1.006, -16.0)))
	# today's things (only in your world) and their memories (only in the glass)
	var dmesh := _drum_mesh()
	var bmesh := _brazier_mesh()
	var umesh := _bust_mesh()
	drum_node = _hall_thing(dmesh, false)
	braz_node = _hall_thing(bmesh, false)
	bust_pivot = _hall_thing(umesh, false)
	bust_pivot.position = BUST_POS
	# (v0.8.1) the brazier burns with a natural warm fire, and lights the hall round it
	var flame := Flame.new(0.0, 0.62, Color(1.0, 0.66, 0.36), level.noise_tex)
	flame.position = Vector3(0, 1.0, 0)
	flame.energy = 1.9
	flame.range_m = 4.5
	flame.key = true
	braz_node.add_child(flame)
	flame.mat.set_shader_parameter("intensity", 1.0)
	var eye := puzzles.rune_quad(bust_pivot, Vector3(0, 1.86, -0.2), Vector2(0.2, 0.2), Basis(Vector3.UP, PI), 0.0, 0.7)
	(bust_pivot.get_child(bust_pivot.get_child_count() - 1) as MeshInstance3D).layers = PlanarMirror.LAYER_MAIN_FX
	puzzles.rune_quad(bust_pivot, Vector3(0, 1.38, -0.31), Vector2(0.4, 0.4), Basis(Vector3.UP, PI), 0.0, 1.0)
	(bust_pivot.get_child(bust_pivot.get_child_count() - 1) as MeshInstance3D).layers = PlanarMirror.LAYER_MAIN_FX
	for k in 3:
		var t := _hall_thing([dmesh, bmesh, umesh][k], true)
		twins.append(t)
		var g := puzzles.glow_quad(t, Vector3(0, [0.9, 1.32, 1.5][k], 0), [1.6, 1.0, 1.8][k], Palette.CORE if k == 1 else Palette.ACCENT, 0.9 if k == 1 else 0.0)
		(t.get_child(t.get_child_count() - 1) as MeshInstance3D).layers = PlanarMirror.LAYER_DOUBLE
		twin_mats.append(g)
		if k == 2:
			var e2 := puzzles.rune_quad(t, Vector3(0, 1.86, -0.2), Vector2(0.2, 0.2), Basis(Vector3.UP, PI), 0.0, 0.8)
			(t.get_child(t.get_child_count() - 1) as MeshInstance3D).layers = PlanarMirror.LAYER_DOUBLE
			puzzles.rune_quad(t, Vector3(0, 1.38, -0.31), Vector2(0.4, 0.4), Basis(Vector3.UP, PI), 0.0, 1.0)
			(t.get_child(t.get_child_count() - 1) as MeshInstance3D).layers = PlanarMirror.LAYER_DOUBLE
	twins[0].position = Vector3(DRUM_GOAL.x, 1.0, DRUM_GOAL.y)
	twins[1].position = Vector3(BRAZ_GOAL.x, 1.0, BRAZ_GOAL.y)
	twins[2].position = BUST_POS
	twins[2].rotation.y = BUST_GOAL * PI * 0.5
	hall_obs.append(level.ob_circle(Vector2.ZERO, 0.5, "hall_drum"))
	hall_obs.append(level.ob_circle(Vector2.ZERO, 0.3, "hall_brazier"))
	hall_obs.append(level.ob_circle(Vector2(BUST_POS.x, BUST_POS.z), 0.4, "hall_bust"))
	level.add_interact("hall_push", Vector3.ZERO, "push", push_drum, 1.05, func() -> bool: return _push_dir() != Vector2i.ZERO)
	level.add_interact("hall_take", Vector3.ZERO, "take", take_brazier, 0.95, func() -> bool: return not carrying and not _locked(1))
	level.add_interact("hall_place", Vector3.ZERO, "place", place_brazier, 0.6, func() -> bool: return carrying and _in_hall())
	level.add_interact("hall_turn", BUST_POS + Vector3(0, 0, 0.7), "turn", turn_bust, 0.95, func() -> bool: return not _locked(2) and not carrying)
	shard_take = level.add_interact("take_shard", SHARD_SPOT, "shard", take_shard, 1.0, func() -> bool: return state["hall_door"] and not state["shard"])
	# v0.7: marks. The push arrow (shown when you stand square to the drum); the bust's facing pointer and
	# its turning arc; the remembered places as faint outlines (in the glass only), and on your floor a
	# cell that lights when the thing on it is where the glass remembers it
	push_arrow_mat = _smat("res://shaders/floor_mark.gdshader", {"kind": 0.0, "intensity": 0.0})
	push_arrow = _mi(_plane(Vector2(0.62, 0.62)), push_arrow_mat, Transform3D(Basis(), Vector3(0, 1.012, 0)))
	push_arrow.layers = PlanarMirror.LAYER_MAIN_FX
	bust_arc_mat = _smat("res://shaders/floor_mark.gdshader", {"kind": 2.0, "intensity": 0.0, "sweep": 0.0})
	bust_arc = _mi(_plane(Vector2(1.5, 1.5)), bust_arc_mat, Transform3D(Basis(), BUST_POS + Vector3(0, 0.014, 0)))
	bust_arc.layers = PlanarMirror.LAYER_MAIN_FX
	# (v0.8.1, the owner: no marks of where things go: the glass alone tells it)
	# the reset altar by the way in: everything not yet set right goes back to where it was found
	var am := MB.new()
	am.box(Vector3(-3.9, 1.35, -15.8), Vector3(0.55, 0.7, 0.55), Color(0.5, 0.25, 0.0))
	am.box(Vector3(-3.9, 1.73, -15.8), Vector3(0.66, 0.06, 0.66), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(am.commit(), self)
	puzzles.rune_quad(self, Vector3(-3.9, 1.765, -15.8), Vector2(0.5, 0.5), Basis(Vector3.RIGHT, -PI * 0.5), 1.0, 0.5)
	level.ob_rect(Level.R(-4.2, -16.1, -3.6, -15.5))
	level.add_interact("hall_reset", Vector3(-3.9, 1.0, -15.8), "reset", reset_hall, 0.95, func() -> bool: return not state["hall_door"] and not carrying)
	level.inscription("h_hall", Vector3(-3.4, 1.0, -12.6), "I moved what she loved in this hall, and walled up her door.\nThe glass kept all of it, as it was.", 1.2,
		Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(-3.4, 1.012, -12.95)), Vector2(1.15, 0.78))
	# the shard: a sliver of mirror, glowing (it lies on the threshold once the door is back)
	shard_node = Node3D.new()
	add_child(shard_node)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := [Vector3(0, 0.22, 0), Vector3(-0.07, -0.12, 0.012), Vector3(0.09, -0.16, -0.012)]
	for k in [0, 1, 2]: st.add_vertex(pts[k])
	for k in [0, 2, 1]: st.add_vertex(pts[k])
	st.generate_normals()
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.75, 0.85, 0.9)
	sm.emission_enabled = true
	sm.emission = Palette.CORE
	sm.emission_energy_multiplier = 1.6
	sm.metallic_specular = 1.0
	sm.roughness = 0.05
	_mi(st.commit(), sm, Transform3D(), shard_node)
	puzzles.glow_quad(shard_node, Vector3.ZERO, 0.9, Palette.ACCENT, 0.7)
	shard_node.visible = false

func _cell_v3(c: Vector2i) -> Vector3:
	return Vector3(c.x, 1.0, c.y)

func _hall_state() -> Dictionary:
	return state["hall"]

func _locked(k: int) -> bool:
	return bool(_hall_state()["locks"][k])

## a cell the drum or the brazier may stand on: inside the hall, clear of stone and of the other things
func hall_free(c: Vector2i, rad: float, ignore: int) -> bool:
	var q := Vector2(c.x, c.y)
	var hall := Level.R(-4.6, -20.6, 4.6, -11.0)
	if q.x - rad < hall.position.x or q.x + rad > hall.end.x or q.y - rad < hall.position.y or q.y + rad > hall.end.y: return false
	var was: Array[bool] = []
	for o in hall_obs:
		was.append(o.enabled)
		o.enabled = false
	var blocked := level.blocked(q, rad)
	for i in hall_obs.size(): hall_obs[i].enabled = was[i]
	if blocked: return false
	var hs := _hall_state()
	if ignore != 0 and Vector2(hs["drum"][0], hs["drum"][1]).distance_to(q) < rad + 0.42: return false
	if ignore != 1 and not carrying and Vector2(hs["brazier"][0], hs["brazier"][1]).distance_to(q) < rad + 0.32: return false
	if ignore != 2 and Vector2(BUST_POS.x, BUST_POS.z).distance_to(q) < rad + 0.4: return false
	return true

## which way the drum would go if you pushed now (zero: you are not square to it)
func _push_dir() -> Vector2i:
	if _locked(0) or carrying or (_drum_tw and _drum_tw.is_running()): return Vector2i.ZERO
	var hs := _hall_state()
	var c := Vector2(hs["drum"][0], hs["drum"][1])
	var p := Vector2(game.player.position.x, game.player.position.z)
	var d := c - p
	if d.length() > 1.05 or d.length() < 0.3: return Vector2i.ZERO
	var dir := Vector2i(signi(roundi(d.x)) if absf(d.x) > absf(d.y) else 0, signi(roundi(d.y)) if absf(d.y) >= absf(d.x) else 0)
	if dir == Vector2i.ZERO: return dir
	var perp := absf(d.y) if dir.x != 0 else absf(d.x)
	if perp > 0.45: return Vector2i.ZERO
	if not hall_free(Vector2i(int(hs["drum"][0]), int(hs["drum"][1])) + dir, 0.42, 0): return Vector2i.ZERO
	return dir

func push_drum() -> void:
	var dir := _push_dir()
	if dir == Vector2i.ZERO: return
	var hs := _hall_state()
	var c := Vector2i(int(hs["drum"][0]), int(hs["drum"][1])) + dir
	hs["drum"] = [c.x, c.y]
	hall_moves += 1
	event.emit("hall_push", null)
	(hall_obs[0] as Level.Obstacle).c = Vector2(c.x, c.y)
	if _drum_tw: _drum_tw.kill()
	_drum_tw = create_tween()
	var from := drum_node.position
	_drum_tw.tween_method(func(v: float) -> void:
		drum_node.position = from.lerp(_cell_v3(c), v)
		if fmod(v * 6.0, 1.0) < 0.12: game.world.dust_puff(drum_node.position + Vector3(randf_range(-0.3, 0.3), 0.0, randf_range(-0.3, 0.3))),
		0.0, 1.0, 0.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_drum_tw.tween_callback(func() -> void:
		_check_hall()
		if not _locked(0) and not _drum_movable():
			# stuck against the stone: after a moment it rolls back to where it lay
			var tw := create_tween()
			tw.tween_interval(1.6)
			tw.tween_callback(func() -> void:
				if hs["drum"] != [c.x, c.y] or _locked(0) or _drum_movable(): return
				hs["drum"] = [DRUM_START.x, DRUM_START.y]
				(hall_obs[0] as Level.Obstacle).c = Vector2(DRUM_START)
				drum_node.position = _cell_v3(DRUM_START)
				event.emit("hall_reset", null))
			tw.tween_property(drum_node, "position", _cell_v3(DRUM_START), 1.4).set_trans(Tween.TRANS_SINE))

## can the drum still be pushed some way (with room to stand behind it)?
func _drum_movable() -> bool:
	var hs := _hall_state()
	var c := Vector2i(int(hs["drum"][0]), int(hs["drum"][1]))
	for dir in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		var stand := Vector2(c.x - dir.x * 0.85, c.y - dir.y * 0.85)     # (clear of the drum's own footprint)
		if hall_free(c + dir, 0.42, 0) and level.on_ground(stand) and not level.blocked(stand, Player.RADIUS): return true
	return false

func take_brazier() -> void:
	if carrying or _locked(1): return
	carrying = true
	hall_moves += 1
	(hall_obs[1] as Level.Obstacle).enabled = false
	event.emit("hall_take", null)

## set it down on the cell in front of you
func place_brazier() -> void:
	if not carrying: return
	var p := game.player.position
	var fwd := Vector3(-sin(game.player.yaw), 0, -cos(game.player.yaw))
	var c := Vector2i(roundi(p.x + fwd.x * 0.95), roundi(p.z + fwd.z * 0.95))
	if Vector2(c.x, c.y).distance_to(Vector2(p.x, p.z)) < 0.55 or not hall_free(c, 0.32, 1):
		event.emit("hall_nope", null)
		return
	carrying = false
	_hall_state()["brazier"] = [c.x, c.y]
	(hall_obs[1] as Level.Obstacle).c = Vector2(c.x, c.y)
	(hall_obs[1] as Level.Obstacle).enabled = true
	event.emit("hall_place", null)
	var tw := create_tween()
	tw.tween_property(braz_node, "position", _cell_v3(c), 0.35).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(_check_hall)

func turn_bust() -> void:
	if _locked(2): return
	var hs := _hall_state()
	hs["bust"] = (int(hs["bust"]) + 1) % 4
	hall_moves += 1
	event.emit("statue_turn", -2)
	if _bust_tw: _bust_tw.kill()
	var goal := roundf((bust_pivot.rotation.y + PI * 0.5) / (PI * 0.5)) * PI * 0.5
	_bust_tw = create_tween()
	_bust_tw.tween_property(bust_pivot, "rotation:y", goal, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	# the arc: a quarter swept on the floor from where it looked to where it looks now
	bust_arc.rotation.y = goal - PI * 0.5
	_bust_tw.parallel().tween_method(func(v: float) -> void: bust_arc_mat.set_shader_parameter("sweep", v), 0.0, 1.0, 0.45).set_trans(Tween.TRANS_SINE)
	_bust_tw.tween_interval(0.3)
	_bust_tw.tween_callback(func() -> void:
		bust_arc_mat.set_shader_parameter("sweep", 0.0)
		bust_arc.rotation.y = goal)
	_bust_tw.tween_callback(_check_hall)

## is each thing where (and as) the glass remembers it?
func hall_matches() -> Array:
	var hs := _hall_state()
	return [Vector2i(int(hs["drum"][0]), int(hs["drum"][1])) == DRUM_GOAL,
		not carrying and Vector2i(int(hs["brazier"][0]), int(hs["brazier"][1])) == BRAZ_GOAL,
		int(hs["bust"]) % 4 == BUST_GOAL]

## (v0.8.1, the owner) nothing tells you one thing is right: only when ALL three stand as the glass
## remembers them, at once, do they appear in the glass and the doorway opens
func _check_hall() -> void:
	var m := hall_matches()
	var hs := _hall_state()
	if m != [true, true, true] or state["hall_door"]: return
	for k in 3:
		hs["locks"][k] = true
		_lock_thing(k, false)
	hall_moves = 0
	event.emit("hall_lock", 0)
	_open_hall_door(false)

## set right: the thing appears in the glass, its memory fades out of it
func _lock_thing(k: int, instant: bool) -> void:
	var node: Node3D = [drum_node, braz_node, bust_pivot][k]
	for c in node.get_children():
		if c is MeshInstance3D: (c as MeshInstance3D).layers = 1 | PlanarMirror.LAYER_MAIN_FX
	if instant:
		twins[k].visible = false
		return
	var g: ShaderMaterial = twin_mats[k]
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: g.set_shader_parameter("intensity", v), 1.6, 0.0, 1.4)
	tw.tween_callback(func() -> void: twins[k].visible = false)

func _in_hall() -> bool:
	return Level.R(-4.6, -20.6, 4.6, -11.0).has_point(Vector2(game.player.position.x, game.player.position.z))

func _update_hall(dt: float) -> void:
	var hs := _hall_state()
	var pl := game.player
	# (QA P1-1) the brazier does not leave the Hall: carried out, it goes back to where it last stood
	if carrying and not _in_hall():
		carrying = false
		(hall_obs[1] as Level.Obstacle).enabled = true
		var back := _cell_v3(Vector2i(int(hs["brazier"][0]), int(hs["brazier"][1])))
		create_tween().tween_property(braz_node, "position", back, 0.5).set_trans(Tween.TRANS_SINE)
		braz_node.rotation.y = 0.0
		event.emit("hall_reset", null)
	if carrying:
		var fwd := Vector3(-sin(pl.yaw), 0, -cos(pl.yaw))
		braz_node.position = braz_node.position.lerp(pl.position + fwd * 0.55 + Vector3(0, 0.25, 0), 1.0 - exp(-dt * 14.0))
		braz_node.rotation.y = pl.yaw
	var pd := _push_dir() if not state["hall_door"] else Vector2i.ZERO
	var ak: float = push_arrow_mat.get_shader_parameter("intensity")
	push_arrow_mat.set_shader_parameter("intensity", move_toward(ak, 0.9 if pd != Vector2i.ZERO else 0.0, dt * 4.0))
	if pd != Vector2i.ZERO:
		var dp := Vector3(pd.x, 0, pd.y)
		push_arrow.transform = Transform3D(Basis(Vector3.UP, atan2(-dp.x, -dp.z)), Vector3(hs["drum"][0], 1.75, hs["drum"][1]))
	bust_arc_mat.set_shader_parameter("intensity", 0.0 if _locked(2) else 0.55)
	if not (_bust_tw and _bust_tw.is_running()): bust_arc.rotation.y = bust_pivot.rotation.y
	var it_push: Level.Interact = level.interact_by_id("hall_push")
	it_push.pos = Vector3(hs["drum"][0], 1.0, hs["drum"][1])
	level.interact_by_id("hall_take").pos = Vector3(hs["brazier"][0], 1.0, hs["brazier"][1])
	level.interact_by_id("hall_place").pos = pl.position
	# a hint after many moves without anything set right: the memories in the glass pulse
	if not state["hall_door"]:
		var pulse := smoothstep(14.0, 18.0, float(hall_moves)) * (0.5 + 0.5 * sin(_t * 2.2))
		for k in 3:
			if not hs["locks"][k]:
				var gi: float = (0.9 if k == 1 else 0.0) + pulse * 0.9
				(twin_mats[k] as ShaderMaterial).set_shader_parameter("intensity", gi)
				twins[k].get_child(1).visible = gi > 0.01

func _apply_hall() -> void:
	var hs := _hall_state()
	carrying = false
	if _drum_tw: _drum_tw.kill()
	drum_node.position = Vector3(hs["drum"][0], 1.0, hs["drum"][1])
	braz_node.position = Vector3(hs["brazier"][0], 1.0, hs["brazier"][1])
	bust_pivot.rotation.y = int(hs["bust"]) * PI * 0.5
	(hall_obs[0] as Level.Obstacle).c = Vector2(hs["drum"][0], hs["drum"][1])
	(hall_obs[1] as Level.Obstacle).c = Vector2(hs["brazier"][0], hs["brazier"][1])
	(hall_obs[1] as Level.Obstacle).enabled = true
	for k in 3:
		var node: Node3D = [drum_node, braz_node, bust_pivot][k]
		var locked: bool = hs["locks"][k]
		for c in node.get_children():
			if c is MeshInstance3D: (c as MeshInstance3D).layers = (1 | PlanarMirror.LAYER_MAIN_FX) if locked else PlanarMirror.LAYER_MAIN_FX
		twins[k].visible = not locked
		(twin_mats[k] as ShaderMaterial).set_shader_parameter("intensity", 0.9 if k == 1 else 0.0)
	shard_node.visible = state["hall_door"] and not state["shard"]
	shard_node.position = SHARD_SPOT + Vector3(0, 0.55, 0)

## the altar by the way in: what is not yet set right goes back to where it was found
func reset_hall() -> void:
	if state["hall_door"] or carrying: return
	var hs := _hall_state()
	# (not onto you: if you stand where a thing would return, nothing moves)
	var me := Vector2(game.player.position.x, game.player.position.z)
	if me.distance_to(Vector2(DRUM_START)) < 0.8 or me.distance_to(Vector2(BRAZ_START)) < 0.6:
		event.emit("hall_nope", null)
		return
	if not hs["locks"][0]:
		hs["drum"] = [DRUM_START.x, DRUM_START.y]
	if not hs["locks"][1]:
		hs["brazier"] = [BRAZ_START.x, BRAZ_START.y]
	if not hs["locks"][2]:
		hs["bust"] = BUST_START
	hall_moves = 0
	event.emit("hall_reset", null)
	_apply_hall()

func take_shard() -> void:
	if state["shard"]: return
	state["shard"] = true
	game.ui.set_inventory(true, false)
	event.emit("shard", null)
	var tw := create_tween()
	var a := shard_node.position
	tw.tween_method(func(k: float) -> void:
		shard_node.position = a.lerp(game.player.position + Vector3(0, 0.9, 0), k) + Vector3(0, sin(k * PI) * 0.3, 0)
		shard_node.rotation.y = k * TAU, 0.0, 1.0, 0.7).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void: shard_node.visible = false)

func _open_hall_door(instant: bool) -> void:
	state["hall_door"] = true
	level.set_enabled("hdoor", true)
	shard_node.visible = not state["shard"]
	shard_node.position = SHARD_SPOT + Vector3(0, 0.55, 0)
	var hd := level.get_node_or_null("Zone_Hdoor") as MeshInstance3D
	if hd == null: return
	if instant:
		hd.visible = false
		return
	var tw := create_tween()
	tw.tween_property(hd, "position:y", -2.9, 2.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: hd.visible = false)
	event.emit("solve", "hall_glass")

# ------------------------------------------------------------------ 4. shard gallery
## v0.7 "Her Lamps": four veiled busts stand on plinths against the gallery walls, a votive bowl set in
## each plinth's front, cold. A mural on the east wall, readable only through the raised shard, is a
## plan of the gallery with three of the busts marked I, II, III: the ones that were hers, and the order
## to light their lamps. But it is drawn as SHE sees the room, from her side of the glass: left and right
## swapped (her way in from the Hall sits at the wrong end, and so does the true arch). Read it the right
## way round and light the three lamps in order: each teal flame lights its bust's face from below; the
## third, if right, wakes the veils and the true arch opens. A wrong order and the flames gutter out;
## after two such tries the mural's arch and doorway (the clues) shine brighter.
## (staggered down the narrow gallery, so you always stand before one lamp and not between two)
const GL_BUST := [Vector3(5.18, 1.0, -15.4), Vector3(6.67, 1.0, -14.6), Vector3(5.18, 1.0, -12.4), Vector3(6.67, 1.0, -11.85)]
const GL_ORDER := [3, 0, 1]             # B3 (east, south pair), B0 (west, north), B1 (east, north)
var gl_flames: Array[ShaderMaterial] = []
var gl_lamps: Array = []                # per lamp: {"light": OmniLight3D, "halo", "pool", "veil", "face"}
var gl_map: ShaderMaterial
var gl_fails := 0
var _gl_busy := false

## the bowl of lamp i (where its flame stands): in front of the plinth, toward the gallery's middle
static func gl_bowl(i: int) -> Vector3:
	var b: Vector3 = GL_BUST[i]
	return b + Vector3(0.2 if b.x < 6.0 else -0.2, 0.0, 0.0)

func _votive_mesh() -> ArrayMesh:
	# local -z is the front (toward the gallery's middle)
	var m := MB.new()
	var c := Color(0.5, 0.25, 0.0)
	var br := Color(0.5, 1.0, 0.0)
	m.box(Vector3(0, 0.03, 0.0), Vector3(0.6, 0.06, 0.4), c)
	m.box(Vector3(0, 0.55, 0.02), Vector3(0.5, 1.0, 0.34), c)
	m.box(Vector3(0, 1.08, 0.0), Vector3(0.58, 0.06, 0.4), c)
	# the bowl, set into the plinth's front at its top (a bronze cup on a short bracket)
	m.box(Vector3(0, 0.96, -0.16), Vector3(0.1, 0.14, 0.08), br)
	m.cyl(Vector3(0, 1.1, -0.2), 0.13, 0.07, 0.1, br, 14)
	m.cyl(Vector3(0, 1.155, -0.2), 0.14, 0.135, 0.02, br, 14)
	# the bust: shoulders, a full chest, the veiled head bowed a little toward the bowl
	m.cyl(Vector3(0, 1.32, 0.04), 0.17, 0.21, 0.42, c, 14)
	m.sphere(Vector3(0, 1.53, 0.04), Vector3(0.26, 0.08, 0.15), c, 12, 5)
	m.cyl(Vector3(0, 1.64, 0.05), 0.12, 0.2, 0.24, c, 12)
	var hb := Basis(Vector3.RIGHT, 0.18)
	m.sphere(Vector3(0, 1.8, 0.03), Vector3(0.13, 0.16, 0.14), c, 12, 6, hb)
	m.sphere(Vector3(0, 1.79, -0.06), Vector3(0.09, 0.12, 0.09), c, 10, 5, hb)
	m.sphere(Vector3(0, 1.86, 0.05), Vector3(0.14, 0.12, 0.14), c, 12, 6, hb)
	return m.commit()

func _build_gallery() -> void:
	var lsh := preload("res://shaders/lens_only.gdshader")
	var mk := func(kind: float, design: float) -> ShaderMaterial:
		var m := ShaderMaterial.new()
		m.shader = lsh
		m.set_shader_parameter("noise_tex", level.noise_tex)
		m.set_shader_parameter("kind", kind)
		m.set_shader_parameter("design", design)
		return m
	var west := Basis(Vector3.UP, -PI * 0.5)       # a quad facing -x (into the gallery from its east wall)
	var east := Basis(Vector3.UP, PI * 0.5)
	# the true passage: an archway of light where the wall seems solid
	_mi(_quad(Vector2(1.6, 3.0)), mk.call(2.0, 0.0), Transform3D(west, Vector3(6.83, 2.5, -8.5)))
	# the false doorways: through the shard they are plain wall
	for zz in [-15.6, -12.6]:
		_mi(_quad(Vector2(1.7, 3.0)), mk.call(1.0, 0.0), Transform3D(west, Vector3(6.76, 2.5, zz)))
	_mi(_quad(Vector2(0.6, 0.6)), mk.call(0.0, 1.0), Transform3D(west, Vector3(6.8, 4.15, -8.5)))
	# her map, on the east wall between the false doors and the arch (only the shard shows it)
	gl_map = _smat("res://shaders/gallery_map.gdshader", {"size": Vector2(2.4, 1.6), "pulse": 0.0, "marks": Vector4(1, 3, 0, 2)})
	_mi(_quad(Vector2(2.4, 1.6)), gl_map, Transform3D(west, Vector3(6.835, 3.15, -10.5)))
	# the four veiled busts and their lamps (cold)
	var vm := _votive_mesh()
	var fsh := preload("res://shaders/votive_flame.gdshader")
	for i in 4:
		var b: Vector3 = GL_BUST[i]
		var n := Node3D.new()
		n.position = b
		n.rotation.y = -PI * 0.5 if b.x < 6.0 else PI * 0.5        # its front toward the middle
		add_child(n)
		puzzles.marble_instance(vm, n)
		# (v0.8.1) a real votive flame: warm fire with an aqua rim, and a real light on the stone round it
		var fl := Flame.new(1.0, 0.5, Color(0.86, 0.92, 0.82), level.noise_tex)
		fl.position = Vector3(0, 1.15, -0.2)
		fl.energy = 1.5
		fl.range_m = 3.6
		fl.key = i == 3
		n.add_child(fl)
		gl_flames.append(fl.mat)
		# its glow on the stone, its little pool of light on the floor, and real light on the face above
		var halo := puzzles.glow_quad(n, Vector3(0, 1.42, -0.22), 1.5, Palette.ACCENT, 0.0)
		var pm := _smat("res://shaders/light_pool.gdshader", {"intensity": 0.0})
		_mi(_plane(Vector2(1.6, 1.6)), pm, Transform3D(Basis(), Vector3(0, 0.012, -0.45)), n)
		var L: OmniLight3D = fl.light
		# the veil: a sheen that wakes when she is answered
		var veil := MB.new()
		veil.sphere(Vector3(0, 1.82, 0.02), Vector3(0.155, 0.19, 0.165), Color(0.5, 0.25, 0.0), 12, 6, Basis(Vector3.RIGHT, 0.18))
		veil.cyl(Vector3(0, 1.62, 0.05), 0.14, 0.23, 0.3, Color(0.5, 0.25, 0.0), 12)
		var vgm := _smat("res://shaders/veil_glow.gdshader", {"intensity": 0.0})
		_mi(veil.commit(), vgm, Transform3D(), n)
		gl_lamps.append({"light": L, "halo": halo, "pool": pm, "veil": vgm})
		# (solid: the plinth and its bowl)
		var x0 := b.x - 0.2 if b.x < 6.0 else b.x - 0.4
		level.ob_rect(Level.R(x0, b.z - 0.3, x0 + 0.6, b.z + 0.3), "gl_lamp%d" % i)
		var idx := i
		level.add_interact("light%d" % i, gl_bowl(i), "light", func() -> void: light_lamp(idx), 0.95,
			func() -> bool: return not state["gallery"] and not _gl_busy and not (idx in state["gallery_lit"]))
	# a cracked mirror pane or two on the west wall (they glint)
	for zz in [-16.4, -13.8, -11.0, -7.4]:
		var pm2 := puzzles._mirror_quad(Vector3(5.03, 2.5, zz), east, Vector2(0.9, 1.9), true, 1.0)
		pm2.set_shader_parameter("ncols", 0)
	level.add_interact("raise_shard", Vector3(6.0, 1.0, -10.45), "shard", func() -> void: set_lens(true), 2.2,
		func() -> bool: return state["shard"] and not lens_on and not state["gallery"] and _in_gallery())

## the lamps follow their flames: the glow on the stone, the floor's pool, the light on the face
func _update_gallery(_dt: float) -> void:
	for i in 4:
		var f: float = gl_flames[i].get_shader_parameter("intensity")
		var g: float = gl_flames[i].get_shader_parameter("gutter") if gl_flames[i].get_shader_parameter("gutter") != null else 0.0
		var k := f * (1.0 - g)
		var lp: Dictionary = gl_lamps[i]
		(lp["halo"] as ShaderMaterial).set_shader_parameter("intensity", k * 0.95)
		(lp["pool"] as ShaderMaterial).set_shader_parameter("intensity", k)

## light a lamp: the third one lit decides; a wrong order gutters them all
func light_lamp(i: int) -> void:
	if state["gallery"] or _gl_busy or i in state["gallery_lit"]: return
	var lit: Array = state["gallery_lit"]
	lit.append(i)
	event.emit("brazier", i)
	var m := gl_flames[i]
	m.set_shader_parameter("gutter", 0.0)
	create_tween().tween_method(func(v: float) -> void: m.set_shader_parameter("intensity", v), 0.0, 1.0, 0.5)
	if lit.size() < 3: return
	_gl_busy = true
	var tw := create_tween()
	tw.tween_interval(0.9)
	if lit == GL_ORDER:
		tw.tween_callback(func() -> void:
			_gl_busy = false
			open_gallery(false))
		return
	tw.tween_callback(func() -> void:
		gl_fails += 1
		event.emit("gutter", gl_fails))
	# (they gutter: sputter low, then out, a breath of smoke from each bowl)
	tw.tween_method(func(v: float) -> void:
		for k in lit: gl_flames[k].set_shader_parameter("gutter", v), 0.0, 1.0, 1.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tw.tween_callback(func() -> void:
		for k in lit:
			gl_flames[k].set_shader_parameter("intensity", 0.0)
			gl_flames[k].set_shader_parameter("gutter", 0.0)
			game.world.dust_puff(gl_bowl(k) + Vector3(0, 0.2, 0))
		lit.clear()
		_gl_busy = false
		if gl_fails >= 2: gl_map.set_shader_parameter("pulse", 1.0))

func _in_gallery() -> bool:
	var p := game.player.position
	return p.x > 4.9 and p.x < 7.1 and p.z > -18.5 and p.z < -5.5

func set_lens(on: bool) -> void:
	if on and not state["shard"]: return
	if on == lens_on: return
	lens_on = on
	event.emit("lens", on)
	game.ui.set_inventory(state["shard"], on)
	if not on:
		RenderingServer.global_shader_parameter_set("shard_lens", Vector4.ZERO)
		game.ui.set_lens(false, Vector2.ZERO, 0.0)

func toggle_lens() -> void:
	set_lens(not lens_on)

func _update_lens() -> void:
	if not lens_on: return
	var vp := get_viewport()
	var cam := game.world.cam
	# (held up before you: the lens sits a little above the head, where the walls' writing is)
	var sp := cam.unproject_position(game.player.position + Vector3(0, 1.5, 0))
	var vis := vp.get_visible_rect().size
	var r := vis.x * 0.42
	# (QA P2-17) near her map, the lens leans toward it so the plan sits inside the circle
	var mp := cam.unproject_position(Vector3(6.8, 3.15, -10.5))
	var near_map := 1.0 - smoothstep(2.5, 6.0, Vector2(game.player.position.x - 6.8, game.player.position.z + 10.5).length())
	sp = sp.lerp(mp, 0.6 * near_map)
	# 3D shaders see FRAGCOORD in render-target pixels (window size x the 3D render scale)
	var k := Vector2(vp.size) * vp.scaling_3d_scale / vis
	lens_px = Vector4(sp.x * k.x, sp.y * k.y, r * k.x, 1.0)
	RenderingServer.global_shader_parameter_set("shard_lens", lens_px)
	game.ui.set_lens(true, sp, r)

func open_gallery(instant := false) -> void:
	state["gallery"] = true
	level.set_enabled("gallery_secret", false)
	state["gallery_lit"] = GL_ORDER.duplicate()
	for k in 4:
		gl_flames[k].set_shader_parameter("intensity", 1.0 if k in GL_ORDER else 0.0)
		gl_flames[k].set_shader_parameter("gutter", 0.0)
		var vg: ShaderMaterial = gl_lamps[k]["veil"]
		var goal := 0.85 if k in GL_ORDER else 0.0
		if instant: vg.set_shader_parameter("intensity", goal)
		else: create_tween().tween_method(func(v: float) -> void: vg.set_shader_parameter("intensity", v), 0.0, goal, 1.8)
	gl_map.set_shader_parameter("pulse", 0.0)
	var gls := level.get_node_or_null("Zone_GLs") as MeshInstance3D
	if gls == null: return
	if instant:
		gls.visible = false
		return
	event.emit("solve", "shard_gallery")
	var tw := create_tween()
	tw.tween_property(gls, "position:y", -3.2, 2.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: gls.visible = false)

# ------------------------------------------------------------------ 5. garden: the turned ones
func _build_garden() -> void:
	# the great glass on the garden's north edge, a real planar reflection (shared with the Hall)
	var mm := puzzles._mirror_quad(Vector3(12.8, 3.3, -14.93), Basis(), Vector2(4.5, 4.4), false, 1.0)
	mm.set_shader_parameter("ncols", 0)
	var pm := PlanarMirror.new()
	add_child(pm)
	pm.setup(Vector3.BACK, -14.93, mm, game.world.env)
	var r := Reflector.new()
	r.kind = "mirror"; r.plane_n = Vector3.BACK; r.plane_d = -14.92
	r.clip_c = Vector3(12.8, 3.3, -14.92); r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.UP; r.clip_h = Vector2(2.2, 2.15)
	r.region = Level.R(10.3, -15, 17, -5)
	r.planar = pm
	puzzles._add_refl(r)
	garden_refl = r
	# the three turned ones
	var rsh: Shader = puzzles.rune_mat_shader
	var normals := [Basis(Vector3.UP, PI), Basis(Vector3.UP, PI * 0.5), Basis(), Basis(Vector3.UP, -PI * 0.5)]
	var dirs := [Vector3(0, 0, -1), Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0)]
	for i in 3:
		var pivot := Node3D.new()
		pivot.position = Vector3(TURN_X[i], 1.0, TURN_Z)
		add_child(pivot)
		var mi := MeshInstance3D.new()
		mi.mesh = _statue_mesh(0.9, 0.9)
		mi.material_override = level.marble_mat
		pivot.add_child(mi)
		var mats: Array[ShaderMaterial] = []
		# (v0.8.1) each face carries a flat carved tablet, its rune centred on it below the plinth's cap
		var tab := MB.new()
		for k in 4:
			var dv: Vector3 = dirs[k]
			tab.box(Vector3(0, 0.44, 0) + dv * 0.437, Vector3(0.68 if absf(dv.x) < 0.5 else 0.03, 0.68, 0.68 if absf(dv.x) > 0.5 else 0.03), Color(0.5, 0.25, 0.0))
		puzzles.marble_instance(tab.commit(), pivot)
		for k in 4:
			var f: Array = TURN_FACES[i][k]
			var m := puzzles.rune_quad(pivot, Vector3(0, 0.44, 0) + dirs[k] * 0.455, Vector2(0.62, 0.62), normals[k], float(f[0]), 0.8)   # (v0.8.1: true aspect, brighter)
			m.set_shader_parameter("mirror", f[1])
			mats.append(m)
		turn_face_mats.append(mats)
		turn_pivots.append(pivot)
		level.ob_circle(Vector2(TURN_X[i], TURN_Z), 0.55)
		# a fixed stone step before each, with its numeral (I, II, III)
		var sm := MB.new()
		sm.box(Vector3(TURN_X[i], 1.05, TURN_Z + 0.75), Vector3(0.9, 0.1, 0.42), Color(0.5, 0.25, 0.0))
		puzzles.marble_instance(sm.commit(), self)
		puzzles.rune_quad(self, Vector3(TURN_X[i], 1.115, TURN_Z + 0.75), Vector2(0.36, 0.36), Basis(Vector3.RIGHT, -PI * 0.5), -1.0, 0.45, float(i + 1))
		var idx := i
		level.add_interact("turn%d" % (i + 1), Vector3(TURN_X[i], 1.0, TURN_Z + 1.05), "turn", func() -> void: turn_statue(idx), 0.7,
			func() -> bool: return not state["turned_done"])
	# her message: a small glass on the gallery wall's garden face
	# her message: a small glass beside the great one
	# (a small glass of its own beside the great one: no statue stands between it and you)
	var wm := MB.new()
	var fc := Color(0.5, 1.0, 0.0)
	wm.box(Vector3(16.0, 1.25, -15.0), Vector3(1.2, 0.5, 0.5), Color(0.5, 0.25, 0.0))
	wm.box(Vector3(15.42, 2.3, -15.0), Vector3(0.1, 2.1, 0.12), fc)
	wm.box(Vector3(16.58, 2.3, -15.0), Vector3(0.1, 2.1, 0.12), fc)
	wm.box(Vector3(16.0, 3.38, -15.0), Vector3(1.26, 0.12, 0.14), fc)
	wm.box(Vector3(16.0, 2.3, -15.12), Vector3(1.1, 2.1, 0.1), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(wm.commit(), self)
	level.ob_rect(Level.R(15.35, -15.3, 16.65, -14.72))
	_breath_glass("garden", Vector3(16.0, 2.35, -14.93), Basis(), Vector2(1.05, 1.95), Vector3(6, 7, 8), true, true)
	level.add_interact("breathe_garden", Vector3(16.0, 1.0, -14.1), "breathe", func() -> void: breathe("garden"), 0.95)
	# the door east: its leaves in your world, and their twins only the mirror sees
	for twin in [false, true]:
		for s in [-1.0, 1.0]:
			var hinge := Vector3(16.95, 1.0, -11.8 + s * 0.8)
			var pv := Node3D.new()
			pv.position = hinge
			add_child(pv)
			var dm := MB.new()
			dm.box(Vector3(0, 1.6, -s * 0.4), Vector3(0.12, 3.2, 0.78), Color(0.5, 1.0, 0.0))
			dm.box(Vector3(0.07, 2.6, -s * 0.4), Vector3(0.03, 0.08, 0.6), Color(0.5, 0.25, 0.0))
			var dmi := puzzles.marble_instance(dm.commit(), pv)
			dmi.layers = PlanarMirror.LAYER_DOUBLE if twin else PlanarMirror.LAYER_MAIN_FX
			(door_refl if twin else door_real).append(pv)
	level.ob_rect(Level.R(16.8, -12.6, 17.15, -11.0), "g_door_ob")

func turn_statue(i: int) -> void:
	if state["turned_done"]: return
	var o: Array = state["turned"]
	o[i] = (int(o[i]) + 1) % 4
	event.emit("statue_turn", i)
	if turn_tw[i]: (turn_tw[i] as Tween).kill()
	var pv := turn_pivots[i]
	var goal := pv.rotation.y + PI * 0.5
	goal = roundf(goal / (PI * 0.5)) * PI * 0.5
	var tw := create_tween()
	turn_tw[i] = tw
	tw.tween_property(pv, "rotation:y", goal, 0.7).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void:
		turn_tw[i] = null
		_apply_turned()
		_check_turned())

func _apply_turned(snap := false) -> void:
	var o: Array = state["turned"]
	for i in 3:
		if snap: turn_pivots[i].rotation.y = float(o[i]) * PI * 0.5
		var north := int(o[i]) % 4
		for k in 4:
			var m: ShaderMaterial = turn_face_mats[i][k]
			var good: bool = k == north and north == TURN_SOLUTION[i]
			m.set_shader_parameter("lit", 1.0 if good or state["turned_done"] and k == TURN_SOLUTION[i] else 0.8)
			m.set_shader_parameter("flare", 0.4 if good else 0.0)

func turned_correct() -> Array:
	var o: Array = state["turned"]
	var out := []
	for i in 3: out.append(int(o[i]) % 4 == TURN_SOLUTION[i])
	return out

func _check_turned() -> void:
	if state["turned_done"]: return
	if turned_correct() != [true, true, true]: return
	state["turned_done"] = true
	event.emit("solve", "garden_veiled")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		for i in 3: (turn_face_mats[i][TURN_SOLUTION[i]] as ShaderMaterial).set_shader_parameter("flare", v), 0.4, 1.0, 0.8)
	tw.tween_callback(func() -> void: event.emit("door_reflection", null))
	# first in the reflection...
	for k in 2:
		tw.parallel().tween_property(door_refl[k], "rotation:y", [-1.0, 1.0][k] * PI * 0.55, 2.2).set_trans(Tween.TRANS_SINE)
	tw.tween_interval(1.2)
	# ...then in your world
	tw.tween_callback(func() -> void: event.emit("door_real", null))
	for k in 2:
		tw.parallel().tween_property(door_real[k], "rotation:y", [-1.0, 1.0][k] * PI * 0.55, 2.2).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void: _open_garden_door(true))

func _open_garden_door(instant: bool) -> void:
	level.set_enabled("g_door_ob", false)
	level.set_enabled("g_door", true)
	if instant:
		for k in 2:
			door_refl[k].rotation.y = [-1.0, 1.0][k] * PI * 0.55
			door_real[k].rotation.y = [-1.0, 1.0][k] * PI * 0.55

# ------------------------------------------------------------------ 6. hollow walk
func _build_hollow() -> void:
	for c in Ch1Geo.HW_PLATES:
		var m := puzzles.rune_quad(self, Ch1Geo.hw_cell(c) + Vector3(0, 0.045, 0), Vector2(0.92, 0.92), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.3)
		plate_mats.append(m)
		var pm := MB.new()
		pm.cyl(Ch1Geo.hw_cell(c) + Vector3(0, 0.01, 0), 0.5, 0.52, 0.03, Color(0.5, 1.0, 0.0), 20)
		puzzles.marble_instance(pm.commit(), self)
	var mesh := _statue_mesh(0.82, 0.16, 0.5)
	for k in 2:
		var pv := Node3D.new()
		add_child(pv)
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		mi.material_override = level.marble_mat
		pv.add_child(mi)
		hollow_glints.append(puzzles.glow_quad(pv, Vector3(0, 2.1, 0), 0.9, Palette.ACCENT, 0.0))
		hollow_nodes.append(pv)
		hollow_obs.append(level.ob_circle(Vector2.ZERO, 0.42, "hollow%d" % k))
	# the gate at the top of the ramp
	hw_gate = Node3D.new()
	hw_gate.position = Vector3(18.5, 1.0, -15.15)
	add_child(hw_gate)
	var gm := MB.new()
	for i in 8:
		var x := -0.88 + i * 0.25
		gm.cyl(Vector3(x, 1.3, 0), 0.035, 0.035, 2.6, Color(0.5, 1.0, 0.0), 6)
		gm.cyl(Vector3(x, 2.66, 0), 0.0, 0.06, 0.16, Color(0.5, 1.0, 0.0), 6)
	gm.box(Vector3(0, 0.5, 0), Vector3(2.0, 0.08, 0.08), Color(0.5, 1.0, 0.0))
	gm.box(Vector3(0, 2.2, 0), Vector3(2.0, 0.08, 0.08), Color(0.5, 1.0, 0.0))
	puzzles.marble_instance(gm.commit(), hw_gate)

func _place_hollows() -> void:
	var hs: Array = state["hollows"]
	for k in 2:
		var c := Vector2i(int(hs[k][0]), int(hs[k][1]))
		var p := Ch1Geo.hw_cell(c)
		hollow_nodes[k].position = p
		hollow_nodes[k].rotation.y = PI * 0.75
		(hollow_obs[k] as Level.Obstacle).c = Vector2(p.x, p.z)
	for i in 2:
		var lk: bool = state["hollow_lock"][i]
		plate_mats[i].set_shader_parameter("lit", 1.0 if _plate_taken(i) else 0.3)

func _plate_taken(i: int) -> bool:
	var hs: Array = state["hollows"]
	for k in 2:
		if Vector2i(int(hs[k][0]), int(hs[k][1])) == Ch1Geo.HW_PLATES[i]: return true
	return false

func hw_player_cell() -> Vector2i:
	var p := game.player.position
	return Vector2i(floori(p.x - Ch1Geo.HW_ORIGIN.x), floori(p.z - Ch1Geo.HW_ORIGIN.y))

func _hw_free(c: Vector2i, other: Vector2i, pc: Vector2i) -> bool:
	if c.x < 0 or c.x > 7 or c.y < 0 or c.y > 8: return false
	if c in Ch1Geo.HW_PILLARS: return false
	return c != other and c != pc

## does the wanderer look at this hollow? (it holds still while watched)
func hw_watched(k: int) -> bool:
	var p := game.player.position
	var h := hollow_nodes[k].position
	var d := Vector2(h.x - p.x, h.z - p.z)
	if d.length() < 0.01 or d.length() > 6.5: return false
	var fwd := Vector2(-sin(game.player.yaw), -cos(game.player.yaw))
	return fwd.dot(d.normalized()) > cos(deg_to_rad(50.0))

var hw_cone: MeshInstance3D
func _update_hollow(dt: float) -> void:
	var p := game.player.position
	var inside := p.x > 17.4 and p.x < 25.6 and p.z > -15.0 and p.z < -6.0 and absf(p.y - 1.0) < 0.2
	var still := game.player.speed01 < 0.04 and game.mode == "play"
	# (QA P1-6) what you watch: your 50-degree cone on the floor while you stand still in the Walk
	if hw_cone == null:
		hw_cone = _mi(_plane(Vector2(13.0, 13.0)), _smat("res://shaders/floor_mark.gdshader", {"kind": 5.0, "intensity": 0.0}), Transform3D())
		hw_cone.layers = PlanarMirror.LAYER_MAIN_FX
	var cm: ShaderMaterial = hw_cone.material_override
	var ck: float = cm.get_shader_parameter("intensity")
	ck = move_toward(ck, 1.0 if (inside and still and not state["hollow_done"]) else 0.0, dt * 2.5)
	cm.set_shader_parameter("intensity", ck)
	hw_cone.visible = ck > 0.001
	if hw_cone.visible: hw_cone.transform = Transform3D(Basis(Vector3.UP, game.player.yaw), Vector3(p.x, p.y + 0.02, p.z))
	if state["hollow_done"]: return
	_still = _still + dt if (still and inside) else 0.0
	for k in 2:
		var w: bool = inside and still and hw_watched(k) and not state["hollow_lock"][k]
		var g: float = hollow_glints[k].get_shader_parameter("intensity")
		hollow_glints[k].set_shader_parameter("intensity", move_toward(g, 0.55 if w else 0.0, dt * 2.0))
	if _still < 0.5 or hollow_moving: return
	_tick += dt
	if _tick < 0.75: return
	_tick = 0.0
	hollow_tick()

## one step: every hollow you are not watching moves one cell toward you (the longer axis first)
func hollow_tick() -> bool:
	var pp := Vector2(game.player.position.x, game.player.position.z)
	var r := hollow_step(state["hollows"], state["hollow_lock"], pp, game.player.yaw)
	var hs: Array = state["hollows"]
	var lk: Array = state["hollow_lock"]
	var moved := false
	for k in 2:
		if r["hs"][k] != hs[k]:
			hs[k] = r["hs"][k]
			moved = true
			_slide_hollow(k, Vector2i(int(hs[k][0]), int(hs[k][1])))
		if r["lk"][k] and not lk[k]:
			lk[k] = true
			event.emit("hollow_lock", k)
	if moved: event.emit("hollow_step", null)
	if lk[0] and lk[1] and not state["hollow_done"]:
		_open_hollow_gate(false)
	return moved

## (pure: the game and the solver check share it) a hollow is watched when it stands within 6.5 m and
## within 50 degrees of where you face
static func hw_sees(h: Vector3, pp: Vector2, yaw: float) -> bool:
	var d := Vector2(h.x - pp.x, h.z - pp.y)
	if d.length() < 0.01 or d.length() > 6.5: return false
	var fwd := Vector2(-sin(yaw), -cos(yaw))
	return fwd.dot(d.normalized()) > cos(deg_to_rad(50.0))

static func hollow_step(hs_in: Array, lk_in: Array, pp: Vector2, yaw: float) -> Dictionary:
	var hs := [[int(hs_in[0][0]), int(hs_in[0][1])], [int(hs_in[1][0]), int(hs_in[1][1])]]
	var lk := [bool(lk_in[0]), bool(lk_in[1])]
	var pc := Vector2i(floori(pp.x - Ch1Geo.HW_ORIGIN.x), floori(pp.y - Ch1Geo.HW_ORIGIN.y))
	for k in 2:
		var h := Vector2i(hs[k][0], hs[k][1])
		if lk[k] or hw_sees(Ch1Geo.hw_cell(h), pp, yaw): continue
		var o := Vector2i(hs[1 - k][0], hs[1 - k][1])
		var dx := pc.x - h.x
		var dz := pc.y - h.y
		if dx == 0 and dz == 0: continue
		var axes: Array[Vector2i] = []
		if absi(dx) >= absi(dz):
			axes.append(Vector2i(signi(dx), 0))
			if dz != 0: axes.append(Vector2i(0, signi(dz)))
		else:
			axes.append(Vector2i(0, signi(dz)))
			if dx != 0: axes.append(Vector2i(signi(dx), 0))
		for a2 in axes:
			var n := h + a2
			if n.x < 0 or n.x > 7 or n.y < 0 or n.y > 8 or n in Ch1Geo.HW_PILLARS or n == o or n == pc: continue
			hs[k] = [n.x, n.y]
			if n in Ch1Geo.HW_PLATES: lk[k] = true
			break
	return {"hs": hs, "lk": lk}

## (tests) breadth-first over (where you stand, which way you face) per step: the fewest steps to put
## both hollows on their plates, and whether any single spot does it alone
static func solve_hollows() -> Dictionary:
	var acts := []
	for x in 8:
		for z in 9:
			var c := Vector2i(x, z)
			if c in Ch1Geo.HW_PILLARS: continue
			for yaw in [PI, -PI * 0.5, 0.0, PI * 0.5]:
				var cp := Ch1Geo.hw_cell(c)
				acts.append([c, Vector2(cp.x, cp.z), yaw])
	var start := {"hs": [[Ch1Geo.HW_HOLLOWS[0].x, Ch1Geo.HW_HOLLOWS[0].y], [Ch1Geo.HW_HOLLOWS[1].x, Ch1Geo.HW_HOLLOWS[1].y]], "lk": [false, false]}
	var seen := {str(start): 0}
	var frontier := [start]
	var depth := 0
	var best := -1
	while not frontier.is_empty() and depth < 40 and best < 0:
		depth += 1
		var nxt := []
		for st in frontier:
			for a in acts:
				var c: Vector2i = a[0]
				if c == Vector2i(st["hs"][0][0], st["hs"][0][1]) or c == Vector2i(st["hs"][1][0], st["hs"][1][1]): continue
				var r := hollow_step(st["hs"], st["lk"], a[1], a[2])
				var key := str(r)
				if seen.has(key): continue
				seen[key] = depth
				if r["lk"][0] and r["lk"][1]: best = depth
				nxt.append(r)
		frontier = nxt
	var one_spot := 0
	for a in acts:
		var st2: Dictionary = start
		for i in 40:
			if a[0] == Vector2i(st2["hs"][0][0], st2["hs"][0][1]) or a[0] == Vector2i(st2["hs"][1][0], st2["hs"][1][1]): break
			st2 = hollow_step(st2["hs"], st2["lk"], a[1], a[2])
			if st2["lk"][0] and st2["lk"][1]:
				one_spot += 1
				break
	return {"min_steps": best, "one_spot": one_spot, "states": seen.size()}

func _slide_hollow(k: int, c: Vector2i) -> void:
	var p := Ch1Geo.hw_cell(c)
	(hollow_obs[k] as Level.Obstacle).c = Vector2(p.x, p.z)
	hollow_moving = true
	var tw := create_tween()
	tw.tween_property(hollow_nodes[k], "position", p, 0.5).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		hollow_moving = false
		for i in 2: plate_mats[i].set_shader_parameter("lit", 1.0 if _plate_taken(i) else 0.3))

func _open_hollow_gate(instant: bool) -> void:
	state["hollow_done"] = true
	level.set_enabled("hw_gate", false)
	if instant:
		hw_gate.position.y = 1.0 + 2.75
		return
	event.emit("solve", "hollow_walk")
	var tw := create_tween()
	tw.tween_interval(0.6)
	tw.tween_property(hw_gate, "position:y", 1.0 + 2.75, 2.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

# ------------------------------------------------------------------ 7. court: the mural
func _build_mural() -> void:
	mural_mat = _smat("res://shaders/mural.gdshader", {"noise_tex": level.noise_tex, "size": Vector2(5.2, 3.4), "lit": 0.0, "complete": 0.0,
		"head": Vector2((MURAL_HEAD.x - 9.4) / 5.2, (MURAL_HEAD.y - 2.1) / 3.4)})
	_mi(_quad(Vector2(5.2, 3.4)), mural_mat, Transform3D(Basis(), Vector3(12.0, 3.8, MURAL_Z)))
	level.inscription("l_mural", Vector3(9.0, 2.0, -25.6), "The sea took her on a still day.\nThe light remembers where her head was bowed.", 1.0,
		Transform3D(Basis(), Vector3(9.0, 2.62, -26.9)), Vector2(0.7, 0.7))

## where the lit crystal throws your veil's shadow on the mural wall (INF: no shadow)
func veil_shadow() -> Vector3:
	var p := game.player.position
	if not puzzles.state["bridge"] or absf(p.y - 2.0) > 0.2: return Vector3.INF
	if p.x < 7.0 or p.x > 17.0 or p.z > L_LIGHT.z - 0.25 or p.z < MURAL_Z: return Vector3.INF
	var H := p + Vector3(0, 1.0, 0)
	var t := (MURAL_Z - L_LIGHT.z) / (H.z - L_LIGHT.z)
	if t < 1.0: return Vector3.INF
	return L_LIGHT + (H - L_LIGHT) * t

## the spot to stand on (for hints and the test): your head on the line from the light to the hole
static func mural_spot() -> Vector3:
	var t := (MURAL_HEAD.y - L_LIGHT.y) / (3.0 - L_LIGHT.y)
	var x := L_LIGHT.x + (MURAL_HEAD.x - L_LIGHT.x) / t
	var z := L_LIGHT.z + (MURAL_Z - L_LIGHT.z) / t
	return Vector3(x, 2.0, z)

func _update_mural(dt: float) -> void:
	var lit: float = mural_mat.get_shader_parameter("lit")
	mural_mat.set_shader_parameter("lit", move_toward(lit, 1.0 if puzzles.state["bridge"] else 0.0, dt * 0.5))
	if state["mural"]: return
	var s := veil_shadow()
	shadow_world = s
	if s == Vector3.INF:
		mural_mat.set_shader_parameter("shadow", Vector4(0.5, 0.5, 0.062, 0.0))
		mural_hold = 0.0
		return
	var t := (MURAL_Z - L_LIGHT.z) / (game.player.position.z + 0.0 - L_LIGHT.z)
	var rad := 0.14 * t / 3.4
	mural_mat.set_shader_parameter("shadow", Vector4((s.x - 9.4) / 5.2, (s.y - 2.1) / 3.4, clampf(rad, 0.03, 0.12), 1.0))
	var fit := Vector2(s.x - MURAL_HEAD.x, s.y - MURAL_HEAD.y).length() < 0.32
	mural_hold = mural_hold + dt if fit and game.player.speed01 < 0.05 else 0.0
	if mural_hold > 1.3: complete_mural(false)

func complete_mural(instant: bool) -> void:
	state["mural"] = true
	level.set_enabled("mural_door", false)
	level.set_enabled("MZ_door", true)
	var mw := level.get_node_or_null("Zone_Mural") as MeshInstance3D
	if instant:
		mural_mat.set_shader_parameter("complete", 1.0)
		mural_mat.set_shader_parameter("shadow", Vector4(0.5, 0.5, 0.06, 0.0))
		if mw: mw.visible = false
		return
	event.emit("solve", "court_light")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: mural_mat.set_shader_parameter("complete", v), 0.0, 1.0, 1.6)
	tw.tween_method(func(v: float) -> void: mural_mat.set_shader_parameter("shadow", Vector4(0.5, 0.5, 0.06, v)), 1.0, 0.0, 0.6)
	if mw:
		tw.tween_property(mw, "position:y", -3.4, 2.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		tw.tween_callback(func() -> void: mw.visible = false)

# ------------------------------------------------------------------ 8. mist maze
func _build_maze() -> void:
	maze_mist = _smat("res://shaders/maze_mist.gdshader", {"noise_tex": level.noise_tex, "density": 0.92, "clear_r": 1.35})
	var mmi := _mi(_plane(Vector2(8.6, 10.6)), maze_mist, Transform3D(Basis(), Vector3(13.0, 2.62, -34.0)))
	mmi.layers = PlanarMirror.LAYER_MAIN_FX
	var wsh := preload("res://shaders/wall_shimmer.gdshader")
	for i in 6:
		var m := ShaderMaterial.new()
		m.shader = wsh
		m.set_shader_parameter("noise_tex", level.noise_tex)
		m.set_shader_parameter("flash", 0.0)
		var mi := _mi(_quad(Vector2(2.1, 2.2)), m, Transform3D())
		mi.visible = false
		shimmers.append(mi)
	# her pool: still water, and her steps in it
	var wm := _smat("res://shaders/water.gdshader", {"noise_tex": level.noise_tex})
	_mi(_plane(Vector2(8.0, 10.0)), wm, Transform3D(Basis(), Vector3(4.6, 1.95, -34.0)))
	var om := _smat("res://shaders/water_over.gdshader", {"noise_tex": level.noise_tex, "area": Vector4(1.0, -38.6, 8.2, -29.4), "calm": 0.5})
	_mi(_plane(Vector2(8.0, 10.0)), om, Transform3D(Basis(), Vector3(4.6, 1.975, -34.0)))
	var fsh := preload("res://shaders/footprint.gdshader")
	var pts: Array[Vector3] = []
	pts.append(_mirror_maze(Vector3(12.0, 2.0, -27.6)))
	for rc in Ch1Geo.MZ_PATH: pts.append(_mirror_maze(Ch1Geo.mz_cell(rc)))
	pts.append(_mirror_maze(Vector3(10.0, 2.0, -40.0)))
	var side := 1.0
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]
		var b: Vector3 = pts[i + 1]
		var L := a.distance_to(b)
		var n := maxi(1, int(L / 0.62))
		var dir := (b - a).normalized()
		var perp := dir.cross(Vector3.UP)
		for j in n:
			var c := a + dir * (L * (j + 0.5) / n) + perp * side * 0.17
			side = -side
			var m := ShaderMaterial.new()
			m.shader = fsh
			m.set_shader_parameter("project", 0.0)
			m.set_shader_parameter("life", 1.0)
			m.set_shader_parameter("dark", 0.6)
			var q := QuadMesh.new()
			q.size = Vector2(0.7, 1.1)                 # (v0.8 QA P2-8: larger)
			q.orientation = PlaneMesh.FACE_Y
			var mi := _mi(q, m, Transform3D(Basis(Vector3.UP, atan2(-dir.x, -dir.z)), Vector3(c.x, c.y, c.z)))
			mi.visible = false
			maze_feet.append(mi)
			maze_feet_t.append(0.0)
			maze_feet_seg.append(i)

func _mirror_maze(p: Vector3) -> Vector3:
	return Vector3(2.0 * Ch1Geo.MZ_MIRROR_X - p.x, 1.99, p.z)

func _in_maze() -> bool:
	var p := game.player.position
	return p.x > 8.5 and p.x < 17.5 and p.z > -40.0 and p.z < -26.5 and absf(p.y - 2.0) < 0.3

func _update_maze(dt: float) -> void:
	var inside := _in_maze()
	# v0.6: her steps show in the still pool only while YOU are still, and only the next stretch of her
	# path from where you stand (mirrored: her left is your right); move, and they fade
	var pc := Vector2i(int(floor((-(game.player.position.z) + Ch1Geo.MZ_ORIGIN.y) / 2.0)), int(floor((game.player.position.x - Ch1Geo.MZ_ORIGIN.x) / 2.0)))
	var on_path := Ch1Geo.MZ_PATH.find(pc)
	if inside and on_path >= 0: maze_prog = on_path
	var still := inside and game.player.speed01 < 0.05 and game.mode == "play"
	_maze_still = _maze_still + dt if still else 0.0
	var n := maze_feet.size()
	var first := maze_prog + 1
	var shown := 0
	for i in n:
		var sg := maze_feet_seg[i]
		var want := inside and sg >= first and sg <= first + 2
		var m: ShaderMaterial = maze_feet[i].material_override
		if want and _maze_still > 0.5:
			if maze_feet_t[i] <= 0.0: maze_feet_t[i] = _maze_still + shown * 0.32
			shown += 1
			var age := _maze_still - maze_feet_t[i]
			maze_feet[i].visible = age > 0.0
			m.set_shader_parameter("life", 0.12 + 0.88 * (1.0 - clampf(age / 0.6, 0.0, 1.0)))
		else:
			maze_feet_t[i] = 0.0
			if maze_feet[i].visible:
				var l: float = m.get_shader_parameter("life")
				l = minf(1.0, l + dt * 2.5)
				m.set_shader_parameter("life", l)
				if l >= 1.0: maze_feet[i].visible = false
	# bumping into an invisible wall: it shimmers where you touched it
	_bump_cd = maxf(0.0, _bump_cd - dt)
	for s in shimmers:
		if s.visible:
			var m: ShaderMaterial = s.material_override
			var f: float = m.get_shader_parameter("flash")
			f = maxf(0.0, f - dt * 1.4)
			m.set_shader_parameter("flash", f)
			if f <= 0.0: s.visible = false
	if inside and _bump_cd <= 0.0 and game.player.input_dir.length() > 0.3 and game.player.speed01 < 0.15:
		var p2 := Vector2(game.player.position.x, game.player.position.z)
		var best: Level.Obstacle = null
		var bd := 0.55
		for o in level.obstacles:
			if o.circle or not o.name.begins_with("mzw_"): continue
			var q := Vector2(clampf(p2.x, o.r.position.x, o.r.end.x), clampf(p2.y, o.r.position.y, o.r.end.y))
			var d := q.distance_to(p2)
			if d < bd: bd = d; best = o
		if best:
			_bump_cd = 0.7
			_flash_wall(best.r)
			event.emit("maze_bump", null)
	if inside and not state["maze"] and game.player.position.z < -38.7:
		pass
	if not state["maze"] and game.player.position.z < -39.2 and game.player.position.x < 11.5 and game.player.position.x > 8.5 and absf(game.player.position.y - 2.0) < 0.2:
		state["maze"] = true
		event.emit("solve", "mist_maze")

func _flash_wall(r: Rect2) -> void:
	var s := shimmers[_shim_i]
	_shim_i = (_shim_i + 1) % shimmers.size()
	var c := r.get_center()
	var along_x := r.size.x > r.size.y
	s.transform = Transform3D(Basis() if along_x else Basis(Vector3.UP, PI * 0.5), Vector3(c.x, 3.1, c.y))
	s.visible = true
	(s.material_override as ShaderMaterial).set_shader_parameter("flash", 1.0)

# ------------------------------------------------------------------ 9. echo corridor: "Her Song"
## Four stones in the corridor's north wall sing when touched, each one note of her song (A, D, E, F;
## a notch carved up each stone shows how high it sings). You have heard the song already: her glass
## on the stair rang it when she answered you, A-D-E-F-E. Sing it back, stone by stone (the second E
## means going back to a stone you have struck). A wrong note sours and the song starts over; after two
## soured tries the corridor itself remembers the song once, faintly. Sung right, the hollow wall gives
## way to the hidden room (memory #1).
const SONG_X := [11.4, 14.6, 21.9, 24.9]
const SONG_NOTES := ["E", "A", "F", "D"]           # west to east
const SONG_PITCH := {"A": 0.0, "D": 0.45, "E": 0.7, "F": 0.95}
var song_mats: Array[ShaderMaterial] = []
var song_halos: Array[ShaderMaterial] = []
var song_halo_nodes: Array[Node3D] = []
var song_flash: Array[float] = [0.0, 0.0, 0.0, 0.0]
var song_buf: Array[String] = []
var song_fails := 0
var _song_sour := 0.0
var _song_heard := false

func _build_echo() -> void:
	crack_mat = _smat("res://shaders/wall_shimmer.gdshader", {"noise_tex": level.noise_tex, "kind": 1.0, "flash": 0.0})
	_mi(_quad(Vector2(1.8, 3.1)), crack_mat, Transform3D(Basis(), Vector3(18.3, 3.55, -46.37)))
	# the four singing stones: a slab proud of the wall, its channel and notch
	var sm := MB.new()
	for i in 4:
		sm.box(Vector3(SONG_X[i], 3.3, -46.32), Vector3(1.1, 2.7, 0.16), Color(0.5, 0.25, 0.0))
		sm.box(Vector3(SONG_X[i], 4.72, -46.3), Vector3(1.24, 0.14, 0.22), Color(0.5, 0.25, 0.0))
		level.ob_rect(Level.R(SONG_X[i] - 0.56, -46.5, SONG_X[i] + 0.56, -46.22))
		var m := _smat("res://shaders/sing_panel.gdshader", {"pitch": SONG_PITCH[SONG_NOTES[i]], "flash": 0.0, "lit": 0.25, "size": Vector2(1.0, 2.6)})
		_mi(_quad(Vector2(1.0, 2.6)), m, Transform3D(Basis(), Vector3(SONG_X[i], 3.3, -46.235)))
		song_mats.append(m)
		song_halos.append(puzzles.glow_quad(self, Vector3(SONG_X[i], 2.4 + 0.35 + float(SONG_PITCH[SONG_NOTES[i]]) * 1.75, -46.1), 2.4, Palette.ACCENT, 0.0))
		song_halo_nodes.append(get_child(get_child_count() - 1))
		song_halo_nodes[i].visible = false
		var idx := i
		level.add_interact("song%d" % i, Vector3(SONG_X[i], 2.0, -45.55), "ring", func() -> void: strike_song(idx), 0.95,
			func() -> bool: return not state["echo_room"])
	puzzles.marble_instance(sm.commit(), self)
	# the memory kept in the hidden room: a small relief of a quay and boats, glowing faintly
	var rm := MB.new()
	rm.box(Vector3(18.3, 2.75, -50.05), Vector3(1.3, 1.5, 0.2), Color(0.5, 0.25, 1.0))
	rm.box(Vector3(18.3, 2.1, -49.85), Vector3(1.0, 0.2, 0.5), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(rm.commit(), self)
	puzzles.rune_quad(self, Vector3(18.3, 2.85, -49.94), Vector2(0.7, 0.7), Basis(), 3.0, 0.8)
	puzzles.glow_quad(self, Vector3(18.3, 2.85, -49.7), 1.6, Palette.ACCENT, 0.35)
	level.add_interact("memory1", Vector3(18.3, 2.0, -49.1), "memory", func() -> void: collect_memory("m1"), 1.0,
		func() -> bool: return not ("m1" in state["memories"]))

## a footstep in the corridor: the stone hall answers late
func on_footstep() -> void:
	var p := game.player.position
	if not (p.x > 8.8 and p.x < 26.4 and p.z < -38.9 and p.z > -46.5 and absf(p.y - 2.0) < 0.3): return
	game.sfx.play_later("step_hall", 0.34, -23.0, 0.97)

## touch a singing stone
func strike_song(i: int) -> void:
	if state["echo_room"]: return
	var n: String = SONG_NOTES[i]
	song_flash[i] = 1.0
	event.emit("song_note", n)
	song_buf.append(n)
	var motif: Array = Sfx.MOTIF
	var k := song_buf.size() - 1
	if song_buf[k] != motif[k]:
		# a wrong note: the song sours; this note may begin it again
		song_fails += 1
		_song_sour = 1.0
		event.emit("song_sour", song_fails)
		song_buf.clear()
		if n == motif[0]: song_buf.append(n)
		if song_fails == 2:
			get_tree().create_timer(1.6).timeout.connect(func() -> void:
				_echo_flash = 1.0
				event.emit("song_remember", null))
		return
	if song_buf.size() == motif.size():
		song_buf.clear()
		var tw := create_tween()
		tw.tween_interval(0.9)
		tw.tween_callback(func() -> void: open_echo_room(false))

func _update_echo(dt: float) -> void:
	_echo_flash = maxf(0.0, _echo_flash - dt * 0.35)
	_song_sour = maxf(0.0, _song_sour - dt * 1.2)
	crack_mat.set_shader_parameter("flash", _echo_flash * 0.8 + (0.06 if not state["echo_room"] else 0.0))
	for i in 4:
		song_flash[i] = maxf(0.0, song_flash[i] - dt * 0.7)
		var m := song_mats[i]
		m.set_shader_parameter("flash", song_flash[i])
		m.set_shader_parameter("sour", _song_sour)
		m.set_shader_parameter("t", _t)
		m.set_shader_parameter("lit", 0.6 if state["echo_room"] else 0.25)
		song_halos[i].set_shader_parameter("intensity", song_flash[i] * 1.1)
		song_halo_nodes[i].visible = song_flash[i] > 0.01
	# the first time in the corridor, her song comes back from the stone, faintly (you heard it at the glass)
	if not _song_heard and game.area == "echo_corridor" and not state["echo_room"] and game.mode == "play":
		_song_heard = true
		get_tree().create_timer(2.5).timeout.connect(func() -> void: event.emit("song_remember", null))

func open_echo_room(instant := false) -> void:
	state["echo_room"] = true
	level.set_enabled("echo_secret", false)
	level.set_enabled("EC_room_door", true)
	level.set_enabled("EC_room", true)
	var w := level.get_node_or_null("Zone_ECs") as MeshInstance3D
	if instant:
		if w: w.visible = false
		return
	event.emit("solve", "echo_corridor")
	if w:
		var tw := create_tween()
		tw.tween_property(w, "position:y", -3.6, 2.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tw.tween_callback(func() -> void: w.visible = false)

func collect_memory(id: String) -> void:
	if id in state["memories"]: return
	(state["memories"] as Array).append(id)
	event.emit("memory", id)

# ------------------------------------------------------------------ 10. the scales: "Weight of a Reflection"
## A great balance: its arm rests on a tall standing glass, three hooks a side (1, 2, 3 units out), a
## pan on each. A stone urn (5) hangs on the far left hook: left 15. Three marble weights (1, 2, 3)
## can be hung on any free pan. Even all three on the right make only 14: the scale cannot be won in
## your world alone. Three tiles on the floor on the left (beneath hooks 1, 2, 3, just behind them)
## put you in front of the glass; in the glass, your reflection stands on the RIGHT, under the same
## hook, and the balance counts her: 2 at that hook, on the mirrored side. Level the arm (left = right,
## weight x hook), hold still, and it locks; the lift beside it then carries you up to the walkway.
## Several settings level it (solve_scales); none without her.
const SC_X := 29.7                          # the pivot glass (plane x), facing west
const SC_ARM := Vector3(29.7, 7.75, -49.0)  # the pivot
const SC_UNIT := 0.95                       # metres per hook step
const SC_PAN_Y := 4.05                      # (overhead: you walk beneath the pans)
const SC_TILE_Z := -50.2
const SC_URN := 5                           # on L3: left torque 15
const SC_RACK := [Vector3(27.65, 2.0, -45.0), Vector3(28.35, 2.0, -45.0), Vector3(29.05, 2.0, -45.0)]
const SC_WEIGHT := [1, 2, 3]
var sc_arm: Node3D
var sc_needle: Node3D
var sc_pans: Array[Node3D] = []             # L1, L2, L3, R1, R2, R3
var sc_rods: Array[MeshInstance3D] = []
var sc_wnodes: Array[Node3D] = []           # the three weights
var sc_tile_mats: Array[ShaderMaterial] = []
var sc_carry := -1                          # the weight in your hands (index) or -1
var sc_angle := 0.0
var sc_hold := 0.0
var sc_tries := 0.0                         # seconds spent unlevel with all three hung (a hint)
var sc_hint := 0.0
var _sc_last_t := 0
var lift_node: Node3D
var lift_h := 0.0
var _lift_goal := 0.0
var _lift_still := 0.0
var _groan_cd := 0.0
const LIFT_C := Vector3(31.4, 2.0, -45.6)

static func pan_pos(k: int) -> Vector3:
	var d := (k % 3 + 1) * SC_UNIT
	return Vector3(SC_X + (d if k >= 3 else -d), SC_PAN_Y, SC_ARM.z)

func _build_scales() -> void:
	# the lift (the walkway's foot) beside the balance
	lift_node = Node3D.new()
	lift_node.position = LIFT_C
	add_child(lift_node)
	var lm := MB.new()
	lm.box(Vector3(0, -0.15, 0), Vector3(2.0, 0.3, 2.0), Color(0.5, 0.0, 0.0))
	lm.box(Vector3(0, -0.9, 0), Vector3(0.4, 1.4, 0.4), Color(0.5, 1.0, 0.0))
	puzzles.marble_instance(lm.commit(), lift_node)
	puzzles.rune_quad(lift_node, Vector3(0, 0.012, 0), Vector2(1.2, 1.2), Basis(Vector3.RIGHT, -PI * 0.5), 2.0, 0.25)
	# the pivot glass: a tall standing pane, its back stone; the pivot block on top with the pointer
	var gm := MB.new()
	gm.box(Vector3(SC_X + 0.12, 4.75, -48.95), Vector3(0.2, 5.5, 3.9), Color(0.5, 0.25, 0.0))
	gm.box(Vector3(SC_X, 7.62, SC_ARM.z), Vector3(0.6, 0.5, 0.6), Color(0.5, 1.0, 0.0))
	gm.box(Vector3(SC_X, 2.1, -48.95), Vector3(0.5, 0.2, 4.0), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(gm.commit(), self)
	level.ob_rect(Level.R(SC_X - 0.2, -50.95, SC_X + 0.25, -46.95))
	var gsize := Vector2(3.8, 5.3)
	var gc := Vector3(SC_X, 4.75, -48.95)
	var mm := puzzles._mirror_quad(gc, Basis(Vector3.UP, -PI * 0.5), gsize, false, 1.0)
	mm.set_shader_parameter("ncols", 0)
	mm.set_shader_parameter("floor_y", 2.0)
	var pm := PlanarMirror.new()
	add_child(pm)
	pm.setup(Vector3.LEFT, -SC_X + 0.01, mm, game.world.env)
	pm.cam.far = 40.0
	pm.res_k = 0.8
	var r := Reflector.new()
	r.kind = "mirror"; r.plane_n = Vector3.LEFT; r.plane_d = -SC_X + 0.02
	r.clip_c = gc; r.clip_u = Vector3.BACK; r.clip_v = Vector3.UP; r.clip_h = gsize * 0.5
	r.region = Level.R(26.0, -52.0, SC_X, -44.6)
	r.planar = pm
	puzzles._add_refl(r)
	# the arm (it tips about the pivot), a hook and a rod down to a pan at each step
	sc_arm = Node3D.new()
	sc_arm.position = SC_ARM
	add_child(sc_arm)
	var am := MB.new()
	am.box(Vector3.ZERO, Vector3(6.4, 0.22, 0.26), Color(0.5, 0.25, 1.0))
	for k in 6:
		var x := (pan_pos(k).x - SC_X)
		am.box(Vector3(x, -0.16, 0), Vector3(0.08, 0.12, 0.3), Color(0.5, 1.0, 0.0))
	puzzles.marble_instance(am.commit(), sc_arm)
	for k in 6:
		var pn := Node3D.new()
		pn.position = pan_pos(k)
		add_child(pn)
		var pmm := MB.new()
		pmm.cyl(Vector3(0, 0.0, 0), 0.3, 0.22, 0.1, Color(0.5, 1.0, 0.0), 14)
		puzzles.marble_instance(pmm.commit(), pn)
		sc_pans.append(pn)
		var rod := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.02; cm.bottom_radius = 0.02; cm.height = 1.0; cm.radial_segments = 5
		rod.mesh = cm
		rod.material_override = level.marble_mat
		add_child(rod)
		sc_rods.append(rod)
		var idx := k
		level.add_interact("pan%d" % k, Vector3(pan_pos(k).x, 2.0, pan_pos(k).z), "hang", func() -> void: pan_action(idx), 0.7,
			func() -> bool: return _pan_can(idx))
	# the urn on L3 (heavy: 5)
	var um := MB.new()
	um.sphere(Vector3(0, 0.36, 0), Vector3(0.3, 0.34, 0.3), Color(0.5, 0.5, 0.0), 12, 7)
	um.cyl(Vector3(0, 0.74, 0), 0.14, 0.18, 0.14, Color(0.5, 0.5, 0.0), 10)
	puzzles.marble_instance(um.commit(), sc_pans[2]).position.y = 0.05
	# the pointer: a needle on the pivot block's face, over a carved level mark
	sc_needle = Node3D.new()
	sc_needle.position = Vector3(SC_X, 7.66, SC_ARM.z + 0.31)
	add_child(sc_needle)
	var nm := MB.new()
	nm.box(Vector3(0, -0.24, 0), Vector3(0.035, 0.48, 0.03), Color(0.5, 1.0, 0.0))
	nm.sphere(Vector3(0, 0, 0), Vector3(0.05, 0.05, 0.03), Color(0.5, 1.0, 0.0), 8, 4)
	puzzles.marble_instance(nm.commit(), sc_needle)
	puzzles.rune_quad(self, Vector3(SC_X, 7.23, SC_ARM.z + 0.305), Vector2(0.16, 0.16), Basis(), -1.0, 0.5)
	# the three weights on a low bench by the way in
	var bench := MB.new()
	bench.box(Vector3(28.35, 2.15, -45.0), Vector3(2.1, 0.3, 0.55), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(bench.commit(), self)
	level.ob_rect(Level.R(27.3, -45.27, 29.4, -44.73))
	for i in 3:
		var w := Node3D.new()
		add_child(w)
		var sz: float = [0.2, 0.26, 0.32][i]
		var wm := MB.new()
		wm.box(Vector3(0, sz * 0.5, 0), Vector3(sz, sz, sz), Color(0.5, 0.25, 0.0))
		wm.cyl(Vector3(0, sz + 0.04, 0), 0.03, 0.03, 0.08, Color(0.5, 1.0, 0.0), 6)
		puzzles.marble_instance(wm.commit(), w)
		puzzles.rune_quad(w, Vector3(0, sz * 0.5, sz * 0.5 + 0.004), Vector2(sz * 0.9, sz * 0.9), Basis(), -1.0, 0.45, float(i + 1))
		sc_wnodes.append(w)
		var wi := i
		level.add_interact("weight%d" % i, SC_RACK[i] + Vector3(0, 0, -0.6), "take", func() -> void: take_weight(wi), 0.7,
			func() -> bool: return ((sc_carry < 0 and int(state["scale_w"][wi]) == -1) or sc_carry == wi) and not state["scales"])
	# the three tiles where your reflection stands on the other side
	for k in 3:
		var tp := Vector3(SC_X - (k + 1) * SC_UNIT, 2.012, SC_TILE_Z)
		sc_tile_mats.append(puzzles.rune_quad(self, tp, Vector2(0.72, 0.72), Basis(Vector3.RIGHT, -PI * 0.5), 2.0, 0.22, float(k + 1)))
	level.inscription("sc_stele", Vector3(27.0, 2.0, -46.3), "The scale weighs what stands before it, as the glass sees it.\nShe was never as heavy as stone.", 1.1,
		Transform3D(Basis(Vector3.UP, PI * 0.5), Vector3(26.15, 2.62, -46.9)), Vector2(0.8, 0.75))
	var sm := MB.new()
	sm.box(Vector3(26.05, 2.6, -46.9), Vector3(0.2, 1.2, 1.0), Color(0.5, 0.25, 0.0))
	puzzles.marble_instance(sm.commit(), self)

func _pan_free(k: int) -> bool:
	if k == 2: return false                 # the urn's
	for i in 3:
		if int(state["scale_w"][i]) == k: return false
	return true

func _pan_can(k: int) -> bool:
	if state["scales"] or k == 2: return false
	if sc_carry >= 0: return _pan_free(k)
	for i in 3:
		if int(state["scale_w"][i]) == k: return true
	return false

func take_weight(i: int) -> void:
	if state["scales"]: return
	if sc_carry == i:
		# (back on the bench)
		sc_carry = -1
		state["scale_w"][i] = -1
		event.emit("weight_hang", -1)
		return
	if sc_carry >= 0: return
	sc_carry = i
	state["scale_w"][i] = -2
	event.emit("weight_take", i)

## at a pan: hang the weight you carry, or take back the one hanging there
func pan_action(k: int) -> void:
	if state["scales"]: return
	if sc_carry >= 0:
		if not _pan_free(k): return
		state["scale_w"][sc_carry] = k
		event.emit("weight_hang", k)
		sc_carry = -1
		return
	for i in 3:
		if int(state["scale_w"][i]) == k:
			sc_carry = i
			state["scale_w"][i] = -2
			event.emit("weight_take", i)
			return

## the tile you stand on (1..3) or 0
func scale_tile() -> int:
	var p := game.player.position
	if absf(p.y - 2.0) > 0.2: return 0
	for k in 3:
		var tp := Vector2(SC_X - (k + 1) * SC_UNIT, SC_TILE_Z)
		if absf(p.x - tp.x) < 0.4 and absf(p.z - tp.y) < 0.4: return k + 1
	return 0

## [left, right] torque: weight x hook; her reflection (2) at your tile's hook, on the right
func scale_torque(tile := -1) -> Vector2i:
	if tile < 0: tile = scale_tile()
	var L := SC_URN * 3
	var R := 0
	for i in 3:
		var k := int(state["scale_w"][i])
		if k < 0: continue
		if k < 3: L += SC_WEIGHT[i] * (k + 1)
		else: R += SC_WEIGHT[i] * (k - 2)
	R += 2 * tile
	return Vector2i(L, R)

## (tests) every way to level it: [[w1 pan, w2 pan, w3 pan], tile]
static func solve_scales() -> Array:
	var out := []
	var opts := [-1, 0, 1, 3, 4, 5]
	for a in opts:
		for b in opts:
			for c in opts:
				var ws := [a, b, c]
				var used := {}
				var ok := true
				for k in ws:
					if k >= 0:
						if used.has(k): ok = false
						used[k] = true
				if not ok: continue
				for tile in 4:
					var L := SC_URN * 3
					var R := 2 * tile
					for i in 3:
						if ws[i] < 0: continue
						if ws[i] < 3: L += SC_WEIGHT[i] * (ws[i] + 1)
						else: R += SC_WEIGHT[i] * (ws[i] - 2)
					if L == R: out.append([ws, tile])
	return out

func on_lift() -> bool:
	var p := game.player.position
	return absf(p.x - LIFT_C.x) < 1.0 and absf(p.z - LIFT_C.z) < 1.0

func _update_scales(dt: float) -> void:
	var pl := game.player
	# the weights: in your hands, on a pan, or on the bench
	for i in 3:
		var k := int(state["scale_w"][i])
		var w := sc_wnodes[i]
		if i == sc_carry:
			var fwd := Vector3(-sin(pl.yaw), 0, -cos(pl.yaw))
			w.position = w.position.lerp(pl.position + fwd * 0.4 + Vector3(0, 0.95, 0), 1.0 - exp(-dt * 14.0))
		elif k >= 0:
			w.position = w.position.lerp(sc_pans[k].position + Vector3(0, 0.06, 0), 1.0 - exp(-dt * 10.0))
		else:
			w.position = w.position.lerp(SC_RACK[i] + Vector3(0, 0.3, 0), 1.0 - exp(-dt * 10.0))
	var tile := scale_tile()
	sc_hint = smoothstep(25.0, 30.0, sc_tries)
	for k in 3: sc_tile_mats[k].set_shader_parameter("lit", 0.9 if tile == k + 1 else (0.22 + 0.4 * sc_hint * (0.5 + 0.5 * sin(_t * 2.0))))
	var tq := scale_torque(tile)
	var diff := tq.y - tq.x
	if state["scales"]: diff = 0
	# the arm: right heavier tips right-down (a positive diff lowers the right end)
	var goal := clampf(float(diff) * 0.045, -0.24, 0.24)
	sc_angle = move_toward(sc_angle, goal, dt * 0.35)
	sc_arm.rotation = Vector3(0, 0, -sc_angle)
	sc_needle.rotation.z = -sc_angle * 2.6
	for k in 6:
		var top: Vector3 = sc_arm.global_transform * Vector3(pan_pos(k).x - SC_X, -0.2, 0)
		var pp := sc_pans[k]
		pp.position = Vector3(pan_pos(k).x, top.y - (SC_ARM.y - 0.2 - SC_PAN_Y), pan_pos(k).z)
		var bot := pp.position + Vector3(0, 0.05, 0)
		var v := top - bot
		sc_rods[k].global_transform = Transform3D(Basis(Vector3.RIGHT, Vector3.UP * v.length(), Vector3.BACK), (top + bot) * 0.5)
	_groan_cd = maxf(0.0, _groan_cd - dt)
	if diff != _sc_last_t and _groan_cd <= 0.0 and not state["scales"]:
		_groan_cd = 0.6
		event.emit("scale_groan", diff)
	_sc_last_t = diff
	var all_hung := int(state["scale_w"][0]) >= 0 and int(state["scale_w"][1]) >= 0 and int(state["scale_w"][2]) >= 0
	if all_hung and diff != 0 and not state["scales"]: sc_tries += dt
	if not state["scales"]:
		sc_hold = sc_hold + dt if (diff == 0 and absf(sc_angle) < 0.01 and pl.speed01 < 0.05) else 0.0
		if sc_hold > 1.2:
			state["scales"] = true
			sc_carry = -1
			event.emit("solve", "scales")
	# the lift: once the balance is won, stand on it a moment and it carries you to the other level
	var on := on_lift() and absf(pl.position.y - (2.0 + lift_h * 2.0)) < 0.3
	if state["scales"] and on and pl.speed01 < 0.05 and absf(lift_h - _lift_goal) < 0.001:
		_lift_still += dt
		if _lift_still > 0.8:
			_lift_still = 0.0
			_lift_goal = 1.0 - _lift_goal
			event.emit("lift", _lift_goal)
	else:
		_lift_still = 0.0
	var prev := lift_h
	lift_h = move_toward(lift_h, _lift_goal, dt * 0.4)
	var y := 2.0 + lift_h * 2.0
	lift_node.position.y = y
	var g: Level.Region = level.named["lift"]
	g.y0 = y; g.y1 = y
	if on and lift_h != prev: pl.position.y = y

# ------------------------------------------------------------------ 11. her footprints to the plate
func _build_ledge_feet() -> void:
	var fsh := preload("res://shaders/footprint.gdshader")
	var path := [Vector3(22.1, 2.03, -25.5), Vector3(22.5, 2.03, -26.6), Vector3(22.9, 2.03, -27.7), Vector3(23.3, 2.03, -28.7), Vector3(23.6, 2.03, -29.4)]
	var side := 1.0
	for i in path.size() - 1:
		var a: Vector3 = path[i]
		var b: Vector3 = path[i + 1]
		var dir := (b - a).normalized()
		for j in 2:
			var c := a.lerp(b, (j + 0.5) / 2.0) + dir.cross(Vector3.UP) * side * 0.1
			side = -side
			var m := ShaderMaterial.new()
			m.shader = fsh
			m.set_shader_parameter("project", 0.0)
			m.set_shader_parameter("life", 1.0)
			m.set_shader_parameter("dark", 1.0)
			var q := QuadMesh.new()
			q.size = Vector2(0.28, 0.46)
			q.orientation = PlaneMesh.FACE_Y
			var mi := _mi(q, m, Transform3D(Basis(Vector3.UP, atan2(-dir.x, -dir.z)), c))
			mi.visible = false
			ledge_feet.append(mi)
			ledge_feet_t.append(0.0)

## v0.6 "Two Plates": her plate across the gap answers only when YOUR plate is held down too, at the
## same moment. Your reflection in the great glass is mirrored across it: standing on your plate, your
## reflection is nowhere near hers; standing where your reflection stands on hers, your plate is empty.
## So the veiled statue on the ledge must hold your plate (push it: it slides a cell at a time), while
## you take the place her footprints lead your reflection to.
const LEDGE_PLATE := Vector2i(26, -23)           # cell (x + 0.5, z + 0.5): your plate
const LEDGE_STATUE := Vector2i(25, -21)          # where the pushable statue starts
var ledge_statue: Node3D
var ledge_statue_ob: Level.Obstacle
var ledge_plate_mat: ShaderMaterial
var _ledge_tw: Tween

static func lcell(c: Vector2i) -> Vector3:
	return Vector3(c.x + 0.5, 2.0, c.y + 0.5)

func _build_ledge_plate() -> void:
	var pm := MB.new()
	var pc := lcell(LEDGE_PLATE)
	pm.cyl(pc + Vector3(0, 0.03, 0), 0.5, 0.54, 0.06, Color(0.5, 1.0, 0.0), 20)
	puzzles.marble_instance(pm.commit(), self)
	ledge_plate_mat = puzzles.rune_quad(self, pc + Vector3(0, 0.065, 0), Vector2(0.8, 0.8), Basis(Vector3.RIGHT, -PI * 0.5), 2.0, 0.3)
	ledge_statue = Node3D.new()
	add_child(ledge_statue)
	var mi := MeshInstance3D.new()
	mi.mesh = _statue_mesh(0.78, 0.18, 0.25)
	mi.material_override = level.marble_mat
	ledge_statue.add_child(mi)
	ledge_statue.rotation.y = PI
	ledge_statue_ob = level.ob_circle(Vector2.ZERO, 0.42, "ledge_statue")
	level.add_interact("ledge_push", Vector3.ZERO, "push", push_statue, 1.05, func() -> bool: return _statue_dir() != Vector2i.ZERO)

func _statue_cell() -> Vector2i:
	return Vector2i(int(state["ledge_statue"][0]), int(state["ledge_statue"][1]))

func _ledge_free(c: Vector2i) -> bool:
	var q := Vector2(c.x + 0.5, c.y + 0.5)
	if q.x < 21.45 or q.x > 28.55 or q.y < -24.55 or q.y > -19.45: return false
	ledge_statue_ob.enabled = false
	var bl := level.blocked(q, 0.42)
	ledge_statue_ob.enabled = true
	return not bl

func _statue_dir() -> Vector2i:
	if puzzles.state["plate"] or (_ledge_tw and _ledge_tw.is_running()): return Vector2i.ZERO
	var c := lcell(_statue_cell())
	var d := Vector2(c.x - game.player.position.x, c.z - game.player.position.z)
	if d.length() > 1.05 or d.length() < 0.3: return Vector2i.ZERO
	var dir := Vector2i(signi(roundi(d.x)) if absf(d.x) > absf(d.y) else 0, signi(roundi(d.y)) if absf(d.y) >= absf(d.x) else 0)
	if dir == Vector2i.ZERO: return dir
	if (absf(d.y) if dir.x != 0 else absf(d.x)) > 0.45: return Vector2i.ZERO
	if not _ledge_free(_statue_cell() + dir): return Vector2i.ZERO
	return dir

func push_statue() -> void:
	var dir := _statue_dir()
	if dir == Vector2i.ZERO: return
	var c := _statue_cell() + dir
	state["ledge_statue"] = [c.x, c.y]
	ledge_statue_ob.c = Vector2(c.x + 0.5, c.y + 0.5)
	event.emit("hall_push", null)
	_ledge_tw = create_tween()
	_ledge_tw.tween_property(ledge_statue, "position", lcell(c), 0.6).set_trans(Tween.TRANS_SINE)
	_ledge_tw.tween_callback(func() -> void:
		if plate_a_down(): event.emit("plate_a", null)
		# a statue pushed where it can never be moved again slides back to its place
		if not plate_a_down() and not _statue_movable():
			var tw := create_tween()
			tw.tween_interval(1.6)
			tw.tween_callback(func() -> void:
				state["ledge_statue"] = [LEDGE_STATUE.x, LEDGE_STATUE.y]
				ledge_statue_ob.c = Vector2(LEDGE_STATUE.x + 0.5, LEDGE_STATUE.y + 0.5)
				event.emit("hall_push", null))
			tw.tween_property(ledge_statue, "position", lcell(LEDGE_STATUE), 1.4).set_trans(Tween.TRANS_SINE))

func _statue_movable() -> bool:
	var c := _statue_cell()
	for dir in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		var st := Vector2(c.x + 0.5 - dir.x * 0.75, c.y + 0.5 - dir.y * 0.75)
		if _ledge_free(c + dir) and level.on_ground(st) and not level.blocked(st, Player.RADIUS): return true
	return false

## your plate: held by the statue (or by you, which does not help)
func plate_a_down() -> bool:
	if _statue_cell() == LEDGE_PLATE: return true
	var p := game.player.position
	var pc := lcell(LEDGE_PLATE)
	return Vector2(p.x - pc.x, p.z - pc.z).length() < 0.5 and absf(p.y - 2.0) < 0.2

func _update_ledge(dt: float) -> void:
	var p := game.player.position
	var on: bool = p.x > 21.0 and p.x < 29.0 and p.z > -25.0 and p.z < -19.0 and absf(p.y - 2.0) < 0.2 and not puzzles.state["plate"]
	var n := ledge_feet.size()
	var period := n * 0.5 + 2.5
	if on: _ledge_loop = fmod(_ledge_loop + dt, period)
	for i in n:
		var age := _ledge_loop - i * 0.5
		var vis: bool = on and age >= 0.0
		ledge_feet[i].visible = vis
		if vis: (ledge_feet[i].material_override as ShaderMaterial).set_shader_parameter("life", pow(clampf(age / 6.0, 0.0, 1.0), 2.0))
	level.interact_by_id("ledge_push").pos = lcell(_statue_cell())
	var lit: float = ledge_plate_mat.get_shader_parameter("lit")
	ledge_plate_mat.set_shader_parameter("lit", move_toward(lit, 1.0 if (plate_a_down() or puzzles.state["plate"]) else 0.3, dt * 2.0))

# ------------------------------------------------------------------ 12. gate of the four veiled
func four_pos(i: int) -> Vector3:
	var a := deg_to_rad(FOUR_ANGLES[i])
	return Puzzles.SHRINE_C + Vector3(cos(a) * FOUR_R, 0.0, sin(a) * FOUR_R)

func _build_four() -> void:
	var c := Puzzles.SHRINE_C
	# the tholos' gaps are closed by veils of light; the one facing the bridge is the gate
	var vsh := preload("res://shaders/mist_veil.gdshader")
	for k in 8:
		var a := k * PI * 0.25
		var p := c + Vector3(cos(a) * 2.5, 0.0, sin(a) * 2.5)
		var front := k == 2
		level.ob_circle(Vector2(p.x, p.z), 0.5, "tholos_front" if front else "tholos_gap%d" % k)
		var m := ShaderMaterial.new()
		m.shader = vsh
		m.set_shader_parameter("noise_tex", level.noise_tex)
		m.set_shader_parameter("density", 0.75 if front else 0.45)
		m.set_shader_parameter("glow", 0.8 if front else 0.4)
		var tang := Vector3(-sin(a), 0, cos(a))
		_mi(_quad(Vector2(1.2, 3.2)), m, Transform3D(Basis(tang, Vector3.UP, tang.cross(Vector3.UP)), p + Vector3(0, 1.65, 0)))
		if front: front_veil = m
		else: gap_veils.append(m)
	var pm := MB.new()
	for i in 4:
		var p := four_pos(i)
		pm.box(p + Vector3(0, 0.125, 0), Vector3(1.0, 0.25, 1.0), Color(0.5, 0.25, 0.0))
		var face := (c - p)
		face.y = 0.0
		face = face.normalized()
		var B := Basis(Vector3.UP, atan2(face.x, face.z))
		four_mats.append(puzzles.rune_quad(self, p + Vector3(0, 0.13, 0) + face * 0.505, Vector2(0.24, 0.24), B, 2.0, 0.15))
		if i < 3:
			level.statue("S", p + Vector3(0, 0.25, 0), Level.yaw_to(p, c), 0.9, 0.45)
		else:
			level.walk(Level.R(p.x - 0.5, p.z - 0.5, p.x + 0.5, p.z + 0.5), 2.25, NAN, -1, "four_plinth")
	puzzles.marble_instance(pm.commit(), self)
	four_ring = _smat("res://shaders/ring.gdshader", {"lit": 0.0, "sweep": 0.0})
	_mi(_plane(Vector2(1.5, 1.5)), four_ring, Transform3D(Basis(), four_pos(3) + Vector3(0, 0.262, 0)))
	level.add_interact("four_wait", four_pos(3) + Vector3(0, 0.25, 0), "wait", wait_still, 0.55,
		func() -> bool: return not state["four"])
	level.inscription("s_four", Vector3(21.5, 2.0, -29.2), "A thousand of her wait for the one who breathes.\nStand where she stood. Be still, as we are still.", 1.0,
		Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(21.5, 2.012, -29.6)), Vector2(1.0, 0.7))

func on_four_plinth() -> bool:
	var p := game.player.position
	var q := four_pos(3)
	return absf(p.x - q.x) < 0.5 and absf(p.z - q.z) < 0.5 and absf(p.y - 2.25) < 0.1

func facing_shrine() -> bool:
	var p := game.player.position
	var d := Vector2(Puzzles.SHRINE_C.x - p.x, Puzzles.SHRINE_C.z - p.z).normalized()
	var fwd := Vector2(-sin(game.player.yaw), -cos(game.player.yaw))
	return fwd.dot(d) > cos(deg_to_rad(40.0))

## "wait": turn to face the shrine as the others do, and hold still
func wait_still() -> void:
	if not on_four_plinth(): return
	# (QA P2-15) no auto-facing: you must turn toward the shrine yourself, as the stele says
	waiting = 5.0
	game.player.locked = true

func _update_four(dt: float) -> void:
	if waiting > 0.0:
		waiting -= dt
		if waiting <= 0.0 or state["four"]:
			waiting = 0.0
			if game.mode == "play": game.player.locked = false
	if state["four"]: return
	var ok := on_four_plinth() and game.player.speed01 < 0.04 and facing_shrine()
	four_hold = four_hold + dt if ok else maxf(0.0, four_hold - dt * 2.5)
	four_ring.set_shader_parameter("lit", minf(1.0, four_hold / 3.6) if ok or four_hold > 0.0 else 0.0)
	four_ring.set_shader_parameter("sweep", clampf(four_hold / 3.6, 0.0, 1.0))
	for i in 4:
		var on := four_hold > (i + 1) * 0.9
		four_mats[i].set_shader_parameter("lit", 1.0 if on else 0.15)
	if four_hold >= 3.6: open_four(false)

func open_four(instant: bool) -> void:
	state["four"] = true
	level.set_enabled("tholos_front", false)
	for m in four_mats: m.set_shader_parameter("lit", 1.0)
	if instant:
		front_veil.set_shader_parameter("density", 0.0)
		return
	event.emit("solve", "gate_four")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		front_veil.set_shader_parameter("density", v)
		front_veil.set_shader_parameter("glow", 0.8 + (0.75 - v)), 0.75, 0.0, 3.0)

# ------------------------------------------------------------------ 13. the shrine's pool
func _build_shrine_pool() -> void:
	var c := Vector3(POOL_C.x, Puzzles.SHRINE_C.y, POOL_C.z)
	var d := POOL_R * 2.0 + 0.02
	shrine_water = _smat("res://shaders/water.gdshader", {"noise_tex": level.noise_tex, "disc": 1.0})
	_mi(_plane(Vector2(d, d)), shrine_water, Transform3D(Basis(), c + Vector3(0, 0.15, 0)))
	shrine_over = _smat("res://shaders/water_over.gdshader", {"noise_tex": level.noise_tex, "disc": 1.0,
		"area": Vector4(c.x - POOL_R, c.z - POOL_R, c.x + POOL_R, c.z + POOL_R), "calm": 0.6})
	_mi(_plane(Vector2(d, d)), shrine_over, Transform3D(Basis(), c + Vector3(0, 0.165, 0)))

# ------------------------------------------------------------------ hints
func _build_wisp() -> void:
	wisp = MeshInstance3D.new()
	wisp.mesh = _quad(Vector2(0.5, 0.5))
	wisp_mat = ShaderMaterial.new()
	wisp_mat.shader = preload("res://shaders/halo.gdshader")
	wisp_mat.set_shader_parameter("color", Palette.CORE)
	wisp_mat.set_shader_parameter("intensity", 0.0)
	wisp.material_override = wisp_mat
	wisp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	wisp.visible = false
	add_child(wisp)

## where the gentle hint should drift (INF: nothing to hint in this space)
func hint_target(area: String) -> Vector3:
	match area:
		"waking_pool": return Vector3(-4.2, 0.6, 1.7) if not state["stones"] else Vector3.INF
		"stair_breath": return Vector3(-10.5, 1.6, -5.3) if not state["breath"] else Vector3.INF
		"hall_glass":
			if not state["hall_door"]: return Vector3(0.0, 2.6, -20.3)        # the glass, never the answer
			return SHARD_SPOT + Vector3(0, 0.8, 0) if not state["shard"] else Vector3.INF
		"shard_gallery":
			if state["gallery"]: return Vector3.INF
			return Vector3(6.5, 2.4, -10.45) if gl_fails < 1 or not lens_on else Vector3(6.6, 2.4, -8.5)
		"garden_veiled":
			if state["turned_done"]: return Vector3.INF
			if not state["garden_breath"]: return Vector3(16.0, 2.2, -14.6)
			var ok := turned_correct()
			for i in 3:
				if not ok[i]: return Vector3(TURN_X[i], 2.3, TURN_Z)
		"hollow_walk":
			if state["hollow_done"]: return Vector3.INF
			for i in 2:
				if not _plate_taken(i): return Ch1Geo.hw_cell(Ch1Geo.HW_PLATES[i]) + Vector3(0, 0.6, 0)
		"court_light":
			# (toward her glass, never to the answer)
			if not puzzles.state["bridge"]: return Vector3(16.5, 3.6, -24.0)
			elif not state["mural"]: return mural_spot() + Vector3(0, 0.6, 0)
		"mist_maze": return Vector3(4.6, 2.6, -34.0) if not state["maze"] else Vector3.INF
		"echo_corridor": return Vector3(18.3, 3.6, -46.2) if not state["echo_room"] else Vector3.INF
		"scales":
			if state["scales"]: return LIFT_C + Vector3(0, 0.8, 0) if lift_h < 0.5 else Vector3.INF
			return Vector3(SC_X - 0.2, 4.5, -48.95)          # the glass of the balance
		"eidolon_ledge":
			if puzzles.state["plate"]: return Vector3.INF
			if game.player.position.y > 3.0: return Vector3(29.8, 3.0, -22.4)
			if not plate_a_down(): return lcell(LEDGE_PLATE) + Vector3(0, 0.6, 0)
			return puzzles.foot_spot + Vector3(0, 0.6, 0)
		"gate_four": return four_pos(3) + Vector3(0, 0.9, 0) if not state["four"] else Vector3.INF
		"first_shrine": return Puzzles.SHRINE_C + Vector3(0, 1.0, 1.85) if not puzzles.state["shrine"] else Vector3.INF
	return Vector3.INF

## after a few minutes without progress in a space, a faint petrol wisp drifts from you toward what
## matters (no words, never the answer itself)
func _update_hints(dt: float, area: String) -> void:
	if area != hint_area:
		hint_area = area
		hint_t = 0.0
	if game.mode != "play": return
	hint_t += dt
	_hint_cd = maxf(0.0, _hint_cd - dt)
	if hint_t < Game.HINT_AFTER or _hint_cd > 0.0: return
	var tgt := hint_target(area)
	if tgt == Vector3.INF: return
	_hint_cd = 45.0
	show_hint(tgt)

func show_hint(tgt: Vector3) -> void:
	event.emit("hint", tgt)
	var a := game.player.position + Vector3(0, 1.3, 0)
	wisp.visible = true
	var tw := create_tween()
	tw.tween_method(func(k: float) -> void:
		wisp.global_position = a.lerp(tgt, k) + Vector3(0, sin(k * PI) * 0.8, 0)
		wisp_mat.set_shader_parameter("intensity", sin(k * PI) * 0.9 + 0.1), 0.0, 1.0, 3.2).set_trans(Tween.TRANS_SINE)
	tw.tween_method(func(v: float) -> void: wisp_mat.set_shader_parameter("intensity", v), 0.6, 0.0, 1.4)
	tw.tween_callback(func() -> void: wisp.visible = false)

## progress made: the hint clock starts again
func progress() -> void:
	hint_t = 0.0

# ================================================================== per frame / state
func update(dt: float) -> void:
	_t += dt
	if game.player.speed01 > 0.1: _moved = true
	_update_pool(dt)
	_update_hall(dt)
	_update_gallery(dt)
	if lens_on and game.area != "shard_gallery" and game.area != "": set_lens(false)
	_update_lens()
	_update_hollow(dt)
	_update_mural(dt)
	_update_maze(dt)
	_update_echo(dt)
	_update_scales(dt)
	_update_ledge(dt)
	_update_four(dt)
	_update_hints(dt, game.area)

func apply_state() -> void:
	# (from JSON, numbers come back as floats: the lit lamps are compared as ints)
	state["gallery_lit"] = (state["gallery_lit"] as Array).map(func(v: Variant) -> int: return int(v))
	# (a v0.5 save: the hall was won by touching the glass; set its things back as the glass remembers)
	if state["hall_door"] and state["hall"]["locks"] != [true, true, true]:
		state["hall"] = {"drum": [DRUM_GOAL.x, DRUM_GOAL.y], "brazier": [BRAZ_GOAL.x, BRAZ_GOAL.y], "bust": BUST_GOAL, "locks": [true, true, true]}
	if state["stones"]: state["pool_turns"] = _pool_solution()
	_apply_pool()
	if state["breath"]: _open_stair(true)
	else:
		level.set_enabled("breath_gate", true)
		stair_veil.set_shader_parameter("density", 1.0)
	var hd := level.get_node_or_null("Zone_Hdoor") as MeshInstance3D
	if state["hall_door"]: _open_hall_door(true)
	else:
		level.set_enabled("hdoor", false)
		if hd: hd.visible = true; hd.position.y = 0.0
	_apply_hall()
	var gls := level.get_node_or_null("Zone_GLs") as MeshInstance3D
	if state["gallery"]: open_gallery(true)
	else:
		level.set_enabled("gallery_secret", true)
		if gls: gls.visible = true; gls.position.y = 0.0
		_gl_busy = false
		gl_map.set_shader_parameter("pulse", 0.0)
		for k in 4:
			gl_flames[k].set_shader_parameter("intensity", 1.0 if k in state["gallery_lit"] else 0.0)
			gl_flames[k].set_shader_parameter("gutter", 0.0)
			(gl_lamps[k]["veil"] as ShaderMaterial).set_shader_parameter("intensity", 0.0)
	maze_prog = -1
	_apply_turned(true)
	if state["turned_done"]: _open_garden_door(true)
	else:
		level.set_enabled("g_door_ob", true)
		level.set_enabled("g_door", false)
		for k in 2:
			door_refl[k].rotation.y = 0.0
			door_real[k].rotation.y = 0.0
	_place_hollows()
	if state["hollow_done"]: _open_hollow_gate(true)
	else:
		level.set_enabled("hw_gate", true)
		hw_gate.position.y = 1.0
	var mw := level.get_node_or_null("Zone_Mural") as MeshInstance3D
	if state["mural"]: complete_mural(true)
	else:
		level.set_enabled("mural_door", true)
		level.set_enabled("MZ_door", false)
		mural_mat.set_shader_parameter("complete", 0.0)
		if mw: mw.visible = true; mw.position.y = 0.0
	var ec := level.get_node_or_null("Zone_ECs") as MeshInstance3D
	if state["echo_room"]: open_echo_room(true)
	else:
		level.set_enabled("echo_secret", true)
		level.set_enabled("EC_room_door", false)
		level.set_enabled("EC_room", false)
		if ec: ec.visible = true; ec.position.y = 0.0
	ledge_statue.position = lcell(_statue_cell())
	ledge_statue_ob.c = Vector2(_statue_cell().x + 0.5, _statue_cell().y + 0.5)
	for i in 3:
		if int(state["scale_w"][i]) == -2: state["scale_w"][i] = -1
	sc_carry = -1
	sc_hold = 0.0
	sc_tries = 0.0
	for i in 3:
		var k := int(state["scale_w"][i])
		sc_wnodes[i].position = (sc_pans[k].position + Vector3(0, 0.06, 0)) if k >= 0 else SC_RACK[i] + Vector3(0, 0.3, 0)
	lift_h = 0.0
	_lift_goal = 0.0
	if state["four"]: open_four(true)
	else:
		level.set_enabled("tholos_front", true)
		front_veil.set_shader_parameter("density", 0.75)
	game.ui.set_inventory(state["shard"], false)
	set_lens(false)

# ================================================================== 13. "The Hand in the Water"
const POOL_C := Vector3(25.0, 2.155, -32.4)
const POOL_R := 1.18
const STAND := Vector3(25.0, 2.0, -30.8)
const TOUCH := Vector3(25.0, 2.17, -31.35)
var her: Figure                 # her shadow, in the water
var mine: Figure                # your plain reflection (only at the very end)
var touch_glow: ShaderMaterial
var whisper_glow: ShaderMaterial
var touch_her: ShaderMaterial             # v0.8: her light at the touch (rose), meeting yours (aqua)
var her_xf := Transform3D()
var her_pose := Figure.Pose.new()
var _refl_pool := Transform3D()

func _pool_puppet(slim: float) -> Figure:
	var f := Figure.new(preload("res://shaders/ghost.gdshader"))
	f.visible = false
	add_child(f)
	f.set_param("project", 1.0)
	f.set_param("plane_n", Vector3.UP)
	f.set_param("plane_d", POOL_C.y)
	f.set_param("clip_c", POOL_C)
	f.set_param("clip_u", Vector3.RIGHT)
	f.set_param("clip_v", Vector3.BACK)
	f.set_param("clip_h", Vector2(POOL_R, POOL_R))
	f.set_param("clip_disc", 1.0)
	f.set_param("ghost", 0.0)
	f.set_param("vis", 0.0)
	f.set_param("surface_col", Vector3(0.3, 0.36, 0.38))
	f.set_param("surface_mix", 0.1)
	f.set_param("ripple_amt", 0.25)
	f.set_param("shimmer", 0.0)
	f.slim = slim
	f.set_layers(PlanarMirror.LAYER_MAIN_FX)
	return f

func _place(f: Figure, xf: Transform3D, p: Figure.Pose) -> void:
	f.global_transform = _refl_pool * xf
	f.apply_pose(p)

## build the scene on a fresh Cinematic (main.gd plays it after the shrine wakes). Timed to the score
## (manifest doc, cinematic_hand, 59 s, started at P): 0-8 near silence; 8-16 strings as she steps
## closer; 16.5 the hands touch; 23-30 her voice; 30-37.6 the veil lifts (swell); 37.6 the whisper =
## silence; 41-59 she walks into the fog, unresolved. Before it, P s of awakening (shrine_awaken).
const CINE_P := 4.5
func hand_in_the_water(c: Cinematic) -> void:
	_refl_pool = Transform3D(Basis(Vector3.RIGHT, Vector3.DOWN, Vector3.BACK), Vector3(0, 2.0 * POOL_C.y, 0))
	if her == null:
		her = _pool_puppet(0.045)
		her.veil_contrary = true
		mine = _pool_puppet(0.0)
		mine.set_cloth("copy", game.player.fig)
		mine.set_param("hers", 0.0)                       # (your reflection keeps your aqua)          # (your reflection wears your cloth; hers rests: she is only a reflection)
		touch_glow = puzzles.glow_quad(self, TOUCH + Vector3(0, 0.0, 0.12), 2.0, Palette.ACCENT, 0.0)
		touch_her = puzzles.glow_quad(self, TOUCH + Vector3(0, -0.01, -0.12), 2.0, Palette.HER, 0.0)
		whisper_glow = puzzles.glow_quad(self, POOL_C + Vector3(0, 0.03, 0.05), 0.7, Palette.HER_CORE, 0.0)
	var pl := game.player
	var w := game.world
	var g := game
	var P := CINE_P
	var start_pos := pl.position
	var start_yaw := pl.yaw
	var yaw_n := 0.0                                      # facing the pool (north)
	her_xf = Transform3D(Basis(Vector3.UP, yaw_n), STAND)
	her_pose = Figure.Pose.new()
	var hp := her_pose
	var look := POOL_C + Vector3(0, 0.3, 0.55)
	var cam_yaw := PI                                      # from beyond the pool, looking back at you
	# -- prelude: the shrine wakes; you step to the water's edge
	c.at(0.0, func() -> void:
		her.visible = true
		her.set_hem(pl.fig.hem * 1.25)
		her.set_runes(0)
		her.set_veil_lift(0.0)
		her.set_param("vis", 0.0)
		mine.visible = false
		g.ui.hide_text())
	c.audio(0.0, "shrine_awaken")
	c.anim(0.0, 2.0, func(k: float) -> void: g.sfx.set_duck(k))
	c.anim(0.0, 1.8, func(k: float) -> void:
		pl.position = start_pos.lerp(STAND, k)
		pl.yaw = lerp_angle(start_yaw, yaw_n, k)
		pl.fig.rotation.y = pl.yaw)
	c.anim(0.3, 3.4, func(k: float) -> void: puzzles.set_shrine_awake(k, k))
	c.anim(0.3, 4.0, func(k: float) -> void: pl.fig.set_hem(lerpf(Game.HEM_PER_SHRINE[0], Game.HEM_PER_SHRINE[1], k)))
	c.cam(0.3, 4.2, POOL_C + Vector3(0, 1.0, 0.6), -PI * 0.25, -deg_to_rad(40.0), 6.2)
	# -- 0 (P): the music begins in near silence; the letterbox closes, the camera comes round
	c.audio(P, "cinematic_hand")
	c.anim(P - 0.5, 1.8, func(k: float) -> void: g.ui.set_letterbox(k))
	c.cam(P, 4.5, look, cam_yaw, -deg_to_rad(50.0), 3.8)
	# close shots: everything nearer the camera than the pool's far rim is cut away (the dome, the
	# columns), and the crystal rises out of the frame
	c.anim(P - 0.6, 0.6, func(k: float) -> void: w.cam.near = lerpf(1.0, World.DIST - 1.6, k), 0)
	c.anim(P - 0.5, 3.5, func(k: float) -> void:
		puzzles.crystal_lift = 2.4 * k
		puzzles.shrine_halo.set_shader_parameter("intensity", lerpf(0.8, 0.12, k))
		puzzles.shrine_pillar.set_shader_parameter("fade", lerpf(0.8, 0.15, k))
		puzzles.shrine_light.light_energy = lerpf(2.2, 0.7, k))
	c.anim(P, 7.0, func(_k: float) -> void:
		her_xf = Transform3D(Basis(Vector3.UP, pl.yaw), pl.position)
		var p2 := pl.fig.pose.copy()
		her_pose = p2
		_place(her, her_xf, p2), 0)
	c.anim(P + 0.5, 2.5, func(k: float) -> void: her.set_param("vis", k))
	c.anim(P + 2.5, 2.0, func(k: float) -> void: pl.head_pitch_add = 0.32 * k)
	# -- 7: she stops mimicking you: you glance aside; she does not
	c.audio(P + 6.6, "glimpse")
	c.anim(P + 6.5, 1.4, func(k: float) -> void: pl.head_yaw_add = 0.3 * k)
	c.anim(P + 7.0, 1.0, func(k: float) -> void:
		var p3 := pl.fig.pose.copy()
		p3.head_yaw -= 0.3                                 # her head stays on you
		her_pose = p3
		_place(her, her_xf, p3))
	c.anim(P + 9.0, 1.4, func(k: float) -> void: pl.head_yaw_add = 0.3 * (1.0 - k))
	# -- 8-16: the strings: she steps closer, kneels, lays her palm on the water from below
	var her_from := STAND
	var her_to := STAND + Vector3(0.0, 0.0, -0.42)
	c.anim(P + 8.0, 2.6, func(k: float) -> void:
		var p4 := her_pose.copy()
		p4.head_yaw = lerpf(p4.head_yaw, 0.0, k)
		p4.phase = k * TAU
		p4.ripple = sin(k * PI) * 0.6
		p4.body_y = absf(sin(k * TAU)) * 0.03
		her_pose = p4
		her_xf = Transform3D(Basis(Vector3.UP, yaw_n), her_from.lerp(her_to, k))
		_place(her, her_xf, p4))
	c.audio(P + 8.1, "cloth")
	c.anim(P + 10.8, 2.4, func(k: float) -> void:
		var p5 := her_pose.copy()
		p5.crouch = 0.55 * k
		p5.lean_x = -0.25 * k
		p5.head_pitch = 0.3 * k
		p5.reach = minf(1.0, k * 1.3)
		p5.breath = 0.0
		_place(her, her_xf, p5)
		hp.crouch = p5.crouch; hp.lean_x = p5.lean_x; hp.head_pitch = p5.head_pitch; hp.reach = p5.reach)
	c.at(P + 10.8, func() -> void: her_pose = hp)
	# you hesitate... then answer: your palm to hers
	c.anim(P + 12.0, 2.2, func(k: float) -> void:
		pl.crouch = 0.55 * k
		pl.head_pitch_add = lerpf(0.32, 0.45, k))
	c.anim(P + 14.2, 0.8, func(k: float) -> void: pl.extra_reach = 0.45 * k)
	c.anim(P + 15.4, 1.1, func(k: float) -> void: pl.extra_reach = lerpf(0.45, 1.0, k))
	# -- 16.5: touch: a ring spreads through the water; Katoptron lights on you both
	c.anim(P + 16.5, 5.0, func(k: float) -> void:
		puzzles_ring(k * 5.0)
		touch_glow.set_shader_parameter("intensity", sin(minf(k * 3.0, 1.0) * PI * 0.5) * (1.0 - k) * 2.0)
		touch_her.set_shader_parameter("intensity", sin(minf(k * 2.6, 1.0) * PI * 0.5) * (1.0 - k) * 1.9), 0)
	c.at(P + 16.7, func() -> void:
		pl.fig.set_runes(1)
		her.set_runes(1))
	c.anim(P + 16.7, 2.5, func(k: float) -> void:
		var f := 1.0 + sin(k * PI) * 2.5
		pl.fig.set_param("glint", Game.HEM_PER_SHRINE[1] * f)
		her.set_param("glint", Game.HEM_PER_SHRINE[1] * 1.25 * f))
	# -- 23-30: her voice sings the motif; the camera draws in, slowly
	c.cam(P + 22.0, 7.5, POOL_C + Vector3(0, 0.2, 0.45), cam_yaw, -deg_to_rad(54.0), 2.7)
	# -- 30-37.6: her veil lifts: under it, the same unfinished marble face as yours
	c.anim(P + 30.0, 3.2, func(k: float) -> void: her.set_veil_lift(k))
	# -- 37.6: the whisper: her lips, that are not there, say something; the music stops
	c.anim(P + 37.6, 2.8, func(k: float) -> void:
		whisper_glow.set_shader_parameter("intensity", sin(k * PI) * (0.35 + 0.15 * sin(k * TAU * 3.0))))
	c.anim(P + 40.0, 1.4, func(k: float) -> void: her.set_veil_lift(1.0 - k))
	# -- 41-59: she rises, turns, and walks away into the world of reflections
	c.anim(P + 41.0, 1.8, func(k: float) -> void:
		var p6 := hp.copy()
		p6.crouch = 0.55 * (1.0 - k)
		p6.lean_x = -0.25 * (1.0 - k)
		p6.reach = 1.0 - k
		p6.head_pitch = 0.3 * (1.0 - k)
		_place(her, her_xf, p6))
	c.anim(P + 41.2, 1.6, func(k: float) -> void:
		pl.extra_reach = 1.0 - k
		pl.head_pitch_add = lerpf(0.45, 0.25, k))
	c.anim(P + 42.8, 1.2, func(k: float) -> void:
		var p7 := Figure.Pose.new()
		her_xf = Transform3D(Basis(Vector3.UP, yaw_n + PI * k), her_to)
		_place(her, her_xf, p7))
	c.anim(P + 44.0, 5.0, func(k: float) -> void:
		var p8 := Figure.Pose.new()
		p8.phase = k * 5.0 * 6.0
		p8.ripple = 0.8
		p8.body_y = absf(sin(p8.phase)) * 0.03
		p8.lean_x = -0.08
		her_xf = Transform3D(Basis(Vector3.UP, yaw_n + PI), her_to.lerp(her_to + Vector3(0, 0, 2.6), k))
		_place(her, her_xf, p8)
		her.set_param("vis", 1.0 - smoothstep(0.35, 1.0, k)), 0)
	# the pool goes quiet and shows only you
	c.at(P + 48.4, func() -> void:
		her.visible = false
		mine.visible = true
		mine.set_hem(pl.fig.hem)
		mine.set_runes(1))
	c.at(P + 51.1, func() -> void: mine.visible = false)
	c.anim(P + 48.4, 2.6, func(k: float) -> void:
		mine.set_param("vis", minf(k * 2.5, 1.0) * (1.0 - smoothstep(0.75, 1.0, k)) * 0.8)
		_place(mine, Transform3D(Basis(Vector3.UP, pl.yaw), pl.position), pl.fig.pose), 0)
	c.anim(P + 48.0, 2.5, func(k: float) -> void:
		pl.crouch = 0.55 * (1.0 - k)
		pl.head_pitch_add = 0.25 * (1.0 - k))
	c.anim(P + 48.0, 3.0, func(k: float) -> void: shrine_over.set_shader_parameter("calm", lerpf(0.6, 1.0, k)))
	# the fog draws back; far away the second shrine glows; the memory; I / VII
	c.cam(P + 49.0, 5.5, Level.SECOND_SHRINE.lerp(STAND, 0.62) + Vector3(0, 1.0, 0), -PI * 0.25, -World.PITCH, 13.0)
	c.anim(P + 49.0, 0.8, func(k: float) -> void: w.cam.near = lerpf(World.DIST - 1.6, 1.0, k), 0)
	c.anim(P + 49.0, 4.0, func(k: float) -> void:
		puzzles.crystal_lift = 2.4 * (1.0 - k)
		puzzles.shrine_halo.set_shader_parameter("intensity", lerpf(0.12, 0.8, k))
		puzzles.shrine_pillar.set_shader_parameter("fade", lerpf(0.15, 0.8, k))
		puzzles.shrine_light.light_energy = lerpf(0.7, 2.2, k))
	c.anim(P + 49.0, 7.0, func(k: float) -> void: w.set_awaken(k))
	c.anim(P + 50.0, 4.0, func(k: float) -> void: puzzles.far_pillar.set_shader_parameter("fade", lerpf(0.35, 0.6, k)))
	c.at(P + 49.5, func() -> void: g.ui.show_memory(Game.MEMORY_LINE, 3.0), true)      # (QA P1-9: kept on a skip)
	c.at(P + 57.0, func() -> void:
		g.ui.show_milestone(1, Game.SHRINES_TOTAL, 3.5)
		g.sfx.play("bell_far", -12.0, 1.0))
	# back to you as the last chord fades
	c.cam(P + 56.0, 3.2, STAND + Vector3(0, 0.6, 0), -PI * 0.25, -World.PITCH, w.zoom)
	c.anim(P + 57.2, 2.0, func(k: float) -> void:
		g.ui.set_letterbox(1.0 - k)
		g.sfx.set_duck(1.0 - k))
	c.at(P + 59.3, func() -> void:
		g.sfx.set_duck(0.0)
		g.sfx.stop_cue("cinematic_hand", 1.5)
		g.sfx.stop_cue("shrine_awaken", 0.5)
		mine.visible = false
		her.visible = false
		touch_glow.set_shader_parameter("intensity", 0.0)
		touch_her.set_shader_parameter("intensity", 0.0)
		whisper_glow.set_shader_parameter("intensity", 0.0)
		pl.fig.set_param("glint", Game.HEM_PER_SHRINE[1])
		pl.fig.set_hem(Game.HEM_PER_SHRINE[1])
		pl.extra_reach = 0.0
		pl.head_pitch_add = 0.0
		pl.head_yaw_add = 0.0
		pl.crouch = 0.0
		w.set_awaken(1.0)
		w.cam.near = 1.0
		puzzles.crystal_lift = 0.0
		puzzles.set_shrine_awake(1.0, 1.0))

func puzzles_ring(sec: float) -> void:
	shrine_over.set_shader_parameter("ring_c", TOUCH)
	shrine_over.set_shader_parameter("ring_t", sec if sec < 4.99 else -1.0)
