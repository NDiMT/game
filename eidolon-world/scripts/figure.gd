class_name Figure
extends Node3D
## The wanderer (v0.3): the owner's Tripo model (assets/models/wanderer.glb, skinned, ~11k tris),
## posed and animated procedurally from a Pose, so a reflection puppet copies (or delays, or bends) it.
##  * rest pose: clavicles and upper arms lowered from the T-pose, forearms bent so the hands rest near
##    the waist; the forearms are turned about the vertical only, so the big sleeve drapes still hang.
##  * walk: hip bob and twist, thigh / calf swing, spine counter-rotation, arm sway, the head held
##    steady; idle: breathing through Spine02 and the clavicles, a slow look around; a lean into turns.
##  * cloak / scarf secondary motion in the vertex shader (post-skinning; see wanderer.gdshaderinc).
##  * a petrol hem stripe (rest-height band), dormant rune embroidery at the hood rim and the cuffs.
##  * a SEPARATE pale cloth VEIL over the marble face, on a BoneAttachment3D of the Head bone.
## One skinned draw call plus the veil.
## Bone rotations are specified as GLOBAL deltas in model space (D); each bone's local pose is
## rest * conj(D_parent^-1 * D), so e.g. the head stays steady whatever the spine does.

const VEIL := Color(0.50, 0.505, 0.50, 0.0)
const HEIGHT := 1.12                     # model units (0..1) -> metres
const FACE := Vector3(-0.004, 0.875, 0.15)

class Pose:
	var body_y := 0.0
	var lean_x := 0.0
	var lean_z := 0.0
	var sway := Vector2.ZERO
	var flare := 0.0
	var ripple := 0.0
	var phase := 0.0
	var breath := 0.0
	var head_yaw := 0.0
	var head_pitch := 0.0
	var head_roll := 0.0
	var crouch := 0.0
	var walk := 0.0

	func copy() -> Pose:
		var p := Pose.new()
		p.body_y = body_y; p.lean_x = lean_x; p.lean_z = lean_z; p.sway = sway; p.flare = flare
		p.ripple = ripple; p.phase = phase; p.breath = breath; p.head_yaw = head_yaw
		p.head_pitch = head_pitch; p.head_roll = head_roll; p.crouch = crouch; p.walk = walk
		return p

	func blend(o: Pose, t: float) -> Pose:
		var p := copy()
		p.body_y = lerpf(body_y, o.body_y, t); p.lean_x = lerpf(lean_x, o.lean_x, t); p.lean_z = lerpf(lean_z, o.lean_z, t)
		p.sway = sway.lerp(o.sway, t); p.flare = lerpf(flare, o.flare, t); p.ripple = lerpf(ripple, o.ripple, t)
		p.phase = lerpf(phase, o.phase, t); p.breath = lerpf(breath, o.breath, t)
		p.head_yaw = lerp_angle(head_yaw, o.head_yaw, t); p.head_pitch = lerpf(head_pitch, o.head_pitch, t)
		p.head_roll = lerpf(head_roll, o.head_roll, t); p.crouch = lerpf(crouch, o.crouch, t); p.walk = lerpf(walk, o.walk, t)
		return p

## tunables of the rest pose (model space: the model faces +z, its left is +x)
static var ARM_DIR := Vector3(0.20, -0.93, 0.22)     # upper arm: down, a little out and forward
static var FORE_DIR := Vector3(-0.15, -0.72, 0.66)   # forearm: forward, in and down toward the waist
static var ARM_TWIST := -1.4                       # turns the sleeve drapes outward-back
static var CLAV_DROP := 0.10

static var veil_mesh: ArrayMesh
static var body_mesh: ArrayMesh
static var model: PackedScene
static var _albedo: Texture2D
static var _normal: Texture2D

var body: Node3D
var rig: Node3D
var sk: Skeleton3D
var mesh_mi: MeshInstance3D
var veil: MeshInstance3D
var body_mat: ShaderMaterial
var veil_mat: ShaderMaterial
var pose := Pose.new()
var hem := 1.0
var runes_awake := 0
var bone := {}            # name -> index
var _rest_l := {}         # index -> Quaternion (local rest)
var _par_b := {}          # index -> Basis (parent global rest, orthonormal)
var _drv_par := {}        # driven bone -> nearest driven ancestor (or -1)
var _arm_q := {}          # side -> [upper arm delta, forearm delta]
var _tpose := false
var D := {}               # driven bone index -> global delta Quaternion (this frame)

const DRIVEN := ["Hip", "Waist", "Spine01", "Spine02", "Head", "L_Clavicle", "R_Clavicle", "L_Upperarm", "R_Upperarm",
	"L_Forearm", "R_Forearm", "L_Thigh", "R_Thigh", "L_Calf", "R_Calf", "L_Foot", "R_Foot"]

func _init(ghost := false) -> void:
	if model == null:
		model = load("res://assets/models/wanderer.glb")
		body_mesh = load("res://assets/models/wanderer_mesh.res")
		veil_mesh = _build_veil()
	body = Node3D.new()
	add_child(body)
	rig = model.instantiate()
	rig.rotation.y = PI
	rig.scale = Vector3.ONE * HEIGHT
	body.add_child(rig)
	sk = rig.find_children("*", "Skeleton3D", true, false)[0]
	mesh_mi = rig.find_children("*", "MeshInstance3D", true, false)[0]
	if _albedo == null:
		var sm := mesh_mi.mesh.surface_get_material(0) as BaseMaterial3D
		_albedo = sm.albedo_texture
		_normal = sm.normal_texture
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
	_build_arm_rest()
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
	veil.transform = head_rest.affine_inverse() * vx
	att.add_child(veil)
	if ghost:
		mesh_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	apply_pose(pose)

func _gpos(nm: String) -> Vector3:
	return sk.get_bone_global_rest(bone[nm]).origin

func _build_arm_rest() -> void:
	for s in ["L", "R"]:
		var m := Vector3(1, 1, 1) if s == "L" else Vector3(-1, 1, 1)
		var d0 := (_gpos(s + "_Forearm") - _gpos(s + "_Upperarm")).normalized()
		var d1 := (_gpos(s + "_Hand") - _gpos(s + "_Forearm")).normalized()
		var t0 := (ARM_DIR * m).normalized()
		var t1 := (FORE_DIR * m).normalized()
		var qa := _arc(d0, t0)
		qa = Quaternion(t0, ARM_TWIST * m.x) * qa
		var qf := _arc(d1, t1)
		_arm_q[s] = [qa, qf]

## dev: retune the rest pose live ("figp:ARM_DIR:x:y:z" etc. from the test hooks)
func tune(nm: String, v: Array) -> void:
	match nm:
		"ARM_DIR": ARM_DIR = Vector3(v[0], v[1], v[2])
		"FORE_DIR": FORE_DIR = Vector3(v[0], v[1], v[2])
		"ARM_TWIST": ARM_TWIST = v[0]
		"CLAV_DROP": CLAV_DROP = v[0]
		"tpose": _tpose = v[0] > 0.5
	_build_arm_rest()
	apply_pose(pose)

static func _arc(a: Vector3, b: Vector3) -> Quaternion:
	var ax := a.cross(b)
	if ax.length() < 1e-5: return Quaternion()
	return Quaternion(ax.normalized(), a.angle_to(b))

func mats() -> Array[ShaderMaterial]:
	return [body_mat, veil_mat]

func set_param(n: String, val: Variant) -> void:
	for m in mats(): m.set_shader_parameter(n, val)

## the hem stripe brightens as shrines are woken
func set_hem(k: float) -> void:
	hem = k
	set_param("glint", k)

## dormant rune embroidery: each woken shrine lights one more rune (1 = Katoptron on the hood rim)
func set_runes(n: int) -> void:
	runes_awake = n
	set_param("runes_awake", float(n))

static func _rx(a: float) -> Quaternion: return Quaternion(Vector3.RIGHT, a)
static func _ry(a: float) -> Quaternion: return Quaternion(Vector3.UP, a)
static func _rz(a: float) -> Quaternion: return Quaternion(Vector3.BACK, a)

func apply_pose(p: Pose) -> void:
	pose = p
	var c := p.crouch
	var w := p.walk
	var s := sin(p.phase)
	var s2 := cos(p.phase)
	body.position.y = p.body_y - 0.10 * c
	body.rotation = Vector3(p.lean_x - 0.30 * c, 0.0, p.lean_z)
	# model space: forward +z; a forward pitch of an upward bone is +x rotation, of a hanging bone -x
	var hip := _ry(0.10 * s * w) * _rz(0.035 * s2 * w)
	D[bone["Hip"]] = hip
	var brth := p.breath
	D[bone["Waist"]] = _ry(-0.04 * s * w) * _rx(0.05 * w + 0.25 * c)
	D[bone["Spine01"]] = _ry(-0.10 * s * w) * _rx(0.06 * w + 0.3 * c)
	D[bone["Spine02"]] = _ry(-0.17 * s * w) * _rx(0.05 * w + 0.35 * c - 0.025 * brth) * _rz(-0.02 * s2 * w)
	# the head held steady (global), looking around / tilting from the pose
	D[bone["Head"]] = _ry(p.head_yaw) * _rx(-p.head_pitch + 0.10 * c + 0.06 * w) * _rz(-p.head_roll)
	var sp := D[bone["Spine02"]] as Quaternion
	for side in ["L", "R"]:
		var sg := 1.0 if side == "L" else -1.0
		var leg := s * sg          # L leg forward when s > 0
		D[bone[side + "_Clavicle"]] = sp * _rz(-sg * (CLAV_DROP - 0.03 * brth))
		var arm_swing := -leg * 0.22 * w            # arms opposite the legs
		var q: Array = _arm_q[side]
		D[bone[side + "_Upperarm"]] = sp * _rx(-arm_swing) * (q[0] as Quaternion)
		D[bone[side + "_Forearm"]] = sp * _rx(-arm_swing * 0.6) * _ry(0.0) * (q[1] as Quaternion)
		var thigh := 0.36 * leg * w
		var knee := maxf(0.0, -sg * s2) * 0.55 * w + 0.12 * w
		D[bone[side + "_Thigh"]] = hip * _rx(-thigh - 0.5 * c)
		D[bone[side + "_Calf"]] = hip * _rx(-thigh + knee + 0.8 * c)
		D[bone[side + "_Foot"]] = hip * _rx(-thigh * 0.4)
	if _tpose:
		for nm in DRIVEN: D[bone[nm]] = Quaternion()
	for nm in DRIVEN:
		var i: int = bone[nm]
		var pi: int = _drv_par[i]
		var dp: Quaternion = D[pi] if pi >= 0 else Quaternion()
		var rel: Quaternion = dp.inverse() * (D[i] as Quaternion)
		var pb: Basis = _par_b[i]
		var loc := Quaternion(pb.inverse() * Basis(rel) * pb) * (_rest_l[i] as Quaternion)
		sk.set_bone_pose_rotation(i, loc)
	body_mat.set_shader_parameter("sway", p.sway)
	body_mat.set_shader_parameter("flare", p.flare)
	body_mat.set_shader_parameter("ripple", p.ripple)
	body_mat.set_shader_parameter("phase", p.phase)
	# the veil streams back a little with the walk and lifts with the stride
	veil_mat.set_shader_parameter("sway", p.sway * 1.6 + Vector2(0.0, p.ripple * 0.035))
	veil_mat.set_shader_parameter("phase", p.phase)
	veil_mat.set_shader_parameter("ripple", p.ripple)

# ------------------------------------------------------------------ the veil
static func _tri(st: SurfaceTool, a: Array, b: Array, c: Array, mat := 0.0) -> void:
	for p in [a, b, c]:
		st.set_color(p[1])
		st.set_uv(p[2] if p.size() > 2 else Vector2(mat, 0.0))
		st.add_vertex(p[0])

static func _build_veil() -> ArrayMesh:
	## a separate cloth sheet over the whole face, hung from inside the hood's rim
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cols := 9
	var rows := 7
	var grid := []
	for j in rows:
		var v := float(j) / (rows - 1)            # 0 top (attached), 1 hem of the veil
		var row := []
		for i in cols:
			var u := float(i) / (cols - 1) * 2.0 - 1.0
			var w := lerpf(0.100, 0.122, v)
			var x := u * w
			var y := lerpf(0.25, 0.005, v) - (1.0 - u * u) * 0.010 * v + sin(u * 9.0) * 0.005 * v
			var fold := sin(u * PI * 3.0 + 0.6) * 0.007 * v
			var z := -0.128 + u * u * 0.06 * (1.0 - v * 0.35) - v * 0.028 + fold
			var c := VEIL * (0.86 + 0.16 * (1.0 - v)) * (0.94 + 0.06 * sin(u * PI * 3.0 + 0.6))
			c.a = 0.0
			row.append([Vector3(x, y, z), c])
		grid.append(row)
	for j in rows - 1:
		for i in cols - 1:
			_tri(st, grid[j][i], grid[j + 1][i + 1], grid[j][i + 1])
			_tri(st, grid[j][i], grid[j + 1][i], grid[j + 1][i + 1])
	st.generate_normals()
	return st.commit()
