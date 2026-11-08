extends Puzzle
## IBW "The Ash Landing" (CH1_V3 §1 #15, between): after the shadows, air. A wax tablet on a fallen drum, the wind, the
## view west over the lagoon. Read it (his hand). Done = read. No gate.

const TABLET := Vector3(-41.0, 1.0, -13.4)

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	m.cyl(TABLET + Vector3(0, 0.3, 0), 0.42, 0.44, 0.6, Color(0.5, 0.25, 0.0), 14)
	Kit3.marble(game, m.commit(), self).name = "IBW_Drum"
	game.level.ob_circle(Vector2(TABLET.x, TABLET.z), 0.46)
	game.level.add_interact("ibw_tablet", TABLET + Vector3(-0.95, 0, 0.2), "read", read, 1.1)

func post() -> void:
	var t := Kit3.prop(self, "item_wax_tablet", TABLET + Vector3(0, 0.61, 0), 0.05, 20.0)
	if t.get_child_count() == 0:
		var p := "res://assets/models/items/item_wax_tablet.glb"
		if ResourceLoader.exists(p):
			var n: Node3D = (load(p) as PackedScene).instantiate()
			n.scale = Vector3.ONE * 2.2
			t.add_child(n)

func read() -> void:
	game.call("perform", "reach", TABLET + Vector3(0, 0.62, 0), func() -> void:
		if game.sfx: game.sfx.play("page", -12.0, 1.0)
		game.ui.show_text("\"When I stop, she does not.\nI have stopped working by day.\"", game.player.position, 6.0)
		if not done: solve())

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [TABLET.x - 0.95, TABLET.z + 0.2])
	get_tree().create_timer(2.5).timeout.connect(func() -> void: game.try_interact())
