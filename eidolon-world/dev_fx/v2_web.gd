extends Node
## (Agent A, dev) v2.0 web check: every new effect at once, in view at the waking pool, so each shader compiles and
## draws in the WEB build (exported with this as the main scene; the console is read by a headless Chromium).
var game: Node
var t := 0.0
var done := false
func _ready() -> void:
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
func _process(dt: float) -> void:
	t += dt
	if t < 3.0 or done: return
	if t < 3.5: return
	done = true
	game.cmd("begin")
	await get_tree().create_timer(2.0).timeout
	game.cmd("tp:-3.2:1.0")
	await get_tree().create_timer(2.0).timeout
	var j: Node = game.juice
	var pp: Vector3 = game.player.global_position
	var wy := Ch1Geo.WATER_Y
	OmenFx.palm_press(j, pp + Vector3(-1.4, wy - pp.y, 1.0), 0.0, game.puzzles.pool_fx)
	var w := WardenRig.new(); j.add_child(w); w.global_position = pp + Vector3(-2.0, wy - pp.y - 0.5, -0.5)
	w.set_look("glass"); w.rise_from(wy, 3.0, NAN, game.puzzles.pool_fx)
	OmenFx.murk(game.puzzles.water_mat, 0.6, 2.0)
	var c: Node3D = (load("res://assets/models/items/item_comb.glb") as PackedScene).instantiate(); j.add_child(c)
	PassThrough.water(j, pp + Vector3(-0.8, wy - pp.y, 1.2), c, game.puzzles.pool_fx)
	var s: Node3D = (load("res://assets/models/items/item_shard.glb") as PackedScene).instantiate(); j.add_child(s)
	PassThrough.mirror(j, pp + Vector3(1.0, 1.2, -1.0), Vector3.BACK, s)
	OmenFx.frost(j, pp + Vector3(-1.5, 1.2, -1.5), Vector3.BACK, Vector2(1.5, 1.5), 3.0)
	OmenFx.write_in_water(j, pp + Vector3(0.0, wy - pp.y, 1.6), 0.0, "ΒΡΕΣ ΜΕ", 3.0, 0.3, 6.0)
	OmenFx.glass_eye(j, pp + Vector3(1.4, wy - pp.y, 0.8), 1.0, 1.0, 6.0)
	var bf := BeaconFire.new(); j.add_child(bf); bf.global_position = pp + Vector3(1.6, 0.0, -0.4); bf.ignite()
	await get_tree().create_timer(6.0).timeout
	var cl := CanvasLayer.new(); add_child(cl)
	var ic := IntroCard.new(); cl.add_child(ic)
	ic.play("On Kythira there lived a sculptor named Theron.\n*A face is carved by living.*", 1.0)
	print("V2WEB fired")
