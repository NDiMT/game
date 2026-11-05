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

# I.1
const PUD := Vector3(3.3, 0.0, 0.6)          # the still sheet of water in the wake court (walkable: a film on the floor)
const PUD_R := 0.95
const PLATE := Vector3(3.62, 0.0, 0.32)      # where her plate is, in her world
const PLATE_LAG := 0.55                      # (her reflection arrives this long after you)
var pud_refl: Reflector
var plate_mat: ShaderMaterial
var _plate_t := 0.0
var door: Node3D
# I.3
const PANE := Vector3(0.78, 0.0, 6.15)       # the misted pane, in the stub, facing west across the way
var gate: Node3D
var pane_mat: ShaderMaterial
# I.4
const SLAB_Z := 8.475                        # the bridge's middle span
const SLAB_GOAL := 2                         # quarter turns that meet her half
var slab: Node3D
var slab_half_mat: ShaderMaterial
var stream_refl: Reflector
var turns := 0
# I.5
const CRYPT := Rect2(-3.6, 9.95, 5.5, 2.95)  # x -3.6..1.9, z 9.95..12.9
const BASIN := Vector3(1.05, 0.5, 10.95)
const BASIN_Y := 0.5 + 0.62                  # its water's surface
var basin_water: MeshInstance3D
var roof: GeometryInstance3D
var exit_gate: Node3D
var _roof_k := 0.0
var _rising := false
# I.6
const FOUNT := Vector3(5.0, 1.38, 16.0)      # the water in the dry fountain's bowl
var fount_refl: Reflector
var _gaze_t := -1.0
var _gaze_pose := Figure.Pose.new()

func setup(g: Game, ch: Chapter) -> void:
	game = g
	chapter = ch
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

func _build_door() -> void:
	door = Node3D.new()
	door.position = Vector3(0.0, 0.0, 5.1)
	add_child(door)
	var m := MB.new()
	m.box(Vector3(0, 1.2, 0), Vector3(1.74, 2.4, 0.18), Color(0.5, 0.25, 0.0))
	game.puzzles.marble_instance(m.commit(), door)
	game.puzzles.rune_quad(door, Vector3(0, 1.35, -0.1), Vector2(0.5, 0.5), Basis(Vector3.UP, PI), 2.0, 0.25)
	game.level.ob_rect(Level.R(-1.0, 5.0, 1.0, 5.2), "a1_door")

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
	if instant:
		door.visible = false
		return
	chapter.event.emit("a1_door", null)
	var tw := door.create_tween()
	tw.tween_interval(0.4)
	tw.tween_property(door, "position:y", -2.5, 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_callback(func() -> void: door.visible = false)
	if game.juice:
		game.juice.dust_floor(door.position, 0.9, 16)
		game.juice.shake(0.08)

# ------------------------------------------------------------------ I.3 the first glass (one line)
func _build_pane() -> void:
	var B := Basis(Vector3.UP, -PI * 0.5)                        # (its face west, across the stub)
	var c := PANE + Vector3(0, 1.25, 0)
	chapter._breath_glass("first", c, B, Vector2(0.8, 1.1), Vector3(99, -1, -1), false)
	var fm := MB.new()
	fm.box(PANE + Vector3(0.05, 0.35, 0), Vector3(0.22, 0.7, 1.0), Color(0.5, 0.25, 0.0))         # (its foot)
	fm.box(PANE + Vector3(0.05, 1.25, -0.46), Vector3(0.1, 1.2, 0.08), Color(0.5, 1.0, 0.0))
	fm.box(PANE + Vector3(0.05, 1.25, 0.46), Vector3(0.1, 1.2, 0.08), Color(0.5, 1.0, 0.0))
	fm.box(PANE + Vector3(0.05, 1.86, 0), Vector3(0.12, 0.08, 1.0), Color(0.5, 1.0, 0.0))
	game.puzzles.marble_instance(fm.commit(), self)
	game.level.ob_rect(Level.R(PANE.x - 0.08, PANE.z - 0.52, PANE.x + 0.2, PANE.z + 0.52))
	game.level.add_interact("breathe_first", PANE + Vector3(-0.72, 0, 0), "breathe", func() -> void:
		chapter.event.emit("breath", "first")
		game.open_glass("first"), 1.1,
		func() -> bool: return st()["plate"] and not st()["glass"])
	gate = game.chapter.hub._bars(Vector3(0.0, 0.0, 7.36), 1.7, false)
	game.level.ob_rect(Level.R(-1.0, 7.26, 1.0, 7.46), "a1_gate")

func glass_done() -> void:
	open_gate(false)

func open_gate(instant: bool) -> void:
	st()["glass"] = true
	game.level.set_enabled("a1_gate", false)
	if instant:
		gate.position.y = 2.7
		return
	chapter.event.emit("a1_gate", null)
	gate.create_tween().tween_property(gate, "position:y", 2.7, 2.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)

# ------------------------------------------------------------------ I.4 the one turning slab
func _build_slab() -> void:
	# the still stream under the bridge's missing span; the half of the slab that is only in her world stands
	# where the span should be (at the bridge's height): you see it only in the stream
	stream_refl = _still_water(Vector3(0.0, -0.9, SLAB_Z), Vector2(1.3, 0.62), Rect2(-2.0, 6.4, 4.0, 3.4))
	var y := 0.5 * (SLAB_Z - 7.3) / (9.65 - 7.3) - 0.16
	var tilt := -atan2(0.5, 9.65 - 7.3)                   # (the bridge's own slope)
	var hb := Node3D.new()
	hb.position = Vector3(0.46, y, SLAB_Z)
	hb.rotation.x = tilt
	add_child(hb)
	var hm := MB.new()
	hm.tag = "floor"
	hm.box(Vector3.ZERO, Vector3(0.88, 0.3, 0.76), Color(0.5, 0.25, 0.0))
	game.puzzles.marble_instance(hm.commit(), hb)
	game.puzzles.rune_quad(hb, Vector3(-0.2, 0.16, 0), Vector2(0.5, 0.5), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.8)
	_hers(hb)
	# your half: it turns on a pivot at the span's west edge, a carved half-rune on it
	slab = Node3D.new()
	slab.position = Vector3(-0.46, y, SLAB_Z)
	add_child(slab)
	var sm := MB.new()
	sm.tag = "floor"
	sm.box(Vector3.ZERO, Vector3(0.88, 0.3, 0.76), Color(0.5, 0.25, 0.0))
	game.puzzles.marble_instance(sm.commit(), slab)
	slab_half_mat = game.puzzles.rune_quad(slab, Vector3(0.2, 0.16, 0), Vector2(0.5, 0.5), Basis(Vector3.RIGHT, -PI * 0.5), 3.0, 0.35)
	game.level.ob_rect(Level.R(-1.0, SLAB_Z - 0.39, 1.0, SLAB_Z + 0.39), "a1_gap")
	game.level.add_interact("a1_turn", Vector3(-0.3, 0.2, SLAB_Z - 0.75), "turn", turn_slab, 1.0,
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
	game.level.set_enabled("a1_gap", false)
	slab_half_mat.set_shader_parameter("lit", 1.0)
	var mid: Node3D = chapter.hub.slabs[1]
	mid.visible = true
	slab.visible = false
	if instant: return
	chapter.event.emit("a1_slab", null)
	if game.juice:
		game.juice.dust_floor(mid.position, 0.6, 12)
		game.juice.glint(mid.position + Vector3(0, 0.4, 0))

# ------------------------------------------------------------------ I.5 the crypt
func in_crypt(p: Vector3) -> bool:
	return p.x > CRYPT.position.x + 0.2 and p.x < CRYPT.end.x - 0.2 and p.z > CRYPT.position.y + 0.25 and p.z < CRYPT.end.y - 0.2 and p.y < 1.5

func _build_crypt() -> void:
	var y0 := WorldGeo.A_Y
	var c := Color(0.5, 0.25, 0.0)
	var x0 := CRYPT.position.x
	var x1 := CRYPT.end.x
	var z0 := CRYPT.position.y
	var z1 := CRYPT.end.y
	var m := MB.new()
	# low walls all round (the crypt stands between the camera and the bridge: nothing tall may hide the way),
	# a vault on six piers over it; the dark inside does the rest
	for seg in [[x0, -1.05], [1.05, x1]]:
		m.box(Vector3((seg[0] + seg[1]) * 0.5, y0 + 0.5, z0 + 0.12), Vector3(seg[1] - seg[0], 1.0, 0.24), c)
		game.level.ob_rect(Level.R(seg[0], z0, seg[1], z0 + 0.24))
	m.box(Vector3(x1 - 0.12, y0 + 0.5, (z0 + z1) * 0.5), Vector3(0.24, 1.0, z1 - z0 - 0.5), c)
	game.level.ob_rect(Level.R(x1 - 0.24, z0, x1, z1))
	m.box(Vector3(x0 + 0.12, y0 + 0.5, (z0 + z1) * 0.5), Vector3(0.24, 1.0, z1 - z0 - 0.5), c)
	game.level.ob_rect(Level.R(x0, z0, x0 + 0.24, z1))
	for seg in [[x0 + 0.25, -0.65], [0.65, x1 - 0.25]]:
		m.box(Vector3((seg[0] + seg[1]) * 0.5, y0 + 0.5, z1 - 0.12), Vector3(seg[1] - seg[0], 1.0, 0.24), c)
		game.level.ob_rect(Level.R(seg[0], z1 - 0.24, seg[1], z1))
	# the piers (the four corners, and either side of the way in)
	for pp in [Vector2(x0 + 0.125, z0 + 0.125), Vector2(x1 - 0.125, z0 + 0.125), Vector2(x0 + 0.125, z1 - 0.125), Vector2(x1 - 0.125, z1 - 0.125),
			Vector2(-1.2, z0 + 0.12), Vector2(1.2, z0 + 0.12)]:
		m.box(Vector3(pp.x, y0 + 1.3, pp.y), Vector3(0.3, 2.6, 0.3), c)
	game.puzzles.marble_instance(m.commit(), self)
	# the vault: it reads as a covered place from the Atrium; it fades while you are under it or on the way to it
	var rm := MB.new()
	rm.box(Vector3((x0 + x1) * 0.5, y0 + 2.75, (z0 + z1) * 0.5), Vector3(x1 - x0, 0.3, z1 - z0), c)
	roof = game.puzzles.marble_instance(rm.commit(), self)
	roof.name = "CryptRoof"
	# the still basin at its mouth (a stone bowl, water in it)
	var bm := MB.new()
	bm.cyl(BASIN + Vector3(0, 0.3, 0), 0.42, 0.34, 0.6, c, 18)
	game.puzzles.marble_instance(bm.commit(), self)
	game.level.ob_circle(Vector2(BASIN.x, BASIN.z), 0.44)
	var disc := CylinderMesh.new()
	disc.top_radius = 0.36; disc.bottom_radius = 0.36; disc.height = 0.01; disc.radial_segments = 24
	basin_water = MeshInstance3D.new()
	basin_water.mesh = disc
	basin_water.material_override = _water_mat()
	basin_water.position = Vector3(BASIN.x, BASIN_Y, BASIN.z)
	basin_water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(basin_water)
	# the way out, south into the Atrium: a low grille, up once you hold her lamp
	exit_gate = Node3D.new()
	exit_gate.position = Vector3(0.0, y0, z1 - 0.12)
	add_child(exit_gate)
	var gm := MB.new()
	for i in 6:
		gm.cyl(Vector3(-0.5 + i * 0.2, 0.55, 0), 0.03, 0.03, 1.1, Color(0.5, 1.0, 0.0), 6)
	gm.box(Vector3(0, 1.08, 0), Vector3(1.16, 0.06, 0.06), Color(0.5, 1.0, 0.0))
	game.puzzles.marble_instance(gm.commit(), exit_gate)
	game.level.ob_rect(Level.R(-0.65, z1 - 0.24, 0.65, z1), "a1_exit")

## the lamp comes: her hand pushes it, lit, up through the basin; deep in the water the Warden turns
func _lamp_rises() -> void:
	_rising = true
	st()["lamp"] = true
	var hub: Hub = chapter.hub
	var surf := Vector3(BASIN.x, BASIN_Y, BASIN.z)
	chapter.event.emit("a1_lamp", null)
	var palm := OmenFx.palm_press(self, surf, 0.0, null, 1)
	hub.lamp_bench.visible = true
	PassThrough.water(self, surf, hub.lamp_bench, null, 0.0, 1.8, WorldGeo.LAMP_POS + Vector3(0, 0.44, 0))
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
	if instant:
		exit_gate.visible = false
		return
	var etw := exit_gate.create_tween()
	etw.tween_property(exit_gate, "position:y", WorldGeo.A_Y - 1.15, 1.4).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	etw.tween_callback(func() -> void: exit_gate.visible = false)

# ------------------------------------------------------------------ I.6 the Atrium: her head turns to the West
func _build_fountain() -> void:
	# a little still water in the dry fountain's bowl: she shows in it, and turns her head toward the West wing
	fount_refl = _still_water(FOUNT, Vector2(0.8, 0.8), Rect2(1.8, 12.8, 6.4, 6.4))
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

func lamp_ready() -> bool:
	return st()["lamp"] and not _rising

# ------------------------------------------------------------------ frame, state
func update(dt: float) -> void:
	_update_plate(dt)
	_update_gaze(dt)
	var p := game.player.position
	var inside := in_crypt(p)
	var near := inside or (absf(p.x) < 2.2 and p.z > 4.6 and p.z < 13.4 and p.y < 1.5)       # (on the stub, the bridge, under it)
	_roof_k = move_toward(_roof_k, 1.0 if near else 0.0, dt / 0.5)
	roof.transparency = _roof_k
	roof.visible = _roof_k < 0.99
	if inside and not st()["lamp"] and game.mode == "play" and p.distance_to(BASIN) < 2.4: _lamp_rises()
	if not st()["atrium"] and chapter.hub.has_item("lamp") and game.mode == "play" and p.z > CRYPT.end.y + 0.4 and p.y < 1.5:
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
		door.visible = true
		door.position.y = 0.0
		plate_mat.set_shader_parameter("lit", 0.55)
	if s["glass"]: open_gate(true)
	else:
		game.level.set_enabled("a1_gate", true)
		gate.position.y = 0.0
	if s["slab"]: join_slab(true)
	else:
		turns = 0
		slab.rotation.y = 0.0
		slab.visible = true
		(chapter.hub.slabs[1] as Node3D).visible = false
		game.level.set_enabled("a1_gap", true)
		slab_half_mat.set_shader_parameter("lit", 0.35)
	if chapter.hub.has_item("lamp"): open_exit(true)
	else:
		game.level.set_enabled("a1_exit", true)
		exit_gate.visible = true
		exit_gate.position.y = WorldGeo.A_Y
	chapter.hub.lamp_bench.visible = s["lamp"] and not chapter.hub.has_item("lamp")
