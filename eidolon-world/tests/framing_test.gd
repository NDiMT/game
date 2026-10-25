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
		if not ok:
			var what := {}
			for l in bad:
				if l.find("follow") >= 0: continue
				var nm: String = l.split(" at ")[0].replace(" (top)", "").replace(" (head)", "")
				if nm.begins_with("floor"): nm = "walkable floor edge"
				what[nm] = true
			print("    cut: " + ", ".join(what.keys()))
	# (v0.9) what stands between the camera and a room's pieces: walls to lower or remove (warnings)
	var boxes: Array = []
	for pa in lv.audit.get("boxes", []):
		var bb0: AABB = pa[0]
		if str(pa[3]).ends_with(":floor") or bb0.size.y < 0.25: continue
		boxes.append(pa)
	var bz := Framing.basis().z
	for k in Framing.ROOMS:
		var seen := {}          # name -> true once any of its points (feet, top) is in clear view
		var by := {}            # name -> what hid it
		for e in Framing.points(k, lv):
			var p: Vector3 = e[1]
			var raw: String = e[0]
			# a piece is seen when its foot is (0.4 m up: the stone or stand itself, not the air above it);
			# you are seen when your head is
			if raw.ends_with("(top)"): continue
			if raw.begins_with("you") and not raw.ends_with("(head)"): continue
			if not raw.begins_with("you"): p += Vector3(0, 0.4, 0)
			var nm: String = raw.replace(" (head)", "")
			if not seen.has(nm): seen[nm] = false
			var hit := ""
			for pa in boxes:
				var bb: AABB = pa[0]
				if Rect2(bb.position.x, bb.position.z, bb.size.x, bb.size.z).grow(0.35).has_point(Vector2(p.x, p.z)): continue        # its own body
				if bb.intersects_segment(p + bz * 0.05, p + bz * 30.0):
					hit = "%s (%.1f m tall, top y %.1f, at %.1f, %.1f)" % [pa[3], bb.size.y, bb.end.y, bb.get_center().x, bb.get_center().z]
					break
			if hit == "": seen[nm] = true
			else: by[nm] = hit
		var hid: Array = []
		for nm in seen:
			if not seen[nm]: hid.append(nm + " <- " + by[nm])
		print("OCCLUDED %-15s %s" % [k, "none" if hid.is_empty() else "; ".join(hid)])
	print("FRAMING %s (%d of %d rooms cut)" % ["PASS" if fails == 0 else "FAIL", fails, Framing.ROOMS.size()])
	get_tree().quit()
