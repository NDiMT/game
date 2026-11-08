extends Node
## (Agent A, a3) dev harness for the a3 look: the prologue P1 fx at W's hooks, the mirrored Warden rise, the DOF card,
## and a mock Still Room (StillRoomFx). Rendered, not headless:
##   EIDOLON_V3=1 xvfb-run -a godot --path . --resolution 390x844 res://dev_rig/still/a3_demo.tscn -- prologue|still|walk|trail
## Shots: dev/shots/a3-*.png. Prints the worst script frame (ms) over the run.
var game: Game
var _t0 := 0
var worst := 0.0
var _count := false
var _worst_at := ""
var _mark := ""

func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main3.tscn").instantiate()
	add_child(game)
	var b1 := Br.new(); b1.host = self; b1.first = true; b1.process_priority = -100000; add_child(b1)
	var b2 := Br.new(); b2.host = self; b2.first = false; b2.process_priority = 100000; add_child(b2)
	var what := OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else "still"
	await _w(2.5)
	_count = true
	match what:
		"prologue": await _prologue()
		"still": await _still()
		"walk": await _walk()
		"trail": await _dbg()          # (the gown A/B: hem tips behind the hip at 1.95 m/s)
	print("A3DEMO worst script frame %.2f ms (worst at %s)" % [worst, _worst_at])
	get_tree().quit()

func _w(s: float) -> void:
	_mark = str(Engine.get_frames_drawn())
	await get_tree().create_timer(s).timeout

## (a seek steps the whole timeline in one frame: not a real frame, so it is not counted)
func _seek(pro: Prologue3, to: float) -> void:
	_count = false
	pro.dev_seek(to)
	await get_tree().process_frame
	await get_tree().process_frame
	_count = true

func shot(n: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://dev/shots/a3-%s.png" % n)
	print("shot ", n)

class Br extends Node:
	var first := true
	var host
	func _process(_dt: float) -> void:
		if first: host._t0 = Time.get_ticks_usec()
		elif host._count:
			var ms: float = (Time.get_ticks_usec() - host._t0) / 1000.0
			if ms > host.worst:
				host.worst = ms
				host._worst_at = host._mark

# ------------------------------------------------------------------ the prologue
func _prologue() -> void:
	game.cmd("prologue")
	await _w(0.5)
	var pro := game.cine as Prologue3
	var rig: Node = game.player.fig.rig
	await _seek(pro, 22.3)
	pro.fx.finger_glints(rig)
	await _w(0.6)
	# (W's 22.4 s framing aims at L_Hand, which lies under her veil: look at the right hand, as W should)
	var prev := get_viewport().get_camera_3d()
	var tc := Camera3D.new()
	tc.fov = 18.0
	add_child(tc)
	var tr: Vector3 = pro.fx._fingertip(rig, "R")
	tc.global_position = tr + Vector3(0.75, 0.55, 1.0)
	tc.look_at(tr)
	pro.process_mode = Node.PROCESS_MODE_DISABLED
	tc.current = true
	await _w(0.4)
	await shot("p-fingers")
	pro.process_mode = Node.PROCESS_MODE_INHERIT
	prev.make_current()
	tc.queue_free()
	await _seek(pro, 26.0)
	pro.fx.joint_dust(rig, 2.0)
	await _w(1.3)
	await shot("p-dust")
	await _seek(pro, 33.0)
	await shot("p-dof0")
	pro.fx.dof(game.player, 1.6)
	await _w(1.4)
	await shot("p-dof")
	pro.fx.dof_off(0.01)
	await _seek(pro, 49.6)
	var w: WardenRig = pro.warden
	pro.warden = null
	w.place_seen(Prologue3.WD_SEEN, PI, Prologue3.W)
	w.rise_from(Prologue3.W, 3.2, NAN, pro.ws.pool_fx)
	w.look_at_point(get_viewport().get_camera_3d().global_position)
	await _w(3.0)
	await shot("p-warden")
	w.mirror_y = NAN
	pro.warden = w
	await _seek(pro, 71.05)
	pro.fx.hero_item(pro.comb)
	await _w(4.2)                       # (real time: PassThrough lands the comb at 71.0 + 2.6 + 0.5 = 74.1; W's camera finds it later)
	await shot("p-comb")
	pro.fx.droplet_crown(pro.ws.COMB_LAND)
	await _w(0.14)
	await shot("p-crown")

# ------------------------------------------------------------------ a walk at full speed (the gown)
func _walk() -> void:
	game.cmd("v3jump:I3")
	await _w(1.0)
	var p := game.player.global_position
	game.cmd("walk:%f:%f" % [p.x - 6.0, p.z])
	await _w(1.6)
	await shot("walk")

# ------------------------------------------------------------------ the Still Room (W's N.4, dressed by StillRoomFx)
func _still() -> void:
	var pz: Node3D = game.ch.pz["N4"]
	if not pz.has_meta("a3_dressed"): StillRoomFx.dress_n4(pz, game)
	game.cmd("v3jump:N4")
	await _w(0.3)
	var Y := 1.0
	game.player.global_position = Vector3(10.6, Y, -34.0)
	await _w(1.6)
	var cam := get_viewport().get_camera_3d()
	var g: Reflector = pz.get("glass")
	var ring := StillRoomFx.still_ring(pz, game.player.global_position)
	StillRoomFx.set_ring(ring, 0.7)
	StillRoomFx.detach(pz, g.clip_c, g.plane_n, game.player.global_position, cam)
	await _w(0.45)
	await shot("s-room")
	ring.queue_free()
	var c := Camera3D.new()
	c.fov = 40.0
	c.cull_mask = 0xFFFFF
	pz.add_child(c)
	c.current = true
	c.global_position = Vector3(6.6, Y + 3.6, -33.0)
	c.look_at(Vector3(7.9, Y + 3.4, -35.7))
	await _w(0.4)
	await shot("s-frame")
	var cl: Node3D = pz.get_node("N4_Cleat_c")
	c.global_position = cl.global_position + Vector3(0.55, 0.35, 0.9)
	c.look_at(cl.global_position + Vector3(0.2, 0.1, 0))
	await _w(0.3)
	await shot("s-cleat")
	StillRoomFx.untie(cl, 2.5, pz.get_node("N4_Rope_c"))
	await _w(1.95)
	await shot("s-untie")
	var bw: Node3D = pz.get_node("N4_Bar_w")
	c.global_position = bw.global_position + Vector3(-2.2, 0.9, 0.9)
	c.look_at(bw.global_position + Vector3(0, 0.3, 0))
	await _w(0.3)
	StillRoomFx.lift(bw, 1.1, 0.9)
	await _w(0.35)
	await shot("s-lift")
	var bl: Node3D = pz.get_node("N4_Block")
	c.global_position = bl.global_position + Vector3(1.4, 1.3, 1.6)
	c.look_at(bl.global_position + Vector3(0.6, 0.3, 0))
	StillRoomFx.push(bl, bl.global_position + Vector3(1.2, 0, 0), 0.9)
	await _w(0.55)
	await shot("s-push")
	await _w(1.0)

func _dbg() -> void:
	game.cmd("v3jump:WS")
	await _w(1.0)
	var fig: Node3D = game.player.fig
	var rig = fig.rig
	var sk: Skeleton3D = rig.sk
	var tips := []
	for i in sk.get_bone_count():
		var nm := sk.get_bone_name(i)
		if nm.begins_with("Hem") and sk.get_bone_children(i).is_empty(): tips.append(i)
	var last := [0.0]
	sk.skeleton_updated.connect(func() -> void:
		var hip: Vector3 = sk.global_transform * sk.get_bone_global_pose(sk.find_bone("Hip")).origin
		var lag := 0.0
		for b in tips: lag += ((sk.global_transform * sk.get_bone_global_pose(b).origin) - hip).x
		last[0] = lag / tips.size())
	for k in [0.0, 1.0]:
		HeroineRig.trail_cancel = k
		var p0 := game.player.global_position
		var acc := 0.0
		var n := 0
		var t := 0.0
		while t < 2.5:
			var dt := get_process_delta_time()
			await get_tree().process_frame
			t += dt
			game.player.global_position = p0 + Vector3(-1.95 * t * 0.5, 0, 0)
			if t > 1.2:
				acc += last[0]
				n += 1
		print("moved ", game.player.global_position - p0, " fig ", fig.global_position, " speed_m ", rig.speed_m, " ext ", rig.sim.external_force if rig.sim else Vector3.ZERO, " mode ", rig.cloth_mode)
		print("TRAIL cancel=", k, " hem tip behind hip (m, +x = behind) ", acc / maxf(n, 1))
		game.player.global_position = p0
		await _w(1.0)
