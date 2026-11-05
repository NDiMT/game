extends Node
## (Agent A, dev) v2.0 global effects pass: the same Chapter I places and moments shot IN THE GAME, for before / after.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/v2_global.tscn -- --shots=/abs/dir --tag=before [--low]
## Each step: [name, jump room, tp xz (or null), what to fire, seconds after firing to shoot]
const STEPS := [
	["water", "waking_pool", Vector2(-3.2, 1.0), "water", 0.3],
	["mirror", "hall_glass", Vector2(0.6, -16.8), "none", 1.5],
	["flames", "shard_gallery", Vector2(7.2, -13.6), "flames", 1.6],
	["dust", "garden_veiled", Vector2(14.6, -11.0), "dust", 0.9],
	["mist", "mist_maze", Vector2(12.6, -32.6), "none", 2.0],
	["pickup", "atrium", Vector2(12.4, 16.2), "none", 1.5],
]
var game: Node
var shots := ""
var tag := "now"
var i := -1
var t := 0.0
var fired := false
var _tp := -1

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--tag="): tag = a.get_slice("=", 1)
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0:
			game.cmd("begin")
			if OS.get_cmdline_user_args().has("--low"): game.set_quality("low")
			i = 0; t = 0.0
		return
	if i >= STEPS.size():
		get_tree().quit(); return
	var s: Array = STEPS[i]
	if _tp != i:
		_tp = i
		game.cmd("jump:" + s[1])
		if s[2] != null: game.cmd("tp:%f:%f" % [s[2].x, s[2].y])
		t = 0.0
	if t > 2.5 and not fired:
		fired = true; t = 0.0
		var j: Node = game.juice
		var pp: Vector3 = game.player.global_position
		match s[3]:
			"water":
				for k in 3: FxBurst.footstep(j, Vector3(pp.x - 0.6 + k * 0.45, Ch1Geo.WATER_Y + 0.01, pp.z + 0.6 - k * 0.2), game.puzzles.pool_fx)
				FxBurst.splash(j, Vector3(pp.x - 1.1, Ch1Geo.WATER_Y + 0.02, pp.z + 0.9), 1.0)
			"flames":
				for b in [0, 2]:
					if not game.chapter.state["gallery_lit"].has(b): game.chapter.toggle_brazier(b)
			"dust": FxBurst.dust(j, Vector3(16.95, 4.2, -11.8), 1.4, 1.0)
		return
	if fired and t > float(s[4]):
		var nm := "v2g-%s-%s" % [tag, s[0]]
		if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, nm])
		print("shot ", nm)
		i += 1; t = 0.0; fired = false
