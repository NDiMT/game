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

var N := {}      # the pieces that move, by name (kept here so that the joined world leaves them alone)
var WL: Array = []      # the still waters, in order: their names
var W := {}      # each water: {"r": [x0, z0, x1, z1], "heads": [rects of floor from which her reflection can be sent], "foot": {name: {x0, z0, x1, z1, on, h}}}
var refl_w := ""      # the water her reflection is out on
var woke := false
var flags := {}

func _init() -> void:
	old_world = false

func _hollows() -> Array:
	return [[HX0 + 0.5, HZ0 + 0.5, HX1 - 0.5, HZ1 - 0.5]]

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
	N[key] = leaf

func sluice_open(key: String, secs := 2.4) -> void:
	var gt := create_tween(); gt.tween_property(N[key], "position:y", -1.75, secs).set_trans(Tween.TRANS_SINE)
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
	_harbour()
	_strip_refl(mroot)
	pos = HERPL + Vector3(0, 0.17, 0); yaw = 0.0

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
				var sb := blk(Vector3(-MOLE_W + 0.02 * (k % 2), 0, -(s1 - s0) * 0.5 + 0.035), Vector3(MOLE_W - 0.02 * ((k + 1) % 2), 0.05, (s1 - s0) * 0.5 - 0.035), "stone", both)
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

# ---------------------------------------------------------------- what can be tapped, and where she can walk
func _things() -> void:
	var hub: Vector3 = N["hub1"]; var hn: Vector3 = N["hubn1"]
	objs["wheel1"] = {"at": Vector3(hub.x, -hub.y, hub.z), "stand": Vector3(0, 0, MOLE_A - 0.45), "mark": false, "water": "H", "rstand": hub + hn * 0.56,
		"hits": [Vector3(hub.x, -hub.y - 0.4, hub.z), Vector3(hub.x, -0.1, hub.z), Vector3(hub.x, 0.2, hub.z), Vector3(hub.x, hub.y + 0.3, hub.z)]}

func _nav() -> void:
	rects["Hq"] = R(HX0 + 0.45, HZ0 + 0.75, HX1 - 0.45, BZ0 - 0.3)      # the quay
	rects["Hw"] = R(HX0 + 0.45, HZ0 + 0.75, BX0 - 0.3, HZ1 - 0.45); rects["He"] = R(BX1 + 0.3, HZ0 + 0.75, HX1 - 0.45, HZ1 - 0.45); rects["Hs"] = R(HX0 + 0.45, BZ1 + 0.3, HX1 - 0.45, HZ1 - 0.45)
	rects["Hm"] = R(-MOLE_W + 0.2, BZ0 - 0.35, MOLE_W - 0.2, MOLE_A - 0.3)      # the stub of the mole
	rects["S1"] = R(-0.3, HZ0 - 0.6, 0.3, HZ0 + 0.8, false)      # through the first sluice
	solids.append(Vector3(HERPL.x, HERPL.z, 0.42))
	for k in rects: rects[k]["name"] = k
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
	var g := o + d * ((0.012 - o.y) / d.y)
	for i in WL.size():
		var r: Array = W[WL[i]].r
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
		if not f.on: continue
		var d := _flat(_near_in(f, p), p)
		if d < bd: bd = d; best = n
	return best

## the way of her reflection over a water from one place toward another: only over what the water has for it to
## stand on. If the place cannot be reached it goes as near to it as it can. {"pts": the way, "left": how far short
## of the place it ends, "h": how high over the water it then stands}
func _refl_path(wid: String, from: Vector3, to: Vector3) -> Dictionary:
	var F: Dictionary = W[wid].foot
	var a := _foot_of(wid, from, 0.9)
	if a == "": return {"pts": [], "left": 1e9, "h": 0.0}
	var prev := {a: ""}; var q := [a]
	while not q.is_empty():
		var c: String = q.pop_front()
		for n in F:
			if F[n].on and not prev.has(n) and portal(F[c], F[n]) != null: prev[n] = c; q.append(n)
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

## her reflection is taken from under her feet, to be moved on its own
func _refl_out_now(wid: String) -> Dictionary:
	if refl_out.is_empty():
		var e0: Dictionary = H["mir"]; H.erase("mir"); refl_out = e0
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
		hd.position = Vector3(pos.x, 0, pos.z); hd.rotation.y = yaw
		var b := create_tween(); b.tween_property(hd, "scale:y", 1.0, 0.32).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		await b.finished
	else:
		var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, yaw), 0.3).set_trans(Tween.TRANS_SINE)
		await rt.finished
	hd.position.y = 0.0; hd.scale = Vector3.ONE
	(e.ap as AnimationPlayer).play("walk" if walk_on else "idle", 0.3)
	H["mir"] = e; refl_out = {}; refl_w = ""

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
	if not H.has("mir") and refl_out.is_empty(): return false
	if not refl_out.is_empty() and refl_w != wid: await _refl_melt(); refl_token += 1; my = refl_token
	if refl_out.is_empty():
		var hp := _head_point(wid)
		if _flat(pos, hp) > 0.3:
			if not walk_to(hp, PLAY_WALK): return false
			pending = ""
			while not route.is_empty() and refl_token == my: await get_tree().process_frame
			if refl_token != my or _flat(pos, hp) > 0.4: return false
		face_to = Vector3(to.x, 0, to.z)
	else:      # it is out: could it get nearer from under her feet than from where it stands?
		var here := _refl_path(wid, (refl_out.holder as Node3D).position, to)
		var hp2 := _head_point(wid)
		if _flat(pos, hp2) < 0.4:
			var home := _refl_path(wid, pos, to)
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

func _send_reflection(pi: int, to: Vector3, _sp: Vector2) -> void:
	if busy: return
	refl_ring.position = Vector3(to.x, 0.03, to.z); refl_p = 0.0
	hold_id = -1; route.clear(); pending = ""
	_refl_to(WL[pi], to)

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
		if await _refl_to(o.water, o.rstand):
			busy = true
			await call("_do_" + k)
			busy = false; settled.emit()
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
	super.tap(sp)

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

## the wheel on the far piece of the mole: her reflection, come along the mole the water keeps, turns it, and the
## first sluice goes down
func _do_wheel1() -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var hub: Vector3 = N["hub1"]; var hn: Vector3 = N["hubn1"]
	var s0 := cam.size
	var want := atan2(-hn.x, -hn.z)
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, want), 0.3)
	await rt.finished
	var hm := _hermod(e)
	var wa: Node3D = N["wheel1"]; var wm: Node3D = N["wheel1_m"]
	var crank := func(_v: float) -> void: _crank_hands(hm, hub, hn, wm.rotation.x, true)
	crank.call(0.0); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wL", 1.0, 0.5); hu.tween_property(hm, "wR", 1.0, 0.5); hu.tween_property(hm, "bow", 0.1, 0.5)
	await hu.finished
	var wt := create_tween().set_parallel(); wt.tween_property(wa, "rotation:x", PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE); wt.tween_property(wm, "rotation:x", PI * 3.5, 5.2).set_trans(Tween.TRANS_SINE)
	wt.tween_method(crank, 0.0, 1.0, 5.2)
	await wait(1.2)
	cam_focus = Vector3(0, 0.4, 2.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 10.5, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(0.9)
	await sluice_open("s1", 2.6)
	rects["S1"].on = true; done["wheel1"] = true
	await wt.finished
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wL", 0.0, 0.5); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	await hd2.finished
	hm.own = false
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	refl_token += 1; var my := refl_token
	var back := _refl_path("H", hd.position, pos)
	if await _refl_walk_pts(e, back.pts, back.h, my, 1.1): await _refl_melt()

# ---------------------------------------------------------------- frame, and the runs that try the chapter
func _process(dt: float) -> void:
	super._process(dt)
	if not refl_out.is_empty() and not busy and refl_w != "" and _rect_dist(pos, W[refl_w].r) > 3.2: _refl_melt()      # she has left that water

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

## the first act played by taps, as a player would: prints what happens
func _play_act1() -> void:
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)      # the title
	tap(Vector2(360, 640))      # she wakes
	await settled
	print("ACT1 woke at ", pos)
	_tap_at(Vector3(1.6, 0, 6.0))      # open water: it goes as near as it can along the mole
	await wait(6.0)
	print("ACT1 reflection on open water: ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
	var hub: Vector3 = N["hub1"]
	_tap_at(Vector3(hub.x, -hub.y, hub.z))      # the wheel in the water
	await settled
	print("ACT1 wheel done ", done.has("wheel1"), " sluice open ", rects["S1"].on, " reflection ", "out" if not refl_out.is_empty() else "under her")
	_tap_at(Vector3(0, 0, HZ0 - 0.3))
	await arrived
	print("ACT1 through the sluice at ", pos)
	get_tree().quit()
