extends Node
## (Agent A, dev) what draws: visible GeometryInstance3D nodes by owner / name prefix (headless is fine).
var game: Node
var t := 0.0
func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
func _process(dt: float) -> void:
	t += dt
	if t < 3.0: return
	var groups := {}
	for g in game.find_children("*", "GeometryInstance3D", true, false):
		var gi := g as GeometryInstance3D
		if not gi.is_visible_in_tree(): continue
		var nm := str(gi.name).rstrip("0123456789_").get_slice("_", 0)
		var par := str(gi.get_parent().name).rstrip("0123456789_")
		var mat := gi.material_override
		var sh := ""
		if mat is ShaderMaterial and (mat as ShaderMaterial).shader: sh = (mat as ShaderMaterial).shader.resource_path.get_file()
		elif mat: sh = mat.get_class()
		elif gi is MeshInstance3D and (gi as MeshInstance3D).get_surface_override_material(0) is ShaderMaterial: sh = ((gi as MeshInstance3D).get_surface_override_material(0) as ShaderMaterial).shader.resource_path.get_file()
		var gp := str(gi.get_parent().get_parent().name).rstrip("0123456789_") if gi.get_parent().get_parent() else ""
		var k := "%s>%s/%s%s [%s]" % [gp, par, nm, " (MM)" if gi is MultiMeshInstance3D else "", sh]
		var surf := 1
		if gi is MeshInstance3D and (gi as MeshInstance3D).mesh: surf = (gi as MeshInstance3D).mesh.get_surface_count()
		groups[k] = groups.get(k, 0) + surf
	var arr := []
	for k in groups: arr.append([groups[k], k])
	arr.sort_custom(func(a: Array, b: Array) -> bool: return a[0] > b[0])
	var total := 0
	for a in arr: total += a[0]
	print("CENSUS total surfaces ", total)
	for a in arr.slice(0, 30): print("CENSUS ", a[0], "  ", a[1])
	get_tree().quit()
