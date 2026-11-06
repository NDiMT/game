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
	"atrium": {"y": 0.0, "extra": [Map2.O + Vector3(0.0, 1.2, 0.0)]},          # (v2: the Atrium's fountain)   # (v1.0: the fountain, the lamp on the bench, the undercroft's mouth, the first hidden stone)
	"stair_breath": {"y": 0.5, "extra": []},
	"hall_glass": {"y": 1.0, "extra": [Map2.GW + Vector3(0.0, 3.0, -20.5)]},
	"shard_gallery": {"y": 1.0, "extra": [Map2.GG + Vector3(7.5, 2.5, -13.2), Map2.GG + Vector3(7.5, 0.53, -11.585), Map2.GG + Vector3(7.026, 0.53, -15.098), Map2.GG + Vector3(6.524, 0.53, -14.393)]},   # (v0.9.2: and her shadows' eye-pairs on the floor: Chapter.eye_pos)
	"garden_veiled": {"y": 1.0, "extra": []},
	"hollow_walk": {"y": 1.0, "extra": [Map2.GN + Vector3(20.802, 0.55, -9.302), Map2.GN + Vector3(20.448, 0.55, -11.388), Map2.GN + Vector3(22.888, 0.55, -8.948), Map2.GN + Vector3(22.99, 1.8, -11.49), Map2.GN + Vector3(21.155, 1.0, -13.332), Map2.GN + Vector3(24.832, 1.0, -9.655), Map2.GN + Vector3(21.155, 3.4, -13.332), Map2.GN + Vector3(24.832, 3.4, -9.655)]},   # (v1.1d Our Steps: the entry gap, two slabs; the mirror's centre and corners)
	"court_light": {"y": 2.0, "extra": [Map2.GN + Vector3(16.98, 4.0, -24.05)]},
	"mist_maze": {"y": 2.0, "extra": []},
	"echo_corridor": {"y": 2.0, "extra": []},
	"scales": {"y": 2.0, "extra": [Map2.GE + Vector3(30.65, 3.6, -49.0), Map2.GE + Vector3(31.6, 3.6, -49.0), Map2.GE + Vector3(32.55, 3.6, -49.0)]},
	"eidolon_ledge": {"y": 2.0, "extra": []},
	"gate_four": {"y": 0.0, "extra": [Map2.O + Vector3(-41.6, Map2.PLINTH_H, 21.0)]},          # (v2 I.22: the empty plinth)
	"first_shrine": {"y": 0.0, "extra": [Map2.O + Map2.SHRINE_POOL]},          # (v2 I.23: the pool)
}
## an interact whose piece is not where you stand to use it: the piece itself (its centre, 0.5 m below: the
## test samples half a metre up), and its corners
const PIECE_OF := {"breathe_garden": [Map2.GN + Vector3(16.84, 1.85, -13.95), Map2.GN + Vector3(16.84, 0.95, -14.45), Map2.GN + Vector3(16.84, 0.95, -13.45),
	Map2.GN + Vector3(16.84, 2.75, -14.45), Map2.GN + Vector3(16.84, 2.75, -13.45)]}      # (her small glass, back in v0.9.4)

## (moved at runtime: never part of a room's list)
const DYNAMIC := ["hall_push", "hall_take", "hall_place", "ledge_push"]

## the camera's basis for the fixed view (its +z points back toward the camera)
static func basis() -> Basis:
	return Basis(Vector3.UP, YAW) * Basis(Vector3.RIGHT, -PITCH)

## a floor's area key (v2: the new world's regions by Map2; the old world's by Names)
static func area_of(region: String) -> String:
	if Map2.key_of_region(region) != "": return Map2.area_of_region(region)
	return Names.REGION_AREA.get(region, "")

## the pieces of room k: [name, point] (interactables by the area of the floor they stand on)
static func points(k: String, level: Level) -> Array:
	var pts: Array = []
	for it: Level.Interact in level.interacts:
		var p := it.pos
		if it.id in DYNAMIC or p == Vector3.ZERO: continue
		var rg := level.region_at(Vector2(p.x, p.z))
		var ra: String = area_of(rg.name) if rg else ""
		if ra == "":
			# (on an unnamed floor: the nearest named one)
			var best := 3.0
			for g: Level.Region in level.regions:
				var a: String = area_of(g.name)
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
