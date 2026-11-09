extends SceneTree
## (a7, Agent A) bakes the hero shaders' per-vertex data into her new mesh (assets/models/heroine_v2.glb, built by
## dev_rig/tools/heroine_bl_rig.py) -> assets/models/heroine_v2_mesh.res (wanderer.gdshaderinc, `unit` = 1.7):
##  COLOR.r = rest height / 1.7     COLOR.g = distance from the body axis / (0.5 x 1.7)
##  COLOR.b = her pale porcelain skin (the GLB's COLOR_0.r)     COLOR.a = 0 (no shader flutter: the gown rides real bones)
## godot --headless --path . -s dev_rig/a7/prep_heroine_v2.gd
func _init() -> void:
	var n1: Node = (load("res://assets/models/heroine_v2.glb") as PackedScene).instantiate()
	var mi1: MeshInstance3D = n1.find_children("*", "MeshInstance3D", true, false)[0]
	var a := mi1.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var zs := 0.0; var zn := 0
	for v in V:
		if v.y > 0.9 and v.y < 1.3 and absf(v.x) < 0.15: zs += v.z; zn += 1
	var az := zs / maxf(zn, 1)
	var C0: PackedColorArray = a[Mesh.ARRAY_COLOR] if a[Mesh.ARRAY_COLOR] != null else PackedColorArray()
	var col := PackedColorArray(); col.resize(V.size())
	for i in V.size():
		var v := V[i]
		var r := Vector2(v.x, v.z - az).length()
		col[i] = Color(clampf(v.y / 1.7, 0.0, 1.0), clampf(r / 0.85, 0.0, 1.0), C0[i].r if C0.size() == V.size() else 0.0, 0.0)
	print("heroine v2 verts ", V.size(), " axis z ", az, " skin colours ", C0.size())
	a[Mesh.ARRAY_COLOR] = col
	var uv2 := PackedVector2Array(); uv2.resize(V.size())
	a[Mesh.ARRAY_TEX_UV2] = uv2
	var am := ArrayMesh.new()
	var fmt: int = mi1.mesh.surface_get_format(0) & ~Mesh.ARRAY_FLAG_COMPRESS_ATTRIBUTES
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a, [], {}, fmt | Mesh.ARRAY_FORMAT_COLOR | Mesh.ARRAY_FORMAT_TEX_UV2)
	print("save ", ResourceSaver.save(am, "res://assets/models/heroine_v2_mesh.res", ResourceSaver.FLAG_COMPRESS))
	n1.free()
	quit()
