extends SceneTree
## (a6) check: HeroineRig.upright_node stays level (its up = world up) while the hand turns
func _init() -> void:
	var h := HeroineRig.new()
	root.add_child(h)
	h.rotation.y = 0.7
	var p := Figure.Pose.new()
	var n := h.upright_node("R")
	h.hold("lamp")
	var worst := 0.0
	for f in 300:
		await process_frame
		if f > 2: worst = maxf(worst, rad_to_deg(n.global_basis.y.normalized().angle_to(Vector3.UP)))   # (after the skeleton's update)
		if f == 120: h.set_locomotion(1.2)
		if f == 200: h.play("light_with_lamp")
		h.apply_pose(p, 0.0, false)
	print("UPRIGHT worst tilt %.2f deg, palm-to-node %.3f m" % [worst, n.global_position.distance_to(h.bone_world("R_Hand"))])
	quit()
