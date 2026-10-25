class_name Level
extends Node3D
## The floating marble island complex: five connected spaces plus bridges, stairs and a shortcut.
## Geometry is merged per space into single meshes (one draw call each), columns / stumps / debris are
## MultiMeshes. Walking is resolved against axis-aligned WALK REGIONS (flat or ramps) and obstacles
## (circles / rects): the borders of the walkable union act as invisible walls, so you never fall.
##
##   T  The Veiled Gate      x[-5,5]   z[-5,5]     y 0   (wake, reflecting pool, veiled statues)
##   B1 bridge + stair     x[-1.2,1.2] z[-11,-5] y 0->1
##   H  The Hall of Glass  x[-5,5]   z[-21,-11]  y 1   (mirrors, polished black floor)
##   HG bridge             x[5,7]    z[-14,-12]  y 1
##   G  Garden of the Veiled  x[7,17]   z[-15,-5]   y 1   (dead trees, rune statues, rune door)
##   A/B shortcut          x[5,9.5]  z[-5,-1]    y 1->0 (gate back into the Veiled Gate)
##   P  stair passage      x[11,13]  z[-17,-15]  y 1->2 (behind the rune door)
##   L  Court of Light    x[7,17]   z[-27,-17]  y 2   (beam + three mirror stands)
##   LB drawbridge         x[17,21]  z[-23,-21]  y 2
##   E  The Eidolon ledge  x[21,29]  z[-25,-19]  y 2   (the great glass)
##   EB risen bridge       x[26.8,28.6] z[-28,-25] y 2
##   S  The Shrine         x[20,30]  z[-36,-28]  y 2

signal read(text: String, script: Array)

class Region:
	var r: Rect2
	var y0 := 0.0
	var y1 := 0.0
	var axis := -1
	var enabled := true
	var name := ""
	func height(p: Vector2) -> float:
		if axis < 0: return y0
		var k: float
		if axis == 0: k = (p.x - r.position.x) / r.size.x
		else: k = (p.y - r.position.y) / r.size.y
		return lerpf(y0, y1, clampf(k, 0.0, 1.0))
	func has(p: Vector2) -> bool:
		return p.x >= r.position.x and p.x <= r.end.x and p.y >= r.position.y and p.y <= r.end.y

class Obstacle:
	var circle := true
	var c := Vector2.ZERO
	var rad := 0.0
	var r: Rect2
	var enabled := true
	var name := ""

class Interact:
	var id := ""
	var pos := Vector3.ZERO
	var radius := 1.25
	var icon := "read"
	var enabled := true
	var action: Callable
	var cond: Callable

var regions: Array[Region] = []
var obstacles: Array[Obstacle] = []
var interacts: Array[Interact] = []
var zones := {}
var marble_mat: ShaderMaterial
var noise_tex: ImageTexture
var col_full: Array[Transform3D] = []
var col_stump: Array[Transform3D] = []
var debris: Array[Transform3D] = []
var blobs: Array[Transform3D] = []        # contact shadows (round)
var strips: Array[Transform3D] = []       # ambient occlusion along wall bases
var cloths: Array[Transform3D] = []       # cloth veils hung on statues
var rays: Array = []                      # god rays: [position, length]
var rng := RandomNumberGenerator.new()
var markers: Array = []
var inscr_mats: Array = []
var named := {}          # name -> Region / Obstacle for puzzles to toggle
var occluders: Array[AABB] = []    # v0.6: boxes that may hide the wanderer (the see-through reveal)
## v0.7 SOLIDS: every prop and piece of architecture that stands in your way gets a footprint obstacle.
## auto_solids() audits each primitive's bounds against the walk regions and adds what is missing;
## those obstacles live in a coarse grid (they never move), the hand-made ones in `obstacles`.
var solid_obs: Array[Obstacle] = []
var _grid := {}
const GRID := 3.0
var audit := {}

const WAKE_POS := Vector3(1.4, 0.0, 2.3)
const SHRINE_C := Vector3(25.0, 2.0, -32.6)
## "up the screen" at the default view: where the journey goes on
const BEYOND_FWD := Vector3(0.7071, 0.0, -0.7071)
const BEYOND_RIGHT := Vector3(0.7071, 0.0, 0.7071)
const SECOND_SHRINE := Vector3(45.5, 2.5, -54.5)

var beyond: Node3D
var grass_mmi: MMGroup

## A MultiMesh split into spatial cells (v0.3 perf): each cell is its own MultiMeshInstance3D with a
## tight AABB, so the cells off screen (and out of the shadow frustum) are culled instead of the whole
## world's columns / grass / decals being drawn every frame. Forwards the GeometryInstance3D settings.
class MMGroup extends Node3D:
	const CELL := 20.0
	var parts: Array[MultiMeshInstance3D] = []
	var material_override: Material:
		set(v):
			material_override = v
			for p in parts: p.material_override = v
	var cast_shadow := GeometryInstance3D.SHADOW_CASTING_SETTING_ON:
		set(v):
			cast_shadow = v
			for p in parts: p.cast_shadow = v
	## keep a fraction of the instances in every cell (low quality)
	func set_fraction(f: float) -> void:
		for p in parts: p.multimesh.visible_instance_count = -1 if f >= 1.0 else int(p.multimesh.instance_count * f)
	func instance_count() -> int:
		var n := 0
		for p in parts: n += p.multimesh.instance_count
		return n

static func yaw_to(from: Vector3, to: Vector3) -> float:
	return atan2(-(to.x - from.x), -(to.z - from.z))

static func R(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Rect2(minf(x0, x1), minf(z0, z1), absf(x1 - x0), absf(z1 - z0))

func _init(tex: ImageTexture) -> void:
	noise_tex = tex
	rng.seed = 90210
	marble_mat = ShaderMaterial.new()
	marble_mat.shader = preload("res://shaders/marble.gdshader")
	marble_mat.set_shader_parameter("noise_tex", noise_tex)

func build() -> void:
	_veiled_gate()
	_bridge_b1()
	_hall()
	_garden()
	_shortcut()
	_court()
	_ledge()
	_shrine_platform()
	_far_ruins()
	_sealed_way()
	Ch1Geo.build(self)
	_beyond()

## called after the puzzles have added their pieces
func commit() -> void:
	_commit()

# ================================================================== walking
func walk(r: Rect2, y0: float, y1 := NAN, axis := -1, name := "", enabled := true) -> Region:
	var g := Region.new()
	g.r = r; g.y0 = y0; g.y1 = y0 if is_nan(y1) else y1; g.axis = axis; g.name = name; g.enabled = enabled
	regions.append(g)
	if name != "": named[name] = g
	return g

func ob_circle(c: Vector2, rad: float, name := "") -> Obstacle:
	var o := Obstacle.new()
	o.circle = true; o.c = c; o.rad = rad; o.name = name
	obstacles.append(o)
	if name != "": named[name] = o
	return o

func ob_rect(r: Rect2, name := "", enabled := true) -> Obstacle:
	var o := Obstacle.new()
	o.circle = false; o.r = r; o.name = name; o.enabled = enabled
	obstacles.append(o)
	if name != "": named[name] = o
	return o

func set_enabled(name: String, on: bool) -> void:
	if named.has(name): named[name].enabled = on

func region_at(p: Vector2) -> Region:
	var best: Region = null
	for g in regions:
		if g.enabled and g.has(p):
			if best == null or g.height(p) > best.height(p): best = g
	return best

func on_ground(p: Vector2) -> bool:
	return region_at(p) != null

func height_at(p: Vector2) -> float:
	var g := region_at(p)
	return g.height(p) if g else 0.0

func circle_ok(p: Vector2, rad: float) -> bool:
	if not on_ground(p): return false
	for k in 8:
		var a := TAU * k / 8.0
		if not on_ground(p + Vector2(cos(a), sin(a)) * rad): return false
	return true

func _near_solids(p: Vector2, rad: float) -> Array:
	var out := []
	var c0 := Vector2i(floori((p.x - rad - 0.6) / GRID), floori((p.y - rad - 0.6) / GRID))
	var c1 := Vector2i(floori((p.x + rad + 0.6) / GRID), floori((p.y + rad + 0.6) / GRID))
	for gx in range(c0.x, c1.x + 1):
		for gz in range(c0.y, c1.y + 1):
			var k := Vector2i(gx, gz)
			if _grid.has(k): out.append_array(_grid[k])
	return out

func _overlaps(o: Obstacle, p: Vector2, rad: float) -> bool:
	if o.circle: return p.distance_to(o.c) < o.rad + rad - 0.001
	var q := Vector2(clampf(p.x, o.r.position.x, o.r.end.x), clampf(p.y, o.r.position.y, o.r.end.y))
	return p.distance_to(q) < rad - 0.001

func blocked(p: Vector2, rad: float) -> bool:
	for o: Obstacle in _near_solids(p, rad):
		if _overlaps(o, p, rad): return true
	for o in obstacles:
		if not o.enabled: continue
		if o.circle:
			if p.distance_to(o.c) < o.rad + rad - 0.001: return true
		else:
			var q := Vector2(clampf(p.x, o.r.position.x, o.r.end.x), clampf(p.y, o.r.position.y, o.r.end.y))
			if p.distance_to(q) < rad - 0.001: return true
	return false

func push_out(p: Vector2, rad: float) -> Vector2:
	var near := _near_solids(p, rad + 0.5)
	for it in 3:
		for o: Obstacle in obstacles + near:
			if not o.enabled: continue
			if o.circle:
				var d := p - o.c
				var L := d.length()
				var need := o.rad + rad
				if L < need:
					p = o.c + (d / L if L > 0.0001 else Vector2.RIGHT) * need
			else:
				var q := Vector2(clampf(p.x, o.r.position.x, o.r.end.x), clampf(p.y, o.r.position.y, o.r.end.y))
				var d2 := p - q
				var L2 := d2.length()
				if L2 < rad:
					if L2 > 0.0001:
						p = q + d2 / L2 * rad
					else:
						# inside the rect: leave by the nearest side
						var dl := p.x - o.r.position.x; var dr := o.r.end.x - p.x
						var dt := p.y - o.r.position.y; var db := o.r.end.y - p.y
						var m := minf(minf(dl, dr), minf(dt, db))
						if m == dl: p.x = o.r.position.x - rad
						elif m == dr: p.x = o.r.end.x + rad
						elif m == dt: p.y = o.r.position.y - rad
						else: p.y = o.r.end.y + rad
	return p

## Resolve one movement step. Never leaves the walkable union, never enters an obstacle, never
## climbs or drops more than a stair step.
func move(pos: Vector3, d: Vector3, rad: float) -> Vector3:
	var p := Vector2(pos.x, pos.z)
	var dd := Vector2(d.x, d.z)
	var stuck := blocked(p, rad)      # recover gracefully if we ever start inside something
	for cand in [p + dd, p + Vector2(dd.x, 0.0), p + Vector2(0.0, dd.y)]:
		var q := push_out(cand, rad)
		if not stuck and q.distance_to(p) > dd.length() + 0.05: continue
		if circle_ok(q, rad) and not blocked(q, rad) and absf(height_at(q) - pos.y) < 0.3:
			return Vector3(q.x, height_at(q), q.y)
	return Vector3(p.x, height_at(p), p.y)

## v0.7: the collision audit. `roots`: the nodes whose static props (meshes built by MB that are direct
## children) are audited besides the level's own zones, columns, stumps and rubble. A primitive is SOLID
## where it rises more than 0.18 m above a walk region it stands over and starts below 1.7 m (overhead
## arches, lintels and pans are not); if no existing obstacle already covers its footprint, one is added.
## Returns (and keeps in `audit`) the list of solids for the tests: [Rect2 footprint, round, y0, y1, dynamic, what].
const SKIP_ZONES := ["Zone_Hdoor", "Zone_GLs", "Zone_ECs", "Zone_Mural"]
func auto_solids(roots: Array) -> Dictionary:
	var t0 := Time.get_ticks_msec()
	var parts := []                 # [AABB world, round, dynamic, what]
	for root in [self] + roots:
		_collect_parts(root, root, parts)
	var mm := [[col_full, AABB(Vector3(-0.43, 0.0, -0.43), Vector3(0.86, 3.8, 0.86)), "column"],
		[col_stump, AABB(Vector3(-0.43, 0.0, -0.43), Vector3(0.86, 1.1, 0.86)), "stump"],
		[debris, AABB(Vector3(-0.5, -0.5, -0.5), Vector3.ONE), "rubble"]]
	for e in mm:
		for xf in e[0]: parts.append([(xf as Transform3D) * (e[1] as AABB), true, false, e[2]])
	var solids := []
	var added := 0
	for pa in parts:
		var bb: AABB = pa[0]
		var fr := Rect2(bb.position.x, bb.position.z, bb.size.x, bb.size.z)
		if fr.size.x < 0.04 or fr.size.y < 0.04: continue
		var c := fr.get_center()
		# the floor under it: the highest region over its centre, or over any of it
		var h := -INF
		var top_here := -INF
		for g in regions:
			if g.r.has_point(c): top_here = maxf(top_here, g.height(c))
			if g.r.intersects(fr):
				var q := Vector2(clampf(c.x, g.r.position.x, g.r.end.x), clampf(c.y, g.r.position.y, g.r.end.y))
				h = maxf(h, g.height(q))
		if h == -INF: continue
		if top_here >= bb.end.y - 0.18: continue            # you stand ON it (a plinth with its own floor, a lift)
		if bb.end.y <= h + 0.18 or bb.position.y >= h + 1.7: continue
		var round: bool = pa[1]
		solids.append([fr, round, bb.position.y, bb.end.y, pa[2], pa[3]])
		if pa[2]: continue                                  # moving things carry their own obstacles
		if _covered(fr, round): continue
		var o := Obstacle.new()
		if round:
			o.circle = true; o.c = c; o.rad = (fr.size.x + fr.size.y) * 0.25
		else:
			o.circle = false; o.r = fr
		o.name = "solid:" + str(pa[3])
		solid_obs.append(o)
		var g0 := Vector2i(floori(fr.position.x / GRID), floori(fr.position.y / GRID))
		var g1 := Vector2i(floori(fr.end.x / GRID), floori(fr.end.y / GRID))
		for gx in range(g0.x, g1.x + 1):
			for gz in range(g0.y, g1.y + 1):
				var k := Vector2i(gx, gz)
				if not _grid.has(k): _grid[k] = []
				_grid[k].append(o)
		added += 1
	audit = {"parts": parts.size(), "solids": solids, "added": added, "ms": Time.get_ticks_msec() - t0}
	return audit

func _collect_parts(n: Node, root: Node, out: Array) -> void:
	for ch in n.get_children():
		if ch is MeshInstance3D:
			var mi := ch as MeshInstance3D
			if mi.mesh and mi.mesh.has_meta("parts") and mi.layers != PlanarMirror.LAYER_DOUBLE and not (mi.name in SKIP_ZONES) and mi.visible:
				var dyn := n != root
				var what := str(mi.name) if n == root else str(n.name)
				for pt in mi.mesh.get_meta("parts"):
					if pt[1] == "floor": continue
					out.append([mi.global_transform * (pt[0] as AABB), pt[2], dyn, what])
		if ch is Node3D and not (ch is MeshInstance3D) and (ch as Node3D).visible and not ch is Level:
			_collect_parts(ch, root, out)

## is this footprint already inside one obstacle?
func _covered(fr: Rect2, round: bool) -> bool:
	var corners := [fr.position, Vector2(fr.end.x, fr.position.y), fr.end, Vector2(fr.position.x, fr.end.y)]
	if round:
		var c := fr.get_center()
		var rr := (fr.size.x + fr.size.y) * 0.25
		corners = [c + Vector2(rr, 0) * 0.85, c - Vector2(rr, 0) * 0.85, c + Vector2(0, rr) * 0.85, c - Vector2(0, rr) * 0.85]
	for o: Obstacle in obstacles + _near_solids(fr.get_center(), maxf(fr.size.x, fr.size.y)):
		if not o.enabled: continue
		var all_in := true
		for q in corners:
			if o.circle:
				if q.distance_to(o.c) > o.rad + 0.02: all_in = false
			elif not o.r.grow(0.02).has_point(q): all_in = false
			if not all_in: break
		if all_in: return true
	return false

func interact_by_id(id: String) -> Interact:
	for it in interacts:
		if it.id == id: return it
	return null

func add_interact(id: String, pos: Vector3, icon: String, action: Callable, radius := 1.25, cond := Callable()) -> Interact:
	var it := Interact.new()
	it.id = id; it.pos = pos; it.icon = icon; it.action = action; it.radius = radius; it.cond = cond
	interacts.append(it)
	return it

## a readable inscription: lines of the sculptor's unknown script engraved on `marker` (a quad of
## `size` metres); reading it shows the same text large, with its translation
func inscription(id: String, pos: Vector3, text: String, radius := 1.3, marker := Transform3D(), size := Vector2(0.62, 0.8)) -> Interact:
	var seed := float(absi(id.hash()) % 997) + 1.0
	var cols := maxf(4.0, roundf(size.x / 0.115))
	var rows := maxf(3.0, roundf(size.y / 0.17))
	var aspect := (size.x / cols) / (size.y / rows)
	var info := [seed, rows, cols, aspect, size.x / size.y]
	if marker != Transform3D(): markers.append([marker, size, info, pos])
	return add_interact(id, pos, "read", func() -> void: read.emit(text, info), radius)

func _markers() -> void:
	var sh := preload("res://shaders/inscription.gdshader")
	for mk in markers:
		var info: Array = mk[2]
		var m := ShaderMaterial.new()
		m.shader = sh
		m.set_shader_parameter("seed", info[0])
		m.set_shader_parameter("rows", info[1])
		m.set_shader_parameter("cols", info[2])
		m.set_shader_parameter("aspect", info[3])
		var q := QuadMesh.new()
		q.size = mk[1]
		var mi := MeshInstance3D.new()
		mi.mesh = q
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		# v0.5b: never coplanar with the stone it is carved in (z-fighting on phones): 6 mm proud
		var xf: Transform3D = mk[0]
		mi.transform = Transform3D(xf.basis, xf.origin + xf.basis.z.normalized() * 0.006)
		m.render_priority = 1
		add_child(mi)
		inscr_mats.append([m, mk[3]])

## the grooves glow brighter as the wanderer comes near
func update_inscriptions(p: Vector3) -> void:
	for e in inscr_mats:
		var m: ShaderMaterial = e[0]
		var at: Vector3 = e[1]
		var d := Vector2(at.x - p.x, at.z - p.z).length()
		m.set_shader_parameter("near", (1.0 - smoothstep(1.2, 4.5, d)) * (1.0 if absf(at.y - p.y) < 1.5 else 0.0))

# ================================================================== geometry helpers
func mb(zone: String) -> MB:
	if not zones.has(zone): zones[zone] = MB.new()
	return zones[zone]

func C(mat: float, occ := false) -> Color:
	return Color(rng.randf(), mat, 1.0 if occ else 0.0, 1.0)

func slab(zone: String, r: Rect2, top: float, thick := 0.7, mat := 0.0, under := true) -> void:
	var m := mb(zone)
	m.tag = "floor"
	m.box(Vector3(r.get_center().x, top - thick * 0.5, r.get_center().y), Vector3(r.size.x, thick, r.size.y), C(mat))
	m.tag = ""
	if under: underside(zone, r, top - thick)

func underside(zone: String, r: Rect2, y: float) -> void:
	var m := mb(zone)
	m.tag = "floor"
	var area := r.size.x * r.size.y
	var inset := Rect2(r.position + r.size * 0.12, r.size * 0.76)
	m.box(Vector3(r.get_center().x, y - 0.35, r.get_center().y), Vector3(r.size.x * 0.9, 0.7, r.size.y * 0.9), C(0.5))
	var count := clampi(int(area / 9.0), 1, 9)
	for i in count:
		var c := Vector2(rng.randf_range(inset.position.x, inset.end.x), rng.randf_range(inset.position.y, inset.end.y))
		var rt := minf(r.size.x, r.size.y) * rng.randf_range(0.22, 0.42)
		var h := rng.randf_range(1.8, 4.8) * clampf(rt, 0.6, 2.0)
		m.cyl(Vector3(c.x, y - 0.6 - h * 0.5, c.y), rt, rt * 0.12, h, C(0.5), 7, Basis(Vector3.UP, rng.randf() * TAU))
	m.tag = ""

func box(zone: String, center: Vector3, size: Vector3, mat := 0.25, occ := false, basis := Basis()) -> void:
	mb(zone).box(center, size, C(mat, occ), basis)
	if occ:
		var e := Vector3.ZERO
		for k in 3: e += (basis[k] * size[k] * 0.5).abs()
		occluders.append(AABB(center - e, e * 2.0))

func wall(zone: String, r: Rect2, y0: float, y1: float, occ := true) -> void:
	# ambient occlusion along both long faces at the floor
	var long_x := r.size.x >= r.size.y
	var L := maxf(r.size.x, r.size.y)
	for sgn in [-1.0, 1.0]:
		var c := Vector3(r.get_center().x, y0 + 0.013, r.get_center().y)
		if long_x: c.z += sgn * (r.size.y * 0.5 + 0.3)
		else: c.x += sgn * (r.size.x * 0.5 + 0.3)
		var b := Basis.from_scale(Vector3(L + 0.6, 1.0, 0.75)) if long_x else Basis(Vector3.UP, PI * 0.5) * Basis.from_scale(Vector3(L + 0.6, 1.0, 0.75))
		strips.append(Transform3D(b, c))
	box(zone, Vector3(r.get_center().x, (y0 + y1) * 0.5, r.get_center().y), Vector3(r.size.x, y1 - y0, r.size.y), 0.25, occ)
	# a moulded coping along the top, and a thinner cornice line beneath it
	box(zone, Vector3(r.get_center().x, y1 + 0.06, r.get_center().y), Vector3(r.size.x + 0.12, 0.12, r.size.y + 0.12), 0.25, occ)
	box(zone, Vector3(r.get_center().x, y1 - 0.28, r.get_center().y), Vector3(r.size.x + 0.07, 0.07, r.size.y + 0.07), 0.25, occ)
	if y1 - y0 > 1.5:
		box(zone, Vector3(r.get_center().x, y0 + 0.12, r.get_center().y), Vector3(r.size.x + 0.08, 0.24, r.size.y + 0.08), 0.25, occ)

func blob(at: Vector3, size: float) -> void:
	blobs.append(Transform3D(Basis().scaled(Vector3(size, 1.0, size)), at + Vector3(0, 0.012, 0)))

func column(base: Vector3, h := 3.8, ob := true) -> void:
	blob(base, 1.7)
	var s := h / 3.8
	col_full.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(1.0, s, 1.0)), base))
	occluders.append(AABB(base - Vector3(0.42, 0.0, 0.42), Vector3(0.84, h, 0.84)))
	if ob: ob_circle(Vector2(base.x, base.z), 0.38)

func stump(base: Vector3, h := 1.0, ob := true, tilt := 0.0) -> void:
	blob(base, 1.5)
	var b := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.RIGHT, tilt)
	col_stump.append(Transform3D(b.scaled(Vector3(1.0, h, 1.0)), base))
	if ob: ob_circle(Vector2(base.x, base.z), 0.38)

func rubble(c: Vector3, spread: float, count: int) -> void:
	for i in count:
		var p := c + Vector3(rng.randf_range(-spread, spread), 0.0, rng.randf_range(-spread, spread))
		var s := rng.randf_range(0.12, 0.38)
		var b := Basis.from_euler(Vector3(rng.randf() * 0.6, rng.randf() * TAU, rng.randf() * 0.6)).scaled(Vector3(s * rng.randf_range(0.8, 1.6), s, s * rng.randf_range(0.8, 1.4)))
		debris.append(Transform3D(b, p + Vector3(0, s * 0.3, 0)))

func statue(zone: String, base: Vector3, yaw: float, sc := 1.0, plinth := 0.6, ob := true) -> void:
	## A veiled woman on a plinth, hands folded. Every statue has the same veiled face.
	var m := mb(zone)
	var B := Basis(Vector3.UP, yaw)
	var col := C(0.25, true)
	var pc := Color(col.r, 0.25, 1.0)
	var o := base
	blob(base, 1.9 * sc)
	# a real cloth veil hangs down the statue's back from the crown
	var top := o + Vector3(0, plinth + 0.08 + 2.22 * sc, 0) + B * Vector3(0, 0, 0.12 * sc)
	cloths.append(Transform3D(B * Basis(Vector3.RIGHT, 0.10) * Basis.from_scale(Vector3(0.30 * sc, 1.3 * sc, 1.0)), top))
	m.box(o + Vector3(0, plinth * 0.5, 0), Vector3(0.95 * sc, plinth, 0.95 * sc), pc, B)
	m.box(o + Vector3(0, plinth + 0.04, 0), Vector3(1.08 * sc, 0.08, 1.08 * sc), pc, B)
	var y := o.y + plinth + 0.08
	var at := func(x: float, yy: float, z: float) -> Vector3: return Vector3(o.x, y, o.z) + B * (Vector3(x, yy, z) * sc)
	# robe falling to the plinth, a slight contrapposto
	m.cyl(at.call(0, 0.62, 0), 0.25 * sc, 0.34 * sc, 1.24 * sc, pc, 14, B * Basis(Vector3.BACK, 0.03))
	m.cyl(at.call(0, 1.5, 0.01), 0.27 * sc, 0.23 * sc, 0.56 * sc, pc, 14, B)
	m.sphere(at.call(0, 1.78, 0.01), Vector3(0.30, 0.10, 0.19) * sc, pc, 14, 5, B)
	# arms folded over the breast, hands clasped
	for sx in [-1.0, 1.0]:
		m.cyl(at.call(sx * 0.27, 1.55, 0.0), 0.065 * sc, 0.075 * sc, 0.46 * sc, pc, 8, B * Basis(Vector3.BACK, sx * 0.12))
		m.cyl(at.call(sx * 0.13, 1.36, -0.13), 0.06 * sc, 0.065 * sc, 0.34 * sc, pc, 8, B * Basis(Vector3.BACK, -sx * 1.15) * Basis(Vector3.RIGHT, 0.3))
	m.sphere(at.call(0, 1.33, -0.19), Vector3(0.09, 0.07, 0.07) * sc, pc, 8, 4, B)
	# veil: drapes from the crown over the shoulders; the face presses through the cloth
	var hb := B * Basis(Vector3.RIGHT, -0.20)
	m.cyl(at.call(0, 1.94, 0.02), 0.14 * sc, 0.25 * sc, 0.34 * sc, pc, 14, B)
	m.sphere(at.call(0, 2.12, 0.0), Vector3(0.155, 0.19, 0.17) * sc, pc, 14, 7, hb)
	m.sphere(at.call(0, 2.11, -0.075), Vector3(0.10, 0.13, 0.09) * sc, pc, 10, 5, hb)
	m.sphere(at.call(0, 2.19, 0.03), Vector3(0.165, 0.15, 0.17) * sc, pc, 12, 6, hb)
	if ob: ob_circle(Vector2(o.x, o.z), 0.6 * sc)

func tree(zone: String, base: Vector3, seed: int) -> void:
	var m := mb(zone)
	var r := RandomNumberGenerator.new()
	r.seed = seed
	blob(base, 1.9)
	# square stone planter
	box(zone, base + Vector3(0, 0.12, 0), Vector3(1.3, 0.24, 1.3), 0.25)
	box(zone, base + Vector3(0, 0.2, 0), Vector3(1.05, 0.2, 1.05), 1.0)
	_branch(m, r, base + Vector3(0, 0.2, 0), Vector3(r.randf_range(-0.1, 0.1), 1.0, r.randf_range(-0.1, 0.1)).normalized(), 1.5, 0.13, 4)
	ob_circle(Vector2(base.x, base.z), 0.72)

func _branch(m: MB, r: RandomNumberGenerator, p: Vector3, dir: Vector3, L: float, rad: float, depth: int) -> void:
	var up := dir.normalized()
	var side := up.cross(Vector3.FORWARD if absf(up.z) < 0.9 else Vector3.RIGHT).normalized()
	var b := Basis(side, up, side.cross(up)).orthonormalized()
	var b2 := Basis(b.x, b.y, b.z)
	m.cyl(p + up * L * 0.5, rad * 0.62, rad, L, C(1.0, true), 6, b2)
	var tip := p + up * L
	if depth <= 0: return
	var n := r.randi_range(2, 3)
	for i in n:
		var a := r.randf() * TAU
		var spread := r.randf_range(0.45, 0.9)
		var nd := (up * cos(spread) + (side.rotated(up, a)) * sin(spread)).normalized()
		nd.y = maxf(nd.y, -0.1)
		_branch(m, r, tip - up * 0.02, nd, L * r.randf_range(0.55, 0.75), rad * 0.62, depth - 1)

func balustrade(zone: String, a: Vector2, b: Vector2, y: float) -> void:
	var d := b - a
	var L := d.length()
	var B := Basis(Vector3.UP, -atan2(d.y, d.x))
	# some balustrades are broken: a gap in the rail, posts missing, a fallen piece below
	var g0 := 2.0
	var g1 := 2.0
	if L > 2.2 and rng.randf() < 0.3:
		g0 = rng.randf_range(0.25, 0.55)
		g1 = g0 + rng.randf_range(0.15, 0.3)
	var segs := [[0.0, minf(g0, 1.0)], [minf(g1, 1.0), 1.0]] if g0 < 1.0 else [[0.0, 1.0]]
	for sg in segs:
		var s0: float = sg[0]; var s1: float = sg[1]
		if s1 - s0 < 0.02: continue
		var mid := a + d * ((s0 + s1) * 0.5)
		var sl := L * (s1 - s0)
		box(zone, Vector3(mid.x, y + 0.5, mid.y), Vector3(sl, 0.1, 0.22), 0.25, false, B)
		box(zone, Vector3(mid.x, y + 0.56, mid.y), Vector3(sl, 0.03, 0.26), 0.25, false, B)
	var mid2 := (a + b) * 0.5
	box(zone, Vector3(mid2.x, y + 0.06, mid2.y), Vector3(L, 0.12, 0.2), 0.25, false, B)
	var posts := maxi(1, int(L / 0.42))
	for i in posts + 1:
		var k := float(i) / posts
		if k > g0 + 0.03 and k < g1 - 0.03: continue
		var q := a + d * k
		mb(zone).cyl(Vector3(q.x, y + 0.27, q.y), 0.055, 0.075, 0.42, C(0.25), 6)
	if g0 < 1.0:
		var fp := a + d * ((g0 + g1) * 0.5)
		var side := Vector2(-d.y, d.x).normalized() * 0.35
		box(zone, Vector3(fp.x + side.x, y + 0.05, fp.y + side.y), Vector3(L * (g1 - g0) * 0.8, 0.1, 0.2), 0.25, false, B * Basis(Vector3.UP, rng.randf_range(-0.4, 0.4)))
		rubble(Vector3(fp.x + side.x, y, fp.y + side.y), 0.25, 3)

func steps(zone: String, r: Rect2, axis: int, y_lo: float, y_hi: float, hi_at_max: bool) -> void:
	## visual stairs over a ramp region (the walk region is the ramp itself)
	var L := r.size.x if axis == 0 else r.size.y
	var n := maxi(2, int(round(L / 0.32)))
	for i in n:
		var t0 := float(i) / n
		var t1 := float(i + 1) / n
		var top := lerpf(y_lo, y_hi, (float(i) + 0.75) / n)
		var k0 := t0 if hi_at_max else 1.0 - t1
		var k1 := t1 if hi_at_max else 1.0 - t0
		var c: Vector3
		var s: Vector3
		if axis == 0:
			var x0 := r.position.x + k0 * L; var x1 := r.position.x + k1 * L
			c = Vector3((x0 + x1) * 0.5, (top + y_lo - 0.8) * 0.5, r.get_center().y)
			s = Vector3(x1 - x0 + 0.01, top - y_lo + 0.8, r.size.y)
		else:
			var z0 := r.position.y + k0 * L; var z1 := r.position.y + k1 * L
			c = Vector3(r.get_center().x, (top + y_lo - 0.8) * 0.5, (z0 + z1) * 0.5)
			s = Vector3(r.size.x, top - y_lo + 0.8, z1 - z0 + 0.01)
		mb(zone).tag = "floor"
		box(zone, c, s, 0.0)
		mb(zone).tag = ""
	underside(zone, r, y_lo - 0.8)

# ================================================================== the spaces
func _veiled_gate() -> void:
	var z := "T"
	# floor around the pool (the pool is a sunken basin)
	for r in [R(-5, -5, 5, -0.2), R(-5, 3.6, 5, 5), R(-0.6, -0.2, 5, 3.6)]:
		slab(z, r, 0.0, 0.7, 0.0, false)
	underside(z, R(-5, -5, 5, 5), -0.7)
	box(z, Vector3(-2.82, -0.75, 1.7), Vector3(4.44, 0.3, 3.8), 0.5)          # basin floor (v0.6: deeper)
	# v0.5: the pool is the Waking Pool: water from the island's middle out over the west edge
	walk(R(-5, -5, 5, -0.15), 0.0, NAN, -1, "T")
	walk(R(-5, 3.55, 5, 5), 0.0, NAN, -1, "T")
	walk(R(-0.65, -0.15, 5, 3.55), 0.0, NAN, -1, "T")
	# the broken stub of a bridge you came by, ending in the fog
	slab(z, R(-1, 5, 1, 7.6), 0.0, 0.5, 0.0)
	walk(R(-1, 5, 1, 7.3), 0.0, NAN, -1, "stub")
	rubble(Vector3(0, -0.6, 7.9), 0.8, 6)
	balustrade(z, Vector2(-1.05, 5.1), Vector2(-1.05, 7.0), 0.0)
	# the broken gateway you wake beneath
	column(Vector3(-1.5, 0, 4.6), 3.6)
	column(Vector3(1.5, 0, 4.6), 3.6)
	box(z, Vector3(-0.75, 3.85, 4.6), Vector3(2.1, 0.5, 0.7), 0.25, true, Basis(Vector3.BACK, 0.06))
	box(z, Vector3(2.75, 0.24, 3.45), Vector3(1.7, 0.48, 0.66), 0.25, false, Basis(Vector3.UP, 0.55))
	ob_rect(R(2.0, 2.95, 3.5, 3.95))
	rubble(Vector3(2.0, 0, 3.9), 0.7, 5)
	# veiled statues, all with the same face, all turned toward the pool
	var pc := Vector3(-2.4, 0, 1.7)
	for sp in [[Vector3(-3.8, 0, -3.8), 1.0], [Vector3(3.8, 0, -3.9), 1.0], [Vector3(4.0, 0, 1.2), 0.95], [Vector3(3.9, 0, 4.4), 0.9]]:
		statue(z, sp[0], yaw_to(sp[0], pc), sp[1])
	stump(Vector3(4.3, 0, -1.4), 1.3)
	stump(Vector3(-4.4, 0, -1.6), 0.7)
	for zz in [-0.45, 3.85]:
		box(z, Vector3(-4.95, 0.08, zz), Vector3(0.3, 0.16, 0.34), 0.25)
	stump(Vector3(1.9, 0, -4.4), 1.7, true, 0.05)
	rubble(Vector3(-4.0, 0, -1.0), 0.6, 5)
	# inscriptions
	box(z, Vector3(3.05, 0.62, 2.5), Vector3(0.95, 1.24, 0.24), 0.25, false, Basis(Vector3.UP, -0.5))
	box(z, Vector3(3.05, 1.28, 2.5), Vector3(1.05, 0.08, 0.3), 0.25, false, Basis(Vector3.UP, -0.5))
	ob_rect(R(2.62, 2.25, 3.48, 2.75))
	inscription("t_stele", Vector3(2.6, 0, 2.0), "Her face is not yours to carve.\nI broke the vow. Every face I gave her was wrong.", 1.3,
		Transform3D(Basis(Vector3.UP, -0.5), Vector3(3.05, 0.64, 2.5) + Basis(Vector3.UP, -0.5) * Vector3(0, 0, 0.125)), Vector2(0.84, 1.08))
	inscription("t_pool", Vector3(-0.1, 0, -0.5), "Still water keeps a likeness. Be still,\nand it will show the steps I hid.", 1.1,
		Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), Vector3(-0.1, 0.012, -0.62)), Vector2(1.15, 0.78))
	# exits: the arch to the north bridge, columns flanking
	column(Vector3(-1.6, 0, -5.0), 3.6, true)
	column(Vector3(1.6, 0, -5.0), 3.6, true)
	box(z, Vector3(0, 3.82, -5.0), Vector3(4.0, 0.55, 0.8), 0.25, true)
	# edge balustrades (low) where there is no exit
	balustrade(z, Vector2(-4.9, -4.9), Vector2(-2.2, -4.9), 0.0)
	balustrade(z, Vector2(2.2, -4.9), Vector2(4.9, -4.9), 0.0)
	balustrade(z, Vector2(4.95, -4.8), Vector2(4.95, -3.5), 0.0)
	balustrade(z, Vector2(4.95, -0.5), Vector2(4.95, 4.8), 0.0)

func _bridge_b1() -> void:
	## v0.5: the old way north has fallen: a stub, a gap, the top of the stair hanging from the hall
	var z := "B1"
	slab(z, R(-1.2, -6.3, 1.2, -5), 0.0, 0.6, 0.0)
	walk(R(-1.2, -6.3, 1.2, -5), 0.0, NAN, -1, "b1")
	rubble(Vector3(0, -0.5, -6.8), 0.7, 5)
	steps(z, R(-1.2, -9.5, 1.2, -8.2), 1, 0.4, 1.0, false)
	slab(z, R(-1.2, -11, 1.2, -9.5), 1.0, 0.6, 0.0)
	walk(R(-1.2, -11, 1.2, -9.5), 1.0)
	for x in [-1.3, 1.3]:
		balustrade(z, Vector2(x, -5.3), Vector2(x, -6.2), 0.0)
		balustrade(z, Vector2(x, -9.6), Vector2(x, -10.8), 1.0)
	balustrade(z, Vector2(-1.1, -9.45), Vector2(1.1, -9.45), 1.0)

func _hall() -> void:
	var z := "H"
	slab(z, R(-5, -21, 5, -11), 1.0, 0.8, 0.75)
	walk(R(-4.6, -20.6, 4.6, -11), 1.0, NAN, -1, "H")
	# far walls: north (with the great mirror) and east (with the doorway)
	wall("Hn", R(-5, -21, 5, -20.6), 1.0, 6.2)
	wall(z, R(4.6, -21, 5, -18.4), 1.0, 4.6)
	wall(z, R(4.6, -16.6, 5, -11), 1.0, 4.6)
	# v0.5: the remembered doorway: a wall today (its own mesh: hidden from the mirror, it opens)
	wall("Hdoor", R(4.6, -18.4, 5, -16.6), 1.0, 3.7)
	box(z, Vector3(4.8, 4.15, -17.5), Vector3(0.4, 0.9, 1.8), 0.25, true)
	walk(R(4.6, -18.2, 5.05, -16.8), 1.0, NAN, -1, "hdoor", false)
	box(z, Vector3(4.8, 4.0, -13.0), Vector3(0.4, 1.2, 2.0), 0.25, true)
	# mirror frame (dark bronze) around the great glass x[-2.6,2.6] y[1.15,5.6]
	for fb in [[Vector3(0, 1.1, -20.52), Vector3(5.5, 0.14, 0.12)], [Vector3(0, 5.66, -20.52), Vector3(5.5, 0.14, 0.12)],
			[Vector3(-2.68, 3.38, -20.52), Vector3(0.14, 4.6, 0.12)], [Vector3(2.68, 3.38, -20.52), Vector3(0.14, 4.6, 0.12)]]:
		box("Hn", fb[0], fb[1], 1.0, true)
	# pilasters on the north wall
	for x in [-4.0, 4.0]:
		box("Hn", Vector3(x, 3.6, -20.45), Vector3(0.6, 5.2, 0.3), 0.25, true)
	# colonnade on the open sides (west + south)
	for zz in [-12.2, -14.8, -17.4, -19.9]:
		column(Vector3(-4.5, 1.0, zz), 4.2)
	column(Vector3(-3.3, 1.0, -11.3), 4.2)
	column(Vector3(3.3, 1.0, -11.3), 4.2)
	# a fallen column across the north-east corner hides the low tablet
	# (v0.6: the old stump here is gone: the hall keeps only its fallen block and the things the glass remembers)
	box(z, Vector3(2.7, 1.3, -19.9), Vector3(0.62, 0.62, 1.9), 0.25, false, Basis(Vector3.UP, 1.2))
	ob_rect(R(1.95, -20.4, 3.4, -19.4))
	box(z, Vector3(4.35, 1.35, -19.9), Vector3(0.36, 0.7, 0.9), 0.25, false)
	rubble(Vector3(-3.5, 1.0, -19.6), 0.7, 6)
	rubble(Vector3(2.6, 1.0, -12.3), 0.5, 4)


func _garden() -> void:
	var z := "G"
	slab(z, R(7, -15, 17, -5), 1.0, 0.8, 0.0)
	walk(R(7, -15, 17, -5), 1.0, NAN, -1, "G")
	# v0.5: the Turned Ones' great mirror stands on the north edge (the glass is a puzzle object)
	wall("Gn", R(8.7, -15.6, 15.3, -15.05), 1.0, 5.9, false)
	box(z, Vector3(8.85, 3.35, -14.95), Vector3(0.32, 4.7, 0.32), 1.0, true)
	box(z, Vector3(15.15, 3.35, -14.95), Vector3(0.32, 4.7, 0.32), 1.0, true)
	box(z, Vector3(12.0, 5.6, -14.95), Vector3(6.6, 0.3, 0.34), 1.0, true)
	box(z, Vector3(12.0, 1.06, -14.95), Vector3(6.3, 0.12, 0.3), 1.0, false)
	ob_rect(R(8.6, -15.3, 15.4, -14.75))
	wall(z, R(7, -15.3, 8.7, -14.95), 1.0, 2.0, true)
	wall(z, R(15.3, -15.3, 17, -14.95), 1.0, 2.0, true)
	# the door east, to the Hollow Walk (its leaves are puzzle objects)
	box(z, Vector3(16.95, 2.75, -12.85), Vector3(0.5, 3.5, 0.5), 0.25, true)
	box(z, Vector3(16.95, 2.75, -10.75), Vector3(0.5, 3.5, 0.5), 0.25, true)
	box(z, Vector3(16.95, 4.7, -11.8), Vector3(0.6, 0.45, 2.7), 0.25, true)
	# dead trees
	tree(z, Vector3(10.2, 1.0, -8.0), 11)
	tree(z, Vector3(14.4, 1.0, -9.6), 23)
	tree(z, Vector3(8.6, 1.0, -13.8), 37)
	tree(z, Vector3(16.1, 1.0, -9.3), 41)
	# veiled statues without runes (the rune statues are placed by the puzzle)
	statue(z, Vector3(8.2, 1.0, -6.0), PI * 0.75, 0.9)
	statue(z, Vector3(12.2, 1.0, -5.7), PI, 0.85)
	stump(Vector3(16.3, 1.0, -5.6), 1.1)
	rubble(Vector3(15.2, 1.0, -6.6), 0.6, 5)
	rubble(Vector3(9.4, 1.0, -11.2), 0.5, 4)
	balustrade(z, Vector2(16.95, -14.8), Vector2(16.95, -13.2), 1.0)
	balustrade(z, Vector2(16.95, -10.4), Vector2(16.95, -5.2), 1.0)
	balustrade(z, Vector2(9.7, -4.95), Vector2(16.8, -4.95), 1.0)
	inscription("g_stele", Vector3(11.0, 1.0, -6.4), "White marble first. Then a thousand faces. Then glass.", 1.2,
		Transform3D(Basis(), Vector3(11.0, 1.62, -5.635)), Vector2(1.0, 0.9))
	box(z, Vector3(11.0, 1.55, -5.75), Vector3(1.15, 1.1, 0.22), 0.25)
	box(z, Vector3(11.0, 2.14, -5.75), Vector3(1.25, 0.08, 0.28), 0.25)
	ob_rect(R(10.5, -5.9, 11.5, -5.5))

func _shortcut() -> void:
	var z := "A"
	slab(z, R(7.5, -5, 9.5, -1), 1.0, 0.7, 0.0)
	walk(R(7.5, -5, 9.5, -1), 1.0)
	steps(z, R(5, -3, 7.5, -1), 0, 0.0, 1.0, true)
	walk(R(5, -3, 7.5, -1), 0.0, 1.0, 0, "shortcut_ramp")
	balustrade(z, Vector2(9.55, -4.9), Vector2(9.55, -1.1), 1.0)
	balustrade(z, Vector2(7.6, -0.95), Vector2(9.4, -0.95), 1.0)
	balustrade(z, Vector2(7.45, -4.9), Vector2(7.45, -3.1), 1.0)
	# gate posts at the Veiled Gate's east edge (the bars are a puzzle object)
	column(Vector3(5.15, 0, -3.35), 2.9, true)
	column(Vector3(5.15, 0, -0.65), 2.9, true)
	box(z, Vector3(5.15, 3.0, -2.0), Vector3(0.7, 0.5, 3.4), 0.25, true)

func _passage() -> void:
	var z := "P"
	steps(z, R(11, -17, 13, -15), 1, 1.0, 2.0, false)
	walk(R(11, -17, 13, -15), 2.0, 1.0, 1, "passage")
	wall(z, R(10.3, -17.2, 10.9, -15.3), 1.0, 3.2, true)
	wall(z, R(13.1, -17.2, 13.7, -15.3), 1.0, 3.2, true)

func _court() -> void:
	var z := "L"
	slab(z, R(7, -27, 17, -17), 2.0, 0.9, 0.0)
	walk(R(7, -27, 17, -17), 2.0, NAN, -1, "L")
	# a low parapet round the court (the light stops there)
	balustrade(z, Vector2(7.1, -26.95), Vector2(9.3, -26.95), 2.0)
	balustrade(z, Vector2(14.7, -26.95), Vector2(16.9, -26.95), 2.0)
	balustrade(z, Vector2(7.05, -26.8), Vector2(7.05, -17.2), 2.0)
	balustrade(z, Vector2(7.2, -17.05), Vector2(15.2, -17.05), 2.0)
	# v0.6: the east edge is her GREAT GLASS (z -26.6..-21.5, the pane is a puzzle object) and, south of
	# it, the drawbridge's gap (z -21.4..-19.4)
	box(z, Vector3(16.98, 4.15, -26.68), Vector3(0.3, 4.3, 0.3), 1.0, true)
	box(z, Vector3(16.98, 4.15, -21.42), Vector3(0.3, 4.3, 0.3), 1.0, true)
	box(z, Vector3(16.98, 6.42, -24.05), Vector3(0.34, 0.3, 5.62), 1.0, true)
	box(z, Vector3(16.98, 2.06, -24.05), Vector3(0.3, 0.12, 5.4), 1.0, false)
	ob_rect(R(16.8, -26.85, 17.2, -21.25))
	balustrade(z, Vector2(16.95, -19.25), Vector2(16.95, -18.6), 2.0)
	# v0.5: the mural wall (her half-erased portrait; its middle is a door) and the Mist Maze beyond
	wall(z, R(9.3, -27.3, 10.9, -26.95), 2.0, 5.6, true)
	wall(z, R(13.1, -27.3, 14.7, -26.95), 2.0, 5.6, true)
	wall("Mural", R(10.9, -27.3, 13.1, -26.95), 2.0, 5.2, true)
	box(z, Vector3(12.0, 5.45, -27.12), Vector3(2.4, 0.5, 0.42), 0.25, true)
	ob_rect(R(9.3, -27.35, 10.9, -26.9))
	ob_rect(R(13.1, -27.35, 14.7, -26.9))
	ob_rect(R(10.9, -27.35, 13.1, -26.9), "mural_door")
	# great columns at the corners, one broken
	column(Vector3(7.6, 2.0, -26.4), 4.6)
	stump(Vector3(7.6, 2.0, -17.6), 1.6)
	rubble(Vector3(8.6, 2.0, -18.4), 0.6, 5)
	inscription("l_stele", Vector3(8.3, 2.0, -21.4), "Where our light ends, hers goes on.\nShe set her own glasses there, and waited.", 1.2,
		Transform3D(Basis(Vector3.UP, PI * 0.5), Vector3(7.665, 2.62, -21.4)), Vector2(0.95, 1.0))
	box(z, Vector3(7.55, 2.6, -21.4), Vector3(0.22, 1.2, 1.1), 0.25)

func _ledge() -> void:
	var z := "E"
	slab(z, R(21, -25, 29, -19), 2.0, 0.9, 0.0)
	walk(R(21, -25, 29, -19), 2.0, NAN, -1, "E")
	# the great glass stands at the ledge's north edge (frame here, pane + reflector in Puzzles)
	box(z, Vector3(21.45, 3.75, -24.95), Vector3(0.3, 3.5, 0.3), 1.0, true)
	box(z, Vector3(25.75, 3.75, -24.95), Vector3(0.3, 3.5, 0.3), 1.0, true)
	box(z, Vector3(23.6, 5.6, -24.95), Vector3(4.7, 0.28, 0.32), 1.0, true)
	box(z, Vector3(23.6, 2.08, -24.95), Vector3(4.6, 0.16, 0.3), 1.0, false)
	ob_rect(R(21.2, -25.15, 26.0, -24.75))
	balustrade(z, Vector2(21.1, -18.95), Vector2(28.9, -18.95), 2.0)
	balustrade(z, Vector2(28.95, -19.1), Vector2(28.95, -21.3), 2.0)
	balustrade(z, Vector2(28.95, -23.5), Vector2(28.95, -24.9), 2.0)
	balustrade(z, Vector2(21.05, -21.6), Vector2(21.05, -24.9), 2.0)
	column(Vector3(28.4, 2.0, -19.5), 4.0)
	inscription("e_stele", Vector3(27.6, 2.0, -20.4), "I asked the goddess once.\nBeyond the glass the other one walks where you cannot.", 1.2,
		Transform3D(Basis(Vector3.UP, -PI * 0.5), Vector3(28.335, 2.62, -20.9)), Vector2(0.95, 1.0))
	box(z, Vector3(28.45, 2.6, -20.9), Vector3(0.22, 1.2, 1.1), 0.25)
	ob_rect(R(28.3, -21.5, 28.6, -20.3))

func _shrine_platform() -> void:
	var z := "S"
	slab(z, R(20, -36, 30, -28), 2.0, 0.9, 0.0)
	walk(R(20, -36, 30, -28), 2.0, NAN, -1, "S")
	balustrade(z, Vector2(20.1, -35.95), Vector2(26.8, -35.95), 2.0)
	balustrade(z, Vector2(29.2, -35.95), Vector2(29.9, -35.95), 2.0)
	balustrade(z, Vector2(29.95, -35.8), Vector2(29.95, -28.2), 2.0)
	balustrade(z, Vector2(20.05, -35.8), Vector2(20.05, -28.2), 2.0)
	# the tholos: a ring of columns, entablature and a shallow dome
	var c := Vector3(25.0, 2.0, -32.6)
	for i in 8:
		var a := TAU * (i + 0.5) / 8.0
		column(c + Vector3(cos(a) * 2.5, 0, sin(a) * 2.5), 3.6)
	var m := mb(z)
	m.cyl(c + Vector3(0, 0.06, 0), 3.05, 3.15, 0.12, C(0.25), 32)
	m.cyl(c + Vector3(0, 5.85, 0), 3.05, 3.05, 0.5, C(0.25, true), 32)
	m.cyl(c + Vector3(0, 6.35, 0), 2.7, 3.0, 0.5, C(0.25, true), 32)
	m.sphere(c + Vector3(0, 6.6, 0), Vector3(2.6, 1.2, 2.6), C(0.25, true), 24, 8)
	statue(z, c + Vector3(0, 0, -1.8), PI, 0.95, 0.5)
	# v0.5: a round pool under the crystal, where her hand meets yours
	m.cyl(c + Vector3(0, 0.07, 0.2), 1.3, 1.34, 0.14, C(0.25), 36)
	m.cyl(c + Vector3(0, 0.02, 0.2), 1.18, 1.18, 0.06, C(0.5), 36)
	ob_circle(Vector2(c.x, c.z + 0.2), 1.3)
	rubble(Vector3(21.2, 2.0, -34.8), 0.6, 5)
	stump(Vector3(21.0, 2.0, -29.0), 0.9)

## the way on: a bridge from the shrine platform toward the next shrine, sealed by a dark rune door,
## its far spans broken and drowned in fog
func _sealed_way() -> void:
	var z := "S"
	slab(z, R(27, -39.4, 29, -36), 2.0, 0.6, 0.0)
	walk(R(27, -39.0, 29, -36), 2.0, NAN, -1, "sealed_way")
	balustrade(z, Vector2(26.95, -36.1), Vector2(26.95, -38.8), 2.0)
	balustrade(z, Vector2(29.05, -36.1), Vector2(29.05, -38.8), 2.0)
	box(z, Vector3(26.7, 3.8, -39.2), Vector3(0.6, 3.6, 0.7), 0.25, true)
	box(z, Vector3(29.3, 3.8, -39.2), Vector3(0.6, 3.6, 0.7), 0.25, true)
	box(z, Vector3(28.0, 5.85, -39.2), Vector3(3.4, 0.55, 0.85), 0.25, true)
	box(z, Vector3(28.0, 3.5, -39.25), Vector3(2.0, 3.0, 0.3), 0.25, true)
	ob_rect(R(26.4, -39.6, 29.6, -38.85), "sealed_gate")
	var st := Vector3(28.0, 2.0, -40.3)
	var dir := (SECOND_SHRINE - st)
	dir.y = 0.0
	var L := dir.length()
	dir = dir.normalized()
	var B := Basis(Vector3.UP, atan2(-dir.x, -dir.z))
	var k := 0.0
	while k < L - 4.0:
		var seg := 1.6
		if fmod(k, 7.0) > 4.5: k += 1.4      # gaps where the spans fell
		var p := st + dir * (k + seg * 0.5)
		var sink := clampf((k - 5.0) * 0.05, 0.0, 0.8)
		var tilt := Basis(Vector3.RIGHT, rng.randf_range(-0.05, 0.05)) * Basis(Vector3.BACK, rng.randf_range(-0.08, 0.08))
		mb(z).box(p + Vector3(0, -0.3 - sink, 0), Vector3(1.9, 0.5, seg), C(0.0), B * tilt)
		if rng.randf() < 0.5: mb(z).box(p + B * Vector3(-0.9, 0.05 - sink, 0), Vector3(0.18, 0.5, seg), C(0.25), B * tilt)
		k += seg + 0.05

func _island(m: MB, c: Vector3, size: Vector2) -> void:
	m.box(c + Vector3(0, -0.4, 0), Vector3(size.x, 0.8, size.y), C(0.0))
	var r := R(c.x - size.x * 0.5, c.z - size.y * 0.5, c.x + size.x * 0.5, c.z + size.y * 0.5)
	var area := r.size.x * r.size.y
	for i in clampi(int(area / 6.0), 2, 7):
		var q := Vector2(rng.randf_range(r.position.x + 0.8, r.end.x - 0.8), rng.randf_range(r.position.y + 0.8, r.end.y - 0.8))
		var rt := minf(size.x, size.y) * rng.randf_range(0.25, 0.42)
		var h := rng.randf_range(2.5, 6.0)
		m.cyl(Vector3(q.x, c.y - 0.8 - h * 0.5, q.y), rt, rt * 0.1, h, C(0.5), 7)

func _col(m: MB, base: Vector3, h: float, r := 0.28, broken := false) -> void:
	m.cyl(base + Vector3(0, 0.1, 0), r * 1.3, r * 1.4, 0.2, C(0.25), 10)
	m.cyl(base + Vector3(0, h * 0.5, 0), r * 0.9, r, h, C(0.25), 10)
	if not broken: m.box(base + Vector3(0, h + 0.08, 0), Vector3(r * 2.8, 0.16, r * 2.8), C(0.25))

## islands and temples beyond the Veiled Gate, hidden in fog until the shrine wakes
func _beyond() -> void:
	beyond = Node3D.new()
	beyond.name = "Beyond"
	beyond.visible = false
	add_child(beyond)
	var m := MB.new()
	var at := func(f: float, l: float, y: float) -> Vector3: return Vector3(SHRINE_C.x, y, SHRINE_C.z) + BEYOND_FWD * f + BEYOND_RIGHT * l
	# the second shrine: a small tholos on its own island (its light is added by Puzzles)
	var c2: Vector3 = SECOND_SHRINE
	_island(m, c2, Vector2(6.0, 6.0))
	for i in 6:
		var a := TAU * i / 6.0
		_col(m, c2 + Vector3(cos(a) * 1.7, 0, sin(a) * 1.7), 2.8, 0.22)
	m.cyl(c2 + Vector3(0, 3.05, 0), 2.1, 2.1, 0.3, C(0.25), 20)
	m.sphere(c2 + Vector3(0, 3.2, 0), Vector3(1.8, 0.9, 1.8), C(0.25), 16, 6)
	# a long temple on a higher island to the left
	var c3: Vector3 = at.call(24.0, -6.5, 4.0)
	_island(m, c3, Vector2(8.0, 6.0))
	for i in 5:
		for side in [-1.0, 1.0]:
			_col(m, c3 + BEYOND_FWD * (i * 1.4 - 2.8) + BEYOND_RIGHT * side * 1.8, 3.2, 0.24, i == 4 and side > 0.0)
	var B3 := Basis(Vector3.UP, atan2(-BEYOND_FWD.x, -BEYOND_FWD.z))
	m.box(c3 + Vector3(0, 3.45, 0) + BEYOND_FWD * -0.7, Vector3(4.4, 0.4, 5.4), C(0.25), B3)
	m.cyl(c3 + Vector3(0, 4.05, 0) + BEYOND_FWD * -0.7, 0.05, 2.4, 0.8, C(0.25), 4, B3 * Basis(Vector3.UP, PI * 0.25))
	# a rock with broken columns to the right, low in the fog
	var c4: Vector3 = at.call(15.0, 9.5, 0.6)
	_island(m, c4, Vector2(4.5, 4.0))
	_col(m, c4 + Vector3(-1.0, 0, 0.6), 1.4, 0.26, true)
	_col(m, c4 + Vector3(0.9, 0, -0.8), 2.6, 0.26)
	# a high islet with a lone arch
	var c5: Vector3 = at.call(32.0, 11.0, 6.0)
	_island(m, c5, Vector2(4.0, 3.5))
	_col(m, c5 + BEYOND_RIGHT * -1.0, 3.0, 0.24)
	_col(m, c5 + BEYOND_RIGHT * 1.0, 3.0, 0.24)
	m.box(c5 + Vector3(0, 3.3, 0), Vector3(2.9, 0.4, 0.7), C(0.25), Basis(Vector3.UP, atan2(-BEYOND_RIGHT.x, -BEYOND_RIGHT.z) + PI * 0.5))
	# far away, a colossal veiled statue rising out of the cloud
	var mi := MeshInstance3D.new()
	mi.mesh = m.commit()
	mi.material_override = marble_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beyond.add_child(mi)
	var cm := MB.new()
	var cc: Vector3 = at.call(40.0, 3.0, -6.0)
	var s := 5.0
	cm.cyl(cc + Vector3(0, 0.62 * s, 0), 0.25 * s, 0.36 * s, 1.24 * s, Color(0, 0, 0), 14)
	cm.cyl(cc + Vector3(0, 1.5 * s, 0), 0.27 * s, 0.23 * s, 0.56 * s, Color(0, 0, 0), 14)
	cm.cyl(cc + Vector3(0, 1.94 * s, 0), 0.14 * s, 0.25 * s, 0.34 * s, Color(0, 0, 0), 14)
	cm.sphere(cc + Vector3(0, 2.15 * s, 0), Vector3(0.165, 0.2, 0.17) * s, Color(0, 0, 0), 14, 7)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.62, 0.63, 0.64)
	var cmi := MeshInstance3D.new()
	cmi.mesh = cm.commit()
	cmi.material_override = mat
	cmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beyond.add_child(cmi)

func _far_ruins() -> void:
	# huge drowned columns and statues around the complex, unlit and swallowed by the fog
	var st := MB.new()
	var r := RandomNumberGenerator.new()
	r.seed = 77
	var pts := [Vector2(-14, 4), Vector2(-16, -14), Vector2(-12, -30), Vector2(2, -40), Vector2(16, -44), Vector2(36, -38),
		Vector2(40, -22), Vector2(36, -6), Vector2(22, 6), Vector2(8, 14), Vector2(-6, 16), Vector2(-20, -22), Vector2(30, 12), Vector2(44, -30)]
	for p in pts:
		var rad := r.randf_range(0.9, 1.6)
		var top := r.randf_range(-2.0, 9.0)
		st.cyl(Vector3(p.x, top - 15.0, p.y), rad * 0.92, rad, 30.0, Color(0, 0, 0), 12, Basis(Vector3.BACK, r.randf_range(-0.06, 0.06)))
		if r.randf() < 0.4:
			st.box(Vector3(p.x, top + 0.3, p.y), Vector3(rad * 2.6, 0.6, rad * 2.6), Color(0, 0, 0))
	for sdef in [[Vector2(-15, -6), 2.2], [Vector2(38, -14), 2.6], [Vector2(10, -48), 3.0]]:
		var p: Vector2 = sdef[0]; var s: float = sdef[1]
		st.cyl(Vector3(p.x, -6.0, p.y), 0.55 * s, 0.95 * s, 4.2 * s, Color(0, 0, 0), 12)
		st.sphere(Vector3(p.x, -6.0 + 2.6 * s, p.y), Vector3(0.42, 0.52, 0.42) * s, Color(0, 0, 0), 10, 5)
		st.cyl(Vector3(p.x, -6.0 + 2.3 * s, p.y), 0.15 * s, 0.75 * s, 1.4 * s, Color(0, 0, 0), 12)
	_silhouette_layer(st, Color(0.60, 0.605, 0.615), "FarRuins")
	# a second, paler layer much further out: drowned towers and rocks in the cloud
	var far := MB.new()
	for i in 22:
		var a := TAU * i / 22.0 + r.randf_range(-0.1, 0.1)
		var rr := r.randf_range(48.0, 64.0)
		var c := Vector3(12.0, 0, -16.0) + Vector3(cos(a) * rr, 0, sin(a) * rr)
		var hgt := r.randf_range(6.0, 22.0)
		if r.randf() < 0.6:
			far.cyl(c + Vector3(0, hgt * 0.5 - 12.0, 0), r.randf_range(1.0, 2.2), r.randf_range(1.4, 2.6), hgt + 12.0, Color(0, 0, 0), 10)
		else:
			far.cyl(c + Vector3(0, r.randf_range(-2.0, 6.0), 0), r.randf_range(3.0, 6.0), r.randf_range(0.5, 1.5), r.randf_range(5.0, 9.0), Color(0, 0, 0), 7)
	_silhouette_layer(far, Color(0.70, 0.705, 0.71), "FarestRuins")

func _silhouette_layer(m: MB, col: Color, nm: String) -> void:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = col
	var mi := MeshInstance3D.new()
	mi.mesh = m.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.name = nm
	add_child(mi)

# ================================================================== commit
func _commit() -> void:
	for k in zones.keys():
		var m: MB = zones[k]
		if m.is_empty(): continue
		var mi := MeshInstance3D.new()
		mi.name = "Zone_" + k
		mi.mesh = m.commit()
		mi.material_override = marble_mat
		if k == "Hn": mi.layers = PlanarMirror.LAYER_BEHIND      # the great mirror's own wall
		add_child(mi)
	_markers()
	_decor()
	_decal_mm("Blobs", blobs, 0.0, 0.42)
	_decal_mm("WallAO", strips, 1.0, 0.30)
	_cloth_mm()
	_vines()
	_godrays()
	_multimesh("Columns", _column_mesh(), col_full)
	_multimesh("Stumps", _stump_mesh(), col_stump)
	_multimesh("Debris", _debris_mesh(), debris)

func _decal_mm(nm: String, xfs: Array[Transform3D], edge: float, strength: float) -> void:
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1)
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/blob.gdshader")
	m.set_shader_parameter("edge", edge)
	m.set_shader_parameter("strength", strength)
	var mmi := _multimesh(nm, pm, xfs)
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _cloth_mm() -> void:
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1)
	pm.subdivide_depth = 6
	pm.orientation = PlaneMesh.FACE_Z
	pm.center_offset = Vector3(0, -0.5, 0)
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/cloth.gdshader")
	var mmi := _multimesh("StatueCloth", pm, cloths)
	mmi.material_override = m

## pale dead grass and fallen leaves, gathered where stone meets stone (edges, plinths, trees)
func _decor() -> void:
	var r := RandomNumberGenerator.new()
	r.seed = 4040
	var tufts: Array[Transform3D] = []
	var leaves: Array[Transform3D] = []
	var zones_w := [["G", 170, 150], ["T", 45, 25], ["L", 30, 10], ["E", 15, 6], ["S", 25, 12], ["H", 0, 6]]
	for zw in zones_w:
		var g: Region = named[zw[0]]
		var want_t: int = zw[1]
		var want_l: int = zw[2]
		var tries := 0
		while (want_t > 0 or want_l > 0) and tries < 4000:
			tries += 1
			var p := Vector2(r.randf_range(g.r.position.x, g.r.end.x), r.randf_range(g.r.position.y, g.r.end.y))
			if blocked(p, 0.08): continue
			var edge := minf(minf(p.x - g.r.position.x, g.r.end.x - p.x), minf(p.y - g.r.position.y, g.r.end.y - p.y))
			var near := 99.0
			for o in obstacles:
				if o.circle: near = minf(near, p.distance_to(o.c) - o.rad)
			var shelter := edge < 0.7 or near < 0.9
			if not shelter and r.randf() > 0.12: continue
			var y := g.height(p)
			if want_t > 0 and r.randf() < 0.6:
				var sc := r.randf_range(0.65, 1.35)
				tufts.append(Transform3D(Basis(Vector3.UP, r.randf() * TAU).scaled(Vector3(sc, sc * r.randf_range(0.8, 1.2), sc)), Vector3(p.x, y, p.y)))
				want_t -= 1
			elif want_l > 0:
				var b := Basis(Vector3.UP, r.randf() * TAU) * Basis(Vector3.RIGHT, r.randf_range(-0.15, 0.15))
				leaves.append(Transform3D(b.scaled(Vector3.ONE * r.randf_range(0.7, 1.3)), Vector3(p.x, y + 0.012, p.y)))
				want_l -= 1
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in 3:
		var b2 := Basis(Vector3.UP, k * PI / 3.0)
		var corners := [Vector3(-0.21, 0, 0), Vector3(0.21, 0, 0), Vector3(0.21, 0.34, 0), Vector3(-0.21, 0.34, 0)]
		var uvs := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for idx in [0, 1, 2, 0, 2, 3]:
			st.set_uv(uvs[idx])
			st.set_normal(Vector3.UP)
			st.add_vertex(b2 * corners[idx])
	var tmi := _multimesh("Grass", st.commit(), tufts)
	var gm := ShaderMaterial.new()
	gm.shader = preload("res://shaders/grass.gdshader")
	tmi.material_override = gm
	tmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	grass_mmi = tmi
	tmi.add_to_group("f_grass")
	var lp := PlaneMesh.new()
	lp.size = Vector2(0.13, 0.085)
	var lmi := _multimesh("Leaves", lp, leaves)
	var lm := ShaderMaterial.new()
	lm.shader = preload("res://shaders/leaf.gdshader")
	lmi.material_override = lm
	lmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	lmi.add_to_group("f_grass")

## dead vines creeping on walls and columns (garden, gate, hall)
func _vines() -> void:
	var xfs: Array[Transform3D] = []
	var r := RandomNumberGenerator.new()
	r.seed = 515
	var spots := [
		[Vector3(-3.6, 1.0, -20.56), 0.0, 1.6, 2.6], [Vector3(3.2, 1.0, -20.56), 0.0, 1.4, 2.2],
		[Vector3(8.4, 1.0, -14.93), 0.0, 1.4, 1.1], [Vector3(15.6, 1.0, -14.93), 0.0, 1.6, 1.1],
		[Vector3(10.2, 1.0, -14.68), 0.0, 0.8, 3.2], [Vector3(13.8, 1.0, -14.68), 0.0, 0.8, 3.0],
		[Vector3(4.58, 1.0, -16.5), -PI * 0.5, 1.6, 2.4], [Vector3(-1.6, 0.0, -4.62), 0.0, 0.7, 2.6],
		[Vector3(1.6, 0.0, -4.62), 0.0, 0.7, 1.8], [Vector3(-1.5, 0.0, 4.98), 0.0, 0.7, 2.4],
		[Vector3(10.32, 1.0, -16.2), PI * 0.5, 1.4, 1.8], [Vector3(13.08, 1.0, -16.2), -PI * 0.5, 1.4, 1.6],
		[Vector3(7.6, 2.0, -26.0), 0.0, 0.7, 3.0], [Vector3(16.4, 2.0, -17.22), 0.0, 0.7, 2.6]]
	for sp in spots:
		var at: Vector3 = sp[0]
		var b := Basis(Vector3.UP, sp[1]).scaled(Vector3(sp[2], sp[3], 1.0))
		xfs.append(Transform3D(b, at + Basis(Vector3.UP, sp[1]) * Vector3(0, 0, 0.012)))
	var pm := QuadMesh.new()
	pm.size = Vector2(1, 1)
	pm.center_offset = Vector3(0, 0.5, 0)
	var mmi := _multimesh("Vines", pm, xfs)
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/vine.gdshader")
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## light falling through the arches and doorways
func _godrays() -> void:
	var sun := Basis.from_euler(Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0))
	var dir := -(sun * Vector3.BACK)          # direction the light travels
	var spots := [[Vector3(0, 0.0, 4.6), 9.0], [Vector3(0, 0.0, -5.0), 9.0], [Vector3(4.8, 1.0, -13.0), 8.0],
		[Vector3(12.0, 1.0, -15.1), 9.0], [Vector3(-4.5, 1.0, -16.0), 8.0], [Vector3(28.0, 2.0, -39.2), 9.0], [Vector3(25.0, 2.0, -32.6), 7.0]]
	var i := 0
	for sp in spots:
		var floor_p: Vector3 = sp[0]
		var L: float = sp[1]
		var top := floor_p - dir * L
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/godray.gdshader")
		m.set_shader_parameter("phase", i * 1.7)
		var q := QuadMesh.new()
		q.size = Vector2(1, 1)
		q.center_offset = Vector3(0, 0.5, 0)
		var mi := MeshInstance3D.new()
		mi.mesh = q
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.extra_cull_margin = 12.0
		var y := dir * L
		var x := y.cross(Vector3.UP).normalized()
		mi.transform = Transform3D(Basis(x, y, x.cross(y).normalized()), top)
		add_child(mi)
		mi.layers = PlanarMirror.LAYER_MAIN_FX
		mi.add_to_group("f_godrays")
		i += 1

## chunk: split into cells (only worth it for heavy, shadow-casting meshes: columns, stumps, debris;
## the cheap decals / grass / leaves stay one draw call each)
func _multimesh(nm: String, mesh: Mesh, xfs: Array[Transform3D], chunk := false) -> MMGroup:
	var g := MMGroup.new()
	g.name = nm
	add_child(g)
	var cells := {}
	for x in xfs:
		var k := Vector2i(floori(x.origin.x / MMGroup.CELL), floori(x.origin.z / MMGroup.CELL)) if chunk else Vector2i.ZERO
		if not cells.has(k): cells[k] = []
		cells[k].append(x)
	for k in cells:
		var arr: Array = cells[k]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = arr.size()
		for i in arr.size(): mm.set_instance_transform(i, arr[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.name = "%s_%d_%d" % [nm, k.x, k.y]
		mmi.multimesh = mm
		g.add_child(mmi)
		g.parts.append(mmi)
	g.material_override = marble_mat
	return g

func _column_mesh() -> ArrayMesh:
	var m := MB.new()
	var c := Color(0.5, 0.25, 1.0)
	m.box(Vector3(0, 0.1, 0), Vector3(0.86, 0.2, 0.86), c)
	m.cyl(Vector3(0, 0.27, 0), 0.34, 0.4, 0.14, c, 16)
	m.cyl(Vector3(0, 1.97, 0), 0.27, 0.32, 3.26, c, 16)
	m.cyl(Vector3(0, 3.66, 0), 0.38, 0.29, 0.14, c, 16)
	m.box(Vector3(0, 3.74, 0), Vector3(0.84, 0.13, 0.84), c)
	return m.commit()

func _stump_mesh() -> ArrayMesh:
	var m := MB.new()
	var c := Color(0.3, 0.25, 1.0)
	m.box(Vector3(0, 0.06, 0), Vector3(0.86, 0.12, 0.86), c)
	m.cyl(Vector3(0, 0.5, 0), 0.31, 0.33, 0.9, c, 16)
	# jagged break
	m.cyl(Vector3(0.06, 1.0, 0.0), 0.12, 0.30, 0.22, c, 7, Basis(Vector3.BACK, 0.25))
	return m.commit()

func _debris_mesh() -> ArrayMesh:
	var m := MB.new()
	var c := Color(0.7, 0.25, 0.0)
	m.box(Vector3.ZERO, Vector3(1, 1, 1), c)
	m.box(Vector3(0.25, 0.3, 0.1), Vector3(0.6, 0.5, 0.7), c, Basis(Vector3(1, 1, 0).normalized(), 0.6))
	return m.commit()
