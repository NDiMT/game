class_name Cinematic
extends Node
## v0.5: a small reusable cinematic player. A scene is a timeline built from four kinds of keys:
##   cam(t, dur, look_at, yaw, pitch, size)   the camera rig glides (sine ease) to a framing
##   anim(t, dur, f(k), ease)                 any value: puppets (hand, veil), fog, light, ripples
##   at(t, f, on_skip)                        a one-shot (an audio cue hook, a text line, a rune);
##                                            on_skip = false: dropped when the scene is skipped
##   line(t, text, hold)                      the one line of text
##   (v3) path(t, dur, points, looks, fov0, fov1)  a PERSPECTIVE camera (CineCam) flies a Catmull-Rom path, looking
##                                            along another (dolly, crane, push-in); the gameplay camera waits
##   (v3) handoff(t, dur)                     the CineCam glides onto the gameplay framing, its fov closing to a
##                                            near-orthographic 8 deg, and the fixed camera takes over: no cut seen
## Everything is evaluated from one clock, so skip() just runs the clock to the end: every
## animation lands on its final value and every state change happens, in order; sounds and lines
## are dropped. A long press skips (main.gd).

signal finished
signal cue(name: String)

var game: Game
var length := 0.0
var t := 0.0
var running := false
var skipping := false
var _events: Array = []        # [time, Callable, on_skip, done]
var _anims: Array = []         # [t0, dur, Callable(k), ease, started]
var _cams: Array = []          # [t0, dur, look, yaw, pitch, size, from(Array or null)]
var _paths: Array = []         # (v3) [t0, dur, points, looks, fov0, fov1, ease]
var _handoffs: Array = []      # (v3) [t0, dur, from [pos, look, fov] or null]
var cine_cam: Camera3D         # (v3) the perspective camera, made on the first path
const HANDOFF_FOV := 8.0

func _init(g: Game) -> void:
	game = g

func clear() -> void:
	_events.clear(); _anims.clear(); _cams.clear(); _paths.clear(); _handoffs.clear()
	length = 0.0; t = 0.0

func at(time: float, f: Callable, on_skip := true) -> void:
	_events.append([time, f, on_skip, false])
	length = maxf(length, time)

func audio(time: float, name: String) -> void:
	at(time, func() -> void: cue.emit(name), false)

func line(time: float, text: String, hold: float) -> void:
	at(time, func() -> void: game.ui.show_cine_line(text, hold), false)
	length = maxf(length, time + hold + 3.6)

## ease: 0 linear, 1 sine in-out, 2 ease out (quad), 3 ease in (quad)
func anim(time: float, dur: float, f: Callable, ease := 1) -> void:
	_anims.append([time, maxf(dur, 0.001), f, ease, false])
	length = maxf(length, time + dur)

func cam(time: float, dur: float, look: Vector3, yaw: float, pitch: float, size: float) -> void:
	_cams.append([time, maxf(dur, 0.001), look, yaw, pitch, size, null])
	length = maxf(length, time + dur)

## (v3) the perspective camera flies `points` (>= 2) while looking along `looks` (1 = a fixed target); fov in degrees
## (horizontal, like the gameplay view's fixed width); fov1 < 0 keeps fov0
func path(time: float, dur: float, points: Array, looks: Array, fov0 := 40.0, fov1 := -1.0, ease := 1) -> void:
	_paths.append([time, maxf(dur, 0.001), points, looks, fov0, fov0 if fov1 < 0.0 else fov1, ease])
	length = maxf(length, time + dur)

## (v3) glide the CineCam onto the gameplay framing, then hand over to the fixed orthographic camera
func handoff(time: float, dur: float) -> void:
	_handoffs.append([time, maxf(dur, 0.001), null])
	length = maxf(length, time + dur)

## a point on a Catmull-Rom spline through pts (k 0..1 over the whole path; the ends are clamped)
static func catmull(pts: Array, k: float) -> Vector3:
	var n := pts.size()
	if n == 1: return pts[0]
	var f := clampf(k, 0.0, 1.0) * (n - 1)
	var i := mini(int(f), n - 2)
	var u := f - i
	var p0: Vector3 = pts[maxi(i - 1, 0)]
	var p1: Vector3 = pts[i]
	var p2: Vector3 = pts[i + 1]
	var p3: Vector3 = pts[mini(i + 2, n - 1)]
	return 0.5 * ((2.0 * p1) + (-p0 + p2) * u + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u * u)

func _cine_cam() -> Camera3D:
	if cine_cam == null:
		cine_cam = Camera3D.new()
		cine_cam.name = "CineCam"
		cine_cam.projection = Camera3D.PROJECTION_PERSPECTIVE
		cine_cam.keep_aspect = game.world.cam.keep_aspect
		cine_cam.near = 0.05
		cine_cam.far = 400.0
		cine_cam.cull_mask = game.world.cam.cull_mask
		cine_cam.environment = game.world.cam.environment
		cine_cam.attributes = game.world.cam.attributes
		game.world.add_child(cine_cam)
	if not cine_cam.current: cine_cam.make_current()
	return cine_cam

func _place(pos: Vector3, look: Vector3, fov: float) -> void:
	var c := _cine_cam()
	if pos.distance_to(look) < 0.001: look = pos + Vector3.FORWARD
	var up := Vector3.UP if absf((look - pos).normalized().y) < 0.995 else Vector3.BACK
	c.look_at_from_position(pos, look, up)
	c.fov = fov

## where the gameplay view's centre ray meets its follow height, and the perspective eye that frames the same width
func _gameplay_frame(fov: float) -> Array:
	var w := game.world
	var xf := w.cam.global_transform
	var fwd := -xf.basis.z
	var o := xf.origin + xf.basis.x * w.cam.h_offset + xf.basis.y * w.cam.v_offset
	var gy := w.rig.global_position.y
	var tgt := o + fwd * ((gy - o.y) / fwd.y) if absf(fwd.y) > 0.01 else o + fwd * 20.0
	var d := w.cam.size * 0.5 / tan(deg_to_rad(fov) * 0.5)
	return [tgt - fwd * d, tgt]

static func ease_k(k: float, e: int) -> float:
	k = clampf(k, 0.0, 1.0)
	match e:
		1: return 0.5 - 0.5 * cos(PI * k)
		2: return 1.0 - (1.0 - k) * (1.0 - k)
		3: return k * k
	return k

func start() -> void:
	t = 0.0
	running = true
	skipping = false
	_events.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
	game.world.follow = null
	game.world.cam_lock = true
	_step(0.0)

func skip() -> void:
	if not running: return
	skipping = true
	game.ui.hide_cine_line()
	_step(length - t + 0.001)

func _process(dt: float) -> void:
	if running: _step(dt)

func _step(dt: float) -> void:
	t += dt
	var w := game.world
	for c in _cams:
		if t < c[0]: continue
		if c[6] == null: c[6] = [w.rig.position, w.rig.rotation.y, w.pitch_node.rotation.x, w.cam.size]
		var k := ease_k((t - c[0]) / c[1], 1)
		var from: Array = c[6]
		if k >= 1.0 and t > c[0] + c[1] + 0.5: continue
		w.rig.position = (from[0] as Vector3).lerp(c[2], k)
		w.rig.rotation.y = lerp_angle(from[1], c[3], k)
		w.pitch_node.rotation.x = lerpf(from[2], c[4], k)
		w.cam.size = lerpf(from[3], c[5], k)
	for pth in _paths:
		if t < pth[0] or t > pth[0] + pth[1] + 0.5: continue
		var kp := ease_k((t - pth[0]) / pth[1], pth[6])
		_place(catmull(pth[2], kp), catmull(pth[3], kp), lerpf(pth[4], pth[5], kp))
	for h in _handoffs:
		if t < h[0]: continue
		if h[2] == null:
			var c0 := _cine_cam()
			h[2] = [c0.global_position, c0.global_position - c0.global_transform.basis.z * 10.0, c0.fov]
		var kh := ease_k((t - h[0]) / h[1], 1)
		if kh >= 1.0:
			if cine_cam and cine_cam.current: w.cam.make_current()
			continue
		var fr: Array = h[2]
		var fov := lerpf(fr[2], HANDOFF_FOV, kh)
		var to := _gameplay_frame(fov)
		_place((fr[0] as Vector3).lerp(to[0], kh), (fr[1] as Vector3).lerp(to[1], kh), fov)
	for a in _anims:
		if t < a[0]: continue
		var k2: float = (t - a[0]) / a[1]
		if k2 > 1.0 and a[4]: continue
		if k2 >= 1.0: a[4] = true          # the last evaluation lands exactly on 1
		(a[2] as Callable).call(ease_k(k2, a[3]))
	for e in _events:
		if e[3] or t < e[0]: continue
		e[3] = true
		if skipping and not e[2]: continue
		(e[1] as Callable).call()
	if t >= length and running:
		if cine_cam and cine_cam.current: w.cam.make_current()          # (v3) never leave the CineCam on
		running = false
		finished.emit()
