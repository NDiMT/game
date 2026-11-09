class_name HeroineRig
extends Node3D
## a7 (Agent A): the heroine on a REAL rig. assets/models/heroine_v2.glb is built in Blender by
## dev_rig/tools/heroine_bl_rig.py: a humanoid skeleton (Godot SkeletonProfileHumanoid names: Hips, Spine, Chest,
## UpperChest, Neck, Head, Left/RightShoulder, UpperArm, LowerArm, Hand, UpperLeg, LowerLeg, Foot, Toes; plus a forearm
## twist bone, two finger bones per hand and 8 two-bone gown chains), bone-heat skin weights (the gown rides the chains,
## the veil the head/neck/chest), and every clip baked in: retargeted CC0 mocap (Quaternius Universal Animation Library
## 1/2, assets/anim/LICENSE.txt) and gestures keyed on mocap base poses. The gown chains are baked from the legs per frame.
##
## Here an AnimationTree (built in code, every input time-seeked by this script) blends:
##   idle <-> walk by the measured speed (the walk plays at speed / its native speed: no foot sliding; `step(side)`
##   fires on the walk's foot plants) > an idle variant > a hold layer (the right arm only: hold("lamp"/"shard"/
##   "raise_shard")) > two action slots (play(): a newer clip cross-fades over the older one).
## After the tree: a small two-bone IK layer moves the hand(s) from the clip's authored target onto the real "@"
## (play(name, {"at": p, "n": normal})), aim_hand(), the old Figure.Pose fields (reach, clasp, crouch, head, lean),
## and look_at_point() (neck + head, rate-limited).
## The public API is the old one: play / release / stop / is_playing / hold / set_locomotion / look_at_point /
## aim_hand / bone_world (old bone names still answer) / hand_node / upright_node / apply_pose / set_cloth ("copy" =
## a reflection copies its source's pose), signals step / clip_event / clip_done. Clip table: HeroineClipData
## (generated), HeroineClips (lookup).

static var VARIANT := "v1"               # (kept: W sets it; the v2 rig is the v1 porcelain heroine re-rigged)
const MODEL := "res://assets/models/heroine_v2.glb"
const MESH := "res://assets/models/heroine_v2_mesh.res"     # (dev_rig/a7/prep_heroine_v2.gd: the shader's vertex data)
const ALBEDO := "res://assets/models/heroine_v1_basecolor.jpg"
const NORMAL := "res://assets/models/heroine_v1_normal.jpg"
const UNIT := 1.7                        # her GLB's height (metres)
const HEIGHT := 1.12 / UNIT              # -> the game's 1.12 m hero
const AXIS_Z := 0.0172
const SKIN_LUM := 0.5
const CLOTH_K := 1.0

static var model: PackedScene
static var body_mesh: ArrayMesh
static var veil_mesh: ArrayMesh
static var _albedo: Texture2D
static var _normal: Texture2D
static var trail_cancel := 1.0           # (kept for the dev A/B hooks; no cloth sim any more)
static var sims := 0                     # (perf HUD) simulated rigs alive: none (the gown is baked)

## the default "@" of every targeted clip (her model space: +z forward, +x her left, metres of the 1.7 m rig)
static var AT_DEFAULT := HeroineClips.at_defaults()
static var N_DEFAULT := HeroineClips.n_defaults()

signal step(side: int)
signal clip_event(clip: String, ev: String)
signal clip_done(clip: String)

var body: Node3D
var rig: Node3D
var sk: Skeleton3D
var mesh_mi: MeshInstance3D
var veil: MeshInstance3D
var veil_base := Transform3D()
var body_mat: ShaderMaterial
var veil_mat: ShaderMaterial
var sim: Node = null
var anim: AnimationPlayer
var tree: AnimationTree
var cloth_mode := "off"
var cloth_src: HeroineRig
var bone := {}                           # name -> index
var odd := 0.0
var speed_m := 0.0                       # her speed (model m/s)
var held := ""
var veil_lift := 0.0

const SIDES := ["L", "R"]
const SIDE_NAME := {"L": "Left", "R": "Right"}
## the old skeleton's names (W's / the fx code still ask bone_world for these)
const ALIAS := {"Hip": "Hips", "Pelvis": "Hips", "BoneRoot": "Hips", "Waist": "Spine", "Spine01": "Chest", "Spine02": "UpperChest",
	"NeckTwist01": "Neck", "NeckTwist02": "Neck", "L_Clavicle": "LeftShoulder", "R_Clavicle": "RightShoulder",
	"L_Upperarm": "LeftUpperArm", "R_Upperarm": "RightUpperArm", "L_Forearm": "LeftLowerArm", "R_Forearm": "RightLowerArm",
	"L_Hand": "LeftHand", "R_Hand": "RightHand", "L_Thigh": "LeftUpperLeg", "R_Thigh": "RightUpperLeg", "L_Calf": "LeftLowerLeg",
	"R_Calf": "RightLowerLeg", "L_Foot": "LeftFoot", "R_Foot": "RightFoot", "L_ToeBase": "LeftToes", "R_ToeBase": "RightToes"}
const HOLD_BONES := ["RightShoulder", "RightUpperArm", "RightLowerArm", "RightForeTwist", "RightHand", "RightFingers1", "RightFingers2"]
const EL_MAX := 2.27                     # 130 deg: the elbow's deepest flex in the IK (deeper, the inner elbow pinches)
const SWIVEL_RATE := 6.0                 # rad/s: the elbow's swivel round the arm's line
const WALK_ON := 0.18                    # model m/s: she walks above this
const LOOK_RATE := 2.6                   # rad/s
const WR_TWIST := 1.4                    # the hand's roll on the forearm (80 deg)
const WR_SWING := 1.2                    # the wrist's bend (69 deg)

# ------------------------------------------------------------------ build
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
	anim = rig.find_children("*", "AnimationPlayer", true, false)[0]
	anim.active = false
	if _albedo == null:
		_albedo = load(ALBEDO)
		_normal = load(NORMAL)
	mesh_mi.mesh = body_mesh
	body_mat = ShaderMaterial.new()
	body_mat.shader = preload("res://shaders/wanderer_ghost.gdshader") if ghost else preload("res://shaders/wanderer.gdshader")
	body_mat.set_shader_parameter("albedo_tex", _albedo)
	body_mat.set_shader_parameter("normal_tex", _normal)
	body_mat.set_shader_parameter("unit", UNIT)
	body_mat.set_shader_parameter("axis_z", AXIS_Z)
	body_mat.set_shader_parameter("skin_lum", SKIN_LUM)
	body_mat.set_shader_parameter("cloth_k", CLOTH_K)
	body_mat.set_shader_parameter("dress", 1.0)
	body_mat.set_shader_parameter("bone_cloth", 1.0)          # (the gown rides bones: the shader's own sway stays small)
	mesh_mi.material_override = body_mat
	for i in sk.get_bone_count():
		bone[sk.get_bone_name(i)] = i
	_rest_data()
	_build_tree()
	# the old procedural face veil (hidden; her own veil is in the mesh)
	var att := BoneAttachment3D.new()
	sk.add_child(att)
	att.bone_name = "Head"
	veil_mat = ShaderMaterial.new()
	veil_mat.shader = preload("res://shaders/ghost.gdshader") if ghost else preload("res://shaders/figure.gdshader")
	veil_mat.set_shader_parameter("deform", 0.0)
	veil_mat.set_shader_parameter("veil", 1.0)
	veil = MeshInstance3D.new()
	veil.name = "Veil"
	veil.visible = false
	veil.mesh = veil_mesh
	veil.material_override = veil_mat
	att.add_child(veil)
	if ghost:
		mesh_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		veil.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

var _len := {}                           # bone -> length to its child joint (model m)
var _rest_q := {}                        # bone -> rest local rotation
var _sh_rest := {}                       # side -> the shoulder (upper arm head) at rest, model space
var _reach_t := Vector3.ZERO
var _clasp_t := {}
func _rest_data() -> void:
	for i in sk.get_bone_count():
		_rest_q[i] = sk.get_bone_rest(i).basis.get_rotation_quaternion()
	for s in SIDES:
		var n: String = SIDE_NAME[s]
		var u: int = bone[n + "UpperArm"]
		var f: int = bone[n + "LowerArm"]
		var h: int = bone[n + "Hand"]
		_len[u] = sk.get_bone_global_rest(u).origin.distance_to(sk.get_bone_global_rest(f).origin)
		_len[f] = sk.get_bone_global_rest(f).origin.distance_to(sk.get_bone_global_rest(h).origin)
		_sh_rest[s] = sk.get_bone_global_rest(u).origin
	# the Pose.reach arm (forward, a little down) and the reflections' clasped hands (at the chest)
	var sR: Vector3 = _sh_rest["R"]
	var uR: int = bone["RightUpperArm"]
	_reach_t = sR + Vector3(-0.10, -0.42, 0.90).normalized() * _len[uR] + Vector3(-0.04, -0.30, 0.95).normalized() * _len[bone["RightLowerArm"]]
	_clasp_t = {"L": Vector3(0.03, 1.22, 0.20), "R": Vector3(-0.03, 1.20, 0.21)}

# --- the AnimationTree: idle/walk > variant > hold (right arm) > action slots a0 < a1; every input seeked from here
var _tracks_prefix := ""
func _build_tree() -> void:
	var a0 := anim.get_animation("idle")
	for ti in a0.get_track_count():
		var p := str(a0.track_get_path(ti))
		if p.ends_with(":Hips"):
			_tracks_prefix = p.substr(0, p.length() - 4)
			break
	for nm in anim.get_animation_list():
		var a := anim.get_animation(nm)
		a.loop_mode = Animation.LOOP_NONE           # (every input is seeked explicitly; loops wrap here)
	var bt := AnimationNodeBlendTree.new()
	var prev := ""
	for slot in ["idle", "walk", "var", "hold", "a0", "a1"]:
		var an := AnimationNodeAnimation.new()
		an.animation = &"idle"
		bt.add_node(slot, an)
		var ts := AnimationNodeTimeSeek.new()
		bt.add_node(slot + "_t", ts)
		bt.connect_node(slot + "_t", 0, slot)
	var b := AnimationNodeBlend2.new()
	bt.add_node("loco", b)
	bt.connect_node("loco", 0, "idle_t")
	bt.connect_node("loco", 1, "walk_t")
	prev = "loco"
	for slot in ["var", "hold", "a0", "a1"]:
		var bb := AnimationNodeBlend2.new()
		if slot == "hold":
			bb.filter_enabled = true
			for bn in HOLD_BONES: bb.set_filter_path(NodePath(_tracks_prefix + bn), true)
		bt.add_node("b_" + slot, bb)
		bt.connect_node("b_" + slot, 0, prev)
		bt.connect_node("b_" + slot, 1, slot + "_t")
		prev = "b_" + slot
	bt.connect_node("output", 0, prev)
	tree = AnimationTree.new()
	tree.name = "AnimationTree"
	rig.add_child(tree)
	tree.root_node = NodePath("..")
	tree.add_animation_library("", anim.get_animation_library(""))
	tree.tree_root = bt
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	_slot_anim = {}

var _slot_anim := {}
func _set_slot(slot: String, clip: String, t: float, w: float) -> void:
	if clip != "" and _slot_anim.get(slot, "") != clip:
		_slot_anim[slot] = clip
		((tree.tree_root as AnimationNodeBlendTree).get_node(slot) as AnimationNodeAnimation).animation = StringName(clip)
	tree.set("parameters/" + slot + "_t/seek_request", maxf(t, 0.0))
	if slot != "idle" and slot != "walk":
		tree.set("parameters/b_" + slot + "/blend_amount", w)

# ------------------------------------------------------------------ layers (clip playback)
class Layer:
	var clip: Dictionary
	var name := ""
	var kind := "action"                 # idle | hold | action
	var t := 0.0
	var w := 0.0
	var fade_in := 0.25
	var fade_out := 0.3
	var out := false
	var hold := false
	var speed := 1.0
	var at: Variant = null               # Vector3 (world) or Node3D
	var n_w := Vector3.ZERO
	var fired := {}

var _layers: Array = []

## play a clip (HeroineClips): opts {"at": Vector3 world | Node3D, "n": world normal of the touched surface (toward her),
## "hold": true (wait at the clip's hold point until release()), "speed": 1.0, "fade": seconds, "from": s}. Returns its length (s).
func play(clip_name: String, opts := {}) -> float:
	if not HeroineClips.has(clip_name):
		push_warning("HeroineRig.play: no clip " + clip_name)
		return 0.0
	var c := HeroineClips.get_clip(clip_name)
	var kind := "idle" if c["idle"] else ("hold" if c["layer"] != "" else "action")
	for L in _layers:
		if (L as Layer).kind == kind and not L.out:
			L.out = true
			L.fade_out = float(opts.get("fade", c["blend"][0]))
	var L := Layer.new()
	L.clip = c
	L.name = clip_name
	L.kind = kind
	L.fade_in = float(opts.get("fade", c["blend"][0]))
	L.fade_out = c["blend"][1]
	L.hold = bool(opts.get("hold", false))
	L.speed = float(opts.get("speed", 1.0))
	L.t = float(opts.get("from", 0.0))
	L.at = opts.get("at", null)
	L.n_w = opts.get("n", Vector3.ZERO)
	_layers.append(L)
	return c["len"] / L.speed

## a held clip goes on past its hold point
func release() -> void:
	for L in _layers: if L.kind == "action": L.hold = false

## fade every action out (back to the walk / idle)
func stop(fade := 0.35) -> void:
	for L in _layers:
		if L.kind == "action" and not L.out:
			L.out = true
			L.fade_out = fade

func is_playing(clip_name := "") -> bool:
	for L in _layers:
		if L.kind == "action" and not L.out and (clip_name == "" or L.name == clip_name): return true
	return false

## an arm pose kept over the walk and the idle: "lamp", "shard", "raise_shard"; "" = let go
func hold(what: String) -> void:
	if what == held: return
	held = what
	for L in _layers:
		if L.kind == "hold" and not L.out: L.out = true
	if what == "" or not HeroineClips.has("hold_" + what): return
	play("hold_" + what)

## walk on the spot at this speed (m/s, the game's metres; she must not be moved meanwhile); NAN: measure her motion
var _virt := NAN
func set_locomotion(speed: float) -> void:
	_virt = speed

## turn the head toward a world point (Vector3.INF lets go), eased
var _look := Vector3.INF
var _look_w := 0.0
var _look_target_w := 0.0
var _look_q := Quaternion()
func look_at_point(p: Vector3, w := 1.0) -> void:
	_look = p if p != Vector3.INF else _look
	_look_target_w = w if p != Vector3.INF else 0.0

## put a hand (side "L"/"R") on a world point, the palm against the surface normal n (toward her); w 0 lets go
var _aim := {"L": [Vector3.ZERO, Vector3.ZERO, 0.0, 0.0], "R": [Vector3.ZERO, Vector3.ZERO, 0.0, 0.0]}
func aim_hand(side: String, p: Vector3, n := Vector3.ZERO, w := 1.0) -> void:
	var a: Array = _aim[side]
	if p != Vector3.INF:
		a[0] = p
		a[1] = n
	a[2] = w

func _bi(nm: String) -> int:
	if bone.has(nm): return bone[nm]
	return bone.get(ALIAS.get(nm, ""), -1)

func bone_world(nm: String) -> Vector3:
	var i := _bi(nm)
	if i < 0: return global_position
	return sk.global_transform * sk.get_bone_global_pose(i).origin

## a node that follows a hand (parent the lamp / the Shard to it); made once
var _hand_nodes := {}
func hand_node(side := "R") -> Node3D:
	if not _hand_nodes.has(side):
		var a := BoneAttachment3D.new()
		a.name = side + "_HandSocket"
		sk.add_child(a)
		a.bone_name = SIDE_NAME[side] + "Hand"
		_hand_nodes[side] = a
	return _hand_nodes[side]

## a node on a hand's palm that stays level (her up, her facing) however the wrist turns: a lamp carried on the palm
var _upright := {}
func upright_node(side := "R") -> Node3D:
	if not _upright.has(side):
		var n := Node3D.new()
		n.name = side + "_HandLevel"
		hand_node(side).add_child(n)
		_upright[side] = n
	return _upright[side]

func _level_uprights() -> void:
	var rb := rig.global_transform.basis
	for side in _upright:
		var n: Node3D = _upright[side]
		if not is_instance_valid(n): continue
		var hb := sk.get_bone_global_pose(bone[SIDE_NAME[side] + "Hand"]).basis.orthonormalized()
		n.transform = Transform3D(hb.inverse() * (sk.global_transform.basis.orthonormalized().inverse() * rb.orthonormalized()), Vector3(0, 0.05, 0))

# ------------------------------------------------------------------ cloth (kept API: the gown and the veil are baked now)
func set_cloth(mode: String, src: HeroineRig = null) -> void:
	cloth_mode = mode
	cloth_src = src

func reset_cloth() -> void:
	pass

func set_wind(_v: Vector3) -> void:
	pass

func set_veil_lift(k: float) -> void:
	veil_lift = k

func _bp(n: String, v: Variant) -> void:
	body_mat.set_shader_parameter(n, v)

# ------------------------------------------------------------------ per frame (Figure.apply_pose)
var _t := 0.0
var _frame := -1
var _prev_pos := Vector3.INF
var _prev_yaw := 0.0
var _yr := 0.0
var _gw := 0.0                           # the walk's weight
var _walk_t := 0.0
var _idle_t := 0.0
var _still := 0.0
var _idle_next := 9.0
var _idle_n := 0
var _p_last: Figure.Pose

func apply_pose(p: Figure.Pose, slim: float, veil_contrary: bool) -> void:
	var dt := 0.0
	var fr := Engine.get_process_frames()
	if fr != _frame:
		_frame = fr
		dt = minf(get_process_delta_time(), 0.1) if is_inside_tree() else 0.0
	_t += dt
	_dt = dt
	_p_last = p
	body.position = Vector3.ZERO
	body.rotation = Vector3.ZERO
	body.scale = Vector3(1.0 - slim, 1.0, 1.0 - slim * 0.5)
	var src: HeroineRig = cloth_src if (cloth_mode == "copy" and cloth_src and cloth_src != self and is_instance_valid(cloth_src) and cloth_src.is_inside_tree()) else null
	if src:
		# a reflection of her: her pose, bone for bone (its own tree idles)
		for i in sk.get_bone_count():
			sk.set_bone_pose(i, src.sk.get_bone_pose(i))
	else:
		_locomotion(dt)
		_tick_layers(dt)
		_drive_tree()
		_post(p, dt)
	if not _upright.is_empty(): _level_uprights()
	_bp("sway", p.sway * 0.35)
	_bp("flare", p.flare * 0.35)
	_bp("ripple", p.ripple * 0.5)
	_bp("phase", p.phase)
	var vs := p.sway * 1.6 + Vector2(0.0, p.ripple * 0.035)
	if veil_contrary: vs = Vector2(-vs.x, vs.y * 0.6 - 0.012)
	veil_mat.set_shader_parameter("sway", vs)
	veil_mat.set_shader_parameter("veil_off", PI if veil_contrary else 0.0)

func _locomotion(dt: float) -> void:
	var walk: Dictionary = HeroineClips.get_clip("walk")
	var Mi := rig.global_transform.affine_inverse()
	var pos := rig.global_position
	var yaw := global_transform.basis.get_euler().y
	var v := 0.0
	if not is_nan(_virt):
		v = _virt / HEIGHT
	elif _prev_pos != Vector3.INF and dt > 0.0:
		var dv := Mi.basis * ((pos - _prev_pos) / dt)
		dv.y = 0.0
		v = dv.length()
		if v > 12.0: v = 0.0                 # (a teleport)
	if dt > 0.0:
		_yr = lerpf(_yr, wrapf(yaw - _prev_yaw, -PI, PI) / dt, 1.0 - exp(-dt * 10.0))
	_prev_pos = pos
	_prev_yaw = yaw
	speed_m = lerpf(speed_m, v, 1.0 - exp(-dt * 12.0)) if dt > 0.0 else speed_m
	# turning on the spot: a few small steps
	var ve := maxf(speed_m, absf(_yr) * 0.16)
	var acting := is_playing()
	var gw_t := smoothstep(WALK_ON * 0.5, WALK_ON * 1.6, ve) if not acting else 0.0
	_gw = move_toward(_gw, gw_t, dt * (4.0 if gw_t > _gw else 3.0))
	var native: float = walk.get("speed", 0.7)
	var ln: float = walk["len"]
	var t0 := _walk_t
	if _gw > 0.0:
		_walk_t = fposmod(_walk_t + dt * maxf(ve, WALK_ON * 0.8 * _gw) / native, ln)
	# the foot plants: step(0) left, step(1) right
	var ev: Dictionary = walk["ev"]
	if _gw > 0.3:
		for e in ev:
			var te: float = ev[e]
			var crossed := (t0 < te and _walk_t >= te) if _walk_t >= t0 else (te > t0 or te <= _walk_t)
			if crossed: step.emit(0 if str(e).ends_with("_l") else 1)
	_idle_t = fposmod(_idle_t + dt, float(HeroineClips.get_clip("idle")["len"]))
	_still = _still + dt if (_gw < 0.05 and not acting) else 0.0

func _tick_layers(dt: float) -> void:
	var acting := false
	for L in _layers: if L.kind == "action" and not L.out: acting = true
	if _still > _idle_next and not _has_kind("idle"):
		_still = 0.0
		_idle_next = 9.0 + randf() * 6.0
		_idle_n += 1
		play("idle_tilt" if _idle_n % 2 == 1 else "idle_fingers")
	var i := 0
	while i < _layers.size():
		var L: Layer = _layers[i]
		var c: Dictionary = L.clip
		var ln: float = c["len"]
		if L.kind == "idle" and not L.out and (_gw > 0.15 or acting):
			L.out = true
			L.fade_out = 0.35
		var ht: float = c["hold_t"]
		if L.hold and ht >= 0.0 and L.t <= ht and L.t + dt * L.speed > ht: L.t = ht
		elif not (L.hold and ht >= 0.0 and L.t >= ht): L.t += dt * L.speed
		if c["loop"]: L.t = fposmod(L.t, ln)
		elif not L.out and L.t >= ln - L.fade_out * 0.5 and not (L.hold and ht >= ln - 0.01):
			L.out = true
		L.t = minf(L.t, ln) if not c["loop"] else L.t
		if L.out: L.w -= dt / maxf(L.fade_out, 0.01)
		else: L.w = minf(1.0, L.w + dt / maxf(L.fade_in, 0.01))
		var ev: Dictionary = c["ev"]
		for e in ev:
			if not L.fired.has(e) and L.t >= float(ev[e]):
				L.fired[e] = true
				clip_event.emit(L.name, e)
		if L.out and L.w <= 0.0:
			_layers.remove_at(i)
			clip_done.emit(L.name)
			continue
		i += 1

func _has_kind(k: String) -> bool:
	for L in _layers: if L.kind == k and not L.out: return true
	return false

## the newest two layers of a kind (older first)
func _top(kind: String, n: int) -> Array:
	var out: Array = []
	for L in _layers: if L.kind == kind: out.append(L)
	return out.slice(maxi(0, out.size() - n))

func _drive_tree() -> void:
	_set_slot("idle", "idle", _idle_t, 1.0)
	_set_slot("walk", "walk", _walk_t, 1.0)
	tree.set("parameters/loco/blend_amount", smoothstep(0.0, 1.0, _gw))
	for pair in [["var", "idle"], ["hold", "hold"]]:
		var top := _top(pair[1], 2)
		if top.is_empty():
			_set_slot(pair[0], "", 0.0, 0.0)
		else:
			# (one slot: the newest; an outgoing one under it simply fades)
			var L: Layer = top[-1]
			_set_slot(pair[0], L.name, L.t, smoothstep(0.0, 1.0, maxf(L.w, 0.0)))
	var acts := _top("action", 2)
	var slots := ["a0", "a1"]
	if acts.size() == 0:
		_set_slot("a0", "", 0.0, 0.0)
		_set_slot("a1", "", 0.0, 0.0)
	elif acts.size() == 1:
		_set_slot("a0", "", 0.0, 0.0)
		_set_slot("a1", acts[0].name, acts[0].t, smoothstep(0.0, 1.0, maxf(acts[0].w, 0.0)))
	else:
		var lo: Layer = acts[0]
		var hi: Layer = acts[1]
		var wh := smoothstep(0.0, 1.0, maxf(hi.w, 0.0))
		# an older clip under a newer one keeps its weight whole while the newer fades in (no dip to the base pose)
		var wl := minf(1.0, smoothstep(0.0, 1.0, maxf(lo.w, 0.0)) + wh)
		_set_slot(slots[0], lo.name, lo.t, wl)
		_set_slot(slots[1], hi.name, hi.t, wh)
	tree.advance(0.0)

# ------------------------------------------------------------------ after the tree: targets, aims, the old Pose fields, the look
func _post(p: Figure.Pose, dt: float) -> void:
	var Msk := sk.global_transform.affine_inverse()     # world -> skeleton (= her model space)
	# the clip's hands from their authored "@" onto the real one
	for L in _layers:
		if L.kind != "action" or L.at == null: continue
		var c: Dictionary = L.clip
		if not c.has("ik"): continue
		var lw := smoothstep(0.0, 1.0, maxf(L.w, 0.0))
		if lw <= 0.0: continue
		var at_w: Vector3 = (L.at as Node3D).global_position if L.at is Node3D else L.at
		if L.at is Node3D and not is_instance_valid(L.at): continue
		var at_m := Msk * at_w
		var d: Vector3 = at_m - (c["at"] as Vector3)
		var nq := Quaternion()
		if L.n_w != Vector3.ZERO and c.has("n"):
			nq = RigIK.arc(-(c["n"] as Vector3).normalized(), -(Msk.basis * L.n_w).normalized())
		for ik in c["ik"]:
			var tt: Array = ik["t"]
			var k := lw * _env(L.t, tt)
			if k <= 0.001: continue
			_arm_to(ik["side"], (ik["hand"] as Vector3) + d, k, nq, 1.0)
	# W's direct aims
	for s in SIDES:
		var a: Array = _aim[s]
		a[3] = move_toward(a[3], a[2], dt * 2.5)
		if a[3] <= 0.0: continue
		var k := smoothstep(0.0, 1.0, a[3])
		var nq := Quaternion()
		if (a[1] as Vector3) != Vector3.ZERO:
			var hb := sk.get_bone_global_pose(bone[SIDE_NAME[s] + "Hand"]).basis.orthonormalized()
			var palm := (hb * (Vector3.RIGHT if s == "L" else Vector3.LEFT)).normalized()
			nq = RigIK.arc(palm, -(Msk.basis * (a[1] as Vector3)).normalized())
		_arm_to(s, Msk * (a[0] as Vector3), k, nq, 0.0)
	# the old Pose fields: reach (right arm ahead), clasp (hands at the chest), crouch, lean, head
	if p.reach > 0.001: _arm_to("R", _reach_t, clampf(p.reach, 0.0, 1.0), Quaternion(), 0.5)
	if p.clasp > 0.001:
		for s in SIDES: _arm_to(s, _clasp_t[s], clampf(p.clasp, 0.0, 1.0), Quaternion(), 0.5)
	if p.crouch > 0.001 or absf(p.lean_x) > 0.001 or absf(p.lean_z) > 0.001:
		var c := clampf(p.crouch, 0.0, 1.0)
		var hp := sk.get_bone_pose_position(bone["Hips"])
		sk.set_bone_pose_position(bone["Hips"], hp + Vector3(0.0, -0.20 * c, -0.02 * c))
		_turn_local("Spine", Vector3(0.30 * c - p.lean_x * 0.4, 0.0, -p.lean_z * 0.8))
	# the look (and W's head channels)
	_look_w = move_toward(_look_w, _look_target_w, dt * 2.0)
	var want := Quaternion()
	var hi: int = bone["Head"]
	if _look_w > 0.0 and _look != Vector3.INF:
		var hg := sk.get_bone_global_pose(hi)
		var fwd := (hg.basis * Vector3.BACK).normalized()
		var to := (Msk * _look) - hg.origin
		if to.length() > 0.05:
			var q := RigIK.arc(fwd, to.normalized())
			var ang := minf(q.get_angle(), 1.25)
			if q.get_angle() > 1e-4: want = Quaternion(q.get_axis(), ang * _look_w)
	_look_q = _look_q.slerp(want, minf(1.0, dt * LOOK_RATE * 2.0)) if dt > 0.0 else _look_q
	var hq := Quaternion.from_euler(Vector3(-p.head_pitch, p.head_yaw + p.lean_z * 1.6, -p.head_roll))
	if _look_q.get_angle() > 1e-4 or hq.get_angle() > 1e-4:
		_turn_global("Neck", Quaternion().slerp(_look_q, 0.4))
		_turn_global("Head", Quaternion().slerp(_look_q, 0.6))
		_turn_local("Head", hq.get_euler())

static func _env(t: float, tt: Array) -> float:
	if t <= tt[0] or t >= tt[3]: return 0.0
	if t < tt[1]: return smoothstep(tt[0], tt[1], t)
	if t > tt[2]: return 1.0 - smoothstep(tt[2], tt[3], t)
	return 1.0

## rotate a bone by a skeleton-space rotation about its own joint (children follow)
func _turn_global(nm: String, q: Quaternion) -> void:
	var i: int = bone[nm]
	var par := sk.get_bone_parent(i)
	var pg := sk.get_bone_global_pose(par) if par >= 0 else Transform3D()
	var g := sk.get_bone_global_pose(i)
	var nb := Basis(q) * g.basis
	sk.set_bone_pose_rotation(i, (pg.basis.orthonormalized().inverse() * nb).get_rotation_quaternion())

## rotate a bone by euler angles (x pitch, y yaw, z roll) in her model frame, applied at the bone
func _turn_local(nm: String, e: Vector3) -> void:
	if e.length_squared() < 1e-8: return
	_turn_global(nm, Quaternion.from_euler(e))

var _pole_prev := {"L": Vector3.ZERO, "R": Vector3.ZERO}
var _pole_frame := {"L": -9, "R": -9}
var _dt := 0.0

static func _hframe(y_dir: Vector3, hx: Vector3) -> Quaternion:
	var y := y_dir.normalized()
	var x := (hx - y * hx.dot(y)).normalized()
	return Basis(x, y, x.cross(y)).get_rotation_quaternion()

## the two-bone arm IK: the wrist toward tgt (skeleton space) by weight k; the elbow keeps the clip's plane;
## nq turns the hand (palm onto a surface); the twist bone takes half the hand's roll
func _arm_to(s: String, tgt: Vector3, k: float, nq: Quaternion, anim_pole: float) -> void:
	var n: String = SIDE_NAME[s]
	var u: int = bone[n + "UpperArm"]
	var f: int = bone[n + "LowerArm"]
	var h: int = bone[n + "Hand"]
	var tw: int = bone[n + "ForeTwist"]
	var Gp := sk.get_bone_global_pose(sk.get_bone_parent(u))
	var Gu := sk.get_bone_global_pose(u)
	var Gf := sk.get_bone_global_pose(f)
	var Gh := sk.get_bone_global_pose(h)
	var S := Gu.origin
	var E := Gf.origin
	var l1: float = _len[u]
	var l2: float = _len[f]
	# solved to the full target, then the arm's rotations are eased in by k (continuous from the clip's own arm)
	# the elbow keeps the clip's side, eased onto out-down-back where the clip's arm runs straight at the target
	var dn := (tgt - S).normalized()
	var sg := 1.0 if s == "L" else -1.0
	# the elbow: an anatomical side for the target's direction (out, down and back; out and down for a hand behind
	# her), with the clip's own elbow kept where a clip drives the arm (anim_pole 1)
	var uc: int = bone["UpperChest"]
	var cb := sk.get_bone_global_pose(uc).basis.orthonormalized() * sk.get_bone_global_rest(uc).basis.orthonormalized().inverse()
	var behind := smoothstep(-0.15, 0.35, -(cb.inverse() * dn).z)
	var anat := cb * Vector3(0.75 * sg, -0.45, -0.45).lerp(Vector3(0.9 * sg, -0.15, -0.4), behind)
	# ... half of it the least-twist side: the rest arm swung onto the target's line (its back, -Z, is the elbow's side)
	var R0 := Gp.basis.orthonormalized() * sk.get_bone_rest(u).basis.orthonormalized()
	var zs := RigIK.arc(R0.y.normalized(), dn) * -R0.z
	anat = (anat.normalized() + zs.normalized() * (1.0 - behind)).normalized()
	var pv := RigIK.pole(dn, (E - S).normalized() * anim_pole + anat * (1.0 - anim_pole * 0.7), anat * 0.3)
	pv = (pv - dn * pv.dot(dn)).normalized()
	# the elbow swivels round the arm's line no faster than a real arm (a straight arm's pole is unsteady)
	var pp: Vector3 = _pole_prev[s]
	if pp != Vector3.ZERO and _frame == _pole_frame[s] + 1:
		pp = (pp - dn * pp.dot(dn)).normalized()
		var ang := pp.angle_to(pv)
		var mx := SWIVEL_RATE * maxf(_dt, 1.0 / 120.0)
		if ang > mx and pp.cross(pv).length() > 1e-5:
			pv = pp.rotated(pp.cross(pv).normalized(), mx)
	_pole_prev[s] = pv
	_pole_frame[s] = _frame
	var r := RigIK.solve2(S, l1, l2, tgt, pv, EL_MAX)
	var E2: Vector3 = r[0]
	var W2: Vector3 = r[1]
	var hx: Vector3 = r[2]
	# hinge frames: bone X = the bend axis (as the rest rolls), so the elbow only flexes and the upper arm's own
	# twist follows the elbow's plane
	var qu0 := Gu.basis.get_rotation_quaternion()
	var qf0 := Gf.basis.get_rotation_quaternion()
	var qh0 := Gh.basis.get_rotation_quaternion()
	var qu := qu0.slerp(_hframe(E2 - S, hx), k)
	var qf := qf0.slerp(_hframe(W2 - E2, hx), k)
	var Bu := Basis(qu)
	var Bf := Basis(qf)
	var Bh: Basis
	# the hand rides the forearm's change (continuous; a world-kept hand wrung the wrist past its range), turned by nq
	Bh = Basis(Quaternion().slerp(nq, k) * (qf * qf0.inverse()) * qh0)
	sk.set_bone_pose_rotation(u, (Gp.basis.orthonormalized().inverse() * Bu).get_rotation_quaternion())
	sk.set_bone_pose_rotation(f, (Bu.inverse() * Bf).get_rotation_quaternion())
	var hl := (Bf.inverse() * Bh).get_rotation_quaternion()
	# the wrist's limits (a hand never folds or wrings past what a wrist can)
	var lim := RigIK.limit((_rest_q[h] as Quaternion).inverse() * hl, Vector3.UP, WR_TWIST, WR_SWING)
	hl = (_rest_q[h] as Quaternion) * Quaternion(Vector3.UP, lim[1]) * (lim[0] as Quaternion)
	sk.set_bone_pose_rotation(h, hl)
	# the forearm twist bone: half the hand's roll about the forearm (rest-relative)
	var rel: Quaternion = (_rest_q[h] as Quaternion).inverse() * hl
	var twa := RigIK.twist(rel, Vector3.UP)
	sk.set_bone_pose_rotation(tw, (_rest_q[tw] as Quaternion) * Quaternion(Vector3.UP, twa * 0.5))
