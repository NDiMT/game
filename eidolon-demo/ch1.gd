extends "res://main.gd"
## EIDOLON, chapter 1, "The Veiled Gate": one house that climbs from the sea, and one dry watercourse through it.
## He hid every mirror; water is a mirror too, so he drove it out of the house. She brings it back.
## The engine (materials, the heroine, walking by taps, the look of water) is main.gd; this script is the world of
## the chapter and what can be done in it. See eidolon-world/dev/CH1_FLOW_V4.md for the design.
##
## How a court is laid out here. The eye looks from the south-east and from above, so what stands over a water is
## seen in it shifted toward the south-east by about its own height: a water lies to the SOUTH and EAST of the things
## it is meant to show, and she and what she uses stand at its north and west rims.

# ---------------------------------------------------------------- the harbour (I.1)
const HX0 := -5.0
const HZ0 := 0.0
const HX1 := 5.0
const HZ1 := 11.0
const BX0 := -3.6      # its basin: the sea, held still inside the mole
const BZ0 := 3.0
const BX1 := 3.6
const BZ1 := 9.6
const MOLE_W := 0.5      # half the width of the mole, which runs south from the quay along x = 0
const MOLE_A := 5.0      # the stub ends here...
const MOLE_B := 6.8      # ...and the piece that is left in the open begins here
const MOLE_C := 8.4      # and ends here
const HERPL := Vector3(0, 0, 3.75)      # the plinth she wakes on, on the stub, facing the sea
const WHEEL1 := Vector3(0, 0, 7.75)      # the wheel of the first sluice, on the far piece
const WINCH_YAW := -PI * 0.5      # the wheel faces north, toward whoever comes along the mole

# ---------------------------------------------------------------- the long basin (I.3), the well (I.4), the fountain (I.5), the forecourt (I.6)
const TX0 := -3.4
const TZ0 := -16.0
const TX1 := 2.6
const TZ1 := -7.0
const TPX0 := -1.5      # its water: rain, which he could not forbid
const TPZ0 := -15.0
const TPX1 := 1.2
const TPZ1 := -8.2
const TWX0 := -2.75     # the walk along its west side, where the channel runs
const TWX1 := -1.85
const TG_REAL := -13.2      # the grille that stands across the walk above...
const TG_WATER := -10.6     # ...and the one that stands across it only in the water
const WHEEL2 := Vector3(-2.72, 0, -15.0)
const VX0 := -6.2       # the court of the well
const VZ0 := -24.2
const VX1 := 0.6
const VZ1 := -17.5
const WELL := Vector3(-2.6, 0, -20.6)
const WELL_H := 0.56      # half the side of the square of water inside its round kerb
const WELL_R := 0.9       # the kerb's outer radius
const BUCKET := Vector3(-0.42, 0, -0.2)      # where the bucket hangs, from the well's middle
const POST3 := Vector3(-5.3, 0, -19.95)
const FX0 := -14.6      # the court of the fountain
const FZ0 := -25.0
const FX1 := -7.4
const FZ1 := -17.6
const FPX0 := -12.9
const FPZ0 := -24.6
const FPX1 := -8.5
const FPZ1 := -21.2
const ARCH_X := -11.0
const ARCH_W := 0.55      # half its width
const ARCH_Y := 1.55      # where it springs
const FWALL_H := 2.6
const GX0 := -16.0      # the forecourt of the atrium
const GZ0 := -37.0
const GX1 := -5.2
const GZ1 := -26.6
const GPX0 := -13.0
const GPZ0 := -34.2
const GPX1 := -6.8
const GPZ1 := -28.6
const ROW_Z := -34.9      # the row of statues along the pool's north rim, and the one along its west rim
const ROW_X := [-12.6, -11.5, -10.4, -9.3]
const HERS := 2           # which place of that row is empty
const ROWW_X := -13.7
const ROWW_Z := [-33.3, -32.1, -30.9]
const DOOR6 := Vector3(-15.85, 0, -32.0)
# ---------------------------------------------------------------- the atrium (I.7)
const UX0 := -34.0
const UZ0 := -43.0
const UX1 := -16.0
const UZ1 := -24.0
const UC := Vector3(-25.0, 0, -32.6)      # the middle of the great basin
const UR := 4.2                           # its radius
const UH := 4.3                           # half the side of the square opening it sits in
const POD_H := 1.2                        # the podium of the Gate
const POD_Z := UZ0 + 2.6                  # its front edge, where the stair comes up
const STAIR_Z := UZ0 + 5.0                # the foot of the stair

var N := {}      # the pieces that move, by name (kept here so that the joined world leaves them alone)
var WL: Array = []      # the still waters, in order: their names
var W := {}      # each water: {"r": [x0, z0, x1, z1], "heads": [rects of floor from which her reflection can be sent], "foot": {name: {x0, z0, x1, z1, on, h}}}
var refl_w := ""      # the water her reflection is out on
var refl_key := "mir"      # which of her mirrored bodies it is (a water whose surface is not at the floor's height has one of its own: W[id].mir)
var ramps: Array = []      # floor that is not level: {"r": its rect, "z0", "z1": between these it goes from height "y0" to "y1"}
var on_ramp := false
var refl_busy := 0      # how many orders to her reflection are still being carried out
var woke := false
var flags := {}
var wing_open := {"W": false, "N": false, "S": false}      # which wings are built: a script that extends this one and builds a wing sets its own to true in _init (after super._init())
var wings_done: Array = []      # the wings whose water has been set free, in the order it was done

func _init() -> void:
	old_world = false
	title_sub = "I  ·  The Veiled Gate\ntap to begin"; end_sub = "the three wings are still being built\ntap to begin again"

func _hollows() -> Array:
	return [[HX0 + 0.5, HZ0 + 0.5, HX1 - 0.5, HZ1 - 0.5], [TX0 + 0.5, TZ0 + 0.5, TX1 - 0.5, TZ1 - 0.5], [VX0 + 0.5, VZ0 + 0.5, VX1 - 0.5, VZ1 - 0.5],
		[FX0 + 0.5, FZ0 - 0.1, FX1 - 0.5, FZ1 - 0.5], [GX0 + 0.5, GZ0 + 0.5, GX1 - 0.5, GZ1 - 0.5], [UX0 + 0.5, UZ0 + 0.5, UX1 - 0.5, UZ1 - 0.5]]

# ---------------------------------------------------------------- small builders
func R(x0: float, z0: float, x1: float, z1: float, on := true, h := 0.0) -> Dictionary:
	return {"x0": x0, "z0": z0, "x1": x1, "z1": z1, "on": on, "h": h}

## a plain colour for a thing that lies under a water (the haze of the water pales everything else that is there)
func under_mat(c: Color) -> StandardMaterial3D:
	var k := "under|" + c.to_html(false)
	if not N.has(k):
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.albedo_color = c; m.cull_mode = BaseMaterial3D.CULL_DISABLED; N[k] = m
	return N[k]

## the still surface of a pool
func glass(x0: float, z0: float, x1: float, z1: float, blur := 0.6) -> ShaderMaterial:
	var wq := QuadMesh.new(); wq.size = Vector2(x1 - x0, z1 - z0); wq.orientation = PlaneMesh.FACE_Y
	var g := ShaderMaterial.new(); g.shader = shaders["glass"]; timed.append(g)
	g.set_shader_parameter("lost_a", 0.0); g.set_shader_parameter("blur_px", blur); g.set_shader_parameter("lod", 0.0)
	prim(wq, Vector3((x0 + x1) * 0.5, 0.012, (z0 + z1) * 0.5), g).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return g

## a capstan with a handwheel (the models of the old winch), turned to face a way. Returns its turning wheel; "hub"
## is where the middle of that wheel is, and "n" the way it faces (toward whoever turns it)
func winch(at: Vector3, yaw: float, parent: Node, twin: bool) -> Dictionary:
	var parts := "wood:wood,rope:linen,gold:gold,stone:stone"
	var hold := Node3D.new(); hold.position = at; hold.rotation.y = yaw; parent.add_child(hold)
	var wb := prop_model("winch_base", hold, 0.0, 0.0, twin, false, parts); wb.rotation.y = PI; wb.scale = Vector3.ONE * WINCH_K
	var wn := Node3D.new(); wn.position = Vector3(-WINCH_HUB.x, WINCH_HUB.y, 0) * WINCH_K; wn.rotation.y = PI; hold.add_child(wn)
	prop_model("winch_wheel", wn, 0.0, 0.0, twin, false, parts).scale = Vector3.ONE * WINCH_K
	var n := Vector3(-cos(yaw), 0, sin(yaw))
	return {"wheel": wn, "hub": at + n * (WINCH_HUB.x * WINCH_K) + Vector3(0, WINCH_HUB.y * WINCH_K, 0), "n": n}

## a sluice across the dry channel: two piers, and between them a bronze leaf that sinks into the floor. The leaf
## is kept under N[key]. along_x: the channel runs along x here (the leaf lies along z)
func sluice(key: String, c: Vector3, along_x := false, half := 0.62, h := 1.5) -> void:
	var ax := Vector3(0, 0, 1) if along_x else Vector3(1, 0, 0)      # along the leaf
	var th := Vector3(1, 0, 0) if along_x else Vector3(0, 0, 1)      # through it
	for e in [-1.0, 1.0]:
		var pc: Vector3 = c + ax * e * (half + 0.17)
		blk(pc - ax * 0.17 - th * 0.17, pc + ax * 0.17 + th * 0.17 + Vector3(0, h + 0.2, 0), "stone")
		blk(pc - ax * 0.2 - th * 0.2, pc + ax * 0.2 + th * 0.2 + Vector3(0, 0.1, 0), "shade")
		blk(pc - ax * 0.2 - th * 0.2 + Vector3(0, h + 0.2, 0), pc + ax * 0.2 + th * 0.2 + Vector3(0, h + 0.27, 0), "shade")
		ball(pc + Vector3(0, h + 0.36, 0), 0.09, pal("gold"))
	gate_slot(c, half, along_x)
	var leaf := Node3D.new(); leaf.position = c; add_child(leaf)
	if along_x: leaf.rotation.y = PI * 0.5
	var n := 7
	for i in n: bb(Vector3(-half + 0.08 + (2.0 * half - 0.16) * i / (n - 1) - 0.018, 0, -0.018), Vector3(-half + 0.08 + (2.0 * half - 0.16) * i / (n - 1) + 0.018, h - 0.04, 0.018))
	bb_end("dark", leaf)
	for gy in [0.38, 0.95, h - 0.06]: bb(Vector3(-half, gy, -0.024), Vector3(half, gy + 0.04, 0.024))
	bb(Vector3(-half, 0.42, -0.012), Vector3(half, 0.95, 0.012))      # the board that held the water back
	bb_end("gold", leaf)
	N[key] = leaf; N[key + "_h"] = h

## a bronze grille as a leaf of its own: across a walk, or (twin) one that stands only in a water
func leaf(key: String, c: Vector3, along_x: bool, half: float, h: float, parent: Node = self, twin := false) -> Node3D:
	var lf := Node3D.new(); lf.position = c; parent.add_child(lf)
	if along_x: lf.rotation.y = PI * 0.5
	var n := maxi(5, int(half * 2.0 / 0.19))
	for i in n: bb(Vector3(-half + 0.06 + (2.0 * half - 0.12) * i / (n - 1) - 0.018, 0, -0.018), Vector3(-half + 0.06 + (2.0 * half - 0.12) * i / (n - 1) + 0.018, h - 0.04, 0.018))
	var b1 := bb_end("dark", lf)
	for gy in [0.45, h * 0.62, h - 0.06]: bb(Vector3(-half, gy, -0.024), Vector3(half, gy + 0.04, 0.024))
	for i in n: spear(Vector3(-half + 0.06 + (2.0 * half - 0.12) * i / (n - 1), h - 0.045, 0))
	var b2 := bb_end("gold", lf)
	if twin: b1.material_override = under_mat(Color("4a4468")); b2.material_override = under_mat(Color("c98f2c"))
	if key != "": N[key] = lf
	return lf

## a cloth that hangs in folds from a level edge: c is the middle of that edge, w its width, h how far it hangs
func drape(c: Vector3, w: float, h: float, pleats: int, m: Material) -> MeshInstance3D:
	var v := PackedVector3Array(); var nn := PackedVector3Array(); var uv := PackedVector2Array()
	var cols := pleats * 2; var rows := 9
	var at := func(i: int, j: int) -> Vector3:
		var fy := float(j) / rows
		var amp := 0.045 + 0.06 * fy
		var hem := 0.05 * sin(i * 1.7) * fy * fy      # the hem is not cut straight
		return Vector3(-w * 0.5 + w * i / cols + 0.02 * sin(i * 0.9 + j * 0.8) * fy, -(h + hem) * fy, amp * (1.0 if i % 2 == 1 else -1.0) + 0.03 * sin(i * 0.45) * fy)
	for i in cols:
		for j in rows:
			var q := [at.call(i, j), at.call(i + 1, j), at.call(i + 1, j + 1), at.call(i, j + 1)]
			var fn: Vector3 = ((q[1] as Vector3) - (q[0] as Vector3)).cross((q[3] as Vector3) - (q[0] as Vector3)).normalized()
			if fn.z < 0.0: fn = -fn
			for k in [0, 1, 2, 0, 2, 3]:
				v.append(q[k]); nn.append(fn); uv.append(Vector2(float(i + (1 if k in [1, 2] else 0)) / cols, float(j + (1 if k in [2, 3] else 0)) / rows))
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = nn; arr[Mesh.ARRAY_TEX_UV] = uv
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return prim(am, c, m)

## a plain floor over the sea
func floor_plain(x0: float, z0: float, x1: float, z1: float, tile := 1.0) -> void:
	slab(x0, z0, x1, z1, 0.0); under(x0, z0, x1, z1, 0.22, "stone")
	if tile > 0.0: tiles(x0, z0, x1, z1, tile)

## a wall: a base course, the wall, a cornice. twin: its copy in the water as well, in plain colours
func wall(x0: float, z0: float, x1: float, z1: float, h: float, twin := false, y0 := 0.0) -> void:
	blk(Vector3(x0, y0, z0), Vector3(x1, h, z1), "stone")
	if y0 == 0.0: blk(Vector3(x0 - 0.03, 0, z0 - 0.03), Vector3(x1 + 0.03, 0.14, z1 + 0.03), "shade")
	cornice(x0, z0, x1, z1, h, 0.04, 0.06)
	if twin:
		blk(Vector3(x0, y0, z0), Vector3(x1, h, z1), "stone", mroot).material_override = under_mat(Color("d8ccb9"))
		blk(Vector3(x0 - 0.04, h, z0 - 0.04), Vector3(x1 + 0.04, h + 0.06, z1 + 0.04), "stone", mroot).material_override = under_mat(Color("b9ab98"))

## a plinth for a statue of her, and the statue (pose "": none stands on it)
func her_plinth(p: Vector3, yaw: float, pose: String, parent: Node) -> Node3D:
	var flat := "flat2" if parent == mroot else "flat"
	cyl(p, 0.32, 0.3, 0.07, pal("shade", flat), 20, parent); cyl(p + Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone", flat), 20, parent)
	if pose == "": return null
	return her_statue(p + Vector3(0, 0.17, 0), yaw, pose, 1.0, parent)

func sluice_open(key: String, secs := 2.4) -> void:
	var gt := create_tween(); gt.tween_property(N[key], "position:y", -(float(N[key + "_h"]) + 0.25), secs).set_trans(Tween.TRANS_SINE)
	await gt.finished

## the dry channel: a band of darker stone between two thin kerbs, flush with the floor
func channel(a: Vector3, b: Vector3, w := 0.5) -> void:
	var along_x := absf(b.x - a.x) > absf(b.z - a.z)
	var lo := Vector3(minf(a.x, b.x), 0, minf(a.z, b.z)); var hi := Vector3(maxf(a.x, b.x), 0, maxf(a.z, b.z))
	if along_x:
		blk(Vector3(lo.x, 0, lo.z - w), Vector3(hi.x, 0.004, hi.z + w), "shade")
		for e in [-1.0, 1.0]: blk(Vector3(lo.x, 0, lo.z + e * w - 0.03), Vector3(hi.x, 0.018, lo.z + e * w + 0.03), "stone")
	else:
		blk(Vector3(lo.x - w, 0, lo.z), Vector3(hi.x + w, 0.004, hi.z), "shade")
		for e in [-1.0, 1.0]: blk(Vector3(lo.x + e * w - 0.03, 0, lo.z), Vector3(lo.x + e * w + 0.03, 0.018, hi.z), "stone")

# ---------------------------------------------------------------- the world
func _world() -> void:
	mroot = Node3D.new(); mroot.name = "MirrorPool"; mroot.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3.ZERO); add_child(mroot)
	_harbour(); _causeway(); _basin(); _well(); _fountain(); _forecourt(); _atrium()
	_wings()
	_strip_refl(mroot)
	pos = HERPL + Vector3(0, 0.17, 0); yaw = 0.0

## the wings of the atrium. A script that extends this one builds its wing here (and calls super._wings() first);
## likewise _wing_things() for what can be tapped there and _wing_nav() for its floor
func _wings() -> void:
	pass
func _wing_things() -> void:
	pass
func _wing_nav() -> void:
	pass

## a wing's water has been set free: it runs down its channel into the great basin of the atrium
func _wing_done(id: String) -> void:
	if id in wings_done: return
	wings_done.append(id)
	print("WING done ", id, " (", wings_done.size(), " of 3)")

## I.1 the shore. The sea stands still inside a small harbour. A quay on the north side; from it a mole runs south
## into the basin, broken in the middle. The wheel of the first sluice was left on the far piece. In the water the
## mole is whole
func _harbour() -> void:
	_pool_court(HX0, HZ0, HX1, HZ1, BX0, BZ0, BX1, BZ1, "stone", "PoolSky")
	tile_hole = Rect2(BX0 - 0.08, BZ0 - 0.08, BX1 - BX0 + 0.16, BZ1 - BZ0 + 0.16); tiles(HX0, HZ0, HX1, HZ1, 1.0); tile_hole = Rect2()
	glass(BX0, BZ0, BX1, BZ1)
	W["H"] = {"r": [BX0, BZ0, BX1, BZ1], "heads": [R(-MOLE_W, BZ0 - 0.6, MOLE_W, MOLE_A)],
		"foot": {"stub": R(-MOLE_W, BZ0 - 0.6, MOLE_W, MOLE_A + 0.02), "gap": R(-MOLE_W, MOLE_A - 0.02, MOLE_W, MOLE_B + 0.02), "far": R(-MOLE_W, MOLE_B - 0.02, MOLE_W, MOLE_C)}}
	WL.append("H")
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		# the mole: the stub that is left on the quay, and the piece in the open with the wheel
		for seg in [[BZ0, MOLE_A], [MOLE_B, MOLE_C]]:
			var d := blk(Vector3(-MOLE_W, 0, seg[0]), Vector3(MOLE_W, 0.05, seg[1]), "stone", both); d.material_override = pal("stone", flat)
			for e in [-1.0, 1.0]: blk(Vector3(e * MOLE_W - 0.04, 0.05, seg[0]), Vector3(e * MOLE_W + 0.04, 0.085, seg[1]), "shade", both)
		# the broken ends: stones fallen askew
		for rb in [[Vector3(-0.22, 0.05, MOLE_A - 0.12), 0.5, 0.13], [Vector3(0.24, 0.05, MOLE_A - 0.07), -0.4, 0.1], [Vector3(0.12, 0.05, MOLE_B + 0.1), 0.9, 0.12], [Vector3(-0.27, 0.05, MOLE_B + 0.06), -0.2, 0.09]]:
			var bk := blk(Vector3(-rb[2], 0, -0.08), Vector3(rb[2], 0.07, 0.08), "stone", both); bk.position = rb[0] + Vector3(0, 0.035, 0); bk.rotation.y = rb[1]
		# her plinth
		cyl(HERPL, 0.32, 0.3, 0.07, pal("shade", flat), 20, both); cyl(HERPL + Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone", flat), 20, both)
		# the wheel
		var wd := winch(WHEEL1, WINCH_YAW, both, twin)
		N["wheel1_m" if twin else "wheel1"] = wd.wheel
		if not twin: N["hub1"] = wd.hub; N["hubn1"] = wd.n
		if twin:      # in the water only: the middle of the mole, stone by stone, as it lay
			var n1 := 4
			for k in n1:
				var s0 := MOLE_A + (MOLE_B - MOLE_A) * k / n1; var s1 := MOLE_A + (MOLE_B - MOLE_A) * (k + 1) / n1
				var sb := blk(Vector3(-MOLE_W + 0.03 + 0.03 * (k % 2), 0, -(s1 - s0) * 0.5 + 0.07), Vector3(MOLE_W - 0.03 - 0.03 * ((k + 1) % 2), 0.05, (s1 - s0) * 0.5 - 0.07), "stone", both)
				sb.material_override = under_mat(Color("857fa4")); sb.position += Vector3(0, 0, (s0 + s1) * 0.5); sb.rotation.y = 0.03 * sin(k * 2.3 + 0.7)
	# the quay: a low wall to the sea on three sides, lamps, her boat outside
	parapet(Vector3(HX0 + 0.1, 0, HZ0 + 0.1), Vector3(HX0 + 0.1, 0, HZ1 - 0.1)); parapet(Vector3(HX0 + 0.1, 0, HZ1 - 0.1), Vector3(HX1 - 0.1, 0, HZ1 - 0.1)); parapet(Vector3(HX1 - 0.1, 0, HZ0 + 0.1), Vector3(HX1 - 0.1, 0, HZ1 - 0.1))
	parapet(Vector3(HX0 + 0.1, 0, HZ0 + 0.1), Vector3(-0.98, 0, HZ0 + 0.1)); parapet(Vector3(0.98, 0, HZ0 + 0.1), Vector3(HX1 - 0.1, 0, HZ0 + 0.1))
	channel(Vector3(0, 0, HZ0 + 0.02), Vector3(0, 0, BZ0 - 0.1))
	sluice("s1", Vector3(0, 0, HZ0 + 0.3))
	lantern(Vector3(1.7, 0, 0.9), 2); lantern(Vector3(-3.9, 0, 2.2), 3, -1.0)
	urn(Vector3(-4.2, 0, 0.8), 1.0); urn(Vector3(-3.85, 0, 1.1), 0.7, "rose"); urn(Vector3(4.2, 0, 2.1), 0.9)
	boat = Node3D.new(); boat.name = "Boat"; boat.position = Vector3(HX1 + 1.5, WATER - 0.12, 8.2); boat.rotation.y = 0.5; add_child(boat)
	build_boat(boat)
	rock(Vector3(HX1 + 1.2, 0, 4.0), 1.2); rock(Vector3(HX0 - 1.3, 0, 9.4), 1.0); rock(Vector3(2.2, 0, HZ1 + 1.4), 0.9); reeds(Vector3(HX0 - 0.9, 0, 6.2)); reeds(Vector3(-2.4, 0, HZ1 + 0.9), 7)
	stele("stele_1", Vector3(2.9, 0, 1.2), 0.0, ["The sea I could not cover.", "I broke the mole instead.\nThe sea did not notice."])
	_look_add("", HERPL, 0.4, ["a plinth, at the end of what is left of the mole", "it faces the open water"])

## I.2 the dry channel: a causeway north from the harbour, the channel down its middle
func _causeway() -> void:
	floor_plain(-1.3, TZ1, 1.3, HZ0, 0.0)
	channel(Vector3(0, 0, TZ1), Vector3(0, 0, HZ0))
	for e in [-1.0, 1.0]: parapet(Vector3(e * 1.2, 0, TZ1 + 0.1), Vector3(e * 1.2, 0, HZ0 - 0.1))
	# a weir stone beside the channel, with half a carving at the old waterline: a half ring of bronze, cut off flat
	blk(Vector3(0.62, 0, -3.9), Vector3(1.02, 0.5, -3.1), "stone"); blk(Vector3(0.6, 0, -3.92), Vector3(1.04, 0.06, -3.08), "shade")
	arch_band(Vector3(0.62, 0.12, -3.5), 0.2, 0.26, 0.012, true); arch_band(Vector3(0.62, 0.12, -3.5), 0.07, 0.11, 0.012, true); bb_end("gold")
	_look_add("", Vector3(0.82, 0, -3.5), 0.5, ["half a carving, cut off at the old waterline", "the other half was never carved"])
	stele("stele_2", Vector3(-0.85, 0, -5.4), PI * 0.5, ["So I turned the water\naway from the house.", "The channel is dry from the sea\nto the top. Follow it."])
	lantern(Vector3(0.95, 0, -6.3), 4)

## I.3 the long basin of rain. The walk runs along its west side, under a wall. A grille stands across the walk
## near its far end, with the wheel that lifts it behind it. In the water another grille stands across the walk
## half way along, where above there is none
func _basin() -> void:
	_pool_court(TX0, TZ0, TX1, TZ1, TPX0, TPZ0, TPX1, TPZ1, "stone", "PoolSky3")
	tile_hole = Rect2(TPX0 - 0.08, TPZ0 - 0.08, TPX1 - TPX0 + 0.16, TPZ1 - TPZ0 + 0.16); tiles(TX0, TZ0, TX1, TZ1, 1.0); tile_hole = Rect2()
	glass(TPX0, TPZ0, TPX1, TPZ1)
	W["T"] = {"r": [TPX0, TPZ0, TPX1, TPZ1], "heads": [R(TWX0, TG_REAL + 0.2, TWX1, TZ1 - 0.4)],
		"foot": {"a": R(TWX0, TG_WATER + 0.15, TWX1, TZ1 - 0.4), "wg": R(TWX0, TG_WATER - 0.15, TWX1, TG_WATER + 0.15, false), "b": R(TWX0, TZ0 + 0.65, TWX1, TG_WATER - 0.15)}}
	WL.append("T")
	wall(TX0, TZ0, TX0 + 0.3, TZ1, 2.3, true)      # the west wall
	wall(-1.3, TZ0, TX1, TZ0 + 0.3, 2.3, true)      # the north wall, east of the sluice
	parapet(Vector3(TX1 - 0.1, 0, TZ0 + 0.4), Vector3(TX1 - 0.1, 0, TZ1 - 0.1)); parapet(Vector3(1.3, 0, TZ1 - 0.1), Vector3(TX1 - 0.1, 0, TZ1 - 0.1)); parapet(Vector3(TX0 + 0.4, 0, TZ1 - 0.1), Vector3(-1.3, 0, TZ1 - 0.1))
	channel(Vector3(-0.5, 0, TZ1 - 0.62), Vector3(-2.3, 0, TZ1 - 0.62)); channel(Vector3(-2.3, 0, TZ1 - 0.12), Vector3(-2.3, 0, TZ0 + 0.02)); channel(Vector3(0, 0, TZ1 - 1.12), Vector3(0, 0, TZ1))
	leaf("g2", Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_REAL), false, (TPX0 - TX0 - 0.3) * 0.5, 1.9)      # the grille above
	gate_slot(Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_REAL), (TPX0 - TX0 - 0.3) * 0.5, false)
	leaf("", Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_WATER), false, (TPX0 - TX0 - 0.3) * 0.5, 1.9, mroot, true)      # the grille the water keeps
	for both in [self, mroot]:
		var wd := winch(WHEEL2, PI * 0.5, both, both == mroot)
		N["wheel2_m" if both == mroot else "wheel2"] = wd.wheel
		if both == self: N["hub2"] = wd.hub; N["hubn2"] = wd.n
	sluice("s2", Vector3(-2.05, 0, TZ0 + 0.3), false, 0.5)
	stele("stele_3", Vector3(1.95, 0, TZ1 - 0.62), 0.0, ["Rain.\nI cannot forbid the rain.", "What bars the one\ndoes not bar the other."])
	urn(Vector3(2.0, 0, TZ0 + 0.9), 1.0); cypress(Vector3(TX0 + 0.75, 0, TZ1 - 0.6), 2.4)

## I.4 the well. Its windlass still turns; the handle of the next sluice lies in the bucket, but only in the water
func _well() -> void:
	floor_plain(-2.8, VZ1, -1.3, TZ0, 0.0); channel(Vector3(-2.05, 0, VZ1), Vector3(-2.05, 0, TZ0))
	_pool_court(VX0, VZ0, VX1, VZ1, WELL.x - WELL_H, WELL.z - WELL_H, WELL.x + WELL_H, WELL.z + WELL_H, "stone", "PoolSky4")
	tiles(VX0, VZ0, VX1, VZ1, 1.0)
	glass(WELL.x - WELL_H, WELL.z - WELL_H, WELL.x + WELL_H, WELL.z + WELL_H, 0.4)
	var kq := WELL_R + 0.2
	W["V"] = {"r": [WELL.x - WELL_H, WELL.z - WELL_H, WELL.x + WELL_H, WELL.z + WELL_H], "foot": {},
		"heads": [R(WELL.x - kq, WELL.z + kq, WELL.x + kq, WELL.z + kq + 0.05), R(WELL.x - kq - 0.05, WELL.z - kq, WELL.x - kq, WELL.z + kq), R(WELL.x + kq + 0.3, WELL.z - kq, WELL.x + kq + 0.35, WELL.z + kq)]}
	WL.append("V")
	channel(Vector3(-2.05, 0, VZ1 - 0.02), Vector3(-2.05, 0, WELL.z + WELL_R + 0.05)); channel(Vector3(WELL.x - WELL_R - 0.05, 0, -20.8), Vector3(VX0 + 0.02, 0, -20.8))
	var ax := WELL + Vector3(0, 1.15, BUCKET.z)      # the middle of the windlass's axle, which lies along x
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		turned(WELL, [[WELL_R, 0.0], [WELL_R, 0.2], [WELL_R - 0.1, 0.2], [WELL_R - 0.1, 0.0]], "stone", 28, both)      # the round kerb
		turned(WELL, [[WELL_R + 0.06, 0.0], [WELL_R + 0.06, 0.05], [WELL_R, 0.05]], "shade", 28, both)
		for e in [-1.0, 1.0]:      # the two posts, each on a stone foot
			var pp := WELL + Vector3(e * (WELL_R + 0.16), 0, BUCKET.z)
			blk(pp + Vector3(-0.13, 0, -0.13), pp + Vector3(0.13, 0.12, 0.13), "shade", both)
			blk(pp + Vector3(-0.07, 0.12, -0.07), pp + Vector3(0.07, 1.3, 0.07), "wood", both)
			blk(pp + Vector3(-0.09, 1.07, -0.09), pp + Vector3(0.09, 1.23, 0.09), "gold", both)
		var axle := Node3D.new(); axle.position = ax; both.add_child(axle)
		var a1 := cyl(Vector3.ZERO, 0.035, 0.035, (WELL_R + 0.3) * 2.0, pal("gold", flat), 10, axle); a1.rotation.z = PI * 0.5; a1.position = Vector3.ZERO
		var dr := cyl(Vector3.ZERO, 0.09, 0.09, 0.62, pal("wood", flat), 12, axle); dr.rotation.z = PI * 0.5; dr.position = Vector3(BUCKET.x, 0, 0)
		for i in 5:
			var rc := cyl(Vector3.ZERO, 0.1, 0.1, 0.045, pal("rope", flat), 12, axle); rc.rotation.z = PI * 0.5; rc.position = Vector3(BUCKET.x - 0.1 + 0.05 * i, 0, 0)
		var hw := Node3D.new(); hw.position = Vector3(WELL_R + 0.33, 0, 0); axle.add_child(hw)      # the handwheel, outside the east post
		prop_model("winch_wheel", hw, 0.0, 0.0, twin, false, "wood:wood,rope:linen,gold:gold,stone:stone").scale = Vector3.ONE * 1.25
		var bk := Node3D.new(); bk.position = WELL + Vector3(BUCKET.x, 0.3, BUCKET.z); both.add_child(bk)      # the bucket: its foot is at this node
		turned(Vector3.ZERO, [[0.0, 0.0], [0.12, 0.0], [0.155, 0.27], [0.135, 0.27], [0.11, 0.03], [0.0, 0.03]], "wood", 14, bk)
		for by in [0.05, 0.2]: turned(Vector3(0, by, 0), [[0.128 + by * 0.13, 0.0], [0.132 + by * 0.13, 0.03]], "gold", 14, bk)
		var bail := TorusMesh.new(); bail.inner_radius = 0.135; bail.outer_radius = 0.15; bail.rings = 16; bail.ring_segments = 6
		var bl := prim(bail, Vector3(0, 0.27, 0), pal("gold", flat), bk); bl.rotation.x = PI * 0.5; bl.scale = Vector3(1, 1, 0.9)
		var rope := cyl(Vector3.ZERO, 0.014, 0.014, 1.0, pal("rope", flat), 6, both)      # the rope: its length follows the bucket
		var ck := _crank_handle(bk); ck.position = Vector3(0.02, 0.2, 0.0); ck.rotation = Vector3(0.0, 0.6, 1.25); ck.scale = Vector3.ONE * 0.9
		ck.visible = twin      # the handle of the next sluice: it lies in the bucket only in the water
		N["bucket_m" if twin else "bucket"] = bk; N["axle_m" if twin else "axle"] = axle; N["rope_m" if twin else "rope"] = rope; N["bcrank_m" if twin else "bcrank"] = ck
	_bucket_set(0.3)
	# the next sluice, on the west side, and the post that works it: a square bronze socket on top, nothing in it
	sluice("s3", Vector3(VX0 + 0.3, 0, -20.8), true, 0.5)
	blk(POST3 + Vector3(-0.16, 0, -0.16), POST3 + Vector3(0.16, 0.1, 0.16), "shade"); blk(POST3 + Vector3(-0.11, 0.1, -0.11), POST3 + Vector3(0.11, 0.86, 0.11), "stone")
	var gr := Node3D.new(); gr.position = POST3 + Vector3(0, 0.86, 0); add_child(gr); _gear(gr, 0.17, 14, 0.05); N["post3_gear"] = gr
	blk(POST3 + Vector3(-0.035, 0.91, -0.035), POST3 + Vector3(0.035, 0.97, 0.035), "gold")
	var c3 := _crank_handle(gr); c3.position = Vector3(0, 0.1, 0); c3.rotation = Vector3(-PI * 0.5, 0, 0); c3.visible = false; N["crank3"] = c3
	wall(VX0, VZ0, VX1, VZ0 + 0.3, 2.3)      # the north wall
	wall(VX0, VZ0 + 0.3, VX0 + 0.3, -21.6, 2.3); wall(VX0, -20.0, VX0 + 0.3, VZ1, 2.3)      # the west wall, either side of the sluice
	parapet(Vector3(VX1 - 0.1, 0, VZ0 + 0.4), Vector3(VX1 - 0.1, 0, VZ1 - 0.1)); parapet(Vector3(-1.3, 0, VZ1 - 0.1), Vector3(VX1 - 0.1, 0, VZ1 - 0.1)); parapet(Vector3(VX0 + 0.4, 0, VZ1 - 0.1), Vector3(-2.8, 0, VZ1 - 0.1))
	stele("stele_4", Vector3(-0.1, 0, VZ1 - 0.75), 0.0, ["I threw the handle\ndown the well.", "The well kept it.\nIt keeps whatever touches it."])
	tree(Vector3(VX0 + 0.9, 0, VZ0 + 0.95), 1.1); urn(Vector3(-0.1, 0, VZ0 + 0.8), 1.0); urn(Vector3(-4.6, 0, VZ1 - 0.8), 0.8, "rose")

## the bucket hangs with its foot y over the water; the rope follows it
func _bucket_set(y: float) -> void:
	for sfx in ["", "_m"]:
		var bk: Node3D = N["bucket" + sfx]; bk.position.y = y
		var rope: MeshInstance3D = N["rope" + sfx]
		var top := 1.15; var bot := y + 0.42
		rope.position = Vector3(bk.position.x, (top + bot) * 0.5, bk.position.z); rope.scale = Vector3(1, maxf(top - bot, 0.01), 1)
		(N["axle" + sfx] as Node3D).rotation.x = (0.3 - y) * 9.0

## I.5 the fountain. The channel runs into a basin at the foot of a plain wall, and ends there. In the water the wall
## has an arch
func _fountain() -> void:
	floor_plain(FX1, -21.5, VX0, -20.1, 0.0); channel(Vector3(FX1, 0, -20.8), Vector3(VX0, 0, -20.8))
	_pool_court(FX0, FZ0, FX1, FZ1, FPX0, FPZ0, FPX1, FPZ1, "stone", "PoolSky5", true)
	tile_hole = Rect2(FPX0 - 0.08, FPZ0 - 0.5, FPX1 - FPX0 + 0.16, FPZ1 - FPZ0 + 0.58); tiles(FX0, FPZ0, FX1, FZ1, 1.0); tile_hole = Rect2()
	glass(FPX0, FPZ0, FPX1, FPZ1)
	var ledge := R(FPX0 - 0.3, FPZ0 + 0.15, FPX1 + 0.3, FPZ0 + 0.42)
	W["F"] = {"r": [FPX0, FPZ0, FPX1, FPZ1], "heads": [ledge, R(FX0 + 0.45, FPZ0 + 0.15, FPX0 - 0.3, FZ1 - 0.45), R(FPX1 + 0.3, FPZ0 + 0.15, FX1 - 0.45, FZ1 - 0.45)],
		"foot": {"l": ledge, "w": R(FX0 + 0.45, FPZ0 + 0.15, FPX0 - 0.3, FZ1 - 0.45), "e": R(FPX1 + 0.3, FPZ0 + 0.15, FX1 - 0.45, FZ1 - 0.45), "arch": R(ARCH_X - 0.25, FZ0 + 0.2, ARCH_X + 0.25, FPZ0 + 0.42)}}
	WL.append("F")
	channel(Vector3(FX1 + 0.02, 0, -20.8), Vector3(ARCH_X + 0.5, 0, -20.8)); channel(Vector3(ARCH_X, 0, -20.3), Vector3(ARCH_X, 0, FPZ1 + 0.1))
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		blk(Vector3(FPX0, 0, FPZ0), Vector3(FPX1, 0.05, FPZ0 + 0.55), "stone", both).material_override = pal("stone", flat)      # the ledge along the wall's foot
		# the wall, with the opening of the arch in it
		for seg in [[FX0, ARCH_X - ARCH_W], [ARCH_X + ARCH_W, FX1]]:
			var wl := blk(Vector3(seg[0], 0, FZ0), Vector3(seg[1], FWALL_H, FZ0 + 0.3), "stone", both)
			if twin: wl.material_override = under_mat(Color("c9b8a0"))
		var gw := CSGBox3D.new(); gw.size = Vector3(ARCH_W * 2.0, FWALL_H - ARCH_Y, 0.3); gw.position = Vector3(ARCH_X, (FWALL_H + ARCH_Y) * 0.5, FZ0 + 0.15); gw.material = under_mat(Color("c9b8a0")) if twin else pal("stone")
		var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = ARCH_W; gc.height = 0.5; gc.sides = 28
		gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -(FWALL_H - ARCH_Y) * 0.5, 0); gc.material = under_mat(Color("b9ab98")) if twin else pal("shade"); gw.add_child(gc); both.add_child(gw)
		if twin:
			blk(Vector3(FX0 - 0.04, FWALL_H, FZ0 - 0.04), Vector3(FX1 + 0.04, FWALL_H + 0.06, FZ0 + 0.34), "stone", both).material_override = under_mat(Color("b9ab98"))
			arch_band(Vector3(ARCH_X, ARCH_Y, FZ0 + 0.3), ARCH_W, ARCH_W + 0.09, 0.014); bb_end("shade", both).material_override = under_mat(Color("a89a8c"))
			blk(Vector3(ARCH_X - 0.5, 0, FZ0 + 0.13), Vector3(ARCH_X + 0.5, 0.012, FZ0 + 0.3), "shade", both).material_override = under_mat(Color("9d93a8"))      # the channel goes on through the arch
			blk(Vector3(ARCH_X - ARCH_W - 0.02, 0, FZ0 + 0.115), Vector3(ARCH_X + ARCH_W + 0.02, ARCH_Y + ARCH_W + 0.02, FZ0 + 0.13), "shade", both).material_override = under_mat(Color("57527a"))      # and the dark of the passage behind it
		# the spout: a bronze mask over a small shelf, dry
		var sx := ARCH_X + 1.5
		blk(Vector3(sx - 0.22, 0.78, FZ0 + 0.3), Vector3(sx + 0.22, 0.84, FZ0 + 0.48), "shade", both)
		ball(Vector3(sx, 1.12, FZ0 + 0.31), 0.12, pal("gold", flat), both); cyl(Vector3(sx, 1.02, FZ0 + 0.38), 0.03, 0.02, 0.06, pal("gold", flat), 8, both)
	cornice(FX0, FZ0, FX1, FZ0 + 0.3, FWALL_H, 0.04, 0.06)
	blk(Vector3(FX0 - 0.03, 0, FZ0 + 0.27), Vector3(FPX0, 0.14, FZ0 + 0.33), "shade"); blk(Vector3(FPX1, 0, FZ0 + 0.27), Vector3(FX1 + 0.03, 0.14, FZ0 + 0.33), "shade")
	# the plug: the opening walled up and plastered over, flush with the wall. Eight courses and the round of the arch
	var plug := Node3D.new(); add_child(plug); N["plug5"] = plug
	for row in 4:
		for col in 2:
			var pb := blk(Vector3(-ARCH_W * 0.5, -ARCH_Y * 0.125, -0.15), Vector3(ARCH_W * 0.5, ARCH_Y * 0.125, 0.15), "stone", plug)
			pb.position = Vector3(ARCH_X + (col - 0.5) * ARCH_W, ARCH_Y * (row + 0.5) / 4.0, FZ0 + 0.15)
	var pc := cyl(Vector3.ZERO, ARCH_W - 0.002, ARCH_W - 0.002, 0.3, pal("stone"), 28, plug); pc.rotation.x = PI * 0.5; pc.position = Vector3(ARCH_X, ARCH_Y, FZ0 + 0.15)
	wall(FX0, FZ0 + 0.3, FX0 + 0.3, FZ1, 2.3)      # the west wall
	parapet(Vector3(FX1 - 0.1, 0, FZ0 + 0.4), Vector3(FX1 - 0.1, 0, -21.5)); parapet(Vector3(FX1 - 0.1, 0, -20.1), Vector3(FX1 - 0.1, 0, FZ1 - 0.1)); parapet(Vector3(FX0 + 0.4, 0, FZ1 - 0.1), Vector3(FX1 - 0.1, 0, FZ1 - 0.1))
	stele("stele_5", Vector3(FX1 - 0.75, 0, FZ1 - 0.75), 0.0, ["I built that wall in one night.", "The water has not learned it.\nIt still shows what was there."])
	_look_add("", Vector3(ARCH_X + 1.5, 0.05, FZ0 + 0.3), 1.3, ["the spout is dry", "a hand's depth of water is left under it"])
	_look_add("fwall", Vector3(ARCH_X - 1.6, 0.05, FZ0 + 0.3), 1.8, ["a wall of plain stone", "in the water this wall has an arch"])
	cypress(Vector3(FX0 + 0.8, 0, FZ1 - 0.7), 2.5); urn(Vector3(FX0 + 0.8, 0, -21.0), 1.0, "rose")

## I.6 the forecourt of the atrium. A shallow pool, the largest water so far, with a row of statues of her along its
## north rim and another along its west rim. One plinth is empty. In the water none is: a statue stands there
func _forecourt() -> void:
	floor_plain(ARCH_X - 0.8, GZ1, ARCH_X + 0.8, FZ0, 0.0); channel(Vector3(ARCH_X, 0, GZ1), Vector3(ARCH_X, 0, FZ0))
	_pool_court(GX0, GZ0, GX1, GZ1, GPX0, GPZ0, GPX1, GPZ1, "stone", "PoolSky6")
	tile_hole = Rect2(GPX0 - 0.08, GPZ0 - 0.08, GPX1 - GPX0 + 0.16, GPZ1 - GPZ0 + 0.16); tiles(GX0, GZ0, GX1, GZ1, 1.0); tile_hole = Rect2()
	glass(GPX0, GPZ0, GPX1, GPZ1)
	var qn := R(GX0 + 0.8, GZ0 + 0.8, GX1 - 0.45, ROW_Z - 0.6); var qw := R(GX0 + 0.8, GZ0 + 0.8, ROWW_X - 0.6, GZ1 - 0.45)
	W["G"] = {"r": [GPX0, GPZ0, GPX1, GPZ1], "heads": [qn, qw], "foot": {"n": qn, "w": qw}}
	WL.append("G")
	channel(Vector3(ARCH_X, 0, GZ1 - 0.02), Vector3(ARCH_X, 0, GPZ1 + 0.1)); channel(Vector3(GX0 + 1.25, 0, GZ1 - 1.0), Vector3(ARCH_X - 0.5, 0, GZ1 - 1.0)); channel(Vector3(GX0 + 1.25, 0, DOOR6.z), Vector3(GX0 + 1.25, 0, GZ1 - 0.5)); channel(Vector3(GX0 + 0.3, 0, DOOR6.z), Vector3(GX0 + 1.75, 0, DOOR6.z))
	var poses := ["calm", "pray", "", "mourn"]
	for both in [self, mroot]:
		for i in ROW_X.size():
			var st := her_plinth(Vector3(ROW_X[i], 0, ROW_Z), 0.0, poses[i] if i != HERS else ("pray" if both == mroot else ""), both)
			if i == HERS and both == mroot: N["place6_m"] = st      # the one that stands only in the water: in her place
		for i in ROWW_Z.size(): her_plinth(Vector3(ROWW_X, 0, ROWW_Z[i]), PI * 0.5, ["mourn", "calm", "pray"][i], both)
	wall(GX0, GZ0, GX1, GZ0 + 0.3, 2.6)      # the north wall
	wall(GX0, GZ0 + 0.3, GX0 + 0.3, DOOR6.z - 0.94, 2.6); wall(GX0, DOOR6.z + 0.94, GX0 + 0.3, GZ1, 2.6)      # the west wall, with the great door in it
	blk(Vector3(GX0, 2.35, DOOR6.z - 0.94), Vector3(GX0 + 0.3, 2.6, DOOR6.z + 0.94), "stone"); cornice(GX0, DOOR6.z - 0.94, GX0 + 0.3, DOOR6.z + 0.94, 2.6, 0.04, 0.06)
	sluice("door6", DOOR6, true, 0.6, 2.1)
	parapet(Vector3(GX1 - 0.1, 0, GZ0 + 0.4), Vector3(GX1 - 0.1, 0, GZ1 - 0.1)); parapet(Vector3(ARCH_X + 0.8, 0, GZ1 - 0.1), Vector3(GX1 - 0.1, 0, GZ1 - 0.1)); parapet(Vector3(GX0 + 0.4, 0, GZ1 - 0.1), Vector3(ARCH_X - 0.8, 0, GZ1 - 0.1))
	stele("stele_6", Vector3(GX1 - 0.75, 0, GZ1 - 0.8), 0.0, ["I left one place empty.\nI knew who it was for.", "The door counts them.\nIt opens when none is missing."])
	for i in ROW_X.size():
		if i != HERS: _look_add("", Vector3(ROW_X[i], 0, ROW_Z), 1.9, ["one of his. veiled, like all of them", "it stands where he put it"])
	urn(Vector3(GX1 - 0.8, 0, GZ0 + 1.0), 1.0)

## I.7 the atrium. In its middle a great round basin, three steps deep, dry: all three waters of the house came
## together here. Three dry channels come in from three shut doors. On the north side, at the top of a stair, the
## Gate: barred, tied, and covered with the one cloth. Two lamps burn beside it by day
func _atrium() -> void:
	var n0 := get_child_count()
	_pool_court(UX0, UZ0, UX1, UZ1, UC.x - UH, UC.z - UH, UC.x + UH, UC.z + UH, "stone", "PoolSkyU")
	for c in get_children().slice(n0):      # this opening holds a dry basin, not a pool: no kerb, and nothing to see below
		var mi := c as MeshInstance3D
		if mi == null: continue
		if mi.name == "PoolSkyU": mi.visible = false
		elif mi.mesh is BoxMesh and absf((mi.mesh as BoxMesh).size.y - 0.04) < 0.001 and absf(mi.position.y - 0.02) < 0.001: remove_child(mi); mi.queue_free()
	tile_hole = Rect2(UC.x - UH, UC.z - UH, UH * 2.0, UH * 2.0); tiles(UX0, UZ0, UX1, UZ1, 1.0); tile_hole = Rect2()
	turned(UC, [[UH * 1.432, 0.006], [UR, 0.006], [UR, -0.15], [UR - 0.9, -0.15], [UR - 0.9, -0.3], [UR - 1.8, -0.3], [UR - 1.8, -0.45], [0.0, -0.45]], "stone", 48)
	turned(UC, [[UR + 0.22, 0.01], [UR, 0.01]], "shade", 48); turned(UC, [[UH * 1.432, 0.008], [UH * 1.432 - 0.1, 0.008]], "shade", 48)
	cyl(UC + Vector3(0, -0.45, 0), 0.3, 0.3, 0.012, pal("gold"), 24)      # the drain in its middle
	for a in 12: blk(Vector3(-0.012, 0, 0.45), Vector3(0.012, 0.004, UR - 1.95), "shade").transform = Transform3D(Basis(Vector3.UP, TAU * a / 12.0), UC + Vector3(0, -0.449, 0)) * Transform3D(Basis(), Vector3(0, 0, (0.45 + UR - 1.95) * 0.5))
	# the podium, the stair, the Gate
	var gx := UC.x
	blk(Vector3(gx - 3.0, 0, UZ0 + 0.3), Vector3(gx + 3.0, POD_H, POD_Z), "stone"); blk(Vector3(gx - 3.04, 0, UZ0 + 0.3), Vector3(gx + 3.04, 0.16, POD_Z + 0.04), "shade")
	cornice(gx - 3.0, UZ0 + 0.3, gx + 3.0, POD_Z, POD_H - 0.06, 0.04, 0.06)
	for k in 7:
		var z0 := POD_Z + 0.3 * k
		blk(Vector3(gx - 1.2, 0, z0), Vector3(gx + 1.2, POD_H - 0.15 * (k + 1), z0 + 0.3), "stone")
		blk(Vector3(gx - 1.2, POD_H - 0.15 * (k + 1) - 0.03, z0 + 0.3), Vector3(gx + 1.2, POD_H - 0.15 * (k + 1), z0 + 0.32), "shade")
	for e in [-1.0, 1.0]:      # the cheeks of the stair, each ending in a block for a lamp
		blk(Vector3(gx + e * 1.2 - 0.14 * (1.0 - e), 0, POD_Z), Vector3(gx + e * 1.2 + 0.14 * (1.0 + e), 0.5, STAIR_Z - 0.3), "stone")
		blk(Vector3(gx + e * 1.34 - 0.22, 0, STAIR_Z - 0.5), Vector3(gx + e * 1.34 + 0.22, 0.72, STAIR_Z - 0.06), "stone"); blk(Vector3(gx + e * 1.34 - 0.25, 0.72, STAIR_Z - 0.53), Vector3(gx + e * 1.34 + 0.25, 0.78, STAIR_Z - 0.03), "shade")
	wall(UX0, UZ0, gx - 1.95, UZ0 + 0.3, 3.2); wall(gx + 1.95, UZ0, -20.44, UZ0 + 0.3, 3.2); wall(-18.56, UZ0, UX1, UZ0 + 0.3, 3.2)      # the north wall, with the Gate and the door of the Spring in it
	blk(Vector3(-20.44, 2.35, UZ0), Vector3(-18.56, 3.2, UZ0 + 0.3), "stone")
	for e in [-1.0, 1.0]:      # the piers of the Gate
		var px: float = gx + e * 1.7
		blk(Vector3(px - 0.3, POD_H, UZ0 + 0.2), Vector3(px + 0.3, 5.0, UZ0 + 0.8), "stone"); blk(Vector3(px - 0.34, POD_H, UZ0 + 0.16), Vector3(px + 0.34, POD_H + 0.2, UZ0 + 0.84), "shade")
		blk(Vector3(px - 0.34, 4.86, UZ0 + 0.16), Vector3(px + 0.34, 5.0, UZ0 + 0.84), "shade"); ball(Vector3(px, 5.72, UZ0 + 0.5), 0.2, pal("gold")); blk(Vector3(px - 0.2, 5.36, UZ0 + 0.3), Vector3(px + 0.2, 5.54, UZ0 + 0.7), "stone")
	var gw := CSGBox3D.new(); gw.size = Vector3(4.0, 1.9, 0.6); gw.position = Vector3(gx, 4.4 + 0.02, UZ0 + 0.5); gw.material = pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = 1.4; gc.height = 0.8; gc.sides = 36
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -0.95, 0); gc.material = pal("shade"); gw.add_child(gc); add_child(gw)
	cornice(gx - 2.0, UZ0 + 0.2, gx + 2.0, UZ0 + 0.8, 5.36, 0.05, 0.08)
	blk(Vector3(gx - 1.4, POD_H, UZ0 + 0.36), Vector3(gx + 1.4, 3.46, UZ0 + 0.44), "gold")      # the leaves, of polished bronze, under the cloth
	var lf := cyl(Vector3.ZERO, 1.4, 1.4, 0.08, pal("gold"), 36); lf.rotation.x = PI * 0.5; lf.position = Vector3(gx, 3.46, UZ0 + 0.4)
	blk(Vector3(gx - 1.75, 2.5, UZ0 + 0.46), Vector3(gx + 1.75, 2.72, UZ0 + 0.6), "dark")      # the bar
	# the cloth: it hangs in folds from a cord strung between the piers, down to a hand above the podium. The crown
	# of the bronze leaves shows over it
	var veil := cloth(Color("d9553a"), Color("a63a26"), 0.5)
	N["veil"] = drape(Vector3(gx, 4.56, UZ0 + 0.92), 3.5, 4.56 - POD_H - 0.22, 20, veil)
	var rod := cyl(Vector3.ZERO, 0.025, 0.025, 3.7, pal("gold"), 8); rod.rotation.z = PI * 0.5; rod.position = Vector3(gx, 4.58, UZ0 + 0.9)
	for ry in [2.25, 3.45]:      # the cords that hold it shut: they go round the piers to the far side
		blk(Vector3(gx - 2.02, ry, UZ0 + 1.0), Vector3(gx + 2.02, ry + 0.035, UZ0 + 1.03), "rope")
		for e in [-1.0, 1.0]: blk(Vector3(gx + e * 2.02 - 0.017, ry, UZ0 + 0.3), Vector3(gx + e * 2.02 + 0.017, ry + 0.035, UZ0 + 1.03), "rope")
	lantern(Vector3(gx - 2.45, POD_H, POD_Z - 0.45), 5, 1.0); lantern(Vector3(gx + 2.45, POD_H, POD_Z - 0.45), 6, -1.0)      # the two lamps that burn by day
	# the doors of the three wings, shut: the Cistern to the west, the Spring in the north wall, the Lamps to the south
	wall(UX0, UZ0 + 0.3, UX0 + 0.3, UC.z - 0.94, 3.2); wall(UX0, UC.z + 0.94, UX0 + 0.3, UZ1, 3.2)
	blk(Vector3(UX0, 2.35, UC.z - 0.94), Vector3(UX0 + 0.3, 3.2, UC.z + 0.94), "stone")
	sluice("doorW", Vector3(UX0 + 0.15, 0, UC.z), true, 0.6, 2.1); sluice("doorN", Vector3(-19.5, 0, UZ0 + 0.15), false, 0.6, 2.1); sluice("doorS", Vector3(-30.0, 0, UZ1 - 0.2), false, 0.6, 1.5)
	parapet(Vector3(UX0 + 0.4, 0, UZ1 - 0.1), Vector3(-30.95, 0, UZ1 - 0.1)); parapet(Vector3(-29.05, 0, UZ1 - 0.1), Vector3(UX1 - 0.1, 0, UZ1 - 0.1))
	parapet(Vector3(UX1 - 0.1, 0, GZ1 + 0.1), Vector3(UX1 - 0.1, 0, UZ1 - 0.1))
	wall(UX1 - 0.3, UZ0 + 0.3, UX1, GZ0, 3.2)
	channel(Vector3(UX0 + 0.3, 0, UC.z), Vector3(UC.x - UR - 0.2, 0, UC.z)); channel(Vector3(UC.x + UR + 0.2, 0, DOOR6.z), Vector3(UX1, 0, DOOR6.z))
	channel(Vector3(-19.5, 0, UZ0 + 0.3), Vector3(-19.5, 0, -37.4)); channel(Vector3(-30.0, 0, UZ1 - 0.2), Vector3(-30.0, 0, -27.4))
	stele("stele_7", Vector3(gx + 2.2, 0, STAIR_Z + 0.5), 0.0, ["This one I could not turn,\nor sink, or blind.\nSo I covered it.", "A pool this size shows too much.\nI let it run dry."])
	_look_add("ubasin", UC + Vector3(UR - 0.4, 0, 0.0), 0.3, ["no water. no one", "three channels come in here, and one goes down to the sea"])
	_look_add("", Vector3(gx - 2.45, POD_H, POD_Z - 0.45), 1.4, ["a lamp, burning by day", "its light falls where the water would be"])
	for dl in [[Vector3(UX0 + 0.3, 0, UC.z), "the channel of the cistern comes in under it"], [Vector3(-19.5, 0, UZ0 + 0.3), "the channel of the spring comes in under it"], [Vector3(-30.0, 0, UZ1 - 0.2), "the channel of the lamps comes in under it"]]:
		_look_add("", dl[0], 1.6, ["a door, shut", dl[1]])
	urn(Vector3(UX1 - 0.9, 0, UZ1 - 0.9), 1.0); urn(Vector3(UX0 + 0.9, 0, UZ1 - 0.9), 1.0, "rose"); cypress(Vector3(UX0 + 0.9, 0, UZ0 + 1.0), 2.8); cypress(Vector3(UX1 - 0.9, 0, UZ0 + 1.0), 2.8)

# ---------------------------------------------------------------- what can be tapped, and where she can walk
func _things() -> void:
	var hub: Vector3 = N["hub1"]; var hn: Vector3 = N["hubn1"]
	objs["wheel1"] = {"at": Vector3(hub.x, -hub.y, hub.z), "stand": Vector3(0, 0, MOLE_A - 0.45), "mark": false, "water": "H", "rstand": hub + hn * 0.56,
		"hits": [Vector3(hub.x, -hub.y - 0.4, hub.z), Vector3(hub.x, -0.1, hub.z), Vector3(hub.x, 0.2, hub.z), Vector3(hub.x, hub.y + 0.3, hub.z)]}
	var h2: Vector3 = N["hub2"]; var n2: Vector3 = N["hubn2"]
	objs["wheel2"] = {"at": Vector3(h2.x, -h2.y, h2.z), "stand": Vector3(-2.3, 0, TG_REAL + 0.5), "mark": false, "water": "T", "rstand": h2 + n2 * 0.56,
		"hits": [Vector3(h2.x, -h2.y - 0.4, h2.z), Vector3(h2.x, -0.1, h2.z), Vector3(h2.x, 0.2, h2.z), Vector3(h2.x, h2.y + 0.3, h2.z)]}
	var ax := WELL + Vector3(0, 1.15, BUCKET.z)
	objs["well"] = {"at": ax + Vector3(WELL_R + 0.33, 0, 0), "stand": WELL + Vector3(WELL_R + 0.33 + 0.56, 0, BUCKET.z), "mark": false,
		"hits": [ax + Vector3(-WELL_R - 0.2, 0, 0), ax + Vector3(WELL_R + 0.33, 0, 0), ax + Vector3(WELL_R + 0.33, -0.5, 0)]}
	objs["bucket"] = {"at": WELL + Vector3(BUCKET.x, 0.75, BUCKET.z), "stand": WELL + Vector3(-WELL_R - 0.22, 0, 0.18), "mark": false, "hits": [WELL + Vector3(BUCKET.x, 0.3, BUCKET.z), WELL + Vector3(BUCKET.x, 0.75, BUCKET.z)]}
	done["bucket"] = true      # nothing to take from it until the well has given the handle up
	objs["post3"] = {"at": POST3 + Vector3(0, 0.95, 0), "stand": POST3 + Vector3(0, 0, -0.52), "mark": false, "hits": [POST3 + Vector3(0, 0.1, 0), POST3 + Vector3(0, 1.0, 0)]}
	objs["arch5"] = {"at": Vector3(ARCH_X, -1.0, FZ0 + 0.3), "stand": Vector3(ARCH_X, 0, FPZ0 + 0.28), "mark": false, "water": "F", "rstand": Vector3(ARCH_X, 0, FZ0 + 0.36),
		"hits": [Vector3(ARCH_X, -0.15, FZ0 + 0.3), Vector3(ARCH_X, -ARCH_Y - 0.4, FZ0 + 0.3)]}
	objs["wall5"] = {"at": Vector3(ARCH_X, 1.0, FZ0 + 0.3), "stand": Vector3(ARCH_X, 0, FPZ0 + 0.3), "mark": false, "hits": [Vector3(ARCH_X, 0.25, FZ0 + 0.3), Vector3(ARCH_X, ARCH_Y + 0.3, FZ0 + 0.3)]}
	var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
	objs["place6w"] = {"at": pl + Vector3(0, -1.0, 0), "stand": pl + Vector3(0, 0, -0.72), "mark": false, "water": "G", "rstand": pl + Vector3(0.75, 0, -0.72),
		"hits": [pl + Vector3(0, -0.2, 0), pl + Vector3(0, -1.9, 0)]}
	_wing_things()
	objs["gate"] = {"at": Vector3(UC.x, POD_H + 1.6, UZ0 + 0.9), "stand": Vector3(UC.x, 0, UZ0 + 1.5), "mark": false, "hits": [Vector3(UC.x, POD_H + 0.3, UZ0 + 0.9), Vector3(UC.x, POD_H + 3.4, UZ0 + 0.9)]}
	objs["place6"] = {"at": pl + Vector3(0, 0.3, 0), "stand": pl + Vector3(0, 0, -0.72), "mark": false, "hits": [pl + Vector3(0, 0.02, 0), pl + Vector3(0, 0.5, 0)]}

func _nav() -> void:
	rects["Hq"] = R(HX0 + 0.45, HZ0 + 0.75, HX1 - 0.45, BZ0 - 0.3)      # the quay
	rects["Hw"] = R(HX0 + 0.45, HZ0 + 0.75, BX0 - 0.3, HZ1 - 0.45); rects["He"] = R(BX1 + 0.3, HZ0 + 0.75, HX1 - 0.45, HZ1 - 0.45); rects["Hs"] = R(HX0 + 0.45, BZ1 + 0.3, HX1 - 0.45, HZ1 - 0.45)
	rects["Hm"] = R(-MOLE_W + 0.2, BZ0 - 0.35, MOLE_W - 0.2, MOLE_A - 0.3)      # the stub of the mole
	rects["S1"] = R(-0.3, HZ0 - 0.6, 0.3, HZ0 + 0.8, false)      # through the first sluice
	solids.append(Vector3(HERPL.x, HERPL.z, 0.42))
	rects["P"] = R(-0.85, TZ1 - 0.45, 0.85, HZ0 - 0.55)      # the causeway
	rects["Ts"] = R(TWX0, TZ1 - 0.85, TX1 - 0.5, TZ1 - 0.4); rects["Te"] = R(TPX1 + 0.35, TZ0 + 0.7, TX1 - 0.5, TZ1 - 0.4)
	rects["Tw1"] = R(TWX0, TG_REAL + 0.2, TWX1, TZ1 - 0.4); rects["Tg"] = R(TWX0, TG_REAL - 0.2, TWX1, TG_REAL + 0.2, false); rects["Tw2"] = R(TWX0, TZ0 + 0.65, TWX1, TG_REAL - 0.2)
	rects["S2"] = R(-2.3, TZ0 - 0.3, -1.8, TZ0 + 0.65, false); rects["C2"] = R(-2.4, VZ1 - 0.45, -1.7, TZ0 - 0.3)
	solids.append(Vector3(WHEEL2.x, WHEEL2.z, 0.5))
	var k0 := WELL_R + 0.2      # she keeps this far from the middle of the well
	rects["Vs"] = R(VX0 + 0.45, WELL.z + k0, VX1 - 0.45, VZ1 - 0.45); rects["Vn"] = R(VX0 + 0.45, VZ0 + 0.75, VX1 - 0.45, WELL.z - k0 - 0.3)
	rects["Vw"] = R(VX0 + 0.45, VZ0 + 0.75, WELL.x - k0, VZ1 - 0.45); rects["Ve"] = R(WELL.x + k0 + 0.3, VZ0 + 0.75, VX1 - 0.45, VZ1 - 0.45)
	rects["S3"] = R(VX0 - 0.4, -21.05, VX0 + 0.45, -20.55, false); rects["C3"] = R(FX1 - 0.45, -21.05, VX0 - 0.4, -20.55)
	solids.append(Vector3(POST3.x, POST3.z, 0.3))
	rects["Fe"] = R(FPX1 + 0.3, FPZ0 + 0.15, FX1 - 0.45, FZ1 - 0.45); rects["Fs"] = R(FX0 + 0.45, FPZ1 + 0.3, FX1 - 0.45, FZ1 - 0.45); rects["Fw"] = R(FX0 + 0.45, FPZ0 + 0.15, FPX0 - 0.3, FZ1 - 0.45)
	rects["Fl"] = R(FPX0 - 0.3, FPZ0 + 0.15, FPX1 + 0.3, FPZ0 + 0.42); rects["F5"] = R(ARCH_X - 0.25, GZ1 - 0.5, ARCH_X + 0.25, FPZ0 + 0.42, false)
	rects["Gs"] = R(GX0 + 0.8, GPZ1 + 0.3, GX1 - 0.45, GZ1 - 0.45); rects["Ge"] = R(GPX1 + 0.35, GZ0 + 0.8, GX1 - 0.45, GZ1 - 0.45)
	rects["Gw"] = R(GX0 + 0.8, GZ0 + 0.8, ROWW_X - 0.6, GZ1 - 0.45); rects["Gn"] = R(GX0 + 0.8, GZ0 + 0.8, GX1 - 0.45, ROW_Z - 0.6)
	rects["D6"] = R(GX0 - 0.7, DOOR6.z - 0.25, GX0 + 0.8, DOOR6.z + 0.25, false); rects["D6"].x0 = UX1 - 0.7
	var kb := UH + 0.25      # she keeps this far from the middle of the dry basin
	rects["Us"] = R(UX0 + 0.8, UC.z + kb, UX1 - 0.45, UZ1 - 0.45); rects["Un"] = R(UX0 + 0.8, STAIR_Z + 0.25, UX1 - 0.45, UC.z - kb)
	rects["Uw"] = R(UX0 + 0.8, STAIR_Z + 0.25, UC.x - kb, UZ1 - 0.45); rects["Ue"] = R(UC.x + kb, STAIR_Z + 0.25, UX1 - 0.45, UZ1 - 0.45)
	rects["Unw"] = R(UX0 + 0.8, UZ0 + 0.8, UC.x - 3.5, STAIR_Z + 0.25); rects["Une"] = R(UC.x + 3.5, UZ0 + 0.8, UX1 - 0.75, STAIR_Z + 0.25)
	rects["Ust"] = R(UC.x - 0.85, POD_Z - 0.05, UC.x + 0.85, STAIR_Z + 0.25); rects["Upod"] = R(UC.x - 2.0, UZ0 + 1.25, UC.x + 2.0, POD_Z - 0.05)
	ramps = [{"r": rects["Ust"], "z0": POD_Z, "z1": STAIR_Z, "y0": POD_H, "y1": 0.0}, {"r": rects["Upod"], "z0": 0.0, "z1": 1.0, "y0": POD_H, "y1": POD_H}]
	solids.append(Vector3(UC.x + 2.2, STAIR_Z + 0.5, 0.45))
	# the doors of the wings: open from the start where a wing is built
	rects["DW"] = R(UX0 - 0.7, UC.z - 0.25, UX0 + 0.8, UC.z + 0.25, wing_open["W"]); rects["DN"] = R(-19.75, UZ0 - 0.7, -19.25, UZ0 + 0.8, wing_open["N"]); rects["DS"] = R(-30.25, UZ1 - 0.65, -29.75, UZ1 + 0.7, wing_open["S"])
	for wk in [["W", "doorW"], ["N", "doorN"], ["S", "doorS"]]:
		if wing_open[wk[0]]: (N[wk[1]] as Node3D).position.y = -(float(N[wk[1] + "_h"]) + 0.25)
	_wing_nav()
	for i in ROW_X.size(): solids.append(Vector3(ROW_X[i], ROW_Z, 0.45))
	for i in ROWW_Z.size(): solids.append(Vector3(ROWW_X, ROWW_Z[i], 0.45))
	posing = true; pose_k = 1.0
	tgtL = HERPL + Vector3(0.03, 1.44 + 0.17, 0.21); tgtR = HERPL + Vector3(-0.03, 1.44 + 0.17, 0.21); a_wL = 1.0; a_wR = 1.0
	if not hand_play: _wake_now()

# ---------------------------------------------------------------- her reflection, as a second body
func _pools() -> Array:
	var out := []
	for k in WL: out.append(W[k].r)
	return out

func _water_under(sp: Vector2):
	var o := cam.project_ray_origin(sp); var d := cam.project_ray_normal(sp)
	for i in WL.size():
		var r: Array = W[WL[i]].r
		if not W[WL[i]].get("wet", true): continue      # (a tank that stands empty)
		var g := o + d * ((float(W[WL[i]].get("level", 0.0)) + 0.012 - o.y) / d.y)      # where the finger meets this water's own surface
		if g.x > r[0] and g.x < r[2] and g.z > r[1] and g.z < r[3]:
			for n in rects:      # floor that stands in the water (a mole, a quay) is floor
				if rects[n].on and in_rect(rects[n], g): return null
			return [i, Vector3(g.x, 0, g.z)]
	return null

func _near_in(r: Dictionary, p: Vector3) -> Vector3:
	return Vector3(clampf(p.x, r.x0, r.x1), 0, clampf(p.z, r.z0, r.z1))

func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()

## the footing of a water that holds the point p (or lies nearest to it, within reach): its name, or ""
func _foot_of(wid: String, p: Vector3, reach := 0.2) -> String:
	var best := ""; var bd := reach
	for n in W[wid].foot:
		var f: Dictionary = W[wid].foot[n]
		if not f.on or absf(float(f.h) - p.y) > 0.35: continue      # (a footing at another height is another place)
		var d := _flat(_near_in(f, p), p)
		if d < bd: bd = d; best = n
	return best

## the way of her reflection over a water from one place toward another: only over what the water has for it to
## stand on. If the place cannot be reached it goes as near to it as it can. {"pts": the way, "left": how far short
## of the place it ends, "h": how high over the water it then stands}
func _refl_path(wid: String, from: Vector3, to: Vector3) -> Dictionary:
	var F: Dictionary = W[wid].foot
	var a := _foot_of(wid, from, 0.9)
	if a == "": return {"pts": [], "left": 1e9, "h": 0.0, "hs": []}
	var prev := {a: ""}; var q := [a]
	while not q.is_empty():
		var c: String = q.pop_front()
		for n in F:
			if F[n].on and not prev.has(n) and absf(float(F[c].h) - float(F[n].h)) < 0.3 and portal(F[c], F[n]) != null: prev[n] = c; q.append(n)
	var goal := to; var gd := 1e9      # the place on any footing nearest to what was asked for
	for n in F:
		if not F[n].on: continue
		var c2 := _near_in(F[n], to)
		if _flat(c2, to) < gd: gd = _flat(c2, to); goal = c2
	var b := ""; var bd := 1e9; var dest := from
	for n in prev:
		var c3 := _near_in(F[n], goal)
		if _flat(c3, goal) < bd: bd = _flat(c3, goal); b = n; dest = c3
	var chain := [b]
	while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
	var pts := []; var cur := from
	for i in range(chain.size() - 1):
		var pr: Array = portal(F[chain[i]], F[chain[i + 1]])
		var mid := cur.lerp(dest, 0.5)
		var pt := Vector3(clampf(mid.x, pr[0], pr[2]), 0, clampf(mid.z, pr[1], pr[3]))
		pts.append(pt); cur = pt
	pts.append(dest)
	return {"pts": pts, "left": bd, "h": F[b].h}

## where she stands to send her reflection out on a water: the place nearest to her on the floor that touches its footing
func _head_point(wid: String) -> Vector3:
	var best := pos; var bd := 1e9
	for h in W[wid].heads:
		var c := _near_in(h, pos)
		if _flat(c, pos) < bd: bd = _flat(c, pos); best = c
	return best

## where her reflection stands when it is under her feet
func _refl_start(_wid: String) -> Vector3:
	return pos      # (a mirrored body's own height is the height of what it mirrors: the root it hangs under does the turning over)

## her reflection is taken from under her feet, to be moved on its own
func _refl_out_now(wid: String) -> Dictionary:
	if refl_out.is_empty():
		refl_key = W[wid].get("mir", "mir")
		var e0: Dictionary = H[refl_key]; H.erase(refl_key); refl_out = e0
	refl_w = wid
	return refl_out

## it walks a way, stone by stone. False if a newer order overtook this one
func _refl_walk_pts(e: Dictionary, pts: Array, h: float, my: int, speed := 1.3) -> bool:
	var hd: Node3D = e.holder
	(e.ap as AnimationPlayer).play("walk", 0.25); (e.ap as AnimationPlayer).speed_scale = clampf(speed / 1.1, 0.45, 2.3)
	for wp in pts:
		var d: Vector3 = wp - hd.position; d.y = 0.0
		if d.length() > 0.02:
			var want := atan2(d.x, d.z)
			var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, want), clampf(absf(angle_difference(hd.rotation.y, want)) * 0.22, 0.05, 0.4)).set_trans(Tween.TRANS_SINE)
		while refl_token == my and _flat(hd.position, wp) > 0.03:
			hd.position = hd.position.move_toward(Vector3(wp.x, h, wp.z), speed * get_process_delta_time())
			await get_tree().process_frame
		if refl_token != my: return false
	(e.ap as AnimationPlayer).play("idle", 0.4); (e.ap as AnimationPlayer).speed_scale = 1.0
	return true

## it is drawn back into the surface where it stands, and is under her feet again
func _refl_melt() -> void:
	if refl_out.is_empty(): return
	refl_token += 1
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	if _flat(hd.position, pos) > 0.25:
		var a := create_tween(); a.tween_property(hd, "scale:y", 0.02, 0.32).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
		await a.finished
		hd.position = pos; hd.rotation.y = yaw
		var b := create_tween(); b.tween_property(hd, "scale:y", 1.0, 0.32).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		await b.finished
	else:
		var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, yaw), 0.3).set_trans(Tween.TRANS_SINE)
		await rt.finished
	hd.position.y = pos.y; hd.scale = Vector3.ONE
	(e.ap as AnimationPlayer).play("walk" if walk_on else "idle", 0.3)
	H[refl_key] = e; refl_out = {}; refl_w = ""

## it has nowhere to go: it looks down at the water, and from side to side
func _refl_no(e: Dictionary) -> void:
	var hd: Node3D = e.holder; var y0 := hd.rotation.y
	var s := create_tween().set_trans(Tween.TRANS_SINE)
	s.tween_property(hd, "rotation:y", y0 + 0.4, 0.28); s.tween_property(hd, "rotation:y", y0 - 0.4, 0.5); s.tween_property(hd, "rotation:y", y0, 0.3)
	await s.finished

## her reflection goes toward a place on a water. She must stand where the floor touches the water's footing; if she
## does not, she goes to the nearest such place first. It starts from where it is; if it cannot get there from where
## it is but could from under her feet, it comes back to her first. True if it arrived at the place itself
func _refl_to(wid: String, to: Vector3) -> bool:
	refl_token += 1; var my := refl_token
	if not H.has(W[wid].get("mir", "mir")) and refl_out.is_empty(): return false
	if not refl_out.is_empty() and refl_w != wid: await _refl_melt(); refl_token += 1; my = refl_token
	if refl_out.is_empty():
		var hp := _head_point(wid)
		if _flat(pos, hp) > 0.3:
			if not walk_to(hp, PLAY_WALK): return false
			pending = ""
			while not route.is_empty() and refl_token == my: await get_tree().process_frame
			if refl_token != my or _flat(pos, hp) > 0.4: return false
		face_to = Vector3(to.x, 0, to.z)
		if _foot_of(wid, _refl_start(wid), 0.9) == "":      # this water has nothing for it to stand on
			await _her_no()
			return false
	else:      # it is out: could it get nearer from under her feet than from where it stands?
		var here := _refl_path(wid, (refl_out.holder as Node3D).position, to)
		var hp2 := _head_point(wid)
		if _flat(pos, hp2) < 0.4:
			var home := _refl_path(wid, _refl_start(wid), to)
			if home.left < here.left - 0.3:
				await _refl_melt(); refl_token += 1; my = refl_token
	var e := _refl_out_now(wid)
	var hd: Node3D = e.holder
	var way := _refl_path(wid, hd.position, to)
	if way.pts.is_empty() or (way.pts.size() == 1 and _flat(way.pts[0], hd.position) < 0.08 and way.left > 0.25):
		await _refl_no(e)
		if refl_token == my and _flat(hd.position, pos) < 0.25: await _refl_melt()
		return false
	if not await _refl_walk_pts(e, way.pts, way.h, my): return false
	if way.left > 0.25:
		await _refl_no(e)
		return false
	return true

## she looks down at a water that gives her reflection no footing, and shakes her head
func _her_no() -> void:
	busy = true
	var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	h.tween_property(self, "a_headp", 0.3, 0.45); h.tween_property(self, "a_hy", -0.3, 0.3); h.tween_property(self, "a_hy", 0.3, 0.45); h.tween_property(self, "a_hy", 0.0, 0.3); h.tween_property(self, "a_headp", 0.0, 0.45)
	await h.finished
	busy = false; settled.emit()

## she walks to a place by the floor's own ways, and is there
func walk(p: Vector3, cap := 1.25) -> void:
	if _flat(pos, p) < 0.06: return
	if walk_to(p, cap): await arrived

func _send_reflection(pi: int, to: Vector3, _sp: Vector2) -> void:
	if busy: return
	refl_ring.position = Vector3(to.x, 0.03, to.z); refl_p = 0.0
	hold_id = -1; route.clear(); pending = ""
	refl_busy += 1
	await _refl_to(WL[pi], to)
	refl_busy -= 1

func _refl_return() -> void:
	_refl_melt()

## she walks: her reflection stays where it is on the water (it is called back when she leaves that water)
func walk_to(p: Vector3, cap := WALK) -> bool:
	var pts := find_path(pos, p)
	if pts.is_empty(): return false
	speed_cap = cap; face_to = null
	route.clear()
	for q in pts: route.append({"p": q})
	return true

func use(k: String) -> void:
	var o: Dictionary = objs[k]
	if o.has("water"):      # a thing in a water: her reflection goes to it
		if busy: return
		route.clear(); pending = ""
		refl_busy += 1
		if await _refl_to(o.water, o.rstand):
			busy = true
			await call("_do_" + k)
			busy = false; settled.emit()
		refl_busy -= 1
		return
	if not walk_to(o.stand):
		say("there is no way there yet"); return
	pending = k

func _self() -> void:
	if not refl_out.is_empty():      # a tap on her: her reflection comes back
		await _refl_melt(); return
	await super._self()

# ---------------------------------------------------------------- I.1
func tap(sp: Vector2) -> void:
	if started and not ended and not woke:
		if not busy: _wake()
		return
	if started and not ended and not busy:      # of the things under the finger, the nearest one is meant
		var px := get_viewport().get_visible_rect().size.x / 720.0
		var best := ""; var bd := 64.0 * px
		for k in objs:
			if done.has(k): continue
			var d := _tap_dist(k, sp)
			if d < bd: bd = d; best = k
		if best != "":
			usering.position = Vector3(objs[best].at.x, 0.03, objs[best].at.z); use_p = 0.0
			use(best); return
	super.tap(sp)

## how far (on the screen) a tap falls from the thing k: from the line through the points it names
func _tap_dist(k: String, sp: Vector2) -> float:
	var pts := []
	for q in objs[k].get("hits", [objs[k].at]): pts.append(cam.unproject_position(q))
	var best := 1e9
	for i in pts.size() - 1:
		var a: Vector2 = pts[i]; var b: Vector2 = pts[i + 1]; var ab := b - a
		var u := clampf((sp - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		best = minf(best, sp.distance_to(a + ab * u))
	if pts.size() == 1: best = sp.distance_to(pts[0])
	return best

## the engine's own test of a tap on a thing: here the nearest thing has been chosen already
func _tap_hits(_k: String, _sp: Vector2, _px: float) -> bool:
	return false

func _wake_now() -> void:
	woke = true; posing = false; pose_k = 0.0; a_wL = 0.0; a_wR = 0.0
	pos = Vector3(0, 0, MOLE_A - 0.55); yaw = 0.0

## the first tap: the statue on the plinth lets its hands fall, looks about, and steps down toward the sea
func _wake() -> void:
	busy = true; woke = true
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 1.4); dn.tween_property(self, "a_wL", 0.0, 1.4)
	await wait(0.9)
	posing = false
	await wait(1.3)
	var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	h.tween_property(self, "a_hy", -0.8, 0.9); h.tween_interval(0.4); h.tween_property(self, "a_hy", 0.7, 1.1); h.tween_interval(0.4); h.tween_property(self, "a_hy", 0.0, 0.6)
	await h.finished
	go([Vector3(0, 0, MOLE_A - 0.55)], 0.7)
	while pos.z < HERPL.z + 0.2: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	busy = false; settled.emit()

## hands on a wheel that stands across the way one faces: each goes round with the rim for part of a turn, lets go,
## and comes back. For her reflection the wheel is the mirrored one (under the water)
func _crank_hands(hm: HerMod, hub: Vector3, n: Vector3, a: float, mirror: bool) -> void:
	var s := Vector3(n.z, 0, n.x)
	for sd in 2:
		var u := fposmod(a / 2.8 + 0.5 * sd, 1.0)
		var hold := u < 0.57
		var k := (u / 0.57) if hold else smoothstep(1.0, 0.0, (u - 0.57) / 0.43)
		var psi := (0.4 + 1.6 * k) if sd == 0 else (-2.0 + 1.6 * k)
		var off := 0.0 if hold else 0.08 * sin(PI * (u - 0.57) / 0.43)
		var pt := hub + n * (0.06 + off) + Vector3(0, 0.35 * cos(psi), 0) + s * (0.35 * sin(psi))
		if mirror: pt.y = -pt.y
		if sd == 0: hm.tL = pt
		else: hm.tR = pt

## a wheel in a water: her reflection, standing before it, turns it hand over hand; what it opens happens meanwhile
func _refl_wheel(id: String, wid: String, focus: Vector3, size: float, opens: Callable) -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var hub: Vector3 = N["hub" + id]; var hn: Vector3 = N["hubn" + id]
	var s0 := cam.size
	var want := atan2(-hn.x, -hn.z)
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, want), 0.3)
	await rt.finished
	var hm := _hermod(e)
	var wa: Node3D = N["wheel" + id]; var wm: Node3D = N["wheel" + id + "_m"]
	var crank := func(_v: float) -> void:
		var pts := _crank_pts(hub, hn, wm.rotation.x, 0.35)
		hm.tL = Vector3(pts[0].x, -pts[0].y, pts[0].z); hm.tR = Vector3(pts[1].x, -pts[1].y, pts[1].z)
	crank.call(0.0); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wL", 1.0, 0.5); hu.tween_property(hm, "wR", 1.0, 0.5); hu.tween_property(hm, "bow", 0.1, 0.5)
	await hu.finished
	var wt := create_tween().set_parallel(); wt.tween_property(wa, "rotation:x", wa.rotation.x + PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE); wt.tween_property(wm, "rotation:x", wm.rotation.x + PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE)
	wt.tween_method(crank, 0.0, 1.0, 5.2)
	await wait(1.2)
	cam_focus = focus; cam_focus_on = true
	create_tween().tween_property(cam, "size", size, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(0.9)
	await opens.call()
	if wt.is_running(): await wt.finished
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wL", 0.0, 0.5); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	await hd2.finished
	hm.own = false
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	refl_token += 1; var my := refl_token
	var back := _refl_path(wid, hd.position, pos)
	if await _refl_walk_pts(e, back.pts, back.h, my, 1.1): await _refl_melt()

## where two hands lie on a wheel of radius r that stands across the way n (toward whoever turns it), when the wheel
## has turned by a: each goes round with the rim for part of a turn, lets go, and comes back for the next hold
func _crank_pts(hub: Vector3, n: Vector3, a: float, r: float) -> Array:
	var sdir := Vector3(n.z, 0, n.x); var out := []
	for sd in 2:
		var u := fposmod(a / 2.8 + 0.5 * sd, 1.0)
		var hold := u < 0.57
		var k := (u / 0.57) if hold else smoothstep(1.0, 0.0, (u - 0.57) / 0.43)
		var psi := (0.4 + 1.6 * k) if sd == 0 else (-2.0 + 1.6 * k)
		var off := 0.0 if hold else 0.08 * sin(PI * (u - 0.57) / 0.43)
		out.append(hub + n * (0.06 + off) + Vector3(0, r * cos(psi), 0) + sdir * (r * sin(psi)))
	return out

## I.1: the wheel on the far piece of the mole. Her reflection, come along the mole the water keeps, turns it, and
## the first sluice goes down
func _do_wheel1() -> void:
	await _refl_wheel("1", "H", Vector3(0, 0.4, 2.6), 10.5, func() -> void:
		await sluice_open("s1", 2.6)
		rects["S1"].on = true; done["wheel1"] = true)

## I.3: the wheel behind the grille. Her reflection passes where the grille is not (in the water there is none
## there), and turns it: the grille and the sluice beyond it go down
func _do_wheel2() -> void:
	await _refl_wheel("2", "T", Vector3(-1.6, 0.4, -13.6), 9.5, func() -> void:
		create_tween().tween_property(N["g2"], "position:y", -2.1, 2.6).set_trans(Tween.TRANS_SINE)
		await sluice_open("s2", 2.8)
		rects["Tg"].on = true; rects["S2"].on = true; done["wheel2"] = true)

## I.4: the windlass of the well. She lowers the empty bucket until it touches the water; there it meets its own
## reflection, which holds the handle, and comes up with it
func _do_well() -> void:
	var hub := WELL + Vector3(WELL_R + 0.33, 1.15, BUCKET.z); var hn := Vector3(1, 0, 0)
	await face(hub)
	var hands := func(y: float) -> void:
		_bucket_set(y)
		var pts := _crank_pts(hub, hn, (N["axle"] as Node3D).rotation.x, 0.27)
		tgtL = pts[0]; tgtR = pts[1]
	hands.call(0.3)
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.7); up.tween_property(self, "a_wR", 1.0, 0.7); up.tween_property(self, "a_lean", 0.06, 0.7)
	await up.finished
	var s0 := cam.size
	cam_focus = WELL + Vector3(0.2, 0.3, 0.2); cam_focus_on = true
	create_tween().tween_property(cam, "size", 6.2, 1.6).set_trans(Tween.TRANS_SINE)
	var dn := create_tween(); dn.tween_method(hands, 0.3, 0.012, 3.4).set_trans(Tween.TRANS_SINE)
	await dn.finished
	refl_ring.position = WELL + Vector3(BUCKET.x, 0.03, BUCKET.z); refl_p = 0.0      # the bucket touches the water, and is one with what the water held
	var ck: Node3D = N["bcrank"]; ck.scale = Vector3.ONE * 0.01; ck.visible = true
	create_tween().tween_property(ck, "scale", Vector3.ONE * 0.9, 0.6).set_trans(Tween.TRANS_SINE)
	await wait(1.1)
	var rise := create_tween(); rise.tween_method(hands, 0.012, 0.5, 3.0).set_trans(Tween.TRANS_SINE)
	await rise.finished
	var off := tw(); off.tween_property(self, "a_wL", 0.0, 0.6); off.tween_property(self, "a_wR", 0.0, 0.6); off.tween_property(self, "a_lean", 0.0, 0.6)
	await off.finished
	done["well"] = true; flags["well"] = true
	await _take_crank()
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## she goes round to the bucket and takes the handle out of it
func _take_crank() -> void:
	var bk: Node3D = N["bucket"]
	await walk(objs["bucket"].stand)
	await face(Vector3(bk.position.x, 0, bk.position.z))
	tgtR = bk.position + Vector3(0.02, 0.32, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.8); a.tween_property(self, "a_lean", 0.3, 0.8); a.tween_property(self, "a_headp", 0.2, 0.8)
	await a.finished
	await wait(0.25)
	var ck: Node3D = N["bcrank"]
	var sh := create_tween(); sh.tween_property(ck, "scale", Vector3.ONE * 0.01, 0.3)
	await sh.finished
	ck.visible = false; (N["bcrank_m"] as Node3D).visible = false
	_pocket_add("crank")
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_lean", 0.0, 0.8); b.tween_property(self, "a_headp", 0.0, 0.8)
	await b.finished

func _do_bucket() -> void:
	if "crank" in pocket or done.has("post3"): return
	await _take_crank()

## I.4: the post of the third sluice. With nothing in its socket it cannot be turned; with the handle, she turns it
func _do_post3() -> void:
	await face(POST3)
	if not ("crank" in pocket):
		var h := create_tween().set_trans(Tween.TRANS_SINE); h.tween_property(self, "a_headp", 0.25, 0.4); h.tween_interval(0.8); h.tween_property(self, "a_headp", 0.0, 0.5)
		say("a square socket, and nothing to turn it by")
		await h.finished
		return
	var gr: Node3D = N["post3_gear"]; var c3: Node3D = N["crank3"]
	var grip := func() -> Vector3: return gr.global_transform * Vector3(0.25, 0.14, 0.0)
	tgtR = POST3 + Vector3(0, 1.0, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(self, "a_lean", 0.1, 0.7)
	await a.finished
	_pocket_take("crank"); c3.scale = Vector3.ONE * 0.01; c3.visible = true
	create_tween().tween_property(c3, "scale", Vector3.ONE * 0.85, 0.35)
	await wait(0.5)
	var follow := func(v: float) -> void:
		gr.rotation.y = v; tgtR = grip.call()
	var g0 := create_tween(); g0.tween_property(self, "tgtR", grip.call(), 0.35)
	await g0.finished
	var s0 := cam.size
	cam_focus = Vector3(VX0 + 0.6, 0.4, -20.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 7.6, 1.4).set_trans(Tween.TRANS_SINE)
	var tn := create_tween(); tn.tween_method(follow, 0.0, -TAU * 3.0, 5.0).set_trans(Tween.TRANS_SINE)
	await wait(1.0)
	await sluice_open("s3", 2.8)
	rects["S3"].on = true; done["post3"] = true
	if tn.is_running(): await tn.finished
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.7); b.tween_property(self, "a_lean", 0.0, 0.7)
	await b.finished
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## I.5: the arch the water shows. Her reflection goes and stands in it, and looks back at her
func _do_arch5() -> void:
	var hd: Node3D = refl_out.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, 0.0), 0.5).set_trans(Tween.TRANS_SINE)
	await rt.finished
	await wait(0.6)

## I.5: the plain wall where the water shows an arch. She lays both palms on it and pushes: the plaster cracks and
## falls, and the arch is there
func _do_wall5() -> void:
	if not refl_out.is_empty(): _refl_melt()
	await face(Vector3(ARCH_X, 0, FZ0))
	tgtL = Vector3(ARCH_X + 0.17, 1.22, FZ0 + 0.31); tgtR = Vector3(ARCH_X - 0.17, 1.22, FZ0 + 0.31)
	var a := tw(); a.tween_property(self, "a_wL", 1.0, 0.8); a.tween_property(self, "a_wR", 1.0, 0.8); a.tween_property(self, "a_lean", 0.16, 0.8)
	await a.finished
	await wait(0.5)
	var plug: Node3D = N["plug5"]; var i := 0
	for c in plug.get_children():
		var pb := c as Node3D
		var d := 0.05 * i + 0.12 * (1.0 - pb.position.y / 2.2); i += 1
		var f := create_tween().set_parallel()
		f.tween_property(pb, "position", pb.position + Vector3(0.12 * sin(i * 2.1), -2.9, 0.75 + 0.1 * cos(i * 1.7)), 0.95).set_delay(d).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		f.tween_property(pb, "rotation", Vector3(0.9 + 0.3 * sin(i), 0.2 * cos(i * 1.3), 0.25 * sin(i * 0.7)), 0.95).set_delay(d)
	await wait(0.5)
	refl_ring.position = Vector3(ARCH_X, 0.03, FPZ0 + 0.75); refl_p = 0.0
	var b := tw(); b.tween_property(self, "a_wL", 0.0, 0.8); b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_lean", 0.0, 0.8)
	await b.finished
	await wait(0.6)
	plug.visible = false
	rects["F5"].on = true; done["wall5"] = true; done["arch5"] = true; looks.erase("fwall")

## I.7: the Gate. She lays a hand on the cloth. (For now the chapter ends here.)
func _do_gate() -> void:
	await face(Vector3(UC.x, 0, UZ0))
	tgtR = Vector3(UC.x - 0.12, POD_H + 1.28, UZ0 + 0.93)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.9); a.tween_property(self, "a_headp", -0.2, 0.9)
	await a.finished
	quote("gate", "Barred, and covered,\nand tied on the far side.", 4.5, true)
	await wait(3.2)
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.9); b.tween_property(self, "a_headp", 0.0, 0.9)
	await b.finished
	await wait(2.0)
	_end()

## I.6: the statue that stands, in the water, on the plinth that is empty above. Her reflection goes up to it, looks
## at it, and looks back at her
func _do_place6w() -> void:
	var hd: Node3D = refl_out.holder
	var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
	var rt := create_tween().set_trans(Tween.TRANS_SINE)
	rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(pl.x - hd.position.x, pl.z - hd.position.z)), 0.5); rt.tween_interval(1.1)
	await rt.finished
	var rb := create_tween().set_trans(Tween.TRANS_SINE)
	rb.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(pos.x - hd.position.x, pos.z - hd.position.z)), 0.6); rb.tween_interval(0.5)
	await rb.finished

## I.6: the empty plinth. She steps up onto it, turns to the pool, brings her hands together as the statue in the
## water holds them, and is still: the rows are whole, and the great door goes down
func _do_place6() -> void:
	var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
	if not refl_out.is_empty(): await _refl_melt()
	var s0 := cam.size
	cam_focus = pl + Vector3(-0.8, 0.3, 1.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 7.2, 1.6).set_trans(Tween.TRANS_SINE)
	go([pl], 0.8)
	while pos.z < pl.z - 0.48: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.17, 0.45).set_trans(Tween.TRANS_SINE)
	await arrived
	(N["place6_m"] as Node3D).visible = false      # the statue the water showed there was her: her own reflection stands in its place now
	await wait(0.3)
	await face(pl + Vector3(0, 0, 3.0))
	await wait(0.8)
	tgtL = pl + Vector3(0.03, 1.61, 0.21); tgtR = pl + Vector3(-0.03, 1.61, 0.21)
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.2); up.tween_property(self, "a_wL", 1.0, 1.2)
	await up.finished
	await wait(0.3)
	posing = true
	await wait(2.2)
	cam_focus = Vector3(GX0 + 2.6, 0.6, DOOR6.z + 0.6)
	create_tween().tween_property(cam, "size", 9.6, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.4)
	await sluice_open("door6", 3.0)
	rects["D6"].on = true; done["place6"] = true; done["place6w"] = true
	await wait(0.7)
	cam_focus = pl + Vector3(-0.8, 0.3, 1.6)
	posing = false
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.8); dn.tween_property(self, "a_wL", 0.0, 0.8)
	await dn.finished
	await wait(0.3)
	go([pl + Vector3(0, 0, -0.72)], 0.8)
	while pos.z > pl.z - 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

# ---------------------------------------------------------------- frame, and the runs that try the chapter
func _process(dt: float) -> void:
	super._process(dt)
	if not refl_out.is_empty() and not busy and refl_w != "" and _rect_dist(pos, W[refl_w].r) > 3.2: _refl_melt()      # she has left that water
	var fy = _floor_y(pos)      # the stair and the podium: she stands as high as the floor is there
	if fy != null: pos.y = fy; on_ramp = true
	elif on_ramp: pos.y = 0.0; on_ramp = false

## how high the floor is at a place, where it is not level (null: level floor)
func _floor_y(p: Vector3):
	for rp in ramps:
		if rp.r.on and in_rect(rp.r, p): return lerpf(rp.y0, rp.y1, clampf(((p.x if rp.get("ax", "z") == "x" else p.z) - rp.z0) / (rp.z1 - rp.z0), 0.0, 1.0))
	return null

## a tap on floor that stands higher than the rest names a place on it
func _ground_under(sp: Vector2):
	var o := cam.project_ray_origin(sp); var d := cam.project_ray_normal(sp)
	for rp in ramps:
		for y in [rp.y0, (rp.y0 + rp.y1) * 0.5, rp.y1]:
			var g: Vector3 = o + d * ((float(y) - o.y) / d.y)
			if rp.r.on and in_rect(rp.r, g) and absf(float(_floor_y(g)) - float(y)) < 0.16: return Vector3(g.x, 0, g.z)
	return super._ground_under(sp)

func _ready() -> void:
	super._ready()
	var args := OS.get_cmdline_user_args()
	if "views" in args: _views()
	if "act1" in args: _play_act1()

## stills. VIEWS="name,cx,cz,size[,px,pz,yaw];..." : the middle of the view on the ground, how many metres it holds
## across, and where she stands (away from everything, if not given)
func _views() -> void:
	started = true; title_box.hide(); hint.hide()
	if not woke: _wake_now()
	var dir := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(2.0).timeout
	for at in OS.get_environment("VIEWS").split(";", false):
		var f := at.split(",")
		var sh := {"n": f[0], "c": Vector3(float(f[1]), 0.4, float(f[2])), "s": float(f[3])}
		shot = sh
		route.clear(); cam.size = sh.s
		pos = Vector3(float(f[4]), 0, float(f[5])) if f.size() > 5 else Vector3(90, 0, 90)
		yaw = float(f[6]) if f.size() > 6 else 0.0
		cam_t = pos
		await get_tree().create_timer(1.2).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [dir, sh.n])
		print("VIEW ", sh.n)
	get_tree().quit()

func _tap_at(p: Vector3) -> void:
	tap(cam.unproject_position(p))

## (the runs) a tap, and then until nothing is happening any more
func _tap_wait(p: Vector3) -> void:
	_tap_at(p)
	var still := 0
	while still < 12:
		await get_tree().process_frame
		still = still + 1 if (not busy and route.is_empty() and pending == "" and refl_busy == 0) else 0

## the first act played by taps, as a player would: prints what happens
func _play_act1() -> void:
	var from := OS.get_environment("FROM")
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)      # the title
	if from == "":
		tap(Vector2(360, 640))      # she wakes
		await settled
		print("ACT1 woke at ", pos)
		_tap_at(Vector3(1.6, 0, 6.0))      # open water: it goes as near as it can along the mole
		await wait(6.0)
		print("ACT1 I.1 reflection sent to open water stands at ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
		var hub: Vector3 = N["hub1"]
		await _tap_wait(Vector3(hub.x, -hub.y, hub.z))      # the wheel in the water
		print("ACT1 I.1 wheel ", done.has("wheel1"), " sluice ", rects["S1"].on, " reflection ", "out" if not refl_out.is_empty() else "under her")
	else:
		_wake_now(); _open_to(from)
	if from in ["", "T"]:
		await _tap_wait(Vector3(-2.3, 0, -9.0))
		print("ACT1 I.3 on the walk at ", pos)
		var h2: Vector3 = N["hub2"]
		_tap_at(Vector3(h2.x, -h2.y, h2.z))      # the wheel in the water, from before the water's grille: it is stopped there
		await wait(7.0)
		print("ACT1 I.3 first try: wheel ", done.has("wheel2"), ", reflection at ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
		await _tap_wait(Vector3(-2.3, 0, TG_REAL + 0.6))      # she walks on, past where the water's grille stands
		await _tap_wait(Vector3(h2.x, -h2.y, h2.z))
		print("ACT1 I.3 second try: wheel ", done.has("wheel2"), " grille ", rects["Tg"].on, " sluice ", rects["S2"].on)
	if from in ["", "T", "V"]:
		await _tap_wait(Vector3(-2.05, 0, VZ1 - 1.0))
		await _tap_wait(POST3 + Vector3(0, 0.6, 0))
		print("ACT1 I.4 post without the handle: done ", done.has("post3"), " at ", pos)
		await _tap_wait(WELL + Vector3(0.2, 0.012, 0.25))      # the water of the well
		print("ACT1 I.4 tapped the well's water: reflection ", "out" if not refl_out.is_empty() else "under her", " at ", pos)
		await _tap_wait(objs["well"].at)
		print("ACT1 I.4 well ", done.has("well"), " pocket ", pocket)
		await _tap_wait(POST3 + Vector3(0, 0.6, 0))
		print("ACT1 I.4 post with the handle: done ", done.has("post3"), " sluice ", rects["S3"].on, " pocket ", pocket)
	if from in ["", "T", "V", "F"]:
		await _tap_wait(Vector3(FX1 - 0.9, 0, -20.8))
		await _tap_wait(Vector3(ARCH_X, -1.0, FZ0 + 0.3))      # the arch in the water
		print("ACT1 I.5 reflection in the arch: ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her", " she at ", pos)
		await _tap_wait(Vector3(ARCH_X, 1.0, FZ0 + 0.3))      # the wall
		print("ACT1 I.5 wall ", done.has("wall5"), " way through ", rects["F5"].on, " she at ", pos)
	if from != "U":
		await _tap_wait(Vector3(ARCH_X, 0, GZ1 - 1.0))
		var pl := Vector3(ROW_X[HERS], 0, ROW_Z)
		await _tap_wait(pl + Vector3(0, -1.0, 0))      # the statue in the water
		print("ACT1 I.6 reflection by the statue of the water: ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her", " she at ", pos)
		await _tap_wait(pl + Vector3(0, 0.3, 0))      # the empty plinth
		print("ACT1 I.6 place ", done.has("place6"), " door ", rects["D6"].on, " she at ", pos)
	await _tap_wait(Vector3(UX1 - 2.0, 0, DOOR6.z))
	print("ACT1 I.7 in the atrium at ", pos)
	await _tap_wait(Vector3(UC.x, POD_H + 1.6, UZ0 + 0.9))
	print("ACT1 I.7 at the gate: ", pos, " ended ", ended)
	get_tree().quit()

## (to try a later court) everything before it is done, and she stands at its entry
func _open_to(c: String) -> void:
	var order := ["T", "V", "F", "G", "U"]; var k := order.find(c)
	rects["S1"].on = true; (N["s1"] as Node3D).position.y = -1.75; done["wheel1"] = true
	pos = Vector3(0, 0, TZ1 + 0.5); yaw = PI
	if k >= 1:
		rects["Tg"].on = true; rects["S2"].on = true; done["wheel2"] = true; (N["g2"] as Node3D).position.y = -2.1; (N["s2"] as Node3D).position.y = -1.75
		pos = Vector3(-2.05, 0, TZ0 - 0.6)
	if k >= 2:
		rects["S3"].on = true; done["post3"] = true; done["well"] = true; (N["s3"] as Node3D).position.y = -1.75
		pos = Vector3(VX0 - 0.6, 0, -20.8); yaw = -PI * 0.5
	if k >= 3:
		rects["F5"].on = true; done["wall5"] = true; done["arch5"] = true; (N["plug5"] as Node3D).visible = false
		pos = Vector3(ARCH_X, 0, FZ0 - 0.6); yaw = PI
	if k >= 4:
		rects["D6"].on = true; done["place6"] = true; done["place6w"] = true; (N["door6"] as Node3D).position.y = -2.4; (N["place6_m"] as Node3D).visible = false
		pos = Vector3(UX1 - 1.6, 0, DOOR6.z); yaw = -PI * 0.5
	cam_t = pos
