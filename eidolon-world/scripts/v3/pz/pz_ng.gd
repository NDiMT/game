extends Puzzle
## NG "The Garden Landing" (CH1_V3 §1 #19, between): the stair up out of the water into a garden gone wild: a fig tree,
## bees in it, a stone bench. Nothing asked. Done = arrived (a breath of bees and wind).

func build() -> void:
	jingle = false
	hint_after = 1.0e9

## (placeholders: A's fig tree and bench, by name) the landing is a stair: they stand at its height
func post() -> void:
	var t := Vector2(4.6, -22.6)
	Kit3.prop(self, "kit_dead_plant", Vector3(t.x, Map3.height("NG", t), t.y), 2.4, 20.0).name = "NG_Fig"
	game.level.ob_circle(t, 0.5)
	var b := Vector2(-3.0, -21.2)
	var m := MB.new()
	var y := Map3.height("NG", b)
	m.box(Vector3(b.x, y + 0.42, b.y), Vector3(0.45, 0.08, 1.4), Color(0.5, 0.25, 0.0))
	for dz in [-0.5, 0.5]:
		var ly := game.level.height_at(Vector2(b.x, b.y + dz))          # (each leg on its own step)
		m.box(Vector3(b.x, (ly + y + 0.38) * 0.5, b.y + dz), Vector3(0.36, y + 0.38 - ly, 0.16), Color(0.5, 0.5, 0.0))
	Kit3.marble(game, m.commit(), self).name = "NG_Bench"
	game.level.ob_rect(Rect2(b.x - 0.25, b.y - 0.72, 0.5, 1.44))

func tick(_dt: float) -> void:
	if done or not here() or game.mode != "play": return
	solve()
	if game.sfx: game.sfx.cue("wind_gust", -18.0)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [-1.0, -22.0])
