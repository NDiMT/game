extends Node3D
## Self-contained test scene for the rigged heroine (dev_rig/heroine_rig.gd; no game scenes involved).
## Plays a fixed timeline: idle -> walk -> 180 deg turn while walking -> walk -> stop -> idle.
##   interactive:  godot --path . res://dev_rig/heroine_rig_test.tscn
##                 [L] original auto-rig  [C] cloth on/off  [P] pause  drag = orbit, wheel = zoom
##   stills:       godot --path . --rendering-driver opengl3 --fixed-fps 30 res://dev_rig/heroine_rig_test.tscn \
##                   -- --shots=/abs/dir --rig=new|old   (writes <dir>/<rig>-<moment>-<view>.png, then quits)
##   cost:         godot --headless --path . --fixed-fps 60 res://dev_rig/heroine_rig_test.tscn -- --bench=40

const RigScript := preload("res://dev_rig/heroine_rig.gd")
const SPEED := 2.7
const TL_END := 16.5

## moment name -> timeline seconds
const MOMENTS := {"idle": 2.6, "walk": 6.0, "walk2": 6.2, "turn": 9.35, "stop": 12.95, "settle": 16.0}
const VIEWS := {"front": 0.0, "side": PI * 0.5, "back": PI, "q": PI * 0.25}

var args := {}
var who: Node3D
var t := 0.0
var yaw := 0.0
var walk01 := 0.0
var phase := 0.0
var paused := false
var legacy := false
var cloth := true
var cam: Camera3D
var orbit := Vector2(0.35, -0.12)
var dist := 4.4
var shots_dir := ""
var shot_queue := []
var vps := {}
var bench_n := 0
var bench := []
var label: Label

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	legacy = args.get("rig", "new") == "old"
	cloth = args.get("cloth", "1") == "1"
	shots_dir = args.get("shots", "")
	bench_n = int(args.get("bench", "0"))
	_build_stage()
	if bench_n > 0:
		_build_bench()
		return
	_spawn()
	if shots_dir != "":
		DirAccess.make_dir_recursive_absolute(shots_dir)
		var only: String = args.get("moments", "")
		for m in MOMENTS:
			if only == "" or m in only.split(","): shot_queue.append([MOMENTS[m], m])
		shot_queue.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
		for v in VIEWS:
			var sv := SubViewport.new()
			sv.size = Vector2i(int(args.get("w", "560")), int(args.get("h", "760")))
			sv.msaa_3d = Viewport.MSAA_4X
			sv.render_target_update_mode = SubViewport.UPDATE_DISABLED
			var c := Camera3D.new()
			c.fov = 30.0
			sv.add_child(c)
			add_child(sv)
			vps[v] = [sv, c]
	else:
		label = Label.new()
		label.position = Vector2(8, 8)
		add_child(label)

func _build_stage() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.56, 0.58, 0.61)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.62, 0.63, 0.68)
	e.ambient_light_energy = 0.9
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.85, 0.55, 0.0)
	sun.light_energy = 1.5
	sun.shadow_enabled = true
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation = Vector3(-0.3, PI + 0.6, 0.0)
	fill.light_energy = 0.45
	add_child(fill)
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	floor_mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.47, 0.48, 0.5)
	fm.uv1_scale = Vector3(30, 30, 1)
	fm.albedo_texture = _checker()
	floor_mi.material_override = fm
	add_child(floor_mi)
	cam = Camera3D.new()
	cam.fov = 32.0
	add_child(cam)

func _checker() -> Texture2D:
	var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
	for yy in 64:
		for xx in 64:
			var c := 0.62 if ((xx / 32) + (yy / 32)) % 2 == 0 else 0.55
			img.set_pixel(xx, yy, Color(c, c, c * 1.02))
	return ImageTexture.create_from_image(img)

func _spawn() -> void:
	if who: who.queue_free()
	who = RigScript.new()
	who.legacy = legacy
	who.springs = cloth
	add_child(who)

## the scripted motion: returns [target walk 0..1, turn rate rad/s]
func _script(tt: float) -> Array:
	if tt < 3.0: return [0.0, 0.0]
	if tt < 8.0: return [1.0, 0.0]
	if tt < 10.25: return [1.0, 1.4]
	if tt < 12.2: return [1.0, 0.0]
	return [0.0, 0.0]

func _process(dt: float) -> void:
	if bench_n > 0:
		_bench_step(dt)
		return
	if not paused: _step(dt)
	_update_cam()
	if label:
		label.text = "%s rig   cloth %s   t=%.1f   [L] rig  [C] cloth  [P] pause" % ["ORIGINAL" if legacy else "NEW", "on" if cloth else "off", t]
	if shots_dir != "" and not shot_queue.is_empty() and t >= shot_queue[0][0]:
		var m: String = shot_queue.pop_front()[1]
		await _capture(m)
		if shot_queue.is_empty(): get_tree().quit()

func _step(dt: float) -> void:
	t += dt
	if t > TL_END and shots_dir == "":
		t = 0.0; yaw = 0.0; who.position = Vector3.ZERO; who.call("reset_cloth")
	var sc := _script(t)
	walk01 = move_toward(walk01, sc[0], dt / 0.55)
	var walk := smoothstep(0.0, 1.0, walk01)
	var turn: float = sc[1] * walk
	yaw += turn * dt
	who.rotation.y = yaw
	who.position += -who.basis.z * SPEED * walk01 * dt * 0.55
	phase += dt * (1.5 + 6.2 * walk01) * (1.0 if walk01 > 0.03 else 0.0)
	var s := sin(phase)
	who.set("walk", walk)
	who.set("phase", phase)
	who.set("body_y", absf(s) * 0.05 * walk + sin(t * 1.7) * 0.004 * (1.0 - walk))
	who.set("lean_x", -0.11 * walk)
	who.set("lean_z", -clampf(turn * 0.09, -0.2, 0.2))
	who.set("breath", sin(t * 1.65) * (1.0 - walk))
	who.set("head_yaw", sin(t * 0.45) * 0.22 * (1.0 - walk))
	who.set("arm_sway", sin(t * 0.9) * 0.05)
	who.call("set_wind", Vector3(0.05 * sin(t * 0.63) + 0.03, 0.0, 0.03 * sin(t * 0.41)))
	who.call("apply_pose")

func _update_cam() -> void:
	var target := who.position + Vector3(0, 0.92, 0)
	var dir := Vector3(sin(orbit.x + yaw), 0, cos(orbit.x + yaw))
	dir = (dir * cos(orbit.y) + Vector3.UP * -sin(orbit.y)).normalized()
	cam.position = target + dir * dist
	cam.look_at(target)

func _capture(m: String) -> void:
	var target := who.position + Vector3(0, 0.88, 0)
	var fwd := -who.basis.z
	for v in vps:
		var sv: SubViewport = vps[v][0]
		var c: Camera3D = vps[v][1]
		var d := fwd.rotated(Vector3.UP, VIEWS[v])
		c.position = target + d * 3.9 + Vector3(0, 0.3, 0)
		c.look_at(target)
		sv.render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	for v in vps:
		var sv: SubViewport = vps[v][0]
		sv.get_texture().get_image().save_png("%s/heroine-%s-%s.png" % [shots_dir, m, v])
	print("shot ", m, " t=", t)

func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed:
		match (ev as InputEventKey).keycode:
			KEY_L: pass
			KEY_C: cloth = not cloth; _spawn()
			KEY_P: paused = not paused
	elif ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT):
		orbit += Vector2(-ev.relative.x, ev.relative.y) * 0.008
		orbit.y = clampf(orbit.y, -1.2, 0.6)
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP: dist = maxf(1.2, dist * 0.9)
		if ev.button_index == MOUSE_BUTTON_WHEEL_DOWN: dist = minf(8.0, dist * 1.1)

# ------------------------------------------------------------------ cost benchmark
## N walking, turning wanderers (headless): mean CPU frame time with the cloth on, then off.
var _bt := 0.0
var _bframes := 0
var _last_us := 0
var _acc := {"on": 0.0, "off": 0.0}
var _cnt := {"on": 0, "off": 0}

func _build_bench() -> void:
	for i in bench_n:
		var w := RigScript.new()
		w.springs = true
		w.position = Vector3((i % 8) * 1.5, 0, (i / 8) * 1.5)
		add_child(w)
		bench.append(w)

func _bench_step(dt: float) -> void:
	var now := Time.get_ticks_usec()
	var mode := "on" if _bframes < 400 else "off"
	if _bframes > 60 and _bframes != 400 and _bframes != 401 and _last_us > 0:
		_acc[mode] += now - _last_us
		_cnt[mode] += 1
	_last_us = now
	_bframes += 1
	_bt += dt
	if _bframes == 400:
		for w in bench: (w.get("sim") as SpringBoneSimulator3D).active = false
	for w in bench:
		w.set("walk", 1.0)
		w.set("phase", _bt * 7.7)
		w.rotation.y = sin(_bt) * 1.5
		w.call("apply_pose")
	if _bframes >= 760:
		var on: float = _acc["on"] / maxf(_cnt["on"], 1)
		var off: float = _acc["off"] / maxf(_cnt["off"], 1)
		var skel0: Skeleton3D = bench[0].get("sk")
		var sim0: SpringBoneSimulator3D = bench[0].get("sim")
		var joints := 0
		for i in sim0.setting_count: joints += sim0.get_joint_count(i)
		print("BENCH wanderers=%d bones=%d cloth_chains=%d cloth_joints=%d colliders=%d" % [bench_n, skel0.get_bone_count(), sim0.setting_count, joints, sim0.get_child_count()])
		print("BENCH CPU frame: cloth on %.3f ms, off %.3f ms -> cloth costs %.4f ms per wanderer per frame" % [on / 1000.0, off / 1000.0, (on - off) / 1000.0 / bench_n])
		get_tree().quit()
