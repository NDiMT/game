class_name Board
extends Node3D
## Visual diorama for one level: island mesh, sigils, mirrors, rails, cube, Eidolons, previews.
## All animation lives here; the rules live in Rules.

signal turn_finished
signal mirror_moved(strength: float)
signal cube_landed(pos: Vector3)
signal body_bumped

const CUBE := 0.9
const H := CUBE * 0.5
const ROLL_T := 0.26
const SLIDE_T := 0.34

var rules: Rules
var state: Dictionary
var noise_tex: Texture2D
var island_mat: ShaderMaterial
var stone_mat: ShaderMaterial
var black_mat: ShaderMaterial
var cube: Node3D
var cube_mat: ShaderMaterial
var eids: Array[Node3D] = []
var eid_mats: Array[ShaderMaterial] = []
var eid_glows: Array[MeshInstance3D] = []
var mirror_roots: Array[Node3D] = []
var mirror_mats: Array[ShaderMaterial] = []
var sigil_mats: Array[ShaderMaterial] = []
var preview_nodes: Array[MeshInstance3D] = []
var halo_mats: Array[ShaderMaterial] = []
var rail_mats := {}            # mirror index -> rail overlay material
var sparks := {}               # mirror index -> [CPUParticles3D, CPUParticles3D]
var mirror_ghosts: Array[MeshInstance3D] = []
var path_dots: Array[MeshInstance3D] = []
var tethers: Array[MeshInstance3D] = []
var tether_mats: Array[ShaderMaterial] = []
var afterimages: Array[MeshInstance3D] = []
var _after_i := 0
const CARRY_T := 0.34
signal mirror_locked
var dust: CPUParticles3D
var busy := false
var center := Vector2.ZERO

func setup(r: Rules, s: Dictionary, ntex: Texture2D) -> void:
	rules = r
	noise_tex = ntex
	center = Vector2((r.w - 1) * 0.5, (r.h - 1) * 0.5)
	island_mat = ShaderMaterial.new()
	island_mat.shader = preload("res://shaders/island.gdshader")
	island_mat.set_shader_parameter("noise_tex", ntex)
	stone_mat = _stone(false)
	black_mat = _stone(true)
	_build_island()
	_build_sigils()
	_build_mirrors()
	_build_bodies()
	_build_previews()
	_build_dust()
	_build_carry_fx()
	set_state(s)

func _make_sparks() -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.emitting = false
	p.one_shot = true
	p.amount = 18
	p.lifetime = 0.55
	p.explosiveness = 0.35
	p.direction = Vector3(0, 1, 0)
	p.spread = 70.0
	p.initial_velocity_min = 0.8
	p.initial_velocity_max = 2.2
	p.gravity = Vector3(0, -6.0, 0)
	p.scale_amount_min = 0.25
	p.scale_amount_max = 0.6
	var grad := Gradient.new()
	grad.set_color(0, Color(1.0, 0.95, 0.75, 1.0))
	grad.add_point(0.4, Color(0.55, 0.95, 1.0, 0.9))
	grad.set_color(grad.get_point_count() - 1, Color(0.8, 0.78, 0.72, 0.0))
	p.color_ramp = grad
	var q := QuadMesh.new()
	q.size = Vector2(0.07, 0.07)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.vertex_color_use_as_albedo = true
	q.material = mat
	p.mesh = q
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return p

func _build_carry_fx() -> void:
	for i in eids.size():
		var tm := ShaderMaterial.new()
		tm.shader = preload("res://shaders/tether.gdshader")
		var t := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.orientation = PlaneMesh.FACE_Y
		q.size = Vector2(1, 0.2)
		t.mesh = q
		t.material_override = tm
		t.visible = false
		t.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(t)
		tethers.append(t)
		tether_mats.append(tm)
	for k in 6:
		var a := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3.ONE * CUBE
		a.mesh = bm
		var am := ShaderMaterial.new()
		am.shader = preload("res://shaders/eidolon.gdshader")
		am.set_shader_parameter("strength", 0.0)
		am.set_shader_parameter("glyph_seed", glyph_seed())
		a.material_override = am
		a.visible = false
		a.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(a)
		afterimages.append(a)
	for k in 8:
		var dmi := _glow(Color(0.05, 0.7, 1.0), 0.46, 1.4)
		dmi.visible = false
		add_child(dmi)
		path_dots.append(dmi)

func _afterimage(at: Vector3, basis: Basis, axis_m: Vector3) -> void:
	var a := afterimages[_after_i]
	_after_i = (_after_i + 1) % afterimages.size()
	a.transform = Transform3D(basis, at)
	a.visible = true
	var am := a.material_override as ShaderMaterial
	am.set_shader_parameter("mirror_axis", axis_m)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: am.set_shader_parameter("strength", v), 0.8, 0.0, 0.75)
	tw.tween_callback(func() -> void: a.visible = false)

func _set_tether(i: int, on: bool, from: Vector3 = Vector3.ZERO, to: Vector3 = Vector3.ZERO) -> void:
	var t := tethers[i]
	t.visible = on
	if not on: return
	var mid := (from + to) * 0.5
	var v := to - from
	var l := maxf(v.length(), 0.01)
	t.transform = Transform3D(Basis(Vector3.UP, atan2(-v.z, v.x)) * Basis.from_scale(Vector3(l, 1, 1)), mid)

func _stone(is_black: bool) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/stone.gdshader")
	m.set_shader_parameter("noise_tex", noise_tex)
	m.set_shader_parameter("black", 1.0 if is_black else 0.0)
	m.set_shader_parameter("bevel", 0.0 if is_black else 1.0)
	return m

const FACE_NORMALS := [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, -1, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]

func _face_of(n: Vector3) -> int:
	var best := 0
	for i in 6:
		if n.dot(FACE_NORMALS[i]) > n.dot(FACE_NORMALS[best]): best = i
	return best

func _roll_basis(d: Vector2i) -> Basis:
	return Basis(Vector3.UP.cross(Vector3(d.x, 0, d.y)).normalized(), PI * 0.5)

## The rune each goal shows = the rune facing UP on its body when it arrives along the stored solution
## (same rolls as the animation: the cube rolls when it moves, an Eidolon rolls on its own step and
## glides when carried). Visual only: not a rule (yet).
func goal_runes() -> Array:
	var seed := int(floor(glyph_seed()))
	var cb := Basis()
	var eb: Array[Basis] = []
	for i in rules.mirrors.size(): eb.append(Basis())
	var s := Rules.copy_state(rules.start)
	for ch in rules.solution:
		var d: Vector2i = Rules.DNAME[ch]
		var ev := rules.step(s, d)
		if ev["cube_moved"]: cb = _roll_basis(d) * cb
		for i in eb.size():
			if ev["eid_step"][i]: eb[i] = _roll_basis(ev["eid_dir"][i]) * eb[i]
		s = ev["state"]
	var out := [(_face_of(cb.inverse() * Vector3.UP) + seed) % 6]
	for i in eb.size():
		var m := Vector3(-1, 1, 1) if rules.mirrors[i]["axis"] == "x" else Vector3(1, 1, -1)
		out.append((_face_of((eb[i].inverse() * Vector3.UP) * m) + seed) % 6)
	return out

## Body orientations follow undo/restart so the runes stay meaningful.
var _orient_stack: Array = []
func push_orient() -> void:
	var o := [cube.transform.basis]
	for e in eids: o.append(e.transform.basis)
	_orient_stack.append(o)

func pop_orient() -> void:
	if _orient_stack.is_empty(): return
	var o: Array = _orient_stack.pop_back()
	cube.transform.basis = o[0]
	for i in eids.size(): eids[i].transform.basis = o[i + 1]

func reset_orient() -> void:
	_orient_stack.clear()
	cube.transform.basis = Basis()
	for e in eids: e.transform.basis = Basis()

## The engraved cube designs vary per level (and shift family between chapters): "discovered".
func glyph_seed() -> float:
	return float(rules.id * 5 + (3 if rules.chapter == 2 else 0)) + (0.5 if rules.chapter == 2 else 0.0)

func tile_pos(p: Vector2i, y := 0.0) -> Vector3:
	return Vector3(p.x - center.x, y, p.y - center.y)

func extent() -> float:
	return float(rules.w + rules.h)

# ------------------------------------------------------------------ island
func _build_island() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(-1)          # flat shading: crisp bevels and facets
	var rng := RandomNumberGenerator.new()
	rng.seed = rules.id * 7919 + 13
	var tiles: Array = rules.floor_tiles.keys() + rules.walls.keys()
	tiles.sort()
	var occupied := {}
	for p: Vector2i in tiles: occupied[p] = true
	var special := {rules.goal: true, rules.start["cube"]: true}
	for g in rules.egoals: special[g] = true
	for e in rules.start["eids"]: special[e] = true
	var nb := [Vector2i(0, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0)]
	for p: Vector2i in tiles:
		var rnd := rng.randf()
		var is_wall := rules.walls.has(p)
		var c := tile_pos(p)
		var col_side := Color(rnd, 0.5, 0.0)
		# decorative damage (never on start/goal tiles): a crack, or a broken-off corner
		var dmg := rng.randf()
		var crack := 1.0 if (not is_wall and not special.has(p) and dmg < 0.16) else 0.0
		var cut := -1
		if not is_wall and not special.has(p) and dmg > 0.90: cut = rng.randi_range(0, 3)
		_tile(st, c, cut, Color(rnd, 1.0 if is_wall else 0.0, crack))
		# grout bed under the slabs (shows as thin dark joints)
		_quad_top(st, c + Vector3(0, -0.10, 0), 0.5, Color(rnd, 0.35, 0.0))
		# continuous island body: only the outer faces are emitted
		var edge := false
		for k in 4:
			if occupied.has(p + nb[k]): continue
			edge = true
			_side_face(st, c, k, 0.5, -0.10, -0.85, col_side)
		_rock(st, c, rng, col_side, edge)
		if is_wall:
			_column(st, c, rng, Color(rnd, 1.0, 0.0))
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = island_mat
	mi.name = "Island"
	add_child(mi)

const SQ := [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]

## One marble slab: flat top, 45-degree chamfer, short sides. `cut` = corner index broken off (-1 none).
func _tile(st: SurfaceTool, c: Vector3, cut: int, col: Color) -> void:
	var inner: Array[Vector2] = []
	for k in 4:
		var q: Vector2 = SQ[k]
		if k == cut:
			var prev: Vector2 = SQ[(k + 3) % 4]
			var next: Vector2 = SQ[(k + 1) % 4]
			inner.append(q + (prev - q) * 0.42)
			inner.append(q + (next - q) * 0.30)
		else:
			inner.append(q)
	var n := inner.size()
	var top := []; var mid := []; var bot := []
	for v in inner:
		top.append(c + Vector3(v.x * 0.435, 0.0, v.y * 0.435))
		mid.append(c + Vector3(v.x * 0.478, -0.04, v.y * 0.478))
		bot.append(c + Vector3(v.x * 0.478, -0.13, v.y * 0.478))
	st.set_color(col)
	var ctr := c
	for i in n:
		var j := (i + 1) % n
		st.set_uv(Vector2(0.5, 0.5)); st.add_vertex(ctr)
		st.set_uv(inner[i] * 0.435 + Vector2(0.5, 0.5)); st.add_vertex(top[i])
		st.set_uv(inner[j] * 0.435 + Vector2(0.5, 0.5)); st.add_vertex(top[j])
	for i in n:
		var j := (i + 1) % n
		var ui := inner[i] * 0.478 + Vector2(0.5, 0.5); var uj := inner[j] * 0.478 + Vector2(0.5, 0.5)
		var ti := inner[i] * 0.435 + Vector2(0.5, 0.5); var tj := inner[j] * 0.435 + Vector2(0.5, 0.5)
		st.set_uv(ti); st.add_vertex(top[i]); st.set_uv(ui); st.add_vertex(mid[i]); st.set_uv(tj); st.add_vertex(top[j])
		st.set_uv(tj); st.add_vertex(top[j]); st.set_uv(ui); st.add_vertex(mid[i]); st.set_uv(uj); st.add_vertex(mid[j])
		st.set_uv(ui); st.add_vertex(mid[i]); st.add_vertex(bot[i]); st.add_vertex(mid[j])
		st.add_vertex(mid[j]); st.add_vertex(bot[i]); st.add_vertex(bot[j])

## Rough rock under a tile: three jittered, drifting, tapering layers (deeper on the island rim),
## plus the odd loose stone floating below the edge.
func _rock(st: SurfaceTool, c: Vector3, rng: RandomNumberGenerator, col: Color, edge: bool) -> void:
	var y := -0.85
	var half := 0.5
	var off := Vector2.ZERO
	var ring := _ring(c, off, half, y, rng, 0.0)
	var layers := 3 if edge else 2
	for l in layers:
		var y2 := y - rng.randf_range(0.35, 1.1) * (1.25 if edge else 0.8)
		var half2 := half * rng.randf_range(0.5, 0.8)
		off += Vector2(rng.randf_range(-0.1, 0.1), rng.randf_range(-0.1, 0.1))
		var ring2 := _ring(c, off, half2, y2, rng, 0.07)
		_frustum(st, ring, ring2, col, l == layers - 1)
		ring = ring2; y = y2; half = half2
	if edge and rng.randf() < 0.22:
		var dir := Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)).normalized()
		var sc := c + Vector3(dir.x * 0.9, rng.randf_range(-2.4, -1.3), dir.y * 0.9)
		var s0 := rng.randf_range(0.10, 0.2)
		var r_top := _ring(sc, Vector2.ZERO, s0, 0.0, rng, 0.03)
		var r_bot := _ring(sc, Vector2.ZERO, s0 * 0.5, -s0 * 2.0, rng, 0.03)
		_cap(st, r_top, col, true)
		_frustum(st, r_top, r_bot, col, true)

func _ring(c: Vector3, off: Vector2, half: float, y: float, rng: RandomNumberGenerator, jit: float) -> Array:
	var out := []
	for k in 4:
		var q: Vector2 = SQ[k]
		out.append(c + Vector3(off.x + q.x * half + rng.randf_range(-jit, jit), y + rng.randf_range(-jit, jit), off.y + q.y * half + rng.randf_range(-jit, jit)))
	return out

func _frustum(st: SurfaceTool, top: Array, bot: Array, col: Color, cap: bool) -> void:
	st.set_color(col)
	st.set_uv(Vector2(0.5, 0.5))
	for i in 4:
		var j := (i + 1) % 4
		st.add_vertex(top[i]); st.add_vertex(bot[i]); st.add_vertex(top[j])
		st.add_vertex(top[j]); st.add_vertex(bot[i]); st.add_vertex(bot[j])
	if cap: _cap(st, bot, col, false)

func _cap(st: SurfaceTool, r: Array, col: Color, up: bool) -> void:
	st.set_color(col)
	st.set_uv(Vector2(0.5, 0.5))
	if up:
		st.add_vertex(r[0]); st.add_vertex(r[1]); st.add_vertex(r[2])
		st.add_vertex(r[0]); st.add_vertex(r[2]); st.add_vertex(r[3])
	else:
		st.add_vertex(r[0]); st.add_vertex(r[2]); st.add_vertex(r[1])
		st.add_vertex(r[0]); st.add_vertex(r[3]); st.add_vertex(r[2])

func _quad_top(st: SurfaceTool, c: Vector3, r: float, col: Color) -> void:
	var a := c + Vector3(-r, 0, -r); var b := c + Vector3(r, 0, -r)
	var d := c + Vector3(r, 0, r); var e := c + Vector3(-r, 0, r)
	st.set_color(col)
	st.set_uv(Vector2(0, 0)); st.add_vertex(a)
	st.set_uv(Vector2(1, 0)); st.add_vertex(b)
	st.set_uv(Vector2(1, 1)); st.add_vertex(d)
	st.set_uv(Vector2(0, 0)); st.add_vertex(a)
	st.set_uv(Vector2(1, 1)); st.add_vertex(d)
	st.set_uv(Vector2(0, 1)); st.add_vertex(e)

## Four sides of a (possibly tapering) square frustum from y0 (half size r0) down to y1 (half size r1).
func _side_face(st: SurfaceTool, c: Vector3, k: int, r: float, y0: float, y1: float, col: Color) -> void:
	var corners := [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]
	var p: Vector2 = corners[k]; var q: Vector2 = corners[(k + 1) % 4]
	var a := c + Vector3(p.x * r, y0, p.y * r)
	var b := c + Vector3(q.x * r, y0, q.y * r)
	var a2 := c + Vector3(p.x * r, y1, p.y * r)
	var b2 := c + Vector3(q.x * r, y1, q.y * r)
	st.set_color(col)
	st.set_uv(Vector2(0.5, 0.5))
	st.add_vertex(a); st.add_vertex(a2); st.add_vertex(b)
	st.add_vertex(b); st.add_vertex(a2); st.add_vertex(b2)

func _box_sides(st: SurfaceTool, c: Vector3, r0: float, r1: float, y0: float, y1: float, col: Color, cap := true) -> void:
	var corners := [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]
	st.set_color(col)
	for i in 4:
		var p: Vector2 = corners[i]; var q: Vector2 = corners[(i + 1) % 4]
		var a := c + Vector3(p.x * r0, y0, p.y * r0)
		var b := c + Vector3(q.x * r0, y0, q.y * r0)
		var a2 := c + Vector3(p.x * r1, y1, p.y * r1)
		var b2 := c + Vector3(q.x * r1, y1, q.y * r1)
		st.set_uv(Vector2(0.5, 0.5))
		st.add_vertex(a); st.add_vertex(a2); st.add_vertex(b)
		st.add_vertex(b); st.add_vertex(a2); st.add_vertex(b2)
	if not cap: return
	var b0 := c + Vector3(-r1, y1, -r1); var b1 := c + Vector3(r1, y1, -r1)
	var b2_ := c + Vector3(r1, y1, r1); var b3 := c + Vector3(-r1, y1, r1)
	st.add_vertex(b0); st.add_vertex(b2_); st.add_vertex(b1)
	st.add_vertex(b0); st.add_vertex(b3); st.add_vertex(b2_)

## Broken fluted column on a plinth (black marble).
func _column(st: SurfaceTool, c: Vector3, rng: RandomNumberGenerator, col: Color) -> void:
	_box_sides(st, c + Vector3(0, 0.16, 0), 0.40, 0.40, 0.0, -0.16, col, false)
	_quad_top(st, c + Vector3(0, 0.16, 0), 0.40, col)
	var seg := 24
	var r := 0.30
	var h := rng.randf_range(0.95, 1.75)
	var tilt_dir := rng.randf() * TAU
	var tilt := rng.randf_range(0.10, 0.32)
	st.set_color(col)
	st.set_uv(Vector2(0.5, 0.5))
	var top_pts: Array[Vector3] = []
	for i in seg + 1:
		var a := TAU * i / seg
		var rr := r * (1.0 - 0.06 * (i % 2))
		var dx := cos(a); var dz := sin(a)
		top_pts.append(c + Vector3(dx * rr * 0.97, h + tilt * cos(a - tilt_dir) + 0.04 * sin(a * 5.0), dz * rr * 0.97))
	for i in seg:
		var a0 := TAU * i / seg; var a1 := TAU * (i + 1) / seg
		var r0 := r * (1.0 - 0.06 * (i % 2)); var r1 := r * (1.0 - 0.06 * ((i + 1) % 2))
		var p0 := c + Vector3(cos(a0) * r0, 0.16, sin(a0) * r0)
		var p1 := c + Vector3(cos(a1) * r1, 0.16, sin(a1) * r1)
		var t0 := top_pts[i]; var t1 := top_pts[i + 1]
		st.add_vertex(p0); st.add_vertex(t0); st.add_vertex(p1)
		st.add_vertex(p1); st.add_vertex(t0); st.add_vertex(t1)
		# broken top: fan to a raised jagged centre
		var ctr := c + Vector3(0, h + 0.03, 0)
		st.add_vertex(t0); st.add_vertex(ctr); st.add_vertex(t1)

# ------------------------------------------------------------------ sigils
func _build_sigils() -> void:
	goal_spots = [[rules.goal, 0, Color(0.86, 0.55, 0.14), Color(0.98, 0.52, 0.08)]]
	for i in rules.egoals.size():
		goal_spots.append([rules.egoals[i], 1, Color(0.04, 0.70, 0.92), Color(0.1, 0.78, 1.0)])
	var runes := goal_runes()
	var k := 0
	for s in goal_spots:
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/sigil.gdshader")
		m.set_shader_parameter("kind", float(s[1]))
		m.set_shader_parameter("glyph_scale", 1.6 / 0.86)
		m.set_shader_parameter("color", s[2])
		m.set_shader_parameter("design", float(runes[k]))
		m.set_shader_parameter("mirror", 1.0 if k > 0 else 0.0)
		var mi := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(1.6, 1.6)
		q.orientation = PlaneMesh.FACE_Y
		mi.mesh = q
		mi.material_override = m
		mi.position = tile_pos(s[0], 0.012)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		sigil_mats.append(m)
		# light pooled on the tile when occupied
		var g := _glow(s[3], 2.4, 0.0)
		g.position = tile_pos(s[0], 0.02)
		add_child(g)
		goal_glows.append(g)
		# faint pulsing light pillar rising into the fog (Y-billboard)
		var bm := ShaderMaterial.new()
		bm.shader = preload("res://shaders/beam.gdshader")
		bm.set_shader_parameter("color", s[3])
		bm.set_shader_parameter("phase", k * 2.1)
		bm.set_shader_parameter("boost", 1.35 if k == 0 else 1.0)
		var beam := MeshInstance3D.new()
		var bq := QuadMesh.new()
		bq.size = Vector2(1.15, 4.6)
		beam.mesh = bq
		beam.material_override = bm
		beam.position = tile_pos(s[0], 2.3)
		beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(beam)
		beam_mats.append(bm)
		k += 1
	# slow-orbiting dust motes around every goal: one MultiMesh, one draw call
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var qm := QuadMesh.new()
	qm.size = Vector2(0.11, 0.11)
	mm.mesh = qm
	mm.instance_count = goal_spots.size() * MOTES
	motes = MultiMeshInstance3D.new()
	motes.multimesh = mm
	var mmat := ShaderMaterial.new()
	mmat.shader = preload("res://shaders/mote.gdshader")
	motes.material_override = mmat
	motes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(motes)
	_update_motes(0.0)

const MOTES := 7
var goal_spots: Array = []
var goal_glows: Array[MeshInstance3D] = []
var beam_mats: Array[ShaderMaterial] = []
var motes: MultiMeshInstance3D
var _lit_state: Array = []
var _mote_t := 0.0
var _extras_alpha := 1.0
var _sunk: Array = []

func _process(dt: float) -> void:
	_mote_t += dt
	if motes: _update_motes(_mote_t)

func _update_motes(t: float) -> void:
	var mm := motes.multimesh
	var yoff := 0.0
	if _base_y.has(motes): yoff = motes.position.y - _base_y[motes]
	for gi in goal_spots.size():
		var s: Array = goal_spots[gi]
		var c := tile_pos(s[0])
		var lit: bool = _lit_state.size() > gi and _lit_state[gi]
		for k in MOTES:
			var ph := k * TAU / MOTES + gi * 1.3
			var sp := 0.35 + 0.08 * k
			var r := (0.52 if lit else 0.42) + 0.08 * sin(t * 0.7 + k)
			var h := fmod(t * (0.16 + 0.03 * k) + k * 0.37, 1.0)
			var pos := c + Vector3(cos(ph + t * sp) * r, 0.1 + h * 2.2, sin(ph + t * sp) * r)
			mm.set_instance_transform(gi * MOTES + k, Transform3D(Basis(), pos))
			var col: Color = s[3]
			col.a = sin(h * PI) * (0.95 if lit else 0.6) * _extras_alpha
			mm.set_instance_color(gi * MOTES + k, col)

func _glow(col: Color, size: float, intensity: float) -> MeshInstance3D:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/glow.gdshader")
	m.set_shader_parameter("color", col)
	m.set_shader_parameter("intensity", intensity)
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	q.orientation = PlaneMesh.FACE_Y
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

# ------------------------------------------------------------------ mirrors
func _mirror_world(i: int, pos: int) -> Vector3:
	var m: Dictionary = rules.mirrors[i]
	if m["axis"] == "x":
		return Vector3(pos - 0.5 - center.x, 0, 0)
	return Vector3(0, 0, pos - 0.5 - center.y)

func _build_mirrors() -> void:
	for i in rules.mirrors.size():
		var m: Dictionary = rules.mirrors[i]
		var span := float(rules.h if m["axis"] == "x" else rules.w)
		var root := Node3D.new()
		root.name = "Mirror%d" % i
		if m["axis"] == "z": root.rotation.y = PI * 0.5
		add_child(root)
		var gm := ShaderMaterial.new()
		gm.shader = preload("res://shaders/glass.gdshader")
		gm.set_shader_parameter("counter", 1.0 if m["rail"] != null else 0.0)
		var pane := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(span + 0.1, 1.55)
		pane.mesh = q
		pane.rotation.y = PI * 0.5
		pane.position = Vector3(0, 0.80, 0)
		pane.material_override = gm
		pane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(pane)
		# floor line where glass meets stone
		var line := _glow(Color(0.6, 0.95, 1.0), 1.0, 0.35)
		(line.mesh as QuadMesh).size = Vector2(0.16, span + 0.1)
		root.add_child(line)
		line.position.y = 0.015
		# posts + caps + lintel (black marble), merged into one mesh per mirror
		var parts := []
		for sgn in [-1.0, 1.0]:
			var pb := BoxMesh.new()
			pb.size = Vector3(0.14, 1.8, 0.14)
			parts.append([pb, Vector3(0, 0.85, sgn * (span * 0.5 + 0.12))])
			var cb := BoxMesh.new()
			cb.size = Vector3(0.24, 0.08, 0.24)
			parts.append([cb, Vector3(0, 1.82, sgn * (span * 0.5 + 0.12))])
		var lb := BoxMesh.new()
		lb.size = Vector3(0.07, 0.05, span + 0.3)
		parts.append([lb, Vector3(0, 1.6, 0)])
		root.add_child(_merged(parts, black_mat))
		mirror_roots.append(root)
		mirror_mats.append(gm)
		# swipe-preview ghost of where this mirror will stand
		var gp := MeshInstance3D.new()
		var gq := QuadMesh.new()
		gq.size = Vector2(span + 0.1, 1.55)
		gp.mesh = gq
		var gpm := ShaderMaterial.new()
		gpm.shader = preload("res://shaders/ghostpane.gdshader")
		gp.material_override = gpm
		gp.rotation.y = PI * 0.5 + (PI * 0.5 if m["axis"] == "z" else 0.0)
		gp.visible = false
		gp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(gp)
		mirror_ghosts.append(gp)
		if m["rail"] != null: _build_rails(i, span)

func _build_rails(i: int, span: float) -> void:
	var m: Dictionary = rules.mirrors[i]
	var rail: Vector2i = m["rail"]
	var a := _mirror_world(i, rail.x)
	var b := _mirror_world(i, rail.y)
	var along_axis := Vector3(1, 0, 0) if m["axis"] == "x" else Vector3(0, 0, 1)
	var side_axis := Vector3(0, 0, 1) if m["axis"] == "x" else Vector3(1, 0, 0)
	var length := (b - a).length() + 0.5
	var mid := (a + b) * 0.5
	var black_parts := []
	var cream_parts := []
	for sgn in [-1.0, 1.0]:
		var off: Vector3 = side_axis * sgn * (span * 0.5 + 0.12)
		var bm := BoxMesh.new()
		bm.size = Vector3(length, 0.12, 0.2) if m["axis"] == "x" else Vector3(0.2, 0.12, length)
		black_parts.append([bm, mid + off + Vector3(0, -0.07, 0)])
		# stops at both rail ends + studs at each stop position
		for p in range(rail.x, rail.y + 1):
			var sm := BoxMesh.new()
			var is_end := p == rail.x or p == rail.y
			sm.size = Vector3(0.1, 0.1, 0.24) if not is_end else Vector3(0.12, 0.34, 0.3)
			if m["axis"] == "z": sm.size = Vector3(sm.size.z, sm.size.y, sm.size.x)
			var w := _mirror_world(i, p)
			var along := along_axis * (0.0 if not is_end else (-0.22 if p == rail.x else 0.22))
			var at: Vector3 = w * along_axis.abs() + off + along + Vector3(0, 0.0 if not is_end else 0.1, 0)
			(black_parts if is_end else cream_parts).append([sm, at])
	add_child(_merged(black_parts, black_mat))
	add_child(_merged(cream_parts, stone_mat))
	# readable overlay on both rails (ticks, stops, counter-motion motif, slide glow, arrow, lock)
	var om := ShaderMaterial.new()
	om.shader = preload("res://shaders/rail.gdshader")
	om.set_shader_parameter("n_stops", float(rail.y - rail.x + 1))
	om.set_shader_parameter("pos", float(m["pos"] - rail.x))
	for sgn in [-1.0, 1.0]:
		var off: Vector3 = side_axis * sgn * (span * 0.5 + 0.12)
		var ov := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.orientation = PlaneMesh.FACE_Y
		q.size = Vector2(length, 0.2)
		ov.mesh = q
		ov.material_override = om
		ov.position = mid + off + Vector3(0, 0.004, 0)
		if m["axis"] == "z": ov.rotation.y = -PI * 0.5
		ov.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(ov)
	rail_mats[i] = om
	# sparks where the glass grinds on each rail (children of the moving mirror; emitted in world space)
	var root := mirror_roots[i]
	var em: Array = []
	for sgn in [-1.0, 1.0]:
		var sp := _make_sparks()
		sp.position = Vector3(0, 0.05, sgn * (span * 0.5 + 0.12))
		root.add_child(sp)
		em.append(sp)
	sparks[i] = em

func _merged(parts: Array, mat: Material) -> MeshInstance3D:
	var st := SurfaceTool.new()
	for pr in parts:
		st.append_from(pr[0], 0, Transform3D(Basis(), pr[1]))
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	return mi

# ------------------------------------------------------------------ bodies
func _build_bodies() -> void:
	cube = Node3D.new()
	cube.name = "Cube"
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3.ONE * CUBE
	mi.mesh = bm
	cube_mat = black_mat.duplicate()
	cube_mat.set_shader_parameter("bevel", 1.0)
	cube_mat.set_shader_parameter("glyphs", 1.0)
	cube_mat.set_shader_parameter("glyph_seed", glyph_seed())
	mi.material_override = cube_mat
	cube.add_child(mi)
	add_child(cube)
	for i in rules.mirrors.size():
		var e := Node3D.new()
		e.name = "Eidolon%d" % i
		var em := ShaderMaterial.new()
		em.shader = preload("res://shaders/eidolon.gdshader")
		em.set_shader_parameter("glyph_seed", glyph_seed())
		em.set_shader_parameter("mirror_axis", Vector3(-1, 1, 1) if rules.mirrors[i]["axis"] == "x" else Vector3(1, 1, -1))
		var outer := MeshInstance3D.new()
		var ob := BoxMesh.new()
		ob.size = Vector3.ONE * CUBE
		outer.mesh = ob
		outer.material_override = em
		outer.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		e.add_child(outer)
		var core := MeshInstance3D.new()
		var cb := BoxMesh.new()
		cb.size = Vector3.ONE * 0.3
		core.mesh = cb
		var cm := em.duplicate() as ShaderMaterial
		cm.set_shader_parameter("half_size", 0.15)
		cm.set_shader_parameter("strength", 1.0)
		cm.set_shader_parameter("core", 1.0)
		core.material_override = cm
		core.rotation = Vector3(0.6155, 0.7854, 0.0)
		core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		core.name = "Core"
		e.add_child(core)
		var hm := ShaderMaterial.new()
		hm.shader = preload("res://shaders/halo.gdshader")
		var halo := MeshInstance3D.new()
		var hq := QuadMesh.new()
		hq.size = Vector2(2.3, 2.3)
		halo.mesh = hq
		halo.material_override = hm
		hm.render_priority = -1      # aura first, the ghost body on top of it
		em.render_priority = 1
		cm.render_priority = 2
		halo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		e.add_child(halo)
		halo_mats.append(hm)
		add_child(e)
		var g := _glow(Color(0.15, 0.85, 1.0), 2.4, 0.42)
		add_child(g)
		eids.append(e)
		eid_mats.append(em)
		eid_mats.append(cm)
		eid_glows.append(g)

func _build_previews() -> void:
	var cols := [Color(0.12, 0.12, 0.13)]
	for i in rules.mirrors.size(): cols.append(Color(0.05, 0.68, 0.9))
	for c in cols:
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/sigil.gdshader")
		m.set_shader_parameter("kind", 2.0)
		m.set_shader_parameter("lit", 1.0)
		m.set_shader_parameter("color", c)
		m.set_shader_parameter("alpha_mul", 0.9)
		var mi := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(0.96, 0.96)
		q.orientation = PlaneMesh.FACE_Y
		mi.mesh = q
		mi.material_override = m
		mi.visible = false
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		preview_nodes.append(mi)

func _build_dust() -> void:
	dust = CPUParticles3D.new()
	dust.emitting = false
	dust.one_shot = true
	dust.amount = 14
	dust.lifetime = 0.9
	dust.explosiveness = 0.95
	dust.direction = Vector3(0, 1, 0)
	dust.spread = 80.0
	dust.initial_velocity_min = 0.4
	dust.initial_velocity_max = 1.1
	dust.gravity = Vector3(0, -0.4, 0)
	dust.damping_min = 1.5
	dust.damping_max = 2.5
	dust.scale_amount_min = 0.25
	dust.scale_amount_max = 0.55
	dust.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	dust.emission_box_extents = Vector3(0.45, 0.02, 0.45)
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.4)); curve.add_point(Vector2(0.3, 1.0)); curve.add_point(Vector2(1, 1.3))
	dust.scale_amount_curve = curve
	var grad := Gradient.new()
	grad.set_color(0, Color(0.85, 0.82, 0.76, 0.55))
	grad.set_color(1, Color(0.85, 0.82, 0.76, 0.0))
	dust.color_ramp = grad
	var q := QuadMesh.new()
	q.size = Vector2(0.5, 0.5)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.vertex_color_use_as_albedo = true
	var gt := GradientTexture2D.new()
	var g2 := Gradient.new()
	g2.set_color(0, Color(1, 1, 1, 1)); g2.set_color(1, Color(1, 1, 1, 0))
	gt.gradient = g2
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 64; gt.height = 64
	mat.albedo_texture = gt
	q.material = mat
	dust.mesh = q
	dust.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(dust)

# ------------------------------------------------------------------ state
func set_state(s: Dictionary) -> void:
	state = Rules.copy_state(s)
	cube.transform = Transform3D(_right_angles(cube.transform.basis), tile_pos(state["cube"], H))
	for i in eids.size():
		eids[i].transform = Transform3D(_right_angles(eids[i].transform.basis), tile_pos(state["eids"][i], H))
		eid_glows[i].position = tile_pos(state["eids"][i], 0.03)
	for i in mirror_roots.size():
		mirror_roots[i].position = _mirror_world(i, state["mpos"][i])
	for i in rail_mats:
		rail_mats[i].set_shader_parameter("pos", float(state["mpos"][i] - rules.mirrors[i]["rail"].x))
	update_lit(true)

signal goal_locked(kind: int)

func update_lit(instant := false) -> void:
	var lit := rules.lit(state)
	var first := _lit_state.size() != lit.size()
	for i in sigil_mats.size():
		var on: bool = lit[i]
		var was: bool = false if first else _lit_state[i]
		var target := 1.0 if on else 0.0
		var m := sigil_mats[i]
		var bm := beam_mats[i]
		var gm := goal_glows[i].material_override as ShaderMaterial
		if instant or first:
			m.set_shader_parameter("lit", target)
			m.set_shader_parameter("snap", target)
			bm.set_shader_parameter("lit", target)
			gm.set_shader_parameter("intensity", 0.4 * target)
		elif on != was:
			var tw := create_tween().set_parallel(true)
			tw.tween_method(func(v: float) -> void: m.set_shader_parameter("lit", v), 1.0 - target, target, 0.35)
			tw.tween_method(func(v: float) -> void: bm.set_shader_parameter("lit", v), 1.0 - target, target, 0.5)
			tw.tween_method(func(v: float) -> void: gm.set_shader_parameter("intensity", v), 0.4 * (1.0 - target), 0.4 * target, 0.4)
			if on:
				# the ring snaps in with a little overshoot
				tw.tween_method(func(v: float) -> void: m.set_shader_parameter("snap", v), 0.0, 1.0, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
				goal_locked.emit(int(goal_spots[i][1]))
			else:
				tw.tween_method(func(v: float) -> void: m.set_shader_parameter("snap", v), 1.0, 0.0, 0.3)
	_lit_state = lit

func show_preview(ev: Dictionary, d := Vector2i.ZERO) -> void:
	preview_dir = d
	if ev.is_empty() or not ev["changed"]:
		hide_preview(); return
	var ns: Dictionary = ev["state"]
	preview_nodes[0].visible = ev["cube_moved"]
	preview_nodes[0].position = tile_pos(ns["cube"], 0.02)
	for i in eids.size():
		var moved: bool = ns["eids"][i] != state["eids"][i]
		preview_nodes[i + 1].visible = moved
		preview_nodes[i + 1].position = tile_pos(ns["eids"][i], 0.022)
	# dotted carry path (every tile the reflection will be dragged across)
	var di := 0
	for i in eids.size():
		for t in ev["eid_carry"][i]:
			if di < path_dots.size():
				path_dots[di].position = tile_pos(t, 0.03)
				path_dots[di].visible = true
				di += 1
	for k in range(di, path_dots.size()): path_dots[k].visible = false
	# mirror ghosts at their destination, arrow on the rail, or a lock if a body pins the glass
	var lk := _locked_mirrors(ev, preview_dir)
	for i in mirror_roots.size():
		var sl: int = ev["slid"][i]
		mirror_ghosts[i].visible = sl != 0
		if sl != 0: mirror_ghosts[i].position = _mirror_world(i, ns["mpos"][i]) + Vector3(0, 0.8, 0)
		if rail_mats.has(i):
			rail_mats[i].set_shader_parameter("arrow_dir", float(sl))
			rail_mats[i].set_shader_parameter("locked", 1.0 if lk.has(i) else 0.0)

var preview_dir := Vector2i.ZERO

func hide_preview() -> void:
	for p in preview_nodes: p.visible = false
	for p in path_dots: p.visible = false
	for g in mirror_ghosts: g.visible = false
	for i in rail_mats:
		rail_mats[i].set_shader_parameter("arrow_dir", 0.0)
		rail_mats[i].set_shader_parameter("locked", 0.0)

## Counter-mirrors that WOULD slide this swipe (rail continues) but are pinned by a body or column.
## Presentation only: derived from the rules' result, the rules themselves are untouched.
func _locked_mirrors(ev: Dictionary, d: Vector2i) -> Array:
	var out := []
	if d == Vector2i.ZERO: return out
	var mp: Array = ev.get("mpos_from", state["mpos"])
	for i in rules.mirrors.size():
		var rail = rules.mirrors[i]["rail"]
		if rail == null or ev["slid"][i] != 0: continue
		var k := rules.axis_k(i)
		if d[k] == 0: continue
		var np: int = int(mp[i]) - d[k]
		if np >= rail.x and np <= rail.y: out.append(i)
	return out

# ------------------------------------------------------------------ turn animation
## Choreography (rules untouched):
##   t=0      the cube rolls; every sliding counter-mirror starts recoiling along its rail (grind, sparks,
##            glowing rail segment) and keeps moving for the whole turn; each Eidolon rolls its own
##            mirrored step (or bumps / glitches if blocked).
##   t=ROLL_T the carry: an Eidolon whose mirror slid GLIDES tile by tile in the slide direction, with
##            an afterimage on every tile it crosses and a tether from the glass pulling it.
## Normal moves end after the roll; a carry move takes ROLL_T + CARRY_T (about 0.6 s).
func play_turn(ev: Dictionary, d: Vector2i) -> void:
	busy = true
	hide_preview()
	var ns: Dictionary = ev["state"]
	var from_m: Array = state["mpos"].duplicate()
	var any_slide := false
	var any_carry := false
	for v in ev["slid"]: if v != 0: any_slide = true
	for c in ev["eid_carry"]: if not c.is_empty(): any_carry = true
	var total := ROLL_T + (CARRY_T if any_carry else 0.12)
	# --- t = 0: cube + own mirrored steps
	if ev["cube_moved"]:
		_roll(cube, d, ROLL_T, true)
		var rg := create_tween()
		rg.tween_method(func(v: float) -> void: cube_mat.set_shader_parameter("roll_glow", v), 1.0, 0.0, ROLL_T + 0.5)
	else:
		_bump(cube, d)
	for i in eids.size():
		var dd: Vector2i = ev["eid_dir"][i]
		if ev["eid_step"][i]:
			_roll(eids[i], dd, ROLL_T, false)
		elif ev["eid_carry"][i].is_empty():
			_bump(eids[i], dd)
			if ev["cube_moved"] and ev["slid"][i] == 0: _glitch(i)
	if not ev["cube_moved"]:
		body_bumped.emit()
	# --- t = 0: mirrors recoil against the swipe for the whole turn
	if any_slide:
		var strength := 0.0
		for i in mirror_roots.size():
			var sl: int = ev["slid"][i]
			if sl == 0: continue
			strength += 1.0
			var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
			tw.tween_property(mirror_roots[i], "position", _mirror_world(i, ns["mpos"][i]), total)
			var gm := mirror_mats[i]
			create_tween().tween_method(func(v: float) -> void: gm.set_shader_parameter("ripple", v), 1.0, 0.0, total + 0.3)
			if rail_mats.has(i):
				var rm: ShaderMaterial = rail_mats[i]
				var lo: int = rules.mirrors[i]["rail"].x
				var p0 := float(from_m[i] - lo); var p1 := float(ns["mpos"][i] - lo)
				rm.set_shader_parameter("seg_a", p0)
				rm.set_shader_parameter("seg_b", p1)
				var rt := create_tween()
				rt.tween_method(func(v: float) -> void: rm.set_shader_parameter("pos", v), p0, p1, total)
				rt.parallel().tween_method(func(v: float) -> void: rm.set_shader_parameter("active", v), 1.0, 1.0, total)
				rt.tween_method(func(v: float) -> void: rm.set_shader_parameter("active", v), 1.0, 0.0, 0.45)
			for sp in sparks.get(i, []):
				(sp as CPUParticles3D).restart()
		mirror_moved.emit(strength)
	var lk := _locked_mirrors(ev, d)
	for i in lk:
		var rm2: ShaderMaterial = rail_mats[i]
		create_tween().tween_method(func(v: float) -> void: rm2.set_shader_parameter("locked", v), 1.0, 0.0, 0.7)
	if not lk.is_empty(): mirror_locked.emit()
	await get_tree().create_timer(ROLL_T + 0.02).timeout
	# --- after the roll: bodies at their OWN-step tiles (not yet carried)
	var stepped: Array = []
	for i in eids.size():
		var e0: Vector2i = ev["eid_from"][i]
		stepped.append(e0 + ev["eid_dir"][i] if ev["eid_step"][i] else e0)
	cube.transform = Transform3D(_right_angles(cube.transform.basis), tile_pos(ns["cube"], H))
	for i in eids.size():
		eids[i].transform = Transform3D(_right_angles(eids[i].transform.basis), tile_pos(stepped[i], H))
		eid_glows[i].position = tile_pos(stepped[i], 0.03)
	# --- the carry: continuous glide across every tile, afterimages + tether
	if any_carry:
		for i in eids.size():
			var path: Array = ev["eid_carry"][i]
			if path.is_empty():
				if ev["slid"][i] != 0:
					var v: int = ev["slid"][i]
					_bump(eids[i], Vector2i(v, 0) if rules.axis_k(i) == 0 else Vector2i(0, v))
				continue
			var pts: Array[Vector3] = [tile_pos(stepped[i], H)]
			for t in path: pts.append(tile_pos(t, H))
			var e := eids[i]
			var g := eid_glows[i]
			var basis := e.transform.basis
			var axis_m := Vector3(-1, 1, 1) if rules.mirrors[i]["axis"] == "x" else Vector3(1, 1, -1)
			var mi := i
			var tm := tether_mats[i]
			var passed := [0]
			_afterimage(pts[0], basis, axis_m)
			_shimmer(i, CARRY_T + 0.15)
			var f := func(t: float) -> void:
				var u := t * t * (3.0 - 2.0 * t) * float(pts.size() - 1)
				var k := mini(int(u), pts.size() - 2)
				var pos := pts[k].lerp(pts[k + 1], u - k)
				e.position = pos
				g.position = Vector3(pos.x, 0.03, pos.z)
				while passed[0] < int(u) and passed[0] < pts.size() - 1:
					passed[0] += 1
					_afterimage(pts[passed[0]], basis, axis_m)
				# tether from the glass (same row/column as the Eidolon) to the Eidolon
				var mw := mirror_roots[mi].position
				var anchor := Vector3(mw.x, 0.05, pos.z) if rules.mirrors[mi]["axis"] == "x" else Vector3(pos.x, 0.05, mw.z)
				_set_tether(mi, true, anchor, Vector3(pos.x, 0.05, pos.z))
				tm.set_shader_parameter("intensity", sin(t * PI) * 0.9 + 0.1)
			var ct := create_tween()
			ct.tween_method(f, 0.0, 1.0, CARRY_T)
			ct.tween_callback(func() -> void: _set_tether(mi, false))
		await get_tree().create_timer(CARRY_T + 0.02).timeout
	elif any_slide:
		await get_tree().create_timer(0.12).timeout
	state = Rules.copy_state(ns)
	_snap_bodies()
	for i in mirror_roots.size():
		mirror_roots[i].position = _mirror_world(i, state["mpos"][i])
	for i in rail_mats:
		rail_mats[i].set_shader_parameter("pos", float(state["mpos"][i] - rules.mirrors[i]["rail"].x))
	update_lit()
	busy = false
	turn_finished.emit()

## Snap a basis to exact right angles so bodies keep their tumble but no drift accumulates.
func _right_angles(b: Basis) -> Basis:
	var cols := [b.x, b.y, b.z]
	for k in 3:
		var v: Vector3 = cols[k]
		var a := v.abs()
		if a.x >= a.y and a.x >= a.z: cols[k] = Vector3(signf(v.x), 0, 0)
		elif a.y >= a.z: cols[k] = Vector3(0, signf(v.y), 0)
		else: cols[k] = Vector3(0, 0, signf(v.z))
	return Basis(cols[0], cols[1], cols[2])

func _snap_bodies() -> void:
	cube.transform = Transform3D(_right_angles(cube.transform.basis), tile_pos(state["cube"], H))
	for i in eids.size():
		eids[i].transform = Transform3D(_right_angles(eids[i].transform.basis), tile_pos(state["eids"][i], H))
		eid_glows[i].position = tile_pos(state["eids"][i], 0.03)

func _roll(node: Node3D, d: Vector2i, dur: float, is_cube: bool) -> void:
	var dir := Vector3(d.x, 0, d.y)
	var start := node.transform
	var pivot := start.origin + dir * H - Vector3(0, H, 0)
	var axis := Vector3.UP.cross(dir).normalized()
	var extra := dir * (1.0 - CUBE)
	var glow: MeshInstance3D = null
	if not is_cube: glow = eid_glows[eids.find(node)]
	var landed := [false]
	var f := func(t: float) -> void:
		var e := t * t * (3.0 - 2.0 * t)
		e = e * e * (3.0 - 2.0 * e) * 0.35 + e * 0.65
		var rot := Transform3D(Basis(axis, e * PI * 0.5), Vector3.ZERO)
		var tr := Transform3D(Basis(), pivot) * rot * Transform3D(Basis(), -pivot) * start
		tr.origin += extra * e
		node.transform = tr
		if glow: glow.position = Vector3(tr.origin.x, 0.03, tr.origin.z)
		if is_cube and t >= 0.999 and not landed[0]:
			landed[0] = true
	var tw := create_tween()
	tw.tween_method(f, 0.0, 1.0, dur)
	if is_cube:
		tw.tween_callback(func() -> void:
			var at := start.origin + dir
			dust.position = Vector3(at.x, 0.02, at.z)
			dust.restart()
			cube_landed.emit(at))

func _bump(node: Node3D, d: Vector2i) -> void:
	var dir := Vector3(d.x, 0, d.y)
	var start := node.transform
	var pivot := start.origin + dir * H - Vector3(0, H, 0)
	var axis := Vector3.UP.cross(dir).normalized()
	var f := func(t: float) -> void:
		var a := sin(t * PI) * 0.13
		node.transform = Transform3D(Basis(), pivot) * Transform3D(Basis(axis, a), Vector3.ZERO) * Transform3D(Basis(), -pivot) * start
	var tw := create_tween()
	tw.tween_method(f, 0.0, 1.0, 0.2)
	tw.tween_callback(func() -> void: node.transform = start)

signal eidolon_glitched

## De-sync tell: the reflection tears and flashes when it is held back while the cube moves on.
func _glitch(i: int) -> void:
	eidolon_glitched.emit()
	for m in [eid_mats[i * 2], eid_mats[i * 2 + 1]]:
		var mm: ShaderMaterial = m
		var tw := create_tween()
		tw.tween_method(func(v: float) -> void: mm.set_shader_parameter("glitch", v), 1.0, 0.0, 0.5).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)

func _shimmer(i: int, dur: float) -> void:
	for m in [eid_mats[i * 2], eid_mats[i * 2 + 1]]:
		var mm: ShaderMaterial = m
		var tw := create_tween()
		tw.tween_method(func(v: float) -> void: mm.set_shader_parameter("shimmer", v), 1.0, 0.0, dur)

# ------------------------------------------------------------------ level transitions
func set_rise(v: float) -> void:
	island_mat.set_shader_parameter("rise", v)
	var off := (1.0 - _ease_out(clampf((v - 0.35) / 0.65, 0.0, 1.0))) * 16.0
	for c in get_children():
		if c is Node3D and c.name != "Island":
			c.set_meta("rise_off", off)
	_apply_offsets(off)
	_fade_extras(clampf((v - 0.55) / 0.45, 0.0, 1.0))

func set_dissolve(v: float) -> void:
	island_mat.set_shader_parameter("dissolve", v)
	_apply_offsets(v * v * 5.0)
	_fade_extras(1.0 - clampf(v * 1.6, 0.0, 1.0))

var _base_y := {}
func _apply_offsets(off: float) -> void:
	for c in get_children():
		if c.name == "Island" or not (c is Node3D) or c == dust or c == motes: continue
		if not _base_y.has(c): _base_y[c] = c.position.y
		c.position.y = _base_y[c] - off

func _fade_extras(a: float) -> void:
	for i in eid_mats.size():
		eid_mats[i].set_shader_parameter("strength", a * (1.3 if i % 2 == 1 else 1.0))
	for m in mirror_mats:
		m.set_shader_parameter("ripple", (1.0 - a) * 0.0)
	for g in eid_glows:
		(g.material_override as ShaderMaterial).set_shader_parameter("intensity", 0.42 * a)
	for h in halo_mats: h.set_shader_parameter("intensity", 0.4 * a)
	for b in beam_mats: b.set_shader_parameter("fade", a)
	_extras_alpha = a
	for m in sigil_mats: m.set_shader_parameter("alpha_mul", a)
	# fully sunk into the fog: hide everything but the (discarded) island so nothing lingers on menus;
	# restore exactly what was visible when it rises again
	if a <= 0.01 and _sunk.is_empty():
		for c in get_children():
			if c.name == "Island" or c == dust or not (c as Node3D).visible: continue
			_sunk.append(c)
			(c as Node3D).visible = false
	elif a > 0.01 and not _sunk.is_empty():
		for c in _sunk: (c as Node3D).visible = true
		_sunk.clear()

func _ease_out(t: float) -> float:
	return 1.0 - pow(1.0 - t, 3.0)

func pulse_win() -> void:
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		var p := sin(v * PI)
		cube_mat.set_shader_parameter("pulse", p)
		for m in eid_mats: m.set_shader_parameter("pulse", p)
		for b in beam_mats: b.set_shader_parameter("lit", 1.0 + p * 0.6)
		cube.scale = Vector3.ONE * (1.0 + 0.06 * p)
		, 0.0, 1.0, 0.9)
	tw.tween_method(func(v: float) -> void:
		var p := sin(v * PI) * 0.6
		cube_mat.set_shader_parameter("pulse", p)
		for m in eid_mats: m.set_shader_parameter("pulse", p)
		, 0.0, 1.0, 0.9)
