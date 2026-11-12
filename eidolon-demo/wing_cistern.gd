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

func _init() -> void:
	super._init(); wing_open["W"] = true

func _hollows() -> Array:
	return super._hollows() + [[CS1X0 + 0.5, CS1Z0 + 0.5, CS1X1 - 0.5, CS1Z1 - 0.5]]

func _wings() -> void:
	super._wings()
	_cs1()

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
	wall(CS1X0 + 0.3, CS1Z0, CS1X1, CS1Z0 + 0.3, 2.6, true)      # the north wall
	parapet(Vector3(CS1X1 - 0.1, 0, CS1Z0 + 0.4), Vector3(CS1X1 - 0.1, 0, UC.z - 0.8)); parapet(Vector3(CS1X1 - 0.1, 0, UC.z + 0.8), Vector3(CS1X1 - 0.1, 0, CS1Z1 - 0.1))
	parapet(Vector3(CS1X0 + 0.4, 0, CS1Z1 - 0.1), Vector3(-41.75, 0, CS1Z1 - 0.1)); parapet(Vector3(-40.25, 0, CS1Z1 - 0.1), Vector3(CS1X1 - 0.1, 0, CS1Z1 - 0.1))
	channel(Vector3(CS1X1 - 0.72, 0, UC.z), Vector3(CS1X1, 0, UC.z)); channel(Vector3(CS1X1 - 0.72, 0, UC.z + 0.5), Vector3(CS1X1 - 0.72, 0, CS1Z1 - 0.65)); channel(Vector3(-41.0, 0, CS1Z1 - 0.65), Vector3(CS1X1 - 1.22, 0, CS1Z1 - 0.65)); channel(Vector3(-41.0, 0, CS1Z1 - 1.15), Vector3(-41.0, 0, CS1Z1))
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
	sluice("cs_s1", Vector3(-41.0, 0, CS1Z1 - 0.2), false, 0.5)
	stele("cs_stele1", Vector3(CS1X1 - 0.75, 0, CS1Z1 - 0.9), 0.0, ["What I sink stays sunk.\nI believed that.", "As high as you stand,\nso deep she stands."])
	_look_add("cs_scaf", Vector3(CS_RX1 + 0.1, 0, CS_RZ1 + 0.2), 1.4, ["his scaffold. the stair is on this side", "the water shows its landing, and no stair"])
	urn(Vector3(CS1X1 - 0.8, 0, CS1Z0 + 0.9), 1.0); cypress(Vector3(CS1PX1 + 0.75, 0, CS1Z0 + 0.85), 2.6)

func _wing_things() -> void:
	super._wing_things()
	var lp := CS_LEV1 + Vector3(0, -(CS_TOP + 0.7), 0)
	objs["cs_lever1"] = {"at": lp, "stand": Vector3((CS_RX0 + CS_RX1) * 0.5, 0, CS_RZ0 - 0.9), "mark": false, "water": "C1", "rstand": Vector3(CS_LEV1.x - 0.5, 0, CS_LEV1.z),
		"hits": [CS_LEV1 + Vector3(0, -CS_TOP - 0.1, 0), CS_LEV1 + Vector3(0, -CS_TOP - 1.2, 0)]}

func _wing_nav() -> void:
	super._wing_nav()
	rects["C1c"] = R(CS1X1 - 0.45, UC.z - 0.25, UX0 - 0.7, UC.z + 0.25)
	rects["C1e"] = R(CS1PX1 + 0.3, CS1Z0 + 0.75, CS1X1 - 0.45, CS1Z1 - 0.45); rects["C1s"] = R(CS_RX0, CS1PZ1 + 0.3, CS1X1 - 0.45, CS1Z1 - 0.45)
	rects["C1r"] = R(CS_RX0, CS_RZ0, CS_RX1, CS1PZ1 + 0.32); rects["C1t"] = R(CS_RX0, CS1Z0 + 0.8, CS_RX1, CS_RZ0)
	ramps.append({"r": rects["C1r"], "z0": CS_RZ0, "z1": CS_RZ1, "y0": CS_TOP, "y1": 0.0}); ramps.append({"r": rects["C1t"], "z0": 0.0, "z1": 1.0, "y0": CS_TOP, "y1": CS_TOP})
	rects["C1x"] = R(-41.25, CS1Z1 - 0.47, -40.75, CS1Z1 + 0.6, false)

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
	cam_focus = Vector3(-41.0, 0.4, CS1Z1 - 1.6); cam_focus_on = true
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
	get_tree().quit()
