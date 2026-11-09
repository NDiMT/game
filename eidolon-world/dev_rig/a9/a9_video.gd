extends Node3D
## (a9, Agent A) the deformation review: BEFORE (a7 rig, dev_rig/a9/heroine_v2_before.glb) | AFTER (a9: arm helpers,
## the gown cage) side by side, the same clip and the same close-up camera on each.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --fixed-fps 30 --write-movie /abs/a9.avi --resolution 1280x720 \
##     res://dev_rig/a9/a9_video.tscn
##   ffmpeg -i /abs/a9.avi -c:v libx264 -pix_fmt yuv420p -crf 22 dev/shots/a9-deform-review.mp4
## (--sheet=/abs/x.png --at=clip:t,...: one still per clip/time instead, BEFORE | AFTER per tile)
const BEFORE_GLB := "res://dev_rig/a9/heroine_v2_before.glb"
const BEFORE_MESH := "res://dev_rig/a9/heroine_v2_mesh_before.res"
var rigs: Array[HeroineRig] = []
var cams: Array[Camera3D] = []
var labels: Array[Label] = []
var pose := Figure.Pose.new()
var view := {"ctr": Vector3(0, 0.62, 0), "h": 1.55, "yaw": 0.6}

func _ready() -> void:
	_look()
	var hb := HBoxContainer.new()
	hb.set_anchors_preset(Control.PRESET_FULL_RECT)
	hb.add_theme_constant_override("separation", 4)
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
		var lb := Label.new()
		lb.position = Vector2(14, 8)
		lb.add_theme_font_size_override("font_size", 24)
		lb.add_theme_color_override("font_color", Color(1, 0.9, 0.85))
		lb.add_theme_color_override("font_outline_color", Color(0, 0, 0))
		lb.add_theme_constant_override("outline_size", 6)
		svc.add_child(lb)
		labels.append(lb)
	var keep_m := HeroineRig.model
	var keep_b := HeroineRig.body_mesh
	HeroineRig.model = load(BEFORE_GLB)
	HeroineRig.body_mesh = load(BEFORE_MESH)
	rigs.append(HeroineRig.new())
	HeroineRig.model = keep_m if keep_m else load(HeroineRig.MODEL)
	HeroineRig.body_mesh = keep_b if keep_b else load(HeroineRig.MESH)
	rigs.append(HeroineRig.new())
	for i in 2:
		rigs[i].position = Vector3(-40.0 if i == 0 else 40.0, 0, 0)
		add_child(rigs[i])
	await get_tree().process_frame
	var sheet := ""
	var at := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--sheet="): sheet = a.substr(8)
		if a.begins_with("--at="): at = a.substr(5)
	if sheet != "":
		await _sheet(sheet, at)
	else:
		await _run()
	get_tree().quit()

func _look() -> void:
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.36, 0.36, 0.40)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.32, 0.32, 0.36)
	env.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.75, 0.6, 0)
	sun.light_energy = 0.9
	sun.shadow_enabled = true
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation = Vector3(-0.3, -2.4, 0)
	fill.light_energy = 0.5
	add_child(fill)
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(200, 30)
	fl.mesh = pm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.3, 0.3, 0.32)
	fl.material_override = m
	add_child(fl)

func _frames(n: int) -> void:
	for f in n:
		for r in rigs: r.apply_pose(pose, 0.0, false)
		_aim()
		await get_tree().process_frame

func _aim() -> void:
	for i in 2:
		var c := cams[i]
		var t: Transform3D = rigs[i].global_transform
		var yaw: float = view["yaw"]
		var dir := Vector3(sin(yaw), 0.12, -cos(yaw)).normalized()
		var ctr: Vector3 = t * (view["ctr"] as Vector3)
		c.projection = Camera3D.PROJECTION_ORTHOGONAL
		c.size = view["h"]
		c.position = ctr + t.basis * dir * 6.0
		c.look_at(ctr, Vector3.UP)

func _say(s: String) -> void:
	labels[0].text = "BEFORE (a7)   " + s
	labels[1].text = "AFTER (a9)   " + s

func _play(nm: String) -> float:
	var ln := 0.0
	for r in rigs:
		var o := {}
		var at_d: Dictionary = HeroineRig.AT_DEFAULT
		if at_d.has(nm): o["at"] = r.rig.global_transform * (at_d[nm] as Vector3)
		ln = r.play(nm, o)
	return ln

func _walk(sp: float) -> void:
	for r in rigs: r.set_locomotion(sp)

func _clip(nm: String, ctr: Vector3, h: float, yaw: float, label: String) -> void:
	view = {"ctr": ctr, "h": h, "yaw": yaw}
	_say(label)
	for r in rigs: r.stop(0.2)
	await _frames(8)
	var ln := _play(nm)
	await _frames(int((ln + 0.25) * 30.0))

func _run() -> void:
	view = {"ctr": Vector3(0, 0.6, 0), "h": 1.45, "yaw": 1.1}
	_say("idle")
	await _frames(30)
	_walk(1.4)
	_say("walk 1.4 m/s")
	await _frames(75)
	view = {"ctr": Vector3(0, 0.36, 0), "h": 0.78, "yaw": 1.57}
	_say("walk 1.4 - hips, legs, gown (side)")
	await _frames(120)
	view = {"ctr": Vector3(0, 0.36, 0), "h": 0.78, "yaw": 0.35}
	_say("walk 1.4 - gown, hem (front)")
	await _frames(90)
	view = {"ctr": Vector3(0, 0.72, 0), "h": 0.62, "yaw": 0.6}
	_say("walk 1.4 - shoulders, elbows")
	await _frames(60)
	_walk(0.0)
	await _frames(20)
	_walk(NAN)
	await _clip("reach", Vector3(0.1, 0.78, -0.05), 0.55, 0.5, "reach - shoulder, elbow")
	await _clip("reach", Vector3(0.1, 0.78, -0.05), 0.55, 1.75, "reach - side")
	await _clip("pickup", Vector3(0.05, 0.4, -0.12), 0.8, 0.5, "pickup - elbows, hips, gown")
	await _clip("pickup", Vector3(0.05, 0.4, -0.12), 0.8, 1.6, "pickup - side")
	await _clip("kneel_touch", Vector3(0.0, 0.35, -0.12), 0.8, 0.6, "kneel_touch - knees, hem")
	await _clip("kneel_touch", Vector3(0.0, 0.35, -0.12), 0.8, 2.3, "kneel_touch - back")
	await _clip("hang_weight", Vector3(0.0, 0.8, 0.0), 0.55, 0.4, "hang_weight - shoulders, elbows")
	await _clip("touch_glass", Vector3(-0.1, 0.8, -0.05), 0.55, -0.5, "touch_glass - shoulder, elbow")
	view = {"ctr": Vector3(-0.08, 0.78, 0), "h": 0.55, "yaw": -0.7}
	_say("hold_lamp - elbow, forearm")
	for r in rigs: r.hold("lamp")
	await _frames(70)
	for r in rigs: r.hold("")
	await _frames(10)
	await _clip("sit_bench", Vector3(0, 0.5, 0), 1.1, 1.0, "sit_bench")
	await _clip("turn_half", Vector3(0, 0.55, 0), 1.25, 0.6, "turn_half")

## one still per clip:time (BEFORE | AFTER per tile), the view per entry: clip:t[:cx,cy,cz,h,yaw]
func _sheet(path: String, at: String) -> void:
	var imgs: Array[Image] = []
	for spec in at.split(";"):
		var p := spec.split(":")
		view = {"ctr": Vector3(0, 0.6, 0), "h": 1.45, "yaw": 0.6}
		if p.size() > 2:
			var z := p[2].split(",")
			view = {"ctr": Vector3(float(z[0]), float(z[1]), float(z[2])), "h": float(z[3]), "yaw": float(z[4])}
		_say(p[0] + " " + p[1])
		var t := float(p[1])
		if p[0].begins_with("walk"):
			_walk(float(p[0].substr(4)) if p[0].length() > 4 else 1.4)
		else:
			_play(p[0])
		await _frames(int(t * 30.0) + 1)
		await RenderingServer.frame_post_draw
		imgs.append(get_viewport().get_texture().get_image())
		_walk(0.0); await _frames(20); _walk(NAN)
		for r in rigs: r.stop(0.0)
		await _frames(15)
	var w := imgs[0].get_width(); var h := imgs[0].get_height()
	var cols := 2
	var rows := (imgs.size() + cols - 1) / cols
	var out := Image.create(w * cols, h * rows, false, imgs[0].get_format())
	for i in imgs.size():
		out.blit_rect(imgs[i], Rect2i(0, 0, w, h), Vector2i((i % cols) * w, (i / cols) * h))
	out.save_png(path)
