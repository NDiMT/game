extends Puzzle
## EH "The High Stair" (CH1_V3 §1 #33, between): the long stair home from the High Beacon, down the wing's west face,
## hung with torn veils on iron poles (A: "EH_Veil_*"). Below, the Singing Stones' room; behind, the Beacon burning.
## Each veil lifts toward her as she passes (the wind follows her down). Done = the foot of the stair (no jingle).

const POLE_X := 20.62
const POLES_Z := [-70.0, -62.0, -54.0, -46.0, -38.0]
var veils: Array = []
var _passed := -1

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	for z: float in POLES_Z:
		var y := Map3.height("EH", Vector2(POLE_X, z))
		m.cyl(Vector3(POLE_X, y + 1.2, z), 0.04, 0.055, 2.4, Color(0.5, 0.9, 0.0), 6)
		m.box(Vector3(POLE_X + 0.28, y + 2.37, z), Vector3(0.6, 0.05, 0.05), Color(0.5, 0.9, 0.0))
		game.level.ob_circle(Vector2(POLE_X, z), 0.12)
	Kit3.marble(game, m.commit(), self).name = "EH_Poles"

func post() -> void:
	for i in POLES_Z.size():
		var z: float = POLES_Z[i]
		var y := Map3.height("EH", Vector2(POLE_X, z))
		veils.append(Kit3.veil(self, "EH_Veil_%d" % i, Vector3(POLE_X + 0.3, y + 2.34, z), Vector2(0.5, 1.3),
			Basis(Vector3.UP, PI * 0.5), 1.0))

func tick(_dt: float) -> void:
	if not here() or game.mode != "play": return
	var p := game.player.position
	for i in POLES_Z.size():
		if i > _passed and p.z > POLES_Z[i]:
			_passed = i
			Kit3.gust([veils[i]], 2.6, 2.2, 1.0)
	if not done and p.z > -31.0:
		solve()
		if game.sfx: game.sfx.play("bell_far", -24.0, 0.8)

func apply() -> void:
	super.apply()
	_passed = -1

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [22.0, -30.0])
