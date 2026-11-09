extends SceneTree
## (a6) the cost of HeroineRig.apply_pose (the whole per-frame rig solve) under a clip with both arms on IK + palms
func _init() -> void:
	var h := HeroineRig.new()
	root.add_child(h)
	var p := Figure.Pose.new()
	await process_frame
	h.play("look_hands")
	h.set_locomotion(1.0)
	var worst := 0
	var tot := 0
	for f in 240:
		await process_frame
		var t0 := Time.get_ticks_usec()
		h.apply_pose(p, 0.0, false)
		var d := Time.get_ticks_usec() - t0
		tot += d
		worst = maxi(worst, d)
	print("PERF apply_pose avg %d us worst %d us" % [tot / 240, worst])
	quit()
