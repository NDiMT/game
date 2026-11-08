extends Node
## v3 SAVE / CONTINUE (headless): for each part, the beats before it solved, she stands at the part's start (and in
## its middle), the game saves; a NEW game then continues from that save: same place, same part, same beats done,
## same items, the road she came by still open, and she can walk. Prints SAVE3 PASS / SAVE3 FAIL.
##   godot --headless --fixed-fps 60 --path . res://tests/save_v3.tscn
var errors := 0
var checks := 0

func ok(label: String, pass_: bool, detail := "") -> void:
	checks += 1
	if not pass_: errors += 1
	print("%s  %s %s" % ["PASS" if pass_ else "FAIL", label, detail])

func _frames(n: int) -> void:
	for k in n: await get_tree().process_frame

func _game() -> Game3:
	var g: Game3 = load("res://scenes/main3.tscn").instantiate()
	add_child(g)
	return g

func _ready() -> void:
	Game.autotest = true
	var order: Array = []
	for pt in Map3.PARTS:
		for id in Map3.PATH[pt]:
			if not (id in order): order.append(id)
	for pt in Map3.PARTS:
		for spot in ["start", "mid"]:
			var g := _game()
			await _frames(3)
			g.seen["prologue"] = true
			g.items = ["comb"]
			# every beat of the parts before this one solved (this part's own: none yet, or the first half)
			var path: Array = Map3.PATH[pt]
			var upto := order.find(path[0]) if spot == "start" else order.find(path[path.size() / 2])
			for id in g.ch.pz:
				var sp: String = (g.ch.pz[id] as Puzzle).space
				var at := order.find(sp)
				if at >= 0 and at < upto and not (id in ["I21", "I23"]): g.cmd("pz_solve:" + id)
			if pt != "act1": g.items.append("lamp")
			if pt in ["north", "east", "act3"]: g.items.append("shard")
			await _frames(2)
			var where: String = path[0] if spot == "start" else path[path.size() / 2]
			g.cmd("v3jump:" + where)
			await _frames(30)
			g.save3()
			var want: Dictionary = g.state3()
			var pos: Vector3 = g.player.position
			g.queue_free()
			await _frames(2)
			# continue: a new game reads the save (as the title's Continue does)
			var g2: Game3 = load("res://scenes/main3.tscn").instantiate()
			add_child(g2)
			await _frames(3)
			g2._load3_force()
			g2._place_from_save()
			g2.mode = "play"
			g2.controls.enabled = true
			await _frames(20)
			var st: Dictionary = g2.state3()
			var tag := "%s/%s (%s)" % [pt, spot, where]
			ok(tag + " same place", g2.player.position.distance_to(pos) < 0.3, "%s vs %s" % [g2.player.position, pos])
			ok(tag + " same space", st["space"] == want["space"], "%s vs %s" % [st["space"], want["space"]])
			ok(tag + " same beats", JSON.stringify(_dones(st["pz"])) == JSON.stringify(_dones(want["pz"])), "")
			ok(tag + " same items", JSON.stringify(st["items"]) == JSON.stringify(want["items"]), str(st["items"]))
			ok(tag + " the part's music", g2.sfx.area == g2.music_key(), "%s / %s" % [g2.sfx.area, g2.music_key()])
			# she can walk back the way she came (the door behind her is open)
			var p0 := g2.player.position
			var back: Variant = null
			for e in Map3.route(pt):
				if e[2] == where: break
				back = e
			if back != null:
				g2.cmd("walk:%f:%f" % [back[0], back[1]])
				await _frames(90)
				ok(tag + " can walk", g2.player.position.distance_to(p0) > 0.8, "moved %.2f m" % g2.player.position.distance_to(p0))
			g2.queue_free()
			await _frames(2)
	print("SAVE3 %s  checks=%d  failed=%d" % ["PASS" if errors == 0 else "FAIL", checks, errors])
	get_tree().quit(0 if errors == 0 else 1)

func _dones(pz: Dictionary) -> Dictionary:
	var d := {}
	for id in pz: d[id] = bool(pz[id].get("done", false))
	return d
