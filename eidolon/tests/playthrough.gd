extends Node
## Headless playthrough: drives the REAL game (main scene, input path try_move, animations, solve
## sequence, level transitions) through all levels using the solver's solutions.
## godot --headless --fixed-fps 60 --path eidolon res://tests/playthrough.tscn
var game: Game
var t := 0.0
var phase := "boot"
var path := ""
var step_i := 0
var expect_level := 1
var results := []
var errors := 0
var extra_done := false
var _last_pos := {}
var _last_board: Node = null
var max_step := 0.0

func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	t += dt
	# continuity: while a turn animates, no body may jump (the v0.3 carry "teleport")
	if game and game.board and game.mode == "play":
		if game.board != _last_board: _last_pos.clear(); _last_board = game.board
		var bodies: Array = [game.board.cube] + game.board.eids
		for bi in bodies.size():
			var p: Vector3 = bodies[bi].position
			if game.board.busy and _last_pos.has(bi):
				var dd: float = (p - _last_pos[bi]).length()
				max_step = maxf(max_step, dd)
				if dd > 0.45: print("ERROR body %d jumped %.2f tiles in one frame (level %d)" % [bi, dd, game.rules.id]); errors += 1
			_last_pos[bi] = p
	if t > 900.0:
		print("TIMEOUT in phase ", phase); get_tree().quit(2); return
	match phase:
		"boot":
			if t > 1.0:
				game.best = {}
				game._on_begin()
				phase = "select"
		"select":
			if game.mode == "select":
				game._on_level_chosen(0)
				phase = "wait_play"
		"wait_play":
			if game.mode == "play" and not game.board.busy:
				if game.rules.id != expect_level:
					print("ERROR expected level ", expect_level, " got ", game.rules.id); errors += 1
				if game.rules.id == 1 and not extra_done:
					phase = "extras"; step_i = 0
				else:
					_start_level()
		"extras":
			# exercise undo / restart / rotation / no-op bump through the real code path
			if game.board.busy: return
			match step_i:
				0: game.try_move(Vector2i(1, 0))
				1: game.try_move(Vector2i(0, 1))
				2:
					game.undo()
					if game.moves != 1: print("ERROR undo moves=", game.moves); errors += 1
				3: game.restart()
				4:
					if game.moves != 0 or Rules.key(game.state) != Rules.key(game.rules.start): print("ERROR restart"); errors += 1
					game.rotate_view(1)
				5:
					var before := Rules.key(game.state)
					game.try_move(Vector2i(-1, 0))   # into the island edge: cube blocked
					if game.moves != 1 and Rules.key(game.state) == before: pass
				6:
					game.restart(); game.rotate_view(-1)
				7:
					extra_done = true
					_start_level(); return
			step_i += 1
		"moving":
			if game.mode == "solved" or game.mode == "transition":
				var ok: bool = game.moves == game.rules.par
				# the rune facing up on each body must be the one engraved on its goal sigil
				var b: Board = game.board
				var want: Array = b.goal_runes()
				var seed := int(floor(b.glyph_seed()))
				var got := [(b._face_of(b._right_angles(b.cube.transform.basis).inverse() * Vector3.UP) + seed) % 6]
				for i in b.eids.size():
					var m := Vector3(-1, 1, 1) if game.rules.mirrors[i]["axis"] == "x" else Vector3(1, 1, -1)
					got.append((b._face_of((b._right_angles(b.eids[i].transform.basis).inverse() * Vector3.UP) * m) + seed) % 6)
				if got != want:
					print("ERROR rune mismatch level ", game.rules.id, " got ", got, " want ", want); errors += 1
				results.append("%2d %-10s moves=%2d par=%2d runes=%s %s" % [game.rules.id, game.rules.title, game.moves, game.rules.par, game.board.goal_runes(), "ok" if ok else "MISMATCH"])
				if not ok: errors += 1
				expect_level += 1
				phase = "wait_play" if expect_level <= game.levels.size() else "wait_end"
				return
			if game.board.busy: return
			if step_i >= path.length():
				print("ERROR level ", game.rules.id, " not solved after path"); errors += 1
				get_tree().quit(1); return
			var ok2 := game.try_move(Rules.DNAME[path[step_i]])
			if not ok2: print("ERROR move rejected at ", step_i); errors += 1
			step_i += 1
		"wait_end":
			if game.mode == "select":
				for r in results: print(r)
				print("best saved: ", game.best)
				print("max per-frame body displacement during turns: %.3f tiles" % max_step)
				print("PLAYTHROUGH %s  levels=%d  errors=%d  sim_time=%.1fs" % ["OK" if errors == 0 else "FAILED", results.size(), errors, t])
				get_tree().quit(0 if errors == 0 else 1)

func _start_level() -> void:
	path = game.rules.solution
	step_i = 0
	phase = "moving"
