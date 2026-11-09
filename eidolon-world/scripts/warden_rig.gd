class_name WardenRig
extends Node3D
## v1.0 M3c (Agent A, rigging) THE GLASS WARDEN (Theron): the rigged Tripo model (assets/models/warden_rigged.glb,
## built by dev_rig/tools/warden_rig.py) with its baked clips and a procedural head turn toward a point.
##   var w := WardenRig.new(); add_child(w); w.position = ...; w.rotation.y = ...
##   w.walk(true)                 the slow heavy walk (w.walk_speed() = how fast to move the node to match)
##   w.walk(false)                back to the idle (breathing, head bowed, a slow tilt)
##   w.look_at_point(cam_pos)     turns his head (neck + head, up to 80 deg) toward a world point, eased;
##   w.look_at_point(Vector3.INF) lets go.
##   w.set_look("glass")          v2.0: the Glass Warden of cracked glass (prologue, rising in the pool); "reflection"
##                                (dark + crimson rim, mirrors only); "" = his own textured look
##   w.place_seen(feet, yaw, surface_y)  v3 (a3): he lives in the water world (mirrored, upside-down above the surface)
##   w.rise_from(water_y, 3.0, NAN, pool_fx)  v2.0: he rises up out of the water at his current x/z (glass look; the surface clips
##                                him, a wet line at it, the cracks light from the feet up). Returns the Tween.  ("turn head toward you": pass the camera's or the player's position.)
## Clips also in the GLB: "turn_head_left" / "turn_head_right" (3 s, hold) if a fixed beat is wanted instead.
## Skeleton: the same 25 body bones as the wanderer/heroine + 8 robe hem chains (Hem*) + 3 cape chains (CapeB*).

const MODEL := "res://assets/models/warden_rigged.glb"
## Low tier (set by World.set_tier): he casts no shadow (a 13k-tri skinned mesh in the shadow pass); group "q_warden"
static var high := true
const UNIT := 1.7                       # the rig's height (metres)
const WALK_T := 2.4                     # the walk clip: two steps
const STRIDE := 0.52                    # one step at rig scale (metres)

@export var height := 1.65              # in the game's metres (the hero is 1.12): very tall, gaunt
@export var reflection := false        # dark + crimson rim (seen only in mirrors); set_reflection()
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
	if reflection: set_reflection(true)

func set_shadow(on: bool) -> void:
	if model == null: return
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

## (QA P1-3) the look for a figure that is only ever seen IN a mirror: dark, with a subtle crimson rim
func set_reflection(on: bool) -> void:
	reflection = on
	if model == null: return
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if not on:
			m.material_override = null
			continue
		var src := m.get_active_material(0) as BaseMaterial3D
		var sm := ShaderMaterial.new()
		sm.shader = preload("res://shaders/warden_reflection.gdshader")
		if src and src.albedo_texture: sm.set_shader_parameter("albedo_tex", src.albedo_texture)
		m.material_override = sm

## v2.0 "glass" | "reflection" | "" (own look)
func set_look(look: String) -> void:
	if look == "reflection":
		set_reflection(true)
		return
	set_reflection(false)
	if look != "glass" or model == null: return
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var src := m.get_active_material(0) as BaseMaterial3D
		var sm := ShaderMaterial.new()
		sm.shader = preload("res://shaders/warden_glass.gdshader")
		if src and src.albedo_texture: sm.set_shader_parameter("albedo_tex", src.albedo_texture)
		m.material_override = sm

func glass_param(k: String, v: Variant) -> void:
	if model == null: return
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var sm := (mi as MeshInstance3D).material_override as ShaderMaterial
		if sm: sm.set_shader_parameter(k, v)

## v2.0 rise out of still water: from fully under the surface (at water_y) up to standing on `stand_y` (default: his
## current y), over `seconds`. Set the glass look first (done here if not).
## v3 (a3) MIRRORED (he lives in the water world, upside-down above the surface, placed with place_seen() or any R*S*Fx
## transform whose up points down): he rises in the SEEN world, from `height * 1.2` deeper up to his seen feet (or to
## seen `stand_y`); no surface clip (the glass shows him under it), rings on the surface above him.
func rise_from(water_y: float, seconds := 3.0, stand_y := NAN, water_fx: Object = null) -> Tween:
	if model and (model.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D).material_override == null: set_look("glass")
	if _adopt_mirror(water_y):
		glass_param("clip_y", -1000.0)
		glass_param("rise", 0.0)
		var top := 0.0 if is_nan(stand_y) else stand_y - seen.origin.y
		seen_off = Vector3(0, top - height * 1.2, 0)
		_apply_seen()
		var mtw := create_tween()
		mtw.set_parallel(true)
		mtw.tween_property(self, "seen_off:y", top, seconds).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		mtw.tween_method(func(v: float) -> void: glass_param("rise", v), 0.0, 1.0, seconds * 1.1)
		if water_fx and water_fx.has_method("splash"):
			var above := Vector3(seen.origin.x, mirror_y, seen.origin.z)
			for k in 2:
				mtw.tween_callback(func() -> void: water_fx.call("splash", above, 0.45, 3.0)).set_delay(seconds * (0.45 + 0.35 * k))
		return mtw
	if is_nan(stand_y): stand_y = global_position.y
	glass_param("clip_y", water_y)
	glass_param("rise", 0.0)
	var p := global_position
	global_position = Vector3(p.x, water_y - height * 1.02, p.z)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(self, "global_position:y", stand_y, seconds).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_method(func(v: float) -> void: glass_param("rise", v), 0.0, 1.0, seconds * 1.1)
	# the water parts round him: rings as he breaks the surface, and drops as he clears it
	if water_fx and water_fx.has_method("splash"):
		var at := Vector3(p.x, water_y, p.z)
		for k in 3:
			tw.tween_callback(func() -> void: water_fx.call("splash", at, 0.7, 3.0)).set_delay(seconds * (0.05 + 0.25 * k))
	tw.tween_callback(func() -> void: FxBurst.splash(get_parent(), Vector3(p.x, water_y + 0.01, p.z), 0.6)).set_delay(seconds * 0.1)
	return tw

## v3 (a3) the water world. `mirror_y` = the surface he is mirrored in (NAN: an ordinary, upright Warden); `seen` = his
## transform AS SEEN in the glass (upright, under the surface); `seen_off` = what rise_from / pull_under add to it (seen
## metres). His node's real transform = mirror_xf(seen + seen_off), re-applied each frame.
##   w.place_seen(WD_SEEN, PI, W)     each frame instead of setting global_transform (rise/pull ride on top of it)
var mirror_y := NAN
var seen := Transform3D()
var seen_off := Vector3.ZERO
func place_seen(feet: Vector3, yaw: float, surface_y: float) -> void:
	mirror_y = surface_y
	seen = Transform3D(Basis(Vector3.UP, yaw), feet)
	_apply_seen()

## the real transform that a glass at `surface_y` shows as `xf` (= Prologue3.seen_xf: R * xf * Fx, a proper rotation)
static func mirror_xf(xf: Transform3D, surface_y: float) -> Transform3D:
	var R := Transform3D(Basis(Vector3(1, 0, 0), Vector3(0, -1, 0), Vector3(0, 0, 1)), Vector3(0, 2.0 * surface_y, 0))
	return R * xf * Transform3D(Basis.from_scale(Vector3(-1, 1, 1)), Vector3.ZERO)

func _apply_seen() -> void:
	if is_nan(mirror_y) or not is_inside_tree(): return
	global_transform = mirror_xf(Transform3D(seen.basis, seen.origin + seen_off), mirror_y)

## mirrored already, or placed upside-down by hand (W's R*S*Fx): take the seen transform back out of it (R and Fx undo themselves)
func _adopt_mirror(water_y: float) -> bool:
	if not is_nan(mirror_y): return true
	if not is_inside_tree() or global_transform.basis.y.y >= 0.0: return false
	mirror_y = water_y
	seen = mirror_xf(global_transform, water_y)
	seen.basis = seen.basis.orthonormalized() if seen.basis.determinant() > 0.0 else Basis(Vector3.UP, seen.basis.get_euler().y)
	seen_off = Vector3.ZERO
	return true

## v3 (Agent A) THE GRAB: his hand (side "R"/"L") closes on a world point or a moving one (a Callable -> Vector3, e.g.
## func(): return ione.rig.bone_world("R_Clavicle")), over `seconds`; he leans into it. ungrab() lets go.
##   w.grab(func() -> Vector3: return her.rig.bone_world("R_Clavicle") + Vector3(0, 0.03, 0), "R", 1.1)
##   w.pull_under(water_y, 2.2, her_node)   he sinks back into the water, dragging her node after him (returns the Tween;
##                                           play her rig's "refl_dragged" with it)
var _grab_src: Variant = null
var _grab_side := "R"
var _grab_w := 0.0
var _grab_rate := 1.0
var _grab_on := false
func grab(target: Variant, side := "R", seconds := 1.1) -> void:
	_grab_src = target
	_grab_side = side
	_grab_on = true
	_grab_rate = 1.0 / maxf(seconds, 0.05)

func ungrab(seconds := 0.8) -> void:
	_grab_on = false
	_grab_rate = 1.0 / maxf(seconds, 0.05)

func pull_under(water_y: float, seconds := 2.2, victim: Node3D = null) -> Tween:
	var tw := create_tween()
	tw.set_parallel(true)
	if _adopt_mirror(water_y):
		# the same heave and plunge, in the SEEN world: down into the dark and a little back along his facing; the
		# victim (if no one else drives her) follows the mirrored offset, a beat late
		var back := -(seen.basis.z * Vector3(1, 0, 1)).normalized() * 0.55
		var o0 := seen_off
		var o1 := o0 + Vector3(0, -height * 1.6, 0) + back
		tw.tween_property(self, "seen_off", o0 + Vector3(0, 0.06, 0), 0.25).set_trans(Tween.TRANS_SINE)
		tw.tween_property(self, "seen_off", o1, seconds).set_delay(0.25).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		if victim:
			var v0 := victim.global_position
			var vo := o1 - o0 + Vector3(0, -0.3, 0)
			var drag := func(k: float) -> void:
				if is_instance_valid(victim): victim.global_position = v0 + Vector3(vo.x, -vo.y, vo.z) * k
			tw.tween_method(drag, 0.0, 1.0, seconds * 1.05).set_delay(0.38).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		return tw
	# a short heave up first (the weight taken), then down hard, easing in
	tw.tween_property(self, "global_position:y", global_position.y + 0.06, 0.25).set_trans(Tween.TRANS_SINE)
	tw.tween_property(self, "global_position:y", water_y - height * 1.05, seconds).set_delay(0.25).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	if victim:
		var vy := victim.global_position.y
		var dy := global_position.y - vy
		tw.tween_property(victim, "global_position:y", water_y - height * 1.05 - dy - 0.3, seconds * 1.05).set_delay(0.38).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	return tw

func _grab_point() -> Vector3:
	if _grab_src is Callable: return (_grab_src as Callable).call()
	if _grab_src is Node3D and is_instance_valid(_grab_src): return (_grab_src as Node3D).global_position
	if _grab_src is Vector3: return _grab_src
	return Vector3.INF

func _apply_grab(dt: float) -> void:
	_grab_w = move_toward(_grab_w, 1.0 if _grab_on else 0.0, dt * _grab_rate)
	if _grab_w <= 0.0: return
	var tp := _grab_point()
	if tp == Vector3.INF: return
	var w := smoothstep(0.0, 1.0, _grab_w)
	var Xi := skel.global_transform.affine_inverse()
	var T := Xi * tp
	var sg := 1.0 if _grab_side == "L" else -1.0
	# he leans into the grab (the upper spine bows toward it)
	var sp := skel.find_bone("Spine02")
	var gs := skel.get_bone_global_pose(sp)
	var to := T - gs.origin
	to.y = 0.0
	if to.length() > 0.01:
		var ax := Vector3.UP.cross(to.normalized())
		skel.set_bone_global_pose(sp, Transform3D(Basis(ax.normalized(), 0.28 * w) * gs.basis, gs.origin))
	var up := skel.find_bone(_grab_side + "_Upperarm")
	var fo := skel.find_bone(_grab_side + "_Forearm")
	var ha := skel.find_bone(_grab_side + "_Hand")
	var gu := skel.get_bone_global_pose(up)
	var gf := skel.get_bone_global_pose(fo)
	var gh := skel.get_bone_global_pose(ha)
	var l1 := gu.origin.distance_to(gf.origin)
	var l2 := gf.origin.distance_to(gh.origin)
	# (a6) a hinge-consistent solve: both bones keep the animated elbow's hinge (the upper arm's bone x), the pole eases
	# from the animated elbow to out / down / back; the old per-bone frames twisted the forearm off the hinge (40 deg)
	# and flipped it 180 deg on a deep bend
	var h0 := (gu.basis * Vector3.RIGHT).normalized()
	var tgt := gh.origin.lerp(T, w)
	var dn := (tgt - gu.origin).normalized()
	var cur_pole := dn.cross(h0)
	var want := RigIK.pole(dn, Vector3(sg * 0.6, -0.5, -0.5), Vector3(sg * 0.35, -0.25, -1.0)).normalized()
	var sol := RigIK.solve2(gu.origin, l1, l2, tgt, cur_pole.normalized().lerp(want, w), 1.92)
	var q1 := RigIK.hinge_rot(gf.origin - gu.origin, h0, (sol[0] as Vector3) - gu.origin, sol[2])
	skel.set_bone_global_pose(up, Transform3D(Basis(q1) * gu.basis, gu.origin))
	gf = skel.get_bone_global_pose(fo)
	gh = skel.get_bone_global_pose(ha)
	var q2 := RigIK.hinge_rot(gh.origin - gf.origin, q1 * h0, (sol[1] as Vector3) - (sol[0] as Vector3), sol[2])
	skel.set_bone_global_pose(fo, Transform3D(Basis(q2) * gf.basis, gf.origin))
	# the hand closes over the shoulder: the palm turned down onto it
	gh = skel.get_bone_global_pose(ha)
	# (a6) about the hand's own hinge (its bone x: a wrist flexion), not the skeleton's x (that bent it sideways)
	skel.set_bone_global_pose(ha, Transform3D(gh.basis * Basis(Vector3.RIGHT, -0.3 * w), gh.origin))

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
	_apply_seen()
	if anim: anim.advance(dt)
	if not skel: return
	var want := 0.0
	if _look_target != Vector3.INF:
		# (a3) about HIS own up axis (he may hang upside-down in the water world: there he looks at the target's mirror
		# image, so the glass shows him looking at it)
		var up := global_transform.basis.y.normalized()
		var tgt := _look_target if is_nan(mirror_y) else Vector3(_look_target.x, 2.0 * mirror_y - _look_target.y, _look_target.z)
		var head_i := _neck[2]
		var hp := skel.global_transform * skel.get_bone_global_pose(head_i).origin
		var d := tgt - hp
		d -= up * d.dot(up)
		if d.length() > 0.01:
			var fwd := global_transform.basis.z
			fwd -= up * fwd.dot(up)
			if fwd.length() > 0.001: want = clampf(fwd.normalized().signed_angle_to(d.normalized(), up), -1.4, 1.4)
	# slow and deliberate: the head comes round over about a second and a half
	_look_k = move_toward(_look_k, 1.0 if _look_target != Vector3.INF else 0.0, dt * 0.8)
	_yaw = lerpf(_yaw, want, 1.0 - exp(-dt * 2.2))
	var y := _yaw * smoothstep(0.0, 1.0, _look_k)
	_apply_grab(dt)
	if absf(y) < 0.001: return
	var share := [0.2, 0.25, 0.55]
	var up_sk := skel.global_transform.basis.inverse() * global_transform.basis.y
	for k in 3:
		var bi := _neck[k]
		var gb := skel.get_bone_global_pose(bi).basis
		var ax := (gb.inverse() * up_sk).normalized()
		var r := skel.get_bone_pose_rotation(bi)
		skel.set_bone_pose_rotation(bi, r * Quaternion(ax, y * share[k]))
