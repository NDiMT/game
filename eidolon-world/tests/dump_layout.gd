extends Node
## (v0.9 tools) dump the walk regions and interactables with their areas (headless)
func _ready() -> void:
	Game.autotest = true
	var game: Game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var lv: Level = game.level
	for g in lv.regions:
		var r: Rect2 = g.r
		print("REGION %-14s %-15s x %6.2f..%6.2f z %6.2f..%6.2f y %.2f..%.2f" % [g.name, Names.REGION_AREA.get(g.name, "-"), r.position.x, r.end.x, r.position.y, r.end.y, g.y0, g.y1])
	for it in lv.interacts:
		var rg := lv.region_at(Vector2(it.pos.x, it.pos.z))
		var ar: String = Names.REGION_AREA.get(rg.name, "-") if rg else "-"
		print("INTER %-16s %-15s %6.2f %5.2f %6.2f" % [it.id, ar, it.pos.x, it.pos.y, it.pos.z])
	get_tree().quit()
