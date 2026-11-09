extends Node3D
var players: Array[AnimationPlayer] = []
var label: Label
var seq := [["idle", 5.0], ["walk", 9.47], ["idle", 3.0]]
var views := [["front 3/4", -1.25, -1.5708 + 0.6], ["side", 0.0, 0.0], ["back 3/4", 1.25, 1.5708 + 0.6]]

func _ready() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.42, 0.43, 0.47)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1, 1, 1)
	env.ambient_light_energy = 0.75
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation = Vector3(-0.7, 0.5, 0); sun.light_energy = 1.3; add_child(sun)
	var cam := Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.size = 2.15
	cam.position = Vector3(0, 0.95, 6); add_child(cam); cam.current = true
	var fl := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(12, 6); fl.mesh = pm
	var fm := StandardMaterial3D.new(); fm.albedo_color = Color(0.36, 0.37, 0.41); fl.material_override = fm; add_child(fl)
	var doc := GLTFDocument.new()
	for v in views:
		var st := GLTFState.new()
		var err := doc.append_from_file(ProjectSettings.globalize_path("res://heroine_tripo.glb"), st)
		if err != OK: push_error("load failed %d" % err); get_tree().quit(1); return
		var n := doc.generate_scene(st) as Node3D
		add_child(n)
		var aabb := _aabb(n)
		var sc := 1.7 / aabb.size.y
		n.scale = Vector3.ONE * sc
		n.position = Vector3(v[1], -aabb.position.y * sc, 0)
		n.rotation.y = v[2]
		var ap := n.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
		players.append(ap)
		if players.size() == 1: print("anims: ", ap.get_animation_list(), " aabb ", aabb)
	var cl := CanvasLayer.new(); add_child(cl)
	label = Label.new(); label.position = Vector2(24, 16); label.add_theme_font_size_override("font_size", 26); cl.add_child(label)
	var i := 0
	for v in views:
		var l := Label.new(); l.text = v[0]; l.add_theme_font_size_override("font_size", 20)
		l.position = Vector2(170 + i * 430, 680); cl.add_child(l); i += 1
	_run()

func _aabb(n: Node) -> AABB:
	var out := AABB(); var first := true
	for m in n.find_children("*", "MeshInstance3D", true, false):
		var a: AABB = (m as MeshInstance3D).global_transform * (m as MeshInstance3D).get_aabb()
		if first: out = a; first = false
		else: out = out.merge(a)
	return out

func _run() -> void:
	for s in seq:
		label.text = "Tripo rig + Tripo animation: %s" % s[0]
		for ap in players:
			var a := ap.get_animation(s[0]); a.loop_mode = Animation.LOOP_LINEAR
			ap.play(s[0], 0.25)
		await get_tree().create_timer(s[1]).timeout
	get_tree().quit()
