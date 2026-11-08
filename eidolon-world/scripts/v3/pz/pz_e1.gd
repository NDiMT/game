extends Puzzle
## E.1 "The Balcony" (CH1_V3 §1 #27, landmark ★): the climb's long landing, open on its west side over the Atrium and
## the lagoon. Torn veils on the parapet, petals on the stone, a stone bench. Sit: the view leaves her and slides out
## over the roofs to the Observer's veiled head, sunk to the brow far out in the inlet (CineCam), then comes home.
## Done = that look. Clip: sit_bench (A, P2; until then she lowers onto it).

const BENCH := Vector2(22.15, -9.0)        # along z, against the east wall: she sits facing west, over the drop
const SEAT := Vector2(21.78, -9.0)
var veils: Array = []
var _sit := false

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var y := Map3.height("E1", BENCH)
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	for dz in [-0.62, 0.62]:          # (the floor is a ramp: each leg stands on its own step of it)
		var ly := Map3.height("E1", Vector2(BENCH.x, BENCH.y + dz))
		m.box(Vector3(BENCH.x, (ly + y + 0.41) * 0.5, BENCH.y + dz), Vector3(0.42, y + 0.41 - ly, 0.16), col)
	m.box(Vector3(BENCH.x, y + 0.45, BENCH.y), Vector3(0.56, 0.1, 1.62), Color(0.5, 0.0, 0.0))
	Kit3.marble(game, m.commit(), self).name = "E1_Bench"
	game.level.ob_rect(Rect2(BENCH.x - 0.3, BENCH.y - 0.82, 0.6, 1.64))
	game.level.add_interact("e1_sit", Vector3(SEAT.x - 0.35, y, SEAT.y), "touch", sit, 1.1, func() -> bool: return not _sit)

func post() -> void:
	# veils tied along the low west parapet, streaming inland
	for i in 3:
		var z := -15.5 + i * 5.5
		var y := Map3.height("E1", Vector2(18.2, z))
		veils.append(Kit3.veil(self, "E1_Veil_%d" % i, Vector3(18.22, y + 1.02, z), Vector2(0.5, 0.95), Basis(Vector3.UP, PI * 0.5), 1.4))

func sit() -> void:
	if _sit or game.mode != "play": return
	_sit = true
	var y := Map3.height("E1", SEAT)
	game.player.teleport(Vector3(SEAT.x, 0.0, SEAT.y), PI * 0.5)          # (on the bench's edge, facing out west)
	game.call("perform", "sit_bench", Vector3(SEAT.x - 1.0, y + 0.5, SEAT.y), func() -> void: _look(), Vector3.ZERO, 9.0)

## she sits; the view slides out west over the Atrium's roofs to the veiled head in the inlet, and back
func _look() -> void:
	var pl := game.player
	var stand_in := not HeroineClips.has("sit_bench")
	if stand_in: pl.crouch = 0.42
	var p := pl.position
	var head := Map3.OBSERVER + Vector3(0, 4.5, 0)
	var c := Cinematic.new(game)
	c.path(0.0, 7.5, [p + Vector3(1.6, 1.9, 1.4), p + Vector3(1.0, 1.7, 0.2), p + Vector3(0.7, 1.55, -0.4)],
		[p + Vector3(-0.4, 0.8, 0), p + Vector3(-6.0, 0.4, 2.0), head], 40.0, 22.0, 1)
	c.path(7.5, 3.0, [p + Vector3(0.7, 1.55, -0.4), p + Vector3(0.75, 1.6, -0.35)], [head, head + Vector3(0, -0.6, 0)], 22.0, 18.0)
	c.handoff(10.5, 1.8)
	c.at(0.3, func() -> void: Kit3.gust(veils, 2.8, 3.5, 1.4), false)
	c.at(1.0, func() -> void: if game.sfx: game.sfx.play("whoosh", -22.0, 0.5), false)
	c.at(4.5, func() -> void: if game.sfx: game.sfx.cue("glimpse", -12.0), false)
	c.at(8.0, func() -> void: if game.sfx: game.sfx.play("bell_far", -22.0, 0.5), false)
	c.at(10.6, func() -> void:
		pl.crouch = 0.0
		solve())
	c.finished.connect(func() -> void:
		pl.crouch = 0.0
		_sit = false
		if not done: solve(), CONNECT_ONE_SHOT)
	game.call("play_cine", c)

func apply() -> void:
	super.apply()
	_sit = false

var _auto := false

func autosolve() -> void:
	_auto = true
	game.cmd("walk:%f:%f" % [SEAT.x - 0.35, SEAT.y])

func update(dt: float) -> void:
	super.update(dt)
	if not _auto or done or _sit:
		_auto = _auto and not done
		return
	if game.mode == "play" and game.auto_target == Vector3.INF: game.try_interact()
