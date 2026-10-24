class_name Reflector
extends Node3D
## A reflecting surface (mirror, pool, polished floor, or the great Eidolon glass) and its PUPPET:
## a second hooded figure with the ghost shader whose transform is the player's transform reflected
## across the mirror plane (Householder matrix, det = -1) and whose Pose is copied from the player.
## No reflection render pass: one extra figure (2 draw calls) per visible reflector.
##
## Scripted glimpses:
##   lag > 0          the reflection plays back the player's motion from `lag` seconds ago
##   wrong > 0        ...and its head tilts a little, as if listening
##   gaze_target      when the player stands still, the reflection turns its head, then its body,
##                    toward that point (in its own mirrored world), holds, snaps back on movement.

signal glimpse(kind: String)

var kind := "mirror"
var plane_n := Vector3(0, 0, 1)
var plane_d := 0.0
var clip_c := Vector3.ZERO
var clip_u := Vector3.RIGHT
var clip_v := Vector3.UP
var clip_h := Vector2.ONE
var region := Rect2()
var near_rect := Rect2()           # optional: the player must also be within `near` m of this rect
var near := -1.0
var lag := 0.0
var wrong := 0.0
var alpha := 0.7
var ghost := 0.0
var project := true
var gaze_target := Vector3.INF
var puppet: Figure
var vis := 0.0
var active := false
var refl_xf := Transform3D()
var gaze_head := 0.0
var gaze_body := 0.0
var gazed := false
var gaze_count := 0
var glimpsed := false
var _hist: Array = []              # [time, Transform3D, Pose]
var _t := 0.0
var surface_col := Vector3(0.5, 0.5, 0.5)
var surface_mix := 0.0
var _tilt_t := 10.0
var _tilt := 0.0
var _skip_at := 10.0
var _active_t := 0.0
var skipped := false

static var ghost_shader: Shader

func setup() -> void:
	if ghost_shader == null: ghost_shader = preload("res://shaders/ghost.gdshader")
	var n := plane_n.normalized()
	var b := Basis(Vector3(1, 0, 0) - 2.0 * n.x * n, Vector3(0, 1, 0) - 2.0 * n.y * n, Vector3(0, 0, 1) - 2.0 * n.z * n)
	refl_xf = Transform3D(b, 2.0 * plane_d * n)
	puppet = Figure.new(ghost_shader)
	puppet.visible = false
	add_child(puppet)
	puppet.set_param("project", 1.0 if project else 0.0)
	puppet.set_param("plane_n", n)
	puppet.set_param("plane_d", plane_d)
	puppet.set_param("clip_c", clip_c)
	puppet.set_param("clip_u", clip_u)
	puppet.set_param("clip_v", clip_v)
	puppet.set_param("clip_h", clip_h)
	puppet.set_param("ghost", ghost)
	puppet.set_param("vis", 0.0)
	puppet.set_param("surface_col", surface_col)
	puppet.set_param("surface_mix", surface_mix)
	puppet.set_param("ripple_amt", 1.0 if kind == "pool" else 0.0)
	puppet.set_param("shimmer", 1.0 if kind == "eidolon" else 0.0)
	if lag <= 0.0: lag = 0.035          # a micro-lag (about two frames): barely there
	_tilt_t = randf_range(6.0, 14.0)
	_skip_at = randf_range(6.0, 20.0)

func reflect_point(p: Vector3) -> Vector3:
	return refl_xf * p

## Is the reflection of world point q (e.g. the chest) actually seen inside the glass?
func seen_in_glass(q: Vector3, cam_back: Vector3) -> bool:
	if not project: return true
	var w := refl_xf * q
	var den := plane_n.dot(cam_back)
	if absf(den) < 0.02: return false
	var p := w + cam_back * ((plane_d - plane_n.dot(w)) / den)
	var d := p - clip_c
	return absf(d.dot(clip_u)) < clip_h.x * 0.85 and absf(d.dot(clip_v)) < clip_h.y * 0.85

func puppet_pos() -> Vector3:
	return puppet.global_position

func _wants(player: Player, cam_back: Vector3) -> bool:
	var p := player.global_position
	if not region.has_point(Vector2(p.x, p.z)): return false
	if near > 0.0:
		var q := Vector2(clampf(p.x, near_rect.position.x, near_rect.end.x), clampf(p.z, near_rect.position.y, near_rect.end.y))
		if q.distance_to(Vector2(p.x, p.z)) > near: return false
	if plane_n.dot(p + Vector3(0, 0.5, 0)) - plane_d < 0.0: return false   # behind the glass
	if project and plane_n.y < 0.5 and plane_n.dot(cam_back) < 0.05: return false   # we see its back
	return true

func update(dt: float, player: Player, cam_back: Vector3) -> void:
	_t += dt
	var want := _wants(player, cam_back)
	vis = move_toward(vis, 1.0 if want else 0.0, dt * (1.6 if want else 3.0))
	if want and not active and lag > 0.0 and not glimpsed:
		glimpsed = true
		glimpse.emit("lag")
	active = vis > 0.01
	puppet.visible = active
	var src_xf := player.fig.global_transform
	var src_pose: Figure.Pose = player.fig.pose
	if lag > 0.0:
		_hist.append([_t, src_xf, src_pose.copy()])
		while _hist.size() > 2 and _hist[1][0] <= _t - lag: _hist.pop_front()
		if not active: return
		var a: Array = _hist[0]
		if _hist.size() > 1 and a[0] < _t - lag:
			var b: Array = _hist[1]
			var k := clampf((_t - lag - a[0]) / maxf(b[0] - a[0], 0.0001), 0.0, 1.0)
			src_xf = (a[1] as Transform3D).interpolate_with(b[1], k)
			src_pose = (a[2] as Figure.Pose).blend(b[2], k)
		else:
			src_xf = a[1]
			src_pose = a[2]
		if wrong > 0.0:
			src_pose = src_pose.copy()
			src_pose.head_roll += wrong * (0.10 + 0.04 * sin(_t * 0.7)) * smoothstep(0.5, 2.5, player.still_time)
			src_pose.head_yaw += wrong * 0.06 * sin(_t * 0.43)
	if not active: return
	if gaze_target != Vector3.INF:
		var r := _gaze(dt, player, src_xf, src_pose, seen_in_glass(player.global_position + Vector3(0, 0.7, 0), cam_back))
		src_xf = r[0]
		src_pose = r[1]
	# small signs that it is not quite a reflection: its hem a touch brighter, its breathing out of
	# phase with yours, now and then its head tilts a few degrees differently, and very rarely (once
	# per surface) a single frame where it stands slightly off, like a skip
	if puppet.hem != player.fig.hem * 1.25: puppet.set_hem(player.fig.hem * 1.25)
	if puppet.runes_awake != player.fig.runes_awake: puppet.set_runes(player.fig.runes_awake)
	src_pose = src_pose.copy()
	var still := clampf(1.0 - player.speed01 * 3.0, 0.0, 1.0)
	src_pose.breath = sin(_t * 1.58 + 2.2) * still
	_tilt_t -= dt
	if _tilt_t <= 0.0:
		_tilt_t = randf_range(9.0, 18.0)
		var tw := create_tween()
		tw.tween_property(self, "_tilt", randf_range(0.05, 0.08) * (1.0 if randf() < 0.5 else -1.0), 0.8).set_trans(Tween.TRANS_SINE)
		tw.tween_interval(1.4)
		tw.tween_property(self, "_tilt", 0.0, 1.0).set_trans(Tween.TRANS_SINE)
	src_pose.head_roll += _tilt
	_active_t += dt
	var sk := Vector2.ZERO
	if not skipped and _active_t > _skip_at and kind != "floor":
		skipped = true
		sk = Vector2(clip_u.x, clip_u.z) * 0.07
	puppet.set_param("skip", sk)
	puppet.global_transform = refl_xf * src_xf
	puppet.apply_pose(src_pose)
	puppet.set_param("vis", vis)

func _gaze(dt: float, player: Player, xf: Transform3D, pose: Figure.Pose, seen: bool) -> Array:
	var still := player.still_time
	if player.speed01 > 0.08 or not seen:
		# snap back the moment you move
		gaze_head = move_toward(gaze_head, 0.0, dt * 7.0)
		gaze_body = move_toward(gaze_body, 0.0, dt * 6.0)
		gazed = false
	else:
		if still > 1.4: gaze_head = move_toward(gaze_head, 1.0, dt / 0.9)
		if still > 2.3: gaze_body = move_toward(gaze_body, 1.0, dt / 2.2)
		if not gazed and gaze_head > 0.05:
			gazed = true
			gaze_count += 1
			glimpse.emit("gaze")
	if gaze_head <= 0.0 and gaze_body <= 0.0: return [xf, pose]
	var p := xf.origin
	var yaw0 := player.yaw
	var ty := atan2(-(gaze_target.x - p.x), -(gaze_target.z - p.z))
	var hb := smoothstep(0.0, 1.0, gaze_body)
	var yb := lerp_angle(yaw0, ty, hb * 0.85)
	var rest := clampf(wrapf(ty - yb, -PI, PI), -1.25, 1.25)
	var np := pose.copy()
	np.head_yaw = lerpf(pose.head_yaw, rest, smoothstep(0.0, 1.0, gaze_head))
	np.head_pitch = pose.head_pitch - 0.10 * gaze_head
	var nx := Transform3D(Basis(Vector3.UP, yb), p)
	# keep the figure's own body offsets (the Figure node is rotated by yaw only)
	return [nx, np]
