class_name ChaseCamera
extends Camera3D
## Race camera with three views (Settings.CAM_MODES):
##  chase:      classic chase cam (DRIFT KICK style), look-ahead into turns, FOV widens with speed/nitro
##  iso_fixed:  Rock n' Roll Racing style high 3/4 view, long lens, fixed world yaw
##  iso_follow: same lens/pitch, yaw slowly follows the car heading (heavily lagged)
## ISO views look ahead along the velocity and zoom out with speed. Occluders (rocks, gate)
## between the camera and the car are dithered away via the cutaway shader uniforms.

const ISO_PITCH := 53.0      # degrees below the horizon
const ISO_FOV := 27.0
const ISO_DIST := 60.0
const ISO_FIXED_YAW_DIR := Vector2(-0.55, 0.45) # camera sits on the sun side -> front-lit cars

var target: Car
var mode := "chase"          # chase (= playing, uses `view`) | orbit (title)
var view := "iso_follow"     # chase | iso_fixed | iso_follow
var cut_mats: Array[ShaderMaterial] = []
var _focus := Vector3.ZERO
var _yaw := 0.0
var _zoom := ISO_DIST
var dist := 7.4
var height := 2.9
var shake := 0.0
var _dir := Vector3(0, 0, 1)
var _side := 0.0
var _fov := 66.0
var _orbit := 0.0
var _t := 0.0

func set_view(v: String) -> void:
	view = v
	near = 0.15 if v == "chase" else 1.5
	snap()

func _heading_yaw() -> float:
	var f := target.global_basis.z
	var h := Vector2(f.x, f.z)
	var vel := target.linear_velocity
	if target.speed > 5.0: h = h.normalized() * 0.4 + Vector2(vel.x, vel.z).normalized() * 0.6
	return atan2(-h.x, -h.y)

func snap() -> void:
	if target == null: return
	if view != "chase" and mode == "chase":
		_focus = target.global_position
		_yaw = atan2(ISO_FIXED_YAW_DIR.x, ISO_FIXED_YAW_DIR.y) if view == "iso_fixed" else _heading_yaw()
		_zoom = ISO_DIST
		_iso(0.0)
		return
	var f := target.global_basis.z
	_dir = Vector3(f.x, 0, f.z).normalized()
	global_position = target.global_position - _dir * dist + Vector3.UP * height
	look_at(target.global_position + _dir * 6.0 + Vector3.UP * 1.2, Vector3.UP)

func _process(dt: float) -> void:
	_t += dt
	if target == null: return
	_update_cutaway()
	if mode == "chase" and view != "chase":
		_iso(dt)
		return
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

func _iso(dt: float) -> void:
	var tp := target.global_position
	var vel := target.linear_velocity
	var vf := Vector3(vel.x, 0, vel.z)
	var ahead := vf * 0.55
	if ahead.length() > 22.0: ahead = ahead.normalized() * 22.0
	if dt > 0.0:
		_focus += vel * dt
		_focus = _focus.lerp(tp + ahead, 1.0 - exp(-3.0 * dt))
	var want_yaw := atan2(ISO_FIXED_YAW_DIR.x, ISO_FIXED_YAW_DIR.y) if view == "iso_fixed" else _heading_yaw()
	_yaw = lerp_angle(_yaw, want_yaw, 1.0 - exp(-(0.9 if view == "iso_follow" else 6.0) * dt)) if dt > 0.0 else want_yaw
	var spd := absf(target.speed)
	var want_zoom := ISO_DIST + spd * 0.42 + (4.0 if target.nitro_on else 0.0)
	_zoom = lerpf(_zoom, want_zoom, 1.0 - exp(-1.5 * dt)) if dt > 0.0 else want_zoom
	var pitch := deg_to_rad(ISO_PITCH)
	var off := Vector3(sin(_yaw) * cos(pitch), sin(pitch), cos(_yaw) * cos(pitch)) * _zoom
	shake = maxf(0.0, shake - dt * 1.8)
	var sh := shake * shake * 1.2
	var jit := Vector3(sin(_t * 41.0), sin(_t * 53.0 + 1.0), cos(_t * 37.0)) * sh
	global_position = _focus + off + jit
	look_at(_focus + jit * 0.5, Vector3.UP)
	fov = ISO_FOV + (1.5 if target.nitro_on else 0.0)

func _update_cutaway() -> void:
	var on := 1.0 if mode == "chase" else 0.0
	for m in cut_mats:
		m.set_shader_parameter("cut_cam", global_position)
		m.set_shader_parameter("cut_target", target.global_position + Vector3.UP * 1.2)
		m.set_shader_parameter("cut_on", on)
