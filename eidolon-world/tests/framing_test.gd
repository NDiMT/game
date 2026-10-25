extends Node
## v0.9 framing test (headless): for every framed room, at the fixed camera (one yaw, one size), solve the
## room's anchor for each phone screen and check that every interactable, exit and key piece lands in the safe
## rect, also with the gentle follow pushed to its limits. Prints FRAMING PASS / FRAMING FAIL and the list.
const SCREENS := [Vector2(360, 780), Vector2(390, 844), Vector2(430, 932)]

func _ready() -> void:
	Game.autotest = true
	var game: Game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var lv: Level = game.level
	var size: float = World.FIXED_SIZE
	var fails := 0
	for k in Framing.ROOMS:
		var worst := 0.0
		var bad: Array = []
		for s: Vector2 in SCREENS:
			var vo: float = World.V_OFFSET * size / World.CAM_SIZE
			var sol := Framing.solve(k, lv, s.x, s.y, size, vo)
			worst = maxf(worst, sol["need"])
			for d in [Vector2.ZERO, Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
				var b := Framing.basis()
				var sl: Vector2 = sol["slack"]
				var rig: Vector3 = sol["rig"] + b.x * d.x * minf(World.FOLLOW_MAX, sl.x) + b.y * d.y * minf(World.FOLLOW_MAX, sl.y)
				for e in Framing.points(k, lv):
					var px := Framing.project(e[1], rig, s.x, s.y, size, vo)
					if px.x < Framing.SAFE_SIDE - 0.5 or px.x > s.x - Framing.SAFE_SIDE + 0.5 or px.y < Framing.SAFE_TOP - 0.5 or px.y > s.y - Framing.SAFE_BOTTOM + 0.5:
						var line := "%s at %dx%d%s -> (%d, %d)" % [e[0], s.x, s.y, "" if d == Vector2.ZERO else " follow %s" % d, px.x, px.y]
						if not bad.has(line): bad.append(line)
		var ok := bad.is_empty()
		if not ok: fails += 1
		print("ROOM %-15s %-26s needs width %5.2f m (fixed %.1f)  %s" % [k, Names.area(k), worst, size, "OK" if ok else "CUT (%d)" % bad.size()])
		var shown := 0
		for l in bad:
			if shown < 4 and l.find("follow") < 0 and l.find("360x780") >= 0:
				print("    " + l); shown += 1
	print("FRAMING %s (%d of %d rooms cut)" % ["PASS" if fails == 0 else "FAIL", fails, Framing.ROOMS.size()])
	get_tree().quit()
