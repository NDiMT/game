extends Node3D
## (Agent A, a6) before/after frames of the worst anatomy offenders, front + side, on the real HeroineRig.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --fixed-fps 60 res://dev_rig/a6/sheet.tscn -- --out=/abs/dir --tag=before|after
## then python3 dev_rig/a6/sheet.py <dir> dev/shots/a6-anim-sheet.png
const CASES := [
	["touch_glass", 1.1, "arm", null], ["statue_still", 1.9, "arm", null], ["look_hands", 1.4, "arm", null], ["hold_lamp", 1.2, "arm", null],
	["shard_eye", 1.0, "arm", null], ["aim R chest", 1.6, "arm", Vector3(-0.10, 1.25, 0.16)], ["flinch_seen", 0.6, "arm", null], ["kneel_touch", 1.75, "body", null]]
var out := "/tmp/a6"
var all := false
var one: PackedStringArray = []
var tag := "x"
var vp: Array[SubViewport] = []
var cams: Array[Camera3D] = []

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="): out = a.substr(6)
		if a.begins_with("--tag="): tag = a.substr(6)
		if a == "--all": all = true
		if a.begins_with("--one="): one = a.substr(6).split(":")     # clip:t:size:cy:x:z (a close-up, dev)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.16, 0.17, 0.2)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.55, 0.55, 0.6)
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.7, 0.5, 0)
	sun.light_energy = 1.3
	add_child(sun)
	for i in 2:
		var v := SubViewport.new()
		v.size = Vector2i(240, 320)
		v.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		v.own_world_3d = false
		add_child(v)
		var c := Camera3D.new()
		c.projection = Camera3D.PROJECTION_ORTHOGONAL
		v.add_child(c)
		vp.append(v)
		cams.append(c)
	await get_tree().process_frame
	var cases: Array = CASES
	if all:
		# (review) every clip at its hold point (or 45%), two 3/4 views
		cases = []
		var nms: Array = HeroineClips.names()
		nms.sort()
		for nm in nms:
			var c := HeroineClips.get_clip(nm)
			var ht: float = c["hold_t"]
			var body: bool = (c["ch"] as Dictionary).has("fw") or (c["ch"] as Dictionary).has("r")
			cases.append([nm, ht if ht > 0.0 else 0.45 * float(c["len"]), "body" if body else "arm", null])
	if one.size() >= 2: cases = [[one[0], float(one[1]), "one", null]]
	for ci in cases.size():
		var cs: Array = cases[ci]
		var her := HeroineRig.new()
		add_child(her)
		var pose := Figure.Pose.new()
		var nm: String = cs[0]
		if nm == "walk": her.set_locomotion(1.3)
		elif nm.begins_with("aim"): her.aim_hand("R", her.rig.global_transform * (cs[3] as Vector3), Vector3.ZERO, 1.0)
		elif nm.begins_with("hold_"): her.hold(nm.substr(5))
		else: her.play(nm)
		var n := int(float(cs[1]) * 60.0)
		for f in n:
			await get_tree().process_frame
			her.apply_pose(pose, 0.0, false)
		# the figure faces -z (the rig is turned): front camera on -z, side camera on her right (-x)
		var body: bool = cs[2] == "body"
		var cy := 0.55 if body else 0.78
		for k in 2:
			var c := cams[k]
			c.size = 1.25 if body else 0.78
			var pos := Vector3(0, cy, -3) if k == 0 else Vector3(3, cy, 0)      # front; her right side
			if all: pos = Vector3(-2.1, cy + 0.4, -2.1) if k == 0 else Vector3(2.1, cy + 0.4, -2.1)
			if one.size() >= 4:
				c.size = float(one[2])
				cy = float(one[3])
				var fx := float(one[4]) if one.size() > 4 else 0.0
				pos = Vector3(fx, cy, -3) if k == 0 else Vector3(-3, cy, float(one[5]) if one.size() > 5 else 0.0)
				c.look_at_from_position(pos, pos + (Vector3(0, 0, 3) if k == 0 else Vector3(3, 0, 0)))
				continue
			c.look_at_from_position(pos, Vector3(0, cy, 0))
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		for k in 2: vp[k].get_texture().get_image().save_png("%s/%s-%02d-%d.png" % [out, tag, ci, k] if all else "%s/%s-%d-%d.png" % [out, tag, ci, k])
		if all: print("CELL %02d %s" % [ci, cs[0]])
		her.queue_free()
		await get_tree().process_frame
	print("SHEET DONE ", tag)
	get_tree().quit()
