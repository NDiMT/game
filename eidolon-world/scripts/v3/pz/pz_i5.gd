extends Puzzle
## I.5 "The Crypt" (CH1_V3 §1 #7, story): Theron's dark workroom under the Atrium. A still basin glows faintly
## crimson. Kneel and touch its water: from beneath, HER hand pushes the lit Lamp up through the surface onto the rim;
## deep in the water the Warden turns (frost races over it) and the hand is gone. Take the Lamp (she holds it up from
## now on); the way north into the Atrium opens. Done = the Lamp taken.

const BASIN := Vector3(0.7, 0.0, 16.2)
const BASIN_Y := 0.6                       # the water's surface over the floor
const LAMP_AT := Vector3(0.38, 0.62, 15.95)  # on the rim, where her hand left it
var basin_mat: StandardMaterial3D
var basin_glow: ShaderMaterial
var lamp_rim: Node3D
var _dark := 0.0
var _dark_set := -1.0
var _rising := false

func build() -> void:
	jingle = false
	gate("I5", "A")
	var m := MB.new()
	m.cyl(BASIN + Vector3(0, 0.3, 0), 0.46, 0.36, 0.6, Color(0.5, 0.25, 0.0), 20)
	m.cyl(BASIN + Vector3(0, 0.03, 0), 0.5, 0.5, 0.06, Color(0.5, 0.5, 0.0), 20)
	Kit3.marble(game, m.commit(), self)
	game.level.ob_circle(Vector2(BASIN.x, BASIN.z), 0.5)
	var disc := CylinderMesh.new()
	disc.top_radius = 0.4
	disc.bottom_radius = 0.4
	disc.height = 0.01
	disc.radial_segments = 24
	disc.cap_bottom = false
	var w := MeshInstance3D.new()
	w.mesh = disc
	basin_mat = Kit3.water_mat()
	w.material_override = basin_mat
	w.position = BASIN + Vector3(0, BASIN_Y + 0.012, 0)
	w.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(w)
	basin_glow = Kit3.glow(self, BASIN + Vector3(0, BASIN_Y + 0.05, 0), 1.1, Palette.HER, 0.35)
	game.level.add_interact("i5_basin", BASIN + Vector3(0.0, 0.0, -0.85), "touch", touch, 1.1,
		func() -> bool: return not state.get("risen", false) and not _rising)
	game.level.add_interact("i5_lamp", BASIN + Vector3(-0.2, 0.0, -0.85), "take", take, 1.1,
		func() -> bool: return state.get("risen", false) and not done and not _rising)

func post() -> void:
	lamp_rim = Kit3.lamp(game)
	add_child(lamp_rim)
	lamp_rim.position = LAMP_AT
	lamp_rim.visible = false

func touch() -> void:
	progress()
	game.call("perform", "kneel_touch", BASIN + Vector3(0, BASIN_Y, -0.12), func() -> void: _rise(), Vector3.UP, 1.2)

## her hand pushes the lit Lamp up through the water; the Warden turns down there; the hand is gone
func _rise() -> void:
	_rising = true
	state["risen"] = true
	var surf := BASIN + Vector3(0, BASIN_Y + 0.012, 0)
	var palm := OmenFx.palm_press(self, surf, 0.0, null, 1)
	if game.sfx:
		game.sfx.cue("cinematic_hand", -10.0)
		game.sfx.play("glass_tink", -16.0, 0.8)
	PassThrough.water(self, surf, lamp_rim, null, 0.0, 1.8, LAMP_AT)
	var tw := create_tween()
	tw.tween_interval(2.0)
	tw.tween_callback(func() -> void:
		OmenFx.frost(self, surf + Vector3(0, 0.01, 0), Vector3.UP, Vector2(0.9, 0.9), 1.0)
		if is_instance_valid(palm): OmenFx.fade_out(palm, 0.4)
		if game.sfx: game.sfx.play("glass", -12.0, 0.45)
		if game.juice: game.juice.shake(0.05))
	tw.tween_method(func(v: float) -> void: basin_glow.set_shader_parameter("intensity", v), 0.35, 0.0, 1.2)
	tw.tween_callback(func() -> void: _rising = false)

func take() -> void:
	game.call("perform", "pickup", lamp_rim.global_position, func() -> void:
		lamp_rim.visible = false
		game.call("give", "lamp")
		solve())

func on_solved() -> void:
	if game.juice: game.juice.glint(LAMP_AT + Vector3(0, 0.3, 0))
	if game.sfx: game.sfx.play("door", -10.0, 0.9)

func apply() -> void:
	super.apply()
	_rising = false
	if done: state["risen"] = true
	lamp_rim.visible = bool(state.get("risen", false)) and not done
	lamp_rim.position = LAMP_AT
	basin_glow.set_shader_parameter("intensity", 0.0 if state.get("risen", false) else 0.35)

## the crypt is dark: the stone drinks the light but for the basin's glow and her Lamp
func tick(dt: float) -> void:
	var inside := Map3.rect("I5").grow(-0.1).has_point(Vector2(game.player.position.x, game.player.position.z))
	_dark = move_toward(_dark, 0.82 if inside else 0.0, dt / 0.8)
	var lp: Vector3 = game.call("lamp_pos")
	if lp == Vector3.INF and lamp_rim.visible: lp = lamp_rim.global_position
	if lp == Vector3.INF: lp = BASIN + Vector3(0, 0.8, 0)
	if _dark != _dark_set or _dark > 0.0:
		_dark_set = _dark
		game.level.set_darkness(_dark, lp, 3.6 if lp != BASIN + Vector3(0, 0.8, 0) else 2.2)

## the basin's glow pulses, twice
func hint() -> void:
	var tw := create_tween()
	for i in 2:
		tw.tween_method(func(v: float) -> void: basin_glow.set_shader_parameter("intensity", v), 0.35, 1.0, 0.3)
		tw.tween_method(func(v: float) -> void: basin_glow.set_shader_parameter("intensity", v), 1.0, 0.35, 0.5)

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [BASIN.x, BASIN.z - 0.85])
	var tw := create_tween()
	tw.tween_interval(4.0)
	tw.tween_callback(func() -> void: game.try_interact())
	tw.tween_interval(7.5)
	tw.tween_callback(func() -> void: game.try_interact())
