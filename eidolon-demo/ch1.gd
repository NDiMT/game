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
const UC := Vector3(-25.0, 0, -32.6)      # (the line the west door and its channel lie on)
const GATE_X := -28.0                     # the middle of the Gate, in the north wall
const UB := Vector3(-25.0, 0, -36.9)      # the middle of the great basin: it lies at the Gate's feet, south-east of it, where a water must lie to show it
const UBR := 3.9                          # its radius
const UBH := 4.0                          # half the side of the square opening it sits in
const POD_H := 1.2                        # the landing before the Gate
const LAND_X0 := GATE_X - 2.8
const LAND_X1 := GATE_X + 2.2
const LAND_Z := -41.0                     # its front edge, which stands at the basin's rim
const STAIR_X := LAND_X1 + 2.1            # the foot of its stair, which comes down eastward along the wall
const CLEFT_X0 := -27.1                   # in the water the landing is broken through here
const CLEFT_X1 := -26.4
const BREACH_X0 := -30.7                  # and the wall beside the Gate is breached here
const BREACH_X1 := -30.12
const TURN3 := Vector3(-26.75, 0, -40.68) # the statue that holds a stone, at the landing's foot
const ROW3_X := -29.55                    # the row of her along the basin's west rim
const ROW3_Z := [-39.4, -38.2, -37.0, -35.8]
const HERS3 := 2                          # which of its places is empty
const UC_STONE := "d8ccb9"                # the plain colours of the atrium's things as the basin's water shows them
const UC_TOP := "e9dfcc"
const UC_SHADE := "b9ab98"
const UC_GOLD := "d2aa58"
const UC_DARK := "7a708a"
const UC_ROPE := "b9a888"
const UC_CRIM := "cf5a40"

var N := {}      # the pieces that move, by name (kept here so that the joined world leaves them alone)
var WL: Array = []      # the still waters, in order: their names
var W := {}      # each water: {"r": [x0, z0, x1, z1], "heads": [rects of floor from which her reflection can be sent], "foot": {name: {x0, z0, x1, z1, on, h}}}
var refl_w := ""      # the water her reflection is out on
var refl_key := "mir"      # which of her mirrored bodies it is (a water whose surface is not at the floor's height has one of its own: W[id].mir)
var ramps: Array = []      # floor that is not level: {"r": its rect, "z0", "z1": between these it goes from height "y0" to "y1"}
var on_ramp := false
var refl_busy := 0      # how many orders to her reflection are still being carried out
var refl_img := false   # the place it is being sent to was named by a tap on the water (on the image of the place)
var woke := false
var flags := {}
var wing_open := {"W": false, "N": false, "S": false}      # which wings are built: a script that extends this one and builds a wing sets its own to true in _init (after super._init())
var wings_done: Array = []      # the wings whose water has been set free, in the order it was done
var cs_mirs: Array = []      # the mirrored bodies of her that belong to waters below the floor's height, to be made once she exists: [key, root]
var cs_courts: Array = []    # the courts with such waters: in them her ordinary mirrored body is put away

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
	gate_slot(c, half, not along_x)      # (the slot lies along the leaf, across the way)
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

## a wall: a base course, the wall with its pilasters and panels, a string course, dentils and a cornice; it ends in
## piers. twin: its copy in the water as well, in plain colours
func wall(x0: float, z0: float, x1: float, z1: float, h: float, twin := false, y0 := 0.0) -> void:
	blk(Vector3(x0, y0, z0), Vector3(x1, h, z1), "stone")
	if y0 == 0.0: blk(Vector3(x0 - 0.03, 0, z0 - 0.03), Vector3(x1 + 0.03, 0.14, z1 + 0.03), "shade")
	cornice(x0, z0, x1, z1, h, 0.04, 0.06)
	if y0 == 0.0 and h > 1.8: _wall_dress(x0, z0, x1, z1, h)
	if twin:
		blk(Vector3(x0, y0, z0), Vector3(x1, h, z1), "stone", mroot).material_override = under_mat(Color("d8ccb9"))
		blk(Vector3(x0 - 0.04, h, z0 - 0.04), Vector3(x1 + 0.04, h + 0.06, z1 + 0.04), "stone", mroot).material_override = under_mat(Color("b9ab98"))

## the face of a wall that the eye sees (south, or east): pilasters on plinths with small capitals, a sunk panel in
## each bay, a string course, dentils under the cornice, a coping; and a pier at each end, a little taller, capped
func _wall_dress(x0: float, z0: float, x1: float, z1: float, h: float) -> void:
	var ax := (x1 - x0) >= (z1 - z0)      # it runs east-west: its south face is seen
	var l := (x1 - x0) if ax else (z1 - z0)
	var o := Vector3(x0, 0, z1) if ax else Vector3(x1, 0, z0)      # the foot of the seen face, at its start
	var u := Vector3(1, 0, 0) if ax else Vector3(0, 0, 1)          # along it
	var w := Vector3(0, 0, 1) if ax else Vector3(1, 0, 0)          # out of it
	var B := func(a0: float, a1: float, ya: float, yb: float, out0: float, out1: float, p: String) -> void:
		var pa: Vector3 = o + u * a0 + w * out0 + Vector3(0, ya, 0); var pb: Vector3 = o + u * a1 + w * out1 + Vector3(0, yb, 0)
		blk(Vector3(minf(pa.x, pb.x), ya, minf(pa.z, pb.z)), Vector3(maxf(pa.x, pb.x), yb, maxf(pa.z, pb.z)), p)
	var n := maxi(1, int(round(l / 2.3)))
	var bay := l / n
	for i in n + 1:
		var a := bay * i
		if i == 0 or i == n:      # the pier that ends it
			var c := clampf(a, 0.2, l - 0.2)
			B.call(c - 0.26, c + 0.26, 0.0, h + 0.16, -0.36, 0.1, "stone"); B.call(c - 0.3, c + 0.3, 0.0, 0.2, -0.4, 0.14, "shade")
			B.call(c - 0.31, c + 0.31, h + 0.16, h + 0.23, -0.41, 0.15, "shade"); B.call(c - 0.2, c + 0.2, h + 0.23, h + 0.33, -0.3, 0.04, "stone")
		else:
			B.call(a - 0.17, a + 0.17, 0.14, h - 0.2, 0.0, 0.05, "stone"); B.call(a - 0.2, a + 0.2, 0.14, 0.3, 0.0, 0.075, "shade")
			B.call(a - 0.21, a + 0.21, h - 0.2, h - 0.12, 0.0, 0.08, "shade")
	for i in n:      # the bays: a sunk panel, and over it a string course
		var a0 := bay * i + 0.42; var a1 := bay * (i + 1) - 0.42
		if a1 - a0 < 0.5: continue
		B.call(a0, a1, 0.46, h * 0.7 - 0.12, 0.0, 0.012, "shade")
		B.call(a0 + 0.06, a1 - 0.06, 0.52, h * 0.7 - 0.18, 0.0, 0.02, "stone")
		B.call(bay * i + 0.2, bay * (i + 1) - 0.2, h * 0.7, h * 0.7 + 0.05, 0.0, 0.03, "shade")
	var dx := 0.3      # dentils under the cornice
	while dx < l - 0.3:
		B.call(dx, dx + 0.07, h - 0.1, h - 0.03, 0.0, 0.035, "shade"); dx += 0.16
	B.call(0.0, l, h + 0.06, h + 0.1, -0.33, 0.07, "stone")      # the coping

## an open screen in place of a wall: a row of columns on a low balustrade, carrying an architrave. The land beyond
## shows through it
func stoa(x0: float, z0: float, x1: float, z1: float, h := 2.5) -> void:
	var ax := (x1 - x0) >= (z1 - z0)
	var l := (x1 - x0) if ax else (z1 - z0)
	var o := Vector3(x0, 0, (z0 + z1) * 0.5) if ax else Vector3((x0 + x1) * 0.5, 0, z0)
	var u := Vector3(1, 0, 0) if ax else Vector3(0, 0, 1)
	var hw := Vector3(0, 0, 0.21) if ax else Vector3(0.21, 0, 0)
	blk(o - hw, o + u * l + hw + Vector3(0, 0.1, 0), "shade")      # the stylobate
	var n := maxi(2, int(round(l / 1.75)))
	for i in n + 1:
		var c: Vector3 = o + u * clampf(l * i / n, 0.22, l - 0.22)
		blk(c + Vector3(-0.2, 0.1, -0.2), c + Vector3(0.2, 0.2, 0.2), "stone")
		column(c + Vector3(0, 0.2, 0), h - 0.36, 0.135)
		blk(c + Vector3(-0.2, h - 0.16, -0.2), c + Vector3(0.2, h - 0.08, 0.2), "shade"); blk(c + Vector3(-0.23, h - 0.08, -0.23), c + Vector3(0.23, h, 0.23), "stone")
		if i < n:
			var c2: Vector3 = o + u * clampf(l * (i + 1) / n, 0.22, l - 0.22)
			parapet(c + u * 0.2, c2 - u * 0.2)
	blk(o - hw * 1.05 + Vector3(0, h, 0), o + u * l + hw * 1.05 + Vector3(0, h + 0.2, 0), "stone")      # the architrave
	blk(o - hw * 1.3 - u * 0.05 + Vector3(0, h + 0.2, 0), o + u * (l + 0.05) + hw * 1.3 + Vector3(0, h + 0.27, 0), "shade")
	blk(o - hw * 1.15 + Vector3(0, h + 0.27, 0), o + u * l + hw * 1.15 + Vector3(0, h + 0.33, 0), "stone")

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

# ---------------------------------------------------------------- waters that lie below the floor
## a still water at a level of its own: its mirror world hangs under a root that turns everything over about that
## level, so that when the water sinks by one step what it shows sinks by two. Returns that root
func _cs_water(key: String, x0: float, z0: float, x1: float, z1: float, level: float, round := false) -> Node3D:
	var mr := Node3D.new(); mr.name = "Mirror_" + key; mr.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * level, 0)); add_child(mr)
	var wq := QuadMesh.new(); wq.size = Vector2(x1 - x0, z1 - z0); wq.orientation = PlaneMesh.FACE_Y
	var g := ShaderMaterial.new(); g.shader = shaders["glass"]; timed.append(g)
	g.set_shader_parameter("lost_a", 0.0); g.set_shader_parameter("blur_px", 0.6); g.set_shader_parameter("lod", 0.0)
	var gl: MeshInstance3D
	if round:      # a round water: a disc, as wide as the rectangle given
		var dm := CylinderMesh.new(); dm.top_radius = 0.5; dm.bottom_radius = 0.5; dm.height = 0.001; dm.radial_segments = 72; dm.rings = 0; dm.cap_bottom = false
		gl = prim(dm, Vector3((x0 + x1) * 0.5, level + 0.012, (z0 + z1) * 0.5), g); gl.scale = Vector3(x1 - x0, 1, z1 - z0)
	else: gl = prim(wq, Vector3((x0 + x1) * 0.5, level + 0.012, (z0 + z1) * 0.5), g)
	gl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	N[key + "_mr"] = mr; N[key + "_glass"] = gl; N[key + "_level"] = level
	cs_mirs.append(["mir_" + key, mr])
	return mr

## the plain colour of a thing mirrored in such a water. Only what stands above the water is mirrored in it: of
## the copy that hangs under the water's root, whatever would come out above the surface is not drawn
var cs_ush: Shader
func _cs_umat(key: String, c: Color) -> ShaderMaterial:
	if cs_ush == null:
		cs_ush = Shader.new(); cs_ush.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled;\nuniform vec3 col : source_color; uniform float level = 0.0;\nvarying vec3 wp;\nvoid vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }\nvoid fragment(){ if (wp.y > level) discard; ALBEDO = col; }"
	var m := ShaderMaterial.new(); m.shader = cs_ush; m.set_shader_parameter("col", c); m.set_shader_parameter("level", float(N[key + "_level"]))
	if not N.has(key + "_umats"): N[key + "_umats"] = []
	(N[key + "_umats"] as Array).append(m)
	return m

## the water of such a tank goes to a level, slowly: its surface, and under it its whole mirror world twice as far
func _cs_level(key: String, to: float, secs := 2.6) -> void:
	var from: float = N[key + "_level"]
	var lt := create_tween(); lt.tween_method(func(v: float) -> void:
		N[key + "_level"] = v
		(N[key + "_mr"] as Node3D).position.y = 2.0 * v; (N[key + "_glass"] as Node3D).position.y = v + 0.012
		for m in N.get(key + "_umats", []): (m as ShaderMaterial).set_shader_parameter("level", v), from, to, secs).set_trans(Tween.TRANS_SINE)
	await lt.finished

## a deeper pit for a pool whose water must show things that stand high over it
func _cs_deep_pit(sky: String, depth: float) -> void:
	var pit := get_node_or_null(sky) as MeshInstance3D
	if pit == null: return
	var pm := pit.mesh as BoxMesh
	pm.size = Vector3(pm.size.x, depth, pm.size.z); pit.position.y = -0.185 - depth * 0.5

# ---------------------------------------------------------------- the world
func _world() -> void:
	mroot = Node3D.new(); mroot.name = "MirrorPool"; mroot.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3.ZERO); add_child(mroot)
	_harbour(); _causeway(); _basin(); _well(); _fountain(); _forecourt(); _atrium()
	_temple()
	_wings()
	_strip_refl(mroot)
	_island()
	_landmarks()
	pos = HERPL + Vector3(0, 0.17, 0); yaw = 0.0

# ---------------------------------------------------------------- the island
## the house does not stand in the open sea: it is built on a rock. A low shelf of stone, just out of the water, runs
## out round every court and joins them; it reaches far to the north and west (inland) and little to the south and
## east, where the sea comes up to the terraces. Away from the courts it mounds up, green, with cypresses
func _hash2(ix: int, iz: int) -> float:
	var n := (ix * 73856093) ^ (iz * 19349663) ^ 0x5bd1e995
	n = ((n ^ (n >> 13)) * 1274126177) & 0x7fffffff
	return float((n ^ (n >> 16)) & 0xffff) / 65535.0

func _vnoise(x: float, z: float) -> float:
	var ix := int(floor(x)); var iz := int(floor(z)); var fx := x - ix; var fz := z - iz
	fx = fx * fx * (3.0 - 2.0 * fx); fz = fz * fz * (3.0 - 2.0 * fz)
	return lerpf(lerpf(_hash2(ix, iz), _hash2(ix + 1, iz), fx), lerpf(_hash2(ix, iz + 1), _hash2(ix + 1, iz + 1), fx), fz)

## how far a place lies from the nearest floor, and which way from it: [distance, x, z of the way out, as a unit]
func _land_d(x: float, z: float) -> Array:
	var best := 1e9; var bx := 0.0; var bz := 0.0
	for f in land_rects:
		var dx := maxf(maxf(f[0] - x, 0.0), x - f[2]) * (-1.0 if x < f[0] else 1.0); var dz := maxf(maxf(f[1] - z, 0.0), z - f[3]) * (-1.0 if z < f[1] else 1.0)
		var d := sqrt(dx * dx + dz * dz)
		if d < best: best = d; bx = dx; bz = dz
	return [best, bx / maxf(best, 0.001), bz / maxf(best, 0.001)]

## how high the land stands at a place (the sea lies at WATER). To the north and west of a floor the land is level
## with it and runs on as a meadow that rises into low hills and falls to a far shore; to the south and east the
## floor ends in a sea wall over a low shelf of rock. Under and beside a bridge the land is cut by an inlet. No hill
## stands between the eye and a floor
func _land_h(x: float, z: float) -> float:
	var q := _land_d(x, z); var d: float = q[0]
	var n1 := _vnoise(x * 0.085 + 11.3, z * 0.085 + 4.1); var n2 := _vnoise(x * 0.2 + 3.1, z * 0.2 + 7.7)
	var sea_side := smoothstep(0.3, 0.8, clampf((float(q[1]) + float(q[2])) * 0.75 + 0.5, 0.0, 1.0))      # 1: south or east of the house, toward the open sea
	var reach := 15.0 + 12.0 * n1
	var tl := d / reach
	var y_land := lerpf(-0.03, WATER - 1.1, smoothstep(0.62, 1.0, tl)) + (0.5 + 3.4 * n2) * smoothstep(2.0, 8.0, d) * (1.0 - smoothstep(0.5, 0.95, tl))
	var reach_s := 1.2 + 2.6 * n1
	var y_sea := lerpf(WATER - 1.1, WATER + 0.3, smoothstep(0.0, 0.32, clampf(1.0 - d / reach_s, 0.0, 1.0)))
	var y := lerpf(y_land, y_sea, sea_side)
	var db := 1e9      # an inlet runs under every bridge
	for f in land_bridges: db = minf(db, Vector2(maxf(maxf(f[0] - x, 0.0), x - f[2]), maxf(maxf(f[1] - z, 0.0), z - f[3])).length())
	if db < 2.6: y = minf(y, lerpf(WATER + 0.22, y, smoothstep(1.3, 2.6, db)))
	if y > 0.0:      # a hill hides what lies behind it for as far as it is high
		for k in range(1, 10):
			var bx := x - k; var bz := z - k
			for f in land_rects:
				if bx > f[0] - 0.6 and bx < f[2] + 0.6 and bz > f[1] - 0.6 and bz < f[3] + 0.6: y = minf(y, maxf(k - 1.3, 0.0)); break
	return y + 0.05 * (n2 - 0.5) + (0.05 * (_hash2(int(x * 2.0), int(z * 2.0)) - 0.5) if d > 0.7 else 0.0)

var land_bridges: Array = []
var land_paths: Array = []      # narrow floors that are paths over land, not bridges: no inlet under them
var land_rects: Array = []
func _island() -> void:
	land_rects = []; land_bridges = []
	var x0 := 1e9; var z0 := 1e9; var x1 := -1e9; var z1 := -1e9
	for f in floors:
		land_rects.append([f[0], f[1], f[2], f[3]])
		if minf(f[2] - f[0], f[3] - f[1]) <= 2.6 and not ([f[0], f[1], f[2], f[3]] in land_paths): land_bridges.append([f[0], f[1], f[2], f[3]])
		x0 = minf(x0, f[0]); z0 = minf(z0, f[1]); x1 = maxf(x1, f[2]); z1 = maxf(z1, f[3])
	x0 = floor(x0) - 30.0; z0 = floor(z0) - 30.0; x1 = ceil(x1) + 7.0; z1 = ceil(z1) + 7.0
	var nx := int(x1 - x0); var nz := int(z1 - z0)
	var hs := PackedFloat32Array(); hs.resize((nx + 1) * (nz + 1))
	var ds := PackedFloat32Array(); ds.resize((nx + 1) * (nz + 1))
	for j in nz + 1:
		for i in nx + 1: hs[j * (nx + 1) + i] = _land_h(x0 + i, z0 + j); ds[j * (nx + 1) + i] = _land_d(x0 + i, z0 + j)[0]
	for pass_i in 2:      # the land is worn smooth, away from the house
		var h2 := hs.duplicate()
		for j in range(1, nz):
			for i in range(1, nx):
				if ds[j * (nx + 1) + i] < 1.3: continue
				var sum := 0.0
				for dj in [-1, 0, 1]:
					for di in [-1, 0, 1]: sum += hs[(j + dj) * (nx + 1) + i + di]
				h2[j * (nx + 1) + i] = sum / 9.0
		hs = h2
	var groups := {"sand": [], "far": [], "rose": [], "leaf2": [], "leaf3": []}
	for j in nz:
		for i in nx:
			var cx := x0 + i + 0.5; var cz := z0 + j + 0.5
			var inside := false
			for f in land_rects:
				if cx > f[0] and cx < f[2] and cz > f[1] and cz < f[3]: inside = true; break
			if inside: continue
			var a := Vector3(x0 + i, hs[j * (nx + 1) + i], z0 + j); var b := Vector3(x0 + i + 1, hs[j * (nx + 1) + i + 1], z0 + j)
			var c := Vector3(x0 + i + 1, hs[(j + 1) * (nx + 1) + i + 1], z0 + j + 1); var d := Vector3(x0 + i, hs[(j + 1) * (nx + 1) + i], z0 + j + 1)
			if maxf(maxf(a.y, b.y), maxf(c.y, d.y)) < WATER - 0.25: continue      # (under the sea)
			var tris := [[a, b, c], [a, c, d]] if (i + j) % 2 == 0 else [[a, b, d], [b, c, d]]      # (clockwise from above: the side that is seen)
			var cell_y := (a.y + b.y + c.y + d.y) * 0.25; var cell_steep := maxf(maxf(a.y, b.y), maxf(c.y, d.y)) - minf(minf(a.y, b.y), minf(c.y, d.y))
			var n3 := _vnoise(cx * 0.11 + 31.0, cz * 0.11 + 9.0)
			var g := "sand" if cell_y < WATER + 0.06 else ("far" if (cell_y < WATER + 0.55 or cell_steep > 1.05) else ("rose" if (cell_y < WATER + 0.8 or n3 > 0.82) else ("leaf2" if n3 < 0.42 else "leaf3")))
			for t in tris:
				for v in t: (groups[g] as Array).append(v)
	for g in groups:
		var v := PackedVector3Array(groups[g] as Array)
		if v.is_empty(): continue
		var nn := PackedVector3Array(); nn.resize(v.size())
		for k in range(0, v.size(), 3):
			var fn := (v[k + 2] - v[k]).cross(v[k + 1] - v[k]).normalized()
			nn[k] = fn; nn[k + 1] = fn; nn[k + 2] = fn
		var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = nn
		var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var mi := prim(am, Vector3.ZERO, pal(g, "flat")); mi.name = "Island_" + g
		if OS.get_environment("LAND_DBG") != "": print("LAND ", g, " tris ", v.size() / 3, " aabb ", am.get_aabb())
	# what grows on it, and the rocks at its edge: nothing that would stand between the eye and a floor
	var gx := x0 + 1.3
	while gx < x1:
		var gz := z0 + 1.3
		while gz < z1:
			var r := _hash2(int(gx * 3.1), int(gz * 2.7)); var r2 := _hash2(int(gx * 1.7) + 91, int(gz * 4.3) + 17)
			var p := Vector3(gx + (r - 0.5) * 1.6, 0, gz + (r2 - 0.5) * 1.6)
			var gi := clampi(int(p.x - x0), 0, nx - 1); var gj := clampi(int(p.z - z0), 0, nz - 1)
			p.y = minf(minf(hs[gj * (nx + 1) + gi], hs[gj * (nx + 1) + gi + 1]), minf(hs[(gj + 1) * (nx + 1) + gi], hs[(gj + 1) * (nx + 1) + gi + 1]))
			var d: float = _land_d(p.x, p.z)[0]
			var tall := 0.0; var kind := ""
			if p.y > WATER + 0.85 and d > 2.2:
				if r < 0.2: kind = "cyp"; tall = 2.3 + 2.4 * r2
				elif r < 0.42: kind = "bush"; tall = 0.9
			elif p.y > WATER - 0.05 and p.y < WATER + 0.25 and d > 1.5 and r < 0.14: kind = "rock"
			elif p.y > WATER - 0.2 and p.y < WATER + 0.1 and d > 1.2 and r > 0.93: kind = "reeds"
			if kind != "" and tall > 0.0:      # would it hide a floor? (what stands h high hides what lies up to h behind it)
				for k in int(tall + p.y + 2.0):
					var bx := p.x - 0.5 - k; var bz := p.z - 0.5 - k
					for f in land_rects:
						if bx > f[0] - 0.4 and bx < f[2] + 0.4 and bz > f[1] - 0.4 and bz < f[3] + 0.4: kind = ""; break
					if kind == "": break
			match kind:
				"cyp": cypress(p, tall)
				"bush": bush(p + Vector3(0, -0.05, 0), 1.2 + 1.4 * r2, "leaf2" if r2 > 0.5 else "leaf3")
				"rock": rock(Vector3(p.x, 0, p.z), 0.6 + 0.8 * r2)
				"reeds": reeds(Vector3(p.x, 0, p.z))
			gz += 2.6
		gx += 2.6

## off the way: a garden path runs south from the fountain's court to a round temple without a roof, in the meadow.
## Nothing there is needed. Eight columns, three of them broken; in the middle, a statue of her, mourning
const TEMPLE := Vector3(-11.0, 0, -10.5)
func _temple() -> void:
	floor_plain(ARCH_X - 0.8, FZ1, ARCH_X + 0.8, TEMPLE.z - 4.0, 0.8); land_paths.append([ARCH_X - 0.8, FZ1, ARCH_X + 0.8, TEMPLE.z - 4.0])
	floor_plain(TEMPLE.x - 4.0, TEMPLE.z - 4.0, TEMPLE.x + 4.0, TEMPLE.z + 4.0, 1.0)
	for e in [-1.0, 1.0]:      # the path is marked by low posts
		for k in 3: blk(Vector3(ARCH_X + e * 0.74 - 0.07, 0, FZ1 + 0.4 + 1.1 * k), Vector3(ARCH_X + e * 0.74 + 0.07, 0.32, FZ1 + 0.54 + 1.1 * k), "shade")
	var tc := TEMPLE
	cyl(tc, 2.6, 2.7, 0.16, pal("shade"), 32); cyl(tc + Vector3(0, 0.16, 0), 2.4, 2.45, 0.14, pal("stone"), 32)
	for i in 8:
		var a := TAU * i / 8.0 + 0.2
		var cp := tc + Vector3(cos(a) * 2.0, 0.3, sin(a) * 2.0)
		var broken: bool = i in [1, 4, 6]
		column(cp, 1.0 + 0.6 * _hash2(i, 7) if broken else 2.7, 0.17, broken)
	for i in [7, 2]:      # what is left of its ring beam, on the columns that still stand side by side
		var a0: float = TAU * float(i) / 8.0 + 0.2; var a1: float = TAU * float(i + 1) / 8.0 + 0.2
		var m := tc + Vector3((cos(a0) + cos(a1)) * 1.0, 3.0 + 0.11, (sin(a0) + sin(a1)) * 1.0)
		var bm := blk(Vector3(-0.85, -0.11, -0.17), Vector3(0.85, 0.11, 0.17), "stone"); bm.position = m; bm.rotation.y = -(a0 + a1) * 0.5 + PI * 0.5
	her_plinth(tc + Vector3(0, 0.3, 0), 0.6, "mourn", self)
	for dk in [[2.9, 3.1, 0.4], [3.4, 2.6, 1.3], [-3.2, 3.0, 0.2]]:      # drums of the broken ones, where they rolled
		var dr := cyl(Vector3.ZERO, 0.17, 0.17, 0.5, pal("stone"), 12); dr.position = tc + Vector3(dk[0], 0.17, dk[1]); dr.rotation = Vector3(0, dk[2], PI * 0.5)
	stele("stele_t", tc + Vector3(3.2, 0, -3.2), 0.0, ["I built her a house\nwith no roof,\nso that she would never\nlook up for one.", "Rain is a water\nI could not forbid."])
	_look_add("", tc, 2.2, ["a round temple with no roof. she is in it, in stone, mourning", "eight columns. three were broken on purpose: the cuts are clean"])
	urn(tc + Vector3(-3.3, 0, -3.3), 1.1, "rose")

## what stands on the island beyond the courts: the things he left where they fell
func _landmarks() -> void:
	# a head of her, colossal, half under the sea off the harbour: the first thing she sees when she wakes
	sculpt_head(Vector3(7.6, WATER - 1.2, 15.2), 5.6, 0.7, Vector3(-0.2, 0, 0.16), 2)
	foam_ring(Vector3(7.6, 0, 15.4), 2.5, 0.45)
	# drums of a fallen column in the meadow west of the long basin, and a statue of her that was never finished
	for k in 4:
		var dp := Vector3(-8.2 - 0.75 * k, 0, -9.2 + 0.28 * k); dp.y = _land_h(dp.x, dp.z) + 0.2
		var dr := cyl(Vector3.ZERO, 0.2, 0.2, 0.62, pal("stone"), 12); dr.position = dp; dr.rotation = Vector3(0, 0.3 * k, PI * 0.5)
	var bs := Vector3(-19.5, 0, -19.0); bs.y = _land_h(bs.x, bs.z) - 0.05
	thing("broken_statue", bs, 2.2, "stone:marble", 0.7)

## the wings of the atrium. A script that extends this one builds its wing here (and calls super._wings() first);
## likewise _wing_things() for what can be tapped there and _wing_nav() for its floor
func _wings() -> void:
	pass
func _wing_things() -> void:
	pass
func _wing_nav() -> void:
	pass

## water runs along a dry channel: from point to point (each leg along x or along z), a band of running water grows
## at walking pace. Returns when it has reached the last point
func chan_run(pts: Array, speed := 2.2, w := 0.42) -> void:
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]
		var d := b - a; var l := d.length()
		if l < 0.01: continue
		var along_x := absf(d.x) > absf(d.z)
		var n := Node3D.new(); n.position = Vector3(a.x, 0.02, a.z); add_child(n)
		var q := QuadMesh.new(); q.size = Vector2(l, w * 2.0) if along_x else Vector2(w * 2.0, l); q.orientation = PlaneMesh.FACE_Y
		var mi := prim(q, Vector3(d.x * 0.5, 0, d.z * 0.5), water(Vector2(signf(d.x) * 0.5, 0) if along_x else Vector2(0, signf(d.z) * 0.5)), n)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		n.scale = Vector3(0.001, 1, 1) if along_x else Vector3(1, 1, 0.001)
		var g := create_tween(); g.tween_property(n, "scale", Vector3.ONE, l / speed)
		await g.finished

## a wing's water has been set free: when she is next in the atrium it runs down that wing's channel into the basin
func _wing_done(id: String) -> void:
	if id in wings_done: return
	wings_done.append(id); hub_pending.append(id)
	var all_built := true      # (a build in which some wing is not there yet: when every wing that is there has given its water, the others' waters come too, from under their shut doors, so that the chapter can be played to its end)
	for w in ["W", "N", "S"]:
		if wing_open[w] and not (w in wings_done): all_built = false
	if all_built:
		for w in ["W", "N", "S"]:
			if not wing_open[w] and not (w in wings_done): wings_done.append(w); hub_pending.append(w)
	print("WING done ", id, " (", wings_done.size(), " of 3)")

# ---------------------------------------------------------------- the atrium's water
var beyond := false       # what lies behind the Gate is built (by a script that extends this one)
var hub_n := 0            # how many waters have come into the basin
var hub_pending: Array = []
var hub_busy := false
var hub_gust := false     # a new water lies in the basin and no reflection has been sent over it yet

## the way a wing's water takes through the atrium, from its door to the basin's rim
func _hub_way(id: String) -> Array:
	match id:
		"W": return [Vector3(UX0 + 0.3, 0, UC.z), Vector3(UB.x, 0, UC.z), Vector3(UB.x, 0, UB.z + UBR)]
		"S": return [Vector3(-30.0, 0, UZ1 - 0.2), Vector3(-30.0, 0, -34.5), Vector3(-28.05, 0, -34.5)]
	return [Vector3(-19.5, 0, UZ0 + 0.3), Vector3(-19.5, 0, -39.0), Vector3(-21.75, 0, -39.0)]

## the basin's water stands at a level and lies so wide
func _u_set(level: float, rad: float) -> void:
	N["U_level"] = level; W["U"].level = level; W["U"].rad = rad; W["U"].r = [UB.x - rad, UB.z - rad, UB.x + rad, UB.z + rad]
	(N["U_mr"] as Node3D).position.y = 2.0 * level
	var gl: Node3D = N["U_glass"]; gl.position.y = level + 0.012; gl.scale = Vector3(rad * 2.0, 1, rad * 2.0)
	for m in N.get("U_umats", []): (m as ShaderMaterial).set_shader_parameter("level", level)
	for key in ["lampW", "lampE"]:      # the glare of each lamp lies where the water shows the lamp
		var c: Vector3 = N[key + "_c"]
		(N[key + "_glare"] as Node3D).position = Vector3(c.x + (c.y - level), level + 0.03, c.z + (c.y - level))

func _u_rise(level: float, rad: float, secs: float) -> void:
	var l0: float = N["U_level"]; var r0: float = W["U"].rad
	var t := create_tween(); t.tween_method(func(v: float) -> void: _u_set(lerpf(l0, level, v), lerpf(r0, rad, v)), 0.0, 1.0, secs).set_trans(Tween.TRANS_SINE)
	await t.finished

## the glare of the Gate's lamps on the water: there once the water lies wide enough to show them, and while they burn
func _u_glares(secs := 1.2) -> void:
	for key in ["lampW", "lampE"]:
		var gm: StandardMaterial3D = N[key + "_glare_m"]; var gl: Node3D = N[key + "_glare"]
		var to := 0.9 if (hub_n >= 2 and flags.get(key, true)) else 0.0
		if to > 0.0: gl.visible = true
		create_tween().tween_property(gm, "albedo_color:a", to, secs)

## where the basin's water lets her reflection stand, as things are: the floor round the basin; the Gate's stair once
## the second water has come; the landing once the third has, where no lamp's glare lies; the stone, where it is held
## over the cleft; the breach, and the far side of the Gate
func _u_foot() -> void:
	var F := {}
	for n in ["Us", "Uw", "Unw", "Ue", "Une", "Ucor"]:
		var r: Dictionary = rects[n]; F[n] = R(r.x0, r.z0, r.x1, r.z1, true, 0.0)
	var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	F["pl3"] = R(pl.x - 0.3, pl.z - 0.3, pl.x + 0.3, pl.z + 0.3, true, 0.17)
	for i in 5: F["st%d" % i] = R(STAIR_X - 0.42 * (i + 1), LAND_Z - 0.6, STAIR_X - 0.42 * i + (0.25 if i == 0 else 0.0), LAND_Z - 0.05, hub_n >= 2, 0.24 * (i + 1))
	var le: bool = hub_n >= 3 and not flags.get("lampE", true); var lw: bool = hub_n >= 3 and not flags.get("lampW", true)
	F["ldE"] = R(CLEFT_X1, UZ0 + 1.2, LAND_X1, LAND_Z - 0.05, le, POD_H)
	F["slab"] = R(CLEFT_X0 - 0.02, LAND_Z - 0.45, CLEFT_X1 + 0.02, LAND_Z - 0.05, le and flags.get("turn3", false), POD_H)
	F["ldW"] = R(LAND_X0 + 0.1, UZ0 + 1.2, CLEFT_X0, LAND_Z - 0.05, lw, POD_H)
	F["breach"] = R(BREACH_X0 + 0.05, UZ0 - 0.6, BREACH_X1 - 0.05, UZ0 + 1.25, lw, POD_H)
	F["back"] = R(BREACH_X0 + 0.05, UZ0 - 0.9, GATE_X + 0.8, UZ0 - 0.45, hub_n >= 3, POD_H)
	W["U"].foot = F
	W["U"].heads = [rects["Us"], rects["Uw"], rects["Unw"], rects["Ue"], rects["Une"], rects["Ucor"], F["pl3"]]
	if not refl_out.is_empty() and refl_w == "U" and _foot_of("U", (refl_out.holder as Node3D).position, 0.3) == "": _refl_melt()      # what it stood on is gone

## a water comes into the basin: down its channel from its wing's door, then the basin takes it. The first fills the
## floor of the basin and covers the lower step; the second covers the upper step; the third stands at the brim, at the
## Gate's feet. While it comes in the water is stirred and shows nothing; then it stills, and is a mirror
func _hub_fill(id: String) -> void:
	hub_busy = true; busy = true; route.clear(); pending = ""
	if not refl_out.is_empty(): await _refl_melt()
	var k := hub_n; var gm: ShaderMaterial = N["U_gm"]; var gl: Node3D = N["U_glass"]
	var s0 := cam.size
	cam_focus = UB + Vector3(-1.2, 0.2, -0.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 15.5, 1.8).set_trans(Tween.TRANS_SINE)
	await wait(0.8)
	await chan_run(_hub_way(id), 3.0)
	var veil := func(a: float, b: float, secs: float) -> void:
		var vt := create_tween(); vt.tween_method(func(v: float) -> void: gm.set_shader_parameter("veil", v), a, b, secs)
		await vt.finished
	if k == 0:
		_u_set(-0.43, 2.1); gm.set_shader_parameter("veil", 1.0); gm.set_shader_parameter("alpha", 0.0); gl.visible = true
		var f := create_tween(); f.tween_method(func(v: float) -> void: gm.set_shader_parameter("alpha", v), 0.0, 1.0, 1.0)
		await f.finished
		await _u_rise(-0.3, 2.1, 2.4); await _u_rise(-0.29, 3.0, 2.2)
		(N["u_b0"] as Node3D).visible = false; (N["u_pit"] as Node3D).visible = true; (N["U_mr"] as Node3D).visible = true; W["U"].wet = true
	elif k == 1:
		await veil.call(0.0, 1.0, 1.0)
		await _u_rise(-0.15, 3.0, 2.4); await _u_rise(-0.14, UBR, 2.2)
		(N["u_b1"] as Node3D).visible = false
	else:
		await veil.call(0.0, 1.0, 1.0)
		await _u_rise(-0.01, UBR, 2.8)
		(N["u_b2"] as Node3D).visible = false
	hub_n = k + 1; hub_gust = true
	if hub_n >= 3: done.erase("knots")
	await veil.call(1.0, 0.0, 2.0)
	_u_foot(); _u_glares()
	await wait(1.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.6).set_trans(Tween.TRANS_SINE)
	busy = false; hub_busy = false; settled.emit()
	print("HUB water ", hub_n, " level ", N["U_level"], " radius ", W["U"].rad)

## (for stills and runs) so many waters stand in the basin already
func _hub_instant(n: int) -> void:
	if n <= 0: return
	var gm: ShaderMaterial = N["U_gm"]
	hub_n = n; wings_done = ["W", "N", "S"].slice(0, n)
	_u_set([-0.29, -0.14, -0.01][n - 1], [3.0, UBR, UBR][n - 1])
	gm.set_shader_parameter("veil", 0.0); gm.set_shader_parameter("alpha", 1.0); (N["U_glass"] as Node3D).visible = true
	(N["u_b0"] as Node3D).visible = false; (N["u_pit"] as Node3D).visible = true; (N["U_mr"] as Node3D).visible = true; W["U"].wet = true
	if n >= 2: (N["u_b1"] as Node3D).visible = false
	if n >= 3: (N["u_b2"] as Node3D).visible = false; done.erase("knots")
	_u_foot(); _u_glares(0.1)

## a breath of wind crosses the basin: for as long as it lasts the water holds no image, and her reflection is back
## under her feet
func _gust() -> void:
	var gm: ShaderMaterial = N["U_gm"]
	if not refl_out.is_empty() and refl_w == "U": _refl_melt()
	var g := create_tween(); g.tween_method(func(v: float) -> void:
		gm.set_shader_parameter("wave", 1.0 + 8.0 * sin(v * PI)); gm.set_shader_parameter("blur_px", 0.6 + 6.0 * sin(v * PI)), 0.0, 1.0, 3.0)
	await g.finished

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
	stoa(-1.3, TZ0, TX1, TZ0 + 0.3)      # the north side, east of the sluice: a row of columns
	parapet(Vector3(TX1 - 0.1, 0, TZ0 + 0.4), Vector3(TX1 - 0.1, 0, TZ1 - 0.1)); parapet(Vector3(1.3, 0, TZ1 - 0.1), Vector3(TX1 - 0.1, 0, TZ1 - 0.1)); parapet(Vector3(TX0 + 0.4, 0, TZ1 - 0.1), Vector3(-1.3, 0, TZ1 - 0.1))
	channel(Vector3(-0.5, 0, TZ1 - 0.62), Vector3(-2.3, 0, TZ1 - 0.62)); channel(Vector3(-2.3, 0, TZ1 - 0.12), Vector3(-2.3, 0, TZ0 + 0.02)); channel(Vector3(0, 0, TZ1 - 1.12), Vector3(0, 0, TZ1))
	leaf("g2", Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_REAL), false, (TPX0 - TX0 - 0.3) * 0.5, 1.9)      # the grille above
	gate_slot(Vector3((TX0 + 0.3 + TPX0) * 0.5, 0, TG_REAL), (TPX0 - TX0 - 0.3) * 0.5, true)
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
	stoa(VX0, VZ0, VX1, VZ0 + 0.3)      # the north side: columns, and the hill behind them
	stoa(VX0, VZ0 + 0.3, VX0 + 0.3, -21.6); stoa(VX0, -20.0, VX0 + 0.3, VZ1)      # the west side, either side of the sluice
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
	stoa(FX0, FZ0 + 0.3, FX0 + 0.3, FZ1)      # the west side
	parapet(Vector3(FX1 - 0.1, 0, FZ0 + 0.4), Vector3(FX1 - 0.1, 0, -21.5)); parapet(Vector3(FX1 - 0.1, 0, -20.1), Vector3(FX1 - 0.1, 0, FZ1 - 0.1)); parapet(Vector3(FX0 + 0.4, 0, FZ1 - 0.1), Vector3(ARCH_X - 0.8, 0, FZ1 - 0.1)); parapet(Vector3(ARCH_X + 0.8, 0, FZ1 - 0.1), Vector3(FX1 - 0.1, 0, FZ1 - 0.1))
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

## I.7 the atrium. A great round basin, three steps deep, dry: all three waters of the house came together here.
## Three dry channels come in from the three wings, one goes down to the sea. The Gate stands at the basin's north
## rim on a landing, its stair coming down eastward along the wall: barred, tied, and covered with the one cloth.
## Two lamps burn on its piers by day. The basin lies south-east of the Gate: where a water must lie to show it
func _atrium() -> void:
	var n0 := get_child_count()
	_pool_court(UX0, UZ0, UX1, UZ1, UB.x - UBH, UB.z - UBH, UB.x + UBH, UB.z + UBH, "stone", "PoolSkyU")
	for c in get_children().slice(n0):      # this opening holds a stepped basin, not a pool: no kerb, and (while it is dry) nothing to see below
		var mi := c as MeshInstance3D
		if mi == null: continue
		if mi.name == "PoolSkyU": mi.visible = false; N["u_pit"] = mi
		elif mi.mesh is BoxMesh and absf((mi.mesh as BoxMesh).size.y - 0.04) < 0.001 and absf(mi.position.y - 0.02) < 0.001: remove_child(mi); mi.queue_free()
	_cs_deep_pit("PoolSkyU", 7.4)
	tile_hole = Rect2(UB.x - UBH, UB.z - UBH, UBH * 2.0, UBH * 2.0); tiles(UX0, UZ0, UX1, UZ1, 1.0); tile_hole = Rect2()
	cs_courts.append([UX0, UZ0, UX1, UZ1])
	var mr := _cs_water("U", UB.x - 2.1, UB.z - 2.1, UB.x + 2.1, UB.z + 2.1, -0.43, true)
	mr.visible = false
	var gm := _veil_glass(Color("d9cdb9")); (N["U_glass"] as MeshInstance3D).material_override = gm; (N["U_glass"] as Node3D).visible = false; N["U_gm"] = gm
	# the basin: a rim and two steps down to a round floor with a bronze drain. Each piece goes under the water in its turn
	turned(UB, [[UBH * 1.432, 0.006], [UBR, 0.006]], "stone", 64)
	turned(UB, [[UBR + 0.22, 0.01], [UBR, 0.01]], "shade", 64); turned(UB, [[UBH * 1.432, 0.008], [UBH * 1.432 - 0.1, 0.008]], "shade", 64)
	var b2 := Node3D.new(); add_child(b2); N["u_b2"] = b2; turned(UB, [[UBR, 0.006], [UBR, -0.15]], "stone", 64, b2)
	var b1 := Node3D.new(); add_child(b1); N["u_b1"] = b1; turned(UB, [[UBR, -0.15], [3.0, -0.15], [3.0, -0.3]], "stone", 64, b1)
	var b0 := Node3D.new(); add_child(b0); N["u_b0"] = b0; turned(UB, [[3.0, -0.3], [2.1, -0.3], [2.1, -0.45], [0.0, -0.45]], "stone", 64, b0)
	cyl(UB + Vector3(0, -0.45, 0), 0.3, 0.3, 0.012, pal("gold"), 24, b0)
	for a in 12: blk(Vector3(-0.012, 0, 0.45), Vector3(0.012, 0.004, 1.95), "shade", b0).transform = Transform3D(Basis(Vector3.UP, TAU * a / 12.0), UB + Vector3(0, -0.449, 0)) * Transform3D(Basis(), Vector3(0, 0, 1.2))
	# the half carvings on the risers, where the water will stand: each is made whole by its reflection
	for both in [b1, mr]:      # half a hand mirror, lying on the line of the first water
		var hc := Node3D.new(); hc.position = UB + Vector3(-0.7071, 0, -0.7071) * 2.985 + Vector3(0, -0.3, 0); hc.rotation.y = PI * 0.25; both.add_child(hc)
		var gmat: Material = _cs_umat("U", Color(UC_GOLD)) if both == mr else pal("gold")
		var dk := cyl(Vector3.ZERO, 0.13, 0.13, 0.014, gmat, 24, hc); dk.rotation.x = PI * 0.5
		var hb := blk(Vector3(0.12, -0.02, -0.007), Vector3(0.36, 0.02, 0.007), "gold", hc)
		if both == mr: hb.material_override = gmat
	for both in [b2, mr]:      # a small figure standing on the line of the second water: with its reflection, two joined at the feet. The lower one looks elsewhere
		var hc2 := Node3D.new(); hc2.position = UB + Vector3(-0.7071, 0, -0.7071) * 3.885 + Vector3(0, -0.15, 0); hc2.rotation.y = PI * 0.25; both.add_child(hc2)
		var gmat2: Material = _cs_umat("U", Color(UC_GOLD)) if both == mr else pal("gold")
		var bd := blk(Vector3(-0.016, 0.0, -0.007), Vector3(0.016, 0.085, 0.007), "gold", hc2)
		var hd := cyl(Vector3(0.028 if both == mr else 0.0, 0.108, 0), 0.024, 0.024, 0.014, gmat2, 12, hc2); hd.rotation.x = PI * 0.5
		if both == mr: bd.material_override = gmat2
	# the row of her along the basin's west rim: three statues and an empty place, which a chain ties to the Gate's bar
	var poses := ["calm", "pray", "", "mourn"]
	for both in [self, mr]:
		for i in ROW3_Z.size(): her_plinth(Vector3(ROW3_X, 0, ROW3_Z[i]), PI * 0.5, poses[i], both)
	_strip_refl(mr)
	var pl3 := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	blk(pl3 + Vector3(0.262, 0.09, -0.08), pl3 + Vector3(0.276, 0.13, 0.08), "gold")      # its name plate, blank
	# the landing and its stair
	blk(Vector3(LAND_X0, 0, UZ0 + 0.3), Vector3(LAND_X1, POD_H, LAND_Z), "stone"); blk(Vector3(LAND_X0 - 0.04, 0, UZ0 + 0.3), Vector3(LAND_X1, 0.16, LAND_Z + 0.04), "shade")
	cornice(LAND_X0, UZ0 + 0.3, LAND_X1, LAND_Z, POD_H - 0.06, 0.04, 0.06)
	for seg in [[LAND_X0, CLEFT_X0], [CLEFT_X1, LAND_X1]]:      # in the water it is broken through
		_ublk(Vector3(seg[0], 0, UZ0 + 0.3), Vector3(seg[1], POD_H - 0.05, LAND_Z), "stone", UC_STONE, false); _ublk(Vector3(seg[0], POD_H - 0.05, UZ0 + 0.3), Vector3(seg[1], POD_H, LAND_Z), "stone", UC_TOP, false)
	for rb in [[0.1, 0.0, 0.3, 0.22], [0.32, 0.12, 0.55, 0.3], [0.05, 0.4, 0.3, 0.16], [0.3, 0.75, 0.5, 0.2]]:
		_ublk(Vector3(CLEFT_X0 + rb[0], 0, LAND_Z - 1.0 + rb[1]), Vector3(CLEFT_X0 + rb[2], rb[3], LAND_Z - 0.75 + rb[1]), "stone", UC_SHADE, false)
	for k in 7:
		var sx := LAND_X1 + 0.3 * k; var top := POD_H - 0.15 * (k + 1)
		_ublk(Vector3(sx, 0, UZ0 + 0.3), Vector3(sx + 0.3, top, LAND_Z), "stone", UC_STONE if k % 2 == 0 else UC_TOP)
		blk(Vector3(sx + 0.3, top - 0.03, UZ0 + 0.3), Vector3(sx + 0.32, top, LAND_Z + 0.02), "shade")
	# the north wall, with the Gate and the door of the Spring in it. In the water it is breached beside the Gate
	wall(UX0, UZ0, GATE_X - 1.95, UZ0 + 0.3, 3.2); wall(GATE_X + 1.95, UZ0, -20.44, UZ0 + 0.3, 3.2); wall(-18.56, UZ0, UX1, UZ0 + 0.3, 3.2)
	blk(Vector3(-20.44, 2.35, UZ0), Vector3(-18.56, 3.2, UZ0 + 0.3), "stone")
	_ublk(Vector3(UX0, 0, UZ0), Vector3(BREACH_X0, 3.2, UZ0 + 0.3), "stone", UC_STONE, false); _ublk(Vector3(BREACH_X1, 0, UZ0), Vector3(GATE_X - 1.95, 3.2, UZ0 + 0.3), "stone", UC_STONE, false)
	_ublk(Vector3(BREACH_X0, POD_H + 2.05, UZ0), Vector3(BREACH_X1, 3.2, UZ0 + 0.3), "stone", UC_STONE, false); _ublk(Vector3(GATE_X + 1.95, 0, UZ0), Vector3(-21.0, 3.2, UZ0 + 0.3), "stone", UC_STONE, false)
	_ublk(Vector3(UX0, 3.2, UZ0 - 0.04), Vector3(-21.0, 3.26, UZ0 + 0.34), "stone", UC_SHADE, false)
	for rb in [[0.02, 0.12, 0.16], [0.3, 0.2, 0.1]]: _ublk(Vector3(BREACH_X0 + rb[0], POD_H, UZ0 + 0.32), Vector3(BREACH_X0 + rb[0] + rb[1], POD_H + rb[2], UZ0 + 0.5), "stone", UC_SHADE, false)
	for both in [self, mr]: _gate(both, both == mr)
	# the chain from the empty plinth to the bar: along the floor, up the landing, up the wall to a pulley by the pier
	_chain([pl3 + Vector3(-0.34, 0.02, 0), Vector3(LAND_X0 + 0.25, 0.02, pl3.z), Vector3(LAND_X0 + 0.25, 0.02, LAND_Z + 0.03), Vector3(LAND_X0 + 0.25, POD_H + 0.02, LAND_Z + 0.03), Vector3(LAND_X0 + 0.25, POD_H + 0.02, UZ0 + 0.34), Vector3(LAND_X0 + 0.25, 3.0, UZ0 + 0.34), Vector3(GATE_X - 2.1, 3.0, UZ0 + 0.34)])
	cyl(Vector3(GATE_X - 2.1, 2.93, UZ0 + 0.36), 0.07, 0.07, 0.03, pal("gold"), 12).rotation.x = PI * 0.5
	for both in [self, mr]: _turn3_build(both, both == mr)
	# the post that turns the statue: a pinion at the turntable's ring, a crank on top
	var p3 := TURN3 + Vector3(-0.47, 0, 0)
	blk(p3 + Vector3(-0.15, 0, -0.15), p3 + Vector3(0.15, 0.1, 0.15), "shade"); blk(p3 + Vector3(-0.1, 0.1, -0.1), p3 + Vector3(0.1, 0.84, 0.1), "stone")
	var pg := Node3D.new(); pg.position = p3 + Vector3(0, 0.03, 0); add_child(pg); _gear(pg, 0.16, 12, 0.04); N["p3_gear"] = pg
	var pt := Node3D.new(); pt.position = p3 + Vector3(0, 0.84, 0); add_child(pt); _gear(pt, 0.13, 12, 0.04); N["p3_top"] = pt
	var ch3 := _crank_handle(pt); ch3.position = Vector3(0, 0.1, 0); ch3.rotation = Vector3(-PI * 0.5, 0, 0); ch3.scale = Vector3.ONE * 0.85
	# the sides: an open row of columns to the west, either side of the Cistern's door; the forecourt's wall to the east
	stoa(UX0, UZ0 + 0.3, UX0 + 0.3, UC.z - 0.94, 2.9); stoa(UX0, UC.z + 0.94, UX0 + 0.3, UZ1, 2.9)
	sluice("doorW", Vector3(UX0 + 0.15, 0, UC.z), true, 0.6, 2.1); sluice("doorN", Vector3(-19.5, 0, UZ0 + 0.15), false, 0.6, 2.1); sluice("doorS", Vector3(-30.0, 0, UZ1 - 0.2), false, 0.6, 1.5)
	parapet(Vector3(UX0 + 0.4, 0, UZ1 - 0.1), Vector3(-30.95, 0, UZ1 - 0.1)); parapet(Vector3(-29.05, 0, UZ1 - 0.1), Vector3(UX1 - 0.1, 0, UZ1 - 0.1))
	parapet(Vector3(UX1 - 0.1, 0, GZ1 + 0.1), Vector3(UX1 - 0.1, 0, UZ1 - 0.1))
	wall(UX1 - 0.3, UZ0 + 0.3, UX1, GZ0, 3.2)
	# the channels: three come in, one goes down to the sea
	channel(Vector3(UX0 + 0.3, 0, UC.z), Vector3(UB.x + 0.5, 0, UC.z)); channel(Vector3(UB.x, 0, UC.z - 0.02), Vector3(UB.x, 0, UB.z + UBR + 0.05))
	channel(Vector3(-30.0, 0, UZ1 - 0.2), Vector3(-30.0, 0, -35.0)); channel(Vector3(-29.5, 0, -34.5), Vector3(-28.05, 0, -34.5))
	channel(Vector3(-19.5, 0, UZ0 + 0.3), Vector3(-19.5, 0, -38.5)); channel(Vector3(-20.0, 0, -39.0), Vector3(-21.75, 0, -39.0))
	channel(Vector3(UB.x + UBR + 0.05, 0, UB.z), Vector3(-17.0, 0, UB.z)); channel(Vector3(-17.5, 0, UB.z + 0.5), Vector3(-17.5, 0, DOOR6.z - 0.5)); channel(Vector3(-18.0, 0, DOOR6.z), Vector3(UX1, 0, DOOR6.z))
	stele("stele_7", Vector3(STAIR_X + 0.9, 0, UZ0 + 0.95), 0.0, ["This one I could not turn,\nor sink, or blind.\nSo I covered it.", "A pool this size shows too much.\nI let it run dry."])
	_look_add("ubasin", UB + Vector3(UBR - 0.4, 0, 1.2), 0.3, ["no water. no one", "three channels come in here, and one goes down to the sea"])
	_look_add("", Vector3(GATE_X + 1.7, POD_H, UZ0 + 1.15), 2.0, ["a lamp, burning by day", "its light falls where the water would be"])
	_look_add("", TURN3, 1.7, ["she holds out a stone, as if it were wanted somewhere", "a toothed ring under her feet, and a post beside it"])
	_look_add("", pl3, 0.4, ["an empty place. a chain goes from under it to the bar of the Gate", "it waits for a weight"])
	for dl in [[Vector3(UX0 + 0.3, 0, UC.z), "the channel of the cistern comes in under it"], [Vector3(-19.5, 0, UZ0 + 0.3), "the channel of the spring comes in under it"], [Vector3(-30.0, 0, UZ1 - 0.2), "the channel of the lamps comes in under it"]]:
		_look_add("", dl[0], 1.6, ["a door, shut", dl[1]])
	urn(Vector3(UX1 - 0.9, 0, UZ1 - 0.9), 1.0); urn(Vector3(UX0 + 0.9, 0, UZ1 - 0.9), 1.0, "rose"); cypress(Vector3(UX0 + 0.9, 0, UZ0 + 1.0), 2.8); cypress(Vector3(UX1 - 0.9, 0, UZ0 + 1.0), 2.8)
	W["U"] = {"r": [UB.x - 2.1, UB.z - 2.1, UB.x + 2.1, UB.z + 2.1], "round": true, "c": UB, "rad": 2.1, "level": -0.43, "mir": "mir_U", "wet": false, "far": 20.0, "heads": [], "foot": {}}
	WL.append("U")

## a piece of the atrium and its copy in the basin's water (in a plain colour of its own)
func _ublk(a: Vector3, b: Vector3, p: String, c: String, real := true, twin := true) -> void:
	if real: blk(a, b, p)
	if twin: blk(a, b, p, N["U_mr"]).material_override = _cs_umat("U", Color(c))

## the surface of a water that can lie as a film over stone before it shows anything: the glass, with a veil
func _veil_glass(veil_col: Color) -> ShaderMaterial:
	if not N.has("veil_sh"):
		var gsh := Shader.new(); gsh.code = SH_GLASS.replace("//GLINT", GLSL_GLINT).replace("uniform float time_s = 0.0;", "uniform float time_s = 0.0; uniform float veil = 0.0; uniform float alpha = 1.0; uniform vec3 veil_col : source_color = vec3(0.8);").replace("	ALBEDO = c;", "	c = mix(c, mix(veil_col, vec3(0.6, 0.85, 0.88), 0.18), veil);\n	ALBEDO = c; ALPHA = alpha;")
		N["veil_sh"] = gsh
	var gm := ShaderMaterial.new(); gm.shader = N["veil_sh"]; timed.append(gm)
	gm.set_shader_parameter("lost_a", 0.0); gm.set_shader_parameter("blur_px", 0.6); gm.set_shader_parameter("lod", 0.0); gm.set_shader_parameter("veil", 1.0); gm.set_shader_parameter("alpha", 0.0); gm.set_shader_parameter("veil_col", veil_col)
	return gm

## a chain laid from point to point: links, every other one turned
func _chain(pts: Array) -> void:
	var k := 0
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]; var l := a.distance_to(b); var d := (b - a) / l
		var t := 0.04
		while t < l:
			var lk := blk(Vector3(-0.034, -0.008, -0.016) if k % 2 == 0 else Vector3(-0.034, -0.016, -0.008), Vector3(0.034, 0.008, 0.016) if k % 2 == 0 else Vector3(0.034, 0.016, 0.008), "dark")
			lk.position = a + d * t
			if absf(d.y) > 0.9: lk.rotation.z = PI * 0.5
			else: lk.rotation.y = atan2(-d.z, d.x)
			t += 0.062; k += 1

## the Gate: two piers, an arch, two leaves of polished bronze under a bar, the cloth hung before them from a rod and
## tied with three cords that go round the piers to the far side; a lamp on each pier. (twin: its copy in the water)
func _gate(par: Node, twin: bool) -> void:
	var gx := GATE_X; var sfx := "_m" if twin else ""
	var B := func(a: Vector3, b: Vector3, p: String, c: String, to: Node = par) -> MeshInstance3D:
		var m := blk(a, b, p, to)
		if twin: m.material_override = _cs_umat("U", Color(c))
		return m
	for e in [-1.0, 1.0]:
		var px: float = gx + e * 1.7
		B.call(Vector3(px - 0.3, POD_H, UZ0 + 0.2), Vector3(px + 0.3, 5.0, UZ0 + 0.8), "stone", UC_STONE); B.call(Vector3(px - 0.34, POD_H, UZ0 + 0.16), Vector3(px + 0.34, POD_H + 0.2, UZ0 + 0.84), "shade", UC_SHADE)
		B.call(Vector3(px - 0.34, 4.86, UZ0 + 0.16), Vector3(px + 0.34, 5.0, UZ0 + 0.84), "shade", UC_SHADE); B.call(Vector3(px - 0.2, 5.36, UZ0 + 0.3), Vector3(px + 0.2, 5.54, UZ0 + 0.7), "stone", UC_STONE)
		var bl := ball(Vector3(px, 5.72, UZ0 + 0.5), 0.2, pal("gold"), par)
		if twin: bl.material_override = _cs_umat("U", Color(UC_GOLD))
	var gw := CSGBox3D.new(); gw.size = Vector3(4.0, 1.9, 0.6); gw.position = Vector3(gx, 4.42, UZ0 + 0.5); gw.material = _cs_umat("U", Color(UC_STONE)) if twin else pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = 1.4; gc.height = 0.8; gc.sides = 36
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -0.95, 0); gc.material = _cs_umat("U", Color(UC_SHADE)) if twin else pal("shade"); gw.add_child(gc); par.add_child(gw)
	if twin: B.call(Vector3(gx - 2.05, 5.36, UZ0 + 0.15), Vector3(gx + 2.05, 5.44, UZ0 + 0.85), "shade", UC_SHADE)
	else: cornice(gx - 2.0, UZ0 + 0.2, gx + 2.0, UZ0 + 0.8, 5.36, 0.05, 0.08)
	for e in [-1.0, 1.0]:      # the leaves: each hangs on its pier and swings inward
		var lf := Node3D.new(); lf.position = Vector3(gx + e * 1.4, POD_H, UZ0 + 0.4); par.add_child(lf); N[("leafL" if e < 0.0 else "leafR") + sfx] = lf
		B.call(Vector3(minf(0.0, -e * 1.4), 0, -0.04), Vector3(maxf(0.0, -e * 1.4), 2.26, 0.04), "gold", UC_GOLD, lf)
		for i in 10:      # its rounded head
			var y0 := 1.4 * i / 10.0; var y1 := 1.4 * (i + 1) / 10.0; var wdt := sqrt(maxf(1.96 - y0 * y0, 0.0)) + 0.02
			B.call(Vector3(minf(-e * 1.4, -e * 1.4 + e * wdt), 2.26 + y0, -0.04), Vector3(maxf(-e * 1.4, -e * 1.4 + e * wdt), 2.26 + y1, 0.04), "gold", UC_GOLD, lf)
		for ry in [0.25, 1.1, 2.05]: B.call(Vector3(minf(-e * 0.12, -e * 1.3), ry, 0.04), Vector3(maxf(-e * 0.12, -e * 1.3), ry + 0.05, 0.055), "shade", UC_SHADE, lf)      # its rails
		B.call(Vector3(-e * 1.3 - 0.03, 1.0, 0.04), Vector3(-e * 1.3 + 0.03, 1.3, 0.075), "dark", UC_DARK, lf)      # a ring to pull it by
	var bar := Node3D.new(); bar.position = Vector3(gx - 1.78, 2.5, UZ0 + 0.53); par.add_child(bar); N["bar" + sfx] = bar      # (it hangs by its west end, where the chain takes it)
	B.call(Vector3(0, 0, -0.07), Vector3(3.56, 0.22, 0.07), "dark", UC_DARK, bar)
	for e in [-1.0, 1.0]: B.call(Vector3(gx + e * 1.52 - 0.06, 2.36, UZ0 + 0.44), Vector3(gx + e * 1.52 + 0.06, 2.5, UZ0 + 0.64), "gold", UC_GOLD)      # the hooks it lies in
	# the cloth: it hangs in folds from a rod between the piers, down to a hand above the landing
	var veil := drape(Vector3(gx, 4.56, UZ0 + 0.92), 3.5, 4.56 - POD_H - 0.22, 20, _cs_umat("U", Color(UC_CRIM)) if twin else cloth(Color("d9553a"), Color("a63a26"), 0.5))
	if twin: veil.reparent(par, false)
	N["veil" + sfx] = veil
	var rod := cyl(Vector3.ZERO, 0.025, 0.025, 3.7, _cs_umat("U", Color(UC_GOLD)) if twin else pal("gold"), 8, par); rod.rotation.z = PI * 0.5; rod.position = Vector3(gx, 4.58, UZ0 + 0.9)
	var ci := 0
	for ry in [2.05, 2.85, 3.65]:      # the three cords that hold it shut
		var cd := Node3D.new(); cd.position = Vector3(gx, ry, UZ0 + 1.0); par.add_child(cd); N["cord%d%s" % [ci, sfx]] = cd; ci += 1
		B.call(Vector3(-2.02, 0, 0), Vector3(2.02, 0.035, 0.03), "rope", UC_ROPE, cd)
		for e in [-1.0, 1.0]: B.call(Vector3(e * 2.02 - 0.017, 0, -0.7), Vector3(e * 2.02 + 0.017, 0.035, 0.03), "rope", UC_ROPE, cd)
	if twin: return
	for e in [-1.0, 1.0]: _gate_lamp("lampW" if e < 0.0 else "lampE", gx + e * 1.7, 5 if e < 0.0 else 6)

## a lamp on a pier of the Gate: a bracket, a lantern on a short chain, over it a bronze cap that a pull-chain lets
## down; and the glare it throws on the basin's water, where that water holds no image
func _gate_lamp(key: String, px: float, li: int) -> void:
	var c := Vector3(px, 2.75, UZ0 + 1.15)
	blk(Vector3(px - 0.025, 3.12, UZ0 + 0.8), Vector3(px + 0.025, 3.16, UZ0 + 1.19), "gold"); blk(Vector3(px - 0.02, 2.95, UZ0 + 0.8), Vector3(px + 0.02, 3.12, UZ0 + 0.84), "gold")
	cyl(Vector3(px, 2.98, UZ0 + 1.15), 0.008, 0.008, 0.15, pal("dark"), 6)
	cyl(c + Vector3(0, -0.13, 0), 0.11, 0.09, 0.03, pal("gold"), 14); cyl(c + Vector3(0, 0.1, 0), 0.09, 0.11, 0.03, pal("gold"), 14)
	for a in 4: cyl(c + Vector3(cos(TAU * a / 4.0) * 0.09, -0.1, sin(TAU * a / 4.0) * 0.09), 0.008, 0.008, 0.2, pal("gold"), 6)
	var glow := cyl(c + Vector3(0, -0.1, 0), 0.07, 0.07, 0.2, pal("lamp"), 12); N[key + "_glow"] = glow
	var cap := cyl(Vector3.ZERO, 0.03, 0.15, 0.24, pal("gold"), 16); cap.position = c + Vector3(0, 0.2, 0); N[key + "_cap"] = cap
	var h := halo(0.9, Color(1.0, 0.8, 0.45, 0.5)); h.position = c; add_child(h); N[key + "_halo"] = h
	var pull := Node3D.new(); pull.position = Vector3(px + 0.2, POD_H + 1.42, UZ0 + 1.15); add_child(pull); N[key + "_pull"] = pull
	cyl(Vector3(0, 0.05, 0), 0.007, 0.007, 3.14 - (POD_H + 1.47), pal("dark"), 6, pull)
	var rg := TorusMesh.new(); rg.inner_radius = 0.03; rg.outer_radius = 0.05; rg.rings = 12; rg.ring_segments = 6
	prim(rg, Vector3.ZERO, pal("gold"), pull).rotation.x = PI * 0.5
	blk(Vector3(px + 0.18, 3.12, UZ0 + 1.13), Vector3(px + 0.22, 3.16, UZ0 + 1.17), "gold")
	lights[li] = Vector4(c.x, 0.2, c.z, 0.5)
	var gr := Gradient.new(); gr.offsets = PackedFloat32Array([0.0, 0.45, 1.0]); gr.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.75), Color(1, 1, 1, 0)])
	var gt := GradientTexture2D.new(); gt.gradient = gr; gt.fill = GradientTexture2D.FILL_RADIAL; gt.fill_from = Vector2(0.5, 0.5); gt.fill_to = Vector2(1.0, 0.5); gt.width = 128; gt.height = 128
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.albedo_texture = gt; gm.albedo_color = Color(1.0, 0.95, 0.8, 0.0); gm.render_priority = 4
	var q := QuadMesh.new(); q.size = Vector2(3.6, 3.6); q.orientation = PlaneMesh.FACE_Y
	var gl := prim(q, c, gm); gl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; gl.visible = false; N[key + "_glare"] = gl; N[key + "_glare_m"] = gm; N[key + "_c"] = c
	flags[key] = true      # it burns

## the statue at the landing's foot that holds a stone out on both hands, on a toothed turntable
func _turn3_build(par: Node, twin: bool) -> void:
	var st := her_statue(TURN3, 0.0, "offer", 1.0, par)
	var mid := Vector3(0, 1.12, 0.42)
	var sks := st.find_children("*", "Skeleton3D", true, false)
	if not sks.is_empty():
		var sk: Skeleton3D = sks[0]; var li := _bone(sk, "LeftHand"); var ri := _bone(sk, "RightHand")
		if li >= 0 and ri >= 0:
			var inv := st.global_transform.affine_inverse()
			mid = ((inv * (sk.global_transform * sk.get_bone_global_pose(li).origin)) + (inv * (sk.global_transform * sk.get_bone_global_pose(ri).origin))) * 0.5
	var dirf := Vector3(mid.x, 0, mid.z).normalized()
	var by := maxf(POD_H + 0.012 - (mid.y + 0.02), 0.03)
	st.position.y = by
	var sl := Node3D.new(); sl.position = mid + dirf * 0.14 + Vector3(0, 0.02 + 0.035, 0); sl.rotation.y = atan2(dirf.x, dirf.z); st.add_child(sl)
	var sb := blk(Vector3(-0.36, -0.035, -0.25), Vector3(0.36, 0.035, 0.25), "stone", sl)
	if twin: sb.material_override = _cs_umat("U", Color(UC_TOP))
	var yin := PI - atan2(dirf.x, dirf.z)
	st.rotation.y = yin + PI * 0.5      # it stands turned away: the stone held out over the floor to the west
	N["turn3" + ("_m" if twin else "")] = st
	if twin: return
	N["turn3_in"] = yin; flags["turn3"] = false
	var tt := Node3D.new(); tt.position = TURN3; tt.rotation.y = st.rotation.y; add_child(tt); N["turn3_tt"] = tt
	cyl(Vector3.ZERO, 0.24, 0.26, by, pal("stone"), 24, tt)
	var gr := Node3D.new(); gr.position = Vector3(0, 0.03, 0); tt.add_child(gr); _gear(gr, 0.29, 22, 0.04)

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
	for mk in cs_mirs:      # her mirrored bodies for the waters that lie below the floor
		var e: Dictionary = spawn_her(mk[1], "mirror"); H[mk[0]] = e
		if e.sk != null:
			var hm := HerMod.new(); hm.main = self; (e.sk as Skeleton3D).add_child(hm)
		if e.ap != null: (e.ap as AnimationPlayer).play("idle")
	_wing_things()
	objs["gate"] = {"at": Vector3(GATE_X, POD_H + 1.6, UZ0 + 0.9), "stand": Vector3(GATE_X, 0, UZ0 + 1.5), "mark": false, "hits": [Vector3(GATE_X, POD_H + 0.3, UZ0 + 0.9), Vector3(GATE_X, POD_H + 3.4, UZ0 + 0.9)]}
	objs["place6"] = {"at": pl + Vector3(0, 0.3, 0), "stand": pl + Vector3(0, 0, -0.72), "mark": false, "hits": [pl + Vector3(0, 0.02, 0), pl + Vector3(0, 0.5, 0)]}
	# the Gate's own things
	for key in ["lampW", "lampE"]:
		var lc: Vector3 = N[key + "_c"]
		objs[key] = {"at": lc, "stand": Vector3(lc.x + 0.2, 0, UZ0 + 1.45), "mark": false, "hits": [lc + Vector3(0, 0.3, 0), Vector3(lc.x + 0.2, POD_H + 1.3, lc.z)]}
	var p3 := TURN3 + Vector3(-0.47, 0, 0)
	objs["turn3"] = {"at": TURN3 + Vector3(0, 1.0, 0), "stand": p3 + Vector3(-0.5, 0, 0.08), "mark": false, "hits": [p3 + Vector3(0, 0.1, 0), p3 + Vector3(0, 0.95, 0), TURN3 + Vector3(0, 0.3, 0), TURN3 + Vector3(0, 1.6, 0)]}
	var pl3 := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	objs["place3"] = {"at": pl3 + Vector3(0, 0.3, 0), "stand": pl3 + Vector3(-0.72, 0, 0), "mark": false, "hits": [pl3 + Vector3(0, 0.02, 0), pl3 + Vector3(0, 0.5, 0)]}
	objs["knots"] = {"at": Vector3(GATE_X, 0, UZ0 + 1.0), "stand": pl3, "mark": false, "water": "U", "rstand": Vector3(GATE_X - 0.5, POD_H, UZ0 - 0.65), "hits": [Vector3(GATE_X, -2.1, UZ0 + 1.0), Vector3(GATE_X, -3.7, UZ0 + 1.0)]}
	done["knots"] = true      # (the water does not show the Gate until it stands at its feet)
	objs["bronze"] = {"at": Vector3(GATE_X, POD_H + 1.4, UZ0 + 0.45), "stand": pl3, "mark": false, "hits": [Vector3(GATE_X, POD_H + 0.2, UZ0 + 0.45), Vector3(GATE_X, POD_H + 3.2, UZ0 + 0.45)]}
	done["bronze"] = true      # (under the cloth)
	objs["through"] = {"at": Vector3(GATE_X, POD_H + 1.0, UZ0 + 0.4), "stand": Vector3(GATE_X, 0, UZ0 - 0.32), "mark": false, "hits": [Vector3(GATE_X, POD_H + 0.1, UZ0 + 0.4), Vector3(GATE_X, POD_H + 2.7, UZ0 + 0.4)]}
	done["through"] = true      # (while the Gate is shut)
	# her image in the bronze, for when the cloth is off it; the cloth as it will lie on the water; and folded
	var bi: Dictionary = spawn_her(self, "marble"); var bh: Node3D = bi.holder
	bh.position = Vector3(GATE_X, POD_H + 0.02, UZ0 + 0.5); bh.scale = Vector3(0.3, 0.3, 0.02); bh.visible = false; N["bronze_img"] = bh; N["bronze_ap"] = bi.ap
	var fv := PackedVector3Array(); var fn := PackedVector3Array(); var fu := PackedVector2Array()
	for i in 48:
		var a0 := TAU * i / 48.0; var a1 := TAU * (i + 1) / 48.0
		var r0 := 1.0 + 0.05 * sin(a0 * 5.0) + 0.035 * sin(a0 * 11.0 + 1.0); var r1 := 1.0 + 0.05 * sin(a1 * 5.0) + 0.035 * sin(a1 * 11.0 + 1.0)
		for q in [Vector3.ZERO, Vector3(cos(a1) * r1, 0, sin(a1) * r1), Vector3(cos(a0) * r0, 0, sin(a0) * r0)]:
			fv.append(q); fn.append(Vector3.UP); fu.append(Vector2(q.x * 0.5 + 0.5, q.z * 0.5 + 0.5))
	var farr := []; farr.resize(Mesh.ARRAY_MAX); farr[Mesh.ARRAY_VERTEX] = fv; farr[Mesh.ARRAY_NORMAL] = fn; farr[Mesh.ARRAY_TEX_UV] = fu
	var fam := ArrayMesh.new(); fam.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, farr)
	var cm := StandardMaterial3D.new(); cm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; cm.albedo_color = Color("cf5a40"); cm.cull_mode = BaseMaterial3D.CULL_DISABLED
	var fcl := prim(fam, Vector3(GATE_X + 0.8, 0.03, LAND_Z + 0.4), cm); fcl.scale = Vector3.ONE * 0.05; fcl.visible = false; fcl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; N["u_cloth"] = fcl
	for i in 7:      # its folds, as darker rings
		var rr := 0.2 + 0.11 * i
		var rm := TorusMesh.new(); rm.inner_radius = rr - 0.006; rm.outer_radius = rr + 0.006; rm.rings = 40; rm.ring_segments = 3
		var dm := StandardMaterial3D.new(); dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; dm.albedo_color = Color("a8402c")
		var rmi := prim(rm, Vector3(0.05 * sin(i * 2.1), 0.004, 0.05 * cos(i * 1.7)), dm, fcl); rmi.scale = Vector3(1, 0.2, 1)
	var fold := Node3D.new(); add_child(fold); fold.visible = false; N["cloth_fold"] = fold
	blk(Vector3(-0.13, 0, -0.1), Vector3(0.13, 0.03, 0.1), "crim", fold); blk(Vector3(-0.125, 0.03, -0.095), Vector3(0.12, 0.055, 0.095), "crim2", fold); blk(Vector3(-0.13, 0.055, -0.1), Vector3(0.1, 0.08, 0.09), "crim", fold)

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
	rects["Fp"] = R(ARCH_X - 0.45, FZ1 - 0.5, ARCH_X + 0.45, TEMPLE.z - 3.5)      # the garden path, and the walk round the temple
	rects["Ft1"] = R(TEMPLE.x - 3.55, TEMPLE.z - 3.55, TEMPLE.x + 3.55, TEMPLE.z - 3.0); rects["Ft2"] = R(TEMPLE.x - 3.55, TEMPLE.z + 3.0, TEMPLE.x + 3.55, TEMPLE.z + 3.55)
	rects["Ft3"] = R(TEMPLE.x - 3.55, TEMPLE.z - 3.55, TEMPLE.x - 3.0, TEMPLE.z + 3.55); rects["Ft4"] = R(TEMPLE.x + 3.0, TEMPLE.z - 3.55, TEMPLE.x + 3.55, TEMPLE.z + 3.55)
	solids.append(Vector3(TEMPLE.x + 3.2, TEMPLE.z - 3.2, 0.4))
	rects["Gs"] = R(GX0 + 0.8, GPZ1 + 0.3, GX1 - 0.45, GZ1 - 0.45); rects["Ge"] = R(GPX1 + 0.35, GZ0 + 0.8, GX1 - 0.45, GZ1 - 0.45)
	rects["Gw"] = R(GX0 + 0.8, GZ0 + 0.8, ROWW_X - 0.6, GZ1 - 0.45); rects["Gn"] = R(GX0 + 0.8, GZ0 + 0.8, GX1 - 0.45, ROW_Z - 0.6)
	rects["D6"] = R(GX0 - 0.7, DOOR6.z - 0.25, GX0 + 0.8, DOOR6.z + 0.25, false); rects["D6"].x0 = UX1 - 0.7
	var kb := UBH + 0.1      # she keeps this far from the middle of the basin
	rects["Us"] = R(UX0 + 0.8, UB.z + kb, UX1 - 0.45, UZ1 - 0.45); rects["Uw"] = R(UX0 + 0.8, LAND_Z + 0.3, UB.x - kb, UZ1 - 0.45)
	rects["Unw"] = R(UX0 + 0.8, UZ0 + 0.8, LAND_X0 - 0.3, LAND_Z + 0.35); rects["Ue"] = R(UB.x + kb, UZ0 + 0.8, UX1 - 0.75, UZ1 - 0.45)
	rects["Une"] = R(STAIR_X - 0.1, UZ0 + 0.8, UB.x + kb + 0.1, LAND_Z - 0.05)
	rects["Ucor"] = R(UB.x - kb - 0.1, LAND_Z + 0.3, TURN3.x - 0.9, LAND_Z + 0.7)      # the strip between the landing and the basin, as far as the statue's post
	rects["Ust"] = R(LAND_X1 - 0.05, UZ0 + 0.9, STAIR_X + 0.1, LAND_Z - 0.3); rects["Upod"] = R(LAND_X0 + 0.3, UZ0 + 1.25, LAND_X1 - 0.05, LAND_Z - 0.3)
	ramps = [{"r": rects["Ust"], "ax": "x", "z0": LAND_X1, "z1": STAIR_X, "y0": POD_H, "y1": 0.0}, {"r": rects["Upod"], "z0": 0.0, "z1": 1.0, "y0": POD_H, "y1": POD_H}]
	rects["Ugate"] = R(GATE_X - 0.55, UZ0 - 0.45, GATE_X + 0.55, UZ0 + 1.3, false)      # through the Gate, when it stands open
	ramps.append({"r": rects["Ugate"], "z0": 0.0, "z1": 1.0, "y0": POD_H, "y1": POD_H})
	for i in ROW3_Z.size(): solids.append(Vector3(ROW3_X, ROW3_Z[i], 0.45))
	solids.append(Vector3(TURN3.x, TURN3.z, 0.4)); solids.append(Vector3(STAIR_X + 0.9, UZ0 + 0.95, 0.4))
	# the doors of the wings: open from the start where a wing is built
	rects["DW"] = R(UX0 - 0.7, UC.z - 0.25, UX0 + 0.8, UC.z + 0.25, wing_open["W"]); rects["DN"] = R(-19.75, UZ0 - 0.7, -19.25, UZ0 + 0.8, wing_open["N"]); rects["DS"] = R(-30.25, UZ1 - 0.65, -29.75, UZ1 + 0.7, wing_open["S"])
	for wk in [["W", "doorW"], ["N", "doorN"], ["S", "doorS"]]:
		if wing_open[wk[0]]: (N[wk[1]] as Node3D).position.y = -(float(N[wk[1] + "_h"]) + 0.25)
	_wing_nav()
	_u_foot()
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
			if W[WL[i]].get("round", false) and _flat(g, W[WL[i]].c) > float(W[WL[i]].rad): continue
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
	var lvl := float(W[wid].get("level", 0.0))
	# the place that was meant, on whatever this water has to stand on, open or not. (A tap on the water names the
	# place whose image lies under the finger: what stands h over the water is seen h to the south-east of itself)
	var goal := to; var gn := ""; var gd := 1e9
	for n in F:
		var tn: Vector3 = (to - Vector3(1, 0, 1) * (float(F[n].h) - lvl)) if refl_img else to
		var c2 := _near_in(F[n], tn)
		var dd := _flat(c2, tn) + (0.0 if F[n].on else 0.15)
		if dd < gd: gd = dd; goal = c2; gn = n
	# the way there over all of it; what is shut costs dear, so a way that is open is taken if there is one
	var cost := {a: 0.0}; var prev := {a: ""}; var open_set := [a]
	while not open_set.is_empty():
		var c: String = open_set[0]
		for o in open_set:
			if cost[o] < cost[c]: c = o
		open_set.erase(c)
		for n in F:
			if n == c or absf(float(F[c].h) - float(F[n].h)) >= 0.3 or portal(F[c], F[n]) == null: continue
			var nc: float = cost[c] + (1.0 if F[n].on else 100.0)
			if not cost.has(n) or nc < cost[n] - 0.001:
				cost[n] = nc; prev[n] = c
				if not (n in open_set): open_set.append(n)
	var chain := []; var dest := goal
	if gn != "" and prev.has(gn):
		chain = [gn]
		while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
		for i in chain.size():      # it is walked as far as it is open
			if not F[chain[i]].on:
				var pr0: Array = portal(F[chain[i - 1]], F[chain[i]])
				dest = _near_in(F[chain[i - 1]], Vector3(clampf(goal.x, pr0[0], pr0[2]), 0, clampf(goal.z, pr0[1], pr0[3])))
				chain = chain.slice(0, i); break
	else:      # no way at all: as near as what can be reached comes to it
		var b := a; var bd := 1e9
		for n in prev:
			if cost[n] >= 100.0: continue
			var c3 := _near_in(F[n], goal)
			if _flat(c3, goal) < bd: bd = _flat(c3, goal); b = n; dest = c3
		chain = [b]
		while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
	var pts := []; var hs := []; var cur := from
	for i in range(chain.size() - 1):
		var pr: Array = portal(F[chain[i]], F[chain[i + 1]])
		var mid := cur.lerp(dest, 0.5)
		var pt := Vector3(clampf(mid.x, pr[0], pr[2]), 0, clampf(mid.z, pr[1], pr[3]))
		pts.append(pt); hs.append(float(F[chain[i + 1]].h)); cur = pt
	var last: String = chain[chain.size() - 1]
	pts.append(dest); hs.append(float(F[last].h))
	return {"pts": pts, "left": _flat(dest, goal) + (0.0 if last == gn else 0.3), "h": F[last].h, "hs": hs}

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
func _refl_walk_pts(e: Dictionary, pts: Array, hv, my: int, speed := 1.3) -> bool:      # hv: how high it stands, the whole way (a number) or at each point of it (a list)
	var hd: Node3D = e.holder
	(e.ap as AnimationPlayer).play("walk", 0.25); (e.ap as AnimationPlayer).speed_scale = clampf(speed / 1.1, 0.45, 2.3)
	for wi in pts.size():
		var wp: Vector3 = pts[wi]
		var h: float = float(hv[wi]) if hv is Array else float(hv)
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
		if not posing: face_to = Vector3(to.x, 0, to.z)
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
	if not await _refl_walk_pts(e, way.pts, way.hs, my): return false
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
	refl_img = true
	await _refl_to(WL[pi], to)
	refl_img = false
	if WL[pi] == "U" and hub_gust:      # the first time over a new water: a breath of wind takes the image away
		hub_gust = false
		await wait(0.9)
		await _gust()
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
	if started and not ended and not busy and flags.get("posed3", false):      # she stands as a statue on the empty place
		var px0 := get_viewport().get_visible_rect().size.x / 720.0
		if flags.get("stone3", false):      # and is stone: nothing answers but the bronze
			if _tap_dist("bronze", sp) < 70.0 * px0: _bronze()
			return
		if _water_under(sp) == null and not (not done.has("knots") and _tap_dist("knots", sp) < 64.0 * px0):
			_leave3(sp); return      # anything but an order to her reflection: she steps down first
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
	await face(Vector3(GATE_X, 0, UZ0))
	tgtR = Vector3(GATE_X - 0.12, POD_H + 1.28, UZ0 + 0.93)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.9); a.tween_property(self, "a_headp", -0.2, 0.9)
	await a.finished
	quote("gate", "Barred, and covered,\nand tied on the far side.", 4.5, true)
	await wait(3.2)
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.9); b.tween_property(self, "a_headp", 0.0, 0.9)
	await b.finished
	flags["gate_seen"] = true
	if wing_open["W"] or wing_open["N"] or wing_open["S"]: return      # the three ways stand open: the chapter goes on through them
	await wait(2.0)
	_end()

# ---------------------------------------------------------------- III.2 the Gate counts statues
func _do_lampW() -> void: await _lamp3("lampW", 5)
func _do_lampE() -> void: await _lamp3("lampE", 6)

## a lamp of the Gate: she pulls its chain. The cap comes down over the flame (or goes up off it), and the glare on
## the water goes with the flame
func _lamp3(key: String, li: int) -> void:
	var c: Vector3 = N[key + "_c"]; var pull: Node3D = N[key + "_pull"]; var cap: Node3D = N[key + "_cap"]; var glow: Node3D = N[key + "_glow"]; var hl: Node3D = N[key + "_halo"]
	var on: bool = flags[key]
	await face(Vector3(c.x + 0.2, 0, UZ0))
	tgtR = pull.global_position
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.8); a.tween_property(self, "a_headp", -0.3, 0.8)
	await a.finished
	var y0 := pull.position.y
	var d := create_tween().set_trans(Tween.TRANS_SINE); d.tween_method(func(v: float) -> void:
		pull.position.y = y0 - 0.14 * v; tgtR = pull.global_position, 0.0, 1.0, 0.5)
	await d.finished
	flags[key] = not on
	var t := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	t.tween_property(cap, "position:y", c.y + (-0.02 if on else 0.2), 0.7)
	t.tween_property(glow, "scale", Vector3.ONE * (0.05 if on else 1.0), 0.7)
	t.tween_property(hl, "scale", Vector3.ONE * (0.01 if on else 1.0), 0.9)
	t.tween_method(func(v: float) -> void: lights[li] = Vector4(c.x, 0.2, c.z, v), 0.5 if on else 0.0, 0.0 if on else 0.5, 0.9)
	_u_glares(1.0)
	await t.finished
	var u := create_tween().set_trans(Tween.TRANS_SINE); u.tween_method(func(v: float) -> void:
		pull.position.y = y0 - 0.14 * (1.0 - v); tgtR = pull.global_position, 0.0, 1.0, 0.5)
	await u.finished
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_headp", 0.0, 0.8)
	await b.finished
	_u_foot()

## the statue that holds a stone: she turns the crank of its post, and it turns a quarter: the stone over the
## landing's edge (in the water: into the cleft), or away again
func _do_turn3() -> void:
	var p3 := TURN3 + Vector3(-0.47, 0, 0); var pt: Node3D = N["p3_top"]; var pg: Node3D = N["p3_gear"]
	var to_in: bool = not flags["turn3"]
	await face(p3)
	if not to_in and not refl_out.is_empty() and refl_w == "U" and _foot_of("U", (refl_out.holder as Node3D).position, 0.1) == "slab": await _refl_melt()
	var grip := func() -> Vector3: return pt.global_transform * Vector3(0.25, 0.14, 0.0)
	tgtR = grip.call()
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(self, "a_lean", 0.1, 0.7)
	await a.finished
	var s0 := cam.size
	cam_focus = TURN3 + Vector3(0.9, 0.5, 1.0); cam_focus_on = true
	create_tween().tween_property(cam, "size", 8.0, 1.2).set_trans(Tween.TRANS_SINE)
	var yin: float = N["turn3_in"]; var y_from: float = (N["turn3"] as Node3D).rotation.y; var y_to := yin if to_in else yin + PI * 0.5
	var t0 := pt.rotation.y
	var tn := create_tween().set_trans(Tween.TRANS_SINE); tn.tween_method(func(v: float) -> void:
		var y := lerpf(y_from, y_to, v)
		(N["turn3"] as Node3D).rotation.y = y; (N["turn3_m"] as Node3D).rotation.y = y; (N["turn3_tt"] as Node3D).rotation.y = y
		pt.rotation.y = t0 + v * TAU * 2.0 * (-1.0 if to_in else 1.0); pg.rotation.y = pt.rotation.y
		tgtR = grip.call(), 0.0, 1.0, 3.4)
	await tn.finished
	flags["turn3"] = to_in
	_u_foot()
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.7); b.tween_property(self, "a_lean", 0.0, 0.7)
	await b.finished
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.2).set_trans(Tween.TRANS_SINE)

## the bar of the Gate goes up off its hooks (her weight is on the plinth) or comes down again; the cords with it
func _bar3(up: bool) -> void:
	var t := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	for sfx in ["", "_m"]:
		t.tween_property(N["bar" + sfx], "position:y", 2.95 if up else 2.5, 1.4)
		for i in 3:
			if not flags.get("untied", false): t.tween_property(N["cord%d%s" % [i, sfx]], "position:y", [2.05, 2.85, 3.65][i] - (0.07 if up else 0.0), 1.4)
	await t.finished

## the empty place of the row: she steps up and takes the stance. The chain draws tight and the bar lifts. She stays
## so until something else is asked of her
func _do_place3() -> void:
	var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	var s0 := cam.size
	cam_focus = Vector3(GATE_X + 1.4, 0.8, -39.4); cam_focus_on = true
	create_tween().tween_property(cam, "size", 12.0, 1.6).set_trans(Tween.TRANS_SINE)
	go([pl], 0.8)
	while pos.x < pl.x - 0.48: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.17, 0.45).set_trans(Tween.TRANS_SINE)
	await arrived
	await face(pl + Vector3(3.0, 0, 0))
	await wait(0.5)
	tgtL = pl + Vector3(0.21, 1.61, -0.03); tgtR = pl + Vector3(0.21, 1.61, 0.03)
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.2); up.tween_property(self, "a_wL", 1.0, 1.2)
	await up.finished
	posing = true; flags["posed3"] = true
	await _bar3(true)
	await wait(0.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## she steps down from the place (the bar comes down again), and then the tap that asked for it is taken
func _leave3(sp: Vector2) -> void:
	busy = true
	posing = false; flags["posed3"] = false
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.7); dn.tween_property(self, "a_wL", 0.0, 0.7)
	_bar3(false)
	await dn.finished
	var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	go([pl + Vector3(-0.72, 0, 0)], 0.8)
	while pos.x > pl.x - 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	busy = false; settled.emit()
	tap(sp)

## the knots, on the far side of the Gate: her reflection has come round to them through the breach. While the bar
## hangs on the cords they are tight as stone; when the bar is lifted they come away one by one, and the cloth falls
func _do_knots() -> void:
	var s0 := cam.size
	cam_focus = Vector3(GATE_X + 1.2, 1.8, UZ0 + 2.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 9.5, 1.4).set_trans(Tween.TRANS_SINE)
	await wait(1.0)
	if not flags.get("posed3", false):
		for k in 2:      # it pulls: the cord jumps, and holds
			var tw2 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
			for sfx in ["", "_m"]: tw2.tween_property(N["cord0" + sfx], "position:z", UZ0 + 0.965, 0.12)
			await tw2.finished
			var tw3 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
			for sfx in ["", "_m"]: tw3.tween_property(N["cord0" + sfx], "position:z", UZ0 + 1.0, 0.3)
			await tw3.finished
			await wait(0.25)
		say("the knots hold. the bar hangs on them")
		await wait(1.6)
		cam_focus_on = false
		create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
		return
	flags["untied"] = true
	for i in 3:      # one by one
		var j := 2 - i
		var pull := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
		for sfx in ["", "_m"]: pull.tween_property(N["cord%d%s" % [j, sfx]], "position:z", UZ0 + 0.95, 0.15)
		await pull.finished
		var fall := create_tween().set_parallel().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		for sfx in ["", "_m"]:
			fall.tween_property(N["cord%d%s" % [j, sfx]], "position:y", POD_H + 0.02, 0.55 + 0.12 * j); fall.tween_property(N["cord%d%s" % [j, sfx]], "position:z", UZ0 + 1.12, 0.55 + 0.12 * j)
		await fall.finished
		await wait(0.45)
	done["knots"] = true
	await _veil_fall()
	cam_focus = Vector3(ROW3_X + 2.2, 0.6, ROW3_Z[HERS3] + 0.4)
	create_tween().tween_property(cam, "size", 8.6, 1.8).set_trans(Tween.TRANS_SINE)
	await wait(2.0)
	cam_focus_on = false

## the cloth slides off the Gate, over the landing's edge into the basin, and spreads on the water. The water is
## covered: it shows nothing, her reflection is cut off behind the Gate, and she is stone on her plinth
func _veil_fall() -> void:
	var veil: Node3D = N["veil"]; var fcl: Node3D = N["u_cloth"]; var lvl: float = N["U_level"]
	(N["veil_m"] as Node3D).visible = false
	fcl.position = Vector3(GATE_X + 0.3, lvl + 0.03, LAND_Z + 0.5); fcl.scale = Vector3.ONE * 0.05; fcl.visible = true
	var t := create_tween().set_parallel()
	t.tween_property(veil, "position:y", POD_H + 0.5, 1.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.tween_property(veil, "scale:y", 0.12, 1.5).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.tween_property(veil, "position:z", LAND_Z - 0.1, 1.5).set_trans(Tween.TRANS_SINE)
	await t.finished
	var t2 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	t2.tween_property(veil, "scale", Vector3(0.3, 0.02, 0.3), 1.2); t2.tween_property(veil, "position:y", lvl + 0.1, 1.2); t2.tween_property(veil, "position:z", LAND_Z + 0.5, 1.2)
	t2.tween_property(fcl, "scale", Vector3.ONE * 1.4, 1.2)
	await t2.finished
	veil.visible = false
	flags["stone3"] = true; W["U"].wet = false; done.erase("bronze")
	for key in ["lampW", "lampE"]: create_tween().tween_property(N[key + "_glare_m"], "albedo_color:a", 0.0, 1.0)
	var t3 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	t3.tween_property(fcl, "scale", Vector3.ONE * (UBR - 0.12), 3.6); t3.tween_property(fcl, "position", Vector3(UB.x, lvl + 0.03, UB.z), 3.6)
	await t3.finished

## the Gate, uncovered, is polished bronze. In it her image comes nearer from the far side, and pushes: the leaves
## open. Then the cloth is drawn under the water and handed up to her at the foot of her plinth; she wakes
func _bronze() -> void:
	busy = true
	var s0 := cam.size
	cam_focus = Vector3(GATE_X + 1.0, 2.0, UZ0 + 2.4); cam_focus_on = true
	create_tween().tween_property(cam, "size", 8.2, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.2)
	var img: Node3D = N["bronze_img"]; var iap: AnimationPlayer = N["bronze_ap"]
	img.scale = Vector3(0.28, 0.28, 0.012); img.visible = true
	if iap != null: iap.play("walk")
	var ap := create_tween().set_trans(Tween.TRANS_SINE); ap.tween_property(img, "scale", Vector3(0.96, 0.96, 0.03), 3.2)
	await ap.finished
	if iap != null: iap.play("idle", 0.4)
	await wait(0.7)
	var op := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)      # it pushes: the bar is thrown off, the leaves swing in
	for sfx in ["", "_m"]:
		op.tween_property(N["bar" + sfx], "rotation:z", -1.45, 1.6)
		op.tween_property(N["leafL" + sfx], "rotation:y", 1.42, 3.0).set_delay(0.5); op.tween_property(N["leafR" + sfx], "rotation:y", -1.42, 3.0).set_delay(0.5)
	op.tween_property(img, "scale:x", 0.01, 1.4).set_delay(0.6)
	await op.finished
	img.visible = false
	rects["Ugate"].on = true; flags["gate_open"] = true; done["gate"] = true; done["bronze"] = true; done.erase("through")
	await wait(0.6)
	# the cloth goes under, drawn toward her; the water is a mirror again and her reflection is under her feet
	var fcl: Node3D = N["u_cloth"]; var lvl: float = N["U_level"]; var pl := Vector3(ROW3_X, 0, ROW3_Z[HERS3])
	var rim := Vector3(UB.x - UBR + 0.25, lvl, pl.z)
	cam_focus = pl + Vector3(1.6, 0.6, 0.6)
	create_tween().tween_property(cam, "size", 7.4, 1.8).set_trans(Tween.TRANS_SINE)
	var dr := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	dr.tween_property(fcl, "scale", Vector3.ONE * 0.12, 2.6); dr.tween_property(fcl, "position", rim + Vector3(0, 0.03, 0), 2.6)
	await dr.finished
	var sk := create_tween(); sk.tween_property(fcl, "position:y", lvl - 0.25, 0.6)
	await sk.finished
	fcl.visible = false
	W["U"].wet = true; flags["stone3"] = false
	if not refl_out.is_empty():
		refl_token += 1
		var e: Dictionary = refl_out; var hd: Node3D = e.holder
		hd.position = pos; hd.rotation.y = yaw; hd.scale = Vector3(1, 0.02, 1)
		H[refl_key] = e; refl_out = {}; refl_w = ""
		(e.ap as AnimationPlayer).play("idle", 0.3)
		var b0 := create_tween(); b0.tween_property(hd, "scale:y", 1.0, 0.5).set_trans(Tween.TRANS_SINE)
		await b0.finished
	_u_glares(1.0)
	# from hand to hand
	var fold: Node3D = N["cloth_fold"]
	fold.position = rim + Vector3(0, -0.05, 0); fold.scale = Vector3.ONE * 0.05; fold.visible = true
	var ri := create_tween().set_parallel().set_trans(Tween.TRANS_SINE); ri.tween_property(fold, "scale", Vector3.ONE, 0.6); ri.tween_property(fold, "position", pl + Vector3(0.42, 1.05, 0.05), 1.6)
	posing = false; flags["posed3"] = false
	tgtR = pl + Vector3(0.42, 1.08, 0.05)
	var dn := tw(); dn.tween_property(self, "a_wL", 0.0, 0.9); dn.tween_property(self, "a_headp", 0.25, 0.9)
	await ri.finished
	await wait(0.3)
	var tk := create_tween(); tk.tween_property(fold, "scale", Vector3.ONE * 0.02, 0.4)
	await tk.finished
	fold.visible = false
	_pocket_add("cloth")
	var hb := tw(); hb.tween_property(self, "a_wR", 0.0, 0.8); hb.tween_property(self, "a_headp", 0.0, 0.8)
	await hb.finished
	go([pl + Vector3(-0.72, 0, 0)], 0.8)
	while pos.x > pl.x - 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	done["place3"] = true
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.6).set_trans(Tween.TRANS_SINE)
	busy = false; settled.emit()
	print("GATE open; pocket ", pocket)

## the open Gate: she goes through
func _do_through() -> void:
	pass

## III.5: the basin overflows into the great channel, and the eye follows the water down past every gate she opened,
## to the shore where she woke
func _ch1_finale() -> void:
	busy = true; route.clear(); pending = ""
	var ways := [[Vector3(UB.x + UBR, 0, UB.z), Vector3(-17.5, 0, UB.z), Vector3(-17.5, 0, DOOR6.z), Vector3(GX0 + 1.25, 0, DOOR6.z), Vector3(GX0 + 1.25, 0, GZ1 - 1.0), Vector3(ARCH_X, 0, GZ1 - 1.0), Vector3(ARCH_X, 0, FPZ0)],
		[Vector3(ARCH_X, 0, FPZ1), Vector3(ARCH_X, 0, -20.8), Vector3(WELL.x - WELL_R, 0, -20.8)],
		[Vector3(-2.05, 0, WELL.z + WELL_R), Vector3(-2.05, 0, TZ0), Vector3(-2.3, 0, TZ0), Vector3(-2.3, 0, TZ1 - 0.62), Vector3(0, 0, TZ1 - 0.62), Vector3(0, 0, BZ0)]]
	cam_focus = UB; cam_focus_on = true
	create_tween().tween_property(cam, "size", 13.0, 2.0).set_trans(Tween.TRANS_SINE)
	await wait(2.2)
	var speed := 5.0
	for way in ways:
		var ct := create_tween()
		for i in range(1, way.size()): ct.tween_property(self, "cam_focus", way[i], (way[i] as Vector3).distance_to(way[i - 1]) / speed)
		await chan_run(way, speed)
		await wait(0.5)
	cam_focus = Vector3(0, 0, BZ0 + 3.0)
	create_tween().tween_property(cam, "size", 16.0, 3.0).set_trans(Tween.TRANS_SINE)
	await wait(1.5)
	quote("fin", "The water has found the sea again.", 5.0, true)
	await wait(5.5)
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
	if not refl_out.is_empty() and not busy and refl_w != "" and _rect_dist(pos, W[refl_w].r) > float(W[refl_w].get("far", 3.2)): _refl_melt()      # she has left that water
	var inside := false
	for c in cs_courts:
		if pos.x > c[0] and pos.x < c[2] and pos.z > c[1] and pos.z < c[3]: inside = true
	if H.has("mir"): (H["mir"].holder as Node3D).visible = not inside      # in a court whose water lies below the floor, that water's own body mirrors her
	if not hub_pending.is_empty() and not hub_busy and not busy and woke and pos.x > UX0 + 0.6 and pos.x < UX1 - 0.4 and pos.z > UZ0 and pos.z < UZ1: _hub_fill(hub_pending.pop_front())
	if flags.get("gate_open", false) and not beyond and not ended and not flags.get("fin", false) and pos.z < UZ0 - 0.15: flags["fin"] = true; _ch1_finale()
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
	if OS.get_environment("HUB") != "": _hub_instant(int(OS.get_environment("HUB")))
	if "hub" in args: _play_hub()
	if "gate" in args: _play_gate()
	if OS.get_environment("PATHCHK") != "":      # (a check of the floor's ways: "x,z,x,z")
		var pc := OS.get_environment("PATHCHK").split(",")
		print("PATH ", find_path(Vector3(float(pc[0]), 0, float(pc[1])), Vector3(float(pc[2]), 0, float(pc[3]))).size(), " points")

## stills. VIEWS="name,cx,cz,size[,px,pz,yaw];..." : the middle of the view on the ground, how many metres it holds
## across, and where she stands (away from everything, if not given)
func _views() -> void:
	started = true; title_box.hide(); hint.hide()
	if not woke: _wake_now()
	var dir := OS.get_environment("SHOT_DIR")
	await get_tree().create_timer(float(OS.get_environment("VIEW_WAIT")) if OS.get_environment("VIEW_WAIT") != "" else 2.0).timeout
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
	await _tap_wait(Vector3(GATE_X, POD_H + 1.6, UZ0 + 0.9))
	print("ACT1 I.7 at the gate: ", pos, " ended ", ended)
	get_tree().quit()

## (to try a later court) everything before it is done, and she stands at its entry
## the run that tries the atrium's water: each wing's water in turn, and how far her reflection gets toward the Gate
func _play_hub() -> void:
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)
	_wake_now(); _open_to("U")
	await wait(1.0)
	for id in ["W", "S", "N"]:
		_wing_done(id)
		while hub_pending.size() > 0 or hub_busy: await get_tree().process_frame
		await wait(0.5)
		await _tap_wait(Vector3(UB.x - 1.0, float(N["U_level"]), UB.z - 1.0))      # the water, toward the Gate
		print("HUB ", id, " reflection ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her", " she at ", pos)
		await wait(4.5)
		await _tap_wait(Vector3(GATE_X + 1.0, POD_H - 2.0 * (POD_H - float(N["U_level"])), LAND_Z - 0.3))      # the landing, as the water shows it
		print("HUB ", id, " to the landing: reflection ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
	get_tree().quit()

## the run that tries the Gate: the obvious plans first, then the way that works
func _play_gate() -> void:
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)
	_wake_now(); _open_to("U"); _hub_instant(3)
	await wait(1.0)
	var rp := func() -> String: return str((refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01)) if not refl_out.is_empty() else "under her"
	var knots := Vector3(GATE_X, -2.9, UZ0 + 1.0)
	await _tap_wait(knots)
	print("GATE 1 knots with the lamps burning: reflection ", rp.call())
	await _tap_wait(N["lampE_c"]); await _tap_wait(N["lampW_c"])
	print("GATE 2 lamps capped: E ", flags["lampE"], " W ", flags["lampW"], " she at ", pos)
	await _tap_wait(knots)
	print("GATE 3 knots with the cleft open: reflection ", rp.call())
	await _tap_wait(TURN3 + Vector3(0, 1.0, 0))
	print("GATE 4 the stone turned in: ", flags["turn3"], " she at ", pos)
	await _tap_wait(knots)
	print("GATE 5 knots with the bar down: reflection ", rp.call(), " untied ", flags.get("untied", false))
	await _tap_wait(Vector3(ROW3_X, 0.3, ROW3_Z[HERS3]))
	print("GATE 6 on the plinth: posed ", flags.get("posed3", false), " bar at ", (N["bar"] as Node3D).position.y)
	await _tap_wait(knots)
	print("GATE 7 knots with the bar up: untied ", flags.get("untied", false), " stone ", flags.get("stone3", false))
	await _tap_wait(Vector3(UX1 - 3.0, 0, UZ1 - 3.0))
	print("GATE 8 a tap on the floor: she at ", pos)
	await _tap_wait(Vector3(GATE_X, POD_H + 1.4, UZ0 + 0.45))
	print("GATE 9 the bronze: open ", flags.get("gate_open", false), " pocket ", pocket, " she at ", pos)
	_tap_at(Vector3(GATE_X, POD_H + 1.2, UZ0 + 0.4))
	while not flags.get("fin", false): await get_tree().process_frame
	print("GATE 10 through: she at ", pos, " fin ", flags.get("fin", false))
	while not ended: await get_tree().process_frame
	print("GATE ended ", ended)
	get_tree().quit()

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
