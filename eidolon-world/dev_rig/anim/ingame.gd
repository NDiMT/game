extends Node
## v3 (Agent A) in-game check of the animation layer + the CineFx toolkit, in the REAL game (main.tscn):
##   xvfb-run -a godot --path . --rendering-driver opengl3 --fixed-fps 30 --resolution 390x844 res://dev_rig/anim/ingame.tscn -- --out=/abs/dir
## shots: walk, reach, lamp held while walking, the cinematic look (bars, vignette, fake DOF, light rig, crimson flash, shake);
## prints PERF (apply_pose cost) and SLIDE (planted-foot drift in the game's own walk).
var game: Game
var t := 0.0
var out := ""
var fx: CineFx
var plan: Array = []
var last := [Vector3.INF, Vector3.INF]
var planted_n := [0, 0]
var drift := 0.0
var drift_at := ""
var shots := 0

func _ready() -> void:
	Game.autotest = true
	process_priority = 100000             # (after the game's own step: the pose of THIS frame)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="): out = a.substr(6)
	DirAccess.make_dir_recursive_absolute(out)
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	plan = [
		[1.0, func() -> void: game.cmd("begin")],
		[3.0, func() -> void: game.cmd("skip")],
		[9.0, func() -> void: game.cmd("input:0.0:-1.0")],
		[10.6, func() -> void: _shot("walk")],
		[11.2, func() -> void: game.cmd("stop")],
		[11.3, func() -> void: if OS.get_environment("SHORT") != "": print("SLIDE in-game planted-foot drift max (cm): %.3f  %s" % [drift, drift_at]); get_tree().quit()],
		[12.6, func() -> void: _perf()],
		[13.0, func() -> void: _rig().play("reach")],
		[13.45, func() -> void: _shot("reach")],
		[14.6, func() -> void: _rig().hold("lamp"); game.cmd("input:1.0:0.0")],
		[15.9, func() -> void: _shot("lamp_walk")],
		[16.4, func() -> void: game.cmd("stop"); _rig().hold("")],
		[17.6, func() -> void: _cine()],
		[20.2, func() -> void: fx.flash(Color(0.75, 0.05, 0.08), 0.35, 0.05, 1.2); fx.shake("thud", 1.0)],
		[20.32, func() -> void: _shot("cine_look")],
		[21.5, func() -> void: _rig().play("kneel_touch", {"hold": true})],
		[23.3, func() -> void: _shot("cine_kneel")],
		[24.0, func() -> void: print("SLIDE in-game planted-foot drift max (cm): %.3f  %s" % [drift, drift_at]); get_tree().quit()],
	]

func _rig() -> HeroineRig: return game.player.fig.rig

func _cine() -> void:
	fx = CineFx.new(game.world, game.ui)
	game.add_child(fx)
	fx.letterbox(true, 1.0)
	fx.vignette(0.7, 1.0)
	fx.dof(game.player, 2.2, 0.6)
	fx.light_rig("prologue", game.player.global_position, game.player.global_position + Vector3(0.0, 0.0, -1.2), 1.0)
	_rig().play("look_hands")

func _perf() -> void:
	var r := _rig()
	var p := Figure.Pose.new()
	var t0 := Time.get_ticks_usec()
	for i in 200: r.apply_pose(p, 0.0, false)
	print("PERF HeroineRig.apply_pose: %.3f ms per call (incl. IK x4, layers)" % ((Time.get_ticks_usec() - t0) / 200000.0))

func _shot(n: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, n])
	shots += 1

func _process(dt: float) -> void:
	t += dt
	while not plan.is_empty() and t >= plan[0][0]:
		var f: Callable = plan.pop_front()[1]
		f.call()
	if game.player and game.player.fig.rig and game.mode == "play":
		var r := _rig()
		for i in 2:
			if r._feet[i]["sw"] or game.player.speed01 < 0.02 or r.is_playing():
				last[i] = Vector3.INF
				planted_n[i] = 0
				continue
			planted_n[i] += 1
			if planted_n[i] < 2: continue
			var fw := r.bone_world("L_Foot" if i == 0 else "R_Foot")
			if last[i] != Vector3.INF:
				var dd: float = (fw - last[i]).length() * 100.0
				if dd > drift:
					drift = dd
					drift_at = "t=%.2f foot=%d v=%.2f y=%.3f tgt_err=%.3f" % [t, i, game.player.speed01, game.player.position.y, (r.rig.global_transform * (r.C["Lf" if i == 0 else "Rf"] as Vector3) - fw).length()]
			else: last[i] = fw
