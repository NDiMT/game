class_name Framing
extends RefCounted
## v0.9: FIXED CAMERA, FRAMED ROOMS. One iso yaw, one zoom (World.FIXED_SIZE, the visible width in metres).
## Each puzzle room is a diorama: while you are in its anchor zone the camera holds the room's framing
## (its interactables, its key pieces, its exits all on screen, centred in the safe part of a portrait
## phone screen: below the top labels, above the stick and the button), following you only a little;
## in corridors it follows you, and it eases into the next room's framing as you enter.
## The framing is SOLVED from the room's points (a static projection, the same one the test uses), for
## the actual screen aspect: nothing hand-placed but the zones, the exits and a few extra points.

const YAW := -PI * 0.25
const PITCH := deg_to_rad(36.0)
## the safe rect in CSS pixels (top: area label / text; bottom: the stick zone and the button)
const SAFE_TOP := 64.0
const SAFE_BOTTOM := 150.0
const SAFE_SIDE := 12.0

## key -> anchor zone (x0, z0, x1, z1), floor y, exits, extra points (key pieces without an interact)
const ROOMS := {
	"waking_pool": {"zone": [-9.4, -6.3, 5.0, 5.0], "y": 0.0,
		"exits": [Vector3(-9.4, 0.0, 2.9), Vector3(0.0, 0.0, -6.3), Vector3(4.45, 0.0, -2.0)],
		"extra": [Vector3(-8.8, 0.0, 2.9), Vector3(-3.8, 0.0, -3.7)]},
	"stair_breath": {"zone": [-12.8, -8.0, -9.4, -1.0], "y": 0.5,
		"exits": [Vector3(-11.3, 0.0, -0.2), Vector3(-11.3, 0.5, -6.8)],
		"extra": [Vector3(-10.215, 1.75, -2.6), Vector3(-10.345, 1.75, -5.3)]},
	"hall_glass": {"zone": [-4.6, -20.6, 4.6, -11.0], "y": 1.0,
		"exits": [Vector3(-4.6, 1.0, -13.5), Vector3(4.8, 1.0, -17.5)],
		"extra": [Vector3(0.0, 3.4, -20.6), Vector3(-2.6, 3.4, -20.6), Vector3(2.6, 3.4, -20.6), Vector3(-1.0, 1.0, -13.0), Vector3(3.0, 1.0, -12.3)]},
	"shard_gallery": {"zone": [5.0, -18.4, 10.3, -9.6], "y": 1.0,
		"exits": [Vector3(5.0, 1.0, -17.5), Vector3(10.2, 1.0, -11.0)],
		"extra": [Vector3(7.5, 3.4, -14.0)]},
	"garden_veiled": {"zone": [7.0, -15.0, 17.0, -5.0], "y": 1.0,
		"exits": [Vector3(10.2, 1.0, -11.0), Vector3(17.0, 1.0, -11.8), Vector3(7.0, 1.0, -7.0)],
		"extra": [Vector3(12.8, 5.5, -14.95)]},
	"hollow_walk": {"zone": [17.5, -15.0, 25.5, -6.0], "y": 1.0,
		"exits": [Vector3(17.0, 1.0, -11.8), Vector3(18.5, 1.5, -15.5)],
		"extra": [Vector3(21.5, 1.0, -10.5), Vector3(24.5, 1.0, -7.0)]},
	"court_light": {"zone": [7.0, -27.0, 17.0, -17.0], "y": 2.0,
		"exits": [Vector3(16.0, 2.0, -17.8), Vector3(12.0, 2.0, -27.0), Vector3(17.0, 2.0, -20.4)],
		"extra": [Vector3(8.2, 2.0, -22.6), Vector3(15.7, 2.0, -25.6), Vector3(16.98, 6.4, -24.05), Vector3(12.0, 5.5, -27.1)]},
	"mist_maze": {"zone": [9.0, -39.0, 17.0, -29.0], "y": 2.0,
		"exits": [Vector3(12.0, 2.0, -28.0), Vector3(10.0, 2.0, -39.0)],
		"extra": [Vector3(4.6, 2.0, -34.0)]},
	"echo_corridor": {"zone": [9.0, -50.2, 25.6, -42.0], "y": 2.0,
		"exits": [Vector3(10.0, 2.0, -39.0), Vector3(26.2, 2.0, -45.4)],
		"extra": []},
	"scales": {"zone": [26.0, -52.0, 33.4, -44.6], "y": 2.0,
		"exits": [Vector3(26.2, 2.0, -45.4), Vector3(31.4, 2.0, -45.6)],
		"extra": [Vector3(29.7, 4.5, -49.0)]},
	"eidolon_ledge": {"zone": [21.0, -25.0, 29.0, -19.0], "y": 2.0,
		"exits": [Vector3(29.7, 3.0, -22.4), Vector3(21.0, 2.0, -20.4), Vector3(27.7, 2.0, -25.0)],
		"extra": [Vector3(25.0, 4.5, -21.0)]},
	"gate_four": {"zone": [20.0, -36.0, 30.0, -28.0], "y": 2.0,
		"exits": [Vector3(27.7, 2.0, -28.0), Vector3(28.0, 2.0, -36.0)],
		"extra": [Vector3(25.0, 4.2, -30.75)]},
}

static func basis() -> Basis:
	return Basis(Vector3.UP, YAW) * Basis(Vector3.RIGHT, -PITCH)

## the room whose anchor zone holds p (on its floor level), or ""
static func room_at(p: Vector3) -> String:
	for k in ROOMS:
		var z: Array = ROOMS[k]["zone"]
		if p.x >= z[0] and p.x <= z[2] and p.z >= z[1] and p.z <= z[3] and absf(p.y - float(ROOMS[k]["y"])) < 1.4: return k
	return ""

## (moved at runtime: never part of a room's framing)
const DYNAMIC := ["hall_push", "hall_take", "hall_place", "ledge_push"]

## every point that must be on screen in room k: its interactables (floor and 1.8 m up), exits (floor and a
## door's top), extra pieces, and the corners of the floor you can walk on in the zone (you, head and feet)
static func points(k: String, level: Level) -> Array:
	var r: Dictionary = ROOMS[k]
	var z: Array = r["zone"]
	var zr := Rect2(z[0], z[1], z[2] - z[0], z[3] - z[1])
	var fy := float(r["y"])
	var pts: Array = []
	for it: Level.Interact in level.interacts:
		var p := it.pos
		if it.id in DYNAMIC or p == Vector3.ZERO: continue
		var rg := level.region_at(Vector2(p.x, p.z))
		var ra: String = Names.REGION_AREA.get(rg.name, "") if rg else ""
		if ra != k and not (ra == "" and zr.has_point(Vector2(p.x, p.z))): continue
		if absf(p.y - fy) < 1.4:
			pts.append(["interact " + it.id, p])
			pts.append(["interact " + it.id + " (top)", p + Vector3(0, 1.8, 0)])
	for e in r["exits"]:
		pts.append(["exit", e])
		pts.append(["exit (top)", e + Vector3(0, 2.2, 0)])
	for e in r["extra"]: pts.append(["piece", e])
	for e in reach(k, level): pts.append(e)
	return pts

## where you can stand in room k (its own walk regions, feet clear of every solid), reduced to the extremes on
## screen: the leftmost, rightmost, nearest and farthest spots (feet, and the head 1.7 m up)
static var _reach := {}
static func reach(k: String, level: Level) -> Array:
	if _reach.has(k): return _reach[k]
	var r: Dictionary = ROOMS[k]
	var z: Array = r["zone"]
	var zr := Rect2(z[0], z[1], z[2] - z[0], z[3] - z[1])
	var fy := float(r["y"])
	var cand: Array = []
	for g: Level.Region in level.regions:
		if not g.enabled: continue
		var ga: String = Names.REGION_AREA.get(g.name, "")
		if ga != k and not (ga == "" and zr.has_point(g.r.get_center())): continue
		if absf((g.y0 + g.y1) * 0.5 - fy) >= 1.4 or not g.r.intersects(zr): continue
		var c := g.r.intersection(zr)
		var nx := maxi(1, int(c.size.x / 0.2)); var nz := maxi(1, int(c.size.y / 0.2))
		for i in nx + 1:
			for j in nz + 1:
				var q := c.position + Vector2(c.size.x * i / nx, c.size.y * j / nz)
				cand.append(Vector3(q.x, g.height(q), q.y))
	var out: Array = []
	var b := basis()
	for dir in [["left", -b.x, 0.0], ["right", b.x, 0.0], ["near", -b.y, 0.0], ["far", b.y, 1.7]]:
		var dv: Vector3 = dir[1]
		var lift: float = dir[2]
		cand.sort_custom(func(p: Vector3, q: Vector3) -> bool: return (p + Vector3(0, lift, 0)).dot(dv) > (q + Vector3(0, lift, 0)).dot(dv))
		for p: Vector3 in cand:
			var p2 := Vector2(p.x, p.z)
			if level.circle_ok(p2, 0.25) and not level.blocked(p2, 0.25):
				out.append(["you, " + dir[0] + "most", p])
				out.append(["you, " + dir[0] + "most (head)", p + Vector3(0, 1.7, 0)])
				break
	_reach[k] = out
	return out

## screen-plane coordinates (metres: right, up) of p for the fixed view (the camera's own origin)
static func plane(p: Vector3) -> Vector2:
	var b := basis()
	return Vector2(p.dot(b.x), p.dot(b.y))

## the rig position that centres room k's points in the safe rect of a w x h (CSS px) screen at `size`
## (metres visible across), and the width that room needs to fit at all
static func solve(k: String, level: Level, w: float, h: float, size: float, v_offset: float) -> Dictionary:
	var lo := Vector2(INF, INF)
	var hi := -lo
	for e in points(k, level):
		var q := plane(e[1])
		lo = lo.min(q); hi = hi.max(q)
	var sw := w - 2.0 * SAFE_SIDE
	var sh := h - SAFE_TOP - SAFE_BOTTOM
	var need := maxf((hi.x - lo.x) * w / sw, (hi.y - lo.y) * w / sh)
	var mid := (lo + hi) * 0.5
	# the safe rect's centre, below the screen centre by `dy` px: the rig sits that much higher
	var dy := (SAFE_TOP + sh * 0.5) - h * 0.5
	var b := basis()
	var floor_y := float(ROOMS[k]["y"])
	# rig such that plane(rig) = (mid.x, mid.y - v_offset + dy * size / w), placed at the room's floor + 0.6
	var want := Vector2(mid.x, mid.y - v_offset + dy * size / w)
	var r := b.x * want.x + b.y * want.y
	var fwd := b.z
	r += fwd * ((floor_y + 0.6 - r.y) / fwd.y)
	# how far the gentle follow may move the view (metres, screen right / up) before something leaves the rect
	var slack := Vector2(maxf(0.0, (sw * size / w - (hi.x - lo.x)) * 0.5), maxf(0.0, (sh * size / w - (hi.y - lo.y)) * 0.5))
	return {"rig": r, "need": need, "lo": lo, "hi": hi, "slack": slack}

## where p lands on a w x h screen with the rig at `rig` (CSS px)
static func project(p: Vector3, rig: Vector3, w: float, h: float, size: float, v_offset: float) -> Vector2:
	var q := plane(p) - plane(rig)
	return Vector2(w * 0.5 + q.x * w / size, h * 0.5 - (q.y - v_offset) * w / size)
