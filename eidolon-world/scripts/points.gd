class_name Points
extends Node3D
## v1.1 (dev/V1_WORLD.md 8): the in-between points. Places between the puzzles with something to see or do
## that is not a puzzle: a bell to ring, a votive to light, an offering, a coin for the dry fountain, Theron's
## cot, a bench with a view, a carved relief to walk along. Each is optional, each says one thing once.
## State: chapter.state["hub"]["points"] (the ones done).

var game: Game
var chapter: Chapter
var votive: Flame
var bell: Node3D
var _relief_said := {}
var _bench_t := 0.0
var lean := Vector3.ZERO

## [id, where, kind, icon, line]
const POINTS := [
	["bell", Vector3(-12.45, 0.0, 1.3), "bell", "ring", "Its note went out over the water and came back from very far."],
	["votive", Vector3(-10.45, 1.0, -12.0), "votive", "light", "A small flame, for her. Someone kept lighting these."],
	["offering", Vector3(6.6, 1.0, -18.1), "offering", "touch", "Grapes turned to stone, a comb, a hair ribbon. Gifts no one took."],
	["coin", Vector3(5.0, 0.5, 14.25), "coin", "touch", "The coin rang on the dry stone. Once, here, it would have splashed."],
	["cot", Vector3(19.6, 0.5, 10.6), "cot", "read", "His cot, under the floor of his workshop. He slept beside her faces."],
	["bench", Vector3(26.85, 2.0, -4.5), "bench", "wait", "From here the drowned head looks up at the sky, as if listening."],
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
		game.puzzles.rune_quad(self, (r[0] as Vector3) + Vector3(0, 1.3, 0.04), Vector2(1.1, 0.7), Basis(), float(4 + i), 0.18)

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
			votive = Flame.new(0.0, 0.14, Palette.FIRE_LIGHT, game.level.noise_tex)
			votive.position = at + Vector3(0, 0.97, 0)
			votive.bounce = false
			add_child(votive)
			game.level.ob_circle(Vector2(at.x, at.z), 0.2)
		"offering":
			m.cyl(at + Vector3(0, 0.12, 0), 0.24, 0.28, 0.24, c, 12)
			m.sphere(at + Vector3(-0.06, 0.29, 0.02), Vector3(0.06, 0.05, 0.06), c, 6, 4)
			m.sphere(at + Vector3(0.07, 0.28, -0.03), Vector3(0.05, 0.04, 0.05), c, 6, 4)
			game.level.ob_circle(Vector2(at.x, at.z), 0.3)
		"cot":
			m.box(at + Vector3(0, 0.18, 0), Vector3(1.8, 0.12, 0.7), Color(0.5, WorldGeo.WOOD, 0.0))
			for dx in [-0.8, 0.8]:
				for dz in [-0.28, 0.28]: m.box(at + Vector3(dx, 0.06, dz), Vector3(0.08, 0.12, 0.08), Color(0.5, WorldGeo.WOOD, 0.0))
			m.box(at + Vector3(0.1, 0.27, 0), Vector3(1.5, 0.06, 0.6), Color(0.5, 0.25, 0.0))      # (a folded cloth)
			m.box(at + Vector3(-0.75, 0.3, 0), Vector3(0.25, 0.08, 0.4), Color(0.5, 0.25, 0.0))     # (a stone pillow)
			game.level.ob_rect(Level.R(at.x - 0.95, at.z - 0.4, at.x + 0.95, at.z + 0.4))
		"bench":
			m.box(at + Vector3(0, 0.22, 0), Vector3(0.45, 0.08, 1.4), c)
			for dz in [-0.55, 0.55]: m.box(at + Vector3(0, 0.09, dz), Vector3(0.36, 0.18, 0.14), c)
			game.level.ob_rect(Level.R(at.x - 0.25, at.z - 0.72, at.x + 0.25, at.z + 0.72))
	if kind != "coin": game.puzzles.marble_instance(m.commit(), self)
	var line: String = p[4]
	game.level.add_interact("pt_" + id, at + _approach(kind), p[3], func() -> void: _use(id, kind, line), 0.9,
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
			game.sfx.play("glass_tink", -12.0, 1.6)
			if game.juice: game.juice.glint((POINTS[3][1] as Vector3) + Vector3(0, 0.7, 0))
		"bench":
			# sit a while: the view swings toward the drowned head, and back
			_bench_t = 4.0
		_:
			game.sfx.play("chime", -20.0, 1.2)
	if first or kind == "bench": game.ui.show_text(line, game.player.position, 4.5)

func update(dt: float) -> void:
	if votive and votive.mat: votive.mat.set_shader_parameter("intensity", 0.9 if done("votive") else 0.0)
	# the relief: each panel speaks once, as you pass it
	var pp := game.player.position
	for i in RELIEF.size():
		if _relief_said.has(i): continue
		var r: Vector3 = RELIEF[i][0]
		if absf(pp.x - r.x) < 0.7 and pp.z > -46.4 and pp.z < -44.3 and absf(pp.y - 2.0) < 0.3 and game.mode == "play":
			_relief_said[i] = true
			game.ui.show_text(RELIEF[i][1], pp, 4.0)
	if _bench_t > 0.0:
		_bench_t -= dt
		var k := sin(clampf(1.0 - _bench_t / 4.0, 0.0, 1.0) * PI)
		lean = (Ch1Geo.CO_HEAD - pp).normalized() * 4.0 * k * Vector3(1, 0, 1)
	else:
		lean = Vector3.ZERO

func apply_state() -> void:
	if not hs().has("points"): hs()["points"] = []
	_relief_said.clear()
