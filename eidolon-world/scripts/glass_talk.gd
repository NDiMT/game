class_name GlassTalk
extends Control
## v0.5b: "a conversation through the glass", reusable. A full-screen close-up of a fogged pane: she
## writes from the other side (so her writing is mirror-reversed for you), then draws HALF of a second
## rune and waits; you finish it with your finger (or the mouse). A $1-style recogniser compares your
## stroke to the missing stroke(s). The answer she wants is the MIRROR of her half: her side is
## reversed. Right: her palm presses on the glass where your stroke ended, the glyph glows, the pane
## closes. Wrong: the fog creeps back over your stroke; after two wrong tries she draws her half again,
## slowly, and traces the missing part once, faintly.
##
## Coordinates: PANEL units, x -1..1 (left..right), y -1..1 (bottom..top), as YOU see the glass.

signal solved(id: String)
signal failed(id: String, tries: int)
signal closed(id: String)
signal sound(name: String)

## the stroke library, as SHE writes (her side). On your side x is reversed.
const TEMPLATES := {
	# "follow": v0.6, a letter of the sculptor's script (letter 4, the Greek-key hook on a stem: a stem
	# rising, a bar, a hook turning back in), written in one stroke as she writes it
	"follow": [[Vector2(-0.44, -0.5), Vector2(-0.44, 0.38), Vector2(-0.4, 0.47), Vector2(-0.3, 0.5), Vector2(0.34, 0.5),
		Vector2(0.42, 0.46), Vector2(0.44, 0.38), Vector2(0.44, -0.02), Vector2(0.4, -0.09), Vector2(0.32, -0.1), Vector2(-0.02, -0.1)]],
	# "together": two arcs facing each other, each ending in an inward hook; she draws one, you the other
	"together_half": [[Vector2(0.0, 0.62), Vector2(0.24, 0.55), Vector2(0.38, 0.32), Vector2(0.42, 0.0),
		Vector2(0.38, -0.32), Vector2(0.24, -0.55), Vector2(0.06, -0.6), Vector2(0.1, -0.42)]],
}
const N := 32                     # resample points
const MATCH := 0.24               # mean distance (panel units) still accepted
const MASK := Vector2i(420, 560)  # wipe-mask resolution (3:4, the pane's aspect)

var id := ""
var phase := "closed"             # closed, writing, waiting, drawing, success
var tries := 0
var panel: Control
var glass: ColorRect
var glass_mat: ShaderMaterial
var mask_vp: SubViewport
var ink: Ink
var close_r := Rect2()
var her_first: Array = []         # strokes on screen (panel units) she writes first
var her_half: Array = []          # her half of the question
var target: Array = []            # the stroke(s) you must draw (panel units)
var _t := 0.0
var _tw: Tween
var _drawing := false
var _cur: PackedVector2Array = PackedVector2Array()
var _block := 0.0
var last_score := []              # (tests / tuning) the last answer: [distance, turning, target turning, points, start, end]

class Ink extends Node2D:
	## draws the wipe mask: R = clear glass (her lines, yours), G = a faint hint, B = fingertip / palm
	var host: GlassTalk
	var her: Array = []           # [points(px), progress 0..1]
	var mine: Array = []          # [points(px), strength 0..1]
	var hint: Array = []          # [points(px), progress, strength]
	var finger := Vector2(-99, -99)
	var finger_k := 0.0
	var palm := Vector2(-99, -99)
	var palm_k := 0.0
	var width := 21.0
	func _draw() -> void:
		for h in her: _poly(h[0], h[1], Color(1, 0, 0), width)
		for m in mine: _poly(m[0], 1.0, Color(m[1], 0, 0), width * 1.15)
		for h in hint: _poly(h[0], h[1], Color(0, h[2], 0), width * 0.8)
		if finger_k > 0.0:
			for i in 4: draw_circle(finger, 9.0 - i * 2.0, Color(0, 0, 0.25 * finger_k))
		if palm_k > 0.0:
			var c := Color(0, 0, palm_k)
			draw_set_transform(palm, 0.0, Vector2.ONE)
			_ellipse(Vector2(0, 10), Vector2(30, 34), c)
			for k in 4:
				var x := -21.0 + k * 14.0
				draw_line(Vector2(x * 0.9, -14), Vector2(x * 1.1, -50 - (6.0 if k in [1, 2] else 0.0)), c, 11.0, true)
			draw_line(Vector2(26, 12), Vector2(46, -6), c, 11.0, true)
			draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	## v0.6: a calligraphic brush, not a felt pen: a broad nib held at an angle (thick down-strokes,
	## fine hairlines across), pressed in at the start and lifted off in a long taper. Drawn as ONE strip
	## of quads with shared (mitred) edges, so nothing is painted twice into the additive mask.
	const NIB := -0.6                # the nib's angle (radians)
	func _poly(pts: PackedVector2Array, prog: float, col: Color, w: float) -> void:
		if pts.size() < 2 or prog <= 0.0: return
		var L := 0.0
		for i in pts.size() - 1: L += pts[i].distance_to(pts[i + 1])
		if L < 0.5: return
		var n := clampi(int(L / 2.0), 2, 400)
		var want := clampf(prog, 0.0, 1.0)
		var sp := PackedVector2Array()
		var ss := PackedFloat32Array()
		var acc := 0.0
		var i := 0
		for k in n + 1:
			var d := L * float(k) / n
			if d > L * want + 0.001: break
			while i < pts.size() - 2 and acc + pts[i].distance_to(pts[i + 1]) < d:
				acc += pts[i].distance_to(pts[i + 1])
				i += 1
			var seg := maxf(pts[i].distance_to(pts[i + 1]), 0.0001)
			sp.append(pts[i].lerp(pts[i + 1], clampf((d - acc) / seg, 0.0, 1.0)))
			ss.append(d / L)
		if sp.size() < 2: return
		var left := PackedVector2Array()
		var right := PackedVector2Array()
		for k in sp.size():
			var t := (sp[mini(k + 1, sp.size() - 1)] - sp[maxi(k - 1, 0)])
			t = t.normalized() if t.length() > 0.0001 else Vector2.RIGHT
			var s := ss[k]
			var press := (smoothstep(0.0, 0.05, s) * 0.45 + 0.55) * (1.0 - smoothstep(0.7, 1.0, s) * 0.85)
			var nib := 0.4 + 0.6 * absf(sin(t.angle() - NIB))
			var r := maxf(w * 0.5 * press * nib, 0.7)
			var nn := Vector2(-t.y, t.x) * r
			left.append(sp[k] + nn)
			right.append(sp[k] - nn)
		var cs := PackedColorArray([col, col, col, col])
		for k in sp.size() - 1:
			draw_primitive(PackedVector2Array([left[k], left[k + 1], right[k + 1], right[k]]), cs, PackedVector2Array())
	func _ellipse(c: Vector2, r: Vector2, col: Color) -> void:
		var pts := PackedVector2Array()
		for i in 24: pts.append(c + Vector2(cos(TAU * i / 24.0) * r.x, sin(TAU * i / 24.0) * r.y))
		draw_colored_polygon(pts, col)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	modulate.a = 0.0
	var dim := ColorRect.new()
	dim.color = Color(0.04, 0.045, 0.05, 0.86)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dim)
	panel = Control.new()
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(panel)
	mask_vp = SubViewport.new()
	mask_vp.size = MASK
	mask_vp.transparent_bg = true
	mask_vp.disable_3d = true
	mask_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(mask_vp)
	ink = Ink.new()
	ink.host = self
	var cm := CanvasItemMaterial.new()
	cm.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	ink.material = cm
	mask_vp.add_child(ink)
	glass = ColorRect.new()
	glass.set_anchors_preset(Control.PRESET_FULL_RECT)
	glass.mouse_filter = Control.MOUSE_FILTER_IGNORE
	glass_mat = ShaderMaterial.new()
	glass_mat.shader = preload("res://shaders/glass_closeup.gdshader")
	glass_mat.set_shader_parameter("mask", mask_vp.get_texture())
	glass.material = glass_mat
	panel.add_child(glass)
	resized.connect(_layout)

func _layout() -> void:
	var w := minf(size.x * 0.86, 360.0)
	var h := w * 4.0 / 3.0
	if h > size.y * 0.72:
		h = size.y * 0.72
		w = h * 0.75
	panel.position = (size - Vector2(w, h)) * 0.5 + Vector2(0, -size.y * 0.03)
	panel.size = Vector2(w, h)
	close_r = Rect2(panel.position + Vector2(w - 40.0, -48.0), Vector2(40, 40))
	queue_redraw()

func _draw() -> void:
	if not visible: return
	# the close mark: a thin ring with a cross, top right of the pane
	var c := close_r.get_center()
	draw_circle(c, 17.0, Color(0.06, 0.07, 0.08, 0.5))
	draw_arc(c, 17.0, 0, TAU, 40, Color(0.93, 0.92, 0.88, 0.6), 1.2, true)
	for s in [-1.0, 1.0]:
		draw_line(c + Vector2(-6, -6 * s), c + Vector2(6, 6 * s), Color(0.93, 0.92, 0.88, 0.85), 1.5, true)

# ------------------------------------------------------------------ geometry helpers
## panel units (x right, y up) -> mask pixels
func to_px(p: Vector2) -> Vector2:
	return Vector2((p.x * 0.5 + 0.5) * MASK.x, (0.5 - p.y * 0.5) * MASK.y)

## screen point -> panel units
func to_panel(sp: Vector2) -> Vector2:
	var q := (sp - panel.global_position) / panel.size
	return Vector2(q.x * 2.0 - 1.0, 1.0 - q.y * 2.0)

static func place(strokes: Array, mirror: bool, scale: float, at: Vector2) -> Array:
	var out := []
	for s in strokes:
		var o := PackedVector2Array()
		for p in s: o.append(Vector2(-p.x if mirror else p.x, p.y) * scale + at)
		out.append(smooth(o))
	return out

## v0.6: a written line flows: Catmull-Rom through the template's points (4 steps per span)
static func smooth(pts: PackedVector2Array, steps := 4) -> PackedVector2Array:
	if pts.size() < 3: return pts
	var out := PackedVector2Array()
	for i in pts.size() - 1:
		var p0 := pts[maxi(i - 1, 0)]
		var p1 := pts[i]
		var p2 := pts[i + 1]
		var p3 := pts[mini(i + 2, pts.size() - 1)]
		for k in steps:
			var t := float(k) / steps
			var t2 := t * t
			var t3 := t2 * t
			out.append(0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3))
	out.append(pts[pts.size() - 1])
	return out

func _px(stroke: PackedVector2Array) -> PackedVector2Array:
	var o := PackedVector2Array()
	for p in stroke: o.append(to_px(p))
	return o

# ------------------------------------------------------------------ the $1-style recogniser
static func resample(pts: PackedVector2Array, n := N) -> PackedVector2Array:
	var out := PackedVector2Array()
	if pts.size() == 0: return out
	if pts.size() == 1:
		for i in n: out.append(pts[0])
		return out
	var L := 0.0
	for i in pts.size() - 1: L += pts[i].distance_to(pts[i + 1])
	var step := L / float(n - 1)
	out.append(pts[0])
	var acc := 0.0
	var prev := pts[0]
	var i := 1
	while i < pts.size() and out.size() < n:
		var d := prev.distance_to(pts[i])
		if acc + d >= step and d > 0.0:
			var q := prev.lerp(pts[i], (step - acc) / d)
			out.append(q)
			prev = q
			acc = 0.0
		else:
			acc += d
			prev = pts[i]
			i += 1
	while out.size() < n: out.append(pts[pts.size() - 1])
	return out

## mean point distance between a drawn stroke and a template stroke, either direction (panel units).
## Positions are kept (where you draw matters), so the left arc is not the right one.
static func stroke_distance(drawn: PackedVector2Array, tmpl: PackedVector2Array) -> float:
	var a := resample(drawn)
	var b := resample(tmpl)
	var f := 0.0
	var r := 0.0
	for i in N:
		f += a[i].distance_to(b[i])
		r += a[i].distance_to(b[N - 1 - i])
	return minf(f, r) / N

# ------------------------------------------------------------------ the conversation
## spec: {"id", "first": template, "question": template (her half), "at_first": Vector2, "at_q": Vector2}
func open(spec: Dictionary) -> void:
	id = spec.get("id", "glass")
	tries = 0
	var first: Array = TEMPLATES[spec.get("first", "follow")]
	var half: Array = TEMPLATES[spec.get("question", "together_half")]
	# she writes on HER side: you see it mirrored. Her half of the question sits on the LEFT for you;
	# the answer, its mirror, on the right.
	her_first = place(first, true, 0.42, spec.get("at_first", Vector2(0.0, 0.5)))
	her_half = place(half, true, 0.75, spec.get("at_q", Vector2(0.0, -0.32)))
	target = place(half, false, 0.75, spec.get("at_q", Vector2(0.0, -0.32)))
	ink.her.clear(); ink.mine.clear(); ink.hint.clear()
	ink.palm_k = 0.0; ink.finger_k = 0.0
	glass_mat.set_shader_parameter("glow", 0.0)
	glass_mat.set_shader_parameter("fog", 0.0)
	visible = true
	if size.x < 2.0: size = get_parent_area_size()
	_layout()
	_block = 0.3
	if _tw: _tw.kill()
	_tw = create_tween()
	_tw.tween_property(self, "modulate:a", 1.0, 0.7).set_trans(Tween.TRANS_SINE)
	_tw.parallel().tween_method(func(v: float) -> void: glass_mat.set_shader_parameter("fog", v), 0.0, 1.0, 1.2)
	_tw.tween_callback(func() -> void: sound.emit("breath"))
	_her_writes(1.0)

## she writes her rune, then half of the question, and waits with her fingertip on the glass
func _her_writes(slow: float) -> void:
	phase = "writing"
	var strokes := her_first + her_half
	var times: Array = []
	for s in strokes: times.append(0.9 * slow)
	times[strokes.size() - 1] = 1.6 * slow
	ink.her.clear()
	for s in strokes: ink.her.append([_px(s), 0.0])
	var tw := _tw if _tw and _tw.is_running() else create_tween()
	if tw != _tw: _tw = tw
	tw.tween_interval(0.4)
	for k in strokes.size():
		var idx := k
		if k == her_first.size():
			tw.tween_interval(0.7 * slow)
		tw.tween_method(func(v: float) -> void:
			ink.her[idx][1] = v
			var pts: PackedVector2Array = ink.her[idx][0]
			ink.finger = _point_on(pts, v)
			ink.finger_k = 1.0
			ink.queue_redraw(), 0.0, 1.0, times[k]).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		phase = "waiting"
		emit_signal("sound", "writing"))

func _point_on(pts: PackedVector2Array, v: float) -> Vector2:
	var L := 0.0
	for i in pts.size() - 1: L += pts[i].distance_to(pts[i + 1])
	var want := L * v
	var acc := 0.0
	for i in pts.size() - 1:
		var seg := pts[i].distance_to(pts[i + 1])
		if acc + seg >= want: return pts[i].lerp(pts[i + 1], (want - acc) / maxf(seg, 0.0001))
		acc += seg
	return pts[pts.size() - 1]

## how much a stroke turns, in degrees (signed sum; its size does not depend on the direction drawn)
static func turning(pts: PackedVector2Array) -> float:
	var r := resample(pts, 16)
	var total := 0.0
	for i in range(1, r.size() - 1):
		var d0 := r[i] - r[i - 1]
		var d1 := r[i + 1] - r[i]
		if d0.length() < 1e-5 or d1.length() < 1e-5: continue
		total += rad_to_deg(d0.angle_to(d1))
	return total

## a drawn stroke matches a template: close in place (mean point distance, either direction) AND of the
## same kind of curve: it turns comparably (a plain arc for an arc with a small hook is fine; a straight
## line where an arc is wanted is not)
static func matches(drawn: PackedVector2Array, tmpl: PackedVector2Array) -> bool:
	if stroke_distance(drawn, tmpl) >= MATCH: return false
	var td := absf(turning(drawn))
	var tt := absf(turning(tmpl))
	return td >= tt * 0.45 and td <= tt * 1.6 + 60.0

## the answer (a stroke in panel units): returns true if it is right
func answer(stroke: PackedVector2Array) -> bool:
	if phase != "waiting" and phase != "drawing": return false
	var ok := false
	for t in target: ok = ok or matches(stroke, t)
	if target.size() > 0:
		last_score = [snappedf(stroke_distance(stroke, target[0]), 0.001), snappedf(turning(stroke), 0.1), snappedf(turning(target[0]), 0.1), stroke.size(),
			[snappedf(stroke[0].x, 0.01), snappedf(stroke[0].y, 0.01)], [snappedf(stroke[stroke.size() - 1].x, 0.01), snappedf(stroke[stroke.size() - 1].y, 0.01)]]
	var px := _px(stroke)
	if ink.mine.is_empty() or ink.mine[ink.mine.size() - 1][0] != px: ink.mine.append([px, 1.0])
	ink.queue_redraw()
	if ok: _success(stroke[stroke.size() - 1])
	else: _wrong()
	return ok

func _success(end: Vector2) -> void:
	phase = "success"
	ink.finger_k = 0.0
	ink.palm = to_px(end + Vector2(0.0, 0.05))
	sound.emit("chime")
	if _tw: _tw.kill()
	_tw = create_tween()
	_tw.tween_method(func(v: float) -> void:
		ink.palm_k = v
		ink.queue_redraw(), 0.0, 1.0, 0.8).set_trans(Tween.TRANS_SINE)
	_tw.parallel().tween_method(func(v: float) -> void: glass_mat.set_shader_parameter("glow", v), 0.0, 1.0, 1.2)
	_tw.tween_callback(func() -> void: solved.emit(id))
	_tw.tween_interval(2.2)
	_tw.tween_property(self, "modulate:a", 0.0, 1.0).set_trans(Tween.TRANS_SINE)
	_tw.tween_callback(func() -> void:
		visible = false
		phase = "closed")

func _wrong() -> void:
	tries += 1
	phase = "waiting"
	sound.emit("wrong")
	failed.emit(id, tries)
	# the fog creeps back over your stroke
	var k := ink.mine.size() - 1
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void:
		if k < ink.mine.size():
			ink.mine[k][1] = v
			ink.queue_redraw(), 1.0, 0.0, 2.6).set_trans(Tween.TRANS_SINE)
	if tries == 2:
		# she draws her half again, slowly, then traces the missing part once, faintly
		tw.tween_callback(func() -> void:
			for i in her_half.size(): ink.her[her_first.size() + i][1] = 0.0
			ink.hint.clear()
			for t in target: ink.hint.append([_px(t), 0.0, 0.0]))
		for i in her_half.size():
			var idx := her_first.size() + i
			tw.tween_method(func(v: float) -> void:
				ink.her[idx][1] = v
				ink.finger = _point_on(ink.her[idx][0], v)
				ink.queue_redraw(), 0.0, 1.0, 2.6).set_trans(Tween.TRANS_SINE)
		tw.tween_interval(0.5)
		for j in target.size():
			var jj := j
			tw.tween_method(func(v: float) -> void:
				ink.hint[jj][1] = v
				ink.hint[jj][2] = 0.45
				ink.finger = _point_on(ink.hint[jj][0], v)
				ink.queue_redraw(), 0.0, 1.0, 2.4).set_trans(Tween.TRANS_SINE)
		tw.tween_method(func(v: float) -> void:
			for h in ink.hint: h[2] = v
			ink.queue_redraw(), 0.45, 0.0, 3.0)

func close() -> void:
	if not visible: return
	phase = "closed"
	if _tw: _tw.kill()
	_tw = create_tween()
	_tw.tween_property(self, "modulate:a", 0.0, 0.5)
	_tw.tween_callback(func() -> void: visible = false)
	closed.emit(id)

# ------------------------------------------------------------------ input: your finger on the glass
func _process(dt: float) -> void:
	_block = maxf(0.0, _block - dt)
	if visible:
		_t += dt
		glass_mat.set_shader_parameter("t", _t)

func _gui_input(e: InputEvent) -> void:
	if not visible: return
	accept_event()                         # nothing reaches the world while the pane is open
	if _block > 0.0: return
	var pos := Vector2(-1, -1)
	var down := false
	var up := false
	var drag := false
	if e is InputEventScreenTouch:
		pos = e.position; down = e.pressed; up = not e.pressed
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		if e.device == InputEvent.DEVICE_ID_EMULATION: return     # (the same touch, seen again as a mouse)
		pos = e.position; down = e.pressed; up = not e.pressed
	elif e is InputEventScreenDrag:
		pos = e.position; drag = true
	elif e is InputEventMouseMotion:
		if e.device == InputEvent.DEVICE_ID_EMULATION: return
		pos = e.position; drag = true
	else:
		return
	if down and close_r.grow(10.0).has_point(pos):
		_block = 0.25
		close()
		return
	if phase != "waiting" and phase != "drawing": return
	var p := to_panel(pos)
	var inside := absf(p.x) <= 1.05 and absf(p.y) <= 1.05
	if down and inside:
		_drawing = true
		phase = "drawing"
		_cur = PackedVector2Array([p])
		ink.mine.append([_px(_cur), 1.0])
	elif drag and _drawing:
		if _cur.size() == 0 or _cur[_cur.size() - 1].distance_to(p) > 0.015:
			_cur.append(p)
			ink.mine[ink.mine.size() - 1][0] = _px(_cur)
			ink.queue_redraw()
	elif up and _drawing:
		_drawing = false
		if _cur.size() < 4 or _length(_cur) < 0.25:
			ink.mine.pop_back()
			ink.queue_redraw()
			phase = "waiting"
			return
		answer(_cur)

static func _length(pts: PackedVector2Array) -> float:
	var L := 0.0
	for i in pts.size() - 1: L += pts[i].distance_to(pts[i + 1])
	return L
