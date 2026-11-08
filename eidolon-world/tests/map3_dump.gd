extends SceneTree
## Map3 as JSON (for tests/render_map3.py):  godot --headless --path . -s res://tests/map3_dump.gd | grep ^MAP3JSON | cut -c10-

func _initialize() -> void:
	var rt := []
	for e in Map3.route("all"): rt.append([e[0], e[1], e[2]])
	var parts := {}
	for pt in Map3.PARTS:
		var rr := []
		for e in Map3.route(pt): rr.append([e[0], e[1], e[2]])
		parts[pt] = rr
	var d := {"route_parts": parts, "spaces": Map3.SPACES, "water": Map3.WATER, "mirrors": Map3.MIRRORS, "route": rt, "paths": Map3.PATH,
		"observer": [Map3.OBSERVER.x, Map3.OBSERVER.z], "audit": Map3.audit()}
	print("MAP3JSON " + JSON.stringify(d))
	quit()
