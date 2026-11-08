extends Puzzle
## W.7 "The Colossus Stones" (CH1_V3 §1 #17, landmark): the way home along stepping-stones over the lagoon, past the
## Observer's face (8 m, sunk to the brow). Halfway, his gaze: the wind drops, a bell under the water. Done = crossed.

func build() -> void:
	jingle = false
	hint_after = 1.0e9

func tick(_dt: float) -> void:
	if done or not here() or game.mode != "play": return
	if game.player.position.x > -26.0:
		solve()
		if game.sfx:
			game.sfx.play("bell_far", -20.0, 0.5)
			game.sfx.cue("glimpse", -14.0)
		if game.juice: game.juice.ring(Vector3(-24.0, -0.3, 6.5), 3.0, 3.0)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [-25.0, 3.5])
