extends SceneTree
## Dev tool: bakes per-vertex data into the wanderer mesh (assets/models/wanderer_mesh.res).
##  COLOR.r = rest height (0 hem .. 1 hood peak), COLOR.g = distance from the body axis / 0.5,
##  COLOR.b = 1 on the marble face, COLOR.a = cloth that flutters (scarf / sleeve tatters)
##  UV2 = embroidery band coords (band + v, u): 3 hood rim, 4 left cuff, 5 right cuff (0 = none).
## godot --headless --path . -s tests/prep_wanderer.gd
const ARM_L := ["L_Clavicle", "L_Upperarm", "L_UpperarmTwist01", "L_UpperarmTwist02", "L_Forearm", "L_ElbowShareBone", "L_ForearmTwist01", "L_ForearmTwist02", "L_Hand"]

func _init() -> void:
	var sc: PackedScene = load("res://assets/models/wanderer.glb")
	var n := sc.instantiate()
	var sk: Skeleton3D = n.find_children("*", "Skeleton3D", true, false)[0]
	var mi: MeshInstance3D = n.find_children("*", "MeshInstance3D", true, false)[0]
	var a := mi.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var UV: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
	var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
	var skin := mi.skin
	var bind_bone := []
	for i in skin.get_bind_count():
		var nm := skin.get_bind_name(i)
		bind_bone.append(sk.find_bone(nm) if nm != "" else skin.get_bind_bone(i))
	var img := Image.load_from_file(ProjectSettings.globalize_path("res://assets/models/" + _find("rgb")))
	var nb := V.size() / 1
	var per := B.size() / V.size()
	var col := PackedColorArray(); col.resize(V.size())
	var uv2 := PackedVector2Array(); uv2.resize(V.size())
	var marble := PackedByteArray(); marble.resize(V.size())
	var arm_w := [PackedFloat32Array(), PackedFloat32Array()]
	for s in 2: arm_w[s].resize(V.size())
	var names_l := ARM_L
	var names_r := ARM_L.map(func(x: String) -> String: return "R" + x.substr(1))
	var set_l := {}; var set_r := {}
	for x in names_l: set_l[sk.find_bone(x)] = true
	for x in names_r: set_r[sk.find_bone(x)] = true
	var head := sk.find_bone("Head")
	var head_w := PackedFloat32Array(); head_w.resize(V.size())
	var heads := {}
	for x in ["Head", "FacialBone", "L_Eye", "R_Eye", "NeckTwist02"]: heads[sk.find_bone(x)] = true
	var fx := []; var fy := []
	for i in V.size():
		var c := img.get_pixelv(Vector2i(clampi(int(UV[i].x * img.get_width()), 0, img.get_width() - 1), clampi(int(UV[i].y * img.get_height()), 0, img.get_height() - 1)))
		var m := c.get_luminance() > 0.5 and V[i].y > 0.7
		marble[i] = 1 if m else 0
		if m: fx.append(V[i].x); fy.append(V[i].y)
		for k in per:
			var bi: int = bind_bone[B[i * per + k]]
			if set_l.has(bi): arm_w[0][i] += W[i * per + k]
			if set_r.has(bi): arm_w[1][i] += W[i * per + k]
			if heads.has(bi): head_w[i] += W[i * per + k]
	fx.sort(); fy.sort()
	var cx: float = (fx[int(fx.size() * 0.02)] + fx[int(fx.size() * 0.98)]) * 0.5
	var ax: float = (fx[int(fx.size() * 0.98)] - fx[int(fx.size() * 0.02)]) * 0.5
	var cy: float = (fy[int(fy.size() * 0.02)] + fy[int(fy.size() * 0.98)]) * 0.5
	var ay: float = (fy[int(fy.size() * 0.98)] - fy[int(fy.size() * 0.02)]) * 0.5
	var zs := []
	for i in V.size():
		if marble[i] == 1: zs.append(V[i].z)
	zs.sort()
	print("face z range ", zs[2], " ", zs[zs.size() - 3])
	print("marble verts ", fx.size(), " face c=", Vector2(cx, cy), " half=", Vector2(ax, ay))
	var rim_n := 0; var cuff_n := [0, 0]
	for i in V.size():
		var v := V[i]
		var r := Vector2(v.x, v.z - 0.085).length()
		var flutter := 0.0
		# scarf: hangs from the neck to the figure's right (-x) and back; sleeves: the tattered drape
		if v.y < 0.7 and v.y > 0.12 and (v.x < -0.08 and v.z < 0.08): flutter = 1.0
		flutter = maxf(flutter, smoothstep(0.25, 0.5, maxf(arm_w[0][i], arm_w[1][i])) * smoothstep(0.66, 0.45, v.y))
		col[i] = Color(clampf(v.y, 0.0, 1.0), clampf(r / 0.5, 0.0, 1.0), float(marble[i]), flutter)
		var band := Vector2.ZERO
		# hood rim: cloth just outside the face opening, on the front of the hood
		if marble[i] == 0 and head_w[i] > 0.5 and v.z > 0.10:
			var d := Vector2((v.x - cx) / ax, (v.y - cy) / ay)
			var rho := d.length()
			if rho > 1.04 and rho < 1.36:
				var u := fposmod(atan2(d.y, d.x) / TAU, 1.0)
				band = Vector2(3.0 + (rho - 1.04) / 0.3201, u)
				rim_n += 1
		# cuffs: a ring round each sleeve just beyond the wrist (rest T-pose: arms along +-x)
		for s in 2:
			if arm_w[s][i] > 0.5:
				var sx := v.x * (1.0 if s == 0 else -1.0)
				if sx > 0.300 and sx < 0.335:
					var dz := v.z - 0.16
					var dy := v.y - 0.66
					var u := fposmod(-atan2(dz, dy) / TAU, 1.0)
					band = Vector2(4.0 + s + (sx - 0.300) / 0.03501, u)
					cuff_n[s] += 1
		uv2[i] = band
	var sc_n := 0; var sc_arm := 0.0
	for i in V.size():
		var v := V[i]
		if v.x < -0.10 and v.z < 0.02 and v.y < 0.70 and v.y > 0.1:
			sc_n += 1; sc_arm += arm_w[1][i]
	print("scarf-ish verts ", sc_n, " mean right-arm weight ", sc_arm / maxf(sc_n, 1))
	# re-skin the scarf: it was weighted to the right arm (it followed the sleeve when the arm was
	# lowered); blend it onto Spine02 so it hangs from the chest and is animated in the shader
	var sp_bind := bind_bone.find(sk.find_bone("Spine02"))
	var moved := 0
	for i in V.size():
		var v := V[i]
		var k := smoothstep(0.03, -0.05, v.z) * smoothstep(-0.06, -0.14, v.x) * smoothstep(0.74, 0.66, v.y) * smoothstep(0.08, 0.14, v.y)
		if k <= 0.0: continue
		moved += 1
		var lo := 0
		for j in per:
			if B[i * per + j] == sp_bind: lo = j; break
			if W[i * per + j] < W[i * per + lo]: lo = j
		var tot := 0.0
		for j in per:
			if j != lo:
				W[i * per + j] *= 1.0 - k
				tot += W[i * per + j]
		B[i * per + lo] = sp_bind
		W[i * per + lo] = 1.0 - tot
	a[Mesh.ARRAY_BONES] = B
	a[Mesh.ARRAY_WEIGHTS] = W
	print("scarf re-skinned verts ", moved, " spine02 bind ", sp_bind)
	print("rim verts ", rim_n, " cuffs ", cuff_n)
	a[Mesh.ARRAY_COLOR] = col
	a[Mesh.ARRAY_TEX_UV2] = uv2
	var am := ArrayMesh.new()
	var fmt: int = mi.mesh.surface_get_format(0) & ~Mesh.ARRAY_FLAG_COMPRESS_ATTRIBUTES
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a, [], {}, fmt | Mesh.ARRAY_FORMAT_COLOR | Mesh.ARRAY_FORMAT_TEX_UV2)
	am.surface_set_material(0, mi.mesh.surface_get_material(0))
	print("fmt in ", mi.mesh.surface_get_format(0), " out ", am.surface_get_format(0))
	print(ResourceSaver.save(am, "res://assets/models/wanderer_mesh.res", ResourceSaver.FLAG_COMPRESS))
	quit()

func _find(key: String) -> String:
	for f in DirAccess.get_files_at("res://assets/models"):
		if key in f and f.ends_with(".jpg"): return f
	return ""
