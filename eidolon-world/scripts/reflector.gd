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

var planar: PlanarMirror          # the great mirror: a real planar reflection (null = projected puppet)
var planar_on := false
var _settle := 0.0                 # the reflection settles a fraction after you stop
var _was_moving := false
var _clasp := 0.0
var _clasp_t := 30.0
var _feet: Array[MeshInstance3D] = []
var _foot_i := 0
var _foot_side := 1.0
var _last_s := 0.0
var reach_override := -1.0      # v0.5: >= 0 the double's hand reaches out by this much (touch the glass)
static var foot_shader: Shader
static var ghost_shader: Shader
static var enabled := true          # perf bench: all reflections off
static var cloth_bones := true      # v0.8: reflections wear your spring-bone cloth (off on the Low tier)
var _cloth_mode := ""

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
	# v0.4 hints that it is not you: slimmer (a woman's narrower shoulders), the veil out of step,
	# the hood-rim rune already faintly lit
	puppet.slim = 0.045
	puppet.veil_contrary = true
	puppet.set_layers(PlanarMirror.LAYER_MAIN_FX)
	_clasp_t = randf_range(18.0, 40.0)
	if kind != "pool" and kind != "floor" and kind != "eidolon":
		if foot_shader == null: foot_shader = preload("res://shaders/footprint.gdshader")
		var q := QuadMesh.new()
		q.size = Vector2(0.10, 0.17)
		q.orientation = PlaneMesh.FACE_Y
		for i in 6:
			var m := ShaderMaterial.new()
			m.shader = foot_shader
			for k in ["plane_n", "plane_d", "clip_c", "clip_u", "clip_v", "clip_h"]: m.set_shader_parameter(k, get(k))
			m.set_shader_parameter("plane_n", n)
			m.set_shader_parameter("project", 1.0 if project else 0.0)
			m.set_shader_parameter("life", 1.0)
			var mi := MeshInstance3D.new()
			mi.mesh = q
			mi.material_override = m
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.layers = PlanarMirror.LAYER_MAIN_FX
			mi.visible = false
			add_child(mi)
			_feet.append(mi)
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

## v0.3 perf: the puppet is only posed and drawn while its glass / pool is on screen
func _on_screen() -> bool:
	if not project: return true
	var cam := get_viewport().get_camera_3d()
	if cam == null: return true
	var vs := get_viewport().get_visible_rect().size
	var lo := Vector2(INF, INF); var hi := -lo
	for sx in [-1.0, 1.0]:
		for sy in [-1.0, 1.0]:
			var w: Vector3 = clip_c + clip_u * clip_h.x * sx + clip_v * clip_h.y * sy
			if cam.is_position_behind(w): continue
			var p := cam.unproject_position(w)
			lo = lo.min(p); hi = hi.max(p)
	return hi.x > 0.0 and hi.y > 0.0 and lo.x < vs.x and lo.y < vs.y

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
	var on_screen := _on_screen()
	var want := enabled and _wants(player, cam_back) and on_screen
	# the great mirror: the planar reflection renders while its glass is on screen and you are in the hall
	if planar:
		var pp := player.global_position
		planar.update(get_viewport().get_camera_3d(), enabled and on_screen and region.has_point(Vector2(pp.x, pp.z)), player.speed01 > 0.05)
		if planar.active != planar_on:
			planar_on = planar.active
			puppet.set_layers(PlanarMirror.LAYER_DOUBLE if planar_on else PlanarMirror.LAYER_MAIN_FX)
			puppet.set_param("project", 0.0 if planar_on else 1.0)
			puppet.set_param("graded", 0.0 if planar_on else 1.0)
			for f in _feet:
				f.layers = PlanarMirror.LAYER_DOUBLE if planar_on else PlanarMirror.LAYER_MAIN_FX
				(f.material_override as ShaderMaterial).set_shader_parameter("project", 0.0 if planar_on else 1.0)
	# settling: when you stop, it comes to rest a fraction later, with one small extra sway
	var moving := player.speed01 > 0.3
	if _was_moving and player.speed01 < 0.06:
		_settle = 1.0
		_was_moving = false
	elif moving:
		_was_moving = true
	_settle = maxf(0.0, _settle - dt / 1.3)
	var lag_now := lag + 0.10 * _settle
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
		while _hist.size() > 2 and _hist[1][0] <= _t - lag - 0.14: _hist.pop_front()
		if not active: return
		var tt := _t - lag_now
		var j := 0
		while j < _hist.size() - 2 and _hist[j + 1][0] <= tt: j += 1
		var a: Array = _hist[j]
		if _hist.size() > j + 1 and a[0] < tt:
			var b: Array = _hist[j + 1]
			var k := clampf((tt - a[0]) / maxf(b[0] - a[0], 0.0001), 0.0, 1.0)
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
	# v0.8: it wears your simulated cloth (copied bone poses: cheaper than its own springs); on the Low
	# tier its cloth stays at rest and the shader's light cloth motion carries it
	var cm := "copy" if cloth_bones else "off"
	if cm != _cloth_mode:
		_cloth_mode = cm
		puppet.set_cloth(cm, player.fig)
	if puppet.hem != player.fig.hem * 1.25: puppet.set_hem(player.fig.hem * 1.25)
	if puppet.runes_awake != maxi(player.fig.runes_awake, 1): puppet.set_runes(maxi(player.fig.runes_awake, 1))
	src_pose = src_pose.copy()
	src_pose.sway += Vector2(0.0, 0.028 * sin((1.0 - _settle) * 11.0)) * _settle
	# now and then its hands are clasped at the chest, like the veiled statues, while yours hang
	_clasp_t -= dt
	if _clasp_t <= 0.0:
		_clasp_t = randf_range(25.0, 50.0)
		var tc := create_tween()
		tc.tween_property(self, "_clasp", 1.0, 1.4).set_trans(Tween.TRANS_SINE)
		tc.tween_interval(randf_range(3.0, 5.0))
		tc.tween_property(self, "_clasp", 0.0, 1.4).set_trans(Tween.TRANS_SINE)
	src_pose.clasp = _clasp
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
	var mirrored := refl_xf * src_xf
	# planar: the double stands in the real world (un-reflected) and the mirror camera sees it
	puppet.global_transform = refl_xf * mirrored if planar_on else mirrored
	if reach_override >= 0.0: src_pose.reach = reach_override
	puppet.apply_pose(src_pose)
	puppet.set_param("vis", vis)
	_footprints(src_pose)

## faint petrol footprints where IT steps, fading in 1.5 s (yours leave none)
func _footprints(pose: Figure.Pose) -> void:
	if _feet.is_empty(): return
	var s := sin(pose.phase)
	if pose.ripple > 0.3 and signf(s) != signf(_last_s) and _last_s != 0.0:
		_foot_side = -_foot_side
		var f := _feet[_foot_i]
		_foot_i = (_foot_i + 1) % _feet.size()
		var xf := puppet.global_transform
		var at := xf * Vector3(_foot_side * 0.075, 0.0, -0.02)
		f.global_transform = Transform3D(Basis(Vector3.UP, atan2(xf.basis.z.x, xf.basis.z.z)), at + Vector3(0, 0.014, 0))
		f.visible = true
		var m: ShaderMaterial = f.material_override
		m.set_shader_parameter("life", 0.0)
		var tw := f.create_tween()
		tw.tween_method(func(v: float) -> void: m.set_shader_parameter("life", v), 0.0, 1.0, 1.5)
		tw.tween_callback(func() -> void: f.visible = false)
	_last_s = s

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
