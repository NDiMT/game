extends SceneTree
## (a7) the new HeroineRig's per-frame cost: godot --headless --fixed-fps 60 --path . -s dev_rig/a7/bench.gd
func _init() -> void:
	var root := Node3D.new()
	get_root().add_child.call_deferred(root)
	await process_frame
	var her := HeroineRig.new()
	root.add_child(her)
	var pose := Figure.Pose.new()
	var us := PackedInt64Array()
	for f in 900:
		if f == 100: her.set_locomotion(1.2)
		if f == 300: her.set_locomotion(NAN); her.play("reach", {"at": her.global_position + Vector3(0.1, 0.8, -0.4)})
		if f == 400: her.play("pickup")
		if f == 500: her.hold("lamp"); her.look_at_point(Vector3(1, 1, -2))
		if f == 600: her.aim_hand("L", her.global_position + Vector3(0.3, 0.7, -0.3), Vector3(0, 0, 1))
		her.position.z -= 0.02 if (f > 650 and f < 800) else 0.0
		var t0 := Time.get_ticks_usec()
		her.apply_pose(pose, 0.0, false)
		us.append(Time.get_ticks_usec() - t0)
		await process_frame
	var s := 0
	var mx := 0
	for v in us.slice(10):
		s += v
		mx = maxi(mx, v)
	print("BENCH apply_pose avg %.0f us  max %d us" % [float(s) / (us.size() - 10), mx])
	quit()
