class_name ReflActor
extends Node
## v3 (dev/CH1_V3.md §3): her reflection as an INDEPENDENT ACTOR. Drives a Reflector's double through its hold
## (hold_xf / hold_pose / hold_k): detach() blends her off your (delayed) movement, go() walks her along points in
## her world, act() plays a gesture, rejoin() blends her back into copying you. Every call is queued, so a gesture
## that has begun always finishes (no lost input; the N.4 contract). Points are given on YOUR side of the glass: the
## glass shows them reflected (TwoWorld).
## Gestures are pose layers for now (Figure.Pose); A's clips (CH1_V3 §5) replace them by name.

signal arrived
signal acted(gesture: String)
signal rejoined

const SPEED := 1.1
const BLEND_IN := 0.45
const BLEND_OUT := 0.6

var r: Reflector
var state := "follow"           # follow, detach, walk, act, hold (waiting, detached), rejoin
var pos := Vector3.ZERO
var yaw := 0.0
var _scale := Vector3.ONE
var _queue: Array = []          # [kind, arg, dur]
var _path: Array = []
var _phase := 0.0
var _walk := 0.0
var _t := 0.0
var _act := ""
var _act_t := 0.0
var _act_dur := 0.0
var _pose := Figure.Pose.new()

func _init(refl: Reflector) -> void:
	r = refl

func busy() -> bool:
	return state != "follow" or not _queue.is_empty()

func detach() -> void: _queue.append(["detach", null, BLEND_IN])
func go(points: Array) -> void: _queue.append(["walk", points, 0.0])
func act(gesture: String, dur := 2.5) -> void: _queue.append(["act", gesture, dur])
func rejoin() -> void: _queue.append(["rejoin", null, BLEND_OUT])

func _process(dt: float) -> void:
	_t += dt
	if state == "follow" or state == "hold" or _step_done():
		_next()
	match state:
		"hold": _idle_pose()
		"detach":
			r.hold_k = minf(1.0, r.hold_k + dt / BLEND_IN)
			_idle_pose()
		"walk": _walk_step(dt)
		"act":
			_act_t += dt
			_gesture(_act, clampf(_act_t / _act_dur, 0.0, 1.0))
		"rejoin":
			r.hold_k = maxf(0.0, r.hold_k - dt / BLEND_OUT)
			_idle_pose()
			if r.hold_k <= 0.0:
				r.hold = false
				state = "follow"
				rejoined.emit()
	if r.hold:
		r.hold_xf = Transform3D(Basis(Vector3.UP, yaw).scaled(_scale), pos)
		r.hold_pose = _pose

func _step_done() -> bool:
	match state:
		"detach": return r.hold_k >= 1.0
		"walk": return _path.is_empty()
		"act": return _act_t >= _act_dur
	return false

func _next() -> void:
	if state == "act": acted.emit(_act)
	if state == "walk": arrived.emit()
	if state == "rejoin": return
	if _queue.is_empty():
		if state != "follow" and state != "rejoin": state = "hold"
		return
	var q: Array = _queue.pop_front()
	match q[0]:
		"detach":
			# from wherever her double stands now (your delayed transform)
			var xf: Transform3D = r.last_src_xf
			pos = xf.origin
			_scale = xf.basis.get_scale()
			var f := -xf.basis.z
			yaw = atan2(-f.x, -f.z)
			r.hold = true
			r.hold_k = 0.0
			state = "detach"
		"walk":
			_path = (q[1] as Array).duplicate()
			state = "walk"
		"act":
			_act = q[1]
			_act_t = 0.0
			_act_dur = maxf(0.1, q[2])
			state = "act"
		"rejoin":
			state = "rejoin"

func _walk_step(dt: float) -> void:
	if _path.is_empty(): return
	var tgt: Vector3 = _path[0]
	var d := Vector3(tgt.x - pos.x, 0.0, tgt.z - pos.z)
	var L := d.length()
	_walk = move_toward(_walk, 1.0 if L > 0.05 else 0.0, dt * 3.0)
	if L > 0.001:
		var want := atan2(-d.x, -d.z)
		yaw = lerp_angle(yaw, want, 1.0 - exp(-dt * 8.0))
		var stepl := minf(L, SPEED * _walk * dt + 0.0005)
		pos += d / L * stepl
		pos.y = lerpf(pos.y, tgt.y, 1.0 - exp(-dt * 6.0))
	if L <= 0.05: _path.pop_front()
	_phase += dt * (1.5 + 6.2 * _walk * 0.7)
	_pose = walk_pose(_phase, _walk * 0.7, _t)

func _idle_pose() -> void:
	_walk = move_toward(_walk, 0.0, get_process_delta_time() * 3.0)
	_pose = walk_pose(_phase, _walk, _t)

## the walking pose the player's code makes (player.gd), without the cloth springs
static func walk_pose(phase: float, speed01: float, t: float) -> Figure.Pose:
	var p := Figure.Pose.new()
	var walk := smoothstep(0.0, 0.6, speed01)
	var s := sin(phase)
	p.body_y = absf(s) * 0.035 * walk + sin(t * 1.7) * 0.004 * (1.0 - walk)
	p.lean_x = -0.11 * walk
	p.sway = Vector2(s * 0.022 * walk, 0.0)
	p.flare = walk * 0.32
	p.ripple = walk
	p.phase = phase
	p.breath = sin(t * 1.65 + 2.2) * (1.0 - walk)
	p.head_pitch = -0.04 * walk
	return p

## the gestures (k 0..1 through the gesture); names match CH1_V3 §5
func _gesture(g: String, k: float) -> void:
	var p := walk_pose(_phase, 0.0, _t)
	var up := sin(k * PI)                 # in and out
	match g:
		"reach", "untie_cleat":
			p.reach = up
			p.lean_x = -0.12 * up
			p.head_pitch = 0.1 * up
		"reach_high":
			p.reach = up
			p.head_pitch = -0.35 * up
			p.body_y = 0.06 * up
		"reach_fail_shake":
			p.reach = up * (1.0 if k < 0.5 else 0.0)
			p.head_pitch = -0.3 * up
			p.head_yaw = 0.35 * sin(k * TAU * 3.0) * smoothstep(0.45, 0.6, k) * (1.0 - smoothstep(0.85, 1.0, k))
		"climb_block":
			p.body_y = 0.42 * smoothstep(0.0, 0.6, k)
			p.lean_x = -0.2 * sin(clampf(k / 0.6, 0.0, 1.0) * PI)
		"knock_glass_twice":
			var kk := absf(sin(k * PI * 2.0))
			p.reach = 0.7 + 0.3 * kk
			p.lean_x = -0.08
		"look_at_you":
			p.head_yaw = 0.0
			p.head_pitch = 0.05 * up
	_pose = p
