extends Node
## (Agent A, dev) QuadBatch A/B at the busiest views, in the SAME frame state: at each spot the draw calls are
## sampled with the quads as they are, then QuadBatch.absorb()ed and sampled again, then released.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 390x844 res://dev_fx/batch_probe.tscn -- [--shots=/abs/dir]
const ALL_SPOTS := [["start", Vector3.INF], ["pool", Vector3(-5.0, 0, 3.6)], ["hall", Vector3(0, 0, -14)],
	["garden", Vector3(11, 0, -9)], ["court", Vector3(12, 0, -22)], ["shrine", Vector3(25, 0, -33)],
	["atrium", Vector3(5, 0, 16)], ["gate", Vector3(25, 0, -30)], ["echo", Vector3(18, 0, -45)], ["scales", Vector3(29, 0, -48)]]
var SPOTS := ALL_SPOTS
var game: Node
var qb: QuadBatch
var i := -1
var t := 0.0
var phase := 0
var res := {}
var shots := ""
var samples: Array[float] = []

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		elif a.begins_with("--only="): SPOTS = ALL_SPOTS.filter(func(x): return x[0] in a.get_slice("=", 1).split(","))
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _median() -> float:
	samples.sort()
	var m := samples[samples.size() / 2]
	samples.clear()
	return m

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0:
			game.cmd("begin"); i = 0; t = 0.0; phase = 0
			if OS.get_cmdline_user_args().has("--low"): game.set_quality("low")
		return
	if i >= SPOTS.size():
		var a := 0.0; var b := 0.0
		for k in res: a = maxf(a, res[k][0]); b = maxf(b, res[k][1])
		print("BATCH max off ", a, " on ", b, " ", JSON.stringify(res))
		get_tree().quit()
		return
	match phase:
		0:
			if SPOTS[i][1] != Vector3.INF:
				var p: Vector3 = SPOTS[i][1]
				game.cmd("tp:%f:%f" % [p.x, p.z])
			phase = 1; t = 0.0
		1:
			if t > 2.4:
				samples.append(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
				if samples.size() >= 5:
					res[SPOTS[i][0]] = [_median(), 0.0, {}]
					if shots != "": get_viewport().get_texture().get_image().save_png("%s/batch-off-%s.png" % [shots, SPOTS[i][0]])
					qb = QuadBatch.new(); add_child(qb)
					res[SPOTS[i][0]][2] = qb.absorb(game)
					phase = 2; t = 0.0
		2:
			if t > 0.3:
				samples.append(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
				if samples.size() >= 5:
					res[SPOTS[i][0]][1] = _median()
					if shots != "": get_viewport().get_texture().get_image().save_png("%s/batch-on-%s.png" % [shots, SPOTS[i][0]])
					# (diagnosis: how much of it is the planar reflections? switch them off for a moment)
					_planars(game, false)
					if OS.get_cmdline_user_args().has("--census"): _census(); _casters()
					phase = 3; t = 0.0
		3:
			if t > 0.3:
				samples.append(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
				if samples.size() >= 5:
					res[SPOTS[i][0]].append(_median())
					_planars(game, true)
					# (diagnosis: and the omni / spot lights? each lit surface is drawn once more per light in the
					# Compatibility renderer)
					_lights_n = _lights(game, false)
					var vps := []
					var st: Array[Node] = [game]
					while not st.is_empty():
						var x: Node = st.pop_back()
						for ch in x.get_children(): st.append(ch)
						if x is SubViewport and (x as SubViewport).render_target_update_mode != SubViewport.UPDATE_DISABLED:
							vps.append("%s(%s) mode %d size %s" % [x.name, x.get_parent().name, (x as SubViewport).render_target_update_mode, (x as SubViewport).size])
					print("VIEWPORTS ", SPOTS[i][0], " ", vps)
					phase = 4; t = 0.0
		4:
			if t > 0.3:
				samples.append(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
				if samples.size() >= 5:
					res[SPOTS[i][0]].append(_median())
					_lights(game, true)
					qb.release(); qb.queue_free(); qb = null
					print("spot ", SPOTS[i][0], " off/batched/+no-planar/+no-omni(", _lights_n, " lights) ", res[SPOTS[i][0]][0], " ", res[SPOTS[i][0]][1], " ", res[SPOTS[i][0]][3], " ", res[SPOTS[i][0]][4])
					i += 1; phase = 0; t = 0.0

var _lights_n := 0
var _lit_off: Array[Light3D] = []
func _lights(n: Node, on: bool) -> int:
	if on:
		for l in _lit_off:
			if is_instance_valid(l): l.visible = true
		_lit_off.clear()
		return 0
	var c := 0
	var stack: Array[Node] = [n]
	while not stack.is_empty():
		var x: Node = stack.pop_back()
		for ch in x.get_children(): stack.append(ch)
		for a_ in OS.get_cmdline_user_args():
			if a_.begins_with("--shadowmax=") and x is DirectionalLight3D: (x as DirectionalLight3D).directional_shadow_max_distance = float(a_.get_slice("=", 1))
		if x is DirectionalLight3D and OS.get_cmdline_user_args().has("--nosunshadow"):
			(x as Light3D).shadow_enabled = false
		if (x is OmniLight3D or x is SpotLight3D or (x is DirectionalLight3D and OS.get_cmdline_user_args().has("--nosun"))) and (x as Light3D).is_visible_in_tree():
			(x as Light3D).visible = false; _lit_off.append(x); c += 1
	return c

func _planars(n: Node, on: bool) -> void:
	if n is PlanarMirror: (n as PlanarMirror).enabled = on
	for c in n.get_children(): _planars(c, on)

## what the main camera draws here, by shader / mesh kind (frustum + layer test, as the renderer culls)
func _census() -> void:
	var cam := get_viewport().get_camera_3d()
	var planes := cam.get_frustum()
	var g := {}
	var stack: Array[Node] = [game]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children(): stack.append(c)
		if not (n is GeometryInstance3D): continue
		var gi := n as GeometryInstance3D
		if not gi.is_visible_in_tree() or (gi.layers & cam.cull_mask) == 0: continue
		var ab := gi.global_transform * gi.get_aabb()
		var inside := true
		for pl in planes:
			var c := ab.get_center(); var e := ab.size * 0.5
			var r := absf(pl.normal.x) * e.x + absf(pl.normal.y) * e.y + absf(pl.normal.z) * e.z
			if pl.distance_to(c) > r: inside = false; break
		if not inside: continue
		var key := gi.get_class()
		var m: Material = gi.material_override
		if m == null and gi is MeshInstance3D and (gi as MeshInstance3D).mesh and (gi as MeshInstance3D).mesh.get_surface_count() > 0:
			m = (gi as MeshInstance3D).get_active_material(0)
		if m is ShaderMaterial and (m as ShaderMaterial).shader: key += ":" + (m as ShaderMaterial).shader.resource_path.get_file()
		elif m: key += ":" + m.get_class()
		var surf := 1
		if gi is MeshInstance3D and (gi as MeshInstance3D).mesh: surf = (gi as MeshInstance3D).mesh.get_surface_count()
		var sh := 1 if gi.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF else 0
		if not g.has(key): g[key] = [0, 0, 0]
		g[key][0] += 1; g[key][1] += surf; g[key][2] += sh * surf
	var ks := g.keys()
	ks.sort_custom(func(a, b): return g[a][1] > g[b][1])
	var out := []
	for k in ks.slice(0, 24): out.append("%s n%d surf%d shadow%d" % [k, g[k][0], g[k][1], g[k][2]])
	print("CENSUS ", SPOTS[i][0], "\n  ", "\n  ".join(out))

func _casters() -> void:
	var pl: Vector3 = game.player.global_position
	var box := AABB(pl - Vector3(16, 6, 16), Vector3(32, 16, 32))
	var g := {}
	var tot := 0
	var stack: Array[Node] = [game]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children(): stack.append(c)
		if not (n is GeometryInstance3D): continue
		var gi := n as GeometryInstance3D
		if not gi.is_visible_in_tree() or gi.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF or (gi.layers & 1) == 0: continue
		var ab := gi.global_transform * gi.get_aabb()
		if not ab.intersects(box): continue
		var surf := 1
		if gi is MeshInstance3D and (gi as MeshInstance3D).mesh: surf = (gi as MeshInstance3D).mesh.get_surface_count()
		var key := String(n.get_parent().name) + "/" + String(n.name).left(14) + " " + str(snappedf(ab.size.length(), 0.1)) + "m"
		var k2 := String(n.get_parent().name)
		g[k2] = g.get(k2, 0) + surf
		tot += surf
	var ks := g.keys(); ks.sort_custom(func(a, b): return g[a] > g[b])
	var out := []
	for k in ks.slice(0, 20): out.append("%s %d" % [k, g[k]])
	print("CASTERS ", SPOTS[i][0], " total ", tot, ": ", ", ".join(out))
