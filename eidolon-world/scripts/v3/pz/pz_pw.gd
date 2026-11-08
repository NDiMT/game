extends Puzzle
## PW "The Far Shore" (CH1_V3 §1 #35, between): a strip of marble shore past the pool; ahead, the long bridge over the
## lagoon. A stele with a wax tablet on its ledge, in his hand. Read it (she reaches; the wax is warm). Done = read.

const STELE := Vector3(-12.0, 0.0, 24.75)
var tablet: Node3D

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	m.box(STELE + Vector3(0, 0.7, 0), Vector3(0.7, 1.4, 0.32), Color(0.5, 0.25, 0.0))
	m.box(STELE + Vector3(0, 0.82, 0.24), Vector3(0.62, 0.05, 0.18), Color(0.5, 0.25, 0.0))
	Kit3.marble(game, m.commit(), self).name = "PW_Stele"
	game.level.ob_rect(Rect2(STELE.x - 0.38, STELE.z - 0.2, 0.76, 0.56))
	game.level.add_interact("pw_read", STELE + Vector3(0, 0, 1.05), "read", read, 1.0, func() -> bool: return true)

func post() -> void:
	tablet = Kit3.prop(self, "item_wax_tablet", STELE + Vector3(0, 0.85, 0.24), 0.05, 12.0)
	tablet.name = "PW_Tablet"

func read() -> void:
	game.call("perform", "reach", STELE + Vector3(0, 0.88, 0.24), func() -> void:
		if not done: solve()
		if game.sfx: game.sfx.play("page", -12.0, 0.9)
		game.ui.show_text("\"She found the sea still today, and looked.\nI have had every shutter closed.\"", game.player.position, 6.0))

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [STELE.x, STELE.z + 1.05])
	get_tree().create_timer(3.0).timeout.connect(func() -> void: game.try_interact())
