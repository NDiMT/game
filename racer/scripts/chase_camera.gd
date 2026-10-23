class_name ChaseCamera
extends Camera3D
## Classic chase cam (DRIFT KICK style): sits behind the car along a blend of heading and
## velocity, looks ahead and into turns, FOV widens with speed and nitro, plus shake.

var target: Car
var mode := "chase"          # chase | orbit
var dist := 7.4
var height := 2.9
var shake := 0.0
var _dir := Vector3(0, 0, 1)
var _side := 0.0
var _fov := 66.0
var _orbit := 0.0
var _t := 0.0

func snap() -> void:
	if target == null: return
	var f := target.global_basis.z
	_dir = Vector3(f.x, 0, f.z).normalized()
	global_position = target.global_position - _dir * dist + Vector3.UP * height
	look_at(target.global_position + _dir * 6.0 + Vector3.UP * 1.2, Vector3.UP)

func _process(dt: float) -> void:
	_t += dt
	if target == null: return
	var tp := target.global_position
	if mode == "orbit":
		_orbit += dt * 0.18
		var f := target.global_basis.z
		var base := atan2(f.x, f.z)
		var a := base + 0.9 + sin(_orbit) * 0.5
		var want := tp + Vector3(sin(a), 0, cos(a)) * 8.5 + Vector3.UP * 2.2
		global_position = global_position.lerp(want, 1.0 - exp(-2.0 * dt))
		# frame the car on the right half of the screen (title text sits on the left)
		var right := (tp - global_position).cross(Vector3.UP).normalized()
		look_at(tp + Vector3.UP * 1.0 - right * 2.6, Vector3.UP)
		fov = 52.0
		return
	var f := target.global_basis.z
	var hd := Vector3(f.x, 0, f.z).normalized()
	var vel := target.linear_velocity
	var vf := Vector3(vel.x, 0, vel.z)
	if vf.length() > 4.0 and target.speed > 1.0:
		hd = (hd * 0.6 + vf.normalized() * 0.4).normalized()
	_dir = _dir.slerp(hd, 1.0 - exp(-4.5 * dt)).normalized()
	var spd := absf(target.speed)
	var d := dist + minf(1.6, spd * 0.035)
	var want := tp - _dir * d + Vector3.UP * (height + spd * 0.008)
	# follow the car's own motion exactly, smooth only the offset (no speed-dependent lag)
	global_position += vel * dt
	global_position = global_position.lerp(want, 1.0 - exp(-7.0 * dt))
	global_position.y = maxf(global_position.y, tp.y + 1.3)
	var yaw_rate := target.angular_velocity.y
	_side = lerpf(_side, clampf(yaw_rate * 2.6, -4.0, 4.0), 1.0 - exp(-3.0 * dt))
	var left := Vector3.UP.cross(_dir)
	var look := tp + _dir * 7.0 + Vector3.UP * 1.3 + left * _side
	shake = maxf(0.0, shake - dt * 1.8)
	var sh := shake * shake * 0.5
	var off := Vector3(sin(_t * 41.0), sin(_t * 53.0 + 1.0), cos(_t * 37.0)) * sh
	look_at(look + off, Vector3.UP)
	var want_fov := 66.0 + minf(14.0, spd * 0.3) + (9.0 if target.nitro_on else 0.0)
	_fov = lerpf(_fov, want_fov, 1.0 - exp(-4.0 * dt))
	fov = _fov
