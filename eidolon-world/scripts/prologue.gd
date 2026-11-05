class_name Prologue
extends Cinematic
## v2.0 (dev/EIDOLON_SCRIPT.md §5): the INTRO cards and the prologue "The Abduction" (Η Αρπαγή), 12 shots.
## The cards (white on black, each shown a moment MIRRORED, then turned true: IntroCard, Agent A), then:
##   1  down through the fog: black water, the back of the great veiled head (the Observer)
##   2  a marble threshold by the pool: a figure lying there, porcelain hands, a smooth oval for a face
##   3  the fingers move; she rises, slowly, as if learning to have joints
##   4  beside her the pool: the reflection rises HALF A SECOND LATER, and wears red
##   5  the red figure lays her palm on the surface from beneath and knocks twice
##   6  the heroine bends and reaches (Ione's four notes)
##   7  behind the red figure, in the water, the Glass Warden rises (cracked glass, hood, sculptor's apron)
##   8  a glass hand on her shoulder; she turns her oval to the heroine for a moment (the melody breaks off)
##   9  he drags her down into the fog of the water
##  10  something falls from her hand, passes up THROUGH the surface and clinks on the marble: a shell comb
##  11  the pool shows only the heroine now, half a second late: Ione is still there, hidden
##  12  the comb glows softly in the satchel; the first way lights. No text.
## Hold to skip (main.gd: a long press in mode "cine"): the cards go at once and the timeline lands on its end.

const STANZAS := [
	"On Kythira there lived a sculptor named Theron.\nFrom white marble he carved a woman,\nand loved her more than stone should be loved.",
	"Aphrodite gave her life, on one condition:\n*\"Leave her face smooth.\nA face is carved by living, from within.\"*",
	"They called her Ione.\nAnd life began to carve her a face,\na face the sculptor had never imagined.",
	"He gave her a veil.\nAnd he hid every mirror.",
	"One day the Aegean lay still as glass.",
	"There was no wave to blame."]
## (v2 rebuild) the Pool of Halves' east shore in the new world (dev/V2_MAP.md): she lies at its lip, facing west
const SHORE := Map2.O + Vector3(-3.6, 0.0, 18.0)           # where she lies, on the pool's marble lip
const SURF := Map2.O + Vector3(-4.55, Ch1Geo.WATER_Y, 18.45)  # where her palm meets the water (on her reflection's hand)
const WARDEN_AT := Map2.O + Vector3(-5.85, Ch1Geo.WATER_Y, 18.25)   # behind her reflection, in the water
const COMB_LAND := Map2.O + Vector3(-3.72, 0.0, 18.6)      # where the comb clinks down on the marble
const HEAD := Map2.O + Map2.OBSERVER                       # the Observer's veiled head, out in the inlet

var _cl: CanvasLayer
var _ring_home: Node
var _card: IntroCard
var _cards_done := false
var _cut := false                                # (skipped)
var warden_fig: WardenRig
var comb: Node3D
var _palm: MeshInstance3D
var _pose := Figure.Pose.new()
var _lag0 := 0.0
var _drag_from := Transform3D()
var _hidden: Array = []                          # the pool's stones and their reflection, put away while it plays

## the pool is black water in the prologue: its stones (and their marks in the water) are put away, and come back
func _refl() -> Reflector:
	return game.chapter.act1.pool_refl

func _water() -> ShaderMaterial:
	return game.chapter.act1.pool_water

func _stones(show: bool) -> void:
	if not show:
		_hidden.clear()
		var ch: Chapter = game.chapter
		for c in ch.pool_pieces:
			var n: Node3D = ch.pool_pieces[c]["node"]
			if n.visible: _hidden.append(n)
		for n in ch.get_children():
			if n is MeshInstance3D and (n as MeshInstance3D).material_override == ch.pool_mat: _hidden.append(n)
		for n in _hidden: (n as Node3D).visible = false
	else:
		for n in _hidden: if is_instance_valid(n): (n as Node3D).visible = true
		_hidden.clear()

func begin() -> void:
	_cl = CanvasLayer.new()
	_cl.layer = 60
	game.add_child(_cl)
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cl.add_child(bg)
	_card = IntroCard.new()
	_cl.add_child(_card)
	_ring_home = game.ui.skip_ring.get_parent()       # (the skip ring sits above the cards while they play)
	game.ui.skip_ring.reparent(_cl, false)
	_build()
	await _card.play_all(STANZAS, 3.0)
	_cards_done = true
	_end_cards()
	if _cut: return
	start()

func _end_cards() -> void:
	if _ring_home and is_instance_valid(_ring_home) and game.ui.skip_ring.get_parent() != _ring_home:
		game.ui.skip_ring.reparent(_ring_home, false)
	if is_instance_valid(_cl):
		_cl.queue_free()
	_cl = null

## (devshots) skip the cards and run the clock to t (forward only)
func dev_seek(to: float) -> void:
	if not _cards_done:
		_cards_done = true
		if is_instance_valid(_card): _card.skip()
		_end_cards()
		start()
	while to > t + 0.001: _step(minf(0.1, to - t))      # (small steps: a camera key lands only inside its own window)

## (dev jumps / tests) drop it where it stands: no state from it, every piece of it gone
func abort() -> void:
	_cut = true
	running = false
	_end_cards()
	_refl().hold = false
	if _lag0 > 0.0: _refl().lag = _lag0
	if is_instance_valid(warden_fig): warden_fig.queue_free()
	if is_instance_valid(comb): comb.queue_free()
	if is_instance_valid(_palm): _palm.queue_free()
	OmenFx.murk(_water(), 0.0, 0.01)
	_stones(true)

func skip() -> void:
	_cut = true
	if not _cards_done:
		_cards_done = true
		if is_instance_valid(_card): _card.skip()
		_end_cards()
		start()
	super.skip()

func _build() -> void:
	clear()
	var pz: Puzzles = game.puzzles
	var ch: Chapter = game.chapter
	var j: Node3D = game.juice
	var refl: Reflector = _refl()
	var fx: WaterFX = game.chapter.act1.pool_fx
	var wm: ShaderMaterial = _water()
	_lag0 = refl.lag
	var yaw := -PI * 0.25
	var pitch := -World.PITCH
	var size: float = game.world.zoom
	# 1: down through the fog onto the black water and the back of the Observer's veiled head
	at(0.0, func() -> void:
		game.player.teleport(SHORE, PI * 0.5)
		_stones(false)
		game.player.crouch = 1.0
		game.player.locked = true
		refl.lag = 0.5
		game.ui.fade_to(0.0, 2.5))
	cam(0.0, 0.01, HEAD + Vector3(-3.0, 3.5, 4.0), yaw, pitch, size * 1.25)
	at(1.0, func() -> void: game.sfx.play("bell", -26.0, 0.6), false)
	# 2: the marble threshold, the figure lying on it
	cam(4.0, 5.0, SHORE + Vector3(0.3, 0.6, 0.2), yaw, pitch, size * 0.7)
	at(8.0, func() -> void: game.sfx.play("step_wet", -22.0, 0.6), false)
	# 3: she rises, slowly, unnaturally (stone creaks)
	at(9.0, func() -> void: game.sfx.play("grind", -18.0, 0.55), false)
	anim(9.0, 4.0, func(k: float) -> void: game.player.crouch = 1.0 - k, 1)
	# 4: the pool: her reflection comes up half a second later, in red; one lyre note
	cam(12.0, 2.5, SHORE + Vector3(-0.9, 0.4, 0.0), yaw, pitch, size * 0.62)
	at(13.2, func() -> void: game.sfx.note("A", -12.0), false)
	# 5: her palm on the surface from beneath; two knocks on glass
	at(15.0, func() -> void: _palm = OmenFx.palm_press(j, SURF, PI * 0.5, fx, 2))
	at(16.0, func() -> void: game.sfx.play("glass_tink", -12.0, 0.9), false)
	at(16.6, func() -> void: game.sfx.play("glass_tink", -12.0, 0.9), false)
	# 6: the heroine bends and reaches; Ione's four notes
	anim(18.0, 1.6, func(k: float) -> void: game.player.crouch = 0.38 * k, 1)
	at(18.2, func() -> void: game.sfx.motif(-12.0, 0.5), false)
	# 7: behind the red figure, IN the water, the Glass Warden rises
	at(20.0, func() -> void:
		warden_fig = WardenRig.new()
		j.add_child(warden_fig)
		warden_fig.global_position = WARDEN_AT
		warden_fig.rotation.y = PI * 0.5
		warden_fig.set_look("glass")
		warden_fig.rise_from(Ch1Geo.WATER_Y, 3.2, Ch1Geo.WATER_Y - 0.55, fx))
	at(20.2, func() -> void: game.sfx.play("glass", -10.0, 0.4), false)
	cam(20.0, 3.0, SURF + Vector3(-0.6, 0.6, 0.0), yaw, pitch, size * 0.66)
	# 8: a glass hand on her shoulder; she turns her oval to the heroine for a moment (the melody breaks)
	at(24.0, func() -> void:
		refl.hold = true
		refl.hold_xf = refl.refl_xf
		_pose.head_yaw = 0.0
		refl.hold_pose = _pose)
	anim(24.0, 1.2, func(k: float) -> void: _pose.head_yaw = -0.9 * k, 1)
	# 9: he drags her down into the fog of the water
	at(26.5, func() -> void:
		_drag_from = refl.hold_xf
		if is_instance_valid(_palm): OmenFx.fade_out(_palm, 0.6)
		OmenFx.murk(wm, 1.0, 2.0))
	at(26.6, func() -> void: game.sfx.play("whoosh", -9.0, 0.5), false)
	anim(26.5, 2.2, func(k: float) -> void:
		refl.hold_xf = Transform3D(_drag_from.basis, _drag_from.origin.lerp(_drag_from.origin + Vector3(-1.6, 1.4, 0.0), k)), 3)
	anim(26.5, 2.2, func(k: float) -> void:
		if is_instance_valid(warden_fig): warden_fig.global_position.y = lerpf(Ch1Geo.WATER_Y - 0.55, Ch1Geo.WATER_Y - 3.0, k), 3)
	# 10: the comb comes up THROUGH the surface and clinks on the marble
	at(29.0, func() -> void:
		comb = _comb_model()
		j.add_child(comb)
		comb.global_position = COMB_LAND
		PassThrough.water(j, SURF + Vector3(0.25, 0.0, 0.3), comb, fx, 0.35, 1.6, COMB_LAND))
	at(30.4, func() -> void: game.sfx.play("glass_tink", -10.0, 1.6), false)
	cam(29.0, 2.0, COMB_LAND + Vector3(-0.3, 0.3, 0.0), yaw, pitch, size * 0.6)
	# 11: the pool shows only the heroine, half a second late: she is still there, hidden
	at(32.0, func() -> void:
		refl.hold = false
		OmenFx.murk(wm, 0.0, 2.5))
	anim(32.0, 2.0, func(k: float) -> void: game.player.crouch = 0.38 * (1.0 - k), 1)
	# 12: the comb glows in the satchel; the first way lights (no text)
	at(35.0, func() -> void:
		if is_instance_valid(comb): comb.queue_free()
		var story: Array = ch.state["inv"]["story"]
		if not ("comb" in story): story.append("comb")
		if game.juice: game.juice.glint(game.player.position + Vector3(0, 0.8, 0)))
	at(35.1, func() -> void: game.ui.show_item("comb", ""), false)
	at(35.3, func() -> void: game.sfx.resolve(1), false)
	at(36.0, func() -> void: if game.juice: game.juice.glint(ch.act1.PLATE + Vector3(0, 0.3, 0)))
	cam(35.0, 3.0, SHORE, yaw, pitch, size)
	at(38.0, func() -> void:
		refl.lag = _lag0
		_stones(true)
		if is_instance_valid(warden_fig): warden_fig.queue_free()
		game.player.crouch = 0.0
		ch.state["prologue_seen"] = true)

func _comb_model() -> Node3D:
	var p := "res://assets/models/items/item_comb.glb"
	if ResourceLoader.exists(p):
		var n: Node3D = (load(p) as PackedScene).instantiate()
		n.scale = Vector3.ONE * 2.2
		return n
	var m := MB.new()
	m.box(Vector3(0, 0.03, 0), Vector3(0.1, 0.03, 0.08), Color(0.5, 0.25, 0.0))
	var root := Node3D.new()
	game.puzzles.marble_instance(m.commit(), root)
	return root
