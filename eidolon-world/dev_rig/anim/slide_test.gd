extends SceneTree
## foot-slide check: drive a Figure like the player (accel 9, decel 12, yaw lerp 9) through walks at three speeds,
## turns while walking, a stop and a turn on the spot; measure how far each PLANTED foot drifts (world, cm).
##   godot --headless --fixed-fps 60 --path . -s dev_rig/anim/slide_test.gd
var fig: Figure
var t := 0.0
var v := 0.0
var yaw := 0.0
var pos := Vector3.ZERO
var last := [Vector3.INF, Vector3.INF]
var worst := {}
var steps := 0
func _initialize() -> void:
	HeroineRig.VARIANT = "v1"
	fig = Figure.new()
	root.add_child(fig)
	fig.rig.step.connect(func(_s: int) -> void: steps += 1)
func _seg() -> Array:
	# [speed, target yaw, name]
	if t < 1.0: return [0.0, 0.0, "idle"]
	if t < 4.0: return [1.0, 0.0, "walk1.0"]
	if t < 7.0: return [1.8, 0.0 if t < 5.5 else 1.2, "walk1.8+turn"]
	if t < 10.0: return [2.7, 1.2 if t < 8.5 else -0.5, "walk2.7+turn"]
	if t < 12.0: return [0.0, -0.5, "stop"]
	if t < 15.0: return [0.0, PI * 0.95 - 0.5, "turn_in_place"]
	return [0.0, PI * 0.95 - 0.5, "settle"]
func _process(dt: float) -> bool:
	t += dt
	var sg := _seg()
	var want: float = sg[0]
	v = move_toward(v, want, (9.0 if want > v else 12.0) * dt)
	yaw = lerp_angle(yaw, sg[1], 1.0 - exp(-dt * (9.0 if want > 0.0 else 4.0)))
	pos += Vector3(-sin(yaw), 0, -cos(yaw)) * v * dt
	if OS.get_environment("RAMP") != "": pos.y = clampf((pos.z + 2.0) * -0.6, 0.0, 4.0) if t < 7.0 else pos.y
	fig.position = pos
	fig.rotation.y = yaw
	var p := Figure.Pose.new()
	fig.apply_pose(p)
	var r := fig.rig
	for i in 2:
		var fw := r.bone_world("L_Foot" if i == 0 else "R_Foot")
		if r._feet[i]["sw"]:
			last[i] = Vector3.INF
			continue
		if last[i] != Vector3.INF:
			var d: float = (fw - last[i]).length() * 100.0
			var k: String = sg[2]
			worst[k] = maxf(worst.get(k, 0.0), d)
		last[i] = fw if last[i] == Vector3.INF else last[i]
	if t > 17.0:
		print("SLIDE max planted-foot drift per stance (cm, game scale): ", worst, "  steps=", steps)
		return true
	return false
