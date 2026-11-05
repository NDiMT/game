class_name IntroCard
extends Control
## v2.0 (Agent A) the intro's text cards (EIDOLON_SCRIPT §5): white letters on black, each card shown for a moment
## MIRRORED, then it turns over (a card flip about its vertical axis) and reads true; the ink soaks in, holds, and
## dissolves into fog. Full-screen; put it on a CanvasLayer above the game.
##   var ic := IntroCard.new(); canvas_layer.add_child(ic)
##   await ic.play("Στα Κύθηρα ζούσε ένας γλύπτης που λεγόταν Θήρων.", 3.0)      (one card; returns when it has gone)
##   await ic.play_all(lines, 3.0)                                              (a list, one after another)
##   ic.skip()                                                                  (finish the current card at once)
## Font: assets/fonts/LiberationSerif (Greek and Latin). A card may hold several lines ("\n"); a line wrapped in
## *...* is set in italics (Aphrodite's words), so one stanza of the script = one card.

signal card_done

const FONT := preload("res://assets/fonts/LiberationSerif-Regular.ttf")
const FONT_I := preload("res://assets/fonts/LiberationSerif-Italic.ttf")
@export var font_size := 26
@export var mirrored_hold := 0.55     # how long it reads mirrored before it turns
@export var flip_time := 0.75
var _label: RichTextLabel
var _pivot: Control
var _mat: ShaderMaterial
var _tw: Tween
var _skip := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := ColorRect.new()
	bg.color = Color(0.0, 0.0, 0.0)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	_pivot = Control.new()
	_pivot.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pivot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pivot)
	var box := VBoxContainer.new()                  # (centres the text block vertically)
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_pivot.add_child(box)
	_label = RichTextLabel.new()
	_label.bbcode_enabled = true
	_label.fit_content = true
	_label.scroll_active = false
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_label.add_theme_font_override("normal_font", FONT)
	_label.add_theme_font_override("italics_font", FONT_I)
	_label.add_theme_font_size_override("normal_font_size", font_size)
	_label.add_theme_font_size_override("italics_font_size", font_size)
	_label.add_theme_color_override("default_color", Color(0.93, 0.93, 0.92))
	_label.add_theme_constant_override("line_separation", 8)
	_mat = ShaderMaterial.new()
	_mat.shader = preload("res://shaders/card_ink.gdshader")
	_label.material = _mat
	box.add_child(_label)
	resized.connect(_layout)
	_layout()

func _layout() -> void:
	var m := size.x * 0.1
	var box := _label.get_parent() as Control
	box.offset_left = m; box.offset_right = -m
	_pivot.pivot_offset = size * 0.5

func skip() -> void:
	_skip = true
	if _tw and _tw.is_running(): _tw.custom_step(100.0)

## one card: mirrored, it turns true, holds `hold` s, dissolves; returns when it has gone
func play(text: String, hold := 3.0) -> void:
	if not is_node_ready(): await ready
	_skip = false
	# *...* sets italics, and may span lines (Aphrodite's two-line answer is one *...*)
	var lines := PackedStringArray()
	var ital := false
	for l in text.split("\n"):
		var e := l.strip_edges().replace("[", "[lb]")
		var opens := e.begins_with("*")
		var closes := e.ends_with("*") and (e.length() > 1 or not opens)
		e = e.trim_prefix("*") if opens else e
		e = e.trim_suffix("*") if closes else e
		var on := ital or opens
		lines.append("[i]%s[/i]" % e if on else e)
		ital = on and not closes
	_label.text = "[center]%s[/center]" % "\n".join(lines)
	_mat.set_shader_parameter("reveal", 0.0)
	_mat.set_shader_parameter("fade", 0.0)
	_pivot.scale = Vector2(-1.0, 1.0)              # mirrored: as the glass shows it
	if _tw: _tw.kill()
	_tw = create_tween()
	_tw.tween_method(func(v: float) -> void: _mat.set_shader_parameter("reveal", v), 0.0, 1.0, 0.9)
	_tw.tween_interval(mirrored_hold)
	# the turn: through edge-on (scale.x 0) to true, eased like a card flipped by hand
	_tw.tween_property(_pivot, "scale:x", 1.0, flip_time).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tw.tween_interval(hold)
	_tw.tween_method(func(v: float) -> void: _mat.set_shader_parameter("fade", v), 0.0, 1.0, 1.3)
	await _tw.finished
	card_done.emit()

func play_all(lines: Array, hold := 3.0) -> void:
	for l in lines:
		await play(String(l), hold)
