extends Node3D
## (a7, Agent A) the new heroine / Warden rigs in the game's look.
##   sheet:  xvfb-run -a godot --path . --rendering-driver opengl3 --fixed-fps 30 res://dev_rig/a7/a7_demo.tscn -- --sheet=reach:0.42,pickup:0.75 --out=/abs/x.png [--size=240x320] [--zoom=cx,cy,cz,h]
##   video:  ... --write-movie /abs/frames/f.png --resolution 1280x720 res://dev_rig/a7/a7_demo.tscn -- --video  (see _video())
var out := "/tmp/a7.png"
var size := Vector2i(240, 320)
var zoom := Vector4.ZERO                  # close-up: centre (model space of the figure, game metres) + view height
var vp: Array[SubViewport] = []
var cams: Array[Camera3D] = []
var her: HeroineRig
var pose := Figure.Pose.new()
var yaws := [0.6, 1.57]

func _env() -> void:
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.13, 0.13, 0.16)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.5, 0.5, 0.56)
	env.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.75, 0.6, 0)
	sun.light_energy = 1.4
	sun.shadow_enabled = true
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation = Vector3(-0.3, -2.4, 0)
	fill.light_energy = 0.45
	add_child(fill)
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(30, 30)
	fl.mesh = pm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.32, 0.31, 0.33)
	fl.material_override = m
	add_child(fl)

func _ready() -> void:
	var sheet := ""
	var video := false
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="): out = a.substr(6)
		if a.begins_with("--sheet="): sheet = a.substr(8)
		if a.begins_with("--size="):
			var p := a.substr(7).split("x")
			size = Vector2i(int(p[0]), int(p[1]))
		if a.begins_with("--zoom="):
			var z := a.substr(7).split(",")
			zoom = Vector4(float(z[0]), float(z[1]), float(z[2]), float(z[3]))
		if a.begins_with("--yaws="):
			yaws = Array(a.substr(7).split(",")).map(func(s: String) -> float: return float(s))
		if a == "--video": video = true
	_env()
	if video:
		var v: Node = load("res://dev_rig/a7/a7_video.gd").new()
		add_child(v)
		return
	her = HeroineRig.new()
	add_child(her)
	for i in yaws.size():
		var v := SubViewport.new()
		v.size = size
		v.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(v)
		var c := Camera3D.new()
		v.add_child(c)
		vp.append(v)
		cams.append(c)
	await get_tree().process_frame
	var imgs: Array[Image] = []
	for item in sheet.split(","):
		var p := item.split(":")
		var clip := p[0]
		var t := float(p[1]) if p.size() > 1 else 0.5
		her.stop(0.01)
		await _frames(20)
		if clip == "walk":
			her.set_locomotion(float(p[2]) if p.size() > 2 else 1.2)
			await _frames(int(t * 30.0) + 30)
		elif clip == "idle":
			her.set_locomotion(NAN)
			await _frames(int(t * 30.0))
		else:
			her.set_locomotion(NAN)
			var at_d: Dictionary = HeroineRig.AT_DEFAULT
			var opts := {}
			if at_d.has(clip):
				opts["at"] = her.rig.global_transform * (at_d[clip] as Vector3)
			if clip.begins_with("hold_"):
				her.hold(clip.substr(5))
				await _frames(int(t * 30.0) + 20)
			else:
				her.play(clip, opts)
				await _frames(int(round(t * 30.0)))
		for i in cams.size():
			_aim(cams[i], yaws[i])
		await RenderingServer.frame_post_draw
		for i in vp.size():
			imgs.append(vp[i].get_texture().get_image())
		her.hold("")
		her.set_locomotion(NAN)
	var cols := mini(imgs.size(), 8)
	var rows := ceili(imgs.size() / float(cols))
	var sheet_img := Image.create(size.x * cols, size.y * rows, false, Image.FORMAT_RGBA8)
	for i in imgs.size():
		imgs[i].convert(Image.FORMAT_RGBA8)
		sheet_img.blit_rect(imgs[i], Rect2i(Vector2i.ZERO, size), Vector2i((i % cols) * size.x, (i / cols) * size.y))
	sheet_img.save_png(out)
	print("SHEET ", out, " ", imgs.size())
	get_tree().quit()

func _frames(n: int) -> void:
	for i in n:
		her.apply_pose(pose, 0.0, false)
		await get_tree().process_frame

func _aim(c: Camera3D, yaw: float) -> void:
	var ctr := Vector3(0, 0.62, 0)
	var h := 1.5
	if zoom != Vector4.ZERO:
		ctr = Vector3(zoom.x, zoom.y, zoom.z)
		h = zoom.w
	# the figure faces -z (the rig is turned): "front" = the camera on -z
	var dir := Vector3(sin(yaw), 0.12, -cos(yaw)).normalized()
	c.projection = Camera3D.PROJECTION_ORTHOGONAL
	c.size = h
	c.position = her.global_transform * ctr + dir * 6.0
	c.look_at(her.global_transform * ctr, Vector3.UP)
