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
# ---------------------------------------------------------------- Σ.3 the bottom, and the half wheel
const CS3X0 := -62.0
const CS3Z0 := -52.0
const CS3X1 := -49.6
const CS3Z1 := -40.0
const CS3PX0 := -60.0     # the great cistern
const CS3PZ0 := -49.6
const CS3PX1 := -52.4
const CS3PZ1 := -42.6
const CS3_BOT := -1.2     # its bottom
const CS3_FULL := -0.1
const CS3_MID := -0.6     # the height of the half wheel's axle
const CS3_LEDGE := -0.55  # the walk along its east and north walls, a hand above the middle level
const CS3_LW := 0.9       # how wide that walk is
const CS3_WHEEL := Vector3(-57.6, CS3_MID, CS3PZ0 + 0.07)      # the middle of the half wheel, on the north wall
const CS3_WR := 0.52
const CS3_IN := Vector3(-60.9, 0, -45.0)       # the wheel of its inlet, on the west rim
const CS3_OVER := Vector3(-57.2, 0, -50.5)     # the pull of its overflow, on the north rim
# ---------------------------------------------------------------- Σ.4 bring the water to the hook
const CS4X0 := -62.0
const CS4Z0 := -38.6
const CS4X1 := -52.0
const CS4Z1 := -28.6
const CS4PX0 := -60.2     # the outflow chamber's tank
const CS4PZ0 := -36.6
const CS4PX1 := -54.2
const CS4PZ1 := -31.2
const CS4_LOW := -0.9
const CS4_HIGH := -0.2
const CS4_LEDGE := -0.5
const CS4_CRANE := Vector3(-60.85, 0, -32.8)     # on the west rim; its arm lies across the picture, over the water
const CS4_HOOK := Vector3(-58.45, 0, -35.2)      # where the hook hangs over the water
const CS4_HOOK_UP := 1.25      # how high its foot hangs wound up, and at the end of its rope
const CS4_HOOK_DN := -0.25
const CS4_WINCH := Vector3(-60.9, 0, -31.2)       # the hoist's capstan, beside the crane
const CS4_LEVEL := Vector3(-53.15, 0, -34.2)      # the capstan that lets water into the chamber, on the east rim
const CS4_POST := Vector3(-56.0, 0, -30.25)        # the post of the outflow gate, with nothing in its socket
const CS4_OX := -55.2                             # the outflow leaves the tank's south edge here
const CS4_GZ := -29.5                             # the outflow channel leaves the chamber eastward along this z
var cs4_hook_y := CS4_HOOK_UP
var cs4_has := false      # the handle has come out of the water onto the hook
var cs3_in := false       # the inlet runs
var cs3_over := false     # the overflow at the middle is open
var cs3_wet := false

func _init() -> void:
	super._init(); wing_open["W"] = true

func _hollows() -> Array:
	return super._hollows() + [[CS1X0 + 0.5, CS1Z0 + 0.5, CS1X1 - 0.5, CS1Z1 - 0.5], [CS2X0 + 0.5, CS2Z0 + 0.5, CS2X1 - 0.5, CS2Z1 - 0.5], [CS3X0 + 0.5, CS3Z0 + 0.5, CS3X1 - 0.5, CS3Z1 - 0.5], [CS4X0 + 0.5, CS4Z0 + 0.5, CS4X1 - 0.5, CS4Z1 - 0.5]]

func _wings() -> void:
	super._wings()
	_cs1(); _cs2(); _cs3(); _cs4()

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
	wall(CS1X0, CS1Z0, CS1X0 + 0.3, CS4_GZ - 0.79, 4.2, true)      # the west wall, tall, with the scaffold against it; at its south end the gate the outflow comes through
	blk(Vector3(CS1X0, 1.75, CS4_GZ - 0.79), Vector3(CS1X0 + 0.3, 4.2, CS1Z1), "stone"); blk(Vector3(CS1X0, 0, CS4_GZ + 0.79), Vector3(CS1X0 + 0.3, 1.75, CS1Z1), "stone")
	sluice("cs_back", Vector3(CS1X0 + 0.15, 0, CS4_GZ), true, 0.45)
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
	var g4: Vector3 = N["cs_hub4h"]; var g5: Vector3 = N["cs_hub4l"]
	objs["cs_hoist4"] = {"at": g4, "stand": g4 + (N["cs_hubn4h"] as Vector3) * 0.56 - Vector3(0, g4.y, 0), "mark": false, "hits": [Vector3(CS4_WINCH.x, 0.15, CS4_WINCH.z), g4, g4 + Vector3(0, 0.3, 0)]}
	objs["cs_level4"] = {"at": g5, "stand": g5 + (N["cs_hubn4l"] as Vector3) * 0.56 - Vector3(0, g5.y, 0), "mark": false, "hits": [Vector3(CS4_LEVEL.x, 0.15, CS4_LEVEL.z), g5, g5 + Vector3(0, 0.3, 0)]}
	objs["cs_take4"] = {"at": Vector3(CS4_HOOK.x, CS4_HOOK_DN + 0.3, CS4_HOOK.z), "stand": Vector3(CS4_HOOK.x + 0.55, 0, CS4_HOOK.z - 0.55), "mark": false, "hits": [Vector3(CS4_HOOK.x, CS4_HOOK_DN, CS4_HOOK.z), Vector3(CS4_HOOK.x, CS4_HOOK_DN + 0.5, CS4_HOOK.z)]}
	done["cs_take4"] = true      # nothing to take until the hook has met the water
	objs["cs_post4"] = {"at": CS4_POST + Vector3(0, 0.95, 0), "stand": CS4_POST + Vector3(0, 0, 0.55), "mark": false, "hits": [CS4_POST + Vector3(0, 0.1, 0), CS4_POST + Vector3(0, 1.0, 0)]}
	var g3: Vector3 = N["cs_hub3i"]
	objs["cs_inlet3"] = {"at": g3, "stand": g3 + (N["cs_hubn3i"] as Vector3) * 0.56 - Vector3(0, g3.y, 0), "mark": false, "hits": [Vector3(CS3_IN.x, 0.15, CS3_IN.z), g3, g3 + Vector3(0, 0.3, 0)]}
	objs["cs_over3"] = {"at": CS3_OVER + Vector3(0, 1.0, 0), "stand": CS3_OVER + Vector3(0, 0, -0.55), "mark": false, "hits": [CS3_OVER + Vector3(0, 0.1, 0), CS3_OVER + Vector3(0, 1.25, 0)]}
	objs["cs_wheel3"] = {"at": CS3_WHEEL + Vector3(0, 0.3, 0.1), "stand": Vector3(CS3_WHEEL.x + 1.05, 0, CS3PZ0 + 0.45), "mark": false, "hits": [CS3_WHEEL + Vector3(0, -0.4, 0.1), CS3_WHEEL + Vector3(0, 0.5, 0.1)]}
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
	rects["C2x"] = R(CS3X1 - 0.47, CS2CZ - 0.25, CS2X0 + 0.77, CS2CZ + 0.25, false)
	rects["C3e"] = R(CS3PX1 + 0.3, CS3Z0 + 0.75, CS3X1 - 0.45, CS3Z1 - 0.45); rects["C3s"] = R(CS3X0 + 0.75, CS3PZ1 + 0.3, CS3X1 - 0.45, CS3Z1 - 0.45)
	rects["C3n"] = R(CS3X0 + 0.75, CS3Z0 + 0.75, CS3X1 - 0.45, CS3PZ0 - 0.3); rects["C3w"] = R(CS3X0 + 0.75, CS3Z0 + 0.75, CS3PX0 - 0.3, CS3Z1 - 0.45)
	rects["C3st"] = R(CS3PX1 - CS3_LW + 0.2, CS3PZ1 - 1.5, CS3PX1 - 0.2, CS3PZ1 + 0.32); rects["C3le"] = R(CS3PX1 - CS3_LW + 0.2, CS3PZ0 + 0.3, CS3PX1 - 0.2, CS3PZ1 - 1.5); rects["C3ln"] = R(CS3_WHEEL.x + 0.85, CS3PZ0 + 0.3, CS3PX1 - 0.2, CS3PZ0 + CS3_LW - 0.2)
	ramps.append({"r": rects["C3st"], "z0": CS3PZ1 - 1.5, "z1": CS3PZ1, "y0": CS3_LEDGE, "y1": 0.0}); ramps.append({"r": rects["C3le"], "z0": 0.0, "z1": 1.0, "y0": CS3_LEDGE, "y1": CS3_LEDGE}); ramps.append({"r": rects["C3ln"], "z0": 0.0, "z1": 1.0, "y0": CS3_LEDGE, "y1": CS3_LEDGE})
	solids.append(Vector3(CS3_IN.x, CS3_IN.z, 0.5)); solids.append(Vector3(CS3_OVER.x, CS3_OVER.z, 0.25))
	rects["C3x"] = R(-57.25, CS3Z1 - 0.47, -56.75, CS4Z0 + 0.77, false)
	rects["C4n"] = R(CS4X0 + 0.75, CS4Z0 + 0.75, CS4X1 - 0.45, CS4PZ0 - 0.3); rects["C4e"] = R(CS4PX1 + 0.3, CS4Z0 + 0.75, CS4X1 - 0.45, CS4Z1 - 0.45)
	rects["C4s"] = R(CS4X0 + 0.75, CS4PZ1 + 0.3, CS4X1 - 0.45, CS4Z1 - 0.45); rects["C4w"] = R(CS4X0 + 0.75, CS4PZ0 + 0.6, CS4PX0 - 0.3, CS4Z1 - 0.45)
	rects["C4st"] = R(CS4PX1 - 1.5, CS4PZ0 + 0.2, CS4PX1 + 0.32, CS4PZ0 + 0.95); rects["C4le"] = R(CS4_HOOK.x + 0.4, CS4PZ0 + 0.2, CS4PX1 - 1.5, CS4PZ0 + 0.95)
	ramps.append({"r": rects["C4st"], "ax": "x", "z0": CS4PX1 - 1.5, "z1": CS4PX1, "y0": CS4_LEDGE, "y1": 0.0}); ramps.append({"r": rects["C4le"], "z0": 0.0, "z1": 1.0, "y0": CS4_LEDGE, "y1": CS4_LEDGE})
	solids.append(Vector3(CS4_WINCH.x, CS4_WINCH.z, 0.5)); solids.append(Vector3(CS4_LEVEL.x, CS4_LEVEL.z, 0.5)); solids.append(Vector3(CS4_POST.x, CS4_POST.z, 0.3)); solids.append(Vector3(CS4_CRANE.x, CS4_CRANE.z, 0.8))
	rects["C4b"] = R(CS4X1 - 0.47, CS4_GZ - 0.25, CS_RX0 + 0.15, CS4_GZ + 0.25, false)

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
			if twin: b.material_override = _cs_umat("cs2S" if both == mrS else "cs2T", Color("b3a595"))
		for seg in [[CS2PZ0, CS2CZ - 0.55], [CS2CZ + 0.55, CS2PZ1]]:
			var d := blk(Vector3(CS2WX0, -0.95, seg[0]), Vector3(CS2WX1, 0.45, seg[1]), "stone", both)
			if twin: d.material_override = _cs_umat("cs2S" if both == mrS else "cs2T", Color("cfc0aa"))
			var cp := blk(Vector3(CS2WX0 - 0.03, 0.45, seg[0]), Vector3(CS2WX1 + 0.03, 0.5, seg[1]), "shade", both)
			if twin: cp.material_override = _cs_umat("cs2S" if both == mrS else "cs2T", Color("b3a595"))
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

## Σ.3: the great cistern, empty. A walk runs along its east and north walls half way down, and on the north wall
## hangs a bronze wheel sawn in half: only its upper half is there. Its inlet (a wheel on the west rim) fills it to
## the brim; an overflow half way up (a pull on the north rim) lets it stand at the height of the wheel's axle
func _cs3() -> void:
	floor_plain(CS3X1, CS2CZ - 0.8, CS2X0, CS2CZ + 0.8, 0.0); channel(Vector3(CS3X1, 0, CS2CZ), Vector3(CS2X0, 0, CS2CZ))
	_pool_court(CS3X0, CS3Z0, CS3X1, CS3Z1, CS3PX0, CS3PZ0, CS3PX1, CS3PZ1, "stone", "PoolSkyC3")
	_cs_deep_pit("PoolSkyC3", 4.6)
	N["cs3_pit"] = get_node("PoolSkyC3"); (N["cs3_pit"] as Node3D).visible = false
	tile_hole = Rect2(CS3PX0 - 0.08, CS3PZ0 - 0.08, CS3PX1 - CS3PX0 + 0.16, CS3PZ1 - CS3PZ0 + 0.16); tiles(CS3X0, CS3Z0, CS3X1, CS3Z1, 1.0); tile_hole = Rect2()
	cs_courts.append([CS3X0, CS3Z0, CS3X1, CS3Z1])
	var mr := _cs_water("cs3", CS3PX0, CS3PZ0, CS3PX1, CS3PZ1, CS3_BOT + 0.02)
	mr.visible = false
	# its surface can lie as a film over the stone before it shows anything: the same glass, with a veil
	var gsh := Shader.new(); gsh.code = SH_GLASS.replace("//GLINT", GLSL_GLINT).replace("uniform float time_s = 0.0;", "uniform float time_s = 0.0; uniform float veil = 0.0; uniform float alpha = 1.0; uniform vec3 veil_col : source_color = vec3(0.8);").replace("	ALBEDO = c;", "	c = mix(c, mix(veil_col, vec3(0.6, 0.85, 0.88), 0.18), veil);\n	ALBEDO = c; ALPHA = alpha;")
	var gm := ShaderMaterial.new(); gm.shader = gsh; timed.append(gm)
	gm.set_shader_parameter("lost_a", 0.0); gm.set_shader_parameter("blur_px", 0.6); gm.set_shader_parameter("lod", 0.0); gm.set_shader_parameter("veil", 1.0); gm.set_shader_parameter("alpha", 0.0); gm.set_shader_parameter("veil_col", Color("d9cdb9"))
	(N["cs3_glass"] as MeshInstance3D).material_override = gm; (N["cs3_glass"] as Node3D).visible = false; N["cs3_gm"] = gm
	# the tank itself: its bottom (a face eight metres long, smooth, with nothing on it), its walls, the walk
	var bot := Node3D.new(); add_child(bot); N["cs3_bot"] = bot
	blk(Vector3(CS3PX0 - 0.08, CS3_BOT - 0.1, CS3PZ0 - 0.08), Vector3(CS3PX1 + 0.08, CS3_BOT, CS3PZ1 + 0.08), "shade", bot)
	var fc := Vector3((CS3PX0 + CS3PX1) * 0.5 - 0.5, CS3_BOT, (CS3PZ0 + CS3PZ1) * 0.5 + 0.5)
	var face := turned(Vector3.ZERO, [[2.35, 0.0], [2.35, 0.012], [2.2, 0.03], [0.0, 0.03]], "marble", 40, bot); face.position = fc; face.scale = Vector3(1.0, 1.0, 1.28); face.rotation.y = -0.5
	var veilb := turned(Vector3.ZERO, [[2.62, 0.0], [2.62, 0.008], [2.4, 0.008]], "stone", 40, bot); veilb.position = fc; veilb.scale = Vector3(1.0, 1.0, 1.28); veilb.rotation.y = -0.5
	for md in [[Vector3(-59.0, CS3_BOT, -43.6), 0.34, 0.3], [Vector3(-58.2, CS3_BOT, -44.3), 0.27, 1.4], [Vector3(-54.6, CS3_BOT, -48.4), 0.3, 2.2], [Vector3(-59.2, CS3_BOT, -47.9), 0.25, 0.9]]:      # the mirrors he sank: bronze discs, face down
		cyl(md[0], md[1], md[1], 0.03, pal("gold"), 20, bot); cyl(md[0] + Vector3(0, 0.03, 0), md[1] * 0.3, md[1] * 0.3, 0.02, pal("dark"), 12, bot)
		var hd := blk(Vector3(-0.03, 0, 0), Vector3(0.03, 0.03, md[1] + 0.22), "gold", bot); hd.position += md[0]; hd.rotation.y = md[2]
	for both in [self, mr]:
		var twin: bool = both != self
		for wl in [[CS3PX0 - 0.08, CS3PZ0 - 0.08, CS3PX1 + 0.08, CS3PZ0], [CS3PX0 - 0.08, CS3PZ0, CS3PX0, CS3PZ1]]:      # the north and west walls
			var b := blk(Vector3(wl[0], CS3_BOT, wl[1]), Vector3(wl[2], -0.17, wl[3]), "shade", both)
			if twin: b.material_override = _cs_umat("cs3", Color("b3a595"))
		# the walk: along the east wall from the stair, then along the north wall to the wheel
		for lg in [[CS3PX1 - CS3_LW, CS3PZ0, CS3PX1, CS3PZ1 - 1.5], [CS3_WHEEL.x + 0.75, CS3PZ0, CS3PX1 - CS3_LW, CS3PZ0 + CS3_LW]]:
			var b2 := blk(Vector3(lg[0], CS3_BOT, lg[1]), Vector3(lg[2], CS3_LEDGE, lg[3]), "stone", both)
			if twin: b2.material_override = _cs_umat("cs3", Color("cfc0aa"))
		for k in 4:      # the stair down to it from the south rim
			var b3 := blk(Vector3(CS3PX1 - CS3_LW, CS3_BOT, CS3PZ1 - 0.375 * (k + 1)), Vector3(CS3PX1, CS3_LEDGE * (k + 1) / 4.0 + 0.0, CS3PZ1 - 0.375 * k), "stone", both)
			if twin: b3.material_override = _cs_umat("cs3", Color("cfc0aa"))
	# the half wheel: a whole wheel as it was made, of which the stone shows only what is above the axle (he sawed
	# the rest away); the water, when it stands at the axle, shows the other half
	var wsh := Shader.new(); wsh.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled;\nuniform vec3 col : source_color; uniform float axle = 0.0; uniform float level = -100.0; uniform float twin = 0.0;\nvarying vec3 wp; varying vec3 wn;\nvoid vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }\nvoid fragment(){\n	if (twin < 0.5) { if (wp.y < axle) discard; } else { if (wp.y > level || 2.0 * level - wp.y < axle) discard; }\n	float sh = 0.74 + 0.26 * clamp(dot(normalize(wn), normalize(vec3(0.35, 0.7, 0.62))) * 0.5 + 0.5, 0.0, 1.0);\n	ALBEDO = col * sh * mix(1.0, 0.86, twin);\n}"
	for both in [self, mr]:
		var twin: bool = both != self
		var wm := ShaderMaterial.new(); wm.shader = wsh; wm.set_shader_parameter("col", Color("d6a03a")); wm.set_shader_parameter("axle", CS3_MID); wm.set_shader_parameter("twin", 1.0 if twin else 0.0)
		var wm2: ShaderMaterial = wm.duplicate(); wm2.set_shader_parameter("col", Color("8a6a2a"))
		var wn := Node3D.new(); wn.position = CS3_WHEEL; both.add_child(wn)
		var rim := TorusMesh.new(); rim.inner_radius = CS3_WR - 0.07; rim.outer_radius = CS3_WR; rim.rings = 32; rim.ring_segments = 8
		prim(rim, Vector3.ZERO, wm, wn).rotation.x = PI * 0.5
		for i in 6:
			var sp := prim(_box(Vector3(0.05, CS3_WR * 2.0 - 0.1, 0.04)), Vector3.ZERO, wm2, wn); sp.rotation.z = PI * i / 6.0
		var hub := cyl(Vector3.ZERO, 0.1, 0.1, 0.1, wm, 14, wn); hub.rotation.x = PI * 0.5; hub.position = Vector3(0, 0, 0.0)
		for i in 12:      # pegs round the rim, to push it by
			var pg := prim(_box(Vector3(0.05, 0.05, 0.12)), Vector3(cos(TAU * i / 12.0), sin(TAU * i / 12.0), 0) * (CS3_WR - 0.035) + Vector3(0, 0, 0.07), wm2, wn)
			pg.rotation.z = TAU * i / 12.0
		N["cs3_wheel_m" if twin else "cs3_wheel"] = wn; N["cs3_wmat_m" if twin else "cs3_wmat"] = [wm, wm2]
	blk(Vector3(CS3_WHEEL.x - 0.09, CS3_MID - 0.09, CS3PZ0 - 0.06), Vector3(CS3_WHEEL.x + 0.09, CS3_MID + 0.09, CS3PZ0 + 0.03), "dark")      # its bearing in the wall
	var rim_e := R(CS3PX1 + 0.3, CS3Z0 + 0.75, CS3X1 - 0.45, CS3Z1 - 0.45); var rim_s := R(CS3X0 + 0.75, CS3PZ1 + 0.3, CS3X1 - 0.45, CS3Z1 - 0.45)
	var le := R(CS3PX1 - CS3_LW + 0.2, CS3PZ0 + 0.3, CS3PX1 - 0.2, CS3PZ1 - 1.5, true, CS3_LEDGE); var ln := R(CS3_WHEEL.x + 0.85, CS3PZ0 + 0.3, CS3PX1 - 0.2, CS3PZ0 + CS3_LW - 0.2, true, CS3_LEDGE)
	W["C3"] = {"r": [CS3PX0, CS3PZ0, CS3PX1, CS3PZ1], "level": CS3_BOT, "wet": false, "mir": "mir_cs3", "heads": [rim_e, rim_s, le, ln], "foot": {"re": rim_e, "rs": rim_s, "le": le, "ln": ln}}
	WL.append("C3")
	# the inlet: a capstan on the west rim, and under it in the wall the mouth the water comes from
	var wd := winch(CS3_IN, PI * 0.5, self, false)
	N["cs_wheel3i"] = wd.wheel; N["cs_hub3i"] = wd.hub; N["cs_hubn3i"] = wd.n
	blk(Vector3(CS3PX0 - 0.05, -0.62, CS3_IN.z - 0.22), Vector3(CS3PX0 + 0.06, -0.3, CS3_IN.z + 0.22), "gold"); blk(Vector3(CS3PX0 + 0.06, -0.56, CS3_IN.z - 0.15), Vector3(CS3PX0 + 0.075, -0.36, CS3_IN.z + 0.15), "dark")
	# the overflow: a bronze flap in the north wall at the middle height, a chain up the wall, and a ring to pull on a post
	var flap := Node3D.new(); flap.position = Vector3(CS3_OVER.x, CS3_MID + 0.02, CS3PZ0 + 0.02); add_child(flap); N["cs3_flap"] = flap
	blk(Vector3(-0.2, -0.26, 0), Vector3(0.2, 0.0, 0.03), "gold", flap)
	blk(Vector3(CS3_OVER.x - 0.24, CS3_MID - 0.28, CS3PZ0 - 0.02), Vector3(CS3_OVER.x + 0.24, CS3_MID + 0.05, CS3PZ0 + 0.015), "dark")
	for i in 7: blk(Vector3(CS3_OVER.x - 0.012, CS3_MID + 0.04 + 0.08 * i, CS3PZ0 + 0.02), Vector3(CS3_OVER.x + 0.012, CS3_MID + 0.1 + 0.08 * i, CS3PZ0 + 0.045), "gold" if i % 2 == 0 else "dark")
	blk(CS3_OVER + Vector3(-0.1, 0, -0.1), CS3_OVER + Vector3(0.1, 0.08, 0.1), "shade"); blk(CS3_OVER + Vector3(-0.06, 0.08, -0.06), CS3_OVER + Vector3(0.06, 0.95, 0.06), "stone")
	var pull := Node3D.new(); pull.position = CS3_OVER + Vector3(0, 0.95, 0.0); add_child(pull); N["cs3_pull"] = pull
	var ring := TorusMesh.new(); ring.inner_radius = 0.06; ring.outer_radius = 0.085
	prim(ring, Vector3(0, 0.1, 0.08), pal("gold"), pull).rotation.x = PI * 0.5; blk(Vector3(-0.012, 0, 0.06), Vector3(0.012, 0.06, 0.085), "gold", pull)
	wall(CS3X0, CS3Z0, CS3X1, CS3Z0 + 0.3, 2.6); wall(CS3X0, CS3Z0 + 0.3, CS3X0 + 0.3, CS3Z1, 2.6)
	parapet(Vector3(CS3X1 - 0.1, 0, CS3Z0 + 0.4), Vector3(CS3X1 - 0.1, 0, CS2CZ - 0.8)); parapet(Vector3(CS3X1 - 0.1, 0, CS2CZ + 0.8), Vector3(CS3X1 - 0.1, 0, CS3Z1 - 0.1)); parapet(Vector3(CS3X0 + 0.4, 0, CS3Z1 - 0.1), Vector3(-57.75, 0, CS3Z1 - 0.1)); parapet(Vector3(-56.25, 0, CS3Z1 - 0.1), Vector3(CS3X1 - 0.1, 0, CS3Z1 - 0.1))
	sluice("cs_s3", Vector3(-57.0, 0, CS3Z1 - 0.2), false, 0.5)
	channel(Vector3(CS3X1 - 1.1, 0, CS2CZ), Vector3(CS3X1, 0, CS2CZ)); channel(Vector3(CS3X1 - 1.1, 0, CS2CZ + 0.5), Vector3(CS3X1 - 1.1, 0, CS3Z1 - 1.1)); channel(Vector3(-57.0, 0, CS3Z1 - 1.1), Vector3(CS3X1 - 1.6, 0, CS3Z1 - 1.1)); channel(Vector3(-57.0, 0, CS3Z1 - 0.6), Vector3(-57.0, 0, CS3Z1))
	stele("cs_stele3", Vector3(CS3X1 - 0.8, 0, CS3Z1 - 0.9), 0.0, ["I cut the wheel in half.\nHalf a wheel opens nothing.", "The half I carved, I kept.\nThe other half the water gives,\nat the right height."])
	_look_add("cs_face", Vector3(CS3PX1 - 0.3, 0, CS3PZ1 + 0.1), 0.3, ["the bottom of the cistern is a face, eight metres long", "smooth. nothing is carved on it"])
	_look_add("cs_sunk", Vector3(CS3PX0 + 0.2, 0, CS3PZ1 + 0.1), 0.3, ["bronze discs on the bottom, face down", "mirrors. he sank them"])
	urn(Vector3(CS3X1 - 0.8, 0, CS3Z0 + 0.9), 1.0); cypress(Vector3(CS3X0 + 0.85, 0, CS3Z1 - 0.8), 2.6)

## the level the cistern's water goes to with its inlet and its overflow as they stand: none, the middle, the brim
func _cs3_target() -> float:
	return CS3_BOT if not cs3_in else (CS3_MID if cs3_over else CS3_FULL)

## the cistern's water goes there. Coming into the empty tank it first lies as a film over the stone, then deepens
## and begins to show; going out, the other way round. The walk is under water when it stands at the brim
func _cs3_apply() -> void:
	var to := _cs3_target(); var gm: ShaderMaterial = N["cs3_gm"]; var gl: Node3D = N["cs3_glass"]
	var wet := to > CS3_BOT + 0.05
	if not refl_out.is_empty() and refl_w == "C3": await _refl_melt()
	rects["C3le"].on = false; rects["C3ln"].on = false; rects["C3st"].on = false      # (while the water moves)
	if wet and not cs3_wet:      # water comes into the empty tank
		N["cs3_level"] = CS3_BOT + 0.02; (N["cs3_mr"] as Node3D).position.y = 2.0 * (CS3_BOT + 0.02); gl.position.y = CS3_BOT + 0.032
		gm.set_shader_parameter("veil", 1.0); gm.set_shader_parameter("alpha", 0.0); gl.visible = true
		var f := create_tween(); f.tween_method(func(v: float) -> void: gm.set_shader_parameter("alpha", v), 0.0, 1.0, 0.9)
		await f.finished
		(N["cs3_bot"] as Node3D).visible = false; (N["cs3_pit"] as Node3D).visible = true; (N["cs3_mr"] as Node3D).visible = true
		cs3_wet = true; W["C3"].wet = true
		create_tween().tween_method(func(v: float) -> void: gm.set_shader_parameter("veil", v), 1.0, 0.0, 1.6)
	var lt := create_tween(); lt.tween_method(func(v: float) -> void:
		N["cs3_level"] = v; W["C3"].level = v
		(N["cs3_mr"] as Node3D).position.y = 2.0 * v; gl.position.y = v + 0.012
		for m in (N["cs3_wmat_m"] as Array) + (N.get("cs3_umats", []) as Array): (m as ShaderMaterial).set_shader_parameter("level", v), float(N["cs3_level"]), to if wet else CS3_BOT + 0.02, 0.6 + 4.0 * absf(float(N["cs3_level"]) - (to if wet else CS3_BOT + 0.02))).set_trans(Tween.TRANS_SINE)
	if not wet and cs3_wet:      # the last of it: it stops showing, and is a film on the stone again
		var total := 0.6 + 4.0 * absf(float(N["cs3_level"]) - (CS3_BOT + 0.02))
		await wait(maxf(total - 1.4, 0.0))
		var v2 := create_tween(); v2.tween_method(func(v: float) -> void: gm.set_shader_parameter("veil", v), 0.0, 1.0, 1.4)
		await lt.finished
		(N["cs3_bot"] as Node3D).visible = true; (N["cs3_pit"] as Node3D).visible = false; (N["cs3_mr"] as Node3D).visible = false
		cs3_wet = false; W["C3"].wet = false
		var f2 := create_tween(); f2.tween_method(func(v: float) -> void: gm.set_shader_parameter("alpha", v), 1.0, 0.0, 0.9)
		await f2.finished
		gl.visible = false
	else:
		await lt.finished
	var dry := to < CS3_LEDGE - 0.02      # the walk stands clear of the water
	rects["C3le"].on = dry; rects["C3ln"].on = dry; rects["C3st"].on = dry

## Σ.3: the inlet's wheel. She turns it: the water comes in (or stops, and what is in the tank drains away)
func _do_cs_inlet3() -> void:
	var hub: Vector3 = N["cs_hub3i"]; var hn: Vector3 = N["cs_hubn3i"]; var wa: Node3D = N["cs_wheel3i"]
	await face(hub)
	var hands := func(_v: float) -> void:
		var pts := _crank_pts(hub, hn, wa.rotation.x, 0.35)
		tgtL = pts[0]; tgtR = pts[1]
	hands.call(0.0)
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.6); up.tween_property(self, "a_wR", 1.0, 0.6); up.tween_property(self, "a_lean", 0.08, 0.6)
	await up.finished
	var s0 := cam.size
	cam_focus = Vector3((CS3PX0 + CS3PX1) * 0.5 + 0.4, -0.3, (CS3PZ0 + CS3PZ1) * 0.5 + 0.3); cam_focus_on = true
	create_tween().tween_property(cam, "size", 11.5, 1.4).set_trans(Tween.TRANS_SINE)
	cs3_in = not cs3_in
	var wt := create_tween().set_parallel(); wt.tween_property(wa, "rotation:x", wa.rotation.x + (PI * 2.5 if cs3_in else -PI * 2.5), 3.6).set_trans(Tween.TRANS_SINE); wt.tween_method(hands, 0.0, 1.0, 3.6)
	await wait(0.8)
	await _cs3_apply()
	if wt.is_running(): await wt.finished
	var off := tw(); off.tween_property(self, "a_wL", 0.0, 0.6); off.tween_property(self, "a_wR", 0.0, 0.6); off.tween_property(self, "a_lean", 0.0, 0.6)
	await off.finished
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## Σ.3: the pull of the overflow. She draws the ring up (or lets it down): the flap half way up the wall opens (or
## shuts), and the water, if it stood higher, falls to that height
func _do_cs_over3() -> void:
	await face(CS3_OVER)
	var pull: Node3D = N["cs3_pull"]; var flap: Node3D = N["cs3_flap"]
	tgtR = pull.global_position + Vector3(0, 0.1, 0.08)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.6); a.tween_property(self, "a_lean", 0.06, 0.6)
	await a.finished
	cs3_over = not cs3_over
	var s0 := cam.size
	cam_focus = Vector3((CS3PX0 + CS3PX1) * 0.5 + 0.4, -0.3, (CS3PZ0 + CS3PZ1) * 0.5 + 0.3); cam_focus_on = true
	create_tween().tween_property(cam, "size", 11.5, 1.4).set_trans(Tween.TRANS_SINE)
	var pt := create_tween().set_parallel(); pt.tween_property(pull, "position:y", CS3_OVER.y + (1.22 if cs3_over else 0.95), 0.8).set_trans(Tween.TRANS_SINE)
	pt.tween_method(func(_v: float) -> void: tgtR = pull.global_position + Vector3(0, 0.1, 0.08), 0.0, 1.0, 0.8)
	pt.tween_property(flap, "rotation:x", -1.3 if cs3_over else 0.0, 0.8).set_trans(Tween.TRANS_SINE)
	await pt.finished
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.6); b.tween_property(self, "a_lean", 0.0, 0.6)
	await _cs3_apply()
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## Σ.3: the half wheel. With the tank empty, or its water anywhere but at the axle, half a wheel does not turn. With
## the water at the axle the half and its reflection are one wheel: she pushes her half down, her reflection pushes
## its own, turn and turn about, and the deep door opens
func _do_cs_wheel3() -> void:
	var c := CS3_WHEEL
	await face(Vector3(c.x, 0, c.z))
	var rimp := func(ang: float) -> Vector3: return c + Vector3(cos(ang), sin(ang), 0) * CS3_WR + Vector3(0, 0, 0.16)
	tgtL = rimp.call(0.55); tgtR = rimp.call(0.25)
	var a := tw(); a.tween_property(self, "a_wL", 1.0, 0.6); a.tween_property(self, "a_wR", 1.0, 0.6); a.tween_property(self, "a_lean", 0.12, 0.6)
	await a.finished
	var wa: Node3D = N["cs3_wheel"]; var wm: Node3D = N["cs3_wheel_m"]
	var whole := cs3_wet and absf(float(N["cs3_level"]) - CS3_MID) < 0.03
	if not whole:      # she bears down on it: it gives a little, and comes back
		var rk := create_tween().set_trans(Tween.TRANS_SINE)
		rk.tween_method(func(v: float) -> void:
			wa.rotation.z = v; wm.rotation.z = v; tgtL = rimp.call(0.55 + v); tgtR = rimp.call(0.25 + v), 0.0, -0.14, 0.5)
		rk.tween_method(func(v: float) -> void:
			wa.rotation.z = v; wm.rotation.z = v; tgtL = rimp.call(0.55 + v); tgtR = rimp.call(0.25 + v), -0.14, 0.0, 0.7)
		await rk.finished
		var b0 := tw(); b0.tween_property(self, "a_wL", 0.0, 0.6); b0.tween_property(self, "a_wR", 0.0, 0.6); b0.tween_property(self, "a_lean", 0.0, 0.6)
		await b0.finished
		return
	var e := _refl_out_now("C3"); var hm := _hermod(e)
	var s0 := cam.size
	cam_focus = Vector3(c.x + 1.6, -0.4, c.z + 1.6); cam_focus_on = true
	create_tween().tween_property(cam, "size", 6.4, 1.4).set_trans(Tween.TRANS_SINE)
	var mir := func(p: Vector3) -> Vector3: return Vector3(p.x, 2.0 * CS3_MID - p.y, p.z)
	hm.tL = mir.call(rimp.call(0.55)); hm.tR = mir.call(rimp.call(0.25)); hm.own = true
	var base := 0.0
	for turn in 4:
		var mine := turn % 2 == 0
		if not mine:
			var hu := create_tween().set_parallel(); hu.tween_property(hm, "wL", 1.0, 0.4); hu.tween_property(hm, "wR", 1.0, 0.4); hu.tween_property(hm, "bow", 0.12, 0.4)
			await hu.finished
		var b1 := base
		var push := create_tween(); push.tween_method(func(v: float) -> void:
			wa.rotation.z = b1 - v; wm.rotation.z = b1 - v
			var k := minf(v, 0.75)
			if mine: tgtL = rimp.call(0.55 - k); tgtR = rimp.call(0.25 - k)
			else: hm.tL = mir.call(rimp.call(0.55 - k)); hm.tR = mir.call(rimp.call(0.25 - k)), 0.0, PI * 0.5, 1.5).set_trans(Tween.TRANS_SINE)
		await push.finished
		base -= PI * 0.5
		if mine:      # her hands come back up for the next hold
			var back := create_tween().set_parallel(); back.tween_property(self, "tgtL", rimp.call(0.55), 0.5); back.tween_property(self, "tgtR", rimp.call(0.25), 0.5)
			await back.finished
		else:
			var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wL", 0.0, 0.4); hd2.tween_property(hm, "wR", 0.0, 0.4); hd2.tween_property(hm, "bow", 0.0, 0.4)
			await hd2.finished
			hm.tL = mir.call(rimp.call(0.55)); hm.tR = mir.call(rimp.call(0.25))
	hm.own = false
	var b := tw(); b.tween_property(self, "a_wL", 0.0, 0.6); b.tween_property(self, "a_wR", 0.0, 0.6); b.tween_property(self, "a_lean", 0.0, 0.6)
	await b.finished
	H[refl_key] = e; refl_out = {}; refl_w = ""      # her reflection is under her feet again (it never left them)
	cam_focus = Vector3(-56.0, 0.3, CS3Z1 - 2.2)
	create_tween().tween_property(cam, "size", 11.0, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.4)
	await sluice_open("cs_s3", 2.8)
	rects["C3x"].on = true; done["cs_wheel3"] = true
	await wait(0.5)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## Σ.4: the outflow chamber. The gate of the outflow has no handle. A crane holds an empty hook over the chamber's
## water; in the water the hook holds the handle. The rope is short: wound out to its end, the hook still hangs
## well clear of the water. A capstan on the east rim lets more water in, or out again
func _cs4() -> void:
	floor_plain(-57.75, CS3Z1, -56.25, CS4Z0, 0.0); channel(Vector3(-57.0, 0, CS3Z1), Vector3(-57.0, 0, CS4Z0))
	_pool_court(CS4X0, CS4Z0, CS4X1, CS4Z1, CS4PX0, CS4PZ0, CS4PX1, CS4PZ1, "stone", "PoolSkyC4")
	_cs_deep_pit("PoolSkyC4", 4.6)
	tile_hole = Rect2(CS4PX0 - 0.08, CS4PZ0 - 0.08, CS4PX1 - CS4PX0 + 0.16, CS4PZ1 - CS4PZ0 + 0.16); tiles(CS4X0, CS4Z0, CS4X1, CS4Z1, 1.0); tile_hole = Rect2()
	cs_courts.append([CS4X0, CS4Z0, CS4X1, CS4Z1])
	var mr := _cs_water("cs4", CS4PX0, CS4PZ0, CS4PX1, CS4PZ1, CS4_LOW)
	var lw := 1.2      # the balcony under the hook: along the north wall, with a stair down to it from the east rim
	var st_x0 := CS4PX1 - 1.5      # the stair comes down westward from the east rim to here
	for both in [self, mr]:
		var twin: bool = both != self
		for wl in [[CS4PX0 - 0.08, CS4PZ0 - 0.08, CS4PX1 + 0.08, CS4PZ0], [CS4PX0 - 0.08, CS4PZ0, CS4PX0, CS4PZ1]]:
			var b := blk(Vector3(wl[0], -1.25, wl[1]), Vector3(wl[2], -0.17, wl[3]), "shade", both)
			if twin: b.material_override = _cs_umat("cs4", Color("b3a595"))
		var b2 := blk(Vector3(CS4_HOOK.x + 0.3, -1.25, CS4PZ0), Vector3(st_x0, CS4_LEDGE, CS4PZ0 + lw), "stone", both)
		if twin: b2.material_override = _cs_umat("cs4", Color("cfc0aa"))
		for k in 4:
			var b3 := blk(Vector3(CS4PX1 - 0.375 * (k + 1), -1.25, CS4PZ0), Vector3(CS4PX1 - 0.375 * k, CS4_LEDGE * (k + 1) / 4.0, CS4PZ0 + lw), "stone", both)
			if twin: b3.material_override = _cs_umat("cs4", Color("cfc0aa"))
		# the crane, its arm over the water toward the hook
		var cn := Node3D.new(); cn.position = CS4_CRANE; cn.rotation.y = -atan2(CS4_HOOK.z - CS4_CRANE.z, CS4_HOOK.x - CS4_CRANE.x); both.add_child(cn)
		var cm := prop_model("crane", cn, 0.0, 0.0, twin, false, "wood:wood,rope:rope,gold:gold,stone:stone,dark:dark"); cm.position.y = 0.05
		if twin:      # in the water it keeps plain colours of its own: so deep, the haze of the world below would leave only a shadow of it
			var cols := {"wood": Color("a98672"), "rope": Color("c2b294"), "gold": Color("d6b061"), "stone": Color("d2c5b1"), "dark": Color("7d7282")}
			var ums := {}
			for k in cols: ums[k] = _cs_umat("cs4", cols[k])
			for m in cm.find_children("*", "MeshInstance3D", true, false):
				var mi := m as MeshInstance3D
				for si in mi.mesh.get_surface_count():
					var om := mi.mesh.surface_get_material(si)
					mi.set_surface_override_material(si, ums.get(om.resource_name if om != null else "wood", ums["wood"]))
		# the hook on its rope
		var hk := Node3D.new(); hk.position = Vector3(CS4_HOOK.x, cs4_hook_y, CS4_HOOK.z); both.add_child(hk)
		var tor := TorusMesh.new(); tor.inner_radius = 0.07; tor.outer_radius = 0.1; tor.rings = 14; tor.ring_segments = 6
		prim(tor, Vector3(0, 0.1, 0), pal("gold", "flat2" if twin else "flat"), hk).rotation.x = PI * 0.5
		blk(Vector3(-0.03, 0.2, -0.03), Vector3(0.03, 0.34, 0.03), "gold", hk)
		var rope := cyl(Vector3.ZERO, 0.014, 0.014, 1.0, pal("rope", "flat2" if twin else "flat"), 6, both)
		var hd := _crank_handle(hk); hd.position = Vector3(0.0, 0.02, 0.0); hd.rotation = Vector3(0.0, 0.4, -PI * 0.5); hd.scale = Vector3.ONE * (1.35 if twin else 0.95)
		hd.visible = twin      # the handle of the outflow gate hangs on the hook only in the water
		if twin:
			var gold := _cs_umat("cs4", Color("c98f24")); var ropem := _cs_umat("cs4", Color("c2b294"))
			for m in hk.find_children("*", "MeshInstance3D", true, false): (m as MeshInstance3D).material_override = gold
			rope.material_override = ropem
		N["cs4_hook_m" if twin else "cs4_hook"] = hk; N["cs4_rope_m" if twin else "cs4_rope"] = rope; N["cs4_handle_m" if twin else "cs4_handle"] = hd
	_cs4_hook_set(cs4_hook_y)
	var rim_n := R(CS4X0 + 0.75, CS4Z0 + 0.75, CS4X1 - 0.45, CS4PZ0 - 0.3); var rim_e := R(CS4PX1 + 0.3, CS4Z0 + 0.75, CS4X1 - 0.45, CS4Z1 - 0.45)
	W["C4"] = {"r": [CS4PX0, CS4PZ0, CS4PX1, CS4PZ1], "level": CS4_LOW, "mir": "mir_cs4", "heads": [rim_n, rim_e], "foot": {}}
	WL.append("C4")
	var w1 := winch(CS4_WINCH, PI * 0.5, self, false); N["cs_wheel4h"] = w1.wheel; N["cs_hub4h"] = w1.hub; N["cs_hubn4h"] = w1.n
	var w2 := winch(CS4_LEVEL, PI * 0.5, self, false); N["cs_wheel4l"] = w2.wheel; N["cs_hub4l"] = w2.hub; N["cs_hubn4l"] = w2.n
	blk(Vector3(CS4PX1 - 0.06, -0.5, CS4_LEVEL.z - 0.22), Vector3(CS4PX1 + 0.05, -0.22, CS4_LEVEL.z + 0.22), "gold")      # the mouth the water comes from, under it
	# the outflow gate and its post
	sluice("cs_out", Vector3(CS4X1 - 0.2, 0, CS4_GZ), true, 0.45)
	blk(CS4_POST + Vector3(-0.16, 0, -0.16), CS4_POST + Vector3(0.16, 0.1, 0.16), "shade"); blk(CS4_POST + Vector3(-0.11, 0.1, -0.11), CS4_POST + Vector3(0.11, 0.86, 0.11), "stone")
	var gr := Node3D.new(); gr.position = CS4_POST + Vector3(0, 0.86, 0); add_child(gr); _gear(gr, 0.17, 14, 0.05); N["cs4_gear"] = gr
	blk(CS4_POST + Vector3(-0.035, 0.91, -0.035), CS4_POST + Vector3(0.035, 0.97, 0.035), "gold")
	var c4 := _crank_handle(gr); c4.position = Vector3(0, 0.1, 0); c4.rotation = Vector3(-PI * 0.5, 0, 0); c4.visible = false; N["cs4_crank"] = c4
	wall(CS4X0, CS4Z0, -57.75, CS4Z0 + 0.3, 2.6); wall(-56.25, CS4Z0, CS4X1, CS4Z0 + 0.3, 2.6); wall(CS4X0, CS4Z0 + 0.3, CS4X0 + 0.3, CS4Z1, 2.6)
	parapet(Vector3(CS4X1 - 0.1, 0, CS4Z0 + 0.4), Vector3(CS4X1 - 0.1, 0, CS4_GZ - 0.72)); parapet(Vector3(CS4X0 + 0.4, 0, CS4Z1 - 0.1), Vector3(CS4X1 - 0.1, 0, CS4Z1 - 0.1))
	# the way the water takes: east over a bridge, through the gate in the scaffold court's wall, along its south rim, to the door of the atrium
	floor_plain(CS4X1, CS4_GZ - 0.8, CS1X0, CS4_GZ + 0.8, 0.0)
	for e in [-1.0, 1.0]: parapet(Vector3(CS4X1 + 0.1, 0, CS4_GZ + e * 0.7), Vector3(CS1X0 - 0.1, 0, CS4_GZ + e * 0.7))
	channel(Vector3(CS4_OX, 0, CS4PZ1 + 0.1), Vector3(CS4_OX, 0, CS4_GZ - 0.5)); channel(Vector3(CS4_OX - 0.5, 0, CS4_GZ), Vector3(-36.35, 0, CS4_GZ)); channel(Vector3(-36.85, 0, CS4_GZ - 0.5), Vector3(-36.85, 0, UC.z + 0.5))
	channel(Vector3(-57.0, 0, CS4Z0 + 0.02), Vector3(-57.0, 0, CS4PZ0 - 0.1))
	stele("cs_stele4", Vector3(CS4X1 - 0.8, 0, CS4Z0 + 0.95), 0.0, ["The rope is short on purpose.", "What will not go down to the water,\nthe water can come up to."])
	_look_add("cs_hookl", Vector3(CS4_HOOK.x, -0.5, CS4_HOOK.z), 1.6, ["a hook, and nothing on it", "in the water the hook is not empty"])
	urn(Vector3(CS4X0 + 0.95, 0, CS4Z0 + 0.95), 1.0, "rose")

## the hook hangs with its foot at y; the rope follows it, on both sides of the water
func _cs4_hook_set(y: float) -> void:
	cs4_hook_y = y
	for sfx in ["", "_m"]:
		var hk: Node3D = N["cs4_hook" + sfx]; hk.position.y = y
		var rope: MeshInstance3D = N["cs4_rope" + sfx]
		var top := 2.48; var bot := y + 0.34
		rope.position = Vector3(hk.position.x, (top + bot) * 0.5, hk.position.z); rope.scale = Vector3(1, maxf(top - bot, 0.01), 1)

## the hook and the water meet: the hook is one with its reflection, and holds what that held
func _cs4_meet() -> void:
	if cs4_has or cs4_hook_y > float(N["cs4_level"]) + 0.06: return
	cs4_has = true
	refl_ring.position = Vector3(CS4_HOOK.x, float(N["cs4_level"]) + 0.03, CS4_HOOK.z); refl_p = 0.0
	var hd: Node3D = N["cs4_handle"]; hd.scale = Vector3.ONE * 0.01; hd.visible = true
	var g := create_tween(); g.tween_property(hd, "scale", Vector3.ONE * 0.95, 0.6).set_trans(Tween.TRANS_SINE)
	await g.finished
	done.erase("cs_take4")

## she turns a capstan hand over hand while something happens
func _cs_turn(id: String, turns: float, secs: float, during: Callable, focus: Vector3, size: float) -> void:
	var hub: Vector3 = N["cs_hub" + id]; var hn: Vector3 = N["cs_hubn" + id]; var wa: Node3D = N["cs_wheel" + id]
	await face(hub)
	var hands := func(_v: float) -> void:
		var pts := _crank_pts(hub, hn, wa.rotation.x, 0.35)
		tgtL = pts[0]; tgtR = pts[1]
	hands.call(0.0)
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.6); up.tween_property(self, "a_wR", 1.0, 0.6); up.tween_property(self, "a_lean", 0.08, 0.6)
	await up.finished
	var s0 := cam.size
	cam_focus = focus; cam_focus_on = true
	create_tween().tween_property(cam, "size", size, 1.4).set_trans(Tween.TRANS_SINE)
	var wt := create_tween().set_parallel(); wt.tween_property(wa, "rotation:x", wa.rotation.x + PI * turns, secs).set_trans(Tween.TRANS_SINE); wt.tween_method(hands, 0.0, 1.0, secs)
	await wait(0.6)
	await during.call()
	if wt.is_running(): await wt.finished
	var off := tw(); off.tween_property(self, "a_wL", 0.0, 0.6); off.tween_property(self, "a_wR", 0.0, 0.6); off.tween_property(self, "a_lean", 0.0, 0.6)
	await off.finished
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)

## Σ.4: the hoist. She lets the hook down as far as its rope goes (or winds it up again)
func _do_cs_hoist4() -> void:
	var down := cs4_hook_y > CS4_HOOK_DN + 0.1
	await _cs_turn("4h", 2.5 if down else -2.5, 3.6, func() -> void:
		var ht := create_tween(); ht.tween_method(_cs4_hook_set, cs4_hook_y, CS4_HOOK_DN if down else CS4_HOOK_UP, 2.8).set_trans(Tween.TRANS_SINE)
		await ht.finished
		await _cs4_meet(), Vector3(CS4_HOOK.x - 0.7, 0.0, CS4_HOOK.z + 1.6), 9.0)

## Σ.4: the capstan of the chamber's water. She lets water in until it stands high (or out again). High, it covers
## the balcony; and if the hook hangs at the end of its rope, the water comes up to it
func _do_cs_level4() -> void:
	var up := float(N["cs4_level"]) < CS4_HIGH - 0.05
	rects["C4st"].on = false; rects["C4le"].on = false
	await _cs_turn("4l", 2.5 if up else -2.5, 3.8, func() -> void:
		await _cs_level("cs4", CS4_HIGH if up else CS4_LOW, 3.0)
		W["C4"].level = float(N["cs4_level"])
		await _cs4_meet(), Vector3((CS4PX0 + CS4PX1) * 0.5 + 0.4, 0.0, (CS4PZ0 + CS4PZ1) * 0.5 + 0.3), 10.0)
	rects["C4st"].on = not up; rects["C4le"].on = not up

## Σ.4: the handle on the hook. From the balcony she reaches out and takes it
func _do_cs_take4() -> void:
	var hk: Node3D = N["cs4_hook"]
	await face(Vector3(hk.position.x, 0, hk.position.z))
	tgtR = hk.position + Vector3(0, 0.08, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.8); a.tween_property(self, "a_lean", 0.26, 0.8); a.tween_property(self, "a_headp", 0.12, 0.8)
	await a.finished
	await wait(0.25)
	var hd: Node3D = N["cs4_handle"]
	var sh := create_tween(); sh.tween_property(hd, "scale", Vector3.ONE * 0.01, 0.3)
	await sh.finished
	hd.visible = false; (N["cs4_handle_m"] as Node3D).visible = false
	_pocket_add("crank"); done["cs_take4"] = true
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.8); b.tween_property(self, "a_lean", 0.0, 0.8); b.tween_property(self, "a_headp", 0.0, 0.8)
	await b.finished

## Σ.4: the post of the outflow gate. With the handle she opens it: the cistern's water runs down the channel to
## the atrium, and the gate in the scaffold court's wall opens for the way back
func _do_cs_post4() -> void:
	await face(CS4_POST)
	if not ("crank" in pocket):
		var h := create_tween().set_trans(Tween.TRANS_SINE); h.tween_property(self, "a_headp", 0.25, 0.4); h.tween_interval(0.8); h.tween_property(self, "a_headp", 0.0, 0.5)
		say("a square socket, and nothing to turn it by")
		await h.finished
		return
	var gr: Node3D = N["cs4_gear"]; var c4: Node3D = N["cs4_crank"]
	var grip := func() -> Vector3: return gr.global_transform * Vector3(0.25, 0.14, 0.0)
	tgtR = CS4_POST + Vector3(0, 1.0, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(self, "a_lean", 0.1, 0.7)
	await a.finished
	_pocket_take("crank"); c4.scale = Vector3.ONE * 0.01; c4.visible = true
	create_tween().tween_property(c4, "scale", Vector3.ONE * 0.85, 0.35)
	await wait(0.5)
	var g0 := create_tween(); g0.tween_property(self, "tgtR", grip.call(), 0.35)
	await g0.finished
	var s0 := cam.size
	cam_focus = Vector3(CS4X1 - 1.2, 0.3, CS4_GZ + 0.2); cam_focus_on = true
	create_tween().tween_property(cam, "size", 10.5, 1.4).set_trans(Tween.TRANS_SINE)
	var tn := create_tween(); tn.tween_method(func(v: float) -> void:
		gr.rotation.y = v; tgtR = grip.call(), 0.0, -TAU * 3.0, 5.0).set_trans(Tween.TRANS_SINE)
	await wait(1.0)
	await sluice_open("cs_out", 2.6)
	done["cs_post4"] = true; done["cs_hoist4"] = true; done["cs_level4"] = true
	chan_run([Vector3(CS4_OX, 0, CS4PZ1 + 0.1), Vector3(CS4_OX, 0, CS4_GZ), Vector3(-36.85, 0, CS4_GZ), Vector3(-36.85, 0, UC.z), Vector3(UX0 + 0.3, 0, UC.z)], 2.4)      # the water is on its way to the atrium
	if tn.is_running(): await tn.finished
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.7); b.tween_property(self, "a_lean", 0.0, 0.7)
	await b.finished
	cam_focus = Vector3(CS1X0 - 1.6, 0.3, CS4_GZ + 0.4)
	await wait(1.6)
	await sluice_open("cs_back", 2.4)
	rects["C4b"].on = true
	await wait(0.6)
	cam_focus_on = false
	create_tween().tween_property(cam, "size", s0, 1.4).set_trans(Tween.TRANS_SINE)
	_wing_done("W")

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
	if not refl_out.is_empty() and refl_w == "C2":      # her reflection passes the gap: from there on it belongs to the west tank's world (the two are level, or it could not pass)
		var hd: Node3D = refl_out.holder
		var want: Node3D = N["cs2T_mr"] if hd.position.x < (CS2WX0 + CS2WX1) * 0.5 else N["cs2S_mr"]
		if hd.get_parent() != want and absf(float(N["cs2T_level"]) - float(N["cs2S_level"])) < 0.01: hd.reparent(want, false)

# ---------------------------------------------------------------- the run that tries the wing
func _ready() -> void:
	super._ready()
	if "cistern" in OS.get_cmdline_user_args(): _play_cistern()
	if OS.get_environment("CS3") != "":      # (for stills) the great cistern at the brim, or at the middle
		cs3_in = true; cs3_over = OS.get_environment("CS3") == "mid"
		_cs3_apply()

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
	await _tap_wait(CS3_WHEEL + Vector3(0, 0.2, 0.1))      # the half wheel, with the tank empty
	print("CISTERN 3 empty: wheel ", done.has("cs_wheel3"), " she at ", pos)
	await _tap_wait(N["cs_hub3i"])      # the inlet: it fills to the brim
	print("CISTERN 3 inlet: level ", N["cs3_level"], " walk open ", rects["C3le"].on, " she at ", pos)
	await _tap_wait(CS3_WHEEL + Vector3(0, 0.2, 0.1))
	print("CISTERN 3 full: wheel ", done.has("cs_wheel3"), " she at ", pos)
	await _tap_wait(CS3_OVER + Vector3(0, 1.0, 0))      # the overflow: it falls to the middle
	print("CISTERN 3 overflow: level ", N["cs3_level"], " walk open ", rects["C3le"].on)
	await _tap_wait(CS3_WHEEL + Vector3(0, 0.2, 0.1))
	print("CISTERN 3 at the axle: wheel ", done.has("cs_wheel3"), " sluice ", rects["C3x"].on, " she at ", pos)
	await _tap_wait(CS4_POST + Vector3(0, 0.6, 0))
	print("CISTERN 4 post without the handle: ", done.has("cs_post4"), " she at ", pos)
	await _tap_wait(N["cs_hub4h"])      # the hoist: the hook goes down to the end of its rope, short of the water
	print("CISTERN 4 hook down at ", cs4_hook_y, " water ", N["cs4_level"], " handle on it ", cs4_has)
	await _tap_wait(N["cs_hub4l"])      # more water: it comes up to the hook
	print("CISTERN 4 water up at ", N["cs4_level"], " handle on the hook ", cs4_has, " balcony open ", rects["C4le"].on)
	await _tap_wait(Vector3(CS4_HOOK.x, CS4_HOOK_DN + 0.3, CS4_HOOK.z))      # the handle, while the balcony is under water
	print("CISTERN 4 take with the water high: pocket ", pocket)
	await _tap_wait(N["cs_hub4l"])      # the water down again
	await _tap_wait(Vector3(CS4_HOOK.x, CS4_HOOK_DN + 0.3, CS4_HOOK.z))
	print("CISTERN 4 take from the balcony: pocket ", pocket, " she at ", pos)
	await _tap_wait(CS4_POST + Vector3(0, 0.6, 0))
	print("CISTERN 4 gate: ", done.has("cs_post4"), " wings done ", wings_done, " way back ", rects["C4b"].on)
	await _tap_wait(Vector3(UX0 + 1.5, 0, UC.z))
	print("CISTERN back in the atrium at ", pos)
	get_tree().quit()
