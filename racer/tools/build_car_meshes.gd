## Converts the raw .bin meshes from tools/split_car.py into Godot ArrayMesh resources (with tangents).
## godot --headless --path racer --script res://tools/build_car_meshes.gd -- <bin_dir>
extends SceneTree

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var src: String = args[0] if args.size() > 0 else "res://assets/cars"
	for n in ["car1_body", "car1_wheel"]:
		var f := FileAccess.open(src.path_join(n + ".bin"), FileAccess.READ)
		if f == null:
			push_error("missing " + n); quit(1); return
		var nv := f.get_32()
		var ni := f.get_32()
		var pos := f.get_buffer(nv * 12).to_float32_array()
		var nrm := f.get_buffer(nv * 12).to_float32_array()
		var uv := f.get_buffer(nv * 8).to_float32_array()
		var idx := f.get_buffer(ni * 4).to_int32_array()
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for i in nv:
			st.set_normal(Vector3(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]))
			st.set_uv(Vector2(uv[i * 2], uv[i * 2 + 1]))
			st.add_vertex(Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))
		# glTF is CCW front faces, Godot expects CW: flip winding
		for t in range(0, ni, 3):
			st.add_index(idx[t]); st.add_index(idx[t + 2]); st.add_index(idx[t + 1])
		st.generate_tangents()
		var mesh := st.commit()
		var out := "res://assets/cars/%s.res" % n
		var err := ResourceSaver.save(mesh, out, ResourceSaver.FLAG_COMPRESS)
		print(n, ": ", nv, " verts ", ni / 3, " tris -> ", out, " err=", err)
	quit(0)
