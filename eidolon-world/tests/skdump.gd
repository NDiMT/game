extends SceneTree
func _init() -> void:
	var sc: PackedScene = load("res://assets/models/wanderer.glb")
	var n := sc.instantiate()
	root.add_child(n)
	_walk(n, 0)
	var sk: Skeleton3D = n.find_children("*", "Skeleton3D", true, false)[0]
	for i in sk.get_bone_count():
		var g := sk.get_bone_global_rest(i)
		print(i, " ", sk.get_bone_name(i), " p=", sk.get_bone_parent(i), " pos=", g.origin.snappedf(0.001), " xa=", g.basis.x.snappedf(0.01), " ya=", g.basis.y.snappedf(0.01), " sc=", g.basis.get_scale().snappedf(0.01))
	var mi: MeshInstance3D = n.find_children("*", "MeshInstance3D", true, false)[0]
	print("mesh ", mi.mesh.get_surface_count(), " aabb ", mi.get_aabb(), " skin ", mi.skin != null, " fmt ", mi.mesh.surface_get_format(0))
	var a := mi.mesh.surface_get_arrays(0)
	print("verts ", a[Mesh.ARRAY_VERTEX].size(), " uv2 ", a[Mesh.ARRAY_TEX_UV2] != null, " col ", a[Mesh.ARRAY_COLOR] != null, " bones/vert ", a[Mesh.ARRAY_BONES].size() / a[Mesh.ARRAY_VERTEX].size())
	quit()
func _walk(n: Node, d: int) -> void:
	print("  ".repeat(d), n.name, " (", n.get_class(), ") ", n.transform if n is Node3D else "")
	if d < 3:
		for c in n.get_children(): _walk(c, d + 1)
