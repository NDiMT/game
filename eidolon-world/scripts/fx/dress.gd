class_name Dress
extends Node3D
## v2.0 (Agent A) LANDMARK SET DRESSING for the new Chapter I (EIDOLON_SCRIPT §5, §6). One call per landmark: W gives the
## landmark's floor rectangle (world x/z) and its floor height; the recipe fills it with the kit (props, kit_*, a few
## primitives) so each space has its own silhouette at the fixed camera:
##   var d := Dress.build(level, self, "atrium", Rect2(x0, z0, w, d), floor_y, [path_rect, ...])
##   d.beacons      the BeaconFire nodes a recipe made ("beacon" entries; none in the Chapter I recipes now: W places them)
##   d.skipped      pieces it left out (they would have hit a wall, an obstacle or a kept-clear path), for the log
## Rules it keeps by itself:
##  * the camera looks from the south-west: tall pieces only stand on a landmark's NORTH and EAST edges (the back of
##    the view); the south and west edges (the front) get low pieces only; anything taller than 1.6 m also joins the
##    see-through (it fades if it ever hides her).
##  * nothing overlaps: every piece is tested against the level's solids and obstacles (and the earlier pieces), the
##    `keep` rects (paths, puzzle floor) and the landmark's own rect; a piece that does not fit is skipped, never forced.
##  * every piece gets an obstacle footprint; on Low the veils are not built (the small dressing is merged in: it costs nothing).
##  * cheap: a landmark is ONE merged marble mesh + one see-through mesh + one contact-shadow multimesh (+ its glass
##    panes, flames, veils, mist if the recipe has them). The marble per-instance buffer is tight (256): never more.
##  * the one crimson light: the only lights are Flame votives / BeaconFire (crimson), nothing else glows.
## Recipe coordinates: u 0 (west edge) .. 1 (east edge), v 0 (north edge) .. 1 (south edge); yaw in degrees, the models
## face +Z (south); "cam" = turned to face the camera (-45).

static var high := true
const PROPS := "res://assets/models/props/"
## asset -> marble material id (vertex colour g): 0.25 carved marble, 0.5 rough stone, 0.9 bronze, 0.97 wood, 1.0 charcoal
const MAT := {"kit_scaffold": 0.97, "kit_ladder": 0.97, "kit_awning_post": 0.97, "kit_gallery": 0.97, "kit_bridge_deck": 0.97,
	"kit_workbench": 0.97, "kit_cot": 0.97, "kit_windbells": 0.97, "item_wax_tablet": 0.97}
## assets that are not in props/ (full paths)
const PATHS := {"item_wax_tablet": "res://assets/models/items/item_wax_tablet.glb"}
const TALL := 1.6
## a new kit piece not made yet -> the existing asset that stands in for it, at this scale
const FALLBACK := {"kit_votive": ["altar_shrine", 0.45], "kit_windbells": ["kit_awning_post", 1.0]}

var level: Level
var skipped: Array = []
var beacons: Array[BeaconFire] = []
var flames: Array[Flame] = []
var extras: Array[Node] = []            # veils, mist, petals (owned here)
var _rect: Rect2
var _y := 0.0
var _keep: Array = []
var _parts := {"main": [], "occ": [], "small": []}     # [ArrayMesh, Transform3D]
var _blobs: Array[Transform3D] = []
var _small_mi: MeshInstance3D
static var _cache := {}

# =============================================================================================================== recipes
## [what, u, v, yaw, scale, {opts}]  opts: y (lift), tilt (deg, toppled), on (sits on the piece before: no overlap test),
## small (Low leaves it out), size / mat (primitives), r / h (cylinders)
const RECIPES := {
	# ---------------------------------------------------------------- ACT 1 (the pale morning: "act1")
	# the stub gateway: a temple door standing alone on the north edge, going nowhere; a pylon, the gable fallen
	"stub_gateway": [
		["door_temple", 0.5, 0.06, 0.0, 1.0], ["pylon_ashlar", 0.2, 0.08, 0.0, 0.8],
		["pediment_fragment", 0.86, 0.3, 70.0, 0.8, {"small": true}],
		["column_stump", 0.92, 0.12, 0.0, 0.8], ["rubble_pile", 0.15, 0.2, 30.0, 0.45, {"small": true}],
		["wall_ruin_low", 0.1, 0.62, 90.0, 0.6], ["kit_dead_plant", 0.93, 0.62, 0.0, 0.9, {"small": true}]],
	# the one-stroke glass: a carved niche on the north wall (W's glass goes in it), two veiled busts keep it
	"glass_niche": [
		["pylon_ashlar_niche", 0.5, 0.06, 0.0, 1.0],
		["statue_veiled_bust", 0.2, 0.12, 20.0, 0.85], ["statue_veiled_bust", 0.82, 0.12, -20.0, 0.85],
		["column_stump", 0.95, 0.45, 0.0, 0.7], ["rubble_pile", 0.08, 0.55, 0.0, 0.35, {"small": true}]],
	# Theron's dark crypt: his cot, his bench of tools with wax tablets on it, the faces he gave up on, the
	# unfinished one in the corner, one small lamp flame on the bench (W's lamp beat lights the rest)
	"crypt": [
		["kit_cot", 0.18, 0.2, 90.0, 0.9], ["kit_workbench", 0.68, 0.1, 0.0, 1.0],
		["item_wax_tablet", 0.6, 0.1, 15.0, 2.2, {"y": 0.97, "on": true}], ["item_wax_tablet", 0.78, 0.11, -20.0, 2.2, {"y": 0.97, "on": true}],
		["statue_veiled_unfinished", 0.9, 0.86, -60.0, 0.85],
		["kit_face2", 0.95, 0.3, -90.0, 0.8, {"small": true}], ["kit_face5", 0.35, 0.92, 160.0, 0.75, {"small": true, "tilt": 90.0}],
		["kit_urns", 0.08, 0.8, 30.0, 0.8, {"small": true}], ["kit_face6", 0.6, 0.94, 120.0, 0.7, {"small": true}],
		["flame", 0.6, 0.1, 0.0, 0.14, {"y": 0.97, "on": true}]],
	# the Atrium of a Thousand Faces: his attempts in two rows on plinths along the back (north and east), more
	# on the floor in front where he left them, scaffolds and a ladder in the back corners, the dry fountain in the
	# middle (its still water is W's), the three Beacon pillars on the W, N and E sides
	"atrium": [
		["kit_scaffold", 0.06, 0.07, 0.0, 1.0], ["kit_scaffold", 0.94, 0.08, 90.0, 1.0], ["kit_ladder", 0.16, 0.13, 30.0, 0.85],
		["kit_fountain", 0.5, 0.5, 0.0, 1.0],
		["row", 0.22, 0.05, 0.42, 0.05, {"n": 3, "plinth": true, "yaw": 0.0}],
		["row", 0.58, 0.05, 0.82, 0.05, {"n": 3, "plinth": true, "yaw": 0.0}],
		["row", 0.95, 0.22, 0.95, 0.4, {"n": 2, "plinth": true, "yaw": -90.0}],
		["row", 0.95, 0.6, 0.95, 0.85, {"n": 3, "plinth": true, "yaw": -90.0}],
		["row", 0.3, 0.16, 0.42, 0.16, {"n": 2, "yaw": 20.0, "scale": 0.9, "small": true}],
		["row", 0.82, 0.25, 0.84, 0.4, {"n": 2, "yaw": -70.0, "scale": 0.9, "small": true}],
		["kit_face1", 0.15, 0.92, 200.0, 0.9, {"small": true}], ["kit_face4", 0.3, 0.95, 160.0, 0.9, {"small": true, "tilt": -90.0}],
		["kit_face6", 0.72, 0.94, 190.0, 0.9, {"small": true}], ["kit_face3", 0.86, 0.95, 230.0, 0.9, {"small": true, "tilt": 90.0}],
		["statue_veiled_unfinished", 0.86, 0.16, -45.0, 0.9]],      # (no Beacon pillars: the Beacons are the wings', V2_MAP)
	# ---------------------------------------------------------------- ACT 2, W wing (glass, cold: "w_glass")
	# glass everywhere: tall framed panes on the back walls, cold columns, a praying figure
	"stair_breath": [
		# (W1, 3.4 x 14.2 m, the stairs: only the flat landings take pieces; the route keeps the west 2/3, so the east strip)
		["column_doric", 0.88, 0.03, 0.0, 0.75], ["mirror_frame", 0.9, 0.22, -90.0, 0.85, {"glass": true}],
		["statue_veiled_praying", 0.9, 0.45, -90.0, 0.8], ["column_stump", 0.9, 0.7, 0.0, 0.75],
		["rubble_pile", 0.9, 0.9, 0.0, 0.3, {"small": true}]],
	"hall_glass": [
		# (phase 3: the Hall's floor is all puzzle (kept): no pieces; its identity is W's great mirror and its panes)
		["mist", 0.5, 0.5, 0.0, 0.0, {"skip": true}]],
	"shadow_chamber": [
		# (phase 3: the Chamber's floor is all puzzle (kept): nothing stands in it)
		["mist", 0.5, 0.5, 0.0, 0.0, {"skip": true}]],
	"hidden_way": [
		# (the Ash Landing IBW, 5 x 3.6 m, beside W6's mouth: the east strip and the north edge)
		["archway_ruined", 0.92, 0.45, -90.0, 0.6], ["mirror_frame", 0.15, 0.06, 0.0, 0.75, {"glass": true}],
		["rubble_pile", 0.92, 0.9, 0.0, 0.3, {"small": true}], ["kit_dead_plant", 0.35, 0.06, 0.0, 0.8, {"small": true}]],
	"colossus": [
		# (WB, the Glass Beacon rock beside the Observer's face, 3 x 6 m: its free west and east strips; the head is W's)
		["column_stump", 0.1, 0.12, 0.0, 0.7], ["rubble_pile", 0.1, 0.5, 0.0, 0.3, {"small": true}],
		["pediment_fragment", 0.1, 0.85, 90.0, 0.5, {"small": true}], ["rubble_pile", 0.92, 0.75, 0.0, 0.25, {"small": true}]],
	# ---------------------------------------------------------------- ACT 2, N wing (garden mist: "n_garden")
	# overgrown: columns and stumps, dead shrubs, low drifting mist, petals
	"colonnade": [
		# (N1 is a ramp: columns only where the floor is flat; edge strips beside the route)
		["column_doric", 0.12, 0.05, 0.0, 0.9], ["column_doric", 0.88, 0.05, 0.0, 0.9],
		["column_doric", 0.12, 0.35, 0.0, 0.9], ["column_stump", 0.88, 0.35, 0.0, 0.9],
		["column_doric", 0.12, 0.65, 0.0, 0.9], ["column_doric", 0.88, 0.65, 0.0, 0.9],
		["column_stump", 0.12, 0.92, 0.0, 0.9], ["column_doric", 0.88, 0.92, 0.0, 0.9],
		["mist", 0.5, 0.5, 0.0, 1.6], ["petals", 0.5, 0.5, 0.0, 0.5]],
	"turned_ones": [
		# (phase 3, N2 6.7 x 10 m: the puzzle floor is kept whole; the free ground is the south-west corner: low pieces,
		# and the N.3 votive moved here from its own (all-kept) nook)
		["kit_votive", 0.2, 0.58, 0.0, 1.0], ["flame", 0.13, 0.58, 0.0, 0.1, {"y": 0.5, "on": true}], ["flame", 0.27, 0.58, 0.0, 0.1, {"y": 0.5, "on": true}],
		["kit_dead_plant", 0.42, 0.62, 0.0, 0.9, {"small": true}], ["kit_urns", 0.1, 0.9, 20.0, 0.8, {"small": true}],
		["column_fallen", 0.3, 0.96, 80.0, 0.45, {"small": true}], ["rubble_pile", 0.45, 0.9, 0.0, 0.3, {"small": true}],
		["mist", 0.5, 0.6, 0.0, 1.8], ["petals", 0.5, 0.5, 0.0, 0.6]],
	"votive": [
		# (phase 3: N3 is all kept; the votive stands in N2's free corner, see turned_ones)
		["petals", 0.5, 0.5, 0.0, 0.4]],
	"tree_shards": [
		# (N6, the 3.8 x 2 m nook: its free east strip)
		["kit_dead_plant", 0.9, 0.2, 0.0, 0.9], ["statue_veiled_bust", 0.9, 0.75, -90.0, 0.7],
		["petals", 0.5, 0.5, 0.0, 0.4]],
	"mist_maze": [
		# (phase 3: the maze floor is all puzzle: mist and petals only, nothing solid)
		["mist", 0.35, 0.4, 0.0, 2.6], ["mist", 0.7, 0.7, 0.0, 2.2], ["petals", 0.5, 0.5, 0.0, 0.6]],
	# ---------------------------------------------------------------- ACT 2, E wing (high, windy: "e_high")
	# open to the sky: balustrades on the drop side, posts streaming torn veils, the bells
	"balcony": [
		# (phase 3, E1 4 x 22 m: the route keeps the middle; the west strip takes the pieces, tall ones at its north end)
		["kit_awning_post", 0.12, 0.06, 90.0, 1.0], ["veils", 0.12, 0.06, 90.0, 1.0, {"on": true}],
		["kit_awning_post", 0.12, 0.3, 90.0, 1.0], ["veils", 0.12, 0.3, 90.0, 1.0, {"on": true}],
		["kit_urns", 0.12, 0.5, 90.0, 0.8, {"small": true}], ["box", 0.12, 0.65, 90.0, 1.0, {"size": Vector3(1.6, 0.45, 0.5), "mat": 0.25}],
		["kit_dead_plant", 0.12, 0.85, 0.0, 0.9, {"small": true}], ["kit_urns", 0.12, 0.96, 60.0, 0.7, {"small": true}],
		["rubble_pile", 0.84, 0.4, 0.0, 0.2, {"small": true}]],
	"singing_stones": [
		# (phase 3, E2 8 x 6 m: the stones' row is kept; the bells stand in the free south-east corner, low pieces west)
		["kit_windbells", 0.82, 0.82, 0.0, 1.0], ["kit_awning_post", 0.09, 0.12, 90.0, 0.9], ["veils", 0.09, 0.12, 90.0, 0.9, {"on": true}],
		["kit_urns", 0.09, 0.32, 0.0, 0.8, {"small": true}], ["rubble_pile", 0.09, 0.6, 0.0, 0.3, {"small": true}],
		["kit_dead_plant", 0.09, 0.85, 0.0, 0.8, {"small": true}]],
	"mirror_walk": [
		["mirror_frame", 0.2, 0.05, 0.0, 1.0, {"glass": true}], ["mirror_frame", 0.5, 0.05, 0.0, 1.0, {"glass": true}],
		["mirror_frame", 0.8, 0.05, 0.0, 1.0, {"glass": true}],
		["balustrade", 0.3, 0.97, 0.0, 1.0], ["balustrade", 0.7, 0.97, 0.0, 1.0],
		["kit_awning_post", 0.96, 0.4, 90.0, 0.9], ["veils", 0.96, 0.4, 90.0, 0.9, {"on": true}]],
	"spring": [
		# (E4, 2 x 2.7 m: the strips north and south of the route)
		["kit_urns", 0.5, 0.08, 0.0, 0.55, {"small": true}], ["kit_dead_plant", 0.5, 0.94, 0.0, 0.6, {"small": true}]],
	"scales": [
		# (phase 3: the Scales' floor is all puzzle: nothing stands in it)
		["mist", 0.5, 0.5, 0.0, 0.0, {"skip": true}]],
	# ---------------------------------------------------------------- ACT 3 (the convergence, dusk: "act3")
	"pool_halves": [
		# (phase 4, P x -12.75..-4, z 15..22 with W3's rims: the rims' middle 1.2 m is where you turn stones 3 and 4, kept
		# clear; only the north rim's back strip (0.4 m) takes low pieces, nothing tall anywhere: the fog is its identity)
		["keep", 0.0, 0.057, 1.0, 0.229], ["keep", 0.0, 0.821, 1.0, 1.0], ["keep", 0.0, 0.229, 1.0, 0.821],
		["rubble_pile", 0.47, 0.025, 0.0, 0.22, {"small": true}], ["column_stump", 0.62, 0.03, 0.0, 0.5],
		["kit_urns", 0.8, 0.03, 30.0, 0.5, {"small": true}], ["kit_dead_plant", 0.95, 0.03, 0.0, 0.6, {"small": true}]],
	"bridge": [
		["kit_bridge_end", 0.5, 0.05, 0.0, 1.0], ["rubble_pile", 0.9, 0.3, 0.0, 0.4, {"small": true}],
		["column_fallen", 0.15, 0.82, 60.0, 0.5, {"small": true}], ["column_stump", 0.1, 0.12, 0.0, 0.8]],
	"gate_four": [
		["gate_veiled", 0.5, 0.05, 0.0, 1.0], ["pylon_ashlar", 0.08, 0.05, 0.0, 1.0], ["pylon_ashlar", 0.92, 0.05, 0.0, 1.0],
		["statue_veiled_unfinished", 0.95, 0.45, -90.0, 0.95], ["flame", 0.25, 0.08, 0.0, 0.3, {"y": 0.0}],
		["flame", 0.75, 0.08, 0.0, 0.3, {"y": 0.0}], ["rubble_pile", 0.06, 0.85, 0.0, 0.35, {"small": true}]],
	"shrine": [
		["column_doric", 0.12, 0.08, 0.0, 0.9], ["column_doric", 0.88, 0.08, 0.0, 0.9], ["column_stump", 0.94, 0.5, 0.0, 0.9],
		["altar_shrine", 0.5, 0.06, 0.0, 0.7], ["statue_veiled_praying", 0.06, 0.45, 90.0, 0.85],
		["pediment_fragment", 0.08, 0.8, 60.0, 0.6, {"small": true}], ["petals", 0.5, 0.5, 0.0, 0.7]],
	# ---------------------------------------------------------------- PROLOGUE (Dress.prologue_set builds the water + head)
	"prologue": [
		["column_stump", 0.1, 0.2, 0.0, 0.8], ["pediment_fragment", 0.85, 0.15, 20.0, 0.7]],
}

# ================================================================================================================ build
static func build(lv: Level, parent: Node, id: String, rect: Rect2, floor_y: float, keep: Array = [], seed := 0) -> Dress:
	var d := Dress.new()
	d.name = "Dress_" + id
	d.level = lv
	d._rect = rect
	d._y = floor_y
	d._keep = keep.duplicate()          # (a recipe may add its own kept rects)
	parent.add_child(d)
	if not RECIPES.has(id):
		push_warning("Dress: no recipe " + id)
		return d
	for e in RECIPES[id]: d._place(e)
	d._commit()
	return d

## the walk-region height under a point (ramps, terraces), else the landmark's floor
func _floor_at(p: Vector2) -> float:
	var g = level.region_at(p) if level else null
	return (g as Level.Region).height(p) if g else _y

func _world(u: float, v: float) -> Vector3:
	return Vector3(_rect.position.x + u * _rect.size.x, _y, _rect.position.y + v * _rect.size.y)

func _yaw(e: Array) -> float:
	return deg_to_rad(-45.0 if str(e[3]) == "cam" else float(e[3]))

func _place(e: Array) -> void:
	var what: String = e[0]
	var at := _world(float(e[1]), float(e[2]))
	var yaw := _yaw(e)
	var sc: float = float(e[4])
	var o: Dictionary = e[5] if e.size() > 5 else {}
	if o.get("skip", false): return                     # (a recipe kept for its id, with nothing in it)
	if o.get("on", false) and what in ["flame", "veils"]:
		if not _last_ok: return                     # (its base was left out)
		at += _last_shift                           # (on its base, wherever the base ended up)
	elif what in ["flame", "veils", "mist"]: at.y = _floor_at(Vector2(at.x, at.z))
	at.y += float(o.get("y", 0.0))
	match what:
		"keep":                                 # a kept rect of the landmark (u0, v0, u1, v1): nothing is placed in it
			var a0 := _world(float(e[1]), float(e[2])); var a1 := _world(float(e[3]), float(e[4]))
			_keep.append(Rect2(Vector2(a0.x, a0.z), Vector2(a1.x - a0.x, a1.z - a0.z)))
			return
		"row":                                  # a row of his faces from (u, v) to (e[3], e[4]), on plinths or on the floor
			var n: int = o.get("n", 3)
			for k in n:
				var t := (float(k) + 0.5) / n
				var uu := lerpf(float(e[1]), float(e[3]), t)
				var vv := lerpf(float(e[2]), float(e[4]), t)
				var face := "kit_face%d" % (1 + (int(uu * 37.0 + vv * 53.0) + k) % 6)
				var fy: float = o.get("yaw", 0.0) + (k % 3 - 1) * 12.0
				var fs: float = o.get("scale", 1.0)
				if o.get("plinth", false):
					_place(["plinth", uu, vv, fy, 1.0])
					if _last_ok: _place([face, uu, vv, fy, fs, {"y": 0.9, "on": true}])
				else:
					_place([face, uu, vv, fy, fs, {"small": o.get("small", false)}])
			return
		"flame":
			if not o.get("on", false):
				var q := Vector2(at.x, at.z)
				for k in _keep:
					if (k as Rect2).grow(0.2).has_point(q): skipped.append([what, "on a kept path"]); return
				if level.blocked(q, 0.15): skipped.append([what, "hits a wall / obstacle"]); return
			var f := Flame.new(0.0, sc, Palette.FIRE_LIGHT, level.noise_tex if "noise_tex" in level else null)
			add_child(f)
			f.global_position = at
			f.mat.set_shader_parameter("intensity", 1.0)
			flames.append(f)
			return
		"beacon":
			_add_mesh("pillar", _prim_cyl(0.42, 1.2, 0.25), Transform3D(Basis(), at + Vector3(0, 0.6, 0)), 0.45, false, o)
			if _last_ok:
				var bowl := _asset("brazier")
				if not bowl.is_empty():
					_parts["main"].append([bowl[0], Transform3D(Basis.from_scale(Vector3.ONE * 0.75), at + Vector3(0, 1.2, 0))])
				var bf := BeaconFire.new()
				add_child(bf)
				bf.position = to_local(at + Vector3(0, 1.2 + 0.55, 0))
				beacons.append(bf)
			return
		"veils":
			if not high: return
			var v := AmbientLife.veils(at + Vector3(0, 2.45 * sc, 0), 2, 1.3 * sc, Vector3(0.7, 0, 0.7), null, _y, 0.9, yaw)
			add_child(v); extras.append(v)
			return
		"mist":
			var m := FxBurst.mist(self, at, sc)
			extras.append(m)
			return
		"petals":
			var p := AmbientLife.petals(AABB(Vector3(_rect.position.x, _y, _rect.position.y), Vector3(_rect.size.x, 2.5, _rect.size.y)), int(40 * sc))
			add_child(p); extras.append(p)
			return
		"box":
			var size: Vector3 = o.get("size", Vector3.ONE)
			_add_mesh("box", _prim_box(size, float(o.get("mat", 0.25))), Transform3D(Basis(Vector3.UP, yaw), at + Vector3(0, size.y * 0.5, 0)),
				minf(size.x, size.z) * 0.5, false, o, size)
			return
		"plinth":
			_add_mesh("plinth", _prim_box(Vector3(0.62, 0.9, 0.62), 0.25), Transform3D(Basis(Vector3.UP, yaw), at + Vector3(0, 0.45, 0)), 0.33, false, o)
			return
	var a := _asset(what)
	if a.is_empty() and FALLBACK.has(what):
		a = _asset(FALLBACK[what][0]); sc *= float(FALLBACK[what][1])
	if a.is_empty():
		skipped.append([what, "missing"])
		return
	var tilt := deg_to_rad(float(o.get("tilt", 0.0)))
	var b := Basis(Vector3.UP, yaw) * Basis(Vector3.BACK, tilt) * Basis.from_scale(Vector3.ONE * sc)
	var bb: AABB = a[1]
	var lift := 0.0
	if absf(tilt) > 0.01:                       # (a toppled piece rests on its side)
		lift = -(Transform3D(Basis(Vector3.BACK, tilt) * Basis.from_scale(Vector3.ONE * sc)) * bb).position.y
	var xf := Transform3D(b, at + Vector3(0, lift, 0))
	_add_mesh(what, a[0], xf, 0.0, true, o, Vector3.ZERO, bb)
	if _last_ok and o.get("glass", false):
		# a pane of the game's glass in the frame (glass.gdshader: faint tint, a sheen, frame lines)
		var pane := Transform3D(_xf_last.basis, _xf_last * Vector3(bb.get_center().x, bb.position.y + bb.size.y * 0.5, bb.get_center().z))
		_panes.append([pane, Vector2(bb.size.x * 0.7, bb.size.y * 0.84)])

var _last_ok := false
var _last_shift := Vector3.ZERO
var _boxes: Array[AABB] = []
static var _shared := {}              # level id -> every Dress piece's box (landmarks may share ground: N2 holds N3)
var _xf_last := Transform3D()
var _panes: Array = []              # [Transform3D, size]: glass panes in mirror frames
## test a piece's footprint, then queue it (main / occ / small) with its obstacle, occluder and contact shadow
func _add_mesh(what: String, mesh: ArrayMesh, xf: Transform3D, rad: float, from_asset: bool, o: Dictionary, size := Vector3.ZERO, bb := AABB()) -> void:
	_last_ok = false
	if bb.size == Vector3.ZERO: bb = mesh.get_aabb()
	var on: bool = o.get("on", false)
	var wb: AABB
	if on:
		xf.origin += _last_shift                    # (rides on its base, wherever the base ended up)
		wb = xf * bb
	else:
		# the spot the recipe asks for; if it is taken (a path, a wall, another piece), the nearest free spot within
		# SEARCH m that keeps the piece's place in the view (a tall piece stays in the back: north / east part)
		var want := xf.origin
		var why := ""
		var why0 := ""
		var found := false
		for off in _offsets():
			var t := xf
			t.origin = want + Vector3(off.x, 0.0, off.y)
			why = _fits(what, t, bb)
			if why == "":
				xf = t; found = true; break
			if off == Vector2.ZERO: why0 = why
		if not found:
			skipped.append([what, why0 + " (no free spot within %.0f m)" % SEARCH]); return
		var h := _floor_at(Rect2((xf * bb).position.x, (xf * bb).position.z, (xf * bb).size.x, (xf * bb).size.z).get_center())
		xf.origin.y += h - _y
		_last_shift = xf.origin - want
		wb = xf * bb
		for c in _footprint(xf, bb): level.ob_circle(Vector2(c.x, c.y), c.z, "dress:" + what)
	_last_ok = true
	_xf_last = xf
	if not on:
		_boxes.append(wb)
		if not _shared.has(level.get_instance_id()): _shared[level.get_instance_id()] = []
		_shared[level.get_instance_id()].append(wb)
	var tall := wb.size.y > TALL
	var small: bool = o.get("small", false)
	# (v2.0, the marble per-instance budget: small dressing merges into the main mesh too: one marble mesh per landmark)
	var slot := "occ" if tall else "main"
	_parts[slot].append([mesh, xf])
	if tall: level.occluders.append(wb)
	if not on:
		var c := wb.get_center()
		var yaw := xf.basis.get_euler().y
		_blobs.append(Transform3D(Basis(Vector3.UP, yaw) * Basis.from_scale(Vector3(maxf(bb.size.x, 0.3) * xf.basis.get_scale().x * 1.15, 1.0,
			maxf(bb.size.z, 0.3) * xf.basis.get_scale().z * 1.15)), Vector3(c.x, wb.position.y + 0.012, c.z)))

const SEARCH := 2.0
static var _offs: Array[Vector2] = []
## candidate shifts, nearest first (0 first), on a 25 cm grid out to SEARCH
static func _offsets() -> Array[Vector2]:
	if _offs.is_empty():
		var n := int(SEARCH / 0.25)
		for gx in range(-n, n + 1):
			for gz in range(-n, n + 1):
				var v := Vector2(gx, gz) * 0.25
				if v.length() <= SEARCH + 0.001: _offs.append(v)
		_offs.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.length() < b.length())
	return _offs

## "" if the piece fits at xf (and lifts it to the floor under it), else why not
func _fits(what: String, xf: Transform3D, bb: AABB) -> String:
	var wb: AABB = xf * bb
	var fr := Rect2(wb.position.x, wb.position.z, wb.size.x, wb.size.z)
	if not _rect.grow(0.05).encloses(fr): return "outside the landmark"
	# a tall piece only in the back of the view: the north 45% or the east 45% of the landmark
	if wb.size.y > TALL:
		var c := fr.get_center()
		var u := (c.x - _rect.position.x) / maxf(_rect.size.x, 0.01)
		var v := (c.y - _rect.position.y) / maxf(_rect.size.y, 0.01)
		if v > 0.45 and u < 0.55: return "tall, would stand in front"
	for k in _keep:
		if (k as Rect2).grow(0.12).intersects(fr): return "on a kept path"
	# the floor under it (ramps, stairs, terraces): never tilted, so not over more than 3 cm of height
	var c2 := fr.get_center()
	var h := _floor_at(c2)
	var ins := fr.grow(-0.06)
	var ins2 := fr.grow(-minf(0.18, minf(fr.size.x, fr.size.y) * 0.3))      # (its solid body, not its overhangs)
	for q in [ins2.position, Vector2(ins2.end.x, ins2.position.y), ins2.end, Vector2(ins2.position.x, ins2.end.y)]:
		if level.region_at(q) == null: return "not on solid floor"         # (v2.0: it stands on a floor all round)
	for q in [ins.position, Vector2(ins.end.x, ins.position.y), ins.end, Vector2(ins.position.x, ins.end.y), c2]:
		var g = level.region_at(q)
		if g == null: continue
		if absf((g as Level.Region).height(q) - h) > 0.03: return "on a slope / stairs"
		if not is_nan(Map2.water_y_at(q)) and Map2.water_y_at(q) >= h - 0.3: return "in the water"   # (stones in water are not a floor for a column)
	var lifted := wb
	lifted.position.y += h - _y
	for ob: AABB in _shared.get(level.get_instance_id(), []):
		var ix := ob.intersection(lifted)
		if ix.size.x > 0.02 and ix.size.y > 0.02 and ix.size.z > 0.02: return "would touch another piece"
	for c in _footprint(xf, bb):
		if level.blocked(Vector2(c.x, c.y), c.z * 1.08): return "hits a wall / obstacle"     # (a hand's breadth clear of walls)
	# it must not hide the way: no point of a kept path (the route) behind it from the camera
	if lifted.size.y > 0.6 and _hides_route(lifted): return "would hide the route"
	return ""

const CAM_BACK := Vector3(-0.572, 0.588, 0.572)
## a route point (the kept paths' centre lines, every 0.5 m, at her height) whose line to the camera crosses the box
func _hides_route(box: AABB) -> bool:
	var back := CAM_BACK.normalized()
	var grown := box.grow(0.05)
	for k in _keep:
		var r := k as Rect2
		# only paths that can lie behind it (north / east of its front, within ~10 m)
		if r.end.y < box.position.z - 10.0 or r.position.y > box.end.z + 0.5 or r.end.x < box.position.x - 0.5 or r.position.x > box.end.x + 10.0: continue
		var c := r.get_center()
		var along_x := r.size.x >= r.size.y
		var L := r.size.x if along_x else r.size.y
		var n := maxi(1, int(L / 0.5))
		for i in n + 1:
			var t := float(i) / n
			var q := Vector2(lerpf(r.position.x + 0.4, r.end.x - 0.4, t), c.y) if along_x else Vector2(c.x, lerpf(r.position.y + 0.4, r.end.y - 0.4, t))
			for lift in [0.25, 1.0]:
				var p := Vector3(q.x, _floor_at(q) + lift, q.y)
				if _ray_box(p, back, grown): return true
	# nor anything she can use (the interact points: tablets, levers, the lamp)
	for it in level.interacts:
		var ip: Vector3 = (it as Level.Interact).pos
		if ip.z < box.position.z - 10.0 or ip.z > box.end.z + 0.5 or ip.x < box.position.x - 0.5 or ip.x > box.end.x + 10.0: continue
		for lift in [0.0, 0.5]:
			if _ray_box(ip + Vector3(0, lift, 0) + back * 0.3, back, grown): return true
	return false

static func _ray_box(o: Vector3, d: Vector3, b: AABB) -> bool:
	var t0 := 0.0
	var t1 := 60.0
	for a in 3:
		if absf(d[a]) < 1e-6:
			if o[a] < b.position[a] or o[a] > b.end[a]: return false
		else:
			var ta := (b.position[a] - o[a]) / d[a]
			var tb := (b.end[a] - o[a]) / d[a]
			t0 = maxf(t0, minf(ta, tb)); t1 = minf(t1, maxf(ta, tb))
			if t0 > t1: return false
	return true

## round pieces: one circle; long turned ones: a chain (as Props does)
func _footprint(xf: Transform3D, bb: AABB) -> Array:
	var foot := Transform3D(xf.basis * Basis.from_scale(Vector3(bb.size.x, 1.0, bb.size.z)), xf * Vector3(bb.get_center().x, 0.0, bb.get_center().z))
	var chain := Level._turned_footprint(foot)
	if not chain.is_empty(): return chain
	var s := xf.basis.get_scale()
	var hx := bb.size.x * s.x * 0.5
	var hz := bb.size.z * s.z * 0.5
	var c := xf * bb.get_center()
	if maxf(hx, hz) > minf(hx, hz) * 1.6:          # a long piece square to the axes: circles along it
		var out := []
		var along_x := hx > hz
		var L := hx if along_x else hz
		var w := minf(hx, hz)
		var n := clampi(ceili(L / maxf(w, 0.1)), 1, 12)
		for i in n:
			var t := ((float(i) + 0.5) / n * 2.0 - 1.0) * (L - w)
			out.append(Vector3(c.x + (t if along_x else 0.0), c.z + (0.0 if along_x else t), w * 1.05))
		return out
	return [Vector3(c.x, c.z, maxf(hx, hz) * 0.95)]

# ================================================================================================================ meshes
func _asset(what: String) -> Array:
	if _cache.has(what): return _cache[what]
	var path: String = PATHS.get(what, PROPS + what + ".glb")
	if not ResourceLoader.exists(path):
		_cache[what] = []
		return []
	# props share Props' baked mesh (same vertex colours); the rest are baked here the same way
	if not PATHS.has(what) and not what.begins_with("kit_workbench") and not what.begins_with("kit_cot") \
			and not what.begins_with("kit_windbells") and not what.begins_with("kit_votive"):
		var pm := Props._mesh(what)
		if not pm.is_empty():
			var one := _flatten(pm[0])
			_cache[what] = [one, pm[1]]
			return _cache[what]
	var ps := load(path) as PackedScene
	var root := ps.instantiate()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = what.hash()
	var mat_id: float = MAT.get(what, 0.25)
	for mi: MeshInstance3D in root.find_children("*", "MeshInstance3D", true, false):
		var xf := Transform3D()
		var node: Node = mi
		while node != root and node is Node3D:
			xf = (node as Node3D).transform * xf
			node = node.get_parent()
		for s in mi.mesh.get_surface_count():
			var a := mi.mesh.surface_get_arrays(s)
			var cols := PackedColorArray()
			cols.resize((a[Mesh.ARRAY_VERTEX] as PackedVector3Array).size())
			cols.fill(Color(rng.randf(), mat_id, 0.0, 0.0))
			a[Mesh.ARRAY_COLOR] = cols
			var am := ArrayMesh.new()
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a)
			st.append_from(am, 0, xf)
	root.free()
	var m := st.commit()
	_cache[what] = [m, m.get_aabb()]
	return _cache[what]

## a baked props mesh may carry an "occ" surface: one surface for merging (the see-through is chosen per piece here)
static func _flatten(m: ArrayMesh) -> ArrayMesh:
	if m.get_surface_count() == 1: return m
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for s in m.get_surface_count(): st.append_from(m, s, Transform3D())
	return st.commit()

static func _prim_box(size: Vector3, mat: float) -> ArrayMesh:
	var bm := BoxMesh.new(); bm.size = size
	return AmbientLife._tinted(bm, mat)

static func _prim_cyl(r: float, h: float, mat: float) -> ArrayMesh:
	var key := "cyl%.2f_%.2f_%.2f" % [r, h, mat]
	if _cache.has(key): return _cache[key]
	var cm := CylinderMesh.new(); cm.top_radius = r * 0.92; cm.bottom_radius = r; cm.height = h; cm.radial_segments = 16
	_cache[key] = AmbientLife._tinted(cm, mat)
	return _cache[key]

## merge the queued pieces: one mesh per slot (the see-through slot's vertices carry b = 1, so they fade)
func _commit() -> void:
	for slot in ["main", "occ", "small"]:
		var list: Array = _parts[slot]
		if list.is_empty(): continue
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for pr in list: st.append_from(pr[0], 0, pr[1])
		var m := st.commit()
		if slot == "occ":
			var a := m.surface_get_arrays(0)
			var cols: PackedColorArray = a[Mesh.ARRAY_COLOR]
			for i in cols.size(): cols[i].b = 1.0
			a[Mesh.ARRAY_COLOR] = cols
			m = ArrayMesh.new()
			m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a)
		var mi := MeshInstance3D.new()
		mi.name = "Dress_" + slot
		mi.mesh = m
		mi.material_override = level.marble_occ_mat if slot == "occ" else level.marble_mat
		mi.layers = PlanarMirror.LAYER_MAIN_FX
		add_child(mi)
		if slot == "small":
			_small_mi = mi
			mi.visible = high
	if not _panes.is_empty():
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var size := Vector2.ZERO
		for pn in _panes:
			var q := QuadMesh.new(); q.size = pn[1]; size = pn[1]
			st.append_from(q, 0, pn[0])
		var gm := ShaderMaterial.new()
		gm.shader = preload("res://shaders/glass.gdshader")
		gm.set_shader_parameter("size", size)
		gm.set_shader_parameter("base_alpha", 0.5)
		var gmi := MeshInstance3D.new()
		gmi.name = "Dress_glass"
		gmi.mesh = st.commit()
		gmi.material_override = gm
		gmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		gmi.layers = PlanarMirror.LAYER_MAIN_FX
		add_child(gmi)
	if not _blobs.is_empty():
		var pm := PlaneMesh.new()
		pm.size = Vector2.ONE
		var bm := ShaderMaterial.new()
		bm.shader = preload("res://shaders/blob.gdshader")
		bm.set_shader_parameter("strength", 0.45)
		pm.material = bm
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = pm
		mm.instance_count = _blobs.size()
		for i in _blobs.size(): mm.set_instance_transform(i, _blobs[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mmi.layers = PlanarMirror.LAYER_MAIN_FX
		add_child(mmi)
	add_to_group("q_dress")

## World.set_tier: the small dressing and the mist / veils go on Low
static func apply_tier(tree: SceneTree, is_high: bool) -> void:
	high = is_high
	for d in tree.get_nodes_in_group("q_dress"):
		var dd := d as Dress
		if dd._small_mi: dd._small_mi.visible = is_high

# =========================================================================================================== prologue set
## The prologue's black-water threshold (§5 shots 1-2): a marble lip at `lip` (the floor she lies on, its edge facing
## north), black still water beyond it to the north, and the Observer's giant veiled head half sunk in the water and the
## fog far out (`head_at`, its face turned away: we see the back of the veil). Returns the root; `water_mat` is the
## water's material (OmenFx.murk works on it). Pair with world.set_mood("prologue").
var water_mat: ShaderMaterial
static func prologue_set(lv: Level, parent: Node, lip: Vector3, head_at: Vector3, head_h := 9.0) -> Dress:
	var d := Dress.new()
	d.name = "PrologueSet"
	d.level = lv
	parent.add_child(d)
	# the black water: a wide still sheet, the game's water shader made dark and glassy
	var wm := ShaderMaterial.new()
	wm.shader = preload("res://shaders/water.gdshader")
	if "noise_tex" in lv: wm.set_shader_parameter("noise_tex", lv.noise_tex)
	wm.set_shader_parameter("murk", 0.0)
	for kv in [["deep", Color(0.02, 0.022, 0.03)], ["shallow", Color(0.06, 0.065, 0.075)], ["sky", Color(0.16, 0.17, 0.2)],
			["foam_k", 0.0], ["ripple_k", 0.25], ["shore", 0.0]]:
		wm.set_shader_parameter(kv[0], kv[1])
	d.water_mat = wm
	var w := MeshInstance3D.new()
	var pm := PlaneMesh.new(); pm.size = Vector2(60, 60)
	w.mesh = pm
	w.material_override = wm
	w.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	d.add_child(w)
	w.global_position = Vector3(lip.x, lip.y - 0.35, lip.z - 28.0)
	# the marble lip: two long worn slabs stepping down into the water
	d._parts["main"].append([_prim_box(Vector3(7.0, 0.5, 2.2), 0.0), Transform3D(Basis(), lip + Vector3(0, -0.25, 0.6))])
	d._parts["main"].append([_prim_box(Vector3(6.2, 0.3, 0.9), 0.25), Transform3D(Basis(), lip + Vector3(0, -0.5, -0.9))])
	# the head: the veiled colossus, sunk to below its brow line, the back of its veil toward us
	var hd := d._asset("colossus_head_veiled")
	if not hd.is_empty():
		var bb: AABB = hd[1]
		var s := head_h / maxf(bb.size.y, 0.01)
		var hx := Transform3D(Basis(Vector3.UP, PI * 0.8) * Basis.from_scale(Vector3.ONE * s), head_at + Vector3(0, -head_h * 0.42, 0))
		d._parts["occ"].append([hd[0], hx])
	d._rect = Rect2(lip.x - 3.5, lip.z - 0.5, 7.0, 2.2)
	d._y = lip.y
	for e in RECIPES["prologue"]: d._place(e)
	d._commit()
	return d

# ======================================================================================================== the Observer
## The Observer (EIDOLON_SCRIPT §5 shot 1, W.7): the giant VEILED head sunk in the inlet, seen from behind in the
## prologue. Wet veil-cloth (observer_veil.gdshader: pale where lit, deep in the folds, soaked dark toward the water)
## and a crimson rim from behind through the fog (observer_rim.gdshader, a second pass). `at` = the point on the water
## under the head's centre, `yaw` (deg) turns its FACE (0: face to +Z, i.e. the back of the veil toward -Z), `height`
## the whole head and neck (m), `sink` how much of it is under the water. One MeshInstance (2 passes), not marble.
##   var obs := Dress.observer(parent, Map2.O + Map2.OBSERVER, yaw_deg, 11.0, water_y)
static func observer(parent: Node, at: Vector3, yaw := 0.0, height := 11.0, water_y := 0.0, sink := 0.38) -> MeshInstance3D:
	var name := "observer_veiled" if ResourceLoader.exists(PROPS + "observer_veiled.glb") else "colossus_head_veiled"
	var pm := Props._mesh(name)
	if pm.is_empty(): return null
	var mesh: ArrayMesh = _flatten(pm[0])
	var bb: AABB = pm[1]
	var s := height / maxf(bb.size.y, 0.01)
	var b := Basis(Vector3.UP, deg_to_rad(yaw)) * Basis.from_scale(Vector3.ONE * s)
	var c := bb.get_center()
	var o := Vector3(at.x, water_y - height * sink, at.z) - b * Vector3(c.x, bb.position.y, c.z)
	var mi := MeshInstance3D.new()
	mi.name = "Observer"
	mi.mesh = mesh
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/observer_veil.gdshader")
	m.set_shader_parameter("water_y", water_y)
	var r := ShaderMaterial.new()
	r.shader = preload("res://shaders/observer_rim.gdshader")
	r.set_shader_parameter("water_y", water_y)
	r.set_shader_parameter("push", 0.012 / s)
	m.next_pass = r
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.transform = Transform3D(b, o)
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	parent.add_child(mi)
	return mi

## The final image of the First Shrine's cinematic (the "beyond"): far out over the sea, a colossal VEILED figure rising out
## of the cloud, its veil's folds caught by the light, a crimson rim along its silhouette that carries through the fog.
## The same veiled Tripo figure as the Observer, standing (sunk only to the knees in the cloud). `at` = its foot on the
## cloud line, `yaw` (deg) turns its face (0: toward +Z), `height` its full height (m).
##   Dress.beyond_colossus(level.beyond, at, 24.0, -150.0)      (in Level._beyond, in place of the primitive statue)
static func beyond_colossus(parent: Node, at: Vector3, height := 24.0, yaw := 0.0) -> MeshInstance3D:
	var mi := observer(parent, at, yaw, height, at.y, 0.18)
	if mi == null: return null
	mi.name = "BeyondColossus"
	var m := mi.material_override as ShaderMaterial
	m.set_shader_parameter("cloth", Color(0.74, 0.75, 0.78))         # (paler: far off, in the light)
	m.set_shader_parameter("wet", Color(0.5, 0.52, 0.56))
	var r := m.next_pass as ShaderMaterial
	r.set_shader_parameter("k", 1.0)
	r.set_shader_parameter("push", 0.02 / maxf(mi.transform.basis.get_scale().x, 0.001))
	mi.extra_cull_margin = 4.0
	return mi
