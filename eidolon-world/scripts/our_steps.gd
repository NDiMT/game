class_name OurSteps
extends Node3D
## v0.9.2 "Our Steps" (replaces the Hollow Walk). A floor of 5 x 4 slabs before a tall glass wall; behind
## the glass, HER room: the same floor, mirrored, but not the same. On the floor you step slab to slab (the
## stick snaps to the grid); your reflection steps as a reflection must: along the glass the same way, toward
## the glass toward you, away when you go away.
##  * her room has fallen stones yours has not: where her next slab is taken she STAYS while you step on:
##    the two of you drift apart.
##  * your room has stones of its own: there you cannot step (nor does she).
##  * her room has gaps (missing slabs): she will not step into one, so neither do you. No falling, no fail.
## Your crimson plate is on your floor, hers on hers, and not where mirror and mirror meet: use her stones to
## shift the two of you until you stand on yours while she stands on hers. Both plates light; the gate opens.
## Stepping off the floor where you came on always works (she comes back to your mirror), and the stone
## by the entry resets you both. The first time you step on, a short moment in the glass shows her held by
## a fallen column while you step forward.
## Grid: column c along the glass, row r toward it; c 0..4, r 0..3; you enter at (2, 0).
## (v0.9.2: the floor lies on the diagonal of the fixed view: the glass runs straight across the screen, her
## room above it, yours below: along the glass is left / right on the screen, toward it is up. The whole
## puzzle, both rooms, fits the phone's width, and the stick's four ways are the screen's four ways)

const C := 5
const R := 4
const ENTRY := Vector2i(2, 0)
const Y_OBS := [Vector2i(2, 3), Vector2i(3, 1)]                       # your stones
const H_OBS := [Vector2i(1, 1), Vector2i(2, 1), Vector2i(4, 0), Vector2i(4, 1)]   # hers ((2, 1): the teaching column)
const H_GAP := [Vector2i(0, 2)]                                       # her missing slab
const Y_PLATE := Vector2i(1, 3)
const H_PLATE := Vector2i(4, 2)
const TILE := 1.2
const GAP := 0.3                     # from the glass to the nearest row's edge
const GC := Vector3(27.8, 1.0, -12.7)                     # the glass's foot, mid-way
const U := Vector3(0.70710678, 0.0, 0.70710678)           # along the glass (screen right)
const V := Vector3(0.70710678, 0.0, -0.70710678)          # toward the glass, from your side (screen up)
const EDGE_V := -(GAP + R * TILE)    # your floor's near edge (where you step on and off)
const GLASS_HALF := 3.35
const FLOOR_Y := 1.0
const DIRS := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]

## (u along the glass, v toward it) of your slab c
static func uv(c: Vector2i) -> Vector2:
	return Vector2((c.x - 2) * TILE, -(GAP + TILE * 0.5 + (R - 1 - c.y) * TILE))

static func at(u: float, v: float) -> Vector3:
	return GC + U * u + V * v

static func tile(c: Vector2i) -> Vector3:
	var q := uv(c)
	return at(q.x, q.y)

## her slab c: the mirror image of yours across the glass
static func her_tile(c: Vector2i) -> Vector3:
	var q := uv(c)
	return at(q.x, -q.y)

## a point in the floor's frame: (u, v)
static func local(p: Vector3) -> Vector2:
	return Vector2((p - GC).dot(U), (p - GC).dot(V))

## the camera's lean on and before the floor: the glass mid-screen, both rooms whole
static func lean(p: Vector3) -> Vector3:
	var l := local(p)
	if l.y < -8.5 or l.y > 0.5 or absf(l.x) > 5.5 or absf(p.y - FLOOR_Y) > 0.3: return Vector3.ZERO
	var k := clampf((l.y + 8.5) / 2.5, 0.0, 1.0)
	var off := (at(0.0, -1.5) - p) * k
	off.y = 0.0
	return off

static func inb(c: Vector2i) -> bool:
	return c.x >= 0 and c.x < C and c.y >= 0 and c.y < R

## one step d from (you, her): the new [you, her], "exit" (off the floor where you came on), or [] (blocked)
static func step(p: Vector2i, h: Vector2i, d: Vector2i) -> Variant:
	var np := p + d
	if not inb(np):
		if d == Vector2i(0, -1) and p == ENTRY: return "exit"
		return []
	if np in Y_OBS: return []
	var nh := h + d
	if inb(nh) and nh in H_GAP: return []
	if not inb(nh) or nh in H_OBS: return [np, h]
	return [np, nh]

## (tests) BFS from the entry: the shortest solution, how many shortest ones, and whether every reachable
## state can still leave the floor
static func solve() -> Dictionary:
	var start := [ENTRY, ENTRY]
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
			var t = step(s[0], s[1], d)
			if t is String or (t as Array).is_empty(): continue
			var kt: String = key.call(t)
			if not dist.has(kt):
				dist[kt] = dist[ks] + 1; ways[kt] = ways[ks]; par[kt] = [ks, d]; states[kt] = t; q.append(t)
			elif dist[kt] == dist[ks] + 1:
				ways[kt] += ways[ks]
	var goal: String = key.call([Y_PLATE, H_PLATE])
	var path := []
	if dist.has(goal):
		var k := goal
		while par.has(k):
			path.push_front(par[k][1])
			k = par[k][0]
	# no softlock: from every reachable state the floor can be left
	var trapped := 0
	for ks in states:
		var seen := {ks: true}
		var stack := [states[ks]]
		var out := false
		while not stack.is_empty() and not out:
			var x: Array = stack.pop_back()
			for d in DIRS:
				var t = step(x[0], x[1], d)
				if t is String: out = true; break
				if (t as Array).is_empty(): continue
				var kt: String = key.call(t)
				if seen.has(kt): continue
				seen[kt] = true
				stack.append(t)
		if not out: trapped += 1
	return {"length": dist.get(goal, -1), "ways": ways.get(goal, 0), "path": path, "states": states.size(), "trapped": trapped}

# ------------------------------------------------------------------ in the world
var game: Game
var chapter: Chapter
var active := false                  # you are on the floor
var p := ENTRY
var h := ENTRY
var her_fig: Figure
var her_node: Node3D
var her_pos := Vector3.ZERO          # her feet (slides)
var _her_from := Vector3.ZERO
var _her_to := Vector3.ZERO
var _her_t := 1.0
var moving := false
var _cool := 0.0
var _teach := 0.0                    # > 0: the teaching moment plays
var taught := false
var _teach_stepped := false
var _leaving := false
var plate_y: ShaderMaterial
var plate_h: ShaderMaterial
var col_glints: Array[ShaderMaterial] = []   # her stones' glints (the teaching column first)
var _pose := Figure.Pose.new()
var _phase := 0.0
var moves := 0                       # (tests) steps taken this time on the floor

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	# your plate, her plate (crimson rune plates on the slabs)
	plate_y = game.puzzles.rune_quad(self, tile(Y_PLATE) + Vector3(0, 0.03, 0), Vector2(0.96, 0.96), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.3)
	plate_h = game.puzzles.rune_quad(self, her_tile(H_PLATE) + Vector3(0, 0.03, 0), Vector2(0.96, 0.96), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.3)
	for c in H_OBS:
		col_glints.append(game.puzzles.glow_quad(self, her_tile(c) + Vector3(0, 0.9, 0), 1.2, Palette.ACCENT, 0.0))
	# her: your reflection, in crimson, walking her room as the floor's logic says (a puppet: never the
	# automatic mirror)
	her_node = Node3D.new()
	add_child(her_node)
	her_fig = Figure.new(preload("res://shaders/ghost.gdshader"))
	her_node.add_child(her_fig)
	for m in her_fig.mats():
		m.set_shader_parameter("project", 0.0)
		m.set_shader_parameter("vis", 1.0)
		m.set_shader_parameter("ghost", 0.0)
	her_fig.set_cloth("copy", game.player.fig)
	her_pos = her_tile(ENTRY)
	_her_to = her_pos
	# the glass wall: a clear pane (her room is seen through it, not reflected), its sheen only
	var q := QuadMesh.new()
	q.size = Vector2(GLASS_HALF * 2.0, 3.6)
	var om := ShaderMaterial.new()
	om.shader = preload("res://shaders/mirror_over.gdshader")
	om.render_priority = 1
	om.set_shader_parameter("size", q.size)
	var pane := MeshInstance3D.new()
	pane.mesh = q
	pane.material_override = om
	pane.transform = Transform3D(Basis(Vector3.UP, -PI * 0.25), at(0.0, -0.02) + Vector3(0, 1.92, 0))
	pane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	pane.layers = PlanarMirror.LAYER_MAIN_FX
	add_child(pane)
	level_reset()

func level_reset() -> void:
	active = false
	moving = false
	_leaving = false
	p = ENTRY
	h = ENTRY
	her_pos = her_tile(ENTRY)
	_her_to = her_pos
	_her_t = 1.0
	_lights()

func solved() -> bool:
	return bool(chapter.state["hollow_done"])

func _lights() -> void:
	var on_y := active and p == Y_PLATE
	var on_h := active and h == H_PLATE
	plate_y.set_shader_parameter("lit", 1.0 if (on_y or solved()) else 0.3)
	plate_h.set_shader_parameter("lit", 1.0 if (on_h or solved()) else 0.3)

## the stick, as a direction on the ground (world xz): one step along the nearest grid direction
func input(world_dir: Vector3) -> void:
	if not active or moving or _teach > 0.0 or _cool > 0.0: return
	if world_dir.length() < 0.5: return
	var best := Vector2i.ZERO
	var bd := -2.0
	for d in DIRS:
		var w: Vector3 = U * float(d.x) + V * float(d.y)
		var k: float = w.dot(world_dir.normalized())
		if k > bd: bd = k; best = d
	try_step(best)

func try_step(d: Vector2i) -> bool:
	var t = step(p, h, d)
	if t is String:
		# off the floor where you came on: she comes back to your mirror
		active = false
		_leaving = true
		moving = true
		game.auto_target = tile(ENTRY) - V * 1.25
		_her_slide(her_tile(ENTRY))
		h = ENTRY
		p = ENTRY
		chapter.event.emit("steps_exit", null)
		_lights()
		return true
	if (t as Array).is_empty():
		_cool = 0.25
		chapter.event.emit("steps_blocked", null)
		return false
	var held: bool = (t[1] as Vector2i) == h and d != Vector2i.ZERO
	p = t[0]
	h = t[1]
	moves += 1
	moving = true
	game.auto_target = tile(p)
	_her_slide(her_tile(h))
	if held:
		var gi := H_OBS.find(h + d)
		if gi >= 0: _glint(gi)
	chapter.event.emit("steps_step", held)
	return true

func _her_slide(to: Vector3) -> void:
	_her_from = her_pos
	_her_to = to
	_her_t = 0.0 if not _her_from.is_equal_approx(to) else 1.0

func _glint(i: int) -> void:
	var m := col_glints[i]
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("intensity", v), 0.0, 0.9, 0.25)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("intensity", v), 0.9, 0.0, 1.1)

## the stone by the entry: both of you back where you came on
func reset() -> void:
	if not active: return
	p = ENTRY
	h = ENTRY
	game.player.teleport(tile(ENTRY), game.player.yaw)
	game.auto_target = Vector3.INF
	her_pos = her_tile(ENTRY)
	_her_to = her_pos
	_her_t = 1.0
	moving = false
	moves = 0
	chapter.event.emit("steps_reset", null)
	_lights()

func update(dt: float) -> void:
	_cool = maxf(0.0, _cool - dt)
	var pl := game.player
	var pp := pl.position
	# on: stepping onto the entry slab from the landing
	if not active and not _leaving and not solved() and game.mode == "play":
		var e := tile(ENTRY)
		var l := local(pp)
		if l.y > EDGE_V + 0.05 and absf(l.x) < TILE * 0.5 and absf(pp.y - FLOOR_Y) < 0.2:
			active = true
			p = ENTRY
			h = ENTRY
			moves = 0
			game.auto_target = e
			moving = true
			if not taught: _teach = 2.6
			chapter.event.emit("steps_on", null)
	if _leaving and (game.auto_target == Vector3.INF or local(pp).y < EDGE_V - 0.3):
		_leaving = false
		moving = false
	if moving and active and game.auto_target == Vector3.INF:
		moving = false
		_lights()
		if p == Y_PLATE and h == H_PLATE and not solved():
			chapter.steps_solved()
	# the teaching moment: a beat to look at the glass, then you step forward and she is held by her column
	if _teach > 0.0:
		_teach -= dt
		if not _teach_stepped and _teach <= 1.7 and not moving:
			_teach_stepped = true
			try_step(Vector2i(0, 1))
			_teach = maxf(_teach, 1.2)
		if _teach <= 0.0:
			_teach = 0.0
			taught = true
	# her, sliding to her slab (with your pace), mirrored
	if _her_t < 1.0:
		_her_t = minf(1.0, _her_t + dt / 0.55)
		her_pos = _her_from.lerp(_her_to, smoothstep(0.0, 1.0, _her_t))
	var lp := local(pp)
	var near := lp.y > -11.0 and lp.y < 0.5 and absf(lp.x) < 8.0 and absf(pp.y - FLOOR_Y) < 0.6
	her_node.visible = near
	if near:
		# your reflection: your own figure's turn, mirrored across the glass, standing on her slab
		var M := Basis(Vector3(0, 0, 1), Vector3(0, 1, 0), Vector3(1, 0, 0))     # (the reflection across the glass: I - 2 V V^T)
		# (the figure is drawn with a proper rotation: the reflection, then her own left-right flip: a mirrored
		# transform would turn the figure's faces inside out)
		her_node.global_transform = Transform3D(M * pl.fig.global_transform.basis * Basis.from_scale(Vector3(-1, 1, 1)), her_pos + Vector3(0, pl.fig.global_position.y - pp.y, 0))
		var walking := _her_t < 1.0
		_phase += dt * (1.5 + 6.2 * (0.8 if walking else 0.0))
		var ps: Figure.Pose = pl.fig.pose
		_pose.breath = ps.breath
		_pose.head_yaw = ps.head_yaw
		_pose.ripple = 0.75 if walking else 0.0
		_pose.phase = _phase if walking else ps.phase
		_pose.body_y = absf(sin(_phase)) * 0.03 if walking else ps.body_y
		her_fig.apply_pose(_pose)
	# the reset stone's interact follows you on the floor
	var ri := game.level.interact_by_id("steps_reset")
	if ri: ri.pos = pp if active else Vector3(0, -99, 0)
