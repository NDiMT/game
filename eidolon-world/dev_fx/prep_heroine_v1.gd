extends SceneTree
## (Agent A, dev) v1.0 heroine: a copy of tests/prep_heroine.gd (W) for the v1 model. Bakes per-vertex data into the heroine (assets/models/heroine_rigged.glb)
## -> assets/models/heroine_mesh.res, for the hero shaders (wanderer.gdshaderinc, `unit` = 1.7: the GLB is in metres):
##  COLOR.r = rest height / 1.7 (0 hem .. 1 top of the veil)
##  COLOR.g = distance from the body axis / (0.5 x 1.7)
##  COLOR.b = where her pale porcelain skin shows (from the GLB's COLOR_0.r, written by dev_rig/tools/heroine_v1_rig.py)
##  COLOR.a = cloth carried by the spring chains (Hem / Veil bones)
## godot --headless --path . -s dev_fx/prep_heroine_v1.gd
func _init() -> void:
	var n1: Node = (load("res://assets/models/heroine_v1_rigged.glb") as PackedScene).instantiate()
	var sk1: Skeleton3D = n1.find_children("*", "Skeleton3D", true, false)[0]
	var mi1: MeshInstance3D = n1.find_children("*", "MeshInstance3D", true, false)[0]
	var a := mi1.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
	var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
	var cloth := {}
	var re := RegEx.create_from_string("^(Hem|Veil)")
	for i in mi1.skin.get_bind_count():
		var nm := mi1.skin.get_bind_name(i)
		if nm == "": nm = sk1.get_bone_name(mi1.skin.get_bind_bone(i))
		if re.search(nm): cloth[i] = true
	# the body axis: the mean z of the torso band
	var zs := 0.0; var zn := 0
	for v in V:
		if v.y > 0.9 and v.y < 1.3 and absf(v.x) < 0.15: zs += v.z; zn += 1
	var az := zs / maxf(zn, 1)
	var C0: PackedColorArray = a[Mesh.ARRAY_COLOR] if a[Mesh.ARRAY_COLOR] != null else PackedColorArray()      # (v1: COLOR_0.r = where her pale skin shows)
	var per1 := B.size() / V.size()
	var col := PackedColorArray(); col.resize(V.size())
	for i in V.size():
		var v := V[i]
		var cw := 0.0
		for k in per1:
			if cloth.has(B[i * per1 + k]): cw += W[i * per1 + k]
		var r := Vector2(v.x, v.z - az).length()
		col[i] = Color(clampf(v.y / 1.7, 0.0, 1.0), clampf(r / 0.85, 0.0, 1.0), C0[i].r if C0.size() == V.size() else 0.0, clampf(cw, 0.0, 1.0))
	print("heroine verts ", V.size(), " axis z ", az, " (", az / 1.7, " in units)  cloth-bone binds ", cloth.size())
	a[Mesh.ARRAY_COLOR] = col
	var uv2 := PackedVector2Array(); uv2.resize(V.size())
	a[Mesh.ARRAY_TEX_UV2] = uv2
	var am := ArrayMesh.new()
	var fmt: int = mi1.mesh.surface_get_format(0) & ~Mesh.ARRAY_FLAG_COMPRESS_ATTRIBUTES
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a, [], {}, fmt | Mesh.ARRAY_FORMAT_COLOR | Mesh.ARRAY_FORMAT_TEX_UV2)
	print(ResourceSaver.save(am, "res://assets/models/heroine_v1_mesh.res", ResourceSaver.FLAG_COMPRESS))
	n1.free()
	quit()
