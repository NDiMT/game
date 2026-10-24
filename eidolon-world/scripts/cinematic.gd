class_name Cinematic
extends Node
## v0.5: a small reusable cinematic player. A scene is a timeline built from four kinds of keys:
##   cam(t, dur, look_at, yaw, pitch, size)   the camera rig glides (sine ease) to a framing
##   anim(t, dur, f(k), ease)                 any value: puppets (hand, veil), fog, light, ripples
##   at(t, f, on_skip)                        a one-shot (an audio cue hook, a text line, a rune);
##                                            on_skip = false: dropped when the scene is skipped
##   line(t, text, hold)                      the one line of text
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

func _init(g: Game) -> void:
	game = g

func clear() -> void:
	_events.clear(); _anims.clear(); _cams.clear()
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
		running = false
		finished.emit()
