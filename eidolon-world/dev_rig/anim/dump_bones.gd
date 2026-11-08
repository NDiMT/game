extends SceneTree
func _init() -> void:
	for path in ["res://assets/models/heroine_v1_rigged.glb", "res://assets/models/warden_rigged.glb"]:
		var r: Node = (load(path) as PackedScene).instantiate()
		var sk: Skeleton3D = r.find_children("*", "Skeleton3D", true, false)[0]
		print(path, " bones=", sk.get_bone_count())
		for i in sk.get_bone_count():
			var n := sk.get_bone_name(i)
			if n.begins_with("Hem") or n.begins_with("Veil") or n.begins_with("Cape"): continue
			var p := sk.get_bone_parent(i)
			print("  ", i, " ", n, " <- ", sk.get_bone_name(p) if p >= 0 else "-", " ", sk.get_bone_global_rest(i).origin.snapped(Vector3.ONE*0.001))
		var ap := r.find_child("AnimationPlayer", true, false)
		if ap: print("  anims: ", (ap as AnimationPlayer).get_animation_list())
		print("  xf skel node: ", sk.transform, " parent chain ", sk.get_parent().name)
	quit()
