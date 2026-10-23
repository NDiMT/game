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
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF # smoke must not paint dark blobs
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

const RING_SHADER := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 tint : source_color = vec4(1.0, 0.6, 0.25, 1.0);
uniform float fade = 1.0;
uniform float width = 0.12;
uniform float pulse = 0.0;
void fragment() {
	float r = length(UV - vec2(0.5)) * 2.0;
	float ring = smoothstep(1.0 - width, 1.0 - width * 0.4, r) * (1.0 - smoothstep(1.0 - width * 0.4, 1.0, r));
	float inner = (1.0 - smoothstep(0.0, 1.0, r)) * 0.12 * pulse;
	ALBEDO = tint.rgb;
	ALPHA = clamp((ring + inner) * fade * tint.a, 0.0, 1.0);
}
"""
static var _ring_shader: Shader
static var _chunk_mesh: Mesh

## flat additive ring (shockwave / mine proximity ring) lying in the node's XZ plane
static func ring_mesh(size: float, tint: Color, width := 0.12) -> MeshInstance3D:
	if _ring_shader == null:
		_ring_shader = Shader.new()
		_ring_shader.code = RING_SHADER
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	q.orientation = PlaneMesh.FACE_Y
	var m := ShaderMaterial.new()
	m.shader = _ring_shader
	m.set_shader_parameter("tint", tint)
	m.set_shader_parameter("width", width)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

## fireball + smoke column + debris chunks + sparks + shockwave ring + flash
static func explosion(parent: Node, at: Vector3, size := 1.0) -> void:
	var root := Node3D.new()
	parent.add_child(root)
	root.global_position = at
	var fire := emitter(true, 40, 0.8, 4.4 * size)
	fire.one_shot = true; fire.explosiveness = 1.0
	fire.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	fire.emission_sphere_radius = 1.3 * size
	fire.direction = Vector3.UP; fire.spread = 180.0
	fire.initial_velocity_min = 4.0; fire.initial_velocity_max = 11.0 * size
	fire.gravity = Vector3(0, 4, 0)
	fire.damping_min = 5.0; fire.damping_max = 7.0
	fire.scale_amount_min = 0.7; fire.scale_amount_max = 1.5
	fire.scale_amount_curve = _grow_curve()
	fire.color_ramp = ramp([Color(1, 0.97, 0.8), Color(1, 0.6, 0.15), Color(0.85, 0.22, 0.05, 0.75), Color(0.12, 0.06, 0.03, 0)])
	root.add_child(fire)
	var core := emitter(true, 6, 0.3, 7.0 * size)
	core.one_shot = true; core.explosiveness = 1.0
	core.color_ramp = ramp([Color(1, 1, 0.9), Color(1, 0.7, 0.3, 0)])
	root.add_child(core)
	var column := emitter(false, 26, 3.2, 4.2 * size)
	column.one_shot = true; column.explosiveness = 0.6
	column.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	column.emission_sphere_radius = 1.0 * size
	column.direction = Vector3.UP; column.spread = 14.0
	column.initial_velocity_min = 3.0; column.initial_velocity_max = 8.0 * size
	column.gravity = Vector3(0, 2.0, 0)
	column.damping_min = 0.8; column.damping_max = 1.4
	column.scale_amount_curve = _grow_curve()
	column.color_ramp = ramp([Color(0.2, 0.16, 0.13, 0.0), Color(0.18, 0.15, 0.13, 0.8), Color(0.32, 0.28, 0.25, 0.5), Color(0.45, 0.4, 0.36, 0)])
	root.add_child(column)
	var sparks := emitter(true, 40, 0.8, 0.28)
	sparks.one_shot = true; sparks.explosiveness = 1.0
	sparks.direction = Vector3.UP; sparks.spread = 80.0
	sparks.initial_velocity_min = 12.0; sparks.initial_velocity_max = 26.0 * size
	sparks.gravity = Vector3(0, -22, 0)
	sparks.color_ramp = ramp([Color(1, 0.95, 0.6), Color(1, 0.5, 0.1), Color(0.6, 0.12, 0.0, 0)])
	root.add_child(sparks)
	# debris chunks (lit, tumbling)
	if _chunk_mesh == null:
		var bm := BoxMesh.new()
		bm.size = Vector3(0.32, 0.18, 0.4)
		var cm := StandardMaterial3D.new()
		cm.albedo_color = Color(0.22, 0.19, 0.17); cm.metallic = 0.6; cm.roughness = 0.6
		bm.material = cm
		_chunk_mesh = bm
	var deb := CPUParticles3D.new()
	deb.mesh = _chunk_mesh
	deb.amount = int(14 * size)
	deb.lifetime = 1.6
	deb.one_shot = true; deb.explosiveness = 1.0
	deb.local_coords = false
	deb.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	deb.direction = Vector3.UP; deb.spread = 70.0
	deb.initial_velocity_min = 8.0; deb.initial_velocity_max = 18.0 * size
	deb.gravity = Vector3(0, -24, 0)
	deb.angular_velocity_min = -720.0; deb.angular_velocity_max = 720.0
	deb.particle_flag_rotate_y = true
	deb.scale_amount_min = 0.6; deb.scale_amount_max = 1.6
	root.add_child(deb)
	# shockwave ring on the ground
	var ring := ring_mesh(1.0, Color(1.0, 0.75, 0.45, 0.9), 0.18)
	ring.position.y = 0.25
	root.add_child(ring)
	var light := OmniLight3D.new()
	light.light_color = Color(1, 0.6, 0.25)
	light.light_energy = 8.0
	light.omni_range = 16.0 * size
	root.add_child(light)
	fire.emitting = true; core.emitting = true; column.emitting = true; sparks.emitting = true; deb.emitting = true
	var tw := root.create_tween()
	tw.set_parallel(true)
	tw.tween_property(light, "light_energy", 0.0, 0.4)
	tw.tween_property(ring, "scale", Vector3.ONE * 22.0 * size, 0.55).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_method(func(v: float) -> void: (ring.material_override as ShaderMaterial).set_shader_parameter("fade", v), 1.0, 0.0, 0.5)
	root.get_tree().create_timer(3.6).timeout.connect(root.queue_free)

## launcher muzzle flash + smoke puff (dir = firing direction)
static func muzzle(parent: Node, at: Vector3, dir: Vector3) -> void:
	var root := Node3D.new()
	parent.add_child(root)
	root.global_position = at
	var flash := emitter(true, 5, 0.12, 1.6)
	flash.one_shot = true; flash.explosiveness = 1.0
	flash.direction = dir; flash.spread = 10.0
	flash.initial_velocity_min = 2.0; flash.initial_velocity_max = 6.0
	flash.color_ramp = ramp([Color(1, 1, 0.85), Color(1, 0.6, 0.2, 0)])
	root.add_child(flash)
	var puff := emitter(false, 12, 0.9, 1.1)
	puff.one_shot = true; puff.explosiveness = 0.9
	puff.direction = -dir + Vector3.UP * 0.3; puff.spread = 50.0
	puff.initial_velocity_min = 1.0; puff.initial_velocity_max = 4.0
	puff.damping_min = 2.0; puff.damping_max = 3.0
	puff.scale_amount_curve = _grow_curve()
	puff.color_ramp = ramp([Color(0.85, 0.82, 0.78, 0.0), Color(0.8, 0.77, 0.73, 0.65), Color(0.7, 0.67, 0.64, 0)])
	root.add_child(puff)
	flash.emitting = true; puff.emitting = true
	root.get_tree().create_timer(1.2).timeout.connect(root.queue_free)

static var _grow: Curve
static func _grow_curve() -> Curve:
	if _grow == null:
		_grow = Curve.new()
		_grow.max_value = 1.5
		_grow.add_point(Vector2(0, 0.35))
		_grow.add_point(Vector2(0.3, 0.9))
		_grow.add_point(Vector2(1, 1.25))
	return _grow
