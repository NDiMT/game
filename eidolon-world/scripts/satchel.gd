class_name Satchel
extends Control
## v1.0 M3b: the satchel. A card of slots (A's icons), the chosen thing's name and one line; and the small
## toast when something new goes into it. Opened from the satchel slot (top left, under the shard's).

const CREAM := Color(0.95, 0.93, 0.88)
const INK := Color(0.10, 0.10, 0.11)
const SLOT := 64.0

var game: Game
var serif: Font
var italic: Font
var card: Panel
var grid: GridContainer
var name_l: Label
var line_l: Label
var slots: Array = []                 # [key, Button]
var sel := ""
var toast: PanelContainer
var toast_icon: TextureRect
var toast_name: Label
var toast_line: Label
var _toast_tw: Tween
var is_open := false
# v1.0 M3c: the hand-drawn map (A's MapView), opened from the satchel
var map_layer: Control
var map: MapView
var map_btn: Button
var seal_marks := {}
var map_open := false

func build(g: Game, sf: Font, it: Font, host: Control) -> void:
	game = g
	serif = sf
	italic = it
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.03, 0.035, 0.55)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(dim)
	card = Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(CREAM, 0.96)
	sb.set_corner_radius_all(6)
	sb.border_color = Color(INK, 0.25)
	sb.set_border_width_all(1)
	card.add_theme_stylebox_override("panel", sb)
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.custom_minimum_size = Vector2(320, 360)
	card.offset_left = -160; card.offset_right = 160; card.offset_top = -190; card.offset_bottom = 170
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(card)
	var title := _label(serif, 15, Color(INK, 0.6), HORIZONTAL_ALIGNMENT_CENTER)
	title.text = "T H E   S A T C H E L"
	title.position = Vector2(0, 14); title.size = Vector2(320, 22)
	card.add_child(title)
	grid = GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	grid.position = Vector2(18, 48)
	grid.size = Vector2(284, 150)
	card.add_child(grid)
	name_l = _label(serif, 19, INK, HORIZONTAL_ALIGNMENT_CENTER)
	name_l.position = Vector2(16, 216); name_l.size = Vector2(288, 28)
	card.add_child(name_l)
	line_l = _label(italic, 15, Color(INK, 0.78), HORIZONTAL_ALIGNMENT_CENTER)
	line_l.position = Vector2(20, 248); line_l.size = Vector2(280, 90)
	line_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(line_l)
	map_btn = Button.new()
	map_btn.text = "THE MAP"
	map_btn.flat = true
	map_btn.add_theme_font_override("font", serif)
	map_btn.add_theme_font_size_override("font_size", 15)
	map_btn.add_theme_color_override("font_color", Color(INK, 0.8))
	map_btn.position = Vector2(110, 322); map_btn.size = Vector2(100, 30)
	map_btn.pressed.connect(open_map)
	card.add_child(map_btn)
	map_layer = Control.new()
	map_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	map_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	map_layer.visible = false
	host.add_child(map_layer)
	var mdim := ColorRect.new()
	mdim.color = Color(0.03, 0.03, 0.035, 0.7)
	mdim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mdim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	map_layer.add_child(mdim)
	map = MapView.new()
	map.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	map.offset_left = 12; map.offset_right = -12; map.offset_top = 24; map.offset_bottom = -24
	map.mouse_filter = Control.MOUSE_FILTER_IGNORE
	map_layer.add_child(map)
	for k in Hub.SEAL_POS:
		var tr := TextureRect.new()
		tr.texture = load("res://assets/textures/icons/veil_seal.png") if ResourceLoader.exists("res://assets/textures/icons/veil_seal.png") else null
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.size = Vector2(26, 26)
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		map_layer.add_child(tr)
		seal_marks[k] = tr
	map_layer.gui_input.connect(func(e: InputEvent) -> void:
		if (e is InputEventMouseButton and e.pressed) or (e is InputEventScreenTouch and e.pressed): close_map())
	# the toast
	toast = PanelContainer.new()
	var tsb := StyleBoxFlat.new()
	tsb.bg_color = Color(CREAM, 0.92)
	tsb.set_corner_radius_all(5)
	tsb.content_margin_left = 10; tsb.content_margin_right = 14; tsb.content_margin_top = 6; tsb.content_margin_bottom = 6
	toast.add_theme_stylebox_override("panel", tsb)
	toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toast.modulate.a = 0.0
	host.add_child(toast)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 10)
	hb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toast.add_child(hb)
	toast_icon = TextureRect.new()
	toast_icon.custom_minimum_size = Vector2(48, 48)
	toast_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	toast_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	hb.add_child(toast_icon)
	var vb := VBoxContainer.new()
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.custom_minimum_size = Vector2(220, 0)
	hb.add_child(vb)
	toast_name = _label(serif, 16, INK)
	vb.add_child(toast_name)
	toast_line = _label(italic, 13, Color(INK, 0.75))
	toast_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vb.add_child(toast_line)

func _label(f: Font, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", f)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.horizontal_alignment = align
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

## what the satchel holds now: [key, count] in the satchel's order
func contents() -> Array:
	var out := []
	var inv: Dictionary = game.chapter.state["inv"]
	for k in Items.ORDER:
		match k:
			"tablet": if (inv["tablets"] as Array).size() > 0: out.append([k, (inv["tablets"] as Array).size()])
			"mem": if (inv["mem"] as Array).size() > 0: out.append([k, (inv["mem"] as Array).size()])
			"seal":
				var n := (inv["seals"] as Array).size() - (inv["socketed"] as Array).size()
				if n > 0: out.append([k, n])
			_: if k in (inv["items"] as Array): out.append([k, 1])
	return out

func open() -> void:
	is_open = true
	visible = true
	for c in grid.get_children(): c.queue_free()
	slots.clear()
	var have := contents()
	for e in have:
		var k: String = e[0]
		var b := Button.new()
		b.custom_minimum_size = Vector2(SLOT, SLOT)
		b.flat = false
		var bsb := StyleBoxFlat.new()
		bsb.bg_color = Color(INK, 0.06)
		bsb.set_corner_radius_all(32)
		b.add_theme_stylebox_override("normal", bsb)
		b.add_theme_stylebox_override("hover", bsb)
		var psb := bsb.duplicate() as StyleBoxFlat
		psb.bg_color = Color(Palette.CORE, 0.25)
		b.add_theme_stylebox_override("pressed", psb)
		b.add_theme_stylebox_override("focus", psb)
		if game.chapter.items.icons.has(k):
			b.icon = game.chapter.items.icons[k]
			b.expand_icon = true
			b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		if int(e[1]) > 1 or k in ["tablet", "mem", "seal"]:
			b.text = str(e[1])
			b.add_theme_font_override("font", serif)
			b.add_theme_font_size_override("font_size", 13)
			b.add_theme_color_override("font_color", INK)
			b.alignment = HORIZONTAL_ALIGNMENT_RIGHT
			b.vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
		var kk := k
		b.pressed.connect(func() -> void: select(kk))
		grid.add_child(b)
		slots.append([k, b])
	if have.is_empty():
		name_l.text = ""
		line_l.text = "Empty."
	else:
		select(sel if _has_slot(sel) else String(have[0][0]))
	game.controls.enabled = false
	game.sfx.play("glass_tink", -22.0, 0.8)

func _has_slot(k: String) -> bool:
	for s in slots: if s[0] == k: return true
	return false

func select(k: String) -> void:
	sel = k
	name_l.text = Items.NAME.get(k, k)
	line_l.text = describe(k)

func describe(k: String) -> String:
	var inv: Dictionary = game.chapter.state["inv"]
	match k:
		"amphora": return Items.LINE["amphora_full" if inv["amph_full"] else "amphora"]
		"tablet":
			var t: Array = inv["tablets"]
			var last: String = t[t.size() - 1]
			for e in Items.TABLETS: if e[0] == last: return "%d of 8. The last: \"%s\"" % [t.size(), e[2]]
		"mem": return Items.LINE["mem"] + " %d of 7." % (inv["mem"] as Array).size()
	return Items.LINE.get(k, "")

func close() -> void:
	is_open = false
	visible = false
	game.controls.enabled = game.mode == "play"
	game.controls.block(250)

func _gui_input(e: InputEvent) -> void:
	# a tap outside the card closes it
	if (e is InputEventMouseButton and e.pressed) or (e is InputEventScreenTouch and e.pressed):
		var p: Vector2 = e.position
		if not card.get_global_rect().has_point(p + global_position): close()
		accept_event()

## the map: the regions you have walked, you, and the three seals (faint until taken)
func open_map() -> void:
	if is_open:
		is_open = false
		visible = false
	map_open = true
	map_layer.visible = true
	game.controls.enabled = false
	map.set_player(game.player.position)
	await get_tree().process_frame
	var r := map.get_global_rect()
	var tex := Vector2(1024, 1536)
	var sc := minf(r.size.x / tex.x, r.size.y / tex.y)
	var drawn := tex * sc
	var o := r.position + (r.size - drawn) * 0.5
	var inv: Dictionary = game.chapter.state["inv"]
	for k in seal_marks:
		var tr: TextureRect = seal_marks[k]
		var uv := map.world_to_uv(Hub.SEAL_POS[k])
		tr.position = o + uv * drawn - tr.size * 0.5 - map_layer.global_position
		tr.modulate = Color(1, 1, 1, 1.0 if k in (inv["seals"] as Array) else 0.3)
	game.sfx.play("page", -14.0, 1.0)

func close_map() -> void:
	map_open = false
	map_layer.visible = false
	game.controls.enabled = game.mode == "play"
	game.controls.block(250)

## a walk region seen for the first time (main, from the region you stand in)
func see_region(n: String) -> void:
	var seen: Array = game.chapter.state["hub"]["map"]
	if n in seen: return
	seen.append(n)
	map.reveal_region(n, not map_open)

func load_map() -> void:
	map._k.clear()
	map._target.clear()
	map._lut.fill(Color(0, 0, 0))
	map._lut_tex.update(map._lut)
	map.set_revealed(game.chapter.state["hub"].get("map", []))

func show_item(k: String, extra := "") -> void:
	toast_icon.texture = game.chapter.items.icons.get(k, null)
	toast_name.text = Items.NAME.get(k, k) + (" (full)" if extra == "full" else "")
	toast_line.text = Items.LINE["amphora_full"] if extra == "full" else Items.LINE.get(k, "")
	var vs := get_viewport_rect().size
	toast.reset_size()
	toast.position = Vector2(maxf(80.0, (vs.x - 300.0) * 0.5), 64.0)      # (clear of the shard's and the satchel's slots)
	toast.size = Vector2(300, 0)
	if _toast_tw: _toast_tw.kill()
	_toast_tw = toast.create_tween()
	_toast_tw.tween_property(toast, "modulate:a", 1.0, 0.35)
	_toast_tw.tween_interval(3.2)
	_toast_tw.tween_property(toast, "modulate:a", 0.0, 0.8)
