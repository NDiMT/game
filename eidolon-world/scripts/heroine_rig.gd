class_name HeroineRig
extends Node3D
## v0.9: the hero is the veiled HEROINE (assets/models/heroine_rigged.glb: the same 25 body bones as the
## re-rigged wanderer, whose rig this is, adapted; the wanderer's files are kept, unused). She wears a GREY
## dress and a veil; her reflections wear the same dress in deep crimson (`red`, set on the reflections).
## Her GLB is in metres (1.7 m tall): scaled to HEIGHT; the hero shaders run their cloth maths in 0..1
## units (`unit` 1.7). Her own veil is part of the mesh, carried by spring chains (Veil*); the old
## procedural face veil is kept as a hidden node (the finale's veil lift also lifts her veil's side flaps).
## (The wanderer's header follows.)
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

## v1.0 (Agent A): two heroines. VARIANT "v0.9" (the grey dress and veil, default until W switches) and "v1" (the
## porcelain statue-woman: a blank mirror-oval face, cracked marble arms, a dark veil to the floor, a grey gauze
## gown; dev_rig/tools/heroine_v1_rig.py). Set HeroineRig.VARIANT = "v1" BEFORE the first HeroineRig is made.
## v1 also turns on the "oddness" layer (odd = 1): a slow unnatural head tilt, the hands twitching now and then,
## and a hovering glide in the walk (less bob, softer knees, a slight float).
static var VARIANT := "v0.9"
const V1 := {"model": "res://assets/models/heroine_v1_rigged.glb", "mesh": "res://assets/models/heroine_v1_mesh.res",
	"albedo": "res://assets/models/heroine_v1_basecolor.jpg", "normal": "res://assets/models/heroine_v1_normal.jpg",
	"axis_z": 0.0171, "face": Vector3(0.0, 1.6, 0.08), "skin_lum": 0.5, "cloth_k": 1.0, "odd": 1.0}
const MODEL := "res://assets/models/heroine_rigged.glb"
const MESH := "res://assets/models/heroine_mesh.res"          # (tests/prep_heroine.gd: the shader's vertex data)
const ALBEDO := "res://assets/models/heroine_basecolor.jpg"
const NORMAL := "res://assets/models/heroine_normal.jpg"
const UNIT := 1.7                        # her GLB's height (metres)
const HEIGHT := 1.12 / UNIT              # -> the game's 1.12 m hero
const AXIS_Z := 0.0308                   # her body axis (z, in units of UNIT)
const FACE := Vector3(0.0, 1.56, 0.06)

## per chain kind: [stiffness, drag, gravity, joint radius, stiffness at tip (x root), drag at tip (x root)]
const SPRING := {
	"Hem": [4.5, 0.6, 1.2, 0.028, 0.6, 0.85],
	"Veil": [3.0, 0.7, 2.5, 0.02, 0.6, 0.85],
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

const DRIVEN := ["Hip", "Waist", "Spine01", "Spine02", "NeckTwist01", "Head", "L_Clavicle", "R_Clavicle", "L_Upperarm", "R_Upperarm",
	"L_Forearm", "R_Forearm", "L_Hand", "R_Hand", "L_Thigh", "R_Thigh", "L_Calf", "R_Calf", "L_Foot", "R_Foot"]

static var model: PackedScene
static var body_mesh: ArrayMesh
static var veil_mesh: ArrayMesh
static var _albedo: Texture2D
static var _normal: Texture2D
static var trail_cancel := 1.0          # (a3) x the gown's trail cancelling (0 = the old long trail; dev A/B)
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
var cloth_src: HeroineRig
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
	var v1 := VARIANT == "v1"
	if model == null:
		model = load(V1["model"] if v1 else MODEL)
		body_mesh = load(V1["mesh"] if v1 else MESH)
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
		# (her JPEG maps, taken out of the GLB: its embedded copies would be Basis Universal, which the
		# Compatibility renderer here cannot upload; the GLB import keeps none)
		_albedo = load(V1["albedo"] if v1 else ALBEDO)
		_normal = load(V1["normal"] if v1 else NORMAL)
	mesh_mi.mesh = body_mesh
	body_mat = ShaderMaterial.new()
	body_mat.shader = preload("res://shaders/wanderer_ghost.gdshader") if ghost else preload("res://shaders/wanderer.gdshader")
	body_mat.set_shader_parameter("albedo_tex", _albedo)
	body_mat.set_shader_parameter("normal_tex", _normal)
	body_mat.set_shader_parameter("unit", UNIT)
	body_mat.set_shader_parameter("axis_z", V1["axis_z"] if v1 else AXIS_Z)
	if v1:
		body_mat.set_shader_parameter("skin_lum", V1["skin_lum"])      # (her pale porcelain skin: the baked mask x brightness)
		body_mat.set_shader_parameter("cloth_k", V1["cloth_k"])        # (a readable mid grey gown)
		odd = V1["odd"]
	body_mat.set_shader_parameter("dress", 1.0)
	mesh_mi.material_override = body_mat
	for i in sk.get_bone_count():
		bone[sk.get_bone_name(i)] = i
		_rest_l[i] = sk.get_bone_rest(i).basis.get_rotation_quaternion()
		var p := sk.get_bone_parent(i)
		_par_b[i] = sk.get_bone_global_rest(p).basis.orthonormalized() if p >= 0 else Basis()
	if _drv_idx.is_empty():
		for nm in DRIVEN: _drv_idx.append(bone[nm])
	for i in _drv_idx:
		var p := sk.get_bone_parent(i)
		while p >= 0 and not DRIVEN.has(sk.get_bone_name(p)): p = sk.get_bone_parent(p)
		_drv_par[i] = p
	_build_arms()
	var re := RegEx.create_from_string("^(Hem|Veil)[LRB]\\d*_\\d+$")
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
	veil.visible = false                 # (her own veil is in the mesh)
	veil.mesh = veil_mesh
	veil.material_override = veil_mat
	var head_rest := sk.get_bone_global_rest(bone["Head"])
	# the procedural veil was made for a face centred at (0, 0.14, -0.022), facing -z
	var vb := Basis(Vector3.UP, PI) * Basis.from_scale(Vector3(0.40, 0.46, 0.36))
	var face: Vector3 = V1["face"] if v1 else FACE
	var vx := Transform3D(vb, face - vb * Vector3(0, 0.14, -0.022) + Vector3(0, -0.004, 0.012))
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
func set_cloth(mode: String, src: HeroineRig = null) -> void:
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
	# (sizes in her units: metres before the HEIGHT scale)
	sim.add_child(_capsule("Pelvis", 0.14, 0.42, Vector3(0, -0.12, 0)))     # the skirt's inner cone
	sim.add_child(_capsule("Spine01", 0.08, 0.40, Vector3(0, 0.10, 0.0)))   # torso, under the veil's back panel
	for s in ["L", "R"]:
		sim.add_child(_capsule(s + "_Thigh", 0.085, 0.40, Vector3.ZERO, true))
		sim.add_child(_capsule(s + "_Calf", 0.065, 0.38, Vector3.ZERO, true))
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
## v3 (Agent A) THE ANIMATION LAYER. Her body is solved every frame from CHANNELS (scripts/fx/heroine_clips.gd):
##  * a procedural base: a planted-foot walk (feet locked to the floor while in stance, the step length and cadence
##    from her REAL speed, measured from her node: no foot sliding at any speed, in any direction; a turn on the spot
##    steps round; she squares her feet up when she stops), the hips riding on what the legs can reach, pelvis and
##    shoulder counter-rotation, the lean of starting / stopping (a spring: a small overshoot), breath, a slow weight
##    shift, and the oddness (a lingering head tilt, the hands twitching);
##  * hand-keyed clips over it (Catmull-Rom in time, eased jerks), on three layers: idle variants < holds < actions;
##  * two-bone IK (legs always; arms by weight) with palm aiming. Reflections (set_cloth(_, player)) copy her walk
##    and clips, so a mirror double moves exactly as she does.
## API (all on Figure.rig):
##   rig.play("reach", {"at": world_point, "n": surface_normal, "hold": true})  -> seconds;  rig.release(); rig.stop()
##   rig.hold("lamp" | "shard" | "")      an arm pose kept over the walk (the lamp raised, the Shard held)
##   rig.set_locomotion(m_per_s)          walk on the spot (a cinematic puppet that is not moved); NAN = measured
##   rig.look_at_point(p, w)  rig.aim_hand("R", p, n, w)  rig.hand_node("R")  rig.bone_world("Head")
##   signals: step(side), clip_event(clip, ev), clip_done(clip)
signal step(side: int)
signal clip_event(clip: String, ev: String)
signal clip_done(clip: String)

static func _rx(a: float) -> Quaternion: return Quaternion(Vector3.RIGHT, a)
static func _ry(a: float) -> Quaternion: return Quaternion(Vector3.UP, a)
static func _rz(a: float) -> Quaternion: return Quaternion(Vector3.BACK, a)
static func _qe(e: Vector3) -> Quaternion: return _ry(e.y) * _rx(e.x) * _rz(e.z)

var veil_lift := 0.0
func set_veil_lift(k: float) -> void:
	veil_lift = k
	var piv := Vector3(0.0, 0.25, -0.13)
	var R := Basis(Vector3.RIGHT, -k * 1.9)
	veil.transform = veil_base * Transform3D(R, piv - R * piv)

const SIDES := ["L", "R"]
var _drv_idx: PackedInt32Array = PackedInt32Array()                 # the driven bones' indices
## the "oddness" layer, 0..1 (1 on the v1 heroine). Unnatural and slow, never busy.
var odd := 0.0
var _odd_seed := randf() * 100.0
var _t := 0.0                            # the rig's clock (process time: right under --fixed-fps too)
var _frame := -1
func _odd_t() -> float: return _t + _odd_seed
## a twitch now and then: 0 most of the time, a quick 0..1..0 pulse every few seconds (irregular)
static func _twitch(t: float, period: float, k: float) -> float:
	var cyc := floorf(t / period)
	var hv := sin(cyc * 12.9898 + k * 78.233) * 43758.5453
	var h := hv - floorf(hv)
	if h < 0.45: return 0.0
	var u := (t - cyc * period - h * period * 0.5) / 0.18
	return maxf(0.0, 1.0 - absf(u * 2.0 - 1.0)) if u > 0.0 and u < 1.0 else 0.0

# ---- rest data (model space, metres of the 1.7 m rig)
var P0 := {}
var _bi := {}                            # short names -> bone index
var _leg_l := Vector2.ZERO               # thigh, shin
var _arm_l := Vector2.ZERO               # upper arm, forearm
const PALM0 := [Vector3(-0.7, -0.7, 0.0), Vector3(0.7, -0.7, 0.0)]     # the rest palm normals (A-pose: toward the thighs)
var _hip_loc0 := Vector3.ZERO

func _rest_data() -> void:
	for nm in ["Hip", "Waist", "Spine01", "Spine02", "NeckTwist01", "Head", "L_Clavicle", "R_Clavicle", "L_Upperarm", "R_Upperarm",
			"L_Forearm", "R_Forearm", "L_Hand", "R_Hand", "L_Thigh", "R_Thigh", "L_Calf", "R_Calf", "L_Foot", "R_Foot"]:
		P0[nm] = _gpos(nm)
		_bi[nm] = bone[nm]
	_leg_l = Vector2((P0["L_Calf"] - P0["L_Thigh"]).length(), (P0["L_Foot"] - P0["L_Calf"]).length())
	_arm_l = Vector2((P0["L_Forearm"] - P0["L_Upperarm"]).length(), (P0["L_Hand"] - P0["L_Forearm"]).length())
	_hip_loc0 = sk.get_bone_rest(bone["Hip"]).origin
	_foot0 = [P0["L_Foot"], P0["R_Foot"]]

# ---- layers
class Layer:
	var clip: Dictionary
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
	var at_m := Vector3.ZERO             # (per frame) in her model space
	var pn_m := Vector3.ZERO
	var fired := {}

var _layers: Array = []
const KIND_ORDER := {"idle": 0, "hold": 1, "action": 2}
## default targets (model space) of the clips that aim at "@"
const AT_DEFAULT := {"reach": Vector3(-0.12, 1.12, 0.44), "pickup": Vector3(-0.10, 0.10, 0.34), "kneel_touch": Vector3(-0.08, 0.10, 0.56),
	"touch_glass": Vector3(-0.10, 1.20, 0.40), "kneel_reach": Vector3(-0.10, 0.12, 0.78), "refl_press": Vector3(-0.08, 1.78, 0.12)}
const N_DEFAULT := {"touch_glass": Vector3(0, 0, -1), "kneel_touch": Vector3.UP, "kneel_reach": Vector3.UP, "refl_press": Vector3.DOWN}

## play a clip (HeroineClips): opts {"at": Vector3 world | Node3D, "n": world normal of the touched surface (toward her),
## "hold": true (wait at the clip's hold point until release()), "speed": 1.0, "fade": seconds}. Returns its length (s).
func play(clip_name: String, opts := {}) -> float:
	if not HeroineClips.has(clip_name):
		push_warning("HeroineRig.play: no clip " + clip_name)
		return 0.0
	var c := HeroineClips.get_clip(clip_name)
	var kind := "idle" if c["idle"] else "action"
	for L in _layers:
		if (L as Layer).kind == kind and not L.out:
			L.out = true
			L.fade_out = float(opts.get("fade", c["blend"][0]))
	var L := Layer.new()
	L.clip = c
	L.kind = kind
	L.fade_in = float(opts.get("fade", c["blend"][0]))
	L.fade_out = c["blend"][1]
	L.hold = bool(opts.get("hold", false))
	L.speed = float(opts.get("speed", 1.0))
	L.t = float(opts.get("from", 0.0))
	L.at = opts.get("at", null)
	L.n_w = opts.get("n", Vector3.ZERO)
	_add_layer(L)
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
		if L.kind == "action" and not L.out and (clip_name == "" or L.clip["name"] == clip_name): return true
	return false

## an arm pose kept over everything else: "lamp" (raised, lighting the way), "shard" (held near), "" = let go
var held := ""
func hold(what: String) -> void:
	if what == held: return
	held = what
	for L in _layers:
		if L.kind == "hold" and not L.out: L.out = true
	if what == "" or not HeroineClips.has("hold_" + what): return
	var L := Layer.new()
	L.clip = HeroineClips.get_clip("hold_" + what)
	L.kind = "hold"
	L.fade_in = L.clip["blend"][0]
	L.fade_out = L.clip["blend"][1]
	_add_layer(L)

func _add_layer(L: Layer) -> void:
	_layers.append(L)
	_layers.sort_custom(func(a: Layer, b: Layer) -> bool: return KIND_ORDER[a.kind] < KIND_ORDER[b.kind])

## walk on the spot at this speed (m/s, the game's metres; she must not be moved meanwhile); NAN: measure her motion
var _virt := NAN
func set_locomotion(speed: float) -> void:
	_virt = speed

## turn the head toward a world point (Vector3.INF lets go), eased
var _look := Vector3.INF
var _look_w := 0.0
var _look_target_w := 1.0
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

func bone_world(nm: String) -> Vector3:
	return sk.global_transform * sk.get_bone_global_pose(bone[nm]).origin

## a node that follows a hand (parent the lamp / the Shard to it); made once
var _hand_nodes := {}
func hand_node(side := "R") -> Node3D:
	if not _hand_nodes.has(side):
		var a := BoneAttachment3D.new()
		a.name = side + "_HandSocket"
		sk.add_child(a)
		a.bone_name = side + "_Hand"
		_hand_nodes[side] = a
	return _hand_nodes[side]

# ---- the walk (planted feet)
var _foot0: Array = []
var _feet: Array = [{"w": Vector3.ZERO, "sw": false, "lift": Vector3.ZERO, "tgt": Vector3.ZERO, "yaw": 0.0, "lift_yaw": 0.0, "tyaw": 0.0, "s": 0.0},
	{"w": Vector3.ZERO, "sw": false, "lift": Vector3.ZERO, "tgt": Vector3.ZERO, "yaw": 0.0, "lift_yaw": 0.0, "tyaw": 0.0, "s": 0.0}]
var _ph := 0.0
var _prev_pos := Vector3.INF
var _prev_yaw := 0.0
var _vel := Vector3.ZERO
var _yr := 0.0
var _gw := 0.0
var _lean := 0.0
var _lean_v := 0.0
var _vf := 0.0
var _acc := 0.0
var _rx_s := 0.0
var _still := 0.0
var _idle_next := 7.0
var _idle_n := 0
var _loco := {}
## the measured speed (model metres/s) and the gait weight, for the curious (tests, W)
var speed_m := 0.0

func _plant_all(M: Transform3D, yaw: float) -> void:
	for i in 2:
		var f: Dictionary = _feet[i]
		f["w"] = M * (_foot0[i] as Vector3)
		f["sw"] = false
		f["yaw"] = yaw
		f["tgt"] = f["w"]

func _gait(dt: float, p: Figure.Pose) -> void:
	var M := rig.global_transform
	var Mi := M.affine_inverse()
	var pos := M.origin
	var fwd := M.basis.z
	fwd.y = 0.0
	fwd = fwd.normalized() if fwd.length() > 1e-4 else Vector3.BACK
	var yaw := atan2(fwd.x, fwd.z)
	if _prev_pos == Vector3.INF or pos.distance_to(_prev_pos) > 0.8:
		_plant_all(M, yaw)
		_vel = Vector3.ZERO
		_yr = 0.0
	elif dt > 0.0:
		var raw := (pos - _prev_pos) / dt
		raw.y = 0.0
		_vel = _vel.lerp(raw, 1.0 - exp(-dt * 12.0))
		_yr = lerpf(_yr, wrapf(yaw - _prev_yaw, -PI, PI) / dt, 1.0 - exp(-dt * 10.0))
	_prev_pos = pos
	_prev_yaw = yaw
	var vel_w := _vel
	var virt := not is_nan(_virt)
	if virt: vel_w = fwd * _virt
	var vm := Mi.basis * vel_w
	vm.y = 0.0
	var v := vm.length()
	speed_m = v
	var ve := maxf(v, absf(_yr) * 0.22)
	# step length and cadence from the speed (a walk; at a run-speed the steps lengthen and the double support goes)
	var step_len := clampf(0.28 + 0.19 * ve, 0.28, 0.85)
	var sw := lerpf(0.40, 0.47, clampf((ve - 1.5) / 2.5, 0.0, 1.0))
	var fc := ve / (2.0 * step_len)
	var off := 0.0
	var swinging := false
	for i in 2:
		var f: Dictionary = _feet[i]
		swinging = swinging or f["sw"]
		if not f["sw"]:
			off = maxf(off, (Mi * (f["w"] as Vector3) - (_foot0[i] as Vector3)).length())
	if ve < 0.12:
		fc = 1.15 if (swinging or off > 0.05) else 0.0          # squaring up when she stops
	else:
		fc = maxf(fc, 0.9)
	_ph = fposmod(_ph + fc * dt, 1.0)
	var lift_h := clampf(0.05 + 0.025 * ve, 0.05, 0.11)
	var fm: Array = [Vector3.ZERO, Vector3.ZERO]
	var fp: Array = [0.0, 0.0]
	var fy: Array = [0.0, 0.0]
	var t_st := (1.0 - sw) / maxf(fc, 0.05)
	var lead := vm * (t_st * 0.5)
	if lead.length() > 0.42: lead = lead.normalized() * 0.42
	for i in 2:
		var f: Dictionary = _feet[i]
		var u := fposmod(_ph - 0.5 * i, 1.0)
		var sw_now := fc > 0.0 and u < sw
		if sw_now and not f["sw"]:
			f["sw"] = true
			f["lift"] = f["w"]
			f["lift_yaw"] = f["yaw"]
		if f["sw"] and not sw_now:
			f["sw"] = false
			f["w"] = f["tgt"]
			f["yaw"] = f["tyaw"]
			step.emit(i)
		if f["sw"]:
			var s := u / sw
			var tau := (sw - u) / maxf(fc, 0.05)
			var yl := _yr * tau
			var at := pos + (Vector3.ZERO if virt else _vel * tau)
			var nm: Vector3 = (_foot0[i] as Vector3) + lead
			var tw := at + Basis(Vector3.UP, yl) * (M.basis * nm)
			f["tgt"] = tw
			f["tyaw"] = yaw + yl
			var e := s * s * (3.0 - 2.0 * s)
			f["w"] = (f["lift"] as Vector3).lerp(tw, e) + Vector3.UP * (lift_h * absf(M.basis.y.y) * sin(PI * s))
			f["yaw"] = lerp_angle(f["lift_yaw"], f["tyaw"], e)
			f["s"] = s
			var k := clampf(ve / 0.8, 0.3, 1.0)
			fp[i] = k * (0.55 * sin(PI * clampf(s * 1.6, 0.0, 1.0)) - 0.2 * sin(PI * clampf((s - 0.55) / 0.45, 0.0, 1.0)))
		elif virt:
			f["w"] = (f["w"] as Vector3) - vel_w * dt
			f["lift"] = f["w"]
		fm[i] = Mi * (f["w"] as Vector3)
		fy[i] = wrapf(float(f["yaw"]) - yaw, -PI, PI)
	_gw = lerpf(_gw, clampf(ve / 0.7, 0.0, 1.0), 1.0 - exp(-dt * 6.0))
	# the lean of starting and stopping: a spring on her forward acceleration (a small overshoot when she halts)
	if dt > 0.0:
		_acc = lerpf(_acc, (vm.z - _vf) / dt, 1.0 - exp(-dt * 8.0))
		_vf = vm.z
		var lt := clampf(_acc * 0.035, -0.16, 0.20)
		_lean_v += ((lt - _lean) * 60.0 - _lean_v * 9.0) * dt
		_lean += _lean_v * dt
	# pelvis: twists toward the leading foot, the swing side drops a little, the weight rides over the stance foot
	var pyaw := clampf(-((fm[0] as Vector3).z - (fm[1] as Vector3).z) * 0.30, -0.16, 0.16)
	var swing_side := 0.0
	if _feet[0]["sw"]: swing_side = -sin(PI * float(_feet[0]["s"]))
	elif _feet[1]["sw"]: swing_side = sin(PI * float(_feet[1]["s"]))
	var proll := 0.035 * swing_side * _gw
	var ot := _odd_t()
	var shift := 0.0
	if _feet[0]["sw"]: shift = (fm[1] as Vector3).x
	elif _feet[1]["sw"]: shift = (fm[0] as Vector3).x
	var idle_k := 1.0 - _gw
	_rx_s = lerpf(_rx_s, shift * 0.25 * _gw + idle_k * 0.022 * sin(ot * 0.41), 1.0 - exp(-dt * 6.0))
	proll += idle_k * 0.03 * sin(ot * 0.41)
	# the hips ride as high as the planted legs reach (the bob of a real walk), with soft knees
	var ry := -0.012 - 0.025 * _gw - 0.012 * idle_k * (0.5 + 0.5 * sin(ot * 0.41 + 1.6))
	var reach := (_leg_l.x + _leg_l.y) * 0.992
	for i in 2:
		if _feet[i]["sw"]: continue
		var hj: Vector3 = P0["L_Thigh" if i == 0 else "R_Thigh"] + Vector3(_rx_s, 0.0, 0.0)
		var d := Vector2((fm[i] as Vector3).x - hj.x, (fm[i] as Vector3).z - hj.z).length()
		var allow := (fm[i] as Vector3).y + sqrt(maxf(0.0, reach * reach - d * d)) - hj.y
		ry = minf(ry, allow)
	var asw := clampf(((fm[1] as Vector3).z - (fm[0] as Vector3).z) * 0.42, -0.3, 0.3) * (1.0 - 0.35 * odd)
	_loco = {"r": Vector3(_rx_s, ry, 0.0), "rr": Vector3(0.0, pyaw, proll),
		"sp": Vector3(_lean + 0.03 * _gw, -pyaw * 0.85, -proll * 0.7),
		"asw": asw, "fm": fm, "fp": fp, "fy": fy, "gw": _gw, "yr": _yr}

# ---- per frame
var C := {}
func apply_pose(p: Figure.Pose, slim: float, veil_contrary: bool) -> void:
	if P0.is_empty(): _rest_data()
	var dt := 0.0
	var fr := Engine.get_process_frames()
	if fr != _frame:
		_frame = fr
		dt = minf(get_process_delta_time(), 0.1) if is_inside_tree() else 0.0
	_t += dt
	body.position = Vector3.ZERO
	body.rotation = Vector3.ZERO
	body.scale = Vector3(1.0 - slim, 1.0, 1.0 - slim * 0.5)
	var src: HeroineRig = cloth_src if (cloth_src and cloth_src != self and cloth_src.is_inside_tree()) else null
	var lay: Array = _layers
	if src and not src._loco.is_empty():
		_loco = src._loco
		lay = src._layers
		_gw = src._gw
	else:
		_gait(dt, p)
		_tick_layers(dt)
	var ot := _odd_t()
	var gw: float = _loco["gw"]
	# ---- the base channels (the walk, the breath, the old Pose fields W's code sets)
	var brth := p.breath
	var c := p.crouch
	var r: Vector3 = _loco["r"]
	C["r"] = r + Vector3(0.0, -0.24 * c, -0.02 * c)
	C["rr"] = _loco["rr"]
	var spv: Vector3 = _loco["sp"]
	C["sp"] = spv + Vector3(0.012 * brth - p.lean_x * 0.4 + 0.55 * c, 0.0, -p.lean_z * 0.8)
	var yr: float = _loco["yr"]
	var oyaw := odd * 0.07 * _twitch(ot + 2.1, 8.7, 2.0) * (1.0 - gw)
	var otilt := odd * 0.5 * (0.16 * sin(ot * 0.23) * smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(ot * 0.071 + 1.3)) + 0.05 * _twitch(ot, 6.3, 1.0))
	C["hd"] = Vector3(-p.head_pitch + 0.04 * gw + 0.01 * brth + 0.3 * c, p.head_yaw + p.lean_z * 1.6 + clampf(yr * 0.12, -0.35, 0.35) * (1.0 - gw) + oyaw, -p.head_roll + otilt)
	C["Lsh"] = Vector2(0.03 * brth, 0.0)
	C["Rsh"] = Vector2(0.03 * brth, 0.0)
	C["Lw"] = Vector3.ZERO
	C["Rw"] = Vector3.ZERO
	if odd > 0.0:
		var twL := _twitch(ot, 4.1, 3.0) * odd
		var twR := _twitch(ot + 3.3, 5.3, 4.0) * odd
		C["Lw"] = Vector3(0.22 * twL, 0.0, 0.12 * twL)
		C["Rw"] = Vector3(0.22 * twR, 0.0, 0.12 * twR)
	C["Lfp"] = _loco["fp"][0]
	C["Rfp"] = _loco["fp"][1]
	C["Lik"] = 0.0
	C["Rik"] = 0.0
	C["Lh"] = HeroineClips.HANG_L
	C["Rh"] = HeroineClips.HANG_R
	C["Lel"] = HeroineClips.EL_L
	C["Rel"] = HeroineClips.EL_R
	C["Lpw"] = 0.0
	C["Rpw"] = 0.0
	C["Lpn"] = Vector3.DOWN
	C["Rpn"] = Vector3.DOWN
	C["fw"] = 0.0
	C["Lf"] = _loco["fm"][0]
	C["Rf"] = _loco["fm"][1]
	C["Lkn"] = HeroineClips.KN
	C["Rkn"] = HeroineClips.KN
	C["fol"] = 0.0
	# ---- the clips
	var Mi := rig.global_transform.affine_inverse()
	for L in lay:
		var w := smoothstep(0.0, 1.0, (L as Layer).w)
		if w <= 0.0: continue
		_apply_layer(L, w, Mi)
	# ---- direct aims (W's choreography)
	for side in SIDES:
		var a: Array = _aim[side]
		a[3] = move_toward(a[3], a[2], dt * 2.5)
		if a[3] <= 0.0: continue
		var k := smoothstep(0.0, 1.0, a[3])
		C[side + "ik"] = lerpf(C[side + "ik"], 1.0, k)
		C[side + "h"] = (C[side + "h"] as Vector3).lerp(Mi * (a[0] as Vector3), k)
		if (a[1] as Vector3) != Vector3.ZERO:
			C[side + "pw"] = lerpf(C[side + "pw"], 1.0, k)
			C[side + "pn"] = -(Mi.basis * (a[1] as Vector3)).normalized()
	_solve(p, Mi, dt)
	if cloth_mode == "copy" and cloth_src:
		var srcp := cloth_src.cloth_pose
		for k in cloth_bones.size(): sk.set_bone_pose_rotation(cloth_bones[k], srcp[k])
	elif cloth_mode == "sim" and sim:
		# a gentle, uneven breath of wind through the cloth
		var g := 0.035 + 0.025 * sin(_t * 0.7) * sin(_t * 0.23 + 1.0)
		# (a3) the gown trailed long at full speed: the sim reads the walk as a wind from ahead. A force WITH her motion
		# cancels part of that (external_force = the skeleton moving the other way): a walk keeps a little lag, a run
		# more of its shape
		var cancel := lerpf(0.22, 0.4, clampf((speed_m - 0.8) / 1.6, 0.0, 1.0)) * trail_cancel
		sim.external_force = Vector3(0.6, 0.0, 0.8).normalized() * g + Vector3(_vel.x, 0.0, _vel.z) * cancel
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

func _tick_layers(dt: float) -> void:
	# idle variants: after a while standing still, now the head tilt, now the fingers
	var acting := false
	for L in _layers: if L.kind != "idle" and not L.out and L.kind == "action": acting = true
	_still = _still + dt if (_gw < 0.05 and not acting) else 0.0
	if odd > 0.0 and _still > _idle_next:
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
		if L.out: L.w -= dt / maxf(L.fade_out, 0.01)
		else: L.w = minf(1.0, L.w + dt / maxf(L.fade_in, 0.01))
		var ev: Dictionary = c["ev"]
		for e in ev:
			if not L.fired.has(e) and L.t >= float(ev[e]):
				L.fired[e] = true
				clip_event.emit(c["name"], e)
		if L.out and L.w <= 0.0:
			_layers.remove_at(i)
			clip_done.emit(c["name"])
			continue
		i += 1

func _apply_layer(L: Layer, w: float, Mi: Transform3D) -> void:
	var c: Dictionary = L.clip
	var nm: String = c["name"]
	# the "@" target and normal, in her model space this frame
	if L.at is Node3D and is_instance_valid(L.at): L.at_m = Mi * (L.at as Node3D).global_position
	elif L.at is Vector3: L.at_m = Mi * (L.at as Vector3)
	else: L.at_m = AT_DEFAULT.get(nm, Vector3(-0.12, 1.12, 0.44))
	var n: Vector3 = (Mi.basis * L.n_w) if L.n_w != Vector3.ZERO else (N_DEFAULT.get(nm, Vector3.UP) as Vector3)
	L.pn_m = -n.normalized()
	var res := func(v: Variant) -> Variant:
		if v is String: return L.at_m if v == "@" else L.pn_m
		if v is Array: return L.at_m + (v[1] as Vector3)
		return v
	var chs: Dictionary = c["ch"]
	for ch in chs:
		var val: Variant = HeroineClips.sample(chs[ch], L.t, res)
		if HeroineClips.ADDITIVE.has(ch):
			C[ch] = C[ch] + val * w
		elif typeof(val) == TYPE_FLOAT:
			C[ch] = lerpf(C[ch], val, w)
		else:
			C[ch] = (C[ch] as Vector3).lerp(val, w)

func _solve(p: Figure.Pose, Mi: Transform3D, dt: float) -> void:
	var r: Vector3 = C["r"]
	var rrv: Vector3 = C["rr"]
	var Rr := _qe(rrv)
	var hipP: Vector3 = P0["Hip"] + r
	D[_bi["Hip"]] = Rr
	var spv: Vector3 = C["sp"]
	var dW := Rr * _qe(spv * 0.3)
	var dS1 := dW * _qe(spv * 0.35)
	var dS2 := dS1 * _qe(spv * 0.35)
	D[_bi["Waist"]] = dW
	D[_bi["Spine01"]] = dS1
	D[_bi["Spine02"]] = dS2
	var wP: Vector3 = hipP + Rr * (P0["Waist"] - P0["Hip"])
	var s1P: Vector3 = wP + dW * (P0["Spine01"] - P0["Waist"])
	var s2P: Vector3 = s1P + dS1 * (P0["Spine02"] - P0["Spine01"])
	# the head (+ a look toward a point)
	var hdv: Vector3 = C["hd"]
	_look_w = move_toward(_look_w, _look_target_w if _look != Vector3.INF else 0.0, dt * 1.2)
	if _look_w > 0.0 and _look != Vector3.INF:
		var headP: Vector3 = s2P + dS2 * (P0["Head"] - P0["Spine02"])
		var lv: Vector3 = dS2.inverse() * (Mi * _look - headP)
		var yaw := clampf(atan2(lv.x, lv.z), -1.25, 1.25)
		var pitch := clampf(atan2(-lv.y, Vector2(lv.x, lv.z).length()), -0.6, 0.7)
		var k := smoothstep(0.0, 1.0, _look_w)
		hdv = hdv.lerp(Vector3(pitch, yaw, hdv.z), k)
	var dN := dS2 * _qe(hdv * 0.4)
	D[_bi["NeckTwist01"]] = dN
	D[_bi["Head"]] = dN * _qe(hdv * 0.6)
	# arms
	var brth := p.breath
	for si in 2:
		var side: String = SIDES[si]
		var sg := 1.0 if si == 0 else -1.0
		var cl: String = side + "_Clavicle"
		var up: String = side + "_Upperarm"
		var fo: String = side + "_Forearm"
		var ha: String = side + "_Hand"
		var sh: Vector2 = C[side + "sh"]
		var dC := dS2 * _rz(sg * sh.x) * _ry(-sg * sh.y)
		D[_bi[cl]] = dC
		var clP: Vector3 = s2P + dS2 * (P0[cl] - P0["Spine02"])
		var upP: Vector3 = clP + dC * (P0[up] - P0[cl])
		var q: Dictionary = _q[side]
		var arm: Quaternion = q["rest"][0]
		var fore: Quaternion = q["rest"][1]
		var swing: float = (_loco["asw"] as float) * sg * _gw
		if p.clasp > 0.001:
			arm = arm.slerp(q["clasp"][0], p.clasp)
			fore = fore.slerp(q["clasp"][1], p.clasp)
			swing *= 1.0 - p.clasp
		if side == "R" and p.reach > 0.001:
			arm = arm.slerp(q["reach"][0], p.reach)
			fore = fore.slerp(q["reach"][1], p.reach)
			swing *= 1.0 - p.reach
		var dU := dC * _rx(-swing) * _rz(-sg * 0.02 * brth) * arm
		var dF := dC * _rx(-swing * 1.3 - 0.10 * _gw) * fore
		var a0: Vector3 = P0[fo] - P0[up]
		var f0: Vector3 = P0[ha] - P0[fo]
		var ik := clampf(C[side + "ik"], 0.0, 1.0)
		if ik > 0.001:
			var el: Vector3 = C[side + "el"]
			var sol := RigIK.solve2(upP, _arm_l.x, _arm_l.y, C[side + "h"], el)
			dU = dU.slerp(RigIK.frame_rot(a0, Vector3.FORWARD, (sol[0] as Vector3) - upP, el), ik)
			dF = dF.slerp(RigIK.frame_rot(f0, Vector3.FORWARD, (sol[1] as Vector3) - (sol[0] as Vector3), el), ik)
		D[_bi[up]] = dU
		D[_bi[fo]] = dF
		var dH := dF
		var pw := clampf(C[side + "pw"], 0.0, 1.0)
		if pw > 0.001:
			var n1: Vector3 = (C[side + "pn"] as Vector3).normalized()
			var fd := dF * f0.normalized()
			var h1 := fd - n1 * fd.dot(n1)
			if h1.length() < 0.2: h1 = fd
			dH = dH.slerp(RigIK.frame_rot(f0, PALM0[si], h1, n1), pw)
		D[_bi[ha]] = dH * _qe(C[side + "w"])
	# legs: always IK (the walk's planted feet, or a clip's)
	var fw := clampf(C["fw"], 0.0, 1.0)
	var fol := clampf(C["fol"], 0.0, 1.0)
	for si in 2:
		var side: String = SIDES[si]
		var sg := 1.0 if si == 0 else -1.0
		var th: String = side + "_Thigh"
		var ca: String = side + "_Calf"
		var ft: String = side + "_Foot"
		var hj: Vector3 = hipP + Rr * (P0[th] - P0["Hip"])
		var tgt: Vector3 = C[side + "f"]
		var fyw: float = _loco["fy"][si] * (1.0 - fw)
		var pole := Vector3(sin(fyw) + sg * 0.10, 0.0, cos(fyw)).lerp(C[side + "kn"], fw)
		var sol := RigIK.solve2(hj, _leg_l.x, _leg_l.y, tgt, pole)
		var dT := RigIK.frame_rot(P0[ca] - P0[th], Vector3.BACK, (sol[0] as Vector3) - hj, pole)
		var dK := RigIK.frame_rot(P0[ft] - P0[ca], Vector3.BACK, (sol[1] as Vector3) - (sol[0] as Vector3), pole)
		D[_bi[th]] = dT
		D[_bi[ca]] = dK
		var fpv: float = C[side + "fp"]
		var flat := _ry(rrv.y * fw + fyw) * _rx(fpv)
		D[_bi[ft]] = flat.slerp(dK * _rx(fpv), fol) if fol > 0.001 else flat
	# write the bones: the hip's offset, then every driven bone's local rotation from its global delta
	sk.set_bone_pose_position(bone["Hip"], _hip_loc0 + (_par_b[bone["Hip"]] as Basis).inverse() * r)
	for i in _drv_idx:
		var pi: int = _drv_par[i]
		var dp: Quaternion = D[pi] if pi >= 0 else Quaternion()
		var rel: Quaternion = dp.inverse() * (D[i] as Quaternion)
		var pb: Basis = _par_b[i]
		sk.set_bone_pose_rotation(i, Quaternion(pb.inverse() * Basis(rel) * pb) * (_rest_l[i] as Quaternion))
