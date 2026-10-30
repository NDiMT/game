extends Node
## v1.0 M1 OVERLAP test (headless), the whole world. Perfect placement:
##  1. no two solid things (statues, props, columns, stumps, trees, puzzle objects) interpenetrate (by more
##     than 2 cm): oriented boxes for every primitive, then a mesh-sample check for the Tripo props;
##  2. no thing runs into a wall, a walkway rail or the architecture;
##  3. nothing floats more than 2 cm over, or sinks more than 2 cm into, what holds it up (whitelisted: the
##     sunken colossus, fallen debris, what hangs);
##  4. nothing stands on a walkway's centreline.
## Prints every hit and OVERLAP PASS / OVERLAP FAIL.

const TOL := 0.02
const BAND := 0.3                 # a walkway's centreline band (half width)
## owners that are meant to hang, lean, be sunk or be passed (by the start of their name)
const NO_SUPPORT := ["Wonders", "Colossus", "wonder", "rubble", "debris", "Ink", "hw_gate", "Gframe", "Hdoor", "Zone_GLs",
	"shard_hang", "lamp", "veil", "glow", "beam", "halo", "Props/Prop_column_fallen", "Prop_pediment_fragment", "Prop_rubble_pile"]
## designed contacts, by place: [where (world box), what it is]. Hits inside one are not counted.
const DESIGNED := [
	[AABB(Vector3(26.0, 3.5, -50.2), Vector3(7.5, 5.0, 2.4)), "the Scales: pans and weights HANG from the beam overhead"],
	[AABB(Vector3(4.9, -0.2, -3.2), Vector3(0.5, 3.0, 2.4)), "the shortcut gate: its bars slide down into a slot in the floor"],
	[AABB(Vector3(17.2, 0.8, -15.45), Vector3(2.6, 3.6, 0.6)), "the Our Steps gate: its bars run in grooves in the two posts and a slot in the floor"],
	[AABB(Vector3(9.2, 2.0, -25.0), Vector3(7.0, 1.0, 3.0)), "the Court's mirror stands turn in sockets in their plinths"],
	[AABB(Vector3(13.0, 1.9, -29.2), Vector3(4.0, 4.0, 2.0)), "the Tree of Shards: its shards hang from the branches; it IS the nook's goal"],
]
const NOT_SOLID := ["veil", "glow", "halo", "beam", "mist", "fog", "ray", "shaft", "water", "pool_mat", "rune", "mark"]

class Solid:
	var owner := ""
	var cat := ""            # object, prop, wall, rail, arch, floor, rubble
	var xf := Transform3D()  # the unit box (-0.5..0.5) -> world
	var lo := Vector3.ZERO   # world bounds
	var hi := Vector3.ZERO
	var verts := PackedVector3Array()   # (props) world vertices for the mesh-sample check

var solids: Array[Solid] = []
var lv: Level
var game: Game
var hits: Array[String] = []

func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	lv = game.level
	_gather()
	print("[overlap] %d solids" % solids.size())
	_check_pairs()
	_check_support()
	_check_centrelines()
	var seen := {}
	var uniq: Array[String] = []
	for h in hits:
		if seen.has(h): continue
		if _designed(h): continue
		seen[h] = true
		uniq.append(h)
	for h in uniq: print("HIT ", h)
	print("OVERLAP %s (%d hits)" % ["PASS" if uniq.is_empty() else "FAIL", uniq.size()])
	get_tree().quit()

func _designed(h: String) -> bool:
	var at := h.rfind(" at (")
	if at < 0: return false
	var nums := h.substr(at + 5).get_slice(")", 0).split(",")
	if nums.size() < 3: return false
	var p := Vector3(float(nums[0]), float(nums[1]), float(nums[2]))
	for d in DESIGNED:
		if (d[0] as AABB).grow(0.01).has_point(p): return true
	return false

# ------------------------------------------------------------------ gathering
func _add(owner: String, cat: String, xf: Transform3D) -> Solid:
	var s := Solid.new()
	s.owner = owner
	s.cat = cat
	s.xf = xf
	var ab := xf * AABB(Vector3(-0.5, -0.5, -0.5), Vector3.ONE)
	s.lo = ab.position
	s.hi = ab.end
	solids.append(s)
	return s

static func _box_of(ab: AABB) -> Transform3D:
	return Transform3D(Basis.from_scale(ab.size.max(Vector3.ONE * 0.001)), ab.get_center())

## a round part (a cylinder or a sphere) as a box inscribed in it (its true volume, not its bounds)
static func _round_box(ab: AABB) -> Transform3D:
	var c := ab.get_center()
	return Transform3D(Basis.from_scale(Vector3(ab.size.x * 0.72, ab.size.y, ab.size.z * 0.72).max(Vector3.ONE * 0.001)), c)

func _skip(name: String) -> bool:
	for k in NOT_SOLID:
		if name.to_lower().contains(k): return true
	return false

func _gather() -> void:
	# the level's merged zones: walls, rails, statues, trees, floors, the rest of the architecture
	for mi in lv.find_children("*", "MeshInstance3D", false, false):
		_from_parts(mi as MeshInstance3D, "", true)
	# columns, stumps, rubble (instanced)
	var k := 0
	for xf: Transform3D in lv.col_full:
		var r := 0.4 * Vector2(xf.basis.x.x, xf.basis.x.z).length()
		var h := 3.8 * xf.basis.y.length()
		_add("column#%d" % k, "object", Transform3D(Basis.from_scale(Vector3(r * 1.5, h, r * 1.5)), xf.origin + Vector3(0, h * 0.5, 0)))
		k += 1
	for xf: Transform3D in lv.col_stump:
		var r := 0.4 * Vector2(xf.basis.x.x, xf.basis.x.z).length()
		var ab := xf * AABB(Vector3(-0.4, 0.0, -0.4), Vector3(0.8, 1.1, 0.8))
		_add("stump#%d" % k, "object", Transform3D(Basis.from_scale(Vector3(r * 1.5, ab.size.y, r * 1.5)), Vector3(xf.origin.x, ab.get_center().y, xf.origin.z)))
		k += 1
	for xf: Transform3D in lv.debris:
		_add("rubble#%d" % k, "rubble", xf * Transform3D(Basis.from_scale(Vector3.ONE * 0.8), Vector3.ZERO))
		k += 1
	# the props (Tripo): their bounds, refined by their own vertices
	for e in game.props.placed:
		var mi: MeshInstance3D = e[1]
		var ab: AABB = mi.mesh.get_aabb()
		var s := _add("Props/" + str(mi.name), "prop", mi.global_transform * _box_of(ab))
		var mdt := mi.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX] as PackedVector3Array
		var step := maxi(1, mdt.size() / 600)
		for i in range(0, mdt.size(), step): s.verts.append(mi.global_transform * mdt[i])
	# the puzzle objects and the wonders (each mesh one thing)
	for root in [game.puzzles, game.chapter, game.wonders]:
		if root == null: continue
		for mi in (root as Node).find_children("*", "MeshInstance3D", true, false):
			_from_parts(mi as MeshInstance3D, str(root.name) + "/" + str((mi as Node).get_parent().name) + "/" + str(mi.name), false)

func _visible(n: Node) -> bool:
	while n and n is Node3D:
		if not (n as Node3D).visible: return false
		n = n.get_parent()
	return true

func _from_parts(mi: MeshInstance3D, owner: String, zone: bool) -> void:
	if mi.mesh == null or not mi.mesh.has_meta("parts"): return
	if mi.layers == PlanarMirror.LAYER_DOUBLE or not _visible(mi): return
	if _skip(str(mi.name)): return
	# (stone only: glows, veils and other overlays drawn over a thing are not solids)
	var mo := mi.material_override
	if mo is ShaderMaterial and (mo as ShaderMaterial).shader and not str((mo as ShaderMaterial).shader.resource_path).get_file().begins_with("marble"): return
	var parts: Array = mi.mesh.get_meta("parts")
	var groups: Array = mi.mesh.get_meta("groups") if mi.mesh.has_meta("groups") else []
	var gx := mi.global_transform
	for i in parts.size():
		var pt: Array = parts[i]
		var grp: String = groups[i] if i < groups.size() else ""
		var cat := "object"
		var own := owner
		if zone:
			var kind := grp.get_slice(":", 0)
			own = str(mi.name) + "/" + (grp if grp != "" else "arch")
			cat = {"wall": "wall", "rail": "rail", "statue": "object", "tree": "object", "slab": "floor", "steps": "floor", "": "arch"}.get(kind, "arch")
		if pt[1] == "floor": cat = "floor"
		var xf: Transform3D
		if pt.size() > 3 and pt[3] is Transform3D: xf = gx * (pt[3] as Transform3D)
		elif pt[2]: xf = _round_box(gx * (pt[0] as AABB))
		else: xf = gx * _box_of(pt[0] as AABB)
		_add(own, cat, xf)

# ------------------------------------------------------------------ 1-2: interpenetration
## the depth two boxes overlap by (0 = apart), separating-axis
static var last_axis := Vector3.ZERO
static func depth(a: Transform3D, b: Transform3D) -> float:
	var axes: Array[Vector3] = []
	var ea := [a.basis.x, a.basis.y, a.basis.z]
	var eb := [b.basis.x, b.basis.y, b.basis.z]
	for v in ea: axes.append((v as Vector3).normalized())
	for v in eb: axes.append((v as Vector3).normalized())
	for u in ea:
		for w in eb:
			var cr := (u as Vector3).cross(w)
			if cr.length() > 1e-4: axes.append(cr.normalized())
	var d := a.origin - b.origin
	var best := INF
	for ax in axes:
		var ra := 0.0
		for v in ea: ra += absf((v as Vector3).dot(ax)) * 0.5
		var rb := 0.0
		for v in eb: rb += absf((v as Vector3).dot(ax)) * 0.5
		var o := ra + rb - absf(d.dot(ax))
		if o <= 0.0: return 0.0
		if o < best:
			best = o
			last_axis = ax
	return best

## a box grown by d on every side
static func _grow(xf: Transform3D, d: float) -> Transform3D:
	var b := xf.basis
	return Transform3D(Basis(b.x.normalized() * (b.x.length() + d * 2.0), b.y.normalized() * (b.y.length() + d * 2.0), b.z.normalized() * (b.z.length() + d * 2.0)), xf.origin)

static func inside(p: Vector3, b: Transform3D, shrink: float) -> bool:
	var q := b.affine_inverse() * p
	var s := b.basis.get_scale()
	return absf(q.x) * s.x < s.x * 0.5 - shrink and absf(q.y) * s.y < s.y * 0.5 - shrink and absf(q.z) * s.z < s.z * 0.5 - shrink

func _check_pairs() -> void:
	# a coarse grid over xz
	var cell := 2.0
	var grid := {}
	for i in solids.size():
		var s := solids[i]
		if s.cat == "floor" or s.cat == "rubble": continue
		for gx in range(floori(s.lo.x / cell), floori(s.hi.x / cell) + 1):
			for gz in range(floori(s.lo.z / cell), floori(s.hi.z / cell) + 1):
				var key := Vector2i(gx, gz)
				if not grid.has(key): grid[key] = []
				grid[key].append(i)
	var done := {}
	for key in grid:
		var l: Array = grid[key]
		for ai in l.size():
			for bi in range(ai + 1, l.size()):
				var a := solids[l[ai]]
				var b := solids[l[bi]]
				if a.owner == b.owner: continue
				var structural := ["wall", "rail", "arch"]
				if a.cat in structural and b.cat in structural: continue           # (architecture joins itself)
				var pk := Vector2i(mini(l[ai], l[bi]), maxi(l[ai], l[bi]))
				if done.has(pk): continue
				done[pk] = true
				if a.hi.x <= b.lo.x + TOL or b.hi.x <= a.lo.x + TOL or a.hi.y <= b.lo.y + TOL or b.hi.y <= a.lo.y + TOL or a.hi.z <= b.lo.z + TOL or b.hi.z <= a.lo.z + TOL: continue
				var dp := depth(a.xf, b.xf)
				if dp <= TOL: continue
				# a wall or a rail that ENDS in a column or a post: a junction, not a clash
				if _junction(a, b) or _junction(b, a): continue
				# resting: one sits on the other (the least overlap is vertical, and shallow): a contact, not a clash
				if absf(last_axis.y) > 0.9 and dp <= 0.1: continue
				# out of sight: both under the walkable floor there (foundations, under the water)
				var mid := Vector3((maxf(a.lo.x, b.lo.x) + minf(a.hi.x, b.hi.x)) * 0.5, minf(a.hi.y, b.hi.y), (maxf(a.lo.z, b.lo.z) + minf(a.hi.z, b.hi.z)) * 0.5)
				var fg := lv.region_at(Vector2(mid.x, mid.z))
				var floor_y := fg.height(Vector2(mid.x, mid.z)) if fg else -INF
				if mid.y < minf(floor_y, Ch1Geo.WATER_Y + 0.6) - 0.02 and fg: continue
				# a Tripo prop: its bounds are loose; its own vertices must really be inside
				if not a.verts.is_empty() or not b.verts.is_empty():
					var n := 0
					for v in a.verts: if inside(v, b.xf, TOL): n += 1
					for v in b.verts: if inside(v, a.xf, TOL): n += 1
					if n < 4: continue
				var what := "a wall" if (a.cat == "wall" or b.cat == "wall") else ("a rail" if (a.cat == "rail" or b.cat == "rail") else "")
				hits.append("%s %s <-> %s (%.0f cm deep) at %s" % ["INTO " + what if what != "" else "OVERLAP", _short(a.owner), _short(b.owner), dp * 100.0,
					_v((a.xf.origin + b.xf.origin) * 0.5)])

## s (a wall, a rail, the architecture) ends inside c (a column, a stump: a round upright)
static func _junction(s: Solid, c: Solid) -> bool:
	if not (s.cat in ["wall", "rail", "arch"]) or not (c.owner.begins_with("column") or c.owner.begins_with("stump")): return false
	var bx := s.xf.basis
	var ax: Vector3 = bx.x if bx.x.length() >= bx.z.length() else bx.z
	var cc := Vector2(c.xf.origin.x, c.xf.origin.z)
	var r := c.xf.basis.x.length() * 0.5 / 0.75 + 0.05           # (the column's radius: its box is 1.5 r wide)
	for sg in [-0.5, 0.5]:
		var e: Vector3 = s.xf.origin + ax * sg
		if Vector2(e.x, e.z).distance_to(cc) < r: return true
	return false

static func _short(s: String) -> String:
	return s.replace("@MeshInstance3D@", "mi").replace("@Node3D@", "n")

static func _v(p: Vector3) -> String:
	return "(%.2f, %.2f, %.2f)" % [p.x, p.y, p.z]

# ------------------------------------------------------------------ 3: standing on something
func _whitelisted(owner: String) -> bool:
	for k in NO_SUPPORT:
		if owner.contains(k): return true
	return false

func _check_support() -> void:
	# each thing's lowest part, per owner
	var owners := {}
	for s in solids:
		if s.cat in ["wall", "rail", "arch", "floor"]: continue
		if not owners.has(s.owner): owners[s.owner] = []
		owners[s.owner].append(s)
	for own in owners:
		if _whitelisted(own): continue
		var parts: Array = owners[own]
		var lo := INF
		var low: Solid = null
		for s in parts:
			if s.lo.y < lo: lo = s.lo.y; low = s
		var c := Vector2((low.lo.x + low.hi.x) * 0.5, (low.lo.z + low.hi.z) * 0.5)
		# what is under it: the walkway, or the top of anything beneath its foot
		var sup := -INF
		var g := lv.region_at(c)
		if g: sup = g.height(c)
		var under := -INF
		for t in solids:
			if t.owner == own: continue
			if c.x < t.lo.x or c.x > t.hi.x or c.y < t.lo.z or c.y > t.hi.z: continue
			if t.hi.y <= lo + TOL * 2.0: under = maxf(under, t.hi.y)
		var top := maxf(sup, under)
		if top == -INF: continue                              # (over nothing: off the walkable world, e.g. the backdrop)
		# fixed to the side of something (a tablet on a plinth, a relief on a wall): held, not floating
		var held := false
		if lo > top + TOL and not (own.begins_with("column") or own.begins_with("stump")):      # (a column stands: it is never "held")
			for t in solids:
				if t.owner == own or t.cat == "rubble": continue
				if t.hi.y < lo + 0.05: continue
				if depth(_grow(low.xf, 0.02), t.xf) > 0.0:
					held = true
					break
		if held: continue
		if lo > top + TOL:
			hits.append("FLOATS %s %.0f cm over its support at %s (foot %.2f, walkway %.2f, under %.2f)" % [_short(own), (lo - top) * 100.0, _v(low.xf.origin), lo, sup, under])
		elif sup != -INF and lo < sup - TOL and lo > sup - 0.6 and under < lo - TOL:
			hits.append("SINKS %s %.0f cm into the floor at %s" % [_short(own), (sup - lo) * 100.0, _v(low.xf.origin)])

# ------------------------------------------------------------------ 4: walkway centrelines
func _check_centrelines() -> void:
	for g: Level.Region in lv.regions:
		if not g.enabled or g.r.size.x < 0.5 or g.r.size.y < 0.5: continue
		var long_x := g.r.size.x >= g.r.size.y
		var L := maxf(g.r.size.x, g.r.size.y)
		var W := minf(g.r.size.x, g.r.size.y)
		if W > 3.3 or L < 3.0 or L / W < 2.2: continue        # (a room or a threshold, not a walkway)
		var band := Rect2()
		var TRIM := 0.4                                       # (its two ends are where it meets the next space)
		if long_x: band = Rect2(g.r.position.x + TRIM, g.r.get_center().y - BAND, g.r.size.x - TRIM * 2.0, BAND * 2.0)
		else: band = Rect2(g.r.get_center().x - BAND, g.r.position.y + TRIM, BAND * 2.0, g.r.size.y - TRIM * 2.0)
		for s in solids:
			if s.cat == "floor": continue
			var fr := Rect2(s.lo.x, s.lo.z, s.hi.x - s.lo.x, s.hi.z - s.lo.z)
			if not fr.intersects(band): continue
			var h := g.height(fr.get_center().clamp(g.r.position, g.r.end))
			if s.hi.y <= h + 0.15 or s.lo.y >= h + 1.9: continue      # (flush with it, or overhead)
			# (it really stands on the band: its true box, not its bounds)
			var cen := s.xf.origin
			var bq := Vector2(clampf(cen.x, band.position.x, band.end.x), clampf(cen.z, band.position.y, band.end.y))
			var hit := depth(s.xf, Transform3D(Basis.from_scale(Vector3(band.size.x, 1.6, band.size.y)), Vector3(band.get_center().x, h + 0.8, band.get_center().y))) > TOL
			if hit: hits.append("ON THE WAY %s on %s's centreline at %s" % [_short(s.owner), g.name, _v(Vector3(bq.x, h, bq.y))])
