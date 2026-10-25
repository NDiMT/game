class_name Player
extends Node3D
## The hooded wanderer: smooth acceleration, turning with a lean into the turn, walk bob, cloak sway
## and flare (a damped spring so the cloak overshoots when you stop), idle breathing, footsteps.
## Movement is resolved by Level.move() (walkable regions + obstacles): you cannot fall into the void.

signal footstep(kind: String, strength: float)

const SPEED := 2.7
const ACCEL := 9.0
const DECEL := 12.0
const RADIUS := 0.27

var level: Level
var fig: Figure
var vel := Vector3.ZERO
var yaw := 0.0
var input_dir := Vector2.ZERO     # desired world xz direction, length 0..1
var locked := false
var crouch := 0.0
var turn_rate := 0.0
var speed01 := 0.0
var t := 0.0
var _phase := 0.0
var _last_s := 0.0
var _step_n := 0
var _sway := Vector2.ZERO
var _sway_v := Vector2.ZERO
var _flare := 0.0
var _flare_v := 0.0
var _idle_look := 0.0
var still_time := 0.0
var hem_glow: MeshInstance3D
var blob_node: MeshInstance3D
var _blob_lift := 0.0
var _glow_k := -1.0
var extra_reach := 0.0          # v0.5: 0..1 the right hand reaches out (touching the glass, the water)
var veil_lift := 0.0            # v0.5: cinematic: the veil lifts back
var head_pitch_add := 0.0       # v0.5: cinematic: looking down into the water
var head_yaw_add := 0.0

func _init() -> void:
	fig = Figure.new()
	add_child(fig)
	fig.set_layers(PlanarMirror.LAYER_PLAYER)
	fig.enable_xray()
	# soft contact shadow
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.95, 0.95)
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/blob.gdshader")
	m.set_shader_parameter("strength", 0.5)
	var b := MeshInstance3D.new()
	b.mesh = pm
	b.material_override = m
	b.position.y = 0.015
	blob_node = b
	b.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(b)
	# a gentle petrol glow from the hem stripe on the ground round the wanderer
	var gm := ShaderMaterial.new()
	gm.shader = preload("res://shaders/blob.gdshader")
	gm.set_shader_parameter("tint", Palette.CORE)
	gm.set_shader_parameter("strength", 0.0)
	hem_glow = MeshInstance3D.new()
	var gp := PlaneMesh.new()
	gp.size = Vector2(0.8, 0.8)
	hem_glow.mesh = gp
	hem_glow.material_override = gm
	hem_glow.position.y = 0.02
	hem_glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(hem_glow)

func teleport(p: Vector3, face_yaw := INF) -> void:
	var q := Vector2(p.x, p.z)
	position = Vector3(q.x, level.height_at(q), q.y)
	vel = Vector3.ZERO
	if face_yaw != INF: yaw = face_yaw
	fig.rotation.y = yaw
	fig.reset_cloth()                # (no cloth streaming across a teleport)

func step(dt: float) -> void:
	t += dt
	_lift_contact_shadow()
	var want := Vector3(input_dir.x, 0.0, input_dir.y)
	if locked: want = Vector3.ZERO
	if want.length() > 1.0: want = want.normalized()
	var target := want * SPEED
	var rate := ACCEL if target.length() > vel.length() else DECEL
	vel = vel.move_toward(target, rate * dt)
	if vel.length() < 0.01 and target == Vector3.ZERO: vel = Vector3.ZERO
	var real := Vector3.ZERO
	if vel != Vector3.ZERO:
		var np := level.move(position, vel * dt, RADIUS)
		real = (np - position) / maxf(dt, 0.0001)
		real.y = 0.0
		# blocked: bleed velocity so we do not "push" against invisible walls at full speed
		if real.length() < vel.length() * 0.5: vel = vel.lerp(real, 0.5)
		position = np
	# animation speed follows the ACTUAL displacement (no moonwalking against a wall)
	speed01 = lerpf(speed01, clampf(real.length() / SPEED, 0.0, 1.0), 1.0 - exp(-dt * 14.0))
	if speed01 < 0.002: speed01 = 0.0
	still_time = still_time + dt if speed01 < 0.05 else 0.0
	# facing: turn toward the movement direction, measure the turn rate for the lean
	var prev := yaw
	if want.length() > 0.1:
		var ty := atan2(-want.x, -want.z)
		yaw = lerp_angle(yaw, ty, 1.0 - exp(-dt * 9.0))
	var dy := wrapf(yaw - prev, -PI, PI) / maxf(dt, 0.0001)
	turn_rate = lerpf(turn_rate, dy, 1.0 - exp(-dt * 8.0))
	fig.rotation.y = yaw
	var gk := clampf(fig.hem, 0.0, 3.0)
	if gk != _glow_k:
		_glow_k = gk
		(hem_glow.material_override as ShaderMaterial).set_shader_parameter("strength", 0.07 + 0.05 * gk)
	_animate(dt)

func _animate(dt: float) -> void:
	var walk := smoothstep(0.0, 0.6, speed01)
	_phase += dt * (1.5 + 6.2 * speed01) * (1.0 if speed01 > 0.03 else 0.0)
	var p := Figure.Pose.new()
	var s := sin(_phase)
	p.body_y = absf(s) * 0.035 * walk + sin(t * 1.7) * 0.004 * (1.0 - walk)
	p.lean_x = -0.11 * walk
	p.lean_z = clampf(turn_rate * 0.05, -0.22, 0.22) * walk
	# cloak spring: trails opposite the local velocity, swings with the stride, overshoots on stopping
	var lv := fig.basis.inverse() * vel
	var target := -Vector2(lv.x, lv.z) * 0.032 + Vector2(s * 0.022 * walk, 0.0)
	_sway_v += ((target - _sway) * 70.0 - _sway_v * 7.5) * dt
	_sway += _sway_v * dt
	var ft := walk * 0.32
	_flare_v += ((ft - _flare) * 55.0 - _flare_v * 6.0) * dt
	_flare += _flare_v * dt
	p.sway = _sway
	p.flare = maxf(_flare, -0.05)
	p.ripple = walk
	p.phase = _phase
	p.breath = sin(t * 1.65) * (1.0 - walk)
	# idle: the hood drifts to look around, slowly
	_idle_look = lerpf(_idle_look, sin(t * 0.37) * 0.35 * smoothstep(2.0, 5.0, still_time), 1.0 - exp(-dt * 1.5))
	p.head_yaw = _idle_look
	p.head_pitch = -0.04 * walk
	p.crouch = crouch
	p.reach = extra_reach
	p.head_pitch += head_pitch_add
	p.head_yaw += head_yaw_add
	fig.apply_pose(p)
	# footsteps on each half stride
	if speed01 > 0.12 and signf(s) != signf(_last_s) and _last_s != 0.0:
		_step_n += 1
		footstep.emit("step", speed01)
		if _step_n % 2 == 0: footstep.emit("cloth", speed01)
	_last_s = s

## v0.5b: on a stair the walk region is a smooth ramp but the stone is stepped: the contact shadow
## (a flat disc) would slice in and out of the step tops and flicker. Lift it just above the steps.
func _lift_contact_shadow() -> void:
	var g := level.region_at(Vector2(position.x, position.z))
	var lift := 0.0
	if g and g.axis >= 0 and absf(g.y1 - g.y0) > 0.001:
		var L := g.r.size.x if g.axis == 0 else g.r.size.y
		var n := maxi(2, int(round(L / 0.32)))
		lift = absf(g.y1 - g.y0) / n * 0.8 + 0.01        # (steps(): a step's top rises 0.75 of its height)
	if lift != _blob_lift:
		_blob_lift = lift
		blob_node.position.y = 0.015 + lift
		hem_glow.position.y = 0.02 + lift
