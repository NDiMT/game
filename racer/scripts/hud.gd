class_name Hud
extends Control
## Race HUD (custom-drawn: cheap, crisp at any scale) + title and finish screens.

signal race_pressed
signal restart_pressed

var game: Node
var font: FontVariation
var font_it: FontVariation
var show_race := false
var countdown_text := ""
var countdown_t := 0.0
var reticle_pos := Vector2.ZERO
var reticle_on := false
var _msgs: Array = []            # [text, colour, time_left]
var _map_pts := PackedVector2Array()
var _map_rect := Rect2()
var _map_xf := Transform2D()
var _t := 0.0
var title_root: Control
var finish_root: Control
var _finish_box: VBoxContainer

const GOLD := Color(1.0, 0.78, 0.2)
const ORANGE := Color(1.0, 0.52, 0.12)
const PANEL := Color(0.05, 0.04, 0.04, 0.5)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	font = FontVariation.new()
	font.base_font = ThemeDB.fallback_font
	font.variation_embolden = 0.9
	font_it = FontVariation.new()
	font_it.base_font = ThemeDB.fallback_font
	font_it.variation_embolden = 1.1
	font_it.variation_transform = Transform2D(Vector2(1, 0), Vector2(-0.22, 1), Vector2.ZERO)
	var th := Theme.new()
	th.default_font = font
	th.default_font_size = 16
	var bs := StyleBoxFlat.new()
	bs.bg_color = ORANGE; bs.set_corner_radius_all(12)
	bs.content_margin_left = 34; bs.content_margin_right = 34; bs.content_margin_top = 10; bs.content_margin_bottom = 10
	bs.shadow_color = Color(0, 0, 0, 0.4); bs.shadow_size = 6; bs.shadow_offset = Vector2(0, 3)
	var bh := bs.duplicate() as StyleBoxFlat; bh.bg_color = Color(1.0, 0.64, 0.25)
	var bp := bs.duplicate() as StyleBoxFlat; bp.bg_color = Color(0.85, 0.4, 0.08)
	th.set_stylebox("normal", "Button", bs)
	th.set_stylebox("hover", "Button", bh)
	th.set_stylebox("pressed", "Button", bp)
	th.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	th.set_color("font_color", "Button", Color(0.1, 0.05, 0.02))
	th.set_color("font_hover_color", "Button", Color(0.1, 0.05, 0.02))
	th.set_color("font_pressed_color", "Button", Color(0.1, 0.05, 0.02))
	th.set_font_size("font_size", "Button", 24)
	theme = th
	_build_title()
	_build_finish()

# ------------------------------------------------------------------ title
func _label(text: String, size_: int, col: Color, f: Font = null, outline := 0) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size_)
	l.add_theme_color_override("font_color", col)
	if f: l.add_theme_font_override("font", f)
	if outline > 0:
		l.add_theme_constant_override("outline_size", outline)
		l.add_theme_color_override("font_outline_color", Color(0.12, 0.04, 0.02))
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.45))
	l.add_theme_constant_override("shadow_offset_y", 3)
	return l

func _build_title() -> void:
	title_root = Control.new()
	title_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	title_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(title_root)
	var shade := TextureRect.new()
	var g := Gradient.new()
	g.set_color(0, Color(0.08, 0.03, 0.02, 0.82)); g.set_color(1, Color(0.08, 0.03, 0.02, 0.0))
	var gt := GradientTexture2D.new(); gt.gradient = g; gt.fill_from = Vector2(0.15, 0); gt.fill_to = Vector2(0.7, 0)
	shade.texture = gt
	shade.stretch_mode = TextureRect.STRETCH_SCALE
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title_root.add_child(shade)
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	box.offset_left = 36
	box.offset_right = 520
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", -16)
	title_root.add_child(box)
	box.add_child(_label("SCRAP", 76, GOLD, font_it, 14))
	box.add_child(_label("RALLY", 76, Color(0.97, 0.94, 0.9), font_it, 14))
	var sub := _label("COMBAT RACING  ·  DESERT TEST TRACK", 15, Color(1, 0.85, 0.7))
	box.add_child(sub)
	var sp := Control.new(); sp.custom_minimum_size = Vector2(0, 26); box.add_child(sp)
	var btn := Button.new()
	btn.text = "RACE"
	btn.add_theme_font_override("font", font_it)
	btn.add_theme_font_size_override("font_size", 30)
	btn.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	btn.pressed.connect(func() -> void: race_pressed.emit())
	box.add_child(btn)
	var sp2 := Control.new(); sp2.custom_minimum_size = Vector2(0, 26); box.add_child(sp2)
	var hint := _label("LEFT THUMB steer  ·  RIGHT THUMB pedal: hold GAS, slide up NITRO, down BRAKE\nFLICK right = ROCKET  ·  FLICK left = MINE      Keys: WASD · Shift · J / K", 11, Color(1, 1, 1, 0.75))
	box.add_child(hint)

# ------------------------------------------------------------------ finish
func _build_finish() -> void:
	finish_root = Control.new()
	finish_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	finish_root.visible = false
	add_child(finish_root)
	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.02, 0.01, 0.55)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	finish_root.add_child(dim)
	var panel := PanelContainer.new()
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color(0.1, 0.07, 0.06, 0.92); ps.set_corner_radius_all(16)
	ps.border_color = ORANGE; ps.set_border_width_all(2)
	ps.content_margin_left = 26; ps.content_margin_right = 26; ps.content_margin_top = 14; ps.content_margin_bottom = 16
	panel.add_theme_stylebox_override("panel", ps)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	finish_root.add_child(panel)
	_finish_box = VBoxContainer.new()
	_finish_box.add_theme_constant_override("separation", 4)
	panel.add_child(_finish_box)

func show_finish(rows: Array, player_place: int, earned: Dictionary) -> void:
	for c in _finish_box.get_children(): c.queue_free()
	var ord := ["1ST", "2ND", "3RD", "4TH"]
	var head := _label("YOU FINISHED " + ord[player_place - 1], 34, GOLD if player_place == 1 else Color(1, 0.9, 0.8), font_it, 10)
	head.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_finish_box.add_child(head)
	var grid := GridContainer.new()
	grid.columns = 5
	grid.add_theme_constant_override("h_separation", 22)
	grid.add_theme_constant_override("v_separation", 2)
	for h in ["POS", "DRIVER", "TIME", "WRECKS", "MONEY"]:
		grid.add_child(_label(h, 11, Color(1, 1, 1, 0.55)))
	for r in rows:
		var col: Color = r.tint if not r.player else GOLD
		grid.add_child(_label(str(r.place), 17, col))
		grid.add_child(_label(r.name, 17, col))
		grid.add_child(_label(r.time, 17, Color(1, 1, 1, 0.9)))
		grid.add_child(_label(str(r.kills), 17, Color(1, 1, 1, 0.9)))
		grid.add_child(_label("$%d" % r.money, 17, GOLD))
	_finish_box.add_child(grid)
	var sep := HSeparator.new(); _finish_box.add_child(sep)
	var br := _label("EARNED  $%d   =   place $%d  +  pickups $%d  +  wrecks $%d" % [earned.total, earned.place, earned.pickups, earned.kills], 14, Color(1, 0.9, 0.75))
	br.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_finish_box.add_child(br)
	var sp := Control.new(); sp.custom_minimum_size = Vector2(0, 6); _finish_box.add_child(sp)
	var btn := Button.new()
	btn.text = "RESTART"
	btn.add_theme_font_override("font", font_it)
	btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	btn.pressed.connect(func() -> void: restart_pressed.emit())
	_finish_box.add_child(btn)
	finish_root.visible = true
	finish_root.modulate.a = 0.0
	create_tween().tween_property(finish_root, "modulate:a", 1.0, 0.4)

# ------------------------------------------------------------------ messages / minimap
func flash(text: String, col := Color.WHITE, dur := 1.6) -> void:
	_msgs.append([text, col, dur, dur])
	if _msgs.size() > 3: _msgs.pop_front()

func set_map(points: PackedVector2Array) -> void:
	_map_pts = points

func _process(dt: float) -> void:
	_t += dt
	countdown_t += dt
	for m in _msgs: m[2] -= dt
	_msgs = _msgs.filter(func(m: Array) -> bool: return m[2] > 0.0)
	queue_redraw()

func _text(p: Vector2, s: String, sz: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, w := -1.0, f: Font = null, outline := 4) -> void:
	var ff: Font = f if f else font
	if outline > 0:
		draw_string_outline(ff, p, s, align, w, sz, outline, Color(0.08, 0.03, 0.02, 0.85 * col.a))
	draw_string(ff, p, s, align, w, sz, col)

func _panel(r: Rect2, col := PANEL) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = col
	sb.set_corner_radius_all(10)
	draw_style_box(sb, r)

func _draw() -> void:
	if not show_race or game == null: return
	var W := size.x; var H := size.y
	var p: Car = game.player
	if p == null: return
	# --- position + lap + time (top-left)
	_panel(Rect2(10, 8, 168, 70))
	_text(Vector2(20, 58), str(p.place), 48, GOLD if p.place == 1 else Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT, -1, font_it, 6)
	_text(Vector2(52, 58), "/%d" % game.cars.size(), 20, Color(1, 1, 1, 0.8))
	var lap := mini(p.lap, game.LAPS)
	_text(Vector2(92, 32), "LAP", 11, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_LEFT, -1, null, 0)
	_text(Vector2(92, 54), "%d/%d" % [lap, game.LAPS], 22, Color.WHITE)
	_text(Vector2(92, 72), _fmt_time(game.race_time), 12, Color(1, 1, 1, 0.75), HORIZONTAL_ALIGNMENT_LEFT, -1, null, 0)
	# --- minimap + money (top-right)
	var mr := Rect2(W - 182, 8, 172, 112)
	_panel(mr)
	_draw_map(mr.grow(-8))
	_text(Vector2(W - 182, 144), "$%d" % p.money, 22, GOLD, HORIZONTAL_ALIGNMENT_RIGHT, 170)
	# --- speed + armour (bottom-left, above the steering slider)
	var kmh := int(absf(p.speed) * 3.6)
	_text(Vector2(22, H - 96), str(kmh), 34, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT, -1, font_it, 5)
	_text(Vector2(22 + 18 * str(kmh).length() + 8, H - 96), "KM/H", 11, Color(1, 1, 1, 0.7))
	var hr := Rect2(22, H - 86, 150, 7)
	draw_rect(hr, Color(0, 0, 0, 0.45))
	var hpc := Color(0.35, 0.9, 0.4) if p.hp > 50 else (Color(1, 0.75, 0.2) if p.hp > 25 else Color(1, 0.25, 0.2))
	draw_rect(Rect2(hr.position, Vector2(hr.size.x * p.hp / 100.0, hr.size.y)), hpc)
	_text(Vector2(176, H - 79), "ARMOR", 9, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_LEFT, -1, null, 0)
	# --- nitro bar (bottom centre)
	var nr := Rect2(W * 0.5 - 120, H - 30, 240, 12)
	_panel(nr.grow(4), Color(0, 0, 0, 0.45))
	var ncol := Color(0.35, 0.75, 1.0) if not p.nitro_on else Color(1.0, 0.6, 0.15).lerp(Color(1, 1, 0.6), 0.5 + 0.5 * sin(_t * 30.0))
	draw_rect(Rect2(nr.position, Vector2(nr.size.x * p.nitro, nr.size.y)), ncol)
	_text(Vector2(nr.position.x, nr.position.y - 6), "NITRO", 11, Color(1, 1, 1, 0.8), HORIZONTAL_ALIGNMENT_CENTER, nr.size.x, null, 3)
	# --- ammo (left of the pedal)
	_ammo(Vector2(W - 152, H - 122), "rocket", p.rockets, "FLICK >")
	_ammo(Vector2(W - 152, H - 78), "mine", p.mines, "< FLICK")
	# --- lock-on reticle
	if reticle_on:
		var c := reticle_pos
		var s := 24.0 + 4.0 * sin(_t * 12.0)
		var rc := Color(1, 0.25, 0.15, 0.95)
		for k in 4:
			var a := k * PI * 0.5 + _t * 2.0
			var d := Vector2(cos(a), sin(a))
			var e := Vector2(-d.y, d.x)
			var corner := c + (d + e) * s * 0.7
			draw_line(corner, corner - d * 10, rc, 3.0, true)
			draw_line(corner, corner - e * 10, rc, 3.0, true)
		draw_circle(c, 3, rc)
		_text(c + Vector2(-30, s + 18), "LOCK", 11, rc, HORIZONTAL_ALIGNMENT_CENTER, 60, null, 3)
	# --- countdown + messages (centre)
	if countdown_text != "":
		var k := clampf(countdown_t * 3.0, 0.0, 1.0)
		var sz := int(lerpf(140.0, 96.0, k))
		var col := GOLD if countdown_text != "GO!" else Color(0.4, 1.0, 0.5)
		col.a = 1.0 - clampf((countdown_t - 0.7) * 3.0, 0.0, 1.0)
		_text(Vector2(0, H * 0.45 + sz * 0.35), countdown_text, sz, col, HORIZONTAL_ALIGNMENT_CENTER, W, font_it, 12)
	var y := H * 0.3
	for m in _msgs:
		var col: Color = m[1]
		col.a = clampf(m[2] / 0.4, 0.0, 1.0)
		_text(Vector2(0, y), m[0], 26, col, HORIZONTAL_ALIGNMENT_CENTER, W, font_it, 6)
		y += 32

func _ammo(at: Vector2, kind: String, n: int, hint: String) -> void:
	_panel(Rect2(at, Vector2(78, 36)))
	var ic := at + Vector2(18, 18)
	var col := Color(1, 1, 1, 0.95 if n > 0 else 0.35)
	if kind == "rocket":
		draw_rect(Rect2(ic - Vector2(10, 3), Vector2(16, 6)), col)
		draw_colored_polygon(PackedVector2Array([ic + Vector2(6, -4), ic + Vector2(6, 4), ic + Vector2(12, 0)]), Color(1, 0.4, 0.2, col.a))
		draw_colored_polygon(PackedVector2Array([ic + Vector2(-10, -3), ic + Vector2(-14, -7), ic + Vector2(-6, -3)]), col)
		draw_colored_polygon(PackedVector2Array([ic + Vector2(-10, 3), ic + Vector2(-14, 7), ic + Vector2(-6, 3)]), col)
	else:
		draw_circle(ic, 9, Color(0.3, 0.3, 0.32, col.a))
		draw_arc(ic, 9, 0, TAU, 16, Color(1, 0.75, 0.1, col.a), 2.0)
		draw_circle(ic, 3, Color(1, 0.15, 0.1, col.a))
	_text(at + Vector2(34, 25), "x%d" % n, 18, col)
	_text(at + Vector2(-50, 22), hint, 10, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_RIGHT, 46, null, 3)

func _draw_map(r: Rect2) -> void:
	if _map_pts.is_empty(): return
	if _map_rect != r:
		_map_rect = r
		var mn := _map_pts[0]; var mx := _map_pts[0]
		for q in _map_pts: mn = mn.min(q); mx = mx.max(q)
		var s := minf(r.size.x / (mx.x - mn.x), r.size.y / (mx.y - mn.y))
		var off := r.position + (r.size - (mx - mn) * s) * 0.5
		# standard top-down view: world x -> map x, world z -> map y
		_map_xf = Transform2D(Vector2(s, 0), Vector2(0, s), off - mn * s)
	var pts := PackedVector2Array()
	for q in _map_pts: pts.append(_map_xf * q)
	pts.append(pts[0])
	draw_polyline(pts, Color(0, 0, 0, 0.55), 6.0, true)
	draw_polyline(pts, Color(1, 0.9, 0.8, 0.85), 2.5, true)
	draw_circle(pts[0], 3.5, Color.WHITE)
	for c: Car in game.cars:
		var q: Vector2 = _map_xf * Vector2(c.global_position.x, c.global_position.z)
		var tint: Color = CarPaint.TINT.get(c.colour, Color.WHITE)
		if c.is_player:
			draw_circle(q, 6.0, Color.BLACK)
			draw_circle(q, 4.5, GOLD)
		else:
			draw_circle(q, 4.5, Color.BLACK)
			draw_circle(q, 3.2, tint if c.alive else Color(0.4, 0.4, 0.4))

static func _fmt_time(t: float) -> String:
	var m := int(t / 60.0)
	var s := t - m * 60
	return "%d:%04.1f" % [m, s]
