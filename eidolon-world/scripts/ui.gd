class_name GameUI
extends CanvasLayer
## Title, inscriptions, the rune card (reading a statue), the memory fragment and the end titles.
## Same thin, spaced serif language as the EIDOLON puzzle.

signal begin_pressed
signal anew_pressed

const CREAM := Color(0.95, 0.93, 0.88)
const INK := Color(0.10, 0.10, 0.11)

var serif: FontFile
var italic: FontFile
var caps: FontVariation
var root: Control
var title_screen: Control
var title_word: TitleWord
var tap_label: Label
var anew_btn: Button
var text: Label
var card: Control
var card_rune: ColorRect
var card_mat: ShaderMaterial
var memory: Control
var memory_line: Label
var silhouette: Silhouette
var end_a: Label
var end_b: Label
var fade: ColorRect
var _t := 0.0
var _text_tw: Tween
var _card_tw: Tween
var text_source := Vector3.INF

func _ready() -> void:
	layer = 5
	serif = load("res://assets/fonts/LiberationSerif-Regular.ttf")
	italic = load("res://assets/fonts/LiberationSerif-Italic.ttf")
	caps = FontVariation.new()
	caps.base_font = serif
	caps.spacing_glyph = 4
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	_build_title()
	# inscription text (dark ink with a pale halo, like the puzzle's story line)
	text = _label(italic, 19, Color(0.11, 0.11, 0.12), HORIZONTAL_ALIGNMENT_CENTER)
	text.set_anchors_preset(Control.PRESET_CENTER)
	text.anchor_top = 0.66; text.anchor_bottom = 0.66
	text.offset_left = -180; text.offset_right = 180; text.offset_top = -60; text.offset_bottom = 60
	text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_halo(text, Color(0.93, 0.92, 0.89, 0.85))
	text.modulate.a = 0.0
	root.add_child(text)
	# rune card
	card = Control.new()
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.anchor_top = 0.30; card.anchor_bottom = 0.30
	card.offset_left = -80; card.offset_right = 80; card.offset_top = -100; card.offset_bottom = 100
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.modulate.a = 0.0
	root.add_child(card)
	var disc := CardDisc.new()
	disc.set_anchors_preset(Control.PRESET_FULL_RECT)
	card.add_child(disc)
	card_rune = ColorRect.new()
	card_rune.set_anchors_preset(Control.PRESET_FULL_RECT)
	card_rune.offset_left = 18; card_rune.offset_right = -18; card_rune.offset_top = 14; card_rune.offset_bottom = -14
	card_rune.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card_mat = ShaderMaterial.new()
	card_mat.shader = preload("res://shaders/rune_ui.gdshader")
	card_rune.material = card_mat
	card.add_child(card_rune)
	# memory fragment
	memory = Control.new()
	memory.set_anchors_preset(Control.PRESET_FULL_RECT)
	memory.mouse_filter = Control.MOUSE_FILTER_IGNORE
	memory.modulate.a = 0.0
	root.add_child(memory)
	silhouette = Silhouette.new()
	silhouette.set_anchors_preset(Control.PRESET_CENTER)
	silhouette.anchor_top = 0.36; silhouette.anchor_bottom = 0.36
	silhouette.offset_left = -110; silhouette.offset_right = 110; silhouette.offset_top = -170; silhouette.offset_bottom = 170
	memory.add_child(silhouette)
	memory_line = _label(italic, 21, Color(0.10, 0.10, 0.11), HORIZONTAL_ALIGNMENT_CENTER)
	memory_line.set_anchors_preset(Control.PRESET_CENTER)
	memory_line.anchor_top = 0.70; memory_line.anchor_bottom = 0.70
	memory_line.offset_left = -175; memory_line.offset_right = 175; memory_line.offset_top = -60; memory_line.offset_bottom = 60
	memory_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	memory_line.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_halo(memory_line, Color(0.95, 0.95, 0.93, 0.9))
	memory.add_child(memory_line)
	end_a = _label(caps, 15, Color(0.10, 0.10, 0.11), HORIZONTAL_ALIGNMENT_CENTER)
	end_a.set_anchors_preset(Control.PRESET_CENTER)
	end_a.anchor_top = 0.42; end_a.anchor_bottom = 0.42
	end_a.offset_left = -190; end_a.offset_right = 190; end_a.offset_top = -14; end_a.offset_bottom = 14
	end_a.text = "THE THRESHOLD, AWAKENED"
	_halo(end_a, Color(0.95, 0.95, 0.93, 0.9))
	end_a.modulate.a = 0.0
	root.add_child(end_a)
	end_b = _label(italic, 19, Color(0.14, 0.14, 0.15), HORIZONTAL_ALIGNMENT_CENTER)
	end_b.set_anchors_preset(Control.PRESET_CENTER)
	end_b.anchor_top = 0.42; end_b.anchor_bottom = 0.42
	end_b.offset_left = -190; end_b.offset_right = 190; end_b.offset_top = 22; end_b.offset_bottom = 52
	end_b.text = "To be continued"
	_halo(end_b, Color(0.95, 0.95, 0.93, 0.9))
	end_b.modulate.a = 0.0
	root.add_child(end_b)
	fade = ColorRect.new()
	fade.color = Color(0.07, 0.07, 0.075, 1.0)
	fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade)

func _label(font: Font, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.horizontal_alignment = align
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func _halo(l: Label, c: Color) -> void:
	l.add_theme_color_override("font_shadow_color", c)
	l.add_theme_constant_override("shadow_offset_x", 0)
	l.add_theme_constant_override("shadow_offset_y", 1)
	l.add_theme_constant_override("shadow_outline_size", 12)

func _build_title() -> void:
	title_screen = Control.new()
	title_screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	title_screen.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(title_screen)
	title_word = TitleWord.new()
	title_word.set_anchors_preset(Control.PRESET_CENTER_TOP)
	title_word.anchor_top = 0.2; title_word.anchor_bottom = 0.2
	title_word.offset_left = -200; title_word.offset_right = 200
	title_word.offset_top = -40; title_word.offset_bottom = 40
	title_screen.add_child(title_word)
	var sub := _label(italic, 22, Color(0.16, 0.16, 0.17), HORIZONTAL_ALIGNMENT_CENTER)
	sub.text = "εἴδωλον"
	sub.set_anchors_preset(Control.PRESET_CENTER_TOP)
	sub.anchor_top = 0.2; sub.anchor_bottom = 0.2
	sub.offset_left = -150; sub.offset_right = 150; sub.offset_top = 46; sub.offset_bottom = 80
	title_screen.add_child(sub)
	var gloss := _label(caps, 11, Color(0.22, 0.22, 0.23), HORIZONTAL_ALIGNMENT_CENTER)
	gloss.text = "I  ·  THE THRESHOLD"
	gloss.set_anchors_preset(Control.PRESET_CENTER_TOP)
	gloss.anchor_top = 0.2; gloss.anchor_bottom = 0.2
	gloss.offset_left = -180; gloss.offset_right = 180; gloss.offset_top = 82; gloss.offset_bottom = 100
	title_screen.add_child(gloss)
	tap_label = _label(caps, 13, Color(0.14, 0.14, 0.15), HORIZONTAL_ALIGNMENT_CENTER)
	tap_label.text = "TOUCH TO BEGIN"
	tap_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	tap_label.anchor_top = 0.86; tap_label.anchor_bottom = 0.86
	tap_label.offset_left = -150; tap_label.offset_right = 150; tap_label.offset_top = -12; tap_label.offset_bottom = 12
	_halo(tap_label, Color(0.93, 0.92, 0.89, 0.6))
	title_screen.add_child(tap_label)
	anew_btn = Button.new()
	anew_btn.flat = true
	anew_btn.focus_mode = Control.FOCUS_NONE
	anew_btn.text = "begin anew"
	anew_btn.add_theme_font_override("font", italic)
	anew_btn.add_theme_font_size_override("font_size", 15)
	anew_btn.add_theme_color_override("font_color", Color(0.2, 0.2, 0.21, 0.8))
	anew_btn.add_theme_color_override("font_hover_color", Color(0.1, 0.1, 0.11))
	anew_btn.add_theme_color_override("font_pressed_color", Color(0.1, 0.1, 0.11))
	for st in ["normal", "hover", "pressed", "focus"]: anew_btn.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	anew_btn.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	anew_btn.anchor_top = 0.92; anew_btn.anchor_bottom = 0.92
	anew_btn.offset_left = -70; anew_btn.offset_right = 70; anew_btn.offset_top = -16; anew_btn.offset_bottom = 16
	anew_btn.visible = false
	anew_btn.pressed.connect(func() -> void: anew_pressed.emit())
	title_screen.add_child(anew_btn)

func set_continue(has_save: bool) -> void:
	tap_label.text = "TOUCH TO CONTINUE" if has_save else "TOUCH TO BEGIN"
	anew_btn.visible = has_save

func over_anew(p: Vector2) -> bool:
	return anew_btn.visible and anew_btn.get_global_rect().grow(8).has_point(p)

func hide_title() -> void:
	var tw := create_tween()
	tw.tween_property(title_screen, "modulate:a", 0.0, 1.2)
	tw.tween_callback(func() -> void: title_screen.visible = false)

func show_text(s: String, source := Vector3.INF, hold := 5.0) -> void:
	text.text = s
	text_source = source
	if _text_tw: _text_tw.kill()
	_text_tw = create_tween()
	_text_tw.tween_property(text, "modulate:a", 1.0, 1.0).set_trans(Tween.TRANS_SINE)
	_text_tw.tween_interval(hold)
	_text_tw.tween_property(text, "modulate:a", 0.0, 1.6).set_trans(Tween.TRANS_SINE)

func hide_text() -> void:
	if text.modulate.a <= 0.0: return
	if _text_tw: _text_tw.kill()
	_text_tw = create_tween()
	_text_tw.tween_property(text, "modulate:a", 0.0, 0.8)
	text_source = Vector3.INF

func show_rune(design: int, numeral: int) -> void:
	card_mat.set_shader_parameter("design", float(design))
	card_mat.set_shader_parameter("numeral", float(numeral))
	if _card_tw: _card_tw.kill()
	_card_tw = create_tween()
	_card_tw.tween_property(card, "modulate:a", 1.0, 0.7).set_trans(Tween.TRANS_SINE)
	_card_tw.tween_interval(3.6)
	_card_tw.tween_property(card, "modulate:a", 0.0, 1.2)

func show_memory(line: String, hold: float) -> void:
	memory_line.text = line
	memory_line.visible_ratio = 1.0
	silhouette.reveal = 0.0
	var tw := create_tween()
	tw.tween_property(memory, "modulate:a", 1.0, 2.2).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(silhouette, "reveal", 1.0, 3.5).set_trans(Tween.TRANS_SINE)
	tw.tween_interval(hold)
	tw.tween_property(memory, "modulate:a", 0.0, 2.4).set_trans(Tween.TRANS_SINE)

func show_end(hold: float) -> void:
	var tw := create_tween()
	tw.tween_property(end_a, "modulate:a", 1.0, 2.0)
	tw.tween_property(end_b, "modulate:a", 1.0, 1.6)
	tw.tween_interval(hold)
	tw.tween_property(end_a, "modulate:a", 0.0, 2.0)
	tw.parallel().tween_property(end_b, "modulate:a", 0.0, 2.0)

func fade_to(a: float, dur: float) -> Tween:
	var tw := create_tween()
	tw.tween_property(fade, "color:a", a, dur)
	return tw

func _process(dt: float) -> void:
	_t += dt
	if title_screen.visible:
		tap_label.modulate.a = 0.45 + 0.4 * sin(_t * 2.0)
	silhouette.t = _t
	if memory.modulate.a > 0.0: silhouette.queue_redraw()


class CardDisc extends Control:
	## soft dark disc behind a rune card
	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		var c := size * 0.5
		var r := minf(size.x, size.y) * 0.5
		for i in 10:
			var k := float(i) / 10.0
			draw_circle(c, r * (1.0 - k * 0.5), Color(0.06, 0.07, 0.08, 0.07 + k * 0.03))
		draw_arc(c, r * 0.97, 0, TAU, 64, Color(0.6, 0.95, 1.0, 0.35), 1.0, true)


class Silhouette extends Control:
	## A ghostly veiled statue (the memory image): soft layered glow, drawn in code.
	var reveal := 1.0
	var t := 0.0
	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _shape(cx: float, top: float, s: float) -> PackedVector2Array:
		var pts := PackedVector2Array()
		# veiled head and shoulders, falling robe; outline clockwise from the crown
		var prof := [[0.0, 0.0], [0.22, 0.02], [0.34, 0.10], [0.38, 0.22], [0.36, 0.33], [0.48, 0.42], [0.62, 0.50],
			[0.66, 0.62], [0.60, 0.80], [0.62, 1.05], [0.70, 1.30], [0.80, 1.52], [0.92, 1.62]]
		for p in prof: pts.append(Vector2(cx + p[0] * s, top + p[1] * s))
		for i in range(prof.size() - 1, -1, -1):
			var p: Array = prof[i]
			pts.append(Vector2(cx - p[0] * s * (1.0 + 0.04 * float(p[1])), top + p[1] * s))
		return pts
	func _draw() -> void:
		var cx := size.x * 0.5
		var s := size.y * 0.58
		var top := size.y * 0.04
		var a := clampf(reveal, 0.0, 1.0)
		var base := _shape(cx, top, s)
		for i in 7:
			var k := 1.0 + i * 0.035
			var pts := PackedVector2Array()
			var c := Vector2(cx, top + s * 0.8)
			for p in base: pts.append(c + (p - c) * k)
			draw_colored_polygon(pts, Color(0.75, 0.95, 1.0, 0.05 * a))
		draw_colored_polygon(base, Color(0.86, 0.96, 1.0, 0.22 * a))
		var outline := base.duplicate()
		outline.append(base[0])
		draw_polyline(outline, Color(0.55, 0.95, 1.0, 0.55 * a), 1.2, true)
		# a faint vertical fold or two, and the face pressing through the veil
		draw_line(Vector2(cx - s * 0.12, top + s * 0.7), Vector2(cx - s * 0.2, top + s * 1.55), Color(0.6, 0.95, 1.0, 0.25 * a), 1.0, true)
		draw_line(Vector2(cx + s * 0.16, top + s * 0.68), Vector2(cx + s * 0.28, top + s * 1.58), Color(0.6, 0.95, 1.0, 0.22 * a), 1.0, true)
		draw_arc(Vector2(cx, top + s * 0.19), s * 0.13, PI * 0.15, PI * 0.85, 16, Color(0.6, 0.95, 1.0, 0.3 * a), 1.0, true)

class TitleWord extends Control:
	## "EIDOLON" drawn as geometry: thin roman capitals with hairline serifs, widely spaced.
	var reveal := 1.0
	var ink := Color(0.10, 0.10, 0.11)

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		var letters := ["E", "I", "D", "O", "L", "O", "N"]
		var widths := {"E": 0.56, "I": 0.0, "D": 0.74, "O": 0.84, "L": 0.54, "N": 0.74}
		var hgt := 40.0
		var gap := 0.6
		var total := 0.0
		for l in letters: total += widths[l]
		total += gap * (letters.size() - 1)
		var x := size.x * 0.5 - total * hgt * 0.5
		var y := size.y * 0.5 - hgt * 0.5
		for i in letters.size():
			var a := clampf(reveal * (letters.size() + 2) - i, 0.0, 1.0)
			if a > 0.0:
				_letter(letters[i], Vector2(x, y), hgt, Color(ink, ink.a * a))
			x += (widths[letters[i]] + gap) * hgt

	func _stroke(pts: PackedVector2Array, col: Color, thin: float, thick: float) -> void:
		for i in pts.size() - 1:
			var a := pts[i]; var b := pts[i + 1]
			var t := (b - a)
			if t.length() < 0.001: continue
			t = t.normalized()
			var w := lerpf(thin, thick, absf(t.y))
			var nrm := Vector2(-t.y, t.x) * w * 0.5
			draw_colored_polygon(PackedVector2Array([a - nrm, b - nrm, b + nrm, a + nrm]), col)

	func _line(a: Vector2, b: Vector2, col: Color, w := 1.0) -> void:
		_stroke(PackedVector2Array([a, b]), col, w, w)

	func _serif_h(p: Vector2, hw: float, col: Color) -> void:
		draw_line(p - Vector2(hw, 0), p + Vector2(hw, 0), col, 1.0, true)

	func _letter(ch: String, o: Vector2, h: float, col: Color) -> void:
		var thin := 1.0
		var thick := 2.6
		var s := h * 0.14
		match ch:
			"E":
				_line(o, o + Vector2(0, h), col, thick)
				_line(o, o + Vector2(0.56 * h, 0), col, thin)
				_line(o + Vector2(0, h * 0.5), o + Vector2(0.44 * h, h * 0.5), col, thin)
				_line(o + Vector2(0, h), o + Vector2(0.58 * h, h), col, thin)
				draw_line(o + Vector2(0.56 * h, 0), o + Vector2(0.56 * h, s * 0.8), col, 1.0, true)
				draw_line(o + Vector2(0.58 * h, h), o + Vector2(0.58 * h, h - s * 0.9), col, 1.0, true)
				draw_line(o + Vector2(0.44 * h, h * 0.5 - s * 0.4), o + Vector2(0.44 * h, h * 0.5 + s * 0.4), col, 1.0, true)
				_serif_h(o, s * 0.6, col); _serif_h(o + Vector2(0, h), s * 0.6, col)
			"I":
				_line(o, o + Vector2(0, h), col, thick)
				_serif_h(o, s * 0.75, col); _serif_h(o + Vector2(0, h), s * 0.75, col)
			"L":
				_line(o, o + Vector2(0, h), col, thick)
				_line(o + Vector2(0, h), o + Vector2(0.54 * h, h), col, thin)
				draw_line(o + Vector2(0.54 * h, h), o + Vector2(0.54 * h, h - s), col, 1.0, true)
				_serif_h(o, s * 0.7, col); _serif_h(o + Vector2(0, h), s * 0.6, col)
			"D":
				_line(o, o + Vector2(0, h), col, thick)
				var pts := PackedVector2Array()
				pts.append(o)
				var cx := o + Vector2(0.30 * h, 0.5 * h)
				for k in 17:
					var an := -PI * 0.5 + PI * k / 16.0
					pts.append(cx + Vector2(cos(an) * 0.44 * h, sin(an) * 0.5 * h))
				pts.append(o + Vector2(0, h))
				_stroke(pts, col, thin, thick)
				_serif_h(o, s * 0.6, col); _serif_h(o + Vector2(0, h), s * 0.6, col)
			"O":
				var pts := PackedVector2Array()
				var cx := o + Vector2(0.42 * h, 0.5 * h)
				for k in 37:
					var an := TAU * k / 36.0
					pts.append(cx + Vector2(cos(an) * 0.42 * h, sin(an) * 0.51 * h))
				_stroke(pts, col, thin, thick)
			"N":
				_line(o, o + Vector2(0, h), col, thin)
				_line(o + Vector2(0.74 * h, 0), o + Vector2(0.74 * h, h), col, thin)
				_stroke(PackedVector2Array([o, o + Vector2(0.74 * h, h)]), col, thick * 0.95, thick * 0.95)
				_serif_h(o, s * 0.6, col); _serif_h(o + Vector2(0, h), s * 0.6, col)
				_serif_h(o + Vector2(0.74 * h, 0), s * 0.6, col)

