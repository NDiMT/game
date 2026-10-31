extends Control
## (Agent A, dev) the chapter map: some spaces known, one being revealed, the rest under fog; then all of it.
##   godot --path . --rendering-driver opengl3 --fixed-fps 30 --resolution 512x768 res://dev_fx/map_test.tscn -- --shots=/abs/dir

var shots := ""
var t := 0.0
var map: MapView
var step := 0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.trim_prefix("--shots=")
	var bg := ColorRect.new(); bg.color = Color(0.07, 0.07, 0.075); bg.set_anchors_preset(Control.PRESET_FULL_RECT); add_child(bg)
	map = MapView.new()
	map.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(map)
	for k in ["waking_pool", "atrium", "stair_breath"]: map.reveal_area(k, true)
	map.reveal_region("T4", true)
	map.reveal_area("hall_glass")          # fading in now
	map.set_player(Vector3(0.0, 0.0, -15.0))
	if shots != "": DirAccess.make_dir_recursive_absolute(shots)

func _process(dt: float) -> void:
	t += dt
	if shots == "": return
	if step == 0 and t > 0.6:
		step = 1; await _shot("a_fading")
	elif step == 1 and t > 2.0:
		step = 2; await _shot("b_partial")
		for k in Names.AREAS: map.reveal_area(k, true)
	elif step == 2 and t > 2.6:
		step = 3; await _shot("c_all")
		get_tree().quit()

func _shot(n: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/map-%s.png" % [shots, n])
	print("shot ", n)
