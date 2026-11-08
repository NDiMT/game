extends Node3D
## v3 (Agent A) animation contact sheet: every heroine clip / walk state on the REAL rig (Figure -> HeroineRig v1),
## one stage per cell (spaced apart), one SubViewport per cell rendered once at its moment.
##   xvfb-run -a godot --path . --rendering-driver opengl3 --fixed-fps 30 res://dev_rig/anim/anim_sheet.tscn -- --out=/abs/dir [--only=a,b] [--strip=walk|rise]
## then dev_rig/anim/compose.py makes the sheet.

const W := 300
const H := 400
var out := ""
var cells: Array = []        # [name, kind, opts, shot_t, cam_off]
var stages: Array = []
var t := 0.0
var strip := ""
var fov := 32.0
var zoom := 1.0

func _ready() -> void:
	HeroineRig.VARIANT = "v1"
	var args := {}
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	out = args.get("out", "/tmp/anim")
	strip = args.get("strip", "")
	fov = float(args.get("fov", "32"))
	zoom = float(args.get("zoom", "1"))
	DirAccess.make_dir_recursive_absolute(out)
	_stage_env()
	var F := Vector3(1.5, 0.75, -3.4)          # 3/4 front (she faces -z)
	var S := Vector3(0.0, 0.55, -3.6)           # side of a walk along +x (from her right)
	var L := Vector3(0.4, 1.9, -2.9)           # high, for the floor work
	var defs := [
		["idle", "stand", {}, 3.0, F],
		["idle: head tilt", "clip", {"clip": "idle_tilt", "at_t": 3.6}, 0.0, F],
		["idle: fingers", "clip", {"clip": "idle_fingers", "at_t": 2.0}, 0.0, F],
		["walk 1.6 m/s", "walk", {"v": 1.6}, 2.0, S],
		["walk 2.7 m/s", "walk", {"v": 2.7}, 2.0, S],
		["start", "start", {"v": 1.8, "t0": 1.0}, 1.22, S],
		["stop", "stop", {"v": 1.8, "t0": 2.0}, 2.32, S],
		["turn in place", "turn", {"t0": 1.0}, 1.3, F],
		["reach", "clip", {"clip": "reach", "at_t": 0.45}, 0.0, F],
		["pick up", "clip", {"clip": "pickup", "at_t": 0.9}, 0.0, F],
		["kneel / touch water", "clip", {"clip": "kneel_touch", "at_t": 1.6, "hold": true}, 0.0, F],
		["touch glass", "clip", {"clip": "touch_glass", "at_t": 1.1, "hold": true}, 0.0, F],
		["hold lamp (walking)", "walk", {"v": 1.2, "hold": "lamp"}, 2.2, F + Vector3(4.0, 0, 0)],
		["Shard to her eye", "clip", {"clip": "shard_eye", "at_t": 1.2, "hold": true}, 0.0, F],
		["lying on her side", "clip", {"clip": "lie_side", "at_t": 1.0}, 0.0, L],
		["rise 2.4 s: the palm plants", "clip", {"clip": "rise", "at_t": 2.4}, 0.0, L],
		["rise 4.6 s: sits, head lolls", "clip", {"clip": "rise", "at_t": 4.6}, 0.0, L],
		["rise 6.0 s: kneels", "clip", {"clip": "rise", "at_t": 6.0}, 0.0, F],
		["rise 7.5 s: marionette", "clip", {"clip": "rise", "at_t": 7.5}, 0.0, F],
		["looks at her hands", "clip", {"clip": "look_hands", "at_t": 2.2}, 0.0, F],
		["kneel, reach to water", "clip", {"clip": "kneel_reach", "at_t": 2.4, "hold": true}, 0.0, F],
		["recoil", "clip", {"clip": "recoil", "at_t": 0.5, "hold": true, "pre": "kneel_reach"}, 0.0, F],
		["reflection: palm up, taps", "clip", {"clip": "refl_press", "at_t": 1.8, "hold": true, "red": true}, 0.0, F],
		["reflection: dragged down", "clip", {"clip": "refl_dragged", "at_t": 0.5, "hold": true, "red": true}, 0.0, F],
		["Warden rises (glass)", "warden", {"phase": "rise", "red": true}, 2.6, Vector3(3.6, 0.5, -1.4)],
		["Warden: hand on her shoulder", "warden", {"phase": "grab", "red": true}, 3.2, Vector3(3.6, 0.5, -1.4)],
		["Warden pulls her under", "warden", {"phase": "pull", "red": true}, 4.15, Vector3(3.6, 0.5, -1.4)],
	]
	var only: String = args.get("only", "")
	if strip == "walk":
		for k in 8: defs.append(["walk %d" % k, "walk", {"v": 1.6}, 2.0 + k * 0.075, S])
		only = "walk "
	elif strip == "rise":
		for k in 8: defs.append(["rise %d" % k, "clip", {"clip": "rise", "at_t": 0.2 + k * 1.3}, 0.0, L])
		only = "rise "
	var n := 0
	for d in defs:
		if only != "":
			var ok := false
			for o in only.split(","):
				if strip != "" and (d[0] as String).begins_with(o) and (d[0] as String).length() <= o.length() + 1: ok = true
				elif strip == "" and (d[0] as String).begins_with(o): ok = true
			if not ok: continue
		_make(d, n)
		n += 1

func _stage_env() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.20, 0.21, 0.24)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.57, 0.63)
	e.ambient_light_energy = 0.8
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.9, -0.6, 0.0)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	add_child(sun)

func _make(d: Array, idx: int) -> void:
	var base := Vector3((idx % 6) * 12.0, 0.0, (idx / 6) * 12.0)
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(8, 8)
	floor_mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.42, 0.42, 0.44)
	floor_mi.material_override = fm
	floor_mi.position = base
	add_child(floor_mi)
	var opts: Dictionary = d[2]
	var fig := Figure.new()
	add_child(fig)
	fig.position = base
	if opts.get("red", false): fig.rig.body_mat.set_shader_parameter("red", 1.0)
	var sv := SubViewport.new()
	sv.size = Vector2i(W, H)
	sv.msaa_3d = Viewport.MSAA_4X
	sv.render_target_update_mode = SubViewport.UPDATE_DISABLED
	sv.own_world_3d = false
	var cam := Camera3D.new()
	cam.fov = fov
	sv.add_child(cam)
	add_child(sv)
	var st := {"name": d[0], "kind": d[1], "opts": opts, "shot": d[3], "off": d[4], "fig": fig, "base": base, "vp": sv, "cam": cam,
		"done": false, "pending": false, "idx": idx, "pos": base, "yaw": 0.0, "v": 0.0, "played": false, "phase": 0.0}
	if d[1] == "walk" or d[1] == "start" or d[1] == "stop":
		st["yaw"] = -PI * 0.5
		st["pos"] = base + Vector3(-2.5, 0, 0)
	if d[1] == "warden":
		var w := WardenRig.new()
		add_child(w)
		w.position = base + Vector3(-0.10, 0.0, 0.40)
		w.rotation.y = PI
		w.set_look("glass")
		st["warden"] = w
	stages.append(st)

func _process(dt: float) -> void:
	t += dt
	var left := 0
	for st in stages:
		_drive(st, dt)
		if st["pending"]:
			var img: Image = (st["vp"] as SubViewport).get_texture().get_image()
			img.save_png("%s/cell_%02d.png" % [out, st["idx"]])
			st["pending"] = false
			st["done"] = true
		if not st["done"]:
			left += 1
			var shot: float = st["shot"]
			if t >= shot and shot > 0.0:
				(st["vp"] as SubViewport).render_target_update_mode = SubViewport.UPDATE_ONCE
				st["pending"] = true
	if left == 0:
		var f := FileAccess.open(out + "/labels.txt", FileAccess.WRITE)
		for st in stages: f.store_line("%02d\t%s" % [st["idx"], st["name"]])
		f.close()
		get_tree().quit()

func _drive(st: Dictionary, dt: float) -> void:
	var fig: Figure = st["fig"]
	var o: Dictionary = st["opts"]
	var kind: String = st["kind"]
	var v: float = st["v"]
	var want := 0.0
	match kind:
		"walk": want = o["v"]
		"start": want = o["v"] if t >= o["t0"] else 0.0
		"stop": want = o["v"] if t < o["t0"] else 0.0
		"turn":
			if t >= o["t0"]: st["yaw"] = lerp_angle(st["yaw"], PI * 0.999, 1.0 - exp(-dt * 6.0))
		"clip":
			var at_t: float = o["at_t"]
			if not st["played"] and t >= 0.6:
				st["played"] = true
				var rig := fig.rig
				if o.has("pre"):
					rig.play(o["pre"], {"hold": true})
					st["pre_t"] = t
				else:
					var po := {"hold": o.get("hold", false)}
					rig.play(o["clip"], po)
					st["shot"] = t + at_t
			if o.has("pre") and st.has("pre_t") and not st.has("pre_done") and t >= float(st["pre_t"]) + 2.8:
				st["pre_done"] = true
				fig.rig.play(o["clip"], {"hold": o.get("hold", false)})
				st["shot"] = t + at_t
	if kind == "warden":
		var w: WardenRig = st["warden"]
		var ph: String = o["phase"]
		if not st.has("w0"):
			st["w0"] = true
			if ph == "rise": w.rise_from((st["base"] as Vector3).y + 0.0, 3.0)
			else: w.glass_param("rise", 1.0)
			fig.rig.play("refl_press", {"hold": true})
		if ph != "rise" and t >= 1.2 and not st.has("w1"):
			st["w1"] = true
			w.look_at_point(fig.global_position + Vector3(0, 0.9, 0))
			w.grab(func() -> Vector3: return fig.rig.bone_world("R_Upperarm") + Vector3(0, 0.05, 0), "R", 1.2)
		if ph == "pull" and t >= 3.2 and not st.has("w2"):
			st["w2"] = true
			fig.rig.play("refl_dragged", {"hold": true})
			w.pull_under((st["base"] as Vector3).y, 2.0, null)
			st["sink"] = t
		if st.has("sink"):
			var k := clampf((t - float(st["sink"]) - 0.38) / 2.1, 0.0, 1.0)
			st["pos"] = (st["base"] as Vector3) + Vector3(0, -1.9 * k * k, 0)
	if o.has("hold") and o["hold"] is String and not st.has("held"):
		st["held"] = true
		fig.rig.hold(o["hold"])
	v = move_toward(v, want, (9.0 if want > v else 12.0) * dt)
	st["v"] = v
	var yaw: float = st["yaw"]
	var dir := Vector3(-sin(yaw), 0, -cos(yaw))
	st["pos"] = (st["pos"] as Vector3) + dir * v * dt
	fig.position = st["pos"]
	fig.rotation.y = yaw
	var p := Figure.Pose.new()
	var walk := smoothstep(0.0, 0.6, v / 2.7)
	st["phase"] = float(st["phase"]) + dt * (1.5 + 6.2 * v / 2.7)
	p.ripple = walk
	p.phase = st["phase"]
	p.breath = sin(t * 1.65) * (1.0 - walk)
	p.lean_x = -0.11 * walk
	fig.apply_pose(p)
	var cam: Camera3D = st["cam"]
	var look: Vector3 = (st["pos"] as Vector3) + Vector3(0, 0.5, 0)
	if kind == "clip":
		var hp := fig.rig.bone_world("Hip")
		look = Vector3(hp.x, maxf(hp.y, 0.25) * 0.9 + 0.1, hp.z)
	if kind == "warden":
		look = (st["base"] as Vector3) + Vector3(0, 0.95, 0.2)
	cam.position = look + (st["off"] as Vector3) * zoom
	cam.look_at(look)
