class_name Act1
extends Node3D
## v2.0 (dev/EIDOLON_SCRIPT.md §6, dev/V2_CH1.md 2): ACT 1, "Awakening". Linear, no fail; the hint comes at 30 s.
##   I.1 the plate only her reflection stands on: a sheet of still water in the wake court mirrors a glowing plate
##       that is only in HER world. Stand where your reflection stands on it (she arrives half a second after
##       you): the stub's stone door sinks.
##   I.2 the bell (Points: moved to the wake court's south side): ring it, far bells answer.
##   I.3 the first glass: a misted pane in the stub. Breathe; on the other side her hand writes ONE line; write
##       it back: the low gate at the bridge's head rises.
##   I.4 the one turning slab: the bridge's middle span is gone over a still stream. One slab turns; its other
##       half is only in the stream's reflection. Turn it until the halves meet: the span is whole.
##   I.5 the crypt (NEW, the Atrium's north-west corner, walled and roofed): dark. At its mouth a still basin:
##       a hand pushes her LIT lamp up through the water; deep in it the Warden turns, and the hand is gone.
##       Theron's cot by lamplight, and his first tablet. Then the crypt's south gate lets you out.
##   I.6 the Atrium: three cold Beacon pillars; the map opens; at the fountain she turns her head to the West.
## State: chapter.state["a1"] {plate, glass, slab, lamp, atrium}.

var game: Game
var chapter: Chapter

## (v2 rebuild, dev/V2_MAP.md) every beat stands in its own space of the new world (scripts/v2/map2.gd)
const O := Map2.O
# I.1 (the plate court: x 0..8, z 15..24; its closed door in the north wall, x 3.9..6.1)
const PUD := O + Vector3(4.0, 0.0, 20.5)      # the still sheet of water (walkable: a film on the floor)
const PUD_R := 0.95
const PLATE := PUD + Vector3(0.32, 0.0, -0.28)   # where her plate is, in her world
const PLATE_LAG := 0.55                      # (her reflection arrives this long after you)
const DOOR_GAP := [3.9, 14.85, 6.1, 15.15]
var pud_refl: Reflector
var plate_mat: ShaderMaterial
var _plate_t := 0.0
var door: Node3D
# I.3 (the glass road: x 8..17, z 10.5..14.5; the pane in the niche of its north wall, the low gate across it)
const PANE := O + Vector3(12.5, 0.0, 11.45)   # the misted pane, facing south onto the road
const GATE_X := 15.5
var gate: Node3D
var pane_mat: ShaderMaterial
# I.4 (the stream x 14.6..16.4; the crossing z 2.75..3.75: your half east, hers west, only in the water)
const SLAB_C := O + Vector3(15.5, 0.0, 3.25)
const SLAB_GOAL := 2                         # quarter turns that meet her half
var slab: Node3D
var slab_half_mat: ShaderMaterial
var stream_refl: Reflector
var turns := 0
# I.5 (the crypt: x 10..14.6, z -1..7; in from the slab on the east, out by the west door into the Atrium)
const CRYPT := Rect2(O.x + 10.0, O.z - 1.0, 4.6, 8.0)
const BASIN := O + Vector3(13.5, 0.0, 1.4)
const LAMP_POS := O + Vector3(13.39, 0.18, 1.35)       # (I.5: on the crypt basin's rim, where her hand pushed it up)
const BASIN_Y := 0.6                         # its water's surface (2 cm under the rim: the lamp's glow sits on the rim)
const EXIT_GAP := [9.85, 2.0, 10.15, 4.0]
var basin_water: MeshInstance3D
var roof: GeometryInstance3D
var exit_gate: Node3D
var _roof_k := 0.0
var _rising := false
# I.6 (the Atrium's dry fountain: a little still water in its bowl)
const FOUNT := O + Vector3(0.0, 0.88, 0.0)
var fount_refl: Reflector
var _gaze_t := -1.0
var _gaze_pose := Figure.Pose.new()
# the pool where she wakes (prologue; I.20 later): her reflection in it, its water events
var pool_refl: Reflector
var pool_fx: WaterFX
var pool_water: ShaderMaterial

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
	_build_pool()
	_build_puddle()
	_build_door()
	_build_pane()
	_build_slab()
	_build_crypt()
	_build_fountain()

func st() -> Dictionary:
	if not chapter.state.has("a1"): chapter.state["a1"] = fresh()
	return chapter.state["a1"]

static func fresh() -> Dictionary:
	return {"plate": false, "glass": false, "slab": false, "lamp": false, "atrium": false, "gaze": false}

func done() -> bool:
	return bool(st()["atrium"])

static func R(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Rect2(O.x + minf(x0, x1), O.z + minf(z0, z1), absf(x1 - x0), absf(z1 - z0))

# ------------------------------------------------------------------ helpers
func _water_mat() -> StandardMaterial3D:
	var pm := StandardMaterial3D.new()
	pm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pm.albedo_color = Color(0.3, 0.34, 0.38, 0.55)
	pm.metallic = 0.6
	pm.roughness = 0.05
	return pm

## a still, horizontal planar mirror (its own reflection pass while you are near it)
func _still_water(c: Vector3, half: Vector2, region: Rect2, lag := 0.0) -> Reflector:
	var gm := game.puzzles._mirror_quad(c, Basis(Vector3.RIGHT, -PI * 0.5), half * 2.0, false, 0.0)
	gm.set_shader_parameter("ncols", 0)
	gm.set_shader_parameter("floor_y", c.y)
	var pm := PlanarMirror.new()
	add_child(pm)
	pm.setup(Vector3.UP, c.y, gm, game.world.env)
	pm.cam.far = 20.0
	pm.res_k = 0.5
	var r := Reflector.new()
	r.kind = "pool"; r.plane_n = Vector3.UP; r.plane_d = c.y + 0.001
	r.clip_c = c; r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.BACK; r.clip_h = half
	r.region = region
	r.lag = lag
	r.planar = pm
	game.puzzles._add_refl(r)
	return r

## reflection-only (her world): the camera never draws it, every glass does
func _hers(n: Node) -> void:
	for c in n.find_children("*", "GeometryInstance3D", true, false): (c as GeometryInstance3D).layers = PlanarMirror.LAYER_DOUBLE
	if n is GeometryInstance3D: (n as GeometryInstance3D).layers = PlanarMirror.LAYER_DOUBLE

## the pool where she wakes: her reflection (the old pool's kind: a projected double, lag 0.42) and its water
func _build_pool() -> void:
	var w: Array = Map2.POOL_WATER
	pool_water = Map2.pool_mat(game.level)
	var r := Reflector.new()
	r.kind = "pool"; r.plane_n = Vector3.UP; r.plane_d = Ch1Geo.WATER_Y
	r.surface_col = Vector3(0.45, 0.5, 0.53); r.surface_mix = 0.12
	var c := O + Vector3((w[0] + w[2]) * 0.5, Ch1Geo.WATER_Y, (w[1] + w[3]) * 0.5)
	r.clip_c = c; r.clip_u = Vector3.RIGHT; r.clip_v = Vector3.BACK; r.clip_h = Vector2(absf(w[2] - w[0]) * 0.5, absf(w[3] - w[1]) * 0.5)
	r.region = R(w[0] - 2.0, w[1] - 3.0, 1.0, w[3] + 2.0)
	r.lag = 0.42; r.wrong = 1.0; r.alpha = 0.88
	game.puzzles._add_refl(r)
	pool_refl = r
	pool_fx = WaterFX.new()
	pool_fx.mats = [pool_water]
	add_child(pool_fx)
	# (v2: the one pool of the chapter's start and end: the juice, the footsteps and the Pool of Halves use it)
	game.puzzles.pool_refl = r
	game.puzzles.pool_fx = pool_fx
	game.puzzles.water_mat = pool_water

# ------------------------------------------------------------------ I.1 the plate only she stands on
func _build_puddle() -> void:
	# the sheet of water: a film on the floor you can walk through, a real reflection with her in it, late
	pud_refl = _still_water(PUD + Vector3(0, 0.012, 0), Vector2(PUD_R, PUD_R), Rect2(PUD.x - 2.4, PUD.z - 2.4, 4.8, 4.8), PLATE_LAG)
	var plate := Node3D.new()
	plate.position = PLATE + Vector3(0, 0.03, 0)
	add_child(plate)
	plate_mat = game.puzzles.rune_quad(plate, Vector3.ZERO, Vector2(0.62, 0.62), Basis(Vector3.RIGHT, -PI * 0.5), 2.0, 0.55)
	plate_mat.set_shader_parameter("hers", 1.0)
	game.puzzles.glow_quad(plate, Vector3(0, 0.02, 0), 1.0, Palette.HER, 0.5)
	_hers(plate)

## the closed door is the Tripo temple door standing in the court's north doorway (Map2.DOORS[0]); it sinks
func _build_door() -> void:
	game.level.ob_rect(R(DOOR_GAP[0], DOOR_GAP[1], DOOR_GAP[2], DOOR_GAP[3]), "a1_door")

func _door_node() -> Node3D:
	if door == null and Map2.door_nodes.size() > 0: door = Map2.door_nodes[0]
	return door

func _update_plate(dt: float) -> void:
	if st()["plate"]: return
	var p := game.player.position
	var on := Vector2(p.x - PLATE.x, p.z - PLATE.z).length() < 0.34 and game.mode == "play"
	_plate_t = _plate_t + dt if on else maxf(0.0, _plate_t - dt * 2.0)
	# the plate in the water brightens as SHE comes onto it, half a second after you
	plate_mat.set_shader_parameter("lit", 0.55 + 0.45 * clampf((_plate_t - PLATE_LAG * 0.5) / PLATE_LAG, 0.0, 1.0))
	if _plate_t >= PLATE_LAG + 0.25: open_door(false)

func open_door(instant: bool) -> void:
	st()["plate"] = true
	game.level.set_enabled("a1_door", false)
	plate_mat.set_shader_parameter("lit", 1.0)
	var d := _door_node()
	if d == null: return
	if instant:
		d.visible = false
		return
	chapter.event.emit("a1_door", null)
	var tw := d.create_tween()
	tw.tween_interval(0.4)
	tw.tween_property(d, "position:y", O.y - 3.2, 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: d.visible = false)
	if game.juice:
		game.juice.dust_floor(d.position, 0.9, 16)
		game.juice.shake(0.08)

# ------------------------------------------------------------------ I.3 the first glass (one line)
func _build_pane() -> void:
	var B := Basis()                                           # (its face south, onto the road)
	var c := PANE + Vector3(0, 1.25, 0)
	chapter._breath_glass("first", c, B, Vector2(0.8, 1.1), Vector3(99, -1, -1), false)
	var fm := MB.new()
	fm.box(PANE + Vector3(0, 0.35, -0.05), Vector3(1.0, 0.7, 0.22), Color(0.5, 0.25, 0.0))         # (its foot)
	fm.box(PANE + Vector3(-0.46, 1.25, -0.05), Vector3(0.08, 1.2, 0.1), Color(0.5, 1.0, 0.0))
	fm.box(PANE + Vector3(0.46, 1.25, -0.05), Vector3(0.08, 1.2, 0.1), Color(0.5, 1.0, 0.0))
	fm.box(PANE + Vector3(0, 1.86, -0.05), Vector3(1.0, 0.08, 0.12), Color(0.5, 1.0, 0.0))
	game.puzzles.marble_instance(fm.commit(), self)
	game.level.ob_rect(Rect2(PANE.x - 0.52, PANE.z - 0.18, 1.04, 0.3))
	game.level.add_interact("breathe_first", PANE + Vector3(0, 0, 0.75), "breathe", func() -> void:
		chapter.event.emit("breath", "first")
		game.open_glass("first"), 1.1,
		func() -> bool: return st()["plate"] and not st()["glass"])
	# the low gate across the road, beyond the glass
	gate = chapter.hub._bars(O + Vector3(GATE_X, 0.0, 12.5), 3.9, true)
	game.level.ob_rect(R(GATE_X - 0.1, 10.5, GATE_X + 0.1, 14.5), "a1_gate")

func glass_done() -> void:
	open_gate(false)

func open_gate(instant: bool) -> void:
	st()["glass"] = true
	game.level.set_enabled("a1_gate", false)
	if instant:
		gate.position.y = O.y + 2.7
		return
	chapter.event.emit("a1_gate", null)
	gate.create_tween().tween_property(gate, "position:y", O.y + 2.7, 2.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

# ------------------------------------------------------------------ I.4 the one turning slab
func _build_slab() -> void:
	# the still stream under the crossing; the half of the slab that is only in her world lies where the
	# crossing's west half should be (at the bank's height): you see it only in the stream
	stream_refl = _still_water(Vector3(SLAB_C.x, -0.545, SLAB_C.z), Vector2(0.9, 1.8), Rect2(SLAB_C.x - 3.0, SLAB_C.z - 3.0, 6.5, 6.0))
	var hb := Node3D.new()
	hb.position = SLAB_C + Vector3(-0.45, -0.15, 0)
	add_child(hb)
	var hm := MB.new()
	hm.tag = "floor"
	hm.box(Vector3.ZERO, Vector3(0.88, 0.3, 0.96), Color(0.5, 0.25, 0.0))
	game.puzzles.marble_instance(hm.commit(), hb)
	game.puzzles.rune_quad(hb, Vector3(0.2, 0.16, 0), Vector2(0.5, 0.5), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.8)
	_hers(hb)
	# your half: it turns about its middle, a carved half-rune on it
	slab = Node3D.new()
	slab.position = SLAB_C + Vector3(0.45, -0.15, 0)
	add_child(slab)
	var sm := MB.new()
	sm.tag = "floor"
	sm.box(Vector3.ZERO, Vector3(0.88, 0.3, 0.96), Color(0.5, 0.25, 0.0))
	game.puzzles.marble_instance(sm.commit(), slab)
	slab_half_mat = game.puzzles.rune_quad(slab, Vector3(0.2, 0.16, 0), Vector2(0.5, 0.5), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.35)
	game.level.add_interact("a1_turn", SLAB_C + Vector3(1.35, 0.0, 0.0), "turn", turn_slab, 1.0,
		func() -> bool: return st()["glass"] and not st()["slab"])

func turn_slab() -> void:
	if st()["slab"]: return
	turns = (turns + 1) % 4
	chapter.event.emit("pool_turn", turns)
	var tw := slab.create_tween()
	tw.tween_property(slab, "rotation:y", -PI * 0.5 * turns if turns != 0 else -TAU, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if turns == 0: tw.tween_callback(func() -> void: slab.rotation.y = 0.0)
	if game.juice: game.juice.grit(slab.position + Vector3(0, 0.1, 0), 0.4)
	if turns == SLAB_GOAL:
		tw.tween_callback(func() -> void: join_slab(false))

func join_slab(instant: bool) -> void:
	st()["slab"] = true
	turns = SLAB_GOAL
	slab.rotation.y = -PI * 0.5 * SLAB_GOAL
	game.level.set_enabled(Map2.ZP + "I4s", true)
	slab_half_mat.set_shader_parameter("lit", 1.0)
	if instant: return
	chapter.event.emit("a1_slab", null)
	if game.juice:
		game.juice.dust_floor(SLAB_C, 0.6, 12)
		game.juice.glint(SLAB_C + Vector3(0, 0.4, 0))

# ------------------------------------------------------------------ I.5 the crypt
func in_crypt(p: Vector3) -> bool:
	return CRYPT.grow(-0.2).has_point(Vector2(p.x, p.z)) and p.y < O.y + 1.5

func _build_crypt() -> void:
	var c := Color(0.5, 0.25, 0.0)
	# the vault: a covered, dark place; it fades while you are under it or on the way to it
	# its four corner piers carry the vault (the walls between them are the layout's: Map2.WALLS)
	var pm := MB.new()
	for pc in [Vector2(0.18, 0.18), Vector2(CRYPT.size.x - 0.18, 0.18), Vector2(0.18, CRYPT.size.y - 0.18), Vector2(CRYPT.size.x - 0.18, CRYPT.size.y - 0.18)]:
		var q: Vector2 = CRYPT.position + pc
		pm.box(Vector3(q.x, O.y + 1.3, q.y), Vector3(0.32, 2.6, 0.32), c)
		game.level.ob_rect(Rect2(q.x - 0.17, q.y - 0.17, 0.34, 0.34))
	game.puzzles.marble_instance(pm.commit(), self)
	var rm := MB.new()
	rm.box(Vector3(CRYPT.get_center().x, O.y + 2.75, CRYPT.get_center().y), Vector3(CRYPT.size.x, 0.3, CRYPT.size.y), c)
	roof = game.puzzles.marble_instance(rm.commit(), self)
	roof.name = "CryptRoof"
	# the still basin at its mouth (a stone bowl, water in it)
	var bm := MB.new()
	bm.cyl(BASIN + Vector3(0, 0.3, 0), 0.42, 0.34, 0.6, c, 18)
	game.puzzles.marble_instance(bm.commit(), self)
	game.level.ob_circle(Vector2(BASIN.x, BASIN.z), 0.44)
	var disc := CylinderMesh.new()
	disc.top_radius = 0.36; disc.bottom_radius = 0.36; disc.height = 0.01; disc.radial_segments = 24
	disc.cap_bottom = false                     # (one face: a film of water, nothing under it to fight)
	basin_water = MeshInstance3D.new()
	basin_water.mesh = disc
	basin_water.material_override = _water_mat()
	basin_water.position = Vector3(BASIN.x, BASIN.y + BASIN_Y, BASIN.z)
	basin_water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(basin_water)
	# the way out, west into the Atrium: the temple door in its doorway (Map2.DOORS[1]), down once you hold her lamp
	game.level.ob_rect(R(EXIT_GAP[0], EXIT_GAP[1], EXIT_GAP[2], EXIT_GAP[3]), "a1_exit")

func _exit_node() -> Node3D:
	if exit_gate == null and Map2.door_nodes.size() > 1: exit_gate = Map2.door_nodes[1]
	return exit_gate

## the lamp comes: her hand pushes it, lit, up through the basin; deep in the water the Warden turns
func _lamp_rises() -> void:
	_rising = true
	st()["lamp"] = true
	var hub: Hub = chapter.hub
	var surf := Vector3(BASIN.x, BASIN.y + BASIN_Y, BASIN.z)
	chapter.event.emit("a1_lamp", null)
	var palm := OmenFx.palm_press(self, surf, 0.0, null, 1)
	hub.lamp_bench.visible = true
	PassThrough.water(self, surf, hub.lamp_bench, null, 0.0, 1.8, Act1.LAMP_POS + Vector3(0, 0.44, 0))
	get_tree().create_timer(2.0).timeout.connect(func() -> void:
		# the Warden, deep in the water, turns sharply: the dark spreads over the basin; the hand is gone
		chapter.event.emit("warden_turn", null)
		OmenFx.frost(self, surf + Vector3(0, 0.02, 0), Vector3.UP, Vector2(0.8, 0.8), 1.0)
		if is_instance_valid(palm): OmenFx.fade_out(palm, 0.4)
		_rising = false)

func lamp_taken() -> void:
	open_exit(false)

func open_exit(instant: bool) -> void:
	game.level.set_enabled("a1_exit", false)
	var d := _exit_node()
	if d == null: return
	if instant:
		d.visible = false
		return
	var etw := d.create_tween()
	etw.tween_property(d, "position:y", O.y - 2.6, 1.4).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	etw.tween_callback(func() -> void: d.visible = false)

# ------------------------------------------------------------------ I.6 the Atrium: her head turns to the West
func _build_fountain() -> void:
	# a little still water in the dry fountain's bowl: she shows in it, and turns her head toward the West wing
	fount_refl = _still_water(FOUNT, Vector2(0.8, 0.8), Rect2(FOUNT.x - 3.2, FOUNT.z - 3.2, 6.4, 6.4))
	fount_refl.hold = false

## the first time you come to the fountain after the crypt: she is in its water, standing; she looks at you,
## then turns her head toward the West wing (a suggestion, not an order), and is gone
func _update_gaze(dt: float) -> void:
	var p := game.player.position
	if _gaze_t < 0.0:
		if st()["atrium"] and not st()["gaze"] and game.mode == "play" and Vector2(p.x - FOUNT.x, p.z - FOUNT.z).length() < 2.8:
			_gaze_t = 0.0
			fount_refl.hold = true
			chapter.event.emit("her_glimpse", null)
		return
	_gaze_t += dt
	var to_you := atan2(p.x - FOUNT.x, p.z - FOUNT.z)
	var west := atan2(-1.0, 0.0)
	var k := smoothstep(1.4, 3.0, _gaze_t)
	_gaze_pose.head_yaw = lerp_angle(0.0, wrapf(west - to_you, -PI, PI), k) * 0.9
	_gaze_pose.breath = 0.5
	fount_refl.hold_pose = _gaze_pose
	fount_refl.hold_xf = Transform3D(Basis(Vector3.UP, to_you), FOUNT + Vector3(0, 0.01, 0))
	if _gaze_t > 3.2 and not st()["gaze"]:
		st()["gaze"] = true
		chapter.event.emit("her_points", "W")
	if _gaze_t > 6.0:
		fount_refl.hold = false
		_gaze_t = -1.0

## (the 30 s hint) where Act 1 goes on from here
func hint_target() -> Vector3:
	var s := st()
	if not s["plate"]: return PLATE + Vector3(0, 0.5, 0)
	if not s["glass"]: return PANE + Vector3(0, 1.2, 0.3)
	if not s["slab"]: return SLAB_C + Vector3(0.45, 0.5, 0)
	if not s["lamp"]: return BASIN + Vector3(0, 1.0, 0)
	if not chapter.hub.has_item("lamp"): return Act1.LAMP_POS + Vector3(0, 0.8, 0)
	return O + Vector3(9.0, 1.0, 3.0)

func lamp_ready() -> bool:
	return st()["lamp"] and not _rising

# ------------------------------------------------------------------ frame, state
func update(dt: float) -> void:
	_update_plate(dt)
	_update_gaze(dt)
	var p := game.player.position
	var inside := in_crypt(p)
	var near := inside or (CRYPT.grow(1.8).has_point(Vector2(p.x, p.z)) and p.y < O.y + 1.5 and p.x > CRYPT.position.x)   # (in it, or by its door on the slab side)
	_roof_k = move_toward(_roof_k, 1.0 if near else 0.0, dt / 0.5)
	roof.transparency = _roof_k
	roof.visible = _roof_k < 0.99
	if inside and not st()["lamp"] and game.mode == "play" and Vector2(p.x - BASIN.x, p.z - BASIN.z).length() < 2.4: _lamp_rises()
	if not st()["atrium"] and chapter.hub.has_item("lamp") and game.mode == "play" and p.x < CRYPT.position.x - 0.4 \
			and Map2.space_rect("A").has_point(Vector2(p.x, p.z)):
		st()["atrium"] = true
		chapter.event.emit("a1_atrium", null)

func apply_state() -> void:
	var s := st()
	for k in fresh():
		if not s.has(k): s[k] = fresh()[k]
	_plate_t = 0.0
	_rising = false
	if s["plate"]: open_door(true)
	else:
		game.level.set_enabled("a1_door", true)
		var d := _door_node()
		if d:
			d.visible = true
			d.position.y = O.y
		plate_mat.set_shader_parameter("lit", 0.55)
	if s["glass"]: open_gate(true)
	else:
		game.level.set_enabled("a1_gate", true)
		gate.position.y = O.y
	if s["slab"]: join_slab(true)
	else:
		turns = 0
		slab.rotation.y = 0.0
		slab.visible = true
		game.level.set_enabled(Map2.ZP + "I4s", false)
		slab_half_mat.set_shader_parameter("lit", 0.35)
	if chapter.hub.has_item("lamp"): open_exit(true)
	else:
		game.level.set_enabled("a1_exit", true)
		var e := _exit_node()
		if e:
			e.visible = true
			e.position.y = O.y
	chapter.hub.lamp_bench.visible = s["lamp"] and not chapter.hub.has_item("lamp")
