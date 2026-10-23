class_name Rocket
extends Node3D
## Rocket from the roof launcher: short rise out of the tube, then a homing dive.
## Homing strength = lock progress (partial lock = weaker), no target = straight ahead.
## Manual ray-marched projectile (no physics body), with a proximity fuse.

var shooter: Car
var target: Car
var game: Node
var p: Dictionary            # projectile stats from WeaponDefs
var homing := 1.0
var vel := Vector3.ZERO
var _t := 0.0
var _cruise := 70.0
var _ray := PhysicsRayQueryParameters3D.new()
var _trail: CPUParticles3D
var _sparks: CPUParticles3D
var _flame: MeshInstance3D
var _dead := false

static var _mesh_body: Mesh
static var _mesh_nose: Mesh
static var _mesh_fin: Mesh
static var _mesh_flame: Mesh

func launch(p_game: Node, p_shooter: Car, p_target: Car, xf: Transform3D, stats: Dictionary, p_homing: float) -> void:
	game = p_game
	shooter = p_shooter
	target = p_target
	p = stats
	homing = clampf(p_homing, 0.0, 1.0)
	var dir := xf.basis.z.normalized()
	var carry := maxf(0.0, p_shooter.speed)
	vel = dir * (float(p.launch_speed) + carry) + Vector3.UP * 4.0
	_cruise = float(p.speed) + carry * 0.8
	global_position = xf.origin
	_ray.collision_mask = 1 | 2
	_ray.exclude = [p_shooter.get_rid()]
	scale = Vector3.ONE * float(p.get("size", 1.0))
	_orient()

static func _build_meshes() -> void:
	var body := CylinderMesh.new()
	body.top_radius = 0.17; body.bottom_radius = 0.17; body.height = 1.25; body.radial_segments = 8; body.rings = 1
	var bm := StandardMaterial3D.new()
	bm.albedo_color = Color(0.82, 0.8, 0.74); bm.metallic = 0.5; bm.roughness = 0.35
	body.material = bm
	_mesh_body = body
	var nose := SphereMesh.new()
	nose.radius = 0.2; nose.height = 0.5; nose.radial_segments = 8; nose.rings = 4
	var nm := StandardMaterial3D.new()
	nm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	nm.albedo_color = Color(1, 0.3, 0.12)
	nm.emission_enabled = true; nm.emission = Color(1, 0.3, 0.1); nm.emission_energy_multiplier = 4.0
	nose.material = nm
	_mesh_nose = nose
	var fin := BoxMesh.new()
	fin.size = Vector3(0.04, 0.5, 0.3)
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.85, 0.2, 0.12)
	fin.material = fm
	_mesh_fin = fin
	var fl := CylinderMesh.new()
	fl.top_radius = 0.2; fl.bottom_radius = 0.0; fl.height = 1.4; fl.radial_segments = 8; fl.rings = 1
	var flm := StandardMaterial3D.new()
	flm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	flm.albedo_color = Color(1, 0.7, 0.3, 0.95)
	fl.material = flm
	_mesh_flame = fl

func _ready() -> void:
	if _mesh_body == null: _build_meshes()
	var model := Node3D.new()
	add_child(model)
	var body := MeshInstance3D.new()
	body.mesh = _mesh_body
	body.rotation.x = PI / 2 # cylinder along +Z
	model.add_child(body)
	var nose := MeshInstance3D.new()
	nose.mesh = _mesh_nose
	nose.position = Vector3(0, 0, 0.66)
	model.add_child(nose)
	for k in 4:
		var f := MeshInstance3D.new()
		f.mesh = _mesh_fin
		f.position = Vector3(0, 0, -0.5)
		f.rotation.z = k * PI * 0.5
		f.position += Vector3(cos(k * PI * 0.5 + PI / 2), sin(k * PI * 0.5 + PI / 2), 0) * 0.18
		model.add_child(f)
	_flame = MeshInstance3D.new()
	_flame.mesh = _mesh_flame
	_flame.rotation.x = PI / 2
	_flame.position = Vector3(0, 0, -1.3)
	model.add_child(_flame)
	_trail = Fx.emitter(false, 80, 1.1, 1.7)
	_trail.direction = Vector3.UP; _trail.spread = 180.0
	_trail.initial_velocity_min = 0.3; _trail.initial_velocity_max = 1.2
	_trail.gravity = Vector3(0, 0.6, 0)
	_trail.scale_amount_curve = Fx._grow_curve()
	_trail.color_ramp = Fx.ramp([Color(1, 0.85, 0.55, 1.0), Color(0.92, 0.88, 0.82, 0.8), Color(0.7, 0.67, 0.63, 0.45), Color(0.6, 0.57, 0.54, 0)])
	_trail.position = Vector3(0, 0, -0.9)
	add_child(_trail)
	_trail.emitting = true
	_sparks = Fx.emitter(true, 26, 0.3, 0.2)
	_sparks.direction = Vector3(0, 0, -1); _sparks.spread = 25.0
	_sparks.initial_velocity_min = 5.0; _sparks.initial_velocity_max = 11.0
	_sparks.color_ramp = Fx.ramp([Color(1, 0.95, 0.6), Color(1, 0.5, 0.1, 0.8), Color(0.8, 0.2, 0.0, 0)])
	_sparks.local_coords = false
	_sparks.position = Vector3(0, 0, -0.9)
	add_child(_sparks)
	_sparks.emitting = true
	if game: game.rockets.append(self)

func _exit_tree() -> void:
	if game: game.rockets.erase(self)

func _orient() -> void:
	if vel.length() > 0.1:
		look_at(global_position + vel, Vector3.UP if absf(vel.normalized().y) < 0.98 else Vector3.FORWARD)
		rotate_object_local(Vector3.UP, PI) # model is built along +Z

func _physics_process(dt: float) -> void:
	if _dead: return
	_t += dt
	if _t > float(p.life):
		_explode(global_position, null)
		return
	var rise := float(p.rise_time)
	var spd := vel.length()
	if _t < rise:
		# leaving the tube: keep climbing a little, accelerate
		vel += vel.normalized() * 40.0 * dt
		vel.y -= 4.0 * dt
	else:
		spd = move_toward(spd, _cruise, 90.0 * dt)
		var dir := vel.normalized()
		if target and target.alive and homing > 0.0:
			var aim := target.global_position + target.global_basis.y * 0.9 + target.linear_velocity * 0.12
			var want := (aim - global_position).normalized()
			var turn := float(p.turn) * homing * (1.0 + minf(1.5, (_t - rise) * 1.5))
			var ang := dir.angle_to(want)
			if ang > 0.0001: dir = dir.slerp(want, minf(1.0, turn * dt / ang)).normalized()
			if global_position.distance_to(aim) < float(p.fuse):
				_explode(global_position, target)
				return
		else:
			# dumb-fire: level out and fly straight ahead, slight drop
			dir.y = move_toward(dir.y, -0.03, dt * 0.8)
			dir = dir.normalized()
		vel = dir * spd
	var from := global_position
	var to := from + vel * dt
	_ray.from = from
	_ray.to = to + vel.normalized() * 0.6
	var hit := get_world_3d().direct_space_state.intersect_ray(_ray)
	if not hit.is_empty():
		_explode(hit.position, hit.collider as Car)
		return
	global_position = to
	_orient()
	_flame.scale = Vector3.ONE * randf_range(0.8, 1.25)

func _explode(at: Vector3, direct: Car) -> void:
	_dead = true
	if game: game.explode(at, float(p.radius), float(p.damage), shooter, direct, float(p.get("size", 1.0)), bool(p.get("charges_ult", true)))
	# leave the smoke trail behind to fade out
	for e: CPUParticles3D in [_trail, _sparks]:
		e.emitting = false
		var tp := e.global_position
		remove_child(e)
		get_parent().add_child(e)
		e.global_position = tp
		get_tree().create_timer(1.6).timeout.connect(e.queue_free)
	queue_free()
