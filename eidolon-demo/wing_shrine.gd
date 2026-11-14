extends "res://ch1.gd"
## EIDOLON, chapter 1: what lies behind the Gate. III.3 the stoa of the eight arches, and III.4 the first shrine.
## A stair goes down behind the Gate to a stoa beside a canal of still water. The stoa is one bay: an entrance with
## eight small lamps, an arch at its far end, and whoever goes through either finds the same bay again, dressed anew.
## Where what stands and what the water shows agree, she goes on; where they part, she turns back. Eight right and the
## arch opens on a round room with a round pool, and the one mirror he kept.

# ---------------------------------------------------------------- III.3 the stoa
const SH_X := -28.0            # the line of the way: through the Gate, down the back stair, along the stoa
const SH_SX0 := -29.7          # the court of the stoa
const SH_SZ0 := -55.0
const SH_SX1 := -23.6
const SH_SZ1 := -45.9
const SH_CX0 := -27.05         # its canal
const SH_CZ0 := -54.2
const SH_CX1 := -24.45
const SH_CZ1 := -46.7
const SH_ENT := -47.5          # the entrance: two low walls with four lamps each
const SH_AZ0 := -54.5          # the wall of the arch, from here...
const SH_AZ1 := -54.2          # ...to here
const SH_AH := 2.9             # its height
const SH_ASPR := 1.85          # where the arch springs
const SH_AR := 0.6             # half its width
const SH_RIM := -27.3          # the line along the canal's rim on which the furniture stands
const SH_SLOT := {"SA": -49.0, "LP": -50.0, "SL": -51.0, "BK": -52.1, "SB": -53.1}      # where each piece stands along that line
const SH_IN_S := -48.5         # where she stops when she comes in by the entrance...
const SH_IN_N := -53.3         # ...and by the arch
const SH_OUT_S := -46.3        # how far out she goes through the entrance...
const SH_OUT_N := -55.6        # ...and through the arch
const SH_VIEW := Vector3(-27.9, 0, -51.0)      # the middle of the picture while she is in the stoa
const SH_SIZE := 8.8
## the eight bays, in order. "out": the pieces that stand in it; "up": how each stands above, "dn": how the water shows
## it (SA: 1 the statue stands on its plinth; LP: 1 the lamp burns; SL: 1 the gate is raised; BK: 1 the bucket hangs
## low and full); "on": above and below agree, so the way is on through the arch; "still": her reflection does not walk
const SH_BAYS := [
	{"out": ["SA", "SL"], "up": {"SA": 1, "SL": 0}, "dn": {"SA": 1, "SL": 0}, "on": true},
	{"out": ["SA", "LP", "SL"], "up": {"SA": 0, "LP": 1, "SL": 1}, "dn": {"SA": 1, "LP": 1, "SL": 1}, "on": false},
	{"out": ["SL", "BK", "SB"], "up": {"SL": 0, "BK": 0}, "dn": {"SL": 1, "BK": 0}, "on": false},
	{"out": ["SA", "LP", "BK", "SB"], "up": {"SA": 1, "LP": 0, "BK": 1}, "dn": {"SA": 1, "LP": 0, "BK": 1}, "on": true},
	{"out": ["SA", "LP", "SL", "BK"], "up": {"SA": 1, "LP": 1, "SL": 0, "BK": 0}, "dn": {"SA": 1, "LP": 0, "SL": 0, "BK": 0}, "on": false},
	{"out": ["SA", "LP", "SB"], "up": {"SA": 1, "LP": 1}, "dn": {"SA": 1, "LP": 1}, "on": false, "still": true},
	{"out": ["SA", "LP", "BK", "SB"], "up": {"SA": 0, "LP": 1, "BK": 0}, "dn": {"SA": 0, "LP": 1, "BK": 1}, "on": false},
	{"out": ["SA", "LP", "SL", "BK", "SB"], "up": {"SA": 1, "LP": 1, "SL": 1, "BK": 1}, "dn": {"SA": 1, "LP": 1, "SL": 1, "BK": 1}, "on": true},
]

var sh_bay := 0            # which bay she stands in (0..7)
var sh_lit := 0            # how many of the eight lamps burn
var sh_mist: ColorRect     # the stoa's mist, over the whole picture
var sh_still := {}         # (the sixth bay) her mirrored body, standing where it stopped
var sh_ready := false      # the things of this part are built

func _init() -> void:
	super._init(); beyond = true

func _hollows() -> Array:
	return super._hollows() + [[SH_SX0 + 0.5, SH_SZ0 + 0.5, SH_SX1 - 0.5, SH_SZ1 - 0.5]]

func _wings() -> void:
	super._wings()
	_sh_stoa()

# ---------------------------------------------------------------- small builders
func _sh_node(par: Node, p: Vector3) -> Node3D:
	var n := Node3D.new(); n.position = p; par.add_child(n)
	return n

## a veil of mist: a pale sheet whose edges are lost. a: how thick it stands (0: none)
var sh_mist_sh: Shader
func _sh_mist_mat(a: float, flat := false) -> ShaderMaterial:
	if sh_mist_sh == null:
		sh_mist_sh = Shader.new()
		sh_mist_sh.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled;\nuniform float a = 1.0; uniform float round_k = 0.0; uniform vec3 col : source_color = vec3(0.93, 0.91, 0.94); uniform float time_s = 0.0;\nvoid fragment(){\n\tfloat w = 0.5 + 0.5 * sin(UV.x * 5.0 + time_s * 0.31 + 1.7 * sin(UV.y * 4.0 - time_s * 0.23));\n\tvec2 e = smoothstep(vec2(0.0), vec2(0.3), UV) * smoothstep(vec2(0.0), vec2(0.3), 1.0 - UV);\n\tfloat sheet = smoothstep(0.0, 0.3, UV.y) * smoothstep(0.0, 0.12, UV.x) * smoothstep(0.0, 0.12, 1.0 - UV.x);\n\tALBEDO = col; ALPHA = a * mix(sheet, e.x * e.y, round_k) * (0.8 + 0.2 * w);\n}"
	var m := ShaderMaterial.new(); m.shader = sh_mist_sh; m.set_shader_parameter("a", a); m.set_shader_parameter("round_k", 1.0 if flat else 0.0); m.render_priority = 3; timed.append(m)
	return m

# ---------------------------------------------------------------- III.3 the stoa of the eight arches
func _sh_stoa() -> void:
	# behind the Gate: a landing as high as the Gate's own, and a stair down to the north
	floor_plain(SH_X - 0.8, SH_SZ1, SH_X + 0.8, UZ0, 0.0); land_paths.append([SH_X - 0.8, SH_SZ1, SH_X + 0.8, UZ0])
	blk(Vector3(SH_X - 0.75, 0, -43.95), Vector3(SH_X + 0.75, POD_H, UZ0), "stone")
	for k in 7:
		var top := POD_H - 0.15 * (k + 1); var sz := -43.95 - 0.28 * k
		blk(Vector3(SH_X - 0.75, 0, sz - 0.28), Vector3(SH_X + 0.75, top, sz), "stone")
		blk(Vector3(SH_X - 0.77, top - 0.03, sz - 0.3), Vector3(SH_X + 0.77, top, sz - 0.28), "shade")
	# the court: a walk under a row of columns, and beside it a canal of still water
	_pool_court(SH_SX0, SH_SZ0, SH_SX1, SH_SZ1, SH_CX0, SH_CZ0, SH_CX1, SH_CZ1, "stone", "PoolSkySH1")
	_cs_deep_pit("PoolSkySH1", 3.4)
	tile_hole = Rect2(SH_CX0 - 0.08, SH_CZ0 - 0.08, SH_CX1 - SH_CX0 + 0.16, SH_CZ1 - SH_CZ0 + 0.16); tiles(SH_SX0, SH_SZ0, SH_SX1, SH_SZ1, 1.0); tile_hole = Rect2()
	glass(SH_CX0, SH_CZ0, SH_CX1, SH_CZ1)
	var walk := R(SH_X - 0.45, SH_IN_N - 0.5, SH_X + 0.25, SH_IN_S + 0.4)
	W["SH1"] = {"r": [SH_CX0, SH_CZ0, SH_CX1, SH_CZ1], "heads": [walk], "foot": {"walk": walk}, "far": 9.0}
	WL.append("SH1")
	# the canal's kerb: a moulded lip on three sides, and on the walk's side a ledge of darker stone for what stands there
	blk(Vector3(SH_CX1 + 0.07, 0, SH_CZ0 - 0.2), Vector3(SH_CX1 + 0.2, 0.07, SH_CZ1 + 0.2), "stone"); blk(Vector3(SH_CX0 - 0.07, 0, SH_CZ1 + 0.07), Vector3(SH_CX1 + 0.2, 0.07, SH_CZ1 + 0.2), "stone")
	blk(Vector3(SH_CX0 + 0.3, 0, SH_CZ0 - 0.2), Vector3(SH_CX1 + 0.2, 0.07, SH_CZ0 - 0.07), "stone")
	blk(Vector3(SH_RIM - 0.25, 0, SH_AZ1), Vector3(SH_CX0 - 0.07, 0.03, SH_ENT - 0.15), "shade")
	for k in 9:      # bronze rings let into the far kerb, for boats that never came
		var rz := SH_CZ0 + 0.7 + 0.82 * k
		var rg := TorusMesh.new(); rg.inner_radius = 0.035; rg.outer_radius = 0.055; rg.rings = 10; rg.ring_segments = 5
		prim(rg, Vector3(SH_CX1 + 0.07, 0.035, rz), pal("gold")).rotation.z = PI * 0.5
	# the row of columns along the west side; low rails round the rest
	stoa(SH_SX0 + 0.05, SH_AZ0 + 0.1, SH_SX0 + 0.35, SH_ENT + 0.15, 2.6)
	parapet(Vector3(SH_SX0 + 0.1, 0, SH_ENT + 0.35), Vector3(SH_SX0 + 0.1, 0, SH_SZ1 - 0.1)); parapet(Vector3(SH_SX0 + 0.1, 0, SH_SZ1 - 0.1), Vector3(SH_X - 0.8, 0, SH_SZ1 - 0.1))
	parapet(Vector3(SH_X + 0.8, 0, SH_SZ1 - 0.1), Vector3(SH_SX1 - 0.1, 0, SH_SZ1 - 0.1)); parapet(Vector3(SH_SX1 - 0.1, 0, SH_SZ0 + 0.1), Vector3(SH_SX1 - 0.1, 0, SH_SZ1 - 0.1))
	parapet(Vector3(SH_CX0 + 0.3, 0, SH_SZ0 + 0.1), Vector3(SH_SX1 - 0.1, 0, SH_SZ0 + 0.1))
	# a side channel comes in under the columns and across the walk to the canal: the small gate stands on it
	channel(Vector3(SH_SX0 + 0.4, 0, SH_SLOT.SL), Vector3(SH_CX0 - 0.05, 0, SH_SLOT.SL), 0.24)
	for both in [self, mroot]:
		var twin: bool = both == mroot
		_sh_arch(both, twin); _sh_entrance(both, twin)
		var sfx := "_m" if twin else ""
		N["sh_SA" + sfx] = _sh_statue_piece("SA", "pray", both, twin); N["sh_SB" + sfx] = _sh_statue_piece("SB", "calm", both, twin)
		N["sh_LP" + sfx] = _sh_lamp_piece(both, twin); N["sh_SL" + sfx] = _sh_gate_piece(both, twin); N["sh_BK" + sfx] = _sh_bucket_piece(both, twin)
	# the mist the stoa keeps: a sheet of it in the arch, a bank beyond the arch, and (once she is in) one behind her
	var mq := QuadMesh.new(); mq.size = Vector2(SH_AR * 2.0 + 0.1, SH_ASPR + SH_AR)
	N["sh_mistN"] = prim(mq, Vector3(SH_X, (SH_ASPR + SH_AR) * 0.5, SH_AZ0 + 0.12), _sh_mist_mat(0.94))
	var mq2 := QuadMesh.new(); mq2.size = Vector2(1.24, 1.7)
	N["sh_mistS"] = prim(mq2, Vector3(SH_X, 0.85, SH_ENT), _sh_mist_mat(0.0))
	var bq := QuadMesh.new(); bq.size = Vector2(7.5, 6.5); bq.orientation = PlaneMesh.FACE_Y
	N["sh_bankN"] = prim(bq, Vector3(SH_X - 0.6, 1.3, SH_AZ0 - 3.2), _sh_mist_mat(0.9, true))
	var bq2 := QuadMesh.new(); bq2.size = Vector2(3.2, 2.2); bq2.orientation = PlaneMesh.FACE_Y
	N["sh_bankS"] = prim(bq2, Vector3(SH_X + 0.3, 0.4, SH_ENT + 1.55), _sh_mist_mat(0.0, true))
	# the way on, north of the arch
	floor_plain(SH_X - 0.9, SH_SZ0 - 3.0, SH_X + 0.9, SH_SZ0, 0.9); land_paths.append([SH_X - 0.9, SH_SZ0 - 3.0, SH_X + 0.9, SH_SZ0])
	stele("sh_stele3", Vector3(SH_X - 1.05, 0, SH_ENT - 0.75), PI * 0.5, ["Walk as long as you like.\nIt is the same arch.", "When the water told it otherwise,\nI turned back. Every time."])
	_look_add("sh_lamps", Vector3(SH_X - 1.1, 0.0, SH_ENT), 0.9, ["eight small lamps on the two walls of the entrance", "one for each arch, it seems. but there is one arch"])
	_look_add("sh_arch", Vector3(SH_X + 0.95, 0, SH_AZ1), 2.6, ["an arch, and mist in it", "the same mist stands behind me"])
	urn(Vector3(SH_SX0 + 0.75, 0, SH_SZ1 - 0.7), 0.9); urn(Vector3(SH_SX0 + 1.2, 0, SH_SZ1 - 0.62), 0.6, "rose")

## the wall of the arch, across the walk at the stoa's far end (twin: as the canal shows it)
func _sh_arch(par: Node, twin: bool) -> void:
	var x0 := SH_SX0; var x1 := SH_CX0 - 0.02
	var B := func(a: Vector3, b: Vector3, p: String, c: String) -> MeshInstance3D:
		var m := blk(a, b, p, par)
		if twin: m.material_override = under_mat(Color(c))
		return m
	for seg in [[x0, SH_X - SH_AR], [SH_X + SH_AR, x1]]: B.call(Vector3(seg[0], 0, SH_AZ0), Vector3(seg[1], SH_AH, SH_AZ1), "stone", "d8ccb9")
	var gw := CSGBox3D.new(); gw.size = Vector3(SH_AR * 2.0, SH_AH - SH_ASPR, SH_AZ1 - SH_AZ0); gw.position = Vector3(SH_X, (SH_AH + SH_ASPR) * 0.5, (SH_AZ0 + SH_AZ1) * 0.5); gw.material = under_mat(Color("d8ccb9")) if twin else pal("stone")
	var gc := CSGCylinder3D.new(); gc.operation = CSGShape3D.OPERATION_SUBTRACTION; gc.radius = SH_AR; gc.height = 0.6; gc.sides = 28
	gc.rotation.x = PI * 0.5; gc.position = Vector3(0, -(SH_AH - SH_ASPR) * 0.5, 0); gc.material = under_mat(Color("b9ab98")) if twin else pal("shade"); gw.add_child(gc); par.add_child(gw)
	B.call(Vector3(x0 - 0.04, SH_AH, SH_AZ0 - 0.04), Vector3(x1 + 0.04, SH_AH + 0.07, SH_AZ1 + 0.05), "shade", "b9ab98")      # its coping
	B.call(Vector3(x1 - 0.36, 0, SH_AZ0 - 0.05), Vector3(x1 + 0.02, SH_AH + 0.2, SH_AZ1 + 0.07), "stone", "d8ccb9")       # the pier that ends it at the water
	B.call(Vector3(x1 - 0.4, SH_AH + 0.2, SH_AZ0 - 0.08), Vector3(x1 + 0.06, SH_AH + 0.27, SH_AZ1 + 0.1), "shade", "b9ab98")
	var bl := ball(Vector3(x1 - 0.17, SH_AH + 0.42, (SH_AZ0 + SH_AZ1) * 0.5 + 0.01), 0.15, pal("gold"), par)
	if twin: bl.material_override = under_mat(Color("d2aa58")); return
	# what the eye sees of its south face: a base course, imposts, the band round the arch's head, a keystone, two sunk
	# panels, a string course and dentils
	blk(Vector3(x0, 0, SH_AZ1), Vector3(SH_X - SH_AR, 0.16, SH_AZ1 + 0.035), "shade"); blk(Vector3(SH_X + SH_AR, 0, SH_AZ1), Vector3(x1 - 0.36, 0.16, SH_AZ1 + 0.035), "shade")
	for e in [-1.0, 1.0]:
		blk(Vector3(SH_X + e * (SH_AR + 0.09) - 0.11, SH_ASPR - 0.1, SH_AZ1), Vector3(SH_X + e * (SH_AR + 0.09) + 0.11, SH_ASPR, SH_AZ1 + 0.05), "shade")
		blk(Vector3(SH_X + e * (SH_AR + 0.09) - 0.08, 0.16, SH_AZ1), Vector3(SH_X + e * (SH_AR + 0.09) + 0.08, SH_ASPR - 0.1, SH_AZ1 + 0.025), "stone")
	arch_band(Vector3(SH_X, SH_ASPR, SH_AZ1), SH_AR, SH_AR + 0.1, 0.03); arch_band(Vector3(SH_X, SH_ASPR, SH_AZ1), SH_AR + 0.13, SH_AR + 0.16, 0.018); bb_end("shade")
	blk(Vector3(SH_X - 0.07, SH_ASPR + SH_AR - 0.02, SH_AZ1), Vector3(SH_X + 0.07, SH_ASPR + SH_AR + 0.2, SH_AZ1 + 0.055), "stone")
	blk(Vector3(x0 + 0.5, 0.5, SH_AZ1), Vector3(SH_X - SH_AR - 0.3, SH_ASPR - 0.25, SH_AZ1 + 0.012), "shade"); blk(Vector3(x0 + 0.56, 0.56, SH_AZ1), Vector3(SH_X - SH_AR - 0.36, SH_ASPR - 0.31, SH_AZ1 + 0.02), "stone")
	blk(Vector3(x0 + 0.3, SH_AH - 0.28, SH_AZ1), Vector3(x1 - 0.36, SH_AH - 0.22, SH_AZ1 + 0.03), "shade")
	var dx := x0 + 0.4
	while dx < x1 - 0.45:
		blk(Vector3(dx, SH_AH - 0.1, SH_AZ1), Vector3(dx + 0.07, SH_AH - 0.03, SH_AZ1 + 0.035), "shade"); dx += 0.16
	for e in [-1.0, 1.0]: blk(Vector3(SH_X + e * 0.38 - 0.02, SH_AH - 0.2, SH_AZ1), Vector3(SH_X + e * 0.38 + 0.02, SH_AH - 0.12, SH_AZ1 + 0.03), "gold")      # two bronze studs over the arch

## the entrance: two low walls, one each side of the way in, with four small lamps on each. The east one stands out
## into the canal. The lamps are kept as N["sh_cl0".."sh_cl7"] (their flames) and N["sh_ch0".."sh_ch7"] (their light)
func _sh_entrance(par: Node, twin: bool) -> void:
	var sfx := "_m" if twin else ""
	var gap := 0.62
	for w in 2:
		var wx0 := (SH_X - gap - 1.0) if w == 0 else (SH_X + gap); var wx1 := wx0 + 1.0
		blk(Vector3(wx0, 0, SH_ENT - 0.15), Vector3(wx1, 0.56, SH_ENT + 0.15), "stone", par); blk(Vector3(wx0 - 0.03, 0, SH_ENT - 0.18), Vector3(wx1 + 0.03, 0.1, SH_ENT + 0.18), "shade", par)
		blk(Vector3(wx0 - 0.04, 0.56, SH_ENT - 0.19), Vector3(wx1 + 0.04, 0.62, SH_ENT + 0.19), "shade", par)
		if not twin: blk(Vector3(wx0 + 0.12, 0.2, SH_ENT + 0.15), Vector3(wx1 - 0.12, 0.46, SH_ENT + 0.165), "shade"); blk(Vector3(wx0 + 0.16, 0.24, SH_ENT + 0.15), Vector3(wx1 - 0.16, 0.42, SH_ENT + 0.172), "stone")
		for i in 4:
			var id := w * 4 + i
			var lp := Vector3(wx0 + 0.14 + 0.24 * i, 0.62, SH_ENT)
			var st := turned(lp, [[0.07, 0.0], [0.026, 0.04], [0.026, 0.09], [0.09, 0.145], [0.098, 0.165], [0.07, 0.165], [0.0, 0.145]], "gold", 12, par)
			if twin: st.material_override = under_mat(Color("c9a45c"))
			var fl := _sh_node(par, lp + Vector3(0, 0.155, 0))
			cyl(Vector3.ZERO, 0.04, 0.0, 0.17, under_mat(Color("ffe7a0")) if twin else pal("lamp"), 8, fl); ball(Vector3(0, 0.03, 0), 0.04, under_mat(Color("ffe7a0")) if twin else pal("lamp"), fl)
			fl.scale = Vector3.ONE * 0.01; fl.visible = false
			var hl := halo(0.5, Color(1.0, 0.82, 0.45, 0.55)); hl.position = lp + Vector3(0, 0.24, 0); hl.scale = Vector3.ONE * 0.01; hl.visible = false; par.add_child(hl)
			N["sh_cl%d%s" % [id, sfx]] = fl; N["sh_ch%d%s" % [id, sfx]] = hl

## a plinth at the canal's rim with a statue of her on it, facing the water. The statue is kept apart (N[...+"s"]): in
## some bays the plinth stands empty
func _sh_statue_piece(key: String, pose: String, par: Node, twin: bool) -> Node3D:
	var n := _sh_node(par, Vector3(SH_RIM, 0, SH_SLOT[key]))
	var flat := "flat2" if twin else "flat"
	cyl(Vector3.ZERO, 0.32, 0.3, 0.07, pal("shade", flat), 20, n); cyl(Vector3(0, 0.07, 0), 0.26, 0.26, 0.1, pal("stone", flat), 20, n)
	if not twin: blk(Vector3(0.262, 0.09, -0.08), Vector3(0.276, 0.13, 0.08), "gold", n)      # its name plate, blank
	N["sh_%ss%s" % [key, "_m" if twin else ""]] = her_statue(Vector3(0, 0.17, 0), PI * 0.5, pose, 1.0, n)
	return n

## a lamp on a bronze stand. Its flame is N["sh_LPf"], its light N["sh_LPh"]
func _sh_lamp_piece(par: Node, twin: bool) -> Node3D:
	var n := _sh_node(par, Vector3(SH_RIM, 0, SH_SLOT.LP)); var sfx := "_m" if twin else ""
	blk(Vector3(-0.15, 0, -0.15), Vector3(0.15, 0.07, 0.15), "shade", n); blk(Vector3(-0.11, 0.07, -0.11), Vector3(0.11, 0.12, 0.11), "stone", n)
	var st := turned(Vector3(0, 0.12, 0), [[0.09, 0.0], [0.04, 0.09], [0.028, 0.5], [0.055, 0.55], [0.028, 0.6], [0.026, 1.0], [0.05, 1.05], [0.16, 1.15], [0.17, 1.19], [0.13, 1.19], [0.0, 1.15]], "gold", 14, n)
	if twin: st.material_override = under_mat(Color("c9a45c"))
	for a in 3:      # three small feet
		var ft := blk(Vector3(0.05, 0.0, -0.02), Vector3(0.14, 0.03, 0.02), "gold", n); ft.position += Vector3(0, 0.12, 0); ft.rotation.y = TAU * a / 3.0; ft.position = Vector3(cos(-TAU * a / 3.0) * 0.095, 0.135, sin(-TAU * a / 3.0) * 0.095)
	var fl := _sh_node(n, Vector3(0, 1.3, 0))
	cyl(Vector3.ZERO, 0.06, 0.0, 0.24, under_mat(Color("ffe7a0")) if twin else pal("lamp"), 10, fl); ball(Vector3(0, 0.04, 0), 0.06, under_mat(Color("ffe7a0")) if twin else pal("lamp"), fl)
	var hl := halo(0.8, Color(1.0, 0.82, 0.45, 0.55)); hl.position = Vector3(0, 1.42, 0); n.add_child(hl)
	N["sh_LPf" + sfx] = fl; N["sh_LPh" + sfx] = hl
	return n

## a small gate on the side channel, where it meets the canal: two posts and a lintel, a bronze leaf that is wound up
## on two chains by an axle with a ratchet and a crank. The leaf is N["sh_SLl"], its chains N["sh_SLc"]
func _sh_gate_piece(par: Node, twin: bool) -> Node3D:
	var n := _sh_node(par, Vector3(SH_RIM, 0, SH_SLOT.SL)); var sfx := "_m" if twin else ""
	for e in [-1.0, 1.0]:
		blk(Vector3(-0.1, 0, e * 0.42 - 0.09), Vector3(0.1, 1.42, e * 0.42 + 0.09), "stone", n); blk(Vector3(-0.13, 0, e * 0.42 - 0.12), Vector3(0.13, 0.1, e * 0.42 + 0.12), "shade", n)
		blk(Vector3(-0.03, 1.54, e * 0.4 - 0.03), Vector3(0.03, 1.72, e * 0.4 + 0.03), "gold", n)      # the bearings of the axle
	blk(Vector3(-0.12, 1.42, -0.56), Vector3(0.12, 1.54, 0.56), "stone", n); blk(Vector3(-0.14, 1.4, -0.58), Vector3(0.14, 1.44, 0.58), "shade", n)
	var ax := cyl(Vector3.ZERO, 0.028, 0.028, 1.14, pal("gold"), 10, n); ax.rotation.x = PI * 0.5; ax.position = Vector3(0, 1.66, 0.02)
	for e in [-1.0, 1.0]:      # the drums the chains wind on
		var dr := cyl(Vector3.ZERO, 0.05, 0.05, 0.1, pal("wood"), 10, n); dr.rotation.x = PI * 0.5; dr.position = Vector3(0, 1.66, e * 0.22)
	var gr := _sh_node(n, Vector3(0, 1.66, 0.5)); gr.rotation.x = PI * 0.5; _gear(gr, 0.095, 10, 0.035)      # the ratchet...
	var pw := blk(Vector3(-0.012, -0.012, -0.012), Vector3(0.1, 0.012, 0.012), "dark", n); pw.position = Vector3(0.1, 1.79, 0.515); pw.rotation.z = 0.75      # ...and its pawl
	var ck := _crank_handle(n); ck.position = Vector3(0, 1.66, 0.62); ck.rotation = Vector3(0, -PI * 0.5, 0.5); ck.scale = Vector3.ONE * 0.6
	var lf := _sh_node(n, Vector3.ZERO)
	for i in 5: bb(Vector3(-0.016, 0, -0.3 + 0.15 * i - 0.016), Vector3(0.016, 0.66, -0.3 + 0.15 * i + 0.016))
	var b1 := bb_end("dark", lf)
	for gy in [0.06, 0.6]: bb(Vector3(-0.022, gy, -0.33), Vector3(0.022, gy + 0.04, 0.33))
	bb(Vector3(-0.012, 0.1, -0.33), Vector3(0.012, 0.46, 0.33))      # the board that holds the water back
	var b2 := bb_end("gold", lf)
	if twin: b1.material_override = under_mat(Color("4a4468")); b2.material_override = under_mat(Color("c98f2c"))
	var chs := _sh_node(n, Vector3(0, 1.62, 0))      # the two chains, from the drums down to the leaf's head: as long as the leaf hangs low
	for e in [-1.0, 1.0]:
		var c := cyl(Vector3.ZERO, 0.012, 0.012, 1.0, under_mat(Color("4a4468")) if twin else pal("dark"), 6, chs); c.position = Vector3(0.0, -0.5, e * 0.22)
	N["sh_SLl" + sfx] = lf; N["sh_SLc" + sfx] = chs
	return n

## a balance for drawing water: a post with a forked head, a beam on a pin, a stone lashed under its short arm and a
## bucket on a rope from its long arm, out over the canal. Empty, the stone pulls the bucket up; full, it hangs low.
## The beam is N["sh_BKb"], the bucket N["sh_BKk"], the water in it N["sh_BKw"]
func _sh_bucket_piece(par: Node, twin: bool) -> Node3D:
	var n := _sh_node(par, Vector3(SH_RIM, 0, SH_SLOT.BK)); var sfx := "_m" if twin else ""
	var flat := "flat2" if twin else "flat"
	blk(Vector3(-0.14, 0, -0.14), Vector3(0.14, 0.1, 0.14), "shade", n); blk(Vector3(-0.055, 0.1, -0.055), Vector3(0.055, 1.4, 0.055), "wood", n)
	for e in [-1.0, 1.0]: blk(Vector3(-0.05, 1.34, e * 0.07 - 0.02), Vector3(0.05, 1.64, e * 0.07 + 0.02), "wood", n)      # the fork
	blk(Vector3(-0.07, 1.26, -0.1), Vector3(0.07, 1.34, 0.1), "gold", n)
	var pin := cyl(Vector3.ZERO, 0.018, 0.018, 0.24, pal("gold", flat), 8, n); pin.rotation.x = PI * 0.5; pin.position = Vector3(0, 1.5, 0)
	var bm := _sh_node(n, Vector3(0, 1.5, 0))
	blk(Vector3(-0.45, -0.035, -0.035), Vector3(1.0, 0.035, 0.035), "wood", bm)
	blk(Vector3(-0.47, -0.27, -0.09), Vector3(-0.21, -0.05, 0.09), "stone", bm)      # the stone
	for bx in [-0.42, -0.26]: blk(Vector3(bx - 0.012, -0.275, -0.095), Vector3(bx + 0.012, 0.04, 0.095), "rope", bm)      # its lashings
	blk(Vector3(0.95, -0.045, -0.045), Vector3(0.99, 0.045, 0.045), "gold", bm)
	var bk := _sh_node(n, Vector3(0.97, 0.7, 0))      # the bucket: its foot is at this node; the rope goes up from its bail
	turned(Vector3.ZERO, [[0.0, 0.0], [0.12, 0.0], [0.155, 0.27], [0.135, 0.27], [0.11, 0.03], [0.0, 0.03]], "wood", 14, bk)
	for by in [0.05, 0.2]: turned(Vector3(0, by, 0), [[0.128 + by * 0.13, 0.0], [0.132 + by * 0.13, 0.03]], "gold", 14, bk)
	var bail := TorusMesh.new(); bail.inner_radius = 0.135; bail.outer_radius = 0.15; bail.rings = 16; bail.ring_segments = 6
	var bl := prim(bail, Vector3(0, 0.27, 0), pal("gold", flat), bk); bl.rotation.x = PI * 0.5; bl.scale = Vector3(1, 1, 0.9)
	cyl(Vector3(0, 0.4, 0), 0.012, 0.012, 0.36, pal("rope", flat), 6, bk)
	var wt := cyl(Vector3(0, 0.245, 0), 0.128, 0.128, 0.012, under_mat(Color("8fd0d8")), 14, bk)
	N["sh_BKb" + sfx] = bm; N["sh_BKk" + sfx] = bk; N["sh_BKw" + sfx] = wt
	return n

## the bucket of the balance hangs low and full, or high and empty (sfx "": above; "_m": as the water shows it)
func _sh_bucket_set(sfx: String, full: bool) -> void:
	var tilt := -0.36 if full else 0.3
	(N["sh_BKb" + sfx] as Node3D).rotation.z = tilt
	(N["sh_BKk" + sfx] as Node3D).position = Vector3(0.97 * cos(tilt), 1.5 + 0.97 * sin(tilt) - 0.76, 0)
	(N["sh_BKw" + sfx] as Node3D).visible = full

## the bay is dressed as its number says: which pieces stand in it, and how, above and in the water. (Done while the
## mist is over the whole picture.)
func _sh_dress(i: int) -> void:
	var bay: Dictionary = SH_BAYS[i]
	for key in ["SA", "LP", "SL", "BK", "SB"]:
		for sfx in ["", "_m"]:
			var st: Dictionary = bay.up if sfx == "" else bay.dn
			var isout: bool = key in bay.out
			(N["sh_" + key + sfx] as Node3D).visible = isout
			if not isout: continue
			var v: int = int(st.get(key, 1))
			match key:
				"SA": (N["sh_SAs" + sfx] as Node3D).visible = v == 1
				"LP":
					(N["sh_LPf" + sfx] as Node3D).scale = Vector3.ONE * (1.0 if v == 1 else 0.01); (N["sh_LPf" + sfx] as Node3D).visible = v == 1
					(N["sh_LPh" + sfx] as Node3D).visible = v == 1
				"SL":
					(N["sh_SLl" + sfx] as Node3D).position.y = 0.72 if v == 1 else 0.0
					(N["sh_SLc" + sfx] as Node3D).scale.y = 0.2 if v == 1 else 0.92
				"BK": _sh_bucket_set(sfx, v == 1)
	# the sixth bay: her reflection has stopped. It stands in the middle of the walk and looks at her
	if bay.get("still", false) and sh_still.is_empty() and H.has("mir"):
		sh_still = H["mir"]; H.erase("mir")
		var hd: Node3D = sh_still.holder
		hd.position = Vector3(SH_X, 0, -51.7); hd.rotation.y = atan2(pos.x - hd.position.x, pos.z - hd.position.z); hd.scale = Vector3.ONE; hd.visible = true
		(sh_still.ap as AnimationPlayer).play("idle", 0.0); (sh_still.ap as AnimationPlayer).speed_scale = 1.0
	elif not bay.get("still", false) and not sh_still.is_empty():
		(sh_still.ap as AnimationPlayer).play("walk" if walk_on else "idle", 0.0)
		H["mir"] = sh_still; sh_still = {}

## one of the eight lamps of the entrance is lit, or put out: its flame grows or sinks, its light with it
func _sh_count_lamp(i: int, lit: bool, secs := 0.9) -> void:
	var t := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	for sfx in ["", "_m"]:
		var fl: Node3D = N["sh_cl%d%s" % [i, sfx]]; var hl: Node3D = N["sh_ch%d%s" % [i, sfx]]
		if lit: fl.visible = true; hl.visible = true
		t.tween_property(fl, "scale", Vector3.ONE * (1.0 if lit else 0.01), secs); t.tween_property(hl, "scale", Vector3.ONE * (1.0 if lit else 0.01), secs)
	await t.finished
	if not lit:
		for sfx in ["", "_m"]: (N["sh_cl%d%s" % [i, sfx]] as Node3D).visible = false; (N["sh_ch%d%s" % [i, sfx]] as Node3D).visible = false

# ---------------------------------------------------------------- what can be tapped, and where she can walk
func _wing_things() -> void:
	super._wing_things()
	objs["sh_on"] = {"at": Vector3(SH_X, 1.2, SH_AZ0), "stand": Vector3(SH_X, 0, SH_IN_N), "mark": false, "hits": [Vector3(SH_X, 0.25, SH_AZ0 - 0.1), Vector3(SH_X, 2.3, SH_AZ0 - 0.1)]}
	objs["sh_back"] = {"at": Vector3(SH_X, 0.6, SH_ENT), "stand": Vector3(SH_X, 0, SH_IN_S), "mark": false, "hits": [Vector3(SH_X, 0.1, SH_ENT + 0.1), Vector3(SH_X, 1.5, SH_ENT + 0.1)]}
	done["sh_on"] = true; done["sh_back"] = true      # (until she stands in the stoa)
	var cl := CanvasLayer.new(); cl.layer = 0; add_child(cl)
	sh_mist = ColorRect.new(); sh_mist.color = Color(0.93, 0.91, 0.94, 0.0); sh_mist.set_anchors_preset(Control.PRESET_FULL_RECT); sh_mist.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(sh_mist)
	sh_ready = true

func _wing_nav() -> void:
	super._wing_nav()
	rects["sh_in"] = R(SH_X - 0.4, SH_SZ1 - 0.4, SH_X + 0.4, UZ0 - 0.3)      # the landing behind the Gate and its stair
	ramps.append({"r": rects["sh_in"], "z0": -43.95, "z1": -45.91, "y0": POD_H, "y1": 0.0})
	rects["sh_walk"] = R(SH_X - 0.45, SH_IN_N - 0.5, SH_X + 0.25, SH_IN_S + 0.4)      # the walk of the stoa, between the entrance and the arch
	_sh_dress(0)

# ---------------------------------------------------------------- III.3 what happens
## she has come through the Gate: she goes down the stair behind it and along to the stoa by herself, the eye ahead of her
func _sh_arrive() -> void:
	busy = true; flags["sh_arr"] = true; route.clear(); pending = ""
	if not refl_out.is_empty(): await _refl_melt()
	cam_focus = SH_VIEW + Vector3(2.33, 0, 2.33); cam_focus_on = true
	create_tween().tween_property(cam, "size", SH_SIZE, 2.6).set_trans(Tween.TRANS_SINE)
	await go([Vector3(SH_X, 0, SH_SZ1 - 0.3), Vector3(SH_X, 0, SH_IN_S)], 1.2)
	var mt := create_tween().set_parallel()      # the mist closes behind her
	mt.tween_method(func(v: float) -> void: ((N["sh_mistS"] as MeshInstance3D).material_override as ShaderMaterial).set_shader_parameter("a", v), 0.0, 0.9, 2.2)
	mt.tween_method(func(v: float) -> void: ((N["sh_bankS"] as MeshInstance3D).material_override as ShaderMaterial).set_shader_parameter("a", v), 0.0, 0.85, 2.2)
	var h := create_tween().set_trans(Tween.TRANS_SINE); h.tween_property(self, "a_hy", -0.5, 0.7); h.tween_interval(0.5); h.tween_property(self, "a_hy", 0.0, 0.7)
	await h.finished
	done.erase("sh_on"); done.erase("sh_back")
	busy = false; settled.emit()
	print("SHRINE stoa: she stands in it at ", pos.snapped(Vector3.ONE * 0.01), ", bay ", sh_bay + 1, ", lamps ", sh_lit)

func _do_sh_on() -> void: await _sh_pass(true)
func _do_sh_back() -> void: await _sh_pass(false)

## she goes on through the arch (on) or back through the entrance. The mist takes the picture; when it clears she is
## coming into the same bay from its other end, and the bay is another. If she chose as the water bade, the next lamp
## is lit; if not, they all go out, and nothing else is lost
func _sh_pass(on: bool) -> void:
	if not refl_out.is_empty(): await _refl_melt()
	var right: bool = bool(SH_BAYS[sh_bay].on) == on
	if right and sh_lit == 7:
		await _sh_open()
		return
	var from_bay := sh_bay
	route.clear(); route.append({"p": Vector3(SH_X, 0, SH_OUT_N if on else SH_OUT_S)}); speed_cap = 1.15; face_to = null
	await wait(0.35)
	var mi := create_tween(); mi.tween_property(sh_mist, "color:a", 1.0, 1.5).set_trans(Tween.TRANS_SINE)
	await mi.finished
	route.clear(); spd = 0.0      # (under the mist)
	sh_bay = sh_bay + 1 if right else 0
	_sh_dress(sh_bay)
	pos = Vector3(SH_X, 0, SH_OUT_S if on else SH_OUT_N); yaw = PI if on else 0.0
	await wait(0.6)
	route.append({"p": Vector3(SH_X, 0, SH_IN_S if on else SH_IN_N)}); speed_cap = 1.15
	var mo := create_tween(); mo.tween_property(sh_mist, "color:a", 0.0, 1.7).set_trans(Tween.TRANS_SINE)
	await arrived
	if mo.is_running(): await mo.finished
	if right:
		sh_lit += 1
		await _sh_count_lamp(sh_lit - 1, true)
	elif sh_lit > 0:
		for i in range(sh_lit - 1, -1, -1):
			_sh_count_lamp(i, false, 1.1)
			await wait(0.14)
		sh_lit = 0
		await wait(1.2)
		say("the lamps have gone out")
	if not sh_still.is_empty():      # she sees it: it has not come with her
		look_at_pt = (sh_still.holder as Node3D).position
		await wait(1.4)
		look_at_pt = null
	print("SHRINE stoa: bay ", from_bay + 1, " ", "on" if on else "back", " was ", "right" if right else "wrong", "; now bay ", sh_bay + 1, ", lamps ", sh_lit, ", she at ", pos.snapped(Vector3.ONE * 0.01), ", reflection ", "stands apart" if not sh_still.is_empty() else "with her")

## the eighth lamp: the mist leaves the arch, and the way on stands open
func _sh_open() -> void:
	sh_lit = 8
	await _sh_count_lamp(7, true)
	await wait(0.5)
	done["sh_on"] = true; done["sh_back"] = true
	var mt := create_tween().set_parallel()
	for k in ["sh_mistN", "sh_bankN", "sh_mistS", "sh_bankS"]:
		var m: ShaderMaterial = (N[k] as MeshInstance3D).material_override
		mt.tween_method(func(v: float) -> void: m.set_shader_parameter("a", v), float(m.get_shader_parameter("a")), 0.0, 2.6)
	await mt.finished
	for k in ["sh_mistN", "sh_bankN", "sh_mistS", "sh_bankS"]: (N[k] as Node3D).visible = false
	flags["sh_stoa"] = true
	print("SHRINE stoa: eight lamps burn; the arch stands open, she at ", pos.snapped(Vector3.ONE * 0.01))

func _send_reflection(pi: int, to: Vector3, sp: Vector2) -> void:
	if WL[pi] == "SH1" and not sh_still.is_empty():      # it does not come: it looks at her, and slowly shakes its head
		if busy: return
		refl_ring.position = Vector3(to.x, 0.03, to.z); refl_p = 0.0
		refl_busy += 1
		await _refl_no(sh_still)
		refl_busy -= 1
		return
	await super._send_reflection(pi, to, sp)

func _process(dt: float) -> void:
	super._process(dt)
	if not sh_ready: return
	if not flags.get("sh_arr", false) and started and woke and not busy and not ended and shot == null and pos.z < UZ0 - 0.2 and absf(pos.x - SH_X) < 0.9: _sh_arrive()
	var mine := pos.z < UZ0 - 0.3      # behind the Gate the waters lie at the floor's height: the bodies that mirror her in waters of other levels are put away
	for k in H:
		if String(k).begins_with("mir_"): (H[k].holder as Node3D).visible = not mine
	if not sh_still.is_empty() and refl_busy == 0:      # it keeps its eyes on her
		var hd: Node3D = sh_still.holder
		hd.rotation.y = lerp_angle(hd.rotation.y, atan2(pos.x - hd.position.x, pos.z - hd.position.z), 1.0 - exp(-1.6 * dt))

# ---------------------------------------------------------------- the run that tries this part
func _ready() -> void:
	super._ready()
	if "shrine" in OS.get_cmdline_user_args(): _play_shrine()
	if OS.get_environment("SH_BAY") != "":      # (for stills) the stoa dressed as one of its bays, with so many lamps lit
		var b := int(OS.get_environment("SH_BAY")) - 1
		sh_bay = b; _sh_dress(b)
		for i in b:
			for sfx in ["", "_m"]:
				for k in ["sh_cl", "sh_ch"]: (N["%s%d%s" % [k, i, sfx]] as Node3D).visible = true; (N["%s%d%s" % [k, i, sfx]] as Node3D).scale = Vector3.ONE
		for k in ["sh_mistS", "sh_bankS"]: ((N[k] as MeshInstance3D).material_override as ShaderMaterial).set_shader_parameter("a", 0.88)

func _play_shrine() -> void:
	var from := OS.get_environment("FROM")
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)
	_wake_now(); _open_to("U"); _gate_state(4)
	var arch := Vector3(SH_X, 1.2, SH_AZ0); var back := Vector3(SH_X, 0.7, SH_ENT + 0.1)
	if from in ["", "1"]:
		pos = Vector3(SH_X, 0, -43.6); yaw = PI; cam_t = pos
		while not flags.get("sh_arr", false) or busy: await get_tree().process_frame
		await wait(0.5)
		# the obvious plan: walk on through the arch, and again
		await _tap_wait(arch)
		print("SHRINE 1 on through the first arch: lamps ", sh_lit, ", bay ", sh_bay + 1)
		await _tap_wait(arch)
		print("SHRINE 1 on again, where the plinth is empty above and not below: lamps ", sh_lit, ", bay ", sh_bay + 1)
		await _tap_wait(Vector3(SH_CX0 + 1.2, 0.012, -50.4))      # the canal: her reflection can be sent along the walk
		print("SHRINE 1 a tap on the canal: reflection ", (refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01) if not refl_out.is_empty() else "under her")
		# then by looking: on where they agree, back where they part
		var guard := 0
		while not flags.get("sh_stoa", false) and guard < 12:
			guard += 1
			if not sh_still.is_empty():
				await _tap_wait(Vector3(SH_CX0 + 1.0, 0.012, -50.2))
				print("SHRINE 1 the sixth bay, a tap on the canal: her reflection stays at ", (sh_still.holder as Node3D).position.snapped(Vector3.ONE * 0.01), ", she at ", pos.snapped(Vector3.ONE * 0.01))
			await _tap_wait(arch if SH_BAYS[sh_bay].on else back)
		print("SHRINE 1 done: lamps ", sh_lit, ", open ", flags.get("sh_stoa", false), ", she at ", pos.snapped(Vector3.ONE * 0.01))
	get_tree().quit()
