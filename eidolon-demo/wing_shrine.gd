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

# ---------------------------------------------------------------- III.4 the first shrine
const SH_R_C := Vector3(-28.0, 0, -62.5)      # the middle of the round room, and of its pool
const SH_R_H := 4.5             # half the side of the court it stands on
const SH_R_R := 2.0             # the pool's radius
const SH_R_RING := 3.85         # the ring of low wall and columns
const SH_R_D := Vector3(-0.70711, 0, -0.70711)      # the way to the mirror from the middle: north-west
const SH_R_U := Vector3(0.70711, 0, -0.70711)       # across it, to the right as the eye sees it
const SH_R_MD := 3.62           # how far from the middle the mirror's glass stands
const SH_R_PW := 1.1            # the glass: its width...
const SH_R_PH := 2.5            # ...and its height, to the top of its round head
const SH_R_BASE := 0.22         # the step it stands on
const SH_R_VIEW := Vector3(-28.55, 0, -63.05)       # the middle of the picture while she is in the room
## the letters her reflection writes: each its width and its strokes, in a square of side 1
const SH_R_GLYPHS := {
	"F": [0.78, [[[0, 0], [0, 1]], [[0, 1], [0.78, 1]], [[0, 0.52], [0.58, 0.52]]]],
	"I": [0.34, [[[0.17, 0], [0.17, 1]]]],
	"N": [0.78, [[[0, 0], [0, 1]], [[0, 1], [0.78, 0]], [[0.78, 0], [0.78, 1]]]],
	"D": [0.78, [[[0, 0], [0, 1]], [[0, 1], [0.42, 1], [0.78, 0.7], [0.78, 0.3], [0.42, 0], [0, 0]]]],
	"M": [0.9, [[[0, 0], [0, 1]], [[0, 1], [0.45, 0.3]], [[0.45, 0.3], [0.9, 1]], [[0.9, 1], [0.9, 0]]]],
	"E": [0.72, [[[0.72, 1], [0, 1], [0, 0], [0.72, 0]], [[0, 0.52], [0.55, 0.52]]]],
}

## a kneel for a body whose rig has none of its own: the hips come down, the thighs go a little forward, the shins fold
## back under her. k: 0 standing, 1 on both knees
class ShKneel extends SkeletonModifier3D:
	var k := 0.0
	func _b(sk: Skeleton3D, n: String) -> int:
		var i := sk.find_bone("mixamorig:" + n)
		return i if i >= 0 else sk.find_bone("mixamorig_" + n)
	func _process_modification() -> void:
		var sk := get_skeleton()
		if sk == null or k <= 0.001: return
		var hp := _b(sk, "Hips"); var ul := _b(sk, "LeftUpLeg"); var ur := _b(sk, "RightUpLeg"); var ll := _b(sk, "LeftLeg"); var lr := _b(sk, "RightLeg"); var fl := _b(sk, "LeftFoot"); var fr := _b(sk, "RightFoot")
		if hp < 0 or ul < 0 or ur < 0 or ll < 0 or lr < 0 or fl < 0 or fr < 0: return
		var left := (sk.get_bone_global_rest(ul).origin - sk.get_bone_global_rest(ur).origin).normalized()
		var up := (sk.get_bone_global_rest(hp).origin - (sk.get_bone_global_rest(fl).origin + sk.get_bone_global_rest(fr).origin) * 0.5).normalized()
		var thigh := (sk.get_bone_global_rest(ll).origin - sk.get_bone_global_rest(ul).origin).length(); var shin := (sk.get_bone_global_rest(fl).origin - sk.get_bone_global_rest(ll).origin).length()
		var a_th := 0.42; var a_sh := 2.0
		var s := smoothstep(0.0, 1.0, k)
		var g := sk.get_bone_global_pose(hp)
		g.origin -= up * ((thigh * (1.0 - cos(a_th)) + shin * 0.94) * s)
		sk.set_bone_global_pose(hp, g)
		for sd in [[ul, ll, fl], [ur, lr, fr]]:
			var gu := sk.get_bone_global_pose(sd[0]); sk.set_bone_global_pose(sd[0], Transform3D(Basis(left, -a_th * s) * gu.basis, gu.origin))
			var gl := sk.get_bone_global_pose(sd[1]); sk.set_bone_global_pose(sd[1], Transform3D(Basis(left, a_sh * s) * gl.basis, gl.origin))
			var gf := sk.get_bone_global_pose(sd[2]); sk.set_bone_global_pose(sd[2], Transform3D(Basis(left, 0.9 * s) * gf.basis, gf.origin))

var sh_bay := 0            # which bay she stands in (0..7)
var sh_lit := 0            # how many of the eight lamps burn
var sh_mist: ColorRect     # the stoa's mist, over the whole picture
var sh_still := {}         # (the sixth bay) her mirrored body, standing where it stopped
var sh_ready := false      # the things of this part are built
var sh_r_up := {}           # (the shrine) her mirrored body, come up to the rim by itself
var sh_r_look := Vector2(0, -0.6)      # where the eye in the glass looks

func _init() -> void:
	super._init(); beyond = true

func _hollows() -> Array:
	return super._hollows() + [[SH_SX0 + 0.5, SH_SZ0 + 0.5, SH_SX1 - 0.5, SH_SZ1 - 0.5], [SH_R_C.x - SH_R_H + 0.5, SH_R_C.z - SH_R_H + 0.5, SH_R_C.x + SH_R_H - 0.5, SH_R_C.z + SH_R_H - 0.5]]

func _wings() -> void:
	super._wings()
	_sh_stoa(); _sh_r_room()

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
	var mp := _sh_r_mirror_at(); var meet := _sh_r_meet(); var rim := _sh_r_rim()
	objs["sh_r_mirror"] = {"at": mp + Vector3(0, 1.5, 0), "stand": _sh_r_stand(), "mark": false, "hits": [mp + Vector3(0, 0.3, 0), mp + Vector3(0, 2.9, 0)]}
	objs["sh_r_hand"] = {"at": meet, "stand": _sh_r_stand(), "mark": false, "hits": [meet, Vector3(rim.x, -0.9, rim.z)]}
	done["sh_r_mirror"] = true; done["sh_r_hand"] = true      # (until the eye has opened; until her reflection has come up)
	var cl := CanvasLayer.new(); cl.layer = 0; add_child(cl)
	sh_mist = ColorRect.new(); sh_mist.color = Color(0.93, 0.91, 0.94, 0.0); sh_mist.set_anchors_preset(Control.PRESET_FULL_RECT); sh_mist.mouse_filter = Control.MOUSE_FILTER_IGNORE; cl.add_child(sh_mist)
	sh_ready = true

func _wing_nav() -> void:
	super._wing_nav()
	rects["sh_in"] = R(SH_X - 0.4, SH_SZ1 - 0.4, SH_X + 0.4, UZ0 - 0.3)      # the landing behind the Gate and its stair
	ramps.append({"r": rects["sh_in"], "z0": -43.95, "z1": -45.91, "y0": POD_H, "y1": 0.0})
	rects["sh_walk"] = R(SH_X - 0.45, SH_IN_N - 0.5, SH_X + 0.25, SH_IN_S + 0.4)      # the walk of the stoa, between the entrance and the arch
	rects["sh_n"] = R(SH_X - 0.4, SH_R_C.z + 3.03, SH_X + 0.4, SH_IN_N - 0.5, false)      # through the arch and on to the round room, once the stoa lets her
	var c := SH_R_C      # the room: a walk round the pool, between its rim and the ring of low wall
	rects["sh_r_s"] = R(c.x - 1.9, c.z + 2.45, c.x + 1.9, c.z + 3.05); rects["sh_r_n"] = R(c.x - 1.9, c.z - 3.05, c.x + 1.9, c.z - 2.45)
	rects["sh_r_w"] = R(c.x - 3.05, c.z - 1.9, c.x - 2.45, c.z + 1.9); rects["sh_r_e"] = R(c.x + 2.45, c.z - 1.9, c.x + 3.05, c.z + 1.9)
	rects["sh_r_se"] = R(c.x + 1.75, c.z + 1.75, c.x + 2.45, c.z + 2.45); rects["sh_r_sw"] = R(c.x - 2.45, c.z + 1.75, c.x - 1.75, c.z + 2.45)
	rects["sh_r_nw"] = R(c.x - 2.45, c.z - 2.45, c.x - 1.75, c.z - 1.75); rects["sh_r_ne"] = R(c.x + 1.75, c.z - 2.45, c.x + 2.45, c.z - 1.75)
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
	await _sh_to_shrine()

func _send_reflection(pi: int, to: Vector3, sp: Vector2) -> void:
	if WL[pi] == "SH1" and not sh_still.is_empty():      # it does not come: it looks at her, and slowly shakes its head
		if busy: return
		refl_ring.position = Vector3(to.x, 0.03, to.z); refl_p = 0.0
		refl_busy += 1
		await _refl_no(sh_still)
		refl_busy -= 1
		return
	if WL[pi] == "SH2":
		if busy: return
		if flags.get("sh_r_up", false):      # her reflection waits at the rim: a tap on the water is a tap on its hand
			if not done.has("sh_r_hand"): use("sh_r_hand")
			return
		if flags.get("sh_r_eye", false):      # while the eye looks the water trembles: rings, and no one
			refl_busy += 1
			hold_id = -1; route.clear(); pending = ""
			refl_ring.position = Vector3(to.x, 0.03, to.z); refl_p = 0.0
			if not posing: face_to = Vector3(to.x, 0, to.z)
			var h := create_tween().set_trans(Tween.TRANS_SINE); h.tween_property(self, "a_headp", 0.28, 0.45); h.tween_interval(1.0); h.tween_property(self, "a_headp", 0.0, 0.5)
			await wait(0.5)
			pulse.position = Vector3(to.x, 0.03, to.z); pulse_p = 0.0
			await h.finished
			if not flags.get("sh_r_said", false): flags["sh_r_said"] = true; say("rings on the water, and no one in it")
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
	if flags.get("sh_r_eye", false):      # the eye in the glass follows her, slowly; and the pool holds no image of her
		if H.has("mir"): (H["mir"].holder as Node3D).visible = (H["mir"].holder as Node3D).scale.y > 0.03
		sh_r_look = sh_r_look.lerp(Vector2(clampf((pos - _sh_r_mirror_at()).dot(SH_R_U) / 2.2, -1.0, 1.0), -0.8), 1.0 - exp(-1.3 * dt))
		(N["sh_r_pane"] as ShaderMaterial).set_shader_parameter("look", sh_r_look)

# ---------------------------------------------------------------- III.4 the first shrine: the hand in the water
## where the mirror's glass stands; where she stands before it; the place at the pool's rim nearest to that; and the
## place on the water where the two palms meet
func _sh_r_mirror_at() -> Vector3: return SH_R_C + SH_R_D * SH_R_MD
func _sh_r_stand() -> Vector3: return SH_R_C + SH_R_D * 2.72
func _sh_r_rim() -> Vector3: return SH_R_C + SH_R_D * (SH_R_R + 0.4)
func _sh_r_meet() -> Vector3: return SH_R_C + SH_R_D * (SH_R_R - 0.1) - SH_R_U * 0.12

## the glass of the one mirror he kept. Deep in it an eye: a lid that parts (open), an iris that turns (look)
func _sh_r_pane_mat() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, cull_disabled;
uniform float open = 0.0; uniform vec2 look = vec2(0.0); uniform float time_s = 0.0; uniform float pw = 1.1; uniform float ph = 2.5;
void fragment(){
	vec2 p = vec2((UV.x - 0.5) * pw, (1.0 - UV.y) * ph);
	float yc = ph - pw * 0.5;
	if (p.y > yc && length(p - vec2(0.0, yc)) > pw * 0.5) discard;
	vec3 c = mix(vec3(0.42, 0.58, 0.68), vec3(0.79, 0.91, 0.95), p.y / ph);
	float g1 = smoothstep(0.93, 1.0, sin((p.x * 1.6 + p.y) * 2.4 + time_s * 0.22));
	float g2 = smoothstep(0.97, 1.0, sin((p.x * 1.6 + p.y) * 1.1 - time_s * 0.13 + 2.0));
	c += vec3(0.1) * g1 + vec3(0.07) * g2;
	float edge = min(min(p.x + pw * 0.5, pw * 0.5 - p.x), p.y);
	if (p.y > yc) edge = min(edge, pw * 0.5 - length(p - vec2(0.0, yc)));
	c *= 0.8 + 0.2 * smoothstep(0.0, 0.1, edge);
	vec2 q = p - vec2(0.0, ph * 0.58);
	float seen = smoothstep(0.0, 0.3, open);
	float deep = (1.0 - smoothstep(0.2, 1.0, length(q / vec2(0.72, 1.05)))) * seen;
	c = mix(c, vec3(0.2, 0.3, 0.44), deep * 0.62);
	float a = 0.37; float b = 0.17 * open;
	float lid = b * (1.0 - (q.x / a) * (q.x / a));
	float inside = smoothstep(0.0, 0.018, lid - abs(q.y)) * step(abs(q.x), a);
	vec2 ic = vec2(look.x * 0.15, look.y * 0.05);
	float ir = length(q - ic);
	vec3 iris = mix(vec3(0.74, 0.6, 0.33), vec3(0.22, 0.3, 0.42), smoothstep(0.035, 0.115, ir));
	iris = mix(iris, vec3(0.07, 0.1, 0.18), 1.0 - smoothstep(0.038, 0.052, ir));
	iris = mix(iris, vec3(0.11, 0.15, 0.26), smoothstep(0.1, 0.118, ir));
	vec3 eye = mix(vec3(0.8, 0.86, 0.9), iris, 1.0 - smoothstep(0.112, 0.126, ir));
	eye = mix(eye, vec3(1.0), (1.0 - smoothstep(0.012, 0.024, length(q - ic - vec2(-0.036, 0.042)))) * 0.75);
	eye *= 0.74 + 0.26 * smoothstep(0.0, 0.08, lid - q.y);
	float line = (1.0 - smoothstep(0.0, 0.02, abs(abs(q.y) - max(lid, 0.0)))) * step(abs(q.x), a) * smoothstep(0.0, 0.12, open);
	c = mix(c, eye, inside * 0.92);
	c = mix(c, vec3(0.12, 0.17, 0.3), line * 0.75 * (1.0 - inside * 0.5));
	ALBEDO = c;
}"""
	var m := ShaderMaterial.new(); m.shader = sh; m.set_shader_parameter("pw", SH_R_PW); m.set_shader_parameter("ph", SH_R_PH); timed.append(m)
	return m

## the round room: a round pool in a ring of low wall, with columns along its far half; on the north-west a wall with
## the mirror before it
func _sh_r_room() -> void:
	var c := SH_R_C
	var n0 := get_child_count()
	_pool_court(c.x - SH_R_H, c.z - SH_R_H, c.x + SH_R_H, c.z + SH_R_H, c.x - SH_R_R, c.z - SH_R_R, c.x + SH_R_R, c.z + SH_R_R, "stone", "PoolSkySH2")
	for ch in get_children().slice(n0):      # a round pool: the square kerb goes
		var mi := ch as MeshInstance3D
		if mi != null and mi.mesh is BoxMesh and absf((mi.mesh as BoxMesh).size.y - 0.04) < 0.001 and absf(mi.position.y - 0.02) < 0.001: remove_child(mi); mi.queue_free()
	_cs_deep_pit("PoolSkySH2", 4.6)
	tile_hole = Rect2(c.x - SH_R_R, c.z - SH_R_R, SH_R_R * 2.0, SH_R_R * 2.0); tiles(c.x - SH_R_H, c.z - SH_R_H, c.x + SH_R_H, c.z + SH_R_H, 1.0); tile_hole = Rect2()
	turned(c, [[SH_R_R * 1.432, 0.006], [SH_R_R, 0.006]], "stone", 72)      # the rim, round, over the corners of the opening
	turned(c, [[SH_R_R + 0.14, 0.012], [SH_R_R, 0.012]], "shade", 72); turned(c, [[SH_R_R + 0.5, 0.009], [SH_R_R + 0.45, 0.009]], "gold", 72); turned(c, [[SH_R_R * 1.432, 0.008], [SH_R_R * 1.432 - 0.08, 0.008]], "shade", 72)
	var dm := CylinderMesh.new(); dm.top_radius = 0.5; dm.bottom_radius = 0.5; dm.height = 0.001; dm.radial_segments = 72; dm.rings = 0; dm.cap_bottom = false
	var gm := _veil_glass(Color("d5e6e8")); gm.set_shader_parameter("veil", 0.0); gm.set_shader_parameter("alpha", 1.0)
	var gl := prim(dm, Vector3(c.x, 0.012, c.z), gm); gl.scale = Vector3(SH_R_R * 2.0, 1, SH_R_R * 2.0); gl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	N["sh_r_gm"] = gm
	W["SH2"] = {"r": [c.x - SH_R_R, c.z - SH_R_R, c.x + SH_R_R, c.z + SH_R_R], "round": true, "c": c, "rad": SH_R_R, "heads": [], "foot": {}, "far": 12.0}
	WL.append("SH2")
	# the ring: twenty-four lengths of low wall; one is left out for the way in, three where the mirror's wall stands
	for i in 24:
		if i == 6 or i in [14, 15, 16]: continue
		var a: float = TAU * float(i) / 24.0
		var sg := _sh_node(self, c + Vector3(cos(a), 0, sin(a)) * SH_R_RING); sg.rotation.y = -(a + PI * 0.5)
		blk(Vector3(-0.5, 0, -0.13), Vector3(0.5, 0.46, 0.13), "stone", sg); blk(Vector3(-0.515, 0, -0.16), Vector3(0.515, 0.1, 0.16), "shade", sg); blk(Vector3(-0.52, 0.46, -0.17), Vector3(0.52, 0.52, 0.17), "shade", sg)
		blk(Vector3(-0.34, 0.17, 0.13), Vector3(0.34, 0.39, 0.142), "shade", sg); blk(Vector3(-0.3, 0.2, 0.13), Vector3(0.3, 0.36, 0.148), "stone", sg)
	for j in [5, 6]:      # the two posts of the way in
		var a: float = TAU * (float(j) + 0.5) / 24.0; var pp := c + Vector3(cos(a), 0, sin(a)) * SH_R_RING
		blk(pp + Vector3(-0.17, 0, -0.17), pp + Vector3(0.17, 0.78, 0.17), "stone"); blk(pp + Vector3(-0.2, 0, -0.2), pp + Vector3(0.2, 0.12, 0.2), "shade"); blk(pp + Vector3(-0.2, 0.78, -0.2), pp + Vector3(0.2, 0.85, 0.2), "shade")
		ball(pp + Vector3(0, 0.97, 0), 0.12, pal("gold"))
	for j in [10, 11, 12, 17, 18, 19]:      # columns on the low wall, along the far half of the ring
		var a: float = TAU * (float(j) + 0.5) / 24.0
		column(c + Vector3(cos(a), 0.52, sin(a)) * Vector3(SH_R_RING, 1, SH_R_RING), 2.32, 0.125)
	for i in [11, 12, 13, 17, 18, 19]:      # and the beam they carry, from column to column and on to the wall of the mirror
		var a: float = TAU * float(i) / 24.0
		var sg := _sh_node(self, c + Vector3(cos(a), 0, sin(a)) * (SH_R_RING * cos(TAU / 48.0))); sg.rotation.y = -(a + PI * 0.5)
		blk(Vector3(-0.56, 2.86, -0.16), Vector3(0.56, 3.04, 0.16), "stone", sg); blk(Vector3(-0.58, 3.04, -0.19), Vector3(0.58, 3.1, 0.19), "shade", sg)
	# the wall on the north-west, and the mirror before it. (twin: as the pool shows them)
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var mn := _sh_node(both, _sh_r_mirror_at()); mn.rotation.y = PI * 0.25
		var B := func(a: Vector3, b: Vector3, p: String, col: String) -> MeshInstance3D:
			var m := blk(a, b, p, mn)
			if twin: m.material_override = under_mat(Color(col))
			return m
		B.call(Vector3(-1.5, 0, -0.5), Vector3(1.5, 3.3, -0.2), "stone", "d8ccb9")
		B.call(Vector3(-1.58, 3.3, -0.57), Vector3(1.58, 3.38, -0.13), "shade", "b9ab98")
		for e in [-1.0, 1.0]: B.call(Vector3(e * 1.34 - 0.2, 0, -0.56), Vector3(e * 1.34 + 0.2, 3.3, -0.12), "stone", "d8ccb9")      # its end piers
		B.call(Vector3(-0.86, 0, -0.2), Vector3(0.86, SH_R_BASE - 0.07, 0.34), "shade", "b9ab98"); B.call(Vector3(-0.78, SH_R_BASE - 0.07, -0.2), Vector3(0.78, SH_R_BASE, 0.26), "stone", "d8ccb9")      # the step the mirror stands on
		var yc := SH_R_BASE + SH_R_PH - SH_R_PW * 0.5
		for e in [-1.0, 1.0]: B.call(Vector3(e * (SH_R_PW * 0.5 + 0.045) - 0.045, SH_R_BASE, -0.14), Vector3(e * (SH_R_PW * 0.5 + 0.045) + 0.045, yc, 0.0), "gold", UC_GOLD)      # its bronze frame
		B.call(Vector3(-SH_R_PW * 0.5 - 0.09, SH_R_BASE, -0.14), Vector3(SH_R_PW * 0.5 + 0.09, SH_R_BASE + 0.07, 0.02), "gold", UC_GOLD)
		arch_band(Vector3(0, yc, -0.14), SH_R_PW * 0.5, SH_R_PW * 0.5 + 0.09, 0.14, false, 18)
		var ab := bb_end("gold", mn)
		var cr := ball(Vector3(0, yc + SH_R_PW * 0.5 + 0.19, -0.07), 0.1, pal("gold"), mn)
		for e in [-1.0, 1.0]: B.call(Vector3(e * (SH_R_PW * 0.5 + 0.045) - 0.07, SH_R_BASE, -0.02), Vector3(e * (SH_R_PW * 0.5 + 0.045) + 0.07, SH_R_BASE + 0.16, 0.06), "gold", UC_GOLD)      # two feet
		if twin:
			ab.material_override = under_mat(Color(UC_GOLD)); cr.material_override = under_mat(Color(UC_GOLD))
			blk(Vector3(-SH_R_PW * 0.5, SH_R_BASE, -0.11), Vector3(SH_R_PW * 0.5, yc + SH_R_PW * 0.36, -0.1), "stone", mn).material_override = under_mat(Color("a9c6d2"))      # the glass, as the pool shows it
			continue
		var pq := QuadMesh.new(); pq.size = Vector2(SH_R_PW, SH_R_PH)
		var pm := _sh_r_pane_mat(); prim(pq, Vector3(0, SH_R_BASE + SH_R_PH * 0.5, -0.1), pm, mn); N["sh_r_pane"] = pm
		# the wall's own dress: a base course, two sunk panels beside the mirror, dentils, a low gable
		blk(Vector3(-1.14, 0, -0.2), Vector3(1.14, 0.18, -0.165), "shade", mn)
		for e in [-1.0, 1.0]:
			blk(Vector3(minf(e * 0.74, e * 1.1), 0.5, -0.2), Vector3(maxf(e * 0.74, e * 1.1), 2.5, -0.188), "shade", mn); blk(Vector3(minf(e * 0.79, e * 1.05), 0.56, -0.2), Vector3(maxf(e * 0.79, e * 1.05), 2.44, -0.18), "stone", mn)
		var dx := -1.1
		while dx < 1.06:
			blk(Vector3(dx, 3.2, -0.2), Vector3(dx + 0.07, 3.27, -0.165), "shade", mn); dx += 0.16
		var pd := PrismMesh.new(); pd.size = Vector3(3.16, 0.42, 0.44)
		prim(pd, Vector3(0, 3.38 + 0.21, -0.35), pal("stone", "flat"), mn)
		ball(Vector3(0, 3.38 + 0.5, -0.35), 0.1, pal("gold"), mn)
		# his stool, against the wall
		var st := _sh_node(mn, Vector3(1.02, 0, 0.1))
		cyl(Vector3(0, 0.4, 0), 0.19, 0.19, 0.05, pal("wood"), 14, st); cyl(Vector3(0, 0.45, 0), 0.17, 0.15, 0.03, pal("crim"), 14, st)
		for k in 3: cyl(Vector3(cos(TAU * k / 3.0) * 0.13, 0, sin(TAU * k / 3.0) * 0.13), 0.028, 0.022, 0.4, pal("wood"), 6, st)
	for j in [12, 17]:      # the two columns nearest the wall, as the pool shows them
		var a: float = TAU * (float(j) + 0.5) / 24.0
		cyl(c + Vector3(cos(a) * SH_R_RING, 0.52, sin(a) * SH_R_RING), 0.125, 0.105, 2.32, under_mat(Color("d8ccb9")), 12, mroot)
	# the cloth, as it will hang over the mirror: from above the head of the frame down to a hand above the step
	var top := _sh_r_mirror_at() - SH_R_D * 0.17 + Vector3(0, SH_R_BASE + SH_R_PH + 0.15, 0)
	for twin in [false, true]:
		var cl := drape(top, SH_R_PW + 0.46, SH_R_PH + 0.2, 9, under_mat(Color(UC_CRIM)) if twin else cloth(Color("d9553a"), Color("a63a26"), 0.5))
		cl.rotation.y = PI * 0.25; cl.scale = Vector3(0.24, 0.02, 1.0); cl.visible = false
		if twin: cl.reparent(mroot, false)
		N["sh_r_cloth_m" if twin else "sh_r_cloth"] = cl
	var fold := Node3D.new(); add_child(fold); fold.visible = false; N["sh_r_fold"] = fold      # and folded, as she carries it
	blk(Vector3(-0.13, 0, -0.1), Vector3(0.13, 0.03, 0.1), "crim", fold); blk(Vector3(-0.125, 0.03, -0.095), Vector3(0.12, 0.055, 0.095), "crim2" if pals.has("crim2") else "crim", fold); blk(Vector3(-0.13, 0.055, -0.1), Vector3(0.1, 0.08, 0.09), "crim", fold)
	_sh_r_letters()
	var tip := halo(0.5, Color(1.0, 0.93, 0.72, 0.85)); tip.scale = Vector3.ONE * 0.01; tip.visible = false; add_child(tip); N["sh_r_tip"] = tip
	cypress(c + Vector3(-4.05, 0, -1.3), 2.9); cypress(c + Vector3(-1.3, 0, -4.05), 2.6); urn(c + Vector3(3.9, 0, -3.9), 1.0); urn(c + Vector3(-3.9, 0, 3.9), 1.0, "rose")
	_look_add("sh_r_stool", _sh_r_mirror_at() + SH_R_U * 1.02 - SH_R_D * 0.1, 0.5, ["a stool against the wall, worn smooth", "he sat here. the one mirror he kept was for himself"])
	_look_add("sh_r_ring", c + Vector3(cos(TAU * 2.0 / 24.0), 0, sin(TAU * 2.0 / 24.0)) * SH_R_RING, 0.55, ["a low wall, all the way round. it hides nothing", "from his stool he could see the whole room, and the way in"])
	_look_add("sh_r_post", c + Vector3(cos(TAU * 5.5 / 24.0), 0, sin(TAU * 5.5 / 24.0)) * SH_R_RING, 1.0, ["no door. two posts, and a round room", "every other glass in the house is turned, or sunk, or blinded. not this one"])

## the letters, laid on the water where the eye can read them: every stroke a line of light that lies hidden (drawn in
## to nothing) until it is written. sh_r_strokes: [its node, its length, where it begins, where it ends, which letter]
var sh_r_strokes: Array = []
func _sh_r_letters() -> void:
	var root := _sh_node(self, Vector3(0, 0.026, 0)); N["sh_r_text"] = root
	var lm := StandardMaterial3D.new(); lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; lm.albedo_color = Color(1.0, 0.97, 0.82)
	var gm := StandardMaterial3D.new(); gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; gm.albedo_color = Color(0.16, 0.24, 0.42, 0.3); gm.render_priority = 5
	var lw := 0.32; var lh := 0.54; var gap := 0.12
	var li := 0; var letter := 0
	for word in ["FIND", "ME"]:
		var total := -gap
		for ch in word: total += float(SH_R_GLYPHS[ch][0]) * lw + gap
		var base: Vector3 = SH_R_C + SH_R_D * (0.42 - 0.8 * li) - SH_R_U * (total * 0.5)
		var x := 0.0
		for ch in word:
			for st in SH_R_GLYPHS[ch][1]:
				for k in (st as Array).size() - 1:
					var a: Vector3 = base + SH_R_U * (x + float(st[k][0]) * lw) + SH_R_D * (float(st[k][1]) * lh)
					var b: Vector3 = base + SH_R_U * (x + float(st[k + 1][0]) * lw) + SH_R_D * (float(st[k + 1][1]) * lh)
					var d := b - a; var l := d.length()
					var pv := _sh_node(root, Vector3(a.x, 0, a.z) - d.normalized() * 0.02); pv.rotation.y = atan2(-d.z, d.x)
					prim(_box(Vector3(1.0, 0.002, 0.17)), Vector3(0.5, -0.003, 0), gm, pv); prim(_box(Vector3(1.0, 0.004, 0.055)), Vector3(0.5, 0, 0), lm, pv)
					pv.scale = Vector3(0.001, 1, 1); pv.visible = false
					sh_r_strokes.append([pv, l + 0.04, a, b, letter])
			x += float(SH_R_GLYPHS[ch][0]) * lw + gap; letter += 1
		li += 1; letter += 10      # (a longer breath between the words)

## the pool trembles and lets go of every image (on), or stills again
func _sh_r_water(on: bool, secs: float) -> void:
	var gm: ShaderMaterial = N["sh_r_gm"]
	var t := create_tween(); t.tween_method(func(v: float) -> void:
		gm.set_shader_parameter("wave", 1.0 + 8.0 * v); gm.set_shader_parameter("blur_px", 0.6 + 5.5 * v); gm.set_shader_parameter("veil", 0.45 * v), 0.0 if on else 1.0, 1.0 if on else 0.0, secs).set_trans(Tween.TRANS_SINE)
	await t.finished

## a body of her goes down on its knees (v: 0 standing .. 1 kneeling). A rig that has a kneel of its own plays it;
## the other gets one from ShKneel
func _sh_r_kneel(e: Dictionary, is_main: bool, v: float) -> void:
	var ap: AnimationPlayer = e.ap
	if rig_file.begins_with("ione4") and ap != null and ap.has_animation("kneel") and OS.get_environment("IONE4_CLIPS") != "0":
		if is_main: a_drop = 0.5 * v
		else:
			if ap.current_animation != "kneel": ap.play("kneel", 0.25)
			ap.speed_scale = 1.0; ap.seek(clampf(v, 0.0, 1.0) * (ap.current_animation_length - 0.06), true)
		return
	var sk: Skeleton3D = e.sk
	if sk == null: return
	var km: ShKneel = null
	for ch in sk.get_children():
		if ch is ShKneel: km = ch
	if km == null:
		km = ShKneel.new(); sk.add_child(km); sk.move_child(km, 0)
	km.k = v

## the arch is open: she goes on through it by herself, the eye ahead of her, to the way into the round room. There
## she stops. Deep in the mirror an eye opens; the pool trembles, and her reflection is gone from under her
func _sh_to_shrine() -> void:
	rects["sh_n"].on = true
	cam_focus = SH_R_VIEW + Vector3(2.33, 0, 2.33); cam_focus_on = true
	create_tween().tween_property(cam, "size", PLAY_SIZE, 3.2).set_trans(Tween.TRANS_SINE)
	await go([Vector3(SH_X, 0, SH_R_C.z + 2.75)], 1.25)
	await face(_sh_r_mirror_at())
	await wait(0.8)
	var pm: ShaderMaterial = N["sh_r_pane"]
	var ot := create_tween(); ot.tween_method(func(v: float) -> void: pm.set_shader_parameter("open", v), 0.0, 1.0, 3.8).set_trans(Tween.TRANS_SINE)
	await wait(1.5)
	flags["sh_r_eye"] = true
	if H.has("mir"): create_tween().tween_property(H["mir"].holder, "scale:y", 0.02, 0.9).set_trans(Tween.TRANS_SINE)
	await _sh_r_water(true, 2.8)
	if ot.is_running(): await ot.finished
	say("the glass is looking at me")
	done.erase("sh_r_mirror"); flags["sh_r_seen"] = true
	print("SHRINE shrine: she stands in the way in at ", pos.snapped(Vector3.ONE * 0.01), "; the eye is open, the pool trembles")

## III.4: the mirror. She takes the cloth out, swings it up and over the head of the frame; it opens and falls and
## covers the glass. The eye is blind, the water stills. Then her reflection comes up to the rim by itself, goes down on
## its knees, and lays its palm against the water from below
func _do_sh_r_mirror() -> void:
	var mp := _sh_r_mirror_at()
	await face(mp)
	if not ("cloth" in pocket):
		say("nothing to cover it with")
		await wait(0.8)
		return
	var fold: Node3D = N["sh_r_fold"]
	var h0 := pos + SH_R_D * 0.34 + Vector3(0, 1.06, 0)
	tgtL = h0 - SH_R_U * 0.1; tgtR = h0 + SH_R_U * 0.1
	fold.position = h0 + Vector3(0, -0.04, 0); fold.rotation.y = PI * 0.25; fold.scale = Vector3.ONE * 0.02; fold.visible = true
	_pocket_take("cloth")
	var a := tw(); a.tween_property(self, "a_wL", 1.0, 0.7); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(fold, "scale", Vector3.ONE, 0.6)
	await a.finished
	await wait(0.5)
	var top: Vector3 = (N["sh_r_cloth"] as Node3D).position
	var h1 := pos + SH_R_D * 0.44 + Vector3(0, 1.72, 0)
	var up := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	up.tween_property(self, "tgtL", h1 - SH_R_U * 0.17, 0.5); up.tween_property(self, "tgtR", h1 + SH_R_U * 0.17, 0.5); up.tween_property(fold, "position", h1, 0.5); up.tween_property(self, "a_headp", -0.26, 0.5); up.tween_property(fold, "scale", Vector3(1.5, 0.8, 1.1), 0.5)
	await up.finished
	var fly := create_tween().set_parallel()
	fly.tween_method(func(v: float) -> void: fold.position = h1.lerp(top, v) + Vector3(0, 0.42 * sin(PI * v), 0), 0.0, 1.0, 0.85).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	fly.tween_property(fold, "scale", Vector3(2.4, 0.5, 1.2), 0.85)
	await fly.finished
	var fall := create_tween().set_parallel()      # it opens over the head of the frame, and falls
	for k in ["sh_r_cloth", "sh_r_cloth_m"]:
		var cl: Node3D = N[k]; cl.scale = Vector3(0.24, 0.02, 1.0); cl.visible = true
		fall.tween_property(cl, "scale:x", 1.0, 0.6).set_trans(Tween.TRANS_SINE); fall.tween_property(cl, "scale:y", 1.0, 1.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	fall.tween_property(fold, "scale", Vector3(2.4, 0.02, 0.3), 0.35)
	var dn := tw(); dn.tween_property(self, "a_wL", 0.0, 0.9); dn.tween_property(self, "a_wR", 0.0, 0.9); dn.tween_property(self, "a_headp", 0.0, 0.9)
	await fall.finished
	fold.visible = false
	var sw := create_tween(); sw.tween_method(func(v: float) -> void:      # it swings a little, and hangs
		for k in ["sh_r_cloth", "sh_r_cloth_m"]:
			(N[k] as Node3D).rotation.z = 0.035 * sin(v * 9.0) * (1.0 - v); (N[k] as Node3D).scale.y = 1.0 + 0.02 * sin(v * 12.0) * (1.0 - v), 0.0, 1.0, 2.4)
	flags["sh_r_veiled"] = true; done["sh_r_mirror"] = true
	var pm: ShaderMaterial = N["sh_r_pane"]
	var ct := create_tween(); ct.tween_method(func(v: float) -> void: pm.set_shader_parameter("open", v), 1.0, 0.0, 1.0)
	await wait(1.0)
	flags["sh_r_eye"] = false
	await _sh_r_water(false, 3.4)      # the eye is blind: the water stills
	_look_add("sh_r_veiled", mp, 2.7, ["his cloth, on his glass", "it cannot look at me now"])
	await face(SH_R_C)
	await wait(0.4)
	var e: Dictionary = H["mir"]; H.erase("mir"); sh_r_up = e
	var hd: Node3D = e.holder; var rim := _sh_r_rim(); var meet := _sh_r_meet()
	hd.position = Vector3(rim.x, 1.3, rim.z); hd.rotation.y = PI * 0.25; hd.scale = Vector3(1, 0.02, 1); hd.visible = true
	(e.ap as AnimationPlayer).play("idle", 0.0); (e.ap as AnimationPlayer).speed_scale = 1.0
	var hm := _hermod(e); hm.wL = 0.0; hm.wR = 0.0; hm.bow = 0.0; hm.own = true
	create_tween().tween_property(self, "a_headp", 0.22, 0.8)
	var r1 := create_tween(); r1.tween_property(hd, "scale:y", 1.0, 0.9).set_trans(Tween.TRANS_SINE)
	await r1.finished
	var r2 := create_tween(); r2.tween_property(hd, "position:y", 0.0, 3.4).set_trans(Tween.TRANS_SINE)      # it comes up from the deep of the pool to the rim
	await r2.finished
	await wait(0.5)
	var kn := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	kn.tween_method(func(v: float) -> void: _sh_r_kneel(e, false, v), 0.0, 1.0, 1.5); kn.tween_property(hm, "bow", 0.4, 1.5)
	await kn.finished
	hm.tR = Vector3(meet.x, -0.02, meet.z)
	var pr := create_tween(); pr.tween_property(hm, "wR", 1.0, 1.1).set_trans(Tween.TRANS_SINE)
	await pr.finished
	refl_ring.position = Vector3(meet.x, 0.03, meet.z); refl_p = 0.0
	create_tween().tween_property(self, "a_headp", 0.0, 0.8)
	flags["sh_r_up"] = true; done.erase("sh_r_hand")
	print("SHRINE shrine: the cloth is over the mirror, pocket ", pocket, "; the water is still; her reflection kneels at the rim at ", hd.position.snapped(Vector3.ONE * 0.01), ", she at ", pos.snapped(Vector3.ONE * 0.01))

## III.4: the hand in the water. She kneels at the rim and lays her palm on the water; the palms meet. With one finger
## her reflection writes on the water, letter by letter: FIND ME. Then his last words, and the chapter's end
func _do_sh_r_hand() -> void:
	var rim := _sh_r_rim(); var meet := _sh_r_meet()
	await go([rim], 0.7)
	await face(SH_R_C)
	cam_focus = SH_R_C + SH_R_D * 0.7 + Vector3(2.33, 0, 2.33)
	create_tween().tween_property(cam, "size", 5.5, 2.6).set_trans(Tween.TRANS_SINE)
	var kn := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	kn.tween_method(func(v: float) -> void: _sh_r_kneel(H["main"], true, v), 0.0, 1.0, 1.5); kn.tween_property(self, "a_lean", 0.4, 1.5); kn.tween_property(self, "a_headp", 0.3, 1.5)
	await kn.finished
	tgtR = Vector3(meet.x, 0.02, meet.z)
	var hr := create_tween(); hr.tween_property(self, "a_wR", 1.0, 1.2).set_trans(Tween.TRANS_SINE)
	await hr.finished
	refl_ring.position = Vector3(meet.x, 0.03, meet.z); refl_p = 0.0      # the palms meet
	flags["sh_r_met"] = true
	print("SHRINE shrine: she kneels at the rim at ", pos.snapped(Vector3.ONE * 0.01), "; the palms meet at ", meet.snapped(Vector3.ONE * 0.01))
	await wait(2.0)
	await _sh_r_write()
	flags["sh_r_written"] = true; done["sh_r_hand"] = true
	print("SHRINE shrine: FIND ME is written on the water (", sh_r_strokes.size(), " strokes)")
	await wait(2.6)
	quote("sh_veil", "The veil was his.\nNot mine.", 5.0, true)
	await wait(7.4)
	if has_method("_ch1_finale"): await call("_ch1_finale")
	else: _end()

## her reflection writes with a finger of its left hand: each stroke grows from its beginning to its end under a small
## light, and stays
func _sh_r_write() -> void:
	var hm := _hermod(sh_r_up); var tip: Node3D = N["sh_r_tip"]
	var first: Vector3 = sh_r_strokes[0][2]
	hm.tL = Vector3(first.x, -0.03, first.z)
	tip.position = first + Vector3(0, 0.06, 0); tip.visible = true
	var st := create_tween().set_parallel().set_trans(Tween.TRANS_SINE); st.tween_property(hm, "wL", 1.0, 1.0); st.tween_property(tip, "scale", Vector3.ONE, 1.0)
	await st.finished
	var letter := 0
	for s in sh_r_strokes:
		var pv: Node3D = s[0]; var l: float = s[1]; var a: Vector3 = s[2]; var b: Vector3 = s[3]
		if int(s[4]) != letter:
			await wait(0.85 if int(s[4]) - letter > 5 else 0.3)
			letter = int(s[4])
		if _flat(tip.position, a) > 0.03:      # the finger is lifted and set down where the next stroke begins
			var mv := create_tween(); mv.tween_method(func(v: float) -> void:
				var q := tip.position.lerp(a + Vector3(0, 0.06, 0), v); tip.position = q; hm.tL = Vector3(q.x, -0.03, q.z), 0.0, 1.0, clampf(_flat(tip.position, a) / 1.4, 0.16, 0.5)).set_trans(Tween.TRANS_SINE)
			await mv.finished
		pv.visible = true
		var wt := create_tween(); wt.tween_method(func(v: float) -> void:
			pv.scale.x = maxf(l * v, 0.001)
			var q := a.lerp(b, v); tip.position = q + Vector3(0, 0.06, 0); hm.tL = Vector3(q.x, -0.03, q.z), 0.0, 1.0, maxf(l / 0.62, 0.2))
		await wt.finished
	var en := create_tween().set_parallel().set_trans(Tween.TRANS_SINE); en.tween_property(hm, "wL", 0.0, 1.2); en.tween_property(tip, "scale", Vector3.ONE * 0.01, 1.2)
	await en.finished
	tip.visible = false

## (for stills and for the run from the second station) the stoa stands solved, and she in the arch
func _sh_stoa_done() -> void:
	sh_bay = 7; sh_lit = 8; _sh_dress(7); flags["sh_arr"] = true; flags["sh_stoa"] = true; done["sh_on"] = true; done["sh_back"] = true
	for i in 8:
		for sfx in ["", "_m"]:
			for k in ["sh_cl", "sh_ch"]: (N["%s%d%s" % [k, i, sfx]] as Node3D).visible = true; (N["%s%d%s" % [k, i, sfx]] as Node3D).scale = Vector3.ONE
	for k in ["sh_mistN", "sh_bankN", "sh_mistS", "sh_bankS"]: (N[k] as Node3D).visible = false
	rects["sh_n"].on = true
	pos = Vector3(SH_X, 0, SH_IN_N); yaw = PI; cam_t = pos

## (for stills) the shrine as it stands after so many of its steps: 1 the eye open and the pool trembling, 2 the cloth
## over the mirror and her reflection kneeling at the rim, 3 she kneeling too, palm to palm, and the words written
func _sh_r_state(n: int) -> void:
	_sh_stoa_done()
	pos = _sh_r_stand() if n < 3 else _sh_r_rim(); yaw = atan2(SH_R_D.x, SH_R_D.z) if n < 2 else PI * 0.25; cam_t = pos
	var pm: ShaderMaterial = N["sh_r_pane"]; var gm: ShaderMaterial = N["sh_r_gm"]
	if n == 1:
		pm.set_shader_parameter("open", 1.0); flags["sh_r_eye"] = true; flags["sh_r_seen"] = true; done.erase("sh_r_mirror")
		gm.set_shader_parameter("wave", 9.0); gm.set_shader_parameter("blur_px", 6.1); gm.set_shader_parameter("veil", 0.45)
		if H.has("mir"): (H["mir"].holder as Node3D).scale.y = 0.02
	if n >= 2:
		for k in ["sh_r_cloth", "sh_r_cloth_m"]: (N[k] as Node3D).scale = Vector3.ONE; (N[k] as Node3D).visible = true
		flags["sh_r_veiled"] = true; flags["sh_r_up"] = true; done.erase("sh_r_hand"); _pocket_take("cloth")
		var e: Dictionary = H["mir"]; H.erase("mir"); sh_r_up = e
		var hd: Node3D = e.holder; var rim := _sh_r_rim(); var meet := _sh_r_meet()
		hd.position = Vector3(rim.x, 0, rim.z); hd.rotation.y = PI * 0.25; hd.scale = Vector3.ONE; hd.visible = true
		(e.ap as AnimationPlayer).play("idle", 0.0); (e.ap as AnimationPlayer).speed_scale = 1.0
		var hm := _hermod(e); hm.own = true; hm.bow = 0.4; hm.tR = Vector3(meet.x, -0.02, meet.z); hm.wR = 1.0; hm.wL = 0.0
		_sh_r_kneel(e, false, 1.0)
	if n >= 3:
		var meet2 := _sh_r_meet()
		_sh_r_kneel(H["main"], true, 1.0); a_lean = 0.4; a_headp = 0.3; tgtR = Vector3(meet2.x, 0.02, meet2.z); a_wR = 1.0
		for s in sh_r_strokes: (s[0] as Node3D).visible = true; (s[0] as Node3D).scale.x = float(s[1])
		done["sh_r_hand"] = true

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
	if OS.get_environment("SH_AT") != "": _sh_r_state(int(OS.get_environment("SH_AT")))      # (for stills) the shrine after so many of its steps

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
	else:
		_sh_stoa_done()
		busy = true
		await _sh_to_shrine()
		busy = false; settled.emit()
	await wait(0.6)
	# the obvious plan: the water
	await _tap_wait(SH_R_C + Vector3(0.5, 0.012, 0.6))
	print("SHRINE 2 a tap on the trembling water: reflection ", "out" if not refl_out.is_empty() else "no one", ", she at ", pos.snapped(Vector3.ONE * 0.01), ", pocket ", pocket)
	await _tap_wait(_sh_r_mirror_at() + Vector3(0, 1.4, 0))      # the mirror
	print("SHRINE 2 the mirror: veiled ", flags.get("sh_r_veiled", false), ", eye ", "open" if flags.get("sh_r_eye", false) else "blind", ", pocket ", pocket, ", her reflection at the rim ", flags.get("sh_r_up", false))
	_tap_at(SH_R_C + SH_R_D * 0.9 + Vector3(0, 0.012, 0))      # the water again: now it is her reflection's hand
	while not flags.get("sh_r_written", false): await get_tree().process_frame
	print("SHRINE 2 the hand in the water: palms met ", flags.get("sh_r_met", false), ", written ", flags.get("sh_r_written", false), ", she at ", pos.snapped(Vector3.ONE * 0.01))
	while not ended: await get_tree().process_frame
	print("SHRINE ended ", ended)
	get_tree().quit()
