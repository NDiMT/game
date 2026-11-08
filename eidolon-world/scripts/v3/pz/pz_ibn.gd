extends Puzzle
## IBN "The Wind Ramp" (CH1_V3 §1 #23, between): after the Still Room, a ramp up into the wind; torn veils on their
## posts stream UPHILL (the wind blows toward the court). Done = arrived.

func build() -> void:
	jingle = false
	hint_after = 1.0e9

func tick(_dt: float) -> void:
	if done or not here() or game.mode != "play": return
	solve()
	if game.sfx: game.sfx.cue("wind_gust", -12.0)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [18.0, -38.0])
