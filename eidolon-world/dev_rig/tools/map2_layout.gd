extends Node
## (Agent A, tools) the v2 world's layout for the satchel map (make_map2.py): every walk region of the new world
## (named V2_<space> or a v1 room name; Map2.key_of_region gives its space), the spaces, the water, the beacons.
##   EIDOLON_V2=1 godot --headless --path . res://dev_rig/tools/map2_layout.tscn > layout2.txt   (line "MAP2LAYOUT {json}")
func _ready() -> void:
	Game.autotest = true
	var game: Node = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	var lv: Level = game.level
	var regs := []
	for g: Level.Region in lv.regions:
		var k := Map2.key_of_region(g.name)
		if k == "": continue
		regs.append({"name": g.name, "key": k, "x0": g.r.position.x, "x1": g.r.end.x, "z0": g.r.position.y, "z1": g.r.end.y, "y0": g.y0, "y1": g.y1})
	var spaces := []
	for s in Map2.SPACES:
		var r := Map2.space_rect(s[0])
		spaces.append({"id": s[0], "beat": s[1], "name": s[2], "kind": s[3], "x0": r.position.x, "x1": r.end.x, "z0": r.position.y, "z1": r.end.y, "y": s[5]})
	var water := []
	for e in Map2.WATER:
		var r := Map2.wr(e[0], e[1], e[2], e[3])
		water.append({"x0": r.position.x, "x1": r.end.x, "z0": r.position.y, "z1": r.end.y, "design": e[5]})
	var beacons := {}
	for k in Hub.BEACON_POS: beacons[k] = [Hub.BEACON_POS[k].x, Hub.BEACON_POS[k].z]
	print("MAP2LAYOUT " + JSON.stringify({"regions": regs, "spaces": spaces, "water": water, "beacons": beacons, "observer": [Map2.O.x + Map2.OBSERVER.x, Map2.O.z + Map2.OBSERVER.z]}))
	get_tree().quit()
