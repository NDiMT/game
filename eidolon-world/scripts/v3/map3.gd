class_name Map3
## EIDOLON v3 (dev/CH1_V3.md): Chapter I's layout, DATA ONLY. The single source for the v3 world: every space (beat,
## kind, rect, floor), the links between them (doorways), water, the great mirrors and the play PATH. World3 builds
## from it, flow_v3 walks it, tests/render_map3.py draws it (via tests/map3_dump.gd).
## Metres; the Atrium's centre is 0,0; -z is north (up the screen); the camera looks from the south-west, so great
## mirrors stand only on N or E walls. A v3 world runs in scenes/main3.tscn (Game3); the live v2 is untouched.

const ZP := "V3_"                       # region name prefix
const WALL_IN := 0.3                     # walk rects stand this far inside a space's rect (the wall's half)
const DOOR_W := 2.0
const WALL_HI := 2.6                     # N / E walls (behind the action)
const WALL_LO := 0.9                     # S / W parapets (facing the camera: they never hide her)

## [id, beat, name, kind, [x0, z0, x1, z1], y0, y1, axis, part]   axis -1 flat; 0 ramps along x, 1 along z (y0 at the
## low-coordinate end). kind: puzzle, between, landmark, story, hub
const SPACES := [
	["WS", "P", "The Waking Shore", "story", [-10, 31, 2, 35], 0.0, 0.0, -1, "act1"],
	["I1", "I.1", "The Plate She Treads", "puzzle", [2, 24, 10, 35], 0.0, 0.0, -1, "act1"],
	["I2", "I.2", "The Bell", "between", [10, 26, 15, 32], 0.0, 0.0, -1, "act1"],
	["I3", "I.3", "The First Glass", "puzzle", [15, 16, 20, 30], 0.0, 0.0, -1, "act1"],
	["IB1", "-", "The Reed Bank", "between", [14, 10, 21, 16], 0.0, 0.0, -1, "act1"],
	["I4", "I.4", "The One Slab", "puzzle", [4, 10, 14, 17], 0.0, 0.0, -1, "act1"],
	["I5", "I.5", "The Crypt (Lamp)", "story", [-3, 10, 4, 19], 0.0, 0.0, -1, "act1"],
	["A", "I.6", "The Atrium of a Thousand Faces", "hub", [-10, -10, 10, 10], 0.0, 0.0, -1, "hub"],
	["WR", "-", "The Inlet Road", "between", [-18, -1.5, -10, 2], 0.0, 0.0, -1, "west"],
	["W1", "W.1", "The Stair of Breath", "puzzle", [-22, -12, -18, 2], 1.0, 0.0, 1, "west"],
	["W2", "W.2", "The Offering", "between", [-22, -18, -18, -12], 1.0, 1.0, -1, "west"],
	["W3", "W.3", "The Hall of Glass (Shard)", "puzzle", [-32, -27, -22, -14], 1.0, 1.0, -1, "west"],
	["W4", "W.4", "The Star Corridor", "story", [-38, -23, -32, -20], 1.0, 1.0, -1, "west"],
	["W5", "W.5", "Where Her Shadow Fell", "puzzle", [-48, -28, -38, -17], 1.0, 1.0, -1, "west"],
	["IBW", "-", "The Ash Landing", "between", [-46, -17, -40, -12], 1.0, 1.0, -1, "west"],
	["W6", "W.6", "The Hidden Way", "between", [-46, -12, -40, -6], 1.0, 1.0, -1, "west"],
	["WB", "W*", "The Glass Beacon", "landmark", [-48, -6, -38, 2], 1.0, 0.0, 1, "west"],
	["W7", "W.7", "The Colossus Stones", "landmark", [-44, 2, -14, 5], 0.0, 0.0, -1, "west"],
	["N1", "N.1", "The Flooded Colonnade", "puzzle", [-3, -20, 3, -10], 0.0, 0.0, -1, "north"],
	["NG", "-", "The Garden Landing", "between", [-4, -24, 6, -20], 1.0, 0.0, 1, "north"],
	["N2", "N.2", "The Turned Ones", "puzzle", [-8, -36, 2, -24], 1.0, 1.0, -1, "north"],
	["N3", "N.3", "The Votive", "between", [2, -30, 6, -24], 1.0, 1.0, -1, "north"],
	["N4", "N.4", "The Still Room", "puzzle", [6, -36, 16, -26], 1.0, 1.0, -1, "north"],
	["IBN", "-", "The Wind Ramp", "between", [16, -46, 20, -32], 2.0, 1.0, 1, "north"],
	["N5", "N.5", "The Court of Light", "puzzle", [2, -54, 16, -42], 2.0, 2.0, -1, "north"],
	["N6", "N.6", "The Tree of Shards", "landmark", [-4, -54, 2, -44], 2.0, 2.0, -1, "north"],
	["N7", "N.7", "The Mist Maze", "puzzle", [-10, -66, 2, -54], 2.0, 2.0, -1, "north"],
	["NB", "N*", "The Garden Beacon", "landmark", [-10, -74, 0, -66], 2.0, 2.0, -1, "north"],
	["NS", "-", "The Cloister Stair", "between", [-14, -72, -10, -6], 2.0, 0.0, 1, "north"],
	["ER", "-", "The Climbing Road", "between", [10, -1.5, 18, 1.5], 0.0, 1.0, 0, "east"],
	["E1", "E.1", "The Balcony", "landmark", [18, -18, 23, 2], 2.0, 1.0, 1, "east"],
	["E2", "E.2", "The Singing Stones", "puzzle", [18, -28, 28, -18], 2.0, 2.0, -1, "east"],
	["IBE", "-", "The Veil Stair", "between", [28, -27, 31, -21], 2.0, 3.0, 0, "east"],
	["E3", "E.3", "The Mirror Walk", "puzzle", [31, -56, 35, -21], 3.0, 3.0, -1, "east"],
	["E4", "E.4", "The Upward Spring", "landmark", [27, -42, 31, -36], 3.0, 3.0, -1, "east"],
	["E5", "E.5", "The Scales", "puzzle", [24, -68, 36, -56], 3.0, 3.0, -1, "east"],
	["EB", "E.6*", "The High Beacon, the Plate", "landmark", [24, -78, 34, -68], 3.0, 3.0, -1, "east"],
	["EH", "-", "The High Stair", "between", [20, -76, 24, -28], 3.0, 2.0, 1, "east"],
	["VW", "-", "The Veiled Way", "between", [-9, 10, -5, 24], 0.0, 0.0, -1, "act3"],
	["P", "I.20", "The Pool of Halves", "puzzle", [-10, 24, -1, 31], 0.0, 0.0, -1, "act3"],
	["PW", "-", "The Far Shore", "between", [-14, 24, -10, 31], 0.0, 0.0, -1, "act3"],
	["I21", "I.21", "The Bridge that Gives Way", "story", [-34, 26, -14, 29], 0.0, 0.0, -1, "act3"],
	["I22", "I.22", "The Gate of the Four", "puzzle", [-46, 22, -34, 33], 0.0, 0.0, -1, "act3"],
	["I23", "I.23", "The First Shrine", "story", [-46, 10, -34, 22], 0.0, 0.0, -1, "act3"],
]

## doorways: [a, b, width] (0 = DOOR_W, -1 = the whole shared edge open); centred on the shared edge (or at `at`, a
## coordinate along it, as a 4th entry). Unlinked neighbours get a wall.
const LINKS := [
	["WS", "I1", 0], ["I1", "I2", 0], ["I2", "I3", 0], ["I3", "IB1", 0], ["IB1", "I4", 0], ["I4", "I5", 0], ["I5", "A", 0],
	["A", "WR", 0], ["WR", "W1", 0], ["W1", "W2", 0], ["W2", "W3", 0], ["W3", "W4", 0], ["W4", "W5", 0], ["W5", "IBW", 0],
	["IBW", "W6", 0], ["W6", "WB", 0], ["WB", "W7", 0], ["W7", "WR", 0],
	["A", "N1", 0], ["N1", "NG", 0], ["NG", "N2", 0], ["N2", "N3", 0], ["N3", "N4", 0], ["N4", "IBN", 0, -34.2], ["IBN", "N5", 0],
	["N5", "N6", 0], ["N6", "N7", 0], ["N7", "NB", 0], ["NB", "NS", 0], ["NS", "A", 0],
	["A", "ER", 0], ["ER", "E1", 0], ["E1", "E2", 0], ["E2", "IBE", 0], ["IBE", "E3", 0], ["E3", "E4", 0], ["E3", "E5", 0],
	["E5", "EB", 0], ["EB", "EH", 0], ["EH", "E2", 0],
	["A", "VW", 0], ["VW", "P", 0], ["P", "WS", -1], ["P", "PW", 0], ["PW", "I21", 0], ["I21", "I22", 0], ["I22", "I23", 0],
]

## (phase 3) points a route walks through inside a space between its doors, where a straight line would hit the
## puzzle's furniture (N.4: in at the antechamber's gap, out by the east bay, south of the block's rail)
const VIA := {"N4": [[11.0, -31.0], [11.0, -33.4], [12.6, -34.6], [13.4, -33.8]]}
## the play path (space ids in order; flow_v3 walks it door to door). One list per part, walked in this order.
const PATH := {
	"act1": ["WS", "I1", "I2", "I3", "IB1", "I4", "I5", "A"],
	"west": ["A", "WR", "W1", "W2", "W3", "W4", "W5", "IBW", "W6", "WB", "W7", "WR", "A"],
	"north": ["A", "N1", "NG", "N2", "N3", "N4", "IBN", "N5", "N6", "N7", "NB", "NS", "A"],
	"east": ["A", "ER", "E1", "E2", "IBE", "E3", "E4", "E3", "E5", "EB", "EH", "E2", "E1", "ER", "A"],
	"act3": ["A", "VW", "P", "PW", "I21", "I22", "I23"],
}
const PARTS := ["act1", "west", "north", "east", "act3"]
## water (not walkable unless a space stands over it): [x0, z0, x1, z1, y]
const WATER := [[-34, 5, -14, 32, -0.35], [-10, 24, -1, 31, -0.35], [8.2, 10, 9.8, 17, -0.35], [-3, -18, 3, -12, -0.35]]
## (phase 2) spaces that are WATER (no floor: a sunk bed under the sheet, a low rim, no walking until a beat opens a
## road over them: Game3.set_pool_road) and holes cut out of a space's floor (the I.4 stream): [x0, z0, x1, z1]
const POOLS := ["P"]
## (phase 4) spaces that are a BRIDGE: World3 builds no floor and no walls for them; their beat builds the spans (I.21)
const BRIDGES := ["I21"]
const CUTS := {"I4": [[8.2, 10.0, 9.8, 17.0]], "N1": [[-3.0, -18.0, 3.0, -12.0]]}
const OBSERVER := Vector3(-24.0, 0.0, 13.0)      # the sunk veiled head (prologue shot 1, W.7)
## (phase 3) the North wing is shifted 2 m west from the draft (N2 10x12, N3, N4 at x 6..16) and IBN runs north up the
## Still Room's EAST side, so N.4's exit stands in its east wall right beside the glass: the camera looks down 36 deg, so
## a north glass shows only ~3.4 m of floor and things within ~2 m of it; the exit's reflection must be there (CH1_V3 §3)
## the great mirrors: [space, wall ("N" or "E"), from, to (along the wall), bottom y over the floor, height]
const MIRRORS := [["W3", "N", -31.0, -23.0, 0.3, 3.4], ["N2", "N", -7.0, 1.0, 0.3, 3.4], ["N4", "N", 7.4, 15.6, 0.2, 3.5],
	["E3", "E", -54.0, -23.0, 0.3, 3.0]]
## A's moods per part (world.set_mood)
const MOOD := {"act1": "act1", "hub": "act1", "west": "w_glass", "north": "n_garden", "east": "e_high", "act3": "act3"}

static var _by_id := {}

static func space(id: String) -> Array:
	if _by_id.is_empty():
		for s in SPACES: _by_id[s[0]] = s
	return _by_id.get(id, [])

static func rect(id: String) -> Rect2:
	var r: Array = space(id)[4]
	return Rect2(r[0], r[1], r[2] - r[0], r[3] - r[1])

static func walk_rect(id: String) -> Rect2:
	return rect(id).grow(-WALL_IN)

static func part_of(id: String) -> String:
	var s := space(id)
	return str(s[8]) if not s.is_empty() else ""

## a space's floor height at a point (its ramp, clamped to it)
static func height(id: String, p: Vector2) -> float:
	var s := space(id)
	var ax: int = s[7]
	if ax < 0: return s[5]
	var r := rect(id)
	var k := (p.x - r.position.x) / r.size.x if ax == 0 else (p.y - r.position.y) / r.size.y
	return lerpf(s[5], s[6], clampf(k, 0.0, 1.0))

## region name -> space id ("" when not a v3 region)
static func key_of_region(nm: String) -> String:
	if not nm.begins_with(ZP): return ""
	var k := nm.substr(ZP.length())
	var i := k.find("~")
	return k.substr(0, i) if i >= 0 else k

## the doorway between two linked spaces: {c: Vector2 centre on the shared edge, n: Vector2 from a into b, w: width,
## along: Vector2 the edge direction, open: bool}; {} when they are not linked or do not touch
static func door(a: String, b: String) -> Dictionary:
	for l in LINKS:
		if (l[0] == a and l[1] == b) or (l[0] == b and l[1] == a):
			var d := _shared(rect(a), rect(b))
			if d.is_empty(): return {}
			var w := float(l[2])
			var open := w < 0.0
			var span: float = d["len"]
			if open: w = span - 2.0 * WALL_IN
			elif w == 0.0: w = DOOR_W
			w = minf(w, span - 2.0 * WALL_IN)
			var c: Vector2 = d["c"]
			if l.size() > 3: c = c - d["along"] * (d["along"] as Vector2).dot(c) + d["along"] * float(l[3])
			return {"c": c, "n": d["n"], "w": w, "along": d["along"], "open": open}
	return {}

## where two rects touch: {c: centre of the shared segment, len, n: normal from a to b, along}
static func _shared(ra: Rect2, rb: Rect2) -> Dictionary:
	const E := 0.01
	if absf(ra.end.x - rb.position.x) < E or absf(rb.end.x - ra.position.x) < E:
		var x := ra.end.x if absf(ra.end.x - rb.position.x) < E else ra.position.x
		var z0 := maxf(ra.position.y, rb.position.y)
		var z1 := minf(ra.end.y, rb.end.y)
		if z1 - z0 < 1.0: return {}
		return {"c": Vector2(x, (z0 + z1) * 0.5), "len": z1 - z0, "n": Vector2(signf(rb.get_center().x - ra.get_center().x), 0), "along": Vector2(0, 1)}
	if absf(ra.end.y - rb.position.y) < E or absf(rb.end.y - ra.position.y) < E:
		var z := ra.end.y if absf(ra.end.y - rb.position.y) < E else ra.position.y
		var x0 := maxf(ra.position.x, rb.position.x)
		var x1 := minf(ra.end.x, rb.end.x)
		if x1 - x0 < 1.0: return {}
		return {"c": Vector2((x0 + x1) * 0.5, z), "len": x1 - x0, "n": Vector2(0, signf(rb.get_center().y - ra.get_center().y)), "along": Vector2(1, 0)}
	return {}

## the walk route for one part (or "all"): [[x, z, space id], ...]: through each doorway 1 m either side of it
static func route(part := "all") -> Array:
	var out: Array = []
	var parts: Array = PARTS if part == "all" else [part]
	for pt in parts:
		var path: Array = PATH[pt]
		if out.is_empty():
			var c0 := walk_rect(path[0]).get_center()
			if path[0] == "A":          # (the hub's middle is the dry fountain: start 3 m inside the first road's mouth)
				var d0 := door(path[0], path[1])
				c0 = (d0["c"] as Vector2) - (d0["n"] as Vector2) * 3.0
			out.append([c0.x, c0.y, path[0]])
		for i in path.size() - 1:
			var a: String = path[i]
			var b: String = path[i + 1]
			var d := door(a, b)
			if d.is_empty():
				push_error("Map3: no door %s-%s" % [a, b])
				continue
			var c: Vector2 = d["c"]
			var n: Vector2 = d["n"]
			if i > 0 and VIA.has(a):
				for v in VIA[a]: out.append([v[0], v[1], a])
			out.append([c.x - n.x, c.y - n.y, a])
			out.append([c.x + n.x, c.y + n.y, b])
	return out

## the first waypoint of a part's route (flow --area, Game3 jumps)
static func start_of(part: String) -> Vector2:
	var r: Array = route(part)[0]
	return Vector2(r[0], r[1])

## sanity: every link touches, no two spaces overlap; returns problems (empty = good)
static func audit() -> Array:
	var out: Array = []
	for l in LINKS:
		if door(l[0], l[1]).is_empty(): out.append("link %s-%s does not touch" % [l[0], l[1]])
	for i in SPACES.size():
		for j in range(i + 1, SPACES.size()):
			var a := rect(SPACES[i][0]).grow(-0.01)
			var b := rect(SPACES[j][0]).grow(-0.01)
			if a.intersects(b) and not (SPACES[j][0] == "I21" or SPACES[i][0] == "I21"):
				out.append("overlap %s %s" % [SPACES[i][0], SPACES[j][0]])
	for pt in PARTS:
		var path: Array = PATH[pt]
		for i in path.size() - 1:
			if door(path[i], path[i + 1]).is_empty(): out.append("path %s: %s-%s not linked" % [pt, path[i], path[i + 1]])
	return out
