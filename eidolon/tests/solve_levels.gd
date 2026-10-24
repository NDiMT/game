extends SceneTree
## Headless BFS over every level using the game's own Rules (scripts/rules.gd).
## godot --headless --path eidolon --script res://tests/solve_levels.gd
## Verifies: solvable, par == stored par (tools/solver.py), stored solution replays to a win,
## no "too easy" level (par < 4 after level 2), no degenerate solution.

func _init() -> void:
	var levels := Rules.load_all()
	var ok := true
	var total := 0
	for i in levels.size():
		var r: Rules = levels[i]
		var t0 := Time.get_ticks_msec()
		var res := r.solve()
		var par: int = res["par"]
		var flags: Array[String] = []
		if par < 0: flags.append("UNSOLVABLE")
		if par == 0: flags.append("DEGENERATE:start-solved")
		if i >= 2 and par >= 0 and par < 4: flags.append("TOO-EASY")
		if r.par >= 0 and r.par != par: flags.append("PAR-MISMATCH(json %d)" % r.par)
		# replay solver path + stored solution through step(): both must win; analyse desync/slides
		var desync := 0
		var slides := 0
		for pi in 2:
			var path: String = str(res["path"]) if pi == 0 else r.solution
			if path == "": continue
			var s := Rules.copy_state(r.start)
			for c in path:
				var ev := r.step(s, Rules.DNAME[c])
				if not ev["changed"]: flags.append("NOOP-IN-PATH")
				if pi == 0:
					var moved_any: bool = ev["cube_moved"] or ev["eid_step"].has(true)
					if moved_any and (not ev["cube_moved"] or ev["eid_step"].has(false)): desync += 1
					for v in ev["slid"]: if v != 0: slides += 1
				s = ev["state"]
			if not r.won(s): flags.append("PATH-DOES-NOT-WIN(%s)" % path)
		var has_rail := false
		for m in r.mirrors: if m["rail"] != null: has_rail = true
		if i >= 2 and desync == 0: flags.append("DEGENERATE:no-desync")
		if has_rail and slides == 0: flags.append("DEGENERATE:mirror-never-slides")
		for f in flags:
			if not f.begins_with("x"): ok = false
		total += par
		print("%2d %-12s par=%2d states=%4d desync=%d slides=%2d %4dms %s  %s" % [r.id, r.title, par, res["states"], desync, slides, Time.get_ticks_msec() - t0, " ".join(flags) if flags.size() else "ok", res["path"]])
	print("levels=%d total_par=%d %s" % [levels.size(), total, "ALL OK" if ok else "FAILED"])
	quit(0 if ok else 1)
