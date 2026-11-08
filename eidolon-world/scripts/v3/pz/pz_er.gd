extends Puzzle
## ER "The Climbing Road" (CH1_V3 §1 #27, between): the road east climbs out of the Atrium between two parapets. Torn
## veils hang from three iron poles and stream downhill (A: "ER_Veil_*" by name). The first time, near the top, a gust
## comes down the road: the veils crack, the hem stirs, a far bell. Done = that gust (no gate, no jingle, no hint).

const POLES := [Vector2(12.2, -1.0), Vector2(14.6, 1.0), Vector2(16.9, -1.0)]
const GUST_X := 15.2
var veils: Array = []

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	for p: Vector2 in POLES:
		var y := Map3.height("ER", p)
		m.cyl(Vector3(p.x, y + 1.15, p.y), 0.04, 0.055, 2.3, Color(0.5, 0.9, 0.0), 6)
		m.box(Vector3(p.x - 0.28, y + 2.27, p.y), Vector3(0.6, 0.05, 0.05), Color(0.5, 0.9, 0.0))
		m.cyl(Vector3(p.x, y + 0.05, p.y), 0.12, 0.14, 0.1, Color(0.5, 0.25, 0.0), 8)
		game.level.ob_circle(p, 0.16)
	Kit3.marble(game, m.commit(), self).name = "ER_Poles"

func post() -> void:
	for i in POLES.size():
		var p: Vector2 = POLES[i]
		var y := Map3.height("ER", p)
		veils.append(Kit3.veil(self, "ER_Veil_%d" % i, Vector3(p.x - 0.3, y + 2.24, p.y), Vector2(0.52, 1.25), Basis(), 1.2))

func tick(_dt: float) -> void:
	if done or game.mode != "play" or not here() or game.player.position.x < GUST_X: return
	solve()
	Kit3.gust(veils, 3.2, 3.0, 1.2)
	if game.sfx:
		game.sfx.play("whoosh", -18.0, 0.55)
		game.sfx.play_later("bell_far", 1.2, -26.0, 0.7)
	if game.juice: game.juice.dust_floor(game.player.position + Vector3(0.6, 0.05, 0), 0.9, 10)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [GUST_X + 1.0, 0.0])
