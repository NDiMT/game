extends Node
## (Agent A, dev) where a v2 space has room for dressing: an ASCII map per space (0.25 m cells).
##   '#' kept path / puzzle floor, 'x' wall / obstacle, '.' free floor (a walk region), ' ' not floor
func _ready() -> void:
	Game.autotest = true
	var game: Node = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var lv: Level = game.level
	var keep := Map2.route_keep()
	for k in Map2.KEEP_EXTRA: keep.append(Map2.wr(k[0], k[1], k[2], k[3]))
	var only := OS.get_cmdline_user_args()
	for s in Map2.SPACES:
		if only.size() > 0 and not only.has(str(s[0])): continue
		var r := Map2.space_rect(s[0]).grow(0.75)
		var lines := PackedStringArray()
		var free := 0
		var z := r.position.y
		while z < r.end.y:
			var row := ""
			var x := r.position.x
			while x < r.end.x:
				var q := Vector2(x + 0.125, z + 0.125)
				var ch := " "
				var kept := false
				for k in keep: if (k as Rect2).has_point(q): kept = true
				if kept: ch = "#"
				elif lv.blocked(q, 0.12): ch = "x"
				elif lv.on_ground(q): ch = "."; free += 1
				if not Map2.space_rect(s[0]).has_point(q) and ch == ".": ch = ","
				row += ch
				x += 0.25
			lines.append(row)
			z += 0.25
		print("SPACE %s %s rect %s free cells %d" % [s[0], s[2], Map2.space_rect(s[0]), free])
		for l in lines: print("  |" + l)
	get_tree().quit()
