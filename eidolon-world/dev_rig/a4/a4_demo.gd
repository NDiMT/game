extends Node
## (Agent A, a4) dev harness: her double in the still water (I.1 / IB1) at Low and High, before / after the
## mirror-camera far fix, plus the a4 art. Rendered, not headless:
##   EIDOLON_V3=1 xvfb-run -a godot --path . --resolution 390x844 res://dev_rig/a4/a4_demo.tscn -- refl [fix]
## Shots: dev/shots/a4-*.png. Prints the worst script frame (ms) over the run.
var game: Game
var _t0 := 0
var worst := 0.0
var _count := false
var args := PackedStringArray()

func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main3.tscn").instantiate()
	add_child(game)
	var b1 := Br.new(); b1.host = self; b1.first = true; b1.process_priority = -100000; add_child(b1)
	var b2 := Br.new(); b2.host = self; b2.first = false; b2.process_priority = 100000; add_child(b2)
	args = OS.get_cmdline_user_args()
	var what := args[0] if args.size() > 0 else "refl"
	await _w(2.5)
	_count = true
	match what:
		"refl": await _refl("fix" in args)
		"art": await _art(args[1] if args.size() > 1 else "")
		"clips": await _clips()
	print("A4DEMO worst script frame %.2f ms" % worst)
	get_tree().quit()

func _w(s: float) -> void:
	await get_tree().create_timer(s).timeout

func shot(n: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://dev/shots/a4-%s.png" % n)
	print("shot ", n)

class Br extends Node:
	var first := true
	var host
	func _process(_dt: float) -> void:
		if first: host._t0 = Time.get_ticks_usec()
		elif host._count:
			host.worst = maxf(host.worst, (Time.get_ticks_usec() - host._t0) / 1000.0)

# ------------------------------------------------------------------ her double in the still water
func _refl(fix: bool) -> void:
	var tag := "after" if fix else "before"
	for tier in ["low", "high"]:
		game.cmd("quality:" + tier)
		for spot in [["I1", 6.4, 29.6, "i1"], ["IB1", 19.5, 13.2, "ib1"]]:
			game.cmd("v3jump:" + spot[0])
			await _w(0.3)
			game.cmd("tp:%f:%f:%f" % [spot[1], spot[2], PI * 0.75])
			await _w(1.8)
			for r in game.ch.reflectors:
				if r.planar and r.kind == "pool":
					if fix: r.planar.cam.far = World.DIST + 16.0
					print("%s %s planar=%s active=%s vis=%.2f far=%.1f" % [tag, spot[0], r.planar.enabled, r.planar.active, r.vis, r.planar.cam.far])
			await _w(0.6)
			await shot("%s-%s-%s" % [tag, spot[3], tier])

func _go(space: String, x: float, z: float, yaw := PI * 0.75) -> void:
	game.cmd("v3jump:" + space)
	await _w(0.3)
	game.cmd("tp:%f:%f:%f" % [x, z, yaw])
	await _w(1.4)

func _art(_which: String) -> void:
	WingArt.dress_all(game)
	game.cmd("quality:high")
	await _go("N4", 12.6, -33.0)
	game.player.fig.rig.play("push", {"at": game.player.global_position + Vector3(0, 0.9, -0.5), "n": Vector3(0, 0, 1)})
	await _w(0.75)
	await shot("n4")
	await _go("N5", 10.5, -48.5)
	await shot("n5")
	await _go("N6", -0.8, -49.6)
	game.player.fig.rig.play("reach_high")
	await _w(0.85)
	await shot("n6")
	await _go("NG", -2.0, -21.2)
	await shot("ng")
	await _go("N1", 0.0, -13.8)
	await shot("n1")
	await _go("W5", -40.0, -24.0)
	await shot("w5")

## the new clips, one frame each at their key moment (a 3 m close-up: dev only)
func _clips() -> void:
	await _go("NG", 0.5, -22.0, PI * 0.25)
	for c in [["push", 0.9], ["light_with_lamp", 1.1], ["reach_high", 0.9], ["knock_glass_twice", 0.6], ["untie_cleat", 1.0],
			["climb_block", 1.8], ["sit_bench", 1.6], ["hide_column", 1.2], ["flinch_seen", 0.3], ["statue_still", 1.4], ["hang_weight", 1.1], ["ring_bell", 0.95]]:
		game.world.zoom = 2.8
		if c[0] == "light_with_lamp": game.player.fig.rig.hold("lamp")
		game.player.fig.rig.play(c[0], {"hold": true})
		await _w(c[1])
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		var sp := get_viewport().get_camera_3d().unproject_position(game.player.global_position + Vector3(0, 0.85, 0))
		var k := float(img.get_width()) / get_viewport().get_visible_rect().size.x
		img.get_region(Rect2i(int(sp.x * k) - 150, int(sp.y * k) - 210, 300, 420)).save_png("res://dev/shots/a4-clip-%s.png" % c[0])
		game.player.fig.rig.stop(0.01)
		game.player.fig.rig.hold("")
		await _w(0.5)
