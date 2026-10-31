class_name Points
extends Node3D
## v1.1 (dev/V1_WORLD.md 8): the in-between points. Places between the puzzles with something to see or do
## that is not a puzzle: a bell to ring, a votive to light, an offering, a coin for the dry fountain, Theron's
## cot, a bench with a view, a carved relief to walk along. Each is optional, each says one thing once.
## State: chapter.state["hub"]["points"] (the ones done).

var game: Game
var chapter: Chapter
var votive: Flame
var votives := {}                    # id -> its Flame (the votives: the Hall's, and the landing above Our Steps)
var bell: Node3D
var _relief_said := {}
var _bench_t := 0.0
var _bench_to := Vector3.ZERO
var lean := Vector3.ZERO
# (QA_V11 P1: every point shows a change in the world, not only a line of text)
var coin: Node3D                     # the coin, in the dry basin once thrown
var offer_flame: Flame               # the offering's little flame, lit by your touch
var blanket: Node3D                  # the cot's folded cloth (it shifts), and the wax tablet it hid
var tablet: Node3D
var cot_flame: Flame                 # the lamp by the cot: it gutters when you sit by it
var _cot_flick := 0.0
var relief_mats: Array[ShaderMaterial] = []
var _relief_glow := [0.0, 0.0, 0.0]
var _relief_sweep := -1.0
const FOUNTAIN := Vector3(5.0, 0.5, 16.0)          # (Props kit_fountain)

## [id, where, kind, icon, line]
const POINTS := [
	["bell", Vector3(-12.45, 0.0, 1.3), "bell", "ring", "Its note went out over the water and came back from very far."],
	["votive", Vector3(-10.45, 1.0, -12.0), "votive", "light", "A small flame, for her. Someone kept lighting these."],
	["offering", Vector3(6.6, 1.0, -18.1), "offering", "touch", "Grapes turned to stone, a comb, a hair ribbon. Gifts no one took."],
	["coin", Vector3(5.0, 0.5, 14.25), "coin", "touch", "The coin rang on the dry stone. Once, here, it would have splashed."],
	["cot", Vector3(19.6, 0.5, 10.6), "cot", "read", "His cot, under the floor of his workshop. He slept beside her faces."],
	["bench", Vector3(26.85, 2.0, -4.5), "bench", "wait", "From here the drowned head looks up at the sky, as if listening."],
	# (QA_V11 pacing: a pause between Our Steps and the Court, on the landing at the ramp's head)
	# (QA_V11 pacing: the East wing's long Balcony walk gets a stop in its first third, a seat facing up the shore)
	["lookout", Vector3(29.05, 2.0, 4.0), "bench", "wait", "Far up the shore, under its dome, a light keeps watch. The way runs there."],
	["votive_n", Vector3(19.1, 2.0, -18.08), "votive", "light", "Another of her small flames. Below, the glass keeps the floor you crossed together."],
]
## the relief along the Echo Corridor's north wall: its panels speak as you walk past
const RELIEF := [
	[Vector3(15.6, 2.0, -46.3), "A sculptor on Milos, and a girl who would not stand still."],
	[Vector3(17.2, 2.0, -46.3), "He made her in marble. Then in glass, so she could see herself."],
	[Vector3(20.6, 2.0, -46.3), "The glass kept her. He has been keeping the glass ever since."]]

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	for p in POINTS: _build(p)
	for i in RELIEF.size():
		var r: Array = RELIEF[i]
		relief_mats.append(game.puzzles.rune_quad(self, (r[0] as Vector3) + Vector3(0, 1.3, 0.04), Vector2(1.1, 0.7), Basis(), float(4 + i), 0.18))

func hs() -> Dictionary: return chapter.state["hub"]
func done(id: String) -> bool: return id in (hs().get("points", []) as Array)

func _build(p: Array) -> void:
	var id: String = p[0]
	var at: Vector3 = p[1]
	var kind: String = p[2]
	var m := MB.new()
	var c := Color(0.5, 0.25, 0.0)
	match kind:
		"bell":
			m.cyl(at + Vector3(0, 1.1, 0), 0.06, 0.08, 2.2, Color(0.5, 1.0, 0.0), 8)
			m.box(at + Vector3(0.25, 2.18, 0), Vector3(0.6, 0.06, 0.06), Color(0.5, 1.0, 0.0))
			bell = Node3D.new()
			bell.position = at + Vector3(0.45, 2.12, 0)
			add_child(bell)
			var bm := MB.new()
			bm.cyl(Vector3(0, -0.2, 0), 0.07, 0.17, 0.3, Color(0.5, WorldGeo.BRONZE, 0.0), 14)
			game.puzzles.marble_instance(bm.commit(), bell)
			game.level.ob_circle(Vector2(at.x, at.z), 0.14)
		"votive":
			m.cyl(at + Vector3(0, 0.45, 0), 0.12, 0.16, 0.9, c, 10)
			m.cyl(at + Vector3(0, 0.93, 0), 0.16, 0.12, 0.06, Color(0.5, WorldGeo.BRONZE, 0.0), 12)
			var vf := Flame.new(0.0, 0.14, Palette.FIRE_LIGHT, game.level.noise_tex)
			vf.position = at + Vector3(0, 0.97, 0)
			vf.bounce = false
			add_child(vf)
			votives[id] = vf
			if id == "votive": votive = vf
			game.level.ob_circle(Vector2(at.x, at.z), 0.2)
		"offering":
			m.cyl(at + Vector3(0, 0.12, 0), 0.24, 0.28, 0.24, c, 12)
			m.sphere(at + Vector3(-0.06, 0.29, 0.02), Vector3(0.06, 0.05, 0.06), c, 6, 4)
			m.sphere(at + Vector3(0.07, 0.28, -0.03), Vector3(0.05, 0.04, 0.05), c, 6, 4)
			m.cyl(at + Vector3(-0.1, 0.255, -0.12), 0.065, 0.05, 0.03, Color(0.5, WorldGeo.BRONZE, 0.0), 10)     # (a little oil dish)
			offer_flame = Flame.new(0.0, 0.07, Palette.FIRE_LIGHT, game.level.noise_tex)
			offer_flame.position = at + Vector3(-0.1, 0.28, -0.12)
			offer_flame.bounce = false
			add_child(offer_flame)
			game.level.ob_circle(Vector2(at.x, at.z), 0.3)
		"cot":
			m.box(at + Vector3(0, 0.18, 0), Vector3(1.8, 0.12, 0.7), Color(0.5, WorldGeo.WOOD, 0.0))
			for dx in [-0.8, 0.8]:
				for dz in [-0.28, 0.28]: m.box(at + Vector3(dx, 0.06, dz), Vector3(0.08, 0.12, 0.08), Color(0.5, WorldGeo.WOOD, 0.0))
			blanket = Node3D.new()
			blanket.position = at + Vector3(0.1, 0.27, 0)
			add_child(blanket)
			var bm2 := MB.new()
			bm2.box(Vector3.ZERO, Vector3(1.5, 0.06, 0.6), Color(0.5, 0.25, 0.0))      # (a folded cloth)
			game.puzzles.marble_instance(bm2.commit(), blanket)
			tablet = Node3D.new()
			tablet.position = at + Vector3(0.45, 0.245, 0.05)                         # (under the cloth's foot end)
			add_child(tablet)
			var tm := MB.new()
			tm.box(Vector3.ZERO, Vector3(0.26, 0.012, 0.18), Color(0.5, WorldGeo.WOOD, 0.0))
			tm.box(Vector3(0, 0.008, 0), Vector3(0.22, 0.006, 0.14), Color(0.5, 0.55, 0.0))   # (the wax)
			game.puzzles.marble_instance(tm.commit(), tablet)
			tablet.visible = false
			m.cyl(at + Vector3(1.1, 0.25, -0.3), 0.07, 0.09, 0.5, c, 10)                     # (a lamp stand at its head)
			cot_flame = Flame.new(0.0, 0.08, Palette.FIRE_LIGHT, game.level.noise_tex)
			cot_flame.position = at + Vector3(1.1, 0.53, -0.3)
			cot_flame.bounce = false
			add_child(cot_flame)
			m.box(at + Vector3(-0.75, 0.3, 0), Vector3(0.25, 0.08, 0.4), Color(0.5, 0.25, 0.0))     # (a stone pillow)
			game.level.ob_rect(Level.R(at.x - 0.95, at.z - 0.4, at.x + 1.2, at.z + 0.4))
		"coin":
			coin = Node3D.new()
			add_child(coin)
			var cm := MB.new()
			cm.cyl(Vector3.ZERO, 0.045, 0.045, 0.01, Color(0.5, WorldGeo.BRONZE, 0.0), 14)
			game.puzzles.marble_instance(cm.commit(), coin)
			coin.visible = false
		"bench":
			m.box(at + Vector3(0, 0.22, 0), Vector3(0.45, 0.08, 1.4), c)
			for dz in [-0.55, 0.55]: m.box(at + Vector3(0, 0.09, dz), Vector3(0.36, 0.18, 0.14), c)
			game.level.ob_rect(Level.R(at.x - 0.25, at.z - 0.72, at.x + 0.25, at.z + 0.72))
	if kind != "coin": game.puzzles.marble_instance(m.commit(), self)
	var line: String = p[4]
	game.level.add_interact("pt_" + id, at + (Vector3(-0.6, 0, 0) if id == "lookout" else _approach(kind)), p[3], func() -> void: _use(id, kind, line), 1.5 if kind == "coin" else 0.9,
		func() -> bool: return kind == "bell" or kind == "bench" or not done(id))

func _approach(kind: String) -> Vector3:
	match kind:
		"bell": return Vector3(0.7, 0, -0.45)
		"votive": return Vector3(-0.45, 0, 0.3)
		"offering": return Vector3(0.0, 0, 0.55)
		"coin": return Vector3(-1.25, 0, 1.25)          # (at the rim, on your side)
		"cot": return Vector3(0.0, 0, 0.75)
		"bench": return Vector3(0.6, 0, 0.0)
	return Vector3.ZERO

func _use(id: String, kind: String, line: String) -> void:
	var first := not done(id)
	if first: (hs()["points"] as Array).append(id)
	chapter.event.emit("point", id)
	match kind:
		"bell":
			game.sfx.play("bell", -12.0, 0.8)
			get_tree().create_timer(2.2).timeout.connect(func() -> void: game.sfx.play("bell", -28.0, 0.62))     # (the far bells answer)
			var tw := bell.create_tween()
			tw.tween_property(bell, "rotation:z", 0.35, 0.18)
			tw.tween_property(bell, "rotation:z", -0.25, 0.3)
			tw.tween_property(bell, "rotation:z", 0.0, 0.9).set_trans(Tween.TRANS_ELASTIC)
		"votive":
			game.sfx.play("whoosh", -20.0, 1.4)
		"coin":
			_throw_coin()
		"offering":
			# a small flame takes in the oil dish; a few petals settle on the stone
			game.sfx.play("whoosh", -22.0, 1.6)
			game.sfx.play("chime", -22.0, 1.2)
			if game.juice:
				var o: Vector3 = POINTS[2][1]
				game.juice.burst(o + Vector3(0, 1.1, 0), "petals", 14, Vector3(0.25, 0.05, 0.25), Vector3(0, -1, 0), 25.0, Vector2(0.05, 0.2),
					Vector2(0.03, 0.05), Color(0.86, 0.22, 0.26, 0.95), 2.4, Vector3(0, -0.35, 0))
		"cot":
			# the cloth shifts as you sit on its edge, the lamp gutters, and a wax tablet shows from under it
			game.sfx.play("chime", -20.0, 1.2)
			var tw := blanket.create_tween()
			tw.tween_property(blanket, "position:x", blanket.position.x - 0.28, 0.6).set_trans(Tween.TRANS_SINE)
			tw.parallel().tween_property(blanket, "rotation:y", 0.08, 0.6).set_trans(Tween.TRANS_SINE)
			tablet.visible = true
			if game.juice: game.juice.glint(tablet.global_position + Vector3(0, 0.1, 0))
			_cot_flick = 1.6
		"bench":
			# sit a while: the view swings toward the drowned head (the lookout: the far dome), and back
			_bench_t = 4.0
			_bench_to = Vector3(25.0, 2.0, -32.6) if id == "lookout" else Ch1Geo.CO_HEAD
		_:
			game.sfx.play("chime", -20.0, 1.2)
	if first or kind == "bench": game.ui.show_text(line, game.player.position, 4.5)

## the coin: it drops into the dry basin, rings, glints; for a few breaths the old fountain trickles
func _throw_coin() -> void:
	var land := _coin_spot()
	coin.visible = true
	coin.position = land + Vector3(0, 1.1, 0)
	coin.rotation = Vector3(0.6, 0.0, 0.0)
	var tw := coin.create_tween()
	tw.tween_property(coin, "position:y", land.y, 0.55).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_QUAD)
	tw.parallel().tween_property(coin, "rotation:x", TAU * 2.0, 0.55)
	tw.tween_callback(func() -> void:
		coin.rotation = Vector3.ZERO
		game.sfx.play("glass_tink", -12.0, 1.6)
		if game.juice:
			game.juice.ring(land, 0.9, 1.3)
			game.juice.glint(land + Vector3(0, 0.12, 0))
		_trickle(3.5))

func _coin_spot() -> Vector3:
	var c: Vector3 = POINTS[3][1]
	var q := c.lerp(FOUNTAIN, 0.42)
	return Vector3(q.x, game.level.height_at(Vector2(q.x, q.z)) + 0.008, q.z)

## the fountain runs, briefly: drops off the broken figure's lip into the basin
func _trickle(t: float) -> void:
	var pts := []
	for k in 4: pts.append(FOUNTAIN + Vector3(cos(k * 1.7) * 0.35, 0.0, sin(k * 1.7) * 0.35) + Vector3(0, game.level.height_at(Vector2(FOUNTAIN.x, FOUNTAIN.z)) - FOUNTAIN.y + 0.01, 0))
	var d := AmbientLife.drips(pts, 1.3, 0.35, 0.7)
	add_child(d)
	game.sfx.play("hollow", -24.0, 1.6)
	get_tree().create_timer(t).timeout.connect(func() -> void: if is_instance_valid(d): d.queue_free())

func update(dt: float) -> void:
	for vid in votives:
		var vf: Flame = votives[vid]
		if vf.mat: vf.mat.set_shader_parameter("intensity", 0.9 if done(vid) else 0.0)
	if offer_flame and offer_flame.mat: offer_flame.mat.set_shader_parameter("intensity", 0.85 if done("offering") else 0.0)
	if cot_flame and cot_flame.mat:
		_cot_flick = maxf(0.0, _cot_flick - dt)
		var gut := 1.0 - 0.55 * _cot_flick / 1.6 * (0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.031))
		cot_flame.mat.set_shader_parameter("intensity", 0.8 * gut)
	# the relief: each panel lights as it speaks; once all three have, a light runs along them, then they rest lit
	if _relief_sweep >= 0.0:
		_relief_sweep += dt
		for i in 3: _relief_glow[i] = maxf(_relief_glow[i], 1.0 if _relief_sweep > i * 0.45 else 0.0)
		if _relief_sweep > 2.4: _relief_sweep = -1.0
	for i in relief_mats.size():
		var rest := 0.55 if _relief_said.has(i) else 0.18
		_relief_glow[i] = move_toward(_relief_glow[i], rest, dt * 0.35) if _relief_glow[i] > rest else rest
		relief_mats[i].set_shader_parameter("lit", _relief_glow[i])
	# the relief: each panel speaks once, as you pass it
	var pp := game.player.position
	for i in RELIEF.size():
		if _relief_said.has(i): continue
		var r: Vector3 = RELIEF[i][0]
		if absf(pp.x - r.x) < 0.7 and pp.z > -46.4 and pp.z < -44.3 and absf(pp.y - 2.0) < 0.3 and game.mode == "play":
			_relief_said[i] = true
			_relief_glow[i] = 1.0
			game.sfx.play("chime", -24.0, 0.9 + 0.12 * i)
			if _relief_said.size() == RELIEF.size(): _relief_sweep = 0.0
			game.ui.show_text(RELIEF[i][1], pp, 4.0)
	if _bench_t > 0.0:
		_bench_t -= dt
		var k := sin(clampf(1.0 - _bench_t / 4.0, 0.0, 1.0) * PI)
		lean = (_bench_to - pp).normalized() * 4.0 * k * Vector3(1, 0, 1)
	else:
		lean = Vector3.ZERO

func apply_state() -> void:
	if not hs().has("points"): hs()["points"] = []
	_relief_said.clear()
	_relief_glow = [0.0, 0.0, 0.0]
	_relief_sweep = -1.0
	_cot_flick = 0.0
	# what was done stays done: the coin in the basin, the cloth turned back, the tablet showing
	if coin:
		coin.visible = done("coin")
		coin.position = _coin_spot()
		coin.rotation = Vector3.ZERO
	if blanket:
		var cp: Vector3 = POINTS[4][1]
		blanket.position = cp + Vector3(0.1 - (0.28 if done("cot") else 0.0), 0.27, 0)
		blanket.rotation.y = 0.08 if done("cot") else 0.0
		tablet.visible = done("cot")
