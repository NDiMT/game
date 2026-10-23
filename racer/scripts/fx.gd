class_name Fx
## Shared particle / effect helpers (CPU particles: cheap, reliable on web + mobile).

static var _soft: Texture2D
static var _mats := {}

static func soft_tex() -> Texture2D:
	if _soft == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		g.add_point(0.45, Color(1, 1, 1, 0.55))
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(0.5, 0.0)
		t.width = 64; t.height = 64
		_soft = t
	return _soft

## billboard particle material; additive for fire/sparks, alpha for smoke/dust
static func particle_mat(additive: bool) -> StandardMaterial3D:
	var key := "add" if additive else "mix"
	if _mats.has(key): return _mats[key]
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = soft_tex()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if additive: m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.no_depth_test = false
	m.disable_receive_shadows = true
	_mats[key] = m
	return m

static func ramp(cols: Array) -> Gradient:
	var g := Gradient.new()
	var offs := PackedFloat32Array()
	for i in cols.size(): offs.append(float(i) / (cols.size() - 1))
	g.offsets = offs
	g.colors = PackedColorArray(cols)
	return g

static func emitter(additive: bool, amount: int, life: float, size: float) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	q.material = particle_mat(additive)
	p.mesh = q
	p.amount = amount
	p.lifetime = life
	p.local_coords = false
	p.emitting = false
	return p

## one-shot spark burst
static func sparks(parent: Node, at: Vector3, normal: Vector3, strength := 1.0) -> void:
	var p := emitter(true, int(14 + 16 * strength), 0.45, 0.22)
	p.one_shot = true
	p.explosiveness = 0.95
	p.direction = normal
	p.spread = 70.0
	p.initial_velocity_min = 6.0 * strength
	p.initial_velocity_max = 15.0 * strength
	p.gravity = Vector3(0, -14, 0)
	p.scale_amount_min = 0.3; p.scale_amount_max = 0.8
	p.color_ramp = ramp([Color(1, 0.95, 0.6), Color(1, 0.6, 0.15), Color(0.8, 0.2, 0.05, 0)])
	parent.add_child(p)
	p.global_position = at
	p.emitting = true
	p.get_tree().create_timer(0.8).timeout.connect(p.queue_free)

## fireball + smoke + debris + flash
static func explosion(parent: Node, at: Vector3, size := 1.0) -> void:
	var root := Node3D.new()
	parent.add_child(root)
	root.global_position = at
	var fire := emitter(true, 26, 0.7, 2.6 * size)
	fire.one_shot = true; fire.explosiveness = 1.0
	fire.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	fire.emission_sphere_radius = 1.0 * size
	fire.direction = Vector3.UP; fire.spread = 180.0
	fire.initial_velocity_min = 3.0; fire.initial_velocity_max = 9.0 * size
	fire.gravity = Vector3(0, 3, 0)
	fire.damping_min = 4.0; fire.damping_max = 6.0
	fire.scale_amount_min = 0.6; fire.scale_amount_max = 1.4
	fire.scale_amount_curve = _grow_curve()
	fire.color_ramp = ramp([Color(1, 0.95, 0.7), Color(1, 0.55, 0.12), Color(0.7, 0.18, 0.04, 0.7), Color(0.1, 0.05, 0.03, 0)])
	root.add_child(fire)
	var smoke := emitter(false, 18, 1.8, 3.2 * size)
	smoke.one_shot = true; smoke.explosiveness = 0.85
	smoke.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	smoke.emission_sphere_radius = 1.2 * size
	smoke.direction = Vector3.UP; smoke.spread = 60.0
	smoke.initial_velocity_min = 2.0; smoke.initial_velocity_max = 6.0
	smoke.gravity = Vector3(0, 1.5, 0)
	smoke.damping_min = 1.0; smoke.damping_max = 2.0
	smoke.scale_amount_curve = _grow_curve()
	smoke.color_ramp = ramp([Color(0.25, 0.2, 0.17, 0.0), Color(0.22, 0.18, 0.15, 0.75), Color(0.35, 0.3, 0.26, 0)])
	root.add_child(smoke)
	var deb := emitter(true, 24, 0.9, 0.3)
	deb.one_shot = true; deb.explosiveness = 1.0
	deb.direction = Vector3.UP; deb.spread = 75.0
	deb.initial_velocity_min = 10.0; deb.initial_velocity_max = 22.0 * size
	deb.gravity = Vector3(0, -20, 0)
	deb.color_ramp = ramp([Color(1, 0.9, 0.5), Color(1, 0.45, 0.1), Color(0.5, 0.1, 0.0, 0)])
	root.add_child(deb)
	var light := OmniLight3D.new()
	light.light_color = Color(1, 0.6, 0.25)
	light.light_energy = 6.0
	light.omni_range = 14.0 * size
	root.add_child(light)
	fire.emitting = true; smoke.emitting = true; deb.emitting = true
	var tw := root.create_tween()
	tw.tween_property(light, "light_energy", 0.0, 0.35)
	root.get_tree().create_timer(2.2).timeout.connect(root.queue_free)

static var _grow: Curve
static func _grow_curve() -> Curve:
	if _grow == null:
		_grow = Curve.new()
		_grow.max_value = 1.5
		_grow.add_point(Vector2(0, 0.35))
		_grow.add_point(Vector2(0.3, 0.9))
		_grow.add_point(Vector2(1, 1.25))
	return _grow
