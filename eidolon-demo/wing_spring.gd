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
# ---------------------------------------------------------------- the lane north, and P.4 beside it
const SPL_X0 := -20.3
const SPL_X1 := -18.4
const SPL_Z0 := -73.6

var sp_col := {}      # the colossi, by name: {"p": foot, "q": which quarter the arm points to (0 north, 1 east, 2 south, 3 west), "w": its water, "pair": the one geared to it, "view": where the eye rests while it turns}
var sp_chan: Array = []      # the course of the water once the spring runs: [from, to] pieces, in order

func _init() -> void:
	super._init(); wing_open["N"] = true

func _hollows() -> Array:
	return super._hollows() + [[SP1_X0 + 0.5, SP1_Z0 + 0.5, SP1_X1 - 0.5, SP1_Z1 - 0.5]]

func _wings() -> void:
	super._wings()
	_sp_court1()

func _wing_things() -> void:
	super._wing_things()
	_sp_things1()

func _wing_nav() -> void:
	super._wing_nav()
	_sp_nav1()

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
func _sp_cover(corner: Vector3, pts: Array, pl := "stone") -> void:
	var v := PackedVector3Array(); var n := PackedVector3Array()
	var top := Vector3(0, 0.04, 0); var low := Vector3(0, -0.3, 0)
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
func _sp_colossus(key: String, p: Vector3, q: int, wid: String, view: Vector3, pinion := true) -> void:
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
		prop_model("plinth_top", n, 0.0, 0.0, twin, false, PLINTH_PARTS).scale = Vector3(SP_PK, SP_PKV, SP_PK)
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
	sp_col[key] = {"p": p, "q": q, "w": wid, "pair": "", "view": view}

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
	create_tween().tween_property(cam, "size", maxf(s0, 9.4), 1.4).set_trans(Tween.TRANS_SINE)
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
	var train0 := []
	for t in (c.get("train", []) as Array): train0.append((N[t[0]] as Node3D).rotation.y)
	var step := func(s: float) -> void:
		for i in keys.size():
			var k: String = keys[i]
			var a: float = float(y0[k]) + (-1.0 if i == 0 else 1.0) * s * PI * 0.5
			for sfx in ["", "_m"]:
				(N["sp_col_" + k + sfx] as Node3D).rotation.y = a
				if N.has("sp_pin_" + k + sfx): (N["sp_pin_" + k + sfx] as Node3D).rotation.y = _pinion_yaw(a)
			if k == rider:
				hd.position = _sp_palm(k); hd.rotation.y = r0 + (-1.0 if i == 0 else 1.0) * s * PI * 0.5
		var tr: Array = c.get("train", [])
		for j in tr.size():      # the idle wheels between a geared pair: each turns against its neighbour
			for sfx in ["", "_m"]: (N[String(tr[j][0]) + sfx] as Node3D).rotation.y = float(train0[j]) + float(tr[j][1]) * s * PI * 0.5
		_sp_turn_hands(key, hy, s)
	var rt := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	rt.tween_method(step, 0.0, 1.0, 3.0)
	await rt.finished
	for i in keys.size():
		var k: String = keys[i]
		sp_col[k].q = posmod(int(sp_col[k].q) + (1 if i == 0 else -1), 4)
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
	if a == "": return {"pts": [], "left": 1e9, "h": 0.0}
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
	var chain := [b]
	while prev[chain[0]] != "": chain.push_front(prev[chain[0]])
	var pts := []; var cur := from
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
		pts.append(pt); cur = pt
	pts.append(dest)
	return {"pts": pts, "left": bd, "h": 0.0}

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
		"foot": {"n": rim_n, "w": rim_w, "isle": R(SP1_ISLE.x - 0.65, SP1_ISLE.z - 0.9, SP1_ISLE.x + 0.65, SP1_ISLE.z + 0.75)}}
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
	rects["SP1d"] = R(-19.75, SPL_Z0 - 0.3, -19.25, SP1_Z0 + 0.7, false)      # through the door at the north
	solids.append(Vector3(SP1_S.x, SP1_S.z, 1.0))

func _do_sp_col_1() -> void:
	await _sp_turn("1")

func _do_sp_palm_1() -> void:
	await _sp_on_palm("1")

## P.1: the lever on the islet. Her reflection, set down there by the palm, pulls it over: the sluice at the north
## goes down
func _do_sp_lever1() -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, PI * 0.5), 0.4).set_trans(Tween.TRANS_SINE)
	await rt.finished
	var hm := _hermod(e)
	var arm: Node3D = N["sp_lever1"]; var arm_m: Node3D = N["sp_lever1_m"]
	var grip := func() -> Vector3:
		var g := SP1_LEVER + Vector3(0, 0.22, 0) + Vector3(-sin(arm.rotation.z), cos(arm.rotation.z), 0) * 0.9
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
	var s0 := cam.size
	cam_focus = Vector3(-18.6, 0.4, SP1_Z0 + 1.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 9.6, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(2.2)
	await sluice_open("sp_s1", 2.6)
	rects["SP1d"].on = true
	for k in ["sp_lever1", "sp_palm_1", "sp_col_1"]: done[k] = true
	looks.erase("sp_look_lever1")
	await wait(0.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	await _refl_melt()

# ---------------------------------------------------------------- the run that tries the wing by taps
func _sp_refl_at() -> String:
	return str(((refl_out.holder as Node3D).position).snapped(Vector3.ONE * 0.01)) if not refl_out.is_empty() else "under her"

func _play_spring() -> void:
	var from := int(OS.get_environment("FROM")) if OS.get_environment("FROM") != "" else 1
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
	print("SPRING done ", wings_done)
	get_tree().quit()

## (to try a later court) everything before it is done, and she stands at its entry
func _sp_open_to(k: int) -> void:
	if k >= 2:
		rects["SP1d"].on = true; (N["sp_s1"] as Node3D).position.y = -1.25
		for d in ["sp_lever1", "sp_palm_1", "sp_col_1"]: done[d] = true
		for sfx in ["", "_m"]: (N["sp_lever1" + sfx] as Node3D).rotation.z = 0.6
		pos = Vector3(-19.5, 0, SP1_Z0 - 1.0); yaw = PI
	cam_t = pos
