class_name WardenRig
extends Node3D
## v1.0 M3c (Agent A, rigging) THE GLASS WARDEN (Theron): the rigged Tripo model (assets/models/warden_rigged.glb,
## built by dev_rig/tools/warden_rig.py) with its baked clips and a procedural head turn toward a point.
##   var w := WardenRig.new(); add_child(w); w.position = ...; w.rotation.y = ...
##   w.walk(true)                 the slow heavy walk (w.walk_speed() = how fast to move the node to match)
##   w.walk(false)                back to the idle (breathing, head bowed, a slow tilt)
##   w.look_at_point(cam_pos)     turns his head (neck + head, up to 80 deg) toward a world point, eased;
##   w.look_at_point(Vector3.INF) lets go.  ("turn head toward you": pass the camera's or the player's position.)
## Clips also in the GLB: "turn_head_left" / "turn_head_right" (3 s, hold) if a fixed beat is wanted instead.
## Skeleton: the same 25 body bones as the wanderer/heroine + 8 robe hem chains (Hem*) + 3 cape chains (CapeB*).

const MODEL := "res://assets/models/warden_rigged.glb"
## Low tier (set by World.set_tier): he casts no shadow (a 13k-tri skinned mesh in the shadow pass); group "q_warden"
static var high := true
const UNIT := 1.7                       # the rig's height (metres)
const WALK_T := 2.4                     # the walk clip: two steps
const STRIDE := 0.52                    # one step at rig scale (metres)

@export var height := 1.65              # in the game's metres (the hero is 1.12): very tall, gaunt
var anim: AnimationPlayer
var skel: Skeleton3D
var model: Node3D
var _look_target := Vector3.INF
var _look_k := 0.0
var _yaw := 0.0
var _walking := false
var _neck := PackedInt32Array()

func _ready() -> void:
	model = (load(MODEL) as PackedScene).instantiate()
	add_child(model)
	model.scale = Vector3.ONE * (height / UNIT)
	anim = model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	skel = model.find_child("Skeleton3D", true, false) as Skeleton3D
	if anim:
		for n in ["walk", "idle"]:
			if anim.has_animation(n): anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
		anim.callback_mode_process = AnimationPlayer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
		anim.play("idle")
	if skel:
		for n in ["NeckTwist01", "NeckTwist02", "Head"]: _neck.append(skel.find_bone(n))
		add_to_group("q_warden")
		set_shadow(high)

func set_shadow(on: bool) -> void:
	if model == null: return
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## the heavy walk on/off (blended)
func walk(on: bool) -> void:
	if not anim or on == _walking: return
	_walking = on
	anim.play("walk" if on else "idle", 0.6)

## metres per second to move the node at so his feet do not slide (at `height`)
func walk_speed() -> float:
	return 2.0 * STRIDE / WALK_T * (height / UNIT)

## turn his head toward a world point (Vector3.INF: let go)
func look_at_point(p: Vector3) -> void:
	_look_target = p

func _process(dt: float) -> void:
	if anim: anim.advance(dt)
	if not skel: return
	var want := 0.0
	if _look_target != Vector3.INF:
		var head_i := _neck[2]
		var hp := skel.global_transform * skel.get_bone_global_pose(head_i).origin
		var d := _look_target - hp
		d.y = 0.0
		if d.length() > 0.01:
			var fwd := global_transform.basis.z
			fwd.y = 0.0
			want = clampf(fwd.normalized().signed_angle_to(d.normalized(), Vector3.UP), -1.4, 1.4)
	# slow and deliberate: the head comes round over about a second and a half
	_look_k = move_toward(_look_k, 1.0 if _look_target != Vector3.INF else 0.0, dt * 0.8)
	_yaw = lerpf(_yaw, want, 1.0 - exp(-dt * 2.2))
	var y := _yaw * smoothstep(0.0, 1.0, _look_k)
	if absf(y) < 0.001: return
	var share := [0.2, 0.25, 0.55]
	var up_sk := skel.global_transform.basis.inverse() * Vector3.UP
	for k in 3:
		var bi := _neck[k]
		var gb := skel.get_bone_global_pose(bi).basis
		var ax := (gb.inverse() * up_sk).normalized()
		var r := skel.get_bone_pose_rotation(bi)
		skel.set_bone_pose_rotation(bi, r * Quaternion(ax, y * share[k]))
