class_name Framing
extends RefCounted
## v0.9: ONE fixed view (no rotation, no zoom). The rooms are laid out so that, from that view, nothing
## stands between the camera and a puzzle piece. This holds the per-room list of pieces the occlusion test
## (tests/framing_test) checks: every interactable in the room, plus key pieces that have no interact.

const YAW := -PI * 0.25
const PITCH := deg_to_rad(36.0)

## key -> floor y, extra pieces (key things without an interact)
const ROOMS := {
	"waking_pool": {"y": 0.0, "extra": []},
	"stair_breath": {"y": 0.5, "extra": []},
	"hall_glass": {"y": 1.0, "extra": [Vector3(0.0, 3.0, -20.5)]},
	"shard_gallery": {"y": 1.0, "extra": [Vector3(7.5, 2.5, -13.2)]},
	"garden_veiled": {"y": 1.0, "extra": []},
	"hollow_walk": {"y": 1.0, "extra": []},
	"court_light": {"y": 2.0, "extra": [Vector3(16.98, 4.0, -24.05)]},
	"mist_maze": {"y": 2.0, "extra": []},
	"echo_corridor": {"y": 2.0, "extra": []},
	"scales": {"y": 2.0, "extra": [Vector3(30.65, 3.6, -49.0), Vector3(31.6, 3.6, -49.0), Vector3(32.55, 3.6, -49.0)]},
	"eidolon_ledge": {"y": 2.0, "extra": []},
	"gate_four": {"y": 2.0, "extra": [Vector3(25.0, 3.0, -30.75)]},
	"first_shrine": {"y": 2.0, "extra": []},
}
## an interact whose piece is not where you stand to use it: the piece itself (its centre, 0.5 m below: the
## test samples half a metre up), and its corners
const PIECE_OF := {"breathe_garden": [Vector3(16.84, 1.85, -13.95), Vector3(16.84, 0.95, -14.45), Vector3(16.84, 0.95, -13.45),
	Vector3(16.84, 2.75, -14.45), Vector3(16.84, 2.75, -13.45)]}

## (moved at runtime: never part of a room's list)
const DYNAMIC := ["hall_push", "hall_take", "hall_place", "ledge_push"]

## the camera's basis for the fixed view (its +z points back toward the camera)
static func basis() -> Basis:
	return Basis(Vector3.UP, YAW) * Basis(Vector3.RIGHT, -PITCH)

## the pieces of room k: [name, point] (interactables by the area of the floor they stand on)
static func points(k: String, level: Level) -> Array:
	var pts: Array = []
	for it: Level.Interact in level.interacts:
		var p := it.pos
		if it.id in DYNAMIC or p == Vector3.ZERO: continue
		var rg := level.region_at(Vector2(p.x, p.z))
		var ra: String = Names.REGION_AREA.get(rg.name, "") if rg else ""
		if ra == "":
			# (on an unnamed floor: the nearest named one)
			var best := 3.0
			for g: Level.Region in level.regions:
				var a: String = Names.REGION_AREA.get(g.name, "")
				if a == "": continue
				var q := Vector2(clampf(p.x, g.r.position.x, g.r.end.x), clampf(p.z, g.r.position.y, g.r.end.y))
				var dd := q.distance_to(Vector2(p.x, p.z))
				if dd < best: best = dd; ra = a
		if ra == k:
			if PIECE_OF.has(it.id):
				var n := 0
				for q in PIECE_OF[it.id]:
					pts.append(["interact " + it.id + (" glass" if n == 0 else " glass corner %d" % n), q])
					n += 1
			else:
				pts.append(["interact " + it.id, p])
	for e in ROOMS[k]["extra"]: pts.append(["piece", e])
	return pts
