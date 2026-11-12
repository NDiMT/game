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
var cs3_in := false       # the inlet runs
var cs3_over := false     # the overflow at the middle is open
var cs3_wet := false
var cs_mirs: Array = []      # the mirrored bodies of her that belong to waters below the floor's height, to be made once she exists: [key, root]
var cs_courts: Array = []    # the courts with such waters: in them her ordinary mirrored body is put away

func _init() -> void:
	super._init(); wing_open["W"] = true

func _hollows() -> Array:
	return super._hollows() + [[CS1X0 + 0.5, CS1Z0 + 0.5, CS1X1 - 0.5, CS1Z1 - 0.5], [CS2X0 + 0.5, CS2Z0 + 0.5, CS2X1 - 0.5, CS2Z1 - 0.5], [CS3X0 + 0.5, CS3Z0 + 0.5, CS3X1 - 0.5, CS3Z1 - 0.5]]

func _wings() -> void:
	super._wings()
	_cs1(); _cs2(); _cs3()

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
	rects["C3x"] = R(-57.25, CS3Z1 - 0.47, -56.75, CS3Z1 + 0.6, false)

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
	get_tree().quit()
