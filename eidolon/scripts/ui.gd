class_name GameUI
extends CanvasLayer
## Title, level select, HUD and the wordless story line. Everything is built in code.

signal begin_pressed
signal level_chosen(index: int)
signal action(name: String)

const CREAM := Color(0.95, 0.93, 0.88)
const INK := Color(0.10, 0.10, 0.11)
const CYAN := Color(0.45, 0.92, 1.0)

var serif: FontFile
var italic: FontFile
var caps: FontVariation
var root: Control
var title_screen: Control
var title_word: TitleWord
var tap_label: Label
var select_screen: Control
var hud: Control
var level_num: Label
var level_name: Label
var moves_label: Label
var par_label: Label
var story: Label
var hint: Label
var fade: ColorRect
var buttons := {}
var medallions: Array[Medallion] = []
var progress_label: Label
var _t := 0.0

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
	_build_hud()
	_build_select()
	_build_title()
	story = _label(italic, 19, Color(0.11, 0.11, 0.12), HORIZONTAL_ALIGNMENT_CENTER)
	story.set_anchors_preset(Control.PRESET_CENTER)
	story.anchor_top = 0.70; story.anchor_bottom = 0.70
	story.offset_left = -170; story.offset_right = 170; story.offset_top = -50; story.offset_bottom = 50
	story.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	story.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	story.add_theme_color_override("font_shadow_color", Color(0.93, 0.92, 0.89, 0.75))
	story.add_theme_constant_override("shadow_offset_x", 0)
	story.add_theme_constant_override("shadow_offset_y", 1)
	story.add_theme_constant_override("shadow_outline_size", 10)
	story.modulate.a = 0.0
	root.add_child(story)
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

# ------------------------------------------------------------------ title
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
	sub.name = "Sub"
	title_screen.add_child(sub)
	var gloss := _label(caps, 11, Color(0.22, 0.22, 0.23), HORIZONTAL_ALIGNMENT_CENTER)
	gloss.text = "REFLECTION · IMAGE · PHANTOM"
	gloss.set_anchors_preset(Control.PRESET_CENTER_TOP)
	gloss.anchor_top = 0.2; gloss.anchor_bottom = 0.2
	gloss.offset_left = -180; gloss.offset_right = 180; gloss.offset_top = 82; gloss.offset_bottom = 100
	gloss.name = "Gloss"
	title_screen.add_child(gloss)
	tap_label = _label(caps, 13, Color(0.14, 0.14, 0.15), HORIZONTAL_ALIGNMENT_CENTER)
	tap_label.text = "TOUCH TO BEGIN"
	tap_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	tap_label.anchor_top = 0.86; tap_label.anchor_bottom = 0.86
	tap_label.offset_left = -150; tap_label.offset_right = 150; tap_label.offset_top = -12; tap_label.offset_bottom = 12
	title_screen.add_child(tap_label)
	var hit := Button.new()
	hit.flat = true
	hit.focus_mode = Control.FOCUS_NONE
	hit.set_anchors_preset(Control.PRESET_FULL_RECT)
	hit.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
	hit.add_theme_stylebox_override("hover", StyleBoxEmpty.new())
	hit.add_theme_stylebox_override("pressed", StyleBoxEmpty.new())
	hit.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	hit.pressed.connect(func() -> void: begin_pressed.emit())
	title_screen.add_child(hit)

# ------------------------------------------------------------------ select
func _build_select() -> void:
	select_screen = Control.new()
	select_screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	select_screen.mouse_filter = Control.MOUSE_FILTER_IGNORE
	select_screen.visible = false
	root.add_child(select_screen)
	var shade := ColorRect.new()
	shade.color = Color(0.08, 0.08, 0.09, 0.38)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	select_screen.add_child(shade)
	var head := _label(caps, 15, CREAM, HORIZONTAL_ALIGNMENT_CENTER)
	head.text = "E I D O L O N"
	head.set_anchors_preset(Control.PRESET_CENTER_TOP)
	head.offset_left = -150; head.offset_right = 150; head.offset_top = 56; head.offset_bottom = 80
	select_screen.add_child(head)
	progress_label = _label(italic, 16, Color(0.85, 0.84, 0.8), HORIZONTAL_ALIGNMENT_CENTER)
	progress_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	progress_label.offset_left = -150; progress_label.offset_right = 150; progress_label.offset_top = 82; progress_label.offset_bottom = 106
	select_screen.add_child(progress_label)
	var chapters := [["I", "THE STILL GLASS", 0.30], ["II", "THE MOVING GLASS", 0.58]]
	var idx := 0
	for ch in chapters:
		var cl := _label(caps, 12, Color(0.9, 0.89, 0.85), HORIZONTAL_ALIGNMENT_CENTER)
		cl.text = "CHAPTER %s  ·  %s" % [ch[0], ch[1]]
		cl.set_anchors_preset(Control.PRESET_CENTER_TOP)
		cl.anchor_top = ch[2]; cl.anchor_bottom = ch[2]
		cl.offset_left = -190; cl.offset_right = 190; cl.offset_top = -62; cl.offset_bottom = -42
		select_screen.add_child(cl)
		var bar := ChapterBar.new()
		bar.set_anchors_preset(Control.PRESET_CENTER_TOP)
		bar.anchor_top = ch[2]; bar.anchor_bottom = ch[2]
		bar.offset_left = -150; bar.offset_right = 150; bar.offset_top = -38; bar.offset_bottom = -34
		bar.name = "Bar%d" % (idx / 5)
		select_screen.add_child(bar)
		for k in 5:
			var m := Medallion.new()
			m.index = idx
			m.font = serif
			m.small = italic
			m.set_anchors_preset(Control.PRESET_CENTER_TOP)
			m.anchor_top = ch[2]; m.anchor_bottom = ch[2]
			var x := -150 + k * 75
			m.offset_left = x - 30; m.offset_right = x + 30 + 0
			m.offset_left += 0; m.offset_top = -22; m.offset_bottom = 58
			m.position.x += 0
			m.pressed.connect(func() -> void: level_chosen.emit(m.index))
			select_screen.add_child(m)
			medallions.append(m)
			idx += 1
	# centre the 5 medallions: spacing 75, so shift by +0 (they span -180..+180)
	for m in medallions:
		m.offset_left += 0

func refresh_select(levels: Array, best: Dictionary) -> void:
	var solved := 0
	var unlocked := 0
	for i in levels.size():
		var r: Rules = levels[i]
		var b: int = best.get(str(r.id), -1)
		if b >= 0: solved += 1
	for i in levels.size():
		var r: Rules = levels[i]
		var m := medallions[i]
		m.best = best.get(str(r.id), -1)
		m.par = r.par
		m.locked = i > 0 and best.get(str((levels[i - 1] as Rules).id), -1) < 0 and m.best < 0
		m.disabled = m.locked
		if not m.locked: unlocked += 1
		m.queue_redraw()
	progress_label.text = "%d of %d reflections restored" % [solved, levels.size()]
	for c in 2:
		var n := 0
		for i in range(c * 5, mini(c * 5 + 5, levels.size())):
			if medallions[i].best >= 0: n += 1
		var bar: ChapterBar = select_screen.get_node("Bar%d" % c)
		bar.value = n / 5.0
		bar.queue_redraw()

# ------------------------------------------------------------------ HUD
func _build_hud() -> void:
	hud = Control.new()
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.visible = false
	root.add_child(hud)
	level_num = _label(serif, 30, INK)
	level_num.position = Vector2(22, 26)
	level_num.size = Vector2(120, 36)
	hud.add_child(level_num)
	level_name = _label(caps, 12, Color(0.18, 0.18, 0.19))
	level_name.position = Vector2(24, 64)
	level_name.size = Vector2(220, 18)
	hud.add_child(level_name)
	var mv := _label(caps, 11, Color(0.18, 0.18, 0.19), HORIZONTAL_ALIGNMENT_RIGHT)
	mv.text = "MOVES"
	mv.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	mv.offset_left = -140; mv.offset_right = -22; mv.offset_top = 30; mv.offset_bottom = 46
	hud.add_child(mv)
	moves_label = _label(serif, 28, INK, HORIZONTAL_ALIGNMENT_RIGHT)
	moves_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	moves_label.offset_left = -140; moves_label.offset_right = -22; moves_label.offset_top = 44; moves_label.offset_bottom = 78
	hud.add_child(moves_label)
	par_label = _label(italic, 15, Color(0.12, 0.42, 0.48), HORIZONTAL_ALIGNMENT_RIGHT)
	par_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	par_label.offset_left = -200; par_label.offset_right = -22; par_label.offset_top = 80; par_label.offset_bottom = 100
	hud.add_child(par_label)
	hint = _label(italic, 15, Color(0.13, 0.13, 0.14), HORIZONTAL_ALIGNMENT_CENTER)
	hint.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hint.offset_left = -180; hint.offset_right = 180; hint.offset_top = -132; hint.offset_bottom = -108
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hud.add_child(hint)
	var names := ["menu", "rotl", "undo", "rotr", "restart"]
	for i in names.size():
		var b := IconButton.new()
		b.icon_name = names[i]
		var big: bool = names[i] == "undo"
		var s := 60 if big else 50
		b.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
		var x := -152 + i * 76
		b.offset_left = x - s / 2; b.offset_right = x + s / 2
		b.offset_top = -38 - s / 2 - 22; b.offset_bottom = -38 + s / 2 - 22
		b.focus_mode = Control.FOCUS_NONE
		var nm: String = names[i]
		b.pressed.connect(func() -> void: action.emit(nm))
		hud.add_child(b)
		buttons[nm] = b

func is_over_button(p: Vector2) -> bool:
	if not hud.visible: return false
	for b: Control in buttons.values():
		if b.visible and b.get_global_rect().grow(6).has_point(p): return true
	return false

func set_level(r: Rules, moves: int) -> void:
	level_num.text = _roman(r.id)
	level_name.text = r.title.to_upper()
	set_moves(moves)
	par_label.text = ""

func set_moves(n: int) -> void:
	moves_label.text = str(n)

func show_par(moves: int, par: int) -> void:
	if moves <= par:
		par_label.text = "par %d  ·  perfect" % par
	else:
		par_label.text = "par %d" % par
	par_label.modulate.a = 0.0
	create_tween().tween_property(par_label, "modulate:a", 1.0, 0.6)

func show_story(text: String, hold := 3.2) -> void:
	story.text = text
	var tw := create_tween()
	tw.tween_property(story, "modulate:a", 1.0, 1.4).set_trans(Tween.TRANS_SINE)
	tw.tween_interval(hold)
	tw.tween_property(story, "modulate:a", 0.0, 1.8).set_trans(Tween.TRANS_SINE)

func show_hint(text: String) -> void:
	hint.text = text
	hint.modulate.a = 0.0
	if text != "":
		var tw := create_tween()
		tw.tween_interval(1.2)
		tw.tween_property(hint, "modulate:a", 0.85, 1.0)

func fade_hint() -> void:
	if hint.modulate.a > 0.0:
		create_tween().tween_property(hint, "modulate:a", 0.0, 0.8)

func set_screen(name: String) -> void:
	title_screen.visible = name == "title"
	select_screen.visible = name == "select"
	hud.visible = name == "play"

func fade_to(a: float, dur: float) -> Tween:
	var tw := create_tween()
	tw.tween_property(fade, "color:a", a, dur)
	return tw

func _process(dt: float) -> void:
	_t += dt
	if title_screen.visible:
		tap_label.modulate.a = 0.45 + 0.4 * sin(_t * 2.0)

static func _roman(n: int) -> String:
	var vals := [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]
	var s := ""
	for v in vals:
		while n >= v[0]:
			s += v[1]; n -= v[0]
	return s


# ====================================================================== drawn widgets
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


class IconButton extends BaseButton:
	## Thin-line icon on a soft disc: menu, undo, rotl, rotr, restart.
	var icon_name := "undo"
	var _press := 0.0

	func _ready() -> void:
		button_down.connect(func() -> void: _press = 1.0; queue_redraw())
		button_up.connect(func() -> void: _press = 0.0; queue_redraw())

	func _draw() -> void:
		var c := size * 0.5
		var r := minf(size.x, size.y) * 0.5
		draw_circle(c, r - 1.0, Color(0.08, 0.08, 0.09, 0.42 + _press * 0.25))
		draw_arc(c, r - 1.5, 0, TAU, 48, Color(0.95, 0.93, 0.88, 0.55), 1.0, true)
		var col := Color(0.97, 0.95, 0.9, 0.95)
		var s := r * 0.42
		match icon_name:
			"menu":
				for k in 3:
					var y := c.y + (k - 1) * s * 0.6
					draw_line(Vector2(c.x - s * 0.75, y), Vector2(c.x + s * 0.75, y), col, 1.4, true)
			"undo":
				draw_arc(c + Vector2(0, s * 0.15), s * 0.85, PI * 1.05, PI * 2.25, 24, col, 1.6, true)
				var tip := c + Vector2(cos(PI * 1.05), sin(PI * 1.05)) * s * 0.85 + Vector2(0, s * 0.15)
				draw_line(tip, tip + Vector2(-s * 0.05, -s * 0.5), col, 1.6, true)
				draw_line(tip, tip + Vector2(s * 0.48, -s * 0.12), col, 1.6, true)
			"rotl", "rotr":
				var dir := -1.0 if icon_name == "rotl" else 1.0
				draw_arc(c, s * 0.8, -PI * 0.5 + dir * 0.4, -PI * 0.5 + dir * (TAU - 0.9), 28, col, 1.4, true)
				var an := -PI * 0.5 + dir * 0.4
				var tip := c + Vector2(cos(an), sin(an)) * s * 0.8
				var tdir := Vector2(-sin(an), cos(an)) * -dir
				draw_line(tip, tip + tdir.rotated(0.6) * s * 0.45, col, 1.4, true)
				draw_line(tip, tip + tdir.rotated(-0.6) * s * 0.45, col, 1.4, true)
				# a tiny diamond = the iso board
				var d := s * 0.28
				draw_polyline(PackedVector2Array([c + Vector2(0, -d), c + Vector2(d, 0), c + Vector2(0, d), c + Vector2(-d, 0), c + Vector2(0, -d)]), col, 1.0, true)
			"restart":
				draw_arc(c, s * 0.8, -PI * 0.35, PI * 1.45, 28, col, 1.4, true)
				var an2 := -PI * 0.35
				var tip2 := c + Vector2(cos(an2), sin(an2)) * s * 0.8
				draw_line(tip2, tip2 + Vector2(-s * 0.48, -s * 0.06), col, 1.4, true)
				draw_line(tip2, tip2 + Vector2(s * 0.05, s * 0.48), col, 1.4, true)


class Medallion extends BaseButton:
	var index := 0
	var best := -1
	var par := 0
	var locked := false
	var font: Font
	var small: Font

	func _ready() -> void:
		focus_mode = Control.FOCUS_NONE

	func _draw() -> void:
		var c := Vector2(size.x * 0.5, 30)
		var r := 26.0
		var solved := best >= 0
		var perfect := solved and best <= par
		if locked:
			draw_circle(c, r, Color(0.1, 0.1, 0.11, 0.35))
			draw_arc(c, r, 0, TAU, 48, Color(0.9, 0.9, 0.86, 0.25), 1.0, true)
		elif solved:
			draw_circle(c, r, Color(0.93, 0.91, 0.86, 0.95))
			draw_arc(c, r + 3.5, 0, TAU, 56, Color(0.45, 0.92, 1.0, 0.9 if perfect else 0.35), 1.4, true)
		else:
			draw_circle(c, r, Color(0.1, 0.1, 0.11, 0.55))
			draw_arc(c, r, 0, TAU, 48, Color(0.95, 0.93, 0.88, 0.9), 1.2, true)
		var txt := GameUI._roman(index + 1)
		var fs := 22
		var tw := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		var col := Color(0.12, 0.12, 0.13) if solved else Color(0.95, 0.93, 0.88, 0.35 if locked else 1.0)
		draw_string(font, Vector2(c.x - tw * 0.5, c.y + 8), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)
		if solved:
			var s := "%d · %d" % [best, par]
			var sw := small.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			draw_string(small, Vector2(c.x - sw * 0.5, c.y + r + 20), s, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.92, 0.91, 0.87, 0.85))


class ChapterBar extends Control:
	var value := 0.0

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE

	func _draw() -> void:
		var y := size.y * 0.5
		draw_line(Vector2(0, y), Vector2(size.x, y), Color(0.95, 0.93, 0.88, 0.25), 1.0, true)
		if value > 0.0:
			draw_line(Vector2(0, y), Vector2(size.x * value, y), Color(0.45, 0.92, 1.0, 0.9), 2.0, true)
