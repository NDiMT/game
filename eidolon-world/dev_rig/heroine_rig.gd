extends Node3D
## Dev / candidate: the veiled heroine (assets/models/heroine_rigged.glb), same 25-bone body skeleton as
## the re-rigged wanderer, so the game's procedural animation / clasped hands / BoneAttachment3D("Head") carry over.
## Differences to wanderer_rig.gd: the GLB is in METRES (1.7 m tall, HEIGHT defaults to 1.0), cloth chains are
## Hem* (8 skirt chains, parent Pelvis) and Veil* (VeilB0..2 down the back panel, parent Spine02; VeilL0 / VeilR0
## side flaps, parent Head); collider sizes are in metres.
## (Original header of wanderer_rig.gd follows.)
##  * A-pose bind (arms ~52 deg down, 14 deg forward), clean body weights (cloak on Hip/Pelvis with a
##    soft leg share, hood on Head/Neck, sleeves on Upperarm/Forearm/Hand), max 4 influences.
##  * cloth chains (bones "<Chain>_<k>", k = 0 at the root): Hem* (skirt tatters, parent Pelvis),
##    Sleeve* (hanging sleeve strips, parent *_Forearm), Scarf* (scarf tails, parent Spine02).
##  * the cloth is simulated by ONE SpringBoneSimulator3D (one setting per chain) with capsule
##    colliders on the pelvis, torso and legs.
##  * procedural walk / idle in the game's style (same maths as scripts/wanderer_glb.gd: bone
##    rotations are GLOBAL deltas in model space, so it works for any bind pose / bone roll).
## `legacy = true` loads the original Tripo auto-rig (T-pose bind, no cloth bones) with the same
## animation, for before/after comparisons.

const RIGGED := "res://assets/models/heroine_rigged.glb"
const LEGACY := "res://assets/models/heroine_rigged.glb"
@export var HEIGHT := 1.0               # the GLB is already in metres (1.7 m); the wanderer used 1.12 on a 1.0-unit model

## per chain kind: [stiffness, drag, gravity, joint radius, stiffness at tip (x root), drag at tip (x root)]
const SPRING := {
	"Hem": [3.2, 0.5, 0.45, 0.028, 0.55, 0.8],
	"Veil": [2.0, 0.45, 0.4, 0.025, 0.5, 0.8],
}

@export var legacy := false
@export var springs := true

# animation inputs (the game would feed these from the player controller)
var walk := 0.0          # 0 idle .. 1 full walk
var phase := 0.0         # stride phase (radians)
var breath := 0.0        # -1..1
var lean_x := 0.0
var lean_z := 0.0
var body_y := 0.0
var head_yaw := 0.0
var arm_sway := 0.0      # idle arm drift

var body: Node3D
var rig: Node3D
var sk: Skeleton3D
var mesh_mi: MeshInstance3D
var sim: SpringBoneSimulator3D
var chains := {}          # chain name -> [bone names, root first]
var bone := {}
var _rest_l := {}
var _par_b := {}
var _drv_par := {}
var _arm_q := {}
var D := {}

static var ARM_DIR := Vector3(0.24, -0.95, 0.18)   # hanging upper arm: down, a little out and forward
static var FORE_DIR := Vector3(0.20, -0.86, 0.46)  # forearm: a soft bend forward at the elbow

const DRIVEN := ["Hip", "Waist", "Spine01", "Spine02", "Head", "L_Clavicle", "R_Clavicle", "L_Upperarm", "R_Upperarm",
	"L_Forearm", "R_Forearm", "L_Thigh", "R_Thigh", "L_Calf", "R_Calf", "L_Foot", "R_Foot"]

func _ready() -> void:
	body = Node3D.new()
	add_child(body)
	rig = (load(RIGGED) as PackedScene).instantiate()
	rig.rotation.y = PI                 # the model faces +z; this node faces -z (Godot forward)
	rig.scale = Vector3.ONE * HEIGHT
	body.add_child(rig)
	sk = rig.find_children("*", "Skeleton3D", true, false)[0]
	mesh_mi = rig.find_children("*", "MeshInstance3D", true, false)[0]
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
	_find_chains()
	if springs and not chains.is_empty():
		_build_springs()
	apply_pose()

func _gpos(nm: String) -> Vector3:
	return sk.get_bone_global_rest(bone[nm]).origin

static func _arc(a: Vector3, b: Vector3) -> Quaternion:
	var axis := a.cross(b)
	if axis.length() < 1e-6: return Quaternion()
	return Quaternion(axis.normalized(), a.angle_to(b))

func _build_arm_rest() -> void:
	for s in ["L", "R"]:
		var m := Vector3(1, 1, 1) if s == "L" else Vector3(-1, 1, 1)
		var d0 := (_gpos(s + "_Forearm") - _gpos(s + "_Upperarm")).normalized()
		var d1 := (_gpos(s + "_Hand") - _gpos(s + "_Forearm")).normalized()
		_arm_q[s] = [_arc(d0, (ARM_DIR * m).normalized()), _arc(d1, (FORE_DIR * m).normalized())]

## cloth chains: bones named <Chain>_<k>
func _find_chains() -> void:
	var re := RegEx.create_from_string("^((Hem|Veil)[LRB]\\d*)_(\\d+)$")
	for nm in bone:
		var r := re.search(nm)
		if r == null: continue
		var c := r.get_string(1)
		if not chains.has(c): chains[c] = []
		chains[c].append(nm)
	for c in chains:
		chains[c].sort_custom(func(a: String, b: String) -> bool: return int(a.get_slice("_", 1)) < int(b.get_slice("_", 1)))

func chain_kind(c: String) -> String:
	for k in SPRING:
		if c.begins_with(k): return k
	return "Hem"

func _build_springs() -> void:
	sim = SpringBoneSimulator3D.new()
	sim.name = "Cloth"
	sk.add_child(sim)
	# colliders follow bones; sizes in model units (the skeleton node is scaled by HEIGHT)
	sim.add_child(_capsule("Pelvis", 0.14, 0.42, Vector3(0, -0.12, 0)))     # the skirt's inner cone (metres)
	sim.add_child(_capsule("Spine01", 0.095, 0.40, Vector3(0, 0.10, -0.01)))  # torso, under the veil panel
	for s in ["L", "R"]:
		sim.add_child(_capsule(s + "_Thigh", 0.085, 0.40, Vector3.ZERO, true))
		sim.add_child(_capsule(s + "_Calf", 0.065, 0.38, Vector3.ZERO, true))
	var names := chains.keys()
	names.sort()
	sim.setting_count = names.size()
	var i := 0
	for c in names:
		var bl: Array = chains[c]
		var cfg: Array = SPRING[chain_kind(c)]
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
		# the bone's +Y runs along the leg: centre the capsule on the bone
		var kid := bn.replace("Thigh", "Calf") if bn.ends_with("Thigh") else bn.replace("Calf", "Foot")
		var L := (_gpos(kid) - _gpos(bn)).length()
		c.position_offset = Vector3(0, L * 0.5, 0)
		c.height = maxf(h, L + 2.0 * r)
	else:
		c.position_offset = off
		# a vertical capsule: undo the bone's rest rotation
		c.rotation_offset = sk.get_bone_global_rest(bone[bn]).basis.get_rotation_quaternion().inverse()
	return c

static func _rx(a: float) -> Quaternion: return Quaternion(Vector3.RIGHT, a)
static func _ry(a: float) -> Quaternion: return Quaternion(Vector3.UP, a)
static func _rz(a: float) -> Quaternion: return Quaternion(Vector3.BACK, a)

## the procedural pose: same layering as scripts/wanderer_glb.gd
func apply_pose() -> void:
	var w := walk
	var s := sin(phase)
	var s2 := cos(phase)
	body.position.y = body_y
	body.rotation = Vector3(lean_x, 0.0, lean_z)
	# model space: forward +z; the model's left is +x
	var hip := _ry(0.10 * s * w) * _rz(0.035 * s2 * w)
	D[bone["Hip"]] = hip
	D[bone["Waist"]] = _ry(-0.04 * s * w) * _rx(0.05 * w)
	D[bone["Spine01"]] = _ry(-0.10 * s * w) * _rx(0.06 * w + 0.012 * breath)
	D[bone["Spine02"]] = _ry(-0.17 * s * w) * _rx(0.05 * w - 0.025 * breath) * _rz(-0.02 * s2 * w)
	D[bone["Head"]] = _ry(head_yaw) * _rx(0.06 * w + 0.01 * breath)      # held steady (global)
	var sp := D[bone["Spine02"]] as Quaternion
	for side in ["L", "R"]:
		var sg := 1.0 if side == "L" else -1.0
		var leg := s * sg
		D[bone[side + "_Clavicle"]] = sp * _rz(sg * 0.03 * breath)
		var arm_swing := -leg * 0.20 * w + arm_sway * sg * (1.0 - w)
		var q: Array = _arm_q[side]
		D[bone[side + "_Upperarm"]] = sp * _rx(-arm_swing) * _rz(-sg * 0.02 * breath) * (q[0] as Quaternion)
		D[bone[side + "_Forearm"]] = sp * _rx(-arm_swing * 1.3 - 0.04 * w) * (q[1] as Quaternion)
		var thigh := 0.36 * leg * w
		var knee := maxf(0.0, -sg * s2) * 0.55 * w + 0.12 * w
		D[bone[side + "_Thigh"]] = hip * _rx(-thigh)
		D[bone[side + "_Calf"]] = hip * _rx(-thigh + knee)
		D[bone[side + "_Foot"]] = hip * _rx(-thigh * 0.4)
	for nm in DRIVEN:
		var i: int = bone[nm]
		var pi: int = _drv_par[i]
		var dp: Quaternion = D[pi] if pi >= 0 else Quaternion()
		var rel: Quaternion = dp.inverse() * (D[i] as Quaternion)
		var pb: Basis = _par_b[i]
		sk.set_bone_pose_rotation(i, Quaternion(pb.inverse() * Basis(rel) * pb) * (_rest_l[i] as Quaternion))

func set_wind(v: Vector3) -> void:
	if sim: sim.external_force = v

func reset_cloth() -> void:
	if sim: sim.reset()
