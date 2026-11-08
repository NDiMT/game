extends Puzzle
## N.6 "The Tree of Shards" (CH1_V3 §1 #25, landmark): a dead tree in the court's corner, hung with three hundred
## shards of her glass on threads; they turn in the air and chime when you pass under. Done = arrived.
## (placeholder: A's P1 "N6 300 shards (MultiMesh) sparkle" swaps N6_Shards / N6_Tree by name)

const TREE := Vector3(-2.4, 2.0, -51.6)
var shards: MultiMeshInstance3D
var _t := 0.0
var _chime := 0.0

func build() -> void:
	jingle = false
	hint_after = 1.0e9
	var m := MB.new()
	m.cyl(TREE + Vector3(0, 1.1, 0), 0.14, 0.24, 2.2, Color(0.5, 0.97, 0.0), 8)
	for k in 5:
		var a := TAU * k / 5.0 + 0.4
		var d := Vector3(cos(a), 0.0, sin(a))
		m.box(TREE + Vector3(0, 2.0 + 0.12 * k, 0) + d * 0.6, Vector3(1.2 if absf(d.x) > 0.5 else 0.08, 0.07, 1.2 if absf(d.z) > 0.5 else 0.08), Color(0.5, 0.97, 0.0))
	var mi := Kit3.marble(game, m.commit(), self)
	mi.name = "N6_Tree"
	game.level.ob_circle(Vector2(TREE.x, TREE.z), 0.32)

func post() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 300
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	var q := QuadMesh.new()
	q.size = Vector2(0.07, 0.13)
	mm.mesh = q
	mm.instance_count = 300
	for i in 300:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 1.5
		var p := TREE + Vector3(cos(a) * r, rng.randf_range(1.45, 2.55), sin(a) * r)
		mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, rng.randf() * TAU), p))
	shards = MultiMeshInstance3D.new()
	shards.name = "N6_Shards"
	shards.multimesh = mm
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.86, 0.9, 0.96)
	sm.metallic = 0.9
	sm.roughness = 0.08
	sm.cull_mode = BaseMaterial3D.CULL_DISABLED
	sm.emission_enabled = true
	sm.emission = Color(0.55, 0.12, 0.16)
	sm.emission_energy_multiplier = 0.25
	shards.material_override = sm
	shards.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(shards)

func tick(dt: float) -> void:
	_t += dt
	if shards and here(): shards.rotation.y = sin(_t * 0.3) * 0.04
	if not here() or game.mode != "play": return
	if not done:
		solve()
		if game.sfx: game.sfx.play("chime_hall", -14.0, 1.3)
	_chime -= dt
	if _chime <= 0.0 and near(TREE, 2.4) and game.player.speed01 > 0.2:
		_chime = randf_range(0.6, 1.4)
		if game.sfx: game.sfx.play("glass_tink", -24.0, randf_range(1.3, 1.9))

func autosolve() -> void:
	game.cmd("walk:%f:%f" % [0.0, -49.0])
