extends Node
## (Agent A, dev) the v2 satchel map in game: part explored (Act 1, the Atrium, the west wing, its Beacon lit), then all
var game: Node
var t := 0.0
var step := 0
var shots := ""
func _ready() -> void:
	for a in OS.get_cmdline_user_args(): if a.begins_with("--shots="): shots = a.get_slice("=", 1)
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
func _process(dt: float) -> void:
	t += dt
	match step:
		0: if t > 2.0: game.cmd("begin"); step = 1; t = 0
		1: if t > 1.5: game.cmd("skip"); step = 2; t = 0
		2: if t > 1.5: game.cmd("skip"); step = 3; t = 0
		3:
			if t > 2.0:
				var map: MapView = game.satchel.map
				for sid in ["WS", "I1", "I2", "I3", "IB1", "I4", "I5", "A", "WR", "W1", "W2", "W3", "W4", "W5", "IBW", "W6", "WB", "W7", "N1"]:
					map.reveal_area(sid, true)
				map.set_beacon("W", true)
				var a := Map2.space_rect("W5").get_center()
				game.cmd("tp:%f:%f" % [a.x, a.y])
				game.cmd("map")
				step = 4; t = 0
		4:
			if t > 2.0: for tr in game.satchel.seal_marks.values(): (tr as Control).visible = false      # (the old seal icons: W3 drops them, HANDOFF)
			if t > 2.6: _shot("map2-part"); step = 5; t = 0
		5:
			var map: MapView = game.satchel.map
			for sid in map.meta["areas"]: map.reveal_area(sid, true)
			map.set_beacon("N", true); map.set_beacon("E", true)
			step = 6; t = 0
		6:
			if t > 2.0:
				for tr in game.satchel.seal_marks.values(): (tr as Control).visible = false
				_shot("map2-all"); get_tree().quit()
func _shot(n: String) -> void:
	if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, n])
	print("shot ", n)
