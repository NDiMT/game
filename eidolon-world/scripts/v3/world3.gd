class_name World3
## v3: builds Chapter I's block-out from Map3 (data only) with the Level kit: walk regions (each space's rect, 0.3 m in
## from its walls) and a doorway region per link; floors (flat slabs or stairs on ramps), walls with their doorways cut
## (high on N / E sides, low parapets on S / W: they face the camera and never hide her), water, the great mirrors and
## block-out labels. One merged zone per part (the web's marble buffer holds 256 instances).

static var labels_on := OS.get_environment("EIDOLON_LABELS") == "1"          # (block-out review shots only)
static var mirrors := {}          # space id -> Reflector (the great glass)
static var _wall_n := 0
## a great glass stands this far out from its wall's middle: its face is 0.2 m out, and the mirror camera keeps marble only
## 3 cm or more in front of the glass (marble.gdshaderinc refl_clip), so the wall behind must sit further back than that
const GLASS_OFF := 0.29          # (and 2 cm proud of the wall's coping, which juts 7 cm)
static var waters: Array[MeshInstance3D] = []     # the water sheets (Map3.WATER order)

static func zone(part: String) -> String:
	return "v3_" + part

static func build(lv: Level) -> void:
	mirrors.clear()
	waters.clear()
	for s in Map3.SPACES: _space(lv, s)
	for l in Map3.LINKS: _doorway(lv, l[0], l[1])
	for s in Map3.SPACES: _walls(lv, s)

## after Level.commit (needs the game: the glass and water are nodes)
static func post(lv: Level, game: Game, parent: Node3D) -> void:
	_water(lv, parent)
	for m in Map3.MIRRORS: _mirror(game, parent, m)
	if labels_on: _labels(parent)

static func _space(lv: Level, s: Array) -> void:
	var id: String = s[0]
	var r := Map3.rect(id)
	var y0: float = s[5]
	var y1: float = s[6]
	var ax: int = s[7]
	var wr := Map3.walk_rect(id)
	# (a ramp's walk rect is inset: its ends take the space's slope at those points, so doorways meet it level)
	var pool := id in Map3.POOLS
	lv.walk(wr, Map3.height(id, wr.position), Map3.height(id, wr.end), ax, Map3.ZP + id, not pool)
	var z := zone(s[8])
	var mat := 0.0 if s[3] != "hub" else 0.15
	if pool: lv.slab(z, r, y0 - 1.1, 0.4, 0.5)          # (the pool's bed, under the sheet)
	elif ax < 0 or is_equal_approx(y0, y1):
		for rr in _cut(r, Map3.CUTS.get(id, [])): lv.slab(z, rr, y0, 0.6, mat)
	else: lv.steps(z, r, ax, minf(y0, y1), maxf(y0, y1), y1 > y0)

## a floor rect less its holes (each hole spans the rect along one axis: the strips either side of it)
static func _cut(r: Rect2, holes: Array) -> Array:
	var out: Array = [r]
	for h in holes:
		var hr := Rect2(h[0], h[1], h[2] - h[0], h[3] - h[1])
		var nxt: Array = []
		for q: Rect2 in out:
			if not q.intersects(hr):
				nxt.append(q)
				continue
			if hr.position.x > q.position.x: nxt.append(Rect2(q.position.x, q.position.y, hr.position.x - q.position.x, q.size.y))
			if hr.end.x < q.end.x: nxt.append(Rect2(hr.end.x, q.position.y, q.end.x - hr.end.x, q.size.y))
			var x0 := maxf(q.position.x, hr.position.x)
			var x1 := minf(q.end.x, hr.end.x)
			if hr.position.y > q.position.y: nxt.append(Rect2(x0, q.position.y, x1 - x0, hr.position.y - q.position.y))
			if hr.end.y < q.end.y: nxt.append(Rect2(x0, hr.end.y, x1 - x0, q.end.y - hr.end.y))
		out = nxt
	return out

static func _doorway(lv: Level, a: String, b: String) -> void:
	var d := Map3.door(a, b)
	if d.is_empty(): return
	var c: Vector2 = d["c"]
	var n: Vector2 = d["n"]
	var al: Vector2 = d["along"]
	var w: float = d["w"]
	var depth := Map3.WALL_IN + 0.5
	var ha := Map3.height(a, c - n * 0.8)
	var hb := Map3.height(b, c + n * 0.8)
	var p0 := c - n * depth - al * w * 0.5
	var p1 := c + n * depth + al * w * 0.5
	var r := Rect2(minf(p0.x, p1.x), minf(p0.y, p1.y), absf(p1.x - p0.x), absf(p1.y - p0.y))
	var ax := 0 if absf(n.x) > 0.5 else 1
	var pos := (n.x if ax == 0 else n.y) > 0.0          # b lies at the higher coordinate
	var y_lo := ha if pos else hb
	var y_hi := hb if pos else ha
	lv.walk(r, y_lo, y_hi, ax if not is_equal_approx(ha, hb) else -1, Map3.ZP + a + "~" + b, not (a in Map3.POOLS or b in Map3.POOLS))
	# a pool's lip: the land side walks right to the water's edge (she wakes there; the pool itself is shut)
	if a in Map3.POOLS or b in Map3.POOLS:
		var land := b if a in Map3.POOLS else a
		var nl := n if a in Map3.POOLS else -n          # (from the pool toward the land)
		var q0 := c - al * w * 0.5
		var q1 := c + al * w * 0.5 + nl * (Map3.WALL_IN + 0.05)
		lv.walk(Rect2(minf(q0.x, q1.x), minf(q0.y, q1.y), absf(q1.x - q0.x), absf(q1.y - q0.y)), Map3.height(land, c), NAN, -1, Map3.ZP + land)
	# the threshold: a slab under the gap in the wall
	var thr := Rect2(c - (n * Map3.WALL_IN + al * w * 0.5).abs(), (n * Map3.WALL_IN * 2.0 + al * w).abs())
	lv.slab(zone(Map3.part_of(a)), thr, maxf(ha, hb) - 0.004, 0.5, 0.3, false)

## each edge of a space: wall it, but leave its doorways open and leave shared stretches to the space listed first
static func _walls(lv: Level, s: Array) -> void:
	var id: String = s[0]
	var r := Map3.rect(id)
	var ylo := minf(s[5], s[6])
	var yhi := maxf(s[5], s[6])
	var idx := Map3.SPACES.find(s)
	# edges: [fixed coordinate, axis along (0 x, 1 z), from, to, side]
	var edges := [[r.position.y, 0, r.position.x, r.end.x, "N"], [r.end.y, 0, r.position.x, r.end.x, "S"],
		[r.position.x, 1, r.position.y, r.end.y, "W"], [r.end.x, 1, r.position.y, r.end.y, "E"]]
	for e in edges:
		var cuts: Array = []           # [from, to] stretches with no wall of ours
		var shared := false
		for j in Map3.SPACES.size():
			var o: Array = Map3.SPACES[j]
			if o[0] == id: continue
			var ro := Map3.rect(o[0])
			var ov := _edge_overlap(e, ro)
			if ov.is_empty(): continue
			shared = true
			var d := Map3.door(id, o[0])
			if not d.is_empty():
				var c: Vector2 = d["c"]
				var cc: float = c.x if e[1] == 0 else c.y
				var hw: float = d["w"] * 0.5
				cuts.append([cc - hw, cc + hw])
			if j < idx: cuts.append(ov)          # the first-listed space walls the shared stretch
		var h := Map3.WALL_HI if e[4] == "N" or e[4] == "E" else Map3.WALL_LO
		if shared and (e[4] == "N" or e[4] == "E"): h = 1.8          # between two rooms: mid height (fades for her)
		if id in Map3.POOLS: h = 0.25                                # (a pool: a low rim, the water open to the sky)
		for seg in _subtract([e[2], e[3]], cuts):
			if seg[1] - seg[0] < 0.25: continue
			var wr: Rect2
			if e[1] == 0: wr = Rect2(seg[0], e[0] - 0.2, seg[1] - seg[0], 0.4)
			else: wr = Rect2(e[0] - 0.2, seg[0], 0.4, seg[1] - seg[0])
			_wall_n += 1
			lv.wall(zone(s[8]), wr, ylo - 0.05, yhi + h + 0.004 * (_wall_n % 4), h > 1.0)          # (tops a hair apart: two walls meeting at a corner never share a plane)
			lv.ob_rect(wr)          # (outside every walk region anyway: it tells the dressing where the walls stand)

## the stretch [from, to] of an edge that lies along another rect's border, [] if none
static func _edge_overlap(e: Array, ro: Rect2) -> Array:
	const EPS := 0.01
	var f: float = e[0]
	if e[1] == 0:
		if absf(ro.position.y - f) > EPS and absf(ro.end.y - f) > EPS: return []
		var a := maxf(e[2], ro.position.x)
		var b := minf(e[3], ro.end.x)
		return [a, b] if b - a > EPS else []
	if absf(ro.position.x - f) > EPS and absf(ro.end.x - f) > EPS: return []
	var a2 := maxf(e[2], ro.position.y)
	var b2 := minf(e[3], ro.end.y)
	return [a2, b2] if b2 - a2 > EPS else []

static func _subtract(seg: Array, cuts: Array) -> Array:
	var out: Array = [seg]
	for c in cuts:
		var nxt: Array = []
		for s in out:
			if c[1] <= s[0] or c[0] >= s[1]:
				nxt.append(s)
				continue
			if c[0] > s[0]: nxt.append([s[0], c[0]])
			if c[1] < s[1]: nxt.append([c[1], s[1]])
		out = nxt
	return out

static func _water(lv: Level, parent: Node3D) -> void:
	for e in Map3.WATER:
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/water.gdshader")
		m.set_shader_parameter("noise_tex", lv.noise_tex)
		var mi := MeshInstance3D.new()
		mi.name = "V3Water"
		var pm := PlaneMesh.new()
		pm.size = Vector2(absf(e[2] - e[0]), absf(e[3] - e[1]))
		mi.mesh = pm
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.position = Vector3((e[0] + e[2]) * 0.5, e[4], (e[1] + e[3]) * 0.5)
		parent.add_child(mi)
		waters.append(mi)

## a great glass on a space's N or E wall, facing into the room
static func _mirror(game: Game, parent: Node3D, m: Array) -> void:
	var id: String = m[0]
	var r := Map3.rect(id)
	var y := minf(Map3.space(id)[5], Map3.space(id)[6])
	var size := Vector2(m[3] - m[2], m[5])
	var c: Vector3
	var n: Vector3
	if m[1] == "N":
		c = Vector3((m[2] + m[3]) * 0.5, y + m[4] + m[5] * 0.5, r.position.y + GLASS_OFF)
		n = Vector3.BACK
	else:
		c = Vector3(r.end.x - GLASS_OFF, y + m[4] + m[5] * 0.5, (m[2] + m[3]) * 0.5)
		n = Vector3.LEFT
	mirrors[id] = TwoWorld.wall_mirror(parent, game, c, n, size, r)

static func _labels(parent: Node3D) -> void:
	for s in Map3.SPACES:
		var r := Map3.rect(s[0])
		var l := Label3D.new()
		l.name = "V3Label_" + str(s[0])
		l.text = "%s %s\n%s" % [s[0], s[1], s[2]]
		l.font_size = 56
		l.pixel_size = 0.006
		l.modulate = Color(0.55, 0.06, 0.1, 0.85)
		l.outline_modulate = Color(1, 1, 1, 0.5)
		l.outline_size = 8
		l.rotation = Vector3(-PI * 0.5, -PI * 0.25, 0.0)
		l.layers = TwoWorld.MINE
		l.shaded = false
		l.position = Vector3(r.get_center().x, Map3.height(s[0], r.get_center()) + 0.03, r.get_center().y)
		parent.add_child(l)
