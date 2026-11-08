extends Puzzle
## WR "The Inlet Road" (CH1_V3 §1 #9, between): the road west runs along the lagoon. Halfway, the first time, she
## stops and the view turns out over the black water to the Observer's veiled head, sunk to the brow (a 5 s look on
## the CineCam, then the fixed camera again). Done = that look. No gate, no jingle.

const AT_X := -14.0                     # where the look starts (the road's middle)

func build() -> void:
	jingle = false
	hint_after = 1.0e9

func tick(_dt: float) -> void:
	if done or game.mode != "play" or not here() or game.player.position.x > AT_X: return
	solve()
	_look()

func _look() -> void:
	var p := game.player.position
	var head := Map3.OBSERVER + Vector3(0, 5.0, 0)
	var c := Cinematic.new(game)
	c.path(0.0, 5.0, [p + Vector3(1.5, 2.2, -2.0), p + Vector3(0.4, 1.8, 0.6), p + Vector3(-1.2, 1.6, 2.2)], [p + Vector3(0, 1.4, 0), head, head], 38.0, 30.0, 1)
	c.handoff(5.0, 1.4)
	c.at(0.4, func() -> void: if game.sfx: game.sfx.play("bell_far", -24.0, 0.55), false)
	c.at(1.2, func() -> void: if game.sfx: game.sfx.cue("glimpse", -12.0), false)
	game.call("play_cine", c)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [AT_X - 1.0, 0.2])
