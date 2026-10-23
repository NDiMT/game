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
var _msgs: Array = []            # [text, colour, time_left]
var _hits: Array = []            # [world_pos, text, age, big]
var top_bar: HBoxContainer
var cam_btn: Button
var wpn_btn: Button
signal cam_pressed
signal weapons_pressed
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
	_build_top_bar()

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

# ------------------------------------------------------------------ top bar (camera / weapons toggles)
func _build_top_bar() -> void:
	top_bar = HBoxContainer.new()
	top_bar.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	top_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	top_bar.offset_top = 8
	top_bar.add_theme_constant_override("separation", 8)
	top_bar.visible = false
	add_child(top_bar)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.04, 0.04, 0.55); sb.set_corner_radius_all(8)
	sb.content_margin_left = 10; sb.content_margin_right = 10; sb.content_margin_top = 4; sb.content_margin_bottom = 4
	sb.border_color = Color(1, 1, 1, 0.25); sb.set_border_width_all(1)
	var sh := sb.duplicate() as StyleBoxFlat; sh.bg_color = Color(0.25, 0.15, 0.08, 0.75)
	for i in 2:
		var b := Button.new()
		b.add_theme_stylebox_override("normal", sb)
		b.add_theme_stylebox_override("hover", sh)
		b.add_theme_stylebox_override("pressed", sh)
		b.add_theme_font_size_override("font_size", 11)
		b.add_theme_color_override("font_color", Color(1, 0.92, 0.8))
		b.add_theme_color_override("font_hover_color", Color(1, 1, 1))
		b.add_theme_color_override("font_pressed_color", Color(1, 1, 1))
		b.focus_mode = Control.FOCUS_NONE
		top_bar.add_child(b)
		if i == 0:
			cam_btn = b
			b.pressed.connect(func() -> void: cam_pressed.emit())
		else:
			wpn_btn = b
			b.pressed.connect(func() -> void: weapons_pressed.emit())
	refresh_top_bar()

func refresh_top_bar() -> void:
	cam_btn.text = "CAM: " + Settings.CAM_LABEL[Settings.cam_mode]
	wpn_btn.text = "WEAPONS: " + Settings.WEAPON_LABEL[Settings.weapon_mode]

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
	for h in _hits: h[2] += dt
	_hits = _hits.filter(func(h: Array) -> bool: return h[2] < 1.4)
	if top_bar: top_bar.visible = show_race
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
	var ws: WeaponSystem = p.weapons
	var cam: Camera3D = game.cam
	var wmode: String = Settings.weapon_mode
	# --- world-anchored markers first (under the panels)
	if cam:
		_draw_rival_tags(cam)
		_draw_lock(cam, ws)
		_draw_hit_markers(cam)
		_draw_incoming(cam, W, H)
	# --- position + lap + time (top-left), speed + armour below it
	_panel(Rect2(10, 8, 168, 70))
	_text(Vector2(20, 58), str(p.place), 48, GOLD if p.place == 1 else Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT, -1, font_it, 6)
	_text(Vector2(52, 58), "/%d" % game.cars.size(), 20, Color(1, 1, 1, 0.8))
	var lap := mini(p.lap, game.LAPS)
	_text(Vector2(92, 32), "LAP", 11, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_LEFT, -1, null, 0)
	_text(Vector2(92, 54), "%d/%d" % [lap, game.LAPS], 22, Color.WHITE)
	_text(Vector2(92, 72), _fmt_time(game.race_time), 12, Color(1, 1, 1, 0.75), HORIZONTAL_ALIGNMENT_LEFT, -1, null, 0)
	var kmh := int(absf(p.speed) * 3.6)
	_text(Vector2(14, 108), str(kmh), 26, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT, -1, font_it, 5)
	_text(Vector2(18 + 15 * str(kmh).length(), 108), "KM/H", 10, Color(1, 1, 1, 0.7))
	var hr := Rect2(14, 116, 130, 6)
	draw_rect(hr, Color(0, 0, 0, 0.45))
	var hpc := Color(0.35, 0.9, 0.4) if p.hp > 50 else (Color(1, 0.75, 0.2) if p.hp > 25 else Color(1, 0.25, 0.2))
	draw_rect(Rect2(hr.position, Vector2(hr.size.x * p.hp / 100.0, hr.size.y)), hpc)
	_text(Vector2(148, 123), "ARMOR", 9, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_LEFT, -1, null, 0)
	# --- minimap + money (top-right)
	var mr := Rect2(W - 182, 8, 172, 112)
	_panel(mr)
	_draw_map(mr.grow(-8))
	_text(Vector2(W - 182, 144), "$%d" % p.money, 22, GOLD, HORIZONTAL_ALIGNMENT_RIGHT, 170)
	# --- nitro bar (bottom centre)
	var nr := Rect2(W * 0.5 - 110, H - 30, 220, 12)
	_panel(nr.grow(4), Color(0, 0, 0, 0.45))
	var ncol := Color(0.35, 0.75, 1.0) if not p.nitro_on else Color(1.0, 0.6, 0.15).lerp(Color(1, 1, 0.6), 0.5 + 0.5 * sin(_t * 30.0))
	draw_rect(Rect2(nr.position, Vector2(nr.size.x * p.nitro, nr.size.y)), ncol)
	_text(Vector2(nr.position.x, nr.position.y - 6), "NITRO", 11, Color(1, 1, 1, 0.8), HORIZONTAL_ALIGNMENT_CENTER, nr.size.x, null, 3)
	# --- ammo + ULT badge next to the pedal (the BUTTONS scheme draws its own skill buttons)
	game.controls.ult_rect = Rect2()
	if wmode != "buttons" and ws:
		var hints := {"tap": ["2x TAP >", "2x TAP <"], "flick": ["FLICK >", "< FLICK"], "auto": ["AUTO", "AUTO"]}
		_ammo(Vector2(W - 152, H - 122), "rocket", ws.ammo("front"), hints[wmode][0], ws.is_locked())
		_ammo(Vector2(W - 152, H - 78), "mine", ws.ammo("rear"), hints[wmode][1], false)
		_ult_badge(Vector2(W - 113, H - 160), ws.ult)
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

func _ammo(at: Vector2, kind: String, n: int, hint: String, glow: bool) -> void:
	if glow and n > 0:
		_panel(Rect2(at, Vector2(78, 36)).grow(2.0 + sin(_t * 14.0)), Color(1, 0.25, 0.1, 0.6))
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
	_text(at + Vector2(-58, 22), hint, 10, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_RIGHT, 54, null, 3)

## ULTIMATE badge next to the pedal (tappable when full; double-tap left / swipe up / E also work)
func _ult_badge(c: Vector2, meter: float) -> void:
	var r := 22.0
	if meter >= 1.0:
		var pulse := 0.5 + 0.5 * sin(_t * 7.0)
		draw_circle(c, r + 8.0 + pulse * 5.0, Color(1.0, 0.6, 0.1, 0.25 + 0.2 * pulse))
		draw_circle(c, r, Color(0.95, 0.55, 0.1, 0.92))
		draw_arc(c, r, 0, TAU, 32, Color(1, 0.95, 0.6), 2.5, true)
		_text(c + Vector2(-r, 5), "ULT", 14, Color(0.15, 0.06, 0.02), HORIZONTAL_ALIGNMENT_CENTER, r * 2, font_it, 0)
		_text(c + Vector2(-40, r + 13), "SWIPE UP / TAP", 9, Color(1, 0.9, 0.6, 0.9), HORIZONTAL_ALIGNMENT_CENTER, 80, null, 3)
		game.controls.ult_rect = Rect2(c - Vector2(r + 8, r + 8), Vector2(2 * r + 16, 2 * r + 16))
	else:
		draw_circle(c, r, Color(0.08, 0.06, 0.05, 0.5))
		draw_arc(c, r - 2.0, -PI / 2, -PI / 2 + TAU * meter, 32, Color(1, 0.8, 0.3, 0.85), 3.0, true)
		_text(c + Vector2(-r, 4), "ULT", 11, Color(1, 1, 1, 0.45), HORIZONTAL_ALIGNMENT_CENTER, r * 2, null, 0)

func _screen(cam: Camera3D, wp: Vector3) -> Vector2:
	return cam.unproject_position(wp)

func _draw_lock(cam: Camera3D, ws: WeaponSystem) -> void:
	if ws == null or ws.lock_target == null or ws.lock_progress <= 0.0 or game.state != "race": return
	var wp := ws.lock_target.global_position + Vector3.UP * 1.1
	if cam.is_position_behind(wp): return
	var c := _screen(cam, wp)
	var locked := ws.is_locked()
	var view := Rect2(Vector2(24, 24), size - Vector2(48, 48))
	if not view.has_point(c):
		# target beyond the view (long ISO look-ahead): orange/red arrow at the edge with the fill arc
		var ctr := size * 0.5
		var d := (c - ctr).normalized()
		var k := minf((size.x * 0.5 - 40) / maxf(absf(d.x), 0.001), (size.y * 0.5 - 40) / maxf(absf(d.y), 0.001))
		var e := ctr + d * k
		var n := Vector2(-d.y, d.x)
		var colx := Color(1, 0.6, 0.15) if not locked else Color(1, 0.2, 0.12)
		draw_colored_polygon(PackedVector2Array([e + d * 16, e - d * 4 + n * 11, e - d * 4 - n * 11]), colx)
		draw_arc(e - d * 22, 11, -PI / 2, -PI / 2 + TAU * ws.lock_progress, 24, colx, 3.0, true)
		if locked: _text(e - d * 22 + Vector2(-30, -16), "LOCKED", 10, colx, HORIZONTAL_ALIGNMENT_CENTER, 60, null, 3)
		return
	var r := 26.0 if not locked else 24.0 + 2.0 * sin(_t * 16.0)
	draw_arc(c, r, 0, TAU, 40, Color(0, 0, 0, 0.45), 6.0, true)
	var col := Color(1, 0.6, 0.15, 0.95) if not locked else Color(1, 0.2, 0.12, 1)
	draw_arc(c, r, -PI / 2, -PI / 2 + TAU * ws.lock_progress, 40, col, 4.0, true)
	for k in 4:
		var d := Vector2.from_angle(k * PI * 0.5 + (_t * 2.5 if locked else 0.0))
		draw_line(c + d * (r + 4), c + d * (r + 11), col, 3.0, true)
	if locked:
		var pip := Rect2(c + Vector2(-30, -r - 26), Vector2(60, 17))
		_panel(pip, Color(0.85, 0.12, 0.08, 0.9))
		_text(pip.position + Vector2(0, 13), "LOCKED", 11, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, 60, null, 0)

func _draw_rival_tags(cam: Camera3D) -> void:
	if Settings.cam_mode == "chase": return
	for c: Car in game.cars:
		if c == game.player or not c.alive: continue
		var wp := c.global_position + Vector3.UP * 3.4
		if cam.is_position_behind(wp): continue
		var q := _screen(cam, wp)
		var tint: Color = CarPaint.TINT.get(c.colour, Color.WHITE)
		draw_colored_polygon(PackedVector2Array([q + Vector2(-7, -6), q + Vector2(7, -6), q + Vector2(0, 3)]), tint)
		draw_polyline(PackedVector2Array([q + Vector2(-7, -6), q + Vector2(7, -6), q + Vector2(0, 3), q + Vector2(-7, -6)]), Color(0, 0, 0, 0.7), 1.5, true)
		_text(q + Vector2(-50, -10), "%d %s" % [c.place, c.driver_name], 11, tint, HORIZONTAL_ALIGNMENT_CENTER, 100, null, 3)

## hit marker + "+$" floating at the target
func hit_marker(wp: Vector3, text: String, big := false) -> void:
	_hits.append([wp, text, 0.0, big])

func _draw_hit_markers(cam: Camera3D) -> void:
	for h in _hits:
		var wp: Vector3 = h[0]
		if cam.is_position_behind(wp): continue
		var c := _screen(cam, wp + Vector3.UP * 1.5)
		var age: float = h[2]
		if age < 0.35:
			var s := 10.0 + age * 20.0
			var col := Color(1, 1, 1, 1.0 - age / 0.35)
			for d: Vector2 in [Vector2(1, 1), Vector2(-1, 1)]:
				draw_line(c - d * s, c - d * (s * 0.4), col, 3.0, true)
				draw_line(c + d * s * 0.4, c + d * s, col, 3.0, true)
		var a := clampf(1.4 - age, 0.0, 1.0)
		_text(c + Vector2(-60, -24 - age * 40.0), h[1], 26 if h[3] else 20, Color(GOLD.r, GOLD.g, GOLD.b, a), HORIZONTAL_ALIGNMENT_CENTER, 120, font_it, 5)

## red arrows at the screen edge for rockets homing on the player
func _draw_incoming(cam: Camera3D, W: float, H: float) -> void:
	for r: Rocket in game.rockets:
		if r.target != game.player or r._dead: continue
		var wp := r.global_position
		var behind := cam.is_position_behind(wp)
		var q := _screen(cam, wp)
		var ctr := Vector2(W, H) * 0.5
		var pulse := 0.6 + 0.4 * sin(_t * 20.0)
		var col := Color(1, 0.15, 0.1, pulse)
		var on_screen := not behind and Rect2(20, 20, W - 40, H - 40).has_point(q)
		if on_screen:
			draw_arc(q, 16, 0, TAU, 24, col, 3.0, true)
			continue
		var d := (q - ctr) * (-1.0 if behind else 1.0)
		if d.length() < 1.0: d = Vector2(0, 1)
		d = d.normalized()
		var k := minf((W * 0.5 - 34) / maxf(absf(d.x), 0.001), (H * 0.5 - 34) / maxf(absf(d.y), 0.001))
		var e := ctr + d * k
		var n := Vector2(-d.y, d.x)
		draw_colored_polygon(PackedVector2Array([e + d * 18, e - d * 6 + n * 14, e - d * 6 - n * 14]), col)
		_text(e - d * 22 + Vector2(-20, 6), "!", 20, col, HORIZONTAL_ALIGNMENT_CENTER, 40, font_it, 4)

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
