extends Node
## (Agent A, dev) v1.1c particle tuning IN THE GAME: loads main.tscn, goes to real places and fires the real FxBurst
## builders on the game's own Juice node (as W's code does), with the game's camera, fog and tier. Shots at phone size.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/fx_ingame.tscn -- --shots=/abs/dir [--low]
## Each step: [name, teleport xz, what to fire, seconds after firing to shoot]
const STEPS := [
	["pool-splash", Vector2(-3.2, 1.0), "splash", 0.28],
	["pool-step", Vector2(-3.2, 1.0), "steps", 0.22],
	["door-dust", Vector2(14.6, -11.0), "dust", 0.9],
	["brazier-ignite", Vector2(7.2, -13.6), "ignite", 0.3],
	["brazier-calm", Vector2(7.2, -13.6), "none", 3.5],
	["maze-mist", Vector2(12.6, -32.6), "none", 2.0],
	["atrium-lamp", Vector2(12.4, 16.2), "none", 1.5],
]
var game: Node
var shots := ""
var i := -1
var t := 0.0
var fired := false
var embers: FxBurst
var _tp := -1

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0:
			game.cmd("begin")
			if OS.get_cmdline_user_args().has("--low"): game.set_quality("low")
			i = 0; t = 0.0; fired = false
		return
	if i >= STEPS.size():
		get_tree().quit(); return
	var s: Array = STEPS[i]
	if _tp != i:          # (once per step, by flag: a frame can be longer than any time window here)
		_tp = i
		if not (s[0] == "brazier-calm"): game.cmd("tp:%f:%f" % [s[1].x, s[1].y])
	if t > 2.2 and not fired:
		fired = true; t = 2.2
		var j: Node = game.juice
		var pp: Vector3 = game.player.global_position
		match s[2]:
			"splash": FxBurst.splash(j, Vector3(pp.x - 0.9, Ch1Geo.WATER_Y + 0.02, pp.z + 0.4), 1.0)
			"steps":
				for k in 3: FxBurst.footstep(j, Vector3(pp.x - 0.6 + k * 0.45, Ch1Geo.WATER_Y + 0.01, pp.z + 0.6 - k * 0.2), game.puzzles.pool_fx)
			"dust": FxBurst.dust(j, Vector3(16.95, 4.2, -11.8), 1.4, 1.0)
			"ignite":
				var b: Vector3 = Chapter.SH_BRAZ[3]
				FxBurst.sparks(j, b + Vector3(0, 1.15, 0))
				embers = FxBurst.embers(j, b + Vector3(0, 1.3, 0))
	if fired and t > 2.2 + float(s[3]):
		if shots != "": get_viewport().get_texture().get_image().save_png("%s/fxg-%s.png" % [shots, s[0]])
		print("shot ", s[0])
		i += 1; t = 0.0; fired = false
		if i < STEPS.size() and STEPS[i][0] == "brazier-calm": fired = true; t = 2.2       # (same place: keep the embers going)
