class_name GameUI
extends CanvasLayer
## Title, inscriptions, the rune card (reading a statue), the memory fragment and the end titles.
## Same thin, spaced serif language as the EIDOLON puzzle.

signal begin_pressed
signal anew_pressed
signal quality_pressed

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
var confirm: Control
var confirm_yes: Button
var confirm_no: Button
var text: Label
var card: Control
var card_rune: ColorRect
var card_mat: ShaderMaterial
var memory: Control
var memory_line: Label
var silhouette: Silhouette
var end_a: Label
var end_b: Label
var area_label: Label
var area_rule: Control
var quality_btn: Button
var credits_btn: Button
var credits_panel: Control
var _cr_press := Vector2.INF
var door_overlay: DoorOverlay
var _area_tw: Tween
var fade: ColorRect
var _t := 0.0
var _text_tw: Tween
var _card_tw: Tween
var text_source := Vector3.INF
var inscr_panel: Control
var inscr_rect: ColorRect
var _inscr_tw: Tween
var text_is_inscription := false
var text_is_inscription_call := false
# v0.5
var controls: Controls
var lens_rect: ColorRect
var lens_mat: ShaderMaterial
var bars: Array[ColorRect] = []
var letterbox := 0.0
var cine_line: Label
var skip_ring: SkipRing
var _cine_tw: Tween
var glass_talk: GlassTalk
var satchel: Satchel

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
	# the reading panel for inscriptions (pale stone, the unknown script large)
	inscr_panel = StonePanel.new()
	inscr_panel.set_anchors_preset(Control.PRESET_CENTER)
	inscr_panel.anchor_top = 0.30; inscr_panel.anchor_bottom = 0.30
	inscr_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	inscr_panel.modulate.a = 0.0
	root.add_child(inscr_panel)
	inscr_rect = ColorRect.new()
	inscr_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	inscr_rect.offset_left = 18; inscr_rect.offset_right = -18; inscr_rect.offset_top = 18; inscr_rect.offset_bottom = -18
	inscr_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var im := ShaderMaterial.new()
	im.shader = preload("res://shaders/inscription_ui.gdshader")
	inscr_rect.material = im
	inscr_panel.add_child(inscr_rect)
	# rune card
	card = Control.new()
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.anchor_top = 0.30; card.anchor_bottom = 0.30
	card.offset_left = -105; card.offset_right = 105; card.offset_top = -130; card.offset_bottom = 130
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
	memory_line.anchor_top = 0.80; memory_line.anchor_bottom = 0.80
	memory_line.offset_left = -175; memory_line.offset_right = 175; memory_line.offset_top = -60; memory_line.offset_bottom = 60
	memory_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	memory_line.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_halo(memory_line, Color(0.95, 0.95, 0.93, 0.9))
	memory.add_child(memory_line)
	end_a = _label(italic, 24, Color(0.07, 0.07, 0.08), HORIZONTAL_ALIGNMENT_CENTER)
	end_a.set_anchors_preset(Control.PRESET_CENTER)
	end_a.anchor_top = 0.7; end_a.anchor_bottom = 0.7         # (QA P2-16: below the tholos)
	end_a.offset_left = -190; end_a.offset_right = 190; end_a.offset_top = -14; end_a.offset_bottom = 14
	end_a.text = Names.awakened(Names.FIRST)
	_halo(end_a, Color(0.97, 0.97, 0.95, 1.0))
	end_a.add_theme_constant_override("shadow_outline_size", 22)
	end_a.modulate.a = 0.0
	root.add_child(end_a)
	# shrine counter: a quiet corner mark, "I / VII", that fades after a few seconds
	end_b = _label(caps, 15, Color(0.10, 0.10, 0.11), HORIZONTAL_ALIGNMENT_LEFT)
	end_b.set_anchors_preset(Control.PRESET_TOP_LEFT)
	end_b.offset_left = 22; end_b.offset_right = 200; end_b.offset_top = 30; end_b.offset_bottom = 54
	end_b.text = "I  /  VII"
	_halo(end_b, Color(0.95, 0.95, 0.93, 0.9))
	end_b.modulate.a = 0.0
	root.add_child(end_b)
	# the name of a space, the first time you enter it
	area_label = _label(caps, 13, Color(0.12, 0.12, 0.13), HORIZONTAL_ALIGNMENT_CENTER)
	area_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	area_label.offset_left = -180; area_label.offset_right = 180; area_label.offset_top = 84; area_label.offset_bottom = 104
	_halo(area_label, Color(0.95, 0.95, 0.93, 0.8))
	area_label.modulate.a = 0.0
	root.add_child(area_label)
	# thin rules either side of the name
	area_rule = Rules.new()
	area_rule.label = area_label
	area_rule.set_anchors_preset(Control.PRESET_FULL_RECT)
	area_label.add_child(area_rule)
	door_overlay = DoorOverlay.new()
	door_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	door_overlay.visible = false
	door_overlay.caps = caps
	door_overlay.italic = italic
	root.add_child(door_overlay)
	_build_v05()
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
	gloss.text = "I  ·  " + Names.CHAPTER.to_upper()
	gloss.set_anchors_preset(Control.PRESET_CENTER_TOP)
	gloss.anchor_top = 0.2; gloss.anchor_bottom = 0.2
	gloss.offset_left = -180; gloss.offset_right = 180; gloss.offset_top = 82; gloss.offset_bottom = 100
	_halo(gloss, Color(0.95, 0.94, 0.91, 0.85))          # (QA P2-4: legible over the gate bars)
	title_screen.add_child(gloss)
	tap_label = _label(caps, 14, Color(0.08, 0.08, 0.09), HORIZONTAL_ALIGNMENT_CENTER)
	tap_label.text = "TOUCH TO BEGIN"
	tap_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	tap_label.anchor_top = 0.86; tap_label.anchor_bottom = 0.86
	tap_label.offset_left = -150; tap_label.offset_right = 150; tap_label.offset_top = -12; tap_label.offset_bottom = 12
	_halo(tap_label, Color(0.96, 0.95, 0.92, 0.9))
	title_screen.add_child(tap_label)
	anew_btn = Button.new()
	anew_btn.flat = true
	anew_btn.focus_mode = Control.FOCUS_NONE
	anew_btn.text = "NEW GAME"
	anew_btn.add_theme_font_override("font", caps)
	anew_btn.add_theme_font_size_override("font_size", 12)
	anew_btn.add_theme_color_override("font_color", Color(0.2, 0.2, 0.21, 0.8))
	anew_btn.add_theme_color_override("font_hover_color", Color(0.1, 0.1, 0.11))
	anew_btn.add_theme_color_override("font_pressed_color", Color(0.1, 0.1, 0.11))
	for st in ["normal", "hover", "pressed", "focus"]: anew_btn.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	anew_btn.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	anew_btn.anchor_top = 0.92; anew_btn.anchor_bottom = 0.92
	anew_btn.offset_left = -70; anew_btn.offset_right = 70; anew_btn.offset_top = -16; anew_btn.offset_bottom = 16
	anew_btn.visible = false
	anew_btn.pressed.connect(func() -> void: show_confirm(true))
	title_screen.add_child(anew_btn)
	_build_confirm()
	quality_btn = Button.new()
	quality_btn.flat = true
	quality_btn.focus_mode = Control.FOCUS_NONE
	quality_btn.add_theme_font_override("font", caps)
	quality_btn.add_theme_font_size_override("font_size", 10)
	quality_btn.add_theme_color_override("font_color", Color(0.22, 0.22, 0.23, 0.75))
	quality_btn.add_theme_color_override("font_hover_color", Color(0.1, 0.1, 0.11))
	quality_btn.add_theme_color_override("font_pressed_color", Color(0.1, 0.1, 0.11))
	for st in ["normal", "hover", "pressed", "focus"]: quality_btn.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	quality_btn.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	quality_btn.offset_left = -150; quality_btn.offset_right = -10; quality_btn.offset_top = 16; quality_btn.offset_bottom = 40
	quality_btn.pressed.connect(func() -> void: quality_pressed.emit())
	title_screen.add_child(quality_btn)
	credits_btn = quality_btn.duplicate() as Button
	credits_btn.text = "CREDITS"
	credits_btn.set_anchors_preset(Control.PRESET_TOP_LEFT)
	credits_btn.offset_left = 10; credits_btn.offset_right = 110; credits_btn.offset_top = 16; credits_btn.offset_bottom = 40
	credits_btn.pressed.connect(func() -> void: show_credits(true))
	title_screen.add_child(credits_btn)
	_build_credits()

func _build_credits() -> void:
	credits_panel = ColorRect.new()
	(credits_panel as ColorRect).color = Color(0.93, 0.92, 0.89, 0.97)
	credits_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	credits_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	credits_panel.visible = false
	root.add_child(credits_panel)
	var sc := ScrollContainer.new()
	sc.set_anchors_preset(Control.PRESET_FULL_RECT)
	sc.offset_left = 28; sc.offset_right = -28; sc.offset_top = 70; sc.offset_bottom = -70
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	credits_panel.add_child(sc)
	var l := _label(italic, 14, Color(0.16, 0.16, 0.17), HORIZONTAL_ALIGNMENT_CENTER)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.text = Credits.TEXT
	sc.add_child(l)
	var head := _label(caps, 13, Color(0.14, 0.14, 0.15), HORIZONTAL_ALIGNMENT_CENTER)
	head.text = "CREDITS"
	head.set_anchors_preset(Control.PRESET_TOP_WIDE)
	head.offset_top = 30; head.offset_bottom = 54
	credits_panel.add_child(head)
	var close := _label(caps, 11, Color(0.22, 0.22, 0.23, 0.8), HORIZONTAL_ALIGNMENT_CENTER)
	close.text = "TOUCH TO RETURN"
	close.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	close.offset_top = -50; close.offset_bottom = -26
	credits_panel.add_child(close)
	# a tap (not a scroll drag) returns to the title
	credits_panel.gui_input.connect(func(e: InputEvent) -> void:
		var press: bool = (e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT) or e is InputEventScreenTouch
		if not press: return
		if e.pressed: _cr_press = e.position
		elif e.position.distance_to(_cr_press) < 12.0: show_credits(false))
	l.mouse_filter = Control.MOUSE_FILTER_PASS
	sc.mouse_filter = Control.MOUSE_FILTER_PASS

func show_credits(on: bool) -> void:
	credits_panel.visible = on
	credits_panel.modulate.a = 0.0 if on else 1.0
	if on: create_tween().tween_property(credits_panel, "modulate:a", 1.0, 0.35)

func set_continue(has_save: bool) -> void:
	tap_label.text = "CONTINUE" if has_save else "TOUCH TO BEGIN"
	anew_btn.visible = has_save

## "Begin anew? Your progress will be forgotten."  Yes / No
func _build_confirm() -> void:
	confirm = ColorRect.new()
	(confirm as ColorRect).color = Color(0.93, 0.92, 0.89, 0.9)
	confirm.set_anchors_preset(Control.PRESET_FULL_RECT)
	confirm.mouse_filter = Control.MOUSE_FILTER_STOP
	confirm.visible = false
	title_screen.add_child(confirm)
	var q := _label(italic, 24, Color(0.14, 0.14, 0.15), HORIZONTAL_ALIGNMENT_CENTER)
	q.text = "Begin anew?"
	q.set_anchors_preset(Control.PRESET_CENTER)
	q.offset_left = -170; q.offset_right = 170; q.offset_top = -70; q.offset_bottom = -36
	confirm.add_child(q)
	var sub := _label(italic, 15, Color(0.22, 0.22, 0.23), HORIZONTAL_ALIGNMENT_CENTER)
	sub.text = "Your progress will be forgotten."
	sub.set_anchors_preset(Control.PRESET_CENTER)
	sub.offset_left = -170; sub.offset_right = 170; sub.offset_top = -30; sub.offset_bottom = -6
	confirm.add_child(sub)
	var rule := ColorRect.new()
	rule.color = Color(0.2, 0.2, 0.21, 0.35)
	rule.set_anchors_preset(Control.PRESET_CENTER)
	rule.offset_left = -40; rule.offset_right = 40; rule.offset_top = 8; rule.offset_bottom = 9
	confirm.add_child(rule)
	confirm_yes = _flat_button("YES", 13)
	confirm_yes.set_anchors_preset(Control.PRESET_CENTER)
	confirm_yes.offset_left = -120; confirm_yes.offset_right = -20; confirm_yes.offset_top = 24; confirm_yes.offset_bottom = 60
	confirm_yes.pressed.connect(func() -> void:
		show_confirm(false)
		anew_pressed.emit())
	confirm.add_child(confirm_yes)
	confirm_no = _flat_button("NO", 13)
	confirm_no.set_anchors_preset(Control.PRESET_CENTER)
	confirm_no.offset_left = 20; confirm_no.offset_right = 120; confirm_no.offset_top = 24; confirm_no.offset_bottom = 60
	confirm_no.pressed.connect(func() -> void: show_confirm(false))
	confirm.add_child(confirm_no)

func _flat_button(t: String, size: int) -> Button:
	var b := Button.new()
	b.flat = true
	b.focus_mode = Control.FOCUS_NONE
	b.text = t
	b.add_theme_font_override("font", caps)
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_color_override("font_color", Color(0.16, 0.16, 0.17))
	b.add_theme_color_override("font_hover_color", Color(0.05, 0.05, 0.06))
	b.add_theme_color_override("font_pressed_color", Color(0.05, 0.05, 0.06))
	for st in ["normal", "hover", "pressed", "focus"]: b.add_theme_stylebox_override(st, StyleBoxEmpty.new())
	return b

func show_confirm(on: bool) -> void:
	confirm.visible = on
	if on:
		confirm.modulate.a = 0.0
		create_tween().tween_property(confirm, "modulate:a", 1.0, 0.3)

func over_anew(p: Vector2) -> bool:
	return (anew_btn.visible and anew_btn.get_global_rect().grow(8).has_point(p)) or quality_btn.get_global_rect().grow(6).has_point(p) \
		or credits_btn.get_global_rect().grow(6).has_point(p) or credits_panel.visible or confirm.visible

func set_quality_label(tier: String) -> void:
	quality_btn.text = "QUALITY · " + tier.to_upper()

func hide_title() -> void:
	var tw := create_tween()
	tw.tween_property(title_screen, "modulate:a", 0.0, 1.2)
	tw.tween_callback(func() -> void: title_screen.visible = false)

func show_text(s: String, source := Vector3.INF, hold := 5.0) -> void:
	if not text_is_inscription_call:
		# a plain line (not an inscription): the usual place, lower on the screen
		text.anchor_top = 0.66; text.anchor_bottom = 0.66
		text.offset_top = -60; text.offset_bottom = 60
		text.add_theme_font_size_override("font_size", 19)
		text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	text.text = s
	text_source = source
	if _text_tw: _text_tw.kill()
	_text_tw = create_tween()
	_text_tw.tween_property(text, "modulate:a", 1.0, 1.0).set_trans(Tween.TRANS_SINE)
	_text_tw.tween_interval(hold)
	_text_tw.tween_property(text, "modulate:a", 0.0, 1.6).set_trans(Tween.TRANS_SINE)

## reading an inscription: the unknown script large on a stone panel, the wanderer's understanding
## of it beneath in small italic English
func show_inscription(s: String, script: Array, source: Vector3) -> void:
	var m: ShaderMaterial = inscr_rect.material
	m.set_shader_parameter("seed", script[0])
	m.set_shader_parameter("rows", script[1])
	m.set_shader_parameter("cols", script[2])
	m.set_shader_parameter("aspect", script[3])
	var w := minf(330.0, root.size.x - 64.0)          # (v0.8: the panel keeps 14 px clear of the screen edge)
	var h := clampf(w / float(script[4]), 160.0, 330.0)
	w = minf(w, h * float(script[4]))
	inscr_panel.offset_left = -w * 0.5 - 18.0; inscr_panel.offset_right = w * 0.5 + 18.0
	inscr_panel.offset_top = -h * 0.5 - 18.0; inscr_panel.offset_bottom = h * 0.5 + 18.0
	text.anchor_top = 0.30; text.anchor_bottom = 0.30
	text.offset_top = h * 0.5 + 28.0; text.offset_bottom = h * 0.5 + 118.0
	text.add_theme_font_size_override("font_size", 17)
	if _inscr_tw: _inscr_tw.kill()
	_inscr_tw = create_tween()
	_inscr_tw.tween_property(inscr_panel, "modulate:a", 1.0, 0.8).set_trans(Tween.TRANS_SINE)
	_inscr_tw.tween_interval(6.0)
	_inscr_tw.tween_property(inscr_panel, "modulate:a", 0.0, 1.6).set_trans(Tween.TRANS_SINE)
	text_is_inscription_call = true
	show_text(s, source, 6.0)
	text.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	text_is_inscription_call = false
	text_is_inscription = true

func hide_text() -> void:
	if inscr_panel and inscr_panel.modulate.a > 0.0:
		if _inscr_tw: _inscr_tw.kill()
		_inscr_tw = create_tween()
		_inscr_tw.tween_property(inscr_panel, "modulate:a", 0.0, 0.8)
	if text.modulate.a <= 0.0: return
	if _text_tw: _text_tw.kill()
	_text_tw = create_tween()
	_text_tw.tween_property(text, "modulate:a", 0.0, 0.8)
	text_source = Vector3.INF

func show_rune(design: int, numeral: int) -> void:
	card_mat.set_shader_parameter("design", float(design))
	card_mat.set_shader_parameter("numeral", float(numeral))
	card_mat.set_shader_parameter("glow", 1.0)
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

## a milestone, not an ending: the space's name, and the shrine count in the corner
func show_milestone(woken: int, total: int, hold: float) -> void:
	end_b.text = "%s  /  %s" % [_roman(woken), _roman(total)]
	var tw := create_tween()
	tw.tween_property(end_a, "modulate:a", 1.0, 2.0)
	tw.tween_interval(hold)
	tw.tween_property(end_a, "modulate:a", 0.0, 2.0)
	var tc := create_tween()
	tc.tween_interval(1.2)
	tc.tween_property(end_b, "modulate:a", 1.0, 1.6)
	tc.tween_interval(hold + 2.5)
	tc.tween_property(end_b, "modulate:a", 0.0, 2.5)

static func _roman(n: int) -> String:
	var vals := [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]
	var r := ""
	for v in vals:
		while n >= v[0]:
			r += v[1]; n -= v[0]
	return r

func show_area(title: String) -> void:
	# (v1.0 QA P1-12, QA_V11 P1-4: never under the HUD slots and never cut off: the title keeps between the slots;
	# too long for one line, it breaks at the most even word gap onto two, and steps its size down until both fit)
	var half := clampf((root.size.x - 2.0 * 82.0) * 0.5, 100.0, 180.0)
	var aw := half * 2.0 - 6.0
	var t := title.to_upper()
	var f := area_label.get_theme_font("font")
	var lines := [t]
	var fs := 13
	if f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x > aw:
		var words := t.split(" ", false)
		var best := 1e9
		for k in range(1, words.size()):
			var a := " ".join(words.slice(0, k))
			var b := " ".join(words.slice(k))
			var m := maxf(f.get_string_size(a, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x, f.get_string_size(b, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x)
			if m < best: best = m; lines = [a, b]
		while fs > 9 and _widest(f, lines, fs) > aw: fs -= 1
	area_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	area_label.clip_text = false
	area_label.add_theme_font_size_override("font_size", fs)
	area_label.text = "\n".join(lines)
	area_label.offset_left = -half; area_label.offset_right = half
	area_label.offset_bottom = area_label.offset_top + (20.0 if lines.size() == 1 else 38.0)
	area_rule.queue_redraw()
	if _area_tw: _area_tw.kill()
	_area_tw = create_tween()
	_area_tw.tween_property(area_label, "modulate:a", 0.85, 1.6).set_trans(Tween.TRANS_SINE)
	_area_tw.tween_interval(2.6)
	_area_tw.tween_property(area_label, "modulate:a", 0.0, 2.0).set_trans(Tween.TRANS_SINE)

func _widest(f: Font, lines: Array, fs: int) -> float:
	var w := 0.0
	for l in lines: w = maxf(w, f.get_string_size(l, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x)
	return w

func fade_to(a: float, dur: float) -> Tween:
	var tw := create_tween()
	tw.tween_property(fade, "color:a", a, dur)
	return tw

func _process(dt: float) -> void:
	_t += dt
	if title_screen.visible:
		tap_label.modulate.a = 0.78 + 0.22 * sin(_t * 2.0)
	silhouette.t = _t
	if memory.modulate.a > 0.0: silhouette.queue_redraw()
	# (QA P2-5) the area title never shows through the reading panel
	area_label.visible = inscr_panel.modulate.a < 0.05


class Rules extends Control:
	var label: Label
	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		if label == null: return
		var f := label.get_theme_font("font")
		var fs := label.get_theme_font_size("font_size")
		var w := 0.0
		for l in label.text.split("\n"): w = maxf(w, f.get_string_size(l, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x)
		var cy := size.y * 0.5 + 1.0
		var cx := size.x * 0.5
		var gap := w * 0.5 + 14.0
		var col := Color(0.12, 0.12, 0.13, 0.55)
		# (QA P2-1: the rules stop short of the screen-edge slots: at most 150 px either side of the centre)
		var L := clampf(150.0 - gap, 10.0, 46.0)
		draw_line(Vector2(cx - gap - L, cy), Vector2(cx - gap, cy), col, 1.0, true)
		draw_line(Vector2(cx + gap, cy), Vector2(cx + gap + L, cy), col, 1.0, true)
		draw_circle(Vector2(cx - gap - L - 4.0, cy), 1.4, col)
		draw_circle(Vector2(cx + gap + L + 4.0, cy), 1.4, col)

class StonePanel extends Control:
	## a slab of pale stone with a carved border
	func _draw() -> void:
		var r := Rect2(Vector2.ZERO, size)
		draw_rect(r.grow(3.0), Color(0.12, 0.12, 0.13, 0.55))
		draw_rect(r, Color(0.80, 0.79, 0.76, 0.96))
		for k in 9:
			var y := r.size.y * (0.05 + 0.11 * k)
			draw_line(Vector2(6.0, y + sin(k * 2.3) * 4.0), Vector2(r.size.x - 6.0, y + 7.0 + cos(k * 1.3) * 5.0), Color(0.68, 0.67, 0.64, 0.4), 1.0, true)
		draw_rect(r.grow(-7.0), Color(0.45, 0.45, 0.45, 0.8), false, 1.2)
		draw_rect(r.grow(-11.0), Color(Palette.ACCENT, 0.35), false, 1.0)

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
		draw_arc(c, r * 0.97, 0, TAU, 64, Color(Palette.ACCENT, 0.6), 1.0, true)


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
			draw_colored_polygon(pts, Color(Palette.CORE, 0.06 * a))
		draw_colored_polygon(base, Color(0.86, 0.96, 1.0, 0.22 * a))
		var outline := base.duplicate()
		outline.append(base[0])
		draw_polyline(outline, Color(Palette.CORE, 0.6 * a), 1.2, true)
		# a faint vertical fold or two, and the face pressing through the veil
		draw_line(Vector2(cx - s * 0.12, top + s * 0.7), Vector2(cx - s * 0.2, top + s * 1.55), Color(Palette.CORE, 0.25 * a), 1.0, true)
		draw_line(Vector2(cx + s * 0.16, top + s * 0.68), Vector2(cx + s * 0.28, top + s * 1.58), Color(Palette.CORE, 0.22 * a), 1.0, true)
		draw_arc(Vector2(cx, top + s * 0.19), s * 0.13, PI * 0.15, PI * 0.85, 16, Color(Palette.CORE, 0.3 * a), 1.0, true)

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



class DoorOverlay extends Control:
	## The rune door, close up. A big glowing card (like reading a statue) shows the rune in the ACTIVE
	## slot with its name; below, the three slots as large cards in a row (the active one ringed).
	## v0.4: tapping ANY rune turns it: a slot card turns that slot (and makes it active), the big card
	## turns the active slot; the arrows turn the active slot forward / back. Cards keep the rune's true
	## proportions at any width. The close button consumes its tap; the world ignores input briefly.
	## Keyboard: left/right choose the slot, E turns, Q/Esc closes.
	signal slot_pressed(i: int)          # turn slot i forward
	signal slot_back(i: int)             # turn slot i back
	signal closed
	const NAMES := ["EIDOS", "MEANDROS", "KATOPTRON", "KYKLOS", "TRIGONON", "TETRAKTYS"]
	var caps: Font
	var italic: Font
	var slots: Array[Control] = []
	var mats: Array[ShaderMaterial] = []
	var big: Control
	var big_mat: ShaderMaterial
	var designs := [-1, -1, -1]
	var selected := 0
	var _flare := 0.0
	var _t := 0.0
	var _close_r := Rect2()
	var _left_r := Rect2()
	var _right_r := Rect2()
	var _name_y := 0.0
	var _closing := false
	var _tweens: Array[Tween] = []

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_STOP
		big = _card(true)
		for i in 3: _card(false, i)
		resized.connect(_layout)
		_layout()

	func _card(is_big: bool, i := 0) -> Control:
		var c := Control.new()
		c.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(c)
		var disc := CardDisc.new()
		disc.set_anchors_preset(Control.PRESET_FULL_RECT)
		c.add_child(disc)
		var r := ColorRect.new()
		r.set_anchors_preset(Control.PRESET_FULL_RECT)
		r.offset_left = 10; r.offset_right = -10; r.offset_top = 8; r.offset_bottom = -8
		r.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/rune_ui.gdshader")
		m.set_shader_parameter("design", -1.0)
		r.material = m
		c.add_child(r)
		if is_big:
			big_mat = m
		else:
			m.set_shader_parameter("numeral", float(i + 1))
			slots.append(c)
			mats.append(m)
		return c

	func _layout() -> void:
		var W := size.x
		var bw := minf(220.0, W * 0.56)
		var bh := bw * 1.22
		big.size = Vector2(bw, bh)
		big.position = Vector2((W - bw) * 0.5, size.y * 0.30 - bh * 0.5)
		big.pivot_offset = big.size * 0.5
		big_mat.set_shader_parameter("aspect", (bh - 16.0) / (bw - 20.0))
		_name_y = big.position.y + bh + 26.0
		_left_r = Rect2(big.position.x - 64.0, big.position.y + bh * 0.5 - 30.0, 56.0, 60.0)
		_right_r = Rect2(big.position.x + bw + 8.0, big.position.y + bh * 0.5 - 30.0, 56.0, 60.0)
		# three evenly spaced cards, each at least 100 px wide at 360-430 px screens, true proportions
		var sw := clampf((W - 64.0) / 3.0, 100.0, 118.0)
		var sh := sw * 1.25
		var gap := (W - 3.0 * sw) / 4.0
		for i in 3:
			var c := slots[i]
			c.size = Vector2(sw, sh)
			c.position = Vector2(gap + i * (sw + gap), size.y * 0.70 - sh * 0.5)
			c.pivot_offset = c.size * 0.5
			c.scale = Vector2.ONE
			mats[i].set_shader_parameter("aspect", (sh - 16.0) / (sw - 20.0))
		_close_r = Rect2(18.0, 26.0, 40.0, 40.0)      # top LEFT: never over the rotate buttons
		queue_redraw()

	func open(state: Array, sel: int) -> void:
		_kill_tweens()
		_closing = false
		_flare = 0.0
		mouse_filter = Control.MOUSE_FILTER_STOP
		big.scale = Vector2.ONE
		for c in slots: c.scale = Vector2.ONE
		designs = state.duplicate()
		selected = sel
		for i in 3: _apply(i)
		_apply_big()
		visible = true
		modulate.a = 0.0
		create_tween().tween_property(self, "modulate:a", 1.0, 0.35)
		_layout()

	func close() -> void:
		if _closing or not visible: return
		_closing = true
		# stop every running flip / select tween so nothing is left half-turned or overlapping, and
		# stop taking input at once (the fade-out is visual only)
		_kill_tweens()
		big.scale = Vector2.ONE
		for c in slots: c.scale = Vector2.ONE
		_apply_big()
		for i in 3: _apply(i)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		var tw := create_tween()
		tw.tween_property(self, "modulate:a", 0.0, 0.25)
		tw.tween_callback(func() -> void:
			visible = false
			_closing = false)
		closed.emit()

	func _tw() -> Tween:
		var t := create_tween()
		_tweens.append(t)
		return t

	func _kill_tweens() -> void:
		for t in _tweens:
			if t and t.is_valid(): t.kill()
		_tweens.clear()

	func select(i: int) -> void:
		if i == selected: return
		selected = i
		var tw := _tw()
		tw.tween_property(big, "scale", Vector2(0.92, 0.92), 0.08)
		tw.tween_callback(_apply_big)
		tw.tween_property(big, "scale", Vector2.ONE, 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

	func _apply(i: int) -> void:
		mats[i].set_shader_parameter("design", float(designs[i]))
		mats[i].set_shader_parameter("glow", 0.0 if designs[i] < 0 else 1.0)

	func _apply_big() -> void:
		var d: int = designs[selected]
		big_mat.set_shader_parameter("design", float(d))
		big_mat.set_shader_parameter("numeral", float(selected + 1))
		big_mat.set_shader_parameter("glow", 0.0 if d < 0 else 1.3)
		queue_redraw()

	## the active rune turns over: the big card and its slot card flip together
	func flip(i: int, new_design: int) -> void:
		designs[i] = new_design
		for c in [slots[i], big]:
			var cc: Control = c
			var tw := _tw()
			tw.tween_property(cc, "scale:x", 0.0, 0.11).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
			tw.tween_callback(func() -> void:
				_apply(i)
				if i == selected: _apply_big())
			tw.tween_property(cc, "scale:x", 1.0, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

	func flare() -> void:
		var tw := _tw()
		tw.tween_property(self, "_flare", 1.0, 0.5)
		tw.tween_interval(0.8)
		tw.tween_callback(func() -> void: close.call_deferred())

	func big_center() -> Vector2:
		return big.position + big.size * 0.5

	func _gui_input(e: InputEvent) -> void:
		var p := Vector2.INF
		if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT: p = e.position
		if p == Vector2.INF or _closing: return
		accept_event()
		if _close_r.grow(10.0).has_point(p):
			close()
			return
		if _left_r.grow(6.0).has_point(p):
			slot_back.emit(selected)
			return
		if _right_r.grow(6.0).has_point(p) or Rect2(big.position, big.size).has_point(p):
			slot_pressed.emit(selected)
			return
		for i in 3:
			if Rect2(slots[i].position, slots[i].size).grow(8.0).has_point(p):
				slot_pressed.emit(i)          # tapping a slot's rune turns it
				return

	func _process(dt: float) -> void:
		if not visible: return
		_t += dt
		queue_redraw()

	func _draw() -> void:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0.04, 0.045, 0.05, 0.78))
		var cy := Palette.CORE
		# the active slot: its card ringed, a thread of light up to the big card
		for i in 3:
			var c := slots[i]
			var r := Rect2(c.position, c.size)
			var on := i == selected
			var pulse := 0.5 + 0.5 * sin(_t * 3.5)
			draw_rect(r.grow(4.0), Color(cy, (0.85 + 0.15 * pulse) if on else 0.22), false, 2.0 if on else 1.0)
			if on:
				var a := Vector2(r.get_center().x, r.position.y - 6.0)
				var b := Vector2(big.position.x + big.size.x * 0.5, big.position.y + big.size.y + 44.0)
				draw_line(a, b, Color(cy, 0.35), 1.0, true)
			if caps:
				var t: String = NAMES[designs[i]] if designs[i] >= 0 else "—"
				var fs := 10
				var w := caps.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
				draw_string(caps, Vector2(r.get_center().x - w * 0.5, r.end.y + 20.0), t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(0.85, 0.9, 0.92, 0.9 if on else 0.55))
		draw_rect(Rect2(big.position, big.size).grow(6.0), Color(cy, 0.25 + 0.5 * _flare), false, 1.0)
		# the rune's name under the big card
		if caps:
			var d: int = designs[selected]
			var name: String = NAMES[d] if d >= 0 else "EMPTY"
			var fs2 := 22
			var w2 := caps.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs2).x
			draw_string(caps, Vector2(size.x * 0.5 - w2 * 0.5, _name_y), name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs2, Palette.CORE)
			var sub: String = "SLOT  " + ["I", "II", "III"][selected]
			var w3 := caps.get_string_size(sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			draw_string(caps, Vector2(size.x * 0.5 - w3 * 0.5, _name_y + 22.0), sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.7, 0.8, 0.85, 0.75))
		if italic:
			var line := "tap a rune to turn it  ·  as the veiled ones are numbered"
			var w4 := italic.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			draw_string(italic, Vector2(size.x * 0.5 - w4 * 0.5, size.y * 0.70 + slots[0].size.y * 0.5 + 54.0), line, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.75, 0.8, 0.82, 0.8))
		# arrows
		for sd in [-1, 1]:
			var rr := _left_r if sd < 0 else _right_r
			var c2 := rr.get_center()
			draw_circle(c2, 22.0, Color(0.1, 0.12, 0.13, 0.8))
			draw_arc(c2, 22.0, 0, TAU, 40, Color(cy, 0.7), 1.3, true)
			var tip := c2 + Vector2(7.0 * sd, 0)
			draw_line(tip, tip + Vector2(-11.0 * sd, -10.0), Color(0.95, 1, 1), 2.0, true)
			draw_line(tip, tip + Vector2(-11.0 * sd, 10.0), Color(0.95, 1, 1), 2.0, true)
		# close
		var cc := _close_r.get_center()
		draw_circle(cc, 18.0, Color(0.1, 0.1, 0.11, 0.9))
		draw_arc(cc, 18.0, 0, TAU, 32, Color(0.9, 0.9, 0.88, 0.75), 1.0, true)
		draw_line(cc + Vector2(-6, -6), cc + Vector2(6, 6), Color(0.95, 0.95, 0.92), 1.8, true)
		draw_line(cc + Vector2(6, -6), cc + Vector2(-6, 6), Color(0.95, 0.95, 0.92), 1.8, true)


# ================================================================== v0.5: shard, lens, cinematic
const LENS_SHADER := """
shader_type canvas_item;
uniform vec2 center = vec2(200.0, 400.0);
uniform float radius = 140.0;
uniform float on = 0.0;
uniform vec2 vp = vec2(400.0, 860.0);
void fragment() {
	vec2 p = UV * vp;
	float d = length(p - center);
	float outside = smoothstep(radius - 3.0, radius + 22.0, d);
	float rim = exp(-pow((d - radius) / 2.2, 2.0)) * 0.55 + exp(-pow((d - radius - 6.0) / 7.0, 2.0)) * 0.12;
	vec3 tint = vec3(0.16, 0.08, 0.09);                      // (v0.9: a deep wine dusk outside the shard)
	COLOR = vec4(mix(vec3(1.0, 0.74, 0.70), tint, outside), (outside * 0.38 + rim) * on);
}
"""

func _build_v05() -> void:
	lens_rect = ColorRect.new()
	lens_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	lens_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = LENS_SHADER
	lens_mat = ShaderMaterial.new()
	lens_mat.shader = sh
	lens_rect.material = lens_mat
	lens_rect.visible = false
	root.add_child(lens_rect)
	root.move_child(lens_rect, 0)
	for i in 2:
		var b := ColorRect.new()
		b.color = Color(0.035, 0.035, 0.04, 1.0)
		b.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.set_anchors_preset(Control.PRESET_TOP_WIDE if i == 0 else Control.PRESET_BOTTOM_WIDE)
		b.offset_top = 0; b.offset_bottom = 0
		root.add_child(b)
		bars.append(b)
	cine_line = _label(italic, 20, Color(0.93, 0.92, 0.88), HORIZONTAL_ALIGNMENT_CENTER)
	cine_line.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	cine_line.offset_left = 24; cine_line.offset_right = -24; cine_line.offset_top = -96; cine_line.offset_bottom = -30
	cine_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cine_line.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	cine_line.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	cine_line.add_theme_constant_override("shadow_outline_size", 8)
	cine_line.modulate.a = 0.0
	root.add_child(cine_line)
	skip_ring = SkipRing.new()
	skip_ring.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	skip_ring.offset_left = -64; skip_ring.offset_right = -16; skip_ring.offset_top = 16; skip_ring.offset_bottom = 64
	skip_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	skip_ring.caps = caps
	root.add_child(skip_ring)
	# the close-up of a small pane: a conversation through the glass (GlassTalk)
	glass_talk = GlassTalk.new()
	glass_talk.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(glass_talk)

## v1.0 M3b: something new in the satchel
func show_item(k: String, extra := "") -> void:
	if satchel: satchel.show_item(k, extra)

func set_inventory(has: bool, on: bool) -> void:
	if controls:
		controls.inv_has = has
		controls.inv_on = on

## the shard raised: everything outside its circle dims to petrol (sp: screen position, r: radius)
func set_lens(on: bool, sp: Vector2, r: float) -> void:
	lens_rect.visible = on
	if not on: return
	lens_mat.set_shader_parameter("vp", root.size)
	lens_mat.set_shader_parameter("center", sp)
	lens_mat.set_shader_parameter("radius", r)
	lens_mat.set_shader_parameter("on", 1.0)

## the cinematic's black bars (0..1 = up to 11 % of the height each)
func set_letterbox(k: float) -> void:
	letterbox = k
	var h := root.size.y * 0.11 * k
	bars[0].offset_bottom = h
	bars[1].offset_top = -h

func show_cine_line(s: String, hold: float) -> void:
	cine_line.text = s
	if _cine_tw: _cine_tw.kill()
	_cine_tw = create_tween()
	_cine_tw.tween_property(cine_line, "modulate:a", 1.0, 1.8).set_trans(Tween.TRANS_SINE)
	_cine_tw.tween_interval(hold)
	_cine_tw.tween_property(cine_line, "modulate:a", 0.0, 1.8).set_trans(Tween.TRANS_SINE)

func hide_cine_line() -> void:
	if _cine_tw: _cine_tw.kill()
	cine_line.modulate.a = 0.0

## hold to skip: a thin ring fills in the corner
func set_skip(k: float, show: bool) -> void:
	skip_ring.k = k
	skip_ring.show_k = move_toward(skip_ring.show_k, 1.0 if show else 0.0, get_process_delta_time() * 4.8)      # (v0.8.5: the same at any refresh rate)
	skip_ring.queue_redraw()

class SkipRing extends Control:
	var k := 0.0
	var show_k := 0.0
	var caps: Font
	func _draw() -> void:
		if show_k <= 0.01: return
		var c := size * 0.5
		draw_arc(c, 15.0, 0, TAU, 40, Color(0.93, 0.92, 0.88, 0.25 * show_k), 1.0, true)
		if k > 0.0:
			draw_arc(c, 15.0, -PI * 0.5, -PI * 0.5 + TAU * k, 40, Color(Palette.CORE, 0.9 * show_k), 2.0, true)
		if caps:
			draw_string(caps, Vector2(-40, c.y + 4), "HOLD", HORIZONTAL_ALIGNMENT_RIGHT, 36, 9, Color(0.93, 0.92, 0.88, 0.55 * show_k))
