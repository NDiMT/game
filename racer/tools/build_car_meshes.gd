## Converts the raw .bin meshes from tools/split_car.py into Godot ArrayMesh resources (with tangents).
## Wheel anchors/radius from <name>_meta.json are stored as metadata on the body mesh.
## godot --headless --path racer --script res://tools/build_car_meshes.gd -- <bin_dir> <name>
extends SceneTree

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var src: String = args[0]
	var car: String = args[1] if args.size() > 1 else "car1"
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/cars/%s_meta.json" % car))
	for part in ["body", "wheel_front", "wheel_rear"]:
		var n := "%s_%s" % [car, part]
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
		# glTF front faces are CCW, Godot's are CW: flip winding
		for t in range(0, ni, 3):
			st.add_index(idx[t]); st.add_index(idx[t + 2]); st.add_index(idx[t + 1])
		st.generate_tangents()
		var mesh := st.commit()
		if part == "body":
			var anchors := PackedVector3Array()
			for k in ["FL", "FR", "RL", "RR"]:
				var a: Array = meta["anchors"][k]
				anchors.append(Vector3(a[0], a[1], a[2]))
			mesh.set_meta("anchors", anchors)            # axle centres (model units, front = +Z)
			mesh.set_meta("radius_front", float(meta["radius_front"]))
			mesh.set_meta("radius_rear", float(meta["radius_rear"]))
			mesh.set_meta("wheel_source_side", -1)       # kept wheels are the x<0 ones
		var out := "res://assets/cars/%s.res" % n
		var err := ResourceSaver.save(mesh, out, ResourceSaver.FLAG_COMPRESS)
		print(n, ": ", nv, " verts ", ni / 3, " tris -> ", out, " err=", err)
	quit(0)
