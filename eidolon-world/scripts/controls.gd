class_name Controls
extends CanvasLayer
## Touch controls, all drawn in code:
##   - a floating joystick on the left half: it appears where the thumb lands
##   - an interact button bottom-right that only appears (and breathes) when something is in reach,
##     with a contextual icon: read, rune, turn, lever, locked, wake
##   - two small rotate buttons (top right), and a two-finger twist anywhere
## Mouse input arrives as emulated touch (project setting), so desktop clicks drive the same code.

signal interact
signal rotate(dir: int)
signal zoom(level: int)
signal shard                       # v0.5: the inventory slot tapped (raise / lower the mirror shard)

const JOY_R := 54.0
const BTN_R := 36.0

var vec := Vector2.ZERO            # joystick output, screen space (x right, y down), length <= 1
var enabled := false
var joy_index := -1
var joy_base := Vector2.ZERO
var joy_knob := Vector2.ZERO
var joy_alpha := 0.0
var icon := ""
var icon_alpha := 0.0
var _press := 0.0
var _touches := {}
var _twist_a := 0.0
var _twist_on := false
var _t := 0.0
var canvas: Pad
var inv_has := false               # v0.5: the mirror shard is carried
var inv_on := false                # ...and raised
var inv_alpha := 0.0
var _inv_press := 0.0

func _ready() -> void:
	layer = 6
	canvas = Pad.new()
	canvas.ctl = self
	canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(canvas)

func vp_size() -> Vector2:
	return canvas.size

func btn_center() -> Vector2:
	var s := vp_size()
	return Vector2(s.x - 66.0, s.y - 118.0)

func rot_center(dir: int) -> Vector2:
	var s := vp_size()
	return Vector2(s.x - (34.0 if dir > 0 else 80.0), 44.0)

## the inventory slot, top left under the shrine counter
func inv_center() -> Vector2:
	return Vector2(44.0, 98.0)

func set_icon(name: String) -> void:
	if name != "": icon = name

const MOUSE_ID := 99
var block_t := 0.0

## ignore taps and gestures for a moment (after an overlay closes: its tap must not reach the world)
func block(ms: int) -> void:
	block_t = ms / 1000.0
	_touches.clear()
	_end_joy()
	_twist_on = false

func blocked() -> bool:
	return block_t > 0.0

func _input(e: InputEvent) -> void:
	if not enabled: return
	if blocked():
		if e is InputEventScreenTouch and not e.pressed: _touches.erase(e.index)
		return
	# desktop: the mouse drives the same code as a finger (touch emulation is off so a real touch
	# is never seen twice)
	if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and e.device != InputEvent.DEVICE_ID_EMULATION:
		var t := InputEventScreenTouch.new()
		t.index = MOUSE_ID; t.position = e.position; t.pressed = e.pressed
		e = t
	elif e is InputEventMouseMotion and _touches.has(MOUSE_ID) and e.device != InputEvent.DEVICE_ID_EMULATION:
		var dr := InputEventScreenDrag.new()
		dr.index = MOUSE_ID; dr.position = e.position
		e = dr
	if e is InputEventScreenTouch:
		var p: Vector2 = canvas.get_global_transform_with_canvas().affine_inverse() * e.position
		if e.pressed:
			_touches[e.index] = p
			if inv_has and inv_alpha > 0.3 and p.distance_to(inv_center()) < 34.0:
				_inv_press = 1.0
				shard.emit()
				return
			if icon_alpha > 0.3 and p.distance_to(btn_center()) < BTN_R + 14.0:
				_press = 1.0
				interact.emit()
				return
			for d in [-1, 1]:
				if p.distance_to(rot_center(d)) < 24.0:
					rotate.emit(d)
					return
			if _touches.size() >= 2:
				_begin_twist()
				_end_joy()
				return
			if joy_index < 0 and p.x < vp_size().x * 0.6:
				joy_index = e.index
				joy_base = p
				joy_knob = p
				vec = Vector2.ZERO
		else:
			_touches.erase(e.index)
			if e.index == joy_index: _end_joy()
			if _touches.size() < 2: _twist_on = false
	elif e is InputEventScreenDrag:
		var p2: Vector2 = canvas.get_global_transform_with_canvas().affine_inverse() * e.position
		if _touches.has(e.index): _touches[e.index] = p2
		if _twist_on and _touches.size() >= 2:
			var a := _pair_angle()
			var d := wrapf(a - _twist_a, -PI, PI)
			var ratio := _pair_dist() / maxf(_pinch_d, 1.0)
			if absf(d) > 0.55:
				rotate.emit(1 if d > 0.0 else -1)
				_twist_a = a
				_pinch_d = _pair_dist()
			elif ratio > 1.3 or ratio < 0.77:
				zoom.emit(1 if ratio > 1.0 else 0)        # spread = closer (1), pinch = the default far view (0)
				_pinch_d = _pair_dist()
				_twist_a = a
			return
		if e.index == joy_index:
			var off := p2 - joy_base
			if off.length() > JOY_R:
				# the base follows a thumb that wanders too far
				joy_base = p2 - off.normalized() * JOY_R
				off = p2 - joy_base
			joy_knob = p2
			vec = off / JOY_R
			if vec.length() < 0.12: vec = Vector2.ZERO

var _pinch_d := 1.0

func _begin_twist() -> void:
	_twist_on = true
	_twist_a = _pair_angle()
	_pinch_d = _pair_dist()

func _pair_dist() -> float:
	var ks := _touches.keys()
	return (_touches[ks[0]] as Vector2).distance_to(_touches[ks[1]])

func _pair_angle() -> float:
	var ks := _touches.keys()
	var a: Vector2 = _touches[ks[0]]
	var b: Vector2 = _touches[ks[1]]
	return (b - a).angle()

func _end_joy() -> void:
	joy_index = -1
	vec = Vector2.ZERO

func reset() -> void:
	_touches.clear()
	_end_joy()
	_twist_on = false

func _process(dt: float) -> void:
	block_t = maxf(0.0, block_t - dt)
	_t += dt
	joy_alpha = move_toward(joy_alpha, 1.0 if joy_index >= 0 else 0.0, dt * (6.0 if joy_index >= 0 else 3.0))
	icon_alpha = move_toward(icon_alpha, 1.0 if (enabled and _want_icon) else 0.0, dt * 4.0)
	_press = move_toward(_press, 0.0, dt * 4.0)
	_inv_press = move_toward(_inv_press, 0.0, dt * 4.0)
	inv_alpha = move_toward(inv_alpha, 1.0 if (enabled and inv_has) else 0.0, dt * 2.0)
	canvas.queue_redraw()

var _want_icon := false
func show_interact(name: String) -> void:
	_want_icon = name != ""
	set_icon(name)


class Pad extends Control:
	var ctl: Controls
	const INK := Color(0.97, 0.96, 0.92)
	const CY := Palette.CORE

	func _draw() -> void:
		if ctl == null: return
		var e := 1.0 if ctl.enabled else 0.0
		# rotate buttons
		for d in [-1, 1]:
			var c := ctl.rot_center(d)
			draw_circle(c, 18.0, Color(0.08, 0.08, 0.09, 0.26 * e))
			draw_arc(c, 18.0, 0, TAU, 40, Color(INK, 0.45 * e), 1.0, true)
			for k in 4:
				var dv2 := Vector2(cos(PI * 0.5 * k), sin(PI * 0.5 * k))
				draw_line(c + dv2 * 18.5, c + dv2 * 21.5, Color(INK, 0.4 * e), 1.0, true)
			var a0 := -PI * 0.85 if d > 0 else -PI * 0.15
			var a1 := a0 + (PI * 1.3 if d > 0 else -PI * 1.3)
			draw_arc(c, 8.0, minf(a0, a1), maxf(a0, a1), 20, Color(INK, 0.85 * e), 1.4, true)
			var tip := c + Vector2(cos(a1), sin(a1)) * 8.0
			var tang := Vector2(-sin(a1), cos(a1)) * float(d)
			draw_line(tip, tip - tang * 4.5 + Vector2(cos(a1), sin(a1)) * 3.0, Color(INK, 0.85 * e), 1.4, true)
			draw_line(tip, tip - tang * 4.5 - Vector2(cos(a1), sin(a1)) * 3.0, Color(INK, 0.85 * e), 1.4, true)
		# the inventory: one round slot, the shard inside (lit while raised)
		if ctl.inv_alpha > 0.0:
			var ia := ctl.inv_alpha
			var ic := ctl.inv_center()
			var ir := 22.0 * (1.0 + ctl._inv_press * 0.1)
			if ctl.inv_on:
				for i in 5: draw_circle(ic, ir + 3.0 + i * 3.0, Color(CY, 0.05 * ia * (1.0 - i / 5.0)))
			draw_circle(ic, ir, Color(0.06, 0.07, 0.08, 0.34 * ia))
			draw_arc(ic, ir, 0, TAU, 48, Color(CY if ctl.inv_on else INK, (0.85 if ctl.inv_on else 0.5) * ia), 1.3, true)
			for k in 4:
				var dv3 := Vector2(cos(PI * 0.5 * k + PI * 0.25), sin(PI * 0.5 * k + PI * 0.25))
				draw_line(ic + dv3 * (ir - 1.0), ic + dv3 * (ir + 3.5), Color(INK, 0.35 * ia), 1.0, true)
			_icon("shard", ic, 11.0, Color(INK, 0.95 * ia), Color(CY, ia))
		# floating joystick
		if ctl.joy_alpha > 0.0:
			var a := ctl.joy_alpha
			var b := ctl.joy_base
			draw_circle(b, Controls.JOY_R + 6.0, Color(0.06, 0.06, 0.07, 0.10 * a))
			draw_arc(b, Controls.JOY_R, 0, TAU, 64, Color(INK, 0.55 * a), 1.2, true)
			draw_arc(b, Controls.JOY_R - 6.0, 0, TAU, 64, Color(INK, 0.16 * a), 1.0, true)
			for k in 4:
				var an := PI * 0.5 * k
				var dir := Vector2(cos(an), sin(an))
				draw_line(b + dir * (Controls.JOY_R - 3.0), b + dir * (Controls.JOY_R + 4.0), Color(INK, 0.5 * a), 1.0, true)
			var kp := b + (ctl.joy_knob - b).limit_length(Controls.JOY_R)
			draw_circle(kp, 21.0, Color(0.07, 0.07, 0.08, 0.30 * a))
			draw_arc(kp, 21.0, 0, TAU, 40, Color(INK, 0.85 * a), 1.3, true)
			draw_circle(kp, 3.0, Color(CY, 0.8 * a))
		# interact button
		if ctl.icon_alpha > 0.0:
			var a2 := ctl.icon_alpha
			var c2 := ctl.btn_center()
			var breathe := 0.5 + 0.5 * sin(ctl._t * 2.6)
			var r := Controls.BTN_R * (1.0 + ctl._press * 0.08)
			for i in 6:
				draw_circle(c2, r + 4.0 + i * 3.0, Color(CY, (0.035 + 0.02 * breathe) * a2 * (1.0 - i / 6.0)))
			draw_circle(c2, r, Color(0.06, 0.07, 0.08, 0.40 * a2))
			# the rune frame: a ring with four cardinal ticks, as every rune of the sculptor has
			draw_arc(c2, r, 0, TAU, 64, Color(CY, (0.55 + 0.35 * breathe) * a2), 1.5, true)
			draw_arc(c2, r - 5.0, 0, TAU, 64, Color(INK, 0.16 * a2), 1.0, true)
			for k in 4:
				var dv := Vector2(cos(PI * 0.5 * k), sin(PI * 0.5 * k))
				draw_line(c2 + dv * (r + 2.0), c2 + dv * (r + 8.0), Color(CY, (0.6 + 0.3 * breathe) * a2), 1.4, true)
			_icon(ctl.icon, c2, 13.0, Color(INK, 0.95 * a2), Color(CY, a2))

	func _icon(name: String, c: Vector2, s: float, col: Color, cy: Color) -> void:
		match name:
			"read":
				# an open tablet with carved lines
				var r := Rect2(c - Vector2(s * 0.8, s * 0.9), Vector2(s * 1.6, s * 1.8))
				draw_rect(r, col, false, 1.4)
				for k in 3:
					var y := r.position.y + s * (0.45 + k * 0.42)
					draw_line(Vector2(r.position.x + s * 0.3, y), Vector2(r.end.x - s * 0.3 - k * s * 0.15, y), col, 1.2, true)
			"rune":
				draw_arc(c, s * 0.95, 0, TAU, 32, col, 1.4, true)
				for k in 4:
					var dir := Vector2(cos(PI * 0.5 * k), sin(PI * 0.5 * k))
					draw_line(c + dir * s * 0.95, c + dir * s * 1.2, col, 1.4, true)
				draw_arc(c, s * 0.35, 0, TAU, 20, cy, 1.4, true)
				draw_circle(c, 1.8, cy)
			"turn":
				draw_arc(c, s * 0.85, -PI * 0.9, PI * 0.55, 28, col, 1.5, true)
				var tip := c + Vector2(cos(PI * 0.55), sin(PI * 0.55)) * s * 0.85
				draw_line(tip, tip + Vector2(s * 0.45, -s * 0.05), col, 1.5, true)
				draw_line(tip, tip + Vector2(0.05 * s, -s * 0.45), col, 1.5, true)
				draw_line(c - Vector2(0, s * 0.5), c + Vector2(0, s * 0.5), cy, 1.4, true)
			"lever":
				draw_line(c + Vector2(-s, s * 0.7), c + Vector2(s, s * 0.7), col, 1.4, true)
				draw_line(c + Vector2(0, s * 0.7), c + Vector2(s * 0.5, -s * 0.7), col, 1.6, true)
				draw_circle(c + Vector2(s * 0.5, -s * 0.7), s * 0.22, cy)
			"locked":
				draw_rect(Rect2(c + Vector2(-s * 0.6, -s * 0.1), Vector2(s * 1.2, s * 0.95)), col, false, 1.4)
				draw_arc(c + Vector2(0, -s * 0.1), s * 0.42, PI, TAU, 16, col, 1.4, true)
			"wake":
				draw_circle(c, s * 0.3, cy)
				for k in 8:
					var dir := Vector2(cos(TAU * k / 8.0), sin(TAU * k / 8.0))
					draw_line(c + dir * s * 0.55, c + dir * s * (0.95 if k % 2 == 0 else 0.8), col, 1.3, true)
			"breathe":
				# three soft curls of breath toward a small pane
				draw_rect(Rect2(c + Vector2(s * 0.35, -s * 0.9), Vector2(s * 0.55, s * 1.8)), col, false, 1.3)
				for k in 3:
					var y := -s * 0.5 + k * s * 0.5
					draw_arc(c + Vector2(-s * 0.45, y), s * 0.32, -PI * 0.5, PI * 0.5, 12, cy if k == 1 else col, 1.3, true)
			"touch":
				# an open hand against a pane: palm and four fingers
				draw_line(c + Vector2(s * 0.75, -s), c + Vector2(s * 0.75, s), cy, 1.4, true)
				draw_arc(c + Vector2(-s * 0.05, s * 0.35), s * 0.42, 0, TAU, 20, col, 1.3, true)
				for k in 4:
					var x := -s * 0.38 + k * s * 0.24
					draw_line(Vector2(c.x + x, c.y), Vector2(c.x + x + s * 0.03, c.y - s * (0.7 + (0.18 if k in [1, 2] else 0.0))), col, 1.3, true)
			"shard":
				# a sliver of mirror
				var pts := PackedVector2Array([c + Vector2(-s * 0.15, -s * 1.05), c + Vector2(s * 0.62, s * 0.55), c + Vector2(-s * 0.55, s * 0.85)])
				draw_colored_polygon(pts, Color(cy, cy.a * 0.25))
				pts.append(pts[0])
				draw_polyline(pts, col, 1.4, true)
				draw_line(c + Vector2(-s * 0.1, -s * 0.5), c + Vector2(s * 0.12, s * 0.1), cy, 1.2, true)
			"wait":
				# a figure standing still between two vertical marks
				draw_circle(c + Vector2(0, -s * 0.62), s * 0.22, col)
				draw_line(c + Vector2(0, -s * 0.35), c + Vector2(0, s * 0.85), col, 1.6, true)
				draw_line(c + Vector2(-s * 0.85, -s * 0.8), c + Vector2(-s * 0.85, s * 0.85), cy, 1.2, true)
				draw_line(c + Vector2(s * 0.85, -s * 0.8), c + Vector2(s * 0.85, s * 0.85), cy, 1.2, true)
			"memory":
				# a small flame of light over a stone
				draw_line(c + Vector2(-s * 0.8, s * 0.8), c + Vector2(s * 0.8, s * 0.8), col, 1.4, true)
				draw_arc(c + Vector2(0, s * 0.05), s * 0.45, 0, TAU, 24, cy, 1.4, true)
				draw_circle(c + Vector2(0, s * 0.05), 2.0, cy)
			_:
				draw_circle(c, s * 0.3, col)
