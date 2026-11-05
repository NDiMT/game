extends SceneTree
## (Agent A, dev) look at an item GLB from 4 sides, and render its 128 px transparent inventory icon.
##   xvfb-run /opt/godot/godot --path . --rendering-driver opengl3 -s res://dev_rig/tools/item_view.gd -- \
##       --glb=/abs/model.glb --out=/abs/prefix [--icon=/abs/icon.png] [--yaw=deg] [--pitch=deg]
var glb := ""
var out := ""
var icon := ""
var yaw := 30.0
var pitch := -25.0
var frame := 0
var vp: SubViewport
var cam: Camera3D
var piv: Node3D
var views := [[0.0, 0.0], [90.0, 0.0], [0.0, -89.0], [180.0, 0.0]]
var vi := 0

func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		if kv.size() < 2: continue
		match kv[0]:
			"glb": glb = kv[1]
			"out": out = kv[1]
			"icon": icon = kv[1]
			"yaw": yaw = float(kv[1])
			"pitch": pitch = float(kv[1])
	vp = SubViewport.new()
	vp.size = Vector2i(512, 512)
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.75, 0.75, 0.8)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new(); we.environment = env; vp.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, 35, 0); sun.light_energy = 1.3; vp.add_child(sun)
	var fill := DirectionalLight3D.new(); fill.rotation_degrees = Vector3(-20, -140, 0); fill.light_energy = 0.4; vp.add_child(fill)
	piv = Node3D.new(); vp.add_child(piv)
	var doc := GLTFDocument.new(); var st := GLTFState.new()
	if doc.append_from_file(glb, st) != OK: push_error("glb load failed"); quit(1); return
	var model := doc.generate_scene(st) as Node3D
	piv.add_child(model)
	var ab := AABB(); var first := true
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var b := m.global_transform * m.get_aabb() if m.is_inside_tree() else m.get_aabb()
		ab = b if first else ab.merge(b); first = false
	model.position = -ab.get_center()
	print("aabb ", ab)
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = ab.size.length() * 1.05
	vp.add_child(cam)

func _set_view(y: float, p: float) -> void:
	var b := Basis.from_euler(Vector3(deg_to_rad(p), deg_to_rad(y), 0))
	cam.global_transform = Transform3D(b, b.z * 10.0)

func _process(_dt: float) -> bool:
	frame += 1
	if frame == 1: _set_view(views[0][0], views[0][1])
	if frame > 3 and frame % 3 == 0:
		var img := vp.get_texture().get_image()
		if vi < views.size():
			img.save_png("%s_v%d.png" % [out, vi])
			vi += 1
			if vi < views.size(): _set_view(views[vi][0], views[vi][1])
			else:
				_set_view(yaw, pitch); cam.size *= 0.86
		else:
			if icon != "":
				img.resize(128, 128, Image.INTERPOLATE_LANCZOS); img.save_png(icon)
			else: img.save_png("%s_icon.png" % out)
			return true
	return false
