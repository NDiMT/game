class_name Dress
extends Node3D
## v2.0 (Agent A) LANDMARK SET DRESSING for the new Chapter I (EIDOLON_SCRIPT §5, §6). One call per landmark: W gives the
## landmark's floor rectangle (world x/z) and its floor height; the recipe fills it with the kit (props, kit_*, a few
## primitives) so each space has its own silhouette at the fixed camera:
##   var d := Dress.build(level, self, "atrium", Rect2(x0, z0, w, d), floor_y, [path_rect, ...])
##   d.beacons      (Atrium / wing beacons) the BeaconFire nodes it made, W, N, E order: light them with ignite()
##   d.skipped      pieces it left out (they would have hit a wall, an obstacle or a kept-clear path), for the log
## Rules it keeps by itself:
##  * the camera looks from the south-west: tall pieces only stand on a landmark's NORTH and EAST edges (the back of
##    the view); the south and west edges (the front) get low pieces only; anything taller than 1.6 m also joins the
##    see-through (it fades if it ever hides her).
##  * nothing overlaps: every piece is tested against the level's solids and obstacles (and the earlier pieces), the
##    `keep` rects (paths, puzzle floor) and the landmark's own rect; a piece that does not fit is skipped, never forced.
##  * every piece gets an obstacle footprint; small dressing is left out on Low (Dress.high = false).
##  * cheap: a landmark is ONE merged marble mesh + one see-through mesh + one small-dressing mesh + one contact-shadow
##    multimesh (4 draw calls, + its flames / veils / mist if the recipe has them).
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
		["statue_veiled_unfinished", 0.92, 0.38, -60.0, 0.85],
		["kit_face2", 0.95, 0.72, -90.0, 0.8, {"small": true}], ["kit_face5", 0.42, 0.1, 160.0, 0.75, {"small": true, "tilt": 90.0}],
		["kit_urns", 0.08, 0.62, 30.0, 0.8, {"small": true}], ["kit_face6", 0.06, 0.88, 120.0, 0.7, {"small": true}],
		["flame", 0.6, 0.1, 0.0, 0.14, {"y": 0.97}]],
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
		["statue_veiled_unfinished", 0.86, 0.16, -45.0, 0.9],
		["beacon", 0.04, 0.5, 0.0, 1.0], ["beacon", 0.5, 0.04, 0.0, 1.0], ["beacon", 0.96, 0.5, 0.0, 1.0]],
	# ---------------------------------------------------------------- ACT 2, W wing (glass, cold: "w_glass")
	# glass everywhere: tall framed panes on the back walls, cold columns, a praying figure
	"stair_breath": [
		["column_doric", 0.18, 0.06, 0.0, 0.8], ["column_doric", 0.82, 0.06, 0.0, 0.8],
		["mirror_frame", 0.5, 0.05, 0.0, 0.9, {"glass": true}],
		["statue_veiled_praying", 0.94, 0.3, -60.0, 0.85], ["balustrade", 0.97, 0.7, 90.0, 1.0],
		["rubble_pile", 0.06, 0.8, 0.0, 0.35, {"small": true}]],
	"hall_glass": [
		["mirror_frame", 0.25, 0.05, 0.0, 1.1, {"glass": true}], ["mirror_frame", 0.5, 0.05, 0.0, 1.1, {"glass": true}],
		["mirror_frame", 0.75, 0.05, 0.0, 1.1, {"glass": true}],
		["column_doric", 0.06, 0.06, 0.0, 1.0], ["column_doric", 0.94, 0.06, 0.0, 1.0],
		["statue_veiled_mourning", 0.95, 0.35, -90.0, 0.95], ["mirror_frame", 0.96, 0.7, -90.0, 0.9, {"glass": true}],
		["pediment_fragment", 0.1, 0.9, 30.0, 0.6, {"small": true}]],
	"shadow_chamber": [
		["pylon_ashlar", 0.06, 0.06, 0.0, 0.9], ["pylon_ashlar", 0.94, 0.06, 0.0, 0.9],
		["mirror_frame", 0.5, 0.04, 0.0, 1.0, {"glass": true}],
		["statue_veiled_kneeling", 0.95, 0.5, -90.0, 0.8], ["rubble_pile", 0.1, 0.85, 0.0, 0.4, {"small": true}],
		["column_fallen", 0.82, 0.9, 20.0, 0.5, {"small": true}]],
	"hidden_way": [
		["archway_ruined", 0.5, 0.06, 0.0, 0.85],
		["wall_ruin_low", 0.06, 0.5, 90.0, 0.55], ["wall_ruin_low", 0.94, 0.5, 90.0, 0.55],
		["mirror_frame", 0.94, 0.15, -90.0, 0.8, {"glass": true}], ["kit_dead_plant", 0.88, 0.88, 0.0, 0.9, {"small": true}]],
	"colossus": [
		["column_fallen", 0.25, 0.12, 30.0, 1.0], ["rubble_pile", 0.85, 0.12, 0.0, 0.8],
		["pediment_fragment", 0.92, 0.55, -80.0, 0.9], ["column_stump", 0.08, 0.5, 0.0, 0.9],
		["column_doric", 0.55, 0.05, 0.0, 1.0, {"tilt": 0.0}], ["rubble_pile", 0.12, 0.88, 40.0, 0.45, {"small": true}]],
	# ---------------------------------------------------------------- ACT 2, N wing (garden mist: "n_garden")
	# overgrown: columns and stumps, dead shrubs, low drifting mist, petals
	"colonnade": [
		["column_doric", 0.1, 0.06, 0.0, 1.0], ["column_doric", 0.3, 0.06, 0.0, 1.0], ["column_doric", 0.5, 0.06, 0.0, 1.0],
		["column_stump", 0.7, 0.06, 0.0, 1.0], ["column_doric", 0.9, 0.06, 0.0, 1.0],
		["column_fallen", 0.75, 0.85, 70.0, 0.6, {"small": true}], ["kit_dead_plant", 0.06, 0.9, 0.0, 0.9, {"small": true}],
		["kit_dead_plant", 0.6, 0.12, 0.0, 0.8, {"small": true}], ["mist", 0.5, 0.5, 0.0, 2.2], ["petals", 0.5, 0.5, 0.0, 0.8]],
	"turned_ones": [
		["statue_veiled_mourning", 0.2, 0.12, 180.0, 1.0], ["statue_veiled_praying", 0.5, 0.08, 180.0, 1.0],
		["statue_veiled_mourning", 0.8, 0.12, 180.0, 1.0], ["statue_veiled_broken", 0.94, 0.55, -100.0, 0.9],
		["kit_dead_plant", 0.08, 0.6, 0.0, 0.9, {"small": true}], ["kit_dead_plant", 0.35, 0.06, 0.0, 0.8, {"small": true}],
		["mist", 0.5, 0.6, 0.0, 1.8], ["petals", 0.5, 0.5, 0.0, 0.6]],
	"votive": [
		["kit_votive", 0.5, 0.08, 0.0, 1.0], ["flame", 0.44, 0.08, 0.0, 0.1, {"y": 0.5}], ["flame", 0.56, 0.08, 0.0, 0.1, {"y": 0.5}],
		["kit_urns", 0.88, 0.2, -30.0, 0.8, {"small": true}], ["kit_dead_plant", 0.12, 0.2, 0.0, 0.8, {"small": true}],
		["column_stump", 0.9, 0.7, 0.0, 0.7], ["petals", 0.5, 0.5, 0.0, 1.0]],
	"tree_shards": [
		["kit_dead_plant", 0.1, 0.12, 0.0, 1.1], ["kit_dead_plant", 0.9, 0.18, 40.0, 1.0],
		["statue_veiled_bust", 0.94, 0.5, -90.0, 0.8],
		["balustrade", 0.5, 0.97, 0.0, 1.0], ["rubble_pile", 0.92, 0.82, 0.0, 0.35, {"small": true}],
		["petals", 0.5, 0.5, 0.0, 1.0]],
	"mist_maze": [
		["statue_veiled_broken", 0.92, 0.1, -135.0, 0.9], ["column_stump", 0.08, 0.08, 0.0, 0.9],
		["kit_dead_plant", 0.5, 0.06, 0.0, 1.0, {"small": true}], ["kit_urns", 0.92, 0.9, 0.0, 0.8, {"small": true}],
		["mist", 0.35, 0.4, 0.0, 2.6], ["mist", 0.7, 0.7, 0.0, 2.2]],
	# ---------------------------------------------------------------- ACT 2, E wing (high, windy: "e_high")
	# open to the sky: balustrades on the drop side, posts streaming torn veils, the bells
	"balcony": [
		["balustrade", 0.2, 0.97, 0.0, 1.0], ["balustrade", 0.5, 0.97, 0.0, 1.0], ["balustrade", 0.8, 0.97, 0.0, 1.0],
		["kit_awning_post", 0.94, 0.15, 90.0, 1.0], ["veils", 0.94, 0.15, 90.0, 1.0],
		["kit_awning_post", 0.3, 0.06, 90.0, 1.0], ["veils", 0.3, 0.06, 90.0, 1.0],
		["kit_urns", 0.75, 0.15, 90.0, 0.9, {"small": true}], ["box", 0.55, 0.12, 0.0, 1.0, {"size": Vector3(1.6, 0.45, 0.5), "mat": 0.25}],
		["kit_dead_plant", 0.08, 0.12, 0.0, 0.9, {"small": true}]],
	"singing_stones": [
		["kit_windbells", 0.85, 0.08, 0.0, 1.0], ["column_stump", 0.08, 0.1, 0.0, 0.8],
		["kit_awning_post", 0.94, 0.6, 90.0, 0.9], ["veils", 0.94, 0.6, 90.0, 0.9],
		["rubble_pile", 0.9, 0.9, 0.0, 0.35, {"small": true}], ["balustrade", 0.3, 0.97, 0.0, 1.0]],
	"mirror_walk": [
		["mirror_frame", 0.2, 0.05, 0.0, 1.0, {"glass": true}], ["mirror_frame", 0.5, 0.05, 0.0, 1.0, {"glass": true}],
		["mirror_frame", 0.8, 0.05, 0.0, 1.0, {"glass": true}],
		["balustrade", 0.3, 0.97, 0.0, 1.0], ["balustrade", 0.7, 0.97, 0.0, 1.0],
		["kit_awning_post", 0.96, 0.4, 90.0, 0.9], ["veils", 0.96, 0.4, 90.0, 0.9]],
	"spring": [
		["statue_veiled_kneeling", 0.88, 0.12, -45.0, 0.9], ["kit_urns", 0.12, 0.12, 20.0, 0.9],
		["wall_ruin_low", 0.95, 0.6, 90.0, 0.6], ["kit_dead_plant", 0.08, 0.85, 0.0, 0.8, {"small": true}],
		["balustrade", 0.5, 0.97, 0.0, 1.0]],
	"scales": [
		["statue_veiled_praying", 0.1, 0.08, 45.0, 1.0], ["column_stump", 0.92, 0.08, 0.0, 1.0],
		["pediment_fragment", 0.93, 0.6, -90.0, 0.7, {"small": true}], ["kit_awning_post", 0.94, 0.3, 90.0, 0.9],
		["veils", 0.94, 0.3, 90.0, 0.9], ["balustrade", 0.5, 0.97, 0.0, 1.0]],
	# ---------------------------------------------------------------- ACT 3 (the convergence, dusk: "act3")
	"pool_halves": [
		["statue_veiled_kneeling", 0.08, 0.08, 135.0, 0.9], ["statue_veiled_kneeling", 0.92, 0.08, -135.0, 0.9],
		["column_stump", 0.95, 0.6, 0.0, 0.8], ["pediment_fragment", 0.5, 0.04, 0.0, 0.8, {"small": true}]],
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
	d._keep = keep
	parent.add_child(d)
	if not RECIPES.has(id):
		push_warning("Dress: no recipe " + id)
		return d
	for e in RECIPES[id]: d._place(e)
	d._commit()
	return d

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
	at.y += float(o.get("y", 0.0))
	match what:
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
var _xf_last := Transform3D()
var _panes: Array = []              # [Transform3D, size]: glass panes in mirror frames
## test a piece's footprint, then queue it (main / occ / small) with its obstacle, occluder and contact shadow
func _add_mesh(what: String, mesh: ArrayMesh, xf: Transform3D, rad: float, from_asset: bool, o: Dictionary, size := Vector3.ZERO, bb := AABB()) -> void:
	_last_ok = false
	if bb.size == Vector3.ZERO: bb = mesh.get_aabb()
	var wb: AABB = xf * bb
	var fr := Rect2(wb.position.x, wb.position.z, wb.size.x, wb.size.z)
	var on: bool = o.get("on", false)
	if not on and not _rect.grow(0.02).encloses(fr) and fr.size.x < _rect.size.x and fr.size.y < _rect.size.y:
		# an edge piece: slid in until it is inside the landmark (recipes put pieces against the edges)
		var dx := maxf(_rect.position.x + 0.03 - fr.position.x, 0.0) - maxf(fr.end.x - (_rect.end.x - 0.03), 0.0)
		var dz := maxf(_rect.position.y + 0.03 - fr.position.y, 0.0) - maxf(fr.end.y - (_rect.end.y - 0.03), 0.0)
		xf.origin += Vector3(dx, 0.0, dz)
		wb = xf * bb
		fr = Rect2(wb.position.x, wb.position.z, wb.size.x, wb.size.z)
	if not on:
		if not _rect.grow(0.05).encloses(fr):
			skipped.append([what, "outside the landmark"]); return
		for k in _keep:
			if (k as Rect2).grow(0.12).intersects(fr):
				skipped.append([what, "on a kept path"]); return
		var circles := _footprint(xf, bb)
		for c in circles:
			if level.blocked(Vector2(c.x, c.y), c.z * 0.92):
				skipped.append([what, "hits a wall / obstacle"]); return
		for c in circles: level.ob_circle(Vector2(c.x, c.y), c.z, "dress:" + what)
	_last_ok = true
	_xf_last = xf
	var tall := wb.size.y > TALL
	var small: bool = o.get("small", false)
	var slot := "occ" if tall else ("small" if small else "main")
	_parts[slot].append([mesh, xf])
	if tall: level.occluders.append(wb)
	if not on:
		var c := wb.get_center()
		var yaw := xf.basis.get_euler().y
		_blobs.append(Transform3D(Basis(Vector3.UP, yaw) * Basis.from_scale(Vector3(maxf(bb.size.x, 0.3) * xf.basis.get_scale().x * 1.15, 1.0,
			maxf(bb.size.z, 0.3) * xf.basis.get_scale().z * 1.15)), Vector3(c.x, _y + 0.012, c.z)))

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
