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

var _bench: Array = []
var _bench_last := 0
var _bench_skip := 0

func _process(dt: float) -> void:
	if not _bench.is_empty():
		var now := Time.get_ticks_usec()
		var d := (now - _bench_last) / 1000.0
		_bench_last = now
		if _bench_skip > 0:
			_bench_skip -= 1
			return
		(_bench[2] as Array).append(d)
		_bench[1] -= d / 1000.0
		if _bench[1] <= 0.0:
			var a: Array = _bench[2]
			a.sort()
			var mean := 0.0
			for v in a: mean += v
			mean /= a.size()
			print("BENCH %-12s mean %6.2f ms  p90 %6.2f  frames %d  dc %d  prim %d  fill %.2f" % [_bench[0], mean, a[int(a.size() * 0.9)], a.size(),
				Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME), game.world.fill_estimate()])
			_bench = []
		return
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
		elif s.begins_with("bench:"):
			# bench:LABEL:SECONDS  mean / p90 frame ms over real time
			var parts := s.split(":")
			_bench = [parts[1], float(parts[2]) if parts.size() > 2 else 4.0, []]
			_bench_last = Time.get_ticks_usec()
			_bench_skip = 10
			return
		elif s == "quit":
			get_tree().quit()
			return
		elif s.begins_with("print"):
			print(JSON.stringify(game.state_dict()))
		else:
			game.cmd(s)
