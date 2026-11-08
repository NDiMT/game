extends Puzzle
## I.23 "The First Shrine: The Hand in the Water" (CH1_V3 §1 #38, story; EIDOLON_SCRIPT §6 I.23): a round still pool
## under a carved stele. Kneel at its lip and lay your palm on the water (clip palm_to_palm, A; kneel_reach stands in):
## the chapter's end, on the CineCam with A's CineFx and OmenFx. Her reflection stops copying you and presses her palm
## to yours from beneath; with one finger she writes in the water ΒΡΕΣ ΜΕ (FIND ME); deep down a glass eye opens for a
## moment; the stele's rune wakes: Stillness. The memory: "The veil was his, not mine." Shrine I of VII. Then the end
## card (Chapter I ends; Chapter II, the Hall of Casts) and she is free on the shrine floor. Done = the touch (saved
## before the film runs; Game3.seen["ch1_end"] once it has played or been skipped).

const POOL_C := Vector3(-40.0, 0.0, 15.6)
const HALF := Vector2(2.1, 2.1)
const KNEEL := Vector3(-40.0, 0.0, 18.0)        # where she kneels (the lip's middle), facing north into the pool
const TOUCH := Vector3(-40.0, 0.05, 17.42)      # where the palms meet
const STELE := Vector3(-40.0, 0.0, 11.0)
var water: Reflector
var fx: CineFx
var _layer: CanvasLayer
var _card: IntroCard
var _film: Cinematic
var _cy := 0.0                                  # the CineCam's yaw when she writes (the line reads level to it)

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var lv := game.level
	var col := Color(0.5, 0.25, 0.0)
	var m := MB.new()
	# the pool's rim: a low kerb round the sheet (the south lip wider: she kneels on it)
	var x0 := POOL_C.x - HALF.x
	var x1 := POOL_C.x + HALF.x
	var z0 := POOL_C.z - HALF.y
	var z1 := POOL_C.z + HALF.y
	m.box(Vector3(POOL_C.x, 0.05, z0 - 0.15), Vector3(x1 - x0 + 0.6, 0.1, 0.3), col)
	m.box(Vector3(POOL_C.x, 0.05, z1 + 0.15), Vector3(x1 - x0 + 0.6, 0.1, 0.3), col)
	m.box(Vector3(x0 - 0.15, 0.05, POOL_C.z), Vector3(0.3, 0.1, z1 - z0), col)
	m.box(Vector3(x1 + 0.15, 0.05, POOL_C.z), Vector3(0.3, 0.1, z1 - z0), col)
	# the stele: a tall carved slab north of the pool, facing it (its rune wakes)
	m.box(STELE + Vector3(0, 1.45, 0), Vector3(1.6, 2.9, 0.4), col)
	m.box(STELE + Vector3(0, 0.12, 0), Vector3(2.0, 0.24, 0.7), Color(0.5, 0.0, 0.0))
	m.box(STELE + Vector3(0, 2.98, 0), Vector3(1.9, 0.16, 0.55), Color(0.5, 0.0, 0.0))
	Kit3.marble(game, m.commit(), self).name = "I23_Shrine"
	lv.ob_rect(Rect2(x0 - 0.3, z0 - 0.3, x1 - x0 + 0.6, z1 - z0 + 0.3))          # (the pool: the south kerb is walkable)
	lv.ob_rect(Rect2(STELE.x - 1.0, STELE.z - 0.35, 2.0, 0.7))
	lv.add_interact("i23_touch", KNEEL, "touch", touch, 0.9, func() -> bool: return not done)

func post() -> void:
	water = TwoWorld.still_water(self, game, POOL_C + Vector3(0, 0.045, 0), HALF, Map3.rect("I23"), 0.5)
	(game.get("ch") as Ch1v3).add_refl(water)
	Kit3.rune(self, STELE + Vector3(0, 1.75, 0.21), Vector2(1.0, 1.0), Basis(), 1.0, 0.2)

func touch() -> void:
	if done or game.mode != "play": return
	game.cmd("tp:%f:%f:%f" % [KNEEL.x, KNEEL.z, 0.0])
	solve()
	game.call("save3")
	game.call("perform", "palm_to_palm", TOUCH, func() -> void: _ending(), Vector3.UP, 30.0)

# ------------------------------------------------------------------ the chapter's end
func _ending() -> void:
	var c := Cinematic.new(game)
	_film = c
	fx = CineFx.new(game.world, game.ui)
	c.add_child(fx)
	var pl := game.player
	c.at(0.0, func() -> void:
		fx.letterbox(true, 1.2)
		fx.vignette(0.45, 2.0)
		game.sfx.cue("shrine_awaken", -8.0))
	# 1 (0-6): over her shoulder, sinking toward the water: her reflection kneels with her, a half second late
	c.path(0.0, 6.0, [KNEEL + Vector3(-2.2, 2.4, 2.4), KNEEL + Vector3(-1.1, 1.45, 1.3)], [POOL_C, TOUCH + Vector3(0, 0.1, -0.4)], 42.0, 34.0)
	# 2 (6-14): she stops copying: a crimson palm presses up to yours from beneath; a ring runs through the pool
	c.at(5.6, func() -> void:
		if water:
			water.hold = true
			water.hold_k = 1.0
			water.hold_xf = Transform3D(Basis(Vector3.UP, 0.0), KNEEL + Vector3(0, 0.0, -0.05)), false)     # (A: her double plays palm_to_palm on its own rig)
	c.path(6.0, 8.0, [TOUCH + Vector3(1.0, 1.35, 0.85), TOUCH + Vector3(0.62, 1.0, 0.55)], [TOUCH + Vector3(0, -0.1, 0)], 38.0, 30.0)
	c.at(6.6, func() -> void:
		OmenFx.palm_press(game.juice, TOUCH + Vector3(0, -0.035, 0), PI, null, 2)
		fx.flash(Color(0.75, 0.05, 0.08), 0.3, 0.05, 1.2)
		fx.shake("taps", 0.35)
		game.sfx.play("glass_tink", -10.0, 0.85), false)
	c.at(7.4, func() -> void:
		if game.juice: game.juice.ring(TOUCH, 4.0, 3.5)
		game.sfx.play_later("glass_tink", 0.4, -14.0, 0.85), false)
	# 3 (14-22): from above the pool: she writes in the water with one finger: ΒΡΕΣ ΜΕ
	c.path(14.0, 8.0, [POOL_C + Vector3(-0.3, 4.4, 2.6), POOL_C + Vector3(0.0, 4.0, 2.1)], [POOL_C + Vector3(0, 0, -0.2)], 40.0, 37.0)
	c.at(14.6, func() -> void:
		var cam := game.get_viewport().get_camera_3d()
		_cy = cam.global_rotation.y if cam else 0.0
		OmenFx.write_in_water(self, POOL_C + Vector3(0, 0.05, 0.1), _cy, "ΒΡΕΣ ΜΕ", 4.2, 0.42, 3.4)
		game.sfx.play("glass_tink", -22.0, 0.8), false)
	# 4 (21.5-24): deep in the water, for a moment, a glass eye opens
	c.at(21.4, func() -> void:
		OmenFx.glass_eye(self, POOL_C + Vector3(0, 0.04, -0.2), 1.5, 1.1, 2.2, _cy)
		fx.shake("rumble", 0.3, 2.2)
		game.sfx.play("glimpse", -12.0, 0.7), false)
	# 5 (24-30): the stele's rune wakes (Stillness); the camera draws back and up; the memory
	c.path(22.0, 8.0, [POOL_C + Vector3(-0.3, 4.0, 2.1), POOL_C + Vector3(3.6, 4.6, 7.4)], [POOL_C + Vector3(0, 0.2, -0.2), STELE + Vector3(0, 1.5, 0)], 37.0, 44.0, 2)
	c.at(24.2, func() -> void:
		OmenFx.rune_wake(self, STELE + Vector3(0, 1.75, 0.2), Vector3.BACK, 2.2)
		game.ui.show_rune(1, 1)
		game.sfx.play("glass", -12.0, 0.5), false)
	c.at(24.6, func() -> void:
		if water:
			water.reach_override = -1.0
			water.hold = false
		pl.fig.rig.release())
	c.at(26.0, func() -> void: game.ui.show_memory(Game.MEMORY_LINE, 2.6, false))
	c.at(28.6, func() -> void: game.ui.show_milestone(1, Game.SHRINES_TOTAL, 2.4), false)
	# 6 (29.5-): to black; the end card (mirrored, then true, as the glass shows it); back to her, free
	c.at(29.5, func() -> void: fx.fade(1.0, 1.5, Color.BLACK), false)
	c.at(31.0, func() -> void: _end_card(), false)
	c.at(43.6, func() -> void:
		fx.fade(0.0, 2.0, Color.BLACK)
		fx.vignette(0.0, 2.0)
		fx.letterbox(false, 2.0))
	c.at(43.6, func() -> void:
		game.world.snap_to(pl.position)
		var fr := c._gameplay_frame(30.0)
		c.path(43.6, 1.4, [(fr[0] as Vector3).lerp(fr[1], 0.25), fr[0]], [fr[1]], 32.0, 30.0), false)          # (not on a skip: it would take the view back)
	c.handoff(45.0, 1.5)
	c.at(46.6, func() -> void: _close(), true)
	c.finished.connect(func() -> void: _close(), CONNECT_ONE_SHOT)
	game.call("play_cine", c)

func _end_card() -> void:
	if _film == null or _film.skipping: return
	_layer = CanvasLayer.new()
	_layer.layer = 60
	game.add_child(_layer)
	_card = IntroCard.new()
	_layer.add_child(_card)
	await _card.play_all(["End of Chapter I\n*The Veiled Gate*", "Chapter II\n*The Hall of Casts*"], 2.6)
	_free_card()

func _free_card() -> void:
	if is_instance_valid(_layer): _layer.queue_free()
	_layer = null
	_card = null

## (end or skip) everything back, the chapter marked ended and saved
func _close() -> void:
	_free_card()
	if water:
		water.hold = false
		water.reach_override = -1.0
	if fx and is_instance_valid(fx):
		fx.fade(0.0, 0.3, Color.BLACK)
		fx.letterbox(false, 0.3)
		fx.vignette(0.0, 0.3)
	game.sfx.stop_cue("shrine_awaken", 1.5)
	var pl := game.player
	if pl.fig.rig and pl.fig.rig.is_playing(): pl.fig.rig.stop(0.4)
	game.set("_acting", false)          # (the held palm clip: she is free the moment the film ends or is skipped)
	pl.locked = false
	var seen: Dictionary = game.get("seen")
	seen["ch1_end"] = true
	game.call("save3")

func apply() -> void:
	super.apply()
	if water:
		water.hold = false
		water.reach_override = -1.0

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [KNEEL.x, KNEEL.z])
	get_tree().create_timer(4.0).timeout.connect(func() -> void: game.try_interact())
