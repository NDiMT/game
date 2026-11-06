extends Node
## (W3 dev tool) lists everything still built in the OLD world (outside every Map2 space, grown 3 m): regions,
## obstacles, interacts and visual nodes, so phase 4 can take them all out
var game: Game
var t := 0.0
func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
func _in_new(p: Vector2) -> bool:
	for s in Map2.SPACES:
		if Map2.space_rect(s[0]).grow(3.0).has_point(p): return true
	for e in Map2.WATER:
		if Map2.wr(e[0], e[1], e[2], e[3]).grow(3.0).has_point(p): return true
	return false
func _process(dt: float) -> void:
	t += dt
	if t < 1.0: return
	set_process(false)
	var lv: Level = game.level
	for g in lv.regions:
		if g.r.has_area() and not _in_new(g.r.get_center()): print("REGION ", g.name, " ", g.r)
	for o in lv.obstacles:
		var c: Vector2 = o.c if o.circle else o.r.get_center()
		if not _in_new(c): print("OBST ", o.name, " ", c)
	for it in lv.interacts:
		if not _in_new(Vector2(it.pos.x, it.pos.z)): print("INTERACT ", it.id, " ", it.pos)
	_walk(game)
	get_tree().quit()
func _walk(n: Node) -> void:
	if n is VisualInstance3D and (n as Node3D).is_visible_in_tree():
		var ab: AABB = (n as VisualInstance3D).get_aabb()
		var gab: AABB = (n as Node3D).global_transform * ab
		var c := gab.get_center()
		if ab.size.length() > 0.0 and ab.size.length() < 400.0 and not _in_new(Vector2(c.x, c.z)) and not (n is Camera3D):
			var extra := ""
			if n is MeshInstance3D:
				var mi := n as MeshInstance3D
				extra = " mesh=%s mat=%s" % [mi.mesh.get_class() if mi.mesh else "-", (mi.material_override.shader.resource_path if mi.material_override is ShaderMaterial else str(mi.material_override))]
			print("NODE ", game.get_path_to(n), " ", n.get_class(), " c=", c.snapped(Vector3.ONE * 0.1), " s=", gab.size.snapped(Vector3.ONE * 0.1), extra)
	for ch in n.get_children(): _walk(ch)
