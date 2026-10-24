extends Node
## Dev harness (rendered, not headless): runs a ';'-separated script of Game.cmd() calls plus
##   w:SECONDS   wait      shot:NAME   save the viewport to dev/shots/NAME.png      quit
## xvfb-run godot --path . res://tests/devshot.tscn -- "begin;w:6;shot:a;quit"
var game: Game
var steps: PackedStringArray
var i := 0
var wait := 0.0

func _ready() -> void:
	Game.autotest = true
	var args := OS.get_cmdline_user_args()
	steps = (args[0] if args.size() > 0 else "w:3;shot:dev;quit").split(";")
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	if wait > 0.0:
		wait -= dt
		return
	while i < steps.size():
		var s := steps[i].strip_edges()
		i += 1
		if s.begins_with("w:"):
			wait = float(s.substr(2))
			return
		elif s.begins_with("shot:"):
			var img := get_viewport().get_texture().get_image()
			img.save_png("res://dev/shots/" + s.substr(5) + ".png")
			print("shot ", s.substr(5), " ", JSON.stringify(game.state_dict()))
		elif s == "quit":
			get_tree().quit()
			return
		elif s.begins_with("print"):
			print(JSON.stringify(game.state_dict()))
		else:
			game.cmd(s)
