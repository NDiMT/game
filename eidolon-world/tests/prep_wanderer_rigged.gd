extends SceneTree
## Dev tool (v0.8): bakes per-vertex data into the RE-RIGGED wanderer (assets/models/wanderer_rigged.glb)
## -> assets/models/wanderer_rigged_mesh.res, for wanderer.gdshader:
##  COLOR.r = rest height in the A-pose bind (0 hem .. 1 hood peak): the petrol hem stripe band
##  COLOR.g = distance from the body axis / 0.5
##  COLOR.b = 1 on the marble face (from the albedo texture)
##  COLOR.a = cloth carried by the spring chains (Hem / Sleeve / Scarf bones): only a light wind breath
##            in the shader now, the bones move the cloth
##  UV2 = embroidery band coords (3 hood rim, 4 left cuff, 5 right cuff). The cuff and rim rules were
##        written for the ORIGINAL T-pose model, so they are computed on assets/models/wanderer.glb and
##        transferred by vertex index (the re-rig keeps the vertex order).
## godot --headless --path . -s tests/prep_wanderer_rigged.gd
const ARM_L := ["L_Clavicle", "L_Upperarm", "L_UpperarmTwist01", "L_UpperarmTwist02", "L_Forearm", "L_ElbowShareBone", "L_ForearmTwist01", "L_ForearmTwist02", "L_Hand"]

func _init() -> void:
	# ---- the original (T-pose) model: marble, embroidery bands
	var n0: Node = (load("res://assets/models/wanderer.glb") as PackedScene).instantiate()
	var sk0: Skeleton3D = n0.find_children("*", "Skeleton3D", true, false)[0]
	var mi0: MeshInstance3D = n0.find_children("*", "MeshInstance3D", true, false)[0]
	var a0 := mi0.mesh.surface_get_arrays(0)
	var V0: PackedVector3Array = a0[Mesh.ARRAY_VERTEX]
	var UV: PackedVector2Array = a0[Mesh.ARRAY_TEX_UV]
	var B0: PackedInt32Array = a0[Mesh.ARRAY_BONES]
	var W0: PackedFloat32Array = a0[Mesh.ARRAY_WEIGHTS]
	var bind0 := []
	for i in mi0.skin.get_bind_count():
		var nm := mi0.skin.get_bind_name(i)
		bind0.append(sk0.find_bone(nm) if nm != "" else mi0.skin.get_bind_bone(i))
	var img := Image.load_from_file(ProjectSettings.globalize_path("res://assets/models/" + _find("rgb")))
	var per := B0.size() / V0.size()
	var set_l := {}; var set_r := {}
	for x in ARM_L:
		set_l[sk0.find_bone(x)] = true
		set_r[sk0.find_bone("R" + x.substr(1))] = true
	var heads := {}
	for x in ["Head", "FacialBone", "L_Eye", "R_Eye", "NeckTwist02"]: heads[sk0.find_bone(x)] = true
	var marble := PackedByteArray(); marble.resize(V0.size())
	var arm_w := [PackedFloat32Array(), PackedFloat32Array()]
	for s in 2: arm_w[s].resize(V0.size())
	var head_w := PackedFloat32Array(); head_w.resize(V0.size())
	var fx := []; var fy := []
	for i in V0.size():
		var c := img.get_pixelv(Vector2i(clampi(int(UV[i].x * img.get_width()), 0, img.get_width() - 1), clampi(int(UV[i].y * img.get_height()), 0, img.get_height() - 1)))
		var m := c.get_luminance() > 0.5 and V0[i].y > 0.7
		marble[i] = 1 if m else 0
		if m: fx.append(V0[i].x); fy.append(V0[i].y)
		for k in per:
			var bi: int = bind0[B0[i * per + k]]
			if set_l.has(bi): arm_w[0][i] += W0[i * per + k]
			if set_r.has(bi): arm_w[1][i] += W0[i * per + k]
			if heads.has(bi): head_w[i] += W0[i * per + k]
	fx.sort(); fy.sort()
	var cx: float = (fx[int(fx.size() * 0.02)] + fx[int(fx.size() * 0.98)]) * 0.5
	var ax: float = (fx[int(fx.size() * 0.98)] - fx[int(fx.size() * 0.02)]) * 0.5
	var cy: float = (fy[int(fy.size() * 0.02)] + fy[int(fy.size() * 0.98)]) * 0.5
	var ay: float = (fy[int(fy.size() * 0.98)] - fy[int(fy.size() * 0.02)]) * 0.5
	var uv2 := PackedVector2Array(); uv2.resize(V0.size())
	var rim_n := 0; var cuff_n := [0, 0]
	for i in V0.size():
		var v := V0[i]
		var band := Vector2.ZERO
		if marble[i] == 0 and head_w[i] > 0.5 and v.z > 0.10:
			var d := Vector2((v.x - cx) / ax, (v.y - cy) / ay)
			var rho := d.length()
			if rho > 1.04 and rho < 1.36:
				band = Vector2(3.0 + (rho - 1.04) / 0.3201, fposmod(atan2(d.y, d.x) / TAU, 1.0))
				rim_n += 1
		for s in 2:
			if arm_w[s][i] > 0.5:
				var sx := v.x * (1.0 if s == 0 else -1.0)
				if sx > 0.300 and sx < 0.335:
					band = Vector2(4.0 + s + (sx - 0.300) / 0.03501, fposmod(-atan2(v.z - 0.16, v.y - 0.66) / TAU, 1.0))
					cuff_n[s] += 1
		uv2[i] = band
	# ---- the re-rigged model: everything else, from its own A-pose bind
	var n1: Node = (load("res://assets/models/wanderer_rigged.glb") as PackedScene).instantiate()
	var sk1: Skeleton3D = n1.find_children("*", "Skeleton3D", true, false)[0]
	var mi1: MeshInstance3D = n1.find_children("*", "MeshInstance3D", true, false)[0]
	var a := mi1.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	assert(V.size() == V0.size())
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
	var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
	var cloth := {}
	var re := RegEx.create_from_string("^(Hem|Sleeve|Scarf)")
	for i in mi1.skin.get_bind_count():
		var nm := mi1.skin.get_bind_name(i)
		if nm == "": nm = sk1.get_bone_name(mi1.skin.get_bind_bone(i))
		if re.search(nm): cloth[i] = true
	var per1 := B.size() / V.size()
	var col := PackedColorArray(); col.resize(V.size())
	for i in V.size():
		var v := V[i]
		var cw := 0.0
		for k in per1:
			if cloth.has(B[i * per1 + k]): cw += W[i * per1 + k]
		var r := Vector2(v.x, v.z - 0.085).length()
		col[i] = Color(clampf(v.y, 0.0, 1.0), clampf(r / 0.5, 0.0, 1.0), float(marble[i]), clampf(cw, 0.0, 1.0))
	print("rim verts ", rim_n, " cuffs ", cuff_n, " cloth-bone binds ", cloth.size())
	a[Mesh.ARRAY_COLOR] = col
	a[Mesh.ARRAY_TEX_UV2] = uv2
	var am := ArrayMesh.new()
	var fmt: int = mi1.mesh.surface_get_format(0) & ~Mesh.ARRAY_FLAG_COMPRESS_ATTRIBUTES
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a, [], {}, fmt | Mesh.ARRAY_FORMAT_COLOR | Mesh.ARRAY_FORMAT_TEX_UV2)
	am.surface_set_material(0, mi1.mesh.surface_get_material(0))
	print(ResourceSaver.save(am, "res://assets/models/wanderer_rigged_mesh.res", ResourceSaver.FLAG_COMPRESS))
	n0.free(); n1.free()
	quit()

func _find(key: String) -> String:
	for f in DirAccess.get_files_at("res://assets/models"):
		if key in f and f.ends_with(".jpg"): return f
	return ""
