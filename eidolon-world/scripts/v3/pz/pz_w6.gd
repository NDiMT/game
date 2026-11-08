extends Puzzle
## W.6 "The Hidden Way" (CH1_V3 §1 #16, between: a reveal). The landing seems to end in a wall. Raised here, the Shard
## shows a doorway in that wall that exists only in HER world; once seen, it is there for you too (the stretch of wall
## sinks) and the way down to the Glass Beacon is open. Done = the door seen.

const DOOR := Vector3(-43.0, 2.1, -6.1)
var arch: ShaderMaterial

func build() -> void:
	jingle = false
	gate("W6", "WB")

func post() -> void:
	arch = ShaderMaterial.new()
	arch.shader = preload("res://shaders/lens_only.gdshader")
	arch.set_shader_parameter("noise_tex", game.level.noise_tex)
	arch.set_shader_parameter("kind", 2.0)
	arch.render_priority = 3
	var q := QuadMesh.new()
	q.size = Vector2(2.4, 2.6)
	var mi := MeshInstance3D.new()
	mi.name = "W6_HerDoor"
	mi.mesh = q
	mi.material_override = arch
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = DOOR + Vector3(0, 0, -0.2)
	mi.layers = TwoWorld.MINE
	add_child(mi)

func tick(_dt: float) -> void:
	if here() and not done:
		game.set("lens_at", DOOR)
		if game.controls: game.controls.inv_pulse = not game.get("lens_on") and idle_t > 6.0
		if game.get("lens_on") and near(DOOR, 4.5):
			solve()
			if game.sfx: game.sfx.play("door", -10.0, 0.9)
			if game.juice: game.juice.dust_floor(Vector3(DOOR.x, 1.0, DOOR.z), 1.0, 16)
	elif game.get("lens_at") == DOOR:
		game.set("lens_at", Vector3.INF)
		if game.controls: game.controls.inv_pulse = false

func hint() -> void:
	if game.controls: game.controls.inv_pulse = true
	if game.juice: game.juice.glint(DOOR)

func autosolve() -> void:
	if not game.call("has_item", "shard"): game.call("give", "shard", false)
	game.cmd("walk:%f:%f" % [DOOR.x, DOOR.z - 2.0])
	get_tree().create_timer(3.0).timeout.connect(func() -> void: game.cmd("lens:1"))
