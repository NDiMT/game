class_name OurSteps
extends Node3D
## "Our Steps" (v1.1): rebuilt on the rules of the earlier EIDOLON puzzle game (/home/user/game/eidolon,
## scripts/rules.gd, levels/02.json and 03.json). One flat board of slabs, fully visible, a line of glass
## standing down its middle: you on the left half, your Eidolon (her, in crimson) on the right.
##  * a step along the glass line (up / down on the screen) is the same step for her; a step across it
##    (left / right) is mirrored for her: you go right, she goes left.
##  * columns (#) stop only the body that walks into them: you step, she is held (or the other way), and the
##    two of you drift apart. Neither of you crosses the glass. A step that moves neither of you is no step.
##  * the goal: you on your glyph and her on hers. Two boards in a row ("The Column", then "Two Stones");
##    the second opens when the first is answered, and the gate when the second is.
## She is not there until you step onto the board (through the gap in the kerb at its near left corner);
## stepping off where you came on always works, and the stone by you resets the board.
## Grid: x 0..W-1 along the screen's right (U), row z 0..H-1 from the far edge down toward the camera (-V).

const BOARDS := [
	{"title": "The Column", "par": 4, "map": [".G.a#.", "P....A", "......"]},
	{"title": "Two Stones", "par": 6, "map": [".G....", ".#....", "P..a.A", "....#."]},
]
const MIRROR_X := 3                  # the glass stands between columns 2 and 3
const W := 6
const TILE := 0.86
const GC := Vector3(23.1, 1.0, -11.6)                     # the board's frame origin (the old glass foot)
const U := Vector3(0.70710678, 0.0, 0.70710678)           # screen right
const V := Vector3(0.70710678, 0.0, -0.70710678)          # screen up (away from the camera)
const EDGE_V := -3.74                # the board's near edge (toward the camera)
const FAR_V := -0.3                  # its far edge
const FLOOR_Y := 1.0
const DIRS := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
const GLASS_H := 1.35

# ------------------------------------------------------------------ the rules (pure, static)
## a board parsed: {w, h, floor: {Vector2i: true}, cols: [Vector2i], P, G, A, a}
static func board(i: int) -> Dictionary:
	var rows: Array = BOARDS[i]["map"]
	var b := {"w": W, "h": rows.size(), "floor": {}, "cols": [], "title": BOARDS[i]["title"], "par": BOARDS[i]["par"]}
	for z in rows.size():
		var row: String = rows[z]
		for x in row.length():
			var c := Vector2i(x, z)
			var ch := row[x]
			if ch == "#":
				(b["cols"] as Array).append(c)
				continue
			b["floor"][c] = true
			if ch in ["P", "G", "A", "a"]: b[ch] = c
	return b

static func her_dir(d: Vector2i) -> Vector2i:
	return Vector2i(-d.x, d.y)

static func _free(b: Dictionary, a: Vector2i, t: Vector2i) -> bool:
	if not (b["floor"] as Dictionary).has(t): return false
	return (a.x < MIRROR_X) == (t.x < MIRROR_X)           # (never across the glass)

## one step d from (you, her): the new [you, her], "exit", or [] (nothing moves: no step)
static func step(b: Dictionary, p: Vector2i, h: Vector2i, d: Vector2i) -> Variant:
	if d == Vector2i(0, 1) and p == entry(b): return "exit"
	var np := p + d if _free(b, p, p + d) else p
	var nh := h + her_dir(d) if _free(b, h, h + her_dir(d)) else h
	if np == p and nh == h: return []
	return [np, nh]

## where you step on and off: the near-left corner slab
static func entry(b: Dictionary) -> Vector2i:
	return Vector2i(0, int(b["h"]) - 1)

## (tests) BFS from the board's start: the shortest solution, how many shortest ones, states, and whether
## every reachable state can still leave the board
static func solve(i := 0) -> Dictionary:
	var b := board(i)
	var start := [b["P"], b["A"]]
	var key := func(s: Array) -> String: return "%s|%s" % [s[0], s[1]]
	var dist := {key.call(start): 0}
	var ways := {key.call(start): 1}
	var par := {}
	var states := {key.call(start): start}
	var q := [start]
	var qi := 0
	while qi < q.size():
		var s: Array = q[qi]; qi += 1
		var ks: String = key.call(s)
		for d in DIRS:
			var t = step(b, s[0], s[1], d)
			if t is String or (t as Array).is_empty(): continue
			var kt: String = key.call(t)
			if not dist.has(kt):
				dist[kt] = dist[ks] + 1; ways[kt] = ways[ks]; par[kt] = [ks, d]; states[kt] = t; q.append(t)
			elif dist[kt] == dist[ks] + 1:
				ways[kt] += ways[ks]
	var goal: String = key.call([b["G"], b["a"]])
	var path := []
	if dist.has(goal):
		var k := goal
		while par.has(k):
			path.push_front(par[k][1])
			k = par[k][0]
	return {"length": dist.get(goal, -1), "ways": ways.get(goal, 0), "path": path, "states": states.size()}

# ------------------------------------------------------------------ the frame
static func at(u: float, v: float) -> Vector3:
	return GC + U * u + V * v

## slab c of a board with h rows (rows anchored at the near edge)
static func cell(c: Vector2i, h: int) -> Vector3:
	return at((float(c.x) - (W - 1) * 0.5) * TILE, EDGE_V + TILE * (float(h - c.y) - 0.5))

static func local(p: Vector3) -> Vector2:
	return Vector2((p - GC).dot(U), (p - GC).dot(V))

static func dir_world(d: Vector2i) -> Vector3:
	return U * float(d.x) - V * float(d.y)

## the camera's lean on and before the board: the whole board on the screen
static func lean(p: Vector3) -> Vector3:
	var l := local(p)
	if l.y < -7.5 or l.y > 0.5 or absf(l.x) > 5.0 or absf(p.y - FLOOR_Y) > 0.3: return Vector3.ZERO
	var k := clampf((l.y + 7.5) / 2.5, 0.0, 1.0)
	var off := (at(0.0, -2.2) - p) * k
	off.y = 0.0
	return off

# ------------------------------------------------------------------ in the world
var game: Game
var chapter: Chapter
var bi := 0                          # the board in play (0, then 1)
var b: Dictionary
var active := false
var p := Vector2i.ZERO
var h := Vector2i.ZERO
var her: Figure
var her_pos := Vector3.ZERO
var _her_from := Vector3.ZERO
var _her_to := Vector3.ZERO
var _her_t := 1.0
var _her_vis := 0.0
var moving := false
var _cool := 0.0
var _leaving := false
var _between := 0.0                  # > 0: the first board answered, the second rising
var _bump := Vector3.INF
var _last_dir := Vector2i.ZERO
var plate_y: Array[ShaderMaterial] = []
var plate_h: Array[ShaderMaterial] = []
var cols: Array[Node3D] = []         # per board: its columns
var glyphs: Array[Node3D] = []       # per board: its two glyphs
var _pose := Figure.Pose.new()
var _phase := 0.0
var moves := 0                       # (tests) steps taken on this board
var blocked_n := 0                   # (tests) refused steps
var boards_done := 0

func tile(c: Vector2i) -> Vector3:
	return cell(c, int(b["h"]))

func goal_her_world() -> Vector3:
	return tile(b["a"])

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	b = board(0)
	_build_board()
	for i in BOARDS.size(): _build_pieces(i)
	her = Figure.new(preload("res://shaders/ghost.gdshader"))
	her.set_param("project", 0.0)
	her.set_param("vis", 0.0)
	her.visible = false
	add_child(her)
	level_reset()

## the slabs (the larger board's 6 x 4), the kerb round them with its gap, the glass line down the middle
func _build_board() -> void:
	var B := Basis(Vector3.UP, -PI * 0.25)
	var m := MB.new()
	m.tag = "floor"
	for x in W:
		for z in 4:
			m.box(cell(Vector2i(x, z), 4) + Vector3(0, 0.016 - 0.2, 0), Vector3(TILE - 0.05, 0.4, TILE - 0.05), Color(0.5, 0.25, 0.0), B)
	m.tag = ""
	var hw := TILE * W * 0.5 + 0.1
	var kerb := func(a: Vector2, c: Vector2) -> void:
		var pa := at(a.x, a.y)
		var pc := at(c.x, c.y)
		var mc := (pa + pc) * 0.5
		m.box(Vector3(mc.x, FLOOR_Y + 0.11, mc.z), Vector3(maxf(pa.distance_to(pc), 0.2), 0.22, 0.2), Color(0.5, 0.25, 0.0), B if absf((c - a).y) < 0.01 else B * Basis(Vector3.UP, PI * 0.5))
		var n := int(ceil(pa.distance_to(pc) / 0.25))
		for i in n + 1:
			var q := pa.lerp(pc, float(i) / float(maxi(n, 1)))
			game.level.ob_circle(Vector2(q.x, q.z), 0.13)
	var ev := EDGE_V - 0.1
	var fv := FAR_V + 0.1
	kerb.call(Vector2(-hw + TILE + 0.22, ev), Vector2(hw, ev))     # (the near edge, but the gap at the entry: wide enough to pass)
	kerb.call(Vector2(-hw, fv), Vector2(hw, fv))
	kerb.call(Vector2(-hw, ev), Vector2(-hw, fv))
	kerb.call(Vector2(hw, ev), Vector2(hw, fv))
	# the glass line's sill and cap (marble), its posts at both ends
	var gl := (FAR_V - EDGE_V)
	var gmid := at(0.0, (EDGE_V + FAR_V) * 0.5)
	m.box(gmid + Vector3(0, 0.035, 0), Vector3(0.1, 0.07, gl), Color(0.5, 0.25, 0.0), B)
	m.box(gmid + Vector3(0, GLASS_H + 0.05, 0), Vector3(0.12, 0.1, gl + 0.1), Color(0.5, 0.25, 0.0), B)
	for v in [EDGE_V + 0.05, FAR_V - 0.05]:
		m.box(at(0.0, v) + Vector3(0, GLASS_H * 0.5 + 0.03, 0), Vector3(0.12, GLASS_H, 0.12), Color(0.5, 0.25, 0.0), B)
	game.puzzles.marble_instance(m.commit(), self)
	# the glass itself: clear, a faint silver sheen
	var gm := StandardMaterial3D.new()
	gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	gm.albedo_color = Color(0.72, 0.78, 0.82, 0.16)
	gm.metallic = 0.6
	gm.roughness = 0.08
	gm.cull_mode = BaseMaterial3D.CULL_DISABLED
	var q := QuadMesh.new()
	q.size = Vector2(gl - 0.14, GLASS_H - 0.06)
	var gi := MeshInstance3D.new()
	gi.mesh = q
	gi.material_override = gm
	gi.transform = Transform3D(B * Basis(Vector3.UP, PI * 0.5), gmid + Vector3(0, GLASS_H * 0.5 + 0.04, 0))
	gi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	gi.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(gi)

## a board's columns (broken drums) and its two glyphs (yours, hers)
func _build_pieces(i: int) -> void:
	var bd := board(i)
	var hh: int = bd["h"]
	var cn := Node3D.new()
	add_child(cn)
	var m := MB.new()
	for c in bd["cols"]:
		var t := cell(c, hh)
		m.cyl(t + Vector3(0, 0.016 + 0.45, 0), 0.3, 0.33, 0.9, Color(0.5, 0.25, 0.0), 12, Basis(Vector3.UP, 0.4 * float(c.x + c.y)))
	game.puzzles.marble_instance(m.commit(), cn)
	cols.append(cn)
	var gn := Node3D.new()
	add_child(gn)
	plate_y.append(game.puzzles.rune_quad(gn, cell(bd["G"], hh) + Vector3(0, 0.03, 0), Vector2(0.72, 0.72), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.3))
	plate_h.append(game.puzzles.rune_quad(gn, cell(bd["a"], hh) + Vector3(0, 0.03, 0), Vector2(0.72, 0.72), Basis(Vector3.RIGHT, -PI * 0.5), 7.0, 0.3))
	glyphs.append(gn)

func _show_board(i: int, instant := true) -> void:
	bi = i
	b = board(i)
	for k in cols.size():
		var on := k == i
		if instant:
			cols[k].visible = on
			cols[k].position.y = 0.0
			glyphs[k].visible = on
		else:
			glyphs[k].visible = on
			if on:
				cols[k].visible = true
				cols[k].position.y = -1.0
				cols[k].create_tween().tween_property(cols[k], "position:y", 0.0, 1.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
			elif cols[k].visible:
				var cn := cols[k]
				var tw := cn.create_tween()
				tw.tween_property(cn, "position:y", -1.0, 0.9).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
				tw.tween_callback(func() -> void: cn.visible = false)

func level_reset() -> void:
	active = false
	moving = false
	_leaving = false
	_bump = Vector3.INF
	_between = 0.0
	_show_board(0 if not solved() else BOARDS.size() - 1)
	boards_done = BOARDS.size() if solved() else 0
	p = b["P"]
	h = b["A"]
	her_pos = tile(h)
	_her_to = her_pos
	_her_t = 1.0
	_her_vis = 0.0
	her.visible = false
	_lights()

func solved() -> bool:
	return bool(chapter.state["hollow_done"])

func _lights() -> void:
	for k in plate_y.size():
		var mine := k == bi
		plate_y[k].set_shader_parameter("lit", 1.0 if (solved() or (mine and active and p == b["G"])) else 0.3)
		plate_h[k].set_shader_parameter("lit", 1.0 if (solved() or (mine and active and h == b["a"])) else 0.3)

## the stick, as a direction on the ground (world xz): one step along the nearest grid direction (the grid
## lies square to the screen); a diagonal push keeps the way you last stepped (no flicker between two ways)
func input(world_dir: Vector3) -> void:
	if not active or moving or _cool > 0.0 or _between > 0.0: return
	if world_dir.length() < 0.45: return
	var wd := world_dir.normalized()
	var best := Vector2i.ZERO
	var bd := -2.0
	for d in DIRS:
		var k: float = dir_world(d).dot(wd)
		if k > bd: bd = k; best = d
	if _last_dir != Vector2i.ZERO and best != _last_dir and dir_world(_last_dir).dot(wd) > bd - 0.2: best = _last_dir
	try_step(best)

func try_step(d: Vector2i) -> bool:
	if not active: return false
	var t = step(b, p, h, d)
	_last_dir = d
	if t is String:
		# off the board where you came on: she fades; the board waits as it was left
		active = false
		_leaving = true
		moving = true
		game.auto_target = tile(entry(b)) - V * 1.0
		chapter.event.emit("steps_exit", null)
		_lights()
		return true
	if (t as Array).is_empty():
		blocked_n += 1
		_cool = 0.3
		moving = true
		_bump = tile(p)
		game.auto_target = tile(p) + dir_world(d) * 0.14
		chapter.event.emit("steps_blocked", null)
		return false
	var held: bool = (t[1] as Vector2i) == h or (t[0] as Vector2i) == p
	p = t[0]
	h = t[1]
	moves += 1
	moving = true
	game.auto_target = tile(p)
	_her_slide(tile(h))
	chapter.event.emit("steps_step", held)
	return true

func _her_slide(to: Vector3) -> void:
	_her_from = her_pos
	_her_to = to
	_her_t = 0.0 if not _her_from.is_equal_approx(to) else 1.0

## the stone by you: both of you back where this board starts
func reset() -> void:
	if not active: return
	p = b["P"]
	h = b["A"]
	game.player.teleport(tile(p), game.player.yaw)
	game.auto_target = Vector3.INF
	her_pos = tile(h)
	_her_to = her_pos
	_her_t = 1.0
	moving = false
	_bump = Vector3.INF
	moves = 0
	chapter.event.emit("steps_reset", null)
	_lights()

func _on_board(pp: Vector3) -> bool:
	var l := local(pp)
	return l.y > EDGE_V and l.y < FAR_V and absf(l.x) < TILE * W * 0.5 and absf(pp.y - FLOOR_Y) < 0.2

func update(dt: float) -> void:
	_cool = maxf(0.0, _cool - dt)
	var pl := game.player
	var pp := pl.position
	# on: through the gap onto the entry slab; then to this board's start
	if not active and not _leaving and not solved() and game.mode == "play" and _on_board(pp):
		active = true
		p = b["P"]
		h = b["A"]
		moves = 0
		_last_dir = Vector2i.ZERO
		her_pos = tile(h)
		_her_to = her_pos
		_her_t = 1.0
		game.auto_target = tile(p)
		moving = true
		chapter.event.emit("steps_on", null)
	if _leaving and (game.auto_target == Vector3.INF or local(pp).y < EDGE_V - 0.3):
		_leaving = false
		moving = false
	if moving and active and game.auto_target == Vector3.INF:
		if _bump != Vector3.INF:
			game.auto_target = _bump
			_bump = Vector3.INF
		else:
			moving = false
			_lights()
			if p == b["G"] and h == b["a"] and not solved() and _between <= 0.0:
				boards_done = bi + 1
				if bi + 1 < BOARDS.size():
					# the first board answered: its columns sink, the next one's rise; you and she go to its start
					chapter.event.emit("steps_board", bi)
					_between = 1.6
				else:
					active = false
					chapter.steps_solved()
	if _between > 0.0:
		_between -= dt
		if _between <= 0.0:
			_show_board(bi + 1, false)
			p = b["P"]
			h = b["A"]
			moves = 0
			game.player.teleport(tile(p), game.player.yaw)        # (both of you at the new board's start)
			game.auto_target = Vector3.INF
			moving = false
			her_pos = tile(h)
			_her_to = her_pos
			_her_t = 1.0
			_lights()
	# her, sliding to her slab (with your pace); she is there only while you are on the board
	if _her_t < 1.0:
		_her_t = minf(1.0, _her_t + dt / 0.55)
		her_pos = _her_from.lerp(_her_to, smoothstep(0.0, 1.0, _her_t))
	_her_vis = move_toward(_her_vis, 1.0 if (active or _between > 0.0) else 0.0, dt * 1.5)
	her.visible = _her_vis > 0.01
	if her.visible:
		her.set_param("vis", _her_vis)
		var walking := _her_t < 1.0
		_phase += dt * (1.5 + 6.2 * (0.8 if walking else 0.0))
		var ps: Figure.Pose = pl.fig.pose
		_pose.breath = ps.breath
		_pose.head_yaw = -ps.head_yaw
		_pose.ripple = 0.75 if walking else ps.ripple * 0.5
		_pose.phase = _phase if walking else ps.phase
		_pose.body_y = absf(sin(_phase)) * 0.03 if walking else ps.body_y
		her.apply_pose(_pose)
		# she faces as your mirror image across the glass line
		var f := -pl.fig.global_transform.basis.z
		f = f - 2.0 * f.dot(U) * U
		her.global_position = her_pos + Vector3(0, pl.fig.global_position.y - pp.y, 0)
		her.rotation.y = atan2(-f.x, -f.z)
	# the reset stone's interact follows you on the board
	var ri := game.level.interact_by_id("steps_reset")
	if ri: ri.pos = pp if active else Vector3(0, -99, 0)
