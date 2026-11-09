extends Node
## (a7, Agent A) the anim review video: every heroine clip (3/4 front | side), the walk, close-ups (elbows / shoulders /
## the hips and the gown / the veil) and the Warden (walk, look, the grab). Driven by a7_demo.tscn -- --video:
##   xvfb-run -a godot --path . --rendering-driver opengl3 --fixed-fps 30 --write-movie /abs/a7.avi --resolution 1280x720 \
##     res://dev_rig/a7/a7_demo.tscn -- --video
##   ffmpeg -i /abs/a7.avi -c:v libx264 -pix_fmt yuv420p -crf 23 dev/shots/a7-anim-review.mp4
var her: HeroineRig
var wd: WardenRig
var pose := Figure.Pose.new()
var cams: Array[Camera3D] = []
var label: Label
var view := {"ctr": Vector3(0, 0.62, 0), "h": 1.55, "yaw": [0.6, 1.57]}
var _target: Node3D

func _ready() -> void:
	var hb := HBoxContainer.new()
	hb.set_anchors_preset(Control.PRESET_FULL_RECT)
	hb.add_theme_constant_override("separation", 0)
	var cl := CanvasLayer.new()
	add_child(cl)
	cl.add_child(hb)
	for i in 2:
		var svc := SubViewportContainer.new()
		svc.stretch = true
		svc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hb.add_child(svc)
		var v := SubViewport.new()
		v.msaa_3d = Viewport.MSAA_4X
		svc.add_child(v)
		var c := Camera3D.new()
		v.add_child(c)
		cams.append(c)
	label = Label.new()
	label.position = Vector2(16, 10)
	label.add_theme_font_size_override("font_size", 26)
	label.add_theme_color_override("font_color", Color(1, 0.9, 0.85))
	label.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	label.add_theme_constant_override("outline_size", 6)
	cl.add_child(label)
	her = HeroineRig.new()
	get_parent().add_child.call_deferred(her)
	await get_tree().process_frame
	await _run()
	get_tree().quit()

func _frames(n: int) -> void:
	for i in n:
		her.apply_pose(pose, 0.0, false)
		_aim()
		await get_tree().process_frame

func _aim() -> void:
	var tgt: Node3D = _target if _target else her
	for i in 2:
		var c := cams[i]
		var yaw: float = view["yaw"][i]
		var dir := Vector3(sin(yaw), 0.1, -cos(yaw)).normalized()
		var ctr: Vector3 = tgt.global_transform * (view["ctr"] as Vector3)
		c.projection = Camera3D.PROJECTION_ORTHOGONAL
		c.size = view["h"]
		c.position = ctr + tgt.global_transform.basis * dir * 6.0
		c.look_at(ctr, Vector3.UP)

func _say(s: String) -> void:
	label.text = s

func _full() -> void:
	view = {"ctr": Vector3(0, 0.62, 0), "h": 1.55, "yaw": [0.6, 1.57]}

func _run() -> void:
	_full()
	# --- the walk
	_say("idle")
	await _frames(40)
	for sp in [1.2, 1.95]:
		_say("walk %.2f m/s (speed-matched playback: no foot sliding)" % sp)
		her.set_locomotion(sp)
		await _frames(100)
	her.set_locomotion(0.0)
	_say("walk -> stop")
	await _frames(45)
	her.set_locomotion(NAN)
	# --- close-ups: the hips and the gown, the veil, in the walk
	view = {"ctr": Vector3(0, 0.45, 0), "h": 0.75, "yaw": [0.6, 1.57]}
	_say("close-up: hips + gown, walk 1.2")
	her.set_locomotion(1.2)
	await _frames(70)
	view = {"ctr": Vector3(0, 0.88, 0.02), "h": 0.55, "yaw": [2.6, 1.57]}
	_say("close-up: the veil from behind / the side, walk")
	await _frames(70)
	her.set_locomotion(0.0)
	await _frames(20)
	her.set_locomotion(NAN)
	# --- close-ups: elbows / shoulders in reach, pickup, kneel
	for cs in [["reach", Vector3(0.12, 0.72, -0.1), 0.6], ["pickup", Vector3(0.05, 0.35, -0.12), 0.75], ["kneel_touch", Vector3(0.0, 0.35, -0.1), 0.75]]:
		view = {"ctr": cs[1], "h": cs[2], "yaw": [0.5, 1.75]}
		_say("close-up: elbow / shoulder / hips - " + str(cs[0]))
		var at_d: Dictionary = HeroineRig.AT_DEFAULT
		var o := {}
		if at_d.has(cs[0]): o["at"] = her.rig.global_transform * (at_d[cs[0]] as Vector3)
		var ln := her.play(cs[0], o)
		await _frames(int((ln + 0.2) * 30.0))
	# --- every clip
	_full()
	var names: Array = HeroineClips.names()
	names.sort()
	for nm: String in names:
		if nm.begins_with("idle_"): continue
		_say(nm)
		if nm.begins_with("hold_"):
			her.hold(nm.substr(5))
			await _frames(50)
			if nm == "hold_lamp":
				_say("hold_lamp + walk")
				her.set_locomotion(1.2)
				await _frames(60)
				her.set_locomotion(0.0)
				await _frames(15)
				her.set_locomotion(NAN)
			her.hold("")
			await _frames(15)
			continue
		var at_d: Dictionary = HeroineRig.AT_DEFAULT
		var o := {}
		if at_d.has(nm): o["at"] = her.rig.global_transform * (at_d[nm] as Vector3)
		var ln := her.play(nm, o)
		await _frames(int((ln + 0.1) * 30.0))
	# --- the Warden
	her.position = Vector3(-0.22, 0, 0.62)
	wd = WardenRig.new()
	get_parent().add_child(wd)
	wd.position = Vector3(0.0, 0, 0.0)
	wd.rotation.y = 0.0
	_target = wd
	view = {"ctr": Vector3(-0.1, 0.82, 0.3), "h": 2.2, "yaw": [PI - 0.7, PI * 0.5]}
	_say("the Warden: idle")
	await _frames(60)
	_say("the Warden: walk (in place)")
	wd.walk(true)
	await _frames(90)
	wd.walk(false)
	_say("the Warden: look at her")
	wd.look_at_point(her.global_position + Vector3(0, 0.9, 0))
	await _frames(60)
	_say("the Warden: grab her arm")
	wd.grab(func() -> Vector3: return her.bone_world("R_Upperarm") + Vector3(0, 0.03, 0), "R", 1.0)
	her.play("flinch_seen")
	await _frames(90)
	_say("the Warden: let go")
	wd.ungrab(0.8)
	await _frames(45)
