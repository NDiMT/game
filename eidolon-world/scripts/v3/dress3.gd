class_name Dress3
## v3: A's landmark dressing (Dress, scripts/fx/dress.gd: its kit, its fit rules: nothing overlaps, nothing tall on the
## south / west edges, nothing hides the path or an interact point, one merged mesh per space) on the v3 spaces of
## Act 1 and the Atrium. A's recipes where they fit as they are ("stub_gateway", "atrium"); elsewhere a short list
## in A's entry format ([what, u, v, yaw, scale, opts]; u 0 west..1 east, v 0 north..1 south).
## Kept clear in every space: each doorway's mouth (both sides) and the beat's own floor (KEEP).

const SETS := {
	"WS": [["column_stump", 0.05, 0.3, 0.0, 0.8], ["pediment_fragment", 0.86, 0.2, 20.0, 0.7, {"small": true}],
		["column_fallen", 0.2, 0.82, 70.0, 0.5, {"small": true}], ["kit_urns", 0.03, 0.85, 30.0, 0.6, {"small": true}],
		["rubble_pile", 0.47, 0.93, 0.0, 0.32, {"small": true}]],
	"I1": "stub_gateway",
	"I2": [["statue_veiled_mourning", 0.88, 0.1, -30.0, 0.8], ["kit_urns", 0.08, 0.9, 0.0, 0.6, {"small": true}],
		["rubble_pile", 0.9, 0.9, 0.0, 0.3, {"small": true}]],
	"I3": [["statue_veiled_bust", 0.9, 0.41, -90.0, 0.8], ["statue_veiled_bust", 0.9, 0.62, -90.0, 0.8],
		["column_stump", 0.9, 0.06, 0.0, 0.7], ["column_fallen", 0.1, 0.78, 10.0, 0.5, {"small": true}],
		["rubble_pile", 0.1, 0.3, 0.0, 0.35, {"small": true}]],
	"IB1": [["statue_veiled_kneeling", 0.45, 0.1, 90.0, 0.75], ["column_fallen", 0.18, 0.13, 80.0, 0.55, {"small": true}],
		["kit_dead_plant", 0.08, 0.85, 0.0, 0.8, {"small": true}], ["rubble_pile", 0.55, 0.92, 0.0, 0.3, {"small": true}]],
	"I4": [["column_stump", 0.05, 0.1, 0.0, 0.8], ["column_doric", 0.95, 0.07, 0.0, 0.8], ["kit_dead_plant", 0.7, 0.08, 0.0, 0.8, {"small": true}],
		["rubble_pile", 0.5, 0.92, 0.0, 0.35, {"small": true}], ["column_fallen", 0.25, 0.86, 20.0, 0.5, {"small": true}],
		["rubble_pile", 0.95, 0.9, 40.0, 0.3, {"small": true}]],
	"I5": [["kit_workbench", 0.2, 0.07, 0.0, 1.0], ["item_wax_tablet", 0.15, 0.08, 15.0, 2.2, {"y": 0.97, "on": true}],
		["item_wax_tablet", 0.26, 0.085, -20.0, 2.2, {"y": 0.97, "on": true}], ["flame", 0.22, 0.07, 0.0, 0.14, {"y": 0.97, "on": true}],
		["kit_cot", 0.1, 0.62, 90.0, 0.9], ["statue_veiled_unfinished", 0.92, 0.1, -60.0, 0.85],
		["kit_face2", 0.94, 0.66, -90.0, 0.8, {"small": true}], ["kit_face5", 0.42, 0.94, 160.0, 0.75, {"small": true, "tilt": 90.0}],
		["kit_urns", 0.06, 0.92, 30.0, 0.8, {"small": true}], ["kit_face6", 0.78, 0.94, 120.0, 0.7, {"small": true}]],
	"A": "atrium",
}
## the beats' own floors, kept clear (x0, z0, x1, z1)
const KEEP := [[-6.6, 31.0, -2.0, 33.6],            # WS: where she lies, the comb, the camera's view of her
	[3.2, 26.0, 8.8, 31.0],                           # I1: the water sheet
	[11.4, 26.4, 13.6, 28.6],                          # I2: the bell and its ringer
	[18.2, 22.2, 20.0, 23.8],                          # I3: the pane and where you stand
	[18.0, 10.2, 21.0, 15.0],                          # IB1: the shallow and its reeds
	[7.6, 10.0, 10.4, 17.0], [6.5, 12.6, 12.0, 14.4],  # I4: the stream, the crossing and its approach
	[-0.6, 14.6, 2.0, 17.4], [0.0, 10.0, 4.0, 14.4],   # I5: the basin, the way from the east door to the north one
	[-2.8, -2.8, 2.8, 2.8],                            # A: round the fountain (the gaze)
	[-9.2, -3.4, -7.4, -1.6], [1.6, -9.2, 3.4, -7.4], [7.4, -3.4, 9.2, -1.6]]   # A: the three Beacons (pz_a)

static func dress_all(lv: Level, parent: Node3D) -> Array:
	var keep: Array = []
	for k in KEEP: keep.append(Rect2(k[0], k[1], k[2] - k[0], k[3] - k[1]))
	for l in Map3.LINKS:
		var d := Map3.door(l[0], l[1])
		if d.is_empty(): continue
		var c: Vector2 = d["c"]
		var n: Vector2 = d["n"]
		var al: Vector2 = d["along"]
		var w: float = d["w"] + 0.6
		var a := c - n * 2.6 - al * w * 0.5
		var b := c + n * 2.6 + al * w * 0.5
		keep.append(Rect2(minf(a.x, b.x), minf(a.y, b.y), absf(b.x - a.x), absf(b.y - a.y)))
	var out: Array = []
	for id in SETS:
		var r := Map3.rect(id)
		var y := float(Map3.space(id)[5])
		var e: Variant = SETS[id]
		var d: Dress
		if e is String: d = Dress.build(lv, parent, e, r, y, keep)
		else: d = custom(lv, parent, id, r, y, e, keep)
		out.append(d)
		for sk in d.skipped: print("[v3 dress] %s %s: %s" % [id, sk[0], sk[1]])
	return out

## a Dress from an entry list (A's format) instead of one of A's named recipes
static func custom(lv: Level, parent: Node, id: String, rect: Rect2, floor_y: float, entries: Array, keep: Array) -> Dress:
	var d := Dress.new()
	d.name = "Dress_" + id
	d.level = lv
	d._rect = rect
	d._y = floor_y
	d._keep = keep.duplicate()
	parent.add_child(d)
	for e in entries: d._place(e)
	d._commit()
	return d
