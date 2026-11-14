extends "res://ch1.gd"
## EIDOLON, chapter 1: the wing of the Spring ("the water he shut"). The garden of his trials: hands and stances.
## Four courts north of the atrium, on one dry channel:
##   P.1 the gilded palm            a round pool with an islet, and one colossus on its rim
##   P.2 from hand to hand          a long pool, three colossi; the first two are geared together
##   P.3 what each one wants        an exedra of five places on a rail, four statues, a basin before them
##   P.4 the missing Caryatid       the spring house: six places, five Caryatids, and a colossus beside its pool
## How a gilded palm is footing. The eye never moves, so what stands h metres over a water is seen in it h metres
## to the south-east (x + h, z + h). Her reflection lives in that picture: a palm held 3.75 m up is footing for it
## where the palm is SEEN in the water, at the level of the water. (That is the same picture as "it stands on the
## mirrored palm, 3.75 m deep": only there do the two agree, and a step on or off is a step and not a slide.)

# ---------------------------------------------------------------- a colossus with a gilded palm
const SP_H := 3.75          # how high it holds its palm
const SP_R := 1.6           # how far from its axis
const SP_PLATE := 0.45      # the gilded plate on that palm: its radius
const SP_STEP := 0.75       # half the side of the footing a palm gives: the plate, and a step round it
const SP_SC := 2.5          # the statue, against her own size
const SP_PK := 1.9          # its plinth (the geared plinth of the turned ones), across...
const SP_PKV := 0.95        # ...and in height
const SP_TOP := 0.582       # where the statue stands on it
const SP_HAND_Y := 1.3      # where she lays her hands on the marble to turn it
const SP_STAND := 1.02      # and how far from the axis she stands
const SP_IDLER_N := 25      # the idle wheels between two geared plinths: teeth, and radius (the same pitch as the plinth's 28)
const SP_IDLER_R := 0.7107
const SP_GEAR_R := 0.796    # the plinth's own wheel
# ---------------------------------------------------------------- P.1 the gilded palm
const SP1_X0 := -20.75
const SP1_X1 := -5.2
const SP1_Z0 := -60.0
const SP1_Z1 := -46.5
const SP1_C := Vector3(-10.45, 0, -51.9)      # the middle of the round pool
const SP1_R := 4.21
const SP1_S := Vector3(-14.5, 0, -57.75)      # the colossus (its palm is seen about (-10.75, -54.0))
const SP1_ISLE := Vector3(-10.75, 0, -51.0)   # the islet
const SP1_LEVER := Vector3(-10.5, 0, -50.75)
# ---------------------------------------------------------------- the lane north (the spine of the wing: the dry channel runs along it)
const SPL_X0 := -20.3
const SPL_X1 := -18.7
# ---------------------------------------------------------------- P.2 from hand to hand
const SP2_X0 := -31.65
const SP2_X1 := -18.7
const SP2_Z0 := -77.5
const SP2_Z1 := -60.8
const SP2_SX := -29.2                        # the row of three stands along the west rim, on this line
const SP2_AZ := -76.1                        # the first of them; the others follow southward
const SP2_D := 4.2075                        # from one to the next: the two great wheels and two idle wheels of 23 teeth between them
const SP2_IDLER_N := 23
const SP2_IDLER_R := 0.6539
const SP2_QX0 := -27.9                       # its pool
const SP2_QX1 := -20.9
const SP2_QZ0 := -74.45
const SP2_QZ1 := -61.6
const SP2_ISLE := Vector3(-22.5, 0, -63.935) # the islet where the third palm sets her down
const SP2_LEVER := Vector3(-22.35, 0, -63.75)
const SP2_DOOR := Vector3(-18.55, 0, -65.4)  # the sluice it opens: the door of the third court, in the lane's east side
const SP2_IDLER_YAW := [91.285, 88.72]       # how the two idle wheels stand, so that their teeth lie in the gaps of their neighbours (degrees)
const SP2_B_OFF := -4.32                     # and by how much the second's own wheel is set round on its drum for the same
# ---------------------------------------------------------------- P.3 what each one wants
const SP3_X0 := -18.7
const SP3_X1 := -6.9
const SP3_Z0 := -73.9
const SP3_Z1 := -63.2
const SP3_C := Vector3(-12.4, 0, -68.6)      # the middle of the exedra's curve
const SP3_RA := 3.6                          # the five places stand on this curve...
const SP3_RI := 2.85                         # ...and the rail that joins them runs on this one
const SP3_P := Vector3(-11.4, 0, -67.6)      # the round basin before them
const SP3_PR := 3.5
const SP3_SEA := Vector3(27.6, 0, -74.6)     # where the one that wants the sea looks: far out to the east
const SP3_NAMES := ["the sea", "the wall", "the one beside it", "the empty place"]
const SP3_POSES := ["reach", "mourn", "pray", "calm"]
# ---------------------------------------------------------------- P.4 the missing Caryatid
const SP4_X0 := -21.0
const SP4_X1 := -5.8
const SP4_Z0 := -86.0
const SP4_Z1 := -78.1
const SP4_QX0 := -14.5                       # the pool before the spring house
const SP4_QX1 := -6.6
const SP4_QZ0 := -84.1
const SP4_QZ1 := -78.9
const SP4_HX0 := -14.6                       # the house: its west end, its east end, its front
const SP4_HX1 := -6.85
const SP4_HZ := -85.0
const SP4_HH := 2.6
const SP4_ROW := -84.5                       # the row of six under the beam stands on this line
const SP4_PL := Vector3(-13.95, 0, -84.5)    # the sixth place: hers
const SP4_CAR := [-11.05, -10.15, -9.25, -8.35, -7.45]      # the five
const SP4_DOOR_X := -12.5                    # the middle of the door
const SP4_JOINT := Vector3(-11.75, 2.12, -84.475)      # where the beam is broken: the piece west of here hangs
const SP4_SAG := 0.098                       # by how much (radians)
const SP4_S := Vector3(-17.65, 0, -83.25)    # the colossus on the west rim
const SP4_T := Vector3(-12.5, 0, -81.1)      # the round landing at the end of the door's jetty
const SP4_LEVER := Vector3(-16.3, 0, -80.75) # the lever of the head-gate
const SP4_GATE := Vector3(-15.3, 0, -79.7)   # the head-gate, across the channel where it leaves the pool
const SP4_KEEP := Vector3(-11.75, 1.2, -84.07)      # the keeper where the pin hangs, on the front post of the east grille
const SP4_HOLE := Vector3(-11.95, 1.96, -84.17)     # and the hole it belongs in, in the hasp that hangs under the break

var sp_col := {}      # the colossi, by name: {"p": foot, "q": which quarter the arm points to (0 north, 1 east, 2 south, 3 west), "w": its water, "pair": the one geared to it, "view": where the eye rests while it turns}
var sp_chan: Array = []      # the course of the water once the spring runs: [from, to] pieces, in order
var sp3_at := [2, 1, 0, 3]   # at which of the five places each of the four stands (0: the end by the opening .. 4: the end by the wall), in the order of SP3_NAMES
var sp3_sol := []            # where each of them is in the list of things she walks round
var sp3_h := []              # their heads, and their twins': [statue * 2 + (1 for the twin)] = {"sk", "ni", "hi", "n0", "h0", "yaw", "bow"}

func _init() -> void:
	super._init(); wing_open["N"] = true

func _hollows() -> Array:
	return super._hollows() + [[SP1_X0 + 0.5, SP1_Z0 + 0.5, SP1_X1 - 0.5, SP1_Z1 - 0.5], [SP2_X0 + 0.5, SP2_Z0 + 0.5, SP2_X1 - 0.5, SP2_Z1 - 0.5],
		[SP3_X0 + 0.5, SP3_Z0 + 0.5, SP3_X1 - 0.5, SP3_Z1 - 0.5], [SP4_X0 + 0.5, SP4_Z0 + 0.5, SP4_X1 - 0.5, SP4_Z1 - 0.5]]

func _wings() -> void:
	super._wings()
	_sp_court1(); _sp_court2(); _sp_court3(); _sp_court4()

func _wing_things() -> void:
	super._wing_things()
	_sp_things1(); _sp_things2(); _sp_things3(); _sp_things4()

func _wing_nav() -> void:
	super._wing_nav()
	_sp_nav1(); _sp_nav2(); _sp_nav3(); _sp_nav4()

func _ready() -> void:
	super._ready()
	if "spring" in OS.get_cmdline_user_args(): _play_spring()

# ---------------------------------------------------------------- small builders
## the pit of a pool court made deep enough for what stands tall over its water (the colossi), and shut off from
## the sea round it below the court's own base
func _sp_pit(nm: String, depth: float) -> void:
	var pit := get_node_or_null(nm) as MeshInstance3D
	if pit == null: return
	var pm := pit.mesh as BoxMesh
	pm.size = Vector3(pm.size.x, depth, pm.size.z); pit.position.y = -0.185 - depth * 0.5
	var x0 := pit.position.x - pm.size.x * 0.5; var x1 := pit.position.x + pm.size.x * 0.5
	var z0 := pit.position.z - pm.size.z * 0.5; var z1 := pit.position.z + pm.size.z * 0.5
	blk(Vector3(x0 - 0.3, -0.3 - depth, z1 + 0.02), Vector3(x1 + 0.3, -2.44, z1 + 0.06), "dark").material_override = mat(bg_c)
	blk(Vector3(x1 + 0.02, -0.3 - depth, z0 - 0.3), Vector3(x1 + 0.06, -2.44, z1 + 0.06), "dark").material_override = mat(bg_c)

## points along an arc about c, from angle a0 to a1 (degrees, measured from +x toward +z)
func _sp_arc(c: Vector3, r: float, a0: float, a1: float, n: int) -> Array:
	var out := []
	for i in n + 1:
		var a := deg_to_rad(lerpf(a0, a1, float(i) / n))
		out.append(c + Vector3(cos(a), 0, sin(a)) * r)
	return out

## a slab of the floor that covers a corner of a pool's opening, from the corner out to a line of points: its top
## lies level with the kerb, and its edge goes down into the water
func _sp_cover(corner: Vector3, pts: Array, pl := "stone", top_y := 0.04) -> void:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	var top := Vector3(0, top_y, 0); var low := Vector3(0, -0.3, 0)
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]; var b: Vector3 = pts[i + 1]
		for q in [corner + top, a + top, b + top]:
			v.append(q); n.append(Vector3.UP)
		var out := Vector3(-(b.z - a.z), 0, b.x - a.x).normalized()
		if out.dot(a - corner) < 0.0: out = -out
		for q in [a + top, b + top, b + low, a + top, b + low, a + low]:
			v.append(q); n.append(out)
	var arr := []; arr.resize(Mesh.ARRAY_MAX); arr[Mesh.ARRAY_VERTEX] = v; arr[Mesh.ARRAY_NORMAL] = n
	var am := ArrayMesh.new(); am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	prim(am, Vector3.ZERO, pal(pl, "2"))

func _sp_mid(r: Dictionary) -> Vector3:
	return Vector3((r.x0 + r.x1) * 0.5, 0, (r.z0 + r.z1) * 0.5)

## a piece of the dry channel, remembered as part of the water's course from the spring to the door
func _sp_chan(a: Vector3, b: Vector3, course := true) -> void:
	channel(a, b)
	if course: sp_chan.append([a, b])

# ---------------------------------------------------------------- the colossus
func _sp_yaw(q: int) -> float:
	return PI - q * PI * 0.5

## where its palm is seen in the water (and is footing), as it stands now
func _sp_palm(key: String) -> Vector3:
	var c: Dictionary = sp_col[key]
	var a: float = (N["sp_col_" + key] as Node3D).rotation.y
	return c.p + Vector3(SP_H, 0, SP_H) + Vector3(sin(a), 0, cos(a)) * SP_R

## where the palm itself is, in the air
func _sp_palm_real(key: String) -> Vector3:
	var c: Dictionary = sp_col[key]
	var a: float = (N["sp_col_" + key] as Node3D).rotation.y
	return c.p + Vector3(0, SP_H, 0) + Vector3(sin(a), 0, cos(a)) * SP_R

## a colossus of her on a geared plinth, an arm held out with a gilded plate on its open palm; and its twin in the
## water. q: the quarter it points to. wid: the water it is seen in
func _sp_colossus(key: String, p: Vector3, q: int, wid: String, view: Vector3, pinion := true, wheel_off := 0.0, size := 9.4) -> void:
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var sfx := "_m" if twin else ""
		var flat := "flat2" if twin else "flat"
		var pb := prop_model("plinth_base", both, 0.0, 0.0, twin, false, "stone:marble,gold:marble,crim:crim"); pb.position = p; pb.scale = Vector3(SP_PK, SP_PKV, SP_PK)
		cyl(p + Vector3(0, 0.078 * SP_PKV, 0), 0.4615 * SP_PK + 0.006, 0.4615 * SP_PK + 0.006, 0.02 * SP_PKV, pal("gold", flat), 40, both)
		for t in 4:      # the four quarters, marked in bronze on the lower step
			var tk := blk(Vector3(-0.03, 0.0, -0.035), Vector3(0.03, 0.02, 0.035), "gold", both); tk.rotation.y = t * PI * 0.5
			tk.position = p + Vector3(sin(t * PI * 0.5), 0, cos(t * PI * 0.5)) * 0.483 * SP_PK + Vector3(0, 0.048 * SP_PKV, 0)
		var n := Node3D.new(); n.position = p; n.rotation.y = _sp_yaw(q); both.add_child(n)
		var pt := prop_model("plinth_top", n, 0.0, 0.0, twin, false, PLINTH_PARTS); pt.scale = Vector3(SP_PK, SP_PKV, SP_PK); pt.rotation.y += deg_to_rad(wheel_off)      # (wheel_off: the wheel's teeth set round a little, to meet a train's)
		_sp_colossus_body(n, twin)
		N["sp_col_" + key + sfx] = n
		if pinion:      # the small wheel beside it, its teeth in the great wheel's
			var sd := deg_to_rad(PINION_SIDE)
			var at := p + Vector3(sin(sd), 0.0, cos(sd)) * PINION_OFF * SP_PK
			var lug := 0.047 * SP_PKV
			cyl(at, 0.2, 0.2, lug, pal("marble", flat), 20, both); cyl(at + Vector3(0, lug, 0), 0.13, 0.16, PLINTH_CUT * SP_PKV - lug, pal("shade"), 12, both)
			var pin := Node3D.new(); pin.position = at + Vector3(0, PLINTH_CUT * SP_PKV, 0); pin.rotation.y = _pinion_yaw(n.rotation.y); both.add_child(pin)
			var pr := PINION_R * SP_PK
			prop_model("pinion", pin, 0.0, 0.0, twin, false, "stone:gold,gold:gold").scale = Vector3(pr * 2.0, pr * 2.0 * 0.45, pr * 2.0)
			N["sp_pin_" + key + sfx] = pin
	sp_col[key] = {"p": p, "q": q, "w": wid, "pair": "", "view": view, "size": size}

## the statue on its plinth: she leans forward a little and holds her right arm out, the palm up and open, a
## gilded plate on it. The plate lies exactly SP_R from the axis and SP_H up; the arm is brought to it
func _sp_colossus_body(n: Node3D, twin: bool) -> void:
	var st := her_statue(Vector3(0, SP_TOP, 0), 0.0, "calm", SP_SC, n)
	var sks := st.find_children("*", "Skeleton3D", true, false)
	if not sks.is_empty():
		var sk: Skeleton3D = sks[0]
		var la := _bone(sk, "LeftArm"); var ra := _bone(sk, "RightArm"); var hi := _bone(sk, "RightHand"); var mi := _bone(sk, "RightHandMiddle1")
		var left := (sk.get_bone_global_pose(la).origin - sk.get_bone_global_pose(ra).origin).normalized()
		var to_n := n.global_transform.affine_inverse() * sk.global_transform      # from the skeleton's own space to the turning part's
		var sc := to_n.basis.get_scale().x
		var want := Vector3(0.0, SP_H - 0.1, SP_R - 0.02)      # where the middle of the palm must lie: under the plate
		var reach := ((sk.get_bone_global_pose(hi).origin - sk.get_bone_global_pose(ra).origin).length() + 0.5 * (sk.get_bone_global_pose(mi).origin - sk.get_bone_global_pose(hi).origin).length()) * sc
		var z0 := (to_n * sk.get_bone_global_pose(ra).origin).z
		_bend(sk, "Spine", left, 0.02)
		var sgn := 1.0 if (to_n * sk.get_bone_global_pose(ra).origin).z > z0 else -1.0
		for i in 45:      # she leans until the palm reaches
			if (want - to_n * sk.get_bone_global_pose(ra).origin).length() <= reach: break
			_bend(sk, "Spine", left, 0.02 * sgn)
		var dir := (to_n.affine_inverse() * want - sk.get_bone_global_pose(ra).origin).normalized()
		_aim(sk, "RightArm", "RightForeArm", dir); _aim(sk, "RightForeArm", "RightHand", dir)
		var ii := _bone(sk, "RightHandIndex1"); var pi := _bone(sk, "RightHandPinky1")
		if ii >= 0 and pi >= 0 and mi >= 0:      # the hand: fingers on along the arm, the palm turned up
			var gh := sk.get_bone_global_pose(hi)
			var a := (sk.get_bone_global_pose(mi).origin - gh.origin).normalized()
			var c := sk.get_bone_global_pose(ii).origin - sk.get_bone_global_pose(pi).origin
			var pn := c.cross(a).normalized()
			var upv := (Vector3.UP - dir * Vector3.UP.dot(dir)).normalized()
			var have := Basis(a, pn, a.cross(pn)); var wantb := Basis(dir, upv, dir.cross(upv))
			sk.set_bone_global_pose(hi, Transform3D((wantb * have.inverse()).orthonormalized() * gh.basis, gh.origin))
		_bend(sk, "Head", left, 0.14 * sgn)
		_gild_arm(st, sk, "Right")
		if not twin and not N.has("sp_girth"):
			N["sp_girth"] = _sp_girth_of(n, sk, st)
			print("SP colossus: palm at ", (to_n * (sk.get_bone_global_pose(hi).origin + dir * (sk.get_bone_global_pose(mi).origin - sk.get_bone_global_pose(hi).origin).length() * 0.5)).snapped(Vector3.ONE * 0.01), " wanted ", want, "; top of head ", snappedf((to_n * sk.get_bone_global_pose(_bone(sk, "HeadTop_End")).origin).y, 0.01))
	# the plate: a shallow gilded dish
	var plate := turned(Vector3(0, SP_H - 0.06, SP_R), [[0.0, 0.0], [0.3, 0.0], [SP_PLATE, 0.045], [SP_PLATE, 0.06], [SP_PLATE - 0.05, 0.05], [0.0, 0.05]], "gold", 28, n)
	if twin:
		plate.material_override = under_mat(Color("e2ad3c"))
		turned(Vector3(0, SP_H - 0.062, SP_R), [[SP_PLATE - 0.07, 0.0], [SP_PLATE + 0.012, 0.0]], "gold", 28, n).material_override = under_mat(Color("a8741e"))

## how far the marble of a colossus stands out from its axis at the height of her hands, for every 10 degrees
## round it (in the turning part's own frame). Read off the posed statue: its faces, carried by its bones
func _sp_girth_of(frame: Node3D, sk: Skeleton3D, st: Node3D) -> PackedFloat32Array:
	var g := PackedFloat32Array(); g.resize(36); g.fill(0.0)
	var inv := frame.global_transform.affine_inverse()
	for m in st.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if mi.skin == null or mi.mesh == null: continue
		var skin := mi.skin
		var xf: Array = []
		for bi in skin.get_bind_count():
			var bone := skin.get_bind_bone(bi)
			if bone < 0: bone = sk.find_bone(skin.get_bind_name(bi))
			xf.append(sk.get_bone_global_pose(bone) * skin.get_bind_pose(bi) if bone >= 0 else Transform3D.IDENTITY)
		var to_f := inv * sk.global_transform
		for si in mi.mesh.get_surface_count():
			var arr := mi.mesh.surface_get_arrays(si)
			if arr[Mesh.ARRAY_BONES] == null or arr[Mesh.ARRAY_WEIGHTS] == null: continue
			var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var bs: PackedInt32Array = arr[Mesh.ARRAY_BONES]; var ws: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
			var per := bs.size() / v.size()
			var ix: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(v.size()))
			var at := PackedVector3Array(); at.resize(v.size())
			for j in v.size():
				var p := Vector3.ZERO; var wsum := 0.0
				for k in per:
					var w := ws[j * per + k]
					if w <= 0.0 or bs[j * per + k] >= xf.size(): continue
					p += ((xf[bs[j * per + k]] as Transform3D) * v[j]) * w; wsum += w
				at[j] = to_f * (p / wsum if wsum > 0.0 else v[j])
			for t in range(0, ix.size() - 2, 3):
				var p0 := at[ix[t]]; var p1 := at[ix[t + 1]]; var p2 := at[ix[t + 2]]
				if minf(p0.y, minf(p1.y, p2.y)) > SP_HAND_Y + 0.12 or maxf(p0.y, maxf(p1.y, p2.y)) < SP_HAND_Y - 0.12: continue
				for q in [p0, p1, p2, (p0 + p1) * 0.5, (p1 + p2) * 0.5, (p2 + p0) * 0.5, (p0 + p1 + p2) / 3.0]:
					if absf(q.y - SP_HAND_Y) > 0.1: continue
					var b := int(fposmod(atan2(q.x, q.z), TAU) / TAU * 36.0) % 36
					g[b] = maxf(g[b], Vector2(q.x, q.z).length())
	var mean := 0.0; var got := 0
	for b in 36:
		if g[b] > 0.0: mean += g[b]; got += 1
	mean = mean / got if got > 0 else 0.45
	var out := PackedFloat32Array(); out.resize(36)
	for b in 36:
		var c := g[b]
		if c <= 0.0:
			var l := g[(b + 35) % 36]; var r := g[(b + 1) % 36]
			c = maxf(l, r) if maxf(l, r) > 0.0 else mean
		out[b] = c
	for b in 36: g[b] = out[(b + 35) % 36] * 0.25 + out[b] * 0.5 + out[(b + 1) % 36] * 0.25
	print("SP colossus: girth at her hands, faces hit ", got, "/36, mean ", snappedf(mean, 0.01))
	return g

## the point of a colossus's marble at world yaw wy from its axis, at the height of her hands
func _sp_girth_at(key: String, wy: float) -> Vector3:
	var g: PackedFloat32Array = N["sp_girth"]
	var f := fposmod(wy - (N["sp_col_" + key] as Node3D).rotation.y, TAU) / TAU * 36.0 - 0.5
	var b := int(floor(f)); var k := f - b
	var r := lerpf(g[(b + 36) % 36], g[(b + 1) % 36], k)
	return (sp_col[key].p as Vector3) + Vector3(sin(wy) * r, SP_HAND_Y, cos(wy) * r)

## her palms on the marble, going round with it (see _turn_hands of the turned ones)
func _sp_turn_hands(key: String, hy: float, s: float) -> void:
	for sd in 2:
		var wy := hy + deg_to_rad((30.0 if sd == 1 else 6.0) - 36.0 * s)
		var p := _sp_girth_at(key, wy); var a := _sp_girth_at(key, wy - 0.12); var b := _sp_girth_at(key, wy + 0.12)
		var along := b - a; var nrm := Vector3(-along.z, 0, along.x).normalized()
		if nrm.dot(p - (sp_col[key].p as Vector3)) < 0.0: nrm = -nrm
		if sd == 1: tgtR = p; palm_nR = nrm
		else: tgtL = p; palm_nL = nrm

## the palm's footing, and the things to tap that go with it, set to where the colossus stands now
func _sp_palm_sync(key: String) -> void:
	var c: Dictionary = sp_col[key]
	var i := _sp_palm(key); var q := _sp_palm_real(key)
	W[c.w].foot["sp_palm_" + key] = R(i.x - SP_STEP, i.z - SP_STEP, i.x + SP_STEP, i.z + SP_STEP)
	var at := Vector3(q.x, -q.y, q.z)
	if objs.has("sp_palm_" + key):
		objs["sp_palm_" + key].at = at; objs["sp_palm_" + key].rstand = i; objs["sp_palm_" + key].hits = [at]
		objs["sp_col_" + key].hits = [c.p + Vector3(0, 0.25, 0), c.p + Vector3(0, 3.9, 0), q]

func _sp_col_things(key: String, stand: Vector3) -> void:
	var c: Dictionary = sp_col[key]
	objs["sp_col_" + key] = {"at": c.p + Vector3(0, 2.4, 0), "stand": stand, "mark": false, "hits": [c.p]}
	objs["sp_palm_" + key] = {"at": c.p, "stand": stand, "mark": false, "water": c.w, "rstand": c.p, "hits": [c.p]}
	_sp_palm_sync(key)

## she lays her hands on a colossus and turns it a quarter round; one geared to it turns the other way. If her
## reflection stands on a palm that moves, it is carried
func _sp_turn(key: String) -> void:
	var c: Dictionary = sp_col[key]
	var keys := [key]
	if c.pair != "": keys.append(c.pair)
	await face(c.p)
	var hy := atan2(pos.x - c.p.x, pos.z - c.p.z)
	_sp_turn_hands(key, hy, 0.0); palm_on = true; palm_gap = 0.0
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.6); up.tween_property(self, "a_wR", 1.0, 0.6); up.tween_property(self, "a_lean", 0.34, 0.6)
	var s0 := cam.size
	cam_focus = c.view; cam_focus_on = true
	create_tween().tween_property(cam, "size", maxf(s0, float(c.size)), 1.4).set_trans(Tween.TRANS_SINE)
	await up.finished
	await wait(0.5)
	var rider := ""; var hd: Node3D = null
	if not refl_out.is_empty():
		hd = refl_out.holder
		for k in keys:
			if _flat(hd.position, _sp_palm(k)) < 0.35: rider = k
	var y0 := {}
	for k in keys:
		y0[k] = (N["sp_col_" + k] as Node3D).rotation.y
		W[c.w].foot["sp_palm_" + k].on = false
	var r0 := hd.rotation.y if hd != null else 0.0
	var dr := float(c.get("dir", 1))      # (1: the arm goes north, east, south, west; -1: the other way round)
	var train0 := []
	for t in (c.get("train", []) as Array): train0.append((N[t[0]] as Node3D).rotation.y)
	var step := func(s: float) -> void:
		for i in keys.size():
			var k: String = keys[i]
			var a: float = float(y0[k]) + (-1.0 if i == 0 else 1.0) * dr * s * PI * 0.5
			for sfx in ["", "_m"]:
				(N["sp_col_" + k + sfx] as Node3D).rotation.y = a
				if N.has("sp_pin_" + k + sfx): (N["sp_pin_" + k + sfx] as Node3D).rotation.y = _pinion_yaw(a)
			if k == rider:
				hd.position = _sp_palm(k); hd.rotation.y = r0 + (-1.0 if i == 0 else 1.0) * dr * s * PI * 0.5
		var tr: Array = c.get("train", [])
		for j in tr.size():      # the idle wheels between a geared pair: each turns against its neighbour
			for sfx in ["", "_m"]: (N[String(tr[j][0]) + sfx] as Node3D).rotation.y = float(train0[j]) + float(tr[j][1]) * dr * s * PI * 0.5
		_sp_turn_hands(key, hy, s * dr)
	var rt := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	rt.tween_method(step, 0.0, 1.0, 3.0)
	await rt.finished
	for i in keys.size():
		var k: String = keys[i]
		sp_col[k].q = posmod(int(sp_col[k].q) + (1 if i == 0 else -1) * int(dr), 4)
		_sp_palm_sync(k)
	var dn := tw(); dn.tween_property(self, "a_wL", 0.0, 0.55); dn.tween_property(self, "a_wR", 0.0, 0.55); dn.tween_property(self, "a_lean", 0.0, 0.55)
	await dn.finished
	palm_on = false
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## her reflection has come onto a palm: it turns to look the way the arm points
func _sp_on_palm(key: String) -> void:
	var hd: Node3D = refl_out.holder
	var a: float = (N["sp_col_" + key] as Node3D).rotation.y
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, a), 0.5).set_trans(Tween.TRANS_SINE)
	await rt.finished

# ---------------------------------------------------------------- her reflection among the palms
## (of ch1) the way of her reflection over a water of this wing. A palm is one stepping place: the way goes to its
## middle, and from its middle on
func _refl_path(wid: String, from: Vector3, to: Vector3) -> Dictionary:
	if not wid.begins_with("SP"): return super._refl_path(wid, from, to)
	var F: Dictionary = W[wid].foot
	var a := _foot_of(wid, from, 0.9)
	if a == "": return {"pts": [], "left": 1e9, "h": 0.0, "hs": []}
	var prev := {a: ""}; var q := [a]
	while not q.is_empty():
		var c: String = q.pop_front()
		for n in F:
			if F[n].on and not prev.has(n) and portal(F[c], F[n]) != null: prev[n] = c; q.append(n)
	var goal := to; var gd := 1e9
	for n in F:
		if not F[n].on: continue
		var c2 := _sp_mid(F[n]) if String(n).begins_with("sp_palm_") else _near_in(F[n], to)
		if _flat(c2, to) < gd: gd = _flat(c2, to); goal = c2
	var b := ""; var bd := 1e9; var dest := from
	for n in prev:
		var c3 := _sp_mid(F[n]) if String(n).begins_with("sp_palm_") else _near_in(F[n], goal)
		if _flat(c3, goal) < bd: bd = _flat(c3, goal); b = n; dest = c3
	if bd > 0.25: bd = 1e6      # (no way there: from wherever it starts it is as far short of it. It does not give up a palm to stand a little nearer on a rim)
	var chain := [b]
	while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
	var pts := []; var hs := []; var cur := from
	for i in range(chain.size() - 1):
		var nx: String = chain[i + 1]; var pt: Vector3
		if nx.begins_with("sp_palm_"): pt = _sp_mid(F[nx])
		elif String(chain[i]).begins_with("sp_palm_"):      # off a palm: onto the nearest of what lies beside it, a short step in
			var f: Dictionary = F[nx]; var m := 0.22
			pt = Vector3(clampf(cur.x, minf(f.x0 + m, f.x1), maxf(f.x1 - m, f.x0)), 0, clampf(cur.z, minf(f.z0 + m, f.z1), maxf(f.z1 - m, f.z0)))
		else:
			var pr: Array = portal(F[chain[i]], F[nx])
			var mid := cur.lerp(dest, 0.5)
			pt = Vector3(clampf(mid.x, pr[0], pr[2]), 0, clampf(mid.z, pr[1], pr[3]))
		pts.append(pt); hs.append(float(F[nx].h)); cur = pt
	pts.append(dest); hs.append(float(F[b].h))
	return {"pts": pts, "left": bd, "h": float(F[b].h), "hs": hs}

# ---------------------------------------------------------------- P.1 the gilded palm
## A round pool with an islet in its middle, where the lever of the door stands. No way across, not in the water
## either. On the rim a colossus holds a gilded palm out; in the water that palm lies against the north rim
func _sp_court1() -> void:
	var c := SP1_C; var r := SP1_R
	var qx0 := c.x - r; var qz0 := c.z - r; var qx1 := c.x + r; var qz1 := c.z + r
	# the way in from the atrium's door
	floor_plain(-20.3, SP1_Z1, -18.7, UZ0, 0.0)
	for e in [-20.2, -18.8]: parapet(Vector3(e, 0, SP1_Z1 + 0.1), Vector3(e, 0, UZ0 - 0.1))
	_pool_court(SP1_X0, SP1_Z0, SP1_X1, SP1_Z1, qx0, qz0, qx1, qz1, "stone", "PoolSkySp1"); _sp_pit("PoolSkySp1", 5.6)
	tile_hole = Rect2(qx0 - 0.08, qz0 - 0.08, r * 2.0 + 0.16, r * 2.0 + 0.16); tiles(SP1_X0, SP1_Z0, SP1_X1, SP1_Z1, 1.0); tile_hole = Rect2()
	glass(qx0, qz0, qx1, qz1)
	for k in 4:      # the pool is round: the four corners of its opening are floor
		var corner := Vector3(qx0 if k in [1, 2] else qx1, 0, qz0 if k in [2, 3] else qz1)
		_sp_cover(corner, _sp_arc(c, r, 90.0 * k, 90.0 * (k + 1), 18))
	turned(c, [[r + 0.08, 0.04], [r + 0.08, 0.06], [r, 0.06], [r, -0.06]], "shade", 72)
	var rim_n := R(qx0 - 1.5, qz0 - 1.5, qx1, qz0); var rim_w := R(qx0 - 1.5, qz0 - 1.5, qx0, qz1)
	W["SP1"] = {"r": [qx0, qz0, qx1, qz1], "heads": [R(-13.1, -57.4, SP1_X1 - 0.45, qz0 - 0.45), R(qx0 - 0.9, qz0 - 0.45, qx0 - 0.45, qz1)],
		"foot": {"n": rim_n, "w": rim_w, "isle": R(SP1_ISLE.x - 0.65, SP1_ISLE.z - 0.9, SP1_ISLE.x + 0.65, SP1_ISLE.z + 0.75)}, "far": 9.0, "round": true, "c": SP1_C, "rad": SP1_R}
	WL.append("SP1")
	_sp_colossus("1", SP1_S, 0, "SP1", SP1_S + Vector3(2.3, 0.4, 2.9))
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		# the islet, and the lever on it
		cyl(SP1_ISLE, 0.9, 0.9, 0.05, pal("stone", flat), 32, both); turned(SP1_ISLE, [[0.94, 0.0], [0.94, 0.03], [0.9, 0.03]], "shade", 32, both)
		_sp_lever(SP1_LEVER, "sp_lever1" + ("_m" if twin else ""), both)
	# walls and edges: the tall wall only east of the lane's line
	parapet(Vector3(SP1_X0 + 0.1, 0, SP1_Z0 + 0.1), Vector3(-20.47, 0, SP1_Z0 + 0.1)); parapet(Vector3(-18.53, 0, SP1_Z0 + 0.1), Vector3(-17.9, 0, SP1_Z0 + 0.1))
	wall(-17.9, SP1_Z0, SP1_X1, SP1_Z0 + 0.3, 2.0)
	parapet(Vector3(SP1_X0 + 0.1, 0, SP1_Z0 + 0.1), Vector3(SP1_X0 + 0.1, 0, SP1_Z1 - 0.1)); parapet(Vector3(SP1_X1 - 0.1, 0, SP1_Z0 + 0.4), Vector3(SP1_X1 - 0.1, 0, SP1_Z1 - 0.1))
	parapet(Vector3(SP1_X0 + 0.1, 0, SP1_Z1 - 0.1), Vector3(-20.3, 0, SP1_Z1 - 0.1)); parapet(Vector3(-18.7, 0, SP1_Z1 - 0.1), Vector3(SP1_X1 - 0.1, 0, SP1_Z1 - 0.1))
	sluice("sp_s1", Vector3(-19.5, 0, SP1_Z0 + 0.15), false, 0.6, 1.0)
	_sp_chan(Vector3(-19.5, 0, SP1_Z0 + 0.3), Vector3(-19.5, 0, UZ0))
	# the alley of the heads he tried and put aside: less and less finished toward the north
	var hz := [-48.2, -50.2, -52.2, -54.2, -56.2]
	for i in hz.size():
		for e in 2:
			var fp := Vector3(-17.8 if e == 0 else -16.2, 0, hz[i])
			pedestal(fp)
			var k := i * 2 + e
			if k < 4: sculpt_head(fp + Vector3(0, 0.78 + 0.2, 0), 0.44, PI * 0.25, Vector3(-0.1, 0, 0), k + 1)
			elif k < 7: idol_head(fp + Vector3(0, 0.78 + 0.2, 0), 0.4, PI * 0.25, Vector3(-0.12, 0, 0), 0.9 + 0.06 * (k - 4), 1.0 - 0.42 * (k - 4))
			else:      # the last: blocks, squared and hardly begun
				var bk := blk(Vector3(-0.17, 0, -0.15), Vector3(0.17, 0.42 - 0.05 * (k - 7), 0.15), "marble"); bk.position = fp + Vector3(0, 0.78 + 0.21 - 0.025 * (k - 7), 0); bk.rotation.y = 0.2 * (k - 7.5)
			solids.append(Vector3(fp.x, fp.z, 0.36))
			_look_add("", fp, 1.3, [["a face he tried, and put aside", "not her face. one he wished for her"], ["he stopped before the eyes", "less of a face each time"], ["a block. he had stopped trying", "the chisel marks are all it has"]][0 if k < 4 else (1 if k < 7 else 2)])
	stele("sp_stele1", Vector3(-12.2, 0, -58.9), 0.0, ["The hands I got right,\nI gilded.", "Gold does not sink.\nNot even in a mirror."])
	_look_add("sp_look_lever1", SP1_ISLE + Vector3(0.0, 0.05, 0.0), 1.0, ["a lever, on an islet. no way across", "its rod goes under the water, to the sluice"])
	urn(Vector3(SP1_X1 - 0.75, 0, SP1_Z0 + 0.95), 1.0); cypress(Vector3(-7.2, 0, SP1_Z0 + 0.9), 2.6); urn(Vector3(-15.6, 0, SP1_Z1 - 0.65), 0.8, "rose")

## a lever in a bronze quadrant on a stone foot. It leans east; pulled, it leans west. Kept under N[key]
func _sp_lever(p: Vector3, key: String, parent: Node) -> void:
	var twin := parent == mroot
	blk(p + Vector3(-0.3, 0.05, -0.13), p + Vector3(0.3, 0.2, 0.13), "stone", parent); blk(p + Vector3(-0.33, 0.05, -0.16), p + Vector3(0.33, 0.1, 0.16), "shade", parent)
	for e in [-1.0, 1.0]:      # the quadrant: two bronze cheeks with notches along their rim
		for i in 9:
			var a := deg_to_rad(-48.0 + 12.0 * i)
			var bq := blk(Vector3(-0.018, 0.0, -0.008), Vector3(0.018, 0.3 if i % 2 == 0 else 0.27, 0.008), "gold", parent)
			bq.position = p + Vector3(0, 0.2, e * 0.06) + Vector3(-sin(a), cos(a), 0) * 0.15; bq.rotation.z = a
	var arm := Node3D.new(); arm.position = p + Vector3(0, 0.22, 0); arm.rotation.z = -0.6; parent.add_child(arm)
	blk(Vector3(-0.022, 0.0, -0.022), Vector3(0.022, 0.8, 0.022), "gold", arm)
	cyl(Vector3(0, 0.78, 0), 0.035, 0.03, 0.2, pal("wood", "flat2" if twin else "flat"), 10, arm); ball(Vector3(0, 1.0, 0), 0.04, pal("gold", "flat2" if twin else "flat"), arm)
	var ax := cyl(Vector3.ZERO, 0.03, 0.03, 0.2, pal("gold", "flat2" if twin else "flat"), 10, arm); ax.rotation.x = PI * 0.5; ax.position = Vector3.ZERO
	N[key] = arm

func _sp_things1() -> void:
	_sp_col_things("1", SP1_S + Vector3(0.72, 0, 0.72))
	var g := SP1_LEVER + Vector3(0, 0.22, 0) + Vector3(0.6 * 0.56, 0.9 * 0.82, 0)
	objs["sp_lever1"] = {"at": Vector3(g.x, -g.y, g.z), "stand": SP1_S, "mark": false, "water": "SP1", "rstand": SP1_LEVER + Vector3(-0.42, 0, 0.0),
		"hits": [Vector3(SP1_LEVER.x, -0.1, SP1_LEVER.z), Vector3(g.x, -g.y - 0.2, g.z)]}

func _sp_nav1() -> void:
	var c := SP1_C; var r := SP1_R
	rects["SPp"] = R(-19.75, SP1_Z1 - 0.5, -19.25, UZ0 + 0.8)      # in from the atrium's door
	rects["SP1a"] = R(SP1_X0 + 0.45, SP1_Z0 + 0.6, -18.25, SP1_Z1 - 0.45)      # along the channel
	rects["SP1b"] = R(-17.45, -57.0, -16.55, -47.3)      # the alley, between the heads
	rects["SP1c"] = R(-15.85, -56.4, c.x - r - 0.45, SP1_Z1 - 0.45)      # the pool's west rim
	rects["SP1x"] = R(-17.45, -57.0, -15.5, -56.6)
	rects["SP1s"] = R(SP1_X0 + 0.45, -47.5, c.x - r - 0.45, SP1_Z1 - 0.45)
	rects["SP1n"] = R(SP1_X0 + 0.45, SP1_Z0 + 0.6, -15.85, -56.9)
	rects["SP1nn"] = R(SP1_X0 + 0.45, SP1_Z0 + 0.6, SP1_X1 - 0.45, SP1_Z0 + 0.92)      # behind the colossus
	rects["SP1ne"] = R(-13.1, SP1_Z0 + 0.6, SP1_X1 - 0.45, c.z - r - 0.45)      # the north rim, east of it
	rects["SP1t"] = R(-13.9, -57.2, -12.9, -56.86)      # where she stands to turn it
	rects["SP1d"] = R(-19.75, SP2_Z1 - 0.5, -19.25, SP1_Z0 + 0.7, false)      # through the door at the north
	solids.append(Vector3(SP1_S.x, SP1_S.z, 1.0))

func _do_sp_col_1() -> void:
	await _sp_turn("1")

func _do_sp_palm_1() -> void:
	await _sp_on_palm("1")

## her reflection, standing west of a lever of the water, takes it and pulls it over toward itself
func _sp_lever_pull(nm: String, at: Vector3) -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, PI * 0.5), 0.4).set_trans(Tween.TRANS_SINE)
	await rt.finished
	var hm := _hermod(e)
	var arm: Node3D = N[nm]; var arm_m: Node3D = N[nm + "_m"]
	var grip := func() -> Vector3:
		var g := at + Vector3(0, 0.22, 0) + Vector3(-sin(arm.rotation.z), cos(arm.rotation.z), 0) * 0.9
		return Vector3(g.x, -g.y, g.z)
	hm.tR = grip.call(); hm.tL = grip.call(); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wR", 1.0, 0.6); hu.tween_property(hm, "bow", 0.12, 0.6)
	await hu.finished
	await wait(0.3)
	var pull := func(a: float) -> void:
		arm.rotation.z = a; arm_m.rotation.z = a; hm.tR = grip.call()
	var pt := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT); pt.tween_method(pull, -0.6, 0.6, 1.8)
	await pt.finished
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wR", 0.0, 0.6); hd2.tween_property(hm, "bow", 0.0, 0.6)
	await hd2.finished
	hm.own = false

## the eye goes to a sluice, the sluice goes down, the eye comes back
func _sp_show_open(key: String, focus: Vector3, size := 9.6) -> void:
	var s0 := cam.size
	cam_focus = focus; cam_focus_on = true
	create_tween().tween_property(cam, "size", size, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(2.2)
	await sluice_open(key, 2.6)
	await wait(0.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## P.1: the lever on the islet. Her reflection, set down there by the palm, pulls it over: the sluice at the north
## goes down
func _do_sp_lever1() -> void:
	await _sp_lever_pull("sp_lever1", SP1_LEVER)
	for k in ["sp_lever1", "sp_palm_1", "sp_col_1"]: done[k] = true
	looks.erase("sp_look_lever1")
	await _sp_show_open("sp_s1", Vector3(-18.6, 0.4, SP1_Z0 + 1.6))
	rects["SP1d"].on = true
	await _refl_melt()


# ---------------------------------------------------------------- P.2 from hand to hand
## A long pool. Three colossi stand in a row on its west rim, each holding a gilded palm out; the first two are
## geared together through two idle wheels, so that when one turns the other turns the other way; the third is free.
## None of them reaches the next: the plates stop a hand apart. The lever of the next door stands on an islet at the
## far end. The lane, with the dry channel, runs along the pool's east side
func _sp2_p(i: int) -> Vector3:
	return Vector3(SP2_SX, 0, SP2_AZ + SP2_D * i)

func _sp_court2() -> void:
	floor_plain(SPL_X0, SP2_Z1, SPL_X1, SP1_Z0, 0.0); land_paths.append([SPL_X0, SP2_Z1, SPL_X1, SP1_Z0])
	_pool_court(SP2_X0, SP2_Z0, SP2_X1, SP2_Z1, SP2_QX0, SP2_QZ0, SP2_QX1, SP2_QZ1, "stone", "PoolSkySp2"); _sp_pit("PoolSkySp2", 5.6)
	tile_hole = Rect2(SP2_QX0 - 0.08, SP2_QZ0 - 0.08, SP2_QX1 - SP2_QX0 + 0.16, SP2_QZ1 - SP2_QZ0 + 0.16); tiles(SP2_X0, SP2_Z0, SP2_X1, SP2_Z1, 1.0); tile_hole = Rect2()
	glass(SP2_QX0, SP2_QZ0, SP2_QX1, SP2_QZ1)
	var a := _sp2_p(0); var b := _sp2_p(1); var c := _sp2_p(2)
	W["SP2"] = {"r": [SP2_QX0, SP2_QZ0, SP2_QX1, SP2_QZ1], "far": 22.0,
		"heads": [R(SP2_QX0 - 0.6, SP2_AZ + 0.3, SP2_QX1, SP2_QZ0 - 0.45), R(SP2_SX + 0.45, b.z + 0.45, SP2_SX + 0.85, b.z + 1.0), R(SP2_SX + 0.45, c.z + 0.45, SP2_SX + 0.85, c.z + 1.0)],
		"foot": {"n": R(SP2_SX + 0.4, SP2_AZ + 0.2, SP2_QX1, SP2_QZ0), "w": R(SP2_SX + 0.4, SP2_AZ + 0.2, SP2_QX0, SP2_QZ1),
			"isle": R(SP2_ISLE.x - 0.75, SP2_ISLE.z - 0.7, SP2_ISLE.x + 0.6, SP2_ISLE.z + 0.7)}}
	WL.append("SP2")
	# the three. The first holds its palm to the north rim; the second, geared to it, to the south; the third away
	_sp_colossus("A", a, 0, "SP2", a.lerp(b, 0.5) + Vector3(2.9, 0.4, 3.3), false, 0.0, 11.5)
	_sp_colossus("B", b, 2, "SP2", b + Vector3(2.9, 0.4, 3.3), false, SP2_B_OFF, 11.5)
	_sp_colossus("C", c, 3, "SP2", c + Vector3(2.5, 0.4, 2.9))
	sp_col["A"].pair = "B"; sp_col["B"].pair = "A"
	var kr := 28.0 / SP2_IDLER_N
	sp_col["A"].train = [["sp2_idler0", kr], ["sp2_idler1", -kr]]; sp_col["B"].train = [["sp2_idler1", kr], ["sp2_idler0", -kr]]
	var gy := PLINTH_CUT * SP_PKV
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		for i in 2:      # the two idle wheels between the first and the second: each on a stone post, under a bronze cap
			var at := Vector3(SP2_SX, 0, a.z + SP_GEAR_R + SP2_IDLER_R) if i == 0 else Vector3(SP2_SX, 0, b.z - SP_GEAR_R - SP2_IDLER_R)
			turned(at, [[0.3, 0.0], [0.3, 0.04], [0.24, 0.06], [0.24, gy - 0.01], [0.0, gy - 0.01]], "stone", 20, both)
			var id := Node3D.new(); id.position = at + Vector3(0, gy, 0); id.rotation.y = deg_to_rad(SP2_IDLER_YAW[i]); both.add_child(id)
			_gear(id, SP2_IDLER_R, SP2_IDLER_N, 0.055)
			for k in 5:      # its spokes are cut through: five round lightening holes, and a hub
				var hk := cyl(Vector3(cos(TAU * k / 5.0) * 0.36, 0.056, sin(TAU * k / 5.0) * 0.36), 0.11, 0.11, 0.004, pal("dark", flat), 14, id)
				hk.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			cyl(Vector3(0, 0.055, 0), 0.13, 0.11, 0.05, pal("gold", flat), 16, id); ball(Vector3(0, 0.12, 0), 0.05, pal("gold", flat), id)
			N["sp2_idler%d%s" % [i, "_m" if twin else ""]] = id
		# the islet, and the lever on it
		cyl(SP2_ISLE, 0.8, 0.8, 0.05, pal("stone", flat), 32, both); turned(SP2_ISLE, [[0.84, 0.0], [0.84, 0.03], [0.8, 0.03]], "shade", 32, both)
		_sp_lever(SP2_LEVER, "sp_lever2" + ("_m" if twin else ""), both)
	# behind each of them, against the west parapet, a bronze mirror with its face to the wall
	for i in 3:
		var mp := _sp2_p(i) + Vector3(-2.2, 0, 0.45)
		blk(mp + Vector3(-0.1, 0, -0.3), mp + Vector3(0.12, 0.08, 0.3), "shade")
		var disc := cyl(Vector3.ZERO, 0.46, 0.46, 0.035, pal("gold"), 28); disc.position = mp + Vector3(0.0, 0.53, 0); disc.rotation.z = PI * 0.5 - 0.16
		var boss := cyl(Vector3.ZERO, 0.09, 0.07, 0.05, pal("dark"), 12); boss.position = mp + Vector3(0.04, 0.53, 0); boss.rotation.z = PI * 0.5 - 0.16
		_look_add("", mp, 1.0, ["a bronze mirror, its face to the wall", "he stood one of them in front of each mirror"])
	# edges: low all round (the three are tall enough), the lane open on the east
	parapet(Vector3(SP2_X0 + 0.1, 0, SP2_Z0 + 0.1), Vector3(-20.47, 0, SP2_Z0 + 0.1)); parapet(Vector3(SP2_X0 + 0.1, 0, SP2_Z0 + 0.1), Vector3(SP2_X0 + 0.1, 0, SP2_Z1 - 0.1))
	parapet(Vector3(SP2_X0 + 0.1, 0, SP2_Z1 - 0.1), Vector3(SPL_X0, 0, SP2_Z1 - 0.1))
	parapet(Vector3(SP2_X1 - 0.1, 0, SP2_Z0 + 0.1), Vector3(SP2_X1 - 0.1, 0, SP2_DOOR.z - 0.98)); parapet(Vector3(SP2_X1 - 0.1, 0, SP2_DOOR.z + 0.98), Vector3(SP2_X1 - 0.1, 0, SP1_Z0 - 0.02))
	parapet(Vector3(SPL_X0 + 0.1, 0, SP2_Z1 - 0.1), Vector3(SPL_X0 + 0.1, 0, SP1_Z0 - 0.02))
	sluice("sp_s2", SP2_DOOR, true, 0.6, 1.0)      # the door of the third court
	sluice("sp_s3", Vector3(-19.5, 0, SP2_Z0 + 0.15), false, 0.6, 1.0)      # and, across the lane at the north, the one the third court opens
	_sp_chan(Vector3(-19.5, 0, SP2_Z0 + 0.3), Vector3(-19.5, 0, SP1_Z0), false)
	stele("sp_stele2", Vector3(-24.6, 0, SP2_Z0 + 0.85), 0.0, ["None of them reaches the other.\nI measured.", "A hand that waits\nis worth two that carry."])
	_look_add("sp_look_lever2", SP2_ISLE + Vector3(0, 0.05, 0), 1.0, ["a lever, on an islet at the far end", "three hands between here and there"])
	_look_add("", Vector3(SP2_SX, 0, a.z + SP_GEAR_R + SP2_IDLER_R * 2.0), 0.4, ["two idle wheels between the first and the second", "turn one, and the other turns against it"])
	urn(Vector3(SP2_X0 + 0.8, 0, SP2_Z1 - 0.8), 1.0, "rose"); urn(Vector3(-21.4, 0, SP2_Z0 + 0.8), 0.9)

func _sp_things2() -> void:
	for i in 3: _sp_col_things(["A", "B", "C"][i], _sp2_p(i) + Vector3(0.72, 0, 0.72))
	var g := SP2_LEVER + Vector3(0, 0.22, 0) + Vector3(0.6 * 0.56, 0.9 * 0.82, 0)
	objs["sp_lever2"] = {"at": Vector3(g.x, -g.y, g.z), "stand": _sp2_p(2) + Vector3(0.72, 0, 0.72), "mark": false, "water": "SP2", "rstand": SP2_LEVER + Vector3(-0.42, 0, 0.0),
		"hits": [Vector3(SP2_LEVER.x, -0.1, SP2_LEVER.z), Vector3(g.x, -g.y - 0.2, g.z)]}

func _sp_nav2() -> void:
	rects["SP2l"] = R(-19.75, SP2_Z0 + 0.6, -19.25, SP2_Z1 - 0.3)      # the lane, along the channel
	rects["SP2n"] = R(SP2_X0 + 0.45, SP2_Z0 + 0.6, -19.25, SP2_QZ0 - 0.45)      # the north rim
	rects["SP2w"] = R(SP2_X0 + 0.45, SP2_Z0 + 0.6, SP2_SX - 1.25, SP2_Z1 - 0.45)      # the walk behind the three
	var b := _sp2_p(1); var c := _sp2_p(2)
	rects["SP2b"] = R(SP2_X0 + 0.45, b.z + 0.55, SP2_SX + 0.85, c.z - 1.15)      # between the second and the third
	rects["SP2c"] = R(SP2_X0 + 0.45, c.z + 0.55, SP2_SX + 0.85, SP2_Z1 - 0.45)      # south of the third
	rects["SP2e"] = R(SP2_QX1 + 0.45, SP2_Z0 + 0.6, -19.25, SP2_Z1 - 0.45)      # the pool's east rim, beside the lane
	rects["SP3d"] = R(-19.25, SP2_DOOR.z - 0.25, SP2_DOOR.x + 0.9, SP2_DOOR.z + 0.25, false)      # through the door of the third court
	rects["SP3g"] = R(-19.75, SP2_Z0 - 0.9, -19.25, SP2_Z0 + 0.7, false)      # through the sluice at the north
	for i in 3: solids.append(Vector3(SP2_SX, _sp2_p(i).z, 1.0))
	for z in [SP2_AZ + SP_GEAR_R + SP2_IDLER_R, b.z - SP_GEAR_R - SP2_IDLER_R]: solids.append(Vector3(SP2_SX, z, 0.78))
	for i in 3: solids.append(Vector3(SP2_SX - 2.2, _sp2_p(i).z + 0.45, 0.35))

func _do_sp_col_A() -> void: await _sp_turn("A")
func _do_sp_col_B() -> void: await _sp_turn("B")
func _do_sp_col_C() -> void: await _sp_turn("C")
func _do_sp_palm_A() -> void: await _sp_on_palm("A")
func _do_sp_palm_B() -> void: await _sp_on_palm("B")
func _do_sp_palm_C() -> void: await _sp_on_palm("C")

## P.2: the lever on the far islet. Her reflection, handed from palm to palm and set down there, pulls it over: the
## door of the third court goes down
func _do_sp_lever2() -> void:
	await _sp_lever_pull("sp_lever2", SP2_LEVER)
	for k in ["sp_lever2", "sp_palm_A", "sp_col_A", "sp_palm_B", "sp_col_B", "sp_palm_C", "sp_col_C"]: done[k] = true
	looks.erase("sp_look_lever2")
	await _sp_show_open("sp_s2", SP2_DOOR + Vector3(-0.6, 0.4, 0.6))
	rects["SP3d"].on = true
	await _refl_melt()


# ---------------------------------------------------------------- P.3 what each one wants
## An exedra: a curved bench under a low wall, and before it five places on a bronze rail, four statues of her, and
## a round basin. Above they all look straight ahead. In the water each looks elsewhere: one out to sea, one at the
## wall, one at another of them, one at the empty place. A statue pushed off its place runs in along its spur, round
## the rail, and out onto the place that is empty. When the first three have what they want, the fourth still looks
## at the empty place: what it wants is not stone
func _sp3_ang(i: float) -> float:
	return deg_to_rad(275.0 - 25.0 * i)

func _sp3_pt(a: float, r: float) -> Vector3:
	return SP3_C + Vector3(cos(a), 0, sin(a)) * r

func _sp3_place(i: int) -> Vector3:
	return _sp3_pt(_sp3_ang(i), SP3_RA)

func _sp3_hole() -> int:
	for k in 5:
		if not (k in sp3_at): return k
	return 0

## a flat strip of bronze let into the floor, from a to b
func _sp_strip(a: Vector3, b: Vector3, w: float, pl := "gold", y := 0.017, h := 0.01) -> MeshInstance3D:
	var l := _flat(a, b)
	var m := blk(Vector3(-l * 0.5, 0, -w * 0.5), Vector3(l * 0.5, h, w * 0.5), pl)
	m.position = (a + b) * 0.5 + Vector3(0, y + h * 0.5, 0); m.rotation.y = -atan2(b.z - a.z, b.x - a.x)
	return m

## a block on a curve about c: from angle a0 to a1 (radians), between two radii and two heights
func _sp_arc_blk(c: Vector3, a0: float, a1: float, r0: float, r1: float, y0: float, y1: float, pl := "stone") -> void:
	var am := (a0 + a1) * 0.5; var rm := (r0 + r1) * 0.5
	var l := absf(a1 - a0) * r1 + 0.012
	var m := blk(Vector3(-l * 0.5, 0, -(r1 - r0) * 0.5), Vector3(l * 0.5, y1 - y0, (r1 - r0) * 0.5), pl)
	m.position = c + Vector3(cos(am), 0, sin(am)) * rm + Vector3(0, (y0 + y1) * 0.5, 0); m.rotation.y = -(am + PI * 0.5)

## a round pool in a court: the court with a square opening, its four corners covered, a round kerb
func _sp_round(c: Vector3, r: float, x0: float, z0: float, x1: float, z1: float, sky: String, depth := 0.0, top_y := 0.04) -> void:
	var qx0 := c.x - r; var qz0 := c.z - r; var qx1 := c.x + r; var qz1 := c.z + r
	_pool_court(x0, z0, x1, z1, qx0, qz0, qx1, qz1, "stone", sky)
	if depth > 0.0: _sp_pit(sky, depth)
	tile_hole = Rect2(qx0 - 0.08, qz0 - 0.08, r * 2.0 + 0.16, r * 2.0 + 0.16); tiles(x0, z0, x1, z1, 1.0); tile_hole = Rect2()
	glass(qx0, qz0, qx1, qz1)
	for k in 4:
		var corner := Vector3(qx0 if k in [1, 2] else qx1, 0, qz0 if k in [2, 3] else qz1)
		_sp_cover(corner, _sp_arc(c, r, 90.0 * k, 90.0 * (k + 1), 18), "stone", top_y)
	turned(c, [[r + 0.08, top_y], [r + 0.08, 0.06], [r, 0.06], [r, -0.06]], "shade", 72)

func _sp_court3() -> void:
	var c := SP3_C
	_sp_round(SP3_P, SP3_PR, SP3_X0, SP3_Z0, SP3_X1, SP3_Z1, "PoolSkySp3", 0.0, 0.015)      # (the floor round this basin is level: the rail crosses it)
	var fn := R(c.x - 4.25, c.z - 4.25, SP3_X1 - 0.45, SP3_P.z - SP3_PR - 0.45); var fw := R(c.x - 4.25, c.z - 4.25, SP3_P.x - SP3_PR - 0.45, SP3_Z1 - 0.45)
	var fc := R(SP3_P.x - SP3_PR - 0.45, SP3_P.z - SP3_PR - 0.45, c.x - 1.8, c.z - 1.8)
	W["SP3"] = {"r": [SP3_P.x - SP3_PR, SP3_P.z - SP3_PR, SP3_P.x + SP3_PR, SP3_P.z + SP3_PR], "round": true, "c": SP3_P, "rad": SP3_PR, "far": 12.0,
		"heads": [fn, fw, fc], "foot": {"n": fn, "w": fw, "c": fc}}
	WL.append("SP3")
	# the rail: a ring of two bronze lines, and a spur from it out to each place; at each place a bronze socket
	var a_lo := _sp3_ang(4.0); var a_hi := _sp3_ang(0.0); var n := 20
	for k in n:
		var a0 := lerpf(a_lo, a_hi, float(k) / n); var a1 := lerpf(a_lo, a_hi, float(k + 1) / n)
		for g in [-0.15, 0.15]: _sp_strip(_sp3_pt(a0, SP3_RI + g), _sp3_pt(a1, SP3_RI + g), 0.035)
		if k % 2 == 0: _sp_strip(_sp3_pt((a0 + a1) * 0.5, SP3_RI - 0.21), _sp3_pt((a0 + a1) * 0.5, SP3_RI + 0.21), 0.07, "dark", 0.016, 0.006)      # the sleepers under it
	for i in 5:
		var a := _sp3_ang(i); var t := Vector3(-sin(a), 0, cos(a))
		for g in [-0.15, 0.15]: _sp_strip(_sp3_pt(a, SP3_RI) + t * g, _sp3_pt(a, SP3_RA - 0.34) + t * g, 0.035)
		for k in 2: _sp_strip(_sp3_pt(a, SP3_RI + 0.25 + 0.25 * k) - t * 0.21, _sp3_pt(a, SP3_RI + 0.25 + 0.25 * k) + t * 0.21, 0.07, "dark", 0.016, 0.006)
		turned(_sp3_place(i), [[0.44, 0.0], [0.44, 0.028], [0.35, 0.028], [0.35, 0.0]], "gold", 28)
		turned(_sp3_place(i), [[0.35, 0.0], [0.35, 0.02], [0.0, 0.02]], "shade", 28)
	# the four, each on a plinth shod with bronze; and their twins in the water
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		for i in 4:
			var a := _sp3_ang(sp3_at[i])
			var nd := Node3D.new(); nd.position = _sp3_pt(a, SP3_RA); nd.rotation.y = atan2(-cos(a), -sin(a)); both.add_child(nd)
			cyl(Vector3.ZERO, 0.32, 0.3, 0.07, pal("shade", flat), 20, nd); cyl(Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone", flat), 20, nd)
			turned(Vector3.ZERO, [[0.345, 0.0], [0.345, 0.035], [0.31, 0.04]], "gold", 24, nd)
			for w in 4:      # the four small wheels it runs on
				var wh := cyl(Vector3.ZERO, 0.045, 0.045, 0.03, pal("gold", flat), 10, nd); wh.rotation.x = PI * 0.5; wh.position = Vector3(0.15 if w % 2 == 0 else -0.15, 0.03, 0.3 if w < 2 else -0.3)
			var st := her_statue(Vector3(0, 0.17, 0), 0.0, SP3_POSES[i], 1.0, nd)
			N["sp3_st%d%s" % [i, "_m" if twin else ""]] = nd
			var h := {"sk": null, "st": st, "yaw": 0.0, "bow": 0.0}
			var sks := st.find_children("*", "Skeleton3D", true, false)
			if not sks.is_empty():
				var sk: Skeleton3D = sks[0]
				h.sk = sk; h.hi = _bone(sk, "Head"); h.ni = _bone(sk, "Neck")
				h.h0 = sk.get_bone_pose_rotation(h.hi) if h.hi >= 0 else Quaternion.IDENTITY; h.n0 = sk.get_bone_pose_rotation(h.ni) if h.ni >= 0 else Quaternion.IDENTITY
			if twin: sp3_h[i * 2 + 1] = h
			else: sp3_h.append(h); sp3_h.append({})
	# the exedra: a low curved wall, a bench along its foot, a pier at each end
	var w0 := deg_to_rad(155.0); var w1 := deg_to_rad(292.0); var wn := 24
	for k in wn:
		var a0 := lerpf(w0, w1, float(k) / wn); var a1 := lerpf(w0, w1, float(k + 1) / wn)
		_sp_arc_blk(c, a0, a1, 4.75, 5.0, 0.0, 1.3, "stone"); _sp_arc_blk(c, a0, a1, 4.72, 5.03, 0.0, 0.14, "shade")
		_sp_arc_blk(c, a0, a1, 4.7, 5.05, 1.3, 1.36, "shade"); _sp_arc_blk(c, a0, a1, 4.73, 5.02, 1.36, 1.42, "stone")
		_sp_arc_blk(c, a0, a1, 4.33, 4.75, 0.0, 0.36, "stone"); _sp_arc_blk(c, a0, a1, 4.29, 4.75, 0.36, 0.42, "shade")      # the bench
		if k % 3 == 1: _sp_arc_blk(c, lerpf(a0, a1, 0.3), lerpf(a0, a1, 0.7), 4.71, 4.75, 0.42, 1.3, "shade")      # a flat rib on the wall, behind every third seat
		if k % 3 == 0: _sp_arc_blk(c, lerpf(a0, a1, -0.08), lerpf(a0, a1, 0.08), 4.27, 4.75, 0.0, 0.5, "shade")      # the bench's arm rests
	for e in [w0, w1]:
		var pp := c + Vector3(cos(e), 0, sin(e)) * 4.875
		blk(pp + Vector3(-0.27, 0, -0.27), pp + Vector3(0.27, 1.7, 0.27), "stone"); blk(pp + Vector3(-0.31, 0, -0.31), pp + Vector3(0.31, 0.16, 0.31), "shade")
		blk(pp + Vector3(-0.31, 1.7, -0.31), pp + Vector3(0.31, 1.77, 0.31), "shade"); ball(pp + Vector3(0, 1.86, 0), 0.1, pal("gold"))
		solids.append(Vector3(pp.x, pp.z, 0.42))
	N["sp3_wallpt"] = c + Vector3(cos(w0), 0, sin(w0)) * 4.875
	# edges
	parapet(Vector3(SP3_X0 + 0.5, 0, SP3_Z0 + 0.1), Vector3(SP3_X1 - 0.1, 0, SP3_Z0 + 0.1)); parapet(Vector3(SP3_X1 - 0.1, 0, SP3_Z0 + 0.1), Vector3(SP3_X1 - 0.1, 0, SP3_Z1 - 0.1))
	parapet(Vector3(SP3_X0 + 0.1, 0, SP3_Z1 - 0.1), Vector3(SP3_X1 - 0.1, 0, SP3_Z1 - 0.1))
	_sp_chan(Vector3(SP3_X0 + 0.02, 0, SP2_DOOR.z), Vector3(c.x - 5.9, 0, SP2_DOOR.z), false)      # a stub of the channel, through the door
	stele("sp_stele3", Vector3(SP3_X0 + 0.8, 0, SP3_Z1 - 1.0), PI * 0.5, ["Each one is something\nI wished she were.", "In the water\neach looks at what it wants.\nNone of them looks at me."])
	_look_add("", _sp3_pt(deg_to_rad(225.0), SP3_RI), 0.3, ["a bronze rail, a spur to each place", "one place is empty. whatever is pushed runs to it"])
	_look_add("", _sp3_pt(deg_to_rad(262.0), 4.5), 0.8, ["a bench, for whoever was to sit and choose", "five places. he only ever made four of these"])
	_look_add("", SP3_P + Vector3(1.6, 0, 1.6), 0.3, ["a shallow basin. above, they all look ahead", "in the water not one of them does"])
	urn(Vector3(SP3_X1 - 0.8, 0, SP3_Z0 + 0.9), 1.0); urn(Vector3(SP3_X0 + 0.75, 0, SP3_Z0 + 2.6), 0.9, "rose"); cypress(Vector3(SP3_X0 + 0.7, 0, SP3_Z0 + 0.8), 1.3)

func _sp_things3() -> void:
	for i in 4: objs["sp3_st%d" % i] = {"at": Vector3.ZERO, "stand": Vector3.ZERO, "mark": false, "hits": []}
	objs["sp3_place"] = {"at": Vector3.ZERO, "stand": Vector3.ZERO, "mark": false, "hits": []}
	_sp3_sync()
	_sp3_heads_now()

func _sp_nav3() -> void:
	var c := SP3_C
	rects["SP3n"] = R(c.x - 4.25, c.z - 4.25, SP3_X1 - 0.45, SP3_P.z - SP3_PR - 0.45)
	rects["SP3w"] = R(c.x - 4.25, c.z - 4.25, SP3_P.x - SP3_PR - 0.45, SP3_Z1 - 0.45)
	rects["SP3c"] = R(SP3_P.x - SP3_PR - 0.45, SP3_P.z - SP3_PR - 0.45, c.x - 1.8, c.z - 1.8)
	rects["SP3e"] = R(SP3_X0 + 0.45, SP2_DOOR.z - 0.9, SP3_P.x - SP3_PR - 0.45, SP3_Z1 - 0.45)      # inside the door
	for k in 13:      # the bench, where it crosses the corner
		var a := deg_to_rad(195.0 + 5.0 * k)
		solids.append(Vector3(c.x + cos(a) * 4.6, c.z + sin(a) * 4.6, 0.36))
	for i in 4:
		var p := _sp3_place(sp3_at[i])
		sp3_sol.append(solids.size()); solids.append(Vector3(p.x, p.z, 0.45))

## where she stands to push the statue at a place off toward another: behind it and to the side away from where it goes
func _sp3_push_at(from: int, to: int) -> Vector3:
	return _sp3_pt(_sp3_ang(from) + deg_to_rad(12.5 if to > from else -12.5), 4.05)

## what can be tapped, and what she walks round, set to where the four stand now
func _sp3_sync() -> void:
	for i in 4:
		var p := _sp3_place(sp3_at[i])
		objs["sp3_st%d" % i].at = p + Vector3(0, 1.0, 0); objs["sp3_st%d" % i].hits = [p + Vector3(0, 0.15, 0), p + Vector3(0, 1.8, 0)]
		if i < sp3_sol.size(): solids[sp3_sol[i]] = Vector3(p.x, p.z, 0.45)
	var h := _sp3_hole(); var hp := _sp3_place(h)
	objs["sp3_place"].at = hp + Vector3(0, 0.3, 0); objs["sp3_place"].hits = [hp + Vector3(0, 0.02, 0), hp + Vector3(0, 0.5, 0)]
	objs["sp3_place"].stand = _sp3_pt(_sp3_ang(h) + deg_to_rad(-12.5 if h >= 2 else 12.5), 4.05)

## which of the four have what they want
func _sp3_sat() -> Array:
	return [sp3_at[0] == 0, sp3_at[1] == 4, absi(sp3_at[2] - sp3_at[3]) == 1, flags.get("sp3_posed", false)]

## how far round a statue's head must turn (from straight ahead) to look at a place
func _sp3_yaw_to(i: int, target: Vector3) -> float:
	var at := _sp3_place(sp3_at[i])
	return clampf(angle_difference(atan2(SP3_C.x - at.x, SP3_C.z - at.z), atan2(target.x - at.x, target.z - at.z)), -1.25, 1.25)

## a statue set as it is noted to be: turned by its yaw (part on its plinth, part in the neck and the head), its head bowed by its bow
func _sp3_head_set(h: Dictionary) -> void:
	var sk: Skeleton3D = h.get("sk")
	var yw: float = float(h.yaw) * 0.55      # (the rest of the turn is the whole figure's, on its plinth: a head alone is too small a sign in the water)
	if h.get("st") != null: (h.st as Node3D).rotation.y = float(h.yaw) * 0.45
	if sk == null or int(h.hi) < 0: return
	sk.set_bone_pose_rotation(h.hi, h.h0)
	if int(h.ni) >= 0: sk.set_bone_pose_rotation(h.ni, h.n0)
	var la := _bone(sk, "LeftArm"); var ra := _bone(sk, "RightArm")
	var left := (sk.get_bone_global_pose(la).origin - sk.get_bone_global_pose(ra).origin).normalized()
	if int(h.ni) >= 0:
		_bend(sk, "Neck", Vector3.UP, yw * 0.5); _bend(sk, "Head", Vector3.UP, yw * 0.5)
	else: _bend(sk, "Head", Vector3.UP, yw)
	if absf(float(h.bow)) > 0.0005: _bend(sk, "Head", Basis(Vector3.UP, yw) * left, float(h.bow))

## what each head should be doing as things stand: [yaw, bow] for statue i (twin: its twin in the water). The twins
## look at what they want; a statue above looks ahead, until it has what it wants: then it looks as its twin does.
## At the end all of them bow
func _sp3_head_want(i: int, twin: bool) -> Array:
	var tg: Array = [SP3_SEA, N["sp3_wallpt"], _sp3_place(sp3_at[3]), _sp3_place(_sp3_hole())]
	var y := _sp3_yaw_to(i, tg[i])
	return [y if (twin or _sp3_sat()[i]) else 0.0, 0.34 if flags.get("sp3_done", false) else 0.0]

func _sp3_heads_now() -> void:
	for i in 4:
		for t in 2:
			var h: Dictionary = sp3_h[i * 2 + t]
			var w := _sp3_head_want(i, t == 1)
			h.yaw = w[0]; h.bow = w[1]; _sp3_head_set(h)

## the heads go to what they should be doing, slowly
func _sp3_heads(secs := 0.9) -> void:
	var t := create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT); var any := false
	for i in 4:
		for k in 2:
			var h: Dictionary = sp3_h[i * 2 + k]
			var w := _sp3_head_want(i, k == 1)
			var y0: float = h.yaw; var b0: float = h.bow; var y1: float = w[0]; var b1: float = w[1]
			if absf(y0 - y1) < 0.01 and absf(b0 - b1) < 0.01: continue
			any = true
			t.tween_method(func(v: float) -> void:
				h.yaw = lerpf(y0, y1, v); h.bow = lerpf(b0, b1, v); _sp3_head_set(h), 0.0, 1.0, secs)
	if any: await t.finished
	else: t.kill()

func use(k: String) -> void:
	if k.begins_with("sp3_st"):
		var i := int(k.substr(6))
		objs[k].stand = _sp3_push_at(sp3_at[i], _sp3_hole())
	await super.use(k)

func _do_sp3_st0() -> void: await _sp3_slide(0)
func _do_sp3_st1() -> void: await _sp3_slide(1)
func _do_sp3_st2() -> void: await _sp3_slide(2)
func _do_sp3_st3() -> void: await _sp3_slide(3)

## she lays her hands on a statue and pushes: it runs in along its spur, round the rail, and out to the empty place
func _sp3_slide(i: int) -> void:
	var from: int = sp3_at[i]; var to := _sp3_hole()
	var a0 := _sp3_ang(from); var a1 := _sp3_ang(to)
	var sp := _sp3_place(from)
	await face(sp)
	var d := sp - pos; d.y = 0.0; d = d.normalized(); var lat := Vector3(d.z, 0, -d.x)
	tgtL = sp + Vector3(0, 1.32, 0) - d * 0.2 - lat * 0.13; tgtR = sp + Vector3(0, 1.32, 0) - d * 0.2 + lat * 0.13
	var s0 := cam.size
	cam_focus = SP3_C + Vector3(0.5, 0.4, 0.5); cam_focus_on = true
	create_tween().tween_property(cam, "size", 8.8, 1.4).set_trans(Tween.TRANS_SINE)
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.6); up.tween_property(self, "a_wR", 1.0, 0.6); up.tween_property(self, "a_lean", 0.2, 0.6)
	await up.finished
	await wait(0.25)
	var mv := func(a: float, r: float) -> void:
		for sfx in ["", "_m"]:
			var nd: Node3D = N["sp3_st%d%s" % [i, sfx]]
			nd.position = _sp3_pt(a, r); nd.rotation.y = atan2(-cos(a), -sin(a))
	var t := create_tween()
	t.tween_method(func(v: float) -> void: mv.call(a0, v), SP3_RA, SP3_RI, 1.3).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t.tween_method(func(v: float) -> void: mv.call(v, SP3_RI), a0, a1, maxf(1.3, absf(a1 - a0) * SP3_RI / 0.95)).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t.tween_method(func(v: float) -> void: mv.call(a1, v), SP3_RI, SP3_RA, 1.3).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	var push := create_tween().set_parallel(); push.tween_property(self, "tgtL", tgtL + d * 0.22, 0.6); push.tween_property(self, "tgtR", tgtR + d * 0.22, 0.6)      # her hands go a little way with it
	await wait(0.65)
	var dn := tw(); dn.tween_property(self, "a_wL", 0.0, 0.6); dn.tween_property(self, "a_wR", 0.0, 0.6); dn.tween_property(self, "a_lean", 0.0, 0.6)
	await t.finished
	sp3_at[i] = to
	_sp3_sync()
	await _sp3_heads(0.9)
	await wait(0.3)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## P.3: the empty place. She steps onto it and takes the stance. The one that looked at the empty place has what it
## wanted. If the other three have too, all four bow their heads, and the sluice across the lane goes down
func _do_sp3_place() -> void:
	var h := _sp3_hole(); var pl := _sp3_place(h); var back := pos
	if not refl_out.is_empty(): await _refl_melt()
	var s0 := cam.size
	cam_focus = SP3_C + Vector3(0.5, 0.4, 0.5); cam_focus_on = true
	create_tween().tween_property(cam, "size", 8.8, 1.4).set_trans(Tween.TRANS_SINE)
	await go([pl], 0.8)
	await face(SP3_C)
	await wait(0.4)
	var f := (SP3_C - pl).normalized(); var lat := Vector3(f.z, 0, -f.x)
	tgtL = pl + f * 0.21 + Vector3(0, 1.44, 0) + lat * 0.03; tgtR = pl + f * 0.21 + Vector3(0, 1.44, 0) - lat * 0.03
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.2); up.tween_property(self, "a_wL", 1.0, 1.2)
	await up.finished
	posing = true; flags["sp3_posed"] = true
	await _sp3_heads(1.0)      # the one that wanted the empty place looks at her
	var sat := _sp3_sat()
	if sat[0] and sat[1] and sat[2]:
		await wait(0.9)
		flags["sp3_done"] = true
		await _sp3_heads(1.5)      # they bow
		await wait(0.9)
		for k in ["sp3_st0", "sp3_st1", "sp3_st2", "sp3_st3", "sp3_place"]: done[k] = true
		cam_focus = Vector3(-18.8, 0.4, SP2_Z0 + 1.5)
		await wait(2.4)
		await sluice_open("sp_s3", 2.6)
		rects["SP3g"].on = true
		await wait(0.7)
		cam_focus = SP3_C + Vector3(0.5, 0.4, 0.5)
		await wait(1.2)
	else:
		await wait(2.4)
	posing = false; flags["sp3_posed"] = false
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.8); dn.tween_property(self, "a_wL", 0.0, 0.8)
	await dn.finished
	if not flags.get("sp3_done", false): await _sp3_heads(0.9)
	await go([back], 0.8)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)


# ---------------------------------------------------------------- P.4 the missing Caryatid
## The house of the spring. Along its front a beam is carried on the raised hands of five statues of her; there are
## six places. Where the sixth should stand the beam is broken and its west piece hangs: the bronze door, which hangs
## from that piece, bites its sill and will not slide. The door is fenced in between two grilles; a jetty runs from
## it out into the pool, to a round landing a stride short of the west rim. On that rim stands a colossus with a
## gilded palm. In the water the beam is level: there the sixth stands
func _sp4_under(x: float) -> float:      # how high the underside of the hanging piece is at x, as it hangs now
	return SP4_JOINT.y - (SP4_JOINT.x - x) * tan((N["sp4_beam"] as Node3D).rotation.z)

## a bronze pin with a ring for a head. It lies along its own y
func _sp4_pin(parent: Node, twin: bool) -> Node3D:
	var n := Node3D.new(); parent.add_child(n)
	var flat := "flat2" if twin else "flat"
	cyl(Vector3(0, -0.15, 0), 0.022, 0.03, 0.3, pal("gold", flat), 10, n)
	var ring := TorusMesh.new(); ring.inner_radius = 0.03; ring.outer_radius = 0.055; ring.rings = 14; ring.ring_segments = 6
	var rm := prim(ring, Vector3(0, 0.2, 0), pal("gold", flat), n); rm.rotation.x = PI * 0.5
	cyl(Vector3(0, 0.13, 0), 0.045, 0.045, 0.025, pal("gold", flat), 10, n)
	return n

func _sp_court4() -> void:
	floor_plain(SPL_X0, SP4_Z1, SPL_X1, SP2_Z0, 0.0); land_paths.append([SPL_X0, SP4_Z1, SPL_X1, SP2_Z0])
	for e in [SPL_X0 + 0.1, SPL_X1 - 0.1]: parapet(Vector3(e, 0, SP4_Z1 + 0.02), Vector3(e, 0, SP2_Z0 - 0.02))
	_pool_court(SP4_X0, SP4_Z0, SP4_X1, SP4_Z1, SP4_QX0, SP4_QZ0, SP4_QX1, SP4_QZ1, "stone", "PoolSkySp4"); _sp_pit("PoolSkySp4", 5.6)
	tile_hole = Rect2(SP4_QX0 - 0.08, SP4_QZ0 - 0.08, SP4_QX1 - SP4_QX0 + 0.16, SP4_QZ1 - SP4_QZ0 + 0.16); tiles(SP4_X0, SP4_Z0, SP4_X1, SP4_Z1, 1.0); tile_hole = Rect2()
	glass(SP4_QX0, SP4_QZ0, SP4_QX1, SP4_QZ1)
	var pl := SP4_PL; var dx := SP4_DOOR_X
	var porch := R(SP4_QX0, SP4_HZ + 0.1, pl.x + 0.35, SP4_QZ0); var wrim := R(SP4_QX0 - 1.5, SP4_HZ + 0.1, SP4_QX0, SP4_QZ1)
	W["SP4"] = {"r": [SP4_QX0, SP4_QZ0, SP4_QX1, SP4_QZ1], "far": 14.0,
		"heads": [R(SP4_QX0 - 0.6, SP4_ROW - 0.15, pl.x - 0.3, SP4_QZ0 - 0.25), R(SP4_QX0 - 0.9, SP4_QZ0 - 0.4, SP4_QX0 - 0.45, SP4_QZ1), R(pl.x - 0.3, pl.z - 0.3, pl.x + 0.3, pl.z + 0.3, true, 0.17)],
		"foot": {"pl": R(pl.x - 0.3, pl.z - 0.3, pl.x + 0.3, pl.z + 0.3, true, 0.17), "porch": porch, "w": wrim,
			"thr": R(dx - 0.6, SP4_HZ + 0.1, dx + 0.6, SP4_QZ0), "jet": R(dx - 0.45, SP4_QZ0, dx + 0.45, SP4_T.z - 0.8), "T": R(SP4_T.x - 0.9, SP4_T.z - 0.9, SP4_T.x + 0.9, SP4_T.z + 0.9)}}
	WL.append("SP4")
	# the house: two pieces of wall and the lintel of its doorway, with their twins; the doorway, dark
	wall(SP4_HX0, SP4_Z0, dx - 0.65, SP4_HZ, SP4_HH, true); wall(dx + 0.65, SP4_Z0, SP4_HX1, SP4_HZ, SP4_HH, true)
	blk(Vector3(dx - 0.65, 2.02, SP4_Z0), Vector3(dx + 0.65, SP4_HH, SP4_HZ), "stone"); cornice(dx - 0.65, SP4_Z0, dx + 0.65, SP4_HZ, SP4_HH, 0.04, 0.06)
	blk(Vector3(dx - 0.65, 2.02, SP4_Z0), Vector3(dx + 0.65, SP4_HH, SP4_HZ), "stone", mroot).material_override = under_mat(Color("d8ccb9"))
	blk(Vector3(dx - 0.65, 0, SP4_Z0 + 0.2), Vector3(dx + 0.65, 2.02, SP4_HZ - 0.5), "dark")
	blk(Vector3(dx - 0.65, 0, SP4_Z0 + 0.2), Vector3(dx + 0.65, 2.02, SP4_HZ - 0.5), "dark", mroot).material_override = under_mat(Color("5b5474"))
	blk(Vector3(dx - 0.65, 0, SP4_HZ - 0.5), Vector3(dx + 0.65, 0.014, SP4_HZ + 0.06), "shade")      # its sill
	blk(Vector3(SP4_HX0 + 0.45, SP4_HH + 0.06, SP4_Z0 + 0.12), Vector3(SP4_HX1 - 0.45, SP4_HH + 0.3, SP4_HZ - 0.18), "stone"); blk(Vector3(SP4_HX0 + 0.4, SP4_HH + 0.3, SP4_Z0 + 0.07), Vector3(SP4_HX1 - 0.4, SP4_HH + 0.36, SP4_HZ - 0.13), "shade")      # a low attic over it
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var sfx := "_m" if twin else ""
		var flat := "flat2" if twin else "flat"
		# the five, an arm raised under the beam; the sixth place: an empty plinth above, a sixth of them in the water
		for x in SP4_CAR: her_plinth(Vector3(x, 0, SP4_ROW), 0.0, "reach", both)
		var six := her_plinth(pl, 0.0, "reach" if twin else "", both)
		if twin: N["sp4_six_m"] = six
		# the beam: its east piece lies on the five; its west piece, from the break on, is carried by nothing
		var by := SP4_JOINT.y
		blk(Vector3(SP4_JOINT.x, by, SP4_ROW - 0.25), Vector3(SP4_HX1 - 0.1, by + 0.3, SP4_ROW + 0.3), "stone", both)
		blk(Vector3(SP4_JOINT.x, by + 0.3, SP4_ROW - 0.29), Vector3(SP4_HX1 - 0.06, by + 0.36, SP4_ROW + 0.34), "shade", both)
		var bm := Node3D.new(); bm.position = SP4_JOINT; both.add_child(bm); N["sp4_beam" + sfx] = bm
		if not twin: bm.rotation.z = SP4_SAG
		blk(Vector3(-2.75, 0, -0.275), Vector3(0, 0.3, 0.275), "stone", bm); blk(Vector3(-2.79, 0.3, -0.315), Vector3(0, 0.36, 0.315), "shade", bm)
		blk(Vector3(-2.72, -0.05, -0.44), Vector3(-0.03, -0.01, -0.36), "gold", bm)      # the rail the door runs on, under its north edge
		for k in 6: blk(Vector3(-2.6 + 0.5 * k, -0.03, -0.36), Vector3(-2.54 + 0.5 * k, 0.05, -0.275), "gold", bm)      # and the brackets that hold the rail
		# the door: a bronze leaf with two sunk panels, hung from two wheels
		var dr := Node3D.new(); dr.position = Vector3(dx - SP4_JOINT.x, 0, -0.4); bm.add_child(dr); N["sp4_door" + sfx] = dr
		blk(Vector3(-0.65, -1.9, -0.02), Vector3(0.65, -0.1, 0.02), "gold", dr)
		for pn in [[-1.78, -1.1], [-0.98, -0.22]]:
			blk(Vector3(-0.53, pn[0], 0.02), Vector3(0.53, pn[1], 0.026), "dark", dr); blk(Vector3(-0.47, pn[0] + 0.06, 0.026), Vector3(0.47, pn[1] - 0.06, 0.032), "gold", dr)
		for hx in [-0.42, 0.42]:
			blk(Vector3(hx - 0.03, -0.12, -0.012), Vector3(hx + 0.03, -0.035, 0.012), "gold", dr)
			var whl := cyl(Vector3.ZERO, 0.05, 0.05, 0.03, pal("gold", flat), 12, dr); whl.rotation.x = PI * 0.5; whl.position = Vector3(hx, -0.005, 0.0)
		var hr := TorusMesh.new(); hr.inner_radius = 0.045; hr.outer_radius = 0.065; hr.rings = 14; hr.ring_segments = 6
		prim(hr, Vector3(0.45, -1.05, 0.05), pal("gold", flat), dr).rotation.x = PI * 0.5
		# the strap across the break, with the hole for the pin; the keeper on the jamb; the pin
		blk(Vector3(SP4_HOLE.x - 0.22, by + 0.07, SP4_ROW + 0.3), Vector3(SP4_JOINT.x + 0.3, by + 0.23, SP4_ROW + 0.325), "gold", both)      # (a strap on the east piece, across the break...)
		blk(Vector3(SP4_HOLE.x - 0.12, SP4_HOLE.y - 0.13, SP4_ROW + 0.3), Vector3(SP4_HOLE.x + 0.12, by + 0.07, SP4_ROW + 0.325), "gold", both)      # (...its tongue, hanging under the beam, with the hole...)
		blk(Vector3(SP4_HOLE.x - SP4_JOINT.x - 0.1, SP4_HOLE.y - by - 0.11, 0.245), Vector3(SP4_HOLE.x - SP4_JOINT.x + 0.1, 0.0, 0.27), "gold", bm)      # (...and behind it the tongue of the west piece: their holes meet only when the beam is level)
		var ho := cyl(Vector3.ZERO, 0.036, 0.036, 0.01, pal("dark", flat), 12, both); ho.rotation.x = PI * 0.5; ho.position = Vector3(SP4_HOLE.x, SP4_HOLE.y, SP4_ROW + 0.328)
		for kx in [-0.16, 0.0, 0.16, 0.4]:
			var rv := cyl(Vector3.ZERO, 0.022, 0.022, 0.012, pal("dark", flat), 8, both); rv.rotation.x = PI * 0.5; rv.position = Vector3(SP4_HOLE.x + kx, by + 0.15, SP4_ROW + 0.33)
		blk(SP4_KEEP + Vector3(-0.07, 0.16, -0.06), SP4_KEEP + Vector3(0.12, 0.19, 0.06), "gold", both)      # (a small shelf with a slot: the pin hangs in it by its collar)
		var pin := _sp4_pin(both, twin); pin.position = SP4_KEEP + Vector3(0, 0.08, 0.0); N["sp4_pin" + sfx] = pin
		# the two grilles that fence the door in, from the wall to the water's edge (they leave the door room to pass behind them)
		for gx in [dx - 0.85, dx + 0.85]: leaf("", Vector3(gx, 0, SP4_ROW + 0.02), true, 0.4, 1.5, both, twin)
		# the jetty and its landing
		blk(Vector3(dx - 0.45, 0.0, SP4_QZ0 - 0.02), Vector3(dx + 0.45, 0.05, SP4_T.z - 0.6), "stone", both)
		cyl(SP4_T, 0.9, 0.9, 0.05, pal("stone", flat), 32, both); turned(SP4_T, [[0.94, 0.0], [0.94, 0.03], [0.9, 0.03]], "shade", 32, both)
		for e in [-0.47, 0.47]: blk(Vector3(dx + e - 0.02, 0.0, SP4_QZ0 - 0.02), Vector3(dx + e + 0.02, 0.03, SP4_T.z - 0.75), "shade", both)
		# the lever of the head-gate
		_sp_lever(SP4_LEVER, "sp_lever4" + sfx, both)
	_sp_colossus("4", SP4_S, 1, "SP4", SP4_S + Vector3(2.9, 0.4, 2.6), true, 0.0, 10.5)
	sp_col["4"].dir = -1
	# the channel: from the pool's west edge, through the head-gate, to the lane, and down the lane
	sluice("sp_s4", SP4_GATE, true, 0.6, 1.0)
	_sp_chan(Vector3(SP4_QX0 - 0.07, 0, SP4_GATE.z), Vector3(-19.5, 0, SP4_GATE.z), false); _sp_chan(Vector3(-19.5, 0, SP4_GATE.z - 0.5), Vector3(-19.5, 0, SP2_Z0 + 0.3), false)
	# edges: the house and a wall on the north, low elsewhere
	wall(SP4_X0, SP4_Z0, SP4_HX0, SP4_Z0 + 0.3, 1.7); wall(SP4_HX1, SP4_Z0, SP4_X1, SP4_Z0 + 0.3, 1.7)
	parapet(Vector3(SP4_X0 + 0.1, 0, SP4_Z0 + 0.4), Vector3(SP4_X0 + 0.1, 0, SP4_Z1 - 0.1)); parapet(Vector3(SP4_X1 - 0.1, 0, SP4_Z0 + 0.4), Vector3(SP4_X1 - 0.1, 0, SP4_Z1 - 0.1))
	parapet(Vector3(SP4_X0 + 0.1, 0, SP4_Z1 - 0.1), Vector3(SPL_X0, 0, SP4_Z1 - 0.1)); parapet(Vector3(SPL_X1, 0, SP4_Z1 - 0.1), Vector3(SP4_X1 - 0.1, 0, SP4_Z1 - 0.1))
	stele("sp_stele4", Vector3(SP4_X0 + 0.75, 0, -81.4), PI * 0.5, ["Five will hold it.\nThe sixth I never finished.", "Set every hand\nbefore you turn to stone."])
	_look_add("sp_look_beam", Vector3(-13.0, 0, SP4_ROW + 0.2), 2.4, ["the beam is broken where the sixth should stand. it hangs", "the door hangs from it, and bites its sill"])
	_look_add("sp_look_gate4", SP4_GATE + Vector3(0.0, 0, 0.0), 1.0, ["the head-gate of the channel", "nothing behind it yet but still water. the spring is shut in its house"])
	_look_add("", SP4_T + Vector3(0.6, 0, 0.5), 0.3, ["a landing before the door, out in the pool", "a stride of water short of the rim"])
	urn(Vector3(SP4_X1 - 0.8, 0, SP4_Z1 - 0.8), 1.0); urn(Vector3(SP4_X0 + 0.8, 0, SP4_Z0 + 1.0), 1.0, "rose"); cypress(Vector3(-19.2, 0, SP4_Z0 + 1.0), 2.4)

func _sp_things4() -> void:
	_sp_col_things("4", SP4_S + Vector3(0.72, 0, 0.72))
	var pl := SP4_PL
	objs["sp4_place"] = {"at": pl + Vector3(0, 0.3, 0), "stand": pl + Vector3(-0.72, 0, 0), "mark": false, "hits": [pl + Vector3(0, 0.02, 0), pl + Vector3(0, 0.5, 0)]}
	var dz := SP4_ROW - 0.4
	objs["sp_door4"] = {"at": Vector3(SP4_DOOR_X, -1.0, dz), "stand": pl, "mark": false, "water": "SP4", "rstand": Vector3(SP4_DOOR_X, 0, SP4_ROW + 0.08),
		"hits": [Vector3(SP4_DOOR_X, -0.25, dz), Vector3(SP4_DOOR_X, -1.85, dz)]}
	objs["sp_gate4"] = {"at": SP4_LEVER + Vector3(0, 0.6, 0), "stand": SP4_LEVER + Vector3(-0.42, 0, 0), "mark": false, "hits": [SP4_LEVER + Vector3(0, 0.1, 0), SP4_LEVER + Vector3(0.3, 0.95, 0)]}
	done["sp_gate4"] = true      # (nothing to let through until the spring is open)

func _sp_nav4() -> void:
	rects["SP4l"] = R(-19.75, SP4_Z1 - 0.5, -19.25, SP2_Z0 + 0.7)      # the lane, in from the sluice
	rects["SP4w"] = R(SP4_X0 + 0.45, SP4_Z0 + 0.6, SP4_QX0 - 0.45, SP4_Z1 - 0.45)      # the west of the court
	rects["SP4p"] = R(SP4_QX0 - 0.45, SP4_ROW - 0.12, SP4_PL.x - 0.4, SP4_ROW + 0.1)      # onto the porch, as far as the sixth place
	solids.append(Vector3(SP4_S.x, SP4_S.z, 1.0)); solids.append(Vector3(SP4_LEVER.x, SP4_LEVER.z, 0.3))
	for e in [-0.77, 0.77]: solids.append(Vector3(SP4_GATE.x, SP4_GATE.z + e, 0.26))

func _do_sp_col_4() -> void: await _sp_turn("4")
func _do_sp_palm_4() -> void: await _sp_on_palm("4")

## the hanging piece of the beam goes to an angle, and her raised hand with it
func _sp4_beam_to(a: float, secs: float, hand := true) -> void:
	var bm: Node3D = N["sp4_beam"]
	var t := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	t.tween_method(func(v: float) -> void:
		bm.rotation.z = v
		if hand: tgtR = Vector3(SP4_PL.x - 0.13, _sp4_under(SP4_PL.x - 0.13) - 0.015, SP4_PL.z + 0.2), bm.rotation.z, a, secs)
	await t.finished

## P.4: the sixth place. She steps up, raises her arm under the hanging beam and lifts it level; and is stone for
## as long as she holds it
func _do_sp4_place() -> void:
	var pl := SP4_PL
	if not refl_out.is_empty() and _flat((refl_out.holder as Node3D).position, pl) < 0.5: await _refl_melt()
	var s0 := cam.size
	cam_focus = Vector3(-13.0, 0.9, -82.9); cam_focus_on = true
	create_tween().tween_property(cam, "size", 9.4, 1.6).set_trans(Tween.TRANS_SINE)
	go([pl], 0.8)
	while pos.x < pl.x - 0.48: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.17, 0.45).set_trans(Tween.TRANS_SINE)
	await arrived
	(N["sp4_six_m"] as Node3D).visible = false      # the sixth the water showed there was her: her own reflection stands in its place now
	await face(pl + Vector3(0, 0, 3.0))
	await wait(0.4)
	tgtR = Vector3(pl.x - 0.13, _sp4_under(pl.x - 0.13) - 0.015, pl.z + 0.2)
	var up := tw(); up.tween_property(self, "a_wR", 1.0, 1.1); up.tween_property(self, "a_headp", -0.18, 1.1)
	await up.finished
	await wait(0.3)
	await _sp4_beam_to(0.0, 1.7)
	create_tween().tween_property(self, "a_headp", 0.0, 0.8).set_trans(Tween.TRANS_SINE)
	posing = true; flags["sp4_posed"] = true
	await wait(0.8)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## she lets the beam down (if nothing else holds it, it hangs again) and steps off the place; then the tap that asked
## for it is taken
func _sp4_leave(sp: Vector2) -> void:
	busy = true
	posing = false; flags["sp4_posed"] = false
	if not flags.get("sp4_pinned", false): await _sp4_beam_to(SP4_SAG, 1.5)
	var dn := tw(); dn.tween_property(self, "a_wR", 0.0, 0.8)
	await dn.finished
	var pl := SP4_PL
	go([pl + Vector3(-0.72, 0, 0)], 0.8)
	while pos.x > pl.x - 0.14: await get_tree().process_frame
	create_tween().tween_property(self, "pos:y", 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	await arrived
	busy = false; settled.emit()
	if _tap_dist("sp4_place", sp) > 64.0 * get_viewport().get_visible_rect().size.x / 720.0: tap(sp)

func tap(sp: Vector2) -> void:
	if started and not ended and not busy and flags.get("sp4_posed", false):      # she holds the beam: only an order to her reflection leaves her there
		var px := get_viewport().get_visible_rect().size.x / 720.0
		var to_water: bool = _water_under(sp) != null
		for k in ["sp_door4", "sp_palm_4"]:
			if not done.has(k) and _tap_dist(k, sp) < 64.0 * px: to_water = true
		if _tap_dist("sp_col_4", sp) < _tap_dist("sp_palm_4", sp) and _tap_dist("sp_col_4", sp) < 64.0 * px and not done.has("sp_col_4"): to_water = false
		if not to_water:
			_sp4_leave(sp); return
	super.tap(sp)

## P.4: the door, as the water shows it. Her reflection, come over the palm and along the jetty, lays its hands on it.
## While the beam hangs the door bites its sill. While she holds the beam level it runs aside; and her reflection
## takes the pin from its keeper and sets it through the strap, so that the beam holds without her
func _do_sp_door4() -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, PI), 0.4).set_trans(Tween.TRANS_SINE)
	await rt.finished
	var hm := _hermod(e)
	var dr: Node3D = N["sp4_door"]; var dm: Node3D = N["sp4_door_m"]
	var x0 := dr.position.x; var dz := SP4_ROW - 0.36
	var hands := func(off: float) -> void:
		hm.tL = Vector3(SP4_DOOR_X + 0.17 + off, -1.2, dz); hm.tR = Vector3(SP4_DOOR_X - 0.17 + off, -1.2, dz)
	hands.call(0.0); hm.own = true
	var s0 := cam.size
	cam_focus = Vector3(-12.6, 0.9, -83.3); cam_focus_on = true
	create_tween().tween_property(cam, "size", 8.6, 1.4).set_trans(Tween.TRANS_SINE)
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wL", 1.0, 0.6); hu.tween_property(hm, "wR", 1.0, 0.6); hu.tween_property(hm, "bow", 0.14, 0.6)
	await hu.finished
	await wait(0.3)
	if not flags.get("sp4_posed", false):      # the beam hangs: the door gives a finger's width and stops
		var sh := create_tween().set_trans(Tween.TRANS_SINE)
		sh.tween_method(func(v: float) -> void: dm.position.x = x0 - v; dr.position.x = x0 - v * 0.5; hands.call(-v), 0.0, 0.05, 0.35)
		sh.tween_method(func(v: float) -> void: dm.position.x = x0 - v; dr.position.x = x0 - v * 0.5; hands.call(-v), 0.05, 0.0, 0.45)
		sh.tween_interval(0.25)
		sh.tween_method(func(v: float) -> void: dm.position.x = x0 - v; dr.position.x = x0 - v * 0.5; hands.call(-v), 0.0, 0.04, 0.3)
		sh.tween_method(func(v: float) -> void: dm.position.x = x0 - v; dr.position.x = x0 - v * 0.5; hands.call(-v), 0.04, 0.0, 0.45)
		await sh.finished
		say("it bites its sill. the beam above it hangs")
		var h0 := create_tween().set_parallel(); h0.tween_property(hm, "wL", 0.0, 0.6); h0.tween_property(hm, "wR", 0.0, 0.6); h0.tween_property(hm, "bow", 0.0, 0.6)
		await h0.finished
		hm.own = false
		await _refl_no(e)
		cam_focus_on = false
		create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
		return
	# the door runs aside, westward, behind the grille and behind her
	var sl := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	sl.tween_method(func(v: float) -> void:
		dr.position.x = x0 - v; dm.position.x = x0 - v; hands.call(-minf(v, 0.42)), 0.0, 1.3, 3.0)
	await wait(1.5)
	var h1 := create_tween().set_parallel(); h1.tween_property(hm, "wL", 0.0, 0.7); h1.tween_property(hm, "wR", 0.0, 0.7); h1.tween_property(hm, "bow", 0.0, 0.7)
	await sl.finished
	done["sp_door4"] = true; looks.erase("sp_look_beam")
	await wait(0.4)
	# the pin: a step to the east jamb, a hand to the keeper, the pin up to the strap and home
	refl_token += 1
	await _refl_walk_pts(e, [Vector3(SP4_DOOR_X + 0.42, 0, SP4_ROW + 0.26)], 0.0, refl_token, 0.7)
	var r2 := create_tween(); r2.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, PI * 0.5 + 0.3), 0.4).set_trans(Tween.TRANS_SINE)
	await r2.finished
	var pn: Node3D = N["sp4_pin"]; var pm: Node3D = N["sp4_pin_m"]
	var p0 := pn.position; var p1 := p0 + Vector3(-0.04, 0.24, 0.05); var p2 := Vector3(SP4_HOLE.x, SP4_HOLE.y, SP4_ROW + 0.66); var p3 := Vector3(SP4_HOLE.x, SP4_HOLE.y, SP4_ROW + 0.39)
	var grip := func() -> void: hm.tR = Vector3(pn.position.x, -pn.position.y, pn.position.z + 0.03)
	grip.call()
	var g0 := create_tween().set_parallel(); g0.tween_property(hm, "wR", 1.0, 0.7); g0.tween_property(hm, "bow", 0.06, 0.7)
	await g0.finished
	await wait(0.25)
	var carry := func(v: float) -> void:
		var q: Vector3 = p0.lerp(p1, clampf(v / 0.25, 0.0, 1.0)) if v < 0.25 else (p1.lerp(p2, (v - 0.25) / 0.5) if v < 0.75 else p2.lerp(p3, (v - 0.75) / 0.25))
		var tilt := PI * 0.5 * smoothstep(0.25, 0.75, v)      # from hanging upright to lying level, its point toward the hole
		for n in [pn, pm]: (n as Node3D).position = q; (n as Node3D).rotation.x = tilt
		grip.call()
	var ct := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT); ct.tween_method(carry, 0.0, 1.0, 3.2)
	await ct.finished
	flags["sp4_pinned"] = true
	await wait(0.3)
	var g1 := create_tween().set_parallel(); g1.tween_property(hm, "wR", 0.0, 0.7); g1.tween_property(hm, "bow", 0.0, 0.7)
	await g1.finished
	hm.own = false
	# the spring, shut in so long, comes out over the sill and across the landing into the pool
	await wait(0.4)
	await chan_run([Vector3(SP4_DOOR_X, 0, SP4_HZ - 0.45), Vector3(SP4_DOOR_X, 0, SP4_QZ0 + 0.02)], 0.7, 0.5)
	for k in ["sp_palm_4", "sp_col_4"]: done[k] = true
	done.erase("sp_gate4"); looks.erase("sp_look_gate4")
	await wait(0.8)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	await _refl_melt()

## P.4: the head-gate. With the spring running into the pool, she pulls its lever over: the gate goes down and the
## water takes the channel, down the lane toward the atrium. A straight way back: the lane itself
func _do_sp_gate4() -> void:
	await face(SP4_LEVER)
	var arm: Node3D = N["sp_lever4"]; var arm_m: Node3D = N["sp_lever4_m"]
	var grip := func() -> Vector3: return SP4_LEVER + Vector3(0, 0.22, 0) + Vector3(-sin(arm.rotation.z), cos(arm.rotation.z), 0) * 0.9
	tgtR = grip.call()
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(self, "a_lean", 0.12, 0.7)
	await a.finished
	await wait(0.3)
	var pt := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	pt.tween_method(func(v: float) -> void: arm.rotation.z = v; arm_m.rotation.z = v; tgtR = grip.call(), -0.6, 0.6, 1.8)
	await pt.finished
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.7); b.tween_property(self, "a_lean", 0.0, 0.7)
	await b.finished
	done["sp_gate4"] = true; done["sp4_place"] = true
	var s0 := cam.size
	cam_focus = Vector3(-17.4, 0.3, SP4_GATE.z + 0.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 10.0, 1.5).set_trans(Tween.TRANS_SINE)
	await wait(1.6)
	await sluice_open("sp_s4", 2.4)
	chan_run([Vector3(SP4_QX0 - 0.05, 0, SP4_GATE.z), Vector3(-19.5, 0, SP4_GATE.z), Vector3(-19.5, 0, UZ0 + 0.3)], 2.4)      # the water is on its way to the atrium
	await wait(3.4)
	cam_focus = Vector3(-19.2, 0.3, SP4_Z1 + 0.4)
	await wait(3.0)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	_wing_done("N")

# ---------------------------------------------------------------- the run that tries the wing by taps
func _sp_refl_at() -> String:
	return str(((refl_out.holder as Node3D).position).snapped(Vector3.ONE * 0.01)) if not refl_out.is_empty() else "under her"

func _play_spring() -> void:
	var from := int(OS.get_environment("FROM")) if OS.get_environment("FROM") != "" else 1
	var only := OS.get_environment("ONLY") != ""      # (ONLY=1: stop after the station it starts at)
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)      # the title
	_wake_now(); _open_to("U")
	pos = Vector3(-19.5, 0, UZ0 + 1.4); yaw = PI; cam_t = pos
	_sp_open_to(from)
	await wait(1.0)
	if from <= 1:
		await _tap_wait(Vector3(-19.5, 0, -50.0))
		print("SPRING P.1 in the court at ", pos.snapped(Vector3.ONE * 0.01))
		var lv: Vector3 = objs["sp_lever1"].at
		await _tap_wait(lv)      # the obvious: send her reflection to the lever. No footing: it stops at the rim
		print("SPRING P.1 sent to the lever with no way: lever ", done.has("sp_lever1"), ", reflection ", _sp_refl_at())
		await _tap_wait(objs["sp_palm_1"].at)      # the gilded palm in the water
		print("SPRING P.1 on the palm: reflection ", _sp_refl_at(), " palm ", _sp_palm("1").snapped(Vector3.ONE * 0.01))
		await _tap_wait(SP1_S + Vector3(0, 2.0, 0))      # the colossus: a quarter turn
		print("SPRING P.1 first quarter: arm points ", sp_col["1"].q, ", reflection ", _sp_refl_at())
		await _tap_wait(lv)      # too soon: the palm hangs over open water
		print("SPRING P.1 lever from the half-way palm: ", done.has("sp_lever1"), ", reflection ", _sp_refl_at())
		await _tap_wait(SP1_S + Vector3(0, 2.0, 0))
		print("SPRING P.1 second quarter: arm points ", sp_col["1"].q, ", reflection ", _sp_refl_at())
		await _tap_wait(lv)
		print("SPRING P.1 lever ", done.has("sp_lever1"), " door ", rects["SP1d"].on, ", reflection ", _sp_refl_at())
	if from <= 2 and not (only and from < 2):
		var cq := func() -> String: return "A%d B%d C%d" % [sp_col["A"].q, sp_col["B"].q, sp_col["C"].q]
		await _tap_wait(Vector3(-24.0, 0, SP2_QZ0 - 0.7))
		print("SPRING P.2 on the north rim at ", pos.snapped(Vector3.ONE * 0.01))
		await _tap_wait(objs["sp_lever2"].at)      # the obvious: straight to the lever. It walks the rim and stops
		print("SPRING P.2 sent to the lever with no way: lever ", done.has("sp_lever2"), ", reflection ", _sp_refl_at())
		await _tap_wait(objs["sp_palm_A"].at)
		print("SPRING P.2 on the first palm: reflection ", _sp_refl_at(), " ", cq.call())
		await _tap_wait(objs["sp_palm_B"].at)      # the second palm is not there to take it yet
		print("SPRING P.2 to the second palm too soon (it steps back to the rim and goes as near as the rim lets it): reflection ", _sp_refl_at())
		await _tap_wait(objs["sp_palm_A"].at)
		print("SPRING P.2 on the first palm again: reflection ", _sp_refl_at())
		for i in 2: await _tap_wait(_sp2_p(0) + Vector3(0, 2.0, 0))      # the first is turned: the second turns against it, and the palms come together
		print("SPRING P.2 the pair turned twice: ", cq.call(), ", reflection ", _sp_refl_at(), " second palm ", _sp_palm("B").snapped(Vector3.ONE * 0.01))
		await _tap_wait(objs["sp_palm_B"].at)
		print("SPRING P.2 on the second palm: reflection ", _sp_refl_at())
		for i in 2: await _tap_wait(_sp2_p(1) + Vector3(0, 2.0, 0))      # the trap: she turns the one that carries it, and nothing waits at the other end
		print("SPRING P.2 the second turned twice: ", cq.call(), ", reflection ", _sp_refl_at())
		await _tap_wait(objs["sp_palm_C"].at)
		print("SPRING P.2 to the third palm, which was not set: reflection ", _sp_refl_at(), " third palm ", _sp_palm("C").snapped(Vector3.ONE * 0.01))
		await _tap_wait(_sp2_p(2) + Vector3(0, 2.0, 0))      # the free third is set to receive
		print("SPRING P.2 the third set: ", cq.call(), " third palm ", _sp_palm("C").snapped(Vector3.ONE * 0.01))
		await _tap_wait(objs["sp_palm_C"].at)
		print("SPRING P.2 on the third palm: reflection ", _sp_refl_at())
		await _tap_wait(_sp2_p(2) + Vector3(0, 2.0, 0))
		print("SPRING P.2 the third turned: ", cq.call(), ", reflection ", _sp_refl_at())
		await _tap_wait(objs["sp_lever2"].at)
		print("SPRING P.2 lever ", done.has("sp_lever2"), " door ", rects["SP3d"].on, ", reflection ", _sp_refl_at())
	if from <= 3 and not (only and from < 3):
		var st := func() -> String:
			var row := ["_", "_", "_", "_", "_"]
			for i in 4: row[sp3_at[i]] = ["sea", "wall", "beside", "empty"][i]
			return str(row) + " content " + str(_sp3_sat())
		await _tap_wait(Vector3(SP3_X0 + 1.6, 0, SP2_DOOR.z))
		print("SPRING P.3 in the court at ", pos.snapped(Vector3.ONE * 0.01), ": ", st.call())
		await _tap_wait(objs["sp3_st1"].at)      # the one that wants the wall, to the empty place by the wall
		print("SPRING P.3 pushed the one that wants the wall: ", st.call())
		await _tap_wait(objs["sp3_st2"].at)
		print("SPRING P.3 pushed the one that wants the one beside it: ", st.call())
		await _tap_wait(objs["sp3_st0"].at)      # the one that wants the sea, to the end by the opening
		print("SPRING P.3 pushed the one that wants the sea: ", st.call())
		await _tap_wait(objs["sp3_place"].at)      # the trap: she takes the empty place before all the rest are content
		print("SPRING P.3 on the empty place too soon: sluice ", rects["SP3g"].on, ", she at ", pos.snapped(Vector3.ONE * 0.01), " ", st.call())
		await _tap_wait(objs["sp3_st3"].at)      # the one that wants the empty place goes beside the one that wants it
		print("SPRING P.3 pushed the one that wants the empty place: ", st.call())
		await _tap_wait(objs["sp3_place"].at)
		print("SPRING P.3 on the empty place: bowed ", flags.get("sp3_done", false), " sluice ", rects["SP3g"].on, ", she at ", pos.snapped(Vector3.ONE * 0.01))
	if from <= 4:
		var st4 := func() -> String: return "posed %s, beam hangs %.3f, door at %.2f, pinned %s, arm points %d" % [flags.get("sp4_posed", false), (N["sp4_beam"] as Node3D).rotation.z, (N["sp4_door"] as Node3D).position.x, flags.get("sp4_pinned", false), sp_col["4"].q]
		await _tap_wait(Vector3(-17.6, 0, -80.9))
		print("SPRING P.4 in the court at ", pos.snapped(Vector3.ONE * 0.01), ": ", st4.call())
		var door: Vector3 = objs["sp_door4"].at
		await _tap_wait(door)      # the obvious: straight to the door of the water. It walks the rim to the gap and stops
		print("SPRING P.4 sent to the door from the rim: reflection ", _sp_refl_at(), ", ", st4.call())
		await _tap_wait(objs["sp4_place"].at)      # she takes the sixth place: the beam comes level
		print("SPRING P.4 on the sixth place at ", pos.snapped(Vector3.ONE * 0.01), ": ", st4.call())
		await _tap_wait(door)      # from there: still a gap between the rim and the landing
		print("SPRING P.4 sent to the door while she holds the beam, the palm not set: reflection ", _sp_refl_at(), ", ", st4.call())
		await _tap_wait(SP4_S + Vector3(0, 2.0, 0))      # the trap: to turn the colossus she must let go; the beam hangs again
		print("SPRING P.4 stepped down and turned the colossus: she at ", pos.snapped(Vector3.ONE * 0.01), ", palm ", _sp_palm("4").snapped(Vector3.ONE * 0.01), ", ", st4.call())
		await _tap_wait(door)      # (her reflection can cross now, but with the beam hanging the door will not move)
		print("SPRING P.4 at the door with the beam hanging: reflection ", _sp_refl_at(), ", ", st4.call())
		await _tap_wait(objs["sp4_place"].at)
		print("SPRING P.4 on the sixth place again: ", st4.call())
		await _tap_wait(door)
		print("SPRING P.4 the door: reflection ", _sp_refl_at(), ", ", st4.call())
		await _tap_wait(objs["sp_gate4"].at)      # she steps down (the pin holds the beam) and opens the head-gate
		print("SPRING P.4 the head-gate: she at ", pos.snapped(Vector3.ONE * 0.01), ", ", st4.call(), ", gate open ", done.has("sp_gate4"), ", wings ", wings_done)
		await _tap_wait(Vector3(-19.5, 0, UZ0 + 2.2))      # and back down the lane to the atrium
		var guard := 0
		while hub_n < 1 and guard < 4000: await get_tree().process_frame; guard += 1
		print("SPRING back in the atrium at ", pos.snapped(Vector3.ONE * 0.01), ": waters in the basin ", hub_n)
	print("SPRING done ", wings_done)
	get_tree().quit()

## (to try a later court) everything before it is done, and she stands at its entry
func _sp_open_to(k: int) -> void:
	if k >= 2:
		rects["SP1d"].on = true; (N["sp_s1"] as Node3D).position.y = -1.25
		for d in ["sp_lever1", "sp_palm_1", "sp_col_1"]: done[d] = true
		for sfx in ["", "_m"]: (N["sp_lever1" + sfx] as Node3D).rotation.z = 0.6
		pos = Vector3(-19.5, 0, SP1_Z0 - 1.0); yaw = PI
	if k >= 3:
		rects["SP3d"].on = true; (N["sp_s2"] as Node3D).position.y = -1.25
		for d in ["sp_lever2", "sp_palm_A", "sp_col_A", "sp_palm_B", "sp_col_B", "sp_palm_C", "sp_col_C"]: done[d] = true
		for sfx in ["", "_m"]: (N["sp_lever2" + sfx] as Node3D).rotation.z = 0.6
		pos = Vector3(-19.5, 0, SP2_DOOR.z); yaw = -PI * 0.5
	if k >= 4:
		sp3_at = [0, 4, 1, 2]; flags["sp3_done"] = true
		for i in 4:
			for sfx in ["", "_m"]:
				var nd: Node3D = N["sp3_st%d%s" % [i, sfx]]; var a := _sp3_ang(sp3_at[i])
				nd.position = _sp3_pt(a, SP3_RA); nd.rotation.y = atan2(-cos(a), -sin(a))
		_sp3_sync(); _sp3_heads_now()
		for d in ["sp3_st0", "sp3_st1", "sp3_st2", "sp3_st3", "sp3_place"]: done[d] = true
		rects["SP3g"].on = true; (N["sp_s3"] as Node3D).position.y = -1.25
		pos = Vector3(-19.5, 0, SP2_Z0 + 1.2); yaw = PI
	cam_t = pos
