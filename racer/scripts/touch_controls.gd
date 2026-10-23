class_name TouchControls
extends Control
## Touch + keyboard input (DRIFT KICK v2.2 base) with four weapon schemes:
##  BUTTONS (default): 3 round skill buttons above the steer slider (ROCKET, MINE, ULTIMATE);
##                     while the thumb is off the slider the steer eases to centre over 0.3 s.
##  TAP:   double-tap right pedal = rocket, double-tap left side = mine, swipe up left = ultimate
##         (steer holds its last value during the tap gap).
##  FLICK: sideways flick on the pedal (v0.1): right = rocket, left = mine; swipe up left = ultimate.
##  AUTO:  rockets / mines fire by themselves (option only); swipe up left = ultimate.
## Left half: relative steer slider. Right half: one-thumb pedal (press = gas, up = NITRO,
## down = brake / reverse, lift = coast, 40/28 px hysteresis).
## Keyboard: A/D or arrows steer, W gas, S brake, Shift nitro, J rocket, K mine, E ultimate.

const RANGE := 58.0
const ENTER := 40.0
const LEAVE := 28.0
const FLICK_PX := 38.0
const FLICK_WIN := 0.14
const DTAP := 0.25
const SWIPE_UP := 60.0
const STEER_EASE := 0.3
const TOPBAR_H := 46.0

var game: Node
var mode := "buttons"
var steer := 0.0
var throttle := 0.0
var brake := 0.0
var nitro := false
var active := false
var ult_rect := Rect2()          # tappable ULTIMATE badge (non-button modes), set by the HUD

var _want := {"rocket": false, "mine": false, "ult": false}
var _steer_id := -1
var _steer_x0 := 0.0
var _steer_y0 := 0.0
var _touch_steer := 0.0
var _steer_release_t := -10.0
var _held := 0.0
var _swiped := false
var _ped_id := -1
var _ped_y0 := 0.0
var _ped_dy := 0.0
var _ped_release_t := -10.0
var _zone := ""
var _hist: Array = []
var _flick_cool := 0.0
var _flick_show := 0.0
var _flick_dir := 0
var _kb := false
var _font: Font
var _press := {"rocket": 0.0, "mine": 0.0, "ult": 0.0}
var _rings: Array = []           # [pos, age, colour]
var _t := 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = ThemeDB.fallback_font

func consume(what: String) -> bool:
	var v: bool = _want[what]
	_want[what] = false
	return v

func reset() -> void:
	_steer_id = -1; _ped_id = -1; _zone = ""; _touch_steer = 0.0; _ped_dy = 0.0; _held = 0.0
	for k in _want: _want[k] = false

func _now() -> float:
	return Time.get_ticks_msec() / 1000.0

func _buzz(ms: int) -> void:
	Input.vibrate_handheld(ms)

func _ring(p: Vector2, col := Color(1, 0.85, 0.3)) -> void:
	_rings.append([p, 0.0, col])

## round skill buttons above the steer slider: id -> [centre, radius]
func button_layout() -> Dictionary:
	var y := size.y - 112.0
	var r := 29.0
	return {"rocket": [Vector2(48, y), r], "mine": [Vector2(48 + 68, y), r], "ult": [Vector2(48 + 136, y), r]}

func _fire(what: String, at: Vector2) -> void:
	_want[what] = true
	_press[what] = 0.18
	_ring(at, Color(1, 0.5, 0.2) if what == "rocket" else (Color(1, 0.3, 0.25) if what == "mine" else Color(1, 0.85, 0.3)))
	_buzz(22)

func _input(e: InputEvent) -> void:
	if e is InputEventKey:
		var k := e as InputEventKey
		if k.pressed and not k.echo:
			match k.physical_keycode:
				KEY_J: _want.rocket = true; _press.rocket = 0.18; _kb = true
				KEY_K: _want.mine = true; _press.mine = 0.18; _kb = true
				KEY_E: _want.ult = true; _press.ult = 0.18; _kb = true
				KEY_A, KEY_D, KEY_W, KEY_S, KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN, KEY_SHIFT: _kb = true
		return
	if not active: return
	if e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed: _on_press(t.index, t.position)
		else: _on_release(t.index)
	elif e is InputEventScreenDrag:
		var d := e as InputEventScreenDrag
		if d.index == _ped_id: _on_pedal_drag(d.position)
		elif d.index == _steer_id: _on_steer_drag(d.position)

func _on_press(idx: int, p: Vector2) -> void:
	_kb = false
	if p.y < TOPBAR_H and absf(p.x - size.x * 0.5) < 160.0: return # top bar buttons
	var now := _now()
	if mode == "buttons":
		var lay := button_layout()
		for id: String in lay:
			if p.distance_to(lay[id][0]) < lay[id][1] + 8.0:
				_fire(id, p)
				return
	elif ult_rect.has_point(p):
		_fire("ult", p)
		return
	if p.x < size.x * 0.5:
		if _steer_id >= 0: return
		_steer_id = idx
		_steer_y0 = p.y
		_swiped = false
		if mode == "tap" and now - _steer_release_t < DTAP: _fire("mine", p)
		# keep steering continuous when the thumb comes back (tap gap / back from a button)
		var carry := steer if (mode in ["tap", "buttons"] and now - _steer_release_t < maxf(DTAP, STEER_EASE)) else 0.0
		_touch_steer = carry
		_steer_x0 = p.x - carry * RANGE
	elif _ped_id < 0:
		if mode == "tap" and now - _ped_release_t < DTAP: _fire("rocket", p)
		_ped_id = idx
		_ped_y0 = p.y
		_ped_dy = 0.0
		_hist = [[now, p.x, p.y]]
		_set_zone("g")

func _on_release(idx: int) -> void:
	if idx == _steer_id:
		_steer_id = -1
		_held = _touch_steer
		_steer_release_t = _now()
		_touch_steer = 0.0
	if idx == _ped_id:
		_ped_id = -1
		_ped_dy = 0.0
		_zone = ""
		_ped_release_t = _now()

func _on_steer_drag(p: Vector2) -> void:
	var dx := p.x - _steer_x0
	if dx > RANGE: _steer_x0 = p.x - RANGE; dx = RANGE
	if dx < -RANGE: _steer_x0 = p.x + RANGE; dx = -RANGE
	_touch_steer = dx / RANGE
	if mode != "buttons" and not _swiped and _steer_y0 - p.y > SWIPE_UP:
		_swiped = true
		_fire("ult", p)

func _on_pedal_drag(p: Vector2) -> void:
	var dy := _ped_y0 - p.y
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
	if mode == "flick": _track_flick(p)

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
		_flick_dir = 1 if dx > 0 else -1
		_fire("rocket" if _flick_dir > 0 else "mine", p)
		_flick_cool = 0.3
		_flick_show = 0.35
		_hist.clear()

func _process(dt: float) -> void:
	_t += dt
	_flick_cool = maxf(0.0, _flick_cool - dt)
	_flick_show = maxf(0.0, _flick_show - dt)
	for k in _press: _press[k] = maxf(0.0, _press[k] - dt)
	for r in _rings: r[1] += dt
	_rings = _rings.filter(func(r: Array) -> bool: return r[1] < 0.45)
	var ks := 0.0
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): ks += 1.0
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): ks -= 1.0
	var ts := _touch_steer
	if _steer_id < 0:
		var gap := _now() - _steer_release_t
		if mode == "buttons": ts = _held * maxf(0.0, 1.0 - gap / STEER_EASE)
		elif mode == "tap": ts = _held if gap < DTAP else 0.0
		else: ts = 0.0
	steer = ks if ks != 0.0 else ts
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
	if mode == "buttons": _draw_buttons()
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
	if _flick_show > 0.0:
		var fx := pr.position.x - 26 if _flick_dir < 0 else pr.end.x - 4
		var cy := pr.get_center().y
		var c := Color(1, 0.85, 0.3, _flick_show / 0.35)
		var s := float(_flick_dir)
		draw_colored_polygon(PackedVector2Array([Vector2(fx, cy - 14), Vector2(fx, cy + 14), Vector2(fx + s * 18, cy)]), c)
	# tap rings: show where a gesture registered
	for r in _rings:
		var k: float = r[1] / 0.45
		var col: Color = r[2]
		col.a = 1.0 - k
		draw_arc(r[0], 14.0 + k * 34.0, 0.0, TAU, 32, col, 4.0 * (1.0 - k) + 1.0, true)

func _draw_buttons() -> void:
	var p: Car = game.player if game else null
	if p == null or p.weapons == null: return
	var ws: WeaponSystem = p.weapons
	var lay := button_layout()
	for id: String in lay:
		var c: Vector2 = lay[id][0]
		var r: float = lay[id][1]
		var k: float = _press[id] / 0.18
		r *= 1.0 - 0.12 * sin(k * PI)
		var slot: String = {"rocket": "front", "mine": "rear", "ult": "ultimate"}[id]
		var n := ws.ammo(slot)
		var ready := n > 0 if id != "ult" else ws.ult >= 1.0
		var base := Color(0.08, 0.06, 0.05, 0.55)
		var rim := Color(1, 1, 1, 0.35)
		if id == "ult" and ready:
			var pulse := 0.5 + 0.5 * sin(_t * 7.0)
			draw_circle(c, r + 6.0 + pulse * 4.0, Color(1.0, 0.6, 0.1, 0.25 + 0.2 * pulse))
			base = Color(0.95, 0.55, 0.1, 0.85)
			rim = Color(1, 0.95, 0.6, 1)
		if id == "rocket" and ws.is_locked() and n > 0:
			var pulse2 := 0.5 + 0.5 * sin(_t * 14.0)
			draw_circle(c, r + 5.0 + pulse2 * 3.0, Color(1.0, 0.25, 0.1, 0.35 + 0.25 * pulse2))
			rim = Color(1, 0.35, 0.2, 1)
		draw_circle(c, r, base)
		draw_arc(c, r, 0.0, TAU, 40, rim, 2.5, true)
		# lock progress / ULT meter arc
		if id == "rocket" and ws.lock_target and ws.lock_progress > 0.0 and not ws.is_locked():
			draw_arc(c, r - 4.0, -PI / 2, -PI / 2 + TAU * ws.lock_progress, 32, Color(1, 0.55, 0.2, 0.9), 3.0, true)
		if id == "ult" and not ready:
			draw_arc(c, r - 4.0, -PI / 2, -PI / 2 + TAU * ws.ult, 32, Color(1, 0.8, 0.3, 0.8), 3.0, true)
		# cooldown sweep
		if slot != "ultimate":
			var sd: Dictionary = ws.slots[slot]
			var cd: float = sd.cool / maxf(0.01, sd.def.cooldown)
			if cd > 0.0:
				var pts := PackedVector2Array([c])
				for i in 21: pts.append(c + Vector2.from_angle(-PI / 2 + TAU * cd * i / 20.0) * (r - 1.0))
				draw_colored_polygon(pts, Color(0, 0, 0, 0.45))
		var ic := Color(1, 1, 1, 0.95) if ready else Color(1, 1, 1, 0.35)
		_icon(id, c, ic)
		if id != "ult":
			var bc := c + Vector2(r * 0.72, -r * 0.72)
			draw_circle(bc, 10.0, Color(0.95, 0.2, 0.15) if n == 0 else Color(0.12, 0.1, 0.1, 0.95))
			draw_string(_font, bc + Vector2(-10, 5), str(n), HORIZONTAL_ALIGNMENT_CENTER, 20, 13, Color.WHITE)
		else:
			draw_string(_font, c + Vector2(-r, r + 12), "ULT" if not ready else "READY", HORIZONTAL_ALIGNMENT_CENTER, r * 2, 10, Color(1, 0.9, 0.6, 0.9 if ready else 0.5))

func _icon(id: String, c: Vector2, col: Color) -> void:
	match id:
		"rocket":
			draw_rect(Rect2(c - Vector2(11, 4), Vector2(17, 8)), col)
			draw_colored_polygon(PackedVector2Array([c + Vector2(6, -5), c + Vector2(6, 5), c + Vector2(14, 0)]), Color(1, 0.45, 0.2, col.a))
			draw_colored_polygon(PackedVector2Array([c + Vector2(-11, -4), c + Vector2(-16, -9), c + Vector2(-6, -4)]), col)
			draw_colored_polygon(PackedVector2Array([c + Vector2(-11, 4), c + Vector2(-16, 9), c + Vector2(-6, 4)]), col)
		"mine":
			for i in 8:
				var d := Vector2.from_angle(i * TAU / 8.0)
				draw_line(c + d * 9.0, c + d * 15.0, col, 3.0, true)
			draw_circle(c, 10.0, Color(0.35, 0.35, 0.38, col.a))
			draw_arc(c, 10.0, 0, TAU, 20, Color(1, 0.75, 0.1, col.a), 2.0, true)
			draw_circle(c, 3.5, Color(1, 0.15, 0.1, col.a))
		"ult":
			for i in 3:
				var o := Vector2((i - 1) * 7.0, (1 - absi(i - 1)) * -4.0)
				draw_rect(Rect2(c + o - Vector2(2.5, 7), Vector2(5, 13)), col)
				draw_colored_polygon(PackedVector2Array([c + o + Vector2(-3, -7), c + o + Vector2(3, -7), c + o + Vector2(0, -12)]), Color(1, 0.5, 0.2, col.a))
