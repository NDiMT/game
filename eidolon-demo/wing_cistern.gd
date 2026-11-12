extends "res://ch1.gd"
## EIDOLON, chapter 1: the wing of the Cistern, west of the atrium. The water he emptied. Height and level:
## as high as she stands, so deep stands her reflection; and one step of water lifts its world by two.

# ---------------------------------------------------------------- Σ.1 climb, so that it goes down
const CS1X0 := -46.0
const CS1Z0 := -38.6
const CS1X1 := -36.0
const CS1Z1 := -28.4
const CS1PX0 := -44.2      # its water
const CS1PZ0 := -37.0
const CS1PX1 := -37.5
const CS1PZ1 := -30.4
const CS_TOP := 2.7       # how high the scaffold's top landing stands
const CS_RX0 := -45.55    # the stair of the scaffold, along the west wall: from the south rim up to the north
const CS_RX1 := -44.7
const CS_RZ0 := -36.0     # its top
const CS_RZ1 := -30.6     # its foot
const CS_LEV1 := Vector3(-44.55, 0, -36.9)      # the lever that stands, in the water only, on the edge of the top landing

# ---------------------------------------------------------------- Σ.2 the higher water
const CS2X0 := -48.2
const CS2Z0 := -50.4
const CS2X1 := -35.4
const CS2Z1 := -40.0
const CS2PX0 := -46.4     # the opening that holds its two tanks
const CS2PZ0 := -48.2
const CS2PX1 := -38.0
const CS2PZ1 := -42.4
const CS2WX0 := -42.35    # the low wall between them
const CS2WX1 := -42.05
const CS2CZ := -45.3      # the causeway that the water keeps runs along this z, through the gap in that wall
const CS_LOW := -0.6
const CS_MID := -0.3
const CS_GATE2 := Vector3(-44.4, 0, -49.25)      # the wheel that lets the west tank's water out or in
var cs_mirs: Array = []      # the mirrored bodies of her that belong to waters below the floor's height, to be made once she exists: [key, root]
var cs_courts: Array = []    # the courts with such waters: in them her ordinary mirrored body is put away

func _init() -> void:
	super._init(); wing_open["W"] = true

func _hollows() -> Array:
	return super._hollows() + [[CS1X0 + 0.5, CS1Z0 + 0.5, CS1X1 - 0.5, CS1Z1 - 0.5], [CS2X0 + 0.5, CS2Z0 + 0.5, CS2X1 - 0.5, CS2Z1 - 0.5]]

func _wings() -> void:
	super._wings()
	_cs1(); _cs2()

## a deeper pit for a pool whose water must show things that stand high over it
func _cs_deep_pit(sky: String, depth: float) -> void:
	var pit := get_node_or_null(sky) as MeshInstance3D
	if pit == null: return
	var pm := pit.mesh as BoxMesh
	pm.size = Vector3(pm.size.x, depth, pm.size.z); pit.position.y = -0.185 - depth * 0.5

## Σ.1: a pool beside the scaffold where he worked. A wooden stair climbs along the west wall to a landing high
## over the water. The lever of the next sluice stands on that landing, but only in the water
func _cs1() -> void:
	floor_plain(CS1X1, UC.z - 0.8, UX0, UC.z + 0.8, 0.0); channel(Vector3(CS1X1, 0, UC.z), Vector3(UX0, 0, UC.z))
	_pool_court(CS1X0, CS1Z0, CS1X1, CS1Z1, CS1PX0, CS1PZ0, CS1PX1, CS1PZ1, "stone", "PoolSkyC1")
	_cs_deep_pit("PoolSkyC1", 4.6)
	tile_hole = Rect2(CS1PX0 - 0.08, CS1PZ0 - 0.08, CS1PX1 - CS1PX0 + 0.16, CS1PZ1 - CS1PZ0 + 0.16); tiles(CS1X0, CS1Z0, CS1X1, CS1Z1, 1.0); tile_hole = Rect2()
	glass(CS1PX0, CS1PZ0, CS1PX1, CS1PZ1)
	var rim_s := R(CS_RX0, CS1PZ1 + 0.3, CS1X1 - 0.45, CS1Z1 - 0.45); var rim_e := R(CS1PX1 + 0.3, CS1Z0 + 0.75, CS1X1 - 0.45, CS1Z1 - 0.45)
	var top := R(CS_RX0, CS1Z0 + 0.8, CS_RX1, CS_RZ0, true, CS_TOP)
	W["C1"] = {"r": [CS1PX0, CS1PZ0, CS1PX1, CS1PZ1], "heads": [rim_s, rim_e, top], "foot": {"rs": rim_s, "re": rim_e, "top": top}}
	WL.append("C1")
	wall(CS1X0, CS1Z0, CS1X0 + 0.3, CS1Z1, 4.2, true)      # the west wall, tall, with the scaffold against it
	wall(CS1X0 + 0.3, CS1Z0, -37.42, CS1Z0 + 0.3, 2.6, true); wall(-36.28, CS1Z0, CS1X1, CS1Z0 + 0.3, 2.6)      # the north wall, with the sluice at its east end
	parapet(Vector3(CS1X1 - 0.1, 0, CS1Z0 + 0.4), Vector3(CS1X1 - 0.1, 0, UC.z - 0.8)); parapet(Vector3(CS1X1 - 0.1, 0, UC.z + 0.8), Vector3(CS1X1 - 0.1, 0, CS1Z1 - 0.1))
	parapet(Vector3(CS1X0 + 0.4, 0, CS1Z1 - 0.1), Vector3(CS1X1 - 0.1, 0, CS1Z1 - 0.1))
	channel(Vector3(CS1X1 - 0.72, 0, UC.z), Vector3(CS1X1, 0, UC.z)); channel(Vector3(-36.85, 0, UC.z - 0.5), Vector3(-36.85, 0, CS1Z0 + 0.3))
	# the scaffold: a stair of planks on two stringers, posts, a landing with a rail. Its stair is of this world
	# only; the water keeps the landing and the posts
	var steps := 18; var run := (CS_RZ1 - CS_RZ0) / steps; var rise := CS_TOP / steps
	for i in steps:
		var z1 := CS_RZ1 - run * i
		blk(Vector3(CS_RX0 + 0.04, rise * (i + 1) - 0.04, z1 - run), Vector3(CS_RX1 - 0.04, rise * (i + 1), z1 + 0.02), "wood")
	for sx in [CS_RX0 + 0.02, CS_RX1 - 0.08]:      # the stringers, one plank each, laid along the slope
		var sl := blk(Vector3(-0.03, -0.11, -0.5), Vector3(0.03, 0.11, 0.5), "wood")
		var len := Vector2(CS_RZ1 - CS_RZ0, CS_TOP).length()
		sl.scale = Vector3(1, 1, len); sl.position = Vector3(sx + 0.03, CS_TOP * 0.5 - 0.12, (CS_RZ0 + CS_RZ1) * 0.5); sl.rotation.x = atan2(CS_TOP, CS_RZ1 - CS_RZ0)
	for both in [self, mroot]:
		var flat := "flat2" if both == mroot else "flat"
		blk(Vector3(CS_RX0, CS_TOP - 0.07, CS1Z0 + 0.72), Vector3(CS_RX1 + 0.04, CS_TOP, CS_RZ0 + 0.03), "wood", both).material_override = pal("wood", flat)      # the landing
		for pz in [CS1Z0 + 0.85, CS_RZ0 - 0.1, (CS_RZ0 + CS_RZ1) * 0.5]:      # the posts on the water's side, with their braces
			var hgt: float = CS_TOP if pz < CS_RZ0 else CS_TOP * 0.5
			blk(Vector3(CS_RX1 - 0.03, 0, pz - 0.05), Vector3(CS_RX1 + 0.07, hgt - 0.07, pz + 0.05), "wood", both).material_override = pal("wood", flat)
			blk(Vector3(CS_RX1 - 0.07, 0, pz - 0.09), Vector3(CS_RX1 + 0.11, 0.08, pz + 0.09), "shade", both)
		for pz in [CS1Z0 + 0.85, CS_RZ0 - 0.1]:      # the rail of the landing
			blk(Vector3(CS_RX1 - 0.02, CS_TOP, pz - 0.035), Vector3(CS_RX1 + 0.05, CS_TOP + 0.95, pz + 0.035), "wood", both).material_override = pal("wood", flat)
		blk(Vector3(CS_RX1 - 0.02, CS_TOP + 0.88, CS1Z0 + 0.85), Vector3(CS_RX1 + 0.05, CS_TOP + 0.95, CS_RZ0 - 0.1), "wood", both).material_override = pal("wood", flat)
	# in the water only: a bronze lever on the landing's edge
	var lv := Node3D.new(); lv.position = CS_LEV1 + Vector3(0, CS_TOP, 0); mroot.add_child(lv)
	blk(Vector3(-0.07, 0, -0.07), Vector3(0.07, 0.3, 0.07), "gold", lv).material_override = under_mat(Color("c98f2c"))
	var arm := Node3D.new(); arm.position = Vector3(0, 0.26, 0); arm.rotation.x = -0.6; lv.add_child(arm)
	blk(Vector3(-0.025, 0, -0.025), Vector3(0.025, 0.85, 0.025), "gold", arm).material_override = under_mat(Color("e0a53a"))
	ball(Vector3(0, 0.88, 0), 0.06, under_mat(Color("b8232f")), arm)
	N["cs_lever1"] = arm
	sluice("cs_s1", Vector3(-36.85, 0, CS1Z0 + 0.15), false, 0.4)
	stele("cs_stele1", Vector3(CS1X1 - 0.75, 0, CS1Z1 - 0.9), 0.0, ["What I sink stays sunk.\nI believed that.", "As high as you stand,\nso deep she stands."])
	_look_add("cs_scaf", Vector3(CS_RX1 + 0.1, 0, CS_RZ1 + 0.2), 1.4, ["his scaffold. the stair is on this side", "the water shows its landing, and no stair"])
	urn(Vector3(CS1X1 - 0.8, 0, CS1Z0 + 0.9), 1.0); cypress(Vector3(CS1PX1 + 0.75, 0, CS1Z0 + 0.85), 2.6)

func _wing_things() -> void:
	super._wing_things()
	var lp := CS_LEV1 + Vector3(0, -(CS_TOP + 0.7), 0)
	for mk in cs_mirs:      # her mirrored bodies for the waters that lie below the floor
		var e: Dictionary = spawn_her(mk[1], "mirror"); H[mk[0]] = e
		if e.sk != null:
			var hm := HerMod.new(); hm.main = self; (e.sk as Skeleton3D).add_child(hm)
		if e.ap != null: (e.ap as AnimationPlayer).play("idle")
	var g2: Vector3 = N["cs_hub2"]
	objs["cs_gate2"] = {"at": g2, "stand": g2 + (N["cs_hubn2"] as Vector3) * 0.56 - Vector3(0, g2.y, 0), "mark": false, "hits": [Vector3(g2.x, 0.15, CS_GATE2.z), g2, g2 + Vector3(0, 0.3, 0)]}
	var l2 := Vector3(CS2PX0 + 0.45, 0, CS2CZ)
	objs["cs_lever2"] = {"at": l2 + Vector3(0, -1.3, 0), "stand": Vector3(CS2PX1 + 0.6, 0, CS2CZ), "mark": false, "water": "C2", "rstand": l2 + Vector3(0.5, 0, 0),
		"hits": [l2 + Vector3(0, -0.7, 0), l2 + Vector3(0, -1.9, 0)]}
	objs["cs_lever1"] = {"at": lp, "stand": Vector3((CS_RX0 + CS_RX1) * 0.5, 0, CS_RZ0 - 0.9), "mark": false, "water": "C1", "rstand": Vector3(CS_LEV1.x - 0.5, 0, CS_LEV1.z),
		"hits": [CS_LEV1 + Vector3(0, -CS_TOP - 0.1, 0), CS_LEV1 + Vector3(0, -CS_TOP - 1.2, 0)]}

func _wing_nav() -> void:
	super._wing_nav()
	rects["C1c"] = R(CS1X1 - 0.45, UC.z - 0.25, UX0 - 0.7, UC.z + 0.25)
	rects["C1e"] = R(CS1PX1 + 0.3, CS1Z0 + 0.75, CS1X1 - 0.45, CS1Z1 - 0.45); rects["C1s"] = R(CS_RX0, CS1PZ1 + 0.3, CS1X1 - 0.45, CS1Z1 - 0.45)
	rects["C1r"] = R(CS_RX0, CS_RZ0, CS_RX1, CS1PZ1 + 0.32); rects["C1t"] = R(CS_RX0, CS1Z0 + 0.8, CS_RX1, CS_RZ0)
	ramps.append({"r": rects["C1r"], "z0": CS_RZ0, "z1": CS_RZ1, "y0": CS_TOP, "y1": 0.0}); ramps.append({"r": rects["C1t"], "z0": 0.0, "z1": 1.0, "y0": CS_TOP, "y1": CS_TOP})
	rects["C1x"] = R(-37.1, CS2Z1 - 0.47, -36.6, CS1Z0 + 0.77, false)
	rects["C2e"] = R(CS2PX1 + 0.3, CS2Z0 + 0.75, CS2X1 - 0.45, CS2Z1 - 0.45); rects["C2s"] = R(CS2X0 + 0.75, CS2PZ1 + 0.3, CS2X1 - 0.45, CS2Z1 - 0.45)
	rects["C2n"] = R(CS2X0 + 0.75, CS2Z0 + 0.75, CS2X1 - 0.45, CS2PZ0 - 0.3); rects["C2w"] = R(CS2X0 + 0.75, CS2Z0 + 0.75, CS2PX0 - 0.3, CS2Z1 - 0.45)
	solids.append(Vector3(CS_GATE2.x, CS_GATE2.z, 0.5))
	rects["C2x"] = R(CS2X0 - 0.6, CS2CZ - 0.25, CS2X0 + 0.77, CS2CZ + 0.25, false)

## Σ.1: the lever in the water. Her reflection, as deep as she stands high, takes hold of it and draws it down
func _do_cs_lever1() -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, PI * 0.5), 0.35).set_trans(Tween.TRANS_SINE)
	await rt.finished
	var hm := _hermod(e); var arm: Node3D = N["cs_lever1"]
	var grip := func() -> Vector3:
		var g: Vector3 = arm.global_transform * Vector3(0, 0.8, 0)
		return g
	hm.tR = grip.call(); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wR", 1.0, 0.5); hu.tween_property(hm, "bow", 0.08, 0.5)
	await hu.finished
	var s0 := cam.size
	var pull := create_tween(); pull.tween_method(func(v: float) -> void:
		arm.rotation.x = v; hm.tR = grip.call(), -0.6, 0.6, 1.4).set_trans(Tween.TRANS_SINE)
	await pull.finished
	cam_focus = Vector3(-38.6, 0.4, CS1Z0 + 2.2); cam_focus_on = true
	create_tween().tween_property(cam, "size", 10.5, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.3)
	await sluice_open("cs_s1", 2.6)
	rects["C1x"].on = true; done["cs_lever1"] = true
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	await hd2.finished
	hm.own = false
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	await _refl_melt()

# ---------------------------------------------------------------- waters that lie below the floor
## a still water at a level of its own: its mirror world hangs under a root that turns everything over about that
## level, so that when the water sinks by one step what it shows sinks by two. Returns that root
func _cs_water(key: String, x0: float, z0: float, x1: float, z1: float, level: float) -> Node3D:
	var mr := Node3D.new(); mr.name = "Mirror_" + key; mr.transform = Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * level, 0)); add_child(mr)
	var wq := QuadMesh.new(); wq.size = Vector2(x1 - x0, z1 - z0); wq.orientation = PlaneMesh.FACE_Y
	var g := ShaderMaterial.new(); g.shader = shaders["glass"]; timed.append(g)
	g.set_shader_parameter("lost_a", 0.0); g.set_shader_parameter("blur_px", 0.6); g.set_shader_parameter("lod", 0.0)
	var gl := prim(wq, Vector3((x0 + x1) * 0.5, level + 0.012, (z0 + z1) * 0.5), g); gl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	N[key + "_mr"] = mr; N[key + "_glass"] = gl; N[key + "_level"] = level
	cs_mirs.append(["mir_" + key, mr])
	return mr

## the water of such a tank goes to a level, slowly: its surface, and under it its whole mirror world twice as far
func _cs_level(key: String, to: float, secs := 2.6) -> void:
	var from: float = N[key + "_level"]
	var lt := create_tween(); lt.tween_method(func(v: float) -> void:
		N[key + "_level"] = v
		(N[key + "_mr"] as Node3D).position.y = 2.0 * v; (N[key + "_glass"] as Node3D).position.y = v + 0.012, from, to, secs).set_trans(Tween.TRANS_SINE)
	await lt.finished

## Σ.2: two tanks side by side, a low wall with a gap between them. The east one stands low; the west one a step
## higher, and holds the lever of the next sluice. In each water a causeway runs toward the gap, but the two do
## not meet: the west one lies two steps higher. A wheel on the north rim lets the west tank's water out
func _cs2() -> void:
	floor_plain(-37.6, CS2Z1, -36.1, CS1Z0, 0.0); channel(Vector3(-36.85, 0, CS2Z1), Vector3(-36.85, 0, CS1Z0))
	_pool_court(CS2X0, CS2Z0, CS2X1, CS2Z1, CS2PX0, CS2PZ0, CS2PX1, CS2PZ1, "stone", "PoolSkyC2")
	_cs_deep_pit("PoolSkyC2", 4.6)
	tile_hole = Rect2(CS2PX0 - 0.08, CS2PZ0 - 0.08, CS2PX1 - CS2PX0 + 0.16, CS2PZ1 - CS2PZ0 + 0.16); tiles(CS2X0, CS2Z0, CS2X1, CS2Z1, 1.0); tile_hole = Rect2()
	cs_courts.append([CS2X0, CS2Z0, CS2X1, CS2Z1])
	var mrS := _cs_water("cs2S", CS2WX1, CS2PZ0, CS2PX1, CS2PZ1, CS_LOW)
	var mrT := _cs_water("cs2T", CS2PX0, CS2PZ0, CS2WX0, CS2PZ1, CS_MID)
	# the walls of the tanks under the floor, and the low wall between them with its gap
	for both in [self, mrS, mrT]:
		var twin: bool = both != self
		for wl in [[CS2PX0 - 0.08, CS2PZ0 - 0.08, CS2PX1 + 0.08, CS2PZ0], [CS2PX0 - 0.08, CS2PZ0, CS2PX0, CS2PZ1]]:      # the north and west sides, which the eye sees
			var b := blk(Vector3(wl[0], -0.95, wl[1]), Vector3(wl[2], -0.17, wl[3]), "shade", both)
			if twin: b.material_override = under_mat(Color("b3a595"))
		for seg in [[CS2PZ0, CS2CZ - 0.55], [CS2CZ + 0.55, CS2PZ1]]:
			var d := blk(Vector3(CS2WX0, -0.95, seg[0]), Vector3(CS2WX1, 0.45, seg[1]), "stone", both)
			if twin: d.material_override = under_mat(Color("cfc0aa"))
			var cp := blk(Vector3(CS2WX0 - 0.03, 0.45, seg[0]), Vector3(CS2WX1 + 0.03, 0.5, seg[1]), "shade", both)
			if twin: cp.material_override = under_mat(Color("b3a595"))
	# in each water only: the causeway toward the gap, stone by stone, level with the floor
	for part in [[mrS, CS2WX1, CS2PX1], [mrT, CS2PX0, CS2WX0]]:
		var n := 7; var a: float = part[1]; var b2: float = part[2]
		for k in n:
			var s0 := a + (b2 - a) * k / n; var s1 := a + (b2 - a) * (k + 1) / n
			var sb := blk(Vector3(-(s1 - s0) * 0.5 + 0.05, -0.06, -0.28 + 0.02 * (k % 2)), Vector3((s1 - s0) * 0.5 - 0.05, 0.0, 0.28 - 0.02 * ((k + 1) % 2)), "stone", part[0])
			sb.material_override = under_mat(Color("857fa4")); sb.position += Vector3((s0 + s1) * 0.5, 0, CS2CZ); sb.rotation.y = 0.03 * sin(k * 2.3 + 0.7)
	# in the west water only: the lever, at the far end of its causeway
	var lv := Node3D.new(); lv.position = Vector3(CS2PX0 + 0.45, 0, CS2CZ); mrT.add_child(lv)
	blk(Vector3(-0.07, 0, -0.07), Vector3(0.07, 0.3, 0.07), "gold", lv).material_override = under_mat(Color("c98f2c"))
	var arm := Node3D.new(); arm.position = Vector3(0, 0.26, 0); arm.rotation.z = -0.6; lv.add_child(arm)
	blk(Vector3(-0.025, 0, -0.025), Vector3(0.025, 0.85, 0.025), "gold", arm).material_override = under_mat(Color("e0a53a"))
	ball(Vector3(0, 0.88, 0), 0.06, under_mat(Color("b8232f")), arm)
	N["cs_lever2"] = arm
	var rim := R(CS2X0 + 0.75, CS2Z0 + 0.75, CS2X1 - 0.45, CS2Z1 - 0.45)
	W["C2"] = {"r": [CS2PX0, CS2PZ0, CS2PX1, CS2PZ1], "level": (CS_LOW + CS_MID) * 0.5, "mir": "mir_cs2S",
		"heads": [R(CS2PX1 + 0.3, CS2Z0 + 0.75, CS2X1 - 0.45, CS2Z1 - 0.45)],
		"foot": {"re": R(CS2PX1 - 0.02, CS2Z0 + 0.75, CS2X1 - 0.45, CS2Z1 - 0.45), "cs": R(CS2WX1 - 0.02, CS2CZ - 0.25, CS2PX1, CS2CZ + 0.25), "gap": R(CS2WX0 - 0.02, CS2CZ - 0.25, CS2WX1, CS2CZ + 0.25, false), "ct": R(CS2PX0 + 0.3, CS2CZ - 0.25, CS2WX0, CS2CZ + 0.25)}}
	WL.append("C2")
	# the wheel of the west tank, on the north rim: a capstan, and behind it the bronze plate of its outlet in the wall
	var wd := winch(CS_GATE2, PI, self, false)
	N["cs_wheel2"] = wd.wheel; N["cs_hub2"] = wd.hub; N["cs_hubn2"] = wd.n
	wall(CS2X0, CS2Z0, CS2X1, CS2Z0 + 0.3, 2.4)
	wall(CS2X0, CS2Z0 + 0.3, CS2X0 + 0.3, CS2CZ - 0.84, 2.4); wall(CS2X0, CS2CZ + 0.84, CS2X0 + 0.3, CS2Z1, 2.4)
	sluice("cs_s2", Vector3(CS2X0 + 0.15, 0, CS2CZ), true, 0.5)
	parapet(Vector3(CS2X1 - 0.1, 0, CS2Z0 + 0.4), Vector3(CS2X1 - 0.1, 0, CS2Z1 - 0.1)); parapet(Vector3(CS2X0 + 0.4, 0, CS2Z1 - 0.1), Vector3(-37.6, 0, CS2Z1 - 0.1)); parapet(Vector3(-36.1, 0, CS2Z1 - 0.1), Vector3(CS2X1 - 0.1, 0, CS2Z1 - 0.1))
	channel(Vector3(-36.85, 0, CS2Z0 + 1.2), Vector3(-36.85, 0, CS2Z1)); channel(Vector3(CS2X0 + 1.2, 0, CS2Z0 + 1.2), Vector3(-36.35, 0, CS2Z0 + 1.2)); channel(Vector3(CS2X0 + 1.2, 0, CS2Z0 + 0.7), Vector3(CS2X0 + 1.2, 0, CS2CZ)); channel(Vector3(CS2X0 + 0.3, 0, CS2CZ), Vector3(CS2X0 + 1.7, 0, CS2CZ))
	stele("cs_stele2", Vector3(CS2X1 - 0.75, 0, CS2Z1 - 0.85), 0.0, ["Two basins,\nso that neither is ever full.", "One step of water\nis two steps of what it shows."])
	_look_add("cs_gap", Vector3(CS2WX1 + 0.1, -0.3, CS2CZ - 0.9), 0.9, ["a low wall between the two tanks, with a gap", "in each water a causeway leads to the gap. they do not meet"])
	urn(Vector3(CS2X1 - 0.8, 0, CS2Z0 + 0.9), 1.0, "rose")

## Σ.2: the wheel of the west tank. She turns it: the water there goes down a step (or comes back up), and what it
## shows goes twice as far
func _do_cs_gate2() -> void:
	var hub: Vector3 = N["cs_hub2"]; var hn: Vector3 = N["cs_hubn2"]; var wa: Node3D = N["cs_wheel2"]
	await face(hub)
	var down: bool = float(N["cs2T_level"]) > CS_LOW + 0.05
	var hands := func(_v: float) -> void:
		var pts := _crank_pts(hub, hn, wa.rotation.x, 0.35)
		tgtL = pts[0]; tgtR = pts[1]
	hands.call(0.0)
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.6); up.tween_property(self, "a_wR", 1.0, 0.6); up.tween_property(self, "a_lean", 0.08, 0.6)
	await up.finished
	var s0 := cam.size
	cam_focus = Vector3((CS2PX0 + CS2PX1) * 0.5 + 0.6, 0.0, CS2CZ + 0.4); cam_focus_on = true
	create_tween().tween_property(cam, "size", 10.5, 1.4).set_trans(Tween.TRANS_SINE)
	W["C2"].foot["gap"].on = false
	var wt := create_tween().set_parallel(); wt.tween_property(wa, "rotation:x", wa.rotation.x + (PI * 2.5 if down else -PI * 2.5), 4.2).set_trans(Tween.TRANS_SINE); wt.tween_method(hands, 0.0, 1.0, 4.2)
	await wait(0.8)
	await _cs_level("cs2T", CS_LOW if down else CS_MID, 3.2)
	W["C2"].foot["gap"].on = down      # level with the east tank: the two causeways meet
	if wt.is_running(): await wt.finished
	var off := tw(); off.tween_property(self, "a_wL", 0.0, 0.6); off.tween_property(self, "a_wR", 0.0, 0.6); off.tween_property(self, "a_lean", 0.0, 0.6)
	await off.finished
	await wait(0.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## Σ.2: the lever at the end of the west causeway. Her reflection, come through the gap, draws it down
func _do_cs_lever2() -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, -PI * 0.5), 0.35).set_trans(Tween.TRANS_SINE)
	await rt.finished
	var hm := _hermod(e); var arm: Node3D = N["cs_lever2"]
	var grip := func() -> Vector3:
		var g: Vector3 = arm.global_transform * Vector3(0, 0.8, 0)
		return g
	hm.tR = grip.call(); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wR", 1.0, 0.5); hu.tween_property(hm, "bow", 0.08, 0.5)
	await hu.finished
	var s0 := cam.size
	var pull := create_tween(); pull.tween_method(func(v: float) -> void:
		arm.rotation.z = v; hm.tR = grip.call(), -0.6, 0.6, 1.4).set_trans(Tween.TRANS_SINE)
	await pull.finished
	cam_focus = Vector3(CS2X0 + 2.4, 0.4, CS2CZ + 0.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 10.5, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.3)
	await sluice_open("cs_s2", 2.6)
	rects["C2x"].on = true; done["cs_lever2"] = true; done["cs_gate2"] = true
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	await hd2.finished
	hm.own = false
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	refl_token += 1; var my := refl_token
	var back := _refl_path("C2", hd.position, pos)
	if await _refl_walk_pts(e, back.pts, back.h, my, 1.1): await _refl_melt()

## it is drawn back to her: if it stands in the west tank's world, it is first put back into the east one's
func _refl_melt() -> void:
	if not refl_out.is_empty() and refl_w == "C2":
		var hd: Node3D = refl_out.holder
		if hd.get_parent() != N["cs2S_mr"]:
			var a := create_tween(); a.tween_property(hd, "scale:y", 0.02, 0.3).set_trans(Tween.TRANS_SINE)
			await a.finished
			hd.reparent(N["cs2S_mr"], false)
	await super._refl_melt()

func _process(dt: float) -> void:
	super._process(dt)
	var inside := false
	for c in cs_courts:
		if pos.x > c[0] and pos.x < c[2] and pos.z > c[1] and pos.z < c[3]: inside = true
	if H.has("mir"): (H["mir"].holder as Node3D).visible = not inside      # in a court whose water lies below the floor, that water's own body mirrors her
	if not refl_out.is_empty() and refl_w == "C2":      # her reflection passes the gap: from there on it belongs to the west tank's world (the two are level, or it could not pass)
		var hd: Node3D = refl_out.holder
		var want: Node3D = N["cs2T_mr"] if hd.position.x < (CS2WX0 + CS2WX1) * 0.5 else N["cs2S_mr"]
		if hd.get_parent() != want and absf(float(N["cs2T_level"]) - float(N["cs2S_level"])) < 0.01: hd.reparent(want, false)

# ---------------------------------------------------------------- the run that tries the wing
func _ready() -> void:
	super._ready()
	if "cistern" in OS.get_cmdline_user_args(): _play_cistern()

func _play_cistern() -> void:
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)
	_wake_now(); _open_to("U")
	pos = Vector3(UX0 - 1.0, 0, UC.z); yaw = -PI * 0.5; cam_t = pos
	await wait(0.5)
	await _tap_wait(Vector3(-41.5, 0, CS1Z1 - 0.65))
	print("CISTERN 1 on the south rim at ", pos)
	await _tap_wait(CS_LEV1 + Vector3(0, -CS_TOP - 0.7, 0))      # the lever, from the rim: her reflection cannot go down to it
	print("CISTERN 1 from the rim: lever ", done.has("cs_lever1"), ", reflection at ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her", " she at ", pos)
	await _tap_wait(Vector3((CS_RX0 + CS_RX1) * 0.5, CS_TOP, CS_RZ0 - 0.9))      # the top landing
	print("CISTERN 1 on the landing at ", pos)
	await _tap_wait(CS_LEV1 + Vector3(0, -CS_TOP - 0.7, 0))
	print("CISTERN 1 from the landing: lever ", done.has("cs_lever1"), " sluice ", rects["C1x"].on, " she at ", pos)
	await _tap_wait(Vector3(CS2PX1 + 0.9, 0, CS2CZ))
	print("CISTERN 2 on the east rim at ", pos)
	var l2 := Vector3(CS2PX0 + 0.45, -1.3, CS2CZ)
	await _tap_wait(l2)      # the lever, while the two waters stand at different heights
	print("CISTERN 2 first try: lever ", done.has("cs_lever2"), ", reflection at ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
	await _tap_wait(N["cs_hub2"])      # the wheel: the west water goes down a step
	print("CISTERN 2 wheel: west level ", N["cs2T_level"], " gap ", W["C2"].foot["gap"].on, " she at ", pos, ", reflection ", (refl_out.holder as Node3D).position if not refl_out.is_empty() else "under her")
	await _tap_wait(l2)
	print("CISTERN 2 second try: lever ", done.has("cs_lever2"), " sluice ", rects["C2x"].on, " she at ", pos)
	get_tree().quit()
