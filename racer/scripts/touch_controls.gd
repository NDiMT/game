class_name TouchControls
extends Control
## DRIFT KICK v2.2 controls.
## Left half: relative horizontal steering slider.
## Right half: one-thumb gesture pedal read relative to where the thumb landed:
##   press = gas, slide up past ~40 px = NITRO, slide down = brake / reverse, lift = coast.
##   Hysteresis: enter a zone at 40 px, leave at 28 px.
##   Quick sideways FLICK while holding: right = front weapon, left = rear weapon.
## Keyboard: A/D or arrows steer, W gas, S brake, Shift nitro, J front weapon, K rear weapon.

signal flicked(dir: int)

const RANGE := 58.0
const ENTER := 40.0
const LEAVE := 28.0
const FLICK_PX := 38.0
const FLICK_WIN := 0.14

var steer := 0.0
var throttle := 0.0
var brake := 0.0
var nitro := false
var active := false             # draw + read touch only during the race
var _fire_front := false
var _fire_rear := false

var _steer_id := -1
var _steer_x0 := 0.0
var _touch_steer := 0.0
var _ped_id := -1
var _ped_y0 := 0.0
var _ped_dy := 0.0
var _zone := ""                 # "" none, g gas, n nitro, b brake
var _hist: Array = []           # [time, x, y] of the pedal finger
var _flick_cool := 0.0
var _flick_show := 0.0
var _flick_dir := 0
var _kb := false
var _font: Font

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = ThemeDB.fallback_font

func consume_front() -> bool:
	var f := _fire_front; _fire_front = false; return f

func consume_rear() -> bool:
	var f := _fire_rear; _fire_rear = false; return f

func reset() -> void:
	_steer_id = -1; _ped_id = -1; _zone = ""; _touch_steer = 0.0; _ped_dy = 0.0
	_fire_front = false; _fire_rear = false

func _now() -> float:
	return Time.get_ticks_msec() / 1000.0

func _buzz(ms: int) -> void:
	Input.vibrate_handheld(ms)

func _input(e: InputEvent) -> void:
	if e is InputEventKey:
		var k := e as InputEventKey
		if k.pressed and not k.echo:
			if k.physical_keycode == KEY_J: _fire_front = true; _kb = true
			elif k.physical_keycode == KEY_K: _fire_rear = true; _kb = true
			elif k.physical_keycode in [KEY_A, KEY_D, KEY_W, KEY_S, KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN, KEY_SHIFT]: _kb = true
		return
	if not active: return
	if e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed:
			_kb = false
			if t.position.x < size.x * 0.5:
				if _steer_id < 0:
					_steer_id = t.index; _steer_x0 = t.position.x; _touch_steer = 0.0
			elif _ped_id < 0:
				_ped_id = t.index; _ped_y0 = t.position.y; _ped_dy = 0.0
				_hist = [[_now(), t.position.x, t.position.y]]
				_set_zone("g")
		else:
			if t.index == _steer_id: _steer_id = -1; _touch_steer = 0.0
			if t.index == _ped_id: _ped_id = -1; _ped_dy = 0.0; _zone = ""
	elif e is InputEventScreenDrag:
		var d := e as InputEventScreenDrag
		if d.index == _ped_id:
			var dy := _ped_y0 - d.position.y
			_ped_dy = dy
			match _zone:
				"g":
					if dy > ENTER: _set_zone("n")
					elif dy < -ENTER: _set_zone("b")
				"n":
					if dy < -ENTER: _set_zone("b")
					elif dy < LEAVE: _set_zone("g")
				"b":
					if dy > ENTER: _set_zone("n")
					elif dy > -LEAVE: _set_zone("g")
			_track_flick(d.position)
		elif d.index == _steer_id:
			var dx := d.position.x - _steer_x0
			if dx > RANGE: _steer_x0 = d.position.x - RANGE; dx = RANGE
			if dx < -RANGE: _steer_x0 = d.position.x + RANGE; dx = -RANGE
			_touch_steer = dx / RANGE

func _set_zone(z: String) -> void:
	if z == _zone: return
	_zone = z
	if z == "n": _buzz(18)
	elif z == "b": _buzz(14)
	elif z == "g": _buzz(8)

func _track_flick(p: Vector2) -> void:
	var now := _now()
	_hist.append([now, p.x, p.y])
	while _hist.size() > 2 and now - _hist[0][0] > FLICK_WIN: _hist.pop_front()
	if _flick_cool > 0.0: return
	var dx: float = p.x - _hist[0][1]
	var dy: float = p.y - _hist[0][2]
	if absf(dx) > FLICK_PX and absf(dx) > absf(dy) * 1.6:
		var dir := 1 if dx > 0 else -1
		if dir > 0: _fire_front = true
		else: _fire_rear = true
		_flick_cool = 0.3
		_flick_show = 0.35
		_flick_dir = dir
		_hist.clear()
		_buzz(25)
		flicked.emit(dir)

func _process(dt: float) -> void:
	_flick_cool = maxf(0.0, _flick_cool - dt)
	_flick_show = maxf(0.0, _flick_show - dt)
	var ks := 0.0
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): ks += 1.0
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): ks -= 1.0
	steer = ks if ks != 0.0 else _touch_steer
	var thr := 0.0; var brk := 0.0; var nit := false
	match _zone:
		"g": thr = 0.7 + 0.3 * clampf((_ped_dy + LEAVE) / (2.0 * LEAVE), 0.0, 1.0)
		"n": thr = 1.0; nit = true
		"b": brk = clampf(0.45 + (-_ped_dy - ENTER) / 70.0, 0.45, 1.0)
	var kgas := Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP)
	var kbrk := Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN)
	var knit := Input.is_physical_key_pressed(KEY_SHIFT)
	throttle = 1.0 if (kgas or knit) else thr
	brake = 1.0 if kbrk else brk
	nitro = knit or nit
	queue_redraw()

# ------------------------------------------------------------------ visuals
func _draw() -> void:
	if not active: return
	var W := size.x; var H := size.y
	var alpha := 0.35 if _kb else 1.0
	# steering slider (bottom-left)
	var sc := Vector2(98, H - 40)
	var on := _steer_id >= 0
	draw_line(sc - Vector2(66, 0), sc + Vector2(66, 0), Color(1, 1, 1, 0.22 * alpha), 8.0, true)
	draw_circle(sc - Vector2(66, 0), 4, Color(1, 1, 1, 0.22 * alpha))
	draw_circle(sc + Vector2(66, 0), 4, Color(1, 1, 1, 0.22 * alpha))
	var kx := sc.x + steer * 58.0
	draw_circle(Vector2(kx, sc.y), 19, Color(0, 0, 0, 0.3 * alpha))
	draw_circle(Vector2(kx, sc.y), 17, (Color(1.0, 0.8, 0.3) if on else Color(0.92, 0.94, 0.98)) * Color(1, 1, 1, 0.85 * alpha))
	draw_string(_font, Vector2(sc.x - 30, sc.y + 30), "STEER", HORIZONTAL_ALIGNMENT_CENTER, 60, 10, Color(1, 1, 1, 0.5 * alpha))
	# slim translucent pedal (right edge)
	var ph := minf(H * 0.52, 200.0)
	var pr := Rect2(W - 66, H - 22 - ph, 52, ph)
	var pon := _ped_id >= 0 or throttle > 0.0 or brake > 0.0
	var a := (0.9 if pon else 0.55) * alpha
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.08, 0.12, 0.3 * a)
	sb.set_corner_radius_all(26)
	sb.border_color = Color(1, 1, 1, 0.25 * a)
	sb.set_border_width_all(2)
	draw_style_box(sb, pr)
	var zh := ph / 3.0
	var zones := [["N2O", Color(1.0, 0.55, 0.12), "n"], ["GAS", Color(0.24, 0.86, 0.59), "g"], ["BRK", Color(1.0, 0.3, 0.3), "b"]]
	var cur := _zone
	if _ped_id < 0: cur = "n" if nitro else ("b" if brake > 0.0 else ("g" if throttle > 0.0 else ""))
	for i in 3:
		var z: Array = zones[i]
		var r := Rect2(pr.position.x + 4, pr.position.y + 4 + i * zh, pr.size.x - 8, zh - 8)
		if cur == z[2]:
			var hb := StyleBoxFlat.new()
			hb.bg_color = Color(z[1].r, z[1].g, z[1].b, 0.45 * a)
			hb.set_corner_radius_all(20)
			draw_style_box(hb, r)
		draw_string(_font, Vector2(r.position.x, r.get_center().y + 4), z[0], HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 11, Color(1, 1, 1, 0.75 * a))
	if _ped_id >= 0:
		var ky := clampf(pr.get_center().y - _ped_dy * 1.2, pr.position.y + 18, pr.end.y - 18)
		draw_circle(Vector2(pr.get_center().x, ky), 15, Color(1, 1, 1, 0.9))
	# flick feedback
	if _flick_show > 0.0:
		var fx := pr.position.x - 26 if _flick_dir < 0 else pr.end.x - 4
		var cy := pr.get_center().y
		var c := Color(1, 0.85, 0.3, _flick_show / 0.35)
		var s := float(_flick_dir)
		draw_colored_polygon(PackedVector2Array([Vector2(fx, cy - 14), Vector2(fx, cy + 14), Vector2(fx + s * 18, cy)]), c)
