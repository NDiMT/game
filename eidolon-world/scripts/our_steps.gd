class_name OurSteps
extends Node3D
## "Our Steps" (v0.9.2; v1.0: a true mirror). A floor of 5 x 3 slabs before a tall planar MIRROR, a real
## reflection like every other glass in the game: in it, her room is the mirror image of yours, but not
## the same: her stones and her missing slab exist only in the glass (twin geometry on the reflection-only
## layer), and the figure in it is HER, in crimson, standing where the floor's logic puts her. You step slab
## to slab (the stick snaps to the grid, which lies square to the screen: along the glass is left / right,
## toward it is up). Your reflection steps as a reflection must: along the glass the same way, toward the
## glass toward you.
##  * her room has stones yours has not: where her next slab is taken she STAYS while you step on: the two
##    of you drift apart.
##  * your room's stones are in hers too (they are reflected): there neither of you steps.
##  * her room has a gap (a missing slab): she will not step into it, so neither do you. No falling, no fail.
## Your crimson plate is on your floor, hers in the glass, and not where mirror and mirror meet: use her
## stones to shift the two of you until you stand on yours while she stands on hers. The gate opens.
## Stepping off the floor where you came on always works (she comes back to your mirror); the stone by
## you resets you both. The first time you step on, the floor shows its rule: you step forward, she is held.
## Grid: column c along the glass, row r toward it; c 0..4, r 0..2; you enter at (2, 0).

const C := 5
const R := 3
const ENTRY := Vector2i(2, 0)
const Y_OBS := [Vector2i(1, 1)]                                       # your stone (in both rooms)
const H_OBS := [Vector2i(2, 1), Vector2i(3, 1), Vector2i(4, 1)]       # hers ((2, 1): the teaching drum)
const H_GAP := [Vector2i(2, 2)]                                       # her missing slab
const Y_PLATE := Vector2i(4, 0)
const H_PLATE := Vector2i(0, 0)
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

## (u along the glass, v toward it) of your slab c
static func uv(c: Vector2i) -> Vector2:
	return Vector2((c.x - 2) * TILE, -(GAP + TILE * 0.5 + (R - 1 - c.y) * TILE))

static func at(u: float, v: float) -> Vector3:
	return GC + U * u + V * v

static func tile(c: Vector2i) -> Vector3:
	var q := uv(c)
	return at(q.x, q.y)

## her slab c, where the glass shows it (the mirror image of yours, behind the glass)
static func her_tile(c: Vector2i) -> Vector3:
	var q := uv(c)
	return at(q.x, -q.y)

## the glass plane (normal toward you)
static func plane_n() -> Vector3:
	return -V

static func plane_d() -> float:
	return plane_n().dot(GC)

## a point in the floor's frame: (u, v)
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
	if not inb(nh) or nh in H_OBS or nh in Y_OBS: return [np, h]      # (your stone is in her room too)
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

## the world direction of grid step d
static func dir_world(d: Vector2i) -> Vector3:
	return U * float(d.x) + V * float(d.y)

# ------------------------------------------------------------------ in the world
var game: Game
var chapter: Chapter
var active := false                  # you are on the floor
var p := ENTRY
var h := ENTRY
var refl: Reflector                  # the glass (a real planar mirror) and HER, its driven double
var her_pos := Vector3.ZERO          # where she stands, in YOUR world (the glass shows it reflected)
var _her_from := Vector3.ZERO
var _her_to := Vector3.ZERO
var _her_t := 1.0
var moving := false
var _cool := 0.0
var _teach := 0.0                    # > 0: the teaching moment plays (the stick waits)
var taught := false
var _teach_stepped := false
var _leaving := false
var _bump := Vector3.INF             # a refused step: the nudge out and back
var _last_dir := Vector2i.ZERO
var plate_y: ShaderMaterial
var plate_h: ShaderMaterial
var col_glints: Array[ShaderMaterial] = []   # her stones' glints (in the glass)
var _pose := Figure.Pose.new()
var _phase := 0.0
var moves := 0                       # (tests) steps taken this time on the floor
var blocked_n := 0                   # (tests) refused steps

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	var B := Basis(Vector3.UP, -PI * 0.25)          # (local x along the glass, local +z toward you)
	# the mirror: a tall planar glass, a real reflection
	var center := at(0.0, 0.0) + Vector3(0, GLASS_H * 0.5 + 0.05, 0)
	var mm := game.puzzles._mirror_quad(center, B, Vector2(GLASS_HALF * 2.0, GLASS_H), false, 1.0)
	mm.set_shader_parameter("ncols", 0)
	mm.set_shader_parameter("floor_y", FLOOR_Y)
	var pm := PlanarMirror.new()
	add_child(pm)
	pm.setup(plane_n(), plane_d(), mm, game.world.env)
	refl = Reflector.new()
	refl.kind = "mirror"; refl.plane_n = plane_n(); refl.plane_d = plane_d() + 0.01
	refl.clip_c = center; refl.clip_u = U; refl.clip_v = Vector3.UP; refl.clip_h = Vector2(GLASS_HALF, GLASS_H * 0.5)
	refl.region = Level.R(17.5, -15.0, 25.5, -6.0)
	refl.planar = pm
	refl.hold = true
	game.puzzles._add_refl(refl)
	# your plate: on your floor only (main view: it is not in her room)
	plate_y = game.puzzles.rune_quad(self, tile(Y_PLATE) + Vector3(0, 0.03, 0), Vector2(0.9, 0.9), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.3)
	_last_child().layers = PlanarMirror.LAYER_MAIN_FX
	# her plate, her stones, her gap: only in the glass (twins on the reflection-only layer, standing where
	# the glass shows them from: your side)
	plate_h = game.puzzles.rune_quad(self, tile(H_PLATE) + Vector3(0, 0.03, 0), Vector2(0.9, 0.9), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.3)
	_last_child().layers = PlanarMirror.LAYER_DOUBLE
	var stones := MB.new()
	for c in H_OBS:
		var t := tile(c)
		if c == Vector2i(2, 1):
			# the teaching drum: a broken column drum, low (she shows over it)
			stones.cyl(t + Vector3(0, 0.016 + 0.3, 0), 0.38, 0.4, 0.6, Color(0.5, 0.25, 0.0), 12)
		else:
			stones.box(t + Vector3(0, 0.016 + 0.33, 0), Vector3(0.95, 0.66, 0.55), Color(0.5, 0.25, 0.0), B * Basis(Vector3.UP, 0.35 * float(c.x - c.y)))
	var smi := game.puzzles.marble_instance(stones.commit(), self)
	smi.layers = PlanarMirror.LAYER_DOUBLE
	for c in H_GAP:
		var gm := StandardMaterial3D.new()
		gm.albedo_color = Color(0.035, 0.037, 0.042)
		gm.roughness = 1.0
		var bm := BoxMesh.new()
		bm.size = Vector3(TILE - 0.04, 0.03, TILE - 0.04)
		var gi := MeshInstance3D.new()
		gi.mesh = bm
		gi.material_override = gm
		gi.transform = Transform3D(B, tile(c) + Vector3(0, 0.022, 0))
		gi.layers = PlanarMirror.LAYER_DOUBLE
		gi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(gi)
	for c in H_OBS:
		col_glints.append(game.puzzles.glow_quad(self, tile(c) + Vector3(0, 0.95, 0), 1.1, Palette.ACCENT, 0.0))
		_last_child().layers = PlanarMirror.LAYER_DOUBLE
	her_pos = tile(ENTRY)
	_her_to = her_pos
	level_reset()

func _last_child() -> MeshInstance3D:
	return get_child(get_child_count() - 1) as MeshInstance3D

func level_reset() -> void:
	active = false
	moving = false
	_leaving = false
	_bump = Vector3.INF
	p = ENTRY
	h = ENTRY
	her_pos = tile(ENTRY)
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

## the stick, as a direction on the ground (world xz): one step along the nearest grid direction. The grid
## is square to the screen, so up / down / left / right are its four ways; a diagonal push keeps the way you
## last stepped if that is one of the two nearest (no flicker between two ways)
func input(world_dir: Vector3) -> void:
	if not active or moving or _teach > 0.0 or _cool > 0.0: return
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
	var t = step(p, h, d)
	_last_dir = d
	if t is String:
		# off the floor where you came on: she comes back to your mirror
		active = false
		_leaving = true
		moving = true
		game.auto_target = tile(ENTRY) - V * 1.15
		_her_slide(tile(ENTRY))
		h = ENTRY
		p = ENTRY
		chapter.event.emit("steps_exit", null)
		_lights()
		return true
	if (t as Array).is_empty():
		# refused: a small nudge toward it and back, and the stone's dull knock
		blocked_n += 1
		_cool = 0.3
		moving = true
		_bump = tile(p)
		game.auto_target = tile(p) + dir_world(d) * 0.16
		chapter.event.emit("steps_blocked", null)
		return false
	var held: bool = (t[1] as Vector2i) == h
	p = t[0]
	h = t[1]
	moves += 1
	moving = true
	game.auto_target = tile(p)
	_her_slide(tile(h))
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

## the stone by you: both of you back where you came on
func reset() -> void:
	if not active: return
	p = ENTRY
	h = ENTRY
	game.player.teleport(tile(ENTRY), game.player.yaw)
	game.auto_target = Vector3.INF
	her_pos = tile(ENTRY)
	_her_to = her_pos
	_her_t = 1.0
	moving = false
	_bump = Vector3.INF
	moves = 0
	chapter.event.emit("steps_reset", null)
	_lights()

func update(dt: float) -> void:
	_cool = maxf(0.0, _cool - dt)
	var pl := game.player
	var pp := pl.position
	# on: stepping onto the entry slab from the landing
	if not active and not _leaving and not solved() and game.mode == "play":
		var l := local(pp)
		if l.y > EDGE_V + 0.05 and absf(l.x) < TILE * 0.5 and absf(pp.y - FLOOR_Y) < 0.2:
			active = true
			p = ENTRY
			h = ENTRY
			moves = 0
			_last_dir = Vector2i.ZERO
			game.auto_target = tile(ENTRY)
			moving = true
			if not taught:
				_teach = 1.6
				_teach_stepped = false
			chapter.event.emit("steps_on", null)
	if _leaving and (game.auto_target == Vector3.INF or local(pp).y < EDGE_V - 0.3):
		_leaving = false
		moving = false
	if moving and active and game.auto_target == Vector3.INF:
		if _bump != Vector3.INF:
			# (the refused step's nudge reached its farthest: back onto the slab)
			game.auto_target = _bump
			_bump = Vector3.INF
		else:
			moving = false
			_lights()
			if p == Y_PLATE and h == H_PLATE and not solved():
				chapter.steps_solved()
	# the teaching moment (the first time only): a beat, then you step forward and she is held by her drum;
	# the stick is yours again the moment that step ends
	if _teach > 0.0:
		_teach -= dt
		if not _teach_stepped and _teach <= 1.1 and not moving:
			_teach_stepped = true
			try_step(Vector2i(0, 1))
		if _teach_stepped and not moving:
			_teach = 0.0
		if _teach <= 0.0:
			_teach = 0.0
			taught = true
	# her, sliding to her slab (with your pace)
	if _her_t < 1.0:
		_her_t = minf(1.0, _her_t + dt / 0.55)
		her_pos = _her_from.lerp(_her_to, smoothstep(0.0, 1.0, _her_t))
	# the glass shows her: your own turn and pose, standing on her slab
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
	# the reset stone's interact follows you on the floor
	var ri := game.level.interact_by_id("steps_reset")
	if ri: ri.pos = pp if active else Vector3(0, -99, 0)
