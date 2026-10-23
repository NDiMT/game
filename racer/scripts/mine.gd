class_name Mine
extends Node3D
## Spiked proximity mine. Drops from the rear bumper, bounces once, settles on the road,
## arms after d.arm seconds (blinking red light + faint red proximity ring).

var owner_car: Car
var game: Node
var d: Dictionary
var vel := Vector3.ZERO
var _t := 0.0
var _bounced := false
var _settled := false
var _model: Node3D
var _light: MeshInstance3D
var _ring: MeshInstance3D
var _ray := PhysicsRayQueryParameters3D.new()

static var _m_disc: Mesh
static var _m_band: Mesh
static var _m_spike: Mesh
static var _m_light: Mesh

func drop(p_game: Node, p_owner: Car, def: Dictionary, at: Vector3, v: Vector3) -> void:
	game = p_game
	owner_car = p_owner
	d = def
	vel = v
	global_position = at
	_ray.collision_mask = 1

static func _build_meshes() -> void:
	var metal := StandardMaterial3D.new()
	metal.albedo_color = Color(0.2, 0.2, 0.22); metal.metallic = 0.75; metal.roughness = 0.4
	var disc := CylinderMesh.new()
	disc.top_radius = 0.42; disc.bottom_radius = 0.62; disc.height = 0.3; disc.radial_segments = 12; disc.rings = 1
	disc.material = metal
	_m_disc = disc
	var band := CylinderMesh.new()
	band.top_radius = 0.64; band.bottom_radius = 0.64; band.height = 0.1; band.radial_segments = 12; band.rings = 1
	var hm := StandardMaterial3D.new(); hm.albedo_color = Color(0.95, 0.68, 0.08)
	band.material = hm
	_m_band = band
	var spike := CylinderMesh.new()
	spike.top_radius = 0.0; spike.bottom_radius = 0.08; spike.height = 0.42; spike.radial_segments = 5; spike.rings = 1
	var sm := StandardMaterial3D.new(); sm.albedo_color = Color(0.75, 0.74, 0.7); sm.metallic = 0.8; sm.roughness = 0.3
	spike.material = sm
	_m_spike = spike
	var li := SphereMesh.new()
	li.radius = 0.14; li.height = 0.22; li.radial_segments = 8; li.rings = 3
	var lm := StandardMaterial3D.new()
	lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	lm.albedo_color = Color(1, 0.1, 0.05)
	lm.emission_enabled = true; lm.emission = Color(1, 0.08, 0.03); lm.emission_energy_multiplier = 6.0
	li.material = lm
	_m_light = li

func _ready() -> void:
	if _m_disc == null: _build_meshes()
	_model = Node3D.new()
	add_child(_model)
	var disc := MeshInstance3D.new(); disc.mesh = _m_disc; disc.position.y = 0.15
	_model.add_child(disc)
	var band := MeshInstance3D.new(); band.mesh = _m_band; band.position.y = 0.06
	_model.add_child(band)
	for i in 8:
		var a := i * TAU / 8.0
		var s := MeshInstance3D.new()
		s.mesh = _m_spike
		var out := Vector3(cos(a), 0, sin(a))
		s.position = out * 0.66 + Vector3.UP * 0.12
		# cone axis (+Y) pointing outward, tilted slightly up
		s.basis = Basis.looking_at(-out, Vector3.UP) * Basis(Vector3.RIGHT, PI / 2 - 0.25)
		_model.add_child(s)
	for i in 3:
		var a := i * TAU / 3.0 + 0.5
		var s := MeshInstance3D.new()
		s.mesh = _m_spike
		s.position = Vector3(cos(a) * 0.22, 0.38, sin(a) * 0.22)
		s.scale = Vector3.ONE * 0.6
		_model.add_child(s)
	_light = MeshInstance3D.new()
	_light.mesh = _m_light
	_light.position.y = 0.34
	_model.add_child(_light)
	# ring sized to the real trigger radius (the node is scaled up for readability)
	_ring = Fx.ring_mesh(float(d.get("trigger_radius", 2.6)) * 2.0 / (float(d.get("size", 1.0)) * 1.7), Color(1.0, 0.12, 0.08, 0.8), 0.1)
	_ring.position.y = 0.06
	_ring.visible = false
	add_child(_ring)
	scale = Vector3.ONE * float(d.get("size", 1.0)) * 1.7

func _physics_process(dt: float) -> void:
	_t += dt
	if not _settled: _fly(dt)
	var armed := _t >= float(d.arm)
	_light.visible = (not armed) or fmod(_t, 0.45) < 0.22
	if _settled:
		var pulse := 0.5 + 0.5 * sin(_t * 6.0)
		(_ring.material_override as ShaderMaterial).set_shader_parameter("fade", (0.45 + 0.35 * pulse) if armed else 0.2)
		(_ring.material_override as ShaderMaterial).set_shader_parameter("pulse", pulse)
	if _t > float(d.life):
		queue_free()
		return
	if not armed or game == null: return
	var tr := float(d.trigger_radius)
	for c: Car in game.cars:
		if not c.alive: continue
		if c == owner_car and _t < 1.5: continue
		var rel := c.global_position - global_position
		if Vector2(rel.x, rel.z).length() < tr and absf(rel.y) < 2.5:
			game.explode(global_position + Vector3.UP * 0.4, float(d.radius), float(d.damage), owner_car, c, float(d.get("size", 1.0)))
			queue_free()
			return

func _fly(dt: float) -> void:
	vel.y -= 22.0 * dt
	var from := global_position
	var to := from + vel * dt
	_ray.from = from + Vector3.UP * 0.3
	_ray.to = to + Vector3.DOWN * 0.05
	var hit := get_world_3d().direct_space_state.intersect_ray(_ray)
	_model.rotate_y(dt * 9.0)
	if hit.is_empty():
		global_position = to
		return
	var n: Vector3 = hit.normal
	if not _bounced and vel.y < -2.0:
		_bounced = true
		global_position = hit.position + n * 0.05
		vel = vel.bounce(n) * 0.42
		vel.x *= 0.7; vel.z *= 0.7
		if game: game.sfx.play_at("mine", global_position, game, -6.0)
		return
	_settled = true
	global_position = hit.position
	var fwd := Vector3.FORWARD.slide(n).normalized()
	global_basis = Basis(n.cross(fwd).normalized(), n, -fwd).orthonormalized().scaled(scale)
	_ring.visible = true
