extends Node3D
## (Agent A, dev) the v1.0 heroine (HeroineRig, VARIANT "v1") on her own: idle -> walk -> a 180 deg turn while
## walking -> walk -> stop -> idle, with the "oddness" layer (head tilt, hand twitches, the glide) and her
## spring cloth (Hem + Veil chains). Beside her stands a crimson reflection wearing her simulated cloth.
##   godot --path . res://dev_fx/heroine_v1_test.tscn
##   godot --path . --rendering-driver opengl3 --fixed-fps 30 res://dev_fx/heroine_v1_test.tscn -- --shots=/abs/dir

const SPEED := 2.7
const MOMENTS := {"idle": 2.6, "walk": 6.0, "walk2": 6.25, "turn": 9.35, "stop": 12.95, "settle": 16.0}
const VIEWS := {"front": 0.0, "q": PI * 0.25, "side": PI * 0.5, "back": PI}

var args := {}
var who: HeroineRig
var red: HeroineRig
var holder: Node3D
var t := 0.0
var yaw := 0.0
var walk01 := 0.0
var phase := 0.0
var shots := ""
var queue := []
var vps := {}
var pose := Figure.Pose.new()

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	shots = args.get("shots", "")
	HeroineRig.VARIANT = args.get("variant", "v1")
	_stage()
	holder = Node3D.new()
	add_child(holder)
	who = HeroineRig.new(false)
	holder.add_child(who)
	who.set_cloth("sim")
	red = HeroineRig.new(false)
	red.position = Vector3(1.1, 0, 0.3)
	add_child(red)
	red._bp("red", 1.0)
	red.set_cloth("copy", who)
	if shots != "":
		DirAccess.make_dir_recursive_absolute(shots)
		for m in MOMENTS: queue.append([MOMENTS[m], m])
		queue.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
		for v in VIEWS:
			var sv := SubViewport.new()
			sv.size = Vector2i(480, 640)
			sv.msaa_3d = Viewport.MSAA_4X
			sv.render_target_update_mode = SubViewport.UPDATE_DISABLED
			var c := Camera3D.new()
			c.fov = 30.0
			sv.add_child(c)
			add_child(sv)
			vps[v] = [sv, c]
	var cam := Camera3D.new()
	cam.fov = 32.0
	cam.position = Vector3(1.6, 1.4, 3.4)
	add_child(cam)
	cam.look_at(Vector3(0.4, 0.6, 0))

func _stage() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.56, 0.58, 0.61)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.70, 0.76, 0.86)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)
	sun.light_color = Color(1.0, 0.925, 0.80)
	sun.light_energy = 0.85
	sun.shadow_enabled = true
	add_child(sun)
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(60, 60)
	fl.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.6, 0.6, 0.58)
	fl.material_override = fm
	add_child(fl)

func _script(tt: float) -> Array:
	if tt < 3.0: return [0.0, 0.0]
	if tt < 8.0: return [1.0, 0.0]
	if tt < 10.25: return [1.0, 1.4]
	if tt < 12.2: return [1.0, 0.0]
	return [0.0, 0.0]

func _process(dt: float) -> void:
	t += dt
	var sc := _script(t)
	walk01 = move_toward(walk01, sc[0], dt / 0.55)
	var w := smoothstep(0.0, 1.0, walk01)
	var turn: float = sc[1] * w
	yaw += turn * dt
	holder.rotation.y = yaw
	holder.position += -holder.basis.z * SPEED * walk01 * dt * 0.55
	phase += dt * (1.5 + 6.2 * walk01) * (1.0 if walk01 > 0.03 else 0.0)
	var s := sin(phase)
	pose.ripple = w
	pose.phase = phase
	pose.body_y = absf(s) * 0.035 * w
	pose.lean_x = -0.11 * w
	pose.lean_z = -clampf(turn * 0.09, -0.2, 0.2)
	pose.breath = sin(t * 1.65) * (1.0 - w)
	pose.head_yaw = sin(t * 0.45) * 0.22 * (1.0 - w)
	who.apply_pose(pose, 0.0, false)
	var rp := pose.copy()
	rp.ripple = 0.0; rp.body_y = 0.0; rp.lean_x = 0.0; rp.lean_z = 0.0; rp.clasp = 0.0
	red.apply_pose(rp, 0.05, true)
	if shots != "" and not queue.is_empty() and t >= queue[0][0]:
		var m: String = queue.pop_front()[1]
		await _capture(m)
		if queue.is_empty(): get_tree().quit()

func _capture(m: String) -> void:
	var target := holder.position + Vector3(0, 0.62, 0)
	var fwd := -holder.basis.z
	for v in vps:
		var sv: SubViewport = vps[v][0]
		var c: Camera3D = vps[v][1]
		c.position = target + fwd.rotated(Vector3.UP, VIEWS[v]) * 2.7 + Vector3(0, 0.25, 0)
		c.look_at(target)
		sv.render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	for v in vps:
		(vps[v][0] as SubViewport).get_texture().get_image().save_png("%s/heroine-v1-%s-%s.png" % [shots, m, v])
	print("shot ", m)
