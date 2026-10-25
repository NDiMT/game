class_name WandererRig
extends Node3D
## v0.8: the hero is the owner's re-rigged model (assets/models/wanderer_rigged.glb; dev_rig/README.md).
##  * A-pose bind, 25 body bones driven procedurally from a Figure.Pose (walk, idle breathing, the lean
##    and head lead of a turn, the crouch, the reach to the glass / the water, the clasped hands of a
##    reflection); bone rotations are GLOBAL deltas in model space (any bind pose / bone roll).
##  * 16 cloth chains (58 bones: hem tatters, sleeve strips, scarf tails), moved by ONE
##    SpringBoneSimulator3D with capsule colliders on the pelvis, torso and legs ("sim"), or by copying
##    another rig's simulated cloth each frame ("copy": reflections, a reflection of her), or left at
##    rest ("off": the Low tier's reflections; the shader's own cloth motion takes over).
##  * baked vertex data (tests/prep_wanderer_rigged.gd): petrol hem stripe band, dormant rune
##    embroidery at the hood rim and the cuffs, the marble face; the shader adds a light wind breath.
##  * a SEPARATE pale cloth VEIL over the marble face on a BoneAttachment3D of the Head bone.
## One skinned draw call plus the veil.

const MODEL := "res://assets/models/wanderer_rigged.glb"
const MESH := "res://assets/models/wanderer_rigged_mesh.res"
const HEIGHT := 1.12                     # model units (0..1) -> metres
const FACE := Vector3(-0.004, 0.875, 0.15)

## per chain kind: [stiffness, drag, gravity, joint radius, stiffness at tip (x root), drag at tip (x root)]
const SPRING := {
	"Hem": [3.0, 0.5, 0.45, 0.018, 0.5, 0.8],
	"Sleeve": [1.4, 0.45, 1.3, 0.014, 0.6, 0.85],
	"Scarf": [1.6, 0.42, 0.35, 0.02, 0.45, 0.8],
}
## the hanging rest of the arms (model space: the model faces +z, its left is +x)
const ARM_DIR := Vector3(0.24, -0.95, 0.18)
const FORE_DIR := Vector3(0.20, -0.86, 0.46)
## a reflection's clasped hands (like the veiled statues): upper arms forward and in, forearms across
const CLASP_ARM := Vector3(0.20, -0.80, 0.56)
const CLASP_FORE := Vector3(-0.78, 0.18, 0.60)
## the right hand reaching out (to the glass, to the water)
const REACH_ARM := Vector3(-0.10, -0.42, 0.90)
const REACH_FORE := Vector3(-0.04, -0.30, 0.95)

const DRIVEN := ["Hip", "Waist", "Spine01", "Spine02", "Head", "L_Clavicle", "R_Clavicle", "L_Upperarm", "R_Upperarm",
	"L_Forearm", "R_Forearm", "L_Thigh", "R_Thigh", "L_Calf", "R_Calf", "L_Foot", "R_Foot"]

static var model: PackedScene
static var body_mesh: ArrayMesh
static var veil_mesh: ArrayMesh
static var _albedo: Texture2D
static var _normal: Texture2D
static var sims := 0                     # (perf HUD / bench) simulated rigs alive

var body: Node3D
var rig: Node3D
var sk: Skeleton3D
var mesh_mi: MeshInstance3D
var veil: MeshInstance3D
var veil_base := Transform3D()
var body_mat: ShaderMaterial
var veil_mat: ShaderMaterial
var sim: SpringBoneSimulator3D
var cloth_mode := "off"
var cloth_src: WandererRig
var cloth_bones := PackedInt32Array()
var cloth_pose: Array[Quaternion] = []   # the simulated cloth (local rotations) after the last update
var bone := {}
var _rest_l := {}
var _par_b := {}
var _drv_par := {}
var _q := {}                             # side -> {"rest": [arm, fore], "clasp": [...], "reach": [...]}
var D := {}
var _wind_t := 0.0

func _init(ghost := false) -> void:
	if model == null:
		model = load(MODEL)
		body_mesh = load(MESH)
		veil_mesh = Figure._build_veil()
	body = Node3D.new()
	add_child(body)
	rig = model.instantiate()
	rig.rotation.y = PI                  # the model faces +z; the figure faces -z
	rig.scale = Vector3.ONE * HEIGHT
	body.add_child(rig)
	sk = rig.find_children("*", "Skeleton3D", true, false)[0]
	mesh_mi = rig.find_children("*", "MeshInstance3D", true, false)[0]
	if _albedo == null:
		# (same UVs as the Tripo model: its imported JPEG maps; the GLB's own embedded copies are discarded
		# at import, they would be Basis Universal, which the Compatibility renderer here cannot upload)
		for f in DirAccess.get_files_at("res://assets/models"):
			if f.ends_with(".jpg.import") or f.ends_with(".jpg"):
				var fn := f.trim_suffix(".import")
				if "_rgb_" in fn: _albedo = load("res://assets/models/" + fn)
				elif "_normal_" in fn: _normal = load("res://assets/models/" + fn)
	mesh_mi.mesh = body_mesh
	body_mat = ShaderMaterial.new()
	body_mat.shader = preload("res://shaders/wanderer_ghost.gdshader") if ghost else preload("res://shaders/wanderer.gdshader")
	body_mat.set_shader_parameter("albedo_tex", _albedo)
	body_mat.set_shader_parameter("normal_tex", _normal)
	mesh_mi.material_override = body_mat
	for i in sk.get_bone_count():
		bone[sk.get_bone_name(i)] = i
		_rest_l[i] = sk.get_bone_rest(i).basis.get_rotation_quaternion()
		var p := sk.get_bone_parent(i)
		_par_b[i] = sk.get_bone_global_rest(p).basis.orthonormalized() if p >= 0 else Basis()
	for nm in DRIVEN:
		var i: int = bone[nm]
		var p := sk.get_bone_parent(i)
		while p >= 0 and not DRIVEN.has(sk.get_bone_name(p)): p = sk.get_bone_parent(p)
		_drv_par[i] = p
	_build_arms()
	var re := RegEx.create_from_string("^(Hem|Sleeve|Scarf)[LR]\\d*_\\d+$")
	for i in sk.get_bone_count():
		if re.search(sk.get_bone_name(i)): cloth_bones.append(i)
	cloth_pose.resize(cloth_bones.size())
	for k in cloth_bones.size(): cloth_pose[k] = _rest_l[cloth_bones[k]]
	# the veil hangs over the marble face, carried by the head bone
	var att := BoneAttachment3D.new()
	sk.add_child(att)
	att.bone_name = "Head"
	veil_mat = ShaderMaterial.new()
	veil_mat.shader = preload("res://shaders/ghost.gdshader") if ghost else preload("res://shaders/figure.gdshader")
	veil_mat.set_shader_parameter("deform", 0.0)
	veil_mat.set_shader_parameter("veil", 1.0)
	veil = MeshInstance3D.new()
	veil.name = "Veil"
	veil.mesh = veil_mesh
	veil.material_override = veil_mat
	var head_rest := sk.get_bone_global_rest(bone["Head"])
	# the procedural veil was made for a face centred at (0, 0.14, -0.022), facing -z
	var vb := Basis(Vector3.UP, PI) * Basis.from_scale(Vector3(0.40, 0.46, 0.36))
	var vx := Transform3D(vb, FACE - vb * Vector3(0, 0.14, -0.022) + Vector3(0, -0.004, 0.012))
	veil_base = head_rest.affine_inverse() * vx
	veil.transform = veil_base
	att.add_child(veil)
	if ghost:
		mesh_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sk.skeleton_updated.connect(_snap_cloth)

func _gpos(nm: String) -> Vector3:
	return sk.get_bone_global_rest(bone[nm]).origin

static func _arc(a: Vector3, b: Vector3) -> Quaternion:
	var ax := a.cross(b)
	if ax.length() < 1e-6: return Quaternion()
	return Quaternion(ax.normalized(), a.angle_to(b))

func _build_arms() -> void:
	for s in ["L", "R"]:
		var m := Vector3(1, 1, 1) if s == "L" else Vector3(-1, 1, 1)
		var d0 := (_gpos(s + "_Forearm") - _gpos(s + "_Upperarm")).normalized()
		var d1 := (_gpos(s + "_Hand") - _gpos(s + "_Forearm")).normalized()
		var f := func(a: Vector3, b: Vector3) -> Array: return [_arc(d0, (a * m).normalized()), _arc(d1, (b * m).normalized())]
		_q[s] = {"rest": f.call(ARM_DIR, FORE_DIR), "clasp": f.call(CLASP_ARM, CLASP_FORE), "reach": f.call(REACH_ARM, REACH_FORE)}

# ------------------------------------------------------------------ cloth
## "sim": this rig simulates its own cloth; "copy": it wears `src`'s simulated cloth (a reflection);
## "off": the cloth bones stay at rest (the shader's light cloth motion only)
func set_cloth(mode: String, src: WandererRig = null) -> void:
	if mode == cloth_mode and src == cloth_src: return
	if sim and mode != "sim":
		sim.queue_free()
		sim = null
		sims -= 1
	cloth_mode = mode
	cloth_src = src
	if mode == "sim" and sim == null: _build_springs()
	if mode == "off":
		for k in cloth_bones.size(): sk.set_bone_pose_rotation(cloth_bones[k], _rest_l[cloth_bones[k]])
	# the shader's own cloth motion is only a light breath when bones carry the cloth
	_bp("bone_cloth", 0.0 if mode == "off" else 1.0)

## a body material parameter, on the x-ray pass too
func _bp(n: String, v: Variant) -> void:
	body_mat.set_shader_parameter(n, v)
	if body_mat.next_pass: (body_mat.next_pass as ShaderMaterial).set_shader_parameter(n, v)

func reset_cloth() -> void:
	if sim: sim.reset()

func set_wind(v: Vector3) -> void:
	if sim: sim.external_force = v

## after the modifiers ran (the simulated cloth is in the pose now): keep it for copies
func _snap_cloth() -> void:
	if cloth_mode != "sim": return
	for k in cloth_bones.size(): cloth_pose[k] = sk.get_bone_pose_rotation(cloth_bones[k])

func _build_springs() -> void:
	sims += 1
	sim = SpringBoneSimulator3D.new()
	sim.name = "Cloth"
	sk.add_child(sim)
	sim.add_child(_capsule("Pelvis", 0.125, 0.30, Vector3(0, -0.10, 0)))     # the skirt's inner cone
	sim.add_child(_capsule("Spine01", 0.11, 0.30, Vector3(0, 0.05, -0.01)))  # torso (scarf, sleeves)
	for s in ["L", "R"]:
		sim.add_child(_capsule(s + "_Thigh", 0.07, 0.24, Vector3.ZERO, true))
		sim.add_child(_capsule(s + "_Calf", 0.06, 0.22, Vector3.ZERO, true))
	var chains := {}
	for i in cloth_bones:
		var nm := sk.get_bone_name(i)
		var c := nm.get_slice("_", 0)
		if not chains.has(c): chains[c] = []
		chains[c].append(nm)
	var names := chains.keys()
	names.sort()
	sim.setting_count = names.size()
	var i := 0
	for c in names:
		var bl: Array = chains[c]
		bl.sort_custom(func(a: String, b: String) -> bool: return int(a.get_slice("_", 1)) < int(b.get_slice("_", 1)))
		var kind := "Hem"
		for k in SPRING:
			if (c as String).begins_with(k): kind = k
		var cfg: Array = SPRING[kind]
		sim.set_root_bone_name(i, bl[0])
		sim.set_end_bone_name(i, bl[-1])
		sim.set_extend_end_bone(i, true)
		sim.set_end_bone_direction(i, SpringBoneSimulator3D.BONE_DIRECTION_PLUS_Y)
		sim.set_end_bone_length(i, (_gpos(bl[-1]) - _gpos(bl[-2])).length() if bl.size() > 1 else 0.06)
		sim.set_stiffness(i, cfg[0])
		sim.set_drag(i, cfg[1])
		sim.set_gravity(i, cfg[2])
		sim.set_radius(i, cfg[3])
		sim.set_stiffness_damping_curve(i, _ramp(1.0, cfg[4]))
		sim.set_drag_damping_curve(i, _ramp(1.0, cfg[5]))
		sim.set_enable_all_child_collisions(i, true)
		i += 1

func _ramp(a: float, b: float) -> Curve:
	var cv := Curve.new()
	cv.add_point(Vector2(0, a))
	cv.add_point(Vector2(1, b))
	return cv

func _capsule(bn: String, r: float, h: float, off: Vector3, along_bone := false) -> SpringBoneCollisionCapsule3D:
	var c := SpringBoneCollisionCapsule3D.new()
	c.name = "Col_" + bn
	c.bone_name = bn
	c.radius = r
	c.height = h
	if along_bone:
		var kid := bn.replace("Thigh", "Calf") if bn.ends_with("Thigh") else bn.replace("Calf", "Foot")
		var L := (_gpos(kid) - _gpos(bn)).length()
		c.position_offset = Vector3(0, L * 0.5, 0)
		c.height = maxf(h, L + 2.0 * r)
	else:
		c.position_offset = off
		c.rotation_offset = sk.get_bone_global_rest(bone[bn]).basis.get_rotation_quaternion().inverse()
	return c

# ------------------------------------------------------------------ pose
static func _rx(a: float) -> Quaternion: return Quaternion(Vector3.RIGHT, a)
static func _ry(a: float) -> Quaternion: return Quaternion(Vector3.UP, a)
static func _rz(a: float) -> Quaternion: return Quaternion(Vector3.BACK, a)

func set_veil_lift(k: float) -> void:
	var piv := Vector3(0.0, 0.25, -0.13)
	var R := Basis(Vector3.RIGHT, -k * 1.9)
	veil.transform = veil_base * Transform3D(R, piv - R * piv)

func apply_pose(p: Figure.Pose, slim: float, veil_contrary: bool) -> void:
	var c := p.crouch
	var w := clampf(p.ripple, 0.0, 1.0)            # the walk (0 idle .. 1 full stride)
	var s := sin(p.phase)
	var s2 := cos(p.phase)
	body.position.y = p.body_y - 0.06 * c
	body.rotation = Vector3(p.lean_x, 0.0, p.lean_z)
	body.scale = Vector3(1.0 - slim, 1.0, 1.0 - slim * 0.5)
	var brth := p.breath
	var turn := p.lean_z                           # (signed: into the turn)
	# model space: forward +z, left +x. A forward pitch of an upward bone is +x, of a hanging bone -x
	var hip := _ry(0.10 * s * w + turn * 0.5) * _rz(0.035 * s2 * w)
	D[bone["Hip"]] = hip
	D[bone["Waist"]] = _ry(-0.04 * s * w + turn * 0.6) * _rx(0.05 * w + 0.30 * c)
	D[bone["Spine01"]] = _ry(-0.10 * s * w + turn * 0.8) * _rx(0.06 * w + 0.012 * brth + 0.38 * c)
	D[bone["Spine02"]] = _ry(-0.17 * s * w + turn * 1.0) * _rx(0.05 * w - 0.025 * brth + 0.30 * c) * _rz(-0.02 * s2 * w)
	# the head held steady (global): it looks around, leads into a turn, bows to the water
	D[bone["Head"]] = _ry(p.head_yaw + turn * 1.6) * _rx(-p.head_pitch + 0.06 * w + 0.01 * brth + 0.35 * c) * _rz(-p.head_roll)
	var sp := D[bone["Spine02"]] as Quaternion
	for side in ["L", "R"]:
		var sg := 1.0 if side == "L" else -1.0
		var leg := s * sg
		D[bone[side + "_Clavicle"]] = sp * _rz(sg * 0.03 * brth)
		var arm_swing := -leg * 0.20 * w
		var q: Dictionary = _q[side]
		var r: Array = q["rest"]
		var arm := (r[0] as Quaternion)
		var fore := (r[1] as Quaternion)
		if p.clasp > 0.001:
			arm = arm.slerp(q["clasp"][0], p.clasp)
			fore = fore.slerp(q["clasp"][1], p.clasp)
			arm_swing *= 1.0 - p.clasp
		if side == "R" and p.reach > 0.001:
			arm = arm.slerp(q["reach"][0], p.reach)
			fore = fore.slerp(q["reach"][1], p.reach)
			arm_swing *= 1.0 - p.reach
		D[bone[side + "_Upperarm"]] = sp * _rx(-arm_swing) * _rz(-sg * 0.02 * brth) * arm
		D[bone[side + "_Forearm"]] = sp * _rx(-arm_swing * 1.3 - 0.04 * w) * fore
		var thigh := 0.36 * leg * w
		var knee := maxf(0.0, -sg * s2) * 0.55 * w + 0.12 * w
		D[bone[side + "_Thigh"]] = hip * _rx(-thigh - 0.55 * c)
		D[bone[side + "_Calf"]] = hip * _rx(-thigh + knee + 1.0 * c)
		D[bone[side + "_Foot"]] = hip * _rx(-thigh * 0.4 - 0.2 * c)
	for nm in DRIVEN:
		var i: int = bone[nm]
		var pi: int = _drv_par[i]
		var dp: Quaternion = D[pi] if pi >= 0 else Quaternion()
		var rel: Quaternion = dp.inverse() * (D[i] as Quaternion)
		var pb: Basis = _par_b[i]
		sk.set_bone_pose_rotation(i, Quaternion(pb.inverse() * Basis(rel) * pb) * (_rest_l[i] as Quaternion))
	if cloth_mode == "copy" and cloth_src:
		var src := cloth_src.cloth_pose
		for k in cloth_bones.size(): sk.set_bone_pose_rotation(cloth_bones[k], src[k])
	elif cloth_mode == "sim" and sim:
		# a gentle, uneven breath of wind through the cloth
		_wind_t += 1.0 / 60.0
		var g := 0.035 + 0.025 * sin(_wind_t * 0.7) * sin(_wind_t * 0.23 + 1.0)
		sim.external_force = Vector3(0.6, 0.0, 0.8).normalized() * g
	_bp("sway", p.sway)
	_bp("flare", p.flare)
	_bp("ripple", p.ripple)
	_bp("phase", p.phase)
	# the veil streams back a little with the walk and lifts with the stride; a reflection's is out of step
	var vs := p.sway * 1.6 + Vector2(0.0, p.ripple * 0.035)
	if veil_contrary: vs = Vector2(-vs.x, vs.y * 0.6 - 0.012)
	veil_mat.set_shader_parameter("sway", vs)
	veil_mat.set_shader_parameter("veil_off", PI if veil_contrary else 0.0)
	veil_mat.set_shader_parameter("phase", p.phase)
	veil_mat.set_shader_parameter("ripple", p.ripple)
