class_name OurSteps
extends Node3D
## "Our Steps" (v1.1d): the LOOK of v1.0 (a big real planar MIRROR, about 6 x 3.5 m, straight across the screen,
## her room only in the glass) with the RULES of the earlier EIDOLON game's boards (levels/02 "The Column",
## levels/03 "Two Stones"). Your floor is a small board before the glass (4 slabs along it, 3 toward it). In the
## glass, her board is your floor's true reflection, but not the same: her column and her glyph exist only there
## (twins on the reflection-only layer). Her crimson figure stands in the reflection.
##  * the figure in the glass moves as a reflection: along the glass the same way as you; toward the glass, she
##    comes toward the glass too.
##  * a column stops only the one who walks into it: yours stops you, hers (only in the glass) stops her; so the
##    two of you drift apart, and back.
##  * the goal: you on your glyph (on your floor), her on hers (in the glass). Two boards, one after the other.
## Before you step on, the glass is only a mirror: you, as you are. Stepping off where you came on always works;
## the reset stone by the board starts the board over. After a minute with no progress, a faint light on your
## floor shows the next step.
## Grid: c 0..C-1 along the glass (screen right), r 0..R-1 toward it (screen up; r = 0 is the near edge).
## The old boards map as c = their row, r = their column (yours x 0..2; hers x 3..5 mirrored to 5 - x).

const BOARDS := [
	{"title": "The Column", "par": 4, "map": [".G.a#.", "P....A", "......", "......"]},
	{"title": "Two Stones", "par": 6, "map": [".G....", ".#....", "P..a.A", "....#."]},
]
const C := 4
const R := 3
const TILE := 1.15
const GAP := 0.3                     # from the glass to the nearest row's edge
const GC := Vector3(23.1, 1.0, -11.6)                     # the glass's foot, mid-way
const U := Vector3(0.70710678, 0.0, 0.70710678)           # along the glass (screen right)
const V := Vector3(0.70710678, 0.0, -0.70710678)          # toward the glass, from your side (screen up)
const EDGE_V := -(GAP + R * TILE)    # your floor's near edge (where you step on and off)
const GLASS_HALF := 3.0
const GLASS_H := 3.5
const FLOOR_Y := 1.0
const DIRS := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
const ENTRY_COLS := [1, 2]           # the gap in the near kerb (stepping off there always works)
const HINT_AFTER := 60.0

# ------------------------------------------------------------------ the rules (pure, static)
## a board: {P, G, A, a (her start / glyph as twins on your floor), you_cols, her_cols, title, par}
static func board(i: int) -> Dictionary:
	var rows: Array = BOARDS[i]["map"]
	var b := {"you_cols": [], "her_cols": [], "title": BOARDS[i]["title"], "par": BOARDS[i]["par"]}
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var ch := row[x]
			var mine := x < 3
			var c := Vector2i(y, x if mine else 5 - x)
			match ch:
				"#": (b["you_cols"] if mine else b["her_cols"]).append(c)
				"P": b["P"] = c
				"G": b["G"] = c
				"A": b["A"] = c
				"a": b["a"] = c
	return b

static func inb(c: Vector2i) -> bool:
	return c.x >= 0 and c.x < C and c.y >= 0 and c.y < R

## one step d from (you, her twin): the new [you, her], "exit", or [] (nothing moves: no step)
static func step(b: Dictionary, p: Vector2i, h: Vector2i, d: Vector2i) -> Variant:
	if d == Vector2i(0, -1) and p.y == 0 and p.x in ENTRY_COLS: return "exit"
	var np := p + d
	if not inb(np) or np in (b["you_cols"] as Array): np = p
	var nh := h + d
	if not inb(nh) or nh in (b["her_cols"] as Array): nh = h
	if np == p and nh == h: return []
	return [np, nh]

## (tests, hints) BFS from (p, h) to the goal: the shortest path's moves
static func solve(i := 0, from_p := Vector2i(-1, -1), from_h := Vector2i(-1, -1)) -> Dictionary:
	var b := board(i)
	var start := [b["P"] if from_p.x < 0 else from_p, b["A"] if from_h.x < 0 else from_h]
	var key := func(s: Array) -> String: return "%s|%s" % [s[0], s[1]]
	var dist := {key.call(start): 0}
	var par := {}
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
				dist[kt] = dist[ks] + 1; par[kt] = [ks, d]; q.append(t)
	var goal: String = key.call([b["G"], b["a"]])
	var path := []
	if dist.has(goal):
		var k := goal
		while par.has(k):
			path.push_front(par[k][1])
			k = par[k][0]
	return {"length": dist.get(goal, -1), "path": path, "states": dist.size()}

# ------------------------------------------------------------------ the frame
static func uv(c: Vector2i) -> Vector2:
	return Vector2((float(c.x) - (C - 1) * 0.5) * TILE, -(GAP + TILE * 0.5 + (R - 1 - c.y) * TILE))

static func at(u: float, v: float) -> Vector3:
	return GC + U * u + V * v

static func tile(c: Vector2i) -> Vector3:
	var q := uv(c)
	return at(q.x, q.y)

## where the glass shows twin slab c (behind it)
static func her_tile(c: Vector2i) -> Vector3:
	var q := uv(c)
	return at(q.x, -q.y)

static func plane_n() -> Vector3:
	return -V

static func plane_d() -> float:
	return plane_n().dot(GC)

static func local(p: Vector3) -> Vector2:
	return Vector2((p - GC).dot(U), (p - GC).dot(V))

## the camera's lean on and before the floor: the floor and the glass whole on the screen
static func lean(p: Vector3) -> Vector3:
	var l := local(p)
	if l.y < -7.5 or l.y > 0.5 or absf(l.x) > 5.0 or absf(p.y - FLOOR_Y) > 0.3: return Vector3.ZERO
	var k := clampf((l.y + 7.5) / 2.5, 0.0, 1.0)
	var off := (at(0.0, -1.3) - p) * k
	off.y = 0.0
	return off

static func dir_world(d: Vector2i) -> Vector3:
	return U * float(d.x) + V * float(d.y)

# ------------------------------------------------------------------ in the world
var game: Game
var chapter: Chapter
var bi := 0
var b: Dictionary
var active := false
var p := Vector2i.ZERO
var h := Vector2i.ZERO
var refl: Reflector
var mirror_mat: ShaderMaterial
var her_pos := Vector3.ZERO          # where her twin stands on YOUR floor (the glass shows it reflected)
var _her_from := Vector3.ZERO
var _her_to := Vector3.ZERO
var _her_t := 1.0
var moving := false
var _cool := 0.0
var _leaving := false
var _between := 0.0
var _bump := Vector3.INF
var _last_dir := Vector2i.ZERO
var _drag_serial := -1
var plate_y: Array[ShaderMaterial] = []
var plate_h: Array[ShaderMaterial] = []
var pieces: Array[Node3D] = []       # per board: its columns and glyphs
var hint_mat: ShaderMaterial
var reset_rune: ShaderMaterial
var hint_node: Node3D
var _idle := 0.0
var _flare := 0.0
var _pose := Figure.Pose.new()
var _phase := 0.0
var moves := 0                       # (tests) steps taken on this board
var blocked_n := 0                   # (tests) refused steps
var boards_done := 0

func goal_her_world() -> Vector3:
	return her_tile(b["a"])

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	b = board(0)
	var B := Basis(Vector3.UP, -PI * 0.25)          # (local x along the glass, local +z toward you)
	# the mirror: a tall planar glass, a real reflection
	var center := at(0.0, 0.0) + Vector3(0, GLASS_H * 0.5 + 0.05, 0)
	mirror_mat = game.puzzles._mirror_quad(center, B, Vector2(GLASS_HALF * 2.0, GLASS_H), false, 1.0)
	mirror_mat.set_shader_parameter("ncols", 0)
	mirror_mat.set_shader_parameter("floor_y", FLOOR_Y)
	var pm := PlanarMirror.new()
	add_child(pm)
	pm.setup(plane_n(), plane_d(), mirror_mat, game.world.env)
	refl = Reflector.new()
	refl.kind = "mirror"; refl.plane_n = plane_n(); refl.plane_d = plane_d() + 0.01
	refl.clip_c = center; refl.clip_u = U; refl.clip_v = Vector3.UP; refl.clip_h = Vector2(GLASS_HALF, GLASS_H * 0.5)
	refl.region = Level.R(17.5, -15.0, 25.5, -6.0)
	refl.planar = pm
	refl.hold = false
	game.puzzles._add_refl(refl)
	for i in BOARDS.size(): _build_pieces(i, B)
	# the reset stone, plain to see by the floor's near right corner (its button works anywhere on the floor)
	var rs := MB.new()
	var rp := at(TILE * C * 0.5 + 0.55, EDGE_V - 0.45)
	rs.cyl(rp + Vector3(0, 0.3, 0), 0.24, 0.3, 0.6, Color(0.5, 0.25, 0.0), 10)
	game.puzzles.marble_instance(rs.commit(), self)
	reset_rune = game.puzzles.rune_quad(self, rp + Vector3(0, 0.62, 0), Vector2(0.36, 0.36), Basis(Vector3.RIGHT, -PI * 0.5), 1.0, 0.4)
	game.level.ob_circle(Vector2(rp.x, rp.z), 0.32)
	# the next-step hint: a faint light on your floor (after a minute with no progress)
	hint_node = Node3D.new()
	add_child(hint_node)
	hint_mat = game.puzzles.glow_quad(hint_node, Vector3.ZERO, 0.9, Palette.ACCENT, 0.0)
	_last_child_of(hint_node).layers = PlanarMirror.LAYER_MAIN_FX
	level_reset()

func _last_child() -> MeshInstance3D:
	return get_child(get_child_count() - 1) as MeshInstance3D

func _last_child_of(n: Node) -> MeshInstance3D:
	return n.get_child(n.get_child_count() - 1) as MeshInstance3D

## a board's pieces: your column(s) (real, on your floor), her column(s) and her glyph (twins on the
## reflection-only layer: they stand where the glass shows them from), your glyph (real)
func _build_pieces(i: int, B: Basis) -> void:
	var bd := board(i)
	var n := Node3D.new()
	add_child(n)
	var flip := Basis(Vector3.RIGHT, -PI * 0.5)
	plate_y.append(game.puzzles.rune_quad(n, tile(bd["G"]) + Vector3(0, 0.03, 0), Vector2(0.95, 0.95), flip, 3.0, 0.45))
	_last_child_of(n).layers = PlanarMirror.LAYER_MAIN_FX
	plate_h.append(game.puzzles.rune_quad(n, tile(bd["a"]) + Vector3(0, 0.03, 0), Vector2(0.95, 0.95), flip, 7.0, 0.45))
	_last_child_of(n).layers = PlanarMirror.LAYER_DOUBLE
	var mine := MB.new()
	for c in bd["you_cols"]:
		mine.cyl(tile(c) + Vector3(0, 0.016 + 0.45, 0), 0.36, 0.4, 0.9, Color(0.5, 0.25, 0.0), 12, Basis(Vector3.UP, 0.5 * float(c.x)))
	if not (bd["you_cols"] as Array).is_empty(): game.puzzles.marble_instance(mine.commit(), n)
	var hers := MB.new()
	for c in bd["her_cols"]:
		hers.cyl(tile(c) + Vector3(0, 0.016 + 0.45, 0), 0.36, 0.4, 0.9, Color(0.5, 0.25, 0.0), 12, Basis(Vector3.UP, 0.7 * float(c.x + 1)))
	if not (bd["her_cols"] as Array).is_empty():
		var hm := game.puzzles.marble_instance(hers.commit(), n)
		hm.layers = PlanarMirror.LAYER_DOUBLE
	pieces.append(n)

func _show_board(i: int, instant := true) -> void:
	bi = i
	b = board(i)
	for k in pieces.size():
		var on := k == i
		if instant or not on:
			pieces[k].visible = on
			pieces[k].position.y = 0.0
		else:
			pieces[k].visible = true
			pieces[k].position.y = -1.0
			pieces[k].create_tween().tween_property(pieces[k], "position:y", 0.0, 1.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)

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
	refl.hold = false
	_lights()

func solved() -> bool:
	return bool(chapter.state["hollow_done"])

func _lights() -> void:
	for k in plate_y.size():
		var mine := k == bi
		var fl := _flare
		plate_y[k].set_shader_parameter("lit", maxf(fl, 1.0 if (solved() or (mine and active and p == b["G"])) else 0.45))
		plate_h[k].set_shader_parameter("lit", maxf(fl, 1.0 if (solved() or (mine and active and h == b["a"])) else 0.45))

## the stick, as a direction on the ground (world xz): one step along the nearest grid direction (the grid
## lies square to the screen). A generous deadzone, a snap to the nearest way (a diagonal keeps the way you
## last stepped); held, it repeats one step at a time
func input(world_dir: Vector3) -> void:
	if not active or moving or _cool > 0.0 or _between > 0.0: return
	if world_dir.length() < 0.35: return
	var wd := world_dir.normalized()
	var best := Vector2i.ZERO
	var bd := -2.0
	for d in DIRS:
		var k: float = dir_world(d).dot(wd)
		if k > bd: bd = k; best = d
	# (QA_V11) the hysteresis only holds a HELD drag steady (its repeats); a new drag steps the way THAT drag points
	var serial: int = game.controls.joy_serial
	if serial != _drag_serial:
		_drag_serial = serial
		_last_dir = Vector2i.ZERO
	if _last_dir != Vector2i.ZERO and best != _last_dir and dir_world(_last_dir).dot(wd) > bd - 0.12: best = _last_dir
	try_step(best)

func try_step(d: Vector2i) -> bool:
	if not active: return false
	var t = step(b, p, h, d)
	_last_dir = d
	if t is String:
		active = false
		_leaving = true
		moving = true
		refl.hold = false
		game.auto_target = tile(p) - V * 1.15
		chapter.event.emit("steps_exit", null)
		_lights()
		return true
	if (t as Array).is_empty():
		# refused: a gentle nudge toward it and back, and the stone's dull knock
		blocked_n += 1
		_cool = 0.3
		moving = true
		_bump = tile(p)
		game.auto_target = tile(p) + dir_world(d) * 0.16
		chapter.event.emit("steps_blocked", null)
		return false
	var held: bool = (t[1] as Vector2i) == h or (t[0] as Vector2i) == p
	p = t[0]
	h = t[1]
	moves += 1
	_idle = 0.0
	moving = true
	game.auto_target = tile(p)
	_her_slide(tile(h))
	chapter.event.emit("steps_step", held)
	return true

func _her_slide(to: Vector3) -> void:
	_her_from = her_pos
	_her_to = to
	_her_t = 0.0 if not _her_from.is_equal_approx(to) else 1.0

## the reset stone: both of you back where this board starts
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

func _on_floor(pp: Vector3) -> bool:
	var l := local(pp)
	return l.y > EDGE_V + 0.05 and l.y < -GAP and absf(l.x) < TILE * C * 0.5 and absf(pp.y - FLOOR_Y) < 0.2

func update(dt: float) -> void:
	_cool = maxf(0.0, _cool - dt)
	var pl := game.player
	var pp := pl.position
	# on: through the gap onto your floor; to this board's start, and she appears in the glass
	if not active and not _leaving and not solved() and game.mode == "play" and _on_floor(pp):
		active = true
		p = b["P"]
		h = b["A"]
		moves = 0
		_idle = 0.0
		_last_dir = Vector2i.ZERO
		her_pos = tile(h)
		_her_to = her_pos
		_her_t = 1.0
		refl.hold = true
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
				_flare = 1.0
				if bi + 1 < BOARDS.size():
					chapter.event.emit("steps_board", bi)
					_between = 1.8
				else:
					# solved: the glyphs flare, the jingle, the glass is a plain mirror again; the gate rises
					active = false
					refl.hold = false
					chapter.steps_solved()
	if _between > 0.0:
		_between -= dt
		if _between <= 0.0:
			_show_board(bi + 1, false)
			p = b["P"]
			h = b["A"]
			moves = 0
			_idle = 0.0
			game.player.teleport(tile(p), game.player.yaw)
			game.auto_target = Vector3.INF
			moving = false
			her_pos = tile(h)
			_her_to = her_pos
			_her_t = 1.0
	if _flare > 0.0:
		_flare = maxf(0.0, _flare - dt * 0.5)
		_lights()
	# the hint: after a minute with no progress, the next step glows faintly on your floor
	if active and not moving and _between <= 0.0:
		_idle += dt
	var hk := 0.0
	if active and _idle > HINT_AFTER:
		var sv := solve(bi, p, h)
		if not (sv["path"] as Array).is_empty():
			var d: Vector2i = sv["path"][0]
			hint_node.position = tile(p) + dir_world(d) * 0.62 + Vector3(0, 0.05, 0)
			hk = 0.35 + 0.3 * sin(Time.get_ticks_msec() * 0.004)
	hint_mat.set_shader_parameter("intensity", hk)
	# her twin, sliding to her slab (with your pace)
	if _her_t < 1.0:
		_her_t = minf(1.0, _her_t + dt / 0.55)
		her_pos = _her_from.lerp(_her_to, smoothstep(0.0, 1.0, _her_t))
	if refl.hold:
		var walking := _her_t < 1.0
		_phase += dt * (1.5 + 6.2 * (0.8 if walking else 0.0))
		var ps: Figure.Pose = pl.fig.pose
		_pose.breath = ps.breath
		_pose.head_yaw = ps.head_yaw
		_pose.ripple = 0.75 if walking else ps.ripple * 0.5
		_pose.phase = _phase if walking else ps.phase
		_pose.body_y = absf(sin(_phase)) * 0.03 if walking else ps.body_y
		refl.hold_pose = _pose
		refl.hold_xf = Transform3D(pl.fig.global_transform.basis, her_pos + Vector3(0, pl.fig.global_position.y - pp.y, 0))
	reset_rune.set_shader_parameter("lit", 0.9 if (active and (p != b["P"] or h != b["A"])) else 0.35)
	# the reset stone's interact follows you on the floor
	var ri := game.level.interact_by_id("steps_reset")
	if ri: ri.pos = pp if active else Vector3(0, -99, 0)
